import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "DC Studios Booking"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./vit_dance_booking.db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "vit_dance_super_secret_jwt_key_2026_production_grade")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.0.202:5173",
    ]
    
    # Campus default configurations
    TIMEZONE: str = "Asia/Kolkata"
    ADVANCE_BOOKING_HOURS: int = 72
    DEFAULT_OPENING_TIME: str = "09:00"
    DEFAULT_CLOSING_TIME: str = "19:00"
    DEFAULT_SLOT_INTERVAL_MINUTES: int = 30
    DEFAULT_MAX_DURATION_MINUTES: int = 240
    DEFAULT_CANCELLATION_CUTOFF_MINUTES: int = 0
    
    # Session / Cookie settings
    COOKIE_NAME: str = "vit_dance_session"
    COOKIE_SECURE: bool = False  # Set to True in HTTPS production
    COOKIE_SAMESITE: str = "lax"
    
    ENVIRONMENT: str = "development"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
