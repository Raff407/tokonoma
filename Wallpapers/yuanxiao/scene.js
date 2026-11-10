/*
 * 元宵 Yuanxiao — lotus paper lanterns drifting down a river beneath a stone arch bridge.
 *
 * Sky, hills, bank houses, pavilion, pagoda and bridge are baked once. The river is that
 * baked world flipped and laid back in thin rows that slide sideways. Moving parts are a
 * short pool of lanterns with soft glow rings, a cloud strip, one strip of mist and a
 * willow branch that sways a little.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.54;
  const MAX_LANTERNS = 22;
  const BASE_LANTERNS = 11;
  const WALL = '#6f7788';
    const TILE = '#232a3a';
  const TILE_LIT = '#3a4458';
  const PILLAR = '#8a3426';
  const WARM = '#d9a550';
  const MOSS = '#2b4a3c';
  const MOSS_DIM = '#203a30';
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
    return { W, H, U, u, wy, bx: W * 0.5 };
  }

  // ---- sky, moon, hills ----------------------------------------------------

  function paintSky(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.wy);
    grad.addColorStop(0, '#18224a');
    grad.addColorStop(0.55, '#2a3a68');
    grad.addColorStop(1, '#5a6a92');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.wy);
    const mx = g.W * 0.8;
    const my = g.H * 0.17;
    const halo = ctx.createRadialGradient(mx, my, 0, mx, my, g.u * 20);
    halo.addColorStop(0, 'rgba(226,214,184,0.34)');
    halo.addColorStop(1, 'rgba(226,214,184,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - g.u * 20, my - g.u * 20, g.u * 40, g.u * 40);
    ctx.fillStyle = '#e6dcc0';
    blob(ctx, mx, my, g.u * 4.4, g.u * 4.4);
    ctx.fillStyle = '#c9bf9f';
    blob(ctx, mx + g.u * 1.4, my + g.u * 1, g.u * 1.2, g.u * 1.2);
  }

  function ridge(ctx, g, base, amp, seed, color, scale) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, g.wy);
    for (let x = 0; x <= g.W; x += 2) {
      ctx.lineTo(x, base + fbm(x / (g.U * scale), seed, 4, seed * 7) * amp);
    }
    ctx.lineTo(g.W, g.wy);
    ctx.closePath();
    ctx.fill();
  }

  // ---- pagoda, pavilion, houses, willows ----------------------------------

  function eaves(ctx, cx, y, hw, h, lift, body, edge) {
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(cx - hw, y - lift);
    ctx.quadraticCurveTo(cx - hw * 0.55, y + lift * 0.2, cx, y);
    ctx.quadraticCurveTo(cx + hw * 0.55, y + lift * 0.2, cx + hw, y - lift);
    ctx.quadraticCurveTo(cx + hw * 0.55, y - h * 0.55, cx + hw * 0.24, y - h);
    ctx.lineTo(cx - hw * 0.24, y - h);
    ctx.quadraticCurveTo(cx - hw * 0.55, y - h * 0.55, cx - hw, y - lift);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = Math.max(1, hw * 0.05);
    ctx.beginPath();
    ctx.moveTo(cx - hw, y - lift);
    ctx.quadraticCurveTo(cx - hw * 0.55, y + lift * 0.2, cx, y);
    ctx.quadraticCurveTo(cx + hw * 0.55, y + lift * 0.2, cx + hw, y - lift);
    ctx.stroke();
  }

  function paintPagoda(ctx, g, x, base) {
    const u = g.u;
    const tiers = 5;
    let y = base;
    ctx.fillStyle = '#1e2740';
    for (let i = 0; i < tiers; i++) {
      const hw = u * (4.6 - i * 0.7);
      const bodyH = u * 2.4;
      ctx.fillStyle = '#2e3a5e';
      ctx.fillRect(x - hw * 0.6, y - bodyH, hw * 1.2, bodyH);
      ctx.fillStyle = WARM;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x - hw * 0.12, y - bodyH * 0.8, hw * 0.24, bodyH * 0.5);
      ctx.globalAlpha = 1;
      eaves(ctx, x, y - bodyH, hw, u * 1.5, u * 0.7, '#222c4a', '#46547a');
      y -= bodyH + u * 0.8;
    }
    ctx.fillStyle = '#222c4a';
    ctx.fillRect(x - u * 0.15, y - u * 3, u * 0.3, u * 3);
  }

  function paintPavilion(ctx, g, x, base) {
    const u = g.u;
    const w = u * 11;
    ctx.fillStyle = '#3a4152';
    ctx.fillRect(x - w * 0.62, base - u * 1.6, w * 1.24, u * 1.6);
    ctx.fillStyle = '#4a5266';
    ctx.fillRect(x - w * 0.62, base - u * 1.8, w * 1.24, u * 0.35);
    const floor = base - u * 1.8;
    const ph = u * 6;
    const glow = ctx.createLinearGradient(0, floor - ph, 0, floor);
    glow.addColorStop(0, '#a8742f');
    glow.addColorStop(1, '#d9a550');
    ctx.fillStyle = glow;
    ctx.fillRect(x - w * 0.5, floor - ph, w, ph);
    ctx.fillStyle = PILLAR;
    const px = [-0.5, -0.17, 0.17, 0.5];
    for (let i = 0; i < 4; i++) ctx.fillRect(x + w * px[i] - u * 0.3, floor - ph, u * 0.6, ph);
    ctx.fillStyle = '#4c231d';
    ctx.fillRect(x - w * 0.5, floor - ph, w, u * 0.5);
    ctx.fillRect(x - w * 0.5, floor - u * 1.4, w, u * 0.4);
    eaves(ctx, x, floor - ph + u * 0.3, w * 0.78, u * 2.6, u * 1.5, TILE, TILE_LIT);
    eaves(ctx, x, floor - ph - u * 2.1, w * 0.52, u * 2.4, u * 1.3, TILE, TILE_LIT);
    ctx.fillStyle = TILE;
    ctx.fillRect(x - u * 0.2, floor - ph - u * 6.2, u * 0.4, u * 1.8);
    ctx.fillStyle = '#d8584a';
    blob(ctx, x - w * 0.5, floor - ph + u * 2.4, u * 0.8, u * 1);
    blob(ctx, x + w * 0.5, floor - ph + u * 2.4, u * 0.8, u * 1);
  }

  function paintHouse(ctx, g, rand, x, base, w, h) {
    const u = g.u;
    const s = w * 0.17;
    ctx.fillStyle = WALL;
    poly(ctx, [
      x, base, x, base - h * 0.62, x + s, base - h * 0.62, x + s, base - h * 0.8,
      x + s * 2, base - h * 0.8, x + s * 2, base - h, x + w - s * 2, base - h,
      x + w - s * 2, base - h * 0.8, x + w - s, base - h * 0.8, x + w - s, base - h * 0.62,
      x + w, base - h * 0.62, x + w, base,
    ]);
    ctx.fillStyle = TILE;
    ctx.fillRect(x - u * 0.3, base - h * 0.62 - u * 0.5, s + u * 0.6, u * 0.5);
    ctx.fillRect(x + s - u * 0.3, base - h * 0.8 - u * 0.5, s + u * 0.6, u * 0.5);
    ctx.fillRect(x + s * 2 - u * 0.3, base - h - u * 0.5, w - s * 4 + u * 0.6, u * 0.6);
    ctx.fillRect(x + w - s * 2 - u * 0.3, base - h * 0.8 - u * 0.5, s + u * 0.6, u * 0.5);
    ctx.fillRect(x + w - s - u * 0.3, base - h * 0.62 - u * 0.5, s + u * 0.6, u * 0.5);
    const cols = Math.max(1, Math.round(w / (u * 4)));
    for (let i = 0; i < cols; i++) {
      const wx = x + w * ((i + 0.5) / cols);
      ctx.fillStyle = '#2a2f3d';
      ctx.fillRect(wx - u * 0.9, base - h * 0.5, u * 1.8, u * 2.1);
      if (rand() < 0.65) {
        ctx.fillStyle = WARM;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(wx - u * 0.65, base - h * 0.5 + u * 0.25, u * 1.3, u * 1.6);
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = '#2a2f3d';
    ctx.fillRect(x, base - u * 0.6, w, u * 0.6);
  }

  function paintHouses(ctx, g, rand, x0, x1) {
    let x = x0;
    while (x < x1 - g.u * 6) {
      const w = Math.min(x1 - x, g.u * (7 + rand() * 6));
      paintHouse(ctx, g, rand, x, g.wy, w, g.u * (9 + rand() * 4));
      x += w + g.u * (0.4 + rand() * 1.4);
    }
  }

  function paintWillow(ctx, g, rand, x, base, size) {
    ctx.fillStyle = '#1d2530';
    ctx.fillRect(x - size * 0.06, base - size * 0.9, size * 0.12, size * 0.9);
    ctx.fillStyle = MOSS_DIM;
    blob(ctx, x, base - size, size * 0.55, size * 0.3);
    ctx.fillStyle = MOSS;
    blob(ctx, x - size * 0.1, base - size * 1.05, size * 0.38, size * 0.2);
    ctx.strokeStyle = MOSS;
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    const n = Math.round(size / g.U * 2.2);
    for (let i = 0; i < n; i++) {
      const sx = x + (rand() - 0.5) * size * 1.0;
      const len = size * (0.35 + rand() * 0.5);
      ctx.beginPath();
      ctx.moveTo(sx, base - size * 0.95);
      ctx.quadraticCurveTo(sx + (rand() - 0.5) * size * 0.2, base - size * 0.95 + len * 0.5, sx + (rand() - 0.5) * size * 0.1, base - size * 0.95 + len);
      ctx.stroke();
    }
  }

  // ---- bridge --------------------------------------------------------------

  function paintBridge(g) {
    const c = layer(g.W, g.wy + g.u * 2);
    const ctx = c.getContext('2d');
    const u = g.u;
    const half = u * 30;
    const apex = g.wy - u * 19;
    const edge = g.wy - u * 5;
    const deck = (x) => {
      const f = (x - g.bx) / half;
      return edge + (apex - edge) * (1 - f * f);
    };
    ctx.fillStyle = '#434b5e';
    ctx.beginPath();
    ctx.moveTo(g.bx - half, g.wy + u);
    for (let x = g.bx - half; x <= g.bx + half; x += 1) ctx.lineTo(x, deck(x));
    ctx.lineTo(g.bx + half, g.wy + u);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#566078';
    ctx.beginPath();
    for (let x = g.bx - half; x <= g.bx + half; x += 1) ctx.lineTo(x, deck(x) - (x === g.bx - half ? 0 : 0));
    for (let x = g.bx + half; x >= g.bx - half; x -= 1) ctx.lineTo(x, deck(x) + u * 1.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2f3646';
    ctx.lineWidth = Math.max(1, u * 0.3);
    for (let i = -14; i <= 14; i++) {
      const x = g.bx + (i / 14) * half;
      ctx.beginPath();
      ctx.moveTo(x, deck(x) + u * 1.3);
      ctx.lineTo(x, deck(x) + u * 1.3 + u * 1.1);
      ctx.stroke();
    }
    ctx.fillStyle = '#566078';
    for (let i = -10; i <= 10; i++) {
      const x = g.bx + (i / 10) * half;
      ctx.fillRect(x - u * 0.45, deck(x) - u * 1.5, u * 0.9, u * 1.7);
    }
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    const holes = [[0, 13], [-21, 5], [21, 5]];
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(g.bx + holes[i][0] * u, g.wy + u, holes[i][1] * u, Math.PI, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#6a7690';
    ctx.lineWidth = Math.max(1, u * 0.6);
    ctx.beginPath();
    ctx.arc(g.bx, g.wy + u, 13.4 * u, Math.PI, TAU);
    ctx.stroke();
    lampsOnBridge(ctx, g, deck);
    return c;
  }

  function lamp(ctx, x, y, r, u) {
    const gl = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
    gl.addColorStop(0, 'rgba(236,170,86,0.55)');
    gl.addColorStop(1, 'rgba(236,170,86,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
    ctx.fillStyle = '#b8422e';
    blob(ctx, x, y, r * 0.85, r);
    ctx.fillStyle = '#e8944a';
    blob(ctx, x, y, r * 0.5, r * 0.65);
    ctx.fillStyle = '#4a2a1c';
    ctx.fillRect(x - r * 0.3, y - r * 1.25, r * 0.6, r * 0.3);
  }

  function lampsOnBridge(ctx, g, deck) {
    const u = g.u;
    const spots = [-27, -17, 0, 17, 27];
    for (let i = 0; i < spots.length; i++) {
      const x = g.bx + spots[i] * u;
      ctx.fillStyle = '#566078';
      ctx.fillRect(x - u * 0.25, deck(x) - u * 3.2, u * 0.5, u * 2);
      lamp(ctx, x, deck(x) - u * 3.8, u * 1.15, u);
    }
  }

  // ---- baked layers --------------------------------------------------------

  function paintBack(g, rand, bridge) {
    const c = layer(g.W, g.wy);
    const ctx = c.getContext('2d');
    const u = g.u;
    paintSky(ctx, g);
    ridge(ctx, g, g.H * 0.3, g.H * 0.12, 2, '#3a4a76', 38);
    paintPagoda(ctx, g, g.bx + u * 50, g.wy - u * 14);
    ridge(ctx, g, g.H * 0.4, g.H * 0.09, 5, '#2c3a64', 26);
    ctx.fillStyle = '#26324f';
    ctx.fillRect(0, g.wy - u * 3, g.W, u * 3);
    paintHouses(ctx, g, rand, g.bx + u * 33, g.W + u * 4);
    paintHouses(ctx, g, rand, -u * 4, g.bx - u * 54);
    paintPavilion(ctx, g, g.bx - u * 43, g.wy);
    paintWillow(ctx, g, rand, g.bx + u * 36, g.wy, u * 10);
    paintWillow(ctx, g, rand, g.bx - u * 32, g.wy, u * 9);
    paintWillow(ctx, g, rand, g.bx + u * 70, g.wy, u * 11);
    ctx.drawImage(bridge, 0, 0);
    ctx.fillStyle = '#10182c';
    ctx.fillRect(0, g.wy - 1, g.W, 1);
    return c;
  }

  function paintWater(g, back) {
    const hw = g.H - g.wy;
    const pad = Math.ceil(g.U * 1.4);
    const c = layer(g.W + pad * 2, hw);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, hw);
    grad.addColorStop(0, '#16213d');
    grad.addColorStop(1, '#0b1224');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, c.width, hw);
    ctx.globalAlpha = 0.78;
    ctx.save();
    ctx.scale(1, -1);
    const sh = Math.min(g.wy, hw);
    for (let side = -1; side <= 1; side++) {
      ctx.drawImage(back, 0, g.wy - sh, g.W, sh, pad + side * g.W, -sh, g.W, sh);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    const fade = ctx.createLinearGradient(0, 0, 0, hw);
    fade.addColorStop(0, 'rgba(11,18,36,0.1)');
    fade.addColorStop(1, 'rgba(11,18,36,0.85)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, c.width, hw);
    return { c, pad, hw };
  }

  function paintStrip(g, rand) {
    const w = Math.ceil(g.W * 2);
    const h = Math.ceil(g.U * 9);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 26; i++) {
      const x = rand() * w;
      const y = h * (0.3 + rand() * 0.4);
      const rx = g.U * (6 + rand() * 12);
      const gr = ctx.createRadialGradient(x, y, 0, x, y, rx);
      gr.addColorStop(0, 'rgba(150,164,190,0.32)');
      gr.addColorStop(1, 'rgba(150,164,190,0)');
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.22);
      ctx.translate(-x, -y);
      ctx.fillStyle = gr;
      ctx.fillRect(x - rx, y - rx, rx * 2, rx * 2);
      ctx.restore();
    }
    return c;
  }

  function paintClouds(g, rand) {
    const w = Math.ceil(g.W * 2);
    const h = Math.ceil(g.H * 0.3);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(70,84,118,0.55)';
    for (let i = 0; i < 12; i++) {
      const x = rand() * w;
      const y = h * (0.15 + rand() * 0.7);
      blob(ctx, x, y, g.U * (8 + rand() * 14), g.U * (0.6 + rand() * 0.7));
      blob(ctx, x + g.U * 5, y - g.U * 0.7, g.U * (4 + rand() * 6), g.U * 0.5);
    }
    return c;
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H * 0.5);
    const ctx = c.getContext('2d');
    const u = g.u;
    ctx.strokeStyle = '#141b2a';
    ctx.lineWidth = Math.max(1.5, u * 0.9);
    ctx.beginPath();
    ctx.moveTo(g.W * 0.02, -u);
    ctx.quadraticCurveTo(g.W * 0.1, u * 5, g.W * 0.3, u * 8);
    ctx.stroke();
    ctx.strokeStyle = '#1f3a30';
    ctx.lineWidth = Math.max(1, u * 0.45);
    for (let i = 0; i < 46; i++) {
      const f = rand();
      const bx = g.W * (0.02 + f * 0.27);
      const by = u * (-0.5 + f * 8.5) - Math.sin(f * 2.2) * u * 1.2 + u * 0.8;
      const len = u * (6 + rand() * 14);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + (rand() - 0.5) * u * 2, by + len * 0.5, bx + (rand() - 0.5) * u * 1.5, by + len);
      ctx.stroke();
    }
    return c;
  }

  // ---- lantern sprites -----------------------------------------------------

  function petal(ctx, a, len, wid, color) {
    ctx.save();
    ctx.rotate(a);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(wid, -len * 0.55, 0, -len);
    ctx.quadraticCurveTo(-wid, -len * 0.55, 0, 0);
    ctx.fill();
    ctx.restore();
  }

  function paintLotus(size, outer, inner) {
    const c = layer(size, size * 0.62);
    const ctx = c.getContext('2d');
    ctx.translate(size / 2, c.height * 0.52);
    ctx.scale(1, 0.55);
    ctx.fillStyle = 'rgba(8,12,24,0.55)';
    blob(ctx, 0, size * 0.05, size * 0.5, size * 0.42);
    const rings = [
      [8, 0.5, 0.17, outer, 0],
      [8, 0.42, 0.15, inner, TAU / 16],
      [6, 0.3, 0.12, '#e6b25a', 0.2],
      [4, 0.18, 0.09, '#f3d688', 0.5],
    ];
    for (let r = 0; r < rings.length; r++) {
      const [n, len, wid, color, off] = rings[r];
      for (let i = 0; i < n; i++) petal(ctx, off + (i / n) * TAU, size * len, size * wid, color);
    }
    ctx.fillStyle = '#fff0c4';
    blob(ctx, 0, 0, size * 0.07, size * 0.07);
    return c;
  }

  function paintGlow(size) {
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const gr = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gr.addColorStop(0, 'rgba(240,184,92,0.7)');
    gr.addColorStop(0.4, 'rgba(226,150,70,0.26)');
    gr.addColorStop(1, 'rgba(226,150,70,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  function makeLanterns(g, rand) {
    const L = {
      x: new Float32Array(MAX_LANTERNS), d: new Float32Array(MAX_LANTERNS),
      v: new Float32Array(MAX_LANTERNS), p: new Float32Array(MAX_LANTERNS),
      kind: new Uint8Array(MAX_LANTERNS),
    };
    for (let i = 0; i < MAX_LANTERNS; i++) {
      L.x[i] = rand() * (g.W + g.u * 24) - g.u * 12;
      L.d[i] = 0.08 + ((i * 0.618) % 1) * 0.9;
      L.v[i] = g.u * (0.5 + rand() * 0.5);
      L.p[i] = rand() * TAU;
      L.kind[i] = i % 3 === 0 ? 1 : 0;
    }
    return L;
  }

  // ---- per frame -----------------------------------------------------------

  function drawWater(ctx, g, t) {
    const W = state.water;
    const sh = Math.max(2, Math.round(g.U * 0.9));
    for (let y = 0; y < W.hw; y += sh) {
      const f = y / W.hw;
      const amp = g.U * (0.15 + 0.5 * f);
      const off = Math.sin(t * 0.9 + y * 0.31) * amp + Math.sin(t * 0.37 + y * 0.12) * amp;
      ctx.drawImage(W.c, W.pad + off, y, g.W, sh, 0, g.wy + y, g.W, sh);
    }
  }

  function drawStrip(ctx, strip, t, speed, y, alpha, W) {
    const off = (t * speed) % (W);
    ctx.globalAlpha = alpha;
    ctx.drawImage(strip, -off, y);
    ctx.drawImage(strip, W - off, y);
    ctx.globalAlpha = 1;
  }

  function lanternY(g, d) {
    const hw = g.H - g.wy;
    return g.wy + hw * (0.1 + d * 0.8);
  }

  function stepLanterns(g, L, dt, count) {
    for (let i = 0; i < count; i++) {
      L.x[i] += L.v[i] * (0.4 + L.d[i] * 0.8) * dt;
      if (L.x[i] > g.W + g.u * 12) {
        L.x[i] = -g.u * 12;
        L.d[i] = 0.08 + state.rand() * 0.9;
      }
    }
  }

  function drawGlowRings(ctx, g, L, t, count) {
    ctx.strokeStyle = '#d9b46a';
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    for (let i = 0; i < count; i++) {
      const sc = 0.45 + L.d[i] * 0.85;
      const y = lanternY(g, L.d[i]) + Math.sin(t * 0.7 + L.p[i]) * g.U * 0.25;
      for (let k = 0; k < 2; k++) {
        const ph = (t * 0.16 + L.p[i] / TAU + k * 0.5) % 1;
        const r = g.u * 4.5 * sc * (0.5 + ph * 1.5);
        ctx.globalAlpha = 0.38 * (1 - ph) * (1 - ph);
        ctx.beginPath();
        ctx.ellipse(L.x[i], y + g.U * 0.3, r, r * 0.26, 0, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawLanterns(ctx, g, L, t, count) {
    const glowSize = state.glow.width;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < count; i++) {
      const sc = 0.45 + L.d[i] * 0.85;
      const w = g.u * 11 * sc;
      const y = lanternY(g, L.d[i]) + Math.sin(t * 0.7 + L.p[i]) * g.U * 0.25;
      const gw = w * 3.4;
      ctx.globalAlpha = 0.55;
      ctx.drawImage(state.glow, L.x[i] - gw / 2, y - gw * 0.13, gw, gw * 0.26);
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = '#e8b45c';
      for (let k = 0; k < 4; k++) {
        const kw = w * (0.55 - k * 0.1);
        const sx = Math.sin(t * 1.3 + L.p[i] + k * 1.7) * w * 0.07;
        ctx.fillRect(L.x[i] - kw / 2 + sx, y + w * (0.22 + k * 0.1), kw, Math.max(1, g.U * 0.28));
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    for (let i = 0; i < count; i++) {
      const sc = 0.45 + L.d[i] * 0.85;
      const w = g.u * 11 * sc;
      const y = lanternY(g, L.d[i]) + Math.sin(t * 0.7 + L.p[i]) * g.U * 0.25;
      const spr = state.lotus[L.kind[i]];
      const bob = Math.sin(t * 0.5 + L.p[i] * 2) * g.U * 0.12;
      ctx.drawImage(spr, L.x[i] - w / 2, y - w * 0.31 + bob, w, w * (spr.height / spr.width));
    }
    void glowSize;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.bridge = paintBridge(g);
    state.back = paintBack(g, rand, state.bridge);
    state.water = paintWater(g, state.back);
    state.mist = paintStrip(g, rand);
    state.clouds = paintClouds(g, rand);
    state.front = paintFront(g, rand);
    const ls = Math.max(24, Math.ceil(g.u * 11 * 1.3));
    state.lotus = [paintLotus(ls, '#c4533a', '#e9a45c'), paintLotus(ls, '#e1d3b0', '#e8b987')];
    state.glow = paintGlow(Math.max(32, Math.ceil(g.u * 24)));
    state.lanterns = makeLanterns(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { lanterns, ripples, mist } = api.props;
    const count = Math.min(MAX_LANTERNS, Math.round(BASE_LANTERNS * lanterns));
    stepLanterns(g, state.lanterns, Math.min(dt, 0.1), count);
    ctx.drawImage(state.back, 0, 0);
    drawStrip(ctx, state.clouds, t, g.u * 0.5, g.H * 0.04, 0.8, g.W * 2 - g.W);
    drawWater(ctx, g, t);
    if (mist > 0.01) drawStrip(ctx, state.mist, t, g.u * 0.9, g.wy - g.U * 3.5, Math.min(1, mist * 0.7), g.W * 2 - g.W);
    if (ripples) drawGlowRings(ctx, g, state.lanterns, t, count);
    drawLanterns(ctx, g, state.lanterns, t, count);
    const sway = Math.sin(t * 0.45) * 0.012;
    ctx.setTransform(1, 0, sway, 1, 0, 0);
    ctx.drawImage(state.front, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  Kasuri.run({
    defaults: { lanterns: 1, ripples: true, mist: 1, ramp: 'lines', cell: 7, boost: 0.35, gain: 1.6, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
