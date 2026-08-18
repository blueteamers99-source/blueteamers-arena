from rest_framework import serializers


class SaveDraftRequestSerializer(serializers.Serializer):
    question_id = serializers.CharField(required=True)
    answer_text = serializers.CharField(required=False, allow_blank=True, default="")
    selected_options = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    selected_option_index = serializers.IntegerField(required=False, allow_null=True, default=None)
    current_question_index = serializers.IntegerField(required=False, default=0)


class SaveProgressBatchRequestSerializer(serializers.Serializer):
    answers = serializers.DictField(required=False, default=dict)
    current_question_index = serializers.IntegerField(required=False, default=0)
    visited_questions = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    remaining_seconds = serializers.IntegerField(required=False, default=0)


class ProgressResponseSerializer(serializers.Serializer):
    challenge_slug = serializers.CharField()
    challenge_id = serializers.CharField(required=False)
    challenge_name = serializers.CharField(required=False)
    status = serializers.CharField()
    current_question_index = serializers.IntegerField()
    visited_questions = serializers.ListField(child=serializers.CharField(), default=list)
    answered_questions = serializers.IntegerField(default=0)
    total_questions = serializers.IntegerField(default=0)
    score_earned = serializers.IntegerField(default=0)
    max_possible_score = serializers.IntegerField(default=100)
    time_limit_seconds = serializers.IntegerField(default=1200)
    remaining_time_seconds = serializers.IntegerField(default=1200)
    draft_answers = serializers.DictField(default=dict)
    answers = serializers.DictField(default=dict)
    started_at = serializers.CharField(allow_null=True)
    last_activity_at = serializers.CharField(allow_null=True)
    completed_at = serializers.CharField(allow_null=True)
