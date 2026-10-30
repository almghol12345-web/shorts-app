/* ================= battle ================= */
let B = null;
const stageEl = () => $('#b-stage');
function startBattle(cfg) {
  const list = S.squad.map((id, i) => id ? { id, slot: i } : null).filter(Boolean);
  if (!list.length) { toast(t('need_squad'), 1); return; }
  const tb = troopBonus();
  B = {
    cfg, t: 0, z: [], fx: [], wave: 0, spawnQ: [], spawnT: 0, waveDelay: 1, buff: 0, done: false, dmgTaken: 0, dealt: 0, kills: 0, shake: 0, quitArm: 0, limit: cfg.limit || 150,
    zhp: 55 * Math.pow(1.155, cfg.sc - 1), zatk: 9 * Math.pow(1.125, cfg.sc - 1),
    heroes: list.map(h => { const st = heroStats(h.id); return { id: h.id, H: HB[h.id], slot: h.slot, atk: st.atk * (1 + tb), maxhp: st.hp, hp: st.hp, def: st.def, cd: .3 + Math.random() * .6, en: 0, shield: 0, shT: 0, alive: true, x: 0, y: 0, rapid: 0, flash: 0 }; })
  };
  B.maxTotal = B.heroes.reduce((a, h) => a + h.maxhp, 0);
  $('#battle').hidden = false; $('#b-res').hidden = true; $('#b-title').textContent = cfg.title; $('#b-wave').textContent = '';
  $('#b-spd').textContent = '×' + S.spd; $('#b-spd').classList.toggle('on', S.spd > 1);
  $('#b-auto').textContent = t('auto'); $('#b-auto').classList.toggle('on', S.auto); $('#b-quit').textContent = t('retreat');
  const cards = $('#b-cards'); cards.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const h = B.heroes.find(x => x.slot === i); const el = document.createElement('button'); el.className = 'bc';
    if (h) { el.innerHTML = `${avHTML(h.id)}<span class="bn">${esc(hname(h.id))}</span><span class="bar hp"><i></i></span><span class="bar en"><i></i></span>`; el.dataset.slot = i; el.dataset.tap = t('tap'); h.card = el; h.hpI = el.querySelector('.hp i'); h.enI = el.querySelector('.en i'); }
    else el.style.visibility = 'hidden';
    cards.appendChild(el);
  }
  B.heroes.forEach(h => portraitImg(h.id));
  bResize(); bBg();
  B.last = 0; B.raf = requestAnimationFrame(bLoop);
}
function bResize() {
  const r = stageEl().getBoundingClientRect(), cv = $('#bcan'); B.W = r.width; B.H = r.height; B.dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = B.W * B.dpr; cv.height = B.H * B.dpr; B.ctx = cv.getContext('2d');
  B.lineY = B.H - Math.min(170, B.H * .36);
  const pos = [[.36, 0], [.64, 0], [.18, 1], [.5, 1], [.82, 1]];
  for (const h of B.heroes) { const p = pos[h.slot]; h.x = B.W * p[0]; h.y = B.lineY + 40 + p[1] * 58; }
}
function bBg() {
  const W = B.W, Hh = B.H, cv = document.createElement('canvas'); cv.width = W * B.dpr; cv.height = Hh * B.dpr; const c = cv.getContext('2d'); c.scale(B.dpr, B.dpr);
  const g = c.createLinearGradient(0, 0, 0, Hh); g.addColorStop(0, B.cfg.boss ? '#1c1214' : '#141819'); g.addColorStop(1, '#1f2426'); c.fillStyle = g; c.fillRect(0, 0, W, Hh);
  c.fillStyle = '#262b2d'; c.fillRect(W * .12, 0, W * .76, Hh);
  c.strokeStyle = '#6b5f3a55'; c.lineWidth = 4; c.setLineDash([24, 22]); c.beginPath(); c.moveTo(W / 2, 0); c.lineTo(W / 2, B.lineY); c.stroke(); c.setLineDash([]);
  const R = rng(7);
  for (let i = 0; i < 40; i++) { c.strokeStyle = '#0d101166'; c.lineWidth = 1 + R() * 1.5; c.beginPath(); let x = R() * W, y = R() * B.lineY; c.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (R() - .5) * 40; y += R() * 25; c.lineTo(x, y); } c.stroke(); }
  for (let i = 0; i < 14; i++) { c.fillStyle = R() < .5 ? '#33302a' : '#2b3033'; const x = R() < .5 ? R() * W * .12 : W * .88 + R() * W * .12; c.fillRect(x, R() * B.lineY, 6 + R() * 14, 4 + R() * 10); }
  c.font = '30px serif'; c.textAlign = 'center'; c.globalAlpha = .8; c.fillText('🚗', W * .06, B.lineY * .35); c.fillText('🛢️', W * .94, B.lineY * .6); c.fillText('🚧', W * .92, B.lineY * .15); c.globalAlpha = 1;
  for (let x = 10; x < W; x += 26) { c.fillStyle = '#6b5c3e'; c.beginPath(); c.ellipse(x, B.lineY + 6, 15, 8, 0, 0, 7); c.fill(); c.fillStyle = '#584b33'; c.beginPath(); c.ellipse(x + 13, B.lineY - 3, 15, 8, 0, 0, 7); c.fill(); }
  B.bg = cv;
}
function spawnZ(type) {
  const T = ZT[type]; let hp = B.zhp * T.hp;
  if (type === 'wb') hp = Math.max(1e5, teamPower() * 400);
  B.z.push({ T, type, x: type === 'wb' ? B.W / 2 : B.W * (.18 + Math.random() * .64), y: type === 'wb' ? 0 : -T.r - Math.random() * 20, hp, maxhp: hp, atk: B.zatk * T.atk, acd: .5, stun: 0, alive: true, ph: Math.random() * 6, flash: 0 });
}
const aliveZ = () => B.z.filter(z => z.alive);
const visibleZ = () => B.z.filter(z => z.alive && z.y > -5);
function nearestZ() { let best = null; for (const z of B.z) if (z.alive && z.y > -5 && (!best || z.y > best.y)) best = z; return best; }
function dmgZ(z, d, crit) {
  if (!z.alive) return; const real = Math.min(d, z.hp); z.hp -= d; z.flash = .1; B.dealt += real;
  B.fx.push({ k: 'txt', x: z.x + (Math.random() - .5) * 16, y: z.y - z.T.r, s: fmt(d), col: crit ? '#f1b23c' : '#fff', big: crit, t: 0, life: .7 });
  if (z.hp <= 0) { z.alive = false; B.kills++; B.fx.push({ k: 'die', x: z.x, y: z.y, r: z.T.r, t: 0, life: .4 }); if (z.type === 'boss' || z.type === 'br') { B.shake = .25; SND.boom(); } }
}
function pickHero(z) {
  const al = B.heroes.filter(h => h.alive); if (!al.length) return null;
  const front = al.filter(h => h.slot < 2), pool = front.length ? front : al;
  return pool.reduce((a, h) => Math.abs(h.x - z.x) < Math.abs(a.x - z.x) ? h : a);
}
function hitHero(h, d) {
  if (!h.alive) return; d = d * (1 - h.def / (h.def + 150));
  if (h.shield > 0) { const a = Math.min(h.shield, d); h.shield -= a; d -= a; }
  h.hp -= d; B.dmgTaken += d; h.en = Math.min(100, h.en + 4); h.flash = .12; SND.hurt();
  if (d > 0) B.fx.push({ k: 'txt', x: h.x, y: h.y - 26, s: '-' + fmt(d), col: '#e2513f', t: 0, life: .6 });
  if (h.hp <= 0) { h.alive = false; h.hp = 0; B.fx.push({ k: 'die', x: h.x, y: h.y, r: 20, t: 0, life: .6 }); buzz('heavy'); }
}
function cast(h) {
  if (!h.alive || h.en < 100 || B.done) return;
  h.en = 0; const m = RM[h.H.r], vz = visibleZ(); SND.skill(); buzz('medium'); if (['aoe', 'air', 'stun', 'snipe'].includes(h.H.sk)) setTimeout(SND.boom, 120);
  B.fx.push({ k: 'txt', x: h.x, y: h.y - 44, s: L(h.H.skn), col: '#5aa6d6', big: true, t: 0, life: 1.1 });
  switch (h.H.sk) {
    case 'snipe': { const tg = vz.reduce((a, z) => !a || z.hp > a.hp ? z : a, null); if (tg) { B.fx.push({ k: 'tr', x: h.x, y: h.y, tx: tg.x, ty: tg.y, t: 0, life: .25, w: 5, col: '#f1b23c' }); dmgZ(tg, h.atk * 7 * m, true); } break; }
    case 'shield': for (const x of B.heroes) if (x.alive) { x.shield += h.maxhp * .3 * m; x.shT = 6; } break;
    case 'heal': for (const x of B.heroes) if (x.alive) { const v = h.atk * 5 * m + x.maxhp * .1; x.hp = Math.min(x.maxhp, x.hp + v); B.fx.push({ k: 'txt', x: x.x, y: x.y - 26, s: '+' + fmt(v), col: '#64b66e', t: 0, life: .8 }); B.fx.push({ k: 'heal', x: x.x, y: x.y, t: 0, life: .6 }); } break;
    case 'aoe': { const tg = nearestZ(); if (tg) { B.fx.push({ k: 'boom', x: tg.x, y: tg.y, r: 85, t: 0, life: .5 }); for (const z of vz) if (Math.hypot(z.x - tg.x, z.y - tg.y) < 85 + z.T.r) dmgZ(z, h.atk * 3 * m); } break; }
    case 'stun': B.shake = .4; for (const z of vz) { z.stun = (z.type === 'wb' ? 1.2 : 2.5) * m; dmgZ(z, h.atk * 1.2 * m); } break;
    case 'rapid': h.rapid = 4 * m; break;
    case 'buff': B.buff = 6 * m; break;
    case 'air': B.shake = .5; for (let i = 0; i < 6; i++) B.fx.push({ k: 'boom', x: B.W * (.15 + Math.random() * .7), y: B.lineY * (.2 + Math.random() * .7), r: 60, t: -i * .06, life: .5 }); for (const z of vz) dmgZ(z, h.atk * 3.5 * m); break;
  }
}
function bStep(dt) {
  B.t += dt; if (B.buff > 0) B.buff -= dt; if (B.shake > 0) B.shake -= dt;
  const nW = B.cfg.waves.length;
  if (!B.spawnQ.length && !aliveZ().length) {
    if (B.wave >= nW) return bEnd(true);
    B.waveDelay -= dt; if (B.waveDelay <= 0) { B.spawnQ = B.cfg.waves[B.wave].slice(); B.wave++; B.waveDelay = 1.5; bBanner(B.cfg.boss ? t('boss_arrives') : nW > 1 ? t('wave_n', B.wave, nW) : t('attack_bang')); if (!B.cfg.boss) $('#b-wave').textContent = t('wave_n', B.wave, nW); }
  }
  if (B.spawnQ.length) { B.spawnT -= dt; if (B.spawnT <= 0) { spawnZ(B.spawnQ.shift()); B.spawnT = .5 + Math.random() * .4; } }
  for (const z of B.z) {
    if (!z.alive) continue; if (z.flash > 0) z.flash -= dt;
    if (z.stun > 0) { z.stun -= dt; continue; }
    const stopY = z.T.range ? B.lineY - 170 : B.lineY - z.T.r + 4;
    if (z.y < stopY) { z.y += z.T.spd * dt; if (z.type !== 'wb') { z.x += Math.sin(B.t * 2 + z.ph) * 8 * dt; z.x = clamp(z.x, B.W * .1, B.W * .9); } }
    else {
      z.y = stopY; z.acd -= dt;
      if (z.acd <= 0) {
        z.acd = z.T.range ? 2.2 : z.type === 'wb' ? 1.6 : 1; const tg = pickHero(z);
        if (tg) {
          if (z.T.range) B.fx.push({ k: 'spit', x: z.x, y: z.y, tx: tg.x, ty: tg.y, t: 0, life: .5, tg, dmg: z.atk });
          else if (z.type === 'wb') { B.shake = .3; SND.boom(); for (const hh of B.heroes) if (hh.alive && hh.slot < 2) hitHero(hh, z.atk * 1.4); else if (hh.alive) hitHero(hh, z.atk * .5); B.fx.push({ k: 'boom', x: z.x, y: B.lineY, r: 120, t: 0, life: .5 }); }
          else { hitHero(tg, z.atk); B.fx.push({ k: 'claw', x: z.x, y: z.y + z.T.r, t: 0, life: .2 }); }
        }
      }
    }
  }
  for (const h of B.heroes) {
    if (!h.alive) continue; if (h.flash > 0) h.flash -= dt;
    if (h.shT > 0) { h.shT -= dt; if (h.shT <= 0) h.shield = 0; }
    if (h.rapid > 0) h.rapid -= dt;
    h.cd -= dt;
    if (h.cd <= 0) {
      const tg = nearestZ();
      if (tg) { const rate = { tank: 1, atk: .6, sup: .9 }[h.H.c]; h.cd = rate / (h.rapid > 0 ? 3 : 1); let d = h.atk * (B.buff > 0 ? 1.4 : 1); const cr = Math.random() < .12; if (cr) d *= 2; B.fx.push({ k: 'tr', x: h.x, y: h.y - 12, tx: tg.x, ty: tg.y, t: 0, life: .07, w: 2, col: '#ffe9a8' }); dmgZ(tg, d, cr); SND.shot(); h.en = Math.min(100, h.en + (h.H.c === 'sup' ? 11 : 8)); }
      else h.cd = .15;
    }
    if (h.en >= 100 && S.auto) cast(h);
  }
  for (const f of B.fx) { f.t += dt; if (f.k === 'spit' && !f.hit && f.t >= f.life) { f.hit = true; hitHero(f.tg, f.dmg); } }
  B.fx = B.fx.filter(f => f.t < f.life); if (B.fx.length > 160) B.fx.splice(0, B.fx.length - 160);
  if (B.z.length > 80) B.z = B.z.filter(z => z.alive);
  if (!B.heroes.some(h => h.alive)) return bEnd(!!B.cfg.boss, B.cfg.boss ? t('boss_over') : null);
  if (B.t > B.limit) return bEnd(!!B.cfg.boss, B.cfg.boss ? t('boss_over') : t('time_up'));
}
function bBanner(txt) { const e = $('#b-banner'); e.textContent = txt; e.classList.remove('go'); void e.offsetWidth; e.classList.add('go'); }
function bDraw() {
  const c = B.ctx, W = B.W, Hh = B.H; c.setTransform(B.dpr, 0, 0, B.dpr, 0, 0);
  if (B.shake > 0) c.translate((Math.random() - .5) * 8, (Math.random() - .5) * 8);
  c.drawImage(B.bg, 0, 0, W, Hh);
  if (B.buff > 0) { c.fillStyle = '#cf6a2c18'; c.fillRect(0, B.lineY, W, Hh - B.lineY); }
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.direction = isRTL() ? 'rtl' : 'ltr';
  const zs = B.z.filter(z => z.alive).sort((a, b) => a.y - b.y);
  for (const z of zs) {
    const s = z.T.r * 2; c.fillStyle = '#0006'; c.beginPath(); c.ellipse(z.x, z.y + z.T.r * .8, z.T.r * .8, z.T.r * .3, 0, 0, 7); c.fill();
    c.font = `${s}px serif`; const wob = Math.sin(B.t * 6 + z.ph) * .08; c.save(); c.translate(z.x, z.y); c.rotate(z.stun > 0 ? 0 : wob); c.fillText(z.T.i, 0, 0); c.restore();
    if (z.flash > 0) { c.fillStyle = '#fff6'; c.beginPath(); c.arc(z.x, z.y, z.T.r, 0, 7); c.fill(); }
    if (z.stun > 0) { c.font = '14px serif'; c.fillText('💫', z.x, z.y - z.T.r - 10); }
    if (z.hp < z.maxhp && z.type !== 'wb') { const w = z.T.r * 2; c.fillStyle = '#000a'; c.fillRect(z.x - w / 2, z.y - z.T.r - 6, w, 4); c.fillStyle = z.type === 'boss' ? '#e2513f' : '#c9453a'; c.fillRect(z.x - w / 2, z.y - z.T.r - 6, w * Math.max(0, z.hp / z.maxhp), 4); }
  }
  for (const h of B.heroes) {
    const col = { tank: '#3f6f96', atk: '#9c3f2f', sup: '#3f8a5c' }[h.H.c], rc = ['', '#4f8fd6', '#a66be0', '#e8a62d'][h.H.r];
    c.globalAlpha = h.alive ? 1 : .25;
    c.fillStyle = '#0008'; c.beginPath(); c.ellipse(h.x, h.y + 23, 20, 6, 0, 0, 7); c.fill();
    const im = portraitImg(h.id), cw = 38, ch = 52, cx = h.x - cw / 2, cy = h.y - ch / 2 - 4, rr = (x, y, w, hh, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, hh, r); else c.rect(x, y, w, hh); };
    if (h.alive && h.H.r === 3) { c.fillStyle = '#f1b23c22'; rr(cx - 4, cy - 4, cw + 8, ch + 8, 9); c.fill(); }
    c.fillStyle = col; rr(cx, cy, cw, ch, 6); c.fill();
    if (im.complete && im.naturalWidth) { const sh = im.naturalWidth * ch / cw; c.save(); rr(cx, cy, cw, ch, 6); c.clip(); c.drawImage(im, 0, 0, im.naturalWidth, Math.min(im.naturalHeight, sh), cx, cy, cw, ch); c.restore(); }
    c.lineWidth = 2.5; c.strokeStyle = rc; rr(cx, cy, cw, ch, 6); c.stroke();
    if (h.flash > 0) { c.fillStyle = '#e2513f66'; rr(cx, cy, cw, ch, 6); c.fill(); }
    if (h.shield > 0) { c.strokeStyle = '#5aa6d6'; c.lineWidth = 2; c.globalAlpha = .6 + Math.sin(B.t * 8) * .2; rr(cx - 5, cy - 5, cw + 10, ch + 10, 10); c.stroke(); c.globalAlpha = 1; }
    if (h.rapid > 0) { c.strokeStyle = '#f1b23c'; c.lineWidth = 2; c.beginPath(); c.arc(h.x, h.y, 22, B.t * 10, B.t * 10 + 2); c.stroke(); }
    if (h.alive) { c.fillStyle = '#000a'; c.fillRect(h.x - 20, h.y + 25, 40, 5); c.fillStyle = '#64b66e'; c.fillRect(h.x - 20, h.y + 25, 40 * h.hp / h.maxhp, 5); }
    c.globalAlpha = 1;
  }
  for (const f of B.fx) {
    if (f.t < 0) continue; const p = f.t / f.life;
    if (f.k === 'tr') { c.strokeStyle = f.col; c.globalAlpha = 1 - p; c.lineWidth = f.w; c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(f.tx, f.ty); c.stroke(); c.globalAlpha = 1; }
    else if (f.k === 'txt') { c.globalAlpha = 1 - p * p; c.font = `800 ${f.big ? 17 : 13}px Changa, sans-serif`; c.lineWidth = 3; c.strokeStyle = '#000'; c.strokeText(f.s, f.x, f.y - p * 28); c.fillStyle = f.col; c.fillText(f.s, f.x, f.y - p * 28); c.globalAlpha = 1; }
    else if (f.k === 'die') { c.globalAlpha = 1 - p; c.fillStyle = '#5a7a4a'; for (let i = 0; i < 6; i++) { const a = i * 1.05; c.beginPath(); c.arc(f.x + Math.cos(a) * p * f.r * 1.4, f.y + Math.sin(a) * p * f.r * 1.4, 4 * (1 - p) + 1, 0, 7); c.fill(); } c.globalAlpha = 1; }
    else if (f.k === 'boom') { c.globalAlpha = 1 - p; const g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * (.4 + p * .6)); g.addColorStop(0, '#fff3c0'); g.addColorStop(.4, '#f1b23c'); g.addColorStop(1, '#cf6a2c00'); c.fillStyle = g; c.beginPath(); c.arc(f.x, f.y, f.r * (.4 + p * .6), 0, 7); c.fill(); c.globalAlpha = 1; }
    else if (f.k === 'spit') { const x = f.x + (f.tx - f.x) * p, y = f.y + (f.ty - f.y) * p - Math.sin(p * Math.PI) * 40; c.fillStyle = '#8fcf3a'; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); }
    else if (f.k === 'heal') { c.globalAlpha = 1 - p; c.strokeStyle = '#64b66e'; c.lineWidth = 3; c.beginPath(); c.arc(f.x, f.y, 18 + p * 20, 0, 7); c.stroke(); c.globalAlpha = 1; }
    else if (f.k === 'claw') { c.globalAlpha = 1 - p; c.strokeStyle = '#e2513f'; c.lineWidth = 2; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(f.x + i * 6 - 6, f.y - 6); c.lineTo(f.x + i * 6 + 6, f.y + 6); c.stroke(); } c.globalAlpha = 1; }
  }
  const fog = c.createLinearGradient(0, 0, 0, 90); fog.addColorStop(0, '#0b0e10'); fog.addColorStop(1, '#0b0e1000'); c.fillStyle = fog; c.fillRect(0, 0, W, 90);
  c.font = '700 12px Changa, sans-serif'; c.fillStyle = '#8e99a2'; c.direction = 'ltr';
  c.textAlign = 'left'; c.fillText(`⏱ ${Math.max(0, Math.ceil(B.limit - B.t))}`, 10, 14);
  c.textAlign = 'right'; c.fillText(B.cfg.boss ? `💥 ${fmt(B.dealt)}` : `🧟 ${B.kills}`, W - 10, 14);
  if (B.cfg.boss) { const z = B.z.find(z => z.type === 'wb'); if (z) { const w = W * .7, x = (W - w) / 2; c.fillStyle = '#000a'; c.fillRect(x, 26, w, 8); c.fillStyle = '#e2513f'; c.fillRect(x, 26, w * Math.max(0, z.hp / z.maxhp), 8); } }
}
function bCards() { for (const h of B.heroes) { if (!h.card) continue; h.hpI.style.width = (h.hp / h.maxhp * 100) + '%'; h.enI.style.width = h.en + '%'; h.card.classList.toggle('ready', h.alive && h.en >= 100 && !S.auto && !B.done); h.card.classList.toggle('dead', !h.alive); } }
function bLoop(ts) {
  if (!B) return; const dt = B.last ? Math.min(.05, (ts - B.last) / 1000) : 0; B.last = ts;
  if (!B.done) for (let i = 0; i < S.spd && !B.done; i++) bStep(dt);
  bDraw(); bCards(); B.raf = requestAnimationFrame(bLoop);
}
function bEnd(win, why) {
  if (B.done) return; B.done = true;
  const lostFrac = clamp(B.dmgTaken / B.maxTotal, 0, 1);
  const wounded = B.cfg.boss ? 0 : Math.round(S.troops * (.1 * lostFrac + (win ? 0 : .06))); S.troops -= wounded;
  const room = Math.max(0, hospCap(lvOf('hospital')) - S.wounded), kept = Math.min(wounded, room); S.wounded += kept; const dead = wounded - kept;
  S.stats.kills += B.kills;
  if (win && !B.cfg.boss) { S.stats.wins++; track('win'); passXP(8); }
  const res = B.cfg.onEnd(win, B) || null;
  setTimeout(win ? SND.win : SND.lose, 200); buzz(win ? 'ok' : 'bad');
  save();
  const el = $('#b-res'); el.hidden = false; el.className = 'result ' + (win ? 'win' : 'lose');
  el.innerHTML = `<div class="panel"><h2>${B.cfg.boss ? t('boss_result') : win ? t('victory') : t('defeat')}</h2><div class="muted">${esc(res && res.note || why || (win ? t('killed_n', B.kills) : t('all_fell')))}</div>
  ${res && res.r ? `<div class="row" style="justify-content:center">${rewHTML(res.r)}</div>` : ''}
  ${wounded ? `<div class="muted sm">${t('wounded_to_hosp', kept)}${dead ? ' · ' + t('dead_n', dead) : ''}</div>` : ''}
  ${!win ? `<p class="muted sm">${t('lose_tip')}</p>` : ''}
  <div class="grid2" style="width:100%">${win && B.cfg.next ? `<button class="btn" id="b-cont">${t('back')}</button><button class="btn pri" id="b-next">${t('next_stage')}</button>` : `<button class="btn pri" id="b-cont" style="grid-column:1/-1">${t('continue')}</button>`}</div></div>`;
  $('#b-cont').onclick = closeBattle;
  const nx = $('#b-next'); if (nx) nx.onclick = () => { closeBattle(); startCampaign(); };
}
function closeBattle() { if (!B) return; cancelAnimationFrame(B.raf); B = null; $('#battle').hidden = true; refresh(); setTimeout(nextPopup, 300); }
function startCampaign() {
  const s = S.stage;
  startBattle({ title: t('campaign_stage', s), waves: stageWaves(s), sc: s, next: true, onEnd: win => { if (!win) return null; const r = stageReward(s); give(r); S.stage = s + 1; addXP(15 + s * 2); return { r }; } });
}
