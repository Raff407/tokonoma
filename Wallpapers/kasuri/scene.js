/*
 * 絣 Kasuri — indigo ikat cloth with small white cross marks.
 *
 * The cross pattern is baked once as a tall tile. Each frame the tile is laid down in
 * narrow vertical bands, every band slid a little up or down against its neighbours, so
 * the threads seem to shift as they are woven. A pale sheen band drifts across the cloth.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const INDIGO = ['#1b2a4a', '#223457', '#2a3f66', '#1f3050'];
  const WASHI = '#e6dfca';
  const WASHI_SOFT = '#9ba3b0';
  const VERMILION = '#b8412c';
  const INK = '#12192b';
  const BANDS = 36;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const gap = Math.max(10, Math.round(Math.min(H * 0.13, W * 0.09)));
    const arm = Math.max(2, Math.round(gap * 0.26));
    return { W, H, gap, arm, period: gap * 2, margin: Math.max(3, Math.round(W * 0.03)) };
  }

  function cross(ctx, x, y, arm) {
    ctx.fillRect(x - arm, y, arm * 2 + 1, 1);
    ctx.fillRect(x, y - arm, 1, arm * 2 + 1);
  }

  // One tile, as wide as the cloth and two lattice rows tall, so it repeats cleanly.
  function paintTile(g, rand) {
    const c = layer(g.W, g.period);
    const ctx = c.getContext('2d');
    for (let x = 0; x < g.W; x++) {
      ctx.fillStyle = INDIGO[(x + (rand() < 0.15 ? 1 : 0)) % INDIGO.length];
      ctx.fillRect(x, 0, 1, g.period);
    }
    for (let x = 0; x < g.W; x += 3) {
      ctx.fillStyle = INDIGO[2];
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x, 0, 1, g.period);
    }
    ctx.globalAlpha = 1;
    const cols = Math.ceil(g.W / g.gap) + 1;
    for (let row = 0; row < 2; row++) {
      for (let i = -1; i < cols; i++) {
        const x = Math.round((i + (row ? 0.5 : 0)) * g.gap + g.gap * 0.5);
        const y = Math.round(row * g.gap + g.gap * 0.5);
        ctx.fillStyle = WASHI_SOFT;
        ctx.fillRect(x - g.arm - 1, y, g.arm * 2 + 3, 1);
        ctx.fillStyle = WASHI;
        cross(ctx, x, y, g.arm);
        ctx.fillStyle = WASHI_SOFT;
        ctx.fillRect(x - 1, y - g.arm, 1, g.arm * 2 + 1);
        ctx.fillRect(x + 1, y - g.arm, 1, g.arm * 2 + 1);
        ctx.fillStyle = WASHI;
        ctx.fillRect(x, y - g.arm, 1, g.arm * 2 + 1);
      }
    }
    return c;
  }

  function paintSheen(g) {
    const w = Math.max(8, Math.round(g.W * 0.35));
    const c = layer(w, 1);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(230,223,202,0)');
    grad.addColorStop(0.5, 'rgba(230,223,202,1)');
    grad.addColorStop(1, 'rgba(230,223,202,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, 1);
    return c;
  }

  function paintSelvedge(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const m = g.margin;
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, m, g.H);
    ctx.fillRect(g.W - m, 0, m, g.H);
    ctx.fillStyle = WASHI;
    ctx.fillRect(m, 0, 1, g.H);
    ctx.fillRect(g.W - m - 1, 0, 1, g.H);
    ctx.fillStyle = VERMILION;
    ctx.fillRect(m + 2, 0, 1, g.H);
    ctx.fillRect(g.W - m - 3, 0, 1, g.H);
    return c;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.tile = paintTile(g, rand);
    state.sheen = paintSheen(g);
    state.selvedge = paintSelvedge(g);
    state.phase = new Float32Array(BANDS);
    state.reach = new Float32Array(BANDS);
    for (let i = 0; i < BANDS; i++) {
      state.phase[i] = i * 0.42 + rand() * 0.5;
      state.reach[i] = 0.85 + rand() * 0.15;
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { sway, sheen } = api.props;
    const bw = g.W / BANDS;
    const P = g.period;
    for (let i = 0; i < BANDS; i++) {
      const sx = Math.floor(i * bw);
      const w = Math.floor((i + 1) * bw) - sx;
      const shift = Math.sin(t * 0.3 + state.phase[i]) * g.gap * 0.4 * state.reach[i] * sway;
      let y = -(((Math.round(shift) % P) + P) % P);
      for (; y < g.H; y += P) ctx.drawImage(state.tile, sx, 0, w, P, sx, y, w, P);
    }
    if (sheen > 0) {
      const sw = state.sheen.width;
      const span = g.W + sw * 2;
      const x = ((t * 6) % span) - sw;
      ctx.globalAlpha = 0.1 * sheen;
      ctx.drawImage(state.sheen, 0, 0, sw, 1, Math.round(x), 0, sw, g.H);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(state.selvedge, 0, 0);
  }

  Kasuri.run({
    defaults: { sway: 1, sheen: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
