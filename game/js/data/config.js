// Global tuning constants. Everything balance-related lives in /data so it can be tweaked in one place.
export const GAME_NAME = 'Ashfall: Last Bastion';
export const SAVE_VERSION = 1;

export const RESOURCES = ['food', 'wood', 'metal', 'fuel'];
export const RES_INFO = {
  food:  { name: 'Food',  icon: '🥫', color: '#e8b04a' },
  wood:  { name: 'Wood',  icon: '🪵', color: '#b07a45' },
  metal: { name: 'Metal', icon: '⚙️', color: '#9fb4c7' },
  fuel:  { name: 'Fuel',  icon: '🛢️', color: '#d8573c' },
  gems:  { name: 'Gems',  icon: '💎', color: '#5fd3ff' },
};

export const START_STATE = {
  res: { food: 6000, wood: 6000, metal: 1500, fuel: 0 },
  gems: 800,
};

export const BUILDER_QUEUES = 1;      // base queues; +1 from VIP 2
export const RESEARCH_QUEUES = 1;
export const COLLECT_CAP_HOURS = 10;  // resource buildings stop filling after this
export const VIGOR_MAX = 100;
export const VIGOR_REGEN_SEC = 180;   // 1 vigor every 3 minutes
export const FREE_FINISH_SEC = 120;   // timers under 2 minutes can be finished for free
export const HELP_PCT = 0.01;         // each alliance help removes 1% (min 30s)
export const HELP_MIN_SEC = 30;
export const ARENA_DAILY_ATTEMPTS = 5;
export const WORLD_SIZE = 240;        // tiles per side
export const MARCH_SPEED = 2.2;       // tiles per second at base speed

// Gem cost to instantly finish a timer
export function gemsForSeconds(sec) {
  if (sec <= FREE_FINISH_SEC) return 0;
  return Math.max(1, Math.ceil(Math.pow(sec / 60, 0.85) * 1.2));
}
// Gem cost to buy missing resources
export function gemsForResources(missing) {
  let g = 0;
  for (const [r, v] of Object.entries(missing)) {
    if (v <= 0) continue;
    const rate = r === 'fuel' ? 25 : r === 'metal' ? 50 : 100; // resources per gem
    g += v / rate;
  }
  return Math.ceil(g);
}

export const RARITY = {
  R:   { name: 'Rare',      color: '#4f9cff', stars: 5, mult: 1.0 },
  SR:  { name: 'Epic',      color: '#b06bff', stars: 5, mult: 1.28 },
  SSR: { name: 'Legendary', color: '#ffb321', stars: 5, mult: 1.65 },
};

export const VIP_LEVELS = [
  // pts needed, perks
  { pts: 0,     build: 0,    research: 0,    queues: 0, march: 0,   vigor: 0 },
  { pts: 200,   build: 0.03, research: 0.03, queues: 0, march: 0,   vigor: 0 },
  { pts: 600,   build: 0.05, research: 0.05, queues: 1, march: 0,   vigor: 10 },
  { pts: 1500,  build: 0.08, research: 0.08, queues: 1, march: 0.05, vigor: 20 },
  { pts: 3500,  build: 0.10, research: 0.10, queues: 1, march: 0.08, vigor: 30 },
  { pts: 7000,  build: 0.13, research: 0.13, queues: 1, march: 0.10, vigor: 40 },
  { pts: 12000, build: 0.16, research: 0.16, queues: 1, march: 0.12, vigor: 50 },
  { pts: 20000, build: 0.20, research: 0.20, queues: 1, march: 0.15, vigor: 60 },
  { pts: 32000, build: 0.25, research: 0.25, queues: 1, march: 0.18, vigor: 80 },
  { pts: 50000, build: 0.30, research: 0.30, queues: 1, march: 0.22, vigor: 100 },
];

// Commander XP needed to go from level L to L+1
export function commanderXpFor(level) {
  return Math.round(120 * Math.pow(level, 1.75));
}
