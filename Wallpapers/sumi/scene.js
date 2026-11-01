/*
 * 墨流し Sumi — ink floated on still water, lifted onto washi.
 *
 * Drops land one after another at the same spot, ink then clear water, so
 * rings grow outward and push every earlier ring along. Now and then the
 * brush moves somewhere else. A slow current folds it all, and dragging the
 * cursor across the desktop combs the surface like a fan.
 *
 * Built to stay light: ring points live in Float32Arrays edited in place,
 * the current is a coarse velocity grid refreshed twice a second and sampled
 * bilinearly, and the scene asks for 20fps because ink never moves faster.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const M = Marble;
  const { lerp, noise2, fbm } = K;

  const PAPER = '#ece5d5';
  const INKS = {
    sumi: ['#1c1a19'],
    ai: ['#1c1a19', '#23406b'],
    beni: ['#1c1a19', '#a5392a'],
    mixed: ['#1c1a19', '#23406b', '#a5392a', '#3b5a45'],
  };
  const MAX_RINGS = 120;
  const MAX_POINTS = 6000;
  const RING_BUDGET = 500;
  const GRID = 4; // cells per flow-grid step

  const state = { rings: [], base: PAPER, last: null, flow: null };

  function paperTexture(g, seed) {
    const c = document.createElement('canvas');
    c.width = g.W;
    c.height = g.H;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    for (let y = 0; y < g.H; y++) {
      for (let x = 0; x < g.W; x++) {
        // Long horizontal fibres plus a little blotchiness.
        const fibre = fbm(x * 0.02, y * 0.6, 3, seed);
        const blot = fbm(x * 0.05, y * 0.05, 2, seed + 7);
        const v = (fibre - 0.5) * 0.7 + (blot - 0.5) * 0.3;
        const i = (y * g.W + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v > 0 ? 255 : 0;
        img.data[i + 3] = Math.abs(v) * 90;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function pickCentre(g, rand) {
    return { x: lerp(0.12, 0.88, rand()) * g.W, y: lerp(0.15, 0.85, rand()) * g.H };
  }

  function makeRing(cx, cy, r, colour) {
    const n = Math.max(24, Math.round(r * 6));
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      xs[i] = cx + Math.cos(a) * r;
      ys[i] = cy + Math.sin(a) * r;
    }
    return { xs, ys, n, colour };
  }

  function addDrop(g, props) {
    const rand = state.rand;
    const inks = INKS[props.inks] || INKS.sumi;
    const clear = state.count % 2 === 1;
    const r = (clear ? 2.2 + rand() * 2.4 : 2.8 + rand() * 3.2) * g.U * props.size;
    const colour = clear ? PAPER : inks[Math.floor(state.count / 2) % inks.length];
    const c = state.centre;
    for (const ring of state.rings) M.dropInPlace(ring.xs, ring.ys, ring.n, c.x, c.y, r);
    state.rings.push(makeRing(c.x, c.y, r, colour));
    state.count++;
    state.here--;
    if (state.here <= 0) {
      state.centre = pickCentre(g, rand);
      state.here = 6 + Math.floor(rand() * 10);
      state.count = 0;
    }
    trim(g);
  }

  // Old rings swell past the screen; once one covers it entirely it is the paper now.
  function trim(g) {
    let total = state.rings.reduce((s, r) => s + r.n, 0);
    while (state.rings.length > MAX_RINGS || total > MAX_POINTS) {
      const old = state.rings.shift();
      total -= old.n;
      const corners = [[0, 0], [g.W, 0], [0, g.H], [g.W, g.H]];
      if (corners.every(([x, y]) => M.containsTyped(old.xs, old.ys, old.n, x, y))) state.base = old.colour;
    }
  }

  // Curl of a noise field, sampled on a coarse grid: divergence-free, so the
  // ink folds without bunching, and cheap because the field changes slowly.
  function buildFlow(g, t) {
    const cols = Math.ceil(g.W / GRID) + 2;
    const rows = Math.ceil(g.H / GRID) + 2;
    const vx = new Float32Array(cols * rows);
    const vy = new Float32Array(cols * rows);
    const s = 0.035;
    const e = 0.5;
    const n = (x, y) => noise2(x * s + t * 0.01, y * s - t * 0.008, 11);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = (i - 1) * GRID;
        const y = (j - 1) * GRID;
        vx[j * cols + i] = (n(x, y + e) - n(x, y - e)) / (2 * e);
        vy[j * cols + i] = -(n(x + e, y) - n(x - e, y)) / (2 * e);
      }
    }
    return { vx, vy, cols, rows };
  }

  function flow(g, dt, swirl) {
    if (swirl <= 0 || !state.flow) return;
    const { vx, vy, cols, rows } = state.flow;
    // About half a cell a second at swirl 1: slow enough to watch, never tearing.
    const amp = swirl * 0.5 * g.U * dt * 25;
    const maxI = cols - 2;
    const maxJ = rows - 2;
    for (const ring of state.rings) {
      const xs = ring.xs;
      const ys = ring.ys;
      for (let p = 0; p < ring.n; p++) {
        let fx = xs[p] / GRID + 1;
        let fy = ys[p] / GRID + 1;
        fx = fx < 0 ? 0 : fx > maxI ? maxI : fx;
        fy = fy < 0 ? 0 : fy > maxJ ? maxJ : fy;
        const i = fx | 0;
        const j = fy | 0;
        const u = fx - i;
        const v = fy - j;
        const a = j * cols + i;
        const b = a + cols;
        const dx = (vx[a] * (1 - u) + vx[a + 1] * u) * (1 - v) + (vx[b] * (1 - u) + vx[b + 1] * u) * v;
        const dy = (vy[a] * (1 - u) + vy[a + 1] * u) * (1 - v) + (vy[b] * (1 - u) + vy[b + 1] * u) * v;
        xs[p] += dx * amp;
        ys[p] += dy * amp;
      }
    }
  }

  function combWithPointer(g, pointer) {
    if (!pointer.active) {
      state.last = null;
      return;
    }
    if (state.last) {
      const dx = pointer.x - state.last.x;
      const dy = pointer.y - state.last.y;
      if (dx * dx + dy * dy > 0.25) {
        for (const ring of state.rings) {
          M.combInPlace(ring.xs, ring.ys, ring.n, pointer.x, pointer.y, dx * 0.8, dy * 0.8, 3.5 * g.U);
        }
      }
    }
    state.last = { x: pointer.x, y: pointer.y };
  }

  function refineAll() {
    for (const ring of state.rings) {
      const out = M.refineTyped(ring.xs, ring.ys, ring.n, 1.5, RING_BUDGET);
      ring.xs = out.xs;
      ring.ys = out.ys;
      ring.n = out.n;
    }
  }

  function paint(ctx, g) {
    ctx.fillStyle = state.base;
    ctx.fillRect(0, 0, g.W, g.H);
    for (const ring of state.rings) {
      const { xs, ys, n } = ring;
      ctx.fillStyle = ring.colour;
      ctx.beginPath();
      ctx.moveTo(xs[0], ys[0]);
      for (let i = 1; i < n; i++) ctx.lineTo(xs[i], ys[i]);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 0.5;
    ctx.drawImage(state.paper, 0, 0);
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.rand = K.rng(api.seed);
    state.paper = paperTexture(g, api.seed % 1000);
    state.rings = [];
    state.base = PAPER;
    state.centre = pickCentre(g, state.rand);
    state.here = 10;
    state.count = 0;
    state.wait = 0;
    state.refineIn = 0;
    state.flowIn = 0;
    state.flow = buildFlow(g, 0);
    // Start with a page already in progress rather than a blank sheet.
    for (let i = 0; i < 90; i++) {
      addDrop(g, api.props);
      flow(g, 1.2, api.props.swirl);
      if (i % 6 === 5) refineAll();
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.wait -= dt;
    if (state.wait <= 0) {
      addDrop(g, props);
      state.wait = 1 / Math.max(props.pace, 0.05);
    }
    state.flowIn -= dt;
    if (state.flowIn <= 0) {
      state.flow = buildFlow(g, t);
      state.flowIn = 0.5;
    }
    flow(g, dt, props.swirl);
    combWithPointer(g, api.pointer);
    state.refineIn -= dt;
    if (state.refineIn <= 0) {
      refineAll();
      state.refineIn = 0.5;
    }
    paint(ctx, g);
  }

  Kasuri.run({
    defaults: {
      inks: 'ai',
      pace: 1,
      swirl: 1,
      size: 1,
      mode: 'glyph',
      ramp: 'kana',
      cell: 8,
      invert: true,
      bg: PAPER,
      tint: 0.5,
      dither: 0.3,
    },
    maxFps: 20,
    setup,
    draw,
  });
})();
