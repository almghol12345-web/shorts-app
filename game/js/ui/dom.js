// Tiny DOM toolkit: element builder, modals, toasts, formatters, live timers.
import { RES_INFO, RESOURCES } from '../data/config.js';
import { ITEMS } from '../data/items.js';
import { sfx } from '../audio.js';
import { haptic } from '../platform.js';
import { tr, L } from '../i18n.js';

export function h(tag, attrs = {}, ...kids) {
  const [t, ...cls] = tag.split('.');
  const el = document.createElement(t || 'div');
  // allow h('div', child, child...) — attrs may be omitted
  if (attrs != null && (attrs.nodeType || typeof attrs !== 'object' || Array.isArray(attrs))) { kids.unshift(attrs); attrs = {}; }
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), (e) => { if (k === 'onclick') { sfx('click'); haptic('light'); } v(e); });
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'class') el.className += ' ' + v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'placeholder' || k === 'title' || k === 'aria-label') el.setAttribute(k, tr(String(v)));
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(typeof k === 'string' ? tr(k) : String(k)));
  return el;
}
export function fmt(n) {
  n = Math.floor(n || 0);
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString('en-US');
}
export function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const d = Math.floor(sec / 86400), hh = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = (x) => String(x).padStart(2, '0');
  return d ? `${d}d ${p(hh)}:${p(m)}:${p(s)}` : `${p(hh)}:${p(m)}:${p(s)}`;
}
export function ago(t, now = Date.now()) { const s = Math.floor((now - t) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + 'm ago' : s < 86400 ? Math.floor(s / 3600) + 'h ago' : Math.floor(s / 86400) + 'd ago'; }

// Cost display with have/need colouring
export function costRow(cost, g) {
  return h('div.costs', ...Object.entries(cost).filter(([, v]) => v > 0).map(([k, v]) => {
    const have = RESOURCES.includes(k) ? g.s.res[k] : k === 'gems' ? g.s.gems : (g.s.items[k] || 0);
    const icon = RES_INFO[k]?.icon || ITEMS[k]?.icon || '•';
    return h('span.cost' + (have >= v ? '' : '.short'), {}, icon, ' ', fmt(v));
  }));
}
export function rewardChips(bundle) {
  return h('div.rewards', ...Object.entries(bundle || {}).filter(([, v]) => v).map(([k, v]) => {
    if (k === 'gear') return h('span.chip', {}, '🛡️ ', v);
    const icon = RES_INFO[k]?.icon || ITEMS[k]?.icon || (k === 'xp' ? '⭐' : k === 'heroXp' ? '📗' : k === 'vip' ? '👑' : '🎁');
    const name = ITEMS[k]?.name || RES_INFO[k]?.name || (k === 'xp' ? 'Commander XP' : k === 'heroXp' ? 'Hero XP' : k);
    return h('span.chip', { title: name }, icon, ' ', typeof v === 'number' ? fmt(v) : v);
  }));
}

// ---------- modals ----------
const stack = [];
export function modal({ title, render, cls = '', onClose, live = false, tabs = null, tab = 0, icon = '' }) {
  const root = document.getElementById('modals');
  const body = h('div.mbody');
  const tabBar = tabs ? h('div.tabs') : null;
  const m = { tab, live, render, body, close: () => close(m), refresh: () => {
    const st = body.scrollTop; body.replaceChildren(); const out = render(m); if (out) body.append(...[out].flat(Infinity).filter((x) => x != null && x !== false).map((x) => (x.nodeType ? x : document.createTextNode(tr(String(x)))))); body.scrollTop = st;
    if (tabBar) [...tabBar.children].forEach((b, i) => b.classList.toggle('on', i === m.tab));
  } };
  if (tabs) tabs.forEach((t, i) => tabBar.append(h('button.tab', { onclick: () => { m.tab = i; body.scrollTop = 0; m.refresh(); } }, t)));
  const titleEl = h('div.mtitle', {}, h('span.micon', {}, icon), h('span', {}, title), h('button.x', { onclick: () => close(m), 'aria-label': 'Close' }, '✕'));
  m.el = h('div.modal ' + cls, { onclick: (e) => { if (e.target === m.el) close(m); } }, h('div.panel', {}, titleEl, tabBar, body));
  m.setTitle = (t) => { titleEl.children[1].textContent = tr(t); };
  m.onClose = onClose;
  root.append(m.el); stack.push(m); m.refresh(); sfx('open');
  requestAnimationFrame(() => m.el.classList.add('show'));
  return m;
}
function close(m) {
  const i = stack.indexOf(m); if (i < 0) return;
  stack.splice(i, 1); m.el.classList.remove('show'); setTimeout(() => m.el.remove(), 180); sfx('close'); m.onClose?.();
}
export function closeAll() { [...stack].forEach(close); }
export function topModal() { return stack[stack.length - 1]; }
export function refreshAll() { for (const m of stack) m.refresh(); }
export function refreshLive() { for (const m of stack) if (m.live) m.refresh(); }
export function modalOpen() { return stack.length > 0; }

export function toast(msg, kind = 'info') {
  const el = h('div.toast.' + kind, {}, msg);
  document.getElementById('toasts').append(el);
  setTimeout(() => el.classList.add('out'), 2600); setTimeout(() => el.remove(), 3100);
}
export function confirmBox(text, yes, { yesLabel = 'Confirm', cls = '' } = {}) {
  const m = modal({ title: 'Confirm', cls: 'small', render: () => h('div.confirm', {}, h('p', {}, text), h('div.row', {}, h('button.btn.gray', { onclick: () => m.close() }, 'Cancel'), h('button.btn ' + cls, { onclick: () => { m.close(); yes(); } }, yesLabel))) });
}
export function result(r, g, okMsg) {
  if (!r) return false;
  if (r.ok) { if (okMsg) toast(okMsg, 'good'); sfx('success'); haptic('success'); return true; }
  if (r.msg) toast(r.msg, 'bad'); sfx('fail'); haptic('error'); return false;
}
export function progress(start, end, cls = '') {
  return h('div.prog ' + cls, { 'data-ps': start, 'data-pe': end }, h('div.fill'), h('span.ptxt', { 'data-end': end }, ''));
}
// Update every [data-end] countdown and [data-ps] bar
export function tickTimers(now) {
  document.querySelectorAll('[data-end]').forEach((el) => { el.textContent = fmtTime((+el.dataset.end - now) / 1000); });
  document.querySelectorAll('[data-ps]').forEach((el) => { const s = +el.dataset.ps, e = +el.dataset.pe; const f = Math.min(1, Math.max(0, (now - s) / Math.max(1, e - s))); el.firstChild.style.width = (f * 100).toFixed(1) + '%'; });
}
export function stars(n, max = 5) { return h('span.stars', {}, '★'.repeat(n), h('span.dim', {}, '★'.repeat(max - n))); }
