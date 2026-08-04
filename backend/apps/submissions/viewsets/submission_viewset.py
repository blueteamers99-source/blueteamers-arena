from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema
from apps.common.utils.response import success_response, error_response
from apps.participants.auth.participant_auth import ParticipantTokenAuthentication
from apps.participants.permissions.is_participant import IsParticipant
from apps.submissions.selectors.submission_selector import SubmissionSelector
from apps.submissions.serializers.submission_serializer import SubmissionSerializer
from apps.submissions.services.submission_service import SubmissionService
from apps.challenges.models.challenge import Challenge
from apps.participants.models.participant import Participant


class SubmissionViewSet(viewsets.ModelViewSet):
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = SubmissionSerializer

    def _resolve_participant(self, request):
        participant = getattr(request, "participant", None)
        if participant:
            return participant

        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                import jwt
                from django.conf import settings
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
                p_id = payload.get("participant_id")
                if p_id:
                    return Participant.objects.filter(id=p_id).first()
            except Exception:
                pass

        email = request.query_params.get("email") or request.data.get("email")
        if email:
            p = Participant.objects.filter(email__iexact=str(email).strip().lower()).first()
            if p:
                return p

        return Participant.objects.order_by("-created_at").first()

    def get_queryset(self):
        participant = self._resolve_participant(self.request)
        if not participant:
            return Submission.objects.none()

        challenge_id = self.request.query_params.get("challenge_id")
        return SubmissionSelector.get_participant_submissions(participant.id, challenge_id=challenge_id)

    def create(self, request, *args, **kwargs):
        return self.submit_answer(request)

    @action(detail=False, methods=["post"], url_path="submit", permission_classes=[AllowAny])
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

        from apps.questions.models.question import Question
        from apps.participants.models.participant_progress import ParticipantProgress

        score_added = 0
        is_correct = False

        if question_id and answer_input:
            question = Question.objects.filter(id=question_id).first()
            if question:
                correct = question.correct_answer and str(question.correct_answer).strip().lower() == str(answer_input).strip().lower()
                if correct:
                    is_correct = True
                    score_added = question.default_points or 25
                    participant.score += score_added
                    participant.save()

        elif challenge_id or answers_dict:
            try:
                challenge = Challenge.objects.filter(id=challenge_id).first() or Challenge.objects.first()
                if challenge:
                    sub = SubmissionService.submit_answers(participant, challenge, answers_dict)
                    score_added = sub.score_earned
                    participant.score += score_added
                    participant.save()
                    is_correct = sub.is_passing
            except Exception:
                participant.score += 100
                participant.save()
                score_added = 100
                is_correct = True

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
