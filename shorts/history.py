"""Remembers published topics so the channel never repeats itself."""
import json
from datetime import datetime, timezone
from pathlib import Path


def load(path: Path) -> list[dict]:
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []


def used_topics(path: Path) -> list[str]:
    return [item["topic"] for item in load(path)]


def record(path: Path, topic: str, title: str, video_id: str | None, journal: Path | None = None) -> None:
    entry = {
        "topic": topic,
        "title": title,
        "video_id": video_id,
        "date": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    items = load(path)
    items.append(entry)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    if journal:
        # this run's own publications, merged into the latest history by the workflow
        journal.parent.mkdir(parents=True, exist_ok=True)
        with open(journal, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def merge_journal(journal: Path, path: Path) -> int:
    """Add the journal's entries to the history file, skipping ones already there."""
    items = load(path)
    known = {i.get("video_id") for i in items}
    added = 0
    for line in journal.read_text(encoding="utf-8").splitlines():
        if line.strip():
            entry = json.loads(line)
            if entry.get("video_id") not in known:
                items.append(entry)
                added += 1
    path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
    return added
