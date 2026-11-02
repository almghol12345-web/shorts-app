/* ================= 3D battle =================
 * The fight rules stay in 10-battle.js and work in screen coordinates. This file draws the same fight as a
 * 3D street: the heroes stand behind sandbags, the zombies walk out of the fog, and numbers, health bars and
 * shots are drawn on the 2D canvas on top, at the projected 3D positions. It borrows the village renderer,
 * so the phone only ever holds one WebGL context.
 */
const B3 = { pool: {}, dying: [], parts: [], fires: [], proj: [], rings: [], t: 0 };
const B3_ZOFF = { w: .3, run: .3, sp: .4, br: .55, boss: .75, wb: 1.3 };
const b3X = x => (x - B.W / 2) / B3.U, b3Z = y => (y - B.lineY) / B3.U;
const _b3v = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
function b3PW(x, y, z) { _b3v.set(x, y, z).project(B3.cam); return [(_b3v.x + 1) / 2 * B.W, (1 - _b3v.y) / 2 * B.H]; }
function b3PPU(x, y, z) { const a = b3PW(x - .5, y, z), b = b3PW(x + .5, y, z); return Math.hypot(b[0] - a[0], b[1] - a[1]); }
/* ---------- street textures ---------- */
function texRoad() {
  return c3Tex('road', (c, w, h) => {
    const R = rng(71); c.fillStyle = '#2b2d2f'; c.fillRect(0, 0, w, h); c3Speck(c, w, h, R, 3000, '#2b2d2f', .6, 1.5, 2);
    for (let i = 0; i < 9; i++) { c.fillStyle = R() < .5 ? '#22242688' : '#36383a88'; c.fillRect(R() * w, R() * h, 20 + R() * 60, 14 + R() * 50); }
    c.strokeStyle = '#151617'; c.lineWidth = 1.5; for (let i = 0; i < 14; i++) { let x = R() * w, y = R() * h; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (R() - .5) * 30; y += (R() - .5) * 30; c.lineTo(x, y); } c.stroke(); }
    c.fillStyle = '#c8c0a8cc'; for (let y = 0; y < h; y += 128) c.fillRect(w / 2 - 3, y + 20, 6, 64);
    c.fillStyle = '#b8b0a099'; c.fillRect(10, 0, 4, h); c.fillRect(w - 14, 0, 4, h);
  }, 256, 512);
}
function texFacade(v) {
  return c3Tex('fac' + v, (c, w, h) => {
    const R = rng(80 + v), base = ['#5a4e44', '#4a4a4e', '#6a5444', '#3e4246'][v % 4];
    c.fillStyle = base; c.fillRect(0, 0, w, h); c3Speck(c, w, h, R, 1500, base, .7, 1.3, 2);
    for (let y = 0; y < h; y += 64) { c.fillStyle = '#0005'; c.fillRect(0, y + 60, w, 4); }
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      const x = col * 64 + 14, y = row * 64 + 12, r = R();
      c.fillStyle = '#1a1612'; c.fillRect(x - 3, y - 3, 42, 44);
      if (r < .16) { const g = c.createLinearGradient(0, y, 0, y + 38); g.addColorStop(0, '#ffd08a'); g.addColorStop(1, '#e08a3a'); c.fillStyle = g; }
      else c.fillStyle = r < .3 ? '#2a3a4a' : '#101418';
      c.fillRect(x, y, 36, 38);
      if (r > .8) { c.fillStyle = base; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 20, y + 8); c.lineTo(x + 8, y + 22); c.lineTo(x, y + 30); c.fill(); }
      c.fillStyle = '#0006'; c.fillRect(x - 3, y + 38, 42, 4);
    }
    for (let i = 0; i < 6; i++) { c.fillStyle = '#0003'; c.fillRect(R() * w, 0, 3 + R() * 8, h * R()); }
  }, 256, 256);
}
const texBurlap = () => c3Tex('burlap', (c, w, h) => { const R = rng(91); c.fillStyle = '#8a7650'; c.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 3) { c.fillStyle = c3Shade('#8a7650', .85 + R() * .3); c.fillRect(i, 0, 1.5, h); c.fillRect(0, i, w, 1.5); } c3Speck(c, w, h, R, 400, '#8a7650', .6, 1.2, 2); });
/* ---------- scene ---------- */
function b3Scene() {
  if (B3.scene) return;
  const scene = new THREE.Scene(); B3.scene = scene;
  scene.background = new THREE.Color('#1c2636'); scene.fog = new THREE.Fog('#1c2636', 18, 50);
  B3.cam = new THREE.PerspectiveCamera(50, 1, .5, 140);
  B3.hemi = new THREE.HemisphereLight('#9ab0d8', '#3a3028', .95); scene.add(B3.hemi);
  const moon = new THREE.DirectionalLight('#b0c4ff', .55); moon.position.set(-6, 14, -4); scene.add(moon);
  const warm = new THREE.DirectionalLight('#ffc890', .8); warm.position.set(4, 12, 12); warm.target.position.set(0, 0, -6); scene.add(warm, warm.target);
  if (S.gfx !== 'low') { warm.castShadow = true; warm.shadow.mapSize.set(1024, 1024); const sc = warm.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 16; sc.bottom = -10; sc.near = 2; sc.far = 50; warm.shadow.bias = -.0015; }
  B3.flash = new THREE.PointLight('#ffb050', 0, 16, 2); scene.add(B3.flash);
  const st = new THREE.Group(); scene.add(st);
  // road and sidewalks
  const rt = texRoad(); rt.wrapS = rt.wrapT = THREE.RepeatWrapping; rt.repeat.set(1, 7);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 90), new THREE.MeshStandardMaterial({ map: rt, roughness: .95 }));
  road.rotation.x = -Math.PI / 2; road.position.z = -34; st.add(road);
  const walkM = c3M({ color: '#5e5a54', roughness: 1 }), curbM = c3M({ color: '#6a6660', roughness: 1 });
  for (const s of [-1, 1]) { A(st, new THREE.BoxGeometry(2.6, .16, 90), walkM, s * 6.9, .08, -34); A(st, new THREE.BoxGeometry(.18, .2, 90), curbM, s * 5.62, .1, -34); }
  // buildings on both sides: dark blocks with a lit facade facing the street
  const wallM = c3M({ color: '#2e2a28', roughness: 1 }), facM = [0, 1, 2, 3].map(v => { const tx = texFacade(v); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; return new THREE.MeshStandardMaterial({ map: tx, roughness: .9, emissive: '#ffffff', emissiveMap: tx, emissiveIntensity: .22 }); });
  const R = rng(7);
  for (const s of [-1, 1]) for (let z = 8, i = 0; z > -72; i++) {
    const d = 5 + R() * 3, h = 6 + R() * 9, cz = z - d / 2, cx = s * 10.9;
    A(st, new THREE.BoxGeometry(5.6, h, d), wallM, cx, h / 2, cz);
    const fg = new THREE.PlaneGeometry(d, h); const uv = fg.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * d / 4, uv.getY(k) * h / 4);
    const f = A(st, fg, facM[(i + (s > 0 ? 2 : 0)) % 4], s * 8.09, h / 2, cz, 0, -s * Math.PI / 2); f.castShadow = false;
    if (R() < .45) for (let k = 0; k < 4; k++) A(st, new THREE.BoxGeometry(1 + R() * 2, .6 + R() * 1.8, 1 + R() * 2), wallM, cx + (R() - .5) * 3, h + .3, cz + (R() - .5) * (d - 1.5), 0, R(), 0);
    else { A(st, new THREE.BoxGeometry(1.2, .8, 1), curbM, cx + .8, h + .4, cz); A(st, new THREE.CylinderGeometry(.5, .5, 1.1, 10), wallM, cx - 1, h + .55, cz + 1); }
    z -= d + .25;
  }
  A(st, new THREE.BoxGeometry(30, 22, 3), wallM, 0, 11, -76);
  // street lamps
  const poleM = c3M({ color: '#3a3c3e', metalness: .6, roughness: .5 });
  for (const s of [-1, 1]) for (let z = 4, k = 0; z > -60; z -= 13, k++) {
    A(st, new THREE.CylinderGeometry(.06, .09, 4.6, 7), poleM, s * 6.2, 2.3, z); A(st, new THREE.BoxGeometry(1.2, .08, .1), poleM, s * 5.7, 4.55, z); A(st, new THREE.BoxGeometry(.4, .14, .25), poleM, s * 5.15, 4.5, z);
    if ((k + (s > 0 ? 1 : 0)) % 3) { const g = c3Glow('#ffc070', 2.2, .55); g.position.set(s * 5.15, 4.35, z); scene.add(g); }
  }
  // cars, some of them burning
  const glass = c3M({ color: '#1a2228', metalness: .6, roughness: .2 }), tire = c3M({ color: '#141414', roughness: .9 }), burnt = c3M({ color: '#2a2420', roughness: 1 });
  const cars = [[-4.3, -3.2, .25, '#5a2a22', 1], [4.5, -8.5, -.3, '#3a4a5a', 0], [-4.6, -15, .1, '#6a6a60', 0], [4.2, -21, .4, '#2a2420', 1], [-4.2, -29, -.2, '#4a3a2a', 0], [4.6, -37, .15, '#5a5a62', 0], [-4.4, -46, .3, '#2a2420', 1]];
  for (const [x, z, ry, col, fire] of cars) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; st.add(g); const bm = fire ? burnt : c3M({ color: col, metalness: .4, roughness: .55 });
    A(g, new THREE.BoxGeometry(1.75, .55, 3.7), bm, 0, .48, 0); A(g, new THREE.BoxGeometry(1.5, .46, 1.9), fire ? burnt : glass, 0, .98, -.15);
    for (const [wx, wz] of [[-.82, 1.2], [.82, 1.2], [-.82, -1.2], [.82, -1.2]]) A(g, new THREE.CylinderGeometry(.33, .33, .26, 12), tire, wx, .33, wz, 0, 0, Math.PI / 2);
    if (fire) b3Fire(x, z, z > -10);
  }
  // debris
  const barrelMs = ['#7a2a1e', '#2a4a6a', '#6a5a3a'].map(c => c3M({ color: c, metalness: .4, roughness: .6 })), block = c3M({ color: '#8a8680', roughness: 1 });
  for (let i = 0; i < 26; i++) {
    const s = R() < .5 ? -1 : 1, x = s * (4.6 + R() * 3.2), z = 2 - R() * 58, k = R();
    if (k < .35) A(st, new THREE.CylinderGeometry(.3, .3, .9, 10), barrelMs[i % 3], x, .45, z); else if (k < .55) A(st, new THREE.TorusGeometry(.3, .12, 6, 12), tire, x, .12, z, Math.PI / 2);
    else if (k < .8) A(st, new THREE.BoxGeometry(.9, .5, .6), block, x, .25, z, 0, R() * 3, 0); else A(st, new THREE.DodecahedronGeometry(.35), block, x, .2, z);
  }
  // sandbag barricade in front of the heroes
  const bagM = c3M({ map: texBurlap(), roughness: 1 }), bag = new THREE.SphereGeometry(.5, 10, 6);
  for (let row = 0; row < 2; row++) for (let i = 0; i < 18; i++) { const x = -5.6 + i * .66 + (row ? .33 : 0); if (x > 5.7) continue; A(st, bag, bagM, x, .15 + row * .24, .42 + (row ? -.04 : 0), 0, (R() - .5) * .2, 0, .72, .3, .38); }
  for (const s of [-1, 1]) A(st, new THREE.BoxGeometry(1.2, .9, .6), block, s * 6.1, .45, .4);
  m3Merge(st);
  // falling ash
  const n = 260, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5) * 16; pos[i * 3 + 1] = Math.random() * 10; pos[i * 3 + 2] = 8 - Math.random() * 50; }
  const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  B3.ash = new THREE.Points(ag, new THREE.PointsMaterial({ color: '#cfc6bc', size: .07, transparent: true, opacity: .55, depthWrite: false })); scene.add(B3.ash);
  B3.decals = []; B3.bloodM = new THREE.MeshBasicMaterial({ map: texBlood(), transparent: true, depthWrite: false, color: '#ffffff' });
  B3.blob = new THREE.MeshBasicMaterial({ map: texRadial('rgba(0,0,0,.75)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false });
}
function b3Fire(x, z, light) {
  const spr = [0, 1, 2].map(i => { const g = c3Glow(i ? '#ff7a1a' : '#ffd070', 1.6 - i * .3, .8); g.position.set(x + (i - 1) * .4, 1.1 + i * .15, z); B3.scene.add(g); return g; });
  const smoke = c3Glow('#3a3a3a', 3, .0); smoke.material.blending = THREE.NormalBlending; smoke.material.opacity = .35; smoke.position.set(x, 3.2, z); B3.scene.add(smoke);
  let pl = null; if (light) { pl = new THREE.PointLight('#ff7a2a', 2.2, 11, 2); pl.position.set(x, 1.6, z); B3.scene.add(pl); }
  B3.fires.push({ spr, pl, ph: Math.random() * 6 });
}
function b3Blob(m, r) { const s = new THREE.Mesh(c3G('blob', () => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; }), B3.blob); const k = r * 1.55 / m.scale.x; s.scale.set(k, 1, k); s.position.y = .02; s.renderOrder = -1; m.add(s); m.userData.blobM = s; }
/* ---------- characters ---------- */
function b3TakeZ(type) {
  const pool = B3.pool[type] || (B3.pool[type] = []);
  let m = pool.pop();
  if (!m) { m = m3Zombie(type); m.userData.baseSc = m.scale.x; b3Blob(m, type === 'wb' ? .9 : .55); }
  m.rotation.set(0, 0, 0); m.position.y = 0; m.scale.setScalar(m.userData.baseSc);
  m.traverse(o => { if (o.isMesh) o.castShadow = S.gfx !== 'low'; });
  if (m.userData.kk) { const u = m.userData; u.mixer.stopAllAction(); u.cur = null; u.curA = null; u.once = false; u.hold = false; u.lt = undefined; kkPlay(m, u.idle); } m.userData.blobM.visible = true; m.visible = true;
  B3.scene.add(m); return m;
}
function b3PutZ(m) { B3.scene.remove(m); const p = B3.pool[m.userData.ztype] || (B3.pool[m.userData.ztype] = []); if (p.length < 24) p.push(m); else b3Dispose(m); }
function b3Dispose(o) { o.traverse(x => { if (x.isSkinnedMesh && x.skeleton) x.skeleton.dispose(); if (x.isMesh && x.geometry && !C3.cached.has(x.geometry) && !x.isSkinnedMesh) x.geometry.dispose(); }); }
function b3Start() {
  try {
    if (!v3Supported() || !v3Init()) return false;
    b3Scene();
    B3.dying.forEach(d => b3PutZ(d.m)); B3.dying = []; B3.parts.forEach(p => B3.scene.remove(p.s)); B3.parts = [];
    const boss = !!B.cfg.boss; B3.scene.background.set(boss ? '#2a161a' : '#1c2636'); B3.scene.fog.color.set(boss ? '#2a161a' : '#1c2636'); B3.hemi.color.set(boss ? '#d09a90' : '#9ab0d8');
    b3Attach(); b3Resize();
    for (const h of B.heroes) { h.m = m3Hero(h.id); h.m.rotation.y = Math.PI; b3Blob(h.m, .55); B3.scene.add(h.m); h.m3h = h.m.userData.hgt || (HERO3[h.id] || {}).sc * 1.32; }
    B3.lt = 0; return true;
  } catch (e) { console.warn('3D battle off', e); return false; }
}
function b3Attach() { const cv = V3.renderer.domElement, st = stageEl(); if (cv.parentNode !== st) { st.insertBefore(cv, st.firstChild); cv.className = 'b3bat'; return true; } return false; }
function b3Resize() {
  B3.U = B.W / 11; V3.renderer.setSize(B.W, B.H, false); B3.cam.aspect = B.W / Math.max(1, B.H); B3.cam.updateProjectionMatrix();
  // fit the whole street width at the hero line, then look down the street
  const thf = Math.tan(THREE.MathUtils.degToRad(B3.cam.fov / 2)) * B3.cam.aspect, D = 6 / thf + 1, dir = new THREE.Vector3(0, .58, .81).normalize();
  B3.tgt = new THREE.Vector3(0, 0, -6.5); B3.camPos = B3.tgt.clone().addScaledVector(dir, D); B3.cam.position.copy(B3.camPos); B3.cam.lookAt(B3.tgt);
}
function b3Stop() {
  for (const h of B.heroes) if (h.m) { B3.scene.remove(h.m); b3Dispose(h.m); h.m = null; }
  for (const z of B.z) if (z.m) { b3PutZ(z.m); z.m = null; }
  B3.dying.forEach(d => b3PutZ(d.m)); B3.dying = []; B3.parts.forEach(p => B3.scene.remove(p.s)); B3.parts = [];
  B3.proj.forEach(p => B3.scene.remove(p.o)); B3.proj = []; (B3.decals || []).forEach(d => { B3.scene.remove(d.m); d.m.material.dispose(); }); B3.decals = []; B3.rings.forEach(r => B3.scene.remove(r.m)); B3.rings = [];
}
function b3Burst(x, y, z, col, size, life, grow) { const s = c3Glow(col, size, .9); s.position.set(x, y, z); B3.scene.add(s); B3.parts.push({ s, life, l0: life, s0: size, grow }); }
function b3Attack(h, u, p) {
  const w = u.wpn;
  if (w === 'rifle') { u.body.position.z = -.05 * (1 - p); if (p < .35 && u.muzzle) { u.muzzle.getWorldPosition(_b3v); if (!h.muz) { h.muz = 1; b3Burst(_b3v.x, _b3v.y, _b3v.z, '#ffd27a', .5, .06, 0); } } else h.muz = 0; }
  else if (w === 'bow') { u.armL.rotation.x = -1.5; u.armR.rotation.x = -1.5 + Math.min(1, p * 2) * .7; }
  else if (w === 'orb') { u.armL.rotation.x = u.poseL - Math.sin(p * Math.PI) * 1; if (u.orb) u.orb.scale.setScalar(1 + Math.sin(p * Math.PI) * .6); }
  else if (w === 'daggers') { u.armR.rotation.x = u.poseR - Math.sin(p * Math.PI) * 1.3; u.armL.rotation.x = u.poseL - Math.sin(Math.min(1, p * 1.4) * Math.PI) * 1.1; }
  else { const a = p < .35 ? lerp(u.poseR, -2.6, p / .35) : lerp(-2.6, .35, (p - .35) / .65); u.armR.rotation.x = a; }
}
/* ---------- each hero's own shot ---------- */
const B3_PROJ = { redking: ['slash', '#ff6a3a', 20], destroyer: ['orb', '#c07aff', 15], fire: ['orb', '#ff7a1a', 13, 1], knight: ['slash', '#ffd77a', 20], lightning: ['bullet'], shadow: ['dagger', '#c8d0ff', 24], medic: ['orb', '#7dff7a', 15], mountain: ['quake', '#ffb070'], hawk: ['arrow', '#e8d8a0', 24], wind: ['slash', '#7ac8ff', 26] };
const texCrescent = () => c3Tex('crescent', (c, w, h) => { c.strokeStyle = '#fff'; c.lineCap = 'round'; for (const [lw, a] of [[18, .25], [10, .55], [4, 1]]) { c.globalAlpha = a; c.lineWidth = lw; c.beginPath(); c.arc(w / 2, h * .75, w * .36, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); } });
function b3Shot(f) {
  const P = B3_PROJ[f.hid], hh = B.heroes.find(x => x.id === f.hid); if (!P || !hh || !hh.m) return;
  if (P[0] === 'bullet') { if (f.tz && f.tz.m) { const q = f.tz.m.position; b3Burst(q.x, (f.tz.m3h || 1.6) * .6, q.z, '#ffd27a', .5, .12, .6); } if (hh.m.userData.muzzle || true) { const p = hh.m.position; b3Burst(p.x, hh.m3h * .6, p.z - .5, '#ffe9a8', .55, .06, 0); } return; }
  const tz = f.tz, to = tz && tz.m ? tz.m.position.clone().setY((tz.m3h || 1.6) * .55) : new THREE.Vector3(b3X(f.tx), 1, b3Z(f.ty));
  const from = f.sub && tz ? to.clone() : hh.m.position.clone().setY(hh.m3h * .6);
  if (f.sub) { const z0 = B.z.find(z => z.m && Math.hypot(z.x - f.x, z.y - f.y) < 1); if (z0) from.copy(z0.m.position).setY(1); }
  f.p3 = 1;
  if (P[0] === 'quake') { b3Ring(to.x, to.z, P[1]); for (let i = 0; i < 4; i++) b3Burst(to.x + (Math.random() - .5), .3, to.z + (Math.random() - .5), '#8a6a4a', .3, .4, .2); return; }
  let o;
  if (P[0] === 'orb') o = c3Glow(P[1], P[3] ? 1 : .6, 1);
  else if (P[0] === 'slash') { o = new THREE.Sprite(new THREE.SpriteMaterial({ map: texCrescent(), color: P[1], blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); o.scale.set(1.3, 1.3, 1); }
  else if (P[0] === 'dagger') { o = new THREE.Group(); A(o, c3Box(.05, .32, .015), c3M({ color: '#d8e0ea', metalness: .9, roughness: .2 }), 0, 0, 0); A(o, c3Box(.09, .03, .03), c3M({ color: '#3a2a20' }), 0, -.14, 0); o.scale.setScalar(1.4); }
  else { o = new THREE.Group(); A(o, c3Cyl(.012, .012, .8, 4), c3M({ color: '#6a4a2a' }), 0, 0, 0, Math.PI / 2); A(o, c3Cone(.035, .1, 4), c3M({ color: '#c8c8c8', metalness: .7 }), 0, 0, .45, Math.PI / 2); A(o, c3Box(.005, .06, .14), c3M({ color: '#e8e0d0' }), 0, 0, -.36); }
  o.position.copy(from); B3.scene.add(o);
  B3.proj.push({ o, from, to, tz, t: 0, dur: Math.max(.08, from.distanceTo(to) / P[2]), kind: P[0], col: P[1], big: P[3] });
}
function texBlood() { return c3Tex('blood', (c, w, h) => { const R = rng(97); for (let i = 0; i < 26; i++) { const r = i ? 4 + R() * 14 : 38, a = R() * 6.3, d = i ? 18 + R() * 36 : 0; c.fillStyle = i % 3 ? 'rgba(90,8,6,.85)' : 'rgba(60,4,4,.9)'; c.beginPath(); c.ellipse(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, r * (.6 + R() * .4), a, 0, 7); c.fill(); } }); }
function b3Blood(x, z, s) {
  const g = c3G('decal', () => { const p = new THREE.PlaneGeometry(1, 1); p.rotateX(-Math.PI / 2); return p; }), m = new THREE.Mesh(g, B3.bloodM.clone());
  m.position.set(x + (Math.random() - .5) * .3, .025, z - .3); m.rotation.y = Math.random() * 6.3; m.scale.set(s * 1.6, 1, s * 1.6); m.renderOrder = -1; B3.scene.add(m);
  B3.decals.push({ m, t: 0 }); if (B3.decals.length > 28) { const o = B3.decals.shift(); B3.scene.remove(o.m); o.m.material.dispose(); }
}
function b3Ring(x, z, col) { const m = new THREE.Mesh(c3G('ring3', () => { const g = new THREE.RingGeometry(.5, .75, 28); g.rotateX(-Math.PI / 2); return g; }), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .8, depthWrite: false, blending: THREE.AdditiveBlending })); m.position.set(x, .06, z); B3.scene.add(m); B3.rings.push({ m, t: 0 }); }
function b3Proj(dt) {
  for (const p of B3.proj) {
    p.t += dt / p.dur; const k = Math.min(1, p.t);
    if (p.tz && p.tz.m && p.tz.alive) p.to.set(p.tz.m.position.x, (p.tz.m3h || 1.6) * .55, p.tz.m.position.z);
    const arc = p.kind === 'arrow' ? 1.2 : p.kind === 'orb' ? .25 : p.kind === 'dagger' ? .3 : 0;
    p.o.position.lerpVectors(p.from, p.to, k); p.o.position.y += Math.sin(k * Math.PI) * arc;
    if (p.kind === 'arrow') { const nx = _b3v.copy(p.to).sub(p.from); p.o.rotation.set(0, Math.atan2(nx.x, nx.z), 0); p.o.rotateX(-Math.cos(k * Math.PI) * .7); }
    if (p.kind === 'dagger') { p.o.rotation.x += dt * 30; p.o.rotation.y = Math.atan2(p.to.x - p.from.x, p.to.z - p.from.z); }
    if (p.kind === 'slash') p.o.material.rotation = Math.atan2(p.to.x - p.from.x, -(p.to.z - p.from.z)) * .3;
    if (p.kind === 'orb' && Math.random() < .7) b3Burst(p.o.position.x, p.o.position.y, p.o.position.z, p.col, p.big ? .45 : .28, .25, -.2);
    if (k >= 1) { p.done = 1; B3.scene.remove(p.o); b3Burst(p.to.x, p.to.y, p.to.z, p.col || '#fff', p.big ? 1.4 : .8, .3, p.big ? 2.5 : 1.2); }
  }
  B3.proj = B3.proj.filter(p => !p.done);
  for (const d of B3.decals) { d.t += dt; if (d.t > 8) d.m.material.opacity = Math.max(0, 1 - (d.t - 8) / 3); }
  B3.decals = B3.decals.filter(d => { if (d.t > 11) { B3.scene.remove(d.m); d.m.material.dispose(); return false; } return true; });
  for (const r of B3.rings) { r.t += dt; const s = 1 + r.t * 5; r.m.scale.set(s, 1, s); r.m.material.opacity = Math.max(0, .8 - r.t * 1.6); }
  B3.rings = B3.rings.filter(r => { if (r.t > .5) { B3.scene.remove(r.m); r.m.material.dispose(); return false; } return true; });
}
/* ---------- per-frame update ---------- */
function b3Frame() {
  const tn = performance.now(), rdt = B3.lt ? Math.min(.05, (tn - B3.lt) / 1000) : .016; B3.lt = tn;
  const dt = rdt * (B.done ? .6 : S.spd); B3.t += dt; const t = B3.t;
  if (b3Attach()) b3Resize();
  for (const h of B.heroes) {
    const m = h.m; if (!m) continue; const u = m.userData;
    m.position.set(b3X(h.x), 0, b3Z(h.y));
    if (!h.alive) { if (u.kk) { if (!h.deadT) kkOnce(m, u.death, 1, true); kkTick(m, dt); } else { m.rotation.x = Math.min(Math.PI / 2, (h.deadT || 0) * 4); m.position.y = .08; } h.deadT = (h.deadT || 0) + dt; u.blobM.visible = false; continue; }
    const tg = nearestZ(); let ry = Math.PI;
    if (tg && tg.m) ry = Math.atan2(tg.m.position.x - m.position.x, tg.m.position.z - m.position.z);
    let d = ry - m.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); m.rotation.y += d * Math.min(1, rdt * 10);
    if (u.kk) {
      if (h.shotT > 0 && !h.atkOn) { h.atkOn = 1; kkOnce(m, u.atk, 1.5); } if (h.shotT <= 0) h.atkOn = 0; if (h.shotT > 0) h.shotT -= dt;
      if (h.castT > 0 && !h.castFx) kkOnce(m, u.cast, 1.2);
      m3Walk(m, t, 1, false);
    } else {
    m3Walk(m, t, 1, false); u.body.position.y = Math.sin(t * 2.2 + h.slot) * .012; u.body.position.z = 0; if (u.orb) u.orb.scale.setScalar(1);
    if (h.shotT > 0) { h.shotT -= dt; b3Attack(h, u, clamp(1 - h.shotT / .22, 0, 1)); }
    }
    if (h.castT > 0) {
      if (!h.castFx) { h.castFx = 1; b3Burst(m.position.x, 1.2, m.position.z, (HERO3[h.id] || {}).fx || '#fff', 1.2, .6, 3.5); }
      h.castT -= dt; const p = clamp(1 - h.castT / .7, 0, 1), s = Math.sin(p * Math.PI); if (!u.kk) { u.body.position.y = s * .25; u.armL.rotation.x = u.armR.rotation.x = -2.8 * s; }
    } else h.castFx = 0;
  }
  for (const z of B.z) {
    if (!z.m) { if (!z.alive) continue; z.m = b3TakeZ(z.type); z.m3h = z.m.userData.hgt || ZOMB3[z.type].sc * 1.22; }
    if (!z.alive) { b3Blood(z.m.position.x, z.m.position.z, (z.m3h || 2) * .45); z.m.userData.blobM.visible = false; if (z.m.userData.kk) kkOnce(z.m, z.m.userData.death, 1.2, true); B3.dying.push({ m: z.m, t: 0 }); z.m = null; continue; }
    const m = z.m, u = m.userData, Z = ZOMB3[z.type];
    m.position.set(b3X(z.x), 0, b3Z(z.y) - B3_ZOFF[z.type]);
    const stopY = z.T.range ? B.lineY - 170 : B.lineY - z.T.r + 4, moving = z.y < stopY - .5 && z.stun <= 0;
    m3Walk(m, t + z.ph, z.T.spd / 28, moving); if (!u.kk) u.chest.rotation.x = Z.hunch;
    m.rotation.y = z.stun > 0 ? Math.sin(t * 9 + z.ph) * .3 : Math.sin(t * 2 + z.ph) * .12;
    if (z.acd > (z.pacd || 0) + .15) z.atkT = .35; z.pacd = z.acd;
    if (z.atkT > 0 && u.kk) { if (!z.atkOn) { z.atkOn = 1; kkOnce(m, u.atk, 1.3); } z.atkT -= dt; } else if (z.atkT > 0) { z.atkT -= dt; const s = Math.sin(clamp(1 - z.atkT / .35, 0, 1) * Math.PI); u.armL.rotation.x = u.armR.rotation.x = -1.35 + s * 1.2; u.chest.rotation.x = Z.hunch + s * .35; }
    if (z.atkT <= 0) z.atkOn = 0; m.scale.setScalar(u.baseSc * (z.flash > 0 ? 1.06 : 1));
    if (u.kk && z.flash > 0 && !z.atkT && (z.hitCd || 0) < B3.t && z.type !== 'wb') { z.hitCd = B3.t + .7; kkOnce(m, 'Hit_A', 1.7); }
  }
  for (const d of B3.dying) { d.t += dt; if (d.m.userData.kk) { kkTick(d.m, dt); if (d.t > 1.3) d.m.position.y = -(d.t - 1.3) * .5 * d.m.userData.hgt; } else { d.m.rotation.x = -Math.min(Math.PI / 2, d.t * 4); if (d.t > .9) d.m.position.y = -(d.t - .9) * .5 * d.m.userData.baseSc; } }
  B3.dying = B3.dying.filter(d => { if (d.t > 2.2) { b3PutZ(d.m); return false; } return true; });
  for (const f of B.fx) {
    if (f.lit || f.t < 0) continue;
    if (f.k === 'tr' && f.hid) { f.lit = 1; b3Shot(f); }
    else if (f.k === 'boom') { f.lit = 1; const x = b3X(f.x), z = b3Z(f.y); B3.flash.position.set(x, 1.5, z); B3.flash.intensity = f.small ? 1.5 : 5; b3Burst(x, .8, z, '#ffb050', f.r / B3.U * 1.4, .45, f.r / B3.U * 2); }
    else if (f.k === 'heal') { f.lit = 1; b3Burst(b3X(f.x), 1, b3Z(f.y), '#7dff7a', .8, .6, 1.6); }
  }
  B3.flash.intensity *= Math.pow(.003, rdt); b3Proj(rdt);
  for (const p of B3.parts) { p.life -= rdt; const k = 1 - p.life / p.l0; const sc = p.s0 + k * p.grow; p.s.scale.set(sc, sc, 1); p.s.material.opacity = Math.max(0, p.life / p.l0) * .9; }
  B3.parts = B3.parts.filter(p => { if (p.life <= 0) { B3.scene.remove(p.s); p.s.material.dispose(); return false; } return true; });
  for (const f of B3.fires) { const k = .8 + Math.sin(t * 11 + f.ph) * .12 + Math.random() * .1; f.spr.forEach((s, i) => s.scale.set(s.userData.b * k, s.userData.b * k * 1.3, 1)); if (f.pl) f.pl.intensity = 1.8 + k; }
  const ap = B3.ash.geometry.attributes.position; for (let i = 0; i < ap.count; i++) { let y = ap.getY(i) - rdt * .5; if (y < 0) y = 10; ap.setY(i, y); ap.setX(i, ap.getX(i) + Math.sin(t + i) * rdt * .2); } ap.needsUpdate = true;
  B3.cam.position.copy(B3.camPos); if (B.shake > 0) { B3.cam.position.x += (Math.random() - .5) * .3; B3.cam.position.y += (Math.random() - .5) * .3; }
  fxRender(B3.scene, B3.cam, B.W, B.H, B.cfg.boss ? 'boss' : 'battle');
}
/* ---------- 2D overlay: bars, numbers, shots ---------- */
function b3Draw() {
  b3Frame();
  const c = B.ctx, W = B.W, Hh = B.H; c.setTransform(B.dpr, 0, 0, B.dpr, 0, 0); c.clearRect(0, 0, W, Hh);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.direction = isRTL() ? 'rtl' : 'ltr';
  if (B.buff > 0) { const g = c.createLinearGradient(0, B.lineY, 0, Hh); g.addColorStop(0, '#cf6a2c00'); g.addColorStop(1, '#cf6a2c30'); c.fillStyle = g; c.fillRect(0, B.lineY, W, Hh - B.lineY); }
  for (const z of B.z) {
    if (!z.alive || !z.m || z.y < -5) continue; const p = z.m.position;
    if (z.hp < z.maxhp && z.type !== 'wb') { const [x, y] = b3PW(p.x, z.m3h + .25, p.z), w = clamp(b3PPU(p.x, z.m3h, p.z) * (z.type === 'boss' ? 1.4 : .9), 16, 70); c.fillStyle = '#000a'; c.fillRect(x - w / 2, y - 2, w, 4); c.fillStyle = z.type === 'boss' ? '#e2513f' : '#c9453a'; c.fillRect(x - w / 2, y - 2, w * Math.max(0, z.hp / z.maxhp), 4); }
    if (z.stun > 0) { const [x, y] = b3PW(p.x, z.m3h + .55, p.z); c.font = '14px serif'; c.fillText('💫', x, y); }
  }
  for (const h of B.heroes) {
    if (!h.alive || !h.m) continue; const p = h.m.position, [x, y] = b3PW(p.x, h.m3h + .15, p.z);
    c.fillStyle = '#000a'; c.fillRect(x - 20, y - 3, 40, 5); c.fillStyle = '#64b66e'; c.fillRect(x - 20, y - 3, 40 * h.hp / h.maxhp, 5);
    if (h.shield > 0) { const [fx, fy] = b3PW(p.x, .05, p.z), r = b3PPU(p.x, 0, p.z) * .7; c.strokeStyle = '#5aa6d6'; c.lineWidth = 2.5; c.globalAlpha = .6 + Math.sin(B.t * 8) * .2; c.beginPath(); c.ellipse(fx, fy, r, r * .45, 0, 0, 7); c.stroke(); c.globalAlpha = 1; }
    if (h.rapid > 0) { const [fx, fy] = b3PW(p.x, .05, p.z), r = b3PPU(p.x, 0, p.z) * .55; c.strokeStyle = '#f1b23c'; c.lineWidth = 2; c.beginPath(); c.ellipse(fx, fy, r, r * .45, 0, B.t * 10, B.t * 10 + 2); c.stroke(); }
  }
  for (const f of B.fx) {
    if (f.t < 0) continue; const pr = f.t / f.life;
    if (f.k === 'tr' && f.p3 && f.w < 5) continue;
    if (f.k === 'arc') { const a = f.fz && f.fz.m ? b3PW(f.fz.m.position.x, 1, f.fz.m.position.z) : b3PW(b3X(f.x), 1, b3Z(f.y)), bt = f.tz && f.tz.m ? b3PW(f.tz.m.position.x, 1, f.tz.m.position.z) : b3PW(b3X(f.tx), 1, b3Z(f.ty)); c.globalAlpha = 1 - pr; for (const [lw, col] of [[6, '#9a5aff66'], [2, '#f0d8ff']]) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(a[0], a[1]); for (let i = 1; i < 6; i++) c.lineTo(lerp(a[0], bt[0], i / 6) + (Math.random() - .5) * 12, lerp(a[1], bt[1], i / 6) + (Math.random() - .5) * 12); c.lineTo(bt[0], bt[1]); c.stroke(); } c.globalAlpha = 1; continue; }
    if (f.k === 'tr') {
      const hh = B.heroes.find(x => x.id === f.hid), a = hh && hh.m ? b3PW(hh.m.position.x, hh.m3h * .62, hh.m.position.z) : b3PW(b3X(f.x), 1.2, b3Z(f.y));
      const zt = f.tz && f.tz.m ? f.tz.m.position : null, bt = zt ? b3PW(zt.x, (f.tz.m3h || 1.5) * .6, zt.z) : b3PW(b3X(f.tx), 1, b3Z(f.ty));
      const col = (HERO3[f.hid] || {}).fx || f.col; c.globalAlpha = 1 - pr; c.strokeStyle = col; c.lineCap = 'round';
      c.lineWidth = f.w * 2.6; c.globalAlpha = (1 - pr) * .35; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(bt[0], bt[1]); c.stroke();
      c.lineWidth = f.w; c.globalAlpha = 1 - pr; c.strokeStyle = '#fff8e0'; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(bt[0], bt[1]); c.stroke();
      c.fillStyle = col; c.beginPath(); c.arc(bt[0], bt[1], 3 + f.w, 0, 7); c.fill(); c.globalAlpha = 1;
    }
    else if (f.k === 'txt') { const [x, y] = b3PW(b3X(f.x), 2.1, b3Z(f.y)); c.globalAlpha = 1 - pr * pr; c.font = `800 ${f.big ? 18 : 13}px Changa, sans-serif`; c.lineWidth = 3; c.strokeStyle = '#000'; c.strokeText(f.s, x, y - pr * 30); c.fillStyle = f.col; c.fillText(f.s, x, y - pr * 30); c.globalAlpha = 1; }
    else if (f.k === 'die') { const [x, y] = b3PW(b3X(f.x), .6, b3Z(f.y)), r = b3PPU(b3X(f.x), .6, b3Z(f.y)) * .9; c.globalAlpha = 1 - pr; c.fillStyle = '#6a1a12'; for (let i = 0; i < 7; i++) { const a = i * .9; c.beginPath(); c.arc(x + Math.cos(a) * pr * r, y + Math.sin(a) * pr * r * .6 - pr * 10, 3.5 * (1 - pr) + 1, 0, 7); c.fill(); } c.globalAlpha = 1; }
    else if (f.k === 'boom') { const wx = b3X(f.x), wz = b3Z(f.y), [x, y] = b3PW(wx, .3, wz), rr = f.r / B3.U * b3PPU(wx, .3, wz) * (.4 + pr * .6); c.globalAlpha = (1 - pr) * .8; const g = c.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, '#fff3c0'); g.addColorStop(.4, '#f1b23c'); g.addColorStop(1, '#cf6a2c00'); c.fillStyle = g; c.beginPath(); c.ellipse(x, y, rr, rr * .6, 0, 0, 7); c.fill(); c.globalAlpha = 1; }
    else if (f.k === 'spit') { const a = b3PW(b3X(f.x), 1.6, b3Z(f.y)), bt = b3PW(b3X(f.tx), 1.2, b3Z(f.ty)), x = lerp(a[0], bt[0], pr), y = lerp(a[1], bt[1], pr) - Math.sin(pr * Math.PI) * 50; c.fillStyle = '#8fdf3a'; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); c.fillStyle = '#8fdf3a55'; c.beginPath(); c.arc(x, y, 10, 0, 7); c.fill(); }
    else if (f.k === 'heal') { const wx = b3X(f.x), wz = b3Z(f.y), [x, y] = b3PW(wx, .05, wz), r = b3PPU(wx, 0, wz) * (.5 + pr * .6); c.globalAlpha = 1 - pr; c.strokeStyle = '#64ff7a'; c.lineWidth = 3; c.beginPath(); c.ellipse(x, y, r, r * .45, 0, 0, 7); c.stroke(); c.globalAlpha = 1; }
    else if (f.k === 'claw') { const [x, y] = b3PW(b3X(f.x), 1.2, b3Z(f.y)); c.globalAlpha = 1 - pr; c.strokeStyle = '#ff5a3f'; c.lineWidth = 3; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(x + i * 8 - 8, y - 8); c.lineTo(x + i * 8 + 8, y + 8); c.stroke(); } c.globalAlpha = 1; }
  }
  const fog = c.createLinearGradient(0, 0, 0, 50); fog.addColorStop(0, '#0b0e10cc'); fog.addColorStop(1, '#0b0e1000'); c.fillStyle = fog; c.fillRect(0, 0, W, 50);
  c.font = '700 12px Changa, sans-serif'; c.fillStyle = '#c8d0d8'; c.direction = 'ltr';
  c.textAlign = 'left'; c.fillText(`⏱ ${Math.max(0, Math.ceil(B.limit - B.t))}`, 10, 14);
  c.textAlign = 'right'; c.fillText(B.cfg.boss ? `💥 ${fmt(B.dealt)}` : `🧟 ${B.kills}`, W - 10, 14);
  if (B.cfg.boss) { const z = B.z.find(z => z.type === 'wb'); if (z) { const w = W * .7, x = (W - w) / 2; c.fillStyle = '#000a'; c.fillRect(x, 26, w, 8); c.fillStyle = '#e2513f'; c.fillRect(x, 26, w * Math.max(0, z.hp / z.maxhp), 8); } }
}
window.B3DBG = { fx: on => { FX.ok = !!on; }, bloom: v => { FX.force = v; }, fight: (sc, waves, boss, squad) => { if (squad) { squad.forEach(id => { if (!S.heroes[id]) S.heroes[id] = { lv: 30, st: 3, sh: 0 }; }); S.squad = squad; } startBattle({ title: 'test', waves, sc, boss, onEnd: () => null }); }, on: () => !!(B && B.m3), zombies: () => B ? B.z.filter(z => z.m).length : 0, heroes: () => B ? B.heroes.filter(h => h.m).length : 0, calls: () => V3.renderer.info.render.calls, texs: () => { const set = new Map(); B3.scene.traverse(o => { const ms = o.material ? [].concat(o.material) : []; for (const m of ms) for (const k of ['map', 'emissiveMap']) if (m[k]) set.set(m[k].uuid, (o.name || o.type) + ':' + (m[k].image && m[k].image.width)); }); return [set.size, [...set.values()].slice(0, 60).join(',')]; }, mem: () => { const i = V3.renderer.info; return `geo ${i.memory.geometries} tex ${i.memory.textures} prog ${i.programs.length} heap ${(performance.memory ? performance.memory.usedJSHeapSize / 1e6 : 0).toFixed(0)}MB`; } };
