// 3D world map: streamed terrain chunks, zombie hordes, camps, rival bastions, resource nodes,
// alliance territories, and marching vehicles that visibly drive to their targets and back.
import { THREE, makeRenderer, Sky, CameraRig, pick, groundPoint, label, setLabel, glowSprite, Puffs, box, cyl, at, group, mat, bakeStatic } from './engine.js';
import { zombie, truck, buggy, drone, deadTree, ruin, wreck, tent, campfire, fortress, resourceNode, setNight } from './models.js';
import { WORLD_SIZE, RES_INFO } from '../data/config.js';
import { terrainAt, NPC_ALLIANCES, TERRITORY_R, NODE_TYPES } from '../core/world.js';
import { hash2 } from '../core/rng.js';
import { getQuality } from '../platform.js';
import { tr } from '../i18n.js';

export const TS = 1.6;          // world units per map tile
const CH = 12;                   // tiles per terrain chunk
const T_COL = [[0.33, 0.29, 0.22], [0.40, 0.38, 0.35], [0.24, 0.27, 0.19], [0.12, 0.2, 0.26], [0.36, 0.35, 0.32], [0.26, 0.33, 0.12]];
const tw = (v) => (v + 0.5) * TS;

export class World3D {
  constructor(canvas, game, handlers) {
    this.c = canvas; this.g = game; this.h = handlers;
    this.renderer = makeRenderer(canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.5, 400);
    const p = game.basePos();
    this.rig = new CameraRig(canvas, this.camera, { target: new THREE.Vector3(tw(p.x), 0, tw(p.y)), dist: 44, minDist: 10, maxDist: 75, pitch: 0.98, yaw: Math.PI / 4,
      bounds: { minX: 0, maxX: WORLD_SIZE * TS, minZ: 0, maxZ: WORLD_SIZE * TS }, onTap: (x, y) => this.tap(x, y) });
    this.cam = this.rig;
    this.sky = new Sky(this.scene, { shadowSize: 26 });
    this.scene.fog.near = 30; this.scene.fog.far = 95;
    this.dust = new Puffs(this.scene, { color: 0x9a8a70, max: 80 });
    this.chunks = new Map(); this.objMeshes = new Map(); this.marchMeshes = new Map(); this.terrMeshes = new Map();
    this.objs = []; this.remote = []; this.sel = null; this.last = 0; this.nextObj = 0;
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), mat(0x10202a)); sea.rotation.x = -Math.PI / 2; sea.position.y = -0.3; this.scene.add(sea);
    this.home = fortress(0xffd27a, 1.15); this.scene.add(this.home);
    this.homeLabel = label('', 0.6, { color: '#ffd27a', border: '#7a6040' }); this.scene.add(this.homeLabel);
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(2.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5fd3ff, transparent: true, opacity: 0.16, depthWrite: false }));
    this.scene.add(this.shield);
    this.selRing = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.35, 28), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.8, depthWrite: false }));
    this.selRing.rotation.x = -Math.PI / 2; this.selRing.visible = false; this.scene.add(this.selRing);
  }
  resize() {
    const w = this.c.clientWidth, h = this.c.clientHeight; if (!w || !h) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, getQuality() === 'low' ? 1.25 : 2));
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.fov = w / h < 0.6 ? 46 : 38; this.camera.updateProjectionMatrix(); this.rig.apply();
  }
  goTo(x, y) { this.rig.target.set(tw(x), 0, tw(y)); this.rig.apply(); }
  goHome() { const p = this.g.basePos(); this.goTo(p.x, p.y); }
  centerTile() { return { x: Math.floor(this.rig.target.x / TS), y: Math.floor(this.rig.target.z / TS) }; }
  tileScreen(x, y) { const v = new THREE.Vector3(tw(x), 0.4, tw(y)).project(this.camera); return { x: (v.x + 1) / 2 * this.c.clientWidth, y: (1 - v.y) / 2 * this.c.clientHeight }; }

  // ---------- terrain chunks ----------
  buildChunk(cx, cy) {
    const root = group(), x0 = cx * CH, y0 = cy * CH;
    const pos = [], col = [];
    for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) {
      const tx = x0 + i, ty = y0 + j; if (tx >= WORLD_SIZE || ty >= WORLD_SIZE) continue;
      const tt = terrainAt(tx, ty), r = hash2(tx, ty, 9);
      const yv = tt === 3 ? -0.18 : 0, c = T_COL[tt].map((v) => Math.pow(v * (0.88 + r * 0.24), 2.2)); // sRGB → linear
      const a = tx * TS, b = ty * TS, A = a + TS, Bz = b + TS;
      pos.push(a, yv, b, a, yv, Bz, A, yv, Bz, a, yv, b, A, yv, Bz, A, yv, b);
      for (let k = 0; k < 6; k++) col.push(...c);
      const cxw = a + TS / 2, czw = b + TS / 2;
      if (tt === 1 && r > 0.25) { const rb = ruin(0.5 + r * 1.6, r); rb.scale.set(1.2, 1, 1.2); root.add(at(rb, cxw + (r - 0.5) * 0.4, 0, czw, r * 3)); }
      else if (tt === 2) { root.add(at(deadTree(r * 6), cxw - 0.3, 0, czw - 0.2)); if (r > 0.5) root.add(at(deadTree(r * 9), cxw + 0.4, 0, czw + 0.3)); }
      else if (tt === 4 && r > 0.86) root.add(at(wreck(r > 0.93 ? 0x7a3a2a : 0x3a4a5a), cxw, 0, czw));
      else if (tt === 0 && r < 0.05) { const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25 + r * 4), mat(0x5a544a)); root.add(at(rock, cxw, 0.08, czw)); }
      if (tt === 4) { const dash = box(TS * 0.35, 0.02, 0.06, 0xcfb45a); root.add(at(dash, cxw, 0.005, czw)); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })); ground.receiveShadow = true;
    bakeStatic(root); root.add(ground);
    return root;
  }
  updateChunks() {
    const t = this.rig.target, span = Math.ceil((this.rig.dist * 1.3) / TS / CH) + 1;
    const ccx = Math.floor(t.x / TS / CH), ccy = Math.floor(t.z / TS / CH), want = new Set();
    for (let dy = -span; dy <= span; dy++) for (let dx = -span; dx <= span; dx++) {
      const cx = ccx + dx, cy = ccy + dy; if (cx < 0 || cy < 0 || cx * CH >= WORLD_SIZE || cy * CH >= WORLD_SIZE) continue;
      const k = cx + ',' + cy; want.add(k);
      if (!this.chunks.has(k)) { const c = this.buildChunk(cx, cy); this.scene.add(c); this.chunks.set(k, c); if (performance.now() - this.frameStart > 25) return; }
    }
    for (const [k, c] of this.chunks) if (!want.has(k)) { this.scene.remove(c); c.traverse((o) => o.geometry?.dispose()); this.chunks.delete(k); }
  }
  // ---------- map objects ----------
  makeObject(o) {
    const grp = group(); grp.userData.obj = o;
    let top = 1.2;
    if (o.kind === 'zombie') { for (let i = 0; i < 3; i++) { const z = zombie(['#', 0x7d9a5a, 0x8aa860, 0x6c8a4e][i + 1], 0.6); at(z, (i - 1) * 0.45, 0, (i % 2) * 0.35 - 0.1, Math.random() * 6); z.userData.dyn = true; grp.add(z); } top = 1.1; }
    else if (o.kind === 'boss') { const z = zombie(0x5a7a3a, 1.8); z.userData.dyn = true; grp.add(z); const aura = glowSprite(0xff3030, 4, 0.35); aura.position.y = 1; grp.add(aura); grp.userData.aura = aura; top = 2.6; }
    else if (o.kind === 'node') { grp.add(resourceNode(o.res)); top = 1.3; }
    else if (o.kind === 'camp') { grp.add(at(tent(0x6a4a32), -0.5, 0, 0.1), at(tent(0x7a3a2a), 0.3, 0, -0.35), at(tent(0x6a4a32), 0.5, 0, 0.45), campfire()); top = 1.3; }
    else if (o.kind === 'rival') { grp.add(fortress(o.remote ? 0x5fd3ff : 0x9a8a7a, 0.75)); top = 1.9; }
    grp.traverse((c) => { if (c.userData.anim) grp.userData.hasAnim = true; });
    const badge = label(String(o.kind === 'rival' ? o.hq : o.lvl), 0.42, { color: '#fff', border: o.kind === 'zombie' ? '#7da44a' : o.kind === 'boss' ? '#cc3333' : o.kind === 'camp' ? '#b0563a' : o.kind === 'node' ? '#a08a5a' : '#888888' });
    badge.position.y = top; grp.add(badge);
    if (o.kind === 'rival') { const n = label(`${o.tag ? '[' + o.tag + '] ' : ''}${o.name}${o.remote ? '' : ' ' + tr('(AI)')}`, 0.38, { color: o.remote ? '#5fd3ff' : '#dddddd' }); n.position.y = top + 0.45; grp.add(n); }
    if (o.kind === 'boss') { const n = label('World Boss', 0.4, { color: '#ff8a7a' }); n.position.y = top + 0.45; grp.add(n); }
    if (o.kind === 'node') { grp.userData.amount = label('', 0.3, { color: RES_INFO[o.res].color }); grp.userData.amount.position.y = top + 0.4; grp.add(grp.userData.amount); }
    grp.position.set(tw(o.x), 0, tw(o.y));
    return grp;
  }
  updateObjects(now) {
    if (now < this.nextObj) return; this.nextObj = now + 400;
    const c = this.centerTile(), R = Math.ceil(this.rig.dist * 0.9 / TS) + 4;
    this.objs = this.g.visibleObjects(c.x - R, c.y - R, c.x + R, c.y + R);
    const list = [...this.objs, ...this.remote.filter((r) => Math.abs(r.x - c.x) <= R && Math.abs(r.y - c.y) <= R)];
    const seen = new Set();
    for (const o of list) {
      seen.add(o.id);
      let m = this.objMeshes.get(o.id);
      if (!m) { m = this.makeObject(o); this.scene.add(m); this.objMeshes.set(o.id, m); }
      if (o.kind === 'node') { const st = this.g.objectState(o); setLabel(m.userData.amount, `${st.occupied ? '⛏️ ' : ''}${fmtK(st.amount)}`, 0.3, { color: RES_INFO[o.res].color }); }
    }
    for (const [id, m] of this.objMeshes) if (!seen.has(id)) { this.scene.remove(m); this.objMeshes.delete(id); }
    // alliance territories near the view
    for (const a of NPC_ALLIANCES) {
      const near = Math.abs(a.x - c.x) < R + TERRITORY_R && Math.abs(a.y - c.y) < R + TERRITORY_R;
      let t = this.terrMeshes.get(a.id);
      if (near && !t) {
        t = group();
        const disk = new THREE.Mesh(new THREE.CircleGeometry(TERRITORY_R * TS, 48), new THREE.MeshBasicMaterial({ color: a.color, transparent: true, opacity: this.g.s.alliance?.tag === a.tag ? 0.16 : 0.09, depthWrite: false }));
        disk.rotation.x = -Math.PI / 2; disk.position.y = 0.03; t.add(disk);
        const ring = new THREE.Mesh(new THREE.RingGeometry(TERRITORY_R * TS - 0.12, TERRITORY_R * TS, 64), new THREE.MeshBasicMaterial({ color: a.color, transparent: true, opacity: 0.7, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; t.add(ring);
        const f = fortress(parseInt(a.color.slice(1), 16), 1.4); t.add(f);
        const lb = label(`[${a.tag}] ${a.name}`, 0.55, { color: a.color }); lb.position.y = 3; t.add(lb);
        t.position.set(tw(a.x), 0, tw(a.y)); this.scene.add(t); this.terrMeshes.set(a.id, t);
      } else if (!near && t) { this.scene.remove(t); this.terrMeshes.delete(a.id); }
    }
  }
  // ---------- marches: vehicles driving along their routes ----------
  updateMarches(t, dt) {
    const g = this.g, bp = g.basePos(), seen = new Set();
    for (const m of g.s.marches) {
      seen.add(m.id);
      let mm = this.marchMeshes.get(m.id);
      if (!mm) {
        const v = m.kind === 'scout' ? drone() : m.kind === 'gather' ? truck(0x4f6a3a) : buggy(0x9a3a2a);
        v.scale.setScalar(m.kind === 'scout' ? 1.6 : 1.5);
        const pts = [new THREE.Vector3(tw(bp.x), 0.08, tw(bp.y)), new THREE.Vector3(tw(m.tx), 0.08, tw(m.ty))];
        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.Line(lineGeo, new THREE.LineDashedMaterial({ color: m.kind === 'attack' ? 0xff5a3c : m.kind === 'scout' ? 0xc8c8ff : 0x78e678, dashSize: 0.6, gapSize: 0.4, transparent: true, opacity: 0.9 }));
        line.computeLineDistances();
        const marker = label(m.kind === 'attack' ? '⚔️' : m.kind === 'scout' ? '🦅' : '⛏️', 0.6, { bg: 'rgba(0,0,0,0.6)', size: 40, radius: 30 });
        const status = label('', 0.32, { color: '#ffd27a' });
        this.scene.add(v, line, marker, status);
        mm = { v, line, marker, status, last: null, dist: 0 }; this.marchMeshes.set(m.id, mm);
      }
      const p = g.marchPos(m), x = tw(p.x), z = tw(p.y);
      const moving = m.state !== 'gather';
      if (mm.last) {
        const dx = x - mm.last.x, dz = z - mm.last.z, d = Math.hypot(dx, dz);
        if (d > 1e-4) { mm.v.rotation.y = Math.atan2(dx, dz); mm.dist += d; if (m.kind !== 'scout' && Math.random() < 0.6) this.dust.emit(new THREE.Vector3(x - dx / d * 0.8, 0.15, z - dz / d * 0.8), { vel: new THREE.Vector3(0, 0.4, 0), life: 1.2, size: 0.35, grow: 2 }); }
      }
      mm.last = { x, z };
      const y = m.kind === 'scout' ? 1.6 + Math.sin(t * 3) * 0.1 : 0;
      mm.v.position.set(moving ? x : x + 1.2, y, moving ? z : z + 0.8);
      mm.v.userData.drive?.(mm.dist); mm.v.userData.anim?.(t);
      mm.marker.position.set(mm.v.position.x, y + 1.7, mm.v.position.z);
      mm.line.material.dashOffset -= dt * (m.state === 'return' ? -1.5 : 1.5);
      mm.line.visible = m.state !== 'gather';
      const end = m.state === 'gather' ? m.gatherEnd : m.arrive, rem = Math.max(0, Math.ceil((end - g.now()) / 1000));
      const txt = m.state === 'gather' ? `⛏️ ${Math.round(Math.min(1, (g.now() - m.gatherStart) / (m.gatherEnd - m.gatherStart)) * 100)}% · ${fmtT(rem)}` : `${m.state === 'return' ? '↩ ' : ''}${fmtT(rem)}`;
      setLabel(mm.status, txt, 0.32, { color: '#ffd27a' }); mm.status.position.set(mm.v.position.x, y + 2.25, mm.v.position.z);
    }
    for (const [id, mm] of this.marchMeshes) if (!seen.has(id)) { this.scene.remove(mm.v, mm.line, mm.marker, mm.status); mm.line.geometry.dispose(); this.marchMeshes.delete(id); }
  }
  tap(sx, sy) {
    const g = this.g, p = groundPoint(this.camera, this.c, sx, sy); if (!p) return;
    const tx = Math.floor(p.x / TS), ty = Math.floor(p.z / TS), bp = g.basePos();
    // marches first (vehicles are small and move)
    for (const m of g.s.marches) { const mp = g.marchPos(m); if (Math.hypot(mp.x - p.x / TS + 0.5, mp.y - p.z / TS + 0.5) < 1.2) { this.h.onMarch?.(m); return; } }
    const hits = pick(this.camera, this.c, sx, sy, [this.home, ...this.objMeshes.values()]);
    for (const h of hits) { let o = h.object; while (o && !o.userData.obj && o !== this.home) o = o.parent; if (o === this.home) { this.sel = { kind: 'home', x: bp.x, y: bp.y }; this.h.onSelect?.(this.sel); return; } if (o?.userData.obj) { this.sel = o.userData.obj; this.h.onSelect?.(this.sel); return; } }
    if (Math.abs(tx - bp.x) <= 1 && Math.abs(ty - bp.y) <= 1) { this.sel = { kind: 'home', x: bp.x, y: bp.y }; this.h.onSelect?.(this.sel); return; }
    const o = [...this.objs, ...this.remote].find((o) => Math.abs(o.x - tx) <= (o.kind === 'rival' || o.kind === 'boss' ? 1 : 0) && Math.abs(o.y - ty) <= (o.kind === 'rival' || o.kind === 'boss' ? 1 : 0));
    this.sel = o || { kind: 'empty', x: tx, y: ty, terrain: terrainAt(tx, ty) };
    this.h.onSelect?.(this.sel);
  }
  render(t) {
    const dt = Math.min(0.1, this.last ? t - this.last : 0.016); this.last = t;
    if (!this.c.clientWidth) return;
    if (this.c.width !== Math.floor(this.c.clientWidth * this.renderer.getPixelRatio())) this.resize();
    this.frameStart = performance.now();
    this.rig.inertia();
    this.sky.center.copy(this.rig.target);
    const night = this.sky.update(t, this.h.forceDay?.()); setNight(night);
    this.updateChunks();
    this.updateObjects(performance.now());
    // my bastion
    const bp = this.g.basePos();
    this.home.position.set(tw(bp.x), 0, tw(bp.y));
    this.home.traverse((o) => o.userData.anim?.(t));
    setLabel(this.homeLabel, `${this.g.s.alliance ? '[' + this.g.s.alliance.tag + '] ' : ''}${this.g.s.player.name}`, 0.6, { color: '#ffd27a', border: '#7a6040' });
    this.homeLabel.position.set(this.home.position.x, 3.2, this.home.position.z);
    this.shield.visible = this.g.now() < this.g.s.shieldUntil; this.shield.position.copy(this.home.position);
    // animate nearby objects
    for (const m of this.objMeshes.values()) {
      if (m.position.distanceToSquared(this.rig.target) > 900) continue;
      m.traverse((o) => { o.userData.walk?.(t, 0.35); o.userData.anim?.(t); });
      if (m.userData.aura) m.userData.aura.scale.setScalar(3.6 + Math.sin(t * 3) * 0.4);
    }
    for (const tm of this.terrMeshes.values()) tm.traverse((o) => o.userData.anim?.(t));
    this.updateMarches(t, dt);
    this.dust.update(dt);
    // selection ring
    const s = this.sel && this.sel.kind !== 'empty' ? this.sel : null;
    this.selRing.visible = !!s; if (s) { this.selRing.position.set(tw(s.x), 0.06, tw(s.y)); this.selRing.scale.setScalar(1 + Math.sin(t * 6) * 0.06); }
    this.renderer.render(this.scene, this.camera);
  }
}
function fmtK(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n); }
function fmtT(sec) { const m = Math.floor(sec / 60), s = sec % 60; return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; }
export { NODE_TYPES };
