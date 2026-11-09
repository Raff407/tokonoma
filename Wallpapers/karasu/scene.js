/*
 * 烏 Karasu — crows on sagging power lines against the evening sky.
 *
 * Sky, rooftops, poles and wires are baked into two layers and repainted once
 * a minute from the clock. Each frame only draws the crows: a dozen small
 * silhouettes that bob on the wire, and now and then lift off, wheel round
 * and land back on their spot.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { lerp, mixColor, toHex, parseColor, fbm } = K;

  const HORIZON = 0.8;
  const POLES = [0.1, 0.9];
  const WIRES = [
    { top: 0.3, sag: 0.13 },
    { top: 0.335, sag: 0.15 },
    { top: 0.37, sag: 0.17 },
  ];
  const MAX_CROWS = 16;
  const FLIGHT_SECONDS = 8;
  const RETINT_SECONDS = 60;
  const INK = '#15131a';
  const state = { crows: [] };

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function wireY(g, k, x) {
    const w = WIRES[k];
    const a = g.W * POLES[0];
    const b = g.W * POLES[1];
    const u = (x - a) / (b - a);
    return g.H * (w.top + w.sag * 4 * u * (1 - u));
  }

  // ---- bake --------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const lift = sky.night * 0.7;
    const top = mixColor(sky.top, rgb('#2c3868'), lift);
    const low = mixColor(sky.low, rgb('#8a86a8'), lift);
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(top));
    grad.addColorStop(0.3, hex(mixColor(top, low, 0.55)));
    grad.addColorStop(1, hex(low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    paintOrb(ctx, g, sky);
    if (sky.night > 0.2) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.45);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintStreaks(ctx, g, sky);
    return c;
  }

  // Low sun by day and dusk, moon at night; both soft discs.
  function paintOrb(ctx, g, sky) {
    const isMoon = sky.night > 0.6;
    const t = isMoon ? S.moonT(sky.hour) : S.sunT(sky.hour);
    const ox = g.W * lerp(0.15, 0.85, t);
    const oy = g.H * (HORIZON - Math.sin(t * Math.PI) * 0.55 - 0.02);
    const r = g.U * (isMoon ? 3 : 4.5);
    const core = isMoon ? '#ece6d2' : '#f2c27a';
    const glow = ctx.createRadialGradient(ox, oy, r * 0.5, ox, oy, r * 5);
    glow.addColorStop(0, isMoon ? 'rgba(236,230,210,0.28)' : 'rgba(242,170,100,0.4)');
    glow.addColorStop(1, 'rgba(242,170,100,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(ox - r * 5, oy - r * 5, r * 10, r * 10);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(ox, oy, r, 0, 6.3);
    ctx.fill();
  }

  // Long thin clouds lit from below.
  function paintStreaks(ctx, g, sky) {
    const tint = hex(mixColor(sky.haze, rgb('#e8b08a'), 0.4 * (1 - sky.night)));
    ctx.fillStyle = tint;
    for (let i = 0; i < 6; i++) {
      const y = g.H * (0.52 + i * 0.035);
      for (let x = 0; x < g.W; x += 2) {
        const v = fbm(x * 0.01, i * 3.1, 3, 7);
        if (v < 0.55) continue;
        ctx.globalAlpha = Math.min(0.5, (v - 0.55) * 2.5) * (1 - sky.night * 0.5);
        ctx.fillRect(x, y, 2, Math.max(1, g.U * 0.6));
      }
    }
    ctx.globalAlpha = 1;
  }

  function paintRoofs(ctx, g, sky, rand) {
    const far = hex(mixColor(sky.haze, rgb('#2a2834'), 0.55));
    const near = hex(mixColor(rgb('#1c1a22'), sky.top, 0.15));
    let x = 0;
    ctx.fillStyle = far;
    while (x < g.W) {
      const w = g.U * (6 + rand() * 10);
      const h = g.H * (0.05 + rand() * 0.07);
      ctx.fillRect(x, g.H * HORIZON - h, w + 1, h + 1);
      x += w;
    }
    ctx.fillRect(0, g.H * HORIZON, g.W, g.H);
    ctx.fillStyle = near;
    x = -g.U * 4;
    while (x < g.W) {
      const w = g.U * (12 + rand() * 14);
      const base = g.H * (HORIZON + 0.06 + rand() * 0.03);
      const peak = base - g.U * (3 + rand() * 4);
      ctx.beginPath();
      ctx.moveTo(x - g.U, base);
      ctx.lineTo(x + w * 0.5, peak);
      ctx.lineTo(x + w + g.U, base);
      ctx.lineTo(x + w + g.U, g.H);
      ctx.lineTo(x - g.U, g.H);
      ctx.fill();
      x += w;
    }
    paintWindows(ctx, g, sky, rand);
  }

  // A few warm windows once it gets dark.
  function paintWindows(ctx, g, sky, rand) {
    if (sky.night < 0.15) return;
    ctx.fillStyle = '#d9a75a';
    ctx.globalAlpha = Math.min(1, sky.night * 1.4) * 0.85;
    for (let i = 0; i < 14; i++) {
      const wx = rand() * g.W;
      const wy = g.H * (HORIZON + 0.1 + rand() * 0.08);
      ctx.fillRect(wx, wy, g.U * 1.6, g.U * 1.1);
    }
    ctx.globalAlpha = 1;
  }

  function paintPole(ctx, g, px) {
    const w = Math.max(2, g.U * 1.1);
    ctx.fillRect(px - w / 2, g.H * 0.24, w, g.H);
    const arm = g.U * 7;
    for (let k = 0; k < 2; k++) {
      ctx.fillRect(px - arm, g.H * (0.29 + k * 0.045), arm * 2, Math.max(1, g.U * 0.6));
    }
    ctx.fillRect(px - g.U * 2.2, g.H * 0.4, g.U * 4.4, g.U * 3.4);
  }

  function paintWires(ctx, g) {
    ctx.lineWidth = Math.max(1, g.U * 0.32);
    for (let k = 0; k < WIRES.length; k++) {
      ctx.beginPath();
      for (let x = -g.U; x <= g.W + g.U; x += 2) {
        let y;
        if (x < g.W * POLES[0]) y = wireY(g, k, g.W * POLES[0]) + (g.W * POLES[0] - x) * 0.12;
        else if (x > g.W * POLES[1]) y = wireY(g, k, g.W * POLES[1]) + (x - g.W * POLES[1]) * 0.12;
        else y = wireY(g, k, x);
        if (x === -g.U) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintRoofs(ctx, g, sky, rand);
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    POLES.forEach((p) => paintPole(ctx, g, g.W * p));
    paintWires(ctx, g);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(47);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- crows -------------------------------------------------------------

  function placeCrows(g) {
    const rand = K.rng(13);
    for (let i = 0; i < MAX_CROWS; i++) {
      const k = Math.floor(rand() * WIRES.length);
      const x = g.W * lerp(POLES[0] + 0.06, POLES[1] - 0.06, (i + rand() * 0.6) / MAX_CROWS);
      state.crows.push({
        x,
        y: wireY(g, k, x),
        dir: rand() < 0.5 ? -1 : 1,
        size: g.U * (1.7 + rand() * 0.3),
        phase: rand() * 10,
        period: 14 + rand() * 16,
        offset: rand() * 60,
        loop: 0.6 + rand() * 0.6,
      });
    }
    // Shuffle draw order so thinning the count keeps them spread out.
    state.order = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15];
  }

  function perched(ctx, c, t) {
    const s = c.size;
    const d = c.dir;
    const bob = Math.sin(t * 1.3 + c.phase) * s * 0.18;
    const look = Math.sin(t * 0.37 + c.phase * 2) > 0.7 ? -d : d;
    const x = c.x;
    const y = c.y;
    ctx.beginPath();
    ctx.ellipse(x, y - s * 1.9, s * 1.05, s * 1.75, d * 0.5, 0, 6.3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - d * s * 0.2, y - s * 1.0);
    ctx.lineTo(x - d * s * 1.6, y + s * 1.4);
    ctx.lineTo(x - d * s * 0.7, y + s * 1.6);
    ctx.lineTo(x + d * s * 0.6, y - s * 0.6);
    ctx.fill();
    const hx = x + d * s * 1.0;
    const hy = y - s * 3.5 + bob;
    ctx.beginPath();
    ctx.arc(hx, hy, s * 0.85, 0, 6.3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx + look * s * 0.5, hy - s * 0.35);
    ctx.lineTo(hx + look * s * 2.0, hy + s * 0.15);
    ctx.lineTo(hx + look * s * 0.5, hy + s * 0.45);
    ctx.fill();
    ctx.fillRect(x - s * 0.15, y - s * 0.6, Math.max(1, s * 0.3), s * 0.6);
  }

  function flying(ctx, c, p, t) {
    const s = c.size;
    const turn = p * Math.PI * 2;
    const rx = c.loop * 16 * s;
    const ry = c.loop * 8 * s;
    const x = c.x + Math.sin(turn) * rx * c.dir;
    const y = c.y - s * 1.5 - (1 - Math.cos(turn)) * ry;
    const heading = Math.cos(turn) * c.dir >= 0 ? 1 : -1;
    const flap = Math.sin(t * 11 + c.phase) * s * 2.6;
    ctx.beginPath();
    ctx.ellipse(x, y, s * 1.7, s * 0.7, 0, 0, 6.3);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + heading * s * 1.7, y - s * 0.2, s * 0.6, 0, 6.3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - heading * s * 1.2, y);
    ctx.lineTo(x - heading * s * 2.9, y - s * 0.5);
    ctx.lineTo(x - heading * s * 2.9, y + s * 0.6);
    ctx.fill();
    for (let w = -1; w <= 1; w += 2) {
      ctx.beginPath();
      ctx.moveTo(x - s * 0.9, y);
      ctx.lineTo(x + w * s * 0.4 - heading * s * 1.5, y - flap * 1.6 + w * s * 0.4);
      ctx.lineTo(x + w * s * 0.4 + heading * s * 0.6, y - flap * 1.8);
      ctx.lineTo(x + s * 0.9, y);
      ctx.fill();
    }
  }

  function drawCrows(ctx, t, count, flight) {
    ctx.fillStyle = INK;
    for (let n = 0; n < count; n++) {
      const c = state.crows[state.order[n]];
      if (flight > 0) {
        const cycle = (t + c.offset) % (c.period / flight);
        if (cycle < FLIGHT_SECONDS) {
          flying(ctx, c, cycle / FLIGHT_SECONDS, t);
          continue;
        }
      }
      perched(ctx, c, t);
    }
  }

  // ---- run ---------------------------------------------------------------

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.crows = [];
    placeCrows(g);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.front, 0, 0);
    const count = Math.max(0, Math.min(MAX_CROWS, Math.round(props.crows)));
    drawCrows(ctx, t, count, props.flight);
  }

  Kasuri.run({
    defaults: { time: 'auto', crows: 11, flight: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
