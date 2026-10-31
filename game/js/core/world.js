import { L, t as T, tr } from '../i18n.js';
// Deterministic world map. Every client generates the same map from WORLD_SEED, so a server
// only has to store diffs (cleared objects, depleted nodes, player positions).
import { WORLD_SIZE, MARCH_SPEED } from '../data/config.js';
import { hash2, mulberry32 } from './rng.js';
import { zombieSquads, enemyPower } from '../data/enemies.js';
import { simulateBattle, sidePower } from './combat.js';
import { troopStats, parseTroopKey } from '../data/troops.js';

export const WORLD_SEED = 1337;
const CHUNK = 8;
const HOUR = 3600000;

function smooth(x, y, scale, seed) {
  const gx = Math.floor(x / scale), gy = Math.floor(y / scale), fx = x / scale - gx, fy = y / scale - gy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(gx, gy, seed), b = hash2(gx + 1, gy, seed), c = hash2(gx, gy + 1, seed), d = hash2(gx + 1, gy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
// 0 waste, 1 ruins, 2 dead forest, 3 water, 4 road, 5 toxic
export function terrainAt(x, y) {
  if (x < 0 || y < 0 || x >= WORLD_SIZE || y >= WORLD_SIZE) return 3;
  const n = smooth(x, y, 18, WORLD_SEED) * 0.65 + smooth(x, y, 6, WORLD_SEED + 1) * 0.35;
  const cx = x - WORLD_SIZE / 2, cy = y - WORLD_SIZE / 2, dc = Math.hypot(cx, cy);
  if (dc < 9) return 5;
  if (n < 0.22) return 3;
  const roadN = smooth(x, y, 30, WORLD_SEED + 7);
  if ((Math.abs((x + Math.round(roadN * 10)) % 40) < 1 || Math.abs((y + Math.round(roadN * 10)) % 40) < 1) && n > 0.26) return 4;
  if (dc < 34 && n > 0.35) return 1;
  if (n > 0.7) return 2;
  if (smooth(x, y, 10, WORLD_SEED + 3) > 0.72) return 1;
  return 0;
}
export function areaLevel(x, y) {
  const d = Math.hypot(x - WORLD_SIZE / 2, y - WORLD_SIZE / 2) / (WORLD_SIZE / 2);
  return Math.max(1, Math.min(30, Math.round(Math.pow(Math.max(0, 1 - d), 1.5) * 40)));
}

export const NPC_ALLIANCES = [
  { id: 'npc1', tag: 'RUST', name: 'Rust Covenant', color: '#d0603a', x: 50, y: 60 },
  { id: 'npc2', tag: 'DAWN', name: 'Dawnbreakers', color: '#e6c24a', x: 185, y: 55 },
  { id: 'npc3', tag: 'TIDE', name: 'Black Tide', color: '#4a8fd0', x: 190, y: 185 },
  { id: 'npc4', tag: 'ROOT', name: 'Iron Roots', color: '#5fbf5a', x: 55, y: 180 },
  { id: 'npc5', tag: 'HALO', name: 'Last Halo', color: '#c05ad0', x: 120, y: 30 },
  { id: 'npc6', tag: 'GRIT', name: 'Gritmouth', color: '#a0a0a0', x: 120, y: 210 },
];
export const TERRITORY_R = 14;
export function territoryAt(x, y) { for (const a of NPC_ALLIANCES) if (Math.hypot(x - a.x, y - a.y) <= TERRITORY_R) return a; return null; }

const RIVAL_FIRST = ['Grim', 'Rook', 'Vandal', 'Ash', 'Iron', 'Lone', 'Night', 'Scrap', 'Dust', 'Hollow', 'Red', 'Feral', 'Static', 'Cinder', 'Ghost', 'Bone'];
const RIVAL_LAST = ['Wolf', 'Baron', 'Jack', 'Queen', 'Fang', 'Rider', 'Hand', 'Eye', 'Knight', 'Viper', 'Ranger', 'Saint', 'Crow', 'Moth', 'King', 'Hawk'];
const NODE_TYPES = { food: { name: 'Overgrown Farmland', icon: '🌾' }, wood: { name: 'Dead Forest', icon: '🌲' }, metal: { name: 'Scrap Yard', icon: '🔩' }, fuel: { name: 'Oil Well', icon: '🛢️' } };
export { NODE_TYPES };

export function chunkObjects(cx, cy) {
  const rng = mulberry32((hash2(cx, cy, WORLD_SEED) * 4294967296) >>> 0);
  const out = [];
  const place = (kind) => {
    for (let tries = 0; tries < 6; tries++) {
      const x = cx * CHUNK + Math.floor(rng() * CHUNK), y = cy * CHUNK + Math.floor(rng() * CHUNK);
      const t = terrainAt(x, y);
      if (t === 3 || t === 5) continue;
      if (out.some((o) => o.x === x && o.y === y)) continue;
      return { x, y, lvl: areaLevel(x, y) };
    }
    return null;
  };
  const nz = rng() < 0.75 ? 1 + (rng() < 0.4 ? 1 : 0) : 0;
  for (let i = 0; i < nz; i++) { const p = place(); if (p) out.push({ ...p, id: `z:${p.x}:${p.y}`, kind: 'zombie', lvl: Math.max(1, p.lvl + Math.floor(rng() * 5) - 2), sub: ['walker', 'runner', 'brute', 'spitter'][Math.floor(rng() * 4)] }); }
  if (rng() < 0.85) { const p = place(); if (p) { const r = ['food', 'wood', 'metal', 'fuel'][Math.floor(rng() * (p.lvl > 6 ? 4 : 3))]; out.push({ ...p, id: `n:${p.x}:${p.y}`, kind: 'node', res: r, amount: Math.round((20000 + p.lvl * 9000) * (r === 'fuel' ? 0.3 : r === 'metal' ? 0.5 : 1)) }); } }
  if (rng() < 0.16) { const p = place(); if (p) out.push({ ...p, id: `c:${p.x}:${p.y}`, kind: 'camp', lvl: Math.min(30, p.lvl + 2) }); }
  if (rng() < 0.14) {
    const p = place();
    if (p) {
      const name = RIVAL_FIRST[Math.floor(rng() * 16)] + RIVAL_LAST[Math.floor(rng() * 16)];
      const ter = territoryAt(p.x, p.y);
      out.push({ ...p, id: `p:${p.x}:${p.y}`, kind: 'rival', name, tag: ter?.tag || null, hq: Math.max(1, Math.min(25, Math.round(p.lvl * 0.8 + rng() * 4))), ai: true });
    }
  }
  if (rng() < 0.03 && areaLevel(cx * CHUNK, cy * CHUNK) > 8) { const p = place(); if (p) out.push({ ...p, id: `b:${p.x}:${p.y}`, kind: 'boss', lvl: Math.min(30, p.lvl + 4), sub: ['behemoth', 'matriarch', 'warlord'][Math.floor(rng() * 3)] }); }
  return out;
}

export function objectsInRect(x0, y0, x1, y1) {
  const out = [];
  for (let cy = Math.floor(y0 / CHUNK); cy <= Math.floor(y1 / CHUNK); cy++)
    for (let cx = Math.floor(x0 / CHUNK); cx <= Math.floor(x1 / CHUNK); cx++)
      if (cx >= 0 && cy >= 0 && cx * CHUNK < WORLD_SIZE && cy * CHUNK < WORLD_SIZE) out.push(...chunkObjects(cx, cy));
  return out;
}
export function objectById(id) {
  const [, xs, ys] = id.split(':'); const x = +xs, y = +ys;
  return chunkObjects(Math.floor(x / CHUNK), Math.floor(y / CHUNK)).find((o) => o.id === id) || null;
}
export function rivalSquads(o) {
  const lvl = o.lvl + Math.floor(o.hq / 3);
  const sq = zombieSquads(lvl, { kinds: ['raider'], count: Math.min(5, 2 + Math.floor(o.hq / 5)) });
  sq.forEach((s, i) => { s.zombie = false; s.name = L`${o.name}'s Squad ${i + 1}`; s.troopType = ['infantry', 'ranged', 'vehicle'][i % 3]; });
  sq.push({ name: 'Barricade', icon: '🧱', color: '#8a7a6a', row: 0, structure: true, atk: 20 * o.hq, def: 400 * o.hq, hp: Math.round(4000 * Math.pow(1.32, o.hq - 1)), troops: 0 });
  return sq;
}
export function campSquads(o) { return zombieSquads(o.lvl + 2, { kinds: ['raider', 'raider', 'brute'], count: 4 }).map((s) => ({ ...s, zombie: false, name: 'Raider Camp', troopType: 'infantry' })); }
export function targetSquads(o) {
  if (o.kind === 'zombie') return zombieSquads(o.lvl, { kinds: [o.sub, 'walker'] });
  if (o.kind === 'camp') return campSquads(o);
  if (o.kind === 'rival') return rivalSquads(o);
  if (o.kind === 'boss') return zombieSquads(o.lvl + 3, { boss: o.sub, count: 3 });
  return [];
}

export const worldSys = {
  basePos() {
    const w = this.s.world;
    if (!w.x) this.relocate(true);
    return { x: w.x, y: w.y };
  },
  relocate(initial = false) {
    const rng = mulberry32((this.s.seed + (initial ? 0 : this.now())) >>> 0);
    for (let i = 0; i < 200; i++) {
      const ang = rng() * Math.PI * 2, r = 92 + rng() * 12;
      const x = Math.round(WORLD_SIZE / 2 + Math.cos(ang) * r), y = Math.round(WORLD_SIZE / 2 + Math.sin(ang) * r);
      const t = terrainAt(x, y);
      if (t !== 3 && t !== 5 && !objectsInRect(x - 1, y - 1, x + 1, y + 1).some((o) => Math.abs(o.x - x) <= 1 && Math.abs(o.y - y) <= 1)) { this.s.world.x = x; this.s.world.y = y; this.emit('change'); return { x, y }; }
    }
    this.s.world.x = 40; this.s.world.y = 40; return { x: 40, y: 40 };
  },
  objectState(o) {
    const w = this.s.world, now = this.now();
    if (w.cleared[o.id] && w.cleared[o.id] > now) return { gone: true };
    if (o.kind === 'node') {
      const rem = w.nodes[o.id]?.amount ?? o.amount;
      if (w.nodes[o.id] && w.nodes[o.id].resetAt < now) { delete w.nodes[o.id]; return { amount: o.amount }; }
      return { amount: rem, occupied: this.s.marches.some((m) => m.target === o.id && m.kind === 'gather') };
    }
    return {};
  },
  visibleObjects(x0, y0, x1, y1) {
    return objectsInRect(x0, y0, x1, y1).filter((o) => !this.objectState(o).gone && !(o.x === this.s.world.x && o.y === this.s.world.y));
  },
  marchSlots() { const hq = this.lvl('hq'); return 1 + (hq >= 6) + (hq >= 12) + (hq >= 18); },
  travelSec(tx, ty, scout = false) {
    const p = this.basePos(), d = Math.hypot(tx - p.x, ty - p.y);
    return Math.max(3, Math.round(d / (MARCH_SPEED * (scout ? 2.5 : 1) * (1 + this.bonus('march_speed')))));
  },
  vigorCost(o) { return o.kind === 'zombie' ? 8 : o.kind === 'boss' ? 20 : o.kind === 'camp' ? 12 : 0; },
  availableHeroes() { return Object.keys(this.s.heroes).filter((id) => !this.heroBusy(id)); },

  // heroes: array of hero ids; positions auto-assigned (tanks front)
  sendMarch(kind, targetId, heroIds = []) {
    const o = objectById(targetId); if (!o) return { ok: false, msg: 'Target not found' };
    if (this.objectState(o).gone) return { ok: false, msg: 'Target is gone' };
    if (this.s.marches.length >= this.marchSlots()) return { ok: false, msg: L`All ${this.marchSlots()} march slots in use` };
    const now = this.now();
    if (kind === 'scout') {
      const cost = { food: 200 * Math.max(1, o.lvl) };
      if (!this.spend(cost)) return { ok: false, msg: 'Not enough food to scout' };
      const t = this.travelSec(o.x, o.y, true);
      this.s.marches.push({ id: this.s.marchSeq++, kind, target: targetId, tx: o.x, ty: o.y, heroes: [], troops: {}, start: now, arrive: now + t * 1000, state: 'out', loot: {} });
      return { ok: true };
    }
    heroIds = heroIds.filter((id) => this.s.heroes[id] && !this.heroBusy(id)).slice(0, 5);
    if (!heroIds.length) return { ok: false, msg: 'Pick at least one available hero' };
    if (kind === 'gather' && o.kind !== 'node') return { ok: false, msg: 'Can only gather at resource nodes' };
    if (kind === 'gather' && this.objectState(o).occupied) return { ok: false, msg: 'Already being gathered' };
    if (kind === 'attack' && o.kind === 'node') return { ok: false, msg: 'Use Gather on resource nodes' };
    if (kind === 'attack' && o.kind === 'rival' && o.ai === false) return { ok: false, msg: 'Use online PvP for real players' };
    const vc = kind === 'attack' ? this.vigorCost(o) : 0;
    if (vc && this.vigor() < vc) return { ok: false, msg: L`Need ${vc} Vigor` };
    const formation = this.autoFormation(heroIds);
    const { squads, used } = this.buildSquads(formation, this.s.troops);
    if (!Object.keys(used).length) return { ok: false, msg: 'No troops available at home' };
    if (vc) this.useVigor(vc);
    for (const [k, n] of Object.entries(used)) this.s.troops[k] -= n;
    const t = this.travelSec(o.x, o.y);
    this.s.marches.push({ id: this.s.marchSeq++, kind, target: targetId, tx: o.x, ty: o.y, heroes: heroIds, formation, troops: used, start: now, arrive: now + t * 1000, state: 'out', loot: {} , power: sidePower(squads) });
    this.emit('change');
    return { ok: true, travel: t };
  },
  marchLoad(m) { let l = 0; for (const [k, n] of Object.entries(m.troops)) { const { type, tier } = parseTroopKey(k); l += n * troopStats(type, tier).load; } return Math.round(l * (1 + this.bonus('load'))); },
  recall(id) {
    const m = this.s.marches.find((x) => x.id === id); if (!m || m.state === 'return') return { ok: false };
    const now = this.now();
    if (m.state === 'gather') { m.loot = { [m.res]: this.gatheredSoFar(m) }; this.depleteNode(m.target, m.loot[m.res]); }
    const elapsed = m.state === 'out' ? now - m.start : (m.arrive - m.start);
    m.state = 'return'; m.start = now; m.arrive = now + Math.max(1000, elapsed);
    this.emit('change'); return { ok: true };
  },
  gatheredSoFar(m) { return Math.floor(Math.min(m.capacity, (this.now() - m.gatherStart) / 1000 * m.rate)); },
  depleteNode(id, amt) {
    const o = objectById(id); const w = this.s.world;
    const cur = w.nodes[id]?.amount ?? o.amount;
    const left = Math.max(0, cur - amt);
    if (left <= 0) { w.cleared[id] = this.now() + 2 * HOUR; delete w.nodes[id]; }
    else w.nodes[id] = { amount: left, resetAt: this.now() + 12 * HOUR };
  },
  processMarches(now) {
    for (const m of [...this.s.marches]) {
      if (m.state === 'out' && now >= m.arrive) this.arrive(m, m.arrive);
      else if (m.state === 'gather' && now >= m.gatherEnd) {
        m.loot = { [m.res]: Math.floor(m.capacity) }; this.depleteNode(m.target, m.loot[m.res]);
        const d = m.arrive - m.start; m.state = 'return'; m.start = m.gatherEnd; m.arrive = m.gatherEnd + d;
        this.track('gather', 1);
      }
      if (m.state === 'return' && now >= m.arrive) this.homecoming(m);
    }
  },
  arrive(m, at) {
    const o = objectById(m.target), st = o ? this.objectState(o) : { gone: true };
    const travel = m.arrive - m.start;
    const goHome = () => { m.state = 'return'; m.start = at; m.arrive = at + travel; };
    if (!o || st.gone) { this.toast('Target vanished — march returning'); goHome(); return; }
    if (m.kind === 'scout') {
      const sq = targetSquads(o);
      this.s.world.scouted[o.id] = this.now();
      this.track('scout', 1);
      this.addReport({ type: 'scout', title: L`Scout report: ${o.name || labelOf(o)}`, win: true, intel: { power: sidePower(sq), squads: sq.map((s) => ({ name: s.name, troops: s.troops, icon: s.icon })), loot: o.kind === 'rival' ? this.rivalLoot(o) : null }, target: o.id });
      goHome(); return;
    }
    if (m.kind === 'gather') {
      if (this.s.marches.some((x) => x !== m && x.target === m.target && x.state === 'gather')) { this.toast('Node already occupied — returning'); goHome(); return; }
      m.res = o.res; m.capacity = Math.min(st.amount, this.marchLoad(m));
      m.rate = (40 + o.lvl * 6) * (o.res === 'fuel' ? 0.35 : o.res === 'metal' ? 0.6 : 1) * (1 + this.bonus('gather_speed')) * Math.max(1, Object.values(m.troops).reduce((a, b) => a + b, 0) / 150);
      m.gatherStart = at; m.gatherEnd = at + Math.ceil(m.capacity / m.rate) * 1000; m.state = 'gather';
      m.arrive = at; m.start = at - travel; // keep travel for return
      return;
    }
    // attack
    const { squads } = this.buildSquads(m.formation, m.troops, { ignoreBusy: true });
    const enemy = targetSquads(o);
    const seed = (at & 0xffffff) ^ m.id;
    const res = simulateBattle(squads, enemy, { seed });
    const win = res.winner === 'a';
    const { lost, survived } = this.lossesFrom(squads, res.a);
    const { wounded, dead } = this.addWounded(lost);
    m.troops = survived;
    let rewards = {};
    if (win) {
      if (o.kind === 'zombie') { rewards = { food: 600 + o.lvl * 400, wood: 600 + o.lvl * 400, metal: o.lvl > 4 ? o.lvl * 150 : 0, xp: 40 + o.lvl * 25, parts: 1 + Math.floor(o.lvl / 3) }; this.track('zombie', 1); this.s.world.cleared[o.id] = at + 30 * 60000; }
      else if (o.kind === 'camp') { rewards = { metal: 800 + o.lvl * 500, fuel: o.lvl * 100, gems: 10 + o.lvl, xp: 80 + o.lvl * 30, parts: 3 + o.lvl }; this.track('zombie', 1); this.s.world.cleared[o.id] = at + 2 * HOUR; }
      else if (o.kind === 'boss') { rewards = { gems: 50 + o.lvl * 5, eliteTicket: o.lvl > 15 ? 1 : 0, ticket: 1, parts: 10 + o.lvl * 2, manual: 2, xp: 200 + o.lvl * 50 }; this.track('zombie', 1); this.track('boss', 1); this.s.world.cleared[o.id] = at + 6 * HOUR; }
      else if (o.kind === 'rival') { rewards = this.rivalLoot(o); rewards.xp = 100 + o.hq * 30; this.track('raid', 1); this.s.world.cleared[o.id] = at + 1 * HOUR; }
      const xp = rewards.xp; delete rewards.xp; this.addXp(xp || 0);
      m.loot = rewards;
      m.heroes.forEach((h) => this.heroAddXp(h, 100 + o.lvl * 40));
    }
    this.addReport({ type: o.kind === 'rival' ? 'pvp' : 'pve', title: L`${win ? 'Victory' : 'Defeat'} vs ${o.name || labelOf(o)} (Lv ${o.lvl})`, win, rewards: m.loot, wounded, dead, a: squads, b: enemy, seed, summary: { a: res.a, b: res.b, turns: res.turns } });
    this.emit('battle', { march: m, win });
    if (!Object.keys(survived).length && !m.heroes.length) { this.s.marches = this.s.marches.filter((x) => x !== m); return; }
    goHome();
  },
  rivalLoot(o) { const k = 1500 + o.hq * o.hq * 220; return { food: k, wood: k, metal: Math.round(k * 0.4), fuel: o.hq > 6 ? Math.round(k * 0.15) : 0 }; },
  homecoming(m) {
    for (const [k, n] of Object.entries(m.troops)) this.s.troops[k] = (this.s.troops[k] || 0) + n;
    if (m.loot && Object.keys(m.loot).length) { this.give(m.loot); this.toast(L`March returned with loot`, 'good'); }
    this.s.marches = this.s.marches.filter((x) => x !== m);
    this.emit('change');
  },
  marchPos(m) {
    const p = this.basePos(), now = this.now();
    if (m.state === 'gather') return { x: m.tx, y: m.ty };
    const f = Math.min(1, Math.max(0, (now - m.start) / Math.max(1, m.arrive - m.start)));
    return m.state === 'out' ? { x: p.x + (m.tx - p.x) * f, y: p.y + (m.ty - p.y) * f } : { x: m.tx + (p.x - m.tx) * f, y: m.ty + (p.y - m.ty) * f };
  },

  // ---------------- rival raids on the player's base (AI) ----------------
  processThreats(now) {
    const s = this.s;
    if (this.lvl('hq') < 4) { s.nextRaidAt = Math.max(s.nextRaidAt, now + 30 * 60000); return; }
    if (!s.incoming && now >= s.nextRaidAt) {
      if (now < s.shieldUntil) { s.nextRaidAt = s.shieldUntil + 20 * 60000; return; }
      const rng = mulberry32((now & 0xffffffff) >>> 0);
      const hq = Math.max(1, this.lvl('hq') - 1 + Math.floor(rng() * 3));
      const name = RIVAL_FIRST[Math.floor(rng() * 16)] + RIVAL_LAST[Math.floor(rng() * 16)];
      const lvl = Math.max(1, Math.round(hq * 1.1));
      const squads = zombieSquads(lvl, { kinds: ['raider'], count: Math.min(5, 2 + Math.floor(hq / 5)) }).map((q) => ({ ...q, zombie: false, troopType: ['infantry', 'ranged', 'vehicle'][Math.floor(rng() * 3)] }));
      s.incoming = { name, hq, squads, arrive: now + 90000, power: enemyPower(squads) };
      this.toast(L`⚠️ ${name} is marching on your bastion!`, 'bad');
      this.emit('incoming', s.incoming);
    }
    if (s.incoming && now >= s.incoming.arrive) this.resolveRaid(s.incoming, now);
  },
  resolveRaid(inc, now) {
    const s = this.s; s.incoming = null;
    s.nextRaidAt = now + (2 + Math.random() * 4) * HOUR;
    if (now < s.shieldUntil) return;
    const def = this.defenseSquads();
    const { squads: home } = this.buildSquads(s.formation.defense, s.troops, { forDefense: true });
    const res = simulateBattle(inc.squads, def, { seed: now & 0xffff });
    const defWin = res.winner === 'b';
    const { lost } = this.lossesFrom(home, res.b);
    for (const [k, n] of Object.entries(lost)) s.troops[k] = Math.max(0, (s.troops[k] || 0) - n);
    const { wounded, dead } = this.addWounded(lost);
    const plundered = {};
    if (!defWin) {
      const prot = this.protectedAmount();
      for (const r of ['food', 'wood', 'metal', 'fuel']) { const v = Math.floor(Math.max(0, s.res[r] - prot) * 0.2); if (v) { s.res[r] -= v; plundered[r] = v; } }
      s.shieldUntil = now + 30 * 60000; // short protection after being hit
    } else this.addXp(50 * inc.hq);
    this.addReport({ type: 'defense', title: defWin ? L`Repelled ${inc.name}!` : L`${inc.name} raided your bastion`, win: defWin, plundered, wounded, dead, a: inc.squads, b: def, seed: now & 0xffff, defender: true, summary: { a: res.a, b: res.b, turns: res.turns } });
    this.toast(defWin ? L`Defense held against ${inc.name}!` : L`${inc.name} broke through and looted resources`, defWin ? 'good' : 'bad');
  },
};
export function labelOf(o) {
  return o.kind === 'zombie' ? 'Zombie Horde' : o.kind === 'camp' ? 'Raider Camp' : o.kind === 'node' ? NODE_TYPES[o.res].name : o.kind === 'boss' ? 'World Boss' : o.name;
}
