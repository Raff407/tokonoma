/*
 * 温泉 Onsen — snow monkeys soaking in a hot spring while it snows.
 *
 * Rocks, drifts and water are baked. Three monkeys sit up to their shoulders,
 * eyes shut, breathing; one slowly nods off and catches itself. Steam is a soft
 * texture rising past them and the snow falls through it.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const FUR = '#a59584';
  const FUR_DARK = '#7a6c5e';
  const FACE = '#c9786a';
  const MAX_FLAKES = 500;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintRock(ctx, g, rand, x, y, r) {
    ctx.fillStyle = '#44403d';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.7, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#6b6661';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.2, y - r * 0.1, r * 0.55, r * 0.34, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#e4e7ea';
    ctx.beginPath();
    ctx.ellipse(x, y - r * 0.5, r * 0.72, r * 0.22, 0, 0, 6.3);
    ctx.fill();
  }

  function paintWorld(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const back = ctx.createLinearGradient(0, 0, 0, g.H * 0.5);
    back.addColorStop(0, '#54606f');
    back.addColorStop(1, '#a4adb7');
    ctx.fillStyle = back;
    ctx.fillRect(0, 0, g.W, g.H);
    for (let i = 0; i < g.W * 0.2; i++) {
      const x = rand() * g.W;
      const h = g.U * (10 + rand() * 20);
      const y = g.H * (0.34 + rand() * 0.12);
      ctx.fillStyle = '#2b3638';
      ctx.fillRect(x - 0.5, y - h * 0.2, Math.max(1, g.U * 0.6), h * 0.4);
      for (let k = 0; k < 3; k++) {
        const w = h * (0.28 - k * 0.06);
        const top = y - h * (0.38 + k * 0.22);
        ctx.fillStyle = '#2b3638';
        ctx.beginPath();
        ctx.moveTo(x - w, top + h * 0.28);
        ctx.lineTo(x, top);
        ctx.lineTo(x + w, top + h * 0.28);
        ctx.fill();
        ctx.fillStyle = '#d7dce2';
        ctx.fillRect(x - w * 0.5, top + h * 0.1, w, Math.max(1, h * 0.05));
      }
    }
    ctx.fillStyle = '#dfe3e7';
    ctx.fillRect(0, g.H * 0.45, g.W, g.H * 0.55);
    const pool = ctx.createLinearGradient(0, g.H * 0.52, 0, g.H);
    pool.addColorStop(0, '#6d9ca3');
    pool.addColorStop(1, '#2f5c67');
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.ellipse(g.W * 0.5, g.H * 0.8, g.W * 0.52, g.H * 0.28, 0, 0, 6.3);
    ctx.fill();
    return c;
  }

  function paintRim(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 26; i++) {
      const a = 3.14 + (i / 25) * 3.14;
      const x = g.W * 0.5 + Math.cos(a) * g.W * 0.52;
      const y = g.H * 0.8 + Math.sin(a) * g.H * 0.28;
      paintRock(ctx, g, rand, x, y, g.U * (5 + rand() * 4));
    }
    paintRock(ctx, g, rand, g.W * 0.05, g.H * 0.98, g.U * 16);
    paintRock(ctx, g, rand, g.W * 0.95, g.H * 0.95, g.U * 18);
    return c;
  }

  function paintRipples(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.05, y * 0.4, 3, 6);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 210;
        img.data[i + 3] = smoothstep(0.55, 0.72, v) * 90;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Tiles upward: wisps climbing off the water.
  function paintSteam(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.045, y * 0.025, 4, 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = lerp(density(x, y), density(x, y - h), y / h);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 236;
        img.data[i + 3] = smoothstep(0.44, 0.7, a) * 170;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMonkey(ctx, g, m, t) {
    const u = m.size;
    const breath = Math.sin(t * 0.9 + m.phase) * u * 0.1;
    const nod = m.dozes ? K.smoothstep(0.55, 0.9, (t * 0.06 + m.phase) % 1) * 0.5 : 0;
    ctx.save();
    ctx.translate(m.x, m.y + breath);
    ctx.fillStyle = FUR;
    ctx.beginPath();
    ctx.ellipse(0, u * 2, u * 9, u * 8, 0, 3.14, 6.29);
    ctx.fill();
    ctx.translate(0, -u * 6.5);
    ctx.rotate(m.lean + nod * m.side);
    ctx.translate(0, nod * u * 1.6);
    ctx.fillStyle = FUR;
    ctx.beginPath();
    ctx.arc(0, -u * 1.5, u * 6.2, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = FUR_DARK;
    ctx.beginPath();
    ctx.arc(-u * 5.8, -u * 1.5, u * 1.5, 0, 6.3);
    ctx.arc(u * 5.8, -u * 1.5, u * 1.5, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#f2f3f4';
    ctx.beginPath();
    ctx.ellipse(0, -u * 7, u * 3.4, u * 1.2, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = FACE;
    ctx.beginPath();
    ctx.ellipse(-u * 1.5, -u * 2.2, u * 2, u * 1.7, 0, 0, 6.3);
    ctx.ellipse(u * 1.5, -u * 2.2, u * 2, u * 1.7, 0, 0, 6.3);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, u * 0.4, u * 2.9, u * 2.3, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#2c2422';
    ctx.fillRect(-u * 2.6, -u * 2.3, u * 2, Math.max(1, u * 0.4));
    ctx.fillRect(u * 0.6, -u * 2.3, u * 2, Math.max(1, u * 0.4));
    ctx.fillRect(-u * 1, u * 1.1, u * 2, Math.max(1, u * 0.35));
    ctx.restore();
    ctx.fillStyle = '#c6dcdd';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(m.x - u * 10, m.y + u * 2 + breath, u * 20, Math.max(1, u * 0.5));
    ctx.globalAlpha = 1;
  }

  function resetFlake(g, i, anywhere) {
    const r = state.rand;
    state.fx[i] = r() * g.W;
    state.fy[i] = anywhere ? r() * g.H : -2;
    state.fv[i] = g.U * (3 + (i % 3) * 3 + r() * 2);
    state.fp[i] = r() * 6.28;
  }

  function drawSnow(ctx, g, t, dt, amount) {
    const count = Math.min(MAX_FLAKES, Math.round(g.W * 1.4 * amount));
    ctx.fillStyle = '#f4f6f8';
    for (let i = 0; i < count; i++) {
      state.fy[i] += state.fv[i] * dt;
      state.fx[i] += Math.sin(t * 0.7 + state.fp[i]) * g.U * 1.6 * dt;
      if (state.fy[i] > g.H) resetFlake(g, i, false);
      ctx.globalAlpha = 0.45 + (i % 3) * 0.25;
      ctx.fillRect(state.fx[i], state.fy[i], 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.world = paintWorld(g, rand);
    state.rim = paintRim(g, rand);
    state.ripples = paintRipples(Math.ceil(g.W * 1.2), Math.ceil(g.H * 0.42));
    state.steam = paintSteam(Math.ceil(g.W), Math.ceil(g.H));
    const s = g.U * 1.25;
    state.monkeys = [
      { x: g.W * 0.33, y: g.H * 0.72, size: s * 0.9, lean: -0.08, side: 1, phase: 0.1, dozes: false },
      { x: g.W * 0.5, y: g.H * 0.8, size: s * 1.2, lean: 0.02, side: 1, phase: 0.45, dozes: true },
      { x: g.W * 0.67, y: g.H * 0.73, size: s, lean: 0.1, side: -1, phase: 0.8, dozes: false },
    ];
    state.fx = new Float32Array(MAX_FLAKES);
    state.fy = new Float32Array(MAX_FLAKES);
    state.fv = new Float32Array(MAX_FLAKES);
    state.fp = new Float32Array(MAX_FLAKES);
    for (let i = 0; i < MAX_FLAKES; i++) resetFlake(g, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    ctx.drawImage(state.world, 0, 0);
    const rw = state.ripples.width;
    const rx = -((t * g.U * 1.1) % rw);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(g.W * 0.5, g.H * 0.8, g.W * 0.52, g.H * 0.28, 0, 0, 6.3);
    ctx.clip();
    ctx.drawImage(state.ripples, rx, g.H * 0.56);
    ctx.drawImage(state.ripples, rx + rw, g.H * 0.56);
    ctx.restore();
    for (const m of state.monkeys) drawMonkey(ctx, g, m, t);
    ctx.drawImage(state.rim, 0, 0);
    const sh = state.steam.height;
    const sy = -((t * g.U * 4 * props.steam) % sh);
    ctx.globalAlpha = Math.min(1, 0.32 * props.steam);
    ctx.drawImage(state.steam, 0, sy);
    ctx.drawImage(state.steam, 0, sy + sh);
    ctx.globalAlpha = 1;
    drawSnow(ctx, g, t, dt, props.snow);
  }

  Kasuri.run({
    defaults: { snow: 1, steam: 1, ramp: 'lines', cell: 7, boost: 0.1, gain: 0.95, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
