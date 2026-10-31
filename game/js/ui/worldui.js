import { h, fmt, fmtTime, modal, result, toast, rewardChips } from './dom.js';
import { A } from './app.js';
import { heroCard } from './heroes.js';
import { targetSquads, labelOf, NODE_TYPES, territoryAt, objectById } from '../core/world.js';
import { sidePower } from '../core/combat.js';
import { RES_INFO } from '../data/config.js';
import { HERO_BY_ID } from '../data/heroes.js';
import { openBattle } from './battle.js';

const TERRAIN = ['Wasteland', 'Ruined City', 'Dead Forest', 'Flooded Ground', 'Old Highway', 'Ground Zero (toxic)'];
export function showTileInfo(sel) {
  const el = document.getElementById('tileinfo');
  if (!sel) { el.classList.add('hidden'); return; }
  const g = A.g; el.classList.remove('hidden'); el.replaceChildren();
  const close = h('button.btn.sm.gray', { style: { position: 'absolute', right: '8px', top: '8px' }, onclick: () => { el.classList.add('hidden'); A.views.world.sel = null; } }, '✕');
  const ter = territoryAt(sel.x, sel.y);
  const head = (icon, title, sub) => h('div.row', {}, h('div', { style: { fontSize: '30px' } }, icon), h('div.grow', {}, h('b.gold', {}, title), h('div.muted', {}, sub)));
  const coords = `X:${sel.x} Y:${sel.y}${ter ? ` · [${ter.tag}] territory` : ''}`;
  let body = [];
  if (sel.kind === 'home') {
    body = [head('🏰', `${g.s.player.name}'s Bastion`, coords), h('div.muted', {}, `Power ${fmt(g.power())}${g.now() < g.s.shieldUntil ? ' · 🛡️ Shield active' : ''}`), h('div.row', { style: { marginTop: '8px' } }, h('button.btn.grow', { onclick: () => A.switchScreen('base') }, 'Enter Base'), h('button.btn.gray.grow', { onclick: () => openMarches() }, `Marches (${g.s.marches.length})`))];
  } else if (sel.kind === 'empty') {
    body = [head('🏜️', TERRAIN[sel.terrain] || 'Unknown', coords), h('div.muted', {}, `Area level ${Math.max(1, sel.lvl || 0) || ''}`.trim()), sel.terrain !== 3 && sel.terrain !== 5 ? h('button.btn.sm.gray', { style: { marginTop: '6px' }, onclick: () => { if ((g.s.items.relocate || 0) < 1) return toast('Need a Relocator (Shop)', 'bad'); g.s.items.relocate--; g.s.world.x = sel.x; g.s.world.y = sel.y; toast('Bastion relocated', 'good'); showTileInfo(null); } }, `🧭 Relocate here (${g.s.items.relocate || 0})`) : null];
  } else if (sel.kind === 'node') {
    const st = g.objectState(sel);
    body = [head(NODE_TYPES[sel.res].icon, `${NODE_TYPES[sel.res].name} Lv ${sel.lvl}`, coords), h('div.muted', {}, `${RES_INFO[sel.res].icon} ${fmt(st.amount)} remaining · travel ${fmtTime(g.travelSec(sel.x, sel.y))}`),
      h('div.row', { style: { marginTop: '8px' } }, h('button.btn.green.grow' + (st.occupied ? '.off' : ''), { onclick: () => openMarchDialog('gather', sel) }, st.occupied ? 'Occupied' : '⛏️ Gather'))];
  } else if (sel.remote) {
    body = [head('🏰', `${sel.tag ? '[' + sel.tag + '] ' : ''}${sel.name}`, coords), h('div.muted', {}, h('span.ontag', {}, 'REAL PLAYER'), ` HQ ${sel.hq} · Power ${fmt(sel.power || 0)}`),
      h('div.row', { style: { marginTop: '8px' } }, h('button.btn.red.grow', { onclick: () => remoteAttack(sel) }, '⚔️ Attack (server battle)'))];
  } else {
    const sq = targetSquads(sel), pow = sidePower(sq), my = g.attackPreview().power;
    const vc = g.vigorCost(sel);
    const name = labelOf(sel);
    const icon = sel.kind === 'zombie' ? '🧟' : sel.kind === 'camp' ? '⛺' : sel.kind === 'boss' ? '👹' : '🏰';
    const scouted = g.s.world.scouted[sel.id];
    body = [head(icon, `${name} Lv ${sel.lvl}${sel.ai ? ' (AI survivor)' : ''}`, coords),
      h('div.muted', {}, sel.kind === 'rival' ? (scouted ? `Scouted power ${fmt(pow)} · HQ ${sel.hq}` : `HQ ${sel.hq} · strength unknown — scout first`) : `Enemy power ${fmt(pow)} · your best ${fmt(my)}`, vc ? ` · ⚡${vc} vigor` : '', ` · ${fmtTime(g.travelSec(sel.x, sel.y))} away`),
      h('div.row', { style: { marginTop: '8px' } },
        h('button.btn.gray.grow', { onclick: () => { if (result(g.sendMarch('scout', sel.id), g, 'Scout dispatched')) showTileInfo(null); } }, '🦅 Scout', h('span.sub', {}, `🥫${fmt(200 * Math.max(1, sel.lvl))}`)),
        h('button.btn.red.grow', { onclick: () => openMarchDialog('attack', sel) }, sel.kind === 'rival' ? '⚔️ Raid' : '⚔️ Attack'))];
  }
  el.append(close, ...body);
}

export function openMarchDialog(kind, target) {
  const g = A.g;
  const avail = g.availableHeroes();
  const picked = new Set(g.s.formation.attack.map((f) => f.hero).filter((id) => avail.includes(id)));
  if (!picked.size) avail.slice(0, 3).forEach((id) => picked.add(id));
  const m = modal({ title: kind === 'gather' ? 'Send Gatherers' : 'Send Attack', icon: kind === 'gather' ? '⛏️' : '⚔️', render: () => {
    const ids = [...picked];
    const formation = g.autoFormation(ids);
    const { squads, used } = g.buildSquads(formation, g.s.troops);
    const pow = sidePower(squads);
    const enemy = kind === 'attack' ? sidePower(targetSquads(target)) : 0;
    let load = 0; if (kind === 'gather') load = g.marchLoad({ troops: used });
    return [
      h('div.card', {}, h('div.stat', {}, h('span', {}, 'Target'), h('b', {}, `${labelOf(target)} Lv ${target.lvl}`)), h('div.stat', {}, h('span', {}, 'Travel time'), h('b', {}, fmtTime(g.travelSec(target.x, target.y)))),
        h('div.stat', {}, h('span', {}, 'March power'), h('b.gold', {}, fmt(pow))), kind === 'attack' && !(target.kind === 'rival' && !g.s.world.scouted[target.id]) ? h('div.stat', {}, h('span', {}, 'Enemy power'), h('b.' + (pow >= enemy ? 'good' : 'bad'), {}, fmt(enemy))) : null,
        kind === 'gather' ? h('div.stat', {}, h('span', {}, 'Carry capacity'), h('b', {}, fmt(load))) : null,
        h('div.stat', {}, h('span', {}, 'Troops'), h('b', {}, fmt(Object.values(used).reduce((a, b) => a + b, 0)))),
        h('div.stat', {}, h('span', {}, 'March slots'), h('b', {}, `${g.s.marches.length} / ${g.marchSlots()}`))),
      h('div.sec', {}, `Choose heroes (${ids.length}/5)`),
      avail.length ? h('div.grid.sm', {}, ...avail.map((id) => h('div', { style: { position: 'relative', outline: picked.has(id) ? '3px solid #ffd27a' : 'none', borderRadius: '10px' } }, heroCard(id, { onclick: () => { if (picked.has(id)) picked.delete(id); else if (picked.size < 5) picked.add(id); m.refresh(); } }), picked.has(id) ? h('div', { style: { position: 'absolute', top: '2px', left: '50%', transform: 'translateX(-50%)', fontSize: '16px' } }, '✅') : null))) : h('p.bad', {}, 'All heroes are on marches.'),
      h('button.btn' + (kind === 'gather' ? '.green' : '.red') + (ids.length ? '' : '.off'), { style: { width: '100%', marginTop: '10px' }, onclick: () => { const r = g.sendMarch(kind, target.id, ids); if (result(r, g, `March departed (${fmtTime(r.travel || 0)})`)) { m.close(); showTileInfo(null); } } }, 'March!'),
    ];
  } });
}

export function openMarches() {
  const g = A.g;
  modal({ title: 'Marches', icon: '🚩', live: true, render: (m) => {
    if (!g.s.marches.length) return h('p.muted', {}, 'No active marches. Tap anything on the world map to send squads.');
    return g.s.marches.map((mm) => {
      const o = objectById(mm.target);
      const label = { attack: '⚔️ Attacking', gather: '⛏️ Gathering', scout: '🦅 Scouting' }[mm.kind];
      const state = mm.state === 'out' ? 'Marching' : mm.state === 'gather' ? 'Gathering' : 'Returning';
      const end = mm.state === 'gather' ? mm.gatherEnd : mm.arrive;
      return h('div.card', {}, h('div.row.sp', {}, h('b', {}, `${label} ${o ? labelOf(o) : ''}`), h('span.gold', { 'data-end': end }, fmtTime((end - g.now()) / 1000))),
        h('div.muted', {}, `${state} · ${mm.heroes.map((x) => HERO_BY_ID[x].name).join(', ') || 'Scout'} · ${fmt(Object.values(mm.troops).reduce((a, b) => a + b, 0))} troops`),
        mm.state === 'gather' ? h('div.muted', {}, `Gathered ${fmt(g.gatheredSoFar(mm))} / ${fmt(mm.capacity)} ${RES_INFO[mm.res].icon}`) : null,
        mm.loot && Object.keys(mm.loot).length ? rewardChips(mm.loot) : null,
        h('div.row', { style: { marginTop: '6px' } }, h('button.btn.sm.gray', { onclick: () => { A.switchScreen('world'); const p = g.marchPos(mm); A.views.world.goTo(Math.round(p.x), Math.round(p.y)); m.close(); } }, 'Locate'), mm.state !== 'return' ? h('button.btn.sm.red', { onclick: () => { g.recall(mm.id); m.refresh(); } }, 'Recall') : null));
    });
  } });
}

async function remoteAttack(sel) {
  const g = A.g;
  if (!A.net?.user) return toast('Log in to fight real players', 'bad');
  const { squads } = g.buildSquads(g.s.formation.attack, g.s.troops);
  if (!squads.length) return toast('Set your attack formation', 'bad');
  try {
    await A.net.pushSave();
    const r = await A.net.pvpAttack(sel.uid);
    if (!r.ok) return toast(r.msg || 'Attack failed', 'bad');
    if (r.loot) g.give(r.loot);
    if (r.losses) for (const [k, n] of Object.entries(r.losses)) g.s.troops[k] = Math.max(0, (g.s.troops[k] || 0) - n);
    if (r.win) g.track('raid', 1);
    g.addReport({ type: 'pvp', title: `${r.win ? 'Victory' : 'Defeat'} vs ${sel.name} (online)`, win: r.win, rewards: r.loot, a: r.a, b: r.b, seed: r.seed, summary: { a: r.result.a, b: r.result.b, turns: r.result.turns } });
    showTileInfo(null);
    openBattle({ a: r.a, b: r.b, result: r.result, title: `PvP vs ${sel.name}`, rewards: r.loot });
  } catch (e) { toast('Server unreachable: ' + e.message, 'bad'); }
}
