/*
 * 線香花火 Senko hanabi — a paper-twist sparkler burning in a pot of sand, late on a summer night.
 *
 * The night, roof, stone lantern, pail, fan, boards, pot and stem are baked once.
 * Per frame: a glow sprite, a small ember, a pooled set of sparks that fork like
 * pine needles, and a few smoke wisps.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;

  const SKY = ['#10142a', '#171d38', '#202a4c', '#2b3860'];
  const GOLD = '#f0cf7c';
  const AMBER = '#e48a3a';
  const EMBER = '#b8472b';
  const POOL = 280;
  const WISPS = 6;
  const FORK_AT = 0.32;
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
    const floor = Math.round(H * 0.8);
    const px = W * 0.5;
    return {
      W, H, U, floor, px,
      potY: floor + U * 4,
      tipX: px - U * 6,
      tipY: H * 0.42,
    };
  }

  // ---- baked world -----------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const inks = SKY.map(K.parseColor);
    const img = ctx.createImageData(g.W, g.floor);
    const d = img.data;
    for (let y = 0; y < g.floor; y++) {
      const f = (y / g.floor) * (inks.length - 1);
      const k = Math.min(inks.length - 2, Math.floor(f));
      for (let x = 0; x < g.W; x++) {
        const ink = inks[k + (rand() < f - k ? 1 : 0)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0]; d[i + 1] = ink[1]; d[i + 2] = ink[2]; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#c9c4b0';
    for (let i = 0; i < 26; i++) {
      ctx.globalAlpha = 0.25 + rand() * 0.4;
      ctx.fillRect(Math.floor(rand() * g.W), Math.floor(rand() * g.H * 0.4), 1, 1);
    }
    ctx.globalAlpha = 1;
    const mx = g.W * 0.16;
    const my = g.H * 0.15;
    ctx.fillStyle = '#e4d8a6';
    blob(ctx, mx, my, g.U * 4.2, g.U * 4.2);
    ctx.fillStyle = '#1c2442';
    blob(ctx, mx + g.U * 1.9, my - g.U * 0.7, g.U * 3.8, g.U * 3.8);
  }

  function paintHills(ctx, g) {
    ctx.fillStyle = '#161d33';
    ctx.beginPath();
    ctx.moveTo(0, g.floor);
    for (let x = 0; x <= g.W + 2; x += 2) {
      ctx.lineTo(x, g.floor - g.U * (13 + 5 * Math.sin(x / (g.U * 14)) + 3 * Math.sin(x / (g.U * 5.3))));
    }
    ctx.lineTo(g.W, g.floor);
    ctx.fill();
  }

  // A tiled hip roof seen from the side with upturned ends and ridge ornaments.
  function paintRoof(ctx, g) {
    const u = g.U;
    const x0 = -u * 4;
    const x1 = g.W * 0.36;
    const top = g.floor - u * 30;
    const eave = g.floor - u * 14;
    ctx.fillStyle = '#10152a';
    poly(ctx, [x0, eave + u * 2, x0 + u * 3, eave - u * 1, x0 + u * 14, top + u * 2, x1 - u * 14, top + u * 2,
      x1 - u * 3, eave - u * 1, x1, eave + u * 2]);
    ctx.fillStyle = '#1a2038';
    ctx.fillRect(x0, eave + u * 1.5, x1 - x0, u * 1.2);
    ctx.fillStyle = '#10152a';
    blob(ctx, x0 + u * 13, top + u * 0.4, u * 2.2, u * 2.2);
    blob(ctx, x1 - u * 13, top + u * 0.4, u * 2.2, u * 2.2);
    ctx.fillRect(x0, eave + u * 2.5, x1 - x0, g.floor - eave);
    ctx.strokeStyle = '#1d2540';
    ctx.lineWidth = 1;
    for (let x = x0 + u * 6; x < x1 - u * 5; x += u * 2.4) {
      ctx.beginPath();
      ctx.moveTo(x, top + u * 3);
      ctx.lineTo(x - (x - (x0 + x1) / 2) * 0.12, eave);
      ctx.stroke();
    }
    ctx.fillStyle = '#c8a34f';
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x0 + u * 12, eave + u * 5, u * 4, u * 3);
    ctx.fillRect(x1 - u * 20, eave + u * 5, u * 4, u * 3);
    ctx.globalAlpha = 1;
  }

  function paintBamboo(ctx, g, rand) {
    const u = g.U;
    for (let i = 0; i < 4; i++) {
      const x = g.W * (0.86 + i * 0.04) + u * (rand() - 0.5) * 2;
      ctx.strokeStyle = i % 2 ? '#1f3430' : '#1a2c2c';
      ctx.lineWidth = Math.max(1.5, u * 1.1);
      ctx.beginPath();
      ctx.moveTo(x, g.floor);
      ctx.lineTo(x + u * (i - 1.5), g.H * 0.04);
      ctx.stroke();
      ctx.fillStyle = '#2a4540';
      for (let y = g.floor - u * 9; y > g.H * 0.1; y -= u * (9 + rand() * 3)) {
        ctx.fillRect(x - u * 0.9 + u * (i - 1.5) * (1 - y / g.floor), y, u * 1.8, 1);
      }
      for (let j = 0; j < 4; j++) {
        const ly = g.H * (0.1 + j * 0.1 + rand() * 0.05);
        ctx.fillStyle = '#1c3330';
        poly(ctx, [x, ly, x - u * 7, ly + u * 2.5, x - u * 3, ly - u * 0.2]);
        poly(ctx, [x, ly, x + u * 6, ly + u * 3, x + u * 3, ly - u * 0.2]);
      }
    }
  }

  function paintLantern(ctx, g) {
    const u = g.U;
    const x = g.W * 0.8;
    const y = g.floor;
    ctx.fillStyle = '#2a3045';
    ctx.fillRect(x - u * 5, y - u * 3, u * 10, u * 3);
    ctx.fillRect(x - u * 3.4, y - u * 5, u * 6.8, u * 2);
    ctx.fillStyle = '#323a52';
    ctx.fillRect(x - u * 1.5, y - u * 17, u * 3, u * 12);
    ctx.fillStyle = '#2a3045';
    ctx.fillRect(x - u * 4, y - u * 19, u * 8, u * 2);
    ctx.fillStyle = '#202638';
    ctx.fillRect(x - u * 3.2, y - u * 26, u * 6.4, u * 7);
    ctx.fillStyle = '#c29a48';
    ctx.globalAlpha = 0.75;
    ctx.fillRect(x - u * 1.7, y - u * 25, u * 3.4, u * 5);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#323a52';
    poly(ctx, [x - u * 7.5, y - u * 25.5, x - u * 3.5, y - u * 30, x + u * 3.5, y - u * 30, x + u * 7.5, y - u * 25.5]);
    ctx.fillStyle = '#2a3045';
    blob(ctx, x, y - u * 31.4, u * 1.4, u * 1.8);
    ctx.fillStyle = '#c29a48';
    ctx.globalAlpha = 0.16;
    blob(ctx, x, y - u * 22, u * 9, u * 9);
    ctx.globalAlpha = 1;
  }

  function paintBoards(ctx, g, rand) {
    const u = g.U;
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(0, g.floor, g.W, g.H - g.floor);
    ctx.fillStyle = '#3a2c21';
    ctx.fillRect(0, g.floor, g.W, u * 1.4);
    const bands = ['#33271d', '#2d231a', '#382b20'];
    let y = g.floor + u * 1.4;
    let i = 0;
    while (y < g.H) {
      const h = u * 4.5;
      ctx.fillStyle = bands[i++ % 3];
      ctx.fillRect(0, y, g.W, h);
      ctx.fillStyle = '#1a140f';
      ctx.fillRect(0, y + h - 1, g.W, 1);
      ctx.fillStyle = '#463525';
      ctx.globalAlpha = 0.5;
      for (let k = 0; k < 5; k++) ctx.fillRect(rand() * g.W, y + 1 + rand() * (h - 2), u * (6 + rand() * 12), 1);
      ctx.globalAlpha = 1;
      y += h;
    }
  }

  function paintPail(ctx, g) {
    const u = g.U;
    const x = g.W * 0.22;
    const y = g.floor + u * 9;
    ctx.fillStyle = '#6d5438';
    poly(ctx, [x - u * 6.5, y - u * 10, x + u * 6.5, y - u * 10, x + u * 5.5, y, x - u * 5.5, y]);
    ctx.fillStyle = '#4e3b28';
    ctx.fillRect(x - u * 6.1, y - u * 7, u * 12.2, 1.2);
    ctx.fillRect(x - u * 5.8, y - u * 2.6, u * 11.6, 1.2);
    ctx.fillStyle = '#2f4a60';
    blob(ctx, x, y - u * 10, u * 6.5, u * 1.4);
    ctx.fillStyle = '#4b6680';
    blob(ctx, x - u * 1.5, y - u * 10.2, u * 3.2, u * 0.5);
    ctx.strokeStyle = '#4e3b28';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y - u * 10, u * 6.5, u * 1.4, 0, Math.PI, TAU);
    ctx.stroke();
  }

  function paintFan(ctx, g) {
    const u = g.U;
    const x = g.W * 0.74;
    const y = g.floor + u * 9;
    ctx.fillStyle = '#b8a37a';
    ctx.fillRect(x + u * 2, y - u * 0.4, u * 7, u * 1);
    ctx.fillStyle = '#d9d0b4';
    blob(ctx, x, y, u * 4.4, u * 1.7);
    ctx.fillStyle = '#34527a';
    for (let k = -2; k <= 2; k++) {
      ctx.fillRect(x + k * u * 1.5 - 0.5, y - u * 1.2, Math.max(1, u * 0.5), u * 2.4);
    }
  }

  // Pot of sand with a washi band, and the twisted paper stem leaning out of it.
  function paintPot(ctx, g) {
    const u = g.U;
    const x = g.px;
    const y = g.potY;
    ctx.fillStyle = '#1e2c4a';
    poly(ctx, [x - u * 7, y - u * 9, x + u * 7, y - u * 9, x + u * 6, y, x - u * 6, y]);
    ctx.fillStyle = '#2d4268';
    poly(ctx, [x - u * 7, y - u * 9, x - u * 4, y - u * 9, x - u * 3.4, y, x - u * 6, y]);
    ctx.fillStyle = '#d9d0b4';
    ctx.fillRect(x - u * 6.6, y - u * 5.5, u * 13.2, u * 1.6);
    ctx.fillStyle = '#9a8d6a';
    blob(ctx, x, y - u * 9, u * 7, u * 1.4);
    ctx.fillStyle = '#c9b88c';
    blob(ctx, x, y - u * 9.2, u * 6.2, u * 1.1);
    const sx = x - u * 0.5;
    const sy = y - u * 9.4;
    const dx = g.tipX - sx;
    const dy = g.tipY - sy;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#d6cdb2';
    ctx.lineWidth = Math.max(1.5, u * 0.7);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + dx * 0.86, sy + dy * 0.86);
    ctx.stroke();
    ctx.strokeStyle = '#8a7e62';
    ctx.lineWidth = 1;
    for (let k = 1; k < 9; k++) {
      const f = k * 0.095;
      ctx.beginPath();
      ctx.moveTo(sx + dx * f - u * 0.5, sy + dy * f + u * 0.5);
      ctx.lineTo(sx + dx * f + u * 0.5, sy + dy * f - u * 0.5);
      ctx.stroke();
    }
    ctx.strokeStyle = '#2a211c';
    ctx.lineWidth = Math.max(1.5, u * 0.7);
    ctx.beginPath();
    ctx.moveTo(sx + dx * 0.86, sy + dy * 0.86);
    ctx.lineTo(g.tipX, g.tipY);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  function paintGlowSprite() {
    const c = layer(64, 64);
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(244,190,96,0.9)');
    gr.addColorStop(0.25, 'rgba(228,138,58,0.38)');
    gr.addColorStop(1, 'rgba(184,71,43,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 64, 64);
    return c;
  }

  // ---- moving things -----------------------------------------------------------

  function makePool() {
    return {
      x: new Float32Array(POOL), y: new Float32Array(POOL),
      vx: new Float32Array(POOL), vy: new Float32Array(POOL),
      age: new Float32Array(POOL), life: new Float32Array(POOL),
      gen: new Uint8Array(POOL), forked: new Uint8Array(POOL), live: new Uint8Array(POOL),
      cursor: 0, acc: 0,
    };
  }

  function slot(P) {
    for (let n = 0; n < POOL; n++) {
      const i = (P.cursor + n) % POOL;
      if (!P.live[i]) { P.cursor = (i + 1) % POOL; return i; }
    }
    return -1;
  }

  function spawn(P, x, y, vx, vy, life, gen) {
    const i = slot(P);
    if (i < 0) return;
    P.x[i] = x; P.y[i] = y; P.vx[i] = vx; P.vy[i] = vy;
    P.age[i] = 0; P.life[i] = life; P.gen[i] = gen; P.forked[i] = 0; P.live[i] = 1;
  }

  function stepSparks(g, P, dt, rate, rand) {
    P.acc += dt * rate;
    while (P.acc >= 1) {
      P.acc -= 1;
      const a = rand() * TAU;
      const s = g.U * (24 + rand() * 24);
      spawn(P, g.tipX, g.tipY, Math.cos(a) * s, Math.sin(a) * s - g.U * 4, 0.55 + rand() * 0.55, 0);
    }
    const drag = Math.exp(-2.6 * dt);
    for (let i = 0; i < POOL; i++) {
      if (!P.live[i]) continue;
      P.age[i] += dt;
      if (P.age[i] >= P.life[i]) { P.live[i] = 0; continue; }
      if (P.gen[i] === 0 && !P.forked[i] && P.age[i] > P.life[i] * FORK_AT) {
        P.forked[i] = 1;
        for (let k = 0; k < 3; k++) {
          const a = rand() * TAU;
          const s = g.U * (10 + rand() * 12);
          spawn(P, P.x[i], P.y[i], P.vx[i] * 0.35 + Math.cos(a) * s, P.vy[i] * 0.35 + Math.sin(a) * s,
            0.28 + rand() * 0.3, 1);
        }
      }
      P.vx[i] *= drag;
      P.vy[i] = P.vy[i] * drag + g.U * 20 * dt;
      P.x[i] += P.vx[i] * dt;
      P.y[i] += P.vy[i] * dt;
    }
  }

  function drawSparks(ctx, g, P) {
    ctx.lineCap = 'round';
    for (let i = 0; i < POOL; i++) {
      if (!P.live[i]) continue;
      const f = P.age[i] / P.life[i];
      ctx.globalAlpha = Math.min(1, (1 - f) * 1.3);
      ctx.strokeStyle = f < 0.35 ? GOLD : f < 0.7 ? AMBER : EMBER;
      ctx.lineWidth = P.gen[i] === 0 ? 1.8 : 1.3;
      ctx.beginPath();
      ctx.moveTo(P.x[i] - P.vx[i] * 0.045, P.y[i] - P.vy[i] * 0.045);
      ctx.lineTo(P.x[i], P.y[i]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
  }

  function makeWisps(g, rand) {
    const w = { p: new Float32Array(WISPS), x: new Float32Array(WISPS), sp: new Float32Array(WISPS) };
    for (let i = 0; i < WISPS; i++) {
      w.p[i] = i / WISPS;
      w.x[i] = rand() * TAU;
      w.sp[i] = 0.12 + rand() * 0.08;
    }
    return w;
  }

  function drawWisps(ctx, g, W, t, dt) {
    ctx.fillStyle = '#8f93a6';
    for (let i = 0; i < WISPS; i++) {
      W.p[i] += dt * W.sp[i];
      if (W.p[i] >= 1) W.p[i] -= 1;
      const p = W.p[i];
      const x = g.tipX + Math.sin(p * 5 + W.x[i]) * g.U * 2.5 + p * g.U * 3;
      const y = g.tipY - p * g.U * 30;
      ctx.globalAlpha = 0.16 * Math.sin(p * Math.PI);
      blob(ctx, x, y, g.U * (1 + p * 2.4), g.U * (0.8 + p * 1.6));
    }
    ctx.globalAlpha = 1;
  }

  // ---- run ---------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    const back = layer(g.W, g.H);
    const b = back.getContext('2d');
    paintSky(b, g, rand);
    paintHills(b, g);
    paintRoof(b, g);
    paintBamboo(b, g, rand);
    paintLantern(b, g);
    paintBoards(b, g, rand);
    paintPail(b, g);
    paintFan(b, g);
    paintPot(b, g);
    state.back = back;
    state.glow = paintGlowSprite();
    state.pool = makePool();
    state.wisps = makeWisps(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { sparks, glow } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.back, 0, 0);
    stepSparks(g, state.pool, step, 34 * sparks, state.rand);
    drawWisps(ctx, g, state.wisps, t, step);
    const pulse = 0.88 + 0.12 * Math.sin(t * 2.1) * Math.sin(t * 0.7 + 1);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, 0.5 * glow * pulse);
    const r = g.U * 34;
    ctx.drawImage(state.glow, g.tipX - r, g.tipY - r, r * 2, r * 2);
    ctx.globalAlpha = Math.min(1, 0.55 * glow * pulse);
    const r2 = g.U * 11;
    ctx.drawImage(state.glow, g.tipX - r2, g.tipY - r2, r2 * 2, r2 * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    drawSparks(ctx, g, state.pool);
    ctx.fillStyle = '#f6dd94';
    blob(ctx, g.tipX, g.tipY, g.U * (1.3 + 0.15 * pulse), g.U * (1.3 + 0.15 * pulse));
    ctx.fillStyle = '#e48a3a';
    ctx.globalAlpha = 0.7;
    blob(ctx, g.tipX, g.tipY + g.U * 0.4, g.U * 1.9, g.U * 1.7);
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { sparks: 1, glow: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
