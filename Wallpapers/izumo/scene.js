/*
 * 出雲 Izumo — a huge braided shimenawa rope across a shrine hall entrance, under pines.
 *
 * Sky, hall, pines, rope strips, paper streamers and straw tufts are all baked once.
 * Each frame lifts the rope in thin strips as a slow wave, swings the hanging pieces
 * from their ties, leans the pines a hair and slides two mist bands past.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;
  const TAU = Math.PI * 2;
  const STRIPS = 28;
  const MOTES = 18;
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
    const U = H / 100;
    const u = U * Math.min(1, W / (U * 150));
    const hw = Math.min(W * 0.66, U * 120);
    const cx = W * 0.5;
    return { W, H, U, u, hw, cx, xl: cx - hw / 2, xr: cx + hw / 2, beam: H * 0.34, floor: H * 0.78 };
  }

  // ---- sky, ridge, path ------------------------------------------------------

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const stops = ['#b9c6c9', '#cfd6cd', '#e3dfc9', '#efe3c2'].map(K.parseColor);
    const img = ctx.createImageData(g.W, g.H);
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / (g.H * 0.6)) * (stops.length - 1);
      const k = Math.min(stops.length - 2, Math.floor(f));
      for (let x = 0; x < g.W; x++) {
        const s = stops[k + (rand() < f - k ? 1 : 0)];
        const i = (y * g.W + x) * 4;
        img.data[i] = s[0];
        img.data[i + 1] = s[1];
        img.data[i + 2] = s[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // two misty ridges
    const ridges = [['#9aa9ae', 0.5, 0.1, 5], ['#7c8f94', 0.58, 0.08, 9]];
    for (const [col, base, amp, seed] of ridges) {
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.85;
      for (let x = 0; x < g.W; x++) {
        const y = g.H * base - fbm(x / (g.U * 38), 2.1, 4, seed) * g.H * amp;
        ctx.fillRect(x, y, 1, g.floor - y);
      }
    }
    ctx.globalAlpha = 1;
    // path of gravel leading away
    ctx.fillStyle = '#c4bda8';
    ctx.fillRect(0, g.floor, g.W, g.H - g.floor);
    ctx.fillStyle = '#d8d1ba';
    for (let i = 0; i < g.W * g.H * 0.012; i++) ctx.fillRect(rand() * g.W, g.floor + rand() * (g.H - g.floor), 1, 1);
    return c;
  }

  // ---- hall ------------------------------------------------------------------

  function paintRoof(ctx, g, rand) {
    const half = g.hw * 0.62;
    const bottom = g.beam - g.u * 6;
    ctx.fillStyle = '#3b3128';
    ctx.fillRect(g.cx - half, 0, half * 2, bottom);
    for (let y = 0; y < bottom; y += Math.max(2, g.u * 1.7)) {
      ctx.fillStyle = y % 2 ? '#473b30' : '#2f2720';
      ctx.fillRect(g.cx - half, y, half * 2, Math.max(1, g.u * 0.5));
    }
    for (let i = 0; i < g.W * g.H * 0.004; i++) {
      ctx.fillStyle = rand() < 0.5 ? '#574837' : '#241e19';
      ctx.fillRect(g.cx - half + rand() * half * 2, rand() * bottom, 2, 1);
    }
    // eave edge, lifted a little at the ends
    ctx.fillStyle = '#1f1914';
    ctx.fillRect(g.cx - half, bottom - g.u * 1.6, half * 2, g.u * 1.6);
    ctx.fillStyle = '#e4dcc4';
    ctx.fillRect(g.cx - half, bottom, half * 2, Math.max(1, g.u * 0.9));
    // gold fittings along the edge
    ctx.fillStyle = '#c9a24a';
    for (let x = g.cx - half + g.u * 3; x < g.cx + half; x += g.u * 7) blob(ctx, x, bottom + g.u * 0.45, g.u * 0.7, g.u * 0.7);
    // shadow under eave
    ctx.fillStyle = '#2a211b';
    ctx.fillRect(g.cx - half, bottom + g.u * 0.9, half * 2, g.beam - bottom - g.u * 0.9);
  }

  function paintHall(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintRoof(ctx, g, rand);
    // dark interior
    const ix = g.xl - g.u * 1;
    const iw = g.hw + g.u * 2;
    ctx.fillStyle = '#1c1714';
    ctx.fillRect(ix, g.beam, iw, g.floor - g.beam);
    ctx.fillStyle = '#2b221b';
    ctx.fillRect(ix, g.beam, iw, g.u * 2);
    // lintel beam
    ctx.fillStyle = '#4a3626';
    ctx.fillRect(g.xl - g.u * 5, g.beam - g.u * 3, g.hw + g.u * 10, g.u * 4.5);
    ctx.fillStyle = '#6a4e36';
    ctx.fillRect(g.xl - g.u * 5, g.beam - g.u * 3, g.hw + g.u * 10, Math.max(1, g.u * 0.8));
    // lantern glow deep inside
    ctx.fillStyle = '#6b5424';
    blob(ctx, g.cx, g.beam + g.u * 14, g.u * 4, g.u * 2.5);
    ctx.fillStyle = '#d7b252';
    blob(ctx, g.cx, g.beam + g.u * 14, g.u * 2.2, g.u * 1.4);
    ctx.fillStyle = '#d6bd7a';
    ctx.fillRect(g.cx - 0.5, g.beam + g.u * 2, 1, g.u * 10);
    // offering box, slatted
    const bw = g.u * 22;
    const by = g.floor - g.u * 10;
    ctx.fillStyle = '#6f5238';
    ctx.fillRect(g.cx - bw / 2, by, bw, g.u * 10);
    ctx.fillStyle = '#3a2a1e';
    for (let x = g.cx - bw / 2 + g.u * 1.5; x < g.cx + bw / 2 - g.u; x += g.u * 2.2) ctx.fillRect(x, by + g.u * 1.2, Math.max(1, g.u * 0.8), g.u * 5);
    ctx.fillStyle = '#8c6c4a';
    ctx.fillRect(g.cx - bw / 2 - g.u, by - g.u * 0.8, bw + g.u * 2, g.u * 1.2);
    // floor and veranda
    ctx.fillStyle = '#6a5036';
    ctx.fillRect(g.xl - g.u * 8, g.floor, g.hw + g.u * 16, g.u * 5);
    ctx.fillStyle = '#85694a';
    ctx.fillRect(g.xl - g.u * 8, g.floor, g.hw + g.u * 16, Math.max(1, g.u * 0.9));
    ctx.fillStyle = '#4a3826';
    for (let x = g.xl - g.u * 8; x < g.xr + g.u * 8; x += g.u * 9) ctx.fillRect(x, g.floor + g.u, Math.max(1, g.u * 0.5), g.u * 4);
    // stone steps
    const steps = ['#a3a49b', '#8b8d85', '#74766f'];
    for (let i = 0; i < 3; i++) {
      const sw = g.hw * (0.62 - i * 0.02) + g.u * 10;
      ctx.fillStyle = steps[i];
      ctx.fillRect(g.cx - sw / 2, g.floor + g.u * (5 + i * 3.4), sw, g.u * 3.4);
      ctx.fillStyle = '#bcbdb2';
      ctx.fillRect(g.cx - sw / 2, g.floor + g.u * (5 + i * 3.4), sw, Math.max(1, g.u * 0.6));
    }
    // vermilion posts
    const pw = g.u * 5;
    for (const px of [g.xl - pw / 2 - g.u * 1, g.xr - pw / 2 + g.u * 1]) {
      ctx.fillStyle = '#9e3d2b';
      ctx.fillRect(px, g.beam - g.u * 3, pw, g.floor - g.beam + g.u * 3);
      ctx.fillStyle = '#c0553a';
      ctx.fillRect(px, g.beam - g.u * 3, Math.max(1, pw * 0.28), g.floor - g.beam + g.u * 3);
      ctx.fillStyle = '#6e2a1f';
      ctx.fillRect(px + pw * 0.78, g.beam - g.u * 3, pw * 0.22, g.floor - g.beam + g.u * 3);
      ctx.fillStyle = '#2f2923';
      ctx.fillRect(px - g.u * 0.8, g.floor - g.u * 1, pw + g.u * 1.6, g.u * 2);
      ctx.fillStyle = '#c9a24a';
      ctx.fillRect(px, g.beam + g.u * 1.5, pw, Math.max(1, g.u * 0.7));
    }
    return c;
  }

  // ---- rope ------------------------------------------------------------------

  function ropeShape(g) {
    const sag = g.u * 8;
    const y0 = g.beam + g.u * 10;
    const r0 = g.u * 9;
    const r1 = g.u * 5.2;
    return {
      y: s => y0 + sag * (1 - (2 * s - 1) ** 2),
      r: s => lerp(r0, r1, Math.pow(s, 0.8)) * (1 + 0.1 * Math.sin(s * 22)),
    };
  }

  function paintRope(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const shape = ropeShape(g);
    const x0 = g.xl - g.u * 4;
    const x1 = g.xr + g.u * 4;
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const dark = K.parseColor('#5a4727');
    const mid = K.parseColor('#a68d52');
    const lit = K.parseColor('#dcc98e');
    for (let x = Math.floor(x0); x < x1; x++) {
      const s = (x - x0) / (x1 - x0);
      const cy = shape.y(s);
      const r = shape.r(s);
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
        const n = (y - cy) / r;
        if (Math.abs(n) > 1) continue;
        const body = Math.sqrt(1 - n * n);
        const lightness = Math.max(0, Math.min(1, body * 0.7 - n * 0.35 + 0.1));
        const twist = Math.sin((x * 0.9 + n * r * 1.5) / (g.u * 0.75 + 0.4) + Math.sin(n * 2) * 1.4);
        const braid = twist > 0.15 ? 1 : twist < -0.55 ? -1 : 0;
        const t = Math.max(0, Math.min(1, lightness + braid * 0.22));
        const col = t < 0.5 ? K.mixColor(dark, mid, t * 2) : K.mixColor(mid, lit, (t - 0.5) * 2);
        const i = (y * c.width + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // binding cords where the rope meets the posts
    ctx.fillStyle = '#e1d8bd';
    for (const x of [g.xl + g.u * 2, g.xr - g.u * 2, g.cx]) {
      const s = (x - x0) / (x1 - x0);
      const r = shape.r(s);
      ctx.fillRect(x, shape.y(s) - r - 0.5, Math.max(1, g.u * 0.9), r * 2 + 1);
    }
    return { canvas: c, shape, x0, x1 };
  }

  function paintTail(g, w, h) {
    const c = layer(w + 2, h + 2);
    const ctx = c.getContext('2d');
    const tones = ['#5a4727', '#8d7640', '#b9a15f', '#dcc98e'];
    for (let x = 0; x < w; x++) {
      const taper = 1 - (x / w - 0.5) * 0;
      const len = h * (0.55 + 0.45 * Math.sin((x / w) * Math.PI)) * taper;
      for (let y = 0; y < len; y++) {
        const k = (x + Math.floor(y * 0.5)) % 4;
        ctx.fillStyle = tones[k];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.fillStyle = '#e1d8bd';
    ctx.fillRect(0, 0, w, Math.max(1, h * 0.12));
    return c;
  }

  function paintShide(g, w, h) {
    const c = layer(w + 2, h + 2);
    const ctx = c.getContext('2d');
    const seg = Math.max(2, Math.round(h / 4));
    const folds = Math.ceil(h / seg);
    for (let i = 0; i < folds; i++) {
      const y = i * seg;
      const lean = i % 2 ? w * 0.28 : 0;
      ctx.fillStyle = i % 2 ? '#d4cbb2' : '#f1ead6';
      poly(ctx, [lean, y, lean + w * 0.72, y, w * 0.72 + (i % 2 ? 0 : w * 0.28), y + seg, (i % 2 ? 0 : w * 0.28), y + seg]);
    }
    return c;
  }

  function makeHanging(g) {
    const items = [];
    const tailL = paintTail(g, Math.round(g.u * 8), Math.round(g.u * 22));
    const tailR = paintTail(g, Math.round(g.u * 5), Math.round(g.u * 16));
    const shide = paintShide(g, Math.round(g.u * 4.4), Math.round(g.u * 15));
    const tuft = paintTail(g, Math.round(g.u * 2.6), Math.round(g.u * 8));
    items.push({ img: tailL, s: 0.03, phase: 0.2, amp: 0.05, off: 0 });
    items.push({ img: tailR, s: 0.97, phase: 1.4, amp: 0.06, off: 0 });
    const spots = [0.2, 0.33, 0.46, 0.58, 0.7, 0.83];
    spots.forEach((s, i) => {
      items.push({ img: i % 2 ? tuft : shide, s, phase: i * 1.7, amp: 0.1, off: g.u * (i % 2 ? 0.4 : 0.9) });
    });
    return items;
  }

  // ---- pines -----------------------------------------------------------------

  function needles(ctx, g, rand, x, y, w) {
    const tones = ['#27402c', '#3a5836', '#587a47'];
    ctx.fillStyle = tones[0];
    blob(ctx, x, y, w, w * 0.34);
    ctx.fillStyle = tones[1];
    blob(ctx, x - w * 0.1, y - w * 0.1, w * 0.8, w * 0.26);
    ctx.fillStyle = tones[2];
    blob(ctx, x - w * 0.3, y - w * 0.2, w * 0.38, w * 0.12);
    ctx.fillStyle = tones[0];
    for (let i = 0; i < 6; i++) ctx.fillRect(x + (rand() - 0.5) * w * 1.6, y + w * 0.2 + rand() * w * 0.25, 1, Math.max(1, g.u * 0.8));
  }

  function paintPine(g, rand, side) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const bx = side < 0 ? g.W * 0.045 : g.W * 0.955;
    const lean = -side * g.u * 6;
    const tw = g.u * 7;
    const pts = [];
    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const y = g.H * 1.02 - f * g.H * 1.1;
      const x = bx + lean * Math.pow(f, 1.6) + Math.sin(f * 7 + side) * g.u * 1.6;
      pts.push([x, y, tw * (1 - f * 0.55)]);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const [x, y, w] = pts[i];
      const [, y2] = pts[i + 1];
      ctx.fillStyle = '#4a3425';
      ctx.fillRect(x - w / 2, y2, w, y - y2 + 1);
      ctx.fillStyle = '#6e4d36';
      ctx.fillRect(x - w / 2, y2, Math.max(1, w * 0.25), y - y2 + 1);
      ctx.fillStyle = '#2d2019';
      ctx.fillRect(x + w * 0.2, y2, Math.max(1, w * 0.3), y - y2 + 1);
    }
    ctx.fillStyle = '#34261c';
    for (let i = 0; i < 70; i++) {
      const p = pts[Math.floor(rand() * (pts.length - 1))];
      ctx.fillRect(p[0] - p[2] / 2 + rand() * p[2], p[1] - rand() * g.H * 0.06, Math.max(1, g.u * 0.9), Math.max(1, g.u * 1.5));
    }
    // branches with cloud tiers, reaching toward the hall
    const tiers = [[0.78, 0.3], [0.58, 0.5], [0.42, 0.62], [0.26, 0.78], [0.12, 0.9]];
    tiers.forEach(([f, reach], idx) => {
      const p = pts[Math.round(f * steps)];
      const w = g.u * (12 + reach * 10);
      const dir = -side;
      const ex = p[0] + dir * g.u * 7 * reach;
      ctx.strokeStyle = '#3d2c20';
      ctx.lineWidth = Math.max(1, g.u * 1.5);
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(ex, p[1] - g.u * 3);
      ctx.stroke();
      needles(ctx, g, rand, ex, p[1] - g.u * 4, w);
      needles(ctx, g, rand, p[0] - dir * g.u * 3, p[1] - g.u * 6, w * 0.8);
      if (idx > 2) needles(ctx, g, rand, p[0] + dir * g.u * 3, p[1] - g.u * 11, w * 0.7);
    });
    return { canvas: c, side, bx };
  }

  // ---- light and mist --------------------------------------------------------

  function paintShafts(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const beams = [[0.52, 0.1, 0.5], [0.68, 0.07, 0.35], [0.8, 0.12, 0.45], [0.38, 0.06, 0.25]];
    for (const [x, w, a] of beams) {
      const grad = ctx.createLinearGradient(0, 0, 0, g.H);
      grad.addColorStop(0, 'rgba(244,226,172,' + a * 0.5 + ')');
      grad.addColorStop(1, 'rgba(244,226,172,0)');
      ctx.fillStyle = grad;
      const top = g.W * x;
      const slant = g.H * 0.45;
      poly(ctx, [top, 0, top + g.W * w, 0, top + g.W * w - slant, g.H, top - slant, g.H]);
    }
    return c;
  }

  function wrapBlob(ctx, w, x, y, rx, ry) {
    blob(ctx, x, y, rx, ry);
    if (x - rx < 0) blob(ctx, x + w, y, rx, ry);
    if (x + rx > w) blob(ctx, x - w, y, rx, ry);
  }

  function paintMist(g, rand, hFrac, count, alpha) {
    const w = g.W;
    const h = Math.ceil(g.H * hFrac);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#eee8d6';
    for (let i = 0; i < count; i++) {
      const y = h * (0.25 + rand() * 0.5);
      const rx = g.U * (14 + rand() * 26);
      ctx.globalAlpha = alpha * (0.4 + rand() * 0.6);
      wrapBlob(ctx, w, rand() * w, y, rx, g.U * (1.4 + rand() * 2));
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function makeMotes(g, rand) {
    const m = [];
    for (let i = 0; i < MOTES; i++) {
      m.push({ x: rand() * g.W, y: g.H * (0.1 + rand() * 0.7), p: rand() * TAU, v: 0.4 + rand() * 0.6 });
    }
    return m;
  }

  // ---- run -------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.hall = paintHall(g, rand);
    state.rope = paintRope(g);
    state.hang = makeHanging(g);
    state.pines = [paintPine(g, rand, -1), paintPine(g, rand, 1)];
    state.shafts = paintShafts(g);
    state.mistLow = paintMist(g, rand, 0.3, 14, 0.5);
    state.mistHigh = paintMist(g, rand, 0.3, 10, 0.4);
    state.motes = makeMotes(g, rand);
  }

  function ropeLift(g, s, t, sway) {
    return Math.sin(t * 0.9 - s * 4.2) * g.u * 1.5 * sway * Math.sin(Math.PI * s);
  }

  function drawRope(ctx, g, t, sway) {
    const { canvas, x0, x1 } = state.rope;
    const span = (x1 - x0) / STRIPS;
    for (let i = 0; i < STRIPS; i++) {
      const sx = x0 + i * span;
      const s = (i + 0.5) / STRIPS;
      ctx.drawImage(canvas, sx, 0, span + 1, g.H, sx, ropeLift(g, s, t, sway), span + 1, g.H);
    }
  }

  function drawHanging(ctx, g, t, sway) {
    const { shape, x0, x1 } = state.rope;
    for (const it of state.hang) {
      const s = it.s;
      const x = x0 + s * (x1 - x0);
      const y = shape.y(s) + shape.r(s) * 0.6 + it.off + ropeLift(g, s, t, sway);
      const a = Math.sin(t * 0.9 - s * 4.2 + it.phase) * it.amp * sway;
      const c = Math.cos(a);
      const n = Math.sin(a);
      ctx.setTransform(c, n, -n, c, x, y);
      ctx.drawImage(it.img, -it.img.width / 2, 0);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawPines(ctx, g, t, sway) {
    for (const p of state.pines) {
      const k = Math.sin(t * 0.45 + p.side) * 0.006 * sway;
      ctx.setTransform(1, 0, k, 1, -k * g.H, 0);
      ctx.drawImage(p.canvas, 0, 0);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawMist(ctx, g, t, mist) {
    if (mist <= 0) return;
    const w = g.W;
    const a = (t * g.U * 1.2) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.9);
    ctx.drawImage(state.mistLow, -a, g.H * 0.72);
    ctx.drawImage(state.mistLow, w - a, g.H * 0.72);
    const b = (t * g.U * 0.7) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.7);
    ctx.drawImage(state.mistHigh, b - w, g.H * 0.44);
    ctx.drawImage(state.mistHigh, b, g.H * 0.44);
    ctx.globalAlpha = 1;
  }

  function drawMotes(ctx, g, t, light) {
    if (light <= 0) return;
    ctx.fillStyle = '#f2dc9a';
    ctx.globalAlpha = Math.min(0.8, 0.45 * light);
    for (const m of state.motes) {
      const x = (m.x + t * g.U * 0.8 * m.v + Math.sin(t * 0.7 + m.p) * g.u * 2) % g.W;
      const y = m.y + Math.sin(t * 0.5 * m.v + m.p) * g.u * 3;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { sway, mist, light } = api.props;
    ctx.drawImage(state.back, 0, 0);
    ctx.drawImage(state.hall, 0, 0);
    drawRope(ctx, g, t, sway);
    drawHanging(ctx, g, t, sway);
    drawPines(ctx, g, t, sway);
    drawMist(ctx, g, t, mist);
    if (light > 0) {
      ctx.globalAlpha = Math.min(1, light * (0.75 + 0.2 * Math.sin(t * 0.35)));
      ctx.drawImage(state.shafts, 0, 0);
      ctx.globalAlpha = 1;
    }
    drawMotes(ctx, g, t, light);
  }

  Kasuri.run({
    defaults: { sway: 1, mist: 1, light: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
