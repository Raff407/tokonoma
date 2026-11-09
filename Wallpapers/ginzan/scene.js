/*
 * 銀山 Ginzan — a snowy hot-spring town of timber inns on both banks of a river, blue hour.
 *
 * Sky, hills, both banks and the lamps are baked once (again on resize). The river is the
 * baked world flipped and laid back in thin rows that slide sideways. Steam is a short
 * pool of soft puffs, snow a fixed set of flakes, lamp glow a reused sprite.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm } = K;
  const TAU = Math.PI * 2;

  const FAR = 0.63;
  const WALL = 0.88;
  const SKY = ['#25345f', '#3d5288', '#5f78a8', '#93a5c8', '#c3bcc8'];
  const INK = { tile: '#262a40', wood: '#2b2430', plaster: '#8d94aa', slat: '#3a2f38', rail: '#171520', dark: '#1e2438' };
  const SNOW = { lit: '#dfe6f0', mid: '#b4c0d6', shade: '#8f9cb8' };
  const GOLD = '#e2b45c';
  const VERMILION = '#b4432b';
  const FLAKES = 130;
  const PUFFS = 22;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
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
    const fy = Math.round(H * FAR);
    const top = Math.round(fy + U * 2.2);
    const wy = Math.round(H * WALL);
    return { W, H, U, fy, top, wy, rh: wy - top };
  }

  // ---- sky and hills -------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.fy);
    SKY.forEach((c, i) => grad.addColorStop(i / (SKY.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#d8dcea';
    for (let i = 0; i < g.W * 0.25; i++) {
      ctx.globalAlpha = 0.15 + rand() * 0.4;
      ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
    }
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#e8e4d2';
    blob(ctx, g.W * 0.8, g.H * 0.15, g.U * 2.6, g.U * 2.6);
    ctx.globalAlpha = 0.18;
    blob(ctx, g.W * 0.8, g.H * 0.15, g.U * 6, g.U * 6);
    ctx.globalAlpha = 1;
  }

  function ridge(ctx, g, base, amp, scale, seed, c0, c1) {
    const grad = ctx.createLinearGradient(0, base - amp * 1.6, 0, g.fy);
    grad.addColorStop(0, c0);
    grad.addColorStop(1, c1);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, g.fy);
    for (let x = 0; x <= g.W + 2; x += 2) {
      const n = fbm(x / (g.U * scale), seed, 4, seed * 3);
      ctx.lineTo(x, base - n * amp);
    }
    ctx.lineTo(g.W, g.fy);
    ctx.fill();
  }

  function pine(ctx, x, base, h, shade) {
    const w = h * 0.34;
    ctx.fillStyle = shade;
    for (let k = 0; k < 4; k++) {
      const y = base - h * (k * 0.22);
      const ww = w * (1 - k * 0.2);
      poly(ctx, [x - ww, y, x + ww, y, x, y - h * 0.36]);
    }
    ctx.fillStyle = SNOW.mid;
    ctx.globalAlpha = 0.7;
    for (let k = 0; k < 4; k++) {
      const y = base - h * (k * 0.22) - h * 0.1;
      const ww = w * (1 - k * 0.2) * 0.55;
      poly(ctx, [x - ww, y, x + ww, y, x, y - h * 0.26]);
    }
    ctx.globalAlpha = 1;
  }

  function paintHills(ctx, g, rand) {
    ridge(ctx, g, g.H * 0.5, g.H * 0.3, 55, 3, '#c3cde0', '#5a6a92');
    ridge(ctx, g, g.H * 0.55, g.H * 0.22, 30, 7, '#8d9bb8', '#34425f');
    for (let x = 0; x < g.W; x += g.U * (1.4 + rand() * 1.6)) {
      const h = g.U * (7 + rand() * 9);
      pine(ctx, x, g.fy - g.U * (1 + rand() * 5), h, rand() < 0.5 ? '#1f2f33' : '#27383a');
    }
  }

  // ---- inns ----------------------------------------------------------------

  function window2(ctx, x, y, w, h, lit) {
    ctx.fillStyle = lit ? GOLD : '#1c2236';
    ctx.fillRect(x, y, w, h);
    if (lit) {
      ctx.fillStyle = '#9a6a30';
      ctx.fillRect(x + w / 2, y, 1, h);
      ctx.fillRect(x, y + h * 0.5, w, 1);
    }
  }

  function eaves(ctx, x, y, w, u) {
    ctx.fillStyle = INK.tile;
    poly(ctx, [x - u * 1.4, y + u * 0.9, x + w + u * 1.4, y + u * 0.9, x + w + u * 0.6, y, x - u * 0.6, y]);
    ctx.fillStyle = SNOW.lit;
    ctx.fillRect(x - u * 0.6, y - u * 0.55, w + u * 1.2, u * 0.6);
  }

  function roof(ctx, x, top, w, rh, u) {
    ctx.fillStyle = INK.tile;
    poly(ctx, [x - u * 2.2, top, x + w + u * 2.2, top, x + w * 0.82, top - rh, x + w * 0.18, top - rh]);
    ctx.fillStyle = SNOW.mid;
    poly(ctx, [x - u * 1.2, top - u * 0.9, x + w + u * 1.2, top - u * 0.9, x + w * 0.82, top - rh - u * 0.2, x + w * 0.18, top - rh - u * 0.2]);
    ctx.fillStyle = SNOW.lit;
    poly(ctx, [x + w * 0.1, top - rh * 0.55, x + w * 0.9, top - rh * 0.55, x + w * 0.82, top - rh - u * 0.4, x + w * 0.18, top - rh - u * 0.4]);
    ctx.fillStyle = INK.tile;
    for (let k = 0; k < 3; k++) ctx.fillRect(x + w * (0.25 + k * 0.25), top - u * 1.4, 1, u * 0.9);
  }

  function inn(ctx, g, rand, x, base, w, floors, fh, lanterns) {
    const u = g.U;
    const body = floors * fh;
    ctx.fillStyle = INK.wood;
    ctx.fillRect(x, base - body, w, body);
    ctx.fillStyle = INK.slat;
    for (let sx = x + u; sx < x + w; sx += u * 1.3) ctx.fillRect(sx, base - body, 1, body);
    for (let f = 0; f < floors; f++) {
      const fb = base - f * fh;
      const pitch = fh * 0.95;
      const n = Math.max(2, Math.floor(w / pitch));
      const step = w / n;
      if (f > 0) {
        ctx.fillStyle = INK.plaster;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(x, fb - fh * 0.12, w, fh * 0.12);
        ctx.globalAlpha = 1;
      }
      for (let i = 0; i < n; i++) {
        window2(ctx, x + step * i + step * 0.22, fb - fh * 0.78, step * 0.56, fh * 0.5, rand() < 0.68);
      }
      ctx.fillStyle = INK.rail;
      ctx.fillRect(x - u * 0.3, fb - fh * 0.26, w + u * 0.6, Math.max(1, u * 0.6));
      for (let sx = x; sx < x + w; sx += u * 1.6) ctx.fillRect(sx, fb - fh * 0.26, 1, fh * 0.26);
      if (f < floors - 1) eaves(ctx, x, fb - fh, w, u);
    }
    roof(ctx, x, base - body, w, fh * 0.95, u);
    if (rand() < 0.6) {
      ctx.fillStyle = INK.dark;
      ctx.fillRect(x + w * 0.7, base - body - fh * 1.7, u * 1.4, fh * 0.9);
      ctx.fillStyle = SNOW.lit;
      ctx.fillRect(x + w * 0.7 - 1, base - body - fh * 1.7 - 1, u * 1.4 + 2, Math.max(1, u * 0.5));
      state.vents.push({ x: x + w * 0.7 + u * 0.7, y: base - body - fh * 1.7 });
    }
    for (const lx of lanterns) {
      ctx.fillStyle = VERMILION;
      blob(ctx, x + w * lx, base - fh * 0.48, u * 0.95, u * 1.35);
      ctx.fillStyle = '#e8c070';
      ctx.fillRect(x + w * lx - 1, base - fh * 0.5, 2, 1);
    }
    return base - body - fh * 0.95;
  }

  function paintFarBank(ctx, g, rand) {
    const u = g.U;
    state.vents = [];
    let x = u * 24;
    while (x < g.W - u * 26) {
      const w = u * (13 + rand() * 11);
      if (x + w > g.W - u * 24) break;
      inn(ctx, g, rand, x, g.fy, w, 2 + Math.floor(rand() * 2.6), u * 5.2, rand() < 0.75 ? [0.25, 0.75] : [0.5]);
      x += w + u * (0.8 + rand() * 2.4);
      if (rand() < 0.4) {
        pine(ctx, x + u * 1.5, g.fy, u * (9 + rand() * 4), '#1b2b2e');
        x += u * 4;
      }
    }
    ctx.fillStyle = '#242839';
    ctx.fillRect(0, g.fy, g.W, g.top - g.fy);
    ctx.fillStyle = SNOW.mid;
    ctx.fillRect(0, g.fy, g.W, Math.max(1, u * 0.8));
    ctx.fillStyle = '#323752';
    for (let sx = 0; sx < g.W; sx += u * 2.4) ctx.fillRect(sx, g.fy + u * 1.1, 1, g.top - g.fy - u * 1.1);
    for (let sx = u * 30; sx < g.W - u * 24; sx += u * (14 + rand() * 10)) {
      state.glows.push({ x: sx, y: g.fy - u * 3.4, r: u * 6 });
      ctx.fillStyle = INK.rail;
      ctx.fillRect(sx, g.fy - u * 3, Math.max(1, u * 0.3), u * 3);
      ctx.fillStyle = '#f0c878';
      ctx.fillRect(sx - u * 0.35, g.fy - u * 3.8, u * 1, u * 1);
    }
  }

  // ---- river and near bank -------------------------------------------------

  function paintRiver(ctx, g) {
    const grad = ctx.createLinearGradient(0, g.top, 0, g.wy);
    grad.addColorStop(0, '#3b4e78');
    grad.addColorStop(1, '#222c4e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.top, g.W, g.rh);
    const refl = layer(g.W, g.rh);
    const rc = refl.getContext('2d');
    rc.translate(0, g.rh);
    rc.scale(1, -1);
    rc.drawImage(state.back, 0, g.top - g.rh, g.W, g.rh, 0, 0, g.W, g.rh);
    rc.setTransform(1, 0, 0, 1, 0, 0);
    rc.globalCompositeOperation = 'source-atop';
    rc.fillStyle = 'rgba(30,44,80,0.28)';
    rc.fillRect(0, 0, g.W, g.rh);
    rc.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.85;
    ctx.drawImage(refl, 0, g.top);
    ctx.globalAlpha = 1;
    state.refl = refl;
    ctx.fillStyle = '#0f1428';
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0, g.wy - g.U * 3, g.W, g.U * 3);
    ctx.globalAlpha = 1;
  }

  function paintNear(ctx, g, rand) {
    const u = g.U;
    inn(ctx, g, rand, -u * 3, g.wy + u, u * 27, 3, u * 8.5, [0.5, 0.85]);
    inn(ctx, g, rand, g.W - u * 28, g.wy + u, u * 31, 3, u * 8.2, [0.18]);
    ctx.fillStyle = '#1b2034';
    ctx.fillRect(0, g.wy, g.W, g.H - g.wy);
    ctx.fillStyle = '#2a3048';
    for (let y = g.wy + u * 3; y < g.H; y += u * 3.4) {
      ctx.fillRect(0, y, g.W, 1);
      for (let sx = rand() * u * 4; sx < g.W; sx += u * (4 + rand() * 4)) ctx.fillRect(sx, y - u * 3.4, 1, u * 3.4);
    }
    ctx.fillStyle = SNOW.lit;
    ctx.fillRect(0, g.wy - u * 0.2, g.W, u * 1.4);
    ctx.fillStyle = SNOW.mid;
    ctx.fillRect(0, g.wy + u * 1.2, g.W, Math.max(1, u * 0.5));
    for (const f of [0.3, 0.44, 0.58, 0.72]) {
      const lx = g.W * f;
      ctx.fillStyle = INK.rail;
      ctx.fillRect(lx, g.wy - u * 11, Math.max(1, u * 0.45), u * 11);
      poly(ctx, [lx - u * 0.9, g.wy - u * 11.4, lx + u * 1.35, g.wy - u * 11.4, lx + u * 0.22, g.wy - u * 12.6]);
      ctx.fillStyle = '#f2cc7c';
      ctx.fillRect(lx - u * 0.7, g.wy - u * 11, u * 1.8, u * 1.9);
      ctx.fillStyle = INK.rail;
      ctx.fillRect(lx - u * 0.9, g.wy - u * 9, u * 2.2, Math.max(1, u * 0.35));
      state.glows.push({ x: lx + u * 0.2, y: g.wy - u * 10, r: u * 11 });
    }
  }

  function bake(g) {
    const back = layer(g.W, g.H);
    state.back = back;
    const rand = K.rng(88);
    state.glows = [];
    const bc = back.getContext('2d');
    paintSky(bc, g, rand);
    paintHills(bc, g, rand);
    paintFarBank(bc, g, rand);
    paintRiver(bc, g);
    const front = layer(g.W, g.H);
    const fc = front.getContext('2d');
    paintNear(fc, g, rand);
    state.front = front;
  }

  // ---- sprites -------------------------------------------------------------

  function softSprite(size, rgb, a) {
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const h = size / 2;
    const grad = ctx.createRadialGradient(h, h, 0, h, h, h);
    grad.addColorStop(0, `rgba(${rgb},${a})`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  function seedFlakes(g) {
    const rand = K.rng(5);
    state.fx = new Float32Array(FLAKES);
    state.fy = new Float32Array(FLAKES);
    state.fv = new Float32Array(FLAKES);
    state.fp = new Float32Array(FLAKES);
    state.fs = new Float32Array(FLAKES);
    for (let i = 0; i < FLAKES; i++) {
      state.fx[i] = rand() * g.W;
      state.fy[i] = rand() * g.H;
      state.fv[i] = g.U * (3 + rand() * 4);
      state.fp[i] = rand() * TAU;
      state.fs[i] = rand() < 0.2 ? 2 : 1;
    }
    state.fmax = FLAKES;
  }

  function seedSteam(g) {
    const rand = K.rng(17);
    state.sources = [];
    for (let i = 0; i < 6; i++) state.sources.push({ x: g.W * (0.2 + rand() * 0.6), y: g.top + g.U * (1 + rand() * 4), w: g.U * 4 });
    for (const v of state.vents) state.sources.push({ x: v.x, y: v.y, w: g.U });
    state.puffSeed = new Float32Array(PUFFS);
    for (let i = 0; i < PUFFS; i++) state.puffSeed[i] = rand();
  }

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    bake(g);
    state.glow = softSprite(64, '255,214,140', 0.55);
    state.puff = softSprite(32, '214,222,238', 0.4);
    seedFlakes(g);
    seedSteam(g);
  }

  // ---- motion --------------------------------------------------------------

  function drawRiver(ctx, g, t) {
    const rows = Math.floor(g.rh / 2);
    ctx.globalAlpha = 0.8;
    for (let r = 0; r < rows; r++) {
      const k = r / rows;
      const off = Math.sin(t * 0.8 + r * 0.55) * g.U * (0.25 + k * 0.5);
      ctx.drawImage(state.refl, 0, r * 2, g.W, 2, off, g.top + r * 2, g.W, 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawSteam(ctx, g, t, amount) {
    const n = Math.min(PUFFS, Math.round(PUFFS * Math.min(1, amount)));
    const src = state.sources;
    for (let i = 0; i < n; i++) {
      const s = src[i % src.length];
      const a = (t * 0.05 + state.puffSeed[i]) % 1;
      const size = g.U * (3 + a * 11);
      const x = s.x + Math.sin(t * 0.3 + i) * g.U * 1.5 + a * g.U * 3 + (state.puffSeed[i] - 0.5) * s.w;
      const y = s.y - a * g.U * 14;
      ctx.globalAlpha = Math.min(1, amount) * Math.sin(a * Math.PI) * 0.75;
      ctx.drawImage(state.puff, x - size / 2, y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawGlows(ctx, t) {
    const list = state.glows;
    const pulse = 0.88 + Math.sin(t * 0.9) * 0.06;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = pulse * 0.8;
    for (let i = 0; i < list.length; i++) {
      const l = list[i];
      ctx.drawImage(state.glow, l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawSnow(ctx, g, t, dt, amount) {
    const n = Math.round(state.fmax * Math.min(1, amount));
    ctx.fillStyle = '#eef2f8';
    for (let i = 0; i < n; i++) {
      state.fy[i] += state.fv[i] * dt;
      state.fx[i] += Math.sin(t * 0.7 + state.fp[i]) * g.U * 0.9 * dt - g.U * 0.8 * dt;
      if (state.fy[i] > g.H) state.fy[i] -= g.H;
      if (state.fx[i] < 0) state.fx[i] += g.W;
      ctx.globalAlpha = state.fs[i] > 1 ? 0.9 : 0.6;
      ctx.fillRect(state.fx[i], state.fy[i], state.fs[i], state.fs[i]);
    }
    ctx.globalAlpha = 1;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawRiver(ctx, g, t);
    drawSteam(ctx, g, t, props.steam);
    ctx.drawImage(state.front, 0, 0);
    drawGlows(ctx, t);
    if (props.snow > 0) drawSnow(ctx, g, t, dt, props.snow);
  }

  Kasuri.run({
    defaults: { snow: 1, steam: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
