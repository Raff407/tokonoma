/*
 * 玉 Yu — a jade bi disc and a carved pendant on a vermilion cord, against dark lacquer.
 *
 * The stone is baked twice: once as the dim body with grain studs, and once as a pale
 * clouded copy. Each frame lays the pale copy through two slow slanted bands so light
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

  function cloudMap(g, lo, hi, base, seed) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const d = img.data;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const v = fbm(x / (g.S * 8), y / (g.S * 8), 4, seed);
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

  function grainStuds(ctx, g, rand) {
    const step = g.S * 2.9;
    const inner = g.hole * 1.55;
    const outer = g.R * 0.84;
    const r = Math.max(0.9, g.S * 0.95);
    for (let row = -g.R / step; row < g.R / step; row++) {
      for (let col = -g.R / step; col < g.R / step; col++) {
        const x = g.cx + (col + (row & 1 ? 0.5 : 0)) * step;
        const y = g.cy + row * step * 0.87;
        const d = Math.hypot(x - g.cx, y - g.cy);
        if (d < inner || d > outer) continue;
        const a = Math.atan2(y - g.cy, x - g.cx);
        ctx.fillStyle = JADE.deep;
        ctx.beginPath();
        ctx.ellipse(x + r * 0.35, y + r * 0.4, r, r * 0.85, a, 0, TAU);
        ctx.fill();
        ctx.fillStyle = rand() < 0.5 ? JADE.light : JADE.mid;
        ctx.beginPath();
        ctx.ellipse(x - r * 0.1, y - r * 0.12, r * 0.8, r * 0.68, a, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = JADE.dark;
        ctx.lineWidth = Math.max(1, r * 0.5);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5);
        ctx.lineTo(x + Math.cos(a + 0.6) * r * 1.6, y + Math.sin(a + 0.6) * r * 1.6);
        ctx.stroke();
      }
    }
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
    // a small cloud head and two curled lobes cut into the face
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

  function paintStone(g, rand, lit) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    if (lit) {
      shapes(ctx, g, JADE.pale);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(cloudMap(g, 0.25, 0.95, 0.6, 91), 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      return c;
    }
    const gr = ctx.createLinearGradient(g.cx - g.R, g.cy - g.R, g.cx + g.R, g.cy + g.R * 1.9);
    gr.addColorStop(0, JADE.light);
    gr.addColorStop(0.45, JADE.mid);
    gr.addColorStop(1, JADE.dark);
    shapes(ctx, g, gr);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.drawImage(cloudMap(g, 0.1, 0.5, 0.2, 37), 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    rings(ctx, g);
    grainStuds(ctx, g, rand);
    pendantCarving(ctx, g);
    // dark rim to give the stone thickness
    ctx.strokeStyle = JADE.deep;
    ctx.lineWidth = Math.max(1, g.S * 0.8);
    discPath(ctx, g);
    ctx.stroke();
    penPath(ctx, g, 1);
    ctx.stroke();
    return c;
  }

  // ---- cord and tassel -----------------------------------------------------

  function paintCord(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
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
    return c;
  }

  function paintKnot(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
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
    return c;
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

  function band(ctx, g, x, w, slant) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + w, 0);
    ctx.lineTo(x + w - slant, g.H);
    ctx.lineTo(x - slant, g.H);
    ctx.closePath();
  }

  function drawLight(ctx, g, t, glow) {
    if (glow <= 0) return;
    const slant = g.H * 0.28;
    const span = g.W * 0.7 + slant * 2;
    const x0 = g.cx - g.W * 0.35;
    for (let b = 0; b < 2; b++) {
      const w = g.S * (16 + b * 8);
      const x = x0 + ((t * g.S * (2.2 + b * 1.1) + b * span * 0.5) % span);
      for (let k = 0; k < 3; k++) {
        ctx.save();
        band(ctx, g, x - k * g.S * 0, w * (1 - k * 0.3), slant);
        ctx.clip();
        ctx.globalAlpha = Math.min(1, glow) * (b ? 0.4 : 0.6) * (0.35 + k * 0.3);
        ctx.drawImage(state.lit, 0, 0);
        ctx.restore();
      }
    }
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

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBackdrop(g);
    state.halo = paintHalo(g);
    state.cord = paintCord(g);
    state.knot = paintKnot(g);
    state.stone = paintStone(g, rand, false);
    state.lit = paintStone(g, rand, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { glow, sway } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawHalo(ctx, g, t, glow);
    ctx.drawImage(state.cord, 0, 0);
    ctx.drawImage(state.stone, 0, 0);
    drawLight(ctx, g, t, glow);
    ctx.drawImage(state.knot, 0, 0);
    drawTassel(ctx, g, t, sway);
  }

  Kasuri.run({
    defaults: { glow: 1, sway: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
