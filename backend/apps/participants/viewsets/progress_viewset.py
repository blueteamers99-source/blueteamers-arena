from rest_framework import viewsets, status
from rest_framework.decorators import action
from drf_spectacular.utils import extend_schema
from apps.common.utils.response import success_response
from apps.challenges.selectors.challenge_selector import ChallengeSelector
from apps.participants.auth.participant_auth import ParticipantTokenAuthentication
from apps.participants.permissions.is_participant import IsParticipant
from apps.participants.services.progress_service import ProgressService
from apps.participants.serializers.progress_serializer import (
    SaveDraftRequestSerializer,
    ProgressResponseSerializer,
)


class ProgressViewSet(viewsets.ViewSet):
    authentication_classes = [ParticipantTokenAuthentication]
    permission_classes = [IsParticipant]
    lookup_field = "challenge_slug"
    lookup_value_regex = "[^/]+"

    def get_participant(self, request):
        participant = getattr(request, "participant", None)
        if not participant and request.user:
            participant = getattr(request.user, "participant", None)
        return participant

    @extend_schema(responses={200: ProgressResponseSerializer})
    def retrieve(self, request, challenge_slug=None):
        participant = self.get_participant(request)
        challenge = ChallengeSelector.get_by_slug_or_id(challenge_slug)
        if not challenge:
            return success_response(message="Challenge not found.", status_code=status.HTTP_404_NOT_FOUND)

        data = ProgressService.get_challenge_progress(participant, challenge)
        return success_response(data=data, message="Progress state retrieved.")

    @extend_schema(request=SaveDraftRequestSerializer, responses={200: ProgressResponseSerializer})
    @action(detail=True, methods=["post"], url_path="save-draft")
    def save_draft(self, request, challenge_slug=None):
        participant = self.get_participant(request)
        challenge = ChallengeSelector.get_by_slug_or_id(challenge_slug)
        if not challenge:
            return success_response(message="Challenge not found.", status_code=status.HTTP_404_NOT_FOUND)

        serializer = SaveDraftRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = ProgressService.save_draft(
            participant=participant,
            challenge=challenge,
            question_id=str(serializer.validated_data["question_id"]),
            answer_text=serializer.validated_data.get("answer_text", ""),
            selected_options=serializer.validated_data.get("selected_options", []),
            selected_option_index=serializer.validated_data.get("selected_option_index"),
            current_question_index=serializer.validated_data.get("current_question_index", 0),
        )
        return success_response(data=data, message="Draft answer saved successfully.")

    @extend_schema(responses={200: ProgressResponseSerializer})
    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, challenge_slug=None):
        participant = self.get_participant(request)
        challenge = ChallengeSelector.get_by_slug_or_id(challenge_slug)
        if not challenge:
            return success_response(message="Challenge not found.", status_code=status.HTTP_404_NOT_FOUND)

        data = ProgressService.submit_challenge(participant, challenge)
        return success_response(data=data, message="Challenge submitted successfully.")
