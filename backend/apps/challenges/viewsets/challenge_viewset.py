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
from apps.participants.services.progress_service import ProgressService
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
        # Challenge modification actions (create, update, destroy) require IsAdmin
        if self.action in ["list", "retrieve", "evidence", "submit", "start", "save_progress", "progress"]:
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
        if not participant and request.user:
            participant = getattr(request.user, "participant", None)

        challenge_event = getattr(challenge, "event", None)
        if participant and challenge_event:
            if getattr(challenge, "event_id", None) != participant.event_id:
                return Response({"success": False, "message": "Forbidden. Cross-event challenge access denied."}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(challenge)
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
            return Response({"success": False, "message": "Participant authentication token required."}, status=status.HTTP_401_UNAUTHORIZED)

        challenge = ChallengeSelector.get_by_slug_or_id(slug)
        if not challenge:
            return Response({"success": False, "message": "Challenge not found."}, status=status.HTTP_404_NOT_FOUND)

        challenge_event = getattr(challenge, "event", None)
        if challenge_event and participant.event_id != getattr(challenge, "event_id", None):
            return Response({"success": False, "message": "Forbidden. Cross-event challenge submission denied."}, status=status.HTTP_403_FORBIDDEN)

        answers = request.data.get("answers") or {}
        result = ProgressService.submit_challenge(participant, challenge, answers_override=answers)
        return Response({
            "success": True,
            "data": result,
            "score_earned": result.get("score_earned", 0),
            "max_possible_score": result.get("max_possible_score", 100),
            "is_passing": result.get("is_passing", False),
            "total_score": participant.score,
            "message": result.get("message", f"Answers for '{challenge.name}' evaluated and submitted successfully!"),
        }, status=status.HTTP_200_OK)

    @extend_schema(responses={200: dict})
    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request, slug=None):
        challenge = ChallengeSelector.get_by_slug_or_id(slug)
        if not challenge:
            return Response({"success": False, "message": "Challenge not found."}, status=status.HTTP_404_NOT_FOUND)

        participant = getattr(request, "participant", None)
        if not participant and request.user:
            participant = getattr(request.user, "participant", None)

        if not participant:
            return Response({
                "success": True,
                "message": f"Challenge '{challenge.name}' started.",
                "challenge_id": str(challenge.slug),
                "status": "in_progress",
            }, status=status.HTTP_200_OK)

        data = ProgressService.start_challenge(participant, challenge)
        return Response({
            "success": True,
            "data": data,
            "message": f"Challenge '{challenge.name}' started successfully.",
            "challenge_id": str(challenge.slug),
            "status": data.get("status", "in_progress"),
            "remaining_time_seconds": data.get("remaining_time_seconds", 1200),
        }, status=status.HTTP_200_OK)

    @extend_schema(responses={200: dict})
    @action(detail=True, methods=["get"], url_path="progress")
    def progress(self, request, slug=None):
        challenge = ChallengeSelector.get_by_slug_or_id(slug)
        if not challenge:
            return Response({"success": False, "message": "Challenge not found."}, status=status.HTTP_404_NOT_FOUND)

        participant = getattr(request, "participant", None)
        if not participant and request.user:
            participant = getattr(request.user, "participant", None)

        if not participant:
            return Response({"success": False, "message": "Participant authentication token required."}, status=status.HTTP_401_UNAUTHORIZED)

        data = ProgressService.get_challenge_progress(participant, challenge)
        return Response({
            "success": True,
            "data": data,
            "message": "Progress retrieved successfully.",
        }, status=status.HTTP_200_OK)

    @extend_schema(responses={200: dict})
    @action(detail=True, methods=["post", "put", "patch"], url_path="save-progress")
    def save_progress(self, request, slug=None):
        challenge = ChallengeSelector.get_by_slug_or_id(slug)
        if not challenge:
            return Response({"success": False, "message": "Challenge not found."}, status=status.HTTP_404_NOT_FOUND)

        participant = getattr(request, "participant", None)
        if not participant and request.user:
            participant = getattr(request.user, "participant", None)

        if not participant:
            return Response({"success": False, "message": "Participant authentication token required."}, status=status.HTTP_401_UNAUTHORIZED)

        answers = request.data.get("answers") or {}
        curr_idx = request.data.get("current_question_index", 0)
        visited = request.data.get("visited_questions", [])

        data = ProgressService.save_batch_progress(
            participant=participant,
            challenge=challenge,
            answers=answers,
            current_question_index=curr_idx,
            visited_questions=visited,
        )

        return Response({
            "success": True,
            "data": data,
            "saved": True,
            "message": "Challenge progress saved successfully.",
        }, status=status.HTTP_200_OK)
