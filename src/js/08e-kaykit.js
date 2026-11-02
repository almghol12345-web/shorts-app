/* ================= rigged, animated characters (KayKit Adventurers + Skeletons, CC0 by Kay Lousberg) =================
 * The models ship inside the game (CHARS, prepared by scripts/prep-chars.mjs). Every hero, citizen, guard and
 * zombie is a copy of one of them: recolored from its palette texture, with the right weapon shown and a few
 * extra pieces (crown, glowing eyes, fire) fixed to its bones. All share one skeleton, so one set of
 * animations (idle, walk, run, attacks, spells, death) drives them all. Until the models are ready, or if they
 * fail to load, the older code-built characters are used.
 */
const KK = { custom: {}, ready: false, loading: false, gltf: {}, clips: {}, img: {}, tex: {}, mat: {}, h: {} };
function kkLoad(done) {
  if (KK.ready || KK.loading || typeof CHARS === 'undefined' || typeof THREE === 'undefined' || !THREE.GLTFLoader || !THREE.SkeletonUtils) return;
  KK.loading = true; const L = new THREE.GLTFLoader(), names = Object.keys(CHARS); let left = names.length;
  const fin = () => { if (--left) return; KK.ready = Object.keys(KK.gltf).length > 3 && !!KK.clips.Idle; KK.loading = false; if (KK.ready && done) done(); };
  for (const n of names) {
    let buf; try { const s = atob(CHARS[n]); buf = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) buf[i] = s.charCodeAt(i); } catch (e) { fin(); continue; }
    L.parse(buf.buffer, '', g => {
      if (n.startsWith('anims')) g.animations.forEach(c => { KK.clips[c.name] = c; });
      else if (n.startsWith('h_') || n.startsWith('z_')) { KK.gltf[n] = g; KK.custom[n] = g; }
      else { KK.gltf[n] = g; g.scene.traverse(o => { if (o.isMesh && o.material && o.material.map && !KK.img[n]) KK.img[n] = o.material.map.image; }); kkMergeSkins(g.scene); }
      fin();
    }, e => { console.warn('character ' + n, e); fin(); });
  }
}
/* the body parts all share one skeleton, so join them into one mesh: one draw instead of seven */
function kkMergeSkins(scene) {
  try {
    const parts = []; scene.traverse(o => { if (o.isSkinnedMesh) parts.push(o); }); if (parts.length < 2) return;
    const f = parts[0], same = parts.every(p => p.skeleton.bones.length === f.skeleton.bones.length && p.skeleton.bones.every((b, i) => b === f.skeleton.bones[i]) && p.bindMatrix.equals(f.bindMatrix) && p.parent === f.parent && p.matrix.equals(f.matrix));
    if (!same) return;
    const keys = Object.keys(f.geometry.attributes).sort().join();
    if (!parts.every(p => Object.keys(p.geometry.attributes).sort().join() === keys && !!p.geometry.index === !!f.geometry.index)) return;
    const flat = g => { const o = new THREE.BufferGeometry(), get = ['getX', 'getY', 'getZ', 'getW']; if (g.index) o.setIndex(g.index.clone());
      for (const k in g.attributes) { const a = g.attributes[k]; if (!a.isInterleavedBufferAttribute) { o.setAttribute(k, a.clone()); continue; } const arr = new a.array.constructor(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a[get[c]](i); o.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize, a.normalized)); }
      return o; };
    const geo = THREE.BufferGeometryUtils.mergeBufferGeometries(parts.map(p => flat(p.geometry))); if (!geo) return;
    const m = new THREE.SkinnedMesh(geo, f.material); m.name = 'Body'; m.position.copy(f.position); m.quaternion.copy(f.quaternion); m.scale.copy(f.scale);
    f.parent.add(m); m.bind(f.skeleton, f.bindMatrix); for (const p of parts) p.parent.remove(p);
  } catch (e) { console.warn('merge skins', e); }
}
/* ---------- recolor the palette texture: each of the 8x4 swatches can get a new color (shading kept) ---------- */
function kkTex(base, look) {
  const key = base + '|' + JSON.stringify(look.rec || {}) + '|' + JSON.stringify(look.glow || {});
  if (KK.tex[key]) return KK.tex[key];
  const img = KK.img[base], N = 512, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'); x.drawImage(img, 0, 0, N, N);
  const sw = N / 8, sh = N / 4, rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; };
  for (const [k, col] of Object.entries(look.rec || {})) {
    const cx = (k % 8) * sw, cy = Math.floor(k / 8) * sh, d = x.getImageData(cx, cy, sw, sh), p = d.data, tg = rgb(col);
    let avg = 0; for (let i = 0; i < p.length; i += 4) avg += p[i] * .3 + p[i + 1] * .59 + p[i + 2] * .11; avg = Math.max(1, avg / (p.length / 4));
    for (let i = 0; i < p.length; i += 4) { const f = clamp((p[i] * .3 + p[i + 1] * .59 + p[i + 2] * .11) / avg, .45, 1.6); p[i] = clamp(tg[0] * f, 0, 255); p[i + 1] = clamp(tg[1] * f, 0, 255); p[i + 2] = clamp(tg[2] * f, 0, 255); }
    x.putImageData(d, cx, cy);
  }
  const mk = cv => { const t = new THREE.CanvasTexture(cv); t.flipY = false; t.encoding = THREE.sRGBEncoding; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t; };
  const out = { map: mk(c), em: null };
  if (look.glow) { const e = document.createElement('canvas'); e.width = e.height = N; const ex = e.getContext('2d'); ex.fillStyle = '#000'; ex.fillRect(0, 0, N, N); for (const [k, col] of Object.entries(look.glow)) { ex.fillStyle = col; ex.fillRect((k % 8) * sw, Math.floor(k / 8) * sh, sw, sh); } out.em = mk(e); }
  return (KK.tex[key] = out);
}
function kkMat(base, look) {
  const t = kkTex(base, look), key = base + '|' + t.map.uuid;
  if (KK.mat[key]) return KK.mat[key];
  const m = new THREE.MeshStandardMaterial({ map: t.map, roughness: look.rough || .75, metalness: look.metal || 0 });
  if (t.em) { m.emissive = new THREE.Color('#ffffff'); m.emissiveMap = t.em; m.emissiveIntensity = look.glowI || 1; }
  const sk = m.clone(); sk.skinning = true; // three r128 needs a separate skinned copy
  return (KK.mat[key] = { rigid: m, skin: sk });
}
/* ---------- build one character ---------- */
function kkHeight(base) {
  if (KK.h[base]) return KK.h[base];
  // measure the posed, skinned vertices (positions are stored compressed, so the raw box is meaningless)
  const sc = KK.gltf[base].scene; sc.updateMatrixWorld(true); const b = new THREE.Box3(), v = new THREE.Vector3();
  sc.traverse(o => { if (!o.isSkinnedMesh) return; o.skeleton.update(); const pa = o.geometry.attributes.position, n = pa.count, ar = pa.array, dn = !pa.normalized ? 1 : ar instanceof Int16Array ? 32767 : ar instanceof Uint16Array ? 65535 : ar instanceof Int8Array ? 127 : ar instanceof Uint8Array ? 255 : 1; for (let i = 0; i < n; i += 3) { v.fromBufferAttribute(pa, i).divideScalar(dn); o.boneTransform(i, v); v.applyMatrix4(o.matrixWorld); b.expandByPoint(v); } });
  if (b.isEmpty()) b.setFromObject(sc); // a model without a skeleton
  return (KK.h[base] = Math.max(.5, b.max.y - b.min.y));
}
function kkMake(look) {
  const base = look.base, g = KK.gltf[base]; if (!g) return null;
  const root = new THREE.Group(), body = THREE.SkeletonUtils.clone(g.scene); root.add(body);
  const mat = kkMat(base, look), show = look.show || [], bones = {};
  body.traverse(o => {
    if (o.isBone || o.type === 'Bone') bones[o.name] = o;
    if (!o.isMesh) return; o.material = o.isSkinnedMesh ? mat.skin : mat.rigid; o.castShadow = !!look.shadow; o.frustumCulled = false;
    if (!o.isSkinnedMesh) o.visible = show.includes(o.name);
    else if ((look.hide || []).includes(o.name)) o.visible = false;
  });
  const hgt = look.height || 2; root.scale.setScalar(hgt / kkHeight(base));
  const u = root.userData = { kk: true, base, hgt, bones, mixer: new THREE.AnimationMixer(body), acts: {}, flick: [], idle: look.idle || 'Idle', walk: look.walk || 'Walking_A', run: look.run || 'Running_A', atk: look.atk || '1H_Melee_Attack_Chop', cast: look.cast || 'Spellcast_Raise', death: look.death || 'Death_A', walkK: look.walkK || 1, body: root };
  u.mixer.addEventListener('finished', e => { if (e.action === u.curA && !u.hold) { u.once = false; u.cur = null; } });
  if (look.extra) look.extra(root, bones, u);
  kkPlay(root, u.idle); u.mixer.update(0);
  return root;
}
function kkPlay(h, name, speed, once, hold) {
  const u = h.userData, clip = (u.clips && u.clips[name]) || KK.clips[name]; if (!clip) return false;
  if (u.cur === name && !once) { if (speed) u.curA.timeScale = speed; return true; }
  const a = u.acts[name] || (u.acts[name] = u.mixer.clipAction(clip));
  a.reset(); a.enabled = true; a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = !!once; a.timeScale = speed || 1;
  if (u.curA && u.curA !== a) { a.crossFadeFrom(u.curA, once ? .12 : .25, false); }
  a.play(); u.cur = name; u.curA = a; u.once = !!once; u.hold = !!hold; return true;
}
const kkOnce = (h, name, speed, hold) => kkPlay(h, name, speed || 1, true, hold);
function kkTick(h, dt) { const u = h.userData; u.mixer.update(dt); if (u.flick.length) { u.ft = (u.ft || 0) + dt; u.flick.forEach((s, i) => { const f = .8 + Math.sin(u.ft * 13 + i * 2.1) * .15 + Math.sin(u.ft * 29 + i) * .08; s.scale.set(s.userData.b * f, s.userData.b * f * 1.25, 1); }); } }
function kkWalk(h, t, speed, moving) {
  const u = h.userData, dt = u.lt === undefined ? 0 : clamp(t - u.lt, 0, .1); u.lt = t;
  if (!u.once) kkPlay(h, moving ? (speed > 1.6 ? u.run : u.walk) : u.idle, moving ? clamp(speed * u.walkK, .5, 2.2) : 1);
  kkTick(h, dt);
}
/* a model made for one hero or zombie (assets/heroes3d/<id>.glb, assets/zombies3d/<type>.glb) with its own animations.
   Clips are matched by name: idle, walk, run, attack, cast (spell/skill), hit, death (die). */
function kkCustom(key, hgt, shadow) {
  const g = KK.custom[key]; if (!g) return null;
  const root = new THREE.Group(), body = THREE.SkeletonUtils.clone(g.scene), bones = {}; root.add(body);
  body.traverse(o => { if (o.isBone || o.type === 'Bone') bones[o.name] = o; if (o.isMesh) { o.castShadow = !!shadow; o.frustumCulled = false; } });
  root.scale.setScalar(hgt / kkHeight(key));
  const find = re => g.animations.find(c => re.test(c.name)), clips = {};
  for (const [role, re] of [['idle', /idle|stand/i], ['walk', /walk/i], ['run', /run|sprint/i], ['attack', /attack|slash|shoot|punch|hit_?a?$/i], ['cast', /cast|spell|skill|magic/i], ['hit', /hurt|damage|^hit/i], ['death', /death|die|dead/i]]) { const c = find(re); if (c) clips[role] = c; }
  if (!clips.idle && g.animations[0]) clips.idle = g.animations[0];
  const u = root.userData = { kk: true, custom: true, base: key, hgt, bones, clips, mixer: new THREE.AnimationMixer(body), acts: {}, flick: [], idle: 'idle', walk: clips.walk ? 'walk' : 'idle', run: clips.run ? 'run' : clips.walk ? 'walk' : 'idle', atk: clips.attack ? 'attack' : 'idle', cast: clips.cast ? 'cast' : clips.attack ? 'attack' : 'idle', death: clips.death ? 'death' : 'idle', walkK: 1, body: root };
  u.mixer.addEventListener('finished', e => { if (e.action === u.curA && !u.hold) { u.once = false; u.cur = null; } });
  kkPlay(root, u.idle); u.mixer.update(0); return root;
}
/* extra pieces fixed to bones */
function kkAt(bones, name, obj, x, y, z, rx, ry, rz, s) { const b = bones[name.replace(/[\[\]\.:\/]/g, '')]; if (!b) return obj; obj.position.set(x || 0, y || 0, z || 0); obj.rotation.set(rx || 0, ry || 0, rz || 0); if (s) obj.scale.setScalar(s); b.add(obj); return obj; }
function kkGlowAt(bones, name, u, col, size, x, y, z, op) { const g = c3Glow(col, size, op === undefined ? .8 : op); kkAt(bones, name, g, x, y, z); u.flick.push(g); return g; }
function kkCrown() {
  const g = new THREE.Group(), gold = c3M({ color: '#e0b04a', metalness: .9, roughness: .28, emissive: '#5a3a00', emissiveIntensity: .3 });
  A(g, c3Cyl(.3, .32, .14, 16, true), gold, 0, 0, 0); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; A(g, c3Cone(.05, .2, 4), gold, Math.sin(a) * .3, .16, Math.cos(a) * .3); }
  A(g, c3Ball(.045, 1), new THREE.MeshBasicMaterial({ color: '#ff2a1a' }), 0, 0, .31); return g;
}
function kkHorns(col, big) { const g = new THREE.Group(), m = c3M({ color: col, roughness: .6 }); for (const s of [-1, 1]) { A(g, c3Cone(.07 * big, .38 * big, 7), m, s * .3 * big, .1, 0, 0, 0, -s * .7); A(g, c3Cone(.045 * big, .26 * big, 6), m, s * .48 * big, .38 * big, 0, 0, 0, -s * .15); } return g; }
function kkOrb(col) { const g = new THREE.Group(); A(g, c3Ball(.09), new THREE.MeshBasicMaterial({ color: '#ffffff' })); A(g, c3Ball(.16), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .45, depthWrite: false })); return g; }
/* ---------- heroes: base model, colors and gear from each portrait ---------- */
const KK_MASK = (col, b) => kkAt(b, 'head', A(new THREE.Group(), c3G('kkMask', () => new THREE.CylinderGeometry(.42, .4, .26, 16, 1, true, -1.2, 2.4)), c3M({ color: col, roughness: .9, side: THREE.DoubleSide }), 0, 0, 0).parent, 0, .17, .02);
const KKH = {
  redking: { base: 'knight', height: 2.25, show: ['1H_Sword', 'Knight_Cape'], rec: { 1: '#2a1a10', 3: '#4a3a2e', 4: '#3a2c24', 7: '#d4a24a', 6: '#8a1a14', 8: '#8a1612', 9: '#5a3a24', 10: '#2a1e18', 15: '#6a1410' }, metal: .35,
    extra: (r, b) => { kkAt(b, 'head', kkCrown(), 0, .98, 0, 0, 0, 0, 1.1); kkAt(b, 'head', A(new THREE.Group(), c3G('kkBeard', () => new THREE.SphereGeometry(.34, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), c3M({ map: texFur('#2a1a10'), roughness: 1 }), 0, 0, 0, 0, 0, 0, 1.05, 1.1, .9).parent, 0, .22, .16); } },
  destroyer: { base: 'rogue_hooded', height: 2.15, show: ['Rogue_Cape'], rec: { 0: '#2a1e2e', 1: '#1a1020', 2: '#e0a0ff', 9: '#24123a', 8: '#2e1a48', 6: '#3a2058', 3: '#1e1430', 5: '#7a4ad0', 21: '#2a1840', 19: '#1a1028', 15: '#120c1c' }, glow: { 2: '#d090ff' }, glowI: 1.6, cast: 'Spellcast_Shoot', atk: 'Spellcast_Shoot',
    extra: (r, b, u) => { KK_MASK('#0c0a10', b); const o = kkOrb('#b26bff'); kkAt(b, 'handslotl', o, 0, .1, 0); kkGlowAt(b, 'handslotl', u, '#b26bff', .9, 0, .1, 0); } },
  fire: { base: 'barbarian', height: 2.35, show: ['2H_Axe'], rec: { 0: '#2a1410', 1: '#140a06', 2: '#ffb03a', 6: '#2a1410', 7: '#1a0c08', 8: '#3a1a10', 9: '#2a1410', 10: '#1a0c08', 3: '#ff6a1a', 15: '#ff8a2a', 19: '#1a0c08', 23: '#2a1410', 11: '#2a1a14', 18: '#ff6a1a', 16: '#ff4a10', 13: '#3a2a20' }, glow: { 2: '#ffb03a', 3: '#ff5a10', 15: '#ff7a20', 18: '#ff5a10', 16: '#ff4a10' }, glowI: 1.5, atk: '2H_Melee_Attack_Chop', idle: '2H_Melee_Idle',
    extra: (r, b, u) => { kkAt(b, 'head', kkHorns('#140a06', 1), 0, .82, 0); for (const [bn, x, y] of [['upperarml', 0, .1], ['upperarmr', 0, .1], ['head', 0, 1.05], ['handslotr', 0, .6]]) kkGlowAt(b, bn, u, '#ff6a1a', .9, x, y, 0, .6); } },
  knight: { base: 'knight', height: 2.25, show: ['1H_Sword', 'Badge_Shield', 'Knight_Helmet', 'Knight_Cape'], rec: { 3: '#2e3034', 4: '#24262a', 7: '#c89a3a', 6: '#6a1414', 8: '#6a1212', 9: '#c89a3a', 10: '#1e1e22', 15: '#5a1212', 14: '#c89a3a', 13: '#2a2a2e' }, metal: .45,
    extra: (r, b) => { kkAt(b, 'head', A(new THREE.Group(), c3Tor(.42, .09, Math.PI), c3M({ map: texFur('#a01a14'), roughness: 1 }), 0, 0, 0, 0, Math.PI / 2, 0, .5, 1, 1).parent, 0, .95, -.05); } },
  lightning: { base: 'rogue', height: 2.1, show: ['2H_Crossbow'], rec: { 0: '#1c1c1c', 1: '#141414', 8: '#6a5a40', 6: '#5a4e38', 3: '#4a4030', 9: '#3a3428', 5: '#2a2620', 21: '#7a6a4a', 19: '#6a5a40', 15: '#2a2620', 11: '#24272a', 16: '#24272a', 14: '#3a3d40', 13: '#1a1a1a' }, atk: '2H_Ranged_Shoot',
    extra: (r, b) => { const hm = c3M({ color: '#6a5c40', roughness: .8 }), blk = c3M({ color: '#141414', metalness: .4 }), g = new THREE.Group(); A(g, c3G('kkHelm', () => new THREE.SphereGeometry(.5, 16, 10, 0, Math.PI * 2, 0, Math.PI * .5)), hm, 0, 0, 0, 0, 0, 0, 1.08, .85, 1.1); A(g, c3Box(.2, .13, .12), blk, 0, .2, .5); for (const s of [-1, 1]) { A(g, c3Cyl(.06, .06, .2, 8), blk, s * .09, .12, .62, Math.PI / 2); A(g, c3Cyl(.12, .12, .1, 10), blk, s * .52, -.12, 0, 0, 0, Math.PI / 2); } kkAt(b, 'head', g, 0, .58, -.02); } },
  shadow: { base: 'rogue_hooded', height: 2.0, show: ['Knife', 'Knife_Offhand'], rec: { 9: '#141216', 8: '#1c1a1e', 6: '#24222a', 3: '#18161c', 5: '#3a2a20', 21: '#1c1a1e', 19: '#141218', 15: '#2a1e18', 10: '#c8d0dc', 1: '#141014' }, atk: 'Dualwield_Melee_Attack_Stab',
    extra: (r, b) => KK_MASK('#0a0a0c', b) },
  medic: { base: 'mage', height: 2.05, show: ['1H_Wand', 'Mage_Cape'], rec: { 1: '#1a1210', 8: '#e4dccb', 3: '#3a5a3a', 5: '#c9302c', 4: '#d8d0bc', 19: '#4a3424', 15: '#3a2a1e', 18: '#7dff7a', 10: '#3a5a3a' }, glow: { 18: '#7dff7a' }, atk: 'Spellcast_Shoot',
    extra: (r, b, u) => { const o = kkOrb('#7dff7a'); kkAt(b, 'handslotl', o, 0, .1, 0); kkGlowAt(b, 'handslotl', u, '#7dff7a', .9, 0, .1, 0); const hm = c3M({ color: '#1a1210', roughness: .85 }), g = new THREE.Group(); for (let i = 0; i < 4; i++) A(g, c3Ball(.15 - i * .022), hm, 0, -i * .26, -(i ? .06 : 0)); kkAt(b, 'head', g, 0, .7, -.42); } },
  mountain: { base: 'barbarian', height: 2.5, show: ['2H_Axe', 'Barbarian_Cape'], rec: { 0: '#a87a58', 1: '#1a120c', 6: '#a87a58', 9: '#3a2818', 10: '#5a4232', 7: '#4a3426', 8: '#3a2818', 3: '#6a5040', 19: '#2a2018', 15: '#3a2818', 23: '#a87a58' }, atk: '2H_Melee_Attack_Chop', idle: '2H_Melee_Idle',
    extra: (r, b) => { const hm = c3M({ color: '#1a120c', roughness: 1, flatShading: true }), g = new THREE.Group(); for (const deg of [100, 125, 150, 180, 210, 235, 260]) { const th = deg * Math.PI / 180; A(g, c3Cone(.13, .75, 5), hm, Math.sin(th) * .4, 0, Math.cos(th) * .36, Math.PI + Math.cos(th) * .25, 0, -Math.sin(th) * .25); } kkAt(b, 'head', g, 0, .45, 0); } },
  hawk: { base: 'rogue_hooded', height: 2.1, show: ['1H_Crossbow', 'Rogue_Cape'], rec: { 9: '#1e1a16', 8: '#2a2622', 6: '#3a3028', 3: '#2a2420', 5: '#4a3424', 21: '#2a2622', 19: '#201c18', 15: '#3a2818', 1: '#1a1410' }, atk: '1H_Ranged_Shoot',
    extra: (r, b) => { KK_MASK('#0e0e10', b); const bd = new THREE.Group(), bm = c3M({ color: '#5a4030', roughness: .9 }), wm = c3M({ color: '#3a2a1e', roughness: .9 }); A(bd, c3Ball(.13), bm, 0, 0, 0, 0, 0, 0, .8, .85, 1.4); A(bd, c3Ball(.085), c3M({ color: '#e8e0d0' }), 0, .13, .13); A(bd, c3Cone(.03, .08, 5), c3M({ color: '#d8a030' }), 0, .12, .22, Math.PI / 2); for (const s of [-1, 1]) A(bd, c3Box(.04, .13, .3), wm, s * .1, .01, -.02, 0, 0, s * .25); kkAt(b, 'upperarml', bd, 0, .2, 0); } },
  wind: { base: 'knight', height: 2.15, show: ['1H_Sword', 'Knight_Cape'], rec: { 1: '#eef0f6', 3: '#4a525c', 4: '#3a4048', 7: '#5aa6ff', 6: '#2a4a8a', 8: '#2a4a8a', 9: '#5aa6ff', 10: '#2a3038', 15: '#2a4a8a', 11: '#d8ecff', 13: '#5aa6ff' }, glow: { 11: '#5aa6ff' }, glowI: .6, metal: .4,
    extra: (r, b, u) => kkGlowAt(b, 'handslotr', u, '#7ac8ff', .8, 0, .5, 0, .45) },
};
function kkHero(id) { const L = KKH[id]; if (KK.custom['h_' + id]) { const c = kkCustom('h_' + id, (L && L.height) || 2.2, true); if (c) { c.userData.heroId = id; return c; } } if (!L || !KK.ready) return null; const h = kkMake(Object.assign({ shadow: true }, L)); if (h) h.userData.heroId = id; return h; }
/* ---------- citizens, guards and zombies ---------- */
const KK_SHIRTS = ['#6a5a40', '#5a3a2a', '#3a4a5a', '#7a2a22', '#4a5a3a', '#8a7a5a', '#3a3a44', '#6a4a6a'], KK_PANTS = ['#3a3226', '#26282c', '#3a4048', '#4a3a2a'], KK_SKIN = ['#e8c4a0', '#c99068', '#a87a58', '#8a5a3a'], KK_HAIR = ['#2a1a10', '#1a1410', '#5a3a20', '#3a2a1a', '#7a7a7a', '#141010'];
function kkCitizen(i) {
  const pick = a => a[(i * 7 + a.length * 3 + i * i) % a.length], bases = ['rogue', 'mage', 'barbarian', 'knight', 'rogue'], base = bases[i % bases.length], sh = pick(KK_SHIRTS), pa = pick(KK_PANTS), sk = KK_SKIN[i % 4], hr = KK_HAIR[(i * 5 + 1) % KK_HAIR.length];
  const rec = { rogue: { 8: sh, 6: sh, 3: pa, 9: '#4a3a2a', 21: sh, 19: pa, 0: sk, 1: hr }, mage: { 8: sh, 3: pa, 5: '#4a3a2a', 4: sh, 19: pa, 0: sk, 1: hr }, barbarian: { 6: sk, 10: sh, 7: '#4a3a2a', 8: sh, 19: pa, 23: sk, 0: sk, 1: hr }, knight: { 3: sh, 7: '#4a3a2a', 6: pa, 15: pa, 10: pa, 0: sk, 1: hr } }[base];
  return kkMake({ base, height: 1.85 + (i % 3) * .07, rec, show: [], walk: 'Walking_B' });
}
function kkGuard() { return kkMake({ base: 'rogue', height: 2, show: ['2H_Crossbow'], rec: { 8: '#4a5038', 6: '#3a3f2e', 3: '#2e3326', 21: '#4a5038', 19: '#2e3326', 9: '#3a3a2e' }, idle: 'Idle' }); }
const KKZ = {
  w: { base: 'barbarian', height: 2.05, rec: { 0: '#7e8a6c', 1: '#3a3a30', 6: '#7e8a6c', 23: '#7e8a6c', 10: '#3e3e2c', 7: '#2a2620', 8: '#4a4a32', 9: '#5a1a14', 19: '#3a3a3c', 3: '#5a1a14', 15: '#2a2620' }, walk: 'Walking_D_Skeletons', walkK: 1.4, atk: 'Unarmed_Melee_Attack_Punch_A', eyes: '#ffcc33', wide: .92 },
  run: { base: 'rogue', height: 1.95, rec: { 0: '#76806a', 1: '#1a1410', 21: '#76806a', 8: '#3a3430', 6: '#2a2420', 3: '#4a3a2a', 19: '#4a3a2a', 9: '#5a1a14', 5: '#5a1a14' }, walk: 'Running_A', walkK: .8, atk: 'Unarmed_Melee_Attack_Punch_A', eyes: '#ffcc33' },
  sp: { base: 'barbarian', height: 2.1, rec: { 0: '#8a9a62', 1: '#4a5a2a', 6: '#8a9a62', 23: '#8a9a62', 10: '#3a3a28', 7: '#2a2a1a', 8: '#5a6a2a', 9: '#4a5a20', 19: '#3a3a30', 3: '#8fdf3a', 15: '#2a2a1a' }, glow: { 3: '#6fbf2a' }, walk: 'Walking_D_Skeletons', walkK: 1.2, atk: 'Spellcast_Shoot', eyes: '#c8ff3a', slime: '#8fdf3a', wide: 1.4 },
  br: { base: 'barbarian', height: 2.7, rec: { 0: '#7a7466', 1: '#2a2622', 6: '#7a7466', 23: '#7a7466', 9: '#3a3a3e', 10: '#2a3448', 7: '#2a2420', 8: '#2a3448', 19: '#2a3448', 3: '#5a1a14' }, walk: 'Walking_D_Skeletons', walkK: 1, atk: 'Unarmed_Melee_Attack_Punch_A', eyes: '#ff8a2a', wide: 1.18 },
  boss: { base: 'skel_warrior', height: 3.1, rec: { 18: '#8a1410', 3: '#2a2220', 4: '#5a4a3a', 7: '#3a2a20', 6: '#5a3a24', 9: '#d8c8a8' }, show: [], walk: 'Walking_D_Skeletons', walkK: 1, atk: '1H_Melee_Attack_Chop', death: 'Death_C_Skeletons', eyes: '#ff3a1a', horns: 1, cleaver: 1 },
  wb: { base: 'barbarian', height: 5.2, rec: { 6: '#4a4440', 23: '#4a4440', 0: '#4a4440', 1: '#3a3430', 9: '#2a2420', 10: '#2a2420', 7: '#1a1410', 8: '#2a2420', 19: '#2a2420', 3: '#ff6a1a', 15: '#ff6a1a', 2: '#ff6a1a' }, glow: { 3: '#ff5a10', 15: '#ff5a10', 2: '#ffb03a' }, glowI: 1.6, walk: 'Walking_D_Skeletons', walkK: .8, atk: 'Unarmed_Melee_Attack_Punch_A', eyes: '#ff5a1a', lava: 1, wide: 1.2 },
};
function kkZombie(type) {
  const Z = KKZ[type]; if (KK.custom['z_' + type]) { const c = kkCustom('z_' + type, (Z && Z.height) || 2, false); if (c) { c.userData.zombie = true; c.userData.ztype = type; c.userData.walkK = 1; return c; } } if (!Z || !KK.ready) return null;
  const z = kkMake(Object.assign({}, Z, { rec: Object.assign({ 2: Z.eyes }, Z.rec), glow: Object.assign({ 2: Z.eyes }, Z.glow || {}), glowI: Z.glowI || 1.3, extra: (r, b, u) => {
    if (Z.slime) { kkAt(b, 'head', A(new THREE.Group(), c3Cone(.08, .4, 6), c3M({ color: Z.slime, emissive: Z.slime, emissiveIntensity: .5, transparent: true, opacity: .9 }), 0, 0, 0, Math.PI).parent, 0, .05, .42); kkGlowAt(b, 'head', u, Z.slime, .6, 0, .1, .45, .5); }
    if (Z.horns) kkAt(b, 'head', kkHorns('#d8c8a8', 1.1), 0, .85, 0);
    if (Z.cleaver) { const g = new THREE.Group(), st = c3M({ color: '#9aa0a4', metalness: .8, roughness: .35 }); A(g, c3Cyl(.04, .04, .35, 6), c3M({ color: '#2a1e18' }), 0, 0, 0); A(g, c3Box(.05, .9, .45), st, 0, .6, .12); A(g, c3Box(.055, .22, .22), c3M({ color: '#5a0e0a' }), 0, .75, .2); kkAt(b, 'handslotr', g); }
    if (Z.lava) for (const bn of ['chest', 'upperarml', 'upperarmr']) kkGlowAt(b, bn, u, '#ff6a1a', 1.4, 0, .2, .2, .45);
  } }));
  if (z && Z.wide) z.children[0].scale.x = Z.wide;
  if (z) { z.userData.zombie = true; z.userData.ztype = type; }
  return z;
}
/* when the models are ready, swap the village characters for them and drop old battle zombies */
let kkCit = 0;
function kkSwapIn() {
  if (typeof B3 !== 'undefined') B3.pool = {};
  if (!V3.inited) return;
  V3.zpool = [];
  for (const u of V3.units) V3.scene.remove(u.s); for (const g of V3.guards || []) V3.scene.remove(g); for (const z of V3.zombies) V3.scene.remove(z.s);
  V3.units = []; V3.heroUnits = {}; V3.zombies = []; kkCit = 0; v3Units(); v3SyncHeroes();
}
