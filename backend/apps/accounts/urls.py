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
from apps.accounts.viewsets.student_auth_viewsets import (
    StudentSignupView,
    StudentLoginView,
    StudentGoogleAuthView,
    StudentProfileUpdateView,
)
from apps.accounts.viewsets.admin_auth_viewsets import (
    AdminLoginView,
    AdminMeView,
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
    # Shared / JWT
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
    path("auth/forgot-password/", ForgotPasswordView.as_view(), name="auth-forgot-password"),
    path("auth/reset-password/", ResetPasswordView.as_view(), name="auth-reset-password"),

    # Student Auth Flow
    path("auth/signup/", StudentSignupView.as_view(), name="student-signup"),
    path("auth/login/", StudentLoginView.as_view(), name="student-login"),
    path("auth/google/", StudentGoogleAuthView.as_view(), name="student-google"),
    path("auth/me/", UserProfileView.as_view(), name="auth-me"),
    path("auth/profile/", StudentProfileUpdateView.as_view(), name="student-profile"),

    # Admin Auth Flow (Independent)
    path("admin/login/", AdminLoginView.as_view(), name="admin-login"),
    path("admin/logout/", LogoutView.as_view(), name="admin-logout"),
    path("admin/refresh/", TokenRefreshView.as_view(), name="admin-token-refresh"),
    path("admin/me/", AdminMeView.as_view(), name="admin-me"),

    path("", include(router.urls)),
]
