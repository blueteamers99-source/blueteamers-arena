from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema
from apps.common.utils.response import success_response, error_response
from apps.common.throttling import LoginRateThrottle
from apps.accounts.serializers.student_auth_serializer import (
    StudentSignupSerializer,
    StudentLoginSerializer,
    GoogleAuthSerializer,
    StudentProfileSerializer,
)
from apps.accounts.services.student_auth_service import StudentAuthService
from apps.accounts.services.google_auth_service import GoogleAuthService


class StudentSignupView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=StudentSignupSerializer)
    def post(self, request):
        serializer = StudentSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user, tokens = StudentAuthService.signup_student(serializer.validated_data)
            return success_response(
                data={
                    "user": StudentProfileSerializer(user).data,
                    "tokens": tokens,
                },
                message="Student account created successfully.",
                status_code=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return error_response(message=str(e), status_code=status.HTTP_400_BAD_REQUEST)


class StudentLoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    @extend_schema(request=StudentLoginSerializer)
    def post(self, request):
        serializer = StudentLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user, tokens = StudentAuthService.authenticate_student(
                identifier=serializer.validated_data["identifier"],
                password=serializer.validated_data["password"],
            )
            return success_response(
                data={
                    "user": StudentProfileSerializer(user).data,
                    "tokens": tokens,
                },
                message="Login successful.",
            )
        except ValueError as e:
            return error_response(message=str(e), status_code=status.HTTP_401_UNAUTHORIZED)


class StudentGoogleAuthView(APIView):
    permission_classes = [AllowAny]

    @extend_schema(request=GoogleAuthSerializer)
    def post(self, request):
        serializer = GoogleAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data.get("email") or "google.student@blueteamers.io"
        name = serializer.validated_data.get("name") or "Google Student"

        try:
            user, tokens = GoogleAuthService.authenticate_google_student(email=email, name=name)
            return success_response(
                data={
                    "user": StudentProfileSerializer(user).data,
                    "tokens": tokens,
                },
                message="Google Authentication successful.",
            )
        except ValueError as e:
            return error_response(message=str(e), status_code=status.HTTP_400_BAD_REQUEST)


class StudentProfileUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: StudentProfileSerializer})
    def get(self, request):
        return success_response(
            data=StudentProfileSerializer(request.user).data,
            message="Profile retrieved successfully.",
        )

    @extend_schema(request=StudentProfileSerializer)
    def put(self, request):
        serializer = StudentProfileSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return success_response(
            data=serializer.data,
            message="Profile updated successfully.",
        )
