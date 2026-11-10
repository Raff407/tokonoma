/*
 * 黄山 Huangshan — twisted pines on granite peaks above a sea of cloud.
 *
 * Sky, three ranks of peaks and the pines are baked into layers and repainted
 * once a minute from the clock. Between repaints only the cloud sea and the
 * drifting mist slide sideways.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep, clamp } = K;

  const RETINT_SECONDS = 60;
  const state = {};

  // Peak lists: centre x, top y (fractions of the screen), half width, steepness.
  const FAR = [
    { c: 0.08, t: 0.5, w: 0.12 }, { c: 0.3, t: 0.4, w: 0.07 }, { c: 0.46, t: 0.46, w: 0.1 },
    { c: 0.66, t: 0.36, w: 0.06 }, { c: 0.84, t: 0.45, w: 0.11 }, { c: 0.98, t: 0.4, w: 0.07 },
  ];
  const MID = [
    { c: 0.43, t: 0.3, w: 0.055 }, { c: 0.51, t: 0.4, w: 0.07 }, { c: 0.58, t: 0.26, w: 0.05 },
    { c: 0.66, t: 0.45, w: 0.08 }, { c: 0.36, t: 0.46, w: 0.07 },
  ];
  const NEAR = [
    { c: 0.15, t: 0.26, w: 0.17 }, { c: 0.34, t: 0.5, w: 0.09 },
    { c: 0.8, t: 0.34, w: 0.18 }, { c: 0.97, t: 0.5, w: 0.08 },
  ];
  // Pines on the near peaks: x fraction, size in screen units.
  const PINES = [
    { x: 0.13, s: 2.2, dir: 1 }, { x: 0.205, s: 1.5, dir: -1 }, { x: 0.09, s: 1.1, dir: 1 },
    { x: 0.76, s: 2.4, dir: -1 }, { x: 0.855, s: 1.4, dir: 1 }, { x: 0.34, s: 1.2, dir: 1 },
  ];

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  // ---- ridges ------------------------------------------------------------

  // Column heights for a row of granite towers: blunt tops, near vertical flanks, ledges.
  function makeRidge(g, peaks, seed, jag) {
    const tops = new Float32Array(g.W);
    const base = g.H * 1.02;
    for (let x = 0; x < g.W; x++) {
      let best = base;
      for (const p of peaks) {
        const d = Math.abs(x / g.W - p.c) / p.w;
        if (d >= 1) continue;
        const prof = 1 - Math.pow(d, 3.2);
        const top = g.H * p.t;
        best = Math.min(best, lerp(base, top, prof));
      }
      const n = (fbm(x * 0.09, 3, 3, seed) - 0.5) * g.U * jag;
      let y = best + n * (best < base - 1 ? 1 : 0);
      if (best < base - 1) y = Math.round(y / (g.U * 1.2)) * g.U * 1.2 + n * 0.3;
      tops[x] = y;
    }
    return tops;
  }

  function paintRock(ctx, g, sky, tops, o) {
    const img = ctx.getImageData(0, 0, g.W, g.H);
    const rock = mixColor(mixColor(rgb(o.rock), sky.amb, 0.18), rgb('#1c2036'), sky.night * 0.7);
    const haze = mixColor(sky.haze, sky.low, 0.3);
    for (let x = 0; x < g.W; x++) {
      const top = Math.max(0, Math.floor(tops[x]));
      const slope = tops[Math.min(g.W - 1, x + 2)] - tops[Math.max(0, x - 2)];
      const lit = clamp(1 + slope * 0.05 * -1 + 0.1, 0.7, 1.2);
      for (let y = top; y < g.H; y++) {
        const crack = fbm(x * 0.7, y * 0.045, 2, o.seed);
        const strat = fbm(x * 0.03, y * 0.35, 2, o.seed + 4);
        const depth = (y - tops[x]) / (g.H * 0.35);
        let k = (0.78 + crack * 0.4 - strat * 0.12) * lit;
        const c = mixColor(rock, haze, o.fade + smoothstep(0, 1.2, depth) * o.fog);
        const i = (y * g.W + x) * 4;
        img.data[i] = c[0] * k;
        img.data[i + 1] = c[1] * k;
        img.data[i + 2] = c[2] * k;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // ---- pines -------------------------------------------------------------

  function paintPine(ctx, x, y, s, dir, leaf, bark) {
    ctx.strokeStyle = bark;
    ctx.lineWidth = Math.max(1, s * 0.5);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - dir * s * 1.2, y - s * 3, x + dir * s * 0.8, y - s * 5.5);
    ctx.stroke();
    ctx.fillStyle = leaf;
    const tiers = [[0.9, 3.2, -1], [2.1, 4, 1], [3.5, 3.6, -1], [5.4, 3.2, 1]];
    for (const [h, w, side] of tiers) {
      const bx = x + dir * s * (side * 0.8 * 0 + (h > 4 ? 0.8 : 0));
      const ex = bx + side * dir * s * w;
      ctx.beginPath();
      ctx.ellipse((bx + ex) / 2, y - s * h, Math.abs(ex - bx) / 2 + s * 0.3, s * 0.55, 0, 0, 6.3);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(ex, y - s * h - s * 0.2, s * 1.1, s * 0.5, 0, 0, 6.3);
      ctx.fill();
    }
  }

  // ---- clouds ------------------------------------------------------------

  // A sea of cloud that tiles sideways: solid below a billowy upper edge.
  function paintSea(w, h, sky, seed, bright, spread) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const lit = mixColor(rgb('#f3f1e8'), sky.amb, 0.45);
    const shade = mixColor(sky.haze, lit, 0.35);
    const dark = mixColor(rgb('#1e2238'), lit, 0.18);
    const hi = mixColor(lit, dark, sky.night * 0.78);
    const lo = mixColor(shade, dark, sky.night * 0.7);
    const dens = (x, y) => fbm(x * 0.03, y * 0.2, 4, seed);
    for (let y = 0; y < h; y++) {
      const f = y / h;
      for (let x = 0; x < w; x++) {
        const v = lerp(dens(x, y), dens(x - w, y), x / w);
        const a = smoothstep(0.56, 0.66, v + f * spread * 1.4);
        const k = clamp(1 - f * 0.9 + (v - 0.5) * 0.5, 0, 1);
        const col = mixColor(lo, hi, k * bright);
        const i = (y * w + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Thin ribbons of mist, faint and wide.
  function paintMist(w, h, sky, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const col = mixColor(mixColor(rgb('#eceae0'), sky.haze, 0.4), rgb('#2a2e4a'), sky.night * 0.6);
    const dens = (x, y) => fbm(x * 0.012, y * 0.09, 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(dens(x, y), dens(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = smoothstep(0.45, 0.72, v) * band * 170;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- sky and bake ------------------------------------------------------

  function paintSky(g, sky, hourNow, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.8);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    const day = 1 - sky.night;
    const arc = day > 0.3 ? S.sunT(hourNow) : S.moonT(hourNow);
    const cx = g.W * lerp(0.12, 0.9, arc);
    const cy = g.H * (0.34 - Math.sin(arc * Math.PI) * 0.2);
    const r = g.U * 5;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 4);
    const tone = day > 0.3 ? '255,226,170' : '226,230,240';
    glow.addColorStop(0, `rgba(${tone},0.5)`);
    glow.addColorStop(1, `rgba(${tone},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r * 4, cy - r * 4, r * 8, r * 8);
    ctx.fillStyle = day > 0.3 ? '#f2dca6' : '#e4e6ee';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.3);
    ctx.fill();
    return c;
  }

  function rockLayer(g, sky, tops, o) {
    const c = layer(g.W, g.H);
    paintRock(c.getContext('2d'), g, sky, tops, o);
    return c;
  }

  function nearLayer(g, sky, rand) {
    const c = rockLayer(g, sky, state.topsNear, { rock: '#5a606e', seed: 21, fade: 0.0, fog: 0.55 });
    const ctx = c.getContext('2d');
    const leaf = hex(mixColor(mixColor(rgb('#34503a'), sky.amb, 0.12), rgb('#10161e'), sky.night * 0.7));
    const bark = hex(mixColor(rgb('#2a2622'), rgb('#0e1018'), sky.night * 0.6));
    for (const p of PINES) {
      const px = Math.round(p.x * g.W);
      paintPine(ctx, px, state.topsNear[px] + g.U * 0.6, g.U * p.s, p.dir, leaf, bark);
    }
    // Small tufts along the near ridges.
    ctx.fillStyle = leaf;
    for (let i = 0; i < 40; i++) {
      const px = Math.floor(rand() * g.W);
      if (state.topsNear[px] > g.H) continue;
      ctx.fillRect(px, state.topsNear[px] - 1, 1 + rand() * 2, 1);
    }
    return c;
  }

  function repaint(g, choice) {
    const hourNow = S.hour(choice);
    const sky = S.at(hourNow);
    const rand = K.rng(17);
    state.sky = paintSky(g, sky, hourNow, rand);
    state.far = rockLayer(g, sky, state.topsFar, { rock: '#7b8494', seed: 5, fade: 0.55, fog: 0.3 });
    state.mid = rockLayer(g, sky, state.topsMid, { rock: '#5c6474', seed: 11, fade: 0.3, fog: 0.5 });
    state.near = nearLayer(g, sky, rand);
    const w = Math.ceil(g.W * 1.5);
    state.seaBack = paintSea(w, Math.ceil(g.H * 0.5), sky, 31, 0.9, 0.55);
    state.seaFront = paintSea(w, Math.ceil(g.H * 0.34), sky, 47, 0.75, 0.5);
    state.mistA = paintMist(w, Math.ceil(g.H * 0.22), sky, 59);
    state.mistB = paintMist(w, Math.ceil(g.H * 0.2), sky, 73);
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function slide(ctx, c, speed, t, y, alpha, g) {
    const off = -((t * speed * g.U) % c.width);
    ctx.globalAlpha = alpha;
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.topsFar = makeRidge(g, FAR, 3, 1.5);
    state.topsMid = makeRidge(g, MID, 7, 4);
    state.topsNear = makeRidge(g, NEAR, 13, 6);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.far, 0, 0);
    slide(ctx, state.mistA, -1.6, t, g.H * 0.38, 0.8 * props.mist, g);
    ctx.drawImage(state.mid, 0, 0);
    slide(ctx, state.seaBack, 2.2, t, g.H * 0.46, 0.95 * Math.min(1, props.sea), g);
    slide(ctx, state.mistB, 3.2, t, g.H * 0.3, 0.7 * props.mist, g);
    ctx.drawImage(state.near, 0, 0);
    slide(ctx, state.seaFront, 4.2, t, g.H * 0.68, 0.97 * Math.min(1, props.sea), g);
  }

  Kasuri.run({
    defaults: { time: 'auto', sea: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
