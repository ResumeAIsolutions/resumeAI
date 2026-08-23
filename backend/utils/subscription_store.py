from __future__ import annotations
"""
Supabase subscription + usage tracking.
Tables required:
  user_subscriptions(user_id, tier, status, stripe_customer_id, stripe_subscription_id, period_end, updated_at)
  tailor_usage(user_id, month, count)  -- unique on (user_id, month)
"""
import json
import os
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Optional

_URL = (os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL", "")).rstrip("/")
_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

FREE_MONTHLY_LIMIT = 3


def _req(method: str, table: str, body: Optional[bytes] = None, params: str = "", prefer: str = "") -> Optional[object]:
    """
    Make a Supabase REST request.
    Returns None only when Supabase is not configured (missing env vars).
    Raises RuntimeError on network/HTTP errors so callers can distinguish
    'no record' from 'Supabase is down'.
    """
    if not (_URL and _KEY):
        return None
    url = f"{_URL}/rest/v1/{table}"
    if params:
        url = f"{url}?{params}"
    req = urllib.request.Request(url=url, method=method, data=body)
    req.add_header("Authorization", f"Bearer {_KEY}")
    req.add_header("apikey", _KEY)
    req.add_header("Content-Type", "application/json")
    if prefer:
        req.add_header("Prefer", prefer)
    elif body and method in ("POST", "PATCH"):
        req.add_header("Prefer", "return=minimal")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw.strip() else None
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase {method} {table} failed: HTTP {e.code} — {body_text}") from e
    except Exception as e:
        raise RuntimeError(f"Supabase {method} {table} unreachable: {e}") from e


def _rpc(func: str, params: dict) -> Optional[object]:
    """Call a Supabase RPC (stored procedure) via POST /rest/v1/rpc/<func>."""
    if not (_URL and _KEY):
        return None
    url = f"{_URL}/rest/v1/rpc/{func}"
    body = json.dumps(params).encode()
    req = urllib.request.Request(url=url, method="POST", data=body)
    req.add_header("Authorization", f"Bearer {_KEY}")
    req.add_header("apikey", _KEY)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw.strip() else None
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase RPC {func} failed: HTTP {e.code} — {body_text}") from e
    except Exception as e:
        raise RuntimeError(f"Supabase RPC {func} unreachable: {e}") from e


def get_tier(user_id: str, is_admin: bool = False) -> str:
    """Returns 'pro' or 'free'. Admins always get 'pro'. 'halted' treated as pro (Razorpay grace)."""
    if is_admin:
        return "pro"
    rows = _req("GET", "user_subscriptions", params=f"user_id=eq.{urllib.parse.quote(user_id, safe='')}&select=tier,status")
    if rows and isinstance(rows, list) and len(rows) > 0:
        sub = rows[0]
        if sub.get("tier") == "pro" and sub.get("status") in ("active", "trialing", "halted"):
            return "pro"
    return "free"


def get_razorpay_subscription_id(user_id: str) -> Optional[str]:
    """Return the stored Razorpay subscription_id for the user if subscription is active/halted."""
    rows = _req("GET", "user_subscriptions", params=f"user_id=eq.{urllib.parse.quote(user_id, safe='')}&select=stripe_subscription_id,status")
    if rows and isinstance(rows, list) and len(rows) > 0:
        sub = rows[0]
        if sub.get("status") in ("active", "trialing", "halted"):
            return sub.get("stripe_subscription_id")
    return None


def get_user_id_by_subscription_reference(subscription_reference: str) -> Optional[str]:
    """Return the user that already owns a stored payment/order reference, if any."""
    rows = _req(
        "GET",
        "user_subscriptions",
        params=(
            f"stripe_subscription_id=eq.{urllib.parse.quote(subscription_reference, safe='')}"
            "&select=user_id&limit=1"
        ),
    )
    if rows and isinstance(rows, list) and len(rows) > 0:
        return rows[0].get("user_id")
    return None


def get_monthly_usage(user_id: str) -> int:
    month = datetime.utcnow().strftime("%Y-%m")
    rows = _req("GET", "tailor_usage", params=f"user_id=eq.{urllib.parse.quote(user_id, safe='')}&month=eq.{month}&select=count")
    if rows and isinstance(rows, list) and len(rows) > 0:
        return rows[0].get("count", 0)
    return 0


def increment_usage(user_id: str) -> None:
    """
    Atomically increment tailor usage via Supabase RPC.
    Requires the following SQL function in Supabase:

        create or replace function increment_tailor_usage(p_user_id uuid, p_month text)
        returns void as $$
          insert into tailor_usage (user_id, month, count) values (p_user_id, p_month, 1)
          on conflict (user_id, month) do update set count = tailor_usage.count + 1;
        $$ language sql;

    Non-fatal: if the RPC doesn't exist yet, logs a warning and continues.
    """
    import logging
    month = datetime.utcnow().strftime("%Y-%m")
    try:
        _rpc("increment_tailor_usage", {"p_user_id": user_id, "p_month": month})
    except RuntimeError as e:
        logging.warning(f"increment_usage non-fatal: {e}")


def upsert_subscription(
    user_id: str,
    tier: str,
    stripe_customer_id: Optional[str],
    stripe_subscription_id: Optional[str],
    status: str,
    period_end: Optional[str] = None,
) -> None:
    payload = {
        "user_id": user_id,
        "tier": tier,
        "status": status,
        "stripe_customer_id": stripe_customer_id,
        "stripe_subscription_id": stripe_subscription_id,
        "period_end": period_end,
        "updated_at": datetime.utcnow().isoformat(),
    }
    body = json.dumps(payload).encode()
    _req("POST", "user_subscriptions", body=body, prefer="return=minimal,resolution=merge-duplicates")


def deactivate_by_subscription_id(stripe_subscription_id: str) -> None:
    body = json.dumps({"tier": "free", "status": "canceled"}).encode()
    _req("PATCH", "user_subscriptions", body=body, params=f"stripe_subscription_id=eq.{urllib.parse.quote(stripe_subscription_id, safe='')}")


def get_subscription_info(user_id: str, is_admin: bool = False) -> dict:
    """Return tier + usage for the frontend. Admins always get pro."""
    if is_admin:
        return {"tier": "pro", "status": "admin", "period_end": None, "subscription_id": None}
    rows = _req("GET", "user_subscriptions", params=f"user_id=eq.{urllib.parse.quote(user_id, safe='')}&select=tier,status,period_end,stripe_subscription_id")
    if rows and isinstance(rows, list) and len(rows) > 0:
        sub = rows[0]
        if sub.get("tier") == "pro" and sub.get("status") in ("active", "trialing", "halted"):
            return {
                "tier": "pro",
                "status": sub.get("status"),
                "period_end": sub.get("period_end"),
                "subscription_id": sub.get("stripe_subscription_id"),
            }
    usage = get_monthly_usage(user_id)
    return {"tier": "free", "usage": usage, "limit": FREE_MONTHLY_LIMIT}
