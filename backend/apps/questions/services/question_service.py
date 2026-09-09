from typing import Dict, Any
from rest_framework.exceptions import ValidationError
from apps.questions.models.question import Question


class QuestionService:
    @staticmethod
    def create_question(data: Dict[str, Any]) -> Question:
        question_text = data.get("question_text", "").strip()
        if not question_text:
            raise ValidationError({"question_text": ["Question text cannot be empty."]})

        question = Question.objects.create(
            category=data.get("category", Question.CategoryChoices.PHISHING),
            difficulty=data.get("difficulty", Question.DifficultyChoices.EASY),
            kind=data.get("kind", Question.QuestionKindChoices.TEXT),
            question_text=question_text,
            evidence_text=data.get("evidence_text", ""),
            options_json=data.get("options_json", []),
            correct_answer=data.get("correct_answer", ""),
            correct_option_index=data.get("correct_option_index"),
            explanation=data.get("explanation", ""),
            default_points=data.get("default_points", 10),
            status=data.get("status", Question.StatusChoices.PUBLISHED),
        )
        return question
