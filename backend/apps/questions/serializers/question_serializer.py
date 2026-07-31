from rest_framework import serializers
from apps.questions.models.question import Question


class AdminQuestionSerializer(serializers.ModelSerializer):
    """
    Complete Question Serializer for Admin portal (includes correct answer & explanation).
    """
    kind = serializers.CharField(required=False, default="mcq")

    class Meta:
        model = Question
        fields = [
            "id",
            "category",
            "difficulty",
            "kind",
            "question_text",
            "evidence_text",
            "options_json",
            "correct_answer",
            "correct_option_index",
            "explanation",
            "default_points",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_kind(self, value):
        if value:
            val = str(value).lower()
            if val in ["mcq", "text"]:
                return val
        return "mcq"


class PublicQuestionSerializer(serializers.ModelSerializer):
    """
    Public Question Serializer for Student APIs (EXCLUDES correct_answer & explanation).
    """
    prompt = serializers.CharField(source="question_text")
    options = serializers.JSONField(source="options_json")

    class Meta:
        model = Question
        fields = [
            "id",
            "category",
            "difficulty",
            "kind",
            "prompt",
            "options",
            "default_points",
        ]
