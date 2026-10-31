// Builds the game from src/ into:
//   www/index.html        - the iOS app page (offline: local fonts + Capacitor bridge)
//   dist/artifact.html    - a single web page (Google Fonts, no native bridge) for sharing in a browser
import fs from 'node:fs';
const read = p => fs.readFileSync(p, 'utf8');
const css = read('src/css/game.css');
const shell = read('src/shell.html');
const jsFiles = ['config.js', ...fs.readdirSync('src/js').filter(f => /^\d/.test(f)).sort()];
// hero artwork from assets/heroes/<id>.jpg is embedded as data URIs so the game works offline and as one file
const heroArt = fs.existsSync('assets/heroes') ? fs.readdirSync('assets/heroes').filter(f => f.endsWith('.jpg')).sort() : [];
const artJs = 'const HERO_ART = {\n' + heroArt.map(f => `  ${JSON.stringify(f.replace('.jpg', ''))}: 'data:image/jpeg;base64,${fs.readFileSync('assets/heroes/' + f).toString('base64')}',`).join('\n') + '\n};\n';
const artFiles = fs.existsSync('assets/art') ? fs.readdirSync('assets/art').filter(f => f.endsWith('.webp')).sort() : [];
const artJs2 = 'const ART = {\n' + artFiles.map(f => `  ${JSON.stringify(f.replace('.webp', ''))}: 'data:image/webp;base64,${fs.readFileSync('assets/art/' + f).toString('base64')}',`).join('\n') + '\n};\n';
const js = jsFiles.map(f => `/* ---- ${f} ---- */\n` + (f === '02b-portraits.js' ? artJs + artJs2 : '') + read('src/js/' + f)).join('\n');
const game = `(function(){'use strict';\n${js}\n})();`;
new Function(game); // syntax check
const AR = 'U+0600-06FF,U+0750-077F,U+0870-08FF,U+200C-200E,U+2010-2011,U+FB50-FDFF,U+FE70-FEFF';
const LA = 'U+0000-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212';
const face = (fam, file, w) => ['arabic', 'latin'].map(sub => `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url(fonts/${file}-${sub}-${w}-normal.woff2) format('woff2');unicode-range:${sub === 'arabic' ? AR : LA}}`).join('\n');
const fonts = [500, 700, 800].map(w => face('Changa', 'changa', w)).concat([400, 500, 700, 800].map(w => face('Tajawal', 'tajawal', w))).join('\n');
const app = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#0e1215">
<meta name="format-detection" content="telephone=no">
<title>Fajr Survivors</title>
<style>
${fonts}
:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;-webkit-touch-callout:none;-webkit-text-size-adjust:100%;overscroll-behavior:none}
img{max-width:100%}
${css}
</style>
</head>
<body>
${shell}
<script src="three.min.js"></script>
<script src="capacitor.js"></script>
<script>
${game}
</script>
</body>
</html>
`;
fs.mkdirSync('www', { recursive: true });
fs.writeFileSync('www/index.html', app);
fs.copyFileSync('node_modules/@capacitor/core/dist/capacitor.js', 'www/capacitor.js');
fs.copyFileSync('node_modules/three/build/three.min.js', 'www/three.min.js');
const art = `<title>فجر الناجين</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Changa:wght@500;700;800&family=Tajawal:wght@400;500;700;800&display=swap">
<style>
${css}
</style>
${shell}
<script>
${read('node_modules/three/build/three.min.js')}
</script>
<script>
${game}
</script>
`;
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/artifact.html', art);
console.log('www/index.html', (app.length / 1024).toFixed(1) + ' KB · dist/artifact.html', (art.length / 1024).toFixed(1) + ' KB · modules:', jsFiles.length);
