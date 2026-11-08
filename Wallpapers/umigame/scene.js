/*
 * 海亀 Umigame — a large sea turtle rowing through clear turquoise shallows.
 *
 * The sea bed, coral, shell and head are baked once and only slide or turn.
 * Flippers are short ribbons rebuilt from reused typed arrays, and the drifting
 * caustic light is one seamless tile drawn three times over itself.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const SEA = ['#2a8296', '#2f8f9f', '#37a0a8', '#44aeae', '#58bab2', '#6ec4b6',
    '#84cdba', '#98d4bd', '#aadac0', '#bcdfc4', '#cbe4ca', '#d8e8d0'].map(K.parseColor);
  const PLATES = [
    { core: '#d8a858', edge: '#6e4a26' },
    { core: '#c28c44', edge: '#5f4023' },
    { core: '#e2b768', edge: '#7a5229' },
    { core: '#b47f3e', edge: '#5a3e24' },
    { core: '#cf9e50', edge: '#684627' },
  ];
  const SKIN = ['#7d7148', '#665c38', '#a89c66'];
  const SHADOW = '#14586b';
  const LIGHT = '#f4fbe6';
  const SCHOOLS = [
    { body: '#2f4a78', fin: '#c9a24f', y: 0.2, rate: 0.5 },
    { body: '#c0563a', fin: '#efe7d0', y: 0.76, rate: 0.75 },
    { body: '#d9b24e', fin: '#c0563a', y: 0.13, rate: 0.62 },
    { body: '#3b5f8c', fin: '#efe7d0', y: 0.7, rate: 0.42 },
  ];
  const SEGS = 9;
  const TAU = Math.PI * 2;
  const MAX_FISH = 16;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, 6.3);
    ctx.fill();
  }

  // Runs paint(x) again one tile over when a mark at x reaches past either edge.
  function wrapped(w, x, reach, paint) {
    paint(x);
    if (x + reach > w) paint(x - w);
    if (x - reach < 0) paint(x + w);
  }

  function wrap(v, period) {
    return ((v % period) + period) % period;
  }

  /* ---- sea bed ---- */
  // Flat woodblock tones: depth from top to bottom, broad patches, wavy ripples.
  function paintSand(g) {
    const w = Math.ceil(g.W * 1.5);
    const c = layer(w, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, g.H);
    const f1 = 1 / (g.U * 30);
    const f2 = 1 / (g.U * 22);
    const waves = Math.max(2, Math.round(w / (g.U * 15)));
    const patch = (x, y) => fbm(x * f1, y * f1 * 1.5, 3, 11);
    const warp = (x, y) => fbm(x * f2, y * f2, 2, 31);
    const lastTone = SEA.length - 1;
    for (let y = 0; y < g.H; y++) {
      const d = y / g.H;
      const base = lerp(0.2, 0.8, Math.pow(d, 0.85));
      const yp = y * 1.3 - (0.3 * y * y) / g.H;
      for (let x = 0; x < w; x++) {
        const mix = x / w;
        const p = lerp(patch(x, y), patch(x - w, y), mix);
        const q = lerp(warp(x, y), warp(x - w, y), mix);
        const phase = (6.283 * waves * x) / w + (yp * 6.283) / (g.U * 7) + q * 11;
        const crest = Math.pow(0.5 + 0.5 * Math.sin(phase), 5);
        const lee = Math.pow(0.5 + 0.5 * Math.sin(phase + 1.2), 5);
        const reach = smoothstep(0.08, 0.62, d) * (0.05 + p * 0.2);
        const v = base + (p - 0.5) * 0.26 + (crest - lee * 0.75) * reach;
        const tone = SEA[Math.max(0, Math.min(lastTone, Math.round(v * lastTone)))];
        const i = (y * w + x) * 4;
        img.data[i] = tone[0];
        img.data[i + 1] = tone[1];
        img.data[i + 2] = tone[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintDebris(ctx, g, w, rand) {
    const area = (w * g.H) / (g.U * g.U);
    const marks = ['#5aa3a6', '#7db4aa', '#eaf0d6', '#93b5a4'];
    for (let i = 0; i < area / 45; i++) {
      const y = rand() * g.H;
      const mw = g.U * (0.4 + rand() * 1.4);
      const mh = g.U * (0.3 + rand() * 0.5);
      ctx.globalAlpha = 0.25 + rand() * 0.45;
      ctx.fillStyle = marks[Math.floor(rand() * marks.length)];
      wrapped(w, rand() * w + mw / 2, mw / 2, (x) => ctx.fillRect(x - mw / 2, y, mw, mh));
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < area / 1100; i++) paintPebbles(ctx, g, w, rand() * w, g.H * (0.35 + rand() * 0.6), rand);
  }

  function paintPebbles(ctx, g, w, x, y, rand) {
    const n = 3 + Math.floor(rand() * 6);
    for (let i = 0; i < n; i++) {
      const px = x + (rand() - 0.5) * g.U * 11;
      const py = y + (rand() - 0.5) * g.U * 6;
      const r = g.U * (0.4 + rand() * rand() * 1.3);
      const tone = rand() < 0.5 ? '#a8b8a4' : '#8fa89c';
      const rot = rand() * 3;
      wrapped(w, px, r * 1.6, (cx) => {
        ctx.fillStyle = 'rgba(40,110,120,0.28)';
        blob(ctx, cx + r * 0.5, py + r * 0.6, r, r * 0.7);
        ctx.fillStyle = tone;
        blob(ctx, cx, py, r, r * 0.72, rot);
      });
    }
  }

  function paintStar(ctx, g, x, y, colour, rot) {
    const r = g.U * 3.4;
    ctx.fillStyle = colour;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = rot + (i * Math.PI) / 5;
      const d = i % 2 ? r * 0.34 : r;
      ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    ctx.fill();
  }

  /* ---- coral ---- */
  function colonyShadow(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(30,95,110,0.3)';
    blob(ctx, x + r * 0.3, y + r * 0.36, r, r * 0.86);
  }

  function traceLobes(ctx, x, y, r, lobes, wob) {
    ctx.beginPath();
    for (let a = 0; a < 6.3; a += 0.2) {
      const d = r * (0.88 + Math.sin(a * lobes + wob) * 0.08 + Math.sin(a * 3 + wob * 2) * 0.06);
      ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.86);
    }
    ctx.closePath();
  }

  function paintBrain(ctx, g, x, y, r, ink, rand) {
    colonyShadow(ctx, x, y, r);
    ctx.fillStyle = ink.base;
    traceLobes(ctx, x, y, r, 5, rand() * 6);
    ctx.fill();
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.strokeStyle = ink.dark;
    const n = Math.ceil(r / g.U) * 2;
    for (let i = 0; i < n; i++) {
      const a = rand() * 6.283;
      const d = Math.sqrt(rand()) * r * 0.74;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.86, r * (0.12 + rand() * 0.14), rand() * 6.3, rand() * 6.3);
      ctx.stroke();
    }
    ctx.fillStyle = ink.tip;
    ctx.globalAlpha = 0.45;
    blob(ctx, x - r * 0.3, y - r * 0.32, r * 0.38, r * 0.24, -0.6);
    ctx.globalAlpha = 1;
  }

  // Finger coral from above: a tight clump of blunt little stubs.
  function paintFingers(ctx, g, x, y, r, ink, rand) {
    colonyShadow(ctx, x, y, r * 0.9);
    const n = Math.ceil(r / g.U) * 7;
    for (let i = 0; i < n; i++) {
      const a = rand() * 6.283;
      const d = Math.sqrt(rand()) * r * 0.92;
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d * 0.84;
      const size = g.U * (0.55 + rand() * 0.55);
      ctx.fillStyle = ink.dark;
      blob(ctx, px + size * 0.4, py + size * 0.5, size, size);
      ctx.fillStyle = rand() < 0.3 ? ink.tip : ink.base;
      blob(ctx, px, py, size * 0.85, size * 0.85);
    }
  }

  function branch(ctx, x, y, a, len, width, depth, ink, rand) {
    const ex = x + Math.cos(a) * len;
    const ey = y + Math.sin(a) * len;
    ctx.strokeStyle = depth > 1 ? ink.base : ink.tip;
    ctx.lineWidth = Math.max(1, width);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    if (depth <= 0) return;
    const forks = rand() < 0.6 ? 2 : 3;
    for (let i = 0; i < forks; i++) {
      branch(ctx, ex, ey, a + (i - (forks - 1) / 2) * 0.62 + (rand() - 0.5) * 0.3, len * 0.72, width * 0.72, depth - 1, ink, rand);
    }
  }

  function paintBranching(ctx, g, x, y, r, ink, rand) {
    colonyShadow(ctx, x, y, r * 0.85);
    ctx.lineCap = 'round';
    const arms = 7 + Math.floor(rand() * 3);
    for (let i = 0; i < arms; i++) {
      const a = (i / arms) * 6.283 + rand() * 0.5;
      branch(ctx, x, y, a, r * 0.42, g.U * 1.25, 2, ink, rand);
    }
    ctx.fillStyle = ink.dark;
    blob(ctx, x, y, r * 0.16, r * 0.15);
  }

  const INKS = {
    vermilion: { base: '#bd5c42', dark: '#8a4232', tip: '#eab093' },
    gold: { base: '#cfaa55', dark: '#9a7c3e', tip: '#f0dea2' },
    moss: { base: '#8a9a5c', dark: '#5f7046', tip: '#c2cf92' },
    washi: { base: '#b9ad8e', dark: '#8e8b76', tip: '#ddd3b6' },
    indigo: { base: '#5c7098', dark: '#42547a', tip: '#a3b3cc' },
  };
  const BIG = [
    { paint: paintBrain, inks: [INKS.vermilion, INKS.gold, INKS.moss] },
    { paint: paintFingers, inks: [INKS.vermilion, INKS.gold] },
  ];
  const SMALL = [
    { paint: paintBranching, inks: [INKS.vermilion, INKS.washi, INKS.gold, INKS.moss] },
    { paint: paintFingers, inks: [INKS.gold, INKS.moss, INKS.vermilion] },
    { paint: paintBranching, inks: [INKS.indigo, INKS.vermilion, INKS.gold] },
  ];

  // Bumpy rock and rubble underneath, so the mound has no clean oval edge.
  function paintRubble(ctx, g, x, y, u, rand) {
    const tones = ['#7fa89e', '#8fb5a6', '#6d9a94'];
    for (let i = 0; i < 30; i++) {
      const a = rand() * 6.283;
      const d = Math.sqrt(rand());
      const r = u * (1.6 + rand() * 3.4);
      ctx.fillStyle = tones[i % 3];
      blob(ctx, x + Math.cos(a) * d * u * 23, y + Math.sin(a) * d * u * 11, r * 1.3, r, rand() * 3);
    }
  }

  // A loose mound: two big colonies with smaller ones tucked around them.
  function paintCluster(ctx, g, x, y, s, rand) {
    const u = g.U * s;
    paintRubble(ctx, g, x, y, u, rand);
    const placed = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 6.283 + rand() * 0.7;
      const big = i < 3;
      const d = big ? u * (4 + i * 2) : u * (10 + rand() * 10);
      const r = big ? u * (6.5 + rand() * 2) : u * (2.6 + rand() * 3);
      placed.push({ x: x + Math.cos(a) * d * 1.2, y: y + Math.sin(a) * d * 0.55, r, i });
    }
    placed.sort((a, b) => a.y - b.y);
    for (const p of placed) {
      const set = p.i < 3 ? BIG : SMALL;
      const kind = set[(p.i + Math.floor(rand() * 2)) % set.length];
      kind.paint(ctx, g, p.x, p.y, p.r, kind.inks[Math.floor(rand() * kind.inks.length)], rand);
    }
  }

  function paintBand(g, w, h, s, spacing, footY, tint, rand) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const n = Math.max(1, Math.floor(w / (g.U * spacing)));
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * w;
      const size = s * (i % 2 ? 0.78 : 1);
      const seed = Math.floor(rand() * 4294967296);
      const y = footY + (i % 2 ? g.U * 2 * s : 0);
      wrapped(w, x, g.U * s * 36, (cx) => paintCluster(ctx, g, cx, y, size, K.rng(seed)));
    }
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = tint.colour;
    ctx.globalAlpha = tint.alpha;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  function paintSeabed(g, rand) {
    const c = paintSand(g);
    const ctx = c.getContext('2d');
    paintDebris(ctx, g, c.width, rand);
    paintStar(ctx, g, c.width * 0.24, g.H * 0.76, '#c0563a', 0.4);
    paintStar(ctx, g, c.width * 0.71, g.H * 0.68, '#c9a24f', 1.2);
    const back = paintBand(g, c.width, g.H * 0.2, 0.6, 44, g.H * 0.05, { colour: '#3b9aa8', alpha: 0.3 }, rand);
    ctx.drawImage(back, 0, 0);
    return c;
  }

  /* ---- caustic light ---- */
  // A jittered cell network on a torus, so the tile has no seam in either axis.
  function paintCaustic(g, rand) {
    const size = Math.max(32, Math.ceil(g.U * 62));
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    const m = 8;
    const pts = new Float32Array(m * m * 2);
    for (let i = 0; i < m * m; i++) {
      pts[i * 2] = (((i % m) + 0.15 + rand() * 0.7) / m) * size;
      pts[i * 2 + 1] = ((Math.floor(i / m) + 0.15 + rand() * 0.7) / m) * size;
    }
    const cell = size / m;
    const [lr, lg, lb] = K.parseColor(LIGHT);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = causticAt(x, y, size, m, cell, pts);
        const i = (y * size + x) * 4;
        img.data[i] = lr;
        img.data[i + 1] = lg;
        img.data[i + 2] = lb;
        img.data[i + 3] = (Math.round(v * 4) / 4) * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { canvas: c, draw: size * 2 };
  }

  function causticAt(x, y, size, m, cell, pts) {
    const tau = 6.283 / size;
    const wx = x + Math.sin(y * tau * 2 + 1) * cell * 0.3 + Math.sin(y * tau * 5) * cell * 0.1;
    const wy = y + Math.sin(x * tau * 3 + 2) * cell * 0.3 + Math.sin(x * tau * 4) * cell * 0.1;
    const cx = Math.floor(wx / cell);
    const cy = Math.floor(wy / cell);
    let f1 = 1e9;
    let f2 = 1e9;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const gx = ((cx + i) % m + m) % m;
        const gy = ((cy + j) % m + m) % m;
        const k = (gy * m + gx) * 2;
        let dx = Math.abs(pts[k] - wx) % size;
        let dy = Math.abs(pts[k + 1] - wy) % size;
        if (dx > size / 2) dx = size - dx;
        if (dy > size / 2) dy = size - dy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
      }
    }
    const weight = 0.55 + 0.45 * Math.sin(x * tau * 2 + 0.5) * Math.sin(y * tau * 3 + 1);
    return (1 - smoothstep(0, cell * 0.34 * (0.6 + weight * 0.5), f2 - f1)) * (0.55 + weight * 0.45);
  }

  function drawCaustic(ctx, g, ox, oy, scale) {
    const tile = state.caustic;
    const w = tile.draw * scale;
    const h = w * 0.74;
    const x0 = -(((ox % w) + w) % w);
    const y0 = -(((oy % h) + h) % h);
    for (let y = y0; y < g.H; y += h) {
      for (let x = x0; x < g.W; x += w) ctx.drawImage(tile.canvas, x, y, w + 0.5, h + 0.5);
    }
  }

  /* ---- shell ---- */
  const WIDTHS = [0.6, 0.8, 0.95, 1, 0.98, 0.9, 0.76, 0.56, 0.3, 0.02];

  function shellWidth(s) {
    const f = Math.max(0, Math.min(0.9999, s)) * (WIDTHS.length - 1);
    const i = Math.floor(f);
    const m = f - i;
    return lerp(WIDTHS[i], WIDTHS[i + 1], m * m * (3 - 2 * m));
  }

  // s runs front to tail and r runs across the back, -1 to 1, so every scute follows the outline.
  function shellPoint(b, s, r) {
    const front = (1 - s) * (1 - s) * (1 - s) * r * r * b.length * 0.13;
    return [b.front - s * b.length - front, shellWidth(s) * b.half * r];
  }

  // slant pushes the outer edge of the patch toward the tail, as real seams run.
  function tracePatch(ctx, b, s0, s1, r0, r1, slant, steps) {
    const lean = slant || 0;
    const n = steps || 4;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const [x, y] = shellPoint(b, lerp(s0, s1, i / n), r0);
      ctx.lineTo(x, y);
    }
    for (let i = n; i >= 0; i--) {
      const [x, y] = shellPoint(b, Math.min(1, lerp(s0, s1, i / n) + lean), r1);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  // Tortoiseshell: a domed plate, amber in the middle, flecked with fine rays.
  function rayFill(ctx, b, ox, oy, reach, tone, rand) {
    const dome = ctx.createRadialGradient(ox, oy, 0, ox, oy, reach);
    dome.addColorStop(0, tone.core);
    dome.addColorStop(1, tone.edge);
    ctx.fillStyle = dome;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const n = 12;
    const start = rand() * 6.283;
    for (let i = 0; i < n; i++) {
      const a = start + (i / n) * 6.283 + rand() * 0.25;
      const pale = i % 2 === 0;
      ctx.strokeStyle = pale ? '#efcf86' : '#4a331e';
      ctx.globalAlpha = pale ? 0.55 : 0.5;
      ctx.lineWidth = b.u * (0.5 + rand() * 0.6);
      ctx.beginPath();
      ctx.moveTo(ox + Math.cos(a) * reach * 0.12, oy + Math.sin(a) * reach * 0.12);
      ctx.lineTo(ox + Math.cos(a) * reach, oy + Math.sin(a) * reach);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function seam(ctx, b, width) {
    ctx.strokeStyle = '#2a2014';
    ctx.lineWidth = b.u * width;
    ctx.stroke();
  }

  function paintMarginals(ctx, b) {
    const n = 12;
    for (const side of [-1, 1]) {
      for (let i = 0; i < n; i++) {
        tracePatch(ctx, b, i / n, (i + 1) / n, side * 0.8, side);
        ctx.fillStyle = i % 2 ? '#e0bc76' : '#c49a56';
        ctx.fill();
        seam(ctx, b, 0.45);
      }
    }
    tracePatch(ctx, b, 0, 0.012, -0.8, 0.8);
    seam(ctx, b, 0.5);
  }

  function paintScutes(ctx, b, rand) {
    const stops = [0.05, 0.25, 0.44, 0.62, 0.79, 0.95];
    const cuts = [0.02, 0.23, 0.46, 0.68, 0.9];
    for (const side of [-1, 1]) {
      for (let j = 0; j < cuts.length - 1; j++) {
        tracePatch(ctx, b, cuts[j], cuts[j + 1], side * 0.2, side * 0.8, 0.05);
        const [ox, oy] = shellPoint(b, (cuts[j] + cuts[j + 1]) / 2 + 0.02, side * 0.55);
        rayFill(ctx, b, ox, oy, b.half * 0.72, PLATES[(j * 2 + (side > 0 ? 1 : 0)) % PLATES.length], rand);
        seam(ctx, b, 1);
      }
    }
    for (let j = 0; j < stops.length - 1; j++) {
      const s0 = stops[j];
      const s1 = stops[j + 1];
      const mid = (s0 + s1) / 2;
      ctx.beginPath();
      const verts = [[s0, -0.19], [s0, 0.19], [mid, 0.33], [s1, 0.19], [s1, -0.19], [mid, -0.33]];
      for (const [vs, vr] of verts) {
        const [x, y] = shellPoint(b, vs, vr);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      const [ox, oy] = shellPoint(b, mid, 0);
      rayFill(ctx, b, ox, oy, b.half * 0.56, PLATES[(j + 3) % PLATES.length], rand);
      seam(ctx, b, 1);
    }
  }

  function paintDome(ctx, b) {
    const glow = ctx.createRadialGradient(b.front - b.length * 0.35, -b.half * 0.32, 0, b.front - b.length * 0.4, 0, b.length * 0.7);
    glow.addColorStop(0, 'rgba(250,226,160,0.3)');
    glow.addColorStop(0.5, 'rgba(250,226,160,0)');
    glow.addColorStop(0.72, 'rgba(30,24,20,0)');
    glow.addColorStop(1, 'rgba(30,24,20,0.16)');
    ctx.fillStyle = glow;
    ctx.fillRect(-b.length, -b.half * 1.2, b.length * 2, b.half * 2.4);
  }

  function paintShell(b, rand) {
    const size = b.length * 1.3 * b.res;
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    ctx.translate(size / 2, size / 2);
    ctx.scale(b.res, b.res);
    tracePatch(ctx, b, 0, 1, 1, -1, 0, 40);
    ctx.fillStyle = '#6e4a26';
    ctx.fill();
    ctx.save();
    ctx.clip();
    paintMarginals(ctx, b);
    paintScutes(ctx, b, rand);
    paintDome(ctx, b);
    ctx.restore();
    tracePatch(ctx, b, 0, 1, 1, -1, 0, 40);
    ctx.strokeStyle = '#33291c';
    ctx.lineWidth = b.u * 0.8;
    ctx.stroke();
    return c;
  }

  // Low resolution on purpose: scaling it back up is what softens the edge.
  function paintShellShadow(b) {
    const res = 0.28;
    const size = b.length * 1.3 * res;
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    ctx.translate(size / 2, size / 2);
    ctx.scale(res, res);
    ctx.fillStyle = SHADOW;
    tracePatch(ctx, b, 0, 1, 1, -1, 0, 40);
    ctx.fill();
    blob(ctx, b.front + b.u * 3, 0, b.u * 10, b.u * 4.8);
    return c;
  }

  /* ---- head ---- */
  function traceHead(ctx, u) {
    ctx.beginPath();
    ctx.moveTo(-u * 6, -u * 5.2);
    ctx.bezierCurveTo(u * 1, -u * 5.4, u * 3, -u * 6.2, u * 7, -u * 5.2);
    ctx.bezierCurveTo(u * 10.5, -u * 4.2, u * 13, -u * 2.2, u * 14.2, 0);
    ctx.bezierCurveTo(u * 13, u * 2.2, u * 10.5, u * 4.2, u * 7, u * 5.2);
    ctx.bezierCurveTo(u * 3, u * 6.2, u * 1, u * 5.4, -u * 6, u * 5.2);
    ctx.closePath();
  }

  function plate(ctx, u, pts) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i] * u, pts[i + 1] * u);
    ctx.closePath();
    ctx.fill();
  }

  function paintHead(b) {
    const size = b.u * 30 * b.res;
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const u = b.u;
    ctx.translate(size / 2, size / 2);
    ctx.scale(b.res, b.res);
    traceHead(ctx, u);
    ctx.fillStyle = '#c9b67c';
    ctx.fill();
    ctx.fillStyle = '#7d6a3c';
    plate(ctx, u, [2.6, -1.6, 7.6, -1.7, 9.4, 0, 7.6, 1.7, 2.6, 1.6]);
    plate(ctx, u, [-5, -4.4, 2, -4.6, 2, -2.1, -5, -1.2]);
    plate(ctx, u, [-5, 4.4, 2, 4.6, 2, 2.1, -5, 1.2]);
    plate(ctx, u, [-5, -0.7, 2, -1.3, 2, 1.3, -5, 0.7]);
    plate(ctx, u, [2.8, -5, 6.6, -4.7, 6.2, -3.5, 3, -2.4]);
    plate(ctx, u, [2.8, 5, 6.6, 4.7, 6.2, 3.5, 3, 2.4]);
    plate(ctx, u, [8.6, -3.4, 10.4, -2.7, 9.8, -1.1, 8.2, -1.7]);
    plate(ctx, u, [8.6, 3.4, 10.4, 2.7, 9.8, 1.1, 8.2, 1.7]);
    ctx.fillStyle = '#3f3620';
    plate(ctx, u, [10.5, -1.7, 14.2, 0, 10.5, 1.7, 10.2, 0]);
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#efe7c8';
      blob(ctx, u * 7.4, side * u * 4.2, u * 1.75, u * 1.45);
      ctx.fillStyle = '#20201c';
      blob(ctx, u * 7.7, side * u * 4.25, u * 1.15, u * 1.05);
    }
    traceHead(ctx, u);
    ctx.strokeStyle = '#3b3220';
    ctx.lineWidth = u * 0.6;
    ctx.stroke();
    return c;
  }

  /* ---- flippers ---- */
  function makeFlipper(g, side, opts) {
    const n = SEGS + 1;
    const profile = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const f = i / SEGS;
      const rise = f < 0.2 ? lerp(0.6, 1, f / 0.2) : Math.pow(Math.max(0, 1 - Math.pow((f - 0.2) / 0.8, 2.2)), 0.8);
      profile[i] = rise * opts.width * g.U;
    }
    return Object.assign({
      side,
      profile,
      ox: opts.x * g.U,
      oy: side * opts.y * g.U,
      step: (opts.len * g.U) / SEGS,
      lx: new Float32Array(n), ly: new Float32Array(n),
      tx: new Float32Array(n), ty: new Float32Array(n),
      cx: new Float32Array(n), cy: new Float32Array(n),
    }, opts);
  }

  // Angle 0 points straight out from the body; positive swings it toward the nose.
  function shapeFlipper(fl, ph) {
    const phase = ph + fl.off;
    const feather = lerp(fl.thin, 1, 0.5 - 0.5 * Math.cos(phase));
    let x = fl.ox;
    let y = fl.oy;
    for (let i = 0; i <= SEGS; i++) {
      const f = i / SEGS;
      const a = fl.a0 + fl.a1 * Math.sin(phase - fl.lag * f) + fl.sweep * f;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const hw = fl.profile[i] * feather;
      fl.cx[i] = x;
      fl.cy[i] = y;
      fl.lx[i] = x + ca * hw * 0.42;
      fl.ly[i] = y - fl.side * sa * hw * 0.42;
      fl.tx[i] = x - ca * hw;
      fl.ty[i] = y + fl.side * sa * hw;
      x += sa * fl.step;
      y += fl.side * ca * fl.step;
    }
  }

  function traceFlipper(ctx, fl) {
    ctx.beginPath();
    ctx.moveTo(fl.lx[0], fl.ly[0]);
    for (let i = 1; i <= SEGS; i++) ctx.lineTo(fl.lx[i], fl.ly[i]);
    for (let i = SEGS; i >= 0; i--) ctx.lineTo(fl.tx[i], fl.ty[i]);
    ctx.closePath();
  }

  function scale(ctx, fl, i, ax, ay, bx, by, a, b) {
    const j = i + 1;
    ctx.beginPath();
    ctx.moveTo(lerp(fl.cx[i], ax[i], a), lerp(fl.cy[i], ay[i], a));
    ctx.lineTo(lerp(fl.cx[j], bx[j], a), lerp(fl.cy[j], by[j], a));
    ctx.lineTo(lerp(fl.cx[j], bx[j], b), lerp(fl.cy[j], by[j], b));
    ctx.lineTo(lerp(fl.cx[i], ax[i], b), lerp(fl.cy[i], ay[i], b));
    ctx.fill();
  }

  function drawFlipper(ctx, g, fl) {
    traceFlipper(ctx, fl);
    ctx.fillStyle = '#3f3a24';
    ctx.fill();
    for (let i = 0; i < SEGS - 1; i++) {
      ctx.fillStyle = SKIN[i % 3];
      scale(ctx, fl, i, fl.lx, fl.ly, fl.lx, fl.ly, 0.1, 0.85);
      ctx.fillStyle = SKIN[(i + 1) % 3];
      scale(ctx, fl, i, fl.tx, fl.ty, fl.tx, fl.ty, 0.08, 0.46);
      ctx.fillStyle = SKIN[(i + 2) % 3];
      scale(ctx, fl, i, fl.tx, fl.ty, fl.tx, fl.ty, 0.54, 0.9);
    }
    ctx.strokeStyle = '#d9cc9a';
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.beginPath();
    ctx.moveTo(fl.tx[1], fl.ty[1]);
    for (let i = 2; i <= SEGS; i++) ctx.lineTo(fl.tx[i], fl.ty[i]);
    ctx.stroke();
  }

  /* ---- fish ---- */
  // Wide enough that the outermost fish, its wobble and its shadow are all off screen when the school wraps.
  function makeSchools(g, rand) {
    const margin = (g.U * (34 + 2 * MAX_FISH)) / 2 + g.U * 14;
    const span = g.W + 2 * margin;
    const list = SCHOOLS.map((s, i) => ({
      ink: s,
      y: s.y * g.H,
      rate: s.rate * g.U,
      start: ((i * 0.27 + 0.1) % 1) * span,
      fish: Array.from({ length: MAX_FISH }, (_, n) => ({
        dx: (rand() - 0.5) * g.U * (34 + n * 2),
        dy: (rand() - 0.5) * g.U * (9 + n * 0.6),
        size: g.U * (2.8 + rand() * rand() * 2.6),
        phase: rand() * 6.28,
        wag: 5 + rand() * 3,
      })),
    }));
    state.span = span;
    state.margin = margin;
    return list;
  }

  function drawFish(ctx, f, x, y, a, t, ink) {
    const l = f.size;
    const wag = Math.sin(t * f.wag + f.phase) * l * 0.32;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = ink.fin;
    ctx.beginPath();
    ctx.moveTo(-l * 0.7, 0);
    ctx.lineTo(-l * 1.3, wag - l * 0.34);
    ctx.lineTo(-l * 1.3, wag + l * 0.34);
    ctx.fill();
    ctx.fillStyle = ink.body;
    ctx.beginPath();
    ctx.moveTo(l, 0);
    ctx.quadraticCurveTo(0, -l * 0.5, -l * 0.8, wag * 0.3);
    ctx.quadraticCurveTo(0, l * 0.5, l, 0);
    ctx.fill();
    ctx.restore();
  }

  function drawSchools(ctx, g, t, count) {
    for (const school of state.schools) {
      const span = state.span;
      const sx = span - ((school.start + t * school.rate) % span) - state.margin;
      for (let i = 0; i < count; i++) {
        const f = school.fish[i];
        const x = sx + f.dx + Math.sin(t * 0.31 + f.phase) * g.U * 2.6;
        const y = school.y + f.dy + Math.sin(t * 0.23 + f.phase * 2) * g.U * 1.7;
        const a = Math.sin(t * 0.27 + f.phase) * 0.28;
        ctx.fillStyle = 'rgba(20,85,105,0.32)';
        ctx.fillRect(x + g.U * 2.2, y + g.U * 2.6, f.size * 1.5, f.size * 0.4);
        drawFish(ctx, f, x, y, a, t, school.ink);
      }
    }
  }

  /* ---- turtle ---- */
  function makeTurtle(g, rand) {
    const body = { u: g.U, res: 2, length: g.U * 44, half: g.U * 17.5, front: g.U * 19 };
    const fore = { x: 11, y: 11, len: 35, width: 7, a0: 0.28, a1: 0.82, lag: 0.95, sweep: -0.85, off: 0, thin: 0.52 };
    const rear = { x: -19, y: 5, len: 14, width: 4.8, a0: -1.0, a1: 0.26, lag: 0.7, sweep: -0.15, off: 2.4, thin: 0.72 };
    return {
      body,
      shell: paintShell(body, rand),
      shadow: paintShellShadow(body),
      head: paintHead(body),
      flippers: [
        makeFlipper(g, -1, rear), makeFlipper(g, 1, rear),
        makeFlipper(g, -1, fore), makeFlipper(g, 1, fore),
      ],
    };
  }

  function drawSprite(ctx, sprite, size) {
    ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
  }

  function drawTurtleShadow(ctx, g, x, y, a) {
    const T = state.turtle;
    ctx.save();
    ctx.translate(x + g.U * 8, y + g.U * 10);
    ctx.rotate(a);
    ctx.scale(0.94, 0.94);
    ctx.globalAlpha = 0.5;
    drawSprite(ctx, T.shadow, T.body.length * 1.3);
    ctx.fillStyle = SHADOW;
    ctx.globalAlpha = 0.3;
    for (let pass = 0; pass < 2; pass++) {
      for (const fl of T.flippers) {
        traceFlipper(ctx, fl);
        ctx.fill();
      }
      ctx.translate(g.U * 0.9, g.U * 0.7);
    }
    ctx.restore();
  }

  function drawTurtle(ctx, g, x, y, a, ph, t) {
    const T = state.turtle;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    for (const fl of T.flippers) drawFlipper(ctx, g, fl);
    ctx.save();
    ctx.translate(T.body.front - g.U * 1.5, 0);
    ctx.rotate(Math.sin(t * 0.19) * 0.1 + Math.sin(ph) * 0.03);
    drawSprite(ctx, T.head, g.U * 30);
    ctx.restore();
    drawSprite(ctx, T.shell, T.body.length * 1.3);
    ctx.restore();
  }

  /* ---- frame ---- */
  function slide(ctx, tile, x, y) {
    const w = tile.width;
    const ox = -(x % w);
    ctx.drawImage(tile, ox, y);
    ctx.drawImage(tile, ox + w, y);
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.seabed = paintSeabed(g, rand);
    state.reefH = Math.ceil(g.U * 34);
    state.reef = paintBand(g, Math.ceil(g.W * 1.6), state.reefH, 1, 58, state.reefH - g.U * 7, { colour: '#a6d8c6', alpha: 0.1 }, rand);
    state.caustic = paintCaustic(g, rand);
    state.turtle = makeTurtle(g, rand);
    state.schools = makeSchools(g, rand);
    state.ph = 0;
    state.sea = 0;
    state.reefX = 0;
    state.glints = [0, 0, 0];
  }

  // Each layer keeps its own offset, wrapped to its own tile, so the pace slider
  // only changes how fast things move from here on and nothing jumps.
  const GLINTS = [
    { scale: 1, carry: 1, run: 1.3 },
    { scale: 0.83, carry: 1, run: -1.7 },
    { scale: 1.25, carry: 0.7, run: 2 },
  ];

  function advance(g, dt, pace) {
    const move = dt * g.U * 2.2 * pace;
    state.ph = wrap(state.ph + (dt * TAU * pace) / 7.5, TAU);
    state.sea = wrap(state.sea + move, state.seabed.width);
    state.reefX = wrap(state.reefX + move * 1.25, state.reef.width);
    for (let i = 0; i < GLINTS.length; i++) {
      const gl = GLINTS[i];
      state.glints[i] = wrap(state.glints[i] + move * gl.carry + dt * g.U * gl.run, state.caustic.draw * gl.scale);
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { light, pace, fish } = api.props;
    advance(g, dt, pace);
    const ph = state.ph;
    const gx = state.glints;
    slide(ctx, state.seabed, state.sea, 0);
    slide(ctx, state.reef, state.reefX, g.H - state.reefH);
    ctx.globalAlpha = (0.34 + 0.08 * Math.sin(t * 0.37)) * light;
    drawCaustic(ctx, g, gx[0], t * g.U * 0.8, GLINTS[0].scale);
    ctx.globalAlpha = (0.3 + 0.08 * Math.sin(t * 0.29 + 2)) * light;
    drawCaustic(ctx, g, gx[1], -t * g.U * 1.1 + g.U * 31, GLINTS[1].scale);
    ctx.globalAlpha = 1;
    const x = g.W * 0.47 + Math.sin(t * 0.07) * g.U * 7 + Math.sin(ph) * g.U * 0.9;
    const y = g.H * 0.49 + Math.sin(t * 0.11 + 1) * g.U * 2.6;
    const a = -0.17 + Math.sin(t * 0.09) * 0.05 + Math.cos(ph) * 0.012;
    for (const fl of state.turtle.flippers) shapeFlipper(fl, ph);
    drawTurtleShadow(ctx, g, x, y, a);
    drawSchools(ctx, g, t, Math.min(MAX_FISH, Math.round(8 * fish)));
    drawTurtle(ctx, g, x, y, a, ph, t);
    ctx.globalAlpha = 0.13 * light;
    drawCaustic(ctx, g, gx[2], t * g.U * 1.4 + g.U * 17, GLINTS[2].scale);
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { light: 1, pace: 1, fish: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.06, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
