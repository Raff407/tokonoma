/*
 * 矢絣 Yagasuri — columns of arrow-feather pattern on indigo cloth, swaying in a breeze.
 *
 * The cloth is baked once, wider than the view. Each tick draws it in thin strips,
 * each strip nudged sideways and a little up or down by a slow travelling wave, then
 * lays one soft light band over the top so the folds seem to roll across the cloth.
 */
(function () {
  'use strict';

  const K = KasuriCore;

  const INDIGO = '#26385a';
  const INDIGO_DEEP = '#1c2a45';
  const WASHI = '#e8e0cc';
  const VERMILION = '#b9452f';
  const MOSS = '#6b7a4f';
  const GOLD = '#c2a057';
  const STRIP = 2;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const cw = Math.max(8, U * 11);
    const margin = Math.ceil(U * 5);
    return { W, H, U, cw, margin, strips: Math.ceil(H / STRIP) };
  }

  function feather(ctx, cx, y, hw, depth, thick, up) {
    const s = up ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(cx + hw, y + s * depth);
    ctx.lineTo(cx + hw, y + s * (depth + thick));
    ctx.lineTo(cx, y + s * thick);
    ctx.lineTo(cx - hw, y + s * (depth + thick));
    ctx.lineTo(cx - hw, y + s * depth);
    ctx.closePath();
    ctx.fill();
  }

  function paintColumn(ctx, g, i, x0, H) {
    const cw = g.cw;
    const cx = x0 + cw / 2;
    const up = i % 2 === 0;
    const accent = i % 7 === 3 ? VERMILION : i % 7 === 5 ? MOSS : WASHI;
    ctx.fillStyle = i % 2 === 0 ? INDIGO : INDIGO_DEEP;
    ctx.fillRect(x0, 0, cw, H);
    const pitch = cw * 0.62;
    const depth = cw * 0.4;
    const thick = cw * 0.2;
    const hw = cw * 0.5 - Math.max(1, g.U * 0.35);
    ctx.fillStyle = accent;
    const n = Math.ceil(H / pitch) + 3;
    const off = (i % 3) * pitch * 0.33;
    for (let k = -2; k < n; k++) {
      const y = k * pitch + off;
      feather(ctx, cx, up ? y + depth : y, hw, depth, thick, up);
    }
    ctx.fillStyle = accent === WASHI ? GOLD : WASHI;
    ctx.fillRect(cx - Math.max(0.5, g.U * 0.25), 0, Math.max(1, g.U * 0.5), H);
  }

  function paintCloth(g) {
    const w = g.W + g.margin * 2;
    const h = g.H + g.margin * 2;
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const n = Math.ceil(w / g.cw);
    for (let i = 0; i < n; i++) paintColumn(ctx, g, i, i * g.cw, h);
    return c;
  }

  // soft light band, tall enough to cover the view
  function paintBand(g) {
    const w = Math.ceil(g.W * 0.7);
    const c = layer(w, 4);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(255,248,226,0)');
    grad.addColorStop(0.5, 'rgba(255,248,226,1)');
    grad.addColorStop(1, 'rgba(255,248,226,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, 4);
    return c;
  }

  function paintShade(g) {
    const c = layer(Math.ceil(g.W * 0.7), 4);
    const ctx = c.getContext('2d');
    const w = c.width;
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(10,16,32,0)');
    grad.addColorStop(0.5, 'rgba(10,16,32,1)');
    grad.addColorStop(1, 'rgba(10,16,32,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, 4);
    return c;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.cloth = paintCloth(g);
    state.band = paintBand(g);
    state.shade = paintShade(g);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const breeze = api.props.breeze;
    const sheen = api.props.sheen;
    const amp = g.U * 1.6 * breeze;
    const m = g.margin;
    const cw = state.cloth.width;
    const k = 0.07 / g.U;
    ctx.fillStyle = INDIGO;
    ctx.fillRect(0, 0, g.W, g.H);
    for (let s = 0; s < g.strips; s++) {
      const y = s * STRIP;
      const ph = y * k + t * 0.7;
      const dx = amp * (Math.sin(ph) * 0.7 + Math.sin(ph * 0.43 + t * 0.35 + 1.3) * 0.5);
      const dy = amp * 0.25 * Math.sin(ph * 0.8 + 0.5);
      ctx.drawImage(state.cloth, m + dx, m + y + dy, g.W, STRIP, 0, y, g.W, STRIP);
    }
    if (sheen > 0) {
      const bw = state.band.width;
      const span = g.W + bw;
      const px = ((t * g.W * 0.045) % span) - bw;
      ctx.globalAlpha = 0.16 * Math.min(sheen, 1.5);
      ctx.drawImage(state.band, px, 0, bw, g.H);
      const px2 = ((t * g.W * 0.03 + span * 0.5) % span) - bw;
      ctx.globalAlpha = 0.3 * Math.min(sheen, 1.5);
      ctx.drawImage(state.shade, px2, 0, bw, g.H);
      ctx.globalAlpha = 1;
    }
  }

  Kasuri.run({
    defaults: { breeze: 1, sheen: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
