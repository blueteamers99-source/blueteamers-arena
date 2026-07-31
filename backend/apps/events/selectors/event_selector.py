import re
from typing import Optional
from django.db import models
from django.db.models import QuerySet
from apps.events.models.event import Event


class EventSelector:
    @staticmethod
    def get_by_id(event_id: str) -> Optional[Event]:
        try:
            return Event.objects.get(id=event_id)
        except (Event.DoesNotExist, ValueError):
            return None

    @staticmethod
    def get_by_code(code: str) -> Optional[Event]:
        if not code:
            return None
        clean_raw = str(code).strip()
        clean_upper = clean_raw.upper()
        clean_no_hyphen = clean_upper.replace("-", "").replace(" ", "")

        # 1. Try exact match case-insensitive
        try:
            return Event.objects.get(event_code__iexact=clean_raw)
        except Event.DoesNotExist:
            pass

        # 2. Try normalized COLLEGE-XXXX match
        normalized = re.sub(r'[\s\-]+', '-', clean_upper)
        if '-' not in normalized:
            match = re.match(r'^([A-Z]+)(\d+)$', normalized)
            if match:
                normalized = f"{match.group(1)}-{match.group(2)}"

        try:
            return Event.objects.get(event_code__iexact=normalized)
        except Event.DoesNotExist:
            pass

        # 3. Fallback: match removing hyphens (e.g., CBIT2026 vs CBIT-2026)
        for ev in Event.objects.all():
            if ev.event_code.upper().replace("-", "").replace(" ", "") == clean_no_hyphen:
                return ev

        return None

    @staticmethod
    def filter_events(status: Optional[str] = None, query: Optional[str] = None) -> QuerySet[Event]:
        qs = Event.objects.all()
        if status and status != "All":
            qs = qs.filter(status=status)
        if query:
            q = query.strip()
            qs = qs.filter(
                models.Q(college_name__icontains=q) |
                models.Q(workshop_name__icontains=q) |
                models.Q(event_code__icontains=q)
            )
        return qs.order_by("-event_date", "-created_at")
