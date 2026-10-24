import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.session import SessionLocal
from app.patterns.club_config_singleton import ClubConfig
from app.services.reminder_service import ReminderService
from app.api import auth, bookings, teams, rooms, admin
from app.core.exceptions import (
    BookingConflictException,
    WindowViolationException,
    OperatingHoursException,
    AuthorizationException,
    AuthenticationException,
    RoomLimitExceededException,
    InvalidStateTransitionException,
    BookingException
)


async def periodic_reminder_scheduler():
    """Background task running continuously to check and dispatch 5h and 1h reminders."""
    while True:
        try:
            db = SessionLocal()
            try:
                ReminderService.check_and_dispatch_reminders(db=db)
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[ReminderScheduler] Warning: {e}")
        try:
            await asyncio.sleep(60)
        except asyncio.CancelledError:
            break


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Load latest club settings into process-level ClubConfig singleton
    db = SessionLocal()
    try:
        ClubConfig.get_instance().reload(db)
        print("[Lifespan] Loaded active ClubConfig settings into memory.")
    except Exception as e:
        print(f"[Lifespan] Warning: Failed to pre-load settings: {e}")
    finally:
        db.close()

    # Start automated reminder background daemon
    reminder_task = asyncio.create_task(periodic_reminder_scheduler())
    print("[Lifespan] Started automated 5h and 1h session reminder scheduler.")

    yield

    # Shutdown
    reminder_task.cancel()
    try:
        await reminder_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Enterprise Studio Booking Portal for DC Studios featuring rolling 72-hour validation and atomic PostgreSQL conflict prevention.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware with credentials allowed for HTTP-only cookies
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")
app.include_router(teams.router, prefix="/api")
app.include_router(rooms.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.get("/health", tags=["Health"])
def health_check():
    """Health check endpoint for Render, container orchestrators, and monitoring."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT
    }


# Centralized Domain Exception Handlers
@app.exception_handler(BookingConflictException)
async def booking_conflict_handler(request: Request, exc: BookingConflictException):
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": exc.message, "error_type": "BOOKING_CONFLICT"}
    )


@app.exception_handler(WindowViolationException)
async def window_violation_handler(request: Request, exc: WindowViolationException):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.message, "error_type": "WINDOW_VIOLATION"}
    )


@app.exception_handler(OperatingHoursException)
async def operating_hours_handler(request: Request, exc: OperatingHoursException):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.message, "error_type": "OPERATING_HOURS_VIOLATION"}
    )


@app.exception_handler(AuthorizationException)
async def authorization_handler(request: Request, exc: AuthorizationException):
    return JSONResponse(
        status_code=status.HTTP_403_FORBIDDEN,
        content={"detail": exc.message, "error_type": "AUTHORIZATION_ERROR"}
    )


@app.exception_handler(AuthenticationException)
async def authentication_handler(request: Request, exc: AuthenticationException):
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"detail": exc.message, "error_type": "AUTHENTICATION_ERROR"}
    )


@app.exception_handler(RoomLimitExceededException)
async def room_limit_handler(request: Request, exc: RoomLimitExceededException):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.message, "error_type": "ROOM_LIMIT_EXCEEDED"}
    )


@app.exception_handler(InvalidStateTransitionException)
async def state_transition_handler(request: Request, exc: InvalidStateTransitionException):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": exc.message, "error_type": "INVALID_STATE_TRANSITION"}
    )


@app.exception_handler(BookingException)
async def general_booking_handler(request: Request, exc: BookingException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message, "error_type": "BOOKING_ERROR"}
    )
