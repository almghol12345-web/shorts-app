"""Turns a niche into a ready-to-record Short script.

Uses Claude when ANTHROPIC_API_KEY is set; otherwise falls back to a small
bank of hand-checked facts so the pipeline always works.
"""
import json
import random
from dataclasses import dataclass, field

from .config import Config


@dataclass
class Script:
    topic: str
    title: str
    lines: list[str]            # narration, one caption chunk per line
    description: str
    tags: list[str] = field(default_factory=list)
    search_terms: list[str] = field(default_factory=list)  # English, for stock footage
    visuals: list[str] = field(default_factory=list)       # one per line, see background.py
    scenes: list[str] = field(default_factory=list)        # one illustration prompt per line
    question: str = ""          # closing comment prompt about a detail of the story (not its outcome)
    source: str = ""            # news Shorts: link to the article the facts come from
    kind: str = "mystery"       # "mystery" story or "news" (something new in the world)

    def visual_plan(self) -> list[str]:
        """One visual per line: an AI illustration of the scene when the script has
        scene prompts (real photo / stock as the fallback), else photos and stock."""
        if len(self.visuals) == len(self.lines):
            base = self.visuals
        else:
            terms = self.search_terms or ["dark fog"]
            base = [terms[i % len(terms)] for i in range(len(self.lines))]
        if len(self.scenes) == len(self.lines):
            return [f"ai:{scene} >> {fallback}" for scene, fallback in zip(self.scenes, base)]
        return base

    @property
    def narration(self) -> str:
        return " ".join(self.lines)


SCHEMA = {
    "type": "object",
    "properties": {
        "topic": {"type": "string", "description": "Short unique topic id, e.g. 'octopus hearts'"},
        "title": {"type": "string"},
        "lines": {"type": "array", "items": {"type": "string"}},
        "description": {"type": "string"},
        "tags": {"type": "array", "items": {"type": "string"}},
        "search_terms": {"type": "array", "items": {"type": "string"}},
        "visuals": {"type": "array", "items": {"type": "string"}},
        "scenes": {"type": "array", "items": {"type": "string"}},
        "question": {"type": "string", "description": "Closing comment prompt about a detail of the story, not its outcome"},
    },
    "required": ["topic", "title", "lines", "description", "tags", "search_terms", "visuals", "scenes", "question"],
    "additionalProperties": False,
}

PROMPT = """You write scripts for a faceless YouTube Shorts channel about REAL mysteries:
unexplained events, disappearances, undeciphered writings, strange places and eerie history.
Your only goal is retention: viewers must watch to the last second and replay.

Niche: {niche}
Language of the video: colloquial Saudi / Gulf Arabic (spoken dialect, like a friend telling a story: تخيل، والسالفة إن، طيب ليش...), not Modern Standard Arabic

Write ONE new Short. Rules:
- Only real, documented cases. State facts accurately (dates, places, numbers). If a case has
  a likely explanation, mention it honestly, then the part that is still unexplained.
  Never invent details, never claim the supernatural is proven.
- Avoid famous school facts; pick cases most viewers have never heard of.
- Line 1 (under 3 seconds): the most disturbing or impossible-sounding detail of the case.
- Line 2 opens a loop (what nobody can explain / a detail revealed at the end).
- Middle lines: when and where, then escalating details, one per line.
- End on the open question, phrased so it flows back into line 1 when the video loops.
  NO "follow", "like" or "subscribe" lines.
- 12 to 15 lines, each 3 to 14 words, spoken in about 45-60 seconds: a full story
  with a twist near the end, never a list of facts.
- Ending: never leave the viewer hanging. The last 2-3 lines reveal what really
  happened, or the strongest explanation investigators reached (say so honestly when
  it is still unproven), starting like "وش اللي صار؟" or "والنهاية؟".
- question: one Gulf-dialect line asking viewers about a detail inside the story (what
  would you do in their place, which clue is strangest), never asking them to guess the
  outcome, ending with "اكتب لي في التعليقات".
- title: under 55 characters, mysterious, does not reveal the answer, ends with " #shorts".
- description: the hook sentence, then "تابع القناة.. لغز حقيقي جديد كل يوم 🔍", then 3 hashtags.
- tags: 8 short tags in the video language.
- search_terms: 6 simple English stock-footage keywords with a dark, moody look
  (fog, night, abandoned, storm...), one per visual moment, in order.
- visuals: exactly one entry per line, showing what that line talks about.
  Use "wiki:<English Wikimedia Commons search>|<stock fallback>" when a real photo of the
  subject likely exists (the place, object, document, person, ship...), otherwise a short
  English stock-video query for the mood (e.g. "stormy sea night").
- scenes: exactly one English illustration prompt per line describing what the viewer
  should SEE during that line (setting, characters, action, era). Keep characters consistent
  across lines, no gore, no style words (the style is added automatically).
- Do NOT reuse any of these previous topics: {used}
"""


def _ask_json(cfg: Config, prompt: str, schema: dict) -> dict:
    import anthropic

    client = anthropic.Anthropic(api_key=cfg.anthropic_key)
    request = dict(
        model=cfg.model,
        max_tokens=4000,
        output_config={"effort": "medium", "format": {"type": "json_schema", "schema": schema}},
        messages=[{"role": "user", "content": prompt}],
    )
    try:
        # Server-side fallback: if the model declines, another model finishes the request.
        response = client.beta.messages.create(
            betas=["server-side-fallback-2026-07-01"], fallbacks="default", **request)
    except anthropic.BadRequestError:
        response = client.messages.create(**request)

    if response.stop_reason == "refusal":
        raise RuntimeError("Claude declined to write this script")
    text = next(b.text for b in response.content if b.type == "text")
    return json.loads(text)


def generate_with_claude(cfg: Config, used: list[str]) -> Script:
    return Script(**_ask_json(cfg, PROMPT.format(
        niche=cfg.niche, language=cfg.language, used=", ".join(used[-200:]) or "none"), SCHEMA))


PICK_SCHEMA = {
    "type": "object",
    "properties": {"index": {"type": "integer"}, "why": {"type": "string"}},
    "required": ["index", "why"],
    "additionalProperties": False,
}

PICK_PROMPT = """You run a Gulf-Arabic YouTube Shorts channel about NEW things happening in the
world right now: space discoveries, science breakthroughs, new technology and inventions.
From these fresh headlines pick the ONE that would make an ordinary Saudi viewer stop
scrolling and say "really?!": surprising, easy to picture, about something new.
Skip politics, war, crime, deaths, disasters, health scares, company earnings and
anything already covered: {used}

{items}

Answer with the index of the best headline."""

NEWS_PROMPT = """You write a YouTube Short for a Gulf-Arabic channel about NEW things
happening in the world (space, science, technology, inventions). This is NEWS, not a story.

Language: colloquial Saudi / Gulf Arabic, like a friend excitedly telling you news
(تخيل، يعني، والأقوى إن...), not Modern Standard Arabic.

Article ({date}): {title}
Link: {link}
Text:
{body}

Rules:
- Use ONLY facts stated in the article. Never invent numbers, names or claims. If the
  article says "may" or "could", say it the same careful way.
- Line 1 (under 3 seconds): the most surprising fact, said so a viewer cannot scroll away.
- Then: what exactly happened, who did it and where, how it works in simple words with an
  everyday comparison, and why it matters for normal people.
- Ending: a clear takeaway (what happens next / when we will see it). Never end on a
  cliffhanger: the viewer must understand everything.
- 10 to 14 lines, each 3 to 14 words, about 40-55 seconds. Numbers written as words.
- question: one Gulf-dialect line asking viewers their opinion about a detail of the news
  (would you use it, would you try it...), ending with "اكتب لي في التعليقات".
- title: under 55 characters, exciting, ends with " #shorts".
- description: the first line, then "تابع القناة.. كل يوم شي جديد صاير في العالم 🌍",
  then 3 Arabic hashtags.
- tags: 8 short Arabic tags about this news (علوم, تقنية, فضاء, اكتشاف...).
- topic: a short English id for this news item.
- search_terms: 6 simple English stock-footage keywords for this subject.
- visuals: exactly one per line: "wiki:<English Wikimedia Commons search>|<stock query>" when
  a real photo of the subject likely exists, else a short English stock-video query.
- scenes: exactly one English illustration prompt per line showing what that line says
  (objects, places, people, action). No text in images, no style words.
"""


def generate_news(cfg: Config, used: list[str]) -> Script:
    from . import news
    items = news.headlines(used)
    if not items:
        raise RuntimeError("no fresh headlines")
    listing = "\n".join(f"{i}. {it['title']} - {it['summary'][:220]}" for i, it in enumerate(items))
    pick = _ask_json(cfg, PICK_PROMPT.format(used=", ".join(used[-120:]) or "none", items=listing),
                     PICK_SCHEMA)
    item = items[max(0, min(len(items) - 1, int(pick["index"])))]
    print(f"[news] picked: {item['title']} ({pick['why'][:120]})")
    body = news.article_text(item["link"]) or item["summary"]
    data = _ask_json(cfg, NEWS_PROMPT.format(
        date=item["date"].date().isoformat() if item["date"] else "this week",
        title=item["title"], link=item["link"], body=body), SCHEMA)
    script = Script(**data)
    script.kind, script.source = "news", item["link"]
    script.description += f"\n\nالمصدر: {item['link']}"
    return script


FALLBACK_BANK = [
    Script("honey", "عسل عمره 3000 سنة.. وما زال صالحاً للأكل! #shorts", [
        "هل تصدق أن هناك طعاماً لا يفسد أبداً؟",
        "علماء الآثار وجدوا عسلاً في مقابر مصر القديمة",
        "عمره أكثر من ثلاثة آلاف سنة",
        "والمفاجأة.. أنه ما زال صالحاً للأكل!",
        "السبب أن العسل فقير جداً بالماء وحمضي",
        "فلا تستطيع البكتيريا أن تعيش فيه",
        "والآن.. أعد المشاهدة وانتبه للبداية",
    ], "لماذا لا يفسد العسل أبداً؟ اكتشف السر العلمي. #حقائق #هل_تعلم #shorts",
        ["حقائق", "هل تعلم", "عسل", "مصر القديمة", "علوم", "معلومات", "غرائب", "ثقافة"],
        ["honey", "ancient egypt", "pyramids"]),
    Script("octopus hearts", "حيوان يملك 3 قلوب ودمه أزرق! #shorts", [
        "تخيل أن لديك ثلاثة قلوب!",
        "الأخطبوط يملك ثلاثة قلوب فعلاً",
        "قلبان يضخان الدم إلى الخياشيم",
        "وقلب ثالث يضخه إلى باقي الجسم",
        "ودمه أزرق اللون وليس أحمر",
        "لأنه يعتمد على النحاس لنقل الأكسجين بدل الحديد",
        "والآن.. أعد المشاهدة وانتبه للبداية",
    ], "الأخطبوط كائن عجيب بثلاثة قلوب ودم أزرق. #حقائق #هل_تعلم #shorts",
        ["حقائق", "هل تعلم", "أخطبوط", "حيوانات", "البحر", "علوم", "غرائب", "طبيعة"],
        ["octopus", "ocean", "underwater"]),
    Script("venus day", "كوكب يومه أطول من سنته! #shorts", [
        "هل يمكن أن يكون اليوم أطول من السنة؟",
        "على كوكب الزهرة.. نعم!",
        "الزهرة يحتاج 243 يوماً أرضياً ليدور حول نفسه مرة واحدة",
        "لكنه يدور حول الشمس في 225 يوماً فقط",
        "يعني يومه هناك أطول من سنته",
        "والأغرب أنه يدور بعكس اتجاه معظم الكواكب",
        "والآن.. أعد المشاهدة وانتبه للبداية",
    ], "حقيقة فلكية غريبة عن كوكب الزهرة. #فضاء #هل_تعلم #shorts",
        ["فضاء", "هل تعلم", "الزهرة", "كواكب", "فلك", "علوم", "حقائق", "غرائب"],
        ["planet", "space", "stars"]),
    Script("sharks trees", "أسماك القرش أقدم من الأشجار! #shorts", [
        "شيء عاش على الأرض قبل الأشجار.. ما هو؟",
        "إنها أسماك القرش!",
        "ظهرت أسماك القرش قبل حوالي 450 مليون سنة",
        "أما أول الأشجار فظهرت قبل حوالي 385 مليون سنة",
        "يعني القرش أقدم من الأشجار بعشرات ملايين السنين",
        "ونجا من خمس موجات انقراض كبرى",
        "والآن.. أعد المشاهدة وانتبه للبداية",
    ], "أسماك القرش من أقدم الكائنات على الأرض. #حقائق #هل_تعلم #shorts",
        ["حقائق", "هل تعلم", "قرش", "تاريخ الأرض", "حيوانات", "علوم", "غرائب", "طبيعة"],
        ["shark", "ocean", "forest"]),
    Script("cleopatra moon", "كليوباترا أقرب لعصرنا من الأهرامات! #shorts", [
        "معلومة ستغير نظرتك للتاريخ!",
        "كليوباترا عاشت أقرب زمنياً لهبوط الإنسان على القمر",
        "من زمن بناء الهرم الأكبر!",
        "الهرم الأكبر بُني قبل حوالي 4500 سنة",
        "وكليوباترا عاشت قبل حوالي 2050 سنة فقط",
        "يعني الأهرامات كانت أثراً قديماً حتى في زمنها",
        "والآن.. أعد المشاهدة وانتبه للبداية",
    ], "مقارنة زمنية مذهلة بين كليوباترا والأهرامات. #تاريخ #هل_تعلم #shorts",
        ["تاريخ", "هل تعلم", "كليوباترا", "الأهرامات", "مصر", "حقائق", "غرائب", "ثقافة"],
        ["pyramids", "egypt", "moon"]),
    Script("wombat", "حيوان فضلاته على شكل مكعبات! #shorts", [
        "هل سمعت عن حيوان يصنع مكعبات؟",
        "إنه الومبت.. حيوان من أستراليا",
        "فضلاته تخرج على شكل مكعبات تقريباً!",
        "والسبب أن جدران أمعائه مرنة بشكل غير متساوٍ",
        "ويستخدم هذه المكعبات لتحديد منطقته",
        "لأنها لا تتدحرج بسهولة على الصخور",
        "والآن.. أعد المشاهدة وانتبه للبداية",
    ], "الومبت وأغرب حقيقة في عالم الحيوان. #حيوانات #هل_تعلم #shorts",
        ["حيوانات", "هل تعلم", "أستراليا", "ومبت", "غرائب", "حقائق", "طبيعة", "علوم"],
        ["wombat", "australia", "wildlife"]),
    Script("lightning", "البرق أسخن من سطح الشمس! #shorts", [
        "شيء على الأرض أسخن من سطح الشمس!",
        "إنه البرق",
        "حرارة البرق قد تصل إلى ثلاثين ألف درجة",
        "بينما سطح الشمس حوالي خمسة آلاف وخمسمئة درجة",
        "يعني البرق أسخن بحوالي خمس مرات",
        "لكنه يستمر جزءاً صغيراً جداً من الثانية",
        "والآن.. أعد المشاهدة وانتبه للبداية",
    ], "حرارة البرق مقارنة بالشمس. #علوم #هل_تعلم #shorts",
        ["علوم", "هل تعلم", "برق", "الشمس", "طقس", "حقائق", "فيزياء", "غرائب"],
        ["lightning", "storm", "sun"]),
    Script("oxford aztec", "جامعة أقدم من إمبراطورية الأزتك! #shorts", [
        "جامعة أقدم من إمبراطورية كاملة!",
        "جامعة أكسفورد بدأت التدريس حوالي عام 1096",
        "أما مدينة تينوتشتيتلان عاصمة الأزتك",
        "فتأسست حوالي عام 1325",
        "يعني الجامعة أقدم بأكثر من مئتي سنة",
        "التاريخ مليء بالمفاجآت",
        "والآن.. أعد المشاهدة وانتبه للبداية",
    ], "مقارنة تاريخية غير متوقعة. #تاريخ #هل_تعلم #shorts",
        ["تاريخ", "هل تعلم", "أكسفورد", "الأزتك", "جامعات", "حقائق", "غرائب", "ثقافة"],
        ["oxford", "university", "ancient city"]),
    Script("sunlight", "الشمس التي تراها الآن.. من الماضي! #shorts", [
        "الشمس التي تراها الآن ليست شمس الآن!",
        "الضوء يحتاج حوالي ثماني دقائق وعشرين ثانية",
        "ليصل من الشمس إلى الأرض",
        "يعني أنت ترى الشمس كما كانت قبل ثماني دقائق",
        "ولو اختفت الشمس فجأة",
        "لن نلاحظ ذلك إلا بعد ثماني دقائق",
        "والآن.. أعد المشاهدة وانتبه للبداية",
    ], "سرعة الضوء والمسافة إلى الشمس. #فضاء #هل_تعلم #shorts",
        ["فضاء", "هل تعلم", "الشمس", "الضوء", "فيزياء", "حقائق", "علوم", "فلك"],
        ["sun", "sunrise", "space"]),
    Script("sloth breath", "حيوان يحبس أنفاسه 40 دقيقة! #shorts", [
        "من يستطيع حبس أنفاسه أربعين دقيقة؟",
        "ليس غواصاً.. بل حيوان الكسلان!",
        "الكسلان يستطيع حبس أنفاسه حتى أربعين دقيقة",
        "لأنه يبطئ نبضات قلبه بشكل كبير",
        "وهو سباح ماهر رغم بطئه على الأشجار",
        "الطبيعة دائماً تفاجئنا",
        "والآن.. أعد المشاهدة وانتبه للبداية",
    ], "مهارة خفية عند حيوان الكسلان. #حيوانات #هل_تعلم #shorts",
        ["حيوانات", "هل تعلم", "كسلان", "طبيعة", "غرائب", "حقائق", "غابات", "علوم"],
        ["sloth", "rainforest", "river"]),
    Script("eiffel summer", "برج إيفل يطول في الصيف! #shorts", [
        "هل تعلم أن برج إيفل يطول في الصيف؟",
        "الحديد يتمدد عندما يسخن",
        "وفي أيام الصيف الحارة",
        "قد يزيد ارتفاع البرج حتى خمسة عشر سنتيمتراً",
        "ثم يعود ويتقلص في الشتاء",
        "هذا اسمه التمدد الحراري",
        "والآن.. أعد المشاهدة وانتبه للبداية",
    ], "برج إيفل والتمدد الحراري. #علوم #هل_تعلم #shorts",
        ["علوم", "هل تعلم", "برج إيفل", "فرنسا", "فيزياء", "حقائق", "غرائب", "هندسة"],
        ["eiffel tower", "paris", "summer"]),
    Script("blue whale heart", "قلب يزن مثل بقرة كاملة! #shorts", [
        "قلب يزن أكثر من مئة وثمانين كيلوغراماً!",
        "إنه قلب الحوت الأزرق",
        "أكبر حيوان عاش على الأرض على الإطلاق",
        "أكبر حتى من أضخم الديناصورات المعروفة",
        "ونبضات قلبه يمكن سماعها من مسافة بعيدة تحت الماء",
        "عملاق المحيط بحق",
        "والآن.. أعد المشاهدة وانتبه للبداية",
    ], "حقائق مذهلة عن الحوت الأزرق. #حيوانات #هل_تعلم #shorts",
        ["حيوانات", "هل تعلم", "الحوت الأزرق", "المحيط", "حقائق", "غرائب", "طبيعة", "علوم"],
        ["blue whale", "ocean", "underwater"]),
]


def _load_json(name: str) -> list[Script]:
    from .config import ROOT
    path = ROOT / "data" / name
    if not path.exists():
        return []
    return [Script(**item) for item in json.loads(path.read_text(encoding="utf-8"))]


def load_bank() -> list[Script]:
    """Hand-checked scripts: real mysteries first, general facts as a reserve."""
    return _load_json("mysteries.json") + _load_json("facts.json") + list(FALLBACK_BANK)


def generate_offline(used: list[str]) -> Script:
    bank = load_bank()
    fresh = [s for s in bank if s.topic not in used]
    if not fresh:
        return random.choice(bank)
    # Keep the bank's order of preference: the first unused mystery comes before any fact.
    preferred = [s for s in fresh if s in _load_json("mysteries.json")]
    # full stories (45-60 s) hold viewers longer than short ones, so they go first
    full = [s for s in preferred if len(s.lines) >= 12]
    return random.choice(full or preferred or fresh)


def generate(cfg: Config, used: list[str]) -> Script:
    if cfg.kind == "news" and cfg.anthropic_key:
        try:
            return generate_news(cfg, used)
        except Exception as exc:  # no fresh news today: a mystery story still goes out
            print(f"[news] failed ({type(exc).__name__}: {str(exc)[:200]}); making a mystery Short")
    if cfg.anthropic_key and not _has_fresh_long(used):
        return generate_with_claude(cfg, used)
    return generate_offline(used)


def _has_fresh_long(used: list[str]) -> bool:
    return any(len(s.lines) >= 12 and s.topic not in used for s in _load_json("mysteries.json"))
