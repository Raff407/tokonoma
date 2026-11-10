/*
 * 平遥 Pingyao — the old walled town on a snowy night.
 *
 * Sky, hills, tiled roofs, the gate tower and the brick wall with its
 * horse-face bastions are baked once into two layers. Each frame only drifts
 * thin cloud, lets a little snow fall, sways the red lanterns and lifts two
 * threads of chimney smoke.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const WALL_TOP = 0.64;
  const WALL_BOT = 0.87;
  const GATE_X = 0.5;
  const MAX_FLAKES = 150;
  const FLAKES = 80;
  const PUFFS = 7;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * WALL_TOP);
    grad.addColorStop(0, '#0b1230');
    grad.addColorStop(0.6, '#1f2a56');
    grad.addColorStop(1, '#4a4660');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#e8e4d6';
    for (let i = 0; i < g.W * 0.35; i++) {
      ctx.globalAlpha = 0.12 + rand() * 0.4;
      ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
    }
    const mx = g.W * 0.8;
    const my = g.H * 0.15;
    const halo = ctx.createRadialGradient(mx, my, 0, mx, my, g.U * 14);
    halo.addColorStop(0, 'rgba(236,228,200,0.35)');
    halo.addColorStop(1, 'rgba(236,228,200,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = halo;
    ctx.fillRect(mx - g.U * 14, my - g.U * 14, g.U * 28, g.U * 28);
    ctx.fillStyle = '#ece6d0';
    ctx.beginPath();
    ctx.arc(mx, my, g.U * 3, 0, 6.3);
    ctx.fill();
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.014, y * 0.08, 4, 17);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 74;
        img.data[i + 1] = 84;
        img.data[i + 2] = 128;
        img.data[i + 3] = smoothstep(0.5, 0.72, v) * band * 170;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintGlow() {
    const c = layer(48, 48);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
    grad.addColorStop(0, 'rgba(255,170,90,0.55)');
    grad.addColorStop(0.4, 'rgba(230,110,60,0.22)');
    grad.addColorStop(1, 'rgba(200,80,40,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 48, 48);
    return c;
  }

  function paintPuff() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(150,158,184,0.5)');
    grad.addColorStop(1, 'rgba(150,158,184,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  // ---- lantern sprite ----------------------------------------------------

  function paintLantern(u) {
    const w = Math.max(5, Math.round(u * 4));
    const h = Math.max(7, Math.round(u * 6.2));
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const cx = w / 2;
    const bodyTop = h * 0.2;
    const bodyH = h * 0.5;
    ctx.fillStyle = '#c9a247';
    ctx.fillRect(cx - 0.5, 0, 1, bodyTop);
    ctx.fillRect(cx - w * 0.28, bodyTop - 1, w * 0.56, Math.max(1, h * 0.08));
    const body = ctx.createRadialGradient(cx, bodyTop + bodyH / 2, 0, cx, bodyTop + bodyH / 2, w * 0.6);
    body.addColorStop(0, '#f08a4c');
    body.addColorStop(0.55, '#d4412c');
    body.addColorStop(1, '#8e2a20');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(cx, bodyTop + bodyH / 2, w * 0.46, bodyH / 2, 0, 0, 6.3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,30,22,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, bodyTop);
    ctx.lineTo(cx, bodyTop + bodyH);
    ctx.stroke();
    ctx.fillStyle = '#c9a247';
    ctx.fillRect(cx - w * 0.28, bodyTop + bodyH - 1, w * 0.56, Math.max(1, h * 0.08));
    ctx.fillRect(cx - 0.5, bodyTop + bodyH, 1, h * 0.28);
    ctx.fillRect(cx - 1, h - Math.max(1, h * 0.08), 2, Math.max(1, h * 0.08));
    return c;
  }

  // ---- roofs -------------------------------------------------------------

  // A hipped roof seen from the front: sagging eave line, tips curled up.
  function roofPath(ctx, cx, y, w, h) {
    const lift = h * 0.22;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, y - lift);
    ctx.quadraticCurveTo(cx - w * 0.47, y - h * 0.1, cx - w * 0.31, y - h);
    ctx.lineTo(cx + w * 0.31, y - h);
    ctx.quadraticCurveTo(cx + w * 0.47, y - h * 0.1, cx + w / 2, y - lift);
    ctx.quadraticCurveTo(cx, y + h * 0.3, cx - w / 2, y - lift);
    ctx.closePath();
  }

  function roof(ctx, g, cx, y, w, h, col, snow, rand, ends) {
    ctx.fillStyle = col;
    roofPath(ctx, cx, y, w, h);
    ctx.fill();
    ctx.save();
    roofPath(ctx, cx, y, w, h);
    ctx.clip();
    ctx.fillStyle = 'rgba(8,10,24,0.28)';
    for (let x = cx - w / 2; x < cx + w / 2; x += Math.max(2, g.U * 1.1)) ctx.fillRect(x, y - h, 1, h * 1.4);
    ctx.fillStyle = snow;
    const step = Math.max(1, g.U * 0.9);
    for (let x = cx - w / 2; x < cx + w / 2; x += step) {
      ctx.fillRect(x, y - h, step, h * (0.3 + rand() * 0.22));
    }
    ctx.restore();
    ctx.fillStyle = snow;
    ctx.fillRect(cx - w * 0.31, y - h - Math.max(1, g.U * 0.5), w * 0.62, Math.max(1, g.U * 0.7));
    if (ends) {
      ctx.fillStyle = col;
      ctx.fillRect(cx - w * 0.33, y - h - g.U * 1.2, Math.max(1, g.U * 0.9), g.U * 1.4);
      ctx.fillRect(cx + w * 0.33 - g.U * 0.9, y - h - g.U * 1.2, Math.max(1, g.U * 0.9), g.U * 1.4);
    }
  }

  function paintHills(ctx, g) {
    const base = g.H * 0.58;
    ctx.fillStyle = '#2a3258';
    ctx.beginPath();
    ctx.moveTo(0, base);
    for (let x = 0; x <= g.W; x += 2) {
      ctx.lineTo(x, g.H * 0.46 + (fbm(x * 0.012, 3, 4, 7) - 0.5) * g.H * 0.14);
    }
    ctx.lineTo(g.W, base);
    ctx.closePath();
    ctx.fill();
  }

  function paintTown(ctx, g, rand) {
    const U = g.U;
    const wallTop = g.H * WALL_TOP;
    const gx = g.W * GATE_X;
    state.chimneys = [];
    const rows = [
      { y: wallTop - U * 7, h: U * 4, w: [10, 15], col: '#323a5a', snow: '#8b94b6', step: 11 },
      { y: wallTop - U * 1.5, h: U * 5.5, w: [13, 19], col: '#434a64', snow: '#c3cbe0', step: 15 },
    ];
    rows.forEach((row, ri) => {
      let x = -U * 4 + rand() * U * 4;
      while (x < g.W + U * 4) {
        const w = U * (row.w[0] + rand() * (row.w[1] - row.w[0]));
        const cx = x + w / 2;
        x += w * (0.72 + rand() * 0.2);
        if (Math.abs(cx - gx) < U * 22) continue;
        ctx.fillStyle = '#1c2038';
        ctx.fillRect(cx - w * 0.36, row.y - U, w * 0.72, wallTop - row.y + U);
        if (ri === 1 && rand() < 0.4) {
          ctx.fillStyle = '#f0b868';
          ctx.globalAlpha = 0.8;
          ctx.fillRect(cx - U * 0.8, row.y + U * 0.6, U * 1.6, U * 1.1);
          ctx.globalAlpha = 1;
        }
        roof(ctx, g, cx, row.y, w, row.h, row.col, row.snow, rand, ri === 1);
        if (ri === 1 && state.chimneys.length < 2 && cx > g.W * 0.1 && Math.abs(cx - gx) > g.W * 0.18) {
          const chx = cx + w * 0.18;
          const chy = row.y - row.h - U * 0.5;
          ctx.fillStyle = '#2a2f48';
          ctx.fillRect(chx - U * 0.8, chy - U * 2, U * 1.6, U * 2.4);
          ctx.fillStyle = '#c3cbe0';
          ctx.fillRect(chx - U * 0.8, chy - U * 2.4, U * 1.6, Math.max(1, U * 0.6));
          state.chimneys.push({ x: chx, y: chy - U * 2.6 });
        }
      }
    });
  }

  // ---- gate tower --------------------------------------------------------

  function body(ctx, g, x0, y0, w, h, lit) {
    const U = g.U;
    ctx.fillStyle = '#241d2c';
    ctx.fillRect(x0, y0, w, h);
    const bays = Math.max(2, Math.round(w / (U * 5)));
    const bw = w / bays;
    for (let i = 0; i < bays; i++) {
      ctx.fillStyle = lit ? '#e2a85a' : '#3a2c34';
      ctx.fillRect(x0 + i * bw + bw * 0.18, y0 + h * 0.2, bw * 0.64, h * 0.62);
      ctx.fillStyle = '#4a2420';
      ctx.fillRect(x0 + i * bw + bw * 0.5 - 0.5, y0 + h * 0.2, 1, h * 0.62);
    }
    ctx.fillStyle = '#8e2f26';
    for (let i = 0; i <= bays; i++) ctx.fillRect(x0 + i * bw - Math.max(1, U * 0.35), y0, Math.max(1, U * 0.7), h);
    ctx.fillStyle = '#6a2a22';
    ctx.fillRect(x0, y0, w, Math.max(1, U * 0.8));
  }

  function paintTower(ctx, g, rand) {
    const U = g.U;
    const cx = g.W * GATE_X;
    const wt = g.H * WALL_TOP;
    body(ctx, g, cx - U * 8, wt - U * 31, U * 16, U * 16, true);
    body(ctx, g, cx - U * 12, wt - U * 12, U * 24, U * 12, true);
    roof(ctx, g, cx, wt - U * 11, U * 40, U * 7.5, '#434a64', '#c3cbe0', rand, true);
    roof(ctx, g, cx, wt - U * 30, U * 30, U * 7, '#3d4560', '#c3cbe0', rand, true);
    ctx.fillStyle = '#c9a247';
    ctx.fillRect(cx - 0.5, wt - U * 39.5, 1, U * 2.4);
  }

  // ---- wall --------------------------------------------------------------

  function bricks(ctx, g, x0, y0, w, h) {
    const rowH = Math.max(2, g.U * 1.4);
    ctx.fillStyle = 'rgba(14,16,34,0.35)';
    for (let r = 0, y = y0; y < y0 + h; r++, y += rowH) {
      ctx.fillRect(x0, y, w, 1);
      const bw = rowH * 2.4;
      for (let x = x0 + (r % 2) * bw * 0.5; x < x0 + w; x += bw) ctx.fillRect(x, y, 1, rowH);
    }
  }

  function crenels(ctx, g, x0, x1, top, col, snow) {
    const U = g.U;
    for (let x = x0; x < x1; x += U * 3.6) {
      ctx.fillStyle = col;
      ctx.fillRect(x, top - U * 2.4, U * 2.2, U * 2.4);
      ctx.fillStyle = snow;
      ctx.fillRect(x, top - U * 2.4, U * 2.2, Math.max(1, U * 0.7));
    }
  }

  function paintWall(ctx, g, bastions) {
    const U = g.U;
    const top = g.H * WALL_TOP;
    const bot = g.H * WALL_BOT;
    const face = ctx.createLinearGradient(0, top, 0, bot);
    face.addColorStop(0, '#565c76');
    face.addColorStop(1, '#3a405c');
    ctx.fillStyle = face;
    ctx.fillRect(0, top, g.W, bot - top);
    bricks(ctx, g, 0, top, g.W, bot - top);
    crenels(ctx, g, 0, g.W, top, '#565c76', '#cfd6e8');
    ctx.fillStyle = '#cfd6e8';
    ctx.fillRect(0, top, g.W, Math.max(1, U * 0.8));
    for (const b of bastions) {
      ctx.fillStyle = '#626884';
      ctx.fillRect(b.x0, top - U * 1.2, b.w, bot - top + U * 1.2);
      bricks(ctx, g, b.x0, top, b.w, bot - top);
      crenels(ctx, g, b.x0 + U * 0.5, b.x0 + b.w - U, top - U * 1.2, '#626884', '#dfe5f2');
      ctx.fillStyle = 'rgba(10,12,28,0.4)';
      ctx.fillRect(b.x0 + b.w - Math.max(1, U * 0.8), top, Math.max(1, U * 0.8), bot - top);
      ctx.fillStyle = '#dfe5f2';
      ctx.fillRect(b.x0, top - U * 1.2, b.w, Math.max(1, U * 0.8));
    }
    ctx.fillStyle = '#dfe5f2';
    ctx.fillRect(0, bot - Math.max(1, U * 1.0), g.W, Math.max(1, U * 1.0));
  }

  function paintGate(ctx, g) {
    const U = g.U;
    const cx = g.W * GATE_X;
    const bot = g.H * WALL_BOT;
    const w = U * 10;
    const h = U * 14;
    ctx.fillStyle = '#7a809a';
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 - U, bot);
    ctx.lineTo(cx - w / 2 - U, bot - h + w / 2);
    ctx.arc(cx, bot - h + w / 2, w / 2 + U, Math.PI, 0);
    ctx.lineTo(cx + w / 2 + U, bot);
    ctx.fill();
    const warm = ctx.createLinearGradient(0, bot - h, 0, bot);
    warm.addColorStop(0, '#b8642c');
    warm.addColorStop(1, '#f2c47a');
    ctx.fillStyle = warm;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, bot);
    ctx.lineTo(cx - w / 2, bot - h + w / 2);
    ctx.arc(cx, bot - h + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(cx + w / 2, bot);
    ctx.fill();
    ctx.fillStyle = 'rgba(40,18,16,0.55)';
    ctx.fillRect(cx - w / 2, bot - h * 0.6, w, h * 0.6);
    ctx.fillStyle = '#8e2f26';
    ctx.fillRect(cx - w / 2, bot - h * 0.6, w * 0.46, h * 0.6);
    ctx.fillRect(cx + w * 0.04, bot - h * 0.6, w * 0.46, h * 0.6);
    ctx.fillStyle = '#c9a247';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      ctx.fillRect(cx - w * 0.44 + c * w * 0.12, bot - h * 0.54 + r * h * 0.17, 1, 1);
      ctx.fillRect(cx + w * 0.08 + c * w * 0.12, bot - h * 0.54 + r * h * 0.17, 1, 1);
    }
  }

  // Lanterns hang from the tower eaves, a rope along the wall and beside the gate.
  function lanternSpots(g, bastions) {
    const U = g.U;
    const gx = g.W * GATE_X;
    const wt = g.H * WALL_TOP;
    const spots = [];
    const add = (x, y, s) => spots.push({ x, y, s, ph: spots.length * 1.7 });
    [-17, -9, 9, 17].forEach((o) => add(gx + U * o, wt - U * 10, 1));
    [-11, 11].forEach((o) => add(gx + U * o, wt - U * 29, 0.9));
    add(gx - U * 9.5, g.H * WALL_BOT - U * 16, 1.1);
    add(gx + U * 9.5, g.H * WALL_BOT - U * 16, 1.1);
    state.ropes = [];
    for (let i = 0; i + 1 < bastions.length; i++) {
      const a = bastions[i].x0 + bastions[i].w;
      const b = bastions[i + 1].x0;
      if (a < gx + U * 6 && b > gx - U * 6) continue;
      const y = wt + U * 5;
      state.ropes.push({ a, b, y });
      const n = Math.max(1, Math.floor((b - a) / (U * 8)));
      for (let k = 0; k < n; k++) {
        const f = (k + 0.5) / n;
        add(lerp(a, b, f), y + Math.sin(f * Math.PI) * U * 2.2, 0.85);
      }
    }
    return spots;
  }

  function paintRopes(ctx, g) {
    ctx.strokeStyle = '#7a5a3a';
    ctx.lineWidth = 1;
    for (const r of state.ropes) {
      ctx.beginPath();
      ctx.moveTo(r.a, r.y);
      ctx.quadraticCurveTo((r.a + r.b) / 2, r.y + g.U * 4.4, r.b, r.y);
      ctx.stroke();
    }
  }

  function paintGround(ctx, g, spots) {
    const top = g.H * WALL_BOT;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, '#6a7294');
    grad.addColorStop(1, '#2e3454');
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    const gx = g.W * GATE_X;
    const pool = ctx.createRadialGradient(gx, top + g.U * 3, 0, gx, top + g.U * 3, g.U * 22);
    pool.addColorStop(0, 'rgba(255,184,100,0.5)');
    pool.addColorStop(1, 'rgba(255,184,100,0)');
    ctx.save();
    ctx.translate(0, 0);
    ctx.fillStyle = pool;
    ctx.fillRect(gx - g.U * 22, top, g.U * 44, g.H - top);
    ctx.restore();
    // a worn lane of packed snow leading from the gate
    ctx.fillStyle = 'rgba(210,216,236,0.18)';
    ctx.beginPath();
    ctx.moveTo(gx - g.U * 5, top);
    ctx.lineTo(gx + g.U * 5, top);
    ctx.lineTo(gx + g.W * 0.12, g.H);
    ctx.lineTo(gx - g.W * 0.12, g.H);
    ctx.fill();
  }

  function paintSpill(ctx, g, spots) {
    ctx.globalCompositeOperation = 'lighter';
    for (const s of spots) {
      const r = g.U * 9 * s.s;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(state.glow, s.x - r, s.y - r * 0.2, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---- bake --------------------------------------------------------------

  function bake(g) {
    const rand = K.rng(88);
    state.sky = paintSky(g, rand);
    const town = layer(g.W, g.H);
    const ctx = town.getContext('2d');
    paintHills(ctx, g);
    paintTown(ctx, g, rand);
    paintTower(ctx, g, rand);
    const bastions = [];
    const spacing = g.U * 26;
    const bw = g.U * 8;
    const gx = g.W * GATE_X;
    for (let x = gx - spacing * 5.5; x < g.W; x += spacing) {
      if (x + bw > 0 && Math.abs(x + bw / 2 - gx) > g.U * 14) bastions.push({ x0: x, w: bw });
    }
    paintWall(ctx, g, bastions);
    paintGate(ctx, g);
    paintGround(ctx, g);
    state.spots = lanternSpots(g, bastions);
    paintRopes(ctx, g);
    paintSpill(ctx, g, state.spots);
    state.town = town;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 1.2) % c.width);
    ctx.drawImage(c, off, g.H * 0.04);
    ctx.drawImage(c, off + c.width, g.H * 0.04);
  }

  function drawSmoke(ctx, g, t) {
    for (let k = 0; k < state.chimneys.length; k++) {
      const ch = state.chimneys[k];
      for (let i = 0; i < PUFFS; i++) {
        const a = (t * 0.06 + i / PUFFS + k * 0.31) % 1;
        const size = g.U * (2 + a * 7);
        const x = ch.x + a * g.U * 9 + Math.sin(t * 0.5 + i + k) * g.U * 0.6;
        const y = ch.y - a * g.U * 14;
        ctx.globalAlpha = (1 - a) * 0.8;
        ctx.drawImage(state.puff, x - size / 2, y - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawLanterns(ctx, g, t, sway) {
    const lan = state.lantern;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < state.spots.length; i++) {
      const s = state.spots[i];
      const r = g.U * 5.5 * s.s * (1 + 0.04 * Math.sin(t * 0.9 + s.ph));
      ctx.drawImage(state.glow, s.x - r, s.y + g.U * 1.6 * s.s - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < state.spots.length; i++) {
      const s = state.spots[i];
      const a = Math.sin(t * 0.9 + s.ph) * 0.07 * sway + Math.sin(t * 0.37 + s.ph * 2) * 0.03 * sway;
      const w = lan.width * s.s;
      const h = lan.height * s.s;
      ctx.setTransform(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), s.x, s.y);
      ctx.drawImage(lan, -w / 2, 0, w, h);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawSnow(ctx, g, t, dt, amount) {
    const n = Math.min(MAX_FLAKES, Math.round(FLAKES * amount));
    const f = state.flakes;
    const step = Math.min(dt, 0.1);
    ctx.fillStyle = '#e6eaf4';
    const sz = Math.max(1, Math.round(g.U * 0.5));
    for (let i = 0; i < n; i++) {
      f.y[i] += f.v[i] * g.U * step;
      f.x[i] += Math.sin(t * 0.8 + f.p[i]) * g.U * 0.5 * step + g.U * 0.6 * step;
      if (f.y[i] > g.H) {
        f.y[i] = -2;
        f.x[i] = state.rand() * g.W;
      }
      if (f.x[i] > g.W) f.x[i] -= g.W;
      ctx.globalAlpha = f.a[i];
      ctx.fillRect(f.x[i], f.y[i], sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.rand = K.rng(123);
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.3));
    state.glow = paintGlow();
    state.puff = paintPuff();
    state.lantern = paintLantern(g.U);
    const f = { x: new Float32Array(MAX_FLAKES), y: new Float32Array(MAX_FLAKES), v: new Float32Array(MAX_FLAKES), p: new Float32Array(MAX_FLAKES), a: new Float32Array(MAX_FLAKES) };
    for (let i = 0; i < MAX_FLAKES; i++) {
      f.x[i] = state.rand() * g.W;
      f.y[i] = state.rand() * g.H;
      f.v[i] = 3 + state.rand() * 4;
      f.p[i] = state.rand() * 6.3;
      f.a[i] = 0.45 + state.rand() * 0.5;
    }
    state.flakes = f;
    bake(g);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { snow, sway, smoke } = api.props;
    ctx.drawImage(state.sky, 0, 0);
    ctx.globalAlpha = 0.6;
    drawClouds(ctx, g, t);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.town, 0, 0);
    if (smoke) drawSmoke(ctx, g, t);
    drawLanterns(ctx, g, t, sway);
    drawSnow(ctx, g, t, dt, snow);
  }

  Kasuri.run({
    defaults: { snow: 1, sway: 1, smoke: true, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
