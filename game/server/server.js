// Ashfall game server — zero dependencies (Node >= 18).
//  * Serves the game client
//  * Accounts (scrypt-hashed passwords, bearer tokens) and cloud saves (with sanity checks)
//  * Leaderboards, world presence of real players
//  * Server-authoritative PvP raids, Arena fights and alliance boss damage: the server rebuilds
//    both armies from the stored saves and runs the same deterministic combat engine as the client.
//  * Online alliances: membership, live chat (Server-Sent Events), helps, shared tech and boss.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Game } from '../js/core/game.js';
import { simulateBattle, sidePower } from '../js/core/combat.js';
import { techCost } from '../js/core/social.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +process.env.PORT || 8080;
const DB_FILE = process.env.ASHFALL_DB || path.join(ROOT, 'server', 'data', 'db.json');
const DAY = 86400000;

// ---------------- storage ----------------
let db = { users: {}, names: {}, tokens: {}, alliances: {}, saves: {}, inbox: {}, seq: 1 };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; } catch { /* fresh db */ }
let dirty = false;
function persist() { if (!dirty) return; dirty = false; fs.mkdirSync(path.dirname(DB_FILE), { recursive: true }); const tmp = DB_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DB_FILE); }
setInterval(persist, 3000).unref();
process.on('SIGINT', () => { persist(); process.exit(0); });
process.on('SIGTERM', () => { persist(); process.exit(0); });
const touch = () => { dirty = true; };
const id = () => (db.seq++).toString(36) + crypto.randomBytes(3).toString('hex');
const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

// ---------------- helpers ----------------
function hashPw(pw, salt = crypto.randomBytes(16).toString('hex')) { return { salt, hash: crypto.scryptSync(pw, salt, 64).toString('hex') }; }
function checkPw(pw, u) { const h = crypto.scryptSync(pw, u.salt, 64); return crypto.timingSafeEqual(h, Buffer.from(u.hash, 'hex')); }
function publicUser(u) { return { id: u.id, name: u.name }; }
function send(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS' }); res.end(JSON.stringify(obj)); }
function readBody(req, limit = 1.5e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}
function auth(req, url) {
  const h = req.headers.authorization || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('token');
  const uid = tok && db.tokens[tok];
  const u = uid && db.users[uid];
  if (u) u.lastSeen = Date.now();
  return u || null;
}
function gameFor(uid) { const s = db.saves[uid]; return s ? new Game(structuredClone(s), { now: () => Date.now() }) : null; }
function pushInbox(uid, item) { (db.inbox[uid] ||= []).push({ id: id(), t: Date.now(), ...item }); touch(); }
function allianceOf(u) { return u.alliance ? db.alliances[u.alliance] : null; }

// Basic anti-tamper: reject impossible jumps between consecutive uploads
function sanity(prev, next, prevAt) {
  if (!next || typeof next !== 'object' || !next.res || !next.buildings || !next.player) return 'Malformed save';
  if (!prev) return null;
  const mins = Math.max(1, (Date.now() - (prevAt || 0)) / 60000);
  if (next.gems - prev.gems > 3000 + mins * 50) return 'Gem gain too large';
  for (const [k, b] of Object.entries(next.buildings)) { const p = prev.buildings?.[k]?.lvl || 0; if (b.lvl - p > Math.max(3, Math.ceil(mins / 30))) return 'Building level jump too large'; }
  return null;
}

// ---------------- SSE ----------------
const streams = new Map(); // allianceId -> Set(res)
function broadcast(aid, msg) { for (const r of streams.get(aid) || []) r.write(`data: ${JSON.stringify(msg)}\n\n`); }
function chatPush(a, msg) { a.chat.push(msg); if (a.chat.length > 200) a.chat.splice(0, a.chat.length - 200); broadcast(a.id, msg); touch(); }

// ---------------- routes ----------------
const routes = [];
const route = (method, pattern, fn, needAuth = true) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn, needAuth });

route('GET', '/api/health', () => ({ ok: true, players: Object.keys(db.users).length }), false);
route('POST', '/api/register', async ({ body }) => {
  const name = String(body.name || '').trim(), pw = String(body.password || '');
  if (!/^[A-Za-z0-9_\- ]{3,16}$/.test(name)) return { ok: false, msg: 'Name: 3-16 letters, numbers, _ or -' };
  if (pw.length < 6) return { ok: false, msg: 'Password must be 6+ characters' };
  if (db.names[name.toLowerCase()]) return { ok: false, msg: 'Name already taken' };
  const u = { id: id(), name, ...hashPw(pw), createdAt: Date.now(), arena: 1000, arenaDay: dayKey(), arenaFights: 0, alliance: null };
  db.users[u.id] = u; db.names[name.toLowerCase()] = u.id;
  const tok = crypto.randomBytes(24).toString('hex'); db.tokens[tok] = u.id; touch();
  return { ok: true, token: tok, user: publicUser(u) };
}, false);
route('POST', '/api/login', async ({ body }) => {
  const uid = db.names[String(body.name || '').trim().toLowerCase()], u = uid && db.users[uid];
  if (!u || !checkPw(String(body.password || ''), u)) return { ok: false, msg: 'Wrong name or password' };
  const tok = crypto.randomBytes(24).toString('hex'); db.tokens[tok] = u.id; touch();
  return { ok: true, token: tok, user: publicUser(u) };
}, false);
route('GET', '/api/me', ({ u }) => ({ ok: true, user: publicUser(u) }));

route('PUT', '/api/save', ({ u, body }) => {
  const s = body.save;
  const err = sanity(db.saves[u.id], s, u.savedAt);
  if (err) return { ok: false, msg: 'Save rejected by server check: ' + err };
  s.player.name = u.name; s.player.id = u.id;
  db.saves[u.id] = s; u.savedAt = Date.now(); u.power = Math.round(+body.power || 0); u.hq = +body.hq || 1; touch();
  return { ok: true };
});
route('GET', '/api/save', ({ u }) => ({ ok: true, save: db.saves[u.id] || null }));

route('GET', '/api/leaderboard', ({ url }) => {
  const type = url.searchParams.get('type') === 'arena' ? 'arena' : 'power';
  const list = Object.values(db.users).map((x) => ({ uid: x.id, name: x.name, power: x.power || 0, points: x.arena, tag: allianceOf(x)?.tag || null }))
    .sort((a, b) => (type === 'power' ? b.power - a.power : b.points - a.points)).slice(0, 100);
  return { ok: true, list };
});
route('GET', '/api/world/players', () => ({ ok: true, players: Object.values(db.users).filter((x) => db.saves[x.id]?.world?.x).map((x) => { const s = db.saves[x.id]; return { uid: x.id, name: x.name, x: s.world.x, y: s.world.y, hq: x.hq || 1, power: x.power || 0, tag: allianceOf(x)?.tag || null, shielded: (s.shieldUntil || 0) > Date.now() }; }) }));

// ---- PvP raid (server-authoritative) ----
const raidCooldown = {};
route('POST', '/api/pvp/attack', ({ u, body }) => {
  const tgt = db.users[body.target]; if (!tgt || tgt.id === u.id) return { ok: false, msg: 'Invalid target' };
  const gA = gameFor(u.id), gD = gameFor(tgt.id);
  if (!gA || !gD) return { ok: false, msg: 'Both players need a cloud save' };
  if ((gD.s.shieldUntil || 0) > Date.now()) return { ok: false, msg: 'Target is protected by a Peace Shield' };
  if (u.alliance && u.alliance === tgt.alliance) return { ok: false, msg: 'Cannot attack an alliance member' };
  const key = u.id + '>' + tgt.id; if (raidCooldown[key] > Date.now()) return { ok: false, msg: 'You attacked this player recently. Try again later.' };
  const { squads: att } = gA.buildSquads(gA.s.formation.attack, gA.s.troops);
  if (!att.length || !att.some((s) => s.troops > 0)) return { ok: false, msg: 'Your attack formation has no troops' };
  const def = gD.defenseSquads();
  const { squads: home } = gD.buildSquads(gD.s.formation.defense, gD.s.troops, { forDefense: true });
  const seed = crypto.randomInt(1, 2 ** 31);
  const result = simulateBattle(att, def, { seed });
  const win = result.winner === 'a';
  const { lost: aLost, survived } = gA.lossesFrom(att, result.a);
  const { lost: dLost } = gD.lossesFrom(home, result.b);
  const loot = {};
  if (win) {
    let cap = gA.marchLoad({ troops: survived }); const prot = gD.protectedAmount();
    for (const r of ['food', 'wood', 'metal', 'fuel']) { const v = Math.min(cap, Math.floor(Math.max(0, gD.s.res[r] - prot) * 0.2)); if (v > 0) { loot[r] = v; cap -= v; } }
  }
  // patch stored saves so the outcome sticks even if a client misbehaves
  const A = db.saves[u.id], D = db.saves[tgt.id];
  for (const [k, n] of Object.entries(aLost)) A.troops[k] = Math.max(0, (A.troops[k] || 0) - n);
  for (const [k, v] of Object.entries(loot)) { A.res[k] += v; D.res[k] = Math.max(0, D.res[k] - v); }
  for (const [k, n] of Object.entries(dLost)) D.troops[k] = Math.max(0, (D.troops[k] || 0) - n);
  if (win) D.shieldUntil = Date.now() + 30 * 60000;
  raidCooldown[key] = Date.now() + 10 * 60000;
  pushInbox(tgt.id, { type: 'raided', by: u.name, win, loot, losses: dLost, a: att, b: def, seed, summary: { a: result.a, b: result.b, turns: result.turns } });
  touch();
  return { ok: true, win, loot, losses: aLost, result, a: att, b: def, seed };
});

// ---- Arena ----
function arenaReset(u) { if (u.arenaDay !== dayKey()) { u.arenaDay = dayKey(); u.arenaFights = 0; } }
function defenseTeam(uid) { const g = gameFor(uid); if (!g) return null; return g.buildSquads(g.s.formation.defense, g.s.troops, { forDefense: true }).squads; }
route('GET', '/api/arena/opponents', ({ u }) => {
  const list = Object.values(db.users).filter((x) => x.id !== u.id && db.saves[x.id]).map((x) => { const sq = defenseTeam(x.id) || []; return { uid: x.id, name: x.name, points: x.arena, power: sidePower(sq), hero: sq[0]?.heroId || db.saves[x.id].player?.avatar }; })
    .filter((x) => x.power > 0).sort((a, b) => Math.abs(a.points - u.arena) - Math.abs(b.points - u.arena)).slice(0, 5);
  return { ok: true, opponents: list };
});
route('POST', '/api/arena/fight', ({ u, body }) => {
  arenaReset(u); if (u.arenaFights >= 5) return { ok: false, msg: 'No arena attempts left today' };
  const tgt = db.users[body.target]; if (!tgt || tgt.id === u.id) return { ok: false, msg: 'Invalid opponent' };
  const gA = gameFor(u.id); if (!gA) return { ok: false, msg: 'Upload your save first' };
  const a = gA.buildSquads(gA.s.formation.attack, gA.s.troops).squads, b = defenseTeam(tgt.id);
  if (!a.length) return { ok: false, msg: 'Set your attack formation' };
  if (!b?.length) return { ok: false, msg: 'Opponent has no defense' };
  const seed = crypto.randomInt(1, 2 ** 31), result = simulateBattle(a, b, { seed }), win = result.winner === 'a';
  const delta = win ? Math.max(8, Math.round(20 + (tgt.arena - u.arena) / 20)) : -10;
  u.arena = Math.max(0, u.arena + delta); tgt.arena = Math.max(0, tgt.arena - (win ? Math.round(delta / 2) : -5));
  u.arenaFights++;
  pushInbox(tgt.id, { type: 'arena', points: tgt.arena });
  touch();
  return { ok: true, win, delta, points: u.arena, result, a, b, seed };
});

route('GET', '/api/inbox', ({ u }) => ({ ok: true, items: db.inbox[u.id] || [] }));
route('POST', '/api/inbox/ack', ({ u, body }) => { const ids = new Set(body.ids || []); db.inbox[u.id] = (db.inbox[u.id] || []).filter((x) => !ids.has(x.id)); touch(); return { ok: true }; });

// ---- Alliances ----
const BOSS_HP = (lvl) => Math.round(3e6 * Math.pow(1.6, lvl - 1));
function newBoss(lvl = 1) { return { lvl, hp: BOSS_HP(lvl), max: BOSS_HP(lvl), day: dayKey(), dmg: {}, attacks: {} }; }
route('GET', '/api/alliances', () => ({ ok: true, alliances: Object.values(db.alliances).map((a) => ({ id: a.id, name: a.name, tag: a.tag, members: a.members.length, power: a.members.reduce((s, m) => s + (db.users[m]?.power || 0), 0) })).sort((a, b) => b.power - a.power) }));
route('POST', '/api/alliances', ({ u, body }) => {
  if (u.alliance) return { ok: false, msg: 'Leave your current alliance first' };
  const name = String(body.name || '').trim(), tag = String(body.tag || '').trim().toUpperCase();
  if (name.length < 3 || name.length > 24 || !/^[A-Z0-9]{2,4}$/.test(tag)) return { ok: false, msg: 'Name 3-24 chars, tag 2-4 letters/numbers' };
  if (Object.values(db.alliances).some((a) => a.tag === tag || a.name.toLowerCase() === name.toLowerCase())) return { ok: false, msg: 'Name or tag taken' };
  const a = { id: id(), name, tag, leader: u.id, members: [u.id], chat: [], tech: {}, techXp: {}, boss: newBoss(), helps: [], createdAt: Date.now() };
  db.alliances[a.id] = a; u.alliance = a.id; chatPush(a, { from: 'System', system: true, text: `${u.name} founded [${tag}] ${name}`, t: Date.now() });
  return { ok: true, alliance: { id: a.id, name, tag, tech: a.tech } };
});
route('POST', '/api/alliances/:aid/join', ({ u, params }) => {
  if (u.alliance) return { ok: false, msg: 'Leave your current alliance first' };
  const a = db.alliances[params.aid]; if (!a) return { ok: false, msg: 'Alliance not found' };
  if (a.members.length >= 50) return { ok: false, msg: 'Alliance is full' };
  a.members.push(u.id); u.alliance = a.id; chatPush(a, { from: 'System', system: true, text: `${u.name} joined the alliance`, t: Date.now() });
  return { ok: true, alliance: { id: a.id, name: a.name, tag: a.tag, tech: a.tech } };
});
route('POST', '/api/alliance/leave', ({ u }) => {
  const a = allianceOf(u); if (!a) return { ok: true };
  a.members = a.members.filter((m) => m !== u.id); u.alliance = null;
  chatPush(a, { from: 'System', system: true, text: `${u.name} left the alliance`, t: Date.now() });
  if (!a.members.length) delete db.alliances[a.id]; else if (a.leader === u.id) a.leader = a.members[0];
  touch(); return { ok: true };
});
route('GET', '/api/alliance', ({ u }) => {
  const a = allianceOf(u); if (!a) return { ok: true, alliance: null };
  if (a.boss.day !== dayKey()) { a.boss.day = dayKey(); a.boss.dmg = {}; a.boss.attacks = {}; }
  a.helps = a.helps.filter((x) => Date.now() - x.t < DAY);
  return { ok: true, alliance: {
    id: a.id, name: a.name, tag: a.tag, leader: a.leader, tech: a.tech, techXp: a.techXp, chat: a.chat.slice(-60).map((c) => ({ ...c, me: c.uid === u.id })),
    members: a.members.map((m) => db.users[m]).filter(Boolean).map((m) => ({ uid: m.id, name: m.name, power: m.power || 0, rank: m.id === a.leader ? 5 : 1, online: Date.now() - (m.lastSeen || 0) < 120000, hero: db.saves[m.id]?.player?.avatar })),
    boss: { lvl: a.boss.lvl, hp: a.boss.hp, max: a.boss.max, myDmg: a.boss.dmg[u.id] || 0, myAttacks: a.boss.attacks[u.id] || 0 },
    helps: a.helps.filter((x) => x.helps < x.cap && !x.helpers.includes(u.id)).map((x) => ({ id: x.id, uid: x.uid, name: x.name, label: x.label, helps: x.helps, cap: x.cap })),
    myHelps: a.helps.filter((x) => x.uid === u.id).map((x) => ({ kind: x.kind, key: x.key, helps: x.helps, cap: x.cap })),
  } };
});
route('POST', '/api/alliance/chat', ({ u, body }) => {
  const a = allianceOf(u); if (!a) return { ok: false, msg: 'Not in an alliance' };
  const text = String(body.text || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 200); if (!text) return { ok: false, msg: 'Empty message' };
  const now = Date.now(); if (u.lastChat && now - u.lastChat < 800) return { ok: false, msg: 'Slow down' }; u.lastChat = now;
  chatPush(a, { from: u.name, uid: u.id, text, t: now });
  return { ok: true };
});
route('POST', '/api/alliance/help', ({ u, body }) => {
  const a = allianceOf(u); if (!a) return { ok: false, msg: 'Not in an alliance' };
  const kind = String(body.kind), key = String(body.key);
  if (a.helps.some((x) => x.uid === u.id && x.kind === kind && x.key === key && Date.now() - x.t < DAY && x.helps < x.cap)) return { ok: false, msg: 'Already requested' };
  const hub = db.saves[u.id] ? Object.values(db.saves[u.id].buildings).find((b) => b.type === 'alliance')?.lvl || 0 : 0;
  a.helps.push({ id: id(), uid: u.id, name: u.name, kind, key, label: String(body.label || '').slice(0, 60), helps: 0, cap: 3 + Math.floor(hub / 2), helpers: [], t: Date.now() }); touch();
  return { ok: true };
});
route('POST', '/api/alliance/helpall', ({ u }) => {
  const a = allianceOf(u); if (!a) return { ok: false, msg: 'Not in an alliance' };
  let n = 0; for (const x of a.helps) if (x.uid !== u.id && x.helps < x.cap && !x.helpers.includes(u.id)) { x.helps++; x.helpers.push(u.id); n++; }
  if (!n) return { ok: false, msg: 'Nothing to help right now' };
  touch(); return { ok: true, n };
});
route('POST', '/api/alliance/donate', ({ u, body }) => {
  const a = allianceOf(u); if (!a) return { ok: false, msg: 'Not in an alliance' };
  const key = String(body.key); const lvl = a.tech[key] || 0; if (lvl >= 10) return { ok: false, msg: 'Max level' };
  const now = Date.now(); u.donations = (u.donations || []).filter((t) => now - t < 3600000); if (u.donations.length >= 40) return { ok: false, msg: 'Donation limit reached for this hour' }; u.donations.push(now);
  a.techXp[key] = (a.techXp[key] || 0) + 100;
  if (a.techXp[key] >= techCost(lvl)) { a.techXp[key] -= techCost(lvl); a.tech[key] = lvl + 1; chatPush(a, { from: 'System', system: true, text: `Alliance tech ${key} reached Lv ${lvl + 1}!`, t: now }); }
  touch(); return { ok: true, tech: a.tech };
});
route('POST', '/api/alliance/boss', ({ u }) => {
  const a = allianceOf(u); if (!a) return { ok: false, msg: 'Not in an alliance' };
  if (a.boss.day !== dayKey()) { a.boss.day = dayKey(); a.boss.dmg = {}; a.boss.attacks = {}; }
  if ((a.boss.attacks[u.id] || 0) >= 3) return { ok: false, msg: 'Out of rally attempts today (3/day)' };
  const g = gameFor(u.id); if (!g) return { ok: false, msg: 'Upload your save first' };
  const att = g.buildSquads(g.s.formation.attack, g.s.troops).squads; if (!att.length) return { ok: false, msg: 'Set your attack formation' };
  const enemy = g.bossSquads(a.boss), seed = crypto.randomInt(1, 2 ** 31);
  const result = simulateBattle(att, enemy, { seed, maxTurns: 12 });
  const bossDmg = Math.min(a.boss.hp, Math.round(result.b[0].taken));
  a.boss.hp -= bossDmg; a.boss.dmg[u.id] = (a.boss.dmg[u.id] || 0) + bossDmg; a.boss.attacks[u.id] = (a.boss.attacks[u.id] || 0) + 1;
  const reward = { parts: 5 + Math.floor(bossDmg / 40000), manual: 1, gems: 10 + Math.floor(bossDmg / 100000) };
  let killed = false;
  if (a.boss.hp <= 0) {
    killed = true; reward.eliteTicket = 1; reward.gems += 100;
    for (const m of a.members) if (m !== u.id) pushInbox(m, { type: 'mail', title: 'Behemoth defeated!', body: `${u.name} landed the final blow on the Lv ${a.boss.lvl} Behemoth. Spoils for every member:`, reward: { gems: 80, parts: 20, speed1h: 1 } });
    chatPush(a, { from: 'System', system: true, text: `${u.name} slew the Behemoth Lv ${a.boss.lvl}!`, t: Date.now() });
    a.boss = newBoss(a.boss.lvl + 1);
  }
  touch();
  return { ok: true, result, a: att, b: enemy, seed, bossDmg, killed, reward };
});
route('GET', '/api/alliance/stream', ({ u, res }) => {
  const a = allianceOf(u); if (!a) return { ok: false, msg: 'Not in an alliance' };
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*' });
  res.write(': connected\n\n');
  if (!streams.has(a.id)) streams.set(a.id, new Set());
  streams.get(a.id).add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  res.on('close', () => { clearInterval(ping); streams.get(a.id)?.delete(res); });
  return undefined; // keep open
});

// ---------------- static files ----------------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname); if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT) || file.includes(path.join(ROOT, 'server'))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url);
  const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
  if (!r) return send(res, 404, { ok: false, msg: 'Unknown endpoint' });
  try {
    const u = auth(req, url);
    if (r.needAuth && !u) return send(res, 401, { ok: false, msg: 'Please log in' });
    const body = req.method === 'POST' || req.method === 'PUT' ? await readBody(req) : {};
    const params = url.pathname.match(r.re).groups || {};
    const out = await r.fn({ u, body, url, params, req, res });
    if (out !== undefined) send(res, 200, out);
  } catch (e) {
    console.error(e);
    send(res, 500, { ok: false, msg: 'Server error' });
  }
});

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  server.listen(PORT, () => console.log(`Ashfall server running at http://localhost:${PORT}`));
}
