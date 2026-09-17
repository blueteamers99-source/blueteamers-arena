from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema
from apps.common.utils.response import success_response
from apps.accounts.permissions.is_admin import IsAdmin
from apps.participants.auth.participant_auth import ParticipantTokenAuthentication
from apps.participants.permissions.is_participant import IsParticipant
from apps.challenges.models.challenge import Challenge
from apps.challenges.selectors.challenge_selector import ChallengeSelector
from apps.challenges.services.challenge_service import ChallengeService
from apps.challenges.services.evidence_service import EvidenceService
from apps.challenges.serializers.challenge_serializer import ChallengeSerializer
from apps.challenges.serializers.student_challenge_serializer import (
    StudentChallengeListSerializer,
    StudentChallengeDetailSerializer,
)
from apps.participants.models.participant_progress import ParticipantProgress
from apps.participants.services.progress_service import ProgressService
from apps.submissions.serializers.submission_serializer import (
    SubmissionSerializer,
    SubmitAnswersRequestSerializer,
)


class ChallengeViewSet(viewsets.ModelViewSet):
    queryset = Challenge.objects.all()
    lookup_field = "slug"
    lookup_value_regex = "[^/]+"
    authentication_classes = [ParticipantTokenAuthentication]

    def get_permissions(self):
        # Public browsing — anyone can list/retrieve challenges
        if self.action in ["list", "retrieve"]:
            return [AllowAny()]
        # Student actions — require authentication
        if self.action in ["submit", "start", "save_progress", "progress", "evidence", "review", "reviews"]:
            return [IsParticipant()]
        # Admin-only actions (create, update, destroy, etc.)
        return [IsAdmin()]

    def get_serializer_class(self):
        if self.action == "list":
            return StudentChallengeListSerializer
        elif self.action == "retrieve":
            return StudentChallengeDetailSerializer
        return ChallengeSerializer

    def get_queryset(self):
        difficulty = self.request.query_params.get("difficulty")
        search_query = self.request.query_params.get("search")
        return ChallengeSelector.filter_challenges(difficulty=difficulty, query=search_query)

    def list(self, request, *args, **kwargs):
        """
        Override list to batch-fetch all ParticipantProgress records for the
        authenticated participant in a single query, then pass them into the
        serializer context so that get_status / get_completed / get_score_earned
        / get_answered_questions / get_remaining_time_seconds all read from
        an in-memory dict instead of firing 5 separate queries per challenge.
        """
        queryset = self.filter_queryset(self.get_queryset())

        # --- Batch-fetch progress records (1 query) ---
        participant = getattr(request, "participant", None)
        progress_cache: dict = {}
        if participant:
            progress_qs = ParticipantProgress.objects.filter(
                participant=participant,
                challenge__in=queryset,
            )
            progress_cache = {str(p.challenge_id): p for p in progress_qs}

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(
                page, many=True,
                context={"request": request, "progress_cache": progress_cache},
            )
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(
            queryset, many=True,
            context={"request": request, "progress_cache": progress_cache},
        )
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        slug = kwargs.get("slug")
        challenge = ChallengeSelector.get_by_slug_or_id(slug)
        if not challenge:
            return success_response(message="Challenge not found.", status_code=status.HTTP_404_NOT_FOUND)

        # Event verification check
        participant = getattr(request, "participant", None)
        if not participant and request.user:
            participant = getattr(request.user, "participant", None)

        challenge_event = getattr(challenge, "event", None)
        if participant and challenge_event:
            if getattr(challenge, "event_id", None) != participant.event_id:
                return Response({"success": False, "message": "Forbidden. Cross-event challenge access denied."}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(challenge)
        res_data = {**serializer.data, "success": True, "data": serializer.data, "challenge": serializer.data}
        return Response(res_data, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        from django.db.models import Max
        from django.utils.text import slugify
        import uuid

        raw_data = request.data.copy()
        name = raw_data.get("name") or raw_data.get("title") or "New Challenge"
        raw_data["name"] = name

        desc = raw_data.get("description") or raw_data.get("brief") or "SOC Investigation Scenario"
        raw_data["description"] = desc
        raw_data["brief"] = raw_data.get("brief") or desc

        if "duration" in raw_data and "duration_minutes" not in raw_data:
            raw_data["duration_minutes"] = raw_data["duration"]

        base_slug = slugify(raw_data.get("slug") or name) or "challenge"
        slug = base_slug
        if Challenge.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{uuid.uuid4().hex[:4]}"
        raw_data["slug"] = slug

        if "challenge_number" not in raw_data or not raw_data["challenge_number"]:
            max_num = Challenge.objects.aggregate(m=Max("challenge_number"))["m"] or 0
            raw_data["challenge_number"] = max_num + 1

        serializer = self.get_serializer(data=raw_data)
        if serializer.is_valid():
            challenge = serializer.save()
            return Response(
                {
                    "success": True,
                    "message": f"Challenge '{challenge.name}' created successfully.",
                    "data": serializer.data,
                    "id": str(challenge.id),
                },
                status=status.HTTP_201_CREATED,
            )

        err_msg = " ".join([f"{k}: {v[0] if isinstance(v, list) else v}" for k, v in serializer.errors.items()])
        return Response(
            {"success": False, "message": err_msg or "Validation error.", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    @extend_schema(responses={200: StudentChallengeDetailSerializer})
    @action(detail=True, methods=["get"], url_path="evidence/(?P<artifact_key>[^/.]+)")
    def evidence(self, request, slug=None, artifact_key=None):
        participant = getattr(request, "participant", None)
        if not participant and request.user:
            participant = getattr(request.user, "participant", None)
        if not participant:
            return Response(
                {"success": False, "message": "Authentication required to access evidence."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        challenge = ChallengeSelector.get_by_slug_or_id(slug)
        if not challenge:
            return success_response(message="Challenge not found.", status_code=status.HTTP_404_NOT_FOUND)

        # Cross-event authorization: participant may only access evidence for
        # challenges belonging to their own event (same gate as `submit`).
        challenge_event = getattr(challenge, "event", None)
        if challenge_event and participant.event_id != getattr(challenge, "event_id", None):
            return Response({"success": False, "message": "Forbidden. Cross-event evidence access denied."}, status=status.HTTP_403_FORBIDDEN)

        evidence_data = EvidenceService.get_evidence_for_student(challenge, artifact_key)
        return success_response(data=evidence_data, message="Evidence artifact retrieved.")

    @extend_schema(request=SubmitAnswersRequestSerializer)
    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, slug=None):
        participant = getattr(request, "participant", None)
        if not participant and request.user:
            participant = getattr(request.user, "participant", None)

        if not participant:
            return Response({"success": False, "message": "Participant authentication token required."}, status=status.HTTP_401_UNAUTHORIZED)

        challenge = ChallengeSelector.get_by_slug_or_id(slug)
        if not challenge:
            return Response({"success": False, "message": "Challenge not found."}, status=status.HTTP_404_NOT_FOUND)

        challenge_event = getattr(challenge, "event", None)
        if challenge_event and participant.event_id != getattr(challenge, "event_id", None):
            return Response({"success": False, "message": "Forbidden. Cross-event challenge submission denied."}, status=status.HTTP_403_FORBIDDEN)

        answers = request.data.get("answers") or {}
        result = ProgressService.submit_challenge(participant, challenge, answers_override=answers)
        return Response({
            "success": True,
            "data": result,
            "score_earned": result.get("score_earned", 0),
            "max_possible_score": result.get("max_possible_score", 100),
            "is_passing": result.get("is_passing", False),
            "total_score": participant.score,
            "message": result.get("message", f"Answers for '{challenge.name}' evaluated and submitted successfully!"),
        }, status=status.HTTP_200_OK)

    @extend_schema(responses={200: dict})
    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request, slug=None):
        challenge = ChallengeSelector.get_by_slug_or_id(slug)
        if not challenge:
            return Response({"success": False, "message": "Challenge not found."}, status=status.HTTP_404_NOT_FOUND)

        participant = getattr(request, "participant", None)
        if not participant and request.user:
            participant = getattr(request.user, "participant", None)

        if not participant:
            return Response({
                "success": True,
                "message": f"Challenge '{challenge.name}' started.",
                "challenge_id": str(challenge.slug),
                "status": "in_progress",
            }, status=status.HTTP_200_OK)

        data = ProgressService.start_challenge(participant, challenge)
        return Response({
            "success": True,
            "data": data,
            "message": f"Challenge '{challenge.name}' started successfully.",
            "challenge_id": str(challenge.slug),
            "status": data.get("status", "in_progress"),
            "remaining_time_seconds": data.get("remaining_time_seconds", 1200),
        }, status=status.HTTP_200_OK)

    @extend_schema(responses={200: dict})
    @action(detail=True, methods=["get"], url_path="progress")
    def progress(self, request, slug=None):
        challenge = ChallengeSelector.get_by_slug_or_id(slug)
        if not challenge:
            return Response({"success": False, "message": "Challenge not found."}, status=status.HTTP_404_NOT_FOUND)

        participant = getattr(request, "participant", None)
        if not participant and request.user:
            participant = getattr(request.user, "participant", None)

        if not participant:
            return Response({"success": False, "message": "Participant authentication token required."}, status=status.HTTP_401_UNAUTHORIZED)

        data = ProgressService.get_challenge_progress(participant, challenge)
        return Response({
            "success": True,
            "data": data,
            "message": "Progress retrieved successfully.",
        }, status=status.HTTP_200_OK)

    @extend_schema(responses={200: dict})
    @action(detail=True, methods=["get"], url_path="review")
    def review(self, request, slug=None):
        """
        Returns the student's submitted answers, evaluation results, and correct answers
        for a completed challenge. Used by the Review My Answers page.
        """
        participant = getattr(request, "participant", None)
        if not participant and request.user:
            participant = getattr(request.user, "participant", None)

        if not participant:
            return Response({"success": False, "message": "Participant authentication token required."}, status=status.HTTP_401_UNAUTHORIZED)

        challenge = ChallengeSelector.get_by_slug_or_id(slug)
        if not challenge:
            return Response({"success": False, "message": "Challenge not found."}, status=status.HTTP_404_NOT_FOUND)

        # Verify event access
        challenge_event = getattr(challenge, "event", None)
        if challenge_event and participant.event_id != getattr(challenge, "event_id", None):
            return Response({"success": False, "message": "Forbidden. Cross-event access denied."}, status=status.HTTP_403_FORBIDDEN)

        # Get the submission for this challenge
        from apps.submissions.models.submission import Submission
        submission = Submission.objects.filter(
            participant=participant,
            challenge=challenge,
        ).order_by("-submitted_at").first()

        if not submission:
            return Response({"success": False, "message": "No submission found for this challenge."}, status=status.HTTP_404_NOT_FOUND)

        # Get questions with their details
        from apps.challenges.models.challenge_question import ChallengeQuestion
        challenge_questions = ChallengeQuestion.objects.filter(
            challenge=challenge
        ).select_related("question").order_by("position")

        questions_data = []
        for cq in challenge_questions:
            q = cq.question
            student_answer = submission.answers_json.get(str(q.id))
            if student_answer is None:
                student_answer = submission.answers_json.get(f"q{cq.position}")

            # Find evaluation result for this question
            eval_result = None
            for log in submission.evaluation_results:
                if log.get("question_id") == str(q.id):
                    eval_result = log
                    break

            question_info = {
                "question_id": str(q.id),
                "position": cq.position,
                "question_text": q.question_text,
                "category": q.category,
                "difficulty": q.difficulty,
                "kind": q.kind,
                "options_json": q.options_json if q.kind == "mcq" else [],
                "student_answer": student_answer,
                "correct_answer": q.correct_answer,
                "correct_option_index": q.correct_option_index if q.kind == "mcq" else None,
                "explanation": q.explanation,
                "default_points": q.default_points,
                "points_earned": eval_result.get("points_earned", 0) if eval_result else 0,
                "is_correct": eval_result.get("is_correct", False) if eval_result else False,
                "feedback_note": eval_result.get("feedback_note", "") if eval_result else "",
            }
            questions_data.append(question_info)

        return Response({
            "success": True,
            "data": {
                "challenge_name": challenge.name,
                "challenge_slug": challenge.slug,
                "score_earned": submission.score_earned,
                "max_possible_score": challenge.points or submission.max_possible_score,
                "is_passing": submission.is_passing,
                "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
                "questions": questions_data,
            },
            "message": "Review data retrieved successfully.",
        }, status=status.HTTP_200_OK)

    @extend_schema(responses={200: dict})
    @action(detail=False, methods=["get"], url_path="reviews")
    def reviews(self, request):
        """
        Returns review data for all of the participant's event challenges
        in a single call. Each entry includes the challenge heading, score
        summary, and per-question breakdown. Challenges without a submission
        are included with status "not_completed".
        """
        participant = getattr(request, "participant", None)
        if not participant and request.user:
            participant = getattr(request.user, "participant", None)

        if not participant:
            return Response({"success": False, "message": "Participant authentication token required."}, status=status.HTTP_401_UNAUTHORIZED)

        # Challenges for the participant's event, falling back to global
        # challenges when the event has none linked.
        if participant.event_id:
            challenges = list(Challenge.objects.filter(event_id=participant.event_id).order_by("challenge_number"))
        else:
            challenges = []
        if not challenges:
            challenges = list(Challenge.objects.filter(event__isnull=True).order_by("challenge_number"))

        from apps.submissions.models.submission import Submission
        from apps.challenges.models.challenge_question import ChallengeQuestion

        submissions = {
            str(s.challenge_id): s
            for s in Submission.objects.filter(
                participant=participant,
                challenge__in=challenges,
            ).order_by("-submitted_at")
        }

        challenge_reviews = []
        for challenge in challenges:
            submission = submissions.get(str(challenge.id))
            if not submission:
                challenge_reviews.append({
                    "challenge_number": challenge.challenge_number,
                    "challenge_name": challenge.name,
                    "challenge_slug": challenge.slug,
                    "status": "not_completed",
                    "score_earned": 0,
                    "max_possible_score": challenge.points,
                    "is_passing": False,
                    "submitted_at": None,
                    "questions": [],
                })
                continue

            challenge_questions = ChallengeQuestion.objects.filter(
                challenge=challenge
            ).select_related("question").order_by("position")

            questions_data = []
            for cq in challenge_questions:
                q = cq.question
                student_answer = submission.answers_json.get(str(q.id))
                if student_answer is None:
                    student_answer = submission.answers_json.get(f"q{cq.position}")

                eval_result = None
                for log in submission.evaluation_results:
                    if log.get("question_id") == str(q.id):
                        eval_result = log
                        break

                questions_data.append({
                    "question_id": str(q.id),
                    "position": cq.position,
                    "question_text": q.question_text,
                    "category": q.category,
                    "difficulty": q.difficulty,
                    "kind": q.kind,
                    "options_json": q.options_json if q.kind == "mcq" else [],
                    "student_answer": student_answer,
                    "correct_answer": q.correct_answer,
                    "correct_option_index": q.correct_option_index if q.kind == "mcq" else None,
                    "explanation": q.explanation,
                    "default_points": q.default_points,
                    "points_earned": eval_result.get("points_earned", 0) if eval_result else 0,
                    "is_correct": eval_result.get("is_correct", False) if eval_result else False,
                    "feedback_note": eval_result.get("feedback_note", "") if eval_result else "",
                })

            challenge_reviews.append({
                "challenge_number": challenge.challenge_number,
                "challenge_name": challenge.name,
                "challenge_slug": challenge.slug,
                "status": "completed",
                "score_earned": submission.score_earned,
                "max_possible_score": challenge.points or submission.max_possible_score,
                "is_passing": submission.is_passing,
                "submitted_at": submission.submitted_at.isoformat() if submission.submitted_at else None,
                "questions": questions_data,
            })

        return Response({
            "success": True,
            "data": {
                "challenges": challenge_reviews,
            },
            "message": "All challenge reviews retrieved successfully.",
        }, status=status.HTTP_200_OK)

    @extend_schema(responses={200: dict})
    @action(detail=True, methods=["post", "put", "patch"], url_path="save-progress")
    def save_progress(self, request, slug=None):
        challenge = ChallengeSelector.get_by_slug_or_id(slug)
        if not challenge:
            return Response({"success": False, "message": "Challenge not found."}, status=status.HTTP_404_NOT_FOUND)

        participant = getattr(request, "participant", None)
        if not participant and request.user:
            participant = getattr(request.user, "participant", None)

        if not participant:
            return Response({"success": False, "message": "Participant authentication token required."}, status=status.HTTP_401_UNAUTHORIZED)

        answers = request.data.get("answers") or {}
        curr_idx = request.data.get("current_question_index", 0)
        visited = request.data.get("visited_questions", [])

        data = ProgressService.save_batch_progress(
            participant=participant,
            challenge=challenge,
            answers=answers,
            current_question_index=curr_idx,
            visited_questions=visited,
        )

        return Response({
            "success": True,
            "data": data,
            "saved": True,
            "message": "Challenge progress saved successfully.",
        }, status=status.HTTP_200_OK)
