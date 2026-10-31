// Turn-based squad combat. Pure & deterministic: same input + seed => same result.
// A squad = one hero (optional) leading a stack of troops. Up to 5 squads per side:
// row 0 = front line (tanks soak), row 1 = back line.
import { mulberry32 } from './rng.js';
import { COUNTER_BONUS, TROOP_TYPES } from '../data/troops.js';

const K = 2.0;            // global damage constant
const MAX_TURNS = 30;
const ENERGY_PER_TURN = 22;
const ENERGY_ON_HIT = 6;

function prep(spec, side, i) {
  return {
    ...spec, side, idx: i, key: side + i,
    maxHp: spec.hp, curHp: spec.hp, troops0: spec.troops || 0,
    energy: spec.startEnergy || 0, shield: 0, shieldT: 0, stun: 0, taunt: 0,
    buffs: [], dealt: 0, healed: 0, taken: 0, alive: true,
    crit: spec.crit || 0.05,
  };
}

function statMod(u, stat) {
  let m = 1;
  for (const b of u.buffs) if (b.stat === stat) m += b.pct;
  return Math.max(0.2, m);
}
function curAtk(u) { return u.atk * (0.35 + 0.65 * (u.curHp / u.maxHp)) * statMod(u, 'atk'); }
function curDef(u) { return u.def * statMod(u, 'def'); }

function pickTarget(rng, attacker, enemies, mode) {
  const alive = enemies.filter((e) => e.alive);
  if (!alive.length) return null;
  const taunters = alive.filter((e) => e.taunt > 0);
  if (taunters.length && mode !== 'pierce') return taunters[0];
  const front = alive.filter((e) => e.row === 0), back = alive.filter((e) => e.row !== 0);
  let pool;
  if (mode === 'pierce') pool = back.length ? back : front;
  else if (mode === 'weakest') pool = [alive.reduce((a, b) => (a.curHp / a.maxHp < b.curHp / b.maxHp ? a : b))];
  else if (attacker.troopType === 'ranged' && back.length && rng() < 0.35) pool = back;
  else pool = front.length ? front : back;
  return pool[Math.floor(rng() * pool.length)];
}

function damage(rng, a, t, mult, log, turn, tag) {
  const atk = curAtk(a), def = curDef(t);
  const mitig = def / (def + atk);
  let dmg = atk * K * mult * (1 - mitig) * (0.92 + rng() * 0.16);
  if (a.troopType && t.troopType && TROOP_TYPES[a.troopType]?.strong === t.troopType) dmg *= 1 + COUNTER_BONUS;
  if (t.zombie && a.vsZombie) dmg *= 1 + a.vsZombie;
  if (t.boss && a.vsBoss) dmg *= 1 + a.vsBoss;
  const crit = rng() < a.crit;
  if (crit) dmg *= 1.5;
  dmg = Math.max(1, Math.round(dmg));
  let left = dmg;
  if (t.shield > 0) { const s = Math.min(t.shield, left); t.shield -= s; left -= s; }
  t.curHp = Math.max(0, t.curHp - left);
  t.taken += dmg; a.dealt += dmg;
  t.energy = Math.min(100, t.energy + ENERGY_ON_HIT);
  log.push({ t: turn, k: tag || 'atk', s: a.key, d: t.key, v: dmg, c: crit ? 1 : 0 });
  if (t.curHp <= 0 && t.alive) { t.alive = false; log.push({ t: turn, k: 'die', s: t.key }); }
  return dmg;
}

function castSkill(rng, u, allies, enemies, log, turn) {
  const sk = u.skill; if (!sk) return false;
  const lvlMult = 1 + 0.15 * ((sk.level || 1) - 1);
  const mult = (sk.mult || 1) * lvlMult;
  log.push({ t: turn, k: 'skill', s: u.key, n: sk.name || sk.kind, kind: sk.kind });
  const aliveE = enemies.filter((e) => e.alive), aliveA = allies.filter((e) => e.alive);
  switch (sk.kind) {
    case 'strike': { const t = pickTarget(rng, u, enemies); if (t) damage(rng, u, t, mult, log, turn, 'sk'); break; }
    case 'execute': { const t = pickTarget(rng, u, enemies, 'weakest'); if (t) damage(rng, u, t, mult * (t.curHp / t.maxHp < 0.4 ? 2 : 1), log, turn, 'sk'); break; }
    case 'pierce': { const t = pickTarget(rng, u, enemies, 'pierce'); if (t) damage(rng, u, t, mult, log, turn, 'sk'); break; }
    case 'barrage': for (const t of aliveE) damage(rng, u, t, mult * 0.75, log, turn, 'sk'); break;
    case 'drain': { const t = pickTarget(rng, u, enemies); if (t) { const d = damage(rng, u, t, mult, log, turn, 'sk'); heal(u, u, d * 0.5, log, turn); } break; }
    case 'stun': {
      const targets = sk.all ? aliveE : [pickTarget(rng, u, enemies)].filter(Boolean);
      for (const t of targets) {
        damage(rng, u, t, mult * (sk.all ? 0.7 : 1), log, turn, 'sk');
        if (t.alive && (!sk.all || rng() < 0.4) && !t.boss) { t.stun = Math.max(t.stun, sk.dur || 1); log.push({ t: turn, k: 'stun', s: t.key }); }
      }
      break;
    }
    case 'heal': {
      const amt = curAtk(u) * mult * 0.9;
      if (sk.all) for (const a of aliveA) heal(u, a, amt * 0.6, log, turn);
      else { const a = aliveA.reduce((x, y) => (x.curHp / x.maxHp < y.curHp / y.maxHp ? x : y)); heal(u, a, amt, log, turn); }
      break;
    }
    case 'shield': for (const a of aliveA) { a.shield = a.maxHp * (sk.pct || 0.1) * lvlMult; a.shieldT = 3; log.push({ t: turn, k: 'shield', s: a.key, v: Math.round(a.shield) }); } break;
    case 'rally': for (const a of aliveA) { a.buffs.push({ stat: 'atk', pct: (sk.pct || 0.15) * lvlMult, turns: sk.dur || 3 }); log.push({ t: turn, k: 'buff', s: a.key }); } break;
    case 'taunt': u.taunt = sk.dur || 3; u.buffs.push({ stat: 'def', pct: (sk.def || 0.3) * lvlMult, turns: sk.dur || 3 }); log.push({ t: turn, k: 'taunt', s: u.key }); break;
    case 'weaken':
      for (const t of aliveE) {
        damage(rng, u, t, mult * 0.8, log, turn, 'sk');
        if (t.alive) { t.buffs.push({ stat: 'atk', pct: -(sk.pct || 0.15) * lvlMult, turns: sk.dur || 2 }); log.push({ t: turn, k: 'debuff', s: t.key }); }
      }
      break;
    default: return false;
  }
  return true;
}

function heal(src, a, amt, log, turn) {
  if (!a.alive) return;
  const v = Math.round(Math.min(a.maxHp - a.curHp, amt));
  a.curHp += v; src.healed += v;
  log.push({ t: turn, k: 'heal', s: src.key, d: a.key, v });
}

function initiative(u) { return u.troopType === 'vehicle' ? 3 : u.troopType === 'ranged' ? 2 : u.boss ? 2.5 : 1; }

export function simulateBattle(sideA, sideB, opts = {}) {
  const rng = mulberry32(opts.seed ?? 1);
  const A = sideA.map((s, i) => prep(s, 'a', i)), B = sideB.map((s, i) => prep(s, 'b', i));
  const log = [];
  let turn = 0;
  const alive = (arr) => arr.some((u) => u.alive);
  const maxTurns = opts.maxTurns || MAX_TURNS;
  while (alive(A) && alive(B) && turn < maxTurns) {
    turn++;
    const order = [...A, ...B].filter((u) => u.alive).map((u) => ({ u, r: initiative(u) + rng() })).sort((x, y) => y.r - x.r).map((x) => x.u);
    for (const u of order) {
      if (!u.alive) continue;
      if (!alive(A) || !alive(B)) break;
      const allies = u.side === 'a' ? A : B, enemies = u.side === 'a' ? B : A;
      if (u.stun > 0) { u.stun--; log.push({ t: turn, k: 'stunned', s: u.key }); continue; }
      u.energy = Math.min(100, u.energy + ENERGY_PER_TURN);
      if (u.energy >= 100 && u.skill) { u.energy = 0; castSkill(rng, u, allies, enemies, log, turn); }
      else { const t = pickTarget(rng, u, enemies); if (t) damage(rng, u, t, 1, log, turn); }
    }
    // tick buffs
    for (const u of [...A, ...B]) {
      u.buffs = u.buffs.filter((b) => --b.turns > 0);
      if (u.taunt > 0) u.taunt--;
      if (u.shieldT > 0 && --u.shieldT === 0) u.shield = 0;
    }
  }
  const winner = alive(A) && !alive(B) ? 'a' : 'b'; // timeouts favour the defender
  const summarize = (arr) => arr.map((u) => {
    const frac = u.alive ? u.curHp / u.maxHp : 0;
    const survivors = Math.min(u.troops0, Math.ceil(u.troops0 * frac));
    return { key: u.key, name: u.name, heroId: u.heroId || null, icon: u.icon, troops: u.troops0, survivors, lost: u.troops0 - survivors,
      hpFrac: frac, dealt: u.dealt, healed: u.healed, taken: u.taken, alive: u.alive, troopType: u.troopType || null };
  });
  return { winner, turns: turn, log, a: summarize(A), b: summarize(B), seed: opts.seed ?? 1 };
}

export function squadPower(s) { return Math.round((s.atk + s.def) * 0.6 + s.hp * 0.05); }
export function sidePower(side) { return side.reduce((a, s) => a + squadPower(s), 0); }
