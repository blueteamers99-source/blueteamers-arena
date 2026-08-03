from rest_framework import serializers
from apps.events.models.event import Event


class EventSerializer(serializers.ModelSerializer):
    participants_count = serializers.SerializerMethodField()
    csv_uploaded_count = serializers.SerializerMethodField()
    arena_joined_count = serializers.SerializerMethodField()
    pending_count = serializers.SerializerMethodField()

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
            "csv_uploaded_count",
            "arena_joined_count",
            "pending_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "event_code",
            "participants_count",
            "csv_uploaded_count",
            "arena_joined_count",
            "pending_count",
            "created_at",
            "updated_at",
        ]

    def get_participants_count(self, obj) -> int:
        if hasattr(obj, "participants"):
            return obj.participants.count()
        return 0

    def get_csv_uploaded_count(self, obj) -> int:
        if hasattr(obj, "approved_students"):
            return obj.approved_students.count()
        return 0

    def get_arena_joined_count(self, obj) -> int:
        return self.get_participants_count(obj)

    def get_pending_count(self, obj) -> int:
        uploaded = self.get_csv_uploaded_count(obj)
        joined = self.get_arena_joined_count(obj)
        return max(0, uploaded - joined)


class VerifyEventCodeSerializer(serializers.Serializer):
    event_code = serializers.CharField(required=False, allow_blank=True)
    code = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        event_code = attrs.get("event_code") or attrs.get("code")
        if not event_code:
            raise serializers.ValidationError({"event_code": "Event code is required."})
        attrs["event_code"] = str(event_code).strip()
        return attrs
