/*
 * 金閣 Kinkaku — the Golden Pavilion across its mirror pond, late on an autumn afternoon.
 *
 * Hill, pavilion, islets and the near maple branch are baked once. The pond is that
 * baked world flipped and laid back in thin rows that slide sideways, with a slow swell
 * passing down through them. Mist is one tiling strip; leaves are a short reused pool.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.58;
  const SKY = ['#7d90a5', '#98a5ad', '#b6b5a7', '#d0c19f', '#e0c896'];
  const TREES = {
    pine: [['#4d5e50', '#5d6e5f', '#728067'], ['#2e4230', '#3e5638', '#5a7246']],
    red: [['#94503e', '#ad654a', '#c27f5a'], ['#8a3022', '#b4442b', '#d6683c']],
    orange: [['#a2724a', '#bb8a58', '#cea26a'], ['#a55a28', '#cc8038', '#e4a650']],
  };
  const GOLD = { lit: '#e6c259', bay: '#c29a3e', side: '#b08c3c', sideBay: '#8e712f', shine: '#f7e09a', shade: '#94742f' };
  const WOOD = { post: '#4a3722', shutter: '#9a7b58', lattice: '#7b6145', dark: '#5a4636', plaster: '#e2d9c0', sidePlaster: '#bdb49c' };
  const ROOF = { slope: '#5a4c40', side: '#41362d', fascia: '#2a221d', under: '#6e5434', line: '#6c5c4c' };
  const PINE_INK = { trunk: '#4a382a', dark: '#2a3d27', mid: '#3f5934', light: '#678448' };
  const PINE_DIM = { trunk: '#30342f', dark: '#26372f', mid: '#2f4436', light: '#3c5240' };
  const LEAF_TONES = ['#d4512f', '#e4843e', '#c4422b', '#e2ad50'];
  const MAX_LEAVES = 40;
  const LEAVES = 20;
  const STREAKS = 70;
  const POND = '#5a7672';
  const VEIL = 0.34;
  const GLINTS = 16;
  const FLOAT_LIFE = 36;
  const REFLECT_INKS = 18;
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
    return { W, H, U, u, wy, cx: W * 0.6, base: wy - u * 1.4 };
  }

  // ---- sky and hill --------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const h = g.wy;
    const img = ctx.createImageData(g.W, h);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const f = Math.min(1, y / (g.H * 0.3)) * (inks.length - 1);
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
    ctx.fillStyle = '#dccaa4';
    for (let i = 0; i < 7; i++) {
      const x = g.W * (0.05 + rand() * 0.9);
      const y = g.H * (0.04 + rand() * 0.1);
      blob(ctx, x, y, g.U * (8 + rand() * 14), g.U * (0.5 + rand() * 0.5));
      blob(ctx, x + g.U * 4, y - g.U * 0.6, g.U * (4 + rand() * 6), g.U * 0.4);
    }
  }

  function ridgeFar(g, x) {
    const peak = Math.exp(-(((x - g.W * 0.18) / (g.W * 0.16)) ** 2)) * g.H * 0.07;
    const dip = Math.exp(-(((x - g.cx) / (g.u * 26)) ** 2)) * g.H * 0.06;
    return g.H * 0.17 + fbm(x / (g.U * 40), 1.3, 4, 11) * g.H * 0.12 - peak + dip;
  }

  function ridgeNear(g, x) {
    return g.H * 0.3 + fbm(x / (g.U * 30), 4.1, 3, 23) * g.H * 0.08;
  }

  function species(g, x, y) {
    let n = fbm(x / (g.U * 16), y / (g.U * 11), 3, 41);
    const near = Math.abs(x - g.cx) / (g.u * 24);
    if (near < 1 && y > g.H * 0.22) n -= 0.3 * (1 - near);
    if (n > 0.6) return 'red';
    if (n > 0.54) return 'orange';
    return 'pine';
  }

  function crown(ctx, x, y, r, inks, pine) {
    const flat = pine ? 0.6 : 0.85;
    ctx.fillStyle = inks[0];
    blob(ctx, x, y, r, r * flat);
    ctx.fillStyle = inks[1];
    blob(ctx, x - r * 0.2, y - r * 0.18, r * 0.72, r * 0.72 * flat);
    ctx.fillStyle = inks[2];
    blob(ctx, x - r * 0.38, y - r * 0.34, r * 0.36, r * 0.36 * flat);
  }

  function crownRows(ctx, g, rand, top, y0, y1, far) {
    for (let y = y0; y < y1; ) {
      const f = (y - g.H * 0.15) / (g.wy - g.H * 0.15);
      const size = g.U * (1 + Math.max(0, f) * 1.5);
      for (let x = -size; x < g.W + size; ) {
        const r = size * (0.75 + rand() * 0.55);
        if (y >= top(g, x) - r * 0.2) {
          const kind = species(g, x, y);
          crown(ctx, x + (rand() - 0.5) * r, y, r, TREES[kind][far ? 0 : 1], kind === 'pine');
        }
        x += r * (1.1 + rand() * 0.5);
      }
      y += size * 0.85;
    }
  }

  function paintHill(ctx, g, rand) {
    ctx.fillStyle = '#5f6e61';
    ctx.beginPath();
    ctx.moveTo(0, g.wy);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, ridgeFar(g, x));
    ctx.lineTo(g.W, g.wy);
    ctx.fill();
    crownRows(ctx, g, rand, ridgeFar, g.H * 0.08, g.H * 0.36, true);
    ctx.fillStyle = '#34473a';
    ctx.beginPath();
    ctx.moveTo(0, g.wy);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, ridgeNear(g, x));
    ctx.lineTo(g.W, g.wy);
    ctx.fill();
    crownRows(ctx, g, rand, ridgeNear, g.H * 0.24, g.wy + g.U, false);
  }

  function maple(ctx, g, rand, x, y, r) {
    const inks = TREES.red[1];
    for (let i = 0; i < 16; i++) {
      const a = Math.PI + rand() * Math.PI;
      const d = Math.sqrt(rand()) * r;
      const kind = rand() < 0.3 ? TREES.orange[1] : inks;
      crown(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, r * (0.32 + rand() * 0.2), kind, false);
    }
  }

  // A pine as a leaning trunk with flat pads of needles; dir -1 draws it upside down.
  function pine(ctx, x, y, h, dir, ink, seed) {
    const r = K.rng(seed);
    const lean = h * (r() - 0.5) * 0.4;
    ctx.strokeStyle = ink.trunk;
    ctx.lineWidth = Math.max(1, h * 0.05);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - lean, y - dir * h * 0.5, x + lean, y - dir * h * 0.92);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const f = 0.45 + i * 0.17;
      const side = i % 2 ? 1 : -1;
      const px = x + lean * (2 * f - 1) * f + side * h * 0.13 * (1 - f * 0.6);
      const py = y - dir * h * f;
      const w = h * (0.29 - f * 0.11);
      ctx.fillStyle = ink.dark;
      blob(ctx, px, py, w, w * 0.42);
      blob(ctx, px + side * w * 0.55, py + dir * w * 0.08, w * 0.55, w * 0.34);
      ctx.fillStyle = ink.mid;
      blob(ctx, px - w * 0.1, py - dir * w * 0.12, w * 0.75, w * 0.28);
      ctx.fillStyle = ink.light;
      blob(ctx, px - w * 0.3, py - dir * w * 0.22, w * 0.42, w * 0.14);
    }
  }

  function paintShore(ctx, g, rand) {
    const u = g.U;
    ctx.fillStyle = '#36412d';
    ctx.fillRect(0, g.wy - u * 1.2, g.W, u * 1.2 + 1);
    const skip0 = g.cx - g.u * 25;
    const skip1 = g.cx + g.u * 31;
    for (let x = 0; x < g.W; x += u * (2 + rand() * 3)) {
      if (x > skip0 && x < skip1) continue;
      const r = u * (1.6 + rand() * 1.6);
      ctx.fillStyle = '#2f4430';
      blob(ctx, x, g.wy - u * 1.1, r, r * 0.55);
      ctx.fillStyle = '#4a6340';
      blob(ctx, x - r * 0.3, g.wy - u * 1.1 - r * 0.25, r * 0.5, r * 0.22);
    }
    for (let x = 0; x < g.W; x += u * (1.5 + rand() * 3)) {
      ctx.fillStyle = rand() < 0.5 ? '#6d695d' : '#8a8474';
      blob(ctx, x, g.wy - u * 0.3, u * (0.6 + rand() * 0.8), u * 0.4);
    }
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.wy + 1);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintHill(ctx, g, rand);
    maple(ctx, g, rand, g.W * 0.3, g.wy - g.U * 3, g.U * 11);
    maple(ctx, g, rand, g.W * 0.94, g.wy - g.U * 3, g.U * 9);
    pine(ctx, g.cx - g.u * 28, g.wy - g.U, g.u * 30, 1, PINE_INK, 5);
    pine(ctx, g.cx + g.u * 34, g.wy - g.U, g.u * 25, 1, PINE_INK, 9);
    pine(ctx, g.W * 0.08, g.wy - g.U, g.U * 20, 1, PINE_INK, 13);
    paintShore(ctx, g, rand);
    return c;
  }

  // ---- the pavilion --------------------------------------------------------

  function posts(ctx, x0, x1, y0, h, bays, w) {
    for (let i = 0; i <= bays; i++) ctx.fillRect(lerp(x0, x1, i / bays) - w / 2, y0, w, h);
  }

  function groundFloor(ctx, g) {
    const u = g.u;
    const x0 = g.cx - u * 18;
    const x1 = g.cx + u * 18;
    const xc = g.cx + u * 8.5;
    const y0 = g.base - u * 9;
    const h = u * 9;
    ctx.fillStyle = WOOD.plaster;
    ctx.fillRect(x0, y0, xc - x0, u * 2.6);
    ctx.fillStyle = WOOD.sidePlaster;
    ctx.fillRect(xc, y0, x1 - xc, u * 2.6);
    ctx.fillStyle = WOOD.shutter;
    ctx.fillRect(x0, y0 + u * 2.6, xc - x0, h - u * 2.6);
    ctx.fillStyle = WOOD.lattice;
    ctx.fillRect(xc, y0 + u * 2.6, x1 - xc, h - u * 2.6);
    ctx.fillStyle = WOOD.dark;
    for (let i = 1; i < 7; i += 2) ctx.fillRect(lerp(x0, xc, i / 7), y0 + u * 3.4, (xc - x0) / 7, h - u * 4.4);
    ctx.fillStyle = WOOD.lattice;
    for (let y = y0 + u * 3.6; y < g.base - u; y += u * 1.3) ctx.fillRect(x0, y, xc - x0, Math.max(1, u * 0.3));
    ctx.fillStyle = WOOD.post;
    posts(ctx, x0, xc, y0, h, 7, Math.max(1, u * 0.7));
    posts(ctx, xc, x1, y0, h, 3, Math.max(1, u * 0.7));
    ctx.fillStyle = '#9c937e';
    ctx.fillRect(x0, y0, x1 - x0, u * 0.9);
    ctx.fillStyle = '#2c231c';
    ctx.fillRect(x0 - u * 1.5, g.base - u * 0.9, x1 - x0 + u * 3, u * 0.9);
  }

  function annex(ctx, g) {
    const u = g.u;
    const x0 = g.cx + u * 18;
    const x1 = g.cx + u * 27.5;
    const y0 = g.base - u * 5.5;
    ctx.fillStyle = WOOD.sidePlaster;
    ctx.fillRect(x0, y0, x1 - x0, u * 1.8);
    ctx.fillStyle = WOOD.dark;
    ctx.fillRect(x0, y0 + u * 1.8, x1 - x0, u * 3.7);
    ctx.fillStyle = WOOD.post;
    posts(ctx, x0, x1, y0, u * 5.5, 3, Math.max(1, u * 0.6));
    ctx.fillStyle = '#2c231c';
    ctx.fillRect(x0, g.base - u * 0.8, x1 - x0 + u, u * 0.8);
    pentRoof(ctx, g, { cx: (x0 + x1) / 2, ye: y0, hw: u * 6, inner: u * 4.2, rise: u * 1.6, fh: u * 0.9, lift: u * 1, hip: x1 });
  }

  function goldFloor(ctx, g, y0, y1, hw, xc, bays) {
    const u = g.u;
    const x0 = g.cx - hw;
    const x1 = g.cx + hw;
    const pw = Math.max(1, u * 0.6);
    ctx.fillStyle = GOLD.lit;
    ctx.fillRect(x0, y0, xc - x0, y1 - y0);
    ctx.fillStyle = GOLD.side;
    ctx.fillRect(xc, y0, x1 - xc, y1 - y0);
    ctx.fillStyle = GOLD.bay;
    posts(ctx, x0, xc, y0, y1 - y0, bays, pw);
    ctx.fillRect(x0, y0 + u * 1.9, xc - x0, pw);
    ctx.fillStyle = GOLD.sideBay;
    posts(ctx, xc, x1, y0, y1 - y0, Math.max(1, Math.round(bays / 2)), pw);
    ctx.fillStyle = GOLD.shade;
    ctx.fillRect(x0, y0, x1 - x0, u * 1.1);
    railing(ctx, g, x0 - u, x1 + u, xc, y1);
    ctx.fillStyle = GOLD.shine;
    ctx.fillRect(xc - pw / 2, y0 + u * 1.1, pw, y1 - y0 - u * 1.1);
  }

  function railing(ctx, g, x0, x1, xc, y1) {
    const u = g.u;
    const t = Math.max(1, u * 0.45);
    ctx.fillStyle = GOLD.bay;
    for (let x = x0; x < x1; x += u * 1.6) ctx.fillRect(x, y1 - u * 2.2, Math.max(1, u * 0.4), u * 1.8);
    ctx.fillStyle = GOLD.shine;
    ctx.fillRect(x0, y1 - u * 2.3, xc - x0, t);
    ctx.fillStyle = GOLD.bay;
    ctx.fillRect(xc, y1 - u * 2.3, x1 - xc, t);
    ctx.fillStyle = '#5a4630';
    ctx.fillRect(x0, y1 - u * 0.6, x1 - x0, u * 0.6);
  }

  function bellWindow(ctx, x, yb, w, h) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2, yb);
    ctx.lineTo(x - w / 2, yb - h * 0.55);
    ctx.quadraticCurveTo(x - w / 2, yb - h * 0.85, x, yb - h);
    ctx.quadraticCurveTo(x + w / 2, yb - h * 0.85, x + w / 2, yb - h * 0.55);
    ctx.lineTo(x + w / 2, yb);
    ctx.closePath();
    ctx.fill();
  }

  function topFloor(ctx, g, y0, y1) {
    const u = g.u;
    const mid = g.cx - u * 2.65;
    goldFloor(ctx, g, y0, y1, u * 9.5, g.cx + u * 4.2, 3);
    ctx.fillStyle = GOLD.shade;
    ctx.fillRect(mid - u * 1.7, y1 - u * 6.4, u * 3.4, u * 4.2);
    ctx.fillStyle = GOLD.bay;
    ctx.fillRect(mid - u * 1.3, y1 - u * 6, u * 1.1, u * 3.8);
    ctx.fillRect(mid + u * 0.2, y1 - u * 6, u * 1.1, u * 3.8);
    for (const x of [mid - u * 4.6, mid + u * 4.6]) {
      ctx.fillStyle = GOLD.shine;
      bellWindow(ctx, x, y1 - u * 2.1, u * 2.4, u * 3.9);
      ctx.fillStyle = '#4a3622';
      bellWindow(ctx, x, y1 - u * 2.4, u * 1.6, u * 3.2);
    }
  }

  function eaveY(r, x) {
    const d = Math.max(0, (Math.abs(x - r.cx) - r.hw * 0.55) / (r.hw * 0.45));
    return r.ye - r.lift * d * d;
  }

  function eaveBands(ctx, g, r) {
    const n = 24;
    const under = [];
    const fascia = [];
    for (let i = 0; i <= n; i++) {
      const x = lerp(r.cx - r.hw, r.cx + r.hw, i / n);
      const taper = 1 - Math.abs(i / n - 0.5) * 2;
      under.push(x, eaveY(r, x) + g.u * 0.9 * Math.sqrt(taper));
      fascia.push(x, eaveY(r, x) - r.fh);
    }
    for (let i = n; i >= 0; i--) {
      const x = lerp(r.cx - r.hw, r.cx + r.hw, i / n);
      under.push(x, eaveY(r, x) - 1);
      fascia.push(x, eaveY(r, x));
    }
    ctx.fillStyle = ROOF.under;
    poly(ctx, under);
    ctx.fillStyle = ROOF.fascia;
    poly(ctx, fascia);
  }

  // A pent roof seen from about level: soffit, fascia, then the slope up to the next wall.
  function pentRoof(ctx, g, r) {
    eaveBands(ctx, g, r);
    const top = r.ye - r.fh - r.rise;
    const slope = [r.cx - r.inner, top];
    const shade = [r.cx + r.inner, top];
    for (let i = 0; i <= 24; i++) {
      const x = lerp(r.cx - r.hw, r.cx + r.hw, i / 24);
      slope.push(x, eaveY(r, x) - r.fh + 0.5);
      if (x >= r.hip) shade.push(x, eaveY(r, x) - r.fh + 0.5);
    }
    slope.push(r.cx + r.inner, top);
    shade.push(r.hip, eaveY(r, r.hip) - r.fh + 0.5);
    ctx.fillStyle = ROOF.slope;
    poly(ctx, slope);
    ctx.fillStyle = ROOF.side;
    poly(ctx, shade);
    ctx.strokeStyle = ROOF.line;
    ctx.lineWidth = Math.max(1, g.u * 0.35);
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const x = lerp(r.cx - lerp(r.hw, r.inner, 0.5), r.cx + lerp(r.hw, r.inner, 0.5), i / 16);
      const y = lerp(eaveY(r, x) - r.fh, top, 0.5);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // The top roof: a hipped pyramid whose flanks sag, flat at the eaves and steep near the ridge.
  function hipRoof(ctx, g, r) {
    eaveBands(ctx, g, r);
    const ridgeY = r.ye - r.fh - r.rise;
    const flank = (x) => {
      const q = (r.hw - Math.abs(x - r.cx)) / (r.hw - r.ridge);
      return eaveY(r, x) - r.fh + 0.5 - r.rise * Math.pow(Math.min(1, Math.max(0, q)), 1.7);
    };
    const roof = [];
    const shade = [r.hip, eaveY(r, r.hip) - r.fh + 0.5];
    for (let i = 0; i <= 20; i++) {
      const x = lerp(r.cx - r.hw, r.cx - r.ridge, i / 20);
      roof.push(x, flank(x));
    }
    for (let i = 0; i <= 20; i++) {
      const x = lerp(r.cx + r.ridge, r.cx + r.hw, i / 20);
      roof.push(x, flank(x));
      shade.push(x, flank(x));
    }
    roof.push(r.cx + r.hw, eaveY(r, r.cx + r.hw) - r.fh + 0.5, r.cx - r.hw, eaveY(r, r.cx - r.hw) - r.fh + 0.5);
    ctx.fillStyle = ROOF.slope;
    poly(ctx, roof);
    ctx.fillStyle = ROOF.side;
    poly(ctx, shade);
    ctx.fillStyle = ROOF.fascia;
    ctx.fillRect(r.cx - r.ridge, ridgeY - g.u * 0.4, r.ridge * 2, g.u * 0.8);
    return ridgeY;
  }

  function phoenix(ctx, g, x, y) {
    const u = g.u;
    ctx.fillStyle = GOLD.bay;
    ctx.fillRect(x - u * 0.3, y - u * 1.6, u * 0.6, u * 1.6);
    ctx.fillStyle = GOLD.lit;
    blob(ctx, x, y - u * 2.2, u * 1.2, u * 0.6);
    ctx.beginPath();
    ctx.moveTo(x + u * 0.6, y - u * 2.4);
    ctx.quadraticCurveTo(x + u * 2, y - u * 2.6, x + u * 2.2, y - u * 4.6);
    ctx.lineTo(x + u * 1.2, y - u * 2.2);
    ctx.fill();
    ctx.fillStyle = GOLD.shine;
    ctx.beginPath();
    ctx.moveTo(x - u * 0.4, y - u * 2.4);
    ctx.lineTo(x + u * 0.5, y - u * 4);
    ctx.lineTo(x + u * 0.7, y - u * 2.5);
    ctx.fill();
    blob(ctx, x - u * 1.2, y - u * 2.9, u * 0.45, u * 0.45);
  }

  function foundation(ctx, g, rand) {
    const u = g.u;
    for (let x = g.cx - u * 20; x < g.cx + u * 29; x += u * (1.4 + rand() * 1.2)) {
      ctx.fillStyle = rand() < 0.5 ? '#6a675d' : '#827d6e';
      blob(ctx, x, g.wy - u * 0.7, u * (0.9 + rand() * 0.6), u * 0.75);
    }
  }

  function paintPavilion(g, rand) {
    const c = layer(g.W, g.wy + 1);
    const ctx = c.getContext('2d');
    const u = g.u;
    const b = g.base;
    foundation(ctx, g, rand);
    groundFloor(ctx, g);
    annex(ctx, g);
    pentRoof(ctx, g, { cx: g.cx, ye: b - u * 9, hw: u * 23.5, inner: u * 15, rise: u * 2.2, fh: u * 1.2, lift: u * 1.7, hip: g.cx + u * 10.5 });
    goldFloor(ctx, g, b - u * 20.4, b - u * 12.4, u * 15, g.cx + u * 7, 5);
    pentRoof(ctx, g, { cx: g.cx, ye: b - u * 20.4, hw: u * 20, inner: u * 9.5, rise: u * 2.2, fh: u * 1.2, lift: u * 1.7, hip: g.cx + u * 8 });
    topFloor(ctx, g, b - u * 30.6, b - u * 23.8);
    const ridge = hipRoof(ctx, g, { cx: g.cx, ye: b - u * 30.6, hw: u * 15.5, ridge: u * 1.2, rise: u * 8.5, fh: u * 1.1, lift: u * 1.9, hip: g.cx + u * 6 });
    phoenix(ctx, g, g.cx, ridge - g.u * 0.4);
    return c;
  }

  // ---- water ---------------------------------------------------------------

  function paintReflection(g) {
    const h = g.H - g.wy;
    const world = layer(g.W, g.wy + 1);
    const wctx = world.getContext('2d');
    wctx.drawImage(state.back, 0, 0);
    wctx.drawImage(state.pavilion, 0, 0);
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, -1, 0, g.wy);
    ctx.drawImage(world, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = POND;
    ctx.globalAlpha = VEIL;
    ctx.fillRect(0, 0, g.W, h);
    ctx.globalAlpha = 1;
    const gold = [GOLD.lit, GOLD.side, GOLD.shine].map((ink) => K.mixColor(K.parseColor(ink), K.parseColor(POND), VEIL));
    snapColours(c, REFLECT_INKS, gold);
    return c;
  }

  // The most used colours in a pixel buffer, found on a coarse grid.
  function commonColours(d, count) {
    const hits = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const key = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
      hits.set(key, (hits.get(key) || 0) + 1);
    }
    const top = [...hits.entries()].sort((p, q) => q[1] - p[1]).slice(0, count);
    return top.map(([key]) => [((key >> 10) << 3) | 4, (((key >> 5) & 31) << 3) | 4, ((key & 31) << 3) | 4]);
  }

  // Snap a baked layer to its own main colours (plus a few kept ones) so the pond stays a small palette.
  function snapColours(c, count, keep) {
    const ctx = c.getContext('2d');
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    const inks = commonColours(d, count).concat(keep);
    for (let i = 0; i < d.length; i += 4) {
      let best = inks[0];
      let gap = Infinity;
      for (const ink of inks) {
        const e = (d[i] - ink[0]) ** 2 + (d[i + 1] - ink[1]) ** 2 + (d[i + 2] - ink[2]) ** 2;
        if (e < gap) {
          gap = e;
          best = ink;
        }
      }
      d[i] = best[0];
      d[i + 1] = best[1];
      d[i + 2] = best[2];
    }
    ctx.putImageData(img, 0, 0);
  }

  function waveAt(g, y, t, ripple) {
    const d = (y - g.wy) / (g.H - g.wy);
    const p = ((t * 0.05) % 1.4) - 0.2;
    const swell = 0.55 + 1.1 * Math.exp(-((d - p) * (d - p)) / 0.012);
    const amp = g.U * (0.1 + 2 * d) * ripple * swell;
    const k = y / g.U;
    return amp * (Math.sin(k * 0.7 + t * 0.8) + 0.5 * Math.sin(k * 1.9 - t * 1.3));
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
      const d = 0.01 + 0.99 * Math.pow(rand(), 1.5);
      s.x[i] = rand() * g.W;
      s.y[i] = g.wy + d * (g.H - g.wy);
      s.l[i] = g.U * (2 + d * 9) * (0.6 + rand() * 0.8);
      s.p[i] = rand() * TAU;
    }
    const gl = { x: new Float32Array(GLINTS), y: new Float32Array(GLINTS), l: new Float32Array(GLINTS), p: new Float32Array(GLINTS) };
    for (let i = 0; i < GLINTS; i++) {
      gl.x[i] = g.cx + (rand() - 0.6) * g.u * 24;
      gl.y[i] = g.wy + g.u * (3 + rand() * 30);
      gl.l[i] = g.U * (1.2 + rand() * 2.4);
      gl.p[i] = rand() * TAU;
    }
    return { s, gl };
  }

  function drawStreaks(ctx, g, t, ripple) {
    const { s, gl } = state.streaks;
    const thick = Math.max(1, g.U * 0.4);
    const slide = t * g.U * (0.3 + ripple * 0.5);
    const amount = Math.min(1, ripple + 0.2);
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? '#1a2a2c' : '#cfc8b2';
      for (let i = pass; i < STREAKS; i += 2) {
        const a = Math.sin(t * 0.5 + s.p[i]);
        if (a <= 0) continue;
        ctx.globalAlpha = a * amount * (pass ? 0.4 : 0.42);
        const x = ((s.x[i] + slide) % (g.W + s.l[i] * 2)) - s.l[i];
        ctx.fillRect(x, s.y[i], s.l[i], thick);
      }
    }
    ctx.fillStyle = '#ecd07a';
    for (let i = 0; i < GLINTS; i++) {
      const a = Math.sin(t * 0.7 + gl.p[i]);
      if (a <= 0) continue;
      ctx.globalAlpha = a * amount * 0.7;
      ctx.fillRect(gl.x[i] + Math.sin(t * 0.4 + gl.p[i]) * g.U * 1.5, gl.y[i], gl.l[i], thick);
    }
    ctx.globalAlpha = 1;
  }

  // ---- islets and the near bank ---------------------------------------------

  function rock(ctx, g, rand, x, y, r) {
    ctx.fillStyle = '#1f2b29';
    blob(ctx, x, y + r * 0.3, r * 1.1, r * 0.3);
    ctx.fillStyle = '#5c5850';
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      const k = r * (0.8 + rand() * 0.35);
      pts.push(x + Math.cos(a) * k, y + Math.sin(a) * k * 0.8);
    }
    poly(ctx, pts);
    ctx.fillStyle = '#9a9282';
    blob(ctx, x - r * 0.3, y - r * 0.45, r * 0.45, r * 0.25);
  }

  function islet(ctx, g, rand, x, y, w, ph, seed) {
    const u = g.U;
    ctx.fillStyle = '#34463e';
    blob(ctx, x, y + w * 0.04, w * 0.48, w * 0.07);
    pine(ctx, x + w * 0.08, y + u * 0.6, ph * 0.9, -1, PINE_DIM, seed);
    ctx.fillStyle = '#5d6c40';
    ctx.beginPath();
    ctx.ellipse(x, y, w / 2, w * 0.16, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = '#82924f';
    blob(ctx, x - w * 0.1, y - w * 0.1, w * 0.3, w * 0.06);
    pine(ctx, x + w * 0.08, y - w * 0.08, ph, 1, PINE_INK, seed);
    ctx.fillStyle = '#1d2824';
    ctx.fillRect(x - w / 2, y, w, Math.max(1, u * 0.5));
    for (let i = 0; i < 4; i++) rock(ctx, g, rand, x + (rand() - 0.5) * w * 0.8, y, u * (0.9 + rand() * 1.1));
  }

  function paintIslets(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    islet(ctx, g, rand, g.W * 0.2, g.H * 0.74, g.U * 30, g.U * 19, 21);
    islet(ctx, g, rand, g.W * 0.9, g.H * 0.665, g.U * 12, g.U * 9, 33);
    rock(ctx, g, rand, g.W * 0.39, g.H * 0.685, g.U * 1.6);
    rock(ctx, g, rand, g.W * 0.425, g.H * 0.692, g.U * 1);
    return c;
  }

  function bezier(p, t) {
    const m = 1 - t;
    return [
      m * m * m * p[0] + 3 * m * m * t * p[2] + 3 * m * t * t * p[4] + t * t * t * p[6],
      m * m * m * p[1] + 3 * m * m * t * p[3] + 3 * m * t * t * p[5] + t * t * t * p[7],
    ];
  }

  // Maple leaves strung along a twig, darker underneath and lit on top, with sky between.
  function leafSpray(ctx, g, rand, tw, n) {
    const spots = [];
    for (let i = 0; i < n; i++) {
      const f = 0.25 + rand() * 0.85;
      const x = lerp(tw[2], tw[0], f) + (rand() - 0.5) * g.U * 3.2;
      const y = lerp(tw[3], tw[1], f) + (rand() - 0.5) * g.U * 2.2 + g.U * 0.5;
      spots.push(x, y, g.U * (0.75 + rand() * 0.55));
    }
    const passes = [['#7a2a1d', 0.3, 1], ['#b4432a', 0, 0.8], ['#d96c3a', -0.25, 0.48], ['#e8a24e', -0.35, 0.22]];
    for (const [ink, off, k] of passes) {
      ctx.fillStyle = ink;
      for (let i = 0; i < spots.length; i += 3) {
        if (k < 0.5 && (i / 3) % 2) continue;
        blob(ctx, spots[i] + off * g.U, spots[i + 1] + off * g.U, spots[i + 2] * k, spots[i + 2] * k * 0.8);
      }
    }
  }

  function paintBranch(ctx, g, rand) {
    const P = [-g.U * 3, g.H * 0.03, g.W * 0.1, g.H * 0.0, g.W * 0.2, g.H * 0.09, g.W * 0.33, g.H * 0.1];
    ctx.strokeStyle = '#2a201b';
    ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      ctx.lineWidth = g.U * (2 - k * 0.6);
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) {
        const [x, y] = bezier(P, lerp(k * 0.3, 1, i / 16));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const twigs = [];
    ctx.lineWidth = Math.max(1, g.U * 0.55);
    for (let i = 0; i < 6; i++) {
      const [x, y] = bezier(P, 0.22 + i * 0.15);
      const tx = x + g.U * (4 + rand() * 5);
      const ty = y + g.U * (2 + rand() * 6) * (i % 2 ? 1 : -0.4);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(lerp(x, tx, 0.6), y, tx, ty);
      ctx.stroke();
      twigs.push([tx, ty, x, y]);
    }
    for (const tw of twigs) leafSpray(ctx, g, rand, tw, 16);
  }

  function paintForeground(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintBranch(ctx, g, rand);
    return c;
  }

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.16);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 14), y / (g.U * 4), 4, 77);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.36, 0.62, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 228;
        img.data[i + 1] = 222;
        img.data[i + 2] = 206;
        img.data[i + 3] = a * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMist(ctx, g, t, mist) {
    const m = state.mist;
    const w = m.width;
    if (mist <= 0) return;
    const a = (t * g.U * 1.1) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.85);
    ctx.drawImage(m, -a, g.H * 0.17);
    ctx.drawImage(m, w - a, g.H * 0.17);
    const b = (t * g.U * 0.6 + w * 0.4) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.3);
    ctx.drawImage(m, b - w, g.H * 0.4);
    ctx.drawImage(m, b, g.H * 0.4);
    ctx.globalAlpha = 1;
  }

  // ---- leaves --------------------------------------------------------------

  function makeLeaves() {
    const f = () => new Float32Array(MAX_LEAVES);
    return { x: f(), y: f(), vx: f(), vy: f(), a: f(), spin: f(), p: f(), size: f(), land: f(), timer: f(), tone: f(), mode: f() };
  }

  function resetLeaf(g, L, i, scatter) {
    const r = state.rand;
    const branch = r() < 0.7;
    L.x[i] = branch ? r() * g.W * 0.38 : g.W * (0.3 + r() * 0.5);
    L.y[i] = branch ? g.H * (0.03 + r() * 0.13) : -g.U * 3;
    L.land[i] = g.H * (0.77 + r() * 0.21);
    L.vy[i] = g.U * (2.4 + r() * 1.6);
    L.vx[i] = g.U * (0.5 + r() * 0.9);
    L.size[i] = g.U * (1.5 + r() * 1);
    L.tone[i] = Math.floor(r() * LEAF_TONES.length);
    L.spin[i] = (r() - 0.5) * 3;
    L.a[i] = r() * TAU;
    L.p[i] = r() * TAU;
    L.mode[i] = 0;
    L.timer[i] = 0;
    if (!scatter) return;
    const k = r();
    if (k < 0.45) L.y[i] = lerp(L.y[i], L.land[i], r());
    else if (k < 0.9) {
      L.mode[i] = 1;
      L.x[i] = r() * g.W;
      L.y[i] = L.land[i];
      L.timer[i] = 4 + r() * (FLOAT_LIFE - 8);
    } else {
      L.mode[i] = 2;
      L.timer[i] = r() * 8;
    }
  }

  function stepLeaf(g, L, i, t, dt) {
    if (L.mode[i] === 0) {
      L.y[i] += L.vy[i] * dt;
      L.x[i] += (L.vx[i] + Math.sin(t * 1.2 + L.p[i]) * g.U * 2.2) * dt;
      L.a[i] += L.spin[i] * dt;
      if (L.y[i] >= L.land[i]) {
        L.mode[i] = 1;
        L.y[i] = L.land[i];
        L.timer[i] = 0;
      }
    } else if (L.mode[i] === 1) {
      L.timer[i] += dt;
      L.x[i] += L.vx[i] * 0.35 * dt;
      L.a[i] += L.spin[i] * 0.04 * dt;
      if (L.timer[i] > FLOAT_LIFE || L.x[i] > g.W + g.U * 3) {
        L.mode[i] = 2;
        L.timer[i] = state.rand() * 6;
      }
    } else {
      L.timer[i] -= dt;
      if (L.timer[i] <= 0) resetLeaf(g, L, i, false);
    }
  }

  function drawFloating(ctx, g, t, count) {
    const L = state.leaves;
    ctx.strokeStyle = '#ddd6bd';
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    for (let i = 0; i < count; i++) {
      if (L.mode[i] !== 1 || L.timer[i] > 4) continue;
      const r = g.U * (0.8 + L.timer[i] * 1.3);
      ctx.globalAlpha = 0.45 * (1 - L.timer[i] / 4);
      ctx.beginPath();
      ctx.ellipse(L.x[i], L.y[i], r, r * 0.3, 0, 0, TAU);
      ctx.stroke();
    }
    for (let i = 0; i < count; i++) {
      if (L.mode[i] !== 1) continue;
      const c = Math.cos(L.a[i]);
      const s = Math.sin(L.a[i]);
      const sz = L.size[i];
      ctx.globalAlpha = Math.min(1, (FLOAT_LIFE - L.timer[i]) / 4);
      ctx.fillStyle = LEAF_TONES[L.tone[i]];
      ctx.setTransform(c, 0.4 * s, -s, 0.4 * c, L.x[i], L.y[i] + Math.sin(t * 0.8 + L.p[i]) * g.U * 0.15);
      ctx.fillRect(-sz / 2, -sz * 0.4, sz, sz * 0.8);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  function drawFalling(ctx, g, t, count) {
    const L = state.leaves;
    for (let i = 0; i < count; i++) {
      if (L.mode[i] !== 0) continue;
      const c = Math.cos(L.a[i]);
      const s = Math.sin(L.a[i]);
      const sq = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.8 + L.p[i]));
      const sz = L.size[i];
      ctx.fillStyle = LEAF_TONES[L.tone[i]];
      ctx.setTransform(c * sq, s * sq, -s, c, L.x[i], L.y[i]);
      ctx.fillRect(-sz / 2, -sz * 0.35, sz, sz * 0.7);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.pavilion = paintPavilion(g, rand);
    state.reflection = paintReflection(g);
    state.islets = paintIslets(g, rand);
    state.front = paintForeground(g, rand);
    state.mist = paintMist(g);
    state.streaks = makeStreaks(g, rand);
    state.leaves = makeLeaves();
    for (let i = 0; i < MAX_LEAVES; i++) resetLeaf(g, state.leaves, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { ripple, leaves, mist } = api.props;
    const count = Math.min(MAX_LEAVES, Math.round(LEAVES * leaves));
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) stepLeaf(g, state.leaves, i, t, step);
    ctx.drawImage(state.back, 0, 0);
    drawMist(ctx, g, t, mist);
    ctx.drawImage(state.pavilion, 0, 0);
    drawWater(ctx, g, t, ripple);
    drawStreaks(ctx, g, t, ripple);
    ctx.drawImage(state.islets, 0, 0);
    drawFloating(ctx, g, t, count);
    ctx.drawImage(state.front, 0, 0);
    drawFalling(ctx, g, t, count);
  }

  Kasuri.run({
    defaults: { ripple: 1, leaves: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
