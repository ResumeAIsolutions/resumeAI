"""
Admin-only routes. Requires is_admin: true in Supabase user_metadata.
JWT verified via Supabase Auth API using service role key.
"""
import json
import os
import urllib.error
import urllib.request
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from utils import auth as auth_utils

router = APIRouter(prefix="/admin", tags=["admin"])


def _config() -> tuple[str, str]:
    url = (os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL", "")).rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    return url, key


def _get(path: str, params: str = "") -> Any:
    url_base, service_key = _config()
    if not url_base:
        raise RuntimeError("SUPABASE_URL is not configured")
    if not service_key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is not configured")
    url = f"{url_base}{path}"
    if params:
        url = f"{url}?{params}"
    req = urllib.request.Request(url, method="GET")
    req.add_header("Authorization", f"Bearer {service_key}")
    req.add_header("apikey", service_key)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def _verify_admin(authorization: Optional[str] = Header(None)) -> str:
    return auth_utils.verify_admin_token(authorization).user_id


@router.get("/me")
def admin_me(admin_id: str = Depends(_verify_admin)):
    """Frontend calls this on load to confirm admin status."""
    return {"is_admin": True, "admin_id": admin_id}


@router.get("/users")
def get_users(admin_id: str = Depends(_verify_admin)) -> List[Dict]:
    """All Supabase Auth users enriched with tier + monthly usage."""
    try:
        auth_data = _get("/auth/v1/admin/users", "per_page=1000&page=1")
        users: List[Dict] = auth_data.get("users", [])
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=503, detail=f"Could not fetch users: {e}")

    try:
        subs = _get("/rest/v1/user_subscriptions", "select=user_id,tier,status,period_end") or []
        sub_map: Dict[str, Dict] = {s["user_id"]: s for s in subs}
    except Exception:
        sub_map = {}

    try:
        current_month = datetime.utcnow().strftime("%Y-%m")
        usages = _get("/rest/v1/tailor_usage", f"select=user_id,count&month=eq.{current_month}") or []
        usage_map: Dict[str, int] = {u["user_id"]: u["count"] for u in usages}
    except Exception:
        usage_map = {}

    result = []
    for u in users:
        uid = u["id"]
        sub = sub_map.get(uid, {})
        is_pro = sub.get("tier") == "pro" and sub.get("status") in ("active", "trialing")
        result.append({
            "id": uid,
            "email": u.get("email", ""),
            "created_at": u.get("created_at", ""),
            "last_sign_in_at": u.get("last_sign_in_at"),
            "is_admin": bool((u.get("user_metadata") or {}).get("is_admin")),
            "tier": "pro" if is_pro else "free",
            "sub_status": sub.get("status", ""),
            "usage_this_month": usage_map.get(uid, 0),
        })

    result.sort(key=lambda x: x["created_at"], reverse=True)
    return result


@router.get("/history")
def get_history(admin_id: str = Depends(_verify_admin)) -> List[Dict]:
    """All tailor sessions across all users, newest first."""
    try:
        rows = _get(
            "/rest/v1/tailor_history",
            "select=id,user_id,session_id,original_filename,job_role,company,"
            "match_percent,ats_score,strength_score,changed_bullets,total_bullets,created_at"
            "&order=created_at.desc&limit=500",
        ) or []
        return rows
    except Exception:
        raise HTTPException(status_code=503, detail="Could not fetch history")


class SetTierRequest(BaseModel):
    tier: str


@router.patch("/subscription/{user_id}")
def set_tier(user_id: str, body: SetTierRequest, admin_id: str = Depends(_verify_admin)):
    """Manually promote or demote a user's tier."""
    if body.tier not in ("free", "pro"):
        raise HTTPException(status_code=400, detail="tier must be 'free' or 'pro'")
    url_base, service_key = _config()
    if not url_base:
        raise HTTPException(status_code=503, detail="SUPABASE_URL is not configured")
    if not service_key:
        raise HTTPException(status_code=503, detail="SUPABASE_SERVICE_ROLE_KEY is not configured")
    payload = {
        "user_id": user_id,
        "tier": body.tier,
        "status": "active" if body.tier == "pro" else "canceled",
        "updated_at": datetime.utcnow().isoformat(),
    }
    data = json.dumps(payload).encode()
    url = f"{url_base}/rest/v1/user_subscriptions"
    req = urllib.request.Request(url, method="POST", data=data)
    req.add_header("Authorization", f"Bearer {service_key}")
    req.add_header("apikey", service_key)
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=minimal,resolution=merge-duplicates")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp.read()
        return {"ok": True}
    except Exception:
        raise HTTPException(status_code=503, detail="Could not update subscription")


# ─── Grant / Revoke Admin ───────────────────────────────────────────────────────

DEFAULT_ADMIN_EMAIL = "edlahareen@gmail.com"


class EmailRequest(BaseModel):
    email: str


def _set_user_admin_metadata(email: str, is_admin: bool) -> bool:
    """Find user by email in Supabase Auth and set is_admin in user_metadata."""
    try:
        url_base, service_key = _config()
        if not url_base or not service_key:
            return False
        auth_data = _get("/auth/v1/admin/users", "per_page=1000&page=1")
        users = auth_data.get("users", [])
        target = next((u for u in users if u.get("email") == email), None)
        if not target:
            return False

        user_id = target["id"]
        # PATCH user metadata via Admin API
        payload = json.dumps({"user_metadata": {"is_admin": is_admin}}).encode()
        url = f"{url_base}/auth/v1/admin/users/{user_id}"
        req = urllib.request.Request(url, method="PUT", data=payload)
        req.add_header("Authorization", f"Bearer {service_key}")
        req.add_header("apikey", service_key)
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp.read()
        return True
    except Exception as e:
        print(f"Error setting admin metadata for {email}: {e}")
        return False


@router.post("/grant-admin")
def grant_admin(body: EmailRequest, admin_id: str = Depends(_verify_admin)):
    """Grant admin access to a user by email."""
    success = _set_user_admin_metadata(body.email, True)
    if not success:
        raise HTTPException(status_code=404, detail=f"User {body.email!r} not found. They must have an existing account.")
    return {"ok": True, "message": f"Admin granted to {body.email}"}


@router.post("/revoke-admin")
def revoke_admin(body: EmailRequest, admin_id: str = Depends(_verify_admin)):
    """Revoke admin access from a user by email."""
    if body.email == DEFAULT_ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Cannot revoke the default admin.")
    success = _set_user_admin_metadata(body.email, False)
    if not success:
        raise HTTPException(status_code=404, detail=f"User {body.email!r} not found.")
    return {"ok": True, "message": f"Admin revoked for {body.email}"}
