/*
 * 銀閣 Ginkaku — the Silver Pavilion on a moonlit night, its sand cone pale beside the pond.
 *
 * Sky, hill, pines, pavilion and the sand garden are baked once. The pond is the baked
 * world flipped and laid back in thin rows that sway sideways. Clouds are one tiling
 * strip drifting across the moon; the moon path is a small pool of glints.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.62;
  const SKY = ['#1a2440', '#24304f', '#30405f', '#405272', '#56667e'];
  const MOON = '#ece4c8';
  const HILL = ['#1c2a30', '#24363a', '#22362e'];
  const PINE = { trunk: '#3a3029', dark: '#1a2a22', mid: '#2e4838', light: '#5a7a62' };
  const SAND = { lit: '#cfccba', mid: '#b4b3a3', rake: '#9c9d92', shade: '#7f8484', deep: '#5e6468', face: '#5a5e60' };
  const PAV = { plaster: '#b4b2a2', post: '#2a2420', roof: '#3a404c', roofLit: '#8a92a0', fascia: '#15171c', wood: '#3a322a', glow: '#c0954c', stone: '#45484c' };
  const WATER_TINT = '#152238';
  const GLINT = '#e6dec0';
  const GLINTS = 30;
  const STRIP_ALPHA = 170;
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
    const u = U * Math.min(1, W / (U * 135));
    const wy = Math.round(H * WATER);
    return { W, H, U, u, wy, moonX: W * 0.17, moonY: H * 0.17, pavX: W * 0.4, coneX: W * 0.8 };
  }

  // ---- sky ------------------------------------------------------------------

  function paintSky(g, rand) {
    const c = layer(g.W, g.wy);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.wy);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.wy; y++) {
      const f = Math.min(1, y / g.wy) * (inks.length - 1);
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
    ctx.fillStyle = '#9aa0ac';
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.3 + rand() * 0.5;
      ctx.fillRect(Math.floor(rand() * g.W), Math.floor(rand() * g.wy * 0.45), 1, 1);
    }
    const r = g.U * 5.5;
    const halo = [[r * 3.4, 0.08], [r * 2.3, 0.12], [r * 1.5, 0.18]];
    ctx.fillStyle = '#8c94a6';
    for (const [hr, a] of halo) {
      ctx.globalAlpha = a;
      blob(ctx, g.moonX, g.moonY, hr, hr);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = MOON;
    blob(ctx, g.moonX, g.moonY, r, r);
    ctx.fillStyle = '#d4ccb0';
    blob(ctx, g.moonX - r * 0.3, g.moonY - r * 0.2, r * 0.28, r * 0.22);
    blob(ctx, g.moonX + r * 0.35, g.moonY + r * 0.3, r * 0.2, r * 0.16);
    return c;
  }

  function paintClouds(g) {
    const w = Math.ceil(g.W * 1.6);
    const h = Math.ceil(g.H * 0.3);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 16), y / (g.U * 3.5), 4, 41);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.42, 0.66, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        const lit = 1 - y / h;
        img.data[i] = 120 + lit * 50;
        img.data[i + 1] = 126 + lit * 48;
        img.data[i + 2] = 146 + lit * 40;
        img.data[i + 3] = a * STRIP_ALPHA;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- hill and pines -------------------------------------------------------

  function ridge(g, x, base, amp, seed) {
    return base - fbm(x / (g.U * 22), 0.5, 3, seed) * amp - Math.exp(-(((x - g.W * 0.7) / (g.W * 0.3)) ** 2)) * amp * 0.5;
  }

  function paintRidge(ctx, g, base, amp, seed, ink) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(0, g.wy);
    for (let x = 0; x <= g.W; x += 1) ctx.lineTo(x, ridge(g, x, base, amp, seed));
    ctx.lineTo(g.W, g.wy);
    ctx.closePath();
    ctx.fill();
  }

  function treeline(ctx, g, rand, base, amp, seed, inks, n) {
    for (let i = 0; i < n; i++) {
      const x = (i / n) * g.W + rand() * g.U * 3;
      const y = ridge(g, x, base, amp, seed);
      const rx = g.U * (2.5 + rand() * 2.5);
      ctx.fillStyle = inks[0];
      blob(ctx, x, y + g.U, rx, rx * 0.7);
      ctx.fillStyle = inks[1];
      blob(ctx, x - rx * 0.2, y + g.U * 0.4, rx * 0.6, rx * 0.35);
    }
  }

  function pine(ctx, g, rand, x, y, h, lean, scale = 1) {
    const u = g.u * scale;
    ctx.strokeStyle = PINE.trunk;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, u * 1.1 * scale);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * h * 0.5, y - h * 0.5, x + lean * h * 0.3, y - h);
    ctx.stroke();
    const tiers = 4;
    for (let k = 0; k < tiers; k++) {
      const f = 0.35 + (k / tiers) * 0.7;
      const px = x + lean * h * (0.5 * f) + (k % 2 ? 1 : -1) * u * 2.5;
      const py = y - h * f;
      const rx = u * (8 - k * 1.3 + rand() * 1.5);
      const ry = u * (2.2 - k * 0.2);
      ctx.fillStyle = PINE.dark;
      blob(ctx, px, py, rx, ry);
      ctx.fillStyle = PINE.mid;
      blob(ctx, px - u * 0.4, py - ry * 0.3, rx * 0.82, ry * 0.6);
      ctx.fillStyle = PINE.light;
      blob(ctx, px - rx * 0.3, py - ry * 0.5, rx * 0.35, ry * 0.28);
    }
  }

  // ---- pavilion -------------------------------------------------------------

  function eave(ctx, cx, y, half, inset, rise, lift) {
    ctx.beginPath();
    ctx.moveTo(cx - half, y - lift);
    ctx.quadraticCurveTo(cx - half * 0.6, y, cx, y);
    ctx.quadraticCurveTo(cx + half * 0.6, y, cx + half, y - lift);
    ctx.lineTo(cx + inset, y - rise);
    ctx.lineTo(cx - inset, y - rise);
    ctx.closePath();
    ctx.fill();
  }

  function eaveLine(ctx, cx, y, half, lift, w) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(cx - half, y - lift);
    ctx.quadraticCurveTo(cx - half * 0.6, y, cx, y);
    ctx.quadraticCurveTo(cx + half * 0.6, y, cx + half, y - lift);
    ctx.stroke();
  }

  function paintPavilion(ctx, g) {
    const u = g.u;
    const cx = g.pavX;
    const base = g.wy - u * 0.3;
    ctx.fillStyle = PAV.stone;
    ctx.fillRect(cx - u * 16, base - u * 1.6, u * 32, u * 1.6);
    // lower hall: plaster between dark posts, one lamp-lit screen
    const y1 = base - u * 1.6;
    const top1 = y1 - u * 9;
    ctx.fillStyle = PAV.plaster;
    ctx.fillRect(cx - u * 13, top1, u * 26, u * 9);
    ctx.fillStyle = PAV.glow;
    ctx.fillRect(cx - u * 4.5, top1 + u * 2.5, u * 4.5, u * 6.5);
    ctx.fillStyle = '#d7b46a';
    ctx.fillRect(cx - u * 3.6, top1 + u * 3.4, u * 2.7, u * 4.6);
    ctx.fillStyle = PAV.post;
    for (let i = 0; i <= 6; i++) ctx.fillRect(cx - u * 13 + i * u * (26 / 6) - u * 0.45, top1, u * 0.9, u * 9);
    ctx.fillRect(cx - u * 13, top1 + u * 2, u * 26, u * 0.6);
    ctx.fillRect(cx - u * 14, y1 - u * 0.8, u * 28, u * 0.8);
    // lower roof
    ctx.fillStyle = PAV.roof;
    eave(ctx, cx, top1 + u * 0.6, u * 19, u * 10, u * 5, u * 1.6);
    ctx.strokeStyle = PAV.fascia;
    eaveLine(ctx, cx, top1 + u * 1.1, u * 19, u * 1.6, u * 0.8);
    ctx.strokeStyle = PAV.roofLit;
    eaveLine(ctx, cx, top1 + u * 0.2, u * 18.5, u * 1.7, Math.max(1, u * 0.5));
    // upper hall: dark wood with bell windows
    const y2 = top1 - u * 4.4;
    const top2 = y2 - u * 6.5;
    ctx.fillStyle = PAV.wood;
    ctx.fillRect(cx - u * 7.5, top2, u * 15, u * 6.5);
    ctx.fillStyle = PAV.post;
    ctx.fillRect(cx - u * 8.5, y2 - u * 0.8, u * 17, u * 0.8);
    ctx.fillStyle = '#6d6656';
    for (const s of [-1, 1]) {
      const wx = cx + s * u * 3.8;
      ctx.beginPath();
      ctx.moveTo(wx - u * 1.6, y2 - u * 1.4);
      ctx.lineTo(wx - u * 1.6, top2 + u * 3);
      ctx.quadraticCurveTo(wx - u * 1.4, top2 + u * 1.2, wx, top2 + u * 1);
      ctx.quadraticCurveTo(wx + u * 1.4, top2 + u * 1.2, wx + u * 1.6, top2 + u * 3);
      ctx.lineTo(wx + u * 1.6, y2 - u * 1.4);
      ctx.closePath();
      ctx.fill();
    }
    // upper roof, pyramidal, finial on top
    ctx.fillStyle = PAV.roof;
    eave(ctx, cx, top2 + u * 0.6, u * 13, u * 0.6, u * 7.5, u * 1.4);
    ctx.strokeStyle = PAV.fascia;
    eaveLine(ctx, cx, top2 + u * 1.1, u * 13, u * 1.4, u * 0.7);
    ctx.strokeStyle = PAV.roofLit;
    eaveLine(ctx, cx, top2 + u * 0.2, u * 12.5, u * 1.5, Math.max(1, u * 0.5));
    ctx.lineWidth = Math.max(1, u * 0.4);
    ctx.beginPath();
    ctx.moveTo(cx - u * 12, top2 - u * 1.1);
    ctx.lineTo(cx - u * 0.6, top2 - u * 6.8);
    ctx.stroke();
    ctx.fillStyle = '#6c6c5e';
    ctx.fillRect(cx - u * 0.4, top2 - u * 9.5, u * 0.8, u * 2.6);
    blob(ctx, cx, top2 - u * 9.8, u * 1.2, u * 0.7);
  }

  function paintWorld(g, rand) {
    const c = layer(g.W, g.wy);
    const ctx = c.getContext('2d');
    paintRidge(ctx, g, g.wy - g.H * 0.2, g.H * 0.12, 7, HILL[0]);
    treeline(ctx, g, rand, g.wy - g.H * 0.2, g.H * 0.12, 7, [HILL[1], '#3a504a'], 40);
    paintRidge(ctx, g, g.wy - g.H * 0.08, g.H * 0.05, 19, HILL[2]);
    treeline(ctx, g, rand, g.wy - g.H * 0.08, g.H * 0.05, 19, ['#22342a', '#3c5644'], 34);
    pine(ctx, g, rand, g.pavX - g.u * 24, g.wy, g.H * 0.3, 0.25);
    pine(ctx, g, rand, g.pavX + g.u * 22, g.wy, g.H * 0.26, -0.2);
    pine(ctx, g, rand, g.W * 0.05, g.wy, g.H * 0.22, 0.3);
    paintPavilion(ctx, g);
    return c;
  }

  // ---- pond -----------------------------------------------------------------

  function paintMirror(g, sky, world) {
    const h = g.H - g.wy;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, -1, 0, g.wy);
    ctx.drawImage(sky, 0, 0);
    ctx.drawImage(world, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = WATER_TINT;
    ctx.fillRect(0, 0, g.W, h);
    ctx.globalAlpha = 1;
    return c;
  }

  function drawWater(ctx, g, t, ripple) {
    const m = state.mirror;
    const h = m.height;
    const amp = g.U * 0.9 * ripple;
    for (let y = 0; y < h; y++) {
      const depth = 0.3 + y / h;
      const dx = Math.sin(t * 1.1 + y * 0.55) * amp * depth + Math.sin(t * 0.47 - y * 0.21) * amp * 0.6;
      ctx.drawImage(m, 0, y, g.W, 1, dx - g.U, g.wy + y, g.W + g.U * 2, 1);
    }
  }

  function makeGlints(g, rand) {
    const n = GLINTS;
    const out = { x: new Float32Array(n), y: new Float32Array(n), len: new Float32Array(n), p: new Float32Array(n), w: new Float32Array(n) };
    const h = g.H - g.wy;
    for (let i = 0; i < n; i++) {
      const f = (i + rand()) / n;
      out.y[i] = Math.round(g.wy + g.U * 1.5 + f * h * 0.75);
      out.x[i] = g.moonX + (rand() - 0.5) * g.U * (3 + f * 9);
      out.len[i] = g.U * (1.5 + f * 4 + rand() * 2);
      out.p[i] = rand() * TAU;
      out.w[i] = 0.8 + rand() * 1.6;
    }
    return out;
  }

  function drawGlints(ctx, g, t, ripple) {
    const G = state.glints;
    ctx.fillStyle = GLINT;
    const sway = Math.min(1, ripple);
    for (let i = 0; i < GLINTS; i++) {
      const k = 0.5 + 0.5 * Math.sin(t * G.w[i] + G.p[i]);
      const len = G.len[i] * (0.25 + 0.75 * k * sway + (1 - sway) * 0.5);
      ctx.globalAlpha = 0.35 + 0.5 * k;
      const dx = Math.sin(t * 0.9 + G.p[i]) * g.U * ripple;
      ctx.fillRect(G.x[i] - len / 2 + dx, G.y[i], len, Math.max(1, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
  }

  // ---- sand garden ----------------------------------------------------------

  function edgeX(g, y) {
    return g.W * 0.6 - (y - g.wy) * 0.9 + Math.sin(y * 0.4) * g.U * 0.4;
  }

  function paintPlatform(ctx, g) {
    const u = g.U;
    const top = g.wy - u * 1;
    const front = g.wy + u * 15;
    ctx.fillStyle = SAND.mid;
    ctx.beginPath();
    ctx.moveTo(edgeX(g, top), top);
    ctx.lineTo(g.W, top);
    ctx.lineTo(g.W, front);
    ctx.lineTo(edgeX(g, front), front);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = SAND.rake;
    ctx.lineWidth = Math.max(1, u * 0.45);
    for (let y = top + u * 1.2; y < front - u * 0.5; y += u * 1.5) {
      ctx.beginPath();
      for (let x = edgeX(g, y); x <= g.W; x += 2) {
        const yy = y + Math.sin(x / (u * 3.5) + y * 0.3) * u * 0.35;
        if (x === edgeX(g, y)) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.fillStyle = SAND.face;
    ctx.beginPath();
    ctx.moveTo(edgeX(g, front), front);
    ctx.lineTo(g.W, front);
    ctx.lineTo(g.W, front + u * 3);
    ctx.lineTo(edgeX(g, front) - u * 1, front + u * 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAV.stone;
    for (let y = top; y < front + u * 3; y += u * 1.6) blob(ctx, edgeX(g, y) - u * 0.6, y, u * 1.2, u * 0.7);
  }

  function paintCone(ctx, g) {
    const u = g.U;
    const cx = g.coneX;
    const baseY = g.wy + u * 9;
    const bw = u * 15;
    const tw = u * 9;
    const topY = baseY - u * 15;
    ctx.fillStyle = 'rgba(30,38,50,0.4)';
    blob(ctx, cx + u * 3, baseY + u * 0.8, bw * 1.1, u * 1.8);
    const shade = ctx.createLinearGradient(cx - bw, 0, cx + bw, 0);
    shade.addColorStop(0, SAND.lit);
    shade.addColorStop(0.45, SAND.mid);
    shade.addColorStop(1, SAND.deep);
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(cx - tw, topY);
    ctx.lineTo(cx + tw, topY);
    ctx.lineTo(cx + bw, baseY);
    ctx.ellipse(cx, baseY, bw, u * 1.3, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#dcd8c4';
    blob(ctx, cx, topY, tw, u * 1.4);
    ctx.strokeStyle = 'rgba(70,76,84,0.3)';
    ctx.lineWidth = Math.max(1, u * 0.35);
    for (let k = 1; k < 5; k++) {
      const y = lerp(topY, baseY, k / 5);
      const hw = lerp(tw, bw, k / 5);
      ctx.beginPath();
      ctx.ellipse(cx, y, hw, u * 1.2, 0, 0.15, Math.PI - 0.15);
      ctx.stroke();
    }
  }

  function paintBank(ctx, g, rand) {
    const u = g.U;
    const y0 = g.H * 0.86;
    ctx.fillStyle = '#1e2c24';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, y0 + fbm(x / (u * 10), 3.3, 3, 5) * u * 6 - Math.max(0, (x - g.W * 0.55) / g.W) * u * 14);
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2e4232';
    for (let i = 0; i < 26; i++) blob(ctx, rand() * g.W, g.H * (0.93 + rand() * 0.07), u * (2 + rand() * 3), u * (0.6 + rand() * 0.6));
    const stones = [[0.3, 0.9, 4], [0.36, 0.92, 2.5], [0.62, 0.86, 3.5], [0.12, 0.93, 3]];
    for (const [sx, sy, r] of stones) {
      ctx.fillStyle = '#3e4246';
      blob(ctx, g.W * sx, g.H * sy, u * r, u * r * 0.55);
      ctx.fillStyle = '#6a6e70';
      blob(ctx, g.W * sx - u * r * 0.3, g.H * sy - u * r * 0.2, u * r * 0.5, u * r * 0.25);
    }
  }

  function paintGarden(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1c2a26';
    ctx.beginPath();
    ctx.moveTo(edgeX(g, g.wy + g.U * 18), g.wy + g.U * 18);
    ctx.lineTo(g.W, g.wy + g.U * 18);
    ctx.lineTo(g.W, g.H);
    ctx.lineTo(edgeX(g, g.H), g.H);
    ctx.closePath();
    ctx.fill();
    paintPlatform(ctx, g);
    paintCone(ctx, g);
    paintBank(ctx, g, rand);
    pine(ctx, g, rand, g.W * 1.01, g.H * 0.8, g.H * 0.6, -0.3, 1.7);
    return c;
  }

  function drawClouds(ctx, g, t, clouds) {
    if (clouds <= 0) return;
    const m = state.clouds;
    const w = m.width;
    const a = (t * g.U * 1.6) % w;
    ctx.globalAlpha = Math.min(1, clouds * 0.8);
    ctx.drawImage(m, -a, g.H * 0.05);
    ctx.drawImage(m, w - a, g.H * 0.05);
    ctx.globalAlpha = 1;
  }

  // ---- run ------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.sky = paintSky(g, rand);
    state.world = paintWorld(g, rand);
    state.clouds = paintClouds(g);
    state.mirror = paintMirror(g, state.sky, state.world);
    state.garden = paintGarden(g, rand);
    state.glints = makeGlints(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { clouds, ripple } = api.props;
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t, clouds);
    ctx.drawImage(state.world, 0, 0);
    drawWater(ctx, g, t, ripple);
    drawGlints(ctx, g, t, ripple);
    ctx.drawImage(state.garden, 0, 0);
  }

  Kasuri.run({
    defaults: { clouds: 1, ripple: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.2, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
