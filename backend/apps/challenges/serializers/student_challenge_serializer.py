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
    status = serializers.SerializerMethodField()
    score_earned = serializers.SerializerMethodField()
    answered_questions = serializers.SerializerMethodField()
    remaining_time_seconds = serializers.SerializerMethodField()
    unlocked = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()

    total_participant_score = serializers.SerializerMethodField()

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
            "passing_percentage",
            "skills",
            "status",
            "completed",
            "score_earned",
            "total_participant_score",
            "answered_questions",
            "remaining_time_seconds",
            "unlocked",
        ]

    def get_category(self, obj) -> str:
        first_q = obj.challenge_questions.first()
        if first_q and first_q.question:
            return first_q.question.category
        return "SOC Investigation"

    def _get_progress(self, obj):
        """
        Return the ParticipantProgress for this challenge from the pre-fetched
        cache (populated in ChallengeViewSet.list). Falls back to a DB query
        only when the cache is absent (e.g. when the serializer is used outside
        the list endpoint).
        """
        cache = self.context.get("progress_cache")
        if cache is not None:
            return cache.get(str(obj.id))

        # Fallback: single query (used by detail / non-list endpoints)
        request = self.context.get("request")
        if not request:
            return None
        participant = getattr(request, "participant", None)
        if not participant and request.user:
            participant = getattr(request.user, "participant", None)
        if not participant:
            return None
        return ParticipantProgress.objects.filter(participant=participant, challenge=obj).first()

    def get_status(self, obj) -> str:
        prog = self._get_progress(obj)
        return prog.status if prog else "not_started"

    def get_completed(self, obj) -> bool:
        prog = self._get_progress(obj)
        return prog.status == ParticipantProgress.StatusChoices.COMPLETED if prog else False

    def get_score_earned(self, obj) -> int:
        prog = self._get_progress(obj)
        return prog.score_earned if prog else 0

    def get_answered_questions(self, obj) -> int:
        prog = self._get_progress(obj)
        if not prog or not prog.draft_answers:
            return 0
        return len([k for k, v in prog.draft_answers.items() if v is not None and str(v).strip() != ""])

    def get_remaining_time_seconds(self, obj) -> int:
        # Universal event clock: every challenge reports the SAME remaining
        # time (the event-wide window started on 'Start Challenge').
        request = self.context.get("request")
        participant = getattr(request, "participant", None) if request else None
        if not participant and request and request.user:
            participant = getattr(request.user, "participant", None)
        if not participant:
            event = getattr(obj, "event", None)
            duration_min = getattr(event, "duration_minutes", 150) or 150
            return int(duration_min * 60)
        return participant.get_event_remaining_seconds()

    def get_total_participant_score(self, obj) -> int:
        # Universal score: the participant's accumulated score across the
        # whole event — identical on every challenge.
        request = self.context.get("request")
        participant = getattr(request, "participant", None) if request else None
        if not participant and request and request.user:
            participant = getattr(request.user, "participant", None)
        return participant.score if participant else 0

    def get_unlocked(self, obj) -> bool:
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
    total_participant_score = serializers.SerializerMethodField()

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
            "total_participant_score",
        ]

    def get_category(self, obj) -> str:
        first_q = obj.challenge_questions.first()
        if first_q and first_q.question:
            return first_q.question.category
        return "SOC Investigation"

    def get_total_participant_score(self, obj) -> int:
        # Universal score — the participant's total across the whole event
        request = self.context.get("request")
        participant = getattr(request, "participant", None) if request else None
        if not participant and request and request.user:
            participant = getattr(request.user, "participant", None)
        return participant.score if participant else 0

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
        participant = getattr(request, "participant", None) if request else None
        if not participant and request and request.user:
            participant = getattr(request.user, "participant", None)

        if not participant:
            return {"status": "not_started", "current_question_index": 0, "visited_questions": [], "draft_answers": {}}

        progress = ParticipantProgress.objects.filter(
            participant=participant,
            challenge=obj,
        ).first()
        if not progress:
            return {"status": "not_started", "current_question_index": 0, "visited_questions": [], "draft_answers": {}}

        # Universal event clock — same remaining time across all challenges
        event_remaining = participant.get_event_remaining_seconds()

        return {
            "status": progress.status,
            "current_question_index": progress.current_question_index,
            "visited_questions": progress.visited_questions or [],
            "score_earned": progress.score_earned,
            "remaining_time_seconds": event_remaining,
            "event_remaining_time_seconds": event_remaining,
            "event_started_at": participant.started_at.isoformat() if participant.started_at else None,
            "draft_answers": progress.draft_answers or {},
            "started_at": progress.started_at.isoformat() if progress.started_at else None,
        }
