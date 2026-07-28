from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.accounts.viewsets.auth_viewsets import (
    LoginView,
    TokenRefreshView,
    LogoutView,
    ChangePasswordView,
    ForgotPasswordView,
    ResetPasswordView,
)
from apps.accounts.viewsets.user_viewsets import UserProfileView
from apps.accounts.viewsets.admin_platform_viewset import AdminPlatformViewSet
from apps.questions.viewsets.question_viewset import QuestionViewSet
from apps.participants.viewsets.participant_viewset import ParticipantViewSet

router = DefaultRouter()
router.register(r"admin", AdminPlatformViewSet, basename="admin-platform")
router.register(r"admin/questions", QuestionViewSet, basename="admin-questions")
router.register(r"admin/participants", ParticipantViewSet, basename="admin-participants")

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
    path("auth/forgot-password/", ForgotPasswordView.as_view(), name="auth-forgot-password"),
    path("auth/reset-password/", ResetPasswordView.as_view(), name="auth-reset-password"),
    path("auth/me/", UserProfileView.as_view(), name="auth-me"),
    path("", include(router.urls)),
]
