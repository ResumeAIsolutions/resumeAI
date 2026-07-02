import logging
import os
import traceback
import uuid
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from limiter import limiter
from api.routes.health import router as health_router
from api.routes.download import router as download_router
from api.routes.stream import router as stream_router
from api.routes.cover_letter import router as cover_letter_router
from api.routes.razorpay_routes import router as razorpay_router
from api.routes.admin import router as admin_router
from api.routes.resumes import router as resumes_router
from api.routes.feedback import router as feedback_router

app = FastAPI(title="ResumeAI API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def download_tectonic_on_startup():
    """Pre-download tectonic at startup so first PDF request isn't slow."""
    import asyncio
    from generators.latex_generator import _get_tectonic
    try:
        await asyncio.to_thread(_get_tectonic)
        logger.info("tectonic ready")
    except Exception as e:
        logger.warning("tectonic unavailable at startup (will use reportlab fallback): %s", e)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    error_id = uuid.uuid4().hex[:12]
    tb = traceback.format_exc()
    logger.error("Unhandled exception %s on %s %s:\n%s", error_id, request.method, request.url.path, tb)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error. Please try again.",
            "error_id": error_id,
        },
    )

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(download_router, prefix="/api")
app.include_router(stream_router, prefix="/api")
app.include_router(cover_letter_router, prefix="/api")
app.include_router(razorpay_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(resumes_router, prefix="/api")
app.include_router(feedback_router, prefix="/api")
