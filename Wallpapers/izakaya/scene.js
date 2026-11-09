/*
 * 居酒屋 Izakaya — a small tavern front on a back street at night.
 *
 * Sky, neighbours, the shop and the street are baked once into two layers.
 * Each frame only the lantern swings, the noren panels sway row by row, a
 * guest's shadow crosses the shoji now and then, steam rises off the roof and
 * the lantern's reflection wobbles on the wet stones.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp } = K;

  const TAU = Math.PI * 2;
  const GROUND = 0.8;
  const SKY = ['#1b2140', '#20274a', '#262e55', '#2d365e'];
  const INK = { night: '#15171f', roof: '#24252d', tile: '#30313a', fascia: '#1b1b20' };
  const WOOD = { upper: '#3c2c22', lower: '#4a3627', seam: '#30241c', post: '#2a1f18' };
  const WARM = { shoji: '#e8c98c', paper: '#d8b070', slat: '#6a4a2c', dim: '#9a7444', glow: '#b8864a' };
  const NOREN = { cloth: '#2e3d6a', fold: '#25335a', mark: '#ddd2b6', rod: '#5a4430' };
  const LANTERN = { body: '#c8452c', rib: '#962f20', lit: '#e2774a', cap: '#1b1a1e' };
  const STREET = { stone: '#272a33', seam: '#1f2129', spill: ['#3a3532', '#4b4036', '#5e4c38'] };
  const PANELS = 4;
  const PUFFS = 14;
  const DROPS = 70;
  const GUEST_CYCLE = 26;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function rect(ctx, ink, x, y, w, h) {
    ctx.fillStyle = ink;
    ctx.fillRect(x, y, w, h);
  }

  function poly(ctx, ink, pts) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function blob(ctx, ink, x, y, rx, ry) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, TAU);
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const u = U * Math.min(1, W / (U * 120));
    const cx = W * 0.5;
    const gy = Math.round(H * GROUND);
    const x0 = cx - u * 44;
    const x1 = cx + u * 44;
    return {
      W, H, U, u, cx, gy, x0, x1,
      eave: H * 0.45,
      door: { x: cx - u * 6, y: H * 0.505, w: u * 28, h: gy - H * 0.505 },
      win: { x: x0 + u * 5, y: H * 0.53, w: u * 22, h: H * 0.19 },
      lantern: { x: x0 + u * 33, y: H * 0.475, rx: u * 5.2, ry: U * 7.2 },
      noren: { x: cx - u * 6.5, y: H * 0.5, w: u * 29, h: U * 13 },
      pipe: { x: x1 - u * 12, y: H * 0.235 },
    };
  }

  // ---- back layer: sky, moon, neighbours, pole ------------------------------

  function paintSky(ctx, g, rand) {
    const band = g.gy / SKY.length;
    for (let i = 0; i < SKY.length; i++) rect(ctx, SKY[i], 0, Math.floor(i * band), g.W, Math.ceil(band) + 1);
    ctx.fillStyle = '#c9c6b8';
    for (let i = 0; i < g.W * 0.25; i++) {
      ctx.globalAlpha = 0.25 + rand() * 0.45;
      ctx.fillRect(Math.floor(rand() * g.W), Math.floor(rand() * g.H * 0.3), 1, 1);
    }
    ctx.globalAlpha = 1;
    const mx = g.W * 0.16;
    const my = g.H * 0.13;
    blob(ctx, '#e4d29a', mx, my, g.U * 4.2, g.U * 4.2);
    blob(ctx, SKY[0], mx + g.U * 1.8, my - g.U * 0.9, g.U * 3.8, g.U * 3.8);
  }

  function paintNeighbours(ctx, g, rand) {
    const left = g.x0 - g.u * 4;
    poly(ctx, '#181b27', [0, g.H * 0.3, left * 0.55, g.H * 0.27, left, g.H * 0.31, left, g.gy, 0, g.gy]);
    rect(ctx, '#1f2232', 0, g.H * 0.36, left, g.U * 1.2);
    for (let i = 0; i < 3; i++) {
      const wx = left * (0.15 + i * 0.3);
      rect(ctx, i === 1 ? '#7a6040' : '#2a2c3a', wx, g.H * 0.42, g.u * 6, g.U * 7);
      rect(ctx, '#181b27', wx + g.u * 2.8, g.H * 0.42, g.u * 0.5, g.U * 7);
    }
    rect(ctx, '#2a2c3a', left * 0.3, g.H * 0.6, g.u * 9, g.U * 9);
    const right = g.x1 + g.u * 4;
    poly(ctx, '#171a25', [right, g.H * 0.34, g.W, g.H * 0.31, g.W, g.gy, right, g.gy]);
    for (let i = 0; i < 2; i++) {
      const wx = right + (g.W - right) * (0.2 + i * 0.4);
      rect(ctx, i === 0 ? '#6e5638' : '#262838', wx, g.H * 0.44, g.u * 7, g.U * 8);
    }
    // a wooden pole with sagging wires
    const px = g.W - g.u * 7;
    rect(ctx, '#121318', px, g.H * 0.08, g.u * 1.4, g.gy - g.H * 0.08);
    rect(ctx, '#121318', px - g.u * 4, g.H * 0.11, g.u * 9, g.U * 0.7);
    ctx.strokeStyle = '#11131a';
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    for (let k = 0; k < 3; k++) {
      const y = g.H * (0.11 + k * 0.012);
      ctx.beginPath();
      ctx.moveTo(px - g.u * 3 + k * g.u * 3, y);
      ctx.quadraticCurveTo(g.W * 0.45, y + g.H * (0.09 + k * 0.015), -g.u * 2, y + g.H * 0.02);
      ctx.stroke();
    }
  }

  // ---- front layer: the shop and the street ---------------------------------

  function paintUpper(ctx, g) {
    poly(ctx, INK.roof, [g.x0 - g.u * 4, g.H * 0.27, g.x0 + g.u * 6, g.H * 0.215, g.x1 - g.u * 6, g.H * 0.215, g.x1 + g.u * 4, g.H * 0.27]);
    for (let i = 1; i < 4; i++) rect(ctx, INK.tile, g.x0, g.H * (0.215 + i * 0.013), g.x1 - g.x0, Math.max(1, g.U * 0.4));
    rect(ctx, INK.fascia, g.x0 - g.u * 4, g.H * 0.27, g.x1 - g.x0 + g.u * 8, g.U * 1.2);
    rect(ctx, WOOD.upper, g.x0, g.H * 0.282, g.x1 - g.x0, g.eave - g.H * 0.282);
    for (let x = g.x0 + g.u * 3; x < g.x1; x += g.u * 3) rect(ctx, WOOD.seam, x, g.H * 0.282, Math.max(1, g.u * 0.35), g.eave - g.H * 0.282);
    // upstairs window, dim
    const wx = g.cx - g.u * 12;
    rect(ctx, WOOD.post, wx - g.u, g.H * 0.31, g.u * 26, g.U * 10);
    rect(ctx, WARM.dim, wx, g.H * 0.32, g.u * 24, g.U * 8);
    for (let x = wx + g.u * 1.6; x < wx + g.u * 24; x += g.u * 1.6) rect(ctx, WOOD.post, x, g.H * 0.32, Math.max(1, g.u * 0.45), g.U * 8);
    // steam pipe
    rect(ctx, '#3a3b42', g.pipe.x, g.pipe.y, g.u * 2.2, g.H * 0.05);
    rect(ctx, '#2a2b30', g.pipe.x - g.u * 0.6, g.pipe.y - g.U * 0.6, g.u * 3.4, g.U);
  }

  function paintEave(ctx, g) {
    const top = g.eave - g.U * 1.5;
    poly(ctx, INK.roof, [g.x0 - g.u * 7, g.eave + g.U * 2.2, g.x0 - g.u * 2, top, g.x1 + g.u * 2, top, g.x1 + g.u * 7, g.eave + g.U * 2.2]);
    rect(ctx, INK.tile, g.x0 - g.u * 5, g.eave + g.U * 0.2, g.x1 - g.x0 + g.u * 10, Math.max(1, g.U * 0.5));
    rect(ctx, INK.fascia, g.x0 - g.u * 7, g.eave + g.U * 2.2, g.x1 - g.x0 + g.u * 14, g.U * 1.3);
  }

  function lattice(ctx, r, step, ink, horizontal) {
    for (let x = r.x + step; x < r.x + r.w - 0.5; x += step) rect(ctx, ink, Math.round(x), r.y, Math.max(1, step * 0.18), r.h);
    if (!horizontal) return;
    for (let y = r.y + horizontal; y < r.y + r.h - 0.5; y += horizontal) rect(ctx, ink, r.x, Math.round(y), r.w, Math.max(1, horizontal * 0.12));
  }

  function paintGround(ctx, g) {
    const top = g.eave + g.U * 3.5;
    rect(ctx, WOOD.lower, g.x0, top, g.x1 - g.x0, g.gy - top);
    for (let x = g.x0 + g.u * 2.5; x < g.x1; x += g.u * 2.5) rect(ctx, WOOD.seam, x, top, Math.max(1, g.u * 0.3), g.gy - top);
    rect(ctx, WOOD.post, g.x0, top, g.u * 1.6, g.gy - top);
    rect(ctx, WOOD.post, g.x1 - g.u * 1.6, top, g.u * 1.6, g.gy - top);
    // latticed front window
    const w = g.win;
    rect(ctx, WOOD.post, w.x - g.u, w.y - g.U, w.w + g.u * 2, w.h + g.U * 2);
    rect(ctx, WARM.paper, w.x, w.y, w.w, w.h);
    lattice(ctx, w, g.u * 1.3, WARM.slat, 0);
    rect(ctx, WOOD.post, w.x, w.y + w.h * 0.5, w.w, Math.max(1, g.U * 0.6));
    // sliding door, shoji glowing
    const d = g.door;
    rect(ctx, WOOD.post, d.x - g.u, d.y - g.U, d.w + g.u * 2, d.h + g.U);
    rect(ctx, WARM.shoji, d.x, d.y, d.w, d.h);
    lattice(ctx, { x: d.x, y: d.y, w: d.w, h: d.h * 0.78 }, g.u * 3.5, WARM.slat, g.U * 4);
    rect(ctx, WOOD.lower, d.x, d.y + d.h * 0.78, d.w, d.h * 0.22);
    rect(ctx, WOOD.post, d.x + d.w * 0.5 - g.u * 0.4, d.y, g.u * 0.8, d.h);
    // sake barrels stacked by the door
    const bx = g.x1 - g.u * 17;
    const bw = g.u * 6.5;
    const bh = g.U * 6.5;
    const rows = [[0, 1, 2], [0.5, 1.5]];
    rows.forEach((row, r) => row.forEach((c) => {
      const x = bx + c * bw;
      const y = g.gy - bh * (r + 1);
      rect(ctx, '#d8ccad', x, y, bw - g.u * 0.5, bh - g.U * 0.4);
      rect(ctx, NOREN.cloth, x, y + bh * 0.18, bw - g.u * 0.5, bh * 0.14);
      rect(ctx, NOREN.cloth, x, y + bh * 0.66, bw - g.u * 0.5, bh * 0.14);
      rect(ctx, LANTERN.body, x + bw * 0.38, y + bh * 0.38, bw * 0.18, bh * 0.2);
    }));
    // a potted pine on the left
    rect(ctx, '#3a2a22', g.x0 - g.u * 1, g.gy - g.U * 4, g.u * 5, g.U * 4);
    blob(ctx, '#2f4a32', g.x0 + g.u * 1.5, g.gy - g.U * 7, g.u * 4, g.U * 3);
    blob(ctx, '#46663e', g.x0 + g.u * 0.8, g.gy - g.U * 7.8, g.u * 2.4, g.U * 1.8);
  }

  function paintStreet(ctx, g, rand) {
    rect(ctx, STREET.stone, 0, g.gy, g.W, g.H - g.gy);
    rect(ctx, '#33343c', 0, g.gy, g.W, Math.max(1, g.U * 0.8));
    for (let y = g.gy + g.U * 3; y < g.H; y += g.U * (3 + (y - g.gy) / (g.U * 6))) {
      rect(ctx, STREET.seam, 0, Math.round(y), g.W, Math.max(1, g.U * 0.3));
    }
    for (let i = 0; i < g.W / (g.u * 8); i++) {
      const x = rand() * g.W;
      const y = g.gy + rand() * (g.H - g.gy);
      rect(ctx, STREET.seam, x, y, Math.max(1, g.U * 0.3), g.U * 2.5);
    }
    // light spill from the door and the window, stepped
    const d = g.door;
    const w = g.win;
    for (let s = 0; s < STREET.spill.length; s++) {
      const k = 1 - s / STREET.spill.length;
      const spread = g.u * 16 * k;
      const depth = (g.H - g.gy) * (0.4 + 0.6 * k);
      poly(ctx, STREET.spill[s], [d.x + g.u * 1, g.gy, d.x + d.w - g.u, g.gy, d.x + d.w + spread, g.gy + depth, d.x - spread, g.gy + depth]);
      poly(ctx, STREET.spill[s], [w.x + g.u * 2, g.gy, w.x + w.w - g.u * 2, g.gy, w.x + w.w + spread * 0.5, g.gy + depth * 0.55, w.x - spread * 0.5, g.gy + depth * 0.55]);
    }
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintStreet(ctx, g, rand);
    paintUpper(ctx, g);
    paintGround(ctx, g);
    paintEave(ctx, g);
    // noren rod and the lantern's hook
    rect(ctx, NOREN.rod, g.noren.x - g.u * 1.5, g.noren.y - g.U * 0.6, g.noren.w + g.u * 3, g.U * 0.9);
    rect(ctx, '#121318', g.lantern.x - 0.5, g.eave + g.U * 3, 1, g.lantern.y - g.eave - g.U * 3 + 1);
    return c;
  }

  // ---- sprites ---------------------------------------------------------------

  function paintLantern(g) {
    const rx = g.lantern.rx;
    const ry = g.lantern.ry;
    const cap = g.U * 1.2;
    const c = layer(rx * 2 + 2, ry * 2 + cap * 2 + 2);
    const ctx = c.getContext('2d');
    const cx = c.width / 2;
    const cy = c.height / 2;
    blob(ctx, LANTERN.body, cx, cy, rx, ry);
    blob(ctx, LANTERN.lit, cx - rx * 0.25, cy - ry * 0.1, rx * 0.45, ry * 0.65);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    ctx.clip();
    for (let y = cy - ry; y < cy + ry; y += Math.max(2, ry / 5)) rect(ctx, LANTERN.rib, 0, Math.round(y), c.width, 1);
    ctx.restore();
    rect(ctx, LANTERN.cap, cx - rx * 0.55, 0, rx * 1.1, cap + 1);
    rect(ctx, LANTERN.cap, cx - rx * 0.55, c.height - cap - 1, rx * 1.1, cap + 1);
    return c;
  }

  // Stepped rings so the glow stays a handful of flat inks.
  function paintGlow(g) {
    const r = g.U * 14;
    const c = layer(r * 2, r * 2);
    const ctx = c.getContext('2d');
    const rings = ['#4a2a28', '#6a3428', '#8a3e2a'];
    for (let i = 0; i < rings.length; i++) {
      const k = 1 - i / rings.length;
      blob(ctx, rings[i], r, r, r * k, r * k * 1.05);
    }
    return c;
  }

  function paintPanel(g, w, h, mark) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    rect(ctx, NOREN.cloth, 0, 0, w, h);
    rect(ctx, NOREN.fold, 0, 0, w, Math.max(1, h * 0.1));
    rect(ctx, NOREN.fold, w - Math.max(1, w * 0.12), 0, Math.max(1, w * 0.12), h);
    if (mark) {
      const r = Math.min(w, h) * 0.28;
      blob(ctx, NOREN.mark, w / 2, h * 0.5, r, r);
      blob(ctx, NOREN.cloth, w / 2, h * 0.5, r * 0.55, r * 0.55);
    }
    rect(ctx, NOREN.mark, 0, h - Math.max(1, h * 0.06), w, Math.max(1, h * 0.06));
    return c;
  }

  function paintPuff(g) {
    const r = Math.max(4, Math.ceil(g.U * 3));
    const c = layer(r * 2, r * 2);
    const ctx = c.getContext('2d');
    blob(ctx, '#8a8c96', r, r, r, r);
    blob(ctx, '#a6a8ae', r - r * 0.2, r - r * 0.2, r * 0.6, r * 0.6);
    return c;
  }

  function makeDrops(g, rand) {
    const n = DROPS;
    const d = { x: new Float32Array(n), y: new Float32Array(n), v: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      d.x[i] = rand() * g.W;
      d.y[i] = rand() * g.H;
      d.v[i] = g.H * (0.7 + rand() * 0.5);
    }
    return d;
  }

  // ---- motion ----------------------------------------------------------------

  function drawLantern(ctx, g, t, breeze, glow) {
    const L = g.lantern;
    const a = Math.sin(t * 1.1) * 0.07 * breeze + Math.sin(t * 2.3 + 1) * 0.02 * breeze;
    const top = g.eave + g.U * 3;
    const len = L.y - top;
    const lx = L.x + Math.sin(a) * len;
    const ly = top + Math.cos(a) * len;
    const gs = state.glow;
    ctx.globalAlpha = glow;
    ctx.drawImage(gs, lx - gs.width / 2, ly + state.lantern.height / 2 - gs.height / 2);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#121318';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(L.x, top);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    const s = state.lantern;
    const c = Math.cos(-a);
    const sn = Math.sin(-a);
    ctx.setTransform(c, sn, -sn, c, lx, ly);
    ctx.drawImage(s, -s.width / 2, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawReflection(ctx, g, t, breeze) {
    const L = g.lantern;
    const s = state.lantern;
    const top = g.gy + g.U * 3;
    const rows = Math.min(s.height, g.H - top);
    ctx.globalAlpha = 0.45;
    for (let r = 0; r < rows; r += 1) {
      const off = Math.sin(t * 2.4 + r * 0.7) * g.u * 0.8 + Math.sin(t * 1.1) * 0.07 * breeze * g.U * 8;
      ctx.drawImage(s, 0, s.height - 1 - r, s.width, 1, L.x - s.width / 2 + off, top + r * 1.3, s.width, 1.3);
    }
    ctx.globalAlpha = 1;
  }

  function drawGuest(ctx, g, t) {
    const p = (t % GUEST_CYCLE) / 9;
    if (p >= 1) return;
    const d = g.door;
    const gx = lerp(d.x - g.u * 6, d.x + d.w + g.u * 6, p);
    const bob = Math.abs(Math.sin(t * 4)) * g.U * 0.4;
    ctx.save();
    ctx.beginPath();
    ctx.rect(d.x, d.y, d.w, d.h * 0.78);
    ctx.clip();
    ctx.globalAlpha = 0.35;
    blob(ctx, '#5a3e26', gx, d.y + d.h * 0.32 - bob, g.u * 2.2, g.U * 2.6);
    rect(ctx, '#5a3e26', gx - g.u * 3.6, d.y + d.h * 0.42 - bob, g.u * 7.2, d.h * 0.5);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawNoren(ctx, g, t, breeze) {
    const N = g.noren;
    const pw = N.w / PANELS;
    for (let p = 0; p < PANELS; p++) {
      const art = state.panels[p];
      const px = N.x + p * pw + g.u * 0.3;
      const rows = art.height;
      for (let r = 0; r < rows; r++) {
        const k = r / rows;
        const wave = (Math.sin(t * 1.6 - k * 2.2 + p * 0.9) * 1.2 + Math.sin(t * 0.7 + p) * 0.8) * g.u * breeze * k * k;
        ctx.drawImage(art, 0, r, art.width, 1, px + wave, N.y + r, art.width, 1);
      }
    }
  }

  function drawSteam(ctx, g, t, amount) {
    if (amount <= 0) return;
    const sx = g.pipe.x + g.u;
    const sy = g.pipe.y;
    const puff = state.puff;
    const n = Math.min(PUFFS, Math.round(PUFFS * Math.min(1, amount)));
    for (let i = 0; i < n; i++) {
      const a = (t * 0.09 + i / PUFFS) % 1;
      const size = puff.width * (0.5 + a * 2.2);
      const dx = a * g.U * 10 + Math.sin(t * 0.5 + i * 1.7) * g.U * 1.5 * a;
      const dy = -a * g.H * 0.17;
      ctx.globalAlpha = (1 - a) * 0.5 * Math.min(1, amount);
      ctx.drawImage(puff, sx + dx - size / 2, sy + dy - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawRain(ctx, g, dt) {
    const d = state.drops;
    ctx.fillStyle = '#8890a8';
    ctx.globalAlpha = 0.55;
    const len = g.U * 2.2;
    for (let i = 0; i < DROPS; i++) {
      d.y[i] += d.v[i] * dt;
      d.x[i] -= d.v[i] * dt * 0.08;
      if (d.y[i] > g.H) {
        d.y[i] -= g.H + len;
        d.x[i] = (d.x[i] + g.W * 0.37) % g.W;
      }
      if (d.x[i] < 0) d.x[i] += g.W;
      ctx.fillRect(d.x[i], d.y[i], 1, len);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed || 7);
    state.g = g;
    const back = layer(g.W, g.H);
    const bctx = back.getContext('2d');
    paintSky(bctx, g, rand);
    paintNeighbours(bctx, g, rand);
    state.back = back;
    state.front = paintFront(g, rand);
    state.lantern = paintLantern(g);
    state.glow = paintGlow(g);
    const pw = Math.max(2, Math.round(g.noren.w / PANELS - g.u * 0.6));
    const ph = Math.max(2, Math.round(g.noren.h));
    state.panels = [];
    for (let p = 0; p < PANELS; p++) state.panels.push(paintPanel(g, pw, ph, p === 1 || p === 2));
    state.puff = paintPuff(g);
    state.drops = makeDrops(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { breeze, steam, rain } = api.props;
    const glow = 0.82 + Math.sin(t * 0.8) * 0.06 + Math.sin(t * 2.1) * 0.03;
    ctx.drawImage(state.back, 0, 0);
    drawSteam(ctx, g, t, steam);
    ctx.drawImage(state.front, 0, 0);
    drawGuest(ctx, g, t);
    drawReflection(ctx, g, t, breeze);
    drawLantern(ctx, g, t, breeze, glow);
    drawNoren(ctx, g, t, breeze);
    if (rain) drawRain(ctx, g, Math.min(dt, 0.1));
  }

  Kasuri.run({
    defaults: { breeze: 1, steam: 1, rain: false, ramp: 'lines', cell: 7, boost: 0.18, gain: 1.1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
