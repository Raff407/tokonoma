/*
 * 壶口 Hukou — the Yellow River pouring over a stone shelf into a cauldron.
 *
 * Sky, ink hills, river, gorge and loess banks are baked once. The fall is two
 * tiles of vertical streaks that scroll; river dashes slide toward the lip;
 * spray is a short pool of soft puffs; mist is one tiling strip.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const DASHES = 64;
  const FOAM = 30;
  const PUFFS = 36;
  const BIRDS = 3;
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
    const fw = Math.min(W * 0.14, U * 26);
    return { W, H, U, cx: W * 0.5, hy: H * 0.4, ly: H * 0.6, fy: H * 0.88, fw };
  }

  // Half width of the river at y above the lip, and of the gorge below it.
  function bankHalf(g, y) {
    const f = Math.min(1, Math.max(0, (y - g.hy) / (g.ly - g.hy)));
    return lerp(g.W * 0.36, g.fw * 1.25, Math.pow(f, 1.2));
  }

  function wallHalf(g, y) {
    return g.fw * 1.2 + Math.max(0, y - g.ly) * 0.35;
  }

  function edgeHalf(g, y) {
    return y <= g.ly ? bankHalf(g, y) : wallHalf(g, y);
  }

  // ---- sky and ink hills ---------------------------------------------------

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const top = K.parseColor('#e4dac2');
    const low = K.parseColor('#e6cf9c');
    for (let y = 0; y < g.hy + 2; y++) {
      const m = K.mixColor(top, low, Math.pow(Math.min(1, y / g.hy), 1.4));
      ctx.fillStyle = K.toHex(m);
      ctx.fillRect(0, y, g.W, 1);
    }
    ctx.fillStyle = '#ecdcae';
    blob(ctx, g.W * 0.68, g.H * 0.17, g.U * 7, g.U * 7);
    ctx.fillStyle = '#efe3bd';
    blob(ctx, g.W * 0.68, g.H * 0.17, g.U * 4.6, g.U * 4.6);
    ctx.fillStyle = '#d9cdb0';
    for (let i = 0; i < 4; i++) {
      const x = g.W * (0.08 + rand() * 0.84);
      const y = g.H * (0.07 + rand() * 0.12);
      blob(ctx, x, y, g.U * (8 + rand() * 10), g.U * 0.5);
    }
    const ridges = [
      ['#a2a9a4', 0.29, 9, 0.1, 5],
      ['#7f8c8c', 0.34, 11, 0.1, 9],
      ['#5c6d72', 0.385, 14, 0.07, 14],
    ];
    for (const [ink, base, sc, amp, seed] of ridges) {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(0, g.hy + 1);
      for (let x = 0; x <= g.W + 2; x += 2) {
        const peak = Math.abs(fbm(x / (g.U * sc), seed, 4, seed) - 0.5) * 2;
        ctx.lineTo(x, g.H * base - peak * g.H * amp * 1.6);
      }
      ctx.lineTo(g.W + 2, g.hy + 1);
      ctx.fill();
    }
    ctx.fillStyle = '#b79c62';
    ctx.fillRect(0, g.hy - g.U * 0.6, g.W, g.U * 2);
    return c;
  }

  // ---- river, gorge, pool --------------------------------------------------

  function paintRiver(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const far = K.parseColor('#d2ac5a');
    const near = K.parseColor('#a97c2e');
    for (let y = Math.floor(g.hy); y < g.ly; y++) {
      const f = (y - g.hy) / (g.ly - g.hy);
      const half = bankHalf(g, y) + 2;
      const base = K.mixColor(far, near, f);
      for (let x = Math.floor(g.cx - half); x < g.cx + half; x += 2) {
        const n = fbm(x / (g.U * 9), y / (g.U * 1.2), 3, 31);
        const m = K.mixColor(base, n > 0.55 ? K.parseColor('#e0c079') : K.parseColor('#8f6a28'), Math.abs(n - 0.5) * 0.9);
        ctx.fillStyle = K.toHex(m);
        ctx.fillRect(x, y, 2, 1);
      }
    }
    ctx.fillStyle = '#2f2a24';
    ctx.fillRect(0, g.ly, g.W, g.fy - g.ly + 1);
    const deep = ctx.createLinearGradient(0, g.ly, 0, g.fy);
    deep.addColorStop(0, '#2a241f');
    deep.addColorStop(1, '#5c4a2e');
    ctx.fillStyle = deep;
    ctx.fillRect(0, g.ly, g.W, g.fy - g.ly + 1);
    ctx.fillStyle = '#a07426';
    ctx.fillRect(0, g.fy, g.W, g.H - g.fy);
    for (let y = Math.floor(g.fy); y < g.H; y++) {
      for (let x = 0; x < g.W; x += 2) {
        const n = fbm(x / (g.U * 5), y / (g.U * 2), 3, 44);
        if (n > 0.52) {
          ctx.fillStyle = n > 0.62 ? '#d9bd78' : '#bd9444';
          ctx.fillRect(x, y, 2, 1);
        } else if (n < 0.38) {
          ctx.fillStyle = '#7d5a20';
          ctx.fillRect(x, y, 2, 1);
        }
      }
    }
    return c;
  }

  function fallTile(g, rand, count, lightShare, h) {
    const w = Math.ceil(g.fw * 2.3);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    if (lightShare < 1) {
      ctx.fillStyle = '#c29a44';
      ctx.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < count; i++) {
      const x = rand() * w;
      const len = h * (0.15 + rand() * 0.45);
      const y = rand() * h;
      const wd = 1 + Math.floor(rand() * 2.2);
      ctx.fillStyle = rand() < lightShare ? (rand() < 0.5 ? '#efe0b4' : '#e2c679') : '#80601f';
      for (const o of [0, -h]) ctx.fillRect(x, y + o, wd, len);
      if (y + len > h) ctx.fillRect(x, y - h, wd, len);
    }
    return c;
  }

  function paintLip(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ece1bf';
    ctx.fillRect(g.cx - g.fw * 1.15, g.ly - g.U * 0.5, g.fw * 2.3, g.U * 1.1);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const x = g.cx + s * g.fw * (1.1 + i * 0.07 + rand() * 0.08);
        ctx.fillStyle = rand() < 0.5 ? '#4d3f31' : '#6e5a42';
        blob(ctx, x, g.ly + g.U * (rand() * 0.8), g.U * (0.9 + rand() * 0.9), g.U * 0.7);
      }
    }
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = rand() < 0.6 ? '#ece1bf' : '#d4c08a';
      blob(ctx, g.cx + (rand() - 0.5) * g.fw * 2.8, g.fy + g.U * (rand() * 2.4 - 1), g.U * (1.5 + rand() * 3), g.U * (0.6 + rand() * 0.9));
    }
    return c;
  }

  // ---- loess banks, pavilion and pine --------------------------------------

  function bankPath(ctx, g, s) {
    const top = g.hy - g.U * 3;
    ctx.beginPath();
    ctx.moveTo(g.cx + s * (g.W * 0.6), top - g.U);
    ctx.lineTo(g.cx + s * bankHalf(g, g.hy), top);
    for (let y = g.hy; y <= g.H + 2; y += 2) ctx.lineTo(g.cx + s * edgeHalf(g, y), y);
    ctx.lineTo(g.cx + s * g.W * 0.6, g.H + 2);
    ctx.closePath();
  }

  function paintBanks(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const tones = ['#d3b06a', '#c29a52', '#a97f3c', '#8e6a32', '#6f5128'];
    ctx.save();
    bankPath(ctx, g, -1);
    ctx.clip();
    drawStrata(ctx, g, tones, 0);
    ctx.restore();
    ctx.save();
    bankPath(ctx, g, 1);
    ctx.clip();
    drawStrata(ctx, g, tones, 57);
    ctx.restore();
    ctx.strokeStyle = '#3d2f21';
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      for (let y = g.hy; y <= g.H + 2; y += 2) {
        const x = g.cx + s * edgeHalf(g, y);
        if (y === g.hy) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#7d8553';
    for (const s of [-1, 1]) {
      for (let x = 0; x < g.W * 0.2; x += g.U * (1 + rand() * 2)) {
        const px = s < 0 ? x : g.W - x;
        blob(ctx, px, g.hy - g.U * 3 + g.U * 0.2, g.U * (1 + rand() * 1.4), g.U * 0.5);
      }
    }
    pavilion(ctx, g, g.W * 0.085, g.hy - g.U * 3);
    pine(ctx, g, g.W * 0.915, g.hy - g.U * 3, g.U * 19, -1, 7);
    return c;
  }

  function drawStrata(ctx, g, tones, seed) {
    for (let y = Math.floor(g.hy - g.U * 4); y < g.H; y++) {
      const depth = smoothstep(g.ly - g.U * 4, g.ly + g.U * 12, y);
      for (let x = 0; x < g.W; x += 2) {
        const band = Math.floor(y / (g.U * 3.4) + fbm(x / (g.U * 14), y / (g.U * 8), 2, seed + 3) * 1.6);
        const stripe = fbm(x / (g.U * 2.2), y / (g.U * 14), 3, seed + 9);
        let k = (band % 3) + (stripe > 0.55 ? 1 : 0) + (stripe < 0.36 ? 0 : 0);
        k = Math.min(4, Math.max(0, k + Math.round(depth * 1.6)));
        ctx.fillStyle = tones[k];
        ctx.fillRect(x, y, 2, 1);
      }
    }
  }

  function pavilion(ctx, g, x, y) {
    const u = g.U;
    ctx.fillStyle = '#8f8878';
    ctx.fillRect(x - u * 6.5, y - u * 1.4, u * 13, u * 1.4);
    ctx.fillStyle = '#b7ae98';
    ctx.fillRect(x - u * 6.5, y - u * 1.4, u * 13, u * 0.4);
    ctx.fillStyle = '#a53f2b';
    for (const dx of [-5.2, -1.8, 1.8, 5.2]) ctx.fillRect(x + u * dx - u * 0.4, y - u * 7.6, u * 0.8, u * 6.2);
    ctx.fillStyle = '#3c4a58';
    ctx.fillRect(x - u * 5.8, y - u * 8.4, u * 11.6, u * 1);
    ctx.fillStyle = '#d8c690';
    ctx.fillRect(x - u * 4.8, y - u * 7.4, u * 9.6, u * 0.5);
    roof(ctx, u, x, y - u * 8.4, u * 9.5, u * 3.6, u * 2.2);
    ctx.fillStyle = '#3c4a58';
    ctx.fillRect(x - u * 2.2, y - u * 12.4, u * 4.4, u * 0.8);
    roof(ctx, u, x, y - u * 12.4, u * 6.2, u * 3.2, u * 1.9);
    ctx.fillStyle = '#c7a24a';
    ctx.fillRect(x - u * 0.25, y - u * 18.2, u * 0.5, u * 2.2);
    blob(ctx, x, y - u * 18.4, u * 0.7, u * 0.7);
  }

  // A hip roof seen from the front: curved flanks, corners that turn up.
  function roof(ctx, u, x, ye, hw, rh, tip) {
    const top = ye - rh;
    const rw = hw * 0.32;
    ctx.fillStyle = '#4a5963';
    ctx.beginPath();
    ctx.moveTo(x - hw, ye - tip);
    ctx.quadraticCurveTo(x - hw * 0.82, ye + u * 0.5, x - hw * 0.5, ye);
    ctx.lineTo(x + hw * 0.5, ye);
    ctx.quadraticCurveTo(x + hw * 0.82, ye + u * 0.5, x + hw, ye - tip);
    ctx.quadraticCurveTo(x + hw * 0.42, ye - rh * 0.25, x + rw, top);
    ctx.lineTo(x - rw, top);
    ctx.quadraticCurveTo(x - hw * 0.42, ye - rh * 0.25, x - hw, ye - tip);
    ctx.fill();
    ctx.strokeStyle = '#6d7b80';
    ctx.lineWidth = Math.max(1, u * 0.3);
    ctx.beginPath();
    ctx.moveTo(x - rw, top);
    ctx.lineTo(x + rw, top);
    ctx.stroke();
    ctx.fillStyle = '#2f3b44';
    ctx.fillRect(x - rw - u * 0.3, top - u * 0.4, rw * 2 + u * 0.6, u * 0.6);
  }

  // A gnarled pine: bent trunk with flat pads of needles; s mirrors the lean.
  function pine(ctx, g, x, y, h, s, seed) {
    const r = K.rng(seed);
    ctx.strokeStyle = '#3b2e24';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, h * 0.07);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - s * h * 0.35, y - h * 0.35, x + s * h * 0.05, y - h * 0.62);
    ctx.quadraticCurveTo(x + s * h * 0.2, y - h * 0.8, x + s * h * 0.12, y - h * 0.95);
    ctx.stroke();
    const pads = [[0.5, -0.28], [0.68, 0.22], [0.86, -0.12], [0.98, 0.1], [0.6, -0.6]];
    for (const [f, dx] of pads) {
      const px = x + s * h * dx;
      const py = y - h * f;
      const w = h * (0.2 + r() * 0.06);
      ctx.fillStyle = '#2b3d2c';
      blob(ctx, px, py, w, w * 0.36);
      ctx.fillStyle = '#44593a';
      blob(ctx, px - w * 0.1, py - w * 0.14, w * 0.78, w * 0.26);
      ctx.fillStyle = '#6a8049';
      blob(ctx, px - w * 0.3, py - w * 0.22, w * 0.4, w * 0.12);
    }
  }

  // ---- mist and puffs ------------------------------------------------------

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 13), y / (g.U * 4), 4, 77);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.36, 0.62, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 236;
        img.data[i + 1] = 228;
        img.data[i + 2] = 208;
        img.data[i + 3] = a * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintPuff() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const gr = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
    gr.addColorStop(0, 'rgba(240,233,212,0.9)');
    gr.addColorStop(0.6, 'rgba(236,226,200,0.45)');
    gr.addColorStop(1, 'rgba(236,226,200,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  function makeDashes(g, rand) {
    const d = { lane: new Float32Array(DASHES), p: new Float32Array(DASHES), sp: new Float32Array(DASHES), tone: new Float32Array(DASHES) };
    for (let i = 0; i < DASHES; i++) {
      d.lane[i] = rand() * 2 - 1;
      d.p[i] = rand();
      d.sp[i] = 0.7 + rand() * 0.6;
      d.tone[i] = rand();
    }
    const f = { x: new Float32Array(FOAM), y: new Float32Array(FOAM), p: new Float32Array(FOAM), l: new Float32Array(FOAM) };
    for (let i = 0; i < FOAM; i++) {
      f.x[i] = rand() * 2 - 1;
      f.y[i] = g.fy + g.U * 1.5 + rand() * (g.H - g.fy - g.U * 3);
      f.p[i] = rand();
      f.l[i] = g.U * (2 + rand() * 4);
    }
    return { d, f };
  }

  function makePuffs(g, rand) {
    const p = { x: new Float32Array(PUFFS), y: new Float32Array(PUFFS), age: new Float32Array(PUFFS), life: new Float32Array(PUFFS), vy: new Float32Array(PUFFS), vx: new Float32Array(PUFFS), r: new Float32Array(PUFFS) };
    for (let i = 0; i < PUFFS; i++) {
      respawn(g, p, i, rand);
      p.age[i] = rand() * p.life[i];
      p.y[i] -= p.vy[i] * p.age[i];
      p.x[i] += p.vx[i] * p.age[i];
    }
    return p;
  }

  function respawn(g, p, i, rand) {
    p.x[i] = g.cx + (rand() - 0.5) * g.fw * 2.3;
    p.y[i] = g.fy + g.U * (rand() * 3 - 1);
    p.vy[i] = g.U * (2.5 + rand() * 3);
    p.vx[i] = g.U * (rand() - 0.4) * 1.5;
    p.life[i] = 5 + rand() * 4;
    p.age[i] = 0;
    p.r[i] = g.U * (4 + rand() * 4);
  }

  // ---- per frame -----------------------------------------------------------

  function drawFall(ctx, g, t) {
    const x = g.cx - state.tileA.width / 2;
    const h = state.tileA.height;
    const specs = [[state.tileA, g.U * 30, 1], [state.tileB, g.U * 46, 0.55]];
    for (const [tile, speed, alpha] of specs) {
      const off = (t * speed) % h;
      ctx.globalAlpha = alpha;
      ctx.drawImage(tile, 0, h - off, tile.width, off, x, g.ly, tile.width, off);
      ctx.drawImage(tile, 0, 0, tile.width, h - off, x, g.ly + off, tile.width, h - off);
    }
    ctx.globalAlpha = 1;
  }

  function drawDashes(ctx, g, t, dt) {
    const d = state.dashes.d;
    for (let i = 0; i < DASHES; i++) {
      d.p[i] += dt * d.sp[i] * (0.03 + 0.2 * d.p[i] * d.p[i]);
      if (d.p[i] >= 1) {
        d.p[i] = 0;
        d.lane[i] = state.rand() * 2 - 1;
      }
    }
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? '#7a5a22' : '#ecd9a0';
      for (let i = pass; i < DASHES; i += 2) {
        const p = d.p[i];
        const y = g.hy + (g.ly - g.hy) * p;
        const half = bankHalf(g, y) * 0.94;
        const len = g.U * (0.8 + p * 4.5);
        ctx.globalAlpha = (pass ? 0.45 : 0.55) * Math.min(1, p * 6) * (1 - Math.max(0, p - 0.96) * 25);
        ctx.fillRect(g.cx + d.lane[i] * half - len / 2, y, len, Math.max(1, g.U * (0.25 + p * 0.5)));
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawFoam(ctx, g, t) {
    const f = state.dashes.f;
    ctx.fillStyle = '#efe5c4';
    for (let i = 0; i < FOAM; i++) {
      const ph = (f.p[i] + t * 0.12) % 1;
      const a = Math.sin(ph * Math.PI);
      const half = wallHalf(g, f.y[i]) - g.U * 2;
      const x = g.cx + (((f.x[i] + ph * 1.4 * (f.x[i] < 0 ? -1 : 1)) % 1) * half);
      ctx.globalAlpha = a * 0.6;
      ctx.fillRect(x - f.l[i] / 2, f.y[i], f.l[i], Math.max(1, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
  }

  function drawPuffs(ctx, g, dt, amount) {
    if (amount <= 0) return;
    const p = state.puffs;
    const rand = state.rand;
    const n = Math.min(PUFFS, Math.round(PUFFS * Math.min(1, amount * 0.6 + 0.4)));
    for (let i = 0; i < PUFFS; i++) {
      p.age[i] += dt;
      p.y[i] -= p.vy[i] * dt;
      p.x[i] += p.vx[i] * dt;
      if (p.age[i] >= p.life[i]) respawn(g, p, i, rand);
    }
    for (let i = 0; i < n; i++) {
      const k = p.age[i] / p.life[i];
      const r = p.r[i] * (0.6 + k * 1.8);
      ctx.globalAlpha = Math.min(1, amount * 0.7) * Math.sin(k * Math.PI);
      ctx.drawImage(state.puff, p.x[i] - r, p.y[i] - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawMist(ctx, g, t, mist) {
    if (mist <= 0) return;
    const m = state.mist;
    const w = m.width;
    const a = (t * g.U * 1.0) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.7);
    ctx.drawImage(m, -a, g.fy - g.H * 0.2);
    ctx.drawImage(m, w - a, g.fy - g.H * 0.2);
    const b = (t * g.U * 0.55 + w * 0.4) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.35);
    ctx.drawImage(m, b - w, g.hy - g.H * 0.08);
    ctx.drawImage(m, b, g.hy - g.H * 0.08);
    ctx.globalAlpha = 1;
  }

  function drawBirds(ctx, g, t) {
    ctx.strokeStyle = '#3b4448';
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    for (let i = 0; i < BIRDS; i++) {
      const x = g.W + g.U * 4 - ((t * g.U * (1.6 + i * 0.3) + i * g.W * 0.18) % (g.W + g.U * 10));
      const y = g.H * (0.1 + i * 0.045) + Math.sin(t * 0.3 + i) * g.U;
      const w = Math.sin(t * 3 + i * 2) * g.U * 0.7;
      ctx.beginPath();
      ctx.moveTo(x - g.U * 1.6, y + w);
      ctx.lineTo(x, y);
      ctx.lineTo(x + g.U * 1.6, y + w);
      ctx.stroke();
    }
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.river = paintRiver(g);
    state.tileA = fallTile(g, rand, 90, 0.7, Math.ceil(g.fy - g.ly));
    state.tileB = fallTile(g, rand, 40, 1, Math.ceil(g.fy - g.ly));
    state.lip = paintLip(g, rand);
    state.banks = paintBanks(g, rand);
    state.mist = paintMist(g);
    state.puff = paintPuff();
    state.dashes = makeDashes(g, rand);
    state.puffs = makePuffs(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { spray, mist, birds } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.back, 0, 0);
    if (birds) drawBirds(ctx, g, t);
    ctx.drawImage(state.river, 0, 0);
    drawDashes(ctx, g, t, step);
    drawFall(ctx, g, t);
    ctx.drawImage(state.lip, 0, 0);
    drawFoam(ctx, g, t);
    ctx.drawImage(state.banks, 0, 0);
    drawPuffs(ctx, g, step, spray);
    drawMist(ctx, g, t, mist);
  }

  Kasuri.run({
    defaults: { spray: 1, mist: 1, birds: true, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
