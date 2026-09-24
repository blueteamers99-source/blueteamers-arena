import logging

from django.db import transaction
from django.db.models import F
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from drf_spectacular.utils import extend_schema
from apps.common.utils.response import success_response, error_response
from apps.common.throttling import SubmissionRateThrottle
from apps.participants.auth.participant_auth import ParticipantTokenAuthentication
from apps.participants.permissions.is_participant import IsParticipant
from apps.competition.services.answer_validation_service import AnswerValidationService
from apps.submissions.selectors.submission_selector import SubmissionSelector
from apps.submissions.serializers.submission_serializer import SubmissionSerializer
from apps.submissions.services.submission_service import SubmissionService
from apps.challenges.models.challenge import Challenge
from apps.participants.models.participant import Participant
from apps.participants.models.participant_progress import ParticipantProgress
from apps.questions.models.question import Question
from apps.submissions.models.submission import Submission
from apps.challenges.models.challenge_question import ChallengeQuestion

logger = logging.getLogger(__name__)


class SubmissionViewSet(viewsets.ModelViewSet):
    authentication_classes = [ParticipantTokenAuthentication]
    permission_classes = [IsParticipant]
    throttle_classes = [SubmissionRateThrottle]
    serializer_class = SubmissionSerializer

    def _resolve_participant(self, request):
        """
        Returns the authenticated participant. Relies entirely on DRF
        authentication — no email lookup, no fallback to newest user.
        """
        return getattr(request, "participant", None)

    def get_queryset(self):
        participant = self._resolve_participant(self.request)
        if not participant:
            return Submission.objects.none()

        challenge_id = self.request.query_params.get("challenge_id")
        return SubmissionSelector.get_participant_submissions(participant.id, challenge_id=challenge_id)

    def create(self, request, *args, **kwargs):
        return self.submit_answer(request)

    @action(detail=False, methods=["post"], url_path="submit")
    def submit_answer(self, request):
        participant = self._resolve_participant(request)
        if not participant:
            return Response(
                {"success": False, "message": "Participant not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        question_id = request.data.get("question_id")
        answer_input = request.data.get("answer") or request.data.get("correct_answer")
        challenge_id = request.data.get("challenge_id")
        answers_dict = request.data.get("answers", {})

        score_added = 0
        is_correct = False

        if question_id and answer_input:
            question = Question.objects.filter(id=question_id).first()
            if question:
                # Enforce event-wide timer: the single event clock governs all
                # challenges; there is no per-challenge time limit anymore.
                # Never-started clock → reject (window cannot be bypassed by
                # skipping the Start click); expired clock → reject.
                if not participant.started_at or participant.get_event_remaining_seconds() <= 0:
                    return Response(
                        {"success": False, "message": "Event time has expired or was never started. Submission rejected."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                # Unified grading (M-05): the single-question path uses the
                # same AnswerValidationService as the challenge path, so
                # "correct" means the same thing everywhere. Whole-keyword
                # partial credit: a fractional multiplier awards proportional
                # points, but is_correct is True ONLY on a full match.
                is_correct, multiplier, note = AnswerValidationService.validate_answer(question, answer_input)
                earned = round((question.default_points or 25) * multiplier)

                with transaction.atomic():
                    # Lock participant row to prevent concurrent score updates
                    participant = Participant.objects.select_for_update().get(
                        id=participant.id
                    )

                    # Anti-farming baseline: the best score previously awarded
                    # for THIS question across the participant's single-question
                    # submissions. Challenge-path rows are excluded (their
                    # answers_json holds multiple keys and a whole-challenge
                    # total, which would poison the per-question baseline).
                    # A resubmission only awards the positive delta above the
                    # best, so total credit per question can never exceed
                    # question.default_points no matter how many attempts.
                    prior_best = 0
                    prior_subs = Submission.objects.filter(
                        participant=participant,
                        answers_json__has_key=str(question_id),
                    ).order_by("-score_earned")[:20]
                    for sub in prior_subs:
                        if len(sub.answers_json or {}) == 1:
                            prior_best = max(prior_best, sub.score_earned)

                    delta = earned - prior_best
                    if delta > 0:
                        score_added = delta
                        # Atomic increment — no read-modify-write race
                        Participant.objects.filter(id=participant.id).update(
                            score=F("score") + delta,
                        )
                        participant.refresh_from_db()

                        # Create Submission record for audit trail and future
                        # idempotency checks.
                        challenge_question = ChallengeQuestion.objects.filter(
                            question=question
                        ).select_related("challenge").first()
                        if challenge_question:
                            Submission.objects.create(
                                participant=participant,
                                challenge=challenge_question.challenge,
                                answers_json={str(question_id): answer_input},
                                score_earned=earned,
                                max_possible_score=question.default_points or 25,
                                is_passing=is_correct,
                                evaluation_results=[{
                                    "question_id": str(question_id),
                                    "correct": is_correct,
                                    "answer": answer_input,
                                    "score_multiplier": multiplier,
                                    "feedback_note": note,
                                }],
                            )

        elif challenge_id or answers_dict:
            challenge = Challenge.objects.filter(id=challenge_id).first()
            if not challenge:
                return Response(
                    {"success": False, "message": "Challenge not found."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                sub = SubmissionService.submit_answers(participant, challenge, answers_dict)
                # SubmissionService already adds score to participant and saves,
                # so we only read the values here — do NOT add again.
                score_added = sub.score_earned
                is_correct = sub.is_passing
            except Exception as e:
                logger.exception(
                    "Submission failed for participant=%s challenge=%s",
                    participant.id,
                    challenge_id,
                )
                return Response(
                    {"success": False, "message": f"Submission failed: {str(e)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Refresh participant from DB to get accurate post-save values
        participant.refresh_from_db()

        # Calculate updated rank
        higher_score_count = Participant.objects.filter(
            event=participant.event,
            score__gt=participant.score,
        ).count()
        new_rank = higher_score_count + 1

        # Calculate progress
        total_challenges = participant.event.total_challenges or 5
        completed_count = ParticipantProgress.objects.filter(
            participant=participant,
            status=ParticipantProgress.StatusChoices.COMPLETED,
        ).count()
        if is_correct and completed_count == 0:
            completed_count = 1
        progress_pct = round((completed_count / total_challenges) * 100, 1)

        return Response(
            {
                "success": True,
                "question_id": question_id,
                "is_correct": is_correct,
                "score": participant.score,
                "score_earned": score_added,
                "total_participant_score": participant.score,
                "rank": new_rank,
                "progress": progress_pct,
                "message": f"Submission recorded successfully. Current Score: {participant.score}",
            },
            status=status.HTTP_200_OK,
        )
