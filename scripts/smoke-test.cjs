// Offline smoke test: loads www/index.html with all network blocked and plays through the main screens.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true });
  const pg = await ctx.newPage();
  const errs = [], external = [];
  await pg.route('**/*', r => { const u = r.request().url(); if (u.startsWith('file:')) return r.continue(); external.push(u); return r.abort(); });
  pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto('file://' + path.resolve('www/index.html'));
  await pg.waitForTimeout(600);
  const fontsOk = await pg.evaluate(async () => { await document.fonts.ready; return document.fonts.check('700 16px Changa'); });
  const step = async (name, fn) => { try { await fn(); } catch (e) { errs.push(name + ': ' + e.message.split('\n')[0]); } };
  await step('language', () => pg.click('[data-a=langPick][data-x=ar]'));
  await step('tutorial', () => pg.click('.sh-b [data-a=close]'));
  await step('3d village', async () => { await pg.waitForTimeout(150); const d = await pg.evaluate(() => window.V3_DEBUG && V3_DEBUG()); if (!d || !d.inited) throw new Error('village not started ' + JSON.stringify(d)); await pg.waitForFunction(() => V3_DEBUG().meshes === 19, null, { timeout: 5000 }); });
  await step('collect', () => pg.evaluate(() => { const b = document.querySelector('.bub:not([hidden])'); if (!b) throw new Error('no bubble'); b.click(); }));
  await step('upgrade', async () => { await pg.evaluate(() => document.querySelector('[data-tile=farm1]').click()); await pg.click('[data-a=up]'); await pg.click('.sh-h [data-a=close]'); });
  for (const a of ['events', 'quests', 'wheel', 'pass', 'shop', 'rank', 'achs', 'mail', 'bag', 'vip']) await step('open ' + a, async () => { await pg.click(`[data-a=${a}]`); await pg.waitForTimeout(120); await pg.click('.sh-h [data-a=close]'); await pg.waitForTimeout(120); });
  await step('recruit', async () => { await pg.click('[data-x=heroes]'); await pg.click('[data-a=openRecruit]'); await pg.click('[data-a=recruit][data-x="1"]'); await pg.click('.sh-h [data-a=close]'); });
  await step('battle', async () => { await pg.click('[data-x=campaign]'); await pg.click('[data-a=fight]'); await pg.waitForSelector('#b-res:not([hidden])', { timeout: 150000 }); await pg.click('#b-cont'); });
  for (let i = 0; i < 4; i++) { const x = await pg.$('#modal:not([hidden]) .sh-h [data-a=close]'); if (!x) break; await x.click(); await pg.waitForTimeout(300); }
  await step('world', async () => { await pg.click('[data-x=world]'); await pg.waitForTimeout(300); await pg.click('[data-a=zoomIn]'); await pg.click('[data-a=findZ]'); await pg.waitForTimeout(1200); await pg.click('[data-a=attackNode]'); await pg.waitForSelector('#b-res:not([hidden])', { timeout: 150000 }); await pg.click('#b-cont'); });
  await step('english', async () => { await pg.click('[data-a=settings]'); await pg.click('[data-a=lang][data-x=en]'); await pg.click('.sh-h [data-a=close]'); });
  await step('alliance', async () => { await pg.click('[data-x=alliance]'); await pg.click('[data-a=join][data-x="0"]'); await pg.fill('#chatin', 'السلام عليكم'); await pg.press('#chatin', 'Enter'); });
  await step('settings', async () => { await pg.click('[data-a=settings]'); await pg.click('[data-a=tsnd]'); await pg.click('.sh-h [data-a=close]'); });
  const dir = await pg.evaluate(() => document.documentElement.dir);
  if (dir !== 'ltr') errs.push('direction not switched to ltr: ' + dir);
  const sv = await pg.evaluate(() => JSON.parse(localStorage.getItem('fajr-naajin-save-v1') || '{}')); const stage = sv.stage;
  if (!(sv.world && sv.world.maxZ >= 1)) errs.push('world camp not defeated');
  await b.close();
  console.log(JSON.stringify({ fontsOk, stage, external, errs }, null, 1));
  if (errs.length || external.length || !fontsOk || stage !== 2) process.exit(1);
  console.log('SMOKE TEST PASSED');
})();
