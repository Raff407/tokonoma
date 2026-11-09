/*
 * 翡翠 Kawasemi — a kingfisher on a branch over a clear stream.
 *
 * Far bank, branch, stones and reeds are baked once. The stream is one tile of
 * flat tones and streaks drawn in four bands that slide at their own pace.
 * The bird is a single baked sprite, turned and moved along a short path when
 * it drops into the water, with a few rings and drops where it goes in.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.57;
  const BANDS = 4;
  const GLINTS = 18;
  const DROPS = 10;
  const CYCLE = 18;
  const DIVE_AT = 11;
  const DIVE_LEN = 0.9;
  const UNDER = 0.35;
  const BACK_LEN = 2.1;
  const SKY = ['#d8d4bf', '#cfcfba', '#c3c8b2'];
  const CANOPY = ['#a9b183', '#8e9c6a', '#738757', '#5b7049'];
  const WATER_TONES = ['#8fb0ae', '#7ca2a4', '#6994a0', '#58869a', '#4a7890'];
  const STREAK_TONES = ['#b4cdc8', '#d6dfd2', '#9dbcbc'];
  const BIRD = {
    crown: '#2c6378', wing: '#336f84', light: '#5f9aa6', stripe: '#88bcbc',
    breast: '#c8733a', breastDark: '#a85a2e', white: '#e6e0cc', beak: '#2a2420',
    feet: '#b8412c', eye: '#1e1a18',
  };
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
    const s = U * 1.35 * Math.min(1, W / (U * 120));
    const wy = Math.round(H * WATER);
    return { W, H, U, s, wy };
  }

  // ---- far bank ------------------------------------------------------------

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.wy);
    const d = img.data;
    const sky = SKY.map(K.parseColor);
    const can = CANOPY.map(K.parseColor);
    const ridges = [0.1, 0.2, 0.31, 0.42];
    for (let x = 0; x < g.W; x++) {
      const tops = ridges.map((r, k) => g.H * r + (fbm(x / (g.U * (9 - k)), k * 3.1, 3, 11 + k) - 0.5) * g.H * 0.16);
      for (let y = 0; y < g.wy; y++) {
        let ink = sky[Math.min(2, Math.floor((y / (g.H * 0.3)) * 3))];
        for (let k = 0; k < 4; k++) if (y >= tops[k]) ink = can[k];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    paintTrunks(ctx, g, rand);
    paintBankEdge(ctx, g, rand);
    return c;
  }

  function paintTrunks(ctx, g, rand) {
    ctx.fillStyle = '#6a6250';
    for (let i = 0; i < 7; i++) {
      const x = g.W * (0.08 + i * 0.14 + rand() * 0.05);
      const top = g.H * (0.24 + rand() * 0.1);
      ctx.fillRect(x, top, g.U * (0.8 + rand() * 0.6), g.wy - top);
    }
    ctx.fillStyle = CANOPY[1];
    for (let i = 0; i < 26; i++) {
      blob(ctx, rand() * g.W, g.H * (0.3 + rand() * 0.16), g.U * (3 + rand() * 4), g.U * (2 + rand() * 2));
    }
    ctx.fillStyle = CANOPY[3];
    for (let i = 0; i < 22; i++) {
      blob(ctx, rand() * g.W, g.H * (0.45 + rand() * 0.09), g.U * (3 + rand() * 5), g.U * (1.5 + rand() * 1.5));
    }
  }

  function paintBankEdge(ctx, g, rand) {
    ctx.fillStyle = '#5e5844';
    ctx.fillRect(0, g.wy - g.U * 1.6, g.W, g.U * 1.6);
    ctx.fillStyle = '#8c8673';
    for (let i = 0; i < 40; i++) {
      blob(ctx, rand() * g.W, g.wy - g.U * 0.6, g.U * (0.8 + rand() * 1.6), g.U * (0.4 + rand() * 0.5));
    }
  }

  // ---- stream ----------------------------------------------------------------

  function paintWaterTile(g, rand) {
    const h = g.H - g.wy;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    for (let k = 0; k < WATER_TONES.length; k++) {
      ctx.fillStyle = WATER_TONES[k];
      const y0 = Math.floor((h * k) / WATER_TONES.length);
      ctx.fillRect(0, y0, g.W, h - y0);
    }
    ctx.fillStyle = '#5d7c6c';
    for (let x = 0; x < g.W; x += 2) {
      const r = g.U * (2.5 + fbm(x / (g.U * 6), 0.5, 2, 5) * 4);
      ctx.fillRect(x, 0, 2, r);
    }
    const n = Math.round((g.W * h) / (g.U * g.U * 24));
    for (let i = 0; i < n; i++) {
      const y = Math.pow(rand(), 0.8) * h;
      const near = y / h;
      const len = g.U * (2 + rand() * 8) * (0.6 + near);
      const x = rand() * g.W;
      ctx.fillStyle = STREAK_TONES[Math.floor(rand() * STREAK_TONES.length)];
      const th = Math.max(1, Math.round(g.U * (0.3 + near * 0.5)));
      ctx.fillRect(x, y, len, th);
      if (x + len > g.W) ctx.fillRect(x - g.W, y, len, th);
    }
    return c;
  }

  function drawWater(ctx, g, flowT) {
    const tile = state.water;
    const h = tile.height;
    for (let k = 0; k < BANDS; k++) {
      const y0 = Math.floor((h * k) / BANDS);
      const y1 = Math.floor((h * (k + 1)) / BANDS);
      const off = (flowT * g.U * (2.5 + k * 3)) % g.W;
      const bh = y1 - y0;
      ctx.drawImage(tile, 0, y0, g.W, bh, off, g.wy + y0, g.W, bh);
      ctx.drawImage(tile, 0, y0, g.W, bh, off - g.W, g.wy + y0, g.W, bh);
    }
  }

  function makeGlints(g, rand) {
    const G = { x: new Float32Array(GLINTS), y: new Float32Array(GLINTS), p: new Float32Array(GLINTS) };
    for (let i = 0; i < GLINTS; i++) {
      G.x[i] = rand() * g.W;
      G.y[i] = g.wy + g.U * 3 + rand() * (g.H - g.wy - g.U * 4);
      G.p[i] = rand() * TAU;
    }
    return G;
  }

  function drawGlints(ctx, g, t, flowT) {
    const G = state.glints;
    ctx.fillStyle = '#e8e2d0';
    for (let i = 0; i < GLINTS; i++) {
      const near = (G.y[i] - g.wy) / (g.H - g.wy);
      const x = (G.x[i] + flowT * g.U * (3 + near * 9)) % g.W;
      const a = 0.5 + 0.5 * Math.sin(t * 0.8 + G.p[i]);
      ctx.globalAlpha = a * 0.8;
      ctx.fillRect(x, G.y[i], g.U * (1.5 + near * 2.5), Math.max(1, g.U * 0.4));
    }
    ctx.globalAlpha = 1;
  }

  // ---- branch, stones, reeds ---------------------------------------------------

  function branchY(g, x) {
    const f = x / (g.W * 0.5);
    return g.H * (0.37 + 0.06 * f + 0.02 * Math.sin(f * 3));
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintStones(ctx, g, rand);
    paintReeds(ctx, g, rand);
    paintBranch(ctx, g, rand);
    return c;
  }

  function paintStones(ctx, g, rand) {
    const stones = [[0.7, 0.7, 9, 3.4], [0.84, 0.66, 6, 2.4], [0.18, 0.78, 11, 4], [0.56, 0.86, 7, 2.6]];
    for (const [fx, fy, rx, ry] of stones) {
      const x = g.W * fx;
      const y = g.H * fy;
      ctx.fillStyle = '#e0e2d6';
      blob(ctx, x, y + g.U * ry * 0.6, g.U * rx * 1.15, g.U * 0.9);
      ctx.fillStyle = '#4d4a40';
      blob(ctx, x, y, g.U * rx, g.U * ry);
      ctx.fillStyle = '#7a7666';
      blob(ctx, x - g.U * rx * 0.15, y - g.U * ry * 0.35, g.U * rx * 0.75, g.U * ry * 0.55);
      ctx.fillStyle = CANOPY[1];
      blob(ctx, x - g.U * rx * 0.25, y - g.U * ry * 0.7, g.U * rx * 0.45, g.U * ry * 0.25);
      ctx.fillStyle = '#d2d9cf';
      ctx.fillRect(x - g.U * rx * 1.4, y + g.U * ry * 0.5, g.U * rx * 0.5, Math.max(1, g.U * 0.4));
    }
  }

  function paintReeds(ctx, g, rand) {
    ctx.lineCap = 'round';
    const tones = ['#5f7a4a', '#7d8c55', '#a69454'];
    for (let i = 0; i < 26; i++) {
      const x = g.W * (0.86 + rand() * 0.16);
      const top = g.H * (0.58 + rand() * 0.2);
      ctx.strokeStyle = tones[i % 3];
      ctx.lineWidth = Math.max(1, g.U * (0.5 + rand() * 0.4));
      ctx.beginPath();
      ctx.moveTo(x, g.H + 2);
      ctx.quadraticCurveTo(x - g.U * 2, (top + g.H) / 2, x - g.U * (2 + rand() * 5), top);
      ctx.stroke();
    }
  }

  function paintBranch(ctx, g, rand) {
    ctx.lineCap = 'round';
    const end = g.W * 0.52;
    const steps = 24;
    for (const [ink, grow, lift] of [['#2e241c', 0, 0], ['#4e3e30', -0.9, -0.5]]) {
      ctx.strokeStyle = ink;
      for (let i = 0; i < steps; i++) {
        const x0 = lerp(-g.U * 4, end, i / steps);
        const x1 = lerp(-g.U * 4, end, (i + 1) / steps);
        ctx.lineWidth = Math.max(1, g.U * (3.2 - 2.4 * (i / steps)) + grow * g.U * (1 - i / steps));
        ctx.beginPath();
        ctx.moveTo(x0, branchY(g, x0) + lift * g.U);
        ctx.lineTo(x1, branchY(g, x1) + lift * g.U);
        ctx.stroke();
      }
    }
    paintTwigs(ctx, g, rand);
  }

  function paintTwigs(ctx, g, rand) {
    const twigs = [[0.08, -1], [0.17, 1], [0.27, -1], [0.45, 1]];
    for (const [fx, dir] of twigs) {
      const x = g.W * fx;
      const y = branchY(g, x);
      const tx = x + g.U * (5 + rand() * 4);
      const ty = y + dir * g.U * (5 + rand() * 4);
      ctx.strokeStyle = '#2e241c';
      ctx.lineWidth = Math.max(1, g.U * 0.6);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(lerp(x, tx, 0.6), y, tx, ty);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const lx = lerp(x, tx, 0.4 + rand() * 0.7) + (rand() - 0.5) * g.U * 2;
        const ly = lerp(y, ty, 0.4 + rand() * 0.7) + (rand() - 0.5) * g.U * 2;
        ctx.fillStyle = i % 2 ? '#5b7647' : '#7f9659';
        blob(ctx, lx, ly, g.U * 1.6, g.U * 0.7, rand() * Math.PI);
      }
    }
  }

  // ---- the bird ------------------------------------------------------------------

  // Sprite faces right, perched upright; its centre is the pivot, feet sit 8s below.
  function paintBird(g) {
    const s = g.s;
    const c = layer(s * 28, s * 24);
    const ctx = c.getContext('2d');
    ctx.translate(s * 3, s * 2);
    ctx.fillStyle = BIRD.crown;
    poly(ctx, [s * 8.2, s * 15.5, s * 10.4, s * 16.6, s * 6.4, s * 21, s * 5, s * 20.2]);
    ctx.fillStyle = BIRD.breast;
    blob(ctx, s * 11.6, s * 12.8, s * 4.2, s * 6, 0.35);
    ctx.fillStyle = BIRD.breastDark;
    blob(ctx, s * 12.4, s * 15.2, s * 2.6, s * 3, 0.35);
    ctx.fillStyle = BIRD.wing;
    blob(ctx, s * 9.6, s * 11.8, s * 3.3, s * 5.8, 0.45);
    ctx.fillStyle = BIRD.light;
    for (let i = 0; i < 6; i++) blob(ctx, s * (10.6 - i * 0.45), s * (8.6 + i * 1.1), s * 0.45, s * 0.35);
    ctx.fillStyle = BIRD.stripe;
    blob(ctx, s * 8.4, s * 11.6, s * 0.9, s * 4.2, 0.45);
    ctx.fillStyle = BIRD.crown;
    blob(ctx, s * 13.4, s * 6.2, s * 3.6, s * 3.3);
    ctx.fillStyle = BIRD.light;
    for (let i = 0; i < 5; i++) blob(ctx, s * (11.6 + i * 0.8), s * (4.4 + (i % 2) * 0.6), s * 0.35, s * 0.3);
    ctx.fillStyle = BIRD.white;
    blob(ctx, s * 15.2, s * 8.8, s * 1.4, s * 1.1);
    blob(ctx, s * 11.2, s * 8.4, s * 1.1, s * 0.8);
    ctx.fillStyle = BIRD.breast;
    blob(ctx, s * 14.4, s * 7, s * 2, s * 0.85, 0.15);
    ctx.fillStyle = BIRD.eye;
    blob(ctx, s * 14.8, s * 5.9, s * 0.6, s * 0.6);
    ctx.fillStyle = BIRD.beak;
    poly(ctx, [s * 16, s * 5.2, s * 16.2, s * 7.6, s * 23.5, s * 6.9]);
    ctx.fillStyle = BIRD.feet;
    ctx.fillRect(s * 10.2, s * 18.2, s * 0.8, s * 1.6);
    ctx.fillRect(s * 11.8, s * 18.2, s * 0.8, s * 1.6);
    return c;
  }

  function quad(a, b, c, t) {
    const m = 1 - t;
    return m * m * a + 2 * m * t * b + t * t * c;
  }

  // Where the bird is and how it is turned for the current moment of its cycle.
  function birdPose(g, clock, t) {
    const P = state.perch;
    const Q = state.splash;
    const pose = state.pose;
    const c = clock % CYCLE;
    pose.flip = 1;
    pose.flap = 0;
    pose.show = true;
    if (c < DIVE_AT || c >= DIVE_AT + DIVE_LEN + UNDER + BACK_LEN) {
      pose.x = P.x;
      pose.y = P.y + Math.sin(t * 1.3) * g.s * 0.15;
      pose.a = Math.sin(t * 0.5) * 0.04;
      return pose;
    }
    const d = c - DIVE_AT;
    if (d < DIVE_LEN) {
      const k = smoothstep(0, 1, d / DIVE_LEN);
      pose.x = quad(P.x, P.x + g.s * 12, Q.x, k);
      pose.y = quad(P.y, P.y - g.s * 3, Q.y, k * k);
      pose.a = lerp(0, 2.2, Math.min(1, k * 1.6));
      return pose;
    }
    if (d < DIVE_LEN + UNDER) {
      pose.show = false;
      return pose;
    }
    const k = (d - DIVE_LEN - UNDER) / BACK_LEN;
    const e = smoothstep(0, 1, k);
    pose.x = quad(Q.x, Q.x + g.s * 6, P.x, e);
    pose.y = quad(Q.y, P.y - g.s * 10, P.y, e);
    pose.flip = k < 0.85 ? -1 : 1;
    pose.a = k < 0.85 ? lerp(-0.6, -1.0, k) : 0;
    pose.flap = k < 0.85 ? Math.sin(t * 22) : 0;
    return pose;
  }

  function drawBird(ctx, g, pose) {
    if (!pose.show) return;
    const b = state.bird;
    const ca = Math.cos(pose.a);
    const sa = Math.sin(pose.a);
    const f = pose.flip;
    ctx.setTransform(ca * f, sa * f, -sa, ca, pose.x, pose.y);
    ctx.drawImage(b, -g.s * 14, -g.s * 12);
    if (pose.flap !== 0) {
      ctx.fillStyle = BIRD.wing;
      blob(ctx, -g.s * 3, -g.s * 2 - pose.flap * g.s * 4, g.s * 2.6, g.s * (1.5 + Math.abs(pose.flap) * 4), 0.4);
      ctx.fillStyle = BIRD.stripe;
      blob(ctx, -g.s * 3.6, -g.s * 2 - pose.flap * g.s * 4, g.s * 0.7, g.s * (0.8 + Math.abs(pose.flap) * 2.5), 0.4);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- splash ----------------------------------------------------------------------

  function makeDrops(rand) {
    const D = { vx: new Float32Array(DROPS), vy: new Float32Array(DROPS) };
    for (let i = 0; i < DROPS; i++) {
      D.vx[i] = (rand() - 0.5) * 16;
      D.vy[i] = -(10 + rand() * 12);
    }
    return D;
  }

  function drawSplash(ctx, g, clock) {
    const since = (clock % CYCLE) - (DIVE_AT + DIVE_LEN);
    if (since < 0 || since > 3) return;
    const Q = state.splash;
    const wy = Q.y + g.s * 2;
    ctx.strokeStyle = '#d6e0d6';
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    for (let r = 0; r < 3; r++) {
      const k = since - r * 0.35;
      if (k <= 0) continue;
      ctx.globalAlpha = Math.max(0, 1 - k / 2.6) * 0.9;
      ctx.beginPath();
      ctx.ellipse(Q.x, wy, g.U * (1 + k * 6), g.U * (0.4 + k * 1.6), 0, 0, TAU);
      ctx.stroke();
    }
    if (since < 0.9) {
      const D = state.drops;
      ctx.fillStyle = '#e6e0cc';
      ctx.globalAlpha = 1 - since / 0.9;
      for (let i = 0; i < DROPS; i++) {
        const x = Q.x + D.vx[i] * g.U * since;
        const y = wy + (D.vy[i] * since + 30 * since * since) * g.U;
        if (y <= wy) ctx.fillRect(x, y, Math.max(1, g.U * 0.6), Math.max(1, g.U * 0.6));
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -------------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.water = paintWaterTile(g, rand);
    state.front = paintFront(g, rand);
    state.bird = paintBird(g);
    state.glints = makeGlints(g, rand);
    state.drops = makeDrops(rand);
    const px = g.W * 0.36;
    state.perch = { x: px, y: branchY(g, px) - g.s * 8.4 };
    state.splash = { x: px + g.s * 20, y: g.H * 0.68 };
    state.pose = { x: 0, y: 0, a: 0, flip: 1, flap: 0, show: true };
    if (state.clock === undefined) state.clock = 3;
    state.flowT = state.flowT || 0;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { flow, dives } = api.props;
    state.clock += dt * dives;
    state.flowT += dt * flow;
    ctx.drawImage(state.back, 0, 0);
    drawWater(ctx, g, state.flowT);
    drawGlints(ctx, g, t, state.flowT);
    drawSplash(ctx, g, state.clock);
    ctx.drawImage(state.front, 0, 0);
    drawBird(ctx, g, birdPose(g, state.clock, t));
  }

  Kasuri.run({
    defaults: { flow: 1, dives: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
