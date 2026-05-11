from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging
import os

from app.core.config import settings
from app.core.database import init_db
from app.api import auth, dashboard, classes, attendance, enrollment, recognition, websocket

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Ensure unknown_faces directory exists
UNKNOWN_FACES_DIR = os.path.join(os.path.dirname(__file__), "unknown_faces")
os.makedirs(UNKNOWN_FACES_DIR, exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up Face Recognition Attendance System...")
    await init_db()
    logger.info("Database initialized")
    yield
    # Shutdown
    logger.info("Shutting down...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for unknown faces
app.mount("/unknown-faces", StaticFiles(directory=UNKNOWN_FACES_DIR), name="unknown_faces")

# Include routers
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(dashboard.router, prefix=settings.API_PREFIX)
app.include_router(classes.router, prefix=settings.API_PREFIX)
app.include_router(attendance.router, prefix=settings.API_PREFIX)
app.include_router(enrollment.router, prefix=settings.API_PREFIX)
app.include_router(recognition.router, prefix=settings.API_PREFIX)
app.include_router(websocket.router)

@app.get("/")
async def root():
    return {
        "message": "Face Recognition Attendance System API",
        "version": settings.VERSION,
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
