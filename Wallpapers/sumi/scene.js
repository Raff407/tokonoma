/*
 * 墨流し Sumi — ink floated on still water, lifted onto washi.
 *
 * Drops land one after another at the same spot, ink then clear water, so
 * rings grow outward and push every earlier ring along. Now and then the
 * brush moves somewhere else. A slow current folds it all, and dragging the
 * cursor across the desktop combs the surface like a fan.
 *
 * Simulation state is updated in place each frame on purpose: thousands of
 * points at 30 fps would otherwise mean thousands of throwaway objects.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const M = Marble;
  const { lerp, noise2, fbm, parseColor: P } = K;

  const PAPER = '#ece5d5';
  const INKS = {
    sumi: ['#1c1a19'],
    ai: ['#1c1a19', '#23406b'],
    beni: ['#1c1a19', '#a5392a'],
    mixed: ['#1c1a19', '#23406b', '#a5392a', '#3b5a45'],
  };
  const MAX_RINGS = 160;
  const MAX_POINTS = 16000;
  const RING_BUDGET = 900;

  const state = { rings: [], base: PAPER, last: null };

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

  function addDrop(g, props) {
    const rand = state.rand;
    const inks = INKS[props.inks] || INKS.sumi;
    const clear = state.count % 2 === 1;
    const r = (clear ? 2.2 + rand() * 2.4 : 2.8 + rand() * 3.2) * g.U * props.size;
    const colour = clear ? PAPER : inks[Math.floor(state.count / 2) % inks.length];
    const c = state.centre;
    for (const ring of state.rings) ring.pts = M.drop(ring.pts, c.x, c.y, r);
    const n = Math.max(24, Math.round(r * 6));
    state.rings.push({ pts: M.circle(c.x, c.y, r, n), colour });
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
    let total = state.rings.reduce((s, r) => s + r.pts.length, 0);
    while (state.rings.length > MAX_RINGS || total > MAX_POINTS) {
      const old = state.rings.shift();
      total -= old.pts.length;
      const corners = [[0, 0], [g.W, 0], [0, g.H], [g.W, g.H]];
      if (corners.every(([x, y]) => M.contains(old.pts, x, y))) state.base = old.colour;
    }
  }

  function flow(g, t, dt, swirl) {
    if (swirl <= 0) return;
    const e = 0.5;
    const s = 0.035;
    // About half a cell a second at swirl 1: slow enough to watch, never tearing.
    const amp = swirl * 0.5 * g.U * dt;
    const n = (x, y) => noise2(x * s + t * 0.01, y * s - t * 0.008, 11);
    for (const ring of state.rings) {
      for (const p of ring.pts) {
        // Curl of a noise field: divergence-free, so ink folds without bunching.
        const vx = (n(p.x, p.y + e) - n(p.x, p.y - e)) / (2 * e);
        const vy = -(n(p.x + e, p.y) - n(p.x - e, p.y)) / (2 * e);
        p.x += vx * amp * 25;
        p.y += vy * amp * 25;
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
        for (const ring of state.rings) ring.pts = M.comb(ring.pts, pointer.x, pointer.y, dx * 0.8, dy * 0.8, 3.5 * g.U);
      }
    }
    state.last = { x: pointer.x, y: pointer.y };
  }

  function paint(ctx, g) {
    ctx.fillStyle = state.base;
    ctx.fillRect(0, 0, g.W, g.H);
    for (const ring of state.rings) {
      const pts = ring.pts;
      ctx.fillStyle = ring.colour;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
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
    // Start with a page already in progress rather than a blank sheet.
    for (let i = 0; i < 110; i++) {
      addDrop(g, api.props);
      for (let k = 0; k < 4; k++) flow(g, i, 0.3, api.props.swirl);
      if (i % 6 === 5) for (const ring of state.rings) ring.pts = M.refine(ring.pts, 1.2, RING_BUDGET);
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
    flow(g, t, dt, props.swirl);
    combWithPointer(g, api.pointer);
    state.refineIn -= dt;
    if (state.refineIn <= 0) {
      for (const ring of state.rings) ring.pts = M.refine(ring.pts, 1.2, RING_BUDGET);
      state.refineIn = 0.5;
    }
    paint(ctx, g);
  }

  Kasuri.run({
    defaults: {
      inks: 'ai',
      pace: 0.8,
      swirl: 1,
      size: 1,
      mode: 'glyph',
      ramp: 'kana',
      cell: 9,
      invert: true,
      bg: PAPER,
      tint: 0.5,
      dither: 0.3,
    },
    setup,
    draw,
  });
})();
