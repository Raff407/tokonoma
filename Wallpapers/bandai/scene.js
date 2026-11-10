/*
 * 磐梯 Bandai — a lake in autumn colour under a rounded volcano.
 *
 * Sky, mountain, shore and the shrine gate are baked once. The lake is that world
 * flipped and laid back in thin rows that slide sideways with a slow swell. Mist is
 * one tiling strip drawn at two heights; a few cloud streaks drift across the sky.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.6;
  const SKY = ['#8e9bb0', '#a9b0b8', '#c8c3b4', '#e0cfa8', '#ecd8ae'];
  const FAR = '#8d98a8';
  const MID = '#6f7d80';
  const SLOPE = ['#3f5238', '#586b3c', '#8e5a30', '#b34a2c', '#d08a3a', '#c8a448'];
  const ROCK = ['#6c6a6c', '#857f7b', '#9d948a', '#b3a998'];
  const POND = '#53707a';
  const VEIL = 0.36;
  const STREAKS = 80;
  const GLINTS = 14;
  const CLOUDS = 5;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, TAU);
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const u = U * Math.min(1, W / (U * 135));
    const wy = Math.round(H * WATER);
    const cx = W * 0.5;
    return { W, H, U, u, wy, cx, hw: Math.min(W * 0.46, u * 70), peak: H * 0.44 };
  }

  // ---- sky -----------------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.wy);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.wy; y++) {
      const f = Math.min(1, y / (g.wy * 0.85)) * (inks.length - 1);
      const k = Math.min(inks.length - 2, Math.floor(f));
      for (let x = 0; x < g.W; x++) {
        const ink = inks[k + (rand() < f - k ? 1 : 0)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function ridge(ctx, g, ink, base, amp, scale, seed) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(0, g.wy);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, base + (fbm(x / (g.U * scale), 2.3, 4, seed) - 0.5) * amp);
    ctx.lineTo(g.W, g.wy);
    ctx.fill();
  }

  // ---- the mountain --------------------------------------------------------

  // Height of the rounded cone above the shore at column x; the right flank is torn open.
  function height(g, x) {
    const d = (x - g.cx) / g.hw;
    const ad = Math.abs(d);
    if (ad >= 1) return 0;
    let h = g.peak * Math.pow(1 - Math.pow(ad, 1.5), 1.25);
    const scar = Math.exp(-(((d - 0.28) / 0.17) ** 2));
    h -= g.peak * 0.26 * scar;
    h += (fbm(x / (g.U * 9), 5.1, 3, 31) - 0.5) * g.U * 2.2;
    return Math.max(0, h);
  }

  function slopeInk(g, x, y, f, shade) {
    const gully = fbm(x / (g.U * 3.5), y / (g.U * 14), 3, 57);
    const patch = fbm(x / (g.U * 9), y / (g.U * 6), 4, 73);
    const cut = 0.5 + (gully - 0.5) * 0.25 + (patch - 0.5) * 0.12;
    let ink;
    if (f > cut) {
      const r = Math.min(3, Math.max(0, Math.floor((gully * 2.4 + (1 - shade) * -1.4 + 1.2) * 1.3)));
      ink = K.parseColor(ROCK[r]);
    } else {
      const n = patch * 1.25 + (1 - f) * 0.15 - 0.12;
      const k = Math.min(SLOPE.length - 1, Math.max(0, Math.floor(n * SLOPE.length)));
      ink = K.parseColor(SLOPE[k]);
    }
    const dark = K.parseColor('#2c3438');
    return K.mixColor(ink, dark, (1 - shade) * 0.55);
  }

  function paintMountain(ctx, g) {
    const x0 = Math.max(0, Math.floor(g.cx - g.hw));
    const x1 = Math.min(g.W, Math.ceil(g.cx + g.hw));
    const img = ctx.getImageData(0, 0, g.W, g.wy);
    const d = img.data;
    for (let x = x0; x < x1; x++) {
      const h = height(g, x);
      if (h < 1) continue;
      const top = g.wy - h;
      const slope = (height(g, x + 2) - height(g, x - 2)) / 4;
      for (let y = Math.max(0, Math.floor(top)); y < g.wy; y++) {
        const f = (g.wy - y) / g.peak;
        const side = (x - g.cx) / g.hw;
        const shade = Math.min(1, Math.max(0.15, 0.62 - side * 0.5 + slope * 0.9 + (fbm(x / (g.U * 5), y / (g.U * 5), 2, 9) - 0.5) * 0.3));
        const c = slopeInk(g, x, y, f, shade);
        const i = (y * g.W + x) * 4;
        d[i] = c[0];
        d[i + 1] = c[1];
        d[i + 2] = c[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // ---- shore ---------------------------------------------------------------

  function crown(ctx, x, y, r, a, b, c) {
    ctx.fillStyle = a;
    blob(ctx, x, y, r, r * 0.85);
    ctx.fillStyle = b;
    blob(ctx, x - r * 0.2, y - r * 0.2, r * 0.7, r * 0.6);
    ctx.fillStyle = c;
    blob(ctx, x - r * 0.35, y - r * 0.35, r * 0.32, r * 0.28);
  }

  function pine(ctx, x, y, h, ink) {
    ctx.strokeStyle = '#3a2c22';
    ctx.lineWidth = Math.max(1, h * 0.06);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - h * 0.12, y - h * 0.5, x + h * 0.06, y - h * 0.9);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const f = 0.5 + i * 0.2;
      const side = i % 2 ? 1 : -1;
      const w = h * (0.3 - f * 0.12);
      ctx.fillStyle = ink[0];
      blob(ctx, x + side * h * 0.1, y - h * f, w, w * 0.4);
      ctx.fillStyle = ink[1];
      blob(ctx, x + side * h * 0.08 - w * 0.1, y - h * f - w * 0.12, w * 0.7, w * 0.26);
    }
  }

  function torii(ctx, x, y, s) {
    const red = '#b8412a';
    const dark = '#2c2420';
    const lit = '#d2603a';
    ctx.fillStyle = red;
    ctx.fillRect(x - s * 0.62, y - s * 1.45, s * 0.2, s * 1.45);
    ctx.fillRect(x + s * 0.42, y - s * 1.45, s * 0.2, s * 1.45);
    ctx.fillStyle = lit;
    ctx.fillRect(x - s * 0.62, y - s * 1.45, s * 0.07, s * 1.45);
    ctx.fillRect(x + s * 0.42, y - s * 1.45, s * 0.07, s * 1.45);
    ctx.fillStyle = red;
    ctx.fillRect(x - s * 0.5, y - s * 1.12, s * 1.0, s * 0.14);
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.95, y - s * 1.58);
    ctx.lineTo(x + s * 0.95, y - s * 1.58);
    ctx.lineTo(x + s * 0.75, y - s * 1.46);
    ctx.lineTo(x - s * 0.75, y - s * 1.46);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = red;
    ctx.fillRect(x - s * 0.8, y - s * 1.7, s * 1.6, s * 0.14);
    ctx.fillStyle = dark;
    ctx.fillRect(x - s * 0.85, y - s * 1.74, s * 1.7, s * 0.06);
    ctx.fillStyle = '#4a3a2c';
    ctx.fillRect(x - s * 0.7, y - s * 0.1, s * 0.4, s * 0.1);
    ctx.fillRect(x + s * 0.3, y - s * 0.1, s * 0.4, s * 0.1);
  }

  function paintShore(ctx, g, rand) {
    const u = g.U;
    ctx.fillStyle = '#3a4234';
    ctx.fillRect(0, g.wy - u * 1.6, g.W, u * 1.6 + 1);
    const tori = g.W * 0.86;
    for (let x = -u; x < g.W + u; x += u * (1.4 + rand() * 1.6)) {
      if (Math.abs(x - tori) < u * 7) continue;
      const r = u * (1.1 + rand() * 1.2);
      const t = rand();
      const y = g.wy - u * (1.2 + rand() * 0.8);
      if (t < 0.4) crown(ctx, x, y, r, '#7a2c1e', '#9c3e26', '#bd642f');
      else if (t < 0.65) crown(ctx, x, y, r, '#7a5a28', '#a07832', '#c4a048');
      else if (t < 0.85) crown(ctx, x, y, r, '#34452f', '#4c6238', '#6a804a');
      else pine(ctx, x, g.wy - u * 0.9, u * (7 + rand() * 4), ['#2c3f2c', '#46603a']);
    }
    torii(ctx, tori, g.wy - u * 0.2, u * 5.5);
    for (let x = 0; x < g.W; x += u * (1.5 + rand() * 3)) {
      ctx.fillStyle = rand() < 0.5 ? '#6b665a' : '#8a8472';
      blob(ctx, x, g.wy - u * 0.25, u * (0.6 + rand() * 0.9), u * 0.4);
    }
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.wy + 1);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    ctx.fillStyle = '#e8d8b4';
    for (let i = 0; i < 4; i++) {
      const x = g.W * (0.05 + rand() * 0.9);
      const y = g.H * (0.04 + rand() * 0.1);
      blob(ctx, x, y, g.U * (8 + rand() * 12), g.U * (0.5 + rand() * 0.5));
    }
    ridge(ctx, g, FAR, g.wy - g.H * 0.2, g.H * 0.1, 40, 11);
    ridge(ctx, g, MID, g.wy - g.H * 0.1, g.H * 0.07, 24, 19);
    paintMountain(ctx, g);
    paintShore(ctx, g, rand);
    return c;
  }

  // ---- water ---------------------------------------------------------------

  function paintReflection(g) {
    const h = g.H - g.wy;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, -1, 0, g.wy);
    ctx.drawImage(state.back, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = POND;
    ctx.globalAlpha = VEIL;
    ctx.fillRect(0, 0, g.W, h);
    ctx.globalAlpha = 1;
    return c;
  }

  function waveAt(g, y, t, ripple) {
    const d = (y - g.wy) / (g.H - g.wy);
    const p = ((t * 0.05) % 1.4) - 0.2;
    const swell = 0.55 + 1.1 * Math.exp(-((d - p) * (d - p)) / 0.012);
    const amp = g.U * (0.1 + 1.8 * d) * ripple * swell;
    const k = y / g.U;
    return amp * (Math.sin(k * 0.7 + t * 0.8) + 0.5 * Math.sin(k * 1.9 - t * 1.3));
  }

  function drawWater(ctx, g, t, ripple) {
    const src = state.reflection;
    const water = g.H - g.wy;
    ctx.drawImage(src, 0, g.wy);
    let y = 0;
    while (y < water) {
      const h = Math.max(1, Math.round(g.U * lerp(0.5, 2, y / water)));
      const dx = Math.round(waveAt(g, g.wy + y, t, ripple));
      ctx.drawImage(src, 0, y, g.W, h, dx, g.wy + y, g.W, h);
      y += h;
    }
  }

  function makeStreaks(g, rand) {
    const s = { x: new Float32Array(STREAKS), y: new Float32Array(STREAKS), l: new Float32Array(STREAKS), p: new Float32Array(STREAKS) };
    for (let i = 0; i < STREAKS; i++) {
      const d = 0.01 + 0.99 * Math.pow(rand(), 1.5);
      s.x[i] = rand() * g.W;
      s.y[i] = g.wy + d * (g.H - g.wy);
      s.l[i] = g.U * (2 + d * 9) * (0.6 + rand() * 0.8);
      s.p[i] = rand() * TAU;
    }
    const gl = { x: new Float32Array(GLINTS), y: new Float32Array(GLINTS), l: new Float32Array(GLINTS), p: new Float32Array(GLINTS) };
    for (let i = 0; i < GLINTS; i++) {
      gl.x[i] = g.cx + (rand() - 0.5) * g.u * 40;
      gl.y[i] = g.wy + g.u * (3 + rand() * 24);
      gl.l[i] = g.U * (1.2 + rand() * 2.4);
      gl.p[i] = rand() * TAU;
    }
    return { s, gl };
  }

  function drawStreaks(ctx, g, t, ripple) {
    const { s, gl } = state.streaks;
    const thick = Math.max(1, g.U * 0.4);
    const slide = t * g.U * (0.3 + ripple * 0.5);
    const amount = Math.min(1, ripple + 0.2);
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? '#1c2c34' : '#d6cdb6';
      for (let i = pass; i < STREAKS; i += 2) {
        const a = Math.sin(t * 0.5 + s.p[i]);
        if (a <= 0) continue;
        ctx.globalAlpha = a * amount * (pass ? 0.4 : 0.42);
        const x = ((s.x[i] + slide) % (g.W + s.l[i] * 2)) - s.l[i];
        ctx.fillRect(x, s.y[i], s.l[i], thick);
      }
    }
    ctx.fillStyle = '#e8c878';
    for (let i = 0; i < GLINTS; i++) {
      const a = Math.sin(t * 0.7 + gl.p[i]);
      if (a <= 0) continue;
      ctx.globalAlpha = a * amount * 0.6;
      ctx.fillRect(gl.x[i] + Math.sin(t * 0.4 + gl.p[i]) * g.U * 1.5, gl.y[i], gl.l[i], thick);
    }
    ctx.globalAlpha = 1;
  }

  // ---- foreground reeds ----------------------------------------------------

  function paintReeds(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    ctx.lineCap = 'round';
    const clump = (x0, n, tall) => {
      for (let i = 0; i < n; i++) {
        const x = x0 + (rand() - 0.5) * u * 9;
        const h = u * tall * (0.6 + rand() * 0.6);
        const lean = (rand() - 0.5) * u * 4;
        ctx.strokeStyle = rand() < 0.5 ? '#2b2a1e' : '#4a4128';
        ctx.lineWidth = Math.max(1, u * 0.4);
        ctx.beginPath();
        ctx.moveTo(x, g.H + u);
        ctx.quadraticCurveTo(x + lean * 0.3, g.H - h * 0.6, x + lean, g.H - h);
        ctx.stroke();
        ctx.fillStyle = '#b79a5c';
        blob(ctx, x + lean, g.H - h - u * 0.6, u * 0.4, u * 1.4);
      }
    };
    clump(g.W * 0.06, 14, 16);
    clump(g.W * 0.94, 12, 13);
    clump(g.W * 0.84, 5, 8);
    return c;
  }

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.14);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 16), y / (g.U * 4), 4, 77);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.38, 0.62, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 232;
        img.data[i + 1] = 226;
        img.data[i + 2] = 212;
        img.data[i + 3] = a * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMist(ctx, g, t, mist) {
    if (mist <= 0) return;
    const m = state.mist;
    const w = m.width;
    const a = (t * g.U * 0.9) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.85);
    ctx.drawImage(m, -a, g.wy - m.height * 0.8);
    ctx.drawImage(m, w - a, g.wy - m.height * 0.8);
    const b = (t * g.U * 0.5 + w * 0.4) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.4);
    ctx.drawImage(m, b - w, g.wy - g.H * 0.28);
    ctx.drawImage(m, b, g.wy - g.H * 0.28);
    ctx.globalAlpha = 1;
  }

  function makeClouds(g, rand) {
    const c = { x: new Float32Array(CLOUDS), y: new Float32Array(CLOUDS), w: new Float32Array(CLOUDS), v: new Float32Array(CLOUDS) };
    for (let i = 0; i < CLOUDS; i++) {
      c.x[i] = rand() * g.W;
      c.y[i] = g.H * (0.05 + rand() * 0.16);
      c.w[i] = g.U * (10 + rand() * 14);
      c.v[i] = g.U * (0.25 + rand() * 0.35);
    }
    return c;
  }

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    ctx.fillStyle = '#efe2c2';
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < CLOUDS; i++) {
      const x = ((c.x[i] + t * c.v[i]) % (g.W + c.w[i] * 2)) - c.w[i];
      ctx.fillRect(x - c.w[i] * 0.5, c.y[i], c.w[i], g.U * 0.7);
      ctx.fillRect(x - c.w[i] * 0.25, c.y[i] - g.U * 0.7, c.w[i] * 0.5, g.U * 0.7);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.reflection = paintReflection(g);
    state.reeds = paintReeds(g, rand);
    state.mist = paintMist(g);
    state.streaks = makeStreaks(g, rand);
    state.clouds = makeClouds(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { ripple, mist } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawClouds(ctx, g, t);
    drawMist(ctx, g, t, mist);
    drawWater(ctx, g, t, ripple);
    drawStreaks(ctx, g, t, ripple);
    ctx.drawImage(state.reeds, 0, 0);
  }

  Kasuri.run({
    defaults: { ripple: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
