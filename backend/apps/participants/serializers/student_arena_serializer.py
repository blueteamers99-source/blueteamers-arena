from rest_framework import serializers
from apps.common.utils.validators import validate_name


class VerifyEventRequestSerializer(serializers.Serializer):
    code = serializers.CharField(required=True)


class VerifyEventResponseSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    college_name = serializers.CharField()
    workshop_name = serializers.CharField()
    event_code = serializers.CharField()
    status = serializers.CharField()
    duration_minutes = serializers.IntegerField()
    passing_score = serializers.IntegerField()
    total_challenges = serializers.IntegerField()
    remaining_slots = serializers.IntegerField(default=100)


class RegisterStudentRequestSerializer(serializers.Serializer):
    event_id = serializers.UUIDField(required=True)
    name = serializers.CharField(required=True, max_length=150, validators=[validate_name])
    email = serializers.EmailField(required=True)


class RegisterStudentResponseSerializer(serializers.Serializer):
    participant_token = serializers.CharField()
    participant = serializers.DictField()
    event = serializers.DictField()
