from rest_framework import serializers
from apps.notifications.models.notification import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "title",
            "message",
            "notification_type",
            "priority",
            "is_read",
            "read_at",
            "action_url",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "read_at"]


class BroadcastNotificationSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    message = serializers.CharField()
    priority = serializers.ChoiceField(choices=Notification.PriorityChoices.choices, default=Notification.PriorityChoices.HIGH)
    action_url = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
