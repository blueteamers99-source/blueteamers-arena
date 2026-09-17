from django.contrib import admin
from apps.submissions.models.submission import Submission


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ("participant", "challenge", "score_earned", "max_possible_score_display", "is_passing", "submitted_at")
    list_filter = ("is_passing", "challenge")
    search_fields = ("participant__name", "participant__email", "challenge__name")
    ordering = ("-submitted_at",)

    @admin.display(description="max_possible_score", ordering="challenge__points")
    def max_possible_score_display(self, obj):
        # Show the fixed per-challenge maximum (Challenge.points) instead of the
        # stored value, so the admin table is consistent across all users/events.
        return obj.challenge.points if obj.challenge_id else obj.max_possible_score
