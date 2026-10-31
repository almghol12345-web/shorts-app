import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { Game } from '../js/core/game.js';

process.env.ASHFALL_DB = path.join(os.tmpdir(), `ashfall-test-${process.pid}.json`);
const { server } = await import('../server/server.js');
let base;
before(() => new Promise((r) => server.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); })));
after(() => new Promise((r) => server.close(r)));

async function call(method, p, body, token) {
  const res = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return res.json();
}
function strongSave(name) {
  const g = new Game(null, { name });
  g.s.troops.infantry1 = 5000; g.s.troops.ranged1 = 3000; g.s.shieldUntil = 0;
  g.basePos();
  return g;
}

test('accounts, saves, pvp, arena and alliances', async () => {
  const a = await call('POST', '/api/register', { name: 'Alpha', password: 'secret1' });
  const b = await call('POST', '/api/register', { name: 'Bravo', password: 'secret2' });
  assert.ok(a.ok && b.ok);
  assert.equal((await call('POST', '/api/register', { name: 'alpha', password: 'xxxxxx' })).ok, false, 'name unique');
  assert.equal((await call('POST', '/api/login', { name: 'Alpha', password: 'nope' })).ok, false);
  assert.ok((await call('POST', '/api/login', { name: 'Alpha', password: 'secret1' })).ok);

  const ga = strongSave('Alpha'), gb = strongSave('Bravo');
  assert.ok((await call('PUT', '/api/save', { save: ga.s, power: ga.power(), hq: 1 }, a.token)).ok);
  assert.ok((await call('PUT', '/api/save', { save: gb.s, power: gb.power(), hq: 1 }, b.token)).ok);
  const cheat = structuredClone(ga.s); cheat.gems += 999999;
  assert.equal((await call('PUT', '/api/save', { save: cheat, power: 1, hq: 1 }, a.token)).ok, false, 'sanity check rejects gem jump');

  const lb = await call('GET', '/api/leaderboard?type=power', null, a.token);
  assert.equal(lb.list.length, 2);
  const wp = await call('GET', '/api/world/players', null, a.token);
  assert.equal(wp.players.length, 2);

  const pvp = await call('POST', '/api/pvp/attack', { target: b.user.id }, a.token);
  assert.ok(pvp.ok, pvp.msg);
  assert.ok(['a', 'b'].includes(pvp.result.winner));
  const again = await call('POST', '/api/pvp/attack', { target: b.user.id }, a.token);
  assert.equal(again.ok, false, 'cooldown or shield blocks repeat raid');
  const inbox = await call('GET', '/api/inbox', null, b.token);
  assert.equal(inbox.items[0].type, 'raided');

  const ops = await call('GET', '/api/arena/opponents', null, a.token);
  assert.equal(ops.opponents[0].uid, b.user.id);
  const fight = await call('POST', '/api/arena/fight', { target: b.user.id }, a.token);
  assert.ok(fight.ok, fight.msg);

  const al = await call('POST', '/api/alliances', { name: 'Night Watch', tag: 'NW' }, a.token);
  assert.ok(al.ok, al.msg);
  assert.ok((await call('POST', `/api/alliances/${al.alliance.id}/join`, null, b.token)).ok);
  assert.ok((await call('POST', '/api/alliance/chat', { text: 'hello' }, b.token)).ok);
  assert.ok((await call('POST', '/api/alliance/help', { kind: 'build', key: 'hq', label: 'HQ' }, a.token)).ok);
  const help = await call('POST', '/api/alliance/helpall', null, b.token);
  assert.equal(help.n, 1);
  const mine = await call('GET', '/api/alliance', null, a.token);
  assert.equal(mine.alliance.members.length, 2);
  assert.equal(mine.alliance.myHelps[0].helps, 1);
  assert.ok(mine.alliance.chat.some((c) => c.text === 'hello'));
  assert.equal((await call('POST', '/api/pvp/attack', { target: b.user.id }, a.token)).ok, false, 'no attacking allies');
  const boss = await call('POST', '/api/alliance/boss', null, a.token);
  assert.ok(boss.ok, JSON.stringify(boss).slice(0, 300));
  assert.ok(boss.bossDmg > 0, 'damage ' + boss.bossDmg + ' ' + JSON.stringify(boss.result.b[0]));
  assert.ok((await call('POST', '/api/alliance/donate', { key: 'troop_atk' }, a.token)).ok);
});
