import { L, t as T, tr, setLang, getLang, LANGS } from './i18n.js';
// Bootstrap: load/create save, wire views, run the game loop, autosave, sync with server.
import { Game } from './core/game.js';
import { A } from './ui/app.js';
import { h, toast, refreshAll, refreshLive, modalOpen, tickTimers, fmt } from './ui/dom.js';
import { BaseView } from './render/base.js';
import { WorldView } from './render/worldmap.js';
import { heroPortrait } from './render/art.js';
import { sfx, unlockAudio } from './audio.js';
import { buildHud, updateHud } from './ui/hud.js';
import { openSlot } from './ui/building.js';
import { showTileInfo, openMarches } from './ui/worldui.js';
import { openEvents } from './ui/meta.js';
import { Net } from './net.js';
import { HERO_BY_ID } from './data/heroes.js';
import { RES_INFO } from './data/config.js';
import { BUILDINGS } from './data/buildings.js';
import { initPlatform, storage, onBack, onPause, haptic, hideSplash, device, setHaptics, isNative, setQuality } from './platform.js';
import { topModal, closeAll } from './ui/dom.js';

const SAVE_KEY = 'ashfall.save';
A.sfx = (n) => { if (A.g?.s.settings.sound) sfx(n); };
void closeAll;
A.toast = toast;
A.portrait = heroPortrait;
A.heroName = (id) => HERO_BY_ID[id]?.name || id;
A.refreshHud = () => updateHud(true);
A.refreshAll = () => { refreshAll(); updateHud(true); };
A.net = new Net();

async function loadSave() {
  const parse = (raw) => { try { return raw ? JSON.parse(raw) : null; } catch { return null; } };
  const local = parse(storage.get(SAVE_KEY)), durable = parse(await storage.getDurable(SAVE_KEY));
  if (local && durable) return (local.lastTick || 0) >= (durable.lastTick || 0) ? local : durable;
  return local || durable;
}
function save() { if (A.g) storage.set(SAVE_KEY, A.g.serialize()); }
A.save = save;
A.haptic = haptic;

// ---------- splash ----------
function embers() { const e = document.getElementById('embers'); for (let i = 0; i < 40; i++) { const s = h('i'); s.style.left = Math.random() * 100 + '%'; s.style.animationDuration = 4 + Math.random() * 6 + 's'; s.style.animationDelay = -Math.random() * 8 + 's'; e.append(s); } }
export function applyLang(l) {
  setLang(l);
  document.documentElement.lang = getLang();
  document.documentElement.dir = getLang() === 'ar' ? 'rtl' : 'ltr';
  document.title = T('Ashfall: Last Bastion');
}
function initialLang() {
  const saved = storage.get('ashfall.lang');
  if (saved) return saved;
  return (navigator.languages || [navigator.language || 'en']).some((x) => /^ar\b/i.test(x)) ? 'ar' : 'en';
}
function splash(existing) {
  embers();
  const form = document.getElementById('splashForm');
  const sp = document.getElementById('splash');
  sp.querySelector('h2').textContent = T('THE LAST'); sp.querySelector('h1').textContent = T('ASHFALL'); sp.querySelectorAll('h2')[1].textContent = T('BASTION');
  sp.querySelector('p').textContent = T('The dead walk. The cities burn. Build your bastion, rally survivors, and take back the wasteland.');
  const langRow = h('div.row.c', { style: { position: 'absolute', top: 'calc(14px + var(--safe-t))', insetInlineEnd: '14px' } }, ...Object.entries(LANGS).map(([k, v]) => h('button.btn.sm' + (getLang() === k ? '' : '.gray'), { onclick: () => { storage.set('ashfall.lang', k); location.reload(); } }, v)));
  sp.append(langRow);
  if (existing) {
    form.append(h('button.btn', { style: { fontSize: '18px', padding: '14px 40px' }, onclick: () => start(existing) }, '▶  CONTINUE'), h('div.muted', { style: { marginTop: '8px' } }, L`${existing.player.name} · Commander Lv ${existing.player.level}`));
  } else {
    const name = h('input.txt', { placeholder: 'Commander name', maxlength: 16, value: 'Survivor' + Math.floor(Math.random() * 900 + 100), style: { textAlign: 'center', marginBottom: '10px' } });
    form.append(name, h('button.btn', { style: { fontSize: '18px', padding: '14px 40px', width: '100%' }, onclick: () => start(null, name.value.trim() || 'Survivor') }, '▶  BEGIN'));
  }
}

function start(state, name) {
  unlockAudio(state?.settings || { sound: true, music: true });
  const g = new Game(state, { name });
  A.g = g;
  g.s.settings.quality ||= device.lowEnd ? 'low' : 'high';
  if (g.s.settings.haptics === undefined) g.s.settings.haptics = true;
  setHaptics(g.s.settings.haptics);
  setQuality(g.s.settings.quality);
  A.quality = () => g.s.settings.quality;
  const fresh = !state;
  document.getElementById('splash').remove();
  g.on('toast', ({ msg, kind }) => toast(msg, kind));
  g.on('incoming', () => { A.sfx('alarm'); haptic('warning'); });
  g.on('built', (q) => { A.sfx('success'); A.views.base?.float(L`Lv ${q.toLvl}!`, q.slot, '#ffd27a'); });
  g.on('helped', ({ by }) => { if (Math.random() < 0.3) toast(L`🤝 ${by} helped you`); });
  g.on('report', (r) => { if (r.type === 'pve' && r.title.startsWith('Campaign')) return; if (r.type !== 'arena' && r.type !== 'boss') toast((r.win ? '✅ ' : '❌ ') + r.title, r.win ? 'good' : 'bad'); });
  g.basePos();
  // offline progress summary
  const away = state ? (Date.now() - state.lastTick) / 1000 : 0;
  g.tick();
  if (fresh) {
    g.addMail('Welcome, Commander', 'The dead overran the city, but this compound still stands. Upgrade your Command Center, train troops at the Barracks and recruit heroes at the Survivor Hall. Your newcomer shield protects you for 3 days. Good luck.', { gems: 200, ticket: 2, speed5m: 5 });
    g.addMail('Field Guide', 'Tip: tap the bubbles over farms and lumber yards to collect. Idle builders are shown on the left — keep them busy! On the World Map, attack zombie hordes (costs Vigor), gather at resource nodes, and scout rivals before raiding them.', null);
  } else if (away > 120) {
    let prod = {}; for (const id of Object.keys(g.s.buildings)) { const b = g.s.buildings[id]; const r = BUILDINGS[b.type].produces; if (r) prod[r] = (prod[r] || 0) + g.pending(id); }
    setTimeout(() => toast(L`Welcome back! While away (${Math.round(away / 60)} min): ${Object.entries(prod).filter(([, v]) => v).map(([k, v]) => RES_INFO[k].icon + fmt(v)).join(' ') || 'nothing produced'} ready to collect`, 'good'), 600);
  }
  const base = new BaseView(document.getElementById('baseCanvas'), g, { onSelect: (slot) => openSlot(slot), sfx: A.sfx, forceDay: () => g.s.settings.alwaysDay });
  const world = new WorldView(document.getElementById('worldCanvas'), g, { onSelect: (sel) => showTileInfo(sel), onMarch: () => openMarches() });
  A.views = { base, world };
  buildHud();
  const wui = document.getElementById('worldui');
  const coord = h('div.coord', {}, '');
  wui.replaceChildren(h('button.btn.sm', { onclick: () => world.goHome() }, '🏰 Home'), h('button.btn.sm.gray', { onclick: () => openMarches() }, '🚩 Marches'), coord);
  A.switchScreen = (s) => {
    if (A.screen !== s) { const f = document.getElementById('fade'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
    A.screen = s;
    document.getElementById('baseCanvas').classList.toggle('hidden', s !== 'base');
    document.getElementById('worldCanvas').classList.toggle('hidden', s !== 'world');
    wui.classList.toggle('hidden', s !== 'world');
    if (s !== 'world') showTileInfo(null);
    resize();
    if (s === 'world' && !world.homed) { world.goHome(); world.homed = true; refreshRemotePlayers(); }
    updateHud(true);
  };
  const resize = () => { base.resize(); world.resize(); };
  window.addEventListener('resize', resize);
  A.switchScreen('base');
  // Main render loop
  // Frame limiter: 60 fps normally, 30 fps on "Battery saver", ~8 fps while a full-screen menu covers the map
  let lastFrame = 0;
  const loop = (now) => {
    requestAnimationFrame(loop);
    const covered = document.querySelector('.modal.show:not(.small)');
    const minGap = covered ? 120 : g.s.settings.quality === 'low' ? 32 : 0;
    if (now - lastFrame < minGap) return;
    lastFrame = now;
    const t = now / 1000;
    if (!document.getElementById('battle').classList.contains('hidden')) { /* battle renders itself */ }
    else if (A.screen === 'base') base.render(t);
    else { world.render(t); const c = world.centerTile(); coord.textContent = L`X:${c.x} Y:${c.y}`; }
  };
  requestAnimationFrame(loop);
  // Logic tick
  setInterval(() => { g.tick(); tickTimers(g.now()); }, 250);
  setInterval(() => { updateHud(); refreshLive(); }, 1000);
  g.on('change', () => {});
  document.addEventListener('click', () => setTimeout(() => updateHud(true), 0), true);
  document.addEventListener('pointerup', () => setTimeout(() => updateHud(), 30));
  setInterval(save, 5000);
  onPause(() => { g.tick(); save(); A.net.pushSave().catch(() => {}); });
  // Save soon after anything changes (debounced) so progress survives the app being killed
  let saveTimer = 0; g.on('change', () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 800); });
  onBack(() => {
    const battle = document.getElementById('battle');
    if (!battle.classList.contains('hidden')) { const btn = battle.querySelector('[data-back="2"]') || battle.querySelector('[data-back="1"]'); btn?.click(); return true; }
    if (topModal()) { topModal().close(); return true; }
    if (!document.getElementById('tileinfo').classList.contains('hidden')) { showTileInfo(null); return true; }
    if (A.screen !== 'base') { A.switchScreen('base'); return true; }
    return false;
  });
  if (fresh || !g.loginState().claimedToday) setTimeout(() => { if (!modalOpen()) openEvents(); setTimeout(() => { const tabs = document.querySelectorAll('.tab'); tabs[1]?.click(); }, 50); }, 900);
  // Network
  A.net.probe().then(() => { updateHud(true); if (A.net.user) { syncLoop(); } });
  setInterval(() => { if (A.net.user) syncLoop(); }, 45000);
  save();
}

async function syncLoop() {
  const g = A.g, net = A.net;
  try {
    await net.pushSave();
    const ib = await net.inbox();
    if (ib.ok && ib.items?.length) {
      for (const e of ib.items) applyServerEffect(e);
      await net.ackInbox(ib.items.map((e) => e.id));
    }
    if (g.s.alliance?.mode === 'online') {
      const r = await net.myAlliance();
      if (r.ok && !r.alliance) { g.s.alliance = null; toast('You are no longer in an online alliance'); }
      else if (r.ok) {
        g.s.alliance.tech = r.alliance.tech || {};
        for (const mh of r.alliance.myHelps || []) { const q = g.queueRef(mh.kind, mh.key); if (q) { const n = mh.helps - (q.helpsApplied || 0); for (let i = 0; i < n; i++) g.applyHelp(q); q.helpsApplied = mh.helps; q.helps = mh.helps; q.helpCap = mh.cap; } }
      }
    }
    if (A.screen === 'world') refreshRemotePlayers();
  } catch { /* offline */ }
}
async function refreshRemotePlayers() {
  if (!A.net.user) return;
  try {
    const r = await A.net.worldPlayers();
    if (r.ok) A.views.world.remote = r.players.filter((p) => p.uid !== A.net.user.id).map((p) => ({ ...p, kind: 'rival', remote: true, id: 'u:' + p.uid, lvl: p.hq }));
  } catch { /* ignore */ }
}
function applyServerEffect(e) {
  const g = A.g;
  if (e.type === 'raided') {
    for (const [k, v] of Object.entries(e.loot || {})) g.s.res[k] = Math.max(0, g.s.res[k] - v);
    for (const [k, v] of Object.entries(e.losses || {})) g.s.troops[k] = Math.max(0, (g.s.troops[k] || 0) - v);
    const { wounded } = g.addWounded(e.losses || {});
    g.addReport({ type: 'defense', title: e.win ? L`${e.by} raided your bastion (online)` : L`Repelled ${e.by} (online)`, win: !e.win, plundered: e.loot, wounded, a: e.a, b: e.b, seed: e.seed, defender: true, summary: e.summary });
    if (e.win) g.s.shieldUntil = Math.max(g.s.shieldUntil, Date.now() + 30 * 60000);
    toast(e.win ? L`⚠️ ${e.by} raided you while you were away` : L`🛡️ You repelled ${e.by}`, e.win ? 'bad' : 'good');
  } else if (e.type === 'arena') {
    g.s.arena.points = e.points ?? g.s.arena.points;
  } else if (e.type === 'mail') g.addMail(e.title, e.body, e.reward);
}

if (!isNative && 'serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.ashfall = A; // handy for debugging from the console
window.addEventListener('ashfall-toast', (e) => toast(e.detail));
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault()); // iOS pinch-zooming the page
(async () => { await initPlatform(); applyLang(initialLang()); hideSplash(); splash(await loadSave()); })();
