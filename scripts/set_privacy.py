"""Change channel videos' privacy: python scripts/set_privacy.py <ids comma-separated> <public|unlisted|private>."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from shorts.config import Config  # noqa: E402
from shorts.upload import _client  # noqa: E402


def main() -> None:
    yt = _client(Config())
    status = sys.argv[2]
    for video_id in [v.strip() for v in sys.argv[1].split(",") if v.strip()]:
        try:
            yt.videos().update(part="status", body={"id": video_id, "status": {
                "privacyStatus": status, "selfDeclaredMadeForKids": False}}).execute()
            print(f"{video_id} is now {status}: https://youtube.com/shorts/{video_id}")
        except Exception as exc:
            print(f"Could not update {video_id}: {exc}")
            raise


if __name__ == "__main__":
    main()
