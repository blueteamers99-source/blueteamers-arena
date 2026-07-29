from rest_framework import serializers


class AdminLoginSerializer(serializers.Serializer):
    username_or_email = serializers.CharField(help_text="Admin Username or Email")
    password = serializers.CharField(write_only=True)
    remember_me = serializers.BooleanField(default=False, required=False)
