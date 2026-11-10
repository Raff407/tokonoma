/*
 * 大内宿 Ouchi-juku — a post town of thatched houses along a snowy street.
 *
 * Sky, hills, cedars, street and houses are baked into one layer and repainted
 * once a minute from the clock, so windows glow as the light fades. Between
 * repaints only snowflakes, hearth smoke and a gentle ember glow move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { lerp, mixColor, toHex, parseColor, smoothstep, fbm } = K;

  const VX = 0.5;
  const VY = 0.5;
  const CAM = 0.4;
  const RETINT_SECONDS = 60;
  const MAX_FLAKES = 320;
  const MAX_SMOKE = 6;

  // Lateral offsets in screen widths, heights in screen heights.
  const WALL_X = 0.3;
  const EAVE_X = 0.26;
  const RIDGE_X = 0.4;
  const BACK_X = 0.58;
  const WALL_Y = 0.15;
  const RIDGE_Y = 0.62;

  // Houses from far to near: depth range, side, window layout.
  const HOUSES = [
    { side: -1, s0: 0.095, s1: 0.057, win: [0.3, 0.7] },
    { side: 1, s0: 0.124, s1: 0.071, win: [0.4] },
    { side: -1, s0: 0.181, s1: 0.110, win: [0.25, 0.6] },
    { side: 1, s0: 0.208, s1: 0.133, win: [0.3, 0.75] },
    { side: -1, s0: 0.285, s1: 0.190, win: [0.2, 0.55, 0.8] },
    { side: 1, s0: 0.323, s1: 0.219, win: [0.5] },
    { side: -1, s0: 0.427, s1: 0.303, win: [0.3, 0.7] },
    { side: 1, s0: 0.475, s1: 0.342, win: [0.2, 0.55, 0.85] },
    { side: -1, s0: 0.647, s1: 0.475, win: [0.25, 0.6] },
    { side: 1, s0: 0.722, s1: 0.532, win: [0.35, 0.7] },
    { side: -1, s0: 0.997, s1: 0.722, win: [0.3, 0.7] },
    { side: 1, s0: 1.122, s1: 0.817, win: [0.25, 0.6] },
  ];
  const SMOKERS = [3, 6, 8, 9];

  const state = {};
  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Screen point for lateral X, height Y and depth scale s.
  function P(g, X, Y, s) {
    return [g.W * (VX + X * s), g.H * (VY + (CAM - Y) * s)];
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  // Colour with ambient light, night darkening and distance haze.
  function tone(sky, base, s, nightMix) {
    let c = mixColor(rgb(base), sky.amb, 0.2);
    c = mixColor(c, rgb('#161a34'), sky.night * (nightMix === undefined ? 0.4 : nightMix));
    return hex(mixColor(c, sky.haze, 0.5 * Math.pow(Math.max(0, 1 - s), 1.2)));
  }

  function snowTone(sky, s) {
    let c = mixColor(rgb('#eef1f6'), sky.amb, 0.35);
    c = mixColor(c, rgb('#7284b8'), sky.night * 0.6);
    return hex(mixColor(c, sky.haze, 0.45 * Math.pow(Math.max(0, 1 - s), 1.2)));
  }

  // ---- sky and hills -----------------------------------------------------

  function paintSky(ctx, g, sky, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * VY);
    grad.addColorStop(0, hex(mixColor(sky.top, rgb('#6e7480'), 0.18)));
    grad.addColorStop(1, hex(mixColor(sky.low, rgb('#c9ccd4'), 0.25)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.2) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.35; i++) {
        ctx.globalAlpha = sky.night * (0.1 + rand() * 0.35);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
  }

  function paintHills(ctx, g, sky) {
    const base = g.H * VY;
    for (let layerIx = 0; layerIx < 2; layerIx++) {
      const far = layerIx === 0;
      const amp = far ? 0.15 : 0.085;
      const col = far ? mixColor(rgb('#7886a6'), sky.haze, 0.55) : mixColor(rgb('#58688e'), sky.haze, 0.4);
      const dark = mixColor(col, rgb('#171b34'), sky.night * 0.5);
      const snow = mixColor(mixColor(rgb('#e6eaf2'), sky.amb, 0.3), rgb('#5a6896'), sky.night * 0.55);
      for (let x = 0; x < g.W; x++) {
        const u = x / g.W;
        const bump = fbm(u * (far ? 3.2 : 5.5), far ? 1 : 7, 3, far ? 41 : 43);
        const edge = Math.pow(Math.abs(u - 0.5) * 2, 0.8);
        const top = base - g.H * (amp * (0.35 + bump * 0.9) * (0.45 + 0.9 * edge));
        ctx.fillStyle = hex(dark);
        ctx.fillRect(x, top, 1, base - top + 2);
        ctx.fillStyle = hex(mixColor(snow, sky.haze, far ? 0.4 : 0.2));
        ctx.fillRect(x, top, 1, (base - top) * (far ? 0.55 : 0.4));
      }
    }
  }

  function paintCedar(ctx, g, sky, cx, base, h) {
    const w = h * 0.34;
    const moss = hex(mixColor(mixColor(rgb('#2f4a3a'), sky.haze, 0.4), rgb('#10182a'), sky.night * 0.55));
    const white = snowTone(sky, 0.2);
    for (let tier = 0; tier < 4; tier++) {
      const t0 = base - h * (tier / 4);
      const t1 = base - h * ((tier + 1.4) / 4);
      const half = w * (1 - tier * 0.2) * 0.5;
      ctx.fillStyle = moss;
      poly(ctx, [[cx - half, t0], [cx + half, t0], [cx, t1]]);
      ctx.fillStyle = white;
      poly(ctx, [[cx - half * 0.55, t0 - (t0 - t1) * 0.45], [cx + half * 0.55, t0 - (t0 - t1) * 0.45], [cx, t1]]);
    }
  }

  function paintForest(ctx, g, sky, rand) {
    const base = g.H * (VY + 0.012);
    for (let i = 0; i < 20; i++) {
      const u = 0.12 + rand() * 0.76;
      const near = 1 - Math.abs(u - 0.5) * 1.1;
      paintCedar(ctx, g, sky, g.W * u, base, g.H * (0.06 + rand() * 0.06) * (0.8 + near * 0.4));
    }
  }

  // ---- ground ------------------------------------------------------------

  function paintGround(ctx, g, sky) {
    const top = g.H * VY;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, snowTone(sky, 0.02));
    grad.addColorStop(1, snowTone(sky, 1));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    // Cart ruts running toward the far end of the street.
    ctx.strokeStyle = hex(mixColor(rgb('#9aa6c4'), sky.haze, 0.2));
    ctx.globalAlpha = 0.5 - sky.night * 0.15;
    for (const X of [-0.07, 0.07]) {
      ctx.lineWidth = Math.max(1, g.U * 0.7);
      ctx.beginPath();
      const a = P(g, X, 0, 0.02);
      const b = P(g, X, 0, 1.1);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- houses ------------------------------------------------------------

  function lerpPt(a, b, f) {
    return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
  }

  function paintEndFace(ctx, g, sky, h) {
    const sd = h.side;
    const s = h.s0;
    const wallTop = P(g, sd * WALL_X, WALL_Y, s);
    ctx.fillStyle = tone(sky, '#3a2c24', s);
    poly(ctx, [P(g, sd * WALL_X, 0, s), P(g, sd * BACK_X, 0, s), P(g, sd * BACK_X, WALL_Y, s), wallTop]);
    const a = P(g, sd * (EAVE_X - 0.01), WALL_Y, s);
    const apex = P(g, sd * RIDGE_X, RIDGE_Y, s);
    const b = P(g, sd * (BACK_X + 0.02), WALL_Y, s);
    ctx.fillStyle = tone(sky, '#54402c', s);
    poly(ctx, [a, apex, b]);
    ctx.fillStyle = snowTone(sky, s);
    poly(ctx, [lerpPt(a, apex, 0.6), apex, lerpPt(b, apex, 0.6)]);
    // Loft window under the gable.
    const win = hex(mixColor(rgb('#e8b24e'), sky.amb, 0.15 * (1 - sky.night)));
    ctx.globalAlpha = 0.55 + sky.night * 0.4;
    ctx.fillStyle = win;
    poly(ctx, [
      P(g, sd * 0.4, 0.19, s), P(g, sd * 0.48, 0.19, s), P(g, sd * 0.48, 0.27, s), P(g, sd * 0.4, 0.27, s),
    ]);
    poly(ctx, [P(g, sd * 0.36, 0.03, s), P(g, sd * 0.44, 0.03, s), P(g, sd * 0.44, 0.115, s), P(g, sd * 0.36, 0.115, s)]);
    poly(ctx, [P(g, sd * 0.5, 0.03, s), P(g, sd * 0.56, 0.03, s), P(g, sd * 0.56, 0.115, s), P(g, sd * 0.5, 0.115, s)]);
    ctx.globalAlpha = 1;
  }

  function paintRoof(ctx, g, sky, h, rand) {
    const sd = h.side;
    const steps = 12;
    for (let i = 0; i < steps; i++) {
      const sa = lerp(h.s0, h.s1, i / steps);
      const sb = lerp(h.s0, h.s1, (i + 1) / steps);
      const eaveA = P(g, sd * EAVE_X, WALL_Y, sa);
      const eaveB = P(g, sd * EAVE_X, WALL_Y, sb);
      const ridA = P(g, sd * RIDGE_X, RIDGE_Y, sa);
      const ridB = P(g, sd * RIDGE_X, RIDGE_Y, sb);
      ctx.fillStyle = tone(sky, i % 2 ? '#5a4630' : '#4c3a28', sa);
      poly(ctx, [eaveA, ridA, ridB, eaveB]);
      // Snow lies thick on the upper roof; the hem of thatch shows below it.
      const cover = 0.3 + rand() * 0.12;
      ctx.fillStyle = snowTone(sky, sa);
      poly(ctx, [lerpPt(eaveA, ridA, cover), ridA, ridB, lerpPt(eaveB, ridB, cover + (rand() - 0.5) * 0.06)]);
    }
    // Dark ridge cap.
    ctx.strokeStyle = tone(sky, '#33261c', h.s0);
    ctx.lineWidth = Math.max(1, g.U * 0.4 * h.s0);
    const r0 = P(g, sd * RIDGE_X, RIDGE_Y, h.s0);
    const r1 = P(g, sd * RIDGE_X, RIDGE_Y, h.s1);
    ctx.beginPath();
    ctx.moveTo(r0[0], r0[1]);
    ctx.lineTo(r1[0], r1[1]);
    ctx.stroke();
  }

  function paintFacade(ctx, g, sky, h) {
    const sd = h.side;
    ctx.fillStyle = tone(sky, '#33271f', h.s0);
    poly(ctx, [
      P(g, sd * WALL_X, 0, h.s0), P(g, sd * WALL_X, 0, h.s1), P(g, sd * WALL_X, WALL_Y, h.s1), P(g, sd * WALL_X, WALL_Y, h.s0),
    ]);
    // Eave shadow.
    ctx.fillStyle = tone(sky, '#1c1510', h.s0);
    poly(ctx, [
      P(g, sd * WALL_X, WALL_Y - 0.02, h.s0), P(g, sd * WALL_X, WALL_Y - 0.02, h.s1),
      P(g, sd * WALL_X, WALL_Y, h.s1), P(g, sd * WALL_X, WALL_Y, h.s0),
    ]);
    const glow = mixColor(rgb('#e9b350'), rgb('#f6dd9c'), sky.night * 0.5);
    ctx.fillStyle = hex(glow);
    ctx.globalAlpha = 0.6 + sky.night * 0.4;
    for (const u of h.win) {
      const sa = lerp(h.s0, h.s1, u - 0.1);
      const sb = lerp(h.s0, h.s1, u + 0.1);
      poly(ctx, [P(g, sd * WALL_X, 0.03, sa), P(g, sd * WALL_X, 0.03, sb), P(g, sd * WALL_X, 0.125, sb), P(g, sd * WALL_X, 0.125, sa)]);
    }
    ctx.globalAlpha = 1;
    // Lattice bars of the paper doors.
    ctx.strokeStyle = tone(sky, '#3a2a1c', h.s0);
    ctx.lineWidth = 1;
    for (const u of h.win) {
      const sm = lerp(h.s0, h.s1, u);
      const a = P(g, sd * WALL_X, 0.045, sm);
      const b = P(g, sd * WALL_X, 0.135, sm);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    // Snow bank along the foot of the wall.
    ctx.fillStyle = snowTone(sky, h.s0);
    poly(ctx, [
      P(g, sd * 0.26, 0, h.s0), P(g, sd * 0.26, 0, h.s1), P(g, sd * 0.285, 0.03, h.s1), P(g, sd * 0.3, 0.045, h.s1),
      P(g, sd * 0.3, 0.045, h.s0), P(g, sd * 0.285, 0.03, h.s0),
    ]);
  }

  function paintSpill(ctx, g, sky, h) {
    const sd = h.side;
    const power = 0.18 + sky.night * 0.3;
    for (const u of h.win) {
      const s = lerp(h.s0, h.s1, u);
      const c = P(g, sd * 0.21, 0, s);
      const rx = g.W * 0.07 * s + g.U;
      const ry = g.H * 0.03 * s + 1;
      const grad = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], rx);
      grad.addColorStop(0, `rgba(240,190,98,${power})`);
      grad.addColorStop(1, 'rgba(240,190,98,0)');
      ctx.save();
      ctx.translate(c[0], c[1]);
      ctx.scale(1, ry / rx);
      ctx.translate(-c[0], -c[1]);
      ctx.fillStyle = grad;
      ctx.fillRect(c[0] - rx, c[1] - rx, rx * 2, rx * 2);
      ctx.restore();
    }
  }

  function paintHouse(ctx, g, sky, h, rand) {
    paintEndFace(ctx, g, sky, h);
    paintFacade(ctx, g, sky, h);
    paintRoof(ctx, g, sky, h, rand);
    paintSpill(ctx, g, sky, h);
  }

  function paintStreetFence(ctx, g, sky) {
    // Low snow-capped stakes along both edges of the street.
    for (let i = 0; i < 9; i++) {
      const s = 0.1 + i * 0.12;
      for (const sd of [-1, 1]) {
        const a = P(g, sd * 0.2, 0, s);
        const hgt = g.H * 0.03 * s + 1;
        ctx.fillStyle = tone(sky, '#3b2d22', s);
        ctx.fillRect(a[0], a[1] - hgt, Math.max(1, g.U * 0.5 * s), hgt);
        ctx.fillStyle = snowTone(sky, s);
        ctx.fillRect(a[0] - 0.5, a[1] - hgt - 1, Math.max(2, g.U * 0.8 * s), 1);
      }
    }
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(77);
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, sky, rand);
    paintHills(ctx, g, sky);
    paintForest(ctx, g, sky, rand);
    paintGround(ctx, g, sky);
    for (const h of HOUSES) paintHouse(ctx, g, sky, h, rand);
    paintStreetFence(ctx, g, sky);
    state.front = c;
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function paintPuff() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(226,226,230,0.55)');
    grad.addColorStop(1, 'rgba(226,226,230,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  function seedFlakes() {
    const rand = K.rng(5);
    const f = { x: new Float32Array(MAX_FLAKES), y: new Float32Array(MAX_FLAKES), z: new Float32Array(MAX_FLAKES), p: new Float32Array(MAX_FLAKES) };
    for (let i = 0; i < MAX_FLAKES; i++) {
      f.x[i] = rand();
      f.y[i] = rand();
      f.z[i] = i < MAX_FLAKES / 2 ? 0.25 + rand() * 0.3 : 0.6 + rand() * 0.4;
      f.p[i] = rand() * 6.3;
    }
    return f;
  }

  function seedSmokers(g) {
    return SMOKERS.map((ix) => {
      const h = HOUSES[ix];
      const s = (h.s0 + h.s1) / 2;
      const p = P(g, h.side * RIDGE_X, RIDGE_Y, s);
      return { x: p[0], y: p[1], s, phase: ix * 0.17 };
    });
  }

  function drawSmoke(ctx, g, t) {
    for (const v of state.smokers) {
      for (let i = 0; i < MAX_SMOKE; i++) {
        const a = (t * 0.045 + v.phase + i / MAX_SMOKE) % 1;
        const size = g.U * (3 + a * 10) * (0.4 + v.s);
        const dx = a * g.W * 0.05 + Math.sin(t * 0.5 + i + v.phase * 9) * g.U * 0.6 * v.s;
        const dy = -a * g.H * 0.2 * (0.4 + v.s);
        ctx.globalAlpha = Math.sin(a * Math.PI) * 0.7;
        ctx.drawImage(state.puff, v.x + dx - size / 2, v.y + dy - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawEmbers(ctx, g, t) {
    // The hearth light in a few windows breathes slowly.
    ctx.fillStyle = '#f0c470';
    const lit = [[10, 0.3], [10, 0.7], [11, 0.25], [8, 0.6], [9, 0.35]];
    for (let i = 0; i < lit.length; i++) {
      const h = HOUSES[lit[i][0]];
      const s = lerp(h.s0, h.s1, lit[i][1]);
      const a = P(g, h.side * WALL_X, 0.06, s);
      const b = P(g, h.side * WALL_X, 0.12, s);
      ctx.globalAlpha = (0.12 + 0.07 * Math.sin(t * 0.9 + i * 1.9)) * (0.5 + state.night);
      ctx.fillRect(a[0] - g.U * 0.5, b[1], Math.max(1, g.U * 1.2 * s + 1), a[1] - b[1]);
    }
    ctx.globalAlpha = 1;
  }

  function drawSnow(ctx, g, t, amount, speed) {
    const n = Math.min(MAX_FLAKES, Math.round(MAX_FLAKES * 0.5 * amount));
    if (n <= 0) return;
    const f = state.flakes;
    ctx.fillStyle = '#f4f6fa';
    for (let i = 0; i < n; i++) {
      const z = f.z[i];
      const y = ((f.y[i] + t * speed * (0.02 + 0.05 * z)) % 1) * g.H;
      const x = (((f.x[i] + Math.sin(t * 0.5 + f.p[i]) * 0.01 + t * 0.004) % 1 + 1) % 1) * g.W;
      const size = z > 0.6 ? Math.max(1, Math.round(g.U * 0.6)) : 1;
      ctx.globalAlpha = 0.35 + z * 0.55;
      ctx.fillRect(x, y, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.puff = paintPuff();
    state.flakes = seedFlakes();
    state.smokers = seedSmokers(g);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.front, 0, 0);
    drawEmbers(ctx, g, t);
    if (props.smoke) drawSmoke(ctx, g, t);
    drawSnow(ctx, g, t, props.snow, 1);
  }

  Kasuri.run({
    defaults: { time: 'auto', snow: 1, smoke: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
