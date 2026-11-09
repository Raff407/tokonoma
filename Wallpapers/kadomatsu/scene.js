/*
 * 門松 Kadomatsu — New Year morning at a house gate.
 *
 * Sky, wall, gate, straw rope and the two kadomatsu are baked once into one layer.
 * Each frame only lays that layer down and moves a fixed pool of snowflakes over it.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp } = K;

  const TAU = Math.PI * 2;
  const GROUND = 0.8;
  const SKY = ['#7f8ea4', '#97a2b0', '#b4b6b4', '#cfc8b4', '#e2d6b6'];
  const SNOW = { lit: '#ece8de', mid: '#d9d6cf', shade: '#b4b9c2', deep: '#9ea6b4' };
  const WALL = { plaster: '#dcd4c0', plasterShade: '#c4bcaa', board: '#4c3d31', boardLine: '#3a2e25' };
  const TILE = { face: '#4a5262', ridge: '#5f6878', under: '#323844' };
  const WOOD = { post: '#3a2b21', door: '#6b5035', plank: '#584230', beam: '#2e231b', metal: '#8c7a52' };
  const PINE = { dark: '#25382a', mid: '#36502f', light: '#58733f', trunk: '#3e3028' };
  const BAMBOO = { shade: '#3f5a31', body: '#5e7c44', lit: '#88a25e', cut: '#ded2a2', hollow: '#8a7a4c', node: '#4a6638' };
  const STRAW = { body: '#c4a25e', stripe: '#a8853f', rope: '#6b5430', rim: '#d8bc78', rope2: '#8a6c3a' };
  const BERRY = '#c6432c';
  const PAPER = '#efebe0';
  const ROPE = '#b49b62';
  const MAX_FLAKES = 220;
  const FLAKES = 110;
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

  function rect(ctx, ink, x, y, w, h) {
    ctx.fillStyle = ink;
    ctx.fillRect(x, y, w, h);
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const u = U * Math.min(1, W / (U * 150));
    const gy = Math.round(H * GROUND);
    const cx = W / 2;
    const gw = u * 30;
    return { W, H, U, u, gy, cx, gw, gateTop: gy - u * 40, wallTop: gy - u * 25 };
  }

  // ---- sky and trees -------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const h = g.gy;
    const img = ctx.createImageData(g.W, h);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const f = Math.min(1, y / (g.gy * 0.9)) * (inks.length - 1);
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
    const sx = g.W * 0.8;
    const sy = g.H * 0.2;
    ctx.fillStyle = '#e4d6b0';
    blob(ctx, sx, sy, g.U * 9, g.U * 9);
    ctx.fillStyle = '#efe0b4';
    blob(ctx, sx, sy, g.U * 5.5, g.U * 5.5);
    ctx.fillStyle = '#f4e8c4';
    blob(ctx, sx, sy, g.U * 3.6, g.U * 3.6);
  }

  // A snowy pine crown: dark tiers, lit tops, snow lying on each tier.
  function pineCrown(ctx, g, rand, x, base, size) {
    const u = g.u;
    ctx.strokeStyle = PINE.trunk;
    ctx.lineWidth = Math.max(1, u * 2.2 * size);
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + u * 6 * size, base - u * 18 * size, x - u * 2 * size, base - u * 34 * size);
    ctx.stroke();
    const tiers = 5;
    for (let i = 0; i < tiers; i++) {
      const f = i / (tiers - 1);
      const ty = base - u * (10 + f * 26) * size;
      const tx = x + Math.sin(i * 1.9) * u * 7 * size;
      const rx = u * (16 - f * 8) * size;
      const ry = u * (3.6 - f * 1.2) * size;
      const pads = [];
      for (let k = 0; k < 6; k++) {
        const a = (k / 5 - 0.5) * 1.8;
        pads.push(tx + a * rx * 0.62, ty + (rand() - 0.3) * ry * 0.7 + Math.abs(a) * ry * 0.3, rx * (0.32 + rand() * 0.16), ry * (0.6 + rand() * 0.35));
      }
      const passes = [[PINE.dark, 1, 0], [PINE.mid, 0.72, -0.35], [SNOW.mid, 0.55, -0.72], [SNOW.lit, 0.3, -0.85]];
      for (const [ink, s, off] of passes) {
        ctx.fillStyle = ink;
        for (let k = 0; k < pads.length; k += 4) {
          blob(ctx, pads[k] - s * pads[k + 2] * 0.1, pads[k + 1] + off * pads[k + 3], pads[k + 2] * s, pads[k + 3] * (s < 0.6 ? s * 0.6 : s));
        }
      }
    }
  }

  // ---- wall and gate -------------------------------------------------------

  function tileCap(ctx, g, x0, x1, y, depth) {
    const u = g.u;
    rect(ctx, TILE.under, x0, y, x1 - x0, u * 1.2);
    poly(ctx, [x0 - u, y, x1 + u, y, x1 - u * 0.5, y - depth, x0 + u * 0.5, y - depth]);
    ctx.fillStyle = TILE.face;
    poly(ctx, [x0 - u, y, x1 + u, y, x1 - u * 0.5, y - depth, x0 + u * 0.5, y - depth]);
    ctx.fillStyle = TILE.ridge;
    for (let k = 1; k < 3; k++) ctx.fillRect(x0, y - depth * (k / 3), x1 - x0, Math.max(1, u * 0.4));
    ctx.fillStyle = SNOW.mid;
    ctx.fillRect(x0 + u * 0.5, y - depth - u * 1.4, x1 - x0 - u, u * 1.5);
    ctx.fillStyle = SNOW.lit;
    ctx.fillRect(x0 + u * 0.8, y - depth - u * 1.5, x1 - x0 - u * 1.6, u * 0.7);
  }

  function paintWall(ctx, g) {
    const u = g.u;
    const left = g.cx - g.gw / 2;
    const right = g.cx + g.gw / 2;
    for (const [x0, x1] of [[0, left], [right, g.W]]) {
      rect(ctx, WALL.plaster, x0, g.wallTop, x1 - x0, g.gy - g.wallTop);
      rect(ctx, WALL.plasterShade, x0, g.wallTop, x1 - x0, u * 2.5);
      rect(ctx, WALL.board, x0, g.gy - u * 10, x1 - x0, u * 10);
      ctx.fillStyle = WALL.boardLine;
      for (let x = x0 + u * 4; x < x1; x += u * 4) ctx.fillRect(x, g.gy - u * 10, Math.max(1, u * 0.4), u * 10);
      ctx.fillRect(x0, g.gy - u * 10, x1 - x0, Math.max(1, u * 0.6));
      tileCap(ctx, g, x0 - u * 2, x1 + u * 2, g.wallTop, u * 3);
    }
  }

  function paintGate(ctx, g) {
    const u = g.u;
    const left = g.cx - g.gw / 2;
    const top = g.gateTop;
    rect(ctx, WOOD.door, left, top + u * 6, g.gw, g.gy - top - u * 6);
    ctx.fillStyle = WOOD.plank;
    for (let x = left + u * 3; x < left + g.gw - u; x += u * 3) ctx.fillRect(x, top + u * 6, Math.max(1, u * 0.45), g.gy - top - u * 6);
    rect(ctx, WOOD.beam, g.cx - u * 0.4, top + u * 6, u * 0.8, g.gy - top - u * 6);
    for (const fy of [0.35, 0.75]) rect(ctx, WOOD.beam, left, lerp(top + u * 6, g.gy, fy), g.gw, u * 1.2);
    ctx.fillStyle = WOOD.metal;
    blob(ctx, g.cx - u * 2, lerp(top, g.gy, 0.6), u * 0.8, u * 0.8);
    blob(ctx, g.cx + u * 2, lerp(top, g.gy, 0.6), u * 0.8, u * 0.8);
    rect(ctx, WOOD.post, left - u * 3, top, u * 3.4, g.gy - top);
    rect(ctx, WOOD.post, left + g.gw - u * 0.4, top, u * 3.4, g.gy - top);
    rect(ctx, WOOD.beam, left - u * 5, top + u * 2, g.gw + u * 10, u * 2.6);
    tileCap(ctx, g, left - u * 9, left + g.gw + u * 9, top, u * 6);
  }

  // Straw rope sagging between the posts, white paper zigzags hanging from it.
  function paintRope(ctx, g) {
    const u = g.u;
    const x0 = g.cx - g.gw / 2;
    const x1 = g.cx + g.gw / 2;
    const y = g.gateTop + u * 6;
    const sag = u * 4;
    ctx.strokeStyle = ROPE;
    ctx.lineCap = 'round';
    ctx.lineWidth = u * 2;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo(g.cx, y + sag * 2, x1, y);
    ctx.stroke();
    ctx.strokeStyle = STRAW.rope2;
    ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.stroke();
    ctx.fillStyle = PAPER;
    for (const f of [0.2, 0.5, 0.8]) {
      const px = lerp(x0, x1, f);
      const py = y + sag * 2 * 2 * f * (1 - f) + u;
      const w = u * 1.8;
      poly(ctx, [px - w / 2, py, px + w / 2, py, px + w / 2, py + u * 2.5, px - w / 2 + u * 0.6, py + u * 2.5,
        px - w / 2 + u * 0.6, py + u * 5, px + w / 2 + u * 0.6, py + u * 5, px + w / 2 + u * 0.6, py + u * 7.5, px - w / 2 + u * 1.2, py + u * 7.5,
        px - w / 2 + u * 1.2, py + u * 9, px - w / 2, py + u * 9]);
    }
  }

  // ---- ground --------------------------------------------------------------

  function paintGround(ctx, g, rand) {
    const u = g.u;
    rect(ctx, SNOW.mid, 0, g.gy, g.W, g.H - g.gy);
    rect(ctx, SNOW.shade, 0, g.gy, g.W, u * 2.5);
    ctx.fillStyle = SNOW.lit;
    for (let i = 0; i < 40; i++) {
      blob(ctx, rand() * g.W, g.gy + u * 4 + rand() * (g.H - g.gy), u * (4 + rand() * 8), u * (0.6 + rand() * 0.8));
    }
    for (let i = 0; i < 6; i++) {
      const f = i / 5;
      const y = lerp(g.gy + u * 2.5, g.H + u * 3, f);
      const w = lerp(g.gw * 0.32, g.gw * 0.6, f);
      const x = g.cx + Math.sin(i * 1.3) * u * 2;
      ctx.fillStyle = '#8e8c86';
      blob(ctx, x, y, w / 2, u * lerp(1.1, 2.4, f));
      ctx.fillStyle = SNOW.shade;
      blob(ctx, x - w * 0.12, y - u * 0.4, w * 0.32, u * lerp(0.6, 1.3, f));
    }
  }

  // ---- kadomatsu -----------------------------------------------------------

  function bambooStalk(ctx, x, bottom, top, w, cutLeft) {
    const rise = w * 1.1;
    const hiL = cutLeft ? top : top + rise;
    const hiR = cutLeft ? top + rise : top;
    ctx.fillStyle = BAMBOO.shade;
    poly(ctx, [x - w / 2, bottom, x + w / 2, bottom, x + w / 2, hiR, x - w / 2, hiL]);
    ctx.fillStyle = BAMBOO.body;
    poly(ctx, [x - w / 2, bottom, x + w * 0.2, bottom, x + w * 0.2, lerp(hiL, hiR, 0.7), x - w / 2, hiL]);
    ctx.fillStyle = BAMBOO.lit;
    ctx.fillRect(x - w * 0.32, lerp(hiL, hiR, 0.2) + w * 0.4, Math.max(1, w * 0.2), bottom - top - rise);
    ctx.fillStyle = BAMBOO.node;
    for (let y = bottom - w * 2.4; y > top + rise + w; y -= w * 2.6) ctx.fillRect(x - w / 2, y, w, Math.max(1, w * 0.16));
    const my = (hiL + hiR) / 2;
    const tilt = Math.atan2(hiR - hiL, w);
    ctx.fillStyle = BAMBOO.cut;
    ctx.beginPath();
    ctx.ellipse(x, my, w * 0.62, w * 0.42, tilt, 0, TAU);
    ctx.fill();
    ctx.fillStyle = BAMBOO.hollow;
    ctx.beginPath();
    ctx.ellipse(x, my, w * 0.36, w * 0.22, tilt, 0, TAU);
    ctx.fill();
  }

  function strawBase(ctx, g, x, base, bw, bh) {
    const u = g.u;
    const top = base - bh;
    ctx.fillStyle = SNOW.deep;
    blob(ctx, x + u * 3, base + u * 0.6, bw * 0.75, u * 2);
    rect(ctx, STRAW.body, x - bw / 2, top, bw, bh);
    ctx.fillStyle = STRAW.stripe;
    for (let sx = x - bw / 2 + u * 1.4; sx < x + bw / 2; sx += u * 2) ctx.fillRect(sx, top, Math.max(1, u * 0.5), bh);
    rect(ctx, STRAW.stripe, x + bw * 0.25, top, bw * 0.25, bh);
    for (const f of [0.22, 0.5, 0.78]) {
      rect(ctx, STRAW.rope, x - bw / 2, top + bh * f, bw, u * 1.4);
      rect(ctx, STRAW.rope2, x - bw / 2, top + bh * f, bw, Math.max(1, u * 0.4));
    }
    ctx.fillStyle = STRAW.rim;
    blob(ctx, x, top, bw / 2, u * 1.6);
    ctx.fillStyle = SNOW.mid;
    blob(ctx, x - bw * 0.1, base - u * 0.3, bw * 0.62, u * 1.4);
  }

  function pineSprigs(ctx, g, rand, x, y, bw, side) {
    const u = g.u;
    const passes = [[PINE.dark, 1, 0], [PINE.mid, 0.75, -0.5], [PINE.light, 0.42, -0.9]];
    const spots = [];
    for (let i = 0; i < 14; i++) {
      spots.push(x + (rand() - 0.5) * bw * 1.25, y - rand() * u * 9, u * (2.4 + rand() * 2.2));
    }
    for (const [ink, k, off] of passes) {
      ctx.fillStyle = ink;
      for (let i = 0; i < spots.length; i += 3) blob(ctx, spots[i], spots[i + 1] + off * u, spots[i + 2] * k * 1.2, spots[i + 2] * k * 0.8);
    }
    ctx.fillStyle = SNOW.lit;
    for (let i = 0; i < spots.length; i += 6) blob(ctx, spots[i], spots[i + 1] - spots[i + 2] * 0.7, spots[i + 2] * 0.6, u * 0.6);
    const bx = x + side * bw * 0.42;
    const by = y - u * 3;
    ctx.fillStyle = '#7a2a1d';
    for (let i = 0; i < 9; i++) blob(ctx, bx + (rand() - 0.5) * u * 5, by + (rand() - 0.5) * u * 4, u * 0.9, u * 0.9);
    ctx.fillStyle = BERRY;
    for (let i = 0; i < 9; i++) blob(ctx, bx + (rand() - 0.5) * u * 4.5, by + (rand() - 0.5) * u * 3.6 - u * 0.3, u * 0.7, u * 0.7);
  }

  function kadomatsu(ctx, g, rand, x, base, side) {
    const u = g.u;
    const bw = u * 20;
    const bh = u * 15;
    const top = base - bh;
    const kh = u * 52;
    const sw = u * 5.4;
    const cutLeft = side > 0;
    bambooStalk(ctx, x + side * sw * 1.05, top + u, base - kh * 0.7, sw, cutLeft);
    bambooStalk(ctx, x - side * sw * 1.05, top + u, base - kh * 0.84, sw, cutLeft);
    bambooStalk(ctx, x, top + u, base - kh, sw, cutLeft);
    pineSprigs(ctx, g, rand, x, top + u, bw, side);
    strawBase(ctx, g, x, base, bw, bh);
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    pineCrown(ctx, g, rand, g.W * 0.1, g.wallTop, 1.3);
    pineCrown(ctx, g, rand, g.W * 0.9, g.wallTop, 1.05);
    paintWall(ctx, g);
    paintGate(ctx, g);
    paintRope(ctx, g);
    paintGround(ctx, g, rand);
    const off = g.gw / 2 + g.u * 15;
    kadomatsu(ctx, g, rand, g.cx - off, g.gy + g.u * 7, -1);
    kadomatsu(ctx, g, rand, g.cx + off, g.gy + g.u * 7, 1);
    return c;
  }

  // ---- snow ----------------------------------------------------------------

  function makeFlakes() {
    const f = () => new Float32Array(MAX_FLAKES);
    return { x: f(), y: f(), vy: f(), p: f(), near: f() };
  }

  function resetFlake(g, F, i, scatter) {
    const r = state.rand;
    const near = r() < 0.3 ? 1 : 0;
    F.near[i] = near;
    F.x[i] = r() * g.W * 1.2 - g.W * 0.1;
    F.y[i] = scatter ? r() * g.H : -g.U * (1 + r() * 4);
    F.vy[i] = g.U * (near ? 4.5 + r() * 2 : 2 + r() * 1.5);
    F.p[i] = r() * TAU;
  }

  function stepFlakes(g, t, dt, count, wind) {
    const F = state.flakes;
    const drift = g.U * 1.6 * wind;
    for (let i = 0; i < count; i++) {
      const k = F.near[i] ? 1.6 : 1;
      F.y[i] += F.vy[i] * dt;
      F.x[i] += (drift * k + Math.sin(t * 0.9 + F.p[i]) * g.U * 1.4 * k) * dt;
      if (F.y[i] > g.H + g.U || F.x[i] > g.W + g.U * 4) resetFlake(g, F, i, false);
    }
  }

  function drawFlakes(ctx, g, count) {
    const F = state.flakes;
    const far = Math.max(1, g.U * 0.7);
    const near = Math.max(1.6, g.U * 1.5);
    ctx.fillStyle = SNOW.mid;
    for (let i = 0; i < count; i++) {
      if (!F.near[i]) ctx.fillRect(F.x[i], F.y[i], far, far);
    }
    ctx.fillStyle = '#f2eee4';
    for (let i = 0; i < count; i++) {
      if (F.near[i]) ctx.fillRect(F.x[i], F.y[i], near, near);
    }
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.flakes = makeFlakes();
    for (let i = 0; i < MAX_FLAKES; i++) resetFlake(g, state.flakes, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { snow, wind } = api.props;
    const count = Math.min(MAX_FLAKES, Math.round(FLAKES * snow));
    stepFlakes(g, t, Math.min(dt, 0.1), count, wind);
    ctx.drawImage(state.back, 0, 0);
    drawFlakes(ctx, g, count);
  }

  Kasuri.run({
    defaults: { snow: 1, wind: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
