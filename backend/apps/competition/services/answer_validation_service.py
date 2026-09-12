import re
from difflib import SequenceMatcher
from typing import Dict, Any, Tuple
from apps.questions.models.question import Question

# Similarity thresholds for free-text answers:
#  - score >= FULL_MATCH_THRESHOLD  -> full credit (1.0)
#  - score >= MIN_PARTIAL_SCORE     -> proportional credit (the blended
#    similarity percentage itself, e.g. a 0.63 match earns a 0.63 multiplier)
#  - below MIN_PARTIAL_SCORE        -> 0.0 (noise floor: only real overlap earns)
FULL_MATCH_THRESHOLD = 0.80
# Kept as the historical lower bound of the old proportional band; tests and
# callers import it for compatibility. MIN_PARTIAL_SCORE now governs the band.
PARTIAL_MATCH_THRESHOLD = 0.50
MIN_PARTIAL_SCORE = 0.40

# Relative weights of the three similarity signals blended into a single score:
#  - facts:  fraction of comma-separated key components the answer fully covers
#            (precision-heavy; a component counts only when wholly present)
#  - tokens: Jaccard-style non-stopword token overlap (order-independent)
#  - edit:   typo-tolerant token coverage (same wording, small typos forgiven;
#            order-independent, so it cannot drag down a complete reordering)
WEIGHT_FACTS = 0.5
WEIGHT_TOKENS = 0.3
WEIGHT_EDIT = 0.2

# A target token counts as "matched with an edit" only when the answer holds a
# token at least this similar (rescues one/two-character typos like "isolting")
# and the token is long enough that near-matches are rare for short values.
TYPO_MATCH_THRESHOLD = 0.85
TYPO_MIN_TOKEN_LEN = 4

# A comma-separated key is treated as a "fact list" only when every part is a
# short, discrete component (<= MAX_FACT_TOKENS). Longer comma-delimited parts
# are prose (e.g. "No, treat it as advisory only because ... the host") and are
# scored by token/edit similarity instead — otherwise a single long clause would
# dominate the facts signal.
MAX_FACT_TOKENS = 6

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
    Supports case-insensitive string matching, whitespace trimming, "|"-separated
    key alternatives, partial credit (blended fact/token/edit similarity), and MCQ
    exact index matching.
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

        # 2. Technical-normalized exact match, evaluated against each
        # "|"-separated alternative in the key (e.g. "09:10:22 UTC|09:10:22",
        # "backup.zip|backup.zip — containing ..."). Any single alternative
        # may be answered with wrapper text stripped (timezones, "IP:"/"host:"
        # labels, trailing punctuation).
        provided_tech = cls._tech_normalize(provided)
        alternatives = [alt.strip() for alt in target.split("|") if alt.strip()] or [target]
        for alt in alternatives:
            alt_tech = cls._tech_normalize(alt)
            if alt_tech and provided_tech == alt_tech:
                return True, 1.0, "Correct (matched after normalizing technical formatting)!"

        # 3. Blended similarity score. A single score in [0.0, 1.0] inferred
        # from the key itself — fraction of comma-separated facts covered,
        # non-stopword token overlap, and edit-distance ratio (see
        # _blended_score). >= 80% earns full credit; 40%-80% earns proportional
        # credit (the percentage itself: 0.63 -> a 0.63 multiplier); below the
        # floor scores 0. The note deliberately does NOT reveal how many facts
        # matched, preventing the feedback from being used as a brute-force
        # oracle against the key.
        blended = cls._blended_score(provided, target)
        if blended >= FULL_MATCH_THRESHOLD:
            return True, 1.0, "Correct (semantically equivalent answer)!"
        if blended >= MIN_PARTIAL_SCORE:
            return False, round(blended, 2), "Partially correct — the answer partially matches the key."

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
    def _meaningful_tokens(text: str) -> list:
        """Non-stopword tokens of a (already tech-normalized) string."""
        return [t for t in text.split() if t not in FUZZY_STOPWORDS]

    @staticmethod
    def _comma_facts(target: str) -> list:
        """Return the raw parts of a comma-separated key when it looks like a
        fact list (>= 2 short, discrete components). Longer comma-delimited
        parts are prose (e.g. "No, treat it as advisory only because ... the
        host") and exclude the whole key — the facts signal must not be
        dominated by a single long clause."""
        parts = [part.strip() for part in target.split(",") if part.strip()]
        if len(parts) < 2:
            return []
        for part in parts:
            tokens = AnswerValidationService._meaningful_tokens(part)
            if not tokens or len(tokens) > MAX_FACT_TOKENS:
                return []
        return parts

    @staticmethod
    def _fact_matched(part: str, part_tokens: list, provided: str, provided_tokens: list) -> bool:
        """A key component is covered when it appears verbatim (whole-word) or
        every meaningful token of it is present in the answer (order-independent
        and tolerant of extra/reordered wording)."""
        if re.search(r"\b" + re.escape(part) + r"\b", provided):
            return True
        if not part_tokens:
            return False
        provided_set = set(provided_tokens)
        return all(token in provided_set for token in part_tokens)

    @staticmethod
    def _edit_coverage(provided_tokens: list, target_tokens: list) -> float:
        """Fraction of the key's tokens the answer reproduces, forgiving small
        typos. A target token counts when the answer holds an identical token
        (covered by token overlap anyway) or a token within a tight edit
        distance. Order-independent, so reordering a complete answer cannot
        lower the score (unlike a whole-string SequenceMatcher ratio)."""
        if not target_tokens:
            return 0.0
        target_set = set(target_tokens)
        if not provided_tokens:
            return 0.0
        covered = 0
        for token in target_set:
            if len(token) < TYPO_MIN_TOKEN_LEN:
                continue  # short keys (IPs, "c2") must match exactly
            for provided in set(provided_tokens):
                if SequenceMatcher(None, token, provided).ratio() >= TYPO_MATCH_THRESHOLD:
                    covered += 1
                    break
        return covered / len(target_set)

    @classmethod
    def _score_candidate(cls, provided: str, provided_tokens: list, target: str) -> float:
        """Blend the applicable similarity signals against a single key
        alternative into one score in [0.0, 1.0].

          1. Facts:   coverage of comma-separated components (precision-heavy;
                      a component counts only when the answer contains it
                      wholly, so low gaming risk).
          2. Tokens:  Jaccard-style |answer ∩ key| / |key| over non-stopword
                      tokens after tech normalization (order-independent).
          3. Edit:    typo-tolerant token coverage (same wording with small
                      typos forgiven; order-independent).

        Signals that do not apply (short/technical keys with < 3 tokens, or
        prose keys that are not fact lists) are dropped and the remaining
        weights re-normalized. Returns 0.0 when nothing applies so short
        technical answers keep relying on exact/tech-normalized matching only.
        """
        target_tokens = cls._meaningful_tokens(cls._tech_normalize(target))
        if len(target_tokens) < 3 or not provided_tokens:
            return 0.0

        weighted = 0.0
        total_weight = 0.0

        facts = cls._comma_facts(target)
        if facts:
            covered = sum(
                1 for part in facts
                if cls._fact_matched(part, cls._meaningful_tokens(part), provided, provided_tokens)
            )
            weighted += WEIGHT_FACTS * (covered / len(facts))
            total_weight += WEIGHT_FACTS

        overlap = len(set(provided_tokens) & set(target_tokens)) / len(set(target_tokens))
        edit = cls._edit_coverage(provided_tokens, target_tokens)
        weighted += WEIGHT_TOKENS * overlap + WEIGHT_EDIT * edit
        total_weight += WEIGHT_TOKENS + WEIGHT_EDIT

        return weighted / total_weight

    @classmethod
    def _blended_score(cls, provided: str, target: str) -> float:
        """Single similarity score in [0.0, 1.0] for a free-text answer against
        the whole key. When the key holds '|'-separated alternatives the best
        score across alternatives wins."""
        provided_tech = cls._tech_normalize(provided) or provided
        provided_tokens = cls._meaningful_tokens(provided_tech)
        alternatives = [alt.strip() for alt in target.split("|") if alt.strip()] or [target]
        return max(cls._score_candidate(provided, provided_tokens, alt) for alt in alternatives)
