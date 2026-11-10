/*
 * 黄昏 Tasogare — twilight over flooded rice fields and a lone shrine gate.
 *
 * Sky, hills, pines, paddies and the gate are baked into layers and repainted
 * from the clock (every twenty seconds while the slow dusk is on, otherwise
 * once a minute). Between repaints only clouds, a few crows, the gate's
 * reflection, water glints and fireflies move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep, clamp } = K;

  const TAU = Math.PI * 2;
  const HORIZON = 0.5;
  const GATE = { x: 0.63, base: 0.8, h: 0.34 };
  const LANTERN = { x: 0.86, base: 0.86 };
  const DRIFT_SECONDS = 1500;
  const RETINT_DRIFT = 20;
  const RETINT_STILL = 60;
  const GLINTS = 60;
  const FLIES = 9;
  const CROWS = 5;
  const VERMILION = '#c4472b';
  const INK = '#1b2036';
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, hour, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const hy = g.H * HORIZON;
    const grad = ctx.createLinearGradient(0, 0, 0, hy);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(0.62, hex(mixColor(sky.top, sky.low, 0.55)));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, hy + 1);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.12 + rand() * 0.45);
        ctx.fillRect(rand() * g.W, rand() * hy * 0.8, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintLuminary(ctx, g, sky, hour);
    return c;
  }

  function glow(ctx, cx, cy, r, color, alpha) {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(${color[0] | 0},${color[1] | 0},${color[2] | 0},${alpha})`);
    grad.addColorStop(1, `rgba(${color[0] | 0},${color[1] | 0},${color[2] | 0},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  function paintLuminary(ctx, g, sky, hour) {
    const hy = g.H * HORIZON;
    const sunUp = hour >= 6 && hour <= 19.5;
    const t = sunUp ? S.sunT(hour) : S.moonT(hour);
    const arc = sunUp && hour > 12 ? 1 - smoothstep(13.5, 19.4, hour) : Math.sin(clamp(t, 0, 1) * Math.PI);
    const cx = g.W * (0.14 + t * 0.34);
    const cy = hy - arc * g.H * 0.34 + g.U * 1.5;
    if (sunUp) {
      const low = 1 - arc;
      glow(ctx, cx, cy, g.U * 34, mixColor(rgb('#f6c96a'), sky.low, 0.2), 0.34 + low * 0.25);
      ctx.fillStyle = hex(mixColor(rgb('#f4d890'), rgb('#e9a04a'), low));
      ctx.beginPath();
      ctx.arc(cx, cy, g.U * 4.2, 0, TAU);
      ctx.fill();
    } else {
      glow(ctx, cx, cy, g.U * 16, rgb('#c8cce0'), 0.22);
      ctx.fillStyle = '#e4e2d4';
      ctx.beginPath();
      ctx.arc(cx, cy, g.U * 2.4, 0, TAU);
      ctx.fill();
    }
    state.lightX = cx;
    state.lightGold = sunUp ? 1 : 0.35;
  }

  // Wisps that tile sideways, kept to the upper sky.
  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.013, y * 0.08, 4, 37);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = smoothstep(0.5, 0.72, v) * band * 230;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function tintClouds(base, sky) {
    const c = layer(base.width, base.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(base, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = hex(mixColor(sky.amb, sky.low, 0.55));
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // ---- hills, pines ------------------------------------------------------

  function paintHills(ctx, g, sky) {
    const hy = g.H * HORIZON;
    const far = mixColor(sky.haze, sky.top, 0.3);
    const mid = mixColor(sky.haze, rgb(INK), 0.5 + sky.night * 0.15);
    const near = mixColor(rgb('#2b3a3a'), rgb(INK), 0.35 + sky.night * 0.4);
    const ranges = [
      { col: far, amp: 0.1, base: 0.012, f: 0.011, seed: 3 },
      { col: mid, amp: 0.075, base: 0.01, f: 0.017, seed: 8 },
      { col: near, amp: 0.045, base: 0.004, f: 0.03, seed: 14 },
    ];
    for (const r of ranges) {
      ctx.fillStyle = hex(r.col);
      ctx.beginPath();
      ctx.moveTo(0, hy + 1);
      for (let x = 0; x <= g.W; x += 2) {
        const bump = fbm(x * r.f, r.seed, 3, r.seed + 2);
        ctx.lineTo(x, hy - g.H * r.base - bump * g.H * r.amp);
      }
      ctx.lineTo(g.W, hy + 1);
      ctx.closePath();
      ctx.fill();
    }
  }

  function pine(ctx, x, base, s, trunk, leaf, rand) {
    ctx.fillStyle = trunk;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.18, base);
    ctx.quadraticCurveTo(x - s * 0.1, base - s * 1.5, x + s * 0.18, base - s * 3);
    ctx.lineTo(x + s * 0.34, base - s * 3);
    ctx.quadraticCurveTo(x + s * 0.1, base - s * 1.4, x + s * 0.18, base);
    ctx.fill();
    ctx.fillStyle = leaf;
    const pads = [[0.2, 3.1, 1.7], [-1.2, 2.3, 1.4], [1.7, 2.1, 1.3], [-0.2, 1.4, 1.1], [1.1, 1.2, 0.9]];
    for (const p of pads) {
      ctx.beginPath();
      ctx.ellipse(x + p[0] * s, base - p[1] * s, p[2] * s, p[2] * s * 0.42, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillRect(x - s * 0.05, base - s * 2.2, 1, 1 + rand() * 0);
  }

  function paintMound(ctx, g, sky, rand) {
    const hy = g.H * HORIZON;
    const dark = hex(mixColor(rgb('#26352f'), rgb(INK), 0.3 + sky.night * 0.5));
    const trunk = hex(mixColor(rgb('#2c2622'), rgb(INK), 0.5));
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(g.W * 0.1, hy + g.U * 1.2, g.W * 0.16, g.U * 3.2, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillRect(0, hy, g.W * 0.26, g.U * 1.4);
    pine(ctx, g.W * 0.07, hy + g.U * 0.6, g.U * 3.4, trunk, dark, rand);
    pine(ctx, g.W * 0.15, hy + g.U * 0.9, g.U * 2.6, trunk, dark, rand);
    pine(ctx, g.W * 0.02, hy + g.U * 1.2, g.U * 2.1, trunk, dark, rand);
    // a thin line of far trees along the opposite shore
    ctx.fillStyle = dark;
    for (let i = 0; i < g.W * 0.35; i++) {
      const x = g.W * 0.4 + rand() * g.W * 0.6;
      ctx.beginPath();
      ctx.arc(x, hy + g.U * 0.4, g.U * (0.4 + rand() * 0.8), Math.PI, TAU);
      ctx.fill();
    }
  }

  // ---- paddies -----------------------------------------------------------

  function waterColor(g, sky, y) {
    const hy = g.H * HORIZON;
    const d = (y - hy) / (g.H - hy);
    const k = clamp(1 - d * 1.15, 0, 1);
    const sh = mixColor(sky.top, sky.low, 0.35 + k * 0.65);
    return mixColor(sh, rgb(INK), 0.05 + d * 0.22);
  }

  function paintWater(ctx, g, sky) {
    const hy = g.H * HORIZON;
    for (let y = Math.floor(hy); y < g.H; y++) {
      ctx.fillStyle = hex(waterColor(g, sky, y));
      ctx.fillRect(0, y, g.W, 1);
    }
    // sun road
    const warm = rgb('#f2c066');
    const gold = state.lightGold * (1 - sky.night * 0.5);
    for (let y = Math.floor(hy); y < g.H; y += 1) {
      const d = (y - hy) / (g.H - hy);
      const half = g.U * (1.5 + d * 6);
      ctx.fillStyle = hex(warm);
      for (let k = 0; k < 3; k++) {
        const n = fbm(y * 0.5, k * 7, 2, 9);
        ctx.globalAlpha = (0.4 - d * 0.22) * gold * smoothstep(0.35, 0.7, n);
        ctx.fillRect(state.lightX - half + k * half * 0.7, y, half * 0.6, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Levees: converging banks and cross banks, with seedling rows in the water.
  function paintLevees(ctx, g, sky, rand) {
    const hy = g.H * HORIZON;
    const bank = hex(mixColor(rgb('#3c4a35'), rgb(INK), 0.25 + sky.night * 0.4));
    const lit = hex(mixColor(rgb('#6e7a50'), sky.amb, 0.25));
    const vx = g.W * 0.46;
    const bankY = hy + g.U * 2.4;
    ctx.lineCap = 'butt';
    for (let i = -5; i <= 5; i++) {
      if (i === 0) continue;
      const bx = vx + i * g.W * 0.24;
      ctx.strokeStyle = bank;
      ctx.lineWidth = Math.max(1, g.U * 0.5);
      ctx.beginPath();
      ctx.moveTo(vx + (bx - vx) * 0.05, bankY);
      ctx.lineTo(bx, g.H + 2);
      ctx.stroke();
    }
    let y = bankY;
    let step = g.U * 1.5;
    while (y < g.H) {
      const d = (y - hy) / (g.H - hy);
      ctx.fillStyle = bank;
      ctx.fillRect(0, y, g.W, Math.max(1, g.U * (0.35 + d * 1.2)));
      ctx.fillStyle = lit;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(0, y, g.W, 1);
      ctx.globalAlpha = 1;
      y += step;
      step *= 1.32;
    }
    // seedling tufts, sparse and small
    ctx.fillStyle = hex(mixColor(rgb('#56703f'), rgb(INK), 0.2 + sky.night * 0.4));
    for (let i = 0; i < g.W * 0.9; i++) {
      const yy = bankY + Math.pow(rand(), 1.6) * (g.H - bankY);
      const d = (yy - hy) / (g.H - hy);
      ctx.fillRect(rand() * g.W, yy, Math.max(1, g.U * (0.3 + d * 0.8)), 1);
    }
  }

  // ---- torii and lantern -------------------------------------------------

  function paintGate(ctx, g, sky, ox, oy) {
    const T = g.H * GATE.h;
    const cx = g.W * GATE.x - ox;
    const base = g.H * GATE.base - oy;
    const top = base - T;
    const lit = mixColor(sky.amb, rgb('#ffffff'), 0.3);
    const red = hex(mixColor(mixColor(rgb(VERMILION), lit, 0.12), rgb('#2a2040'), 0.15 + sky.night * 0.6));
    const black = hex(mixColor(rgb(INK), rgb('#000000'), 0.2));
    const w = T * 0.62;
    const pw = T * 0.068;
    ctx.fillStyle = red;
    for (const side of [-1, 1]) {
      const px = cx + side * w / 2;
      ctx.beginPath();
      ctx.moveTo(px - pw / 2 - side * pw * 0.12, base);
      ctx.lineTo(px - pw / 2 + side * pw * 0.18, top + T * 0.06);
      ctx.lineTo(px + pw / 2 + side * pw * 0.18, top + T * 0.06);
      ctx.lineTo(px + pw / 2 - side * pw * 0.12, base);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = black;
    for (const side of [-1, 1]) {
      const px = cx + side * w / 2;
      ctx.fillRect(px - pw * 0.62, base - T * 0.06, pw * 1.24, T * 0.06);
    }
    // nuki, the lower beam, passing through both pillars
    const nukiY = top + T * 0.27;
    ctx.fillStyle = red;
    ctx.fillRect(cx - w / 2 - pw * 1.0, nukiY, w + pw * 2, T * 0.045);
    // gakuzuka, the short post between beams, left bare
    ctx.fillRect(cx - pw * 0.55, top + T * 0.07, pw * 1.1, nukiY - top - T * 0.07);
    // shimaki and kasagi, the curved top beams
    const reach = w / 2 + T * 0.2;
    ctx.fillStyle = red;
    ctx.fillRect(cx - w / 2 - pw * 1.5, top + T * 0.045, w + pw * 3, T * 0.04);
    ctx.fillStyle = black;
    ctx.beginPath();
    ctx.moveTo(cx - reach, top - T * 0.05);
    ctx.quadraticCurveTo(cx, top + T * 0.05, cx + reach, top - T * 0.05);
    ctx.lineTo(cx + reach - T * 0.015, top + T * 0.005);
    ctx.quadraticCurveTo(cx, top + T * 0.09, cx - reach + T * 0.015, top + T * 0.005);
    ctx.closePath();
    ctx.fill();
  }

  function paintLantern(ctx, g, sky) {
    const x = g.W * LANTERN.x;
    const base = g.H * LANTERN.base;
    const s = g.U;
    const stone = hex(mixColor(rgb('#6f7078'), rgb(INK), 0.35 + sky.night * 0.45));
    ctx.fillStyle = stone;
    ctx.fillRect(x - s * 1.4, base - s * 0.8, s * 2.8, s * 0.8);
    ctx.fillRect(x - s * 0.45, base - s * 4.6, s * 0.9, s * 3.9);
    ctx.fillRect(x - s * 1.1, base - s * 5.2, s * 2.2, s * 0.6);
    ctx.fillRect(x - s * 0.8, base - s * 6.6, s * 1.6, s * 1.4);
    ctx.beginPath();
    ctx.moveTo(x - s * 2, base - s * 6.6);
    ctx.lineTo(x, base - s * 8.4);
    ctx.lineTo(x + s * 2, base - s * 6.6);
    ctx.closePath();
    ctx.fill();
    const flame = 0.35 + sky.night * 0.65;
    ctx.fillStyle = hex(mixColor(rgb('#e4a84a'), rgb('#f2d68a'), 0.4));
    ctx.globalAlpha = flame;
    ctx.fillRect(x - s * 0.3, base - s * 6.2, s * 0.6, s * 0.7);
    ctx.globalAlpha = 1;
  }

  function paintLand(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintHills(ctx, g, sky);
    paintMound(ctx, g, sky, rand);
    paintWater(ctx, g, sky);
    paintLevees(ctx, g, sky, rand);
    paintGate(ctx, g, sky, 0, 0);
    paintLantern(ctx, g, sky);
    return c;
  }

  function paintGateOnly(g, sky) {
    const T = g.H * GATE.h;
    const w = Math.ceil(T * 1.2);
    const h = Math.ceil(T * 1.1);
    const c = layer(w, h);
    const ox = g.W * GATE.x - w / 2;
    const oy = g.H * GATE.base - T * 1.05;
    paintGate(c.getContext('2d'), g, sky, ox, oy);
    state.gateOx = ox;
    state.gateOy = oy;
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function hourFor(props, t) {
    if (props.time === 'dusk' && props.drift) {
      const phase = 0.5 - 0.5 * Math.cos((t / DRIFT_SECONDS) * TAU);
      return 17.1 + phase * 2.9;
    }
    return S.hour(props.time);
  }

  function repaint(g, props, t) {
    const hour = hourFor(props, t);
    const sky = S.at(hour);
    const rand = K.rng(47);
    state.sky = paintSky(g, sky, hour, rand);
    state.land = paintLand(g, sky, rand);
    state.gate = paintGateOnly(g, sky);
    state.clouds = tintClouds(state.cloudBase, sky);
    state.night = sky.night;
    state.dusk = 1 - sky.night;
    state.cloudAlpha = 0.7 - sky.night * 0.35;
    state.crowInk = hex(mixColor(rgb(INK), sky.haze, 0.2));
    state.glintInk = hex(mixColor(rgb('#f0d49a'), rgb('#aeb4d8'), sky.night));
    state.retintIn = props.time === 'dusk' && props.drift ? RETINT_DRIFT : RETINT_SECONDS_STILL;
    state.key = props.time + (props.drift ? '1' : '0');
  }

  const RETINT_SECONDS_STILL = RETINT_STILL;

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 2.4) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.05);
    ctx.drawImage(c, off + c.width, g.H * 0.05);
    ctx.globalAlpha = 1;
  }

  // A loose line of crows heading home, wings beating slowly.
  function drawCrows(ctx, g, t) {
    if (state.night > 0.9) return;
    const cycle = 45;
    const p = (t % cycle) / 32;
    if (p >= 1) return;
    ctx.fillStyle = state.crowInk;
    const s = Math.max(1, g.U * 0.55);
    for (let i = 0; i < CROWS; i++) {
      const x = lerp(-g.W * 0.05, g.W * 1.05, p) - i * g.U * 4.5;
      const y = g.H * 0.2 + i * g.U * 1.3 + Math.sin(t * 0.5 + i) * g.U * 0.7 - p * g.U * 5;
      const flap = Math.sin(t * 3.2 + i * 1.9) * s * 0.9;
      ctx.fillRect(x - s * 1.6, y - flap * 0.5, s * 1.4, 1);
      ctx.fillRect(x + s * 0.2, y - flap * 0.5, s * 1.4, 1);
      ctx.fillRect(x - s * 0.2, y + flap * 0.25, s * 0.5, Math.max(1, s * 0.5));
    }
  }

  // The gate in the water, cut into thin rows that slide sideways.
  function drawReflection(ctx, g, t) {
    const src = state.gate;
    const rows = Math.floor(src.height * 0.95);
    const foot = g.H * GATE.base;
    const footInSrc = foot - state.gateOy;
    ctx.globalAlpha = 0.5 - state.night * 0.15;
    for (let r = 0; r < rows; r++) {
      const sy = Math.floor(footInSrc - 1 - r);
      if (sy < 0) break;
      const d = r / rows;
      const wave = Math.sin(t * 1.6 + r * 0.55) * g.U * (0.3 + d * 0.9);
      ctx.drawImage(src, 0, sy, src.width, 1, state.gateOx + wave, foot + r, src.width, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, g, t) {
    const hy = g.H * HORIZON;
    ctx.fillStyle = state.glintInk;
    for (let i = 0; i < GLINTS; i++) {
      const a = (i * 0.618) % 1;
      const d = 0.08 + ((i * 0.37) % 1) * 0.85;
      const y = hy + d * (g.H - hy);
      const x = ((a * 1.3 + t * 0.02 * (i % 3 + 1)) % 1) * g.W;
      const life = 0.5 + 0.5 * Math.sin(t * 0.35 + i * 2.1);
      ctx.globalAlpha = life * 0.6 * (0.4 + state.dusk * 0.6);
      ctx.fillRect(x, y, g.U * (1.5 + d * 4), 1);
    }
    ctx.globalAlpha = 1;
  }

  // Fireflies drift low over the fields once the light fades; the glow breathes slowly.
  function drawFireflies(ctx, g, t) {
    const strength = smoothstep(0.35, 0.9, state.night);
    if (strength <= 0.01) return;
    ctx.fillStyle = '#d8e08a';
    const hy = g.H * HORIZON;
    for (let i = 0; i < FLIES; i++) {
      const bx = ((i * 0.37 + 0.1) % 1) * g.W;
      const by = hy + g.H * (0.12 + ((i * 0.53) % 1) * 0.3);
      const x = bx + Math.sin(t * 0.21 + i * 3.1) * g.U * 7;
      const y = by + Math.sin(t * 0.33 + i * 1.7) * g.U * 2.4;
      ctx.globalAlpha = strength * (0.15 + 0.4 * (0.5 + 0.5 * Math.sin(t * 0.6 + i * 2.3)));
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.cloudBase = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.28));
    repaint(g, api.props, 0);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.key !== props.time + (props.drift ? '1' : '0')) repaint(g, props, t);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t, props.clouds);
    ctx.drawImage(state.land, 0, 0);
    drawReflection(ctx, g, t);
    drawGlints(ctx, g, t);
    drawCrows(ctx, g, t);
    drawFireflies(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'dusk', drift: true, clouds: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
