import { L, t as T, tr } from '../i18n.js';
import { h, fmt, modal, result, rewardChips } from './dom.js';
import { A } from './app.js';
import { CHAPTERS, stageInfo, STAGE_COUNT, enemyPower } from '../data/enemies.js';
import { openBattle } from './battle.js';
import { openFormation } from './heroes.js';

export function openCampaign() {
  const g = A.g;
  let ch = Math.min(CHAPTERS.length - 1, Math.floor(g.s.campaign.stage / 10));
  const m = modal({ title: 'Campaign', icon: '🗺️', render: () => {
    const cur = g.s.campaign.stage;
    const my = g.attackPreview().power;
    return [
      h('div.row.sp', {}, h('button.btn.sm.gray' + (ch > 0 ? '' : '.off'), { onclick: () => { ch--; m.refresh(); } }, h('span.flip', {}, '‹')), h('div', { style: { textAlign: 'center' } }, h('div.muted', {}, L`Chapter ${ch + 1}`), h('div.big.gold', {}, CHAPTERS[ch].name)), h('button.btn.sm.gray' + (ch < CHAPTERS.length - 1 && cur >= (ch + 1) * 10 ? '' : '.off'), { onclick: () => { ch++; m.refresh(); } }, h('span.flip', {}, '›'))),
      h('div.card', { style: { margin: '10px 0' } }, h('div.row.sp', {}, h('span', {}, 'Your squad power'), h('b.gold', {}, fmt(my))), h('button.btn.sm.gray', { style: { marginTop: '6px' }, onclick: () => openFormation('attack') }, '⚔️ Edit Formation')),
      h('div', { style: { position: 'relative' } }, ...Array.from({ length: 10 }, (_, i) => {
        const idx = ch * 10 + i, st = stageInfo(idx), done = idx < cur, isCur = idx === cur, locked = idx > cur;
        const pow = enemyPower(st.squads());
        return h('div.li' + (isCur ? '.me' : ''), { style: { marginLeft: (i % 2 ? 40 : 0) + 'px', opacity: locked ? 0.45 : 1 }, onclick: () => !locked && openStage(idx, m) },
          h('span.ic', {}, st.boss ? '👹' : done ? '✅' : isCur ? '⚔️' : '🔒'),
          h('div.grow', {}, h('b', {}, L`Stage ${st.name}${st.boss ? ' · BOSS' : ''}`), h('div.muted', {}, L`Enemy power ${fmt(pow)}`)),
          isCur ? h('b.' + (my >= pow ? 'good' : 'bad'), {}, my >= pow ? 'Ready' : 'Tough') : null);
      })),
      cur >= STAGE_COUNT ? h('p.good', {}, 'Campaign complete! More chapters coming in future updates.') : null,
    ];
  } });
}
function openStage(idx, parent) {
  const g = A.g, st = stageInfo(idx), enemy = st.squads();
  const m = modal({ title: L`Stage ${st.name}`, cls: 'small', icon: st.boss ? '👹' : '⚔️', render: () => [
    h('div.card', {}, h('div.sec', {}, 'Enemies'), ...enemy.map((e) => h('div.stat', {}, h('span', {}, L`${e.icon} ${e.name}`), h('b', {}, L`${fmt(e.troops)} · ⚡${fmt((e.atk + e.def) * 0.6 + e.hp * 0.05)}`))),
      h('div.stat', {}, h('span', {}, 'Total enemy power'), h('b.bad', {}, fmt(enemyPower(enemy)))), h('div.stat', {}, h('span', {}, 'Your power'), h('b.gold', {}, fmt(g.attackPreview().power)))),
    h('div.sec', {}, idx < g.s.campaign.stage ? 'Repeat rewards (20%)' : 'First clear rewards'),
    rewardChips(idx < g.s.campaign.stage ? { food: Math.round(st.reward.food * 0.2), wood: Math.round(st.reward.wood * 0.2) } : { ...st.reward, ...st.reward.items, items: undefined }),
    h('p.muted', {}, 'Campaign battles do not cost troops.'),
    h('div.row', {}, h('button.btn.gray.grow', { onclick: () => openFormation('attack') }, 'Formation'), h('button.btn.red.grow', { onclick: () => {
      const r = g.fightStage(idx); if (!r.ok) return result(r);
      m.close();
      openBattle({ a: r.a, b: r.b, result: r.result, title: L`Stage ${st.name}`, rewards: r.win ? r.rewards : null, onDone: () => parent.refresh() });
    } }, '⚔️ Fight')),
  ] });
}
