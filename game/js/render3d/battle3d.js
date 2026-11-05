// 3D battle playback. Same interface as the 2D BattleView: load(a, b, result), render(t, dt), skip(), speed, done.
import { THREE, makeRenderer, label, setLabel, glowSprite, Puffs, box, cyl, at, group, mat, bakeStatic } from './engine.js';
import { human, zombie, buggy, deadTree, ruin, wreck, setNight } from './models.js';
import { heroPortrait } from '../render/art.js';
import { getQuality } from '../platform.js';
import { tr } from '../i18n.js';

const DUR = { atk: 0.42, sk: 0.42, skill: 0.75, heal: 0.4, shield: 0.35, buff: 0.25, debuff: 0.25, stun: 0.25, stunned: 0.2, taunt: 0.4, die: 0.45 };
const TEAM = { a: { cloth: 0x3d5a7a, ring: 0x5fd3ff }, b: { cloth: 0x7a3a2a, ring: 0xff6a4a } };

export class Battle3D {
  constructor(canvas, sfx) {
    this.c = canvas; this.sfx = sfx; this.speed = 1; this.done = false;
    this.renderer = makeRenderer(canvas);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x2a2019); this.scene.fog = new THREE.Fog(0x2a2019, 22, 48);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.3, 120);
    const hemi = new THREE.HemisphereLight(0xffe2c0, 0x40342a, 1.6); this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffc890, 2.6); sun.position.set(-8, 16, 6); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 }); this.scene.add(sun);
    this.fx = new Puffs(this.scene, { color: 0xffa040, max: 60, additive: true });
    this.smoke = new Puffs(this.scene, { color: 0x6a625a, max: 40 });
    this.buildArena();
    this.banner = document.createElement('div'); this.banner.className = 'b3banner';
    canvas.parentNode?.appendChild(this.banner);
    setNight(0.3);
  }
  buildArena() {
    const g = group();
    const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48), mat(0x4a3e30)); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground);
    const mid = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.08), new THREE.MeshBasicMaterial({ color: 0xffb45a, transparent: true, opacity: 0.25 })); mid.rotation.x = -Math.PI / 2; mid.position.y = 0.02; this.scene.add(mid);
    let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) { const a = rnd() * Math.PI * 2, r = 10 + rnd() * 12; g.add(at(rnd() > 0.5 ? deadTree(rnd() * 6) : ruin(0.6 + rnd() * 2, rnd()), Math.cos(a) * r, 0, Math.sin(a) * r)); }
    for (let i = 0; i < 6; i++) g.add(at(wreck(), (rnd() - 0.5) * 16, 0, (rnd() - 0.5) * 3 + (i % 2 ? 7.5 : -7.5)));
    for (let i = 0; i < 30; i++) { const c = new THREE.Mesh(new THREE.CircleGeometry(0.3 + rnd() * 0.6, 8), mat(0x3a3026)); c.rotation.x = -Math.PI / 2; c.position.set((rnd() - 0.5) * 14, 0.01, (rnd() - 0.5) * 12); g.add(c); }
    this.scene.add(bakeStatic(g));
  }
  resize() {
    const w = this.c.clientWidth, h = this.c.clientHeight; if (!w || !h) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, getQuality() === 'low' ? 1.25 : 2));
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.fov = w / h < 0.6 ? 52 : 42; this.camera.updateProjectionMatrix();
    this.camBase = new THREE.Vector3(0, w / h < 0.6 ? 12.5 : 10, w / h < 0.6 ? 10.5 : 11);
    this.camera.position.copy(this.camBase); this.camera.lookAt(0, 0, 0.3);
  }
  makeUnit(s, side, i) {
    const root = group(), team = TEAM[side];
    const troops = [];
    let leader;
    if (s.structure) { leader = s.troopType === 'ranged' ? group(cyl(0.45, 0.55, 2.2, 0x6a7a8a, 8), at(box(0.6, 0.35, 0.6, 0x333333), 0, 2.2, 0)) : group(box(2.2, 1, 0.5, 0x8a7a6a)); }
    else if (s.zombie || s.boss) leader = zombie(s.color ? parseInt(String(s.color).replace('#', ''), 16) : 0x7d9a5a, s.boss ? 1.9 : 1.05);
    else leader = human(team.cloth, 0xd9a983, side === 'a' ? 0x2a3a4a : 0x4a2a20);
    if (!s.structure && !s.boss) leader.scale.multiplyScalar(1.15);
    root.add(leader);
    if (!s.structure) {
      const n = s.boss ? 3 : 6;
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * Math.PI * 2, rr = s.boss ? 1.3 : 0.85;
        let f;
        if (s.zombie || s.boss) f = zombie(0x7d9a5a, 0.62);
        else if (s.troopType === 'vehicle' && k % 3 === 0) { f = buggy(team.cloth); f.scale.setScalar(0.7); }
        else { f = human(team.cloth); f.scale.setScalar(0.62); }
        at(f, Math.cos(ang) * rr, 0, Math.sin(ang) * rr * 0.7 + (side === 'a' ? 0.35 : -0.35));
        root.add(f); troops.push(f);
      }
    }
    // facing the enemy
    root.rotation.y = side === 'a' ? Math.PI : 0;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.9, 24), new THREE.MeshBasicMaterial({ color: team.ring, transparent: true, opacity: 0.6, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; root.add(ring);
    // HP bar (billboard)
    const bar = group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.7, depthTest: false }));
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.44, 0.11), new THREE.MeshBasicMaterial({ color: 0x5fd35f, depthTest: false }));
    fill.position.z = 0.001; bg.renderOrder = 11; fill.renderOrder = 12; bar.add(bg, fill);
    const top = s.boss ? 3.4 : s.structure ? 2.8 : 2.0;
    bar.position.y = top; root.add(bar);
    const name = label(s.name.length > 16 ? tr(s.name).slice(0, 15) + '…' : tr(s.name), 0.32, { color: '#ffffff' }); name.position.y = top + 0.32; root.add(name);
    if (s.heroId) {
      const img = new Image(); img.src = heroPortrait(s.heroId, 96);
      const tex = new THREE.Texture(img); img.onload = () => { tex.needsUpdate = true; }; tex.colorSpace = THREE.SRGBColorSpace;
      const p = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false })); p.scale.set(0.6, 0.72, 1); p.position.y = top + 0.85; p.renderOrder = 12; root.add(p);
    }
    return { root, leader, troops, bar, fill, ring, top };
  }
  load(a, b, result) {
    if (this.units) for (const u of this.units) this.scene.remove(u.obj.root);
    this.result = result; this.log = result.log; this.i = 0; this.et = 0; this.done = false; this.shake = 0; this.flying = []; this.nums = [];
    const mk = (arr, side) => arr.map((s, i) => ({ ...s, side, key: side + i, hp: s.hp, max: s.hp, alive: true, shield: 0, stun: false, lunge: 0, fade: 1 }));
    this.units = [...mk(a, 'a'), ...mk(b, 'b')];
    this.byKey = Object.fromEntries(this.units.map((u) => [u.key, u]));
    for (const side of ['a', 'b']) for (const row of [0, 1]) {
      const us = this.units.filter((u) => u.side === side && (u.row || 0) === row);
      us.forEach((u, i) => {
        u.home = new THREE.Vector3((i - (us.length - 1) / 2) * Math.min(3.1, 13 / Math.max(1, us.length)), 0, (side === 'a' ? 1 : -1) * (row === 0 ? 2.4 : 5.2));
        u.obj = this.makeUnit(u, side, i); u.obj.root.position.copy(u.home); this.scene.add(u.obj.root);
      });
    }
    this.resize();
  }
  skip() { while (this.i < this.log.length) this.apply(this.log[this.i++], true); this.done = true; }
  pos(u, y = 1) { return u.obj.root.position.clone().add(new THREE.Vector3(0, y, 0)); }
  number(u, text, color, big) { const s = label(text, big ? 0.6 : 0.42, { bg: null, color, size: 48 }); s.position.copy(this.pos(u, u.obj.top + 0.2)); s.position.x += (Math.random() - 0.5) * 0.8; this.scene.add(s); this.nums.push({ s, t: 0 }); }
  apply(e, silent) {
    const s = this.byKey[e.s], d = this.byKey[e.d];
    switch (e.k) {
      case 'atk': case 'sk':
        if (d) { let left = e.v; if (d.shield > 0) { const k = Math.min(d.shield, left); d.shield -= k; left -= k; } d.hp = Math.max(0, d.hp - left); }
        if (!silent && s && d) {
          s.lunge = 1;
          const ranged = e.k === 'sk' || s.troopType === 'ranged' || s.troopType === 'vehicle' || s.structure;
          if (ranged) { const p = glowSprite(e.k === 'sk' ? 0xff8a3c : 0xffe9a0, e.k === 'sk' ? 0.9 : 0.4, 1); p.position.copy(this.pos(s, 1)); this.scene.add(p); this.flying.push({ p, from: this.pos(s, 1), to: this.pos(d, 0.9), t: 0, big: e.k === 'sk', target: d }); }
          else this.hitFx(d, false);
          this.number(d, (e.c ? tr('CRIT') + ' ' : '') + fmt(e.v), e.c ? '#ffd23a' : e.k === 'sk' ? '#ff8a3c' : '#ffffff', e.c || e.k === 'sk');
          this.sfx?.(e.k === 'sk' ? 'boom' : 'hit'); if (e.c || e.k === 'sk') this.shake = 0.35;
        }
        break;
      case 'heal': if (d) { d.hp = Math.min(d.max, d.hp + e.v); if (!silent) { this.number(d, '+' + fmt(e.v), '#6dff8a'); for (let k = 0; k < 6; k++) this.fx.emit(this.pos(d, 0.3), { vel: new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.4, (Math.random() - 0.5) * 0.6), life: 0.9, size: 0.35, grow: 0.5 }); } } break;
      case 'shield': if (s) { s.shield = e.v; if (!silent) this.burst(s, 0x78c8ff); } break;
      case 'skill': if (!silent && s) { this.showBanner(tr(e.n), s.side); this.burst(s, s.side === 'a' ? 0x5fd3ff : 0xff6a4a); this.sfx?.('skill'); } break;
      case 'stun': if (s) s.stun = true; break;
      case 'stunned': if (s) s.stun = false; break;
      case 'buff': if (!silent && s) this.number(s, tr('▲ATK'), '#ffc83c'); break;
      case 'debuff': if (!silent && s) this.number(s, tr('▼ATK'), '#b478ff'); break;
      case 'taunt': if (!silent && s) this.burst(s, 0xff503c); break;
      case 'die': if (s) { s.alive = false; s.hp = 0; if (!silent) { this.sfx?.('die'); for (let k = 0; k < 5; k++) this.smoke.emit(this.pos(s, 0.3), { vel: new THREE.Vector3(0, 0.6, 0), life: 1.5, size: 0.8, grow: 1.5, spread: 1 }); } } break;
    }
  }
  burst(u, color) { const g = glowSprite(color, 0.5, 0.9); g.position.copy(this.pos(u, 1)); this.scene.add(g); this.flying.push({ p: g, ring: true, t: 0 }); }
  hitFx(u, big) { for (let k = 0; k < (big ? 12 : 5); k++) this.fx.emit(this.pos(u, 0.9), { vel: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3), life: 0.4, size: big ? 0.5 : 0.25, grow: 0.3 }); }
  showBanner(text, side) { this.banner.textContent = text; this.banner.className = 'b3banner show ' + side; clearTimeout(this.bt); this.bt = setTimeout(() => { this.banner.className = 'b3banner'; }, 1100 / this.speed); }
  update(dt) {
    if (this.done) return;
    this.et -= dt * this.speed;
    while (this.et <= 0 && this.i < this.log.length) { const e = this.log[this.i++]; this.apply(e); this.et += DUR[e.k] ?? 0.3; if (e.k === 'skill') break; }
    if (this.i >= this.log.length && this.et <= 0) this.done = true;
  }
  render(t, dt) {
    if (!this.units) return;
    if (this.c.width !== Math.floor(this.c.clientWidth * this.renderer.getPixelRatio())) this.resize();
    this.update(dt);
    const sdt = dt * this.speed;
    for (const u of this.units) {
      const o = u.obj, root = o.root;
      u.lunge = Math.max(0, u.lunge - sdt * 4);
      const fwd = u.side === 'a' ? -1 : 1;
      root.position.set(u.home.x, 0, u.home.z + fwd * Math.sin(u.lunge * Math.PI) * 0.9);
      const f = u.hp / u.max;
      o.fill.scale.x = Math.max(0.001, f); o.fill.position.x = -0.72 * (1 - f);
      o.fill.material.color.setHex(f > 0.5 ? 0x5fd35f : f > 0.25 ? 0xe8c03a : 0xe85a3a);
      o.bar.quaternion.copy(this.camera.quaternion); o.bar.quaternion.premultiply(root.quaternion.clone().invert());
      const alive = Math.ceil(o.troops.length * f);
      o.troops.forEach((tp, k) => {
        if (k >= alive) { tp.rotation.x = Math.min(Math.PI / 2, (tp.rotation.x || 0) + sdt * 4); tp.position.y = Math.max(-0.5, tp.position.y - sdt * 0.3); }
        else { tp.userData.walk?.(t + k, 0.15); tp.userData.drive?.(t * 0.5); }
      });
      if (!u.alive) { o.leader.rotation.x = Math.min(Math.PI / 2, o.leader.rotation.x + sdt * 3); o.ring.material.opacity = 0.15; o.bar.visible = false; }
      else o.leader.userData.walk?.(t, u.stun ? 0 : 0.2);
      if (u.stun) o.leader.rotation.z = Math.sin(t * 8) * 0.15; else if (u.alive) o.leader.rotation.z = 0;
    }
    this.flying = this.flying.filter((f) => {
      f.t += sdt * (f.ring ? 2 : 2.8);
      if (f.ring) { f.p.scale.setScalar(0.5 + f.t * 4); f.p.material.opacity = Math.max(0, 1 - f.t); if (f.t >= 1) { this.scene.remove(f.p); return false; } return true; }
      f.p.position.lerpVectors(f.from, f.to, Math.min(1, f.t)); f.p.position.y += Math.sin(Math.min(1, f.t) * Math.PI) * (f.big ? 1.5 : 0.4);
      if (f.t >= 1) { this.scene.remove(f.p); this.hitFx(f.target, f.big); if (f.big) for (let k = 0; k < 3; k++) this.smoke.emit(f.to, { vel: new THREE.Vector3(0, 0.8, 0), life: 1.2, size: 0.8, grow: 1.5, spread: 0.8 }); return false; }
      return true;
    });
    this.nums = this.nums.filter((n) => { n.t += sdt; n.s.position.y += sdt * 1.1; n.s.material.opacity = Math.max(0, 1 - n.t / 1.1); if (n.t > 1.1) { this.scene.remove(n.s); return false; } return true; });
    this.fx.update(sdt); this.smoke.update(sdt);
    this.camera.position.copy(this.camBase);
    if (this.shake > 0) { this.camera.position.x += (Math.random() - 0.5) * this.shake; this.camera.position.y += (Math.random() - 0.5) * this.shake; this.shake *= 0.86; if (this.shake < 0.01) this.shake = 0; }
    this.camera.lookAt(0, 0, 0.3);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() { this.banner.remove(); this.renderer.dispose(); }
}
function fmt(v) { return v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e4 ? (v / 1e3).toFixed(1) + 'K' : String(v); }
