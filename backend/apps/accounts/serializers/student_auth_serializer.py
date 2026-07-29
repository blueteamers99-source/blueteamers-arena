from rest_framework import serializers
from apps.accounts.models.user import User


class StudentSignupSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255)
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    confirm_password = serializers.CharField(min_length=8, write_only=True)
    college = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    department = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")

    def validate_username(self, value):
        val = value.strip().lower()
        if User.objects.filter(username__iexact=val).exists():
            raise serializers.ValidationError("This username is already taken.")
        return val

    def validate_email(self, value):
        val = value.strip().lower()
        if User.objects.filter(email__iexact=val).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return val

    def validate(self, attrs):
        if attrs.get("password") != attrs.get("confirm_password"):
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs


class StudentLoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(help_text="Email or Username")
    password = serializers.CharField(write_only=True)
    remember_me = serializers.BooleanField(default=False, required=False)


class GoogleAuthSerializer(serializers.Serializer):
    credential = serializers.CharField(help_text="Google OAuth ID Token or Access Token")
    email = serializers.EmailField(required=False)
    name = serializers.CharField(required=False)


class StudentProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "full_name",
            "college",
            "department",
            "phone_number",
            "role",
            "is_email_verified",
            "created_at",
        ]
        read_only_fields = ["id", "email", "role", "is_email_verified", "created_at"]
