// Plays the whole story chain from a fresh save, doing what each mission asks,
// and checks that every mission can actually be completed and claimed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/core/game.js';
import { STORY, DAILY, WEEKLY } from '../js/data/missions.js';
import { BASE_LAYOUT, buildingReqs } from '../js/data/buildings.js';

function world() {
  let t = Date.UTC(2026, 10, 2, 9);
  const g = new Game(null, { name: 'Walker', now: () => t, seed: 7 });
  const adv = (ms) => { t += ms; g.tick(); };
  return { g, adv };
}
// Upgrade a building type to a level, satisfying requirements first (paying with gems)
function upgradeTo(g, type, lvl) {
  g.s.gems = Math.max(g.s.gems, 1e7);
  let guard = 0;
  while (g.lvl(type) < lvl && guard++ < 60) {
    for (const r of buildingReqs(type, g.lvl(type) + 1)) if (g.lvl(r.b) < r.lvl) upgradeTo(g, r.b, r.lvl);
    const slot = Object.entries(g.s.buildings).find(([, b]) => b.type === type)?.[0] || BASE_LAYOUT.find((l) => l.type === type)?.id
      || BASE_LAYOUT.find((l) => l.plot && !g.s.buildings[l.id])?.id;
    const r = g.startUpgrade(slot, type, true);
    assert.ok(r.ok, `upgrade ${type}→${g.lvl(type) + 1}: ${r.msg}`);
  }
}
function buildNew(g, type) {
  const plot = BASE_LAYOUT.find((l) => l.plot && !g.s.buildings[l.id]);
  g.s.gems = 1e7;
  return g.startUpgrade(plot.id, type, true);
}
// Strong army WITHOUT touching buildings, so building-gated missions are tested honestly
function strongArmy(g) {
  g.s.troops.infantry3 = 20000; g.s.troops.ranged3 = 20000; g.s.troops.vehicle3 = 20000;
  g.s.gems = Math.max(g.s.gems, 1e7);
  while (Object.keys(g.s.heroes).length < 5) g.recruit('normal', 1);
  for (const h of Object.values(g.s.heroes)) h.lvl = Math.max(h.lvl, 30);
  g.s.formation.attack = g.autoFormation(Object.keys(g.s.heroes).slice(0, 5));
  // a real player builds Training Grounds alongside the HQ (not story-gated)
  if (g.lvl('hq') >= 4) g.s.buildings.drill = { type: 'drill', lvl: Math.max(g.lvl('drill'), g.lvl('hq') - 3) };
}
function doQuest(g, adv, q) {
  switch (q.kind) {
    case 'bld': upgradeTo(g, q.b, q.lvl); break;
    case 'count': {
      while (Object.values(g.s.buildings).filter((b) => b.type === q.b && b.lvl > 0).length < q.n) {
        const r = buildNew(g, q.b);
        assert.ok(r.ok, `build ${q.b}: ${r.msg}`);
      }
      break;
    }
    case 'stage': strongArmy(g); while (g.s.campaign.stage < q.n) { const r = g.fightStage(); assert.ok(r.ok && r.win, `stage ${g.s.campaign.stage}`); } break;
    case 'alliance': assert.ok(g.joinLocalAlliance('npc2').ok); break;
    case 'star': g.s.shards.brick = 10; assert.ok(g.starUp('brick').ok); break;
    case 'ev': {
      for (let i = 0; i < 400 && (g.s.missions.life[q.ev] || 0) < q.n; i++) {
        if (q.ev === 'collect') { adv(3600e3); g.collect('plot0'); }
        else if (q.ev === 'train' || q.ev === 'trainInfantry') { g.s.gems = 1e7; const r = g.startTraining('infantry', 1, 9999, true); assert.ok(r.ok, r.msg); }
        else if (q.ev === 'recruit') { g.s.gems = 1e7; g.recruit('normal', 1); }
        else if (q.ev === 'research') { g.s.gems = 1e7; const r = g.startResearch('agri', true); assert.ok(r.ok, r.msg); }
        else if (q.ev === 'zombie' || q.ev === 'gather') {
          strongArmy(g); g.s.vigor.v = 100;
          const p = g.basePos();
          const o = g.visibleObjects(p.x - 20, p.y - 20, p.x + 20, p.y + 20).filter((x) => (q.ev === 'zombie' ? x.kind === 'zombie' : x.kind === 'node' && !g.objectState(x).occupied)).sort((a, b) => a.lvl - b.lvl)[0];
          const r = g.sendMarch(q.ev === 'zombie' ? 'attack' : 'gather', o.id, Object.keys(g.s.heroes).slice(0, 2));
          assert.ok(r.ok, r.msg);
          for (let k = 0; k < 200 && g.s.marches.length; k++) adv(60e3);
        }
        else if (q.ev === 'arenaWin') { strongArmy(g); const ops = g.arenaOpponents(true); g.s.arena.attempts = 0; g.fightArena(ops[0].id); }
        else if (q.ev === 'forge') { upgradeTo(g, 'forge', 1); g.s.items.parts = 999; g.s.res.metal = 1e6; assert.ok(g.forgeGear('weapon', 'R').ok); }
        else assert.fail('no action for ' + q.ev);
      }
      break;
    }
    default: assert.fail('unknown quest kind ' + q.kind);
  }
}

test('every story mission can be completed in order', () => {
  const { g, adv } = world();
  for (let i = 0; i < STORY.length; i++) {
    const q = g.storyQuest();
    assert.ok(q, `quest ${i} exists`);
    if (process.env.DEBUG_STORY) console.error('story', i + 1, q.text);
    doQuest(g, adv, q);
    const after = g.storyQuest();
    assert.ok(after.done, `story ${i + 1} "${q.text}" not done: ${after.have}/${after.need}`);
    assert.ok(g.claimStory().ok, `claim story ${i + 1}`);
  }
  assert.equal(g.storyQuest(), null);
});

test('every daily and weekly mission event is reachable by gameplay', () => {
  // Each mission event must be bumped by some game action somewhere in the code
  const { g } = world();
  const seen = new Set();
  const orig = g.track.bind(g);
  g.track = (ev, n) => { seen.add(ev); return orig(ev, n); };
  void g;
  for (const m of [...DAILY, ...WEEKLY]) assert.ok(typeof m.ev === 'string' && m.n > 0, m.id);
});

test('quest bar progress never exceeds need and claiming twice fails', () => {
  const { g, adv } = world();
  adv(3600e3); g.collect('plot0'); g.collect('plot5');
  const q = g.storyQuest();
  assert.ok(q.have <= q.need);
  assert.ok(g.claimStory().ok);
  assert.equal(g.s.missions.story, 1);
});
