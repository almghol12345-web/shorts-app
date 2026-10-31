import { h, fmt, modal, result, toast, stars, fmtTime } from './dom.js';
import { A } from './app.js';
import { heroImg } from './common.js';
import { HEROES, HERO_BY_ID, ROLE_INFO, STAR_SHARDS, SKILL_UNLOCK, skillUpgradeCost, heroXpFor } from '../data/heroes.js';
import { TROOP_TYPES } from '../data/troops.js';
import { RARITY } from '../data/config.js';
import { GEAR_SLOTS, GEAR_SLOT_INFO, GEAR_RARITY, gearStats } from '../data/items.js';
import { sidePower } from '../core/combat.js';

const SK_ICON = { strike: '🎯', barrage: '💥', pierce: '🏹', heal: '💚', shield: '🛡️', rally: '📯', stun: '⚡', execute: '🗡️', drain: '🩸', taunt: '😤', weaken: '☣️' };
export function heroCard(id, { onclick, locked } = {}) {
  const g = A.g, d = HERO_BY_ID[id], hs = g.s.heroes[id];
  const shards = g.s.shards[id] || 0;
  return h('div.hcard.' + d.rarity + (locked ? '.locked' : ''), { onclick },
    heroImg(id, 128), hs ? h('div.hl', {}, 'Lv ' + hs.lvl) : null,
    h('div.hr', {}, ROLE_INFO[d.role].icon),
    locked ? h('div.sh', {}, h('div.bar', {}, h('div', { style: { width: Math.min(100, shards / 10 * 100) + '%' } }))) : null,
    h('div.hn', {}, d.name, h('br'), hs ? stars(hs.stars) : h('span.muted', {}, `${shards} shards`)));
}

let heroFilter = 'all';
export function openHeroes() {
  const g = A.g;
  modal({ title: 'Heroes', icon: '🦸', tabs: ['Collection', 'Formation', 'Recruit'], render: (m) => {
    if (m.tab === 1) return formationBody('attack', m);
    if (m.tab === 2) { setTimeout(() => { m.tab = 0; m.refresh(); openRecruit(); }, 0); return null; }
    const owned = HEROES.filter((d) => g.s.heroes[d.id]).sort((a, b) => g.heroPower(b.id) - g.heroPower(a.id));
    const rest = HEROES.filter((d) => !g.s.heroes[d.id]);
    const f = (d) => heroFilter === 'all' || d.role === heroFilter || d.troop === heroFilter;
    return [
      h('div.row.wrap', { style: { marginBottom: '8px' } }, ...[['all', 'All'], ['tank', '🛡️'], ['damage', '⚔️'], ['support', '✚'], ['infantry', 'Inf'], ['ranged', 'Rng'], ['vehicle', 'Veh']].map(([k, l]) => h('button.btn.sm' + (heroFilter === k ? '' : '.gray'), { onclick: () => { heroFilter = k; m.refresh(); } }, l))),
      h('div.sec', {}, `Owned ${owned.length} / 30`),
      h('div.grid', {}, ...owned.filter(f).map((d) => heroCard(d.id, { onclick: () => openHero(d.id, () => m.refresh()) }))),
      h('div.sec', {}, 'Not yet recruited'),
      h('div.grid', {}, ...rest.filter(f).map((d) => heroCard(d.id, { locked: true, onclick: () => openHero(d.id) }))),
    ];
  } });
}

export function openHero(id, onChange) {
  const g = A.g, d = HERO_BY_ID[id];
  const m = modal({ title: d.name, icon: ROLE_INFO[d.role].icon, tabs: ['Profile', 'Skills', 'Gear'], onClose: onChange, render: (mm) => {
    const hs = g.s.heroes[id];
    const head = h('div.hprofile', {}, heroImg(id, 160), h('div.grow', {},
      h('div', {}, h('span.rtag.' + d.rarity, {}, RARITY[d.rarity].name), ' ', h('span.muted', {}, d.title)),
      h('div', { style: { margin: '4px 0' } }, `${ROLE_INFO[d.role].icon} ${ROLE_INFO[d.role].name} · ${TROOP_TYPES[d.troop].icon} ${TROOP_TYPES[d.troop].name}`),
      hs ? h('div', {}, stars(hs.stars), ' ', h('b.gold', {}, `Lv ${hs.lvl}/${g.heroLevelCap()}`)) : h('div.bad', {}, 'Not recruited'),
      hs ? h('div.gold', { style: { fontWeight: 800, marginTop: '4px' } }, `⚡ Power ${fmt(g.heroPower(id))}`) : null,
      h('p', { style: { fontStyle: 'italic', margin: '6px 0', color: '#e8d8b8' } }, `“${d.quote}”`)));
    if (mm.tab === 0) {
      const out = [head, h('p.muted', {}, d.bio)];
      const shards = g.s.shards[id] || 0;
      if (!hs) { out.push(h('div.card', {}, h('div', {}, `Shards: ${shards} / 10 to unlock`), h('div.bar', {}, h('div', { style: { width: Math.min(100, shards * 10) + '%' } })), h('button.btn' + (shards >= 10 ? '' : '.off'), { style: { marginTop: '8px', width: '100%' }, onclick: () => { g.s.shards[id] -= 10; g.s.heroes[id] = { lvl: 1, xp: 0, stars: 0, skills: [1, 1, 1], gear: {} }; toast(`${d.name} joined!`, 'good'); mm.refresh(); } }, 'Unlock with shards'))); return out; }
      const st = g.heroStats(id);
      out.push(h('div.card', {}, h('div.stat', {}, h('span', {}, '⚔️ Attack'), h('b', {}, fmt(st.atk))), h('div.stat', {}, h('span', {}, '🛡️ Defense'), h('b', {}, fmt(st.def))), h('div.stat', {}, h('span', {}, '❤️ HP'), h('b', {}, fmt(st.hp))), h('div.stat', {}, h('span', {}, '🎯 Crit'), h('b', {}, Math.round(st.crit * 100) + '%'))));
      const need = heroXpFor(hs.lvl);
      out.push(h('div.card', {}, h('div.row.sp', {}, h('b', {}, 'Level'), h('span.muted', {}, `${fmt(hs.xp)} / ${fmt(need)} XP`)), h('div.bar', { style: { margin: '6px 0' } }, h('div', { style: { width: (hs.xp / need * 100) + '%' } })),
        h('div.muted', {}, `📒 ${g.s.items.xpSmall || 0} · 📕 ${g.s.items.xpBig || 0}`),
        h('button.btn.green' + (hs.lvl >= g.heroLevelCap() ? '.off' : ''), { style: { marginTop: '6px', width: '100%' }, onclick: () => { if (result(g.levelUpHero(id))) mm.refresh(); } }, hs.lvl >= g.heroLevelCap() ? 'Level cap — upgrade Survivor Hall' : 'Level Up')));
      const sneed = STAR_SHARDS[hs.stars];
      out.push(h('div.card', {}, h('div.row.sp', {}, h('b', {}, 'Star Rank'), stars(hs.stars)), hs.stars < 5 ? [h('div.muted', {}, `Shards ${shards} / ${sneed}${d.rarity !== 'SSR' ? ` (+${g.s.items.wildShard || 0} universal)` : ''} — each star: +15% stats, unlocks skills & skill levels`),
        h('button.btn' + (shards + (d.rarity !== 'SSR' ? g.s.items.wildShard || 0 : 0) >= sneed ? '' : '.off'), { style: { marginTop: '6px', width: '100%' }, onclick: () => { if (result(g.starUp(id))) { A.sfx('recruit'); mm.refresh(); } } }, `★ Star Up (${sneed} shards)`)] : h('p.good', {}, 'Max stars!')));
      return out;
    }
    if (!hs) return [head, h('p.muted', {}, 'Recruit this hero to train skills and equip gear.'), ...d.skills.map((s) => skillRow(id, s, null, mm))];
    if (mm.tab === 1) return [h('p.muted', {}, `Skill Manuals: ${g.s.items.manual || 0}. Skill level cap = 2 + stars (max 5).`), ...d.skills.map((s, i) => skillRow(id, s, i, mm))];
    // gear
    return [h('div.grid', { style: { gridTemplateColumns: 'repeat(4,1fr)' } }, ...GEAR_SLOTS.map((slot) => {
      const gid = hs.gear[slot], gr = g.s.gear.find((x) => x.id === gid);
      return h('div.gslot' + (gr ? '.' + gr.rarity : ''), { onclick: () => pickGear(id, slot, mm) }, h('div', { style: { fontSize: '22px' } }, GEAR_SLOT_INFO[slot].icon), gr ? [h('b', { style: { fontSize: '10px' } }, gr.name), h('span.gold', {}, '+' + gr.lvl)] : h('span.muted', {}, GEAR_SLOT_INFO[slot].name));
    })), h('p.muted', {}, 'Tap a slot to equip. Forge and upgrade gear at the Gear Forge (HQ 7).')];
  } });
  return m;
}
function skillRow(id, s, i, m) {
  const g = A.g, hs = g.s.heroes[id];
  const slotName = { active: 'Active', passive: 'Passive', command: 'Command' }[s.slot];
  const unlocked = hs && g.skillUnlocked(id, i);
  const lvl = hs ? hs.skills[i] : 1;
  const icon = s.slot === 'active' ? SK_ICON[s.kind] : s.slot === 'passive' ? '✨' : TROOP_TYPES[s.troop]?.icon || '📣';
  return h('div.card', {}, h('div.skill', {}, h('div.sicon' + (unlocked || !hs ? '' : '.lock'), {}, icon), h('div.grow', {},
    h('div.row.sp', {}, h('b', {}, s.name), h('span.lvl', {}, `${slotName} · Lv ${lvl}`)),
    h('div.muted', {}, s.desc, lvl > 1 ? ` (+${(lvl - 1) * 15}% from level)` : ''),
    hs && !unlocked ? h('div.bad', { style: { fontSize: '12px' } }, `🔒 Unlocks at ${SKILL_UNLOCK[s.slot]}★`) : null,
    hs && unlocked && lvl < 5 ? h('button.btn.sm' + (lvl >= g.skillCap(id) ? '.off' : ''), { style: { marginTop: '6px' }, onclick: () => { if (result(g.upgradeSkill(id, i))) m.refresh(); } }, `Upgrade 📘${skillUpgradeCost(lvl)}`) : null)));
}
function pickGear(heroId, slot, parent) {
  const g = A.g, hs = g.s.heroes[heroId];
  const m = modal({ title: GEAR_SLOT_INFO[slot].name, cls: 'small', icon: GEAR_SLOT_INFO[slot].icon, render: () => {
    const list = g.s.gear.filter((x) => x.slot === slot).sort((a, b) => 'SSR SR R'.indexOf(a.rarity) - 'SSR SR R'.indexOf(b.rarity) || b.lvl - a.lvl);
    const cur = hs.gear[slot];
    return [cur ? h('button.btn.gray', { style: { width: '100%', marginBottom: '8px' }, onclick: () => { g.unequipGear(cur); m.close(); parent.refresh(); } }, 'Unequip current') : null,
      list.length ? null : h('p.muted', {}, 'No gear for this slot yet.'),
      ...list.map((gr) => h('div.li', {}, h('span.ic', { style: { color: GEAR_RARITY[gr.rarity].color } }, GEAR_SLOT_INFO[slot].icon), h('div.grow', {}, h('b', { style: { color: GEAR_RARITY[gr.rarity].color } }, `${gr.name} +${gr.lvl}`), h('div.muted', {}, Object.entries(gearStats(gr)).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(' · '), gr.hero ? ` · on ${HERO_BY_ID[gr.hero].name}` : '')),
        gr.id === cur ? h('b.good', {}, 'Equipped') : h('button.btn.sm', { onclick: () => { g.equipGear(gr.id, heroId); m.close(); parent.refresh(); } }, 'Equip')))];
  } });
}

// ---------------- formation ----------------
export function openFormation(kind = 'attack') {
  modal({ title: kind === 'attack' ? 'Attack Formation' : 'Defense Formation', icon: kind === 'attack' ? '⚔️' : '🛡️', render: (m) => formationBody(kind, m) });
}
let fSel = null;
function formationBody(kind, m) {
  const g = A.g, f = g.s.formation[kind];
  const { squads, power } = kind === 'attack' ? g.attackPreview(f) : { squads: g.buildSquads(f, g.s.troops, { forDefense: true }).squads, power: sidePower(g.buildSquads(f, g.s.troops, { forDefense: true }).squads) };
  const slotEl = (slot) => {
    const e = f.find((x) => x.slot === slot), sq = e && squads.find((s) => s.heroId === e.hero);
    return h('div.fslot' + (slot < 2 ? '.front' : '') + (fSel === slot ? '.sel' : ''), { onclick: () => { fSel = slot; pickHeroFor(kind, slot, m); } },
      e ? [heroImg(e.hero, 128), h('div.tag', {}, `${HERO_BY_ID[e.hero].name}`, h('br'), sq ? `${TROOP_TYPES[sq.troopType].icon} ${fmt(sq.troops)}` : (g.heroBusy(e.hero) && kind === 'attack' ? 'Marching' : 'No troops'))] : (slot < 2 ? '+ Front' : '+ Back'));
  };
  return [
    h('div.card', {}, h('div.row.sp', {}, h('b', {}, '⚡ Squad Power'), h('b.gold.big', {}, fmt(power))), h('div.muted', {}, `Each hero leads up to ${fmt(g.squadCap())} troops (Training Grounds). Troops are assigned automatically, preferring the hero's specialty and highest tier. Front row absorbs hits; tanks belong there.`)),
    h('div.sec', {}, 'Front row'), h('div.formation', {}, slotEl(0), slotEl(1)),
    h('div.sec', {}, 'Back row'), h('div.formation', {}, slotEl(2), slotEl(3), slotEl(4)),
    h('div.row', {}, h('button.btn.gray.grow', { onclick: () => { g.s.formation[kind] = []; m.refresh(); } }, 'Clear'), h('button.btn.grow', { onclick: () => { const ids = Object.keys(g.s.heroes).sort((a, b) => g.heroPower(b) - g.heroPower(a)).slice(0, 5); g.s.formation[kind] = g.autoFormation(ids); m.refresh(); toast('Best heroes assigned', 'good'); } }, 'Auto-Fill')),
    h('div.sec', {}, 'Troops at home'),
    h('div.card', {}, ...Object.entries(g.s.troops).filter(([, n]) => n > 0).map(([k, n]) => h('div.stat', {}, h('span', {}, `${TROOP_TYPES[k.slice(0, -1)].icon} T${k.slice(-1)} ${TROOP_TYPES[k.slice(0, -1)].name}`), h('b', {}, fmt(n)))), g.troopTotal() ? null : h('p.muted', {}, 'No troops. Train them at the Barracks, Rifle Range and Motor Pool.')),
  ];
}
function pickHeroFor(kind, slot, parent) {
  const g = A.g;
  const m = modal({ title: 'Choose Hero', cls: 'small', render: () => {
    const f = g.s.formation[kind];
    const cur = f.find((x) => x.slot === slot);
    const ids = Object.keys(g.s.heroes).sort((a, b) => g.heroPower(b) - g.heroPower(a));
    return [cur ? h('button.btn.gray', { style: { width: '100%', marginBottom: '8px' }, onclick: () => { g.s.formation[kind] = f.filter((x) => x.slot !== slot); m.close(); parent.refresh(); } }, 'Remove from slot') : null,
      h('div.grid.sm', {}, ...ids.map((id) => {
        const inSlot = f.find((x) => x.hero === id);
        return h('div', { style: { position: 'relative' } }, heroCard(id, { onclick: () => {
          let nf = f.filter((x) => x.slot !== slot && x.hero !== id);
          if (inSlot && cur) nf.push({ hero: cur.hero, slot: inSlot.slot });
          nf.push({ hero: id, slot }); g.s.formation[kind] = nf; m.close(); parent.refresh();
        } }), inSlot ? h('div', { style: { position: 'absolute', inset: 0, background: '#0008', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '11px', borderRadius: '10px', pointerEvents: 'none' } }, 'In slot ' + (inSlot.slot + 1)) : null);
      }))];
  } });
}

// ---------------- recruitment ----------------
export function openRecruit() {
  const g = A.g;
  const m = modal({ title: 'Survivor Hall', icon: '🍺', live: true, render: () => {
    const free = g.freeRecruitReady();
    const banner = (kind) => {
      const isE = kind === 'elite';
      const c1 = g.recruitCost(kind, 1), c10 = g.recruitCost(kind, 10);
      const pity = (isE ? 30 : 50) - g.s.recruit[isE ? 'elitePity' : 'pity'];
      return h('div.card' + (isE ? '.hl.shine' : ''), { style: { background: isE ? 'linear-gradient(135deg,#4a2a10,#2a1a30)' : 'linear-gradient(135deg,#2a3a4a,#1a1a22)' } },
        h('div.row.sp', {}, h('div', {}, h('div.big', { style: { color: isE ? '#ffb321' : '#8fc8ff' } }, isE ? '✦ Elite Recruit' : 'Wanderer Recruit'), h('div.muted', {}, isE ? 'Legendary 8% · Epic 37% · Rare 55%' : 'Legendary 2.5% · Epic 17.5% · Rare 80%')), h('div', { style: { display: 'flex', gap: '2px' } }, ...['nyx', 'vex', 'ingrid'].slice(0, isE ? 3 : 1).map((id) => h('img', { src: A.portrait(id, 64), style: { width: '40px', borderRadius: '6px' } })))),
        h('div.muted', { style: { margin: '6px 0' } }, `Guaranteed Legendary in ${pity} pulls · Tickets: ${g.s.items[isE ? 'eliteTicket' : 'ticket'] || 0} ${isE ? '🎟️' : '🎫'}`),
        h('div.row', {},
          !isE ? h('button.btn.green.grow' + (free ? '' : '.off'), { onclick: () => doRecruit('normal', 1, true) }, 'Free', h('span.sub', {}, free ? 'Ready!' : h('span', { 'data-end': g.s.recruit.freeAt }, ''))) : null,
          h('button.btn.blue.grow', { onclick: () => doRecruit(kind, 1) }, 'x1', h('span.sub', {}, c1.tickets ? `${isE ? '🎟️' : '🎫'} 1` : `💎 ${c1.gems}`)),
          h('button.btn.grow', { onclick: () => doRecruit(kind, 10) }, 'x10', h('span.sub', {}, c10.gems ? `${c10.tickets ? (isE ? '🎟️' : '🎫') + c10.tickets + ' + ' : ''}💎 ${c10.gems}` : `${isE ? '🎟️' : '🎫'} 10`))));
    };
    return [banner('elite'), banner('normal'), h('p.muted', {}, `Survivor Hall Lv ${g.lvl('tavern')} · Hero level cap ${g.heroLevelCap()}. Duplicates become shards for star upgrades.`),
      h('button.btn.gray', { style: { width: '100%' }, onclick: () => { m.close(); openHeroes(); } }, 'View Heroes')];
  } });
  function doRecruit(kind, n, free) {
    const r = g.recruit(kind, n, free);
    if (!r.ok) return result(r);
    A.sfx('recruit'); m.refresh(); A.refreshHud(); showRecruitResults(r.results);
  }
}
function showRecruitResults(results) {
  modal({ title: 'Recruited!', cls: 'small', icon: '🎉', render: () => h('div.grid.sm', {}, ...results.map((r, i) => h('div.recruit-reveal', { style: { animationDelay: i * 0.08 + 's' } }, heroCard(r.id, { onclick: () => openHero(r.id) }), h('div', { style: { textAlign: 'center', fontSize: '11px', fontWeight: 800, color: r.isNew ? '#6dd36d' : '#ffd27a' } }, r.isNew ? 'NEW!' : `+${r.shards} shards`)))) });
}
