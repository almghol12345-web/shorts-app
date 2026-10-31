import { h, fmt, fmtTime, modal, result, toast, rewardChips, ago, confirmBox } from './dom.js';
import { A } from './app.js';
import { EVENTS } from '../data/missions.js';
import { ITEMS } from '../data/items.js';
import { VIP_LEVELS, commanderXpFor, GAME_NAME } from '../data/config.js';
import { replayReport } from './battle.js';
import { HEROES } from '../data/heroes.js';
import { setSfx, setMusic } from '../audio.js';
import { goEvent } from './hud.js';

const claimBtn = (ready, claimed, fn, ev) => claimed ? h('b.good', {}, '✓') : ready ? h('button.btn.sm.green', { onclick: fn }, 'Claim') : ev ? h('button.btn.sm.gray', { onclick: () => goEvent(ev) }, 'Go') : h('span.muted', {}, '🔒');
function claimed(r, m) { if (r.ok) { A.sfx('success'); toast('Reward claimed!', 'good'); m.refresh(); A.refreshHud(); } }

export function openMissions(tab = 0) {
  const g = A.g;
  modal({ title: 'Missions', icon: '📋', tabs: ['Story', 'Daily', 'Weekly', 'Achievements'], tab, render: (m) => {
    if (m.tab === 0) {
      const q = g.storyQuest();
      if (!q) return h('p.good', {}, 'All story missions complete — more in future chapters!');
      return [h('div.card.hl', {}, h('div.muted', {}, `Story mission ${q.i + 1}`), h('b', { style: { fontSize: '16px' } }, q.text), h('div.bar', { style: { margin: '8px 0' } }, h('div', { style: { width: (q.have / q.need * 100) + '%' } })), h('div.row.sp', {}, h('span.muted', {}, `${fmt(q.have)} / ${fmt(q.need)}`), claimBtn(q.done, false, () => claimed(g.claimStory(), m), q.ev || (q.kind === 'stage' ? 'pve' : q.kind === 'alliance' ? 'help' : q.kind === 'star' ? 'heroLevel' : 'build'))), h('div.sec', {}, 'Reward'), rewardChips(q.reward))];
    }
    if (m.tab === 1) {
      const pts = g.dailyPoints();
      return [h('div.card', {}, h('div.row.sp', {}, h('b', {}, 'Activity'), h('b.gold', {}, `${pts} / 100`)), h('div.bar', { style: { margin: '6px 0' } }, h('div', { style: { width: Math.min(100, pts) + '%' } })),
        h('div.row', { style: { justifyContent: 'space-around' } }, ...g.chestList().map((c) => h('div', { style: { textAlign: 'center' }, onclick: () => { if (c.ready && !c.claimed) claimed(g.claimChest(c.i), m); else toast(`Reach ${c.pts} activity`); } }, h('div', { style: { fontSize: '26px', filter: c.claimed ? 'grayscale(1)' : c.ready ? 'drop-shadow(0 0 6px #ffd27a)' : 'brightness(.6)' } }, c.claimed ? '📭' : '🎁'), h('div.muted', {}, c.pts))))),
        h('div.muted', {}, `Resets in `, h('span', { 'data-end': (Math.floor(g.now() / 86400000) + 1) * 86400000 }, '')),
        ...g.dailyList().map((d) => h('div.li' + (d.claimed ? '.done' : ''), {}, h('div.grow', {}, h('b', {}, `${EVENTS[d.ev]} (${fmt(d.have)}/${fmt(d.n)})`), h('div.row', {}, h('span.chip', {}, `+${d.pts} activity`), rewardChips(d.reward))), claimBtn(d.done, d.claimed, () => claimed(g.claimDaily(d.id), m), d.ev)))];
    }
    if (m.tab === 2) return g.weeklyList().map((d) => h('div.li', {}, h('div.grow', {}, h('b', {}, `${EVENTS[d.ev]} (${fmt(d.have)}/${fmt(d.n)})`), h('div.bar', { style: { margin: '4px 0' } }, h('div', { style: { width: (d.have / d.n * 100) + '%' } })), rewardChips(d.reward)), claimBtn(d.done, d.claimed, () => claimed(g.claimWeekly(d.id), m), d.ev)));
    return g.achList().map((a) => h('div.li', {}, h('span.ic', {}, '🏅'), h('div.grow', {}, h('b', {}, `${a.name} ${'I II III IV V VI'.split(' ')[Math.min(a.tier, a.tiers.length - 1)]}`), h('div.muted', {}, a.maxed ? 'Completed' : `${fmt(a.value)} / ${fmt(a.target)}`), a.maxed ? null : rewardChips(a.reward)), a.maxed ? h('b.good', {}, '★') : claimBtn(a.ready, false, () => claimed(g.claimAch(a.id), m), a.ev || ({ hq: 'build', power: 'build', heroes: 'recruit', stage: 'pve' })[a.calc])));
  } });
}

export function openEvents() {
  const g = A.g;
  modal({ title: 'Events', icon: '🔥', live: true, tabs: ['Limited Event', 'Login Rewards'], render: (m) => {
    if (m.tab === 1) return loginBody(m);
    const e = g.currentEvent(), st = g.eventState();
    return [h('div.card.hl', { style: { background: 'linear-gradient(135deg,#5a2a10,#2a1a10)' } }, h('div', { style: { fontSize: '40px' } }, e.def.icon), h('div.big.gold', {}, e.def.name), h('p', {}, e.def.desc), h('div.muted', {}, 'Ends in ', h('b', { 'data-end': e.ends }, fmtTime((e.ends - g.now()) / 1000)))),
      h('div.card', {}, h('div.row.sp', {}, h('b', {}, 'Your points'), h('b.gold.big', {}, fmt(st.pts))), h('div.muted', {}, 'Earn: ' + Object.entries(e.def.score).map(([k, v]) => `${EVENTS[k]} (+${v})`).join(' · '))),
      ...e.def.milestones.map(([pts, rw], i) => h('div.li', {}, h('span.ic', {}, st.claimed.includes(i) ? '✅' : st.pts >= pts ? '🎁' : '🔒'), h('div.grow', {}, h('b', {}, `${fmt(pts)} points`), rewardChips(rw)), claimBtn(st.pts >= pts, st.claimed.includes(i), () => claimed(g.claimEventMilestone(i), m)))),
      h('p.muted', {}, 'A new event starts every Monday (UTC). Events rotate: Night of the Horde → Rebuild the World → Warpath.')];
  } });
}
function loginBody(m) {
  const g = A.g, st = g.loginState();
  return [h('p.muted', {}, `Log in every day. Streak: ${st.streak} day(s). Missing a day restarts the cycle.`),
    h('div.grid', {}, ...st.rewards.map((r, i) => h('div.card' + (i === st.day && !st.claimedToday ? '.hl.shine' : ''), { style: { textAlign: 'center', margin: 0, opacity: i < st.day || (i === st.day && st.claimedToday) ? 0.5 : 1 } }, h('b', {}, `Day ${i + 1}`), rewardChips(r), i < st.day || (i === st.day && st.claimedToday) ? h('div.good', {}, '✓') : null))),
    h('button.btn.green' + (st.claimedToday ? '.off' : ''), { style: { width: '100%', marginTop: '10px' }, onclick: () => claimed(g.claimLogin(), m) }, st.claimedToday ? 'Come back tomorrow' : 'Claim today\'s reward')];
}

export function openShop() {
  const g = A.g;
  modal({ title: 'Shop', icon: '🛒', tabs: ['Gem Shop', 'VIP'], render: (m) => {
    if (m.tab === 1) return vipBody();
    return [h('div.card.hl', {}, h('div.row.sp', {}, h('div', {}, h('b', {}, '🎁 Daily Supply Drop'), rewardChips({ gems: 30, speed5m: 2, food: 2000, wood: 2000 })), h('button.btn.green.sm' + (g.freeSupplyReady() ? '' : '.off'), { onclick: () => claimed(g.claimFreeSupply(), m) }, g.freeSupplyReady() ? 'Free' : 'Claimed'))),
      h('p.muted', {}, `💎 ${fmt(g.s.gems)} gems · Earn gems from missions, achievements, events, the campaign and login rewards. Every 10 gems spent here grants 1 VIP point. Real-money purchases are not implemented.`),
      h('div.grid', {}, ...g.shopList().map((it) => h('div.card', { style: { textAlign: 'center', margin: 0 } }, h('div', { style: { fontSize: '28px' } }, it.def.icon), h('div', { style: { fontSize: '11px', fontWeight: 800, minHeight: '28px' } }, it.def.name, it.qty > 1 ? ` x${it.qty}` : ''), h('div.muted', { style: { fontSize: '10px' } }, `${it.left} left today`),
        h('button.btn.sm.blue' + (it.left > 0 && g.s.gems >= it.gems ? '' : '.off'), { style: { marginTop: '4px', width: '100%' }, onclick: () => { if (result(g.buyShop(it.id), g, `Bought ${it.def.name}`)) { m.refresh(); A.refreshHud(); } } }, `💎${it.gems}`))))];
  } });
}
function vipBody() {
  const g = A.g, lvl = g.vipLevel(), cur = VIP_LEVELS[lvl], nx = VIP_LEVELS[lvl + 1];
  return [h('div.card.hl', { style: { textAlign: 'center' } }, h('div.big.gold', {}, `👑 VIP ${lvl}`), nx ? [h('div.bar', { style: { margin: '8px 0' } }, h('div', { style: { width: ((g.s.player.vipPts - cur.pts) / (nx.pts - cur.pts) * 100) + '%' } })), h('div.muted', {}, `${fmt(g.s.player.vipPts)} / ${fmt(nx.pts)} VIP points`)] : h('div', {}, 'Max VIP!'),
    h('p.muted', {}, 'VIP points come from daily logins, missions, supply drops and gem spending.')),
    ...VIP_LEVELS.map((v, i) => h('div.li' + (i === lvl ? '.me' : ''), {}, h('b.rank', {}, i), h('div.grow', {}, h('div.muted', {}, [v.build && `Build +${v.build * 100}%`, v.research && `Research +${v.research * 100}%`, v.queues && `+${v.queues} builder`, v.march && `March +${v.march * 100}%`, v.vigor && `Vigor +${v.vigor}`].filter(Boolean).join(' · ') || 'No perks')), h('span.muted', {}, fmt(v.pts))))];
}

export function openBag() {
  const g = A.g;
  modal({ title: 'Backpack', icon: '🎒', render: (m) => {
    const own = Object.entries(g.s.items).filter(([k, n]) => n > 0 && ITEMS[k]);
    if (!own.length) return h('p.muted', {}, 'Your backpack is empty.');
    return own.map(([k, n]) => {
      const it = ITEMS[k], usable = ['res', 'vigor', 'shield', 'relocate'].includes(it.kind);
      return h('div.li', {}, h('span.ic', {}, it.icon), h('div.grow', {}, h('b', {}, `${it.name} ×${fmt(n)}`), h('div.muted', {}, it.desc)), usable ? h('button.btn.sm', { onclick: () => { if (it.kind === 'relocate') return confirmBox('Move your bastion to a random location?', () => { result(g.useItem(k)); m.refresh(); }); result(g.useItem(k), g); m.refresh(); A.refreshHud(); } }, 'Use') : null);
    });
  } });
}

export function openReports() {
  const g = A.g;
  modal({ title: 'Reports', icon: '📜', render: (m) => {
    if (!g.s.reports.length) return h('p.muted', {}, 'No battle reports yet.');
    return g.s.reports.map((r) => { r.read = true; return h('div.card', {}, h('div.row.sp', {}, h('b.' + (r.win ? 'good' : 'bad'), {}, r.title), h('span.muted', {}, ago(r.time, g.now()))),
      r.note ? h('div.muted', {}, r.note) : null,
      r.intel ? h('div', {}, h('div.muted', {}, `Power ${fmt(r.intel.power)}`), ...r.intel.squads.map((s) => h('div.muted', {}, `${s.icon} ${s.name}: ${fmt(s.troops)} troops`)), r.intel.loot ? [h('div.muted', {}, 'Lootable:'), rewardChips(r.intel.loot)] : null) : null,
      r.rewards && Object.keys(r.rewards).length ? rewardChips(r.rewards) : null,
      r.plundered && Object.keys(r.plundered).length ? h('div.bad', {}, 'Plundered: ', Object.entries(r.plundered).map(([k, v]) => `${k} ${fmt(v)}`).join(', ')) : null,
      r.dead && Object.keys(r.dead).length ? h('div.bad', { style: { fontSize: '12px' } }, `Killed: ${fmt(Object.values(r.dead).reduce((a, b) => a + b, 0))} troops (hospital full)`) : null,
      r.wounded && Object.keys(r.wounded).length ? h('div.muted', {}, `Wounded → hospital: ${fmt(Object.values(r.wounded).reduce((a, b) => a + b, 0))}`) : null,
      r.a && r.b ? h('button.btn.sm.gray', { style: { marginTop: '6px' }, onclick: () => replayReport(r) }, '▶ Watch replay') : null); });
  } });
}

export function openMail() {
  const g = A.g;
  modal({ title: 'Mail', icon: '✉️', render: (m) => g.s.inbox.length ? g.s.inbox.map((ml) => { ml.read = true; return h('div.card', {}, h('div.row.sp', {}, h('b', {}, ml.title), h('span.muted', {}, ago(ml.t, g.now()))), h('p', { style: { margin: '6px 0', fontSize: '13px' } }, ml.body), ml.reward ? h('div.row.sp', {}, rewardChips(ml.reward), ml.claimed ? h('b.good', {}, 'Claimed') : h('button.btn.sm.green', { onclick: () => claimed(g.claimMail(ml.id), m) }, 'Claim')) : null); }) : h('p.muted', {}, 'No mail.') });
}

export function openProfile() {
  const g = A.g, p = g.s.player;
  modal({ title: 'Commander', icon: '🎖️', render: (m) => [
    h('div.row', {}, h('img', { src: A.portrait(p.avatar, 128), style: { width: '90px', borderRadius: '12px', border: '2px solid #ffd27a' } }), h('div.grow', {}, h('div.big', {}, p.name), h('div.muted', {}, `Commander Lv ${p.level} · VIP ${g.vipLevel()}`), h('div.bar', { style: { margin: '6px 0' } }, h('div', { style: { width: (p.xp / commanderXpFor(p.level) * 100) + '%' } })), h('div.muted', {}, `${fmt(p.xp)} / ${fmt(commanderXpFor(p.level))} XP`), h('div.gold', { style: { fontWeight: 800 } }, `⚡ Power ${fmt(g.power())}`))),
    h('div.sec', {}, 'Avatar'),
    h('div.grid.sm', {}, ...Object.keys(g.s.heroes).map((id) => h('img', { src: A.portrait(id, 64), style: { width: '100%', borderRadius: '8px', outline: id === p.avatar ? '3px solid #ffd27a' : 'none' }, onclick: () => { p.avatar = id; m.refresh(); A.refreshHud(); } }))),
    h('div.sec', {}, 'Stats'),
    h('div.card', {}, ...[['Zombies defeated', g.s.missions.life.zombie || 0], ['Buildings upgraded', g.s.missions.life.build || 0], ['Research completed', g.s.missions.life.research || 0], ['Troops trained', g.s.missions.life.train || 0], ['Arena wins', g.s.arena.wins], ['Campaign stage', g.s.campaign.stage]].map(([k, v]) => h('div.stat', {}, h('span', {}, k), h('b', {}, fmt(v))))),
  ] });
}

export function openSettings() {
  const g = A.g, net = A.net;
  modal({ title: 'Settings', icon: '⚙️', tabs: ['Game', 'Account'], render: (m) => {
    if (m.tab === 0) {
      const name = h('input.txt', { value: g.s.player.name, maxlength: 16 });
      return [h('div.card', {}, h('div.row.sp', {}, h('b', {}, '🔊 Sound effects'), h('button.btn.sm' + (g.s.settings.sound ? '.green' : '.gray'), { onclick: () => { g.s.settings.sound = !g.s.settings.sound; setSfx(g.s.settings.sound); m.refresh(); } }, g.s.settings.sound ? 'On' : 'Off')),
        h('div.row.sp', { style: { marginTop: '8px' } }, h('b', {}, '🎵 Ambient music'), h('button.btn.sm' + (g.s.settings.music ? '.green' : '.gray'), { onclick: () => { g.s.settings.music = !g.s.settings.music; setMusic(g.s.settings.music); m.refresh(); } }, g.s.settings.music ? 'On' : 'Off')),
        h('div.row.sp', { style: { marginTop: '8px' } }, h('b', {}, '🌙 Day/night cycle'), h('button.btn.sm' + (!g.s.settings.alwaysDay ? '.green' : '.gray'), { onclick: () => { g.s.settings.alwaysDay = !g.s.settings.alwaysDay; m.refresh(); } }, g.s.settings.alwaysDay ? 'Off' : 'On'))),
        h('div.card', {}, h('b', {}, 'Commander name'), h('div.row', { style: { marginTop: '6px' } }, name, h('button.btn.sm', { onclick: () => { const v = name.value.trim(); if (v.length < 3) return toast('3+ characters', 'bad'); g.s.player.name = v; toast('Name changed', 'good'); A.refreshHud(); } }, 'Save'))),
        h('div.card', {}, h('b', {}, 'Local save'), h('div.muted', {}, 'Progress autosaves to this device every few seconds.'), h('div.row', { style: { marginTop: '8px' } },
          h('button.btn.sm.gray.grow', { onclick: () => { const blob = new Blob([g.serialize()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ashfall-save.json'; a.click(); } }, 'Export'),
          h('button.btn.sm.red.grow', { onclick: () => confirmBox('Erase ALL progress and start over?', () => { localStorage.removeItem('ashfall.save'); location.reload(); }, { yesLabel: 'Erase', cls: 'red' }) }, 'Reset game'))),
        h('p.muted', { style: { textAlign: 'center' } }, `${GAME_NAME} v0.1 · ${HEROES.length} heroes · original game`)];
    }
    const server = h('input.txt', { value: net.base, placeholder: 'Server URL (blank = same origin)' });
    const user = h('input.txt', { placeholder: 'Username', maxlength: 16, style: { marginTop: '8px' } }), pass = h('input.txt', { placeholder: 'Password', type: 'password', style: { marginTop: '8px' } });
    return [h('div.card', {}, h('div.row.sp', {}, h('b', {}, 'Server status'), h('b.' + (net.online ? 'good' : 'bad'), {}, net.online ? '🟢 Online' : '🔴 Offline')),
      h('div.muted', {}, net.online ? 'Connected to the game server.' : 'No server reachable. The game runs fully offline; multiplayer features show AI-simulated content, clearly labeled.'),
      h('div.row', { style: { marginTop: '8px' } }, server, h('button.btn.sm', { onclick: async () => { net.base = server.value.trim().replace(/\/$/, ''); localStorage.setItem('ashfall.server', net.base); await net.probe(); m.refresh(); } }, 'Connect'))),
      net.user ? h('div.card', {}, h('div.row.sp', {}, h('b', {}, `👤 ${net.user.name}`), h('span.muted', {}, net.lastSync ? 'Synced ' + ago(net.lastSync) : '')),
        h('div.row', { style: { marginTop: '8px' } }, h('button.btn.sm.blue.grow', { onclick: async () => { const r = await net.pushSave(); result(r, g, 'Saved to cloud'); m.refresh(); } }, '☁️ Upload save'), h('button.btn.sm.gray.grow', { onclick: async () => { const r = await net.pullSave(); if (!r.ok || !r.save) return toast(r.msg || 'No cloud save', 'bad'); confirmBox('Replace this device\'s progress with the cloud save?', () => { localStorage.setItem('ashfall.save', JSON.stringify(r.save)); location.reload(); }); } }, '⬇️ Load cloud')),
        h('button.btn.sm.red', { style: { marginTop: '8px' }, onclick: () => { net.logout(); m.refresh(); } }, 'Log out'))
        : net.online ? h('div.card', {}, h('b', {}, 'Account'), user, pass, h('div.row', { style: { marginTop: '10px' } },
          h('button.btn.gray.grow', { onclick: async () => { const r = await net.login(user.value.trim(), pass.value); if (!r.ok) return toast(r.msg, 'bad'); toast('Welcome back!', 'good'); const s = await net.pullSave(); if (s.ok && s.save && s.save.player?.level > g.s.player.level) confirmBox('A cloud save with more progress exists. Load it?', () => { localStorage.setItem('ashfall.save', JSON.stringify(s.save)); location.reload(); }); else await net.pushSave(); m.refresh(); } }, 'Log in'),
          h('button.btn.grow', { onclick: async () => { const r = await net.register(user.value.trim(), pass.value); if (!r.ok) return toast(r.msg, 'bad'); g.s.player.name = r.user.name; await net.pushSave(); toast('Account created & progress uploaded', 'good'); m.refresh(); A.refreshHud(); } }, 'Register'))) : null,
      h('div.card', {}, h('b', {}, 'What the server does'), h('ul.muted', { style: { paddingLeft: '18px', margin: '6px 0' } }, h('li', {}, 'Accounts & cloud saves'), h('li', {}, 'Real leaderboards'), h('li', {}, 'Online alliances with live chat, helps, shared tech and a shared boss'), h('li', {}, 'PvP raids and arena fights computed on the server from both players\' saved armies'), h('li', {}, 'Other players\' bastions appear on your world map')))];
  } });
}
