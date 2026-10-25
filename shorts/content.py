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
    },
    "required": ["topic", "title", "lines", "description", "tags", "search_terms"],
    "additionalProperties": False,
}

PROMPT = """You write scripts for a faceless YouTube Shorts channel. Your only goal is
retention: viewers must watch to the very last second and replay.

Niche: {niche}
Language of the video: {language} (use simple, spoken, energetic language)

Write ONE new Short. Rules:
- The fact must be true and verifiable. No myths, no exaggeration, no medical or financial advice.
- Line 1 (the hook, spoken in under 2 seconds): a shocking claim, a "you" question, or a
  pattern break. Never start with greetings, "did you know", or the channel name.
- Line 2 opens a loop: promise a payoff that only comes at the end (e.g. "but the reason is stranger").
- Middle lines: build tension; every line adds a new surprising detail (a number, place, or date).
- The payoff/reveal comes in the second-to-last line, never earlier.
- Last line must flow naturally back into line 1 so the video loops seamlessly when it restarts
  (it can end mid-thought that line 1 completes). NO "follow us", "like", or "subscribe" line.
- 6 to 8 lines, each 3 to 9 words, total spoken length 20-30 seconds.
- title: under 60 characters, creates curiosity without giving away the answer, ends with " #shorts".
- description: one curiosity sentence, then "تابع القناة لحقيقة جديدة كل يوم", then 3 hashtags.
- tags: 8 short tags in the video language.
- search_terms: 6 simple English keywords for stock footage, one per visual moment, in order.
- Do NOT reuse any of these previous topics: {used}
"""


def generate_with_claude(cfg: Config, used: list[str]) -> Script:
    import anthropic

    client = anthropic.Anthropic(api_key=cfg.anthropic_key)
    request = dict(
        model=cfg.model,
        max_tokens=4000,
        output_config={"effort": "medium", "format": {"type": "json_schema", "schema": SCHEMA}},
        messages=[{"role": "user", "content": PROMPT.format(
            niche=cfg.niche, language=cfg.language, used=", ".join(used[-200:]) or "none")}],
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
    return Script(**json.loads(text))


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


def generate_offline(used: list[str]) -> Script:
    fresh = [s for s in FALLBACK_BANK if s.topic not in used]
    return random.choice(fresh or FALLBACK_BANK)


def generate(cfg: Config, used: list[str]) -> Script:
    if cfg.anthropic_key:
        return generate_with_claude(cfg, used)
    return generate_offline(used)
