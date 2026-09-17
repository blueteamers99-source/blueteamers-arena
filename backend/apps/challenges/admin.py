from django.contrib import admin
from apps.challenges.models.challenge import Challenge
from apps.challenges.models.evidence import Evidence
from apps.challenges.models.challenge_question import ChallengeQuestion


class EvidenceInline(admin.TabularInline):
    model = Evidence
    extra = 1


class ChallengeQuestionInline(admin.TabularInline):
    model = ChallengeQuestion
    extra = 1


@admin.register(Challenge)
class ChallengeAdmin(admin.ModelAdmin):
    list_display = ("challenge_number", "name", "slug", "difficulty", "duration_minutes", "points", "created_at")
    list_filter = ("difficulty",)
    search_fields = ("name", "slug", "description", "brief")
    inlines = [EvidenceInline, ChallengeQuestionInline]
    ordering = ("challenge_number",)


@admin.register(Evidence)
class EvidenceAdmin(admin.ModelAdmin):
    list_display = ("challenge", "position", "label", "artifact_key", "file_format", "filename", "created_at")
    list_filter = ("file_format", "challenge")
    search_fields = ("label", "filename", "artifact_key", "content_text")
    list_editable = ("position",)


@admin.register(ChallengeQuestion)
class ChallengeQuestionAdmin(admin.ModelAdmin):
    list_display = ("challenge", "question", "position", "created_at")
    list_filter = ("challenge",)
    ordering = ("challenge", "position")
