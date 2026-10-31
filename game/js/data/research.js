// Technology tree. Each node: max level, per-level effect, prerequisites, lab level needed.
// Effect keys are consumed by core/bonuses.js.
const N = (id, branch, name, icon, effect, per, max, lab, pre, x, y, desc) => ({ id, branch, name, icon, effect, per, max, lab, pre, x, y, desc });

export const BRANCHES = { economy: 'Economy', military: 'Military', defense: 'Defense & Field' };

export const RESEARCH = [
  // ---- Economy ----
  N('agri', 'economy', 'Hydroponics', '🌱', 'prod_food', 0.05, 10, 1, [], 0, 0, 'Food production'),
  N('forest', 'economy', 'Sawmill Rigs', '🪓', 'prod_wood', 0.05, 10, 1, [], 1, 0, 'Wood production'),
  N('constr', 'economy', 'Prefab Building', '🏗️', 'build_speed', 0.03, 10, 2, ['agri:2', 'forest:2'], 0.5, 1, 'Construction speed'),
  N('metal', 'economy', 'Smelting', '⚙️', 'prod_metal', 0.05, 10, 3, ['forest:3'], 1, 2, 'Metal production'),
  N('science', 'economy', 'Scientific Method', '🧪', 'research_speed', 0.03, 10, 3, ['constr:2'], 0, 2, 'Research speed'),
  N('fuel', 'economy', 'Cracking Towers', '🛢️', 'prod_fuel', 0.05, 10, 6, ['metal:3'], 1, 3, 'Fuel production'),
  N('gather', 'economy', 'Scavenger Routes', '🧭', 'gather_speed', 0.06, 10, 4, ['science:2'], 0, 3, 'World gathering speed'),
  N('vault', 'economy', 'Hidden Caches', '📦', 'protect', 0.08, 10, 5, ['gather:2'], 0.5, 4, 'Plunder-protected resources'),
  N('load', 'economy', 'Cargo Racks', '🎒', 'load', 0.06, 10, 7, ['vault:2', 'fuel:2'], 0.5, 5, 'Troop carry capacity'),
  // ---- Military ----
  N('inf_atk', 'military', 'Warden Drills', '🛡️', 'infantry_atk', 0.03, 10, 2, [], 0, 0, 'Infantry attack'),
  N('rng_atk', 'military', 'Marksmanship', '🎯', 'ranged_atk', 0.03, 10, 2, [], 1, 0, 'Ranged attack'),
  N('veh_atk', 'military', 'Ram Plating', '🚙', 'vehicle_atk', 0.03, 10, 5, [], 2, 0, 'Vehicle attack'),
  N('inf_def', 'military', 'Riot Gear', '🦺', 'infantry_def', 0.03, 10, 3, ['inf_atk:2'], 0, 1, 'Infantry defense'),
  N('rng_def', 'military', 'Ghillie Suits', '🌿', 'ranged_def', 0.03, 10, 3, ['rng_atk:2'], 1, 1, 'Ranged defense'),
  N('veh_def', 'military', 'Roll Cages', '🔩', 'vehicle_def', 0.03, 10, 6, ['veh_atk:2'], 2, 1, 'Vehicle defense'),
  N('train', 'military', 'Boot Camp', '⏱️', 'train_speed', 0.04, 10, 4, ['inf_def:1', 'rng_def:1'], 0.5, 2, 'Training speed'),
  N('hp_all', 'military', 'Combat Rations', '🥩', 'troop_hp', 0.03, 10, 6, ['train:2'], 1.5, 2, 'All troops HP'),
  N('march', 'military', 'Squad Tactics', '🎖️', 'march_size', 0.04, 10, 8, ['hp_all:3'], 1, 3, 'Troops per squad'),
  N('atk_all', 'military', 'War Doctrine', '⚔️', 'troop_atk', 0.03, 10, 10, ['march:3'], 1, 4, 'All troops attack'),
  // ---- Defense & Field ----
  N('fort', 'defense', 'Fortification', '🧱', 'wall_hp', 0.08, 10, 2, [], 0, 0, 'Wall durability'),
  N('sentry', 'defense', 'Auto-Turrets', '🗼', 'tower_atk', 0.08, 10, 5, ['fort:2'], 1, 0, 'Tower attack'),
  N('medic', 'defense', 'Triage Protocol', '🩺', 'hospital', 0.08, 10, 3, ['fort:1'], 0, 1, 'Hospital capacity'),
  N('hunter', 'defense', 'Horde Hunter', '🧟', 'zombie_dmg', 0.04, 10, 3, [], 1, 1, 'Damage vs zombies'),
  N('vigor', 'defense', 'Adrenaline', '⚡', 'vigor_regen', 0.06, 5, 4, ['hunter:2'], 1, 2, 'Vigor regeneration'),
  N('speed', 'defense', 'Road Clearing', '🛣️', 'march_speed', 0.05, 10, 4, ['medic:2'], 0, 2, 'March speed'),
  N('heal', 'defense', 'Rapid Recovery', '💉', 'heal_speed', 0.06, 10, 7, ['medic:3'], 0, 3, 'Healing cost reduction'),
  N('boss', 'defense', 'Behemoth Studies', '☣️', 'boss_dmg', 0.05, 10, 9, ['hunter:4', 'vigor:2'], 1, 3, 'Damage vs bosses'),
];
export const RESEARCH_BY_ID = Object.fromEntries(RESEARCH.map((r) => [r.id, r]));

export function researchCost(node, lvl) { // lvl = level being researched
  const m = Math.pow(1.55, lvl - 1) * (1 + node.lab * 0.35);
  const c = { food: Math.round(300 * m / 50) * 50, wood: Math.round(300 * m / 50) * 50 };
  if (node.lab >= 3 || lvl >= 4) c.metal = Math.round(140 * m / 50) * 50;
  if (node.lab >= 6 || lvl >= 7) c.fuel = Math.round(60 * m / 50) * 50;
  return c;
}
export function researchTime(node, lvl) { return Math.round(25 * Math.pow(1.62, lvl - 1) * (1 + node.lab * 0.4)); }
