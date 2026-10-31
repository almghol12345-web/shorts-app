/* ================= resources ================= */
function canPay(c) { for (const k in c) if ((S.res[k] || 0) < c[k]) return false; return true; }
function pay(c) { for (const k in c) S.res[k] -= c[k]; }
function give(r) {
  for (const k in r) {
    const v = r[k];
    if (k === 'hero') { if (!S.heroes[v]) { S.heroes[v] = { lv: 1, st: 1, sh: 0 }; toast(t('new_hero', L(HB[v].n))); } else S.heroes[v].sh += 40; continue; }
    if (k in S.res) S.res[k] += v; else if (k in ITEMS) S.inv[k] = (S.inv[k] || 0) + v; else if (k === 'troops') S.troops += v; else if (k === 'vip') S.vip.pts += v;
  }
}
const GEMRATE = { food: 120, wood: 120, iron: 60, fuel: 30, exp: 40 };
function missingGems(c) { let g = 0; for (const k in c) { const miss = c[k] - (S.res[k] || 0); if (miss > 0) g += Math.ceil(miss / (GEMRATE[k] || 1)); } return g; }
function costHTML(c) { return Object.keys(c).map(k => `<span class="cc ${(S.res[k] || 0) >= c[k] ? '' : 'lack'}">${ico(k)} ${fmt(c[k])}</span>`).join(' '); }
function rewHTML(r) {
  return Object.keys(r || {}).filter(k => r[k]).map(k => {
    if (k === 'hero') return `<span class="cc" style="color:var(--r3)">🦸 ${esc(L(HB[r[k]].n))}</span>`;
    if (k === 'vip') return `<span class="cc" style="color:var(--vip)">VIP +${fmt(r[k])}</span>`;
    const d = RES[k] || ITEMS[k] || { i: '🪖' }; return `<span class="cc">${ICO[k] ? ico(k) : d.i} ${fmt(r[k])}</span>`;
  }).join(' ');
}
const mulR = (r, m) => { if (m === 1) return r; const o = {}; for (const k in r) o[k] = typeof r[k] === 'number' && k !== 'ticket' && k !== 'hero' ? Math.round(r[k] * m) : r[k]; return o; };

/* ================= toasts, floats, popups ================= */
function toast(txt, bad) { const e = document.createElement('div'); e.className = 'toast' + (bad ? ' bad' : ''); e.textContent = txt; $('#toasts').appendChild(e); setTimeout(() => e.remove(), 2600); while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove(); }
function floatAt(el, text) { if (!el) return; const r = el.getBoundingClientRect(); const f = document.createElement('div'); f.className = 'float'; f.textContent = text; f.style.left = (r.left + r.width / 2 - 30) + 'px'; f.style.top = (r.top + 10) + 'px'; document.body.appendChild(f); setTimeout(() => f.remove(), 1000); }
const POPQ = [];
function queuePopup(fn) { POPQ.push(fn); if (!modalFn && !B) nextPopup(); }
function nextPopup() { if (modalFn || B || !POPQ.length) return; openModal(POPQ.shift()); }

/* ================= tracking ================= */
function ensureDaily() { if (S.daily.date !== today()) S.daily = { date: today(), p: {}, c: {} }; }
function track(k, n = 1) { ensureDaily(); S.daily.p[k] = (S.daily.p[k] || 0) + n; }
function dailyPoints() { ensureDaily(); return DAILY.reduce((a, d) => a + (S.daily.c[d.k] ? 15 : 0), 0); }
const anyHero = f => ownedHeroes().some(id => f(S.heroes[id]));
const techSum = () => Object.values(S.tech).reduce((a, b) => a + b, 0);
function addXP(n) {
  S.cmd.xp += Math.round(n); let up = 0;
  while (S.cmd.xp >= xpNeed(S.cmd.lv)) { S.cmd.xp -= xpNeed(S.cmd.lv); S.cmd.lv++; up++; }
  if (up) { const r = { gems: 40 + S.cmd.lv * 10, exp: 500 * S.cmd.lv }; if (S.cmd.lv % 5 === 0) r.ticket = 1; give(r); SND.level(); buzz('ok'); queuePopup(() => mLevelUp(S.cmd.lv, r)); }
}
function passXP(n) { ensurePass(); S.pass.xp = Math.min(PASS_TIERS * PASS_XP, S.pass.xp + n); }
function ensurePass() { const s = season(); if (S.pass.season !== s) S.pass = { season: s, xp: 0, f: {}, p: {}, prem: S.pass.prem === s ? s : -1 }; }

/* ================= quests ================= */
const qUp = (type, lv, r, target) => [() => lv === 1 ? t('q_build', L(BT[type].n)) : t('q_up', L(BT[type].n), lv), () => lvOf(type) >= lv, r, target];
const QUESTS = [
  qUp('farm', 2, { food: 600, wood: 600 }, 'farm1'),
  qUp('saw', 2, { food: 600, wood: 600 }, 'saw1'),
  [() => t('q_stage', 1), () => S.stage > 1, { exp: 400, gems: 30 }, '#campaign'],
  qUp('hq', 2, { wood: 1000, iron: 600, gems: 50 }, 'hq'),
  qUp('mine', 1, { iron: 800 }, 'mine1'),
  [() => t('q_recruit'), () => S.stats.recruits >= 1, { gems: 100 }, '#heroes'],
  qUp('wall', 1, { wood: 1200, iron: 800 }, 'wall'),
  [() => t('q_train', 50), () => S.stats.trained >= 50, { food: 1500, iron: 800 }, 'barracks'],
  [() => t('q_hero_lv', 5), () => anyHero(h => h.lv >= 5), { exp: 1000 }, '#heroes'],
  [() => t('q_spin'), () => (S.stats.spins || 0) >= 1, { gems: 50 }, 'wheel'],
  [() => t('q_stage', 3), () => S.stage > 3, { gems: 60, sp5: 2 }, '#campaign'],
  qUp('warehouse', 1, { food: 1500, wood: 1500 }, 'warehouse'),
  qUp('wall', 2, { iron: 1500 }, 'wall'),
  qUp('hq', 3, { gems: 100, sp60: 1 }, 'hq'),
  qUp('lab', 1, { food: 2000, wood: 2000 }, 'lab'),
  [() => t('q_research'), () => techSum() >= 1, { gems: 80 }, 'lab'],
  qUp('hospital', 1, { wood: 2000, iron: 1000 }, 'hospital'),
  [() => t('q_world_z', 1), () => S.world.maxZ >= 1, { exp: 1500, stam: 1 }, '#world'],
  [() => t('q_gather'), () => S.stats.gathered >= 1, { gems: 80 }, '#world'],
  [() => t('q_join'), () => !!S.alliance, { gems: 150 }, '#alliance'],
  [() => t('q_boss'), () => S.stats.bossDmg > 0, { gems: 100 }, 'events'],
  [() => t('q_stage', 5), () => S.stage > 5, { ticket: 1, gems: 80 }, '#campaign'],
  [() => t('q_heroes_n', 5), () => ownedHeroes().length >= 5, { exp: 3000 }, '#heroes'],
  qUp('hq', 4, { gems: 150, sp60: 1 }, 'hq'),
  [() => t('q_hero_lv', 10), () => anyHero(h => h.lv >= 10), { exp: 4000 }, '#heroes'],
  qUp('hq', 5, { gems: 200, ticket: 1 }, 'hq'),
  qUp('oil', 1, { fuel: 1500 }, 'oil1'),
  qUp('radar', 1, { gems: 100 }, 'radar'),
  [() => t('q_stage', 10), () => S.stage > 10, { ticket: 2, gems: 150 }, '#campaign'],
  [() => t('q_star', 2), () => anyHero(h => h.st >= 2), { gems: 200 }, '#heroes'],
  [() => t('q_world_z', 5), () => S.world.maxZ >= 5, { exp: 8000 }, '#world'],
  [() => t('q_power', fmt(5000)), () => totalPower() >= 5000, { gems: 250 }, '#heroes'],
  qUp('hq', 7, { gems: 300, sp60: 2 }, 'hq'),
  [() => t('q_stage', 20), () => S.stage > 20, { ticket: 3, gems: 300 }, '#campaign'],
  [() => t('q_power', fmt(20000)), () => totalPower() >= 20000, { gems: 400, ticket: 2 }, '#heroes'],
  qUp('hq', 10, { gems: 500, ticket: 3 }, 'hq'),
  [() => t('q_stage', 30), () => S.stage > 30, { gems: 800, ticket: 5 }, '#campaign'],
  qUp('hq', 15, { gems: 1000, ticket: 5 }, 'hq'),
  [() => t('q_stage', 50), () => S.stage > 50, { gems: 1500, ticket: 8 }, '#campaign'],
  qUp('hq', 20, { gems: 2000, ticket: 10 }, 'hq'),
];
function claimQuest() { const q = QUESTS[S.quest]; if (!q || !q[1]()) return; give(q[2]); S.quest++; addXP(40 + S.quest * 5); SND.coin(); toast(t('reward_claimed')); save(); refresh(); }
function goQuest() {
  const q = QUESTS[S.quest]; if (!q) return; const g = q[3]; closeModal();
  if (g.startsWith('#')) { tab = g.slice(1); render(); return; }
  if (ACT[g] && !PLOT[g]) { ACT[g](); return; }
  const p = PLOT[g]; if (hqLv() < p.u) { toast(t('unlock_hq', p.u)); openModal(() => mBuilding('hq')); return; }
  tab = 'base'; render(); hintNext = true; openModal(() => mBuilding(g));
}
let hintNext = false;

/* ================= buildings ================= */
function bReq(k) {
  const p = PLOT[k], to = S.b[k].lv + 1, out = [];
  if (to > MAXLV) { out.push({ ok: false, t: t('max_level') }); return out; }
  if (p.t !== 'hq' && to > 2) out.push({ ok: hqLv() >= to - 1, t: t('req_hq', to - 1) });
  if (p.t === 'hq' && to >= 3) out.push({ ok: S.b.wall.lv >= to - 1, t: t('req_wall', to - 1) });
  return out;
}
const reqOk = k => bReq(k).every(r => r.ok);
const canUpgradeNow = k => { const p = PLOT[k], b = S.b[k]; return hqLv() >= p.u && b.lv > 0 && b.lv < MAXLV && !S.builds.some(x => x.k === k) && reqOk(k) && canPay(bCost(p.t, b.lv + 1)) && S.builds.length < maxBuilders(); };
function upgrade(k, instant) {
  const p = PLOT[k], b = S.b[k], to = b.lv + 1;
  if (S.builds.some(x => x.k === k)) return;
  if (!reqOk(k)) { toast(t('req_missing'), 1); return; }
  const c = bCost(p.t, to); if (!canPay(c)) { toast(t('no_res'), 1); return; }
  const ms = bTime(p.t, to);
  if (instant) {
    const g = gemCost(ms); if (S.res.gems < g) { toast(t('no_gems'), 1); return; }
    pay(c); S.res.gems -= g; finishBuild(k, to); track('build'); closeModal();
  } else {
    if (S.builds.length >= maxBuilders()) { toast(t('builders_busy'), 1); return; }
    pay(c); S.builds.push({ k, to, st: now(), end: now() + ms, h: 0, hr: false }); track('build'); toast(t('build_started', L(BT[p.t].n)));
    askNotif();
  }
  save(); refresh();
}
function finishBuild(k, to) {
  S.b[k].lv = to; const tp = PLOT[k].t; SND.up(); buzz('ok');
  toast(t('build_done', L(BT[tp].n), to));
  addXP(8 * to);
  if (tp === 'hq' && PLOTS.some(p => p.u === to)) toast(t('new_buildings'));
  if (tp === 'hq' && to >= 3 && !S.starter.bought && !S.starter.shown) { S.starter.shown = true; S.starter.at = now(); queuePopup(mStarter); }
}
function fillRes(ref) {
  let c = null;
  if (ref.startsWith('b:')) { const k = ref.slice(2); c = bCost(PLOT[k].t, S.b[k].lv + 1); }
  else if (ref.startsWith('r:')) { const k = ref.slice(2); c = rCost(S.tech[k] + 1); }
  if (!c) return; const g = missingGems(c);
  if (S.res.gems < g) { toast(t('no_gems'), 1); return; }
  S.res.gems -= g; for (const k in c) if (S.res[k] < c[k]) S.res[k] = c[k];
  toast(t('bought_missing')); save(); refresh();
}
function collect(k, el) {
  const b = S.b[k], n = Math.floor(b.acc); if (n < 1) return 0;
  const r = BT[PLOT[k].t].prod; S.res[r] += n; b.acc -= n;
  if (el) floatAt(el, `+${fmt(n)} ${RES[r].i}`);
  SND.coin(); buzz('light'); return n;
}
function collectAll() { let any = 0; PLOTS.forEach(p => { if (BT[p.t].prod && S.b[p.k].lv) { const el = document.querySelector(`[data-tile="${p.k}"]`); if (collect(p.k, el)) any++; } }); if (any) { track('collect'); toast(t('collected_all')); } else toast(t('nothing_collect')); refresh(); }

/* queues */
function getQ(ref) { if (ref.startsWith('b:')) return S.builds.find(x => x.k === ref.slice(2)); if (ref === 'r') return S.rq; if (ref === 't') return S.tq; return null; }
function useSpeed(ref, item) { const q = getQ(ref); if (!q) return; if (!S.inv[item]) { toast(t('no_item'), 1); return; } S.inv[item]--; q.end -= item === 'sp5' ? 300000 : 3600000; toast(t('used_item', L(ITEMS[item].n))); processQueues(); save(); refresh(); }
function gemFinish(ref) { const q = getQ(ref); if (!q) return; const g = gemCost(q.end - now()); if (S.res.gems < g) { toast(t('no_gems'), 1); return; } S.res.gems -= g; q.end = now(); processQueues(); save(); refresh(); }
function askHelp(ref) { const q = getQ(ref); if (!q || !S.alliance) return; q.hr = true; toast(t('help_sent')); refresh(); }
function processQueues() {
  let ch = false; const tm = now();
  for (const q of S.builds.slice()) if (q.end <= tm) { S.builds.splice(S.builds.indexOf(q), 1); finishBuild(q.k, q.to); ch = true; }
  if (S.rq && S.rq.end <= tm) { S.tech[S.rq.k] = S.rq.to; toast(t('research_done', L(TECH[S.rq.k].n), S.rq.to)); addXP(12 * S.rq.to); SND.up(); S.rq = null; ch = true; }
  if (S.tq && S.tq.end <= tm) { S.troops += S.tq.n; S.stats.trained += S.tq.n; toast(t('trained_done', S.tq.n)); addXP(S.tq.n / 10); S.tq = null; ch = true; }
  return ch;
}
function allyHelpTick(dt) {
  if (!S.alliance) return false; let ch = false;
  for (const q of [...S.builds, S.rq, S.tq]) {
    if (!q || !q.hr || q.h >= 5) continue;
    if (Math.random() < dt / 2500) { q.h++; const red = Math.max(60000, (q.end - q.st) * .05); q.end -= red; track('help'); toast(t('ally_helped', L(pick(BOTS)), fmtT(red / 1000))); ch = true; }
  }
  return ch;
}

/* training, hospital, research */
function trainCount() { const Lb = lvOf('barracks'); const room = troopCap(Lb) - S.troops; return Math.max(0, Math.min(batchMax(Lb), room)); }
function trainCostPer() { const Lb = Math.max(1, lvOf('barracks')); const m = 1 + .12 * (Lb - 1); return { food: Math.round(10 * m), iron: Math.round(5 * m) }; }
const trainMs = n => n * 1200 * (1 - .05 * S.tech.train);
let trainN = 10;
function doTrain() {
  if (S.tq) { toast(t('barracks_busy'), 1); return; }
  const n = Math.min(trainN, trainCount()); if (n < 1) { toast(t('troops_max'), 1); return; }
  const per = trainCostPer(), c = { food: per.food * n, iron: per.iron * n };
  if (!canPay(c)) { toast(t('no_res'), 1); return; }
  pay(c); S.tq = { n, st: now(), end: now() + trainMs(n), h: 0, hr: false }; track('train'); toast(t('train_started', n)); save(); refresh();
}
function doHeal() {
  const n = S.wounded; if (!n) return; const c = { food: n * 4, wood: n * 2 };
  if (!canPay(c)) { toast(t('no_res'), 1); return; }
  pay(c); S.troops += n; S.wounded = 0; toast(t('healed', n)); SND.up(); save(); refresh();
}
function doResearch(k) {
  if (S.rq) { toast(t('lab_busy'), 1); return; }
  const lab = lvOf('lab'), to = S.tech[k] + 1;
  if (!lab) { toast(t('need_lab'), 1); return; }
  if (to > 10) { toast(t('max_level')); return; }
  if (to > lab) { toast(t('req_lab', to), 1); return; }
  const c = rCost(to); if (!canPay(c)) { toast(t('no_res'), 1); return; }
  pay(c); S.rq = { k, to, st: now(), end: now() + rTime(to), h: 0, hr: false }; track('research'); toast(t('research_started', L(TECH[k].n))); save(); refresh();
}

/* heroes */
function heroLevelUp(id, n) {
  const h = S.heroes[id], cap = heroCap(lvOf('tavern')); let done = 0;
  while (done < n && h.lv < cap) { const c = lvCost(h.lv); if (S.res.exp < c) break; S.res.exp -= c; h.lv++; done++; }
  if (!done) { toast(h.lv >= cap ? t('hero_cap', cap) : t('no_exp'), 1); return; }
  SND.up(); buzz('light'); toast(t('hero_lv', L(HB[id].n), h.lv)); save(); refresh();
}
function heroStar(id) {
  const h = S.heroes[id]; if (h.st >= 5) return; const need = starNeed(h.st);
  if (h.sh < need) { toast(t('no_shards'), 1); return; }
  h.sh -= need; h.st++; SND.rare(); buzz('heavy'); toast(t('hero_star', L(HB[id].n), h.st)); save(); refresh();
}
let lastPull = [];
function rollHero() {
  S.pity++; let r; const x = Math.random();
  if (S.pity >= 40) r = 3; else r = x < .05 ? 3 : x < .30 ? 2 : 1;
  if (r === 3) S.pity = 0;
  return pick(HEROES.filter(h => h.r === r)).id;
}
function recruit(n) {
  const tk = Math.min(S.inv.ticket, n); let gem = (n - tk) * 150; if (n === 10 && tk === 0) gem = 1350;
  if (S.res.gems < gem) { toast(t('no_gems_tickets'), 1); return; }
  S.inv.ticket -= tk; S.res.gems -= gem; lastPull = [];
  for (let i = 0; i < n; i++) { const id = rollHero(); let isNew = false; if (!S.heroes[id]) { S.heroes[id] = { lv: 1, st: 1, sh: 0 }; isNew = true; } else S.heroes[id].sh += 10; lastPull.push({ id, isNew }); }
  S.stats.recruits += n; track('recruit', n); addXP(5 * n);
  const leg = lastPull.find(p => HB[p.id].r === 3);
  if (leg) { toast(t('got_legendary', L(HB[leg.id].n))); SND.rare(); buzz('heavy'); } else { SND.up(); buzz('medium'); }
  save(); refresh();
}
function squadAdd(id) { if (S.squad.includes(id)) return; const i = S.squad.indexOf(null); if (i < 0) { openModal(() => mSlotPick(id)); return; } S.squad[i] = id; save(); refresh(); }
function squadRem(id) { const i = S.squad.indexOf(id); if (i < 0) return; if (S.squad.filter(Boolean).length <= 1) { toast(t('need_one_hero'), 1); return; } S.squad[i] = null; save(); refresh(); }
function autoSquad() {
  const own = ownedHeroes().sort((a, b) => heroPower(b) - heroPower(a));
  const tanks = own.filter(id => HB[id].c === 'tank'), rest = own.filter(id => HB[id].c !== 'tank');
  const front = tanks.slice(0, 2); while (front.length < 2 && rest.length) front.push(rest.shift());
  const back = rest.concat(tanks.slice(2)).slice(0, 3);
  S.squad = [front[0] || null, front[1] || null, back[0] || null, back[1] || null, back[2] || null];
  toast(t('squad_auto')); save(); refresh();
}

/* ================= pass, wheel, achievements, vip, card ================= */
function passClaim(tier, prem) {
  ensurePass();
  if (tier > passTier()) return; if (prem && !hasPrem()) { openModal(mShop); return; }
  const bag = prem ? S.pass.p : S.pass.f; if (bag[tier]) return;
  bag[tier] = 1; const r = passReward(tier, prem); give(r); SND.coin(); toast(t('reward_claimed')); save(); refresh();
}
function passClaimAll() { ensurePass(); let n = 0; for (let i = 1; i <= passTier(); i++) { if (!S.pass.f[i]) { S.pass.f[i] = 1; give(passReward(i, false)); n++; } if (hasPrem() && !S.pass.p[i]) { S.pass.p[i] = 1; give(passReward(i, true)); n++; } } if (n) { SND.rare(); toast(t('claimed_n', n)); save(); refresh(); } }
function wheelReset() { if (S.wheel.date !== today()) S.wheel = { date: today(), free: 0, paid: 0 }; }
const wheelFree = () => { wheelReset(); return S.wheel.free < 1 + (vipLv() >= 4 ? 1 : 0); };
const WHEEL_PRICE = 100;
let wheelSpinning = false, wheelAngle = 0, wheelLast = null;
function spinWheel() {
  if (wheelSpinning) return; wheelReset();
  const free = wheelFree(), item = !free && S.inv.spin > 0;
  if (!free && !item) { if (S.wheel.paid >= 10) { toast(t('wheel_limit'), 1); return; } if (S.res.gems < WHEEL_PRICE) { toast(t('no_gems'), 1); return; } S.res.gems -= WHEEL_PRICE; S.wheel.paid++; }
  else if (free) S.wheel.free++; else S.inv.spin--;
  const seg = weighted(WHEEL), idx = WHEEL.indexOf(seg), n = WHEEL.length, segA = 360 / n;
  const target = 360 - (idx * segA + segA / 2) + (Math.random() - .5) * segA * .6;
  wheelAngle = wheelAngle - (wheelAngle % 360) + 360 * 6 + target;
  wheelSpinning = true; wheelLast = null; save(); renderModal();
  const svg = $('#wheelsvg'); if (svg) { void svg.getBoundingClientRect(); svg.style.transform = `rotate(${wheelAngle}deg)`; }
  let ticks = 0; const tk = setInterval(() => { SND.tick(); if (++ticks > 22) clearInterval(tk); }, 160);
  setTimeout(() => { wheelSpinning = false; give(seg.r); wheelLast = seg.r; S.stats.spins = (S.stats.spins || 0) + 1; track('spin'); passXP(5); SND.rare(); buzz('ok'); save(); renderModal(); renderTop(); }, 4100);
}
function achState(a) { const claimed = S.ach[a.k] || 0, v = a.v(); return { claimed, v, next: a.tiers[claimed], done: claimed >= a.tiers.length, ready: claimed < a.tiers.length && v >= a.tiers[claimed] }; }
function achClaim(k) { const a = ACH.find(x => x.k === k); const s = achState(a); if (!s.ready) return; give(achReward(s.claimed)); S.ach[k] = s.claimed + 1; addXP(30); SND.rare(); toast(t('reward_claimed')); save(); refresh(); }
const achDot = () => ACH.some(a => achState(a).ready);
function vipChest() { if (S.vip.chest === today() || vipLv() < 1) return; S.vip.chest = today(); const l = vipLv(); give({ gems: l * 30, sp5: l, exp: l * 1000 }); SND.rare(); toast(t('reward_claimed')); save(); refresh(); }
function cardClaim() { if (!cardActive() || S.card.last === today()) return; S.card.last = today(); give({ gems: IAPB.monthly.daily }); SND.coin(); toast(t('reward_claimed')); save(); refresh(); }

/* ================= events actions ================= */
function evProgress(e) { if (e.type === 'kills') { const p = S.evp[e.id] || (S.evp[e.id] = { start: S.stats.kills }); return S.stats.kills - p.start; } return 0; }
function evClaim(id) {
  const e = activeEvents().find(x => x.id === id); if (!e) return;
  const p = S.evp[id] || (S.evp[id] = {}); if (p.done) return;
  if (e.type === 'kills' && evProgress(e) < (Number(e.params.goal) || 0)) return;
  p.done = 1; const r = sanitizeRewards(e.params.r || e.params.rewards || {}); give(r); SND.rare(); queuePopup(() => mGift(r, L(e.title))); save(); refresh();
}
function wbReset() { if (S.wb.date !== today()) S.wb = { date: today(), tries: 0 }; }
function startWorldBoss() {
  wbReset(); if (S.wb.tries >= 3) { toast(t('no_tries'), 1); return; }
  if (!S.squad.some(Boolean)) { toast(t('need_squad'), 1); return; }
  S.wb.tries++; closeModal(); save();
  const sc = Math.max(1, S.stage);
  startBattle({ title: t('ev_boss'), waves: [['wb']], sc, boss: true, limit: 60, onEnd: (win, Bt) => {
    const d = Math.round(Bt.dealt); S.stats.bossDmg += d; passXP(10);
    const k = Math.max(1, d / 1000);
    const r = mulR({ gems: Math.min(400, Math.round(10 + Math.sqrt(k) * 8)), exp: Math.round(200 + k * 40), food: Math.round(500 + k * 120) }, evMult('reward'));
    if (d > 50000 * Math.pow(1.15, sc)) r.ticket = 1;
    give(r); return { r, note: t('boss_dmg', fmt(d)) };
  } });
}

/* ================= siege ================= */
function resolveSiege() {
  const Lb = Math.max(1, lvOf('barracks'));
  const def = wallDef(lvOf('wall')) + S.troops * 10 * (1 + .08 * (Lb - 1)) + squadPower() * .5;
  const horde = Math.round(500 * Math.pow(1.42, hqLv() - 1) * (.8 + Math.random() * .45));
  const win = def >= horde; const rep = { win, def: Math.round(def), horde };
  if (win) { rep.r = mulR({ food: Math.round(horde * .8), wood: Math.round(horde * .8), exp: Math.round(horde * .3), gems: 25 }, evMult('reward')); give(rep.r); S.stats.sieges++; addXP(25); passXP(15); }
  else {
    const pr = protect(lvOf('warehouse')); rep.lost = {};
    ['food', 'wood', 'iron', 'fuel'].forEach(k => { const l = Math.floor(Math.max(0, S.res[k] - pr) * .15); if (l) { S.res[k] -= l; rep.lost[k] = l; } });
    const w = Math.floor(S.troops * .15); S.troops -= w; const room = hospCap(lvOf('hospital')) - S.wounded; const kept = Math.max(0, Math.min(w, room)); S.wounded += kept; rep.w = kept; rep.dead = w - kept;
  }
  S.siegeAt = now() + (16 + Math.random() * 12) * 60e3; save(); SND.alarm(); buzz(win ? 'ok' : 'bad');
  openModal(() => mSiege(rep));
}

/* ================= notifications (iOS local) ================= */
async function askNotif() {
  if (S.notif) return; S.notif = true; const LN = plugin('LocalNotifications'); if (!LN) return;
  try { await LN.requestPermissions(); } catch (e) { }
}
async function scheduleNotifs() {
  const LN = plugin('LocalNotifications'); if (!LN) return;
  try {
    const pend = await LN.getPending(); if (pend && pend.notifications && pend.notifications.length) await LN.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });
    const list = []; const t0 = now(); let id = 1;
    const add = (at, title, body) => { if (at > t0 + 30000) list.push({ id: id++, title, body, schedule: { at: new Date(at) } }); };
    S.builds.forEach(b => add(b.end, t('n_build_t'), t('n_build_b', L(BT[PLOT[b.k].t].n), b.to)));
    if (S.rq) add(S.rq.end, t('n_research_t'), t('n_research_b', L(TECH[S.rq.k].n)));
    if (S.tq) add(S.tq.end, t('n_train_t'), t('n_train_b', S.tq.n));
    if (S.stam < 100) add(S.stamAt + (100 - S.stam) * 180000, t('n_stam_t'), t('n_stam_b'));
    const tom = new Date(); tom.setDate(tom.getDate() + 1); tom.setHours(19, 30, 0, 0); add(tom.getTime(), t('n_daily_t'), t('n_daily_b'));
    if (list.length) await LN.schedule({ notifications: list });
  } catch (e) { }
}
