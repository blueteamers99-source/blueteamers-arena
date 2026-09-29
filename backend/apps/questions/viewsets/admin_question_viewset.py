from rest_framework import viewsets
from rest_framework.authentication import SessionAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication
from apps.accounts.permissions.is_admin import IsAdmin
from apps.questions.models.question import Question
from apps.questions.selectors.question_selector import QuestionSelector
from apps.questions.services.question_service import QuestionService
from apps.questions.serializers.question_serializer import AdminQuestionSerializer


class AdminQuestionViewSet(viewsets.ModelViewSet):
    """
    Full question-bank CRUD for the admin portal, including the answer key.

    This is a dedicated class rather than a branch inside a shared viewset on
    purpose. The previous implementation served both /questions/ and
    /admin/questions/ from one class, and its get_permissions() opened
    list/retrieve to anonymous callers while get_serializer_class() picked the
    answer-key serializer off the "admin" substring in the URL — so an
    unauthenticated GET /api/v1/admin/questions/ returned every correct answer.

    With the routes split, authorisation and field selection are fixed
    properties of the class and can no longer be negotiated per request:

      * permission_classes applies to EVERY action, list and retrieve included.
      * serializer_class is unconditional, so there is no path where a
        non-admin is rendered with AdminQuestionSerializer.
      * no ParticipantTokenAuthentication, so a student token cannot
        authenticate against this route at all.
    """

    queryset = Question.objects.all()
    serializer_class = AdminQuestionSerializer
    authentication_classes = [JWTAuthentication, SessionAuthentication]
    permission_classes = [IsAdmin]

    def get_queryset(self):
        category = self.request.query_params.get("category")
        difficulty = self.request.query_params.get("difficulty")
        status_filter = self.request.query_params.get("status")
        search_query = self.request.query_params.get("search")
        return QuestionSelector.filter_questions(
            category=category,
            difficulty=difficulty,
            status=status_filter,
            query=search_query,
        )

    def perform_create(self, serializer):
        question = QuestionService.create_question(serializer.validated_data)
        serializer.instance = question
