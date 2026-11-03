"""Rebuild title, description and tags of published Shorts with the current hashtag rules.
Usage: python scripts/refresh_seo.py <video ids, comma-separated>"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from shorts import seo  # noqa: E402
from shorts.config import Config  # noqa: E402
from shorts.spoken import plain  # noqa: E402
from shorts.upload import _client  # noqa: E402


def scripts() -> dict:
    out = {}
    for name in ("mysteries.json", "facts.json", "wow.json"):
        path = ROOT / "data" / name
        if path.exists():
            for s in json.loads(path.read_text(encoding="utf-8")):
                out[s["topic"]] = s
    return out


def main() -> None:
    yt = _client(Config())
    history = {h["video_id"]: h["topic"] for h in json.loads((ROOT / "data/history.json").read_text(encoding="utf-8"))}
    bank = scripts()
    trending = seo.trending_hashtags(yt)
    for vid in [v.strip() for v in sys.argv[1].split(",") if v.strip()]:
        script = bank.get(history.get(vid, ""))
        if not script:
            print(f"{vid}: script not found, skipped")
            continue
        sn = yt.videos().list(part="snippet", id=vid).execute()["items"][0]["snippet"]
        title, desc, tags = seo.build(script["title"], plain(script["lines"][0]), script["tags"], trending,
                                      kind=script.get("kind", "mystery"))
        credits = sn.get("description", "").split("\n\nالصور:\n", 1)
        if len(credits) == 2:
            desc += "\n\nالصور:\n" + credits[1]
        body = {"id": vid, "snippet": {"title": title, "description": desc[:4900], "tags": tags,
                                       "categoryId": sn["categoryId"],
                                       "defaultLanguage": sn.get("defaultLanguage", "ar")}}
        yt.videos().update(part="snippet", body=body).execute()
        print(f"{vid}: {title}")


if __name__ == "__main__":
    main()
