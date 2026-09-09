from django.test import TestCase
from apps.questions.models.question import Question
from apps.challenges.models.challenge import Challenge
from apps.challenges.models.challenge_question import ChallengeQuestion
from apps.competition.services.answer_validation_service import (
    AnswerValidationService,
    PARTIAL_MATCH_THRESHOLD,
)
from apps.competition.services.auto_grading_service import AutoGradingService


class AutoGradingEngineTests(TestCase):
    def setUp(self):
        self.q_text = Question.objects.create(
            category=Question.CategoryChoices.PHISHING,
            difficulty=Question.DifficultyChoices.EASY,
            kind=Question.QuestionKindChoices.TEXT,
            question_text="What is the spoofed domain?",
            correct_answer="payroll-secure-verify.com",
            default_points=10,
        )
        self.q_mcq = Question.objects.create(
            category=Question.CategoryChoices.SIEM,
            difficulty=Question.DifficultyChoices.MEDIUM,
            kind=Question.QuestionKindChoices.MCQ,
            question_text="What level alert is critical in Wazuh?",
            options_json=["Level 3", "Level 7", "Level 12", "Level 15"],
            correct_option_index=3,
            correct_answer="Level 15",
            default_points=20,
        )

        self.challenge = Challenge.objects.create(
            challenge_number=1,
            slug="phishnet",
            name="Operation PhishNet",
            description="Phishing scenario",
            brief="Analyze suspicious email headers",
            difficulty=Challenge.DifficultyChoices.EASY,
            duration_minutes=20,
            points=30,
        )
        ChallengeQuestion.objects.create(challenge=self.challenge, question=self.q_text, position=1)
        ChallengeQuestion.objects.create(challenge=self.challenge, question=self.q_mcq, position=2)

    def test_text_answer_validation_case_and_whitespace_insensitive(self):
        is_corr, score, _ = AnswerValidationService.validate_answer(self.q_text, "  PAYROLL-SECURE-VERIFY.COM  ")
        self.assertTrue(is_corr)
        self.assertEqual(score, 1.0)

    def test_mcq_answer_validation(self):
        is_corr_idx, score1, _ = AnswerValidationService.validate_answer(self.q_mcq, 3)
        self.assertTrue(is_corr_idx)
        self.assertEqual(score1, 1.0)

        is_corr_str, score2, _ = AnswerValidationService.validate_answer(self.q_mcq, "Level 15")
        self.assertTrue(is_corr_str)
        self.assertEqual(score2, 1.0)

    def test_full_challenge_auto_grading(self):
        submitted = {
            str(self.q_text.id): "payroll-secure-verify.com",
            str(self.q_mcq.id): 3,
        }
        result = AutoGradingService.grade_submission(self.challenge, submitted)
        self.assertEqual(result["score_earned"], 30)
        self.assertEqual(result["max_possible_score"], 30)
        self.assertTrue(result["is_passing"])
        self.assertEqual(len(result["evaluation_logs"]), 2)

    def test_empty_submission_scores_zero(self):
        """Regression: submitting with no answers must award 0 points."""
        for submitted in ({}, {"__ignored__": ""}, {str(self.q_text.id): "", str(self.q_mcq.id): None}):
            result = AutoGradingService.grade_submission(self.challenge, submitted)
            self.assertEqual(result["score_earned"], 0, f"Empty submission {submitted} must score 0")
            self.assertEqual(result["max_possible_score"], 30)
            self.assertFalse(result["is_passing"])
            for log in result["evaluation_logs"]:
                self.assertFalse(log["is_correct"])
                self.assertEqual(log["points_earned"], 0)
    def test_tech_normalization_timezone_and_labels(self):
        """Near-exact technical answers (timestamps, IPs, hostnames) score full
        marks without hand-enumerated alternatives in the answer key."""
        cases = [
            ("09:10:22 UTC", "09:10:22"),          # timezone suffix stripped
            ("09:10:22 +05:30", "09:10:22"),        # numeric offset stripped
            ("IP: 10.0.4.25", "10.0.4.25"),         # field label stripped
            ("http://mail-cdn.net", "mail-cdn.net"),  # protocol stripped
            ("host: srv-01.", "srv-01"),            # label + trailing punctuation
        ]
        for provided, key in cases:
            q = Question.objects.create(
                category=Question.CategoryChoices.PHISHING,
                difficulty=Question.DifficultyChoices.EASY,
                kind=Question.QuestionKindChoices.TEXT,
                question_text="Technical detail?",
                correct_answer=key,
                default_points=10,
            )
            is_corr, score, _ = AnswerValidationService.validate_answer(q, provided)
            self.assertTrue(is_corr, f"'{provided}' should match key '{key}'")
            self.assertEqual(score, 1.0)

    def test_fuzzy_free_text_full_and_partial_credit(self):
        """Long-form answers earn full credit at >=80% token overlap, and
        proportional credit (the similarity percentage itself) between 50%
        and 80%, using difflib — no new dependencies."""
        q = Question.objects.create(
            category=Question.CategoryChoices.PHISHING,
            difficulty=Question.DifficultyChoices.MEDIUM,
            kind=Question.QuestionKindChoices.TEXT,
            question_text="Should the AI containment recommendation be trusted?",
            correct_answer=(
                "No, treat it as advisory only because the model missed the "
                "credential harvesting domain and the analyst must verify "
                "indicators before isolating the host"
            ),
            default_points=25,
        )
        # Full credit: covers all key concepts in different wording order.
        full = (
            "The analyst must verify indicators before isolating the host; "
            "the model missed the credential harvesting domain so treat it "
            "as advisory only"
        )
        is_corr, score, _ = AnswerValidationService.validate_answer(q, full)
        self.assertTrue(is_corr)
        self.assertEqual(score, 1.0)

        # Partial credit: roughly half the meaningful tokens present.
        partial = (
            "treat it as advisory only because the model missed the "
            "credential harvesting domain"
        )
        # Proportional partial credit: the multiplier equals the similarity
        # percentage to the key (between PARTIAL_MATCH_THRESHOLD and full).
        is_corr_p, score_p, _ = AnswerValidationService.validate_answer(q, partial)
        self.assertFalse(is_corr_p)
        self.assertGreaterEqual(score_p, PARTIAL_MATCH_THRESHOLD)
        self.assertLess(score_p, 1.0)

        # Garbage must not earn fuzzy credit.
        is_corr_g, score_g, _ = AnswerValidationService.validate_answer(q, "yes maybe totally")
        self.assertFalse(is_corr_g)
        self.assertEqual(score_g, 0.0)
