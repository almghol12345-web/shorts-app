// The Game facade: owns the save state and mixes in every subsystem.
// Pure logic only (no DOM) so it runs in the browser, in Node tests, and on the server.
import { createState, migrate, dayKey, weekIndex } from './state.js';
import { RESOURCES, VIP_LEVELS, commanderXpFor, VIGOR_MAX, VIGOR_REGEN_SEC } from '../data/config.js';
import { ITEMS } from '../data/items.js';
import { RESEARCH_BY_ID } from '../data/research.js';
import { economy } from './economy.js';
import { heroes } from './heroes.js';
import { army } from './army.js';
import { worldSys } from './world.js';
import { missions } from './missions.js';
import { social } from './social.js';

export class Game {
  constructor(state, opts = {}) {
    this.clock = opts.now || (() => Date.now());
    this.s = state ? migrate(state) : createState(opts.name, this.clock(), opts.seed);
    this.listeners = {};
    this.toasts = [];
  }
  now() { return this.clock(); }
  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, data) { (this.listeners[ev] || []).forEach((f) => f(data)); (this.listeners['*'] || []).forEach((f) => f(ev, data)); }
  toast(msg, kind = 'info') { this.emit('toast', { msg, kind }); }

  // ---------- resources ----------
  canAfford(cost) {
    for (const [k, v] of Object.entries(cost || {})) {
      if (k === 'gems') { if (this.s.gems < v) return false; }
      else if (RESOURCES.includes(k)) { if ((this.s.res[k] || 0) < v) return false; }
      else if ((this.s.items[k] || 0) < v) return false;
    }
    return true;
  }
  missing(cost) {
    const out = {};
    for (const [k, v] of Object.entries(cost || {})) if (RESOURCES.includes(k) && this.s.res[k] < v) out[k] = v - this.s.res[k];
    return out;
  }
  spend(cost) {
    if (!this.canAfford(cost)) return false;
    for (const [k, v] of Object.entries(cost || {})) {
      if (k === 'gems') { this.s.gems -= v; this.track('gems', v); }
      else if (RESOURCES.includes(k)) this.s.res[k] -= v;
      else this.s.items[k] -= v;
    }
    this.emit('change');
    return true;
  }
  // Grant a reward bundle: resources, gems, items, xp, heroXp, vip
  give(bundle, mult = 1) {
    for (const [k, v0] of Object.entries(bundle || {})) {
      const v = Math.round(v0 * mult);
      if (!v) continue;
      if (k === 'gems') this.s.gems += v;
      else if (RESOURCES.includes(k)) this.s.res[k] += v;
      else if (k === 'xp') this.addXp(v);
      else if (k === 'vip') this.s.player.vipPts += v;
      else if (k === 'heroXp') { /* handled by callers */ }
      else if (ITEMS[k]) this.s.items[k] = (this.s.items[k] || 0) + v;
    }
    this.emit('change');
  }
  addXp(v) {
    const p = this.s.player; p.xp += v;
    while (p.xp >= commanderXpFor(p.level) && p.level < 60) {
      p.xp -= commanderXpFor(p.level); p.level++;
      this.s.gems += 20 + p.level * 5; this.s.items.speed5m = (this.s.items.speed5m || 0) + 2;
      this.emit('levelup', p.level);
      this.toast(`Commander level ${p.level}! +${20 + p.level * 5} 💎`, 'good');
    }
  }
  vipLevel() { let l = 0; VIP_LEVELS.forEach((v, i) => { if (this.s.player.vipPts >= v.pts) l = i; }); return l; }
  vip() { return VIP_LEVELS[this.vipLevel()]; }

  // ---------- bonuses ----------
  bonus(key) {
    let b = 0;
    for (const [id, lvl] of Object.entries(this.s.research)) { const n = RESEARCH_BY_ID[id]; if (n && n.effect === key) b += n.per * lvl; }
    const v = this.vip();
    if (key === 'build_speed') b += v.build;
    if (key === 'research_speed') b += v.research + this.lvl('research') * 0.02;
    if (key === 'march_speed') b += v.march + this.lvl('radar') * 0.02;
    if (this.s.alliance?.tech) { const t = this.s.alliance.tech[key]; if (t) b += t * 0.02; }
    return b;
  }
  lvl(type) {
    let best = 0;
    for (const b of Object.values(this.s.buildings)) if (b.type === type && b.lvl > best) best = b.lvl;
    return best;
  }
  countOf(type) { return Object.values(this.s.buildings).filter((b) => b.type === type).length; }

  // ---------- vigor ----------
  vigor() {
    const v = this.s.vigor, max = VIGOR_MAX + this.vip().vigor;
    if (v.v < max) {
      const per = VIGOR_REGEN_SEC * 1000 / (1 + this.bonus('vigor_regen'));
      const gained = Math.floor((this.now() - v.at) / per);
      if (gained > 0) { v.v = Math.min(max, v.v + gained); v.at += gained * per; }
      if (v.v >= max) v.at = this.now();
    } else v.at = this.now();
    return v.v;
  }
  useVigor(n) { if (this.vigor() < n) return false; this.s.vigor.v -= n; return true; }

  // ---------- items ----------
  useItem(id, target) {
    const it = ITEMS[id];
    if (!it || !(this.s.items[id] > 0)) return { ok: false, msg: 'You have none.' };
    if (it.kind === 'res') { this.s.items[id]--; this.s.res[it.res] += it.amount; this.toast(`+${it.amount.toLocaleString()} ${it.res}`, 'good'); }
    else if (it.kind === 'vigor') { this.s.items[id]--; this.vigor(); this.s.vigor.v += it.amount; }
    else if (it.kind === 'shield') { this.s.items[id]--; this.s.shieldUntil = Math.max(this.now(), this.s.shieldUntil) + it.sec * 1000; this.toast('Peace Shield active', 'good'); }
    else if (it.kind === 'xp') { if (!target || !this.s.heroes[target]) return { ok: false, msg: 'Choose a hero.' }; this.s.items[id]--; this.heroAddXp(target, it.xp); }
    else if (it.kind === 'relocate') { this.s.items[id]--; this.relocate(); }
    else return { ok: false, msg: 'This item is used from its own screen.' };
    this.emit('change');
    return { ok: true };
  }

  // ---------- power ----------
  power() {
    let p = 0;
    for (const b of Object.values(this.s.buildings)) p += Math.round(b.lvl * b.lvl * (b.type === 'hq' ? 60 : 14));
    for (const [id, lvl] of Object.entries(this.s.research)) p += lvl * 40 * (1 + (RESEARCH_BY_ID[id]?.lab || 1) * 0.2);
    p += this.troopPower();
    for (const id of Object.keys(this.s.heroes)) p += this.heroPower(id);
    return Math.round(p);
  }

  // ---------- main tick ----------
  tick() {
    const now = this.now();
    this.resetChecks(now);
    this.processQueues(now);
    this.processMarches(now);
    this.processThreats(now);
    this.allianceTick(now);
    this.vigor();
    this.s.lastTick = now;
  }
  resetChecks(now) {
    const m = this.s.missions, dk = dayKey(now);
    if (m.day !== dk) { m.day = dk; m.daily = {}; m.dClaimed = []; m.chests = []; this.s.arena.day = dk; this.s.arena.attempts = 0; this.s.shop = { day: dk, bought: {} }; this.emit('newday'); }
    const wk = weekIndex(now);
    if (m.week !== wk) { m.week = wk; m.weekly = {}; m.wClaimed = []; }
  }
  serialize() { return JSON.stringify(this.s); }
}

Object.assign(Game.prototype, economy, heroes, army, worldSys, missions, social);
