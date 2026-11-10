/*
 * 組子 Kumiko — a cedar lattice of asanoha (hemp leaf) cells with lamplight behind the paper.
 *
 * The lattice and the shaded facets are baked once. Light is a few soft sprites that
 * wander slowly behind them, so each frame is a handful of drawImage calls.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const SQ3 = Math.sqrt(3) / 2;
  const BASE = '#33261a';
  const WOOD = { dark: '#3e2a1a', mid: '#8a6234', light: '#b98a50' };
  const SHADE = ['#14100d', '#1d2838', '#2a1d14'];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function hash(i, j, k) {
    let h = (i * 374761393 + j * 668265263 + k * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const size = (H / 7) * (api.props.pattern || 1);
    return { W, H, s: size, h: size * SQ3, strip: Math.max(1.2, size * 0.075) };
  }

  function vert(g, i, j) {
    return [i * g.s + (j & 1) * g.s * 0.5, j * g.h];
  }

  // Both triangles between lattice row j and j+1, as flat [x,y,x,y,x,y] lists.
  function trianglesAt(g, i, j) {
    const t0 = vert(g, i, j);
    const t1 = vert(g, i + 1, j);
    const b0 = vert(g, i, j + 1);
    const b1 = vert(g, i + 1, j + 1);
    if (j & 1) return [[t0, t1, b1], [t0, b0, b1]];
    return [[t0, t1, b0], [t1, b0, b1]];
  }

  function paintFacets(ctx, g, tris) {
    for (const [i, j, n, tri] of tris) {
      const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
      const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
      for (let k = 0; k < 3; k++) {
        const a = tri[k];
        const b = tri[(k + 1) % 3];
        const r = hash(i, j * 2 + n, k);
        ctx.globalAlpha = 0.03 + r * 0.32;
        ctx.fillStyle = SHADE[Math.floor(hash(j, i, k + n * 3) * SHADE.length)];
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function strokeAll(ctx, tris, spokes) {
    ctx.beginPath();
    for (const [, , , tri] of tris) {
      if (spokes) {
        const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
        const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
        for (const v of tri) {
          ctx.moveTo(cx, cy);
          ctx.lineTo(v[0], v[1]);
        }
      } else {
        ctx.moveTo(tri[0][0], tri[0][1]);
        ctx.lineTo(tri[1][0], tri[1][1]);
        ctx.lineTo(tri[2][0], tri[2][1]);
        ctx.closePath();
      }
    }
    ctx.stroke();
  }

  function paintLattice(g, tris) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    const passes = [
      [WOOD.dark, 1.5, 1.1, 0, 0],
      [WOOD.mid, 1, 0.8, 0, 0],
      [WOOD.light, 0.35, 0.3, -0.4, -0.5],
    ];
    for (const [ink, edge, spoke, dx, dy] of passes) {
      ctx.strokeStyle = ink;
      ctx.setTransform(1, 0, 0, 1, dx, dy);
      ctx.lineWidth = g.strip * edge;
      strokeAll(ctx, tris, false);
      ctx.lineWidth = g.strip * spoke * 0.8;
      strokeAll(ctx, tris, true);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // a stout frame around the screen edge
    const f = Math.max(2, g.strip * 1.6);
    ctx.fillStyle = WOOD.dark;
    ctx.fillRect(0, 0, g.W, f);
    ctx.fillRect(0, g.H - f, g.W, f);
    ctx.fillRect(0, 0, f, g.H);
    ctx.fillRect(g.W - f, 0, f, g.H);
    ctx.fillStyle = WOOD.mid;
    ctx.fillRect(f, f, g.W - 2 * f, Math.max(1, f * 0.3));
    return c;
  }

  function paintStatic(g) {
    const tris = [];
    const cols = Math.ceil(g.W / g.s) + 2;
    const rows = Math.ceil(g.H / g.h) + 2;
    for (let j = -1; j < rows; j++) {
      for (let i = -1; i < cols; i++) {
        const pair = trianglesAt(g, i, j);
        tris.push([i, j, 0, pair[0]], [i, j, 1, pair[1]]);
      }
    }
    const facets = layer(g.W, g.H);
    paintFacets(facets.getContext('2d'), g, tris);
    return { facets, lattice: paintLattice(g, tris) };
  }

  function glowSprite(size, core, edge) {
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, core);
    grad.addColorStop(0.5, edge);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  function sweepSprite(g) {
    const w = Math.ceil(g.W * 0.5);
    const c = layer(w, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(214,170,90,0)');
    grad.addColorStop(0.5, 'rgba(214,170,90,0.55)');
    grad.addColorStop(1, 'rgba(214,170,90,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, g.H);
    return c;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    const baked = paintStatic(g);
    state.facets = baked.facets;
    state.lattice = baked.lattice;
    const big = Math.ceil(g.H * 1.5);
    state.warm = glowSprite(big, 'rgba(246,206,120,1)', 'rgba(220,150,70,0.7)');
    state.red = glowSprite(big, 'rgba(214,100,58,0.9)', 'rgba(170,70,40,0.5)');
    state.pale = glowSprite(big, 'rgba(246,232,196,0.95)', 'rgba(222,190,130,0.5)');
    state.sweep = sweepSprite(g);
  }

  function blob(ctx, img, g, x, y, scale, alpha) {
    const s = img.width * scale;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const glow = api.props.glow;
    ctx.fillStyle = BASE;
    ctx.fillRect(0, 0, g.W, g.H);
    const a = Math.min(1, 1.4 * glow);
    blob(ctx, state.warm, g, g.W * (0.5 + 0.32 * Math.sin(t * 0.11)), g.H * (0.5 + 0.28 * Math.sin(t * 0.083 + 1)), 1.25, a);
    blob(ctx, state.red, g, g.W * (0.5 + 0.38 * Math.sin(t * 0.07 + 2.3)), g.H * (0.5 + 0.3 * Math.cos(t * 0.095)), 1.1, a * 0.8);
    blob(ctx, state.pale, g, g.W * (0.5 + 0.4 * Math.cos(t * 0.06 + 0.7)), g.H * (0.5 + 0.34 * Math.sin(t * 0.12 + 4)), 0.8, a * 0.7);
    const sw = state.sweep.width;
    const x = ((t * g.W * 0.03) % (g.W + sw)) - sw;
    ctx.globalAlpha = Math.min(1, 0.8 * glow);
    ctx.drawImage(state.sweep, x, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.facets, 0, 0);
    ctx.drawImage(state.lattice, 0, 0);
  }

  Kasuri.run({
    defaults: { glow: 1, pattern: 1, ramp: 'lines', cell: 6, boost: 0.35, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
