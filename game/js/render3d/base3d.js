// 3D base view: buildings, construction, collect bubbles, people, patrol truck, zombies outside the fence,
// day/night lighting and smoke. Same interface as the 2D BaseView so the rest of the game doesn't care.
import { THREE, makeRenderer, Sky, CameraRig, pick, label, setLabel, glowSprite, Puffs, box, cyl, at, group, mat, bakeStatic, textTexture } from './engine.js';
import { makeBuilding, makeConstruction, makePlot, human, zombie, truck, deadTree, wreck, setNight } from './models.js';
import { BASE_LAYOUT, BUILDINGS } from '../data/buildings.js';
import { RES_INFO } from '../data/config.js';
import { getQuality } from '../platform.js';
import { tr } from '../i18n.js';

const OX = 10, OZ = 12; // layout tile → world offset
const wx = (l) => l.x - OX, wz = (l) => l.y - OZ;
const HALF = 11; // compound half-size

export class Base3D {
  constructor(canvas, game, handlers) {
    this.c = canvas; this.g = game; this.h = handlers;
    this.renderer = makeRenderer(canvas);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 300);
    this.rig = new CameraRig(canvas, this.camera, { target: new THREE.Vector3(0, 0, 0.5), dist: 40, minDist: 12, maxDist: 62, pitch: 0.9, yaw: Math.PI / 4, bounds: { minX: -14, maxX: 14, minZ: -14, maxZ: 14 }, onTap: (x, y) => this.tap(x, y) });
    this.cam = this.rig; // tests read cam
    this.sky = new Sky(this.scene, { shadowSize: 18 });
    this.smoke = new Puffs(this.scene, { color: 0x77706a, max: 50 });
    this.sparks = new Puffs(this.scene, { color: 0xffa040, max: 30, additive: true });
    this.slots = new Map(); this.floaters = []; this.selected = null; this.last = 0;
    this.buildGround();
    this.buildLife();
    this.selRing = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.45, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.7, depthWrite: false }));
    this.selRing.rotation.x = -Math.PI / 2; this.selRing.visible = false; this.scene.add(this.selRing);
  }
  center() { this.rig.target.set(0, 0, 0.5); this.rig.dist = 40; this.rig.apply(); }
  resize() {
    const w = this.c.clientWidth, h = this.c.clientHeight; if (!w || !h) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, getQuality() === 'low' ? 1.25 : 2));
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.6 ? 44 : 36; this.camera.updateProjectionMatrix();
    if (!this.sized) { this.rig.dist = w / h < 0.6 ? 42 : 30; this.sized = true; } this.rig.apply();
  }
  // ---------- static scenery ----------
  buildGround() {
    const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    const W = 60, px = S / W, toPx = (v) => (v + W / 2) * px;
    x.fillStyle = '#3d3a2c'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(${60 + Math.random() * 40},${55 + Math.random() * 40},${35 + Math.random() * 20},0.35)`; const r = 2 + Math.random() * 10; x.beginPath(); x.arc(Math.random() * S, Math.random() * S, r, 0, 7); x.fill(); }
    // compound floor
    x.fillStyle = '#75695a'; x.fillRect(toPx(-HALF), toPx(-HALF), HALF * 2 * px, HALF * 2 * px);
    for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(${90 + Math.random() * 40},${80 + Math.random() * 30},${60 + Math.random() * 20},0.3)`; x.fillRect(toPx(-HALF) + Math.random() * HALF * 2 * px, toPx(-HALF) + Math.random() * HALF * 2 * px, 3 + Math.random() * 8, 3 + Math.random() * 8); }
    // roads inside & ring road outside
    x.fillStyle = '#8a8070';
    for (const z of [-5, 3]) x.fillRect(toPx(-9), toPx(z) - px * 0.6, 18 * px, px * 1.2);
    x.fillRect(toPx(0) - px * 0.6, toPx(-9), px * 1.2, 18 * px);
    x.strokeStyle = '#4a463e'; x.lineWidth = px * 1.6; x.strokeRect(toPx(-13), toPx(-13), 26 * px, 26 * px);
    x.strokeStyle = 'rgba(230,200,90,0.5)'; x.lineWidth = px * 0.08; x.setLineDash([px * 0.6, px * 0.6]); x.strokeRect(toPx(-13), toPx(-13), 26 * px, 26 * px); x.setLineDash([]);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, W), new THREE.MeshLambertMaterial({ map: tex }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground);
    // outer void
    const far = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), mat(0x2c281f)); far.rotation.x = -Math.PI / 2; far.position.y = -0.02; this.scene.add(far);
    // fence + props (merged)
    const props = group();
    for (let i = -HALF; i <= HALF; i += 1.1) for (const [px2, pz] of [[i, -HALF], [i, HALF], [-HALF, i], [HALF, i]]) props.add(at(cyl(0.05, 0.06, 0.8, 0x6a5a48, 4), px2, 0, pz));
    for (const [a, b, ry] of [[0, -HALF, 0], [0, HALF, 0], [-HALF, 0, Math.PI / 2], [HALF, 0, Math.PI / 2]]) { props.add(at(box(HALF * 2, 0.05, 0.05, 0x6a5a48), a, 0.55, b, ry)); props.add(at(box(HALF * 2, 0.05, 0.05, 0x6a5a48), a, 0.3, b, ry)); }
    let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 70; i++) { const a = rnd() * Math.PI * 2, r = 15 + rnd() * 14; const t = deadTree(rnd() * 6); t.scale.setScalar(0.8 + rnd() * 1.2); props.add(at(t, Math.cos(a) * r, 0, Math.sin(a) * r)); }
    for (let i = 0; i < 12; i++) { const a = rnd() * Math.PI * 2, r = 15 + rnd() * 10; props.add(at(wreck([0x7a3a2a, 0x3a4a5a, 0x5a5a3a][i % 3]), Math.cos(a) * r, 0, Math.sin(a) * r)); }
    for (let i = 0; i < 25; i++) { const a = rnd() * Math.PI * 2, r = 14 + rnd() * 16, rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + rnd() * 0.5), mat(0x5a544a)); rock.castShadow = true; props.add(at(rock, Math.cos(a) * r, 0.1, Math.sin(a) * r)); }
    // gate
    props.add(at(box(0.3, 1.4, 0.3, 0x5a5248), -1.2, 0, HALF), at(box(0.3, 1.4, 0.3, 0x5a5248), 1.2, 0, HALF), at(box(2.7, 0.25, 0.3, 0x6a6258), 0, 1.4, HALF));
    this.scene.add(bakeStatic(props));
  }
  buildLife() {
    // soldiers walking the paths
    this.walkers = [];
    const paths = [[[-8, -5], [8, -5]], [[0, -8], [0, 8]], [[-8, 3], [8, 3]], [[-6, -5], [-6, 3]], [[6, -5], [6, 3]]];
    for (let i = 0; i < 10; i++) {
      const m = human([0x5d6b45, 0x6a5a4a, 0x4a5a6a][i % 3]); m.scale.setScalar(0.55);
      this.scene.add(m); this.walkers.push({ m, path: paths[i % paths.length], t: Math.random(), speed: 0.03 + Math.random() * 0.03 });
    }
    // horde outside the fence
    this.horde = [];
    for (let i = 0; i < 16; i++) {
      const z = zombie(i % 4 ? 0x7d9a5a : 0x9bd04a, 0.6); const a = -Math.PI * 0.75 + (i / 16) * Math.PI * 0.6, r = 14 + Math.random() * 3;
      at(z, Math.cos(a) * r, 0, Math.sin(a) * r); z.rotation.y = Math.atan2(-z.position.x, -z.position.z);
      this.scene.add(z); this.horde.push({ z, a, r, base: r, ph: Math.random() * 10 });
    }
    // patrol truck on the ring road
    this.truck = truck(0x56603f); this.truck.scale.setScalar(0.9); this.scene.add(this.truck); this.truckT = 0;
    this.truckLight = glowSprite(0xfff1b0, 2, 0.4); this.scene.add(this.truckLight);
  }
  // ---------- slots (buildings / plots) ----------
  slotKey(l) {
    const b = this.g.s.buildings[l.id], q = this.g.s.queues.build.find((x) => x.slot === l.id);
    const unlocked = l.plot || this.g.lvl('hq') >= BUILDINGS[l.type].unlockHQ;
    return `${b?.type || ''}|${b?.lvl || 0}|${q ? 'c' : ''}|${unlocked ? 'u' : 'l'}`;
  }
  syncSlots() {
    for (const l of BASE_LAYOUT) {
      const key = this.slotKey(l);
      let s = this.slots.get(l.id);
      if (s && s.key === key) continue;
      if (s) this.scene.remove(s.root);
      const root = group(); root.position.set(wx(l), 0, wz(l)); root.userData.slot = l.id;
      const b = this.g.s.buildings[l.id], q = this.g.s.queues.build.find((x) => x.slot === l.id);
      const unlocked = l.plot || this.g.lvl('hq') >= BUILDINGS[l.type].unlockHQ;
      let model = null;
      if (b && b.lvl > 0) { model = makeBuilding(b.type, b.lvl); bakeStatic(model); }
      else if (!q) { model = makePlot(l.size * 1.4, !unlocked); if (!unlocked) { const lock = label('🔒', 0.6, { bg: null, size: 44 }); lock.position.y = 0.6; model.add(lock); } else { const plus = label('+', 0.7, { bg: null, color: '#ffd27a', size: 60 }); plus.position.y = 0.5; model.add(plus); } }
      if (model) root.add(model);
      // invisible hit box so taps land easily
      const hit = new THREE.Mesh(new THREE.BoxGeometry(l.size * 1.2, 2, l.size * 1.2), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 1; root.add(hit);
      const st = { key, root, model, l, top: model?.userData.top || 1.2 };
      if (q) { st.crane = makeConstruction(l.size); root.add(st.crane); st.bar = label('', 0.32); st.bar.position.set(0, 2.9, 0); root.add(st.bar); }
      if (b && b.lvl > 0) { st.badge = label(String(b.lvl), 0.34, { color: '#ffd27a', border: '#7a6040' }); st.badge.position.set(-l.size * 0.55, 0.35, l.size * 0.55); root.add(st.badge); }
      this.scene.add(root); this.slots.set(l.id, st);
    }
  }
  updateOverlays(t) {
    const g = this.g;
    for (const st of this.slots.values()) {
      const l = st.l, b = g.s.buildings[l.id], q = g.s.queues.build.find((x) => x.slot === l.id);
      if (q && st.bar) {
        const f = Math.min(1, (g.now() - q.start) / (q.end - q.start)), rem = g.remaining(q);
        setLabel(st.bar, `${'█'.repeat(Math.round(f * 8))}${'░'.repeat(8 - Math.round(f * 8))} ${fmtShort(rem)}`, 0.32, { color: '#f2b33d' });
      }
      // collect bubble
      const res = b && b.lvl > 0 && BUILDINGS[b.type].produces;
      const showBubble = res && !q && g.pending(l.id) > 0 && g.pendingFrac(l.id) > 0.02;
      if (showBubble && !st.bubble) { st.bubble = label(RES_INFO[res].icon, 0.75, { bg: 'rgba(255,255,255,0.95)', border: RES_INFO[res].color, size: 46, radius: 30 }); st.bubble.userData.bubble = l.id; st.root.add(st.bubble); }
      if (!showBubble && st.bubble) { st.root.remove(st.bubble); st.bubble = null; }
      if (st.bubble) st.bubble.position.set(0, st.top + 0.5 + Math.sin(t * 3 + l.x) * 0.12, 0);
      // status icon (idle barracks, wounded, free recruit, idle lab)
      let icon = null;
      if (b && b.lvl > 0) {
        if (BUILDINGS[b.type].trains && !g.s.queues.train[b.type]) icon = '💤';
        if (b.type === 'hospital' && g.woundedTotal() > 0 && !g.s.queues.heal) icon = '🩹';
        if (b.type === 'research' && !g.s.queues.research.length) icon = '💤';
        if (b.type === 'tavern' && g.freeRecruitReady()) icon = '🎁';
      }
      if (icon !== st.iconText) { if (st.icon) st.root.remove(st.icon); st.icon = icon ? label(icon, 0.55, { bg: null, size: 44 }) : null; if (st.icon) st.root.add(st.icon); st.iconText = icon; }
      if (st.icon) st.icon.position.set(l.size * 0.45, st.top + 0.2 + Math.sin(t * 2.5 + l.y) * 0.1, 0);
    }
  }
  float(text, slotId, color) {
    const st = this.slots.get(slotId); if (!st) return;
    const s = label(text, 0.5, { bg: null, color: color || '#fff', size: 44 });
    s.position.set(st.root.position.x, st.top + 0.8, st.root.position.z); this.scene.add(s); this.floaters.push({ s, t: 0 });
  }
  tap(sx, sy) {
    const objs = []; for (const st of this.slots.values()) objs.push(st.root);
    const hits = pick(this.camera, this.c, sx, sy, objs);
    const bubbleHit = hits.find((h) => h.object.userData.bubble);
    if (bubbleHit) {
      const id = bubbleHit.object.userData.bubble, v = this.g.collect(id);
      if (v) { const res = BUILDINGS[this.g.s.buildings[id].type].produces; this.float('+' + v.toLocaleString() + ' ' + RES_INFO[res].icon, id, RES_INFO[res].color); this.h.sfx?.('collect'); }
      return;
    }
    let slot = null;
    for (const h of hits) { let o = h.object; while (o && !o.userData.slot) o = o.parent; if (o) { slot = o.userData.slot; break; } }
    if (!slot) { this.selected = null; return; }
    this.selected = slot; this.h.onSelect?.(slot);
  }
  // Screen position of a slot (used by tests / tutorials)
  slotScreen(id) {
    const st = this.slots.get(id) || { root: { position: new THREE.Vector3(wx(BASE_LAYOUT.find((l) => l.id === id)), 0, wz(BASE_LAYOUT.find((l) => l.id === id))) } };
    const p = st.root.position.clone(); p.y = 0.8; p.project(this.camera);
    return { x: (p.x + 1) / 2 * this.c.clientWidth, y: (1 - p.y) / 2 * this.c.clientHeight };
  }
  screenOf(id) { return this.slotScreen(id); }
  render(t) {
    const dt = Math.min(0.1, this.last ? t - this.last : 0.016); this.last = t;
    if (!this.c.clientWidth) return;
    if (this.c.width !== Math.floor(this.c.clientWidth * this.renderer.getPixelRatio())) this.resize();
    this.rig.inertia();
    this.syncSlots();
    const night = this.sky.update(t, this.h.forceDay?.());
    setNight(night); this.isNight = night > 0.5;
    this.updateOverlays(t);
    // animations
    for (const st of this.slots.values()) {
      st.model?.traverse?.((o) => o.userData.anim?.(t, dt, night));
      st.crane?.userData.anim?.(t);
      if (st.model?.userData.smoke && Math.random() < dt * 3) for (const p of st.model.userData.smoke) this.smoke.emit(p.clone().add(st.root.position), { vel: new THREE.Vector3(0.15, 0.8, 0), life: 3, size: 0.4, grow: 2.5 });
      if (st.model?.userData.sparks && Math.random() < dt * 6) this.sparks.emit(new THREE.Vector3(-0.4, 1.5, -0.3).add(st.root.position), { vel: new THREE.Vector3((Math.random() - 0.5), 1.5, (Math.random() - 0.5)), life: 0.7, size: 0.12, grow: 0 });
    }
    this.smoke.update(dt); this.sparks.update(dt);
    for (const w of this.walkers) {
      w.t = (w.t + w.speed * dt) % 1; const k = w.t < 0.5 ? w.t * 2 : 2 - w.t * 2; const [a, b] = w.path;
      const x = a[0] + (b[0] - a[0]) * k, z = a[1] + (b[1] - a[1]) * k; w.m.position.set(x, 0, z);
      w.m.rotation.y = Math.atan2((b[0] - a[0]) * (w.t < 0.5 ? 1 : -1), (b[1] - a[1]) * (w.t < 0.5 ? 1 : -1)); w.m.userData.walk(t);
    }
    for (const z of this.horde) { z.r = z.base - Math.abs(Math.sin(t * 0.15 + z.ph)) * 1.2; z.z.position.set(Math.cos(z.a) * z.r, 0, Math.sin(z.a) * z.r); z.z.userData.walk(t); }
    // truck drives the ring road (square path, radius 13)
    this.truckT = (this.truckT + dt * 0.035) % 1;
    const P = squarePath(this.truckT, 13), P2 = squarePath((this.truckT + 0.005) % 1, 13);
    this.truck.position.set(P.x, 0, P.z); this.truck.rotation.y = Math.atan2(P2.x - P.x, P2.z - P.z); this.truck.userData.drive(this.truckT * 104);
    this.truckLight.position.set(P2.x + (P2.x - P.x) * 6, 0.4, P2.z + (P2.z - P.z) * 6); this.truckLight.visible = night > 0.4;
    // selection ring
    const sel = this.selected && this.slots.get(this.selected);
    this.selRing.visible = !!sel; if (sel) { this.selRing.position.set(sel.root.position.x, 0.05, sel.root.position.z); this.selRing.scale.setScalar(sel.l.size * 0.75 * (1 + Math.sin(t * 5) * 0.05)); }
    this.floaters = this.floaters.filter((f) => { f.t += dt; f.s.position.y += dt * 1.2; f.s.material.opacity = 1 - f.t / 1.6; if (f.t > 1.6) { this.scene.remove(f.s); return false; } return true; });
    this.renderer.render(this.scene, this.camera);
  }
}
function squarePath(f, r) {
  const side = Math.floor(f * 4), k = f * 4 - side;
  return [{ x: -r + 2 * r * k, z: r }, { x: r, z: r - 2 * r * k }, { x: r - 2 * r * k, z: -r }, { x: -r, z: -r + 2 * r * k }][side];
}
function fmtShort(sec) {
  sec = Math.max(0, Math.round(sec)); const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  if (d) return `${d}d ${h}h`; if (h) return `${h}h ${m}m`; if (m) return `${m}m ${s}s`; return `${s}s`;
}
export { textTexture, tr };
