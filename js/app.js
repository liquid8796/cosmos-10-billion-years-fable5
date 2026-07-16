/* ============================================================================
   10 BILLION YEARS — stellar journey engine
   v1.0.0
   ----------------------------------------------------------------------------
   One particle system, eight destinies. Scroll drives a timeline t ∈ [0,1];
   particles GPU-morph between per-stage position sets (cloud → collapse →
   galaxy → first light → red giant → last fire → supernova → "you.") while a
   fully procedural WebAudio score evolves underneath. No assets, no build
   step required; Three.js r128 is vendored locally.
   ============================================================================ */
'use strict';

(function () {
  const APP_VERSION = '1.1.0';

  /* ------------------------------------------------------------------ *
   *  0. CONFIG & CAPABILITIES
   * ------------------------------------------------------------------ */
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COARSE  = window.matchMedia('(pointer: coarse)').matches;

  const CONFIG = {
    pages: 10,                       // scroll length in viewport heights
    keys:  [0.000, 0.135, 0.270, 0.415, 0.550, 0.675, 0.790, 0.900],
    years: [0, 4e5, 2e6, 5e7, 9.2e9, 9.99e9, 1e10, 1e10],
    scrollEase: 3.2,                 // higher = snappier catch-up
    boomLocal: 0.55,                 // eased-segment threshold that detonates
    maxDPR: COARSE ? 1.75 : 2,
    fovDeg: 55
  };

  function pickParticleCount () {
    const mem   = navigator.deviceMemory || 8;
    const small = Math.min(window.innerWidth, window.innerHeight) < 720;
    if (small || mem <= 4) return 16000;
    if (mem <= 6)          return 28000;
    return 42000;
  }
  const N = pickParticleCount();

  /* Deterministic RNG so every visitor sees the same universe. */
  function mulberry32 (a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(0xC0FFEE);
  let spare = null;
  function gauss () {                 // Box–Muller with cached spare
    if (spare !== null) { const v = spare; spare = null; return v; }
    let u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    const m = Math.sqrt(-2 * Math.log(u));
    spare = m * Math.sin(2 * Math.PI * v);
    return m * Math.cos(2 * Math.PI * v);
  }

  const clamp  = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp   = (a, b, t) => a + (b - a) * t;
  const smooth = (x) => x * x * (3 - 2 * x);
  const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOutExpo    = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));

  /* Segment 5 (last fire → supernova): tremble slowly, then detonate. */
  function novaEase (x) {
    const T = CONFIG.boomLocal;
    if (x <= T) return (x / T) * 0.10;
    return 0.10 + 0.90 * easeOutExpo((x - T) / (1 - T));
  }

  /* ------------------------------------------------------------------ *
   *  1. STAGE DEFINITIONS — palette, motion character, copy anchor
   * ------------------------------------------------------------------ */
  /* diff: 1 = full differential rotation (inner orbits faster, winds up),
           0 = rigid-body rotation (structure preserved). */
  const STAGES = [
    { name: 'the cloud',    accent: '#7ea0d8', pal: ['#2b4a7a', '#48628f', '#403a66'], size: 1.65, turb: 1.40, swirl: 0.15, diff: 0.70, pulse: [0.00, 0.0],
      tint: 'radial-gradient(120% 90% at 50% 62%, #0a1430 0%, #05070f 55%, #020206 100%)' },
    { name: 'the collapse', accent: '#a98fd8', pal: ['#33507f', '#7a5a9e', '#20335c'], size: 1.50, turb: 1.00, swirl: 0.95, diff: 1.00, pulse: [0.00, 0.0],
      tint: 'radial-gradient(110% 85% at 50% 55%, #120f2e 0%, #060612 55%, #020206 100%)' },
    { name: 'a galaxy',     accent: '#cfd8ff', pal: ['#aac4ff', '#ffe9c4', '#6f86e8'], size: 1.30, turb: 0.35, swirl: 0.10, diff: 0.25, pulse: [0.00, 0.0],
      tint: 'radial-gradient(130% 95% at 50% 48%, #0b1026 0%, #04050e 60%, #020206 100%)' },
    { name: 'first light',  accent: '#ffd98a', pal: ['#fff3d6', '#ffd27a', '#8fd8ff'], size: 1.75, turb: 0.70, swirl: 0.30, diff: 0.80, pulse: [0.02, 0.9],
      tint: 'radial-gradient(105% 80% at 50% 52%, #241a08 0%, #0a0810 55%, #020206 100%)' },
    { name: 'the swelling', accent: '#ff9a62', pal: ['#ff8a4a', '#ff5a36', '#ffcf9e'], size: 1.85, turb: 1.20, swirl: 0.10, diff: 0.50, pulse: [0.05, 0.5],
      tint: 'radial-gradient(115% 88% at 50% 55%, #2a0f06 0%, #0c0509 55%, #020205 100%)' },
    { name: 'the last fire',accent: '#ff7a5c', pal: ['#c24a3a', '#6e3a8a', '#ff9e6a'], size: 1.60, turb: 0.90, swirl: 0.25, diff: 0.80, pulse: [0.10, 3.4],
      tint: 'radial-gradient(110% 85% at 50% 55%, #1d0a12 0%, #090510 55%, #010104 100%)' },
    { name: 'supernova',    accent: '#bff1ff', pal: ['#ffffff', '#9ef2ff', '#ff7ad9'], size: 1.55, turb: 0.40, swirl: 0.03, diff: 0.30, pulse: [0.04, 0.6],
      tint: 'radial-gradient(125% 92% at 50% 50%, #101a2c 0%, #05070f 58%, #010104 100%)' },
    { name: 'you.',         accent: '#ffd9a8', pal: ['#ffe8c8', '#ffc9a3', '#fff6ea'], size: 1.70, turb: 0.35, swirl: 0.05, diff: 0.30, pulse: [0.012, 0.8],
      tint: 'radial-gradient(115% 88% at 50% 56%, #171008 0%, #08060c 55%, #020205 100%)' }
  ];

  const CAMERA_KEYS = [
    [0,  4, 100],   // cloud — adrift
    [0,  2,  60],   // collapse — pulled in
    [0, 55, 150],   // galaxy — pull way back, look down the disk
    [0,  3,  42],   // first light — close to the fire
    [0,  5,  85],   // red giant — step back as it swells
    [0,  2,  60],   // last fire — near the trembling core
    [0,  8, 150],   // supernova — thrown clear
    [0,  0,  95]    // you. — face to face
  ];

  /* ------------------------------------------------------------------ *
   *  2. STAGE GEOMETRY — eight Float32Array(N*3) destinations
   * ------------------------------------------------------------------ */
  function genCloud () {
    const out = new Float32Array(N * 3);
    const C = 26, centers = [];
    for (let k = 0; k < C; k++) {
      centers.push([gauss() * 24, gauss() * 14, gauss() * 24]);
    }
    for (let i = 0; i < N; i++) {
      let x, y, z;
      if (rand() < 0.72) {                       // dense knots
        const c = centers[(rand() * C) | 0];
        const s = 4 + rand() * 9;
        x = c[0] + gauss() * s; y = c[1] + gauss() * s * 0.7; z = c[2] + gauss() * s;
      } else {                                   // wide cold haze
        x = gauss() * 34; y = gauss() * 20; z = gauss() * 34;
      }
      out[i * 3] = x; out[i * 3 + 1] = y * 0.72; out[i * 3 + 2] = z;
    }
    return out;
  }

  function genCollapse () {
    const out = new Float32Array(N * 3);
    const F = 7, fil = [];
    for (let k = 0; k < F; k++) {
      const v = [gauss(), gauss() * 0.45, gauss()];
      const l = Math.hypot(v[0], v[1], v[2]) || 1;
      fil.push([v[0] / l, v[1] / l, v[2] / l]);
    }
    for (let i = 0; i < N; i++) {
      let x, y, z;
      if (rand() < 0.30) {                       // infall filaments
        const d = fil[(rand() * F) | 0];
        const s = Math.pow(rand(), 0.8) * 46;
        const j = 2.2 * (0.3 + s / 46);
        x = d[0] * s + gauss() * j; y = d[1] * s + gauss() * j; z = d[2] * s + gauss() * j;
      } else {                                   // hard central condensation
        const r = 30 * Math.pow(rand(), 2.4);
        const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
        x = r * Math.sin(ph) * Math.cos(th);
        y = r * Math.cos(ph) * 0.8;
        z = r * Math.sin(ph) * Math.sin(th);
      }
      // frozen-in twist: inner material has already begun to spiral
      const rr = Math.hypot(x, z), a = 14 / (3 + rr);
      const ca = Math.cos(a), sa = Math.sin(a);
      out[i * 3] = x * ca - z * sa; out[i * 3 + 1] = y; out[i * 3 + 2] = x * sa + z * ca;
    }
    return out;
  }

  function genGalaxy () {
    const out = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      let x, y, z;
      if (rand() < 0.16) {                       // central bulge
        const r = Math.abs(gauss()) * 7;
        const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
        x = r * Math.sin(ph) * Math.cos(th); y = r * Math.cos(ph) * 0.6; z = r * Math.sin(ph) * Math.sin(th);
      } else {                                   // two logarithmic arms
        const t = Math.pow(rand(), 0.6);
        const r = 6 + t * 74;
        const arm = (rand() < 0.5 ? 0 : Math.PI);
        const spread = 0.19 * (0.4 + t);
        const ang = arm + r * 0.115 + gauss() * spread;
        x = Math.cos(ang) * r; z = Math.sin(ang) * r;
        y = gauss() * (2.8 * Math.max(0.25, 1.1 - t));
      }
      out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
    }
    return out;
  }

  function genFirstLight () {
    const out = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      let x, y, z;
      const u = rand();
      if (u < 0.45) {                            // newborn core
        const r = 5.2 * Math.pow(rand(), 0.45);
        const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
        x = r * Math.sin(ph) * Math.cos(th); y = r * Math.cos(ph); z = r * Math.sin(ph) * Math.sin(th);
      } else if (u < 0.75) {                     // accretion ring
        const a = rand() * Math.PI * 2, r = 15 + gauss() * 1.4;
        x = Math.cos(a) * r; z = Math.sin(a) * r; y = gauss() * 0.9;
      } else {                                   // blown-back natal shell
        const r = 34 + rand() * 40;
        const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
        x = r * Math.sin(ph) * Math.cos(th); y = r * Math.cos(ph) * 0.7; z = r * Math.sin(ph) * Math.sin(th);
      }
      out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
    }
    return out;
  }

  function genGiant () {
    const out = new Float32Array(N * 3);
    const G = 40, cells = [];
    for (let k = 0; k < G; k++) {
      const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
      cells.push([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)]);
    }
    for (let i = 0; i < N; i++) {
      let x, y, z;
      if (rand() < 0.06) {                       // sinking helium core
        const r = 3 * Math.pow(rand(), 0.5);
        const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
        x = r * Math.sin(ph) * Math.cos(th); y = r * Math.cos(ph); z = r * Math.sin(ph) * Math.sin(th);
      } else {                                   // vast convective envelope
        const r = 34 * Math.pow(rand(), 0.18);
        const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
        x = r * Math.sin(ph) * Math.cos(th); y = r * Math.cos(ph); z = r * Math.sin(ph) * Math.sin(th);
        const c = cells[i % G], g = gauss() * 1.6;       // granulation
        x += c[0] * g; y += c[1] * g; z += c[2] * g;
      }
      out[i * 3] = x; out[i * 3 + 1] = y * 0.96; out[i * 3 + 2] = z;
    }
    return out;
  }

  function genDying () {
    const out = new Float32Array(N * 3);
    const shells = [3.5, 7.5, 11.5, 15.5, 19.5];
    const wsum = shells.reduce((a, b) => a + b, 0);
    for (let i = 0; i < N; i++) {
      let x, y, z;
      if (rand() < 0.08) {                       // iron heart
        const r = 2 * Math.pow(rand(), 0.5);
        const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
        x = r * Math.sin(ph) * Math.cos(th); y = r * Math.cos(ph); z = r * Math.sin(ph) * Math.sin(th);
      } else {                                   // onion-shell burning layers
        let pick = rand() * wsum, si = 0;
        while (pick > shells[si]) { pick -= shells[si]; si++; }
        const r = shells[si] + gauss() * 0.7;
        const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
        x = r * Math.sin(ph) * Math.cos(th); y = r * Math.cos(ph) * 0.92; z = r * Math.sin(ph) * Math.sin(th);
      }
      out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
    }
    return out;
  }

  function genSupernova () {
    const out = new Float32Array(N * 3);
    const R = 46, rays = [];
    for (let k = 0; k < R; k++) {
      const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
      rays.push([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)]);
    }
    for (let i = 0; i < N; i++) {
      let x, y, z;
      const u = rand();
      if (u < 0.06) {                            // neutron-star remnant
        const r = 1.1 * Math.pow(rand(), 0.5);
        const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
        x = r * Math.sin(ph) * Math.cos(th); y = r * Math.cos(ph); z = r * Math.sin(ph) * Math.sin(th);
      } else if (u < 0.30) {                     // thin blast shell
        const r = 58 + gauss() * 2.5;
        const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
        x = r * Math.sin(ph) * Math.cos(th); y = r * Math.cos(ph); z = r * Math.sin(ph) * Math.sin(th);
      } else {                                   // ejecta filaments
        const d = rays[(rand() * R) | 0];
        let dx = d[0] + gauss() * 0.22, dy = d[1] + gauss() * 0.22, dz = d[2] + gauss() * 0.22;
        const l = Math.hypot(dx, dy, dz) || 1;
        const r = 24 + Math.pow(rand(), 0.7) * 120;
        x = (dx / l) * r; y = (dy / l) * r; z = (dz / l) * r;
      }
      out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
    }
    return out;
  }

  function genYou () {
    const out = new Float32Array(N * 3);
    const pts = sampleTextPoints('you.');
    const nText = Math.floor(N * 0.75);
    for (let i = 0; i < N; i++) {
      if (i < nText && pts.length > 0) {
        const p = pts[(rand() * pts.length) | 0];
        out[i * 3]     = p[0] + (rand() - 0.5) * 0.7;
        out[i * 3 + 1] = p[1] + (rand() - 0.5) * 0.7;
        out[i * 3 + 2] = (rand() - 0.5) * 3.0;
      } else {                                   // ambient stardust around the word
        const r = 30 + rand() * 45;
        const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
        out[i * 3]     = r * Math.sin(ph) * Math.cos(th);
        out[i * 3 + 1] = r * Math.cos(ph) * 0.6;
        out[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      }
    }
    return out;
  }

  function sampleTextPoints (str) {
    const W = 1024, H = 384;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true });
    const pts = [];
    if (!g) return pts;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'italic 700 240px Georgia, "Times New Roman", serif';
    g.fillText(str, W / 2, H / 2 + 8);
    try {
      const data = g.getImageData(0, 0, W, H).data;
      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          if (data[(y * W + x) * 4 + 3] > 140) {
            pts.push([ (x / W - 0.5) * 82, -(y / H - 0.5) * 30.75 ]);
          }
        }
      }
    } catch (e) { /* canvas read blocked: ambient fallback below still renders */ }
    if (pts.length === 0) {                      // worst-case fallback: a warm heart of dust
      for (let k = 0; k < 4000; k++) pts.push([gauss() * 14, gauss() * 6]);
    }
    return pts;
  }

  const STAGE_POS = [
    genCloud(), genCollapse(), genGalaxy(), genFirstLight(),
    genGiant(), genDying(), genSupernova(), genYou()
  ];

  /* ------------------------------------------------------------------ *
   *  3. THREE.JS SCENE
   * ------------------------------------------------------------------ */
  const canvas = document.getElementById('bg');
  let renderer = null, glOK = true;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { glOK = false; }
  if (!glOK || !renderer) {
    document.documentElement.classList.add('no-webgl');
  }

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CONFIG.fovDeg, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 4, 100);

  let dprLevel = Math.min(CONFIG.maxDPR, window.devicePixelRatio || 1);

  const uniforms = {
    uTime:   { value: 0 },
    uMorph:  { value: 0 },
    uPR:     { value: dprLevel },
    uMouse:  { value: new THREE.Vector3(0, 0, 0) },
    uMouseF: { value: 0 },
    uSizeA:  { value: STAGES[0].size },  uSizeB:  { value: STAGES[1].size },
    uTurbA:  { value: STAGES[0].turb },  uTurbB:  { value: STAGES[1].turb },
    uSwirlA: { value: STAGES[0].swirl }, uSwirlB: { value: STAGES[1].swirl },
    uDiffA:  { value: STAGES[0].diff },  uDiffB:  { value: STAGES[1].diff },
    uPulseA: { value: new THREE.Vector2().fromArray(STAGES[0].pulse) },
    uPulseB: { value: new THREE.Vector2().fromArray(STAGES[1].pulse) },
    uPalA0:  { value: new THREE.Color(STAGES[0].pal[0]) },
    uPalA1:  { value: new THREE.Color(STAGES[0].pal[1]) },
    uPalA2:  { value: new THREE.Color(STAGES[0].pal[2]) },
    uPalB0:  { value: new THREE.Color(STAGES[1].pal[0]) },
    uPalB1:  { value: new THREE.Color(STAGES[1].pal[1]) },
    uPalB2:  { value: new THREE.Color(STAGES[1].pal[2]) },
    uBoost:  { value: 1 }
  };

  const VERT = `
    uniform float uTime;
    uniform float uMorph;
    uniform float uPR;
    uniform vec3  uMouse;
    uniform float uMouseF;
    uniform float uSizeA;  uniform float uSizeB;
    uniform float uTurbA;  uniform float uTurbB;
    uniform float uSwirlA; uniform float uSwirlB;
    uniform float uDiffA;  uniform float uDiffB;
    uniform vec2  uPulseA; uniform vec2  uPulseB;
    uniform vec3  uPalA0;  uniform vec3  uPalA1; uniform vec3 uPalA2;
    uniform vec3  uPalB0;  uniform vec3  uPalB1; uniform vec3 uPalB2;
    uniform float uBoost;

    attribute vec3  aPosB;
    attribute float aSeed;

    varying vec3  vColor;
    varying float vGlow;

    float hash1 (float n) { return fract(sin(n) * 43758.5453123); }

    vec3 breathe (vec3 p, float t, float s) {
      float n1 = sin(p.y * 0.11 + t * 0.50 + s * 6.2831) + sin(p.z * 0.07 + t * 0.30);
      float n2 = sin(p.z * 0.13 + t * 0.40 + s * 12.500) + sin(p.x * 0.09 + t * 0.35);
      float n3 = sin(p.x * 0.12 + t * 0.60 + s * 3.1000) + sin(p.y * 0.08 + t * 0.45);
      return vec3(n1, n2, n3);
    }

    vec3 pal3 (vec3 a, vec3 b, vec3 c, float s) {
      float u = s * 2.0;
      return u < 1.0 ? mix(a, b, u) : mix(b, c, u - 1.0);
    }

    void main () {
      float e = uMorph;
      vec3 p = mix(position, aPosB, e);

      // rotation: blend of rigid body (preserves structure) and
      // differential orbit (inner material faster — winds and churns)
      float sw  = mix(uSwirlA, uSwirlB, e);
      float df  = mix(uDiffA,  uDiffB,  e);
      float r   = length(p.xz) + 0.0001;
      float ang = sw * uTime * mix(1.0, 6.0 / (3.0 + r), df);
      float ca = cos(ang), sa = sin(ang);
      p.xz = mat2(ca, -sa, sa, ca) * p.xz;

      // stage breathing / death rattle
      vec2 pu = mix(uPulseA, uPulseB, e);
      p *= 1.0 + pu.x * sin(uTime * pu.y + aSeed * 6.2831);

      // organic turbulence
      float tb = mix(uTurbA, uTurbB, e);
      p += breathe(p * 0.9, uTime, aSeed) * tb;

      // the visitor's hand: repel + vortex around the pointer
      vec3  dm   = p - uMouse;
      float d2   = dot(dm, dm);
      float fall = exp(-d2 * 0.0045);
      vec3  dir  = dm * inversesqrt(d2 + 0.001);
      vec3  tang = cross(dir, vec3(0.0, 1.0, 0.0));
      p += (dir * uMouseF + tang * uMouseF * 0.6) * fall;

      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;

      float size = mix(uSizeA, uSizeB, e) * (0.7 + 0.8 * hash1(aSeed * 91.7));
      gl_PointSize = clamp(size * uPR * (140.0 / max(1.0, -mv.z)), 0.5, 64.0);

      float pick = fract(aSeed * 7.31);
      vec3 cA = pal3(uPalA0, uPalA1, uPalA2, pick);
      vec3 cB = pal3(uPalB0, uPalB1, uPalB2, pick);
      vColor = mix(cA, cB, e) * uBoost;
      vGlow  = 0.75 + 0.5 * hash1(aSeed * 17.3);
    }
  `;

  const FRAG = `
    precision highp float;
    varying vec3  vColor;
    varying float vGlow;
    void main () {
      vec2  uv = gl_PointCoord - 0.5;
      float d  = length(uv);
      float a  = smoothstep(0.5, 0.02, d);
      a *= a;
      float core = smoothstep(0.16, 0.0, d);
      float alpha = (a * 0.85 + core) * vGlow;
      if (alpha < 0.02) discard;
      gl_FragColor = vec4(vColor * (a * 0.85 + core * 1.4), alpha);
    }
  `;

  let points = null, geometry = null, starfield = null;
  const bufA = new Float32Array(N * 3);
  const bufB = new Float32Array(N * 3);

  if (glOK) {
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(dprLevel);
    renderer.setSize(window.innerWidth, window.innerHeight);

    geometry = new THREE.BufferGeometry();
    bufA.set(STAGE_POS[0]); bufB.set(STAGE_POS[1]);
    const seeds = new Float32Array(N);
    for (let i = 0; i < N; i++) seeds[i] = rand();
    geometry.setAttribute('position', new THREE.BufferAttribute(bufA, 3));
    geometry.setAttribute('aPosB',    new THREE.BufferAttribute(bufB, 3));
    geometry.setAttribute('aSeed',    new THREE.BufferAttribute(seeds, 1));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1000);

    const material = new THREE.ShaderMaterial({
      uniforms, vertexShader: VERT, fragmentShader: FRAG,
      blending: THREE.AdditiveBlending, transparent: true,
      depthWrite: false, depthTest: false
    });

    points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);

    // distant field of fixed stars for parallax depth
    const SF = 1400;
    const sfPos = new Float32Array(SF * 3);
    for (let i = 0; i < SF; i++) {
      const r  = 320 + rand() * 280;
      const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
      sfPos[i * 3]     = r * Math.sin(ph) * Math.cos(th);
      sfPos[i * 3 + 1] = r * Math.cos(ph);
      sfPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const sfGeo = new THREE.BufferGeometry();
    sfGeo.setAttribute('position', new THREE.BufferAttribute(sfPos, 3));
    starfield = new THREE.Points(sfGeo, new THREE.PointsMaterial({
      size: 1.35, sizeAttenuation: true, color: 0x8fa3c8,
      transparent: true, opacity: 0.8, depthWrite: false
    }));
    scene.add(starfield);
  }

  /* Swap morph endpoints only when the timeline crosses a keyframe. */
  let currentSeg = -1;
  function setSegment (i) {
    if (i === currentSeg) return;
    currentSeg = i;
    const A = STAGES[i], B = STAGES[i + 1];
    if (geometry) {
      bufA.set(STAGE_POS[i]);
      bufB.set(STAGE_POS[i + 1]);
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.aPosB.needsUpdate = true;
    }
    uniforms.uSizeA.value  = A.size;  uniforms.uSizeB.value  = B.size;
    uniforms.uTurbA.value  = A.turb * (REDUCED ? 0.4 : 1);
    uniforms.uTurbB.value  = B.turb * (REDUCED ? 0.4 : 1);
    uniforms.uSwirlA.value = A.swirl * (REDUCED ? 0.5 : 1);
    uniforms.uSwirlB.value = B.swirl * (REDUCED ? 0.5 : 1);
    uniforms.uDiffA.value  = A.diff;
    uniforms.uDiffB.value  = B.diff;
    uniforms.uPulseA.value.fromArray(A.pulse);
    uniforms.uPulseB.value.fromArray(B.pulse);
    uniforms.uPalA0.value.set(A.pal[0]); uniforms.uPalA1.value.set(A.pal[1]); uniforms.uPalA2.value.set(A.pal[2]);
    uniforms.uPalB0.value.set(B.pal[0]); uniforms.uPalB1.value.set(B.pal[1]); uniforms.uPalB2.value.set(B.pal[2]);
  }
  setSegment(0);

  /* ------------------------------------------------------------------ *
   *  4. SCROLL TIMELINE
   * ------------------------------------------------------------------ */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  let tTarget = 0, tSmooth = 0;
  function readScroll () {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    tTarget = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
  }
  window.addEventListener('scroll', readScroll, { passive: true });

  function timelineAt (t) {
    const K = CONFIG.keys;
    let i = 0;
    for (let k = K.length - 1; k >= 0; k--) { if (t >= K[k]) { i = k; break; } }
    i = clamp(i, 0, K.length - 2);
    const span  = K[i + 1] - K[i];
    const local = span > 0 ? clamp((t - K[i]) / span, 0, 1) : 1;
    const eased = (i === 5) ? novaEase(local) : easeInOutCubic(local);
    return { seg: i, local, eased };
  }

  /* ------------------------------------------------------------------ *
   *  5. POINTER — mouse, touch, and an idle drift so it never sits still
   * ------------------------------------------------------------------ */
  const mouseNDC   = { x: 0, y: 0 };
  const mouseSm    = { x: 0, y: 0 };
  const mouseWorld = new THREE.Vector3(0, 0, 0);
  let mouseSpeed = 0, lastInput = -10, hasPointer = false;

  function onPointer (cx, cy) {
    const nx = (cx / window.innerWidth) * 2 - 1;
    const ny = -(cy / window.innerHeight) * 2 + 1;
    mouseSpeed = clamp(mouseSpeed + Math.hypot(nx - mouseNDC.x, ny - mouseNDC.y) * 4, 0, 1.6);
    mouseNDC.x = nx; mouseNDC.y = ny;
    lastInput = perf(); hasPointer = true;
  }
  window.addEventListener('mousemove', (e) => onPointer(e.clientX, e.clientY), { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (e.touches.length) onPointer(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  const rayDir = new THREE.Vector3();
  function updateMouseWorld () {
    rayDir.set(mouseSm.x, mouseSm.y, 0.5).unproject(camera).sub(camera.position).normalize();
    const dz = rayDir.z;
    if (Math.abs(dz) > 1e-4) {
      const tt = -camera.position.z / dz;
      if (tt > 0 && tt < 1500) {
        mouseWorld.copy(camera.position).addScaledVector(rayDir, tt);
        return;
      }
    }
    mouseWorld.set(mouseSm.x * 40, mouseSm.y * 24, 0);
  }

  function perf () { return performance.now() / 1000; }

  /* ------------------------------------------------------------------ *
   *  6. AUDIO — an entirely synthesized score
   * ------------------------------------------------------------------ */
  const AUD_STAGE = [
    { cut:  320, pitch: 1.00, shim: 0.015, pad: 0.000, trem: 0.00 }, // cloud
    { cut:  700, pitch: 1.22, shim: 0.050, pad: 0.000, trem: 0.00 }, // collapse
    { cut:  900, pitch: 1.00, shim: 0.030, pad: 0.015, trem: 0.00 }, // galaxy
    { cut: 2400, pitch: 1.50, shim: 0.060, pad: 0.030, trem: 0.00 }, // first light
    { cut: 1200, pitch: 1.34, shim: 0.040, pad: 0.020, trem: 0.06 }, // giant
    { cut:  620, pitch: 1.12, shim: 0.050, pad: 0.000, trem: 0.32 }, // last fire
    { cut:  420, pitch: 0.80, shim: 0.020, pad: 0.010, trem: 0.00 }, // supernova
    { cut:  980, pitch: 1.00, shim: 0.020, pad: 0.070, trem: 0.00 }  // you
  ];

  const audio = {
    ctx: null, enabled: false, muted: false,
    master: null, droneBus: null, droneGain: null, droneFilter: null,
    oscA: null, oscB: null, oscC: null,
    shimmerGain: null, shimmerFilter: null,
    padGain: null, tremGain: null, tremOsc: null,
    fxBus: null, noiseBuffer: null,
    heartbeatTimer: null
  };

  function makeNoiseBuffer (ctx) {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    return buf;
  }

  function initAudio () {
    if (audio.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC();
    audio.ctx = ctx;

    const master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 20; comp.ratio.value = 4;
    comp.attack.value = 0.003; comp.release.value = 0.3;
    master.connect(comp).connect(ctx.destination);
    audio.master = master;

    // — deep space drone
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass'; droneFilter.frequency.value = 320; droneFilter.Q.value = 0.8;
    const droneGain = ctx.createGain(); droneGain.gain.value = 0.75;
    const droneBus  = ctx.createGain(); droneBus.gain.value = 1.0;
    droneFilter.connect(droneGain).connect(droneBus).connect(master);
    audio.droneFilter = droneFilter; audio.droneGain = droneGain; audio.droneBus = droneBus;

    const mkOsc = (type, freq, gain) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
      const g = ctx.createGain(); g.gain.value = gain;
      o.connect(g).connect(droneFilter); o.start();
      return o;
    };
    audio.oscA = mkOsc('sine', 55.00, 0.16);
    audio.oscB = mkOsc('sine', 82.41, 0.07);
    audio.oscC = mkOsc('triangle', 110.0, 0.05);

    // slow breathing on the drone
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.16;
    lfo.connect(lfoGain).connect(droneGain.gain); lfo.start();

    // instability tremolo (the last fire)
    const trem = ctx.createOscillator(); trem.type = 'sine'; trem.frequency.value = 5.5;
    const tremGain = ctx.createGain(); tremGain.gain.value = 0;
    trem.connect(tremGain).connect(droneGain.gain); trem.start();
    audio.tremOsc = trem; audio.tremGain = tremGain;

    // — stellar-wind shimmer
    audio.noiseBuffer = makeNoiseBuffer(ctx);
    const shimmerSrc = ctx.createBufferSource();
    shimmerSrc.buffer = audio.noiseBuffer; shimmerSrc.loop = true;
    const shimmerFilter = ctx.createBiquadFilter();
    shimmerFilter.type = 'bandpass'; shimmerFilter.frequency.value = 900; shimmerFilter.Q.value = 1.1;
    const shimmerGain = ctx.createGain(); shimmerGain.gain.value = 0;
    shimmerSrc.connect(shimmerFilter).connect(shimmerGain).connect(master);
    shimmerSrc.start();
    audio.shimmerFilter = shimmerFilter; audio.shimmerGain = shimmerGain;

    // — warm pad (rises for "you.")
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass'; padFilter.frequency.value = 700;
    const padGain = ctx.createGain(); padGain.gain.value = 0;
    padFilter.connect(padGain).connect(master);
    [['triangle', 220.0, 0.05], ['triangle', 221.1, 0.05], ['sine', 330.0, 0.03]].forEach(([ty, f, g]) => {
      const o = ctx.createOscillator(); o.type = ty; o.frequency.value = f;
      const og = ctx.createGain(); og.gain.value = g;
      o.connect(og).connect(padFilter); o.start();
    });
    audio.padGain = padGain;

    // — one-shot bus with a soft cosmic echo
    const fxBus = ctx.createGain(); fxBus.gain.value = 1;
    fxBus.connect(master);
    const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.34;
    const fb = ctx.createGain(); fb.gain.value = 0.42;
    const wet = ctx.createGain(); wet.gain.value = 0.30;
    fxBus.connect(delay); delay.connect(fb).connect(delay); delay.connect(wet).connect(master);
    audio.fxBus = fxBus;

    audio.enabled = true;
    return true;
  }

  function setMuted (m) {
    audio.muted = m;
    document.getElementById('mute').setAttribute('aria-pressed', String(!m));
    document.getElementById('mute').classList.toggle('is-muted', m);
    if (!audio.ctx) return;
    const now = audio.ctx.currentTime;
    audio.master.gain.cancelScheduledValues(now);
    audio.master.gain.setTargetAtTime(m ? 0 : 0.85, now, 0.15);
  }

  function playChime () {
    if (!audio.enabled || audio.muted) return;
    const ctx = audio.ctx, now = ctx.currentTime;
    [[880, 0.10], [1320, 0.05]].forEach(([f, g]) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, now);
      og.gain.exponentialRampToValueAtTime(g, now + 0.03);
      og.gain.exponentialRampToValueAtTime(0.0001, now + 4.0);
      o.connect(og).connect(audio.fxBus);
      o.start(now); o.stop(now + 4.2);
    });
  }

  function playBoom () {
    if (!audio.enabled || audio.muted) return;
    const ctx = audio.ctx, now = ctx.currentTime;

    // shockwave: filtered noise burst
    const src = ctx.createBufferSource(); src.buffer = audio.noiseBuffer;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(5500, now);
    lp.frequency.exponentialRampToValueAtTime(140, now + 2.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.9, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 3.6);
    src.connect(lp).connect(g).connect(audio.fxBus);
    src.start(now); src.stop(now + 3.8);

    // core collapse: sub drop
    const sub = ctx.createOscillator(); sub.type = 'sine';
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(26, now + 1.6);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, now);
    sg.gain.exponentialRampToValueAtTime(0.8, now + 0.02);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);
    sub.connect(sg).connect(audio.fxBus);
    sub.start(now); sub.stop(now + 3.2);

    // the crack of first light escaping
    const crk = ctx.createBufferSource(); crk.buffer = audio.noiseBuffer;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.30, now);
    cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    crk.connect(hp).connect(cg).connect(audio.fxBus);
    crk.start(now); crk.stop(now + 0.1);

    // sidechain: everything else ducks in awe
    audio.droneBus.gain.cancelScheduledValues(now);
    audio.droneBus.gain.setTargetAtTime(0.10, now, 0.05);
    audio.droneBus.gain.setTargetAtTime(1.00, now + 0.6, 2.5);
  }

  function heartbeatThump (strong) {
    if (!audio.enabled || audio.muted) return;
    const ctx = audio.ctx, now = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 52;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 120;
    const g = ctx.createGain();
    const peak = strong ? 0.5 : 0.28;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    o.connect(lp).connect(g).connect(audio.master);
    o.start(now); o.stop(now + 0.3);
  }

  function setHeartbeat (on) {
    if (on && !audio.heartbeatTimer && audio.enabled) {
      const beat = () => {
        heartbeatThump(true);
        setTimeout(() => heartbeatThump(false), 180);
      };
      beat();
      audio.heartbeatTimer = setInterval(beat, 1050);
    } else if (!on && audio.heartbeatTimer) {
      clearInterval(audio.heartbeatTimer);
      audio.heartbeatTimer = null;
    }
  }

  let lastAudioTick = 0;
  function audioTick (tl, nowS) {
    if (!audio.enabled || !audio.ctx) return;
    if (nowS - lastAudioTick < 0.08) return;
    lastAudioTick = nowS;
    const A = AUD_STAGE[tl.seg], B = AUD_STAGE[tl.seg + 1];
    const e = tl.eased, now = audio.ctx.currentTime;
    const cut   = lerp(A.cut,   B.cut,   e) + mouseSpeed * 500;
    const pitch = lerp(A.pitch, B.pitch, e);
    const shim  = lerp(A.shim,  B.shim,  e) + Math.min(0.05, mouseSpeed * 0.35);
    const pad   = lerp(A.pad,   B.pad,   e);
    const trem  = lerp(A.trem,  B.trem,  e);
    audio.droneFilter.frequency.setTargetAtTime(cut, now, 0.2);
    audio.oscA.frequency.setTargetAtTime(55.00 * pitch, now, 0.25);
    audio.oscB.frequency.setTargetAtTime(82.41 * pitch, now, 0.25);
    audio.oscC.frequency.setTargetAtTime(110.3 * pitch, now, 0.25);
    audio.shimmerGain.gain.setTargetAtTime(shim, now, 0.3);
    audio.shimmerFilter.frequency.setTargetAtTime(600 + cut * 0.9, now, 0.4);
    audio.padGain.gain.setTargetAtTime(pad, now, 0.6);
    audio.tremGain.gain.setTargetAtTime(trem * 0.4, now, 0.25);
    setHeartbeat(tSmooth > 0.93 && !audio.muted);
  }

  /* ------------------------------------------------------------------ *
   *  7. HUD — chapters, year counter, rail, cursor, flash
   * ------------------------------------------------------------------ */
  const el = {
    tint:    document.getElementById('tint'),
    flash:   document.getElementById('flash'),
    counter: document.getElementById('counter'),
    counterVal: document.getElementById('counter-value'),
    counterLbl: document.getElementById('counter-label'),
    rail:    document.getElementById('rail'),
    cue:     document.getElementById('cue'),
    cursorDot:  document.getElementById('cursor-dot'),
    cursorRing: document.getElementById('cursor-ring'),
    chapters: Array.from(document.querySelectorAll('[data-range]'))
  };

  el.chapters.forEach((node) => {
    const [a, b] = node.dataset.range.split(',').map(Number);
    node._a = a; node._b = b;
  });

  // progress rail
  const railDots = [];
  STAGES.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'rail-dot';
    b.type = 'button';
    b.setAttribute('aria-label', 'Travel to: ' + s.name);
    b.innerHTML = '<span class="rail-label">' + s.name + '</span><span class="rail-pip" aria-hidden="true"></span>';
    b.addEventListener('click', () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: (CONFIG.keys[i] + 0.004) * max, behavior: REDUCED ? 'auto' : 'smooth' });
    });
    el.rail.appendChild(b);
    railDots.push(b);
  });

  let tintStage = -1;
  function setTintStage (i) {
    if (i === tintStage) return;
    tintStage = i;
    el.tint.style.background = STAGES[i].tint;
    document.documentElement.style.setProperty('--accent', STAGES[i].accent);
    railDots.forEach((d, k) => d.classList.toggle('is-active', k === i));
  }
  setTintStage(0);

  function fmtYears (y) {
    return Math.round(y).toLocaleString('en-US');
  }
  let lastCounterText = '';
  function updateCounter (tl, t) {
    let text, label = 'years elapsed';
    if (t > 0.905) { text = 'now'; label = 'and today —'; }
    else {
      const y = lerp(CONFIG.years[tl.seg], CONFIG.years[tl.seg + 1], tl.eased);
      text = fmtYears(y);
    }
    if (text !== lastCounterText) {
      lastCounterText = text;
      el.counterVal.textContent = text;
      el.counterLbl.textContent = label;
    }
    el.counter.style.opacity = t < 0.015 ? '0' : '1';
  }

  function updateChapters (t) {
    const f = 0.025;
    for (const node of el.chapters) {
      const a = node._a, b = node._b;
      let o = 0;
      if (t > a - f && t < b + f) {
        o = smooth(clamp((t - a) / f + 1, 0, 1)) * smooth(clamp((b - t) / f + 1, 0, 1));
      }
      if (o <= 0.001) {
        if (node.style.opacity !== '0') { node.style.opacity = '0'; node.style.visibility = 'hidden'; }
        continue;
      }
      node.style.visibility = 'visible';
      node.style.opacity = o.toFixed(3);
      const drift = lerp(26, -26, clamp((t - a) / (b - a), 0, 1));
      node.style.transform = 'translateY(' + drift.toFixed(1) + 'px)';
    }
    el.cue.style.opacity = t < 0.012 ? '1' : '0';
  }

  /* ------------------------------------------------------------------ *
   *  8. BOOM ORCHESTRATION
   * ------------------------------------------------------------------ */
  let boomArmed = true, boomEnv = 0, chimeArmed = true;

  function checkOneShots (tl, t) {
    // supernova
    if (tl.seg === 5 && tl.local >= CONFIG.boomLocal && boomArmed) {
      boomArmed = false;
      boomEnv = 1;
      playBoom();
    }
    if (t < CONFIG.keys[5] + 0.01) boomArmed = true;
    // ignition chime
    if (tl.seg === 2 && tl.eased > 0.7 && chimeArmed) { chimeArmed = false; playChime(); }
    if (t < CONFIG.keys[2] + 0.01) chimeArmed = true;
  }

  /* ------------------------------------------------------------------ *
   *  9. MAIN LOOP
   * ------------------------------------------------------------------ */
  const camPos = new THREE.Vector3().fromArray(CAMERA_KEYS[0]);
  let prevTime = perf(), timeAcc = 0;
  let fpsEMA = 60, lowSince = null, perfStrikes = 0;

  function frame () {
    requestAnimationFrame(frame);
    const now = perf();
    let dt = now - prevTime;
    prevTime = now;
    dt = clamp(dt, 0.0001, 0.05);

    // fps guard: degrade gracefully instead of stuttering
    fpsEMA = lerp(fpsEMA, 1 / dt, 0.05);
    if (glOK) {
      if (fpsEMA < 26) {
        if (lowSince === null) lowSince = now;
        if (now - lowSince > 2.5) {
          lowSince = null;
          perfStrikes++;
          if (perfStrikes === 1 && dprLevel > 1) {
            dprLevel = Math.max(1, dprLevel - 0.5);
            renderer.setPixelRatio(dprLevel);
            uniforms.uPR.value = dprLevel;
          } else if (perfStrikes === 2 && geometry) {
            geometry.setDrawRange(0, Math.floor(N * 0.65));
          }
        }
      } else lowSince = null;
    }

    // timeline
    const k = 1 - Math.exp(-CONFIG.scrollEase * dt);
    tSmooth += (tTarget - tSmooth) * k;
    const tl = timelineAt(tSmooth);
    setSegment(tl.seg);
    uniforms.uMorph.value = tl.eased;

    // clock
    timeAcc += dt * (REDUCED ? 0.5 : 1);
    uniforms.uTime.value = timeAcc;

    // pointer smoothing (+ idle autopilot so the field never dies)
    const idle = now - lastInput > 3 || !hasPointer;
    const targetX = idle ? Math.sin(now * 0.23) * 0.55 : mouseNDC.x;
    const targetY = idle ? Math.cos(now * 0.17) * 0.35 : mouseNDC.y;
    const mk = 1 - Math.exp(-6 * dt);
    mouseSm.x += (targetX - mouseSm.x) * mk;
    mouseSm.y += (targetY - mouseSm.y) * mk;
    mouseSpeed *= Math.exp(-3.2 * dt);
    updateMouseWorld();
    uniforms.uMouse.value.copy(mouseWorld);
    const baseForce = idle ? 1.1 : 2.2;
    const force = clamp(baseForce + mouseSpeed * 8, 0, 7);
    uniforms.uMouseF.value = REDUCED ? force * 0.35 : force;

    // camera: keyframe path + parallax + post-boom shake
    const A = CAMERA_KEYS[tl.seg], B = CAMERA_KEYS[tl.seg + 1];
    camPos.set(
      lerp(A[0], B[0], tl.eased),
      lerp(A[1], B[1], tl.eased),
      lerp(A[2], B[2], tl.eased)
    );
    boomEnv *= Math.exp(-1.8 * dt);
    const shake = REDUCED ? 0 : boomEnv;
    const bob = REDUCED ? 0.3 : 1;
    camera.position.set(
      camPos.x + mouseSm.x * 6 + Math.sin(now * 0.3) * 0.8 * bob + (rand() - 0.5) * shake * 5,
      camPos.y + mouseSm.y * 3 + Math.cos(now * 0.26) * 0.5 * bob + (rand() - 0.5) * shake * 5,
      camPos.z + (rand() - 0.5) * shake * 3
    );
    camera.lookAt(0, 0, 0);

    // brightness bloom around the detonation
    uniforms.uBoost.value = 1 + boomEnv * 2.4;
    el.flash.style.opacity = (boomEnv * boomEnv * 0.95).toFixed(3);

    if (starfield) starfield.rotation.y += dt * 0.004;

    // HUD + tint (nearest formed stage)
    setTintStage(tl.eased < 0.5 ? tl.seg : tl.seg + 1);
    updateChapters(tSmooth);
    updateCounter(tl, tSmooth);
    checkOneShots(tl, tSmooth);
    audioTick(tl, now);

    // cursor follower
    if (!COARSE) {
      const px = (mouseNDC.x * 0.5 + 0.5) * window.innerWidth;
      const py = (-mouseNDC.y * 0.5 + 0.5) * window.innerHeight;
      el.cursorDot.style.transform  = 'translate(' + px + 'px,' + py + 'px)';
      const sx = (mouseSm.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-mouseSm.y * 0.5 + 0.5) * window.innerHeight;
      el.cursorRing.style.transform = 'translate(' + sx + 'px,' + sy + 'px)';
    }

    if (glOK) renderer.render(scene, camera);
  }

  /* ------------------------------------------------------------------ *
   * 10. WIRING — intro, mute, resize, visibility, restart
   * ------------------------------------------------------------------ */
  const intro = document.getElementById('intro');
  function begin (withSound) {
    if (withSound) {
      if (initAudio()) {
        audio.ctx.resume();
        setMuted(false);
      }
    } else {
      document.getElementById('mute').classList.add('is-muted');
      document.getElementById('mute').setAttribute('aria-pressed', 'false');
    }
    document.body.classList.remove('locked');
    intro.classList.add('is-gone');
    setTimeout(() => intro.remove(), 1000);
  }
  document.getElementById('begin-sound').addEventListener('click', () => begin(true));
  document.getElementById('begin-silent').addEventListener('click', () => begin(false));

  document.getElementById('mute').addEventListener('click', () => {
    if (!audio.ctx) {
      if (initAudio()) { audio.ctx.resume(); setMuted(false); }
      return;
    }
    setMuted(!audio.muted);
    if (!audio.muted) audio.ctx.resume();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') document.getElementById('mute').click();
  });

  document.getElementById('restart').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    if (glOK) renderer.setSize(window.innerWidth, window.innerHeight);
    readScroll();
  });

  document.addEventListener('visibilitychange', () => {
    if (!audio.ctx) return;
    if (document.hidden) { audio.ctx.suspend(); setHeartbeat(false); }
    else if (!audio.muted) audio.ctx.resume();
  });

  if (glOK) {
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      document.documentElement.classList.add('no-webgl');
      glOK = false;
    });
  }

  // debug/test hook: jump the timeline directly (used by the visual test rig)
  window.__ten = {
    version: APP_VERSION,
    jump (t) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, clamp(t, 0, 1) * max);
    },
    settle () { tSmooth = tTarget; },
    state () { return { t: tSmooth, seg: currentSeg, gl: glOK, n: N, fps: Math.round(fpsEMA) }; }
  };

  readScroll();
  frame();
  console.log('%c10 BILLION YEARS %cv' + APP_VERSION + ' — ' + N.toLocaleString() + ' particles of you',
    'color:#ffd98a;font-weight:bold', 'color:#8fa3c8');
})();
