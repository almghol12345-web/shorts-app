import { pixelRatio } from '../platform.js';
// Top-down world map: procedural terrain, alliance territory, objects, marches.
import { WORLD_SIZE } from '../data/config.js';
import { terrainAt, NPC_ALLIANCES, TERRITORY_R, NODE_TYPES } from '../core/world.js';
import { hash2 } from '../core/rng.js';
import { PanZoom } from './input.js';
import { drawZombie, drawSoldier } from './art.js';
import { roundRect } from './base.js';
import { RES_INFO } from '../data/config.js';

const TS = 40;
const TCOL = ['#4a4236', '#55504a', '#3a4030', '#1f3340', '#5f5a50', '#3d4a1e'];

export class WorldView {
  constructor(canvas, game, handlers) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.g = game; this.h = handlers;
    this.cam = new PanZoom(canvas, { onTap: (x, y) => this.tap(x, y), minZoom: 0.35, maxZoom: 1.8, zoom: 0.75 });
    this.sel = null; this.chunkCache = new Map(); this.objs = []; this.remote = [];
  }
  resize() { const dpr = pixelRatio(); this.c.width = this.c.clientWidth * dpr; this.c.height = this.c.clientHeight * dpr; this.dpr = dpr; }
  goTo(x, y) { this.cam.x = this.c.clientWidth / 2 - (x + 0.5) * TS * this.cam.zoom; this.cam.y = this.c.clientHeight / 2 - (y + 0.5) * TS * this.cam.zoom; }
  goHome() { const p = this.g.basePos(); this.goTo(p.x, p.y); }
  centerTile() { const w = this.cam.toWorld(this.c.clientWidth / 2, this.c.clientHeight / 2); return { x: Math.floor(w.x / TS), y: Math.floor(w.y / TS) }; }
  tap(sx, sy) {
    const w = this.cam.toWorld(sx, sy), tx = Math.floor(w.x / TS), ty = Math.floor(w.y / TS);
    const p = this.g.basePos();
    if (Math.abs(tx - p.x) <= 1 && Math.abs(ty - p.y) <= 1) { this.sel = { kind: 'home', x: p.x, y: p.y }; this.h.onSelect?.(this.sel); return; }
    const m = this.g.s.marches.find((m) => { const q = this.g.marchPos(m); return Math.hypot(q.x - w.x / TS + 0.5, q.y - w.y / TS + 0.5) < 0.8; });
    if (m) { this.h.onMarch?.(m); return; }
    const o = [...this.objs, ...this.remote].find((o) => Math.abs(o.x - tx) <= (o.kind === 'rival' || o.kind === 'boss' ? 1 : 0) && Math.abs(o.y - ty) <= (o.kind === 'rival' || o.kind === 'boss' ? 1 : 0)) ||
      [...this.objs, ...this.remote].find((o) => Math.hypot(o.x - tx, o.y - ty) <= 1);
    this.sel = o || { kind: 'empty', x: tx, y: ty, terrain: terrainAt(tx, ty) };
    this.h.onSelect?.(this.sel);
  }
  tile(ctx, x, y, t) {
    const tt = terrainAt(x, y), r = hash2(x, y, 9), px = x * TS, py = y * TS;
    ctx.fillStyle = TCOL[tt]; ctx.fillRect(px, py, TS + 0.5, TS + 0.5);
    if (tt === 0) { if (r > 0.8) { ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(px + 20, py + 22, 10, 5, 0, 0, 7); ctx.fill(); } if (r < 0.1) { ctx.fillStyle = '#6a5a40'; ctx.fillRect(px + 10, py + 18, 4, 4); } }
    else if (tt === 1) {
      ctx.fillStyle = r > 0.5 ? '#6a655d' : '#5e5850'; ctx.fillRect(px + 6, py + 6 + r * 6, 18 + r * 10, 22 - r * 6);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(px + 9, py + 10 + r * 6, 4, 4); ctx.fillRect(px + 17, py + 10 + r * 6, 4, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px + 24 + r * 10, py + 10, 4, 22 - r * 6);
    } else if (tt === 2) {
      for (let k = 0; k < 2; k++) { const ox = px + 10 + k * 16 + r * 6, oy = py + 28 - k * 6; ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox, oy - 16); ctx.moveTo(ox, oy - 10); ctx.lineTo(ox - 6, oy - 16); ctx.moveTo(ox, oy - 12); ctx.lineTo(ox + 5, oy - 18); ctx.stroke(); }
    } else if (tt === 3) {
      ctx.strokeStyle = 'rgba(120,170,200,0.25)'; ctx.lineWidth = 1; const w = Math.sin(t * 1.5 + x + y) * 3; ctx.beginPath(); ctx.moveTo(px + 6, py + 16 + w); ctx.quadraticCurveTo(px + 20, py + 12 + w, px + 34, py + 16 + w); ctx.stroke();
    } else if (tt === 4) {
      ctx.fillStyle = '#4a4640'; ctx.fillRect(px, py + 14, TS, 12); ctx.fillStyle = 'rgba(230,200,90,0.5)'; ctx.fillRect(px + 4, py + 19, 12, 2); ctx.fillRect(px + 24, py + 19, 12, 2);
      if (r > 0.85) { ctx.fillStyle = '#7a3a2a'; ctx.fillRect(px + 12, py + 12, 14, 8); ctx.fillStyle = '#222'; ctx.fillRect(px + 14, py + 19, 3, 3); ctx.fillRect(px + 22, py + 19, 3, 3); }
    } else if (tt === 5) {
      ctx.fillStyle = `rgba(150,220,60,${0.15 + Math.sin(t * 2 + r * 10) * 0.08})`; ctx.fillRect(px, py, TS, TS);
      if (r > 0.6) { ctx.fillStyle = '#9bd04a'; ctx.beginPath(); ctx.arc(px + 20, py + 20, 4, 0, 7); ctx.fill(); }
    }
  }
  render(t) {
    const ctx = this.ctx, W = this.c.width, H = this.c.height, g = this.g, z = this.cam.zoom;
    this.cam.inertia();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#10161a'; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(z * this.dpr, 0, 0, z * this.dpr, this.cam.x * this.dpr, this.cam.y * this.dpr);
    const tl = this.cam.toWorld(0, 0), br = this.cam.toWorld(this.c.clientWidth, this.c.clientHeight);
    const x0 = Math.max(0, Math.floor(tl.x / TS) - 1), y0 = Math.max(0, Math.floor(tl.y / TS) - 1), x1 = Math.min(WORLD_SIZE - 1, Math.ceil(br.x / TS) + 1), y1 = Math.min(WORLD_SIZE - 1, Math.ceil(br.y / TS) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.tile(ctx, x, y, t);
    // territories
    const myTag = g.s.alliance?.tag;
    for (const a of NPC_ALLIANCES) {
      if (a.x + TERRITORY_R < x0 || a.x - TERRITORY_R > x1 || a.y + TERRITORY_R < y0 || a.y - TERRITORY_R > y1) continue;
      const mine = myTag === a.tag;
      ctx.fillStyle = a.color + (mine ? '30' : '1c'); ctx.beginPath(); ctx.arc((a.x + 0.5) * TS, (a.y + 0.5) * TS, TERRITORY_R * TS, 0, 7); ctx.fill();
      ctx.strokeStyle = a.color + 'aa'; ctx.lineWidth = 3; ctx.setLineDash([12, 8]); ctx.stroke(); ctx.setLineDash([]);
      drawFortress(ctx, a.x, a.y, a.color, 1.4, t);
      label(ctx, `[${a.tag}] ${a.name} HQ`, (a.x + 0.5) * TS, (a.y + 2.2) * TS, a.color);
    }
    // objects
    this.objs = g.visibleObjects(x0, y0, x1, y1);
    const showLabels = z > 0.55;
    for (const o of [...this.objs, ...this.remote.filter((r) => r.x >= x0 && r.x <= x1 && r.y >= y0 && r.y <= y1)]) {
      const cx = (o.x + 0.5) * TS, cy = (o.y + 0.5) * TS;
      if (o.kind === 'zombie') { drawZombie(ctx, cx - 7, cy + 10, '#7d9a5a', t, 1.1); drawZombie(ctx, cx + 7, cy + 12, '#8aa860', t + 1, 1); drawZombie(ctx, cx, cy + 4, '#6c8a4e', t + 2, 1.2); badge(ctx, cx, cy - 18, o.lvl, '#7da44a'); }
      else if (o.kind === 'boss') { ctx.fillStyle = 'rgba(150,40,40,0.25)'; ctx.beginPath(); ctx.arc(cx, cy, 34 + Math.sin(t * 3) * 3, 0, 7); ctx.fill(); drawZombie(ctx, cx, cy + 16, '#5a7a3a', t, 2.4); badge(ctx, cx, cy - 34, o.lvl, '#c33'); if (showLabels) label(ctx, 'World Boss', cx, cy + 32, '#ff8a7a'); }
      else if (o.kind === 'node') {
        const st = g.objectState(o);
        ctx.font = '24px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(NODE_TYPES[o.res].icon, cx, cy + 8);
        if (showLabels) { const f = st.amount / o.amount; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(cx - 14, cy + 13, 28, 4); ctx.fillStyle = RES_INFO[o.res].color; ctx.fillRect(cx - 14, cy + 13, 28 * f, 4); }
        badge(ctx, cx + 14, cy - 12, o.lvl, '#a08a5a');
        if (st.occupied) { ctx.font = '12px sans-serif'; ctx.fillText('⛏️', cx - 14, cy - 8); }
      }
      else if (o.kind === 'camp') { drawCamp(ctx, cx, cy, t); badge(ctx, cx, cy - 20, o.lvl, '#b0563a'); }
      else if (o.kind === 'rival') { drawFortress(ctx, o.x, o.y, o.remote ? '#5fd3ff' : '#9a8a7a', 0.9, t); if (showLabels) label(ctx, `${o.tag ? '[' + o.tag + '] ' : ''}${o.name}${o.remote ? '' : ' (AI)'}`, cx, cy + 34, o.remote ? '#5fd3ff' : '#ddd'); badge(ctx, cx + 22, cy - 22, o.hq, '#777'); }
      if (this.sel && this.sel.id === o.id) { ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, 26 + Math.sin(t * 6) * 2, 0, 7); ctx.stroke(); }
    }
    // my base
    const bp = g.basePos();
    if (g.now() < g.s.shieldUntil) { ctx.fillStyle = 'rgba(95,211,255,0.12)'; ctx.strokeStyle = 'rgba(95,211,255,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc((bp.x + 0.5) * TS, (bp.y + 0.5) * TS, 56, 0, 7); ctx.fill(); ctx.stroke(); }
    drawFortress(ctx, bp.x, bp.y, '#ffd27a', 1.3, t);
    label(ctx, `${g.s.alliance ? '[' + g.s.alliance.tag + '] ' : ''}${g.s.player.name}`, (bp.x + 0.5) * TS, (bp.y + 2.3) * TS, '#ffd27a');
    // marches
    for (const m of g.s.marches) {
      const p = g.marchPos(m), sx = (bp.x + 0.5) * TS, sy = (bp.y + 0.5) * TS, tx = (m.tx + 0.5) * TS, ty = (m.ty + 0.5) * TS;
      ctx.strokeStyle = m.kind === 'attack' ? 'rgba(255,90,60,0.8)' : m.kind === 'scout' ? 'rgba(200,200,255,0.7)' : 'rgba(120,230,120,0.8)';
      ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 30 * (m.state === 'return' ? -1 : 1);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
      const mx = (p.x + 0.5) * TS, my = (p.y + 0.5) * TS;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(mx, my, 13, 0, 7); ctx.fill();
      if (m.kind === 'scout') { ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('🦅', mx, my + 6); }
      else { drawSoldier(ctx, mx - 5, my + 8, '#5d6b45', Math.sin(t * 10)); drawSoldier(ctx, mx + 5, my + 8, '#6a5a4a', Math.cos(t * 10)); }
      if (m.state === 'gather') { const f = Math.min(1, (g.now() - m.gatherStart) / (m.gatherEnd - m.gatherStart)); ctx.fillStyle = '#000'; ctx.fillRect(mx - 16, my - 22, 32, 5); ctx.fillStyle = '#7de07a'; ctx.fillRect(mx - 16, my - 22, 32 * f, 5); }
    }
    // atmosphere
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,120,50,0.05)'; ctx.fillRect(0, 0, W, H);
  }
}
function badge(ctx, x, y, n, col) {
  ctx.fillStyle = 'rgba(15,12,10,0.9)'; roundRect(ctx, x - 11, y - 8, 22, 15, 4); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(n, x, y + 3);
}
function label(ctx, txt, x, y, col) {
  ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; const w = ctx.measureText(txt).width + 10;
  ctx.fillStyle = 'rgba(10,10,10,0.75)'; roundRect(ctx, x - w / 2, y - 10, w, 15, 4); ctx.fill();
  ctx.fillStyle = col; ctx.fillText(txt, x, y + 1);
}
function drawFortress(ctx, x, y, col, s, t) {
  const cx = (x + 0.5) * TS, cy = (y + 0.5) * TS;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 10, 30, 12, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#5a5248'; ctx.fillRect(-26, -10, 52, 22); ctx.fillStyle = '#4a433a'; ctx.fillRect(-26, 8, 52, 4);
  for (let i = -26; i < 26; i += 8) { ctx.fillStyle = '#6a6258'; ctx.fillRect(i, -14, 5, 5); }
  ctx.fillStyle = '#6e665c'; ctx.fillRect(-12, -26, 24, 20); ctx.fillStyle = '#ffcf6b'; ctx.fillRect(-7, -20, 4, 5); ctx.fillRect(3, -20, 4, 5);
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(0, -44); ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -44); ctx.lineTo(14, -40 + Math.sin(t * 3) * 2); ctx.lineTo(0, -35); ctx.fill();
  ctx.restore();
}
function drawCamp(ctx, cx, cy, t) {
  for (let i = 0; i < 3; i++) { const x = cx - 14 + i * 14, y = cy + (i === 1 ? -4 : 4); ctx.fillStyle = i === 1 ? '#7a3a2a' : '#6a4a32'; ctx.beginPath(); ctx.moveTo(x - 9, y + 8); ctx.lineTo(x, y - 8); ctx.lineTo(x + 9, y + 8); ctx.fill(); }
  ctx.fillStyle = '#ff9a3c'; ctx.beginPath(); ctx.ellipse(cx, cy + 14, 3, 5 + Math.sin(t * 10) * 1.5, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = '#222'; ctx.beginPath(); ctx.moveTo(cx + 18, cy + 10); ctx.lineTo(cx + 18, cy - 14); ctx.stroke(); ctx.fillStyle = '#111'; ctx.fillRect(cx + 18, cy - 14, 10, 7); ctx.fillStyle = '#fff'; ctx.font = '6px sans-serif'; ctx.fillText('☠', cx + 23, cy - 8);
}
