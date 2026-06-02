from __future__ import annotations
from typing import Optional
import logging
from fastapi import APIRouter, HTTPException
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

router = APIRouter()


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


@router.post("/download/pdf")
async def download_pdf(req: DownloadRequest):
    # Resolved template with safe fallback
    template_id = req.template_id or "jake"
    
    # Gate: non-default templates require Pro
    if template_id != "jake":
        if not req.user_id:
            raise HTTPException(
                status_code=403,
                detail={"code": "upgrade_required", "message": "Premium templates require a Pro account. Please sign in or upgrade."},
            )
        try:
            tier = sub_store.get_tier(req.user_id)
        except Exception:
            tier = "free"
        if tier != "pro":
            raise HTTPException(
                status_code=403,
                detail={"code": "upgrade_required", "message": "This is a Pro template. Upgrade to unlock all layouts."},
            )

    session = _get_session_data(req.session_id, req.user_id)
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
async def download_docx(req: DownloadRequest):
    if req.user_id:
        try:
            tier = sub_store.get_tier(req.user_id)
        except Exception:
            tier = "free"
        if tier != "pro":
            raise HTTPException(
                status_code=403,
                detail={"code": "upgrade_required", "message": "DOCX download is a Pro feature. Upgrade to access it."},
            )
    else:
        raise HTTPException(
            status_code=403,
            detail={"code": "upgrade_required", "message": "DOCX download requires a Pro account."},
        )
    session = _get_session_data(req.session_id, req.user_id)
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
