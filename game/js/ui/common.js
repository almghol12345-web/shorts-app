import { L, t as T, tr } from '../i18n.js';
import { h, fmt, fmtTime, costRow, modal, result, progress, toast } from './dom.js';
import { A } from './app.js';
import { drawBuilding } from '../render/art.js';
import { ITEMS } from '../data/items.js';
import { gemsForSeconds, gemsForResources, RES_INFO } from '../data/config.js';
import { BUILDINGS } from '../data/buildings.js';

export function buildingArt(type, lvl, w = 220, hgt = 200) {
  const c = h('canvas', { width: w * 2, height: hgt * 2, style: { width: '100%', height: '100%' } });
  const ctx = c.getContext('2d'); ctx.scale(2, 2);
  const scale = type === 'hq' ? 0.95 : 1.3; ctx.translate(w / 2, hgt * 0.72); ctx.scale(scale, scale);
  drawBuilding(ctx, type, lvl, 0, 0, 1.3, false);
  return c;
}
export function heroImg(id, size = 128) { return h('img', { src: A.portrait(id, size), alt: '' }); }

// Timer dialog: progress, speedup items, finish with gems, alliance help
export function openTimer(kind, key, label) {
  const g = A.g;
  const m = modal({ title: label || 'Speed Up', cls: 'small', icon: '⏱️', live: true, render: () => {
    const q = g.queueRef(kind, key);
    if (!q) { setTimeout(() => m.close(), 10); return h('p', {}, 'Done!'); }
    const rem = g.remaining(q), gems = gemsForSeconds(rem);
    const items = ['speed5m', 'speed1h', 'speed8h'].filter((i) => g.s.items[i] > 0);
    return [
      progress(q.start, q.end),
      h('div.row.sp', { style: { margin: '8px 0' } }, h('span.muted', {}, 'Remaining'), h('b.gold', { 'data-end': q.end }, fmtTime(rem))),
      items.length ? h('div.sec', {}, 'Use speedups') : h('p.muted', {}, 'No speedup items. Earn them from missions, events and the shop.'),
      ...items.map((i) => h('div.li', {}, h('span.ic', {}, ITEMS[i].icon), h('div.grow', {}, h('b', {}, ITEMS[i].name), h('div.muted', {}, L`Owned: ${g.s.items[i]}`)), h('button.btn.sm.blue', { onclick: () => { result(g.speedup(kind, key, i)); m.refresh(); A.refreshHud(); } }, 'Use'))),
      h('div.row', { style: { marginTop: '10px' } },
        g.s.alliance ? h('button.btn.green.grow' + (q.help ? '.off' : ''), { onclick: () => { if (result(g.requestHelp(kind, key), g, 'Help requested')) m.refresh(); } }, q.help ? L`Helps ${q.helps || 0}/${q.helpCap || 0}` : '🤝 Ask Help') : null,
        h('button.btn.grow', { onclick: () => { if (result(g.finishNow(kind, key))) { m.close(); A.refreshHud(); } } }, gems ? L`Finish 💎${gems}` : 'Finish FREE')),
    ];
  } });
  return m;
}

// Standard "cost + Upgrade / Instant" block used by buildings, research and training
export function actionBlock({ cost, time, ok, reason, gemCost, onStart, onInstant, label = 'Upgrade', extra }) {
  const g = A.g;
  const missing = g.missing(cost);
  const short = Object.keys(missing).length > 0;
  return h('div.card', {},
    h('div.sec', {}, 'Requirements'),
    costRow(cost, g),
    h('div.row.sp', { style: { margin: '8px 0 4px' } }, h('span.muted', {}, '⏱️ Time'), h('b', {}, fmtTime(time))),
    extra || null,
    !ok && reason ? h('p.bad', { style: { margin: '6px 0' } }, '⚠️ ', reason) : null,
    h('div.row', { style: { marginTop: '8px' } },
      h('button.btn.blue.grow' + (ok ? '' : '.off'), { onclick: onInstant }, '⚡ Instant', h('span.sub', {}, L`💎 ${gemCost ?? '-'}`)),
      h('button.btn.grow' + (ok && !short ? '' : '.off'), { onclick: onStart }, label, h('span.sub', {}, short ? 'Need resources' : fmtTime(time)))),
    short && ok ? h('div.row', { style: { marginTop: '8px' } }, h('button.btn.gray.sm.grow', { onclick: () => buyMissing(missing) }, L`Buy missing resources for 💎${gemsForResources(missing)}`)) : null,
  );
}
export function buyMissing(missing) {
  const g = A.g, cost = gemsForResources(missing);
  if (g.s.gems < cost) return toast('Not enough gems', 'bad');
  g.s.gems -= cost; g.track('gems', cost);
  for (const [k, v] of Object.entries(missing)) g.s.res[k] += v;
  toast('Resources purchased', 'good'); A.refreshAll();
}
export function statTable(now, next) {
  return h('div', {}, ...Object.keys(now).map((k) => h('div.stat', {}, h('span', {}, k), h('span.ltr', {}, h('b', {}, typeof now[k] === 'number' ? fmt(now[k]) : now[k]), next && next[k] !== undefined && next[k] !== now[k] ? h('span.nx', {}, ' → ' + (typeof next[k] === 'number' ? fmt(next[k]) : next[k])) : null))));
}
export function resIcon(r) { return RES_INFO[r]?.icon || ''; }
export function bName(t) { return BUILDINGS[t]?.name || t; }
