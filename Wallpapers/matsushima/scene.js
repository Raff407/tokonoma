/*
 * 松島 Matsushima — pine-topped islets in a misty bay.
 *
 * Sky, hills, water, reflections and islets are baked into layers and
 * repainted once a minute from the clock. Between repaints only mist,
 * water glints, a fishing boat and a few birds move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.43;
  const RETINT_SECONDS = 60;
  const GLINTS = 70;
  const BIRDS = 6;
  const BOAT_Y = 0.7;
  const BOAT_PERIOD = 70;

  // x and base are screen fractions, w and h the rock size, depth 0 near .. 1 far.
  const BACK = [
    { x: 0.2, base: 0.505, w: 0.15, h: 0.07, depth: 0.7, pines: 3, seed: 3 },
    { x: 0.7, base: 0.515, w: 0.19, h: 0.08, depth: 0.65, pines: 4, seed: 8 },
    { x: 0.9, base: 0.5, w: 0.14, h: 0.06, depth: 0.72, pines: 3, seed: 14 },
  ];
  const FRONT = [
    { x: 0.4, base: 0.625, w: 0.2, h: 0.13, depth: 0.35, pines: 5, seed: 21 },
    { x: 0.64, base: 0.635, w: 0.17, h: 0.11, depth: 0.3, pines: 4, seed: 27 },
    { x: 0.1, base: 0.82, w: 0.28, h: 0.2, depth: 0.05, pines: 6, seed: 33 },
    { x: 0.87, base: 0.86, w: 0.32, h: 0.17, depth: 0.0, pines: 6, seed: 40 },
  ];
  const state = { glints: [], birds: [] };

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (rgb) => toHex(rgb);
  const rgb = (h) => parseColor(h);

  // Colour as seen at a given depth and hour: hazier far away, darker at night.
  function seen(sky, base, depth) {
    const dusk = mixColor(rgb(base), sky.haze, 0.15 + depth * 0.7);
    return mixColor(dusk, rgb('#2a3354'), sky.night * 0.5);
  }

  // ---- sky and water -----------------------------------------------------

  function paintDisc(ctx, g, sky) {
    const night = sky.night > 0.5;
    const t = night ? S.moonT(sky.hour) : S.sunT(sky.hour);
    if (!night && (sky.hour < 5.8 || sky.hour > 19.6)) return;
    const cx = g.W * (0.18 + 0.64 * t);
    const cy = g.H * (HORIZON - 0.03) - Math.sin(Math.PI * t) * g.H * 0.3;
    const r = g.U * (night ? 2.6 : 3.4);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 6);
    glow.addColorStop(0, night ? 'rgba(220,222,236,0.3)' : 'rgba(255,236,200,0.5)');
    glow.addColorStop(1, 'rgba(255,236,200,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r * 6, cy - r * 6, r * 12, r * 12);
    ctx.fillStyle = night ? '#e6e4da' : '#f6ead0';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.3);
    ctx.fill();
  }

  function paintHills(ctx, g, sky) {
    const base = g.H * HORIZON;
    const rows = [
      { color: seen(sky, '#6a7690', 0.95), rise: 0.075, freq: 0.035, seed: 5, lift: 0.0 },
      { color: seen(sky, '#56627e', 0.82), rise: 0.055, freq: 0.05, seed: 17, lift: 0.0 },
    ];
    for (const r of rows) {
      ctx.fillStyle = hex(r.color);
      for (let x = 0; x < g.W; x++) {
        const edge = smoothstep(0, 0.12, x / g.W) * smoothstep(0, 0.1, 1 - x / g.W);
        const hgt = g.H * r.rise * (0.25 + fbm(x * r.freq, 1.5, 3, r.seed) * 1.2) * (0.5 + 0.5 * edge);
        ctx.fillRect(x, base - hgt, 1, hgt + 1);
      }
    }
  }

  function paintBack(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(mixColor(sky.low, sky.haze, 0.3)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H * HORIZON + 1);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintDisc(ctx, g, sky);
    paintHills(ctx, g, sky);
    // Water: pale at the horizon, deep indigo near the viewer.
    const water = ctx.createLinearGradient(0, g.H * HORIZON, 0, g.H);
    water.addColorStop(0, hex(mixColor(sky.low, sky.haze, 0.5)));
    water.addColorStop(0.35, hex(seen(sky, '#9ab0c0', 0.3)));
    water.addColorStop(1, hex(seen(sky, '#6f88a4', 0)));
    ctx.fillStyle = water;
    ctx.fillRect(0, g.H * HORIZON, g.W, g.H);
    return c;
  }

  // Wisps that tile sideways.
  function paintMistTile(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.012, y * 0.09, 4, 41), fbm((x - w) * 0.012, y * 0.09, 4, 41), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 240;
        img.data[i + 3] = smoothstep(0.38, 0.68, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Long streaks of light on the water that slide sideways.
  function paintRippleTile(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const near = 0.4 + (y / h) * 1.6;
      for (let x = 0; x < w; x++) {
        const a = fbm(x * 0.045 / near, y * 0.7, 3, 63);
        const b = fbm((x - w) * 0.045 / near, y * 0.7, 3, 63);
        const v = lerp(a, b, x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 246;
        img.data[i + 1] = 242;
        img.data[i + 2] = 230;
        img.data[i + 3] = smoothstep(0.56, 0.68, v) * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- islets ------------------------------------------------------------

  function paintPine(ctx, px, top, s, tint, rand) {
    const lean = (rand() - 0.5) * s * 0.5;
    ctx.fillStyle = tint.bark;
    ctx.fillRect(px, top - s * 2.2, Math.max(1, s * 0.22), s * 2.3);
    const tiers = 3 + Math.floor(rand() * 2);
    for (let i = 0; i < tiers; i++) {
      const k = i / (tiers - 1);
      const cy = top - s * (1.2 + k * 2.6);
      const rx = s * (1.5 - k * 0.8) * (0.85 + rand() * 0.3);
      const cx = px + lean * k + (i % 2 ? 1 : -1) * s * 0.35;
      ctx.fillStyle = tint.leaf;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, s * 0.5, 0, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = tint.light;
      ctx.beginPath();
      ctx.ellipse(cx, cy - s * 0.18, rx * 0.7, s * 0.26, 0, 0, 6.3);
      ctx.fill();
    }
  }

  // One islet on its own canvas; the bottom edge sits on the waterline.
  function paintIslet(g, spec, sky) {
    const rand = K.rng(spec.seed);
    const w = Math.ceil(g.W * spec.w);
    const rockH = g.H * spec.h;
    const s = g.U * (1.2 + (1 - spec.depth) * 1.0);
    const pad = Math.ceil(s * 7);
    const c = layer(w + 4, rockH + pad + 2);
    const ctx = c.getContext('2d');
    const baseY = c.height - 1;
    const rock = seen(sky, '#4a5268', spec.depth);
    const cap = seen(sky, '#4c6a48', spec.depth);
    const tint = {
      leaf: hex(seen(sky, '#274a36', spec.depth)),
      light: hex(seen(sky, '#55794a', spec.depth)),
      bark: hex(seen(sky, '#3a2c28', spec.depth)),
    };
    const tops = [];
    for (let x = 0; x < w; x++) {
      const u = (x / (w - 1)) * 2 - 1;
      const dome = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 2.6)), 0.5);
      const hgt = rockH * dome * (0.6 + fbm(x * 0.14, spec.seed, 3, spec.seed) * 0.8);
      tops.push(baseY - hgt);
      for (let y = baseY - hgt; y <= baseY; y++) {
        const band = fbm(x * 0.08, y * 0.35, 3, spec.seed + 2);
        const f = (baseY - y) / Math.max(1, hgt);
        let col = mixColor(rock, rgb('#c9c2ae'), (band > 0.62 ? 0.16 : 0) + (1 - f) * 0.1 + (f > 0.6 ? 0.1 : 0));
        if (f > 0.9 && hgt > 2) col = cap;
        if (y > baseY - Math.max(1, g.U * 0.5)) col = mixColor(col, rgb('#d8d8d0'), 0.25);
        ctx.fillStyle = hex(col);
        ctx.fillRect(x + 2, y, 1, 1);
      }
    }
    for (let i = 0; i < spec.pines; i++) {
      const x = Math.floor(w * (0.12 + (0.76 * (i + rand() * 0.6)) / spec.pines));
      const size = s * (0.7 + rand() * 0.7);
      paintPine(ctx, x + 2, tops[Math.min(w - 1, x)] + 1, size, tint, rand);
    }
    return c;
  }

  // Draws the islet and a faded, rippled copy upside down in the water.
  function placeIslet(front, back, g, spec, sky) {
    const c = paintIslet(g, spec, sky);
    const ox = Math.round(g.W * spec.x - c.width / 2);
    const by = Math.round(g.H * spec.base);
    const oy = by - c.height;
    back.globalAlpha = 0.24 - spec.depth * 0.08;
    for (let r = 0; r < c.height; r++) {
      const wob = Math.round(Math.sin(r * 0.9 + spec.seed) * 1.2);
      back.drawImage(c, 0, c.height - 1 - r, c.width, 1, ox + wob, by + r, c.width, 1);
    }
    back.globalAlpha = 1;
    front.drawImage(c, ox, oy);
  }

  function paintBridge(ctx, back, g, sky) {
    const a = FRONT[0];
    const b = FRONT[1];
    const xa = g.W * (a.x + a.w * 0.5) - g.U * 1.5;
    const xb = g.W * (b.x - b.w * 0.5) + g.U * 1.5;
    const ya = g.H * a.base - g.H * a.h * 0.28;
    const yb = g.H * b.base - g.H * b.h * 0.28;
    const arch = g.U * 2.2;
    const red = seen(sky, '#b8402a', 0.2);
    const dark = seen(sky, '#6a2a22', 0.2);
    const deckY = (t) => lerp(ya, yb, t) - Math.sin(Math.PI * t) * arch;
    const n = Math.max(2, Math.round(xb - xa));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = xa + (xb - xa) * t;
      const dy = deckY(t);
      ctx.fillStyle = hex(dark);
      ctx.fillRect(px, dy, 1, Math.max(1, g.U * 0.5));
      ctx.fillStyle = hex(red);
      ctx.fillRect(px, dy - g.U * 1.3, 1, 1);
      if (i % 3 === 0) ctx.fillRect(px, dy - g.U * 1.3, 1, g.U * 1.3);
    }
    ctx.fillStyle = hex(red);
    ctx.fillRect(xa, ya - g.U * 1.7, Math.max(1, g.U * 0.5), g.U * 1.9);
    ctx.fillRect(xb, yb - g.U * 1.7, Math.max(1, g.U * 0.5), g.U * 1.9);
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(37);
    const back = paintBack(g, sky, rand);
    const bctx = back.getContext('2d');
    for (const spec of BACK) placeIslet(bctx, bctx, g, spec, sky);
    const front = layer(g.W, g.H);
    const fctx = front.getContext('2d');
    for (const spec of FRONT) placeIslet(fctx, bctx, g, spec, sky);
    paintBridge(fctx, bctx, g, sky);
    state.back = back;
    state.front = front;
    state.mistAlpha = 0.55 - sky.night * 0.3;
    state.glint = sky.night > 0.5 ? '#d8dcea' : '#f4efe0';
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.mist;
    const o1 = -((t * g.U * 1.6) % c.width);
    const o2 = -(c.width - ((t * g.U * 1.1) % c.width));
    ctx.globalAlpha = Math.min(1, state.mistAlpha * amount);
    ctx.drawImage(c, o1, g.H * 0.38);
    ctx.drawImage(c, o1 + c.width, g.H * 0.38);
    ctx.globalAlpha = Math.min(1, state.mistAlpha * amount * 0.7);
    ctx.drawImage(c, o2, g.H * 0.56);
    ctx.drawImage(c, o2 + c.width, g.H * 0.56);
    ctx.globalAlpha = 1;
  }

  function drawRipples(ctx, g, t) {
    const c = state.ripple;
    const y0 = g.H * HORIZON;
    const o1 = -((t * g.U * 2.2) % c.width);
    const o2 = -(c.width - ((t * g.U * 1.3) % c.width));
    ctx.globalAlpha = 0.55 * (1 - state.night * 0.6);
    ctx.drawImage(c, o1, y0);
    ctx.drawImage(c, o1 + c.width, y0);
    ctx.globalAlpha = 0.3 * (1 - state.night * 0.6);
    ctx.drawImage(c, o2, y0 + g.U * 3);
    ctx.drawImage(c, o2 + c.width, y0 + g.U * 3);
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, g, t) {
    ctx.fillStyle = state.glint;
    for (let i = 0; i < GLINTS; i++) {
      const p = state.glints[i];
      const a = Math.sin(t * p.rate + p.phase);
      if (a <= 0) continue;
      ctx.globalAlpha = a * (0.25 + p.y * 0.3);
      ctx.fillRect(g.W * p.x + Math.sin(t * 0.3 + p.phase) * g.U * 0.6, g.H * (HORIZON + 0.04 + p.y * 0.5), g.U * (1 + p.size * 2.5 * (0.4 + p.y)), 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawBoat(ctx, g, t) {
    const p = (t / BOAT_PERIOD) % 1;
    const bx = lerp(-g.W * 0.06, g.W * 1.04, p);
    const by = g.H * BOAT_Y + Math.sin(t * 0.8) * 0.4;
    const s = g.U;
    const dim = 1 - state.night * 0.55;
    ctx.fillStyle = `rgba(228,232,238,${0.35 * dim})`;
    ctx.fillRect(bx - s * 8, by + s * 0.2, s * 6, 1);
    ctx.fillRect(bx - s * 6, by + s * 0.9, s * 4, 1);
    ctx.fillStyle = state.night > 0.5 ? '#1c2038' : '#2a2c3c';
    ctx.fillRect(bx - s * 2.6, by - s * 0.4, s * 5.4, s * 0.8);
    ctx.fillRect(bx + s * 2.6, by - s * 0.9, s * 0.6, s * 0.6);
    ctx.fillStyle = state.night > 0.5 ? '#6a6a7a' : '#c9c2ae';
    ctx.fillRect(bx - s * 1, by - s * 1.6, s * 2, s * 1.2);
    ctx.fillStyle = '#8a3a2c';
    ctx.fillRect(bx - s * 1.2, by - s * 1.9, s * 2.4, Math.max(1, s * 0.4));
  }

  function drawBirds(ctx, g, t) {
    ctx.strokeStyle = state.night > 0.5 ? 'rgba(200,204,220,0.5)' : 'rgba(40,44,64,0.7)';
    ctx.lineWidth = 1;
    for (let i = 0; i < BIRDS; i++) {
      const b = state.birds[i];
      const p = ((t * b.speed + b.off) % 1);
      const bx = lerp(-g.W * 0.05, g.W * 1.05, p);
      const by = g.H * (b.y + Math.sin(t * 0.5 + i) * 0.01);
      const flap = Math.sin(t * 5 + i * 2) * g.U * 0.7;
      ctx.beginPath();
      ctx.moveTo(bx - g.U * 1.3, by - flap);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + g.U * 1.3, by - flap);
      ctx.stroke();
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.ripple = paintRippleTile(Math.ceil(g.W * 1.2), Math.ceil(g.H * (1 - HORIZON)));
    state.mist = paintMistTile(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.22));
    const rand = K.rng(91);
    state.glints = [];
    for (let i = 0; i < GLINTS; i++) {
      state.glints.push({ x: rand(), y: rand(), size: rand(), rate: 0.5 + rand() * 0.9, phase: rand() * 6.3 });
    }
    state.birds = [];
    for (let i = 0; i < BIRDS; i++) {
      state.birds.push({ y: 0.14 + rand() * 0.14, speed: 0.02 + rand() * 0.012, off: rand() });
    }
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.back, 0, 0);
    drawBirds(ctx, g, t);
    drawMist(ctx, g, t, props.mist);
    drawRipples(ctx, g, t);
    drawGlints(ctx, g, t);
    if (props.boat) drawBoat(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, boat: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
