// Zombie and raider squads used by PvE, the world map and events.
export const ZOMBIE_KINDS = {
  walker:  { name: 'Walkers',  icon: '🧟', atk: 1.0, def: 0.8, hp: 1.1, color: '#7d9a5a' },
  runner:  { name: 'Runners',  icon: '🏃', atk: 1.25, def: 0.6, hp: 0.8, color: '#a8b95a' },
  brute:   { name: 'Brutes',   icon: '🦍', atk: 0.9, def: 1.3, hp: 1.6, color: '#6c7f4e' },
  spitter: { name: 'Spitters', icon: '🤮', atk: 1.4, def: 0.7, hp: 0.75, color: '#9bd04a' },
  raider:  { name: 'Raiders',  icon: '💀', atk: 1.15, def: 1.0, hp: 1.0, color: '#b0563a' },
};
export const BOSSES = {
  behemoth: { name: 'Behemoth', icon: '👹', skill: { kind: 'barrage', mult: 1.4 }, color: '#5a7a3a' },
  matriarch: { name: 'Hive Matriarch', icon: '🕷️', skill: { kind: 'weaken', mult: 0.8, pct: 0.2, dur: 3 }, color: '#7a3a6a' },
  warlord: { name: 'Raider Warlord', icon: '☠️', skill: { kind: 'stun', mult: 2.2, dur: 1 }, color: '#8a3a2a' },
};

// Power curve for an enemy "strength level" (1..60)
export function enemyScale(level) { return 1 + (level - 1) * 0.42 + Math.pow(level, 2) * 0.02; }

// Enemy squads are modelled as a "virtual" stack of troops so they scale like a player's army.
export function virtual(level) {
  const n = 50 + 35 * level, tm = Math.pow(1.55, (level - 1) / 7), hero = 100 * enemyScale(level);
  return { n, atk: n * 10 * tm + hero, def: n * 11 * tm + hero * 0.8, hp: n * 60 * tm + hero * 12 };
}
// Build defender squads for a zombie encounter. Returns combat-ready squad specs.
export function zombieSquads(level, opts = {}) {
  const s = enemyScale(level);
  const kinds = opts.kinds || pickKinds(level);
  const count = opts.count || Math.min(5, 2 + Math.floor(level / 6));
  const squads = [];
  for (let i = 0; i < count; i++) {
    const k = ZOMBIE_KINDS[kinds[i % kinds.length]];
    const v = virtual(level);
    squads.push({
      name: k.name, icon: k.icon, color: k.color, zombie: true, row: i < 2 ? 0 : 1,
      atk: v.atk * k.atk, def: v.def * k.def, hp: v.hp * k.hp, troops: v.n, level,
    });
  }
  if (opts.boss) {
    const b = BOSSES[opts.boss];
    squads.unshift({ name: b.name, icon: b.icon, color: b.color, zombie: true, boss: true, row: 0, skill: b.skill,
      atk: virtual(level).atk * 1.6, def: virtual(level).def * 1.2, hp: virtual(level).hp * 3, troops: virtual(level).n * 2, level });
    if (squads.length > 5) squads.pop();
  }
  return squads;
}
function pickKinds(level) {
  if (level < 4) return ['walker'];
  if (level < 8) return ['walker', 'runner'];
  if (level < 14) return ['brute', 'walker', 'runner'];
  return ['brute', 'spitter', 'runner', 'walker'];
}
export function enemyPower(squads) { return Math.round(squads.reduce((a, s) => a + (s.atk + s.def) * 0.6 + s.hp * 0.05, 0)); }

// Campaign: 8 chapters x 10 stages, every 10th is a boss.
export const CHAPTERS = [
  { name: 'The First Night', bg: 'suburb' }, { name: 'Highway of Wrecks', bg: 'highway' },
  { name: 'Mercy General', bg: 'hospital' }, { name: 'Rust Harbor', bg: 'harbor' },
  { name: 'The Drowned Mall', bg: 'mall' }, { name: 'Refinery Row', bg: 'refinery' },
  { name: 'Hive District', bg: 'hive' }, { name: 'Ground Zero', bg: 'zero' },
];
export function stageInfo(index) { // 0-based global stage index
  const ch = Math.floor(index / 10), st = index % 10, level = 1 + Math.round(index * 0.72);
  const boss = st === 9 ? ['behemoth', 'matriarch', 'warlord'][ch % 3] : null;
  const raiders = ch % 2 === 1 && st % 3 === 1;
  return {
    index, chapter: ch, stage: st, level, boss, name: `${ch + 1}-${st + 1}`,
    squads: () => zombieSquads(level, { boss, kinds: raiders ? ['raider'] : undefined, count: Math.min(5, 2 + Math.floor(index / 8)) }),
    reward: { food: 400 + index * 260, wood: 400 + index * 260, metal: index > 8 ? 150 + index * 90 : 0, gems: boss ? 120 : 15, xp: 80 + index * 30, heroXp: 150 + index * 60,
      items: boss ? { ticket: 1, parts: 20, manual: 3 } : st % 3 === 2 ? { parts: 5 } : {} },
  };
}
export const STAGE_COUNT = CHAPTERS.length * 10;
