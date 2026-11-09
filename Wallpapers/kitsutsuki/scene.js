/*
 * 啄木鳥 Kitsutsuki — a pygmy woodpecker on an old pine in a cedar wood.
 *
 * The wood, trunk, shimenawa rope and bird body are baked once. Each frame draws the
 * layers, dips the head in short bursts of taps, and moves a small reused pool of bark chips.
 * Light shafts are one baked layer that drifts and breathes slowly.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm } = K;
  const TAU = Math.PI * 2;
  const MAX_CHIPS = 36;
  const CHIP_TONES = ['#b08a5c', '#8a6a44', '#c9a45e', '#6d5439'];
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
    return { W, H, U, tx: W * 0.56, tw: U * 22, gy: H * 0.87, by: H * 0.5 };
  }

  // ---- the wood behind -------------------------------------------------------

  function paintWood(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H);
    sky.addColorStop(0, '#9aa98a');
    sky.addColorStop(0.5, '#7d9071');
    sky.addColorStop(1, '#4a5c47');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    // far cedars, pale in the mist
    for (let x = -g.U; x < g.W + g.U; x += g.U * (3 + rand() * 4)) {
      const w = g.U * (1.2 + rand() * 1.6);
      ctx.fillStyle = rand() < 0.5 ? '#6f8466' : '#627a5d';
      ctx.fillRect(x, 0, w, g.gy);
    }
    ctx.fillStyle = 'rgba(190,206,170,0.35)';
    ctx.fillRect(0, 0, g.W, g.gy);
    paintTorii(ctx, g);
    // near cedars
    for (let x = g.W * 0.04; x < g.W; x += g.U * (14 + rand() * 12)) {
      if (Math.abs(x - g.tx) < g.tw * 1.6) continue;
      const w = g.U * (2.6 + rand() * 2.4);
      ctx.fillStyle = '#3d4d3b';
      ctx.fillRect(x, 0, w, g.gy + g.U);
      ctx.fillStyle = '#566b4d';
      ctx.fillRect(x, 0, w * 0.3, g.gy + g.U);
      ctx.fillStyle = '#2b3a2b';
      for (let y = rand() * g.U * 6; y < g.gy; y += g.U * (5 + rand() * 7)) {
        ctx.fillRect(x + w * 0.5, y, w * 0.12, g.U * (2 + rand() * 3));
      }
    }
    paintGround(ctx, g, rand);
    paintLantern(ctx, g, g.W * 0.84, g.gy + g.U * 0.6);
    return c;
  }

  function paintTorii(ctx, g) {
    const x = g.W * 0.2;
    const y = g.gy - g.U * 1.5;
    const h = g.U * 22;
    const w = g.U * 17;
    ctx.fillStyle = '#b4503a';
    ctx.fillRect(x - w / 2, y - h, g.U * 1.5, h);
    ctx.fillRect(x + w / 2 - g.U * 1.5, y - h, g.U * 1.5, h);
    ctx.fillRect(x - w / 2, y - h * 0.78, w, g.U * 1.2);
    ctx.fillStyle = '#2b2a28';
    poly(ctx, [x - w * 0.62, y - h - g.U * 0.2, x + w * 0.62, y - h - g.U * 0.2, x + w * 0.5, y - h + g.U * 1.6, x - w * 0.5, y - h + g.U * 1.6]);
    ctx.fillStyle = 'rgba(190,206,170,0.4)';
    ctx.fillRect(x - w * 0.7, y - h - g.U, w * 1.4, h + g.U * 1.5);
  }

  function paintGround(ctx, g, rand) {
    ctx.fillStyle = '#3b4a2f';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 3) ctx.lineTo(x, g.gy + fbm(x / (g.U * 20), 2.2, 3, 7) * g.U * 4);
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    for (let i = 0; i < 90; i++) {
      const x = rand() * g.W;
      const y = g.gy + g.U * (1 + rand() * 12);
      ctx.fillStyle = rand() < 0.5 ? '#5d7340' : '#2d3a26';
      blob(ctx, x, y, g.U * (1 + rand() * 2.5), g.U * (0.4 + rand() * 0.6));
    }
    ctx.fillStyle = '#7b5a3a';
    for (let i = 0; i < 40; i++) {
      blob(ctx, rand() * g.W, g.gy + g.U * (2 + rand() * 11), g.U * 0.8, g.U * 0.18, rand() - 0.5);
    }
  }

  function paintLantern(ctx, g, x, y) {
    const u = g.U;
    ctx.fillStyle = '#8c8f84';
    ctx.fillRect(x - u * 1.2, y - u * 10, u * 2.4, u * 10);
    ctx.fillRect(x - u * 3, y - u * 1.2, u * 6, u * 1.2);
    ctx.fillStyle = '#9b9e92';
    ctx.fillRect(x - u * 3.6, y - u * 15.5, u * 7.2, u * 5.5);
    ctx.fillStyle = '#d6b866';
    ctx.fillRect(x - u * 1.2, y - u * 14, u * 2.4, u * 2.6);
    ctx.fillStyle = '#7a7d73';
    poly(ctx, [x - u * 6, y - u * 15.5, x + u * 6, y - u * 15.5, x + u * 2.5, y - u * 19.5, x - u * 2.5, y - u * 19.5]);
    ctx.fillStyle = '#6a6d63';
    blob(ctx, x, y - u * 20, u * 1.2, u * 1.2);
    ctx.fillStyle = '#5d7340';
    blob(ctx, x - u * 4, y - u * 15.7, u * 2.4, u * 0.7);
  }

  // ---- the pine ---------------------------------------------------------------

  function paintTrunk(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const half = g.tw / 2;
    const xl = (y) => g.tx - half + Math.sin(y / (g.U * 22)) * g.U * 1.2 - (y / g.H) * g.U * 1.5;
    const xr = (y) => g.tx + half + Math.sin(y / (g.U * 22) + 1) * g.U * 1.2 + (y / g.H) * g.U * 1.8;
    ctx.fillStyle = '#4b392b';
    ctx.beginPath();
    ctx.moveTo(xl(-4), -4);
    for (let y = -4; y <= g.H + 4; y += 4) ctx.lineTo(xl(y), y);
    for (let y = g.H + 4; y >= -4; y -= 4) ctx.lineTo(xr(y), y);
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let y = -g.U * 2; y < g.H + g.U * 3; y += g.U * (1.8 + rand() * 1.8)) {
      let x = xl(y) - g.U * 1.5;
      while (x < xr(y)) {
        const w = g.U * (1.6 + rand() * 2.6);
        const edge = (x - xl(y)) / g.tw;
        ctx.fillStyle = edge < 0.25 ? '#6b5239' : edge > 0.72 ? '#2e2319' : rand() < 0.5 ? '#5d4836' : '#3f3026';
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y, w / 2, g.U * (0.9 + rand() * 0.9), 0, 0, TAU);
        ctx.fill();
        x += w * 0.85;
      }
    }
    ctx.fillStyle = 'rgba(28,20,14,0.5)';
    for (let i = 0; i < 9; i++) {
      const fx = g.tx - half * 0.8 + rand() * g.tw * 0.85;
      ctx.fillRect(fx, 0, Math.max(1, g.U * 0.3), g.H);
    }
    ctx.fillStyle = '#62763f';
    for (let i = 0; i < 26; i++) {
      const y = g.H * (0.1 + rand() * 0.9);
      blob(ctx, xr(y) - g.U * rand() * 3, y, g.U * (1 + rand() * 2), g.U * (0.7 + rand() * 1.4));
    }
    ctx.restore();
    // a hollow where the bird works
    ctx.fillStyle = '#241a12';
    blob(ctx, g.tx - half * 0.55, g.by + g.U * 3.5, g.U * 1.3, g.U * 2);
    paintBranch(ctx, g, rand);
    paintRope(ctx, g, xl, xr);
    return c;
  }

  function needles(ctx, x, y, r, rand) {
    ctx.strokeStyle = '#2f4631';
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const a = Math.PI * (0.05 + rand() * 0.9) + Math.PI;
      const d = r * (0.6 + rand() * 0.5);
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.75 + r * 0.2);
    }
    ctx.stroke();
    ctx.fillStyle = '#3d5a3a';
    blob(ctx, x, y - r * 0.1, r * 0.55, r * 0.22);
  }

  function paintBranch(ctx, g, rand) {
    const x0 = g.tx - g.tw * 0.4;
    const y0 = g.H * 0.15;
    ctx.strokeStyle = '#43342a';
    ctx.lineWidth = Math.max(2, g.U * 1.6);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 - g.U * 14, y0 - g.U * 4, x0 - g.U * 26, y0 + g.U * 2);
    ctx.stroke();
    needles(ctx, x0 - g.U * 26, y0 + g.U * 1.5, g.U * 8, rand);
    needles(ctx, x0 - g.U * 15, y0 - g.U * 2, g.U * 7, rand);
    needles(ctx, x0 - g.U * 6, y0 - g.U * 1.5, g.U * 5, rand);
  }

  function paintRope(ctx, g, xl, xr) {
    const y = g.H * 0.28;
    const th = g.U * 2.8;
    const x0 = xl(y) - g.U * 1.2;
    const x1 = xr(y) + g.U * 1.2;
    ctx.fillStyle = '#cdb98a';
    ctx.fillRect(x0, y - th / 2, x1 - x0, th);
    ctx.fillStyle = '#8a7650';
    for (let x = x0; x < x1; x += g.U * 1.6) {
      poly(ctx, [x, y - th / 2, x + g.U * 0.7, y - th / 2, x + g.U * 1.5, y + th / 2, x + g.U * 0.8, y + th / 2]);
    }
    ctx.fillStyle = '#ece4cc';
    for (let k = 0; k < 3; k++) {
      const sx = g.tx - g.tw * 0.3 + k * g.tw * 0.3;
      const sy = y + th / 2;
      poly(ctx, [sx, sy, sx + g.U * 2.2, sy, sx + g.U * 2.2, sy + g.U * 3, sx + g.U * 3.2, sy + g.U * 3, sx + g.U * 3.2, sy + g.U * 6, sx + g.U * 0.8, sy + g.U * 6, sx + g.U * 0.8, sy + g.U * 3, sx, sy + g.U * 3]);
    }
  }

  // ---- the bird ---------------------------------------------------------------

  function paintBody(g) {
    const u = g.U * 1.6;
    const c = layer(u * 16, u * 26);
    const ctx = c.getContext('2d');
    ctx.translate(u * 7, u * 8);
    ctx.fillStyle = '#2a2622';
    poly(ctx, [u * 0.5, u * 4, u * 3, u * 4, u * 3.8, u * 15, u * 1.6, u * 17]);
    ctx.fillStyle = '#cfc5a8';
    blob(ctx, -u * 1.4, u * 0.5, u * 2.6, u * 6.2, -0.05);
    ctx.fillStyle = '#7a6f5c';
    for (let i = 0; i < 5; i++) ctx.fillRect(-u * 3.4, u * (-1.5 + i * 2.2), u * 2.4, u * 0.35);
    ctx.fillStyle = '#2a2622';
    blob(ctx, u * 1.2, u * 0.2, u * 2.6, u * 6.4, 0.06);
    ctx.fillStyle = '#e8e0cc';
    for (let i = 0; i < 5; i++) blob(ctx, u * 1.2, u * (-3.2 + i * 2.1), u * 1.9, u * 0.5);
    ctx.fillStyle = '#3a342d';
    blob(ctx, u * 1.5, u * 4.5, u * 1.4, u * 2.4);
    ctx.fillStyle = '#6a5b44';
    ctx.fillRect(-u * 1.4, u * 3, u * 1.6, u * 0.5);
    ctx.fillRect(-u * 1.2, u * 1.5, u * 1.8, u * 0.5);
    return c;
  }

  function paintHead(g) {
    const u = g.U * 1.6;
    const c = layer(u * 12, u * 12);
    const ctx = c.getContext('2d');
    ctx.translate(u * 6, u * 6);
    ctx.fillStyle = '#5a5148';
    blob(ctx, 0, 0, u * 2.8, u * 2.6);
    ctx.fillStyle = '#e8e0cc';
    blob(ctx, -u * 0.3, u * 0.7, u * 1.8, u * 1.3);
    ctx.fillStyle = '#2a2622';
    ctx.fillRect(-u * 1.8, u * 0.1, u * 3.2, u * 0.5);
    ctx.fillStyle = '#c0452c';
    blob(ctx, u * 1.7, -u * 1.6, u * 0.8, u * 0.6);
    ctx.fillStyle = '#2a2622';
    poly(ctx, [-u * 2.2, -u * 0.5, -u * 5.6, u * 0.45, -u * 2.2, u * 1.4]);
    blob(ctx, -u * 1, -u * 0.5, u * 0.4, u * 0.4);
    ctx.fillStyle = '#f4efe0';
    blob(ctx, -u * 1.12, -u * 0.6, u * 0.12, u * 0.12);
    return c;
  }

  // ---- light ---------------------------------------------------------------

  function paintBeams(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 5; i++) {
      const x = g.W * (0.05 + i * 0.2 + rand() * 0.06);
      const w = g.U * (5 + rand() * 7);
      const slant = g.H * 0.45;
      const grad = ctx.createLinearGradient(x, 0, x + slant, g.H);
      grad.addColorStop(0, 'rgba(240,226,170,0.55)');
      grad.addColorStop(1, 'rgba(240,226,170,0)');
      ctx.fillStyle = grad;
      poly(ctx, [x, 0, x + w, 0, x + w + slant, g.H, x + slant - w * 0.2, g.H]);
    }
    return c;
  }

  // ---- chips ---------------------------------------------------------------

  function makeChips() {
    return {
      x: new Float32Array(MAX_CHIPS),
      y: new Float32Array(MAX_CHIPS),
      vx: new Float32Array(MAX_CHIPS),
      vy: new Float32Array(MAX_CHIPS),
      a: new Float32Array(MAX_CHIPS),
      va: new Float32Array(MAX_CHIPS),
      life: new Float32Array(MAX_CHIPS),
      tone: new Uint8Array(MAX_CHIPS),
      next: 0,
    };
  }

  function spawnChips(g, tipX, tipY, n) {
    const C = state.chips;
    const r = state.rand;
    for (let k = 0; k < n; k++) {
      const i = C.next;
      C.next = (C.next + 1) % MAX_CHIPS;
      C.x[i] = tipX;
      C.y[i] = tipY;
      C.vx[i] = -g.U * (2 + r() * 7);
      C.vy[i] = -g.U * (1 + r() * 6);
      C.a[i] = r() * TAU;
      C.va[i] = (r() - 0.5) * 12;
      C.life[i] = 1.4 + r() * 0.9;
      C.tone[i] = Math.floor(r() * CHIP_TONES.length);
    }
  }

  function tapPulse(t) {
    const ph = t % 2.2;
    if (ph > 1.2) return 0;
    return Math.max(0, Math.sin(ph * TAU * 5.5));
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.wood = paintWood(g, rand);
    state.trunk = paintTrunk(g, rand);
    state.body = paintBody(g);
    state.head = paintHead(g);
    state.beams = paintBeams(g, rand);
    state.chips = makeChips();
    state.prev = 0;
    state.bx = g.tx - g.tw * 0.2;
  }

  function drawChips(ctx, g, dt, scale) {
    const C = state.chips;
    const sz = g.U * 1.8;
    for (let i = 0; i < MAX_CHIPS; i++) {
      if (C.life[i] <= 0) continue;
      C.life[i] -= dt;
      C.vy[i] += g.U * 22 * dt;
      C.vx[i] *= 1 - 0.8 * dt;
      C.x[i] += C.vx[i] * dt;
      C.y[i] += C.vy[i] * dt;
      C.a[i] += C.va[i] * dt;
      if (C.y[i] > g.gy + g.U * 2) C.life[i] = 0;
      const co = Math.cos(C.a[i]);
      const si = Math.sin(C.a[i]);
      ctx.globalAlpha = Math.min(1, C.life[i] * 2) * Math.min(1, scale + 0.3);
      ctx.fillStyle = CHIP_TONES[C.tone[i]];
      ctx.setTransform(co, si, -si, co, C.x[i], C.y[i]);
      ctx.fillRect(-sz / 2, -sz * 0.25, sz, sz * 0.5);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { chips, light } = api.props;
    const step = Math.min(dt, 0.1);
    const p = tapPulse(t);
    ctx.drawImage(state.wood, 0, 0);
    if (light > 0) {
      ctx.globalAlpha = Math.min(1, 0.42 * light * (0.6 + 0.4 * Math.sin(t * 0.5)));
      ctx.drawImage(state.beams, Math.sin(t * 0.3) * g.U * 7, 0);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(state.trunk, 0, 0);
    const B = g.U * 1.6;
    const bx = state.bx - p * B * 0.4;
    ctx.drawImage(state.body, bx - B * 7, g.by - B * 8);
    const ang = 0.3 - 0.85 * p;
    const co = Math.cos(ang);
    const si = Math.sin(ang);
    const px = bx - B * 0.8;
    const py = g.by - B * 6;
    ctx.setTransform(co, si, -si, co, px, py);
    ctx.drawImage(state.head, -B * 6, -B * 6);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (p > 0.85 && state.prev <= 0.85 && chips > 0) {
      const tipX = px + (-B * 5.6) * co - (B * 0.45) * si;
      const tipY = py + (-B * 5.6) * si + (B * 0.45) * co;
      spawnChips(g, tipX, tipY, Math.max(1, Math.round(3 * chips)));
    }
    state.prev = p;
    drawChips(ctx, g, step, chips);
  }

  Kasuri.run({
    defaults: { chips: 1, light: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
