/* ================= world map: pinch / wheel / double-tap zoom, inertia, fly-to ================= */
const TS = 64, N = 41, C = 20, ZMIN = .45, ZMAX = 2.4;
let cam = null, wCan = null, wCtx = null, wRaf = 0, wW = 0, wH = 0, wDpr = 1;
const ptrs = new Map();
let wPat = null, gest = null, vel = { x: 0, y: 0 }, lastTapAt = 0, lastTapPos = null, anim = null, lastFrame = 0, wFog = null;
function freeSpot(R) { for (let i = 0; i < 900; i++) { const x = Math.floor(R() * N), y = Math.floor(R() * N); if (Math.abs(x - C) <= 1 && Math.abs(y - C) <= 1) continue; if (S.world.nodes.some(n => n.x === x && n.y === y)) continue; return { x, y }; } return null; }
function makeNode(k, R) {
  const p = freeSpot(R); if (!p) return null; const d = Math.hypot(p.x - C, p.y - C);
  const n = { id: Math.floor(R() * 1e9).toString(36) + S.world.nodes.length, x: p.x, y: p.y, k };
  if (k === 'z') n.L = clamp(Math.round(d * .9 + R() * 2.5), 1, 50);
  if (k === 'r') { n.L = clamp(Math.ceil(d / 3.6 + R() * 1.2), 1, 8); n.rt = ['food', 'wood', 'iron', 'fuel'][Math.floor(R() * (n.L >= 2 ? 4 : 3))]; n.amt = 1500 * n.L; }
  if (k === 'p') { n.bot = Math.floor(R() * BOTS.length); n.pw = Math.round((2000 + d * 1200) * (.6 + R() * .8)); n.tag = ALLIES[Math.floor(R() * 3)].tag; }
  S.world.nodes.push(n); return n;
}
function near(R, lo, hi) { for (let i = 0; i < 300; i++) { const a = R() * Math.PI * 2, d = lo + R() * (hi - lo), x = Math.round(C + Math.cos(a) * d), y = Math.round(C + Math.sin(a) * d); if (x < 0 || y < 0 || x >= N || y >= N || (Math.abs(x - C) <= 1 && Math.abs(y - C) <= 1) || S.world.nodes.some(n => n.x === x && n.y === y)) continue; return { x, y }; } return null; }
function genWorld() {
  S.world.nodes = []; const R = rng(S.world.seed);
  for (let i = 0; i < 9; i++) { const p = near(R, 2, 3 + i * .6); if (p) S.world.nodes.push({ id: 'st' + i, x: p.x, y: p.y, k: 'z', L: 1 + Math.floor(i / 3) }); }
  for (let i = 0; i < 4; i++) { const p = near(R, 2, 4); if (p) S.world.nodes.push({ id: 'sr' + i, x: p.x, y: p.y, k: 'r', L: 1, rt: ['food', 'wood', 'iron'][i % 3], amt: 1500 }); } for (let i = 0; i < 200; i++) makeNode('z', R); for (let i = 0; i < 130; i++) makeNode('r', R); for (let i = 0; i < 28; i++) makeNode('p', R); }
const nodeById = id => S.world.nodes.find(n => n.id === id);
const marchSpd = () => 1 + .08 * S.tech.march;
function startGather(id) {
  const n = nodeById(id); if (!n) return;
  if (S.world.marches.length >= maxMarch(lvOf('radar'))) { toast(t('marches_busy'), 1); return; }
  if (S.world.marches.some(m => m.nid === id)) { toast(t('march_here'), 1); return; }
  const d = Math.hypot(n.x - C, n.y - C), travel = d * 4000 / marchSpd(), gath = n.amt / (40 * marchSpd()) * 1000, tm = now();
  S.world.marches.push({ nid: id, x: n.x, y: n.y, rt: n.rt, amt: n.amt, go: tm, arr: tm + travel, fin: tm + travel + gath, back: tm + travel * 2 + gath });
  toast(t('march_sent')); closeModal(); save(); refresh();
}
function marchTick() {
  let ch = false; const tm = now();
  for (const m of S.world.marches.slice()) {
    if (tm >= m.back) {
      S.world.marches.splice(S.world.marches.indexOf(m), 1); S.res[m.rt] += m.amt; S.stats.gathered++; track('gather'); addXP(5); toast(t('march_back', fmt(m.amt), RES[m.rt].i));
      const i = S.world.nodes.findIndex(n => n.id === m.nid); if (i >= 0) { S.world.nodes.splice(i, 1); makeNode('r', Math.random); } ch = true;
    }
  }
  return ch;
}
function zombieReward(L) { const r = { exp: Math.round(90 * Math.pow(L, 1.35)), food: 400 * L, wood: 400 * L, iron: 150 * L }; if (L % 5 === 0) r.gems = 50; return mulR(r, evMult('reward')); }
function attackNode(id) {
  const n = nodeById(id); if (!n) return;
  if (n.L > S.world.maxZ + 1) { toast(t('beat_first', S.world.maxZ + 1), 1); return; }
  if (S.stam < 8) { toast(t('no_stam'), 1); return; }
  if (!S.squad.some(Boolean)) { toast(t('need_squad'), 1); return; }
  S.stam -= 8;
  const L = n.L, sc = 1 + (L - 1) * 1.6, cnt = 6 + L, wave = [];
  for (let i = 0; i < cnt; i++) { const r = Math.random(); wave.push(L >= 6 && r < .12 ? 'br' : L >= 4 && r < .25 ? 'sp' : L >= 2 && r < .45 ? 'run' : 'w'); }
  if (L % 5 === 0) wave.push('boss');
  closeModal();
  startBattle({ title: t('zombie_camp_lv', L), waves: [wave], sc, onEnd: win => {
    if (!win) return null;
    const r = zombieReward(L); if (Math.random() < .35) r.sp5 = 1; if (Math.random() < .06) r.ticket = 1;
    give(r); S.world.maxZ = Math.max(S.world.maxZ, L); addXP(5 * L); passXP(5);
    const i = S.world.nodes.findIndex(x => x.id === id); if (i >= 0) { S.world.nodes.splice(i, 1); makeNode('z', Math.random); }
    return { r };
  } });
}
function mNode(id) {
  const n = nodeById(id); if (!n) return sheet('❔', t('gone'), '', `<p class="muted">${t('gone_b')}</p>`);
  const d = Math.hypot(n.x - C, n.y - C);
  if (n.k === 'z') {
    const ok = n.L <= S.world.maxZ + 1;
    return sheet(n.L % 5 === 0 ? '👺' : '🧟', t('zombie_camp'), t('lv_pos', n.L, n.x, n.y), `
    <div class="vs"><div class="stat"><small>${t('your_power')}</small><b class="num">${fmt(teamPower())}</b></div><b class="muted">${t('vs')}</b><div class="stat"><small>${t('rec_power')}</small><b class="num">${fmt(recPower(1 + (n.L - 1) * 1.6) * .55)}</b></div></div>
    <div><div class="muted sm" style="margin-bottom:4px">${t('exp_rewards')}</div>${rewHTML(zombieReward(n.L))}</div>
    ${ok ? '' : `<div class="req no">✖ ${t('beat_first', S.world.maxZ + 1)}</div>`}
    <button class="btn pri wide" data-a="attackNode" data-x="${id}" ${ok && S.stam >= 8 ? '' : 'disabled'}>⚔️ ${t('attack')} (⚡ 8 · <span data-stam></span>)</button>`);
  }
  if (n.k === 'r') {
    const busy = S.world.marches.some(m => m.nid === id), travel = d * 4000 / marchSpd(), gath = n.amt / (40 * marchSpd()) * 1000;
    return sheet(RES[n.rt].i, t('field_of', L(RES[n.rt].n)), t('lv_pos', n.L, n.x, n.y), `
    <div class="grid2"><div class="stat"><small>${t('amount')}</small><b class="num">${fmt(n.amt)}</b></div><div class="stat"><small>${t('total_time')}</small><b class="num">${fmtT((travel * 2 + gath) / 1000)}</b></div></div>
    <div class="muted">${t('marches')}: ${S.world.marches.length}/${maxMarch(lvOf('radar'))}</div>
    <button class="btn ok wide" data-a="gather" data-x="${id}" ${busy ? 'disabled' : ''}>${busy ? t('march_on_way') : '🚚 ' + t('send_march')}</button>`);
  }
  return sheet('🏚️', esc(L(BOTS[n.bot])), `${t('survivor_base')} · [${n.tag}]`, `<div class="grid2"><div class="stat"><small>${t('power')}</small><b class="num">${fmt(n.pw)}</b></div><div class="stat"><small>${t('distance')}</small><b class="num">${d.toFixed(1)}</b></div></div><p class="muted">${t('pvp_soon')}</p>`);
}
VIEWS.world = () => {
  if (!S.world.nodes) genWorld();
  const ms = S.world.marches;
  return `<div class="world"><canvas id="wcan" aria-label="${t('world_map')}"></canvas>
  <div class="whud"><div class="chip">⚡ <span data-stam class="num"></span>/100 <span class="muted">·</span> 🚚 ${ms.length}/${maxMarch(lvOf('radar'))} <span class="muted">·</span> 🧟 ${t('max_short')} ${S.world.maxZ}</div></div>
  <div class="wtools"><button data-a="zoomIn" aria-label="zoom in">＋</button><button data-a="zoomOut" aria-label="zoom out">－</button><button data-a="findZ" aria-label="${t('find_target')}">🎯</button><button data-a="recenter" aria-label="${t('my_base')}">🏰</button></div>
  <div class="wmarch">${ms.map(m => { const tm = now(), ph = tm < m.arr ? [t('on_way'), m.go, m.arr] : tm < m.fin ? [t('gathering'), m.arr, m.fin] : [t('returning'), m.fin, m.back]; return `<div class="bq"><span>${RES[m.rt].i}</span><span>${ph[0]}</span><span class="prog"><i data-bar data-st="${ph[1]}" data-en="${ph[2]}"></i></span><b class="num" data-end="${ph[2]}"></b></div>`; }).join('')}</div></div>`;
};
const clampCam = () => { cam.x = clamp(cam.x, -TS * 2, N * TS + TS * 2); cam.y = clamp(cam.y, -TS * 2, N * TS + TS * 2); cam.z = clamp(cam.z, ZMIN, ZMAX); };
const s2w = (sx, sy) => ({ x: (sx - wW / 2) / cam.z + cam.x, y: (sy - wH / 2) / cam.z + cam.y });
function zoomAt(sx, sy, z, smooth) { const w = s2w(sx, sy); if (smooth) { anim = { kind: 'zoom', sx, sy, wx: w.x, wy: w.y, tz: clamp(z, ZMIN, ZMAX) }; return; } cam.z = clamp(z, ZMIN, ZMAX); cam.x = w.x - (sx - wW / 2) / cam.z; cam.y = w.y - (sy - wH / 2) / cam.z; clampCam(); }
function flyTo(wx, wy, z) { anim = { kind: 'fly', tx: wx, ty: wy, tz: z || cam.z }; vel = { x: 0, y: 0 }; }
function homeCam() { return { x: C * TS + TS / 2, y: C * TS + TS / 2, z: 1 }; }
function mountWorld() {
  wCan = $('#wcan'); if (!wCan) return; wCtx = wCan.getContext('2d');
  if (!cam) cam = homeCam();
  sizeWorld(); ptrs.clear(); gest = null; wPat = null;
  const pos = e => { const r = wCan.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  wCan.onpointerdown = e => {
    wCan.setPointerCapture(e.pointerId); const p = pos(e); ptrs.set(e.pointerId, p); anim = null; vel = { x: 0, y: 0 };
    if (ptrs.size === 1) gest = { mode: 'pan', sx: p.x, sy: p.y, cx: cam.x, cy: cam.y, moved: 0, t0: performance.now(), lx: p.x, ly: p.y, lt: performance.now() };
    else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; const w = s2w(mid.x, mid.y); gest = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: cam.z, wx: w.x, wy: w.y, moved: 99 }; }
  };
  wCan.onpointermove = e => {
    if (!ptrs.has(e.pointerId) || !gest) return; const p = pos(e); ptrs.set(e.pointerId, p);
    if (gest.mode === 'pinch' && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y) || 1; const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      cam.z = clamp(gest.z0 * d / gest.d0, ZMIN, ZMAX); cam.x = gest.wx - (mid.x - wW / 2) / cam.z; cam.y = gest.wy - (mid.y - wH / 2) / cam.z; clampCam();
    } else if (gest.mode === 'pan') {
      const dx = p.x - gest.sx, dy = p.y - gest.sy; gest.moved = Math.max(gest.moved, Math.hypot(dx, dy));
      cam.x = gest.cx - dx / cam.z; cam.y = gest.cy - dy / cam.z; clampCam();
      const tn = performance.now(), dt = Math.max(1, tn - gest.lt); vel = { x: -(p.x - gest.lx) / cam.z / dt * 16, y: -(p.y - gest.ly) / cam.z / dt * 16 }; gest.lx = p.x; gest.ly = p.y; gest.lt = tn;
    }
  };
  const up = e => {
    if (!ptrs.has(e.pointerId)) return; const p = pos(e); ptrs.delete(e.pointerId);
    if (gest && gest.mode === 'pinch') { if (ptrs.size === 1) { const q = [...ptrs.values()][0]; gest = { mode: 'pan', sx: q.x, sy: q.y, cx: cam.x, cy: cam.y, moved: 99, t0: 0, lx: q.x, ly: q.y, lt: performance.now() }; } else gest = null; vel = { x: 0, y: 0 }; return; }
    if (ptrs.size === 0 && gest) {
      const tap = gest.moved < 8 && performance.now() - gest.t0 < 400;
      if (performance.now() - gest.lt > 80) vel = { x: 0, y: 0 };
      if (tap) {
        vel = { x: 0, y: 0 };
        const tn = performance.now();
        if (tn - lastTapAt < 300 && lastTapPos && Math.hypot(p.x - lastTapPos.x, p.y - lastTapPos.y) < 30) { lastTapAt = 0; zoomAt(p.x, p.y, cam.z * 1.8 > ZMAX ? 1 : cam.z * 1.8, true); }
        else { lastTapAt = tn; lastTapPos = p; worldTap(p); }
      }
      gest = null;
    }
  };
  wCan.onpointerup = up; wCan.onpointercancel = e => { ptrs.delete(e.pointerId); gest = null; };
  wCan.onwheel = e => { e.preventDefault(); const p = pos(e); zoomAt(p.x, p.y, cam.z * Math.exp(-e.deltaY * .0016)); };
  cancelAnimationFrame(wRaf); lastFrame = 0;
  const loop = ts => { if (tab !== 'world' || !wCan || !wCan.isConnected) return; const dt = lastFrame ? Math.min(50, ts - lastFrame) : 16; lastFrame = ts; worldStep(dt); if (!B) drawWorld(ts); wRaf = requestAnimationFrame(loop); };
  wRaf = requestAnimationFrame(loop);
}
let tapTimer = 0;
function worldTap(p) {
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => {
    if (lastTapAt === 0) return;
    const w = s2w(p.x, p.y); const tx = Math.floor(w.x / TS), ty = Math.floor(w.y / TS);
    let n = S.world.nodes.find(n => n.x === tx && n.y === ty);
    if (!n && cam.z < .8) { let best = null, bd = 1e9; for (const m of S.world.nodes) { const dd = Math.hypot((m.x + .5) * TS - w.x, (m.y + .5) * TS - w.y); if (dd < bd) { bd = dd; best = m; } } if (bd < TS * .9) n = best; }
    if (n) { SND.click(); openModal(() => mNode(n.id)); }
    else if (Math.abs(tx - C) <= 1 && Math.abs(ty - C) <= 1) { tab = 'base'; render(); }
  }, 260);
}
function worldStep(dt) {
  const k = dt / 16;
  if (!gest && (Math.abs(vel.x) > .02 || Math.abs(vel.y) > .02)) { cam.x += vel.x * k; cam.y += vel.y * k; const f = Math.pow(.92, k); vel.x *= f; vel.y *= f; clampCam(); }
  if (anim) {
    const a = 1 - Math.pow(.8, k);
    if (anim.kind === 'zoom') { cam.z = lerp(cam.z, anim.tz, a); cam.x = anim.wx - (anim.sx - wW / 2) / cam.z; cam.y = anim.wy - (anim.sy - wH / 2) / cam.z; if (Math.abs(cam.z - anim.tz) < .002) { cam.z = anim.tz; anim = null; } }
    else { cam.x = lerp(cam.x, anim.tx, a); cam.y = lerp(cam.y, anim.ty, a); cam.z = lerp(cam.z, anim.tz, a); if (Math.hypot(cam.x - anim.tx, cam.y - anim.ty) < .5 && Math.abs(cam.z - anim.tz) < .002) anim = null; }
    clampCam();
  }
}
function findTarget() {
  const best = S.world.nodes.filter(n => n.k === 'z' && n.L <= S.world.maxZ + 1).sort((a, b) => (b.L - a.L) || (Math.hypot(a.x - C, a.y - C) - Math.hypot(b.x - C, b.y - C)))[0];
  if (!best) { toast(t('no_target'), 1); return; }
  flyTo((best.x + .5) * TS, (best.y + .5) * TS, Math.max(1.2, cam.z));
  setTimeout(() => openModal(() => mNode(best.id)), 650);
}
function sizeWorld() { if (!wCan) return; const r = wCan.parentElement.getBoundingClientRect(); wW = r.width; wH = r.height; wDpr = Math.min(2, window.devicePixelRatio || 1); wCan.width = wW * wDpr; wCan.height = wH * wDpr; }
function stopWorld() { cancelAnimationFrame(wRaf); wCan = null; }
function drawWorld(ts) {
  const c = wCtx, tm = now(); if (!c) return; const z = cam.z;
  c.setTransform(wDpr, 0, 0, wDpr, 0, 0);
  c.fillStyle = '#0b0e10'; c.fillRect(0, 0, wW, wH);
  c.setTransform(wDpr * z, 0, 0, wDpr * z, wDpr * (wW / 2 - cam.x * z), wDpr * (wH / 2 - cam.y * z));
  const tl = s2w(0, 0), br = s2w(wW, wH);
  const x0 = Math.max(0, Math.floor(tl.x / TS)), x1 = Math.min(N - 1, Math.floor(br.x / TS)), y0 = Math.max(0, Math.floor(tl.y / TS)), y1 = Math.min(N - 1, Math.floor(br.y / TS));
  const gi = artImg('bg_map'); if (!wPat && artReady(gi)) wPat = c.createPattern(gi, 'repeat');
  if (wPat) { c.fillStyle = wPat; c.fillRect(x0 * TS, y0 * TS, (x1 - x0 + 1) * TS, (y1 - y0 + 1) * TS); }
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const h = hash(x, y), px = x * TS, py = y * TS, d = Math.hypot(x - C, y - C);
    const shade = clamp(1 - d / 34, .35, 1);
    const base = h < .33 ? [27, 33, 36] : h < .66 ? [30, 36, 39] : [25, 31, 34];
    if (wPat) { c.fillStyle = `rgba(6,8,10,${(.18 + (1 - shade) * .7).toFixed(2)})`; c.fillRect(px, py, TS + .5, TS + .5); }
    else { c.fillStyle = `rgb(${base[0] * shade + (d > 14 ? 6 : 0)},${base[1] * shade},${base[2] * shade})`; c.fillRect(px, py, TS + .5, TS + .5); }
    if (!wPat && (x === C || y === C || (x % 10 === 0 && Math.abs(y - C) < 16) || (y % 10 === 0 && Math.abs(x - C) < 16))) { c.fillStyle = '#272b2d'; if (x === C || x % 10 === 0) c.fillRect(px + TS * .32, py, TS * .36, TS + .5); if (y === C || y % 10 === 0) c.fillRect(px, py + TS * .32, TS + .5, TS * .36); }
    if (z > .7) {
      if (wPat) { }
      else if (h > .86) { c.fillStyle = '#2b2f2c'; c.fillRect(px + h * 30, py + 20, 14, 10); c.fillRect(px + 10, py + h * 40, 8, 8); }
      else if (h > .8) { c.strokeStyle = '#2e3a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(px + 32, py + 50); c.lineTo(px + 32, py + 30); c.lineTo(px + 24, py + 20); c.moveTo(px + 32, py + 34); c.lineTo(px + 42, py + 24); c.stroke(); }
      else if (h > .77) { c.fillStyle = '#3a1e1a'; c.beginPath(); c.ellipse(px + 30, py + 34, 12, 6, 0, 0, 7); c.fill(); }
      c.strokeStyle = '#ffffff07'; c.lineWidth = 1 / z; c.strokeRect(px, py, TS, TS);
    }
  }
  c.strokeStyle = '#6a2a20'; c.lineWidth = 4 / z; c.strokeRect(0, 0, N * TS, N * TS);
  for (const m of S.world.marches) {
    const bx = C * TS + TS / 2, by = C * TS + TS / 2, mx = m.x * TS + TS / 2, my = m.y * TS + TS / 2;
    c.setLineDash([8 / z, 8 / z]); c.lineDashOffset = -(ts || 0) / 40; c.strokeStyle = '#64b66ecc'; c.lineWidth = 2.5 / z; c.beginPath(); c.moveTo(bx, by); c.lineTo(mx, my); c.stroke(); c.setLineDash([]);
    let f = tm < m.arr ? (tm - m.go) / (m.arr - m.go) : tm < m.fin ? 1 : 1 - (tm - m.fin) / (m.back - m.fin); f = clamp(f, 0, 1);
    c.fillStyle = '#64b66e'; c.beginPath(); c.arc(bx + (mx - bx) * f, by + (my - by) * f, 7 / Math.sqrt(z), 0, 7); c.fill();
  }
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.direction = isRTL() ? 'rtl' : 'ltr';
  { const px = C * TS + TS / 2, py = C * TS + TS / 2; const pulse = 1 + Math.sin((ts || 0) / 500) * .04;
    c.fillStyle = '#cf6a2c22'; c.beginPath(); c.arc(px, py, TS * 1.4 * pulse, 0, 7); c.fill(); c.strokeStyle = '#cf6a2c'; c.lineWidth = 2 / z; c.stroke();
    { const hi = artImg('b_hq'); if (artReady(hi)) { const hw = 120, hh = hw * hi.naturalHeight / hi.naturalWidth; c.drawImage(hi, px - hw / 2, py - hh * .6, hw, hh); } else { c.font = '58px serif'; c.fillText('🏰', px, py - 4); } }
    if (z > .6) { c.font = `700 ${Math.round(14 / Math.sqrt(z))}px Changa, sans-serif`; c.fillStyle = '#ece5d7'; c.fillText(S.name || t('commander'), px, py + TS * .95); } }
  const lbl = z > .75;
  for (const n of S.world.nodes) {
    const px = n.x * TS + TS / 2, py = n.y * TS + TS / 2; if (px < tl.x - TS || py < tl.y - TS || px > br.x + TS || py > br.y + TS) continue;
    if (n.k === 'z') {
      const ok = n.L <= S.world.maxZ + 1, top = ok && n.L === S.world.maxZ + 1;
      { const gr = c.createRadialGradient(px, py + 8, 2, px, py + 8, 30); gr.addColorStop(0, ok ? '#e2513f66' : '#55555544'); gr.addColorStop(1, '#0000'); c.fillStyle = gr; c.beginPath(); c.arc(px, py + 8, 30, 0, 7); c.fill(); }
      if (top) { c.strokeStyle = '#f1b23c'; c.lineWidth = 2 / z; c.beginPath(); c.arc(px, py, 27 + Math.sin((ts || 0) / 300) * 2, 0, 7); c.stroke(); }
      c.globalAlpha = ok ? 1 : .55; { const zi = artImg(n.L % 5 === 0 ? 'z_boss' : 'z_w'); if (artReady(zi)) { const zh = n.L % 5 === 0 ? 66 : 54, zw = zh * zi.naturalWidth / zi.naturalHeight; c.drawImage(zi, px - zw / 2, py - zh * .62, zw, zh); } else { c.font = '30px serif'; c.fillText(n.L % 5 === 0 ? '👺' : '🧟', px, py - 2); } } c.globalAlpha = 1;
      if (lbl || n.L % 5 === 0) badge(c, px, py + 22, n.L, ok ? '#e2513f' : '#555');
    } else if (n.k === 'r') {
      const col = { food: '#8a7a2a', wood: '#6a4a2a', iron: '#5a6a7a', fuel: '#3a3a4a' }[n.rt];
      c.fillStyle = col + 'aa'; c.beginPath(); c.arc(px, py, 22, 0, 7); c.fill();
      { const ri = artImg(ICO[n.rt]); if (artReady(ri)) { const rw = 34, rh = rw * ri.naturalHeight / ri.naturalWidth; c.drawImage(ri, px - rw / 2, py - rh / 2 - 2, rw, rh); } else { c.font = '26px serif'; c.fillText({ food: '🌽', wood: '🪵', iron: '🔩', fuel: '🛢️' }[n.rt], px, py - 2); } }
      if (lbl) badge(c, px, py + 22, n.L, '#64b66e');
      if (S.world.marches.some(m => m.nid === n.id)) { c.strokeStyle = '#64b66e'; c.lineWidth = 2 / z; c.beginPath(); c.arc(px, py, 26, 0, 7); c.stroke(); }
    } else {
      { const bi = artImg('b_warehouse'); if (artReady(bi)) { const bw = 54, bh = bw * bi.naturalHeight / bi.naturalWidth; c.drawImage(bi, px - bw / 2, py - bh * .65, bw, bh); } else { c.font = '34px serif'; c.fillText('🏚️', px, py - 4); } }
      if (lbl) { c.font = '700 11px Tajawal, sans-serif'; c.fillStyle = '#8e99a2'; c.fillText(`[${n.tag}] ${L(BOTS[n.bot])}`, px, py + 25); }
    }
  }
  c.setTransform(wDpr, 0, 0, wDpr, 0, 0);
  if (!wFog) { wFog = []; for (let i = 0; i < 7; i++) wFog.push({ x: Math.random(), y: Math.random(), r: .25 + Math.random() * .3, s: .00001 + Math.random() * .00002 }); }
  for (const f of wFog) { const fx = ((f.x + (ts || 0) * f.s) % 1.4 - .2) * wW, fy = f.y * wH, rr = f.r * Math.max(wW, wH); const g = c.createRadialGradient(fx, fy, 0, fx, fy, rr); g.addColorStop(0, '#9aa4ab10'); g.addColorStop(1, '#9aa4ab00'); c.fillStyle = g; c.fillRect(fx - rr, fy - rr, rr * 2, rr * 2); }
  const g = c.createRadialGradient(wW / 2, wH / 2, Math.min(wW, wH) * .35, wW / 2, wH / 2, Math.max(wW, wH) * .75); g.addColorStop(0, '#0000'); g.addColorStop(1, '#000b'); c.fillStyle = g; c.fillRect(0, 0, wW, wH);
}
function badge(c, x, y, L, col) { c.font = '800 11px Changa, sans-serif'; const w = Math.max(20, c.measureText(String(L)).width + 10); c.fillStyle = col; c.beginPath(); if (c.roundRect) c.roundRect(x - w / 2, y - 8, w, 16, 5); else c.rect(x - w / 2, y - 8, w, 16); c.fill(); c.fillStyle = '#fff'; c.fillText(String(L), x, y + 1); }
