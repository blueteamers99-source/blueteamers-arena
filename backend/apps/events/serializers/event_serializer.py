from rest_framework import serializers
from apps.events.models.event import Event


class EventSerializer(serializers.ModelSerializer):
    participants_count = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            "id",
            "college_name",
            "workshop_name",
            "description",
            "event_code",
            "event_date",
            "duration_minutes",
            "passing_score",
            "total_challenges",
            "accent_color",
            "status",
            "banner_image",
            "banner_image_url",
            "registration_open_at",
            "registration_close_at",
            "participants_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "participants_count", "created_at", "updated_at"]

    def get_participants_count(self, obj) -> int:
        if hasattr(obj, "participants"):
            return obj.participants.count()
        return 0


class VerifyEventCodeSerializer(serializers.Serializer):
    code = serializers.CharField(required=True)
