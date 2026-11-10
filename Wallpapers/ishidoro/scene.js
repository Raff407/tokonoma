/*
 * 石灯籠 Ishidoro — a mossy snow-viewing lantern with a candle lit inside, on a snowy night.
 *
 * Sky, pines, bamboo fence, ground and the stone lantern are baked once. The warm glow is
 * one soft layer drawn with a slow gentle breathing; the flame is a tiny shape in the
 * window. Snow is a short reused pool.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const SKY = ['#161d38', '#212b4a', '#2f3b5c', '#42506f', '#5a6784'];
  const FLAKES = 120;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, TAU);
    ctx.fill();
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const u = U * 1.35 * Math.min(1, W / (U * 150));
    return { W, H, U, u, ground: H * 0.8, cx: W * 0.5, fy: H * 0.55 };
  }

  // ---- backdrop ------------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.H);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / (g.H * 0.7)) * (inks.length - 1);
      const k = Math.floor(f);
      for (let x = 0; x < g.W; x++) {
        const ink = inks[Math.min(inks.length - 1, k + (rand() < f - k ? 1 : 0))];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function hills(ctx, g) {
    ctx.fillStyle = '#34405f';
    ctx.beginPath();
    ctx.moveTo(0, g.ground);
    for (let x = 0; x <= g.W + 3; x += 3) {
      ctx.lineTo(x, g.H * 0.5 + K.fbm(x / (g.U * 40), 2.2, 3, 5) * g.H * 0.12 - Math.sin(x / g.W * 3) * g.H * 0.02);
    }
    ctx.lineTo(g.W, g.ground);
    ctx.fill();
    ctx.fillStyle = '#d3d9e2';
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(0, g.ground);
    for (let x = 0; x <= g.W + 3; x += 3) {
      ctx.lineTo(x, g.H * 0.505 + K.fbm(x / (g.U * 40), 2.2, 3, 5) * g.H * 0.12 - Math.sin(x / g.W * 3) * g.H * 0.02);
    }
    ctx.lineTo(g.W, g.ground);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2a3552';
    ctx.beginPath();
    ctx.moveTo(0, g.ground);
    for (let x = 0; x <= g.W + 3; x += 3) {
      ctx.lineTo(x, g.H * 0.58 + K.fbm(x / (g.U * 25), 7.5, 3, 9) * g.H * 0.07);
    }
    ctx.lineTo(g.W, g.ground);
    ctx.fill();
  }

  // A pine seen from the side: trunk and flat pads of needles, each with snow on top.
  function pine(ctx, g, x, y, h, lean) {
    ctx.strokeStyle = '#2b2530';
    ctx.lineWidth = Math.max(1.5, h * 0.045);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.4, y - h * 0.5, x + lean, y - h);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const f = 0.32 + i * 0.15;
      const side = i % 2 ? 1 : -1;
      const px = x + lean * f + side * h * 0.1;
      const py = y - h * f;
      const w = h * (0.3 - f * 0.12);
      ctx.fillStyle = '#1d3030';
      blob(ctx, px, py, w, w * 0.4);
      ctx.fillStyle = '#2b4339';
      blob(ctx, px - w * 0.1, py - w * 0.12, w * 0.8, w * 0.28);
      ctx.fillStyle = '#e3e7ec';
      blob(ctx, px - w * 0.1, py - w * 0.3, w * 0.72, w * 0.18);
      ctx.fillStyle = '#b9c3d4';
      blob(ctx, px + w * 0.05, py - w * 0.16, w * 0.6, w * 0.07);
    }
  }

  // Bamboo fence: upright split poles tied to horizontal rails, with caps of snow.
  function fence(ctx, g, x0, x1, y, h) {
    const step = Math.max(2, g.U * 1.9);
    for (let x = x0; x < x1; x += step) {
      const top = y - h * (1 + 0.04 * Math.sin(x * 0.7));
      ctx.fillStyle = '#6b7452';
      ctx.fillRect(x, top, Math.max(1, step * 0.62), y - top);
      ctx.fillStyle = '#8a9266';
      ctx.fillRect(x, top, Math.max(1, step * 0.2), y - top);
      ctx.fillStyle = '#e6eaef';
      ctx.fillRect(x - 0.5, top - g.U * 0.9, Math.max(1, step * 0.62) + 1, g.U * 1.1);
    }
    ctx.fillStyle = '#4d4a3c';
    ctx.fillRect(x0, y - h * 0.72, x1 - x0, Math.max(1, g.U * 0.7));
    ctx.fillRect(x0, y - h * 0.3, x1 - x0, Math.max(1, g.U * 0.7));
    ctx.fillStyle = '#b8c2d2';
    ctx.fillRect(x0, y - h * 0.72 - g.U * 0.35, x1 - x0, Math.max(1, g.U * 0.35));
  }

  function paintGround(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, g.ground - g.U * 4, 0, g.H);
    grad.addColorStop(0, '#9ba9c2');
    grad.addColorStop(0.45, '#b4c0d4');
    grad.addColorStop(1, '#8e9bb8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.ground - g.U * 4, g.W, g.H - g.ground + g.U * 4);
    ctx.fillStyle = '#7d8aa8';
    for (let i = 0; i < 12; i++) {
      const x = rand() * g.W;
      const y = g.ground + g.U * (1 + rand() * 18);
      blob(ctx, x, y, g.U * (6 + rand() * 12), g.U * (0.35 + rand() * 0.4));
    }
    ctx.fillStyle = '#dfe5ee';
    for (let i = 0; i < 10; i++) {
      const x = rand() * g.W;
      const y = g.ground + g.U * (2 + rand() * 17);
      blob(ctx, x, y, g.U * (5 + rand() * 9), g.U * 0.3);
    }
  }

  // Round stepping stones capped with snow, leading toward the lantern.
  function steppingStones(ctx, g) {
    const pts = [[-0.2, 7], [-0.12, 12], [0.1, 15.5], [0.16, 10.5]];
    for (const [dx, dy] of pts) {
      const x = g.cx + dx * g.W * 0.6;
      const y = g.ground + g.U * dy;
      const r = g.U * (3.2 + dy * 0.12);
      ctx.fillStyle = '#4b5263';
      blob(ctx, x, y, r, r * 0.34);
      ctx.fillStyle = '#6e7587';
      blob(ctx, x, y - r * 0.08, r * 0.9, r * 0.27);
      ctx.fillStyle = '#e5e9ef';
      blob(ctx, x - r * 0.1, y - r * 0.2, r * 0.6, r * 0.16);
    }
  }

  // ---- the lantern ---------------------------------------------------------

  const STONE = { dark: '#4a515e', mid: '#69717f', light: '#949caa', snow: '#eaeef3', snowShade: '#b3bed0' };
  const MOSS = ['#3f5230', '#566b3a', '#76874a'];

  function mossPatch(ctx, rand, x, y, rx, ry) {
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = MOSS[i];
      for (let k = 0; k < 3 - i; k++) {
        blob(ctx, x + (rand() - 0.5) * rx * 1.2, y + (rand() - 0.5) * ry * 0.8, rx * (0.45 - i * 0.1) * (0.7 + rand() * 0.5), ry * (0.5 - i * 0.1));
      }
    }
  }

  function paintLantern(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.u;
    const x = g.cx;
    const y0 = g.ground + g.U * 6;
    const winX = [];

    // base stone and three bowed legs
    ctx.fillStyle = '#2d3240';
    blob(ctx, x, y0 + u * 0.5, u * 13, u * 2.2);
    ctx.fillStyle = STONE.mid;
    blob(ctx, x, y0, u * 12, u * 2);
    ctx.fillStyle = STONE.light;
    blob(ctx, x - u * 2, y0 - u * 0.5, u * 9, u * 1);
    ctx.fillStyle = STONE.snow;
    blob(ctx, x - u * 1, y0 - u * 1.2, u * 9, u * 0.9);
    const legTop = y0 - u * 14;
    const legs = [[-8, 0.8], [0, 1], [8, 0.8]];
    for (const [dx, s] of legs) {
      const lx = x + dx * u;
      ctx.fillStyle = dx === 0 ? STONE.mid : STONE.dark;
      poly(ctx, [lx - u * 2.2 * s, y0 - u * 1, lx - u * 1.3 * s + dx * 0.1 * u, legTop, lx + u * 1.3 * s + dx * 0.1 * u, legTop, lx + u * 2.2 * s, y0 - u * 1]);
      ctx.fillStyle = STONE.light;
      poly(ctx, [lx - u * 1.2 * s, y0 - u * 2, lx - u * 0.6 * s, legTop + u * 1.5, lx - u * 0.1 * s, legTop + u * 1.5, lx - u * 0.4 * s, y0 - u * 2]);
    }
    mossPatch(ctx, rand, x - u * 7, y0 - u * 2.4, u * 5, u * 2);
    mossPatch(ctx, rand, x + u * 6, y0 - u * 1.8, u * 4, u * 1.6);

    // bowl-shaped shoulder the shaft sits in
    ctx.fillStyle = STONE.dark;
    blob(ctx, x, legTop + u * 0.4, u * 13, u * 2.8);
    ctx.fillStyle = STONE.mid;
    blob(ctx, x, legTop - u * 0.2, u * 12.5, u * 2.3);
    ctx.fillStyle = STONE.light;
    blob(ctx, x - u * 3, legTop - u * 0.9, u * 8, u * 1);
    ctx.fillStyle = STONE.snow;
    blob(ctx, x - u * 1, legTop - u * 1.5, u * 10, u * 1.05);
    ctx.fillStyle = STONE.snowShade;
    blob(ctx, x + u * 2, legTop - u * 0.9, u * 8, u * 0.4);
    mossPatch(ctx, rand, x - u * 9, legTop + u * 0.6, u * 4, u * 1.6);
    mossPatch(ctx, rand, x + u * 8, legTop + u * 0.8, u * 3.6, u * 1.4);

    // fire box with its glowing windows
    const bw = u * 7.5;
    const bh = u * 10;
    const by1 = legTop - u * 2.2;
    const by0 = by1 - bh;
    ctx.fillStyle = STONE.dark;
    ctx.fillRect(x - bw, by0, bw * 2, bh);
    ctx.fillStyle = STONE.mid;
    ctx.fillRect(x - bw, by0, bw * 1.15, bh);
    ctx.fillStyle = STONE.light;
    ctx.fillRect(x - bw, by0, Math.max(1, u * 0.7), bh);
    const wx = x - bw * 0.62;
    const ww = bw * 1.24;
    const wy = by0 + bh * 0.2;
    const wh = bh * 0.6;
    ctx.fillStyle = '#7a4a22';
    ctx.fillRect(wx - u * 0.5, wy - u * 0.5, ww + u, wh + u);
    ctx.fillStyle = '#f0b950';
    ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = '#fbe3a0';
    ctx.fillRect(wx + ww * 0.15, wy + wh * 0.1, ww * 0.7, wh * 0.8);
    winX.push(x, wy + wh * 0.6, ww, wh);
    // a thin lattice across the opening
    ctx.fillStyle = '#7a4a22';
    ctx.fillRect(x - Math.max(0.5, u * 0.3), wy, Math.max(1, u * 0.6), wh);
    ctx.fillRect(wx, wy + wh * 0.5 - u * 0.3, ww, Math.max(1, u * 0.6));
    // side crescent opening on the right face
    ctx.fillStyle = '#c98f3a';
    blob(ctx, x + bw * 0.86, by0 + bh * 0.5, bw * 0.08, bh * 0.28);

    // roof: wide hexagonal kasa with upswept eaves, snow heaped on top
    const ry = by0;
    const rw = u * 21;
    const rh = u * 7.5;
    ctx.fillStyle = '#2b303c';
    poly(ctx, [x - rw, ry + u * 1.2, x - bw * 1.2, ry - u * 0.6, x + bw * 1.2, ry - u * 0.6, x + rw, ry + u * 1.2, x + rw * 0.8, ry + u * 2, x - rw * 0.8, ry + u * 2]);
    ctx.fillStyle = STONE.dark;
    poly(ctx, [x - rw * 0.95, ry + u * 0.9, x - bw * 1.1, ry - rh * 0.7, x + bw * 1.1, ry - rh * 0.7, x + rw * 0.95, ry + u * 0.9]);
    ctx.fillStyle = STONE.mid;
    poly(ctx, [x - rw * 0.95, ry + u * 0.9, x - bw * 1.1, ry - rh * 0.7, x - bw * 0.1, ry - rh * 0.7, x - rw * 0.3, ry + u * 0.9]);
    mossPatch(ctx, rand, x - rw * 0.65, ry + u * 0.3, u * 5, u * 1.4);
    mossPatch(ctx, rand, x + rw * 0.6, ry + u * 0.4, u * 4.4, u * 1.3);
    // the snow cap
    ctx.fillStyle = STONE.snowShade;
    ctx.beginPath();
    ctx.moveTo(x - rw * 0.92, ry + u * 0.6);
    ctx.quadraticCurveTo(x - rw * 0.5, ry - rh * 1.15, x, ry - rh * 1.35);
    ctx.quadraticCurveTo(x + rw * 0.5, ry - rh * 1.15, x + rw * 0.92, ry + u * 0.6);
    ctx.quadraticCurveTo(x + rw * 0.4, ry + u * 0.1, x, ry + u * 0.2);
    ctx.quadraticCurveTo(x - rw * 0.4, ry + u * 0.1, x - rw * 0.92, ry + u * 0.6);
    ctx.fill();
    ctx.fillStyle = STONE.snow;
    ctx.beginPath();
    ctx.moveTo(x - rw * 0.85, ry + u * 0.2);
    ctx.quadraticCurveTo(x - rw * 0.5, ry - rh * 1.2, x - u * 0.5, ry - rh * 1.42);
    ctx.quadraticCurveTo(x + rw * 0.3, ry - rh * 1.2, x + rw * 0.55, ry - u * 0.8);
    ctx.quadraticCurveTo(x, ry - u * 0.5, x - rw * 0.85, ry + u * 0.2);
    ctx.fill();

    // jewel finial on top of the snow
    const fy = ry - rh * 1.35;
    ctx.fillStyle = STONE.mid;
    blob(ctx, x, fy - u * 0.3, u * 1.6, u * 0.8);
    ctx.fillStyle = STONE.dark;
    blob(ctx, x, fy - u * 2, u * 1.5, u * 1.9);
    ctx.fillStyle = STONE.light;
    blob(ctx, x - u * 0.4, fy - u * 2.4, u * 0.7, u * 1);
    ctx.fillStyle = STONE.snow;
    blob(ctx, x, fy - u * 3.8, u * 0.9, u * 0.4);
    return { canvas: c, win: winX, roofY: ry, topY: fy - u * 4, y0 };
  }

  // Warm glow: a soft disc round the windows plus a pool on the snow below.
  function paintGlow(g, lan) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const [x, y] = lan.win;
    const r = g.u * 40;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,214,120,0.8)');
    grad.addColorStop(0.3, 'rgba(240,170,80,0.45)');
    grad.addColorStop(0.7, 'rgba(200,120,60,0.15)');
    grad.addColorStop(1, 'rgba(200,120,60,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.save();
    ctx.translate(x, lan.y0 + g.u * 1.5);
    ctx.scale(1, 0.22);
    const pr = g.u * 30;
    const pg = ctx.createRadialGradient(0, 0, 0, 0, 0, pr);
    pg.addColorStop(0, 'rgba(255,205,120,0.42)');
    pg.addColorStop(1, 'rgba(255,205,120,0)');
    ctx.fillStyle = pg;
    ctx.fillRect(-pr, -pr, pr * 2, pr * 2);
    ctx.restore();
    return c;
  }

  function paintBack(g, rand, lan) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    hills(ctx, g);
    ctx.fillStyle = '#c5cedc';
    ctx.fillRect(0, g.ground - g.U * 1.2, g.W, g.U * 1.4);
    pine(ctx, g, g.W * 0.12, g.ground - g.U * 1, g.H * 0.46, g.U * 3);
    pine(ctx, g, g.W * 0.9, g.ground - g.U * 0.5, g.H * 0.34, -g.U * 4);
    pine(ctx, g, g.W * 0.2, g.ground - g.U * 0.5, g.H * 0.2, g.U * 2);
    fence(ctx, g, 0, g.W, g.ground - g.U * 0.2, g.H * 0.15);
    paintGround(ctx, g, rand);
    steppingStones(ctx, g);
    ctx.drawImage(lan.canvas, 0, 0);
    return c;
  }

  // ---- snow ----------------------------------------------------------------

  function makeFlakes(g, rand) {
    const f = { x: new Float32Array(FLAKES), y: new Float32Array(FLAKES), v: new Float32Array(FLAKES),
      s: new Float32Array(FLAKES), p: new Float32Array(FLAKES) };
    for (let i = 0; i < FLAKES; i++) {
      f.x[i] = rand() * g.W;
      f.y[i] = rand() * g.H;
      f.v[i] = 0.5 + rand();
      f.s[i] = rand();
      f.p[i] = rand() * TAU;
    }
    return f;
  }

  function drawSnow(ctx, g, t, dt, count) {
    const f = state.flakes;
    const step = Math.min(dt, 0.1);
    ctx.fillStyle = '#f2f4f7';
    for (let i = 0; i < count; i++) {
      f.y[i] += g.U * 4.2 * f.v[i] * step;
      f.x[i] += (Math.sin(t * 0.5 + f.p[i]) * 1.4 + 0.5) * g.U * 0.8 * step;
      if (f.y[i] > g.H + 2) { f.y[i] = -2; f.x[i] = Math.random() * g.W; }
      if (f.x[i] > g.W + 2) f.x[i] = -2;
      const sz = Math.max(1, g.U * (0.6 + f.s[i] * 0.9));
      ctx.globalAlpha = 0.5 + 0.45 * f.s[i];
      ctx.fillRect(f.x[i], f.y[i], sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    const lan = paintLantern(g, rand);
    state.g = g;
    state.lan = lan;
    state.back = paintBack(g, rand, lan);
    state.glow = paintGlow(g, lan);
    state.flakes = makeFlakes(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { snow, glow } = api.props;
    const count = Math.min(FLAKES, Math.round(85 * snow));
    ctx.drawImage(state.back, 0, 0);
    const flick = 0.86 + 0.09 * Math.sin(t * 1.7) + 0.05 * Math.sin(t * 4.3 + 1.2);
    ctx.globalAlpha = Math.min(1, flick * glow);
    ctx.drawImage(state.glow, 0, 0);
    // flame: a small bright shape that sways in the window
    const [wx, wy, ww, wh] = state.lan.win;
    const sway = Math.sin(t * 2.1) * ww * 0.03 + Math.sin(t * 5.3) * ww * 0.012;
    ctx.globalAlpha = Math.min(1, 0.85 * flick);
    ctx.fillStyle = '#fff3c4';
    ctx.fillRect(wx - ww * 0.06 + sway, wy - wh * 0.4, Math.max(1, ww * 0.12), wh * (0.5 + 0.05 * Math.sin(t * 3.1)));
    ctx.globalAlpha = 1;
    drawSnow(ctx, g, t, dt, count);
  }

  Kasuri.run({
    defaults: { snow: 1, glow: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
