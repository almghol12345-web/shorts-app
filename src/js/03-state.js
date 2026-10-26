/* ================= state ================= */
let S = null;
function newState() {
  const b = {}; PLOTS.forEach(p => b[p.k] = { lv: 0, acc: 0 });
  b.hq.lv = 1; b.farm1.lv = 1; b.saw1.lv = 1; b.barracks.lv = 1; b.tavern.lv = 1; b.farm1.acc = 250; b.saw1.acc = 250;
  return {
    v: 2, name: '', savedAt: now(), created: now(),
    res: { food: 1500, wood: 1500, iron: 900, fuel: 200, gems: 600, exp: 600 },
    b, builds: [], tech: Object.fromEntries(Object.keys(TECH).map(k => [k, 0])), rq: null,
    troops: 120, wounded: 0, tq: null,
    heroes: { salem: { lv: 1, st: 1, sh: 0 }, badr: { lv: 1, st: 1, sh: 0 }, mona: { lv: 1, st: 1, sh: 0 } },
    squad: ['badr', null, 'salem', 'mona', null], pity: 0,
    stage: 1, stam: 100, stamAt: now(), auto: true, spd: 1,
    inv: { ticket: 3, sp5: 5, sp60: 1, stam: 1, spin: 0 },
    world: { seed: (Math.random() * 1e9) | 0, nodes: null, maxZ: 0, marches: [], v: 2 },
    quest: 0, daily: { date: '', p: {}, c: {} }, login: { day: 0, last: '' },
    alliance: null, chat: [], chatAt: 0, siegeAt: now() + 12 * 60e3,
    stats: { kills: 0, wins: 0, recruits: 0, trained: 0, gathered: 0, sieges: 0, bossDmg: 0, spent: 0 },
    cmd: { lv: 1, xp: 0 }, vip: { pts: 0, chest: '' },
    pass: { season: -1, xp: 0, f: {}, p: {}, prem: -1 },
    wheel: { date: '', free: 0, paid: 0 }, ach: {},
    card: { until: 0, last: '' }, firstBuy: {}, starter: { bought: false, shown: false },
    txDone: [], mail: [], evp: {}, wb: { date: '', tries: 0 },
    freeBox: '', tut: false, snd: true, vib: true, notif: false, newsSeen: 0, lang: null,
  };
}
function migrate(o) {
  const d = newState();
  for (const k in d) {
    if (o[k] === undefined || (o[k] === null && d[k] !== null)) o[k] = d[k];
    else if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) && typeof o[k] === 'object' && !Array.isArray(o[k])) {
      for (const j in d[k]) if (o[k][j] === undefined) o[k][j] = d[k][j];
    }
  }
  if (o.world.v !== 2) { o.world.nodes = null; o.world.marches = []; o.world.v = 2; }
  o.v = 2;
  return o;
}

/* ================= derived ================= */
const hqLv = () => S.b.hq.lv;
const lvOf = t => Math.max(0, ...PLOTS.filter(p => p.t === t).map(p => S.b[p.k].lv));
const vipLv = () => { let l = 0; VIPT.forEach((v, i) => { if (S.vip.pts >= v) l = i; }); return l; };
const prodMul = () => (1 + .03 * vipLv()) * evMult('prod');
const prodRate = (t, lv) => lv ? 180 * lv * Math.pow(1.12, lv - 1) * (1 + .05 * S.tech[BT[t].prod]) * prodMul() : 0;
const storeH = wl => 2 + .5 * wl;
const storeCap = (t, lv) => prodRate(t, lv) * storeH(lvOf('warehouse'));
const protect = wl => wl ? Math.round(1500 * Math.pow(1.5, wl)) : 0;
const wallDef = wl => wl ? Math.round(300 * wl * Math.pow(1.3, wl) * (1 + .04 * S.tech.def)) : 0;
const heroCap = tl => 5 + 5 * tl;
const troopCap = bl => 300 + bl * 200;
const batchMax = bl => 20 + bl * 15;
const hospCap = hl => hl * 150;
const maxMarch = rl => 1 + (rl > 0 ? 1 : 0) + Math.floor(rl / 4) + (vipLv() >= 5 ? 1 : 0);
const maxBuilders = () => 2 + (vipLv() >= 3 ? 1 : 0);
function bCost(t, lv) { const m = Math.pow(1.6, lv - 1), c = {}; for (const k in BT[t].base) c[k] = Math.round(BT[t].base[k] * m); if (lv >= 7) c.fuel = Math.round(25 * m * .35); return c; }
const buildSpeed = () => (1 - .04 * S.tech.build) * (1 - .02 * vipLv());
const bTime = (t, lv) => BT[t].t * Math.pow(1.55, lv - 1) * buildSpeed() * 1000;
function rCost(lv) { const m = Math.pow(1.7, lv - 1), c = { food: Math.round(250 * m), wood: Math.round(250 * m), iron: Math.round(180 * m) }; if (lv >= 3) c.fuel = Math.round(120 * m); return c; }
const rTime = lv => 25 * Math.pow(1.75, lv - 1) * 1000;
const gemCost = ms => ms <= 60000 ? 0 : Math.ceil(ms / 15000);
function heroStats(id) {
  const Hh = HB[id], h = S.heroes[id];
  const base = [0, { a: 30, h: 420, d: 10 }, { a: 44, h: 610, d: 15 }, { a: 62, h: 860, d: 22 }][Hh.r];
  const cm = { tank: { a: .6, h: 1.7, d: 1.6 }, atk: { a: 1.35, h: .8, d: .8 }, sup: { a: .9, h: 1, d: 1 } }[Hh.c];
  const m = (1 + .11 * (h.lv - 1)) * (1 + .22 * (h.st - 1));
  return { atk: base.a * cm.a * m * (1 + .04 * S.tech.atk), hp: base.h * cm.h * m * (1 + .04 * S.tech.hp), def: base.d * cm.d * m * (1 + .04 * S.tech.def) };
}
const heroPower = id => { const x = heroStats(id); return Math.round(x.atk * 3 + x.hp * .3 + x.def * 4); };
const squadPower = () => S.squad.filter(Boolean).reduce((a, id) => a + heroPower(id), 0);
function troopBonus() { const Lb = Math.max(1, lvOf('barracks')); return Math.min(1.5, S.troops * (1 + .08 * (Lb - 1)) / 2000); }
const teamPower = () => Math.round(squadPower() * (1 + troopBonus()));
function totalPower() {
  let p = squadPower() * (1 + troopBonus());
  for (const k in S.b) p += S.b[k].lv * 40;
  for (const k in S.tech) p += S.tech[k] * 60;
  return Math.round(p + S.troops * 2 + (S.cmd.lv - 1) * 100);
}
const recPower = s => Math.round(650 * Math.pow(1.14, s - 1));
const starNeed = st => [0, 10, 20, 40, 80][st] || 0;
const lvCost = lv => Math.round(80 * Math.pow(1.17, lv - 1));
const ownedHeroes = () => Object.keys(S.heroes);
const xpNeed = lv => Math.round(100 * Math.pow(1.35, lv - 1));
const season = () => Math.floor((dayNum() - 20000) / 28);
const seasonEnds = () => { const d = (season() + 1) * 28 + 20000; return d * 864e5 + new Date().getTimezoneOffset() * 60000; };
const passTier = () => Math.min(PASS_TIERS, Math.floor(S.pass.xp / PASS_XP));
const hasPrem = () => S.pass.prem === season();
const cardActive = () => S.card.until > now();

/* ================= events ================= */
let REMOTE_EVENTS = [];
function endOfDay() { const d = new Date(); d.setHours(24, 0, 0, 0); return d.getTime(); }
function builtinEvents() {
  const out = [], d = new Date(), wd = d.getDay();
  if (wd === 5 || wd === 6) { const e = new Date(); e.setHours(24, 0, 0, 0); if (wd === 5) e.setDate(e.getDate() + 1); out.push({ id: 'wk' + dayNum(), type: 'double', builtin: true, title: { ar: 'جوائز الويكند ×2', en: 'Weekend Double Rewards' }, body: { ar: 'كل جوائز الحملة والعالم مضاعفة طوال الويكند.', en: 'All campaign and world rewards are doubled all weekend.' }, ends: e.getTime(), params: { m: 2 } }); }
  out.push({ id: 'wb' + dayNum(), type: 'boss', builtin: true, title: { ar: 'الزعيم العالمي', en: 'World Boss' }, body: { ar: 'العملاق يهاجم! عندك 3 محاولات يومياً. كل ضرر تسببه يعطيك جوائز.', en: 'The Colossus attacks! 3 tries a day. Every point of damage earns rewards.' }, ends: endOfDay(), params: { tries: 3 } });
  return out;
}
function activeEvents() {
  const t = now();
  return builtinEvents().concat(REMOTE_EVENTS.filter(e => (!e.starts || e.starts <= t) && (!e.ends || e.ends > t)));
}
function evMult(kind) {
  let m = 1;
  for (const e of activeEvents()) {
    if (kind === 'reward' && e.type === 'double') m *= Number(e.params && e.params.m) || 2;
    if (kind === 'prod' && e.type === 'production') m *= Number(e.params && e.params.m) || 1.5;
  }
  return m;
}
function evDiscount() { let d = 0; for (const e of activeEvents()) if (e.type === 'discount') d = Math.max(d, clamp(Number(e.params && e.params.p) || 0, 0, 90)); return d; }
