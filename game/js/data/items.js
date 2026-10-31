// Inventory items, equipment, shop
export const ITEMS = {
  speed5m:   { name: '5-min Speedup', icon: '⏩', kind: 'speed', sec: 300, desc: 'Reduces any timer by 5 minutes.' },
  speed1h:   { name: '1-hour Speedup', icon: '⏩', kind: 'speed', sec: 3600, desc: 'Reduces any timer by 1 hour.' },
  speed8h:   { name: '8-hour Speedup', icon: '⏩', kind: 'speed', sec: 28800, desc: 'Reduces any timer by 8 hours.' },
  ticket:    { name: 'Recruit Ticket', icon: '🎫', kind: 'ticket', desc: 'One hero recruitment.' },
  eliteTicket: { name: 'Elite Ticket', icon: '🎟️', kind: 'ticket', desc: 'One elite recruitment (higher legendary odds).' },
  manual:    { name: 'Skill Manual', icon: '📘', kind: 'mat', desc: 'Upgrades hero skills.' },
  xpSmall:   { name: 'Field Notes', icon: '📒', kind: 'xp', xp: 500, desc: '+500 hero XP.' },
  xpBig:     { name: 'War Journal', icon: '📕', kind: 'xp', xp: 5000, desc: '+5,000 hero XP.' },
  parts:     { name: 'Gear Parts', icon: '🔧', kind: 'mat', desc: 'Used to forge and upgrade equipment.' },
  wildShard: { name: 'Universal Shard', icon: '✴️', kind: 'mat', desc: 'Counts as one shard of any Epic or Rare hero.' },
  vigor20:   { name: 'Energy Drink', icon: '🥤', kind: 'vigor', amount: 20, desc: 'Restores 20 Vigor.' },
  shield8h:  { name: 'Peace Shield (8h)', icon: '🛡️', kind: 'shield', sec: 28800, desc: 'Rivals cannot attack your base for 8 hours.' },
  foodBox:   { name: 'Food Crate', icon: '🥫', kind: 'res', res: 'food', amount: 10000, desc: '+10,000 Food.' },
  woodBox:   { name: 'Wood Crate', icon: '🪵', kind: 'res', res: 'wood', amount: 10000, desc: '+10,000 Wood.' },
  metalBox:  { name: 'Metal Crate', icon: '⚙️', kind: 'res', res: 'metal', amount: 4000, desc: '+4,000 Metal.' },
  fuelBox:   { name: 'Fuel Crate', icon: '🛢️', kind: 'res', res: 'fuel', amount: 2000, desc: '+2,000 Fuel.' },
  relocate:  { name: 'Relocator', icon: '🧭', kind: 'relocate', desc: 'Move your base to a random safe spot on the map.' },
};

export const GEAR_SLOTS = ['weapon', 'armor', 'helmet', 'boots'];
export const GEAR_SLOT_INFO = {
  weapon: { name: 'Weapon', icon: '🗡️', stat: 'atk', base: 40 },
  armor:  { name: 'Armor',  icon: '🦺', stat: 'def', base: 30 },
  helmet: { name: 'Helmet', icon: '⛑️', stat: 'hp',  base: 420 },
  boots:  { name: 'Boots',  icon: '🥾', stat: 'atk', base: 22, second: 'def', secondBase: 16 },
};
export const GEAR_RARITY = {
  R: { name: 'Rare', mult: 1, color: '#4f9cff', maxLvl: 20 },
  SR: { name: 'Epic', mult: 1.6, color: '#b06bff', maxLvl: 30 },
  SSR: { name: 'Legendary', mult: 2.5, color: '#ffb321', maxLvl: 40 },
};
const GEAR_NAMES = {
  weapon: ['Rebar Club', 'Scoped Carbine', 'Thermite Lance'],
  armor: ['Tire-Plate Vest', 'Kevlar Weave', 'Exo-Rig Plating'],
  helmet: ['Welder Mask', 'Riot Helm', 'Night-Vision Crown'],
  boots: ['Duct-Tape Boots', 'Runner Treads', 'Mag-Grip Striders'],
};
export function gearName(slot, rarity) { return GEAR_NAMES[slot][['R', 'SR', 'SSR'].indexOf(rarity)]; }
export function gearStats(g) {
  const s = GEAR_SLOT_INFO[g.slot], r = GEAR_RARITY[g.rarity], m = r.mult * (1 + 0.12 * (g.lvl - 1));
  const out = { [s.stat]: Math.round(s.base * m) };
  if (s.second) out[s.second] = Math.round(s.secondBase * m);
  return out;
}
export function gearUpgradeCost(g) { return Math.ceil(3 * Math.pow(g.lvl, 1.35) * GEAR_RARITY[g.rarity].mult); } // parts
export function forgeCost(rarity) { return { R: { parts: 20, metal: 2000 }, SR: { parts: 80, metal: 12000 }, SSR: { parts: 300, metal: 60000, fuel: 20000 } }[rarity]; }

export const SHOP = [
  { id: 's_speed1h', item: 'speed1h', qty: 1, gems: 60, daily: 10 },
  { id: 's_speed8h', item: 'speed8h', qty: 1, gems: 420, daily: 3 },
  { id: 's_ticket', item: 'ticket', qty: 1, gems: 150, daily: 10 },
  { id: 's_elite', item: 'eliteTicket', qty: 1, gems: 450, daily: 5 },
  { id: 's_manual', item: 'manual', qty: 5, gems: 100, daily: 10 },
  { id: 's_xp', item: 'xpBig', qty: 1, gems: 120, daily: 10 },
  { id: 's_parts', item: 'parts', qty: 30, gems: 150, daily: 10 },
  { id: 's_vigor', item: 'vigor20', qty: 1, gems: 50, daily: 5 },
  { id: 's_shield', item: 'shield8h', qty: 1, gems: 250, daily: 2 },
  { id: 's_food', item: 'foodBox', qty: 1, gems: 80, daily: 20 },
  { id: 's_wood', item: 'woodBox', qty: 1, gems: 80, daily: 20 },
  { id: 's_metal', item: 'metalBox', qty: 1, gems: 90, daily: 20 },
  { id: 's_fuel', item: 'fuelBox', qty: 1, gems: 100, daily: 20 },
  { id: 's_reloc', item: 'relocate', qty: 1, gems: 300, daily: 2 },
];
