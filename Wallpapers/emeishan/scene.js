/*
 * 峨眉山 Mount Emei — a forested summit, a gold temple roof and a sea of cloud.
 *
 * Sky, ridges, forest, temple and the halo ring are baked once. While it plays only
 * two tiling cloud strips and a mist strip slide sideways, and the halo breathes.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep, clamp, mixColor, toHex, parseColor } = K;
  const TAU = Math.PI * 2;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
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
    const U = H / 100;
    return { W, H, U, px: W * 0.34, hx: W * 0.7, hy: H * 0.4 };
  }

  // ---- sky and halo ---------------------------------------------------------

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.75);
    grad.addColorStop(0, '#56688a');
    grad.addColorStop(0.4, '#9aa9b4');
    grad.addColorStop(0.8, '#cdc7b0');
    grad.addColorStop(1, '#e4d6ae');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    const glow = ctx.createRadialGradient(g.hx, g.hy, 0, g.hx, g.hy, g.U * 34);
    glow.addColorStop(0, 'rgba(250,236,190,0.5)');
    glow.addColorStop(0.35, 'rgba(240,220,170,0.28)');
    glow.addColorStop(1, 'rgba(240,220,170,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  // Concentric muted rings: gold, vermilion, moss, indigo outward.
  function paintHalo(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const rings = [
      [13, 1.6, 'rgba(236,206,120,0.7)'],
      [15.6, 2, 'rgba(206,110,80,0.5)'],
      [18.2, 2, 'rgba(120,150,110,0.45)'],
      [20.8, 1.8, 'rgba(110,130,170,0.4)'],
    ];
    for (const [r, w, col] of rings) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w * g.U;
      ctx.beginPath();
      ctx.arc(g.hx, g.hy, r * g.U, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(252,242,205,0.22)';
    ctx.beginPath();
    ctx.arc(g.hx, g.hy, g.U * 12, 0, TAU);
    ctx.fill();
    return c;
  }

  // ---- mountains --------------------------------------------------------------

  function mainTops(g) {
    const tops = new Float32Array(g.W);
    for (let x = 0; x < g.W; x++) {
      const d = Math.abs(x - g.px) / (g.W * 0.5);
      const d2 = Math.abs(x - g.W * 0.62) / (g.W * 0.3);
      const p1 = d >= 1 ? 0 : 1 - Math.pow(d, 1.7);
      const p2 = d2 >= 1 ? 0 : 0.45 * (1 - Math.pow(d2, 1.6));
      const prof = Math.max(p1, p2);
      const y = lerp(g.H * 1.05, g.H * 0.3, prof);
      tops[x] = y + (fbm(x * 0.04, 2, 4, 9) - 0.5) * g.U * 7 * (prof > 0 ? 1 : 0);
    }
    return tops;
  }

  function farRidge(g, x, base, amp, seed) {
    return base + (fbm(x / (g.U * 22), 1.7, 4, seed) - 0.5) * amp;
  }

  function paintFar(g, base, amp, seed, col, top) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, farRidge(g, x, g.H * base, g.H * amp, seed));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    if (top) {
      const grad = ctx.createLinearGradient(0, g.H * (base - amp), 0, g.H * 0.8);
      grad.addColorStop(0, 'rgba(228,220,196,0)');
      grad.addColorStop(1, top);
      ctx.fillStyle = grad;
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillRect(0, 0, g.W, g.H);
      ctx.globalCompositeOperation = 'source-over';
    }
    return c;
  }

  function fir(ctx, x, y, s, dark, mid) {
    ctx.fillStyle = dark;
    poly(ctx, [x, y - s * 3.2, x - s * 0.9, y - s * 1.4, x + s * 0.9, y - s * 1.4]);
    poly(ctx, [x, y - s * 2.3, x - s * 1.25, y - s * 0.3, x + s * 1.25, y - s * 0.3]);
    poly(ctx, [x, y - s * 1.3, x - s * 1.6, y + s * 0.8, x + s * 1.6, y + s * 0.8]);
    ctx.fillStyle = mid;
    poly(ctx, [x, y - s * 3.2, x - s * 0.9, y - s * 1.4, x - s * 0.1, y - s * 1.4]);
    poly(ctx, [x, y - s * 2.3, x - s * 1.25, y - s * 0.3, x - s * 0.1, y - s * 0.3]);
  }

  function paintMain(g, tops, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const rock = parseColor('#3f5240');
    const haze = parseColor('#8c9a96');
    for (let x = 0; x < g.W; x++) {
      const t0 = Math.max(0, Math.floor(tops[x]));
      const slope = tops[Math.min(g.W - 1, x + 2)] - tops[Math.max(0, x - 2)];
      const lit = clamp(1 - slope * 0.05, 0.7, 1.25);
      for (let y = t0; y < g.H; y++) {
        const n = fbm(x * 0.2, y * 0.12, 2, 5);
        const depth = (y - tops[x]) / (g.H * 0.5);
        const col = mixColor(rock, haze, smoothstep(0.1, 1.2, depth) * 0.55);
        const k = (0.8 + n * 0.45) * lit;
        const i = (y * g.W + x) * 4;
        img.data[i] = col[0] * k;
        img.data[i + 1] = col[1] * k;
        img.data[i + 2] = col[2] * k;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // fir forest in rows, bigger toward the bottom
    for (let y = g.H * 0.34; y < g.H * 0.72; y += g.U * 1.5) {
      const f = (y - g.H * 0.3) / (g.H * 0.45);
      const s = g.U * (0.55 + f * 1.1);
      for (let x = 0; x < g.W; x += s * (1.5 + rand() * 1.2)) {
        if (y < tops[Math.floor(x)] + s) continue;
        const k = 1 - f * 0.35;
        const dk = toHex([34 * k + 8, 56 * k + 10, 44 * k + 8]);
        const md = toHex([60 * k + 10, 88 * k + 12, 66 * k + 10]);
        fir(ctx, x + (rand() - 0.5) * s, y, s, dk, md);
      }
    }
    return c;
  }

  // ---- temple: gold double-eaved hall on the summit ---------------------------

  function paintTemple(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U * 1.5;
    const x = g.px;
    const y = Math.floor(state.tops[Math.floor(g.px)]) + u * 0.6;
    // stone terrace
    ctx.fillStyle = '#9a9588';
    ctx.fillRect(x - u * 9, y - u * 1.2, u * 18, u * 1.4);
    ctx.fillStyle = '#7b7769';
    ctx.fillRect(x - u * 9, y - u * 0.2, u * 18, u * 0.5);
    // red walls
    ctx.fillStyle = '#9c3a2a';
    ctx.fillRect(x - u * 5.2, y - u * 4.6, u * 10.4, u * 3.4);
    ctx.fillStyle = '#5a2a22';
    for (let i = -2; i <= 2; i++) ctx.fillRect(x + i * u * 2 - u * 0.25, y - u * 4.6, u * 0.5, u * 3.4);
    // lower eave
    ctx.fillStyle = '#c9a24a';
    poly(ctx, [x - u * 9.5, y - u * 3.7, x - u * 6, y - u * 6.2, x + u * 6, y - u * 6.2, x + u * 9.5, y - u * 3.7,
      x + u * 6.5, y - u * 4.9, x - u * 6.5, y - u * 4.9]);
    // upper walls
    ctx.fillStyle = '#9c3a2a';
    ctx.fillRect(x - u * 3.4, y - u * 8.6, u * 6.8, u * 2.5);
    // upper roof
    ctx.fillStyle = '#d8b457';
    poly(ctx, [x - u * 7, y - u * 7, x - u * 3.6, y - u * 10, x + u * 3.6, y - u * 10, x + u * 7, y - u * 7,
      x + u * 4.2, y - u * 8.2, x - u * 4.2, y - u * 8.2]);
    ctx.fillStyle = '#e8cd78';
    poly(ctx, [x - u * 3.6, y - u * 10, x, y - u * 12.4, x + u * 3.6, y - u * 10]);
    ctx.fillStyle = '#b08a38';
    ctx.fillRect(x - u * 0.2, y - u * 13.6, u * 0.4, u * 1.4);
    ctx.fillStyle = '#6b5a38';
    ctx.fillRect(x - u * 6.5, y - u * 4.9, u * 13, u * 0.3);
    return c;
  }

  // ---- clouds -----------------------------------------------------------------

  function paintSea(w, h, seed, bright, spread) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const hi = parseColor('#f2eddc');
    const lo = parseColor('#a9b0b6');
    const dens = (x, y) => fbm(x * 0.03, y * 0.2, 4, seed);
    for (let y = 0; y < h; y++) {
      const f = y / h;
      for (let x = 0; x < w; x++) {
        const v = lerp(dens(x, y), dens(x - w, y), x / w);
        const a = smoothstep(0.54, 0.64, v + f * spread * 1.4);
        const k = clamp(1 - f * 0.9 + (v - 0.5) * 0.5, 0, 1) * bright;
        const col = mixColor(lo, hi, k);
        const i = (y * w + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintMist(w, h, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const dens = (x, y) => fbm(x * 0.012, y * 0.09, 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(dens(x, y), dens(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 232;
        img.data[i + 1] = 230;
        img.data[i + 2] = 218;
        img.data[i + 3] = smoothstep(0.42, 0.7, v) * band * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- foreground pines ---------------------------------------------------------

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    function pine(x, y, s, dir) {
      ctx.strokeStyle = '#231f1a';
      ctx.lineWidth = Math.max(1, s * 0.45);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - dir * s * 1.4, y - s * 4, x + dir * s * 0.6, y - s * 7);
      ctx.stroke();
      ctx.fillStyle = '#1f3226';
      for (const [h, w, side] of [[2.4, 3.4, 1], [4, 3.6, -1], [5.6, 3, 1], [7, 2.4, -1]]) {
        const bx = x - dir * s * 0.5 + dir * s * h * 0.07;
        ctx.beginPath();
        ctx.ellipse(bx + side * dir * s * w * 0.5, y - s * h, s * w * 0.55, s * 0.6, 0, 0, TAU);
        ctx.fill();
      }
    }
    pine(g.W * 0.06, g.H * 1.02, u * 2.6, 1);
    pine(g.W * 0.15, g.H * 1.04, u * 1.8, 1);
    pine(g.W * 0.94, g.H * 1.02, u * 2.4, -1);
    ctx.fillStyle = '#1b2a22';
    for (let i = 0; i < 60; i++) ctx.fillRect(rand() * g.W, g.H - rand() * u * 3, 1 + rand() * 2, 1 + rand() * 2);
    return c;
  }

  // ---- run ---------------------------------------------------------------------

  function slide(ctx, c, speed, t, y, alpha, g) {
    const off = -(((t * speed * g.U) % c.width) + c.width) % c.width;
    ctx.globalAlpha = alpha;
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed || 7);
    state.g = g;
    state.tops = mainTops(g);
    state.sky = paintSky(g);
    state.halo = paintHalo(g);
    state.far = paintFar(g, 0.46, 0.12, 3, '#7488a0', 'rgba(228,220,196,0.4)');
    state.mid = paintFar(g, 0.56, 0.1, 8, '#546c78', 'rgba(220,214,190,0.3)');
    state.main = paintMain(g, state.tops, rand);
    state.temple = paintTemple(g);
    const w = Math.ceil(g.W * 1.5);
    state.seaBack = paintSea(w, Math.ceil(g.H * 0.4), 31, 0.85, 0.55);
    state.seaFront = paintSea(w, Math.ceil(g.H * 0.3), 47, 0.65, 0.5);
    state.mistA = paintMist(w, Math.ceil(g.H * 0.22), 59);
    state.mistB = paintMist(w, Math.ceil(g.H * 0.2), 73);
    state.front = paintFront(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { sea, halo, mist } = api.props;
    ctx.drawImage(state.sky, 0, 0);
    ctx.globalAlpha = clamp(halo, 0, 2) * 0.95 * (0.85 + 0.15 * Math.sin(t * 0.5));
    ctx.drawImage(state.halo, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.far, 0, 0);
    slide(ctx, state.mistA, -1.4, t, g.H * 0.3, 0.8 * Math.min(1, mist), g);
    ctx.drawImage(state.mid, 0, 0);
    ctx.drawImage(state.main, 0, 0);
    ctx.drawImage(state.temple, 0, 0);
    slide(ctx, state.mistB, 2.4, t, g.H * 0.3, 0.7 * Math.min(1, mist), g);
    slide(ctx, state.seaBack, 2.2, t, g.H * 0.64, 0.95 * Math.min(1, sea), g);
    slide(ctx, state.seaFront, 4, t, g.H * 0.8, 0.97 * Math.min(1, sea), g);
    ctx.drawImage(state.front, 0, 0);
  }

  Kasuri.run({
    defaults: { sea: 1, halo: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
