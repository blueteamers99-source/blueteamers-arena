import random
import re
from typing import Dict, Any, Tuple, Optional
from django.utils import timezone
from rest_framework.exceptions import ValidationError, NotFound
from apps.events.models.event import Event
from apps.events.selectors.event_selector import EventSelector


def normalize_event_code(raw_code: str) -> str:
    """
    Normalizes raw user input into standard Event Code format: COLLEGE-XXXX
    Examples:
    - 'cbit-3154' -> 'CBIT-3154'
    - 'CBIT3154' -> 'CBIT-3154'
    - 'CBIT 3154' -> 'CBIT-3154'
    - ' cbit - 3154 ' -> 'CBIT-3154'
    """
    if not raw_code:
        return ""
    code = str(raw_code).strip().upper()
    code = re.sub(r'[\s\-]+', '-', code)
    if '-' not in code:
        match = re.match(r'^([A-Z]+)(\d+)$', code)
        if match:
            code = f"{match.group(1)}-{match.group(2)}"
    return code


class EventService:
    @staticmethod
    def generate_event_code(college_name: str) -> str:
        """
        Generates a unique event code in the format: COLLEGE-XXXX
        Example: CBIT-3154
        """
        clean_college = re.sub(r'[^A-Z0-9]', '', college_name.upper())
        prefix = clean_college[:6] if clean_college else "ARENA"
        
        # Unique code generation loop
        max_attempts = 100
        for _ in range(max_attempts):
            digits = f"{random.randint(1000, 9999)}"
            code = f"{prefix}-{digits}"
            if not Event.objects.filter(event_code__iexact=code).exists():
                return code

        # Fallback if collision limit reached
        return f"{prefix}-{random.randint(10000, 99999)}"

    @staticmethod
    def create_event(data: Dict[str, Any], user=None) -> Event:
        college = data.get("college_name", "").strip() or "ARENA"
        code = normalize_event_code(data.get("event_code", ""))
        
        if not code or Event.objects.filter(event_code__iexact=code).exists():
            code = EventService.generate_event_code(college)

        event = Event.objects.create(
            college_name=college,
            workshop_name=data.get("workshop_name", "").strip() or "CTF Workshop",
            description=data.get("description", "").strip(),
            event_code=code,
            event_date=data.get("event_date") or timezone.now().date(),
            duration_minutes=data.get("duration_minutes", 60),
            passing_score=data.get("passing_score", 600),
            total_challenges=data.get("total_challenges", 5),
            accent_color=data.get("accent_color", "blue"),
            status=data.get("status", Event.StatusChoices.UPCOMING),
            banner_image=data.get("banner_image", ""),
            banner_image_url=data.get("banner_image_url", ""),
            registration_open_at=data.get("registration_open_at"),
            registration_close_at=data.get("registration_close_at"),
            created_by=user,
        )
        return event

    @staticmethod
    def regenerate_event_code(event_id: str) -> str:
        """
        Regenerates a new unique event code for an existing event.
        """
        event = EventSelector.get_by_id(event_id)
        if not event:
            raise NotFound("Event not found.")
        
        new_code = EventService.generate_event_code(event.college_name)
        event.event_code = new_code
        event.save(update_fields=["event_code", "updated_at"])
        return new_code

    @staticmethod
    def validate_code(raw_code: str) -> Tuple[bool, str, Optional[Event]]:
        """
        Validates an event code for student entry with security checks.
        Rejects inactive, expired, or non-existent events.
        """
        code = normalize_event_code(raw_code)
        if not code:
            return False, "Invalid Event Code", None

        event = EventSelector.get_by_code(code)
        if not event:
            return False, "Invalid Event Code", None

        # Security Check 1: Inactive / Completed Status
        if event.status == Event.StatusChoices.COMPLETED:
            return False, "This event has already concluded.", None

        # Security Check 2: Registration Closing Date Expiry
        if event.registration_close_at and timezone.now() > event.registration_close_at:
            return False, "Event registration has expired.", None

        return True, "Event code verified successfully.", event
