/*
 * 目白 Mejiro — green white-eyes hopping along a blossoming plum branch.
 *
 * Sky, distant blossom and the near branch with its flowers are baked once. Each frame
 * draws the birds (a handful of ellipses each) and a short reused pool of petals.
 * Birds sit, bob and peck, then hop to another spot along the branch.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp } = K;

  const TAU = Math.PI * 2;
  const SKY = ['#8f9aab', '#a9aeb3', '#c3c0b4', '#d8d0bc', '#e6dcc6'];
  const BOKEH = ['#b9b4b6', '#c9bfbb', '#d3c7c0'];
  const BARK = { dark: '#2e2622', mid: '#463a31', lit: '#6a5a4a', moss: '#5d6a3c' };
  const WHITE = { petal: '#f6f0e4', shade: '#c9b8b0', heart: '#b8862f' };
  const RED = { petal: '#c4553f', shade: '#9a3a2c', heart: '#e2b85a' };
  const BUD = '#a8402f';
  const BIRD = {
    back: '#6f7f36', head: '#86963f', wing: '#4f5d2b', tail: '#3f4a24',
    belly: '#d9d2bd', flank: '#b9ad8e', throat: '#cdb24a', eye: '#f4efe2', ink: '#1f1a17',
  };
  const PETAL_TONES = ['#f1eadb', '#e6cfc4', '#c4553f'];
  const MAX_BIRDS = 5;
  const MAX_PETALS = 40;
  const PETALS = 18;
  const PERCH_STEP = 2.2;
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

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const u = U * Math.min(1, W / (U * 150));
    return { W, H, U, u };
  }

  // ---- sky and distant blossom ---------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.H);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / (g.H * 0.85)) * (inks.length - 1);
      const k = Math.floor(f);
      for (let x = 0; x < g.W; x++) {
        const step = K.bayer4(x, y) < f - k ? 1 : 0;
        const ink = inks[Math.min(inks.length - 1, k + step)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 14; i++) {
      const x = g.W * (0.5 + rand() * 0.55);
      const y = g.H * (0.04 + rand() * 0.36);
      const r = g.U * (2 + rand() * 3.5);
      const tone = Math.min(1, Math.floor(y / (g.H * 0.2)));
      ctx.fillStyle = BOKEH[tone];
      blob(ctx, x, y, r, r);
      ctx.fillStyle = BOKEH[tone + 1];
      blob(ctx, x - r * 0.2, y - r * 0.2, r * 0.55, r * 0.55);
    }
    ctx.strokeStyle = '#a9a4a0';
    ctx.lineCap = 'round';
    ctx.lineWidth = g.U * 1.4;
    ctx.beginPath();
    ctx.moveTo(g.W * 1.02, g.H * 0.12);
    ctx.lineTo(g.W * 0.82, g.H * 0.2);
    ctx.lineTo(g.W * 0.7, g.H * 0.16);
    ctx.moveTo(g.W * 0.82, g.H * 0.2);
    ctx.lineTo(g.W * 0.74, g.H * 0.34);
    ctx.stroke();
  }

  // ---- branch ---------------------------------------------------------------

  // Plum grows in angular zigzags: a polyline with a tapering width.
  function mainLimb(g) {
    const { W, H } = g;
    return [
      [-W * 0.02, H * 0.86, 4.2],
      [W * 0.16, H * 0.74, 3.6],
      [W * 0.3, H * 0.77, 3.1],
      [W * 0.46, H * 0.63, 2.6],
      [W * 0.6, H * 0.6, 2.1],
      [W * 0.74, H * 0.48, 1.6],
      [W * 0.86, H * 0.45, 1.1],
      [W * 0.95, H * 0.36, 0.6],
    ];
  }

  function strokeLimb(ctx, g, pts, ink, scale, dy) {
    ctx.strokeStyle = ink;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      ctx.lineWidth = Math.max(1, g.U * a[2] * scale);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1] + dy * g.U * a[2]);
      ctx.lineTo(b[0], b[1] + dy * g.U * b[2]);
      ctx.stroke();
    }
  }

  function twig(g, rand, x, y, up, len) {
    const pts = [[x, y, 0.9]];
    let px = x;
    let py = y;
    const n = 3;
    for (let i = 1; i <= n; i++) {
      px += g.U * (len / n) * (0.35 + rand() * 0.5) * (i % 2 ? 1 : 0.4);
      py -= up * g.U * (len / n) * (0.7 + rand() * 0.4);
      pts.push([px, py, Math.max(0.3, 0.9 - i * 0.22)]);
    }
    return pts;
  }

  function flower(ctx, g, x, y, r, tone, rot) {
    const p = tone;
    ctx.fillStyle = p.shade;
    for (let k = 0; k < 5; k++) {
      const a = rot + (k / 5) * TAU;
      blob(ctx, x + Math.cos(a) * r * 0.62 + r * 0.12, y + Math.sin(a) * r * 0.62 + r * 0.12, r * 0.5, r * 0.5);
    }
    ctx.fillStyle = p.petal;
    for (let k = 0; k < 5; k++) {
      const a = rot + (k / 5) * TAU;
      blob(ctx, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.46, r * 0.46);
    }
    ctx.fillStyle = p.heart;
    blob(ctx, x, y, r * 0.3, r * 0.3);
  }

  function along(pts, f) {
    const n = pts.length - 1;
    const s = Math.min(n - 1e-6, Math.max(0, f * n));
    const i = Math.floor(s);
    const t = s - i;
    return [lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t), lerp(pts[i][2], pts[i + 1][2], t)];
  }

  function paintBranch(ctx, g, rand) {
    const limb = mainLimb(g);
    const twigs = [];
    for (let i = 0; i < 13; i++) {
      const f = 0.08 + i * 0.07 + rand() * 0.03;
      const [x, y, w] = along(limb, f);
      const up = i % 3 === 2 ? -0.6 : 1;
      twigs.push(twig(g, rand, x, y - (up > 0 ? w * g.U * 0.3 : -w * g.U * 0.3), up, 10 + rand() * 12));
    }
    for (const t of twigs) strokeLimb(ctx, g, t, BARK.dark, 1, 0);
    strokeLimb(ctx, g, limb, BARK.dark, 1, 0);
    strokeLimb(ctx, g, limb, BARK.mid, 0.6, -0.12);
    strokeLimb(ctx, g, limb, BARK.lit, 0.22, -0.32);
    ctx.fillStyle = BARK.moss;
    for (let i = 0; i < 14; i++) {
      const [x, y, w] = along(limb, rand() * 0.75);
      blob(ctx, x, y - w * g.U * 0.25, g.U * (0.6 + rand()), g.U * 0.4);
    }
    const spots = [];
    for (const t of twigs) {
      for (let k = 1; k < t.length; k++) spots.push(t[k][0], t[k][1]);
      for (let k = 0; k < 3; k++) {
        const a = t[1 + Math.floor(rand() * (t.length - 1))];
        spots.push(a[0] + (rand() - 0.5) * g.U * 2, a[1] + (rand() - 0.5) * g.U * 2);
      }
    }
    for (let i = 0; i < 16; i++) {
      const [x, y, w] = along(limb, 0.05 + rand() * 0.9);
      spots.push(x + (rand() - 0.5) * g.U * 2, y + w * g.U * (rand() < 0.5 ? 0.6 : -0.6));
    }
    for (let i = 0; i < spots.length; i += 2) {
      const r = g.U * (1.6 + rand() * 0.9);
      const roll = rand();
      if (roll < 0.18) {
        ctx.fillStyle = BUD;
        blob(ctx, spots[i], spots[i + 1], r * 0.45, r * 0.55);
      } else {
        flower(ctx, g, spots[i], spots[i + 1], r, roll < 0.7 ? WHITE : RED, rand() * TAU);
      }
    }
    return limb;
  }

  function makePerches(g, limb) {
    const xs = [];
    const ys = [];
    const slope = [];
    for (let i = 0; i < limb.length - 1; i++) {
      const a = limb[i];
      const b = limb[i + 1];
      if (a[0] < g.W * 0.08 || a[2] < 1.4) continue;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.floor(len / (g.U * PERCH_STEP)));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const w = lerp(a[2], b[2], t);
        xs.push(lerp(a[0], b[0], t));
        ys.push(lerp(a[1], b[1], t) - w * g.U * 0.45);
        slope.push(Math.atan2(b[1] - a[1], b[0] - a[0]));
      }
    }
    return { x: Float32Array.from(xs), y: Float32Array.from(ys), a: Float32Array.from(slope), n: xs.length };
  }

  // ---- birds ------------------------------------------------------------------

  function makeBirds() {
    const f = () => new Float32Array(MAX_BIRDS);
    return { at: f(), to: f(), hop: f(), timer: f(), face: f(), peck: f(), phase: f(), size: f() };
  }

  function taken(B, j, idx, count) {
    for (let i = 0; i < count; i++) {
      if (i === j) continue;
      if (Math.abs(B.at[i] - idx) < 7 || Math.abs(B.to[i] - idx) < 7) return true;
    }
    return false;
  }

  function placeBirds(g, count) {
    const B = state.birds;
    const P = state.perches;
    const r = state.rand;
    for (let i = 0; i < MAX_BIRDS; i++) {
      let idx = Math.floor(((i % count + 0.5) / count) * P.n);
      idx = Math.min(P.n - 1, Math.max(0, idx + Math.floor((r() - 0.5) * 3)));
      B.at[i] = idx;
      B.to[i] = idx;
      B.hop[i] = -1;
      B.timer[i] = 0.5 + r() * 2.5;
      B.face[i] = r() < 0.5 ? 1 : -1;
      B.peck[i] = 0;
      B.phase[i] = r() * TAU;
      B.size[i] = g.U * (1.85 + r() * 0.2);
    }
  }

  function stepBird(g, B, i, count, dt) {
    const P = state.perches;
    const r = state.rand;
    if (B.hop[i] >= 0) {
      B.hop[i] += dt / 0.42;
      if (B.hop[i] >= 1) {
        B.hop[i] = -1;
        B.at[i] = B.to[i];
        B.timer[i] = 0.8 + r() * 2.6;
      }
      return;
    }
    if (B.peck[i] > 0) B.peck[i] = Math.max(0, B.peck[i] - dt * 2.2);
    B.timer[i] -= dt;
    if (B.timer[i] > 0) {
      if (r() < dt * 0.35) B.peck[i] = 1;
      return;
    }
    const roll = r();
    if (roll < 0.25) {
      B.face[i] = -B.face[i];
      B.timer[i] = 0.6 + r() * 1.5;
      return;
    }
    const dir = r() < 0.75 ? B.face[i] : -B.face[i];
    const target = Math.round(B.at[i] + dir * (2 + Math.floor(r() * 4)));
    if (target < 0 || target >= P.n || taken(B, i, target, count)) {
      B.face[i] = -B.face[i];
      B.timer[i] = 0.4 + r();
      return;
    }
    B.face[i] = dir;
    B.to[i] = target;
    B.hop[i] = 0;
  }

  // One white-eye facing +x, feet at the origin. s is the body unit.
  function drawBird(ctx, s, tilt, bob, peck, flap) {
    const c = BIRD;
    ctx.fillStyle = c.tail;
    blob(ctx, -3.6 * s, -2.4 * s + bob, 2.4 * s, 0.7 * s, 0.55);
    ctx.fillStyle = c.flank;
    blob(ctx, 0.2 * s, -2.5 * s + bob, 3 * s, 1.9 * s, -0.15);
    ctx.fillStyle = c.back;
    blob(ctx, -0.2 * s, -3.4 * s + bob, 3.1 * s, 1.9 * s, -0.25 + tilt * 0.3);
    ctx.fillStyle = c.belly;
    blob(ctx, 0.9 * s, -2.1 * s + bob, 2.1 * s, 1.1 * s, -0.2);
    ctx.fillStyle = c.wing;
    blob(ctx, -0.9 * s, -3.3 * s + bob - flap * s, 2.3 * s, 1.2 * s + flap * s * 0.6, 0.15 - flap * 0.6);
    const hx = 2.5 * s + peck * 0.9 * s;
    const hy = -5 * s + bob + peck * 1.6 * s;
    ctx.fillStyle = c.throat;
    blob(ctx, hx + 0.3 * s, hy + 1.3 * s, 1.3 * s, 0.9 * s);
    ctx.fillStyle = c.head;
    blob(ctx, hx, hy, 1.85 * s, 1.7 * s);
    ctx.fillStyle = c.ink;
    ctx.beginPath();
    ctx.moveTo(hx + 1.5 * s, hy - 0.45 * s);
    ctx.lineTo(hx + 3.1 * s, hy + 0.15 * s + peck * 0.4 * s);
    ctx.lineTo(hx + 1.5 * s, hy + 0.55 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = c.eye;
    blob(ctx, hx + 0.55 * s, hy - 0.2 * s, 0.85 * s, 0.85 * s);
    ctx.fillStyle = c.ink;
    blob(ctx, hx + 0.65 * s, hy - 0.2 * s, 0.42 * s, 0.42 * s);
    if (flap === 0) {
      ctx.strokeStyle = c.ink;
      ctx.lineWidth = Math.max(1, s * 0.35);
      ctx.beginPath();
      ctx.moveTo(-0.2 * s, -1.2 * s + bob);
      ctx.lineTo(-0.5 * s, 0);
      ctx.moveTo(0.9 * s, -1.2 * s + bob);
      ctx.lineTo(0.8 * s, 0);
      ctx.stroke();
    }
  }

  function drawBirds(ctx, t, count) {
    const B = state.birds;
    const P = state.perches;
    for (let i = 0; i < count; i++) {
      let x;
      let y;
      let a;
      let bob = 0;
      let flap = 0;
      const s = B.size[i];
      if (B.hop[i] >= 0) {
        const h = B.hop[i];
        const e = h * h * (3 - 2 * h);
        x = lerp(P.x[B.at[i]], P.x[B.to[i]], e);
        y = lerp(P.y[B.at[i]], P.y[B.to[i]], e) - Math.sin(h * Math.PI) * s * 4.5;
        a = lerp(P.a[B.at[i]], P.a[B.to[i]], e) * 0.4;
        flap = 0.6 + 0.6 * Math.sin(h * 26);
      } else {
        x = P.x[B.at[i]];
        y = P.y[B.at[i]];
        a = P.a[B.at[i]] * 0.35;
        bob = Math.sin(t * 3 + B.phase[i]) * s * 0.18;
      }
      const f = B.face[i];
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      ctx.setTransform(ca * f, sa * f, -sa, ca, x, y);
      drawBird(ctx, s, 0, bob, B.peck[i] * Math.sin(B.peck[i] * Math.PI), flap);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- petals ----------------------------------------------------------------

  function makePetals() {
    const f = () => new Float32Array(MAX_PETALS);
    return { x: f(), y: f(), vx: f(), vy: f(), a: f(), spin: f(), p: f(), size: f(), tone: f() };
  }

  function resetPetal(g, L, i, scatter) {
    const r = state.rand;
    L.x[i] = g.W * (0.1 + r() * 0.85);
    L.y[i] = scatter ? r() * g.H : g.H * (0.3 + r() * 0.35) - g.U * 30 * r();
    L.vy[i] = g.U * (2 + r() * 2);
    L.vx[i] = -g.U * (0.6 + r() * 1.2);
    L.size[i] = g.U * (0.7 + r() * 0.6);
    L.tone[i] = r() < 0.75 ? (r() < 0.6 ? 0 : 1) : 2;
    L.spin[i] = (r() - 0.5) * 4;
    L.a[i] = r() * TAU;
    L.p[i] = r() * TAU;
  }

  function drawPetals(ctx, g, t, dt, count) {
    const L = state.petals;
    for (let i = 0; i < count; i++) {
      L.y[i] += L.vy[i] * dt;
      L.x[i] += (L.vx[i] + Math.sin(t * 1.4 + L.p[i]) * g.U * 1.8) * dt;
      L.a[i] += L.spin[i] * dt;
      if (L.y[i] > g.H + g.U * 2 || L.x[i] < -g.U * 3) resetPetal(g, L, i, false);
      const c = Math.cos(L.a[i]);
      const s = Math.sin(L.a[i]);
      const sq = 0.35 + 0.65 * Math.abs(Math.sin(t * 2 + L.p[i]));
      const sz = L.size[i];
      ctx.fillStyle = PETAL_TONES[L.tone[i]];
      ctx.setTransform(c * sq, s * sq, -s, c, L.x[i], L.y[i]);
      ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run -------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = layer(g.W, g.H);
    const bctx = state.back.getContext('2d');
    paintSky(bctx, g, rand);
    const limb = paintBranch(bctx, g, rand);
    state.perches = makePerches(g, limb);
    state.birds = makeBirds();
    state.count = 0;
    state.petals = makePetals();
    for (let i = 0; i < MAX_PETALS; i++) resetPetal(g, state.petals, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { birds, petals } = api.props;
    const count = Math.max(1, Math.min(MAX_BIRDS, Math.round(birds)));
    const pc = Math.min(MAX_PETALS, Math.round(PETALS * petals));
    const step = Math.min(dt, 0.1);
    if (count !== state.count) {
      state.count = count;
      placeBirds(g, count);
    }
    for (let i = 0; i < count; i++) stepBird(g, state.birds, i, count, step);
    ctx.drawImage(state.back, 0, 0);
    drawBirds(ctx, t, count);
    drawPetals(ctx, g, t, step, pc);
  }

  Kasuri.run({
    defaults: { birds: 3, petals: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
