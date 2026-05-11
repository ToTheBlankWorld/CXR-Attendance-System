from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "Face Recognition Attendance System"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/v1"
    
    # JWT Settings
    SECRET_KEY: str = "your-super-secret-key-change-in-production-2024"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./attendance.db"
    
    # Paths
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    DATASET_PATH: str = os.path.join(os.path.dirname(BASE_DIR), "dataset")
    EMBEDDINGS_PATH: str = os.path.join(BASE_DIR, "embeddings")
    CSV_PATH: str = os.path.dirname(BASE_DIR)
    
    # Face Recognition Settings
    SIMILARITY_THRESHOLD: float = 0.5
    RECOGNITION_COOLDOWN: int = 10  # seconds
    
    # Admin credentials
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin123"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
