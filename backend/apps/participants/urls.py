from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.participants.viewsets.participant_viewset import ParticipantViewSet
from apps.participants.viewsets.student_arena_viewset import StudentArenaViewSet
from apps.participants.viewsets.dashboard_viewset import DashboardViewSet
from apps.participants.viewsets.progress_viewset import ProgressViewSet
from apps.participants.viewsets.certificate_viewset import CertificateViewSet

router = DefaultRouter()
router.register(r"participants", ParticipantViewSet, basename="participant")
router.register(r"arena", StudentArenaViewSet, basename="student-arena")
router.register(r"dashboard", DashboardViewSet, basename="student-dashboard")
router.register(r"progress", ProgressViewSet, basename="student-progress")
router.register(r"certificate", CertificateViewSet, basename="certificate")

urlpatterns = router.urls
