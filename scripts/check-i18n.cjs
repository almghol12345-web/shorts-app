// Fails if a translation key is used in code but missing in Arabic or English, or if the two languages differ.
const fs = require('fs'); const path = require('path');
const dir = 'src/js'; const src = fs.readdirSync(dir).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const strSrc = fs.readFileSync(path.join(dir, '01b-strings.js'), 'utf8');
const STR = new Function(strSrc + '\nreturn STR;')();
const used = new Set([...src.matchAll(/\bt\('([a-zA-Z0-9_]+)'/g)].map(m => m[1]));
const dyn = {
  tab_: ['base', 'heroes', 'campaign', 'world', 'alliance'], d_: ['collect', 'win', 'build', 'train', 'recruit', 'gather', 'research', 'spin'],
  g_: ['free', 'ticket', 'ticket10', 'sp5', 'sp60', 'stam', 'spin', 'food', 'wood', 'iron', 'fuel', 'exp'], shop_: ['gems', 'offers', 'items'], tag_: ['popular', 'best'],
  ach_: ['kills', 'stage', 'heroes', 'power', 'sieges', 'recruits', 'gathered', 'hq', 'boss'], evt_: ['double', 'production', 'discount', 'gift', 'kills'], evh_: ['double', 'production', 'discount', 'gift', 'kills'],
  adm_: ['dash', 'players', 'gifts', 'events', 'news', 'config', 'buys'], k_: ['players_total', 'active_24h', 'new_today', 'banned_n', 'buys_total', 'buys_today', 'revenue_total', 'revenue_today'],
  tier: ['0', '1', '2', '3', '4'], sk_: ['snipe', 'shield', 'heal', 'air', 'aoe', 'stun', 'rapid', 'buff'],
};
for (const p in dyn) { used.delete(p); dyn[p].forEach(s => used.add(p + s)); }
['base', 'heroes', 'battle', 'world', 'def', 'pass', 'ally'].forEach(k => { used.add('tut_' + k + '_t'); used.add('tut_' + k + '_b'); });
const miss = []; for (const k of used) for (const l of ['ar', 'en']) if (STR[l][k] == null) miss.push(l + ':' + k);
const onlyAr = Object.keys(STR.ar).filter(k => !(k in STR.en)), onlyEn = Object.keys(STR.en).filter(k => !(k in STR.ar));
const ph = []; for (const k in STR.ar) if (k in STR.en) { const a = (STR.ar[k].match(/\{\d\}/g) || []).sort().join(), b = (STR.en[k].match(/\{\d\}/g) || []).sort().join(); if (a !== b) ph.push(k); }
console.log('keys used:', used.size, '· ar:', Object.keys(STR.ar).length, '· en:', Object.keys(STR.en).length);
if (miss.length || onlyAr.length || onlyEn.length || ph.length) { console.log({ miss, onlyAr, onlyEn, placeholderMismatch: ph }); process.exit(1); }
console.log('i18n OK');
