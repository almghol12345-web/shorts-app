// Synthesized sound effects and a low ambient drone (WebAudio, no audio files needed).
let ac = null, master = null, musicGain = null, musicOn = false, sfxOn = true, started = false;
function ctx() {
  if (!ac) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ac = new A(); master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination); }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(freq, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0) {
  const c = ctx(); if (!c || !sfxOn) return;
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + delay;
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol = 0.2, freq = 1200, delay = 0) {
  const c = ctx(); if (!c || !sfxOn) return;
  const b = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = b; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start(c.currentTime + delay);
}
export const sfx = (name) => {
  switch (name) {
    case 'click': tone(660, 0.06, 'square', 0.05); break;
    case 'open': tone(420, 0.08, 'triangle', 0.08, 200); break;
    case 'close': tone(520, 0.08, 'triangle', 0.06, -200); break;
    case 'collect': tone(880, 0.08, 'sine', 0.12); tone(1320, 0.12, 'sine', 0.1, 0, 0.06); break;
    case 'build': noise(0.15, 0.2, 600); tone(180, 0.15, 'square', 0.06, -60, 0.05); break;
    case 'success': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.1, 0, i * 0.08)); break;
    case 'fail': tone(300, 0.3, 'sawtooth', 0.08, -150); break;
    case 'hit': noise(0.07, 0.15, 1800); break;
    case 'boom': noise(0.35, 0.35, 400); tone(90, 0.3, 'sine', 0.2, -50); break;
    case 'skill': tone(300, 0.25, 'sawtooth', 0.06, 600); noise(0.2, 0.1, 3000, 0.05); break;
    case 'die': tone(200, 0.3, 'triangle', 0.1, -150); break;
    case 'recruit': [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.25, 'triangle', 0.09, 0, i * 0.07)); break;
    case 'alarm': tone(880, 0.2, 'square', 0.06); tone(660, 0.2, 'square', 0.06, 0, 0.22); break;
    default: break;
  }
};
export function setSfx(on) { sfxOn = on; }
export function setMusic(on) {
  musicOn = on; const c = ctx(); if (!c) return;
  if (!musicGain) {
    musicGain = c.createGain(); musicGain.gain.value = 0; musicGain.connect(master);
    // Ambient: detuned low drones + slow filtered noise wind
    [55, 82.4, 110.3].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.type = i === 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f; o.detune.value = i * 7; const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 300; g.gain.value = 0.05; o.connect(fl); fl.connect(g); g.connect(musicGain); o.start();
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.05 + i * 0.03; lg.gain.value = 120; lfo.connect(lg); lg.connect(fl.frequency); lfo.start(); });
    const b = c.createBuffer(1, c.sampleRate * 4, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = b; s.loop = true; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.8; const g = c.createGain(); g.gain.value = 0.03; s.connect(f); f.connect(g); g.connect(musicGain); s.start();
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.08; lg.gain.value = 300; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
  }
  musicGain.gain.setTargetAtTime(on ? 0.7 : 0, c.currentTime, 0.8);
}
export function unlockAudio(settings) {
  if (started) return; started = true; ctx(); setSfx(settings.sound); if (settings.music) setMusic(true);
}
export function musicEnabled() { return musicOn; }
