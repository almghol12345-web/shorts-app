// Offline smoke test: loads www/index.html with all network blocked and plays through the main screens.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
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
  await step('tutorial', () => pg.click('[data-a=close]'));
  await step('collect', () => pg.click('.bub:not([hidden])'));
  await step('upgrade', async () => { await pg.click('[data-tile=farm1]'); await pg.click('[data-a=up]'); await pg.click('.sh-h [data-a=close]'); });
  await step('recruit', async () => { await pg.click('[data-x=heroes]'); await pg.click('[data-a=openRecruit]'); await pg.click('[data-a=recruit][data-x="1"]'); await pg.click('.sh-h [data-a=close]'); });
  await step('battle', async () => { await pg.click('[data-x=campaign]'); await pg.click('[data-a=fight]'); await pg.waitForSelector('#b-res:not([hidden])', { timeout: 150000 }); await pg.click('#b-cont'); });
  await step('world', async () => { await pg.click('[data-x=world]'); await pg.waitForTimeout(300); });
  await step('alliance', async () => { await pg.click('[data-x=alliance]'); await pg.click('[data-a=join][data-x="0"]'); await pg.fill('#chatin', 'السلام عليكم'); await pg.press('#chatin', 'Enter'); });
  await step('settings', async () => { await pg.click('[data-a=settings]'); await pg.click('[data-a=tsnd]'); await pg.click('.sh-h [data-a=close]'); });
  const stage = await pg.evaluate(() => JSON.parse(localStorage.getItem('fajr-naajin-save-v1') || '{}').stage);
  await b.close();
  console.log(JSON.stringify({ fontsOk, stage, external, errs }, null, 1));
  if (errs.length || external.length || !fontsOk || stage !== 2) process.exit(1);
  console.log('SMOKE TEST PASSED');
})();
