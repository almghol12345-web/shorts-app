"""The channel's rhythm: an explainer, then a quiz, then an explainer, then a quiz.

Both publishing workflows ask this before they run, so they take turns without talking to
each other. If the turn-holder has not published for STALE hours (no approved explainer in
stock, a failed run), the other kind may go, so the channel never goes quiet.
"""
from datetime import datetime, timedelta

QUIZ_PREFIX = "اختبار:"
STALE = timedelta(hours=6)
KIND_ORDER = ["letters", "colors", "numbers"]


def is_quiz(entry: dict) -> bool:
    return str(entry.get("topic", "")).startswith(QUIZ_PREFIX)


def whose_turn(history: list[dict], now: datetime) -> str:
    """'quiz', 'news' (an explainer) or 'any'."""
    dated = [h for h in history if h.get("date")]
    if not dated:
        return "news"
    last = max(dated, key=lambda h: h["date"])
    if now - datetime.fromisoformat(last["date"]) > STALE:
        return "any"
    return "news" if is_quiz(last) else "quiz"


def next_quiz(history: list[dict]) -> tuple[str, int, str]:
    """(kind, seed, topic) of the next quiz: kinds take turns, a seed never repeats."""
    done = {h["topic"] for h in history if is_quiz(h)}
    n = len(done)
    while True:
        kind, seed = KIND_ORDER[n % len(KIND_ORDER)], 3 + n // len(KIND_ORDER)
        topic = f"{QUIZ_PREFIX}{kind}:{seed}"
        if topic not in done:
            return kind, seed, topic
        n += 1
