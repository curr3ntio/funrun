'use strict';

/* =========================================================================
 *  CONFIG — every timing and tunable lives here.
 * ========================================================================= */
const CONFIG = {
  blackStart:   0.0,   // s — black pour begins
  whiteStart:   8.0,   // s — white pour begins over the black
  dripTime:     3.0,   // s — roughly how long the front takes to reach the bottom
  fadeStart:   23.0,   // s — overlay starts fading out (only when loop is false)
  fadeDuration: 1.0,   // s — fade length; canvas is removed when it ends (only when loop is false)
  loop: true,          // true: black and white keep pouring over each other forever (background mode)
  loopPeriod: null,    // s — length of one black+white cycle; null = 2 * whiteStart
  black: [0.020, 0.020, 0.022],
  white: [0.965, 0.960, 0.945],
  seedBlack: 1.0,      // different seeds => different rivulet shapes
  seedWhite: 7.0,
  maxDpr: 2,
  // centred logo: the black image shows where the paint (or page) under it is light,
  // the white image where it is dark — decided per pixel, so the drip edge masks it
  logo: {
    black: 'funrun-text-black.png',
    white: 'funrun-text-white.png',
    width: 0.4,          // fraction of the viewport width (panel: "logo size")
    maxWidth: null,      // optional px cap, null = none
    pageIsDark: false,   // what the page under the overlay looks like before the first pour covers it
  },
  showPanel: true,     // control panel visible on load (toggle with "d")
  // live-tunable (debug panel)
  speed: 0.13,         // playback speed of the whole timeline (0.01 = almost frozen, 5 = fast)
  speedVar: 4.0,       // 0 = every run falls at the same speed, 1 = normal spread, up to 4 = wild
  sizeVar: 0.63,       // 0 = every run the same width, 1 = normal spread, up to 4 = max spread
  noise: 0.95,         // noise / rivulet frequency multiplier
  dripSize: 0.12,      // overall size of the runs (0.1 = hairlines, 6 = huge slabs)
  runLength: 2.97,     // how far the runs race ahead of the paint block (0 = none, 8 = extreme)
  thick: 0.66,         // paint viscosity: 0 = thin and runny, 1 = normal, 4 = very thick and slow
  gloss: 0.0,          // 3D shading strength (0 = flat colour, 1 = full glossy Blinn-Phong)
};

/* =========================================================================
 *  VERTEX SHADER — one full-screen triangle, no buffers needed.
 * ========================================================================= */
const VERT = `#version 300 es
void main() {
  // gl_VertexID 0,1,2 -> (-1,-1) (3,-1) (-1,3): one triangle covering the clip space.
  vec2 v = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(v * 2.0 - 1.0, 0.0, 1.0);
}`;

/* =========================================================================
 *  FRAGMENT SHADER — all paint behaviour.
 *
 *  Coordinates: p is in CSS pixels, y grows DOWNWARD from the top edge.
 *  A pour is a signed distance field d (negative = inside paint) built from:
 *    1. a "sheet": the bulk of the paint, whose front is a noisy line that
 *       accelerates downward (gravity + viscosity easing),
 *    2. "fingers": one per column cell, each a capsule trail ending in a
 *       bulbous bead. Cells have random width, speed, lag and catch-up
 *       (the 7 nearest cells are evaluated per pixel),
 *    3. a few "drops" that detach from slow fingers and fall on their own.
 *  Everything is unioned with smooth-min so runs merge with menisci.
 *  From d we derive a thickness field, a screen-space normal (dFdx/dFdy)
 *  and shade it with Blinn-Phong.
 * ========================================================================= */
const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2  uResolution;   // CSS px
uniform float uDpr;
uniform float uTime;         // s
uniform float uDrip;         // s, CONFIG.dripTime
uniform float uNoise, uGloss, uFade, uSpeedVar, uSizeVar, uDripSize, uRunLength, uThick;
uniform vec3  uColorA, uColorB;
uniform float uStartA, uStartB, uSeedA, uSeedB;
uniform float uLoop, uPeriod;   // loop mode: time wraps every uPeriod, seeds change per cycle
uniform sampler2D uLogoBlack, uLogoWhite;   // premultiplied RGBA
uniform vec4  uLogoRect;        // x, y, w, h in CSS px (top-left origin)
uniform float uLogoOn, uPageLum;

// ---------- hashing & noise (no textures) ----------
float hash1(float n) { n = fract(n * 0.1031); n *= n + 33.33; n *= n + n; return fract(n); }
float hash21(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vnoise1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(hash1(i), hash1(i + 1.0), f); }
float vnoise2(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}
float fbm1(float x) { return (vnoise1(x) * 0.55 + vnoise1(x * 2.13 + 7.7) * 0.3 + vnoise1(x * 4.7 + 19.1) * 0.15); }
float fbm2(vec2 p) { return (vnoise2(p) * 0.55 + vnoise2(p * 2.07 + 3.3) * 0.3 + vnoise2(p * 4.3 + 9.9) * 0.15); }
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }

// ---------- motion ----------
// Starts at rest, accelerates, then tends to a constant (terminal) speed.
float easeFall(float u) { return 1.3 * u * u / (u + 0.3); }
// Position of the sheet front at column x for a given base progress.
float sheetY(float x, float base, float seed) {
  float regional = fbm1(x * 0.0022 * uNoise + seed * 7.3);       // some regions run ahead
  float fine     = fbm1(x * 0.025 * uNoise + seed * 3.1);         // lumps and scallops
  return base * (0.78 + 0.44 * regional) + 14.0 * (fine - 0.5);
}
// How far ahead of the sheet a finger runs (normalised). Thin runs lag, then sprint.
float fingerLead(float u, float spd, float catchUp) { return spd * easeFall(u) + catchUp * smoothstep(0.35, 1.2, u); }

// ---------- one pour: returns signed distance d and fake height hgt ----------
void pour(vec2 p, float t, float seed, out float d, out float hgt) {
  float H = uResolution.y;
  float thick = clamp(uThick * 0.5, 0.0, 2.0);           // 0 = thin paint, 1 = thick, 2 = very thick (mixes extrapolate)
  float T = uDrip * mix(0.8, 1.3, thick);                 // thick paint is slower
  float u = max(t, 0.0) / T;
  float leadK = H * 0.22 * uRunLength * max(mix(1.5, 0.7, thick), 0.15);   // how far runs get ahead of the sheet
  float base = -90.0 + H * 1.3 * easeFall(u / 1.35);   // starts above the screen edge
  float settle = smoothstep(0.0, 0.3, u);
  float wob = 2.5 * (vnoise1(p.x * 0.012 * uNoise + t * 0.8 + seed * 5.0) - 0.5) * settle;
  float yS = sheetY(p.x, base, seed) + wob;
  d = p.y - yS;

  float dome = 0.0, ridge = 0.0;
  float W = max(26.0 * uDripSize / uNoise, 3.0);      // cell pitch; rivulet widths ~10..40 px at dripSize 1
  float i = floor(p.x / W);
  for (int k = -3; k <= 3; k++) {
    float j = i + float(k);
    float key = j + seed * 131.7;
    vec4 h = vec4(hash1(key), hash1(key + 17.1), hash1(key + 43.7), hash1(key + 91.3));
    // half width: geometric spread around the base size so proportions stay sane at any variation
    float ratio = mix(5.0, 19.0, h.y * h.y) / 11.0;
    float hw = min(11.0 * uDripSize * clamp(pow(ratio, uSizeVar), 0.4, 2.0), W * 0.75); // capped so a run never outgrows the evaluated neighbourhood
    float thin = 1.0 - h.y;
    float spd  = mix(0.3, 1.3, h.z * h.z) - 0.3 * thin;    // thin ones lag...
    spd = max(mix(0.8, spd, uSpeedVar), 0.1);              // uSpeedVar spreads the speeds
    float catchUp = 0.7 * thin * h.w * uSpeedVar;          // ...and catch up late
    float cx = (j + 0.5 + 0.7 * (h.x - 0.5)) * W;
    float meander = 2.0 * sin(p.y * 0.011 + j * 2.1 + t * 0.35);
    float tipY = sheetY(cx, base, seed) + leadK * fingerLead(u, spd, catchUp)
               + 2.0 * sin(t * 2.3 + j * 1.7) * settle;
    vec2  q = vec2(p.x - cx - meander, p.y);
    float rBead  = hw * mix(1.15, 1.45, h.w) * mix(0.85, 1.4, thick);   // meniscus: thick paint = fatter beads
    float rTrail = hw * (0.8 + 0.2 * vnoise1(p.y * 0.02 + j * 3.3)) * mix(0.65, 1.0, thick); // thin paint = thinner trails
    float dT = length(vec2(q.x, max(q.y - tipY, 0.0))) - rTrail;   // trail capsule
    vec2  qb = vec2(q.x, (q.y - tipY) / 1.35);                       // elongated (teardrop) bead
    float dB = length(qb) - rBead;
    float dF = smin(dT, dB, rBead);
    d = smin(d, dF, 8.0 * mix(0.6, 1.3, thick));
    float rr = length(qb) / (rBead * 1.1);
    dome  = max(dome, sqrt(max(0.0, 1.0 - rr * rr)));
    ridge = max(ridge, exp(-q.x * q.x / (rTrail * rTrail) * 1.6) * smoothstep(tipY + rBead * 0.3, tipY - rBead * 1.5, q.y));

    // occasional drop breaking off a slow run
    if (h.w > 0.8 && spd < 0.7 && catchUp < 0.25) {
      float u0 = 0.5 + 0.35 * h.x;
      float du = u - u0;
      if (du > 0.0) {
        float y0 = sheetY(cx, -90.0 + H * 1.3 * easeFall(u0 / 1.35), seed)
                 + leadK * fingerLead(u0, spd, catchUp) + rBead * 0.6;
        float yD = y0 + H * (0.4 * du + 2.2 * du * du);
        float rD = hw * 0.55 * mix(0.8, 1.3, thick) + 1.0;
        vec2  qd = vec2(q.x, p.y - yD);
        float dD = length(vec2(qd.x, qd.y / 1.2)) - rD;
        float dTail = length(vec2(qd.x, qd.y - clamp(qd.y, -3.0 * rD, 0.0))) - rD * 0.35;
        dD = smin(dD, dTail, rD * 0.6);
        d = smin(d, dD, 6.0);
        float rd = length(qd) / (rD * 1.1);
        dome = max(dome, sqrt(max(0.0, 1.0 - rd * rd)) * smoothstep(0.0, rD, dF)); // only once clear of the run
      }
    }
  }
  d += 1.5 * uDripSize * (vnoise2(p * 0.07 * uNoise / uDripSize + seed) - 0.5);    // break up perfect circles
  if (t < 0.0) d = 1e5;

  // thickness: rounded (quarter-circle) profile at the edge, flat film inside,
  // raised domes on beads, faint ridges along runs that relax further behind the front.
  float R = 8.0 * uDripSize * mix(0.6, 1.4, thick);
  float s = clamp(-d / R, 0.0, 1.0);
  float hEdge = sqrt(1.0 - (1.0 - s) * (1.0 - s));
  float behind = clamp((yS - p.y) / (H * 0.3), 0.0, 1.0);
  float ridgeAmp = mix(0.25, 0.02, behind);
  float film = fbm2(vec2(p.x * 0.006, p.y * 0.004 - t * 0.05) * uNoise + seed);
  hgt = hEdge * (1.0 + 0.6 * dome) + ridgeAmp * ridge * hEdge + 0.12 * (film - 0.5);
}

// ---------- shading ----------
vec3 shade(float hgt, float R, vec3 base, float amb, float dif, float specStr, float shin, float rimStr) {
  // screen-space normal from the height gradient (y flipped: p.y grows downward)
  float gx = dFdx(hgt) * uDpr, gy = -dFdy(hgt) * uDpr;
  vec3 n = normalize(mix(vec3(0.0, 0.0, 1.0), normalize(vec3(-gx * R, -gy * R, 1.0)), uGloss)); // uGloss 0 => flat
  vec3 L = normalize(vec3(-0.4, -0.6, 0.7));      // upper-left light
  vec3 Hv = normalize(L + vec3(0.0, 0.0, 1.0));
  float ndl  = max(dot(n, L), 0.0);
  float spec = pow(max(dot(n, Hv), 0.0), shin);
  float rim  = pow(1.0 - max(n.z, 0.0), 2.0);
  return base * (amb + dif * ndl) + vec3((specStr * spec + rimStr * rim) * min(uGloss, 1.0));
}
float coverage(float d) { float aa = max(fwidth(d) * 0.8, 1e-4); return smoothstep(aa, -aa, d); }

void main() {
  vec2 p = vec2(gl_FragCoord.x, uResolution.y * uDpr - gl_FragCoord.y) / uDpr;
  float tt = uTime, cyc = 0.0;
  if (uLoop > 0.5) { cyc = floor(uTime / uPeriod); tt = uTime - cyc * uPeriod; }
  float tA = tt - uStartA, tB = tt - uStartB;
  float dA, hA, dB, hB;
  pour(p, tA, uSeedA + cyc * 17.3, dA, hA);
  pour(p, tB, uSeedB + cyc * 17.3, dB, hB);
  // derivatives must stay in uniform control flow, so both pours are always evaluated
  float RA = 8.0 * uDripSize, RB = 8.0 * uDripSize;
  vec3 cA = shade(hA, RA, uColorA, 0.60, 0.50, 0.30, 48.0, 0.10);
  vec3 cB = shade(hB, RB, uColorB, 0.74, 0.28, 0.35, 40.0, 0.04);
  // with flat shading (uGloss = 0) the normal is (0,0,1), so ndl is constant; keep colours as the configured values
  if (uGloss <= 0.0) { cA = uColorA; cB = uColorB; }
  float aA = coverage(dA), aB = coverage(dB);
  // in loop mode, after the first cycle the previous white pour has fully covered: use it as an opaque base
  float aBase = (uLoop > 0.5 && cyc > 0.5) ? 1.0 : 0.0;
  // premultiplied "B over A over base"
  vec3  rgb = ((uColorB * aBase) * (1.0 - aA) + cA * aA) * (1.0 - aB) + cB * aB;
  float a   = (aBase * (1.0 - aA) + aA) * (1.0 - aB) + aB;

  // ---- logo: pick the black or white image per pixel from what is underneath ----
  if (uLogoOn > 0.5) {
    vec2 uv = (p - uLogoRect.xy) / uLogoRect.zw;
    if (all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)))) {
      // luminance of paint + (uncovered) page under this pixel
      float lum = dot(rgb, vec3(0.299, 0.587, 0.114)) + (1.0 - a) * uPageLum;
      float light = smoothstep(0.42, 0.58, lum);          // 1 = light underneath -> black logo
      vec4 lb = texture(uLogoBlack, uv), lw = texture(uLogoWhite, uv);
      vec4 logo = mix(lw, lb, light);                      // premultiplied
      rgb = rgb * (1.0 - logo.a) + logo.rgb;
      a   = a   * (1.0 - logo.a) + logo.a;
    }
  }
  outColor = vec4(rgb, a) * uFade;
}`;

/* =========================================================================
 *  Tiny WebGL2 helper
 * ========================================================================= */
function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error('[paint] shader error:\n' + gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}
function createProgram(gl, vsSrc, fsSrc) {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('[paint] link error:\n' + gl.getProgramInfoLog(prog));
    return null;
  }
  const uniforms = {};
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(prog, i);
    uniforms[info.name] = gl.getUniformLocation(prog, info.name);
  }
  return { prog, uniforms };
}

/* =========================================================================
 *  Runtime: canvas, timeline, render loop, debug panel
 * ========================================================================= */
(function main() {
  const canvas = document.getElementById('paint');
  const gl = canvas && canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) { console.warn('[paint] WebGL2 unavailable — overlay disabled'); if (canvas) canvas.remove(); return; }
  const built = createProgram(gl, VERT, FRAG);
  if (!built) { canvas.remove(); return; }
  const { prog, uniforms: U } = built;
  gl.useProgram(prog);
  gl.disable(gl.BLEND);            // we output premultiplied alpha; the browser composites
  gl.disable(gl.DEPTH_TEST);

  // --- logo textures (optional; the overlay works without them) ---
  let logoOn = false, logoAspect = 1;
  function loadTexture(url, unit, onload) {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    const img = new Image();
    img.onload = () => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      onload(img);
    };
    img.onerror = () => console.warn('[paint] logo image not found: ' + url);
    img.src = url;
  }
  if (CONFIG.logo && CONFIG.logo.black && CONFIG.logo.white) {
    let loaded = 0;
    const done = img => { logoAspect = img.naturalWidth / img.naturalHeight; if (++loaded === 2) logoOn = true; };
    loadTexture(CONFIG.logo.black, 0, done);
    loadTexture(CONFIG.logo.white, 1, done);
    gl.uniform1i(U.uLogoBlack, 0);
    gl.uniform1i(U.uLogoWhite, 1);
  }

  let dpr = 1, width = 0, height = 0;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
    width = window.innerWidth; height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  // --- timeline state ---
  let clock = 0;            // s, the automatic timeline
  let manualTime = null;    // s, when set (scrubber / __setTime) it overrides the clock
  let paused = false;
  let last = null;
  let running = true;
  const endTime = () => CONFIG.fadeStart + CONFIG.fadeDuration;
  const period = () => CONFIG.loopPeriod || CONFIG.whiteStart * 2;

  function draw(t) {
    const fade = CONFIG.loop ? 1 : 1 - Math.min(Math.max((t - CONFIG.fadeStart) / CONFIG.fadeDuration, 0), 1);
    gl.uniform2f(U.uResolution, width, height);
    gl.uniform1f(U.uDpr, dpr);
    gl.uniform1f(U.uTime, t);
    gl.uniform1f(U.uDrip, CONFIG.dripTime);
    gl.uniform1f(U.uSpeedVar, CONFIG.speedVar);
    gl.uniform1f(U.uSizeVar, CONFIG.sizeVar);
    gl.uniform1f(U.uNoise, CONFIG.noise);
    gl.uniform1f(U.uDripSize, CONFIG.dripSize);
    gl.uniform1f(U.uRunLength, CONFIG.runLength);
    gl.uniform1f(U.uThick, CONFIG.thick);
    gl.uniform1f(U.uGloss, CONFIG.gloss);
    gl.uniform1f(U.uFade, fade);
    gl.uniform3fv(U.uColorA, CONFIG.black);
    gl.uniform3fv(U.uColorB, CONFIG.white);
    gl.uniform1f(U.uStartA, CONFIG.blackStart);
    gl.uniform1f(U.uStartB, CONFIG.whiteStart);
    gl.uniform1f(U.uSeedA, CONFIG.seedBlack);
    gl.uniform1f(U.uSeedB, CONFIG.seedWhite);
    gl.uniform1f(U.uLoop, CONFIG.loop ? 1 : 0);
    gl.uniform1f(U.uPeriod, period());
    const lw = Math.min(width * CONFIG.logo.width, CONFIG.logo.maxWidth || Infinity), lh = lw / logoAspect;
    gl.uniform4f(U.uLogoRect, (width - lw) / 2, (height - lh) / 2, lw, lh);
    gl.uniform1f(U.uLogoOn, logoOn ? 1 : 0);
    gl.uniform1f(U.uPageLum, CONFIG.logo.pageIsDark ? 0 : 1);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function finish() {
    running = false;
    canvas.remove();          // restart / scrubbing re-adds it via revive()
  }

  function frame(now) {
    if (!running) return;
    if (document.hidden) { last = null; return; }     // resumed by visibilitychange
    if (last !== null && manualTime === null && !paused) clock += (now - last) / 1000 * CONFIG.speed;
    last = now;
    const t = manualTime !== null ? manualTime : clock;
    draw(t);
    syncDebug(t);
    if (!CONFIG.loop && manualTime === null && t >= endTime()) { finish(); return; }
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && running) requestAnimationFrame(frame); });
  requestAnimationFrame(frame);

  // --- debug panel (toggle with "d") ---
  const panel = document.getElementById('debug');
  let debugOpen = CONFIG.showPanel;
  panel.hidden = !debugOpen;
  const sliders = {
    time:  document.getElementById('dbg-time'),
    speed: document.getElementById('dbg-speed'),
    speedVar: document.getElementById('dbg-speedvar'),
    sizeVar: document.getElementById('dbg-sizevar'),
    noise: document.getElementById('dbg-noise'),
    dripSize: document.getElementById('dbg-size'),
    runLength: document.getElementById('dbg-runlen'),
    thick: document.getElementById('dbg-thick'),
    gloss: document.getElementById('dbg-gloss'),
    logoSize: document.getElementById('dbg-logo'),
  };
  const pauseBox = document.getElementById('dbg-pause');
  if (sliders.time) sliders.time.max = String(CONFIG.loop ? period() * 2 : endTime());
  for (const key of ['speed', 'speedVar', 'sizeVar', 'dripSize', 'runLength', 'thick', 'noise', 'gloss']) {
    if (!sliders[key]) continue;
    sliders[key].value = String(CONFIG[key]);   // panel always starts at the CONFIG defaults
    sliders[key].addEventListener('input', e => { CONFIG[key] = parseFloat(e.target.value); });
  }
  if (sliders.logoSize) {
    sliders.logoSize.value = String(CONFIG.logo.width);
    sliders.logoSize.addEventListener('input', e => { CONFIG.logo.width = parseFloat(e.target.value); });
  }
  sliders.time && sliders.time.addEventListener('input', e => { window.__setTime(parseFloat(e.target.value)); });
  pauseBox && pauseBox.addEventListener('change', e => { paused = e.target.checked; if (!paused) manualTime = null; });
  function revive() { if (!running) { document.body.appendChild(canvas); running = true; last = null; resize(); requestAnimationFrame(frame); } }
  function restart() {
    manualTime = null; clock = 0; last = null; paused = false;
    if (pauseBox) pauseBox.checked = false;
    revive();
  }
  const restartBtn = document.getElementById('dbg-restart');
  restartBtn && restartBtn.addEventListener('click', () => { restart(); restartBtn.blur(); });
  function syncDebug(t) {
    if (!debugOpen) return;
    for (const key in sliders) {
      const el = sliders[key]; if (!el) continue;
      if (key === 'time' && manualTime === null) el.value = String(t);
      el.nextElementSibling.textContent = parseFloat(el.value).toFixed(2);
    }
  }
  window.addEventListener('keydown', e => {
    if (e.key !== 'd' || e.metaKey || e.ctrlKey || e.altKey) return;
    debugOpen = !debugOpen;
    panel.hidden = !debugOpen;
  });

  // --- test hook: window.__setTime(t) freezes the timeline at t (seconds) ---
  window.__setTime = t => { manualTime = t; clock = t; if (sliders.time) sliders.time.value = String(t); revive(); };
  window.__pixel = (x, y) => { draw(manualTime !== null ? manualTime : clock); const b = new Uint8Array(4); gl.readPixels(Math.round(x * dpr), Math.round((height - y) * dpr), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b); return Array.from(b); };
  window.__paint = { config: CONFIG, resume: () => { manualTime = null; }, restart };
  window.__paintReady = true;
})();
