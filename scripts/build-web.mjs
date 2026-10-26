// Turns src/game.html (the shared game source) into a standalone, offline www/index.html for the app.
import fs from 'node:fs';
const src = fs.readFileSync('src/game.html', 'utf8');
const AR = 'U+0600-06FF,U+0750-077F,U+0870-08FF,U+200C-200E,U+2010-2011,U+FB50-FDFF,U+FE70-FEFF';
const LA = 'U+0000-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212';
const face = (fam, file, w) => ['arabic', 'latin'].map(sub =>
  `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url(fonts/${file}-${sub}-${w}-normal.woff2) format('woff2');unicode-range:${sub === 'arabic' ? AR : LA}}`).join('\n');
const fonts = [500, 700, 800].map(w => face('Changa', 'changa', w)).concat([400, 500, 700, 800].map(w => face('Tajawal', 'tajawal', w))).join('\n');
let body = src
  .replace(/<meta name="claude:viewport-fit-sides"[^>]*>\n?/, '')
  .replace(/<link rel="preconnect"[^>]*>\n?/g, '')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\n?/, '');
const cut = body.indexOf('<div id="app">');
if (cut < 0) throw new Error('app root not found');
const head = body.slice(0, cut), rest = body.slice(cut);
if (/https?:\/\/(?!claude\.ai)/.test(head.replace(/<!--[\s\S]*?-->/g, ''))) console.warn('warning: external URL left in head');
const out = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#0e1215">
<meta name="format-detection" content="telephone=no">
<style>
${fonts}
:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;-webkit-touch-callout:none;-webkit-text-size-adjust:100%;overscroll-behavior:none}
img{max-width:100%}
</style>
${head.trim()}
</head>
<body>
${rest.trim()}
</body>
</html>
`;
fs.mkdirSync('www', { recursive: true });
fs.writeFileSync('www/index.html', out);
console.log('www/index.html', (out.length / 1024).toFixed(1) + ' KB');
