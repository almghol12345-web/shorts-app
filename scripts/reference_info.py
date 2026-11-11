"""Print the public details of any YouTube video (title, channel, stats, tags, description).

Used to study a reference Short the owner likes, so we can learn why it works.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shorts.config import Config  # noqa: E402
from shorts.upload import _client  # noqa: E402


def main(video_id: str) -> None:
    yt = _client(Config())
    v = yt.videos().list(part="snippet,statistics,contentDetails", id=video_id).execute()["items"][0]
    sn, st = v["snippet"], v.get("statistics", {})
    ch = yt.channels().list(part="snippet,statistics", id=sn["channelId"]).execute()["items"][0]
    info = {
        "title": sn["title"], "channel": sn["channelTitle"], "published": sn["publishedAt"],
        "duration": v["contentDetails"]["duration"], "views": st.get("viewCount"),
        "likes": st.get("likeCount"), "comments": st.get("commentCount"),
        "tags": sn.get("tags", []), "description": sn.get("description", ""),
        "channel_subs": ch["statistics"].get("subscriberCount"),
        "channel_videos": ch["statistics"].get("videoCount"),
        "channel_views": ch["statistics"].get("viewCount"),
    }
    print(json.dumps(info, ensure_ascii=False, indent=1))
    # the channel's latest uploads, to see its usual pattern
    s = yt.search().list(part="snippet", channelId=sn["channelId"], order="viewCount",
                         type="video", maxResults=15).execute()
    ids = [i["id"]["videoId"] for i in s["items"]]
    for x in yt.videos().list(part="snippet,statistics,contentDetails", id=",".join(ids)).execute()["items"]:
        print("TOP", x["statistics"].get("viewCount"), x["contentDetails"]["duration"], x["snippet"]["title"])


if __name__ == "__main__":
    main(sys.argv[1])
