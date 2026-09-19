from typing import Dict, Any, List, Optional
from datetime import timedelta
from django.db.models import F
from django.shortcuts import get_object_or_404
from django.utils import timezone
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
                event = get_object_or_404(Event, id=event_id)
            elif event_code:
                event = get_object_or_404(Event, event_code__iexact=event_code.strip())

        if not event:
            return {
                "event_code": "GLOBAL",
                "college_name": "All Colleges",
                "event_status": Event.StatusChoices.COMPLETED,
                "is_final": False,
                "final_reason": None,
                "time_remaining": 0,
                "total_participants": 0,
                "top3_podium": [],
                "winners": [],
                "rankings": [],
                "winner": None,
                "student_position": None,
                "nearby_rankings": [],
            }

        total_challenges = event.total_challenges or 5
        duration_min = (event.duration_minutes or 150) or 150

        # Every registered participant appears on the LIVE leaderboard — even
        # mid-run with a partial score. Final rankings are decided by score,
        # then the number of completed challenges, then finish time.
        qs = (
            Participant.objects.filter(event=event)
            .select_related("event")
            .order_by(
                "-score",
                "-completed",
                F("finished_at").asc(nulls_last=True),
                "updated_at",
                "-created_at",
            )
        )

        if search_query:
            q = search_query.strip()
            qs = qs.filter(name__icontains=q) | qs.filter(email__icontains=q)

        ranked_list: List[Dict[str, Any]] = []
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
                "is_finished": p.completed >= total_challenges,
            })

        # ── Event-wide live clock (the earliest starter defines the window). ──
        now = timezone.now()
        started_earliest = (
            Participant.objects.filter(event=event, started_at__isnull=False)
            .order_by("started_at")
            .values_list("started_at", flat=True)
            .first()
        )
        event_remaining = int(duration_min * 60)
        if started_earliest:
            elapsed = (now - started_earliest).total_seconds()
            event_remaining = max(0, int(duration_min * 60 - elapsed))

        # ── Final results? Either everyone finished, or the clock ran out. ──
        started_count = Participant.objects.filter(event=event, started_at__isnull=False).count()
        finished_count = Participant.objects.filter(event=event, started_at__isnull=False, finished_at__isnull=False).count()
        everyone_finished = started_count > 0 and finished_count >= started_count
        time_up = (
            event.status == Event.StatusChoices.COMPLETED
            or (started_earliest and event_remaining <= 0)
        )

        is_final = everyone_finished or time_up
        # Time is authoritative: if the clock ran out, that is the reason —
        # even if every active participant had finished first.
        if time_up:
            final_reason = "time_up"
        elif everyone_finished:
            final_reason = "all_finished"
        else:
            final_reason = None

        # ── Winners follow the ORIGINAL ranking rules ──────────────────────
        # Only participants who completed every challenge AND reached the
        # passing score are eligible for the podium. The eligible subset is
        # always filtered from the SAME live board (ranked_list) in the same
        # order — never computed separately — so the live leaderboard and the
        # final results are always in sync: nobody who wasn't visible on the
        # live board can suddenly appear as a winner.
        passing_score = event.passing_score or 0
        eligible = [
            r for r in ranked_list
            if r["completed"] >= total_challenges and r["score"] >= passing_score
        ]
        # Live podium reflects the current top scorers on the board; the
        # officially announced winners (top 3 eligible) are what get locked in
        # once the event goes final.
        top3 = eligible[:3]
        podium = ranked_list[:3]
        winner = top3[0] if (is_final and top3) else None

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
            "event_code": event.event_code,
            "college_name": event.college_name,
            "event_status": event.status,
            "is_final": is_final,
            "final_reason": final_reason,
            "time_remaining": event_remaining,
            "total_participants": len(ranked_list),
            "top3_podium": podium,
            "winners": top3,
            "rankings": ranked_list,
            "winner": winner,
            "student_position": student_position,
            "nearby_rankings": nearby_rankings,
        }