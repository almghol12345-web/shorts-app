import { START_STATE, SAVE_VERSION, VIGOR_MAX } from '../data/config.js';
import { hashStr } from './rng.js';

export const DAY = 86400000;
export function dayKey(now) { return new Date(now).toISOString().slice(0, 10); }
export function weekIndex(now) { return Math.floor((now / DAY + 3) / 7); } // weeks start Monday 00:00 UTC
export function weekEnd(now) { return (weekIndex(now) + 1) * 7 * DAY - 3 * DAY; }
export function dayEnd(now) { return (Math.floor(now / DAY) + 1) * DAY; }

export function createState(name = 'Commander', now = Date.now(), seed) {
  const s = {
    v: SAVE_VERSION, createdAt: now, lastTick: now, seed: seed ?? (hashStr(name + now) % 1e9),
    player: { name, level: 1, xp: 0, vipPts: 0, avatar: 'kael', id: null },
    res: { ...START_STATE.res }, gems: START_STATE.gems,
    buildings: {
      hq: { type: 'hq', lvl: 1 }, wall: { type: 'wall', lvl: 1 }, barracks: { type: 'barracks', lvl: 1 },
      tavern: { type: 'tavern', lvl: 1 },
      plot0: { type: 'farm', lvl: 1, collectedAt: now - 45 * 60000 }, plot5: { type: 'lumber', lvl: 1, collectedAt: now - 45 * 60000 },
    },
    queues: { build: [], research: [], train: {}, heal: null },
    research: {},
    troops: { infantry1: 220, ranged1: 120, vehicle1: 0 },
    wounded: {},
    heroes: { brick: newHero(), wren: newHero() },
    shards: {},
    gear: [], gearSeq: 1,
    items: { speed5m: 5, ticket: 3, manual: 4, xpSmall: 4, parts: 20, vigor20: 1 },
    formation: { attack: [{ hero: 'brick', slot: 0 }, { hero: 'wren', slot: 2 }], defense: [{ hero: 'brick', slot: 0 }, { hero: 'wren', slot: 2 }] },
    campaign: { stage: 0, stars: {} },
    vigor: { v: VIGOR_MAX, at: now },
    marches: [], marchSeq: 1,
    world: { x: 0, y: 0, cleared: {}, nodes: {}, scouted: {} },
    alliance: null,
    missions: { day: dayKey(now), daily: {}, dClaimed: [], chests: [], week: weekIndex(now), weekly: {}, wClaimed: [], ach: {}, story: 0, life: {} },
    login: { lastDay: null, streak: 0, claimedDay: null },
    arena: { points: 1000, day: dayKey(now), attempts: 0, wins: 0, opponents: [], refreshAt: 0, history: [] },
    events: {},
    reports: [], reportSeq: 1,
    shop: { day: dayKey(now), bought: {} },
    settings: { sound: true, music: true },
    recruit: { freeAt: now, pity: 0, elitePity: 0 },
    shieldUntil: now + 3 * DAY, // newcomer protection
    nextRaidAt: now + 20 * 60000,
    inbox: [], tutorial: 0,
  };
  return s;
}
export function newHero() { return { lvl: 1, xp: 0, stars: 0, skills: [1, 1, 1], gear: {} }; }

export function migrate(s) {
  // Hook for future save versions
  if (!s.v) s.v = 1;
  s.inbox ||= []; s.events ||= {}; s.world.scouted ||= {};
  return s;
}
