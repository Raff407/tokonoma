/*
 * 花筏 Hanaikada — fallen cherry petals gathered into rafts on a castle moat.
 *
 * Sky, the stone wall with its turret and the overhanging branches are baked once.
 * The moat is the wall flipped and laid back in thin rows that sway sideways. Petal
 * rafts are a few baked sprites sliding along the water; a short pool of petals falls.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.6;
  const SKY = ['#8e9cb0', '#a7afb8', '#c4c2b6', '#d8cdb0', '#e2d2a8'];
  const STONE = ['#8d877a', '#9d9786', '#aaa391', '#7c776c', '#b4ab95', '#8f8875'];
  const MORTAR = '#4a4842';
  const PLASTER = { lit: '#e6dfcc', side: '#b9b3a2' };
  const ROOF = { slope: '#3f4448', edge: '#2a2d30', ridge: '#55595c' };
  const BARK = '#3a2e28';
  const BLOSSOM = ['#c98f8c', '#dba9a3', '#e8c5bb', '#f1ddd2'];
  const PETAL = ['#e9c8be', '#f2dfd4', '#d9a7a0', '#e2b8ae'];
  const WATER_INK = '#33464d';
  const RAFTS = 9;
  const RAFT_KINDS = 5;
  const MAX_FALL = 40;
  const FALL = 18;
  const BAND = 2;
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
    const wy = Math.round(H * WATER);
    return { W, H, U, wy, top: H * 0.3, corner: W * 0.64 };
  }

  // ---- sky, wall and turret --------------------------------------------------

  function paintSky(ctx, g, rand) {
    const h = Math.ceil(g.H * 0.36);
    const img = ctx.createImageData(g.W, h);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const f = Math.min(1, y / h) * (inks.length - 1);
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
    ctx.fillStyle = '#d9cfb8';
    for (let i = 0; i < 6; i++) {
      blob(ctx, g.W * (0.1 + rand() * 0.8), g.H * (0.06 + rand() * 0.12), g.U * (9 + rand() * 12), g.U * 0.6);
    }
  }

  // Top edge of the wall: level on the face, dropping slightly as the side recedes.
  function wallTop(g, x) {
    if (x <= g.corner) return g.top + (g.corner - x) * 0.02;
    return g.top + (x - g.corner) * 0.14;
  }

  // The face bows outward at its foot, so the stones lean in as they climb.
  function stones(ctx, g, rand, x0, x1, side) {
    const rows = 9;
    for (let r = 0; r < rows; r++) {
      const f0 = r / rows;
      const f1 = (r + 1) / rows;
      let x = x0 - rand() * g.U * 4;
      while (x < x1) {
        const w = g.U * (side ? 2.2 + rand() * 2.5 : 3.5 + rand() * 4.5);
        const ya = lerp(wallTop(g, x), g.wy, f0 * f0 * 0.3 + f0 * 0.7);
        const yb = lerp(wallTop(g, x), g.wy, f1 * f1 * 0.3 + f1 * 0.7);
        ctx.fillStyle = STONE[Math.floor(rand() * STONE.length)];
        const inset = Math.max(0.5, g.U * 0.25);
        ctx.fillRect(Math.max(x, x0) + inset, ya + inset, Math.min(w, x1 - x) - inset * 2, yb - ya - inset);
        if (side) {
          ctx.fillStyle = 'rgba(30,32,36,0.28)';
          ctx.fillRect(Math.max(x, x0) + inset, ya + inset, Math.min(w, x1 - x) - inset * 2, yb - ya - inset);
        }
        x += w;
      }
    }
  }

  function paintWall(ctx, g, rand) {
    ctx.fillStyle = MORTAR;
    ctx.beginPath();
    ctx.moveTo(0, g.wy);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, wallTop(g, x));
    ctx.lineTo(g.W, g.wy);
    ctx.fill();
    stones(ctx, g, rand, 0, g.corner - g.U * 3, false);
    stones(ctx, g, rand, g.corner + g.U * 3, g.W, true);
    // Corner stones: long and short blocks laid alternately.
    for (let r = 0; r < 9; r++) {
      const y0 = lerp(g.top, g.wy, r / 9);
      const y1 = lerp(g.top, g.wy, (r + 1) / 9);
      const long = r % 2 === 0;
      ctx.fillStyle = STONE[4];
      ctx.fillRect(g.corner - g.U * (long ? 6 : 3), y0 + 0.5, g.U * (long ? 6 : 3) - 0.5, y1 - y0 - 0.5);
      ctx.fillStyle = STONE[1];
      ctx.fillRect(g.corner, y0 + 0.5, g.U * (long ? 3 : 6), y1 - y0 - 0.5);
    }
    // Grass along the foot and moss in the joints.
    ctx.fillStyle = '#4b5a3f';
    for (let x = 0; x < g.W; x += g.U * (1 + rand() * 2)) blob(ctx, x, g.wy - g.U * 0.4, g.U * (1 + rand()), g.U * 0.6);
    ctx.fillStyle = '#5d6b4a';
    for (let i = 0; i < 40; i++) {
      const x = rand() * g.W;
      blob(ctx, x, lerp(wallTop(g, x), g.wy, rand()), g.U * (0.4 + rand() * 0.8), g.U * 0.3);
    }
  }

  function roof(ctx, x0, x1, y, h, over) {
    ctx.fillStyle = ROOF.slope;
    ctx.beginPath();
    ctx.moveTo(x0 - over, y);
    ctx.quadraticCurveTo(x0 + over * 0.6, y - h * 0.3, x0 + over * 1.5, y - h);
    ctx.lineTo(x1 - over * 1.5, y - h);
    ctx.quadraticCurveTo(x1 - over * 0.6, y - h * 0.3, x1 + over, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = ROOF.edge;
    ctx.fillRect(x0 - over, y - h * 0.12, x1 - x0 + over * 2, h * 0.16);
    ctx.fillStyle = ROOF.ridge;
    ctx.fillRect(x0 + over * 1.5, y - h - h * 0.12, x1 - x0 - over * 3, h * 0.16);
  }

  function paintTurret(ctx, g) {
    const u = g.U;
    const x0 = g.corner - u * 26;
    const x1 = g.corner - u * 2;
    const base = g.top + u * 0.5;
    // Low earthen wall along the top.
    ctx.fillStyle = PLASTER.side;
    ctx.fillRect(0, g.top - u * 2.5, g.corner, u * 2.6);
    ctx.fillStyle = ROOF.edge;
    ctx.fillRect(0, g.top - u * 3.4, g.corner + u, u * 1.2);
    // Two storeys of white plaster with dark roofs.
    ctx.fillStyle = PLASTER.lit;
    ctx.fillRect(x0, base - u * 9, x1 - x0, u * 9);
    ctx.fillStyle = '#4c4a46';
    for (let i = 0; i < 4; i++) ctx.fillRect(lerp(x0, x1, (i + 0.6) / 4.2), base - u * 6.5, u * 2, u * 2);
    ctx.fillStyle = ROOF.edge;
    ctx.fillRect(x0, base - u * 2, x1 - x0, u * 2);
    roof(ctx, x0, x1, base - u * 9, u * 3.5, u * 2.5);
    const y2 = base - u * 12.5;
    ctx.fillStyle = PLASTER.lit;
    ctx.fillRect(x0 + u * 5, y2 - u * 6, x1 - x0 - u * 10, u * 6);
    ctx.fillStyle = '#4c4a46';
    for (let i = 0; i < 3; i++) ctx.fillRect(lerp(x0 + u * 6, x1 - u * 6, (i + 0.5) / 3) - u, y2 - u * 4.3, u * 2, u * 1.8);
    roof(ctx, x0 + u * 5, x1 - u * 5, y2 - u * 6, u * 4, u * 2.5);
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.wy + 1);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    ctx.fillStyle = '#6f7a6a';
    ctx.beginPath();
    ctx.moveTo(0, g.top);
    for (let x = 0; x <= g.W + 2; x += 3) ctx.lineTo(x, g.H * 0.26 + fbm(x / (g.U * 20), 2.2, 3, 7) * g.H * 0.08);
    ctx.lineTo(g.W, g.top + g.H * 0.1);
    ctx.lineTo(0, g.top + g.H * 0.1);
    ctx.fill();
    paintTurret(ctx, g);
    paintWall(ctx, g, rand);
    return c;
  }

  function paintReflection(g, back) {
    const h = g.H - g.wy;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    ctx.save();
    ctx.translate(0, h);
    ctx.scale(1, -1);
    ctx.drawImage(back, 0, g.wy - h, g.W, h, 0, 0, g.W, h);
    ctx.restore();
    ctx.fillStyle = 'rgba(40,62,70,0.4)';
    ctx.fillRect(0, 0, g.W, h);
    const fade = ctx.createLinearGradient(0, 0, 0, h);
    fade.addColorStop(0, 'rgba(51,70,77,0)');
    fade.addColorStop(1, 'rgba(36,52,60,0.7)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, g.W, h);
    return c;
  }

  // ---- cherry branches -----------------------------------------------------

  function cluster(ctx, g, rand, x, y, r) {
    for (let i = 0; i < 7; i++) {
      const a = rand() * TAU;
      const d = Math.sqrt(rand()) * r;
      const k = Math.min(BLOSSOM.length - 1, Math.floor(rand() * 2 + (i / 7) * 2));
      ctx.fillStyle = BLOSSOM[k];
      blob(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, r * (0.35 + rand() * 0.3), r * (0.3 + rand() * 0.25));
    }
  }

  function branch(ctx, g, rand, x, y, ang, len, width, depth, tips) {
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;
    const bend = (rand() - 0.5) * len * 0.3;
    ctx.strokeStyle = BARK;
    ctx.lineWidth = Math.max(0.8, width);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo((x + x2) / 2 - Math.sin(ang) * bend, (y + y2) / 2 + Math.cos(ang) * bend, x2, y2);
    ctx.stroke();
    if (depth === 0 || width < 0.9) {
      tips.push(x2, y2);
      return;
    }
    const n = depth > 2 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const droop = 0.25 + rand() * 0.35;
      const a = ang + (rand() - 0.5) * 1.1 + droop * Math.sign(Math.cos(ang)) * 0.5;
      branch(ctx, g, rand, x2, y2, a, len * (0.6 + rand() * 0.2), width * 0.62, depth - 1, tips);
    }
    if (depth <= 2) for (let k = 1; k <= 3; k++) tips.push(lerp(x, x2, k / 4), lerp(y, y2, k / 4) + bend * 0.2);
    else tips.push((x + x2) / 2, (y + y2) / 2);
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const tips = [];
    branch(ctx, g, rand, -u * 4, g.H * 0.08, 0.32, u * 26, u * 3.4, 4, tips);
    branch(ctx, g, rand, -u * 2, g.H * 0.3, 0.12, u * 20, u * 2.4, 3, tips);
    branch(ctx, g, rand, g.W + u * 3, g.H * 0.02, Math.PI - 0.45, u * 22, u * 2.8, 4, tips);
    for (let i = 0; i < tips.length; i += 2) cluster(ctx, g, rand, tips[i], tips[i + 1], u * (2.2 + rand() * 1.6));
    for (let i = 0; i < tips.length; i += 2) {
      if (rand() < 0.5) cluster(ctx, g, rand, tips[i] + (rand() - 0.5) * u * 5, tips[i + 1] + u * (1 + rand() * 3), u * 1.5);
    }
    return c;
  }

  // ---- petal rafts -----------------------------------------------------------

  function petal(ctx, x, y, r) {
    blob(ctx, x, y, r, r * 0.45);
  }

  function makeRaft(g, rand, k) {
    const u = g.U;
    const w = u * (26 + k * 8);
    const h = u * (4 + k * 0.6);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const n = Math.round(w * h * 0.22);
    for (let i = 0; i < n; i++) {
      const fx = rand();
      const spine = h * (0.5 + Math.sin(fx * TAU * 1.3 + k) * 0.18);
      const spread = h * 0.42 * Math.sin(fx * Math.PI) ** 0.6;
      const y = spine + (rand() + rand() - 1) * spread;
      ctx.fillStyle = PETAL[Math.floor(rand() * PETAL.length)];
      petal(ctx, fx * w, y, u * (0.55 + rand() * 0.4));
    }
    return c;
  }

  function makeRafts(g, rand) {
    const list = [];
    for (let i = 0; i < RAFTS; i++) {
      const depth = (i + 0.5) / RAFTS;
      list.push({
        kind: i % RAFT_KINDS,
        y: lerp(g.wy + g.U * 2, g.H - g.U * 3, depth),
        scale: 0.55 + depth * 0.75,
        x0: rand() * (g.W + g.U * 60),
        v: g.U * (0.7 + depth * 1.1) * (0.8 + rand() * 0.4),
        bob: rand() * TAU,
      });
    }
    return list;
  }

  function makeFall() {
    return {
      x: new Float32Array(MAX_FALL),
      y: new Float32Array(MAX_FALL),
      vx: new Float32Array(MAX_FALL),
      vy: new Float32Array(MAX_FALL),
      floor: new Float32Array(MAX_FALL),
      phase: new Float32Array(MAX_FALL),
      tone: new Uint8Array(MAX_FALL),
    };
  }

  function resetFall(g, F, i, rand, anywhere) {
    F.x[i] = rand() * g.W;
    F.y[i] = anywhere ? rand() * g.H * 0.8 : -g.U * 2 + rand() * g.H * 0.2;
    F.vx[i] = g.U * (1.5 + rand() * 2);
    F.vy[i] = g.U * (2.5 + rand() * 2);
    F.floor[i] = lerp(g.wy, g.H, rand());
    F.phase[i] = rand() * TAU;
    F.tone[i] = Math.floor(rand() * PETAL.length);
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.reflection = paintReflection(g, state.back);
    state.front = paintFront(g, rand);
    state.kinds = [];
    for (let k = 0; k < RAFT_KINDS; k++) state.kinds.push(makeRaft(g, rand, k));
    state.rafts = makeRafts(g, rand);
    state.fall = makeFall();
    for (let i = 0; i < MAX_FALL; i++) resetFall(g, state.fall, i, rand, true);
  }

  function drawWater(ctx, g, t, ripple) {
    const h = g.H - g.wy;
    ctx.fillStyle = WATER_INK;
    ctx.fillRect(0, g.wy, g.W, h);
    const R = state.reflection;
    for (let y = 0; y < h; y += BAND) {
      const depth = y / h;
      const off = Math.sin(t * 0.9 + y * 0.45) * ripple * g.U * (0.3 + depth * 1.6);
      ctx.drawImage(R, 0, y, g.W, BAND, off, g.wy + y, g.W, BAND);
    }
    ctx.fillStyle = 'rgba(214,206,186,0.35)';
    for (let i = 0; i < 14; i++) {
      const y = g.wy + h * ((i * 0.37) % 1);
      const x = ((i * 53.7 + t * g.U * 1.2 * (0.5 + (i % 3) * 0.3)) % (g.W + g.U * 20)) - g.U * 10;
      ctx.fillRect(x, y, g.U * (4 + (i % 4) * 2) * (0.4 + ripple * 0.6), 1);
    }
  }

  function drawRafts(ctx, g, t, drift) {
    const span = g.W + g.U * 90;
    for (let i = 0; i < state.rafts.length; i++) {
      const r = state.rafts[i];
      const img = state.kinds[r.kind];
      const w = img.width * r.scale;
      const hh = img.height * r.scale;
      const x = ((r.x0 + t * r.v * drift) % span) - g.U * 70;
      const y = r.y + Math.sin(t * 0.5 + r.bob) * g.U * 0.6 - hh / 2;
      ctx.drawImage(img, x, y, w, hh);
    }
  }

  function drawFall(ctx, g, t, dt, count) {
    const F = state.fall;
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) {
      F.x[i] += (F.vx[i] + Math.sin(t * 1.3 + F.phase[i]) * g.U * 2) * step;
      F.y[i] += F.vy[i] * step;
      if (F.y[i] > F.floor[i] || F.x[i] > g.W + g.U * 3) resetFall(g, F, i, state.rand, false);
      const s = g.U * 0.7 * (0.6 + Math.abs(Math.sin(t * 2 + F.phase[i])) * 0.6);
      ctx.fillStyle = PETAL[F.tone[i]];
      ctx.fillRect(F.x[i], F.y[i], s * 1.4, s);
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { drift, petals, ripple } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawWater(ctx, g, t, ripple);
    drawRafts(ctx, g, t, drift);
    ctx.drawImage(state.front, 0, 0);
    drawFall(ctx, g, t, dt, Math.min(MAX_FALL, Math.round(FALL * petals)));
  }

  Kasuri.run({
    defaults: { drift: 1, petals: 1, ripple: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
