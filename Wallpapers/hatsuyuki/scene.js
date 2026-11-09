/*
 * 初雪 Hatsuyuki — the first snow on a persimmon branch.
 *
 * Sky, hills and the farm roof are baked once. The branch with its fruit and snow caps
 * is a second baked layer that sways a hair about its root. Snow is a short reused pool.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const SKY = ['#8d949a', '#a3a8aa', '#b9bbb7', '#cdcbc2', '#dcd8cc'];
  const FLAKES = 110;
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
    return { W, H, U: H / 100 };
  }

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.H);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / (g.H * 0.75)) * (inks.length - 1);
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

  function ridge(g, x, base, amp, seed, scale) {
    return base + K.fbm(x / (g.U * scale), seed, 4, seed * 3) * amp;
  }

  function hill(ctx, g, base, amp, seed, scale, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 3; x += 3) ctx.lineTo(x, ridge(g, x, base, amp, seed, scale));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    const gr = ctx.createLinearGradient(0, base, 0, base + g.H * 0.2);
    gr.addColorStop(0, 'rgba(210,209,201,0)');
    gr.addColorStop(1, 'rgba(210,209,201,0.85)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, base, g.W, g.H * 0.2);
  }

  function mistBand(ctx, g, y, alpha) {
    ctx.fillStyle = 'rgba(214,213,205,' + alpha + ')';
    for (let x = -g.U * 10; x < g.W + g.U * 10; x += g.U * 14) {
      blob(ctx, x + g.U * 6, y, g.U * 13, g.U * 2.2);
    }
  }

  function pineTuft(ctx, x, y, h, ink) {
    ctx.fillStyle = ink;
    for (let i = 0; i < 4; i++) {
      const w = h * (0.34 - i * 0.07);
      poly(ctx, [x - w, y - h * (0.18 + i * 0.22), x + w, y - h * (0.18 + i * 0.22), x, y - h * (0.5 + i * 0.22)]);
    }
    ctx.fillRect(x - h * 0.03, y - h * 0.2, h * 0.06, h * 0.2);
  }

  // A thatched farmhouse seen side on: steep roof with a ridge, snow along the top.
  function minka(ctx, g, x, y, s) {
    ctx.fillStyle = '#58595a';
    poly(ctx, [x - s * 11, y, x - s * 7, y - s * 8.5, x + s * 7, y - s * 8.5, x + s * 11, y]);
    ctx.fillStyle = '#e4e2da';
    poly(ctx, [x - s * 7.6, y - s * 7.2, x - s * 7, y - s * 8.5, x + s * 7, y - s * 8.5, x + s * 7.6, y - s * 7.2, x, y - s * 6.2]);
    ctx.fillStyle = '#6b665c';
    ctx.fillRect(x - s * 8.2, y - s * 0.1, s * 16.4, s * 0.1 + 1);
    ctx.fillStyle = '#4a4440';
    ctx.fillRect(x - s * 7, y - s * 3.4, s * 14, s * 3.4);
    ctx.fillStyle = '#9c8a6a';
    ctx.fillRect(x - s * 3, y - s * 3, s * 2.4, s * 3);
    ctx.fillRect(x + s * 1.2, y - s * 3, s * 2.4, s * 3);
    ctx.fillStyle = '#e4e2da';
    ctx.fillRect(x - s * 7.6, y - s * 3.7, s * 15.2, s * 0.5);
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    hill(ctx, g, g.H * 0.5, g.H * 0.14, 2.3, 34, '#b3b7b5');
    mistBand(ctx, g, g.H * 0.6, 0.55);
    hill(ctx, g, g.H * 0.62, g.H * 0.1, 5.1, 26, '#a3aca8');
    for (let x = g.W * 0.05; x < g.W * 0.5; x += g.U * (2 + rand() * 3)) {
      pineTuft(ctx, x, ridge(g, x, g.H * 0.62, g.H * 0.1, 5.1, 26) + g.U * 1.5, g.U * (4 + rand() * 3), '#8a9892');
    }
    mistBand(ctx, g, g.H * 0.72, 0.6);
    hill(ctx, g, g.H * 0.78, g.H * 0.07, 8.7, 22, '#cfd0ca');
    minka(ctx, g, g.W * 0.27, g.H * 0.8, g.U * 0.8);
    hill(ctx, g, g.H * 0.9, g.H * 0.04, 3.3, 18, '#e2e0d8');
    return c;
  }

  // ---- the branch ----------------------------------------------------------

  function limb(ctx, pts, w0, w1, ink) {
    const n = pts.length - 1;
    ctx.strokeStyle = ink;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      ctx.lineWidth = Math.max(1, w0 + (w1 - w0) * (i / n));
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
      ctx.stroke();
    }
  }

  function snowOn(ctx, pts, w0, w1, g) {
    const n = pts.length - 1;
    ctx.strokeStyle = '#f1efe8';
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const w = w0 + (w1 - w0) * (i / n);
      ctx.lineWidth = Math.max(1, w * 0.55);
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1] - w * 0.45);
      ctx.lineTo(pts[i + 1][0], pts[i + 1][1] - w * 0.45);
      ctx.stroke();
    }
  }

  function bez(p0, p1, p2, n, rand, wob) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = (1 - t) * (1 - t);
      const b = 2 * t * (1 - t);
      const c = t * t;
      out.push([
        a * p0[0] + b * p1[0] + c * p2[0] + (rand() - 0.5) * wob,
        a * p0[1] + b * p1[1] + c * p2[1] + (rand() - 0.5) * wob,
      ]);
    }
    return out;
  }

  function persimmon(ctx, g, x, y, r) {
    ctx.strokeStyle = '#4a3a2c';
    ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.5);
    ctx.lineTo(x, y - r * 0.6);
    ctx.stroke();
    ctx.fillStyle = '#bd5a28';
    blob(ctx, x, y, r, r * 0.88);
    ctx.fillStyle = '#d67a35';
    blob(ctx, x - r * 0.15, y - r * 0.12, r * 0.78, r * 0.68);
    ctx.fillStyle = '#e6a05a';
    blob(ctx, x - r * 0.4, y - r * 0.32, r * 0.28, r * 0.2);
    ctx.fillStyle = '#5f6a3c';
    poly(ctx, [x - r * 0.9, y - r * 0.55, x, y - r * 0.95, x + r * 0.9, y - r * 0.55, x + r * 0.3, y - r * 0.3, x - r * 0.3, y - r * 0.3]);
    ctx.fillStyle = '#f1efe8';
    blob(ctx, x, y - r * 0.9, r * 0.8, r * 0.3);
  }

  function twig(from, dirx, len, rise, rand, U) {
    const p0 = from;
    const p1 = [from[0] + dirx * len * 0.5, from[1] + rise * len * 0.1 + U * 2];
    const p2 = [from[0] + dirx * len, from[1] + rise * len];
    return bez(p0, p1, p2, 12, rand, U * 0.5);
  }

  function paintBranch(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const U = g.U;
    const main = bez([g.W + U * 4, U * 4], [g.W * 0.72, U * 10], [g.W * 0.3, U * 38], 28, rand, U * 0.8);
    const specs = [[6, -1, U * 20, 0.35], [11, -1, U * 26, 0.2], [15, -1, U * 18, 0.6], [15, 1, U * 12, -0.4],
      [19, -1, U * 20, 0.5], [23, -1, U * 14, 0.7], [9, 1, U * 12, -0.5]];
    const arms = specs.map((s) => twig(main[s[0]], s[1], s[2], s[3], rand, U));
    const w0 = U * 4.2;
    limb(ctx, main, w0, U * 1.2, '#3a2f27');
    for (const a of arms) limb(ctx, a, U * 1.4, U * 0.45, '#3a2f27');
    ctx.fillStyle = '#9a4a2a';
    for (const a of arms) {
      for (let k = 5; k < a.length; k += 4) {
        const p = a[k];
        const s = U * (0.9 + rand() * 0.6);
        ctx.save();
        ctx.translate(p[0], p[1] + s * 0.6);
        ctx.rotate(rand() * TAU);
        blob(ctx, 0, 0, s, s * 0.45);
        ctx.restore();
      }
    }
    const R = U * 5.2;
    const fruit = [[1, 12, 1], [3, 12, 0.9], [2, 12, 1], [4, 12, 0.95], [5, 12, 0.85]];
    for (const f of fruit) {
      const p = arms[f[0]][f[1]];
      persimmon(ctx, g, p[0], p[1] + R * 1.7 * f[2], R * f[2]);
    }
    snowOn(ctx, main, w0, U * 1.2, g);
    for (const a of arms) snowOn(ctx, a, U * 1.4, U * 0.45, g);
    return { canvas: c, ox: g.W + U * 4, oy: U * 4 };
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

  function drawSnow(ctx, g, t, dt, count, wind) {
    const f = state.flakes;
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) {
      f.y[i] += g.U * 5 * f.v[i] * step;
      f.x[i] += (Math.sin(t * 0.6 + f.p[i]) * 1.2 + wind * 1.6) * g.U * 0.9 * step;
      if (f.y[i] > g.H + 2) { f.y[i] = -2; f.x[i] = Math.random() * g.W; }
      if (f.x[i] > g.W + 2) f.x[i] = -2;
      const sz = Math.max(1, g.U * (0.6 + f.s[i] * 0.8));
      ctx.globalAlpha = 0.55 + 0.4 * f.s[i];
      ctx.fillStyle = '#f6f4ee';
      ctx.fillRect(f.x[i], f.y[i], sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.branch = paintBranch(g, rand);
    state.flakes = makeFlakes(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { snow, wind } = api.props;
    const count = Math.min(FLAKES, Math.round(70 * snow));
    ctx.drawImage(state.back, 0, 0);
    const b = state.branch;
    const ang = Math.sin(t * 0.5) * 0.014 * (0.4 + wind) + Math.sin(t * 1.3) * 0.005 * wind;
    ctx.setTransform(Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), b.ox - Math.cos(ang) * b.ox + Math.sin(ang) * b.oy, b.oy - Math.sin(ang) * b.ox - Math.cos(ang) * b.oy);
    ctx.drawImage(b.canvas, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawSnow(ctx, g, t, dt, count, wind);
  }

  Kasuri.run({
    defaults: { snow: 1, wind: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
