"""Print every upload on the channel with its views, likes, comments, privacy and date."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shorts.config import Config  # noqa: E402
from shorts.upload import _client  # noqa: E402


def main() -> None:
    yt = _client(Config())
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
    for k in range(0, len(ids), 50):
        vids = yt.videos().list(part="snippet,statistics,status,contentDetails",
                                id=",".join(ids[k:k + 50])).execute()["items"]
        for v in vids:
            st = v.get("statistics", {})
            print("VIDEO", json.dumps({
                "id": v["id"], "title": v["snippet"]["title"],
                "published": v["snippet"]["publishedAt"], "privacy": v["status"]["privacyStatus"],
                "duration": v["contentDetails"]["duration"],
                "views": int(st.get("viewCount", 0)), "likes": int(st.get("likeCount", 0)),
                "comments": int(st.get("commentCount", 0)),
            }, ensure_ascii=False))


if __name__ == "__main__":
    main()
