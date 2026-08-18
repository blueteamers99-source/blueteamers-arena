from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from apps.accounts.permissions.is_admin import IsAdmin
from apps.questions.models.question import Question
from apps.questions.selectors.question_selector import QuestionSelector
from apps.questions.services.question_service import QuestionService
from apps.questions.serializers.question_serializer import AdminQuestionSerializer, PublicQuestionSerializer


class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.all()

    def get_serializer_class(self):
        if "admin" in getattr(self.request, "path", "") or self.action in ["create", "update", "partial_update", "destroy"] or (
            self.request.user and self.request.user.is_authenticated and (self.request.user.is_staff or getattr(self.request.user, "is_admin_role", False))
        ):
            return AdminQuestionSerializer
        return PublicQuestionSerializer

    permission_classes = [IsAdmin]

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [AllowAny()]
        return [IsAdmin()]

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
