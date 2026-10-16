import threading
from typing import Optional
from sqlalchemy.orm import Session
from app.core.config import settings as app_settings
from app.models.club_settings import ClubSettings


class ClubConfig:
    """
    Singleton Pattern: ClubConfig
    
    Provides process-level access to active club operational configurations.
    Maintains default constants and caches database-backed administrative settings.
    
    Architectural Note on Multi-Worker Environments:
    This Singleton is process-local. In a multi-worker ASGI setup (e.g., Uvicorn with multiple workers),
    each worker holds its own singleton instance. When an Administrator modifies settings via the API,
    the update is committed to PostgreSQL and `ClubConfig.get_instance().reload(db)` is invoked locally.
    In distributed multi-worker deployments, a cache-invalidation signal (e.g. via Postgres LISTEN/NOTIFY
    or Redis pub/sub) or time-to-live expiration is used. Here, `reload()` provides instant cache refresh.
    """
    _instance: Optional['ClubConfig'] = None
    _lock: threading.Lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(ClubConfig, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return
        self.timezone: str = app_settings.TIMEZONE
        self.opening_time: str = app_settings.DEFAULT_OPENING_TIME
        self.closing_time: str = app_settings.DEFAULT_CLOSING_TIME
        self.slot_interval_minutes: int = app_settings.DEFAULT_SLOT_INTERVAL_MINUTES
        self.maximum_duration_minutes: int = app_settings.DEFAULT_MAX_DURATION_MINUTES
        self.advance_booking_hours: int = app_settings.ADVANCE_BOOKING_HOURS
        self.cancellation_cutoff_minutes: int = app_settings.DEFAULT_CANCELLATION_CUTOFF_MINUTES
        self.daily_team_quota_minutes: int = 0
        self._initialized = True

    @classmethod
    def get_instance(cls) -> 'ClubConfig':
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def reload(self, db: Session) -> 'ClubConfig':
        """
        Reloads configuration from PostgreSQL persistence layer.
        Safely refreshes in-memory cache when administrator updates club settings.
        """
        db_settings = db.query(ClubSettings).first()
        if db_settings:
            with self._lock:
                self.timezone = db_settings.timezone
                self.opening_time = db_settings.opening_time
                self.closing_time = db_settings.closing_time
                self.slot_interval_minutes = db_settings.slot_interval_minutes
                self.maximum_duration_minutes = db_settings.maximum_duration_minutes
                self.advance_booking_hours = db_settings.advance_booking_hours
                self.cancellation_cutoff_minutes = db_settings.cancellation_cutoff_minutes
                self.daily_team_quota_minutes = db_settings.daily_team_quota_minutes
        return self
