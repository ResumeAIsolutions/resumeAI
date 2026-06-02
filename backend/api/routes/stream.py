"""
Streaming tailor endpoints:
  POST /api/tailor/start  — validates + parses input, starts pipeline in background,
                            returns { request_id } immediately.
  GET  /api/tailor/stream/{request_id} — SSE stream of stage progress + final result.
"""
import asyncio
import json
import uuid
import logging

from typing import Optional
from fastapi import APIRouter, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from api.models.responses import TailorResponse
from parsers.pdf_parser import parse_pdf
from parsers.docx_parser import parse_docx
from pipeline import progress_store
from pipeline.orchestrator import run_pipeline_background, _background_tasks
from limiter import limiter
import utils.subscription_store as sub_store
import utils.auth as auth_utils

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_FILE_SIZE = 5 * 1024 * 1024
MIN_JD_WORDS = 50
SSE_TIMEOUT_SECONDS = 300  # 5 minutes max — typical run is 30-90s, this catches silent failures


@router.post("/tailor/start")
@limiter.limit("10/minute")
async def start_tailor(
    request: Request,
    resume_file: UploadFile = File(...),
    job_description: str = Form(...),
    user_id: Optional[str] = Form(None),
    original_filename: Optional[str] = Form(None),
    authorization: Optional[str] = Header(None),
):
    filename = (resume_file.filename or "").lower()
    if not (filename.endswith(".pdf") or filename.endswith(".docx")):
        raise HTTPException(
            status_code=400,
            detail={"code": "unsupported_file_type", "message": "Only PDF and DOCX files are supported."},
        )

    file_bytes = await resume_file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail={"code": "file_too_large", "message": "File must be under 5 MB."},
        )

    try:
        resume_text = parse_pdf(file_bytes) if filename.endswith(".pdf") else parse_docx(file_bytes)
    except Exception:
        raise HTTPException(
            status_code=422,
            detail={"code": "parse_failed", "message": "Could not extract text from your resume. Try saving as a different format."},
        )

    if not resume_text.strip():
        raise HTTPException(
            status_code=422,
            detail={"code": "parse_failed", "message": "No text found in resume. Ensure it is not a scanned image."},
        )

    jd_words = len(job_description.split())
    if jd_words < MIN_JD_WORDS:
        raise HTTPException(
            status_code=400,
            detail={"code": "jd_too_short", "message": f"Job description is too short ({jd_words} words). Paste the full description for best results."},
        )

    # If a JWT is provided, verify it and use the authoritative user_id from the token.
    # This prevents passing a fake/other user's user_id via the form field.
    is_admin = False
    if authorization:
        try:
            verified = await asyncio.to_thread(auth_utils.verify_token_full, authorization)
            user_id = verified.user_id
            is_admin = verified.is_admin
        except HTTPException as e:
            if e.status_code == 401:
                raise  # invalid token — reject
            user_id = None  # 503 or auth not configured — proceed as unauthenticated
        except Exception:
            user_id = None  # unexpected error — proceed as unauthenticated

    # Enforce free tier tailor limit for logged-in users.
    # Usage is NOT incremented here — it's incremented in the orchestrator
    # only after the pipeline succeeds, so failed runs don't consume credits.
    # Admins bypass the limit entirely.
    if user_id and not is_admin:
        try:
            tier = await asyncio.to_thread(sub_store.get_tier, user_id)
            if tier == "free":
                usage = await asyncio.to_thread(sub_store.get_monthly_usage, user_id)
                if usage >= sub_store.FREE_MONTHLY_LIMIT:
                    raise HTTPException(
                        status_code=403,
                        detail={"code": "limit_reached", "message": "You've used all 3 free tailors this month. Upgrade to Pro for unlimited."},
                    )
        except HTTPException:
            raise  # limit_reached must propagate
        except Exception:
            # Supabase unreachable — allow through
            pass

    request_id = str(uuid.uuid4())
    progress_store.create(request_id)

    filename = original_filename or resume_file.filename or ""
    task = asyncio.create_task(
        run_pipeline_background(resume_text, job_description, request_id, user_id, filename)
    )
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)

    return {"request_id": request_id}


@router.get("/tailor/stream/{request_id}")
async def stream_tailor_progress(request_id: str, request: Request):
    if not progress_store.is_known(request_id):
        raise HTTPException(status_code=404, detail="Streaming session not found. Please re-submit your resume.")

    async def generate():
        import time
        offset = 0
        started_at = time.monotonic()
        while True:
            if await request.is_disconnected():
                progress_store.cleanup(request_id)
                break

            # Timeout: abort if pipeline takes too long
            if time.monotonic() - started_at > SSE_TIMEOUT_SECONDS:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Pipeline timed out. Please try again.'})}\n\n"
                progress_store.cleanup(request_id)
                return

            batch = progress_store.get_from(request_id, offset)
            for event in batch:
                yield f"data: {json.dumps(event)}\n\n"
                offset += 1
                if event.get("type") in ("done", "error"):
                    progress_store.cleanup(request_id)
                    return

            await asyncio.sleep(0.25)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
