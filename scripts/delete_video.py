"""Delete channel videos by id, comma-separated (used only when the owner asks)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shorts.config import Config  # noqa: E402
from shorts.upload import _client  # noqa: E402


def main() -> None:
    yt = _client(Config())
    for video_id in [v.strip() for v in sys.argv[1].split(",") if v.strip()]:
        try:
            yt.videos().delete(id=video_id).execute()
            print(f"Deleted https://youtube.com/shorts/{video_id}")
        except Exception as exc:
            print(f"Could not delete {video_id}: {exc}")


if __name__ == "__main__":
    main()
