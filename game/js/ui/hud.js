import { h, fmt, fmtTime, tickTimers } from './dom.js';
import { A } from './app.js';
import { RES_INFO, VIGOR_MAX } from '../data/config.js';
import { openProfile, openShop, openMissions, openEvents, openReports, openMail, openBag, openSettings } from './meta.js';
import { openRanking, openArena, openAlliance } from './social.js';
import { openHeroes, openRecruit } from './heroes.js';
import { openCampaign } from './campaign.js';
import { openTimer } from './common.js';
import { openBuilding } from './building.js';
import { openMarches } from './worldui.js';
import { BUILDINGS, BASE_LAYOUT } from '../data/buildings.js';
import { STORY } from '../data/missions.js';

const els = {};
export function buildHud() {
  const g = A.g;
  const hud = document.getElementById('hud');
  els.avatar = h('div.avatar', { onclick: openProfile }, els.lv = h('span.lv', {}, '1'));
  els.name = h('div.pname'); els.pow = h('div.ppow');
  els.res = {};
  const resbar = h('div.resbar', {}, ...['food', 'wood', 'metal', 'fuel'].map((r) => (els.res[r] = h('div.res', { onclick: () => openBag(), title: RES_INFO[r].name }, h('span.ic', {}, RES_INFO[r].icon), h('span', {}, '0')))),
    els.gems = h('div.res.gems', { onclick: () => openShop() }, h('span.ic', {}, '💎'), h('span', {}, '0')));
  els.vigor = h('span.vigor'); els.shield = h('span.vigor'); els.alert = h('div.alert.hidden'); els.net = h('span.vigor');
  hud.replaceChildren(h('div.toprow', {}, els.avatar, h('div.pinfo', { onclick: () => openShop() }, els.name, els.pow), resbar), h('div.subrow', {}, els.vigor, els.shield, els.net, els.alert));
  const side = document.getElementById('side');
  const sb = (icon, label, fn, key) => { const d = h('span.dot.hidden'); els['dot_' + key] = d; return h('button.sbtn', { onclick: fn }, icon, h('small', {}, label), d); };
  side.replaceChildren(sb('🔥', 'Events', () => openEvents(), 'events'), sb('📋', 'Quests', () => openMissions(1), 'missions'), sb('🛒', 'Shop', () => openShop(), 'shop'),
    sb('📜', 'Reports', () => openReports(), 'reports'), sb('✉️', 'Mail', () => openMail(), 'mail'), sb('🏆', 'Rank', () => openRanking(), 'rank'), sb('🎒', 'Bag', () => openBag(), 'bag'), sb('⚙️', 'Settings', () => openSettings(), 'set'));
  const nav = document.getElementById('nav');
  const nb = (id, icon, label, fn) => h('button', { 'data-id': id, onclick: fn }, h('span.ni', {}, icon), label, h('span.dot.hidden', { 'data-dot': id }));
  nav.replaceChildren(nb('base', '🏰', 'Base', () => A.switchScreen('base')), nb('world', '🌍', 'World', () => A.switchScreen('world')), nb('heroes', '🦸', 'Heroes', () => openHeroes()),
    nb('campaign', '🗺️', 'Campaign', () => openCampaign()), nb('alliance', '🤝', 'Alliance', () => openAlliance()), nb('arena', '⚔️', 'Arena', () => openArena()));
  els.quest = document.getElementById('quest');
  els.timers = document.getElementById('sideL');
  updateHud(true);
}
let lastTimers = '';
export function updateHud(full) {
  const g = A.g; if (!els.name) return;
  const p = g.s.player;
  els.avatar.style.backgroundImage = `url(${A.portrait(p.avatar, 96)})`;
  els.lv.textContent = p.level;
  els.name.replaceChildren(p.name, h('span.vip', {}, 'VIP ' + g.vipLevel()));
  els.pow.textContent = '⚡ ' + fmt(g.power());
  for (const r of ['food', 'wood', 'metal', 'fuel']) els.res[r].lastChild.textContent = fmt(g.s.res[r]);
  els.gems.lastChild.textContent = fmt(g.s.gems);
  els.vigor.textContent = `⚡ ${g.vigor()}/${VIGOR_MAX + g.vip().vigor} Vigor`;
  const sh = g.s.shieldUntil - g.now();
  els.shield.textContent = sh > 0 ? `🛡️ ${fmtTime(sh / 1000)}` : '🛡️ No shield'; els.shield.style.color = sh > 0 ? '#5fd3ff' : '#a99a88';
  els.net.textContent = A.net.user ? `🟢 ${A.net.user.name}` : A.net.online ? '🟡 Server: not logged in' : '⚪ Offline';
  if (g.s.incoming) { els.alert.classList.remove('hidden'); els.alert.textContent = `⚠️ ${g.s.incoming.name} attacking in ${fmtTime((g.s.incoming.arrive - g.now()) / 1000)}!`; els.alert.onclick = () => import('./heroes.js').then((m) => m.openFormation('defense')); }
  else els.alert.classList.add('hidden');
  // badges
  const dot = (k, n) => { const d = els['dot_' + k]; if (!d) return; d.classList.toggle('hidden', !n); d.textContent = n > 9 ? '9+' : n; };
  dot('missions', g.claimableCount());
  const ev = g.currentEvent(), st = g.eventState();
  dot('events', ev.def.milestones.filter(([pts], i) => st.pts >= pts && !st.claimed.includes(i)).length + (g.loginState().claimedToday ? 0 : 1));
  dot('reports', g.s.reports.filter((r) => !r.read).length);
  dot('mail', g.s.inbox.filter((m) => !m.read || (m.reward && !m.claimed)).length);
  dot('shop', g.freeSupplyReady() ? 1 : 0);
  const ad = document.querySelector('[data-dot=alliance]'); if (ad) { const n = g.s.alliance ? (g.s.alliance.requests?.length || 0) + (g.s.alliance.gifts?.length || 0) : 0; ad.classList.toggle('hidden', !n); ad.textContent = n > 9 ? '9+' : n; }
  const hd = document.querySelector('[data-dot=heroes]'); if (hd) { const n = g.freeRecruitReady() ? 1 : 0; hd.classList.toggle('hidden', !n); hd.textContent = '!'; }
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.id === A.screen));
  // timers column
  const timers = g.allTimers();
  const key = timers.map((t) => t.kind + t.key + t.q.end).join() + g.s.queues.build.length + g.buildQueueCap() + g.s.marches.map((m) => m.id + m.state).join() + A.screen;
  if (full || key !== lastTimers) {
    lastTimers = key;
    const chips = [];
    for (let i = g.s.queues.build.length; i < g.buildQueueCap(); i++) chips.push(h('div.tchip.idle', { onclick: () => suggestBuild() }, '🔨', h('span.tl', {}, 'Builder idle')));
    for (const t of timers) chips.push(h('div.tchip', { onclick: () => openTimer(t.kind, t.key, t.label) }, t.icon, h('span.tl', {}, t.label), h('span.tt', { 'data-end': t.q.end }, '')));
    if (!g.s.queues.research.length && g.lvl('research')) chips.push(h('div.tchip.idle', { onclick: () => openBuilding('research') }, '🔬', h('span.tl', {}, 'Lab idle')));
    if (g.s.marches.length) chips.push(h('div.tchip', { onclick: () => openMarches() }, '🚩', h('span.tl', {}, `${g.s.marches.length} march${g.s.marches.length > 1 ? 'es' : ''}`)));
    els.timers.replaceChildren(h('div.timers', {}, ...chips));
  }
  // quest bar
  const q = g.storyQuest();
  if (q && A.screen === 'base') {
    els.quest.classList.remove('hidden');
    els.quest.replaceChildren(h('span.qi', {}, q.done ? '🎁' : '📌'), h('div.qt', {}, h('b', {}, `Story ${q.i + 1}/${STORY.length}`), q.text, ` (${fmt(q.have)}/${fmt(q.need)})`),
      h('button.btn.sm' + (q.done ? '.green' : ''), { onclick: () => { if (q.done) { g.claimStory(); A.sfx('success'); A.toast('Story reward claimed!', 'good'); updateHud(true); } else goQuest(q); } }, q.done ? 'Claim' : 'Go'));
  } else els.quest.classList.add('hidden');
  tickTimers(g.now());
}
function slotOf(type) { return Object.entries(A.g.s.buildings).find(([, b]) => b.type === type)?.[0] || BASE_LAYOUT.find((l) => l.type === type)?.id; }
export function goEvent(ev) {
  const g = A.g; import('./dom.js').then((d) => d.closeAll());
  const map = { collect: () => { A.switchScreen('base'); A.toast('Tap the bubbles above farms and lumber yards'); }, build: () => { A.switchScreen('base'); suggestBuild(); }, train: () => openBuilding('barracks'), recruit: () => openRecruit(), research: () => g.lvl('research') ? openBuilding('research') : openBuilding('research', undefined, { upgrade: true }),
    zombie: () => { A.switchScreen('world'); A.toast('Tap a zombie horde to attack it'); }, gather: () => { A.switchScreen('world'); A.toast('Tap a resource node to gather'); }, scout: () => A.switchScreen('world'), raid: () => A.switchScreen('world'),
    arena: () => openArena(), pve: () => openCampaign(), help: () => openAlliance(), donate: () => openAlliance(), boss: () => openAlliance(), heal: () => openBuilding('hospital'), heroLevel: () => openHeroes(), forge: () => openBuilding('forge', undefined, { upgrade: !g.lvl('forge') }), gems: () => openShop() };
  (map[ev] || (() => {}))();
}
function goQuest(q) {
  const g = A.g;
  if (q.kind === 'bld') { A.switchScreen('base'); return openBuilding(slotOf(q.b), undefined, { upgrade: true }); }
  if (q.kind === 'count') { A.switchScreen('base'); const plot = BASE_LAYOUT.find((l) => l.plot && !g.s.buildings[l.id]); if (plot) import('./building.js').then((m) => m.openSlot(plot.id)); return; }
  if (q.kind === 'stage') return openCampaign();
  if (q.kind === 'alliance') return openAlliance();
  if (q.kind === 'star') return openHeroes();
  const map = { collect: () => { const t = g.collectAll(); A.sfx('collect'); const txt = Object.entries(t).map(([k, v]) => RES_INFO[k].icon + fmt(v)).join(' '); A.toast(txt ? 'Collected ' + txt : 'Nothing to collect yet — wait for the bubbles', txt ? 'good' : 'info'); }, train: () => openBuilding('barracks'), recruit: () => openRecruit(), research: () => openBuilding('research'), zombie: () => A.switchScreen('world'), gather: () => A.switchScreen('world'), arena: () => openArena(), forge: () => g.lvl('forge') ? openBuilding('forge') : openBuilding('forge') };
  (map[q.ev] || (() => {}))();
}
function suggestBuild() {
  const g = A.g;
  // open the cheapest affordable upgrade
  const opts = BASE_LAYOUT.filter((l) => g.s.buildings[l.id]?.lvl > 0 || (!l.plot && g.lvl('hq') >= BUILDINGS[l.type].unlockHQ)).map((l) => ({ l, i: g.upgradeInfo(l.id) })).filter((x) => x.i.ok);
  opts.sort((a, b) => (a.l.type === 'hq' ? -1 : 0) - (b.l.type === 'hq' ? -1 : 0) || a.i.time - b.i.time);
  if (opts.length) openBuilding(opts[0].l.id); else A.toast('Tap a building or empty plot to build', 'info');
}
