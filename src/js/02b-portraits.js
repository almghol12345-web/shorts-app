/* ================= hero portraits: layered SVG soldiers drawn in code =================
 * Each hero has a spec (skin, hair, headgear, face gear, vest, weapon...). portraitSVG(spec)
 * builds a 100x100 bust. Images are cached as data URIs for <img> tags and canvas drawing.
 */
const SKIN = { a: ['#f1c9a5', '#d9a37f'], b: ['#d8a578', '#b98358'], c: ['#b57b4f', '#94603a'], d: ['#8a5a3a', '#6d4429'], e: ['#5e3b26', '#48291a'] };
const RAR_BG = [null, ['#2b4a6e', '#101a26'], ['#4b2f6e', '#170f24'], ['#7a5420', '#24170a']];
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255; r = clamp(Math.round(r * f), 0, 255); g = clamp(Math.round(g * f), 0, 255); b = clamp(Math.round(b * f), 0, 255); return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1); }
function portraitSVG(p, rar) {
  const [sk, skd] = SKIN[p.skin || 'b'], hair = p.hair || '#2a1d14', vest = p.vest || '#4a5a3a', vd = shade(vest, .7), vl = shade(vest, 1.25), [bg1, bg2] = RAR_BG[rar || 1];
  const fem = !!p.fem, eye = p.eye || '#3b2a1c', gear = p.gear || '#2d3236', gd = shade(gear, .7), gl = shade(gear, 1.35), acc = p.acc || '#cf6a2c';
  let s = `<defs><radialGradient id="bg" cx=".5" cy=".38" r=".75"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></radialGradient>
  <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${vl}"/><stop offset="1" stop-color="${vd}"/></linearGradient>
  <linearGradient id="fg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${skd}"/><stop offset=".35" stop-color="${sk}"/><stop offset=".7" stop-color="${sk}"/><stop offset="1" stop-color="${skd}"/></linearGradient>
  <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${gl}"/><stop offset="1" stop-color="${gd}"/></linearGradient>
  <clipPath id="cl"><rect width="100" height="100"/></clipPath></defs><g clip-path="url(#cl)">
  <rect width="100" height="100" fill="url(#bg)"/>
  <g opacity=".18" fill="#fff"><circle cx="18" cy="22" r="9"/><circle cx="84" cy="30" r="12"/><circle cx="72" cy="12" r="6"/></g>
  <path d="M0 78 L14 70 L22 74 L30 64 L40 70 L52 60 L62 68 L74 58 L86 66 L100 60 L100 100 L0 100Z" fill="#000" opacity=".35"/>`;
  // weapon behind the shoulder
  const w = p.weapon;
  if (w === 'rifle') s += `<g transform="rotate(-35 78 70)"><rect x="60" y="66" width="46" height="6" rx="1.5" fill="#1b1d1f"/><rect x="70" y="72" width="5" height="10" fill="#1b1d1f"/><rect x="82" y="72" width="4" height="8" fill="#1b1d1f"/><rect x="64" y="62" width="12" height="4" fill="#2a2d30"/></g>`;
  if (w === 'sniper') s += `<g transform="rotate(-40 76 72)"><rect x="52" y="68" width="62" height="4" rx="1" fill="#1b1d1f"/><rect x="66" y="62" width="16" height="5" rx="2.5" fill="#2a2d30"/><circle cx="82" cy="64.5" r="2.5" fill="#5aa6d6" opacity=".7"/><rect x="58" y="72" width="10" height="6" fill="#3a2a1c"/></g>`;
  if (w === 'launcher') s += `<g transform="rotate(-30 76 70)"><rect x="56" y="62" width="50" height="11" rx="5" fill="#3b4a2a"/><rect x="52" y="60" width="8" height="15" rx="2" fill="#1b1d1f"/><rect x="72" y="73" width="5" height="8" fill="#1b1d1f"/></g>`;
  if (w === 'smg') s += `<g transform="rotate(-25 74 74)"><rect x="62" y="70" width="32" height="7" rx="2" fill="#1b1d1f"/><rect x="72" y="77" width="4" height="10" fill="#1b1d1f"/><rect x="92" y="72" width="8" height="3" fill="#1b1d1f"/></g>`;
  if (w === 'shield') s += `<path d="M70 60 L98 64 L96 100 L72 100Z" fill="#1d2b36"/><path d="M73 64 L95 67 L93 98 L75 98Z" fill="#2f4558"/><rect x="76" y="70" width="16" height="3" fill="#5aa6d6" opacity=".6"/><rect x="78" y="80" width="12" height="2" fill="#cfd8de" opacity=".5"/><rect x="78" y="84" width="12" height="2" fill="#cfd8de" opacity=".5"/>`;
  if (w === 'antenna') s += `<rect x="72" y="20" width="1.6" height="52" fill="#1b1d1f"/><circle cx="72.8" cy="20" r="2" fill="${acc}"/><rect x="64" y="66" width="20" height="16" rx="2" fill="#2a2d30"/>`;
  if (w === 'medic') s += `<rect x="66" y="62" width="26" height="22" rx="4" fill="#e8e2d6"/><rect x="76" y="65" width="6" height="16" fill="#c9302c"/><rect x="71" y="70" width="16" height="6" fill="#c9302c"/>`;
  // long hair falls behind the head
  if (fem && p.hairStyle === 'long') s += `<path d="M33 40 Q30 64 36 76 L64 76 Q70 64 67 40 Q66 22 50 22 Q34 22 33 40Z" fill="${hair}"/>`;
  // shoulders, shirt and plate carrier
  s += `<path d="M4 100 C6 80 22 70 50 69 C78 70 94 80 96 100Z" fill="${shade(vest, .85)}"/>
  <path d="M4 100 C6 84 14 76 26 73 L30 100Z M96 100 C94 84 86 76 74 73 L70 100Z" fill="${p.sleeve || shade(vest, 1.05)}"/>`;
  if (p.camo) s += `<g opacity=".45" fill="${shade(vest, .55)}"><ellipse cx="14" cy="88" rx="5" ry="3"/><ellipse cx="22" cy="80" rx="4" ry="2.5"/><ellipse cx="84" cy="86" rx="5" ry="3"/><ellipse cx="78" cy="94" rx="4" ry="2"/><ellipse cx="90" cy="95" rx="3" ry="2"/><ellipse cx="9" cy="96" rx="3" ry="2"/></g>`;
  s += `<path d="M27 100 L29 75 Q50 84 71 75 L73 100Z" fill="url(#vg)"/>
  <path d="M29 75 L36 70 M71 75 L64 70" stroke="${vd}" stroke-width="4" stroke-linecap="round"/>
  <rect x="31" y="85" width="10" height="11" rx="1.5" fill="${vd}"/><rect x="45" y="86" width="10" height="11" rx="1.5" fill="${vd}"/><rect x="59" y="85" width="10" height="11" rx="1.5" fill="${vd}"/>
  <rect x="31" y="85" width="10" height="3" fill="${vl}" opacity=".6"/><rect x="45" y="86" width="10" height="3" fill="${vl}" opacity=".6"/><rect x="59" y="85" width="10" height="3" fill="${vl}" opacity=".6"/>
  <rect x="58" y="77" width="9" height="6" rx="1" fill="${acc}"/><rect x="33" y="78" width="9" height="5" rx="1" fill="#0d1114" opacity=".7"/>`;
  if (p.patch === 'flag') s += `<rect x="33.5" y="78.5" width="8" height="4" fill="#3b6e3b"/><rect x="33.5" y="79.8" width="8" height="1.4" fill="#e8e2d6"/>`;
  if (p.patch === 'cross') s += `<rect x="33.5" y="78.5" width="8" height="4" fill="#e8e2d6"/><rect x="36.6" y="78.5" width="1.8" height="4" fill="#c9302c"/><rect x="33.5" y="79.7" width="8" height="1.6" fill="#c9302c"/>`;
  if (p.scarfNeck) s += `<path d="M36 66 Q50 76 64 66 L66 72 Q50 82 34 72Z" fill="${p.scarfNeck}"/>`;
  // neck & head
  s += `<path d="M43 56 L43 70 Q50 74 57 70 L57 56Z" fill="${skd}"/>
  <ellipse cx="35.5" cy="44" rx="3" ry="4.5" fill="${skd}"/><ellipse cx="64.5" cy="44" rx="3" ry="4.5" fill="${skd}"/>
  <path d="M35 40 Q35 23 50 23 Q65 23 65 40 Q65 54 58 60 Q50 65 42 60 Q35 54 35 40Z" fill="url(#fg)"/>`;
  if (fem) s += `<path d="M38 52 Q42 61 50 63 Q58 61 62 52" fill="none" stroke="${skd}" stroke-width=".6" opacity=".6"/>`;
  else s += `<path d="M37 50 Q40 60 50 63 Q60 60 63 50" fill="none" stroke="${skd}" stroke-width="1" opacity=".5"/>`;
  // eyes, brows, nose, mouth
  const ey = 42;
  if (!p.balaclava || true) {
    s += `<ellipse cx="44" cy="${ey}" rx="3" ry="${fem ? 2.1 : 1.7}" fill="#f4efe6"/><ellipse cx="56" cy="${ey}" rx="3" ry="${fem ? 2.1 : 1.7}" fill="#f4efe6"/>
    <circle cx="44.3" cy="${ey}" r="1.5" fill="${eye}"/><circle cx="56.3" cy="${ey}" r="1.5" fill="${eye}"/><circle cx="44.8" cy="${ey - .5}" r=".45" fill="#fff"/><circle cx="56.8" cy="${ey - .5}" r=".45" fill="#fff"/>
    <path d="M40 ${ey - 4.2} Q44 ${ey - (fem ? 6.2 : 5.4)} 48 ${ey - 4}" stroke="${shade(hair, .9)}" stroke-width="${fem ? 1 : 1.6}" fill="none" stroke-linecap="round"/><path d="M52 ${ey - 4} Q56 ${ey - (fem ? 6.2 : 5.4)} 60 ${ey - 4.2}" stroke="${shade(hair, .9)}" stroke-width="${fem ? 1 : 1.6}" fill="none" stroke-linecap="round"/>`;
    if (fem) s += `<path d="M40.5 ${ey - 1.6} L42 ${ey - 2.4} M59.5 ${ey - 1.6} L58 ${ey - 2.4}" stroke="#1a1210" stroke-width=".7"/>`;
  }
  s += `<path d="M50 44 L48 51 Q50 52.5 52 51" fill="none" stroke="${skd}" stroke-width="1.1" stroke-linecap="round"/>`;
  s += fem ? `<path d="M46 56 Q50 58 54 56" stroke="#9a4a42" stroke-width="1.6" fill="none" stroke-linecap="round"/>` : `<path d="M45.5 56 Q50 ${p.grin ? 59 : 57} 54.5 56" stroke="#5a3628" stroke-width="1.3" fill="none" stroke-linecap="round"/>`;
  if (p.paint) s += `<path d="M39 46 L47 47 M53 47 L61 46" stroke="#111" stroke-width="2" opacity=".75"/><path d="M39 48.5 L46 49.5 M54 49.5 L61 48.5" stroke="${p.paint}" stroke-width="1.2" opacity=".8"/>`;
  if (p.scar) s += `<path d="M58 36 L61 49" stroke="#7a3a2e" stroke-width="1.1"/><path d="M58.5 39 L60.5 39 M59.3 42 L61.3 42 M60 45 L62 45" stroke="#7a3a2e" stroke-width=".6"/>`;
  if (p.beard) s += `<path d="M36 46 Q37 60 50 65 Q63 60 64 46 Q62 55 57 57 Q50 60 43 57 Q38 55 36 46Z" fill="${hair}"/><path d="M45 54.5 Q50 53 55 54.5 Q50 56.5 45 54.5Z" fill="${hair}"/><path d="M45.5 56 Q50 57.5 54.5 56" stroke="#3a2418" stroke-width="1" fill="none"/>`;
  if (p.stubble) s += `<path d="M37 48 Q38 60 50 64 Q62 60 63 48 Q60 58 50 60 Q40 58 37 48Z" fill="${hair}" opacity=".28"/>`;
  // hair (short) when nothing covers it
  const hs = p.hairStyle;
  if (hs === 'short') s += `<path d="M34.5 40 Q33 22 50 21 Q67 22 65.5 40 Q63 29 50 28.5 Q37 29 34.5 40Z" fill="${hair}"/>`;
  if (hs === 'buzz') s += `<path d="M35 38 Q35 23 50 22.5 Q65 23 65 38 Q62 28 50 27.5 Q38 28 35 38Z" fill="${hair}" opacity=".85"/>`;
  if (hs === 'long' || hs === 'pony') s += `<path d="M34 42 Q32 21 50 20 Q68 21 66 42 Q64 30 56 27 Q50 32 40 30 Q36 34 34 42Z" fill="${hair}"/>`;
  if (hs === 'pony') s += `<path d="M62 26 Q76 30 72 52 Q70 40 64 34Z" fill="${hair}"/>`;
  if (hs === 'mohawk') s += `<path d="M44 30 Q46 12 50 11 Q54 12 56 30Z" fill="${hair}"/><path d="M35 38 Q36 27 44 26 M65 38 Q64 27 56 26" stroke="${hair}" stroke-width="1.5" fill="none" opacity=".5"/>`;
  // face gear
  if (p.mask === 'gas') s += `<path d="M38 47 Q38 63 50 66 Q62 63 62 47 Q56 50 50 50 Q44 50 38 47Z" fill="#1f2326"/><circle cx="50" cy="60" r="5.5" fill="#3a3f44"/><circle cx="50" cy="60" r="3.5" fill="#1a1d20"/><g stroke="#55606a" stroke-width=".6"><line x1="47" y1="60" x2="53" y2="60"/><line x1="50" y1="57" x2="50" y2="63"/></g><circle cx="40" cy="56" r="3" fill="#2d3236"/><circle cx="60" cy="56" r="3" fill="#2d3236"/><path d="M36 46 L30 48 M64 46 L70 48" stroke="#1a1d20" stroke-width="2"/>`;
  if (p.mask === 'shemagh') s += `<path d="M35 46 Q36 64 50 67 Q64 64 65 46 Q58 52 50 52 Q42 52 35 46Z" fill="${p.maskCol || '#c8b89a'}"/><g stroke="${shade(p.maskCol || '#c8b89a', .7)}" stroke-width=".8" opacity=".8"><path d="M37 52 L63 52 M38 56 L62 56 M40 60 L60 60"/><path d="M42 50 L44 64 M50 52 L50 66 M58 50 L56 64"/></g>`;
  if (p.mask === 'skull') s += `<path d="M37 47 Q38 63 50 66 Q62 63 63 47 Q56 51 50 51 Q44 51 37 47Z" fill="#141617"/><g fill="#d8d2c4"><rect x="42" y="55" width="2.6" height="5" rx=".6"/><rect x="45.5" y="55.5" width="2.6" height="5.5" rx=".6"/><rect x="49" y="55.5" width="2.6" height="5.8" rx=".6"/><rect x="52.5" y="55.5" width="2.6" height="5.5" rx=".6"/><rect x="56" y="55" width="2.6" height="5" rx=".6"/></g>`;
  if (p.glasses === 'shades') s += `<path d="M39 39.5 L49 39.5 L48 45 Q44 46.5 40 45Z M51 39.5 L61 39.5 L60 45 Q56 46.5 52 45Z" fill="#0d1114"/><path d="M49 40.5 L51 40.5" stroke="#0d1114" stroke-width="1.3"/><path d="M40.5 41 L44 41" stroke="#5aa6d6" stroke-width=".8" opacity=".7"/><path d="M52.5 41 L56 41" stroke="#5aa6d6" stroke-width=".8" opacity=".7"/>`;
  if (p.glasses === 'patch') s += `<ellipse cx="56" cy="42" rx="4.5" ry="3.8" fill="#0d1114"/><path d="M35 36 L61 41 M51 42 L65 47" stroke="#0d1114" stroke-width="1.1"/>`;
  if (p.glasses === 'goggles') s += `<rect x="37" y="37" width="26" height="9" rx="4.5" fill="#1b1d1f"/><ellipse cx="44" cy="41.5" rx="5" ry="3.6" fill="${acc}" opacity=".85"/><ellipse cx="56" cy="41.5" rx="5" ry="3.6" fill="${acc}" opacity=".85"/><path d="M41 40 L44 39.5" stroke="#fff" stroke-width=".9" opacity=".6"/><path d="M35 41 L37 41 M63 41 L65 41" stroke="#1b1d1f" stroke-width="2.5"/>`;
  // headgear
  const hg = p.head;
  if (hg === 'helmet' || hg === 'helmetNvg') {
    s += `<path d="M32 40 Q31 17 50 16 Q69 17 68 40 L65 40 Q64.5 28 50 27.5 Q35.5 28 35 40Z" fill="url(#hg)"/><path d="M33 33 Q50 27 67 33" stroke="${gd}" stroke-width="1.2" fill="none"/>
    <path d="M35 40 Q36 50 40 56 M65 40 Q64 50 60 56" stroke="#1b1d1f" stroke-width="1.4" fill="none"/>`;
    if (p.cover) s += `<g opacity=".5" fill="${shade(gear, .55)}"><ellipse cx="40" cy="24" rx="4" ry="2"/><ellipse cx="55" cy="21" rx="5" ry="2.2"/><ellipse cx="62" cy="30" rx="3" ry="2"/><ellipse cx="44" cy="31" rx="3" ry="1.5"/></g>`;
    if (hg === 'helmetNvg') s += `<rect x="45" y="17" width="10" height="7" rx="1.5" fill="#1b1d1f"/><rect x="43" y="11" width="6" height="7" rx="2" fill="#2a2d30"/><rect x="51" y="11" width="6" height="7" rx="2" fill="#2a2d30"/><circle cx="46" cy="12" r="1.6" fill="#64e06e"/><circle cx="54" cy="12" r="1.6" fill="#64e06e"/>`;
    else s += `<rect x="46" y="18" width="8" height="4" rx="1" fill="#1b1d1f"/>`;
    if (p.helmetGoggles) s += `<rect x="36" y="25" width="28" height="6" rx="3" fill="#1b1d1f"/><ellipse cx="44" cy="28" rx="4.5" ry="2.6" fill="${acc}" opacity=".8"/><ellipse cx="56" cy="28" rx="4.5" ry="2.6" fill="${acc}" opacity=".8"/>`;
    s += `<rect x="30" y="34" width="4" height="9" rx="1.5" fill="#1b1d1f"/><rect x="66" y="34" width="4" height="9" rx="1.5" fill="#1b1d1f"/>`;
  }
  if (hg === 'beret') s += `<path d="M33 33 Q30 20 46 18 Q64 16 69 26 Q66 31 58 30 Q46 28 36 34Z" fill="${p.beretCol || '#7a1f22'}"/><path d="M34 33 Q50 27 66 30" stroke="#1b1d1f" stroke-width="2.4" fill="none"/><circle cx="40" cy="27" r="2.6" fill="#e0b04a"/>`;
  if (hg === 'cap') s += `<path d="M34 34 Q34 18 50 18 Q66 18 66 34Z" fill="url(#hg)"/><path d="M34 33 Q50 30 66 33 Q72 34 78 36 Q66 38 50 36 Q40 36 34 35Z" fill="${gd}"/><rect x="45" y="23" width="10" height="5" rx="1" fill="${acc}" opacity=".85"/>`;
  if (hg === 'bandana') s += `<path d="M34 36 Q35 21 50 21 Q65 21 66 36 Q58 31 50 31 Q42 31 34 36Z" fill="${p.bandCol || '#a02a24'}"/><path d="M34 35 Q50 29 66 35" stroke="${shade(p.bandCol || '#a02a24', .7)}" stroke-width="2"/><path d="M64 33 Q72 36 74 44 Q70 40 66 38 Q71 43 70 48 Q66 41 63 37Z" fill="${p.bandCol || '#a02a24'}"/><g fill="#fff" opacity=".5"><circle cx="42" cy="27" r=".8"/><circle cx="50" cy="25" r=".8"/><circle cx="58" cy="27" r=".8"/></g>`;
  if (hg === 'hood') s += `<path d="M28 60 Q24 16 50 14 Q76 16 72 60 L66 70 Q66 46 64 36 Q60 26 50 26 Q40 26 36 36 Q34 46 34 70Z" fill="url(#hg)"/><path d="M34 70 Q34 46 36 36 Q40 26 50 26 Q60 26 64 36 Q66 46 66 70" stroke="${gd}" stroke-width="1.5" fill="none"/>`;
  if (hg === 'headset') s += `<path d="M34 38 Q34 18 50 18 Q66 18 66 38" stroke="#1b1d1f" stroke-width="2.6" fill="none"/><rect x="30" y="37" width="7" height="11" rx="3" fill="#2a2d30"/><rect x="63" y="37" width="7" height="11" rx="3" fill="#2a2d30"/><path d="M34 47 Q36 56 45 57" stroke="#1b1d1f" stroke-width="1.2" fill="none"/><circle cx="45.5" cy="57" r="1.4" fill="#1b1d1f"/>`;
  if (p.earpiece) s += `<path d="M64 42 Q68 46 66 54" stroke="#1b1d1f" stroke-width="1" fill="none"/><circle cx="64.5" cy="43" r="1.5" fill="#1b1d1f"/>`;
  // rim light & vignette
  s += `<rect width="100" height="100" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="6"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${s}</svg>`;
}
const PORTRAIT = {}, PORTRAIT_IMG = {};
function portraitURI(id) {
  if (!PORTRAIT[id] && typeof HERO_ART !== 'undefined' && HERO_ART[id]) PORTRAIT[id] = toBlobURL(HERO_ART[id]);
  if (!PORTRAIT[id]) { const h = HB[id]; PORTRAIT[id] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(portraitSVG(h.look || {}, h.r)); }
  return PORTRAIT[id];
}
function portraitImg(id) {
  if (!PORTRAIT_IMG[id]) { const im = new Image(); im.src = portraitURI(id); PORTRAIT_IMG[id] = im; }
  return PORTRAIT_IMG[id];
}

/* ---------- game art (buildings, enemies, backgrounds, icons) ---------- */
function toBlobURL(u) {
  try { const i = u.indexOf(','), mime = u.slice(5, u.indexOf(';')), bin = atob(u.slice(i + 1)), arr = new Uint8Array(bin.length); for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j); return URL.createObjectURL(new Blob([arr], { type: mime })); } catch (e) { return u; }
}
const ARTU = {}, ARTC = {};
function artURL(k) { if (!(k in ARTU)) ARTU[k] = (typeof ART !== 'undefined' && ART[k]) ? toBlobURL(ART[k]) : ''; return ARTU[k]; }
function artImg(k) { if (!(k in ARTC)) { const u = artURL(k); if (u) { const im = new Image(); im.src = u; ARTC[k] = im; } else ARTC[k] = null; } return ARTC[k]; }
const artReady = im => !!(im && im.complete && im.naturalWidth);
const ICO = { food: 'i_food', wood: 'i_wood', iron: 'i_iron', fuel: 'i_fuel', gems: 'i_gems', ticket: 'i_ticket', sp5: 'i_speed', sp60: 'i_speed' };
function ico(k, cls) { const u = ICO[k] && artURL(ICO[k]); if (u) return `<img class="ico ${cls || ''}" src="${u}" alt="" draggable="false">`; const d = RES[k] || ITEMS[k]; return d ? d.i : ''; }
function bImg(tp, cls) { const u = artURL('b_' + tp); return u ? `<img class="bimg ${cls || ''}" src="${u}" alt="" draggable="false">` : `<span class="ti ${cls || ''}">${BT[tp].i}</span>`; }
const ZIMG = { w: 'z_w', run: 'z_run', sp: 'z_sp', br: 'z_br', boss: 'z_boss', wb: 'z_wb' };
function preloadArt() { if (typeof ART === 'undefined') return; Object.keys(ART).forEach(k => { if (!k.startsWith('b_') && !k.startsWith('i_')) artImg(k); }); const b = artURL('bg_base'); if (b) document.documentElement.style.setProperty('--bg-base', `url("${b}")`); }
