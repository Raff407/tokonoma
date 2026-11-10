/*
 * 祥云 Xiangyun — auspicious clouds in layers, gold over indigo.
 *
 * The sky and a pale moon are baked once. Five bands of scrolled clouds are baked as
 * tileable strips, far ones small and dim, near ones large and gold. Each band slides
 * at its own pace and the near ones hide the far ones. A soft ring around the moon
 * breathes slowly.
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const SKY = ['#0f1a3c', '#16264f', '#1d3162'];
  const MOON = '#e8d6a0';
  const state = {};

  // fill, edge, scroll ink for each band from far to near
  const BANDS = [
    { fill: '#22346a', edge: '#3b4f88', curl: '#2d4177', y: 0.2, s: 0.55, v: 0.5, a: 0.5 },
    { fill: '#2a3f78', edge: '#5a6a96', curl: '#3b5188', y: 0.36, s: 0.78, v: -0.8, a: 0.5 },
    { fill: '#6e5a30', edge: '#b8963f', curl: '#8e7338', y: 0.54, s: 1.0, v: 1.0, a: 0.5 },
    { fill: '#9a7a35', edge: '#d9bb64', curl: '#b8963f', y: 0.72, s: 1.25, v: -1.35, a: 0.5 },
    { fill: '#c0993f', edge: '#ecd592', curl: '#8e6c2a', y: 0.9, s: 1.5, v: 1.8, a: 0.5 },
  ];

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function disc(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  // One cloud: a head of rounded lobes and a long tail sweeping to the left.
  function cloud(ctx, b, u, x, y) {
    const lobes = [[0, -1.2, 5.2], [-5.6, 0.6, 4.1], [5.6, 0.6, 4.1], [0, 2.4, 4.6]];
    const path = new Path2D();
    for (const [dx, dy, r] of lobes) {
      path.moveTo(x + (dx + r) * u, y + dy * u);
      path.arc(x + dx * u, y + dy * u, r * u, 0, TAU);
    }
    path.moveTo(x - 6 * u, y + 3.6 * u);
    path.bezierCurveTo(x - 12 * u, y + 7 * u, x - 18 * u, y + 2.5 * u, x - 25 * u, y + 5.5 * u);
    path.bezierCurveTo(x - 18 * u, y + 8.5 * u, x - 11 * u, y + 9 * u, x - 4 * u, y + 6.4 * u);
    ctx.fillStyle = b.fill;
    ctx.fill(path);
    ctx.strokeStyle = b.edge;
    ctx.lineWidth = Math.max(1, u * 0.55);
    ctx.lineJoin = 'round';
    ctx.stroke(path);
    ctx.strokeStyle = b.curl;
    ctx.lineWidth = Math.max(1, u * 0.45);
    ctx.lineCap = 'round';
    for (const [dx, dy, r] of lobes.slice(0, 3)) {
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) {
        const f = i / 16;
        const a = f * TAU * 1.2 + 0.5;
        const rr = r * u * 0.62 * (1 - f * 0.82);
        const px = x + dx * u + Math.cos(a) * rr;
        const py = y + dy * u + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x - 6 * u, y + 5.2 * u);
    ctx.bezierCurveTo(x - 11 * u, y + 7.4 * u, x - 16 * u, y + 4.6 * u, x - 21 * u, y + 6 * u);
    ctx.stroke();
  }

  function strip(g, b, k) {
    const u = g.U * b.s;
    const P = Math.round(u * (62 + k * 3));
    const h = Math.round(u * 20);
    const c = layer(P, h);
    const ctx = c.getContext('2d');
    for (const off of [-P, 0, P]) {
      cloud(ctx, b, u, off + P * 0.34, h * 0.34);
      cloud(ctx, b, u * 0.7, off + P * 0.86, h * 0.5);
    }
    return c;
  }

  function paintStill(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const gr = ctx.createLinearGradient(0, 0, 0, g.H);
    gr.addColorStop(0, SKY[0]);
    gr.addColorStop(0.55, SKY[1]);
    gr.addColorStop(1, SKY[2]);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, g.W, g.H);
    state.mx = g.W * 0.72;
    state.my = g.H * 0.22;
    state.mr = g.U * 7.5;
    ctx.fillStyle = MOON;
    disc(ctx, state.mx, state.my, state.mr);
    return c;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.still = paintStill(g);
    state.bands = BANDS.map((b, k) => ({ img: strip(g, b, k), y: Math.round(g.H * b.y - g.U * 8), v: b.v }));
  }

  function rowDraw(ctx, img, y, off, W) {
    const P = img.width;
    let x = -(((off % P) + P) % P);
    for (; x < W; x += P) ctx.drawImage(img, Math.round(x), y);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { drift, glow } = api.props;
    ctx.drawImage(state.still, 0, 0);
    if (glow > 0) {
      const k = 0.5 + 0.5 * Math.sin(t * 0.35);
      ctx.fillStyle = MOON;
      ctx.globalAlpha = Math.min(1, glow) * (0.05 + 0.05 * k);
      disc(ctx, state.mx, state.my, state.mr * (1.5 + 0.3 * k));
      ctx.globalAlpha = 1;
    }
    const off = t * g.U * 1.4 * drift;
    for (const b of state.bands) rowDraw(ctx, b.img, b.y, off * b.v, g.W);
  }

  Kasuri.run({
    defaults: { drift: 1, glow: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
