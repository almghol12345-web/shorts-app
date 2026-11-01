/* ================= story: chapters told by the heroes =================
 * The 40 main quests are split into 8 chapters of 5. Each chapter opens with a short scene
 * (hero portrait + lines) and pays a chapter chest when its last quest is claimed.
 */
const CH_LEN = 5;
const CHAPTERS = [
  { t: { ar: 'الشرارة الأولى', en: 'The First Spark' }, r: { gems: 150, ticket: 1 }, lines: [
    ['wind', 'المدينة سقطت في ليلة وحدة، يا قائد. اللي بقوا منّا يدورون أحد يقودهم.', 'The city fell in a single night, Commander. Those of us left are looking for someone to lead.'],
    ['mountain', 'عندنا حجارة وخشب وشوية أكل. ابنِ لنا ملجأ، ونحن نحميه.', 'We have stone, wood and a little food. Build us a shelter, and we will guard it.'],
  ] },
  { t: { ar: 'أسوار من رماد', en: 'Walls of Ash' }, r: { gems: 200, sp60: 1 }, lines: [
    ['hawk', 'شفت آثارهم من فوق السطح. الموتى يقربون كل ليلة أكثر.', 'I saw their tracks from the rooftops. The dead come closer every night.'],
    ['mountain', 'السور أول شي. بدون سور ما فيه بكرة.', 'The wall comes first. Without a wall there is no tomorrow.'],
  ] },
  { t: { ar: 'صوت في اللاسلكي', en: 'A Voice on the Radio' }, r: { gems: 250, ticket: 1 }, lines: [
    ['medic', 'التقطنا إشارة من الشرق! ناجين غيرنا، بس يحتاجون أدوية ومعرفة.', 'We caught a signal from the east! Other survivors, but they need medicine and knowledge.'],
    ['lightning', 'المختبر يرجّع لنا العلم، والخريطة توصلنا لهم. نتحرك؟', 'The lab will bring back our science, and the map will lead us to them. Do we move?'],
  ] },
  { t: { ar: 'تحالف الناجين', en: 'The Survivors’ Pact' }, r: { gems: 300, sp60: 2 }, lines: [
    ['knight', 'وحدنا ما نصمد. الفرسان يعرفون إن القوة في الجماعة.', 'Alone we will not last. Knights know that strength lies in numbers.'],
    ['shadow', 'وشي ثاني… شفت شي ضخم يتحرك في الضباب. أكبر من أي زومبي.', 'And something else… I saw something huge moving in the fog. Bigger than any zombie.'],
  ] },
  { t: { ar: 'الطريق الشرقي', en: 'The East Road' }, r: { gems: 350, ticket: 2 }, lines: [
    ['lightning', 'الطريق الشرقي مليان معسكرات. كل معسكر نطهّره يفتح لنا أرض جديدة.', 'The east road is full of camps. Every camp we clear opens new ground.'],
    ['hawk', 'جهّز أبطالك يا قائد. اللي جاي أصعب.', 'Ready your heroes, Commander. What comes next is harder.'],
  ] },
  { t: { ar: 'قلب المصفاة', en: 'Heart of the Refinery' }, r: { gems: 400, sp60: 2 }, lines: [
    ['fire', 'الوقود هو النار اللي تحرّك كل شي. ولا أحد يفهم النار مثلي.', 'Fuel is the fire that moves everything. And no one understands fire like I do.'],
    ['destroyer', 'والرادار يكشف لنا ما وراء الضباب… حتى الأشياء اللي ما نبي نشوفها.', 'And the radar will show us what lies beyond the fog… even the things we would rather not see.'],
  ] },
  { t: { ar: 'العملاق يستيقظ', en: 'The Colossus Wakes' }, r: { gems: 500, ticket: 3 }, lines: [
    ['destroyer', 'الشي اللي شافته الظل… صار له اسم. العملاق. الأرض ترجف تحت رجله.', 'The thing Shadow saw… now has a name. The Colossus. The ground shakes beneath it.'],
    ['redking', 'حكمت هالمدينة قبل لا تسقط، وبحكمها بعد ما ترجع. اتبعني يا قائد.', 'I ruled this city before it fell, and I will rule it again. Follow me, Commander.'],
  ] },
  { t: { ar: 'فجر جديد', en: 'A New Dawn' }, r: { gems: 1000, ticket: 5 }, lines: [
    ['redking', 'انظر حولك. من رماد المدينة بنيت مملكة.', 'Look around you. From the ashes of the city you built a kingdom.'],
    ['medic', 'الناس يبتسمون من جديد… هذا هو الفجر اللي كنا نستناه.', 'People are smiling again… this is the dawn we were waiting for.'],
  ] },
];
const chapterOf = qi => Math.min(CHAPTERS.length - 1, Math.floor(qi / CH_LEN));
const chapterProgress = () => { const c = chapterOf(S.quest); return { c, done: S.quest - c * CH_LEN, of: CH_LEN }; };
function mStory(ci, reward) {
  const ch = CHAPTERS[ci]; if (!ch) return sheet('📖', '', '', '');
  const lines = ch.lines.map(([id, ar, en], i) => `<div class="story-line ${i % 2 ? 'alt' : ''}">${HB[id] ? `<img src="${portraitURI(id)}" alt="">` : ''}<div><b>${esc(HB[id] ? L(HB[id].n) : '')}</b><p>${esc(LANG === 'ar' ? ar : en)}</p></div></div>`).join('');
  return sheet('📖', t('chapter_n', ci + 1) + ' · ' + esc(L(ch.t)), reward ? t('chapter_done_sub') : t('chapter_new_sub'),
    `${reward ? `<div class="li hot"><span class="lic">🏆</span><div class="lit"><b>${t('chapter_reward')}</b><div class="row">${rewHTML(reward)}</div></div></div>` : ''}${lines}<button class="btn pri wide" data-a="close">${reward ? t('great') : t('lets_go')}</button>`);
}
function storyOnQuestClaim(prevQuest) {
  const pc = chapterOf(prevQuest), nc = chapterOf(S.quest);
  if (S.quest % CH_LEN === 0 && S.quest > prevQuest) {
    const r = CHAPTERS[pc].r; give(r); S.storySeen = Math.max(S.storySeen || 0, pc + 1);
    queuePopup(() => mStory(pc, r));
    if (S.quest < QUESTS.length && nc !== pc) queuePopup(() => mStory(nc));
  }
}
