from rest_framework import serializers


class LeaderboardEntrySerializer(serializers.Serializer):
    rank = serializers.IntegerField()
    participant_id = serializers.CharField()
    name = serializers.CharField()
    email = serializers.CharField()
    college_name = serializers.CharField()
    event_code = serializers.CharField()
    score = serializers.IntegerField()
    completed = serializers.IntegerField()
    time_taken = serializers.CharField()
    is_current_user = serializers.BooleanField()
    is_finished = serializers.BooleanField(default=False)


class LeaderboardResponseSerializer(serializers.Serializer):
    event_code = serializers.CharField()
    college_name = serializers.CharField()
    event_status = serializers.ChoiceField(
        choices=["Upcoming", "Live", "Completed"], allow_blank=True
    )
    is_final = serializers.BooleanField(default=False)
    final_reason = serializers.CharField(allow_null=True, allow_blank=True)
    time_remaining = serializers.IntegerField()
    total_participants = serializers.IntegerField()
    top3_podium = LeaderboardEntrySerializer(many=True)
    winners = LeaderboardEntrySerializer(many=True)
    rankings = LeaderboardEntrySerializer(many=True)
    winner = LeaderboardEntrySerializer(allow_null=True)
    student_position = LeaderboardEntrySerializer(allow_null=True)
    nearby_rankings = LeaderboardEntrySerializer(many=True)