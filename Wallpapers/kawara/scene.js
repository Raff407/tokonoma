/*
 * 瓦 Kawara — a grey tiled temple roof in steady rain.
 *
 * Sky, hills, pines, hall, roof and courtyard are baked once. Rain is a short pool of
 * slanted strokes, eave drips fall from the tile ends, a rain chain trickles, and
 * rings open on the puddles and where the drips land.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const RAIN_MAX = 110;
  const DRIP_MAX = 40;
  const RING_MAX = 26;
  const CHAIN_DOTS = 7;
  const SLANT = 0.14;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function h2(a, b) {
    const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return n - Math.floor(n);
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
    const cx = W * 0.5;
    const half = Math.min(W * 0.37, H * 0.8);
    return {
      W, H, U, cx, half,
      ry: H * 0.17, ey: H * 0.46, lift: H * 0.05,
      rx0: cx - half * 0.4, rx1: cx + half * 0.4,
      ex0: cx - half, ex1: cx + half,
      wallBot: H * 0.74, ground: H * 0.78,
    };
  }

  function eaveY(g, x) {
    const d = Math.min(1.2, Math.abs(x - g.cx) / g.half);
    return g.ey - g.lift * d * d * d;
  }

  // ---- sky, hills, pines ---------------------------------------------------

  function paintSky(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.6);
    grad.addColorStop(0, '#8b9498');
    grad.addColorStop(0.5, '#a4abaa');
    grad.addColorStop(1, '#b7baae');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
  }

  function paintHills(ctx, g, rand) {
    const rows = [
      { base: 0.42, amp: 0.1, seed: 5, ink: '#8c9a97', sc: 34 },
      { base: 0.5, amp: 0.09, seed: 17, ink: '#74857e', sc: 26 },
    ];
    for (const r of rows) {
      ctx.fillStyle = r.ink;
      ctx.beginPath();
      ctx.moveTo(0, g.H * 0.7);
      for (let x = 0; x <= g.W + 2; x += 2) {
        ctx.lineTo(x, g.H * r.base - fbm(x / (g.U * r.sc), r.seed, 4, r.seed) * g.H * r.amp);
      }
      ctx.lineTo(g.W, g.H * 0.7);
      ctx.fill();
    }
  }

  function pine(ctx, x, base, h, ink, lit, rand) {
    ctx.fillStyle = '#3a3128';
    ctx.fillRect(x - h * 0.02, base - h * 0.55, Math.max(1, h * 0.04), h * 0.55);
    for (let i = 0; i < 6; i++) {
      const y = base - h * (0.95 - i * 0.14);
      const w = h * (0.1 + i * 0.045) * (0.85 + rand() * 0.3);
      ctx.fillStyle = ink;
      blob(ctx, x + (rand() - 0.5) * h * 0.04, y, w, h * 0.055);
      ctx.fillStyle = lit;
      blob(ctx, x - w * 0.2, y - h * 0.015, w * 0.55, h * 0.03);
    }
  }

  function paintPines(ctx, g, rand) {
    const spots = [[0.05, 0.72, 0.5], [0.12, 0.7, 0.62], [0.2, 0.68, 0.42], [0.82, 0.69, 0.46], [0.9, 0.72, 0.6], [0.97, 0.7, 0.5]];
    for (const s of spots) {
      pine(ctx, g.W * s[0], g.H * s[1], g.H * s[2], '#3f5240', '#566a52', rand);
    }
  }

  // ---- roof ----------------------------------------------------------------

  function roofColour(s, t, x, y, out) {
    const N = 30;
    const M = 13;
    const col = s * N;
    const ci = Math.floor(col);
    const cf = col - ci;
    const tr = Math.pow(t, 0.9) * M;
    const ri = Math.floor(tr);
    const rf = tr - ri;
    const tile = h2(ci, ri);
    let l = 78 + tile * 14 + t * 14;
    if (ci % 2 === 1) {
      l += 10 + Math.sin(cf * Math.PI) * 14;
      if (cf < 0.12 || cf > 0.88) l -= 22;
    } else {
      if (rf < 0.16) l -= 20;
      else if (rf < 0.3) l += 6;
      if (cf < 0.1 || cf > 0.9) l -= 10;
    }
    if (t > 0.82) l += (t - 0.82) * 28;
    if (tile > 0.94 && rf > 0.3) l += 14;
    const m = fbm(x / 9, y / 7, 3, 61);
    out[0] = l * 0.96;
    out[1] = l * 1.0;
    out[2] = l * 1.06;
    if (m > 0.66 && t > 0.45) {
      const k = Math.min(1, (m - 0.66) * 6) * 0.5;
      out[0] = lerp(out[0], 92, k);
      out[1] = lerp(out[1], 108, k);
      out[2] = lerp(out[2], 70, k);
    }
  }

  function paintRoof(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const x0 = Math.floor(g.ex0);
    const x1 = Math.ceil(g.ex1);
    const y0 = Math.floor(g.ry);
    const y1 = Math.ceil(g.ey + 2);
    const w = x1 - x0;
    const h = y1 - y0;
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const rgb = [0, 0, 0];
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const e = eaveY(g, x);
        const t = (y - g.ry) / (e - g.ry);
        if (t < 0 || t > 1) continue;
        const xl = lerp(g.rx0, g.ex0, t);
        const xr = lerp(g.rx1, g.ex1, t);
        const s = (x - xl) / (xr - xl);
        if (s < 0 || s > 1) continue;
        roofColour(s, t, x, y, rgb);
        const i = ((y - y0) * w + (x - x0)) * 4;
        d[i] = rgb[0];
        d[i + 1] = rgb[1];
        d[i + 2] = rgb[2];
        d[i + 3] = 255;
      }
    }
    const tmp = layer(w, h);
    tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.drawImage(tmp, x0, y0);
    return c;
  }

  function paintRoofTrim(ctx, g) {
    const U = g.U;
    // hip ridges
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const rx = side < 0 ? g.rx0 : g.rx1;
      const ex = side < 0 ? g.ex0 : g.ex1;
      ctx.strokeStyle = '#2e3338';
      ctx.lineWidth = U * 2.6;
      ctx.beginPath();
      ctx.moveTo(rx, g.ry);
      ctx.lineTo(ex, eaveY(g, ex) - 1);
      ctx.stroke();
      ctx.strokeStyle = '#6c747a';
      ctx.lineWidth = U * 1.5;
      ctx.beginPath();
      ctx.moveTo(rx, g.ry);
      ctx.lineTo(ex, eaveY(g, ex) - 1);
      ctx.stroke();
    }
    // main ridge
    const rh = U * 3.2;
    ctx.fillStyle = '#2e3338';
    ctx.fillRect(g.rx0 - U, g.ry - rh, g.rx1 - g.rx0 + U * 2, rh + U * 0.6);
    ctx.fillStyle = '#6a7278';
    ctx.fillRect(g.rx0 - U, g.ry - rh, g.rx1 - g.rx0 + U * 2, rh * 0.32);
    ctx.fillStyle = '#4a5157';
    for (let x = g.rx0; x < g.rx1; x += U * 2.2) ctx.fillRect(x, g.ry - rh * 0.65, U * 1.4, rh * 0.5);
    // onigawara blocks
    for (const side of [-1, 1]) {
      const x = side < 0 ? g.rx0 - U : g.rx1 + U;
      ctx.fillStyle = '#2b3035';
      poly(ctx, [x - side * U * 2.4, g.ry + U * 0.6, x - side * U * 2.0, g.ry - rh * 1.5, x + side * U * 0.6, g.ry - rh * 2.5, x + side * U * 2.2, g.ry - rh * 1.3, x + side * U * 1.4, g.ry + U * 0.6]);
      ctx.fillStyle = '#6e767c';
      blob(ctx, x - side * U * 0.2, g.ry - rh * 1.2, U * 1.1, U * 1.1);
      ctx.fillStyle = '#2b3035';
      blob(ctx, x - side * U * 0.2, g.ry - rh * 1.2, U * 0.55, U * 0.55);
    }
  }

  function paintEaveEnds(ctx, g) {
    const U = g.U;
    const step = Math.max(U * 2.6, 4.2);
    state.ends = [];
    for (let x = g.ex0 + step * 0.5; x < g.ex1; x += step) {
      const e = eaveY(g, x);
      ctx.fillStyle = '#23282c';
      ctx.fillRect(x - step * 0.5, e - 0.5, step, U * 1.1);
      ctx.fillStyle = '#3d444a';
      blob(ctx, x, e + U * 0.9, U * 1.15, U * 1.15);
      ctx.fillStyle = '#7e868a';
      blob(ctx, x - U * 0.25, e + U * 0.6, U * 0.55, U * 0.5);
      ctx.fillStyle = '#2a3035';
      blob(ctx, x, e + U * 0.95, U * 0.4, U * 0.4);
      state.ends.push(x, e + U * 2.1);
    }
    // eave shadow on the wall
    const grad = ctx.createLinearGradient(0, g.ey, 0, g.ey + g.H * 0.1);
    grad.addColorStop(0, 'rgba(18,20,22,0.7)');
    grad.addColorStop(1, 'rgba(18,20,22,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(g.ex0 + U * 3, g.ey + U * 2, g.ex1 - g.ex0 - U * 6, g.H * 0.1);
  }

  // ---- hall wall -----------------------------------------------------------

  function paintWall(ctx, g) {
    const U = g.U;
    const x0 = g.ex0 + U * 5;
    const x1 = g.ex1 - U * 5;
    const top = g.ey + U * 2.2;
    ctx.fillStyle = '#b8b4a2';
    ctx.fillRect(x0, top, x1 - x0, g.wallBot - top);
    // dark interior openings
    const bays = 5;
    const bw = (x1 - x0) / bays;
    for (let i = 0; i < bays; i++) {
      const bx = x0 + i * bw;
      const open = i === 2;
      ctx.fillStyle = open ? '#2c2622' : '#8a8472';
      ctx.fillRect(bx + bw * 0.12, top + U * 4, bw * 0.76, g.wallBot - top - U * 8);
      if (!open) {
        ctx.fillStyle = '#5a5444';
        for (let y = top + U * 4; y < g.wallBot - U * 4; y += U * 2) ctx.fillRect(bx + bw * 0.12, y, bw * 0.76, 0.6);
        for (let x = bx + bw * 0.12; x < bx + bw * 0.88; x += U * 2.2) ctx.fillRect(x, top + U * 4, 0.6, g.wallBot - top - U * 8);
      } else {
        ctx.fillStyle = '#3e342c';
        ctx.fillRect(bx + bw * 0.12, top + U * 4, bw * 0.76, U * 1.2);
        ctx.fillStyle = '#a79a74';
        blob(ctx, bx + bw * 0.5, g.wallBot - U * 6, U * 1.2, U * 0.7);
      }
    }
    // pillars
    for (let i = 0; i <= bays; i++) {
      const px = x0 + i * bw;
      ctx.fillStyle = '#8c3b2b';
      ctx.fillRect(px - U * 1.1, top, U * 2.2, g.wallBot - top);
      ctx.fillStyle = '#a95240';
      ctx.fillRect(px - U * 1.1, top, U * 0.6, g.wallBot - top);
      ctx.fillStyle = '#51241c';
      ctx.fillRect(px + U * 0.7, top, U * 0.4, g.wallBot - top);
    }
    // beams
    ctx.fillStyle = '#3a2f28';
    ctx.fillRect(x0 - U, top, x1 - x0 + U * 2, U * 1.6);
    ctx.fillRect(x0 - U, top + U * 3.2, x1 - x0 + U * 2, U * 0.8);
    // stone base
    ctx.fillStyle = '#6a6e6c';
    ctx.fillRect(x0 - U * 2, g.wallBot, x1 - x0 + U * 4, g.ground - g.wallBot);
    ctx.fillStyle = '#868a86';
    ctx.fillRect(x0 - U * 2, g.wallBot, x1 - x0 + U * 4, U * 0.8);
    ctx.fillStyle = '#4a4e4c';
    for (let x = x0 - U * 2; x < x1 + U * 2; x += U * 6) ctx.fillRect(x, g.wallBot, 0.7, g.ground - g.wallBot);
  }

  // ---- courtyard -----------------------------------------------------------

  function makePuddles(g) {
    const W = g.W;
    const H = g.H;
    return [
      [W * 0.28, H * 0.9, W * 0.13, H * 0.045],
      [W * 0.62, H * 0.86, W * 0.1, H * 0.035],
      [W * 0.8, H * 0.94, W * 0.12, H * 0.04],
      [W * 0.46, H * 0.96, W * 0.08, H * 0.03],
    ];
  }

  function paintGround(ctx, g, rand, puddles) {
    const W = g.W;
    const H = g.H;
    const y0 = Math.floor(g.ground);
    const img = ctx.createImageData(W, H - y0);
    const d = img.data;
    for (let y = y0; y < H; y++) {
      const f = (y - y0) / (H - y0);
      for (let x = 0; x < W; x++) {
        const n = rand();
        const l = 94 + f * 8 + (n - 0.5) * 26 + fbm(x / 14, y / 6, 3, 9) * 14;
        const i = ((y - y0) * W + x) * 4;
        d[i] = l * 0.95;
        d[i + 1] = l;
        d[i + 2] = l * 1.02;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, y0);
    // stone path slabs
    const px = g.cx;
    ctx.fillStyle = '#7d8280';
    for (let r = 0; r < 4; r++) {
      const y = g.ground + g.U * 1.2 + r * g.U * 5.2;
      const f = r / 3;
      const w = g.U * (14 + f * 14);
      ctx.fillRect(px - w, y, w * 2, g.U * 4);
      ctx.fillStyle = '#9ba09c';
      ctx.fillRect(px - w, y, w * 2, g.U * 0.7);
      ctx.fillStyle = '#7d8280';
    }
    // puddles mirror the grey sky and the dark roof
    for (const p of puddles) {
      ctx.fillStyle = '#6e7a7c';
      blob(ctx, p[0], p[1], p[2] * 1.06, p[3] * 1.15);
      ctx.fillStyle = '#9aa4a4';
      blob(ctx, p[0], p[1], p[2], p[3]);
      ctx.fillStyle = '#7f8b8c';
      blob(ctx, p[0], p[1] + p[3] * 0.2, p[2] * 0.6, p[3] * 0.4);
    }
    // moss at the base of the stone
    ctx.fillStyle = '#5f7248';
    for (let x = g.ex0; x < g.ex1; x += g.U * 3.4) {
      if (rand() < 0.5) blob(ctx, x + rand() * g.U, g.ground + g.U * 0.4, g.U * (0.8 + rand() * 1.4), g.U * 0.5);
    }
  }

  function paintBough(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const U = g.U;
    ctx.strokeStyle = '#33291f';
    ctx.lineWidth = U * 1.4;
    ctx.beginPath();
    ctx.moveTo(g.W + U * 2, U * 6);
    ctx.quadraticCurveTo(g.W * 0.9, U * 12, g.W * 0.8, U * 9);
    ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const x = lerp(g.W * 0.96, g.W * 0.8, t);
      const y = lerp(U * 8, U * 10, t) + rand() * U * 2;
      ctx.fillStyle = '#2c4130';
      blob(ctx, x, y + U * 2, U * (5 + rand() * 2), U * 2.4);
      ctx.fillStyle = '#486548';
      blob(ctx, x - U * 1.2, y + U * 1.2, U * 3, U * 1.2);
    }
    return c;
  }

  function paintMistStrip(g) {
    const w = Math.ceil(g.W);
    const h = Math.ceil(g.H * 0.2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 6; i++) {
      const x = (i / 6) * w;
      const grad = ctx.createRadialGradient(x, h * 0.5, 0, x, h * 0.5, w * 0.22);
      grad.addColorStop(0, 'rgba(204,206,198,0.5)');
      grad.addColorStop(1, 'rgba(204,206,198,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w, 0);
      ctx.fillRect(-w, 0, w, 0);
      ctx.restore();
    }
    return c;
  }

  // ---- motion --------------------------------------------------------------

  function makeRain(g, rand) {
    const rain = { x: new Float32Array(RAIN_MAX), y: new Float32Array(RAIN_MAX), v: new Float32Array(RAIN_MAX) };
    for (let i = 0; i < RAIN_MAX; i++) {
      rain.x[i] = rand() * (g.W + g.H * 0.3);
      rain.y[i] = rand() * g.H * 0.9;
      rain.v[i] = 0.9 + rand() * 0.5;
    }
    return rain;
  }

  function makeDrips(g, rand) {
    const n = Math.min(DRIP_MAX, state.ends.length / 2);
    const dr = { n, x: new Float32Array(n), y0: new Float32Array(n), y: new Float32Array(n), v: new Float32Array(n), wait: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      const k = Math.floor(rand() * (state.ends.length / 2));
      dr.x[i] = state.ends[k * 2];
      dr.y0[i] = state.ends[k * 2 + 1];
      dr.y[i] = dr.y0[i];
      dr.v[i] = 0;
      dr.wait[i] = rand() * 1.4;
    }
    return dr;
  }

  function makeRings() {
    return { x: new Float32Array(RING_MAX), y: new Float32Array(RING_MAX), age: new Float32Array(RING_MAX).fill(2), life: new Float32Array(RING_MAX), size: new Float32Array(RING_MAX), next: 0 };
  }

  function spawnRing(R, x, y, size, life) {
    const i = R.next;
    R.next = (i + 1) % RING_MAX;
    R.x[i] = x;
    R.y[i] = y;
    R.size[i] = size;
    R.life[i] = life;
    R.age[i] = 0;
  }

  function drawRain(ctx, g, dt, amount) {
    const R = state.rain;
    const count = Math.min(RAIN_MAX, Math.round(70 * amount));
    const len = g.U * 4.5;
    const fall = g.H * 1.6;
    ctx.strokeStyle = 'rgba(214,220,218,0.5)';
    ctx.lineWidth = Math.max(0.8, g.U * 0.35);
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      R.y[i] += fall * R.v[i] * dt;
      R.x[i] -= fall * R.v[i] * dt * SLANT;
      if (R.y[i] > g.H + len) {
        R.y[i] = -len;
        R.x[i] = state.rand() * (g.W + g.H * 0.3);
        if (state.rand() < 0.35) spawnRing(state.rings, R.x[i] - 0 * g.W, g.ground + g.H * 0.04 + state.rand() * g.H * 0.18, g.U * 0.9, 0.5);
      }
      ctx.moveTo(R.x[i], R.y[i]);
      ctx.lineTo(R.x[i] + len * SLANT, R.y[i] - len);
    }
    ctx.stroke();
  }

  function drawDrips(ctx, g, dt, amount) {
    const D = state.drips;
    const count = Math.min(D.n, Math.round(D.n * amount * 0.7));
    const land = g.ground + g.U * 1.5;
    ctx.fillStyle = 'rgba(224,230,228,0.85)';
    for (let i = 0; i < count; i++) {
      if (D.wait[i] > 0) {
        D.wait[i] -= dt;
        continue;
      }
      D.v[i] += g.H * 2.1 * dt;
      D.y[i] += D.v[i] * dt;
      if (D.y[i] >= land) {
        spawnRing(state.rings, D.x[i], land + state.rand() * g.U * 1.5, g.U * 1.4, 0.8);
        D.y[i] = D.y0[i];
        D.v[i] = 0;
        D.wait[i] = 0.2 + state.rand() * 1.1;
        continue;
      }
      ctx.fillRect(D.x[i], D.y[i], Math.max(1, g.U * 0.4), g.U * 1.8);
    }
  }

  function drawChain(ctx, g, t, amount) {
    const x = g.ex0 + g.U * 5;
    const top = eaveY(g, x) + g.U * 2.4;
    const bot = g.ground + g.U * 1.2;
    ctx.fillStyle = '#4a4036';
    ctx.fillRect(x - 0.4, top, 0.8, bot - top);
    for (let y = top + g.U * 3; y < bot; y += g.U * 6) {
      ctx.fillStyle = '#7a6a4c';
      blob(ctx, x, y, g.U * 1.1, g.U * 0.8);
      ctx.fillStyle = '#2a2622';
      blob(ctx, x, y - g.U * 0.2, g.U * 0.6, g.U * 0.35);
    }
    ctx.fillStyle = 'rgba(224,230,228,0.85)';
    for (let i = 0; i < CHAIN_DOTS; i++) {
      const f = (t * 0.7 * (0.8 + amount * 0.3) + i / CHAIN_DOTS) % 1;
      const y = top + (bot - top) * f;
      ctx.fillRect(x + (i % 2 ? 0.8 : -1.4), y, 1, g.U * 1.4);
    }
  }

  function drawRings(ctx, g, dt, amount) {
    const R = state.rings;
    ctx.lineWidth = Math.max(0.8, g.U * 0.3);
    for (let i = 0; i < RING_MAX; i++) {
      if (R.age[i] >= 1) continue;
      R.age[i] += dt / R.life[i];
      const a = R.age[i];
      if (a >= 1) continue;
      const rx = R.size[i] * (0.3 + a * 2.2);
      ctx.strokeStyle = 'rgba(224,230,228,' + (0.75 * (1 - a)).toFixed(2) + ')';
      ctx.beginPath();
      ctx.ellipse(R.x[i], R.y[i], rx, rx * 0.35, 0, 0, TAU);
      ctx.stroke();
    }
    state.ringTimer -= dt;
    if (state.ringTimer <= 0 && amount > 0) {
      const p = state.puddles[Math.floor(state.rand() * state.puddles.length)];
      spawnRing(R, p[0] + (state.rand() - 0.5) * p[2] * 1.4, p[1] + (state.rand() - 0.5) * p[3] * 1.2, g.U * (1.2 + state.rand() * 1.4), 1.1 + state.rand() * 0.8);
      state.ringTimer = (0.12 + state.rand() * 0.25) / amount;
    }
  }

  function drawMist(ctx, g, t) {
    const w = state.mist.width;
    const off = (t * g.W * 0.01) % w;
    ctx.globalAlpha = 0.7;
    ctx.drawImage(state.mist, -off, g.H * 0.4);
    ctx.drawImage(state.mist, w - off, g.H * 0.4);
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    const back = layer(g.W, g.H);
    const b = back.getContext('2d');
    state.g = g;
    state.rand = rand;
    state.puddles = makePuddles(g);
    paintSky(b, g);
    paintHills(b, g, rand);
    paintPines(b, g, rand);
    b.drawImage(paintMistStripPad(g), 0, g.H * 0.36);
    paintWall(b, g);
    b.drawImage(paintRoof(g), 0, 0);
    paintRoofTrim(b, g);
    paintEaveEnds(b, g);
    paintGround(b, g, rand, state.puddles);
    state.back = back;
    state.bough = paintBough(g, rand);
    state.mist = paintMistStrip(g);
    state.rain = makeRain(g, rand);
    state.drips = makeDrips(g, rand);
    state.rings = makeRings();
    state.ringTimer = 0;
  }

  function paintMistStripPad(g) {
    const c = layer(g.W, g.H * 0.16);
    const x = c.getContext('2d');
    const grad = x.createLinearGradient(0, 0, 0, c.height);
    grad.addColorStop(0, 'rgba(190,194,188,0)');
    grad.addColorStop(0.5, 'rgba(190,194,188,0.45)');
    grad.addColorStop(1, 'rgba(190,194,188,0)');
    x.fillStyle = grad;
    x.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { rain, eaves, puddles } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.back, 0, 0);
    drawMist(ctx, g, t);
    drawRings(ctx, g, step, puddles);
    drawChain(ctx, g, t, eaves);
    drawDrips(ctx, g, step, eaves);
    ctx.drawImage(state.bough, 0, 0);
    drawRain(ctx, g, step, rain);
  }

  Kasuri.run({
    defaults: { rain: 1, eaves: 1, puddles: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
