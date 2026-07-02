from __future__ import annotations
from typing import Optional
import logging
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from io import BytesIO

logger = logging.getLogger(__name__)

from api.models.requests import DownloadRequest
from pipeline.orchestrator import get_session
from generators.latex_generator import generate_pdf_latex
from generators.pdf_generator import generate_pdf
from generators.docx_generator import generate_docx
import utils.supabase_store as supabase_store
import utils.subscription_store as sub_store
import utils.auth as auth_utils

router = APIRouter()


def _build_template_preview_resume() -> dict:
    """Representative resume used for public template previews."""
    return {
        "name": "Dashiell Hammett",
        "title": "Senior Software Engineer",
        "summary": (
            "Results-driven software engineer with 8+ years of experience building scalable data systems "
            "and full-stack applications. Proven track record leading cross-functional teams, "
            "optimizing CI/CD pipelines, and shipping production ML systems."
        ),
        "contact": {
            "email": "dashiell@example.com",
            "phone": "(555) 010-0199",
            "location": "San Francisco, CA",
            "linkedin": "linkedin.com/in/dashiell",
        },
        "sections": [
            {
                "type": "experience",
                "title": "Work Experience",
                "entries": [
                    {
                        "company": "Continental Detective Agency",
                        "role": "Senior Software Engineer",
                        "location": "San Francisco, CA",
                        "dates": "Aug. 2021 – Present",
                        "bullets": [
                            {"bullet_id": "exp-1", "text": "Architected a distributed event-processing pipeline handling 2M+ daily transactions with sub-200ms latency using Kafka and Redis."},
                            {"bullet_id": "exp-2", "text": "Led migration of a monolithic REST API to microservices, cutting deployment time by 65% and improving fault isolation."},
                            {"bullet_id": "exp-3", "text": "Designed a real-time analytics dashboard for 500+ internal users, reducing manual reporting effort by 40%."},
                        ],
                    },
                    {
                        "company": "Gutting & Associates",
                        "role": "Software Engineer",
                        "location": "New York, NY",
                        "dates": "May 2018 – Jul. 2021",
                        "bullets": [
                            {"bullet_id": "exp-4", "text": "Built a React and FastAPI customer portal that onboarded 12,000+ users in the first quarter after launch."},
                            {"bullet_id": "exp-5", "text": "Optimized PostgreSQL performance across 15 critical endpoints, reducing p95 latency from 1.2s to 180ms."},
                        ],
                    },
                ],
            },
            {
                "type": "projects",
                "title": "Projects",
                "entries": [
                    {
                        "company": "CloudDeploy CLI",
                        "role": "Go, Terraform, AWS",
                        "dates": "Sep. 2022",
                        "bullets": [
                            {"bullet_id": "proj-1", "text": "Created an open-source CLI for one-command cloud deployments, reaching 1.2K GitHub stars in three months."},
                            {"bullet_id": "proj-2", "text": "Integrated Terraform plan previews and cost estimation to help teams reduce infrastructure spend by 25%."},
                        ],
                    }
                ],
            },
            {
                "type": "skills",
                "title": "Technical Skills",
                "entries": [
                    {"bullets": [{"bullet_id": "skill-1", "text": "Python, TypeScript, SQL, React, FastAPI, Docker, AWS, PostgreSQL, Redis, Kafka"}]}
                ],
            },
            {
                "type": "education",
                "title": "Education",
                "entries": [
                    {
                        "company": "Stanford University",
                        "role": "B.S. in Computer Science",
                        "dates": "June 2018",
                        "bullets": [{"bullet_id": "edu-1", "text": "GPA: 3.9/4.0"}],
                    }
                ],
            },
        ],
    }


def _get_session_data(session_id: str, requesting_user_id: str | None = None) -> dict:
    """Try Redis first, fall back to Supabase. Raises HTTPException if not found anywhere.
    Ownership check: if the session has an owner, the requester must match.
    """
    try:
        data = get_session(session_id)
    except KeyError:
        data = None

    if data is None:
        # Redis miss (expired or server restart) — try Supabase permanent store
        data = supabase_store.load_session(session_id)

    if not data:
        raise HTTPException(
            status_code=404,
            detail="Session not found. Please re-upload your resume.",
        )

    # Ownership check: if the session has an owner, the requester must provide
    # a matching user_id. This prevents IDOR where omitting user_id bypasses the check.
    session_owner = data.get("user_id")
    if session_owner:
        if not requesting_user_id or requesting_user_id != session_owner:
            raise HTTPException(status_code=403, detail="Access denied.")

    return data


def _verify_request_user(authorization: Optional[str]) -> tuple[Optional[str], bool]:
    """Return the authenticated user_id and admin flag if a valid JWT is provided."""
    if not authorization:
        return None, False
    verified = auth_utils.verify_token_full(authorization)
    return verified.user_id, verified.is_admin


def _resolve_bullets(resume_structured: dict, accepted_bullets: dict, rewrites: dict) -> dict:
    """
    Build final bullet map: bullet_id -> final text.
    accepted_bullets maps bullet_id -> "original" or the accepted tailored text.
    """
    final: dict = {}
    for section in resume_structured.get("sections", []):
        for entry in section.get("entries", []):
            for bullet in entry.get("bullets", []):
                bid = bullet["bullet_id"]
                choice = accepted_bullets.get(bid)
                if choice == "original" or choice is None:
                    final[bid] = bullet["text"]
                else:
                    final[bid] = choice if choice else bullet["text"]
    return final


@router.get("/download/template-preview/{template_id}")
async def download_template_preview(template_id: str):
    if template_id not in {"jake", "modern", "soham", "overleaf"}:
        raise HTTPException(status_code=404, detail="Template not found.")

    resume_structured = _build_template_preview_resume()
    try:
        pdf_bytes = generate_pdf_latex(resume_structured, {}, template_id=template_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Template preview failed: {str(e)}")

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{template_id}_template_preview.pdf"'},
    )


@router.post("/download/pdf")
async def download_pdf(req: DownloadRequest, authorization: Optional[str] = Header(None)):
    requesting_user_id, is_admin = _verify_request_user(authorization)

    # Resolved template with safe fallback
    template_id = req.template_id or "jake"

    # Gate: non-default templates require Pro
    if template_id != "jake":
        if not requesting_user_id:
            raise HTTPException(
                status_code=403,
                detail={"code": "upgrade_required", "message": "Premium templates require a Pro account. Please sign in or upgrade."},
            )
        try:
            tier = sub_store.get_tier(requesting_user_id, is_admin=is_admin)
        except Exception:
            raise HTTPException(status_code=503, detail="We could not verify your Pro access right now. Please try again.")
        if tier != "pro":
            raise HTTPException(
                status_code=403,
                detail={"code": "upgrade_required", "message": "This is a Pro template. Upgrade to unlock all layouts."},
            )

    session = _get_session_data(req.session_id, requesting_user_id)
    resume_structured = session["resume_structured"]
    rewrites = session.get("rewrites", {})

    final_bullets = _resolve_bullets(resume_structured, req.accepted_bullets, rewrites)

    try:
        pdf_bytes = generate_pdf_latex(resume_structured, final_bullets, template_id=template_id)
        logger.info("PDF generated via LaTeX/tectonic with template: %s", template_id)
    except RuntimeError as e:
        logger.warning("LaTeX generation failed, falling back to reportlab: %s", e)
        try:
            pdf_bytes = generate_pdf(resume_structured, final_bullets)
            logger.info("PDF generated via reportlab fallback")
        except Exception as e2:
            raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e2)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

    # Persist user's bullet choices permanently
    supabase_store.update_accepted_bullets(req.session_id, req.accepted_bullets)

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=tailored_resume.pdf"},
    )


@router.post("/download/docx")
async def download_docx(req: DownloadRequest, authorization: Optional[str] = Header(None)):
    requesting_user_id, is_admin = _verify_request_user(authorization)

    if not requesting_user_id:
        raise HTTPException(
            status_code=403,
            detail={"code": "upgrade_required", "message": "DOCX download requires a Pro account."},
        )

    try:
        tier = sub_store.get_tier(requesting_user_id, is_admin=is_admin)
    except Exception:
        raise HTTPException(status_code=503, detail="We could not verify your Pro access right now. Please try again.")
    if tier != "pro":
        raise HTTPException(
            status_code=403,
            detail={"code": "upgrade_required", "message": "DOCX download is a Pro feature. Upgrade to access it."},
        )

    session = _get_session_data(req.session_id, requesting_user_id)
    resume_structured = session["resume_structured"]
    rewrites = session.get("rewrites", {})

    final_bullets = _resolve_bullets(resume_structured, req.accepted_bullets, rewrites)

    try:
        docx_bytes = generate_docx(resume_structured, final_bullets, template_id=req.template_id or "jake")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DOCX generation failed: {str(e)}")

    # Persist user's bullet choices permanently
    supabase_store.update_accepted_bullets(req.session_id, req.accepted_bullets)

    return StreamingResponse(
        BytesIO(docx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=tailored_resume.docx"},
    )
