/*
 * 玉 Yu — a jade bi disc and a carved pendant on a vermilion cord, against dark lacquer.
 *
 * Backdrop, cord, stone and knot bake into one layer. A pale clouded copy of the stone,
 * cropped to its box, shows through two soft slanted bands (masks baked once) so light
 * seems to travel inside the jade. A halo breathes and the tassel strands sway.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, smoothstep } = K;
  const TAU = Math.PI * 2;

  const INK = ['#0f1517', '#16211f', '#1d2c2e'];
  const JADE = { deep: '#264536', dark: '#35604a', mid: '#5b8a6b', light: '#8fb594', pale: '#c4dcb8' };
  const CORD = { main: '#b13a2a', dark: '#7e271e', light: '#cf5a3e' };
  const GOLD = '#c2a04c';
  const STRANDS = 9;
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
    const S = Math.min(H / 100, W / 62);
    const top = (H - 98 * S) / 2;
    const cx = W / 2;
    const cy = top + 35 * S;
    const R = 27 * S;
    return {
      W, H, S, cx, cy, R,
      hole: R * 0.22,
      knotY: cy + R + 3.5 * S,
      penY: cy + R + 14 * S,
      penRx: 6.5 * S,
      penRy: 9.5 * S,
    };
  }

  function discPath(ctx, g) {
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.R, 0, TAU);
    ctx.moveTo(g.cx + g.hole, g.cy);
    ctx.arc(g.cx, g.cy, g.hole, 0, TAU, true);
  }

  function penPoints(g, k, n, out) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const m = 1 + 0.09 * Math.cos(a * 4) - 0.05 * Math.cos(a * 2);
      out.push(g.cx + Math.cos(a) * g.penRx * k * m, g.penY + Math.sin(a) * g.penRy * k * m);
    }
    return out;
  }

  function penPath(ctx, g, k) {
    const p = penPoints(g, k, 56, []);
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.closePath();
    const hy = g.penY - g.penRy * 0.62 * k;
    ctx.moveTo(g.cx + g.S * 1.1, hy);
    ctx.arc(g.cx, hy, g.S * 1.1, 0, TAU, true);
  }

  function shapes(ctx, g, fill) {
    ctx.fillStyle = fill;
    discPath(ctx, g);
    ctx.fill('evenodd');
    penPath(ctx, g, 1);
    ctx.fill('evenodd');
  }

  // ---- backdrop ------------------------------------------------------------

  function paintBackdrop(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const bg = ctx.createRadialGradient(g.cx, g.cy, g.R * 0.2, g.cx, g.cy, Math.max(g.W, g.H) * 0.75);
    bg.addColorStop(0, INK[2]);
    bg.addColorStop(0.5, INK[1]);
    bg.addColorStop(1, INK[0]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, g.W, g.H);
    // faint cloud scrolls drifting behind, drawn as pale arcs
    ctx.strokeStyle = 'rgba(120,150,140,0.10)';
    ctx.lineWidth = Math.max(1, g.S * 0.4);
    const spots = [[0.14, 0.22], [0.86, 0.3], [0.12, 0.74], [0.88, 0.78]];
    for (const [fx, fy] of spots) {
      const x = g.W * fx;
      const y = g.H * fy;
      for (let k = 0; k < 3; k++) {
        const r = g.S * (3 + k * 2.6);
        ctx.beginPath();
        ctx.arc(x + k * g.S * 1.2, y, r, Math.PI * 0.9, Math.PI * 2.1);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x - g.S * 4, y + g.S * 2, g.S * 2.4, Math.PI * 1.1, Math.PI * 2.3);
      ctx.stroke();
    }
    return c;
  }

  function paintHalo(g) {
    const r = g.R * 1.9;
    const c = layer(r * 2, r * 2);
    const ctx = c.getContext('2d');
    const gr = ctx.createRadialGradient(r, r, g.R * 0.5, r, r, r);
    gr.addColorStop(0, 'rgba(110,160,125,0.30)');
    gr.addColorStop(0.5, 'rgba(70,115,90,0.12)');
    gr.addColorStop(1, 'rgba(40,80,60,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, r * 2, r * 2);
    return c;
  }

  // ---- stone ---------------------------------------------------------------

  // alpha map of fbm cloud, w x h, sampled at offset (ox, oy) in scene space
  function cloudMap(g, w, h, ox, oy, lo, hi, base, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const d = img.data;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const v = fbm((x + ox) / (g.S * 8), (y + oy) / (g.S * 8), 4, seed);
        const i = (y * c.width + x) * 4;
        d[i] = 255;
        d[i + 1] = 255;
        d[i + 2] = 255;
        d[i + 3] = Math.round(255 * (base + (hi - base) * smoothstep(0.38, 0.68, v) - (base - lo) * (1 - smoothstep(0.2, 0.4, v))));
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // low raised bosses of the grain pattern: small, sparse, jittered, soft
  function grainStuds(ctx, g, rand) {
    const step = g.S * 4.2;
    const inner = g.hole * 1.7;
    const outer = g.R * 0.82;
    const r = Math.max(0.8, g.S * 0.6);
    for (let row = -g.R / step; row < g.R / step; row++) {
      for (let col = -g.R / step; col < g.R / step; col++) {
        const x = g.cx + (col + (row & 1 ? 0.5 : 0)) * step + (rand() - 0.5) * step * 0.35;
        const y = g.cy + row * step * 0.87 + (rand() - 0.5) * step * 0.35;
        const d = Math.hypot(x - g.cx, y - g.cy);
        if (d < inner || d > outer || rand() < 0.2) continue;
        const a = rand() * TAU;
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = JADE.dark;
        ctx.beginPath();
        ctx.arc(x + r * 0.3, y + r * 0.35, r, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = JADE.light;
        ctx.beginPath();
        ctx.arc(x - r * 0.15, y - r * 0.15, r * 0.7, 0, TAU);
        ctx.fill();
        // a faint curl, as in carved grain
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = JADE.dark;
        ctx.lineWidth = Math.max(0.8, r * 0.35);
        ctx.beginPath();
        ctx.arc(x, y, r * 1.5, a, a + 2.2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function rings(ctx, g) {
    ctx.lineWidth = Math.max(1, g.S * 0.55);
    const marks = [[g.R * 0.9, JADE.deep], [g.hole * 1.4, JADE.deep], [g.R * 0.985, JADE.pale], [g.hole * 1.06, JADE.light]];
    for (const [r, col] of marks) {
      ctx.strokeStyle = col;
      ctx.globalAlpha = col === JADE.pale || col === JADE.light ? 0.55 : 0.9;
      ctx.beginPath();
      ctx.arc(g.cx, g.cy, r, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function pendantCarving(ctx, g) {
    const lw = Math.max(1, g.S * 0.55);
    ctx.lineWidth = lw;
    ctx.strokeStyle = JADE.deep;
    penPath(ctx, g, 0.78);
    ctx.stroke();
    const cy = g.penY + g.penRy * 0.12;
    ctx.beginPath();
    ctx.arc(g.cx, cy, g.S * 2.6, Math.PI, TAU);
    ctx.arc(g.cx + g.S * 2.6, cy + g.S * 1.6, g.S * 2.6, Math.PI * 1.5, Math.PI * 0.5, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(g.cx - g.S * 1.9, cy + g.S * 3.8, g.S * 2.1, 0, Math.PI * 1.5, true);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(g.cx, cy + g.S * 4.2);
    ctx.lineTo(g.cx, g.penY + g.penRy * 0.62);
    ctx.stroke();
  }

  function paintStone(ctx, g, rand) {
    const gr = ctx.createLinearGradient(g.cx - g.R, g.cy - g.R, g.cx + g.R, g.cy + g.R * 1.9);
    gr.addColorStop(0, JADE.mid);
    gr.addColorStop(0.45, JADE.dark);
    gr.addColorStop(1, JADE.deep);
    const s = layer(g.W, g.H);
    const sc = s.getContext('2d');
    shapes(sc, g, gr);
    sc.globalCompositeOperation = 'source-atop';
    const cm = cloudMap(g, g.box.w, g.box.h, g.box.x, g.box.y, 0.05, 0.35, 0.12, 37);
    sc.drawImage(cm, g.box.x, g.box.y);
    sc.globalCompositeOperation = 'source-over';
    rings(sc, g);
    grainStuds(sc, g, rand);
    pendantCarving(sc, g);
    sc.strokeStyle = JADE.deep;
    sc.lineWidth = Math.max(1, g.S * 0.8);
    discPath(sc, g);
    sc.stroke();
    penPath(sc, g, 1);
    sc.stroke();
    ctx.drawImage(s, 0, 0);
  }

  // pale clouded copy of the stone, cropped to the stone's box
  function paintLit(g) {
    const b = g.box;
    const c = layer(b.w, b.h);
    const ctx = c.getContext('2d');
    ctx.translate(-b.x, -b.y);
    shapes(ctx, g, JADE.pale);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(cloudMap(g, b.w, b.h, b.x, b.y, 0.45, 1, 0.8, 91), 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  // ---- cord and tassel -----------------------------------------------------

  function paintCord(ctx, g) {
    const w = Math.max(2, g.S * 1.5);
    ctx.lineCap = 'round';
    ctx.strokeStyle = CORD.dark;
    ctx.lineWidth = w + 1;
    ctx.beginPath();
    ctx.moveTo(g.cx, 0);
    ctx.lineTo(g.cx, g.penY - g.penRy * 0.62);
    ctx.stroke();
    ctx.strokeStyle = CORD.main;
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.strokeStyle = CORD.light;
    ctx.lineWidth = Math.max(1, w * 0.3);
    ctx.beginPath();
    ctx.moveTo(g.cx - w * 0.2, 0);
    ctx.lineTo(g.cx - w * 0.2, g.penY - g.penRy * 0.62);
    ctx.stroke();
  }

  function paintKnot(ctx, g) {
    const k = g.S;
    ctx.fillStyle = CORD.dark;
    ctx.beginPath();
    ctx.ellipse(g.cx, g.knotY, k * 2.7, k * 2.2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = CORD.main;
    ctx.beginPath();
    ctx.ellipse(g.cx - k * 0.2, g.knotY - k * 0.2, k * 2.3, k * 1.8, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = CORD.light;
    ctx.lineWidth = Math.max(1, k * 0.4);
    ctx.beginPath();
    ctx.moveTo(g.cx - k * 1.8, g.knotY);
    ctx.lineTo(g.cx + k * 1.8, g.knotY);
    ctx.moveTo(g.cx, g.knotY - k * 1.4);
    ctx.lineTo(g.cx, g.knotY + k * 1.4);
    ctx.stroke();
    // tassel head: a gold bead just under the pendant
    const by = g.penY + g.penRy + g.S * 1.2;
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.ellipse(g.cx, by, k * 1.5, k * 1.3, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = CORD.dark;
    ctx.fillRect(g.cx - k * 1.1, by + k * 1.1, k * 2.2, k * 1.4);
  }

  function drawTassel(ctx, g, t, sway) {
    const y0 = g.penY + g.penRy + g.S * 3.6;
    const len = g.S * 7.5;
    ctx.lineCap = 'round';
    for (let i = 0; i < STRANDS; i++) {
      const f = i / (STRANDS - 1) - 0.5;
      const x0 = g.cx + f * g.S * 2.4;
      const s = Math.sin(t * 0.9 + i * 0.35) * g.S * 1.0 * sway + Math.sin(t * 0.47) * g.S * 0.8 * sway;
      ctx.strokeStyle = i % 3 === 0 ? CORD.dark : i % 3 === 1 ? CORD.main : CORD.light;
      ctx.lineWidth = Math.max(1, g.S * 0.55);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 + s * 0.3 + f * g.S * 2, y0 + len * 0.55, x0 + s + f * g.S * 4, y0 + len);
      ctx.stroke();
    }
  }

  // ---- light ---------------------------------------------------------------

  // a soft slanted band, white at its centre, fading to clear on both sides
  function paintBand(g, w) {
    const h = g.box.h;
    const slant = h * 0.3;
    const c = layer(w + slant, h);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    for (let y = 0; y < h; y++) {
      ctx.setTransform(1, 0, 0, 1, slant * (1 - y / h), y);
      ctx.fillRect(0, 0, w, 1);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return c;
  }

  function drawLight(ctx, g, t, glow) {
    if (glow <= 0) return;
    const b = g.box;
    const sc = state.scratchCtx;
    sc.globalCompositeOperation = 'source-over';
    sc.clearRect(0, 0, b.w, b.h);
    for (let i = 0; i < 2; i++) {
      const m = state.bands[i];
      const span = b.w + m.width;
      const x = ((t * g.S * (2.6 + i * 1.3) + i * span * 0.5) % span) - m.width;
      sc.globalAlpha = i ? 0.75 : 1;
      sc.drawImage(m, x, 0);
    }
    sc.globalAlpha = 1;
    sc.globalCompositeOperation = 'source-in';
    sc.drawImage(state.lit, 0, 0);
    sc.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = Math.min(1, glow * 0.9);
    ctx.drawImage(state.scratch, b.x, b.y);
    ctx.globalAlpha = 1;
  }

  function drawHalo(ctx, g, t, glow) {
    if (glow <= 0) return;
    const h = state.halo;
    ctx.globalAlpha = Math.min(1, glow) * (0.65 + 0.35 * Math.sin(t * 0.5));
    ctx.drawImage(h, g.cx - h.width / 2, g.cy - h.height / 2);
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  // halo with the stone and cord cut out, so it only lights the lacquer behind
  function cutHalo(g, halo) {
    const ctx = halo.getContext('2d');
    const ox = halo.width / 2 - g.cx;
    const oy = halo.height / 2 - g.cy;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.translate(ox, oy);
    shapes(ctx, g, '#000');
    const w = Math.max(2, g.S * 1.5) + 2;
    ctx.fillRect(g.cx - w / 2, -oy, w, g.penY + oy);
    ctx.beginPath();
    ctx.ellipse(g.cx, g.knotY, g.S * 2.8, g.S * 2.3, 0, 0, TAU);
    ctx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    return halo;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const pad = 2;
    const bx = Math.floor(g.cx - g.R - pad);
    const by = Math.floor(g.cy - g.R - pad);
    g.box = { x: bx, y: by, w: Math.ceil(g.R * 2 + pad * 2) + 1, h: Math.ceil(g.penY + g.penRy + pad - by) + 1 };
    const rand = K.rng(api.seed);
    state.g = g;
    const base = paintBackdrop(g);
    const bctx = base.getContext('2d');
    paintCord(bctx, g);
    paintStone(bctx, g, rand);
    paintKnot(bctx, g);
    state.base = base;
    state.halo = cutHalo(g, paintHalo(g));
    state.lit = paintLit(g);
    state.bands = [paintBand(g, g.S * 14), paintBand(g, g.S * 22)];
    state.scratch = layer(g.box.w, g.box.h);
    state.scratchCtx = state.scratch.getContext('2d');
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { glow, sway } = api.props;
    ctx.drawImage(state.base, 0, 0);
    drawHalo(ctx, g, t, glow);
    drawLight(ctx, g, t, glow);
    drawTassel(ctx, g, t, sway);
  }

  Kasuri.run({
    defaults: { glow: 1, sway: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
