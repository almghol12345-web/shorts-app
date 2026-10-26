/* ================= i18n ================= */
let LANG = 'ar';
const L = o => o == null ? '' : typeof o === 'string' ? o : (o[LANG] != null ? o[LANG] : (o.ar != null ? o.ar : (o.en || '')));
function t(k, ...a) {
  let s = STR[LANG] && STR[LANG][k];
  if (s == null) s = STR.ar[k];
  if (s == null) { if (!t.miss.has(k)) { t.miss.add(k); console.warn('i18n missing: ' + k); } return k; }
  return a.length ? s.replace(/\{(\d)\}/g, (m, i) => a[i] == null ? '' : a[i]) : s;
}
t.miss = new Set();
function setLang(l) {
  LANG = l === 'en' ? 'en' : 'ar';
  document.documentElement.lang = LANG;
  document.documentElement.dir = LANG === 'ar' ? 'rtl' : 'ltr';
}
const isRTL = () => LANG === 'ar';
function fmtT(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60, p = x => String(x).padStart(2, '0');
  if (d) return `${d}${t('u_d')} ${h}${t('u_h')}`;
  if (h) return `${h}:${p(m)}:${p(s)}`;
  return `${m}:${p(s)}`;
}
function guessLang() { const n = (navigator.language || 'ar').toLowerCase(); return n.startsWith('ar') ? 'ar' : 'en'; }
