/*
 * ムササビ Momonga — a flying squirrel gliding between huge cedars under a full moon.
 *
 * Sky, moon, far trunks, near trunks and the stone lantern are baked once. Mist is
 * tiling strips that slide sideways. The squirrel is one small sprite drawn along a
 * slow falling arc, then it is gone for a while before the next crossing.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;
  const TAU = Math.PI * 2;

  const SKY = ['#1d2142', '#262d57', '#34406b', '#4a5880'];
  const MOON = { disc: '#eee6cc', glow: '#b9c0d6' };
  const TRUNK = { dark: '#16171f', mid: '#22242a', lit: '#5a6064', moss: '#33452f' };
  const FAR = ['#3e4a76', '#50608a'];
  const MIDT = { dark: '#2a3150', lit: '#5d6a8c' };
  const GROUND = ['#1a1f22', '#252f28', '#34452f'];
  const STONE = { dark: '#4a4d4c', mid: '#74776f', lit: '#a2a28f' };
  const FIRE = '#d6a84a';
  const PATH_SECONDS = 46;
  const REST_SECONDS = 6;
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
    return { W, H, U, gy: Math.round(H * 0.86), mx: W * 0.58, my: H * 0.3 };
  }

  // ---- sky and moon --------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.H);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / (g.H * 0.8)) * (inks.length - 1);
      const k = Math.min(inks.length - 2, Math.floor(f));
      for (let x = 0; x < g.W; x++) {
        const ink = inks[k + (rand() < f - k ? 1 : 0)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#b9bfd6';
    for (let i = 0; i < 30; i++) {
      const x = rand() * g.W;
      const y = rand() * g.H * 0.45;
      if (Math.hypot(x - g.mx, y - g.my) < g.U * 22) continue;
      ctx.globalAlpha = 0.35 + rand() * 0.4;
      ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function paintMoon(ctx, g) {
    const r = g.U * 10;
    for (let i = 5; i >= 1; i--) {
      ctx.fillStyle = MOON.glow;
      ctx.globalAlpha = 0.07;
      blob(ctx, g.mx, g.my, r * (1 + i * 0.55), r * (1 + i * 0.55));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = MOON.disc;
    blob(ctx, g.mx, g.my, r, r);
    ctx.fillStyle = '#d3cdb4';
    blob(ctx, g.mx - r * 0.3, g.my - r * 0.2, r * 0.25, r * 0.2);
    blob(ctx, g.mx + r * 0.25, g.my + r * 0.3, r * 0.3, r * 0.22);
    blob(ctx, g.mx + r * 0.1, g.my - r * 0.45, r * 0.15, r * 0.1);
  }

  // ---- trunks --------------------------------------------------------------

  // A cedar trunk: slim taper, dark bark with pale vertical grooves on the moon side.
  function trunk(ctx, g, rand, x, w, top, bottom, inks, fluted) {
    const tw = (y) => w * (0.82 + 0.18 * ((y - top) / (bottom - top)));
    const lean = (y) => Math.sin(y / (g.U * 38) + x) * g.U * 0.5;
    for (let y = top; y < bottom; y += 1) {
      const cx = x + lean(y);
      const hw = tw(y) / 2;
      ctx.fillStyle = inks.dark;
      ctx.fillRect(cx - hw, y, hw * 2, 1.5);
    }
    const toMoon = x < g.mx ? 1 : -1;
    for (let i = 0; i < fluted; i++) {
      const f = rand();
      const edge = toMoon > 0 ? 0.4 + f * 0.6 : -0.4 - f * 0.6;
      ctx.strokeStyle = f > 0.6 ? inks.lit : inks.mid || inks.dark;
      ctx.globalAlpha = 0.35 + (1 - f) * 0.5;
      ctx.lineWidth = Math.max(1, g.U * 0.25);
      ctx.beginPath();
      const y0 = top + rand() * (bottom - top) * 0.6;
      const y1 = Math.min(bottom, y0 + g.U * (14 + rand() * 40));
      ctx.moveTo(x + lean(y0) + edge * tw(y0) / 2, y0);
      ctx.lineTo(x + lean(y1) + edge * tw(y1) / 2, y1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function branch(ctx, g, rand, x, y, len, dir, ink) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, g.U * 0.9);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + dir * len * 0.5, y - g.U * 2, x + dir * len, y + g.U * 2);
    ctx.stroke();
    ctx.fillStyle = ink;
    for (let i = 0; i < 6; i++) {
      const f = 0.3 + i * 0.13;
      blob(ctx, x + dir * len * f, y + g.U * (0.5 + f * 1.5), g.U * (2.5 - f), g.U * 0.7);
    }
  }

  function paintFar(g, rand) {
    const c = layer(g.W, g.gy);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const x = g.W * (i + 0.5 + (rand() - 0.5) * 0.7) / 9;
      if (Math.abs(x - g.mx) < g.U * 15) continue;
      ctx.globalAlpha = 0.7;
      trunk(ctx, g, rand, x, g.U * (4 + rand() * 2.5), -2, g.gy, { dark: FAR[i % 2], lit: FAR[1], mid: FAR[0] }, 3);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintMid(g, rand) {
    const c = layer(g.W, g.gy + g.U * 2);
    const ctx = c.getContext('2d');
    const xs = [g.W * 0.31, g.W * 0.78];
    xs.forEach((x, i) => {
      trunk(ctx, g, rand, x, g.U * 8, -2, g.gy + g.U, MIDT, 9);
      branch(ctx, g, rand, x + (i ? -g.U * 3 : g.U * 3), g.H * (0.2 + i * 0.1), g.U * 14, i ? -1 : 1, MIDT.dark);
      branch(ctx, g, rand, x, g.H * (0.55 - i * 0.1), g.U * 10, i ? 1 : -1, MIDT.dark);
    });
    return c;
  }

  function rope(ctx, g, x, y, w) {
    ctx.strokeStyle = '#c9b88a';
    ctx.lineWidth = Math.max(1, g.U * 0.9);
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.quadraticCurveTo(x, y + g.U * 3, x + w / 2, y);
    ctx.stroke();
    ctx.fillStyle = '#e4dcc4';
    for (let i = 0; i < 3; i++) {
      const sx = x - w * 0.3 + i * w * 0.3;
      const sy = y + g.U * (1.8 - Math.abs(i - 1) * 0.2);
      ctx.fillRect(sx, sy, Math.max(1, g.U * 0.7), g.U * 2.2);
    }
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    trunk(ctx, g, rand, g.W * 0.07, g.U * 17, -2, g.gy + g.U * 2, TRUNK, 22);
    trunk(ctx, g, rand, g.W * 0.94, g.U * 21, -2, g.gy + g.U * 2, TRUNK, 26);
    rope(ctx, g, g.W * 0.07 + g.U * 0.5, g.H * 0.58, g.U * 17.5);
    branch(ctx, g, rand, g.W * 0.07, g.H * 0.12, g.U * 24, 1, TRUNK.dark);
    branch(ctx, g, rand, g.W * 0.94, g.H * 0.2, g.U * 30, -1, TRUNK.dark);
    return c;
  }

  // ---- ground and lantern --------------------------------------------------

  function paintGround(g, rand) {
    const c = layer(g.W, g.H - g.gy + g.U * 2);
    const ctx = c.getContext('2d');
    const h = c.height;
    ctx.fillStyle = GROUND[0];
    ctx.fillRect(0, 0, g.W, h);
    for (let x = 0; x < g.W; x += g.U * (1 + rand() * 2)) {
      ctx.fillStyle = GROUND[1 + (rand() < 0.4 ? 1 : 0)];
      blob(ctx, x, g.U * (1 + rand() * 3), g.U * (1.5 + rand() * 3), g.U * (0.6 + rand() * 0.8));
    }
    ctx.strokeStyle = GROUND[2];
    ctx.lineWidth = 1;
    for (let i = 0; i < 90; i++) {
      const x = rand() * g.W;
      const y = g.U * (1 + rand() * 11);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * g.U * 1.5, y - g.U * (1 + rand() * 1.8));
      ctx.stroke();
    }
    return c;
  }

  function paintLantern(g) {
    const u = g.U * 1.3;
    const x = g.W * 0.43;
    const y = g.gy + u * 2;
    const c = layer(u * 24, u * 26);
    const ctx = c.getContext('2d');
    const cx = c.width / 2;
    const by = c.height - u * 2;
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = FIRE;
    for (let i = 3; i >= 1; i--) blob(ctx, cx, by - u * 8, u * i * 2.6, u * i * 2.4);
    ctx.globalAlpha = 1;
    const part = (ink, px, py, w, h) => {
      ctx.fillStyle = ink;
      ctx.fillRect(cx + px - w / 2, by - py - h, w, h);
    };
    part(STONE.dark, 0, 0, u * 6, u * 1.2);
    part(STONE.mid, 0, u * 1.2, u * 1.9, u * 5);
    part(STONE.lit, -u * 0.6, u * 1.2, u * 0.5, u * 5);
    part(STONE.mid, 0, u * 6.2, u * 4.6, u * 0.9);
    part(STONE.dark, 0, u * 7.1, u * 3.8, u * 3);
    part(FIRE, 0, u * 7.7, u * 1.8, u * 1.8);
    ctx.fillStyle = STONE.mid;
    ctx.beginPath();
    ctx.moveTo(cx - u * 4.4, by - u * 10.1);
    ctx.lineTo(cx + u * 4.4, by - u * 10.1);
    ctx.lineTo(cx + u * 1.5, by - u * 12.6);
    ctx.lineTo(cx - u * 1.5, by - u * 12.6);
    ctx.fill();
    part(STONE.lit, 0, u * 12.6, u * 1.2, u * 1);
    return { c, x: x - cx, y: y - by };
  }

  // ---- mist ----------------------------------------------------------------

  function paintMist(g, seed, thick) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 16), y / (g.U * 5), 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.34, 0.64, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 176;
        img.data[i + 1] = 188;
        img.data[i + 2] = 212;
        img.data[i + 3] = a * thick;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMist(ctx, g, strip, t, speed, y, alpha) {
    if (alpha <= 0) return;
    const w = strip.width;
    const a = (t * g.U * speed) % w;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(strip, -a, y);
    ctx.drawImage(strip, w - a, y);
    ctx.globalAlpha = 1;
  }

  // ---- squirrel ------------------------------------------------------------

  // Facing right: spread limbs and membrane in a flat diamond, head forward, long tail behind.
  function paintSquirrel(g) {
    const u = g.U * 1.9;
    const w = Math.ceil(u * 16);
    const h = Math.ceil(u * 9);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const cx = w * 0.5;
    const cy = h * 0.5;
    ctx.fillStyle = '#17181f';
    ctx.beginPath();
    ctx.moveTo(cx + u * 2.4, cy - u * 0.4);
    ctx.quadraticCurveTo(cx + u * 2, cy - u * 3.6, cx - u * 1.2, cy - u * 3.9);
    ctx.quadraticCurveTo(cx - u * 3.6, cy - u * 1.4, cx - u * 3.2, cy + u * 0.5);
    ctx.quadraticCurveTo(cx - u * 2.2, cy + u * 3.6, cx + u * 0.8, cy + u * 3.8);
    ctx.quadraticCurveTo(cx + u * 2.6, cy + u * 3.2, cx + u * 2.4, cy + u * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - u * 2.6, cy);
    ctx.quadraticCurveTo(cx - u * 5.4, cy - u * 0.6, cx - u * 7.4, cy + u * 0.2);
    ctx.quadraticCurveTo(cx - u * 7.6, cy + u * 1.3, cx - u * 6.4, cy + u * 1.5);
    ctx.quadraticCurveTo(cx - u * 4.2, cy + u * 1.4, cx - u * 2.4, cy + u * 1.1);
    ctx.fill();
    blob(ctx, cx + u * 3, cy - u * 0.5, u * 1.5, u * 1.2);
    ctx.beginPath();
    ctx.moveTo(cx + u * 2.4, cy - u * 1.5);
    ctx.lineTo(cx + u * 2.7, cy - u * 2.8);
    ctx.lineTo(cx + u * 3.4, cy - u * 1.6);
    ctx.fill();
    ctx.fillStyle = '#7d6f5a';
    ctx.globalAlpha = 0.55;
    blob(ctx, cx - u * 0.2, cy - u * 0.2, u * 1.7, u * 1.1);
    ctx.fillRect(cx - u * 7, cy + u * 0.2, u * 4, Math.max(1, u * 0.35));
    ctx.fillStyle = '#d8cfb2';
    ctx.globalAlpha = 0.9;
    ctx.fillRect(cx + u * 3.4, cy - u * 0.8, Math.max(1, u * 0.35), Math.max(1, u * 0.35));
    ctx.globalAlpha = 1;
    return c;
  }

  function drawSquirrel(ctx, g, t) {
    const period = PATH_SECONDS + REST_SECONDS;
    const k = (t % period) / PATH_SECONDS;
    if (k >= 1) return;
    const sp = state.squirrel;
    const x = lerp(-g.U * 16, g.W + g.U * 16, k);
    const y = g.H * 0.28 + k * g.H * 0.22 + Math.sin(k * TAU * 1.5) * g.U * 1.6;
    const tilt = 0.12 + Math.cos(k * TAU * 1.5) * 0.04;
    const c = Math.cos(tilt);
    const s = Math.sin(tilt);
    const wob = 1 + Math.sin(t * 0.9) * 0.04;
    ctx.setTransform(c * 1.25, s * 1.25, -s * wob * 0.7, c * wob * 0.7, x, y);
    ctx.drawImage(sp, -sp.width / 2, -sp.height / 2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    const back = layer(g.W, g.H);
    const bctx = back.getContext('2d');
    paintSky(bctx, g, rand);
    paintMoon(bctx, g);
    bctx.drawImage(paintFar(g, rand), 0, 0);
    state.g = g;
    state.back = back;
    state.mid = paintMid(g, rand);
    state.front = paintFront(g, rand);
    state.ground = paintGround(g, rand);
    state.lantern = paintLantern(g);
    state.mistA = paintMist(g, 31, 150);
    state.mistB = paintMist(g, 57, 120);
    state.squirrel = paintSquirrel(g);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { mist, lantern } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawMist(ctx, g, state.mistA, t, 0.7, g.H * 0.28, mist * 0.6);
    ctx.drawImage(state.mid, 0, 0);
    drawMist(ctx, g, state.mistB, t, 1.3, g.H * 0.55, mist * 0.7);
    drawSquirrel(ctx, g, t);
    ctx.drawImage(state.ground, 0, g.gy);
    if (lantern) {
      const l = state.lantern;
      ctx.drawImage(l.c, l.x, l.y + g.U * 2 - 0);
    }
    drawMist(ctx, g, state.mistA, t + 40, 1.8, g.H * 0.74, mist * 0.55);
    ctx.drawImage(state.front, 0, 0);
  }

  Kasuri.run({
    defaults: { mist: 1, lantern: true, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
