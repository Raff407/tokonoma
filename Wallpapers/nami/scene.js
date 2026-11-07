/*
 * 青海波 Nami — the overlapping-scale wave pattern, breathing like a real sea.
 *
 * Which scallop and ring every cell belongs to is worked out once and kept in
 * two typed arrays. Each draw computes one swell value per scallop, then a
 * single loop over the cells reads a colour from a table. No paths, no
 * allocation, so the whole grid costs well under a millisecond.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { parseColor: P, mixColor } = K;

  const INKS = {
    ai: ['#0c1a33', '#1c3d6b', '#5f88a8', '#dfe4d8'],
    sumi: ['#100f10', '#34343a', '#7d7f84', '#e4dfd2'],
    shu: ['#2a0f10', '#7a2a22', '#c4603f', '#ecdcc2'],
    moss: ['#0e1b16', '#2c4a38', '#6f8f6c', '#e3e2c8'],
  };
  const RINGS = 5;
  const STEPS = 256;

  const state = {};

  // Little-endian ABGR, as an ImageData seen through a Uint32Array.
  function makeTable(stops) {
    const table = new Uint32Array(STEPS);
    const cols = stops.map(P);
    for (let i = 0; i < STEPS; i++) {
      const f = (i / (STEPS - 1)) * (cols.length - 1);
      const k = Math.min(cols.length - 2, Math.floor(f));
      const c = mixColor(cols[k], cols[k + 1], f - k);
      table[i] = (255 << 24) | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0]);
    }
    return table;
  }

  function buildScallops(g, radius) {
    const stepY = radius * 0.5;
    const rows = Math.ceil(g.H / stepY) + 4;
    const perRow = Math.ceil(g.W / (radius * 2)) + 3;
    const owner = new Int32Array(g.W * g.H).fill(-1);
    const ring = new Uint8Array(g.W * g.H);
    const centres = new Float32Array(rows * perRow * 2);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < perRow; c++) {
        const id = r * perRow + c;
        const cx = c * radius * 2 + (r % 2 ? radius : 0) - radius;
        const cy = r * stepY;
        centres[id * 2] = cx;
        centres[id * 2 + 1] = cy;
        stampScallop(g, owner, ring, id, cx, cy, radius);
      }
    }
    return { owner, ring, centres, count: rows * perRow, swell: new Float32Array(rows * perRow) };
  }

  function stampScallop(g, owner, ring, id, cx, cy, radius) {
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(g.W - 1, Math.ceil(cx + radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const y1 = Math.min(g.H - 1, Math.ceil(cy));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy) / radius;
        if (d > 1) continue;
        const i = y * g.W + x;
        owner[i] = id;
        ring[i] = Math.min(RINGS - 1, Math.floor(d * RINGS));
      }
    }
  }

  function updateSwell(s, g, t, props) {
    const a = 0.9 * props.swell;
    const k1 = 5.2 / g.W;
    const k2 = 11 / g.H;
    for (let id = 0; id < s.count; id++) {
      const x = s.centres[id * 2];
      const y = s.centres[id * 2 + 1];
      const big = Math.sin(x * k1 + y * k2 * 0.6 - t * 0.55 * a);
      const small = Math.sin(x * k1 * 2.3 - y * k2 * 0.9 + t * 0.34 * a + 1.3);
      s.swell[id] = 0.5 + 0.34 * big + 0.16 * small;
    }
  }

  function paint(ctx, g, s, t) {
    const px = state.pixels;
    const { owner, ring, swell } = s;
    const table = state.table;
    const shift = t * 0.8;
    // Ring brightness: outermost band is pale, the rest step down inward.
    const band = state.band;
    for (let r = 0; r < RINGS; r++) band[r] = 0.5 + 0.5 * Math.sin(r * 1.6 - shift);
    const n = g.W * g.H;
    for (let i = 0; i < n; i++) {
      const id = owner[i];
      if (id < 0) continue;
      const r = ring[i];
      const edge = r === RINGS - 1 ? 0.22 : 0;
      const v = swell[id] * (0.54 + 0.3 * band[r]) + edge + (r / RINGS) * 0.14;
      px[i] = table[v > 1 ? STEPS - 1 : (v * (STEPS - 1)) | 0];
    }
    ctx.putImageData(state.image, 0, 0);
  }

  function setInk(name) {
    state.ink = name;
    state.table = makeTable(INKS[name] || INKS.ai);
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.image = ctx.createImageData(g.W, g.H);
    state.pixels = new Uint32Array(state.image.data.buffer);
    state.band = new Float32Array(RINGS);
    state.scallops = buildScallops(g, Math.max(6, g.U * 9));
    setInk(api.props.ink);
  }

  function draw(ctx, t, dt, api) {
    if (state.ink !== api.props.ink) setInk(api.props.ink);
    updateSwell(state.scallops, state.g, t, api.props);
    paint(ctx, state.g, state.scallops, t);
  }

  Kasuri.run({
    defaults: { ink: 'ai', swell: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.05, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
