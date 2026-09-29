from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.questions.viewsets import PublicQuestionViewSet

router = DefaultRouter()
router.register(r"questions", PublicQuestionViewSet, basename="question")

urlpatterns = router.urls
