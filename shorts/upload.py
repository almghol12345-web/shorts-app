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
                                         source=script.source, question=plain(script.question))
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
    question = plain(script.question or (script.lines[-1] if script.lines else ""))
    if question:
        post_comment(yt, response["id"], question + " 👇")
    return response["id"]


def post_comment(yt, video_id: str, text: str) -> bool:
    """The channel's own first comment (the story's question) gets the discussion going.
    YouTube's API cannot pin comments; that one tap stays manual."""
    try:
        yt.commentThreads().insert(part="snippet", body={"snippet": {
            "videoId": video_id, "topLevelComment": {"snippet": {"textOriginal": text}}}}).execute()
        print("[comment] posted the question")
        return True
    except Exception as exc:  # e.g. the token lacks the comment permission
        print(f"[comment] not posted ({str(exc)[:200]})")
        return False


def upload_long(cfg: Config, title: str, description: str, tags: list[str], video: Path,
                thumbnail: Path | None = None) -> str:
    """A normal (horizontal) video: counts toward the Partner Program's watch hours."""
    from googleapiclient.http import MediaFileUpload

    yt = _client(cfg)
    body = {
        "snippet": {"title": title[:100], "description": description[:4900], "tags": tags,
                    "categoryId": EDUCATION, "defaultLanguage": cfg.language,
                    "defaultAudioLanguage": cfg.language},
        "status": {"privacyStatus": cfg.privacy, "selfDeclaredMadeForKids": False,
                   "containsSyntheticMedia": False},
    }
    media = MediaFileUpload(str(video), mimetype="video/mp4", chunksize=16 * 1024 * 1024, resumable=True)
    request = yt.videos().insert(part="snippet,status", body=body, media_body=media)
    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"[upload] {int(status.progress() * 100)}%")
    vid = response["id"]
    if thumbnail and thumbnail.exists():
        try:
            yt.thumbnails().set(videoId=vid, media_body=MediaFileUpload(str(thumbnail), mimetype="image/jpeg")).execute()
            print("[upload] thumbnail set")
        except Exception as exc:  # custom thumbnails need a phone-verified channel
            print(f"[upload] thumbnail not set ({str(exc)[:200]})")
    post_comment(yt, vid, "وش أغرب وحدة فيهم بالنسبة لك؟ اكتب رقمها 👇")
    return vid
