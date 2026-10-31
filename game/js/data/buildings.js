// Building definitions. Costs and timers scale per level; requirements are generated.
// `effect(lvl)` returns the gameplay numbers for a level so the UI can show "now → next".

const g = (base, rate, lvl) => base * Math.pow(rate, lvl - 1);
const r50 = (v) => Math.max(0, Math.round(v / 50) * 50);

export const TIERS_BY_LEVEL = [1, 5, 10, 15, 20]; // building level that unlocks troop tier 1..5

function prod(base, lvl) { return Math.round(base * lvl * Math.pow(1.12, lvl - 1)); }

export const BUILDINGS = {
  hq: {
    name: 'Command Center', short: 'HQ', icon: '🏛️', unique: true, maxLevel: 25, unlockHQ: 0,
    desc: 'The heart of the bastion. Its level caps every other building and unlocks new structures.',
    cost: { food: 450, wood: 450, metal: 120, fuel: 60 }, costRate: 1.43, time: 18, timeRate: 1.5,
    effect: (l) => ({ 'Building level cap': l, 'Marches': marchSlots(l) }),
  },
  wall: {
    name: 'Barricade', short: 'Wall', icon: '🧱', unique: true, maxLevel: 25, unlockHQ: 1,
    desc: 'Scrap-steel walls that soak damage when raiders or the horde hit your base.',
    cost: { food: 120, wood: 380, metal: 160, fuel: 30 }, costRate: 1.42, time: 12, timeRate: 1.46,
    effect: (l) => ({ 'Wall durability': Math.round(g(4000, 1.32, l)) }),
  },
  farm: {
    name: 'Hydro Farm', short: 'Farm', icon: '🌱', unique: false, maxCount: [1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4], maxLevel: 25, unlockHQ: 1,
    desc: 'Grows food in salvaged greenhouse tanks. Food feeds troops and trains infantry.',
    cost: { food: 60, wood: 220, metal: 40 }, costRate: 1.4, time: 6, timeRate: 1.45, produces: 'food',
    effect: (l) => ({ 'Food / hour': prod(620, l) }),
  },
  lumber: {
    name: 'Lumber Yard', short: 'Lumber', icon: '🪓', unique: false, maxCount: [1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4], maxLevel: 25, unlockHQ: 1,
    desc: 'Strips the dead forests for timber.',
    cost: { food: 220, wood: 60, metal: 40 }, costRate: 1.4, time: 6, timeRate: 1.45, produces: 'wood',
    effect: (l) => ({ 'Wood / hour': prod(620, l) }),
  },
  foundry: {
    name: 'Scrap Foundry', short: 'Foundry', icon: '🔥', unique: false, maxCount: [0, 0, 1, 1, 1, 2, 2, 2, 2, 3], maxLevel: 25, unlockHQ: 3,
    desc: 'Melts wrecks down into usable metal.',
    cost: { food: 260, wood: 260, metal: 30 }, costRate: 1.41, time: 9, timeRate: 1.46, produces: 'metal',
    effect: (l) => ({ 'Metal / hour': prod(260, l) }),
  },
  refinery: {
    name: 'Fuel Refinery', short: 'Refinery', icon: '🛢️', unique: false, maxCount: [0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3], maxLevel: 25, unlockHQ: 6,
    desc: 'Cracks old crude into fuel for vehicles and late-game upgrades.',
    cost: { food: 500, wood: 500, metal: 300 }, costRate: 1.41, time: 14, timeRate: 1.46, produces: 'fuel',
    effect: (l) => ({ 'Fuel / hour': prod(120, l) }),
  },
  warehouse: {
    name: 'Depot', short: 'Depot', icon: '📦', unique: true, maxLevel: 25, unlockHQ: 2,
    desc: 'Underground vault. Resources below the protected amount cannot be plundered.',
    cost: { food: 200, wood: 300, metal: 80 }, costRate: 1.4, time: 10, timeRate: 1.45,
    effect: (l) => ({ 'Protected (each)': Math.round(g(5000, 1.33, l)) }),
  },
  barracks: {
    name: 'Barracks', short: 'Barracks', icon: '🪖', unique: true, maxLevel: 25, unlockHQ: 1, trains: 'infantry',
    desc: 'Trains Wardens — shielded infantry who hold the front line.',
    cost: { food: 350, wood: 300, metal: 60 }, costRate: 1.42, time: 12, timeRate: 1.46,
    effect: (l) => ({ 'Training batch': batch(l), 'Highest tier': 'T' + tierFor(l) }),
  },
  range: {
    name: 'Rifle Range', short: 'Range', icon: '🎯', unique: true, maxLevel: 25, unlockHQ: 3, trains: 'ranged',
    desc: 'Trains Marksmen — fragile but deadly ranged troops.',
    cost: { food: 300, wood: 380, metal: 80 }, costRate: 1.42, time: 14, timeRate: 1.46,
    effect: (l) => ({ 'Training batch': batch(l), 'Highest tier': 'T' + tierFor(l) }),
  },
  garage: {
    name: 'Motor Pool', short: 'Motor Pool', icon: '🚙', unique: true, maxLevel: 25, unlockHQ: 5, trains: 'vehicle',
    desc: 'Builds Outriders — armored buggies that crush ranged lines.',
    cost: { food: 300, wood: 300, metal: 260, fuel: 40 }, costRate: 1.42, time: 18, timeRate: 1.46,
    effect: (l) => ({ 'Training batch': batch(l), 'Highest tier': 'T' + tierFor(l) }),
  },
  hospital: {
    name: 'Field Hospital', short: 'Hospital', icon: '🏥', unique: true, maxLevel: 25, unlockHQ: 2,
    desc: 'Wounded troops recover here instead of dying.',
    cost: { food: 280, wood: 260, metal: 50 }, costRate: 1.4, time: 10, timeRate: 1.45,
    effect: (l) => ({ 'Wounded capacity': hospitalCap(l) }),
  },
  research: {
    name: 'Research Lab', short: 'Lab', icon: '🔬', unique: true, maxLevel: 25, unlockHQ: 3,
    desc: 'Unlocks technologies. Lab level gates higher research.',
    cost: { food: 300, wood: 300, metal: 150 }, costRate: 1.43, time: 15, timeRate: 1.47,
    effect: (l) => ({ 'Research speed': '+' + (l * 2) + '%' }),
  },
  drill: {
    name: 'Training Grounds', short: 'Grounds', icon: '🥇', unique: true, maxLevel: 25, unlockHQ: 4,
    desc: 'Drills officers to lead bigger squads into the field.',
    cost: { food: 400, wood: 300, metal: 160 }, costRate: 1.42, time: 14, timeRate: 1.46,
    effect: (l) => ({ 'Troops per hero': squadCap(l) }),
  },
  tavern: {
    name: 'Survivor Hall', short: 'Hall', icon: '🍺', unique: true, maxLevel: 25, unlockHQ: 1,
    desc: 'Where wanderers come looking for a home. Recruit heroes and raise their level cap.',
    cost: { food: 260, wood: 260, metal: 60 }, costRate: 1.41, time: 10, timeRate: 1.45,
    effect: (l) => ({ 'Hero level cap': heroCap(l) }),
  },
  alliance: {
    name: 'Alliance Hub', short: 'Hub', icon: '🤝', unique: true, maxLevel: 25, unlockHQ: 4,
    desc: 'Radio tower linking you to your alliance. More helps per request.',
    cost: { food: 300, wood: 400, metal: 120 }, costRate: 1.41, time: 12, timeRate: 1.45,
    effect: (l) => ({ 'Helps received': 3 + Math.floor(l / 2) }),
  },
  tower: {
    name: 'Sentry Tower', short: 'Tower', icon: '🗼', unique: true, maxLevel: 25, unlockHQ: 5,
    desc: 'Automated guns that fire on anything attacking the bastion.',
    cost: { food: 200, wood: 350, metal: 300, fuel: 40 }, costRate: 1.43, time: 16, timeRate: 1.47,
    effect: (l) => ({ 'Tower attack': Math.round(g(260, 1.3, l)) }),
  },
  forge: {
    name: 'Gear Forge', short: 'Forge', icon: '⚒️', unique: true, maxLevel: 25, unlockHQ: 7,
    desc: 'Forges and upgrades hero equipment from salvaged parts.',
    cost: { food: 300, wood: 400, metal: 400, fuel: 60 }, costRate: 1.43, time: 18, timeRate: 1.47,
    effect: (l) => ({ 'Best forge rarity': l >= 15 ? 'Legendary' : l >= 6 ? 'Epic' : 'Rare' }),
  },
  radar: {
    name: 'Watchtower', short: 'Watch', icon: '📡', unique: true, maxLevel: 25, unlockHQ: 8,
    desc: 'Long-range radio and spotters. Better scouting reports and march speed.',
    cost: { food: 300, wood: 400, metal: 350, fuel: 100 }, costRate: 1.43, time: 18, timeRate: 1.47,
    effect: (l) => ({ 'March speed': '+' + (l * 2) + '%' }),
  },
};

export function batch(l) { return 20 + l * 12; }
export function tierFor(l) { let t = 1; TIERS_BY_LEVEL.forEach((lv, i) => { if (l >= lv) t = i + 1; }); return t; }
export function hospitalCap(l) { return Math.round(400 * l * Math.pow(1.12, l - 1)); }
export function squadCap(l) { return 180 + l * 120; }
export function heroCap(l) { return Math.min(100, 10 + l * 4); }
export function marchSlots(hqLevel) { return 1 + (hqLevel >= 6 ? 1 : 0) + (hqLevel >= 12 ? 1 : 0) + (hqLevel >= 18 ? 1 : 0); }

export function buildingCost(type, lvl) {
  // lvl is the level being built/upgraded to
  const d = BUILDINGS[type];
  const out = {};
  for (const [res, base] of Object.entries(d.cost)) {
    if (res === 'metal' && lvl < 3 && type !== 'garage' && type !== 'tower' && type !== 'forge' && type !== 'radar' && type !== 'refinery') continue;
    if (res === 'fuel' && lvl < 8 && !['garage', 'tower', 'forge', 'radar'].includes(type)) continue;
    out[res] = r50(g(base, d.costRate, lvl));
  }
  return out;
}

export function buildingTime(type, lvl) {
  const d = BUILDINGS[type];
  return Math.round(g(d.time, d.timeRate, lvl));
}

export function buildingReqs(type, lvl) {
  const out = [];
  if (type === 'hq') {
    if (lvl >= 3) out.push({ b: 'wall', lvl: lvl - 1 });
    if (lvl >= 5) out.push({ b: 'research', lvl: lvl - 1 });
    if (lvl >= 8) out.push({ b: 'barracks', lvl: lvl - 1 });
    if (lvl >= 14) out.push({ b: 'hospital', lvl: lvl - 1 });
  } else {
    out.push({ b: 'hq', lvl: Math.max(lvl, BUILDINGS[type].unlockHQ) });
  }
  return out;
}

export function maxCountFor(type, hqLevel) {
  const d = BUILDINGS[type];
  if (d.unique) return hqLevel >= d.unlockHQ ? 1 : 0;
  const arr = d.maxCount;
  return arr[Math.min(arr.length - 1, Math.max(0, hqLevel - 1))];
}

export function productionPerHour(type, lvl) {
  const d = BUILDINGS[type];
  if (!d.produces || lvl <= 0) return 0;
  return prod(d.produces === 'food' || d.produces === 'wood' ? 620 : d.produces === 'metal' ? 260 : 120, lvl);
}

export function buildingPower(type, lvl) {
  return Math.round(lvl * lvl * (type === 'hq' ? 60 : 14));
}

// Fixed base layout on an isometric grid. Coordinates are tile centers.
// Unique buildings have fixed homes; resource plots accept farm/lumber/foundry/refinery.
export const BASE_LAYOUT = [
  { id: 'hq', type: 'hq', x: 10, y: 10, size: 3 },
  { id: 'wall', type: 'wall', x: 10, y: 3.2, size: 2 },
  { id: 'barracks', type: 'barracks', x: 6, y: 7, size: 2 },
  { id: 'range', type: 'range', x: 6, y: 10.2, size: 2 },
  { id: 'garage', type: 'garage', x: 6, y: 13.4, size: 2 },
  { id: 'hospital', type: 'hospital', x: 14, y: 7, size: 2 },
  { id: 'research', type: 'research', x: 14, y: 10.2, size: 2 },
  { id: 'warehouse', type: 'warehouse', x: 14, y: 13.4, size: 2 },
  { id: 'tavern', type: 'tavern', x: 10, y: 14.6, size: 2 },
  { id: 'drill', type: 'drill', x: 3, y: 4, size: 2 },
  { id: 'alliance', type: 'alliance', x: 17, y: 4, size: 2 },
  { id: 'tower', type: 'tower', x: 6.5, y: 3.6, size: 1.5 },
  { id: 'forge', type: 'forge', x: 13.5, y: 3.6, size: 1.5 },
  { id: 'radar', type: 'radar', x: 10, y: 18, size: 1.5 },
  // resource plots
  ...[[2.5, 9], [2.5, 12], [2.5, 15], [2.5, 18], [6, 17], [17.5, 9], [17.5, 12], [17.5, 15], [17.5, 18], [14, 17],
    [6, 20.5], [14, 20.5], [2.5, 21], [17.5, 21]]
    .map(([x, y], i) => ({ id: 'plot' + i, type: null, plot: true, x, y, size: 1.8 })),
];
export const RESOURCE_TYPES = ['farm', 'lumber', 'foundry', 'refinery'];
