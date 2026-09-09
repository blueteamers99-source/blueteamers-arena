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

    def validate(self, data):
        """
        Ensure MCQ questions have a valid correct_option_index.
        """
        kind = data.get("kind", self.instance.kind if self.instance else "mcq")

        if kind == "mcq":
            correct_idx = data.get("correct_option_index")
            options = data.get("options_json", self.instance.options_json if self.instance else [])

            # Must have a correct_option_index
            if correct_idx is None:
                raise serializers.ValidationError({
                    "correct_option_index": "MCQ questions must specify a correct_option_index."
                })

            # Index must be within valid range
            if not isinstance(correct_idx, int) or correct_idx < 0 or correct_idx >= len(options):
                raise serializers.ValidationError({
                    "correct_option_index": f"Index must be between 0 and {len(options) - 1} (number of options minus 1)."
                })

        return data


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
