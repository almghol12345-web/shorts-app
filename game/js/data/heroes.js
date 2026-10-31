// 30 original heroes. Portrait params feed the procedural portrait painter (render/art.js).
// Skill kinds understood by the combat engine (core/combat.js):
//   active : strike, barrage, pierce, heal, shield, rally, stun, execute, drain, taunt, weaken
//   passive: { stat: atk|def|hp|crit, pct }
//   command: { troop: infantry|ranged|vehicle|all, stat, pct }  (buff the hero's own squad)

const H = (id, name, title, rarity, role, troop, quote, bio, look, active, passive, command) =>
  ({ id, name, title, rarity, role, troop, quote, bio, look, skills: [active, passive, command] });
const A = (name, kind, v, desc) => ({ slot: 'active', name, kind, ...v, desc });
const P = (name, stat, pct, desc) => ({ slot: 'passive', name, stat, pct, desc });
const C = (name, troop, stat, pct, desc) => ({ slot: 'command', name, troop, stat, pct, desc });
// look: [skin, hair, hairStyle, outfit, accessory, bgHue]
export const HEROES = [
  // ---------------- Legendary ----------------
  H('vex', 'Vex Marrow', 'The Rust Baron', 'SSR', 'damage', 'vehicle', 'Engines don\'t lie. People do.', 'Former demolition-derby champion who welded the first armored convoy out of school buses.',
    ['#c58c63', '#2b1b14', 3, '#6d2f20', 'goggles', 18],
    A('Ramjet Charge', 'barrage', { mult: 1.6 }, 'Rams every enemy squad for 160% damage.'),
    P('Nitro Heart', 'atk', 0.12, '+12% attack.'), C('Convoy Doctrine', 'vehicle', 'atk', 0.15, 'Vehicles in this squad deal +15% damage.')),
  H('ingrid', 'Ingrid Solace', 'Saint of Ward 9', 'SSR', 'support', 'ranged', 'No one bleeds out on my watch.', 'Ran the last working ICU in the city for 400 days on generator power.',
    ['#f1d3bf', '#e8dcc6', 1, '#e8ecef', 'cross', 190],
    A('Triage Wave', 'heal', { mult: 2.4, all: true }, 'Heals all allies for 240% of attack.'),
    P('Steady Hands', 'hp', 0.15, '+15% HP.'), C('Field Dressing', 'all', 'hp', 0.10, 'This squad gains +10% HP.')),
  H('kael', 'Kael Ashborne', 'The Unburnt', 'SSR', 'tank', 'infantry', 'Stand behind me. Always.', 'Firefighter who walked out of the refinery blaze that took his whole crew.',
    ['#9c6b4a', '#111', 0, '#a2412a', 'helmet', 8],
    A('Firewall', 'taunt', { def: 0.5, dur: 4 }, 'Draws all fire for 4 turns and gains +50% defense.'),
    P('Scorched Skin', 'def', 0.18, '+18% defense.'), C('Shield Brothers', 'infantry', 'def', 0.15, 'Infantry in this squad gain +15% defense.')),
  H('nyx', 'Nyx Halloran', 'Night Owl', 'SSR', 'damage', 'ranged', 'One breath. One shot.', 'Olympic biathlete turned rooftop sniper. Has never missed a horde leader.',
    ['#e3b99b', '#3b3f8f', 4, '#22263a', 'hood', 240],
    A('Moonshot', 'execute', { mult: 2.8 }, 'Deals 280% damage, doubled against targets under 40% HP.'),
    P('Dead Eye', 'crit', 0.15, '+15% critical chance.'), C('Overwatch', 'ranged', 'atk', 0.15, 'Ranged troops in this squad deal +15% damage.')),
  H('ezra', 'Dr. Ezra Vane', 'The Chemist', 'SSR', 'support', 'ranged', 'Every plague has a cure. Every cure has a cost.', 'Virologist who was in the lab when the outbreak began — and may know why.',
    ['#d9a985', '#777', 2, '#3d6b4c', 'glasses', 140],
    A('Nerve Agent', 'weaken', { pct: 0.25, dur: 3, mult: 1.0 }, 'Hits all enemies for 100% and cuts their attack by 25% for 3 turns.'),
    P('Antidote', 'hp', 0.12, '+12% HP.'), C('Stimulants', 'all', 'atk', 0.10, 'This squad deals +10% damage.')),
  H('tamsin', 'Tamsin Rook', 'Crow Queen', 'SSR', 'damage', 'ranged', 'Crows always find the dead first.', 'Leader of the Rookery scavenger gang; signals her snipers with trained crows.',
    ['#b5835a', '#0d0d0d', 5, '#2b2b2b', 'feather', 280],
    A('Murder of Crows', 'pierce', { mult: 2.2 }, 'Strikes the enemy back line for 220% damage.'),
    P('Carrion Sense', 'atk', 0.12, '+12% attack.'), C('Rookery Volley', 'ranged', 'atk', 0.12, 'Ranged troops in this squad deal +12% damage.')),
  H('grav', 'Grav Okonkwo', 'The Wrecking Ball', 'SSR', 'damage', 'infantry', 'Swing first. Ask never.', 'Heavyweight boxer who carries a sledgehammer made from a bridge rivet.',
    ['#5a3a28', '#111', 6, '#7a5a2a', 'beard', 30],
    A('Earthbreaker', 'stun', { mult: 2.0, dur: 2 }, 'Smashes a target for 200% damage and stuns it for 2 turns.'),
    P('Iron Jaw', 'hp', 0.15, '+15% HP.'), C('Brawler Code', 'infantry', 'atk', 0.15, 'Infantry in this squad deal +15% damage.')),
  H('sable', 'Sable Quinn', 'Iron Widow', 'SSR', 'tank', 'vehicle', 'My tank has a name. Yours will be forgotten.', 'Army tanker who drove her APC home through three states of infected.',
    ['#e6c1a1', '#7a1e1e', 1, '#3c4a2c', 'beret', 95],
    A('Armor Plating', 'shield', { pct: 0.22 }, 'Shields every ally for 22% of max HP.'),
    P('Reactive Hull', 'def', 0.15, '+15% defense.'), C('Steel Column', 'vehicle', 'hp', 0.15, 'Vehicles in this squad gain +15% HP.')),
  // ---------------- Epic ----------------
  H('rhett', 'Rhett Calder', 'Dust Marshal', 'SR', 'damage', 'ranged', 'Law\'s dead. I\'m what\'s left.', 'County sheriff who still pins the badge on every morning.',
    ['#c99472', '#5a3b22', 2, '#8a6a3a', 'hat', 35],
    A('Six Shooter', 'strike', { mult: 2.6 }, 'Fires on one enemy for 260% damage.'),
    P('Quick Draw', 'crit', 0.10, '+10% critical chance.'), C('Posse', 'ranged', 'atk', 0.10, 'Ranged troops in this squad deal +10% damage.')),
  H('mira', 'Mira Voss', 'Wire Witch', 'SR', 'support', 'ranged', 'Give me a battery and I\'ll give you a miracle.', 'Electrical engineer who rewired a dead city block into a fortress grid.',
    ['#f0c9a8', '#1c6f75', 4, '#283846', 'headset', 180],
    A('Tesla Net', 'stun', { mult: 1.2, dur: 1, all: true }, 'Shocks all enemies for 120% damage; may stun.'),
    P('Grounded', 'def', 0.10, '+10% defense.'), C('Overclock', 'all', 'atk', 0.08, 'This squad deals +8% damage.')),
  H('juno', 'Juno Barrow', 'The Gravedigger', 'SR', 'tank', 'infantry', 'I bury them so they stay buried.', 'Cemetery groundskeeper. First to realize the dead were digging out.',
    ['#d8a983', '#4a4a4a', 0, '#4b4032', 'scar', 60],
    A('Shovel Guard', 'taunt', { def: 0.35, dur: 3 }, 'Taunts enemies for 3 turns with +35% defense.'),
    P('Grave Dirt', 'hp', 0.12, '+12% HP.'), C('Dig In', 'infantry', 'def', 0.12, 'Infantry in this squad gain +12% defense.')),
  H('dario', 'Dario Flint', 'Sparks', 'SR', 'damage', 'vehicle', 'Boom is a love language.', 'Fireworks smuggler who now builds mortar buggies.',
    ['#c48a5f', '#d24a1a', 3, '#913e1c', 'bandana', 15],
    A('Fireworks Finale', 'barrage', { mult: 1.3 }, 'Rains explosives on all enemies for 130% damage.'),
    P('Short Fuse', 'atk', 0.10, '+10% attack.'), C('Hot Rods', 'vehicle', 'atk', 0.10, 'Vehicles in this squad deal +10% damage.')),
  H('ostara', 'Ostara Lin', 'Green Thumb', 'SR', 'support', 'infantry', 'Things still grow. So can we.', 'Botanist who keeps the bastion\'s hydro farms alive.',
    ['#f2d2b6', '#2f6b2f', 1, '#56733a', 'flower', 110],
    A('Herbal Poultice', 'heal', { mult: 3.2 }, 'Heals the weakest ally for 320% of attack.'),
    P('Photosynthesis', 'hp', 0.12, '+12% HP.'), C('Harvest Ration', 'all', 'hp', 0.08, 'This squad gains +8% HP.')),
  H('hollis', 'Hollis Crane', 'Skyhook', 'SR', 'damage', 'ranged', 'Height is the only safe place.', 'Construction crane operator turned crow\'s-nest gunner.',
    ['#e0b391', '#a87b3b', 2, '#c49a2d', 'helmet', 45],
    A('High Ground', 'pierce', { mult: 1.9 }, 'Hits the enemy back line for 190% damage.'),
    P('Vertigo-Free', 'atk', 0.08, '+8% attack.'), C('Spotters', 'ranged', 'atk', 0.10, 'Ranged troops in this squad deal +10% damage.')),
  H('petra', 'Petra Ironwood', 'Lumberjill', 'SR', 'tank', 'infantry', 'Timber!', 'Logger whose chainsaw has felled more walkers than trees.',
    ['#d79c74', '#b8541f', 5, '#7b2b2b', 'none', 0],
    A('Clear Cut', 'drain', { mult: 1.8 }, 'Saws an enemy for 180% damage, healing for half.'),
    P('Heartwood', 'hp', 0.14, '+14% HP.'), C('Timberline', 'infantry', 'hp', 0.12, 'Infantry in this squad gain +12% HP.')),
  H('silas', 'Silas Grey', 'The Quartermaster', 'SR', 'support', 'vehicle', 'An army marches on spare parts.', 'Retired logistics officer who knows where every crate in the city is buried.',
    ['#caa085', '#bbbbbb', 0, '#45523a', 'glasses', 70],
    A('Resupply', 'rally', { pct: 0.25, dur: 3 }, 'All allies deal +25% damage for 3 turns.'),
    P('Inventory', 'def', 0.10, '+10% defense.'), C('Supply Lines', 'vehicle', 'def', 0.12, 'Vehicles in this squad gain +12% defense.')),
  H('zuri', 'Zuri Banks', 'Hurricane', 'SR', 'damage', 'infantry', 'You blinked.', 'Parkour runner who delivers messages between bastions — and knives to the dead.',
    ['#6b4430', '#111', 4, '#1f5c63', 'bandana', 170],
    A('Whirlwind', 'barrage', { mult: 1.2 }, 'Spins through all enemies for 120% damage.'),
    P('Fleet Foot', 'crit', 0.10, '+10% critical chance.'), C('Runners', 'infantry', 'atk', 0.10, 'Infantry in this squad deal +10% damage.')),
  H('cobalt', 'Cobalt', 'Ghost Signal', 'SR', 'damage', 'vehicle', '[static] ...target acquired.', 'A masked drone pilot nobody has seen unmasked. Communicates by radio only.',
    ['#d9b59a', '#2a4c8f', 6, '#1a2440', 'mask', 220],
    A('Drone Swarm', 'pierce', { mult: 1.8 }, 'Drones dive the back line for 180% damage.'),
    P('Encrypted', 'def', 0.10, '+10% defense.'), C('Remote Ops', 'vehicle', 'atk', 0.10, 'Vehicles in this squad deal +10% damage.')),
  H('lena', 'Lena Frost', 'Cold Snap', 'SR', 'support', 'ranged', 'Stay calm. Stay cold.', 'Arctic researcher who brought her cryo-rifle south when the stations fell.',
    ['#f5dccb', '#e8f2ff', 1, '#4f8fb8', 'scarf', 200],
    A('Flash Freeze', 'weaken', { pct: 0.2, dur: 3, mult: 0.8 }, 'Chills all enemies for 80% and cuts attack by 20%.'),
    P('Permafrost', 'def', 0.12, '+12% defense.'), C('Frostbite', 'ranged', 'atk', 0.08, 'Ranged troops in this squad deal +8% damage.')),
  // ---------------- Rare ----------------
  H('brick', 'Brick Dunmore', 'The Wall', 'R', 'tank', 'infantry', 'Hit me again. I dare you.', 'Bouncer from a dive bar that never closed.',
    ['#d49a7a', '#3a2a1a', 0, '#5a5a5a', 'beard', 25],
    A('Brace', 'taunt', { def: 0.25, dur: 3 }, 'Taunts enemies for 3 turns with +25% defense.'),
    P('Thick Skull', 'hp', 0.10, '+10% HP.'), C('Hold the Line', 'infantry', 'def', 0.08, 'Infantry in this squad gain +8% defense.')),
  H('wren', 'Wren Tally', 'Pocket Scout', 'R', 'damage', 'ranged', 'I counted forty. Now thirty-nine.', 'Teenage scout who keeps a tally of every walker on her slingshot.',
    ['#f2c7a5', '#c9772e', 2, '#6a7d3a', 'cap', 90],
    A('Ricochet', 'strike', { mult: 2.0 }, 'Hits one enemy for 200% damage.'),
    P('Sharp Eyes', 'crit', 0.08, '+8% critical chance.'), C('Pathfinder', 'ranged', 'atk', 0.06, 'Ranged troops in this squad deal +6% damage.')),
  H('moss', 'Moss Harlan', 'Swamp Rat', 'R', 'damage', 'infantry', 'Mud hides everything.', 'Bayou trapper. Smells like the swamp, fights like it too.',
    ['#b07a55', '#3d4a2a', 3, '#3f4f2a', 'hat', 80],
    A('Snare Trap', 'stun', { mult: 1.4, dur: 1 }, 'Traps one enemy for 140% damage and stuns it.'),
    P('Camouflage', 'def', 0.08, '+8% defense.'), C('Ambushers', 'infantry', 'atk', 0.06, 'Infantry in this squad deal +6% damage.')),
  H('tilly', 'Tilly Spark', 'Battery Girl', 'R', 'support', 'vehicle', 'Charged and ready!', 'Kid mechanic who can jumpstart anything with a potato and copper wire.',
    ['#f6d4b8', '#f2c94c', 4, '#d9822b', 'goggles', 50],
    A('Jumpstart', 'rally', { pct: 0.15, dur: 3 }, 'All allies deal +15% damage for 3 turns.'),
    P('Spare Cells', 'hp', 0.08, '+8% HP.'), C('Tune-Up', 'vehicle', 'hp', 0.06, 'Vehicles in this squad gain +6% HP.')),
  H('gunnar', 'Gunnar Pike', 'Ice Road', 'R', 'tank', 'vehicle', 'Eighteen wheels and no brakes.', 'Long-haul trucker who turned his rig into a rolling barricade.',
    ['#e2b08e', '#c9a46b', 0, '#2e4a6b', 'cap', 210],
    A('Jackknife', 'shield', { pct: 0.12 }, 'Shields every ally for 12% of max HP.'),
    P('Big Rig', 'hp', 0.10, '+10% HP.'), C('Road Train', 'vehicle', 'def', 0.08, 'Vehicles in this squad gain +8% defense.')),
  H('ash', 'Ash Delaney', 'Cinder', 'R', 'damage', 'vehicle', 'Light \'em up.', 'Flamethrower-wielding ex-pest controller.',
    ['#d6a080', '#222', 3, '#8b5a2b', 'mask', 10],
    A('Torch Run', 'barrage', { mult: 0.9 }, 'Burns all enemies for 90% damage.'),
    P('Fireproof', 'def', 0.08, '+8% defense.'), C('Exhaust Burn', 'vehicle', 'atk', 0.06, 'Vehicles in this squad deal +6% damage.')),
  H('ruby', 'Ruby Kincaid', 'Bandit Queen', 'R', 'damage', 'ranged', 'Your stash looks lonely.', 'Charming highway robber who switched sides when raiders took her brother.',
    ['#eec3a3', '#9b1d2a', 5, '#5a1f2a', 'eyepatch', 340],
    A('Pickpocket', 'drain', { mult: 1.6 }, 'Steals vitality: 160% damage, heals half.'),
    P('Lucky Coin', 'crit', 0.08, '+8% critical chance.'), C('Outlaws', 'ranged', 'atk', 0.06, 'Ranged troops in this squad deal +6% damage.')),
  H('felix', 'Felix Orr', 'The Medic', 'R', 'support', 'infantry', 'Hold still, this will sting.', 'Paramedic with a battered ambulance and an endless supply of bad jokes.',
    ['#e5b897', '#6b4423', 2, '#e2e2e2', 'cross', 0],
    A('Patch Up', 'heal', { mult: 2.4 }, 'Heals the weakest ally for 240% of attack.'),
    P('Bedside Manner', 'hp', 0.08, '+8% HP.'), C('First Aid', 'all', 'hp', 0.05, 'This squad gains +5% HP.')),
  H('hana', 'Hana Mori', 'Silent Blade', 'R', 'damage', 'infantry', '...', 'Kendo instructor who speaks only through her blade.',
    ['#f0d0b4', '#111', 1, '#2a2a3a', 'none', 300],
    A('Iaido', 'execute', { mult: 2.0 }, 'Deals 200% damage, doubled on wounded targets.'),
    P('Focus', 'atk', 0.08, '+8% attack.'), C('Dojo', 'infantry', 'atk', 0.06, 'Infantry in this squad deal +6% damage.')),
  H('bo', 'Bo Strand', 'Driftwood', 'R', 'tank', 'ranged', 'Fish don\'t bite. Neither do I. Mostly.', 'Old fisherman who defends the docks with a harpoon gun.',
    ['#b98a66', '#ddd', 0, '#2f5d6b', 'beard', 195],
    A('Harpoon Reel', 'stun', { mult: 1.2, dur: 1 }, 'Harpoons an enemy for 120% and stuns it.'),
    P('Sea Legs', 'def', 0.10, '+10% defense.'), C('Dockhands', 'ranged', 'hp', 0.08, 'Ranged troops in this squad gain +8% HP.')),
  H('cass', 'Cass Ember', 'Matchstick', 'R', 'support', 'ranged', 'Every fire starts small.', 'Signal-flare specialist who keeps convoys from getting lost.',
    ['#e9be9c', '#e36414', 4, '#6a3d2a', 'scarf', 20],
    A('Signal Flare', 'weaken', { pct: 0.12, dur: 2, mult: 0.6 }, 'Blinds all enemies: 60% damage, -12% attack.'),
    P('Kindling', 'atk', 0.06, '+6% attack.'), C('Beacon', 'all', 'atk', 0.05, 'This squad deals +5% damage.')),
];

export const HERO_BY_ID = Object.fromEntries(HEROES.map((h) => [h.id, h]));

export const ROLE_INFO = {
  tank: { name: 'Tank', icon: '🛡️', mods: { atk: 0.8, def: 1.35, hp: 1.4 } },
  damage: { name: 'Damage', icon: '⚔️', mods: { atk: 1.3, def: 0.9, hp: 0.9 } },
  support: { name: 'Support', icon: '✚', mods: { atk: 1.0, def: 1.05, hp: 1.05 } },
};

export const STAR_SHARDS = [10, 20, 40, 80, 120]; // shards needed for star 1..5
export const SKILL_UNLOCK = { active: 0, passive: 1, command: 3 }; // stars required
export const SKILL_MAX = 5;
export function skillUpgradeCost(lvl) { return 2 * lvl * lvl; } // skill manuals
export function heroXpFor(level) { return Math.round(60 * Math.pow(level, 1.6)); }
export function heroBaseStats(def) {
  const rm = { R: 1, SR: 1.28, SSR: 1.65 }[def.rarity];
  const m = ROLE_INFO[def.role].mods;
  return { atk: 120 * rm * m.atk, def: 90 * rm * m.def, hp: 1200 * rm * m.hp };
}
// Duplicate pulls convert into shards
export const DUP_SHARDS = { R: 10, SR: 20, SSR: 40 };
