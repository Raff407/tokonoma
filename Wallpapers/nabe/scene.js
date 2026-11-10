/*
 * 鍋 Nabe — a clay hot-pot simmering on a low table in a snowy-night farmhouse.
 *
 * Room, window, table and pot are baked once. Each frame lays snow behind the
 * lattice, a slow breath of lamp light, bubbles in the broth and a short pool
 * of steam puffs, all computed from the clock.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const FLOOR = 0.62;
  const TABLE = 0.76;
  const FLAKES = 70;
  const PUFFS = 14;
  const BUBBLES = 6;
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
    const cx = W * 0.5;
    const win = { x: W * 0.2 - u * 16, y: U * 14, w: u * 32, h: U * 40 };
    win.open = win.h * 0.58;
    return { W, H, U, u, cx, floor: H * FLOOR, ty: H * TABLE, win, lampY: U * 15 };
  }

  // ---- room ----------------------------------------------------------------

  function paintWall(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.floor);
    grad.addColorStop(0, '#2c2420');
    grad.addColorStop(1, '#3a2f27');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.floor);
    ctx.fillStyle = '#332a23';
    for (let x = 0; x < g.W; x += g.u * 9) ctx.fillRect(x, g.U * 7, Math.max(1, g.u * 0.35), g.floor - g.U * 7);
    ctx.fillStyle = '#1f1712';
    ctx.fillRect(0, 0, g.W, g.U * 6);
    ctx.fillStyle = '#2b2018';
    ctx.fillRect(0, g.U * 6, g.W, g.U * 1.2);
    ctx.fillStyle = '#2a1f17';
    ctx.fillRect(0, g.U * 10, g.W, g.U * 2);
    ctx.fillStyle = '#17110d';
    ctx.fillRect(0, g.floor - g.U * 2.4, g.W, g.U * 2.4);
    ctx.fillStyle = '#4a3a2c';
    for (let i = 0; i < 40; i++) ctx.fillRect(rand() * g.W, g.U * (13 + rand() * 45), g.u * (1 + rand() * 4), 1);
  }

  function pineOutside(ctx, g, x, base, h) {
    ctx.fillStyle = '#1f2c2e';
    ctx.fillRect(x - h * 0.03, base - h * 0.2, h * 0.06, h * 0.2);
    for (let i = 0; i < 3; i++) {
      const w = h * (0.34 - i * 0.08);
      const y = base - h * (0.16 + i * 0.26);
      ctx.fillStyle = '#233436';
      poly(ctx, [x - w, y, x + w, y, x, y - h * 0.34]);
      ctx.fillStyle = '#c9d2de';
      poly(ctx, [x - w * 0.55, y - h * 0.15, x + w * 0.55, y - h * 0.15, x, y - h * 0.34]);
    }
  }

  function paintOutside(ctx, g) {
    const w = g.win;
    const grad = ctx.createLinearGradient(0, w.y, 0, w.y + w.open);
    grad.addColorStop(0, '#141b36');
    grad.addColorStop(1, '#2a3558');
    ctx.fillStyle = grad;
    ctx.fillRect(w.x, w.y, w.w, w.open);
    ctx.fillStyle = '#34406a';
    poly(ctx, [w.x, w.y + w.open * 0.7, w.x + w.w * 0.3, w.y + w.open * 0.45, w.x + w.w * 0.65, w.y + w.open * 0.62, w.x + w.w, w.y + w.open * 0.5, w.x + w.w, w.y + w.open, w.x, w.y + w.open]);
    // thatched farmhouse roof under snow
    const rx = w.x + w.w * 0.68;
    const ry = w.y + w.open * 0.86;
    ctx.fillStyle = '#1b1a26';
    ctx.fillRect(rx - g.u * 5, ry - g.U * 2, g.u * 10, g.U * 3);
    ctx.fillStyle = '#d4a85a';
    ctx.fillRect(rx - g.u * 1.2, ry - g.U * 1.5, g.u * 2, g.U * 1.2);
    ctx.fillStyle = '#2a2d40';
    poly(ctx, [rx - g.u * 8, ry - g.U * 1.6, rx + g.u * 8, ry - g.U * 1.6, rx + g.u * 3, ry - g.U * 7, rx - g.u * 3, ry - g.U * 7]);
    ctx.fillStyle = '#c9d2de';
    poly(ctx, [rx - g.u * 6.8, ry - g.U * 2.4, rx + g.u * 6.8, ry - g.U * 2.4, rx + g.u * 2.8, ry - g.U * 6.8, rx - g.u * 2.8, ry - g.U * 6.8]);
    pineOutside(ctx, g, w.x + w.w * 0.2, w.y + w.open + g.U * 0.5, g.U * 17);
    pineOutside(ctx, g, w.x + w.w * 0.4, w.y + w.open + g.U * 0.5, g.U * 11);
    ctx.fillStyle = '#aab6c6';
    ctx.fillRect(w.x, w.y + w.open - g.U * 1.6, w.w, g.U * 1.6);
  }

  function paintWindowFrame(g) {
    const w = g.win;
    const c = layer(w.w + g.u * 4, w.h + g.U * 4);
    const ctx = c.getContext('2d');
    const ox = g.u * 2;
    const oy = g.U * 2;
    const bar = Math.max(1, g.u * 1.1);
    ctx.fillStyle = '#b9ac8c';
    ctx.fillRect(ox, oy + w.open, w.w, w.h - w.open);
    ctx.fillStyle = '#6b5f48';
    for (let i = 1; i < 4; i++) ctx.fillRect(ox + (w.w * i) / 4, oy + w.open, Math.max(1, g.u * 0.5), w.h - w.open);
    ctx.fillRect(ox, oy + w.open + (w.h - w.open) / 2, w.w, Math.max(1, g.u * 0.5));
    ctx.fillStyle = '#2b1f16';
    for (let i = 1; i < 5; i++) ctx.fillRect(ox + (w.w * i) / 5 - bar / 2, oy, bar, w.open);
    ctx.fillRect(ox, oy + w.open - bar / 2, w.w, bar);
    ctx.fillRect(ox, oy + w.open * 0.5 - bar * 0.3, w.w, bar * 0.6);
    ctx.fillStyle = '#21170f';
    ctx.fillRect(0, oy - bar, w.w + ox * 2, bar * 1.4);
    ctx.fillRect(0, oy - bar, bar * 1.4, w.h + bar * 2);
    ctx.fillRect(w.w + ox * 2 - bar * 1.4, oy - bar, bar * 1.4, w.h + bar * 2);
    ctx.fillStyle = '#3a2a1c';
    ctx.fillRect(0, oy + w.h, w.w + ox * 2, g.U * 1.4);
    ctx.fillStyle = '#c9d2de';
    ctx.fillRect(ox, oy + w.h - g.U * 0.3, w.w, g.U * 0.5);
    return { c, ox, oy };
  }

  function paintScroll(ctx, g) {
    const x = g.W * 0.82;
    const w = g.u * 12;
    const y = g.U * 13;
    const h = g.U * 38;
    ctx.fillStyle = '#1a2444';
    ctx.fillRect(x - w / 2 - g.u, y, w + g.u * 2, h + g.U * 2);
    ctx.fillStyle = '#b8ad90';
    ctx.fillRect(x - w / 2, y + g.U * 3, w, h - g.U * 6);
    ctx.fillStyle = '#3f4630';
    ctx.lineWidth = Math.max(1, g.u * 0.45);
    ctx.strokeStyle = '#3f4630';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.3, y + h * 0.78);
    ctx.quadraticCurveTo(x, y + h * 0.5, x + w * 0.2, y + h * 0.28);
    ctx.stroke();
    ctx.fillStyle = '#8a3524';
    for (let i = 0; i < 6; i++) blob(ctx, x - w * 0.08 + (i % 3) * g.u * 1.2, y + h * (0.3 + 0.03 * i) + (i % 2) * g.U, g.u * 0.7, g.u * 0.7);
    ctx.fillStyle = '#4a5a3c';
    blob(ctx, x - w * 0.2, y + h * 0.62, g.u * 1.6, g.u * 0.7);
    blob(ctx, x + w * 0.05, y + h * 0.46, g.u * 1.5, g.u * 0.7);
    ctx.fillStyle = '#14100c';
    ctx.fillRect(x - w / 2 - g.u * 1.4, y + h + g.U * 1.6, w + g.u * 2.8, g.U * 0.9);
  }

  function paintFloor(ctx, g) {
    const f = g.floor;
    const vy = g.U * 20;
    ctx.fillStyle = '#4d5035';
    ctx.fillRect(0, f, g.W, g.H - f);
    ctx.fillStyle = '#585b3b';
    for (let y = f + g.U * 1; y < g.H; y += g.U * 1.6) ctx.fillRect(0, y, g.W, 1);
    const at = (xb, y) => g.cx + (xb - g.cx) * ((y - vy) / (g.H - vy));
    ctx.strokeStyle = '#1b1a12';
    ctx.lineWidth = Math.max(1, g.u * 0.5);
    for (let k = -6; k <= 6; k++) {
      const xb = g.cx + k * g.u * 36;
      ctx.beginPath();
      ctx.moveTo(at(xb, f), f);
      ctx.lineTo(at(xb, g.H), g.H);
      ctx.stroke();
    }
    ctx.fillStyle = '#1b1a12';
    for (const y of [f + g.U * 15, f + g.U * 30]) ctx.fillRect(0, y, g.W, Math.max(1, g.u * 0.5));
    ctx.fillStyle = '#243058';
    for (let k = -6; k <= 6; k++) {
      const xb = g.cx + k * g.u * 36;
      ctx.fillRect(at(xb, f) - 1, f, 2, g.H - f);
    }
  }

  function zabuton(ctx, g, x, y) {
    const w = g.u * 12;
    const h = g.U * 4.5;
    ctx.fillStyle = '#10152a';
    blob(ctx, x, y + h * 0.5, w * 1.05, h * 0.75);
    ctx.fillStyle = '#26335a';
    blob(ctx, x, y, w, h);
    ctx.fillStyle = '#34447a';
    blob(ctx, x - w * 0.1, y - h * 0.15, w * 0.78, h * 0.6);
    ctx.fillStyle = '#8a3524';
    ctx.fillRect(x - 1, y - h * 0.2, 2, 2);
  }

  // ---- table, pot, things on the table --------------------------------------

  function paintTable(ctx, g) {
    const { cx, ty, u, U } = g;
    ctx.fillStyle = '#0d0a08';
    blob(ctx, cx, ty + U * 12, u * 34, U * 5);
    ctx.fillStyle = '#2e1e12';
    for (const dx of [-24, -8, 8, 24]) ctx.fillRect(cx + u * dx - u * 1.5, ty + U * 2, u * 3, U * 9);
    ctx.fillStyle = '#3a2616';
    blob(ctx, cx, ty + U * 2.4, u * 31, U * 6.6);
    ctx.fillStyle = '#4e331d';
    ctx.fillRect(cx - u * 31, ty, u * 62, U * 2.4);
    blob(ctx, cx, ty, u * 31, U * 6.6);
    ctx.fillStyle = '#6a4528';
    blob(ctx, cx, ty - U * 0.3, u * 30, U * 6.1);
    ctx.fillStyle = '#7a5130';
    blob(ctx, cx - u * 4, ty - U * 0.9, u * 24, U * 4.6);
    ctx.fillStyle = '#6a4528';
    blob(ctx, cx - u * 3, ty - U * 0.5, u * 19, U * 3.3);
  }

  function bowl(ctx, g, x, y, body, rim, food) {
    const u = g.u;
    const U = g.U;
    ctx.fillStyle = '#1d140d';
    blob(ctx, x + u * 0.5, y + U * 0.4, u * 4.2, U * 1);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(x, y - U * 1.6, u * 4, U * 2.4, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = rim;
    blob(ctx, x, y - U * 1.9, u * 4, U * 1.2);
    ctx.fillStyle = food;
    blob(ctx, x, y - U * 1.9, u * 3.2, U * 0.85);
  }

  function tokkuri(ctx, g, x, y) {
    const u = g.u;
    const U = g.U;
    ctx.fillStyle = '#1d140d';
    blob(ctx, x + u, y + U * 0.4, u * 3, U * 0.9);
    ctx.fillStyle = '#d6cdb4';
    blob(ctx, x, y - U * 2.2, u * 2.8, U * 2.6);
    ctx.fillRect(x - u * 0.9, y - U * 6.2, u * 1.8, U * 3);
    ctx.fillStyle = '#243058';
    ctx.fillRect(x - u * 2.8, y - U * 2.7, u * 5.6, U * 1.1);
    blob(ctx, x, y - U * 6.4, u * 1.3, U * 0.5);
    ctx.fillStyle = '#e8e0cc';
    blob(ctx, x - u * 1.1, y - U * 3.2, u * 0.7, U * 1);
  }

  function ochoko(ctx, g, x, y) {
    ctx.fillStyle = '#d6cdb4';
    ctx.beginPath();
    ctx.ellipse(x, y - g.U * 0.9, g.u * 1.5, g.U * 1.1, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#243058';
    blob(ctx, x, y - g.U * 1, g.u * 1.5, g.U * 0.5);
  }

  function tofuPlate(ctx, g, x, y) {
    const u = g.u;
    const U = g.U;
    ctx.fillStyle = '#1d140d';
    blob(ctx, x + u, y + U * 0.4, u * 6.4, U * 1.6);
    ctx.fillStyle = '#d6cdb4';
    blob(ctx, x, y, u * 6, U * 1.6);
    ctx.fillStyle = '#a79d86';
    blob(ctx, x, y + U * 0.1, u * 5, U * 1.1);
    ctx.fillStyle = '#ece6d4';
    for (let i = 0; i < 3; i++) ctx.fillRect(x - u * 3.5 + i * u * 2.5, y - U * 1.9 + (i % 2) * U * 0.5, u * 2, U * 1.7);
    ctx.fillStyle = '#4a5a3c';
    blob(ctx, x + u * 2.5, y - U * 0.4, u * 1.6, U * 0.6);
    ctx.fillStyle = '#8a3524';
    blob(ctx, x - u * 3.6, y - U * 0.2, u * 0.8, U * 0.5);
  }

  function chopsticks(ctx, g, x, y) {
    ctx.strokeStyle = '#d8b878';
    ctx.lineWidth = Math.max(1, g.u * 0.35);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + g.u * 8, y - g.U * 1.2);
    ctx.moveTo(x + g.u * 0.7, y + g.U * 0.6);
    ctx.lineTo(x + g.u * 8.7, y - g.U * 0.6);
    ctx.stroke();
  }

  function paintPot(ctx, g) {
    const { cx, ty, u, U } = g;
    const base = ty - U * 1;
    const rim = ty - U * 12;
    ctx.fillStyle = '#2a190d';
    blob(ctx, cx, ty - U * 0.6, u * 11, U * 2);
    ctx.fillStyle = '#0e0a07';
    blob(ctx, cx + u * 1.5, ty + U * 0.2, u * 12, U * 1.5);
    // body: dark glaze above, clay below
    ctx.fillStyle = '#6e4a34';
    ctx.beginPath();
    ctx.moveTo(cx - u * 8, base);
    ctx.bezierCurveTo(cx - u * 13, base - U * 1, cx - u * 13, rim + U * 4, cx - u * 9.8, rim);
    ctx.lineTo(cx + u * 9.8, rim);
    ctx.bezierCurveTo(cx + u * 13, rim + U * 4, cx + u * 13, base - U * 1, cx + u * 8, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3f2a1f';
    ctx.beginPath();
    ctx.moveTo(cx + u * 6, base);
    ctx.bezierCurveTo(cx + u * 13, base - U * 1, cx + u * 13, rim + U * 4, cx + u * 9.8, rim);
    ctx.lineTo(cx + u * 4, rim);
    ctx.bezierCurveTo(cx + u * 10, rim + U * 4, cx + u * 9, base - U * 3, cx + u * 6, base);
    ctx.fill();
    ctx.fillStyle = '#2b2420';
    ctx.beginPath();
    ctx.moveTo(cx - u * 11.6, rim + U * 3.6);
    ctx.bezierCurveTo(cx - u * 11.2, rim + U * 1.8, cx - u * 10.5, rim + U * 0.6, cx - u * 9.8, rim);
    ctx.lineTo(cx + u * 9.8, rim);
    ctx.bezierCurveTo(cx + u * 10.5, rim + U * 0.6, cx + u * 11.2, rim + U * 1.8, cx + u * 11.6, rim + U * 3.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8c6046';
    ctx.fillRect(cx - u * 10, rim + U * 5, u * 0.9, U * 3.4);
    ctx.fillStyle = '#2b2420';
    blob(ctx, cx - u * 11.8, rim + U * 3, u * 1.6, U * 1.2);
    blob(ctx, cx + u * 11.8, rim + U * 3, u * 1.6, U * 1.2);
    // opening with broth
    ctx.fillStyle = '#1a1310';
    blob(ctx, cx, rim, u * 9.8, U * 2.6);
    ctx.fillStyle = '#a36a2c';
    blob(ctx, cx, rim + U * 0.2, u * 8.6, U * 2);
    ctx.fillStyle = '#c28a3c';
    blob(ctx, cx - u * 2, rim, u * 5.6, U * 1.2);
    ctx.fillStyle = '#4a5a3c';
    blob(ctx, cx - u * 5, rim + U * 0.2, u * 1.8, U * 0.7);
    blob(ctx, cx + u * 1, rim + U * 0.5, u * 1.5, U * 0.6);
    ctx.fillStyle = '#e6dcc0';
    blob(ctx, cx - u * 1.5, rim + U * 0.3, u * 1.5, U * 0.6);
    ctx.fillStyle = '#8a3524';
    blob(ctx, cx - u * 6.2, rim - U * 0.4, u * 0.9, U * 0.4);
    // lid, tipped open toward the right
    ctx.save();
    ctx.translate(cx + u * 4, rim - U * 0.4);
    ctx.rotate(-0.2);
    ctx.fillStyle = '#2e2420';
    blob(ctx, 0, 0, u * 10, U * 2.4);
    ctx.fillStyle = '#5a4034';
    ctx.beginPath();
    ctx.ellipse(0, 0, u * 10, U * 5.6, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = '#7a5646';
    ctx.beginPath();
    ctx.ellipse(-u * 2, -U * 0.6, u * 7, U * 3.8, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = '#2e2420';
    ctx.fillRect(-u * 1, -U * 6.8, u * 2, U * 1.6);
    blob(ctx, 0, -U * 7, u * 1.8, U * 0.8);
    ctx.restore();
  }

  function paintTableware(ctx, g) {
    const { cx, ty, u, U } = g;
    bowl(ctx, g, cx - u * 19, ty + U * 2, '#243058', '#d6cdb4', '#a36a2c');
    chopsticks(ctx, g, cx - u * 15, ty + U * 3.6);
    bowl(ctx, g, cx + u * 18, ty + U * 2.6, '#d6cdb4', '#8a3524', '#c28a3c');
    tokkuri(ctx, g, cx + u * 23, ty - U * 1);
    ochoko(ctx, g, cx + u * 12, ty + U * 4);
    tofuPlate(ctx, g, cx - u * 6, ty + U * 4.6);
  }

  // ---- lamp ----------------------------------------------------------------

  function paintLamp(ctx, g) {
    const { cx, u, U } = g;
    const y = g.lampY;
    ctx.strokeStyle = '#14100c';
    ctx.lineWidth = Math.max(1, u * 0.35);
    ctx.beginPath();
    ctx.moveTo(cx, U * 6);
    ctx.lineTo(cx, y - U * 8.4);
    ctx.stroke();
    ctx.fillStyle = '#14100c';
    ctx.fillRect(cx - u * 3, y - U * 8.6, u * 6, U * 1.4);
    ctx.fillStyle = '#c99a42';
    blob(ctx, cx, y, u * 7.4, U * 7.6);
    ctx.fillStyle = '#e8c36a';
    blob(ctx, cx - u * 0.4, y - U * 0.2, u * 6.6, U * 6.8);
    ctx.fillStyle = '#f2dc9a';
    blob(ctx, cx - u * 1, y - U * 0.8, u * 4.6, U * 4.6);
    ctx.strokeStyle = '#a77c32';
    ctx.lineWidth = Math.max(1, u * 0.25);
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(cx, y, Math.abs(i) * u * 2.4 + 0.5, U * 7.6, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = '#14100c';
    ctx.fillRect(cx - u * 3.4, y + U * 6.8, u * 6.8, U * 1.1);
    ctx.fillStyle = '#8a3524';
    ctx.fillRect(cx - 1, y + U * 7.9, 2, U * 2.4);
  }

  function paintGlow(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const gr = ctx.createRadialGradient(g.cx, g.lampY, g.U, g.cx, g.lampY, g.u * 62);
    gr.addColorStop(0, 'rgba(232,190,100,0.5)');
    gr.addColorStop(0.5, 'rgba(180,120,60,0.2)');
    gr.addColorStop(1, 'rgba(120,70,40,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, g.W, g.H);
    const pot = ctx.createRadialGradient(g.cx, g.ty - g.U * 8, g.U, g.cx, g.ty - g.U * 8, g.u * 28);
    pot.addColorStop(0, 'rgba(200,130,50,0.3)');
    pot.addColorStop(1, 'rgba(120,70,30,0)');
    ctx.fillStyle = pot;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  function paintVignette(ctx, g) {
    const gr = ctx.createRadialGradient(g.cx, g.H * 0.5, g.H * 0.3, g.cx, g.H * 0.5, g.W * 0.65);
    gr.addColorStop(0, 'rgba(8,6,10,0)');
    gr.addColorStop(1, 'rgba(8,6,10,0.55)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, g.W, g.H);
  }

  function paintBase(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintWall(ctx, g, rand);
    paintOutside(ctx, g);
    paintScroll(ctx, g);
    paintFloor(ctx, g);
    zabuton(ctx, g, g.cx - g.u * 46, g.H * 0.86);
    zabuton(ctx, g, g.cx + g.u * 46, g.H * 0.86);
    paintTable(ctx, g);
    paintPot(ctx, g);
    paintTableware(ctx, g);
    paintLamp(ctx, g);
    paintVignette(ctx, g);
    return c;
  }

  // ---- motion --------------------------------------------------------------

  function makeFlakes(g, rand) {
    const f = () => new Float32Array(FLAKES);
    const s = { x: f(), y: f(), v: f(), p: f(), r: f() };
    for (let i = 0; i < FLAKES; i++) {
      s.x[i] = rand() * g.win.w;
      s.y[i] = rand() * g.win.open;
      s.v[i] = g.U * (2.2 + rand() * 2.2);
      s.p[i] = rand() * TAU;
      s.r[i] = rand() < 0.3 ? 2 : 1;
    }
    return s;
  }

  function drawSnow(ctx, g, t, amount) {
    const s = state.flakes;
    const w = g.win;
    const n = Math.min(FLAKES, Math.round(FLAKES * 0.5 * amount));
    ctx.fillStyle = '#e8ecf2';
    for (let i = 0; i < n; i++) {
      const y = (s.y[i] + s.v[i] * t) % w.open;
      const x = (s.x[i] + Math.sin(t * 0.8 + s.p[i]) * g.u * 1.6 + t * g.u * 0.6 + w.w * 4) % w.w;
      ctx.globalAlpha = s.r[i] > 1 ? 0.95 : 0.7;
      ctx.fillRect(w.x + x, w.y + y, s.r[i], s.r[i]);
    }
    ctx.globalAlpha = 1;
  }

  function drawBubbles(ctx, g, t) {
    const rim = g.ty - g.U * 12;
    for (let i = 0; i < BUBBLES; i++) {
      const a = Math.sin(t * (1.6 + i * 0.37) + i * 2.1);
      if (a < 0.2) continue;
      const x = g.cx - g.u * 7 + ((i * 2.7) % 8) * g.u * 0.9;
      const y = rim + g.U * (0.3 + 0.4 * Math.sin(i * 3.3));
      ctx.globalAlpha = a * 0.7;
      ctx.fillStyle = '#f0d9a0';
      ctx.fillRect(x, y, Math.max(1, g.u * 0.5 * a), 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawSteam(ctx, g, t, amount) {
    if (amount <= 0) return;
    const rim = g.ty - g.U * 13;
    const rise = g.U * 36;
    ctx.fillStyle = '#e4dfcf';
    for (let i = 0; i < PUFFS; i++) {
      const age = (t * 0.1 + i / PUFFS) % 1;
      const src = i % 2 ? -g.u * 3 : g.u * 6;
      const x = g.cx + src + Math.sin(age * 5 + i * 1.7) * g.u * (1.5 + age * 4) + age * age * g.u * 5;
      const y = rim - age * rise;
      const r = g.u * (1.8 + age * 5);
      ctx.globalAlpha = Math.sin(age * Math.PI) * 0.34 * Math.min(1, amount);
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.7, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.base = paintBase(g, rand);
    state.frame = paintWindowFrame(g);
    state.glow = paintGlow(g);
    state.flakes = makeFlakes(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { snow, steam } = api.props;
    ctx.drawImage(state.base, 0, 0);
    drawSnow(ctx, g, t, snow);
    ctx.drawImage(state.frame.c, g.win.x - state.frame.ox, g.win.y - state.frame.oy);
    drawBubbles(ctx, g, t);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.6 + 0.05 * Math.sin(t * 0.9) + 0.03 * Math.sin(t * 2.3);
    ctx.drawImage(state.glow, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawSteam(ctx, g, t, steam);
  }

  Kasuri.run({
    defaults: { snow: 1, steam: 1, ramp: 'lines', cell: 7, boost: 0.18, gain: 1.1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
