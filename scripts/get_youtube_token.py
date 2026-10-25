"""One-time helper: sign in with the channel's Google account and print a refresh token.

1. In Google Cloud Console create an OAuth client of type "Desktop app"
   and download it as client_secret.json next to this script's folder (repo root).
2. Run:  python scripts/get_youtube_token.py
3. Copy the three printed values into your GitHub repository secrets.
"""
import json
import sys
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


def main() -> None:
    secret = Path(sys.argv[1] if len(sys.argv) > 1 else "client_secret.json")
    if not secret.exists():
        sys.exit(f"Not found: {secret}. Download your OAuth Desktop client JSON first.")
    flow = InstalledAppFlow.from_client_secrets_file(str(secret), SCOPES)
    creds = flow.run_local_server(port=0, prompt="consent", access_type="offline")
    info = json.loads(secret.read_text())
    client = info.get("installed") or info.get("web")
    print("\nAdd these as GitHub secrets (Settings > Secrets and variables > Actions):\n")
    print(f"YOUTUBE_CLIENT_ID={client['client_id']}")
    print(f"YOUTUBE_CLIENT_SECRET={client['client_secret']}")
    print(f"YOUTUBE_REFRESH_TOKEN={creds.refresh_token}")


if __name__ == "__main__":
    main()
