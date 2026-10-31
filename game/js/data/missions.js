// Missions are driven by counters bumped through core/state.js `track(event, n)`.
// Daily/weekly counters reset; achievements read lifetime counters or derived values.
export const EVENTS = {
  build: 'Upgrade buildings', research: 'Complete research', train: 'Train troops', zombie: 'Defeat zombies on the map',
  collect: 'Collect resources', recruit: 'Recruit heroes', pve: 'Win campaign battles', arena: 'Fight in the Arena',
  gather: 'Gather on the world map', help: 'Help alliance members', heal: 'Heal wounded troops', heroLevel: 'Level up heroes',
  gems: 'Spend gems', donate: 'Donate to alliance tech', boss: 'Join alliance boss rallies', scout: 'Scout targets', raid: 'Defeat rival bases',
};

export const DAILY = [
  { id: 'd_collect', ev: 'collect', n: 5, pts: 10, reward: { food: 2000 } },
  { id: 'd_build', ev: 'build', n: 2, pts: 15, reward: { speed5m: 2 } },
  { id: 'd_train', ev: 'train', n: 100, pts: 15, reward: { food: 3000 } },
  { id: 'd_zombie', ev: 'zombie', n: 3, pts: 20, reward: { parts: 5 } },
  { id: 'd_research', ev: 'research', n: 1, pts: 15, reward: { wood: 3000 } },
  { id: 'd_pve', ev: 'pve', n: 2, pts: 15, reward: { xpSmall: 2 } },
  { id: 'd_arena', ev: 'arena', n: 2, pts: 15, reward: { gems: 30 } },
  { id: 'd_help', ev: 'help', n: 5, pts: 10, reward: { speed5m: 1 } },
  { id: 'd_gather', ev: 'gather', n: 1, pts: 15, reward: { metal: 1500 } },
  { id: 'd_recruit', ev: 'recruit', n: 1, pts: 10, reward: { manual: 2 } },
];
export const DAILY_CHESTS = [
  { pts: 20, reward: { food: 3000, wood: 3000 } },
  { pts: 40, reward: { speed5m: 3, gems: 20 } },
  { pts: 60, reward: { ticket: 1 } },
  { pts: 80, reward: { manual: 4, parts: 15 } },
  { pts: 100, reward: { gems: 80, eliteTicket: 1 } },
];
export const WEEKLY = [
  { id: 'w_build', ev: 'build', n: 15, reward: { speed1h: 3, gems: 50 } },
  { id: 'w_zombie', ev: 'zombie', n: 30, reward: { eliteTicket: 1, parts: 40 } },
  { id: 'w_train', ev: 'train', n: 2000, reward: { speed1h: 2, food: 20000 } },
  { id: 'w_research', ev: 'research', n: 8, reward: { speed1h: 3, wood: 20000 } },
  { id: 'w_arena', ev: 'arena', n: 15, reward: { gems: 150 } },
  { id: 'w_pve', ev: 'pve', n: 15, reward: { xpBig: 3, manual: 6 } },
  { id: 'w_boss', ev: 'boss', n: 3, reward: { eliteTicket: 1 } },
  { id: 'w_gather', ev: 'gather', n: 8, reward: { metalBox: 2, fuelBox: 1 } },
];

// Achievements: tiers on a lifetime counter (ev) or a derived value (calc)
export const ACHIEVEMENTS = [
  { id: 'a_hq', name: 'Rising Bastion', calc: 'hq', tiers: [3, 6, 10, 15, 20, 25], reward: (t) => ({ gems: 50 * (t + 1) }) },
  { id: 'a_power', name: 'Warlord', calc: 'power', tiers: [5000, 20000, 60000, 150000, 400000, 1000000], reward: (t) => ({ gems: 60 * (t + 1) }) },
  { id: 'a_zombie', name: 'Horde Breaker', ev: 'zombie', tiers: [10, 50, 200, 500, 1500], reward: (t) => ({ parts: 20 * (t + 1), gems: 30 }) },
  { id: 'a_heroes', name: 'Collector', calc: 'heroes', tiers: [5, 10, 15, 20, 25, 30], reward: (t) => ({ eliteTicket: 1, gems: 40 * t }) },
  { id: 'a_research', name: 'Mad Scientist', ev: 'research', tiers: [5, 20, 60, 120, 200], reward: (t) => ({ speed1h: 2 * (t + 1) }) },
  { id: 'a_train', name: 'Drill Sergeant', ev: 'train', tiers: [500, 5000, 25000, 100000], reward: (t) => ({ speed1h: 2 * (t + 1), gems: 40 }) },
  { id: 'a_stage', name: 'Campaigner', calc: 'stage', tiers: [5, 10, 20, 40, 60, 80], reward: (t) => ({ ticket: t + 1, gems: 50 }) },
  { id: 'a_arena', name: 'Gladiator', ev: 'arena', tiers: [5, 25, 100, 300], reward: (t) => ({ gems: 80 * (t + 1) }) },
  { id: 'a_gather', name: 'Scavenger', ev: 'gather', tiers: [5, 25, 100, 300], reward: (t) => ({ metalBox: t + 1, fuelBox: t }) },
  { id: 'a_raid', name: 'Reaver', ev: 'raid', tiers: [3, 15, 50, 150], reward: (t) => ({ gems: 70 * (t + 1) }) },
];

// Main story quests guide the early game. `check(s)` reads game state helpers.
export const STORY = [
  { text: 'Collect resources from a Hydro Farm', kind: 'ev', ev: 'collect', n: 1, reward: { food: 1500, wood: 1500 } },
  { text: 'Upgrade the Command Center to Lv 2', kind: 'bld', b: 'hq', lvl: 2, reward: { speed5m: 3, gems: 50 } },
  { text: 'Train 50 Wardens at the Barracks', kind: 'ev', ev: 'train', n: 50, reward: { food: 3000 } },
  { text: 'Recruit a hero at the Survivor Hall', kind: 'ev', ev: 'recruit', n: 1, reward: { ticket: 2 } },
  { text: 'Win campaign stage 1-2', kind: 'stage', n: 2, reward: { gems: 60, xpSmall: 3 } },
  { text: 'Build a second Lumber Yard', kind: 'count', b: 'lumber', n: 2, reward: { wood: 4000 } },
  { text: 'Upgrade the Barricade to Lv 2', kind: 'bld', b: 'wall', lvl: 2, reward: { speed5m: 4 } },
  { text: 'Upgrade the Command Center to Lv 3', kind: 'bld', b: 'hq', lvl: 3, reward: { gems: 80, metal: 1500 } },
  { text: 'Build the Research Lab', kind: 'bld', b: 'research', lvl: 1, reward: { speed5m: 4 } },
  { text: 'Research Hydroponics', kind: 'ev', ev: 'research', n: 1, reward: { food: 5000 } },
  { text: 'Defeat a zombie horde on the World Map', kind: 'ev', ev: 'zombie', n: 1, reward: { parts: 10, vigor20: 1 } },
  { text: 'Send a squad to gather a resource node', kind: 'ev', ev: 'gather', n: 1, reward: { metalBox: 1 } },
  { text: 'Join an alliance', kind: 'alliance', reward: { gems: 100 } },
  { text: 'Upgrade the Command Center to Lv 5', kind: 'bld', b: 'hq', lvl: 5, reward: { eliteTicket: 1, speed1h: 2 } },
  { text: 'Win an Arena battle', kind: 'ev', ev: 'arena', n: 1, reward: { gems: 100 } },
  { text: 'Clear chapter 1 boss (stage 1-10)', kind: 'stage', n: 10, reward: { eliteTicket: 1, manual: 5 } },
  { text: 'Raise a hero to 1 star', kind: 'star', n: 1, reward: { wildShard: 10 } },
  { text: 'Upgrade the Command Center to Lv 8', kind: 'bld', b: 'hq', lvl: 8, reward: { gems: 200, speed1h: 4 } },
  { text: 'Forge a piece of gear', kind: 'ev', ev: 'forge', n: 1, reward: { parts: 40 } },
  { text: 'Upgrade the Command Center to Lv 10', kind: 'bld', b: 'hq', lvl: 10, reward: { gems: 300, eliteTicket: 2 } },
  { text: 'Clear chapter 3 (stage 3-10)', kind: 'stage', n: 30, reward: { gems: 300, eliteTicket: 2 } },
  { text: 'Upgrade the Command Center to Lv 15', kind: 'bld', b: 'hq', lvl: 15, reward: { gems: 500, eliteTicket: 3 } },
];

export const LOGIN_REWARDS = [
  { gems: 50, food: 3000 }, { ticket: 1, wood: 3000 }, { speed5m: 5, gems: 50 }, { manual: 5, metal: 2000 },
  { eliteTicket: 1 }, { parts: 30, speed1h: 2 }, { gems: 300, eliteTicket: 1, wildShard: 20 },
];

// Rotating limited-time events (one week each, cycling through)
export const TIMED_EVENTS = [
  { id: 'horde', name: 'Night of the Horde', icon: '🧟', desc: 'Earn points by defeating zombies on the World Map and in the campaign.',
    score: { zombie: 30, pve: 20, boss: 60 }, milestones: [[200, { gems: 60 }], [600, { ticket: 2 }], [1200, { parts: 50 }], [2500, { eliteTicket: 1 }], [5000, { gems: 400, wildShard: 30 }]] },
  { id: 'builder', name: 'Rebuild the World', icon: '🏗️', desc: 'Earn points by upgrading buildings, finishing research and training troops.',
    score: { build: 40, research: 30, train: 0.2 }, milestones: [[200, { speed5m: 6 }], [600, { speed1h: 3 }], [1200, { gems: 150 }], [2500, { eliteTicket: 1 }], [5000, { gems: 400, speed8h: 2 }]] },
  { id: 'warpath', name: 'Warpath', icon: '⚔️', desc: 'Earn points by fighting in the Arena, raiding rival bases and joining alliance rallies.',
    score: { arena: 40, raid: 60, boss: 50, scout: 5 }, milestones: [[200, { gems: 60 }], [600, { manual: 8 }], [1200, { xpBig: 4 }], [2500, { eliteTicket: 1 }], [5000, { gems: 400, eliteTicket: 2 }]] },
];
