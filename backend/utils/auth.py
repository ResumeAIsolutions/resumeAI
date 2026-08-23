from __future__ import annotations
"""
Shared JWT verification via Supabase Auth API.
Used by routes that need to authenticate callers without requiring admin access.
"""
import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Optional

from fastapi import Header, HTTPException

_URL = (os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL", "")).rstrip("/")
_ANON_KEY = os.getenv("VITE_SUPABASE_ANON_KEY", "") or os.getenv("SUPABASE_ANON_KEY", "")
_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


@dataclass
class VerifiedUser:
    user_id: str
    email: str
    is_admin: bool


def _has_admin_access(user: dict) -> bool:
    metadata = user.get("user_metadata") or {}
    return bool(metadata.get("is_admin"))


def verify_token(authorization: Optional[str]) -> str:
    """
    Validate a Supabase Bearer JWT.
    Returns the verified user_id (UUID string).
    Raises HTTPException 401 on invalid/expired token.
    Raises HTTPException 503 if Supabase is not configured or unreachable.
    """
    return verify_token_full(authorization).user_id


def verify_token_full(authorization: Optional[str]) -> VerifiedUser:
    """
    Validate a Supabase Bearer JWT.
    Returns VerifiedUser with user_id and is_admin.
    Raises HTTPException 401 on invalid/expired token.
    Raises HTTPException 503 if Supabase is not configured or unreachable.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header.")
    token = authorization[7:]

    if not _URL:
        raise HTTPException(status_code=503, detail="Auth service not configured.")

    req = urllib.request.Request(f"{_URL}/auth/v1/user", method="GET")
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("apikey", _ANON_KEY or _SERVICE_KEY)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            user = json.loads(resp.read().decode())
    except urllib.error.HTTPError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    except Exception:
        raise HTTPException(status_code=503, detail="Auth service unavailable.")

    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: no user ID.")

    email = user.get("email") or ""
    is_admin = _has_admin_access(user)

    return VerifiedUser(user_id=user_id, email=email, is_admin=is_admin)


def verify_admin_token(authorization: Optional[str]) -> VerifiedUser:
    verified = verify_token_full(authorization)
    if not verified.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required.")
    return verified
