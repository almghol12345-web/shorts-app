import { L, t as T, tr } from '../i18n.js';
import { DAILY, DAILY_CHESTS, WEEKLY, ACHIEVEMENTS, STORY, LOGIN_REWARDS, TIMED_EVENTS } from '../data/missions.js';
import { dayKey, weekIndex, weekEnd } from './state.js';

export const missions = {
  track(ev, n = 1) {
    const m = this.s.missions;
    m.daily[ev] = (m.daily[ev] || 0) + n;
    m.weekly[ev] = (m.weekly[ev] || 0) + n;
    m.life[ev] = (m.life[ev] || 0) + n;
    const e = this.currentEvent();
    if (e.def.score[ev]) { const st = this.eventState(); st.pts += e.def.score[ev] * n; }
    if (this.s.alliance && ['zombie', 'build', 'research', 'help', 'donate', 'boss'].includes(ev)) this.s.alliance.contrib = (this.s.alliance.contrib || 0) + n;
    this.emit('progress', { ev, n });
  },
  // ---- daily ----
  dailyList() { const m = this.s.missions; return DAILY.map((d) => ({ ...d, have: Math.min(d.n, m.daily[d.ev] || 0), done: (m.daily[d.ev] || 0) >= d.n, claimed: m.dClaimed.includes(d.id) })); },
  dailyPoints() { return DAILY.filter((d) => this.s.missions.dClaimed.includes(d.id)).reduce((a, d) => a + d.pts, 0); },
  claimDaily(id) {
    const d = DAILY.find((x) => x.id === id), m = this.s.missions;
    if (!d || m.dClaimed.includes(id) || (m.daily[d.ev] || 0) < d.n) return { ok: false };
    m.dClaimed.push(id); this.give(d.reward); this.give({ vip: 10 }); return { ok: true, reward: d.reward };
  },
  chestList() { const pts = this.dailyPoints(); return DAILY_CHESTS.map((c, i) => ({ ...c, i, ready: pts >= c.pts, claimed: this.s.missions.chests.includes(i) })); },
  claimChest(i) {
    const c = DAILY_CHESTS[i], m = this.s.missions;
    if (!c || m.chests.includes(i) || this.dailyPoints() < c.pts) return { ok: false };
    m.chests.push(i); this.give(c.reward); return { ok: true, reward: c.reward };
  },
  // ---- weekly ----
  weeklyList() { const m = this.s.missions; return WEEKLY.map((d) => ({ ...d, have: Math.min(d.n, m.weekly[d.ev] || 0), done: (m.weekly[d.ev] || 0) >= d.n, claimed: m.wClaimed.includes(d.id) })); },
  claimWeekly(id) {
    const d = WEEKLY.find((x) => x.id === id), m = this.s.missions;
    if (!d || m.wClaimed.includes(id) || (m.weekly[d.ev] || 0) < d.n) return { ok: false };
    m.wClaimed.push(id); this.give(d.reward); this.give({ vip: 30 }); return { ok: true, reward: d.reward };
  },
  // ---- achievements ----
  achValue(a) {
    if (a.ev) return this.s.missions.life[a.ev] || 0;
    if (a.calc === 'hq') return this.lvl('hq');
    if (a.calc === 'power') return this.power();
    if (a.calc === 'heroes') return Object.keys(this.s.heroes).length;
    if (a.calc === 'stage') return this.s.campaign.stage;
    return 0;
  },
  achList() {
    return ACHIEVEMENTS.map((a) => {
      const tier = this.s.missions.ach[a.id] || 0, v = this.achValue(a);
      const target = a.tiers[Math.min(tier, a.tiers.length - 1)];
      return { ...a, tier, value: v, target, maxed: tier >= a.tiers.length, ready: tier < a.tiers.length && v >= target, reward: tier < a.tiers.length ? a.reward(tier) : {} };
    });
  },
  claimAch(id) {
    const a = ACHIEVEMENTS.find((x) => x.id === id); const tier = this.s.missions.ach[id] || 0;
    if (!a || tier >= a.tiers.length || this.achValue(a) < a.tiers[tier]) return { ok: false };
    const r = a.reward(tier); this.s.missions.ach[id] = tier + 1; this.give(r); return { ok: true, reward: r };
  },
  // ---- story ----
  storyQuest() {
    const i = this.s.missions.story; const q = STORY[i]; if (!q) return null;
    let have = 0, need = 1;
    if (q.kind === 'ev') { need = q.n; have = Math.min(need, this.s.missions.life[q.ev] || 0); }
    else if (q.kind === 'bld') { need = q.lvl; have = Math.min(need, this.lvl(q.b)); }
    else if (q.kind === 'count') { need = q.n; have = Math.min(need, Object.values(this.s.buildings).filter((b) => b.type === q.b && b.lvl > 0).length); }
    else if (q.kind === 'stage') { need = q.n; have = Math.min(need, this.s.campaign.stage); }
    else if (q.kind === 'alliance') { have = this.s.alliance ? 1 : 0; }
    else if (q.kind === 'star') { have = Object.values(this.s.heroes).some((h) => h.stars >= q.n) ? 1 : 0; }
    return { ...q, i, have, need, done: have >= need };
  },
  claimStory() {
    const q = this.storyQuest(); if (!q || !q.done) return { ok: false };
    this.s.missions.story++; this.give(q.reward); this.addXp(50 + q.i * 20); return { ok: true, reward: q.reward };
  },
  // ---- login ----
  loginState() {
    const l = this.s.login, today = dayKey(this.now());
    const claimedToday = l.claimedDay === today;
    const yesterday = dayKey(this.now() - 86400000);
    const streakAlive = l.claimedDay === yesterday || claimedToday;
    const day = claimedToday ? (l.streak - 1) % 7 : (streakAlive ? l.streak : 0) % 7;
    return { day, claimedToday, streak: streakAlive ? l.streak : 0, rewards: LOGIN_REWARDS };
  },
  claimLogin() {
    const st = this.loginState(); if (st.claimedToday) return { ok: false };
    const l = this.s.login; l.streak = st.streak + 1; l.claimedDay = dayKey(this.now());
    const r = LOGIN_REWARDS[st.day]; this.give(r); this.give({ vip: 20 + Math.min(100, l.streak * 5) });
    return { ok: true, reward: r, day: st.day };
  },
  // ---- timed events ----
  currentEvent() {
    const wk = weekIndex(this.now());
    return { def: TIMED_EVENTS[wk % TIMED_EVENTS.length], key: `${TIMED_EVENTS[wk % TIMED_EVENTS.length].id}-${wk}`, ends: weekEnd(this.now()) };
  },
  eventState() { const e = this.currentEvent(); return (this.s.events[e.key] ||= { pts: 0, claimed: [] }); },
  claimEventMilestone(i) {
    const e = this.currentEvent(), st = this.eventState(), ms = e.def.milestones[i];
    if (!ms || st.claimed.includes(i) || st.pts < ms[0]) return { ok: false };
    st.claimed.push(i); this.give(ms[1]); return { ok: true, reward: ms[1] };
  },
  claimableCount() {
    let n = 0;
    n += this.dailyList().filter((d) => d.done && !d.claimed).length;
    n += this.chestList().filter((c) => c.ready && !c.claimed).length;
    n += this.weeklyList().filter((d) => d.done && !d.claimed).length;
    n += this.achList().filter((a) => a.ready).length;
    return n;
  },
};
