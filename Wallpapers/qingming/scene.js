/*
 * 清明 Qingming — spring drizzle over a Jiangnan canal.
 *
 * Sky, hills, the hill pavilion, the whitewashed houses, the arch bridge and the banks
 * are baked once. The canal is that baked world flipped and laid back in thin rows that
 * slide sideways. Only the rain, the ripple rings, the mist strip and the willow strands
 * move, all from small reused pools.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.64;
  const SKY = ['#aab4b1', '#bec5bf', '#d2d4c6', '#dedcca'];
  const HILLS = ['#a3b2a8', '#86a091', '#65836f'];
  const TREE = [['#3f5a43', '#506d4c', '#6b8657'], ['#4a6a45', '#5f8052', '#82a064']];
  const WALL = '#e8e3d2';
  const TILE = '#343c42';
  const STONE = ['#dcdacb', '#c4c4b2', '#8f9183'];
  const VERMILION = '#b24a30';
  const WATER_INK = '#6c887f';
  const VEIL = 0.42;
  const STRAND_INK = ['#5f7e48', '#7b9a58', '#9bb26a'];
  const STRANDS = 64;
  const DROPS = 90;
  const RINGS = 14;
  const GLINTS = 18;
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
    return { W, H, U, u, wy, bx: W * 0.42 };
  }

  // ---- sky and hills ----------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.wy);
    SKY.forEach((c, i) => grad.addColorStop(i / (SKY.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.wy + 2);
    ctx.fillStyle = '#e2e0d0';
    for (let i = 0; i < 6; i++) {
      const x = g.W * (0.05 + rand() * 0.9);
      const y = g.H * (0.05 + rand() * 0.12);
      blob(ctx, x, y, g.U * (10 + rand() * 14), g.U * (0.7 + rand() * 0.6));
    }
  }

  function ridge(g, x, k) {
    const base = [0.3, 0.4, 0.5][k];
    const amp = [0.1, 0.07, 0.04][k];
    const peak = k === 0 ? Math.exp(-(((x - g.W * 0.2) / (g.W * 0.12)) ** 2)) * g.H * 0.08 : 0;
    return g.H * base + (fbm(x / (g.U * (34 - k * 8)), k * 3.1, 4, 17 + k) - 0.5) * g.H * amp * 2 - peak;
  }

  function hillShape(ctx, g, k) {
    ctx.fillStyle = HILLS[k];
    ctx.beginPath();
    ctx.moveTo(0, g.wy);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, ridge(g, x, k));
    ctx.lineTo(g.W, g.wy);
    ctx.closePath();
    ctx.fill();
  }

  function mistBand(ctx, g, y, h, alpha) {
    const grad = ctx.createLinearGradient(0, y - h, 0, y + h);
    grad.addColorStop(0, 'rgba(222,222,206,0)');
    grad.addColorStop(0.5, 'rgba(222,222,206,' + alpha + ')');
    grad.addColorStop(1, 'rgba(222,222,206,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - h, g.W, h * 2);
  }

  function crowns(ctx, g, rand, k, y0, y1, size) {
    for (let y = y0; y < y1; y += size * 0.9) {
      for (let x = 0; x < g.W + size; x += size * (1 + rand() * 0.7)) {
        if (y < ridge(g, x, k) - size * 0.2) continue;
        const t = TREE[rand() < 0.35 ? 1 : 0];
        const r = size * (0.7 + rand() * 0.5);
        ctx.fillStyle = t[0];
        blob(ctx, x, y, r, r * 0.8);
        ctx.fillStyle = t[1];
        blob(ctx, x - r * 0.2, y - r * 0.2, r * 0.65, r * 0.55);
        ctx.fillStyle = t[2];
        blob(ctx, x - r * 0.35, y - r * 0.35, r * 0.3, r * 0.25);
      }
    }
  }

  // ---- pavilion, houses ---------------------------------------------------------

  // A hip roof with upturned corners; ra is the half ridge, rb the half eave.
  function eaveRoof(ctx, x, yr, ye, ra, rb, lift) {
    ctx.beginPath();
    ctx.moveTo(x - ra, yr);
    ctx.lineTo(x + ra, yr);
    ctx.quadraticCurveTo(x + rb * 0.72, ye, x + rb, ye - lift);
    ctx.quadraticCurveTo(x, ye + lift * 0.35, x - rb, ye - lift);
    ctx.quadraticCurveTo(x - rb * 0.72, ye, x - ra, yr);
    ctx.closePath();
    ctx.fill();
  }

  function pavilion(ctx, g, x, yb) {
    const s = g.u * 1.15;
    ctx.fillStyle = '#6a7064';
    ctx.fillRect(x - s * 5, yb - s * 0.9, s * 10, s * 0.9);
    ctx.fillStyle = '#8a8c7b';
    ctx.fillRect(x - s * 5.3, yb - s * 1.2, s * 10.6, s * 0.35);
    const top = yb - s * 1.2;
    ctx.fillStyle = '#3a3a36';
    ctx.fillRect(x - s * 3.4, top - s * 3.6, s * 6.8, s * 3.6);
    ctx.fillStyle = '#d6c79a';
    ctx.fillRect(x - s * 2.9, top - s * 3.3, s * 5.8, s * 3);
    ctx.fillStyle = '#4b4a3f';
    ctx.fillRect(x - s * 2.9, top - s * 3.3, s * 5.8, s * 0.5);
    ctx.fillStyle = VERMILION;
    for (let i = 0; i < 4; i++) ctx.fillRect(x - s * 3.2 + i * s * 2.13, top - s * 3.6, Math.max(1, s * 0.45), s * 3.6);
    ctx.fillStyle = TILE;
    eaveRoof(ctx, x, top - s * 6.2, top - s * 3.4, s * 2.2, s * 5.6, s * 1.5);
    ctx.fillStyle = '#c8b27a';
    ctx.fillRect(x - s * 1.7, top - s * 8.9, s * 3.4, s * 2.7);
    ctx.fillStyle = VERMILION;
    ctx.fillRect(x - s * 1.4, top - s * 8.6, Math.max(1, s * 0.4), s * 2.4);
    ctx.fillRect(x + s * 1, top - s * 8.6, Math.max(1, s * 0.4), s * 2.4);
    ctx.fillStyle = TILE;
    eaveRoof(ctx, x, top - s * 11.3, top - s * 8.6, s * 0.45, s * 4.1, s * 1.4);
    ctx.fillRect(x - s * 0.18, top - s * 12.9, Math.max(1, s * 0.36), s * 1.8);
  }

  // A whitewashed house with a stepped gable at each end and a dark tiled roof.
  function house(ctx, g, x, yb, w, h) {
    const u = g.u;
    ctx.fillStyle = WALL;
    ctx.fillRect(x, yb - h, w, h);
    ctx.fillStyle = '#c9c4b0';
    ctx.fillRect(x, yb - h * 0.12, w, h * 0.12);
    const steps = 3;
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < steps; i++) {
        const sw = u * 1.5;
        const sx = side ? x + w - sw * (steps - i) : x + sw * i;
        ctx.fillStyle = WALL;
        ctx.fillRect(sx, yb - h - u * (1.2 + (steps - i) * 0.9), sw, u * (1.2 + (steps - i) * 0.9) + 1);
        ctx.fillStyle = TILE;
        ctx.fillRect(sx, yb - h - u * (1.2 + (steps - i) * 0.9) - u * 0.35, sw, u * 0.45);
      }
    }
    ctx.fillStyle = WALL;
    ctx.fillRect(x + u * 4.5, yb - h - u * 1.2, w - u * 9, u * 1.3);
    ctx.fillStyle = TILE;
    poly(ctx, [x + u * 3, yb - h - u * 0.9, x + w - u * 3, yb - h - u * 0.9, x + w - u * 1, yb - h + u * 0.6, x + u, yb - h + u * 0.6]);
    ctx.fillStyle = '#4a4540';
    ctx.fillRect(x + w * 0.2, yb - h * 0.75, u * 1.4, u * 1.8);
    ctx.fillRect(x + w * 0.65, yb - h * 0.75, u * 1.4, u * 1.8);
    ctx.fillStyle = '#5a3a2a';
    ctx.fillRect(x + w * 0.42, yb - h * 0.6, u * 1.6, h * 0.6);
  }

  // ---- bridge --------------------------------------------------------------------

  function deckY(g, x) {
    const hw = g.u * 21;
    const s = Math.max(-1, Math.min(1, (x - g.bx) / hw));
    return g.wy - g.u * 5 - g.u * 9.5 * (1 - s * s);
  }

  function paintBridge(ctx, g) {
    const u = g.u;
    const hw = u * 21;
    const x0 = g.bx - hw;
    const x1 = g.bx + hw;
    const arch = { rx: hw * 0.62, ry: u * 8.6 };
    ctx.fillStyle = STONE[1];
    ctx.beginPath();
    ctx.moveTo(x0, g.wy + 2);
    for (let x = x0; x <= x1; x += 1) ctx.lineTo(x, deckY(g, x));
    ctx.lineTo(x1, g.wy + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = STONE[0];
    for (let x = x0; x < x1; x += 1) ctx.fillRect(x, deckY(g, x) - u * 0.2, 1.4, u * 1.3);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(g.bx, g.wy, arch.rx, arch.ry, 0, Math.PI, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = STONE[2];
    ctx.lineWidth = Math.max(1, u * 0.9);
    ctx.beginPath();
    ctx.ellipse(g.bx, g.wy, arch.rx + u * 0.5, arch.ry + u * 0.5, 0, Math.PI, TAU);
    ctx.stroke();
    ctx.strokeStyle = STONE[0];
    ctx.lineWidth = Math.max(1, u * 0.3);
    ctx.beginPath();
    ctx.ellipse(g.bx, g.wy, arch.rx + u * 1.3, arch.ry + u * 1.3, 0, Math.PI * 1.04, TAU * 0.98);
    ctx.stroke();
    ctx.fillStyle = STONE[2];
    for (let x = x0; x < x1; x += u * 2.4) ctx.fillRect(x, deckY(g, x) - u * 1.7, Math.max(1, u * 0.7), u * 1.9);
    ctx.strokeStyle = STONE[2];
    ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 2) {
      if (x === x0) ctx.moveTo(x, deckY(g, x) - u * 1.7);
      else ctx.lineTo(x, deckY(g, x) - u * 1.7);
    }
    ctx.stroke();
    ctx.fillStyle = '#6f7a5b';
    for (let i = 0; i < 18; i++) {
      const x = x0 + ((i * 37) % 100) / 100 * hw * 2;
      if (Math.abs(x - g.bx) < arch.rx) continue;
      ctx.fillRect(x, g.wy - u * (0.6 + (i % 4) * 0.7), u * 1.2, u * 0.5);
    }
  }

  // ---- willows -------------------------------------------------------------------

  function addStrand(st, x, y, len, rand) {
    const i = st.n++;
    st.x[i] = x;
    st.y[i] = y;
    st.len[i] = len;
    st.ph[i] = rand() * TAU;
    st.tone[i] = Math.floor(rand() * 3);
  }

  function willow(ctx, g, rand, st, x, yb, h, lean, count) {
    const u = g.u;
    ctx.strokeStyle = '#3d3226';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, h * 0.07);
    const fx = x + lean;
    const fy = yb - h * 0.62;
    ctx.beginPath();
    ctx.moveTo(x, yb);
    ctx.quadraticCurveTo(x - lean * 0.2, yb - h * 0.35, fx, fy);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, h * 0.035);
    for (let b = 0; b < 5; b++) {
      const side = b % 2 ? 1 : -1;
      const reach = h * (0.28 + rand() * 0.2);
      const tx = fx + side * reach * (0.5 + b * 0.18);
      const ty = fy - h * (0.12 + rand() * 0.2);
      ctx.strokeStyle = '#3d3226';
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(fx + side * reach * 0.3, ty - h * 0.1, tx, ty);
      ctx.stroke();
      ctx.fillStyle = '#6d8b50';
      blob(ctx, tx, ty, u * 3.2, u * 1.6);
      ctx.fillStyle = '#88a560';
      blob(ctx, tx - u, ty - u * 0.5, u * 1.8, u * 0.9);
      const per = Math.round(count / 5);
      for (let k = 0; k < per; k++) {
        const f = (k + 0.5) / per;
        const ax = lerp(fx + side * reach * 0.3, tx, f) + (rand() - 0.5) * u;
        const ay = lerp(fy - h * 0.1, ty, f * f) + u * 0.4;
        addStrand(st, ax, ay, h * (0.5 + rand() * 0.3) * (1 - f * 0.25), rand);
      }
    }
  }

  // ---- bank pieces and canal -----------------------------------------------------

  function paintBanks(ctx, g, rand) {
    const u = g.u;
    const hw = u * 21;
    ctx.fillStyle = '#36503a';
    poly(ctx, [0, g.wy - u * 4, g.bx - hw + u * 2, g.wy - u * 4.5, g.bx - hw + u * 6, g.wy + 2, 0, g.wy + 2]);
    poly(ctx, [g.W, g.wy - u * 3, g.bx + hw - u * 2, g.wy - u * 4.5, g.bx + hw - u * 6, g.wy + 2, g.W, g.wy + 2]);
    ctx.fillStyle = '#4b6b45';
    blob(ctx, g.W * 0.05, g.wy - u * 3.8, u * 9, u * 1.4);
    blob(ctx, g.bx + hw + u * 4, g.wy - u * 4, u * 6, u * 1.2);
    ctx.fillStyle = '#58744a';
    for (let i = 0; i < 26; i++) {
      const left = rand() < 0.5;
      const x = left ? rand() * (g.bx - hw) : g.bx + hw - u * 3 + rand() * (g.W - g.bx - hw + u * 3);
      ctx.fillRect(x, g.wy - u * (3.2 + rand() * 1.4), Math.max(1, u * 0.3), u * 2);
    }
    ctx.fillStyle = '#7e8b6a';
    for (let x = g.W * 0.5; x < g.W; x += u * (2 + rand() * 4)) blob(ctx, x, g.wy - u * 0.4, u * (1 + rand() * 1.6), u * 0.45);
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.wy + 2);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    hillShape(ctx, g, 0);
    mistBand(ctx, g, g.H * 0.34, g.H * 0.07, 0.55);
    hillShape(ctx, g, 1);
    pavilion(ctx, g, g.W * 0.8, ridge(g, g.W * 0.8, 1) + g.u * 0.5);
    mistBand(ctx, g, g.H * 0.45, g.H * 0.07, 0.4);
    hillShape(ctx, g, 2);
    crowns(ctx, g, rand, 2, g.H * 0.44, g.wy - g.u * 2, g.U * 2.4);
    ctx.fillStyle = '#4a6446';
    ctx.fillRect(0, g.wy - g.u * 3.5, g.W, g.u * 3.5 + 2);
    const hx = g.W * 0.62;
    house(ctx, g, hx, g.wy - g.u * 2.2, g.u * 17, g.u * 9);
    house(ctx, g, hx + g.u * 19, g.wy - g.u * 2.2, g.u * 14, g.u * 7.4);
    house(ctx, g, hx + g.u * 35, g.wy - g.u * 2.2, g.u * 16, g.u * 8.4);
    return c;
  }

  function paintFore(g, rand, st) {
    const c = layer(g.W, g.wy + 2);
    const ctx = c.getContext('2d');
    paintBridge(ctx, g);
    paintBanks(ctx, g, rand);
    willow(ctx, g, rand, st, g.W * 0.09, g.wy - g.u * 3, g.u * 44, g.u * 6, 40);
    willow(ctx, g, rand, st, g.bx + g.u * 23, g.wy - g.u * 3.5, g.u * 30, -g.u * 3, 24);
    return c;
  }

  function flatten(g, back, fore) {
    const c = layer(g.W, g.wy + 2);
    const ctx = c.getContext('2d');
    ctx.drawImage(back, 0, 0);
    ctx.drawImage(fore, 0, 0);
    return c;
  }

  function paintMist(g) {
    const h = Math.ceil(g.H * 0.2);
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    const rand = K.rng(77);
    ctx.fillStyle = 'rgba(226,226,212,0.3)';
    for (let i = 0; i < 9; i++) {
      const x = rand() * g.W;
      const y = h * (0.25 + rand() * 0.5);
      const rx = g.U * (14 + rand() * 18);
      const ry = g.U * (1.3 + rand() * 1.4);
      for (const o of [-g.W, 0, g.W]) blob(ctx, x + o, y, rx, ry);
    }
    return c;
  }

  // ---- pools ----------------------------------------------------------------------

  function makeStrands() {
    return { n: 0, x: new Float32Array(STRANDS), y: new Float32Array(STRANDS), len: new Float32Array(STRANDS), ph: new Float32Array(STRANDS), tone: new Uint8Array(STRANDS) };
  }

  function makeDrops() {
    return { x: new Float32Array(DROPS), y: new Float32Array(DROPS), v: new Float32Array(DROPS), l: new Float32Array(DROPS) };
  }

  function resetDrop(g, d, i, fresh) {
    d.x[i] = state.rand() * (g.W + g.H * 0.3);
    d.y[i] = fresh ? state.rand() * g.H : -state.rand() * g.U * 6;
    d.v[i] = g.U * (38 + state.rand() * 20);
    d.l[i] = g.U * (1.6 + state.rand() * 1.8);
  }

  function makeRings() {
    return { x: new Float32Array(RINGS), y: new Float32Array(RINGS), age: new Float32Array(RINGS) };
  }

  function resetRing(g, r, i, fresh) {
    r.x[i] = state.rand() * g.W;
    r.y[i] = g.wy + g.U * (1.5 + state.rand() * (100 * (1 - WATER) - 2.5));
    r.age[i] = fresh ? state.rand() * 2.6 : 0;
  }

  // ---- per frame --------------------------------------------------------------------

  function drawWater(ctx, g, t) {
    const world = state.world;
    ctx.fillStyle = WATER_INK;
    ctx.fillRect(0, g.wy, g.W, g.H - g.wy);
    for (let y = g.wy; y < g.H; y++) {
      const d = y - g.wy;
      const src = g.wy - d - 1;
      if (src < 0) break;
      const dx = Math.sin(d * 0.55 + t * 0.9) * (0.4 + d * 0.035) + Math.sin(d * 0.21 - t * 0.5) * 0.6;
      ctx.drawImage(world, 0, src, g.W, 1, dx, y, g.W, 1);
    }
    ctx.globalAlpha = VEIL;
    ctx.fillStyle = WATER_INK;
    ctx.fillRect(0, g.wy, g.W, g.H - g.wy);
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, g, t) {
    ctx.fillStyle = '#dfe2d3';
    const span = g.H - g.wy;
    for (let i = 0; i < GLINTS; i++) {
      const f = (i * 0.618) % 1;
      const y = g.wy + 1 + f * (span - 2);
      const a = 0.5 + 0.5 * Math.sin(t * (0.7 + (i % 5) * 0.2) + i * 2.1);
      ctx.globalAlpha = 0.28 * a;
      const x = ((i * 0.37 + 0.11) % 1) * g.W + Math.sin(t * 0.3 + i) * g.U;
      ctx.fillRect(x, y, g.U * (3 + (i % 4)), Math.max(1, g.U * 0.25));
    }
    ctx.globalAlpha = 1;
  }

  function drawRings(ctx, g, dt, rain) {
    const r = state.rings;
    const count = Math.min(RINGS, Math.round(RINGS * 0.6 * rain + 0.5));
    ctx.strokeStyle = '#e1e4d6';
    ctx.lineWidth = Math.max(1, g.U * 0.25);
    for (let i = 0; i < count; i++) {
      r.age[i] += dt;
      if (r.age[i] > 2.6) resetRing(g, r, i, false);
      const f = r.age[i] / 2.6;
      const rad = g.U * (0.4 + f * 3.2);
      ctx.globalAlpha = 0.5 * (1 - f);
      ctx.beginPath();
      ctx.ellipse(r.x[i], r.y[i], rad, rad * 0.32, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const m = state.mist;
    const off = (t * g.U * 0.9) % g.W;
    const y = g.H * 0.4;
    ctx.globalAlpha = Math.min(1, amount * 0.9);
    ctx.drawImage(m, -off, y);
    ctx.drawImage(m, g.W - off, y);
    ctx.globalAlpha = 0.6 * Math.min(1, amount);
    ctx.drawImage(m, off - g.W, g.H * 0.54);
    ctx.drawImage(m, off, g.H * 0.54);
    ctx.globalAlpha = 1;
  }

  function drawStrands(ctx, g, t, sway) {
    const st = state.strands;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, g.U * 0.34);
    for (let tone = 0; tone < 3; tone++) {
      ctx.strokeStyle = STRAND_INK[tone];
      ctx.beginPath();
      for (let i = 0; i < st.n; i++) {
        if (st.tone[i] !== tone) continue;
        const gust = Math.sin(t * 0.35 + st.x[i] * 0.01);
        const dx = (Math.sin(t * 1.1 + st.ph[i]) * 0.55 + gust * 0.9) * st.len[i] * 0.14 * sway;
        ctx.moveTo(st.x[i], st.y[i]);
        ctx.quadraticCurveTo(st.x[i] + dx * 0.35, st.y[i] + st.len[i] * 0.5, st.x[i] + dx, st.y[i] + st.len[i]);
      }
      ctx.stroke();
    }
  }

  function drawRain(ctx, g, dt, rain) {
    const d = state.drops;
    const count = Math.min(DROPS, Math.round(DROPS * 0.7 * rain));
    const slant = 0.22;
    ctx.strokeStyle = 'rgba(232,234,222,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      d.y[i] += d.v[i] * dt;
      d.x[i] -= d.v[i] * slant * dt;
      if (d.y[i] > g.H) resetDrop(g, d, i, false);
      ctx.moveTo(d.x[i], d.y[i]);
      ctx.lineTo(d.x[i] + d.l[i] * slant, d.y[i] - d.l[i]);
    }
    ctx.stroke();
  }

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.rand = K.rng(api.seed);
    state.strands = makeStrands();
    state.back = paintBack(g, state.rand);
    state.fore = paintFore(g, state.rand, state.strands);
    state.world = flatten(g, state.back, state.fore);
    state.mist = paintMist(g);
    state.drops = makeDrops();
    state.rings = makeRings();
    for (let i = 0; i < DROPS; i++) resetDrop(g, state.drops, i, true);
    for (let i = 0; i < RINGS; i++) resetRing(g, state.rings, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { rain, sway, mist } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.back, 0, 0);
    drawMist(ctx, g, t, mist);
    ctx.drawImage(state.fore, 0, 0);
    drawWater(ctx, g, t);
    drawGlints(ctx, g, t);
    drawRings(ctx, g, step, rain);
    drawStrands(ctx, g, t, sway);
    drawRain(ctx, g, step, rain);
  }

  Kasuri.run({
    defaults: { rain: 1, sway: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
