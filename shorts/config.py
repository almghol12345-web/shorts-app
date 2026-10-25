import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_dotenv() -> None:
    env = ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, "").strip() or default


@dataclass
class Config:
    niche: str = field(default_factory=lambda: _env("SHORTS_NICHE", "حقائق مدهشة وغريبة عن العالم والعلم والتاريخ"))
    language: str = field(default_factory=lambda: _env("SHORTS_LANGUAGE", "ar"))
    voice: str = field(default_factory=lambda: _env("SHORTS_VOICE", "ar-SA-HamedNeural"))
    privacy: str = field(default_factory=lambda: _env("SHORTS_PRIVACY", "public"))
    anthropic_key: str = field(default_factory=lambda: _env("ANTHROPIC_API_KEY"))
    model: str = field(default_factory=lambda: _env("SHORTS_MODEL", "claude-opus-5-5"))
    pexels_key: str = field(default_factory=lambda: _env("PEXELS_API_KEY"))
    pixabay_key: str = field(default_factory=lambda: _env("PIXABAY_API_KEY"))
    yt_client_id: str = field(default_factory=lambda: _env("YOUTUBE_CLIENT_ID"))
    yt_client_secret: str = field(default_factory=lambda: _env("YOUTUBE_CLIENT_SECRET"))
    yt_refresh_token: str = field(default_factory=lambda: _env("YOUTUBE_REFRESH_TOKEN"))
    output_dir: Path = field(default_factory=lambda: ROOT / "output")
    history_file: Path = field(default_factory=lambda: ROOT / "data" / "history.json")
    font_dir: Path = ROOT / "assets" / "fonts"
    font_name: str = "Noto Sans Arabic Blk"
    music_dir: Path = ROOT / "assets" / "music"
    width: int = 1080
    height: int = 1920

    @property
    def can_upload(self) -> bool:
        return bool(self.yt_client_id and self.yt_client_secret and self.yt_refresh_token)
