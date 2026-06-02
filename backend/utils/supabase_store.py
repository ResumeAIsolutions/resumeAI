from __future__ import annotations
import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

_URL = (os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL", "")).rstrip("/")
_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def is_configured() -> bool:
    return bool(_URL and _KEY)


def _req(method: str, table: str, body: Optional[bytes] = None, params: str = "") -> Optional[Any]:
    if not is_configured():
        return None
    url = f"{_URL}/rest/v1/{table}"
    if params:
        url = f"{url}?{params}"
    req = urllib.request.Request(url=url, method=method, data=body)
    req.add_header("Authorization", f"Bearer {_KEY}")
    req.add_header("apikey", _KEY)
    req.add_header("Content-Type", "application/json")
    if body and method == "PATCH":
        req.add_header("Prefer", "return=minimal")
    elif body and method == "POST":
        req.add_header("Prefer", "return=minimal,resolution=merge-duplicates")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8")
            if not raw.strip():
                return True # Success with no content
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        logger.error("DB Error (%s %s): %s %s - %s", method, table, e.code, e.reason, err_body)
        return None
    except Exception as e:
        logger.error("DB Error (%s %s): %s", method, table, e)
        return None


def download_file_from_storage(bucket: str, path: str) -> Optional[bytes]:
    """Download a file's raw bytes from Supabase Storage."""
    if not is_configured():
        return None
    quoted_path = "/".join(urllib.parse.quote(part, safe='') for part in path.split("/"))
    url = f"{_URL}/storage/v1/object/{bucket}/{quoted_path}"
    req = urllib.request.Request(url=url, method="GET")
    req.add_header("Authorization", f"Bearer {_KEY}")
    req.add_header("apikey", _KEY)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read()
    except Exception as e:
        print(f"Error downloading from storage ({bucket}/{path}): {e}")
        return None


def upload_file_to_storage(bucket: str, path: str, file_bytes: bytes, content_type: str) -> bool:
    """Upload a file's raw bytes to Supabase Storage."""
    if not is_configured():
        return False
    # Ensure each path segment is quoted correctly
    quoted_path = "/".join(urllib.parse.quote(part, safe='') for part in path.split("/"))
    url = f"{_URL}/storage/v1/object/{bucket}/{quoted_path}"
    req = urllib.request.Request(url=url, method="POST", data=file_bytes)
    req.add_header("Authorization", f"Bearer {_KEY}")
    req.add_header("apikey", _KEY)
    req.add_header("Content-Type", content_type)
    # x-upsert header to overwrite if exists
    req.add_header("x-upsert", "true")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status in (200, 201)
    except urllib.error.HTTPError as e:
        error_msg = e.read().decode("utf-8")
        print(f"Error uploading to storage ({bucket}/{path}): {e.code} {e.reason} - {error_msg}")
        return False
    except Exception as e:
        print(f"Error uploading to storage ({bucket}/{path}): {e}")
        return False


def update_session_pdf_path(session_id: str, pdf_storage_path: str) -> None:
    """Save the path to the generated PDF in the session record."""
    body = json.dumps({"pdf_storage_path": pdf_storage_path}).encode("utf-8")
    _req("PATCH", "tailor_sessions", body=body, params=f"session_id=eq.{urllib.parse.quote(session_id, safe='')}")


def save_session(
    session_id: str,
    user_id: Optional[str],
    original_filename: str,
    jd_text: str,
    resume_structured: dict,
    rewrites: dict,
    response: dict,
    base_resume_id: Optional[str] = None,
) -> None:
    """Upsert full pipeline session to Supabase tailor_sessions table."""
    jd_words = jd_text.strip().split()
    jd_snippet = " ".join(jd_words[:30]) + ("…" if len(jd_words) > 30 else "")
    payload = {
        "session_id": session_id,
        "user_id": user_id,
        "original_filename": original_filename or "",
        "jd_snippet": jd_snippet,
        "resume_structured": resume_structured,
        "rewrites": rewrites,
        "response": response,
    }
    # Only include base_resume_id if provided (column may not exist in older schemas)
    if base_resume_id:
        payload["base_resume_id"] = base_resume_id
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    # Use upsert so re-runs or retries don't fail on duplicate session_id
    _req("POST", "tailor_sessions", body=body, params="on_conflict=session_id")


def load_session(session_id: str) -> Optional[Dict[str, Any]]:
    """Return resume_structured + rewrites for download. None if not found."""
    rows = _req(
        "GET",
        "tailor_sessions",
        params=f"session_id=eq.{urllib.parse.quote(session_id, safe='')}&select=resume_structured,rewrites",
    )
    if not rows or not isinstance(rows, list) or len(rows) == 0:
        return None
    return rows[0]


def update_accepted_bullets(session_id: str, accepted_bullets: dict) -> None:
    """Save the user's final bullet choices to the session record."""
    body = json.dumps({"accepted_bullets": accepted_bullets}).encode("utf-8")
    _req("PATCH", "tailor_sessions", body=body, params=f"session_id=eq.{urllib.parse.quote(session_id, safe='')}")


def get_base_resume(user_id: str) -> Optional[Dict[str, Any]]:
    """Fetch the default base resume for a user."""
    rows = _req(
        "GET",
        "base_resumes",
        params=f"user_id=eq.{urllib.parse.quote(user_id, safe='')}&is_default=eq.true&select=id,filename,storage_path",
    )
    if not rows or not isinstance(rows, list) or len(rows) == 0:
        return None
    return rows[0]


def upsert_base_resume(user_id: str, filename: str, storage_path: str) -> bool:
    """Set a resume as the default base for a user. Unsets previous defaults.
    Steps run sequentially — if step 2 fails, step 1 is retried to restore the old default.
    """
    # 1. Unset any existing default
    unset_resp = _req(
        "PATCH",
        "base_resumes",
        body=json.dumps({"is_default": False}).encode("utf-8"),
        params=f"user_id=eq.{urllib.parse.quote(user_id, safe='')}&is_default=eq.true",
    )
    # 2. Insert new default
    payload = {
        "user_id": user_id,
        "filename": filename,
        "storage_path": storage_path,
        "is_default": True,
    }
    resp = _req(
        "POST",
        "base_resumes",
        body=json.dumps(payload).encode("utf-8"),
    )
    if resp is None and unset_resp is not None:
        # Step 2 failed but step 1 succeeded — try to restore old default
        logger.error("upsert_base_resume: insert failed after unsetting old default for user %s", user_id)
        _req(
            "PATCH",
            "base_resumes",
            body=json.dumps({"is_default": True}).encode("utf-8"),
            params=f"user_id=eq.{urllib.parse.quote(user_id, safe='')}&storage_path=neq.{urllib.parse.quote(storage_path, safe='')}&limit=1",
        )
    return resp is not None
