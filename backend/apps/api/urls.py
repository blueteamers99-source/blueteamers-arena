from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.common.viewsets.health_viewset import HealthViewSet

router = DefaultRouter()
router.register(r"health", HealthViewSet, basename="health")

v1_urls = [
    path("", include(router.urls)),
    path("", include("apps.accounts.urls")),
    path("", include("apps.events.urls")),
    path("admin/", include("apps.events.urls")),
    path("", include("apps.participants.urls")),
    path("", include("apps.questions.urls")),
    path("", include("apps.challenges.urls")),
    path("", include("apps.submissions.urls")),
    path("", include("apps.leaderboard.urls")),
    path("", include("apps.audit.urls")),
    path("", include("apps.notifications.urls")),
]

urlpatterns = [
    path("", include(router.urls)),
    path("v1/", include(v1_urls)),
    path("v2/", include(v1_urls)),
    path("", include(v1_urls)),
]
