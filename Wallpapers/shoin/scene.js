/*
 * 書院 Shoin — a study alcove: a round window onto a garden, a low desk with a brush
 * stand, a hanging scroll and a lattice window. Warm light from the round window
 * lies on the tatami and the shadows of maple leaves slide slowly across it.
 *
 * Room, garden and desk are baked once. Per frame: the garden canopy leans a little,
 * a few leaves fall outside, and the light patch is rebuilt from one baked disc with
 * two tiled leaf-shadow patterns shifted under it.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm } = K;
  const TAU = Math.PI * 2;
  const LEAVES = 6;
  const MOTES = 14;
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

  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
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
    const R = Math.min(H * 0.26, W * 0.2);
    const cx = W * 0.5;
    const cy = H * 0.38;
    const wy = Math.round(H * 0.74);
    const dw = Math.min(U * 50, W * 0.42);
    const dx = cx + W * 0.1;
    const dy = Math.round(H * 0.83);
    return { W, H, U, R, cx, cy, wy, dw, dx, dy };
  }

  // ---- garden seen through the round window ---------------------------------

  function paintGarden(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const { cx, cy, R, U } = g;
    const top = cy - R;
    const sky = ctx.createLinearGradient(0, top, 0, cy + R);
    sky.addColorStop(0, '#cfd6cb');
    sky.addColorStop(0.55, '#e4e2c9');
    sky.addColorStop(1, '#e8dfbd');
    ctx.fillStyle = sky;
    ctx.fillRect(cx - R - 2, top - 2, R * 2 + 4, R * 2 + 4);
    for (let x = cx - R; x < cx + R; x += 1) {
      const h1 = cy - R * 0.05 - fbm(x / (U * 22), 2.3, 3, 5) * R * 0.5;
      ctx.fillStyle = '#9aa9a8';
      ctx.fillRect(x, h1, 1.5, cy + R - h1);
      const h2 = cy + R * 0.2 - fbm(x / (U * 14), 7.7, 3, 9) * R * 0.38;
      ctx.fillStyle = '#76907c';
      ctx.fillRect(x, h2, 1.5, cy + R - h2);
    }
    ctx.fillStyle = 'rgba(232,226,200,0.45)';
    blob(ctx, cx + R * 0.1, cy + R * 0.08, R * 0.8, R * 0.07);
    paintGround(ctx, g, rand);
    paintBamboo(ctx, g, rand);
    paintLantern(ctx, g);
    paintTrunks(ctx, g);
    return c;
  }

  function paintGround(ctx, g, rand) {
    const { cx, cy, R, U } = g;
    const gy = cy + R * 0.38;
    ctx.fillStyle = '#5f7a47';
    ctx.fillRect(cx - R - 2, gy, R * 2 + 4, R * 0.7);
    ctx.fillStyle = '#74905a';
    for (let i = 0; i < 26; i++) blob(ctx, cx - R + rand() * R * 2, gy + rand() * R * 0.4, U * (1.5 + rand() * 2), U * 0.6);
    ctx.fillStyle = '#d9d2b6';
    ctx.fillRect(cx - R - 2, gy + R * 0.42, R * 2 + 4, R * 0.3);
    ctx.fillStyle = '#c4bc9c';
    for (let y = gy + R * 0.46; y < cy + R; y += U * 1.1) ctx.fillRect(cx - R, y, R * 2, 0.6);
    ctx.fillStyle = '#8a877c';
    const stones = [[-0.42, 0.62, 1], [-0.12, 0.7, 1.2], [0.18, 0.58, 0.9], [0.45, 0.68, 1.1]];
    for (const s of stones) blob(ctx, cx + s[0] * R, cy + s[1] * R, U * 2.6 * s[2], U * 1.1 * s[2]);
  }

  function paintBamboo(ctx, g, rand) {
    const { cx, cy, R, U } = g;
    for (let i = 0; i < 5; i++) {
      const x = cx + R * (0.2 + i * 0.16) + rand() * U;
      ctx.fillStyle = i % 2 ? '#6f8d57' : '#85a066';
      ctx.fillRect(x, cy - R, Math.max(1, U * 0.9), R * 1.4);
      ctx.fillStyle = '#4d6a3c';
      for (let y = cy - R + rand() * U * 4; y < cy + R * 0.4; y += U * (5 + rand() * 3)) ctx.fillRect(x - 0.4, y, U * 1.2, 0.8);
    }
  }

  function paintLantern(ctx, g) {
    const { cx, cy, R, U } = g;
    const x = cx - R * 0.1;
    const y = cy + R * 0.6;
    ctx.fillStyle = '#7f7f77';
    blob(ctx, x, y, U * 3, U * 0.9);
    ctx.fillRect(x - U * 0.9, y - U * 4.5, U * 1.8, U * 4.5);
    ctx.fillStyle = '#9a9a90';
    ctx.fillRect(x - U * 2.4, y - U * 6.2, U * 4.8, U * 1.8);
    ctx.fillStyle = '#4c5348';
    ctx.fillRect(x - U * 1.1, y - U * 9.4, U * 2.2, U * 3.2);
    ctx.fillStyle = '#8f8f85';
    poly(ctx, [x - U * 4, y - U * 9.4, x + U * 4, y - U * 9.4, x + U * 1.5, y - U * 12, x - U * 1.5, y - U * 12]);
    ctx.fillStyle = '#a3a398';
    blob(ctx, x, y - U * 12.6, U * 0.9, U * 0.9);
  }

  function paintTrunks(ctx, g) {
    const { cx, cy, R, U } = g;
    ctx.strokeStyle = '#4a3a2c';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, U * 2.2);
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.62, cy + R * 0.65);
    ctx.quadraticCurveTo(cx - R * 0.7, cy + R * 0.2, cx - R * 0.5, cy - R * 0.05);
    ctx.stroke();
    ctx.lineWidth = Math.max(1.2, U * 1.2);
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.58, cy + R * 0.3);
    ctx.quadraticCurveTo(cx - R * 0.35, cy + R * 0.1, cx - R * 0.18, cy + R * 0.08);
    ctx.stroke();
    ctx.strokeStyle = '#5a4535';
    ctx.lineWidth = Math.max(1.4, U * 1.6);
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.82, cy + R * 0.7);
    ctx.quadraticCurveTo(cx + R * 0.7, cy + R * 0.3, cx + R * 0.58, cy - R * 0.05);
    ctx.stroke();
  }

  function paintCanopy(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const { cx, cy, R, U } = g;
    const pads = [[-0.5, -0.1, 2.4], [-0.18, 0.06, 2], [-0.58, 0.2, 1.8], [-0.36, -0.28, 1.5]];
    for (const p of pads) {
      const x = cx + p[0] * R;
      const y = cy + p[1] * R;
      const s = p[2] * U;
      ctx.fillStyle = '#2f4631';
      blob(ctx, x, y, s * 3.2, s * 0.95);
      ctx.fillStyle = '#42603c';
      blob(ctx, x - s * 0.3, y - s * 0.25, s * 2.5, s * 0.6);
      ctx.fillStyle = '#5c7b48';
      blob(ctx, x - s * 0.7, y - s * 0.4, s * 1.4, s * 0.3);
    }
    const tones = ['#9a3a28', '#b9472c', '#cf6b34', '#d99a46'];
    for (let i = 0; i < 40; i++) {
      const a = rand() * TAU;
      const d = Math.sqrt(rand());
      const x = cx + R * 0.66 + Math.cos(a) * d * R * 0.5;
      const y = cy - R * 0.28 + Math.sin(a) * d * R * 0.3;
      ctx.fillStyle = tones[Math.min(3, Math.floor(rand() * 4))];
      blob(ctx, x, y, U * (1.2 + rand() * 1.6), U * (0.9 + rand() * 1.1), rand() * 3);
    }
    return c;
  }

  // ---- room: wall, beams, scroll, lattice window, floor ---------------------

  function paintWall(ctx, g, rand) {
    const { W, H, U, wy } = g;
    ctx.fillStyle = '#d6ccb0';
    ctx.fillRect(0, 0, W, wy);
    ctx.fillStyle = 'rgba(160,140,100,0.14)';
    for (let i = 0; i < W * H * 0.02; i++) ctx.fillRect(rand() * W, rand() * wy, 1, 1);
    rect(ctx, 0, 0, W, H * 0.075, '#33281f');
    rect(ctx, 0, H * 0.075, W, H * 0.04, '#5a4430');
    rect(ctx, 0, H * 0.075, W, 1, '#7d6446');
    rect(ctx, 0, H * 0.115, W, 1, '#2a2019');
    for (const px of [W * 0.03, W * 0.97 - U * 3]) {
      rect(ctx, px, 0, U * 3, wy, '#4a3826');
      rect(ctx, px, 0, 1, wy, '#6b5338');
    }
    rect(ctx, 0, wy - U * 1.6, W, U * 1.6, '#3b2d22');
    rect(ctx, 0, wy - U * 1.6, W, 1, '#5d4833');
  }

  function paintScroll(ctx, g) {
    const { W, H, U } = g;
    const x = Math.round(W * 0.13);
    const y = Math.round(H * 0.17);
    const w = Math.round(U * 8);
    const h = Math.round(H * 0.4);
    rect(ctx, x - 1, y - U * 1.2, w + 2, U * 1.2, '#2c241c');
    rect(ctx, x, y, w, h, '#33426a');
    rect(ctx, x + U, y + U * 1.5, w - U * 2, h - U * 4, '#e8e0c6');
    rect(ctx, x - 1, y + h, w + 2, U * 1.2, '#2c241c');
    ctx.fillStyle = '#d6452c';
    blob(ctx, x + w * 0.62, y + h * 0.22, U * 1.1, U * 1.1);
    ctx.fillStyle = '#3a3a3c';
    const my = y + h * 0.62;
    poly(ctx, [x + U * 1.2, my + U * 8, x + w * 0.45, my - U * 2, x + w * 0.62, my + U * 2, x + w - U * 1.2, my + U * 8]);
    ctx.fillStyle = '#6c6a66';
    poly(ctx, [x + U * 1.2, my + U * 8, x + w * 0.7, my + U * 3, x + w - U * 1.2, my + U * 8]);
  }

  function paintShoji(ctx, g) {
    const { W, H, U, wy } = g;
    const x = Math.round(W * 0.77);
    const y = Math.round(H * 0.19);
    const w = Math.round(Math.min(W * 0.17, U * 26));
    const h = Math.round(wy - U * 2 - H * 0.19 - U * 4);
    rect(ctx, x - U, y - U, w + U * 2, h + U * 2, '#4a3826');
    rect(ctx, x, y, w, h, '#efe8d0');
    ctx.fillStyle = 'rgba(255,238,190,0.28)';
    ctx.fillRect(x, y, w, h);
    const cols = Math.max(3, Math.round(w / (U * 5)));
    const rows = Math.max(6, Math.round(h / (U * 3.2)));
    for (let i = 1; i < cols; i++) rect(ctx, x + (w * i) / cols, y, Math.max(1, U * 0.45), h, '#6b5338');
    for (let j = 1; j < rows; j++) rect(ctx, x, y + (h * j) / rows, w, Math.max(1, U * 0.35), '#6b5338');
    rect(ctx, x + w / 2 - U * 0.3, y, Math.max(1, U * 0.7), h, '#4a3826');
    rect(ctx, x, y + h * 0.78, w, h * 0.22, '#d9cfa8');
    rect(ctx, x, y + h * 0.78, w, Math.max(1, U * 0.7), '#4a3826');
  }

  function paintFloor(ctx, g, rand) {
    const { W, H, U, wy } = g;
    ctx.fillStyle = '#aaa56c';
    ctx.fillRect(0, wy, W, H - wy);
    ctx.fillStyle = 'rgba(70,80,40,0.12)';
    for (let y = wy; y < H; y += 2) ctx.fillRect(0, y, W, 1);
    for (let i = 0; i < W * 4; i++) {
      ctx.fillStyle = rand() < 0.5 ? 'rgba(220,214,150,0.18)' : 'rgba(90,100,50,0.14)';
      ctx.fillRect(rand() * W, wy + rand() * (H - wy), 3, 1);
    }
    const seams = [W * 0.22, W * 0.64];
    for (const sx of seams) {
      rect(ctx, sx, wy, U * 0.9, H - wy, '#232a3a');
      rect(ctx, sx + U * 0.9, wy, 1, H - wy, '#c4bf86');
    }
    rect(ctx, 0, wy + U * 7.5, W, U * 0.9, '#232a3a');
    rect(ctx, 0, wy + U * 8.4, W, 1, '#c4bf86');
  }

  function paintRoom(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintWall(ctx, g, rand);
    paintScroll(ctx, g);
    paintShoji(ctx, g);
    paintFloor(ctx, g, rand);
    const { cx, cy, R, U } = g;
    ctx.fillStyle = '#3d2f22';
    blob(ctx, cx, cy, R + U * 2.4, R + U * 2.4);
    ctx.fillStyle = '#7a6244';
    blob(ctx, cx, cy, R + U * 1.2, R + U * 1.2);
    ctx.fillStyle = '#5a4630';
    blob(ctx, cx, cy, R + U * 0.5, R + U * 0.5);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    blob(ctx, cx, cy, R, R);
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  function paintBars(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const { cx, cy, R, U } = g;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R + 1, 0, TAU);
    ctx.clip();
    for (const f of [-0.34, 0.34]) rect(ctx, cx + f * R - U * 0.3, cy - R, Math.max(1, U * 0.7), R * 2, '#5a4630');
    ctx.restore();
    return c;
  }

  // ---- desk with brush stand -------------------------------------------------

  function paintDesk(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const U = g.U * 1.3;
    const { dx, dy, dw } = g;
    const x0 = Math.round(dx - dw / 2);
    rect(ctx, x0 + U * 2, dy + U * 3, U * 2.4, U * 8, '#241a14');
    rect(ctx, x0 + dw - U * 4.4, dy + U * 3, U * 2.4, U * 8, '#241a14');
    rect(ctx, x0 + U, dy + U * 3, dw - U * 2, U * 1.4, '#352619');
    rect(ctx, x0, dy, dw, U * 3, '#2b1f17');
    rect(ctx, x0, dy, dw, Math.max(1, U * 0.6), '#6a4a30');
    rect(ctx, x0 - U * 0.6, dy - U * 0.3, U * 1.2, U * 3.6, '#3b2b1e');
    rect(ctx, x0 + dw - U * 0.6, dy - U * 0.3, U * 1.2, U * 3.6, '#3b2b1e');
    paintOnDesk(ctx, g, x0);
    return c;
  }

  function paintOnDesk(ctx, g, x0) {
    const U = g.U * 1.3;
    const { dy, dw } = g;
    const base = dy;
    rect(ctx, x0 + U * 2, base - U * 1.4, U * 8, U * 1.4, '#14131a');
    rect(ctx, x0 + U * 2.8, base - U * 1.9, U * 4, U * 0.6, '#2e2e38');
    rect(ctx, x0 + U * 10.2, base - U * 1.2, U * 1.6, U * 1.2, '#b7b9c4');
    const sx = x0 + dw * 0.5;
    rect(ctx, sx, base - U * 4.6, U * 4.2, U * 4.6, '#7d8a52');
    rect(ctx, sx, base - U * 4.6, U * 1, U * 4.6, '#a4b072');
    rect(ctx, sx, base - U * 2.8, U * 4.2, Math.max(1, U * 0.5), '#4a5a30');
    const brush = [[0.6, 9.5, '#caa45a'], [1.9, 11.5, '#6a4a30'], [3.2, 8.7, '#caa45a']];
    for (const b of brush) {
      rect(ctx, sx + U * b[0], base - U * (4.6 + b[1] - 4), U * 0.55, U * (b[1] - 3), b[2]);
      rect(ctx, sx + U * b[0], base - U * (4.6 + b[1] - 4) - U * 1.8, U * 0.6, U * 1.8, '#2a2622');
    }
    const rx = x0 + dw * 0.68;
    rect(ctx, rx, base - U * 2.2, U * 9, U * 2.2, '#ece4cc');
    rect(ctx, rx, base - U * 2.2, U * 9, Math.max(1, U * 0.4), '#c9bf9d');
    rect(ctx, rx + U * 5.2, base - U * 2.2, U * 0.9, U * 2.2, '#33426a');
    rect(ctx, rx + U * 9, base - U * 2, U * 0.9, U * 1.8, '#d9cfa8');
    rect(ctx, x0 + dw - U * 7, base - U * 1.8, U * 3, U * 1.8, '#c43f2a');
    rect(ctx, x0 + dw - U * 7, base - U * 1.8, U * 3, Math.max(1, U * 0.4), '#e2735a');
  }

  // ---- light: one disc, two tiled shadow patterns -----------------------------

  function dappleTile(size, count, rand, U) {
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    for (let i = 0; i < count; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const rx = U * (0.9 + rand() * 1.6);
      const ry = rx * (0.45 + rand() * 0.35);
      const a = rand() * TAU;
      for (let ox = -size; ox <= size; ox += size) {
        for (let oy = -size; oy <= size; oy += size) blob(ctx, x + ox, y + oy, rx, ry, a);
      }
    }
    return c;
  }

  function makeLight(g, rand) {
    const { U, R, cx, wy } = g;
    const rx = R * 1.0;
    const ry = R * 0.4;
    const bw = Math.ceil(rx * 2 + U * 6);
    const bh = Math.ceil(ry * 2 + U * 6);
    const disc = layer(bw, bh);
    const dctx = disc.getContext('2d');
    dctx.fillStyle = '#f0d27a';
    dctx.save();
    dctx.translate(bw / 2, bh / 2);
    dctx.transform(1, 0, -0.35, 1, 0, 0);
    blob(dctx, 0, 0, rx, ry);
    dctx.fillStyle = '#f7e6a8';
    blob(dctx, -rx * 0.05, -ry * 0.1, rx * 0.8, ry * 0.7);
    dctx.restore();
    const tmp = layer(bw, bh);
    const tctx = tmp.getContext('2d');
    const size = Math.round(U * 22);
    const patA = tctx.createPattern(dappleTile(size, 11, rand, U), 'repeat');
    const patB = tctx.createPattern(dappleTile(size, 9, rand, U * 0.7), 'repeat');
    return { disc, tmp, tctx, patA, patB, size, bw, bh, x: Math.round(cx - g.W * 0.2 - bw / 2), y: Math.round(wy + R * 0.38 - bh / 2) };
  }

  function drawLight(ctx, t, strength) {
    const L = state.light;
    const tc = L.tctx;
    const s = L.size;
    tc.globalCompositeOperation = 'source-over';
    tc.globalAlpha = 1;
    tc.clearRect(0, 0, L.bw, L.bh);
    tc.drawImage(L.disc, 0, 0);
    tc.globalCompositeOperation = 'destination-out';
    tc.globalAlpha = Math.min(1, 0.78 * strength);
    let ox = (t * 1.6 + Math.sin(t * 0.37) * 3) % s;
    let oy = (t * 0.7 + Math.sin(t * 0.23 + 1) * 2) % s;
    tc.setTransform(1, 0, 0, 1, ox, oy);
    tc.fillStyle = L.patA;
    tc.fillRect(-ox, -oy, L.bw, L.bh);
    tc.globalAlpha = Math.min(1, 0.5 * strength);
    ox = (s - ((t * 1.1 + Math.sin(t * 0.29 + 2) * 2.5) % s)) % s;
    oy = (t * 0.9 + Math.sin(t * 0.41) * 2) % s;
    tc.setTransform(1, 0, 0, 1, ox, oy);
    tc.fillStyle = L.patB;
    tc.fillRect(-ox, -oy, L.bw, L.bh);
    tc.setTransform(1, 0, 0, 1, 0, 0);
    tc.globalCompositeOperation = 'source-over';
    tc.globalAlpha = 1;
    ctx.globalAlpha = 0.8 + 0.1 * Math.sin(t * 0.4);
    ctx.drawImage(L.tmp, L.x, L.y);
    ctx.globalAlpha = 1;
  }

  function makeMotes(g, rand) {
    const L = state.light;
    const m = { x: new Float32Array(MOTES), y: new Float32Array(MOTES), p: new Float32Array(MOTES), v: new Float32Array(MOTES) };
    for (let i = 0; i < MOTES; i++) {
      m.x[i] = rand() * L.bw;
      m.y[i] = rand() * g.H * 0.3;
      m.p[i] = rand() * TAU;
      m.v[i] = 0.4 + rand() * 0.8;
    }
    return m;
  }

  function drawMotes(ctx, t, g) {
    const m = state.motes;
    const L = state.light;
    const top = L.y - g.H * 0.28;
    ctx.fillStyle = '#f7e6a8';
    for (let i = 0; i < MOTES; i++) {
      const x = L.x + ((m.x[i] + t * m.v[i] * 0.8 + Math.sin(t * 0.6 + m.p[i]) * 2) % L.bw);
      const y = top + ((m.y[i] + t * m.v[i] * 0.7) % (g.H * 0.4));
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 0.8 + m.p[i]);
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // ---- falling leaves outside ---------------------------------------------

  function makeLeaves(g, rand) {
    const f = { x: new Float32Array(LEAVES), y: new Float32Array(LEAVES), p: new Float32Array(LEAVES), v: new Float32Array(LEAVES) };
    for (let i = 0; i < LEAVES; i++) {
      f.x[i] = g.cx + g.R * (rand() * 1.2 - 0.2);
      f.y[i] = g.cy - g.R * 0.3 + rand() * g.R;
      f.p[i] = rand() * TAU;
      f.v[i] = 0.5 + rand() * 0.5;
    }
    return f;
  }

  function stepLeaves(g, dt, t, rand) {
    const f = state.fall;
    for (let i = 0; i < LEAVES; i++) {
      f.y[i] += dt * g.U * 2.2 * f.v[i];
      f.x[i] += dt * g.U * (0.8 + Math.sin(t * 0.9 + f.p[i]) * 1.2);
      if (f.y[i] > g.cy + g.R * 0.7) {
        f.y[i] = g.cy - g.R * 0.35;
        f.x[i] = g.cx + g.R * (0.1 + rand() * 0.8);
      }
    }
  }

  function drawLeaves(ctx, g, t) {
    const f = state.fall;
    const s = Math.max(1, g.U * 0.9);
    for (let i = 0; i < LEAVES; i++) {
      ctx.fillStyle = i % 2 ? '#c4452b' : '#d98a3e';
      ctx.fillRect(Math.round(f.x[i]), Math.round(f.y[i]), Math.max(1, Math.round(s * (0.6 + 0.4 * Math.abs(Math.sin(t + f.p[i]))))), Math.max(1, Math.round(s * 0.7)));
    }
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.garden = paintGarden(g, rand);
    state.canopy = paintCanopy(g, rand);
    state.room = paintRoom(g, rand);
    state.bars = paintBars(g);
    state.desk = paintDesk(g);
    state.light = makeLight(g, rand);
    state.motes = makeMotes(g, rand);
    state.fall = makeLeaves(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { light, breeze } = api.props;
    stepLeaves(g, Math.min(dt, 0.1) * breeze, t, state.rand);
    ctx.drawImage(state.garden, 0, 0);
    const py = g.cy + g.R * 0.65;
    const sh = (Math.sin(t * 0.55) * 0.05 + Math.sin(t * 1.4 + 1) * 0.015) * breeze;
    ctx.setTransform(1, 0, sh, 1, -sh * py, 0);
    ctx.drawImage(state.canopy, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawLeaves(ctx, g, t);
    ctx.drawImage(state.room, 0, 0);
    ctx.drawImage(state.bars, 0, 0);
    drawLight(ctx, t, light);
    drawMotes(ctx, t, g);
    ctx.drawImage(state.desk, 0, 0);
  }

  Kasuri.run({
    defaults: { light: 1, breeze: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
