from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema
from apps.common.utils.response import success_response
from apps.accounts.permissions.is_admin import IsAdmin
from apps.participants.auth.participant_auth import ParticipantTokenAuthentication
from apps.challenges.models.challenge import Challenge
from apps.challenges.selectors.challenge_selector import ChallengeSelector
from apps.challenges.services.challenge_service import ChallengeService
from apps.challenges.services.evidence_service import EvidenceService
from apps.challenges.serializers.challenge_serializer import ChallengeSerializer
from apps.challenges.serializers.student_challenge_serializer import (
    StudentChallengeListSerializer,
    StudentChallengeDetailSerializer,
)
from apps.submissions.services.submission_service import SubmissionService
from apps.submissions.serializers.submission_serializer import (
    SubmissionSerializer,
    SubmitAnswersRequestSerializer,
)


class ChallengeViewSet(viewsets.ModelViewSet):
    queryset = Challenge.objects.all()
    lookup_field = "slug"
    lookup_value_regex = "[^/]+"
    authentication_classes = [ParticipantTokenAuthentication]

    def get_permissions(self):
        if self.action in ["list", "retrieve", "evidence", "submit"]:
            return [AllowAny()]
        return [IsAdmin()]

    def get_serializer_class(self):
        if self.action == "list":
            return StudentChallengeListSerializer
        elif self.action == "retrieve":
            return StudentChallengeDetailSerializer
        return ChallengeSerializer

    def get_queryset(self):
        difficulty = self.request.query_params.get("difficulty")
        search_query = self.request.query_params.get("search")
        return ChallengeSelector.filter_challenges(difficulty=difficulty, query=search_query)

    def perform_create(self, serializer):
        challenge = ChallengeService.create_challenge(serializer.validated_data)
        serializer.instance = challenge

    @extend_schema(responses={200: StudentChallengeDetailSerializer})
    @action(detail=True, methods=["get"], url_path="evidence/(?P<artifact_key>[^/.]+)")
    def evidence(self, request, slug=None, artifact_key=None):
        challenge = ChallengeSelector.get_by_slug_or_id(slug)
        if not challenge:
            return success_response(message="Challenge not found.", status_code=status.HTTP_404_NOT_FOUND)

        evidence_data = EvidenceService.get_evidence_for_student(challenge, artifact_key)
        return success_response(data=evidence_data, message="Evidence artifact retrieved.")

    @extend_schema(request=SubmitAnswersRequestSerializer)
    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, slug=None):
        participant = getattr(request, "participant", None)
        if not participant and request.user:
            participant = getattr(request.user, "participant", None)

        if not participant:
            return success_response(message="Participant authentication token required.", status_code=status.HTTP_401_UNAUTHORIZED)

        challenge = ChallengeSelector.get_by_slug_or_id(slug)
        if not challenge:
            return success_response(message="Challenge not found.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = SubmitAnswersRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        submission = SubmissionService.submit_answers(
            participant=participant,
            challenge=challenge,
            answers=serializer.validated_data["answers"],
        )
        return success_response(
            data=SubmissionSerializer(submission).data,
            message=f"Answers for '{challenge.name}' submitted and graded successfully!",
        )
