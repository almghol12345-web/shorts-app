"""Delete the channel's own Shorts that did not take off.

Only videos this tool published (listed in data/history.json) are considered, never the
owner's older videos. A Short is removed when it is older than MIN_AGE_HOURS and still has
fewer than MIN_VIEWS views. The entry stays in the history marked deleted, so the same
story is not made again.
"""
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shorts.config import Config  # noqa: E402
from shorts.upload import _client  # noqa: E402

MIN_AGE_HOURS = 72
MIN_VIEWS = 100
HISTORY = Path(__file__).resolve().parent.parent / "data" / "history.json"


def main() -> None:
    items = json.loads(HISTORY.read_text(encoding="utf-8"))
    cutoff = datetime.now(timezone.utc) - timedelta(hours=MIN_AGE_HOURS)
    due = {i["video_id"]: i for i in items
           if i.get("video_id") and not i.get("deleted")
           and datetime.fromisoformat(i["date"]) < cutoff}
    if not due:
        print("nothing old enough to judge")
        return
    yt = _client(Config())
    ids = list(due)
    stats = {}
    for k in range(0, len(ids), 50):
        for v in yt.videos().list(part="statistics", id=",".join(ids[k:k + 50])).execute().get("items", []):
            stats[v["id"]] = int(v["statistics"].get("viewCount", 0))
    for vid, entry in due.items():
        views = stats.get(vid)
        if views is None:                       # already gone from YouTube
            entry["deleted"] = True
            continue
        if views < MIN_VIEWS:
            yt.videos().delete(id=vid).execute()
            entry["deleted"] = True
            print(f"deleted {vid} ({views} views): {entry['title']}")
        else:
            print(f"kept {vid} ({views} views): {entry['title']}")
    HISTORY.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
