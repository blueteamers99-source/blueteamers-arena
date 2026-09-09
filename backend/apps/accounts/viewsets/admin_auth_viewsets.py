from django.db.models import Q
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema
from apps.common.utils.response import success_response, error_response
from apps.common.throttling import AdminLoginRateThrottle, FailedLoginThrottle
from apps.accounts.permissions.is_admin import IsAdmin
from apps.accounts.models.user import User
from apps.accounts.serializers.admin_auth_serializer import AdminLoginSerializer
from apps.accounts.serializers.student_auth_serializer import StudentProfileSerializer


class AdminLoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AdminLoginRateThrottle, FailedLoginThrottle]

    @extend_schema(request=AdminLoginSerializer)
    def post(self, request):
        serializer = AdminLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        query = serializer.validated_data["username_or_email"].strip().lower()
        password = serializer.validated_data["password"]

        # Normalized failure response: identical for every failure to prevent
        # account enumeration (distinct messages/status codes previously leaked
        # whether an account existed, was inactive, or lacked the admin role).
        failure = error_response(
            message="Invalid administrator credentials.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

        try:
            user = User.objects.get(Q(email__iexact=query) | Q(username__iexact=query))
        except User.DoesNotExist:
            user = None

        # When the account does not exist, spend a similar amount of time
        # validating a dummy hash so response timing does not reveal existence.
        if user is None:
            User().set_password("dummy-password-for-timing-normalization")
            User().check_password(password)
            return failure

        if not user.check_password(password) or not user.is_active:
            return failure

        # Role enforcement: credentials are valid but this account is not an
        # administrator. Distinct from 401 so clients can distinguish
        # "wrong password" from "wrong portal" (401 = bad credentials,
        # 403 = valid credentials, insufficient role). Enumeration is still
        # prevented: this branch is only reachable *after* successful
        # password verification.
        if not user.is_admin_role:
            return error_response(
                message="This account does not have administrator access. Use the student portal.",
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
