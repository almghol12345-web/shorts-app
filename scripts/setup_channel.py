"""Applies the channel identity (description, keywords, language, banner) via the API.

YouTube's API cannot change the channel name or profile picture; those two
are set once in YouTube Studio (see README).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from googleapiclient.http import MediaFileUpload  # noqa: E402

from shorts.config import ROOT, Config  # noqa: E402
from shorts.upload import _client  # noqa: E402

DESCRIPTION = """غيهب.. قصص حقيقية غامضة ومعلومات تبهرك 🤯

كل يوم سوالف ما سمعت فيها: اختفاءات غريبة، ألغاز حيرت العالم، اكتشافات واختراعات تحس إنها خيال.. بس كلها حقيقية وموثقة.
شورتات كل يوم، ومقاطع طويلة كل ثلاثاء وجمعة.

اشترك وفعّل الجرس 🔔 عشان ما يفوتك شي

#غيهب #قصص_غامضة #معلومات"""

KEYWORDS = ('غيهب "قصص غامضة" "قصص حقيقية" ألغاز غموض "ألغاز لم تحل" اختفاءات معلومات '
            '"معلومات مدهشة" اكتشافات "هل تعلم" علوم فضاء "قصص بالسعودي" shorts')


def main() -> None:
    cfg = Config()
    if not cfg.can_upload:
        sys.exit("YouTube credentials are missing")
    yt = _client(cfg)

    channel = yt.channels().list(part="brandingSettings", mine=True).execute()["items"][0]
    branding = channel.get("brandingSettings", {})
    branding.setdefault("channel", {}).update({
        "description": DESCRIPTION,
        "keywords": KEYWORDS,
        "defaultLanguage": "ar",
        "country": "SA",
    })

    banner = ROOT / "assets" / "channel" / "banner.jpg"
    upload = yt.channelBanners().insert(media_body=MediaFileUpload(str(banner), mimetype="image/jpeg")).execute()
    branding.setdefault("image", {})["bannerExternalUrl"] = upload["url"]

    yt.channels().update(part="brandingSettings",
                         body={"id": channel["id"], "brandingSettings": branding}).execute()
    print(f"Channel {channel['id']} updated: description, keywords, language, banner.")


if __name__ == "__main__":
    main()
