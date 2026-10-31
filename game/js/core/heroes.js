import { L, t as T, tr } from '../i18n.js';
import { HEROES, HERO_BY_ID, STAR_SHARDS, SKILL_UNLOCK, SKILL_MAX, skillUpgradeCost, heroXpFor, heroBaseStats, DUP_SHARDS } from '../data/heroes.js';
import { heroCap } from '../data/buildings.js';
import { GEAR_SLOTS, GEAR_RARITY, gearStats, gearUpgradeCost, forgeCost, gearName } from '../data/items.js';
import { newHero } from './state.js';
import { mulberry32 } from './rng.js';

const RATES = { normal: { SSR: 0.025, SR: 0.175 }, elite: { SSR: 0.08, SR: 0.37 } };
const PITY = { normal: 50, elite: 30 };
const FREE_RECRUIT_MS = 8 * 3600000;

export const heroes = {
  heroLevelCap() { return heroCap(this.lvl('tavern')); },
  heroStats(id) {
    const def = HERO_BY_ID[id], h = this.s.heroes[id];
    const base = heroBaseStats(def);
    const m = (1 + 0.08 * (h.lvl - 1)) * (1 + 0.15 * h.stars);
    const st = { atk: base.atk * m, def: base.def * m, hp: base.hp * m, crit: 0.05 };
    for (const gid of Object.values(h.gear)) { const g = this.s.gear.find((x) => x.id === gid); if (g) for (const [k, v] of Object.entries(gearStats(g))) st[k] += v; }
    const pas = def.skills[1];
    if (h.stars >= SKILL_UNLOCK.passive) {
      const v = pas.pct * (1 + 0.15 * (h.skills[1] - 1));
      if (pas.stat === 'crit') st.crit += v; else st[pas.stat] *= 1 + v;
    }
    return { atk: Math.round(st.atk), def: Math.round(st.def), hp: Math.round(st.hp), crit: st.crit };
  },
  heroPower(id) { const s = this.heroStats(id); return Math.round((s.atk + s.def) * 1.5 + s.hp * 0.15 + this.s.heroes[id].skills.reduce((a, b) => a + b, 0) * 60); },
  skillUnlocked(id, idx) { const slot = ['active', 'passive', 'command'][idx]; return this.s.heroes[id].stars >= SKILL_UNLOCK[slot]; },
  skillCap(id) { return Math.min(SKILL_MAX, 2 + this.s.heroes[id].stars); },

  heroAddXp(id, xp) {
    const h = this.s.heroes[id]; if (!h) return 0;
    const cap = this.heroLevelCap(); let gained = 0;
    h.xp += xp;
    while (h.lvl < cap && h.xp >= heroXpFor(h.lvl)) { h.xp -= heroXpFor(h.lvl); h.lvl++; gained++; }
    if (h.lvl >= cap) h.xp = Math.min(h.xp, heroXpFor(h.lvl) - 1);
    if (gained) { this.track('heroLevel', gained); this.emit('change'); }
    return gained;
  },
  // Spend XP items until next level (or maxed)
  levelUpHero(id) {
    const h = this.s.heroes[id]; const cap = this.heroLevelCap();
    if (h.lvl >= cap) return { ok: false, msg: L`Level cap ${cap}. Upgrade the Survivor Hall.` };
    const need = heroXpFor(h.lvl) - h.xp;
    let have = 0; const use = { xpSmall: 0, xpBig: 0 };
    while (have < need && (this.s.items.xpSmall || 0) > use.xpSmall) { use.xpSmall++; have += 500; }
    while (have < need && (this.s.items.xpBig || 0) > use.xpBig) { use.xpBig++; have += 5000; }
    if (!have) return { ok: false, msg: 'No XP items. Earn them in the campaign and missions.' };
    this.s.items.xpSmall -= use.xpSmall; this.s.items.xpBig -= use.xpBig;
    this.heroAddXp(id, have);
    return { ok: true };
  },
  starUp(id) {
    const h = this.s.heroes[id], def = HERO_BY_ID[id];
    if (h.stars >= 5) return { ok: false, msg: 'Max stars' };
    const need = STAR_SHARDS[h.stars];
    let own = this.s.shards[id] || 0, wild = 0;
    if (own < need && def.rarity !== 'SSR') wild = Math.min(this.s.items.wildShard || 0, need - own);
    if (own + wild < need) return { ok: false, msg: L`Need ${need} shards (have ${own}${def.rarity !== 'SSR' ? L` + ${this.s.items.wildShard || 0} universal` : ''})` };
    this.s.shards[id] = own - (need - wild); this.s.items.wildShard = (this.s.items.wildShard || 0) - wild;
    h.stars++; this.toast(L`${def.name} is now ${h.stars}★!`, 'good'); this.emit('change');
    return { ok: true };
  },
  upgradeSkill(id, idx) {
    const h = this.s.heroes[id];
    if (!this.skillUnlocked(id, idx)) return { ok: false, msg: L`Unlocks at ${SKILL_UNLOCK[['active', 'passive', 'command'][idx]]}★` };
    if (h.skills[idx] >= this.skillCap(id)) return { ok: false, msg: h.skills[idx] >= SKILL_MAX ? 'Max skill level' : 'Raise stars to unlock higher skill levels' };
    const cost = skillUpgradeCost(h.skills[idx]);
    if ((this.s.items.manual || 0) < cost) return { ok: false, msg: L`Need ${cost} Skill Manuals` };
    this.s.items.manual -= cost; h.skills[idx]++; this.emit('change');
    return { ok: true };
  },

  // ---------------- recruitment ----------------
  freeRecruitReady() { return this.now() >= this.s.recruit.freeAt; },
  recruitCost(kind, n) {
    const ticket = kind === 'elite' ? 'eliteTicket' : 'ticket';
    const have = this.s.items[ticket] || 0;
    const gems = (kind === 'elite' ? 450 : 150) * Math.max(0, n - have) * (n === 10 ? 0.9 : 1);
    return { ticket, tickets: Math.min(have, n), gems: Math.round(gems) };
  },
  recruit(kind = 'normal', n = 1, free = false) {
    if (free) {
      if (kind !== 'normal' || n !== 1 || !this.freeRecruitReady()) return { ok: false, msg: 'Free recruit not ready' };
      this.s.recruit.freeAt = this.now() + FREE_RECRUIT_MS;
    } else {
      const c = this.recruitCost(kind, n);
      if (this.s.gems < c.gems) return { ok: false, msg: 'Not enough gems or tickets' };
      this.s.items[c.ticket] -= c.tickets; this.s.gems -= c.gems; if (c.gems) this.track('gems', c.gems);
    }
    const rng = mulberry32((this.now() ^ (this.s.recruit.pity * 7919) ^ this.s.seed) >>> 0);
    const results = [];
    const pityKey = kind === 'elite' ? 'elitePity' : 'pity';
    for (let i = 0; i < n; i++) {
      this.s.recruit[pityKey]++;
      let r = rng(), rarity = r < RATES[kind].SSR ? 'SSR' : r < RATES[kind].SSR + RATES[kind].SR ? 'SR' : 'R';
      if (this.s.recruit[pityKey] >= PITY[kind]) rarity = 'SSR';
      if (rarity === 'SSR') this.s.recruit[pityKey] = 0;
      const pool = HEROES.filter((h) => h.rarity === rarity);
      const def = pool[Math.floor(rng() * pool.length)];
      const isNew = !this.s.heroes[def.id];
      if (isNew) this.s.heroes[def.id] = newHero();
      else this.s.shards[def.id] = (this.s.shards[def.id] || 0) + DUP_SHARDS[rarity];
      results.push({ id: def.id, rarity, isNew, shards: isNew ? 0 : DUP_SHARDS[rarity] });
    }
    this.track('recruit', n); this.addXp(15 * n);
    this.emit('change');
    return { ok: true, results, pity: PITY[kind] - this.s.recruit[pityKey] };
  },

  // ---------------- gear ----------------
  forgeRarityAllowed(r) { const l = this.lvl('forge'); return r === 'R' ? l >= 1 : r === 'SR' ? l >= 6 : l >= 15; },
  forgeGear(slot, rarity) {
    if (!this.lvl('forge')) return { ok: false, msg: 'Build the Gear Forge first' };
    if (!this.forgeRarityAllowed(rarity)) return { ok: false, msg: L`Forge Lv ${rarity === 'SR' ? 6 : 15} required` };
    if (!GEAR_SLOTS.includes(slot)) return { ok: false, msg: 'Bad slot' };
    const c = forgeCost(rarity);
    if (!this.spend(c)) return { ok: false, msg: 'Not enough materials' };
    const g = { id: this.s.gearSeq++, slot, rarity, lvl: 1, hero: null, name: gearName(slot, rarity) };
    this.s.gear.push(g); this.track('forge', 1); this.toast(L`Forged ${g.name}`, 'good');
    return { ok: true, gear: g };
  },
  grantGear(slot, rarity) { const g = { id: this.s.gearSeq++, slot, rarity, lvl: 1, hero: null, name: gearName(slot, rarity) }; this.s.gear.push(g); return g; },
  equipGear(gearId, heroId) {
    const g = this.s.gear.find((x) => x.id === gearId), h = this.s.heroes[heroId]; if (!g || !h) return { ok: false };
    if (g.hero && this.s.heroes[g.hero]) delete this.s.heroes[g.hero].gear[g.slot];
    const prev = h.gear[g.slot]; if (prev) { const pg = this.s.gear.find((x) => x.id === prev); if (pg) pg.hero = null; }
    h.gear[g.slot] = g.id; g.hero = heroId; this.emit('change'); return { ok: true };
  },
  unequipGear(gearId) {
    const g = this.s.gear.find((x) => x.id === gearId); if (!g || !g.hero) return { ok: false };
    delete this.s.heroes[g.hero].gear[g.slot]; g.hero = null; this.emit('change'); return { ok: true };
  },
  upgradeGear(gearId) {
    const g = this.s.gear.find((x) => x.id === gearId); if (!g) return { ok: false };
    if (g.lvl >= GEAR_RARITY[g.rarity].maxLvl) return { ok: false, msg: 'Max level' };
    if (g.lvl >= this.lvl('forge') * 2 + 2) return { ok: false, msg: 'Upgrade the Gear Forge to raise the gear level cap' };
    const c = gearUpgradeCost(g);
    if ((this.s.items.parts || 0) < c) return { ok: false, msg: L`Need ${c} Gear Parts` };
    this.s.items.parts -= c; g.lvl++; this.emit('change'); return { ok: true };
  },
  salvageGear(gearId) {
    const i = this.s.gear.findIndex((x) => x.id === gearId); if (i < 0) return { ok: false };
    const g = this.s.gear[i]; if (g.hero) this.unequipGear(gearId);
    const back = Math.round((forgeCost(g.rarity).parts + (g.lvl - 1) * gearUpgradeCost({ ...g, lvl: Math.max(1, g.lvl - 1) })) * 0.5);
    this.s.gear.splice(i, 1); this.s.items.parts = (this.s.items.parts || 0) + back; this.emit('change');
    return { ok: true, parts: back };
  },
};
