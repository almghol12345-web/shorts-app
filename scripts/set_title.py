"""Change the title of one published video, keeping everything else.
Usage: python scripts/set_title.py <video id> "<new title>"
Hashtags that followed the old title (e.g. #shorts) are kept at the end."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from shorts.config import Config  # noqa: E402
from shorts.upload import _client  # noqa: E402


def main() -> None:
    vid, new = sys.argv[1].strip(), sys.argv[2].strip()
    yt = _client(Config())
    item = yt.videos().list(part="snippet", id=vid).execute()["items"][0]
    sn = item["snippet"]
    old = sn["title"]
    tags = [w for w in old.split() if w.startswith("#") and w not in new]
    sn["title"] = (new + (" " + " ".join(tags) if tags else ""))[:100]
    yt.videos().update(part="snippet", body={"id": vid, "snippet": {
        k: sn[k] for k in ("title", "description", "categoryId", "tags", "defaultLanguage") if k in sn}}).execute()
    print(f"{vid}: '{old}' -> '{sn['title']}'")


if __name__ == "__main__":
    main()
