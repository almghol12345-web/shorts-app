// Client for the optional game server (server/server.js). When no server is reachable the game
// runs fully offline and every multiplayer surface says so instead of faking it.
import { A } from './ui/app.js';

export class Net {
  constructor() {
    this.base = localStorage.getItem('ashfall.server') ?? '';
    this.token = localStorage.getItem('ashfall.token') || null;
    this.user = null; this.online = false; this.alliance = null; this.chat = []; this.es = null; this.lastSync = 0;
  }
  async req(method, path, body) {
    const r = await fetch(this.base + path, { method, headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: 'Bearer ' + this.token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({ ok: false, msg: 'Bad response' }));
    if (r.status === 401) { this.logout(true); }
    return j;
  }
  async probe() {
    try { const r = await fetch(this.base + '/api/health', { cache: 'no-store' }); this.online = r.ok && (await r.json()).ok; } catch { this.online = false; }
    if (this.online && this.token) { const me = await this.req('GET', '/api/me'); if (me.ok) this.user = me.user; }
    return this.online;
  }
  async register(name, password) { const r = await this.req('POST', '/api/register', { name, password }); if (r.ok) this.setAuth(r); return r; }
  async login(name, password) { const r = await this.req('POST', '/api/login', { name, password }); if (r.ok) this.setAuth(r); return r; }
  setAuth(r) { this.token = r.token; this.user = r.user; localStorage.setItem('ashfall.token', r.token); }
  logout(silent) { this.token = null; this.user = null; localStorage.removeItem('ashfall.token'); this.es?.close(); this.es = null; if (!silent) A.toast?.('Logged out'); }
  async pushSave() {
    if (!this.user) return { ok: false };
    const g = A.g; g.s.player.id = this.user.id;
    const r = await this.req('PUT', '/api/save', { save: g.s, power: g.power(), hq: g.lvl('hq') });
    if (r.ok) this.lastSync = Date.now();
    return r;
  }
  async pullSave() { return this.req('GET', '/api/save'); }
  leaderboard(type) { return this.req('GET', '/api/leaderboard?type=' + type); }
  worldPlayers() { return this.req('GET', '/api/world/players'); }
  pvpAttack(uid) { return this.req('POST', '/api/pvp/attack', { target: uid }); }
  arenaOpponents() { return this.req('GET', '/api/arena/opponents'); }
  arenaFight(uid) { return this.req('POST', '/api/arena/fight', { target: uid }); }
  inbox() { return this.req('GET', '/api/inbox'); }
  ackInbox(ids) { return this.req('POST', '/api/inbox/ack', { ids }); }
  // alliances
  alliances() { return this.req('GET', '/api/alliances'); }
  createAlliance(name, tag) { return this.req('POST', '/api/alliances', { name, tag }); }
  joinAlliance(id) { return this.req('POST', `/api/alliances/${id}/join`); }
  leaveAlliance() { return this.req('POST', '/api/alliance/leave'); }
  async myAlliance() { const r = await this.req('GET', '/api/alliance'); if (r.ok) { this.alliance = r.alliance; this.chat = r.alliance?.chat || this.chat; } return r; }
  sendChat(text) { return this.req('POST', '/api/alliance/chat', { text }); }
  requestHelp(kind, key, label) { return this.req('POST', '/api/alliance/help', { kind, key, label }); }
  helpAll() { return this.req('POST', '/api/alliance/helpall'); }
  donate(key) { return this.req('POST', '/api/alliance/donate', { key }); }
  boss() { return this.req('POST', '/api/alliance/boss'); }
  stream(onMsg) {
    if (!this.user || this.es) return;
    try {
      this.es = new EventSource(this.base + '/api/alliance/stream?token=' + encodeURIComponent(this.token));
      this.es.onmessage = (e) => { try { const m = JSON.parse(e.data); this.chat.push(m); if (this.chat.length > 100) this.chat.shift(); onMsg?.(m); } catch { /* ignore */ } };
      this.es.onerror = () => { this.es?.close(); this.es = null; };
    } catch { this.es = null; }
  }
}
