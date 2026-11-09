/*
 * 羚羊 Kamoshika — a Japanese serow on a rock ledge among beeches in the first snow.
 *
 * Sky, ridges, pagoda and trees are baked once into layers. Mist is a few tiling strips
 * sliding at different speeds between them. The serow body is baked; only its head
 * sways a little, an ear flicks and breath rises. Flakes are a short reused pool.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm } = K;
  const TAU = Math.PI * 2;
  const FLAKES = 120;
  const PUFFS = 4;
  const BANDS = [
    { y: 0.5, h: 0.2, v: 0.9, a: 0.85, seed: 3 },
    { y: 0.62, h: 0.2, v: 1.5, a: 0.8, seed: 7 },
    { y: 0.84, h: 0.2, v: 2.1, a: 0.9, seed: 13 },
  ];
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
    const s = Math.min(U * 1.35, W / 62);
    return { W, H, U, s, gy: Math.round(H * 0.74), sx: W * 0.56 };
  }

  // ---- sky, ridges, pagoda -------------------------------------------------

  function paintSky(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.75);
    grad.addColorStop(0, '#aeb2ac');
    grad.addColorStop(0.5, '#cfcdbf');
    grad.addColorStop(1, '#e4e0ce');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#eadfb8';
    ctx.globalAlpha = 0.55;
    blob(ctx, g.W * 0.8, g.H * 0.2, g.U * 7, g.U * 7);
    ctx.globalAlpha = 0.3;
    blob(ctx, g.W * 0.8, g.H * 0.2, g.U * 12, g.U * 12);
    ctx.globalAlpha = 1;
    return { c, ctx };
  }

  function ridge(ctx, g, base, amp, seed, fill, snowCap) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    const tops = [];
    for (let x = 0; x <= g.W + 3; x += 3) {
      const y = base - fbm(x / (g.U * 38), seed, 4, seed * 5) * amp;
      tops.push(x, y);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    if (snowCap) {
      ctx.strokeStyle = '#e9e7dc';
      ctx.lineWidth = g.U * 0.7;
      ctx.beginPath();
      for (let i = 0; i < tops.length; i += 2) {
        if (i === 0) ctx.moveTo(tops[i], tops[i + 1] + g.U * 0.4);
        else ctx.lineTo(tops[i], tops[i + 1] + g.U * 0.4);
      }
      ctx.stroke();
    }
    return (x) => base - fbm(x / (g.U * 38), seed, 4, seed * 5) * amp;
  }

  function sugi(ctx, x, y, h, ink, snow) {
    ctx.fillStyle = ink;
    for (let i = 0; i < 4; i++) {
      const f = i / 4;
      const w = h * (0.1 + f * 0.17);
      poly(ctx, [x, y - h * (1 - f * 0.78), x - w, y - h * (0.78 - f * 0.78) + 0, x + w, y - h * (0.78 - f * 0.78) + 0]);
    }
    ctx.fillRect(x - h * 0.02, y - h * 0.1, h * 0.04, h * 0.1);
    ctx.fillStyle = snow;
    for (let i = 0; i < 4; i++) {
      const f = i / 4;
      poly(ctx, [x, y - h * (1 - f * 0.78), x - h * 0.05, y - h * (0.93 - f * 0.78), x + h * 0.05, y - h * (0.93 - f * 0.78)]);
    }
  }

  function pagoda(ctx, g, x, y, h) {
    const tiers = 5;
    const th = h / (tiers + 1.2);
    const w0 = h * 0.5;
    for (let i = 0; i < tiers; i++) {
      const f = i / (tiers - 1);
      const w = w0 * (1 - f * 0.45);
      const by = y - i * th;
      ctx.fillStyle = '#8b9695';
      ctx.fillRect(x - w * 0.34, by - th * 0.95, w * 0.68, th * 0.75);
      ctx.fillStyle = '#5c6968';
      poly(ctx, [x - w * 0.62, by - th * 0.2, x - w * 0.36, by - th * 1.05, x + w * 0.36, by - th * 1.05, x + w * 0.62, by - th * 0.2]);
      ctx.fillStyle = '#d9d8cc';
      ctx.fillRect(x - w * 0.5, by - th * 1.07, w, Math.max(0.6, th * 0.1));
    }
    const top = y - tiers * th;
    ctx.fillStyle = '#5c6968';
    ctx.fillRect(x - h * 0.012, top - h * 0.2, h * 0.024, h * 0.2);
    ctx.fillStyle = '#b07a52';
    blob(ctx, x, top - h * 0.14, h * 0.035, h * 0.012);
  }

  function paintBack(g, rand) {
    const base = paintSky(g, rand);
    const ctx = base.ctx;
    ridge(ctx, g, g.H * 0.4, g.H * 0.2, 2, '#b6bab3', true);
    const near = ridge(ctx, g, g.H * 0.5, g.H * 0.12, 5, '#9ca59f', true);
    const px = g.W * 0.22;
    ctx.globalAlpha = 0.9;
    pagoda(ctx, g, px, near(px) + g.U * 1.2, g.H * 0.2);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 14; i++) {
      const x = g.W * (0.05 + rand() * 0.9);
      if (Math.abs(x - px) < g.U * 6) continue;
      sugi(ctx, x, near(x) + g.U * 2, g.U * (7 + rand() * 6), '#6f7d77', '#dcdbd0');
    }
    ridge(ctx, g, g.H * 0.64, g.H * 0.1, 9, '#c9cbc1', false);
    farTrees(ctx, g, rand);
    return base.c;
  }

  // ---- beeches ---------------------------------------------------------------

  function trunk(ctx, x, base, top, w0, w1, lean, ink) {
    ctx.fillStyle = ink;
    poly(ctx, [x - w0 / 2, base, x + lean - w1 / 2, top, x + lean + w1 / 2, top, x + w0 / 2, base]);
  }

  function limb(ctx, x0, y0, x1, y1, w, ink, snow) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 + (y1 - y0) * 0.15, (y0 + y1) / 2, x1, y1);
    ctx.stroke();
    if (snow) {
      ctx.strokeStyle = snow;
      ctx.lineWidth = Math.max(0.6, w * 0.4);
      ctx.beginPath();
      ctx.moveTo(x0, y0 - w * 0.4);
      ctx.quadraticCurveTo((x0 + x1) / 2 + (y1 - y0) * 0.15, (y0 + y1) / 2 - w * 0.4, x1, y1 - w * 0.4);
      ctx.stroke();
    }
  }

  function copper(ctx, x, y, r, rand, n) {
    ctx.fillStyle = '#a77d45';
    for (let i = 0; i < n; i++) {
      ctx.globalAlpha = 0.55 + rand() * 0.35;
      blob(ctx, x + (rand() - 0.5) * r * 2, y + (rand() - 0.5) * r, r * 0.22, r * 0.12);
    }
    ctx.globalAlpha = 1;
  }

  function beech(ctx, g, rand, x, base, top, w, ink, spot, snow, leafy) {
    const lean = (rand() - 0.5) * g.U * 2;
    trunk(ctx, x, base, top, w, w * 0.6, lean, ink);
    ctx.fillStyle = spot;
    for (let i = 0; i < w * 2; i++) {
      const f = rand();
      const y = base + (top - base) * f;
      ctx.fillRect(x + lean * f - w * 0.4 * rand(), y, w * (0.2 + rand() * 0.4), Math.max(0.6, w * 0.15));
    }
    ctx.fillStyle = snow;
    ctx.fillRect(x - w * 0.5, base - w * 0.2, w, w * 0.3);
    const n = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const f = 0.25 + rand() * 0.6;
      const y = base + (top - base) * f;
      const dir = rand() < 0.5 ? -1 : 1;
      const len = (top - base) * -0.2 * (0.6 + rand() * 0.6);
      const ex = x + lean * f + dir * len * 0.8;
      const ey = y - len * 0.7;
      limb(ctx, x + lean * f, y, ex, ey, w * 0.35, ink, snow);
      if (leafy) copper(ctx, ex, ey, w * 3, rand, 6);
    }
  }

  function farTrees(ctx, g, rand) {
    for (let i = 0; i < 16; i++) {
      const x = g.W * (i / 16 + rand() * 0.04);
      beech(ctx, g, rand, x, g.H * (0.56 + rand() * 0.03), g.H * (0.16 + rand() * 0.1), g.U * 0.9, '#b3b4aa', '#9da097', '#e8e6dc', false);
    }
  }

  function paintMid(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#cdcec3';
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.7);
    for (let x = 0; x <= g.W + 4; x += 4) ctx.lineTo(x, g.H * 0.66 + fbm(x / (g.U * 30), 3, 3, 31) * g.H * 0.05);
    ctx.lineTo(g.W, g.H);
    ctx.lineTo(0, g.H);
    ctx.fill();
    for (let i = 0; i < 9; i++) {
      const x = g.W * (i / 9 + 0.03 + rand() * 0.07);
      beech(ctx, g, rand, x, g.H * (0.68 + rand() * 0.02), g.H * (0.02 + rand() * 0.1), g.U * (1.8 + rand() * 0.8), '#8f9189', '#6f716b', '#f0eee4', true);
    }
    return c;
  }

  // ---- ledge ---------------------------------------------------------------

  function paintLedge(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const x0 = g.W * 0.26;
    const x1 = g.W * 0.9;
    const edge = (x) => g.gy + Math.sin(x / (g.U * 5)) * g.U * 0.5 + fbm(x / (g.U * 9), 8, 3, 77) * g.U * 1.6;
    ctx.fillStyle = '#d6d4c8';
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.8);
    ctx.lineTo(0, g.gy + g.U * 3);
    for (let x = 0; x <= x0; x += 4) ctx.lineTo(x, g.gy + g.U * 3 - (x / x0) * g.U * 3);
    ctx.lineTo(x0, g.H);
    ctx.fill();
    ctx.fillStyle = '#464847';
    ctx.beginPath();
    ctx.moveTo(x0, g.gy + g.U * 0.5);
    for (let x = x0; x <= x1; x += 3) ctx.lineTo(x, edge(x));
    const rx = x1 + g.U * 2;
    ctx.lineTo(rx, g.H);
    ctx.lineTo(x0 - g.U * 4, g.H);
    ctx.lineTo(x0 - g.U * 2, g.gy + g.U * 7);
    ctx.fill();
    ctx.fillStyle = '#5b5d59';
    for (let i = 0; i < 24; i++) {
      const x = x0 + rand() * (x1 - x0);
      const y = g.gy + g.U * (3 + rand() * 20);
      poly(ctx, [x, y, x + g.U * (1 + rand() * 3), y + g.U * (0.5 + rand()), x + g.U * rand() * 2, y + g.U * (3 + rand() * 5)]);
    }
    ctx.strokeStyle = '#2f3130';
    ctx.lineWidth = Math.max(0.7, g.U * 0.35);
    for (let i = 0; i < 9; i++) {
      const x = x0 + rand() * (x1 - x0);
      const y = g.gy + g.U * (4 + rand() * 12);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * g.U * 3, y + g.U * (3 + rand() * 5));
      ctx.stroke();
    }
    ctx.fillStyle = '#ecebe2';
    ctx.beginPath();
    ctx.moveTo(x0, g.gy + g.U * 1);
    for (let x = x0; x <= x1; x += 3) ctx.lineTo(x, edge(x) - g.U * (0.6 + fbm(x / (g.U * 4), 2, 2, 5) * 1.6));
    for (let x = x1; x >= x0; x -= 3) ctx.lineTo(x, edge(x) + g.U * (0.7 + fbm(x / (g.U * 3), 6, 2, 9) * 2.2));
    ctx.fill();
    ctx.fillStyle = '#b9bcb8';
    for (let x = x0 + 4; x < x1; x += 7 + rand() * 9) {
      ctx.fillRect(x, edge(x) + g.U * 2.2, Math.max(1, g.U * 0.35), g.U * (1 + rand() * 2.5));
    }
    nanten(ctx, g, rand, g.W * 0.33, g.gy - g.U * 0.5);
    return c;
  }

  function nanten(ctx, g, rand, x, y) {
    const u = g.U;
    ctx.strokeStyle = '#4a3a2c';
    ctx.lineWidth = Math.max(0.8, u * 0.3);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * u * 0.5, y);
      ctx.lineTo(x + (i - 1.5) * u * 1.2, y - u * (6 + i));
      ctx.stroke();
    }
    ctx.fillStyle = '#3f5a40';
    for (let i = 0; i < 12; i++) {
      const lx = x + (rand() - 0.5) * u * 7;
      const ly = y - u * (3 + rand() * 7);
      poly(ctx, [lx, ly, lx + u * 1.6, ly - u * 0.4, lx + u * 0.4, ly + u * 0.9]);
    }
    ctx.fillStyle = '#e9e8de';
    for (let i = 0; i < 4; i++) blob(ctx, x + (rand() - 0.5) * u * 6, y - u * (3 + rand() * 6), u * 1.1, u * 0.3);
    ctx.fillStyle = '#c4432c';
    for (let i = 0; i < 9; i++) {
      blob(ctx, x + (rand() - 0.5) * u * 3 - u * 0.5, y - u * (8 + rand() * 3.5), u * 0.6, u * 0.6);
    }
    ctx.fillStyle = '#e9e8de';
    ctx.fillRect(x - u * 3, y - u * 0.4, u * 6, u * 0.9);
  }

  // ---- serow ---------------------------------------------------------------

  const FUR = '#3a3733';
  const FUR_HI = '#58504a';
  const BELLY = '#6c645a';
  const LEG = '#8e8576';
  const THROAT = '#dcd6c4';

  function paintBody(g) {
    const s = g.s;
    const c = layer(40 * s, 22 * s);
    const ctx = c.getContext('2d');
    ctx.translate(26 * s, 20 * s);
    ctx.scale(s, s);
    // far legs
    ctx.fillStyle = '#2d2b28';
    poly(ctx, [-5, -9, -3, -9, -3.4, -2.5, -3.2, 0, -5.2, 0, -5, -2.5]);
    poly(ctx, [7, -10, 9.5, -10, 8.8, -2.5, 8.7, 0, 6.8, 0, 7, -3]);
    // body
    ctx.fillStyle = FUR;
    poly(ctx, [-9.5, -14, -7, -16.6, -3, -17.6, 3, -17.8, 8, -17, 11.6, -14.6, 13.2, -11.2, 12.4, -8.8, 7, -7.8, -1, -8.2, -6, -8.4, -9.8, -9.6, -10.6, -12]);
    ctx.fillStyle = BELLY;
    poly(ctx, [-6, -8.8, -1, -8.6, 7, -8, 11.8, -8.7, 11, -10, 4, -10, -2, -10.5, -6, -10.5]);
    ctx.fillStyle = FUR_HI;
    poly(ctx, [-6, -16.5, 0, -17.4, 7, -17, 11, -15.4, 6, -15.8, -1, -16.4]);
    // near legs
    ctx.fillStyle = FUR;
    poly(ctx, [-8.4, -11, -5.2, -11, -5.4, -4, -5.5, -2, -5.4, 0, -7.8, 0, -7.9, -3, -8.4, -6]);
    poly(ctx, [6, -12, 11, -12, 10.2, -5, 10, -2.5, 9.9, 0, 7.8, 0, 7.6, -3, 6.2, -6]);
    ctx.fillStyle = LEG;
    poly(ctx, [-7.9, -3.4, -5.5, -3.4, -5.4, 0, -7.8, 0]);
    poly(ctx, [7.7, -3.6, 10, -3.6, 9.9, 0, 7.8, 0]);
    ctx.fillStyle = '#26241f';
    ctx.fillRect(-7.9, -0.7, 2.5, 0.7);
    ctx.fillRect(7.7, -0.7, 2.3, 0.7);
    // tail
    ctx.fillStyle = FUR;
    poly(ctx, [12.4, -15, 14, -14, 13.8, -11.4, 12.8, -12]);
    // shaggy back
    ctx.strokeStyle = FUR_HI;
    ctx.lineWidth = 0.4;
    for (let i = 0; i < 14; i++) {
      const x = -7 + i * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, -16.6 + Math.sin(i) * 0.3);
      ctx.lineTo(x + 0.6, -14.2);
      ctx.stroke();
    }
    // snow dust on the back
    ctx.fillStyle = '#e9e8de';
    poly(ctx, [-4, -17.1, 1, -17.9, 7, -17.3, 10.5, -15.8, 6, -16.6, 0, -17, -3, -16.6]);
    return c;
  }

  function paintHead(g) {
    const s = g.s;
    const c = layer(20 * s, 20 * s);
    const ctx = c.getContext('2d');
    ctx.translate(14 * s, 12 * s);
    ctx.scale(s, s);
    ctx.fillStyle = FUR;
    poly(ctx, [7, 7.5, 7.5, 1, 3, -5.2, -2.8, -6.6, -5.5, -6.1, -8.8, -3.7, -10.4, -1.7, -10.3, -0.3, -8.6, 0.3, -5.2, 2.2, -3.6, 4.6, -4.2, 7.5]);
    ctx.fillStyle = THROAT;
    poly(ctx, [-3.4, 4.6, -3.2, 3.2, -5.2, 2, -7.6, 0.8, -6.2, 2.8, -4.8, 4.8]);
    ctx.fillStyle = FUR_HI;
    poly(ctx, [-2.8, -6.4, -5.4, -5.9, -8.6, -3.5, -6, -4.2, -3.4, -5.2]);
    ctx.fillStyle = '#25231f';
    blob(ctx, -9.6, -1.6, 0.9, 0.7);
    ctx.fillStyle = '#17150f';
    blob(ctx, -5.8, -2.8, 0.45, 0.4);
    ctx.strokeStyle = '#1b1915';
    ctx.lineWidth = 0.95;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-3.6, -6.2);
    ctx.quadraticCurveTo(-2.4, -9.6, 1.2, -9.8);
    ctx.stroke();
    ctx.fillStyle = '#e9e8de';
    blob(ctx, -3.6, -6.9, 1.1, 0.4);
    return c;
  }

  function drawEar(ctx, s, flick) {
    ctx.fillStyle = FUR;
    ctx.save();
    ctx.rotate(flick * 0.5);
    poly(ctx, [-0.8, -5.2, 3.4, -7.6, 1.4, -3.8]);
    ctx.fillStyle = BELLY;
    poly(ctx, [0.2, -5, 2.4, -6.4, 1.2, -4.2]);
    ctx.restore();
  }

  // ---- mist, flakes, front ---------------------------------------------------

  function paintMist(g, band, rand) {
    const h = Math.ceil(g.H * band.h);
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    const n = Math.ceil(g.W / (g.U * 5));
    for (let i = 0; i < n; i++) {
      const x = rand() * g.W;
      const y = h * (0.3 + rand() * 0.4);
      const rx = g.U * (6 + rand() * 12);
      const ry = h * (0.12 + rand() * 0.2);
      ctx.fillStyle = rand() < 0.3 ? '#efe9d6' : '#e3e3da';
      ctx.globalAlpha = 0.22 + rand() * 0.2;
      for (const o of [-g.W, 0, g.W]) blob(ctx, x + o, y, rx, ry);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const ink = '#4f524d';
    const spot = '#363934';
    const snow = '#f0eee4';
    beech(ctx, g, rand, g.W * 0.05, g.H * 1.02, g.H * -0.1, g.U * 6, ink, spot, snow, true);
    beech(ctx, g, rand, g.W * 0.97, g.H * 1.02, g.H * -0.1, g.U * 5, ink, spot, snow, true);
    limb(ctx, g.W * 0.03, g.H * 0.3, g.W * 0.3, g.H * 0.06, g.U * 1.6, ink, snow);
    limb(ctx, g.W * 0.18, g.H * 0.17, g.W * 0.34, g.H * 0.17, g.U * 0.8, ink, snow);
    copper(ctx, g.W * 0.3, g.H * 0.07, g.U * 5, rand, 14);
    copper(ctx, g.W * 0.34, g.H * 0.17, g.U * 4, rand, 8);
    limb(ctx, g.W * 0.99, g.H * 0.22, g.W * 0.78, g.H * 0.05, g.U * 1.3, ink, snow);
    copper(ctx, g.W * 0.8, g.H * 0.07, g.U * 4, rand, 10);
    return c;
  }

  function makeFlakes(g, rand) {
    const f = { x: new Float32Array(FLAKES), y: new Float32Array(FLAKES), v: new Float32Array(FLAKES), p: new Float32Array(FLAKES), z: new Float32Array(FLAKES) };
    for (let i = 0; i < FLAKES; i++) {
      f.x[i] = rand() * g.W;
      f.y[i] = rand() * g.H;
      f.v[i] = 0.7 + rand() * 0.9;
      f.p[i] = rand() * TAU;
      f.z[i] = rand() < 0.25 ? 1.7 : 1;
    }
    return f;
  }

  function drawFlakes(ctx, g, t, dt, count) {
    const f = state.flakes;
    ctx.fillStyle = '#fbfaf2';
    for (let i = 0; i < count; i++) {
      f.y[i] += f.v[i] * g.U * 2.4 * dt;
      f.x[i] += (Math.sin(t * 0.6 + f.p[i]) * 0.8 - 0.6) * g.U * 0.9 * dt;
      if (f.y[i] > g.H + 2) f.y[i] = -2;
      if (f.x[i] < -2) f.x[i] = g.W + 2;
      ctx.globalAlpha = f.z[i] > 1 ? 0.95 : 0.75;
      ctx.fillRect(f.x[i], f.y[i], f.z[i], f.z[i]);
    }
    ctx.globalAlpha = 1;
  }

  function drawBand(ctx, g, i, t, amount) {
    const b = BANDS[i];
    const w = g.W;
    const ox = -((t * b.v * g.U * 0.5) % w);
    const y = g.H * b.y + Math.sin(t * 0.15 + i) * g.U * 0.6;
    ctx.globalAlpha = Math.min(1, b.a * amount);
    ctx.drawImage(state.bands[i], ox, y);
    ctx.drawImage(state.bands[i], ox + w, y);
    ctx.globalAlpha = 1;
  }

  function drawSerow(ctx, g, t, breath) {
    const s = g.s;
    const bx = g.sx;
    const by = g.gy + g.U * 0.4;
    const rise = Math.sin(t * 1.1) * 0.12 * breath;
    ctx.drawImage(state.body, bx - 26 * s, by - 20 * s + rise * s * 0.3);
    const pivx = bx - 9 * s;
    const pivy = by - 15 * s + rise * s;
    const sway = Math.sin(t * 0.35) * 0.05 + Math.sin(t * 0.9) * 0.02;
    ctx.save();
    ctx.translate(pivx, pivy);
    ctx.rotate(sway);
    ctx.drawImage(state.head, -14 * s, -12 * s);
    const phase = (t % 7) / 7;
    const flick = phase < 0.06 ? Math.sin((phase / 0.06) * TAU) : 0;
    ctx.scale(s, s);
    drawEar(ctx, s, flick);
    ctx.restore();
    const nx = pivx - 10.3 * s * Math.cos(sway);
    const ny = pivy - 1.4 * s - 10.3 * s * Math.sin(sway);
    ctx.fillStyle = '#f2f0e6';
    for (let i = 0; i < PUFFS; i++) {
      const ph = ((t * 0.22 + i / PUFFS) % 1);
      const on = Math.sin(t * 0.45) > -0.1 ? 1 : 0.4;
      ctx.globalAlpha = 0.5 * (1 - ph) * Math.min(1, breath) * on;
      blob(ctx, nx - ph * g.U * 5, ny - ph * g.U * 3, g.U * (0.5 + ph * 1.6), g.U * (0.4 + ph));
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.mid = paintMid(g, rand);
    state.ledge = paintLedge(g, rand);
    state.front = paintFront(g, rand);
    state.body = paintBody(g);
    state.head = paintHead(g);
    state.bands = BANDS.map((b) => paintMist(g, b, K.rng(b.seed * 31 + api.seed)));
    state.flakes = makeFlakes(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { snow, mist, breath } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawBand(ctx, g, 0, t, mist);
    ctx.drawImage(state.mid, 0, 0);
    drawBand(ctx, g, 1, t, mist);
    ctx.drawImage(state.ledge, 0, 0);
    drawSerow(ctx, g, t, breath);
    drawBand(ctx, g, 2, t, mist);
    ctx.drawImage(state.front, 0, 0);
    drawFlakes(ctx, g, t, Math.min(dt, 0.1), Math.min(FLAKES, Math.round(60 * snow)));
  }

  Kasuri.run({
    defaults: { snow: 1, mist: 1, breath: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
