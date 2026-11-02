/* ================= picture quality: glow, color grading, vignette =================
 * One effect chain shared by the village, the battle and the world: the scene is rendered, bright parts
 * (fire, windows, magic, eyes) get a soft glow, then colors are graded and the edges darkened.
 * Phones that cannot keep up switch to the plain renderer by themselves, and Settings has a switch.
 */
const FX = { comp: null, ok: true, slow: 0, frames: 0, acc: 0 };
const FX_FINAL = {
  uniforms: { tDiffuse: { value: null }, vig: { value: .26 }, sat: { value: 1.12 }, con: { value: 1.04 }, tint: { value: null } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: [
    'uniform sampler2D tDiffuse; uniform float vig; uniform float sat; uniform float con; uniform vec3 tint; varying vec2 vUv;',
    'void main() {',
    '  vec4 c = texture2D(tDiffuse, vUv);',
    '  float l = dot(c.rgb, vec3(.299, .587, .114));',
    '  c.rgb = mix(vec3(l), c.rgb, sat);',
    '  c.rgb *= 1.08;',
    '  c.rgb = (c.rgb - .5) * con + .5;',
    '  c.rgb *= tint;',
    '  vec2 d = vUv - .5; c.rgb *= 1.0 - vig * smoothstep(.25, .75, length(d * vec2(1.0, 1.25)));',
    '  gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), 1.0);',
    '}'].join('\n'),
};
function fxWanted() { return FX.ok && S.gfx !== 'low' && !!(THREE.EffectComposer && THREE.UnrealBloomPass); }
function fxInit() {
  if (FX.comp) return true;
  try {
    // the in-between images keep sRGB colors, so dark areas stay dark (8-bit linear washes them out)
    const rt = new THREE.WebGLRenderTarget(256, 256, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, encoding: THREE.sRGBEncoding });
    const r = V3.renderer, comp = new THREE.EffectComposer(r, rt), rp = new THREE.RenderPass(new THREE.Scene(), new THREE.Camera());
    const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), .4, .2, .93);
    FX_FINAL.uniforms.tint.value = new THREE.Vector3(1, 1, 1);
    const fin = new THREE.ShaderPass(FX_FINAL);
    comp.addPass(rp); comp.addPass(bloom); comp.addPass(fin);
    Object.assign(FX, { comp, rp, bloom, fin }); return true;
  } catch (e) { console.warn('effects off', e); FX.ok = false; return false; }
}
/* look of each place: glow strength, saturation, warm/cold tint */
const FX_LOOK = { village: [.42, 1.15, [1.04, 1, .95]], battle: [.4, 1.18, [.98, 1, 1.04]], boss: [.5, 1.2, [1.08, .95, .95]], world: [.35, 1.12, [1.02, 1, .97]] };
function fxRender(scene, cam, w, h, look) {
  const r = V3.renderer;
  if (!fxWanted() || !fxInit()) { r.render(scene, cam); return; }
  const k = w + 'x' + h + '@' + r.getPixelRatio();
  if (FX.size !== k) { FX.size = k; FX.comp.setPixelRatio(Math.min(1.5, r.getPixelRatio())); FX.comp.setSize(w, h); }
  const L = FX_LOOK[look] || FX_LOOK.village; FX.bloom.strength = FX.force !== undefined ? FX.force : L[0]; FX.fin.uniforms.sat.value = L[1]; FX.fin.uniforms.tint.value.set(...L[2]);
  FX.rp.scene = scene; FX.rp.camera = cam;
  const t0 = performance.now(); FX.comp.render(); fxWatch(performance.now() - t0);
}
/* if the effect chain is too slow on this phone, fall back to plain rendering */
function fxWatch(ms) {
  const tn = performance.now();
  if (FX.last) { FX.acc += tn - FX.last; FX.frames++; }
  FX.last = tn;
  if (FX.frames >= 90) { const avg = FX.acc / FX.frames; FX.frames = 0; FX.acc = 0; if (avg > 45 && !FX.checked && !navigator.webdriver) { FX.ok = false; } FX.checked = true; }
}
/* soft rim light so characters stand out from the background */
function fxRim(mat, col) {
  if (mat.userData.rim) return mat; mat.userData.rim = 1; const c = new THREE.Color(col || '#9ab0d8');
  mat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n  totalEmissiveRadiance += vec3(${c.r.toFixed(3)}, ${c.g.toFixed(3)}, ${c.b.toFixed(3)}) * .55 * pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);`); };
  mat.customProgramCacheKey = () => 'rim' + c.getHexString(); mat.needsUpdate = true; return mat;
}
