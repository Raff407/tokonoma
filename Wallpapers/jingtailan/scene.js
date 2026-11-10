/*
 * 景泰蓝 Jingtailan — cloisonne enamel: a lotus and scrolling vine in gold wire on deep blue.
 *
 * The piece is painted once. A second copy holds only the gold wire, drawn bright.
 * Each frame lays that copy through a slow slanted band, plus a few small glints.
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const GROUND = '#14276a';
  const GROUND_DEEP = '#0e1c52';
  const BLUE = '#2f4d98';
  const WASHI = '#ece4cf';
  const RED = '#c0452c';
  const RED_DEEP = '#8f2d20';
  const MOSS = '#47663f';
  const MOSS_LIGHT = '#6a8a55';
  const GOLD = '#c9a24a';
  const GOLD_LIT = '#f4dc8e';
  const GLINTS = 18;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function petalPath(ctx, len, wid) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(len * 0.1, -wid * 1.1, len * 0.7, -wid * 1.25, len * 0.9, -wid * 0.35);
    ctx.quadraticCurveTo(len * 0.98, -wid * 0.05, len, 0);
    ctx.quadraticCurveTo(len * 0.98, wid * 0.05, len * 0.9, wid * 0.35);
    ctx.bezierCurveTo(len * 0.7, wid * 1.25, len * 0.1, wid * 1.1, 0, 0);
    ctx.closePath();
  }

  // Draws one shape: the enamel fill only on the normal copy, the gold wire on both.
  function cell(ctx, fill, lit, lw) {
    if (!lit && fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.strokeStyle = lit ? GOLD_LIT : GOLD;
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  function ring(ctx, n, rot, dist, len, wid, fill, tint, lit, lw) {
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.rotate(rot + (i / n) * TAU);
      ctx.translate(dist, 0);
      petalPath(ctx, len, wid);
      cell(ctx, fill, lit, lw);
      if (tint && !lit) {
        ctx.fillStyle = tint;
        ctx.beginPath();
        ctx.ellipse(len * 0.62, 0, len * 0.24, wid * 0.32, 0, 0, TAU);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(len * 0.1, 0);
      ctx.lineTo(len * 0.7, 0);
      ctx.strokeStyle = lit ? GOLD_LIT : GOLD;
      ctx.lineWidth = lw * 0.7;
      ctx.stroke();
      ctx.restore();
    }
  }

  function lotus(ctx, x, y, r, rot, lit, lw) {
    ctx.save();
    ctx.translate(x, y);
    ring(ctx, 9, rot, r * 0.1, r * 0.92, r * 0.24, RED, WASHI, lit, lw);
    ring(ctx, 7, rot + 0.25, r * 0.08, r * 0.7, r * 0.24, WASHI, RED, lit, lw);
    ring(ctx, 5, rot + 0.5, r * 0.06, r * 0.46, r * 0.2, BLUE, WASHI, lit, lw);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.2, 0, TAU);
    cell(ctx, GOLD, lit, lw);
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(Math.cos(i * 1.047) * r * 0.1, Math.sin(i * 1.047) * r * 0.1, Math.max(0.6, r * 0.025), 0, TAU);
      ctx.fillStyle = lit ? GOLD_LIT : GROUND_DEEP;
      ctx.fill();
    }
    ctx.restore();
  }

  function leaf(ctx, x, y, ang, len, wid, lit, lw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(len * 0.25, -wid * 1.2, len * 0.75, -wid * 0.9, len, wid * 0.2);
    ctx.bezierCurveTo(len * 0.7, wid * 0.8, len * 0.3, wid * 0.9, 0, 0);
    ctx.closePath();
    cell(ctx, MOSS, lit, lw);
    if (!lit) {
      ctx.fillStyle = MOSS_LIGHT;
      ctx.beginPath();
      ctx.ellipse(len * 0.55, -wid * 0.1, len * 0.28, wid * 0.22, 0.1, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(len * 0.05, 0);
    ctx.quadraticCurveTo(len * 0.5, -wid * 0.2, len * 0.92, wid * 0.15);
    ctx.strokeStyle = lit ? GOLD_LIT : GOLD;
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();
    ctx.restore();
  }

  function spiral(ctx, x, y, r, dir, ang, lit, lw) {
    ctx.beginPath();
    for (let a = 0; a <= 9.4; a += 0.3) {
      const rr = r * (1 - a / 11);
      const px = x + Math.cos(ang + dir * a) * rr - Math.cos(ang) * r;
      const py = y + Math.sin(ang + dir * a) * rr - Math.sin(ang) * r;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = lit ? GOLD_LIT : GOLD;
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  function bud(ctx, x, y, s, ang, lit, lw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    petalPath(ctx, s * 2.2, s * 0.9);
    cell(ctx, RED, lit, lw);
    ctx.rotate(0.45);
    petalPath(ctx, s * 1.8, s * 0.6);
    cell(ctx, WASHI, lit, lw * 0.8);
    ctx.rotate(-0.9);
    petalPath(ctx, s * 1.8, s * 0.6);
    cell(ctx, WASHI, lit, lw * 0.8);
    ctx.restore();
  }

  // Border of upright lotus petals along an edge, alternating red and blue.
  function petalBorder(ctx, g, y, h, up, lit, lw) {
    if (!lit) {
      ctx.fillStyle = GROUND_DEEP;
      ctx.fillRect(0, up ? y : y, g.W, h);
    }
    const w = h * 0.95;
    let k = 0;
    for (let x = w / 2; x < g.W + w; x += w) {
      ctx.save();
      ctx.translate(x, up ? y + h : y);
      ctx.rotate(up ? -Math.PI / 2 : Math.PI / 2);
      petalPath(ctx, h * 0.92, w * 0.5);
      cell(ctx, k % 2 ? BLUE : RED, lit, lw);
      if (!lit) {
        ctx.fillStyle = WASHI;
        ctx.beginPath();
        ctx.ellipse(h * 0.5, 0, h * 0.22, w * 0.14, 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      k++;
    }
  }

  // Ruyi cloud head: three lobes and a curled tail.
  function ruyi(ctx, x, y, s, flip, lit, lw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip ? -s : s, s);
    ctx.beginPath();
    ctx.arc(0, 0, 1.5, Math.PI * 0.9, Math.PI * 2.1);
    ctx.arc(1.8, 0.8, 1.2, Math.PI * 1.3, Math.PI * 0.4);
    ctx.bezierCurveTo(1.5, 2.6, -1, 2.4, -2.4, 1.8);
    ctx.bezierCurveTo(-3.6, 1.2, -1.8, -0.2, -1.4, 0);
    ctx.closePath();
    ctx.restore();
    if (!lit) {
      ctx.fillStyle = BLUE;
      ctx.fill();
    }
    ctx.strokeStyle = lit ? GOLD_LIT : GOLD;
    ctx.lineWidth = lw * 0.9;
    ctx.stroke();
  }

  function vineY(g, x) {
    return g.H * 0.5 + g.U * 7 * Math.sin((x - g.W / 2) / (g.U * 17));
  }

  function paint(g, lit) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const lw = Math.max(1, g.U * 0.34);
    if (!lit) {
      ctx.fillStyle = GROUND;
      ctx.fillRect(0, 0, g.W, g.H);
    }
    // ground: scattered ruyi clouds
    const rs = g.U * 4.4;
    for (let j = 0; j < 3; j++) {
      const ys = j === 0 ? g.H * 0.2 : j === 1 ? g.H * 0.79 : g.H * 0.5;
      for (let i = 0; i * g.U * 21 < g.W + g.U * 21; i++) {
        const x = i * g.U * 21 + (j % 2 ? g.U * 10 : g.U * 4);
        if (j === 2 && Math.abs(x - g.W / 2) < g.U * 70) continue;
        ctx.save();
        ruyi(ctx, x, ys + (i % 2 ? g.U * 2 : -g.U * 2), rs * 0.75, i % 2 === 0, lit, lw);
        ctx.restore();
      }
    }
    const cx = g.W / 2;
    // stem
    ctx.beginPath();
    for (let x = -4; x <= g.W + 4; x += 3) {
      if (x === -4) ctx.moveTo(x, vineY(g, x));
      else ctx.lineTo(x, vineY(g, x));
    }
    ctx.strokeStyle = lit ? GOLD_LIT : MOSS;
    ctx.lineWidth = g.U * 1.1;
    ctx.stroke();
    ctx.strokeStyle = lit ? GOLD_LIT : GOLD;
    ctx.lineWidth = lw;
    ctx.stroke();
    // leaves, tendrils, buds
    const nodes = [[34, -1], [-34, -1], [-34, 1], [34, 1], [74, -1], [-74, -1], [74, 1], [-74, 1], [52, -1], [-52, 1]];
    for (const [dx, up] of nodes) {
      const x = cx + dx * g.U;
      const y = vineY(g, x);
      const out = dx > 0 ? 0 : Math.PI;
      leaf(ctx, x, y, out + up * 0.9 * (dx > 0 ? 1 : -1) + (dx > 0 ? 0 : 0), g.U * 15, g.U * 4.2, lit, lw);
    }
    for (const dx of [-62, -44, 44, 62, 88, -88]) {
      const x = cx + dx * g.U;
      const y = vineY(g, x);
      const up = dx % 2 === 0 ? -1 : 1;
      spiral(ctx, x, y + up * g.U * 6, g.U * 4.4, up * Math.sign(dx), up > 0 ? Math.PI * 1.5 : Math.PI * 0.5, lit, lw);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + up * g.U * 3);
      ctx.strokeStyle = lit ? GOLD_LIT : GOLD;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    for (const dx of [-28, 28]) {
      const x = cx + dx * g.U;
      bud(ctx, x, vineY(g, x) - g.U * 11, g.U * 2.6, -Math.PI / 2 + dx * 0.012, lit, lw);
    }
    lotus(ctx, cx - 60 * g.U, vineY(g, cx - 60 * g.U), g.U * 13, 0.3, lit, lw * 0.9);
    lotus(ctx, cx + 60 * g.U, vineY(g, cx + 60 * g.U), g.U * 13, 0.1, lit, lw * 0.9);
    lotus(ctx, cx, g.H * 0.5, g.U * 27, 0.12, lit, lw);
    // borders
    const fh = g.U * 9;
    petalBorder(ctx, g, 0, fh, false, lit, lw * 0.9);
    petalBorder(ctx, g, g.H - fh, fh, true, lit, lw * 0.9);
    ctx.strokeStyle = lit ? GOLD_LIT : GOLD;
    ctx.lineWidth = lw * 1.4;
    ctx.beginPath();
    ctx.moveTo(0, fh);
    ctx.lineTo(g.W, fh);
    ctx.moveTo(0, g.H - fh);
    ctx.lineTo(g.W, g.H - fh);
    ctx.stroke();
    return c;
  }

  function band(ctx, g, x, half, slant) {
    ctx.beginPath();
    ctx.moveTo(x - half, 0);
    ctx.lineTo(x + half, 0);
    ctx.lineTo(x + half - slant, g.H);
    ctx.lineTo(x - half - slant, g.H);
    ctx.closePath();
  }

  function drawSheen(ctx, g, t, amount) {
    if (amount <= 0) return;
    const slant = g.H * 0.5;
    const span = g.W + slant + g.U * 60;
    const p = (t / 15) % 1;
    const cx = -g.U * 30 + p * span;
    for (let k = 0; k < 3; k++) {
      const half = g.U * (22 - k * 7);
      ctx.save();
      band(ctx, g, cx, half, slant);
      ctx.clip();
      ctx.globalAlpha = Math.min(1, amount) * (k === 0 ? 0.35 : k === 1 ? 0.5 : 0.7);
      ctx.drawImage(state.lit, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, g, t, amount) {
    if (amount <= 0) return;
    const G = state.glints;
    const sz = Math.max(1, g.U * 0.6);
    ctx.fillStyle = GOLD_LIT;
    for (let i = 0; i < GLINTS; i++) {
      const a = Math.sin(t * G.s[i] + G.p[i]);
      if (a <= 0.3) continue;
      ctx.globalAlpha = Math.min(1, (a - 0.3) * amount * 0.8);
      ctx.fillRect(G.x[i], G.y[i], sz, sz);
      ctx.fillRect(G.x[i] - sz, G.y[i] + sz * 0.35, sz * 3, Math.max(1, sz * 0.3));
    }
    ctx.globalAlpha = 1;
  }

  function makeGlints(g, rand) {
    const x = new Float32Array(GLINTS);
    const y = new Float32Array(GLINTS);
    const p = new Float32Array(GLINTS);
    const s = new Float32Array(GLINTS);
    for (let i = 0; i < GLINTS; i++) {
      x[i] = rand() * g.W;
      y[i] = g.H * (0.1 + rand() * 0.8);
      p[i] = rand() * TAU;
      s[i] = 0.25 + rand() * 0.3;
    }
    return { x, y, p, s };
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.plate = paint(g, false);
    state.lit = paint(g, true);
    state.glints = makeGlints(g, KasuriCore.rng(api.seed));
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { shimmer, glints } = api.props;
    ctx.drawImage(state.plate, 0, 0);
    drawSheen(ctx, g, t, shimmer);
    drawGlints(ctx, g, t, glints);
  }

  Kasuri.run({
    defaults: { shimmer: 1, glints: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
