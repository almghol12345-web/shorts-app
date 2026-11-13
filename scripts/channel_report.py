"""Print every upload on the channel with its views, likes, comments, privacy and date."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shorts.config import Config  # noqa: E402
from shorts.upload import _client  # noqa: E402


def main() -> None:
    cfg = Config()
    yt = _client(cfg)
    ch = yt.channels().list(part="contentDetails,statistics", mine=True).execute()["items"][0]
    print("CHANNEL", json.dumps(ch["statistics"]))
    uploads = ch["contentDetails"]["relatedPlaylists"]["uploads"]
    ids, token = [], None
    while True:
        page = yt.playlistItems().list(part="contentDetails", playlistId=uploads,
                                       maxResults=50, pageToken=token).execute()
        ids += [i["contentDetails"]["videoId"] for i in page["items"]]
        token = page.get("nextPageToken")
        if not token:
            break
    rows = []
    for k in range(0, len(ids), 50):
        vids = yt.videos().list(part="snippet,statistics,status,contentDetails",
                                id=",".join(ids[k:k + 50])).execute()["items"]
        for v in vids:
            st = v.get("statistics", {})
            rows.append({"id": v["id"], "title": v["snippet"]["title"][:60],
                         "published": v["snippet"]["publishedAt"], "views": int(st.get("viewCount", 0)),
                         "likes": int(st.get("likeCount", 0)), "duration": v["contentDetails"]["duration"]})
            print("VIDEO", json.dumps({
                "id": v["id"], "title": v["snippet"]["title"],
                "published": v["snippet"]["publishedAt"], "privacy": v["status"]["privacyStatus"],
                "duration": v["contentDetails"]["duration"],
                "views": int(st.get("viewCount", 0)), "likes": int(st.get("likeCount", 0)),
                "comments": int(st.get("commentCount", 0)),
            }, ensure_ascii=False))

    # the newest uploads again at the very end, so a short tail of the log is enough
    for r in sorted(rows, key=lambda r: r["published"], reverse=True)[:12][::-1]:
        print("RECENT", json.dumps(r, ensure_ascii=False))
    retention = _retention(cfg, [r["id"] for r in sorted(rows, key=lambda r: r["published"], reverse=True)[:12]])
    for vid, m in retention.items():
        print("RETENTION", json.dumps({"id": vid, **m}))
    print("CHANNEL", json.dumps(ch["statistics"]))
    # a dated snapshot in the repository: the channel's memory between sessions
    from datetime import datetime, timezone
    out = Path(__file__).resolve().parent.parent / "data" / "analytics"
    out.mkdir(parents=True, exist_ok=True)
    snap = {"at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "channel": ch["statistics"],
            "videos": rows, "retention": retention}
    text = json.dumps(snap, ensure_ascii=False, indent=1)
    (out / f"{snap['at'][:10]}.json").write_text(text, encoding="utf-8")
    (out / "latest.json").write_text(text, encoding="utf-8")


def _retention(cfg, ids: list[str]) -> dict:
    """Average watched percentage and seconds per video from YouTube Analytics. Needs the
    yt-analytics.readonly permission on the saved login; says so plainly when it is missing."""
    try:
        from datetime import date, timedelta
        from googleapiclient.discovery import build
        from google.oauth2.credentials import Credentials
        creds = Credentials(token=None, refresh_token=cfg.yt_refresh_token, client_id=cfg.yt_client_id,
                            client_secret=cfg.yt_client_secret, token_uri="https://oauth2.googleapis.com/token")
        ya = build("youtubeAnalytics", "v2", credentials=creds, cache_discovery=False)
        res = ya.reports().query(
            ids="channel==MINE", startDate=str(date.today() - timedelta(days=28)), endDate=str(date.today()),
            metrics="views,averageViewPercentage,averageViewDuration,subscribersGained",
            dimensions="video", filters="video==" + ",".join(ids), maxResults=50).execute()
        return {row[0]: {"views": row[1], "watched_percent": row[2], "watched_seconds": row[3],
                         "subscribers": row[4]} for row in res.get("rows", [])}
    except Exception as exc:
        print(f"ANALYTICS unavailable: {str(exc)[:200]}")
        return {}


if __name__ == "__main__":
    main()
