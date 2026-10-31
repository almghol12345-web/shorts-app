// Copies the client into dist/ for the native apps (Capacitor webDir).
// Usage: ASHFALL_SERVER=https://your-server.example npm run build
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
const copy = (rel) => fs.cpSync(path.join(root, rel), path.join(dist, rel), { recursive: true });
['index.html', 'css', 'js', 'icon.svg', 'icons', 'manifest.webmanifest', 'sw.js'].forEach((f) => fs.existsSync(path.join(root, f)) && copy(f));
// Capacitor runtime (ES module, no dependencies) — only loaded inside the native apps
fs.mkdirSync(path.join(dist, 'js/vendor'), { recursive: true });
fs.copyFileSync(path.join(root, 'node_modules/@capacitor/core/dist/index.js'), path.join(dist, 'js/vendor/capacitor.js'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
fs.writeFileSync(path.join(dist, 'js/config.js'), `export const CONFIG = ${JSON.stringify({ SERVER: process.env.ASHFALL_SERVER || '', VERSION: pkg.version })};\n`);
console.log('Built dist/ (server: ' + (process.env.ASHFALL_SERVER || 'offline/same-origin') + ')');
