import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/core/game.js';
import { simulateBattle } from '../js/core/combat.js';
import { zombieSquads, stageInfo } from '../js/data/enemies.js';
import { HEROES } from '../js/data/heroes.js';
import { terrainAt, chunkObjects, objectById } from '../js/core/world.js';
import { RESEARCH, RESEARCH_BY_ID } from '../js/data/research.js';
import { BUILDINGS, buildingCost } from '../js/data/buildings.js';

function mk(t0 = Date.UTC(2026, 9, 31, 12)) { let t = t0; const g = new Game(null, { name: 'T', now: () => t, seed: 42 }); return { g, adv: (ms) => { t += ms; g.tick(); }, now: () => t }; }

test('content: 30 unique heroes with 3 skills each', () => {
  assert.equal(HEROES.length, 30);
  assert.equal(new Set(HEROES.map((h) => h.id)).size, 30);
  assert.equal(new Set(HEROES.map((h) => h.name)).size, 30);
  for (const h of HEROES) { assert.equal(h.skills.length, 3); assert.ok(['R', 'SR', 'SSR'].includes(h.rarity)); }
});
test('research prerequisites reference real nodes', () => {
  for (const n of RESEARCH) for (const p of n.pre) assert.ok(RESEARCH_BY_ID[p.split(':')[0]], `${n.id} -> ${p}`);
});
test('building costs grow with level', () => {
  for (const t of Object.keys(BUILDINGS)) { const a = buildingCost(t, 2), b = buildingCost(t, 10); assert.ok((b.food || b.wood) > (a.food || a.wood), t); }
});

test('combat is deterministic for the same seed', () => {
  const a = zombieSquads(5), b = zombieSquads(6);
  const r1 = simulateBattle(a, b, { seed: 99 }), r2 = simulateBattle(a, b, { seed: 99 });
  assert.deepEqual(r1, r2);
  assert.ok(['a', 'b'].includes(r1.winner));
  assert.ok(r1.log.length > 0);
});
test('stronger army wins', () => {
  const weak = zombieSquads(2), strong = zombieSquads(20);
  assert.equal(simulateBattle(strong, weak, { seed: 1 }).winner, 'a');
  assert.equal(simulateBattle(weak, strong, { seed: 1 }).winner, 'b');
});

test('building upgrade spends resources and completes on time', () => {
  const { g, adv } = mk();
  const before = g.s.res.food;
  const info = g.upgradeInfo('hq');
  assert.ok(info.ok);
  assert.ok(g.startUpgrade('hq').ok);
  assert.equal(g.s.res.food, before - info.cost.food);
  assert.equal(g.startUpgrade('wall').ok, false, 'only one builder');
  adv(info.time * 1000 + 10);
  assert.equal(g.lvl('hq'), 2);
});
test('cannot build above HQ level', () => {
  const { g } = mk();
  const r = g.upgradeInfo('wall'); // wall 1->2 needs HQ 2
  assert.equal(r.ok, false);
  assert.match(r.reason, /Command Center/);
});
test('production accumulates and is collectable', () => {
  const { g, adv } = mk();
  adv(3600 * 1000);
  const v = g.collect('plot0');
  assert.ok(v > 600, 'farm produced at least an hour of food');
  assert.equal(g.pending('plot0'), 0);
});
test('training and instant finish', () => {
  const { g, adv } = mk();
  const before = g.s.troops.infantry1;
  assert.ok(g.startTraining('infantry', 1, 20).ok);
  adv(3600 * 1000);
  assert.equal(g.s.troops.infantry1, before + 20);
});
test('research gated by lab', () => {
  const { g } = mk();
  assert.equal(g.researchInfo('agri').ok, false);
  g.s.buildings.research = { type: 'research', lvl: 1 };
  assert.ok(g.startResearch('agri', true).ok);
  assert.equal(g.s.research.agri, 1);
  assert.ok(g.bonus('prod_food') > 0);
});
test('recruitment with pity grants a legendary within 50 pulls', () => {
  const { g } = mk();
  g.s.gems = 1e6;
  let got = false;
  for (let i = 0; i < 5 && !got; i++) got = g.recruit('normal', 10).results.some((r) => r.rarity === 'SSR');
  assert.ok(got);
});
test('hero stars and skills', () => {
  const { g } = mk();
  g.s.shards.brick = 10;
  const p0 = g.heroPower('brick');
  assert.ok(g.starUp('brick').ok);
  assert.ok(g.heroPower('brick') > p0);
  g.s.items.manual = 100;
  assert.ok(g.upgradeSkill('brick', 0).ok);
  assert.ok(g.upgradeSkill('brick', 1).ok, 'passive unlocked at 1 star');
  assert.equal(g.upgradeSkill('brick', 2).ok, false, 'command locked until 3 stars');
});
test('campaign stage advances on win', () => {
  const { g } = mk();
  const r = g.fightStage(0);
  assert.ok(r.ok);
  if (r.win) assert.equal(g.s.campaign.stage, 1);
  assert.equal(g.fightStage(5).ok, false);
  assert.ok(stageInfo(9).boss);
});
test('world is deterministic and marches resolve', () => {
  assert.equal(terrainAt(10, 10), terrainAt(10, 10));
  assert.deepEqual(chunkObjects(5, 5), chunkObjects(5, 5));
  const { g, adv } = mk();
  const p = g.basePos();
  const z = g.visibleObjects(p.x - 12, p.y - 12, p.x + 12, p.y + 12).find((o) => o.kind === 'zombie');
  assert.ok(z, 'zombie near spawn');
  assert.deepEqual(objectById(z.id), z);
  const r = g.sendMarch('attack', z.id, ['brick', 'wren']);
  assert.ok(r.ok, r.msg);
  assert.equal(g.s.marches.length, 1);
  adv(3600 * 1000);
  assert.equal(g.s.marches.length, 0, 'march came home');
  assert.ok(g.s.reports.length >= 1);
});
test('gathering returns resources', () => {
  const { g, adv } = mk();
  const p = g.basePos();
  const n = g.visibleObjects(p.x - 15, p.y - 15, p.x + 15, p.y + 15).find((o) => o.kind === 'node');
  const before = g.s.res[n.res];
  assert.ok(g.sendMarch('gather', n.id, ['brick']).ok);
  for (let i = 0; i < 40; i++) adv(600 * 1000);
  assert.equal(g.s.marches.length, 0);
  assert.ok(g.s.res[n.res] > before);
});
test('daily missions, chests and login', () => {
  const { g, adv } = mk();
  g.track('collect', 5);
  assert.ok(g.claimDaily('d_collect').ok);
  assert.equal(g.claimDaily('d_collect').ok, false);
  g.track('build', 2); g.claimDaily('d_build');
  assert.ok(g.claimChest(0).ok);
  assert.ok(g.claimLogin().ok);
  assert.equal(g.claimLogin().ok, false);
  adv(86400000);
  assert.equal(g.loginState().day, 1);
  assert.equal(g.s.missions.dClaimed.length, 0, 'daily reset');
});
test('local alliance: join, AI helps reduce timers, boss rally', () => {
  const { g, adv } = mk();
  assert.ok(g.joinLocalAlliance('npc1').ok);
  g.startUpgrade('hq');
  const q = g.s.queues.build[0], end0 = q.end;
  assert.ok(g.requestHelp('build', 'hq').ok);
  for (let i = 0; i < 10; i++) adv(4000);
  assert.ok(q.helps > 0 || g.lvl('hq') === 2);
  if (g.s.queues.build[0]) assert.ok(g.s.queues.build[0].end < end0);
  const r = g.rallyBoss();
  assert.ok(r.ok);
  assert.ok(g.s.alliance.boss.hp < g.s.alliance.boss.max || r.killed);
});
test('arena fight changes points and uses attempts', () => {
  const { g } = mk();
  const ops = g.arenaOpponents();
  assert.equal(ops.length, 3);
  const r = g.fightArena(ops[0].id);
  assert.ok(r.ok);
  assert.equal(g.arenaAttemptsLeft(), 4);
});
test('save round-trips through JSON', () => {
  const { g } = mk();
  g.startUpgrade('hq');
  const g2 = new Game(JSON.parse(g.serialize()));
  assert.deepEqual(g2.s, g.s);
});
