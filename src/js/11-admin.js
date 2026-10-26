/* ================= admin panel (hidden: tap the version label 7 times in Settings) ================= */
const ADM = { tab: 'dash', data: {}, busy: false, q: '', sel: null, err: '' };
const REW_FIELDS = ['gems', 'ticket', 'sp60', 'sp5', 'spin', 'stam', 'food', 'wood', 'iron', 'fuel', 'exp', 'vip'];
const EV_TYPES = ['double', 'production', 'discount', 'gift', 'kills'];
const fieldIcon = k => k === 'vip' ? '👑' : (RES[k] || ITEMS[k]).i;
function rewFields(prefix) { return `<div class="grid3">${REW_FIELDS.map(k => `<label class="lbl">${fieldIcon(k)} ${k === 'vip' ? 'VIP' : L((RES[k] || ITEMS[k]).n)}<input class="field num" id="${prefix}${k}" type="number" min="0" inputmode="numeric" placeholder="0"></label>`).join('')}</div>`; }
function readRew(prefix) { const r = {}; REW_FIELDS.forEach(k => { const e = document.getElementById(prefix + k); const v = e ? Math.floor(Number(e.value)) : 0; if (v > 0) r[k] = v; }); return r; }
function clearRew(prefix) { REW_FIELDS.forEach(k => { const e = document.getElementById(prefix + k); if (e) e.value = ''; }); }
const val = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
const dt = iso => iso ? new Date(iso).toLocaleString(LANG === 'ar' ? 'ar' : 'en', { dateStyle: 'short', timeStyle: 'short' }) : '—';
async function admRun(fn, okMsg) {
  if (ADM.busy) return; ADM.busy = true; ADM.err = ''; renderModal();
  try { await fn(); if (okMsg) toast(okMsg); } catch (e) { ADM.err = e.message || String(e); toast(ADM.err, 1); if (e.status === 401) { adminLogout(); } }
  ADM.busy = false; renderModal();
}
async function admLoad(kind, force) {
  if (ADM.data[kind] && !force) return;
  await admRun(async () => {
    if (kind === 'dash') ADM.data.dash = await adm('/rest/v1/rpc/admin_stats', { method: 'POST', body: {} });
    if (kind === 'players') {
      const q = ADM.q; let f = '';
      if (/^#?\d+$/.test(q)) f = '&short_id=eq.' + q.replace('#', ''); else if (q) f = '&name=ilike.' + encodeURIComponent('*' + q + '*');
      ADM.data.players = await adm('/rest/v1/players?select=id,short_id,name,power,level,stage,hq,gems,vip,spent,banned,ban_reason,updated_at,created_at,lang&order=updated_at.desc&limit=60' + f);
    }
    if (kind === 'events') ADM.data.events = await adm('/rest/v1/events?select=*&order=created_at.desc&limit=60');
    if (kind === 'news') ADM.data.news = await adm('/rest/v1/news?select=*&order=created_at.desc&limit=60');
    if (kind === 'config') { const rows = await adm('/rest/v1/config?select=key,value'); const c = {}; (rows || []).forEach(r => c[r.key] = r.value); ADM.data.config = c; }
    if (kind === 'buys') ADM.data.buys = await adm('/rest/v1/purchases?select=*,players(short_id,name)&order=created_at.desc&limit=80');
    if (kind === 'gifts') ADM.data.gifts = await adm('/rest/v1/grants?select=*,players(short_id,name)&order=created_at.desc&limit=60');
  });
}
function mAdmin() {
  if (!netConfigured()) return sheet('🛡️', t('admin'), '', `<div class="li"><span class="lic">⚙️</span><div class="lit"><b>${t('adm_no_server')}</b><small>${t('adm_no_server_b')}</small></div></div>`);
  const logged = NET.adm || loadSess(ADM_KEY);
  if (!logged) return sheet('🛡️', t('admin'), t('adm_login_sub'), `<form id="admLoginF" style="display:grid;gap:10px"><label class="lbl">${t('email')}<input class="field ltr" id="admEmail" type="email" autocomplete="username" required></label><label class="lbl">${t('password')}<input class="field ltr" id="admPass" type="password" autocomplete="current-password" required></label><button class="btn pri" type="submit" ${ADM.busy ? 'disabled' : ''}>${ADM.busy ? t('loading') : t('login')}</button></form>${ADM.err ? `<p class="bad sm">${esc(ADM.err)}</p>` : ''}`);
  const tabs = ['dash', 'players', 'gifts', 'events', 'news', 'config', 'buys'];
  let body = `<div class="subtabs">${tabs.map(k => `<button class="${ADM.tab === k ? 'on' : ''}" data-a="admTab" data-x="${k}">${t('adm_' + k)}</button>`).join('')}</div>${ADM.busy ? `<p class="muted sm">${t('loading')}</p>` : ''}`;
  const d = ADM.data;
  if (ADM.tab === 'dash') {
    const s = d.dash || {};
    body += `<div class="grid2">${[['players_total', s.players], ['active_24h', s.active_24h], ['new_today', s.new_today], ['banned_n', s.banned], ['buys_total', s.purchases], ['buys_today', s.purchases_today], ['revenue_total', s.revenue != null ? '$' + Number(s.revenue).toFixed(2) : null], ['revenue_today', s.revenue_today != null ? '$' + Number(s.revenue_today).toFixed(2) : null]].map(([k, v]) => `<div class="kpi"><small>${t('k_' + k)}</small><b class="num">${v == null ? '—' : typeof v === 'number' ? fmt(v) : esc(v)}</b></div>`).join('')}</div>
    <button class="btn sm" data-a="admRefresh">🔄 ${t('refresh')}</button><p class="muted sm">${t('adm_signed', esc(logged.user && logged.user.email || ''))}</p><button class="btn sm" data-a="admLogout">${t('logout')}</button>`;
  }
  if (ADM.tab === 'players') {
    if (ADM.sel) {
      const p = (d.players || []).find(x => x.id === ADM.sel) || {};
      body += `<button class="btn sm" data-a="admBack" style="justify-self:start">${isRTL() ? '→' : '←'} ${t('back')}</button>
      <div class="panel"><div class="row between"><b style="font-family:var(--fd);font-size:18px">${esc(p.name)} <span class="num muted ltr">#${p.short_id}</span></b>${p.banned ? `<span class="tag live">${t('banned')}</span>` : ''}</div>
      <div class="grid3"><div class="stat"><small>${t('power')}</small><b class="num">${fmt(p.power)}</b></div><div class="stat"><small>Lv</small><b class="num">${p.level}</b></div><div class="stat"><small>${t('stage')}</small><b class="num">${p.stage}</b></div><div class="stat"><small>💎</small><b class="num">${fmt(p.gems)}</b></div><div class="stat"><small>VIP</small><b class="num">${p.vip}</b></div><div class="stat"><small>${t('spent')}</small><b class="num">$${Number(p.spent || 0).toFixed(2)}</b></div></div>
      <small class="muted">${t('last_seen')} ${dt(p.updated_at)} · ${t('joined')} ${dt(p.created_at)}</small></div>
      <div class="panel"><h3>${t('send_gift_to', esc(p.name))}</h3>${rewFields('pg_')}<label class="lbl">${t('note')}<input class="field" id="pg_note" maxlength="120" placeholder="${t('note_ph')}"></label><button class="btn gold" data-a="admGrant" data-x="${p.id}">🎁 ${t('send')}</button></div>
      <div class="panel"><h3>${t('ban_ctl')}</h3><label class="lbl">${t('reason')}<input class="field" id="pb_reason" maxlength="140" value="${esc(p.ban_reason || '')}" data-keep="1"></label>
      ${p.banned ? `<button class="btn ok" data-a="admBan" data-x="${p.id}|0">${t('unban')}</button>` : `<button class="btn danger" data-a="admBan" data-x="${p.id}|1">⛔ ${t('ban')}</button>`}</div>`;
    } else {
      body += `<form class="row" id="admSearchF"><input class="field" id="admQ" placeholder="${t('search_ph')}" value="${esc(ADM.q)}"><button class="btn pri sm" type="submit">${t('search')}</button></form>
      ${(d.players || []).map(p => `<button class="adm-row" data-a="admSel" data-x="${p.id}"><span class="num muted ltr">#${p.short_id}</span><span><b>${esc(p.name)}</b> ${p.banned ? '⛔' : ''}<br><small class="muted">${t('power')} ${fmt(p.power)} · VIP ${p.vip} · 💎 ${fmt(p.gems)}</small></span><span class="sm muted">${p.spent > 0 ? '$' + Number(p.spent).toFixed(0) : ''}</span></button>`).join('') || `<p class="muted">${t('no_data')}</p>`}`;
    }
  }
  if (ADM.tab === 'gifts') {
    body += `<div class="panel"><h3>${t('gift_all')}</h3><p class="muted sm">${t('gift_all_b')}</p>${rewFields('ga_')}<label class="lbl">${t('note')}<input class="field" id="ga_note" maxlength="120" placeholder="${t('note_ph')}"></label><label class="lbl">${t('expires_days')}<input class="field num" id="ga_days" type="number" min="1" value="7"></label><button class="btn gold" data-a="admGrantAll">🎁 ${t('send_all')}</button></div>
    <h3>${t('recent_gifts')}</h3>${(d.gifts || []).map(g => `<div class="adm-row"><span>${g.player_id ? '👤' : '🌍'}</span><span><b>${g.player_id ? esc((g.players && g.players.name) || '') + ' #' + ((g.players && g.players.short_id) || '') : t('everyone')}</b><br><span class="row">${rewHTML(sanitizeRewards(g.rewards))}</span><small class="muted">${esc(g.note || '')}</small></span><small class="muted">${dt(g.created_at)}${g.claimed_at ? '<br>✔ ' + t('claimed') : ''}</small></div>`).join('')}`;
  }
  if (ADM.tab === 'events') {
    const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    body += `<div class="panel"><h3>${t('new_event')}</h3>
    <label class="lbl">${t('ev_type')}<select class="field" id="ev_type" data-a="admEvType">${EV_TYPES.map(k => `<option value="${k}">${t('evt_' + k)}</option>`).join('')}</select></label>
    <small class="muted" id="ev_help">${t('evh_double')}</small>
    <div class="grid2"><label class="lbl">${t('title_ar')}<input class="field" id="ev_tar" maxlength="60"></label><label class="lbl">${t('title_en')}<input class="field ltr" id="ev_ten" maxlength="60"></label></div>
    <div class="grid2"><label class="lbl">${t('body_ar')}<textarea class="field" id="ev_bar" maxlength="300"></textarea></label><label class="lbl">${t('body_en')}<textarea class="field ltr" id="ev_ben" maxlength="300"></textarea></label></div>
    <div class="grid2"><label class="lbl">${t('starts')}<input class="field ltr" id="ev_start" type="datetime-local" value="${nowLocal}"></label><label class="lbl">${t('hours')}<input class="field num" id="ev_hours" type="number" min="1" value="48"></label></div>
    <div class="grid3"><label class="lbl">${t('ev_mult')}<input class="field num" id="ev_m" type="number" step="0.1" min="1" value="2"></label><label class="lbl">${t('ev_disc')}<input class="field num" id="ev_p" type="number" min="0" max="90" value="30"></label><label class="lbl">${t('ev_goal')}<input class="field num" id="ev_goal" type="number" min="1" value="500"></label></div>
    <b class="sm">${t('ev_rewards')}</b>${rewFields('er_')}
    <button class="btn gold" data-a="admEvAdd">⚡ ${t('publish_event')}</button></div>
    <h3>${t('events')}</h3>${(d.events || []).map(e => { const live = e.active && Date.parse(e.ends_at) > now() && Date.parse(e.starts_at) <= now(); return `<div class="adm-row"><span>${live ? '🟢' : e.active ? '🕒' : '⚪'}</span><span><b>${esc(L(e.title))}</b> <span class="tag">${t('evt_' + e.type)}</span><br><small class="muted">${dt(e.starts_at)} → ${dt(e.ends_at)}</small></span><span class="row"><button class="btn sm" data-a="admEvToggle" data-x="${e.id}|${e.active ? 0 : 1}">${e.active ? t('stop') : t('start')}</button><button class="btn sm danger" data-a="admEvDel" data-x="${e.id}">🗑</button></span></div>`; }).join('')}`;
  }
  if (ADM.tab === 'news') {
    body += `<div class="panel"><h3>${t('new_news')}</h3><div class="grid2"><label class="lbl">${t('title_ar')}<input class="field" id="nw_tar" maxlength="80"></label><label class="lbl">${t('title_en')}<input class="field ltr" id="nw_ten" maxlength="80"></label></div>
    <label class="lbl">${t('body_ar')}<textarea class="field" id="nw_bar" maxlength="1000"></textarea></label><label class="lbl">${t('body_en')}<textarea class="field ltr" id="nw_ben" maxlength="1000"></textarea></label>
    <button class="btn gold" data-a="admNewsAdd">📰 ${t('publish')}</button></div>
    ${(d.news || []).map(n => `<div class="adm-row"><span>📰</span><span><b>${esc(L(n.title))}</b><br><small class="muted">${dt(n.created_at)}</small></span><button class="btn sm danger" data-a="admNewsDel" data-x="${n.id}">🗑</button></div>`).join('')}`;
  }
  if (ADM.tab === 'config') {
    const c = d.config || {}, gp = c.gem_packs || {}, mt = c.maintenance || {};
    body += `<div class="panel"><h3>${t('gem_packs')}</h3><p class="muted sm">${t('gem_packs_b')}</p><div class="grid3">${IAP.filter(p => p.kind === 'gems').map(p => `<label class="lbl">${p.i} $${p.usd}<input class="field num" id="cf_${p.id}" type="number" min="1" value="${gp[p.id] || p.gems}"></label>`).join('')}</div><button class="btn pri" data-a="admCfgPacks">${t('save')}</button></div>
    <div class="panel"><h3>${t('maintenance')}</h3><label class="row"><input type="checkbox" id="cf_mon" ${mt.on ? 'checked' : ''}> ${t('maint_on')}</label>
    <label class="lbl">${t('msg_ar')}<input class="field" id="cf_mar" value="${esc((mt.msg && mt.msg.ar) || '')}"></label><label class="lbl">${t('msg_en')}<input class="field ltr" id="cf_men" value="${esc((mt.msg && mt.msg.en) || '')}"></label>
    <button class="btn pri" data-a="admCfgMaint">${t('save')}</button></div>
    <div class="panel"><h3>${t('min_version')}</h3><p class="muted sm">${t('min_version_b', CFG.appVersion)}</p><input class="field ltr" id="cf_minv" value="${esc(c.min_version || '')}" placeholder="1.0.0"><button class="btn pri" data-a="admCfgVer">${t('save')}</button></div>`;
  }
  if (ADM.tab === 'buys') {
    body += (d.buys || []).map(b => `<div class="adm-row"><span>${(IAPB[b.product_id] || { i: '💳' }).i}</span><span><b>${esc((b.players && b.players.name) || '?')}</b> <span class="num muted ltr">#${(b.players && b.players.short_id) || ''}</span><br><small class="muted">${esc(b.product_id)} · ${b.gems ? fmt(b.gems) + ' 💎 · ' : ''}${dt(b.created_at)}</small></span><b class="num">${esc(b.currency || '')} ${Number(b.price || 0).toFixed(2)}</b></div>`).join('') || `<p class="muted">${t('no_data')}</p>`;
  }
  if (ADM.err) body += `<p class="bad sm">${esc(ADM.err)}</p>`;
  return sheet('🛡️', t('admin'), t('adm_sub'), body);
}
function openAdmin() { ADM.err = ''; openModal(mAdmin, true); if (NET.adm || loadSess(ADM_KEY)) admLoad(ADM.tab); }
const ADMIN_ACT = {
  admTab: x => { ADM.tab = x; ADM.sel = null; renderModal(true); admLoad(x); },
  admRefresh: () => admLoad(ADM.tab, true),
  admLogout: () => { adminLogout(); ADM.data = {}; renderModal(true); },
  admSel: x => { ADM.sel = x; renderModal(true); },
  admBack: () => { ADM.sel = null; renderModal(true); },
  admGrant: x => { const r = readRew('pg_'); if (!Object.keys(r).length) { toast(t('enter_reward'), 1); return; } admRun(async () => { await adm('/rest/v1/grants', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { player_id: x, rewards: r, note: val('pg_note') || null } }); clearRew('pg_'); ADM.data.gifts = null; }, t('gift_sent')); },
  admGrantAll: () => { const r = readRew('ga_'); if (!Object.keys(r).length) { toast(t('enter_reward'), 1); return; } const days = Math.max(1, Number(val('ga_days')) || 7); admRun(async () => { await adm('/rest/v1/grants', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { player_id: null, rewards: r, note: val('ga_note') || null, expires_at: new Date(now() + days * 864e5).toISOString() } }); clearRew('ga_'); ADM.data.gifts = null; await admLoad('gifts', true); }, t('gift_sent_all')); },
  admBan: x => { const [id, on] = x.split('|'); admRun(async () => { await adm('/rest/v1/players?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { banned: on === '1', ban_reason: on === '1' ? (val('pb_reason') || null) : null } }); const p = (ADM.data.players || []).find(p => p.id === id); if (p) { p.banned = on === '1'; p.ban_reason = val('pb_reason'); } }, on === '1' ? t('banned_done') : t('unbanned_done')); },
  admEvAdd: () => {
    const type = val('ev_type'), tar = val('ev_tar'), ten = val('ev_ten'); if (!tar && !ten) { toast(t('enter_title'), 1); return; }
    const start = val('ev_start') ? new Date(val('ev_start')) : new Date(); const hours = Math.max(1, Number(val('ev_hours')) || 24);
    const params = {}; if (type === 'double' || type === 'production') params.m = Math.max(1, Number(val('ev_m')) || 2); if (type === 'discount') params.p = clamp(Number(val('ev_p')) || 0, 1, 90); if (type === 'kills') params.goal = Math.max(1, Number(val('ev_goal')) || 100); if (type === 'gift' || type === 'kills') { params.r = readRew('er_'); if (!Object.keys(params.r).length) { toast(t('enter_reward'), 1); return; } }
    admRun(async () => { await adm('/rest/v1/events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { type, title: { ar: tar || ten, en: ten || tar }, body: { ar: val('ev_bar') || val('ev_ben'), en: val('ev_ben') || val('ev_bar') }, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + hours * 36e5).toISOString(), params, active: true } }); ['ev_tar', 'ev_ten', 'ev_bar', 'ev_ben'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; }); clearRew('er_'); await admLoad('events', true); fetchEvents().catch(() => { }); }, t('event_published'));
  },
  admEvType: () => { const h = $('#ev_help'); if (h) h.textContent = t('evh_' + val('ev_type')); },
  admEvToggle: x => { const [id, on] = x.split('|'); admRun(async () => { await adm('/rest/v1/events?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { active: on === '1' } }); await admLoad('events', true); fetchEvents().catch(() => { }); }); },
  admEvDel: (x, el) => { if (!el.dataset.arm) { el.dataset.arm = 1; el.textContent = t('sure'); return; } admRun(async () => { await adm('/rest/v1/events?id=eq.' + x, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); await admLoad('events', true); fetchEvents().catch(() => { }); }, t('deleted')); },
  admNewsAdd: () => { const tar = val('nw_tar'), ten = val('nw_ten'); if (!tar && !ten) { toast(t('enter_title'), 1); return; } admRun(async () => { await adm('/rest/v1/news', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { title: { ar: tar || ten, en: ten || tar }, body: { ar: val('nw_bar') || val('nw_ben'), en: val('nw_ben') || val('nw_bar') } } }); ['nw_tar', 'nw_ten', 'nw_bar', 'nw_ben'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; }); await admLoad('news', true); fetchNews().catch(() => { }); }, t('published')); },
  admNewsDel: (x, el) => { if (!el.dataset.arm) { el.dataset.arm = 1; el.textContent = t('sure'); return; } admRun(async () => { await adm('/rest/v1/news?id=eq.' + x, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); await admLoad('news', true); }, t('deleted')); },
  admCfgPacks: () => { const v = {}; IAP.filter(p => p.kind === 'gems').forEach(p => { const n = Math.floor(Number(val('cf_' + p.id))); if (n > 0) v[p.id] = n; }); admCfg('gem_packs', v); },
  admCfgMaint: () => { const e = $('#cf_mon'); admCfg('maintenance', { on: !!(e && e.checked), msg: { ar: val('cf_mar'), en: val('cf_men') } }); },
  admCfgVer: () => admCfg('min_version', val('cf_minv') || null),
};
function admCfg(key, value) { admRun(async () => { await adm('/rest/v1/config?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: { key, value } }); await admLoad('config', true); fetchConfig().catch(() => { }); }, t('saved')); }
