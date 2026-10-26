/* ================= utils ================= */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const now = () => Date.now();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function fmt(n) {
  n = Math.floor(n || 0); const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return n.toLocaleString('en-US');
}
const pick = a => a[Math.floor(Math.random() * a.length)];
function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const today = () => new Date().toDateString();
function hash(x, y) { let h = x * 374761393 + y * 668265263; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; }
function weighted(list) { const tot = list.reduce((a, x) => a + x.w, 0); let r = Math.random() * tot; for (const x of list) { r -= x.w; if (r <= 0) return x; } return list[list.length - 1]; }
const dayNum = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 864e5);
const lerp = (a, b, t) => a + (b - a) * t;
function storeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function storeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
function storeDel(k) { try { localStorage.removeItem(k); } catch (e) { } }
/* Capacitor native plugins (only inside the iOS app) */
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const _plug = {};
function plugin(name) {
  if (!NATIVE) return null;
  try {
    if (!(name in _plug)) { const reg = (window.capacitorExports && window.capacitorExports.registerPlugin) || (window.Capacitor && window.Capacitor.registerPlugin); _plug[name] = reg ? reg(name) : null; }
    return _plug[name];
  } catch (e) { return null; }
}
