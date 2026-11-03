"""Remove off-topic hashtags/tags from already-published videos (comma-separated ids)."""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shorts.config import Config  # noqa: E402
from shorts.seo import EVERGREEN, HASHTAG, _relevant  # noqa: E402
from shorts.upload import _client  # noqa: E402


def keep(tag: str) -> bool:
    return tag.lower() == "shorts" or tag in EVERGREEN or _relevant(tag)


def main() -> None:
    yt = _client(Config())
    for vid in [v.strip() for v in sys.argv[1].split(",") if v.strip()]:
        item = yt.videos().list(part="snippet", id=vid).execute()["items"][0]
        sn = item["snippet"]
        desc = HASHTAG.sub(lambda m: m.group(0) if keep(m.group(1)) else "", sn.get("description", ""))
        desc = re.sub(r"[ \t]{2,}", " ", desc)
        tags = [t for t in sn.get("tags", []) if keep(t.replace(" ", "_")) or "قصص" in t or "لغز" in t
                or t in ("دهشة",) or not t.startswith("#") and t not in ("سراب", "تسريب")]
        body = {"id": vid, "snippet": {"title": sn["title"], "description": desc, "tags": tags,
                                       "categoryId": sn["categoryId"],
                                       "defaultLanguage": sn.get("defaultLanguage", "ar")}}
        yt.videos().update(part="snippet", body=body).execute()
        print(f"cleaned {vid}")


if __name__ == "__main__":
    main()
