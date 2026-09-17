from typing import Dict, Any
from django.db import transaction
from django.db.models import F
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
        with transaction.atomic():
            # Lock participant row to prevent concurrent score updates
            participant = Participant.objects.select_for_update().get(id=participant.id)

            # 1. Cross-Event Isolation Check (F-06/F-07)
            challenge_event = getattr(challenge, "event", None)
            if challenge_event and participant.event_id != getattr(challenge, "event_id", None):
                raise PermissionDenied("Forbidden. Cannot submit answers to a challenge belonging to another event.")

            # 2. Validate Event State
            if participant.event and participant.event.status == "Completed":
                raise PermissionDenied("This event has ended. Submissions are no longer accepted.")

            # 2b. Validate Challenge Timer
            progress_check = ParticipantProgress.objects.filter(
                participant=participant, challenge=challenge
            ).first()
            if progress_check and progress_check.status == ParticipantProgress.StatusChoices.IN_PROGRESS:
                remaining = progress_check.calculate_remaining_time_seconds()
                if remaining <= 0:
                    progress_check.status = ParticipantProgress.StatusChoices.EXPIRED
                    progress_check.save()
                    raise ValidationError("Challenge time has expired. Submission rejected.")
            elif progress_check and progress_check.status == ParticipantProgress.StatusChoices.EXPIRED:
                raise ValidationError("Challenge time has expired. Submission rejected.")

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
            # select_for_update() locks the progress row so concurrent requests
            # for the same participant+challenge wait here instead of both
            # passing the "not COMPLETED" check.
            progress, created = ParticipantProgress.objects.select_for_update().get_or_create(
                participant=participant,
                challenge=challenge,
            )

            if progress.status != ParticipantProgress.StatusChoices.COMPLETED:
                progress.status = ParticipantProgress.StatusChoices.COMPLETED
                progress.completed_at = timezone.now()
                progress.score_earned = grading_result["score_earned"]
                progress.save()

                # Use F() expressions for atomic DB-level increments.
                # This avoids the read-modify-write race: two concurrent
                # requests both reading score=100, adding 25, and one
                # overwriting the other's write.
                total_challenges = getattr(participant.event, "total_challenges", 5) or 5
                updates = {
                    "score": F("score") + grading_result["score_earned"],
                    "completed": F("completed") + 1,
                }
                if not participant.finished_at and (participant.completed + 1) >= total_challenges:
                    updates["finished_at"] = timezone.now()
                Participant.objects.filter(id=participant.id).update(**updates)
                # Refresh to get DB-computed values (F() expressions return
                # deferred objects until refreshed)
                participant.refresh_from_db()
            else:
                # If re-submitted, award only positive delta if new score is higher
                old_earned = progress.score_earned
                new_earned = grading_result["score_earned"]
                if new_earned > old_earned:
                    delta = new_earned - old_earned
                    progress.score_earned = new_earned
                    progress.save()
                    Participant.objects.filter(id=participant.id).update(
                        score=F("score") + delta,
                    )
                    participant.refresh_from_db()

        # 6. WebSocket real-time broadcast (outside transaction — best-effort)
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
