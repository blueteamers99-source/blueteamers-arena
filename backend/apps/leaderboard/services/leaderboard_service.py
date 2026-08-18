from typing import Dict, Any, List, Optional
from django.db.models import F
from apps.events.models.event import Event
from apps.participants.models.participant import Participant


class LeaderboardService:
    @staticmethod
    def get_event_leaderboard(
        event: Optional[Event] = None,
        event_id: Optional[str] = None,
        event_code: Optional[str] = None,
        search_query: Optional[str] = None,
        student_participant: Optional[Participant] = None,
    ) -> Dict[str, Any]:
        if not event:
            if event_id:
                try:
                    event = Event.objects.get(id=event_id)
                except Event.DoesNotExist:
                    pass
            elif event_code:
                try:
                    event = Event.objects.get(event_code__iexact=event_code.strip())
                except Event.DoesNotExist:
                    pass

        qs = Participant.objects.all().select_related("event")
        if event:
            qs = qs.filter(event=event)

        if search_query:
            q = search_query.strip()
            qs = qs.filter(name__icontains=q) | qs.filter(email__icontains=q)

        # Order by highest score, then earliest finished_at, then earliest updated_at
        qs = qs.order_by("-score", F("finished_at").asc(nulls_last=True), "updated_at")

        ranked_list = []
        for index, p in enumerate(qs, start=1):
            time_display = "--:--"
            if p.started_at and p.finished_at:
                diff = p.finished_at - p.started_at
                mins = int(diff.total_seconds() // 60)
                secs = int(diff.total_seconds() % 60)
                time_display = f"{mins:02d}:{secs:02d}"

            is_curr = bool(student_participant and p.id == student_participant.id)
            if is_curr:
                display_email = p.email
            else:
                parts = p.email.split("@")
                display_email = f"{parts[0][:2]}***@{parts[1]}" if len(parts) == 2 and len(parts[0]) >= 2 else f"***@{parts[-1]}" if len(parts) == 2 else "***"

            ranked_list.append({
                "rank": index,
                "participant_id": str(p.id),
                "name": p.name,
                "email": display_email,
                "college_name": p.event.college_name,
                "event_code": p.event.event_code,
                "score": p.score,
                "completed": p.completed,
                "time_taken": time_display,
                "is_current_user": is_curr,
            })

        top3 = ranked_list[:3]

        # Student position & nearby rankings
        student_position = None
        nearby_rankings = []
        if student_participant:
            for idx, r in enumerate(ranked_list):
                if r["participant_id"] == str(student_participant.id):
                    student_position = r
                    start_idx = max(0, idx - 2)
                    end_idx = min(len(ranked_list), idx + 3)
                    nearby_rankings = ranked_list[start_idx:end_idx]
                    break

        return {
            "event_code": event.event_code if event else "GLOBAL",
            "college_name": event.college_name if event else "All Colleges",
            "total_participants": len(ranked_list),
            "top3_podium": top3,
            "rankings": ranked_list,
            "student_position": student_position,
            "nearby_rankings": nearby_rankings,
        }
