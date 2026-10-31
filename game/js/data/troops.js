// Troops: three classes with a rock-paper-scissors counter loop and five tiers.
// Infantry > Vehicle > Ranged > Infantry  (+30% damage when countering)

export const TROOP_TYPES = {
  infantry: { name: 'Wardens', building: 'barracks', icon: '🛡️', color: '#c9a35b', strong: 'vehicle',
    base: { atk: 9, def: 14, hp: 70, load: 12, power: 3 }, cost: { food: 60, wood: 30 }, time: 4 },
  ranged: { name: 'Marksmen', building: 'range', icon: '🎯', color: '#6fb8d6', strong: 'infantry',
    base: { atk: 14, def: 8, hp: 48, load: 8, power: 3 }, cost: { food: 40, wood: 60 }, time: 4.5 },
  vehicle: { name: 'Outriders', building: 'garage', icon: '🚙', color: '#d8743c', strong: 'ranged',
    base: { atk: 12, def: 12, hp: 60, load: 18, power: 4 }, cost: { food: 40, wood: 30, metal: 40 }, time: 6 },
};
export const COUNTER_BONUS = 0.3;
export const TIER_NAMES = ['Recruit', 'Veteran', 'Elite', 'Vanguard', 'Apex'];

export function troopKey(type, tier) { return type + tier; }
export function parseTroopKey(k) { return { type: k.slice(0, -1), tier: +k.slice(-1) }; }

export function troopStats(type, tier) {
  const b = TROOP_TYPES[type].base, m = Math.pow(1.55, tier - 1);
  return { atk: b.atk * m, def: b.def * m, hp: b.hp * m, load: Math.round(b.load * (1 + 0.25 * (tier - 1))), power: Math.round(b.power * Math.pow(1.7, tier - 1)) };
}
export function troopCost(type, tier) {
  const c = TROOP_TYPES[type].cost, m = Math.pow(1.6, tier - 1), out = {};
  for (const [k, v] of Object.entries(c)) out[k] = Math.round(v * m);
  if (tier >= 3) out.metal = (out.metal || 0) + Math.round(15 * m);
  if (tier >= 4) out.fuel = Math.round(8 * m);
  return out;
}
export function troopTime(type, tier) { return TROOP_TYPES[type].time * Math.pow(1.45, tier - 1); }
export function healCost(type, tier) {
  const c = troopCost(type, tier), out = {};
  for (const [k, v] of Object.entries(c)) out[k] = Math.ceil(v * 0.35);
  return out;
}
