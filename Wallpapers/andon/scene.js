/*
 * 行灯 Andon — a paper floor lamp in a dark tatami room at night.
 *
 * Room, lamp and the pool of light are baked once. Each frame lays the light over the
 * room at a slowly breathing strength, then a moth or two circles the lamp and throws
 * its shadow, much larger, across the back wall.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const FLOOR = 0.6;
  const MAX_MOTHS = 3;
  const GLOW = '#e8c27a';
  const ROOM = {
    beam: '#2c2420', plaster: '#3b342c', plasterLow: '#363027', pillar: '#30261f',
    shoji: '#4b5061', kumiko: '#2a2a31', shojiLit: '#5c6070',
    mat: '#424029', matAlt: '#3c3a26', seam: '#33311f', heri: '#262a36', skirting: '#2a221c',
  };
  const LAMP = {
    paper: '#d6b77c', inner: '#e7cd98', hot: '#f3e2b6', side: '#a98c5c',
    frame: '#3a2a1e', frameLit: '#5a4330', foot: '#241b15',
  };
  const SCROLL = { roll: '#2a2420', silk: '#3c4256', paper: '#8a8068', ink: '#3f4a36', seal: '#9a4a36' };
  const CUSHION = { top: '#3d4766', side: '#2b3249', lit: '#556083' };
  const MOTH = { wing: '#a08a66', dark: '#5e4e3a', shadow: '#1e1a17' };
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function rect(ctx, color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, TAU);
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = Math.min(H / 100, W / 130);
    const fy = Math.round(H * FLOOR);
    const lh = U * 50;
    const lw = U * 17;
    const cx = W * 0.6;
    const foot = H * 0.86;
    return { W, H, U, fy, lh, lw, cx, foot, top: foot - lh, flameY: foot - lh * 0.42 };
  }

  // ---- room ----------------------------------------------------------------

  function paintWall(ctx, g) {
    rect(ctx, ROOM.plaster, 0, 0, g.W, g.fy);
    rect(ctx, ROOM.plasterLow, 0, g.fy - g.U * 9, g.W, g.U * 9);
    rect(ctx, ROOM.beam, 0, 0, g.W, g.H * 0.07);
    rect(ctx, ROOM.beam, 0, g.H * 0.13, g.W, g.U * 2.2);
    const sx1 = g.W * 0.3;
    rect(ctx, ROOM.shoji, 0, g.H * 0.13 + g.U * 2.2, sx1, g.fy - g.H * 0.13);
    ctx.fillStyle = ROOM.kumiko;
    const step = g.U * 6;
    for (let x = step * 0.6; x < sx1; x += step) ctx.fillRect(Math.round(x), g.H * 0.13, Math.max(1, g.U * 0.5), g.fy - g.H * 0.13);
    for (let y = g.H * 0.13 + step; y < g.fy; y += step * 1.4) ctx.fillRect(0, Math.round(y), sx1, Math.max(1, g.U * 0.5));
    rect(ctx, ROOM.pillar, sx1, 0, g.U * 3.2, g.fy);
    rect(ctx, ROOM.pillar, g.W * 0.94, 0, g.U * 3.2, g.fy);
    rect(ctx, ROOM.skirting, 0, g.fy - g.U * 1.2, g.W, g.U * 1.2);
  }

  function paintScroll(ctx, g) {
    const w = g.U * 11;
    const x = g.W * 0.83 - w / 2;
    const y = g.H * 0.13 + g.U * 4;
    const h = g.U * 36;
    rect(ctx, SCROLL.silk, x, y, w, h);
    rect(ctx, SCROLL.paper, x + g.U * 1.6, y + g.U * 5, w - g.U * 3.2, h - g.U * 10);
    rect(ctx, SCROLL.roll, x - g.U, y - g.U, w + g.U * 2, g.U * 1.4);
    rect(ctx, SCROLL.roll, x - g.U * 1.4, y + h, w + g.U * 2.8, g.U * 1.6);
    ctx.strokeStyle = SCROLL.ink;
    ctx.lineWidth = Math.max(1, g.U * 1.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5, y + g.U * 8);
    ctx.quadraticCurveTo(x + w * 0.25, y + h * 0.45, x + w * 0.55, y + h * 0.78);
    ctx.stroke();
    rect(ctx, SCROLL.seal, x + w * 0.62, y + h * 0.7, g.U * 1.4, g.U * 1.4);
  }

  function floorY(g, f) {
    return g.fy + (g.H - g.fy) * Math.pow(f, 1.5);
  }

  function paintFloor(ctx, g) {
    rect(ctx, ROOM.mat, 0, g.fy, g.W, g.H - g.fy);
    const vx = g.W * 0.5;
    const vy = g.fy - g.H * 0.9;
    const rows = [0, 0.35, 1];
    for (let r = 0; r < rows.length - 1; r++) {
      const y0 = floorY(g, rows[r]);
      const y1 = floorY(g, rows[r + 1]);
      for (let k = -8; k < 8; k++) {
        if ((k + r) % 2 === 0) continue;
        const xa = vx + k * g.U * 34;
        poly4(ctx, ROOM.matAlt, g, vx, vy, xa, xa + g.U * 34, y0, y1);
      }
    }
    ctx.strokeStyle = ROOM.heri;
    ctx.lineWidth = Math.max(1, g.U * 1.3);
    for (let k = -8; k <= 8; k++) {
      const x = vx + k * g.U * 34;
      line(ctx, g, vx, vy, x, g.fy, g.H);
    }
    for (let r = 1; r < rows.length - 1; r++) {
      rect(ctx, ROOM.heri, 0, floorY(g, rows[r]), g.W, g.U * 1.6);
    }
    ctx.strokeStyle = ROOM.seam;
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    for (let f = 0.08; f < 1; f += 0.09) {
      const y = Math.round(floorY(g, f));
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(g.W, y);
      ctx.stroke();
    }
  }

  // A column on the floor running toward the vanishing point, between depth rows y0..y1.
  function poly4(ctx, color, g, vx, vy, xa, xb, y0, y1) {
    const at = (x, y) => vx + (x - vx) * ((y - vy) / (g.H - vy));
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(at(xa, y0), y0);
    ctx.lineTo(at(xb, y0), y0);
    ctx.lineTo(at(xb, y1), y1);
    ctx.lineTo(at(xa, y1), y1);
    ctx.closePath();
    ctx.fill();
  }

  function line(ctx, g, vx, vy, x, y0, y1) {
    const at = (y) => vx + (x - vx) * ((y - vy) / (g.H - vy));
    ctx.beginPath();
    ctx.moveTo(at(y0), y0);
    ctx.lineTo(at(y1), y1);
    ctx.stroke();
  }

  function paintCushion(ctx, g) {
    const x = g.W * 0.3;
    const y = g.H * 0.86;
    const w = g.U * 26;
    const h = g.U * 7;
    ctx.fillStyle = CUSHION.side;
    blob(ctx, x, y + g.U * 1.6, w / 2, h / 2);
    ctx.fillStyle = CUSHION.top;
    blob(ctx, x, y, w / 2, h / 2);
    ctx.fillStyle = CUSHION.lit;
    blob(ctx, x + w * 0.16, y - h * 0.08, w * 0.28, h * 0.3);
  }

  function paintRoom(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintWall(ctx, g);
    paintScroll(ctx, g);
    paintFloor(ctx, g);
    paintCushion(ctx, g);
    return c;
  }

  // ---- light ---------------------------------------------------------------

  // Stacked translucent ellipses of one colour give a few flat bands of light.
  function bands(ctx, x, y, rx, ry, n, alpha) {
    ctx.fillStyle = GLOW;
    ctx.globalAlpha = alpha;
    for (let i = 0; i < n; i++) {
      const f = 1 - i / n;
      blob(ctx, x, y, rx * f, ry * f);
    }
    ctx.globalAlpha = 1;
  }

  function paintGlow(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, g.W, g.fy);
    ctx.clip();
    bands(ctx, g.cx, g.flameY - g.U * 4, g.U * 66, g.U * 48, 6, 0.13);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, g.fy, g.W, g.H - g.fy);
    ctx.clip();
    bands(ctx, g.cx, g.foot, g.U * 62, g.U * 17, 6, 0.14);
    ctx.restore();
    // the frame legs cast four dim spokes across the lit floor
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = g.U * 1.6;
    for (const dx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(g.cx + dx * g.lw * 0.5, g.foot);
      ctx.lineTo(g.cx + dx * g.U * 50, g.foot + g.U * 10);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  function paintLamp(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const x0 = g.cx - g.lw / 2;
    const legs = g.U * 6;
    const by = g.top + g.U * 4;
    const bh = g.lh - legs - g.U * 4;
    const side = g.U * 4;
    const t = Math.max(1, g.U * 1.1);
    rect(ctx, LAMP.side, x0 + g.lw, by + g.U * 0.6, side, bh - g.U * 0.6);
    rect(ctx, LAMP.paper, x0, by, g.lw, bh);
    rect(ctx, LAMP.inner, x0 + g.lw * 0.14, by + bh * 0.12, g.lw * 0.72, bh * 0.8);
    rect(ctx, LAMP.frame, x0 - t / 2, g.top, t, g.lh);
    rect(ctx, LAMP.frame, x0 + g.lw - t / 2, g.top, t, g.lh);
    rect(ctx, LAMP.frame, x0 + g.lw + side - t / 2, g.top + g.U * 0.6, t, g.lh - g.U * 0.6);
    for (const f of [0, 0.5, 1]) rect(ctx, LAMP.frameLit, x0, by + bh * f - t / 2, g.lw + side, t);
    rect(ctx, LAMP.frame, x0, g.top + g.U * 0.4, g.lw + side, t);
    ctx.strokeStyle = LAMP.frame;
    ctx.lineWidth = t;
    ctx.beginPath();
    ctx.moveTo(x0 + g.lw * 0.25, g.top + g.U * 0.4);
    ctx.quadraticCurveTo(g.cx + side / 2, g.top - g.U * 5, x0 + g.lw * 0.75 + side, g.top + g.U * 0.4);
    ctx.stroke();
    rect(ctx, LAMP.foot, x0 - g.U, g.foot - g.U * 1.2, g.lw + side + g.U * 2, g.U * 1.4);
    return c;
  }

  function paintHot(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const legs = g.U * 6;
    const by = g.top + g.U * 4;
    const bh = g.lh - legs - g.U * 4;
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.cx - g.lw / 2, by, g.lw, bh);
    ctx.clip();
    ctx.fillStyle = LAMP.hot;
    ctx.globalAlpha = 0.5;
    blob(ctx, g.cx, g.flameY, g.lw * 0.5, bh * 0.38);
    blob(ctx, g.cx, g.flameY, g.lw * 0.3, bh * 0.22);
    ctx.globalAlpha = 1;
    ctx.restore();
    const t = Math.max(1, g.U * 1.1);
    rect(ctx, LAMP.frameLit, g.cx - g.lw / 2, by + bh * 0.5 - t / 2, g.lw, t);
    return c;
  }

  // ---- moths ---------------------------------------------------------------

  function makeMoths(rand) {
    const f = () => new Float32Array(MAX_MOTHS);
    const m = { a: f(), w: f(), rx: f(), ry: f(), cy: f(), p: f(), x: f(), y: f(), z: f() };
    for (let i = 0; i < MAX_MOTHS; i++) {
      m.a[i] = rand() * TAU;
      m.w[i] = (1.1 + rand() * 0.6) * (i % 2 ? -1 : 1);
      m.rx[i] = 1.2 + rand() * 0.5;
      m.ry[i] = 0.35 + rand() * 0.25;
      m.cy[i] = 0.62 + rand() * 0.25;
      m.p[i] = rand() * TAU;
    }
    return m;
  }

  function placeMoths(g, t, n) {
    const m = state.moths;
    for (let i = 0; i < n; i++) {
      const a = m.a[i] + t * m.w[i] + Math.sin(t * 0.7 + m.p[i]) * 0.6;
      const r = g.lw * (m.rx[i] + Math.sin(t * 1.3 + m.p[i]) * 0.25);
      m.x[i] = g.cx + Math.cos(a) * r;
      m.y[i] = g.foot - g.lh * m.cy[i] + Math.sin(a * 2 + m.p[i]) * g.U * 3 + Math.sin(a) * g.lw * m.ry[i];
      m.z[i] = Math.sin(a);
    }
  }

  function moth(ctx, g, x, y, s, flap, wing, body) {
    const ww = g.U * 3.4 * s;
    const wh = g.U * 2.1 * s * (0.35 + 0.65 * flap);
    ctx.fillStyle = wing;
    blob(ctx, x - ww * 0.55, y, ww * 0.6, wh);
    blob(ctx, x + ww * 0.55, y, ww * 0.6, wh);
    ctx.fillStyle = body;
    blob(ctx, x, y + g.U * 0.2 * s, g.U * 0.45 * s, g.U * 1.1 * s);
  }

  function drawShadows(ctx, g, t, n) {
    const m = state.moths;
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < n; i++) {
      const k = 3 - m.z[i];
      const sx = g.cx + (m.x[i] - g.cx) * k;
      const sy = g.flameY + (m.y[i] - g.flameY) * k * 0.9;
      if (sy > g.fy - g.U * 3) continue;
      const flap = Math.abs(Math.sin(t * 9 + m.p[i]));
      moth(ctx, g, sx, sy, k * 0.9, flap, MOTH.shadow, MOTH.shadow);
    }
    ctx.globalAlpha = 1;
  }

  function drawMoths(ctx, g, t, n, front) {
    const m = state.moths;
    for (let i = 0; i < n; i++) {
      if ((m.z[i] > 0) !== front) continue;
      const flap = Math.abs(Math.sin(t * 9 + m.p[i]));
      moth(ctx, g, m.x[i], m.y[i], 1 + m.z[i] * 0.15, flap, MOTH.wing, MOTH.dark);
    }
  }

  // ---- run -----------------------------------------------------------------

  function breathe(t) {
    return 0.6 * Math.sin(t * TAU / 6.5) + 0.3 * Math.sin(t * 1.7 + 1) + 0.1 * Math.sin(t * 3.3 + 2);
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.room = paintRoom(g);
    state.glow = paintGlow(g);
    state.lamp = paintLamp(g);
    state.hot = paintHot(g);
    state.moths = makeMoths(rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { breath, moths } = api.props;
    const n = Math.max(0, Math.min(MAX_MOTHS, Math.round(moths)));
    const b = breathe(t) * Math.min(2, Math.max(0, breath));
    placeMoths(g, t, n);
    ctx.drawImage(state.room, 0, 0);
    ctx.globalAlpha = Math.max(0, Math.min(1, 0.78 + 0.16 * b));
    ctx.drawImage(state.glow, 0, 0);
    ctx.globalAlpha = 1;
    drawShadows(ctx, g, t, n);
    drawMoths(ctx, g, t, n, false);
    ctx.drawImage(state.lamp, 0, 0);
    ctx.globalAlpha = Math.max(0, Math.min(1, 0.6 + 0.3 * b));
    ctx.drawImage(state.hot, 0, 0);
    ctx.globalAlpha = 1;
    drawMoths(ctx, g, t, n, true);
  }

  Kasuri.run({
    defaults: { breath: 1, moths: 2, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
