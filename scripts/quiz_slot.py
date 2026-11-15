"""Should the quiz workflow publish now? Prints run=<true|false> for $GITHUB_OUTPUT.

Same daily plan as the explainers (from 4pm Riyadh, 3 videos a day in all, 2.5 hours apart),
and only when it is a quiz's turn (shorts/rotation.py)."""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

from shorts.rotation import whose_turn  # noqa: E402
import slot  # noqa: E402


def main() -> None:
    history = json.loads((ROOT / "data/history.json").read_text(encoding="utf-8"))
    now = datetime.now(timezone.utc)
    ok, _ = slot.decide(history, set(), now)
    print(f"run={'true' if ok and whose_turn(history, now) in ('quiz', 'any') else 'false'}")


if __name__ == "__main__":
    main()
