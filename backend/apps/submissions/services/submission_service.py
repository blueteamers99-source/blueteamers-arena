from typing import Dict, Any
from django.utils import timezone
from rest_framework.exceptions import ValidationError, PermissionDenied
from apps.participants.models.participant import Participant
from apps.participants.models.participant_progress import ParticipantProgress
from apps.challenges.models.challenge import Challenge
from apps.submissions.models.submission import Submission
from apps.competition.services.auto_grading_service import AutoGradingService
from apps.competition.services.websocket_service import WebSocketService


class SubmissionService:
    @staticmethod
    def submit_answers(participant: Participant, challenge: Challenge, answers: Dict[str, Any]) -> Submission:
        # 1. Cross-Event Isolation Check (F-06/F-07)
        challenge_event = getattr(challenge, "event", None)
        if challenge_event and participant.event_id != getattr(challenge, "event_id", None):
            raise PermissionDenied("Forbidden. Cannot submit answers to a challenge belonging to another event.")

        # 2. Validate Event State
        if participant.event and participant.event.status == "Completed":
            raise PermissionDenied("This event has ended. Submissions are no longer accepted.")

        # 3. Server-side Auto-Grading (F-05) - Evaluate ground truth Question keys
        grading_result = AutoGradingService.grade_submission(challenge, answers or {})

        # 4. Save submission record with evaluation breakdown
        submission = Submission.objects.create(
            participant=participant,
            challenge=challenge,
            answers_json=answers or {},
            score_earned=grading_result["score_earned"],
            max_possible_score=grading_result["max_possible_score"],
            is_passing=grading_result["is_passing"],
            evaluation_results=grading_result["evaluation_logs"],
        )

        # 5. Idempotent Progress Update - Prevent duplicate point inflation
        progress, created = ParticipantProgress.objects.get_or_create(
            participant=participant,
            challenge=challenge,
        )

        if progress.status != ParticipantProgress.StatusChoices.COMPLETED:
            progress.status = ParticipantProgress.StatusChoices.COMPLETED
            progress.completed_at = timezone.now()
            progress.score_earned = grading_result["score_earned"]
            progress.save()

            participant.score += grading_result["score_earned"]
            participant.completed += 1
            total_challenges = getattr(participant.event, "total_challenges", 5) or 5
            if not participant.finished_at and participant.completed >= total_challenges:
                participant.finished_at = timezone.now()
            participant.save()
        else:
            # If re-submitted, award only positive delta if new score is higher
            old_earned = progress.score_earned
            new_earned = grading_result["score_earned"]
            if new_earned > old_earned:
                delta = new_earned - old_earned
                progress.score_earned = new_earned
                progress.save()
                participant.score += delta
                participant.save()

        # 6. WebSocket real-time broadcast
        try:
            event_code = participant.event.event_code
            WebSocketService.notify_submission_event(event_code, {
                "participant_name": participant.name,
                "challenge": challenge.name,
                "score_earned": grading_result["score_earned"],
                "total_score": participant.score,
            })
        except Exception:
            pass

        return submission
