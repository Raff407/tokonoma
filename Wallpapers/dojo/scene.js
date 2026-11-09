/*
 * 道場 Dojo — an empty wooden dojo. Paper windows throw long beams across
 * the plank floor, dust drifts through them, bokken rest on a wall rack and
 * a small bronze bell sways from the beam.
 *
 * Wall, floor and beams are baked once and repainted once a minute from the
 * clock. Between repaints only the beam glow, dust and bell move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { lerp, mixColor, toHex, parseColor, clamp } = K;

  const FLOOR_Y = 0.6;
  const WINDOWS = [0.08, 0.26, 0.43];
  const WIN_W = 0.1;
  const WIN_TOP = 0.13;
  const WIN_BOT = 0.4;
  const DUST = 110;
  const RETINT_SECONDS = 60;
  const BELL = { x: 0.63, y: 0.19 };
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function dim(c, sky, k) {
    return mixColor(c, rgb('#12141e'), sky.night * k);
  }

  // ---- walls -------------------------------------------------------------

  function paintWall(ctx, g, sky) {
    const W = g.W;
    const H = g.H;
    ctx.fillStyle = hex(dim(rgb('#cfc5ab'), sky, 0.78));
    ctx.fillRect(0, 0, W, H * FLOOR_Y);
    // dark wainscot below
    ctx.fillStyle = hex(dim(rgb('#4a3626'), sky, 0.7));
    ctx.fillRect(0, H * 0.5, W, H * (FLOOR_Y - 0.5));
    ctx.fillStyle = hex(dim(rgb('#6a4e36'), sky, 0.7));
    ctx.fillRect(0, H * 0.5, W, Math.max(1, g.U * 0.6));
    // ceiling band and cross beams
    const beam = hex(dim(rgb('#3a2a1e'), sky, 0.6));
    ctx.fillStyle = beam;
    ctx.fillRect(0, 0, W, H * 0.07);
    ctx.fillRect(0, H * 0.095, W, g.U * 1.3);
    // posts
    for (const f of [0.03, 0.97, 0.22, 0.395, 0.69]) {
      ctx.fillStyle = beam;
      ctx.fillRect(W * f - g.U * 1.3, 0, g.U * 2.6, H * FLOOR_Y);
      ctx.fillStyle = hex(dim(rgb('#5a4430'), sky, 0.6));
      ctx.fillRect(W * f - g.U * 1.3, 0, Math.max(1, g.U * 0.5), H * FLOOR_Y);
    }
  }

  function paintWindow(ctx, g, sky, f) {
    const x = g.W * f;
    const w = g.W * WIN_W;
    const y0 = g.H * WIN_TOP;
    const h = g.H * (WIN_BOT - WIN_TOP);
    const glow = mixColor(rgb('#f4ecd2'), rgb('#7886b0'), sky.night);
    const paper = mixColor(glow, sky.amb, 0.25);
    ctx.fillStyle = hex(paper);
    ctx.fillRect(x, y0, w, h);
    ctx.fillStyle = hex(dim(rgb('#3a2a1e'), sky, 0.5));
    const t = Math.max(1, g.U * 0.5);
    for (let i = 0; i <= 4; i++) ctx.fillRect(x + (w - t) * (i / 4), y0, t, h);
    for (let j = 0; j <= 6; j++) ctx.fillRect(x, y0 + (h - t) * (j / 6), w, t);
    ctx.fillRect(x - t, y0 - t, w + 2 * t, t * 1.6);
    ctx.fillRect(x - t, y0 + h, w + 2 * t, t * 1.6);
  }

  function paintRack(ctx, g, sky) {
    const x0 = g.W * 0.74;
    const w = g.W * 0.21;
    const wood = hex(dim(rgb('#5a3e28'), sky, 0.6));
    ctx.fillStyle = wood;
    ctx.fillRect(x0 - g.U, g.H * 0.2, g.U * 1.2, g.H * 0.3);
    ctx.fillRect(x0 + w, g.H * 0.2, g.U * 1.2, g.H * 0.3);
    const light = dim(rgb('#c9a46c'), sky, 0.65);
    const dark = dim(rgb('#8e6a40'), sky, 0.65);
    for (let r = 0; r < 3; r++) {
      const y = g.H * (0.27 + r * 0.09);
      ctx.fillStyle = wood;
      ctx.fillRect(x0 - g.U, y + g.U * 1.6, w + g.U * 2.2, Math.max(1, g.U * 0.7));
      for (let k = 0; k < 2; k++) {
        const sx = x0 + g.U * (0.5 + k * 0.5);
        const len = w - g.U * (1.2 + k * 0.6 + r * 0.4);
        const sy = y + k * g.U * 0.9;
        ctx.fillStyle = hex(k ? dark : light);
        ctx.fillRect(sx, sy, len, Math.max(2, g.U * 1.1));
        // hilt: darker grip with a round guard
        ctx.fillStyle = '#2a2018';
        ctx.fillRect(sx, sy, g.U * 2.2, Math.max(2, g.U * 1.1));
        ctx.fillRect(sx + g.U * 2.2, sy - g.U * 0.25, Math.max(1, g.U * 0.4), g.U * 1.25);
      }
    }
  }

  function paintScroll(ctx, g, sky) {
    const x = g.W * 0.54;
    ctx.fillStyle = hex(dim(rgb('#e6dcc0'), sky, 0.75));
    ctx.fillRect(x, g.H * 0.17, g.W * 0.055, g.H * 0.24);
    ctx.fillStyle = hex(dim(rgb('#2f3a6e'), sky, 0.6));
    ctx.fillRect(x - g.U * 0.6, g.H * 0.165, g.W * 0.055 + g.U * 1.2, g.U * 1.1);
    ctx.fillRect(x - g.U * 0.6, g.H * 0.41, g.W * 0.055 + g.U * 1.2, g.U * 1.1);
    ctx.fillStyle = hex(dim(rgb('#d6452c'), sky, 0.55));
    ctx.fillRect(x + g.W * 0.0275 - g.U * 0.6, g.H * 0.3, g.U * 1.2, g.U * 1.2);
  }

  // ---- floor -------------------------------------------------------------

  function paintFloor(ctx, g, sky) {
    const W = g.W;
    const H = g.H;
    const y0 = H * FLOOR_Y;
    const grad = ctx.createLinearGradient(0, y0, 0, H);
    grad.addColorStop(0, hex(dim(rgb('#9c7648'), sky, 0.75)));
    grad.addColorStop(1, hex(dim(rgb('#6a4a2c'), sky, 0.75)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, W, H - y0);
    // planks run toward a point on the back wall
    const vx = W * 0.5;
    ctx.strokeStyle = hex(dim(rgb('#3e2a18'), sky, 0.7));
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.8;
    for (let i = -14; i <= 14; i++) {
      ctx.beginPath();
      ctx.moveTo(vx + i * W * 0.012, y0);
      ctx.lineTo(vx + i * W * 0.11, H);
      ctx.stroke();
    }
    // cross joints, spaced further apart nearer the viewer
    for (let k = 1; k < 9; k++) {
      const y = y0 + (H - y0) * Math.pow(k / 9, 1.8);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // skirting
    ctx.fillStyle = hex(dim(rgb('#2e2016'), sky, 0.6));
    ctx.fillRect(0, y0 - g.U * 0.5, W, g.U * 1.1);
  }

  // Beams: slanted bands from each window down across the wall and floor.
  function paintBeams(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const t = S.sunT(sky.hour);
    const lean = lerp(-0.2, 0.2, t) * g.W;
    const warm = mixColor(rgb('#fff0c8'), rgb('#e8a060'), clamp(Math.abs(t - 0.5) * 2, 0, 1) * 0.7);
    const col = mixColor(warm, rgb('#aab8e0'), sky.night);
    const strength = lerp(0.42, 0.16, sky.night);
    for (const f of WINDOWS) {
      const x = g.W * f;
      const w = g.W * WIN_W;
      const top = g.H * WIN_TOP;
      const bot = g.H * WIN_BOT;
      const grad = ctx.createLinearGradient(0, top, 0, g.H);
      grad.addColorStop(0, hex(col));
      grad.addColorStop(1, hex(col));
      ctx.fillStyle = grad;
      ctx.globalAlpha = strength;
      ctx.beginPath();
      ctx.moveTo(x, bot);
      ctx.lineTo(x + w, bot);
      ctx.lineTo(x + w + lean * 1.4 + g.W * 0.04, g.H);
      ctx.lineTo(x + lean * 1.4 - g.W * 0.02, g.H);
      ctx.closePath();
      ctx.fill();
      // a softer pool where the beam meets the floor
      ctx.globalAlpha = strength * 0.5;
      ctx.beginPath();
      ctx.ellipse(x + w * 0.5 + lean, g.H * 0.8, w * 0.9, g.H * 0.07, 0, 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintBellArt(g, sky) {
    const w = Math.max(6, Math.round(g.U * 6));
    const h = Math.max(8, Math.round(g.U * 8));
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = hex(dim(rgb('#6a7a52'), sky, 0.6));
    ctx.beginPath();
    ctx.moveTo(w * 0.3, h * 0.12);
    ctx.lineTo(w * 0.7, h * 0.12);
    ctx.lineTo(w * 0.92, h * 0.85);
    ctx.lineTo(w * 0.08, h * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(dim(rgb('#3e4a30'), sky, 0.6));
    ctx.fillRect(w * 0.06, h * 0.82, w * 0.88, h * 0.1);
    ctx.fillStyle = hex(dim(rgb('#c9a24a'), sky, 0.6));
    ctx.fillRect(w * 0.44, 0, Math.max(1, w * 0.12), h * 0.14);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintWall(ctx, g, sky);
    for (const f of WINDOWS) paintWindow(ctx, g, sky, f);
    paintScroll(ctx, g, sky);
    paintRack(ctx, g, sky);
    paintFloor(ctx, g, sky);
    state.back = c;
    state.beams = paintBeams(g, sky);
    state.bell = paintBellArt(g, sky);
    state.night = sky.night;
    state.mote = hex(mixColor(rgb('#fff4d8'), rgb('#c8d2f0'), sky.night));
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawBell(ctx, g, t) {
    const b = state.bell;
    const bx = g.W * BELL.x;
    const by = g.H * BELL.y;
    ctx.fillStyle = '#2e2218';
    ctx.fillRect(bx - 0.5, g.H * 0.095, 1, by - g.H * 0.095);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(Math.sin(t * 1.1) * 0.12);
    ctx.drawImage(b, -b.width / 2, 0);
    ctx.restore();
  }

  function drawDust(ctx, g, t, amount) {
    if (amount <= 0) return;
    const n = Math.floor(DUST * Math.min(amount, 2) / 2 * 2);
    const d = state.dust;
    ctx.fillStyle = state.mote;
    const size = Math.max(1, g.U * 0.6);
    for (let i = 0; i < Math.min(n, DUST); i++) {
      const x = ((d.x[i] + t * d.vx[i] + Math.sin(t * d.w[i] + i) * 0.01) % 1 + 1) % 1;
      const y = ((d.y[i] + t * d.vy[i]) % 1 + 1) % 1;
      const py = g.H * (0.12 + y * 0.8);
      ctx.globalAlpha = (0.25 + 0.5 * d.a[i]) * (1 - state.night * 0.15) * (0.6 + 0.4 * Math.sin(t * d.w[i] * 2 + i));
      ctx.fillRect(g.W * x, py, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    const rand = K.rng(88);
    state.dust = { x: [], y: [], vx: [], vy: [], w: [], a: [] };
    for (let i = 0; i < DUST; i++) {
      state.dust.x.push(rand());
      state.dust.y.push(rand());
      state.dust.vx.push(0.004 + rand() * 0.008);
      state.dust.vy.push(0.004 + rand() * 0.008);
      state.dust.w.push(0.4 + rand() * 0.8);
      state.dust.a.push(rand());
    }
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.back, 0, 0);
    drawBell(ctx, g, t);
    ctx.globalAlpha = clamp(props.beams * (0.8 + 0.2 * Math.sin(t * 0.4)), 0, 1.5);
    ctx.drawImage(state.beams, 0, 0);
    ctx.globalAlpha = 1;
    drawDust(ctx, g, t, props.dust);
  }

  Kasuri.run({
    defaults: { time: 'auto', beams: 1, dust: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
