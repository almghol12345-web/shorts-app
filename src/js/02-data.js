/* ================= definitions ================= */
const RES = {
  food: { n: { ar: 'غذاء', en: 'Food' }, i: '🌽' }, wood: { n: { ar: 'خشب', en: 'Wood' }, i: '🪵' },
  iron: { n: { ar: 'حديد', en: 'Iron' }, i: '🔩' }, fuel: { n: { ar: 'وقود', en: 'Fuel' }, i: '⛽' },
  gems: { n: { ar: 'جواهر', en: 'Gems' }, i: '💎' }, exp: { n: { ar: 'خبرة أبطال', en: 'Hero XP' }, i: '✨' },
};
const ITEMS = {
  ticket: { n: { ar: 'تذكرة تجنيد', en: 'Recruit Ticket' }, i: '🎟️', d: { ar: 'تجنيد بطل واحد', en: 'Recruit one hero' } },
  sp5: { n: { ar: 'تسريع 5 دقائق', en: '5-min Speedup' }, i: '⏩', d: { ar: 'يقلل أي مؤقت 5 دقائق', en: 'Cuts any timer by 5 minutes' } },
  sp60: { n: { ar: 'تسريع ساعة', en: '1-hour Speedup' }, i: '⏭️', d: { ar: 'يقلل أي مؤقت 60 دقيقة', en: 'Cuts any timer by 60 minutes' } },
  stam: { n: { ar: 'علبة طاقة', en: 'Energy Can' }, i: '🥫', d: { ar: '+50 طاقة للعالم', en: '+50 world energy' } },
  spin: { n: { ar: 'دورة عجلة', en: 'Wheel Spin' }, i: '🎡', d: { ar: 'دورة مجانية في عجلة الحظ', en: 'A free lucky wheel spin' } },
};
const MAXLV = 30;
const BT = {
  hq: { n: { ar: 'مقر القيادة', en: 'Headquarters' }, i: '🏛️', d: { ar: 'قلب القاعدة. تطويره يفتح مباني جديدة ويرفع الحد الأعلى لكل المباني.', en: 'The heart of your base. Upgrading it unlocks new buildings and raises every building’s level cap.' }, base: { wood: 120, iron: 90 }, t: 15 },
  farm: { n: { ar: 'المزرعة', en: 'Farm' }, i: '🌾', d: { ar: 'تنتج الغذاء اللازم للبناء وتدريب الجنود.', en: 'Grows food for building and training troops.' }, prod: 'food', base: { wood: 50 }, t: 6 },
  saw: { n: { ar: 'المنشرة', en: 'Sawmill' }, i: '🪓', d: { ar: 'تنتج الخشب من بقايا المدينة.', en: 'Cuts wood from the city ruins.' }, prod: 'wood', base: { food: 50 }, t: 6 },
  mine: { n: { ar: 'منجم الحديد', en: 'Iron Mine' }, i: '⛏️', d: { ar: 'ينتج الحديد للمباني والأسلحة.', en: 'Digs iron for buildings and weapons.' }, prod: 'iron', base: { food: 60, wood: 60 }, t: 7 },
  oil: { n: { ar: 'مصفاة الوقود', en: 'Fuel Refinery' }, i: '🛢️', d: { ar: 'تنتج الوقود للمباني المتقدمة والأبحاث.', en: 'Refines fuel for advanced buildings and research.' }, prod: 'fuel', base: { wood: 100, iron: 80 }, t: 8 },
  barracks: { n: { ar: 'الثكنة', en: 'Barracks' }, i: '🎖️', d: { ar: 'تدرّب الجنود. الجنود يرفعون هجوم الأبطال ويدافعون عن القاعدة.', en: 'Trains troops. Troops boost hero attack and defend the base.' }, base: { food: 80, wood: 80 }, t: 8 },
  hospital: { n: { ar: 'المستشفى', en: 'Hospital' }, i: '🏥', d: { ar: 'يستقبل الجنود الجرحى بعد المعارك. الجرحى خارج السعة يموتون.', en: 'Treats wounded troops after battles. Wounded beyond capacity are lost.' }, base: { wood: 90, iron: 40 }, t: 8 },
  lab: { n: { ar: 'مختبر الأبحاث', en: 'Research Lab' }, i: '🔬', d: { ar: 'يفتح الأبحاث التي تقوي الإنتاج والقتال.', en: 'Unlocks research that boosts production and combat.' }, base: { wood: 120, iron: 100 }, t: 10 },
  wall: { n: { ar: 'السور', en: 'Wall' }, i: '🧱', d: { ar: 'يصد هجمات الزومبي على القاعدة. مطلوب لتطوير المقر.', en: 'Holds back zombie raids. Required to upgrade the HQ.' }, base: { wood: 100, iron: 60 }, t: 9 },
  warehouse: { n: { ar: 'المستودع', en: 'Warehouse' }, i: '📦', d: { ar: 'يرفع سعة التخزين في المباني ويحمي الموارد من النهب.', en: 'Raises building storage and protects resources from raids.' }, base: { wood: 80, food: 60 }, t: 7 },
  tavern: { n: { ar: 'قاعة الأبطال', en: 'Hero Hall' }, i: '🎯', d: { ar: 'ترفع الحد الأقصى لمستوى الأبطال.', en: 'Raises the hero level cap.' }, base: { food: 100, wood: 100 }, t: 9 },
  radar: { n: { ar: 'برج الرادار', en: 'Radar Tower' }, i: '📡', d: { ar: 'يزيد عدد المسيرات التي ترسلها في العالم.', en: 'Adds more marches you can send into the world.' }, base: { wood: 150, iron: 150 }, t: 10 },
};
const PLOTS = [
  { k: 'hq', t: 'hq', u: 1 },
  { k: 'farm1', t: 'farm', u: 1 }, { k: 'saw1', t: 'saw', u: 1 }, { k: 'barracks', t: 'barracks', u: 1 },
  { k: 'tavern', t: 'tavern', u: 1 }, { k: 'mine1', t: 'mine', u: 2 }, { k: 'wall', t: 'wall', u: 2 },
  { k: 'warehouse', t: 'warehouse', u: 2 }, { k: 'hospital', t: 'hospital', u: 3 }, { k: 'lab', t: 'lab', u: 3 },
  { k: 'farm2', t: 'farm', u: 4 }, { k: 'saw2', t: 'saw', u: 4 }, { k: 'oil1', t: 'oil', u: 5 },
  { k: 'radar', t: 'radar', u: 5 }, { k: 'mine2', t: 'mine', u: 6 }, { k: 'farm3', t: 'farm', u: 8 },
  { k: 'saw3', t: 'saw', u: 9 }, { k: 'oil2', t: 'oil', u: 10 }, { k: 'mine3', t: 'mine', u: 11 },
];
const PLOT = Object.fromEntries(PLOTS.map(p => [p.k, p]));
const TECH = {
  food: { n: { ar: 'زراعة مائية', en: 'Hydroponics' }, i: '🌱', d: { ar: '+5% إنتاج الغذاء لكل مستوى', en: '+5% food production per level' } },
  wood: { n: { ar: 'مناشير كهربائية', en: 'Power Saws' }, i: '🪚', d: { ar: '+5% إنتاج الخشب لكل مستوى', en: '+5% wood production per level' } },
  iron: { n: { ar: 'تعدين عميق', en: 'Deep Mining' }, i: '⚒️', d: { ar: '+5% إنتاج الحديد لكل مستوى', en: '+5% iron production per level' } },
  fuel: { n: { ar: 'تكرير متقدم', en: 'Advanced Refining' }, i: '🧪', d: { ar: '+5% إنتاج الوقود لكل مستوى', en: '+5% fuel production per level' } },
  build: { n: { ar: 'هندسة إنشائية', en: 'Construction' }, i: '🏗️', d: { ar: '+4% سرعة البناء لكل مستوى', en: '+4% build speed per level' } },
  train: { n: { ar: 'تدريب مكثف', en: 'Drill Training' }, i: '🏃', d: { ar: '+5% سرعة التدريب لكل مستوى', en: '+5% training speed per level' } },
  atk: { n: { ar: 'ذخيرة خارقة', en: 'Piercing Rounds' }, i: '💥', d: { ar: '+4% هجوم الأبطال لكل مستوى', en: '+4% hero attack per level' } },
  hp: { n: { ar: 'دروع كيفلار', en: 'Kevlar Armor' }, i: '🦺', d: { ar: '+4% صحة الأبطال لكل مستوى', en: '+4% hero health per level' } },
  def: { n: { ar: 'تحصينات', en: 'Fortification' }, i: '🛡️', d: { ar: '+4% دفاع الأبطال والسور لكل مستوى', en: '+4% hero and wall defense per level' } },
  march: { n: { ar: 'لوجستيات', en: 'Logistics' }, i: '🚚', d: { ar: '+8% سرعة المسير والجمع لكل مستوى', en: '+8% march and gathering speed per level' } },
};
const CLS = { tank: { n: { ar: 'مدافع', en: 'Tank' }, i: '🛡️' }, atk: { n: { ar: 'مهاجم', en: 'Attacker' }, i: '⚔️' }, sup: { n: { ar: 'داعم', en: 'Support' }, i: '✚' } };
const RAR = [null, { n: { ar: 'نادر', en: 'Rare' }, c: 'var(--r1)' }, { n: { ar: 'ملحمي', en: 'Epic' }, c: 'var(--r2)' }, { n: { ar: 'أسطوري', en: 'Legendary' }, c: 'var(--r3)' }];
const RM = [0, .7, 1, 1.35];
const H = (id, ar, en, r, c, sk, skar, sken, qar, qen, rar, ren) => ({ id, n: { ar, en }, r, c, sk, skn: { ar: skar, en: sken }, q: { ar: qar, en: qen }, role: { ar: rar, en: ren } });
const HEROES = [
  H('redking', 'الملك الأحمر', 'Red King', 3, 'tank', 'stun', 'غضب الملك', 'King’s Wrath', 'آخر ملوك المدينة. سيفه المشتعل يهز الأرض تحت أقدام الموتى.', 'The last king of the city. His burning blade shakes the ground beneath the dead.', 'محارب ضخم', 'Juggernaut'),
  H('destroyer', 'المدمر', 'Destroyer', 3, 'atk', 'air', 'عاصفة الفراغ', 'Void Storm', 'ساحر من ظلام الأبراج القديمة. يفتح السماء على أعدائه.', 'A sorcerer from the dark old towers. He tears the sky open on his enemies.', 'ساحر', 'Mage'),
  H('fire', 'النار', 'Inferno', 3, 'atk', 'aoe', 'الجحيم', 'Hellfire', 'وُلد من رماد المدينة المحترقة. كل خطوة منه تترك حريقاً.', 'Born from the ashes of the burning city. Every step leaves a fire behind.', 'مدمر', 'Ravager'),
  H('knight', 'الفرسان', 'Knight', 2, 'tank', 'shield', 'درع الشرف', 'Oath Shield', 'قائد فرسان الحصن. درعه يحمي الفريق كله.', 'Captain of the fortress knights. His oath shields the whole squad.', 'محارب', 'Warrior'),
  H('lightning', 'البرق', 'Lightning', 2, 'atk', 'snipe', 'طلقة البرق', 'Lightning Shot', 'قناص القوات الخاصة. طلقته أسرع من صوتها.', 'Special-forces sniper. His bullet lands before you hear it.', 'قناص', 'Sniper'),
  H('shadow', 'الظل', 'Shadow', 2, 'atk', 'rapid', 'رقصة الخناجر', 'Blade Dance', 'قاتلة تتحرك في الليل. ما أحد يسمعها لين يفوت الأوان.', 'An assassin who moves by night. No one hears her until it is too late.', 'قاتل', 'Assassin'),
  H('medic', 'الطبيب', 'Medic', 2, 'sup', 'heal', 'نور الشفاء', 'Healing Light', 'طبيبة الميدان. يدها الخضراء ترجّع الأبطال للقتال.', 'The field doctor. Her green light brings heroes back into the fight.', 'معالج', 'Healer'),
  H('mountain', 'الجبل', 'Mountain', 1, 'tank', 'stun', 'ضربة الجبل', 'Mountain Slam', 'محارب من الجبال الثلجية. فأسه يكسر الصخر.', 'A warrior from the snowy peaks. His axe splits stone.', 'مقاتل', 'Fighter'),
  H('hawk', 'الصقر', 'Hawk', 1, 'atk', 'snipe', 'سهم الصقر', 'Hawk Arrow', 'رامٍ ملثّم يرافقه صقره. سهمه ما يخطئ.', 'A masked archer with his hawk. His arrow never misses.', 'رامي', 'Archer'),
  H('wind', 'الريح', 'Gale', 1, 'sup', 'buff', 'اندفاع الريح', 'Wind Rush', 'مبارز سريع كالريح. يشعل حماس الفريق ويضاعف سرعتهم.', 'A swordsman swift as the wind. He fires up the squad and speeds them on.', 'مسرع', 'Swift'),
];
const OLD_HERO = { reem: 'lightning', saqr: 'knight', layla: 'medic', noura: 'destroyer', khalid: 'redking', dana: 'wind', jaser: 'fire', nimr: 'mountain', hala: 'shadow', fares: 'wind', omar: 'hawk', salem: 'hawk', mona: 'medic', badr: 'mountain', ziad: 'fire', sara: 'medic' };
const HB = Object.fromEntries(HEROES.map(h => [h.id, h]));
const ZT = {
  w: { i: '🧟', n: { ar: 'زاحف', en: 'Walker' }, hp: 1, atk: 1, spd: 30, r: 15 },
  run: { i: '🧟‍♀️', n: { ar: 'عدّاء', en: 'Runner' }, hp: .6, atk: .8, spd: 62, r: 14 },
  sp: { i: '🤢', n: { ar: 'باصق', en: 'Spitter' }, hp: .8, atk: .9, spd: 26, r: 15, range: true },
  br: { i: '👹', n: { ar: 'متوحش', en: 'Brute' }, hp: 4, atk: 1.8, spd: 19, r: 21 },
  boss: { i: '👺', n: { ar: 'زعيم', en: 'Boss' }, hp: 22, atk: 3, spd: 15, r: 32 },
  wb: { i: '🦍', n: { ar: 'العملاق', en: 'The Colossus' }, hp: 1, atk: 2.2, spd: 24, r: 48 },
};
const BOTS = [['أبو فهد', 'Abu Fahad'], ['سلطان', 'Sultan'], ['غيمة', 'Ghaima'], ['مشعل', 'Mishal'], ['سعود', 'Saud'], ['نوف', 'Nouf'], ['عبدالعزيز', 'Abdulaziz'], ['ريان', 'Rayan'], ['شهد', 'Shahad'], ['تركي', 'Turki'], ['لمى', 'Lama'], ['حمد', 'Hamad'], ['جود', 'Joud'], ['بندر', 'Bandar']].map(([ar, en]) => ({ ar, en }));
const ALLIES = [
  { n: { ar: 'نسور الصحراء', en: 'Desert Eagles' }, tag: 'NSR', lv: 7, col: '#a9521f' },
  { n: { ar: 'ذئاب الليل', en: 'Night Wolves' }, tag: 'DHB', lv: 5, col: '#3f6f96' },
  { n: { ar: 'حراس الفجر', en: 'Dawn Guard' }, tag: 'FJR', lv: 9, col: '#5d4a8a' },
];
const CHATL = [
  ['أحد يساعدني في البناء؟ 🙏', 'Anyone help me with my build? 🙏'], ['الموجة اليوم قوية انتبهوا', 'The horde is strong today, watch out'], ['وصلت المرحلة الجديدة 🔥', 'Just reached a new stage 🔥'],
  ['مين عنده النار؟ قوي مرة', 'Who has Inferno? He is a beast'], ['لا تنسون هدية التحالف', 'Don’t forget the alliance gift'], ['الله يعطيكم العافية يا شباب', 'Good work, everyone'],
  ['فيه معسكر زومبي مستوى عالي قرب الطريق الشرقي', 'High-level zombie camp near the east road'], ['طوروا السور قبل الهجوم', 'Upgrade your wall before the raid'], ['ساعدتكم كلكم 💪', 'Helped all of you 💪'],
  ['صباح الخير يا ناجين', 'Morning, survivors'], ['أحد جرب الملك الأحمر مع الطبيب؟ تشكيلة قوية', 'Tried Red King with Medic? Strong combo'], ['الزعيم العالمي اليوم سهل 😎', 'World boss is easy today 😎'],
].map(([ar, en]) => ({ ar, en }));
const CHATR = [['😂👍', '😂👍'], ['صح كلامك', 'True'], ['تم يا بطل', 'Done, hero'], ['الله يوفقك', 'Good luck'], ['أنا معك', 'I’m with you'], ['💪💪', '💪💪']].map(([ar, en]) => ({ ar, en }));
const DAILY = [
  { k: 'collect', g: 5 }, { k: 'win', g: 3 }, { k: 'build', g: 2 }, { k: 'train', g: 1 },
  { k: 'recruit', g: 1 }, { k: 'gather', g: 1 }, { k: 'research', g: 1 }, { k: 'spin', g: 1 },
];
const CHESTS = [{ p: 30, r: { gems: 50, food: 3000 } }, { p: 60, r: { gems: 80, sp5: 2 } }, { p: 90, r: { gems: 120, ticket: 1 } }, { p: 120, r: { gems: 200, sp60: 1, exp: 2000 } }];
const LOGIN = [{ gems: 100 }, { food: 5000, wood: 5000 }, { ticket: 1 }, { sp60: 1 }, { exp: 3000 }, { gems: 300 }, { ticket: 3, gems: 200 }];
const WHEEL = [
  { r: { gems: 50 }, w: 20, c: '#2b3a46' }, { r: { food: 6000 }, w: 18, c: '#3b2f1c' }, { r: { ticket: 1 }, w: 7, c: '#4a2b56' }, { r: { sp5: 3 }, w: 16, c: '#1f3a33' },
  { r: { exp: 4000 }, w: 16, c: '#2b3a46' }, { r: { gems: 300 }, w: 3, c: '#5a3a14' }, { r: { sp60: 1 }, w: 8, c: '#4a2b56' }, { r: { iron: 4000 }, w: 12, c: '#1f3a33' },
];
const VIPT = [0, 100, 300, 700, 1500, 3000, 6000, 12000, 25000, 50000, 100000];
const PASS_TIERS = 30, PASS_XP = 100;
function passReward(tier, prem) {
  if (!prem) { if (tier % 5 === 0) return { ticket: 1, gems: 50 }; return [{ gems: 30 + tier * 2 }, { food: 2000 + tier * 300 }, { sp5: 2 }, { exp: 1500 + tier * 200 }][tier % 4]; }
  if (tier === PASS_TIERS) return { hero: 'redking', gems: 1000 };
  if (tier === 15) return { hero: 'destroyer', gems: 500 };
  if (tier % 3 === 0) return { ticket: 2, gems: 100 };
  if (tier % 4 === 0) return { sp60: 2, gems: 80 };
  return { gems: 80 + tier * 5, exp: 3000 + tier * 300 };
}
/* In-app purchase catalog. IDs must match App Store Connect (prefix from CFG). */
const IAP = [
  { id: 'gems1', kind: 'gems', gems: 100, usd: 0.99, i: '💎', vip: 100 },
  { id: 'gems2', kind: 'gems', gems: 550, usd: 4.99, i: '💰', vip: 500 },
  { id: 'gems3', kind: 'gems', gems: 1200, usd: 9.99, i: '👜', vip: 1000, tag: 'popular' },
  { id: 'gems4', kind: 'gems', gems: 2600, usd: 19.99, i: '🧳', vip: 2000 },
  { id: 'gems5', kind: 'gems', gems: 7000, usd: 49.99, i: '🗃️', vip: 5000 },
  { id: 'gems6', kind: 'gems', gems: 15000, usd: 99.99, i: '🏦', vip: 10000, tag: 'best' },
  { id: 'starter', kind: 'starter', usd: 1.99, i: '🎁', vip: 200, r: { gems: 500, ticket: 5, sp60: 3, food: 50000, wood: 50000, hero: 'fire' } },
  { id: 'monthly', kind: 'monthly', usd: 4.99, i: '📅', vip: 500, gems: 300, daily: 100, days: 30 },
  { id: 'pass', kind: 'pass', usd: 9.99, i: '🎖️', vip: 1000 },
];
const IAPB = Object.fromEntries(IAP.map(p => [p.id, p]));
const ACH = [
  { k: 'kills', i: '🧟', v: () => S.stats.kills, tiers: [100, 1000, 10000, 100000] },
  { k: 'stage', i: '⚔️', v: () => S.stage - 1, tiers: [10, 25, 50, 100] },
  { k: 'heroes', i: '🦸', v: () => ownedHeroes().length, tiers: [4, 6, 8, 10] },
  { k: 'power', i: '💪', v: () => totalPower(), tiers: [10000, 50000, 200000, 1000000] },
  { k: 'sieges', i: '🛡️', v: () => S.stats.sieges, tiers: [5, 25, 100, 300] },
  { k: 'recruits', i: '🎟️', v: () => S.stats.recruits, tiers: [10, 50, 200, 500] },
  { k: 'gathered', i: '🚚', v: () => S.stats.gathered, tiers: [10, 50, 200, 500] },
  { k: 'hq', i: '🏛️', v: () => hqLv(), tiers: [5, 10, 15, 20, 25, 30] },
  { k: 'boss', i: '🦍', v: () => S.stats.bossDmg, tiers: [100000, 1000000, 10000000, 100000000] },
];
const achReward = tier => ({ gems: [50, 100, 200, 400, 800, 1500][tier] || 1500 });
