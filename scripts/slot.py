"""Decides whether a scheduled run should publish now, and what kind of Short.

GitHub sometimes delays or drops scheduled runs, so the workflow wakes up every hour
during the day and this script keeps the real plan: 5 Shorts a day (Riyadh time),
at least 2.5 hours apart, all Quran / Companions stories.
Prints "run=<true|false>" and "kind=<news|mystery>" for $GITHUB_OUTPUT.
"""
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

RIYADH = timezone(timedelta(hours=3))
PER_DAY = 5                           # YouTube's daily upload quota allows about 5
MIN_GAP = timedelta(hours=2, minutes=30)
FIRST_HOUR, MYSTERY_HOUR = 10, 21     # Riyadh: first Short at 10am


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
    # the channel now runs Quran and Companions stories (drawn, formal Arabic) all day
    return True, "faith"


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
