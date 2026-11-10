/*
 * 刺子 Sashiko — white running stitches on indigo cloth.
 *
 * Cloth and stitches are baked once. Each frame lays the cloth, then the part of the
 * stitch layer already sewn: whole bands above the needle and a partial band beside it.
 * Bands are sewn left to right, then right to left. When the cloth is full it rests,
 * the stitches fade out slowly and the sewing starts again.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const CLOTH = ['#17233f', '#1b2a4a', '#20325a'];
  const THREAD = '#ece4d0';
  const THREAD_SHADE = '#b9b3a6';
  const NEEDLE = '#d9b45a';
  const TAIL = '#c8432b';
  const SEW = 36;
  const REST = 12;
  const FADE = 7;
  const SQ3 = Math.sqrt(3);
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
    const s = Math.max(7, U * 9);
    const band = Math.max(2, U * 2.6);
    return { W, H, U, s, band, dash: Math.max(2.2, U * 1.6), line: Math.max(1.3, U * 0.7) };
  }

  // ---- cloth ---------------------------------------------------------------

  function paintCloth(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = CLOTH[1];
    ctx.fillRect(0, 0, g.W, g.H);
    for (let y = 0; y < g.H; y++) {
      ctx.fillStyle = y % 2 ? CLOTH[0] : CLOTH[2];
      ctx.globalAlpha = 0.08;
      ctx.fillRect(0, y, g.W, 1);
    }
    for (let x = 0; x < g.W; x++) {
      ctx.fillStyle = x % 2 ? CLOTH[0] : CLOTH[2];
      ctx.globalAlpha = 0.06;
      ctx.fillRect(x, 0, 1, g.H);
    }
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < g.W * g.H * 0.04; i++) {
      ctx.fillStyle = rand() < 0.5 ? '#0e1830' : '#3a4f7c';
      ctx.fillRect(Math.floor(rand() * g.W), Math.floor(rand() * g.H), 1 + Math.floor(rand() * 3), 1);
    }
    ctx.globalAlpha = 1;
    const v = ctx.createRadialGradient(g.W / 2, g.H / 2, g.H * 0.3, g.W / 2, g.H / 2, g.W * 0.62);
    v.addColorStop(0, 'rgba(8,14,32,0)');
    v.addColorStop(1, 'rgba(8,14,32,0.3)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  // ---- stitch helpers ------------------------------------------------------

  function dashed(ctx, g, shade) {
    ctx.setLineDash([g.dash, g.dash * 0.6]);
    ctx.lineWidth = g.line;
    ctx.strokeStyle = shade ? THREAD_SHADE : THREAD;
    ctx.lineCap = 'round';
  }

  function seg(ctx, x0, y0, x1, y1) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  // shippo: circles on a square lattice, each overlapping its neighbours
  function shippo(ctx, g, x0, y0, x1, y1) {
    const d = g.s * 2.1;
    const r = d / Math.SQRT2;
    dashed(ctx, g, false);
    for (let y = y0 - d; y < y1 + d; y += d) {
      for (let x = -d; x < g.W + d; x += d) {
        ctx.beginPath();
        ctx.arc(x + d / 2, y + d / 2, r, 0, TAU);
        ctx.stroke();
      }
    }
    dashed(ctx, g, true);
    ctx.lineWidth = g.line * 0.8;
    for (let y = y0 - d; y < y1 + d; y += d) {
      for (let x = -d; x < g.W + d; x += d) {
        ctx.beginPath();
        ctx.arc(x + d / 2, y + d / 2, r * 0.28, 0, TAU);
        ctx.stroke();
      }
    }
  }

  // asanoha: triangle lattice with a star inside every triangle
  function asanoha(ctx, g, x0, y0, x1, y1) {
    const a = g.s * 1.7;
    const h = a * SQ3 / 2;
    dashed(ctx, g, false);
    const rows = Math.ceil((y1 - y0) / h) + 2;
    const cols = Math.ceil(g.W / a) + 2;
    for (let j = -1; j < rows; j++) {
      const y = y0 + j * h;
      seg(ctx, 0, y, g.W, y);
      for (let i = -cols; i < cols * 2; i++) {
        const x = i * a + (j & 1 ? a / 2 : 0);
        if (x < -a || x > g.W + a) continue;
        seg(ctx, x, y, x + a / 2, y + h);
        seg(ctx, x, y, x - a / 2, y + h);
      }
    }
    dashed(ctx, g, true);
    ctx.lineWidth = g.line * 0.85;
    for (let j = -1; j < rows; j++) {
      const y = y0 + j * h;
      for (let i = -1; i < cols; i++) {
        const x = i * a + (j & 1 ? a / 2 : 0);
        if (x < -a || x > g.W + a) continue;
        star(ctx, x, y, a, h, false);
        star(ctx, x + a / 2, y + h, a, h, false);
        star(ctx, x + a / 2, y, a, h, true);
      }
    }
  }

  // one star: from the triangle centre to its three corners
  function star(ctx, x, y, a, h, down) {
    const cx = x + (down ? a / 2 : a / 2);
    const cy = y + (down ? h * 0.33 : h * 0.67);
    const tx = x;
    ctx.beginPath();
    if (down) {
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx, y);
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx + a, y);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, y + h);
    } else {
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx, y + h);
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx + a, y + h);
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, y);
    }
    ctx.stroke();
  }

  // seigaiha: rows of overlapping wave rings, lower rows over upper ones
  function seigaiha(ctx, g, x0, y0, x1, y1) {
    const R = g.s * 1.25;
    const stepY = R * 0.5;
    const rings = 4;
    let row = 0;
    for (let y = y0 - R; y < y1 + R; y += stepY, row++) {
      for (let x = -R * 2 + (row & 1 ? R : 0); x < g.W + R * 2; x += R * 2) {
        ctx.save();
        ctx.setLineDash([]);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, R + g.line, Math.PI, 0);
        ctx.lineTo(x + R + g.line, y + R);
        ctx.lineTo(x - R - g.line, y + R);
        ctx.fill();
        ctx.restore();
        for (let k = 0; k < rings; k++) {
          dashed(ctx, g, k === rings - 1);
          ctx.beginPath();
          ctx.arc(x, y, R * (1 - k / rings), Math.PI, 0);
          ctx.stroke();
        }
      }
    }
  }

  function paintStitches(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const b1 = Math.round(g.H * 0.34);
    const b2 = Math.round(g.H * 0.67);
    const gap = g.band * 1.3;
    const bands = [[0, b1 - gap, shippo], [b1, b2 - gap, asanoha], [b2, g.H, seigaiha]];
    for (const [ya, yb, fn] of bands) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, ya, g.W, yb - ya);
      ctx.clip();
      fn(ctx, g, 0, ya, g.W, yb);
      ctx.restore();
    }
    dashed(ctx, g, false);
    ctx.lineWidth = g.line * 1.25;
    ctx.setLineDash([g.dash * 2.2, g.dash * 0.9]);
    for (const y of [b1 - gap * 0.5, b2 - gap * 0.5]) seg(ctx, 0, y, g.W, y);
    return c;
  }

  function paintLight(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const gr = ctx.createRadialGradient(g.W * 0.5, g.H * 0.35, 0, g.W * 0.5, g.H * 0.35, g.W * 0.55);
    gr.addColorStop(0, 'rgba(236,214,164,0.55)');
    gr.addColorStop(1, 'rgba(236,214,164,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.cloth = paintCloth(g, rand);
    state.stitches = paintStitches(g);
    state.light = paintLight(g);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { light, needle } = api.props;
    const cycle = SEW + REST + FADE;
    const ph = (t + SEW * 0.6) % cycle;
    ctx.drawImage(state.cloth, 0, 0);

    let alpha = 1;
    let prog = Math.min(1, ph / SEW);
    if (ph > SEW + REST) alpha = 1 - (ph - SEW - REST) / FADE;
    const total = g.H / g.band;
    const pos = prog * total;
    const rowIdx = Math.floor(pos);
    const frac = pos - rowIdx;
    const y = Math.min(g.H, rowIdx * g.band);
    const rtl = rowIdx & 1;

    ctx.globalAlpha = alpha;
    if (y > 0) ctx.drawImage(state.stitches, 0, 0, g.W, y, 0, 0, g.W, y);
    let nx = rtl ? g.W * (1 - frac) : g.W * frac;
    if (prog < 1) {
      const sw = rtl ? g.W - nx : nx;
      if (sw > 0) {
        const sx = rtl ? nx : 0;
        ctx.drawImage(state.stitches, sx, y, sw, g.band, sx, y, sw, g.band);
      }
    }
    ctx.globalAlpha = 1;

    if (light > 0) {
      const drift = Math.sin(t * 0.045 * Math.max(0.2, api.props.speed)) * g.W * 0.12;
      ctx.globalAlpha = 0.34 * light;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(state.light, drift, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    if (needle && prog < 1) {
      const ny = y + g.band * 0.5;
      const len = g.U * 5;
      const bob = Math.sin(t * 3) * g.U * 0.5;
      ctx.lineCap = 'round';
      ctx.setLineDash([]);
      ctx.lineWidth = Math.max(1, g.U * 0.4);
      ctx.strokeStyle = NEEDLE;
      const dir = rtl ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(nx, ny + bob);
      ctx.lineTo(nx + dir * len, ny - g.U * 1.8 + bob);
      ctx.stroke();
      ctx.strokeStyle = TAIL;
      ctx.lineWidth = Math.max(0.8, g.U * 0.25);
      ctx.beginPath();
      ctx.moveTo(nx + dir * len, ny - g.U * 1.8 + bob);
      ctx.lineTo(nx + dir * len * 1.5, ny - g.U * 1.2 + bob);
      ctx.stroke();
    }
  }

  Kasuri.run({
    defaults: { light: 1, needle: true, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
