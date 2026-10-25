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


def record(path: Path, topic: str, title: str, video_id: str | None) -> None:
    items = load(path)
    items.append({
        "topic": topic,
        "title": title,
        "video_id": video_id,
        "date": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    })
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
