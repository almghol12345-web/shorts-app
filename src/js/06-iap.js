/* ================= in-app purchases (StoreKit via @capgo/native-purchases) ================= */
const STORE = { ok: false, prices: {}, busy: false };
const pid = p => CFG.productPrefix + p.id;
async function iapInit() {
  const NP = plugin('NativePurchases');
  if (!NP) return;
  try {
    const sup = await NP.isBillingSupported(); if (!sup || !sup.isBillingSupported) return;
    const { products } = await NP.getProducts({ productIdentifiers: IAP.map(pid) });
    (products || []).forEach(pr => { const p = IAP.find(x => pid(x) === pr.identifier); if (p) STORE.prices[p.id] = { str: pr.priceString, price: pr.price, cur: pr.currencyCode }; });
    STORE.ok = true;
    NP.addListener('transactionUpdated', tx => { const p = IAP.find(x => pid(x) === tx.productIdentifier); if (p) deliver(p, tx); });
    if (tab === 'base' || modalFn) refresh();
  } catch (e) { console.warn('iap', e && e.message); }
}
const priceStr = p => (STORE.prices[p.id] && STORE.prices[p.id].str) || (NATIVE ? '…' : '$' + p.usd.toFixed(2)); // in the app, prices always come from the App Store
const canBuy = () => STORE.ok || CFG.devPurchases;
function packGems(p) { const over = NET.cfg.gem_packs && Number(NET.cfg.gem_packs[p.id]); return over > 0 ? over : (p.gems || 0); }
async function buy(id) {
  const p = IAPB[id]; if (!p || STORE.busy) return;
  if (p.kind === 'starter' && S.starter.bought) { toast(t('already_bought'), 1); return; }
  if (p.kind === 'pass' && hasPrem()) { toast(t('already_bought'), 1); return; }
  if (!canBuy()) { toast(t('iap_app_only'), 1); return; }
  if (STORE.ok && !STORE.prices[p.id]) { toast(t('iap_failed'), 1); return; }
  STORE.busy = true; refresh();
  try {
    let tx;
    if (STORE.ok) {
      const NP = plugin('NativePurchases');
      tx = await NP.purchaseProduct({ productIdentifier: pid(p), quantity: 1 });
    } else tx = { transactionId: 'dev-' + now() + '-' + Math.random().toString(36).slice(2, 8), productIdentifier: pid(p) };
    deliver(p, tx);
  } catch (e) {
    const m = (e && (e.message || e.code)) || ''; if (!/cancel/i.test(m)) toast(t('iap_failed') + (m ? ' · ' + m : ''), 1);
  } finally { STORE.busy = false; refresh(); }
}
function deliver(p, tx) {
  const id = String(tx.transactionId || tx.id || '');
  if (id && S.txDone.includes(id)) return;
  if (id) { S.txDone.push(id); if (S.txDone.length > 300) S.txDone.shift(); }
  let r = {};
  if (p.kind === 'gems') { let g = packGems(p); if (!S.firstBuy[p.id]) { g *= 2; S.firstBuy[p.id] = 1; } r.gems = g; }
  else if (p.kind === 'starter') { r = { ...p.r }; S.starter.bought = true; }
  else if (p.kind === 'monthly') { r.gems = p.gems; S.card.until = Math.max(now(), S.card.until) + p.days * 864e5; S.card.last = ''; }
  else if (p.kind === 'pass') { S.pass.prem = season(); }
  give(r);
  S.vip.pts += p.vip; S.stats.spent = (S.stats.spent || 0) + p.usd;
  save(); SND.rare(); buzz('ok');
  const pr = STORE.prices[p.id] || {};
  logPurchase(p, tx, { price: pr.price || p.usd, currency: pr.cur || 'USD', gems: r.gems || 0 });
  queuePopup(() => mGift(r, t('thanks_buy'), p.kind === 'pass' ? t('pass_unlocked') : ''));
  refresh();
}
async function restorePurchases() {
  const NP = plugin('NativePurchases'); if (!NP) { toast(t('iap_app_only'), 1); return; }
  try { await NP.restorePurchases(); toast(t('restored')); } catch (e) { toast(t('iap_failed'), 1); }
}
