import { BUILDINGS, BASE_LAYOUT, buildingCost, buildingTime, buildingReqs, maxCountFor, productionPerHour, batch, tierFor, hospitalCap, RESOURCE_TYPES } from '../data/buildings.js';
import { RESEARCH, RESEARCH_BY_ID, researchCost, researchTime } from '../data/research.js';
import { TROOP_TYPES, troopKey, troopCost, troopTime, healCost, parseTroopKey } from '../data/troops.js';
import { BUILDER_QUEUES, COLLECT_CAP_HOURS, gemsForSeconds, gemsForResources, RESOURCES, HELP_PCT, HELP_MIN_SEC } from '../data/config.js';
import { ITEMS } from '../data/items.js';

const HOUR = 3600000;

export const economy = {
  // ---------------- buildings ----------------
  slots() { return BASE_LAYOUT.map((l) => ({ ...l, b: this.s.buildings[l.id] || null, q: this.s.queues.build.find((q) => q.slot === l.id) || null })); },
  buildQueueCap() { return BUILDER_QUEUES + this.vip().queues + (this.s.items.builderPass ? 1 : 0); },

  upgradeInfo(slotId, plotType) {
    const lay = BASE_LAYOUT.find((l) => l.id === slotId); if (!lay) return { ok: false, reason: 'No such plot' };
    const cur = this.s.buildings[slotId];
    const type = cur?.type || lay.type || plotType;
    if (!type) return { ok: false, reason: 'Choose a building' };
    const def = BUILDINGS[type];
    const toLvl = (cur?.lvl || 0) + 1;
    const out = { type, def, toLvl, cost: {}, time: 0, reqs: [], ok: false, reason: '' };
    if (toLvl > def.maxLevel) return { ...out, reason: 'Max level reached' };
    const hq = this.lvl('hq');
    if (!cur) {
      if (hq < def.unlockHQ) return { ...out, reason: `Requires Command Center Lv ${def.unlockHQ}` };
      if (lay.plot && !RESOURCE_TYPES.includes(type)) return { ...out, reason: 'Only resource buildings fit here' };
      if (lay.plot && this.countOf(type) >= maxCountFor(type, hq)) return { ...out, reason: `Max ${def.name} count at this HQ level` };
    }
    out.cost = buildingCost(type, toLvl);
    out.time = Math.max(1, Math.round(buildingTime(type, toLvl) / (1 + this.bonus('build_speed'))));
    out.reqs = buildingReqs(type, toLvl).map((r) => ({ ...r, have: this.lvl(r.b), ok: this.lvl(r.b) >= r.lvl }));
    if (this.s.queues.build.some((q) => q.slot === slotId)) return { ...out, reason: 'Already upgrading' };
    if (out.reqs.some((r) => !r.ok)) { const r = out.reqs.find((x) => !x.ok); return { ...out, reason: `Requires ${BUILDINGS[r.b].name} Lv ${r.lvl}` }; }
    out.gemCost = gemsForSeconds(out.time) + gemsForResources(this.missing(out.cost));
    out.queueFull = this.s.queues.build.length >= this.buildQueueCap();
    out.ok = true;
    return out;
  },
  startUpgrade(slotId, plotType, instant = false) {
    const info = this.upgradeInfo(slotId, plotType);
    if (!info.ok) return { ok: false, msg: info.reason };
    if (instant) {
      if (this.s.gems < info.gemCost) return { ok: false, msg: 'Not enough gems' };
      this.s.gems -= info.gemCost; this.track('gems', info.gemCost);
      for (const r of RESOURCES) if (info.cost[r]) this.s.res[r] -= Math.min(this.s.res[r], info.cost[r]);
      this.completeBuild({ slot: slotId, type: info.type, toLvl: info.toLvl });
      return { ok: true, instant: true };
    }
    if (info.queueFull) return { ok: false, msg: 'All builders are busy' };
    if (!this.canAfford(info.cost)) return { ok: false, msg: 'Not enough resources', missing: this.missing(info.cost) };
    if (BUILDINGS[info.type].produces && this.s.buildings[slotId]) this.collect(slotId);
    this.spend(info.cost);
    const now = this.now();
    this.s.queues.build.push({ slot: slotId, type: info.type, toLvl: info.toLvl, start: now, end: now + info.time * 1000, helps: 0, help: false });
    if (!this.s.buildings[slotId]) this.s.buildings[slotId] = { type: info.type, lvl: 0, collectedAt: now };
    this.emit('change');
    return { ok: true };
  },
  completeBuild(q) {
    const b = this.s.buildings[q.slot] || (this.s.buildings[q.slot] = { type: q.type, lvl: 0, collectedAt: this.now() });
    b.lvl = q.toLvl; b.type = q.type;
    if (BUILDINGS[q.type].produces) b.collectedAt = this.now();
    this.addXp(Math.round(20 * Math.pow(q.toLvl, 1.6) * (q.type === 'hq' ? 3 : 1)));
    this.track('build', 1);
    this.emit('built', q);
    this.toast(`${BUILDINGS[q.type].name} reached Lv ${q.toLvl}`, 'good');
  },
  demolishEmpty(slotId) { const b = this.s.buildings[slotId]; if (b && b.lvl === 0) delete this.s.buildings[slotId]; },

  // ---------------- production ----------------
  rate(res) {
    let r = 0;
    for (const b of Object.values(this.s.buildings)) if (BUILDINGS[b.type].produces === res) r += productionPerHour(b.type, b.lvl);
    return Math.round(r * (1 + this.bonus('prod_' + res)));
  },
  buildingRate(slotId) { const b = this.s.buildings[slotId]; const res = BUILDINGS[b.type].produces; return Math.round(productionPerHour(b.type, b.lvl) * (1 + this.bonus('prod_' + res))); },
  pending(slotId) {
    const b = this.s.buildings[slotId]; if (!b || !BUILDINGS[b.type].produces || b.lvl < 1) return 0;
    if (this.s.queues.build.some((q) => q.slot === slotId)) return 0;
    const hrs = Math.min(COLLECT_CAP_HOURS, (this.now() - b.collectedAt) / HOUR);
    return Math.floor(this.buildingRate(slotId) * hrs);
  },
  pendingFrac(slotId) { const b = this.s.buildings[slotId]; return Math.min(1, (this.now() - b.collectedAt) / HOUR / COLLECT_CAP_HOURS); },
  collect(slotId) {
    const b = this.s.buildings[slotId], v = this.pending(slotId);
    if (!b) return 0;
    b.collectedAt = this.now();
    if (v > 0) { this.s.res[BUILDINGS[b.type].produces] += v; this.track('collect', 1); this.emit('collected', { slotId, v, res: BUILDINGS[b.type].produces }); }
    this.emit('change');
    return v;
  },
  collectAll() { let tot = {}; for (const id of Object.keys(this.s.buildings)) { const b = this.s.buildings[id]; if (BUILDINGS[b.type].produces) { const v = this.collect(id); if (v) tot[BUILDINGS[b.type].produces] = (tot[BUILDINGS[b.type].produces] || 0) + v; } } return tot; },
  protectedAmount() { return Math.round(5000 * Math.pow(1.33, Math.max(0, this.lvl('warehouse') - 1)) * (this.lvl('warehouse') ? 1 : 0.4) * (1 + this.bonus('protect'))); },

  // ---------------- research ----------------
  researchInfo(id) {
    const n = RESEARCH_BY_ID[id], cur = this.s.research[id] || 0, toLvl = cur + 1;
    const out = { node: n, cur, toLvl, ok: false, reason: '', cost: {}, time: 0 };
    if (cur >= n.max) return { ...out, reason: 'Fully researched' };
    if (!this.lvl('research')) return { ...out, reason: 'Build a Research Lab first' };
    if (this.lvl('research') < n.lab) return { ...out, reason: `Requires Research Lab Lv ${n.lab}` };
    for (const p of n.pre) { const [pid, pl] = p.split(':'); if ((this.s.research[pid] || 0) < +pl) return { ...out, reason: `Requires ${RESEARCH_BY_ID[pid].name} Lv ${pl}` }; }
    out.cost = researchCost(n, toLvl);
    out.time = Math.max(1, Math.round(researchTime(n, toLvl) / (1 + this.bonus('research_speed'))));
    if (this.s.queues.research.length) return { ...out, reason: 'Lab is busy' , busy: true };
    out.gemCost = gemsForSeconds(out.time) + gemsForResources(this.missing(out.cost));
    out.ok = true;
    return out;
  },
  researchUnlocked(id) { const n = RESEARCH_BY_ID[id]; return n.pre.every((p) => { const [pid, pl] = p.split(':'); return (this.s.research[pid] || 0) >= +pl; }); },
  startResearch(id, instant = false) {
    const info = this.researchInfo(id); if (!info.ok) return { ok: false, msg: info.reason };
    if (instant) {
      if (this.s.gems < info.gemCost) return { ok: false, msg: 'Not enough gems' };
      this.s.gems -= info.gemCost; this.track('gems', info.gemCost);
      for (const r of RESOURCES) if (info.cost[r]) this.s.res[r] -= Math.min(this.s.res[r], info.cost[r]);
      this.completeResearch({ id, toLvl: info.toLvl }); return { ok: true };
    }
    if (!this.spend(info.cost)) return { ok: false, msg: 'Not enough resources', missing: this.missing(info.cost) };
    const now = this.now();
    this.s.queues.research.push({ id, toLvl: info.toLvl, start: now, end: now + info.time * 1000, helps: 0, help: false });
    return { ok: true };
  },
  completeResearch(q) {
    this.s.research[q.id] = q.toLvl; this.addXp(30 * q.toLvl * (1 + RESEARCH_BY_ID[q.id].lab));
    this.track('research', 1); this.toast(`Research complete: ${RESEARCH_BY_ID[q.id].name} Lv ${q.toLvl}`, 'good'); this.emit('change');
  },
  researchList() { return RESEARCH; },

  // ---------------- training ----------------
  trainInfo(type, tier, count) {
    const bType = TROOP_TYPES[type].building, bl = this.lvl(bType);
    const out = { ok: false, reason: '', max: batch(bl), cost: {}, time: 0 };
    if (!bl) return { ...out, reason: `Build the ${BUILDINGS[bType].name} first` };
    if (tier > tierFor(bl)) return { ...out, reason: `Requires ${BUILDINGS[bType].name} Lv ${[1, 5, 10, 15, 20][tier - 1]}` };
    count = Math.max(1, Math.min(count, out.max));
    const c = troopCost(type, tier);
    for (const [k, v] of Object.entries(c)) out.cost[k] = v * count;
    out.count = count;
    out.time = Math.max(1, Math.round(troopTime(type, tier) * count / (1 + this.bonus('train_speed'))));
    if (this.s.queues.train[bType]) return { ...out, reason: 'Already training', busy: true };
    out.gemCost = gemsForSeconds(out.time) + gemsForResources(this.missing(out.cost));
    out.ok = true;
    return out;
  },
  startTraining(type, tier, count, instant = false) {
    const info = this.trainInfo(type, tier, count); if (!info.ok) return { ok: false, msg: info.reason };
    const bType = TROOP_TYPES[type].building;
    if (instant) {
      if (this.s.gems < info.gemCost) return { ok: false, msg: 'Not enough gems' };
      this.s.gems -= info.gemCost; this.track('gems', info.gemCost);
      for (const r of RESOURCES) if (info.cost[r]) this.s.res[r] -= Math.min(this.s.res[r], info.cost[r]);
      this.completeTraining({ key: troopKey(type, tier), count: info.count }); return { ok: true };
    }
    if (!this.spend(info.cost)) return { ok: false, msg: 'Not enough resources', missing: this.missing(info.cost) };
    const now = this.now();
    this.s.queues.train[bType] = { key: troopKey(type, tier), count: info.count, start: now, end: now + info.time * 1000, helps: 0, help: false };
    return { ok: true };
  },
  completeTraining(q) {
    this.s.troops[q.key] = (this.s.troops[q.key] || 0) + q.count;
    this.track('train', q.count); this.addXp(Math.round(q.count * 0.5));
    const { type, tier } = parseTroopKey(q.key);
    this.toast(`${q.count} T${tier} ${TROOP_TYPES[type].name} ready`, 'good'); this.emit('change');
  },

  // ---------------- hospital ----------------
  hospitalCap() { return Math.round((200 + hospitalCap(this.lvl('hospital'))) * (1 + this.bonus('hospital'))); },
  woundedTotal() { return Object.values(this.s.wounded).reduce((a, b) => a + b, 0); },
  addWounded(lost) { // lost: {key:n}; returns {wounded, dead}
    let room = this.hospitalCap() - this.woundedTotal() - (this.s.queues.heal ? Object.values(this.s.queues.heal.troops).reduce((a, b) => a + b, 0) : 0);
    const w = {}, d = {};
    for (const [k, n] of Object.entries(lost)) {
      const take = Math.max(0, Math.min(room, n)); room -= take;
      if (take) { this.s.wounded[k] = (this.s.wounded[k] || 0) + take; w[k] = take; }
      if (n - take) d[k] = n - take;
    }
    return { wounded: w, dead: d };
  },
  healInfo() {
    const out = { ok: false, cost: {}, time: 0, count: 0 };
    if (this.s.queues.heal) return { ...out, reason: 'Already healing', busy: true };
    const red = Math.min(0.6, this.bonus('heal_speed'));
    for (const [k, n] of Object.entries(this.s.wounded)) {
      if (!n) continue; const { type, tier } = parseTroopKey(k);
      for (const [r, v] of Object.entries(healCost(type, tier))) out.cost[r] = Math.ceil((out.cost[r] || 0) + v * n * (1 - red));
      out.time += troopTime(type, tier) * 0.4 * n; out.count += n;
    }
    if (!out.count) return { ...out, reason: 'No wounded troops' };
    out.time = Math.max(1, Math.round(out.time * (1 - red)));
    out.gemCost = gemsForSeconds(out.time) + gemsForResources(this.missing(out.cost));
    out.ok = true; return out;
  },
  startHeal(instant = false) {
    const info = this.healInfo(); if (!info.ok) return { ok: false, msg: info.reason };
    if (instant) {
      if (this.s.gems < info.gemCost) return { ok: false, msg: 'Not enough gems' };
      this.s.gems -= info.gemCost; this.track('gems', info.gemCost);
      for (const r of RESOURCES) if (info.cost[r]) this.s.res[r] -= Math.min(this.s.res[r], info.cost[r]);
      const troops = { ...this.s.wounded }; this.s.wounded = {};
      this.completeHeal({ troops }); return { ok: true };
    }
    if (!this.spend(info.cost)) return { ok: false, msg: 'Not enough resources', missing: this.missing(info.cost) };
    const now = this.now();
    this.s.queues.heal = { troops: { ...this.s.wounded }, start: now, end: now + info.time * 1000, helps: 0, help: false };
    this.s.wounded = {};
    return { ok: true };
  },
  completeHeal(q) {
    let n = 0; for (const [k, v] of Object.entries(q.troops)) { this.s.troops[k] = (this.s.troops[k] || 0) + v; n += v; }
    this.track('heal', n); this.toast(`${n} troops healed`, 'good'); this.emit('change');
  },

  // ---------------- timers ----------------
  queueRef(kind, key) {
    const Q = this.s.queues;
    if (kind === 'build') return Q.build.find((q) => q.slot === key);
    if (kind === 'research') return Q.research[0];
    if (kind === 'train') return Q.train[key];
    if (kind === 'heal') return Q.heal;
    return null;
  },
  allTimers() {
    const out = [], Q = this.s.queues;
    for (const q of Q.build) out.push({ kind: 'build', key: q.slot, q, label: `${BUILDINGS[q.type].name} → Lv ${q.toLvl}`, icon: BUILDINGS[q.type].icon });
    for (const q of Q.research) out.push({ kind: 'research', key: q.id, q, label: `${RESEARCH_BY_ID[q.id].name} Lv ${q.toLvl}`, icon: '🔬' });
    for (const [b, q] of Object.entries(Q.train)) if (q) { const { type, tier } = parseTroopKey(q.key); out.push({ kind: 'train', key: b, q, label: `${q.count} T${tier} ${TROOP_TYPES[type].name}`, icon: TROOP_TYPES[type].icon }); }
    if (Q.heal) out.push({ kind: 'heal', key: 'heal', q: Q.heal, label: 'Healing wounded', icon: '🏥' });
    return out;
  },
  remaining(q) { return Math.max(0, Math.ceil((q.end - this.now()) / 1000)); },
  speedup(kind, key, itemId) {
    const q = this.queueRef(kind, key); if (!q) return { ok: false, msg: 'Nothing to speed up' };
    const it = ITEMS[itemId]; if (!it || it.kind !== 'speed' || !(this.s.items[itemId] > 0)) return { ok: false, msg: 'No speedup item' };
    this.s.items[itemId]--; q.end -= it.sec * 1000; this.processQueues(this.now()); this.emit('change'); return { ok: true };
  },
  finishNow(kind, key) {
    const q = this.queueRef(kind, key); if (!q) return { ok: false, msg: 'Nothing to finish' };
    const g = gemsForSeconds(this.remaining(q));
    if (this.s.gems < g) return { ok: false, msg: 'Not enough gems' };
    this.s.gems -= g; if (g) this.track('gems', g); q.end = this.now(); this.processQueues(this.now()); this.emit('change'); return { ok: true };
  },
  applyHelp(q) {
    const total = q.end - q.start, cut = Math.max(HELP_MIN_SEC * 1000, total * HELP_PCT);
    q.end -= cut; q.helps = (q.helps || 0) + 1;
  },
  processQueues(now) {
    const Q = this.s.queues;
    const done = Q.build.filter((q) => q.end <= now);
    Q.build = Q.build.filter((q) => q.end > now);
    done.forEach((q) => this.completeBuild(q));
    const rd = Q.research.filter((q) => q.end <= now);
    Q.research = Q.research.filter((q) => q.end > now);
    rd.forEach((q) => this.completeResearch(q));
    for (const [b, q] of Object.entries(Q.train)) if (q && q.end <= now) { delete Q.train[b]; this.completeTraining(q); }
    if (Q.heal && Q.heal.end <= now) { const q = Q.heal; Q.heal = null; this.completeHeal(q); }
  },
};
