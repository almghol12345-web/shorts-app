import { h, fmt, fmtTime, modal, result, progress, costRow, toast } from './dom.js';
import { A } from './app.js';
import { buildingArt, actionBlock, openTimer, statTable } from './common.js';
import { BUILDINGS, BASE_LAYOUT, RESOURCE_TYPES, maxCountFor, tierFor, TIERS_BY_LEVEL } from '../data/buildings.js';
import { TROOP_TYPES, TIER_NAMES, troopStats } from '../data/troops.js';
import { RESEARCH, BRANCHES } from '../data/research.js';
import { GEAR_SLOTS, GEAR_SLOT_INFO, GEAR_RARITY, forgeCost, gearStats, gearUpgradeCost } from '../data/items.js';
import { RES_INFO } from '../data/config.js';
import { openRecruit, openFormation } from './heroes.js';
import { openAlliance } from './social.js';

export function openSlot(slotId) {
  const g = A.g, lay = BASE_LAYOUT.find((l) => l.id === slotId), b = g.s.buildings[slotId];
  if (lay.plot && (!b || (b.lvl === 0 && !g.s.queues.build.some((q) => q.slot === slotId)))) return openPlotChooser(slotId);
  openBuilding(slotId);
}

function openPlotChooser(slotId) {
  const g = A.g;
  const m = modal({ title: 'Build on Plot', icon: '🏗️', render: () => [
    h('p.muted', {}, 'Resource buildings produce automatically. Tap the bubble above them to collect.'),
    ...RESOURCE_TYPES.map((t) => {
      const d = BUILDINGS[t], max = maxCountFor(t, g.lvl('hq')), have = g.countOf(t);
      const locked = g.lvl('hq') < d.unlockHQ;
      return h('div.card' + (locked || have >= max ? '.done' : ''), {}, h('div.bhead', {}, h('div.bimg', {}, buildingArt(t, 1)), h('div.grow', {},
        h('b', {}, d.icon, ' ', d.name), h('div.desc', {}, d.desc), h('div.muted', {}, `Built: ${have} / ${max}`),
        locked ? h('div.bad', {}, `Unlocks at Command Center Lv ${d.unlockHQ}`) : h('button.btn.sm' + (have >= max ? '.off' : ''), { style: { marginTop: '6px' }, onclick: () => { m.close(); openBuilding(slotId, t); } }, 'Select'))));
    }),
  ] });
}

export function openBuilding(slotId, plotType, opts = {}) {
  const g = A.g;
  const type = g.s.buildings[slotId]?.type || BASE_LAYOUT.find((l) => l.id === slotId).type || plotType;
  const d = BUILDINGS[type];
  const built = (g.s.buildings[slotId]?.lvl || 0) > 0;
  const fnTabs = [];
  if (built) {
    if (d.trains) fnTabs.push(['Train', trainTab]);
    if (type === 'research') fnTabs.push(['Research', researchTab]);
    if (type === 'hospital') fnTabs.push(['Heal', healTab]);
    if (type === 'forge') fnTabs.push(['Forge', forgeTab], ['Gear', gearTab]);
    if (d.produces) fnTabs.unshift(['Production', prodTab]);
    if (type === 'hq') fnTabs.push(['Overview', hqTab]);
  }
  const tabs = [...fnTabs.map((t) => t[0]), 'Upgrade'];
  const m = modal({ title: d.name, icon: d.icon, live: true, tabs, tab: opts.upgrade ? tabs.length - 1 : 0, render: (mm) => {
    const t = tabs[mm.tab];
    if (t === 'Upgrade') return upgradeTab(slotId, type, plotType, mm);
    return fnTabs.find((x) => x[0] === t)[1](slotId, type, mm);
  } });
  // shortcut buttons for buildings that open other screens
  if (built && type === 'tavern' && !opts.upgrade) setTimeout(() => { m.close(); openRecruit(); }, 0);
  if (built && type === 'alliance' && !opts.upgrade) setTimeout(() => { m.close(); openAlliance(); }, 0);
  return m;
}

function upgradeTab(slotId, type, plotType, m) {
  const g = A.g, d = BUILDINGS[type], b = g.s.buildings[slotId], lvl = b?.lvl || 0;
  const q = g.s.queues.build.find((x) => x.slot === slotId);
  const info = g.upgradeInfo(slotId, plotType);
  const head = h('div.bhead', {}, h('div.bimg', {}, buildingArt(type, Math.max(1, lvl))), h('div.grow', {},
    h('div.lvl', {}, lvl ? `Level ${lvl} / ${d.maxLevel}` : 'Not built'), h('div.desc', {}, d.desc),
    lvl ? statTable(d.effect(lvl), lvl < d.maxLevel ? d.effect(lvl + 1) : null) : statTable(d.effect(1))));
  const out = [h('div.card', {}, head)];
  if (q) {
    out.push(h('div.card.hl', {}, h('div.sec', {}, `Upgrading to Lv ${q.toLvl}`), progress(q.start, q.end), h('div.row', { style: { marginTop: '8px' } }, h('button.btn.blue.grow', { onclick: () => openTimer('build', slotId, `${d.name} → Lv ${q.toLvl}`) }, '⏩ Speed Up'))));
    return out;
  }
  if (lvl >= d.maxLevel) { out.push(h('p.good', {}, 'Maximum level reached.')); return out; }
  if (info.reqs?.length) out.push(h('div.card', {}, h('div.sec', {}, 'Building requirements'), ...info.reqs.map((r) => h('div.stat', {}, h('span', {}, `${BUILDINGS[r.b].name} Lv ${r.lvl}`), h('span', {}, r.ok ? h('b.good', {}, '✓') : h('button.btn.sm.gray', { onclick: () => { const slot = Object.entries(g.s.buildings).find(([, x]) => x.type === r.b)?.[0] || BASE_LAYOUT.find((l) => l.type === r.b)?.id; m.close(); if (slot) openBuilding(slot); } }, 'Go ›'))))));
  if (info.queueFull && info.ok) out.push(h('p.bad', {}, `All builders busy (${g.buildQueueCap()} queue${g.buildQueueCap() > 1 ? 's' : ''}). Reach VIP 2 for a second builder.`));
  out.push(actionBlock({ cost: info.cost || {}, time: info.time || 0, ok: info.ok && !info.queueFull, reason: info.reason, gemCost: info.gemCost, label: lvl ? 'Upgrade' : 'Build',
    onStart: () => { const r = g.startUpgrade(slotId, plotType); if (result(r, g, lvl ? 'Upgrade started' : 'Construction started')) { A.sfx('build'); m.close(); } },
    onInstant: () => { const r = g.startUpgrade(slotId, plotType, true); if (result(r)) { A.sfx('build'); m.refresh(); } } }));
  if (info.ok === false && info.reason === 'Choose a building') out.length = 0;
  return out;
}

function prodTab(slotId, type, m) {
  const g = A.g, d = BUILDINGS[type], res = d.produces;
  const pend = g.pending(slotId);
  return [
    h('div.card', {}, h('div.bhead', {}, h('div.bimg', {}, buildingArt(type, g.s.buildings[slotId].lvl)), h('div.grow', {},
      h('div.stat', {}, h('span', {}, 'This building'), h('b', {}, `${fmt(g.buildingRate(slotId))} ${RES_INFO[res].icon}/h`)),
      h('div.stat', {}, h('span', {}, `Total ${RES_INFO[res].name}`), h('b', {}, `${fmt(g.rate(res))}/h`)),
      h('div.stat', {}, h('span', {}, 'Research bonus'), h('b', {}, `+${Math.round(g.bonus('prod_' + res) * 100)}%`)),
      h('div.stat', {}, h('span', {}, 'Ready to collect'), h('b', {}, fmt(pend))),
      h('div.bar', { style: { marginTop: '6px' } }, h('div', { style: { width: g.pendingFrac(slotId) * 100 + '%' } })),
      h('div.muted', {}, 'Storage fills in 10 hours.')))),
    h('div.row', {}, h('button.btn.green.grow' + (pend ? '' : '.off'), { onclick: () => { const v = g.collect(slotId); A.sfx('collect'); toast(`+${fmt(v)} ${RES_INFO[res].icon}`, 'good'); m.refresh(); } }, 'Collect'), h('button.btn.grow', { onclick: () => { const t = g.collectAll(); A.sfx('collect'); toast('Collected: ' + Object.entries(t).map(([k, v]) => `${RES_INFO[k].icon}${fmt(v)}`).join(' '), 'good'); m.refresh(); } }, 'Collect All')),
  ];
}

function hqTab() {
  const g = A.g, hq = g.lvl('hq');
  const unlocks = Object.entries(BUILDINGS).filter(([, d]) => d.unlockHQ === hq + 1).map(([, d]) => `${d.icon} ${d.name}`);
  return [
    h('div.card', {}, h('div.stat', {}, h('span', {}, 'Total Power'), h('b', {}, fmt(g.power()))),
      h('div.stat', {}, h('span', {}, 'Builder queues'), h('b', {}, g.buildQueueCap())), h('div.stat', {}, h('span', {}, 'March slots'), h('b', {}, g.marchSlots())),
      h('div.stat', {}, h('span', {}, 'Troops at home'), h('b', {}, fmt(g.troopTotal()))), h('div.stat', {}, h('span', {}, 'Heroes'), h('b', {}, Object.keys(g.s.heroes).length + ' / 30')),
      h('div.stat', {}, h('span', {}, 'Peace shield'), h('b', {}, g.now() < g.s.shieldUntil ? h('span', { 'data-end': g.s.shieldUntil }, '') : 'None'))),
    h('div.sec', {}, 'Production per hour'),
    h('div.card', {}, ...['food', 'wood', 'metal', 'fuel'].map((r) => h('div.stat', {}, h('span', {}, RES_INFO[r].icon + ' ' + RES_INFO[r].name), h('b', {}, fmt(g.rate(r)))))),
    unlocks.length ? h('div.card.hl', {}, h('div.sec', {}, `Unlocks at Lv ${hq + 1}`), h('div', {}, unlocks.join(' · '))) : null,
    h('div.row', {}, h('button.btn.grow', { onclick: () => openFormation('defense') }, '🛡️ Defense Formation')),
  ];
}

// ---------------- training ----------------
const trainSel = {};
function trainTab(slotId, type, m) {
  const g = A.g, tt = BUILDINGS[type].trains, td = TROOP_TYPES[tt], bl = g.lvl(type), maxT = tierFor(bl);
  const sel = (trainSel[tt] ||= { tier: maxT, count: 0 });
  if (sel.tier > maxT) sel.tier = maxT;
  const q = g.s.queues.train[type];
  const info = g.trainInfo(tt, sel.tier, sel.count || 9999);
  if (!sel.count) sel.count = info.max;
  const real = g.trainInfo(tt, sel.tier, sel.count);
  const st = troopStats(tt, sel.tier);
  const out = [];
  if (q) out.push(h('div.card.hl', {}, h('div.sec', {}, `Training ${q.count} T${q.key.slice(-1)} ${td.name}`), progress(q.start, q.end, 'blue'), h('button.btn.blue', { style: { marginTop: '8px', width: '100%' }, onclick: () => openTimer('train', type, 'Training') }, '⏩ Speed Up')));
  out.push(h('div.sec', {}, 'Choose tier'),
    h('div.row.wrap', {}, ...[1, 2, 3, 4, 5].map((t) => h('button.btn.sm' + (t === sel.tier ? '' : '.gray') + (t > maxT ? '.off' : ''), { onclick: () => { sel.tier = t; m.refresh(); } }, `T${t}`, h('span.sub', {}, t > maxT ? `Lv ${TIERS_BY_LEVEL[t - 1]}` : TIER_NAMES[t - 1])))),
    h('div.card', {},
      h('div.row', {}, h('div.ic', { style: { fontSize: '34px' } }, td.icon), h('div.grow', {}, h('b', {}, `T${sel.tier} ${TIER_NAMES[sel.tier - 1]} ${td.name}`), h('div.muted', {}, `Strong vs ${TROOP_TYPES[td.strong].name}. Owned: ${fmt(g.s.troops[tt + sel.tier] || 0)}`))),
      h('div.row.wrap', { style: { marginTop: '6px' } }, ...['atk', 'def', 'hp', 'load'].map((k) => h('span.chip', {}, `${k.toUpperCase()} ${Math.round(st[k])}`)), h('span.chip', {}, `Power ${st.power}`)),
      h('div.sec', {}, `Amount: ${sel.count} / ${info.max}`),
      h('input', { type: 'range', min: 1, max: info.max, value: sel.count, oninput: (e) => { sel.count = +e.target.value; m.refresh(); } })),
    actionBlock({ cost: real.cost, time: real.time, ok: real.ok, reason: real.reason, gemCost: real.gemCost, label: 'Train',
      onStart: () => { if (result(g.startTraining(tt, sel.tier, sel.count), g, 'Training started')) m.refresh(); },
      onInstant: () => { if (result(g.startTraining(tt, sel.tier, sel.count, true), g)) m.refresh(); } }));
  return out;
}

// ---------------- research ----------------
let branchSel = 'economy';
function researchTab(slotId, type, m) {
  const g = A.g, q = g.s.queues.research[0];
  const out = [];
  if (q) out.push(h('div.card.hl', {}, h('div.sec', {}, `Researching ${RESEARCH.find((r) => r.id === q.id).name} Lv ${q.toLvl}`), progress(q.start, q.end, 'blue'), h('button.btn.blue', { style: { marginTop: '8px', width: '100%' }, onclick: () => openTimer('research', q.id, 'Research') }, '⏩ Speed Up')));
  out.push(h('div.row', { style: { marginBottom: '8px' } }, ...Object.entries(BRANCHES).map(([k, v]) => h('button.btn.sm.grow' + (k === branchSel ? '' : '.gray'), { onclick: () => { branchSel = k; m.refresh(); } }, v))));
  const nodes = RESEARCH.filter((r) => r.branch === branchSel).sort((a, b) => a.y - b.y || a.x - b.x);
  let lastY = -1;
  for (const n of nodes) {
    if (n.y !== lastY) { out.push(h('div.sec', {}, `Tier ${n.y + 1}`)); lastY = n.y; }
    const lvl = g.s.research[n.id] || 0, unlocked = g.researchUnlocked(n.id), busy = q?.id === n.id;
    out.push(h('div.tnode' + (lvl >= n.max ? '.max' : unlocked ? '' : '.lock') + (busy ? '.busy' : ''), { onclick: () => openResearchNode(n.id) },
      h('div.ic', {}, n.icon), h('div.grow', {}, h('b', {}, n.name), h('div.muted', {}, `${n.desc} +${Math.round(n.per * 100)}%/lvl · Lab ${n.lab}`), h('div.bar', { style: { marginTop: '4px' } }, h('div', { style: { width: (lvl / n.max * 100) + '%' } }))),
      h('div.lvl', {}, `${lvl}/${n.max}`)));
  }
  return out;
}
function openResearchNode(id) {
  const g = A.g, n = RESEARCH.find((r) => r.id === id);
  const m = modal({ title: n.name, icon: n.icon, cls: 'small', render: () => {
    const info = g.researchInfo(id), lvl = g.s.research[id] || 0;
    return [
      h('div.card', {}, h('div.stat', {}, h('span', {}, n.desc), h('b', {}, `+${Math.round(n.per * lvl * 100)}%`, lvl < n.max ? h('span.nx', {}, ` → +${Math.round(n.per * (lvl + 1) * 100)}%`) : null)),
        h('div.stat', {}, h('span', {}, 'Level'), h('b', {}, `${lvl} / ${n.max}`)),
        n.pre.length ? h('div.stat', {}, h('span', {}, 'Requires'), h('span', {}, n.pre.map((p) => { const [pid, pl] = p.split(':'); const ok = (g.s.research[pid] || 0) >= +pl; return h('b.' + (ok ? 'good' : 'bad'), {}, `${RESEARCH.find((r) => r.id === pid).name} ${pl} `); }))) : null),
      lvl >= n.max ? h('p.good', {}, 'Fully researched') : actionBlock({ cost: info.cost, time: info.time, ok: info.ok, reason: info.reason, gemCost: info.gemCost, label: 'Research',
        onStart: () => { if (result(g.startResearch(id), g, 'Research started')) { m.close(); A.refreshAll(); } },
        onInstant: () => { if (result(g.startResearch(id, true))) { m.refresh(); A.refreshAll(); } } }),
    ];
  } });
}

// ---------------- hospital ----------------
function healTab(slotId, type, m) {
  const g = A.g, q = g.s.queues.heal, info = g.healInfo();
  const out = [h('div.card', {}, h('div.stat', {}, h('span', {}, 'Capacity'), h('b', {}, `${fmt(g.woundedTotal())} / ${fmt(g.hospitalCap())}`)), h('div.muted', {}, 'Troops lost in battle recover here. Overflow troops die.'))];
  if (q) out.push(h('div.card.hl', {}, h('div.sec', {}, 'Healing in progress'), progress(q.start, q.end, 'green'), h('button.btn.blue', { style: { marginTop: '8px', width: '100%' }, onclick: () => openTimer('heal', 'heal', 'Healing') }, '⏩ Speed Up')));
  const w = Object.entries(g.s.wounded).filter(([, n]) => n);
  if (!w.length) out.push(h('p.muted', {}, 'No wounded troops.'));
  else {
    out.push(h('div.card', {}, ...w.map(([k, n]) => h('div.stat', {}, h('span', {}, `${TROOP_TYPES[k.slice(0, -1)].icon} T${k.slice(-1)} ${TROOP_TYPES[k.slice(0, -1)].name}`), h('b', {}, fmt(n))))));
    out.push(actionBlock({ cost: info.cost, time: info.time, ok: info.ok, reason: info.reason, gemCost: info.gemCost, label: 'Heal All',
      onStart: () => { if (result(g.startHeal(), g, 'Healing started')) m.refresh(); }, onInstant: () => { if (result(g.startHeal(true))) m.refresh(); } }));
  }
  return out;
}

// ---------------- forge ----------------
function forgeTab(slotId, type, m) {
  const g = A.g;
  return [h('p.muted', {}, `Gear Parts: ${fmt(g.s.items.parts || 0)}. Forge Lv 6 unlocks Epic, Lv 15 Legendary.`),
    ...GEAR_SLOTS.map((slot) => h('div.card', {}, h('b', {}, GEAR_SLOT_INFO[slot].icon, ' ', GEAR_SLOT_INFO[slot].name),
      h('div.row.wrap', { style: { marginTop: '6px' } }, ...['R', 'SR', 'SSR'].map((r) => {
        const c = forgeCost(r), allowed = g.forgeRarityAllowed(r);
        return h('div.card', { style: { flex: '1', minWidth: '110px', margin: 0, borderColor: GEAR_RARITY[r].color } }, h('div', { style: { color: GEAR_RARITY[r].color, fontWeight: 800, fontSize: '12px' } }, GEAR_RARITY[r].name), costRow(c, g),
          h('button.btn.sm' + (allowed && g.canAfford(c) ? '' : '.off'), { style: { marginTop: '6px', width: '100%' }, onclick: () => { if (result(g.forgeGear(slot, r))) { A.sfx('build'); m.refresh(); } } }, allowed ? 'Forge' : '🔒'));
      }))))];
}
function gearTab(slotId, type, m) {
  const g = A.g;
  if (!g.s.gear.length) return h('p.muted', {}, 'No gear yet. Forge some, or defeat campaign bosses.');
  return [...g.s.gear].sort((a, b) => 'SSR SR R'.indexOf(a.rarity) - 'SSR SR R'.indexOf(b.rarity) || b.lvl - a.lvl).map((gr) => {
    const st = gearStats(gr);
    return h('div.li', {}, h('span.ic', { style: { color: GEAR_RARITY[gr.rarity].color } }, GEAR_SLOT_INFO[gr.slot].icon), h('div.grow', {},
      h('b', { style: { color: GEAR_RARITY[gr.rarity].color } }, `${gr.name} +${gr.lvl}`), h('div.muted', {}, Object.entries(st).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(' · '), gr.hero ? ` · on ${A.heroName(gr.hero)}` : '')),
      h('button.btn.sm', { onclick: () => { if (result(g.upgradeGear(gr.id))) m.refresh(); } }, '▲', h('span.sub', {}, '🔧' + gearUpgradeCost(gr))),
      h('button.btn.sm.gray', { onclick: () => { const r = g.salvageGear(gr.id); if (r.ok) { toast(`Salvaged for ${r.parts} parts`, 'good'); m.refresh(); } } }, '♻'));
  });
}
