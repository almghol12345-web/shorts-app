/* ================= 3D building models =================
 * Each building is real geometry (stone, timber, tiled roofs, metal, glowing windows) built from
 * primitives in a 1x1 footprint, then scaled to its plot. Some parts animate (saw blade, radar dish,
 * flags, lab tubes). If a GLB model for a building is provided in assets/models/<type>.glb it is
 * used instead (see docs/meshy-guide.md).
 */
const M3 = {};
function m3Mats() {
  if (M3.mats) return M3.mats;
  const plank = canvasTex(256, 256, (c, w, h) => { const R = rng(9); for (let y = 0; y < h; y += 32) { const s = 90 + R() * 40; c.fillStyle = `rgb(${s},${s * .66 | 0},${s * .42 | 0})`; c.fillRect(0, y, w, 31); c.fillStyle = '#0003'; c.fillRect(0, y + 29, w, 3); for (let i = 0; i < 6; i++) { c.fillStyle = '#00000018'; c.fillRect(R() * w, y + R() * 28, 40 + R() * 60, 2); } } });
  const tiles = canvasTex(256, 256, (c, w, h) => { const R = rng(4); c.fillStyle = '#5a2218'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 22) for (let x = -(y / 22 % 2) * 16; x < w; x += 32) { const s = .75 + R() * .35; c.fillStyle = `rgb(${150 * s | 0},${58 * s | 0},${40 * s | 0})`; c.beginPath(); c.ellipse(x + 16, y + 14, 15, 10, 0, 0, Math.PI); c.fill(); } });
  const stone = canvasTex(256, 256, (c, w, h) => { const R = rng(13); c.fillStyle = '#4a4640'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) for (let x = -(y / 32 % 2) * 28; x < w; x += 56) { const s = 92 + R() * 46; c.fillStyle = `rgb(${s},${s - 6},${s - 14})`; c.fillRect(x + 2, y + 2, 52, 28); c.fillStyle = '#ffffff12'; c.fillRect(x + 2, y + 2, 52, 4); c.fillStyle = '#0003'; c.fillRect(x + 2, y + 25, 52, 5); } });
  const rock = canvasTex(256, 256, (c, w, h) => { const R = rng(17); c.fillStyle = '#3e3a35'; c.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { c.fillStyle = ['#4a453e', '#2e2b27', '#55504a'][i % 3] + '99'; c.beginPath(); c.ellipse(R() * w, R() * h, 3 + R() * 14, 2 + R() * 9, R() * 3, 0, 7); c.fill(); } });
  const crop = canvasTex(256, 256, (c, w, h) => { const R = rng(6); c.fillStyle = '#3a2a1a'; c.fillRect(0, 0, w, h); for (let y = 8; y < h; y += 24) { c.fillStyle = '#2a1e12'; c.fillRect(0, y + 14, w, 6); for (let x = 4; x < w; x += 10) { const g = 120 + R() * 80; c.fillStyle = `rgb(${50 + R() * 30 | 0},${g | 0},${30 + R() * 20 | 0})`; c.beginPath(); c.ellipse(x, y + 8, 5, 8, 0, 0, 7); c.fill(); } } }, 2);
  const S2 = (o) => new THREE.MeshStandardMaterial(o);
  M3.mats = {
    stone: S2({ map: stone, roughness: .9, color: '#a59a8a' }), stoneDark: S2({ map: stone, roughness: .95, color: '#6e665c' }),
    wood: S2({ map: plank, roughness: .85 }), woodDark: S2({ map: plank, roughness: .9, color: '#6a5a4a' }),
    roof: S2({ map: tiles, roughness: .7 }), roofDark: S2({ map: tiles, roughness: .75, color: '#7a6a6a' }),
    metal: S2({ color: '#7d848a', roughness: .45, metalness: .65 }), rust: S2({ color: '#7a4a30', roughness: .7, metalness: .35 }),
    iron: S2({ color: '#3a3e42', roughness: .5, metalness: .7 }), gold: S2({ color: '#d9a640', roughness: .3, metalness: .9, emissive: '#3a2200', emissiveIntensity: .3 }),
    cloth: S2({ color: '#b8aa8c', roughness: 1, side: THREE.DoubleSide }), red: S2({ color: '#9a201c', roughness: .8, side: THREE.DoubleSide, emissive: '#2a0000', emissiveIntensity: .4 }),
    rock: S2({ map: rock, roughness: 1, flatShading: true }), crop: S2({ map: crop, roughness: 1 }), green: S2({ color: '#4f7a34', roughness: 1, flatShading: true }),
    win: new THREE.MeshBasicMaterial({ color: '#ffb54a' }), winHot: new THREE.MeshBasicMaterial({ color: '#ffd27a' }),
    glowP: new THREE.MeshBasicMaterial({ color: '#b26bff', transparent: true, opacity: .85 }), glowC: new THREE.MeshBasicMaterial({ color: '#4ad8ff', transparent: true, opacity: .85 }),
    glowG: new THREE.MeshBasicMaterial({ color: '#7dff7a', transparent: true, opacity: .8 }), lamp: new THREE.MeshBasicMaterial({ color: '#ff6a3a' }),
    ghost: new THREE.MeshBasicMaterial({ color: '#7fd0ff', transparent: true, opacity: .14, depthWrite: false }),
    lockGrey: new THREE.MeshStandardMaterial({ color: '#3a3d40', roughness: 1 }),
  };
  return M3.mats;
}
/* geometry helpers: all in a 1x1 footprint, y up */
function mk(g, geo, mat, x, y, z, rx, ry, rz) { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.rotation.set(rx || 0, ry || 0, rz || 0); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; }
const BX = (g, w, h, d, mat, x, y, z, ry) => mk(g, new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z, 0, ry);
const CY = (g, rt, rb, h, mat, x, y, z, seg) => mk(g, new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat, x, y + h / 2, z);
const CN = (g, r, h, mat, x, y, z, seg) => mk(g, new THREE.ConeGeometry(r, h, seg || 12), mat, x, y + h / 2, z);
function gable(g, w, d, h, mat, x, y, z, ry) { // triangular roof
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.lineTo(-w / 2, 0);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }); geo.translate(0, 0, -d / 2);
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.5, uv.getY(i) * 1.5);
  return mk(g, geo, mat, x, y, z, 0, ry || 0);
}
function crenel(g, w, d, y, mat, n) { const s = Math.min(w, d) / (n || 6); for (let i = 0; i < (n || 6); i++) { const f = -w / 2 + s / 2 + i * (w / (n || 6)); BX(g, s * .6, s * .6, s * .6, mat, f, y, -d / 2); BX(g, s * .6, s * .6, s * .6, mat, f, y, d / 2); } for (let i = 1; i < (n || 6) - 1; i++) { const f = -d / 2 + s / 2 + i * (d / (n || 6)); BX(g, s * .6, s * .6, s * .6, mat, -w / 2, y, f); BX(g, s * .6, s * .6, s * .6, mat, w / 2, y, f); } }
function windows(g, w, d, y, mat, n, h) { const hh = h || .06; for (let i = 0; i < n; i++) { const f = -w / 2 + (i + .5) * w / n; BX(g, w / n * .35, hh, .01, mat, f, y, d / 2 + .006); } }
function flag(g, x, y, z, h, mat) { CY(g, .008, .008, h, M3.mats.iron, x, y, z, 5); const f = mk(g, new THREE.PlaneGeometry(.12, .08), mat, x + .06, y + h - .05, z); f.userData.flag = 1; return f; }
/* ---------- building builders ---------- */
const MODEL = {
  hq(g, M) {
    BX(g, .62, .34, .62, M.stone, 0, 0, 0); crenel(g, .62, .62, .34, M.stone, 7);
    BX(g, .4, .28, .4, M.stone, 0, .34, 0); crenel(g, .4, .4, .62, M.stoneDark, 5);
    for (const [x, z] of [[-.34, -.34], [.34, -.34], [-.34, .34], [.34, .34]]) { CY(g, .1, .11, .5, M.stone, x, 0, z, 10); CN(g, .13, .2, M.roof, x, .5, z, 10); }
    CY(g, .08, .09, .36, M.stoneDark, 0, .62, 0, 10); CN(g, .12, .22, M.roof, 0, .98, 0, 10);
    windows(g, .62, .62, .2, M.win, 4); windows(g, .4, .4, .48, M.win, 3);
    BX(g, .14, .17, .03, M.woodDark, 0, 0, .315); BX(g, .1, .02, .02, M.iron, 0, .15, .33);
    for (const x of [-.22, .22]) { const b = mk(g, new THREE.PlaneGeometry(.08, .2), M.red, x, .24, .316); b.userData.flag = 1; }
    flag(g, 0, 1.2, 0, .14, M.red);
    for (let i = -2; i <= 2; i++) mk(g, new THREE.SphereGeometry(.05, 6, 4), M.cloth, i * .1, .02, .42).scale.set(1.2, .5, .8);
  },
  farm(g, M) {
    BX(g, .8, .01, .7, M.crop, -.05, 0, .02);
    for (let i = 0; i < 9; i++) { const t = -.45 + i * .11; BX(g, .015, .08, .015, M.woodDark, t, 0, -.34); BX(g, .015, .08, .015, M.woodDark, t, 0, .38); }
    BX(g, .9, .012, .012, M.wood, -.05, .06, -.34); BX(g, .9, .012, .012, M.wood, -.05, .06, .38);
    for (let i = 0; i < 40; i++) CN(g, .018, .06 + (i % 3) * .01, M.green, -.4 + (i % 8) * .1, .01, -.25 + Math.floor(i / 8) * .13, 5);
    for (const [x, z] of [[.3, -.25], [.42, -.25], [.3, -.13], [.42, -.13]]) BX(g, .015, .42, .015, M.woodDark, x, 0, z);
    CY(g, .1, .1, .14, M.wood, .36, .42, -.19, 10); CN(g, .12, .07, M.roofDark, .36, .56, -.19, 10);
    BX(g, .2, .14, .16, M.wood, -.35, 0, -.22); gable(g, .22, .18, .08, M.roof, -.35, .14, -.22); windows(g, .2, .16, .07, M.win, 1, .04);
    CY(g, .006, .006, .2, M.woodDark, .1, 0, .1, 4); BX(g, .14, .01, .01, M.woodDark, .1, .15, .1); mk(g, new THREE.SphereGeometry(.025, 6, 4), M.cloth, .1, .21, .1);
  },
  saw(g, M) {
    BX(g, .6, .02, .5, M.woodDark, 0, 0, 0);
    for (const [x, z] of [[-.28, -.22], [.28, -.22], [-.28, .22], [.28, .22]]) BX(g, .03, .28, .03, M.woodDark, x, 0, z);
    gable(g, .7, .56, .16, M.roofDark, 0, .28, 0, Math.PI / 2);
    const saw = mk(g, new THREE.CylinderGeometry(.13, .13, .012, 24), M.metal, .05, .18, .05, Math.PI / 2, 0, 0); saw.userData.spin = 1;
    BX(g, .32, .06, .08, M.wood, .05, .02, .05);
    for (let i = 0; i < 6; i++) mk(g, new THREE.CylinderGeometry(.035, .035, .4, 8), M.wood, -.3 + (i % 3) * .07, .04 + Math.floor(i / 3) * .065, .3, 0, 0, Math.PI / 2);
    for (let i = 0; i < 5; i++) mk(g, new THREE.CylinderGeometry(.03, .03, .36, 8), M.woodDark, .3, .03 + Math.floor(i / 3) * .06, -.25 + (i % 3) * .07, Math.PI / 2, 0, 0);
    CY(g, .03, .03, .18, M.iron, -.2, .3, -.15, 8);
  },
  mine(g, M) {
    const r = mk(g, new THREE.DodecahedronGeometry(.42, 1), M.rock, 0, .1, -.08); r.scale.set(1.1, .7, .9);
    BX(g, .26, .24, .06, M.woodDark, 0, 0, .22); BX(g, .16, .18, .07, new THREE.MeshBasicMaterial({ color: '#0b0806' }), 0, 0, .23);
    BX(g, .03, .24, .03, M.wood, -.1, 0, .27); BX(g, .03, .24, .03, M.wood, .1, 0, .27); BX(g, .26, .03, .04, M.wood, 0, .22, .27);
    for (let i = 0; i < 8; i++) BX(g, .12, .008, .025, M.woodDark, 0, .002, .3 + i * .03);
    BX(g, .008, .01, .25, M.iron, -.04, .01, .41); BX(g, .008, .01, .25, M.iron, .04, .01, .41);
    BX(g, .12, .07, .09, M.rust, 0, .02, .44); for (let i = 0; i < 5; i++) mk(g, new THREE.DodecahedronGeometry(.02), M.metal, -.03 + i * .015, .1, .44);
    BX(g, .02, .02, .02, M.lamp, -.12, .2, .3); BX(g, .02, .02, .02, M.lamp, .12, .2, .3);
  },
  oil(g, M) {
    BX(g, .7, .02, .6, M.stoneDark, 0, 0, 0);
    CY(g, .14, .14, .3, M.rust, -.15, 0, -.1, 16); mk(g, new THREE.SphereGeometry(.14, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.rust, -.15, .3, -.1);
    CY(g, .1, .1, .22, M.metal, .17, 0, -.12, 14); mk(g, new THREE.SphereGeometry(.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.metal, .17, .22, -.12);
    const ch = CY(g, .035, .045, .6, M.iron, .2, 0, .15, 10); ch.userData.chimney = 1;
    for (const y of [.08, .16]) mk(g, new THREE.CylinderGeometry(.02, .02, .4, 8), M.iron, 0, y, .02, 0, 0, Math.PI / 2);
    for (let i = 0; i < 4; i++) CY(g, .035, .035, .09, i % 2 ? M.red : M.metal, -.28 + i * .08, 0, .22, 10);
    BX(g, .12, .1, .1, M.woodDark, -.2, 0, .2);
    BX(g, .02, .02, .02, M.lamp, .2, .6, .15);
  },
  barracks(g, M) {
    BX(g, .7, .2, .38, M.wood, 0, 0, -.05); gable(g, .76, .44, .16, M.roof, 0, .2, -.05);
    BX(g, .72, .05, .4, M.stoneDark, 0, 0, -.05); windows(g, .7, .38, .12, M.win, 5);
    BX(g, .1, .14, .02, M.woodDark, 0, 0, .145);
    for (let i = 0; i < 3; i++) { const x = -.25 + i * .25; CY(g, .012, .012, .14, M.woodDark, x, 0, .3, 5); mk(g, new THREE.CylinderGeometry(.04, .04, .01, 12), M.red, x, .14, .31, Math.PI / 2, 0, 0); }
    BX(g, .2, .03, .06, M.wood, .3, 0, .3); for (let i = 0; i < 4; i++) BX(g, .006, .1, .006, M.iron, .23 + i * .045, .03, .3);
    flag(g, -.3, .2, -.2, .3, M.red); flag(g, .3, .2, -.2, .3, M.red);
  },
  hospital(g, M) {
    BX(g, .32, .2, .3, M.stone, -.18, 0, -.12); gable(g, .36, .34, .1, M.roofDark, -.18, .2, -.12); windows(g, .32, .3, .11, M.win, 2);
    const t = mk(g, new THREE.ConeGeometry(.3, .28, 4, 1, true), M.cloth, .16, .14, .1, 0, Math.PI / 4, 0); t.scale.set(1.2, 1, .9);
    BX(g, .07, .02, .005, M.red, .16, .14, .27); BX(g, .02, .07, .005, M.red, .16, .115, .27);
    BX(g, .1, .12, .005, M.glowG, .16, 0, .25);
    flag(g, -.3, .3, -.25, .18, new THREE.MeshStandardMaterial({ color: '#f2efe8', side: THREE.DoubleSide, roughness: 1 }));
    for (let i = 0; i < 2; i++) BX(g, .16, .02, .06, M.cloth, -.15 + i * .2, .03, .3);
  },
  lab(g, M) {
    BX(g, .4, .3, .36, M.stoneDark, 0, 0, 0); BX(g, .3, .2, .28, M.stone, 0, .3, 0); crenel(g, .4, .36, .3, M.stoneDark, 5);
    windows(g, .4, .36, .18, M.glowP, 3); windows(g, .3, .28, .4, M.glowC, 2);
    for (const [x, m] of [[-.28, M.glowP], [.28, M.glowC]]) { CY(g, .07, .07, .26, m, x, 0, .18, 12).userData.pulse = 1; CY(g, .075, .075, .02, M.iron, x, .26, .18, 12); CY(g, .075, .075, .02, M.iron, x, 0, .18, 12); }
    CY(g, .01, .01, .16, M.iron, 0, .5, 0, 6);
    const dish = mk(g, new THREE.SphereGeometry(.11, 14, 8, 0, Math.PI * 2, 0, Math.PI / 3), M.metal, 0, .7, 0, -Math.PI / 2.4, 0, 0); dish.userData.dish = 1;
    mk(g, new THREE.CylinderGeometry(.006, .006, .3, 4), M.iron, .12, .62, .1, 0, 0, .4);
  },
  wall(g, M) {
    BX(g, .9, .26, .16, M.stone, 0, 0, 0); crenel(g, .9, .16, .26, M.stone, 9);
    CY(g, .13, .15, .5, M.stone, -.36, 0, 0, 10); CN(g, .16, .18, M.roof, -.36, .54, 0, 10); crenel(g, .26, .26, .5, M.stoneDark, 4);
    BX(g, .12, .14, .02, M.woodDark, .1, 0, .085); for (let i = 0; i < 7; i++) CN(g, .015, .08, M.iron, -.2 + i * .07, .26, .1, 4);
    const b = mk(g, new THREE.PlaneGeometry(.08, .2), M.red, -.36, .26, .155); b.userData.flag = 1;
    BX(g, .02, .02, .02, M.lamp, -.36, .5, .16);
  },
  warehouse(g, M) {
    BX(g, .6, .26, .44, M.stone, 0, 0, -.04); gable(g, .66, .5, .14, M.roofDark, 0, .26, -.04, Math.PI / 2);
    BX(g, .22, .2, .02, M.woodDark, 0, 0, .19); BX(g, .22, .015, .021, M.iron, 0, .08, .19); BX(g, .22, .015, .021, M.iron, 0, .16, .19);
    for (let i = 0; i < 6; i++) BX(g, .08, .08, .08, M.wood, -.26 + (i % 3) * .09, Math.floor(i / 3) * .08, .3);
    for (let i = 0; i < 3; i++) mk(g, new THREE.SphereGeometry(.05, 8, 6), M.cloth, .2 + i * .07, .03, .3).scale.set(1, .7, 1);
    BX(g, .02, .02, .02, M.lamp, 0, .23, .2);
  },
  tavern(g, M) {
    BX(g, .66, .28, .42, M.stone, 0, 0, -.05); crenel(g, .66, .42, .28, M.stoneDark, 7);
    BX(g, .26, .2, .2, M.stone, 0, .28, -.05); gable(g, .3, .24, .14, M.roof, 0, .48, -.05);
    for (const [x, z] of [[-.3, -.24], [.3, -.24], [-.3, .14], [.3, .14]]) { CY(g, .06, .07, .5, M.stone, x, 0, z, 8); CN(g, .08, .22, M.roof, x, .5, z, 8); }
    BX(g, .16, .22, .02, M.winHot, 0, 0, .165); BX(g, .2, .26, .015, M.gold, 0, 0, .16);
    for (const x of [-.18, .18]) { CY(g, .035, .04, .05, M.stoneDark, x, 0, .3, 8); const st = CY(g, .025, .03, .14, M.gold, x, .05, .3, 8); mk(g, new THREE.SphereGeometry(.03, 8, 6), M.gold, x, .21, .3); }
    for (const x of [-.12, .12]) { const b = mk(g, new THREE.PlaneGeometry(.07, .2), M.red, x, .24, .166); b.userData.flag = 1; }
    windows(g, .66, .42, .2, M.win, 4);
  },
  radar(g, M) {
    for (const [x, z] of [[-.15, -.15], [.15, -.15], [-.15, .15], [.15, .15]]) { const leg = mk(g, new THREE.CylinderGeometry(.012, .018, .9, 5), M.iron, x * .7, .45, z * .7); leg.rotation.set(z > 0 ? .17 : -.17, 0, x > 0 ? -.17 : .17); }
    for (const y of [.2, .4, .6]) { const s = .3 - y * .25; BX(g, s, .012, .012, M.iron, 0, y, s / 2); BX(g, s, .012, .012, M.iron, 0, y, -s / 2); BX(g, .012, .012, s, M.iron, s / 2, y, 0); BX(g, .012, .012, s, M.iron, -s / 2, y, 0); }
    BX(g, .16, .05, .16, M.wood, 0, .88, 0); BX(g, .12, .1, .12, M.metal, 0, .93, 0);
    const dish = new THREE.Group(); dish.position.set(0, 1.05, 0); g.add(dish); dish.userData.spinY = 1;
    const d = mk(dish, new THREE.SphereGeometry(.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3.2), M.metal, 0, .05, 0, -Math.PI / 2.2, 0, 0); d.material = M.metal;
    mk(dish, new THREE.CylinderGeometry(.005, .005, .18, 4), M.iron, 0, .08, .08, Math.PI / 2.4, 0, 0);
    BX(g, .02, .02, .02, M.lamp, 0, 1.2, 0).userData.blink = 1;
  },
};
const MODEL_H = { hq: 1.3, farm: .62, saw: .48, mine: .45, oil: .64, barracks: .54, hospital: .42, lab: .82, wall: .72, warehouse: .44, tavern: .75, radar: 1.25 };
/* GLB models supplied by the user (assets/models/<type>.glb) */
const GLB = {};
function m3LoadGLB(tp) {
  if (GLB[tp] !== undefined) return GLB[tp];
  GLB[tp] = null;
  const src = typeof MODELS !== 'undefined' && MODELS[tp];
  if (!src || typeof THREE.GLTFLoader === 'undefined') return null;
  GLB[tp] = 'loading';
  new THREE.GLTFLoader().load(toBlobURL(src), gl => { GLB[tp] = gl.scene; gl.scene.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); if (V3.inited) { for (const k in V3.objs) if (PLOT[k].t === tp) V3.objs[k].state = ''; v3SyncBuildings(); } }, undefined, () => { GLB[tp] = null; });
  return 'loading';
}
function m3Build(tp, size) {
  const M = m3Mats(), g = new THREE.Group(), glb = m3LoadGLB(tp);
  if (glb && glb !== 'loading') {
    const c = glb.clone(true), box = new THREE.Box3().setFromObject(c), sz = box.getSize(new THREE.Vector3()), s = size * .95 / Math.max(sz.x, sz.z);
    c.scale.setScalar(s); const b2 = new THREE.Box3().setFromObject(c), ctr = b2.getCenter(new THREE.Vector3()); c.position.set(-ctr.x, -b2.min.y, -ctr.z); g.add(c);
    g.userData.h = b2.max.y - b2.min.y; g.userData.glb = 1; return g;
  }
  const inner = new THREE.Group(); (MODEL[tp] || MODEL.warehouse)(inner, M); inner.scale.setScalar(size); g.add(inner);
  g.userData.h = (MODEL_H[tp] || .6) * size;
  const anim = []; inner.traverse(o => { if (o.userData && (o.userData.spin || o.userData.spinY || o.userData.flag || o.userData.pulse || o.userData.dish || o.userData.blink)) anim.push(o); });
  g.userData.anim = anim; return g;
}
function m3Ghost(g, mat) { g.traverse(o => { if (o.isMesh) { o.material = mat; o.castShadow = false; } }); }
function m3Animate(g, t, i) {
  const a = g.userData.anim; if (!a) return;
  for (const o of a) {
    const u = o.userData;
    if (u.spin) o.rotation.y = t * 6;
    if (u.spinY) o.rotation.y = t * .8;
    if (u.dish) o.rotation.z = Math.sin(t * .6 + i) * .4;
    if (u.flag) o.rotation.y = Math.sin(t * 3 + i + o.position.x * 20) * .35;
    if (u.pulse) o.material.opacity = .65 + Math.sin(t * 3 + i) * .25;
    if (u.blink) o.visible = Math.sin(t * 4) > 0;
  }
}

/* foundation pad for locked / unbuilt plots */
function m3Pad(size, state, tp) {
  const M = m3Mats(), g = new THREE.Group(), inner = new THREE.Group(); inner.scale.setScalar(size); g.add(inner);
  const dirt = new THREE.MeshStandardMaterial({ color: state === 'locked' ? '#241f1a' : '#3a2e22', roughness: 1 });
  BX(inner, .72, .03, .6, dirt, 0, 0, 0);
  for (const [x, z] of [[-.36, -.3], [.36, -.3], [-.36, .3], [.36, .3]]) BX(inner, .03, state === 'locked' ? .06 : .12, .03, M.woodDark, x, 0, z);
  if (state === 'empty') {
    BX(inner, .72, .008, .008, M.lamp, 0, .1, -.3); BX(inner, .72, .008, .008, M.lamp, 0, .1, .3); BX(inner, .008, .008, .6, M.lamp, -.36, .1, 0); BX(inner, .008, .008, .6, M.lamp, .36, .1, 0);
    for (let i = 0; i < 4; i++) BX(inner, .08, .08, .08, M.wood, -.2 + i * .12, .03, .1 * (i % 2));
    const ghost = m3Build(tp, 1); ghost.children[0].scale.setScalar(.85); m3Ghost(ghost, M.ghost); ghost.children[0].position.y = .03; inner.add(ghost);
  } else for (let i = 0; i < 5; i++) mk(inner, new THREE.DodecahedronGeometry(.04 + i % 2 * .02), M.rock, -.25 + i * .12, .03, (i % 2 - .5) * .2);
  g.userData.h = size * (state === 'empty' ? .5 : .25); return g;
}
