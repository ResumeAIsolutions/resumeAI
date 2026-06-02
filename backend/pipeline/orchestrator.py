import asyncio
import concurrent.futures
import logging
import uuid
from typing import Any, List, Dict, Optional

from api.models.responses import TailorResponse, EdgeCase, JDAnalysis, ResumeSummary, RecentRole, ContactInfo
from pipeline.stage1_parse import parse_resume
from pipeline.stage2_analyze import analyze_jd
from pipeline.stage3_rewrite import rewrite_bullets
from pipeline.stage4_validate import validate_rewrites
from utils.diff import build_diff, get_revert_edge_cases
from utils.scoring import compute_scores
import utils.supabase_store as supabase_store
import utils.subscription_store as sub_store
from pipeline.session_store import get_store, SESSION_TTL_SECONDS
from pipeline import progress_store

logger = logging.getLogger(__name__)
_store = get_store()


def get_session(session_id: str) -> Dict[str, Any]:
    return _store.get(session_id)


def delete_session(session_id: str):
    _store.delete(session_id)


def _detect_edge_cases(resume_structured: dict, jd_text: str) -> List[EdgeCase]:
    cases = []

    layout = resume_structured.get("layout_warning", "none")
    if layout in ("creative", "table", "columns"):
        cases.append(EdgeCase(
            type="creative_layout",
            message="Your resume uses a complex layout. Some formatting may not transfer to the tailored version.",
            severity="warning",
        ))

    bullet_count = sum(
        len(entry.get("bullets", []))
        for section in resume_structured.get("sections", [])
        for entry in section.get("entries", [])
    )
    if bullet_count == 0:
        cases.append(EdgeCase(
            type="no_bullets",
            message="No bullet points were found in your resume. Consider adding bullet points to your experience section for best results.",
            severity="warning",
        ))
    elif bullet_count < 5:
        cases.append(EdgeCase(
            type="sparse_resume",
            message="Your resume has very few bullet points. Adding more detail to your experience will improve tailoring results.",
            severity="info",
        ))

    if len(jd_text.split()) < 150:
        cases.append(EdgeCase(
            type="short_jd",
            message="The job description is quite short. For best results, paste the full job description including requirements and responsibilities.",
            severity="warning",
        ))

    return cases


def _run_pipeline_sync(
    resume_text: str,
    jd_text: str,
    request_id: Optional[str] = None,
    user_id: Optional[str] = None,
    original_filename: str = "",
) -> TailorResponse:
    """
    Blocking pipeline that runs all 4 AI stages sequentially.
    Must be called from a thread pool (via asyncio.to_thread), NOT directly
    from an async context -- all AI SDK calls are blocking HTTP.
    """
    def emit(event: dict) -> None:
        if request_id:
            progress_store.push(request_id, event)

    # Stages 1 and 2 are independent — run them in parallel to save 3–10s
    emit({"type": "stage", "stage": 1, "message": "Parsing your resume..."})
    emit({"type": "stage", "stage": 2, "message": "Analyzing the job description..."})
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(parse_resume, resume_text)
        f2 = executor.submit(analyze_jd, jd_text)
        resume_structured = f1.result()
        jd_analysis_raw = f2.result()

    emit({"type": "stage", "stage": 3, "message": "Tailoring your bullets..."})
    rewrites = rewrite_bullets(resume_structured, jd_analysis_raw)

    emit({"type": "stage", "stage": 4, "message": "Verifying accuracy..."})
    verdicts = validate_rewrites(resume_structured, rewrites, jd_analysis_raw)

    diff = build_diff(resume_structured, rewrites, verdicts)

    # Compute scores on the tailored text (accepted rewrites applied),
    # not the original resume_text, so scores reflect actual improvements.
    tailored_text_parts = []
    for section in resume_structured.get("sections", []):
        for entry in section.get("entries", []):
            for bullet in entry.get("bullets", []):
                bid = bullet["bullet_id"]
                verdict = verdicts.get(bid, {})
                is_reverted = verdict.get("verdict") == "revert" or verdict.get("is_fabricated")
                if not is_reverted and bid in rewrites:
                    tailored_text_parts.append(rewrites[bid].get("tailored", bullet["text"]))
                else:
                    tailored_text_parts.append(bullet["text"])
    tailored_resume_text = "\n".join(tailored_text_parts)
    scores = compute_scores(resume_structured, jd_analysis_raw, tailored_resume_text)
    edge_cases = _detect_edge_cases(resume_structured, jd_text)
    edge_cases += get_revert_edge_cases(resume_structured, rewrites, verdicts)

    total_bullets = sum(
        len(entry.get("bullets", []))
        for section in resume_structured.get("sections", [])
        for entry in section.get("entries", [])
    )

    jd_analysis = JDAnalysis(
        required_skills=jd_analysis_raw.get("required_skills", []),
        preferred_skills=jd_analysis_raw.get("preferred_skills", []),
        ats_keywords=jd_analysis_raw.get("ats_keywords", []),
        role_level=jd_analysis_raw.get("role_level", "mid"),
        industry=jd_analysis_raw.get("industry", ""),
    )

    recent_roles = [
        RecentRole(
            company=entry.get("company", ""),
            role=entry.get("role", ""),
            dates=entry.get("dates", ""),
        )
        for section in resume_structured.get("sections", [])
        if section.get("type") == "experience"
        for entry in section.get("entries", [])[:3]
    ]
    raw_contact = resume_structured.get("contact", {})
    contact = ContactInfo(
        email=raw_contact.get("email", ""),
        phone=raw_contact.get("phone", ""),
        location=raw_contact.get("location", ""),
        linkedin=raw_contact.get("linkedin", ""),
    )
    resume_summary = ResumeSummary(
        name=resume_structured.get("name", ""),
        title=resume_structured.get("title"),
        summary=resume_structured.get("summary"),
        contact=contact,
        sections=[s.get("title", "") for s in resume_structured.get("sections", [])],
        recent_roles=recent_roles,
    )

    session_id = str(uuid.uuid4())
    response = TailorResponse(
        session_id=session_id,
        scores=scores,
        jd_analysis=jd_analysis,
        resume_summary=resume_summary,
        diff=diff,
        edge_cases=edge_cases,
        total_bullets=total_bullets,
        changed_bullets=len(diff),
    )

    session_data = {
        "resume_structured": resume_structured,
        "resume_text": resume_text,
        "rewrites": rewrites,
        "response": response.model_dump(),
        "user_id": user_id,  # stored for ownership check on download
    }
    _store.set(session_id, session_data, ttl_seconds=SESSION_TTL_SECONDS)

    # Persist permanently to Supabase so downloads survive Redis TTL expiry
    supabase_store.save_session(
        session_id=session_id,
        user_id=user_id,
        original_filename=original_filename,
        jd_text=jd_text,
        resume_structured=resume_structured,
        rewrites=rewrites,
        response=response.model_dump(),
    )

    return response



# Background task set — prevents garbage collection of in-flight tasks
_background_tasks: set = set()


async def run_pipeline_background(
    resume_text: str,
    jd_text: str,
    request_id: str,
    user_id: Optional[str] = None,
    original_filename: str = "",
) -> None:
    """
    Fire-and-forget wrapper used by the streaming endpoint.
    Runs the pipeline in a thread, pushes progress events, and stores the final
    result in both Redis and Supabase.
    """
    logger.info("Pipeline background task STARTED for request %s (resume len=%d, jd len=%d)",
                request_id, len(resume_text), len(jd_text))
    try:
        result = await asyncio.to_thread(
            _run_pipeline_sync, resume_text, jd_text, request_id, user_id, original_filename
        )
        # Increment usage only after pipeline succeeds — failed runs don't consume credits
        if user_id:
            try:
                await asyncio.to_thread(sub_store.increment_usage, user_id)
            except Exception as e:
                logger.warning("Failed to increment usage for %s: %s", user_id, e)
        progress_store.push(request_id, {"type": "done", "result": result.model_dump()})
    except Exception as e:
        logger.error("Pipeline failed for request %s: %s", request_id, e, exc_info=True)
        progress_store.push(request_id, {"type": "error", "message": str(e)})
