import re
from difflib import SequenceMatcher
from typing import Dict, Any, Tuple
from apps.questions.models.question import Question

# Similarity thresholds for free-text answers:
#  - score >= FULL_MATCH_THRESHOLD  -> full credit (1.0)
#  - score >= PARTIAL_MATCH_THRESHOLD -> proportional credit (the similarity
#    percentage itself, e.g. a 0.63 match earns a 0.63 multiplier)
#  - below -> 0.0
FULL_MATCH_THRESHOLD = 0.80
PARTIAL_MATCH_THRESHOLD = 0.50

# Common "filler" tokens ignored during fuzzy token-overlap scoring. These
# appear in nearly every long answer ("the host was...") and would otherwise
# inflate similarity for guesses that share only sentence structure.
FUZZY_STOPWORDS = frozenset({
    "a", "an", "the", "was", "were", "is", "are", "of", "to", "in", "on",
    "and", "or", "with", "for", "by", "at", "from", "that", "this", "it",
    "as", "be", "been", "being", "has", "have", "had", "which", "what",
})

# Patterns of technical "wrapper" text that should not affect matching:
# e.g. "http://", "https://", "port 443", trailing punctuation, timezone
# suffixes ("UTC", "GMT", "+05:30"), "IP: x.x.x.x", etc.
_TECH_DECORATION_PATTERNS = [
    r"^(?:https?|ftp)://",            # optional URL scheme
    r"\b(?:utc|gmt|z|ist)\b",          # timezone suffixes
    r"[+-]\d{2}:?\d{2}\b",             # timezone offsets (+05:30 / -0700)
    r"\b(?:ip|ip addr(?:ess)?|host|hostname|port|user(?:name)?|account|domain|url|file(?:name)?|path)\s*[:=]\s*",  # field labels
    r"[.\-_:,;]+$",                    # trailing punctuation per token
]


def _strip_tech_decorations(token: str) -> str:
    """Remove wrapper text (protocols, labels, timezones, punctuation) from a token."""
    out = token
    for pattern in _TECH_DECORATION_PATTERNS:
        prev = None
        # Repeatedly apply the same pattern (e.g. "ip: http://x" needs two passes)
        while prev != out:
            prev = out
            out = re.sub(pattern, "", out, flags=re.IGNORECASE)
    # Strip leftover punctuation only AFTER all patterns have run, so a
    # trailing ":" is consumed by the field-label pattern instead of being
    # stripped early (which would leave "IP" and break label matching).
    return out.strip(" .,:;-_")


class AnswerValidationService:
    """
    Validation engine for comparing student answers against Question ground truth keys.
    Supports case-insensitive string matching, whitespace trimming,
    keyword substring checking (partial credit), and MCQ exact index matching.
    """
    @staticmethod
    def normalize(text: str) -> str:
        if not text:
            return ""
        return text.strip().lower()

    @classmethod
    def validate_answer(cls, question: Question, student_answer: Any) -> Tuple[bool, float, str]:
        """
        Validates student answer against question configuration.
        Returns Tuple[is_correct: bool, score_multiplier: float, feedback_note: str]
        """
        if question.kind == Question.QuestionKindChoices.MCQ:
            return cls._validate_mcq(question, student_answer)
        else:
            return cls._validate_text(question, student_answer)

    @classmethod
    def _validate_mcq(cls, question: Question, student_answer: Any) -> Tuple[bool, float, str]:
        target_idx = question.correct_option_index
        target_str = cls.normalize(question.correct_answer)

        # Check if student passed an integer index or index string
        if isinstance(student_answer, int) or (isinstance(student_answer, str) and student_answer.isdigit()):
            selected_idx = int(student_answer)
            if target_idx is not None and selected_idx == target_idx:
                return True, 1.0, "Correct MCQ selection!"
            return False, 0.0, "Incorrect MCQ selection."

        # Check if student passed the option string
        provided_str = cls.normalize(str(student_answer))
        if target_str and provided_str == target_str:
            return True, 1.0, "Correct MCQ selection!"

        # Check in options_json if target_idx is valid
        if target_idx is not None and 0 <= target_idx < len(question.options_json):
            expected_option_str = cls.normalize(str(question.options_json[target_idx]))
            if provided_str == expected_option_str:
                return True, 1.0, "Correct MCQ selection!"

        return False, 0.0, "Incorrect MCQ selection."

    @classmethod
    def _validate_text(cls, question: Question, student_answer: Any) -> Tuple[bool, float, str]:
        provided = cls.normalize(str(student_answer or ""))
        target = cls.normalize(question.correct_answer)

        if not provided:
            return False, 0.0, "No answer provided."

        # 1. Direct exact match (case-insensitive & trimmed)
        if provided == target:
            return True, 1.0, "Exact match!"

        # 1b. Technical normalization: strip wrapper text (URL schemes,
        # "IP:"/"host:"/"port:" field labels, timezone suffixes like
        # "UTC"/"+05:30", trailing punctuation) from BOTH sides before a
        # second exact comparison. This lets "09:10:22 UTC", "185.220.101.32."
        # and "IP: 185.220.101.32" all match a key of "09:10:22" /
        # "185.220.101.32" without hand-listing every variant with "|".
        provided_tech = cls._tech_normalize(provided)
        target_tech = cls._tech_normalize(target)
        if provided_tech and provided_tech == target_tech:
            return True, 1.0, "Correct (matched after normalizing technical formatting)!"

        # 2. Exact whole-word keyword matching (if target is a comma-separated
        # list of keywords). Word boundaries (\b) ensure whole tokens only:
        # "mal" will NOT match inside "malware", but "malware" WILL match the
        # keyword "malware" in a key like "malware, phishing".
        keywords = [k.strip().lower() for k in target.split(",") if k.strip()]
        if len(keywords) > 1:
            matched = [k for k in keywords if re.search(r'\b' + re.escape(k) + r'\b', provided)]
            if len(matched) == len(keywords):
                return True, 1.0, "Matched all required keywords!"
            elif len(matched) > 0:
                # Partial credit: proportional to the percentage of keywords
                # matched. is_correct stays False — only a full match counts
                # as correct — but the fractional multiplier still awards
                # points via AutoGradingService. The note deliberately does
                # NOT reveal how many keywords matched (prevents using the
                # feedback as a brute-force oracle against the answer key).
                credit = round(len(matched) / len(keywords), 2)
                return False, credit, "Partially correct — some required keywords matched."

        # 3. Fuzzy free-text matching (token-overlap + string similarity).
        # For long-form answers (sentence-length keys), require a similarity
        # ratio of at least FULL_MATCH_THRESHOLD (0.80) for full credit.
        # Matches between PARTIAL_MATCH_THRESHOLD (0.50) and 0.80 earn
        # PROPORTIONAL credit: the score multiplier equals the similarity
        # percentage itself (e.g. a 63% match to the key earns a 0.63
        # multiplier), so partial answers are rewarded in direct proportion
        # to how much of the key they reproduce. Short technical answers
        # (single token, e.g. an IP) are excluded — they must match exactly
        # via rules 1/1b to avoid awarding credit for garbage input.
        fuzzy_score = cls._fuzzy_similarity(provided_tech or provided, target_tech or target)
        if fuzzy_score >= FULL_MATCH_THRESHOLD:
            return True, 1.0, "Correct (semantically equivalent answer)!"
        if fuzzy_score >= PARTIAL_MATCH_THRESHOLD:
            proportional_credit = round(fuzzy_score, 2)
            return False, proportional_credit, "Partially correct — the answer partially matches the key."

        return False, 0.0, "Incorrect answer."

    @staticmethod
    def _tech_normalize(text: str) -> str:
        """
        Normalize a technical answer: collapse whitespace, split into tokens,
        strip wrapper text (protocols, field labels, timezone markers,
        punctuation) from each token, then rejoin. Returns "" if nothing
        remains (meaning the input was pure wrapper text).
        """
        tokens = text.split()
        cleaned = [t for t in (_strip_tech_decorations(tok) for tok in tokens) if t]
        return " ".join(cleaned)

    @staticmethod
    def _fuzzy_similarity(provided: str, target: str) -> float:
        """
        Similarity between two free-text answers in [0.0, 1.0].

        Blends two signals (only for targets of >= 3 meaningful tokens):
          1. Token overlap: Jaccard-style |provided ∩ target| / |target| over
             non-stopword tokens (after tech normalization).
          2. Sequence ratio: difflib.SequenceMatcher on the joined text,
             robust to word-order and small typos.
        Returns max(token_overlap, sequence_ratio).
        """
        target_tokens = [t for t in target.split() if t not in FUZZY_STOPWORDS]
        if len(target_tokens) < 3:
            # Short/technical target — exact matching rules above are the
            # source of truth; fuzzy would be too permissive.
            return 0.0

        provided_tokens = [t for t in provided.split() if t not in FUZZY_STOPWORDS]
        if not provided_tokens:
            return 0.0

        # Token overlap: fraction of the answer-key's meaningful tokens
        # present in the student's answer (order-independent).
        overlap = len(set(provided_tokens) & set(target_tokens)) / len(set(target_tokens))

        # Sequence ratio: overall string similarity (typos, word order).
        ratio = SequenceMatcher(None, " ".join(provided_tokens), " ".join(target_tokens)).ratio()

        return max(overlap, ratio)
