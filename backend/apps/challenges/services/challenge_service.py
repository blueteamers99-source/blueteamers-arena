from typing import Dict, Any
from rest_framework.exceptions import ValidationError
from apps.challenges.models.challenge import Challenge
from apps.challenges.models.evidence import Evidence


class ChallengeService:
    @staticmethod
    def create_challenge(data: Dict[str, Any]) -> Challenge:
        slug = data.get("slug", "").strip()
        if Challenge.objects.filter(slug=slug).exists():
            raise ValidationError({"slug": ["A challenge with this slug already exists."]})

        challenge = Challenge.objects.create(
            challenge_number=data.get("challenge_number", 1),
            slug=slug,
            name=data.get("name", ""),
            description=data.get("description", ""),
            brief=data.get("brief", ""),
            difficulty=data.get("difficulty", Challenge.DifficultyChoices.EASY),
            duration_minutes=data.get("duration_minutes", 20),
            points=data.get("points", 100),
            skills=data.get("skills", []),
            objectives=data.get("objectives", []),
        )
        return challenge

    @staticmethod
    def add_evidence(challenge: Challenge, artifact_key: str, label: str, filename: str, file_format: str, content_text: str = "", image_url: str = "", position: int | None = None) -> Evidence:
        defaults = {
            "label": label,
            "filename": filename,
            "file_format": file_format,
            "content_text": content_text,
            "image_url": image_url,
        }
        if position is not None:
            defaults["position"] = position
        evidence, _ = Evidence.objects.update_or_create(
            challenge=challenge,
            artifact_key=artifact_key,
            defaults=defaults,
        )
        return evidence
