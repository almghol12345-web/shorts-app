"""Learns from the channel's own numbers which kinds of Shorts do best, and favours them.

Every published Short is put in a group (sea disappearances, crime, ancient, space,
animals, tech...). Before choosing the next script, each group gets a score from the
views of its published Shorts, and the next script is drawn with a weight that follows
that score, so winners come back more often while weaker groups still get tried.
"""
import json
import math
import random
from datetime import datetime, timezone
from pathlib import Path

MIN_AGE_HOURS = 12      # younger Shorts have not had their chance yet


def group_of(script) -> str:
    from .music import mood_for
    if getattr(script, "kind", "mystery") == "news":
        return "news:" + (script.tags[0] if script.tags else "علوم")
    return "story:" + mood_for(script.title, " ".join(script.tags), " ".join(script.lines))


def fetch_views(cfg) -> dict[str, dict]:
    """video_id -> {views, likes, comments, published} for every upload (cheap: ~3 quota units)."""
    from .upload import _client
    yt = _client(cfg)
    ch = yt.channels().list(part="contentDetails", mine=True).execute()["items"][0]
    uploads = ch["contentDetails"]["relatedPlaylists"]["uploads"]
    ids, token = [], None
    while True:
        page = yt.playlistItems().list(part="contentDetails", playlistId=uploads,
                                       maxResults=50, pageToken=token).execute()
        ids += [i["contentDetails"]["videoId"] for i in page["items"]]
        token = page.get("nextPageToken")
        if not token or len(ids) >= 200:
            break
    stats = {}
    for k in range(0, len(ids), 50):
        for v in yt.videos().list(part="snippet,statistics", id=",".join(ids[k:k + 50])).execute()["items"]:
            st = v.get("statistics", {})
            stats[v["id"]] = {"views": int(st.get("viewCount", 0)), "likes": int(st.get("likeCount", 0)),
                              "comments": int(st.get("commentCount", 0)),
                              "published": v["snippet"]["publishedAt"]}
    return stats


def group_scores(history: list[dict], stats: dict, scripts: dict) -> dict[str, float]:
    """Mean of log(views) per group, using Shorts old enough to judge."""
    now = datetime.now(timezone.utc)
    bucket: dict[str, list[float]] = {}
    for h in history:
        st = stats.get(h.get("video_id") or "")
        script = scripts.get(h.get("topic"))
        if not st or not script:
            continue
        age = (now - datetime.fromisoformat(st["published"].replace("Z", "+00:00"))).total_seconds() / 3600
        if age < MIN_AGE_HOURS:
            continue
        bucket.setdefault(group_of(script), []).append(math.log1p(st["views"]))
    return {g: sum(v) / len(v) for g, v in bucket.items()}


def pick(candidates: list, scores: dict[str, float]):
    """Weighted draw: a group twice as strong (in log views) is picked about 3x as often;
    groups with no data yet get the average, so new kinds still get a fair try."""
    if not candidates:
        return None
    if not scores:
        return random.choice(candidates)
    avg = sum(scores.values()) / len(scores)
    weights = [math.exp(1.1 * (scores.get(group_of(c), avg) - avg)) for c in candidates]
    return random.choices(candidates, weights=weights, k=1)[0]


def save_report(path: Path, scores: dict[str, float]) -> None:
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    path.write_text(json.dumps([{"group": g, "typical_views": round(math.expm1(s))} for g, s in ranked],
                               ensure_ascii=False, indent=1), encoding="utf-8")
