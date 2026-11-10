/*
 * 飛行機雲 Hikokigumo — contrails drawing across an evening sky.
 *
 * Sky, Fuji, the skyline with its red lattice tower, and the tiled rooftop
 * with a utility pole are baked into layers and repainted once a minute from
 * the clock. Between repaints only the contrails, a few aircraft and slow
 * clouds move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.72;
  const PEAK = { x: 0.3, y: 0.24 };
  const RETINT_SECONDS = 60;
  const SEGS = 14;
  // Each trail runs from (x0,y0) to (x1,y1) as fractions of the canvas size.
  const TRAILS = [
    { x0: -0.05, y0: 0.2, x1: 1.05, y1: 0.07, period: 40, phase: 0.0 },
    { x0: 1.05, y0: 0.3, x1: -0.05, y1: 0.16, period: 50, phase: 0.45 },
    { x0: 0.0, y0: 0.4, x1: 1.0, y1: 0.27, period: 45, phase: 0.75 },
    { x0: 0.45, y0: 0.02, x1: 1.05, y1: 0.36, period: 55, phase: 0.2 },
    { x0: 1.05, y0: 0.12, x1: 0.1, y1: 0.03, period: 60, phase: 0.6 },
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

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(0.55, hex(mixColor(sky.top, sky.low, 0.45)));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    // Low glow where the sun went down, behind the skyline.
    const gc = mixColor(sky.low, rgb('#f0b070'), 0.4).map((v) => Math.round(v));
    const glow = ctx.createRadialGradient(g.W * 0.72, g.H * HORIZON, 0, g.W * 0.72, g.H * HORIZON, g.W * 0.6);
    glow.addColorStop(0, 'rgba(' + gc.join(',') + ',0.6)');
    glow.addColorStop(1, 'rgba(' + gc.join(',') + ',0)');
    ctx.globalAlpha = 1 - sky.night;
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W, g.H * HORIZON);
    ctx.globalAlpha = 1;
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.5, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    return c;
  }

  // Thin high cloud that tiles sideways.
  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.012, y * 0.09, 4, 17);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 246;
        img.data[i + 3] = smoothstep(0.55, 0.78, v) * band * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- fuji --------------------------------------------------------------

  function ridge(g, x) {
    const px = g.W * PEAK.x;
    const half = g.W * (x < px ? 0.4 : 0.46);
    const crater = g.W * 0.012;
    const d = Math.max(0, Math.abs(x - px) - crater) / half;
    const base = g.H * HORIZON;
    const top = g.H * PEAK.y;
    const y = base - (base - top) * Math.pow(Math.max(0, 1 - d), 1.85);
    return y + (fbm(x * 0.07, 2, 3, 5) - 0.5) * g.U * 0.6;
  }

  function paintFuji(ctx, g, sky) {
    const x0 = 0;
    const x1 = Math.ceil(g.W * 0.95);
    const body = mixColor(mixColor(rgb('#5b6ea8'), sky.haze, 0.3), rgb('#26304e'), sky.night * 0.6);
    const snow = mixColor(mixColor(rgb('#eef0f2'), sky.amb, 0.45), sky.top, sky.night * 0.35);
    const topY = g.H * PEAK.y;
    const baseY = g.H * HORIZON;
    for (let x = x0; x < x1; x++) {
      const top = ridge(g, x);
      if (top >= baseY) continue;
      const line = topY + (baseY - topY) * (0.5 + (fbm(x * 0.05, 4, 3, 11) - 0.5) * 0.22 + (fbm(x * 0.2, 1, 3, 9) - 0.5) * 0.3);
      const shade = 1 - 0.1 * smoothstep(0, g.W * 0.05, x - g.W * PEAK.x);
      ctx.fillStyle = hex(snow.map((v) => v * shade));
      ctx.fillRect(x, top, 1, Math.max(0, Math.min(line, baseY) - top));
      const bt = Math.max(line, top);
      const g2 = ctx.createLinearGradient(0, bt, 0, baseY);
      g2.addColorStop(0, hex(body.map((v) => v * shade)));
      g2.addColorStop(1, hex(mixColor(body, sky.low, 0.5).map((v) => v * shade)));
      ctx.fillStyle = g2;
      ctx.fillRect(x, bt, 1, baseY - bt + 1);
    }
  }

  // ---- skyline -----------------------------------------------------------

  function paintTower(ctx, g, sky, x, base, h, dark) {
    const w = h * 0.34;
    const red = hex(mixColor(mixColor(rgb('#c0432c'), sky.haze, 0.3), dark, sky.night * 0.7));
    const white = hex(mixColor(mixColor(rgb('#e8e2d0'), sky.haze, 0.4), dark, sky.night * 0.7));
    const top = base - h;
    // Legs and an antenna.
    for (let i = 0; i < 24; i++) {
      const f0 = i / 24;
      const f1 = (i + 1) / 24;
      const half0 = lerp(w / 2, w * 0.04, Math.pow(f0, 0.8));
      const half1 = lerp(w / 2, w * 0.04, Math.pow(f1, 0.8));
      const y0 = base - h * 0.78 * f0;
      const y1 = base - h * 0.78 * f1;
      ctx.fillStyle = (i % 4 < 2) ? red : white;
      ctx.beginPath();
      ctx.moveTo(x - half0, y0);
      ctx.lineTo(x - half1, y1);
      ctx.lineTo(x - half1 + Math.max(1, half1 * 0.25), y1);
      ctx.lineTo(x - half0 + Math.max(1, half0 * 0.25), y0);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + half0, y0);
      ctx.lineTo(x + half1, y1);
      ctx.lineTo(x + half1 - Math.max(1, half1 * 0.25), y1);
      ctx.lineTo(x + half0 - Math.max(1, half0 * 0.25), y0);
      ctx.fill();
    }
    ctx.fillStyle = red;
    ctx.fillRect(x - w * 0.34, base - h * 0.4, w * 0.68, Math.max(2, h * 0.025));
    ctx.fillStyle = white;
    ctx.fillRect(x - w * 0.2, base - h * 0.62, w * 0.4, Math.max(2, h * 0.03));
    ctx.fillStyle = red;
    ctx.fillRect(x - Math.max(0.5, w * 0.025), top, Math.max(1, w * 0.05), h * 0.25);
  }

  // A small five-tier pagoda.
  function paintPagoda(ctx, g, x, base, u, col) {
    ctx.fillStyle = col;
    for (let t = 0; t < 5; t++) {
      const w = u * (7 - t * 1.1);
      const y = base - t * u * 3.2;
      ctx.fillRect(x - w * 0.3, y - u * 2.2, w * 0.6, u * 2.2);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.62, y - u * 1.9);
      ctx.quadraticCurveTo(x - w * 0.3, y - u * 2, x, y - u * 3.2);
      ctx.quadraticCurveTo(x + w * 0.3, y - u * 2, x + w * 0.62, y - u * 1.9);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillRect(x - u * 0.2, base - 5 * u * 3.2 - u * 1.5, u * 0.4, u * 3);
  }

  function paintSkyline(ctx, g, sky, rand) {
    const baseY = g.H * HORIZON;
    const dark = rgb('#171b2c');
    const far = mixColor(mixColor(rgb('#3c4668'), sky.haze, 0.4), dark, sky.night * 0.7);
    const near = mixColor(mixColor(rgb('#232a46'), sky.haze, 0.25), dark, sky.night * 0.75);
    const lamp = rgb('#e8b860');
    const rows = [
      { col: far, hMin: 0.02, hMax: 0.06, wMin: 0.012, wMax: 0.03, lit: 0.25 },
      { col: near, hMin: 0.012, hMax: 0.04, wMin: 0.014, wMax: 0.034, lit: 0.45 },
    ];
    rows.forEach((row, ri) => {
      let x = -2;
      while (x < g.W) {
        const w = g.W * (row.wMin + rand() * (row.wMax - row.wMin));
        const h = g.H * (row.hMin + rand() * (row.hMax - row.hMin));
        ctx.fillStyle = hex(row.col);
        ctx.fillRect(x, baseY - h + g.H * 0.012 * ri, w, h + g.H * 0.05);
        if (sky.night > 0.2) {
          ctx.fillStyle = hex(lamp);
          ctx.globalAlpha = sky.night * 0.7;
          for (let wy = baseY - h + 3; wy < baseY; wy += 3) {
            for (let wx = x + 1; wx < x + w - 1; wx += 3) {
              if (rand() < row.lit * 0.4) ctx.fillRect(wx, wy, 1, 1);
            }
          }
          ctx.globalAlpha = 1;
        }
        x += w + g.W * 0.002;
        if (rand() < 0.15) x += g.W * 0.01;
      }
      if (ri === 0) {
        paintTower(ctx, g, sky, g.W * 0.78, baseY + g.H * 0.01, g.H * 0.3, dark);
        paintPagoda(ctx, g, g.W * 0.55, baseY + g.H * 0.012, g.U * 0.9, hex(mixColor(far, dark, 0.25)));
      }
    });
    ctx.fillStyle = hex(mixColor(near, dark, 0.3));
    ctx.fillRect(0, baseY + g.H * 0.01, g.W, g.H);
  }

  // ---- foreground --------------------------------------------------------

  // A tiled eave across the lower left with a ridge-end ornament.
  function paintRoof(ctx, g, sky) {
    const tile = mixColor(mixColor(rgb('#4a5272'), sky.amb, 0.2), rgb('#161a2a'), sky.night * 0.6);
    const edge = mixColor(tile, rgb('#c8cade'), 0.35);
    const topY = g.H * 0.8;
    const reach = g.W * 0.62;
    ctx.fillStyle = hex(tile);
    ctx.beginPath();
    ctx.moveTo(0, topY - g.H * 0.02);
    ctx.quadraticCurveTo(reach * 0.55, topY - g.H * 0.02, reach, topY + g.H * 0.05);
    ctx.lineTo(reach + g.W * 0.03, g.H);
    ctx.lineTo(0, g.H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = hex(edge);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    for (let r = 1; r < 9; r++) {
      const yy = topY + r * g.H * 0.02;
      ctx.beginPath();
      ctx.moveTo(0, yy - g.H * 0.02);
      ctx.quadraticCurveTo(reach * 0.55, yy - g.H * 0.02, reach + g.W * 0.02, yy + g.H * 0.05);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Round end tile and a small ornament where the ridge stops.
    ctx.fillStyle = hex(edge);
    ctx.beginPath();
    ctx.arc(reach, topY + g.H * 0.05, g.U * 1.1, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = hex(tile);
    ctx.beginPath();
    ctx.moveTo(reach - g.U * 2, topY + g.H * 0.05);
    ctx.quadraticCurveTo(reach - g.U, topY - g.U * 2, reach + g.U * 0.5, topY - g.U * 3.5);
    ctx.quadraticCurveTo(reach + g.U * 1.5, topY - g.U, reach + g.U * 2, topY + g.H * 0.05);
    ctx.fill();
  }

  // A concrete utility pole with two crossarms and wires running off.
  function paintPole(ctx, g, sky) {
    const col = hex(mixColor(mixColor(rgb('#4a4640'), sky.amb, 0.15), rgb('#0c0e16'), sky.night * 0.7));
    const px = g.W * 0.86;
    const w = Math.max(2, g.U * 0.9);
    ctx.fillStyle = col;
    ctx.fillRect(px - w / 2, g.H * 0.2, w, g.H * 0.8);
    ctx.fillRect(px - g.U * 6, g.H * 0.27, g.U * 12, Math.max(1, g.U * 0.5));
    ctx.fillRect(px - g.U * 5, g.H * 0.33, g.U * 10, Math.max(1, g.U * 0.5));
    ctx.fillStyle = hex(rgb('#c9ccd0').map((v, i) => v * (1 - sky.night * 0.6)));
    for (const dx of [-5.5, -2, 2, 5.5]) ctx.fillRect(px + dx * g.U - 1, g.H * 0.27 - g.U * 1.1, 2, g.U * 1.1);
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      const off = (k - 1.5) * g.U * 3.4;
      ctx.beginPath();
      ctx.moveTo(px + off, g.H * 0.27);
      ctx.quadraticCurveTo(g.W * 0.4, g.H * (0.34 + k * 0.012), -4, g.H * (0.3 + k * 0.01));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px + off, g.H * 0.27);
      ctx.quadraticCurveTo(g.W * 1.0, g.H * (0.3 + k * 0.01), g.W + 4, g.H * (0.26 + k * 0.008));
      ctx.stroke();
    }
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintFuji(ctx, g, sky);
    paintSkyline(ctx, g, sky, rand);
    paintRoof(ctx, g, sky);
    paintPole(ctx, g, sky);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(47);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    const warm = mixColor(rgb('#ffffff'), rgb('#f6c090'), 1 - smoothstep(6, 14, sky.hour) * 0 );
    const lit = mixColor(mixColor(rgb('#ffffff'), sky.amb, 0.55), warm, 0.2);
    state.trailCol = mixColor(lit, sky.top, sky.night * 0.7);
    state.glowCol = mixColor(sky.low, rgb('#f2a868'), 0.5);
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 2.4) % c.width);
    ctx.globalAlpha = 0.5 - state.night * 0.3;
    ctx.drawImage(c, off, g.H * 0.3);
    ctx.drawImage(c, off + c.width, g.H * 0.3);
    ctx.globalAlpha = 1;
  }

  function drawTrail(ctx, g, tr, t, amount, planes) {
    const cycle = (t / tr.period + tr.phase) % 1;
    const draw = 0.5;
    const head = Math.min(1, cycle / draw);
    const fade = cycle < draw ? 1 : 1 - (cycle - draw) / (1 - draw);
    if (head < 0.01 || fade <= 0) return;
    const ax = tr.x0 * g.W;
    const ay = tr.y0 * g.H;
    const dx = (tr.x1 - tr.x0) * g.W;
    const dy = (tr.y1 - tr.y0) * g.H;
    const col = state.trailCol;
    const glow = state.glowCol;
    ctx.lineCap = 'round';
    for (let i = 0; i < SEGS; i++) {
      const f0 = (head * i) / SEGS;
      const f1 = (head * (i + 1)) / SEGS;
      const age = 1 - (i + 0.5) / SEGS;
      const a = Math.min(1, amount) * fade * (1 - age * 0.75) * (0.9 - state.night * 0.5);
      const wide = g.U * (0.5 + age * 2.2);
      ctx.beginPath();
      ctx.moveTo(ax + dx * f0, ay + dy * f0);
      ctx.lineTo(ax + dx * f1, ay + dy * f1);
      ctx.strokeStyle = toHex(glow);
      ctx.globalAlpha = a * 0.35;
      ctx.lineWidth = wide * 1.8;
      ctx.stroke();
      ctx.strokeStyle = toHex(col);
      ctx.globalAlpha = a;
      ctx.lineWidth = wide * 0.8;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (planes && head < 1) {
      ctx.fillStyle = toHex(mixColor(col, rgb('#ffffff'), 0.5));
      ctx.fillRect(ax + dx * head - g.U * 0.4, ay + dy * head - g.U * 0.3, Math.max(2, g.U * 0.9), Math.max(1, g.U * 0.5));
    }
  }

  // Four crows crossing the lower sky, wings beating.
  function drawCrows(ctx, g, t) {
    ctx.fillStyle = toHex(mixColor(rgb('#1c2036'), state.trailCol, 0.1));
    for (let i = 0; i < 4; i++) {
      const p = (t / 40 + i * 0.07) % 1.3;
      const cx = g.W * (-0.1 + p * 1.1) - g.U * i * 2;
      const cy = g.H * (0.5 + i * 0.025) + Math.sin(t * 0.5 + i) * g.U * 1.5;
      const flap = Math.sin(t * 7 + i * 1.3) * g.U * 0.9;
      const s = Math.max(2, g.U * 1.2);
      ctx.fillRect(cx - s, cy - flap, s, 1);
      ctx.fillRect(cx, cy - flap, s, 1);
      ctx.fillRect(cx - 1, cy, 2, Math.max(1, g.U * 0.4));
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.4));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    if (props.trails > 0) {
      for (let i = 0; i < TRAILS.length; i++) drawTrail(ctx, g, TRAILS[i], t + 40, props.trails, props.planes);
    }
    ctx.drawImage(state.front, 0, 0);
    drawCrows(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'dusk', trails: 1, planes: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
