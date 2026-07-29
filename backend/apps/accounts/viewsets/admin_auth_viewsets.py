from django.db.models import Q
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema
from apps.common.utils.response import success_response, error_response
from apps.common.throttling import LoginRateThrottle
from apps.accounts.permissions.is_admin import IsAdmin
from apps.accounts.models.user import User
from apps.accounts.serializers.admin_auth_serializer import AdminLoginSerializer
from apps.accounts.serializers.student_auth_serializer import StudentProfileSerializer


class AdminLoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    @extend_schema(request=AdminLoginSerializer)
    def post(self, request):
        serializer = AdminLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        query = serializer.validated_data["username_or_email"].strip().lower()
        password = serializer.validated_data["password"]

        try:
            user = User.objects.get(Q(email__iexact=query) | Q(username__iexact=query))
        except User.DoesNotExist:
            return error_response(message="Invalid administrator credentials.", status_code=status.HTTP_401_UNAUTHORIZED)

        if not user.check_password(password):
            return error_response(message="Invalid administrator credentials.", status_code=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return error_response(message="Administrator account is inactive.", status_code=status.HTTP_403_FORBIDDEN)

        # STRICT ADMIN ROLE CHECK: Reject non-staff / student accounts
        if not user.is_admin_role:
            return error_response(
                message="Access denied. Only authorized administrators may log in here.",
                status_code=status.HTTP_403_FORBIDDEN,
            )

        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        refresh["email"] = user.email
        refresh["is_admin"] = True

        tokens = {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }

        return success_response(
            data={
                "user": StudentProfileSerializer(user).data,
                "tokens": tokens,
            },
            message="Administrator authentication successful.",
        )


class AdminMeView(APIView):
    permission_classes = [IsAdmin]

    @extend_schema(responses={200: StudentProfileSerializer})
    def get(self, request):
        return success_response(
            data=StudentProfileSerializer(request.user).data,
            message="Admin profile retrieved.",
        )
