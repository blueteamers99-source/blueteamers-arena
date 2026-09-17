from typing import Dict, Any
from apps.participants.models.participant import Participant
from apps.participants.models.participant_progress import ParticipantProgress
from apps.challenges.models.challenge import Challenge
from apps.common.services.timer_service import TimerService


class DashboardService:
    @staticmethod
    def get_student_dashboard(participant: Participant) -> Dict[str, Any]:
        event = participant.event
        total_challenges = event.total_challenges or Challenge.objects.count()

        # Calculate student rank in event — only ranked if the participant
        # passed (score >= passing AND all challenges completed). Otherwise no rank.
        passing_score = event.passing_score or 0
        is_ranked = participant.score >= passing_score and participant.completed >= total_challenges
        if is_ranked:
            higher_score_count = Participant.objects.filter(
                event=event,
                score__gt=participant.score,
            ).count()
            current_rank = higher_score_count + 1
        else:
            current_rank = None

        # Calculate progress stats
        progresses = ParticipantProgress.objects.filter(participant=participant)
        completed_count = progresses.filter(status=ParticipantProgress.StatusChoices.COMPLETED).count()
        remaining_count = max(0, total_challenges - completed_count)
        completion_percentage = round((completed_count / total_challenges * 100), 1) if total_challenges > 0 else 0.0

        # Calculate timer stats
        timer_data = TimerService.calculate_time(participant.started_at, event.duration_minutes)

        # Recent activity timeline
        recent_activity = []
        for p in progresses.select_related("challenge").order_by("-updated_at")[:5]:
            recent_activity.append({
                "challenge": p.challenge.name,
                "status": p.status,
                "score_earned": p.score_earned,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            })

        return {
            "student_profile": {
                "id": str(participant.id),
                "name": participant.name,
                "email": participant.email,
            },
            "current_event": {
                "id": str(event.id),
                "college_name": event.college_name,
                "workshop_name": event.workshop_name,
                "event_code": event.event_code,
                "status": event.status,
                "duration_minutes": event.duration_minutes,
                "passing_score": event.passing_score,
                "total_challenges": total_challenges,
            },
            "current_score": participant.score,
            "current_rank": current_rank,
            "completed_challenges": completed_count,
            "remaining_challenges": remaining_count,
            "leaderboard_position": current_rank,
            "time_remaining": timer_data,
            "recent_activity": recent_activity,
            "completion_percentage": completion_percentage,
            "statistics": {
                "total_challenges": total_challenges,
                "completed": completed_count,
                "in_progress": progresses.filter(status=ParticipantProgress.StatusChoices.IN_PROGRESS).count(),
                "accuracy": f"{completion_percentage}%",
            },
        }
