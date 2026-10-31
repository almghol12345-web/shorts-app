// Unified pointer handling: drag to pan, pinch / wheel to zoom, tap to select.
export class PanZoom {
  constructor(el, { onTap, onChange, minZoom = 0.5, maxZoom = 2.2, zoom = 1 } = {}) {
    this.el = el; this.onTap = onTap; this.onChange = onChange;
    this.x = 0; this.y = 0; this.zoom = zoom; this.minZoom = minZoom; this.maxZoom = maxZoom;
    this.pointers = new Map(); this.moved = 0; this.vx = 0; this.vy = 0; this.enabled = true;
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.up(e, true));
    el.addEventListener('wheel', (e) => { if (!this.enabled) return; e.preventDefault(); this.zoomAt(e.offsetX, e.offsetY, e.deltaY < 0 ? 1.1 : 0.9); }, { passive: false });
  }
  down(e) {
    if (!this.enabled) return;
    this.el.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (this.pointers.size === 1) { this.moved = 0; this.start = { x: e.offsetX, y: e.offsetY, t: performance.now() }; }
    if (this.pointers.size === 2) this.pinch = this.dist();
    this.vx = this.vy = 0;
  }
  dist() { const [a, b] = [...this.pointers.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; }
  move(e) {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.pointers.get(e.pointerId), dx = e.offsetX - p.x, dy = e.offsetY - p.y;
    p.x = e.offsetX; p.y = e.offsetY;
    if (this.pointers.size === 2) { const n = this.dist(); this.zoomAt(n.cx, n.cy, n.d / this.pinch.d); this.pinch = n; this.moved += 10; return; }
    this.x += dx; this.y += dy; this.vx = dx; this.vy = dy; this.moved += Math.abs(dx) + Math.abs(dy);
    this.onChange?.();
  }
  up(e, cancel) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    if (!cancel && this.pointers.size === 0 && this.moved < 10 && this.start && performance.now() - this.start.t < 600) this.onTap?.(e.offsetX, e.offsetY);
  }
  zoomAt(sx, sy, f) {
    const nz = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * f)); f = nz / this.zoom;
    this.x = sx - (sx - this.x) * f; this.y = sy - (sy - this.y) * f; this.zoom = nz; this.onChange?.();
  }
  inertia() { if (this.pointers.size) return; if (Math.abs(this.vx) + Math.abs(this.vy) > 0.3) { this.x += this.vx; this.y += this.vy; this.vx *= 0.9; this.vy *= 0.9; this.onChange?.(); } }
  toWorld(sx, sy) { return { x: (sx - this.x) / this.zoom, y: (sy - this.y) / this.zoom }; }
}
