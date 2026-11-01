/* ================= 3D characters: heroes that follow their artwork, and zombies by type =================
 * Every character shares one skeleton (hips, legs, chest, arms, head) so m3Walk can animate it.
 * Each hero then gets the outfit, helmet and weapon from its portrait. Parts that never move are merged
 * per limb, which keeps each character to a few draw calls.
 */
const C3 = { geo: {}, tex: {}, mat: {}, cached: new WeakSet() };
const c3G = (k, f) => { if (!C3.geo[k]) { C3.geo[k] = f(); C3.cached.add(C3.geo[k]); } return C3.geo[k]; };
function c3Lathe(pts, seg) { return new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(Math.max(.0001, p[0]), p[1])), seg || 12); }
/* rounded limb hanging from y=0 down to y=-len */
const c3Limb = (r1, r2, len) => c3G(`limb${r1}|${r2}|${len}`, () => c3Lathe([[0, -len], [r2 * .75, -len + .012], [r2, -len + .04], [(r1 + r2) / 2 * 1.06, -len * .5], [r1, -.035], [r1 * .75, -.008], [0, 0]], 9));
const c3Half = (r) => c3G('half' + r, () => new THREE.SphereGeometry(r, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2));
const c3Ball = (r, d) => c3G('ball' + r + '|' + (d || 0), () => new THREE.SphereGeometry(r, d ? 6 : 12, d ? 5 : 9));
const c3Box = (w, h, d) => c3G(`box${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
const c3Cyl = (a, b, h, n, open) => c3G(`cyl${a}|${b}|${h}|${n}|${open ? 1 : 0}`, () => new THREE.CylinderGeometry(a, b, h, n || 10, 1, !!open));
const c3Cone = (r, h, n) => c3G(`cone${r}|${h}|${n}`, () => new THREE.ConeGeometry(r, h, n || 8));
const c3Tor = (r, t, arc) => c3G(`tor${r}|${t}|${arc || 0}`, () => new THREE.TorusGeometry(r, t, 6, 18, arc || Math.PI * 2));
function A(parent, geo, mat, x, y, z, rx, ry, rz, sx, sy, sz) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.rotation.set(rx || 0, ry || 0, rz || 0);
  if (sx !== undefined) m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz);
  m.castShadow = true; parent.add(m); return m;
}
/* ---------- textures ---------- */
function c3Tex(key, draw, w, h) { return C3.tex[key] || (C3.tex[key] = canvasTex(w || 128, h || 128, draw)); }
function c3Shade(hex, f) { const n = parseInt(hex.slice(1, 7), 16), q = v => clamp(v * f, 0, 255) | 0; return `rgb(${q(n >> 16)},${q(n >> 8 & 255)},${q(n & 255)})`; }
function c3Speck(c, w, h, R, n, base, lo, hi, sz) { for (let i = 0; i < n; i++) { c.fillStyle = c3Shade(base, lo + R() * (hi - lo)); c.fillRect(R() * w, R() * h, sz || 2, sz || 2); } }
const texArmor = (base, trim) => c3Tex('ar' + base + trim, (c, w, h) => {
  const R = rng(5); c.fillStyle = base; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 32) {
    const g = c.createLinearGradient(0, y, 0, y + 32); g.addColorStop(0, c3Shade(base, 1.5)); g.addColorStop(.5, c3Shade(base, 1)); g.addColorStop(1, c3Shade(base, .55)); c.fillStyle = g; c.fillRect(0, y, w, 32);
    c.fillStyle = '#0009'; c.fillRect(0, y + 30, w, 2); c.fillStyle = trim; c.fillRect(0, y + 1, w, 2);
    for (let x = 6; x < w; x += 16) { c.beginPath(); c.arc(x, y + 7, 1.6, 0, 7); c.fill(); }
    c.strokeStyle = trim; c.globalAlpha = .4; c.lineWidth = 1; c.beginPath();
    for (let x = 0; x < w; x += 32) { c.moveTo(x, y + 20); c.quadraticCurveTo(x + 8, y + 12, x + 16, y + 20); c.quadraticCurveTo(x + 24, y + 28, x + 32, y + 20); }
    c.stroke(); c.globalAlpha = 1;
  }
  c3Speck(c, w, h, R, 300, base, .5, 1.7, 1);
});
const texLeather = base => c3Tex('le' + base, (c, w, h) => {
  const R = rng(7); c.fillStyle = base; c.fillRect(0, 0, w, h); c3Speck(c, w, h, R, 900, base, .7, 1.4, 2);
  c.fillStyle = '#0006'; for (const y of [22, 66, 110]) c.fillRect(0, y, w, 2);
  c.strokeStyle = c3Shade(base, 2); c.setLineDash([3, 3]); c.lineWidth = 1;
  for (const y of [19, 63, 107]) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  for (const x of [32, 96]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  c.setLineDash([]);
});
const texCloth = base => c3Tex('cl' + base, (c, w, h) => {
  const R = rng(3); c.fillStyle = base; c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 2) { c.fillStyle = c3Shade(base, .9 + R() * .2); c.fillRect(x, 0, 1, h); }
  for (let i = 0; i < 7; i++) { const x = R() * w, g = c.createLinearGradient(x - 10, 0, x + 10, 0); g.addColorStop(0, '#0000'); g.addColorStop(.5, '#0004'); g.addColorStop(1, '#0000'); c.fillStyle = g; c.fillRect(x - 10, 0, 20, h); }
});
const texFur = base => c3Tex('fu' + base, (c, w, h) => {
  const R = rng(21); c.fillStyle = c3Shade(base, .65); c.fillRect(0, 0, w, h); c.lineWidth = 1.6;
  for (let i = 0; i < 1500; i++) { const x = R() * w, y = R() * h; c.strokeStyle = c3Shade(base, .55 + R() * 1); c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - .5) * 4, y + 6 + R() * 7); c.stroke(); }
});
const texCamo = () => c3Tex('camo', (c, w, h) => {
  const R = rng(31); c.fillStyle = '#8a7a58'; c.fillRect(0, 0, w, h);
  for (const col of ['#a8966c', '#6a5a3a', '#5a6040', '#4a3e2a']) for (let i = 0; i < 14; i++) { c.fillStyle = col; c.beginPath(); c.ellipse(R() * w, R() * h, 6 + R() * 12, 3 + R() * 7, R() * 3, 0, 7); c.fill(); }
  c3Speck(c, w, h, R, 300, '#8a7a58', .6, 1.3, 1);
});
function c3Cracks(c, w, h, outer, inner) {
  const R = rng(41); c.lineCap = 'round';
  for (let k = 0; k < 22; k++) {
    let x = R() * w, y = R() * h; const pts = [[x, y]];
    for (let i = 0; i < 7; i++) { const a = R() * 6.3; x += Math.cos(a) * (6 + R() * 10); y += Math.sin(a) * (6 + R() * 10); pts.push([x, y]); }
    for (const [col, lw] of [[outer, 3.2], [inner, 1.2]]) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); }
  }
}
const texLava = base => c3Tex('lv' + base, (c, w, h) => { const R = rng(43); c.fillStyle = base; c.fillRect(0, 0, w, h); c3Speck(c, w, h, R, 700, base, .5, 1.8, 2); c3Cracks(c, w, h, '#c4400c', '#ffb050'); });
const texLavaE = () => c3Tex('lvE', (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c3Cracks(c, w, h, '#a03008', '#ffd080'); });
/* bare torso: muscles drawn at the front (u = .5 after the torso is turned around) */
const texMuscle = (skin, zomb) => c3Tex('mu' + skin + (zomb ? 'z' : ''), (c, w, h) => {
  const R = rng(51); c.fillStyle = skin; c.fillRect(0, 0, w, h); c3Speck(c, w, h, R, 600, skin, .82, 1.15, 2);
  c.strokeStyle = c3Shade(skin, .62); c.lineWidth = 2;
  for (const x of [55, 73]) { c.fillStyle = c3Shade(skin, 1.12); c.beginPath(); c.ellipse(x, 58, 10, 7, 0, 0, 7); c.fill(); c.stroke(); }
  for (const y of [78, 88, 98]) for (const x of [58, 70]) { c.fillStyle = c3Shade(skin, 1.08); c.beginPath(); if (c.roundRect) c.roundRect(x - 5, y - 4, 10, 8, 3); else c.rect(x - 5, y - 4, 10, 8); c.fill(); c.stroke(); }
  c.beginPath(); c.moveTo(64, 52); c.lineTo(64, 106); c.stroke();
  if (zomb) c3Gore(c, w, h, R);
});
function c3Gore(c, w, h, R) {
  for (let i = 0; i < 10; i++) { c.fillStyle = ['#6a5a7a55', '#5a0e0aaa', '#3a0806cc'][i % 3]; c.beginPath(); c.ellipse(R() * w, R() * h, 3 + R() * 9, 2 + R() * 6, R() * 3, 0, 7); c.fill(); }
  c.strokeStyle = '#4a2a3a88'; c.lineWidth = 1; for (let i = 0; i < 8; i++) { let x = R() * w, y = R() * h; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (R() - .5) * 14; y += R() * 10; c.lineTo(x, y); } c.stroke(); }
}
const texZSkin = base => c3Tex('zs' + base, (c, w, h) => { const R = rng(61); c.fillStyle = base; c.fillRect(0, 0, w, h); c3Speck(c, w, h, R, 700, base, .75, 1.2, 2); c3Gore(c, w, h, R); });
const texTorn = base => c3Tex('tn' + base, (c, w, h) => {
  const R = rng(67); c.fillStyle = base; c.fillRect(0, 0, w, h); c3Speck(c, w, h, R, 800, base, .6, 1.3, 2);
  for (let i = 0; i < 7; i++) { c.fillStyle = '#5a0e0a99'; c.beginPath(); c.ellipse(R() * w, R() * h, 4 + R() * 10, 3 + R() * 6, R() * 3, 0, 7); c.fill(); }
  c.fillStyle = '#120e0a'; for (let i = 0; i < 6; i++) { const x = R() * w, y = R() * h; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 6; k++) c.lineTo(x + (R() - .5) * 18, y + (R() - .5) * 18); c.fill(); }
});
/* ---------- materials ---------- */
const c3M = o => { const m = new THREE.MeshStandardMaterial(Object.assign({ roughness: .8 }, o)); if (o.color) m.color.convertSRGBToLinear(); if (o.emissive) m.emissive.convertSRGBToLinear(); return m; };
function c3Glow(color, size, op) {
  if (!C3.glowW) C3.glowW = texRadial('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: C3.glowW, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: op === undefined ? .7 : op }));
  s.scale.set(size, size, 1); s.userData.b = size; return s;
}
function c3Mat(spec, skin) {
  if (!spec) return null; const [k, a, b] = spec;
  if (k === 'armor') return c3M({ map: texArmor(a, b || '#c89a3a'), metalness: .55, roughness: .42 });
  if (k === 'leather') return c3M({ map: texLeather(a), roughness: .72 });
  if (k === 'cloth') return c3M({ map: texCloth(a), roughness: .95, side: THREE.DoubleSide });
  if (k === 'camo') return c3M({ map: texCamo(), roughness: .9 });
  if (k === 'lava') return c3M({ map: texLava(a || '#1a100c'), emissive: '#ff6a1a', emissiveMap: texLavaE(), emissiveIntensity: 1.3, roughness: .6, metalness: .3 });
  if (k === 'muscle') return c3M({ map: texMuscle(skin), roughness: .65 });
  if (k === 'fur') return c3M({ map: texFur(a), roughness: 1, side: THREE.DoubleSide });
  return c3M({ color: a || skin });
}
/* ---------- shared skeleton ---------- */
function c3Body(o) {
  const bw = o.build || 1, fw = o.fem ? .86 : 1, root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const hip = new THREE.Group(); hip.position.y = .6; body.add(hip);
  A(hip, c3G('pelvis', () => c3Lathe([[0, -.1], [.11, -.1], [.145, -.05], [.15, .02], [.13, .06], [0, .06]], 12)), o.legsM, 0, 0, 0, 0, 0, 0, bw * fw * (o.fem ? 1.06 : 1), 1, .8 * bw);
  const legL = new THREE.Group(), legR = new THREE.Group(); hip.add(legL, legR);
  legL.position.x = -.085 * bw; legR.position.x = .085 * bw;
  for (const l of [legL, legR]) {
    A(l, c3Limb(.072, .058, .31), o.legsM, 0, 0, 0, 0, 0, 0, bw, 1, bw);
    A(l, c3Limb(.056, .044, .26), o.legsM, 0, -.31, 0, 0, 0, 0, bw, 1, bw);
    A(l, c3Half(.05), o.kneeM || o.legsM, 0, -.315, .025, 1.3, 0, 0, bw);
    A(l, c3Box(.1, .075, .19), o.bootM, 0, -.565, .03, 0, 0, 0, bw, 1, 1);
    A(l, c3Cyl(.058, .052, .12, 9, true), o.bootM, 0, -.5, 0, 0, 0, 0, bw, 1, bw);
  }
  const chest = new THREE.Group(); chest.position.y = .64; body.add(chest);
  const torso = c3G('torso', () => { const g = c3Lathe([[0, -.02], [.13, 0], [.135, .06], [.15, .14], [.18, .24], [.185, .3], [.16, .36], [.1, .39], [.05, .4], [0, .405]], 16); g.rotateY(Math.PI); return g; });
  A(chest, torso, o.bodyM, 0, 0, 0, 0, 0, 0, bw * fw * (o.fat ? 1.25 : 1), 1, .74 * bw * (o.fat ? 1.45 : 1));
  if (o.fat) A(chest, c3Ball(.17), o.bellyM || o.bodyM, 0, .1, .07, 0, 0, 0, 1.15 * bw, .9, 1.1);
  const armL = new THREE.Group(), armR = new THREE.Group(); chest.add(armL, armR);
  const sx = (.2 * fw + .025) * bw * (o.fat ? 1.18 : 1); armL.position.set(-sx, .33, 0); armR.position.set(sx, .33, 0);
  armL.rotation.z = -.1; armR.rotation.z = .1;
  const ab = bw * (o.thickArms || 1);
  for (const a of [armL, armR]) {
    A(a, c3Ball(.058), o.armsM, 0, -.01, 0, 0, 0, 0, ab);
    A(a, c3Limb(.054, .046, .22), o.armsM, 0, 0, 0, 0, 0, 0, ab, 1, ab);
    A(a, c3Limb(.047, .04, .2), o.armsM, 0, -.21, 0, 0, 0, 0, ab, 1, ab);
    if (o.bracerM) A(a, c3Cyl(.054, .048, .12, 9, true), o.bracerM, 0, -.33, 0, 0, 0, 0, ab, 1, ab);
    A(a, c3Ball(.047), o.handM, 0, -.43, 0, 0, 0, 0, ab, 1.15 * ab, .85 * ab);
  }
  const head = new THREE.Group(); head.position.y = .4; chest.add(head);
  A(head, c3Cyl(.045, .05, .09, 8), o.skinM, 0, .02, 0, 0, 0, 0, bw);
  A(head, c3Ball(.1), o.faceM || o.skinM, 0, .125, 0, 0, 0, 0, .92, 1.08, 1);
  const eyeM = o.eyeM || (C3.mat.eye || (C3.mat.eye = new THREE.MeshBasicMaterial({ color: '#141010' })));
  for (const s of [-1, 1]) A(head, c3Ball(.013, 1), eyeM, s * .034, .135, .086);
  if (!o.noFace) { A(head, c3Box(.03, .04, .025), o.faceM || o.skinM, 0, .11, .095); A(head, c3Box(.07, .012, .02), o.browM || (C3.mat.brow || (C3.mat.brow = c3M({ color: '#2a1a12' }))), 0, .158, .088); }
  return { root, body, hip, legL, legR, chest, armL, armR, head, bw, fw };
}
/* merge the static parts of each limb so a character costs only a few draw calls */
function c3Finish(b, u) {
  const keepFn = o => o.userData.keep;
  for (const g of [b.legL, b.legR, b.armL, b.armR, b.head]) g.userData.keep = 1;
  m3Merge(b.body, keepFn);
  for (const g of [b.legL, b.legR, b.armL, b.armR, b.head]) { g.userData.keep = 0; m3Merge(g, keepFn); g.userData.keep = 1; }
  b.root.userData = Object.assign({ legL: b.legL, legR: b.legR, armL: b.armL, armR: b.armR, chest: b.chest, head: b.head, body: b.body, zombie: false, gun: false }, u);
  return b.root;
}
/* ---------- heroes ---------- */
const HERO3 = {
  redking: { sc: 1.64, build: 1.08, skin: '#c08a64', body: ['armor', '#3a302a', '#d4a24a'], legs: ['armor', '#2e2622', '#b8862e'], skirt: ['cloth', '#8a1a14'], sash: '#a01e16', fur: '#4a3426', cape: '#6e1410', head: 'crown', hair: '#1e140c', beard: '#1e140c', paul: 'gold', wpn: 'sword', fx: '#ff6a3a' },
  destroyer: { sc: 1.58, skin: '#d0a890', face: '#1e1626', body: ['armor', '#2a2238', '#9a5aff'], legs: ['cloth', '#1e1430'], robe: ['cloth', '#22143a'], head: 'hood', hood: '#1a1028', mask: '#0c0a10', eyes: '#d090ff', paul: 'plain', wpn: 'orb', orb: '#b26bff', fx: '#c07aff' },
  fire: { sc: 1.68, build: 1.1, skin: '#1a0c08', body: ['lava'], legs: ['lava'], skirt: ['lava'], head: 'horned', eyes: '#ffb03a', paul: 'spike', wpn: 'flame', flames: '#ff6a1a', fx: '#ff7a1a' },
  knight: { sc: 1.6, build: 1.05, skin: '#d9a982', body: ['armor', '#2a2c30', '#c89a3a'], legs: ['armor', '#24262a', '#c89a3a'], skirt: ['armor', '#2a2c30', '#c89a3a'], cape: '#5a1212', head: 'spartan', crest: '#a01a14', paul: 'gold', wpn: 'sword', shield: 1, fx: '#ffd77a' },
  lightning: { sc: 1.52, skin: '#c99068', face: '#141414', body: ['camo'], legs: ['camo'], vest: '#5a4e38', head: 'nvg', gloves: '#1a1a1a', wpn: 'rifle', knee: '#2a2620', fx: '#ffe9a8' },
  shadow: { sc: 1.46, fem: 1, skin: '#d9a982', body: ['leather', '#1c1a1e'], legs: ['leather', '#16141a'], head: 'hood', hood: '#141216', mask: '#0a0a0c', wpn: 'daggers', belts: '#3a2a20', fx: '#c8d0ff' },
  medic: { sc: 1.46, fem: 1, skin: '#e0b48e', body: ['cloth', '#d8d0bc'], arms: ['cloth', '#cfc6b0'], legs: ['leather', '#3a2a1e'], robe: ['cloth', '#e4dccb'], scarf: '#3a5a3a', head: 'pony', hair: '#1a1210', armband: 1, belts: '#4a3424', wpn: 'orb', orb: '#7dff7a', fx: '#7dff7a' },
  mountain: { sc: 1.8, build: 1.18, skin: '#a87a58', body: ['muscle'], arms: ['skin'], legs: ['leather', '#2a2018'], skirt: ['fur', '#5a4232'], fur: '#5a4232', head: 'wild', hair: '#1a120c', beard: '#1a120c', straps: '#3a2818', bracers: '#3a2818', wpn: 'hammer', fx: '#ffb070' },
  hawk: { sc: 1.52, skin: '#c99068', body: ['leather', '#2a2622'], legs: ['leather', '#201c18'], cape: '#1a1814', head: 'hood', hood: '#1e1a16', mask: '#0e0e10', paul: 'leather', quiver: 1, bird: 1, wpn: 'bow', fx: '#e8d8a0' },
  wind: { sc: 1.52, skin: '#e8c4a0', body: ['armor', '#3e444c', '#5aa6ff'], legs: ['armor', '#2e343c', '#5aa6ff'], cape: '#2a4a8a', scarf: '#2a4a8a', head: 'spiky', hair: '#e8ecf4', paul: 'gold', wpn: 'sword', bladeGlow: '#7ac8ff', fx: '#7ac8ff' },
};
function m3Hero(id) {
  const L = HERO3[id] || HERO3.wind, mats = {}, mm = sp => { if (!sp) return null; const k = sp.join('|'); return mats[k] || (mats[k] = c3Mat(sp, L.skin)); };
  const skinM = c3M({ color: L.skin, roughness: .7 }), bodyM = mm(L.body), armsM = L.arms && L.arms[0] === 'skin' ? skinM : mm(L.arms || L.body), legsM = mm(L.legs || L.body);
  const isArmor = (L.body[0] === 'armor' || L.body[0] === 'lava'), trimC = L.body[2] || '#d4a24a';
  const gold = c3M({ color: trimC, metalness: .9, roughness: .3, emissive: trimC, emissiveIntensity: .12 });
  const darkLeather = c3M({ map: texLeather('#2a2018'), roughness: .75 });
  const steel = c3M({ color: '#b8c0c8', metalness: .85, roughness: .25 });
  const b = c3Body({
    build: L.build, fem: L.fem, skinM, faceM: L.face ? c3M({ color: L.face, roughness: .8 }) : skinM, bodyM, armsM, legsM,
    handM: L.gloves ? c3M({ color: L.gloves }) : isArmor ? armsM : skinM, bootM: L.body[0] === 'lava' ? bodyM : darkLeather,
    kneeM: L.knee ? c3M({ color: L.knee }) : null, bracerM: L.bracers ? c3M({ map: texLeather(L.bracers) }) : isArmor ? armsM : null,
    eyeM: L.eyes ? new THREE.MeshBasicMaterial({ color: L.eyes }) : null, noFace: !!L.face,
  });
  const { chest, head, armL, armR, hip, body, bw, fw } = b, u = { heroId: id, flick: [] };
  const cloth = c => c3M({ map: texCloth(c), roughness: .95, side: THREE.DoubleSide });
  // pauldrons
  if (L.paul) {
    const pm = L.paul === 'leather' ? mm(['leather', L.body[1]]) : bodyM;
    for (const s of [-1, 1]) {
      A(chest, c3Half(.11), pm, s * .21 * bw * fw, .33, 0, 0, 0, -s * .45, 1.15 * bw, .85 * bw, 1.05 * bw);
      A(chest, c3Half(.1), pm, s * .25 * bw * fw, .27, 0, 0, 0, -s * .75, 1.05 * bw, .7 * bw, .95 * bw);
      if (L.paul === 'gold') A(chest, c3Tor(.11, .009), gold, s * .215 * bw * fw, .33, 0, Math.PI / 2, 0, -s * .45, 1.15 * bw, 1.05 * bw, 1);
      if (L.paul === 'spike') for (let i = 0; i < 3; i++) A(chest, c3Cone(.022, .12, 6), bodyM, s * (.2 + i * .035) * bw, .42 - i * .03, -.02 + i * .02, 0, 0, -s * (.3 + i * .3));
    }
  }
  // fur mantle over the shoulders
  if (L.fur) {
    const fm = c3M({ map: texFur(L.fur), roughness: 1, flatShading: true });
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; A(chest, c3Ball(.075, 1), fm, Math.sin(a) * .18 * bw, .35 + (Math.cos(a) > .3 ? -.03 : .01), Math.cos(a) * .14 * bw, 0, a, 0, 1.2, 1, 1.1); }
    for (const s of [-1, 1]) A(chest, c3Ball(.1, 1), fm, s * .21 * bw, .36, -.01, 0, 0, 0, 1.15, .85, 1.2);
  }
  // belt, sash, skirt, robe
  A(chest, c3Tor(.148, .02), darkLeather, 0, .02, 0, Math.PI / 2, 0, 0, bw * fw, .8 * bw, 1);
  A(chest, c3Box(.05, .045, .02), gold, 0, .02, .118 * bw);
  if (L.sash) { const sm = cloth(L.sash); A(chest, c3Tor(.15, .03), sm, 0, .06, 0, Math.PI / 2, 0, 0, bw, .78 * bw, 1); A(hip, c3Box(.09, .26, .01), sm, -.06, -.1, .125 * bw, .08, 0, .08); }
  if (L.skirt) A(hip, c3Cyl(.15, .2, .22, 14, true), mm(L.skirt), 0, -.08, 0, 0, 0, 0, bw * fw, 1, .85 * bw);
  if (L.robe) A(hip, c3Cyl(.155, .3, .58, 16, true), mm(L.robe), 0, -.27, 0, 0, 0, 0, bw * fw, 1, .9 * bw);
  // chest gear
  if (L.vest) {
    const vm = c3M({ map: texCloth(L.vest), roughness: .9 }), pm2 = c3M({ map: texCloth('#4a4030'), roughness: .9 });
    A(chest, c3Box(.33, .26, .27), vm, 0, .23, 0); for (const x of [-.09, 0, .09]) A(chest, c3Box(.07, .085, .045), pm2, x, .16, .15);
    A(chest, c3Box(.06, .1, .05), pm2, .17, .2, .03); for (const s of [-1, 1]) A(chest, c3Box(.06, .02, .28), vm, s * .1, .37, 0);
  }
  if (L.straps) { const st = c3M({ map: texLeather(L.straps) }); for (const s of [-1, 1]) A(chest, c3Box(.045, .48, .02), st, 0, .22, .135 * bw, 0, 0, s * .62); A(chest, c3Ball(.03), gold, 0, .22, .15 * bw); }
  if (L.belts) { const bl = c3M({ map: texLeather(L.belts) }); A(chest, c3Box(.04, .46, .02), bl, 0, .22, .132 * bw, 0, 0, .72); for (const x of [-.09, .07]) A(hip, c3Box(.06, .07, .04), bl, x, -.02, .13 * bw); }
  if (L.armband) { A(armL, c3Cyl(.057, .057, .05, 10, true), c3M({ color: '#f0ece4' }), 0, -.1, 0); const red = c3M({ color: '#c9302c' }); A(armL, c3Box(.004, .036, .012), red, -.058, -.1, 0); A(armL, c3Box(.004, .012, .036), red, -.058, -.1, 0); }
  // cape and scarf
  if (L.cape) {
    const geo = new THREE.PlaneGeometry(.42 * bw, .86, 4, 8); geo.translate(0, -.43, 0);
    const pa = geo.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i); pa.setZ(i, x * x * 1.6 - Math.sin(-y * 4) * .015); }
    geo.computeVertexNormals();
    const c = A(chest, geo, cloth(L.cape), 0, .37, -.14 * bw); c.rotation.x = .12; c.userData.keep = 1; u.cape = c;
  }
  if (L.scarf) {
    const sm = cloth(L.scarf); A(head, c3Tor(.07, .03), sm, 0, .01, 0, Math.PI / 2);
    const geo = new THREE.PlaneGeometry(.13, .5, 1, 5); geo.translate(0, -.25, 0); const s = A(head, geo, sm, .05, 0, -.07); s.rotation.set(.6, 0, .25); s.userData.keep = 1; u.scarf = s;
  }
  // heads
  const hairM = L.hair ? c3M({ color: L.hair, roughness: .85 }) : null;
  if (L.beard) { const bm = c3M({ map: texFur(L.beard), roughness: 1, flatShading: true }); A(head, c3G('beard', () => new THREE.SphereGeometry(.075, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), bm, 0, .085, .03, 0, 0, 0, 1.08, L.head === 'wild' ? 1.7 : 1.2, 1); A(head, c3Box(.07, .015, .02), bm, 0, .095, .095); }
  if (L.head === 'crown') {
    A(head, c3Half(.104), hairM, 0, .125, -.005, 0, 0, 0, 1, .95, 1.04);
    A(head, c3Cyl(.1, .106, .05, 14, true), gold, 0, .215, 0);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; A(head, c3Cone(.016, .07, 4), gold, Math.sin(a) * .1, .27, Math.cos(a) * .1); }
    const gem = new THREE.MeshBasicMaterial({ color: '#ff2a1a' }); A(head, c3Ball(.014, 1), gem, 0, .215, .104);
  }
  if (L.head === 'hood') {
    const hm = cloth(L.hood);
    A(head, c3G('hood', () => new THREE.SphereGeometry(.14, 16, 10, Math.PI / 2 + .85, Math.PI * 2 - 1.7, 0, Math.PI * .66)), hm, 0, .125, -.01);
    A(head, c3Cone(.06, .12, 8), hm, 0, .23, -.07, -.6);
    A(chest, c3Cyl(.12, .25, .16, 16, true), hm, 0, .34, 0, 0, 0, 0, bw * fw, 1, .85 * bw);
    if (L.mask) A(head, c3Box(.16, .075, .06), c3M({ color: L.mask }), 0, .08, .07);
    if (L.eyes) { u.flick.push(...[-1, 1].map(s => { const g = c3Glow(L.eyes, .09, .9); g.position.set(s * .034, .135, .1); head.add(g); return g; })); }
  }
  if (L.head === 'spartan') {
    const hm = c3M({ map: texArmor('#2a2c30', '#c89a3a'), metalness: .7, roughness: .35 });
    A(head, c3G('helm', () => new THREE.SphereGeometry(.124, 14, 10, 0, Math.PI * 2, 0, Math.PI * .6)), hm, 0, .125, 0);
    for (const s of [-1, 1]) A(head, c3Box(.05, .11, .03), hm, s * .055, .07, .09, 0, -s * .35);
    A(head, c3Box(.022, .07, .02), hm, 0, .115, .118); A(head, c3Tor(.124, .008), gold, 0, .12, 0, Math.PI / 2);
    A(head, c3Tor(.13, .03, Math.PI), c3M({ map: texFur(L.crest), roughness: 1 }), 0, .16, 0, 0, Math.PI / 2, 0, .45, 1, 1);
  }
  if (L.head === 'nvg') {
    const hm = c3M({ color: '#6a5c40', roughness: .8 }), blk = c3M({ color: '#1a1a1a', roughness: .5, metalness: .4 });
    A(head, c3G('helmN', () => new THREE.SphereGeometry(.118, 14, 9, 0, Math.PI * 2, 0, Math.PI * .55)), hm, 0, .135, 0);
    A(head, c3Box(.06, .04, .04), blk, 0, .215, .1); for (const s of [-1, 1]) { A(head, c3Cyl(.018, .018, .07, 8), blk, s * .026, .19, .14, Math.PI / 2); A(head, c3Cyl(.035, .035, .03, 10), blk, s * .1, .12, 0, 0, 0, Math.PI / 2); }
    A(head, c3Box(.13, .032, .02), skinM, 0, .135, .088); for (const s of [-1, 1]) A(head, c3Ball(.012, 1), C3.mat.eye || c3M({ color: '#111' }), s * .032, .135, .1);
  }
  if (L.head === 'horned') {
    A(head, c3Ball(.125), bodyM, 0, .13, 0, 0, 0, 0, 1, 1.05, 1); A(head, c3Box(.13, .09, .04), bodyM, 0, .085, .1);
    for (const s of [-1, 1]) { A(head, c3Cone(.034, .17, 7), bodyM, s * .1, .25, 0, 0, 0, -s * .7); A(head, c3Cone(.022, .12, 6), bodyM, s * .17, .35, 0, 0, 0, -s * .15); }
    for (let i = 0; i < 4; i++) A(head, c3Cone(.014, .07, 5), bodyM, (i - 1.5) * .035, .26, -.03, -.3);
    const em = new THREE.MeshBasicMaterial({ color: L.eyes }); for (const s of [-1, 1]) A(head, c3Box(.035, .012, .01), em, s * .036, .135, .128, 0, 0, s * .2);
    u.flick.push(...[-1, 1].map(s => { const g = c3Glow(L.eyes, .1, .9); g.position.set(s * .036, .135, .14); head.add(g); return g; }));
  }
  if (L.head === 'wild') {
    A(head, c3Half(.108), hairM, 0, .125, -.005, -.15, 0, 0, 1.12, 1.2, 1.14);
    for (const deg of [70, 100, 125, 150, 170, 190, 210, 235, 260, 290]) { const th = deg * Math.PI / 180; A(head, c3Cone(.04, .3, 5), hairM, Math.sin(th) * .1, .07, Math.cos(th) * .09 - .01, Math.PI + Math.cos(th) * .25, 0, -Math.sin(th) * .25); }
  }
  if (L.head === 'pony') {
    A(head, c3Half(.105), hairM, 0, .125, -.008, -.12, 0, 0, 1.06, 1.08, 1.1);
    for (let i = 0; i < 4; i++) A(head, c3Ball(.04 - i * .005), hairM, 0, .2 - i * .085, -.12 - (i ? .03 : 0));
    for (const s of [-1, 1]) A(head, c3Cone(.025, .16, 5), hairM, s * .08, .06, .04, Math.PI, 0, s * .12);
  }
  if (L.head === 'spiky') {
    A(head, c3Half(.106), hairM, 0, .125, -.005, 0, 0, 0, 1.04, 1.05, 1.06);
    const up = new THREE.Vector3(0, 1, 0);
    for (const d of [[0, 1, -.6], [.6, .7, -.5], [-.6, .7, -.5], [.3, .5, -1], [-.3, .5, -1], [0, .2, -1], [.85, .3, -.4], [-.85, .3, -.4], [0, .9, .5], [.4, .8, .45], [-.4, .8, .45]]) {
      const v = new THREE.Vector3(...d).normalize(); const m = A(head, c3Cone(.032, .14, 5), hairM, v.x * .1, .125 + v.y * .1, v.z * .1); m.quaternion.setFromUnitVectors(up, v);
    }
  }
  // weapons
  const handGroup = (arm, rx) => { const g = new THREE.Group(); g.position.set(0, -.43, 0); g.rotation.x = rx; arm.add(g); return g; };
  const bladeGeo = (len, wd) => c3G(`blade${len}|${wd}`, () => { const sh = new THREE.Shape(); sh.moveTo(-wd, 0); sh.lineTo(wd, 0); sh.lineTo(wd * .75, -len * .88); sh.lineTo(0, -len); sh.lineTo(-wd * .75, -len * .88); sh.lineTo(-wd, 0); const g = new THREE.ExtrudeGeometry(sh, { depth: .01, bevelEnabled: true, bevelThickness: .004, bevelSize: .004, bevelSegments: 1 }); g.translate(0, -.06, -.005); return g; });
  const sword = (arm, len, wd, mat) => {
    const g = handGroup(arm, -1.05); A(g, c3Cyl(.014, .014, .11, 6), darkLeather, 0, 0, 0); A(g, c3Ball(.022, 1), gold, 0, .065, 0); A(g, c3Box(.16, .022, .032), gold, 0, -.058, 0);
    A(g, bladeGeo(len, wd), mat); return g;
  };
  if (L.wpn === 'sword') { const bm = L.bladeGlow ? c3M({ color: '#d8ecff', emissive: L.bladeGlow, emissiveIntensity: .55, metalness: .8, roughness: .25 }) : steel; const g = sword(armR, .62, .024, bm); if (L.bladeGlow) { const s = c3Glow(L.bladeGlow, .35, .45); s.position.y = -.38; g.add(s); u.flick.push(s); } armR.rotation.x = -.3; }
  if (L.wpn === 'flame') {
    const g = sword(armR, .72, .032, bodyM); armR.rotation.x = -.3;
    for (let i = 0; i < 3; i++) { const s = c3Glow(L.flames, .28 - i * .04, .75); s.position.y = -.25 - i * .18; g.add(s); u.flick.push(s); }
    for (const p of [[-.22, .4, 0], [.22, .4, 0], [0, .62, -.05]]) { const s = c3Glow(L.flames, .3, .55); s.position.set(...p); chest.add(s); u.flick.push(s); }
  }
  if (L.shield) {
    const sh = new THREE.Shape(); sh.moveTo(-.16, .2); sh.lineTo(.16, .2); sh.lineTo(.15, -.02); sh.lineTo(0, -.27); sh.lineTo(-.15, -.02); sh.lineTo(-.16, .2);
    const sg = c3G('kite', () => new THREE.ExtrudeGeometry(sh, { depth: .025, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 1 }));
    const g = new THREE.Group(); g.position.set(-.05, -.3, .05); g.rotation.y = -.6; armL.add(g);
    A(g, sg, bodyM, 0, 0, .006); A(g, sg, gold, 0, 0, 0, 0, 0, 0, 1.08, 1.06, .9); A(g, c3Box(.03, .2, .01), gold, 0, 0, .04); A(g, c3Box(.14, .03, .01), gold, 0, .06, .04);
  }
  if (L.wpn === 'hammer') {
    const g = handGroup(armR, -.75); armR.rotation.x = -.2; const hm = c3M({ color: '#5a5650', metalness: .7, roughness: .45 });
    A(g, c3Cyl(.02, .02, .78, 7), darkLeather, 0, -.25, 0); A(g, c3Box(.13, .14, .26), hm, 0, -.64, 0); A(g, c3Box(.15, .03, .28), gold, 0, -.64, 0);
    for (const z of [-.15, .15]) A(g, c3Cone(.03, .07, 5), hm, 0, -.64, z, z > 0 ? Math.PI / 2 : -Math.PI / 2);
  }
  if (L.wpn === 'daggers') {
    const dg = c3G('dagger', () => { const s2 = new THREE.Shape(); s2.moveTo(-.012, 0); s2.quadraticCurveTo(.07, -.12, .03, -.27); s2.quadraticCurveTo(.03, -.13, .014, 0); s2.lineTo(-.012, 0); const g = new THREE.ExtrudeGeometry(s2, { depth: .006, bevelEnabled: false }); g.translate(0, -.05, -.003); return g; });
    for (const a of [armL, armR]) { const g = handGroup(a, -.9); A(g, c3Cyl(.012, .012, .08, 6), darkLeather, 0, 0, 0); A(g, dg, steel, 0, 0, 0, 0, a === armL ? Math.PI : 0, 0); }
    armL.rotation.x = armR.rotation.x = -.35;
  }
  if (L.wpn === 'bow') {
    const g = handGroup(armL, -1.0); armL.rotation.x = -.3;
    const bg = c3G('bow', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0, .46, 0], [0, .3, .08], [0, 0, .1], [0, -.3, .08], [0, -.46, 0]].map(p => new THREE.Vector3(...p))), 24, .013, 5));
    A(g, bg, c3M({ color: '#4a2e18', roughness: .6 })); A(g, c3Cyl(.002, .002, .92, 3), c3M({ color: '#e8e0c8' }), 0, 0, 0); A(g, c3Cyl(.018, .018, .1, 6), darkLeather, 0, 0, .1);
  }
  if (L.quiver) {
    const q = new THREE.Group(); q.position.set(.08, .26, -.17); q.rotation.z = .35; chest.add(q);
    A(q, c3Cyl(.045, .04, .34, 8), darkLeather, 0, 0, 0); const fm = c3M({ color: '#d8d0c0', side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) { const x = (i - 2) * .016, z = (i % 2) * .018 - .009; A(q, c3Cyl(.005, .005, .1, 4), darkLeather, x, .21, z); A(q, c3Box(.002, .05, .022), fm, x, .25, z); }
  }
  if (L.bird) {
    const bd = new THREE.Group(); bd.position.set(-.25 * bw, .45, -.02); chest.add(bd); const bm = c3M({ color: '#5a4030', roughness: .9 }), wm = c3M({ color: '#3a2a1e', roughness: .9 });
    A(bd, c3Ball(.05), bm, 0, 0, 0, 0, 0, 0, .8, .85, 1.4); A(bd, c3Ball(.032), c3M({ color: '#e8e0d0' }), 0, .05, .05); A(bd, c3Cone(.012, .03, 5), c3M({ color: '#d8a030' }), 0, .045, .085, Math.PI / 2);
    for (const s of [-1, 1]) A(bd, c3Box(.015, .05, .12), wm, s * .04, .005, -.01, 0, 0, s * .25); A(bd, c3Box(.04, .01, .08), wm, 0, -.01, -.09, .3);
  }
  if (L.wpn === 'rifle') {
    const g = new THREE.Group(); g.position.set(.06, .24, .2); chest.add(g); const gm = c3M({ color: '#24272a', metalness: .6, roughness: .45 }), tan = c3M({ color: '#6a5c40', roughness: .8 });
    A(g, c3Box(.05, .07, .3), gm, 0, 0, .05); A(g, c3Cyl(.012, .012, .26, 6), gm, 0, .01, .33, Math.PI / 2); A(g, c3Box(.055, .055, .16), tan, 0, .005, .25);
    A(g, c3Box(.04, .075, .18), tan, 0, -.01, -.17); A(g, c3Box(.035, .12, .05), gm, 0, -.08, .07, .2); A(g, c3Cyl(.02, .02, .12, 8), gm, 0, .06, .05, Math.PI / 2); A(g, c3Box(.03, .08, .035), gm, 0, -.06, -.04, -.3);
    const mz = new THREE.Object3D(); mz.position.set(0, .01, .47); g.add(mz); u.muzzle = mz;
    armR.rotation.set(-.9, 0, .1); armL.rotation.set(-1.15, 0, .55); u.gun = true;
  }
  if (L.wpn === 'orb') {
    armL.rotation.x = -.6; const g = new THREE.Group(); g.position.set(0, -.47, .03); g.userData.keep = 1; armL.add(g); u.orb = g;
    A(g, c3Ball(.04), new THREE.MeshBasicMaterial({ color: '#ffffff' })); A(g, c3Ball(.075), new THREE.MeshBasicMaterial({ color: L.orb, transparent: true, opacity: .45, depthWrite: false }));
    const s = c3Glow(L.orb, .5, .8); g.add(s); u.flick.push(s);
    u.orbParts = []; for (let i = 0; i < 6; i++) { const p = c3Glow(L.orb, .07, 1); g.add(p); u.orbParts.push(p); }
  }
  u.poseL = armL.rotation.x; u.poseR = armR.rotation.x; u.wpn = L.wpn;
  const h = c3Finish(b, u); h.scale.setScalar(L.sc); return h;
}
/* ---------- zombies ---------- */
const ZOMB3 = {
  w: { sc: 1.5, skin: '#968476', shirt: '#4a4a32', pants: '#4a4a4c', hunch: .35 },
  run: { sc: 1.45, skin: '#8e7a6e', shirt: '#3a3430', pants: '#4a3a2a', hair: '#1a1410', hunch: .55, thin: .85 },
  sp: { sc: 1.55, skin: '#9a8470', fat: 1, bare: 1, pants: '#3a3a30', slime: '#8fdf3a', hunch: .2 },
  br: { sc: 2.15, skin: '#8e7062', build: 1.35, bare: 1, pants: '#2a3448', bands: 1, hunch: .3, thick: 1.25 },
  boss: { sc: 2.65, skin: '#8a7464', build: 1.3, armor: ['armor', '#2a2220', '#8a6a3a'], cape: '#7a1410', skull: 1, wpn: 'cleaver', hunch: .15 },
  wb: { sc: 4.3, skin: '#5a524c', build: 1.5, bare: 1, lava: 1, pants: '#2a2420', hunch: .3, thick: 1.35 },
};
function c3ZMats(type) {
  if (C3.mat['z' + type]) return C3.mat['z' + type];
  const Z = ZOMB3[type], m = {};
  m.skin = Z.lava ? c3M({ map: texLava('#4a4440'), emissive: '#ff5a10', emissiveMap: texLavaE(), emissiveIntensity: 1.1, roughness: .9, flatShading: true }) : c3M({ map: texZSkin(Z.skin), roughness: .75 });
  m.torso = Z.lava ? m.skin : Z.armor ? c3Mat(Z.armor) : Z.bare ? c3M({ map: texMuscle(Z.skin, true), roughness: .7 }) : c3M({ map: texTorn(Z.shirt), roughness: .95 });
  m.arms = Z.lava ? m.skin : Z.armor ? m.torso : Z.bare ? m.skin : c3M({ map: texTorn(Z.shirt), roughness: .95 });
  m.pants = Z.armor ? c3M({ map: texLeather('#2a1e18') }) : c3M({ map: texTorn(Z.pants || '#3a3a3a'), roughness: .95 });
  m.eye = new THREE.MeshBasicMaterial({ color: type === 'boss' || type === 'wb' ? '#ff3a1a' : '#ffd23a' });
  m.mouth = c3M({ color: '#3a0806', roughness: .6 }); m.dark = c3M({ color: '#1e1a16', roughness: .9 });
  return (C3.mat['z' + type] = m);
}
function m3Zombie(type) {
  const Z = ZOMB3[type] || ZOMB3.w, M = c3ZMats(type) , R = Math.random;
  const b = c3Body({ build: Z.build, fat: Z.fat, thickArms: Z.thick, skinM: M.skin, bodyM: M.torso, bellyM: Z.fat ? M.skin : null, armsM: M.arms, legsM: M.pants, handM: M.skin, bootM: Z.armor ? M.pants : M.skin, eyeM: M.eye, noFace: true, browM: M.dark });
  const { chest, head, armL, armR, hip, bw } = b, u = { zombie: true, flick: [], ztype: type };
  if (Z.thin) b.chest.scale.x = Z.thin;
  A(head, c3Box(.055, .04, .03), M.mouth, 0, .07, .088); A(head, c3Box(.03, .04, .025), M.skin, 0, .11, .093);
  if (Z.hair) { const hm = c3M({ color: Z.hair }); A(head, c3Half(.104), hm, 0, .13, -.01, -.2, 0, 0, 1, .9, 1.05); for (let i = 0; i < 6; i++) A(head, c3Cone(.025, .14, 5), hm, (i - 2.5) * .03, .2, -.05, -.9 - R() * .4, 0, (R() - .5) * .8); }
  if (Z.slime) {
    const sm = c3M({ color: Z.slime, emissive: Z.slime, emissiveIntensity: .5, roughness: .3, transparent: true, opacity: .9 });
    A(head, c3Cone(.03, .14, 6), sm, 0, .01, .1, Math.PI); A(chest, c3Ball(.05, 1), sm, .03, .16, .2, 0, 0, 0, 1.2, 1.6, .5);
    const g = c3Glow(Z.slime, .25, .5); g.position.set(0, .06, .12); head.add(g); u.flick.push(g);
  }
  if (Z.bands) { const mt = c3M({ color: '#3a3a3e', metalness: .7, roughness: .4 }); for (const a of [armL, armR]) A(a, c3Cyl(.056, .056, .07, 9, true), mt, 0, -.35, 0, 0, 0, 0, Z.thick * bw, 1, Z.thick * bw); }
  if (Z.armor) {
    const am = M.torso, bone = c3M({ color: '#c8b89a', roughness: .7 });
    for (const s of [-1, 1]) { A(chest, c3Half(.12), am, s * .22 * bw, .33, 0, 0, 0, -s * .45, 1.2 * bw, .9, 1.1); for (let i = 0; i < 3; i++) A(chest, c3Cone(.025, .14, 6), bone, s * (.2 + i * .04) * bw, .44 - i * .03, -.03 + i * .03, 0, 0, -s * (.25 + i * .3)); }
    A(hip, c3Cyl(.15, .21, .22, 12, true), am, 0, -.08, 0, 0, 0, 0, bw, 1, .85 * bw);
    const geo = new THREE.PlaneGeometry(.46 * bw, .9, 3, 6); geo.translate(0, -.45, 0); const c = A(chest, geo, c3M({ map: texTorn(Z.cape), side: THREE.DoubleSide }), 0, .37, -.15 * bw); c.rotation.x = .15; c.userData.keep = 1; u.cape = c;
  }
  if (Z.skull) {
    const bone = c3M({ color: '#c8b89a', roughness: .7 }), blk = c3M({ color: '#0a0806' });
    A(head, c3Ball(.12), bone, 0, .14, 0, 0, 0, 0, 1, 1.05, 1.05);
    for (const s of [-1, 1]) { A(head, c3Ball(.028, 1), blk, s * .042, .14, .1); A(head, c3Cone(.04, .22, 7), bone, s * .12, .28, 0, 0, 0, -s * .8); A(head, c3Cone(.028, .15, 6), bone, s * .22, .42, 0, 0, 0, -s * .1); }
    A(head, c3Box(.09, .04, .04), bone, 0, .05, .08);
  }
  if (Z.wpn === 'cleaver') {
    const g = new THREE.Group(); g.position.set(0, -.43, 0); g.rotation.x = -1.3; armR.add(g); const st = c3M({ color: '#9aa0a4', metalness: .8, roughness: .35 }), blood = c3M({ color: '#5a0e0a' });
    A(g, c3Cyl(.016, .016, .14, 6), M.dark, 0, 0, 0); A(g, c3Box(.02, .42, .2), st, 0, -.28, .05); A(g, c3Box(.022, .1, .1), blood, 0, -.38, .08);
  }
  if (Z.lava) { const rk = c3M({ map: texLava('#4a4440'), roughness: 1, flatShading: true }); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) A(chest, new THREE.DodecahedronGeometry(.07 - i * .012), rk, s * (.18 + i * .05) * bw, .38 - i * .04, (i - 1) * .05); for (let i = 0; i < 3; i++) { const g = c3Glow('#ff6a1a', .45, .5); g.position.set((i - 1) * .14, .25 + i * .05, .1); chest.add(g); u.flick.push(g); } }
  chest.rotation.x = Z.hunch; head.rotation.x = -Z.hunch * .7; armL.rotation.x = armR.rotation.x = -1.35;
  const z = c3Finish(b, u); z.scale.setScalar(Z.sc); return z;
}
window.C3DBG = { hero: m3Hero, zombie: m3Zombie, heroes: () => HEROES.map(h => h.id) };
