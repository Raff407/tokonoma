/*
 * A starter scene: fireflies over a rice field at dusk.
 *
 * Paint one pixel per cell into ctx (api.cols × api.rows); kasuri weaves it.
 * Keep still things in cached layers, move only what moves, and stay inside
 * the ink palette. Run the checks with the tokonoma_check tool as you go.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, parseColor: P } = K;

  const SKY_TOP = P('#141a33');
  const SKY_LOW = P('#5c3f5e');
  const FIELD = P('#16241a');
  const GLOW = P('#e9f29a');

  const state = { flies: [], still: null };
  const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  function paintStill(api) {
    const c = document.createElement('canvas');
    c.width = api.cols;
    c.height = api.rows;
    const ctx = c.getContext('2d');
    const horizon = api.rows * 0.62;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, rgb(SKY_TOP));
    sky.addColorStop(1, rgb(SKY_LOW));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, api.cols, horizon);
    ctx.fillStyle = rgb(FIELD);
    ctx.beginPath();
    ctx.moveTo(0, api.rows);
    for (let x = 0; x <= api.cols; x++) ctx.lineTo(x, horizon - fbm(x * 0.03, 1, 3) * 6);
    ctx.lineTo(api.cols, api.rows);
    ctx.fill();
    return c;
  }

  function setup(ctx, api) {
    state.still = paintStill(api);
    const rand = K.rng(api.seed);
    state.flies = Array.from({ length: 120 }, () => ({
      x: rand() * api.cols,
      y: lerp(0.55, 1, rand()) * api.rows,
      phase: rand() * 6.28,
    }));
  }

  function draw(ctx, t, dt, api) {
    ctx.drawImage(state.still, 0, 0);
    const shown = state.flies.slice(0, api.props.count);
    for (const f of shown) {
      f.x += Math.sin(t * 0.4 + f.phase) * dt * 1.2;
      f.y += Math.cos(t * 0.3 + f.phase * 1.3) * dt * 0.8;
      const glow = Math.max(0, Math.sin(t * 1.2 + f.phase * 3));
      if (glow < 0.05) continue;
      ctx.fillStyle = rgb(GLOW, glow);
      ctx.fillRect(f.x | 0, f.y | 0, 1, 1);
    }
  }

  Kasuri.run({
    defaults: { count: 40, ramp: 'lines', cell: 9 },
    maxFps: 24,
    setup,
    draw,
  });
})();
