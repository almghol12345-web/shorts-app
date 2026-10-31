import { pixelRatio, getQuality } from '../platform.js';
// Isometric base view: terrain, buildings by depth, construction, collect bubbles, ambient life & lighting.
import { BASE_LAYOUT, BUILDINGS } from '../data/buildings.js';
import { RES_INFO } from '../data/config.js';
import { iso, TW, TH, drawBuilding, drawConstruction, drawEmptyPlot, drawSoldier, drawZombie, drawBuggy, poly } from './art.js';
import { PanZoom } from './input.js';

const GRID = 23;
export class BaseView {
  constructor(canvas, game, handlers) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.g = game; this.h = handlers;
    this.cam = new PanZoom(canvas, { onTap: (x, y) => this.tap(x, y), minZoom: 0.55, maxZoom: 2 });
    this.ash = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random() * 1.5, v: 0.2 + Math.random() * 0.5 }));
    this.walkers = Array.from({ length: 9 }, (_, i) => ({ path: i % 3, t: Math.random(), speed: 0.02 + Math.random() * 0.02, col: ['#5d6b45', '#6a5a4a', '#4a5a6a'][i % 3] }));
    this.horde = Array.from({ length: 14 }, (_, i) => ({ x: -3 + Math.random() * 28, y: -4 - Math.random() * 3, t: Math.random() * 10, col: i % 4 ? '#7d9a5a' : '#9bd04a' }));
    this.floaters = []; this.selected = null; this.centered = false;
    this.ground = null;
  }
  center() {
    const p = iso(10, 10.5), w = this.c.clientWidth, h = this.c.clientHeight;
    this.cam.zoom = Math.min(1.25, Math.max(0.8, w / 480));
    this.cam.x = w / 2 - p.x * this.cam.zoom; this.cam.y = h / 2 - p.y * this.cam.zoom + 30;
    this.centered = true;
  }
  float(text, slotId, color) {
    const l = BASE_LAYOUT.find((x) => x.id === slotId); if (!l) return;
    const p = iso(l.x, l.y); this.floaters.push({ text, x: p.x, y: p.y - 40, t: 0, color });
  }
  slotScreen(l) { return iso(l.x, l.y); }
  hit(sx, sy) {
    const w = this.cam.toWorld(sx, sy);
    // bubbles first
    for (const l of BASE_LAYOUT) {
      const b = this.g.s.buildings[l.id];
      if (b && BUILDINGS[b.type].produces && this.g.pending(l.id) > 0) {
        const p = iso(l.x, l.y); if (Math.hypot(w.x - p.x, w.y - (p.y - 62)) < 18) return { slot: l.id, bubble: true };
      }
    }
    let best = null, bd = 1e9;
    for (const l of BASE_LAYOUT) {
      const p = iso(l.x, l.y);
      const dx = (w.x - p.x) / (l.size * TW * 0.45), dy = (w.y - (p.y - 14)) / (l.size * TH * 0.9);
      const d = dx * dx + dy * dy;
      if (d < 1.2 && d < bd) { bd = d; best = l; }
    }
    return best ? { slot: best.id } : null;
  }
  tap(sx, sy) {
    const h = this.hit(sx, sy);
    if (!h) { this.selected = null; return; }
    if (h.bubble) { const v = this.g.collect(h.slot); if (v) { const res = BUILDINGS[this.g.s.buildings[h.slot].type].produces; this.float('+' + v.toLocaleString() + ' ' + RES_INFO[res].icon, h.slot, RES_INFO[res].color); this.h.sfx?.('collect'); } return; }
    this.selected = h.slot; this.h.onSelect?.(h.slot);
  }
  resize() {
    const dpr = pixelRatio();
    this.c.width = this.c.clientWidth * dpr; this.c.height = this.c.clientHeight * dpr; this.dpr = dpr;
    if (!this.centered) this.center();
  }
  buildGround() {
    // Pre-render terrain to an offscreen canvas once
    const pad = 12, N = GRID + pad * 2;
    const minX = iso(-pad, N - pad).x, maxX = iso(N - pad, -pad).x, maxY = iso(N - pad, N - pad).y, minY = iso(-pad, -pad).y;
    const oc = document.createElement('canvas'); oc.width = Math.ceil(maxX - minX); oc.height = Math.ceil(maxY - minY + TH);
    const x = oc.getContext('2d'); x.translate(-minX, -minY);
    for (let i = -pad; i < GRID + pad; i++) for (let j = -pad; j < GRID + pad; j++) {
      const inside = i >= 0 && j >= 0 && i < GRID && j < GRID;
      const n = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453 % 1;
      const r = Math.abs(n);
      let col = inside ? `hsl(35,${14 + r * 6}%,${27 + r * 5}%)` : `hsl(${70 + r * 20},${9 + r * 8}%,${18 + r * 5}%)`;
      if (inside && (i === 10 || j === 11 || (j === 7 && i > 3 && i < 18) || (j === 15 && i > 3 && i < 18))) col = `hsl(30,6%,${33 + r * 3}%)`;
      const p = iso(i, j);
      poly(x, [{ x: p.x, y: p.y - TH / 2 }, { x: p.x + TW / 2, y: p.y }, { x: p.x, y: p.y + TH / 2 }, { x: p.x - TW / 2, y: p.y }], col);
      if (!inside && r > 0.85) { x.fillStyle = '#3a3226'; x.fillRect(p.x - 2, p.y - 8, 3, 8); x.fillStyle = 'rgba(60,70,40,0.8)'; x.beginPath(); x.arc(p.x, p.y - 10, 5, 0, 7); x.fill(); }
      if (!inside && r > 0.75 && r < 0.78) { x.fillStyle = '#5a4030'; x.fillRect(p.x - 10, p.y - 6, 18, 6); x.fillStyle = '#2a2a2a'; x.beginPath(); x.arc(p.x - 6, p.y, 3, 0, 7); x.arc(p.x + 5, p.y, 3, 0, 7); x.fill(); }
      if (inside && r < 0.04) { x.fillStyle = 'rgba(0,0,0,0.2)'; x.beginPath(); x.ellipse(p.x, p.y, 8, 4, 0, 0, 7); x.fill(); }
    }
    // perimeter fence
    x.strokeStyle = '#6a5a48'; x.lineWidth = 2;
    const corners = [iso(0, 0), iso(GRID, 0), iso(GRID, GRID), iso(0, GRID), iso(0, 0)];
    x.beginPath(); corners.forEach((c, i) => (i ? x.lineTo(c.x, c.y - 10) : x.moveTo(c.x, c.y - 10))); x.stroke();
    for (let k = 0; k <= GRID; k++) for (const [a, b] of [[k, 0], [GRID, k], [k, GRID], [0, k]]) { const c = iso(a, b); x.beginPath(); x.moveTo(c.x, c.y); x.lineTo(c.x, c.y - 12); x.stroke(); }
    this.ground = { c: oc, x: minX, y: minY };
  }
  render(t) {
    const ctx = this.ctx, W = this.c.width, H = this.c.height, g = this.g;
    if (!this.ground) this.buildGround();
    this.cam.inertia();
    const cyc = (t / 600) % 1; // 10-minute day/night cycle
    const dark = this.h.forceDay?.() ? 0 : Math.max(0, Math.sin(cyc * Math.PI * 2 - Math.PI / 2) * 0.42);
    const night = dark > 0.35;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#2b241d'); sky.addColorStop(1, '#14110e');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(this.cam.zoom * this.dpr, 0, 0, this.cam.zoom * this.dpr, this.cam.x * this.dpr, this.cam.y * this.dpr);
    ctx.drawImage(this.ground.c, this.ground.x, this.ground.y);
    // horde outside the walls
    for (const z of this.horde) { z.x += Math.sin(t * 0.3 + z.t) * 0.004; const p = iso(z.x, z.y); drawZombie(ctx, p.x, p.y, z.col, t + z.t); }
    // draw list sorted by depth
    const items = BASE_LAYOUT.map((l) => ({ l, d: l.x + l.y }));
    const walkerPts = this.walkers.map((w) => { w.t = (w.t + w.speed / 60) % 1; const path = [[[4, 7], [17, 7]], [[10, 4], [10, 19]], [[4, 15], [17, 15]]][w.path]; const k = w.t < 0.5 ? w.t * 2 : 2 - w.t * 2; const x = path[0][0] + (path[1][0] - path[0][0]) * k, y = path[0][1] + (path[1][1] - path[0][1]) * k; return { x, y, w, d: x + y }; });
    const all = [...items, ...walkerPts.map((p) => ({ walker: p, d: p.d }))].sort((a, b) => a.d - b.d);
    for (const it of all) {
      if (it.walker) { const p = iso(it.walker.x, it.walker.y); drawSoldier(ctx, p.x, p.y, it.walker.w.col, Math.sin(t * 8 + it.walker.w.t * 50)); continue; }
      const l = it.l, b = g.s.buildings[l.id], p = iso(l.x, l.y), q = g.s.queues.build.find((x) => x.slot === l.id);
      const unlocked = l.plot || g.lvl('hq') >= BUILDINGS[l.type].unlockHQ;
      if (this.selected === l.id) { ctx.save(); ctx.globalAlpha = 0.35 + Math.sin(t * 5) * 0.15; ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.ellipse(p.x, p.y, l.size * 30, l.size * 15, 0, 0, 7); ctx.fill(); ctx.restore(); }
      if (b && b.lvl > 0) drawBuilding(ctx, b.type, b.lvl, p.x, p.y, t, night);
      else if (!q) {
        if (unlocked) drawEmptyPlot(ctx, p.x, p.y, l.size, this.selected === l.id);
        else { ctx.globalAlpha = 0.35; drawEmptyPlot(ctx, p.x, p.y, l.size, false); ctx.globalAlpha = 1; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🔒', p.x, p.y - 4); }
      }
      if (q) {
        if (!b || b.lvl === 0) { ctx.fillStyle = 'rgba(80,70,50,0.6)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, l.size * 24, l.size * 12, 0, 0, 7); ctx.fill(); }
        drawConstruction(ctx, p.x, p.y, l.size, t);
        const f = Math.min(1, (g.now() - q.start) / (q.end - q.start));
        bar(ctx, p.x - 30, p.y + 14, 60, 7, f, '#f2b33d');
        ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
        const txt = fmtShort(g.remaining(q)); ctx.strokeText(txt, p.x, p.y + 32); ctx.fillText(txt, p.x, p.y + 32);
      }
      if (b && b.lvl > 0) {
        // level badge
        ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center';
        const bx = p.x - l.size * 20, by = p.y + l.size * 4;
        ctx.fillStyle = 'rgba(20,16,12,0.85)'; roundRect(ctx, bx - 11, by - 8, 22, 15, 4); ctx.fill();
        ctx.fillStyle = '#ffd27a'; ctx.fillText(b.lvl, bx, by + 3);
        // collect bubble
        if (BUILDINGS[b.type].produces && !q) {
          const v = g.pending(l.id);
          if (v > 0 && g.pendingFrac(l.id) > 0.02) {
            const bob = Math.sin(t * 3 + l.x) * 3, res = BUILDINGS[b.type].produces;
            ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(p.x, p.y - 62 + bob, 14, 0, 7); ctx.fill();
            ctx.strokeStyle = RES_INFO[res].color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y - 62 + bob, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * g.pendingFrac(l.id)); ctx.stroke();
            ctx.font = '14px sans-serif'; ctx.fillText(RES_INFO[res].icon, p.x, p.y - 57 + bob);
          }
        }
        // training finished/idle indicators
        const tr = BUILDINGS[b.type].trains;
        if (tr) {
          const tq = g.s.queues.train[b.type];
          if (tq) { const f = Math.min(1, (g.now() - tq.start) / (tq.end - tq.start)); bar(ctx, p.x - 24, p.y - 52, 48, 5, f, '#6fb8d6'); }
          else { ctx.font = '13px sans-serif'; ctx.fillText('💤', p.x + 20, p.y - 46 + Math.sin(t * 2) * 2); }
        }
        if (b.type === 'hospital' && g.woundedTotal() > 0 && !g.s.queues.heal) { ctx.font = '14px sans-serif'; ctx.fillText('🩹', p.x + 18, p.y - 48 + Math.sin(t * 3) * 2); }
        if (b.type === 'research' && !g.s.queues.research.length && g.lvl('research')) { ctx.font = '13px sans-serif'; ctx.fillText('💤', p.x + 18, p.y - 50 + Math.sin(t * 2) * 2); }
        if (b.type === 'tavern' && g.freeRecruitReady()) { ctx.font = '14px sans-serif'; ctx.fillText('🎁', p.x + 20, p.y - 52 + Math.sin(t * 3) * 3); }
      }
      if (b?.type === 'garage' && b.lvl > 0) drawBuggy(ctx, p.x - 30, p.y + 18, 0, t);
    }
    // floating texts
    this.floaters = this.floaters.filter((f) => (f.t += 1 / 60) < 1.6);
    for (const f of this.floaters) { ctx.globalAlpha = 1 - f.t / 1.6; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(f.text, f.x, f.y - f.t * 40); ctx.fillStyle = f.color || '#fff'; ctx.fillText(f.text, f.x, f.y - f.t * 40); ctx.globalAlpha = 1; }
    // lighting overlay
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (dark > 0.02) { ctx.fillStyle = `rgba(10,14,40,${dark})`; ctx.fillRect(0, 0, W, H); }
    const warm = ctx.createLinearGradient(0, 0, W, H); warm.addColorStop(0, 'rgba(255,140,60,0.08)'); warm.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = warm; ctx.fillRect(0, 0, W, H);
    // ash
    ctx.fillStyle = 'rgba(220,210,200,0.5)';
    if (getQuality() !== 'low') for (const a of this.ash) { a.y += a.v / H * 2; a.x += Math.sin(t + a.y * 10) * 0.0004; if (a.y > 1) { a.y = 0; a.x = Math.random(); } ctx.fillRect(a.x * W, a.y * H, a.s * this.dpr, a.s * this.dpr); }
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    this.isNight = night;
  }
}
export function bar(ctx, x, y, w, h, f, col) {
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; roundRect(ctx, x - 1, y - 1, w + 2, h + 2, 3); ctx.fill();
  ctx.fillStyle = col; roundRect(ctx, x, y, Math.max(2, w * f), h, 2); ctx.fill();
}
export function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
export function fmtShort(sec) {
  sec = Math.max(0, Math.round(sec));
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  if (d) return `${d}d ${h}h`; if (h) return `${h}h ${m}m`; if (m) return `${m}m ${s}s`; return `${s}s`;
}
