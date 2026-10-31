// Alliance (local AI-simulated mode; online mode is handled by net.js + server), Arena, Shop, Mail.
// Everything simulated is clearly flagged with `ai: true` so the UI can label it honestly.
import { NPC_ALLIANCES } from './world.js';
import { mulberry32, hashStr } from './rng.js';
import { SHOP, ITEMS } from '../data/items.js';
import { HEROES, HERO_BY_ID } from '../data/heroes.js';
import { simulateBattle, sidePower } from './combat.js';
import { zombieSquads, virtual, BOSSES } from '../data/enemies.js';
import { dayKey } from './state.js';
import { ARENA_DAILY_ATTEMPTS } from '../data/config.js';

const AI_NAMES = ['MossyBoots', 'K-9 Kenji', 'Granny Gunz', 'TurboTess', 'Deadeye Dom', 'Patch', 'LoneRanger77', 'Sprocket', 'Ivy Thorn', 'Bulldozer', 'Quiet Quinn', 'Rusty', 'Nova', 'Pilgrim', 'Marrow', 'Big Sal', 'Echo', 'Flint', 'Juniper', 'Wrench'];
const AI_LINES = ['Anyone need helps? Spamming now 💪', 'Horde Lv 12 near the river, who wants it?', 'Boss is at half HP — rally up!', 'Morning, survivors ☕', 'Donated to tech, we\'re close to the next level', 'Watch out, raiders scouting the east side', 'Just pulled a Legendary!! 🎉', 'Remember to claim your daily chests', 'Who\'s online for the rally?', 'Thanks for the helps!'];
const AI_REPLIES = ['👍', 'On it!', 'Haha nice', 'Agreed', 'Good luck out there', 'Welcome aboard!', 'Same here', 'Let\'s go!'];
export const ALLIANCE_TECH = [
  { key: 'prod_food', name: 'Shared Granary', icon: '🌾' }, { key: 'build_speed', name: 'Work Crews', icon: '🏗️' },
  { key: 'research_speed', name: 'Think Tank', icon: '🧪' }, { key: 'troop_atk', name: 'Joint Drills', icon: '⚔️' },
  { key: 'troop_hp', name: 'Medic Network', icon: '🩺' }, { key: 'march_speed', name: 'Road Crews', icon: '🛣️' },
  { key: 'gather_speed', name: 'Scav Maps', icon: '🧭' }, { key: 'zombie_dmg', name: 'Hunt Parties', icon: '🧟' },
];
export const ALLIANCE_SHOP = [
  { id: 'as_speed', item: 'speed1h', coins: 300 }, { id: 'as_manual', item: 'manual', coins: 150 },
  { id: 'as_parts', item: 'parts', coins: 60 }, { id: 'as_ticket', item: 'ticket', coins: 900 },
  { id: 'as_shield', item: 'shield8h', coins: 1200 }, { id: 'as_vigor', item: 'vigor20', coins: 250 },
  { id: 'as_wild', item: 'wildShard', coins: 400 }, { id: 'as_xp', item: 'xpBig', coins: 500 },
];
export function techCost(lvl) { return 2000 * (lvl + 1); } // tech xp per level
const BOSS_HP = (lvl) => Math.round(1.2e6 * Math.pow(1.6, lvl - 1));

export const social = {
  // ---------------- alliance (local / AI members) ----------------
  allianceList() { return NPC_ALLIANCES.map((a) => ({ ...a, members: 18 + (hashStr(a.id) % 12), power: 400000 + (hashStr(a.tag) % 900000), ai: true })); },
  joinLocalAlliance(id) {
    if (this.s.alliance) return { ok: false, msg: 'Leave your current alliance first' };
    const a = NPC_ALLIANCES.find((x) => x.id === id); if (!a) return { ok: false };
    this.s.alliance = this.makeLocalAlliance(a.name, a.tag, a.color, id, 16);
    this.allianceSay(null, `${this.s.player.name} joined the alliance!`, true);
    return { ok: true };
  },
  createLocalAlliance(name, tag) {
    if (this.s.alliance) return { ok: false, msg: 'Leave your current alliance first' };
    if (!name || name.length < 3 || !/^[A-Za-z0-9]{2,4}$/.test(tag || '')) return { ok: false, msg: 'Name 3+ chars, tag 2-4 letters/numbers' };
    if (this.s.gems < 300) return { ok: false, msg: 'Creating an alliance costs 300 gems' };
    this.s.gems -= 300; this.track('gems', 300);
    this.s.alliance = this.makeLocalAlliance(name, tag.toUpperCase(), '#58c4a0', 'own', 4);
    this.s.alliance.leader = true;
    return { ok: true };
  },
  makeLocalAlliance(name, tag, color, id, n) {
    const rng = mulberry32(hashStr(name + this.s.seed));
    const members = Array.from({ length: n }, (_, i) => ({ name: AI_NAMES[(i + Math.floor(rng() * 20)) % 20] + (i >= 20 ? i : ''), power: Math.round(20000 + rng() * 300000), rank: i < 2 ? 4 : i < 6 ? 3 : 2, ai: true, hero: HEROES[Math.floor(rng() * HEROES.length)].id }));
    const uniq = []; for (const m of members) if (!uniq.some((u) => u.name === m.name)) uniq.push(m);
    return { id, name, tag, color, mode: 'local', members: uniq, chat: [], tech: {}, techXp: {}, coins: 0, contrib: 0, helpsToday: 0, helpDay: dayKey(this.now()),
      boss: { lvl: 1, hp: BOSS_HP(1), max: BOSS_HP(1), day: dayKey(this.now()), myDmg: 0, attacks: 0 }, gifts: [], aiAt: this.now(), requests: [], joinedAt: this.now() };
  },
  leaveAlliance() { if (!this.s.alliance) return { ok: false }; this.s.alliance = null; this.emit('change'); return { ok: true }; },
  allianceSay(from, text, system = false) {
    const a = this.s.alliance; if (!a) return;
    a.chat.push({ from: from ?? (system ? 'System' : this.s.player.name), text: String(text).slice(0, 200), t: this.now(), ai: from !== null && from !== this.s.player.name && !system, system, me: from === this.s.player.name });
    if (a.chat.length > 80) a.chat.splice(0, a.chat.length - 80);
    this.emit('chat');
  },
  sendChat(text) {
    const a = this.s.alliance; if (!a || !text.trim()) return;
    this.allianceSay(this.s.player.name, text.trim());
    if (a.mode === 'local' && a.members.length) { a.pendingReply = this.now() + 2000 + Math.random() * 5000; }
  },
  helpCap() { return 3 + Math.floor(this.lvl('alliance') / 2); },
  requestHelp(kind, key) {
    const a = this.s.alliance; if (!a) return { ok: false, msg: 'Join an alliance to request help' };
    const q = this.queueRef(kind, key); if (!q || q.help) return { ok: false, msg: 'Already requested' };
    q.help = true; q.helpCap = this.helpCap(); q.helpNext = this.now() + 3000;
    return { ok: true };
  },
  helpAll() {
    const a = this.s.alliance; if (!a) return { ok: false };
    if (a.helpDay !== dayKey(this.now())) { a.helpDay = dayKey(this.now()); a.helpsToday = 0; }
    const n = a.requests.length; if (!n) return { ok: false, msg: 'No help requests right now' };
    a.requests = [];
    const coinable = Math.max(0, Math.min(n, 50 - a.helpsToday));
    a.helpsToday += n; a.coins += coinable * 10;
    this.track('help', n); this.addXp(n * 5);
    return { ok: true, n, coins: coinable * 10 };
  },
  donateTech(key, res) {
    const a = this.s.alliance; if (!a) return { ok: false };
    const lvl = a.tech[key] || 0; if (lvl >= 10) return { ok: false, msg: 'Max level' };
    const amt = { food: 2000, wood: 2000, metal: 800, fuel: 300 }[res] * (1 + lvl);
    if (!this.spend({ [res]: amt })) return { ok: false, msg: 'Not enough resources' };
    a.techXp[key] = (a.techXp[key] || 0) + 100;
    a.coins += 20; this.track('donate', 1);
    if (a.techXp[key] >= techCost(lvl)) { a.techXp[key] -= techCost(lvl); a.tech[key] = lvl + 1; this.allianceSay(null, `Alliance tech ${ALLIANCE_TECH.find((t) => t.key === key).name} reached Lv ${lvl + 1}!`, true); }
    return { ok: true };
  },
  buyAllianceShop(id) {
    const a = this.s.alliance, it = ALLIANCE_SHOP.find((x) => x.id === id); if (!a || !it) return { ok: false };
    if (a.coins < it.coins) return { ok: false, msg: 'Not enough alliance coins' };
    a.coins -= it.coins; this.give({ [it.item]: 1 }); return { ok: true };
  },
  // One huge target: HP is the shared pool, attack scales with boss level
  bossSquads(b) { const v = virtual(2 + b.lvl * 3); return [{ name: `Alliance Behemoth Lv ${b.lvl}`, icon: BOSSES.behemoth.icon, color: BOSSES.behemoth.color, zombie: true, boss: true, row: 0, atk: v.atk * 0.55, def: v.def * 0.8, hp: b.hp, troops: v.n * 4, skill: BOSSES.behemoth.skill }]; },
  rallyBoss() {
    const a = this.s.alliance; if (!a) return { ok: false, msg: 'Join an alliance first' };
    this.refreshBoss();
    const b = a.boss; if (b.attacks >= 3) return { ok: false, msg: 'Out of rally attempts today (3/day)' };
    const { squads } = this.buildSquads(this.s.formation.attack, this.s.troops);
    if (!squads.length) return { ok: false, msg: 'Set your attack formation' };
    const enemy = this.bossSquads(b);
    const seed = (this.now() & 0xffffff);
    const res = simulateBattle(squads, enemy, { seed, maxTurns: 12 });
    const dmg = res.a.reduce((x, s) => x + s.dealt, 0);
    const bossDmg = Math.min(b.hp, Math.round(res.b[0].taken));
    b.hp -= bossDmg; b.myDmg += bossDmg; b.attacks++;
    // AI allies pile on (simulated, labelled in UI)
    const aiDmg = Math.min(b.hp, Math.round(b.max * (0.08 + Math.random() * 0.07)));
    b.hp -= aiDmg;
    const reward = { parts: 5 + Math.floor(bossDmg / 40000), manual: 1, gems: 10 + Math.floor(bossDmg / 100000) };
    let killed = false;
    if (b.hp <= 0) { killed = true; reward.eliteTicket = 1; reward.gems += 100; this.allianceSay(null, `The Behemoth Lv ${b.lvl} has fallen!`, true); b.lvl++; b.max = BOSS_HP(b.lvl); b.hp = b.max; a.gifts.push({ id: this.now(), name: 'Behemoth Spoils', reward: { gems: 50, parts: 20, speed1h: 1 } }); }
    this.give(reward); this.track('boss', 1); a.coins += 50;
    this.addReport({ type: 'boss', title: `Alliance rally vs Behemoth`, win: killed, rewards: reward, a: squads, b: enemy, seed, maxTurns: 12, summary: { a: res.a, b: res.b, turns: res.turns }, note: `You dealt ${bossDmg.toLocaleString()} damage. AI allies dealt ${aiDmg.toLocaleString()}.` });
    return { ok: true, result: res, a: squads, b: enemy, bossDmg, aiDmg, killed, reward, dmg, maxTurns: 12 };
  },
  refreshBoss() { const b = this.s.alliance?.boss; if (b && b.day !== dayKey(this.now())) { b.day = dayKey(this.now()); b.attacks = 0; b.myDmg = 0; } },
  claimGift(id) {
    const a = this.s.alliance; if (!a) return { ok: false };
    const i = a.gifts.findIndex((g) => g.id === id); if (i < 0) return { ok: false };
    const g = a.gifts.splice(i, 1)[0]; this.give(g.reward); return { ok: true, reward: g.reward };
  },
  // Called every tick: AI members chat, help, request help, donate, send gifts
  allianceTick(now) {
    const a = this.s.alliance; if (!a || a.mode !== 'local') return;
    // Helps on my requests
    for (const t of this.allTimers()) {
      const q = t.q;
      if (q.help && (q.helps || 0) < (q.helpCap || 3) && now >= (q.helpNext || 0) && a.members.length) {
        this.applyHelp(q); q.helpNext = now + 2000 + Math.random() * 6000;
        const m = a.members[Math.floor(Math.random() * a.members.length)];
        this.emit('helped', { by: m.name, label: t.label });
      }
    }
    if (a.pendingReply && now >= a.pendingReply) { a.pendingReply = 0; const m = a.members[Math.floor(Math.random() * a.members.length)]; this.allianceSay(m.name, AI_REPLIES[Math.floor(Math.random() * AI_REPLIES.length)]); }
    if (now - a.aiAt < 15000) return;
    const steps = Math.min(20, Math.floor((now - a.aiAt) / 15000)); a.aiAt = now;
    for (let i = 0; i < steps; i++) {
      const r = Math.random(), m = a.members[Math.floor(Math.random() * a.members.length)]; if (!m) break;
      if (r < 0.12) this.allianceSay(m.name, AI_LINES[Math.floor(Math.random() * AI_LINES.length)]);
      else if (r < 0.45 && a.requests.length < 12) a.requests.push({ from: m.name, what: ['Upgrade Barracks', 'Research Smelting', 'Upgrade Command Center', 'Heal troops', 'Upgrade Hydro Farm'][Math.floor(Math.random() * 5)] });
      else if (r < 0.5) { const t = ALLIANCE_TECH[Math.floor(Math.random() * ALLIANCE_TECH.length)]; const lvl = a.tech[t.key] || 0; if (lvl < 10) { a.techXp[t.key] = (a.techXp[t.key] || 0) + 60; if (a.techXp[t.key] >= techCost(lvl)) { a.techXp[t.key] -= techCost(lvl); a.tech[t.key] = lvl + 1; } } }
      else if (r < 0.515 && a.gifts.length < 10) a.gifts.push({ id: now + i, name: `Gift from ${m.name}`, reward: [{ gems: 10 }, { speed5m: 2 }, { parts: 5 }, { food: 2000 }, { manual: 1 }][Math.floor(Math.random() * 5)] });
      else if (r < 0.53 && a.mode === 'local' && a.leader && a.members.length < 30) { const nm = AI_NAMES[Math.floor(Math.random() * 20)] + Math.floor(Math.random() * 99); a.members.push({ name: nm, power: Math.round(15000 + Math.random() * 150000), rank: 1, ai: true, hero: HEROES[Math.floor(Math.random() * 30)].id }); this.allianceSay(null, `${nm} joined the alliance`, true); }
    }
    this.refreshBoss();
  },

  // ---------------- arena (PvP) ----------------
  arenaAttemptsLeft() { const ar = this.s.arena; if (ar.day !== dayKey(this.now())) { ar.day = dayKey(this.now()); ar.attempts = 0; } return ARENA_DAILY_ATTEMPTS - ar.attempts; },
  arenaOpponents(force = false) {
    const ar = this.s.arena;
    if (!force && ar.opponents.length && this.now() < ar.refreshAt) return ar.opponents;
    const myPow = Math.max(800, this.attackPreview().power);
    const rng = mulberry32((this.now() & 0xffffff) ^ this.s.seed);
    ar.opponents = [0.8, 1.0, 1.2].map((mult, i) => {
      const heroIds = [...HEROES].sort(() => rng() - 0.5).slice(0, 2 + Math.min(3, Math.floor(this.lvl('hq') / 3)));
      const pts = Math.round(ar.points + (i - 1) * 60 + (rng() - 0.5) * 40);
      return { id: 'ai' + i + (this.now() % 1000), name: AI_NAMES[Math.floor(rng() * 20)] + Math.floor(rng() * 90 + 10), points: Math.max(0, pts), mult: mult * (0.92 + rng() * 0.16), heroes: heroIds.map((h) => h.id), ai: true, targetPower: Math.round(myPow * mult) };
    });
    ar.refreshAt = this.now() + 10 * 60000;
    return ar.opponents;
  },
  arenaSquadsFor(op) {
    // Build an AI defense team scaled to the requested power
    const lvl = Math.max(1, Math.round(this.lvl('hq') * 1.3));
    const sq = zombieSquads(lvl, { kinds: ['raider'], count: op.heroes.length });
    const base = sidePower(sq), scale = op.targetPower / Math.max(1, base);
    return sq.map((s, i) => { const d = HERO_BY_ID[op.heroes[i]]; return { ...s, zombie: false, name: d.name, heroId: d.id, troopType: d.troop, icon: '⚔️', atk: s.atk * scale, def: s.def * scale, hp: s.hp * scale, troops: Math.round(s.troops * scale), skill: { ...d.skills[0], level: 1 + Math.floor(lvl / 8) }, row: d.role === 'tank' ? 0 : i < 2 ? 0 : 1 }; });
  },
  fightArena(opId, remote) {
    if (this.arenaAttemptsLeft() <= 0) return { ok: false, msg: 'No arena attempts left today' };
    const op = remote || this.s.arena.opponents.find((o) => o.id === opId); if (!op) return { ok: false, msg: 'Opponent not found' };
    const { squads } = this.buildSquads(this.s.formation.attack, this.s.troops);
    if (!squads.length) return { ok: false, msg: 'Set your attack formation' };
    const enemy = remote ? remote.squads : this.arenaSquadsFor(op);
    const seed = this.now() & 0xffffff;
    const res = remote?.result || simulateBattle(squads, enemy, { seed });
    const win = res.winner === 'a';
    const delta = remote?.delta ?? (win ? Math.round(18 + Math.max(0, (op.points - this.s.arena.points) / 20)) : -10);
    this.s.arena.points = Math.max(0, this.s.arena.points + delta); this.s.arena.attempts++;
    if (win) this.s.arena.wins++;
    const rewards = win ? { gems: 15, food: 1500 } : { food: 500 };
    this.give(rewards); this.track('arena', 1);
    this.s.arena.opponents = this.s.arena.opponents.filter((o) => o.id !== opId);
    this.addReport({ type: 'arena', title: `Arena vs ${op.name}${op.ai ? ' (AI)' : ''}`, win, rewards, delta, a: squads, b: enemy, seed: res.seed ?? seed, summary: { a: res.a, b: res.b, turns: res.turns } });
    return { ok: true, win, result: res, a: squads, b: enemy, delta, rewards };
  },
  localLeaderboard() {
    const rng = mulberry32(this.s.seed);
    const me = { name: this.s.player.name, power: this.power(), points: this.s.arena.points, me: true };
    const others = Array.from({ length: 30 }, (_, i) => ({ name: AI_NAMES[i % 20] + (i >= 20 ? '_' + i : ''), power: Math.round(me.power * (0.3 + rng() * 2.2) + i * 500), points: Math.round(900 + rng() * 900), ai: true }));
    return [me, ...others];
  },

  // ---------------- shop ----------------
  shopList() { if (this.s.shop.day !== dayKey(this.now())) this.s.shop = { day: dayKey(this.now()), bought: {} }; return SHOP.map((x) => ({ ...x, def: ITEMS[x.item], left: x.daily - (this.s.shop.bought[x.id] || 0) })); },
  buyShop(id) {
    const it = this.shopList().find((x) => x.id === id); if (!it) return { ok: false };
    if (it.left <= 0) return { ok: false, msg: 'Daily limit reached' };
    if (this.s.gems < it.gems) return { ok: false, msg: 'Not enough gems' };
    this.s.gems -= it.gems; this.track('gems', it.gems); this.s.player.vipPts += Math.round(it.gems / 10);
    this.s.items[it.item] = (this.s.items[it.item] || 0) + it.qty; this.s.shop.bought[id] = (this.s.shop.bought[id] || 0) + 1;
    this.emit('change'); return { ok: true };
  },
  freeSupplyReady() { return (this.s.shop.freeDay || '') !== dayKey(this.now()); },
  claimFreeSupply() { if (!this.freeSupplyReady()) return { ok: false }; this.s.shop.freeDay = dayKey(this.now()); const r = { gems: 30, speed5m: 2, food: 2000, wood: 2000 }; this.give(r); this.give({ vip: 15 }); return { ok: true, reward: r }; },

  // ---------------- mail ----------------
  addMail(title, body, reward) { this.s.inbox.unshift({ id: this.now() + Math.random(), title, body, reward: reward || null, claimed: false, read: false, t: this.now() }); this.emit('change'); },
  claimMail(id) { const m = this.s.inbox.find((x) => x.id === id); if (!m || m.claimed || !m.reward) return { ok: false }; m.claimed = true; this.give(m.reward); return { ok: true, reward: m.reward }; },
};
