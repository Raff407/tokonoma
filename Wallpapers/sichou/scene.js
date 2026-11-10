/*
 * 丝绸 Silk — indigo silk woven with gold cloud scrolls, rippling in a breeze.
 *
 * The cloth is painted once, a little larger than the screen: a twill ground, rows of
 * auspicious clouds (concentric heads with curled tails) set half a step apart, and
 * small vermilion and moss lozenges between them. Each frame it is drawn in narrow
 * upright slices shifted up and down by a travelling swell, with light or shade laid
 * over each slice from the slope of the fold.
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const INDIGO = '#1f2e5e';
  const INDIGO_LIGHT = '#2c4080';
  const INDIGO_DEEP = '#16214a';
  const GOLD = '#c9a24a';
  const GOLD_PALE = '#e0c47a';
  const GOLD_DARK = '#9a7a32';
  const VERMILION = '#a8432e';
  const MOSS = '#5d7048';
  const SLICES = 120;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function swatch(color) {
    const c = layer(1, 1);
    const x = c.getContext('2d');
    x.fillStyle = color;
    x.fillRect(0, 0, 1, 1);
    return c;
  }

  function disc(ctx, x, y, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.5, r), 0, TAU);
    ctx.fill();
  }

  // A curled tail: starts at (x, y), runs outward by dir and ends in a small spiral.
  function curl(ctx, g, x, y, s, dir) {
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(1, s * 0.13);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + dir * s * 0.5, y + s * 0.05, x + dir * s * 0.9, y + s * 0.5, x + dir * s * 0.7, y + s * 0.85);
    for (let i = 0; i <= 14; i++) {
      const f = i / 14;
      const a = dir > 0 ? Math.PI * 0.2 + f * TAU * 0.85 : Math.PI * 0.8 - f * TAU * 0.85;
      const r = s * 0.22 * (1 - f * 0.7);
      ctx.lineTo(x + dir * s * 0.55 + Math.cos(a) * r, y + s * 0.85 - s * 0.05 + Math.sin(a) * r);
    }
    ctx.stroke();
  }

  // One cloud: three-lobed head with rings inside, two curls and a tapering tail.
  function cloud(ctx, g, x, y, s) {
    const lobes = [[0, -0.32, 0.5], [-0.62, -0.05, 0.34], [0.62, -0.05, 0.34]];
    ctx.fillStyle = GOLD;
    for (let i = 0; i < 3; i++) disc(ctx, x + lobes[i][0] * s, y + lobes[i][1] * s, lobes[i][2] * s, GOLD);
    ctx.fillStyle = GOLD;
    ctx.fillRect(x - s * 0.62, y - s * 0.12, s * 1.24, s * 0.2);
    for (let i = 0; i < 3; i++) {
      const lx = x + lobes[i][0] * s;
      const ly = y + lobes[i][1] * s;
      const r = lobes[i][2] * s;
      disc(ctx, lx, ly, r * 0.7, INDIGO);
      disc(ctx, lx, ly, r * 0.5, GOLD);
      disc(ctx, lx, ly, r * 0.3, INDIGO);
    }
    curl(ctx, g, x - s * 0.5, y + s * 0.1, s * 0.8, -1);
    curl(ctx, g, x + s * 0.5, y + s * 0.1, s * 0.8, 1);
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.14, y + s * 0.05);
    ctx.bezierCurveTo(x - s * 0.2, y + s * 0.4, x + s * 0.25, y + s * 0.5, x + s * 0.22, y + s * 0.9);
    ctx.bezierCurveTo(x + s * 0.02, y + s * 0.55, x - s * 0.1, y + s * 0.45, x + s * 0.14, y + s * 0.05);
    ctx.closePath();
    ctx.fill();
  }

  function lozenge(ctx, x, y, r, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.8, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r * 0.8, y);
    ctx.closePath();
    ctx.fill();
  }

  function paintTwill(ctx, w, h, step) {
    ctx.fillStyle = INDIGO;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = INDIGO_LIGHT;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -h; x < w; x += step) {
      ctx.moveTo(x, h);
      ctx.lineTo(x + h, 0);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function paintCloth(g) {
    const c = layer(g.cw, g.ch);
    const ctx = c.getContext('2d');
    paintTwill(ctx, g.cw, g.ch, Math.max(2, Math.round(g.U * 1.3)));
    const s = g.U * 9.5;
    const dx = s * 3.1;
    const dy = s * 2.3;
    let row = 0;
    for (let y = -s; y < g.ch + dy; y += dy, row++) {
      const off = row % 2 ? dx / 2 : 0;
      for (let x = -dx + off; x < g.cw + dx; x += dx) {
        cloud(ctx, g, x, y, s);
      }
      for (let x = -dx + off + dx / 2; x < g.cw + dx; x += dx) {
        const ly = y + dy * 0.5;
        lozenge(ctx, x, ly, s * 0.3, GOLD_DARK);
        lozenge(ctx, x, ly, s * 0.16, row % 2 ? VERMILION : MOSS);
        disc(ctx, x - s * 0.8, ly, s * 0.07, GOLD);
        disc(ctx, x + s * 0.8, ly, s * 0.07, GOLD);
      }
    }
    return c;
  }

  function setup(ctx, api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const mx = Math.ceil(U * 4);
    const my = Math.ceil(U * 7);
    const g = { W, H, U, mx, my, cw: W + mx * 2, ch: H + my * 2 };
    state.g = g;
    state.cloth = paintCloth(g);
    state.white = swatch('#f2e9cc');
    state.black = swatch('#0c1230');
    state.sw = Math.max(1, Math.round(W / SLICES));
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { ripple, sheen } = api.props;
    const sw = state.sw;
    const k1 = TAU / (g.W * 0.62);
    const k2 = TAU / (g.W * 0.27);
    const a = g.U * 3.2 * ripple;
    ctx.fillStyle = INDIGO_DEEP;
    ctx.fillRect(0, 0, g.W, g.H);
    for (let x = 0; x < g.W; x += sw) {
      const p1 = x * k1 - t * 0.55;
      const p2 = x * k2 - t * 0.95 + 1.3;
      const off = a * (0.65 * Math.sin(p1) + 0.35 * Math.sin(p2));
      const slope = a * (0.65 * k1 * Math.cos(p1) + 0.35 * k2 * Math.cos(p2));
      const w = Math.min(sw, g.W - x);
      ctx.drawImage(state.cloth, g.mx + x - off * 0.5, g.my + off, w, g.H, x, 0, w, g.H);
      const lit = slope * 0.9 * sheen;
      if (lit > 0.02) {
        ctx.globalAlpha = Math.min(0.3, lit);
        ctx.drawImage(state.white, 0, 0, 1, 1, x, 0, w, g.H);
      } else if (lit < -0.02) {
        ctx.globalAlpha = Math.min(0.35, -lit);
        ctx.drawImage(state.black, 0, 0, 1, 1, x, 0, w, g.H);
      }
      ctx.globalAlpha = 1;
    }
  }

  Kasuri.run({
    defaults: { ripple: 1, sheen: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
