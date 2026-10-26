/* ================= online (Supabase REST, no SDK) =================
 * Players get an anonymous account automatically. The admin signs in with email/password.
 * Everything fails soft: if the server is not configured or unreachable, the game keeps working offline.
 */
const NET = { on: false, ready: false, sess: null, adm: null, me: null, news: [], lastSync: 0, lastPoll: 0, cfg: {}, err: '' };
const AUTH_KEY = 'fajr-auth-v1', ADM_KEY = 'fajr-admin-v1';
const netConfigured = () => !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
async function http(path, opt = {}) {
  const headers = { apikey: CFG.supabaseAnonKey, 'Content-Type': 'application/json', ...(opt.headers || {}) };
  const tok = opt.token === undefined ? (NET.sess && NET.sess.access_token) : opt.token;
  if (tok) headers.Authorization = 'Bearer ' + tok;
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), opt.timeout || 12000);
  try {
    const r = await fetch(CFG.supabaseUrl.replace(/\/$/, '') + path, { method: opt.method || 'GET', headers, body: opt.body !== undefined ? JSON.stringify(opt.body) : undefined, signal: ctl.signal });
    const txt = await r.text(); let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
    if (!r.ok) { const msg = (data && (data.msg || data.message || data.error_description || data.error)) || ('HTTP ' + r.status); const er = new Error(msg); er.status = r.status; throw er; }
    return data;
  } finally { clearTimeout(tm); }
}
function saveSess(key, s) { if (s) storeSet(key, JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || (Math.floor(now() / 1000) + (s.expires_in || 3600)), user: s.user ? { id: s.user.id, email: s.user.email } : null })); else storeDel(key); }
function loadSess(key) { try { return JSON.parse(storeGet(key) || 'null'); } catch (e) { return null; } }
async function refreshSess(s) {
  const d = await http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', token: null, body: { refresh_token: s.refresh_token } });
  return { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(now() / 1000) + d.expires_in, user: d.user ? { id: d.user.id, email: d.user.email } : s.user };
}
async function ensureSession() {
  let s = loadSess(AUTH_KEY);
  if (s && s.expires_at - 60 < now() / 1000) { try { s = await refreshSess(s); saveSess(AUTH_KEY, s); } catch (e) { if (e.status === 400 || e.status === 401) s = null; else throw e; } }
  if (!s) {
    const d = await http('/auth/v1/signup', { method: 'POST', token: null, body: { data: {} } });
    s = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(now() / 1000) + (d.expires_in || 3600), user: { id: d.user.id } };
    saveSess(AUTH_KEY, s);
  }
  NET.sess = s; return s;
}
const uid = () => NET.sess && NET.sess.user && NET.sess.user.id;
async function netInit() {
  if (!netConfigured()) return;
  try {
    await ensureSession();
    NET.on = true;
    await syncPlayer(true);
    await Promise.all([fetchConfig(), fetchEvents(), fetchNews()]);
    await claimGrants();
    NET.ready = true; NET.err = '';
    checkBlocking();
    refresh();
  } catch (e) { NET.err = e.message; console.warn('net', e.message); }
}
function playerRow() {
  return { id: uid(), name: S.name || 'Commander', power: totalPower(), level: S.cmd.lv, stage: S.stage, hq: hqLv(), gems: Math.floor(S.res.gems), vip: vipLv(), lang: LANG, app_version: CFG.appVersion, save: S };
}
async function syncPlayer(first) {
  if (!NET.on) return;
  NET.lastSync = now();
  const rows = await http('/rest/v1/players?on_conflict=id&select=short_id,banned,ban_reason,created_at', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: playerRow() });
  NET.me = rows && rows[0] || NET.me;
  if (first && NET.me && NET.me.banned) checkBlocking();
}
async function fetchConfig() {
  const rows = await http('/rest/v1/config?select=key,value');
  NET.cfg = {}; (rows || []).forEach(r => NET.cfg[r.key] = r.value);
}
async function fetchEvents() {
  const iso = new Date().toISOString();
  const rows = await http(`/rest/v1/events?select=*&active=eq.true&ends_at=gt.${encodeURIComponent(iso)}&order=starts_at.asc`);
  REMOTE_EVENTS = (rows || []).map(r => ({ id: 'r' + r.id, rid: r.id, type: r.type, title: r.title || {}, body: r.body || {}, starts: r.starts_at ? Date.parse(r.starts_at) : 0, ends: r.ends_at ? Date.parse(r.ends_at) : 0, params: r.params || {} }));
}
async function fetchNews() {
  const rows = await http('/rest/v1/news?select=*&order=created_at.desc&limit=20');
  NET.news = (rows || []).map(r => ({ id: r.id, title: r.title || {}, body: r.body || {}, at: Date.parse(r.created_at) }));
}
async function claimGrants() {
  if (!NET.on) return;
  const rows = await http('/rest/v1/rpc/claim_grants', { method: 'POST', body: {} });
  if (rows && rows.length) {
    rows.forEach(g => { const r = sanitizeRewards(g.rewards); give(r); S.mail.unshift({ at: now(), note: g.note || '', r, from: 'admin' }); });
    S.mail = S.mail.slice(0, 50); save();
    const total = {}; rows.forEach(g => { const r = sanitizeRewards(g.rewards); for (const k in r) total[k] = (total[k] || 0) + r[k]; });
    queuePopup(() => mGift(total, rows.map(g => g.note).filter(Boolean).join(' · ')));
    SND.rare(); buzz('ok');
  }
}
function sanitizeRewards(r) { const out = {}; if (!r || typeof r !== 'object') return out; for (const k in r) { if (k === 'hero') { if (HB[r[k]]) out.hero = r[k]; continue; } const v = Math.floor(Number(r[k])); if (v > 0 && (k in RES || k in ITEMS || k === 'troops' || k === 'vip')) out[k] = Math.min(v, 1e9); } return out; }
async function leaderboard() {
  if (!NET.on) return null;
  return await http('/rest/v1/rpc/leaderboard', { method: 'POST', body: {} });
}
async function logPurchase(p, tx, extra) {
  if (!NET.on) return;
  try { await http('/rest/v1/purchases', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { player_id: uid(), product_id: p.id, transaction_id: String(tx.transactionId || tx.id || ('local-' + now())), price: extra.price || p.usd, currency: extra.currency || 'USD', gems: extra.gems || 0, receipt: tx.jwsRepresentation || null } }); } catch (e) { console.warn('purchase log', e.message); }
}
async function netTick() {
  if (!NET.on) return;
  const t = now();
  try {
    if (t - NET.lastSync > 120000) await syncPlayer();
    if (t - NET.lastPoll > 60000) { NET.lastPoll = t; await claimGrants(); await fetchEvents(); await fetchNews(); await fetchConfig(); checkBlocking(); }
  } catch (e) { NET.err = e.message; }
}
function compareVer(a, b) { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; }
function checkBlocking() {
  let el = $('#block'); let html = '';
  if (NET.me && NET.me.banned) html = `<div class="panel"><div style="font-size:48px">⛔</div><h2>${t('banned_t')}</h2><p class="muted">${esc(NET.me.ban_reason || t('banned_b'))}</p><p class="sm muted">ID #${NET.me.short_id}</p></div>`;
  else if (NET.cfg.maintenance && NET.cfg.maintenance.on) html = `<div class="panel"><div style="font-size:48px">🛠️</div><h2>${t('maint_t')}</h2><p class="muted">${esc(L(NET.cfg.maintenance.msg) || t('maint_b'))}</p></div>`;
  else if (NET.cfg.min_version && compareVer(CFG.appVersion, NET.cfg.min_version) < 0) html = `<div class="panel"><div style="font-size:48px">⬆️</div><h2>${t('update_t')}</h2><p class="muted">${t('update_b')}</p></div>`;
  if (!html) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'block'; el.className = 'block'; document.body.appendChild(el); }
  el.innerHTML = html;
}
async function deleteAccount() {
  if (NET.on) await http('/rest/v1/rpc/delete_my_account', { method: 'POST', body: {} });
  storeDel(AUTH_KEY); NET.on = false; NET.sess = null; NET.me = null;
}
/* ---------- admin API (separate session; uses the admin's own token) ---------- */
async function admToken() {
  let s = NET.adm || loadSess(ADM_KEY); if (!s) throw new Error(t('adm_need_login'));
  if (s.expires_at - 60 < now() / 1000) { s = await refreshSess(s); saveSess(ADM_KEY, s); }
  NET.adm = s; return s.access_token;
}
async function adm(path, opt = {}) { return http(path, { ...opt, token: await admToken() }); }
async function adminLogin(email, password) {
  const d = await http('/auth/v1/token?grant_type=password', { method: 'POST', token: null, body: { email, password } });
  const s = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(now() / 1000) + d.expires_in, user: { id: d.user.id, email: d.user.email } };
  const ok = await http('/rest/v1/rpc/is_admin', { method: 'POST', token: s.access_token, body: {} });
  if (ok !== true) throw new Error(t('adm_not_admin'));
  NET.adm = s; saveSess(ADM_KEY, s); return s;
}
function adminLogout() { NET.adm = null; saveSess(ADM_KEY, null); }
