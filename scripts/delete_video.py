"""Delete one of the channel's videos by id (used only when the owner asks)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shorts.config import Config  # noqa: E402
from shorts.upload import _client  # noqa: E402


def main() -> None:
    video_id = sys.argv[1].strip()
    cfg = Config()
    _client(cfg).videos().delete(id=video_id).execute()
    print(f"Deleted https://youtube.com/shorts/{video_id}")


if __name__ == "__main__":
    main()
