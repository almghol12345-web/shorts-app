// Procedural artwork: isometric buildings that change with level tiers, hero portraits, unit sprites.
// No external image assets — everything is drawn from code so the art style stays consistent.
import { HERO_BY_ID } from '../data/heroes.js';
import { RARITY } from '../data/config.js';

export const TW = 64, TH = 32; // iso tile size
export function iso(x, y) { return { x: (x - y) * TW / 2, y: (x + y) * TH / 2 }; }
export function tierOf(lvl) { return lvl < 5 ? 0 : lvl < 10 ? 1 : lvl < 15 ? 2 : lvl < 20 ? 3 : 4; }

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (f > 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');
}
// Material palettes per tier: scrap wood → sheet metal → concrete → armored → hi-tech
const MAT = [
  { wall: '#7a5a3c', roof: '#5b3f28', trim: '#a07a50', glow: '#ffb35c' },
  { wall: '#7d848a', roof: '#565d63', trim: '#a8b0b6', glow: '#ffc46b' },
  { wall: '#8a8f86', roof: '#4d5a62', trim: '#c9b98f', glow: '#ffd27a' },
  { wall: '#4f565c', roof: '#33393e', trim: '#e0832f', glow: '#ff9a3c' },
  { wall: '#3a4652', roof: '#232c35', trim: '#47e0ff', glow: '#6ff3ff' },
];

// Iso prism centered at (cx, cy) ground point; w,d in tiles; h in px
export function box(ctx, cx, cy, w, d, h, col, opts = {}) {
  // footprint corners in iso: u-axis goes down-right, v-axis goes down-left
  const p = (u, v) => ({ x: cx + (u - v) * TW / 4, y: cy + (u + v) * TH / 4 });
  const c1 = p(-w, -d), c2 = p(w, -d), c3 = p(w, d), c4 = p(-w, d);
  const up = (pt) => ({ x: pt.x, y: pt.y - h });
  // left face (c4 -> c3), right face (c3 -> c2)
  poly(ctx, [c4, c3, up(c3), up(c4)], shade(col, -0.18));
  poly(ctx, [c3, c2, up(c2), up(c3)], shade(col, -0.38));
  poly(ctx, [up(c1), up(c2), up(c3), up(c4)], opts.top || shade(col, 0.12));
  if (opts.stroke !== false) {
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(up(c4).x, up(c4).y); ctx.lineTo(up(c3).x, up(c3).y); ctx.lineTo(up(c2).x, up(c2).y); ctx.moveTo(up(c3).x, up(c3).y); ctx.lineTo(c3.x, c3.y); ctx.stroke();
  }
  return { c1, c2, c3, c4, top: (u, v) => up(p(u, v)), face: (u, v, z) => ({ x: p(u, v).x, y: p(u, v).y - z }) };
}
export function poly(ctx, pts, fill) { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
function cyl(ctx, cx, cy, r, h, col) {
  const ry = r * 0.5;
  ctx.fillStyle = shade(col, -0.3); ctx.beginPath(); ctx.ellipse(cx, cy, r, ry, 0, 0, Math.PI); ctx.lineTo(cx - r, cy - h); ctx.ellipse(cx, cy - h, r, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
  const g = ctx.createLinearGradient(cx - r, 0, cx + r, 0); g.addColorStop(0, shade(col, -0.05)); g.addColorStop(0.4, shade(col, 0.15)); g.addColorStop(1, shade(col, -0.45));
  ctx.fillStyle = g; ctx.fillRect(cx - r, cy - h, r * 2, h);
  ctx.beginPath(); ctx.ellipse(cx, cy, r, ry, 0, 0, Math.PI); ctx.fill();
  ctx.fillStyle = shade(col, 0.2); ctx.beginPath(); ctx.ellipse(cx, cy - h, r, ry, 0, 0, Math.PI * 2); ctx.fill();
}
function roofGable(ctx, b, w, d, h, rh, col) {
  const a = b.top(-w, 0), c = b.top(w, 0); const ridgeA = { x: a.x, y: a.y - rh }, ridgeC = { x: c.x, y: c.y - rh };
  poly(ctx, [b.top(-w, d), b.top(w, d), ridgeC, ridgeA], shade(col, -0.05));
  poly(ctx, [b.top(w, d), b.top(w, -d), ridgeC], shade(col, -0.35));
}
function windows(ctx, b, w, d, h, rows, glow, night) {
  ctx.fillStyle = night ? glow : 'rgba(30,40,50,0.8)';
  for (let r = 0; r < rows; r++) for (let i = 0; i < Math.max(1, Math.round(w * 1.5)); i++) {
    const u = -w + (i + 0.5) * (2 * w) / Math.max(1, Math.round(w * 1.5));
    const p = b.face(u, d, (r + 0.35) * h / rows);
    ctx.fillRect(p.x - 3, p.y - 4, 5, 6);
  }
  for (let r = 0; r < rows; r++) { const p = b.face(w, 0, (r + 0.35) * h / rows); ctx.fillRect(p.x + 3, p.y - 4, 4, 5); }
}
function flag(ctx, x, y, h, col, t) {
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
  const wv = Math.sin(t * 3 + x) * 3;
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.quadraticCurveTo(x + 9, y - h + wv, x + 18, y - h + 2 + wv); ctx.lineTo(x + 18, y - h + 11 + wv); ctx.quadraticCurveTo(x + 9, y - h + 9 + wv, x, y - h + 10); ctx.fill();
}
function light(ctx, x, y, r, col, a = 0.5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function smoke(ctx, x, y, t, n = 4, col = '120,120,120') {
  for (let i = 0; i < n; i++) {
    const k = ((t * 0.4 + i / n) % 1);
    ctx.fillStyle = `rgba(${col},${0.45 * (1 - k)})`;
    ctx.beginPath(); ctx.arc(x + Math.sin(k * 6 + i) * 6 + k * 10, y - k * 50, 4 + k * 10, 0, Math.PI * 2); ctx.fill();
  }
}
function pad(ctx, cx, cy, s, col = '#3b3631') {
  const p = (u, v) => ({ x: cx + (u - v) * TW / 4, y: cy + (u + v) * TH / 4 });
  poly(ctx, [p(-s, -s), p(s, -s), p(s, s), p(-s, s)], col);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.stroke();
}

// ---------- building painters ----------
const PAINT = {
  hq(ctx, cx, cy, lvl, t, night) {
    const tr = tierOf(lvl), m = MAT[tr];
    pad(ctx, cx, cy, 3, '#433c34');
    const h1 = 34 + tr * 8;
    const b = box(ctx, cx, cy, 2.2, 2.2, h1, m.wall);
    windows(ctx, b, 2.2, 2.2, h1, 2, m.glow, night);
    const b2 = box(ctx, cx, cy - h1, 1.4, 1.4, 22 + tr * 8, shade(m.wall, 0.08));
    windows(ctx, b2, 1.4, 1.4, 22 + tr * 8, 1 + (tr > 1), m.glow, night);
    const topY = cy - h1 - 22 - tr * 8;
    if (tr >= 2) { box(ctx, cx, topY, 0.6, 0.6, 18 + tr * 4, m.roof); }
    const antY = topY - (tr >= 2 ? 18 + tr * 4 : 0);
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, antY); ctx.lineTo(cx, antY - 26); ctx.stroke();
    ctx.fillStyle = Math.sin(t * 4) > 0 ? '#ff3b30' : '#661510'; ctx.beginPath(); ctx.arc(cx, antY - 27, 2.5, 0, 7); ctx.fill();
    flag(ctx, cx + 30, cy - h1 - 4, 30, tr >= 3 ? '#e0832f' : '#b23a2a', t);
    // sandbags / plates on the front
    for (let i = -2; i <= 2; i++) { const p = b.face(i * 0.8, 2.4, 0); ctx.fillStyle = tr >= 3 ? '#555' : '#8a7a5a'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, 7, 4, 0, 0, 7); ctx.fill(); }
    if (tr >= 4) light(ctx, cx, antY - 27, 30, '#6ff3ff', 0.6);
    if (night) light(ctx, cx, cy - h1 / 2, 70, '#ffb35c', 0.25);
  },
  wall(ctx, cx, cy, lvl, t) {
    const tr = tierOf(lvl), m = MAT[tr];
    for (let i = -3; i <= 3; i++) {
      const x = cx + i * TW / 4 * 1.6, y = cy - i * TH / 4 * 1.6;
      box(ctx, x, y, 0.8, 0.45, 18 + tr * 5, i % 2 ? m.wall : shade(m.wall, -0.1));
      if (tr >= 1) { ctx.fillStyle = '#2a2a2a'; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(x + k * 7 - 2, y - 18 - tr * 5 - 2); ctx.lineTo(x + k * 7, y - 28 - tr * 5); ctx.lineTo(x + k * 7 + 2, y - 18 - tr * 5 - 2); ctx.fill(); } }
      if (tr >= 3 && i % 2 === 0) { ctx.fillStyle = m.trim; ctx.fillRect(x - 8, y - 10, 16, 3); }
    }
    void t;
  },
  farm(ctx, cx, cy, lvl, t, night) {
    const tr = tierOf(lvl), m = MAT[tr];
    pad(ctx, cx, cy, 1.8, '#3d3a2a');
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const p = { x: cx + (i - j) * 10, y: cy + (i + j) * 5 + 4 }; ctx.fillStyle = '#4f7a35'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 5, 3, 0, 0, 7); ctx.fill(); }
    const b = box(ctx, cx - 6, cy - 2, 0.9, 0.9, 14 + tr * 3, m.wall);
    // greenhouse dome
    ctx.fillStyle = tr >= 2 ? 'rgba(120,230,170,0.55)' : 'rgba(160,210,140,0.5)';
    ctx.beginPath(); ctx.ellipse(cx + 12, cy + 2, 16 + tr * 2, 9 + tr, 0, Math.PI, 0); ctx.lineTo(cx + 28 + tr * 2, cy + 2); ctx.ellipse(cx + 12, cy + 2, 16 + tr * 2, 6, 0, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(cx + 12, cy + 2, 16 + tr * 2, 14 + tr * 3, 0, Math.PI, 0); ctx.stroke();
    if (night) light(ctx, cx + 12, cy - 4, 26, '#7dff9a', 0.25);
    void b; void t;
  },
  lumber(ctx, cx, cy, lvl, t) {
    const tr = tierOf(lvl), m = MAT[tr];
    pad(ctx, cx, cy, 1.8, '#3e3428');
    const b = box(ctx, cx - 6, cy - 3, 1, 0.8, 16 + tr * 4, m.wall);
    roofGable(ctx, b, 1, 0.8, 16, 10, m.roof);
    for (let i = 0; i < 3 + tr; i++) { ctx.fillStyle = i % 2 ? '#8b5a2b' : '#a0693a'; ctx.beginPath(); ctx.ellipse(cx + 16 + (i % 3) * 3, cy + 6 - Math.floor(i / 3) * 6 - (i % 3) * 2, 9, 3.5, -0.45, 0, 7); ctx.fill(); ctx.fillStyle = '#d9a86b'; ctx.beginPath(); ctx.arc(cx + 24 + (i % 3) * 3, cy + 3 - Math.floor(i / 3) * 6 - (i % 3) * 2, 3, 0, 7); ctx.fill(); }
    ctx.save(); ctx.translate(cx + 2, cy - 16 - tr * 4); ctx.rotate(t * 5); ctx.fillStyle = '#bbb'; for (let k = 0; k < 8; k++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-1, 0, 2, 7); } ctx.restore();
  },
  foundry(ctx, cx, cy, lvl, t, night) {
    const tr = tierOf(lvl), m = MAT[tr];
    pad(ctx, cx, cy, 1.8, '#3a3532');
    const b = box(ctx, cx, cy, 1.3, 1.1, 18 + tr * 4, m.wall);
    cyl(ctx, cx + 14, cy - 18 - tr * 4, 5, 22 + tr * 5, '#5a4a40');
    smoke(ctx, cx + 14, cy - 42 - tr * 9, t, 5, '90,80,75');
    const p = b.face(0, 1.1, 6); ctx.fillStyle = '#ff7a1a'; ctx.fillRect(p.x - 7, p.y - 8, 12, 9);
    light(ctx, p.x, p.y - 4, 22, '#ff7a1a', night ? 0.6 : 0.35);
  },
  refinery(ctx, cx, cy, lvl, t) {
    const tr = tierOf(lvl);
    pad(ctx, cx, cy, 1.8, '#35322f');
    cyl(ctx, cx - 12, cy + 2, 11, 20 + tr * 4, tr >= 3 ? '#8a8f94' : '#a08a6a');
    cyl(ctx, cx + 12, cy - 4, 9, 26 + tr * 5, tr >= 3 ? '#9aa0a5' : '#b09a7a');
    ctx.strokeStyle = '#444'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + 2, cy - 40); ctx.lineTo(cx + 2, cy - 64 - tr * 4); ctx.stroke();
    const f = 6 + Math.sin(t * 12) * 2; ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.ellipse(cx + 2, cy - 68 - tr * 4, 3, f, 0, 0, 7); ctx.fill();
    light(ctx, cx + 2, cy - 68 - tr * 4, 20, '#ff8a2e', 0.6);
  },
  warehouse(ctx, cx, cy, lvl, t, night) {
    const tr = tierOf(lvl), m = MAT[tr];
    const b = box(ctx, cx, cy, 2, 1.4, 20 + tr * 4, m.wall);
    roofGable(ctx, b, 2, 1.4, 20, 8 + tr * 2, m.roof);
    const p = b.face(0, 1.4, 0); ctx.fillStyle = '#2b2b2b'; ctx.fillRect(p.x - 10, p.y - 15, 16, 15);
    ctx.strokeStyle = '#555'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(p.x - 10, p.y - 13 + i * 4); ctx.lineTo(p.x + 6, p.y - 13 + i * 4); ctx.stroke(); }
    for (let i = 0; i < 2 + tr; i++) box(ctx, cx + 30 - i * 6, cy + 10 + i * 3, 0.3, 0.3, 8, '#9a7a4a');
    if (night) light(ctx, p.x, p.y - 18, 18, m.glow, 0.4);
    void t;
  },
  barracks(ctx, cx, cy, lvl, t, night) {
    const tr = tierOf(lvl), m = MAT[tr];
    pad(ctx, cx, cy, 2, '#3b3a30');
    const b = box(ctx, cx, cy, 1.8, 1.2, 16 + tr * 5, tr ? m.wall : '#5d6b45');
    roofGable(ctx, b, 1.8, 1.2, 16, 12, tr ? m.roof : '#4d5a38');
    windows(ctx, b, 1.8, 1.2, 16 + tr * 5, 1, m.glow, night);
    flag(ctx, cx - 26, cy + 4, 34, '#4a6b3a', t);
    if (tr >= 2) box(ctx, cx + 30, cy + 8, 0.35, 0.35, 26, '#555');
  },
  range(ctx, cx, cy, lvl, t, night) {
    const tr = tierOf(lvl), m = MAT[tr];
    pad(ctx, cx, cy, 2, '#3a3a33');
    const b = box(ctx, cx - 10, cy - 4, 1.2, 1.2, 15 + tr * 4, m.wall, { top: '#5a5a50' });
    windows(ctx, b, 1.2, 1.2, 15 + tr * 4, 1, m.glow, night);
    for (let i = 0; i < 3; i++) { const x = cx + 14 + i * 9, y = cy + 2 - i * 5; ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(x, y - 12, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#c33'; ctx.beginPath(); ctx.arc(x, y - 12, 3.5, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y - 12, 1.3, 0, 7); ctx.fill(); ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x - 1, y - 6, 2, 7); }
    void t;
  },
  garage(ctx, cx, cy, lvl, t, night) {
    const tr = tierOf(lvl), m = MAT[tr];
    pad(ctx, cx, cy, 2, '#34312d');
    const b = box(ctx, cx - 4, cy - 2, 1.6, 1.3, 20 + tr * 4, m.wall);
    const p = b.face(0, 1.3, 0); ctx.fillStyle = '#222'; ctx.fillRect(p.x - 13, p.y - 17, 22, 17);
    ctx.fillStyle = tr >= 3 ? m.trim : '#c9a030'; for (let i = 0; i < 5; i++) ctx.fillRect(p.x - 13 + i * 5, p.y - 19, 3, 2);
    drawBuggy(ctx, cx + 26, cy + 10, tr, t);
    if (night) light(ctx, p.x, p.y - 8, 22, m.glow, 0.35);
  },
  hospital(ctx, cx, cy, lvl, t, night) {
    const tr = tierOf(lvl);
    pad(ctx, cx, cy, 2, '#3c3b37');
    const h = 18 + tr * 6;
    const b = box(ctx, cx, cy, 1.7, 1.3, h, tr >= 3 ? '#c9ced1' : '#bdb6a6');
    windows(ctx, b, 1.7, 1.3, h, 1 + (tr > 1), '#bff', night);
    const tp = b.top(0, 0); ctx.fillStyle = '#d92b2b'; ctx.fillRect(tp.x - 9, tp.y - 3, 18, 6); ctx.fillRect(tp.x - 3, tp.y - 9, 6, 18);
    if (tr >= 2) { ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(tp.x + 18, tp.y + 2, 10, 5, 0, 0, 7); ctx.stroke(); ctx.fillStyle = '#ddd'; ctx.font = 'bold 8px sans-serif'; ctx.fillText('H', tp.x + 15, tp.y + 5); }
    void t;
  },
  research(ctx, cx, cy, lvl, t, night) {
    const tr = tierOf(lvl), m = MAT[tr];
    pad(ctx, cx, cy, 2, '#35383a');
    const h = 18 + tr * 5;
    const b = box(ctx, cx, cy, 1.6, 1.4, h, m.wall);
    windows(ctx, b, 1.6, 1.4, h, 1 + (tr > 2), '#9ef', night);
    const tp = b.top(0, 0);
    ctx.fillStyle = tr >= 4 ? 'rgba(80,220,255,0.6)' : '#b8c0c8'; ctx.beginPath(); ctx.ellipse(tp.x, tp.y, 16, 8, 0, Math.PI, 0); ctx.ellipse(tp.x, tp.y, 16, 15, 0, 0, Math.PI, true); ctx.fill();
    ctx.save(); ctx.translate(tp.x + 22, tp.y + 4); ctx.rotate(Math.sin(t) * 0.3 - 0.5); ctx.fillStyle = '#ccc'; ctx.beginPath(); ctx.ellipse(0, -10, 8, 4, 0, 0, 7); ctx.fill(); ctx.fillRect(-1, -10, 2, 10); ctx.restore();
    if (night || tr >= 4) light(ctx, tp.x, tp.y - 5, 24, '#6fe3ff', 0.4);
  },
  drill(ctx, cx, cy, lvl, t) {
    const tr = tierOf(lvl);
    pad(ctx, cx, cy, 2, '#4a4030');
    ctx.strokeStyle = tr >= 2 ? '#9aa' : '#7a5a3a'; ctx.lineWidth = 1.5;
    const p = (u, v) => ({ x: cx + (u - v) * TW / 4, y: cy + (u + v) * TH / 4 });
    const cs = [p(-1.8, -1.8), p(1.8, -1.8), p(1.8, 1.8), p(-1.8, 1.8)];
    ctx.beginPath(); for (let i = 0; i <= 4; i++) { const c = cs[i % 4]; i ? ctx.lineTo(c.x, c.y - 8) : ctx.moveTo(c.x, c.y - 8); } ctx.stroke();
    for (const c of cs) { ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x, c.y - 10); ctx.stroke(); }
    for (let i = 0; i < 3 + tr; i++) { const x = cx - 20 + (i % 3) * 18, y = cy - 4 + Math.floor(i / 3) * 10 + (i % 3) * 3; drawSoldier(ctx, x, y, '#5d6b45', Math.sin(t * 6 + i) * 2); }
  },
  tavern(ctx, cx, cy, lvl, t, night) {
    const tr = tierOf(lvl), m = MAT[tr];
    pad(ctx, cx, cy, 2, '#3e362c');
    const h = 22 + tr * 5;
    const b = box(ctx, cx, cy, 1.6, 1.3, h, tr < 2 ? '#7a5a3c' : m.wall);
    roofGable(ctx, b, 1.6, 1.3, h, 14, tr < 2 ? '#5a3424' : m.roof);
    windows(ctx, b, 1.6, 1.3, h, 2, '#ffc46b', true);
    const p = b.face(-1.2, 1.3, h - 6); ctx.fillStyle = '#3a2516'; ctx.fillRect(p.x - 12, p.y - 6, 24, 10); ctx.fillStyle = '#ffcf6b'; ctx.font = 'bold 7px sans-serif'; ctx.fillText('HALL', p.x - 9, p.y + 1);
    light(ctx, cx, cy - 10, 40, '#ffb35c', night ? 0.4 : 0.15);
    void t;
  },
  alliance(ctx, cx, cy, lvl, t, night) {
    const tr = tierOf(lvl), m = MAT[tr];
    pad(ctx, cx, cy, 2, '#3a3a3a');
    box(ctx, cx, cy, 1.2, 1.2, 14, m.wall);
    const h = 50 + tr * 12;
    ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - 10, cy - 14); ctx.lineTo(cx, cy - 14 - h); ctx.lineTo(cx + 10, cy - 14); ctx.stroke();
    for (let i = 1; i < 6; i++) { const y = cy - 14 - h * i / 6, w = 10 * (1 - i / 6); ctx.beginPath(); ctx.moveTo(cx - w, y); ctx.lineTo(cx + w, y); ctx.stroke(); }
    const on = Math.sin(t * 3) > 0; ctx.fillStyle = on ? '#58c4a0' : '#235'; ctx.beginPath(); ctx.arc(cx, cy - 16 - h, 3, 0, 7); ctx.fill();
    if (on) light(ctx, cx, cy - 16 - h, 26, '#58c4a0', 0.6);
    flag(ctx, cx + 16, cy - 10, 28, '#58c4a0', t); void night;
  },
  tower(ctx, cx, cy, lvl, t, night) {
    const tr = tierOf(lvl), m = MAT[tr];
    const h = 40 + tr * 10;
    box(ctx, cx, cy, 0.7, 0.7, h, m.wall);
    const b = box(ctx, cx, cy - h, 1, 1, 10, m.roof);
    void b;
    ctx.save(); ctx.translate(cx, cy - h - 12); ctx.rotate(Math.sin(t * 0.8) * 0.6); ctx.fillStyle = '#333'; ctx.fillRect(0, -3, 20 + tr * 2, 4); if (tr >= 2) ctx.fillRect(0, 2, 18 + tr * 2, 3); ctx.restore();
    if (night) { ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.moveTo(cx, cy - h - 12); const a = Math.sin(t * 0.5) * 0.8 + 0.6; ctx.lineTo(cx + Math.cos(a) * 160 - 30, cy - h + Math.sin(a) * 160); ctx.lineTo(cx + Math.cos(a) * 160 + 30, cy - h + Math.sin(a) * 160 + 30); ctx.fill(); ctx.restore(); }
  },
  forge(ctx, cx, cy, lvl, t, night) {
    const tr = tierOf(lvl), m = MAT[tr];
    const b = box(ctx, cx, cy, 1.2, 1, 18 + tr * 4, m.wall);
    cyl(ctx, cx - 10, cy - 16 - tr * 4, 4, 18, '#444');
    for (let i = 0; i < 6; i++) { const k = (t * 1.3 + i / 6) % 1; ctx.fillStyle = `rgba(255,${150 + i * 15},40,${1 - k})`; ctx.fillRect(cx - 10 + Math.sin(i * 9 + t) * 8 * k, cy - 36 - tr * 4 - k * 30, 2, 2); }
    const p = b.face(0, 1, 4); ctx.fillStyle = '#ff8a2e'; ctx.fillRect(p.x - 5, p.y - 8, 9, 8); light(ctx, p.x, p.y - 4, 18, '#ff7a1a', night ? 0.6 : 0.3);
  },
  radar(ctx, cx, cy, lvl, t, night) {
    const tr = tierOf(lvl), m = MAT[tr];
    box(ctx, cx, cy, 0.8, 0.8, 26 + tr * 6, m.wall);
    const y = cy - 26 - tr * 6;
    ctx.save(); ctx.translate(cx, y - 6); ctx.scale(Math.cos(t * 1.5), 1); ctx.fillStyle = '#c8d0d6'; ctx.beginPath(); ctx.ellipse(0, -6, 14, 8, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#8a959c'; ctx.beginPath(); ctx.ellipse(0, -6, 9, 5, 0, 0, 7); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#555'; ctx.fillRect(cx - 1, y - 8, 2, 8);
    if (night) light(ctx, cx, y - 10, 20, '#9ef', 0.4);
  },
};
export function drawBuggy(ctx, x, y, tr = 0, t = 0) {
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x - 9, y, 4, 0, 7); ctx.arc(x + 9, y + 0, 4, 0, 7); ctx.fill();
  ctx.fillStyle = tr >= 3 ? '#4a5a3a' : '#a0552a'; ctx.beginPath(); ctx.moveTo(x - 14, y - 3); ctx.lineTo(x - 10, y - 11); ctx.lineTo(x + 8, y - 11); ctx.lineTo(x + 15, y - 3); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 6, y - 11); ctx.lineTo(x - 3, y - 17); ctx.lineTo(x + 5, y - 17); ctx.lineTo(x + 6, y - 11); ctx.stroke();
  void t;
}
export function drawSoldier(ctx, x, y, col = '#5d6b45', bob = 0) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 4, 2, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#2a2a2a'; ctx.fillRect(x - 2.5, y - 5, 2, 5); ctx.fillRect(x + 0.5, y - 5, 2, 5);
  ctx.fillStyle = col; ctx.fillRect(x - 3.5, y - 12 + bob * 0.3, 7, 8);
  ctx.fillStyle = '#d9a983'; ctx.beginPath(); ctx.arc(x, y - 15 + bob * 0.3, 2.8, 0, 7); ctx.fill();
  ctx.fillStyle = '#3a4a2a'; ctx.beginPath(); ctx.arc(x, y - 16 + bob * 0.3, 3, Math.PI, 0); ctx.fill();
}
export function drawZombie(ctx, x, y, col = '#7d9a5a', t = 0, big = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(big, big);
  const sway = Math.sin(t * 3 + x) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 1, 5, 2, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#3a3328'; ctx.fillRect(-3, -6, 2, 6); ctx.fillRect(1, -6, 2, 6);
  ctx.fillStyle = '#5a4a3a'; ctx.fillRect(-4, -14, 8, 9);
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, -12); ctx.lineTo(-9, -11 + sway); ctx.moveTo(3, -12); ctx.lineTo(9, -10 - sway); ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sway * 0.3, -17, 3.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#ff3b1f'; ctx.fillRect(-1.8 + sway * 0.3, -18, 1.2, 1.2); ctx.fillRect(0.8 + sway * 0.3, -18, 1.2, 1.2);
  ctx.restore();
}

export function drawBuilding(ctx, type, lvl, cx, cy, t, night) {
  const f = PAINT[type]; if (!f) return;
  ctx.save(); f(ctx, cx, cy, Math.max(1, lvl), t, night); ctx.restore();
}
export function drawConstruction(ctx, cx, cy, size, t) {
  // scaffolding + crane overlay
  ctx.save();
  ctx.strokeStyle = '#d9a030'; ctx.lineWidth = 1.5;
  const s = size * 12;
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + i * s, cy + 6); ctx.lineTo(cx + i * s, cy - 40); ctx.stroke(); }
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(cx - s, cy - k * 12); ctx.lineTo(cx + s, cy - k * 12); ctx.stroke(); }
  ctx.strokeStyle = '#e8b020'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + s + 6, cy + 6); ctx.lineTo(cx + s + 6, cy - 70); ctx.lineTo(cx - s - 20, cy - 70); ctx.stroke();
  const hookX = cx + Math.sin(t) * 14; ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hookX, cy - 70); ctx.lineTo(hookX, cy - 46); ctx.stroke();
  ctx.fillStyle = '#8a6a3a'; ctx.fillRect(hookX - 5, cy - 46, 10, 5);
  ctx.restore();
}
export function drawEmptyPlot(ctx, cx, cy, size, hl) {
  const p = (u, v) => ({ x: cx + (u - v) * TW / 4, y: cy + (u + v) * TH / 4 });
  const s = size * 0.9;
  ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = hl ? '#ffd27a' : 'rgba(255,220,150,0.35)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); const cs = [p(-s, -s), p(s, -s), p(s, s), p(-s, s)]; cs.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y))); ctx.closePath(); ctx.stroke();
  ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,220,150,0.08)'; ctx.fill();
  ctx.fillStyle = hl ? '#ffd27a' : 'rgba(255,220,150,0.5)'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('+', cx, cy + 6);
  ctx.restore();
}

// ---------- hero portraits ----------
const portraitCache = {};
export function heroPortrait(id, size = 128) {
  const key = id + size; if (portraitCache[key]) return portraitCache[key];
  const def = HERO_BY_ID[id]; const [skin, hair, style, outfit, acc, hue] = def.look;
  const c = document.createElement('canvas'); c.width = size; c.height = Math.round(size * 1.2);
  const x = c.getContext('2d'); const S = size / 128; x.scale(S, S);
  const W = 128, Hh = 154;
  const rc = RARITY[def.rarity].color;
  const bg = x.createLinearGradient(0, 0, 0, Hh); bg.addColorStop(0, `hsl(${hue},35%,32%)`); bg.addColorStop(1, `hsl(${hue},40%,10%)`);
  x.fillStyle = bg; x.fillRect(0, 0, W, Hh);
  // ash particles + glow
  for (let i = 0; i < 20; i++) { x.fillStyle = `rgba(255,255,255,${0.05 + (i % 5) * 0.03})`; x.fillRect((i * 37) % W, (i * 53) % Hh, 2, 2); }
  const gl = x.createRadialGradient(64, 60, 10, 64, 70, 90); gl.addColorStop(0, rc + '55'); gl.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gl; x.fillRect(0, 0, W, Hh);
  // hair back
  x.fillStyle = hair;
  if ([1, 4, 5].includes(style)) { x.beginPath(); x.ellipse(64, 70, 36, style === 5 ? 50 : 42, 0, 0, Math.PI * 2); x.fill(); }
  // shoulders / outfit
  x.fillStyle = outfit; x.beginPath(); x.moveTo(8, Hh); x.quadraticCurveTo(14, 104, 46, 98); x.lineTo(82, 98); x.quadraticCurveTo(114, 104, 120, Hh); x.fill();
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.moveTo(52, 98); x.lineTo(64, 122); x.lineTo(76, 98); x.fill();
  x.strokeStyle = 'rgba(255,255,255,0.12)'; x.lineWidth = 2; x.beginPath(); x.moveTo(30, 120); x.lineTo(40, Hh); x.moveTo(98, 120); x.lineTo(88, Hh); x.stroke();
  if (def.role === 'tank') { x.fillStyle = shade(outfit, -0.3); x.beginPath(); x.ellipse(28, 112, 18, 10, -0.3, 0, 7); x.ellipse(100, 112, 18, 10, 0.3, 0, 7); x.fill(); }
  // neck
  x.fillStyle = shade(skin, -0.15); x.fillRect(54, 82, 20, 20);
  // head
  x.fillStyle = skin; x.beginPath(); x.ellipse(64, 62, 25, 30, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = shade(skin, -0.12); x.beginPath(); x.ellipse(64, 80, 18, 10, 0, 0, Math.PI); x.fill();
  // ears
  x.fillStyle = shade(skin, -0.08); x.beginPath(); x.ellipse(39, 64, 4, 7, 0, 0, 7); x.ellipse(89, 64, 4, 7, 0, 0, 7); x.fill();
  // eyes
  const ey = 60;
  x.fillStyle = '#fff'; x.beginPath(); x.ellipse(54, ey, 5, 3, 0, 0, 7); x.ellipse(74, ey, 5, 3, 0, 0, 7); x.fill();
  x.fillStyle = `hsl(${(hue + 160) % 360},45%,35%)`; x.beginPath(); x.arc(54, ey, 2.4, 0, 7); x.arc(74, ey, 2.4, 0, 7); x.fill();
  x.fillStyle = '#111'; x.beginPath(); x.arc(54, ey, 1.1, 0, 7); x.arc(74, ey, 1.1, 0, 7); x.fill();
  x.strokeStyle = shade(hair, -0.2); x.lineWidth = 2.5; x.beginPath(); x.moveTo(47, ey - 7); x.lineTo(60, ey - 6 - (def.role === 'damage' ? -1 : 1)); x.moveTo(81, ey - 7); x.lineTo(68, ey - 6 - (def.role === 'damage' ? -1 : 1)); x.stroke();
  // nose & mouth
  x.strokeStyle = shade(skin, -0.3); x.lineWidth = 1.5; x.beginPath(); x.moveTo(64, 63); x.lineTo(61, 72); x.lineTo(65, 73); x.stroke();
  x.strokeStyle = shade(skin, -0.45); x.lineWidth = 2; x.beginPath();
  if (def.role === 'support') { x.moveTo(56, 80); x.quadraticCurveTo(64, 85, 72, 80); } else { x.moveTo(57, 81); x.lineTo(71, 80); }
  x.stroke();
  // grime
  x.fillStyle = 'rgba(60,40,20,0.18)'; x.beginPath(); x.ellipse(76, 74, 7, 4, 0.4, 0, 7); x.fill();
  // hair front
  x.fillStyle = hair;
  if (style === 0) { x.beginPath(); x.ellipse(64, 40, 25, 11, 0, Math.PI, 0); x.fill(); }
  else if (style === 1) { x.beginPath(); x.ellipse(64, 38, 27, 14, 0, Math.PI, 0); x.fill(); x.fillRect(38, 38, 7, 40); x.fillRect(83, 38, 7, 40); }
  else if (style === 2) { x.beginPath(); x.moveTo(38, 52); x.quadraticCurveTo(44, 26, 70, 30); x.quadraticCurveTo(92, 32, 90, 52); x.quadraticCurveTo(78, 38, 60, 42); x.quadraticCurveTo(46, 44, 38, 52); x.fill(); }
  else if (style === 3) { x.beginPath(); x.moveTo(50, 40); x.lineTo(56, 18); x.lineTo(64, 38); x.lineTo(70, 14); x.lineTo(76, 38); x.lineTo(84, 22); x.lineTo(86, 46); x.quadraticCurveTo(64, 30, 42, 46); x.fill(); }
  else if (style === 4) { x.beginPath(); x.moveTo(36, 66); x.quadraticCurveTo(34, 28, 66, 30); x.quadraticCurveTo(96, 30, 92, 66); x.quadraticCurveTo(86, 40, 70, 44); x.lineTo(46, 52); x.quadraticCurveTo(40, 56, 36, 66); x.fill(); }
  else if (style === 5) { x.beginPath(); x.moveTo(36, 70); x.quadraticCurveTo(30, 26, 64, 28); x.quadraticCurveTo(100, 26, 92, 70); x.quadraticCurveTo(90, 42, 64, 40); x.quadraticCurveTo(40, 42, 36, 70); x.fill(); }
  else if (style === 6) { x.fillStyle = shade(skin, -0.05); x.beginPath(); x.ellipse(64, 42, 24, 10, 0, Math.PI, 0); x.fill(); }
  // accessory
  drawAccessory(x, acc, skin, hair, outfit, hue);
  // frame
  x.strokeStyle = rc; x.lineWidth = 4; x.strokeRect(2, 2, W - 4, Hh - 4);
  const url = c.toDataURL();
  portraitCache[key] = url; return url;
}
function drawAccessory(x, acc, skin, hair, outfit, hue) {
  switch (acc) {
    case 'goggles': x.fillStyle = '#3a3a3a'; x.fillRect(38, 38, 52, 6); x.fillStyle = '#6fb8d6'; x.beginPath(); x.arc(52, 41, 8, 0, 7); x.arc(76, 41, 8, 0, 7); x.fill(); x.strokeStyle = '#c9a35b'; x.lineWidth = 2; x.beginPath(); x.arc(52, 41, 8, 0, 7); x.stroke(); x.beginPath(); x.arc(76, 41, 8, 0, 7); x.stroke(); break;
    case 'helmet': x.fillStyle = '#c4a02d'; x.beginPath(); x.ellipse(64, 42, 30, 20, 0, Math.PI, 0); x.fill(); x.fillRect(32, 40, 64, 6); x.fillStyle = '#e8d070'; x.fillRect(60, 22, 8, 18); break;
    case 'hood': x.fillStyle = shade(outfit, 0.1); x.beginPath(); x.moveTo(30, 100); x.quadraticCurveTo(26, 20, 64, 22); x.quadraticCurveTo(102, 20, 98, 100); x.lineTo(88, 100); x.quadraticCurveTo(94, 40, 64, 36); x.quadraticCurveTo(34, 40, 40, 100); x.fill(); break;
    case 'glasses': x.strokeStyle = '#222'; x.lineWidth = 2; x.strokeRect(46, 55, 15, 10); x.strokeRect(67, 55, 15, 10); x.beginPath(); x.moveTo(61, 59); x.lineTo(67, 59); x.stroke(); break;
    case 'feather': x.fillStyle = '#111'; x.beginPath(); x.moveTo(86, 40); x.quadraticCurveTo(104, 10, 96, 2); x.quadraticCurveTo(90, 20, 84, 38); x.fill(); x.fillStyle = '#c33'; x.fillRect(46, 72, 3, 8); break;
    case 'beard': x.fillStyle = hair; x.beginPath(); x.moveTo(42, 70); x.quadraticCurveTo(44, 100, 64, 100); x.quadraticCurveTo(84, 100, 86, 70); x.quadraticCurveTo(80, 84, 64, 84); x.quadraticCurveTo(48, 84, 42, 70); x.fill(); break;
    case 'beret': x.fillStyle = '#2f3a24'; x.beginPath(); x.ellipse(60, 36, 30, 10, -0.15, 0, 7); x.fill(); x.fillStyle = '#c9a35b'; x.beginPath(); x.arc(44, 38, 3, 0, 7); x.fill(); break;
    case 'hat': x.fillStyle = '#5a3b22'; x.beginPath(); x.ellipse(64, 38, 44, 9, 0, 0, 7); x.fill(); x.fillRect(42, 14, 44, 24); x.fillStyle = '#2a1b10'; x.fillRect(42, 30, 44, 5); break;
    case 'headset': x.strokeStyle = '#222'; x.lineWidth = 4; x.beginPath(); x.arc(64, 56, 28, Math.PI * 1.05, Math.PI * 1.95); x.stroke(); x.fillStyle = '#333'; x.fillRect(32, 58, 9, 14); x.fillRect(87, 58, 9, 14); x.strokeStyle = '#333'; x.lineWidth = 2; x.beginPath(); x.moveTo(36, 72); x.quadraticCurveTo(40, 86, 54, 84); x.stroke(); break;
    case 'scar': x.strokeStyle = '#a0504a'; x.lineWidth = 2; x.beginPath(); x.moveTo(70, 48); x.lineTo(82, 76); x.stroke(); break;
    case 'bandana': x.fillStyle = `hsl(${hue},55%,40%)`; x.beginPath(); x.moveTo(40, 72); x.lineTo(88, 72); x.lineTo(84, 92); x.lineTo(64, 100); x.lineTo(44, 92); x.closePath(); x.fill(); break;
    case 'flower': x.fillStyle = '#f2a0c0'; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(86 + Math.cos(i * 1.256) * 4, 40 + Math.sin(i * 1.256) * 4, 3.5, 0, 7); x.fill(); } x.fillStyle = '#ffd23a'; x.beginPath(); x.arc(86, 40, 2.5, 0, 7); x.fill(); break;
    case 'mask': x.fillStyle = '#2a2a2a'; x.beginPath(); x.ellipse(64, 78, 22, 14, 0, 0, 7); x.fill(); x.fillStyle = '#555'; x.beginPath(); x.arc(52, 82, 5, 0, 7); x.arc(76, 82, 5, 0, 7); x.fill(); break;
    case 'cross': x.fillStyle = '#fff'; x.fillRect(84, 116, 16, 16); x.fillStyle = '#d92b2b'; x.fillRect(90, 118, 4, 12); x.fillRect(86, 122, 12, 4); break;
    case 'cap': x.fillStyle = `hsl(${hue},40%,35%)`; x.beginPath(); x.ellipse(64, 40, 27, 13, 0, Math.PI, 0); x.fill(); x.beginPath(); x.ellipse(50, 42, 22, 5, -0.1, 0, 7); x.fill(); break;
    case 'eyepatch': x.fillStyle = '#111'; x.beginPath(); x.ellipse(74, 60, 7, 6, 0, 0, 7); x.fill(); x.strokeStyle = '#111'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(40, 52); x.lineTo(88, 62); x.stroke(); break;
    case 'scarf': x.fillStyle = `hsl(${hue},45%,45%)`; x.beginPath(); x.ellipse(64, 96, 30, 10, 0, 0, 7); x.fill(); x.fillRect(70, 96, 10, 30); break;
    default: break;
  }
}
