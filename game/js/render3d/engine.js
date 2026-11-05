// Shared 3D engine pieces: renderer, camera rig with touch controls, lighting, labels, particles.
// Everything is procedural low-poly geometry so the game ships no model files.
import * as THREE from '../vendor/three.module.min.js';
import { pixelRatio, getQuality } from '../platform.js';
import { tr } from '../i18n.js';

export { THREE };

export function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { return false; }
}

export function makeRenderer(canvas) {
  const high = getQuality() !== 'low';
  const r = new THREE.WebGLRenderer({ canvas, antialias: high, powerPreference: 'high-performance', alpha: false });
  r.setPixelRatio(pixelRatio());
  r.shadowMap.enabled = high;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.15;
  return r;
}

// ---------- materials (cached) ----------
const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) {
    const m = new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts });
    matCache.set(key, m);
  }
  return matCache.get(key);
}
export function glow(color, intensity = 1) { return mat(color, { emissive: new THREE.Color(color), emissiveIntensity: intensity }); }

// ---------- geometry helpers ----------
const geoCache = new Map();
function cached(key, make) { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); }
export function box(w, h, d, color, opts) {
  const m = new THREE.Mesh(cached(`b${w}|${h}|${d}`, () => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return g; }), typeof color === 'object' ? color : mat(color, opts));
  m.castShadow = true; m.receiveShadow = true; return m;
}
export function cyl(rt, rb, h, color, seg = 10, opts) {
  const m = new THREE.Mesh(cached(`c${rt}|${rb}|${h}|${seg}`, () => { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(0, h / 2, 0); return g; }), typeof color === 'object' ? color : mat(color, opts));
  m.castShadow = true; m.receiveShadow = true; return m;
}
export function cone(r, h, color, seg = 4) {
  const m = new THREE.Mesh(cached(`k${r}|${h}|${seg}`, () => { const g = new THREE.ConeGeometry(r, h, seg); g.translate(0, h / 2, 0); return g; }), typeof color === 'object' ? color : mat(color));
  m.castShadow = true; return m;
}
export function sphere(r, color, seg = 8) {
  const m = new THREE.Mesh(cached(`s${r}|${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2))), typeof color === 'object' ? color : mat(color));
  m.castShadow = true; return m;
}
export function at(obj, x, y, z, ry = 0) { obj.position.set(x, y, z); if (ry) obj.rotation.y = ry; return obj; }
export function group(...kids) { const g = new THREE.Group(); kids.forEach((k) => k && g.add(k)); return g; }

// ---------- canvas-text sprites (labels, badges, bubbles, damage numbers) ----------
const texCache = new Map();
export function textTexture(text, { size = 40, color = '#fff', bg = 'rgba(15,12,10,0.85)', border = null, pad = 14, bold = true, radius = 12 } = {}) {
  const key = [text, size, color, bg, border].join('|');
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'), x = c.getContext('2d');
  const font = `${bold ? '800 ' : ''}${size}px system-ui, -apple-system, "Segoe UI", "Noto Sans Arabic", Tahoma, sans-serif`;
  x.font = font; const w = Math.ceil(x.measureText(text).width) + pad * 2, h = Math.ceil(size * 1.45);
  c.width = w; c.height = h;
  const ctx = c.getContext('2d'); ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (bg) { ctx.fillStyle = bg; roundRect(ctx, 1, 1, w - 2, h - 2, radius); ctx.fill(); if (border) { ctx.strokeStyle = border; ctx.lineWidth = 4; ctx.stroke(); } }
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; if (!bg) ctx.strokeText(text, w / 2, h / 2 + 2);
  ctx.fillStyle = color; ctx.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2;
  const out = { tex: t, aspect: w / h };
  if (texCache.size > 600) texCache.clear();
  texCache.set(key, out); return out;
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
export function label(text, height = 0.5, opts = {}) {
  const { tex, aspect } = textTexture(tr(String(text)), opts);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: opts.depthTest ?? false, transparent: true }));
  s.scale.set(height * aspect, height, 1); s.renderOrder = 10; s.userData.labelText = text;
  return s;
}
export function setLabel(sprite, text, height, opts = {}) {
  if (sprite.userData.labelText === text) return;
  const { tex, aspect } = textTexture(tr(String(text)), opts);
  sprite.material.map = tex; sprite.material.needsUpdate = true; sprite.scale.set(height * aspect, height, 1); sprite.userData.labelText = text;
}
// A soft round glow sprite (lights, sparks, smoke)
let softTex = null;
export function softTexture() {
  if (softTex) return softTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); softTex = new THREE.CanvasTexture(c); return softTex;
}
export function glowSprite(color, size = 1, opacity = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.set(size, size, 1); return s;
}

// ---------- simple particle puffs (smoke, dust, sparks) ----------
export class Puffs {
  constructor(scene, { color = 0x888888, max = 60, additive = false } = {}) {
    this.scene = scene; this.items = []; this.max = max;
    this.mat = new THREE.SpriteMaterial({ map: softTexture(), color, transparent: true, opacity: 0.5, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  }
  emit(pos, { vel = new THREE.Vector3(0, 1, 0), life = 2, size = 0.6, grow = 1.5, spread = 0.2 } = {}) {
    if (this.items.length >= this.max) { const old = this.items.shift(); this.scene.remove(old.s); }
    const s = new THREE.Sprite(this.mat.clone()); s.position.copy(pos); s.position.x += (Math.random() - 0.5) * spread; s.position.z += (Math.random() - 0.5) * spread;
    s.scale.setScalar(size); this.scene.add(s);
    this.items.push({ s, vel: vel.clone(), life, t: 0, size, grow });
  }
  update(dt) {
    this.items = this.items.filter((p) => {
      p.t += dt; if (p.t >= p.life) { this.scene.remove(p.s); p.s.material.dispose(); return false; }
      const f = p.t / p.life; p.s.position.addScaledVector(p.vel, dt); p.s.scale.setScalar(p.size * (1 + f * p.grow)); p.s.material.opacity = 0.5 * (1 - f);
      return true;
    });
  }
}

// ---------- lighting with a day/night cycle ----------
export class Sky {
  constructor(scene, { shadowSize = 30, center = new THREE.Vector3() } = {}) {
    this.scene = scene;
    this.hemi = new THREE.HemisphereLight(0xfff0d8, 0x4a4030, 1.5); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffd9a0, 2.2);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024);
    const c = this.sun.shadow.camera; c.left = -shadowSize; c.right = shadowSize; c.top = shadowSize; c.bottom = -shadowSize; c.near = 1; c.far = 200;
    this.sun.shadow.bias = -0.0008; this.sun.shadow.normalBias = 0.02;
    scene.add(this.sun); scene.add(this.sun.target);
    this.center = center; this.night = 0;
    scene.fog = new THREE.Fog(0x2a2219, 40, 120);
    scene.background = new THREE.Color(0x2a2219);
  }
  update(t, forceDay = false) {
    const cyc = (t / 600) % 1; // 10-minute day
    const n = forceDay ? 0 : Math.max(0, Math.min(1, (Math.sin(cyc * Math.PI * 2 - Math.PI / 2) + 0.35) / 1.0));
    this.night = n;
    const day = new THREE.Color(0x3b2f24), nightC = new THREE.Color(0x0c1020);
    const bg = day.clone().lerp(nightC, n);
    this.scene.background.copy(bg); this.scene.fog.color.copy(bg);
    this.hemi.intensity = 1.55 - n * 1.0; this.hemi.color.setHex(0xffe9c4).lerp(new THREE.Color(0x8aa0ff), n);
    this.sun.intensity = 2.8 - n * 2.2; this.sun.color.setHex(0xffd49a).lerp(new THREE.Color(0x9ab0ff), n);
    const ang = 0.9 + Math.sin(cyc * Math.PI * 2) * 0.35;
    this.sun.position.set(this.center.x + Math.cos(ang) * 30, 38, this.center.z + Math.sin(ang) * 22);
    this.sun.target.position.copy(this.center);
    return n;
  }
}

// ---------- camera rig: drag to pan, pinch to zoom, two-finger twist to rotate, tap ----------
export class CameraRig {
  constructor(canvas, camera, { target = new THREE.Vector3(), dist = 30, minDist = 10, maxDist = 70, pitch = 0.95, yaw = Math.PI / 4, bounds = null, onTap } = {}) {
    this.c = canvas; this.cam = camera; this.target = target.clone(); this.dist = dist; this.minDist = minDist; this.maxDist = maxDist;
    this.pitch = pitch; this.yaw = yaw; this.bounds = bounds; this.onTap = onTap;
    this.pointers = new Map(); this.vel = new THREE.Vector2(); this.moved = 0; this.enabled = true;
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', (e) => this.up(e, true));
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
    // stop the phone's delayed 'ghost click' from hitting a panel that a tap just opened
    canvas.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
    this.apply();
  }
  down(e) {
    if (!this.enabled) return;
    this.c.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) { this.moved = 0; this.start = { x: e.clientX, y: e.clientY, t: performance.now() }; }
    if (this.pointers.size === 2) this.pinch = this.two();
    this.vel.set(0, 0);
  }
  two() { const [a, b] = [...this.pointers.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x) }; }
  move(e) {
    const p = this.pointers.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (this.pointers.size === 2) {
      const n = this.two(); this.zoom(this.pinch.d / Math.max(1, n.d)); this.yaw -= n.ang - this.pinch.ang; this.pinch = n; this.moved += 20; this.apply(); return;
    }
    this.moved += Math.abs(dx) + Math.abs(dy);
    this.panPixels(dx, dy); this.vel.set(dx, dy);
  }
  up(e, cancel) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    if (!cancel && this.pointers.size === 0 && this.moved < 10 && this.start && performance.now() - this.start.t < 600) {
      const r = this.c.getBoundingClientRect(); this.onTap?.(e.clientX - r.left, e.clientY - r.top);
    }
  }
  panPixels(dx, dy) {
    const k = this.dist * 0.0021 * (700 / Math.max(400, this.c.clientHeight));
    const cos = Math.cos(this.yaw), sin = Math.sin(this.yaw);
    // screen right = (cos, -sin) rotated; screen up on ground = forward
    this.target.x -= (dx * cos + dy * sin / Math.cos(this.pitch * 0.6)) * k;
    this.target.z -= (-dx * sin + dy * cos / Math.cos(this.pitch * 0.6)) * k;
    this.apply();
  }
  zoom(f) { this.dist = Math.max(this.minDist, Math.min(this.maxDist, this.dist * f)); this.apply(); }
  inertia() { if (this.pointers.size || this.vel.lengthSq() < 0.2) return; this.panPixels(this.vel.x, this.vel.y); this.vel.multiplyScalar(0.9); }
  apply() {
    if (this.bounds) { const b = this.bounds; this.target.x = Math.max(b.minX, Math.min(b.maxX, this.target.x)); this.target.z = Math.max(b.minZ, Math.min(b.maxZ, this.target.z)); }
    const h = Math.sin(this.pitch) * this.dist, flat = Math.cos(this.pitch) * this.dist;
    this.cam.position.set(this.target.x + Math.sin(this.yaw) * flat, this.target.y + h, this.target.z + Math.cos(this.yaw) * flat);
    this.cam.lookAt(this.target);
  }
}

// Screen point → ray hits
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
export function pick(camera, canvas, sx, sy, objects) {
  ndc.set((sx / canvas.clientWidth) * 2 - 1, -(sy / canvas.clientHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.intersectObjects(objects, true);
}
export function groundPoint(camera, canvas, sx, sy, y = 0) {
  ndc.set((sx / canvas.clientWidth) * 2 - 1, -(sy / canvas.clientHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? p : null;
}
export function disposeTree(obj) {
  obj.traverse((o) => { if (o.material && o.material.map && o.isSprite) o.material.dispose(); });
}

// Merge every static mesh of a model into one mesh per material (huge draw-call saving on phones).
// Subtrees marked userData.dyn (animated parts) are left untouched.
export function bakeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const byMat = new Map(), remove = [];
  const visit = (o, dyn) => {
    const d = dyn || o.userData.dyn;
    if (o.isMesh && !d && !o.material.transparent) {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      if (!byMat.has(o.material)) byMat.set(o.material, []);
      byMat.get(o.material).push(g); remove.push(o);
    }
    for (const c of [...o.children]) visit(c, d);
  };
  for (const c of [...root.children]) visit(c, false);
  for (const o of remove) o.parent.remove(o);
  for (const [m, list] of byMat) {
    let n = 0; for (const g of list) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let off = 0;
    for (const g of list) { pos.set(g.attributes.position.array, off * 3); if (g.attributes.normal) nor.set(g.attributes.normal.array, off * 3); off += g.attributes.position.count; g.dispose(); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
  }
  return root;
}
