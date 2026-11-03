"""Uploads a finished Short with the YouTube Data API v3."""
from pathlib import Path

from .config import Config
from .content import Script

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube",  # channel branding
]
EDUCATION = "27"


def _client(cfg: Config):
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    creds = Credentials(
        token=None,
        refresh_token=cfg.yt_refresh_token,
        client_id=cfg.yt_client_id,
        client_secret=cfg.yt_client_secret,
        token_uri="https://oauth2.googleapis.com/token",
        scopes=SCOPES,
    )
    return build("youtube", "v3", credentials=creds, cache_discovery=False)


def upload(cfg: Config, script: Script, video: Path) -> str:
    from googleapiclient.http import MediaFileUpload

    from . import seo
    from .spoken import plain

    yt = _client(cfg)
    credits = script.description.split("\n\nالصور:\n", 1)
    title, description, tags = seo.build(script.title, plain(script.lines[0]), script.tags,
                                         seo.trending_hashtags(yt), kind=script.kind,
                                         source=script.source)
    if len(credits) == 2:
        description += "\n\nالصور:\n" + credits[1]
    body = {
        "snippet": {
            "title": title,
            "description": description[:4900],
            "tags": tags,
            "categoryId": EDUCATION,
            "defaultLanguage": cfg.language,
            "defaultAudioLanguage": cfg.language,
        },
        "status": {
            "privacyStatus": cfg.privacy,
            "selfDeclaredMadeForKids": False,
            # Narrated facts over stock footage are not realistic altered media,
            # so YouTube does not require the synthetic-content label here.
            "containsSyntheticMedia": False,
        },
    }
    media = MediaFileUpload(str(video), mimetype="video/mp4", chunksize=8 * 1024 * 1024, resumable=True)
    request = yt.videos().insert(part="snippet,status", body=body, media_body=media)
    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"[upload] {int(status.progress() * 100)}%")
    return response["id"]
