import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes import router, run_scheduled_scan

logger = logging.getLogger("grant_copilot.scheduler")


async def _scheduled_scan_loop(interval_hours: float) -> None:
    """Re-scans every organization's profile against grant windows on a fixed interval."""
    while True:
        await asyncio.sleep(interval_hours * 3600)
        try:
            result = await asyncio.to_thread(run_scheduled_scan)
            logger.info("Scheduled opportunity scan covered %d organizations", result.organizationsScanned)
        except Exception:  # keep the loop alive; the next run retries
            logger.exception("Scheduled opportunity scan failed")


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = None
    if settings.SCHEDULED_SCAN_INTERVAL_HOURS > 0:
        task = asyncio.create_task(_scheduled_scan_loop(settings.SCHEDULED_SCAN_INTERVAL_HOURS))
    try:
        yield
    finally:
        if task:
            task.cancel()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    lifespan=lifespan,
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Hackathon-friendly: allows localhost:3000 and any preview deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "message": "Autonomous SME Grant Copilot & Claim Engine API",
        "docs": f"{settings.API_V1_STR}/docs",
        "health": f"{settings.API_V1_STR}/health"
    }
