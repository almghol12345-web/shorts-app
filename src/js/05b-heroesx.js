/* ================= heroes added by the admin after release =================
 * The admin panel saves a hero (names, rarity, class, skill, a look based on an existing hero, a picture and
 * an optional 3D model) to the server. Every player's game downloads it, keeps a copy on the phone, and adds it
 * to the hero list and the summon pool, so new heroes arrive without an App Store update.
 * While its banner runs, the new hero has a higher chance in summons and is announced once.
 */
const HX_KEY = 'fajr-heroes-x-v1';
const HX = { list: [], loaded: {} };
const HX_SKILLS = ['snipe', 'shield', 'heal', 'aoe', 'stun', 'rapid', 'buff', 'air'];
/* main colored parts of each base model, recolored with the hero's own color */
const HX_MAIN = { knight: [3, 8], rogue: [8, 6], rogue_hooded: [9, 8], barbarian: [10, 8], mage: [8, 4] };
function hxDef(row) {
  const d = row.data || {}, tpl = HB[d.tpl] && !HB[d.tpl].x ? d.tpl : 'knight';
  return { id: row.id, x: 1, tpl, n: d.n || { ar: row.id, en: row.id }, r: clamp(d.r | 0 || 2, 1, 3), c: ['tank', 'atk', 'sup'].includes(d.c) ? d.c : HB[tpl].c, sk: HX_SKILLS.includes(d.sk) ? d.sk : HB[tpl].sk, skn: d.skn || HB[tpl].skn, q: d.q || { ar: '', en: '' }, role: d.role || HB[tpl].role, col: d.col || '', portrait: row.portrait || '', model: row.model || '', banner: row.banner_until ? Date.parse(row.banner_until) : 0 };
}
function hxRegister(rows) {
  for (const row of rows || []) {
    if (!row || !row.id || (HB[row.id] && !HB[row.id].x)) continue; // never replace a built-in hero
    const h = hxDef(row), old = HB[row.id];
    if (old) Object.assign(old, h); else { HEROES.push(h); HB[h.id] = h; }
    // look: copy the template hero, painted in the new color
    const base = KKH[h.tpl]; if (base) { const look = Object.assign({}, base, { rec: Object.assign({}, base.rec) }); if (/^#[0-9a-f]{6}$/i.test(h.col)) for (const k of HX_MAIN[base.base] || []) look.rec[k] = h.col; KKH[h.id] = look; }
    HERO3[h.id] = HERO3[h.tpl]; if (typeof B3_PROJ !== 'undefined') B3_PROJ[h.id] = B3_PROJ[h.tpl];
    if (h.portrait) { PORTRAIT[h.id] = h.portrait; delete PORTRAIT_IMG[h.id]; } else PORTRAIT[h.id] = portraitURI(h.tpl);
    if (h.model && !HX.loaded[h.id] && typeof THREE !== 'undefined' && THREE.GLTFLoader) {
      HX.loaded[h.id] = 1;
      new THREE.GLTFLoader().load(h.model, g => { KK.custom['h_' + h.id] = g; KK.gltf['h_' + h.id] = g; hxRefresh3D(h.id); }, undefined, e => console.warn('hero model ' + h.id, e));
    }
  }
  // heroes the admin switched off disappear from new summons but stay with players who own them
  HX.list = HEROES.filter(h => h.x);
}
function hxRefresh3D(id) { if (typeof V3 !== 'undefined' && V3.inited && V3.heroUnits && V3.heroUnits[id]) { V3.scene.remove(V3.heroUnits[id]); V3.units = V3.units.filter(u => u.s !== V3.heroUnits[id]); delete V3.heroUnits[id]; v3SyncHeroes(); } }
function hxBoot() { try { hxRegister(JSON.parse(storeGet(HX_KEY) || '[]')); } catch (e) { } }
async function fetchHeroesX() {
  const rows = await http('/rest/v1/heroes_extra?select=id,data,portrait,model,banner_until,active&active=eq.true&order=created_at.asc');
  if (!Array.isArray(rows)) return;
  storeSet(HX_KEY, JSON.stringify(rows)); hxRegister(rows);
  const live = new Set(rows.map(r => r.id)); HX.off = HX.list.filter(h => !live.has(h.id)).map(h => h.id);
  hxAnnounce();
}
/* heroes in the summon pool: built-in ones plus active added ones */
const hxPool = () => HEROES.filter(h => !h.x || !(HX.off || []).includes(h.id));
const hxBanner = () => HX.list.filter(h => h.banner > now() && !(HX.off || []).includes(h.id)).sort((a, b) => a.banner - b.banner)[0] || null;
function hxAnnounce() {
  const b = hxBanner(); if (!b) return; S.hxSeen = S.hxSeen || []; if (S.hxSeen.includes(b.id)) return;
  S.hxSeen.push(b.id); save();
  queuePopup(() => sheet('🌟', t('hx_new'), L(b.n), `<div class="hxpop"><img src="${portraitURI(b.id)}" alt=""><div><b style="color:${RAR[b.r].c}">${L(RAR[b.r].n)} · ${esc(L(b.role))}</b><p class="muted sm">${esc(L(b.q))}</p><p class="sm">⏳ ${t('hx_until', fmtT((b.banner - now()) / 1000))}</p></div></div><button class="btn gold wide" data-a="openRecruit">🎟️ ${t('hx_go')}</button>`));
}
