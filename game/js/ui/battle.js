import { h, fmt } from './dom.js';
import { A } from './app.js';
import { BattleView } from '../render/battleview.js';
import { rewardChips } from './dom.js';
import { simulateBattle, sidePower } from '../core/combat.js';
import { TROOP_TYPES } from '../data/troops.js';

let view = null, raf = 0;
// opts: { a, b, result, title, rewards, extra, onDone, win }
export function openBattle(opts) {
  const root = document.getElementById('battle');
  root.classList.remove('hidden'); root.replaceChildren();
  const canvas = h('canvas.view');
  const speedBtn = h('button.btn.sm.gray', { onclick: () => { view.speed = view.speed >= 4 ? 1 : view.speed * 2; speedBtn.textContent = 'x' + view.speed; } }, 'x1');
  const ui = h('div.bui', {}, h('div.coord', {}, '🔵 ', fmt(sidePower(opts.a))), h('b.gold', { style: { textShadow: '0 2px 4px #000' } }, opts.title || 'Battle'), h('div.coord', {}, '🔴 ', fmt(sidePower(opts.b))));
  const ctl = h('div.bctl', {}, speedBtn, h('button.btn.sm', { onclick: () => view.skip() }, 'Skip ⏭'));
  root.append(canvas, ui, ctl);
  view = new BattleView(canvas, A.sfx);
  view.resize(); view.load(opts.a, opts.b, opts.result);
  let last = performance.now(), shown = false;
  cancelAnimationFrame(raf);
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    view.render(now / 1000, dt);
    if (view.done && !shown) { shown = true; setTimeout(() => showResult(root, opts), 500); }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  window.addEventListener('resize', onResize);
}
function onResize() { view?.resize(); }
function close(opts) {
  cancelAnimationFrame(raf); window.removeEventListener('resize', onResize);
  document.getElementById('battle').classList.add('hidden'); document.getElementById('battle').replaceChildren();
  opts.onDone?.(); A.refreshAll();
}
function showResult(root, opts) {
  const r = opts.result, win = opts.win ?? r.winner === 'a';
  A.sfx(win ? 'success' : 'fail');
  const mvp = [...r.a].sort((x, y) => y.dealt + y.healed - x.dealt - x.healed)[0];
  const rows = (arr) => arr.map((s) => h('tr', {}, h('td', {}, s.name), h('td', {}, s.troopType ? TROOP_TYPES[s.troopType]?.icon : ''), h('td', {}, fmt(s.troops)), h('td.bad', {}, s.lost ? '-' + fmt(s.lost) : '0'), h('td', {}, fmt(s.dealt)), h('td.good', {}, s.healed ? fmt(s.healed) : '')));
  const box = h('div.box', {},
    h('h1.' + (win ? 'win' : 'lose'), {}, win ? 'VICTORY' : 'DEFEAT'),
    h('div.muted', {}, `${r.turns} rounds`),
    mvp && mvp.dealt ? h('div', { style: { margin: '8px 0' } }, '🏅 MVP: ', h('b.gold', {}, mvp.name), ` — ${fmt(mvp.dealt)} damage`) : null,
    opts.extra ? h('div', { style: { margin: '6px 0' } }, opts.extra) : null,
    opts.rewards && Object.keys(opts.rewards).length ? [h('div.sec', {}, 'Rewards'), h('div.row.c', {}, rewardChips(opts.rewards))] : null,
    h('div.sec', {}, 'Your squads'), h('table.tbl', {}, h('tr', {}, ...['Squad', '', 'Troops', 'Lost', 'Damage', 'Heal'].map((x) => h('th', {}, x))), rows(r.a)),
    h('div.sec', {}, 'Enemy'), h('table.tbl', {}, h('tr', {}, ...['Squad', '', 'Troops', 'Lost', 'Damage', 'Heal'].map((x) => h('th', {}, x))), rows(r.b)),
    !win ? h('p.muted', {}, 'Tips: train higher-tier troops, level & star up heroes, put tanks in front, research Military tech, and use troop counters (Infantry › Vehicles › Ranged › Infantry).') : null,
    h('div.row', { style: { marginTop: '12px' } }, h('button.btn.gray.grow', { onclick: () => { root.querySelector('.bres')?.remove(); view.load(opts.a, opts.b, opts.result); setTimeout(() => watchEnd(root, opts), 50); } }, '↻ Replay'), h('button.btn.grow', { onclick: () => close(opts) }, 'Continue')));
  root.append(h('div.bres', {}, box));
}
function watchEnd(root, opts) { const iv = setInterval(() => { if (view.done) { clearInterval(iv); setTimeout(() => showResult(root, opts), 500); } }, 200); }
// Replay a stored report deterministically
export function replayReport(rep) {
  if (!rep.a || !rep.b) return;
  const result = simulateBattle(rep.a, rep.b, { seed: rep.seed, maxTurns: rep.maxTurns });
  openBattle({ a: rep.a, b: rep.b, result, title: rep.title, rewards: rep.rewards, win: rep.defender ? result.winner === 'b' : undefined });
}
