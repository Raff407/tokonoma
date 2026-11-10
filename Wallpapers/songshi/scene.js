/*
 * 松石 Songshi — an old pine growing out of a rock face above a cloud valley.
 *
 * Sky, far peaks, cliff and pine trunk are baked once. The needle pads are small
 * baked sprites that sway a pixel or two on their own phase; cloud sea and mist
 * are tiling strips that slide sideways.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep, clamp } = K;

  const state = {};
  const hex = toHex;
  const rgb = parseColor;

  // Peaks: centre x, top y (fractions), half width.
  const FAR = [
    { c: 0.52, t: 0.34, w: 0.07 }, { c: 0.64, t: 0.22, w: 0.05 }, { c: 0.74, t: 0.4, w: 0.09 },
    { c: 0.86, t: 0.28, w: 0.06 }, { c: 0.97, t: 0.38, w: 0.08 },
  ];
  const MID = [
    { c: 0.58, t: 0.5, w: 0.1 }, { c: 0.7, t: 0.44, w: 0.05 }, { c: 0.82, t: 0.52, w: 0.1 },
    { c: 0.94, t: 0.46, w: 0.06 },
  ];

  // Cliff edge as (y fraction, x fraction) pairs, top to bottom.
  const EDGE = [
    [0, 0.12], [0.14, 0.18], [0.3, 0.25], [0.4, 0.33], [0.455, 0.41], [0.485, 0.4],
    [0.52, 0.33], [0.64, 0.3], [0.8, 0.27], [1, 0.25],
  ];

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function edgeX(g, y) {
    const f = clamp(y / g.H, 0, 1);
    for (let i = 1; i < EDGE.length; i++) {
      if (f <= EDGE[i][0]) {
        const a = EDGE[i - 1];
        const b = EDGE[i];
        const t = (f - a[0]) / (b[0] - a[0] || 1);
        return g.W * lerp(a[1], b[1], t) + (fbm(y * 0.15, 2, 3, 9) - 0.5) * g.U * 3.5;
      }
    }
    return g.W * 0.25;
  }

  // ---- sky and peaks -----------------------------------------------------

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H);
    grad.addColorStop(0, '#d8d2bc');
    grad.addColorStop(0.55, '#ebe3cd');
    grad.addColorStop(1, '#e2d9c0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    const cx = g.W * 0.7;
    const cy = g.H * 0.2;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, g.U * 22);
    glow.addColorStop(0, 'rgba(240,215,160,0.55)');
    glow.addColorStop(1, 'rgba(240,215,160,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - g.U * 22, cy - g.U * 22, g.U * 44, g.U * 44);
    ctx.fillStyle = 'rgba(205,92,64,0.7)';
    ctx.beginPath();
    ctx.arc(cx, cy, g.U * 5.2, 0, 6.3);
    ctx.fill();
    return c;
  }

  function paintPeaks(g, peaks, seed, ink, topAlpha) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const tops = new Float32Array(g.W);
    for (let x = 0; x < g.W; x++) {
      let best = g.H * 1.1;
      for (const p of peaks) {
        const d = Math.abs(x / g.W - p.c) / p.w;
        if (d >= 1) continue;
        best = Math.min(best, lerp(g.H * 1.1, g.H * p.t, 1 - Math.pow(d, 2.2)));
      }
      tops[x] = best + (fbm(x * 0.12, 5, 3, seed) - 0.5) * g.U * 3;
    }
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x < g.W; x++) ctx.lineTo(x, tops[x]);
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, g.H * 0.2, 0, g.H * 0.85);
    grad.addColorStop(0, `rgba(${ink},${topAlpha})`);
    grad.addColorStop(1, `rgba(${ink},0.04)`);
    ctx.fillStyle = grad;
    ctx.fill();
    // Vertical wash streaks down the peaks.
    ctx.save();
    ctx.clip();
    const rand = K.rng(seed);
    ctx.strokeStyle = `rgba(${ink},0.22)`;
    ctx.lineWidth = 1;
    for (let i = 0; i < g.W * 0.5; i++) {
      const x = Math.floor(rand() * g.W);
      const y = tops[x] + rand() * g.U * 6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 2, y + g.U * (2 + rand() * 6));
      ctx.stroke();
    }
    ctx.restore();
    return c;
  }

  // ---- cliff -------------------------------------------------------------

  function paintCliff(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const dark = rgb('#23252c');
    const light = rgb('#5a5d63');
    const gold = rgb('#b99a5a');
    for (let y = 0; y < g.H; y++) {
      const ex = Math.floor(edgeX(g, y));
      for (let x = 0; x < ex; x++) {
        const depth = (ex - x) / (g.W * 0.2);
        const cun = fbm(x * 0.55, y * 0.05, 3, 21);
        const crack = fbm(x * 0.12, y * 0.2, 2, 33);
        let k = 0.2 + cun * 0.65 + crack * 0.25 - smoothstep(0, 1, depth) * 0.22;
        // Light from the right: the rim catches it.
        k += (1 - smoothstep(0, 3.2, ex - x)) * 0.32;
        k = clamp(k, 0, 1);
        const col = mixColor(dark, light, k);
        const rim = (1 - smoothstep(0, 1.8, ex - x)) * 0.35;
        const out = mixColor(col, gold, rim);
        const i = (y * g.W + x) * 4;
        img.data[i] = out[0];
        img.data[i + 1] = out[1];
        img.data[i + 2] = out[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // A few dark moss tufts clinging along the ledge and edge.
    const rand = K.rng(5);
    ctx.fillStyle = '#3c5a46';
    for (let i = 0; i < 46; i++) {
      const y = g.H * (0.1 + rand() * 0.55);
      const x = edgeX(g, y) - rand() * 2;
      ctx.fillRect(x - 1, y, 2 + rand() * 2, 1 + rand());
    }
    return c;
  }

  // ---- pine --------------------------------------------------------------

  function bez(p, t) {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const d = 3 * u * t * t;
    const e = t * t * t;
    return [a * p[0][0] + b * p[1][0] + d * p[2][0] + e * p[3][0], a * p[0][1] + b * p[1][1] + d * p[2][1] + e * p[3][1]];
  }

  function stroke(ctx, pts, w0, w1, col) {
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      ctx.lineWidth = lerp(w0, w1, i / (pts.length - 1));
      ctx.beginPath();
      ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
      ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
  }

  // One needle pad: a domed cloud of dark green with a flat underside and needle fringe.
  function makePad(w, h, seed) {
    const c = layer(w + 4, h + 4);
    const ctx = c.getContext('2d');
    const rand = K.rng(seed);
    const cx = (w + 4) / 2;
    const base = h * 0.78 + 2;
    ctx.fillStyle = '#2d4636';
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, base);
    ctx.bezierCurveTo(cx - w * 0.52, base - h * 0.9, cx + w * 0.52, base - h * 0.9, cx + w / 2, base);
    ctx.quadraticCurveTo(cx, base + h * 0.28, cx - w / 2, base);
    ctx.fill();
    ctx.fillStyle = '#4a6a4e';
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.08, base - h * 0.42, w * 0.3, h * 0.2, 0, 0, 6.3);
    ctx.fill();
    ctx.strokeStyle = '#1e3226';
    ctx.lineWidth = 1;
    for (let i = 0; i < w * 1.4; i++) {
      const a = Math.PI * (1 + rand());
      const r = w * (0.38 + rand() * 0.16);
      const px = cx + Math.cos(a) * r;
      const py = base + Math.sin(a) * r * (h / w) * 1.7;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(a) * 2.2, py + Math.sin(a) * 2.2 + 0.8);
      ctx.stroke();
    }
    return { c, ox: (w + 4) / 2, oy: base };
  }

  function paintPine(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const U = g.U;
    const W = g.W;
    const H = g.H;
    const bark = '#1b1816';
    const trunk = [[W * 0.31, H * 0.5], [W * 0.27, H * 0.3], [W * 0.4, H * 0.3], [W * 0.46, H * 0.12]];
    const pts = [];
    for (let i = 0; i <= 24; i++) pts.push(bez(trunk, i / 24));
    stroke(ctx, pts, U * 4.6, U * 1.4, bark);
    // lighter bark scales on the lit side
    ctx.fillStyle = '#6a5a46';
    const rand = K.rng(3);
    for (let i = 0; i < 40; i++) {
      const p = pts[Math.floor(rand() * 20)];
      ctx.fillRect(p[0] + U * 0.9, p[1], 1, 1 + rand());
    }
    const pads = [];
    const branches = [
      { t: 0.42, dx: 0.27, dy: -0.02, rise: -0.1, size: 1.0 },
      { t: 0.58, dx: -0.14, dy: -0.07, rise: -0.06, size: 0.8 },
      { t: 0.74, dx: 0.24, dy: -0.12, rise: -0.1, size: 0.95 },
      { t: 0.9, dx: -0.04, dy: -0.07, rise: -0.04, size: 0.7 },
      { t: 0.22, dx: 0.12, dy: 0.05, rise: -0.02, size: 0.75 },
    ];
    let n = 0;
    for (const b of branches) {
      const s = bez(trunk, b.t);
      const ex = s[0] + W * b.dx;
      const ey = s[1] + H * b.dy;
      const bp = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        bp.push([lerp(s[0], ex, t), lerp(s[1], ey, t) + Math.sin(t * Math.PI) * H * b.rise]);
      }
      stroke(ctx, bp, U * 1.8, U * 0.7, bark);
      const sprite = makePad(U * 22 * b.size, U * 10 * b.size, 40 + n++);
      pads.push({ s: sprite, x: ex, y: ey + U * 1.2, ph: n * 1.7 });
      const mid = bp[6];
      const small = makePad(U * 15 * b.size, U * 7 * b.size, 70 + n);
      pads.push({ s: small, x: mid[0], y: mid[1] + U * 0.6, ph: n * 2.3 });
    }
    const top = makePad(U * 24, U * 11, 99);
    pads.push({ s: top, x: trunk[3][0], y: trunk[3][1] + U * 2, ph: 0.5 });
    state.pads = pads;
    return c;
  }

  // ---- clouds ------------------------------------------------------------

  function paintSea(w, h, seed, bright, spread) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const hi = rgb('#f4eedd');
    const lo = rgb('#a9b0b6');
    const dens = (x, y) => fbm(x * 0.03, y * 0.2, 4, seed);
    for (let y = 0; y < h; y++) {
      const f = y / h;
      for (let x = 0; x < w; x++) {
        const v = lerp(dens(x, y), dens(x - w, y), x / w);
        const a = smoothstep(0.56, 0.66, v + f * spread * 1.4);
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
    const col = rgb('#efe9d8');
    const dens = (x, y) => fbm(x * 0.012, y * 0.09, 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(dens(x, y), dens(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = smoothstep(0.45, 0.72, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function slide(ctx, c, speed, t, y, alpha, g) {
    const off = -(((t * speed * g.U) % c.width) + c.width) % c.width;
    ctx.globalAlpha = alpha;
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    ctx.globalAlpha = 1;
  }

  // ---- run ---------------------------------------------------------------

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.sky = paintSky(g);
    state.far = paintPeaks(g, FAR, 7, '86,98,118', 0.7);
    state.mid = paintPeaks(g, MID, 13, '62,74,96', 0.8);
    state.cliff = paintCliff(g);
    state.pine = paintPine(g);
    const w = Math.ceil(g.W * 1.5);
    state.seaBack = paintSea(w, Math.ceil(g.H * 0.42), 31, 0.95, 0.55);
    state.seaFront = paintSea(w, Math.ceil(g.H * 0.3), 47, 0.85, 0.5);
    state.mistA = paintMist(w, Math.ceil(g.H * 0.2), 59);
    state.mistB = paintMist(w, Math.ceil(g.H * 0.18), 73);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const p = api.props;
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.far, 0, 0);
    slide(ctx, state.mistA, -1.4, t, g.H * 0.3, 0.7 * p.mist, g);
    ctx.drawImage(state.mid, 0, 0);
    slide(ctx, state.seaBack, 2, t, g.H * 0.55, 0.95 * Math.min(1, p.clouds), g);
    ctx.drawImage(state.cliff, 0, 0);
    ctx.drawImage(state.pine, 0, 0);
    const amp = g.U * 0.9 * p.wind;
    const gust = 0.6 + 0.4 * Math.sin(t * 0.37);
    const pads = state.pads;
    for (let i = 0; i < pads.length; i++) {
      const d = pads[i];
      const sway = Math.sin(t * 1.3 + d.ph) * amp * gust;
      const lift = Math.sin(t * 0.9 + d.ph * 1.3) * amp * 0.35;
      ctx.drawImage(d.s.c, Math.round(d.x - d.s.ox + sway), Math.round(d.y - d.s.oy + lift));
    }
    slide(ctx, state.mistB, 3, t, g.H * 0.4, 0.6 * p.mist, g);
    slide(ctx, state.seaFront, 3.8, t, g.H * 0.72, 0.97 * Math.min(1, p.clouds), g);
  }

  Kasuri.run({
    defaults: { wind: 1, clouds: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
