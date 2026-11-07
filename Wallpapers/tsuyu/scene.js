/*
 * 露 Tsuyu — a spider's web hung with dew at dawn.
 *
 * The threads are baked and the whole web sways as one image. Dew is a typed
 * list of points on those threads, and a soft band of light travels across
 * them so each drop catches and lets go in turn. The spider stays home.
 */
(function () {
  'use strict';

  const K = KasuriCore;

  const RADII = 22;
  const TURNS = 19;
  const MAX_DEW = 900;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintBokeh(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, g.W, g.H);
    grad.addColorStop(0, '#54714e');
    grad.addColorStop(0.5, '#2f4a3a');
    grad.addColorStop(1, '#1d3330');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    const inks = ['#6f8f5a', '#3e6146', '#a3a267', '#26423a'];
    for (let i = 0; i < 46; i++) {
      const x = rand() * g.W;
      const y = rand() * g.H;
      const r = g.U * (4 + rand() * 13);
      const blob = ctx.createRadialGradient(x, y, 0, x, y, r);
      const [cr, cg, cb] = K.parseColor(inks[Math.floor(rand() * inks.length)]);
      blob.addColorStop(0, `rgba(${cr},${cg},${cb},0.55)`);
      blob.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = blob;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return c;
  }

  function rimRadius(k, reach) {
    return reach * (0.82 + 0.18 * Math.sin(k * 2.1) * Math.cos(k * 0.7));
  }

  // Spiral points as [x, y] per turn and spoke; they sag between spokes in drawing.
  function webPoint(cx, cy, reach, turn, k) {
    const a = (k / RADII) * 6.283;
    const r = rimRadius(k, reach) * (0.09 + (turn / TURNS) * 0.91);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.92];
  }

  function paintWeb(g, rand) {
    const margin = g.U * 8;
    const c = layer(g.W + margin * 2, g.H + margin * 2);
    const ctx = c.getContext('2d');
    const cx = c.width * 0.5;
    const cy = c.height * 0.48;
    const reach = g.U * 52;
    ctx.strokeStyle = 'rgba(214,220,210,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < RADII; k++) {
      const end = webPoint(cx, cy, reach, TURNS, k);
      ctx.moveTo(cx, cy);
      ctx.lineTo(end[0], end[1]);
    }
    // Anchor threads run off the edge of the picture.
    for (const [ax, ay] of [[0, 0], [c.width, g.U * 4], [c.width, c.height], [g.U * 6, c.height]]) {
      const k = Math.floor(rand() * RADII);
      const end = webPoint(cx, cy, reach, TURNS, k);
      ctx.moveTo(end[0], end[1]);
      ctx.lineTo(ax, ay);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(214,220,210,0.42)';
    ctx.beginPath();
    for (let turn = 2; turn <= TURNS; turn++) {
      for (let k = 0; k < RADII; k++) {
        const a = webPoint(cx, cy, reach, turn, k);
        const b = webPoint(cx, cy, reach, turn, (k + 1) % RADII);
        const mx = (a[0] + b[0]) / 2 + (cx - (a[0] + b[0]) / 2) * 0.09;
        const my = (a[1] + b[1]) / 2 + (cy - (a[1] + b[1]) / 2) * 0.09;
        ctx.moveTo(a[0], a[1]);
        ctx.quadraticCurveTo(mx, my, b[0], b[1]);
      }
    }
    ctx.stroke();
    ctx.fillStyle = '#20191b';
    ctx.beginPath();
    ctx.ellipse(cx, cy, g.U * 1.4, g.U * 2, 0, 0, 6.3);
    ctx.fill();
    placeDew(rand, cx - margin, cy - margin, reach);
    return { canvas: c, margin };
  }

  function placeDew(rand, cx, cy, reach) {
    const dew = { x: new Float32Array(MAX_DEW), y: new Float32Array(MAX_DEW), s: new Float32Array(MAX_DEW), p: new Float32Array(MAX_DEW) };
    for (let i = 0; i < MAX_DEW; i++) {
      const turn = 2 + Math.floor(rand() * (TURNS - 1));
      const k = Math.floor(rand() * RADII);
      const f = rand();
      const a = webPoint(cx, cy, reach, turn, k);
      const b = webPoint(cx, cy, reach, turn, (k + 1) % RADII);
      dew.x[i] = a[0] + (b[0] - a[0]) * f;
      dew.y[i] = a[1] + (b[1] - a[1]) * f;
      dew.s[i] = rand() < 0.12 ? 2 : 1;
      dew.p[i] = rand() * 6.28;
    }
    state.dew = dew;
  }

  function drawDew(ctx, g, t, sx, sy, sweep) {
    const d = state.dew;
    const band = (t * 0.09 * sweep) % 1.4 - 0.2;
    ctx.fillStyle = '#f1f2e4';
    for (let i = 0; i < MAX_DEW; i++) {
      const x = d.x[i];
      const y = d.y[i];
      const place = (x / g.W + y / g.H) * 0.5;
      const gap = Math.abs(place - band);
      const lit = gap < 0.14 ? 1 - gap / 0.14 : 0;
      const twinkle = 0.5 + 0.5 * Math.sin(t * 1.2 + d.p[i]);
      ctx.globalAlpha = 0.34 + lit * 0.66 + twinkle * 0.12;
      ctx.fillRect(x + sx, y + sy, d.s[i], d.s[i]);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.bokeh = paintBokeh(g, rand);
    state.web = paintWeb(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    const sx = Math.sin(t * 0.4) * g.U * 0.9 * props.breeze;
    const sy = Math.sin(t * 0.27 + 1) * g.U * 0.6 * props.breeze;
    ctx.drawImage(state.bokeh, 0, 0);
    ctx.drawImage(state.web.canvas, sx - state.web.margin, sy - state.web.margin);
    drawDew(ctx, g, t, sx, sy, props.light);
  }

  Kasuri.run({
    defaults: { breeze: 1, light: 1, ramp: 'lines', cell: 6, boost: 0.15, gain: 1.05, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
