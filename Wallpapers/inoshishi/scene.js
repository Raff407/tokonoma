/*
 * 猪 Inoshishi — a wild boar rooting slowly through an autumn wood.
 *
 * The wood, its trunks, the canopy and the leaf litter are baked once. The boar is a
 * baked body and head drawn with a transform each frame, four legs as short strokes.
 * It ambles left, stops to nose the ground, and flicks up a little earth. Leaves fall
 * from a small reused pool; light shafts breathe slowly.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp } = K;

  const TAU = Math.PI * 2;
  const GROUND = 0.68;
  const HAZE = ['#d6be8c', '#d0b686', '#c9ae80', '#c0a679', '#b69e74', '#ab966f'];
  const FAR_TRUNK = '#8a836a';
  const MID_TRUNK = ['#5e5443', '#6d6250'];
  const NEAR_TRUNK = ['#2e2620', '#3d332a', '#4f4335'];
  const CANOPY = ['#b4482c', '#c96a36', '#d39a48', '#8f3a26', '#6f6a3e', '#a87a3a'];
  const SOIL = ['#8a5e38', '#7a5232', '#6a472d'];
  const LITTER = ['#a8522e', '#c4743a', '#d6a24c', '#8c6038', '#9c4128', '#c8883e'];
  const BOAR = { body: '#3a2e25', top: '#5f4b39', rim: '#86684a', belly: '#251d17', leg: '#2a201a', hoof: '#16110d', snout: '#8a6a55', tusk: '#ece2c6', eye: '#0f0b08' };
  const LEAF_TONES = ['#c4482b', '#d6803a', '#d9a94c', '#a03a26'];
  const DIRT_TONES = ['#3b2b20', '#5a4130', '#b8682f'];
  const MAX_LEAVES = 40;
  const LEAVES = 18;
  const DIRT = 24;
  const WALK_SPEED = 2.4;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), rot || 0, 0, TAU);
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
    const b = U * Math.min(1.3, W / (U * 110));
    return { W, H, U, b, gy: Math.round(H * GROUND), floor: H * 0.86 };
  }

  // ---- the wood ------------------------------------------------------------

  function paintHaze(ctx, g) {
    const bands = HAZE.length;
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = HAZE[i];
      const y0 = Math.floor((g.gy * i) / bands);
      ctx.fillRect(0, y0, g.W, Math.ceil(g.gy / bands) + 1);
    }
  }

  function trunk(ctx, x, top, bottom, w, lean) {
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + lean, top);
    ctx.lineTo(x + w / 2 + lean, top);
    ctx.lineTo(x + w * 0.62, bottom);
    ctx.lineTo(x - w * 0.62, bottom);
    ctx.closePath();
    ctx.fill();
  }

  function paintTrunks(ctx, g, rand) {
    ctx.fillStyle = FAR_TRUNK;
    for (let x = rand() * g.U * 6; x < g.W; x += g.U * (5 + rand() * 9)) {
      trunk(ctx, x, 0, g.gy + g.U, g.U * (0.8 + rand() * 0.8), (rand() - 0.5) * g.U);
    }
    for (let x = rand() * g.U * 12; x < g.W; x += g.U * (14 + rand() * 18)) {
      const w = g.U * (2 + rand() * 1.6);
      ctx.fillStyle = MID_TRUNK[0];
      trunk(ctx, x, 0, g.gy + g.U * 3, w, (rand() - 0.5) * g.U * 2);
      ctx.fillStyle = MID_TRUNK[1];
      trunk(ctx, x - w * 0.18, 0, g.gy + g.U * 3, w * 0.35, 0);
    }
  }

  function paintUnder(ctx, g, rand) {
    const tones = ['#8a7a52', '#7c6c48', '#9a6a3e', '#6f6a3e'];
    for (let x = -g.U * 2; x < g.W + g.U * 4; x += g.U * (2 + rand() * 3)) {
      const r = g.U * (2 + rand() * 3);
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      blob(ctx, x, g.gy - r * 0.3, r, r * 0.6);
    }
  }

  function paintCanopy(ctx, g, rand) {
    for (let i = 0; i < 260; i++) {
      const x = rand() * g.W;
      const y = g.H * (rand() ** 1.6) * 0.26 - g.U * 2;
      const r = g.U * (1.4 + rand() * 3.2);
      ctx.fillStyle = CANOPY[Math.floor(rand() * CANOPY.length)];
      blob(ctx, x, y, r, r * 0.7, rand());
    }
  }

  function paintFloor(ctx, g, rand) {
    const h = g.H - g.gy;
    for (let i = 0; i < SOIL.length; i++) {
      ctx.fillStyle = SOIL[i];
      ctx.fillRect(0, g.gy + (h * i) / SOIL.length, g.W, h);
    }
    ctx.fillStyle = SOIL[1];
    ctx.fillRect(0, g.gy, g.W, g.U * 1.5);
    const n = Math.round((g.W * h) / (g.U * g.U * 0.9));
    for (let i = 0; i < n; i++) {
      const y = g.gy + h * Math.sqrt(rand());
      const near = (y - g.gy) / h;
      const s = g.U * (0.5 + near * 1.3) * (0.7 + rand() * 0.6);
      ctx.fillStyle = LITTER[Math.floor(rand() * LITTER.length)];
      blob(ctx, rand() * g.W, y, s, s * (0.35 + near * 0.2), (rand() - 0.5) * 1.2);
    }
  }

  function paintNear(ctx, g, rand) {
    const spots = [g.W * 0.07, g.W * 0.9];
    for (let k = 0; k < spots.length; k++) {
      const x = spots[k];
      const w = g.U * (7 + rand() * 3);
      const foot = g.H * (0.9 + rand() * 0.05);
      ctx.fillStyle = NEAR_TRUNK[0];
      trunk(ctx, x, 0, foot, w, (rand() - 0.5) * g.U * 2);
      ctx.fillStyle = NEAR_TRUNK[1];
      trunk(ctx, x - w * 0.22, 0, foot, w * 0.28, 0);
      ctx.fillStyle = NEAR_TRUNK[2];
      for (let y = g.U * 3; y < foot; y += g.U * (2 + rand() * 3)) {
        ctx.fillRect(x - w * 0.3 + rand() * w * 0.4, y, g.U * 0.5, g.U * (1 + rand() * 2));
      }
      ctx.fillStyle = NEAR_TRUNK[0];
      blob(ctx, x - w * 0.9, foot, w * 0.6, g.U * 1.6);
      blob(ctx, x + w * 0.9, foot, w * 0.6, g.U * 1.6);
    }
    for (let x = 0; x < g.W; x += g.U * (2 + rand() * 3)) {
      const y = g.H - g.U * rand() * 3;
      const s = g.U * (1.6 + rand() * 1.6);
      ctx.fillStyle = LITTER[Math.floor(rand() * LITTER.length)];
      blob(ctx, x, y, s, s * 0.5, (rand() - 0.5));
    }
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintHaze(ctx, g);
    paintTrunks(ctx, g, rand);
    paintUnder(ctx, g, rand);
    paintCanopy(ctx, g, rand);
    paintFloor(ctx, g, rand);
    return c;
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    paintNear(c.getContext('2d'), g, rand);
    return c;
  }

  function paintShafts(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e6d3a0';
    const xs = [0.28, 0.46, 0.7];
    for (let i = 0; i < xs.length; i++) {
      const x = g.W * xs[i];
      const w = g.U * (5 + i * 2);
      poly(ctx, [x, 0, x + w, 0, x + w + g.U * 22, g.floor, x + g.U * 16, g.floor]);
    }
    return c;
  }

  // ---- the boar ------------------------------------------------------------

  function paintBody(g) {
    const b = g.b;
    const c = layer(b * 34, b * 20);
    const ctx = c.getContext('2d');
    ctx.translate(b * 17, b * 10);
    ctx.fillStyle = BOAR.body;
    blob(ctx, 1.5 * b, 0.5 * b, 12 * b, 5.8 * b);
    blob(ctx, -6 * b, -1.2 * b, 7 * b, 6.2 * b);
    blob(ctx, 8.5 * b, 0.5 * b, 6 * b, 5.4 * b);
    ctx.fillStyle = BOAR.top;
    blob(ctx, -6 * b, -4.6 * b, 5.5 * b, 2.6 * b, -0.15);
    blob(ctx, 2 * b, -3.6 * b, 8 * b, 1.8 * b, 0.05);
    ctx.fillStyle = BOAR.rim;
    blob(ctx, -6.5 * b, -5.6 * b, 4 * b, 1.2 * b, -0.2);
    blob(ctx, 2 * b, -4.6 * b, 6 * b, 0.9 * b, 0.05);
    ctx.fillStyle = BOAR.belly;
    blob(ctx, 1 * b, 4.2 * b, 10 * b, 2 * b);
    ctx.fillStyle = BOAR.body;
    for (let i = 0; i < 9; i++) {
      const x = (-11 + i * 1.6) * b;
      poly(ctx, [x, -5.5 * b - Math.sin(i * 0.5) * b, x + 0.6 * b, -8 * b + i * 0.25 * b, x + 1.4 * b, -5.5 * b]);
    }
    ctx.strokeStyle = BOAR.leg;
    ctx.lineWidth = Math.max(1, b * 0.7);
    ctx.beginPath();
    ctx.moveTo(14 * b, -1 * b);
    ctx.quadraticCurveTo(16 * b, 0, 15.2 * b, 3 * b);
    ctx.stroke();
    return c;
  }

  function paintHead(g) {
    const b = g.b;
    const c = layer(b * 22, b * 18);
    const ctx = c.getContext('2d');
    ctx.translate(b * 16, b * 8);
    ctx.fillStyle = BOAR.body;
    poly(ctx, [2 * b, -5 * b, -4 * b, -3 * b, -11 * b, 1.6 * b, -11 * b, 4.4 * b, -5 * b, 5 * b, 2 * b, 5 * b]);
    ctx.fillStyle = BOAR.top;
    poly(ctx, [1 * b, -4.6 * b, -4 * b, -2.8 * b, -10 * b, 1.4 * b, -4 * b, -1.4 * b]);
    ctx.fillStyle = BOAR.rim;
    poly(ctx, [0.5 * b, -4.8 * b, -4 * b, -3.1 * b, -9.5 * b, 1 * b, -4 * b, -2.4 * b]);
    ctx.fillStyle = BOAR.body;
    poly(ctx, [-0.5 * b, -4 * b, 1.5 * b, -8.5 * b, 3 * b, -3.5 * b]);
    ctx.fillStyle = BOAR.belly;
    poly(ctx, [0.6 * b, -4.2 * b, 1.5 * b, -7 * b, 2.2 * b, -4 * b]);
    ctx.fillStyle = BOAR.snout;
    blob(ctx, -11.2 * b, 3 * b, 1.1 * b, 1.7 * b);
    ctx.fillStyle = BOAR.eye;
    blob(ctx, -3.6 * b, -0.6 * b, 0.6 * b, 0.6 * b);
    ctx.strokeStyle = BOAR.tusk;
    ctx.lineWidth = Math.max(1, b * 0.6);
    ctx.beginPath();
    ctx.moveTo(-7.5 * b, 4 * b);
    ctx.quadraticCurveTo(-9 * b, 3.5 * b, -8.6 * b, 1.8 * b);
    ctx.stroke();
    return c;
  }

  function makeBoar(g, rand) {
    return { x: g.W * (0.55 + rand() * 0.2), walking: true, timer: 3 + rand() * 4, stride: 0, nose: 0, kick: 0 };
  }

  function stepBoar(g, boar, dt) {
    boar.timer -= dt;
    if (boar.timer <= 0) {
      boar.walking = !boar.walking;
      boar.timer = boar.walking ? 5 + state.rand() * 5 : 4 + state.rand() * 4;
    }
    if (boar.walking) {
      boar.x -= WALK_SPEED * g.U * dt;
      boar.stride += dt * 3.2;
    }
    const want = boar.walking ? 0 : 1;
    boar.nose += (want - boar.nose) * Math.min(1, dt * 1.6);
    if (boar.x < -g.b * 30) boar.x = g.W + g.b * 30;
  }

  function leg(ctx, x, y, len, swing, w) {
    const fx = x + Math.sin(swing) * len * 0.35;
    const lift = Math.max(0, Math.cos(swing)) * len * 0.12;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(fx, y + len - lift);
    ctx.stroke();
    ctx.fillStyle = BOAR.hoof;
    ctx.fillRect(fx - w * 0.6, y + len - lift - w * 0.5, w * 1.2, w * 0.8);
  }

  function drawBoar(ctx, g, t, boar) {
    const b = g.b;
    const walk = boar.walking ? 1 : 0;
    const bob = Math.sin(boar.stride * 2) * b * 0.3 * walk;
    const cx = boar.x;
    const cy = g.floor - 10.5 * b + bob;
    const s = boar.stride;
    ctx.strokeStyle = BOAR.leg;
    ctx.lineWidth = Math.max(1, b * 1.5);
    leg(ctx, cx - 5 * b, cy + 3 * b, 7.5 * b, (s + Math.PI) * walk, b * 1.9);
    leg(ctx, cx + 9.5 * b, cy + 3 * b, 7.5 * b, s * walk, b * 1.9);
    ctx.drawImage(state.body, cx - b * 17, cy - b * 10);
    leg(ctx, cx - 7.5 * b, cy + 3 * b, 7.5 * b, s * walk, b * 1.9);
    leg(ctx, cx + 7 * b, cy + 3 * b, 7.5 * b, (s + Math.PI) * walk, b * 1.9);
    const root = Math.sin(t * 5.2) * 0.06 * boar.nose;
    const angle = -0.08 + Math.sin(s) * 0.04 * walk - boar.nose * 0.5 + root;
    const nx = cx - 10.5 * b;
    const ny = cy - 1.5 * b;
    const c = Math.cos(angle);
    const sn = Math.sin(angle);
    ctx.setTransform(c, sn, -sn, c, nx, ny);
    ctx.drawImage(state.head, -16 * b, -8 * b);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    boar.snoutX = nx + c * (-11 * b) - sn * (3.5 * b);
    boar.snoutY = ny + sn * (-11 * b) + c * (3.5 * b);
  }

  // ---- earth flicked up by the snout ---------------------------------------

  function makeDirt() {
    const f = () => new Float32Array(DIRT);
    return { x: f(), y: f(), vx: f(), vy: f(), life: f(), tone: f() };
  }

  function stepDirt(g, boar, D, dt) {
    if (boar.nose > 0.7 && state.rand() < dt * 9) {
      for (let i = 0; i < DIRT; i++) {
        if (D.life[i] > 0) continue;
        D.x[i] = boar.snoutX;
        D.y[i] = boar.snoutY;
        D.vx[i] = g.U * (2 + state.rand() * 6) * (state.rand() < 0.7 ? 1 : -1);
        D.vy[i] = -g.U * (6 + state.rand() * 8);
        D.life[i] = 1;
        D.tone[i] = Math.floor(state.rand() * DIRT_TONES.length);
        break;
      }
    }
    for (let i = 0; i < DIRT; i++) {
      if (D.life[i] <= 0) continue;
      D.vy[i] += g.U * 40 * dt;
      D.x[i] += D.vx[i] * dt;
      D.y[i] += D.vy[i] * dt;
      if (D.y[i] > g.floor + g.U) D.life[i] = 0;
    }
  }

  function drawDirt(ctx, g, D) {
    const s = Math.max(1, g.U * 0.9);
    for (let i = 0; i < DIRT; i++) {
      if (D.life[i] <= 0) continue;
      ctx.fillStyle = DIRT_TONES[D.tone[i]];
      ctx.fillRect(D.x[i] - s / 2, D.y[i] - s / 2, s, s);
    }
  }

  // ---- falling leaves ------------------------------------------------------

  function makeLeaves() {
    const f = () => new Float32Array(MAX_LEAVES);
    return { x: f(), y: f(), vx: f(), vy: f(), a: f(), spin: f(), p: f(), size: f(), land: f(), timer: f(), tone: f(), mode: f() };
  }

  function resetLeaf(g, L, i, scatter) {
    const r = state.rand;
    L.x[i] = r() * g.W * 1.1 - g.W * 0.1;
    L.y[i] = g.H * r() * 0.2 - g.U * 2;
    L.land[i] = g.gy + (g.H - g.gy) * (0.1 + r() * 0.85);
    L.vy[i] = g.U * (2.6 + r() * 1.8);
    L.vx[i] = g.U * (0.4 + r() * 1);
    L.size[i] = g.U * (1.3 + r() * 0.9);
    L.tone[i] = Math.floor(r() * LEAF_TONES.length);
    L.spin[i] = (r() - 0.5) * 3;
    L.a[i] = r() * TAU;
    L.p[i] = r() * TAU;
    L.mode[i] = 0;
    L.timer[i] = 0;
    if (!scatter) return;
    if (r() < 0.75) L.y[i] = lerp(L.y[i], L.land[i], r());
    else {
      L.mode[i] = 2;
      L.timer[i] = r() * 6;
    }
  }

  function stepLeaf(g, L, i, t, dt) {
    if (L.mode[i] === 0) {
      L.y[i] += L.vy[i] * dt;
      L.x[i] += (L.vx[i] + Math.sin(t * 1.1 + L.p[i]) * g.U * 2.4) * dt;
      L.a[i] += L.spin[i] * dt;
      if (L.y[i] >= L.land[i]) {
        L.mode[i] = 1;
        L.timer[i] = 0;
      }
    } else if (L.mode[i] === 1) {
      L.timer[i] += dt;
      if (L.timer[i] > 6) {
        L.mode[i] = 2;
        L.timer[i] = state.rand() * 4;
      }
    } else {
      L.timer[i] -= dt;
      if (L.timer[i] <= 0) resetLeaf(g, L, i, false);
    }
  }

  function drawLeaves(ctx, g, t, count) {
    const L = state.leaves;
    for (let i = 0; i < count; i++) {
      if (L.mode[i] === 2) continue;
      const c = Math.cos(L.a[i]);
      const s = Math.sin(L.a[i]);
      const sz = L.size[i];
      const sq = L.mode[i] === 0 ? 0.4 + 0.6 * Math.abs(Math.sin(t * 1.8 + L.p[i])) : 1;
      ctx.globalAlpha = L.mode[i] === 1 ? Math.max(0, 1 - L.timer[i] / 6) : 1;
      ctx.fillStyle = LEAF_TONES[L.tone[i]];
      ctx.setTransform(c * sq, s * sq, -s, c, L.x[i], L.y[i]);
      ctx.fillRect(-sz / 2, -sz * 0.35, sz, sz * 0.7);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.front = paintFront(g, rand);
    state.shafts = paintShafts(g);
    state.body = paintBody(g);
    state.head = paintHead(g);
    if (!state.boar) state.boar = makeBoar(g, rand);
    state.boar.x = Math.min(state.boar.x, g.W + g.b * 30);
    state.dirt = makeDirt();
    state.leaves = makeLeaves();
    for (let i = 0; i < MAX_LEAVES; i++) resetLeaf(g, state.leaves, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { leaves, light } = api.props;
    const count = Math.min(MAX_LEAVES, Math.round(LEAVES * leaves));
    const step = Math.min(dt, 0.1);
    stepBoar(g, state.boar, step);
    stepDirt(g, state.boar, state.dirt, step);
    for (let i = 0; i < count; i++) stepLeaf(g, state.leaves, i, t, step);
    ctx.drawImage(state.back, 0, 0);
    if (light > 0) {
      ctx.globalAlpha = Math.min(0.5, light * (0.14 + Math.sin(t * 0.25) * 0.04));
      ctx.drawImage(state.shafts, 0, 0);
      ctx.globalAlpha = 1;
    }
    drawBoar(ctx, g, t, state.boar);
    drawDirt(ctx, g, state.dirt);
    ctx.drawImage(state.front, 0, 0);
    drawLeaves(ctx, g, t, count);
  }

  Kasuri.run({
    defaults: { leaves: 1, light: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
