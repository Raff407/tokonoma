/*
 * 苏州 Suzhou — a scholar garden at first light.
 *
 * Sky, hills, trees, the whitewashed cloud wall with its moon gate, the rockery and the
 * pavilion are baked once into one world layer. The pond is that world flipped and laid
 * back in thin rows that slide sideways. Koi, willow strands, lotus and ripples are the
 * only things that move each frame, all from small reused pools.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.6;
  const SKY = ['#a9b4b6', '#c3c9c2', '#d9d6c4', '#e6dfc9'];
  const WALL = '#e7e1cf';
  const TILE = '#3b444c';
  const POND = '#5f7b73';
  const VEIL = 0.4;
  const PINE = { trunk: '#3d2f26', dark: '#2f4733', mid: '#456443', light: '#6d8a52' };
  const GREENS = [
    ['#3a5240', '#4a6549', '#668257'],
    ['#556f45', '#6b8656', '#8aa26a'],
    ['#a8873c', '#c3a24e', '#dcc272'],
  ];
  const MAX_KOI = 8;
  const KOI_INK = ['#c8502e', '#15292b', '#d6ad57', '#15292b', '#e9e2cc', '#15292b', '#15292b', '#c8502e'];
  const STRANDS = 22;
  const STREAKS = 60;
  const RIPPLES = 4;
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
    const u = U * Math.min(1, W / (U * 135));
    const wy = Math.round(H * WATER);
    return { W, H, U, u, wy, wallTop: H * 0.38, wallBot: wy - U * 1.3 };
  }

  function wallY(g, x) {
    return g.wallTop + g.U * 1.6 * Math.sin(x / (g.U * 9));
  }

  // ---- sky, hills, trees behind the wall -------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.wy);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.wy; y++) {
      const f = Math.min(1, y / (g.H * 0.4)) * (inks.length - 1);
      const k = Math.min(inks.length - 2, Math.floor(f));
      for (let x = 0; x < g.W; x++) {
        const ink = inks[k + (rand() < f - k ? 1 : 0)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#efe6cf';
    blob(ctx, g.W * 0.72, g.H * 0.15, g.U * 6, g.U * 6);
  }

  function paintHills(ctx, g) {
    const ridges = [
      ['#b3bfbf', 0.25, 0.1, 11],
      ['#97a7a6', 0.3, 0.09, 23],
      ['#7f9390', 0.34, 0.07, 37],
    ];
    for (const [ink, base, amp, seed] of ridges) {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(0, g.wy);
      for (let x = 0; x <= g.W + 2; x += 2) {
        ctx.lineTo(x, g.H * base - fbm(x / (g.U * 34), seed, 4, seed) * g.H * amp * 1.6);
      }
      ctx.lineTo(g.W, g.wy);
      ctx.fill();
    }
  }

  function crown(ctx, x, y, r, inks) {
    ctx.fillStyle = inks[0];
    blob(ctx, x, y, r, r * 0.8);
    ctx.fillStyle = inks[1];
    blob(ctx, x - r * 0.2, y - r * 0.18, r * 0.7, r * 0.56);
    ctx.fillStyle = inks[2];
    blob(ctx, x - r * 0.38, y - r * 0.32, r * 0.34, r * 0.27);
  }

  function paintTrees(ctx, g, rand, gx, gr) {
    ctx.fillStyle = '#3a5240';
    ctx.fillRect(0, g.wallTop + g.U * 2, g.W, g.wallBot - g.wallTop);
    const tall = g.wallBot - g.wallTop;
    for (let y = g.wallTop - g.U * 5; y < g.wallBot; y += g.U * 2.2) {
      for (let x = -g.U * 2; x < g.W + g.U * 2; ) {
        const r = g.U * (2 + rand() * 1.6);
        const dip = Math.exp(-(((x - gx) / (gr * 1.3)) ** 2)) * tall * 0.4;
        const top = g.wallTop - g.U * (1 + fbm(x / (g.U * 12), 2, 3, 41) * 5) + dip;
        if (y >= top) {
          const n = fbm(x / (g.U * 14), y / (g.U * 9), 3, 7);
          const kind = n > 0.62 ? 2 : n > 0.45 ? 1 : 0;
          crown(ctx, x + (rand() - 0.5) * r, y, r, GREENS[kind]);
        }
        x += r * (1.0 + rand() * 0.5);
      }
    }
  }

  // ---- wall ------------------------------------------------------------------

  function cutCircle(ctx, x, y, r) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  function paintWall(g, rand, gate) {
    const c = layer(g.W, g.wy + 1);
    const ctx = c.getContext('2d');
    const U = g.U;
    ctx.fillStyle = WALL;
    ctx.beginPath();
    ctx.moveTo(0, g.wallBot);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, wallY(g, x));
    ctx.lineTo(g.W, g.wallBot);
    ctx.fill();
    ctx.fillStyle = '#cfd0bd';
    for (let x = 0; x < g.W; x += U * (3 + rand() * 4)) blob(ctx, x, g.wallBot - U * 0.6, U * (2 + rand() * 3), U * 1.1);
    ctx.fillStyle = '#d7d4c0';
    for (let x = 0; x < g.W; x += U * (4 + rand() * 6)) ctx.fillRect(x, wallY(g, x) + U * 1.2, Math.max(1, U * 0.5), U * (2 + rand() * 4));
    ctx.fillStyle = '#8a8a7e';
    ctx.fillRect(0, g.wallBot - U * 0.8, g.W, U * 0.8 + 1);
    // tiled coping that follows the cloud-wall wave
    ctx.lineCap = 'butt';
    ctx.strokeStyle = TILE;
    ctx.lineWidth = U * 1.5;
    ctx.beginPath();
    for (let x = 0; x <= g.W + 2; x += 2) {
      if (x === 0) ctx.moveTo(x, wallY(g, x) - U * 0.2);
      else ctx.lineTo(x, wallY(g, x) - U * 0.2);
    }
    ctx.stroke();
    ctx.strokeStyle = '#8c969a';
    ctx.lineWidth = Math.max(1, U * 0.35);
    ctx.beginPath();
    for (let x = 0; x <= g.W + 2; x += 2) {
      if (x === 0) ctx.moveTo(x, wallY(g, x) - U * 0.9);
      else ctx.lineTo(x, wallY(g, x) - U * 0.9);
    }
    ctx.stroke();
    ctx.fillStyle = '#242b31';
    for (let x = 0; x < g.W; x += U * 1.5) ctx.fillRect(x, wallY(g, x) + U * 0.5, Math.max(1, U * 0.4), U * 0.7);
    // openings
    squareWindow(ctx, g, g.W * 0.31, (g.wallTop + g.wallBot) / 2 - U, g.U * 8);
    roundWindow(ctx, g, g.W * 0.9, (g.wallTop + g.wallBot) / 2 - U, g.U * 4.6);
    moonGate(ctx, g, gate.x, gate.y, gate.r);
    return c;
  }

  function moonGate(ctx, g, x, y, r) {
    cutCircle(ctx, x, y, r);
    ctx.strokeStyle = '#8f9288';
    ctx.lineWidth = g.U * 1.1;
    ctx.beginPath();
    ctx.arc(x, y, r + g.U * 0.5, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#cfcbb8';
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    ctx.beginPath();
    ctx.arc(x, y, r - g.U * 0.1, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#9a9a8c';
    ctx.fillRect(x - r * 0.8, y + r - g.U * 0.2, r * 1.6, g.U * 1.1);
  }

  function squareWindow(ctx, g, x, y, s) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - s / 2, y - s / 2, s, s);
    ctx.clip();
    ctx.strokeStyle = WALL;
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    const step = s / 4;
    ctx.beginPath();
    for (let k = -s; k <= s; k += step) {
      ctx.moveTo(x - s / 2 + k, y - s / 2);
      ctx.lineTo(x + k + s / 2 - s / 2 + s, y + s / 2);
      ctx.moveTo(x + s / 2 + k, y - s / 2);
      ctx.lineTo(x + k - s / 2 - s / 2 + 0, y + s / 2);
    }
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#7a7c72';
    ctx.lineWidth = g.U * 0.9;
    ctx.strokeRect(x - s / 2, y - s / 2, s, s);
  }

  function roundWindow(ctx, g, x, y, r) {
    cutCircle(ctx, x, y, r);
    ctx.strokeStyle = WALL;
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, 0, TAU);
    for (let i = 0; i < 8; i++) {
      ctx.moveTo(x + Math.cos(i * TAU / 8) * r * 0.5, y + Math.sin(i * TAU / 8) * r * 0.5);
      ctx.lineTo(x + Math.cos(i * TAU / 8) * r, y + Math.sin(i * TAU / 8) * r);
    }
    ctx.stroke();
    ctx.strokeStyle = '#7a7c72';
    ctx.lineWidth = g.U * 0.9;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
  }

  // ---- plants ------------------------------------------------------------------

  function pine(ctx, x, y, h, seed) {
    const r = K.rng(seed);
    const lean = h * (r() - 0.5) * 0.4;
    ctx.strokeStyle = PINE.trunk;
    ctx.lineWidth = Math.max(1, h * 0.05);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - lean, y - h * 0.5, x + lean, y - h * 0.92);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const f = 0.45 + i * 0.17;
      const side = i % 2 ? 1 : -1;
      const px = x + lean * (2 * f - 1) * f + side * h * 0.13 * (1 - f * 0.6);
      const py = y - h * f;
      const w = h * (0.29 - f * 0.11);
      ctx.fillStyle = PINE.dark;
      blob(ctx, px, py, w, w * 0.42);
      blob(ctx, px + side * w * 0.55, py + w * 0.08, w * 0.55, w * 0.34);
      ctx.fillStyle = PINE.mid;
      blob(ctx, px - w * 0.1, py - w * 0.12, w * 0.75, w * 0.28);
      ctx.fillStyle = PINE.light;
      blob(ctx, px - w * 0.3, py - w * 0.22, w * 0.42, w * 0.14);
    }
  }

  function bamboo(ctx, g, rand, x, by) {
    const u = g.u;
    for (let i = 0; i < 8; i++) {
      const sx = x + (i - 3.5) * u * 1.1 + (rand() - 0.5) * u;
      const top = by - u * (24 + rand() * 12);
      const lean = (rand() - 0.5) * u * 3;
      ctx.strokeStyle = i % 2 ? '#6f8f55' : '#587a45';
      ctx.lineWidth = Math.max(1, u * 0.6);
      ctx.beginPath();
      ctx.moveTo(sx, by);
      ctx.lineTo(sx + lean, top);
      ctx.stroke();
      ctx.strokeStyle = '#a9bf82';
      ctx.lineWidth = Math.max(1, u * 0.25);
      for (let k = 1; k < 6; k++) {
        const f = k / 6;
        ctx.beginPath();
        ctx.moveTo(sx + lean * f - u * 0.4, lerp(by, top, f));
        ctx.lineTo(sx + lean * f + u * 0.4, lerp(by, top, f));
        ctx.stroke();
      }
      for (let k = 0; k < 3; k++) {
        const f = 0.6 + k * 0.17;
        const lx = sx + lean * f;
        const ly = lerp(by, top, f);
        for (let j = 0; j < 6; j++) {
          const a = 0.3 + (j / 5) * 2.5;
          ctx.strokeStyle = j % 2 ? '#52743f' : '#7da05c';
          ctx.lineWidth = Math.max(1, u * 0.45);
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx + Math.cos(a) * u * 3.2, ly + Math.sin(a) * u * 2.2);
          ctx.stroke();
        }
      }
    }
  }

  function banana(ctx, g, x, by) {
    const u = g.u;
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI + 0.35 + (i / 5) * (Math.PI - 0.7);
      const len = u * (9 + (i % 3) * 2.5);
      const cx = x + Math.cos(a) * len * 0.5;
      const cy = by + Math.sin(a) * len * 0.5;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = i % 2 ? '#6e9150' : '#5c8044';
      ctx.beginPath();
      ctx.ellipse(0, 0, len / 2, len * 0.13, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#a9c286';
      ctx.lineWidth = Math.max(1, u * 0.3);
      ctx.beginPath();
      ctx.moveTo(-len / 2, 0);
      ctx.lineTo(len / 2, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ---- rockery ----------------------------------------------------------------

  function rock(ctx, g, x, by, w, h, seed) {
    const n = 14;
    const cxs = [];
    const lx = [];
    const rx = [];
    const ys = [];
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const sway = (K.noise2(f * 2.4, seed, seed) - 0.5) * w * 0.5 * f;
      const prof = Math.max(0.12, Math.pow(1 - f, 0.55) * (0.55 + 0.9 * K.noise2(f * 5.1, 3.3, seed)));
      const half = w * 0.5 * Math.min(1, prof);
      cxs.push(x + sway);
      lx.push(x + sway - half);
      rx.push(x + sway + half);
      ys.push(by - h * f);
    }
    const outline = [];
    for (let i = 0; i <= n; i++) outline.push(lx[i], ys[i]);
    for (let i = n; i >= 0; i--) outline.push(rx[i], ys[i]);
    ctx.fillStyle = '#8e9a98';
    poly(ctx, outline);
    const shade = [];
    for (let i = 0; i <= n; i++) shade.push(lerp(cxs[i], rx[i], 0.25), ys[i]);
    for (let i = n; i >= 0; i--) shade.push(rx[i], ys[i]);
    ctx.fillStyle = '#68767a';
    poly(ctx, shade);
    const lit = [];
    const top = Math.floor(n * 0.75);
    for (let i = 0; i <= top; i++) lit.push(lx[i], ys[i]);
    for (let i = top; i >= 0; i--) lit.push(lerp(lx[i], cxs[i], 0.35), ys[i]);
    ctx.fillStyle = '#b9c0b4';
    poly(ctx, lit);
    ctx.strokeStyle = '#6a7676';
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    for (let k = 0; k < 3; k++) {
      const i = 3 + k * 3;
      ctx.beginPath();
      ctx.moveTo(lx[i] + w * 0.05, ys[i]);
      ctx.quadraticCurveTo(cxs[i], ys[i] - h * 0.05, rx[i] - w * 0.05, ys[i] + h * 0.03);
      ctx.stroke();
    }
    for (let k = 0; k < 3; k++) {
      const i = 4 + k * 3;
      ctx.fillStyle = '#2b3638';
      blob(ctx, cxs[i] + w * 0.04, ys[i], w * (0.07 + k * 0.01), h * 0.045);
      ctx.fillStyle = '#c4c8bc';
      blob(ctx, cxs[i] + w * 0.04, ys[i] + h * 0.04, w * 0.06, Math.max(0.4, g.U * 0.2));
    }
    ctx.fillStyle = '#5f7a4a';
    blob(ctx, cxs[0], by, w * 0.4, g.U * 0.9);
    blob(ctx, cxs[n], ys[n] + g.U * 0.4, w * 0.18, g.U * 0.7);
    return [cxs[n], ys[n]];
  }

  function paintRockery(ctx, g) {
    const u = g.u;
    const by = g.wy - g.U * 0.5;
    const W = g.W;
    rock(ctx, g, W * 0.07, by, u * 11, u * 24, 5);
    rock(ctx, g, W * 0.225, by, u * 12, u * 20, 9);
    const peak = rock(ctx, g, W * 0.135, by, u * 17, u * 38, 3);
    rock(ctx, g, W * 0.18, by + g.U * 0.5, u * 9, u * 10, 14);
    rock(ctx, g, W * 0.035, by + g.U * 0.5, u * 8, u * 9, 17);
    pine(ctx, peak[0], peak[1] + g.U, u * 17, 5);
    pine(ctx, W * 0.225, by - u * 19, u * 11, 9);
  }

  // ---- pavilion ---------------------------------------------------------------

  function paintPavilion(ctx, g) {
    const u = g.u;
    const cx = g.W * 0.77;
    const pb = g.wy + u * 0.4;
    const pt = g.wy - u * 3.2;
    const y0 = pt - u * 14;
    const hw = u * 18.5;
    const fh = u * 1.3;
    const ye = y0 - u * 3.8;
    const lift = u * 4.2;
    const eave = (x) => {
      const d = Math.max(0, (Math.abs(x - cx) - hw * 0.5) / (hw * 0.5));
      return ye - lift * d * d;
    };
    ctx.fillStyle = '#8c8f86';
    ctx.fillRect(cx - u * 14.5, pt, u * 29, pb - pt);
    ctx.fillStyle = '#b9b8a8';
    ctx.fillRect(cx - u * 14.5, pt, u * 29, u * 0.9);
    ctx.fillStyle = '#a5a698';
    ctx.fillRect(cx - u * 5, pt + u * 1.2, u * 10, u * 1.1);
    ctx.fillStyle = '#2a2521';
    ctx.fillRect(cx - u * 11, y0, u * 22, pt - y0);
    // lantern
    ctx.strokeStyle = '#6b5236';
    ctx.lineWidth = Math.max(1, u * 0.25);
    ctx.beginPath();
    ctx.moveTo(cx, y0);
    ctx.lineTo(cx, y0 + u * 2.4);
    ctx.stroke();
    ctx.fillStyle = '#b8452c';
    blob(ctx, cx, y0 + u * 4, u * 1.6, u * 1.9);
    ctx.fillStyle = '#d6ad57';
    ctx.fillRect(cx - u * 0.9, y0 + u * 2.1, u * 1.8, u * 0.5);
    ctx.fillRect(cx - u * 0.2, y0 + u * 5.8, u * 0.4, u * 1.6);
    // side balustrades with seats
    for (const [a, b] of [[-11, -4], [4, 11]]) {
      const x1 = cx + a * u;
      const w = (b - a) * u;
      ctx.fillStyle = '#6a2d1f';
      for (let x = x1; x < x1 + w; x += u * 1.3) ctx.fillRect(x, pt - u * 5.6, Math.max(1, u * 0.35), u * 4.4);
      ctx.fillStyle = '#7d3322';
      ctx.fillRect(x1, pt - u * 1.9, w, u * 0.7);
      ctx.fillStyle = '#a0402c';
      ctx.fillRect(x1, pt - u * 5.9, w, u * 0.6);
    }
    // pillars
    for (const p of [-11, -4, 4, 11]) {
      ctx.fillStyle = '#6e7168';
      ctx.fillRect(cx + p * u - u * 0.9, pt - u * 0.6, u * 1.8, u * 0.7);
      ctx.fillStyle = '#a0402c';
      ctx.fillRect(cx + p * u - u * 0.55, y0, u * 1.1, pt - y0);
      ctx.fillStyle = '#c25a3f';
      ctx.fillRect(cx + p * u - u * 0.55, y0, Math.max(1, u * 0.3), pt - y0);
    }
    // hanging lattice
    ctx.strokeStyle = '#b99a58';
    ctx.lineWidth = Math.max(1, u * 0.3);
    for (let x = cx - u * 11; x < cx + u * 11 - u * 1.5; x += u * 1.7) {
      ctx.beginPath();
      ctx.arc(x + u * 0.85, y0 + u * 0.2, u * 0.85, 0, Math.PI);
      ctx.stroke();
    }
    // beam and brackets
    ctx.fillStyle = '#2b3e55';
    ctx.fillRect(cx - u * 12.5, y0 - u * 1.6, u * 25, u * 1.6);
    ctx.fillStyle = '#c3a24e';
    for (let x = cx - u * 12; x < cx + u * 12; x += u * 1.6) ctx.fillRect(x, y0 - u * 0.9, Math.max(1, u * 0.5), Math.max(1, u * 0.35));
    ctx.fillStyle = '#7b5c3a';
    for (const p of [-11, -7.5, -4, 0, 4, 7.5, 11]) ctx.fillRect(cx + p * u - u * 1.2, y0 - u * 2.7, u * 2.4, u * 1.1);
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(cx - u * 13, y0 - u * 3.5, u * 26, u * 0.8);
    // roof
    const under = [];
    const fascia = [];
    const roof = [];
    const flank = (x) => {
      const q = Math.min(1, Math.max(0, (hw - Math.abs(x - cx)) / (hw - u * 3.5)));
      return eave(x) - fh - u * 10 * Math.pow(q, 1.5);
    };
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const x = lerp(cx - hw, cx + hw, i / n);
      const taper = 1 - Math.abs(i / n - 0.5) * 2;
      under.push(x, eave(x) + u * 1.1 * Math.sqrt(taper));
      roof.push(x, flank(x));
    }
    for (let i = n; i >= 0; i--) {
      const x = lerp(cx - hw, cx + hw, i / n);
      under.push(x, eave(x) - 1);
      roof.push(x, eave(x) - fh);
      fascia.push(x, eave(x) - fh);
    }
    for (let i = 0; i <= n; i++) {
      const x = lerp(cx - hw, cx + hw, i / n);
      fascia.push(x, eave(x));
    }
    ctx.fillStyle = '#2c2f35';
    poly(ctx, under);
    ctx.fillStyle = '#3f4a54';
    poly(ctx, roof);
    ctx.fillStyle = '#232a30';
    poly(ctx, fascia);
    ctx.lineWidth = Math.max(1, u * 0.3);
    ctx.strokeStyle = '#5b6a72';
    for (let k = 1; k < 7; k++) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const x = lerp(cx - hw, cx + hw, i / n);
        const y = lerp(eave(x) - fh, flank(x), k / 7);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = '#2d363d';
    ctx.beginPath();
    for (let x = cx - hw + u * 1.5; x < cx + hw - u * 1; x += u * 1.6) {
      ctx.moveTo(x, eave(x) - fh);
      ctx.lineTo(x, flank(x));
    }
    ctx.stroke();
    ctx.strokeStyle = '#1f262b';
    ctx.lineWidth = Math.max(1, u * 0.7);
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const x = lerp(cx - hw, cx + hw, i / n);
      if (i === 0) ctx.moveTo(x, flank(x));
      else ctx.lineTo(x, flank(x));
    }
    ctx.stroke();
    // ridge, curled ends and the gold finial
    const ridgeY = flank(cx);
    ctx.fillStyle = '#232a30';
    ctx.fillRect(cx - u * 3.5, ridgeY - u * 0.5, u * 7, u * 1);
    for (const s of [-1, 1]) {
      poly(ctx, [cx + s * u * 3.5, ridgeY - u * 0.5, cx + s * u * 4.8, ridgeY - u * 1.9, cx + s * u * 4.2, ridgeY + u * 0.5]);
    }
    ctx.fillStyle = '#c7a04c';
    blob(ctx, cx, ridgeY - u * 1.7, u * 0.8, u * 1.1);
    blob(ctx, cx, ridgeY - u * 3.1, u * 0.45, u * 0.55);
    ctx.fillRect(cx - u * 0.15, ridgeY - u * 4.2, u * 0.3, u * 1);
    for (const s of [-1, 1]) {
      const tx = cx + s * hw;
      ctx.fillStyle = '#c7a04c';
      blob(ctx, tx, eave(tx) + u * 1.6, u * 0.5, u * 0.7);
    }
  }

  // ---- shore ------------------------------------------------------------------

  function paintShore(ctx, g, rand) {
    const U = g.U;
    ctx.fillStyle = '#7d8279';
    ctx.fillRect(0, g.wy - U * 1.2, g.W, U * 1.2 + 1);
    for (let x = 0; x < g.W; x += U * (1.4 + rand() * 1.6)) {
      ctx.fillStyle = rand() < 0.5 ? '#9a9c8f' : '#6a7068';
      blob(ctx, x, g.wy - U * 0.5, U * (0.7 + rand() * 0.9), U * 0.55);
    }
    for (let x = 0; x < g.W; x += U * (3 + rand() * 4)) {
      const r = U * (1.4 + rand() * 1.4);
      ctx.fillStyle = '#34503a';
      blob(ctx, x, g.wy - U * 1.6, r, r * 0.6);
      ctx.fillStyle = '#5a7a4a';
      blob(ctx, x - r * 0.3, g.wy - U * 2.0, r * 0.5, r * 0.25);
      if (rand() < 0.2) {
        ctx.fillStyle = '#b64a35';
        blob(ctx, x + r * 0.2, g.wy - U * 2.1, U * 0.5, U * 0.4);
      }
    }
  }

  function paintWorld(g, rand, gate) {
    const c = layer(g.W, g.wy + 1);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintHills(ctx, g);
    paintTrees(ctx, g, rand, gate.x, gate.r);
    ctx.drawImage(paintWall(g, rand, gate), 0, 0);
    paintShore(ctx, g, rand);
    bamboo(ctx, g, rand, g.W * 0.375, g.wy - g.U * 1.5);
    banana(ctx, g, g.W * 0.575, g.wy - g.U * 1.5);
    paintRockery(ctx, g);
    paintPavilion(ctx, g);
    pine(ctx, g.W * 0.955, g.wy - g.U, g.u * 26, 21);
    return c;
  }

  // ---- bridge -----------------------------------------------------------------

  function bridgePath(g) {
    const xs = [0.2, 0.29, 0.30, 0.39, 0.40, 0.49, 0.50, 0.59, 0.60, 0.665];
    const ys = [1, 1, 2, 2, 1, 1, 2, 2, 1, 1];
    const p = [];
    for (let i = 0; i < xs.length; i++) p.push(xs[i] * g.W, g.wy + g.U * (ys[i] === 1 ? 4 : 10));
    return p;
  }

  function strokePath(ctx, p, dy) {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1] + dy);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1] + dy);
    ctx.stroke();
  }

  function paintBridge(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const U = g.U;
    const p = bridgePath(g);
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#4d5753';
    ctx.lineWidth = U * 1.3;
    strokePath(ctx, p, U * 0.9);
    ctx.strokeStyle = '#c3c2b0';
    strokePath(ctx, p, 0);
    ctx.strokeStyle = '#e0dccb';
    ctx.lineWidth = Math.max(1, U * 0.4);
    strokePath(ctx, p, -U * 0.5);
    ctx.strokeStyle = '#d9d4c0';
    strokePath(ctx, p, -U * 1.9);
    ctx.fillStyle = '#bdb9a6';
    for (let i = 0; i + 3 < p.length; i += 2) {
      const len = Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]);
      const n = Math.max(1, Math.ceil(len / (U * 2.6)));
      for (let k = 0; k <= n; k++) {
        const x = lerp(p[i], p[i + 2], k / n);
        const y = lerp(p[i + 1], p[i + 3], k / n);
        ctx.fillRect(x - U * 0.3, y - U * 2, U * 0.6, U * 1.5);
        ctx.fillStyle = '#e6e1cd';
        ctx.fillRect(x - U * 0.4, y - U * 2.3, U * 0.8, U * 0.5);
        ctx.fillStyle = '#bdb9a6';
      }
    }
    return c;
  }

  // ---- water ------------------------------------------------------------------

  function paintReflection(g) {
    const h = g.H - g.wy;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, -1, 0, g.wy);
    ctx.drawImage(state.world, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = POND;
    ctx.globalAlpha = VEIL;
    ctx.fillRect(0, 0, g.W, h);
    const p = bridgePath(g);
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = '#17262a';
    ctx.lineWidth = g.U * 1.8;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1] - g.wy + g.U * 1.6);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1] - g.wy + g.U * 1.6);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return c;
  }

  function waveAt(g, y, t, ripple) {
    const d = (y - g.wy) / (g.H - g.wy);
    const k = y / g.U;
    const amp = g.U * (0.08 + 1.3 * d) * ripple;
    return amp * (Math.sin(k * 0.7 + t * 0.7) + 0.5 * Math.sin(k * 1.9 - t * 1.1));
  }

  function drawWater(ctx, g, t, ripple) {
    const src = state.reflection;
    const water = g.H - g.wy;
    ctx.drawImage(src, 0, g.wy);
    let y = 0;
    while (y < water) {
      const h = Math.max(1, Math.round(g.U * lerp(0.5, 2, y / water)));
      const dx = Math.round(waveAt(g, g.wy + y, t, ripple));
      ctx.drawImage(src, 0, y, g.W, h, dx, g.wy + y, g.W, h);
      y += h;
    }
  }

  function makeStreaks(g, rand) {
    const s = { x: new Float32Array(STREAKS), y: new Float32Array(STREAKS), l: new Float32Array(STREAKS), p: new Float32Array(STREAKS) };
    for (let i = 0; i < STREAKS; i++) {
      const d = 0.02 + 0.98 * Math.pow(rand(), 1.4);
      s.x[i] = rand() * g.W;
      s.y[i] = g.wy + d * (g.H - g.wy);
      s.l[i] = g.U * (2 + d * 8) * (0.6 + rand() * 0.8);
      s.p[i] = rand() * TAU;
    }
    return s;
  }

  function drawStreaks(ctx, g, t, ripple) {
    const s = state.streaks;
    const thick = Math.max(1, g.U * 0.4);
    const slide = t * g.U * 0.5;
    const amount = Math.min(1, ripple + 0.2);
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? '#1a2a2c' : '#d8d4be';
      for (let i = pass; i < STREAKS; i += 2) {
        const a = Math.sin(t * 0.5 + s.p[i]);
        if (a <= 0) continue;
        ctx.globalAlpha = a * amount * 0.35;
        const x = ((s.x[i] + slide) % (g.W + s.l[i] * 2)) - s.l[i];
        ctx.fillRect(x, s.y[i], s.l[i], thick);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- lotus ------------------------------------------------------------------

  function lotusLeaf(ctx, x, y, r) {
    ctx.fillStyle = '#4d6c42';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.08, r, r * 0.34, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5b7a4d';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#86a06a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = i * TAU / 7 + 0.3;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.27);
    }
    ctx.stroke();
  }

  function paintLotus(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const U = g.U;
    const spots = [
      [0.9, 14], [0.84, 24], [0.95, 30], [0.76, 33],
      [0.06, 22], [0.14, 32], [0.03, 34], [0.22, 36], [0.47, 35], [0.58, 31],
    ];
    for (const [fx, d] of spots) {
      const r = U * (3 + rand() * 2.5);
      lotusLeaf(ctx, g.W * fx, g.wy + U * d, r);
      if (rand() < 0.4) lotusLeaf(ctx, g.W * fx + r * 1.4, g.wy + U * (d + 1.5), r * 0.7);
    }
    for (const [fx, d] of [[0.9, 14], [0.06, 22], [0.47, 35]]) {
      const x = g.W * fx + U * 2;
      const y = g.wy + U * d;
      ctx.strokeStyle = '#4d6c42';
      ctx.lineWidth = Math.max(1, U * 0.4);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - U * 5);
      ctx.stroke();
      ctx.fillStyle = '#e6c9bd';
      blob(ctx, x, y - U * 6, U * 1.3, U * 1.9);
      ctx.fillStyle = '#c9715f';
      blob(ctx, x, y - U * 7.2, U * 0.8, U * 1.1);
    }
    return c;
  }

  // ---- koi --------------------------------------------------------------------

  function makeKoi(g, rand) {
    const f = () => new Float32Array(MAX_KOI);
    const k = { x: f(), y: f(), a: f(), v: f(), p: f(), len: f() };
    for (let i = 0; i < MAX_KOI; i++) {
      k.x[i] = g.W * (0.15 + rand() * 0.75);
      k.y[i] = g.wy + g.U * (7 + rand() * 28);
      k.a[i] = rand() * TAU;
      k.v[i] = g.U * (2.2 + rand() * 1.6);
      k.p[i] = rand() * TAU;
      k.len[i] = g.U * (6 + rand() * 3.5);
    }
    return k;
  }

  const KOI_PROFILE = [0.2, 0.23, 0.2, 0.15, 0.1, 0.07];

  function stepKoi(g, K2, i, t, dt) {
    const x0 = g.W * 0.1;
    const x1 = g.W * 0.92;
    const y0 = g.wy + g.U * 6;
    const y1 = g.H - g.U * 4;
    let turn = 0.4 * Math.sin(t * 0.3 + K2.p[i]);
    if (K2.x[i] < x0 || K2.x[i] > x1 || K2.y[i] < y0 || K2.y[i] > y1) {
      const cross = Math.cos(K2.a[i]) * ((y0 + y1) / 2 - K2.y[i]) - Math.sin(K2.a[i]) * ((x0 + x1) / 2 - K2.x[i]);
      turn = cross > 0 ? 1.3 : -1.3;
    }
    K2.a[i] += turn * dt;
    K2.x[i] += Math.cos(K2.a[i]) * K2.v[i] * dt;
    K2.y[i] += Math.sin(K2.a[i]) * K2.v[i] * dt * 0.5;
  }

  function drawKoi(ctx, g, t, dt, count) {
    const k = state.koi;
    for (let i = 0; i < count; i++) {
      stepKoi(g, k, i, t, dt);
      const ca = Math.cos(k.a[i]);
      const sa = Math.sin(k.a[i]);
      const rot = Math.atan2(sa * 0.5, ca);
      const color = KOI_INK[i];
      const bright = color !== '#15292b';
      ctx.fillStyle = color;
      ctx.globalAlpha = bright ? 0.72 : 0.4;
      const L = k.len[i];
      for (let s = 0; s < 6; s++) {
        const along = -s * L * 0.17;
        const lat = Math.sin(t * 2.2 + k.p[i] - s * 0.8) * L * 0.07 * (s / 5);
        const px = k.x[i] + along * ca - lat * sa;
        const py = k.y[i] + (along * sa + lat * ca) * 0.5;
        const r = L * KOI_PROFILE[s];
        ctx.beginPath();
        ctx.ellipse(px, py, r * 1.3, r * 0.75, rot, 0, TAU);
        ctx.fill();
      }
      const tl = Math.sin(t * 2.2 + k.p[i] - 4.5) * L * 0.1;
      const tx = k.x[i] - L * 1.05 * ca - tl * sa;
      const ty = k.y[i] + (-L * 1.05 * sa + tl * ca) * 0.5;
      ctx.beginPath();
      ctx.ellipse(tx, ty, L * 0.14, L * 0.07, rot, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- ripples ----------------------------------------------------------------

  function makeRipples() {
    return { x: new Float32Array(RIPPLES), y: new Float32Array(RIPPLES), age: new Float32Array(RIPPLES).fill(99) };
  }

  function drawRipples(ctx, g, dt, ripple) {
    const R = state.ripples;
    ctx.strokeStyle = '#e1ddc9';
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    for (let i = 0; i < RIPPLES; i++) {
      R.age[i] += dt;
      if (R.age[i] > 5 && state.rand() < dt * 0.25) {
        R.age[i] = 0;
        R.x[i] = g.W * (0.1 + state.rand() * 0.8);
        R.y[i] = g.wy + g.U * (6 + state.rand() * 30);
      }
      if (R.age[i] > 4) continue;
      const r = g.U * (0.5 + R.age[i] * 1.8);
      ctx.globalAlpha = 0.5 * (1 - R.age[i] / 4) * Math.min(1, ripple);
      ctx.beginPath();
      ctx.ellipse(R.x[i], R.y[i], r, r * 0.32, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- willow -----------------------------------------------------------------

  function paintLimb(g) {
    const c = layer(g.W, g.H * 0.2);
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#3a2f26';
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      ctx.lineWidth = g.U * (2.2 - k * 0.7);
      ctx.beginPath();
      ctx.moveTo(-g.U * 2, g.H * 0.0 + g.U * (1 + k));
      ctx.quadraticCurveTo(g.W * 0.06, g.H * 0.0, g.W * (0.14 + k * 0.03), g.H * 0.07 + k * g.U);
      ctx.stroke();
    }
    return c;
  }

  function makeStrands(g, rand) {
    const s = { x: new Float32Array(STRANDS), y: new Float32Array(STRANDS), len: new Float32Array(STRANDS), p: new Float32Array(STRANDS) };
    for (let i = 0; i < STRANDS; i++) {
      const f = (i + rand() * 0.8) / STRANDS;
      s.x[i] = g.W * 0.01 + f * g.W * 0.19;
      s.y[i] = g.H * 0.02 + Math.sin(f * 2.2) * g.H * 0.05;
      s.len[i] = g.U * (16 + rand() * 18);
      s.p[i] = rand() * TAU;
    }
    return s;
  }

  function drawWillow(ctx, g, t) {
    ctx.drawImage(state.limb, 0, 0);
    const s = state.strands;
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.lineCap = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? '#a3b784' : '#6f8a4f';
      for (let i = pass; i < STRANDS; i += 2) {
        const sway = Math.sin(t * 0.7 + s.p[i]) * g.U * 2.2;
        ctx.beginPath();
        ctx.moveTo(s.x[i], s.y[i]);
        ctx.quadraticCurveTo(s.x[i] + sway * 0.4, s.y[i] + s.len[i] * 0.5, s.x[i] + sway, s.y[i] + s.len[i]);
        ctx.stroke();
      }
    }
  }

  // ---- mist -------------------------------------------------------------------

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.14);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 14), y / (g.U * 4), 4, 77);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.38, 0.64, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 232;
        img.data[i + 1] = 228;
        img.data[i + 2] = 214;
        img.data[i + 3] = a * 140;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMist(ctx, g, t, mist) {
    if (mist <= 0) return;
    const m = state.mist;
    const w = m.width;
    const a = (t * g.U * 1.0) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.8);
    ctx.drawImage(m, -a, g.H * 0.2);
    ctx.drawImage(m, w - a, g.H * 0.2);
    const b = (t * g.U * 0.6 + w * 0.4) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.45);
    ctx.drawImage(m, b - w, g.wy - g.H * 0.1);
    ctx.drawImage(m, b, g.wy - g.H * 0.1);
    ctx.globalAlpha = 1;
  }

  // ---- run --------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    const h = g.wallBot - g.wallTop;
    const r = h * 0.4;
    const gate = { x: g.W * 0.46, y: g.wallBot - r - g.U * 0.9, r };
    state.g = g;
    state.rand = rand;
    state.world = paintWorld(g, rand, gate);
    state.reflection = paintReflection(g);
    state.bridge = paintBridge(g);
    state.lotus = paintLotus(g, rand);
    state.mist = paintMist(g);
    state.streaks = makeStreaks(g, rand);
    state.koi = makeKoi(g, rand);
    state.ripples = makeRipples();
    state.limb = paintLimb(g);
    state.strands = makeStrands(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { ripple, koi, mist } = api.props;
    const count = Math.min(MAX_KOI, Math.round(4 * koi));
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.world, 0, 0);
    drawMist(ctx, g, t, mist);
    drawWater(ctx, g, t, ripple);
    drawStreaks(ctx, g, t, ripple);
    drawKoi(ctx, g, t, step, count);
    ctx.drawImage(state.lotus, 0, Math.sin(t * 0.6) * g.U * 0.25);
    drawRipples(ctx, g, step, ripple);
    ctx.drawImage(state.bridge, 0, 0);
    drawWillow(ctx, g, t);
  }

  Kasuri.run({
    defaults: { ripple: 1, koi: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
