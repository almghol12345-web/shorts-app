// Bilingual support (English / Arabic). English text is the key; js/i18n/ar.js maps it to Arabic.
//  t('Upgrade')                       → translated string
//  t('Lv {n}', { n: 5 })              → with named placeholders
//  L`Level ${a} / ${b}`               → template literal; key is 'Level {0} / {1}', and string values
//                                       that are themselves keys (e.g. building names) get translated too
//  tr(text)                           → exact-match translation that keeps surrounding whitespace
// Pure module (no DOM) so the game core and the server can use it.
import { AR } from './i18n/ar.js';

const DICTS = { ar: AR };
let lang = 'en';
export const LANGS = { en: 'English', ar: 'العربية' };
export function setLang(l) { lang = l === 'ar' ? 'ar' : 'en'; }
export function getLang() { return lang; }
export function isRTL() { return lang === 'ar'; }
const dict = () => (lang === 'en' ? null : DICTS[lang]);

export function t(s, vars) {
  const d = dict();
  let out = (d && d[s]) || s;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? tr(String(vars[k])) : m));
  return out;
}
export function tr(s) {
  const d = dict(); if (!d || typeof s !== 'string') return s;
  if (d[s]) return d[s];
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
  return m && m[2] && d[m[2]] ? m[1] + d[m[2]] + m[3] : s;
}
export function L(strings, ...vals) {
  const d = dict();
  if (!d) return strings.reduce((a, s, i) => a + s + (i < vals.length ? vals[i] : ''), '');
  const key = strings.reduce((a, s, i) => a + s + (i < vals.length ? `{${i}}` : ''), '');
  const tpl = d[key] || d[key.trim()];
  const v = vals.map((x) => (typeof x === 'string' ? tr(x) : x));
  if (tpl) return tpl.replace(/\{(\d+)\}/g, (_, i) => v[+i]);
  return strings.reduce((a, s, i) => a + tr(s) + (i < v.length ? v[i] : ''), '');
}
