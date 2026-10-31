// Platform layer: the same code runs as a mobile web app and inside the iOS/Android shells.
// Inside Capacitor we use native plugins (durable storage, haptics, back button, status bar).
const cap = typeof window !== 'undefined' ? window.Capacitor : null;
export const isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
export const platform = isNative ? cap.getPlatform() : 'web';
let plugins = {};
const backHandlers = [];
const pauseHandlers = [];

const lowEndGuess = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3;
export const device = { lowEnd: lowEndGuess, touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0 };

export async function initPlatform() {
  if (isNative) {
    try {
      const core = await import('./vendor/capacitor.js');
      const reg = (n) => core.registerPlugin(n);
      plugins = { App: reg('App'), Haptics: reg('Haptics'), Preferences: reg('Preferences'), StatusBar: reg('StatusBar'), SplashScreen: reg('SplashScreen') };
      plugins.StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      plugins.StatusBar.setStyle({ style: 'DARK' }).catch(() => {});
      plugins.App.addListener('backButton', () => runBack());
      plugins.App.addListener('pause', () => pauseHandlers.forEach((f) => f()));
      plugins.App.addListener('appStateChange', ({ isActive }) => { if (!isActive) pauseHandlers.forEach((f) => f()); });
    } catch (e) { console.warn('Native plugins unavailable', e); }
  } else {
    // Web: turn the hardware/gesture back button into in-game navigation
    history.replaceState({ ashfall: 0 }, '');
    history.pushState({ ashfall: 1 }, '');
    window.addEventListener('popstate', () => { if (runBack() !== 'exit') history.pushState({ ashfall: 1 }, ''); else history.back(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) pauseHandlers.forEach((f) => f()); });
    window.addEventListener('pagehide', () => pauseHandlers.forEach((f) => f()));
  }
  document.documentElement.classList.add(isNative ? 'native' : 'web', 'p-' + platform);
}
export function hideSplash() { plugins.SplashScreen?.hide({ fadeOutDuration: 300 }).catch(() => {}); }

// Back button: handlers return true when they consumed the press
export function onBack(fn) { backHandlers.push(fn); }
let lastBack = 0;
function runBack() {
  for (let i = backHandlers.length - 1; i >= 0; i--) if (backHandlers[i]()) return 'handled';
  if (Date.now() - lastBack < 2000) { if (isNative) plugins.App?.exitApp(); return 'exit'; }
  lastBack = Date.now();
  window.dispatchEvent(new CustomEvent('ashfall-toast', { detail: 'Press back again to exit' }));
  return 'handled';
}
export function onPause(fn) { pauseHandlers.push(fn); }

// Haptics: light taps on buttons, heavier feedback for results
let hapticsOn = true;
export function setHaptics(on) { hapticsOn = on; }
export function haptic(kind = 'light') {
  if (!hapticsOn) return;
  if (plugins.Haptics) {
    if (kind === 'success' || kind === 'error' || kind === 'warning') plugins.Haptics.notification({ type: kind.toUpperCase() }).catch(() => {});
    else plugins.Haptics.impact({ style: kind === 'heavy' ? 'HEAVY' : kind === 'medium' ? 'MEDIUM' : 'LIGHT' }).catch(() => {});
  } else if (navigator.vibrate && device.touch) navigator.vibrate(kind === 'light' ? 8 : kind === 'medium' ? 18 : kind === 'error' ? [30, 40, 30] : 25);
}

// Storage: localStorage for speed + native Preferences for durability (iOS can purge WebView storage)
export const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  async getDurable(key) {
    let v = null;
    if (plugins.Preferences) try { v = (await plugins.Preferences.get({ key })).value; } catch { /* ignore */ }
    return v ?? this.get(key);
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* quota */ }
    plugins.Preferences?.set({ key, value }).catch(() => {});
  },
  remove(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } plugins.Preferences?.remove({ key }).catch(() => {}); },
};

// Render resolution: full (max 2x) on "High", reduced on "Battery saver"
let quality = 'high';
export function setQuality(q) { quality = q; }
export function getQuality() { return quality; }
export function pixelRatio() { const d = window.devicePixelRatio || 1; return quality === 'low' ? Math.min(1.25, d) : Math.min(2, d); }
