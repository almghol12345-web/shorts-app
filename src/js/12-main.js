/* ================= tick ================= */
let lastTick = now();
function produce(ms) { const h = ms / 3600000; PLOTS.forEach(p => { const T = BT[p.t], b = S.b[p.k]; if (!T.prod || !b.lv) return; b.acc = Math.min(storeCap(p.t, b.lv), b.acc + prodRate(p.t, b.lv) * h); }); }
function stamTick() { if (S.stam >= 100) { S.stamAt = now(); return; } while (S.stam < 100 && now() - S.stamAt >= 180000) { S.stam++; S.stamAt += 180000; } }
function tick() {
  const tm = now(), dt = clamp(tm - lastTick, 0, 24 * 3600e3); lastTick = tm;
  produce(dt); stamTick();
  let ch = processQueues();
  if (allyHelpTick(Math.min(dt, 5000))) ch = true;
  if (marchTick()) ch = true;
  if (hqLv() >= 2 && tm >= S.siegeAt && !B && !modalFn) { resolveSiege(); ch = true; }
  if (S.alliance && tm - S.chatAt > 45000 + Math.random() * 40000) { S.chatAt = tm; S.chat.push({ u: pick(BOTS), m: pick(CHATL), t: tm }); if (S.chat.length > 40) S.chat.shift(); if (tab === 'alliance') ch = true; }
  if (ch) refresh();
  tickUI(); autosave();
}
function tickUI() {
  renderTop(); const tm = now();
  $$('[data-end]').forEach(e => { e.textContent = fmtT((+e.dataset.end - tm) / 1000); });
  $$('[data-bar]').forEach(e => { const st = +e.dataset.st, en = +e.dataset.en; e.style.width = clamp((tm - st) / (en - st) * 100, 0, 100) + '%'; });
  $$('[data-gem]').forEach(e => { const g = gemCost(+e.dataset.gem - tm); e.textContent = g ? `💎 ${g}` : t('free_finish'); });
  $$('[data-acc]').forEach(e => { const k = e.dataset.acc, b = S.b[k], cap = storeCap(PLOT[k].t, b.lv); const show = b.acc >= Math.max(5, cap * .04); e.hidden = !show; if (show) e.lastChild.textContent = fmt(b.acc); });
  $$('[data-stam]').forEach(e => e.textContent = Math.floor(S.stam));
}

/* ================= actions ================= */
const ACT = {
  tab: x => { closeModal(); tab = x; render(); },
  close: () => closeModal(),
  bld: x => openModal(() => mBuilding(x)),
  locked: x => toast(t('unlock_hq', x)),
  collect: (x, el) => { if (collect(x, el.closest('.tile'))) track('collect'); tickUI(); },
  collect1: x => { if (collect(x, document.querySelector(`[data-tile="${x}"]`))) track('collect'); refresh(); },
  collectAll: () => collectAll(),
  up: x => upgrade(x, false), inst: x => upgrade(x, true), fill: x => fillRes(x),
  usesp: x => { const [r, i] = x.split('|'); useSpeed(r, i); }, gemfin: x => gemFinish(x), help: x => askHelp(x),
  helpAll: () => { let n = 0; for (const q of [...S.builds, S.rq, S.tq]) if (q && !q.hr) { q.hr = true; n++; } toast(n ? t('help_asked_n', n) : t('no_timers')); refresh(); },
  train: () => doTrain(), heal: () => doHeal(), research: x => doResearch(x),
  hero: x => openModal(() => mHero(x)), hlv: x => { const [id, n] = x.split('|'); heroLevelUp(id, +n); }, hstar: x => heroStar(x),
  sqadd: x => squadAdd(x), sqrem: x => squadRem(x), autoSquad: () => autoSquad(),
  slot: x => openModal(() => mSlot(+x)),
  slotset: x => { const [i, id] = x.split('|'); const j = S.squad.indexOf(id); if (j >= 0) S.squad[j] = S.squad[+i]; S.squad[+i] = id; save(); closeModal(); refresh(); },
  slotclr: x => { if (S.squad.filter(Boolean).length <= 1) { toast(t('need_one_hero'), 1); return; } S.squad[+x] = null; save(); closeModal(); refresh(); },
  openRecruit: () => { lastPull = []; openModal(mRecruit); }, recruit: x => recruit(+x),
  fight: () => startCampaign(),
  attackNode: x => attackNode(x), gather: x => startGather(x),
  recenter: () => { const h = homeCam(); flyTo(h.x, h.y, 1); },
  zoomIn: () => zoomAt(wW / 2, wH / 2, cam.z * 1.4, true), zoomOut: () => zoomAt(wW / 2, wH / 2, cam.z / 1.4, true), findZ: () => findTarget(),
  qclaim: () => claimQuest(), qgo: () => goQuest(), quests: () => openModal(mQuests),
  events: () => openModal(mEvents), worldBoss: () => startWorldBoss(), evClaim: x => evClaim(x),
  login: () => { if (S.login.last === today()) return; const r = LOGIN[S.login.day % 7]; give(r); S.login.day++; S.login.last = today(); passXP(20); SND.rare(); toast(t('login_claimed')); save(); refresh(); },
  dclaim: x => { ensureDaily(); const d = DAILY.find(d => d.k === x); if (!d || S.daily.c[x] || (S.daily.p[x] || 0) < d.g) return; S.daily.c[x] = 1; S.res.gems += 10; passXP(20); addXP(10); SND.coin(); toast(t('task_claimed')); save(); refresh(); },
  chest: x => { const c = CHESTS[+x]; if (dailyPoints() < c.p || S.daily.c['chest' + x]) return; S.daily.c['chest' + x] = 1; give(c.r); passXP(30); SND.rare(); toast(t('chest_opened')); save(); refresh(); },
  shop: () => { shopTab = 'gems'; openModal(mShop); }, shopTab: x => { shopTab = x; renderModal(true); },
  buy: x => buy(x), restore: () => restorePurchases(), starter: () => openModal(mStarter),
  gbuy: x => { const s = GSHOP.find(s => s.k === x); if (!s) return; if (x === 'free') { if (S.freeBox === today()) return; S.freeBox = today(); } else { const p = gprice(s); if (S.res.gems < p) { toast(t('no_gems'), 1); return; } S.res.gems -= p; } give(s.r); SND.coin(); toast(t('bought', t('g_' + s.k))); save(); refresh(); },
  cardClaim: () => cardClaim(),
  bag: () => openModal(mBag),
  useStam: () => { if (!S.inv.stam) return; S.inv.stam--; S.stam = Math.min(150, S.stam + 50); toast(t('stam_added')); save(); refresh(); },
  wheel: () => { wheelLast = null; openModal(mWheel); }, spin: () => spinWheel(),
  pass: () => openModal(mPass), passClaim: x => { const [i, p] = x.split('|'); passClaim(+i, p === '1'); }, passAll: () => passClaimAll(),
  achs: () => openModal(mAchs), achClaim: x => achClaim(x),
  vip: () => openModal(mVip), vipChest: () => vipChest(),
  rank: () => { rankData = null; openModal(mRank); },
  mail: () => openModal(mMail),
  settings: () => openModal(mSettings), tut: () => openModal(mTut),
  lang: x => { S.lang = x; setLang(x); save(); refresh(); syncPlayer().catch(() => { }); },
  langPick: x => { S.lang = x; setLang(x); save(); closeModal(); render(); if (!S.tut) { S.tut = true; openModal(mTut); } },
  tsnd: () => { S.snd = !S.snd; save(); renderModal(); if (S.snd) SND.coin(); },
  tvib: () => { S.vib = !S.vib; save(); renderModal(); buzz('medium'); },
  copyId: () => { const v = '#' + (NET.me && NET.me.short_id); try { navigator.clipboard.writeText(v).then(() => toast(t('copied')), () => toast(v)); } catch (e) { toast(v); } },
  verTap: () => { const tm = now(); if (tm - adminTapAt > 1500) adminTaps = 0; adminTapAt = tm; adminTaps++; if (adminTaps >= 7) { adminTaps = 0; openAdmin(); } else if (adminTaps >= 4) toast(t('taps_left', 7 - adminTaps)); },
  reset: () => {
    if (resetArm > now()) { storeDel(KEY); const l = S.lang; S = newState(); S.lang = l; S.tut = true; resetArm = 0; cam = null; closeModal(); tab = 'base'; genWorld(); save(true); refresh(); toast(t('new_game_started')); }
    else { resetArm = now() + 3000; renderModal(); setTimeout(() => { if (modalFn === mSettings) renderModal(); }, 3100); }
  },
  offCollect: () => { closeModal(); collectAll(); },
  delAcc: () => {
    if (delArm > now()) { delArm = 0; deleteAccount().catch(() => { }).finally(() => { storeDel(KEY); toast(t('account_deleted')); setTimeout(() => location.reload(), 900); }); }
    else { delArm = now() + 3000; renderModal(); setTimeout(() => { if (modalFn === mSettings) renderModal(); }, 3100); }
  },
  join: x => { const i = +x, a = ALLIES[i]; const m = BOTS.slice().sort(() => Math.random() - .5).slice(0, 8 + a.lv % 4).map((n, j) => ({ n, p: Math.round((60000 - j * 5000) * (.6 + Math.random() * .6)) })).sort((p, q) => q.p - p.p); S.alliance = { i, m, gift: '' }; S.chat = [{ u: m[0].n, m: { ar: `حيّاك الله في ${a.n.ar}! 👋`, en: `Welcome to ${a.n.en}! 👋` }, t: now() }]; S.chatAt = now(); toast(t('joined_ally', L(a.n))); SND.up(); save(); refresh(); },
  leave: (x, el) => { if (el.dataset.arm) { S.alliance = null; S.chat = []; toast(t('left_ally')); save(); refresh(); } else { el.dataset.arm = '1'; el.textContent = t('tap_confirm'); el.classList.add('danger'); } },
  gift: () => { if (!S.alliance || S.alliance.gift === today()) return; S.alliance.gift = today(); give({ gems: 60, food: 3000, wood: 3000, sp5: 2 }); SND.rare(); toast(t('ally_gift_got')); save(); refresh(); },
  ...ADMIN_ACT,
};
document.addEventListener('click', e => {
  const m = $('#modal'); if (e.target === m) { if (!modalFull) closeModal(); return; }
  const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
  if (el.tagName === 'SELECT') return;
  const f = ACT[el.dataset.a]; if (f) { e.stopPropagation(); ac(); if (el.dataset.a !== 'collect') SND.click(); f(el.dataset.x, el, e); }
});
document.addEventListener('change', e => { const el = e.target.closest('select[data-a]'); if (el && ACT[el.dataset.a]) ACT[el.dataset.a](el.value, el, e); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalFn && !modalFull) closeModal(); if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-a]')) { e.preventDefault(); e.target.click(); } });
document.addEventListener('input', e => {
  if (e.target.id === 'trn') { trainN = +e.target.value; $('#trnv').textContent = trainN; const per = trainCostPer(); $('#trnc').innerHTML = `${costHTML({ food: per.food * trainN, iron: per.iron * trainN })} <span class="cc">⏱ ${fmtT(trainMs(trainN) / 1000)}</span>`; }
});
document.addEventListener('submit', e => {
  e.preventDefault(); const id = e.target.id;
  if (id === 'chatf') {
    const i = $('#chatin'); const v = i.value.trim(); if (!v) return; S.chat.push({ me: true, m: v, t: now() }); if (S.chat.length > 40) S.chat.shift(); i.value = '';
    setTimeout(() => { if (!S.alliance) return; S.chat.push({ u: pick(S.alliance.m).n, m: pick(CHATR), t: now() }); if (tab === 'alliance') render(); }, 1500 + Math.random() * 2500); save(); render();
  }
  if (id === 'namef') { const v = $('#namein').value.trim().slice(0, 16); if (v) { S.name = v; save(); toast(t('name_saved')); refresh(); syncPlayer().catch(() => { }); } }
  if (id === 'admLoginF') { const em = val('admEmail'), pw = $('#admPass').value; admRun(async () => { await adminLogin(em, pw); ADM.tab = 'dash'; await admLoad('dash', true); }, t('welcome_admin')); }
  if (id === 'admSearchF') { ADM.q = val('admQ'); ADM.sel = null; admLoad('players', true); }
});
window.addEventListener('resize', () => { if (tab === 'world') sizeWorld(); if (B) { bResize(); bBg(); } });
$('#b-cards').addEventListener('click', e => { const el = e.target.closest('.bc'); if (!el || !B) return; const h = B.heroes.find(x => x.slot === +el.dataset.slot); if (h) cast(h); });
$('#b-spd').onclick = () => { S.spd = S.spd === 1 ? 2 : 1; $('#b-spd').textContent = '×' + S.spd; $('#b-spd').classList.toggle('on', S.spd > 1); };
$('#b-auto').onclick = () => { S.auto = !S.auto; $('#b-auto').classList.toggle('on', S.auto); };
$('#b-quit').onclick = () => { if (!B || B.done) return; if (B.quitArm > now()) bEnd(!!B.cfg.boss, t('retreated')); else { B.quitArm = now() + 2500; $('#b-quit').textContent = t('sure'); setTimeout(() => { if (B && !B.done) $('#b-quit').textContent = t('retreat'); }, 2500); } };

/* ================= save ================= */
const KEY = 'fajr-naajin-save-v1';
let lastLocal = 0, cloud = null, cloudBusy = false, lastCloud = 0;
function save(force) {
  S.savedAt = now(); lastLocal = S.savedAt;
  storeSet(KEY, JSON.stringify(S));
  if (force) { pushCloud(); syncPlayer().catch(() => { }); }
}
function autosave() { const tm = now(); if (tm - lastLocal > 5000) save(); if (cloud && tm - lastCloud > 45000) pushCloud(); }
async function pushCloud() { if (!cloud || cloudBusy) return; cloudBusy = true; lastCloud = now(); try { await cloud.set({ savedAt: S.savedAt, data: JSON.stringify(S) }); } catch (e) { } cloudBusy = false; }
function loadLocal() { try { const raw = storeGet(KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) { } return null; }
function catchUp(st) {
  const off = clamp(now() - st.savedAt, 0, 24 * 3600e3); S = st;
  const before = {}; PLOTS.forEach(p => { if (BT[p.t].prod) before[p.k] = S.b[p.k].acc; });
  produce(off);
  const gained = {}; PLOTS.forEach(p => { const T = BT[p.t]; if (!T.prod) return; const g = S.b[p.k].acc - before[p.k]; if (g > 0) gained[T.prod] = (gained[T.prod] || 0) + g; });
  if (S.siegeAt < now()) S.siegeAt = now() + 5 * 60e3;
  return { off, gained };
}
/* optional: cloud save when the game is opened inside claude.ai */
async function connectClaudeCloud() {
  try {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    const [d, u] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    if (!d || !u) return; const id = await u.id(); if (!id) return;
    const ref = d.doc(`data/users/${id}/saves/main`); const snap = await ref.get(); cloud = ref;
    if (snap.exists) { const r = snap.data(); if (r && r.data && (r.savedAt || 0) > (S.savedAt || 0) + 3000) { try { const st = migrate(JSON.parse(r.data)); catchUp(st); setLang(S.lang || LANG); lastTick = now(); save(); refresh(); toast(t('cloud_loaded')); } catch (e) { } } }
    else pushCloud();
  } catch (e) { }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); pushCloud(); syncPlayer().catch(() => { }); scheduleNotifs(); } else { const LN = plugin('LocalNotifications'); if (LN) LN.getPending().then(p => p && p.notifications && p.notifications.length && LN.cancel({ notifications: p.notifications.map(n => ({ id: n.id })) })).catch(() => { }); } });
try { const P = plugin('App'); if (P) P.addListener('pause', () => { save(); syncPlayer().catch(() => { }); scheduleNotifs(); }); const SB = plugin('StatusBar'); if (SB) SB.setStyle({ style: 'DARK' }).catch(() => { }); } catch (e) { }

/* ================= boot ================= */
function start(data) {
  let info = null;
  if (data && data.S) { S = migrate(data.S); if (typeof data.tab === 'string') tab = data.tab; }
  else { const st = loadLocal(); if (st) info = catchUp(st); else S = newState(); }
  setLang(S.lang || guessLang());
  lastTick = now(); ensureDaily(); ensurePass();
  if (!S.world.nodes) genWorld();
  render();
  if (!S.lang) openModal(mLang);
  else if (!S.tut) { S.tut = true; openModal(mTut); }
  else if (info && info.off > 300000 && Object.keys(info.gained).length) openModal(() => mOffline(info.off / 1000, info.gained));
  else if (info && info.off > 60000) toast(t('produced_away', fmtT(info.off / 1000)));
  setInterval(tick, 250);
  setInterval(() => { netTick(); }, 15000);
  connectClaudeCloud(); netInit(); iapInit();
}
try { window.claude && window.claude.hot && window.claude.hot.snapshot && window.claude.hot.snapshot(() => ({ S, tab })); } catch (e) { }
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(start); else start((window.claude && window.claude.hot && window.claude.hot.data) || {});
