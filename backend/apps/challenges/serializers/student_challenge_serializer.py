from rest_framework import serializers
from apps.challenges.models.challenge import Challenge
from apps.challenges.models.evidence import Evidence
from apps.questions.serializers.question_serializer import PublicQuestionSerializer
from apps.participants.models.participant_progress import ParticipantProgress


class PublicEvidenceSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="artifact_key")
    image = serializers.CharField(source="image_url")

    class Meta:
        model = Evidence
        fields = [
            "id",
            "artifact_key",
            "label",
            "filename",
            "file_format",
            "content_text",
            "image",
            "image_url",
            "file_size_display",
        ]


class StudentChallengeListSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="slug")
    number = serializers.IntegerField(source="challenge_number")
    duration = serializers.IntegerField(source="duration_minutes")
    completed = serializers.SerializerMethodField()
    unlocked = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()

    class Meta:
        model = Challenge
        fields = [
            "id",
            "number",
            "challenge_number",
            "slug",
            "name",
            "description",
            "difficulty",
            "category",
            "points",
            "duration",
            "duration_minutes",
            "skills",
            "completed",
            "unlocked",
        ]

    def get_category(self, obj) -> str:
        first_q = obj.challenge_questions.first()
        if first_q and first_q.question:
            return first_q.question.category
        return "SOC Investigation"

    def get_completed(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not getattr(request, "participant", None):
            return False
        return ParticipantProgress.objects.filter(
            participant=request.participant,
            challenge=obj,
            status=ParticipantProgress.StatusChoices.COMPLETED,
        ).exists()

    def get_unlocked(self, obj) -> bool:
        request = self.context.get("request")
        if not request or not getattr(request, "participant", None):
            return obj.challenge_number == 1
        return True


class StudentChallengeDetailSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source="slug")
    number = serializers.IntegerField(source="challenge_number")
    duration = serializers.IntegerField(source="duration_minutes")
    evidence = PublicEvidenceSerializer(source="evidence_files", many=True, read_only=True)
    questions = serializers.SerializerMethodField()
    resources = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Challenge
        fields = [
            "id",
            "number",
            "challenge_number",
            "slug",
            "name",
            "description",
            "brief",
            "difficulty",
            "category",
            "duration",
            "duration_minutes",
            "points",
            "skills",
            "objectives",
            "resources",
            "evidence",
            "questions",
            "progress",
        ]

    def get_category(self, obj) -> str:
        first_q = obj.challenge_questions.first()
        if first_q and first_q.question:
            return first_q.question.category
        return "SOC Investigation"

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
        res = []
        for pos, cq in enumerate(obj.challenge_questions.all().order_by("position"), start=1):
            q = cq.question
            res.append({
                "id": f"q{pos}",
                "db_id": str(q.id),
                "prompt": q.question_text,
                "kind": q.kind,
                "options": q.options_json if q.kind == "mcq" else [],
                "points": q.default_points,
            })
        return res

    def get_progress(self, obj) -> dict:
        request = self.context.get("request")
        if not request or not getattr(request, "participant", None):
            return {"status": "not_started", "current_question_index": 0, "visited_questions": []}
        
        progress = ParticipantProgress.objects.filter(
            participant=request.participant,
            challenge=obj,
        ).first()
        if not progress:
            return {"status": "not_started", "current_question_index": 0, "visited_questions": []}

        return {
            "status": progress.status,
            "current_question_index": progress.current_question_index,
            "visited_questions": progress.visited_questions,
            "score_earned": progress.score_earned,
        }
