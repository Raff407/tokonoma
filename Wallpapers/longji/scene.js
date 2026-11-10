/*
 * 龙脊 Longji — rice terraces climbing a ridge, with a few wooden houses.
 *
 * Sky, far peaks, terraces and houses are baked and repainted once a minute
 * from the clock. Flooded steps mirror the sky. Between repaints only mist,
 * water glints and a little hearth smoke move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const STEPS = 17;
  const RETINT_SECONDS = 60;
  const MAX_GLINTS = 48;
  const MAX_PUFFS = 10;
  const HOUSES = [
    { x: 0.12, k: 7 },
    { x: 0.31, k: 10 },
    { x: 0.52, k: 8 },
    { x: 0.7, k: 11 },
    { x: 0.88, k: 9 },
  ];
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Colour as lit by the sky, sinking toward indigo at night.
  function tone(sky, c, amount) {
    const lit = mixColor(rgb(c), sky.amb, 0.2);
    return hex(mixColor(lit, rgb('#10142a'), sky.night * (amount === undefined ? 0.7 : amount)));
  }

  // ---- layout, fixed once per size ----------------------------------------

  function bump(x, c, w) {
    const d = (x - c) / w;
    return Math.exp(-d * d);
  }

  function planRidge(g) {
    const r = new Float32Array(g.W + 1);
    for (let x = 0; x <= g.W; x++) {
      const y = 0.42 - 0.2 * bump(x, g.W * 0.27, g.W * 0.22) - 0.11 * bump(x, g.W * 0.74, g.W * 0.19);
      r[x] = g.H * y + (fbm(x * 0.04, 3, 3, 5) - 0.5) * g.U * 2;
    }
    return r;
  }

  function planTerraces(g) {
    const rand = K.rng(23);
    const ridge = planRidge(g);
    const lines = [];
    for (let k = 0; k <= STEPS; k++) {
      const f = Math.pow(k / STEPS, 1.45);
      const fn = Math.pow(Math.min(STEPS, k + 1) / STEPS, 1.45);
      const a = new Float32Array(g.W + 1);
      for (let x = 0; x <= g.W; x++) {
        const span = g.H - ridge[x];
        const wob = k === 0 || k === STEPS ? 0 : (fbm(x * 0.022, k * 3.1, 3, 7) - 0.5) * 1.1 * (fn - f) * span;
        a[x] = ridge[x] + f * span + wob;
      }
      lines.push(a);
    }
    lines[STEPS] = new Float32Array(g.W + 1).fill(g.H + 2);
    const kinds = [];
    for (let k = 0; k < STEPS; k++) {
      const r = rand();
      kinds.push(k < 3 ? 'green' : r < 0.38 ? 'water' : r < 0.78 ? 'green' : 'gold');
    }
    const houses = HOUSES.map((h) => {
      kinds[h.k + 1] = 'water';
      return h;
    });
    const glints = [];
    for (let k = 3; k < STEPS - 1; k++) {
      if (kinds[k] !== 'water') continue;
      for (let j = 0; j < 6 && glints.length < MAX_GLINTS; j++) {
        const x = Math.floor(g.W * (0.04 + rand() * 0.92));
        const d = lines[k + 1][x] - lines[k][x];
        glints.push({ x, y: lines[k][x] + d * (0.4 + rand() * 0.3), w: g.U * (3 + rand() * 6), ph: rand() * 6.3 });
      }
    }
    return { ridge, lines, kinds, houses, glints };
  }

  // ---- sky and far peaks --------------------------------------------------

  function paintDisc(ctx, g, sky) {
    const day = sky.night < 0.6 && sky.hour > 5.5 && sky.hour < 20;
    const moon = sky.night > 0.3;
    if (!day && !moon) return;
    const T = day ? S.sunT(sky.hour) : S.moonT(sky.hour);
    const px = g.W * (0.12 + 0.76 * T);
    const py = g.H * (0.38 - 0.27 * Math.sin(Math.PI * T));
    const rad = g.U * (day ? 14 : 9);
    const glow = ctx.createRadialGradient(px, py, 0, px, py, rad);
    glow.addColorStop(0, day ? 'rgba(250,236,200,0.5)' : 'rgba(226,230,240,0.3)');
    glow.addColorStop(1, 'rgba(250,236,200,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    ctx.fillStyle = day ? '#f6ecd0' : '#e6e8ee';
    ctx.globalAlpha = day ? 0.8 : 0.85;
    ctx.beginPath();
    ctx.arc(px, py, g.U * (day ? 2.6 : 2), 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function paintPeaks(ctx, g, sky, base, amp, seed, mixIn, tint) {
    const top = base - amp;
    const grad = ctx.createLinearGradient(0, top, 0, base + g.H * 0.06);
    const far = mixColor(mixColor(sky.haze, rgb(tint), mixIn), sky.top, 0.12);
    grad.addColorStop(0, hex(far));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, base + g.H * 0.06);
    for (let x = 0; x <= g.W; x += 2) {
      const p = fbm(x * 0.008, seed, 4, seed);
      ctx.lineTo(x, base - amp * smoothstep(0.3, 0.8, p) - amp * 0.1 * fbm(x * 0.05, 1, 2, 3));
    }
    ctx.lineTo(g.W, base + g.H * 0.06);
    ctx.closePath();
    ctx.fill();
  }

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.5);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintDisc(ctx, g, sky);
    paintPeaks(ctx, g, sky, g.H * 0.36, g.H * 0.24, 41, 0.1, '#3a4a72');
    paintPeaks(ctx, g, sky, g.H * 0.42, g.H * 0.2, 53, 0.3, '#2f4a78');
    return c;
  }

  // ---- terraces -----------------------------------------------------------

  function shapeBetween(ctx, g, a, b, offset, scale) {
    ctx.beginPath();
    ctx.moveTo(0, a[0] + offset * (b[0] - a[0]));
    for (let x = 1; x <= g.W; x++) ctx.lineTo(x, a[x] + offset * (b[x] - a[x]));
    for (let x = g.W; x >= 0; x--) ctx.lineTo(x, a[x] + (offset + scale) * (b[x] - a[x]));
    ctx.closePath();
  }

  function strokeLine(ctx, g, a, b, at) {
    ctx.beginPath();
    for (let x = 0; x <= g.W; x++) {
      const y = a[x] + at * (b[x] - a[x]);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function stepColor(sky, kind, k) {
    const depth = 1 - k / STEPS;
    let base;
    if (kind === 'water') base = mixColor(mixColor(sky.low, sky.top, 0.3), rgb('#2f4a78'), 0.16);
    else if (kind === 'gold') base = mixColor(rgb('#c9a24a'), sky.amb, 0.15);
    else base = mixColor(rgb('#4f7a3a'), sky.amb, 0.15);
    base = mixColor(base, rgb('#10142a'), kind === 'water' ? 0 : sky.night * 0.7);
    return hex(mixColor(base, sky.haze, depth * 0.45));
  }

  function paintTerraces(ctx, g, sky, plan) {
    const U = g.U;
    for (let k = 0; k < STEPS; k++) {
      const a = plan.lines[k];
      const b = plan.lines[k + 1];
      const kind = plan.kinds[k];
      const bottom = plan.lines[STEPS];
      ctx.fillStyle = stepColor(sky, kind, k);
      shapeBetween(ctx, g, a, bottom, 0, 1);
      ctx.fill();
      if (kind === 'water') {
        ctx.fillStyle = hex(mixColor(rgb('#1c2230'), sky.top, 0.3));
        ctx.globalAlpha = 0.28;
        shapeBetween(ctx, g, a, b, 0, 0.3);
        ctx.fill();
        ctx.fillStyle = '#f4efe0';
        ctx.globalAlpha = 0.14 * (1 - sky.night * 0.6);
        shapeBetween(ctx, g, a, b, 0.62, 0.12);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.lineWidth = Math.max(1, U * 0.3);
        ctx.strokeStyle = kind === 'gold' ? '#e6c46a' : '#6a9a4c';
        ctx.globalAlpha = 0.4 * (1 - sky.night * 0.6);
        strokeLine(ctx, g, a, b, 0.42);
        ctx.strokeStyle = kind === 'gold' ? '#8a6a28' : '#2f5a30';
        strokeLine(ctx, g, a, b, 0.74);
        ctx.globalAlpha = 1;
      }
      ctx.lineWidth = Math.max(1, U * (0.3 + 0.5 * (k / STEPS)));
      ctx.strokeStyle = tone(sky, '#4a3a2c', 0.55);
      ctx.globalAlpha = 0.5 + 0.5 * (k / STEPS);
      strokeLine(ctx, g, a, a, 0);
      ctx.globalAlpha = 1;
    }
  }

  function paintRidgeTrees(ctx, g, sky, plan, rand) {
    ctx.fillStyle = tone(sky, '#2f4a2c', 0.65);
    for (let x = 0; x <= g.W; x += g.U * 1.6) {
      const r = g.U * (0.9 + rand() * 1.2);
      const y = plan.ridge[Math.floor(x)] + g.U * (0.2 + rand() * 0.8);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.3);
      ctx.fill();
    }
  }

  // ---- wooden houses ------------------------------------------------------

  function paintHouse(g, sky, s) {
    const w = Math.ceil(14 * s);
    const h = Math.ceil(12.5 * s);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const cx = w / 2;
    const base = h - 1;
    const floor = base - s * 2.2;
    const wood = tone(sky, '#6a4a30', 0.6);
    const dark = tone(sky, '#3a2a1e', 0.5);
    ctx.fillStyle = dark;
    const post = Math.max(1, s * 0.5);
    for (let i = 0; i < 5; i++) ctx.fillRect(cx - s * 3.6 + i * s * 1.8, floor, post, base - floor);
    ctx.fillStyle = wood;
    ctx.fillRect(cx - s * 4, floor - s * 3.2, s * 8, s * 3.2);
    ctx.fillStyle = dark;
    ctx.globalAlpha = 0.5;
    for (let i = 1; i < 9; i++) ctx.fillRect(cx - s * 4 + i * s * 0.9, floor - s * 3.2, 1, s * 3.2);
    ctx.globalAlpha = 1;
    ctx.fillRect(cx - s * 4.6, floor - s * 0.4, s * 9.2, Math.max(1, s * 0.5));
    const lit = hex(mixColor(rgb('#2a2018'), rgb('#e0a83c'), sky.night * 0.95));
    ctx.fillStyle = lit;
    ctx.fillRect(cx - s * 3, floor - s * 2.4, s * 1.3, s * 1.3);
    ctx.fillRect(cx + s * 1.7, floor - s * 2.4, s * 1.3, s * 1.3);
    ctx.fillStyle = dark;
    ctx.fillRect(cx - s * 0.6, floor - s * 2.6, s * 1.2, s * 2.6);
    const eave = floor - s * 3.2;
    const tile = tone(sky, '#4b5260', 0.62);
    ctx.fillStyle = tile;
    ctx.beginPath();
    ctx.moveTo(cx - s * 6.6, eave + s * 0.4);
    ctx.quadraticCurveTo(cx - s * 4.4, eave - s * 0.3, cx - s * 3.4, eave - s * 3.2);
    ctx.lineTo(cx + s * 3.4, eave - s * 3.2);
    ctx.quadraticCurveTo(cx + s * 4.4, eave - s * 0.3, cx + s * 6.6, eave + s * 0.4);
    ctx.quadraticCurveTo(cx, eave + s * 1.1, cx - s * 6.6, eave + s * 0.4);
    ctx.fill();
    ctx.strokeStyle = tone(sky, '#2a2e3a', 0.5);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * s * 0.62, eave - s * 3.1);
      ctx.lineTo(cx + i * s * 1.15, eave + s * 0.6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = tile;
    ctx.beginPath();
    ctx.moveTo(cx - s * 3.4, eave - s * 3.1);
    ctx.quadraticCurveTo(cx - s * 2.4, eave - s * 3.6, cx - s * 1.7, eave - s * 5);
    ctx.lineTo(cx + s * 1.7, eave - s * 5);
    ctx.quadraticCurveTo(cx + s * 2.4, eave - s * 3.6, cx + s * 3.4, eave - s * 3.1);
    ctx.fill();
    ctx.fillStyle = tone(sky, '#20242e', 0.5);
    ctx.fillRect(cx - s * 1.9, eave - s * 5.15, s * 3.8, Math.max(1, s * 0.4));
    return c;
  }

  function paintBamboo(ctx, g, sky, bx, by, s) {
    ctx.strokeStyle = tone(sky, '#5a7a3a', 0.65);
    ctx.fillStyle = tone(sky, '#3c6a3a', 0.65);
    ctx.lineWidth = Math.max(1, s * 0.3);
    for (let i = 0; i < 4; i++) {
      const x = bx + i * s * 0.9;
      const top = by - s * (6 + (i % 2) * 2);
      ctx.beginPath();
      ctx.moveTo(x, by);
      ctx.lineTo(x + s * 0.3, top);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x + s * 0.3, top + s * 0.4, s * 1.1, s * 0.4, 0.4, 0, 6.3);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + s * 0.2, top + s * 2.2, s * 1.2, s * 0.4, -0.4, 0, 6.3);
      ctx.fill();
    }
  }

  function paintHouses(ctx, g, sky, plan) {
    state.chimneys = [];
    for (let i = 0; i < plan.houses.length; i++) {
      const hs = plan.houses[i];
      const x = Math.floor(g.W * hs.x);
      const d = plan.lines[hs.k + 1][x] - plan.lines[hs.k][x];
      const s = g.U * (1.0 + 1.0 * (hs.k / STEPS));
      const art = paintHouse(g, sky, s);
      const hx = x - art.width / 2;
      const base = plan.lines[hs.k + 1][x] - d * 0.12;
      const hy = base - art.height;
      paintBamboo(ctx, g, sky, hx + art.width * 0.92, base, s * 0.8);
      ctx.drawImage(art, hx, hy);
      const water = plan.lines[hs.k + 2][x] - plan.lines[hs.k + 1][x];
      ctx.save();
      ctx.beginPath();
      ctx.rect(hx, base, art.width, Math.max(2, water * 0.9));
      ctx.clip();
      ctx.translate(0, base * 2);
      ctx.scale(1, -1);
      ctx.globalAlpha = 0.3;
      ctx.drawImage(art, hx, hy);
      ctx.restore();
      if (i % 2 === 0) state.chimneys.push({ x: x + s * 1.2, y: hy + s * 3.2, s });
    }
  }

  // ---- bake ----------------------------------------------------------------

  function paintFront(g, sky, plan, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintTerraces(ctx, g, sky, plan);
    paintRidgeTrees(ctx, g, sky, plan, rand);
    paintHouses(ctx, g, sky, plan);
    return c;
  }

  function paintMist(w, h, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const density = (x, y) => fbm(x * 0.011, y * 0.05, 4, seed);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(density(x, y), density(x - c.width, y), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = 244;
        img.data[i + 1] = 241;
        img.data[i + 2] = 232;
        img.data[i + 3] = smoothstep(0.44, 0.66, v) * band * 235;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintPuff() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(236,232,220,0.55)');
    grad.addColorStop(1, 'rgba(236,232,220,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(31);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky, state.plan, rand);
    state.dim = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ---------------------------------------------------------------

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const a = Math.min(1, amount) * (0.9 - state.dim * 0.25);
    const hi = state.mistHigh;
    const lo = state.mistLow;
    ctx.globalAlpha = a;
    const o1 = -((t * g.U * 1.3) % hi.width);
    ctx.drawImage(hi, o1, g.H * 0.2);
    ctx.drawImage(hi, o1 + hi.width, g.H * 0.2);
    ctx.globalAlpha = a * 0.8;
    const o2 = -((t * g.U * 2.4) % lo.width);
    ctx.drawImage(lo, o2, g.H * 0.46);
    ctx.drawImage(lo, o2 + lo.width, g.H * 0.46);
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, g, t) {
    const list = state.plan.glints;
    const thin = Math.max(1, g.U * 0.4);
    ctx.fillStyle = '#f4efe0';
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      const pulse = Math.max(0, Math.sin(t * 0.9 + m.ph));
      ctx.globalAlpha = pulse * 0.85 * (1 - state.dim * 0.4);
      ctx.fillRect(m.x + Math.sin(t * 0.5 + m.ph) * g.U * 1.2, m.y, m.w, thin);
    }
    ctx.globalAlpha = 1;
  }

  function drawSmoke(ctx, g, t) {
    const list = state.chimneys;
    for (let c = 0; c < list.length; c++) {
      const ch = list[c];
      for (let i = 0; i < MAX_PUFFS / 2; i++) {
        const a = (t * 0.06 + i / (MAX_PUFFS / 2) + c * 0.37) % 1;
        const size = ch.s * (2 + a * 6);
        const dx = a * g.U * 5 + Math.sin(t * 0.5 + i + c) * g.U * 0.6;
        const dy = -a * g.U * 9;
        ctx.globalAlpha = (1 - a) * 0.7;
        ctx.drawImage(state.puff, ch.x + dx - size / 2, ch.y + dy - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.plan = planTerraces(g);
    state.mistHigh = paintMist(g.W * 1.4, g.H * 0.26, 21);
    state.mistLow = paintMist(g.W * 1.4, g.H * 0.3, 34);
    state.puff = paintPuff();
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.front, 0, 0);
    drawGlints(ctx, g, t);
    drawMist(ctx, g, t, props.mist);
    if (props.smoke) drawSmoke(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, smoke: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
