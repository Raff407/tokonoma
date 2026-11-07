/*
 * 竹 Take — a bamboo grove in steady rain.
 *
 * The far stalks and the mist are one baked layer. The near stalks sway from
 * the root, so the tops move most, and the rain is a few hundred thin rects
 * that break into small splashes on the moss.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, parseColor: P, mixColor, toHex } = K;

  const MIST_TOP = P('#1e2f2a');
  const MIST_MID = P('#6e8878');
  const STALK = P('#2f4f38');
  const STALK_LIGHT = '#6f9a68';
  const STALK_DARK = '#16261c';
  const LEAF = '#3f6a44';
  const RAIN_FAR = '#8fa9a0';
  const RAIN_NEAR = '#c3d3cc';
  const MAX_DROPS = 900;
  const MAX_SPLASH = 48;

  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintFarStalks(ctx, g, rand) {
    for (let band = 0; band < 3; band++) {
      const fog = 0.82 - band * 0.2;
      const colour = toHex(mixColor(STALK, MIST_MID, fog));
      const count = Math.round(g.W / (9 - band));
      ctx.strokeStyle = colour;
      for (let i = 0; i < count; i++) {
        const x = rand() * g.W;
        ctx.lineWidth = g.U * (0.7 + band * 0.45);
        ctx.beginPath();
        ctx.moveTo(x, g.H);
        ctx.lineTo(x + (rand() - 0.5) * g.U * 7, 0);
        ctx.stroke();
      }
    }
  }

  function paintLantern(ctx, g) {
    const x = g.W * 0.7;
    const y = g.H * 0.88;
    const u = g.U;
    ctx.fillStyle = '#2b312d';
    ctx.fillRect(x - u * 1.2, y - u * 9, u * 2.4, u * 9);
    ctx.fillRect(x - u * 3, y - u * 15, u * 6, u * 1.2);
    ctx.fillRect(x - u * 2, y - u * 14, u * 4, u * 5);
    ctx.fillStyle = '#d9a95f';
    ctx.fillRect(x - u * 1.1, y - u * 13.2, u * 2.2, u * 3.2);
    ctx.fillStyle = '#39423c';
    ctx.beginPath();
    ctx.moveTo(x - u * 4.4, y - u * 15);
    ctx.lineTo(x, y - u * 19);
    ctx.lineTo(x + u * 4.4, y - u * 15);
    ctx.fill();
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H);
    grad.addColorStop(0, toHex(MIST_TOP));
    grad.addColorStop(0.62, toHex(MIST_MID));
    grad.addColorStop(1, toHex(mixColor(MIST_MID, MIST_TOP, 0.5)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    paintFarStalks(ctx, g, rand);
    const moss = ctx.createLinearGradient(0, g.H * 0.82, 0, g.H);
    moss.addColorStop(0, '#34493a');
    moss.addColorStop(1, '#18241c');
    ctx.fillStyle = moss;
    ctx.fillRect(0, g.H * 0.86, g.W, g.H * 0.14);
    paintLantern(ctx, g);
    return c;
  }

  function makeStalk(g, rand, x, near) {
    const nodes = [];
    for (let y = g.H * (0.04 + rand() * 0.08); y < g.H; y += g.U * (10 + rand() * 4)) nodes.push(y);
    const leaves = [];
    const sprays = 3 + Math.floor(rand() * 4);
    for (let i = 0; i < sprays; i++) {
      const side = rand() < 0.5 ? -1 : 1;
      leaves.push({
        y: g.H * rand() * 0.45,
        dx: side * g.U * (5 + rand() * 7),
        dy: g.U * (1 + rand() * 4),
        phase: rand() * 6.28,
      });
    }
    return {
      x,
      w: g.U * lerp(1.6, 3.2, near),
      lean: (rand() - 0.5) * g.U * 8,
      phase: rand() * 6.28,
      nodes,
      leaves,
      body: toHex(mixColor(STALK, MIST_MID, (1 - near) * 0.45)),
    };
  }

  function makeStalks(g, rand) {
    const stalks = [];
    const count = Math.max(8, Math.round(g.W / (g.U * 13)));
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.2 + rand() * 0.6) / count) * g.W;
      stalks.push(makeStalk(g, rand, x, rand()));
    }
    return stalks.sort((a, b) => a.w - b.w);
  }

  function drawStalk(ctx, g, s, t, wind) {
    const sway = wind * g.U * (Math.sin(t * 0.7 + s.phase) * 1.4 + Math.sin(t * 1.9 + s.phase * 2) * 0.45);
    const at = (y) => {
      const up = 1 - y / g.H;
      return s.x + s.lean * up + sway * up * up;
    };
    ctx.beginPath();
    ctx.moveTo(at(g.H), g.H);
    for (let k = 5; k >= 0; k--) ctx.lineTo(at((g.H * k) / 6), (g.H * k) / 6);
    ctx.lineCap = 'butt';
    ctx.strokeStyle = s.body;
    ctx.lineWidth = s.w;
    ctx.stroke();
    ctx.fillStyle = STALK_LIGHT;
    ctx.globalAlpha = 0.65;
    for (let k = 0; k < 6; k++) {
      const y = (g.H * k) / 6;
      ctx.fillRect(at(y + g.H / 12) - s.w * 0.3, y, Math.max(1, s.w * 0.24), g.H / 6);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = STALK_DARK;
    for (const y of s.nodes) ctx.fillRect(at(y) - s.w * 0.62, y, s.w * 1.24, Math.max(1, g.U * 0.6));
    ctx.strokeStyle = LEAF;
    ctx.lineWidth = Math.max(1, g.U * 0.7);
    ctx.beginPath();
    for (const leaf of s.leaves) {
      const x = at(leaf.y);
      const droop = Math.sin(t * 1.1 + leaf.phase) * g.U * 0.9 * wind;
      ctx.moveTo(x, leaf.y);
      ctx.lineTo(x + leaf.dx, leaf.y + leaf.dy + droop);
      ctx.moveTo(x, leaf.y);
      ctx.lineTo(x + leaf.dx * 0.7, leaf.y + leaf.dy * 2 + droop);
    }
    ctx.stroke();
  }

  function resetDrop(g, i, anywhere) {
    const r = state.rand;
    const near = r();
    state.xs[i] = r() * g.W * 1.2 - g.W * 0.1;
    state.ys[i] = anywhere ? r() * g.H : -r() * g.H * 0.2;
    state.vs[i] = g.U * lerp(55, 95, near);
    state.ls[i] = Math.max(2, g.U * lerp(1.6, 3.6, near));
  }

  function drawRain(ctx, g, dt, props) {
    const count = Math.min(MAX_DROPS, Math.round((props.rain * g.W * g.H) / 90));
    const drift = props.wind * g.U * 5 * dt;
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? RAIN_NEAR : RAIN_FAR;
      ctx.globalAlpha = pass ? 0.75 : 0.45;
      for (let i = pass; i < count; i += 2) {
        state.ys[i] += state.vs[i] * dt;
        state.xs[i] += drift;
        if (state.ys[i] > g.H * 0.87 + (i % 7) * g.U * 1.6) {
          addSplash(state.xs[i], state.ys[i]);
          resetDrop(g, i, false);
        }
        ctx.fillRect(state.xs[i], state.ys[i], 1, state.ls[i]);
      }
    }
    ctx.globalAlpha = 1;
  }

  function addSplash(x, y) {
    if (state.rand() > 0.25) return;
    const n = state.splashAt++ % MAX_SPLASH;
    state.sx[n] = x;
    state.sy[n] = y;
    state.sl[n] = 1;
  }

  function drawSplashes(ctx, g, dt) {
    ctx.fillStyle = RAIN_NEAR;
    for (let i = 0; i < MAX_SPLASH; i++) {
      if (state.sl[i] <= 0) continue;
      state.sl[i] -= dt * 3.5;
      const grow = (1 - state.sl[i]) * g.U * 3;
      ctx.globalAlpha = Math.max(0, state.sl[i]) * 0.7;
      ctx.fillRect(state.sx[i] - grow, state.sy[i], 1 + grow * 2, 1);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.stalks = makeStalks(g, rand);
    state.xs = new Float32Array(MAX_DROPS);
    state.ys = new Float32Array(MAX_DROPS);
    state.vs = new Float32Array(MAX_DROPS);
    state.ls = new Float32Array(MAX_DROPS);
    for (let i = 0; i < MAX_DROPS; i++) resetDrop(g, i, true);
    state.sx = new Float32Array(MAX_SPLASH);
    state.sy = new Float32Array(MAX_SPLASH);
    state.sl = new Float32Array(MAX_SPLASH);
    state.splashAt = 0;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    ctx.drawImage(state.back, 0, 0);
    for (const s of state.stalks) drawStalk(ctx, g, s, t, props.wind);
    drawRain(ctx, g, dt, props);
    drawSplashes(ctx, g, dt);
  }

  Kasuri.run({
    defaults: { rain: 1, wind: 1, ramp: 'lines', cell: 8, boost: 0.25, gain: 1.15 },
    maxFps: 24,
    setup,
    draw,
  });
})();
