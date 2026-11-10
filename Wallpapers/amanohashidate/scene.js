/*
 * 天橋立 Amanohashidate — a long pine spit laid across a calm bay.
 *
 * Sky, far hills, water and reflections are baked into one layer, the near
 * hills, spit and pines into another, and both are repainted once a minute
 * from the clock. Between repaints only clouds, water glints, a small boat
 * and three gulls move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.47;
  const SHORE = 0.585;
  const SPIT = { x0: 0.16, x1: 0.9, y: 0.575 };
  const RETINT_SECONDS = 60;
  const GLINTS = 90;
  const BOAT_LAP = 55;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // The spit bends gently, a little lower in the middle.
  function spitY(g, x) {
    const f = (x / g.W - SPIT.x0) / (SPIT.x1 - SPIT.x0);
    return g.H * (SPIT.y + 0.012 * Math.sin(f * 3.1) - 0.006 * f);
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.36, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintLuminary(ctx, g, sky);
    return c;
  }

  function paintLuminary(ctx, g, sky) {
    const night = sky.night > 0.5;
    const t = night ? S.moonT(sky.hour) : S.sunT(sky.hour);
    const px = g.W * (0.2 + 0.6 * t);
    const py = g.H * (HORIZON - 0.04 - 0.3 * Math.sin(t * Math.PI));
    const r = g.U * (night ? 3 : 4);
    const glow = ctx.createRadialGradient(px, py, 0, px, py, r * 5);
    const tint = night ? 'rgba(220,222,214,' : 'rgba(250,232,190,';
    glow.addColorStop(0, tint + (night ? 0.3 : 0.4) + ')');
    glow.addColorStop(1, tint + '0)');
    ctx.fillStyle = glow;
    ctx.fillRect(px - r * 5, py - r * 5, r * 10, r * 10);
    ctx.fillStyle = night ? '#e8e6d8' : '#f6e6bc';
    ctx.beginPath();
    ctx.arc(px, py, r, 0, 6.3);
    ctx.fill();
    state.lightX = px;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.012, y * 0.08, 4, 21);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 244;
        img.data[i + 3] = smoothstep(0.54, 0.72, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- hills -------------------------------------------------------------

  function hillColor(sky, base, haze) {
    const day = mixColor(rgb(base), sky.haze, haze);
    return hex(mixColor(day, rgb('#37415f'), sky.night * 0.6));
  }

  function fillRidge(ctx, g, ridge, bottom, color) {
    ctx.fillStyle = color;
    for (let x = 0; x < g.W; x++) {
      const top = ridge(x);
      if (top < bottom) ctx.fillRect(x, top, 1, bottom - top + 1);
    }
  }

  function farRidge(g, x, seed, lift, amp) {
    const edge = 0.5 + 0.5 * Math.cos((x / g.W) * 6.28 * 0.9 + seed);
    return g.H * (HORIZON - lift - amp * edge) - (fbm(x * 0.03, seed, 3, seed + 4) - 0.5) * g.U * 3;
  }

  function paintFarHills(ctx, g, sky) {
    const base = g.H * HORIZON;
    fillRidge(ctx, g, (x) => farRidge(g, x, 2.1, 0.01, 0.1), base, hillColor(sky, '#5d7488', 0.5));
    fillRidge(ctx, g, (x) => farRidge(g, x + g.W * 0.3, 0.4, 0, 0.065), base, hillColor(sky, '#476266', 0.35));
    // Mist lies along the foot of the far hills.
    const mist = ctx.createLinearGradient(0, base - g.H * 0.07, 0, base + g.H * 0.01);
    const m = hex(mixColor(sky.low, sky.amb, 0.4));
    mist.addColorStop(0, 'rgba(255,255,255,0)');
    mist.addColorStop(1, m);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = mist;
    ctx.fillRect(0, base - g.H * 0.07, g.W, g.H * 0.08);
    ctx.globalAlpha = 1;
  }

  // ---- water -------------------------------------------------------------

  function paintWater(ctx, g, sky, rand) {
    const top = g.H * HORIZON;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, hex(mixColor(sky.low, sky.haze, 0.3)));
    grad.addColorStop(0.5, hex(mixColor(mixColor(sky.top, rgb('#4a6f84'), 0.45), sky.low, 0.2)));
    grad.addColorStop(1, hex(mixColor(mixColor(sky.top, rgb('#26485e'), 0.6), rgb('#101626'), sky.night * 0.5)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    // Faint long ripples, wider toward the viewer.
    ctx.fillStyle = hex(mixColor(sky.amb, rgb('#ffffff'), 0.4));
    for (let i = 0; i < 70; i++) {
      const f = rand();
      const y = top + (g.H - top) * (f * f);
      ctx.globalAlpha = (0.05 + rand() * 0.07) * (1 - sky.night * 0.6);
      ctx.fillRect(rand() * g.W, y, g.U * (2 + f * 8 + rand() * 3), 1);
    }
    ctx.globalAlpha = 1;
  }

  function reflect(ctx, baseY, alpha, paint) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(0, baseY * 2);
    ctx.scale(1, -1);
    paint();
    ctx.restore();
  }

  // ---- pines -------------------------------------------------------------

  // A cloud-pruned pine: a leaning trunk and two or three flat tufts.
  function paintPine(ctx, x, base, h, lean, leaf, trunk) {
    ctx.strokeStyle = trunk;
    ctx.lineWidth = Math.max(1, h * 0.09);
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x + lean * h * 0.4, base - h * 0.75);
    ctx.stroke();
    ctx.fillStyle = leaf;
    const tiers = h > 3.5 ? 3 : 2;
    for (let k = 0; k < tiers; k++) {
      const f = (k + 1) / tiers;
      const cy = base - h * (0.38 + 0.52 * f);
      const cx = x + lean * h * (0.15 + 0.35 * f) + (k % 2 ? -1 : 1) * h * 0.12;
      ctx.beginPath();
      ctx.ellipse(cx, cy, h * (0.46 - k * 0.07), h * 0.17, 0, 0, 6.3);
      ctx.fill();
    }
  }

  function pineColors(sky, lift) {
    const leaf = hex(mixColor(mixColor(rgb('#2f4a35'), sky.haze, 0.1 + lift), rgb('#222c40'), sky.night * 0.6));
    const trunk = hex(mixColor(rgb('#3a2c24'), rgb('#12141c'), sky.night * 0.7));
    return [leaf, trunk];
  }

  function paintSpitPines(ctx, g, sky, seed) {
    const rand = K.rng(seed);
    const [leaf, trunk] = pineColors(sky, 0.05);
    const x0 = g.W * SPIT.x0;
    const x1 = g.W * SPIT.x1;
    for (let x = x0; x < x1; x += g.U * (0.7 + rand() * 0.7)) {
      const edge = Math.min(smoothstep(0, 0.08, (x - x0) / (x1 - x0)), smoothstep(0, 0.08, (x1 - x) / (x1 - x0)));
      const h = g.U * (3.4 + rand() * 3.6) * (0.55 + 0.45 * edge);
      paintPine(ctx, x, spitY(g, x), h, (rand() - 0.5) * 0.9, leaf, trunk);
    }
  }

  function paintSpit(ctx, g, sky, seed) {
    const sand = hex(mixColor(mixColor(rgb('#d8cdb2'), sky.amb, 0.3), rgb('#6a7498'), sky.night * 0.6));
    ctx.fillStyle = sand;
    const x0 = Math.floor(g.W * SPIT.x0);
    const x1 = Math.ceil(g.W * SPIT.x1);
    for (let x = x0; x < x1; x++) {
      const taper = Math.min(smoothstep(0, 0.06, (x - x0) / (x1 - x0)), smoothstep(0, 0.06, (x1 - x) / (x1 - x0)));
      const hh = Math.max(1, g.U * 1.3 * taper);
      ctx.fillRect(x, spitY(g, x) - 0.2 * g.U, 1, hh);
    }
    paintSpitPines(ctx, g, sky, seed);
  }

  // ---- near land ---------------------------------------------------------

  function nearRidge(g, x, side) {
    const span = g.W * (side < 0 ? 0.36 : 0.3);
    const d = side < 0 ? x / span : (g.W - x) / span;
    const peak = side < 0 ? 0.3 : 0.36;
    const t = Math.max(0, 1 - d);
    const y = lerp(SHORE, peak, Math.pow(t, 1.25));
    return g.H * y + (fbm(x * 0.05, side, 3, 17) - 0.5) * g.U * 2.4;
  }

  function paintNearHills(ctx, g, sky, rand) {
    const moss = hillColor(sky, '#3b5640', 0.18);
    const deep = hillColor(sky, '#2a4033', 0.1);
    for (const side of [-1, 1]) {
      const from = side < 0 ? 0 : Math.floor(g.W * 0.7);
      const to = side < 0 ? Math.ceil(g.W * 0.36) : g.W;
      for (let x = from; x < to; x++) {
        const top = nearRidge(g, x, side);
        if (top >= g.H * SHORE) continue;
        const bottom = g.H * SHORE + g.U * 0.6;
        const grad = ctx.createLinearGradient(0, top, 0, bottom);
        grad.addColorStop(0, moss);
        grad.addColorStop(1, deep);
        ctx.fillStyle = grad;
        ctx.fillRect(x, top, 1, bottom - top);
      }
      paintHillPines(ctx, g, sky, rand, from, to, side);
    }
  }

  function paintHillPines(ctx, g, sky, rand, from, to, side) {
    const [leaf, trunk] = pineColors(sky, 0.02);
    for (let x = from; x < to; x += g.U * (1 + rand() * 1.4)) {
      const top = nearRidge(g, x, side);
      const bottom = g.H * SHORE;
      if (top >= bottom - g.U) continue;
      const y = top + (bottom - top) * Math.pow(rand(), 0.8);
      paintPine(ctx, x, y + g.U, g.U * (2.4 + rand() * 2.6), (rand() - 0.5), leaf, trunk);
    }
    // A bare sandy foot where each hill meets the bay.
    ctx.fillStyle = hex(mixColor(mixColor(rgb('#cfc4a8'), sky.amb, 0.25), rgb('#6a7498'), sky.night * 0.6));
    for (let x = from; x < to; x++) {
      const top = nearRidge(g, x, side);
      if (top < g.H * SHORE) ctx.fillRect(x, g.H * SHORE, 1, Math.max(1, g.U * 0.5));
    }
  }

  // A small vermilion gate at the root of the spit.
  function paintTorii(ctx, g, sky) {
    const s = g.U;
    const x = g.W * 0.205;
    const y = spitY(g, x);
    ctx.fillStyle = hex(mixColor(rgb('#b8412c'), rgb('#2a1a1c'), sky.night * 0.6));
    ctx.fillRect(x - s * 1.4, y - s * 4.6, Math.max(1, s * 0.5), s * 4.6);
    ctx.fillRect(x + s * 0.9, y - s * 4.6, Math.max(1, s * 0.5), s * 4.6);
    ctx.fillRect(x - s * 2, y - s * 5.3, s * 4.4, Math.max(1, s * 0.6));
    ctx.fillRect(x - s * 1.5, y - s * 3.7, s * 3.4, Math.max(1, s * 0.35));
  }

  // Needles and bark of a pine bough hanging in from the upper right.
  function paintBough(ctx, g, sky, rand) {
    const bark = hex(mixColor(rgb('#3a2c24'), rgb('#12141c'), sky.night * 0.7));
    const needle = hex(mixColor(mixColor(rgb('#34503a'), sky.haze, 0.05), rgb('#222c40'), sky.night * 0.6));
    const pts = [[1.02, -0.02], [0.9, 0.05], [0.8, 0.075], [0.7, 0.13]];
    ctx.strokeStyle = bark;
    ctx.lineWidth = Math.max(1.5, g.U * 1.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(g.W * pts[0][0], g.H * pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(g.W * pts[i][0], g.H * pts[i][1]);
    ctx.stroke();
    ctx.strokeStyle = needle;
    ctx.lineWidth = 1;
    for (let i = 1; i < pts.length; i++) {
      const cx = g.W * pts[i][0];
      const cy = g.H * pts[i][1];
      for (let k = 0; k < 26; k++) {
        const a = rand() * 6.28;
        const len = g.U * (2 + rand() * 2.2);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.8 + len * 0.2);
        ctx.stroke();
      }
    }
  }

  // ---- bake --------------------------------------------------------------

  function paintBack(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintFarHills(ctx, g, sky);
    paintWater(ctx, g, sky, rand);
    const horizon = g.H * HORIZON;
    reflect(ctx, horizon, 0.28, () => paintFarHills(ctx, g, sky));
    return c;
  }

  function paintFront(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const rand = K.rng(41);
    // Reflections go down first, then the land that casts them.
    const sandY = spitY(g, g.W * 0.5);
    reflect(ctx, sandY, 0.3, () => paintSpitPines(ctx, g, sky, 53));
    reflect(ctx, sandY, 0.35, () => paintSpit(ctx, g, sky, 53));
    paintNearHills(ctx, g, sky, rand);
    paintSpit(ctx, g, sky, 53);
    paintTorii(ctx, g, sky);
    paintBough(ctx, g, sky, rand);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(31);
    state.sky = paintSky(g, sky, rand);
    state.back = paintBack(g, sky, rand);
    state.front = paintFront(g, sky);
    state.cloudAlpha = 0.7 - sky.night * 0.25;
    state.dim = sky.night;
    state.glint = hex(mixColor(sky.amb, rgb('#ffffff'), 0.5));
    state.sail = hex(mixColor(rgb('#ece6d4'), rgb('#9aa2c0'), sky.night * 0.7));
    state.hull = hex(mixColor(rgb('#4a3426'), rgb('#14161e'), sky.night * 0.7));
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 4.5) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.03);
    ctx.drawImage(c, off + c.width, g.H * 0.03);
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, g, t) {
    ctx.fillStyle = state.glint;
    const glints = state.glints;
    for (let i = 0; i < GLINTS; i++) {
      const s = glints[i];
      const a = Math.sin(t * s.rate + s.phase);
      if (a < 0.2) continue;
      ctx.globalAlpha = (a - 0.2) * 0.9 * (1 - state.dim * 0.2);
      ctx.fillRect(s.x, s.y, s.w, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawBoat(ctx, g, t) {
    const u = g.U * 1.4;
    const p = (t % BOAT_LAP) / BOAT_LAP;
    const x = lerp(-u * 8, g.W + u * 8, p);
    const y = g.H * 0.74 + Math.sin(t * 0.9) * u * 0.25;
    ctx.fillStyle = state.hull;
    ctx.fillRect(x - u * 2.2, y - u * 0.6, u * 4.4, u * 0.9);
    ctx.fillStyle = state.sail;
    ctx.beginPath();
    ctx.moveTo(x - u * 0.2, y - u * 0.6);
    ctx.lineTo(x - u * 0.2, y - u * 5);
    ctx.lineTo(x + u * 1.9, y - u * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = state.hull;
    ctx.fillRect(x - u * 2, y + u * 0.4, u * 4, Math.max(1, u * 0.5));
    ctx.globalAlpha = 1;
  }

  function drawGulls(ctx, g, t) {
    ctx.strokeStyle = state.sail;
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const x = ((t * g.U * (4 + i * 0.8) + i * g.W * 0.37) % (g.W * 1.2)) - g.W * 0.1;
      const y = g.H * (0.2 + i * 0.045) + Math.sin(t * 0.5 + i * 2) * g.U;
      const flap = Math.sin(t * 5 + i) * g.U * 0.5;
      ctx.beginPath();
      ctx.moveTo(x - g.U * 1.3, y - flap);
      ctx.lineTo(x, y + g.U * 0.2);
      ctx.lineTo(x + g.U * 1.3, y - flap);
      ctx.stroke();
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.3));
    const rand = K.rng(7);
    state.glints = [];
    for (let i = 0; i < GLINTS; i++) {
      const f = rand();
      state.glints.push({
        x: rand() * g.W,
        y: g.H * (HORIZON + 0.03) + (g.H * 0.45) * f * f,
        w: Math.max(1, g.U * (1 + f * 3)),
        rate: 1.2 + rand() * 1.5,
        phase: rand() * 6.3,
      });
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
    drawGlints(ctx, g, t);
    if (props.boat) drawBoat(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawGulls(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', clouds: 1, boat: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
