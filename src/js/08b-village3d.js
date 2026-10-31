/* ================= base: living 3D village (three.js) =================
 * A tilted perspective camera looks down on a walled compound. Ground, walls, towers and props are
 * real 3D geometry lit by a dusk sun and flickering torches; buildings are the painted art standing
 * on the ground as camera-facing billboards. Survivors walk the yard, guards shoot zombies outside
 * the walls, fires burn and smoke rises. HTML hotspots follow each building for taps and bubbles.
 */
const V3 = { inited: false, failed: false };
const WALL = 19.5;
const V3POS = {
  hq: [0.0, -2.3, 11.09], radar: [0.0, -14.49, 6.07], lab: [-7.59, -13.34, 6.07], hospital: [7.59, -13.34, 6.07],
  farm1: [-14.26, -11.96, 6.07], saw1: [14.26, -11.96, 6.07], farm2: [-14.49, -4.14, 6.07], saw2: [14.49, -4.14, 6.07],
  farm3: [-14.49, 3.45, 6.07], saw3: [14.49, 3.45, 6.07], barracks: [-7.59, 7.13, 6.6], tavern: [7.59, 7.13, 7.13],
  mine3: [-14.26, 11.04, 6.07], oil2: [14.26, 11.04, 6.07], mine1: [-8.05, 14.72, 6.07], warehouse: [0.0, 11.04, 6.07], mine2: [8.05, 14.72, 6.07],
  oil1: [-14.49, 16.79, 5.54], wall: [14.49, 16.79, 6.07],
};
function v3Supported() {
  if (V3.failed || typeof THREE === 'undefined') return false;
  if (V3.sup !== undefined) return V3.sup;
  try { const c = document.createElement('canvas'); V3.sup = !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { V3.sup = false; }
  return V3.sup;
}
/* ---------- procedural textures ---------- */
function canvasTex(w, h, draw, rep) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const tx = new THREE.CanvasTexture(cv); tx.encoding = THREE.sRGBEncoding; tx.anisotropy = 4;
  if (rep) { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(rep, rep); }
  return tx;
}
function texDirt() {
  return canvasTex(512, 512, (c, w, h) => {
    const R = rng(11); c.fillStyle = '#3a2f24'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const x = R() * w, y = R() * h, r = 4 + R() * 26; c.fillStyle = ['#43362a', '#2f261d', '#4a3c2c', '#35302a', '#2b2b22'][i % 5] + '88'; c.beginPath(); c.ellipse(x, y, r, r * (.5 + R() * .5), R() * 3, 0, 7); c.fill(); }
    for (let i = 0; i < 160; i++) { const x = R() * w, y = R() * h; c.fillStyle = R() < .5 ? '#56503f' : '#4a4537'; c.beginPath(); c.ellipse(x, y, 2 + R() * 4, 1.5 + R() * 3, R() * 3, 0, 7); c.fill(); }
    for (let i = 0; i < 70; i++) { const x = R() * w, y = R() * h; c.strokeStyle = '#4f5a2c99'; c.lineWidth = 1.2; for (let j = 0; j < 6; j++) { c.beginPath(); c.moveTo(x + j * 2, y); c.lineTo(x + j * 2 + (R() - .5) * 6, y - 5 - R() * 6); c.stroke(); } }
  }, 10);
}
function texStone() {
  return canvasTex(512, 512, (c, w, h) => {
    const R = rng(5); c.fillStyle = '#2a2826'; c.fillRect(0, 0, w, h);
    const s = 64;
    for (let y = 0; y < h; y += s) for (let x = -(y / s % 2) * s / 2; x < w; x += s) {
      const sh = 70 + R() * 30; c.fillStyle = `rgb(${sh},${sh - 4},${sh - 10})`; c.fillRect(x + 3, y + 3, s - 6, s - 6);
      c.fillStyle = '#ffffff10'; c.fillRect(x + 3, y + 3, s - 6, 5); c.fillStyle = '#0000002a'; c.fillRect(x + 3, y + s - 9, s - 6, 6);
      if (R() < .35) { c.strokeStyle = '#1b1a18aa'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + R() * s, y + 4); c.lineTo(x + R() * s, y + s - 4); c.stroke(); }
      if (R() < .25) { c.fillStyle = '#3a4a2a88'; c.beginPath(); c.ellipse(x + R() * s, y + R() * s, 8, 4, 0, 0, 7); c.fill(); }
    }
  }, 5);
}
function texWall() {
  return canvasTex(256, 128, (c, w, h) => {
    const R = rng(3); c.fillStyle = '#3d3a36'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 26) for (let x = -(y / 26 % 2) * 22; x < w; x += 44) { const sh = 78 + R() * 34; c.fillStyle = `rgb(${sh},${sh - 4},${sh - 10})`; c.fillRect(x + 2, y + 2, 40, 22); c.fillStyle = '#0003'; c.fillRect(x + 2, y + 18, 40, 6); }
  }, 1);
}
function texRadial(inner, outer) { return canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(1, outer); c.fillStyle = g; c.fillRect(0, 0, w, h); }); }
function texPerson(col, skin, hat) {
  return canvasTex(64, 128, (c) => {
    c.fillStyle = '#1a1612'; c.fillRect(22, 92, 8, 30); c.fillRect(34, 92, 8, 30);
    c.fillStyle = col; c.beginPath(); c.moveTo(16, 50); c.lineTo(48, 50); c.lineTo(46, 96); c.lineTo(18, 96); c.fill();
    c.fillStyle = '#2a241c'; c.fillRect(16, 76, 32, 5);
    c.fillStyle = col; c.fillRect(10, 52, 8, 32); c.fillRect(46, 52, 8, 32);
    c.fillStyle = skin; c.beginPath(); c.arc(32, 38, 11, 0, 7); c.fill();
    c.fillStyle = hat; c.beginPath(); c.arc(32, 34, 12, Math.PI, 0); c.fill(); c.fillRect(19, 33, 26, 4);
    c.fillStyle = '#222'; c.fillRect(50, 40, 3, 44);
  });
}
/* ---------- scene ---------- */
function v3Init() {
  if (V3.inited) return true;
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#141a22'); scene.fog = new THREE.FogExp2('#18202a', .0095);
    const camera = new THREE.PerspectiveCamera(30, 1, 1, 400);
    Object.assign(V3, { renderer, scene, camera, inited: true, tgt: new THREE.Vector3(0, 0, 2), dist: 78, az: Math.PI / 4, el: .92, vel: { x: 0, z: 0 }, anim: null, t: 0, objs: {}, fx: [], units: [], zombies: [], torches: [], shots: [] });
    // lights
    scene.add(new THREE.HemisphereLight('#8a9cc0', '#3a2a1a', .95));
    const sun = new THREE.DirectionalLight('#ffb27a', 1.05); sun.position.set(-30, 40, -18); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 120; sun.shadow.bias = -.0008;
    scene.add(sun); V3.sun = sun;
    // ground
    const dirt = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshStandardMaterial({ map: texDirt(), roughness: 1 }));
    dirt.material.map.repeat.set(26, 26); dirt.rotation.x = -Math.PI / 2; dirt.receiveShadow = true; scene.add(dirt);
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(WALL * 2, WALL * 2), new THREE.MeshStandardMaterial({ map: texStone(), roughness: .95 }));
    yard.rotation.x = -Math.PI / 2; yard.position.y = .02; yard.receiveShadow = true; scene.add(yard);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 50), new THREE.MeshStandardMaterial({ color: '#2a2219', roughness: 1 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, .03, WALL + 25); road.receiveShadow = true; scene.add(road);
    V3.shadowTex = texRadial('rgba(0,0,0,.7)', 'rgba(0,0,0,0)');
    V3.fireTex = texRadial('rgba(255,236,170,1)', 'rgba(255,90,20,0)');
    V3.smokeTex = texRadial('rgba(120,120,120,.55)', 'rgba(80,80,80,0)');
    V3.glowTex = texRadial('rgba(255,170,80,.55)', 'rgba(255,120,40,0)');
    v3Walls(); v3Props();
    V3.lockTex = canvasTex(128, 128, c => { c.font = '90px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🔒', 64, 70); });
    v3Embers(); v3Units();
    return true;
  } catch (e) { console.warn('3d', e); V3.failed = true; return false; }
}
function v3Box(w, h, d, mat, x, y, z, ry) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); if (ry) m.rotation.y = ry; m.castShadow = m.receiveShadow = true; V3.scene.add(m); return m; }
function v3Walls() {
  const tex = texWall(); const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: .9, color: '#c9c0b4' });
  const mat2 = new THREE.MeshStandardMaterial({ color: '#57524b', roughness: .9 });
  const H = 2.4, T = .9, gate = 2.6;
  const seg = (x1, z1, x2, z2) => { const len = Math.hypot(x2 - x1, z2 - z1), m = v3Box(len, H, T, mat, (x1 + x2) / 2, H / 2, (z1 + z2) / 2, -Math.atan2(z2 - z1, x2 - x1)); m.material = mat.clone(); m.material.map = tex.clone(); m.material.map.needsUpdate = true; m.material.map.repeat.set(len / 3, 1); m.material.map.wrapS = THREE.RepeatWrapping;
    for (let i = .6; i < len - .4; i += 1.2) { const f = i / len; v3Box(.6, .5, T + .1, mat2, x1 + (x2 - x1) * f, H + .25, z1 + (z2 - z1) * f, -Math.atan2(z2 - z1, x2 - x1)); } };
  seg(-WALL, -WALL, WALL, -WALL); seg(-WALL, -WALL, -WALL, WALL); seg(WALL, -WALL, WALL, WALL);
  seg(-WALL, WALL, -gate, WALL); seg(gate, WALL, WALL, WALL);
  const towerMat = new THREE.MeshStandardMaterial({ map: tex, roughness: .9, color: '#b7aea2' });
  const tower = (x, z, h) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.45, h, 10), towerMat); m.position.set(x, h / 2, z); m.castShadow = m.receiveShadow = true; V3.scene.add(m);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.4, .5, 10), mat2); top.position.set(x, h + .25, z); top.castShadow = true; V3.scene.add(top);
    for (let a = 0; a < 8; a++) v3Box(.45, .5, .45, mat2, x + Math.cos(a / 8 * Math.PI * 2) * 1.4, h + .75, z + Math.sin(a / 8 * Math.PI * 2) * 1.4);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.6, 10), new THREE.MeshStandardMaterial({ color: '#6b2a20', roughness: .8 })); roof.position.set(x, h + 1.9, z); roof.castShadow = true; V3.scene.add(roof);
    v3Torch(x, h + .9, z + 1.5, true);
  };
  tower(-WALL, -WALL, 4.2); tower(WALL, -WALL, 4.2); tower(-WALL, WALL, 4.2); tower(WALL, WALL, 4.2); tower(-gate - .6, WALL, 4.8); tower(gate + .6, WALL, 4.8);
  V3.towers = [[-WALL, -WALL], [WALL, -WALL], [-WALL, WALL], [WALL, WALL], [-gate - .6, WALL], [gate + .6, WALL]];
  // gate doors (open)
  const wood = new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: .9 });
  v3Box(.25, 2.2, 2.2, wood, -gate + .2, 1.1, WALL + 1.2, .5); v3Box(.25, 2.2, 2.2, wood, gate - .2, 1.1, WALL + 1.2, -.5);
  // sandbags at the gate
  const bag = new THREE.MeshStandardMaterial({ color: '#7a6a48', roughness: 1 });
  for (let i = -3; i <= 3; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(.45, 8, 6), bag); m.scale.set(1.3, .55, .8); m.position.set(i * .9, .25, WALL + 4.4 + (i % 2) * .15); m.castShadow = true; V3.scene.add(m); }
}
function v3Torch(x, y, z, light) {
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: V3.fireTex, color: '#ffd090', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  spr.position.set(x, y, z); spr.scale.set(1, 1.4, 1); V3.scene.add(spr);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: V3.glowTex, color: '#ff8a3a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .35 }));
  glow.position.set(x, y, z); glow.scale.set(4, 4, 1); V3.scene.add(glow);
  let pl = null; if (light && V3.torches.filter(t => t.pl).length < 6) { pl = new THREE.PointLight('#ff8a3a', 1.4, 16, 2); pl.position.set(x, y + .4, z); V3.scene.add(pl); }
  V3.torches.push({ spr, glow, pl, ph: Math.random() * 6 });
}
function v3Props() {
  const R = rng(21), dark = new THREE.MeshStandardMaterial({ color: '#2a2420', roughness: 1 }), rust = new THREE.MeshStandardMaterial({ color: '#5a3a28', roughness: .8, metalness: .2 }), crate = new THREE.MeshStandardMaterial({ color: '#6a4a2a', roughness: .9 }), ruin = new THREE.MeshStandardMaterial({ color: '#4a4640', roughness: 1 });
  const out = () => { let x, z; do { x = (R() - .5) * 120; z = (R() - .5) * 120; } while (Math.abs(x) < WALL + 4 && Math.abs(z) < WALL + 6); return [x, z]; };
  for (let i = 0; i < 40; i++) { // dead trees
    const [x, z] = out(); const h = 2 + R() * 2.5; const tr = new THREE.Mesh(new THREE.CylinderGeometry(.08, .18, h, 5), dark); tr.position.set(x, h / 2, z); tr.castShadow = true; V3.scene.add(tr);
    for (let b = 0; b < 3; b++) { const br = new THREE.Mesh(new THREE.CylinderGeometry(.03, .07, 1.2, 4), dark); br.position.set(x, h * (.5 + b * .15), z); br.rotation.set(R() * 1.2 - .6, R() * 6, .8 + R() * .6); br.castShadow = true; V3.scene.add(br); }
  }
  for (let i = 0; i < 26; i++) { const [x, z] = out(); const w = 2 + R() * 4, h = 1 + R() * 3.5; v3Box(w, h, .6 + R(), ruin, x, h / 2, z, R() * 3); if (R() < .5) v3Box(w * .5, h * .6, .5, ruin, x + 1, h * .3, z + 1, R() * 3); }
  for (let i = 0; i < 10; i++) { const [x, z] = out(); const car = v3Box(2.6, .9, 1.3, rust, x, .45, z, R() * 3); v3Box(1.4, .6, 1.2, rust, x, 1.1, z, car.rotation.y); }
  // crates & barrels in the yard corners
  const spots = [[-15, -15], [15, -15], [-15, 16], [3.5, 15], [-3.5, 15], [16, 0], [-16, 0]];
  spots.forEach(([x, z], i) => { v3Box(.9, .9, .9, crate, x, .45, z, i); v3Box(.8, .8, .8, crate, x + .9, .4, z + .2, i + 1); const b = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .9, 10), rust); b.position.set(x + .3, .45, z + 1); b.castShadow = true; V3.scene.add(b); });
  // braziers along the road and around the HQ
  [[-2.6, 13], [2.6, 13], [-5.5, 2.5], [5.5, 2.5], [-2.6, 20], [2.6, 20]].forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(.35, .2, 1, 8), dark); p.position.set(x, .5, z); p.castShadow = true; V3.scene.add(p); v3Torch(x, 1.25, z, true); });
}
function v3Embers() {
  const n = 160, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), spd = [];
  for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5) * 40; pos[i * 3 + 1] = Math.random() * 14; pos[i * 3 + 2] = (Math.random() - .5) * 40; spd.push(.4 + Math.random() * .9); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffa04a', size: .22, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false }));
  V3.scene.add(pts); V3.embers = { pts, pos, spd, n };
}
function v3Units() {
  const looks = [['#4a5a3a', '#c99a72', '#3a4a2a'], ['#5a3a2a', '#b37a52', '#2a2a2a'], ['#3a4a5a', '#d8a578', '#5a1f1f'], ['#5a5040', '#8a5a3a', '#2a3a2a'], ['#3a3a3a', '#c99a72', '#7a1f22']];
  const way = () => { const pts = [[-10, -7], [10, -7], [-10, 2], [10, 2], [-3.5, 9], [3.5, 9], [0, 16], [-11, 13], [11, 13], [-4.5, -10], [4.5, -10]]; return pts[Math.floor(Math.random() * pts.length)]; };
  for (let i = 0; i < 9; i++) {
    const L = looks[i % looks.length], tx = [texPerson(L[0], L[1], L[2])];
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx[0], transparent: true, alphaTest: .4 })); s.scale.set(.9, 1.8, 1); s.center.set(.5, 0);
    const w = way(); s.position.set(w[0], 0, w[1]); V3.scene.add(s); V3.units.push({ s, to: way(), spd: 1.3 + Math.random() * .8, ph: Math.random() * 6, wait: Math.random() * 3 });
  }
  // guards on the wall towers
  for (const [x, z] of [[-WALL, WALL], [WALL, WALL], [-WALL, -WALL], [WALL, -WALL]]) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texPerson('#3a4048', '#c99a72', '#2d3236'), transparent: true, alphaTest: .4 })); s.scale.set(.7, 1.4, 1); s.center.set(.5, 0); s.position.set(x, 4.7, z); V3.scene.add(s); }
}
function v3SpawnZombie() {
  const img = artImg(Math.random() < .3 ? 'z_run' : 'z_w'); if (!artReady(img)) return;
  const tx = new THREE.Texture(img); tx.encoding = THREE.sRGBEncoding; tx.needsUpdate = true;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, alphaTest: .3, color: '#c8c8c8' }));
  const a = Math.random() * Math.PI * 2, r = 34 + Math.random() * 10; const h = 1.9;
  s.scale.set(h * img.naturalWidth / img.naturalHeight, h, 1); s.center.set(.5, 0); s.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  V3.scene.add(s); V3.zombies.push({ s, spd: .8 + Math.random() * .8, hp: 2 + Math.floor(Math.random() * 3), ph: Math.random() * 6, dead: 0 });
}
/* ---------- buildings ---------- */
function v3Billboard(key, size) {
  const img = artImg(key); if (!artReady(img)) return null;
  const tx = new THREE.Texture(img); tx.encoding = THREE.sRGBEncoding; tx.anisotropy = 4; tx.needsUpdate = true;
  const h = size * img.naturalHeight / img.naturalWidth;
  const geo = new THREE.PlaneGeometry(size, h); geo.translate(0, h / 2, 0);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tx, transparent: true, alphaTest: .35, depthWrite: true }));
  mesh.userData.h = h; return mesh;
}
function v3SyncBuildings() {
  for (const p of PLOTS) {
    const [x, z, size] = V3POS[p.k], b = S.b[p.k], locked = hqLv() < p.u, q = S.builds.find(r => r.k === p.k);
    const state = locked ? 'locked' : (!b.lv && !q) ? 'empty' : 'built';
    let o = V3.objs[p.k];
    if (!o) {
      o = V3.objs[p.k] = { group: new THREE.Group(), state: '', x, z, size };
      o.group.position.set(x, .05, z); V3.scene.add(o.group);
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.15, size * .85), new THREE.MeshBasicMaterial({ map: V3.shadowTex, transparent: true, depthWrite: false }));
      sh.rotation.x = -Math.PI / 2; sh.position.y = .02; o.group.add(sh);
      o.group.add(new THREE.Group());
    }
    if (o.state !== state || !o.mesh) {
      if (o.mesh) { o.group.remove(o.mesh); o.mesh = null; }
      if (o.lock) { o.group.remove(o.lock); o.lock = null; }
      const m = v3Billboard('b_' + p.t, size);
      if (m) {
        if (state === 'locked') { m.material.color.set('#3a3a3a'); m.material.opacity = .55; m.material.alphaTest = .5; }
        if (state === 'empty') { m.material.color.set('#8a8a8a'); m.material.opacity = .5; }
        o.group.add(m); o.mesh = m; o.state = state;
      }
      if (state === 'locked') { const l = new THREE.Sprite(new THREE.SpriteMaterial({ map: V3.lockTex, transparent: true, depthTest: false })); l.scale.set(1.6, 1.6, 1); l.position.y = size * .45; o.group.add(l); o.lock = l; }
    }
    o.busy = !!q;
    if (o.busy && !o.scaf) {
      const wood = new THREE.MeshStandardMaterial({ color: '#8a6a40', roughness: 1 }), g = new THREE.Group(), s2 = size * .42, hh = (o.mesh ? o.mesh.userData.h : size) * .8;
      for (const [dx, dz] of [[-s2, -s2], [s2, -s2], [-s2, s2], [s2, s2]]) { const pole = new THREE.Mesh(new THREE.BoxGeometry(.12, hh, .12), wood); pole.position.set(dx, hh / 2, dz); pole.castShadow = true; g.add(pole); }
      for (const yy of [hh * .4, hh * .8]) for (const [dx, dz, w, d] of [[0, -s2, s2 * 2, .1], [0, s2, s2 * 2, .1], [-s2, 0, .1, s2 * 2], [s2, 0, .1, s2 * 2]]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(w, .1, d), wood); bar.position.set(dx, yy, dz); g.add(bar); }
      o.group.add(g); o.scaf = g;
    }
    if (!o.busy && o.scaf) { o.group.remove(o.scaf); o.scaf = null; }
    // chimney smoke for production buildings that are working
    o.smoke = state === 'built' && (p.t === 'oil' || p.t === 'saw' || p.t === 'hq');
  }
}
/* ---------- camera & input ---------- */
function v3Cam() {
  const c = V3.camera, d = V3.dist, el = V3.el, az = V3.az, t = V3.tgt;
  c.position.set(t.x + Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, t.z + Math.cos(az) * Math.cos(el) * d);
  c.lookAt(t);
}
function v3Clamp() { V3.tgt.x = clamp(V3.tgt.x, -WALL - 6, WALL + 6); V3.tgt.z = clamp(V3.tgt.z, -WALL - 6, WALL + 8); V3.dist = clamp(V3.dist, 24, 92); }
function v3Pan(dx, dy) {
  const k = V3.dist / (V3.H || 600) * .92, az = V3.az;
  const rx = Math.cos(az), rz = -Math.sin(az), fx = -Math.sin(az), fz = -Math.cos(az);
  V3.tgt.x += (-dx * rx + dy * -fx / Math.sin(V3.el)) * k; V3.tgt.z += (-dx * rz + dy * -fz / Math.sin(V3.el)) * k; v3Clamp();
}
function v3Bind(el) {
  const P = new Map(); let g = null, moved = 0, lt = 0;
  const pos = e => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  el.addEventListener('pointerdown', e => {
    if (tab !== 'base' || !V3.inited || e.target.closest('.b3ui')) return;
    P.set(e.pointerId, pos(e)); V3.vel = { x: 0, z: 0 }; V3.anim = null;
    if (P.size === 1) { const p = pos(e); g = { m: 'pan', lx: p.x, ly: p.y }; moved = 0; lt = performance.now(); }
    if (P.size === 2) { const [a, b] = [...P.values()]; g = { m: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: V3.dist }; moved = 99; }
  });
  el.addEventListener('pointermove', e => {
    if (!P.has(e.pointerId) || !g) return; const p = pos(e); P.set(e.pointerId, p);
    if (g.m === 'pinch' && P.size >= 2) { const [a, b] = [...P.values()]; V3.dist = clamp(g.z0 * g.d0 / (Math.hypot(a.x - b.x, a.y - b.y) || 1), 24, 92); return; }
    if (g.m === 'pan') { const dx = p.x - g.lx, dy = p.y - g.ly; moved += Math.abs(dx) + Math.abs(dy); if (moved > 6) { const ox = V3.tgt.x, oz = V3.tgt.z; v3Pan(dx, dy); const tn = performance.now(), dt = Math.max(1, tn - lt); V3.vel = { x: (V3.tgt.x - ox) / dt * 16, z: (V3.tgt.z - oz) / dt * 16 }; lt = tn; } g.lx = p.x; g.ly = p.y; }
  });
  const up = e => { P.delete(e.pointerId); if (P.size === 0) { if (performance.now() - lt > 90) V3.vel = { x: 0, z: 0 }; g = null; } else if (P.size === 1) { const q = [...P.values()][0]; g = { m: 'pan', lx: q.x, ly: q.y }; } };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('click', e => { if (moved > 8) { e.stopPropagation(); e.preventDefault(); } moved = 0; }, true);
  el.addEventListener('wheel', e => { e.preventDefault(); V3.dist = clamp(V3.dist * Math.exp(e.deltaY * .0012), 24, 92); }, { passive: false });
}
/* ---------- mount / loop ---------- */
function mountVillage() {
  const host = $('#b3c'); if (!host || !v3Init()) return false;
  const cv = V3.renderer.domElement; cv.className = 'b3canvas'; host.appendChild(cv);
  if (!V3.bound) { v3Bind($('#view')); V3.bound = true; }
  v3Resize(); v3SyncBuildings(); v3Hotspots();
  cancelAnimationFrame(V3.raf); V3.last = 0; V3.raf = requestAnimationFrame(v3Loop);
  return true;
}
function v3Resize() { const host = $('#b3c'); if (!host) return; const r = host.getBoundingClientRect(); V3.W = r.width; V3.H = r.height; V3.renderer.setSize(r.width, r.height, false); V3.camera.aspect = r.width / Math.max(1, r.height); V3.camera.updateProjectionMatrix(); }
function v3Hotspots() {
  const hud = $('#b3h'); if (!hud) return; V3.hs = {};
  hud.querySelectorAll('[data-hs]').forEach(e => V3.hs[e.dataset.hs] = e);
}
const _v = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
function v3Project(x, y, z) { _v.set(x, y, z).project(V3.camera); return { x: (_v.x + 1) / 2 * V3.W, y: (1 - _v.y) / 2 * V3.H, z: _v.z }; }
function v3Loop(ts) {
  if (tab !== 'base' || !V3.renderer || !$('#b3c') || B) { V3.raf = 0; return; }
  const dt = V3.last ? Math.min(.05, (ts - V3.last) / 1000) : .016; V3.last = ts; V3.t += dt; const t = V3.t;
  // inertia
  if (Math.abs(V3.vel.x) + Math.abs(V3.vel.z) > .001) { V3.tgt.x += V3.vel.x * dt * 60; V3.tgt.z += V3.vel.z * dt * 60; const f = Math.pow(.9, dt * 60); V3.vel.x *= f; V3.vel.z *= f; v3Clamp(); }
  v3Cam();
  if ((V3.retry = (V3.retry || 0) + dt) > .4) { V3.retry = 0; for (const k in V3.objs) if (!V3.objs[k].mesh) { v3SyncBuildings(); break; } }
  const q = V3.camera.quaternion;
  // buildings face the camera; busy ones bob a little
  for (const k in V3.objs) { const o = V3.objs[k]; if (o.mesh) { o.mesh.quaternion.copy(q); o.mesh.position.y = o.busy ? Math.sin(t * 6) * .04 : 0; } if (o.lock) o.lock.position.y = o.size * .45 + Math.sin(t * 2) * .1; }
  // torches flicker
  for (const tc of V3.torches) { const f = .75 + Math.sin(t * 11 + tc.ph) * .12 + Math.sin(t * 23 + tc.ph * 2) * .08 + Math.random() * .06; tc.spr.scale.set(.8 * f, 1.3 * f, 1); tc.glow.material.opacity = .25 + f * .15; if (tc.pl) tc.pl.intensity = 1.1 * f + .2; }
  // embers drift up
  const E = V3.embers; for (let i = 0; i < E.n; i++) { E.pos[i * 3 + 1] += E.spd[i] * dt; E.pos[i * 3] += Math.sin(t + i) * dt * .3; if (E.pos[i * 3 + 1] > 14) { E.pos[i * 3 + 1] = 0; E.pos[i * 3] = (Math.random() - .5) * 40; E.pos[i * 3 + 2] = (Math.random() - .5) * 40; } } E.pts.geometry.attributes.position.needsUpdate = true;
  // smoke puffs and construction sparks
  if (Math.random() < dt * 8) for (const k in V3.objs) { const o = V3.objs[k]; if ((o.smoke && Math.random() < .25) || (o.busy && Math.random() < .6)) v3Puff(o, o.busy && Math.random() < .5); }
  for (const f of V3.fx) { f.life -= dt; f.s.position.y += f.vy * dt; f.s.position.x += f.vx * dt; const sc = f.s0 + (1 - f.life / f.l0) * f.grow; f.s.scale.set(sc, sc, 1); f.s.material.opacity = Math.max(0, f.life / f.l0) * f.op; }
  V3.fx = V3.fx.filter(f => { if (f.life <= 0) { V3.scene.remove(f.s); f.s.material.dispose(); return false; } return true; });
  // survivors walk between spots
  for (const u of V3.units) {
    if (u.wait > 0) { u.wait -= dt; continue; }
    const p = u.s.position, dx = u.to[0] - p.x, dz = u.to[1] - p.z, d = Math.hypot(dx, dz);
    if (d < .2) { u.wait = 1 + Math.random() * 3; const pts = [[-10, -7], [10, -7], [-10, 2], [10, 2], [-3.5, 9], [3.5, 9], [0, 16], [-11, 13], [11, 13], [-4.5, -10], [4.5, -10], [0, 5]]; u.to = pts[Math.floor(Math.random() * pts.length)]; continue; }
    p.x += dx / d * u.spd * dt; p.z += dz / d * u.spd * dt; p.y = Math.abs(Math.sin(t * 8 + u.ph)) * .07;
  }
  // zombies shamble towards the walls; towers shoot them
  if (V3.zombies.length < 9 && Math.random() < dt * .8) v3SpawnZombie();
  for (const zb of V3.zombies) {
    const p = zb.s.position;
    if (zb.dead) { zb.dead += dt; zb.s.material.opacity = Math.max(0, 1 - zb.dead); zb.s.material.transparent = true; zb.s.scale.y *= .97; continue; }
    const d = Math.hypot(p.x, p.z), stop = WALL + 3.5;
    if (d > stop) { p.x -= p.x / d * zb.spd * dt; p.z -= p.z / d * zb.spd * dt; } p.y = Math.abs(Math.sin(t * 4 + zb.ph)) * .05;
    if (d < WALL + 12 && Math.random() < dt * .9) {
      const tw = V3.towers.reduce((a, b) => Math.hypot(b[0] - p.x, b[1] - p.z) < Math.hypot(a[0] - p.x, a[1] - p.z) ? b : a);
      v3Shot(tw[0], 5, tw[1], p.x, 1.1, p.z); if (--zb.hp <= 0) zb.dead = .01;
    }
  }
  V3.zombies = V3.zombies.filter(zb => { if (zb.dead > 1) { V3.scene.remove(zb.s); zb.s.material.map.dispose(); zb.s.material.dispose(); return false; } return true; });
  for (const s of V3.shots) { s.life -= dt; s.line.material.opacity = Math.max(0, s.life / .12); }
  V3.shots = V3.shots.filter(s => { if (s.life <= 0) { V3.scene.remove(s.line); s.line.geometry.dispose(); s.line.material.dispose(); return false; } return true; });
  // slow dusk light breathing
  V3.sun.intensity = .95 + Math.sin(t * .15) * .1;
  V3.renderer.render(V3.scene, V3.camera);
  v3PlaceHotspots();
  V3.raf = requestAnimationFrame(v3Loop);
}
function v3Puff(o, spark) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: spark ? V3.fireTex : V3.smokeTex, transparent: true, depthWrite: false, blending: spark ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: .7 }));
  const h = o.mesh ? o.mesh.userData.h : o.size; s.position.set(o.x + (Math.random() - .5) * o.size * .4, h * (spark ? .3 + Math.random() * .5 : .75), o.z + (Math.random() - .5) * o.size * .3);
  const l = spark ? .4 : 2.4 + Math.random(); V3.scene.add(s);
  V3.fx.push({ s, life: l, l0: l, vy: spark ? 1.5 : .9, vx: spark ? (Math.random() - .5) * 2 : .3, s0: spark ? .3 : .8, grow: spark ? .1 : 2.2, op: spark ? 1 : .55 });
}
function v3Shot(x1, y1, z1, x2, y2, z2) {
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 1, blending: THREE.AdditiveBlending }));
  V3.scene.add(line); V3.shots.push({ line, life: .12 });
}
function v3PlaceHotspots() {
  if (!V3.hs) return; const W = V3.W, H = V3.H;
  for (const k in V3.hs) {
    const el = V3.hs[k], o = V3.objs[k]; if (!o) continue;
    const h = o.mesh ? o.mesh.userData.h : o.size, bot = v3Project(o.x, 0, o.z), top = v3Project(o.x, h * .95, o.z), side = v3Project(o.x + o.size * .5, 0, o.z - o.size * .5);
    const hh = Math.max(24, bot.y - top.y), ww = Math.max(30, Math.abs(side.x - bot.x) * 2.1);
    const vis = bot.z < 1 && bot.x > -ww && bot.x < W + ww && top.y < H + 40 && bot.y > -40;
    el.style.display = vis ? '' : 'none';
    if (vis) { el.style.transform = `translate(${(bot.x - ww / 2).toFixed(1)}px,${(top.y).toFixed(1)}px)`; el.style.width = ww.toFixed(0) + 'px'; el.style.height = hh.toFixed(0) + 'px'; el.classList.toggle('far', V3.dist > 70); el.classList.toggle('mid', V3.dist > 50); }
  }
}
function v3Focus(k) { const o = V3.objs[k] || { x: V3POS[k][0], z: V3POS[k][1] }; V3.tgt.set(o.x, 0, o.z + 2); V3.dist = Math.min(V3.dist, 40); }
window.addEventListener('resize', () => { if (V3.inited && $('#b3c')) v3Resize(); });
window.V3_DEBUG = () => ({ inited: V3.inited, failed: V3.failed, sup: V3.sup, objs: Object.keys(V3.objs || {}).length, meshes: Object.values(V3.objs || {}).filter(o => o.mesh).length });
window.V3DBG = { dist(d) { V3.dist = d; }, pads(on) { for (const k in V3.objs) { const g = V3.objs[k].group; g.children[0].visible = on; g.children[1].visible = on; } }, shadows(on) { V3.sun.castShadow = on; }, bill(on) { for (const k in V3.objs) if (V3.objs[k].mesh) V3.objs[k].mesh.visible = on; } };
