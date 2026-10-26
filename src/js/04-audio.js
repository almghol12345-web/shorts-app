/* ================= sound & haptics ================= */
let AC = null, lastShot = 0, lastHurt = 0, noiseBuf = null;
function ac() { try { if (!AC) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; AC = new A(); } if (AC.state === 'suspended') AC.resume(); return AC; } catch (e) { return null; } }
function tone(f, d, type, vol, slide, delay) {
  if (!S || !S.snd) return; const c = ac(); if (!c) return;
  const t0 = c.currentTime + (delay || 0); const o = c.createOscillator(), g = c.createGain();
  o.type = type || 'square'; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t0 + d);
  g.gain.setValueAtTime(vol || .05, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + d); o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + d + .02);
}
function noise(d, vol, freq, delay) {
  if (!S || !S.snd) return; const c = ac(); if (!c) return;
  if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const a = noiseBuf.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; }
  const t0 = c.currentTime + (delay || 0); const src = c.createBufferSource(); src.buffer = noiseBuf;
  const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(freq || 1200, t0); fl.frequency.exponentialRampToValueAtTime(60, t0 + d);
  const g = c.createGain(); g.gain.setValueAtTime(vol || .1, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
  src.connect(fl); fl.connect(g); g.connect(c.destination); src.start(t0, Math.random() * .5); src.stop(t0 + d + .02);
}
const SND = {
  click: () => tone(520, .05, 'triangle', .035),
  coin: () => { tone(988, .07, 'square', .03); tone(1480, .12, 'square', .03, 0, .06); },
  up: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, .14, 'triangle', .05, 0, i * .07)); },
  shot: () => { const t = performance.now(); if (t - lastShot < 70) return; lastShot = t; noise(.06, .035, 3200); },
  boom: () => { noise(.55, .22, 700); tone(90, .4, 'sine', .12, .4); },
  skill: () => tone(260, .28, 'sawtooth', .04, 3.2),
  hurt: () => { const t = performance.now(); if (t - lastHurt < 160) return; lastHurt = t; tone(150, .12, 'sawtooth', .04, .5); },
  win: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .22, 'square', .04, 0, i * .1)); },
  lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, .3, 'triangle', .05, 0, i * .16)); },
  rare: () => { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, .25, 'triangle', .05, 0, i * .08)); },
  alarm: () => { tone(700, .25, 'sawtooth', .04, .7); tone(700, .25, 'sawtooth', .04, .7, .3); },
  tick: () => tone(1200, .02, 'square', .02),
  level: () => { [392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, .2, 'triangle', .05, 0, i * .07)); },
};
function buzz(kind) {
  if (!S || !S.vib) return;
  try {
    const Hp = plugin('Haptics');
    if (Hp) { if (kind === 'ok') Hp.notification({ type: 'SUCCESS' }); else if (kind === 'bad') Hp.notification({ type: 'ERROR' }); else Hp.impact({ style: kind === 'heavy' ? 'HEAVY' : kind === 'medium' ? 'MEDIUM' : 'LIGHT' }); return; }
    if (navigator.vibrate) navigator.vibrate(kind === 'heavy' ? 40 : kind === 'medium' ? 20 : kind === 'ok' ? [20, 40, 20] : kind === 'bad' ? [60, 40, 60] : 8);
  } catch (e) { }
}
