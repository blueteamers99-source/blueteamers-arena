from typing import Dict, Any, List
from rest_framework.exceptions import ValidationError
from apps.challenges.models.challenge import Challenge
from apps.questions.models.question import Question
from apps.competition.services.answer_validation_service import AnswerValidationService


class AutoGradingService:
    """
    Auto-Grading Engine for evaluating student challenge submissions.
    """
    @staticmethod
    def grade_submission(challenge: Challenge, submitted_answers: Dict[str, Any]) -> Dict[str, Any]:
        challenge_questions = challenge.challenge_questions.select_related("question").order_by("position")

        if not challenge_questions.exists():
            raise ValidationError(
                f"Challenge '{challenge.name}' has no questions linked. Cannot grade submission."
            )

        total_score_earned = 0
        linked_points_total = 0
        evaluation_logs = []

        for cq in challenge_questions:
            q = cq.question
            linked_points_total += q.default_points

            student_ans = submitted_answers.get(str(q.id))
            if student_ans is None:
                # Try lookup by position or index
                student_ans = submitted_answers.get(f"q{cq.position}")

            # Explicit guard: unanswered / blank answers are always graded as
            # incorrect and award 0 points (bug fix: empty submissions must
            # never earn points).
            if student_ans is None or (isinstance(student_ans, str) and not student_ans.strip()):
                evaluation_logs.append({
                    "question_id": str(q.id),
                    "position": cq.position,
                    "category": q.category,
                    "default_points": q.default_points,
                    "points_earned": 0,
                    "is_correct": False,
                    "score_multiplier": 0.0,
                    "feedback_note": "No answer provided. Marked as incorrect.",
                })
                continue

            is_correct, score_multiplier, note = AnswerValidationService.validate_answer(q, student_ans)
            # round() instead of int() so the awarded points match the
            # multiplier fairly (int() would truncate 25 * 0.67 = 16.75 to 16).
            points_earned = round(q.default_points * score_multiplier)
            total_score_earned += points_earned

            evaluation_logs.append({
                "question_id": str(q.id),
                "position": cq.position,
                "category": q.category,
                "default_points": q.default_points,
                "points_earned": points_earned,
                "is_correct": is_correct,
                "score_multiplier": score_multiplier,
                "feedback_note": note,
            })

        # Authoritative challenge maximum: use Challenge.points so the max is a
        # fixed, per-challenge value identical for every participant - it must
        # never drift with whatever questions happen to be linked (that caused
        # different users to see e.g. 170 vs 100 for the same PhishNet challenge).
        # Fall back to the linked-question total only if the challenge has no
        # points configured.
        max_possible_score = (getattr(challenge, "points", None) or 0) or linked_points_total
        # Invariant: a submission can never award more than the maximum.
        total_score_earned = min(total_score_earned, max_possible_score)

        passing_pct = getattr(challenge, 'passing_percentage', 60) or 60
        passing_threshold = int(max_possible_score * (passing_pct / 100))
        is_passing = total_score_earned >= passing_threshold

        return {
            "score_earned": total_score_earned,
            "max_possible_score": max_possible_score,
            "is_passing": is_passing,
            "evaluation_logs": evaluation_logs,
        }
