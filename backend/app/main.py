from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import setup_logging, LoggingMiddleware
import uvicorn

setup_logging(settings.LOG_LEVEL)

from contextlib import asynccontextmanager
from app.database.session import engine
from app.models.base import Base
import app.models.memory
import app.models.wellness

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

def generate_unique_id(route):
    return route.name

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
    generate_unique_id_function=generate_unique_id
)
# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Should be restricted in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.routers import (
    dashboard, profiles, goals, workouts, meals,
    sleep, screentime, vitals, mentalwellness,
    bodymeasurements, hydration, medications,
    anthropic, glucose, planner, reminders, intelligence
)
from app.ai.memory_sync import register_listeners

# Register SQLAlchemy event listeners for AI Memory syncing
register_listeners()

# Logging
app.add_middleware(LoggingMiddleware)

# Include Routers
app.include_router(anthropic.router, prefix=settings.API_V1_STR)
app.include_router(profiles.router, prefix=settings.API_V1_STR)
app.include_router(meals.router, prefix=settings.API_V1_STR)
app.include_router(dashboard.router, prefix=settings.API_V1_STR)
app.include_router(dashboard.scores_router, prefix=settings.API_V1_STR)
app.include_router(goals.router, prefix=settings.API_V1_STR)
app.include_router(planner.router, prefix=settings.API_V1_STR)
app.include_router(hydration.router, prefix=settings.API_V1_STR)
app.include_router(bodymeasurements.router, prefix=settings.API_V1_STR)
app.include_router(vitals.router, prefix=settings.API_V1_STR)
app.include_router(mentalwellness.router, prefix=settings.API_V1_STR)
app.include_router(medications.router, prefix=settings.API_V1_STR)
app.include_router(workouts.router, prefix=settings.API_V1_STR)
app.include_router(sleep.router, prefix=settings.API_V1_STR)
app.include_router(screentime.router, prefix=settings.API_V1_STR)
app.include_router(glucose.router, prefix=settings.API_V1_STR)
app.include_router(reminders.router, prefix=settings.API_V1_STR)
app.include_router(intelligence.router, prefix=settings.API_V1_STR)
@app.get("/health")

async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
