import { HERO_BY_ID, SKILL_UNLOCK } from '../data/heroes.js';
import { TROOP_TYPES, troopStats, parseTroopKey } from '../data/troops.js';
import { squadCap, BUILDINGS } from '../data/buildings.js';
import { stageInfo, STAGE_COUNT } from '../data/enemies.js';
import { simulateBattle, sidePower } from './combat.js';

export const army = {
  troopTotal(pool = this.s.troops) { return Object.values(pool).reduce((a, b) => a + b, 0); },
  troopPower() {
    let p = 0;
    const add = (pool) => { for (const [k, n] of Object.entries(pool)) { const { type, tier } = parseTroopKey(k); p += n * troopStats(type, tier).power; } };
    add(this.s.troops); for (const m of this.s.marches) add(m.troops);
    return p;
  },
  squadCap() { return Math.round(squadCap(this.lvl('drill')) * (1 + this.bonus('march_size'))); },
  heroBusy(id) { return this.s.marches.some((m) => m.heroes.includes(id)); },

  // Allocate troops to squads; returns combat specs plus composition per squad
  buildSquads(formation, pool, { forDefense = false, ignoreBusy = false } = {}) {
    const avail = { ...pool };
    const cap = this.squadCap();
    const squads = [];
    const used = {};
    const sorted = [...formation].filter((f) => this.s.heroes[f.hero] && (forDefense || ignoreBusy || !this.heroBusy(f.hero))).sort((a, b) => a.slot - b.slot);
    for (const f of sorted) {
      const def = HERO_BY_ID[f.hero], h = this.s.heroes[f.hero], hs = this.heroStats(f.hero);
      const pref = f.troop || def.troop;
      const comp = {};
      let left = cap;
      const take = (type) => {
        for (let t = 5; t >= 1 && left > 0; t--) { const k = type + t; const n = Math.min(left, avail[k] || 0); if (n > 0) { comp[k] = (comp[k] || 0) + n; avail[k] -= n; left -= n; } }
      };
      take(pref);
      if (left === cap) for (const t of Object.keys(TROOP_TYPES)) if (t !== pref) take(t);
      const cmd = def.skills[2], cmdOn = h.stars >= SKILL_UNLOCK.command;
      let atk = hs.atk, dfn = hs.def, hp = hs.hp, n = 0; const typeCount = {};
      for (const [k, cnt] of Object.entries(comp)) {
        const { type, tier } = parseTroopKey(k), st = troopStats(type, tier);
        const cm = (stat) => (cmdOn && (cmd.troop === 'all' || cmd.troop === type) && cmd.stat === stat ? cmd.pct * (1 + 0.15 * (h.skills[2] - 1)) : 0);
        atk += cnt * st.atk * (1 + this.bonus(type + '_atk') + this.bonus('troop_atk') + cm('atk'));
        dfn += cnt * st.def * (1 + this.bonus(type + '_def') + cm('def'));
        hp += cnt * st.hp * (1 + this.bonus('troop_hp') + cm('hp'));
        n += cnt; typeCount[type] = (typeCount[type] || 0) + cnt;
        used[k] = (used[k] || 0) + cnt;
      }
      const troopType = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || def.troop;
      const act = def.skills[0];
      squads.push({
        name: def.name, heroId: def.id, icon: TROOP_TYPES[troopType].icon, color: TROOP_TYPES[troopType].color, row: f.slot < 2 ? 0 : 1,
        atk: Math.round(atk), def: Math.round(dfn), hp: Math.round(hp), troops: n, troopType, crit: hs.crit,
        skill: { ...act, level: h.skills[0] }, vsZombie: this.bonus('zombie_dmg'), vsBoss: this.bonus('boss_dmg'), comp, lvl: h.lvl, stars: h.stars, rarity: def.rarity,
      });
    }
    return { squads, used };
  },
  // Tanks to the front row, everyone else to the back
  autoFormation(heroIds) {
    const order = { tank: 0, damage: 1, support: 2 };
    const ids = [...heroIds].sort((a, b) => order[HERO_BY_ID[a].role] - order[HERO_BY_ID[b].role]);
    const front = ids.filter((id) => HERO_BY_ID[id].role === 'tank').slice(0, 2);
    if (!front.length && ids.length) front.push(ids[0]);
    const back = ids.filter((id) => !front.includes(id));
    while (front.length < 2 && back.length > 3) front.push(back.shift());
    return [...front.map((hero, i) => ({ hero, slot: i })), ...back.slice(0, 3).map((hero, i) => ({ hero, slot: 2 + i }))];
  },
  attackPreview(formation = this.s.formation.attack) { const { squads } = this.buildSquads(formation, this.s.troops); return { squads, power: sidePower(squads) }; },

  defenseSquads() {
    const { squads } = this.buildSquads(this.s.formation.defense, this.s.troops, { forDefense: true });
    const wl = this.lvl('wall');
    if (wl) squads.push({ name: BUILDINGS.wall.name, icon: '🧱', color: '#8a7a6a', row: 0, structure: true, atk: 20 * wl, def: 400 * wl, hp: Math.round(4000 * Math.pow(1.32, wl - 1) * (1 + this.bonus('wall_hp'))), troops: 0 });
    const tl = this.lvl('tower');
    if (tl) squads.push({ name: BUILDINGS.tower.name, icon: '🗼', color: '#6a7a8a', row: 1, structure: true, atk: Math.round(260 * Math.pow(1.3, tl - 1) * 4 * (1 + this.bonus('tower_atk'))), def: 200 * tl, hp: 3000 * tl, troops: 0, troopType: 'ranged' });
    return squads;
  },

  // Distribute losses back onto troop keys proportionally to each squad's composition
  lossesFrom(squads, summary) {
    const lost = {}, survived = {};
    squads.forEach((sq, i) => {
      const r = summary[i]; if (!sq.comp) return;
      const frac = sq.troops ? r.lost / sq.troops : 0;
      let rem = r.lost;
      const entries = Object.entries(sq.comp);
      entries.forEach(([k, n], j) => {
        const l = j === entries.length - 1 ? Math.min(n, rem) : Math.min(n, Math.round(n * frac));
        rem -= l; if (l) lost[k] = (lost[k] || 0) + l;
        if (n - l) survived[k] = (survived[k] || 0) + n - l;
      });
    });
    return { lost, survived };
  },

  addReport(rep) {
    rep.id = this.s.reportSeq++; rep.time = this.now(); rep.read = false;
    this.s.reports.unshift(rep); if (this.s.reports.length > 40) this.s.reports.length = 40;
    this.emit('report', rep);
    return rep;
  },

  // ---------------- campaign ----------------
  stageCount() { return STAGE_COUNT; },
  fightStage(index = this.s.campaign.stage) {
    if (index > this.s.campaign.stage || index >= STAGE_COUNT) return { ok: false, msg: 'Stage locked' };
    const st = stageInfo(index);
    const { squads } = this.buildSquads(this.s.formation.attack, this.s.troops);
    if (!squads.length) return { ok: false, msg: 'Assign heroes to your attack formation first' };
    if (!squads.some((s) => s.troops > 0)) return { ok: false, msg: 'Train some troops first' };
    const enemy = st.squads();
    const seed = (this.now() & 0xffffff) ^ index;
    const res = simulateBattle(squads, enemy, { seed });
    const win = res.winner === 'a';
    let rewards = {};
    if (win) {
      const first = index === this.s.campaign.stage;
      rewards = first ? { ...st.reward, ...st.reward.items } : { food: Math.round(st.reward.food * 0.2), wood: Math.round(st.reward.wood * 0.2), xp: Math.round(st.reward.xp * 0.3) };
      delete rewards.items; const heroXp = rewards.heroXp || Math.round(st.reward.heroXp * 0.3); delete rewards.heroXp;
      this.give(rewards);
      squads.forEach((sq) => this.heroAddXp(sq.heroId, heroXp)); rewards.heroXp = heroXp;
      if (first) { this.s.campaign.stage = index + 1; if (st.boss && Math.random() < 0.7) { const g = this.grantGear(['weapon', 'armor', 'helmet', 'boots'][index % 4], index >= 49 ? 'SSR' : index >= 19 ? 'SR' : 'R'); rewards.gear = g.name; } }
      this.track('pve', 1); if (st.boss) this.track('boss', 0);
    }
    const rep = this.addReport({ type: 'pve', title: `Campaign ${st.name}${st.boss ? ' (Boss)' : ''}`, win, rewards, a: squads, b: enemy, seed, summary: { a: res.a, b: res.b, turns: res.turns } });
    return { ok: true, win, result: res, report: rep, rewards, a: squads, b: enemy };
  },
};
