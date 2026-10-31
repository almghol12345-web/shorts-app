// Renders the app icon and splash screen from code (no image assets) into every size needed by
// the web app, Android and iOS. Requires Playwright with Chromium: `node scripts/make-icons.cjs`
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const RES = path.join(ROOT, 'android/app/src/main/res');

// Drawing code runs inside the browser. kind: 'icon' | 'fg' (adaptive foreground) | 'splash'
const PAINT = `
function paint(c, kind) {
  const x = c.getContext('2d'), W = c.width, H = c.height, S = Math.min(W, H);
  const cx = W / 2, cy = H / 2;
  if (kind !== 'fg') {
    const g = x.createRadialGradient(cx, cy * (kind === 'splash' ? 0.8 : 0.75), S * 0.05, cx, cy, Math.max(W, H) * 0.75);
    g.addColorStop(0, '#ff9a3c'); g.addColorStop(0.35, '#b2461a'); g.addColorStop(0.75, '#2a140a'); g.addColorStop(1, '#0d0806');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) { const r = (i * 9301 + 49297) % 233280 / 233280, q = (i * 4447 + 1234) % 1000 / 1000;
      x.fillStyle = 'rgba(255,' + (150 + (i % 5) * 20) + ',60,' + (0.25 + q * 0.5) + ')'; x.beginPath(); x.arc(r * W, q * H, S * (0.003 + q * 0.006), 0, 7); x.fill(); }
  }
  // fortress silhouette
  const s = kind === 'splash' ? S * 0.42 : kind === 'fg' ? S * 0.5 : S * 0.74;
  const bx = cx - s / 2, by = kind === 'splash' ? cy - s * 0.8 : cy - s * 0.38;
  x.save(); x.translate(bx, by); x.scale(s / 100, s / 100);
  x.fillStyle = '#120c08';
  x.beginPath(); x.moveTo(4, 84); x.lineTo(4, 50); x.lineTo(14, 50); x.lineTo(14, 42); x.lineTo(24, 42); x.lineTo(24, 50); x.lineTo(34, 50); x.lineTo(34, 30);
  x.lineTo(42, 30); x.lineTo(42, 22); x.lineTo(58, 22); x.lineTo(58, 30); x.lineTo(66, 30); x.lineTo(66, 50); x.lineTo(76, 50); x.lineTo(76, 42); x.lineTo(86, 42); x.lineTo(86, 50); x.lineTo(96, 50); x.lineTo(96, 84); x.closePath(); x.fill();
  x.fillRect(49, 2, 2.5, 20);
  x.fillStyle = '#ffd27a'; x.beginPath(); x.moveTo(51.5, 2); x.lineTo(68, 6); x.lineTo(51.5, 11); x.fill();
  x.fillStyle = '#ffb35c'; x.fillRect(45, 62, 10, 22); x.fillRect(40, 36, 4, 5); x.fillRect(56, 36, 4, 5); x.fillRect(16, 58, 4, 5); x.fillRect(80, 58, 4, 5);
  x.fillStyle = 'rgba(255,180,90,0.35)'; x.beginPath(); x.ellipse(50, 84, 30, 4, 0, 0, 7); x.fill();
  x.restore();
  if (kind === 'splash') {
    x.textAlign = 'center'; x.fillStyle = '#ffd27a'; x.shadowColor = '#ff7a1a'; x.shadowBlur = S * 0.03;
    x.font = '900 ' + Math.round(S * 0.11) + 'px system-ui, sans-serif'; x.fillText('ASHFALL', cx, cy + S * 0.15);
    x.shadowBlur = 0; x.fillStyle = '#ffb35c'; x.font = '800 ' + Math.round(S * 0.03) + 'px system-ui, sans-serif'; x.fillText('L A S T    B A S T I O N', cx, cy + S * 0.21);
  }
  if (kind === 'round') { /* handled by caller via clip */ }
}`;

async function render(page, w, h, kind, file, round = false) {
  const data = await page.evaluate(({ w, h, kind, round, PAINT }) => {
    eval(PAINT); // eslint-disable-line no-eval
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    if (round) { const t = document.createElement('canvas'); t.width = w; t.height = h; paint(t, 'icon'); const x = c.getContext('2d'); x.beginPath(); x.arc(w / 2, h / 2, w / 2, 0, 7); x.clip(); x.drawImage(t, 0, 0); }
    else paint(c, kind);
    return c.toDataURL('image/png');
  }, { w, h, kind, round, PAINT });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
}

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage();
  await page.setContent('<html><body></body></html>');
  // Web / PWA
  for (const n of [180, 192, 512, 1024]) await render(page, n, n, 'icon', path.join(ROOT, `icons/icon-${n}.png`));
  await render(page, 512, 512, 'splash', path.join(ROOT, 'icons/icon-512-maskable.png'));
  // Android launcher icons
  const dens = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  if (fs.existsSync(RES)) {
    for (const [d, n] of Object.entries(dens)) {
      await render(page, n, n, 'icon', path.join(RES, `mipmap-${d}/ic_launcher.png`));
      await render(page, n, n, 'icon', path.join(RES, `mipmap-${d}/ic_launcher_round.png`), true);
      await render(page, Math.round(n * 2.25), Math.round(n * 2.25), 'fg', path.join(RES, `mipmap-${d}/ic_launcher_foreground.png`));
    }
    fs.writeFileSync(path.join(RES, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#B2461A</color>\n</resources>\n');
    for (const dir of fs.readdirSync(RES)) {
      const f = path.join(RES, dir, 'splash.png');
      if (!fs.existsSync(f)) continue;
      const m = /land/.test(dir), sizes = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };
      const k = Object.keys(sizes).find((z) => dir.endsWith('-' + z)); let [w, h] = k ? sizes[k] : [320, 480];
      if (m || dir === 'drawable') [w, h] = [h, w];
      await render(page, w, h, 'splash', f);
    }
  }
  // iOS
  const ios = path.join(ROOT, 'ios/App/App/Assets.xcassets');
  if (fs.existsSync(ios)) {
    await render(page, 1024, 1024, 'icon', path.join(ios, 'AppIcon.appiconset/AppIcon-512@2x.png'));
    for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) await render(page, 2732, 2732, 'splash', path.join(ios, 'Splash.imageset', f));
  }
  await b.close();
  console.log('Icons and splash screens generated');
})();
