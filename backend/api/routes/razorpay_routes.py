"""
Razorpay Orders integration (one-time Pro payment):
  POST /api/razorpay/order               — create order → return key + order_id + amount
  POST /api/razorpay/verify              — verify payment signature → activate Pro
  POST /api/razorpay/cancel              — downgrade to free (DB-only, no Razorpay API call)
  POST /api/razorpay/webhook             — payment.captured lifecycle event
  GET  /api/razorpay/subscription/{id}   — return tier + usage
"""
import hashlib
import hmac
import json
import os
import urllib.error
import urllib.request
import uuid
from typing import Optional

import asyncio

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

import utils.subscription_store as sub_store
import utils.auth as auth_utils

router = APIRouter()

_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")

# Amount in smallest currency unit — override via env if needed
_AMOUNT_INR = int(os.getenv("RAZORPAY_AMOUNT_INR", "74900"))   # ₹749 in paise
_AMOUNT_USD = int(os.getenv("RAZORPAY_AMOUNT_USD", "900"))     # $9 in cents

_BASE = "https://api.razorpay.com/v1"


def _auth() -> str:
    import base64
    return "Basic " + base64.b64encode(f"{_KEY_ID}:{_KEY_SECRET}".encode()).decode()


def _post(path: str, payload: dict) -> dict:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(f"{_BASE}{path}", method="POST", data=data)
    req.add_header("Authorization", _auth())
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err = json.loads(e.read().decode())
        raise HTTPException(status_code=502, detail=err.get("error", {}).get("description", "Razorpay error"))
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


# ── Create Order ──────────────────────────────────────────────────────────────

class OrderRequest(BaseModel):
    currency: str = "INR"  # "INR" or "USD"


@router.post("/razorpay/order")
async def create_order(req: OrderRequest, authorization: Optional[str] = Header(None)):
    """Create a one-time Razorpay order for Pro lifetime access. Requires valid JWT."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required.")
    user_id = await asyncio.to_thread(auth_utils.verify_token, authorization)
    if not _KEY_ID or not _KEY_SECRET:
        raise HTTPException(status_code=500, detail="Razorpay is not configured.")

    currency = req.currency.upper()
    if currency not in ("INR", "USD"):
        currency = "INR"
    amount = _AMOUNT_USD if currency == "USD" else _AMOUNT_INR

    order = _post("/orders", {
        "amount": amount,
        "currency": currency,
        "receipt": f"order_{uuid.uuid4().hex[:12]}",
        "notes": {"user_id": user_id},
    })
    return {
        "order_id": order["id"],
        "key_id": _KEY_ID,
        "amount": amount,
        "currency": currency,
    }


# ── Verify Payment ────────────────────────────────────────────────────────────

class VerifyRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str


@router.post("/razorpay/verify")
async def verify_payment(req: VerifyRequest, authorization: Optional[str] = Header(None)):
    """Verify Razorpay order payment signature and activate Pro (lifetime)."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required.")
    user_id = await asyncio.to_thread(auth_utils.verify_token, authorization)

    # Orders signature: HMAC(key_secret, order_id + "|" + payment_id)
    msg = f"{req.razorpay_order_id}|{req.razorpay_payment_id}".encode()
    expected = hmac.new(_KEY_SECRET.encode(), msg, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, req.razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid payment signature.")

    sub_store.upsert_subscription(
        user_id=user_id,
        tier="pro",
        stripe_customer_id=None,
        stripe_subscription_id=req.razorpay_order_id,  # store order_id as payment reference
        status="active",
        period_end=None,  # lifetime — no expiry
    )
    return {"ok": True}


# ── Cancel (downgrade) ────────────────────────────────────────────────────────

@router.post("/razorpay/cancel")
async def cancel_subscription(authorization: Optional[str] = Header(None)):
    """Downgrade user to free tier. One-time purchase — no Razorpay API cancellation needed."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required.")
    user_id = await asyncio.to_thread(auth_utils.verify_token, authorization)

    sub_store.upsert_subscription(
        user_id=user_id,
        tier="free",
        stripe_customer_id=None,
        stripe_subscription_id=None,
        status="canceled",
    )
    return {"ok": True}


# ── Webhook ───────────────────────────────────────────────────────────────────

@router.post("/razorpay/webhook")
async def webhook(request: Request):
    """Handle Razorpay payment.captured event for order-based payments."""
    raw = await request.body()

    if _WEBHOOK_SECRET:
        sig = request.headers.get("X-Razorpay-Signature", "")
        expected = hmac.new(_WEBHOOK_SECRET.encode(), raw, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig):
            raise HTTPException(status_code=400, detail="Invalid webhook signature.")

    event = json.loads(raw.decode())
    event_type = event.get("event", "")
    payload = event.get("payload", {})

    if event_type == "payment.captured":
        payment = payload.get("payment", {}).get("entity", {})
        user_id = payment.get("notes", {}).get("user_id", "")
        order_id = payment.get("order_id", "")
        if user_id:
            sub_store.upsert_subscription(
                user_id=user_id,
                tier="pro",
                stripe_customer_id=None,
                stripe_subscription_id=order_id,
                status="active",
                period_end=None,
            )

    return {"ok": True}


# ── Get subscription info ─────────────────────────────────────────────────────

@router.get("/razorpay/subscription/{user_id}")
async def get_subscription(user_id: str, authorization: Optional[str] = Header(None)):
    """Return tier + usage for the authenticated user. Admins always get pro."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header required.")
    verified = await asyncio.to_thread(auth_utils.verify_token_full, authorization)
    if verified.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied.")
    return sub_store.get_subscription_info(user_id, is_admin=verified.is_admin)
