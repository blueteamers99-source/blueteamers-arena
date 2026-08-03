from rest_framework import viewsets, status
from rest_framework.response import Response
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
        if self.action in ["list", "retrieve", "evidence", "submit", "create"]:
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

    def retrieve(self, request, *args, **kwargs):
        slug = kwargs.get("slug")
        challenge = ChallengeSelector.get_by_slug_or_id(slug)
        if not challenge:
            return success_response(message="Challenge not found.", status_code=status.HTTP_404_NOT_FOUND)

        # Event verification check
        participant = getattr(request, "participant", None)
        if participant and hasattr(challenge, "event") and challenge.event:
            if challenge.event != participant.event:
                from rest_framework.response import Response
                return Response({"success": False, "message": "Forbidden. Cross-event challenge access denied."}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(challenge)
        from rest_framework.response import Response
        res_data = {**serializer.data, "success": True, "data": serializer.data, "challenge": serializer.data}
        return Response(res_data, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        from django.db.models import Max
        from django.utils.text import slugify
        import uuid

        raw_data = request.data.copy()
        name = raw_data.get("name") or raw_data.get("title") or "New Challenge"
        raw_data["name"] = name

        desc = raw_data.get("description") or raw_data.get("brief") or "SOC Investigation Scenario"
        raw_data["description"] = desc
        raw_data["brief"] = raw_data.get("brief") or desc

        if "duration" in raw_data and "duration_minutes" not in raw_data:
            raw_data["duration_minutes"] = raw_data["duration"]

        base_slug = slugify(raw_data.get("slug") or name) or "challenge"
        slug = base_slug
        if Challenge.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{uuid.uuid4().hex[:4]}"
        raw_data["slug"] = slug

        if "challenge_number" not in raw_data or not raw_data["challenge_number"]:
            max_num = Challenge.objects.aggregate(m=Max("challenge_number"))["m"] or 0
            raw_data["challenge_number"] = max_num + 1

        serializer = self.get_serializer(data=raw_data)
        if serializer.is_valid():
            challenge = serializer.save()
            return Response(
                {
                    "success": True,
                    "message": f"Challenge '{challenge.name}' created successfully.",
                    "data": serializer.data,
                    "id": str(challenge.id),
                },
                status=status.HTTP_201_CREATED,
            )

        err_msg = " ".join([f"{k}: {v[0] if isinstance(v, list) else v}" for k, v in serializer.errors.items()])
        return Response(
            {"success": False, "message": err_msg or "Validation error.", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

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
