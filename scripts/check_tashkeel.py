"""Tashkeel checker: lists scripts whose lines are not fully vowelled (the voice mispronounces
unvowelled dialect words), and the exact lines that need work.
Usage: python scripts/check_tashkeel.py [--all]   (default: only scripts not published yet)"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from shorts.spoken import vowel_coverage  # noqa: E402

MIN = 0.35   # fully vowelled dialect lines score ~0.45-0.6; unvowelled ones 0


def main() -> int:
    used = {h["topic"] for h in json.loads((ROOT / "data/history.json").read_text(encoding="utf-8"))}
    bad_scripts = 0
    for name in ("mysteries.json", "wow.json"):
        for s in json.loads((ROOT / "data" / name).read_text(encoding="utf-8")):
            if "--all" not in sys.argv and s["topic"] in used:
                continue
            weak = [l for l in s["lines"] + [s.get("question", "")] if l and vowel_coverage(l) < MIN]
            if weak:
                bad_scripts += 1
                print(f"{name}: {s['topic']} - {len(weak)} lines need tashkeel")
                for l in weak[:3]:
                    print(f"    {l}")
    print(f"{bad_scripts} scripts need tashkeel")
    return 1 if bad_scripts else 0


if __name__ == "__main__":
    sys.exit(main())
