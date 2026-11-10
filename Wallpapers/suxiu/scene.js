/*
 * 苏绣 Suxiu — Suzhou embroidery on a round silk fan.
 *
 * The fan, silk and every stitch are painted once. Peonies are rings of petals worked
 * as fans of short satin-stitch strokes, plum blossoms are five small petals, leaves are
 * slanted stitches along a vein. A paler copy of the stitches is shown through a few
 * slanted bands that glide across, like light running over silk thread.
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const INK = '#15171d';
  const SILK = '#2b3452';
  const SILK_SHADE = '#43507a';
  const RIM = '#a8883a';
  const BRANCH = '#8a7240';
  const MOSS = ['#4f7a4a', '#6c9358', '#8fb06c'];
  const VERM = ['#a8321f', '#c9482d', '#e07a55', '#f0c4a8'];
  const WASHI_P = ['#d9c9b0', '#f2ebdc'];
  const GOLD = '#c9a24a';
  const LIT = '#fff0c4';
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
    const R = Math.min(H * 0.4, W * 0.4);
    return { W, H, U, R, cx: W / 2, cy: H * 0.44 };
  }

  function pick(arr, f) {
    return arr[Math.max(0, Math.min(arr.length - 1, Math.floor(f * arr.length)))];
  }

  function stroke(ctx, x0, y0, x1, y1, w, col) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  // One petal as a fan of stitches from the base (0,0) out to length len, angle a, spread s.
  function petal(ctx, g, rand, len, spread, pal, n) {
    const w = Math.max(1, g.U * 0.5);
    ctx.fillStyle = pal[0];
    ctx.beginPath();
    ctx.ellipse(0, -len * 0.5, len * Math.sin(spread / 2) * 0.55, len * 0.5, 0, 0, TAU);
    ctx.fill();
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1) - 0.5;
      const ang = -Math.PI / 2 + f * spread;
      const edge = 1 - f * f * 1.6;
      const l = len * (edge * (0.94 + rand() * 0.06));
      const x1 = Math.cos(ang) * l;
      const y1 = Math.sin(ang) * l;
      const mid = 0.45 + rand() * 0.1;
      stroke(ctx, 0, 0, x1 * mid, y1 * mid, w, pal[0]);
      stroke(ctx, x1 * mid, y1 * mid, x1, y1, w, pal[1]);
    }
  }

  function peony(ctx, g, rand, x, y, s, tone) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineCap = 'round';
    const rings = [
      { n: 7, len: 9.5, spread: 1.3, pal: tone ? [VERM[1], VERM[3]] : [VERM[2], WASHI_P[1]], off: 0.2 },
      { n: 6, len: 7, spread: 1.2, pal: tone ? [VERM[0], VERM[2]] : [VERM[1], VERM[3]], off: 0.5 },
      { n: 5, len: 4.6, spread: 1.1, pal: tone ? [VERM[0], VERM[1]] : [VERM[2], VERM[3]], off: 0.1 },
    ];
    rings.forEach((r) => {
      for (let i = 0; i < r.n; i++) {
        ctx.save();
        ctx.rotate((i / r.n) * TAU + r.off);
        petal(ctx, g, rand, g.U * r.len * s, r.spread, r.pal, 9);
        ctx.restore();
      }
    });
    ctx.fillStyle = GOLD;
    for (let i = 0; i < 9; i++) {
      const a = rand() * TAU;
      const d = rand() * g.U * 1.3 * s;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, Math.max(0.8, g.U * 0.4), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function plum(ctx, g, rand, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate((i / 5) * TAU + rand() * 0.2);
      petal(ctx, g, rand, g.U * 3.2 * s, 1.5, [VERM[2], WASHI_P[1]], 5);
      ctx.restore();
    }
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1, g.U * 0.7 * s), 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // A leaf of slanted stitches along a central vein, base at (x, y), pointing at ang.
  function leaf(ctx, g, rand, x, y, ang, len, wid) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.lineCap = 'round';
    const w = Math.max(1, g.U * 0.42);
    const n = Math.max(8, Math.round(len / (w * 0.9)));
    for (let i = 1; i < n; i++) {
      const f = i / n;
      const half = Math.sin(f * Math.PI) * wid * (1 - f * 0.25);
      const px = f * len;
      const col = pick(MOSS, f * 0.7 + rand() * 0.3);
      stroke(ctx, px, 0, px + half * 0.55, -half, w, col);
      stroke(ctx, px, 0, px + half * 0.55, half, w, pick(MOSS, f * 0.5 + rand() * 0.3));
    }
    stroke(ctx, 0, 0, len, 0, Math.max(1, g.U * 0.3), MOSS[0]);
    ctx.restore();
  }

  function branchPath(g, t) {
    const R = g.R;
    const x = g.cx - R * 0.8 + t * R * 1.55;
    const y = g.cy + R * 0.55 - t * R * 0.95 + Math.sin(t * TAU) * R * 0.1;
    return [x, y];
  }

  function paintBranch(ctx, g) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = BRANCH;
    for (let i = 0; i < 2; i++) {
      ctx.lineWidth = Math.max(2, g.U * (i ? 1.0 : 2.2));
      ctx.beginPath();
      for (let k = 0; k <= 30; k++) {
        const [x, y] = branchPath(g, k / 30);
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = '#b69a58';
    }
  }

  function paintSilk(ctx, g, rand) {
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, g.W, g.H);
    // handle and tassel
    const hx = g.cx;
    const top = g.cy + g.R;
    ctx.fillStyle = RIM;
    ctx.fillRect(hx - g.U * 0.8, top, g.U * 1.6, g.H * 0.97 - top - g.U * 6);
    ctx.fillStyle = VERM[1];
    ctx.fillRect(hx - g.U * 1.1, top + g.U * 5, g.U * 2.2, g.U * 2);
    const ty = g.H * 0.97 - g.U * 6;
    ctx.fillStyle = VERM[0];
    ctx.fillRect(hx - g.U * 1.4, ty, g.U * 2.8, g.U * 1.6);
    for (let i = -3; i <= 3; i++) {
      stroke(ctx, hx + i * g.U * 0.35, ty + g.U * 1.6, hx + i * g.U * 0.5, ty + g.U * 6, Math.max(1, g.U * 0.25), VERM[1]);
    }
    // rim and silk disc
    ctx.fillStyle = RIM;
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.R + g.U * 1.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = SILK;
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.R, 0, TAU);
    ctx.fill();
    // fine weave: faint threads across the silk
    ctx.save();
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.R, 0, TAU);
    ctx.clip();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = SILK_SHADE;
    const step = Math.max(2, Math.round(g.U * 0.9));
    for (let y = Math.floor(g.cy - g.R); y < g.cy + g.R; y += step) ctx.fillRect(g.cx - g.R, y, g.R * 2, 1);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function paintStitches(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.R - g.U * 1.2, 0, TAU);
    ctx.clip();
    paintBranch(ctx, g);
    const R = g.R;
    const leaves = [
      [0.08, -0.9, 0.34], [0.2, 0.7, 0.3], [0.32, -1.1, 0.36], [0.44, 0.5, 0.3],
      [0.58, -0.7, 0.3], [0.7, 0.95, 0.34], [0.84, -0.4, 0.26], [0.93, 0.6, 0.24],
    ];
    leaves.forEach(([t, a, l]) => {
      const [x, y] = branchPath(g, t);
      leaf(ctx, g, rand, x, y, a - 0.5, R * l * 1.9, R * l * 0.6);
    });
    const [px, py] = branchPath(g, 0.38);
    peony(ctx, g, rand, px + R * 0.0, py - R * 0.1, 1.7, true);
    const [qx, qy] = branchPath(g, 0.74);
    peony(ctx, g, rand, qx - R * 0.05, qy - R * 0.1, 1.35, false);
    [[0.15, 0.25, 0.9], [0.55, 0.3, 0.8], [0.62, -0.35, 0.7], [0.88, 0.22, 0.8], [0.95, -0.2, 0.6], [0.28, 0.32, 0.7]]
      .forEach(([t, dy, s]) => {
        const [x, y] = branchPath(g, t);
        plum(ctx, g, rand, x + R * 0.05, y - dy * R * 0.45, s * 1.7);
      });
    return c;
  }

  function tint(src, g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = LIT;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  function slab(ctx, g, x, half, slant) {
    ctx.beginPath();
    ctx.moveTo(x - half + slant, 0);
    ctx.lineTo(x + half + slant, 0);
    ctx.lineTo(x + half - slant, g.H);
    ctx.lineTo(x - half - slant, g.H);
    ctx.closePath();
  }

  function drawBands(ctx, g, t, amount, img, alphaBase, bands) {
    if (amount <= 0) return;
    const span = g.W + g.R * 2;
    for (let b = 0; b < bands; b++) {
      const ph = (t * 0.07 + b / bands) % 1;
      const x = g.cx - g.R - g.R * 0.4 + ph * (g.R * 2.8);
      const fade = Math.sin(ph * Math.PI);
      for (let k = 0; k < 3; k++) {
        ctx.save();
        slab(ctx, g, x, g.R * (0.3 - k * 0.09), g.R * 0.25);
        ctx.clip();
        ctx.globalAlpha = Math.min(1, alphaBase * amount * fade);
        if (img) ctx.drawImage(img, 0, 0);
        else {
          ctx.fillStyle = LIT;
          ctx.beginPath();
          ctx.arc(g.cx, g.cy, g.R, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = KasuriCore.rng(api.seed);
    state.g = g;
    const base = layer(g.W, g.H);
    paintSilk(base.getContext('2d'), g, rand);
    state.base = base;
    state.stitches = paintStitches(g, rand);
    state.lit = tint(state.stitches, g);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { glint, sheen } = api.props;
    ctx.drawImage(state.base, 0, 0);
    ctx.drawImage(state.stitches, 0, 0);
    drawBands(ctx, g, t, sheen * 0.08, null, 1, 1);
    drawBands(ctx, g, t, glint, state.lit, 0.8, 2);
  }

  Kasuri.run({
    defaults: { glint: 1, sheen: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
