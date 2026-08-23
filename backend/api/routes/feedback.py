"""
Feedback routes.
POST /api/feedback   — public, submit feedback (multipart/form-data with optional screenshot)
GET  /api/feedback   — admin-only, list feedback with optional type/status filters
PATCH /api/feedback  — admin-only, update feedback status
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
import urllib.parse
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel
from utils import auth as auth_utils

router = APIRouter(prefix="/feedback", tags=["feedback"])

_URL = (os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL", "")).rstrip("/")
_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
_ANON_KEY = os.getenv("VITE_SUPABASE_ANON_KEY", "") or os.getenv("SUPABASE_ANON_KEY", "")
FEEDBACK_BUCKET = "feedback-screenshots"


# ─── Helpers ───────────────────────────────────────────────────────────────────

def _is_configured() -> bool:
    return bool(_URL and _SERVICE_KEY)


def _db_req(method: str, table: str, body: Optional[bytes] = None, params: str = "") -> Optional[Any]:
    """Execute a Supabase REST request with the service role key."""
    if not _is_configured():
        return None
    url = f"{_URL}/rest/v1/{table}"
    if params:
        url = f"{url}?{params}"
    req = urllib.request.Request(url=url, method=method, data=body)
    req.add_header("Authorization", f"Bearer {_SERVICE_KEY}")
    req.add_header("apikey", _SERVICE_KEY)
    req.add_header("Content-Type", "application/json")
    if method == "POST":
        req.add_header("Prefer", "return=representation")
    elif method == "PATCH":
        req.add_header("Prefer", "return=minimal")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8")
            if not raw.strip():
                return True
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"DB Error ({method} {table}): {e.code} {e.reason} — {err_body}")
        return None
    except Exception as e:
        print(f"DB Error ({method} {table}): {e}")
        return None


def _upload_screenshot(file_bytes: bytes, user_id: Optional[str], ext: str) -> Optional[str]:
    """Upload screenshot to Supabase Storage; return public URL or None."""
    if not _is_configured() or not file_bytes:
        return None
    folder = user_id if user_id else "anonymous"
    timestamp = int(datetime.now(timezone.utc).timestamp() * 1000)
    path = f"{folder}/{timestamp}.{ext}"
    quoted_path = "/".join(urllib.parse.quote(p, safe="") for p in path.split("/"))
    url = f"{_URL}/storage/v1/object/{FEEDBACK_BUCKET}/{quoted_path}"
    req = urllib.request.Request(url=url, method="POST", data=file_bytes)
    req.add_header("Authorization", f"Bearer {_SERVICE_KEY}")
    req.add_header("apikey", _SERVICE_KEY)
    req.add_header("Content-Type", "image/*")
    req.add_header("x-upsert", "true")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status in (200, 201):
                return f"{_URL}/storage/v1/object/public/{FEEDBACK_BUCKET}/{quoted_path}"
    except Exception as e:
        print(f"Screenshot upload failed: {e}")
    return None


def _verify_admin(authorization: Optional[str] = Header(None)) -> str:
    return auth_utils.verify_admin_token(authorization).user_id


def _optional_user_from_token(authorization: Optional[str]) -> Optional[str]:
    """Try to extract user_id from token; return None if not present or invalid."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    try:
        req = urllib.request.Request(f"{_URL}/auth/v1/user", method="GET")
        req.add_header("Authorization", f"Bearer {token}")
        req.add_header("apikey", _ANON_KEY or _SERVICE_KEY)
        with urllib.request.urlopen(req, timeout=8) as resp:
            user = json.loads(resp.read().decode())
            return user.get("id")
    except Exception:
        return None


# ─── Routes ────────────────────────────────────────────────────────────────────

@router.post("")
async def submit_feedback(
    type: str = Form(...),
    message: str = Form(...),
    name: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    priority: Optional[str] = Form(None),
    browser: Optional[str] = Form(None),
    os_name: Optional[str] = Form(None),
    page_url: Optional[str] = Form(None),
    screen_size: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    authorization: Optional[str] = Header(None),
):
    """Submit feedback. No auth required."""
    if type not in ("bug", "feature", "general"):
        raise HTTPException(status_code=400, detail="type must be bug, feature, or general.")
    if priority and priority not in ("low", "medium", "high"):
        raise HTTPException(status_code=400, detail="priority must be low, medium, or high.")

    # Resolve user_id if authenticated
    user_id = _optional_user_from_token(authorization)

    # Handle screenshot upload
    image_url: Optional[str] = None
    if file and file.filename:
        file_bytes = await file.read()
        if len(file_bytes) > 0:
            ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "png").lower()
            if len(file_bytes) <= 5 * 1024 * 1024:  # 5 MB limit
                image_url = _upload_screenshot(file_bytes, user_id, ext)

    # Assemble metadata
    metadata: Dict[str, Any] = {}
    if browser:
        metadata["browser"] = browser
    if os_name:
        metadata["os"] = os_name
    if page_url:
        metadata["url"] = page_url
    if screen_size:
        metadata["screen_size"] = screen_size

    now = datetime.now(timezone.utc).isoformat()
    record = {
        "id": str(uuid.uuid4()),
        "type": type,
        "message": message,
        "name": name or None,
        "email": email or None,
        "priority": priority or None,
        "image_url": image_url,
        "metadata": metadata,
        "user_id": user_id,
        "status": "open",
        "created_at": now,
        "updated_at": now,
    }

    body = json.dumps(record, ensure_ascii=False).encode("utf-8")
    result = _db_req("POST", "feedback", body=body)
    if result is None:
        raise HTTPException(status_code=500, detail="Failed to save feedback.")

    saved = result[0] if isinstance(result, list) and result else record
    return {"success": True, "feedback": saved}


@router.get("")
async def list_feedback(
    type: Optional[str] = None,
    status: Optional[str] = None,
    admin_id: str = Depends(_verify_admin),
):
    """List all feedback. Admin only."""
    params_parts = ["order=created_at.desc", "limit=500"]
    if type and type != "all":
        params_parts.append(f"type=eq.{urllib.parse.quote(type, safe='')}")
    if status and status != "all":
        params_parts.append(f"status=eq.{urllib.parse.quote(status, safe='')}")

    params = "&".join(params_parts)
    rows = _db_req("GET", "feedback", params=params)
    if rows is None:
        raise HTTPException(status_code=503, detail="Could not fetch feedback.")
    return {"feedbacks": rows if isinstance(rows, list) else []}


class UpdateStatusRequest(BaseModel):
    id: str
    status: str


@router.patch("")
async def update_feedback_status(
    body: UpdateStatusRequest,
    admin_id: str = Depends(_verify_admin),
):
    """Update feedback status. Admin only."""
    if body.status not in ("open", "in-progress", "resolved"):
        raise HTTPException(status_code=400, detail="status must be open, in-progress, or resolved.")

    patch = json.dumps({
        "status": body.status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).encode("utf-8")
    result = _db_req(
        "PATCH", "feedback", body=patch,
        params=f"id=eq.{urllib.parse.quote(body.id, safe='')}",
    )
    if result is None:
        raise HTTPException(status_code=503, detail="Could not update feedback.")
    return {"ok": True}
