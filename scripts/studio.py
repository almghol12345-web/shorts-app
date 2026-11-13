"""The production board from the command line.

    python scripts/studio.py list
    python scripts/studio.py next                      # the next approved video to publish
    python scripts/studio.py add "<topic>" --by idea-scout --note "..."
    python scripts/studio.py advance "<topic>" <stage> --by <agent> --note "<evidence>"
    python scripts/studio.py rework "<topic>" <stage> --by <agent> --note "<reason>"
"""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from shorts import history, studio  # noqa: E402
from shorts.config import Config  # noqa: E402


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("command", choices=["list", "next", "add", "advance", "rework"])
    p.add_argument("topic", nargs="?")
    p.add_argument("stage", nargs="?")
    p.add_argument("--by", default="producer")
    p.add_argument("--note", default="")
    a = p.parse_args()
    published = history.used_topics(Config().history_file)
    try:
        if a.command == "list":
            for topic, item in studio.load().items():
                print(f"{studio.status(topic, published):11} reworks={item['reworks']} {topic}")
        elif a.command == "next":
            print(studio.next_ready(published) or "")
        elif a.command == "add":
            studio.add(a.topic, a.by, a.note)
            print(f"added '{a.topic}' at idea")
        elif a.command == "advance":
            print(f"'{a.topic}' -> {studio.advance(a.topic, a.stage, a.by, a.note)['stage']}")
        elif a.command == "rework":
            item = studio.rework(a.topic, a.stage, a.by, a.note)
            print(f"'{a.topic}' back to {item['stage']} (rework {item['reworks']}"
                  f"{', BLOCKED' if item['blocked'] else ''})")
    except ValueError as exc:
        sys.exit(f"refused: {exc}")


if __name__ == "__main__":
    main()
