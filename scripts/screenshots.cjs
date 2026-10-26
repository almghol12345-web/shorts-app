// Builds App Store screenshots (1290x2796, iPhone 6.7"/6.9") from a mid-game save.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const d64 = (f, t) => `data:${t};base64,` + fs.readFileSync(f).toString('base64');
const KEY = 'fajr-naajin-save-v1';
const SHOTS = [
  ['base', 'ابنِ قاعدتك وسط الخراب', 'طوّر 19 مبنى وجهّز دفاعاتك'],
  ['battle', 'اصمد أمام الزومبي', 'معارك حية ومهارات تطلقها بلمسة'],
  ['heroes', 'جنّد أبطالاً أسطوريين', '12 بطلاً بقدرات مختلفة'],
  ['world', 'استكشف عالماً مدمّراً', 'معسكرات زومبي وحقول موارد'],
  ['alliance', 'تحالف مع الناجين', 'مساعدات وهدايا يومية'],
];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 });
  const pg = await ctx.newPage();
  const url = 'file://' + path.resolve('www/index.html');
  await pg.goto(url); await pg.waitForTimeout(400);
  await pg.click('[data-a=close]'); await pg.waitForTimeout(5600);
  const saved = await pg.evaluate(KEY => {
    const s = JSON.parse(localStorage.getItem(KEY));
    const L = { hq: 9, farm1: 9, saw1: 9, barracks: 8, tavern: 7, mine1: 8, wall: 8, warehouse: 6, hospital: 6, lab: 6, farm2: 8, saw2: 7, oil1: 6, radar: 5, mine2: 5, farm3: 3, saw3: 2, oil2: 0, mine3: 0 };
    for (const k in L) s.b[k].lv = L[k];
    for (const k of ['farm1', 'saw1', 'mine1', 'farm2', 'oil1']) s.b[k].acc = 6000;
    s.res = { food: 284300, wood: 196500, iron: 88200, fuel: 21400, gems: 2480, exp: 46000 };
    s.heroes = { reem: { lv: 34, st: 3, sh: 12 }, saqr: { lv: 33, st: 3, sh: 4 }, layla: { lv: 32, st: 2, sh: 8 }, noura: { lv: 30, st: 2, sh: 0 }, nimr: { lv: 31, st: 4, sh: 20 }, hala: { lv: 28, st: 3, sh: 0 }, jaser: { lv: 26, st: 2, sh: 0 }, fares: { lv: 25, st: 2, sh: 0 }, salem: { lv: 20, st: 4, sh: 0 }, mona: { lv: 18, st: 3, sh: 0 }, badr: { lv: 18, st: 3, sh: 0 } };
    s.squad = ['saqr', 'nimr', 'reem', 'layla', 'noura'];
    s.stage = 44; s.troops = 1900; s.quest = 21; s.tut = true; s.name = 'أبو سلطان'; s.auto = false;
    s.tech = { food: 5, wood: 4, iron: 4, fuel: 2, build: 5, train: 3, atk: 6, hp: 5, def: 4, march: 3 };
    s.world.maxZ = 9; s.stam = 86; s.siegeAt = Date.now() + 3600e3; s.login.last = new Date().toDateString();
    s.builds = [{ k: 'lab', to: 7, st: Date.now() - 200e3, end: Date.now() + 900e3, h: 0, hr: false }];
    s.alliance = { i: 0, gift: '', m: [['الذيب', 88200], ['نوف', 79400], ['مشعل', 71000], ['شهد', 64300], ['تركي', 58800], ['ريان', 51200], ['لمى', 47600], ['حمد', 40900]].map(([n, p]) => ({ n, p })) };
    s.chat = [{ u: 'الذيب', m: 'حيّاكم الله يا نسور 🦅' }, { u: 'نوف', m: 'الموجة اليوم قوية انتبهوا' }, { me: true, m: 'السور مستوى 8 جاهز 💪' }, { u: 'مشعل', m: 'مين عنده ريم؟ تستاهل' }, { u: 'شهد', m: 'ساعدتكم كلكم 🤝' }];
    s.savedAt = Date.now();
    return JSON.stringify(s);
  }, KEY);
  await ctx.close();
  const ctx2 = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 });
  await ctx2.addInitScript(([KEY, saved]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(KEY, saved); sessionStorage.setItem('seeded', '1'); } }, [KEY, saved]);
  const pg2 = await ctx2.newPage();
  const raw = {};
  for (const [k] of SHOTS) {
    const pg = pg2;
    await pg.evaluate(([KEY, saved]) => { try { localStorage.setItem(KEY, saved) } catch (e) { } }, [KEY, saved]).catch(() => { });
    await pg.goto(url); await pg.waitForTimeout(700);
    if (k === 'base') { }
    if (k === 'battle') { await pg.click('[data-x=campaign]'); await pg.click('[data-a=fight]'); await pg.waitForTimeout(12000); }
    if (k === 'heroes') { await pg.click('[data-x=heroes]'); }
    if (k === 'world') { await pg.click('[data-x=world]'); await pg.waitForTimeout(500); }
    if (k === 'alliance') { await pg.click('[data-x=alliance]'); }
    await pg.waitForTimeout(400);
    const f = path.resolve('design/raw/' + k + '.png'); await pg.screenshot({ path: f }); raw[k] = f;
  }
  // compose marketing frames
  const fr = await b.newPage({ viewport: { width: 1290, height: 2796 } });
  for (let i = 0; i < SHOTS.length; i++) {
    const [k, t, sub] = SHOTS[i];
    await fr.setContent(`<!doctype html><html dir="rtl"><head><style>
      @font-face{font-family:Changa;font-weight:800;src:url(${d64('www/fonts/changa-arabic-800-normal.woff2','font/woff2')})}
      @font-face{font-family:Tajawal;font-weight:700;src:url(${d64('www/fonts/tajawal-arabic-700-normal.woff2','font/woff2')})}
      body{margin:0;width:1290px;height:2796px;overflow:hidden;background:linear-gradient(180deg,#0b0f14 0%,#2a1a1c 38%,#8a3a1c 70%,#d9772f 100%);font-family:Changa}
      h1{margin:0;padding-top:150px;text-align:center;color:#fff3d6;font-size:112px;line-height:1.15;text-shadow:0 6px 0 #5a2410}
      p{margin:24px 0 0;text-align:center;color:#f1b23c;font-family:Tajawal;font-size:58px}
      .ph{position:absolute;left:50%;top:560px;transform:translateX(-50%);width:1060px;height:2298px;border-radius:110px;background:#050607;padding:26px;box-shadow:0 40px 120px #000c,0 0 0 6px #3b2a22}
      .ph img{width:100%;height:100%;border-radius:86px;display:block;object-fit:cover}
    </style></head><body><h1>${t}</h1><p>${sub}</p><div class="ph"><img src="${d64(raw[k],'image/png')}"></div></body></html>`);
    await fr.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); }); await fr.waitForTimeout(200);
    await fr.screenshot({ path: `docs/screenshots/0${i + 1}-${k}.png` });
  }
  await b.close();
  console.log('screenshots done');
})();
