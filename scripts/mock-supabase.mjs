// A small local stand-in for Supabase (auth + the PostgREST features the game uses), backed by
// PGlite running supabase/schema.sql with real row-level security. Used by the online end-to-end test.
//   node scripts/mock-supabase.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

export async function startMock(port = 54321) {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key, email text unique, password text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`);
  await db.exec(fs.readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  const tokens = new Map(); // access/refresh token -> user id
  const issue = (id, email) => { const a = 'at-' + crypto.randomUUID(), r = 'rt-' + crypto.randomUUID(); tokens.set(a, id); tokens.set(r, id); return { access_token: a, refresh_token: r, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id, email } }; };
  async function addAdmin(email, password) { const id = crypto.randomUUID(); await db.query('insert into auth.users values ($1,$2,$3)', [id, email, password]); await db.query('insert into public.admins(user_id) values ($1)', [id]); return id; }
  let q = Promise.resolve(); // serialize DB access (role switching is per-connection)
  const run = (uid, fn) => (q = q.then(async () => {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
    try { return await fn(); } finally { await db.exec('reset role'); }
  }));
  const ident = s => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw Object.assign(new Error('bad identifier ' + s), { status: 400 }); return '"' + s + '"'; };
  function parseSelect(sel, table) {
    if (!sel || sel === '*') return 't.*';
    return sel.split(/,(?![^(]*\))/).map(part => {
      const m = part.match(/^([a-z_]+)\(([^)]*)\)$/);
      if (m) { const cols = m[2].split(',').map(c => `'${c}', e.${ident(c)}`).join(','); return `(select json_build_object(${cols}) from public.${ident(m[1])} e where e.id = t.player_id) as ${ident(m[1])}`; }
      return part === '*' ? 't.*' : 't.' + ident(part);
    }).join(', ');
  }
  function where(params, vals) {
    const out = [];
    for (const [k, v] of params) {
      if (['select', 'order', 'limit', 'on_conflict'].includes(k)) continue;
      const m = v.match(/^(eq|gt|lt|gte|lte|ilike)\.(.*)$/s); if (!m) continue;
      const op = { eq: '=', gt: '>', lt: '<', gte: '>=', lte: '<=', ilike: 'ilike' }[m[1]];
      let val = m[2]; if (m[1] === 'ilike') val = val.replace(/\*/g, '%');
      if (val === 'true' || val === 'false') { out.push(`t.${ident(k)} ${op} ${val}`); continue; }
      vals.push(val); out.push(`t.${ident(k)}::text ${op === 'ilike' ? 'ilike' : op} $${vals.length}` .replace('::text >', ' >').replace('::text <', ' <'));
    }
    return out.length ? ' where ' + out.join(' and ') : '';
  }
  async function rest(uid, method, table, params, body, prefer) {
    if (table.startsWith('rpc/')) {
      const fn = table.slice(4);
      return run(uid, async () => {
        if (fn === 'is_admin' || fn === 'admin_stats') { const r = await db.query(`select public.${ident(fn)}() as v`); return r.rows[0].v; }
        return (await db.query(`select * from public.${ident(fn)}()`)).rows;
      });
    }
    const T = 'public.' + ident(table), vals = [];
    return run(uid, async () => {
      if (method === 'GET') {
        let sql = `select ${parseSelect(params.get('select'), table)} from ${T} t` + where(params, vals);
        const ord = params.get('order'); if (ord) sql += ' order by ' + ord.split(',').map(o => { const [c, d] = o.split('.'); return 't.' + ident(c) + (d === 'desc' ? ' desc' : ' asc'); }).join(',');
        const lim = params.get('limit'); if (lim) sql += ' limit ' + Number(lim);
        return (await db.query(sql, vals)).rows;
      }
      if (method === 'POST') {
        const rows = Array.isArray(body) ? body : [body]; const out = [];
        for (const row of rows) {
          const cols = Object.keys(row); const v = cols.map(c => row[c] !== null && typeof row[c] === 'object' ? JSON.stringify(row[c]) : row[c]);
          let sql = `insert into ${T} as t (${cols.map(ident).join(',')}) values (${cols.map((_, i) => '$' + (i + 1)).join(',')})`;
          const oc = params.get('on_conflict'); if (oc && /merge-duplicates/.test(prefer)) sql += ` on conflict (${ident(oc)}) do update set ${cols.filter(c => c !== oc).map(c => `${ident(c)} = excluded.${ident(c)}`).join(',')}`;
          if (/return=representation/.test(prefer)) sql += ' returning ' + parseSelect(params.get('select'), table);
          const r = await db.query(sql, v); out.push(...r.rows);
        }
        return /return=representation/.test(prefer) ? out : null;
      }
      if (method === 'PATCH') { const cols = Object.keys(body); const v = cols.map(c => body[c] !== null && typeof body[c] === 'object' ? JSON.stringify(body[c]) : body[c]); vals.push(...v); const sql = `update ${T} t set ${cols.map((c, i) => `${ident(c)} = $${i + 1}`).join(',')}` + where(params, vals); await db.query(sql, vals); return null; }
      if (method === 'DELETE') { await db.query(`delete from ${T} t` + where(params, vals), vals); return null; }
    });
  }
  const server = http.createServer(async (req, res) => {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    let raw = ''; for await (const c of req) raw += c;
    const body = raw ? JSON.parse(raw) : null; const url = new URL(req.url, 'http://x');
    const send = (code, obj) => { res.writeHead(code, { ...cors, 'Content-Type': 'application/json' }); res.end(obj == null ? '' : JSON.stringify(obj)); };
    try {
      if (url.pathname === '/auth/v1/signup') { const id = crypto.randomUUID(); await (q = q.then(() => db.query('insert into auth.users(id) values ($1)', [id]))); return send(200, issue(id)); }
      if (url.pathname === '/auth/v1/token') {
        const gt = url.searchParams.get('grant_type');
        if (gt === 'password') { const r = await (q = q.then(() => db.query('select id from auth.users where email=$1 and password=$2', [body.email, body.password]))); if (!r.rows.length) return send(400, { error_description: 'Invalid login credentials' }); return send(200, issue(r.rows[0].id, body.email)); }
        if (gt === 'refresh_token') { const id = tokens.get(body.refresh_token); if (!id) return send(400, { error_description: 'Invalid Refresh Token' }); tokens.delete(body.refresh_token); return send(200, issue(id)); }
      }
      if (url.pathname.startsWith('/rest/v1/')) {
        const auth = (req.headers.authorization || '').replace('Bearer ', ''); const uid = tokens.get(auth) || null;
        if (auth && !uid) return send(401, { message: 'JWT expired' });
        const out = await rest(uid, req.method, url.pathname.slice(9), url.searchParams, body, req.headers.prefer || '');
        return send(out == null ? 201 : 200, out);
      }
      send(404, { message: 'not found' });
    } catch (e) { if (process.env.MOCK_DEBUG) console.log('MOCK ERR', req.method, req.url.slice(0, 80), e.message); send(e.status || 400, { message: e.message }); }
  });
  await new Promise(r => server.listen(port, r));
  return { url: `http://127.0.0.1:${port}`, db, addAdmin, close: () => server.close() };
}
if (import.meta.url === `file://${process.argv[1]}`) { const m = await startMock(Number(process.argv[2]) || 54321); await m.addAdmin('admin@test.local', 'secret123'); console.log('mock supabase on', m.url, '· admin: admin@test.local / secret123'); }
