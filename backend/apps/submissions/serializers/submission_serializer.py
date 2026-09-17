from rest_framework import serializers
from apps.submissions.models.submission import Submission


class SubmitAnswersRequestSerializer(serializers.Serializer):
    answers = serializers.DictField(required=True, help_text="Dictionary mapping question_id or position to answer")


class SubmissionSerializer(serializers.ModelSerializer):
    challenge_name = serializers.CharField(source="challenge.name", read_only=True)
    challenge_slug = serializers.CharField(source="challenge.slug", read_only=True)
    max_possible_score = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = [
            "id",
            "challenge_name",
            "challenge_slug",
            "score_earned",
            "max_possible_score",
            "is_passing",
            "evaluation_results",
            "submitted_at",
        ]
        read_only_fields = ["id", "score_earned", "max_possible_score", "is_passing", "evaluation_results", "submitted_at"]

    def get_max_possible_score(self, obj) -> int:
        # Serve the fixed per-challenge maximum from Challenge.points rather than
        # the (historically inconsistent) value frozen on the Submission row, so
        # every user sees the same max for the same challenge.
        if obj.challenge and obj.challenge.points:
            return obj.challenge.points
        return obj.max_possible_score
