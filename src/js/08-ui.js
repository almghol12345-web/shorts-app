/* ================= UI shell ================= */
let tab = 'base', modalFn = null, modalFull = false;
const TABS = [['base', '🏚️'], ['heroes', '🦸'], ['campaign', '⚔️'], ['world', '🗺️'], ['alliance', '🤝']];
function renderTabs() {
  const dots = { base: hasEventDot(), heroes: heroDot(), alliance: S.alliance && S.alliance.gift !== today() };
  $('#tabs').innerHTML = TABS.map(([k, i]) => `<button class="tab ${tab === k ? 'on' : ''}" data-a="tab" data-x="${k}">${dots[k] ? '<span class="dot"></span>' : ''}<span class="ti">${i}</span>${t('tab_' + k)}</button>`).join('');
}
function renderTop() {
  $('#pname').textContent = S.name || t('commander');
  $('#pav').textContent = (S.name || t('commander')).trim()[0] || 'C';
  $('#clv').textContent = S.cmd.lv;
  $('#xpi').style.width = clamp(S.cmd.xp / xpNeed(S.cmd.lv) * 100, 0, 100) + '%';
  $('#ppow').textContent = fmt(totalPower());
  $('#powl').textContent = t('power');
  $('#vipb').textContent = 'VIP ' + vipLv();
  for (const k of ['food', 'wood', 'iron', 'fuel', 'gems']) $('#r-' + k).textContent = fmt(S.res[k]);
}
function render() {
  if (tab !== 'world') stopWorld();
  const v = $('#view'); const st = v.scrollTop;
  const ci = $('#chatin'), cv = ci ? ci.value : '', cf = ci && document.activeElement === ci;
  v.classList.toggle('fixed', tab === 'world');
  v.innerHTML = VIEWS[tab]();
  v.scrollTop = st;
  if (tab === 'world') mountWorld();
  if (tab === 'alliance') { const c = v.querySelector('.chat'); if (c) c.scrollTop = c.scrollHeight; const ni = $('#chatin'); if (ni && cv) { ni.value = cv; if (cf) ni.focus(); } }
  renderTop(); renderTabs(); tickUI();
}
function openModal(fn, full) { modalFn = fn; modalFull = !!full; renderModal(true); }
function renderModal(fresh) {
  const m = $('#modal');
  if (!modalFn) { m.hidden = true; m.innerHTML = ''; m.classList.remove('full'); return; }
  const prev = m.querySelector('.sh-b'), sc = prev && !fresh ? prev.scrollTop : 0;
  const focusId = document.activeElement && document.activeElement.id, vals = {};
  m.querySelectorAll('input[id],textarea[id],select[id]').forEach(e => { if (e.type !== 'range') vals[e.id] = e.value; });
  m.classList.toggle('full', modalFull);
  m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${modalFn()}</div>`; m.hidden = false;
  if (!fresh) for (const id in vals) { const e = document.getElementById(id); if (e && e.dataset.keep !== '0') e.value = vals[id]; }
  if (focusId) { const e = document.getElementById(focusId); if (e && e.focus) e.focus(); }
  const nb = m.querySelector('.sh-b'); if (nb) nb.scrollTop = sc;
  tickUI();
}
function closeModal() { modalFn = null; renderModal(); setTimeout(nextPopup, 250); }
function refresh() { render(); if (modalFn) renderModal(); tickUI(); }
function sheet(icon, title, sub, body) { return `<div class="sh-h"><div class="hi">${icon}</div><div class="htx"><h2>${title}</h2>${sub ? `<div class="muted">${sub}</div>` : ''}</div><button class="x" data-a="close" aria-label="${t('close')}">✕</button></div><div class="sh-b">${body}</div>`; }
const hname = id => L(HB[id].n);
const avHTML = (id, cls = '') => { const h = HB[id]; return `<span class="av c-${h.c} r${h.r} ${cls}"><img src="${portraitURI(id)}" alt="${esc(hname(id))}" draggable="false"></span>`; };
const cardHTML = (id, inner) => { const h = HB[id]; return `<span class="pcard r${h.r}"><img src="${portraitURI(id)}" alt="" draggable="false"><span class="pcl">${CLS[h.c].i}</span>${inner || ''}</span>`; };
const starsHTML = st => `<span class="stars">${'★'.repeat(st)}<span class="off">${'★'.repeat(5 - st)}</span></span>`;
function hasEventDot() {
  ensureDaily(); if (S.login.last !== today()) return true;
  const pts = dailyPoints(); if (CHESTS.some((c, i) => pts >= c.p && !S.daily.c['chest' + i])) return true;
  if (DAILY.some(d => (S.daily.p[d.k] || 0) >= d.g && !S.daily.c[d.k])) return true;
  wbReset(); return S.wb.tries === 0;
}
function heroDot() { if (S.inv.ticket > 0) return true; return ownedHeroes().some(id => { const h = S.heroes[id]; return h.st < 5 && h.sh >= starNeed(h.st); }); }
const passDot = () => { ensurePass(); for (let i = 1; i <= passTier(); i++) { if (!S.pass.f[i]) return true; if (hasPrem() && !S.pass.p[i]) return true; } return false; };
const newsDot = () => NET.news.some(n => n.at > (S.newsSeen || 0));

/* ================= views ================= */
const VIEWS = {};
VIEWS.base = () => {
  const q = QUESTS[S.quest]; const qd = q && q[1]();
  const siegeIn = S.siegeAt - now();
  const evs = activeEvents().filter(e => e.type !== 'boss');
  const offer = !S.starter.bought && S.starter.shown && IAPB.starter;
  const shortcuts = [
    ['events', '🎁', t('sc_events'), hasEventDot()], ['quests', '📋', t('sc_quests'), false], ['wheel', '🎡', t('sc_wheel'), wheelFree() || S.inv.spin > 0],
    ['pass', '🎖️', t('sc_pass'), passDot()], ['shop', '🛒', t('sc_shop'), cardActive() && S.card.last !== today()],
    ['rank', '🏆', t('sc_rank'), false], ['achs', '🏅', t('sc_achs'), achDot()], ['mail', '✉️', t('sc_mail'), newsDot()],
    ['bag', '🎒', t('sc_bag'), false], ['collectAll', '🧺', t('sc_collect'), false],
  ];
  return `<div class="base-wrap">
  ${hqLv() >= 2 && siegeIn < 120000 ? `<div class="banner siege">🧟 <span class="grow">${t('siege_in')} <b class="num" data-end="${S.siegeAt}"></b></span></div>` : ''}
  ${evs.map(e => `<button class="banner ev" data-a="events"><span>⚡</span><span class="grow">${esc(L(e.title))}</span>${e.ends ? `<b class="num" data-end="${e.ends}"></b>` : ''}</button>`).join('')}
  ${offer ? `<button class="banner offer" data-a="starter"><span>🎁</span><span class="grow">${t('starter_banner')}</span><b>${priceStr(IAPB.starter)}</b></button>` : ''}
  ${q ? `<div class="quest"><span class="qk">${t('quest')}</span><span class="qt">${q[0]()}</span>${qd ? `<button class="btn gold sm" data-a="qclaim">${t('claim')}</button>` : `<button class="btn sm ${S.quest < 6 ? 'hint' : ''}" data-a="qgo">${t('go')}</button>`}</div>` : `<div class="quest"><span class="qk">${t('quest')}</span><span class="qt">${t('quests_done')}</span></div>`}
  <div class="shortcuts">${shortcuts.map(([a, i, n, d]) => `<button class="sc" data-a="${a}">${d ? '<span class="dot"></span>' : ''}<span class="si">${i}</span>${n}</button>`).join('')}</div>
  <div class="compound">${PLOTS.map(tileHTML).join('')}</div>
  <div class="builders"><h3>${t('builders')} ${S.builds.length}/${maxBuilders()}</h3>
  ${S.builds.length ? S.builds.map(b => `<button class="bq" data-a="bld" data-x="${b.k}"><span>${BT[PLOT[b.k].t].i}</span><span>${L(BT[PLOT[b.k].t].n)} → ${b.to}</span><span class="prog"><i data-bar data-st="${b.st}" data-en="${b.end}"></i></span><b class="num" data-end="${b.end}"></b></button>`).join('') : `<div class="bq muted">${t('builders_idle')}</div>`}
  ${S.rq ? `<button class="bq" data-a="bld" data-x="lab"><span>🔬</span><span>${L(TECH[S.rq.k].n)}</span><span class="prog"><i data-bar data-st="${S.rq.st}" data-en="${S.rq.end}"></i></span><b class="num" data-end="${S.rq.end}"></b></button>` : ''}
  ${S.tq ? `<button class="bq" data-a="bld" data-x="barracks"><span>🎖️</span><span>${t('training_n', S.tq.n)}</span><span class="prog"><i data-bar data-st="${S.tq.st}" data-en="${S.tq.end}"></i></span><b class="num" data-end="${S.tq.end}"></b></button>` : ''}
  </div></div>`;
};
function tileHTML(p) {
  const b = S.b[p.k], T = BT[p.t], q = S.builds.find(x => x.k === p.k), hq = p.t === 'hq' ? ' hq' : '';
  if (hqLv() < p.u) return `<div class="tile locked${hq}" role="button" tabindex="0" data-a="locked" data-x="${p.u}"><span class="ti dim">🔒</span><span class="tn">${L(T.n)}</span><span class="ts">${t('hq_short', p.u)}</span></div>`;
  if (!b.lv && !q) return `<div class="tile empty${hq}" role="button" tabindex="0" data-a="bld" data-x="${p.k}"><span class="ti dim">${T.i}</span><span class="tn">${L(T.n)}</span><span class="ts">+ ${t('build')}</span></div>`;
  const bub = T.prod && b.lv ? `<button class="bub" data-acc="${p.k}" data-a="collect" data-x="${p.k}" hidden>${RES[T.prod].i}<span></span></button>` : '';
  return `<div class="tile${hq}${q ? ' busy' : ''}" role="button" tabindex="0" data-tile="${p.k}" data-a="bld" data-x="${p.k}">${bub}${b.lv ? `<span class="lv num">${b.lv}</span>` : ''}${!q && canUpgradeNow(p.k) ? '<span class="upok">↑</span>' : ''}<span class="ti">${T.i}</span><span class="tn">${L(T.n)}</span>${q ? `<span class="tt num" data-end="${q.end}"></span><span class="prog tbar"><i data-bar data-st="${q.st}" data-en="${q.end}"></i></span>` : ''}</div>`;
}
VIEWS.heroes = () => {
  const own = ownedHeroes().sort((a, b) => heroPower(b) - heroPower(a));
  const lockd = HEROES.filter(h => !S.heroes[h.id]).sort((a, b) => b.r - a.r);
  const slot = i => { const id = S.squad[i]; return `<button class="slot" data-a="slot" data-x="${i}">${id ? avHTML(id) : '<span class="empty">+</span>'}<span>${id ? esc(hname(id)) : t('empty')}</span></button>`; };
  return `<div class="pad">
  <div class="row between"><div><h2>${t('squad')}</h2><div class="muted">${t('squad_power')} <b class="num" style="color:var(--amber)">${fmt(teamPower())}</b> · ${t('troop_bonus')} +${Math.round(troopBonus() * 100)}%</div></div>
  <button class="btn pri" data-a="openRecruit">🎟️ ${t('recruit')}${S.inv.ticket ? ` (${S.inv.ticket})` : ''}</button></div>
  <div class="formation"><div class="flabel">${t('front_row')}</div><div class="frow">${slot(0)}${slot(1)}</div><div class="flabel">${t('back_row')}</div><div class="frow">${slot(2)}${slot(3)}${slot(4)}</div>
  <button class="btn sm" data-a="autoSquad" style="justify-self:center">✨ ${t('auto_squad')}</button></div>
  <div class="row between"><h3>${t('your_heroes')} ${own.length}/${HEROES.length}</h3><span class="cc">✨ ${fmt(S.res.exp)}</span></div>
  <div class="roster">${own.map(id => { const Hh = HB[id], h = S.heroes[id]; const dot = (h.st < 5 && h.sh >= starNeed(h.st)) || (h.lv < heroCap(lvOf('tavern')) && S.res.exp >= lvCost(h.lv)); return `<button class="hc r${Hh.r}" data-a="hero" data-x="${id}">${S.squad.includes(id) ? `<span class="in">${t('in_squad')}</span>` : ''}${dot ? '<span class="dot"></span>' : ''}${cardHTML(id, `<span class="plv num">Lv ${h.lv}</span>`)}<b>${esc(hname(id))}</b>${starsHTML(h.st)}<small>💪 ${fmt(heroPower(id))}</small></button>`; }).join('')}
  ${lockd.map(Hh => `<div class="hc lockd">${cardHTML(Hh.id, '<span class="plock">🔒</span>')}<b>${esc(L(Hh.n))}</b><small style="color:${RAR[Hh.r].c}">${L(RAR[Hh.r].n)}</small></div>`).join('')}</div>
  </div>`;
};
function stageWaves(s) {
  const W = []; for (let w = 0; w < 3; w++) {
    const n = Math.min(28, 5 + Math.floor(s * .7) + w * 2), a = [];
    for (let i = 0; i < n; i++) { const r = Math.random(); let tp = 'w'; if (s >= 7 && r < .1) tp = 'br'; else if (s >= 5 && r < .25) tp = 'sp'; else if (s >= 3 && r < .45) tp = 'run'; a.push(tp); }
    if (w === 2 && s % 5 === 0) a.push('boss'); W.push(a);
  }
  return W;
}
function stageReward(s) { const m = Math.pow(s, 1.35); const r = { food: Math.round(200 * m), wood: Math.round(200 * m), iron: Math.round(90 * m), exp: Math.round(120 * Math.pow(s, 1.3)), gems: s % 5 === 0 ? 120 : 25 }; if (s % 5 === 0) r.ticket = 1; return mulR(r, evMult('reward')); }
VIEWS.campaign = () => {
  const s = S.stage, rp = recPower(s), my = teamPower();
  const types = ['w']; if (s >= 3) types.push('run'); if (s >= 5) types.push('sp'); if (s >= 7) types.push('br'); if (s % 5 === 0) types.push('boss');
  const path = []; for (let i = s + 3; i >= Math.max(1, s - 5); i--) path.push(i);
  const dbl = evMult('reward') > 1;
  return `<div class="pad">
  <div class="stagecard">
    <div class="muted">${t('campaign_area')}</div>
    <div class="big num">${s}</div>
    <div>${s % 5 === 0 ? `<span class="tag bad">${t('boss_stage')}</span>` : `<span class="tag">${t('waves3')}</span>`} ${dbl ? `<span class="tag live">×${evMult('reward')} ${t('rewards')}</span>` : ''}</div>
    <div class="zrow">${types.map(tp => `<span title="${esc(L(ZT[tp].n))}">${ZT[tp].i}</span>`).join('')}</div>
    <div class="vs"><div class="stat"><small>${t('your_power')}</small><b class="num ${my >= rp ? 'good' : 'bad'}">${fmt(my)}</b></div><b class="muted">${t('vs')}</b><div class="stat"><small>${t('rec_power')}</small><b class="num">${fmt(rp)}</b></div></div>
    <div><div class="muted sm" style="margin-bottom:4px">${t('rewards')}</div>${rewHTML(stageReward(s))}</div>
    <button class="btn pri wide" data-a="fight" ${S.squad.some(Boolean) ? '' : 'disabled'}>⚔️ ${t('start_battle')}</button>
  </div>
  <div class="path">${path.map(i => `<div class="pn ${i < s ? 'done' : i === s ? 'cur' : ''} ${i % 5 === 0 ? 'boss' : ''}"><span class="pi num">${i < s ? '✓' : i}</span><span>${i % 5 === 0 ? '👺 ' + t('area_boss') : i < s ? t('cleared') : i === s ? t('current_stage') : t('unknown_area')}</span><span class="pr muted num">${fmt(recPower(i))}</span></div>`).join('')}</div>
  <p class="muted sm">${t('campaign_tip')}</p>
  </div>`;
};
VIEWS.alliance = () => {
  if (!S.alliance) return `<div class="pad"><h2>${t('join_alliance')}</h2><p class="muted">${t('alliance_pitch')}</p>
    ${ALLIES.map((a, i) => `<div class="panel"><div class="ally"><span class="flag" style="background:${a.col}">${a.tag}</span><div style="flex:1;min-width:0"><b style="font-family:var(--fd);font-size:17px">${L(a.n)}</b><div class="muted">${t('ally_meta', a.lv, 10 + a.lv, fmt(a.lv * 42000))}</div></div><button class="btn pri sm" data-a="join" data-x="${i}">${t('join')}</button></div></div>`).join('')}</div>`;
  const a = ALLIES[S.alliance.i]; const giftOk = S.alliance.gift !== today();
  const members = S.alliance.m;
  return `<div class="pad">
  <div class="panel"><div class="ally"><span class="flag" style="background:${a.col}">${a.tag}</span><div style="flex:1;min-width:0"><b style="font-family:var(--fd);font-size:18px">${L(a.n)}</b><div class="muted">${t('ally_meta2', a.lv, members.length + 1)}</div></div></div>
  <div class="grid2"><button class="btn ${giftOk ? 'gold' : ''}" data-a="gift" ${giftOk ? '' : 'disabled'}>🎁 ${giftOk ? t('daily_gift') : t('gift_taken')}</button><button class="btn" data-a="helpAll">🤝 ${t('help_all')}</button></div>
  <p class="muted sm">${t('help_info')}</p></div>
  <div class="panel"><h3>${t('ally_chat')}</h3><div class="chat">${S.chat.slice(-30).map(c => `<div class="msg ${c.me ? 'mine' : ''}"><b>${esc(c.me ? (S.name || t('commander')) : L(c.u))}</b><span>${esc(L(c.m))}</span></div>`).join('') || `<div class="muted">${t('no_msgs')}</div>`}</div>
  <form class="row" id="chatf"><input class="field" id="chatin" maxlength="120" placeholder="${t('type_msg')}" autocomplete="off"><button class="btn pri sm" type="submit">${t('send')}</button></form>
  <p class="muted sm">${t('chat_note')}</p></div>
  <div class="panel"><h3>${t('members')}</h3>
  <div class="mem"><span class="av c-me">${esc((S.name || t('commander'))[0])}</span><span>${esc(S.name || t('commander'))} <span class="tag">${t('you')}</span></span><span class="p num">${fmt(totalPower())}</span></div>
  ${members.map((m, i) => `<div class="mem"><span class="av ${['c-tank', 'c-atk', 'c-sup'][i % 3]}">${esc(L(m.n)[0])}</span><span>${esc(L(m.n))} ${i === 0 ? `<span class="tag" style="color:var(--amber)">${t('leader')}</span>` : ''}</span><span class="p num">${fmt(m.p)}</span></div>`).join('')}</div>
  <button class="btn sm" data-a="leave" style="justify-self:start">${t('leave_alliance')}</button>
  </div>`;
};

/* ================= modals ================= */
function effText(tp, lv) {
  const T = BT[tp];
  if (T.prod) return t('per_hour', fmt(prodRate(tp, lv)));
  switch (tp) {
    case 'hq': return t('eff_hq', lv + 1);
    case 'barracks': return t('eff_barracks', batchMax(lv), fmt(troopCap(lv)));
    case 'hospital': return t('eff_hospital', fmt(hospCap(lv)));
    case 'lab': return t('eff_lab', Math.min(10, lv));
    case 'wall': return t('eff_wall', fmt(wallDef(lv)));
    case 'warehouse': return t('eff_wh', fmt(protect(lv)));
    case 'tavern': return t('eff_tavern', heroCap(lv));
    case 'radar': return t('eff_radar', maxMarch(lv));
  } return '';
}
function speedHTML(ref, q) {
  return `<div class="panel"><div class="row between"><b>${t('in_progress')}</b><b class="num" data-end="${q.end}"></b></div>
  <div class="prog"><i data-bar data-st="${q.st}" data-en="${q.end}"></i></div>
  <div class="grid2">
    <button class="btn sm" data-a="usesp" data-x="${ref}|sp5" ${S.inv.sp5 ? '' : 'disabled'}>⏩ ${t('m5')} (${S.inv.sp5})</button>
    <button class="btn sm" data-a="usesp" data-x="${ref}|sp60" ${S.inv.sp60 ? '' : 'disabled'}>⏭️ ${t('h1')} (${S.inv.sp60})</button>
    <button class="btn gold sm" data-a="gemfin" data-x="${ref}" data-gem="${q.end}">💎</button>
    ${S.alliance ? (q.hr ? `<span class="btn sm" style="pointer-events:none">🤝 ${t('helps')} ${q.h}/5</span>` : `<button class="btn ok sm" data-a="help" data-x="${ref}">🤝 ${t('ask_help')}</button>`) : `<button class="btn sm" data-a="tab" data-x="alliance">🤝 ${t('join_alliance')}</button>`}
  </div></div>`;
}
function mBuilding(k) {
  const p = PLOT[k], tp = p.t, T = BT[tp], b = S.b[k], q = S.builds.find(x => x.k === k), to = b.lv + 1;
  let body = `<p class="muted">${L(T.d)}</p>`;
  if (b.lv || to <= MAXLV) body += `<div class="eff"><span>${b.lv ? effText(tp, b.lv) : t('not_built')}</span><span class="arr">${isRTL() ? '←' : '→'}</span><span class="nx">${to <= MAXLV ? effText(tp, to) : t('max')}</span></div>`;
  if (T.prod && b.lv) { const cap = storeCap(tp, b.lv); body += `<div class="li"><span class="lic">${RES[T.prod].i}</span><div class="lit"><b>${t('stock')} ${fmt(b.acc)} / ${fmt(cap)}</b><small>${t('stock_note', storeH(lvOf('warehouse')))}</small></div><button class="btn gold sm" data-a="collect1" data-x="${k}">${t('collect')}</button></div>`; }
  if (q) body += speedHTML('b:' + k, q);
  else if (to <= MAXLV) {
    const reqs = bReq(k), c = bCost(tp, to), ms = bTime(tp, to), ok = reqs.every(r => r.ok), aff = canPay(c), g = gemCost(ms), busy = S.builds.length >= maxBuilders();
    const hint = hintNext && ok && aff && !busy; hintNext = false;
    body += `<div class="panel"><div class="row between"><b>${b.lv ? t('upgrade_to', to) : t('build')}</b><span class="cc">⏱ ${fmtT(ms / 1000)}</span></div>
    ${reqs.map(r => `<div class="req ${r.ok ? 'yes' : 'no'}">${r.ok ? '✔' : '✖'} ${r.t}</div>`).join('')}
    <div class="row">${costHTML(c)}</div>
    ${!aff ? `<button class="btn sm" data-a="fill" data-x="b:${k}">💎 ${missingGems(c)} ${t('buy_missing')}</button>` : ''}
    <div class="grid2"><button class="btn pri ${hint ? 'hint' : ''}" data-a="up" data-x="${k}" ${ok && aff && !busy ? '' : 'disabled'}>${busy ? t('builders_busy') : b.lv ? '⬆️ ' + t('upgrade') : '🔨 ' + t('build')}</button><button class="btn gold" data-a="inst" data-x="${k}" ${ok && aff ? '' : 'disabled'}>⚡ ${t('instant')} 💎${g}</button></div></div>`;
  }
  if (b.lv) {
    if (tp === 'barracks') body += barracksHTML();
    if (tp === 'hospital') body += hospitalHTML();
    if (tp === 'lab') body += labHTML();
    if (tp === 'tavern') body += `<button class="btn wide" data-a="tab" data-x="heroes">🦸 ${t('open_heroes')}</button>`;
    if (tp === 'wall') body += `<div class="li"><span class="lic">🛡️</span><div class="lit"><b>${t('base_def')} ${fmt(wallDef(b.lv) + S.troops * 10 + squadPower() * .5)}</b><small>${t('base_def_note')} <span class="num" data-end="${S.siegeAt}"></span></small></div></div>`;
  }
  return sheet(T.i, L(T.n), b.lv ? t('level_n', b.lv) : t('not_built'), body);
}
function barracksHTML() {
  const Lb = lvOf('barracks'), max = trainCount(); trainN = clamp(trainN, 1, Math.max(1, max));
  const per = trainCostPer(), c = { food: per.food * trainN, iron: per.iron * trainN };
  const tier = t('tier' + Math.min(4, Math.floor((Lb - 1) / 5)));
  let h = `<div class="panel"><div class="row between"><b>${t('troops')}: ${fmt(S.troops)} / ${fmt(troopCap(Lb))}</b><span class="tag">${tier}</span></div>
  <small class="muted">${t('troops_note', Math.round(troopBonus() * 100))}</small>`;
  if (S.tq) h += speedHTML('t', S.tq).replace('<div class="panel">', '<div>');
  else if (max < 1) h += `<div class="muted">${t('troops_full')}</div>`;
  else h += `<label class="row between" for="trn"><span>${t('count')}</span><b class="num" id="trnv">${trainN}</b></label>
  <input type="range" id="trn" min="1" max="${max}" value="${trainN}">
  <div class="row" id="trnc">${costHTML(c)} <span class="cc">⏱ ${fmtT(trainMs(trainN) / 1000)}</span></div>
  <button class="btn pri wide" data-a="train">🎖️ ${t('train')}</button>`;
  return h + `</div>`;
}
function hospitalHTML() {
  const cap = hospCap(lvOf('hospital'));
  return `<div class="panel"><div class="row between"><b>${t('wounded')}: ${fmt(S.wounded)} / ${fmt(cap)}</b></div>
  ${S.wounded ? `<div class="row">${costHTML({ food: S.wounded * 4, wood: S.wounded * 2 })}</div><button class="btn ok wide" data-a="heal">🏥 ${t('heal_all')}</button>` : `<div class="muted">${t('no_wounded')}</div>`}</div>`;
}
function labHTML() {
  const lab = lvOf('lab');
  let h = `<h3>${t('research')}</h3>`;
  if (S.rq) h += `<div class="li"><span class="lic">${TECH[S.rq.k].i}</span><div class="lit"><b>${L(TECH[S.rq.k].n)} → ${S.rq.to}</b></div></div>` + speedHTML('r', S.rq);
  h += Object.keys(TECH).map(k => {
    const T = TECH[k], lv = S.tech[k], to = lv + 1, c = rCost(to), maxed = to > 10, locked = to > lab;
    return `<div class="li"><span class="lic">${T.i}</span><div class="lit"><b>${L(T.n)} <span class="tag num">${lv}/10</span></b><small>${L(T.d)}</small>${!maxed ? `<div class="row">${costHTML(c)} <span class="cc">⏱ ${fmtT(rTime(to) / 1000)}</span></div>` : ''}</div>
    ${maxed ? `<span class="tag">${t('max')}</span>` : locked ? `<span class="tag">${t('lab_n', to)}</span>` : canPay(c) ? `<button class="btn pri sm" data-a="research" data-x="${k}" ${S.rq ? 'disabled' : ''}>${t('do_research')}</button>` : `<button class="btn sm" data-a="fill" data-x="r:${k}">💎${missingGems(c)}</button>`}</div>`;
  }).join('');
  return h;
}
function skillText(sk, m) {
  const v = { snipe: Math.round(7 * m * 100), shield: Math.round(30 * m), heal: Math.round(5 * m * 100), air: Math.round(3.5 * m * 100), aoe: Math.round(3 * m * 100), stun: (2.5 * m).toFixed(1), rapid: (4 * m).toFixed(1), buff: (6 * m).toFixed(1) }[sk];
  return t('sk_' + sk, v);
}
function mHero(id) {
  const Hh = HB[id], h = S.heroes[id], x = heroStats(id), cap = heroCap(lvOf('tavern')), need = starNeed(h.st), lc = lvCost(h.lv);
  const inSq = S.squad.includes(id);
  const body = `<div class="hero-hero r${Hh.r}"><img src="${portraitURI(id)}" alt=""><div class="hh-info"><b>${esc(hname(id))}</b>${starsHTML(h.st)}<span class="tag" style="color:${RAR[Hh.r].c}">${L(RAR[Hh.r].n)} · ${CLS[Hh.c].i} ${L(CLS[Hh.c].n)}</span><span class="num" style="color:var(--amber);font-family:var(--fd);font-weight:800">💪 ${fmt(heroPower(id))}</span></div></div>
  <p class="muted">${L(Hh.q)}</p>
  <div class="grid4"><div class="stat"><small>${t('atk')}</small><b class="num">${fmt(x.atk)}</b></div><div class="stat"><small>${t('hp')}</small><b class="num">${fmt(x.hp)}</b></div><div class="stat"><small>${t('def')}</small><b class="num">${fmt(x.def)}</b></div><div class="stat"><small>${t('power')}</small><b class="num" style="color:var(--amber)">${fmt(heroPower(id))}</b></div></div>
  <div class="li"><span class="lic">⚡</span><div class="lit"><b>${L(Hh.skn)}</b><small>${skillText(Hh.sk, RM[Hh.r])}</small></div></div>
  <div class="panel"><div class="row between"><b>${t('level_of', h.lv, cap)}</b><span class="cc ${S.res.exp >= lc ? '' : 'lack'}">✨ ${fmt(lc)}</span></div>
  <div class="grid2"><button class="btn pri" data-a="hlv" data-x="${id}|1" ${h.lv < cap && S.res.exp >= lc ? '' : 'disabled'}>⬆️ +1</button><button class="btn" data-a="hlv" data-x="${id}|10" ${h.lv < cap && S.res.exp >= lc ? '' : 'disabled'}>⏫ +10</button></div>
  ${h.lv >= cap ? `<small class="muted">${t('raise_cap')}</small>` : ''}</div>
  <div class="panel"><div class="row between"><b>${t('stars')} ${starsHTML(h.st)}</b><span class="cc">🧩 ${h.sh}${h.st < 5 ? ' / ' + need : ''}</span></div>
  ${h.st < 5 ? `<button class="btn gold" data-a="hstar" data-x="${id}" ${h.sh >= need ? '' : 'disabled'}>⭐ ${t('star_up')}</button><small class="muted">${t('shard_note')}</small>` : `<b style="color:var(--amber)">${t('max_stars')}</b>`}</div>
  ${inSq ? `<button class="btn wide" data-a="sqrem" data-x="${id}">${t('remove_squad')}</button>` : `<button class="btn ok wide" data-a="sqadd" data-x="${id}">${t('add_squad')}</button>`}`;
  return sheet(avHTML(id), esc(hname(id)), `<span style="color:${RAR[Hh.r].c};font-weight:800">${L(RAR[Hh.r].n)}</span> · ${CLS[Hh.c].i} ${L(CLS[Hh.c].n)}`, body);
}
function mSlot(i) {
  const cur = S.squad[i]; const list = ownedHeroes().filter(id => !S.squad.includes(id)).sort((a, b) => heroPower(b) - heroPower(a));
  const body = `${cur ? `<div class="li">${avHTML(cur)}<div class="lit"><b>${esc(hname(cur))}</b><small>${t('power')} ${fmt(heroPower(cur))}</small></div><button class="btn sm" data-a="slotclr" data-x="${i}">${t('clear')}</button></div>` : ''}
  <h3>${t('pick_hero')}</h3>${list.length ? list.map(id => `<button class="li" data-a="slotset" data-x="${i}|${id}">${avHTML(id)}<div class="lit"><b>${esc(hname(id))} ${starsHTML(S.heroes[id].st)}</b><small>Lv ${S.heroes[id].lv} · ${L(CLS[HB[id].c].n)} · ${t('power')} ${fmt(heroPower(id))}</small></div></button>`).join('') : `<p class="muted">${t('all_in_squad')}</p>`}
  <p class="muted sm">${i < 2 ? t('front_tip') : t('back_tip')}</p>`;
  return sheet('🪖', i < 2 ? t('front') : t('back'), t('slot_n', i + 1), body);
}
function mSlotPick(id) {
  return sheet(avHTML(id), t('squad_full'), t('pick_replace'), S.squad.map((s, i) => `<button class="li" data-a="slotset" data-x="${i}|${id}">${avHTML(s)}<div class="lit"><b>${esc(hname(s))}</b><small>${t('power')} ${fmt(heroPower(s))}</small></div><span class="tag">${t('replace')}</span></button>`).join(''));
}
function mRecruit() {
  const tk = S.inv.ticket;
  const body = `<div class="grid3">${[1, 2, 3].map(r => `<div class="stat"><small style="color:${RAR[r].c}">${L(RAR[r].n)}</small><b>${[0, 70, 25, 5][r]}%</b></div>`).join('')}</div>
  <div class="li"><span class="lic">🌟</span><div class="lit"><b>${t('pity', 40 - S.pity)}</b><small>${t('dupes_note')}</small></div></div>
  <div class="grid2"><button class="btn pri" data-a="recruit" data-x="1">×1 ${tk ? '🎟️ 1' : '💎 150'}</button><button class="btn gold" data-a="recruit" data-x="10">×10 ${tk >= 10 ? '🎟️ 10' : '💎 ' + (tk ? (10 - Math.min(tk, 10)) * 150 : 1350)}</button></div>
  ${lastPull.length ? `<h3>${t('result')}</h3><div class="pull">${lastPull.map((p, i) => `<div class="hc r${HB[p.id].r}" style="animation-delay:${i * .08}s">${p.isNew ? `<span class="new">${t('new')}</span>` : ''}${cardHTML(p.id)}<b style="font-size:12px">${esc(hname(p.id))}</b><small style="color:${RAR[HB[p.id].r].c}">${p.isNew ? L(RAR[HB[p.id].r].n) : '+10 🧩'}</small></div>`).join('')}</div>` : ''}`;
  return sheet('🎟️', t('recruit_heroes'), t('tickets_gems', tk, fmt(S.res.gems)), body);
}
function mEvents() {
  ensureDaily(); wbReset(); const pts = dailyPoints(); const canLogin = S.login.last !== today();
  const evs = activeEvents();
  const evHTML = evs.map(e => {
    let act = '';
    if (e.type === 'boss') act = `<button class="btn pri sm" data-a="worldBoss" ${S.wb.tries >= 3 ? 'disabled' : ''}>⚔️ ${t('fight')} (${3 - S.wb.tries}/3)</button>`;
    else if (e.type === 'gift') { const done = S.evp[e.id] && S.evp[e.id].done; act = `<button class="btn gold sm" data-a="evClaim" data-x="${esc(e.id)}" ${done ? 'disabled' : ''}>${done ? '✔' : t('claim')}</button>`; }
    else if (e.type === 'kills') { const p = evProgress(e), g = Number(e.params.goal) || 1, done = S.evp[e.id] && S.evp[e.id].done; act = `<div style="display:grid;gap:4px;justify-items:end"><span class="cc num">${fmt(Math.min(p, g))}/${fmt(g)}</span><button class="btn gold sm" data-a="evClaim" data-x="${esc(e.id)}" ${p >= g && !done ? '' : 'disabled'}>${done ? '✔' : t('claim')}</button></div>`; }
    const extra = e.type === 'double' ? `×${Number(e.params.m) || 2}` : e.type === 'production' ? `×${Number(e.params.m) || 1.5}` : e.type === 'discount' ? `-${Number(e.params.p) || 0}%` : '';
    const rw = (e.type === 'gift' || e.type === 'kills') ? `<div class="row">${rewHTML(sanitizeRewards(e.params.r || {}))}</div>` : '';
    return `<div class="li hot"><span class="lic">${{ boss: '🦍', double: '✖️', production: '🏭', discount: '🏷️', gift: '🎁', kills: '🧟' }[e.type] || '⚡'}</span><div class="lit"><b>${esc(L(e.title))} ${extra ? `<span class="tag live">${extra}</span>` : ''}</b><small>${esc(L(e.body))}</small>${rw}${e.ends ? `<small>${t('ends_in')} <span class="num" data-end="${e.ends}"></span></small>` : ''}</div>${act}</div>`;
  }).join('');
  const body = `<h3>${t('live_events')}</h3>${evHTML}
  <h3>${t('login_rewards')}</h3>
  <div class="days">${LOGIN.map((r, i) => { const k = Object.keys(r)[0]; const d = RES[k] || ITEMS[k]; return `<div class="day ${i < S.login.day % 7 ? 'got' : ''} ${i === S.login.day % 7 && canLogin ? 'now' : ''}"><span>${t('day_n', i + 1)}</span><span class="d1">${d.i}</span><span class="num">${fmt(r[k])}</span></div>`; }).join('')}</div>
  <button class="btn gold wide" data-a="login" ${canLogin ? '' : 'disabled'}>${canLogin ? t('claim_today') : t('come_tomorrow')}</button>
  <div class="row between"><h3>${t('daily_tasks')}</h3><span class="cc">🏅 ${pts}</span></div>
  <div class="prog"><i style="width:${Math.min(100, pts / 120 * 100)}%"></i></div>
  <div class="grid4">${CHESTS.map((c, i) => { const got = S.daily.c['chest' + i], ok = pts >= c.p; return `<button class="btn sm ${ok && !got ? 'gold' : ''}" data-a="chest" data-x="${i}" ${ok && !got ? '' : 'disabled'}>${got ? '✔' : '🎁'} ${c.p}</button>`; }).join('')}</div>
  ${DAILY.map(d => { const v = S.daily.p[d.k] || 0, done = v >= d.g, got = S.daily.c[d.k]; return `<div class="li"><div class="lit"><b>${t('d_' + d.k)}</b><small class="num">${Math.min(v, d.g)} / ${d.g} · ${t('pts15')}</small></div>${got ? '<span class="tag">✔</span>' : done ? `<button class="btn gold sm" data-a="dclaim" data-x="${d.k}">${t('claim')}</button>` : `<span class="tag muted">${t('in_progress')}</span>`}</div>`; }).join('')}`;
  return sheet('🎁', t('events'), t('events_sub'), body);
}
function mQuests() {
  const list = QUESTS.slice(S.quest, S.quest + 5);
  return sheet('📋', t('main_quests'), t('done_of', S.quest, QUESTS.length), list.length ? list.map((q, i) => `<div class="li"><div class="lit"><b>${q[0]()}</b><div class="row">${rewHTML(q[2])}</div></div>${i === 0 ? (q[1]() ? `<button class="btn gold sm" data-a="qclaim">${t('claim')}</button>` : `<button class="btn sm" data-a="qgo">${t('go')}</button>`) : `<span class="tag">${t('upcoming')}</span>`}</div>`).join('') : `<p>${t('quests_done')}</p>`);
}
const GSHOP = [
  { k: 'free', i: '🎁', p: 0, r: { gems: 30, food: 2000, wood: 2000 } },
  { k: 'ticket', i: '🎟️', p: 150, r: { ticket: 1 } }, { k: 'ticket10', i: '🎫', p: 1350, r: { ticket: 10 } },
  { k: 'sp5', i: '⏩', p: 25, r: { sp5: 1 } }, { k: 'sp60', i: '⏭️', p: 240, r: { sp60: 1 } },
  { k: 'stam', i: '🥫', p: 80, r: { stam: 1 } }, { k: 'spin', i: '🎡', p: 90, r: { spin: 1 } },
  { k: 'food', i: '🌽', p: 80, r: { food: 10000 } }, { k: 'wood', i: '🪵', p: 80, r: { wood: 10000 } },
  { k: 'iron', i: '🔩', p: 80, r: { iron: 5000 } }, { k: 'fuel', i: '⛽', p: 70, r: { fuel: 2000 } }, { k: 'exp', i: '✨', p: 120, r: { exp: 5000 } },
];
const gprice = s => Math.round(s.p * (1 - evDiscount() / 100));
let shopTab = 'gems';
function mShop() {
  const free = S.freeBox !== today(), disc = evDiscount();
  const tabs = `<div class="subtabs">${['gems', 'offers', 'items'].map(k => `<button class="${shopTab === k ? 'on' : ''}" data-a="shopTab" data-x="${k}">${t('shop_' + k)}</button>`).join('')}</div>`;
  let body = tabs;
  if (shopTab === 'gems') {
    body += `${!canBuy() ? `<div class="li"><span class="lic">📱</span><div class="lit"><b>${t('iap_app_only')}</b><small>${t('iap_app_note')}</small></div></div>` : ''}
    <div class="packs">${IAP.filter(p => p.kind === 'gems').map(p => `<div class="pack">${!S.firstBuy[p.id] ? `<span class="x2">${t('x2_first')}</span>` : ''}${p.tag ? `<span class="tag live" style="position:absolute;top:6px;inset-inline-end:6px">${t('tag_' + p.tag)}</span>` : ''}<span class="pi">${p.i}</span><b class="num">${fmt(packGems(p) * (S.firstBuy[p.id] ? 1 : 2))} 💎</b><small class="muted">+${p.vip} VIP</small><button class="btn pri sm" data-a="buy" data-x="${p.id}" ${STORE.busy ? 'disabled' : ''}>${priceStr(p)}</button></div>`).join('')}</div>
    <button class="btn sm" data-a="restore" style="justify-self:center">${t('restore')}</button>`;
  } else if (shopTab === 'offers') {
    const st = IAPB.starter, mc = IAPB.monthly, ps = IAPB.pass;
    body += `${!S.starter.bought ? `<div class="hero-offer"><div class="row between"><b style="font-family:var(--fd);font-size:18px">🎁 ${t('starter_pack')}</b><span class="tag live">${t('once')}</span></div><div class="row" style="justify-content:center">${rewHTML(st.r)}</div><button class="btn gold wide" data-a="buy" data-x="starter">${priceStr(st)}</button></div>` : ''}
    <div class="panel"><div class="row between"><b style="font-family:var(--fd);font-size:17px">📅 ${t('monthly_card')}</b>${cardActive() ? `<span class="tag good">${t('active_days', Math.ceil((S.card.until - now()) / 864e5))}</span>` : ''}</div>
    <p class="muted sm">${t('monthly_desc', mc.gems, mc.daily, mc.days)}</p>
    ${cardActive() ? `<button class="btn gold" data-a="cardClaim" ${S.card.last === today() ? 'disabled' : ''}>${S.card.last === today() ? t('come_tomorrow') : t('claim') + ' ' + mc.daily + ' 💎'}</button>` : ''}
    <button class="btn pri" data-a="buy" data-x="monthly">${priceStr(mc)}</button></div>
    <div class="panel"><b style="font-family:var(--fd);font-size:17px">🎖️ ${t('premium_pass')}</b><p class="muted sm">${t('pass_desc')}</p>
    <button class="btn pri" data-a="buy" data-x="pass" ${hasPrem() ? 'disabled' : ''}>${hasPrem() ? t('owned') : priceStr(ps)}</button></div>`;
  } else {
    body += `${disc ? `<div class="li hot"><span class="lic">🏷️</span><div class="lit"><b>${t('discount_on', disc)}</b></div></div>` : ''}` + GSHOP.map(s => `<div class="li"><span class="lic">${s.i}</span><div class="lit"><b>${t('g_' + s.k)}</b><div class="row">${rewHTML(s.r)}</div></div>${s.k === 'free' ? `<button class="btn gold sm" data-a="gbuy" data-x="free" ${free ? '' : 'disabled'}>${free ? t('free') : t('tomorrow')}</button>` : `<button class="btn sm ${S.res.gems >= gprice(s) ? 'pri' : ''}" data-a="gbuy" data-x="${s.k}">💎 ${gprice(s)}</button>`}</div>`).join('');
  }
  return sheet('🛒', t('shop'), t('gems_have', fmt(S.res.gems)), body);
}
function mStarter() {
  const st = IAPB.starter;
  return sheet('🎁', t('starter_pack'), t('starter_sub'), `<div class="hero-offer"><div style="display:flex;justify-content:center">${avHTML('reem')}</div><b style="font-family:var(--fd);font-size:18px">${t('starter_hero')}</b><div class="row" style="justify-content:center">${rewHTML(st.r)}</div><div class="muted sm">${t('starter_value')}</div><button class="btn gold wide" data-a="buy" data-x="starter" ${S.starter.bought ? 'disabled' : ''}>${S.starter.bought ? t('owned') : priceStr(st)}</button></div><button class="btn wide" data-a="close">${t('later')}</button>`);
}
function mBag() {
  const body = Object.keys(ITEMS).map(k => `<div class="li"><span class="lic">${ITEMS[k].i}</span><div class="lit"><b>${L(ITEMS[k].n)} ×${S.inv[k] || 0}</b><small>${L(ITEMS[k].d)}</small></div>${k === 'stam' ? `<button class="btn sm" data-a="useStam" ${S.inv.stam ? '' : 'disabled'}>${t('use')}</button>` : k === 'ticket' ? `<button class="btn sm" data-a="openRecruit">${t('recruit')}</button>` : k === 'spin' ? `<button class="btn sm" data-a="wheel">${t('sc_wheel')}</button>` : `<span class="tag">${t('from_timer')}</span>`}</div>`).join('')
    + `<div class="li"><span class="lic">✨</span><div class="lit"><b>${t('hero_xp')} ${fmt(S.res.exp)}</b><small>${t('hero_xp_note')}</small></div></div>
  <div class="li"><span class="lic">🪖</span><div class="lit"><b>${t('troops')} ${fmt(S.troops)} · ${t('wounded')} ${fmt(S.wounded)}</b><small>${t('troops_where')}</small></div></div>`;
  return sheet('🎒', t('bag'), '', body);
}
function mWheel() {
  wheelReset(); const n = WHEEL.length, R = 100, seg = 360 / n;
  const paths = WHEEL.map((w, i) => {
    const a0 = (i * seg - 90) * Math.PI / 180, a1 = ((i + 1) * seg - 90) * Math.PI / 180, am = ((i + .5) * seg - 90) * Math.PI / 180;
    const k = Object.keys(w.r)[0], d = RES[k] || ITEMS[k];
    return `<path d="M100 100 L${100 + R * Math.cos(a0)} ${100 + R * Math.sin(a0)} A${R} ${R} 0 0 1 ${100 + R * Math.cos(a1)} ${100 + R * Math.sin(a1)} Z" fill="${w.c}" stroke="#0e1215" stroke-width="2"/>
    <text x="${100 + 64 * Math.cos(am)}" y="${100 + 64 * Math.sin(am)}" font-size="18" text-anchor="middle" dominant-baseline="middle">${d.i}</text>
    <text x="${100 + 84 * Math.cos(am)}" y="${100 + 84 * Math.sin(am)}" font-size="9" font-weight="800" fill="#ece5d7" text-anchor="middle" dominant-baseline="middle" font-family="Changa,sans-serif">${fmt(w.r[k])}</text>`;
  }).join('');
  const free = wheelFree();
  const body = `<div class="wheelbox"><div class="ptr"></div><svg id="wheelsvg" direction="ltr" viewBox="0 0 200 200" style="transform:rotate(${wheelAngle}deg)"><circle cx="100" cy="100" r="100" fill="#3b2a22"/>${paths}<circle cx="100" cy="100" r="16" fill="#f1b23c" stroke="#5a2410" stroke-width="3"/></svg></div>
  ${wheelLast ? `<div class="li hot"><span class="lic">🎉</span><div class="lit"><b>${t('you_won')}</b><div class="row">${rewHTML(wheelLast)}</div></div></div>` : ''}
  <button class="btn ${free || S.inv.spin ? 'gold' : 'pri'} wide" data-a="spin" ${wheelSpinning ? 'disabled' : ''}>${wheelSpinning ? '…' : free ? t('spin_free') : S.inv.spin ? t('spin_item', S.inv.spin) : t('spin_gems', WHEEL_PRICE)}</button>
  <p class="muted sm" style="text-align:center">${t('wheel_note', 10 - S.wheel.paid)}</p>
  <div class="li"><div class="lit"><b>${t('odds')}</b><div class="row">${(() => { const tot = WHEEL.reduce((a, w) => a + w.w, 0); return WHEEL.map(w => `<span class="cc">${rewHTML(w.r).replace(/<\/?span[^>]*>/g, '')} · ${(w.w / tot * 100).toFixed(0)}%</span>`).join(''); })()}</div></div></div>`;
  return sheet('🎡', t('lucky_wheel'), '', body);
}
function mPass() {
  ensurePass(); const tier = passTier(), prem = hasPrem();
  let rows = ''; for (let i = 1; i <= PASS_TIERS; i++) {
    const fr = passReward(i, false), pr = passReward(i, true), ok = i <= tier;
    const fGot = S.pass.f[i], pGot = S.pass.p[i];
    rows += `<div class="ptrack"><span class="tn num ${ok ? 'ok' : ''}">${i}</span>
    <button class="prw ${ok ? '' : 'locked'}" data-a="passClaim" data-x="${i}|0" ${ok && !fGot ? '' : 'disabled'}><span class="row">${rewHTML(fr)}</span><span>${fGot ? '✔' : ok ? '🎁' : ''}</span></button>
    <button class="prw prem ${ok && prem ? '' : 'locked'}" data-a="passClaim" data-x="${i}|1" ${ok && !pGot ? '' : 'disabled'}><span class="row">${rewHTML(pr)}</span><span>${pGot ? '✔' : prem ? (ok ? '🎁' : '') : '🔒'}</span></button></div>`;
  }
  const body = `<div class="panel"><div class="row between"><b>${t('tier_n', tier, PASS_TIERS)}</b><span class="muted sm">${t('season_ends')} <span class="num" data-end="${seasonEnds()}"></span></span></div>
  <div class="prog"><i style="width:${tier >= PASS_TIERS ? 100 : (S.pass.xp % PASS_XP)}%"></i></div><small class="muted">${t('pass_how')}</small>
  <div class="grid2"><button class="btn gold" data-a="passAll" ${passDot() ? '' : 'disabled'}>${t('claim_all')}</button>${prem ? `<span class="btn ok" style="pointer-events:none">✔ ${t('premium')}</span>` : `<button class="btn pri" data-a="buy" data-x="pass">🎖️ ${t('unlock_premium')} ${priceStr(IAPB.pass)}</button>`}</div></div>
  <div class="ptrack"><span></span><b class="sm" style="text-align:center">${t('free_track')}</b><b class="sm" style="text-align:center;color:var(--amber)">${t('premium_track')}</b></div>${rows}`;
  return sheet('🎖️', t('battle_pass'), t('season_n', season() % 100), body);
}
function mAchs() {
  return sheet('🏅', t('achievements'), '', ACH.map(a => { const s = achState(a); return `<div class="li ${s.ready ? 'hot' : ''}"><span class="lic">${a.i}</span><div class="lit"><b>${t('ach_' + a.k, s.done ? '' : fmt(s.next))}</b><small class="num">${s.done ? t('ach_done') : fmt(Math.min(s.v, s.next)) + ' / ' + fmt(s.next)} · ${t('tier_x', s.claimed, a.tiers.length)}</small>${!s.done ? `<div class="prog"><i style="width:${Math.min(100, s.v / s.next * 100)}%"></i></div>` : ''}</div>${s.ready ? `<button class="btn gold sm" data-a="achClaim" data-x="${a.k}">💎 ${achReward(s.claimed).gems}</button>` : ''}</div>`; }).join(''));
}
function mVip() {
  const l = vipLv(), next = VIPT[l + 1];
  const perks = lv => [t('vip_p_build', lv * 2), t('vip_p_prod', lv * 3), lv >= 3 ? t('vip_p_builder') : '', lv >= 4 ? t('vip_p_spin') : '', lv >= 5 ? t('vip_p_march') : '', lv >= 1 ? t('vip_p_chest', lv * 30) : ''].filter(Boolean);
  const body = `<div class="panel" style="text-align:center"><div class="lvup"><div class="big" style="font-size:44px;color:var(--vip)">VIP ${l}</div></div>
  ${next ? `<div class="prog"><i style="width:${(S.vip.pts - VIPT[l]) / (next - VIPT[l]) * 100}%"></i></div><small class="muted num">${fmt(S.vip.pts)} / ${fmt(next)} · ${t('vip_how')}</small>` : `<b>${t('vip_max')}</b>`}
  <button class="btn gold" data-a="vipChest" ${l >= 1 && S.vip.chest !== today() ? '' : 'disabled'}>🎁 ${t('vip_chest')}</button></div>
  ${[1, 2, 3, 4, 5, 6, 8, 10].map(lv => `<div class="li ${lv === l ? 'hot' : ''}" style="${lv > l ? 'opacity:.6' : ''}"><span class="lic" style="font-family:var(--fd);font-weight:800;color:var(--vip);font-size:16px">VIP ${lv}</span><div class="lit">${perks(lv).map(p => `<small>• ${p}</small>`).join('')}</div></div>`).join('')}`;
  return sheet('👑', t('vip'), '', body);
}
let rankData = null, rankLoading = false;
function mRank() {
  if (NET.on && !rankData && !rankLoading) { rankLoading = true; leaderboard().then(d => { rankData = d || []; rankLoading = false; renderModal(); }).catch(() => { rankLoading = false; rankData = []; renderModal(); }); }
  let body;
  if (!NET.on) body = `<div class="li"><span class="lic">📶</span><div class="lit"><b>${t('rank_offline')}</b><small>${t('rank_offline_b')}</small></div></div><div class="mem me"><span class="rk">—</span><span class="av c-me">${esc((S.name || 'C')[0])}</span><span>${esc(S.name || t('commander'))}</span><span class="p num">${fmt(totalPower())}</span></div>`;
  else if (!rankData) body = `<p class="muted">${t('loading')}</p>`;
  else body = rankData.map((r, i) => `<div class="mem ${NET.me && r.short_id === NET.me.short_id ? 'me' : ''}"><span class="rk">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><span class="av ${['c-tank', 'c-atk', 'c-sup'][i % 3]}">${esc((r.name || '?')[0])}</span><span>${esc(r.name || '?')} ${r.vip ? `<span class="tag" style="color:var(--vip)">VIP ${r.vip}</span>` : ''}</span><span class="p num">${fmt(r.power)}</span></div>`).join('') || `<p class="muted">${t('no_data')}</p>`;
  return sheet('🏆', t('ranking'), t('by_power'), body);
}
function mMail() {
  S.newsSeen = now(); save();
  const news = NET.news.map(n => `<div class="li"><span class="lic">📰</span><div class="lit"><b>${esc(L(n.title))}</b><small style="white-space:pre-wrap">${esc(L(n.body))}</small><small>${new Date(n.at).toLocaleDateString(LANG === 'ar' ? 'ar' : 'en')}</small></div></div>`).join('');
  const gifts = S.mail.slice(0, 20).map(m => `<div class="li"><span class="lic">🎁</span><div class="lit"><b>${esc(m.note || t('admin_gift'))}</b><div class="row">${rewHTML(m.r)}</div><small>${new Date(m.at).toLocaleString(LANG === 'ar' ? 'ar' : 'en')}</small></div></div>`).join('');
  return sheet('✉️', t('mail'), '', (news || gifts) ? `${news ? `<h3>${t('news')}</h3>${news}` : ''}${gifts ? `<h3>${t('gifts')}</h3>${gifts}` : ''}` : `<p class="muted">${t('no_mail')}</p>`);
}
let adminTaps = 0, adminTapAt = 0, resetArm = 0, delArm = 0;
function mSettings() {
  const body = `<form class="row" id="namef"><input class="field" id="namein" maxlength="16" value="${esc(S.name)}" placeholder="${t('commander')}" aria-label="${t('name')}"><button class="btn pri sm" type="submit">${t('save_name')}</button></form>
  <div class="grid2"><button class="btn ${LANG === 'ar' ? 'ok' : ''}" data-a="lang" data-x="ar">العربية</button><button class="btn ${LANG === 'en' ? 'ok' : ''}" data-a="lang" data-x="en">English</button></div>
  <div class="grid4"><div class="stat"><small>${t('power')}</small><b class="num">${fmt(totalPower())}</b></div><div class="stat"><small>${t('kills')}</small><b class="num">${fmt(S.stats.kills)}</b></div><div class="stat"><small>${t('wins')}</small><b class="num">${fmt(S.stats.wins)}</b></div><div class="stat"><small>${t('sieges_def')}</small><b class="num">${fmt(S.stats.sieges)}</b></div></div>
  <div class="grid2"><button class="btn ${S.snd ? 'ok' : ''}" data-a="tsnd">${S.snd ? '🔊 ' + t('sound_on') : '🔇 ' + t('sound_off')}</button><button class="btn ${S.vib ? 'ok' : ''}" data-a="tvib">${S.vib ? '📳 ' + t('vib_on') : '📴 ' + t('vib_off')}</button></div>
  <div class="li"><span class="lic">${NET.on ? '☁️' : '📱'}</span><div class="lit"><b>${NET.on ? t('online_on') : t('online_off')}</b><small>${NET.on ? t('player_id') + ' <b class="num ltr">#' + (NET.me ? NET.me.short_id : '…') + '</b> · ' + t('id_note') : t('offline_note')}</small></div>${NET.on && NET.me ? `<button class="btn sm" data-a="copyId">${t('copy')}</button>` : ''}</div>
  <button class="btn wide" data-a="vip">👑 VIP ${vipLv()}</button>
  <button class="btn wide" data-a="tut">📖 ${t('how_to_play')}</button>
  <button class="btn wide" data-a="restore">${t('restore')}</button>
  <button class="btn wide ${resetArm > now() ? 'danger' : ''}" data-a="reset">${resetArm > now() ? t('reset_confirm') : '🗑️ ' + t('new_game')}</button>
  <button class="btn wide ${delArm > now() ? 'danger' : ''}" data-a="delAcc">${delArm > now() ? t('delete_confirm') : '⚠️ ' + t('delete_account')}</button>
  <button class="muted sm" data-a="verTap" style="justify-self:center;padding:8px">${t('version')} ${CFG.appVersion}</button>`;
  return sheet(`<span class="av c-me">${esc((S.name || 'C')[0])}</span>`, esc(S.name || t('commander')), t('profile') + ' · Lv ' + S.cmd.lv, body);
}
function mLang() {
  return sheet('🌐', 'اختر اللغة · Choose language', '', `<button class="btn pri wide" data-a="langPick" data-x="ar" style="font-size:20px;min-height:60px">العربية</button><button class="btn pri wide" data-a="langPick" data-x="en" style="font-size:20px;min-height:60px">English</button>`);
}
function mTut() {
  const items = [['🏚️', 'tut_base'], ['🦸', 'tut_heroes'], ['⚔️', 'tut_battle'], ['🗺️', 'tut_world'], ['🧱', 'tut_def'], ['🎖️', 'tut_pass'], ['🤝', 'tut_ally']];
  return sheet('🧟', t('game_name'), t('quick_guide'), `<p>${t('tut_intro')}</p>${items.map(([i, k]) => `<div class="li"><span class="lic">${i}</span><div class="lit"><b>${t(k + '_t')}</b><small>${t(k + '_b')}</small></div></div>`).join('')}<button class="btn pri wide" data-a="close">${t('lets_go')}</button>`);
}
function mSiege(r) {
  const body = r.win ? `<p>${t('siege_win_b')}</p><div class="vs"><div class="stat"><small>${t('your_def')}</small><b class="num good">${fmt(r.def)}</b></div><b>${t('vs')}</b><div class="stat"><small>${t('horde')}</small><b class="num">${fmt(r.horde)}</b></div></div><h3>${t('loot')}</h3><div class="row">${rewHTML(r.r)}</div>`
    : `<p>${t('siege_lose_b')}</p><div class="vs"><div class="stat"><small>${t('your_def')}</small><b class="num bad">${fmt(r.def)}</b></div><b>${t('vs')}</b><div class="stat"><small>${t('horde')}</small><b class="num">${fmt(r.horde)}</b></div></div>
   <h3>${t('losses')}</h3><div class="row">${Object.keys(r.lost).map(k => `<span class="cc lack">${RES[k].i} −${fmt(r.lost[k])}</span>`).join('') || `<span class="muted">${t('wh_protected')}</span>`}</div>
   <div class="muted">${t('wounded_dead', fmt(r.w), fmt(r.dead))}</div><p class="muted sm">${t('siege_tip')}</p>`;
  return sheet(r.win ? '🛡️' : '🔥', r.win ? t('siege_win') : t('siege_lose'), t('def_report'), body + `<button class="btn pri wide" data-a="close">${t('ok')}</button>`);
}
function mGift(r, note, extra) {
  return sheet('🎁', t('gift_title'), note ? esc(note) : '', `<div class="lvup"><div class="big" style="font-size:54px">🎁</div>${extra ? `<b>${esc(extra)}</b>` : ''}<div class="row" style="justify-content:center">${rewHTML(r)}</div></div><button class="btn gold wide" data-a="close">${t('great')}</button>`);
}
function mLevelUp(lv, r) {
  return sheet('⭐', t('level_up'), '', `<div class="lvup"><div class="muted">${t('commander_lv')}</div><div class="big num">${lv}</div><div class="row" style="justify-content:center">${rewHTML(r)}</div></div><button class="btn gold wide" data-a="close">${t('great')}</button>`);
}
function mOffline(sec, gained) {
  return sheet('🌙', t('welcome_back'), t('away_for', fmtT(sec)), `<p class="muted">${t('offline_b')}</p><div class="row" style="justify-content:center">${rewHTML(gained)}</div><button class="btn gold wide" data-a="offCollect">🧺 ${t('collect_all')}</button>`);
}
