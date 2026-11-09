/*
 * 新幹線 Shinkansen — a bullet train gliding along its viaduct past rice fields.
 *
 * The eye rides beside the train, so the train is baked once and stays put while
 * everything else slides by at its own depth: far hills, near hills, paddies, the
 * viaduct wall, the catenary poles and the near paddies. Each of those is one
 * seamless strip baked from the clock once a minute and drawn twice per frame.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { mixColor, toHex, parseColor, rng } = K;

  const TAU = Math.PI * 2;
  const HORIZON = 0.5;
  const ROOF = 0.565;
  const BELLY = 0.72;
  const WALL = [0.705, 0.748];
  const GROUND = 0.8;
  const WIRE = [0.452, 0.478];
  const POLE_TOP = 0.43;
  const NOSE = [0.6, 0.885];
  const TIP_Y = 0.69;
  const PANTO = 0.3;
  const RETINT_SECONDS = 60;
  // Screen widths per second for each depth.
  const PACE = { far: 0.012, near: 0.035, fields: 0.11, wall: 0.42, poles: 0.46, front: 0.62 };
  const POLES_PER_TILE = 3;
  const RICE = {
    summer: ['#5d7a3e', '#6b8a46', '#4f6d38', '#7a9450', '#62803f'],
    autumn: ['#c49a46', '#b8893c', '#d0a957', '#a98a42', '#8a8a44'],
  };
  const NIGHT_INK = '#0c1020';
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const rgb = (h) => parseColor(h);

  // A colour as the current sky lights it, pulled toward haze with distance.
  function lit(hex, sky, dist, dark = 0.55) {
    const base = rgb(hex).map((v, i) => v * (0.5 + 0.5 * sky.amb[i] / 255));
    const far = mixColor(base, sky.haze, dist * (1 - sky.night * 0.7));
    return toHex(mixColor(far, rgb(NIGHT_INK), sky.night * dark));
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, toHex(sky.top));
    grad.addColorStop(1, toHex(sky.low));
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
    paintWisps(ctx, g, sky, rand);
    return c;
  }

  function paintWisps(ctx, g, sky, rand) {
    ctx.fillStyle = toHex(mixColor(rgb('#f2efe6'), sky.low, 0.35 + sky.night * 0.4));
    for (let i = 0; i < 7; i++) {
      const cx = rand() * g.W;
      const cy = g.H * (0.08 + rand() * 0.25);
      ctx.globalAlpha = 0.25 + rand() * 0.25;
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.ellipse(cx + (k - 2) * g.U * 4, cy + Math.sin(k) * g.U * 0.6, g.U * (5 + rand() * 5), g.U * (0.7 + rand() * 0.6), 0, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- strips that tile sideways ------------------------------------------

  // Sum of whole-period waves, so the strip joins itself at its width.
  function wave(x, w, terms) {
    let v = 0;
    for (const [k, a, p] of terms) v += a * Math.sin((x / w) * TAU * k + p);
    return v;
  }

  function ridgeStrip(g, sky, opts) {
    const w = g.TW;
    const c = layer(w, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = lit(opts.ink, sky, opts.dist, opts.dark);
    ctx.beginPath();
    ctx.moveTo(0, g.H * opts.base);
    for (let x = 0; x <= w; x++) {
      const y = g.H * (opts.top + wave(x, w, opts.terms));
      ctx.lineTo(x, Math.min(y, g.H * opts.base));
    }
    ctx.lineTo(w, g.H * opts.base);
    ctx.closePath();
    ctx.fill();
    if (opts.crowns) paintCrowns(ctx, g, sky, opts, w);
    return c;
  }

  // Tree crowns along the near ridge, placed on a whole-number spacing.
  function paintCrowns(ctx, g, sky, opts, w) {
    const rand = rng(7);
    const n = Math.round(w / (g.U * 2.2));
    const shades = [lit('#2e4230', sky, opts.dist * 0.6), lit('#4b6a3a', sky, opts.dist * 0.6), lit('#3a5634', sky, opts.dist)];
    for (let i = 0; i < n; i++) {
      const x = (i / n) * w;
      const y = g.H * (opts.top + wave(x, w, opts.terms));
      ctx.fillStyle = shades[i % 3];
      const r = g.U * (1 + rand() * 1.1);
      ctx.beginPath();
      ctx.arc(x, y + r * 0.4, r, 0, TAU);
      ctx.fill();
      if (x < r) {
        ctx.beginPath();
        ctx.arc(x + w, y + r * 0.4, r, 0, TAU);
        ctx.fill();
      }
    }
    paintHouses(ctx, g, sky, w);
  }

  function paintHouses(ctx, g, sky, w) {
    const roof = lit('#3b3f52', sky, 0.25);
    const wall = sky.night > 0.5 ? '#d9a95a' : lit('#d8d2c0', sky, 0.25);
    for (let i = 0; i < 4; i++) {
      const x = w * (0.12 + i * 0.25);
      const y = g.H * (HORIZON - 0.004);
      ctx.fillStyle = wall;
      ctx.fillRect(x, y - g.U * 1.6, g.U * 3, g.U * 1.6);
      ctx.fillStyle = roof;
      ctx.beginPath();
      ctx.moveTo(x - g.U * 0.6, y - g.U * 1.5);
      ctx.lineTo(x + g.U * 1.5, y - g.U * 2.8);
      ctx.lineTo(x + g.U * 3.6, y - g.U * 1.5);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Paddies in rows that deepen toward the viewer, with pale dikes between.
  function paddyStrip(g, sky, rice, top, bottom, rowStart, seed) {
    const w = g.TW;
    const c = layer(w, g.H);
    const ctx = c.getContext('2d');
    const rand = rng(seed);
    const dike = lit('#b8a888', sky, 0.15);
    const water = toHex(mixColor(mixColor(sky.low, rgb('#5a7672'), 0.5), rgb(NIGHT_INK), sky.night * 0.4));
    let y = g.H * top;
    let row = 0;
    while (y < g.H * bottom) {
      const h = g.U * (rowStart + row * 0.6);
      const plots = Math.max(2, Math.round(w / (g.U * (10 + row * 6))));
      for (let p = 0; p < plots; p++) {
        const x0 = (p / plots) * w;
        const pick = rand();
        ctx.fillStyle = pick < 0.06 ? water : lit(rice[Math.floor(rand() * rice.length)], sky, 0.08);
        ctx.fillRect(x0, y, w / plots + 1, h);
        ctx.fillStyle = dike;
        ctx.fillRect(x0, y, Math.max(1, g.U * 0.35), h);
        if (pick >= 0.06) paintFurrows(ctx, g, sky, x0, y, w / plots, h);
      }
      ctx.fillStyle = dike;
      ctx.fillRect(0, y, w, Math.max(1, g.U * 0.3));
      y += h;
      row++;
    }
    return c;
  }

  function paintFurrows(ctx, g, sky, x0, y, w, h) {
    ctx.fillStyle = lit('#2e4230', sky, 0);
    ctx.globalAlpha = 0.28;
    const step = Math.max(2, g.U * 0.9);
    for (let fy = y + step; fy < y + h - 1; fy += step) ctx.fillRect(x0, fy, w, 1);
    ctx.globalAlpha = 1;
  }

  // Viaduct wall and the piers under it; the fields show between the piers.
  function wallStrip(g, sky) {
    const w = g.TW;
    const c = layer(w, g.H);
    const ctx = c.getContext('2d');
    const top = g.H * WALL[0];
    const bot = g.H * WALL[1];
    const piers = 6;
    ctx.fillStyle = lit('#6a6c70', sky, 0.05);
    for (let i = 0; i < piers; i++) ctx.fillRect((i / piers) * w, bot, g.U * 3.2, g.H * GROUND - bot + 1);
    ctx.fillStyle = lit('#3a3c44', sky, 0);
    ctx.fillRect(0, bot, w, Math.max(1, g.U * 1.1));
    ctx.fillStyle = lit('#c9c6bc', sky, 0.05);
    ctx.fillRect(0, top, w, bot - top);
    ctx.fillStyle = lit('#e8e4d8', sky, 0);
    ctx.fillRect(0, top, w, Math.max(1, g.U * 0.6));
    ctx.fillStyle = lit('#8c8a84', sky, 0.05);
    const seams = piers * 2;
    for (let i = 0; i < seams; i++) ctx.fillRect((i / seams) * w, top, 1, bot - top);
    return c;
  }

  // ---- train -------------------------------------------------------------

  function noseTop(g, x) {
    const x0 = g.W * NOSE[0];
    const u = Math.min(1, Math.max(0, (x - x0) / (g.W * (NOSE[1] - NOSE[0]))));
    return g.H * (ROOF + (TIP_Y - ROOF) * Math.pow(u, 1.7));
  }

  function bodyPath(ctx, g) {
    const tip = g.W * NOSE[1];
    ctx.beginPath();
    ctx.moveTo(-2, g.H * ROOF);
    for (let x = g.W * NOSE[0]; x <= tip; x += 1) ctx.lineTo(x, noseTop(g, x));
    ctx.quadraticCurveTo(tip + g.U * 2.4, g.H * (TIP_Y + 0.012), tip - g.U * 0.5, g.H * BELLY);
    ctx.lineTo(-2, g.H * BELLY);
    ctx.closePath();
  }

  function paintTrain(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintPantograph(ctx, g, sky);
    bodyPath(ctx, g);
    ctx.fillStyle = lit('#efede6', sky, 0, 0.25);
    ctx.fill();
    ctx.save();
    bodyPath(ctx, g);
    ctx.clip();
    paintLivery(ctx, g, sky);
    ctx.restore();
    paintCockpit(ctx, g, sky);
    ctx.fillStyle = sky.night > 0.3 ? '#e8d7a0' : lit('#d6c58a', sky, 0);
    ctx.fillRect(g.W * NOSE[1] - g.U * 2.6, g.H * 0.7, g.U * 1.6, Math.max(1, g.U * 0.6));
    return c;
  }

  function paintLivery(ctx, g, sky) {
    const shade = lit('#b9b8b2', sky, 0, 0.3);
    ctx.fillStyle = shade;
    ctx.fillRect(0, g.H * ROOF, g.W, g.U * 0.8);
    ctx.fillRect(0, g.H * 0.698, g.W, g.H * (BELLY - 0.698));
    ctx.fillStyle = lit('#2c3f8c', sky, 0, 0.2);
    ctx.fillRect(0, g.H * 0.662, g.W, g.U * 1.6);
    ctx.fillStyle = lit('#3c5aa8', sky, 0, 0.2);
    ctx.fillRect(0, g.H * 0.684, g.W, Math.max(1, g.U * 0.5));
    paintWindows(ctx, g, sky);
    ctx.fillStyle = lit('#8c8a84', sky, 0);
    for (let f = 0.07; f < NOSE[0]; f += 0.27) ctx.fillRect(g.W * f, g.H * ROOF, 1, g.H * (BELLY - ROOF));
  }

  function paintWindows(ctx, g, sky) {
    const glass = sky.night > 0.35 ? '#e2ad50' : lit('#26304e', sky, 0);
    const top = g.H * 0.6;
    const h = g.H * 0.034;
    const step = g.U * 3.4;
    for (let x = 0; x < g.W * (NOSE[0] - 0.01); x += step) {
      const inCar = ((x / g.W) - 0.07 + 0.27) % 0.27;
      if (inCar < 0.03 || inCar > 0.255) {
        ctx.fillStyle = lit('#a8a6a0', sky, 0);
        ctx.fillRect(x, top - g.U * 0.6, g.U * 2, g.H * 0.09);
        continue;
      }
      ctx.fillStyle = glass;
      ctx.fillRect(x, top, g.U * 2.2, h);
    }
  }

  function paintCockpit(ctx, g, sky) {
    const x0 = g.W * (NOSE[0] + 0.02);
    const x1 = g.W * (NOSE[0] + 0.13);
    ctx.fillStyle = lit('#1e2638', sky, 0);
    ctx.beginPath();
    ctx.moveTo(x0, noseTop(g, x0) + g.U * 0.9);
    for (let x = x0; x <= x1; x += 1) ctx.lineTo(x, noseTop(g, x) + g.U * 0.7);
    for (let x = x1; x >= x0; x -= 1) ctx.lineTo(x, noseTop(g, x) + g.U * (2.6 - 1.2 * (x - x0) / (x1 - x0)));
    ctx.closePath();
    ctx.fill();
  }

  function paintPantograph(ctx, g, sky) {
    const x = g.W * PANTO;
    const roof = g.H * ROOF;
    const head = g.H * WIRE[1];
    ctx.strokeStyle = lit('#3a3c44', sky, 0);
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    ctx.beginPath();
    ctx.moveTo(x - g.U * 3, roof);
    ctx.lineTo(x + g.U * 1.5, (roof + head) / 2);
    ctx.lineTo(x - g.U * 1, head);
    ctx.stroke();
    ctx.fillStyle = lit('#3a3c44', sky, 0);
    ctx.fillRect(x - g.U * 3.5, head, g.U * 5, Math.max(1, g.U * 0.4));
    ctx.fillRect(x - g.U * 4, roof - g.U * 0.5, g.U * 3, g.U * 0.5);
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, props) {
    const sky = S.at(S.hour(props.time));
    const rice = RICE[props.season] || RICE.summer;
    state.sky = paintSky(g, sky, rng(31));
    state.far = ridgeStrip(g, sky, { ink: '#4f6286', dist: 0.55, dark: 0.45, base: HORIZON, top: 0.4, terms: [[2, 0.03, 0.4], [5, 0.018, 1.3], [11, 0.006, 2.1]] });
    state.near = ridgeStrip(g, sky, { ink: '#3f5934', dist: 0.25, dark: 0.75, base: HORIZON + 0.01, top: 0.455, terms: [[3, 0.02, 2.2], [7, 0.008, 0.6], [17, 0.003, 1.7]], crowns: true });
    state.fields = paddyStrip(g, sky, rice, HORIZON, GROUND, 0.7, 11);
    state.wall = wallStrip(g, sky);
    state.front = paddyStrip(g, sky, rice, GROUND, 1.02, 3.2, 23);
    state.train = paintTrain(g, sky);
    state.pole = lit('#2a2c34', sky, 0);
    state.choice = props.time;
    state.season = props.season;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function slide(ctx, strip, g, t, pace) {
    const off = -((t * pace * g.W) % strip.width);
    ctx.drawImage(strip, off, 0);
    ctx.drawImage(strip, off + strip.width, 0);
  }

  function drawCatenary(ctx, g, t) {
    const span = g.TW / POLES_PER_TILE;
    const off = (t * PACE.poles * g.W) % span;
    const mast = Math.max(1, g.U * 0.7);
    ctx.fillStyle = state.pole;
    ctx.fillRect(0, g.H * WIRE[0], g.W, 1);
    ctx.fillRect(0, g.H * WIRE[1], g.W, 1);
    for (let x = -off; x < g.W + span; x += span) {
      ctx.fillRect(x, g.H * POLE_TOP, mast, g.H * (WALL[1] - POLE_TOP));
      ctx.fillRect(x - g.U * 2.5, g.H * (WIRE[0] - 0.006), g.U * 3.2, Math.max(1, g.U * 0.5));
      for (let k = 1; k < 4; k++) ctx.fillRect(x + (span * k) / 4, g.H * WIRE[0], 1, g.H * (WIRE[1] - WIRE[0]));
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100, TW: Math.ceil(api.cols * 1.25) };
    state.g = g;
    repaint(g, api.props);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time || state.season !== props.season) repaint(g, props);
    ctx.drawImage(state.sky, 0, 0);
    slide(ctx, state.far, g, t, PACE.far);
    slide(ctx, state.near, g, t, PACE.near);
    slide(ctx, state.fields, g, t, PACE.fields);
    ctx.drawImage(state.train, 0, Math.sin(t * 1.7) * 0.25);
    slide(ctx, state.wall, g, t, PACE.wall);
    drawCatenary(ctx, g, t);
    slide(ctx, state.front, g, t, PACE.front);
  }

  Kasuri.run({
    defaults: { time: 'auto', season: 'summer', ramp: 'lines', cell: 7, boost: 0.15, gain: 1.05, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
