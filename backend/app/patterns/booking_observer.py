from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import List, Dict, Any, Optional
import json
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog
from app.models.outbox_event import OutboxEvent
from app.models.booking import Booking


@dataclass
class BookingEvent:
    event_type: str  # "BOOKING_CREATED", "BOOKING_CANCELLED", "BOOKING_COMPLETED"
    booking_id: int
    actor_id: Optional[int]
    team_id: int
    room_id: int
    timestamp: datetime
    details: Dict[str, Any]


class BookingObserver(ABC):
    """Observer interface for reacting to booking lifecycle events."""
    @abstractmethod
    def update(self, event: BookingEvent, db: Session) -> None:
        pass


class AuditEventSubscriber(BookingObserver):
    """
    Observer subscriber that transactionally persists audit records
    and transactional outbox events within the same database transaction.
    """
    def update(self, event: BookingEvent, db: Session) -> None:
        # 1. Insert into AuditLog table
        audit = AuditLog(
            actor_id=event.actor_id,
            action=event.event_type,
            entity_type="BOOKING",
            entity_id=event.booking_id,
            timestamp=event.timestamp,
            details=json.dumps(event.details, default=str)
        )
        db.add(audit)

        # 2. Insert into OutboxEvent table for reliable async delivery
        outbox = OutboxEvent(
            event_type=event.event_type,
            payload=json.dumps({
                "booking_id": event.booking_id,
                "actor_id": event.actor_id,
                "team_id": event.team_id,
                "room_id": event.room_id,
                "timestamp": event.timestamp.isoformat(),
                "details": event.details
            }, default=str),
            created_at=event.timestamp
        )
        db.add(outbox)


class AvailabilitySubscriber(BookingObserver):
    """
    Observer subscriber that tracks availability changes
    (e.g. logging cache invalidation or dispatching real-time broadcast).
    """
    def __init__(self):
        self.last_invalidated_room: Optional[int] = None
        self.last_event_type: Optional[str] = None

    def update(self, event: BookingEvent, db: Session) -> None:
        self.last_invalidated_room = event.room_id
        self.last_event_type = event.event_type
        # In a distributed setup, this broadcasts a Redis pub/sub or WebSocket refresh
        # print(f"[AvailabilitySubscriber] Cache invalidated for Room {event.room_id} due to {event.event_type}")


class BookingEventPublisher:
    """
    Observer Pattern: BookingEventPublisher
    
    Maintains subscriber list and dispatches booking lifecycle events.
    """
    def __init__(self):
        self._observers: List[BookingObserver] = []

    def attach(self, observer: BookingObserver) -> None:
        if observer not in self._observers:
            self._observers.append(observer)

    def detach(self, observer: BookingObserver) -> None:
        if observer in self._observers:
            self._observers.remove(observer)

    def notify(self, event: BookingEvent, db: Session) -> None:
        for observer in self._observers:
            observer.update(event, db)


# Global publisher configured with transactional audit subscriber
booking_publisher = BookingEventPublisher()
audit_subscriber = AuditEventSubscriber()
availability_subscriber = AvailabilitySubscriber()
booking_publisher.attach(audit_subscriber)
booking_publisher.attach(availability_subscriber)
