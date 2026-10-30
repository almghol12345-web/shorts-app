// Builds App Store screenshots (1290x2796, iPhone 6.7"/6.9") in Arabic and English from a mid-game save.
//   npm run build && npm run screenshots
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const KEY = 'fajr-naajin-save-v1';
const d64 = (f, t) => `data:${t};base64,` + fs.readFileSync(f).toString('base64');
const CAP = {
  ar: [['ابنِ قاعدتك وسط الخراب', '19 مبنى ودفاعات ضد الموجات'], ['اصمد أمام الزومبي', 'معارك حية ومهارات بلمسة'], ['جنّد أبطالاً أسطوريين', 'أبطال أسطوريين بقدرات مدمّرة'], ['استكشف عالماً مدمّراً', 'خريطة ضخمة تكبّرها بإصبعين'], ['جوائز كل يوم', 'تذكرة المعركة وعجلة الحظ']],
  en: [['Build your base in the ruins', '19 buildings and raid defenses'], ['Hold back the horde', 'Live battles, one-tap skills'], ['Recruit legendary heroes', 'Legendary heroes, devastating skills'], ['Explore a ruined world', 'A huge map you can pinch-zoom'], ['Rewards every day', 'Battle Pass and Lucky Wheel']],
};
const SHOTS = ['base', 'battle', 'heroes', 'world', 'pass'];
(async () => {
  const b = await chromium.launch();
  const url = 'file://' + path.resolve('www/index.html');
  // 1) get a fresh save from the real game, then edit it into a mid-game state
  const c0 = await b.newContext({ viewport: { width: 430, height: 932 } }); const p0 = await c0.newPage();
  await p0.goto(url); await p0.waitForTimeout(400); await p0.click('[data-a=langPick][data-x=ar]'); await p0.click('.sh-b [data-a=close]'); await p0.waitForTimeout(5600);
  const base = await p0.evaluate(k => localStorage.getItem(k), KEY); await c0.close();
  const seed = lang => {
    const s = JSON.parse(base);
    const L = { hq: 9, farm1: 9, saw1: 9, barracks: 8, tavern: 7, mine1: 8, wall: 8, warehouse: 6, hospital: 6, lab: 6, farm2: 8, saw2: 7, oil1: 6, radar: 5, mine2: 5, farm3: 3, saw3: 2, oil2: 0, mine3: 0 };
    for (const k in L) s.b[k].lv = L[k];
    for (const k of ['farm1', 'saw1', 'mine1', 'farm2', 'oil1']) s.b[k].acc = 6000;
    s.res = { food: 284300, wood: 196500, iron: 88200, fuel: 21400, gems: 2480, exp: 46000 };
    s.heroes = { redking: { lv: 34, st: 3, sh: 12 }, destroyer: { lv: 33, st: 3, sh: 4 }, fire: { lv: 32, st: 2, sh: 8 }, knight: { lv: 31, st: 4, sh: 20 }, lightning: { lv: 30, st: 3, sh: 0 }, shadow: { lv: 28, st: 3, sh: 0 }, medic: { lv: 30, st: 2, sh: 0 }, mountain: { lv: 22, st: 4, sh: 0 }, hawk: { lv: 20, st: 4, sh: 0 }, wind: { lv: 20, st: 3, sh: 0 } };
    s.squad = ['redking', 'knight', 'fire', 'medic', 'destroyer'];
    s.stage = 44; s.troops = 1900; s.quest = 22; s.tut = true; s.lang = lang; s.name = lang === 'ar' ? 'أبو سلطان' : 'Sultan'; s.auto = false;
    s.cmd = { lv: 23, xp: 900 }; s.vip = { pts: 1600, chest: '' };
    s.tech = { food: 5, wood: 4, iron: 4, fuel: 2, build: 5, train: 3, atk: 6, hp: 5, def: 4, march: 3 };
    s.world.maxZ = 9; s.stam = 86; s.siegeAt = Date.now() + 3600e3; s.login.last = new Date().toDateString();
    s.pass.xp = 1240; s.pass.f = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1 }; s.pass.prem = s.pass.season; s.pass.p = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 };
    s.builds = [{ k: 'lab', to: 7, st: Date.now() - 200e3, end: Date.now() + 900e3, h: 0, hr: false }];
    s.starter = { bought: true, shown: true }; s.savedAt = Date.now();
    return JSON.stringify(s);
  };
  const raw = {};
  for (const lang of ['ar', 'en']) {
    const ctx = await b.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 });
    const sv = seed(lang); await ctx.addInitScript(([k, v]) => { localStorage.setItem(k, v); }, [KEY, sv]);
    for (const k of SHOTS) {
      const pg = await ctx.newPage(); await pg.goto(url); await pg.waitForTimeout(700);
      if (k === 'battle') { await pg.click('[data-x=campaign]'); await pg.click('[data-a=fight]'); await pg.waitForTimeout(12000); }
      if (k === 'heroes') await pg.click('[data-x=heroes]');
      if (k === 'world') { await pg.click('[data-x=world]'); await pg.waitForTimeout(300); await pg.click('[data-a=zoomIn]'); await pg.waitForTimeout(900); }
      if (k === 'pass') { await pg.click('[data-a=pass]'); }
      await pg.waitForTimeout(500);
      const f = path.resolve(`design/raw/${lang}-${k}.png`); fs.mkdirSync(path.dirname(f), { recursive: true }); await pg.screenshot({ path: f }); raw[lang + k] = f;
      await pg.close();
    }
    await ctx.close();
  }
  const fr = await b.newPage({ viewport: { width: 1290, height: 2796 } });
  for (const lang of ['ar', 'en']) {
    fs.mkdirSync(`docs/screenshots/${lang}`, { recursive: true });
    for (let i = 0; i < SHOTS.length; i++) {
      const [t, sub] = CAP[lang][i];
      await fr.setContent(`<!doctype html><html dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><style>
        @font-face{font-family:Changa;font-weight:800;src:url(${d64('www/fonts/changa-arabic-800-normal.woff2', 'font/woff2')});unicode-range:U+0600-06FF,U+FB50-FEFF}
        @font-face{font-family:Changa;font-weight:800;src:url(${d64('www/fonts/changa-latin-800-normal.woff2', 'font/woff2')});unicode-range:U+0000-00FF,U+2000-206F}
        @font-face{font-family:Tajawal;font-weight:700;src:url(${d64('www/fonts/tajawal-arabic-700-normal.woff2', 'font/woff2')});unicode-range:U+0600-06FF,U+FB50-FEFF}
        @font-face{font-family:Tajawal;font-weight:700;src:url(${d64('www/fonts/tajawal-latin-700-normal.woff2', 'font/woff2')});unicode-range:U+0000-00FF,U+2000-206F}
        body{margin:0;width:1290px;height:2796px;overflow:hidden;background:linear-gradient(180deg,#0b0f14 0%,#2a1a1c 38%,#8a3a1c 70%,#d9772f 100%);font-family:Changa}
        h1{margin:0;padding-top:150px;text-align:center;color:#fff3d6;font-size:${lang === 'ar' ? 112 : 100}px;line-height:1.15;text-shadow:0 6px 0 #5a2410}
        p{margin:24px 0 0;text-align:center;color:#f1b23c;font-family:Tajawal;font-size:58px}
        .ph{position:absolute;left:50%;top:560px;transform:translateX(-50%);width:1060px;height:2298px;border-radius:110px;background:#050607;padding:26px;box-shadow:0 40px 120px #000c,0 0 0 6px #3b2a22}
        .ph img{width:100%;height:100%;border-radius:86px;display:block;object-fit:cover}
      </style></head><body><h1>${t}</h1><p>${sub}</p><div class="ph"><img src="${d64(raw[lang + SHOTS[i]], 'image/png')}"></div></body></html>`);
      await fr.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); });
      await fr.screenshot({ path: `docs/screenshots/${lang}/0${i + 1}-${SHOTS[i]}.png` });
    }
  }
  await b.close();
  console.log('screenshots done');
})();
