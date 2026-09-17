from rest_framework import serializers
from apps.challenges.models.challenge import Challenge
from apps.challenges.models.evidence import Evidence
from apps.questions.serializers.question_serializer import PublicQuestionSerializer


class EvidenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Evidence
        fields = [
            "id",
            "artifact_key",
            "label",
            "filename",
            "file_format",
            "content_text",
            "image_url",
            "file_size_display",
        ]


class ChallengeSerializer(serializers.ModelSerializer):
    evidence = EvidenceSerializer(source="evidence_files", many=True, read_only=True)
    questions = serializers.SerializerMethodField()
    resources = serializers.SerializerMethodField()

    class Meta:
        model = Challenge
        fields = [
            "id",
            "challenge_number",
            "slug",
            "name",
            "description",
            "brief",
            "difficulty",
            "duration_minutes",
            "points",
            "passing_percentage",
            "skills",
            "objectives",
            "event",
            "resources",
            "evidence",
            "questions",
            "created_at",
        ]

    def get_resources(self, obj) -> list:
        res = []
        for ev in obj.evidence_files.all():
            res.append({
                "name": ev.filename,
                "type": ev.file_format,
                "size": ev.file_size_display,
                "evidenceId": ev.artifact_key,
            })
        return res

    def get_questions(self, obj) -> list:
        questions = [cq.question for cq in obj.challenge_questions.all().order_by("position")]
        return PublicQuestionSerializer(questions, many=True).data
