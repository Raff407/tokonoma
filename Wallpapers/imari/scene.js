/*
 * 伊万里 Imari — cobalt and gold porcelain: peony roundels and clouds.
 *
 * The plate pattern is painted once. A second copy holds only the bright gold. Each
 * frame lays that copy through a few soft slanted bands that drift across, plus a
 * pale glaze sheen, and a small fixed set of gold glints that swell and fade.
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const INK = { ground: '#1d2f66', deep: '#142250', cobalt: '#2f4b92', pale: '#6f8cc4' };
  const WASHI = '#ece4cf';
  const WASHI_SHADE = '#cfc7b0';
  const RED = '#c0452c';
  const RED_DEEP = '#8f2d20';
  const GOLD = '#c9a24a';
  const GOLD_LIT = '#f0d684';
  const MOSS = '#4d6a48';
  const GLINTS = 22;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function petal(ctx, dist, len, wid, fill, line, lw, shade) {
    ctx.save();
    ctx.translate(dist, 0);
    ctx.fillStyle = fill;
    ctx.strokeStyle = line;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(0, 0, len, wid, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    if (shade) {
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.ellipse(-len * 0.25, 0, len * 0.5, wid * 0.55, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function ring(ctx, n, rot, dist, len, wid, fill, line, lw, shade) {
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.rotate(rot + (i / n) * TAU);
      petal(ctx, dist, len, wid, fill, line, lw, shade);
      ctx.restore();
    }
  }

  function peony(ctx, x, y, r, rot, red, lw) {
    ctx.save();
    ctx.translate(x, y);
    const a = red ? RED : WASHI;
    const b = red ? WASHI : INK.cobalt;
    const line = red ? RED_DEEP : INK.deep;
    ring(ctx, 9, rot, r * 0.62, r * 0.4, r * 0.3, WASHI, INK.deep, lw, null);
    ring(ctx, 7, rot + 0.3, r * 0.42, r * 0.34, r * 0.27, a, line, lw, red ? RED_DEEP : WASHI_SHADE);
    ring(ctx, 5, rot + 0.7, r * 0.24, r * 0.26, r * 0.2, b, line, lw, null);
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.14, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK.deep;
    ctx.lineWidth = lw;
    ctx.stroke();
    ctx.restore();
  }

  function leaf(ctx, x, y, ang, len, wid, lw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = MOSS;
    ctx.strokeStyle = INK.deep;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -wid, len, 0);
    ctx.quadraticCurveTo(len * 0.5, wid, 0, 0);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(0.8, lw * 0.7);
    ctx.beginPath();
    ctx.moveTo(len * 0.06, 0);
    ctx.lineTo(len * 0.86, 0);
    ctx.stroke();
    ctx.restore();
  }

  // Roundel: gold rim, blue band, white field, peony, with leaves behind it.
  function roundel(ctx, g, x, y, red, rot) {
    const R = g.R;
    const lw = Math.max(1, g.U * 0.32);
    for (let i = 0; i < 6; i++) {
      leaf(ctx, x, y, rot * 0.5 + (i / 6) * TAU + 0.5, R * 1.5, R * 0.34, lw);
    }
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.fill();
    ctx.fillStyle = INK.deep;
    ctx.beginPath();
    ctx.arc(x, y, R - g.U * 1.0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = WASHI;
    ctx.beginPath();
    ctx.arc(x, y, R - g.U * 1.9, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK.cobalt;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(x, y, R - g.U * 2.8, 0, TAU);
    ctx.stroke();
    peony(ctx, x, y, R * 0.8, rot, red, lw);
  }

  // Cloud: three lobes with inner arcs, white with blue lines and a gold edge.
  function cloud(ctx, g, x, y, s, flip) {
    const lw = Math.max(1, g.U * 0.3);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip ? -s : s, s);
    const lobes = [[-5, 1.5, 4.4], [0, -1.2, 5.6], [5.2, 1.4, 4.2], [0.5, 3, 4.4]];
    for (const pass of [0, 1]) {
      for (const [lx, ly, lr] of lobes) {
        ctx.beginPath();
        ctx.arc(lx * g.U * 0.5, ly * g.U * 0.5, lr * g.U * 0.5 + (pass ? 0 : g.U * 0.35), 0, TAU);
        ctx.fillStyle = pass ? WASHI : GOLD;
        ctx.fill();
      }
    }
    ctx.strokeStyle = INK.cobalt;
    ctx.lineWidth = lw;
    for (const [lx, ly, lr] of lobes) {
      for (let k = 1; k <= 2; k++) {
        ctx.beginPath();
        ctx.arc(lx * g.U * 0.5, ly * g.U * 0.5, lr * g.U * 0.5 * (1 - k * 0.3), Math.PI * 0.9, Math.PI * 1.9);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = lw * 1.3;
    ctx.beginPath();
    ctx.moveTo(g.U * 3, g.U * 2.4);
    ctx.bezierCurveTo(g.U * 6, g.U * 3.8, g.U * 8, g.U * 1.6, g.U * 10, g.U * 3.4);
    ctx.stroke();
    ctx.restore();
  }

  function sprig(ctx, g, x, y) {
    const lw = Math.max(1, g.U * 0.25);
    ctx.fillStyle = RED;
    ctx.strokeStyle = INK.deep;
    ctx.lineWidth = lw;
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((i / 5) * TAU);
      ctx.beginPath();
      ctx.ellipse(g.U * 1.1, 0, g.U * 1, g.U * 0.55, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(x, y, g.U * 0.5, 0, TAU);
    ctx.fill();
  }

  function paintGround(ctx, g) {
    ctx.fillStyle = INK.ground;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = INK.cobalt;
    const step = g.U * 3.2;
    for (let j = 0; j * step < g.H + step; j++) {
      for (let i = 0; i * step < g.W + step; i++) {
        const x = i * step + (j % 2 ? step / 2 : 0);
        ctx.fillRect(x, j * step * 0.9, Math.max(1, g.U * 0.5), Math.max(1, g.U * 0.5));
      }
    }
  }

  function paintPlate(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintGround(ctx, g);
    let n = 0;
    for (let j = -1; j * g.sy < g.H + g.sy; j++) {
      for (let i = -1; i * g.sx < g.W + g.sx; i++) {
        const x = i * g.sx + (j % 2 ? g.sx / 2 : 0);
        const y = j * g.sy;
        const flip = (i + j) % 2 === 0;
        cloud(ctx, g, x + g.sx / 2 - g.U * (flip ? -2.4 : 2.4), y, 1.5, flip);
        n++;
      }
    }
    for (let j = -1; j * g.sy < g.H + g.sy; j++) {
      for (let i = -1; i * g.sx < g.W + g.sx; i++) {
        const x = i * g.sx + (j % 2 ? g.sx / 2 : 0);
        roundel(ctx, g, x, j * g.sy, (i + j) % 2 === 0, (i * 0.7 + j * 1.3));
      }
    }
    for (let j = -1; j * g.sy < g.H + g.sy; j++) {
      for (let i = -1; i * g.sx < g.W + g.sx; i++) {
        const x = i * g.sx + (j % 2 ? g.sx / 2 : 0) + g.sx / 2;
        sprig(ctx, g, x - g.sx * 0.0, j * g.sy + g.sy * 0.5);
      }
    }
    return c;
  }

  // Same picture, only its gold, brighter. Drawn through moving bands.
  function paintGoldLit(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const src = state.plate;
    const rgb = [0xc9, 0xa2, 0x4a];
    const read = src.getContext('2d').getImageData(0, 0, g.W, g.H);
    const out = ctx.createImageData(g.W, g.H);
    const d = read.data;
    const o = out.data;
    for (let i = 0; i < d.length; i += 4) {
      const dr = Math.abs(d[i] - rgb[0]);
      const dg = Math.abs(d[i + 1] - rgb[1]);
      const db = Math.abs(d[i + 2] - rgb[2]);
      if (dr + dg + db < 70) {
        o[i] = 0xf4;
        o[i + 1] = 0xdc;
        o[i + 2] = 0x8e;
        o[i + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
    return c;
  }

  function makeGlints(g, rand) {
    const x = new Float32Array(GLINTS);
    const y = new Float32Array(GLINTS);
    const p = new Float32Array(GLINTS);
    const s = new Float32Array(GLINTS);
    for (let i = 0; i < GLINTS; i++) {
      x[i] = rand() * g.W;
      y[i] = rand() * g.H;
      p[i] = rand() * TAU;
      s[i] = 0.25 + rand() * 0.3;
    }
    return { x, y, p, s };
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
    const slant = g.H * 0.6;
    for (let b = 0; b < 2; b++) {
      const cx = ((t * g.U * (1.6 + b * 0.9) + b * span * 0.55) % span) - g.H * 0.2 + slant;
      const w = g.U * (9 + b * 5);
      for (let k = 0; k < 3; k++) {
        const half = w * (1 - k * 0.3);
        ctx.save();
        band(ctx, g, cx, half, slant);
        ctx.clip();
        ctx.globalAlpha = Math.min(1, amount) * (b ? 0.5 : 0.75) * (k === 0 ? 0.4 : k === 1 ? 0.6 : 0.8);
        ctx.drawImage(state.lit, 0, 0);
        ctx.restore();
        ctx.globalAlpha = Math.min(1, amount) * 0.05;
        ctx.fillStyle = '#f4efe0';
        ctx.save();
        band(ctx, g, cx, half * 1.2, slant);
        ctx.fill();
        ctx.restore();
      }
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
      if (a <= 0.2) continue;
      ctx.globalAlpha = Math.min(1, (a - 0.2) * amount * 0.7);
      ctx.fillRect(G.x[i], G.y[i], sz, sz);
      ctx.fillRect(G.x[i] - sz, G.y[i] + sz * 0.35, sz * 3, Math.max(1, sz * 0.3));
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const R = U * 15;
    const g = { W, H, U, R, sx: U * 44, sy: U * 26 };
    state.g = g;
    state.plate = paintPlate(g);
    state.lit = paintGoldLit(g);
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
