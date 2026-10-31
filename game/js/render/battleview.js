// Plays back a combat log with animated squads, projectiles, skill banners and damage numbers.
import { heroPortrait, drawSoldier, drawZombie, drawBuggy } from './art.js';
import { roundRect } from './base.js';

const DUR = { atk: 0.42, sk: 0.42, skill: 0.75, heal: 0.4, shield: 0.35, buff: 0.25, debuff: 0.25, stun: 0.25, stunned: 0.2, taunt: 0.4, die: 0.45 };

export class BattleView {
  constructor(canvas, sfx) { this.c = canvas; this.ctx = canvas.getContext('2d'); this.sfx = sfx; this.speed = 1; this.imgs = {}; }
  load(a, b, result) {
    this.result = result; this.log = result.log; this.i = 0; this.et = 0; this.done = false; this.fx = []; this.nums = []; this.banner = null; this.shake = 0;
    const mk = (arr, side) => arr.map((s, i) => ({ ...s, side, key: side + i, hp: s.hp, max: s.hp, alive: true, shield: 0, stun: false, flash: 0, lunge: 0, alpha: 1 }));
    this.units = [...mk(a, 'a'), ...mk(b, 'b')];
    this.byKey = Object.fromEntries(this.units.map((u) => [u.key, u]));
    for (const u of this.units) if (u.heroId && !this.imgs[u.heroId]) { const im = new Image(); im.src = heroPortrait(u.heroId, 96); this.imgs[u.heroId] = im; }
    this.layout();
  }
  resize() { const dpr = Math.min(2, window.devicePixelRatio || 1); this.c.width = this.c.clientWidth * dpr; this.c.height = this.c.clientHeight * dpr; this.dpr = dpr; this.layout(); }
  layout() {
    if (!this.units) return;
    const W = this.c.clientWidth, H = this.c.clientHeight;
    for (const side of ['a', 'b']) for (const row of [0, 1]) {
      const us = this.units.filter((u) => u.side === side && (u.row || 0) === row);
      us.forEach((u, i) => {
        u.x = W * (i + 1) / (us.length + 1);
        const yy = side === 'a' ? (row === 0 ? 0.6 : 0.8) : (row === 0 ? 0.36 : 0.16);
        u.y = H * yy;
      });
    }
  }
  skip() { while (this.i < this.log.length) this.apply(this.log[this.i++], true); this.done = true; }
  apply(e, silent) {
    const s = this.byKey[e.s], d = this.byKey[e.d];
    switch (e.k) {
      case 'atk': case 'sk':
        if (d) { let left = e.v; if (d.shield > 0) { const k = Math.min(d.shield, left); d.shield -= k; left -= k; } d.hp = Math.max(0, d.hp - left); d.flash = 1; }
        if (!silent) { s && (s.lunge = 1); this.fx.push({ kind: e.k === 'sk' ? 'big' : s?.troopType === 'ranged' || s?.troopType === 'vehicle' ? 'shot' : 'slash', from: s, to: d, t: 0 }); this.nums.push({ x: d.x + (Math.random() - 0.5) * 30, y: d.y - 30, text: (e.c ? 'CRIT ' : '') + fmt(e.v), col: e.c ? '#ffd23a' : e.k === 'sk' ? '#ff8a3c' : '#fff', t: 0, big: e.c || e.k === 'sk' });
          this.sfx?.(e.k === 'sk' ? 'boom' : 'hit'); if (e.c || e.k === 'sk') this.shake = 6; }
        break;
      case 'heal': if (d) { d.hp = Math.min(d.max, d.hp + e.v); if (!silent) this.nums.push({ x: d.x, y: d.y - 30, text: '+' + fmt(e.v), col: '#6dff8a', t: 0 }); if (!silent) this.fx.push({ kind: 'heal', to: d, t: 0 }); } break;
      case 'shield': if (s) { s.shield = e.v; if (!silent) this.fx.push({ kind: 'shield', to: s, t: 0 }); } break;
      case 'skill': if (!silent && s) { this.banner = { text: e.n, side: s.side, t: 0, hero: s.heroId }; this.sfx?.('skill'); } break;
      case 'stun': if (s) s.stun = true; break;
      case 'stunned': if (s) s.stun = false; break;
      case 'buff': if (!silent && s) this.fx.push({ kind: 'buff', to: s, t: 0 }); break;
      case 'debuff': if (!silent && s) this.fx.push({ kind: 'debuff', to: s, t: 0 }); break;
      case 'taunt': if (!silent && s) this.fx.push({ kind: 'taunt', to: s, t: 0 }); break;
      case 'die': if (s) { s.alive = false; s.hp = 0; if (!silent) this.sfx?.('die'); } break;
    }
  }
  update(dt) {
    if (this.done) return;
    this.et -= dt * this.speed;
    while (this.et <= 0 && this.i < this.log.length) {
      const e = this.log[this.i++]; this.apply(e);
      this.et += DUR[e.k] ?? 0.3;
      if (e.k === 'skill') break;
    }
    if (this.i >= this.log.length && this.et <= 0) { this.done = true; }
  }
  render(t, dt) {
    const ctx = this.ctx, W = this.c.clientWidth, H = this.c.clientHeight;
    this.update(dt);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.shake > 0) { ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake); this.shake *= 0.85; if (this.shake < 0.3) this.shake = 0; }
    // backdrop
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2a1d18'); g.addColorStop(0.48, '#3a3026'); g.addColorStop(0.52, '#3e3428'); g.addColorStop(1, '#1d1814'); ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, H + 20);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.ellipse((i * 97) % W, H * 0.5 + ((i * 53) % 80) - 40, 30, 8, 0, 0, 7); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,180,90,0.15)'; ctx.setLineDash([6, 10]); ctx.beginPath(); ctx.moveTo(0, H * 0.48); ctx.lineTo(W, H * 0.48); ctx.stroke(); ctx.setLineDash([]);
    // units
    for (const u of this.units) {
      if (!u.alive) u.alpha = Math.max(0.15, u.alpha - dt * 2);
      u.lunge = Math.max(0, u.lunge - dt * 4 * this.speed); u.flash = Math.max(0, u.flash - dt * 5 * this.speed);
      const dir = u.side === 'a' ? -1 : 1, ly = u.lunge * 14 * dir;
      ctx.globalAlpha = u.alpha;
      // troop cluster
      const n = Math.min(7, Math.max(u.troops ? 3 : 0, Math.ceil(7 * u.hp / u.max)));
      for (let k = 0; k < (u.structure ? 0 : n); k++) {
        const ox = u.x + ((k % 4) - 1.5) * 14 + (k >= 4 ? 7 : 0), oy = u.y + ly + 18 + Math.floor(k / 4) * 10 + (u.side === 'b' ? -36 : 0);
        if (u.zombie || u.boss) drawZombie(ctx, ox, oy, u.color || '#7d9a5a', t + k, u.boss ? 1.4 : 1.1);
        else if (u.troopType === 'vehicle' && k % 2 === 0) drawBuggy(ctx, ox, oy, 0, t);
        else drawSoldier(ctx, ox, oy, u.side === 'a' ? '#5d6b45' : '#7a3a2a', Math.sin(t * 6 + k));
      }
      // token
      const R = u.boss ? 30 : 24;
      ctx.save(); ctx.translate(u.x, u.y + ly);
      ctx.fillStyle = u.side === 'a' ? '#2a3a4a' : '#4a2a26'; ctx.beginPath(); ctx.arc(0, 0, R + 3, 0, 7); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.clip();
      if (u.heroId && this.imgs[u.heroId]?.complete) ctx.drawImage(this.imgs[u.heroId], -R, -R * 1.1, R * 2, R * 2.4);
      else { ctx.fillStyle = u.color || '#555'; ctx.fillRect(-R, -R, R * 2, R * 2); ctx.font = `${R}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(u.icon || '?', 0, R * 0.35); }
      if (u.flash > 0) { ctx.fillStyle = `rgba(255,60,40,${u.flash * 0.6})`; ctx.fillRect(-R, -R, R * 2, R * 2); }
      ctx.restore();
      ctx.strokeStyle = u.side === 'a' ? '#5fd3ff' : '#ff6a4a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, R + 1, 0, 7); ctx.stroke();
      if (u.shield > 0) { ctx.strokeStyle = 'rgba(120,200,255,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R + 7, 0, 7); ctx.stroke(); }
      if (u.stun) { ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('💫', 0, -R - 6); }
      // HP bar
      const f = u.hp / u.max; ctx.fillStyle = 'rgba(0,0,0,0.7)'; roundRect(ctx, -R - 4, R + 5, R * 2 + 8, 7, 3); ctx.fill();
      ctx.fillStyle = f > 0.5 ? '#5fd35f' : f > 0.25 ? '#e8c03a' : '#e85a3a'; roundRect(ctx, -R - 3, R + 6, (R * 2 + 6) * f, 5, 2); ctx.fill();
      ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(short(u.name), 0, R + 22);
      ctx.restore(); ctx.globalAlpha = 1;
    }
    // effects
    this.fx = this.fx.filter((f) => (f.t += dt * this.speed * 2.6) < 1);
    for (const f of this.fx) {
      if ((f.kind === 'shot' || f.kind === 'big' || f.kind === 'slash') && f.from && f.to) {
        const x = f.from.x + (f.to.x - f.from.x) * f.t, y = f.from.y + (f.to.y - f.from.y) * f.t;
        if (f.kind === 'slash') { ctx.strokeStyle = `rgba(255,255,255,${1 - f.t})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.to.x, f.to.y, 26, -0.8 + f.t * 2, 0.4 + f.t * 2); ctx.stroke(); }
        else { ctx.fillStyle = f.kind === 'big' ? '#ff8a3c' : '#ffe9a0'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(x, y, f.kind === 'big' ? 8 : 3.5, 0, 7); ctx.fill(); ctx.shadowBlur = 0; if (f.kind === 'big' && f.t > 0.8) { ctx.fillStyle = `rgba(255,140,40,${(1 - f.t) * 3})`; ctx.beginPath(); ctx.arc(f.to.x, f.to.y, 40 * f.t, 0, 7); ctx.fill(); } }
      } else if (f.kind === 'heal') { ctx.fillStyle = `rgba(100,255,140,${0.5 * (1 - f.t)})`; ctx.beginPath(); ctx.arc(f.to.x, f.to.y, 30 + f.t * 15, 0, 7); ctx.fill(); }
      else if (f.kind === 'shield') { ctx.strokeStyle = `rgba(120,200,255,${1 - f.t})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.to.x, f.to.y, 28 + f.t * 20, 0, 7); ctx.stroke(); }
      else if (f.kind === 'buff') { ctx.fillStyle = `rgba(255,200,60,${1 - f.t})`; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center'; ctx.fillText('▲ATK', f.to.x, f.to.y - 34 - f.t * 20); }
      else if (f.kind === 'debuff') { ctx.fillStyle = `rgba(180,120,255,${1 - f.t})`; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText('▼ATK', f.to.x, f.to.y - 34 - f.t * 20); }
      else if (f.kind === 'taunt') { ctx.strokeStyle = `rgba(255,80,60,${1 - f.t})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(f.to.x, f.to.y, 30 + f.t * 40, 0, 7); ctx.stroke(); }
    }
    this.nums = this.nums.filter((n) => (n.t += dt * this.speed) < 1.1);
    for (const n of this.nums) { ctx.globalAlpha = Math.min(1, 2 - n.t * 1.8); ctx.font = `bold ${n.big ? 17 : 13}px system-ui`; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(n.text, n.x, n.y - n.t * 30); ctx.fillStyle = n.col; ctx.fillText(n.text, n.x, n.y - n.t * 30); ctx.globalAlpha = 1; }
    if (this.banner) {
      const b = this.banner; b.t += dt * this.speed;
      if (b.t > 1.2) this.banner = null;
      else { const a = Math.min(1, b.t * 5, (1.2 - b.t) * 4); ctx.globalAlpha = a; const y = H * 0.48; const gr = ctx.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, b.side === 'a' ? 'rgba(30,90,140,0.9)' : 'rgba(140,40,30,0.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(0, y - 22, W, 44); ctx.font = 'italic 900 22px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(b.text.toUpperCase(), W / 2 + (1 - Math.min(1, b.t * 4)) * 80, y + 8); ctx.globalAlpha = 1; }
    }
  }
}
function fmt(v) { return v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e4 ? (v / 1e3).toFixed(1) + 'K' : String(v); }
function short(n) { return n.length > 14 ? n.slice(0, 13) + '…' : n; }
