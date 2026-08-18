from typing import Dict, Any, List
from django.utils import timezone
from rest_framework.exceptions import NotFound, ValidationError, PermissionDenied
from apps.participants.models.participant import Participant
from apps.participants.models.participant_progress import ParticipantProgress
from apps.participants.models.participant_draft import ParticipantDraftAnswer
from apps.challenges.models.challenge import Challenge
from apps.questions.models.question import Question
from apps.submissions.services.submission_service import SubmissionService


class ProgressService:
    @staticmethod
    def _verify_event_access(participant: Participant, challenge: Challenge):
        challenge_event = getattr(challenge, "event", None)
        if challenge_event and participant.event_id != getattr(challenge, "event_id", None):
            raise PermissionDenied("Forbidden. Cross-event access denied.")

    @staticmethod
    def start_challenge(participant: Participant, challenge: Challenge) -> Dict[str, Any]:
        ProgressService._verify_event_access(participant, challenge)

        duration_min = getattr(challenge, "duration_minutes", 20) or 20
        total_points = getattr(challenge, "points", 100) or 100

        progress, created = ParticipantProgress.objects.get_or_create(
            participant=participant,
            challenge=challenge,
            defaults={
                "status": ParticipantProgress.StatusChoices.IN_PROGRESS,
                "started_at": timezone.now(),
                "last_activity_at": timezone.now(),
                "time_limit_seconds": duration_min * 60,
                "max_possible_score": total_points,
            },
        )

        # If it was NOT_STARTED, move to IN_PROGRESS and start clock
        if progress.status == ParticipantProgress.StatusChoices.NOT_STARTED:
            progress.status = ParticipantProgress.StatusChoices.IN_PROGRESS
            progress.started_at = timezone.now()
            progress.last_activity_at = timezone.now()
            progress.time_limit_seconds = duration_min * 60
            progress.max_possible_score = total_points
            progress.save()

        return ProgressService.get_challenge_progress(participant, challenge)

    @staticmethod
    def get_challenge_progress(participant: Participant, challenge: Challenge) -> Dict[str, Any]:
        ProgressService._verify_event_access(participant, challenge)

        duration_min = getattr(challenge, "duration_minutes", 20) or 20
        total_points = getattr(challenge, "points", 100) or 100

        progress, _ = ParticipantProgress.objects.get_or_create(
            participant=participant,
            challenge=challenge,
            defaults={
                "status": ParticipantProgress.StatusChoices.NOT_STARTED,
                "time_limit_seconds": duration_min * 60,
                "max_possible_score": total_points,
            },
        )

        # Calculate server remaining time
        remaining_time = progress.calculate_remaining_time_seconds()
        if progress.status == ParticipantProgress.StatusChoices.IN_PROGRESS and remaining_time <= 0 and progress.started_at:
            # Check if duration limit is strict
            pass

        # Fetch draft answers from database
        drafts = ParticipantDraftAnswer.objects.filter(participant=participant, challenge=challenge)
        drafts_data: Dict[str, Any] = {}
        simplified_answers: Dict[str, Any] = {}

        # First load from JSON store if present
        if progress.draft_answers and isinstance(progress.draft_answers, dict):
            for k, v in progress.draft_answers.items():
                simplified_answers[str(k)] = v
                drafts_data[str(k)] = {
                    "answer_text": str(v) if not isinstance(v, list) else "",
                    "selected_options": v if isinstance(v, list) else [],
                    "selected_option_index": v if isinstance(v, int) else None,
                }

        # Override/augment with relational Draft records
        for d in drafts:
            val = d.selected_option_index if d.selected_option_index is not None else d.answer_text
            simplified_answers[str(d.question_id)] = val
            drafts_data[str(d.question_id)] = {
                "answer_text": d.answer_text,
                "selected_options": d.selected_options,
                "selected_option_index": d.selected_option_index,
            }

        # Calculate question counts
        total_questions = 0
        if hasattr(challenge, "challenge_questions"):
            total_questions = challenge.challenge_questions.count()
        if total_questions == 0:
            # Fallback to standard 4/5 questions if challenge questions not linked via M2M
            total_questions = len(getattr(challenge, "questions", []) or [1, 2, 3, 4])

        answered_count = len([k for k, v in simplified_answers.items() if v is not None and str(v).strip() != ""])

        return {
            "challenge_slug": challenge.slug,
            "challenge_id": str(challenge.id),
            "challenge_name": challenge.name,
            "status": progress.status,
            "current_question_index": progress.current_question_index,
            "visited_questions": progress.visited_questions or [],
            "answered_questions": answered_count,
            "total_questions": total_questions,
            "score_earned": progress.score_earned,
            "max_possible_score": progress.max_possible_score or total_points,
            "time_limit_seconds": progress.time_limit_seconds or (duration_min * 60),
            "remaining_time_seconds": remaining_time,
            "draft_answers": drafts_data,
            "answers": simplified_answers,
            "started_at": progress.started_at.isoformat() if progress.started_at else None,
            "last_activity_at": progress.last_activity_at.isoformat() if progress.last_activity_at else None,
            "completed_at": progress.completed_at.isoformat() if progress.completed_at else None,
        }

    @staticmethod
    def save_batch_progress(
        participant: Participant,
        challenge: Challenge,
        answers: Dict[str, Any],
        current_question_index: int = 0,
        visited_questions: List[str] = None,
    ) -> Dict[str, Any]:
        ProgressService._verify_event_access(participant, challenge)

        duration_min = getattr(challenge, "duration_minutes", 20) or 20
        total_points = getattr(challenge, "points", 100) or 100

        progress, _ = ParticipantProgress.objects.get_or_create(
            participant=participant,
            challenge=challenge,
            defaults={
                "status": ParticipantProgress.StatusChoices.IN_PROGRESS,
                "started_at": timezone.now(),
                "time_limit_seconds": duration_min * 60,
                "max_possible_score": total_points,
            },
        )

        # Do not overwrite completed challenges
        if progress.status == ParticipantProgress.StatusChoices.COMPLETED:
            return ProgressService.get_challenge_progress(participant, challenge)

        if progress.status == ParticipantProgress.StatusChoices.NOT_STARTED:
            progress.status = ParticipantProgress.StatusChoices.IN_PROGRESS
            progress.started_at = timezone.now()

        # Update JSON drafts
        existing_drafts = progress.draft_answers if isinstance(progress.draft_answers, dict) else {}
        if answers:
            existing_drafts.update(answers)
        progress.draft_answers = existing_drafts

        progress.current_question_index = current_question_index
        if visited_questions:
            existing_visited = set(progress.visited_questions or [])
            existing_visited.update(visited_questions)
            progress.visited_questions = list(existing_visited)

        progress.last_activity_at = timezone.now()
        progress.save()

        # Best-effort sync to ParticipantDraftAnswer table for questions that exist in db
        if answers:
            for q_key, ans_val in answers.items():
                try:
                    q_obj = Question.objects.filter(id=q_key).first()
                    if q_obj:
                        ParticipantDraftAnswer.objects.update_or_create(
                            participant=participant,
                            challenge=challenge,
                            question=q_obj,
                            defaults={
                                "answer_text": str(ans_val) if not isinstance(ans_val, int) else "",
                                "selected_option_index": ans_val if isinstance(ans_val, int) else None,
                            },
                        )
                except Exception:
                    pass

        return ProgressService.get_challenge_progress(participant, challenge)

    @staticmethod
    def save_draft(
        participant: Participant,
        challenge: Challenge,
        question_id: str,
        answer_text: str = "",
        selected_options: List[str] = None,
        selected_option_index: int = None,
        current_question_index: int = 0,
    ) -> Dict[str, Any]:
        ProgressService._verify_event_access(participant, challenge)

        try:
            question = Question.objects.get(id=question_id)
        except (Question.DoesNotExist, ValueError):
            question = None

        if question:
            ParticipantDraftAnswer.objects.update_or_create(
                participant=participant,
                challenge=challenge,
                question=question,
                defaults={
                    "answer_text": answer_text,
                    "selected_options": selected_options or [],
                    "selected_option_index": selected_option_index,
                },
            )

        # Update progress state and JSON cache
        answers_update = {
            question_id: selected_option_index if selected_option_index is not None else answer_text
        }
        return ProgressService.save_batch_progress(
            participant=participant,
            challenge=challenge,
            answers=answers_update,
            current_question_index=current_question_index,
            visited_questions=[question_id],
        )

    @staticmethod
    def submit_challenge(participant: Participant, challenge: Challenge, answers_override: Dict[str, Any] = None) -> Dict[str, Any]:
        ProgressService._verify_event_access(participant, challenge)

        # Retrieve saved answers if override not provided
        progress = ParticipantProgress.objects.filter(
            participant=participant,
            challenge=challenge,
        ).first()

        # If already completed, return idempotent completed response
        if progress and progress.status == ParticipantProgress.StatusChoices.COMPLETED:
            return {
                "message": f"Challenge '{challenge.name}' is already completed.",
                "challenge_slug": challenge.slug,
                "status": "completed",
                "score_earned": progress.score_earned,
                "max_possible_score": progress.max_possible_score,
                "is_passing": progress.score_earned >= (progress.max_possible_score * 0.7),
                "total_participant_score": participant.score,
                "completed_challenges": participant.completed,
            }

        answers_payload = {}
        if answers_override:
            answers_payload.update(answers_override)
        elif progress and progress.draft_answers:
            answers_payload.update(progress.draft_answers)

        # Supplement with ParticipantDraftAnswer
        drafts = ParticipantDraftAnswer.objects.filter(participant=participant, challenge=challenge)
        for d in drafts:
            if str(d.question_id) not in answers_payload:
                if d.selected_option_index is not None:
                    answers_payload[str(d.question_id)] = d.selected_option_index
                elif d.answer_text:
                    answers_payload[str(d.question_id)] = d.answer_text

        # Server-side evaluation via SubmissionService
        submission = SubmissionService.submit_answers(
            participant=participant,
            challenge=challenge,
            answers=answers_payload,
        )

        progress = ParticipantProgress.objects.filter(
            participant=participant,
            challenge=challenge,
        ).first()

        return {
            "message": f"Challenge '{challenge.name}' evaluated and submitted successfully.",
            "challenge_slug": challenge.slug,
            "status": progress.status if progress else "completed",
            "score_earned": submission.score_earned,
            "max_possible_score": submission.max_possible_score,
            "is_passing": submission.is_passing,
            "total_participant_score": participant.score,
            "completed_challenges": participant.completed,
        }

    @staticmethod
    def get_all_challenges_progress_map(participant: Participant) -> Dict[str, Any]:
        """
        Returns a progress summary map for all challenges for the given participant.
        """
        progresses = ParticipantProgress.objects.filter(participant=participant).select_related("challenge")
        progress_map = {}
        for p in progresses:
            rem_sec = p.calculate_remaining_time_seconds()
            answered_count = len([k for k, v in (p.draft_answers or {}).items() if v is not None and str(v).strip() != ""])
            slug = p.challenge.slug or str(p.challenge.id)
            progress_map[slug] = {
                "status": p.status,
                "score_earned": p.score_earned,
                "max_possible_score": p.max_possible_score,
                "answered_questions": answered_count,
                "current_question_index": p.current_question_index,
                "remaining_time_seconds": rem_sec,
                "started_at": p.started_at.isoformat() if p.started_at else None,
                "completed_at": p.completed_at.isoformat() if p.completed_at else None,
            }
        return progress_map
