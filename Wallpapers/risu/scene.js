/*
 * 栗鼠 Risu — a red squirrel on a mossy oak bough in autumn gold.
 *
 * Backdrop, bough and squirrel are baked once. Only the tail, the light shafts
 * and a short pool of maple leaves move each frame.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const MAX_LEAVES = 30;
  const LEAVES = 14;
  const TONES = ['#c4422b', '#d6683c', '#e2ad50', '#a8472a'];
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
    const sx = W * 0.64;
    const by = (x) => H * 0.86 - (x / W) * H * 0.2 + Math.sin(x / (U * 20)) * U * 0.8;
    return { W, H, U, sx, by, sy: by(sx) - U * 5.5 };
  }

  // ---- backdrop -------------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.H);
    const stops = ['#b9a97f', '#d2bb84', '#e0c68a', '#d8bc82', '#a99a72'].map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = (y / g.H) * (stops.length - 1);
      const k = Math.min(stops.length - 2, Math.floor(f));
      for (let x = 0; x < g.W; x++) {
        const ink = stops[k + (rand() < f - k ? 1 : 0)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function paintHills(ctx, g, rand) {
    const tones = ['#9ba48c', '#7f8e78', '#5f7566'];
    for (let n = 0; n < 3; n++) {
      ctx.fillStyle = tones[n];
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W + 3; x += 3) {
        ctx.lineTo(x, g.H * (0.42 + n * 0.09) + K.fbm(x / (g.U * 30), n * 3.1, 3, 7 + n) * g.H * 0.1);
      }
      ctx.lineTo(g.W, g.H);
      ctx.fill();
      ctx.fillStyle = n === 0 ? '#e0cf9c' : '#b7b58f';
      ctx.globalAlpha = 0.45;
      for (let i = 0; i < 4; i++) {
        blob(ctx, rand() * g.W, g.H * (0.5 + n * 0.09), g.U * (10 + rand() * 12), g.U * 1.1);
      }
      ctx.globalAlpha = 1;
    }
  }

  // A torii seen through autumn haze: two pillars, kasagi and nuki.
  function paintTorii(ctx, g) {
    const u = g.U;
    const x = g.W * 0.2;
    const y = g.H * 0.74;
    const hw = u * 10;
    const h = u * 26;
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = '#b4543a';
    ctx.fillRect(x - hw, y - h, u * 2.4, h);
    ctx.fillRect(x + hw - u * 2.4, y - h, u * 2.4, h);
    ctx.fillRect(x - hw - u * 1.2, y - h * 0.72, hw * 2 + u * 2.4, u * 1.6);
    ctx.fillStyle = '#3a3532';
    poly(ctx, [x - hw - u * 4, y - h - u * 0.5, x + hw + u * 4, y - h - u * 0.5, x + hw + u * 2.2, y - h + u * 2, x - hw - u * 2.2, y - h + u * 2]);
    ctx.fillStyle = '#b4543a';
    ctx.fillRect(x - hw - u * 1.6, y - h + u * 2, hw * 2 + u * 3.2, u * 1.4);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#d9c78f';
    ctx.globalAlpha = 0.5;
    blob(ctx, x, y - u * 2, u * 22, u * 4);
    ctx.globalAlpha = 1;
  }

  function momiji(ctx, x, y, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = rot + (i / 10) * TAU;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  // A maple branch hanging in from the upper right, out of focus.
  function paintMaple(ctx, g, rand) {
    const u = g.U;
    ctx.strokeStyle = '#4a382a';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, u * 1.3);
    ctx.beginPath();
    ctx.moveTo(g.W + u * 4, u * 6);
    ctx.quadraticCurveTo(g.W * 0.85, u * 10, g.W * 0.7, u * 20);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, u * 0.7);
    ctx.beginPath();
    ctx.moveTo(g.W * 0.9, u * 8);
    ctx.quadraticCurveTo(g.W * 0.92, u * 18, g.W * 0.88, u * 26);
    ctx.stroke();
    for (let i = 0; i < 46; i++) {
      const t = rand();
      const x = g.W * (0.68 + t * 0.34);
      const y = u * (6 + (1 - t) * 14 + rand() * 18);
      ctx.fillStyle = TONES[Math.floor(rand() * 3)];
      ctx.globalAlpha = 0.9;
      momiji(ctx, x, y, u * (2.2 + rand() * 2), rand() * TAU);
    }
    ctx.globalAlpha = 1;
  }

  function paintGinkgo(ctx, g, rand) {
    ctx.fillStyle = '#e2b84a';
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 18; i++) {
      blob(ctx, rand() * g.W * 0.55, rand() * g.H * 0.35, g.U * (1.4 + rand() * 1.6), g.U * (1 + rand() * 1.2), rand() * 3);
    }
    ctx.globalAlpha = 1;
  }

  // ---- bough, acorns, squirrel ---------------------------------------------

  function paintBough(ctx, g, rand) {
    const u = g.U;
    const th = u * 10;
    ctx.fillStyle = '#4a382a';
    ctx.beginPath();
    ctx.moveTo(-2, g.by(-2) - th * 0.5);
    for (let x = 0; x <= g.W + 4; x += 3) ctx.lineTo(x, g.by(x) - th * 0.5);
    for (let x = g.W + 4; x >= -2; x -= 3) ctx.lineTo(x, g.by(x) + th * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2c231c';
    for (let x = 0; x < g.W; x += 3) ctx.fillRect(x, g.by(x) + th * 0.12, 3, th * 0.38);
    ctx.fillStyle = '#6b523a';
    for (let i = 0; i < 40; i++) {
      const x = rand() * g.W;
      ctx.fillRect(x, g.by(x) - th * 0.2 + rand() * th * 0.4, u * (2 + rand() * 4), Math.max(1, u * 0.35));
    }
    for (let x = 0; x < g.W; x += u * (1.5 + rand() * 2)) {
      const y = g.by(x) - th * 0.5;
      ctx.fillStyle = '#4a6340';
      blob(ctx, x, y + u * 0.2, u * (1.8 + rand() * 2), u * (0.9 + rand() * 0.8));
      ctx.fillStyle = '#7a8f52';
      blob(ctx, x - u * 0.4, y - u * 0.3, u * (0.9 + rand()), u * 0.45);
    }
    ctx.fillStyle = '#9c8a50';
    for (let i = 0; i < 14; i++) {
      const x = rand() * g.W;
      blob(ctx, x, g.by(x) - th * 0.5 - u * 0.5, u * 0.5, u * 0.3);
    }
  }

  function acorn(ctx, x, y, s, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = '#a2724a';
    blob(ctx, 0, s * 0.3, s * 0.8, s * 1.1);
    ctx.fillStyle = '#c99a62';
    blob(ctx, -s * 0.2, s * 0.2, s * 0.3, s * 0.6);
    ctx.fillStyle = '#4a3322';
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.5, s * 0.95, s * 0.6, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillRect(-s * 0.1, -s * 1.3, s * 0.2, s * 0.4);
    ctx.restore();
  }

  function oakLeaf(ctx, x, y, s, rot, ink) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = ink;
    for (let i = -2; i <= 2; i++) blob(ctx, i * s * 0.55, Math.abs(i) * s * 0.12, s * 0.42, s * 0.55);
    ctx.restore();
  }

  function paintDetails(ctx, g, rand) {
    const u = g.U;
    const top = (x) => g.by(x) - u * 5;
    acorn(ctx, g.W * 0.36, top(g.W * 0.36) - u * 0.4, u * 1.5, 1.2);
    acorn(ctx, g.W * 0.42, top(g.W * 0.42) - u * 0.2, u * 1.4, -1.9);
    acorn(ctx, g.W * 0.88, top(g.W * 0.88) - u * 0.3, u * 1.5, 0.7);
    const inks = ['#c9a043', '#b8742f', '#a8472a', '#d6a64f'];
    [0.22, 0.31, 0.5, 0.82, 0.95].forEach((f, i) => {
      oakLeaf(ctx, g.W * f, top(g.W * f) - u * 0.2, u * 2, (rand() - 0.5) * 1.2, inks[i % 4]);
    });
  }

  function paintSquirrel(ctx, g) {
    const s = g.U;
    const x = g.sx;
    const y = g.sy;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#6e2a1c';
    blob(ctx, s * 1.5, -s * 3.4, s * 7, s * 5.4);
    ctx.fillStyle = '#a8472a';
    blob(ctx, 0, -s * 11, s * 6.4, s * 10, 0.18);
    ctx.fillStyle = '#c4622f';
    blob(ctx, s * 1.2, -s * 13, s * 3.6, s * 8, 0.18);
    ctx.fillStyle = '#e8dcc0';
    blob(ctx, -s * 4.2, -s * 10.5, s * 2.6, s * 6.2, 0.1);
    ctx.fillStyle = '#6e2a1c';
    blob(ctx, -s * 2, -s * 2.2, s * 4, s * 1.6);
    ctx.fillStyle = '#a8472a';
    blob(ctx, -s * 5.6, -s * 21.5, s * 4.7, s * 4.2);
    ctx.fillStyle = '#c4622f';
    blob(ctx, -s * 4.2, -s * 23, s * 2.6, s * 1.8);
    ctx.fillStyle = '#e8dcc0';
    blob(ctx, -s * 8, -s * 20, s * 2.1, s * 1.9);
    ctx.fillStyle = '#4a1d14';
    poly(ctx, [-s * 6, -s * 24, -s * 6.8, -s * 29.5, -s * 4.4, -s * 25.2]);
    poly(ctx, [-s * 3.2, -s * 24.4, -s * 1.8, -s * 30, -s * 1.2, -s * 24]);
    ctx.fillStyle = '#e0a45a';
    poly(ctx, [-s * 5.8, -s * 24.4, -s * 6.4, -s * 27.2, -s * 5, -s * 25]);
    ctx.fillStyle = '#1e1714';
    blob(ctx, -s * 6.6, -s * 22.2, Math.max(s * 0.9, 0.8), Math.max(s * 0.95, 0.9));
    ctx.fillStyle = '#f2ead4';
    blob(ctx, -s * 6.9, -s * 22.6, s * 0.3, s * 0.3);
    ctx.fillStyle = '#2a1a14';
    blob(ctx, -s * 10, -s * 19.8, s * 0.8, s * 0.7);
    ctx.fillStyle = '#7d3320';
    blob(ctx, -s * 6.6, -s * 12.5, s * 1.5, s * 1.4);
    blob(ctx, -s * 3.6, -s * 12.2, s * 1.4, s * 1.3);
    acorn(ctx, -s * 5.2, -s * 13.6, s * 1.5, 1.5);
    ctx.restore();
  }

  // ---- movers ---------------------------------------------------------------

  function makeSprites(g) {
    const r = Math.max(3, Math.round(g.U * 2.2));
    return TONES.map((tone) => {
      const c = layer(r * 2 + 2, r * 2 + 2);
      const cx = c.getContext('2d');
      cx.fillStyle = tone;
      momiji(cx, r + 1, r + 1, r, 0.3);
      return c;
    });
  }

  function makeLeaves() {
    return {
      x: new Float32Array(MAX_LEAVES), y: new Float32Array(MAX_LEAVES),
      a: new Float32Array(MAX_LEAVES), p: new Float32Array(MAX_LEAVES),
      v: new Float32Array(MAX_LEAVES), s: new Float32Array(MAX_LEAVES),
      tone: new Uint8Array(MAX_LEAVES),
    };
  }

  function resetLeaf(g, L, i, scatter) {
    const r = state.rand;
    L.x[i] = r() * g.W * 1.1;
    L.y[i] = scatter ? r() * g.H : -g.U * 4;
    L.a[i] = r() * TAU;
    L.p[i] = r() * TAU;
    L.v[i] = g.U * (5 + r() * 5);
    L.s[i] = 0.6 + r() * 0.7;
    L.tone[i] = Math.floor(r() * TONES.length);
  }

  function stepLeaf(g, L, i, t, dt) {
    L.y[i] += L.v[i] * dt;
    L.x[i] -= g.U * (1.5 + Math.sin(t * 0.5 + L.p[i])) * dt;
    L.a[i] += dt * 0.8;
    if (L.y[i] > g.H + g.U * 4 || L.x[i] < -g.U * 4) resetLeaf(g, L, i, false);
  }

  function drawLeaves(ctx, g, t, count) {
    const L = state.leaves;
    for (let i = 0; i < count; i++) {
      const c = Math.cos(L.a[i]) * L.s[i];
      const s = Math.sin(L.a[i]) * L.s[i];
      const sq = 0.45 + 0.55 * Math.abs(Math.sin(t * 1.6 + L.p[i]));
      const spr = state.sprites[L.tone[i]];
      ctx.setTransform(c, s * sq, -s, c * sq, L.x[i] + Math.sin(t * 0.9 + L.p[i]) * g.U, L.y[i]);
      ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawTail(ctx, g, t, sway) {
    const s = g.U;
    const bx = g.sx + s * 4;
    const by = g.sy - s * 4;
    const n = 9;
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? '#c4622f' : '#8a3a22';
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        const wave = Math.sin(t * 0.9 - f * 1.6) * sway * f * s * 3.2;
        const x = bx + s * (5 + 11 * Math.sin(f * 2.1)) + wave;
        const y = by - s * 26 * f * (1 - f * 0.18);
        const r = s * (3.4 + 4.6 * Math.sin(f * Math.PI * 0.85)) * (pass ? 0.62 : 1);
        blob(ctx, x - (pass ? s * 0.8 : 0), y, r, r * 1.15);
      }
    }
    ctx.fillStyle = '#e8c8a0';
    blob(ctx, bx + s * 6 + Math.sin(t * 0.9 - 1.6) * sway * s * 3.2, by - s * 25, s * 2.1, s * 2.4);
  }

  function drawLight(ctx, g, t, light) {
    if (light <= 0) return;
    ctx.fillStyle = '#f4dc9a';
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = (0.05 + 0.04 * Math.sin(t * 0.4 + i * 2)) * light;
      const x = g.W * (0.25 + i * 0.28) + Math.sin(t * 0.15 + i) * g.U * 3;
      poly(ctx, [x, 0, x + g.U * 9, 0, x - g.U * 14, g.H, x - g.U * 28, g.H]);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run ------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    const back = layer(g.W, g.H);
    const b = back.getContext('2d');
    paintSky(b, g, rand);
    paintGinkgo(b, g, rand);
    paintHills(b, g, rand);
    paintTorii(b, g);
    paintMaple(b, g, rand);
    state.back = back;
    const front = layer(g.W, g.H);
    const f = front.getContext('2d');
    paintBough(f, g, rand);
    paintDetails(f, g, rand);
    paintSquirrel(f, g);
    state.front = front;
    state.sprites = makeSprites(g);
    state.leaves = makeLeaves();
    for (let i = 0; i < MAX_LEAVES; i++) resetLeaf(g, state.leaves, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { leaves, tail, light } = api.props;
    const count = Math.min(MAX_LEAVES, Math.round(LEAVES * leaves));
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) stepLeaf(g, state.leaves, i, t, step);
    ctx.drawImage(state.back, 0, 0);
    drawLight(ctx, g, t, light);
    drawTail(ctx, g, t, tail);
    ctx.drawImage(state.front, 0, 0);
    drawLeaves(ctx, g, t, count);
  }

  Kasuri.run({
    defaults: { leaves: 1, tail: 1, light: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
