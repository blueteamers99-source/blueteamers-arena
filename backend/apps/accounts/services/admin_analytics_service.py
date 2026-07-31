from typing import Dict, Any
from django.db.models import Avg, Count, Max, Min
from apps.events.models.event import Event
from apps.participants.models.participant import Participant
from apps.participants.models.participant_progress import ParticipantProgress
from apps.challenges.models.challenge import Challenge
from apps.questions.models.question import Question
from apps.submissions.models.submission import Submission


class AdminAnalyticsService:
    @staticmethod
    def get_platform_dashboard_stats() -> Dict[str, Any]:
        total_events = Event.objects.count()
        live_events = Event.objects.filter(status=Event.StatusChoices.LIVE).count()
        completed_events = Event.objects.filter(status=Event.StatusChoices.COMPLETED).count()

        total_participants = Participant.objects.count()
        total_challenges = Challenge.objects.count()
        total_questions = Question.objects.count()

        avg_score_data = Participant.objects.aggregate(avg_score=Avg("score"))
        avg_score = round(avg_score_data["avg_score"] or 0, 1)

        # Completion rate
        completed_participants = Participant.objects.filter(completed__gte=total_challenges).count()
        completion_rate = round((completed_participants / total_participants * 100), 1) if total_participants > 0 else 0.0

        # Top Colleges
        top_colleges = (
            Participant.objects.values("event__college_name")
            .annotate(
                participant_count=Count("id"),
                avg_score=Avg("score"),
                highest_score=Max("score"),
            )
            .order_by("-highest_score", "-participant_count")[:5]
        )

        # Top Participants
        top_participants = (
            Participant.objects.select_related("event")
            .order_by("-score", "finished_at")[:10]
            .values("id", "name", "email", "event__college_name", "score", "completed")
        )

        recent_events = (
            Event.objects.annotate(enrolled_participants=Count("participants"))
            .order_by("-created_at")[:5]
            .values("id", "college_name", "workshop_name", "event_code", "status", "created_at", "enrolled_participants", "event_date")
        )

        recent_activity = [
            f"Event '{e['workshop_name']}' for {e['college_name']} is currently {e['status']}."
            for e in recent_events
        ]

        return {
            "summary": {
                "total_events": total_events,
                "live_events": live_events,
                "completed_events": completed_events,
                "total_participants": total_participants,
                "total_challenges": total_challenges,
                "total_questions": total_questions,
                "average_score": avg_score,
                "completion_rate": f"{completion_rate}%",
            },
            "recent_events": list(recent_events),
            "recent_activity": recent_activity,
            "top_colleges": list(top_colleges),
            "top_participants": list(top_participants),
        }

    @staticmethod
    def get_event_analytics(event_id: str = None) -> Dict[str, Any]:
        qs = Event.objects.all()
        if event_id:
            qs = qs.filter(id=event_id)

        analytics_list = []
        for ev in qs:
            participants = Participant.objects.filter(event=ev)
            reg_count = participants.count()
            comp_count = participants.filter(completed__gte=ev.total_challenges).count()
            comp_pct = round((comp_count / reg_count * 100), 1) if reg_count > 0 else 0.0

            score_stats = participants.aggregate(avg=Avg("score"), max=Max("score"), min=Min("score"))

            analytics_list.append({
                "event_id": str(ev.id),
                "event_code": ev.event_code,
                "college_name": ev.college_name,
                "status": ev.status,
                "participants_registered": reg_count,
                "participants_completed": comp_count,
                "completion_percentage": f"{comp_pct}%",
                "average_score": round(score_stats["avg"] or 0, 1),
                "highest_score": score_stats["max"] or 0,
                "lowest_score": score_stats["min"] or 0,
            })

        return {"events_analytics": analytics_list}

    @staticmethod
    def get_question_analytics() -> Dict[str, Any]:
        questions = Question.objects.all()
        q_stats = []

        for q in questions:
            # Find all submission logs for this question
            total_attempts = 0
            correct_attempts = 0

            submissions = Submission.objects.all()
            for sub in submissions:
                for log in (sub.evaluation_results or []):
                    if log.get("question_id") == str(q.id):
                        total_attempts += 1
                        if log.get("is_correct"):
                            correct_attempts += 1

            accuracy = round((correct_attempts / total_attempts * 100), 1) if total_attempts > 0 else 100.0
            wrong_pct = round(100.0 - accuracy, 1)

            q_stats.append({
                "id": str(q.id),
                "question_text": q.question_text[:60],
                "category": q.category,
                "difficulty": q.difficulty,
                "kind": q.kind,
                "total_attempts": total_attempts,
                "correct_attempts": correct_attempts,
                "accuracy": f"{accuracy}%",
                "wrong_answer_percentage": f"{wrong_pct}%",
            })

        return {"questions_analytics": q_stats}
