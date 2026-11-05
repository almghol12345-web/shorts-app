// Procedural low-poly 3D models. Buildings change materials and add parts at each level tier.
// Each model is a THREE.Group; groups may carry userData.anim(t, dt, night) for animation and
// userData.smoke = [Vector3 local points] for chimney smoke.
import { THREE, box, cyl, cone, sphere, at, group, mat, glow, glowSprite } from './engine.js';

export function tierOf(lvl) { return lvl < 5 ? 0 : lvl < 10 ? 1 : lvl < 15 ? 2 : lvl < 20 ? 3 : 4; }
// wall, roof, trim, window-glow per tier: scrap wood → sheet metal → concrete → armored → hi-tech
const MAT = [
  { wall: 0x7a5a3c, roof: 0x5b3f28, trim: 0xa07a50, win: 0xffb35c, metal: 0x6f6a62 },
  { wall: 0x7d848a, roof: 0x4f565c, trim: 0xa8b0b6, win: 0xffc46b, metal: 0x8a9096 },
  { wall: 0x9a9a90, roof: 0x4d5a62, trim: 0xc9b98f, win: 0xffd27a, metal: 0x7f8a90 },
  { wall: 0x4f565c, roof: 0x30363b, trim: 0xe0832f, win: 0xff9a3c, metal: 0x3e454b },
  { wall: 0x34404c, roof: 0x1f2832, trim: 0x47e0ff, win: 0x6ff3ff, metal: 0x2a3440 },
];
const windowMats = new Map();
// window materials glow at night; shared so one update per frame drives them all
function winMat(color) { if (!windowMats.has(color)) windowMats.set(color, new THREE.MeshLambertMaterial({ color: 0x1c2228, emissive: new THREE.Color(color), emissiveIntensity: 0.2 })); return windowMats.get(color); }
export function setNight(n) { for (const m of windowMats.values()) m.emissiveIntensity = 0.15 + n * 1.6; }

function windows(g, w, h, d, rows, color, y0 = 0) {
  const m = winMat(color), cols = Math.max(1, Math.round(w * 1.4));
  for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) {
    const x = -w / 2 + (i + 0.5) * (w / cols), y = y0 + (r + 0.45) * (h / rows);
    g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.22), m), x, y, d / 2 + 0.01));
    if (i === 0) g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.22), m), w / 2 + 0.01, y, 0, Math.PI / 2));
  }
}
function gable(w, d, h, color) { // prism roof along x
  const s = new THREE.Shape(); s.moveTo(-d / 2, 0); s.lineTo(0, h); s.lineTo(d / 2, 0); s.lineTo(-d / 2, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false }); geo.translate(0, 0, -w / 2); geo.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(geo, mat(color)); m.castShadow = true; return m;
}
function flag(color, h = 1.4) {
  const g = group(cyl(0.025, 0.025, h, 0x333333, 5));
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.36, 6, 1), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  cloth.position.set(0.3, h - 0.2, 0); g.add(cloth);
  const base = cloth.geometry.attributes.position.array.slice();
  g.userData.dyn = true;
  g.userData.anim = (t) => { const p = cloth.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = base[i * 3]; p.array[i * 3 + 2] = Math.sin(t * 4 + x * 6) * 0.06 * (x + 0.3); } p.needsUpdate = true; };
  return g;
}
function sandbags(g, n, r, y = 0) { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI - Math.PI / 2; const s = sphere(0.14, 0x8a7a5a, 6); s.scale.set(1.4, 0.7, 1); g.add(at(s, Math.sin(a) * r, y + 0.08, Math.cos(a) * r)); } }
function antenna(g, x, y, z, h, light = true) {
  g.add(at(cyl(0.02, 0.03, h, 0x2a2a2a, 5), x, y, z));
  if (light) { const l = sphere(0.06, glow(0xff3b30, 2), 6); l.userData.dyn = true; at(l, x, y + h, z); g.add(l); const blink = l; const prev = g.userData.anim; g.userData.anim = (t, dt, n) => { prev?.(t, dt, n); blink.visible = Math.sin(t * 4) > 0; }; }
}
function pad(size, color = 0x423a30) { const p = box(size, 0.06, size, color); p.castShadow = false; return p; }
function addAnim(g, f) { const prev = g.userData.anim; g.userData.anim = (t, dt, n) => { prev?.(t, dt, n); f(t, dt, n); }; }
function chain(g, child) { if (child.userData.anim) addAnim(g, child.userData.anim); return child; }

// ---------------- buildings ----------------
const B = {
  hq(lvl) {
    const tr = tierOf(lvl), m = MAT[tr], g = group(pad(3.2));
    const h1 = 1.3 + tr * 0.25;
    const b1 = group(box(2.4, h1, 2.4, m.wall)); windows(b1, 2.4, h1, 2.4, 2, m.win); g.add(b1);
    const h2 = 0.9 + tr * 0.25; const b2 = group(box(1.6, h2, 1.6, m.wall)); windows(b2, 1.6, h2, 1.6, 1 + (tr > 1), m.win); b2.position.y = h1; g.add(b2);
    let top = h1 + h2;
    g.add(at(box(2.6, 0.08, 2.6, m.trim), 0, h1, 0));
    if (tr >= 2) { const b3 = box(0.8, 0.6 + tr * 0.15, 0.8, m.roof); b3.position.y = top; g.add(b3); top += 0.6 + tr * 0.15; }
    if (tr >= 3) for (const [x, z] of [[-1.15, -1.15], [1.15, -1.15], [-1.15, 1.15], [1.15, 1.15]]) g.add(at(cyl(0.18, 0.22, h1 + 0.4, m.metal, 8), x, 0, z));
    if (tr >= 4) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 6, 24), glow(0x47e0ff, 2)); ring.rotation.x = Math.PI / 2; ring.userData.dyn = true; at(ring, 0, top + 0.3, 0); g.add(ring); addAnim(g, (t) => { ring.rotation.z = t; }); }
    antenna(g, 0.2, top, 0.2, 1.1);
    g.add(at(chain(g, flag(tr >= 3 ? 0xe0832f : 0xb23a2a)), -0.6, top, -0.4));
    sandbags(g, 9, 1.55);
    g.userData.top = top + 1.2;
    return g;
  },
  wall(lvl) {
    const tr = tierOf(lvl), m = MAT[tr], g = group();
    for (let i = -3; i <= 3; i++) {
      const seg = box(0.95, 0.55 + tr * 0.12, 0.35, i % 2 ? m.wall : m.roof); at(seg, i * 0.95, 0, 0); g.add(seg);
      if (tr >= 1) for (let k = -1; k <= 1; k++) g.add(at(cone(0.05, 0.25, 0x2a2a2a, 4), i * 0.95 + k * 0.28, 0.55 + tr * 0.12, 0));
      if (tr >= 3 && i % 2 === 0) g.add(at(box(0.96, 0.08, 0.36, m.trim), i * 0.95, 0.25, 0.01));
    }
    if (tr >= 2) { g.add(at(cyl(0.3, 0.35, 1.1 + tr * 0.1, m.metal, 8), -3.4, 0, 0)); g.add(at(cyl(0.3, 0.35, 1.1 + tr * 0.1, m.metal, 8), 3.4, 0, 0)); }
    g.userData.top = 1.4; return g;
  },
  farm(lvl) {
    const tr = tierOf(lvl), m = MAT[tr], g = group(pad(2, 0x3d3a2a));
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const p = sphere(0.16, 0x4f8a35, 5); p.scale.y = 0.7; g.add(at(p, -0.6 + i * 0.35, 0.1, 0.35 + j * 0.35)); }
    g.add(at(box(0.7, 0.55 + tr * 0.1, 0.6, m.wall), -0.5, 0, -0.45));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.62 + tr * 0.06, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: tr >= 2 ? 0x8af0b8 : 0xb0e0a0, transparent: true, opacity: 0.55, emissive: 0x2a6a3a, emissiveIntensity: 0.3 }));
    at(dome, 0.45, 0.05, -0.2); g.add(dome);
    g.userData.top = 1.3; return g;
  },
  lumber(lvl) {
    const tr = tierOf(lvl), m = MAT[tr], g = group(pad(2, 0x3e3428));
    const shed = group(box(1, 0.6 + tr * 0.1, 0.8, m.wall)); const r = gable(1.05, 0.9, 0.35, m.roof); r.position.y = 0.6 + tr * 0.1; shed.add(r); at(shed, -0.35, 0, -0.3); g.add(shed);
    for (let i = 0; i < 3 + tr; i++) { const log = cyl(0.11, 0.11, 0.9, 0x8b5a2b, 7); log.rotation.z = Math.PI / 2; at(log, 0.45 + (i % 3) * 0.02, 0.11 + Math.floor(i / 3) * 0.2, 0.3 + (i % 3) * 0.22 - 0.2); log.position.x += 0.0; g.add(log); }
    const saw = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 12), mat(0xcccccc)); saw.rotation.x = Math.PI / 2; saw.userData.dyn = true; at(saw, -0.35, 1.05 + tr * 0.1, 0.12); g.add(saw);
    addAnim(g, (t) => { saw.rotation.y = t * 6; });
    g.userData.top = 1.5; return g;
  },
  foundry(lvl) {
    const tr = tierOf(lvl), m = MAT[tr], g = group(pad(2, 0x3a3532));
    const b = group(box(1.3, 0.75 + tr * 0.12, 1.1, m.wall)); g.add(b);
    g.add(at(cyl(0.16, 0.2, 1.6 + tr * 0.2, 0x5a4a40, 8), 0.45, 0, -0.3));
    const fire = box(0.5, 0.3, 0.02, glow(0xff7a1a, 2.5)); at(fire, 0, 0.1, 0.56); g.add(fire);
    const l = glowSprite(0xff7a1a, 1.4, 0.6); at(l, 0, 0.35, 0.7); g.add(l);
    g.userData.smoke = [new THREE.Vector3(0.45, 1.7 + tr * 0.2, -0.3)]; g.userData.top = 2; return g;
  },
  refinery(lvl) {
    const tr = tierOf(lvl), g = group(pad(2, 0x35322f));
    g.add(at(cyl(0.45, 0.45, 0.8 + tr * 0.15, tr >= 3 ? 0x8a8f94 : 0xa08a6a, 12), -0.4, 0, 0.2));
    g.add(at(cyl(0.38, 0.38, 1.1 + tr * 0.2, tr >= 3 ? 0x9aa0a5 : 0xb09a7a, 12), 0.45, 0, -0.25));
    g.add(at(cyl(0.04, 0.05, 1.9 + tr * 0.15, 0x444444, 5), 0, 0, -0.6));
    const flame = glowSprite(0xffa040, 0.6, 0.9); at(flame, 0, 2.05 + tr * 0.15, -0.6); g.add(flame);
    addAnim(g, (t) => { flame.scale.setScalar(0.5 + Math.sin(t * 13) * 0.12); });
    g.userData.top = 2.4; return g;
  },
  warehouse(lvl) {
    const tr = tierOf(lvl), m = MAT[tr], g = group();
    const h = 0.8 + tr * 0.12, b = group(box(2.2, h, 1.5, m.wall)); const r = gable(2.25, 1.6, 0.4, m.roof); r.position.y = h; b.add(r); g.add(b);
    g.add(at(box(0.8, 0.6, 0.02, 0x2b2b2b), 0, 0, 0.76));
    for (let i = 0; i < 2 + tr; i++) g.add(at(box(0.3, 0.3, 0.3, 0x9a7a4a), 1.3 - (i % 3) * 0.35, Math.floor(i / 3) * 0.3, 0.95));
    g.userData.top = 1.8; return g;
  },
  barracks(lvl) {
    const tr = tierOf(lvl), m = MAT[tr], g = group(pad(2.2, 0x3b3a30));
    const h = 0.6 + tr * 0.15, b = group(box(1.9, h, 1.2, tr ? m.wall : 0x5d6b45)); windows(b, 1.9, h, 1.2, 1, m.win); const r = gable(1.95, 1.3, 0.5, tr ? m.roof : 0x4d5a38); r.position.y = h; b.add(r); g.add(b);
    g.add(at(chain(g, flag(0x4a6b3a)), -1, 0, 0.8));
    if (tr >= 2) g.add(at(box(0.35, 1.3, 0.35, 0x555555), 1.05, 0, -0.5));
    g.userData.top = 1.7; return g;
  },
  range(lvl) {
    const tr = tierOf(lvl), m = MAT[tr], g = group(pad(2.2, 0x3a3a33));
    const b = group(box(1.1, 0.6 + tr * 0.1, 1.1, m.wall)); windows(b, 1.1, 0.6 + tr * 0.1, 1.1, 1, m.win); at(b, -0.5, 0, -0.4); g.add(b);
    for (let i = 0; i < 3; i++) { const tgt = group(cyl(0.03, 0.03, 0.5, 0x5a4a3a, 4)); const d = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), mat(0xdddddd, { side: THREE.DoubleSide })); d.position.y = 0.6; const d2 = new THREE.Mesh(new THREE.CircleGeometry(0.11, 12), mat(0xcc3333, { side: THREE.DoubleSide })); d2.position.set(0, 0.6, 0.005); tgt.add(d, d2); at(tgt, 0.3 + i * 0.3, 0, 0.5 - i * 0.05); g.add(tgt); }
    g.userData.top = 1.3; return g;
  },
  garage(lvl) {
    const tr = tierOf(lvl), m = MAT[tr], g = group(pad(2.2, 0x34312d));
    const b = group(box(1.5, 0.85 + tr * 0.1, 1.2, m.wall)); at(b, -0.25, 0, -0.3); g.add(b);
    g.add(at(box(0.9, 0.65, 0.02, 0x222222), -0.25, 0, 0.31));
    g.add(at(box(0.92, 0.06, 0.03, tr >= 3 ? m.trim : 0xc9a030), -0.25, 0.68, 0.32));
    const car = buggy(tr >= 3 ? 0x4a5a3a : 0xa0552a); car.userData.dyn = true; car.scale.setScalar(0.8); at(car, 0.6, 0, 0.55, -0.6); g.add(chain(g, car));
    g.userData.top = 1.6; return g;
  },
  hospital(lvl) {
    const tr = tierOf(lvl), g = group(pad(2.2, 0x3c3b37));
    const h = 0.8 + tr * 0.2, b = group(box(1.7, h, 1.3, tr >= 3 ? 0xc9ced1 : 0xbdb6a6)); windows(b, 1.7, h, 1.3, 1 + (tr > 1), 0xbfffff); g.add(b);
    const cr = group(box(0.5, 0.06, 0.16, 0xd92b2b), box(0.16, 0.06, 0.5, 0xd92b2b)); cr.position.y = h; g.add(cr);
    if (tr >= 2) { const hp = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.3, 16), mat(0xdddddd, { side: THREE.DoubleSide })); hp.rotation.x = -Math.PI / 2; at(hp, 0.5, h + 0.01, 0.3); g.add(hp); }
    g.userData.top = h + 0.8; return g;
  },
  research(lvl) {
    const tr = tierOf(lvl), m = MAT[tr], g = group(pad(2.2, 0x35383a));
    const h = 0.8 + tr * 0.15, b = group(box(1.6, h, 1.4, m.wall)); windows(b, 1.6, h, 1.4, 1 + (tr > 2), 0x99eeff); g.add(b);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), tr >= 4 ? glow(0x50dcff, 0.6) : mat(0xb8c0c8)); at(dome, -0.1, h, 0); g.add(dome);
    const dish = group(cyl(0.03, 0.03, 0.4, 0x999999, 5)); const plate = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 4, 0, Math.PI * 2, 0, Math.PI / 3), mat(0xcccccc, { side: THREE.DoubleSide })); plate.rotation.x = Math.PI; plate.position.y = 0.55; dish.add(plate); dish.userData.dyn = true; at(dish, 0.55, h, 0.4); g.add(dish);
    addAnim(g, (t) => { dish.rotation.y = t * 0.6; });
    g.userData.top = h + 1; return g;
  },
  drill(lvl) {
    const tr = tierOf(lvl), g = group(pad(2.2, 0x4a4030));
    const postM = tr >= 2 ? 0x99aaaa : 0x7a5a3a;
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(at(cyl(0.03, 0.03, 0.4, postM, 4), x, 0, z));
    for (const [x, z, ry] of [[0, -1, 0], [0, 1, 0], [-1, 0, Math.PI / 2], [1, 0, Math.PI / 2]]) g.add(at(box(2, 0.03, 0.03, postM), x, 0.32, z, ry));
    const men = [];
    for (let i = 0; i < 3 + tr; i++) { const s = human(0x5d6b45); s.userData.dyn = true; s.scale.setScalar(0.55); at(s, -0.6 + (i % 3) * 0.6, 0, -0.4 + Math.floor(i / 3) * 0.6); g.add(s); men.push(s); }
    addAnim(g, (t) => men.forEach((s, i) => { s.position.y = Math.abs(Math.sin(t * 5 + i)) * 0.12; }));
    g.userData.top = 1.2; return g;
  },
  tavern(lvl) {
    const tr = tierOf(lvl), m = MAT[tr], g = group(pad(2.2, 0x3e362c));
    const h = 1 + tr * 0.15, b = group(box(1.6, h, 1.3, tr < 2 ? 0x7a5a3c : m.wall)); windows(b, 1.6, h, 1.3, 2, 0xffc46b); const r = gable(1.65, 1.4, 0.55, tr < 2 ? 0x5a3424 : m.roof); r.position.y = h; b.add(r); g.add(b);
    g.add(at(box(0.6, 0.25, 0.04, 0x3a2516), -0.3, h * 0.75, 0.68));
    const lamp = glowSprite(0xffb35c, 1.2, 0.5); at(lamp, 0.4, h * 0.6, 0.8); g.add(lamp);
    g.userData.top = h + 1.1; return g;
  },
  alliance(lvl) {
    const tr = tierOf(lvl), m = MAT[tr], g = group(pad(2.2, 0x3a3a3a));
    g.add(box(1.2, 0.55, 1.2, m.wall));
    const h = 2.2 + tr * 0.4;
    for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]]) { const leg = cyl(0.025, 0.025, h, 0x8a8a8a, 4); leg.position.set(x, 0.55, z); leg.rotation.z = -x * 0.25; leg.rotation.x = z * 0.25; g.add(leg); }
    const beacon = sphere(0.09, glow(0x58c4a0, 2), 6); beacon.userData.dyn = true; at(beacon, 0, h + 0.5, 0); g.add(beacon);
    const halo = glowSprite(0x58c4a0, 1.2, 0.7); at(halo, 0, h + 0.5, 0); g.add(halo);
    addAnim(g, (t) => { const on = Math.sin(t * 3) > 0; beacon.visible = on; halo.visible = on; });
    g.add(at(chain(g, flag(0x58c4a0, 1.2)), 0.8, 0, 0.6));
    g.userData.top = h + 1; return g;
  },
  tower(lvl) {
    const tr = tierOf(lvl), m = MAT[tr], g = group();
    const h = 1.6 + tr * 0.35;
    g.add(cyl(0.32, 0.42, h, m.wall, 8));
    g.add(at(cyl(0.5, 0.45, 0.3, m.roof, 8), 0, h, 0));
    const turret = group(box(0.35, 0.25, 0.35, 0x333333), at(box(0.07, 0.07, 0.6 + tr * 0.06, 0x222222), 0.08, 0.12, 0.35), at(box(0.07, 0.07, 0.6 + tr * 0.06, 0x222222), -0.08, 0.12, 0.35));
    turret.position.y = h + 0.3; turret.userData.dyn = true; g.add(turret);
    addAnim(g, (t) => { turret.rotation.y = Math.sin(t * 0.7) * 1.2; });
    g.userData.top = h + 1.2; return g;
  },
  forge(lvl) {
    const tr = tierOf(lvl), m = MAT[tr], g = group();
    g.add(box(1.3, 0.75 + tr * 0.12, 1.1, m.wall));
    g.add(at(cyl(0.13, 0.16, 1.4, 0x444444, 8), -0.4, 0, -0.3));
    g.add(at(box(0.4, 0.3, 0.02, glow(0xff8a2e, 2.5)), 0.1, 0.1, 0.56));
    g.userData.smoke = [new THREE.Vector3(-0.4, 1.5, -0.3)]; g.userData.sparks = true; g.userData.top = 1.6; return g;
  },
  radar(lvl) {
    const tr = tierOf(lvl), m = MAT[tr], g = group();
    const h = 1.1 + tr * 0.25; g.add(box(0.6, h, 0.6, m.wall));
    const dish = group(cyl(0.04, 0.04, 0.3, 0x555555, 5)); const plate = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 4, 0, Math.PI * 2, 0, Math.PI / 3.2), mat(0xc8d0d6, { side: THREE.DoubleSide })); plate.rotation.x = -Math.PI / 2.4; plate.position.set(0, 0.45, 0); dish.add(plate); dish.position.y = h; dish.userData.dyn = true; g.add(dish);
    addAnim(g, (t) => { dish.rotation.y = t * 1.2; });
    g.userData.top = h + 1; return g;
  },
};
export function makeBuilding(type, lvl) {
  const f = B[type]; if (!f) return group();
  const g = f(Math.max(1, lvl)); g.userData.type = type; return g;
}
export function makeConstruction(size) {
  const g = group(), col = 0xd9a030, s = size * 0.55;
  for (const [x, z] of [[-s, -s], [s, -s], [s, s], [-s, s]]) g.add(at(cyl(0.03, 0.03, 1.6, col, 4), x, 0, z));
  for (let k = 1; k <= 3; k++) for (const [x, z, ry] of [[0, -s, 0], [0, s, 0], [-s, 0, Math.PI / 2], [s, 0, Math.PI / 2]]) g.add(at(box(s * 2, 0.03, 0.03, col), x, k * 0.5, z, ry));
  const crane = group(cyl(0.05, 0.05, 2.6, 0xe8b020, 4), at(box(2.2, 0.07, 0.07, 0xe8b020), 0.8, 2.6, 0), at(box(0.25, 0.2, 0.25, 0x8a6a3a), 1.6, 1.8, 0));
  at(crane, s + 0.3, 0, -s); g.add(crane);
  g.userData.anim = (t) => { crane.rotation.y = Math.sin(t * 0.6) * 0.8; };
  return g;
}
export function makePlot(size, locked) {
  const g = group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(size * 0.5, size * 0.56, 4, 1, Math.PI / 4), new THREE.MeshBasicMaterial({ color: locked ? 0x8a7a6a : 0xffd27a, transparent: true, opacity: locked ? 0.25 : 0.55 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.75, size * 0.75), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: locked ? 0.03 : 0.08 }));
  fill.rotation.x = -Math.PI / 2; fill.rotation.z = Math.PI / 4; fill.position.y = 0.02; g.add(fill);
  return g;
}

// ---------------- characters ----------------
export function human(color = 0x5d6b45, skin = 0xd9a983, helmet = 0x3a4a2a) {
  const g = group();
  const legL = at(box(0.13, 0.4, 0.14, 0x2a2a2a), -0.08, 0, 0), legR = at(box(0.13, 0.4, 0.14, 0x2a2a2a), 0.08, 0, 0);
  const body = at(box(0.36, 0.42, 0.22, color), 0, 0.4, 0);
  const head = at(sphere(0.14, skin, 7), 0, 0.95, 0);
  const cap = at(sphere(0.15, helmet, 7), 0, 1.0, 0); cap.scale.y = 0.55;
  const gun = at(box(0.05, 0.05, 0.42, 0x222222), 0.2, 0.6, 0.12);
  g.add(legL, legR, body, head, cap, gun);
  g.userData.walk = (t, speed = 1) => { legL.rotation.x = Math.sin(t * 8 * speed) * 0.6; legR.rotation.x = -Math.sin(t * 8 * speed) * 0.6; };
  return g;
}
export function zombie(color = 0x7d9a5a, scale = 1) {
  const g = group();
  const legL = at(box(0.13, 0.38, 0.14, 0x3a3328), -0.08, 0, 0), legR = at(box(0.13, 0.38, 0.14, 0x3a3328), 0.08, 0, 0);
  const body = at(box(0.36, 0.42, 0.22, 0x5a4a3a), 0, 0.38, 0); body.rotation.x = 0.25;
  const head = at(sphere(0.15, color, 6), 0, 0.92, 0.08);
  const armL = at(box(0.09, 0.09, 0.45, color), -0.22, 0.7, 0.25), armR = at(box(0.09, 0.09, 0.45, color), 0.22, 0.7, 0.25);
  const eyes = at(box(0.16, 0.03, 0.02, glow(0xff3b1f, 2)), 0, 0.94, 0.22);
  g.add(legL, legR, body, head, armL, armR, eyes);
  g.scale.setScalar(scale);
  const off = Math.random() * 10;
  g.userData.walk = (t, speed = 0.5) => { legL.rotation.x = Math.sin((t + off) * 6 * speed) * 0.5; legR.rotation.x = -Math.sin((t + off) * 6 * speed) * 0.5; armL.rotation.y = Math.sin(t * 2 + off) * 0.2; armR.rotation.y = -Math.sin(t * 2 + off) * 0.2; };
  return g;
}

// ---------------- vehicles ----------------
function wheel(r = 0.16) { const w = cyl(r, r, 0.12, 0x1c1c1c, 10); w.rotation.z = Math.PI / 2; return w; }
export function buggy(color = 0xa0552a) {
  const g = group(), body = group();
  body.add(at(box(0.7, 0.22, 1.1, color), 0, 0.18, 0));
  body.add(at(box(0.6, 0.06, 0.4, 0x333333), 0, 0.42, -0.15));
  for (const [x, z] of [[-0.25, -0.05], [0.25, -0.05], [-0.25, -0.35], [0.25, -0.35]]) body.add(at(cyl(0.02, 0.02, 0.3, 0x333333, 4), x, 0.4, z));
  body.add(at(box(0.08, 0.08, 0.35, 0x222222), 0, 0.5, 0.2));
  g.add(body);
  const wheels = [[-0.38, 0.35], [0.38, 0.35], [-0.38, -0.35], [0.38, -0.35]].map(([x, z]) => at(wheel(), x, 0.16, z));
  wheels.forEach((w) => g.add(w));
  g.userData.drive = (dist) => { wheels.forEach((w) => { w.rotation.x = dist * 6; }); body.position.y = Math.sin(dist * 20) * 0.015; };
  g.userData.anim = (t) => { body.position.y = Math.sin(t * 9) * 0.006; };
  return g;
}
export function truck(color = 0x56603f) {
  const g = group(), body = group();
  body.add(at(box(0.8, 0.5, 0.55, color), 0, 0.2, 0.55));
  body.add(at(box(0.7, 0.04, 0.3, 0x88aacc), 0, 0.55, 0.83));
  body.add(at(box(0.85, 0.55, 1.1, color), 0, 0.2, -0.3));
  body.add(at(box(0.9, 0.08, 1.15, 0x3e452e), 0, 0.75, -0.3));
  body.add(at(box(0.6, 0.06, 0.06, 0x222222), 0, 0.15, 0.85));
  const lights = [-0.25, 0.25].map((x) => at(box(0.12, 0.08, 0.02, glow(0xfff1b0, 2)), x, 0.35, 0.83)); lights.forEach((l) => body.add(l));
  g.add(body);
  const wheels = [[-0.45, 0.55], [0.45, 0.55], [-0.45, -0.15], [0.45, -0.15], [-0.45, -0.55], [0.45, -0.55]].map(([x, z]) => at(wheel(0.18), x, 0.18, z));
  wheels.forEach((w) => g.add(w));
  g.userData.drive = (dist) => { wheels.forEach((w) => { w.rotation.x = dist * 5; }); body.position.y = Math.abs(Math.sin(dist * 14)) * 0.02; };
  return g;
}
export function drone() {
  const g = group(at(box(0.3, 0.08, 0.3, 0x333a40), 0, 0, 0));
  const rotors = [[-0.25, -0.25], [0.25, -0.25], [0.25, 0.25], [-0.25, 0.25]].map(([x, z]) => { const r = at(box(0.3, 0.01, 0.04, 0xaaaaaa), x, 0.06, z); g.add(r); g.add(at(cyl(0.02, 0.02, 0.06, 0x222222, 4), x, 0, z)); return r; });
  const l = sphere(0.04, glow(0xff3b30, 2), 5); at(l, 0, -0.05, 0.15); g.add(l);
  g.userData.anim = (t) => { rotors.forEach((r, i) => { r.rotation.y = t * 30 + i; }); };
  return g;
}

// ---------------- map props ----------------
export function deadTree(seed = 0) {
  const g = group(at(cyl(0.05, 0.08, 0.8, 0x3a2a1c, 5), 0, 0, 0));
  for (let i = 0; i < 3; i++) { const b = cyl(0.02, 0.035, 0.4, 0x3a2a1c, 4); b.position.set(0, 0.45 + i * 0.12, 0); b.rotation.z = (i % 2 ? 0.8 : -0.8); b.rotation.y = seed + i * 2; g.add(b); }
  return g;
}
export function ruin(h = 1, seed = 0) {
  const g = group(box(0.8, h, 0.8, seed > 0.5 ? 0x6a655d : 0x5e5850));
  if (h > 0.6) g.add(at(box(0.35, h * 0.4, 0.8, 0x4e4840), 0.3, h, 0));
  windows(g, 0.8, h, 0.8, Math.max(1, Math.round(h * 2)), 0x1a1a1a);
  return g;
}
export function wreck(color = 0x7a3a2a) { const g = group(at(box(0.5, 0.22, 0.9, color), 0, 0.05, 0), at(box(0.4, 0.15, 0.4, 0x3a3a3a), 0, 0.27, -0.1)); g.rotation.y = Math.random() * 6; g.rotation.z = 0.15; return g; }
export function tent(color = 0x6a4a32) { const t = cone(0.55, 0.7, color, 4); t.rotation.y = Math.PI / 4; return t; }
export function campfire() {
  const g = group(); for (let i = 0; i < 4; i++) { const l = cyl(0.04, 0.04, 0.4, 0x5a3a20, 4); l.rotation.z = Math.PI / 2; l.rotation.y = i * 0.8; l.position.y = 0.04; g.add(l); }
  const f = glowSprite(0xff9a3c, 0.8, 0.9); f.position.y = 0.25; g.add(f);
  g.userData.anim = (t) => { f.scale.setScalar(0.65 + Math.sin(t * 12) * 0.12); };
  return g;
}
export function fortress(color = 0xffd27a, scale = 1) {
  const g = group();
  g.add(box(2.2, 0.7, 2.2, 0x5a5248));
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(at(cyl(0.28, 0.32, 1.1, 0x6a6258, 8), x, 0, z));
  g.add(at(box(1, 0.9, 1, 0x6e665c), 0, 0.7, 0));
  const w = winMat(0xffcf6b); g.add(at(new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.2), w), -0.2, 1.2, 0.51), at(new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.2), w), 0.2, 1.2, 0.51));
  g.add(at(chain(g, flag(color, 1.2)), 0, 1.6, 0));
  g.scale.setScalar(scale);
  return g;
}
export function resourceNode(res) {
  const g = group();
  if (res === 'food') { for (let i = 0; i < 9; i++) { const c = cone(0.08, 0.45, 0xc9b04a, 4); at(c, -0.35 + (i % 3) * 0.35, 0, -0.35 + Math.floor(i / 3) * 0.35); g.add(c); } g.add(at(box(1.1, 0.04, 1.1, 0x5a4a2a), 0, 0, 0)); }
  else if (res === 'wood') { for (let i = 0; i < 6; i++) { const l = cyl(0.12, 0.12, 0.9, 0x8b5a2b, 7); l.rotation.z = Math.PI / 2; at(l, 0, 0.12 + Math.floor(i / 3) * 0.22, -0.25 + (i % 3) * 0.25); g.add(l); } g.add(at(deadTree(1), 0.6, 0, -0.4)); }
  else if (res === 'metal') { for (let i = 0; i < 6; i++) { const b = box(0.3 + (i % 3) * 0.1, 0.2 + (i % 2) * 0.15, 0.3, [0x8a9096, 0x6a5a4a, 0x9a8a7a][i % 3]); b.rotation.y = i; at(b, -0.3 + (i % 3) * 0.3, Math.floor(i / 3) * 0.2, -0.15 + Math.floor(i / 3) * 0.2); g.add(b); } g.add(at(wreck(0x5a5a5a), 0.3, 0, 0.4)); }
  else { g.add(at(cyl(0.25, 0.3, 0.3, 0x333333, 8), 0, 0, 0)); const arm = group(at(box(0.08, 0.08, 1.2, 0x555555), 0, 0, 0), at(box(0.2, 0.25, 0.15, 0x444444), 0, -0.1, 0.6)); arm.position.y = 0.9; arm.userData.dyn = true; g.add(arm); g.add(at(cyl(0.04, 0.06, 0.9, 0x666666, 4), 0, 0, 0)); g.userData.anim = (t) => { arm.rotation.x = Math.sin(t * 1.5) * 0.3; }; g.add(at(cyl(0.2, 0.2, 0.5, 0x8a3a2a, 8), 0.5, 0, 0.3)); }
  return g;
}
