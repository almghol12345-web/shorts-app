"""Look up one or more YouTube video ids directly and print their full status.

Unlike channel_report.py (which only lists videos still in the channel's uploads playlist),
this calls videos().list on the exact ids given, so it still returns a row for a video that
has dropped out of the channel (removed by YouTube itself) as long as the API knows about it,
and shows why: privacyStatus, uploadStatus, failureReason, rejectionReason.

Usage: python scripts/video_status.py <id1,id2,...>
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shorts.config import Config  # noqa: E402
from shorts.upload import _client  # noqa: E402


def main() -> None:
    ids = [i.strip() for i in sys.argv[1].split(",") if i.strip()]
    yt = _client(Config())
    found = {}
    for k in range(0, len(ids), 50):
        resp = yt.videos().list(part="snippet,status,statistics", id=",".join(ids[k:k + 50])).execute()
        for v in resp.get("items", []):
            found[v["id"]] = v
    for vid in ids:
        v = found.get(vid)
        if v is None:
            print(f"GONE {vid}: the API no longer returns this video at all (deleted, or id never existed)")
            continue
        st = v.get("status", {})
        stats = v.get("statistics", {})
        print("STATUS", json.dumps({
            "id": vid,
            "title": v["snippet"]["title"],
            "privacyStatus": st.get("privacyStatus"),
            "uploadStatus": st.get("uploadStatus"),
            "failureReason": st.get("failureReason"),
            "rejectionReason": st.get("rejectionReason"),
            "madeForKids": st.get("madeForKids"),
            "views": stats.get("viewCount"),
        }, ensure_ascii=False))


if __name__ == "__main__":
    main()
