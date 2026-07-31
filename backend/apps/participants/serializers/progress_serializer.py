from rest_framework import serializers


class SaveDraftRequestSerializer(serializers.Serializer):
    question_id = serializers.CharField(required=True)
    answer_text = serializers.CharField(required=False, allow_blank=True, default="")
    selected_options = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    selected_option_index = serializers.IntegerField(required=False, allow_null=True, default=None)
    current_question_index = serializers.IntegerField(required=False, default=0)


class ProgressResponseSerializer(serializers.Serializer):
    challenge_slug = serializers.CharField()
    status = serializers.CharField()
    current_question_index = serializers.IntegerField()
    visited_questions = serializers.ListField(child=serializers.CharField())
    score_earned = serializers.IntegerField()
    draft_answers = serializers.DictField()
    started_at = serializers.CharField(allow_null=True)
    completed_at = serializers.CharField(allow_null=True)
