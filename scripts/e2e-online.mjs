// Online end-to-end test: player + admin flows against the local mock Supabase.
//   npm run build && node scripts/e2e-online.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { startMock } from './mock-supabase.mjs';

const mock = await startMock(54329);
await mock.addAdmin('admin@test.local', 'secret123');
const html = fs.readFileSync('www/index.html', 'utf8')
  .replace("supabaseUrl: '',", `supabaseUrl: '${mock.url}',`)
  .replace("supabaseAnonKey: '',", "supabaseAnonKey: 'test-anon',")
  .replace('devPurchases: false,', 'devPurchases: true,');
if (!html.includes(mock.url)) throw new Error('config injection failed');
const page = path.resolve('www/__e2e.html'); fs.writeFileSync(page, html);

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1 });
const pg = await ctx.newPage();
const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const q = async (sql, p) => (await mock.db.query(sql, p)).rows;
const closeAll = async () => { for (let i = 0; i < 5; i++) { const x = await pg.$('#modal:not([hidden]) .sh-h [data-a=close]'); if (!x) break; await x.click(); await pg.waitForTimeout(300); } };
try {
  await pg.goto('file://' + page); await pg.waitForTimeout(500);
  await pg.click('[data-a=langPick][data-x=en]'); await pg.click('.sh-b [data-a=close]');
  await pg.waitForTimeout(1500);
  let rows = await q('select short_id, name from public.players');
  ok(rows.length === 1, 'player row created on first open #' + (rows[0] && rows[0].short_id));
  const pid = (await q('select id from public.players'))[0].id;
  await pg.click('[data-a=settings]'); await pg.waitForTimeout(300);
  ok((await pg.textContent('.sh-b')).includes('#' + rows[0].short_id), 'settings shows player ID');
  await pg.fill('#namein', 'Tester'); await pg.click('#namef button'); await pg.waitForTimeout(800);
  ok((await q('select name from public.players'))[0].name === 'Tester', 'rename synced to server');
  const gemsBefore = await pg.evaluate(() => JSON.parse(localStorage.getItem('fajr-naajin-save-v1')).res.gems);
  // admin login
  for (let i = 0; i < 7; i++) await pg.click('[data-a=verTap]');
  await pg.waitForTimeout(300);
  await pg.fill('#admPass', 'wrong'); await pg.fill('#admEmail', 'admin@test.local'); await pg.click('#admLoginF button'); await pg.waitForTimeout(800);
  ok(await pg.$('#admLoginF'), 'wrong password rejected');
  await pg.fill('#admEmail', 'admin@test.local'); await pg.fill('#admPass', 'secret123'); await pg.click('#admLoginF button'); await pg.waitForTimeout(1200);
  ok((await pg.textContent('.sh-b')).includes('All players'), 'admin dashboard opens');
  // grant gems to the player
  await pg.click('[data-a=admTab][data-x=players]'); await pg.waitForTimeout(800);
  await pg.click(`[data-a=admSel][data-x="${pid}"]`); await pg.waitForTimeout(300);
  await pg.fill('#pg_gems', '777'); await pg.fill('#pg_ticket', '3'); await pg.fill('#pg_note', 'Thanks for buying'); await pg.click('[data-a=admGrant]'); await pg.waitForTimeout(800);
  ok((await q('select count(*)::int n from public.grants')).at(0).n === 1, 'admin gift stored');
  // global gift + event + news
  await pg.click('[data-a=admBack]'); await pg.click('[data-a=admTab][data-x=gifts]'); await pg.waitForTimeout(500);
  await pg.fill('#ga_gems', '50'); await pg.fill('#ga_note', 'Eid gift'); await pg.click('[data-a=admGrantAll]'); await pg.waitForTimeout(800);
  await pg.click('[data-a=admTab][data-x=events]'); await pg.waitForTimeout(500);
  await pg.fill('#ev_tar', 'جوائز مضاعفة'); await pg.fill('#ev_ten', 'Triple rewards'); await pg.fill('#ev_m', '3'); await pg.click('[data-a=admEvAdd]'); await pg.waitForTimeout(900);
  await pg.selectOption('#ev_type', 'kills'); await pg.fill('#ev_ten', 'Kill race'); await pg.fill('#ev_goal', '5'); await pg.fill('#er_gems', '99'); await pg.click('[data-a=admEvAdd]'); await pg.waitForTimeout(900);
  ok((await q('select count(*)::int n from public.events where active')).at(0).n === 2, 'admin published 2 events');
  await pg.click('[data-a=admTab][data-x=news]'); await pg.waitForTimeout(400);
  await pg.fill('#nw_ten', 'Season 2 is here'); await pg.fill('#nw_ben', 'New heroes!'); await pg.click('[data-a=admNewsAdd]'); await pg.waitForTimeout(800);
  await pg.click('[data-a=admTab][data-x=config]'); await pg.waitForTimeout(500);
  await pg.fill('#cf_gems1', '150'); await pg.click('[data-a=admCfgPacks]'); await pg.waitForTimeout(700);
  ok(JSON.stringify((await q("select value from public.config where key='gem_packs'"))[0].value).includes('150'), 'gem pack amount saved');
  await pg.click('.sh-h [data-a=close]').catch(() => { });
  // player receives everything after reopening
  await pg.reload(); await pg.waitForTimeout(2500);
  const giftTxt = await pg.textContent('#modal').catch(() => '');
  ok((await q('select count(*)::int n from public.grants where claimed_at is not null')).at(0).n === 1 && (await q('select count(*)::int n from public.grant_claims')).at(0).n === 1, 'personal and global gifts claimed by the game');
  const gemsAfter = await pg.evaluate(() => JSON.parse(localStorage.getItem('fajr-naajin-save-v1')).res.gems);
  ok(gemsAfter - gemsBefore >= 827, `gems added (+${gemsAfter - gemsBefore})`);
  const mail = await pg.evaluate(() => JSON.parse(localStorage.getItem('fajr-naajin-save-v1')).mail.map(m => m.note));
  ok(mail.includes('Thanks for buying') && mail.includes('Eid gift'), 'gift notes saved in mail');
  await closeAll();
  ok((await pg.textContent('#view')).includes('Triple rewards'), 'event banner shows on base');
  await pg.click('[data-x=campaign]'); ok((await pg.textContent('#view')).includes('×3'), 'campaign shows ×3 rewards');
  await pg.click('[data-x=base]'); await pg.click('[data-a=mail]'); await pg.waitForTimeout(300);
  ok((await pg.textContent('.sh-b')).includes('Season 2 is here'), 'news shows in mail'); await closeAll();
  // purchase (dev mode) → logged, VIP up, first-buy double with admin amount
  await pg.click('[data-a=shop]'); await pg.waitForTimeout(300); await pg.click('[data-a=buy][data-x=gems1]'); await pg.waitForTimeout(1200);
  const buys = await q('select product_id, gems from public.purchases');
  ok(buys.length === 1 && buys[0].gems === 300, 'purchase logged with first-buy double of admin amount: ' + JSON.stringify(buys));
  ok(Number((await q('select spent from public.players'))[0].spent) > 0, 'player spent updated');
  await closeAll();
  // leaderboard
  await pg.click('[data-a=rank]'); await pg.waitForTimeout(800); ok((await pg.textContent('.sh-b')).includes('Tester'), 'leaderboard lists the player'); await closeAll();
  // ban → blocked screen
  await pg.evaluate(() => { });
  await mock.db.query("update public.players set banned = true, ban_reason = 'Test ban'");
  await pg.reload(); await pg.waitForTimeout(2500);
  ok(await pg.$('#block') && (await pg.textContent('#block')).includes('Test ban'), 'banned player sees blocked screen');
  await mock.db.query("update public.players set banned = false");
  await mock.db.query("insert into public.config(key,value) values ('min_version','\"9.0.0\"') on conflict (key) do update set value = excluded.value");
  await pg.reload(); await pg.waitForTimeout(2500);
  ok(await pg.$('#block') && (await pg.textContent('#block')).includes('Update'), 'old version asked to update');
  await mock.db.query("delete from public.config where key='min_version'");
  const real = errs.filter(e => !/status of 400/.test(e) && !/navigator\.vibrate/.test(e)); ok(real.length === 0 && errs.length <= 1, 'no page errors besides the wrong-password test ' + JSON.stringify(errs));
} catch (e) { ok(false, 'exception: ' + e.message.split('\n')[0]); }
await b.close(); mock.close(); fs.unlinkSync(page);
if (fail) { console.log(fail + ' FAILED'); process.exit(1); } else console.log('ONLINE E2E PASSED');
