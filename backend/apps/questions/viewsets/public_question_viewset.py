from rest_framework import viewsets
from rest_framework.authentication import SessionAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication
from apps.accounts.models.user import User
from apps.participants.auth.participant_auth import ParticipantTokenAuthentication
from apps.questions.models.question import Question
from apps.questions.permissions import IsAdminOrParticipant
from apps.questions.selectors.question_selector import QuestionSelector
from apps.questions.serializers.question_serializer import PublicQuestionSerializer


class PublicQuestionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Answer-key-free read view of the question bank.

    Three deliberate restrictions:

      * ReadOnlyModelViewSet, not ModelViewSet — there are no write actions on
        this route at all, so a write cannot be reached by guessing the verb.
        Question authoring happens exclusively on AdminQuestionViewSet.
      * serializer_class is unconditional, so this route can only ever render
        PublicQuestionSerializer, which omits correct_answer,
        correct_option_index and explanation.
      * anonymous callers are rejected. Previously this route was AllowAny and
        served the entire bank to anyone, letting participants read every
        challenge's content before the event started.

    Participants are additionally scoped to the questions attached to their own
    event's challenges; only staff see the full bank.
    """

    queryset = Question.objects.all()
    serializer_class = PublicQuestionSerializer
    authentication_classes = [
        ParticipantTokenAuthentication,
        JWTAuthentication,
        SessionAuthentication,
    ]
    permission_classes = [IsAdminOrParticipant]

    def _get_participant(self):
        participant = getattr(self.request, "participant", None)
        if participant is None:
            participant = getattr(self.request.user, "participant", None)
        return participant

    def _is_staff(self) -> bool:
        user = getattr(self.request, "user", None)
        if user is None or not getattr(user, "is_authenticated", False):
            return False
        return getattr(user, "role", None) in [User.RoleChoices.ADMIN, User.RoleChoices.SUPER_ADMIN]

    def get_queryset(self):
        queryset = QuestionSelector.filter_questions(
            category=self.request.query_params.get("category"),
            difficulty=self.request.query_params.get("difficulty"),
            status=self.request.query_params.get("status"),
            query=self.request.query_params.get("search"),
        )

        if self._is_staff():
            return queryset

        participant = self._get_participant()
        if participant is None:
            # Unreachable: IsAdminOrParticipant has already rejected anyone who
            # is neither staff nor a participant. Kept as a fail-closed guard.
            return queryset.none()

        # Only Published questions are visible to students, and only the ones
        # wired into a challenge of their own event. Participants with no event
        # fall back to the global (event-less) challenges, mirroring the
        # fallback used by the challenge review endpoint.
        queryset = queryset.filter(status=Question.StatusChoices.PUBLISHED)
        if participant.event_id:
            return queryset.filter(
                assigned_challenges__challenge__event_id=participant.event_id
            ).distinct()
        return queryset.filter(
            assigned_challenges__challenge__event__isnull=True
        ).distinct()
