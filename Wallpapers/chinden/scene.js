/*
 * 路面電車 Chinden — a small old streetcar on a quiet tree-lined track at dusk.
 *
 * Sky, hills, tiled houses, stone wall, trees, poles, wires and lamps are baked
 * into two layers and repainted once a minute from the clock. The car is one
 * baked sprite that slides along the rail. Between repaints only the clouds,
 * the car, the lamp glow and a few ginkgo leaves move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const RAIL = 0.82;
  const WIRE_UP = 25;
  const HOUSE_BASE = 0.745;
  const WALK = 0.775;
  const RETINT_SECONDS = 60;
  const MAX_LEAVES = 22;
  const CAR_SECONDS = 46;
  const HOUSES = [
    { x: 0.025, w: 30, wh: 11, rh: 8 },
    { x: 0.275, w: 25, wh: 10, rh: 7 },
    { x: 0.525, w: 34, wh: 11, rh: 9 },
    { x: 0.8, w: 30, wh: 11, rh: 8 },
  ];
  const TREES = [
    { x: 0.2, r: 9, gold: false },
    { x: 0.43, r: 10, gold: true },
    { x: 0.69, r: 9, gold: false },
    { x: 0.93, r: 10, gold: true },
  ];
  const POLES = [0.12, 0.4, 0.68, 0.96];
  const LAMPS = [0.09, 0.355, 0.605, 0.865];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function tone(c, sky, k) {
    return hex(mixColor(mixColor(rgb(c), sky.amb, 0.18), rgb('#161a30'), sky.night * (k === undefined ? 0.4 : k * 0.7)));
  }

  // 0 by day, 1 once the lamps are fully on.
  function lampLevel(h) {
    if (h < 12) return 1 - smoothstep(5, 6.5, h);
    return smoothstep(17.3, 18.6, h);
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.72);
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
    return c;
  }

  function paintClouds(w, h, sky) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const tint = mixColor(rgb('#f6f2ea'), sky.amb, 0.45).map((v) => v * (1 - sky.night * 0.65));
    const density = (x, y) => fbm(x * 0.014, y * 0.07, 4, 21);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = tint[0];
        img.data[i + 1] = tint[1];
        img.data[i + 2] = tint[2];
        img.data[i + 3] = smoothstep(0.52, 0.7, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintGlow() {
    const c = layer(48, 48);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
    grad.addColorStop(0, 'rgba(240,200,110,0.55)');
    grad.addColorStop(0.4, 'rgba(236,184,96,0.2)');
    grad.addColorStop(1, 'rgba(236,184,96,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 48, 48);
    return c;
  }

  // ---- hills and houses --------------------------------------------------

  function paintHills(ctx, g, sky) {
    const rows = [
      { base: 0.52, amp: 9, col: mixColor(sky.haze, sky.low, 0.3), seed: 3 },
      { base: 0.6, amp: 7, col: mixColor(sky.haze, rgb('#2c3a4c'), 0.45), seed: 8 },
    ];
    for (const r of rows) {
      ctx.fillStyle = hex(r.col);
      ctx.beginPath();
      ctx.moveTo(0, g.H * 0.76);
      for (let px = 0; px <= g.W; px += 2) {
        const yy = g.H * r.base - fbm(px * 0.012, 1.5, 3, r.seed) * g.U * r.amp;
        ctx.lineTo(px, yy);
      }
      ctx.lineTo(g.W, g.H * 0.76);
      ctx.fill();
    }
  }

  function paintFarRoofs(ctx, g, sky) {
    ctx.fillStyle = hex(mixColor(sky.haze, rgb('#33405a'), 0.5));
    const u = g.U;
    const base = g.H * 0.7;
    for (let f = 0.0; f < 1.02; f += 0.085) {
      const w = u * (12 + ((f * 97) % 7));
      const x0 = g.W * f;
      ctx.fillRect(x0, base - u * 5, w, u * 5);
      ctx.beginPath();
      ctx.moveTo(x0 - u * 1.4, base - u * 5);
      ctx.lineTo(x0 + w * 0.2, base - u * 9);
      ctx.lineTo(x0 + w * 0.8, base - u * 9);
      ctx.lineTo(x0 + w + u * 1.4, base - u * 5);
      ctx.fill();
    }
    ctx.fillRect(0, base, g.W, g.H * 0.06);
  }

  function paintHouse(ctx, g, sky, h, lit) {
    const u = g.U;
    const x0 = g.W * h.x;
    const w = u * h.w;
    const base = g.H * HOUSE_BASE;
    const top = base - u * h.wh;
    ctx.fillStyle = tone('#e2d8bc', sky);
    ctx.fillRect(x0, top, w, u * h.wh);
    // dark board skirt along the foot of the wall
    ctx.fillStyle = tone('#4a382a', sky);
    ctx.fillRect(x0, base - u * 3.2, w, u * 3.2);
    ctx.fillStyle = tone('#2e2218', sky);
    for (let px = x0; px < x0 + w; px += u * 1.5) ctx.fillRect(px, base - u * 3.2, 1, u * 3.2);
    // paper screens with a gold light behind them
    const n = Math.max(2, Math.round(h.w / 8));
    const wx = w / n;
    for (let i = 0; i < n; i++) {
      const sx = x0 + wx * i + wx * 0.2;
      const sw = wx * 0.6;
      const sy = top + u * 1.6;
      const sh = u * 4.6;
      ctx.fillStyle = hex(mixColor(rgb(tone('#d8d4c0', sky)), rgb('#f0c46a'), lit * 0.9));
      ctx.fillRect(sx, sy, sw, sh);
      ctx.fillStyle = tone('#3a2c20', sky);
      ctx.fillRect(sx, sy, sw, 1);
      ctx.fillRect(sx, sy + sh, sw, 1);
      ctx.fillRect(sx + sw / 2, sy, 1, sh);
    }
    // tiled roof with a deep eave
    ctx.fillStyle = tone('#4a5670', sky, 0.5);
    ctx.beginPath();
    ctx.moveTo(x0 - u * 2.4, top + u * 0.8);
    ctx.lineTo(x0 + w * 0.14, top - u * h.rh);
    ctx.lineTo(x0 + w * 0.86, top - u * h.rh);
    ctx.lineTo(x0 + w + u * 2.4, top + u * 0.8);
    ctx.fill();
    ctx.fillStyle = tone('#8090aa', sky, 0.5);
    for (let k = 1; k < h.rh; k += 1.6) {
      const ry = top - u * k;
      const inset = (w * 0.14 + u * 2.4) * (k / h.rh);
      ctx.fillRect(x0 - u * 2.4 + inset, ry, w + u * 4.8 - inset * 2, 1);
    }
    ctx.fillStyle = tone('#22283a', sky, 0.4);
    ctx.fillRect(x0 + w * 0.14 - u * 0.8, top - u * h.rh - u * 0.9, w * 0.72 + u * 1.6, u * 0.9);
    ctx.fillRect(x0 - u * 2.4, top + u * 0.4, w + u * 4.8, u * 0.7);
  }

  function paintWall(ctx, g, sky) {
    const u = g.U;
    const top = g.H * HOUSE_BASE;
    const h = g.H * WALK - top;
    ctx.fillStyle = tone('#6a645c', sky);
    ctx.fillRect(0, top, g.W, h);
    ctx.fillStyle = tone('#4a463f', sky);
    for (let row = 1; row < 3; row++) ctx.fillRect(0, top + (h * row) / 3, g.W, 1);
    const rand = K.rng(14);
    for (let row = 0; row < 3; row++) {
      for (let px = rand() * u * 4; px < g.W; px += u * (3 + rand() * 3)) ctx.fillRect(px, top + (h * row) / 3, 1, h / 3);
    }
    ctx.fillStyle = tone('#2c4a30', sky);
    ctx.fillRect(0, top - u * 0.6, g.W, u * 0.6);
  }

  // ---- trees, poles, lamps ----------------------------------------------

  function paintTree(ctx, g, sky, t, rand) {
    const u = g.U;
    const cx = g.W * t.x;
    const base = g.H * WALK;
    ctx.fillStyle = tone('#3a2c20', sky);
    ctx.fillRect(cx - u * 0.8, base - u * 13, u * 1.6, u * 13);
    ctx.fillRect(cx - u * 0.3, base - u * 18, u * 0.6, u * 6);
    const cols = t.gold ? ['#c9a24a', '#d8b657', '#a8832f'] : ['#4d6a48', '#3c5a3c', '#5f7d52'];
    for (let i = 0; i < 26; i++) {
      const a = rand() * 6.28;
      const d = Math.sqrt(rand()) * t.r * u * 0.9;
      ctx.fillStyle = tone(cols[i % 3], sky);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * d, base - u * 21 + Math.sin(a) * d * 0.75, u * (2.4 + rand() * 1.8), 0, 6.3);
      ctx.fill();
    }
  }

  function paintPoles(ctx, g, sky) {
    const u = g.U;
    const wireY = g.H * RAIL - u * WIRE_UP;
    const ink = tone('#4a5068', sky, 0.5);
    ctx.fillStyle = ink;
    for (const f of POLES) {
      const px = g.W * f;
      ctx.fillRect(px - u * 0.45, wireY - u * 3, u * 0.9, g.H * (WALK + 0.012) - wireY + u * 3);
      ctx.fillRect(px - u * 1.2, g.H * WALK - u * 0.6, u * 2.4, u * 0.9);
      ctx.fillRect(px - u * 3, wireY - u * 2.4, u * 6, u * 0.5);
    }
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, wireY + 0.5);
    ctx.lineTo(g.W, wireY + 0.5);
    ctx.stroke();
    // messenger wire sagging between poles, with short hangers
    const spans = [-0.16].concat(POLES);
    for (let i = 0; i + 1 < spans.length; i++) {
      const a = g.W * spans[i];
      const b = g.W * spans[i + 1];
      ctx.beginPath();
      ctx.moveTo(a, wireY - u * 2.2);
      ctx.quadraticCurveTo((a + b) / 2, wireY - u * 0.4, b, wireY - u * 2.2);
      ctx.stroke();
      for (let k = 1; k < 5; k++) {
        const s = k / 5;
        const hy = wireY - u * 2.2 + (u * 1.8) * 4 * s * (1 - s) * 0.5;
        ctx.fillRect(a + (b - a) * s, hy, 1, wireY - hy);
      }
    }
  }

  function paintLamp(ctx, g, sky, f, lit) {
    const u = g.U;
    const px = g.W * f;
    const base = g.H * (WALK + 0.012);
    ctx.fillStyle = tone('#242836', sky, 0.4);
    ctx.fillRect(px - u * 0.35, base - u * 15, u * 0.7, u * 15);
    ctx.fillRect(px - u * 1, base - u * 1, u * 2, u * 1);
    ctx.fillRect(px - u * 1.6, base - u * 19.4, u * 3.2, u * 0.7);
    ctx.fillRect(px - u * 1.2, base - u * 15.2, u * 2.4, u * 0.6);
    ctx.fillStyle = hex(mixColor(rgb(tone('#d9d2b8', sky)), rgb('#f6cf7a'), lit));
    ctx.fillRect(px - u * 1, base - u * 18.8, u * 2, u * 3.6);
    ctx.fillStyle = tone('#242836', sky, 0.4);
    ctx.fillRect(px, base - u * 18.8, 1, u * 3.6);
  }

  // ---- ground ------------------------------------------------------------

  function paintGround(ctx, g, sky, lit) {
    const u = g.U;
    ctx.fillStyle = tone('#8c8470', sky);
    ctx.fillRect(0, g.H * WALK, g.W, u * 1.2);
    const road = ctx.createLinearGradient(0, g.H * (WALK + 0.012), 0, g.H);
    road.addColorStop(0, tone('#5a554c', sky));
    road.addColorStop(1, tone('#3c3a38', sky));
    ctx.fillStyle = road;
    ctx.fillRect(0, g.H * (WALK + 0.012), g.W, g.H);
    // setts between the rails
    ctx.fillStyle = tone('#6e685c', sky);
    for (let px = 0; px < g.W; px += u * 2.4) ctx.fillRect(px, g.H * RAIL + u * 0.4, u * 1.4, u * 0.6);
    // two rails
    ctx.fillStyle = tone('#9a9a9c', sky);
    ctx.fillRect(0, g.H * RAIL, g.W, Math.max(1, u * 0.5));
    ctx.fillRect(0, g.H * RAIL + u * 3.4, g.W, Math.max(1, u * 0.5));
    // warm pools of lamp light on the street
    if (lit > 0.02) {
      for (const f of LAMPS) {
        const px = g.W * f;
        const grad = ctx.createRadialGradient(px, g.H * 0.8, 0, px, g.H * 0.8, u * 16);
        grad.addColorStop(0, `rgba(240,196,110,${0.34 * lit})`);
        grad.addColorStop(1, 'rgba(240,196,110,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(px - u * 16, g.H * 0.76, u * 32, g.H * 0.24);
      }
    }
  }

  function paintHedge(ctx, g, sky, rand) {
    const u = g.U;
    for (let px = -u; px < g.W + u; px += u * 4.5) {
      const hgt = u * (3 + rand() * 3);
      ctx.fillStyle = tone(rand() < 0.5 ? '#2f4a33' : '#3c5a3c', sky);
      ctx.beginPath();
      ctx.arc(px, g.H - u * 0.5, hgt + u * 1.4, Math.PI, 0);
      ctx.fill();
    }
    ctx.fillStyle = tone('#2f4a33', sky);
    ctx.fillRect(0, g.H - u * 1.4, g.W, u * 1.4);
  }

  // ---- bake --------------------------------------------------------------

  function paintBack(g, sky, lit, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintHills(ctx, g, sky);
    paintFarRoofs(ctx, g, sky);
    for (const h of HOUSES) paintHouse(ctx, g, sky, h, lit);
    paintWall(ctx, g, sky);
    for (const t of TREES) paintTree(ctx, g, sky, t, rand);
    paintGround(ctx, g, sky, lit);
    paintPoles(ctx, g, sky);
    for (const f of LAMPS) paintLamp(ctx, g, sky, f, lit);
    return c;
  }

  function paintFore(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintHedge(ctx, g, sky, rand);
    return c;
  }

  // The car, drawn once. It travels to the right, the trolley pole trails behind.
  function paintCar(g, sky, lit) {
    const u = g.U;
    const sw = Math.ceil(48 * u);
    const sh = Math.ceil((WIRE_UP + 1.2) * u);
    const c = layer(sw, sh);
    const ctx = c.getContext('2d');
    const x0 = 2 * u;
    const bw = 44 * u;
    const bot = sh - 2.6 * u;
    const bodyH = 12 * u;
    const top = bot - bodyH;
    // bogies and wheels
    ctx.fillStyle = tone('#20232e', sky, 0.4);
    for (const f of [0.12, 0.68]) {
      ctx.fillRect(x0 + bw * f, bot, bw * 0.2, 1.1 * u);
      for (const d of [0.03, 0.15]) {
        ctx.beginPath();
        ctx.arc(x0 + bw * (f + d), sh - 1.1 * u, 1.1 * u, 0, 6.3);
        ctx.fill();
      }
    }
    // lower body in moss, upper in washi, vermilion line between
    ctx.fillStyle = tone('#4a6646', sky);
    ctx.fillRect(x0, top, bw, bodyH);
    ctx.fillStyle = tone('#e6dcc0', sky);
    ctx.fillRect(x0, top, bw, bodyH * 0.58);
    ctx.fillStyle = tone('#c4442c', sky);
    ctx.fillRect(x0, top + bodyH * 0.58, bw, Math.max(1, u * 0.9));
    // roof with a raised clerestory
    ctx.fillStyle = tone('#2b3248', sky, 0.5);
    ctx.fillRect(x0 - u * 0.8, top - u * 0.9, bw + u * 1.6, u * 0.9);
    ctx.fillStyle = tone('#cfc4a6', sky);
    ctx.fillRect(x0 + bw * 0.06, top - u * 2.6, bw * 0.88, u * 1.7);
    // windows
    const glass = hex(mixColor(rgb(tone('#a9b7c4', sky, 0.7)), rgb('#f2c872'), lit));
    ctx.fillStyle = glass;
    const n = 8;
    const pitch = (bw - 6 * u) / n;
    for (let i = 0; i < n; i++) ctx.fillRect(x0 + 3 * u + pitch * i + u * 0.35, top + u * 1.2, pitch - u * 0.7, bodyH * 0.42);
    ctx.fillStyle = tone('#3a2c20', sky);
    ctx.fillRect(x0 + bw * 0.5 - u * 0.3, top + u * 1.2, u * 0.6, bodyH * 0.42);
    // headlamp and front step
    ctx.fillStyle = hex(mixColor(rgb(tone('#d9d2b8', sky)), rgb('#f8d98a'), lit));
    ctx.fillRect(x0 + bw - u * 0.2, top + bodyH * 0.62, u * 1.2, u * 1.4);
    ctx.fillStyle = tone('#20232e', sky, 0.4);
    ctx.fillRect(x0 - u * 0.6, bot - u * 0.4, bw + u * 1.2, u * 0.7);
    // trolley pole up to the wire
    ctx.strokeStyle = tone('#20232e', sky, 0.4);
    ctx.lineWidth = Math.max(1, u * 0.45);
    ctx.beginPath();
    ctx.moveTo(x0 + bw * 0.3, top - u * 2.6);
    ctx.lineTo(x0 + bw * 0.1, u * 0.4);
    ctx.stroke();
    return c;
  }

  function repaint(g, choice) {
    const hr = S.hour(choice);
    const sky = S.at(hr);
    const lit = lampLevel(hr);
    const rand = K.rng(41);
    state.sky = paintSky(g, sky, rand);
    state.back = paintBack(g, sky, lit, rand);
    state.fore = paintFore(g, sky, rand);
    state.car = paintCar(g, sky, lit);
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.3), sky);
    state.cloudAlpha = 0.8 - sky.night * 0.3;
    state.lit = lit;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
    state.leafCol = tone('#d8b24e', sky, 0.5);
    state.leafCol2 = tone('#c4442c', sky, 0.5);
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 1.4) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.05);
    ctx.drawImage(c, off + c.width, g.H * 0.05);
    ctx.globalAlpha = 1;
  }

  function drawCar(ctx, g, t) {
    const c = state.car;
    const span = g.W + c.width * 1.2;
    const px = ((t / CAR_SECONDS) % 1) * span - c.width * 1.1;
    const bob = Math.sin(t * 8.3) * g.U * 0.12;
    ctx.drawImage(c, px, g.H * RAIL - c.height + g.U * 0.5 + bob);
  }

  function drawGlow(ctx, g, t) {
    if (state.lit <= 0.02) return;
    const size = g.U * 17;
    for (let i = 0; i < LAMPS.length; i++) {
      const breath = 0.88 + 0.12 * Math.sin(t * 0.5 + i * 1.7);
      ctx.globalAlpha = state.lit * breath;
      ctx.drawImage(state.glow, g.W * LAMPS[i] - size / 2, g.H * (WALK + 0.012) - g.U * 17.2 - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawLeaves(ctx, g, t, amount) {
    const n = Math.round(MAX_LEAVES * Math.min(1, amount) * (amount > 1 ? 1.0 : 1));
    const lv = state.leafData;
    const u = g.U;
    for (let i = 0; i < n; i++) {
      const L = lv[i];
      const a = (t * L.rate + L.phase) % 1;
      const lx = g.W * L.x + Math.sin(t * 0.9 + L.phase * 20) * u * 2.5 + a * u * 6;
      const ly = u * (40 + a * 40);
      ctx.fillStyle = L.red ? state.leafCol2 : state.leafCol;
      ctx.fillRect(lx, ly, Math.max(1, u * 0.9), Math.max(1, u * 0.6));
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.glow = paintGlow();
    const rand = K.rng(77);
    state.leafData = [];
    for (let i = 0; i < MAX_LEAVES; i++) {
      const gold = TREES.filter((t) => t.gold);
      state.leafData.push({ x: gold[i % gold.length].x + (rand() - 0.5) * 0.14, rate: 0.015 + rand() * 0.02, phase: rand(), red: i % 5 === 0 });
    }
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t, props.clouds);
    ctx.drawImage(state.back, 0, 0);
    drawGlow(ctx, g, t);
    drawCar(ctx, g, t);
    if (props.leaves > 0) drawLeaves(ctx, g, t, props.leaves);
    ctx.drawImage(state.fore, 0, 0);
  }

  Kasuri.run({
    defaults: { time: 'dusk', clouds: 1, leaves: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
