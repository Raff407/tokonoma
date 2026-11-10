/*
 * 云锦 Yunjin — cloud brocade: gold thread clouds and waves on indigo.
 *
 * Three woven rows are baked once as tileable strips: ruyi clouds, curling waves,
 * ruyi clouds. Each row slides sideways at its own gentle pace (the middle one the
 * other way). A brighter copy of the whole cloth is shown through two slanted bands
 * that pass slowly, like light running along the thread, with a few small glints.
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const INDIGO = '#17254f';
  const INDIGO_LIT = '#223670';
  const TWILL = '#1d2e60';
  const GOLD = '#c9a24a';
  const GOLD_DEEP = '#9a762e';
  const GOLD_PALE = '#e8cf86';
  const GLINTS = 14;
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

  function disc(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  // One ruyi cloud: three round lobes with a curled tail trailing to the right.
  function cloud(ctx, g, x, y, s) {
    const u = g.U * s;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = GOLD_DEEP;
    disc(ctx, 0, 0, u * 5.6);
    disc(ctx, -u * 5.4, u * 2.2, u * 4.2);
    disc(ctx, u * 5.4, u * 2.2, u * 4.2);
    ctx.beginPath();
    ctx.moveTo(u * 7, u * 3);
    ctx.bezierCurveTo(u * 13, u * 6, u * 17, u * 1, u * 22, u * 4);
    ctx.bezierCurveTo(u * 17, u * 7.5, u * 12, u * 8.5, u * 6, u * 6.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = GOLD;
    disc(ctx, 0, -u * 0.2, u * 4.5);
    disc(ctx, -u * 5.4, u * 2, u * 3.1);
    disc(ctx, u * 5.4, u * 2, u * 3.1);
    ctx.strokeStyle = INDIGO;
    ctx.lineWidth = lw(g, 0.5 * s);
    ctx.lineCap = 'round';
    for (const dx of [-5.4, 0, 5.4]) {
      ctx.beginPath();
      const cx = dx * u;
      const cy = (dx === 0 ? -0.2 : 2) * u;
      for (let i = 0; i <= 18; i++) {
        const f = i / 18;
        const a = f * TAU * 1.25 + 0.6;
        const r = u * 2.4 * (1 - f * 0.85);
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = GOLD_PALE;
    ctx.lineWidth = lw(g, 0.35 * s);
    ctx.beginPath();
    ctx.moveTo(u * 8, u * 4.4);
    ctx.bezierCurveTo(u * 13, u * 6.2, u * 16, u * 3.4, u * 20, u * 4.6);
    ctx.stroke();
    ctx.restore();
  }

  // Tileable strip of clouds, period P, height h.
  function cloudStrip(g, P, h, flip) {
    const c = layer(P, h);
    const ctx = c.getContext('2d');
    for (const off of [-P, 0, P]) {
      const a = off + P * (flip ? 0.12 : 0.04);
      cloud(ctx, g, a + P * 0.12, h * 0.44, 1.45);
      cloud(ctx, g, a + P * 0.64, h * 0.6, 0.85);
    }
    return c;
  }

  // Tileable strip of wave scallops: rows of nested arcs, each row offset by half.
  function waveStrip(g, P, h) {
    const c = layer(P, h);
    const ctx = c.getContext('2d');
    const w = P / 2;
    const rows = 4;
    const rh = h / rows;
    ctx.lineCap = 'round';
    for (let r = 0; r < rows; r++) {
      const y = rh * (r + 0.9);
      const shift = r % 2 ? w / 2 : 0;
      for (let x = -w; x <= P + w; x += w) {
        const cx = x + shift;
        const rad = w * 0.5;
        const rings = [1, 0.72, 0.46];
        for (let k = 0; k < rings.length; k++) {
          ctx.strokeStyle = k === 0 ? GOLD : k === 1 ? GOLD_DEEP : GOLD_PALE;
          ctx.lineWidth = lw(g, k === 0 ? 0.65 : 0.45);
          ctx.beginPath();
          ctx.arc(cx, y, rad * rings[k], Math.PI, TAU);
          ctx.stroke();
        }
        ctx.fillStyle = GOLD;
        disc(ctx, cx, y - rad * 0.18, Math.max(1, g.U * 0.5));
      }
    }
    return c;
  }

  function rule(ctx, g, y) {
    ctx.fillStyle = GOLD_DEEP;
    ctx.fillRect(0, y, g.W, lw(g, 0.7));
    ctx.fillStyle = GOLD;
    ctx.fillRect(0, y + g.U * 1.2, g.W, lw(g, 0.3));
  }

  function twill(ctx, g) {
    ctx.fillStyle = INDIGO;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = TWILL;
    const step = Math.max(2, Math.round(g.U * 0.9));
    for (let y = 0; y < g.H; y += step) ctx.fillRect(0, y, g.W, 1);
  }

  function rowDraw(ctx, strip, y, off, g) {
    const P = strip.width;
    let x = -(((off % P) + P) % P);
    for (; x < g.W; x += P) ctx.drawImage(strip, x, y);
  }

  function paintStatic(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    twill(ctx, g);
    rule(ctx, g, g.U * 1);
    rule(ctx, g, g.U * 33.5);
    rule(ctx, g, g.U * 65.5);
    rule(ctx, g, g.U * 97);
    return c;
  }

  function buildRows(g) {
    const U = g.U;
    return [
      { strip: cloudStrip(g, U * 52, U * 28, false), y: U * 4.5, v: 1.6 },
      { strip: waveStrip(g, U * 28, U * 28), y: U * 37, v: -1.1 },
      { strip: cloudStrip(g, U * 52, U * 28, true), y: U * 68.5, v: 1.3 },
    ];
  }

  function paintCloth(g, rows, off) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.drawImage(state.still, 0, 0);
    for (const r of rows) rowDraw(ctx, r.strip, r.y, off * r.v, g);
    return c;
  }

  function paintLit(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = INDIGO_LIT;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  function band(ctx, g, cx, half, slant) {
    ctx.beginPath();
    ctx.moveTo(cx - half, 0);
    ctx.lineTo(cx + half, 0);
    ctx.lineTo(cx + half - slant, g.H);
    ctx.lineTo(cx - half - slant, g.H);
    ctx.closePath();
  }

  // The sheen: a paler wash laid through slanted bands, then gold drawn lighter on top.
  function drawSheen(ctx, g, t, amount) {
    if (amount <= 0) return;
    const span = g.W + g.H * 0.8;
    const slant = g.H * 0.45;
    const cx = ((t * g.U * 1.8) % span) - g.H * 0.2 + slant;
    for (let k = 0; k < 3; k++) {
      ctx.save();
      band(ctx, g, cx, g.U * (14 - k * 4), slant);
      ctx.clip();
      ctx.globalAlpha = Math.min(1, amount) * (0.1 + k * 0.06);
      ctx.fillStyle = GOLD_PALE;
      ctx.fillRect(0, 0, g.W, g.H);
      ctx.restore();
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
      y[i] = g.H * (0.08 + rand() * 0.84);
      p[i] = rand() * TAU;
      s[i] = 0.25 + rand() * 0.3;
    }
    return { x, y, p, s };
  }

  function drawGlints(ctx, g, t, amount) {
    if (amount <= 0) return;
    const G = state.glints;
    const sz = Math.max(1, g.U * 0.55);
    ctx.fillStyle = GOLD_PALE;
    for (let i = 0; i < GLINTS; i++) {
      const a = Math.sin(t * G.s[i] + G.p[i]);
      if (a <= 0.3) continue;
      ctx.globalAlpha = Math.min(1, (a - 0.3) * amount * 0.9);
      ctx.fillRect(G.x[i], G.y[i], sz, sz);
      ctx.fillRect(G.x[i] - sz, G.y[i] + sz * 0.35, sz * 3, Math.max(1, sz * 0.3));
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.still = paintStatic(g);
    state.rows = buildRows(g);
    state.glints = makeGlints(g, KasuriCore.rng(api.seed));
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { drift, sheen } = api.props;
    ctx.drawImage(state.still, 0, 0);
    const off = t * g.U * 0.9 * drift;
    for (const r of state.rows) rowDraw(ctx, r.strip, r.y, off * r.v, g);
    drawSheen(ctx, g, t, sheen);
    drawGlints(ctx, g, t, sheen);
  }

  Kasuri.run({
    defaults: { drift: 1, sheen: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
