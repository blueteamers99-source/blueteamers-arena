from typing import Optional
from django.db import models
from django.db.models import QuerySet
from apps.challenges.models.challenge import Challenge


class ChallengeSelector:
    @staticmethod
    def get_by_id(challenge_id: str) -> Optional[Challenge]:
        try:
            return Challenge.objects.get(id=challenge_id)
        except (Challenge.DoesNotExist, ValueError):
            return None

    @staticmethod
    def get_by_slug_or_id(identifier: str) -> Optional[Challenge]:
        if not identifier:
            return None
        # Try slug lookup first
        challenge = Challenge.objects.filter(slug=identifier).first()
        if challenge:
            return challenge
        # Fallback to PK lookup if valid UUID string
        try:
            import uuid
            uuid.UUID(str(identifier))
            return Challenge.objects.filter(id=identifier).first()
        except (ValueError, TypeError, AttributeError):
            return None

    @staticmethod
    def filter_challenges(
        difficulty: Optional[str] = None,
        query: Optional[str] = None,
    ) -> QuerySet[Challenge]:
        qs = Challenge.objects.all().prefetch_related("evidence_files", "challenge_questions__question")
        if difficulty and difficulty != "All":
            qs = qs.filter(difficulty=difficulty)
        if query:
            q = query.strip()
            qs = qs.filter(
                models.Q(name__icontains=q) |
                models.Q(description__icontains=q)
            )
        return qs.order_by("challenge_number")
