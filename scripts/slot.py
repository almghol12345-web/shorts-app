"""Decides whether a scheduled run should publish now, and what kind of Short.

GitHub sometimes delays or drops scheduled runs, so the workflow wakes up every hour
during the day and this script keeps the real plan: 4 Shorts a day (Riyadh time),
at least 3 hours apart, the last one of the day a mystery story, the others amazing facts.
Prints "run=<true|false>" and "kind=<news|mystery>" for $GITHUB_OUTPUT.
"""
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

RIYADH = timezone(timedelta(hours=3))
PER_DAY = 4
MIN_GAP = timedelta(hours=3)
FIRST_HOUR, MYSTERY_HOUR = 12, 21     # Riyadh: first Short after noon, mystery late at night


def decide(history: list[dict], mysteries: set[str], now: datetime) -> tuple[bool, str]:
    local = now.astimezone(RIYADH)
    if local.hour < FIRST_HOUR:
        return False, "news"
    today = [h for h in history if h.get("date") and
             datetime.fromisoformat(h["date"]).astimezone(RIYADH).date() == local.date()]
    if len(today) >= PER_DAY:
        return False, "news"
    last = max((datetime.fromisoformat(h["date"]) for h in history if h.get("date")), default=None)
    if last and now - last < MIN_GAP:
        return False, "news"
    had_mystery = any(h.get("topic") in mysteries for h in today)
    kind = "mystery" if local.hour >= MYSTERY_HOUR and not had_mystery else "news"
    return True, kind


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    history = json.loads((root / "data/history.json").read_text(encoding="utf-8"))
    mysteries = {m["topic"] for m in json.loads((root / "data/mysteries.json").read_text(encoding="utf-8"))}
    run, kind = decide(history, mysteries, datetime.now(timezone.utc))
    print(f"run={'true' if run else 'false'}")
    print(f"kind={kind}")


if __name__ == "__main__":
    main()
    sys.exit(0)
