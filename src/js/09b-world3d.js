/* ================= 3D world map =================
 * The same world (camps, resources, other bases, marches) drawn as a 3D landscape with the shared renderer.
 * The camera follows the 2D map camera in 09-world.js (cam.x / cam.y in map pixels, cam.z zoom), so the
 * gestures, fly-to and buttons keep working. Static scenery is built once with instanced meshes, and every
 * map object is one vertex-colored mesh, so the whole map costs only a few dozen draw calls.
 * Level badges, names and march lines are drawn on the 2D canvas on top.
 */
const W3 = { on: false, objs: {}, live: [], el: .95, sig: '' };
const W3K = 2 / TS; // map pixels -> 3D units (one tile = 2 units)
const w3X = px => px * W3K, w3Z = py => py * W3K;
const _w3v = typeof THREE !== 'undefined' ? new THREE.Vector3() : null;
function w3M(x, y, z, rx, ry, rz, sx, sy, sz) { return new THREE.Matrix4().compose(new THREE.Vector3(x || 0, y || 0, z || 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx || 1, sy === undefined ? (sx || 1) : sy, sz === undefined ? (sx || 1) : sz)); }
/* merge shapes into one geometry, each part with its own vertex color */
function w3Geo(parts) {
  const gs = parts.map(([g, col, m]) => {
    const x = g.index ? g.toNonIndexed() : g.clone(); if (m) x.applyMatrix4(m);
    for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal') x.deleteAttribute(k);
    const c = new THREE.Color(col).convertSRGBToLinear(), n = x.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    x.setAttribute('color', new THREE.BufferAttribute(a, 3)); return x;
  });
  return THREE.BufferGeometryUtils.mergeBufferGeometries(gs);
}
const WG = {
  box: (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl: (a, b, h, n) => new THREE.CylinderGeometry(a, b, h, n || 8), cone: (r, h, n) => new THREE.ConeGeometry(r, h, n || 7),
  rock: r => new THREE.DodecahedronGeometry(r), ball: r => new THREE.SphereGeometry(r, 8, 6), oct: r => new THREE.OctahedronGeometry(r),
};
function w3Templates() {
  if (W3.tpl) return W3.tpl; const T = {};
  const pine = (x, z, s) => [[WG.cyl(.06, .09, .5), '#3a2a1a', w3M(x, .25 * s, z, 0, 0, 0, s)], [WG.cone(.55, 1, 7), '#1e3a26', w3M(x, .85 * s, z, 0, 0, 0, s)], [WG.cone(.42, .8, 7), '#24452e', w3M(x, 1.25 * s, z, 0, 0, 0, s)], [WG.cone(.28, .6, 7), '#2a5034', w3M(x, 1.6 * s, z, 0, 0, 0, s)]];
  T.pine = w3Geo(pine(0, 0, 1));
  T.dead = w3Geo([[WG.cyl(.05, .1, 1.3, 5), '#3a2c22', w3M(0, .65, 0)], [WG.cyl(.025, .04, .6, 4), '#3a2c22', w3M(.18, 1.05, 0, 0, 0, -.8)], [WG.cyl(.02, .035, .5, 4), '#3a2c22', w3M(-.15, .9, .05, 0, 0, .9)]]);
  T.rock = w3Geo([[WG.rock(.4), '#5a5650', w3M(0, .2, 0, 0, 0, 0, 1, .6, 1)], [WG.rock(.22), '#4a4640', w3M(.35, .1, .15)]]);
  T.house = w3Geo([[WG.box(1.4, .9, 1.1), '#5a4a3e', w3M(0, .45, 0)], [WG.cone(1.05, .6, 4), '#4a2a22', w3M(0, 1.2, 0, 0, Math.PI / 4, 0, 1, 1, .8)], [WG.box(.3, .4, .02), '#ffb050', w3M(-.3, .45, .56)], [WG.box(.25, .35, .02), '#1a1612', w3M(.35, .5, .56)], [WG.box(.4, .5, .4), '#4a3a2e', w3M(.5, 1.1, -.2)]]);
  T.ruin = w3Geo([[WG.box(1.3, .5, .12), '#6a5a4a', w3M(0, .25, -.5)], [WG.box(.12, .8, 1.1), '#6a5a4a', w3M(-.6, .4, 0)], [WG.box(.12, .35, .6), '#5a4a3a', w3M(.6, .17, -.2)], [WG.rock(.18), '#5a5048', w3M(.2, .1, .3)], [WG.rock(.12), '#5a5048', w3M(-.2, .06, .4)]]);
  T.car = w3Geo([[WG.box(.7, .26, 1.4), '#5a3a2a', w3M(0, .2, 0)], [WG.box(.6, .22, .7), '#1a2228', w3M(0, .42, -.05)], ...[[-.33, .45], [.33, .45], [-.33, -.45], [.33, -.45]].map(([x, z]) => [WG.cyl(.13, .13, .1, 8), '#141414', w3M(x, .13, z, 0, 0, Math.PI / 2)])]);
  // zombie camp and boss lair
  const camp = boss => {
    const p = [[new THREE.CylinderGeometry(boss ? 2.1 : 1.6, boss ? 2.3 : 1.8, .06, 18), boss ? '#3a1a16' : '#3a2a20', w3M(0, .03, 0)]];
    for (let i = 0; i < (boss ? 3 : 2); i++) { const a = i * 2.2 + .5, r = boss ? 1.1 : .8; p.push([WG.cone(.6, .95, 6), ['#5a4a3a', '#4a3e30', '#6a2a20'][i], w3M(Math.cos(a) * r, .47, Math.sin(a) * r)]); }
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, r = boss ? 1.95 : 1.5; p.push([WG.cyl(.03, .05, .9, 5), '#4a3626', w3M(Math.cos(a) * r, .35, Math.sin(a) * r, Math.sin(a) * .5, 0, -Math.cos(a) * .5)]); }
    p.push([WG.cyl(.25, .3, .12, 8), '#2a2420', w3M(0, .06, .2)]); for (let i = 0; i < 4; i++) p.push([WG.cyl(.04, .04, .45, 5), '#3a2a1a', w3M(Math.cos(i * 1.6) * .1, .12, .2 + Math.sin(i * 1.6) * .1, 0, i * 1.6, Math.PI / 2.4)]);
    p.push([WG.ball(.09), '#d8ccb0', w3M(.6, .08, .6)], [WG.ball(.08), '#d8ccb0', w3M(-.7, .07, .4)]);
    if (boss) { p.push([WG.cyl(.06, .08, 1.8, 6), '#2a1e16', w3M(-1.2, .9, -1)], [WG.ball(.16), '#d8ccb0', w3M(-1.2, 1.9, -1)], [WG.box(.5, .7, .02), '#8a1410', w3M(-.95, 1.4, -1)]); }
    return w3Geo(p);
  };
  T.camp = camp(false); T.lair = camp(true);
  T.food = w3Geo([[WG.box(2, .05, 1.6), '#6a6a2a', w3M(0, .03, 0)], ...[[-.5, -.3], [.4, -.2], [0, .4]].map(([x, z]) => [WG.cyl(.3, .3, .5, 10), '#c8a848', w3M(x, .3, z, 0, x, Math.PI / 2)]), ...Array.from({ length: 10 }, (_, i) => [WG.cone(.05, .35, 4), '#a8a040', w3M(-.8 + (i % 5) * .4, .2, .65 + Math.floor(i / 5) * .1 - .1)])]);
  T.wood = w3Geo([...pine(-.55, -.4, .9), ...pine(.6, -.3, .75), ...[0, 1, 2, 3].map(i => [WG.cyl(.11, .11, .9, 7), '#6a4a2a', w3M(-.1 + (i % 2) * .05, .11 + Math.floor(i / 2) * .2, .35 + (i % 2) * .22 - Math.floor(i / 2) * .1, 0, .3, Math.PI / 2)])]);
  T.iron = w3Geo([[WG.rock(.45), '#4a4a4e', w3M(-.3, .25, 0)], [WG.rock(.35), '#55555a', w3M(.4, .2, .1)], [WG.rock(.25), '#3e3e44', w3M(0, .15, .5)], [WG.oct(.18), '#8aa0b8', w3M(-.2, .6, .1, .4, 0, .3, 1, 1.6, 1)], [WG.oct(.14), '#9ab0c8', w3M(.45, .5, .2, .2, 0, -.4, 1, 1.5, 1)], [WG.oct(.12), '#8aa0b8', w3M(.1, .35, .55, 0, 0, .5, 1, 1.4, 1)]]);
  T.fuel = w3Geo([...[[-.5, .3], [-.15, .45], [-.35, -.05], [.1, .2]].map(([x, z], i) => [WG.cyl(.17, .17, .5, 10), ['#6a1a14', '#2a2a2a', '#3a4a2a', '#6a1a14'][i], w3M(x, .25, z)]), ...[[-.25, -.25], [.25, -.25], [-.25, .25], [.25, .25]].map(([x, z]) => [WG.cyl(.025, .025, 1.6, 4), '#4a4a4a', w3M(.55 + x * .5, .8, -.3 + z * .5, z * .25, 0, -x * .25)]), [WG.box(.5, .1, .1), '#5a5a5a', w3M(.55, 1.55, -.3)]]);
  T.base = w3Geo([...[[0, -.9, 1.9, .12], [0, .9, 1.9, .12], [-.9, 0, .12, 1.9], [.9, 0, .12, 1.9]].map(([x, z, w, d]) => [WG.box(w, .45, d), '#6a6058', w3M(x, .22, z)]), [WG.box(.9, .7, .8), '#5a4a3e', w3M(0, .35, 0)], [WG.cone(.72, .5, 4), '#3a3a42', w3M(0, .95, 0, 0, Math.PI / 4, 0, 1, 1, .9)], [WG.cyl(.025, .025, 1.6, 4), '#3a3a3a', w3M(.7, .8, .7)]]);
  T.flag = new THREE.PlaneGeometry(.45, .3); T.flag.translate(.22, 0, 0);
  T.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, flatShading: true });
  return (W3.tpl = T);
}
/* ---------- the static landscape ---------- */
function w3Ground() {
  return canvasTex(512, 512, (c, w, h) => {
    const R = rng(23); c.fillStyle = '#4a3a2a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { c.fillStyle = ['#3e3224', '#56442e', '#3a4a2a', '#44502e', '#4e3c2a'][i % 5] + '88'; c.beginPath(); c.ellipse(R() * w, R() * h, 8 + R() * 40, 6 + R() * 28, R() * 3, 0, 7); c.fill(); }
    for (let i = 0; i < 3500; i++) { c.fillStyle = R() < .5 ? '#2a2018' : '#6a5a40'; c.globalAlpha = .4; c.fillRect(R() * w, R() * h, 2, 2); } c.globalAlpha = 1;
  }, 1);
}
function w3Init() {
  if (W3.scene) return;
  const T = w3Templates(), scene = new THREE.Scene(); W3.scene = scene;
  scene.background = new THREE.Color('#141a20'); scene.fog = new THREE.Fog('#141a20', 40, 110);
  W3.cam = new THREE.PerspectiveCamera(40, 1, .5, 300);
  scene.add(new THREE.HemisphereLight('#a8b8d8', '#3a2a1a', .9));
  const sun = new THREE.DirectionalLight('#ffc89a', .95); sun.position.set(-30, 50, 20); scene.add(sun);
  const S2 = N * TS * W3K, mid = S2 / 2;
  const gt = w3Ground(); gt.repeat.set(10, 10);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(S2, S2), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.set(mid, 0, mid); scene.add(ground); W3.ground = ground;
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(S2 * 3, S2 * 3), c3M({ color: '#1a1612', roughness: 1 })); outer.rotation.x = -Math.PI / 2; outer.position.set(mid, -.05, mid); scene.add(outer);
  // roads along the old map grid lines
  const roadM = c3M({ color: '#2e2a24', roughness: .95 }), cc = (C + .5) * 2;
  const road = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0), m = new THREE.Mesh(new THREE.PlaneGeometry(.75, len), roadM); m.rotation.set(-Math.PI / 2, 0, Math.atan2(x1 - x0, z1 - z0)); m.position.set((x0 + x1) / 2, .02, (z0 + z1) / 2); scene.add(m); };
  road(cc, 0, cc, S2); road(0, cc, S2, cc);
  for (const k of [10, 30]) { const p = (k + .5) * 2; road(p, cc - 32, p, cc + 32); road(cc - 32, p, cc + 32, p); }
  const onRoad = (x, y) => x === C || y === C || ((x % 10 === 0) && Math.abs(y - C) < 16) || ((y % 10 === 0) && Math.abs(x - C) < 16);
  // scenery: forests, dead trees, rocks, houses, ruins and wrecked cars
  const place = { pine: [], dead: [], rock: [], house: [], ruin: [], car: [] };
  for (let y = -6; y < N + 6; y++) for (let x = -6; x < N + 6; x++) {
    if (Math.abs(x - C) <= 2 && Math.abs(y - C) <= 2) continue;
    const h = hash(x + 99, y + 7), h2 = hash(x * 3 + 1, y * 5 + 2), out = x < 0 || y < 0 || x >= N || y >= N, bx = x * 2, bz = y * 2;
    if (onRoad(x, y) && !out) { if (h < .05) place.car.push([bx + .6 + h2, bz + .8, h * 40]); continue; }
    const forest = hash(Math.floor(x / 4) + 50, Math.floor(y / 4) + 9) < .38 || out;
    if (forest && h < .85) { const n = 1 + Math.floor(h2 * 3); for (let i = 0; i < n; i++) place.pine.push([bx + .2 + hash(x + i, y) * 1.6, bz + .2 + hash(x, y + i) * 1.6, .7 + hash(i, x + y) * .7]); }
    else if (h < .08) place.dead.push([bx + .3, bz + .3, .8 + h2 * .5]);
    else if (h < .13) place.rock.push([bx + 1.6, bz + .4, .7 + h2 * .6]);
    else if (h < .16) place.house.push([bx + .4, bz + 1.5, h2 * 6.3]);
    else if (h < .19) place.ruin.push([bx + 1.4, bz + 1.4, h2 * 6.3]);
  }
  for (const k in place) {
    const arr = place[k]; if (!arr.length) continue; const im = new THREE.InstancedMesh(T[k], T.mat, arr.length);
    arr.forEach(([x, z, s], i) => im.setMatrixAt(i, k === 'pine' || k === 'dead' || k === 'rock' ? w3M(x, 0, z, 0, x * 7 % 6.3, 0, s) : w3M(x, 0, z, 0, s, 0)));
    im.instanceMatrix.needsUpdate = true; scene.add(im);
  }
  // our own base in the middle: the headquarters inside a stone wall with towers
  const home = new THREE.Group(); home.position.set(cc, 0, cc); scene.add(home);
  try { const hq = m3Build('hq', 3.4); home.add(hq); } catch (e) { }
  const wall = []; const wr = 2.7; for (const [x, z, w, d] of [[0, -wr, wr * 2, .3], [0, wr, wr * 2, .3], [-wr, 0, .3, wr * 2], [wr, 0, .3, wr * 2]]) wall.push([WG.box(w, .7, d), '#7a7068', w3M(x, .35, z)]);
  for (const [x, z] of [[-wr, -wr], [wr, -wr], [-wr, wr], [wr, wr]]) wall.push([WG.cyl(.4, .45, 1.3, 8), '#6a6058', w3M(x, .65, z)], [WG.cone(.5, .5, 8), '#5a2a22', w3M(x, 1.55, z)]);
  home.add(new THREE.Mesh(w3Geo(wall), T.mat));
  const ring = c3Glow('#cf6a2c', 9, .25); ring.position.set(0, .3, 0); home.add(ring); W3.ring = ring;
  for (const [x, z] of [[-wr, -wr], [wr, -wr], [-wr, wr], [wr, wr]]) { const g = c3Glow('#ff9a3a', 1.2, .7); g.position.set(x, 1.95, z); home.add(g); }
  W3.cc = cc;
}
/* ---------- map objects ---------- */
function w3Obj(n) {
  const T = w3Templates(); let g;
  if (n.k === 'z') { g = new THREE.Mesh(n.L % 5 === 0 ? T.lair : T.camp, T.mat); const f = c3Glow('#ff8a3a', 1, .8); f.position.set(0, .35, .2); g.add(f); g.userData.fire = f; }
  else if (n.k === 'r') g = new THREE.Mesh(T[n.rt] || T.food, T.mat);
  else { g = new THREE.Mesh(T.base, T.mat); const col = (ALLIES.find(a => a.tag === n.tag) || {}).col || '#8a8a8a'; const fl = new THREE.Mesh(T.flag, new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); fl.position.set(.7, 1.45, .7); g.add(fl); g.userData.flag = fl; }
  g.position.set((n.x + .5) * 2, 0, (n.y + .5) * 2); g.rotation.y = hash(n.x, n.y) * 6.3; return g;
}
function w3Sync() {
  const ids = new Set(S.world.nodes.map(n => n.id));
  for (const id in W3.objs) if (!ids.has(id)) { W3.scene.remove(W3.objs[id]); delete W3.objs[id]; }
  for (const n of S.world.nodes) if (!W3.objs[n.id]) { const o = w3Obj(n); o.userData.node = n; W3.scene.add(o); W3.objs[n.id] = o; }
  W3.sig = S.world.nodes.length + '|' + (S.world.nodes[S.world.nodes.length - 1] || {}).id;
}
/* a few animated zombies at the camps nearest to the camera */
function w3Live(tx, tz) {
  const camps = S.world.nodes.filter(n => n.k === 'z').map(n => ({ n, d: Math.hypot((n.x + .5) * 2 - tx, (n.y + .5) * 2 - tz) })).filter(o => o.d < 26).sort((a, b) => a.d - b.d).slice(0, 8);
  const want = new Set(camps.map(c => c.n.id));
  W3.live = W3.live.filter(l => { if (want.has(l.id)) return true; W3.scene.remove(l.m); (W3.pool[l.type] = W3.pool[l.type] || []).push(l.m); return false; });
  for (const { n } of camps) if (!W3.live.some(l => l.id === n.id)) {
    const type = n.L % 5 === 0 ? 'boss' : n.L >= 6 ? 'br' : n.L >= 3 ? 'run' : 'w', pool = W3.pool[type] || [];
    const m = pool.pop() || m3Zombie(type); m.scale.multiplyScalar(1); m.userData.ws = m.userData.ws || m.scale.x; m.scale.setScalar(m.userData.ws * .55);
    W3.scene.add(m); W3.live.push({ id: n.id, m, type, cx: (n.x + .5) * 2, cz: (n.y + .5) * 2, a: Math.random() * 6, r: .6 + Math.random() * .4, ph: Math.random() * 6 });
  }
}
function w3Mount() {
  try {
    if (!v3Supported() || !v3Init()) return false;
    W3.pool = W3.pool || {}; w3Init(); w3Sync();
    const host = $('.world'), cv = V3.renderer.domElement; if (!host) return false;
    host.insertBefore(cv, host.firstChild); cv.className = 'w3canvas'; w3Size(); W3.lt = 0; W3.t = 0; W3.liveT = 0;
    return true;
  } catch (e) { console.warn('3D world off', e); return false; }
}
function w3Size() { if (!W3.cam || !wW) return; V3.renderer.setSize(wW, wH, false); W3.cam.aspect = wW / Math.max(1, wH); W3.cam.updateProjectionMatrix(); }
/* camera from the 2D map camera; one screen pixel ≈ one map pixel / zoom at the target */
function w3Cam() {
  const thf = Math.tan(THREE.MathUtils.degToRad(W3.cam.fov / 2)) * W3.cam.aspect, D = (wW / cam.z * W3K) / (2 * thf);
  const tx = w3X(cam.x), tz = w3Z(cam.y), el = W3.el; W3.cam.position.set(tx, Math.sin(el) * D, tz + Math.cos(el) * D); W3.cam.lookAt(tx, 0, tz); W3.D = D; return [tx, tz];
}
function w3Pick(sx, sy) {
  const r = new THREE.Raycaster(); r.setFromCamera({ x: sx / wW * 2 - 1, y: -(sy / wH) * 2 + 1 }, W3.cam);
  const hit = new THREE.Vector3(); if (!r.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return null;
  return { x: hit.x / W3K, y: hit.z / W3K };
}
function w3P(x, y, z) { _w3v.set(x, y, z).project(W3.cam); return [(_w3v.x + 1) / 2 * wW, (1 - _w3v.y) / 2 * wH, _w3v.z]; }
function w3Draw(ts) {
  if (V3.renderer.domElement.parentNode !== $('.world')) { const host = $('.world'); if (host) { host.insertBefore(V3.renderer.domElement, host.firstChild); V3.renderer.domElement.className = 'w3canvas'; w3Size(); } }
  const tn = performance.now(), dt = W3.lt ? Math.min(.05, (tn - W3.lt) / 1000) : .016; W3.lt = tn; W3.t += dt; const tt = W3.t;
  if ((S.world.nodes.length + '|' + (S.world.nodes[S.world.nodes.length - 1] || {}).id) !== W3.sig) w3Sync();
  const [tx, tz] = w3Cam(), viewR = W3.D * 1.25 + 8;
  for (const id in W3.objs) { const o = W3.objs[id], p = o.position, vis = Math.abs(p.x - tx) < viewR && Math.abs(p.z - tz) < viewR * 1.2; o.visible = vis; if (vis) { if (o.userData.fire) { const f = .8 + Math.sin(tt * 11 + p.x) * .15 + Math.random() * .08; o.userData.fire.scale.set(f, f * 1.3, 1); } if (o.userData.flag) o.userData.flag.rotation.y = Math.sin(tt * 3 + p.x) * .3; } }
  if ((W3.liveT -= dt) <= 0) { W3.liveT = .5; w3Live(tx, tz); }
  for (const l of W3.live) { l.a += dt * .5; const x = l.cx + Math.cos(l.a) * l.r, z = l.cz + Math.sin(l.a) * l.r; l.m.position.set(x, 0, z); l.m.rotation.y = l.a + Math.PI; m3Walk(l.m, tt + l.ph, .7, true); }
  W3.ring.material.opacity = .2 + Math.sin(tt * 2) * .06;
  fxRender(W3.scene, W3.cam, wW, wH, 'world');
  // overlay: march lines, level badges, names, vignette
  const c = wCtx; if (!c) return; c.setTransform(wDpr, 0, 0, wDpr, 0, 0); c.clearRect(0, 0, wW, wH);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.direction = isRTL() ? 'rtl' : 'ltr';
  const tm = now(), home = w3P(W3.cc, .4, W3.cc);
  for (const m of S.world.marches) {
    const pt = w3P((m.x + .5) * 2, .4, (m.y + .5) * 2); c.setLineDash([8, 8]); c.lineDashOffset = -(ts || 0) / 40; c.strokeStyle = '#64b66ecc'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(home[0], home[1]); c.lineTo(pt[0], pt[1]); c.stroke(); c.setLineDash([]);
    let f = tm < m.arr ? (tm - m.go) / (m.arr - m.go) : tm < m.fin ? 1 : 1 - (tm - m.fin) / (m.back - m.fin); f = clamp(f, 0, 1);
    c.fillStyle = '#64b66e'; c.beginPath(); c.arc(lerp(home[0], pt[0], f), lerp(home[1], pt[1], f), 6, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
  }
  if (cam.z > .6) { c.font = '700 13px Changa, sans-serif'; c.lineWidth = 3; c.strokeStyle = '#000a'; const p = w3P(W3.cc, 0, W3.cc + 3.4); c.strokeText(S.name || t('commander'), p[0], p[1]); c.fillStyle = '#ffd9a8'; c.fillText(S.name || t('commander'), p[0], p[1]); }
  const lbl = cam.z > .75;
  for (const n of S.world.nodes) {
    const o = W3.objs[n.id]; if (!o || !o.visible) continue; const p = w3P(o.position.x, 0, o.position.z + 1.3); if (p[0] < -30 || p[1] < -30 || p[0] > wW + 30 || p[1] > wH + 30 || p[2] > 1) continue;
    if (n.k === 'z') {
      const ok = n.L <= S.world.maxZ + 1, top = ok && n.L === S.world.maxZ + 1;
      if (lbl || n.L % 5 === 0 || top) badge(c, p[0], p[1], n.L, ok ? '#e2513f' : '#555');
      if (top) { const q = w3P(o.position.x, 0, o.position.z); c.strokeStyle = '#f1b23c'; c.lineWidth = 2; c.beginPath(); c.ellipse(q[0], q[1], 30 * cam.z + Math.sin(tt * 5) * 2, 15 * cam.z, 0, 0, 7); c.stroke(); }
    } else if (n.k === 'r') { if (lbl) badge(c, p[0], p[1], n.L, '#64b66e'); if (S.world.marches.some(m => m.nid === n.id)) { const q = w3P(o.position.x, 0, o.position.z); c.strokeStyle = '#64b66e'; c.lineWidth = 2; c.beginPath(); c.ellipse(q[0], q[1], 26 * cam.z, 13 * cam.z, 0, 0, 7); c.stroke(); } }
    else if (lbl) { c.font = '700 11px Tajawal, sans-serif'; c.lineWidth = 3; c.strokeStyle = '#000a'; const s = `[${n.tag}] ${L(BOTS[n.bot])}`; c.strokeText(s, p[0], p[1]); c.fillStyle = '#d8dee4'; c.fillText(s, p[0], p[1]); }
  }
  const g = c.createRadialGradient(wW / 2, wH / 2, Math.min(wW, wH) * .4, wW / 2, wH / 2, Math.max(wW, wH) * .78); g.addColorStop(0, '#0000'); g.addColorStop(1, '#0009'); c.fillStyle = g; c.fillRect(0, 0, wW, wH);
}
