from datetime import datetime, timedelta
from django.utils import timezone
from typing import Dict, Any


class TimerService:
    """
    Backend-controlled Timer Engine. Computes elapsed time, remaining seconds, and expired status
    strictly from database records to prevent browser refresh resets.
    """
    @staticmethod
    def _format_clock(total_seconds: int) -> str:
        """Format as H:MM:SS when the window is an hour or more, else MM:SS."""
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        if hours > 0:
            return f"{hours}:{minutes:02d}:{seconds:02d}"
        return f"{minutes:02d}:{seconds:02d}"

    @staticmethod
    def calculate_time(started_at: datetime, duration_minutes: int) -> Dict[str, Any]:
        if not started_at:
            return {
                "started_at": None,
                "duration_minutes": duration_minutes,
                "remaining_seconds": duration_minutes * 60,
                "is_expired": False,
                "formatted_remaining": TimerService._format_clock(duration_minutes * 60),
            }

        now = timezone.now()
        end_time = started_at + timedelta(minutes=duration_minutes)
        remaining_td = end_time - now
        remaining_seconds = max(0, int(remaining_td.total_seconds()))
        is_expired = remaining_seconds == 0

        formatted_remaining = TimerService._format_clock(remaining_seconds)

        return {
            "started_at": started_at.isoformat(),
            "end_time": end_time.isoformat(),
            "duration_minutes": duration_minutes,
            "remaining_seconds": remaining_seconds,
            "is_expired": is_expired,
            "formatted_remaining": formatted_remaining,
        }
