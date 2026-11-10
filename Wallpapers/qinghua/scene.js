/*
 * 青花 Qinghua — blue-and-white porcelain: lotus scrolls between ruyi borders.
 *
 * The vessel pattern is painted once: two bands of a wavering cobalt stem carrying
 * lotus blooms, leaves and curled tendrils, with ruyi heads along top and bottom and
 * a key-fret band between. A paler copy is laid through a few soft slanted bands that
 * drift across, like glaze catching light, plus a small fixed set of glints.
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const WHITE = '#e9e7da';
  const WHITE_SHADE = '#d4d6cf';
  const BLUE = '#27478c';
  const DEEP = '#162c66';
  const WASH = '#7f9ccf';
  const WASH_LIGHT = '#aebfe0';
  const GLINTS = 18;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function lw(g, k) {
    return Math.max(1, g.U * k);
  }

  // One pointed petal from the origin up to (0, -len).
  function petal(ctx, g, len, wid, fill) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(wid, -len * 0.25, wid * 0.8, -len * 0.75, 0, -len);
    ctx.bezierCurveTo(-wid * 0.8, -len * 0.75, -wid, -len * 0.25, 0, 0);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = DEEP;
    ctx.lineWidth = lw(g, 0.34);
    ctx.stroke();
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = lw(g, 0.28);
    ctx.beginPath();
    ctx.moveTo(0, -len * 0.12);
    ctx.quadraticCurveTo(wid * 0.1, -len * 0.5, 0, -len * 0.78);
    ctx.stroke();
  }

  // A lotus bloom seen from the side, base at (x, y), opening along `up` (1 or -1).
  function lotus(ctx, g, x, y, s, up, tilt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt + (up > 0 ? 0 : Math.PI));
    const h = g.U * 13 * s;
    const w = g.U * 4.4 * s;
    const spread = [-0.95, 0.95, -0.5, 0.5];
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate(spread[i]);
      petal(ctx, g, h * (i < 2 ? 0.8 : 0.92), w * (i < 2 ? 0.95 : 1), i < 2 ? WASH : WASH_LIGHT);
      ctx.restore();
    }
    petal(ctx, g, h, w * 1.05, WHITE);
    ctx.fillStyle = BLUE;
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.34, w * 0.34, h * 0.1, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = DEEP;
    ctx.beginPath();
    ctx.ellipse(0, g.U * 0.7 * s, w * 0.7, g.U * 1.2 * s, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function leaf(ctx, g, x, y, ang, len, wid) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(len * 0.3, -wid * 1.3, len * 0.8, -wid * 0.9, len, 0);
    ctx.bezierCurveTo(len * 0.8, wid * 0.8, len * 0.3, wid * 1.3, 0, 0);
    ctx.fillStyle = WASH;
    ctx.fill();
    ctx.strokeStyle = DEEP;
    ctx.lineWidth = lw(g, 0.34);
    ctx.stroke();
    ctx.fillStyle = BLUE;
    ctx.beginPath();
    ctx.moveTo(len * 0.05, 0);
    ctx.bezierCurveTo(len * 0.35, -wid * 0.6, len * 0.7, -wid * 0.4, len * 0.92, 0);
    ctx.bezierCurveTo(len * 0.7, wid * 0.05, len * 0.35, wid * 0.05, len * 0.05, 0);
    ctx.fill();
    ctx.restore();
  }

  function curl(ctx, g, x, y, ang, r, dir) {
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = lw(g, 0.55);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const f = i / 24;
      const a = ang + dir * f * TAU * 1.35;
      const rr = r * (1 - f * 0.8);
      const px = x + Math.cos(a) * rr - Math.cos(ang) * r;
      const py = y + Math.sin(a) * rr - Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function stemY(g, band, x) {
    return band.cy + Math.sin((x / band.L) * TAU + band.ph) * band.A;
  }

  // One band: the stem, curly leaves at the troughs, lotus blooms at the crests.
  function paintBand(ctx, g, band) {
    const step = Math.max(1, g.U * 0.6);
    ctx.strokeStyle = DEEP;
    ctx.lineWidth = lw(g, 1.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let x = -band.L; x <= g.W + band.L; x += step) {
      const y = stemY(g, band, x);
      if (x === -band.L) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    const n0 = Math.floor(-band.ph / TAU) - 2;
    const n1 = Math.ceil(g.W / band.L) + 2;
    for (let n = n0; n <= n1; n++) {
      const xc = ((n + 0.25) * band.L) - (band.ph / TAU) * band.L;
      const xt = xc + band.L / 2;
      leafSet(ctx, g, band, xt);
      bloomSet(ctx, g, band, xc);
    }
  }

  function bloomSet(ctx, g, band, x) {
    const y = stemY(g, band, x);
    lotus(ctx, g, x, y, 1.3, 1, 0);
    leaf(ctx, g, x - g.U * 2, y + g.U * 1.5, Math.PI * 0.62, g.U * 10, g.U * 2.1);
    leaf(ctx, g, x + g.U * 2, y + g.U * 1.5, Math.PI * 0.38, g.U * 10, g.U * 2.1);
    state.spots.push(x, y - g.U * 9);
  }

  function leafSet(ctx, g, band, x) {
    const y = stemY(g, band, x);
    leaf(ctx, g, x, y, Math.PI * 0.5, g.U * 13, g.U * 3);
    leaf(ctx, g, x - g.U * 1, y, Math.PI * 0.85, g.U * 13, g.U * 2.4);
    leaf(ctx, g, x + g.U * 1, y, Math.PI * 0.15, g.U * 13, g.U * 2.4);
    curl(ctx, g, x - g.U * 7, y - g.U * 5, Math.PI * 1.1, g.U * 4.4, 1);
    curl(ctx, g, x + g.U * 7, y - g.U * 5, Math.PI * 1.9, g.U * 4.4, -1);
  }

  function rules(ctx, g, y) {
    ctx.fillStyle = BLUE;
    ctx.fillRect(0, y, g.W, lw(g, 0.9));
    ctx.fillRect(0, y + g.U * 2, g.W, lw(g, 0.4));
  }

  // Ruyi heads: scalloped arches hanging from (or rising from) an edge.
  function ruyi(ctx, g, y, dir) {
    const w = g.U * 9;
    for (let x = 0; x < g.W + w; x += w) {
      const cx = x + w / 2;
      ctx.fillStyle = WASH;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x, y + dir * w * 0.95, cx, y + dir * w * 0.95, cx, y + dir * w * 0.62);
      ctx.bezierCurveTo(cx, y + dir * w * 0.95, x + w, y + dir * w * 0.95, x + w, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = DEEP;
      ctx.lineWidth = lw(g, 0.4);
      ctx.stroke();
      ctx.fillStyle = WHITE;
      ctx.beginPath();
      ctx.arc(cx, y + dir * w * 0.24, w * 0.19, 0, TAU);
      ctx.fill();
      ctx.fillStyle = BLUE;
      ctx.beginPath();
      ctx.arc(cx, y + dir * w * 0.24, w * 0.08, 0, TAU);
      ctx.fill();
    }
  }

  // Key fret: a repeating stepped square spiral drawn as a stroked path.
  function fret(ctx, g, y0, h) {
    const c = h / 4;
    ctx.fillStyle = WASH_LIGHT;
    ctx.fillRect(0, y0, g.W, h);
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = lw(g, 0.55);
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    for (let x = 0; x < g.W + c * 6; x += c * 6) {
      ctx.beginPath();
      ctx.moveTo(x, y0 + h);
      ctx.lineTo(x, y0);
      ctx.lineTo(x + c * 4, y0);
      ctx.lineTo(x + c * 4, y0 + c * 3);
      ctx.lineTo(x + c, y0 + c * 3);
      ctx.lineTo(x + c, y0 + c);
      ctx.lineTo(x + c * 3, y0 + c);
      ctx.lineTo(x + c * 3, y0 + c * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + c * 4, y0 + h);
      ctx.lineTo(x + c * 6, y0 + h);
      ctx.stroke();
    }
  }

  function paintPlate(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    state.spots = [];
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = WHITE_SHADE;
    for (let y = 0; y < g.H; y += g.U * 6) ctx.fillRect(0, y + g.U * 5, g.W, lw(g, 0.3));
    const U = g.U;
    ruyi(ctx, g, 0, 1);
    rules(ctx, g, U * 9);
    paintBand(ctx, g, { cy: U * 29, A: U * 6, L: U * 40, ph: 0 });
    rules(ctx, g, U * 46);
    fret(ctx, g, U * 50, U * 4.5);
    rules(ctx, g, U * 56);
    paintBand(ctx, g, { cy: U * 75, A: U * 6, L: U * 40, ph: Math.PI });
    rules(ctx, g, U * 89);
    ruyi(ctx, g, g.H, -1);
    return c;
  }

  // Same picture, paler and cooler, drawn through the moving bands.
  function paintLit(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.drawImage(state.plate, 0, 0);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#f4f3ea';
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.globalAlpha = 1;
    return c;
  }

  function makeGlints(g, rand) {
    const n = Math.min(GLINTS, state.spots.length / 2);
    const x = new Float32Array(n);
    const y = new Float32Array(n);
    const p = new Float32Array(n);
    const s = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      x[i] = state.spots[i * 2] + (rand() - 0.5) * g.U * 4;
      y[i] = state.spots[i * 2 + 1] + rand() * g.U * 6;
      p[i] = rand() * TAU;
      s[i] = 0.25 + rand() * 0.3;
    }
    return { x, y, p, s, n };
  }

  function band(ctx, g, cx, half, slant) {
    ctx.beginPath();
    ctx.moveTo(cx - half, 0);
    ctx.lineTo(cx + half, 0);
    ctx.lineTo(cx + half - slant, g.H);
    ctx.lineTo(cx - half - slant, g.H);
    ctx.closePath();
  }

  function drawSheen(ctx, g, t, amount) {
    if (amount <= 0) return;
    const span = g.W + g.H * 0.8;
    const slant = g.H * 0.5;
    for (let b = 0; b < 2; b++) {
      const cx = ((t * g.U * (1.4 + b * 0.8) + b * span * 0.55) % span) - g.H * 0.2 + slant;
      const w = g.U * (11 + b * 6);
      for (let k = 0; k < 3; k++) {
        ctx.save();
        band(ctx, g, cx, w * (1 - k * 0.3), slant);
        ctx.clip();
        ctx.globalAlpha = Math.min(1, amount) * (b ? 0.45 : 0.7) * (k === 0 ? 0.4 : k === 1 ? 0.6 : 0.8);
        ctx.drawImage(state.lit, 0, 0);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, g, t, amount) {
    if (amount <= 0) return;
    const G = state.glints;
    const sz = Math.max(1, g.U * 0.6);
    ctx.fillStyle = '#f6f4e8';
    for (let i = 0; i < G.n; i++) {
      const a = Math.sin(t * G.s[i] + G.p[i]);
      if (a <= 0.25) continue;
      ctx.globalAlpha = Math.min(1, (a - 0.25) * amount * 0.8);
      ctx.fillRect(G.x[i], G.y[i], sz, sz);
      ctx.fillRect(G.x[i] - sz, G.y[i] + sz * 0.35, sz * 3, Math.max(1, sz * 0.3));
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const W = api.cols;
    const H = api.rows;
    const g = { W, H, U: H / 100 };
    state.g = g;
    state.plate = paintPlate(g);
    state.lit = paintLit(g);
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
