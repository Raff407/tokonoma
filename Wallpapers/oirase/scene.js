/*
 * 奥入瀬 Oirase — a mossy mountain stream under cedars, with a stone lantern on the bank.
 *
 * Forest, banks, water bed, rocks, lantern and the maple branch are baked once. Each frame
 * slides pale streaks down the stream, drifts one mist strip, breathes the light shafts
 * and floats a few maple leaves.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;
  const TAU = Math.PI * 2;
  const STREAKS = 64;
  const LEAVES = 9;
  const DRIFTERS = 8;
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

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    return { W, H, U, y0: Math.round(H * 0.4) };
  }

  // stream centre line and half width at depth f (0 far, 1 near)
  function depth(g, y) {
    return Math.min(1, Math.max(0, (y - g.y0) / (g.H - g.y0)));
  }
  function centre(g, f) {
    return g.W * 0.47 + Math.sin(f * 2.6 + 0.5) * g.W * 0.07 * (1 - f * 0.3);
  }
  function half(g, f) {
    return lerp(g.W * 0.035, g.W * 0.3, Math.pow(f, 1.15));
  }

  // ---- forest ---------------------------------------------------------------

  function paintHaze(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.y0 + g.U * 6);
    grad.addColorStop(0, '#9fb08f');
    grad.addColorStop(0.5, '#cdd2b4');
    grad.addColorStop(1, '#c5cdb0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
  }

  function trunk(ctx, g, x, top, bottom, w, ink, shade, rand) {
    ctx.fillStyle = ink;
    ctx.fillRect(x - w / 2, top, w, bottom - top);
    ctx.fillStyle = shade;
    ctx.fillRect(x + w * 0.15, top, w * 0.35, bottom - top);
    ctx.strokeStyle = shade;
    ctx.lineWidth = Math.max(1, w * 0.06);
    for (let i = 0; i < 5; i++) {
      const bx = x - w * 0.4 + rand() * w * 0.8;
      ctx.beginPath();
      ctx.moveTo(bx, top);
      ctx.lineTo(bx + (rand() - 0.5) * w * 0.1, bottom);
      ctx.stroke();
    }
  }

  function paintFarTrunks(ctx, g, rand) {
    const rows = [
      [18, 0.5, '#8d9a7c', '#7a876c', 0.9],
      [11, 0.9, '#6f7f62', '#5f6e54', 1.3],
    ];
    for (const [n, wk, ink, shade, k] of rows) {
      for (let i = 0; i < n; i++) {
        const x = (i + 0.2 + rand() * 0.6) * (g.W / n);
        const w = g.U * (1.2 + rand() * 1.4) * wk * k;
        trunk(ctx, g, x, -g.U, g.y0 + g.U * (1 + rand() * 4), w, ink, shade, rand);
      }
    }
    // high crowns, dark and soft
    ctx.fillStyle = '#4d6347';
    for (let i = 0; i < 26; i++) {
      blob(ctx, rand() * g.W, rand() * g.U * 6, g.U * (4 + rand() * 7), g.U * (2 + rand() * 3));
    }
    ctx.fillStyle = '#3b5139';
    for (let i = 0; i < 12; i++) {
      blob(ctx, rand() * g.W, rand() * g.U * 3, g.U * (4 + rand() * 6), g.U * (1.5 + rand() * 2));
    }
  }

  const GROUND = ['#26372a', '#33492f', '#435d38', '#58733f', '#74894c'];
  const WATER = ['#1f3a40', '#2c525a', '#3e6b6c', '#5f8d86'];

  function paintGround(ctx, g) {
    const h = g.H - g.y0;
    const img = ctx.createImageData(g.W, h);
    const gr = GROUND.map(K.parseColor);
    const wt = WATER.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const f = depth(g, y + g.y0);
      const c = centre(g, f);
      const hw = half(g, f);
      for (let x = 0; x < g.W; x++) {
        const edge = Math.abs(x - c) / hw;
        const n = fbm(x / (g.U * 5), (y + g.y0) / (g.U * 4), 3, 31);
        let rgb;
        if (edge < 1) {
          const v = Math.min(1, Math.max(0, 0.15 + f * 0.45 + (n - 0.5) * 0.9 + (1 - edge) * 0.15));
          const k = v * (wt.length - 1);
          const i = Math.min(wt.length - 2, Math.floor(k));
          const a = wt[i];
          const b = wt[i + 1];
          const t = k - i;
          rgb = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
        } else {
          const bank = smoothstep(1, 1.5, edge);
          const v = Math.min(1, Math.max(0, n * 1.1 - 0.15 + (1 - f) * 0.15 + bank * 0.05));
          const k = v * (gr.length - 1);
          const i = Math.min(gr.length - 2, Math.floor(k));
          const a = gr[i];
          const b = gr[i + 1];
          const t = k - i;
          rgb = [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
          if (edge < 1.12) rgb = [rgb[0] * 0.7, rgb[1] * 0.75, rgb[2] * 0.7];
        }
        const o = (y * g.W + x) * 4;
        d[o] = rgb[0];
        d[o + 1] = rgb[1];
        d[o + 2] = rgb[2];
        d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, g.y0);
  }

  function paintBigTrunks(ctx, g, rand) {
    const spec = [
      [0.06, 5.2, 0.8], [0.19, 3.4, 0.62], [0.82, 3.8, 0.66], [0.94, 5.6, 0.86],
    ];
    for (const [fx, wu, reach] of spec) {
      const x = g.W * fx;
      const w = g.U * wu;
      const base = g.H * (0.4 + reach * 0.5);
      trunk(ctx, g, x, -g.U, base, w, '#4a3a2e', '#33281f', rand);
      // moss climbing the lower trunk
      ctx.fillStyle = '#4f6b3c';
      for (let i = 0; i < 9; i++) {
        blob(ctx, x + (rand() - 0.5) * w * 0.8, base - rand() * g.U * 13, w * (0.25 + rand() * 0.3), g.U * (1 + rand() * 1.4));
      }
      ctx.fillStyle = '#6f8c4a';
      for (let i = 0; i < 5; i++) {
        blob(ctx, x - w * 0.2 + rand() * w * 0.3, base - rand() * g.U * 10, w * 0.15, g.U * 0.8);
      }
      // roots spreading
      ctx.fillStyle = '#33281f';
      ctx.beginPath();
      ctx.moveTo(x - w * 0.7, base + g.U * 1.2);
      ctx.quadraticCurveTo(x - w * 0.4, base - g.U, x - w * 0.5, base - g.U * 4);
      ctx.lineTo(x + w * 0.5, base - g.U * 4);
      ctx.quadraticCurveTo(x + w * 0.4, base - g.U, x + w * 0.7, base + g.U * 1.2);
      ctx.fill();
    }
  }

  // ---- rocks, lantern, ferns -----------------------------------------------------

  function rock(ctx, g, x, y, r, rand) {
    ctx.fillStyle = '#1b2a26';
    blob(ctx, x + r * 0.1, y + r * 0.2, r * 1.15, r * 0.55);
    ctx.fillStyle = '#6c7367';
    blob(ctx, x, y, r, r * 0.62);
    ctx.fillStyle = '#4a5a40';
    blob(ctx, x - r * 0.05, y - r * 0.2, r * 0.9, r * 0.4);
    ctx.fillStyle = '#6f8f4b';
    blob(ctx, x - r * 0.25, y - r * 0.3, r * 0.5, r * 0.2);
    ctx.fillStyle = '#8a8d7c';
    blob(ctx, x + r * 0.35, y - r * 0.05, r * 0.3, r * 0.14);
    // foam at the foot
    ctx.strokeStyle = '#d9dccb';
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    ctx.beginPath();
    ctx.ellipse(x + r * 0.05, y + r * 0.35, r * 1.2, r * 0.38, 0, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }

  function paintRocks(ctx, g, rand) {
    const inStream = [[0.35, -0.5, 1.4], [0.5, 0.45, 1.8], [0.65, -0.1, 2.6], [0.78, 0.6, 3.2], [0.9, -0.55, 4.2], [0.97, 0.2, 3.6], [0.58, -0.7, 1.6]];
    for (const [f, l, r] of inStream) {
      const y = g.y0 + f * (g.H - g.y0);
      rock(ctx, g, centre(g, f) + l * half(g, f), y, g.U * r, rand);
    }
    // bank boulders at the edges
    rock(ctx, g, g.W * 0.04, g.H * 0.97, g.U * 9, rand);
    rock(ctx, g, g.W * 0.97, g.H * 0.98, g.U * 8, rand);
    rock(ctx, g, g.W * 0.28, g.H * 0.78, g.U * 3, rand);
  }

  function lantern(ctx, g, x, y, s) {
    const stone = '#8a8c80';
    const dark = '#5d6256';
    const moss = '#5f7d42';
    const fill = (c, rx, ry, w, h) => { ctx.fillStyle = c; ctx.fillRect(x + rx * s, y + ry * s, w * s, h * s); };
    ctx.fillStyle = '#233326';
    blob(ctx, x, y + s * 0.4, s * 8, s * 1.6);
    fill(stone, -5, -3, 10, 3);
    fill(dark, -5, -1, 10, 1);
    fill(stone, -1.6, -13, 3.2, 10);
    fill(dark, 0.4, -13, 1.2, 10);
    fill(stone, -4.5, -15.2, 9, 2.2);
    fill(stone, -4, -22, 8, 6.8);
    fill('#1e2420', -2, -20.8, 4, 4);
    fill('#d8b765', -1.2, -20, 2.4, 2.6);
    fill(dark, 0, -22, 4, 6.8);
    // roof, wide with lifted corners
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.moveTo(x - 9 * s, y - 21.2 * s);
    ctx.lineTo(x - 5 * s, y - 27 * s);
    ctx.lineTo(x + 5 * s, y - 27 * s);
    ctx.lineTo(x + 9 * s, y - 21.2 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(x + 1 * s, y - 27 * s);
    ctx.lineTo(x + 5 * s, y - 27 * s);
    ctx.lineTo(x + 9 * s, y - 21.2 * s);
    ctx.lineTo(x + 2 * s, y - 21.2 * s);
    ctx.fill();
    // jewel finial
    fill(stone, -1.4, -29.5, 2.8, 2.6);
    ctx.fillStyle = stone;
    blob(ctx, x, y - 30.2 * s, s * 1.3, s * 1.6);
    // moss on every step
    ctx.fillStyle = moss;
    blob(ctx, x - 2 * s, y - 27.2 * s, s * 4, s * 1);
    blob(ctx, x, y - 3.2 * s, s * 4.4, s * 1);
    blob(ctx, x + 3 * s, y - 15.4 * s, s * 2.6, s * 0.8);
    ctx.fillStyle = '#86a35a';
    blob(ctx, x - 3 * s, y - 27.8 * s, s * 1.6, s * 0.5);
  }

  function fern(ctx, g, x, y, r, rand) {
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * (0.1 + 0.8 * (i / 8));
      const len = r * (0.7 + rand() * 0.5);
      const ex = x + Math.cos(a) * len;
      const ey = y + Math.sin(a) * len * 0.85 + len * 0.25;
      ctx.strokeStyle = i % 2 ? '#587a3c' : '#3f5f31';
      ctx.lineWidth = Math.max(1, g.U * 0.4);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.9, ex, ey);
      ctx.stroke();
      ctx.strokeStyle = '#8fae5c';
      ctx.lineWidth = Math.max(1, g.U * 0.2);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.45);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
  }

  function paintBank(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintBigTrunks(ctx, g, rand);
    lantern(ctx, g, g.W * 0.77, g.H * 0.76, g.U * 1.15);
    paintRocks(ctx, g, rand);
    fern(ctx, g, g.W * 0.12, g.H * 0.86, g.U * 9, rand);
    fern(ctx, g, g.W * 0.22, g.H * 0.95, g.U * 7, rand);
    fern(ctx, g, g.W * 0.86, g.H * 0.88, g.U * 8, rand);
    fern(ctx, g, g.W * 0.68, g.H * 0.66, g.U * 4, rand);
    return c;
  }

  // ---- maple branch ---------------------------------------------------------------

  function momiji(ctx, x, y, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = rot + (i / 10) * TAU;
      const rr = i % 2 ? r * 0.42 : r;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  function paintBranch(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const tones = ['#2f5a2c', '#47773a', '#6b9a48', '#92b95a'];
    ctx.strokeStyle = '#2a2018';
    ctx.lineCap = 'round';
    ctx.lineWidth = g.U * 1.4;
    ctx.beginPath();
    ctx.moveTo(g.W * 0.98, -g.U);
    ctx.quadraticCurveTo(g.W * 0.82, g.H * 0.02, g.W * 0.62, g.H * 0.1);
    ctx.stroke();
    ctx.lineWidth = g.U * 0.6;
    ctx.beginPath();
    ctx.moveTo(g.W * 0.84, g.H * 0.03);
    ctx.quadraticCurveTo(g.W * 0.78, g.H * 0.12, g.W * 0.72, g.H * 0.17);
    ctx.stroke();
    const spots = [];
    for (let i = 0; i < 46; i++) {
      const f = rand();
      const x = lerp(g.W * 0.98, g.W * 0.6, f) + (rand() - 0.5) * g.U * 7;
      const y = g.H * 0.1 * f * f + (rand() - 0.3) * g.U * 7 + g.U * 2;
      spots.push([x, y, g.U * (1.4 + rand() * 1.1), rand() * TAU]);
    }
    for (let p = 0; p < tones.length; p++) {
      ctx.fillStyle = tones[p];
      for (let i = p % 2; i < spots.length; i += p < 2 ? 1 : 2) {
        const s = spots[i];
        momiji(ctx, s[0] - p * g.U * 0.15, s[1] - p * g.U * 0.2, s[2] * (1 - p * 0.12), s[3]);
      }
    }
    ctx.fillStyle = '#d99a3e';
    for (let i = 0; i < 5; i++) momiji(ctx, spots[i * 7][0], spots[i * 7][1], spots[i * 7][2] * 0.7, spots[i * 7][3]);
    return c;
  }

  // ---- light and mist ---------------------------------------------------------------

  function paintShafts(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 5; i++) {
      const x = g.W * (0.25 + i * 0.13 + rand() * 0.05);
      const w = g.U * (3 + rand() * 4);
      const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.8);
      grad.addColorStop(0, 'rgba(240,222,160,0.5)');
      grad.addColorStop(1, 'rgba(240,222,160,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + w, 0);
      ctx.lineTo(x + w - g.H * 0.3, g.H * 0.8);
      ctx.lineTo(x - g.H * 0.3 - w * 0.3, g.H * 0.8);
      ctx.closePath();
      ctx.fill();
    }
    // dapples on the ground
    ctx.fillStyle = 'rgba(232,214,150,0.32)';
    for (let i = 0; i < 28; i++) {
      const y = g.H * (0.55 + rand() * 0.42);
      blob(ctx, g.W * rand(), y, g.U * (1 + rand() * 2), g.U * (0.4 + rand() * 0.5));
    }
    return c;
  }

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 16), y / (g.U * 4), 4, 77);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.38, 0.64, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 226;
        img.data[i + 1] = 228;
        img.data[i + 2] = 212;
        img.data[i + 3] = a * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMist(ctx, g, t, mist) {
    if (mist <= 0) return;
    const m = state.mist;
    const w = m.width;
    const a = (t * g.U * 1.2) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.8);
    ctx.drawImage(m, -a, g.H * 0.3);
    ctx.drawImage(m, w - a, g.H * 0.3);
    const b = (t * g.U * 0.7 + w * 0.4) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.45);
    ctx.drawImage(m, b - w, g.H * 0.5);
    ctx.drawImage(m, b, g.H * 0.5);
    ctx.globalAlpha = 1;
  }

  // ---- moving things ----------------------------------------------------------------

  function makeStreaks(rand) {
    const s = new Float32Array(STREAKS);
    const l = new Float32Array(STREAKS);
    const v = new Float32Array(STREAKS);
    for (let i = 0; i < STREAKS; i++) {
      s[i] = rand();
      l[i] = (rand() * 2 - 1) * 0.92;
      v[i] = 0.7 + rand() * 0.6;
    }
    return { s, l, v };
  }

  function drawStreaks(ctx, g, dt, flow) {
    const S = state.streaks;
    ctx.lineCap = 'round';
    for (let i = 0; i < STREAKS; i++) {
      S.s[i] += dt * flow * S.v[i] * (0.05 + S.s[i] * 0.3);
      if (S.s[i] > 1) {
        S.s[i] = 0.02;
        S.l[i] = (state.rand() * 2 - 1) * 0.92;
      }
      const f = S.s[i];
      const y = g.y0 + f * (g.H - g.y0);
      const x = centre(g, f) + S.l[i] * half(g, f);
      const len = g.U * (0.4 + f * 3.2);
      ctx.globalAlpha = Math.min(1, f * 6) * (0.4 + 0.4 * f);
      ctx.strokeStyle = i % 3 ? '#c8d6cc' : '#eef0e2';
      ctx.lineWidth = Math.max(1, g.U * (0.25 + f * 0.5));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + S.l[i] * len * 0.2, y + len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function makeLeaves(rand) {
    const f = () => new Float32Array(LEAVES);
    const L = { s: f(), l: f(), a: f(), p: f(), v: f() };
    for (let i = 0; i < LEAVES; i++) {
      L.s[i] = rand();
      L.l[i] = (rand() * 2 - 1) * 0.7;
      L.a[i] = rand() * TAU;
      L.p[i] = rand() * TAU;
      L.v[i] = 0.6 + rand() * 0.5;
    }
    return L;
  }

  function drawLeaves(ctx, g, t, dt, flow) {
    const L = state.leaves;
    for (let i = 0; i < LEAVES; i++) {
      L.s[i] += dt * flow * L.v[i] * (0.04 + L.s[i] * 0.16);
      if (L.s[i] > 1.02) {
        L.s[i] = 0.1;
        L.l[i] = (state.rand() * 2 - 1) * 0.7;
      }
      const f = L.s[i];
      const y = g.y0 + f * (g.H - g.y0);
      const x = centre(g, f) + (L.l[i] + Math.sin(t * 0.7 + L.p[i]) * 0.06) * half(g, f);
      const sz = g.U * (0.5 + f * 1.4);
      const a = L.a[i] + t * 0.3;
      const c = Math.cos(a);
      const s = Math.sin(a);
      ctx.fillStyle = i % 3 === 0 ? '#c9893a' : i % 3 === 1 ? '#7fa24e' : '#d0b05a';
      ctx.setTransform(c, 0.4 * s, -s, 0.4 * c, x, y);
      ctx.fillRect(-sz / 2, -sz * 0.4, sz, sz * 0.8);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function makeDrifters(rand) {
    const f = () => new Float32Array(DRIFTERS);
    const D = { x: f(), y: f(), a: f(), p: f(), v: f() };
    for (let i = 0; i < DRIFTERS; i++) {
      D.x[i] = rand();
      D.y[i] = rand();
      D.a[i] = rand() * TAU;
      D.p[i] = rand() * TAU;
      D.v[i] = 0.7 + rand() * 0.6;
    }
    return D;
  }

  function drawDrifters(ctx, g, t, dt) {
    const D = state.drifters;
    ctx.fillStyle = '#9db95e';
    for (let i = 0; i < DRIFTERS; i++) {
      D.y[i] += dt * 0.035 * D.v[i];
      D.x[i] += dt * 0.008;
      if (D.y[i] > 1) {
        D.y[i] = -0.05;
        D.x[i] = state.rand();
      }
      const x = ((D.x[i] + Math.sin(t * 0.8 + D.p[i]) * 0.02) % 1) * g.W;
      const y = D.y[i] * g.H * 0.8;
      const a = D.a[i] + t * 1.1;
      const c = Math.cos(a);
      const s = Math.sin(a) * 0.6;
      const sz = g.U * 1.5;
      ctx.setTransform(c, s, -s, c, x, y);
      ctx.fillRect(-sz / 2, -sz * 0.3, sz, sz * 0.6);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run --------------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    const back = layer(g.W, g.H);
    const bctx = back.getContext('2d');
    paintHaze(bctx, g);
    paintFarTrunks(bctx, g, rand);
    paintGround(bctx, g);
    state.back = back;
    state.bank = paintBank(g, rand);
    state.branch = paintBranch(g, rand);
    state.shafts = paintShafts(g, rand);
    state.mist = paintMist(g);
    state.streaks = makeStreaks(rand);
    state.leaves = makeLeaves(rand);
    state.drifters = makeDrifters(rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { flow, mist, light } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.back, 0, 0);
    drawStreaks(ctx, g, step, flow);
    drawLeaves(ctx, g, t, step, flow);
    ctx.drawImage(state.bank, 0, 0);
    drawMist(ctx, g, t, mist);
    ctx.globalAlpha = Math.min(1, light * (0.55 + 0.2 * Math.sin(t * 0.35)));
    ctx.drawImage(state.shafts, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.branch, 0, 0);
    drawDrifters(ctx, g, t, step);
  }

  Kasuri.run({
    defaults: { flow: 1, mist: 1, light: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
