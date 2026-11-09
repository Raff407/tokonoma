/*
 * 酒蔵 Sakagura — a sake brewery lane on a winter morning.
 *
 * Sky, hills, the brewery front and the lane are baked once. Each frame only
 * draws steam puffs from the chimney and roof vent, the indigo curtain at the
 * door swaying, the cedar ball swinging on its cord and a little snow.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;

  const TAU = Math.PI * 2;
  const SKY = ['#8e9cad', '#a7b0b6', '#c3c3bb', '#d6cfbd'];
  const PLASTER = '#e9e3d3';
  const PLASTER_SHADE = '#cfc7b3';
  const TIMBER = '#2b241f';
  const TIMBER_LIT = '#463a30';
  const TILE = '#3c4048';
  const TILE_LIT = '#5c6068';
  const STONE = '#77746c';
  const INDIGO = '#2c3f6e';
  const GOLD = '#d7a84a';
  const CEDAR = ['#4f5a32', '#66703c', '#7f8648', '#3b4426'];
  const BRICK = '#7a3a2c';
  const CHIMNEY = { x: 0.84, w: 0.04, top: 0.1 };
  const VENT = { x0: 0.24, x1: 0.4, y: 0.205 };
  const ROOF = [0.255, 0.345];
  const UPPER = [0.345, 0.565];
  const EAVE = [0.565, 0.615];
  const LOWER = [0.615, 0.875];
  const DOOR = [0.36, 0.5];
  const BALL = { x: 0.29, cord: 0.03, r: 0.06 };
  const MAX_PUFFS = 26;
  const MAX_FLAKES = 160;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function X(g, f) {
    return g.W * f;
  }

  function Y(g, f) {
    return g.H * f;
  }

  function rect(ctx, ink, x, y, w, h) {
    ctx.fillStyle = ink;
    ctx.fillRect(x, y, w, h);
  }

  // ---- sky and hills -------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const h = Math.ceil(Y(g, ROOF[1]));
    const inks = SKY.map(K.parseColor);
    const img = ctx.createImageData(g.W, h);
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
  }

  function paintHills(ctx, g) {
    const bands = [
      { base: 0.17, amp: 0.06, ink: '#7c8798', seed: 3 },
      { base: 0.215, amp: 0.05, ink: '#5f6c70', seed: 7 },
    ];
    for (const b of bands) {
      ctx.fillStyle = b.ink;
      ctx.beginPath();
      ctx.moveTo(0, Y(g, 0.4));
      for (let x = 0; x <= g.W + 2; x += 2) {
        ctx.lineTo(x, Y(g, b.base) + (fbm(x / (g.U * 35), 1.7, 3, b.seed) - 0.5) * Y(g, b.amp) * 2);
      }
      ctx.lineTo(g.W, Y(g, 0.4));
      ctx.fill();
    }
    // Snow caught on the far ridge.
    ctx.fillStyle = '#c9ccc8';
    ctx.globalAlpha = 0.5;
    for (let x = 0; x <= g.W; x += 2) {
      const y = Y(g, 0.17) + (fbm(x / (g.U * 35), 1.7, 3, 3) - 0.5) * Y(g, 0.06) * 2;
      ctx.fillRect(x, y, 2, Math.max(1, g.U * 0.6));
    }
    ctx.globalAlpha = 1;
  }

  function paintChimney(ctx, g) {
    const x = X(g, CHIMNEY.x);
    const w = X(g, CHIMNEY.w);
    const top = Y(g, CHIMNEY.top);
    const bottom = Y(g, ROOF[0] + 0.02);
    rect(ctx, BRICK, x, top, w, bottom - top);
    rect(ctx, '#5e2c22', x + w * 0.65, top, w * 0.35, bottom - top);
    ctx.fillStyle = '#93503a';
    for (let y = top + g.U * 2; y < bottom; y += g.U * 2.2) ctx.fillRect(x, y, w, Math.max(1, g.U * 0.3));
    rect(ctx, TIMBER, x - w * 0.12, top, w * 1.24, Math.max(1, g.U * 1.2));
    // Iron hoops.
    rect(ctx, '#3a3230', x, top + (bottom - top) * 0.35, w, Math.max(1, g.U * 0.5));
    rect(ctx, '#3a3230', x, top + (bottom - top) * 0.7, w, Math.max(1, g.U * 0.5));
  }

  // ---- brewery -------------------------------------------------------------

  function paintRoof(ctx, g, y0, y1, overhang) {
    rect(ctx, TILE, -2, y0, g.W + 4, y1 - y0);
    ctx.fillStyle = TILE_LIT;
    const step = Math.max(2, g.U * 1.6);
    for (let x = 0; x < g.W; x += step) ctx.fillRect(x, y0, Math.max(1, step * 0.35), y1 - y0);
    ctx.fillStyle = '#2a2d33';
    for (let y = y0 + g.U * 1.4; y < y1; y += g.U * 1.6) ctx.fillRect(0, y, g.W, 1);
    rect(ctx, '#23262c', 0, y1 - overhang, g.W, overhang);
    // Snow along the ridge.
    rect(ctx, '#e4e3dc', 0, y0 - g.U * 0.5, g.W, Math.max(1, g.U * 0.9));
  }

  function paintVent(ctx, g) {
    const x0 = X(g, VENT.x0);
    const x1 = X(g, VENT.x1);
    const y = Y(g, VENT.y);
    const base = Y(g, ROOF[0]);
    rect(ctx, PLASTER_SHADE, x0 + g.U, y + g.U * 1.6, x1 - x0 - g.U * 2, base - y);
    ctx.fillStyle = TIMBER;
    for (let x = x0 + g.U * 2; x < x1 - g.U; x += g.U * 1.8) ctx.fillRect(x, y + g.U * 2, Math.max(1, g.U * 0.7), base - y - g.U * 2);
    ctx.fillStyle = TILE;
    ctx.beginPath();
    ctx.moveTo(x0 - g.U * 1.5, y + g.U * 2);
    ctx.lineTo(x0 + g.U * 2, y);
    ctx.lineTo(x1 - g.U * 2, y);
    ctx.lineTo(x1 + g.U * 1.5, y + g.U * 2);
    ctx.fill();
    rect(ctx, '#e4e3dc', x0 + g.U * 2, y - g.U * 0.4, x1 - x0 - g.U * 4, Math.max(1, g.U * 0.7));
  }

  function paintUpper(ctx, g) {
    const y0 = Y(g, UPPER[0]);
    const h = Y(g, UPPER[1] - UPPER[0]);
    rect(ctx, PLASTER, 0, y0, g.W, h);
    rect(ctx, PLASTER_SHADE, 0, y0, g.W, Math.max(1, g.U * 1.6));
    // Posts and a tie beam, the old timber frame showing through.
    const postW = Math.max(1, g.U * 1.1);
    for (let f = 0.02; f < 1; f += 0.16) rect(ctx, TIMBER, X(g, f), y0, postW, h);
    rect(ctx, TIMBER, 0, y0 + h * 0.62, g.W, Math.max(1, g.U * 0.9));
    // Small barred windows under the eave.
    for (const f of [0.12, 0.62, 0.92]) {
      const wx = X(g, f);
      const ww = X(g, 0.055);
      const wy = y0 + h * 0.2;
      const wh = h * 0.3;
      rect(ctx, TIMBER, wx - g.U * 0.5, wy - g.U * 0.5, ww + g.U, wh + g.U);
      rect(ctx, '#4a4238', wx, wy, ww, wh);
      ctx.fillStyle = TIMBER_LIT;
      for (let x = wx + g.U * 0.6; x < wx + ww; x += g.U * 1.4) ctx.fillRect(x, wy, Math.max(1, g.U * 0.5), wh);
    }
  }

  function paintEave(ctx, g) {
    const y0 = Y(g, EAVE[0]);
    const y1 = Y(g, EAVE[1]);
    ctx.fillStyle = TILE;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(g.W, y0);
    ctx.lineTo(g.W, y1);
    ctx.lineTo(0, y1);
    ctx.fill();
    ctx.fillStyle = TILE_LIT;
    const step = Math.max(2, g.U * 1.6);
    for (let x = 0; x < g.W; x += step) ctx.fillRect(x, y0, Math.max(1, step * 0.35), y1 - y0);
    rect(ctx, '#e4e3dc', 0, y0 - g.U * 0.3, g.W, Math.max(1, g.U * 0.8));
    rect(ctx, '#1e2026', 0, y1 - g.U * 0.8, g.W, Math.max(1, g.U * 0.8));
  }

  // Black tiles with raised white joints in a lattice.
  function paintNamako(ctx, g, x0, x1, y0, y1) {
    rect(ctx, '#33363c', x0, y0, x1 - x0, y1 - y0);
    const s = Math.max(4, g.U * 4.2);
    ctx.strokeStyle = '#ddd8ca';
    ctx.lineWidth = Math.max(1, g.U * 0.6);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    ctx.beginPath();
    for (let k = -Math.ceil((y1 - y0) / s) - 2; k < (x1 - x0) / s + 2; k++) {
      const bx = x0 + k * s;
      ctx.moveTo(bx, y0);
      ctx.lineTo(bx + (y1 - y0), y1);
      ctx.moveTo(bx + (y1 - y0), y0);
      ctx.lineTo(bx, y1);
    }
    ctx.stroke();
    ctx.restore();
  }

  function paintBoards(ctx, g, x0, x1, y0, y1, rand) {
    rect(ctx, TIMBER, x0, y0, x1 - x0, y1 - y0);
    for (let x = x0; x < x1; x += Math.max(2, g.U * 1.5)) {
      ctx.fillStyle = rand() < 0.5 ? '#4a3d32' : '#3a3029';
      ctx.fillRect(x, y0, Math.max(1, g.U * 1.5) - 1, y1 - y0);
    }
    rect(ctx, '#1a1614', x0, y0, x1 - x0, Math.max(1, g.U * 0.8));
  }

  function paintDoorway(ctx, g) {
    const x0 = X(g, DOOR[0]);
    const x1 = X(g, DOOR[1]);
    const y0 = Y(g, LOWER[0]);
    const y1 = Y(g, LOWER[1]);
    rect(ctx, '#1b1714', x0, y0, x1 - x0, y1 - y0);
    // Warm light from inside the brewhouse.
    const glow = ctx.createLinearGradient(0, y0 + (y1 - y0) * 0.35, 0, y1);
    glow.addColorStop(0, '#6b4e2c');
    glow.addColorStop(1, '#b88a44');
    ctx.fillStyle = glow;
    ctx.fillRect(x0 + g.U, y0 + (y1 - y0) * 0.35, x1 - x0 - g.U * 2, (y1 - y0) * 0.65);
    // A vat rim and a worker-sized shadow inside.
    rect(ctx, '#4a3624', x0 + (x1 - x0) * 0.55, y0 + (y1 - y0) * 0.62, (x1 - x0) * 0.35, (y1 - y0) * 0.38);
    rect(ctx, GOLD, x0 + (x1 - x0) * 0.55, y0 + (y1 - y0) * 0.62, (x1 - x0) * 0.35, Math.max(1, g.U * 0.6));
    const frame = Math.max(1, g.U * 1.2);
    rect(ctx, TIMBER_LIT, x0 - frame, y0, frame, y1 - y0);
    rect(ctx, TIMBER_LIT, x1, y0, frame, y1 - y0);
    rect(ctx, TIMBER_LIT, x0 - frame, y0, x1 - x0 + frame * 2, frame);
  }

  // A slatted window with lamplight behind it.
  function paintLattice(ctx, g, x0, x1, y0, y1) {
    rect(ctx, '#a07c46', x0, y0, x1 - x0, y1 - y0);
    rect(ctx, '#c49a52', x0, y0 + (y1 - y0) * 0.5, x1 - x0, (y1 - y0) * 0.5);
    ctx.fillStyle = TIMBER;
    for (let x = x0; x < x1; x += Math.max(2, g.U * 1.2)) ctx.fillRect(x, y0, Math.max(1, g.U * 0.6), y1 - y0);
    const f = Math.max(1, g.U * 0.9);
    rect(ctx, TIMBER_LIT, x0 - f, y0 - f, x1 - x0 + f * 2, f);
    rect(ctx, TIMBER_LIT, x0 - f, y1, x1 - x0 + f * 2, f);
    rect(ctx, TIMBER_LIT, x0 - f, y0, f, y1 - y0);
    rect(ctx, TIMBER_LIT, x1, y0, f, y1 - y0);
  }

  function paintBarrels(ctx, g) {
    const r = g.H * 0.035;
    const base = Y(g, LOWER[1]);
    const xs = [[0.6, 0], [0.66, 0], [0.72, 0], [0.63, 1], [0.69, 1]];
    for (const [f, row] of xs) {
      const cx = X(g, f);
      const cy = base - r * (1 + row * 1.9);
      rect(ctx, '#cbbf9e', cx - r * 1.3, cy - r, r * 2.6, r * 2);
      rect(ctx, '#a8986e', cx + r * 0.7, cy - r, r * 0.6, r * 2);
      rect(ctx, '#8a7a50', cx - r * 1.3, cy - r, r * 2.6, Math.max(1, r * 0.22));
      rect(ctx, '#8a7a50', cx - r * 1.3, cy + r * 0.78, r * 2.6, Math.max(1, r * 0.22));
      rect(ctx, '#b4442b', cx - r * 1.3, cy - r * 0.15, r * 2.6, Math.max(1, r * 0.28));
      ctx.fillStyle = INDIGO;
      ctx.beginPath();
      ctx.arc(cx - r * 0.15, cy - r * 0.45, r * 0.32, 0, TAU);
      ctx.fill();
    }
  }

  function paintLower(ctx, g, rand) {
    const y0 = Y(g, LOWER[0]);
    const y1 = Y(g, LOWER[1]);
    rect(ctx, PLASTER, 0, y0, X(g, DOOR[0]), (y1 - y0) * 0.3);
    paintNamako(ctx, g, 0, X(g, DOOR[0]) - g.U * 1.2, y0 + (y1 - y0) * 0.3, y1);
    rect(ctx, TIMBER, 0, y0 + (y1 - y0) * 0.3 - g.U * 0.6, X(g, DOOR[0]), Math.max(1, g.U * 0.8));
    paintBoards(ctx, g, X(g, DOOR[1]) + g.U * 1.2, g.W, y0, y1, rand);
    paintDoorway(ctx, g);
    paintLattice(ctx, g, X(g, 0.8), X(g, 0.95), y0 + (y1 - y0) * 0.18, y0 + (y1 - y0) * 0.62);
    paintBarrels(ctx, g);
    // Snow piled at the foot of the wall.
    ctx.fillStyle = '#dcdbd4';
    for (let x = 0; x < g.W; x += 1) {
      if (x > X(g, DOOR[0]) - g.U && x < X(g, DOOR[1]) + g.U) continue;
      const h = g.U * (0.6 + fbm(x / (g.U * 6), 0.3, 2, 13) * 1.6);
      ctx.fillRect(x, y1 - h, 1, h);
    }
  }

  function paintLane(ctx, g, rand) {
    const y0 = Y(g, LOWER[1]);
    rect(ctx, STONE, 0, y0, g.W, g.H - y0);
    // Gutter along the wall.
    rect(ctx, '#3e3d3a', 0, y0, g.W, Math.max(1, g.U * 1.2));
    rect(ctx, '#a8a69c', 0, y0 + g.U * 1.2, g.W, Math.max(1, g.U * 0.6));
    // Flagstones, rows widening toward us.
    let y = y0 + g.U * 2;
    let row = 0;
    while (y < g.H) {
      const h = g.U * (2 + row * 1.1);
      const w = g.U * (7 + row * 3);
      const off = rand() * w;
      ctx.fillStyle = '#5d5b55';
      ctx.fillRect(0, y, g.W, 1);
      for (let x = -off; x < g.W; x += w * (0.8 + rand() * 0.4)) ctx.fillRect(x, y, 1, h);
      ctx.fillStyle = '#d6d5cf';
      ctx.globalAlpha = 0.35;
      for (let x = 0; x < g.W; x += 3 + rand() * 6) ctx.fillRect(x, y + rand() * h, 1 + rand() * 3, 1);
      ctx.globalAlpha = 1;
      y += h;
      row++;
    }
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintHills(ctx, g);
    paintChimney(ctx, g);
    return c;
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintVent(ctx, g);
    paintRoof(ctx, g, Y(g, ROOF[0]), Y(g, ROOF[1]), g.U * 0.9);
    paintUpper(ctx, g);
    paintLower(ctx, g, rand);
    paintEave(ctx, g);
    paintLane(ctx, g, rand);
    return c;
  }

  // ---- moving pieces -------------------------------------------------------

  function paintPuff() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(240,238,230,0.75)');
    grad.addColorStop(0.6, 'rgba(236,234,226,0.35)');
    grad.addColorStop(1, 'rgba(236,234,226,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  function paintNoren(g) {
    const w = Math.max(6, Math.round(X(g, DOOR[1] - DOOR[0])));
    const h = Math.max(6, Math.round(Y(g, 0.12)));
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    rect(ctx, INDIGO, 0, 0, w, h);
    rect(ctx, '#22325a', 0, 0, w, Math.max(1, h * 0.12));
    // A plain crest: a ring.
    ctx.strokeStyle = '#d9d2bf';
    ctx.lineWidth = Math.max(1, w * 0.035);
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.52, Math.min(w, h) * 0.22, 0, TAU);
    ctx.stroke();
    // Splits between the three panels.
    ctx.clearRect(Math.round(w / 3), h * 0.2, 1, h);
    ctx.clearRect(Math.round((w * 2) / 3), h * 0.2, 1, h);
    return c;
  }

  function paintBall(g) {
    const r = Math.max(3, Y(g, BALL.r));
    const s = Math.ceil(r * 2 + 2);
    const c = layer(s, s);
    const ctx = c.getContext('2d');
    const rand = K.rng(17);
    ctx.fillStyle = CEDAR[3];
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, r, 0, TAU);
    ctx.fill();
    for (let i = 0; i < r * r * 2; i++) {
      const a = rand() * TAU;
      const d = Math.sqrt(rand()) * r * 0.95;
      const px = s / 2 + Math.cos(a) * d;
      const py = s / 2 + Math.sin(a) * d;
      const lit = (s / 2 - px) * 0.5 + (s / 2 - py) > 0 ? 1 : 0;
      ctx.fillStyle = CEDAR[Math.min(2, Math.floor(rand() * 2) + lit)];
      ctx.fillRect(px, py, 1, 1);
    }
    return c;
  }

  function makePuffs(rand) {
    const P = [];
    for (let i = 0; i < MAX_PUFFS; i++) P.push({ phase: i / MAX_PUFFS, wob: rand() * TAU, src: i % 3 === 0 ? 1 : 0, drift: 0.7 + rand() * 0.6 });
    return P;
  }

  function makeFlakes(g, rand) {
    const n = MAX_FLAKES;
    const F = { x: new Float32Array(n), y: new Float32Array(n), v: new Float32Array(n), p: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      F.x[i] = rand() * g.W;
      F.y[i] = rand() * g.H;
      F.v[i] = g.U * (2 + rand() * 3);
      F.p[i] = rand() * TAU;
    }
    return F;
  }

  function drawSteam(ctx, g, t, amount) {
    if (amount <= 0) return;
    const P = state.puffs;
    const life = 9;
    for (let i = 0; i < MAX_PUFFS; i++) {
      const p = P[i];
      const a = ((t / life) * p.drift + p.phase) % 1;
      const fromVent = p.src === 1;
      const sx = fromVent ? X(g, lerp(VENT.x0, VENT.x1, (i * 0.37) % 1)) : X(g, CHIMNEY.x + CHIMNEY.w / 2);
      const sy = fromVent ? Y(g, VENT.y) : Y(g, CHIMNEY.top);
      const rise = fromVent ? g.H * 0.18 : g.H * 0.11;
      const size = g.U * ((fromVent ? 4 : 3) + a * (fromVent ? 16 : 22)) * Math.min(1.3, 0.6 + amount * 0.4);
      const px = sx + a * g.W * (fromVent ? 0.08 : 0.14) + Math.sin(t * 0.5 + p.wob) * g.U * 2 * a;
      const py = sy - a * rise - g.U;
      ctx.globalAlpha = Math.min(1, (1 - a) * Math.min(1, a * 6) * 0.85 * Math.min(1, amount));
      ctx.drawImage(state.puff, px - size / 2, py - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawNoren(ctx, g, t) {
    const art = state.noren;
    const x0 = X(g, DOOR[0]);
    const top = Y(g, LOWER[0]) + g.U;
    for (let s = 0; s < art.height; s++) {
      const k = s / art.height;
      const wave = Math.sin(t * 1.1 - k * 2.5) * g.U * 0.9 * k * k;
      ctx.drawImage(art, 0, s, art.width, 1, x0 + wave, top + s, art.width, 1);
    }
    rect(ctx, TIMBER_LIT, x0 - g.U, top - 1, art.width + g.U * 2, Math.max(1, g.U * 0.6));
  }

  function drawBall(ctx, g, t) {
    const art = state.ball;
    const px = X(g, BALL.x);
    const py = Y(g, EAVE[1]);
    const cord = Y(g, BALL.cord);
    const ang = Math.sin(t * 0.9) * 0.12 + Math.sin(t * 0.37) * 0.05;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    ctx.setTransform(c, s, -s, c, px, py);
    rect(ctx, '#8a6a3a', -0.5, 0, 1, cord);
    rect(ctx, '#8a6a3a', -art.width * 0.12, cord - 1, art.width * 0.24, Math.max(1, g.U * 0.6));
    ctx.drawImage(art, -art.width / 2, cord);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawSnow(ctx, g, t, dt, amount) {
    if (amount <= 0) return;
    const F = state.flakes;
    const n = Math.min(MAX_FLAKES, Math.round(MAX_FLAKES * 0.5 * amount));
    const step = Math.min(dt, 0.1);
    ctx.fillStyle = '#f0efe8';
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < n; i++) {
      F.y[i] += F.v[i] * step;
      F.x[i] += (Math.sin(t * 0.7 + F.p[i]) * 0.6 + 0.3) * g.U * step;
      if (F.y[i] > g.H) {
        F.y[i] -= g.H;
        F.x[i] = (F.x[i] + g.W * 0.37) % g.W;
      }
      if (F.x[i] > g.W) F.x[i] -= g.W;
      ctx.fillRect(F.x[i], F.y[i], 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed || 29);
    state.g = g;
    state.back = paintBack(g, rand);
    state.front = paintFront(g, rand);
    state.puff = paintPuff();
    state.noren = paintNoren(g);
    state.ball = paintBall(g);
    state.puffs = makePuffs(rand);
    state.flakes = makeFlakes(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { steam, snow } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawSteam(ctx, g, t, steam);
    ctx.drawImage(state.front, 0, 0);
    drawNoren(ctx, g, t);
    drawBall(ctx, g, t);
    drawSnow(ctx, g, t, dt, snow);
  }

  Kasuri.run({
    defaults: { steam: 1, snow: 0.6, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.05, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
