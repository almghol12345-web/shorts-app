import { h, fmt, modal, result, toast, rewardChips, ago, confirmBox } from './dom.js';
import { A } from './app.js';
import { ALLIANCE_TECH, ALLIANCE_SHOP, techCost } from '../core/social.js';
import { ITEMS } from '../data/items.js';
import { RES_INFO } from '../data/config.js';
import { heroImg } from './common.js';
import { openBattle } from './battle.js';
import { openFormation } from './heroes.js';

const AIBADGE = () => h('span.aitag', {}, 'AI');
const LIVE = () => h('span.ontag', {}, 'LIVE');

export function openAlliance() {
  const g = A.g;
  if (!g.s.alliance) return openAllianceBrowser();
  const online = g.s.alliance.mode === 'online';
  let poll = null;
  const m = modal({ title: `[${g.s.alliance.tag}] ${g.s.alliance.name}`, icon: '🤝', tabs: ['Members', 'Chat', 'Help', 'Tech', 'Boss', 'Shop'], live: false,
    onClose: () => clearInterval(poll), render: (mm) => {
      const a = g.s.alliance; if (!a) { setTimeout(() => mm.close(), 0); return null; }
      const oa = A.net.alliance;
      const banner = h('div.card', {}, h('div.row.sp', {}, h('div', {}, h('b', {}, online ? 'Online alliance ' : 'Local alliance '), online ? LIVE() : AIBADGE()), h('span.gold', {}, `🪙 ${fmt(a.coins)} coins`)),
        h('div.muted', {}, online ? 'Members, chat, helps, tech and boss are shared through the game server in real time.' : 'Offline mode: members are AI-simulated survivors (marked AI). Log in to a server under Settings to play with real people.'));
      if (mm.tab === 0) {
        const members = online ? (oa?.members || []) : a.members;
        return [banner, h('div.sec', {}, `Members (${members.length + (online ? 0 : 1)})`),
          ...(online ? [] : [h('div.li.me', {}, h('span.ic', {}, '⭐'), h('div.grow', {}, h('b', {}, g.s.player.name), h('div.muted', {}, `Power ${fmt(g.power())}${a.leader ? ' · Leader' : ''}`)))]),
          ...[...members].sort((x, y) => y.power - x.power).map((p) => h('div.li' + (p.uid === A.net.user?.id ? '.me' : ''), {}, p.hero ? h('img', { src: A.portrait(p.hero, 64), style: { width: '36px', borderRadius: '8px' } }) : h('span.ic', {}, '👤'), h('div.grow', {}, h('b', {}, p.name), p.ai ? AIBADGE() : null, h('div.muted', {}, `Power ${fmt(p.power)} · R${p.rank || 1}${p.online ? ' · 🟢 online' : ''}`)))),
          h('button.btn.red.sm', { style: { marginTop: '12px' }, onclick: () => confirmBox('Leave this alliance? Coins are kept.', async () => { if (online) await A.net.leaveAlliance(); g.leaveAlliance(); A.net.alliance = null; mm.close(); }) }, 'Leave Alliance')];
      }
      if (mm.tab === 1) {
        const list = online ? A.net.chat : a.chat;
        const input = h('input.txt', { placeholder: 'Say something…', maxlength: 200, onkeydown: (e) => { if (e.key === 'Enter') send(); } });
        const send = async () => { const t = input.value.trim(); if (!t) return; input.value = ''; if (online) { const r = await A.net.sendChat(t); if (!r.ok) toast(r.msg || 'Not sent', 'bad'); } else g.sendChat(t); mm.refresh(); };
        const chat = h('div.chat', {}, ...list.slice(-60).map((c) => h('div.msg' + (c.system ? '.sys' : (c.me || c.uid === A.net.user?.id) ? '.me' : ''), {}, c.system ? c.text : [h('div.who', {}, c.from, c.ai ? AIBADGE() : null, ' · ', ago(c.t)), c.text])));
        setTimeout(() => { chat.scrollTop = chat.scrollHeight; input.focus?.(); }, 0);
        return [chat, h('div.row', { style: { marginTop: '8px' } }, input, h('button.btn', { onclick: send }, 'Send'))];
      }
      if (mm.tab === 2) {
        const reqs = online ? (oa?.helps || []).filter((x) => x.uid !== A.net.user?.id) : a.requests;
        const mine = g.allTimers().filter((t) => t.kind !== 'train' || true);
        return [banner, h('div.card', {}, h('div.row.sp', {}, h('b', {}, `Requests from members: ${reqs.length}`), h('button.btn.green.sm' + (reqs.length ? '' : '.off'), { onclick: async () => {
          if (online) { const r = await A.net.helpAll(); if (r.ok) { g.s.alliance.coins += Math.min(r.n, 50) * 10; g.track('help', r.n); toast(`Helped ${r.n} members`, 'good'); await A.net.myAlliance(); } else toast(r.msg || 'Failed', 'bad'); }
          else { const r = g.helpAll(); if (r.ok) toast(`Helped ${r.n} members · +${r.coins} coins`, 'good'); }
          mm.refresh();
        } }, 'Help All')), ...reqs.slice(0, 12).map((r) => h('div.muted', {}, `• ${r.from || r.name}: ${r.what || r.label} ${r.helps !== undefined ? `(${r.helps}/${r.cap})` : ''}`))),
          h('div.sec', {}, 'Your timers'),
          ...(mine.length ? mine.map((t) => h('div.li', {}, h('span.ic', {}, t.icon), h('div.grow', {}, h('b', {}, t.label), h('div.muted', {}, t.q.help ? `Helps received ${t.q.helps || 0}/${t.q.helpCap || g.helpCap()}` : 'Each help cuts 1% (min 30s)')),
            h('button.btn.sm.green' + (t.q.help ? '.off' : ''), { onclick: async () => { const r = g.requestHelp(t.kind, t.key); if (r.ok && online) await A.net.requestHelp(t.kind, t.key, t.label); result(r, g, 'Help requested'); mm.refresh(); } }, t.q.help ? 'Asked' : 'Ask'))) : [h('p.muted', {}, 'Start an upgrade, research, training or healing to ask for help.')])];
      }
      if (mm.tab === 3) {
        const tech = online ? (oa?.tech || {}) : a.tech, xp = online ? (oa?.techXp || {}) : a.techXp;
        return [h('p.muted', {}, 'Alliance tech boosts every member. Donate resources for coins.'), ...ALLIANCE_TECH.map((t) => {
          const lvl = tech[t.key] || 0;
          return h('div.tnode', {}, h('div.ic', {}, t.icon), h('div.grow', {}, h('b', {}, `${t.name} Lv ${lvl}/10`), h('div.muted', {}, `+${lvl * 2}% ${t.key.replace(/_/g, ' ')}`), h('div.bar', { style: { marginTop: '4px' } }, h('div', { style: { width: Math.min(100, (xp[t.key] || 0) / techCost(lvl) * 100) + '%' } }))),
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } }, ...['food', 'wood'].map((r) => h('button.btn.sm' + (lvl >= 10 ? '.off' : ''), { onclick: async () => {
              const amt = { food: 2000, wood: 2000 }[r] * (1 + lvl);
              if (online) { if (!g.spend({ [r]: amt })) return toast('Not enough resources', 'bad'); const rr = await A.net.donate(t.key); if (rr.ok) { g.s.alliance.coins += 20; g.track('donate', 1); await A.net.myAlliance(); g.s.alliance.tech = A.net.alliance?.tech || {}; } else { g.give({ [r]: amt }); toast(rr.msg || 'Failed', 'bad'); } }
              else result(g.donateTech(t.key, r));
              mm.refresh();
            } }, `${RES_INFO[r].icon}${fmt({ food: 2000, wood: 2000 }[r] * (1 + lvl))}`))));
        })];
      }
      if (mm.tab === 4) {
        const b = online ? oa?.boss : (g.refreshBoss(), a.boss);
        if (!b) return h('p.muted', {}, 'Loading…');
        return [h('div.card', { style: { textAlign: 'center' } }, h('div', { style: { fontSize: '60px' } }, '👹'), h('div.big.gold', {}, `Behemoth Lv ${b.lvl}`), h('div.bar', { style: { height: '14px', margin: '8px 0' } }, h('div', { style: { width: (b.hp / b.max * 100) + '%', background: 'linear-gradient(90deg,#a02020,#ff5a3a)' } })), h('div', {}, `${fmt(b.hp)} / ${fmt(b.max)} HP`),
          h('div.muted', {}, `Your rallies today: ${online ? (b.myAttacks || 0) : b.attacks}/3 · Your damage today: ${fmt(online ? (b.myDmg || 0) : b.myDmg)}`),
          online ? null : h('div.muted', {}, 'AI members (simulated) add damage after each of your rallies.')),
          h('div.row', {}, h('button.btn.gray.grow', { onclick: () => openFormation('attack') }, 'Formation'), h('button.btn.red.grow', { onclick: async () => {
            if (online) {
              await A.net.pushSave(); const r = await A.net.boss(); if (!r.ok) return toast(r.msg || 'Failed', 'bad');
              g.give(r.reward); g.track('boss', 1); g.s.alliance.coins += 50; await A.net.myAlliance();
              openBattle({ a: r.a, b: r.b, result: r.result, title: 'Alliance Rally', rewards: r.reward, win: r.killed, extra: h('div', {}, `You dealt ${fmt(r.bossDmg)} damage (server-calculated).`), onDone: () => mm.refresh() });
            } else {
              const r = g.rallyBoss(); if (!r.ok) return result(r);
              openBattle({ a: r.a, b: r.b, result: r.result, title: 'Alliance Rally', rewards: r.reward, win: r.killed, extra: h('div', {}, `You dealt ${fmt(r.bossDmg)}. AI allies dealt ${fmt(r.aiDmg)}.`), onDone: () => mm.refresh() });
            }
          } }, '⚔️ Rally Attack'))];
      }
      // shop & gifts
      return [h('div.sec', {}, `Gifts (${a.gifts?.length || 0})`), ...(a.gifts || []).map((gf) => h('div.li', {}, h('span.ic', {}, '🎁'), h('div.grow', {}, h('b', {}, gf.name), rewardChips(gf.reward)), h('button.btn.sm.green', { onclick: () => { g.claimGift(gf.id); mm.refresh(); } }, 'Open'))),
        h('div.sec', {}, `Alliance Shop · 🪙 ${fmt(a.coins)}`), h('div.grid', {}, ...ALLIANCE_SHOP.map((it) => h('div.card', { style: { textAlign: 'center', margin: 0 } }, h('div', { style: { fontSize: '26px' } }, ITEMS[it.item].icon), h('div', { style: { fontSize: '11px', fontWeight: 700 } }, ITEMS[it.item].name), h('button.btn.sm' + (a.coins >= it.coins ? '' : '.off'), { style: { marginTop: '4px' }, onclick: () => { if (result(g.buyAllianceShop(it.id), g, 'Purchased')) mm.refresh(); } }, `🪙${it.coins}`))))];
    } });
  if (online) {
    A.net.myAlliance().then(() => { if (A.net.alliance) { g.s.alliance.tech = A.net.alliance.tech || {}; } m.refresh(); });
    A.net.stream(() => { if (m.tab === 1) m.refresh(); });
    poll = setInterval(async () => { await A.net.myAlliance(); if (!A.net.alliance) return; g.s.alliance.tech = A.net.alliance.tech || {}; if (m.tab !== 1) m.refresh(); }, 6000);
  } else poll = setInterval(() => { if (m.tab === 1 || m.tab === 2) m.refresh(); }, 3000);
}

function openAllianceBrowser() {
  const g = A.g;
  const tabs = ['Join', 'Create'];
  let online = null;
  const m = modal({ title: 'Alliances', icon: '🤝', tabs, render: (mm) => {
    if (mm.tab === 0) {
      const out = [];
      if (A.net.user) {
        out.push(h('div.sec', {}, 'Online alliances ', LIVE()));
        if (!online) { A.net.alliances().then((r) => { online = r.ok ? r.alliances : []; mm.refresh(); }).catch(() => { online = []; mm.refresh(); }); out.push(h('p.muted', {}, 'Loading…')); }
        else if (!online.length) out.push(h('p.muted', {}, 'No online alliances yet — create the first one!'));
        else out.push(...online.map((a) => h('div.li', {}, h('span.ic', {}, '🏴'), h('div.grow', {}, h('b', {}, `[${a.tag}] ${a.name}`), h('div.muted', {}, `${a.members} members · Power ${fmt(a.power)}`)), h('button.btn.sm', { onclick: async () => { const r = await A.net.joinAlliance(a.id); if (!r.ok) return toast(r.msg, 'bad'); g.s.alliance = onlineAlliance(r.alliance); mm.close(); openAlliance(); } }, 'Join'))));
      } else out.push(h('div.card', {}, h('b', {}, 'Play with real people'), h('div.muted', {}, 'Log in to a game server under ⚙️ Settings → Account to see online alliances. Below are AI-simulated alliances for offline play.')));
      out.push(h('div.sec', {}, 'Local alliances ', AIBADGE()));
      out.push(...g.allianceList().map((a) => h('div.li', {}, h('span.ic', { style: { color: a.color } }, '🏴'), h('div.grow', {}, h('b', { style: { color: a.color } }, `[${a.tag}] ${a.name}`), h('div.muted', {}, `${a.members} AI members · Power ${fmt(a.power)}`)), h('button.btn.sm', { onclick: () => { if (result(g.joinLocalAlliance(a.id), g, `Joined ${a.name}`)) { mm.close(); openAlliance(); } } }, 'Join'))));
      return out;
    }
    const name = h('input.txt', { placeholder: 'Alliance name', maxlength: 24 }), tag = h('input.txt', { placeholder: 'TAG (2-4)', maxlength: 4, style: { marginTop: '8px' } });
    return [h('div.card', {}, name, tag, h('div.row', { style: { marginTop: '10px' } },
      A.net.user ? h('button.btn.blue.grow', { onclick: async () => { const r = await A.net.createAlliance(name.value.trim(), tag.value.trim()); if (!r.ok) return toast(r.msg, 'bad'); g.s.alliance = onlineAlliance(r.alliance); mm.close(); openAlliance(); } }, 'Create Online', h('span.sub', {}, 'Free')) : null,
      h('button.btn.grow', { onclick: () => { if (result(g.createLocalAlliance(name.value.trim(), tag.value.trim()), g, 'Alliance founded')) { mm.close(); openAlliance(); } } }, 'Create Local', h('span.sub', {}, '💎 300'))),
      h('p.muted', {}, 'A local alliance recruits AI members over time. An online alliance is shared with real players on the server.'))];
  } });
  void m;
}
export function onlineAlliance(sa) { return { id: sa.id, name: sa.name, tag: sa.tag, color: '#5fd3ff', mode: 'online', members: [], chat: [], tech: sa.tech || {}, techXp: {}, coins: 0, requests: [], gifts: [], boss: null }; }

// ---------------- Arena ----------------
export function openArena() {
  const g = A.g;
  let remote = null;
  const m = modal({ title: 'Arena', icon: '🏟️', live: false, render: (mm) => {
    const left = g.arenaAttemptsLeft();
    const head = h('div.card', {}, h('div.row.sp', {}, h('div', {}, h('div.muted', {}, 'Arena points'), h('div.big.gold', {}, fmt(g.s.arena.points))), h('div', { style: { textAlign: 'right' } }, h('div.muted', {}, 'Attempts today'), h('div.big', {}, `${left}/5`))), h('div.muted', {}, 'Arena fights are simulations — you never lose troops here. Your attack formation fights the opponent\'s defense.'),
      h('div.row', { style: { marginTop: '8px' } }, h('button.btn.gray.sm.grow', { onclick: () => openFormation('attack') }, 'Attack Formation'), h('button.btn.gray.sm.grow', { onclick: () => openFormation('defense') }, 'Defense Formation')));
    const out = [head];
    if (A.net.user) {
      out.push(h('div.sec', {}, 'Real opponents ', LIVE()));
      if (!remote) { A.net.arenaOpponents().then((r) => { remote = r.ok ? r.opponents : []; mm.refresh(); }).catch(() => { remote = []; mm.refresh(); }); out.push(h('p.muted', {}, 'Loading…')); }
      else if (!remote.length) out.push(h('p.muted', {}, 'No other players on the server yet.'));
      else out.push(...remote.map((o) => opRow(o, true)));
    }
    out.push(h('div.sec', {}, 'Practice opponents ', AIBADGE()), ...g.arenaOpponents().map((o) => opRow(o, false)), h('button.btn.gray.sm', { onclick: () => { g.arenaOpponents(true); mm.refresh(); } }, '↻ Refresh'));
    return out;
    function opRow(o, isRemote) {
      return h('div.li', {}, o.hero || o.heroes?.[0] ? h('img', { src: A.portrait(o.hero || o.heroes[0], 64), style: { width: '40px', borderRadius: '8px' } }) : h('span.ic', {}, '👤'),
        h('div.grow', {}, h('b', {}, o.name), isRemote ? null : AIBADGE(), h('div.muted', {}, `🏆 ${fmt(o.points)} · ⚡ ${fmt(o.power || o.targetPower)}`)),
        h('button.btn.sm.red' + (left > 0 ? '' : '.off'), { onclick: async () => {
          if (isRemote) {
            await A.net.pushSave(); const r = await A.net.arenaFight(o.uid); if (!r.ok) return toast(r.msg || 'Failed', 'bad');
            const fr = g.fightArena(null, { name: o.name, points: o.points, squads: r.b, result: r.result, delta: r.delta, seed: r.seed });
            g.s.arena.points = r.points;
            openBattle({ a: r.a, b: r.b, result: r.result, title: `Arena vs ${o.name}`, rewards: fr.rewards, extra: h('div', {}, `Points ${r.delta >= 0 ? '+' : ''}${r.delta}`), onDone: () => { remote = null; mm.refresh(); } });
          } else {
            const r = g.fightArena(o.id); if (!r.ok) return result(r);
            openBattle({ a: r.a, b: r.b, result: r.result, title: `Arena vs ${o.name}`, rewards: r.rewards, extra: h('div', {}, `Points ${r.delta >= 0 ? '+' : ''}${r.delta}`), onDone: () => mm.refresh() });
          }
        } }, 'Fight'));
    }
  } });
  void m;
}

// ---------------- Rankings ----------------
export function openRanking() {
  const g = A.g;
  let remote = {};
  modal({ title: 'Rankings', icon: '🏆', tabs: ['Power', 'Arena'], render: (mm) => {
    const type = mm.tab === 0 ? 'power' : 'arena';
    const out = [];
    if (A.net.user) {
      out.push(h('div.sec', {}, 'Server leaderboard ', LIVE()));
      if (!remote[type]) { A.net.leaderboard(type).then((r) => { remote[type] = r.ok ? r.list : []; mm.refresh(); }).catch(() => { remote[type] = []; mm.refresh(); }); out.push(h('p.muted', {}, 'Loading…')); }
      else out.push(...remote[type].map((p, i) => h('div.li' + (p.uid === A.net.user.id ? '.me' : ''), {}, h('span.rank', {}, i + 1), h('div.grow', {}, h('b', {}, p.name), h('div.muted', {}, p.tag ? `[${p.tag}]` : '')), h('b.gold', {}, fmt(type === 'power' ? p.power : p.points)))));
    } else out.push(h('p.muted', {}, 'Offline: ranking against AI survivors. Log in to a server for a real leaderboard.'));
    const list = g.localLeaderboard().sort((a, b) => (type === 'power' ? b.power - a.power : b.points - a.points));
    out.push(h('div.sec', {}, 'Local ', AIBADGE()), ...list.slice(0, 31).map((p, i) => h('div.li' + (p.me ? '.me' : ''), {}, h('span.rank', {}, i + 1), h('div.grow', {}, h('b', {}, p.name), p.ai ? AIBADGE() : null), h('b.gold', {}, fmt(type === 'power' ? p.power : p.points)))));
    return out;
  } });
}
export { heroImg };
