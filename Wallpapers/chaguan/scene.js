/*
 * 茶馆 Chaguan — an old teahouse on a rainy evening, nobody in.
 *
 * The room is baked once: painted beam, lacquered columns, plank wall, an ice-ray lattice
 * window and a round moon window, three tables with clay pots and cups. The courtyard seen
 * through the windows is a second baked layer. Only the rain (clipped to the windows), the
 * puddle rings, the steam, two lanterns, the lamp flame and a soft glow move, all from
 * small reused pools.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;

  const TAU = Math.PI * 2;
  const FLOOR = 0.7;
  const C = {
    ink: '#1c1511',
    wall: '#3a2b21',
    wallDark: '#2a1f18',
    beam: '#7a2f22',
    red: '#8e3024',
    redLit: '#b34a31',
    redDeep: '#5e2118',
    gold: '#cfa550',
    goldDim: '#96783a',
    indigo: '#3e556b',
    indigoLt: '#6d8498',
    moss: '#5b7550',
    mossDk: '#3b5239',
    washi: '#e8dfc6',
    clay: '#8a4c3e',
    clayLt: '#b87a5e',
    wood: '#6b4c34',
    woodLit: '#9a7250',
    floor: '#2b2019',
    stone: '#76796f',
  };
  const RAIN = 110;
  const RINGS = 9;
  const STEAM = 24;
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

  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const fy = Math.round(H * FLOOR);
    const moonR = Math.min(H * 0.185, W * 0.11);
    return {
      W, H, U, fy,
      win: { x0: W * 0.12, y0: H * 0.17, x1: W * 0.46, y1: H * 0.6 },
      moon: { cx: W * 0.73, cy: H * 0.385, r: moonR },
    };
  }

  function windowShape(ctx, g) {
    ctx.beginPath();
    ctx.rect(g.win.x0, g.win.y0, g.win.x1 - g.win.x0, g.win.y1 - g.win.y0);
    ctx.moveTo(g.moon.cx + g.moon.r, g.moon.cy);
    ctx.arc(g.moon.cx, g.moon.cy, g.moon.r, 0, TAU);
  }

  // ---- the courtyard seen through the windows -------------------------------

  function bamboo(ctx, g, x, yb, h, w, rand) {
    const seg = g.U * 7;
    ctx.fillStyle = C.mossDk;
    ctx.fillRect(x - w / 2, yb - h, w, h);
    ctx.fillStyle = C.moss;
    ctx.fillRect(x - w / 2, yb - h, w * 0.4, h);
    ctx.fillStyle = '#7e9468';
    for (let y = yb - seg; y > yb - h; y -= seg) ctx.fillRect(x - w * 0.7, y, w * 1.4, Math.max(1, g.U * 0.45));
    ctx.fillStyle = C.moss;
    for (let k = 0; k < 6; k++) {
      const ly = yb - h + k * seg * 0.8;
      const dir = k % 2 ? 1 : -1;
      for (let b = 0; b < 3; b++) {
        const len = g.U * (7 + rand() * 4);
        const ang = (0.25 + b * 0.3 + rand() * 0.1) * dir;
        poly(ctx, [x, ly, x + Math.cos(ang) * len * dir, ly + Math.sin(Math.abs(ang)) * len * 0.9 + g.U,
          x + Math.cos(ang) * len * dir * 0.7, ly + Math.sin(Math.abs(ang)) * len * 0.5 - g.U * 0.5]);
      }
    }
  }

  function bananaLeaf(ctx, g, x, y, len, ang, wid) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = '#5a7a52';
    poly(ctx, [0, 0, len * 0.3, -wid, len * 0.7, -wid * 0.9, len, 0, len * 0.7, wid * 0.9, len * 0.3, wid]);
    ctx.fillStyle = '#7b9a68';
    poly(ctx, [0, 0, len * 0.3, -wid * 0.9, len * 0.7, -wid * 0.8, len, 0]);
    ctx.strokeStyle = '#3f5c3d';
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len, 0);
    ctx.stroke();
    ctx.restore();
  }

  function pavilion(ctx, g, cx, ey, hw) {
    const U = g.U;
    rect(ctx, cx - hw * 0.8, ey, hw * 1.6, U * 14, '#b7bcb0');
    rect(ctx, cx - hw * 0.78, ey, U * 1.6, U * 14, C.red);
    rect(ctx, cx + hw * 0.78 - U * 1.6, ey, U * 1.6, U * 14, C.red);
    rect(ctx, cx - hw * 0.1, ey, U * 1.4, U * 14, C.red);
    ctx.fillStyle = '#4a5560';
    ctx.beginPath();
    ctx.moveTo(cx - hw, ey - U * 3.5);
    ctx.quadraticCurveTo(cx - hw * 0.5, ey + U * 1.6, cx, ey + U * 1.6);
    ctx.quadraticCurveTo(cx + hw * 0.5, ey + U * 1.6, cx + hw, ey - U * 3.5);
    ctx.quadraticCurveTo(cx + hw * 0.7, ey - U * 3, cx + hw * 0.46, ey - U * 9.5);
    ctx.lineTo(cx - hw * 0.46, ey - U * 9.5);
    ctx.quadraticCurveTo(cx - hw * 0.7, ey - U * 3, cx - hw, ey - U * 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2f3a44';
    ctx.lineWidth = Math.max(1, U * 0.4);
    ctx.beginPath();
    for (let i = 1; i < 5; i++) {
      const yy = ey - U * 9 + i * U * 2.1;
      const inset = hw * (0.46 + i * 0.1);
      ctx.moveTo(cx - inset, yy);
      ctx.lineTo(cx + inset, yy);
    }
    ctx.stroke();
    rect(ctx, cx - hw * 0.47, ey - U * 10.4, hw * 0.94, U * 1.2, '#2f3a44');
    poly(ctx, [cx - hw * 0.5, ey - U * 10.4, cx - hw * 0.56, ey - U * 12.6, cx - hw * 0.42, ey - U * 10.4]);
    poly(ctx, [cx + hw * 0.5, ey - U * 10.4, cx + hw * 0.56, ey - U * 12.6, cx + hw * 0.42, ey - U * 10.4]);
  }

  function paintCourt(g, rand) {
    const cv = layer(g.W, g.H);
    const ctx = cv.getContext('2d');
    const { W, H, U } = g;
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.46);
    sky.addColorStop(0, '#8d9e9a');
    sky.addColorStop(1, '#bcc6bb');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#9db0a6';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.45);
    for (let x = 0; x <= W + 3; x += 3) ctx.lineTo(x, H * 0.34 + fbm(x / (U * 30), 2.2, 3, 7) * H * 0.1);
    ctx.lineTo(W, H * 0.45);
    ctx.fill();
    ctx.fillStyle = '#7f988b';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.45);
    for (let x = 0; x <= W + 3; x += 3) ctx.lineTo(x, H * 0.38 + fbm(x / (U * 24), 5.1, 3, 19) * H * 0.08);
    ctx.lineTo(W, H * 0.45);
    ctx.fill();
    pavilion(ctx, g, W * 0.27, H * 0.31, U * 15);
    ctx.fillStyle = 'rgba(205,214,205,0.5)';
    ctx.fillRect(0, H * 0.3, W, H * 0.16);
    rect(ctx, 0, H * 0.45, W, H * 0.07, '#d5d2c0');
    rect(ctx, 0, H * 0.44, W, U * 1.6, '#39434c');
    rect(ctx, 0, H * 0.45 + U * 1.6, W, Math.max(1, U * 0.4), '#a9ab9d');
    ctx.fillStyle = '#6f7f78';
    ctx.fillRect(0, H * 0.52, W, H * 0.12);
    ctx.fillStyle = '#85938a';
    for (let y = H * 0.52; y < H * 0.62; y += U * 3) {
      for (let x = ((y / U) % 2) * U * 4; x < W; x += U * 8) ctx.fillRect(x, y, U * 7.2, U * 2.5);
    }
    bamboo(ctx, g, W * 0.425, H * 0.56, H * 0.5, U * 1.8, rand);
    bamboo(ctx, g, W * 0.455, H * 0.58, H * 0.42, U * 1.5, rand);
    bamboo(ctx, g, W * 0.795, H * 0.6, H * 0.4, U * 1.7, rand);
    const mx = g.moon.cx - g.moon.r * 0.5;
    const my = H * 0.6;
    for (let i = 0; i < 5; i++) {
      bananaLeaf(ctx, g, mx + (i - 2) * U * 1.5, my, U * (16 + (i % 3) * 3), -1.5 + i * 0.5 - (i > 2 ? 0.1 : 0), U * 3.4);
    }
    ctx.fillStyle = '#5d6560';
    blob(ctx, g.moon.cx + g.moon.r * 0.55, H * 0.57, U * 6, U * 5);
    ctx.fillStyle = '#7b837b';
    blob(ctx, g.moon.cx + g.moon.r * 0.5, H * 0.555, U * 3.6, U * 2.6);
    ctx.fillStyle = '#3e4540';
    blob(ctx, g.moon.cx + g.moon.r * 0.6, H * 0.57, U * 1, U * 1.6);
    ctx.fillStyle = 'rgba(160,176,168,0.28)';
    ctx.fillRect(0, 0, W, H * 0.62);
    return cv;
  }

  // ---- room: wall, windows, beam, columns -----------------------------------

  function paintWall(ctx, g, rand) {
    const { W, U, fy } = g;
    const plank = U * 5.5;
    for (let x = 0, i = 0; x < W; x += plank, i++) {
      const v = fbm(i * 0.7, 3.3, 2, 5);
      ctx.fillStyle = v > 0.5 ? '#3d2d23' : '#352820';
      ctx.fillRect(x, 0, plank, fy);
      ctx.fillStyle = C.wallDark;
      ctx.fillRect(x, 0, Math.max(1, U * 0.3), fy);
    }
    const py = g.H * 0.6;
    rect(ctx, 0, py, W, fy - py, '#45331f');
    rect(ctx, 0, py, W, U * 1.2, C.wood);
    rect(ctx, 0, py + U * 1.2, W, Math.max(1, U * 0.4), C.goldDim);
    for (let x = U * 3; x < W - U * 6; x += U * 14) {
      rect(ctx, x, py + U * 3, U * 11, fy - py - U * 5, '#3a2a1c');
      ctx.strokeStyle = C.goldDim;
      ctx.lineWidth = Math.max(1, U * 0.35);
      ctx.strokeRect(x + U * 1.2, py + U * 4.2, U * 8.6, fy - py - U * 7.4);
      ctx.beginPath();
      ctx.arc(x + U * 5.5, py + (fy - py) / 2, U * 1.7, 0, TAU);
      ctx.stroke();
    }
    rect(ctx, 0, fy - U * 1.4, W, U * 1.4, C.ink);
  }

  function paintFloor(ctx, g, rand) {
    const { W, H, U, fy } = g;
    for (let y = fy, i = 0; y < H; i++) {
      const hgt = U * (2.2 + (y - fy) / H * 7);
      ctx.fillStyle = i % 2 ? '#2d221a' : '#261c15';
      ctx.fillRect(0, y, W, hgt);
      ctx.fillStyle = '#18110d';
      ctx.fillRect(0, y, W, Math.max(1, U * 0.3));
      const jw = U * (10 + (y - fy) / H * 18);
      for (let x = (i * 0.37 % 1) * jw; x < W; x += jw) ctx.fillRect(x, y, Math.max(1, U * 0.3), hgt);
      y += hgt;
    }
  }

  function iceRay(ctx, g, r) {
    const s = g.U * 7.4;
    const cols = Math.ceil((r.x1 - r.x0) / s) + 1;
    const rows = Math.ceil((r.y1 - r.y0) / s) + 1;
    const rand = K.rng(41);
    const px = [];
    const py = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const edge = i === 0 || j === 0 || i === cols - 1 || j === rows - 1;
        px.push(r.x0 + i * s + (edge ? 0 : (rand() - 0.5) * s * 0.7));
        py.push(r.y0 + j * s + (edge ? 0 : (rand() - 0.5) * s * 0.7));
      }
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    ctx.clip();
    ctx.strokeStyle = '#2c2018';
    ctx.lineWidth = Math.max(1, g.U * 0.42);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = j * cols + i;
        if (i < cols - 1 && rand() > 0.12) {
          ctx.moveTo(px[a], py[a]);
          ctx.lineTo(px[a + 1], py[a + 1]);
        }
        if (j < rows - 1 && rand() > 0.12) {
          ctx.moveTo(px[a], py[a]);
          ctx.lineTo(px[a + cols], py[a + cols]);
        }
        if (i < cols - 1 && j < rows - 1 && rand() > 0.82) {
          ctx.moveTo(px[a], py[a]);
          ctx.lineTo(px[a + cols + 1], py[a + cols + 1]);
        }
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  function moonLattice(ctx, g, m) {
    const U = g.U;
    ctx.save();
    ctx.beginPath();
    ctx.arc(m.cx, m.cy, m.r, 0, TAU);
    ctx.clip();
    ctx.strokeStyle = '#2c2018';
    ctx.lineWidth = Math.max(1.2, U * 0.75);
    ctx.beginPath();
    ctx.arc(m.cx, m.cy, m.r * 0.62, 0, TAU);
    ctx.moveTo(m.cx + m.r * 0.2, m.cy);
    ctx.arc(m.cx, m.cy, m.r * 0.2, 0, TAU);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      ctx.moveTo(m.cx + Math.cos(a) * m.r * 0.2, m.cy + Math.sin(a) * m.r * 0.2);
      ctx.lineTo(m.cx + Math.cos(a) * m.r, m.cy + Math.sin(a) * m.r);
    }
    ctx.stroke();
    ctx.fillStyle = '#2c2018';
    for (let k = 0; k < 12; k++) {
      const a = ((k + 0.5) / 12) * TAU;
      blob(ctx, m.cx + Math.cos(a) * m.r * 0.8, m.cy + Math.sin(a) * m.r * 0.8, U * 1.6, U * 1.6);
    }
    ctx.restore();
  }

  function cutWindows(ctx, g) {
    const w = g.win;
    const m = g.moon;
    const U = g.U;
    ctx.fillStyle = C.wood;
    ctx.fillRect(w.x0 - U * 2.4, w.y0 - U * 2.4, w.x1 - w.x0 + U * 4.8, w.y1 - w.y0 + U * 4.8);
    ctx.fillStyle = C.goldDim;
    ctx.fillRect(w.x0 - U * 0.9, w.y0 - U * 0.9, w.x1 - w.x0 + U * 1.8, w.y1 - w.y0 + U * 1.8);
    ctx.fillStyle = C.wood;
    blob(ctx, m.cx, m.cy, m.r + U * 2.6, m.r + U * 2.6);
    ctx.fillStyle = C.goldDim;
    blob(ctx, m.cx, m.cy, m.r + U * 0.9, m.r + U * 0.9);
    ctx.globalCompositeOperation = 'destination-out';
    windowShape(ctx, g);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    iceRay(ctx, g, w);
    moonLattice(ctx, g, m);
    ctx.fillStyle = C.wallDark;
    ctx.fillRect(w.x0 - U * 3.2, w.y1 + U * 2.4, w.x1 - w.x0 + U * 6.4, U * 1.6);
  }

  function paintBeam(ctx, g) {
    const { W, U } = g;
    const y0 = g.H * 0.05;
    const bh = g.H * 0.11;
    rect(ctx, 0, 0, W, y0, C.ink);
    rect(ctx, 0, y0, W, bh, C.redDeep);
    rect(ctx, 0, y0 + bh - U * 1.2, W, U * 1.2, C.ink);
    const unit = bh * 1.5;
    for (let x = U * 2, i = 0; x < W; x += unit, i++) {
      ctx.fillStyle = C.indigo;
      ctx.fillRect(x, y0 + U * 1.6, unit * 0.62, bh - U * 4);
      ctx.fillStyle = C.moss;
      ctx.fillRect(x + unit * 0.62, y0 + U * 1.6, unit * 0.3, bh - U * 4);
      ctx.fillStyle = C.gold;
      blob(ctx, x + unit * 0.31, y0 + bh / 2, U * 1.7, U * 1.7);
      ctx.fillStyle = C.indigoLt;
      blob(ctx, x + unit * 0.31, y0 + bh / 2, U * 0.7, U * 0.7);
      ctx.fillStyle = C.gold;
      ctx.fillRect(x + unit * 0.62, y0 + U * 1.6, Math.max(1, U * 0.4), bh - U * 4);
      ctx.fillRect(x, y0 + U * 1.6, unit * 0.62, Math.max(1, U * 0.4));
    }
  }

  function bracket(ctx, g, cx, y) {
    const U = g.U;
    for (let k = 0; k < 3; k++) {
      const w = U * (6 + k * 3.5);
      rect(ctx, cx - w / 2, y + k * U * 2.4, w, U * 2.1, k === 1 ? C.wood : C.redDeep);
      rect(ctx, cx - w / 2, y + k * U * 2.4, w, Math.max(1, U * 0.35), C.gold);
    }
  }

  function paintColumn(ctx, g, cx) {
    const { U, fy, H } = g;
    const w = U * 6;
    const top = H * 0.16;
    rect(ctx, cx - w / 2, top, w, H - top, C.red);
    rect(ctx, cx - w / 2, top, w * 0.3, H - top, C.redLit);
    rect(ctx, cx + w * 0.3, top, w * 0.2, H - top, C.redDeep);
    rect(ctx, cx - w / 2 - U * 0.8, fy - U * 6, w + U * 1.6, U * 8, C.stone);
    rect(ctx, cx - w / 2 - U * 0.8, fy - U * 6, w + U * 1.6, Math.max(1, U * 0.5), '#9a9c90');
    rect(ctx, cx - w / 2 - U * 1.2, top, w + U * 2.4, U * 1.4, C.gold);
    bracket(ctx, g, cx, top + U * 1.6);
  }

  // ---- tables and tea things ------------------------------------------------

  function table(ctx, g, cx, topY, w, depth) {
    const U = g.U;
    const fl = g.H * 1.02;
    const legW = U * 1.8;
    const rear = topY + depth * 0.2;
    ctx.fillStyle = '#2d2018';
    ctx.fillRect(cx - w * 0.4, rear, legW * 0.8, (fl - topY) * 0.9);
    ctx.fillRect(cx + w * 0.4 - legW * 0.8, rear, legW * 0.8, (fl - topY) * 0.9);
    ctx.fillStyle = C.wood;
    ctx.fillRect(cx - w / 2 + U * 0.8, topY + depth, legW, fl - topY - depth);
    ctx.fillRect(cx + w / 2 - U * 0.8 - legW, topY + depth, legW, fl - topY - depth);
    ctx.fillStyle = '#4a3424';
    ctx.fillRect(cx - w / 2 + U * 0.8 + legW, fl - (fl - topY) * 0.28, w - U * 1.6 - legW * 2, U * 1.2);
    poly(ctx, [cx - w * 0.43, topY, cx + w * 0.43, topY, cx + w / 2, topY + depth, cx - w / 2, topY + depth]);
    ctx.fillStyle = C.woodLit;
    poly(ctx, [cx - w * 0.43, topY, cx + w * 0.43, topY, cx + w / 2, topY + depth, cx - w / 2, topY + depth]);
    ctx.strokeStyle = 'rgba(40,26,18,0.5)';
    ctx.lineWidth = Math.max(1, U * 0.3);
    ctx.beginPath();
    for (let i = 1; i < 5; i++) {
      const f = i / 5;
      ctx.moveTo(lerp(cx - w * 0.43, cx - w / 2, f) + w * 0.02, topY + depth * f);
      ctx.lineTo(lerp(cx + w * 0.43, cx + w / 2, f) - w * 0.02, topY + depth * f);
    }
    ctx.stroke();
    rect(ctx, cx - w / 2, topY + depth, w, U * 2.4, '#3f2c1e');
    rect(ctx, cx - w / 2, topY + depth, w, Math.max(1, U * 0.4), C.goldDim);
    rect(ctx, cx - w / 2, topY + depth + U * 2.4, w, Math.max(1, U * 0.3), C.ink);
  }

  function stool(ctx, g, cx, topY, w) {
    const U = g.U;
    const fl = g.H * 1.02;
    ctx.fillStyle = '#3a291c';
    ctx.fillRect(cx - w / 2 + U * 0.8, topY, U * 1.6, fl - topY);
    ctx.fillRect(cx + w / 2 - U * 0.8 - U * 1.6, topY, U * 1.6, fl - topY);
    rect(ctx, cx - w / 2, topY, w, U * 2, C.wood);
    rect(ctx, cx - w / 2, topY, w, Math.max(1, U * 0.5), C.woodLit);
  }

  function teapot(ctx, x, y, s, dir) {
    ctx.fillStyle = C.clay;
    ctx.strokeStyle = C.clay;
    ctx.lineCap = 'round';
    ctx.lineWidth = s * 1.1;
    ctx.beginPath();
    ctx.moveTo(x + dir * 3.8 * s, y - 3.2 * s);
    ctx.quadraticCurveTo(x + dir * 7 * s, y - 3 * s, x + dir * 7.6 * s, y - 6.2 * s);
    ctx.stroke();
    ctx.lineWidth = s * 0.9;
    ctx.beginPath();
    ctx.arc(x - dir * 5 * s, y - 3.6 * s, 1.9 * s, 0, TAU);
    ctx.stroke();
    blob(ctx, x, y - 3.1 * s, 4.7 * s, 3.1 * s);
    ctx.fillStyle = C.clayLt;
    blob(ctx, x - dir * 1.4 * s, y - 4.1 * s, 2.4 * s, 1.4 * s);
    ctx.fillStyle = C.clay;
    blob(ctx, x, y - 6 * s, 2.5 * s, 0.9 * s);
    ctx.fillStyle = C.clayLt;
    blob(ctx, x, y - 7.2 * s, 0.9 * s, 0.9 * s);
    ctx.fillStyle = C.gold;
    ctx.fillRect(x - 4.1 * s, y - 3.4 * s, 8.2 * s, Math.max(1, s * 0.3));
  }

  function cup(ctx, x, y, s) {
    ctx.fillStyle = C.washi;
    ctx.beginPath();
    ctx.ellipse(x, y - 1.2 * s, 1.9 * s, 1.2 * s, 0, 0, Math.PI);
    ctx.lineTo(x - 1.9 * s, y - 1.8 * s);
    ctx.lineTo(x + 1.9 * s, y - 1.8 * s);
    ctx.fill();
    ctx.fillStyle = C.indigo;
    ctx.fillRect(x - 1.9 * s, y - 1.9 * s, 3.8 * s, Math.max(1, s * 0.35));
    ctx.fillStyle = '#9b7f45';
    blob(ctx, x, y - 1.8 * s, 1.7 * s, 0.4 * s);
  }

  function gaiwan(ctx, x, y, s) {
    ctx.fillStyle = C.washi;
    blob(ctx, x, y - 0.5 * s, 3.2 * s, 0.6 * s);
    ctx.beginPath();
    ctx.ellipse(x, y - 2.4 * s, 2.7 * s, 2 * s, 0, 0, Math.PI);
    ctx.lineTo(x - 2.7 * s, y - 3.2 * s);
    ctx.lineTo(x + 2.7 * s, y - 3.2 * s);
    ctx.fill();
    ctx.fillStyle = C.indigo;
    ctx.fillRect(x - 2.7 * s, y - 3.4 * s, 5.4 * s, Math.max(1, s * 0.45));
    ctx.fillStyle = C.washi;
    blob(ctx, x, y - 3.9 * s, 2.5 * s, 0.9 * s);
    ctx.fillStyle = C.indigo;
    blob(ctx, x, y - 4.4 * s, 0.6 * s, 0.5 * s);
  }

  function jar(ctx, x, y, s) {
    ctx.fillStyle = C.washi;
    ctx.beginPath();
    ctx.ellipse(x, y - 4.2 * s, 3.4 * s, 4.2 * s, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(x - 1.6 * s, y - 9.2 * s, 3.2 * s, 1.6 * s);
    ctx.fillStyle = C.indigo;
    ctx.fillRect(x - 3.2 * s, y - 6.4 * s, 6.4 * s, Math.max(1, s * 0.5));
    ctx.fillRect(x - 3.2 * s, y - 2 * s, 6.4 * s, Math.max(1, s * 0.5));
    blob(ctx, x, y - 4.2 * s, 1.3 * s, 1.1 * s);
    blob(ctx, x - 2 * s, y - 4.2 * s, 0.6 * s, 0.9 * s);
    blob(ctx, x + 2 * s, y - 4.2 * s, 0.6 * s, 0.9 * s);
    ctx.fillStyle = C.red;
    ctx.fillRect(x - 1.9 * s, y - 10.3 * s, 3.8 * s, 1.2 * s);
  }

  function tray(ctx, x, y, w, s) {
    rect(ctx, x - w / 2, y - s * 0.8, w, s * 1.3, '#2b1d14');
    rect(ctx, x - w / 2, y - s * 0.8, w, Math.max(1, s * 0.3), C.goldDim);
  }

  function lampBase(ctx, x, y, s) {
    ctx.fillStyle = C.goldDim;
    blob(ctx, x, y - 0.8 * s, 2.8 * s, 0.8 * s);
    ctx.fillRect(x - 0.5 * s, y - 4 * s, s, 3.2 * s);
    blob(ctx, x, y - 4.4 * s, 2 * s, 0.9 * s);
    ctx.fillStyle = C.ink;
    ctx.fillRect(x - 0.12 * s, y - 5.6 * s, 0.24 * s, 1.2 * s);
  }

  function paintTables(ctx, g, emit) {
    const U = g.U;
    const H = g.H;
    const W = g.W;
    table(ctx, g, W * 0.49, H * 0.735, U * 26, U * 4.5);
    tray(ctx, W * 0.49, H * 0.735 + U * 2.8, U * 9, U);
    gaiwan(ctx, W * 0.49 - U * 3, H * 0.735 + U * 3, U * 0.85);
    cup(ctx, W * 0.49 + U * 2.2, H * 0.735 + U * 3, U * 0.85);

    const ax = W * 0.27;
    const ay = H * 0.775;
    stool(ctx, g, ax - U * 25, H * 0.85, U * 10);
    stool(ctx, g, ax + U * 25, H * 0.85, U * 10);
    table(ctx, g, ax, ay, U * 34, U * 5.5);
    jar(ctx, ax - U * 11, ay + U * 2, U * 1.05);
    tray(ctx, ax + U * 2, ay + U * 3.6, U * 13, U * 1.1);
    teapot(ctx, ax + U * 1, ay + U * 3.6, U * 1.15, 1);
    cup(ctx, ax - U * 4.4, ay + U * 4.2, U * 1.05);
    cup(ctx, ax + U * 8.4, ay + U * 4.2, U * 1.05);
    emit.push({ x: ax + U * 9.7, y: ay + U * 3.6 - U * 7.6 * 1.15 + U * 0.8 });
    emit.push({ x: ax + U * 8.4, y: ay + U * 4.2 - U * 2 });

    const bx = W * 0.71;
    const by = H * 0.805;
    stool(ctx, g, bx - U * 31, H * 0.9, U * 12);
    table(ctx, g, bx, by, U * 44, U * 6.5);
    tray(ctx, bx - U * 3, by + U * 4.3, U * 17, U * 1.4);
    teapot(ctx, bx - U * 3, by + U * 4.3, U * 1.45, -1);
    cup(ctx, bx + U * 3.2, by + U * 4.9, U * 1.3);
    cup(ctx, bx + U * 7.2, by + U * 4.9, U * 1.3);
    gaiwan(ctx, bx + U * 14, by + U * 4.2, U * 1.2);
    lampBase(ctx, bx - U * 15, by + U * 3.4, U * 1.4);
    emit.push({ x: bx - U * 3 - U * 7.6 * 1.45, y: by + U * 4.3 - U * 6.2 * 1.45 - U * 0.6 });
    emit.push({ x: bx + U * 3.2, y: by + U * 4.9 - U * 2.2 });
    emit.push({ x: bx + U * 14, y: by + U * 4.2 - U * 4.6 });
    return { x: bx - U * 15, y: by + U * 3.4 - U * 5.9 * 1.4 };
  }

  // ---- lanterns and glow ----------------------------------------------------

  function paintLantern(g, scale) {
    const U = g.U * scale;
    const w = U * 12;
    const h = U * 30;
    const cv = layer(w + U * 4, h);
    const ctx = cv.getContext('2d');
    const cx = cv.width / 2;
    ctx.strokeStyle = C.goldDim;
    ctx.lineWidth = Math.max(1, U * 0.4);
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, U * 5);
    ctx.stroke();
    poly(ctx, [cx - w * 0.3, U * 5, cx + w * 0.3, U * 5, cx + w * 0.5, U * 8, cx - w * 0.5, U * 8]);
    ctx.fillStyle = C.ink;
    ctx.fillRect(cx - w * 0.3, U * 5, w * 0.6, U * 3);
    rect(ctx, cx - w * 0.5, U * 7.6, w, U * 1.2, C.gold);
    rect(ctx, cx - w / 2, U * 8.8, w, U * 13, C.red);
    rect(ctx, cx - w / 2, U * 8.8, w * 0.2, U * 13, C.redDeep);
    rect(ctx, cx + w * 0.3, U * 8.8, w * 0.2, U * 13, C.redDeep);
    const grad = ctx.createRadialGradient(cx, U * 15.3, 0, cx, U * 15.3, w * 0.55);
    grad.addColorStop(0, '#f0c070');
    grad.addColorStop(1, '#c4642e');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - w * 0.3, U * 10, w * 0.6, U * 10.6);
    ctx.fillStyle = C.gold;
    ctx.fillRect(cx - w * 0.3, U * 10, Math.max(1, U * 0.4), U * 10.6);
    ctx.fillRect(cx + w * 0.3 - Math.max(1, U * 0.4), U * 10, Math.max(1, U * 0.4), U * 10.6);
    rect(ctx, cx - w * 0.5, U * 21.6, w, U * 1.2, C.gold);
    rect(ctx, cx - w * 0.3, U * 22.8, w * 0.6, U * 2, C.ink);
    ctx.fillStyle = C.gold;
    blob(ctx, cx, U * 25.8, U * 1.4, U * 1.4);
    ctx.strokeStyle = C.redLit;
    ctx.lineWidth = Math.max(1, U * 0.45);
    ctx.beginPath();
    for (let k = -2; k <= 2; k++) {
      ctx.moveTo(cx + k * U * 0.5, U * 26.5);
      ctx.lineTo(cx + k * U * 0.9, U * 30);
    }
    ctx.stroke();
    return cv;
  }

  function glowSpot(ctx, x, y, rx, ry, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, 'rgba(238,168,86,' + alpha + ')');
    gr.addColorStop(0.5, 'rgba(214,128,62,' + alpha * 0.4 + ')');
    gr.addColorStop(1, 'rgba(190,100,50,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }

  function paintGlow(g, lamp) {
    const cv = layer(g.W, g.H);
    const ctx = cv.getContext('2d');
    const { W, H, U } = g;
    state.lanterns.forEach(function (l) {
      glowSpot(ctx, l.x, l.y + l.size * 15, H * 0.4 * l.scale, H * 0.34 * l.scale, 0.5);
    });
    glowSpot(ctx, lamp.x, lamp.y, H * 0.22, H * 0.18, 0.55);
    glowSpot(ctx, W * 0.71, H * 0.84, U * 38, U * 10, 0.5);
    glowSpot(ctx, W * 0.27, H * 0.81, U * 32, U * 8, 0.4);
    glowSpot(ctx, W * 0.49, H * 0.76, U * 22, U * 6, 0.35);
    return cv;
  }

  // ---- pools ---------------------------------------------------------------

  function makeRain() {
    return { x: new Float32Array(RAIN), y: new Float32Array(RAIN), v: new Float32Array(RAIN), l: new Float32Array(RAIN) };
  }

  function resetDrop(g, d, i, scatter) {
    const r = state.rand;
    d.x[i] = r() * (g.W + g.H * 0.2);
    d.y[i] = scatter ? r() * g.H * 0.65 : -r() * g.H * 0.1;
    d.v[i] = g.H * (0.8 + r() * 0.5);
    d.l[i] = g.U * (2.5 + r() * 3);
  }

  function makeRings() {
    return { x: new Float32Array(RINGS), y: new Float32Array(RINGS), age: new Float32Array(RINGS), life: new Float32Array(RINGS) };
  }

  function resetRing(g, rg, i, scatter) {
    const r = state.rand;
    const inMoon = r() < 0.4;
    rg.x[i] = inMoon ? g.moon.cx + (r() - 0.5) * g.moon.r * 1.2 : g.win.x0 + r() * (g.win.x1 - g.win.x0);
    rg.y[i] = g.H * (0.54 + r() * 0.055);
    rg.life[i] = 1 + r() * 0.8;
    rg.age[i] = scatter ? r() * rg.life[i] : 0;
  }

  function makeSteam() {
    return { x: new Float32Array(STEAM), y: new Float32Array(STEAM), age: new Float32Array(STEAM),
      life: new Float32Array(STEAM), ph: new Float32Array(STEAM), e: new Uint8Array(STEAM) };
  }

  function resetSteam(g, s, i, scatter) {
    const r = state.rand;
    const em = state.emit[i % state.emit.length];
    s.e[i] = i % state.emit.length;
    s.x[i] = em.x;
    s.y[i] = em.y;
    s.life[i] = 3 + r() * 2;
    s.age[i] = scatter ? r() * s.life[i] : 0;
    s.ph[i] = r() * TAU;
  }

  // ---- frame ---------------------------------------------------------------

  function drawRain(ctx, g, dt, rain) {
    const d = state.rain;
    const count = Math.min(RAIN, Math.round(RAIN * 0.8 * rain));
    const slant = 0.16;
    ctx.save();
    windowShape(ctx, g);
    ctx.clip();
    ctx.strokeStyle = 'rgba(226,234,226,0.62)';
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      d.y[i] += d.v[i] * dt;
      d.x[i] -= d.v[i] * slant * dt;
      if (d.y[i] > g.H * 0.64 || d.x[i] < 0) resetDrop(g, d, i, false);
      ctx.moveTo(d.x[i], d.y[i]);
      ctx.lineTo(d.x[i] + d.l[i] * slant, d.y[i] - d.l[i]);
    }
    ctx.stroke();
    const rg = state.rings;
    ctx.strokeStyle = 'rgba(214,224,216,0.5)';
    ctx.beginPath();
    for (let i = 0; i < RINGS; i++) {
      rg.age[i] += dt;
      if (rg.age[i] > rg.life[i]) resetRing(g, rg, i, false);
      const f = rg.age[i] / rg.life[i];
      const rx = g.U * (0.6 + f * 3.4) * (rain > 0.05 ? 1 : 0);
      ctx.moveTo(rg.x[i] + rx, rg.y[i]);
      ctx.ellipse(rg.x[i], rg.y[i], rx, rx * 0.32, 0, 0, TAU);
    }
    ctx.globalAlpha = Math.min(1, rain);
    ctx.stroke();
    ctx.restore();
  }

  function drawSteam(ctx, g, dt, amount) {
    const s = state.steam;
    const count = Math.min(STEAM, Math.round(STEAM * 0.8 * amount));
    ctx.fillStyle = 'rgb(236,228,210)';
    for (let i = 0; i < count; i++) {
      s.age[i] += dt;
      if (s.age[i] > s.life[i]) resetSteam(g, s, i, false);
      const f = s.age[i] / s.life[i];
      const em = state.emit[s.e[i]];
      const x = em.x + Math.sin(s.ph[i] + f * 5) * g.U * (1 + f * 2.2) + f * g.U * 2;
      const y = em.y - f * g.H * 0.17;
      ctx.globalAlpha = 0.5 * Math.sin(f * Math.PI) * Math.min(1, amount);
      ctx.beginPath();
      ctx.ellipse(x, y, g.U * (0.7 + f * 1.6), g.U * (0.9 + f * 2.2), 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawLanterns(ctx, t) {
    for (let i = 0; i < state.lanterns.length; i++) {
      const l = state.lanterns[i];
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(Math.sin(t * 0.55 + l.ph) * 0.03);
      ctx.drawImage(l.sprite, -l.sprite.width / 2, 0);
      ctx.restore();
    }
  }

  function drawFlame(ctx, g, t, lamp) {
    const f = state.flame;
    const flick = 1 + Math.sin(t * 7.1) * 0.12 + Math.sin(t * 11.3 + 1) * 0.08;
    ctx.fillStyle = 'rgb(232,170,84)';
    blob(ctx, f.x + Math.sin(t * 3.3) * g.U * 0.12, f.y - g.U * 0.5, g.U * 0.7 * (0.6 + 0.4 * Math.min(1, lamp)), g.U * 1.5 * flick);
    ctx.fillStyle = 'rgb(246,222,150)';
    blob(ctx, f.x, f.y - g.U * 0.2, g.U * 0.32, g.U * 0.7 * flick);
  }

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.rand = K.rng(api.seed);
    const rand = state.rand;
    state.court = paintCourt(g, rand);
    const room = layer(g.W, g.H);
    const rc = room.getContext('2d');
    paintWall(rc, g, rand);
    paintFloor(rc, g, rand);
    cutWindows(rc, g);
    paintBeam(rc, g);
    paintColumn(rc, g, g.W * 0.04);
    paintColumn(rc, g, g.W * 0.96);
    bracket(rc, g, g.W * 0.29, g.H * 0.15);
    bracket(rc, g, g.W * 0.73, g.H * 0.15);
    state.emit = [];
    state.flame = paintTables(rc, g, state.emit);
    state.room = room;
    const big = paintLantern(g, 1);
    const small = paintLantern(g, 0.78);
    const top = g.H * 0.155;
    state.lanterns = [
      { x: g.W * 0.5, y: top, sprite: big, ph: 0, size: g.U, scale: 1 },
      { x: g.W * 0.895, y: top, sprite: small, ph: 2.1, size: g.U * 0.78, scale: 0.78 },
    ];
    state.glow = paintGlow(g, state.flame);
    state.rain = makeRain();
    state.rings = makeRings();
    state.steam = makeSteam();
    for (let i = 0; i < RAIN; i++) resetDrop(g, state.rain, i, true);
    for (let i = 0; i < RINGS; i++) resetRing(g, state.rings, i, true);
    for (let i = 0; i < STEAM; i++) resetSteam(g, state.steam, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { rain, steam, lamp } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.court, 0, 0);
    drawRain(ctx, g, step, rain);
    ctx.drawImage(state.room, 0, 0);
    drawLanterns(ctx, t);
    const flick = 0.9 + Math.sin(t * 1.3) * 0.06 + Math.sin(t * 2.9 + 1.3) * 0.04;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, flick * lamp * 0.8);
    ctx.drawImage(state.glow, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawFlame(ctx, g, t, lamp);
    drawSteam(ctx, g, step, steam);
  }

  Kasuri.run({
    defaults: { rain: 1, steam: 1, lamp: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
