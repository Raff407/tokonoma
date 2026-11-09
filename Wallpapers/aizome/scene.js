/*
 * 藍染 Aizome — indigo-dyed cloths drying on a bamboo pole in a plastered courtyard.
 *
 * Wall, eaves, gravel, posts and vats are baked once, and so is every cloth with its
 * resist pattern. Each frame a cloth is laid down one column at a time under a gentle
 * skew, so the hem lifts and the whole length leans with the wind, and a fold shade
 * travels across it. Shadows on the gravel are one baked strip each, nudged sideways.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm } = K;

  const TAU = Math.PI * 2;
  const MAX_CLOTHS = 7;
  const POLE = 0.17;
  const GROUND = 0.79;
  const INDIGO = ['#1c2a4a', '#24395f', '#2e4a78', '#3d5e8e', '#52739f', '#22355a', '#335283'];
  const WHITE = '#e3dac4';
  const PALE = '#a9b7c6';
  const WALL = { plaster: '#ddd2b8', shade: '#cdc1a4', board: '#3a3430', boardLine: '#2a2622', post: '#4a3a2c' };
  const EAVE = { under: '#2a2420', tile: '#4b4e52', tileLit: '#62666a', rafter: '#3a302a' };
  const GRAVEL = ['#c8bea4', '#bdb298', '#d3caaf', '#b0a68c'];
  const BAMBOO = { pole: '#b39a5e', node: '#8c7644', lit: '#cdb57a' };
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, TAU);
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    return { W, H, U: H / 100, pole: Math.round(H * POLE), ground: Math.round(H * GROUND) };
  }

  // ---- courtyard ------------------------------------------------------------

  function paintWall(ctx, g, rand) {
    const boardTop = Math.round(g.H * 0.6);
    ctx.fillStyle = WALL.plaster;
    ctx.fillRect(0, 0, g.W, boardTop);
    ctx.fillStyle = WALL.shade;
    for (let y = 0; y < boardTop; y += 1) {
      for (let x = 0; x < g.W; x += 1) {
        if (fbm(x / (g.U * 9), y / (g.U * 6), 3, 5) > 0.6 && rand() < 0.7) ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.fillStyle = WALL.board;
    ctx.fillRect(0, boardTop, g.W, g.ground - boardTop);
    ctx.fillStyle = WALL.boardLine;
    const step = Math.max(2, Math.round(g.U * 2.2));
    for (let x = 0; x < g.W; x += step) ctx.fillRect(x, boardTop, 1, g.ground - boardTop);
    ctx.fillRect(0, boardTop, g.W, Math.max(1, Math.round(g.U * 0.8)));
    ctx.fillStyle = WALL.post;
    const span = g.W / 4;
    for (let i = 0; i <= 4; i++) {
      const x = Math.round(i * span - g.U * 1.2);
      ctx.fillRect(x, 0, Math.round(g.U * 2.4), g.ground);
    }
    ctx.fillRect(0, Math.round(g.H * 0.36), g.W, Math.max(1, Math.round(g.U * 1.4)));
  }

  function paintEaves(ctx, g) {
    const h = Math.round(g.H * 0.075);
    ctx.fillStyle = EAVE.under;
    ctx.fillRect(0, 0, g.W, h);
    ctx.fillStyle = EAVE.rafter;
    const step = Math.max(3, Math.round(g.U * 3));
    for (let x = 0; x < g.W; x += step) ctx.fillRect(x, h - Math.round(g.U * 2), Math.max(1, Math.round(g.U)), Math.round(g.U * 2));
    const r = g.U * 1.6;
    for (let x = r; x < g.W + r; x += r * 2.2) {
      ctx.fillStyle = EAVE.tile;
      blob(ctx, x, h * 0.45, r, r);
      ctx.fillStyle = EAVE.tileLit;
      blob(ctx, x - r * 0.3, h * 0.45 - r * 0.3, r * 0.4, r * 0.4);
    }
  }

  function paintGround(ctx, g, rand) {
    const h = g.H - g.ground;
    ctx.fillStyle = GRAVEL[0];
    ctx.fillRect(0, g.ground, g.W, h);
    for (let y = g.ground; y < g.H; y++) {
      for (let x = 0; x < g.W; x++) {
        const r = rand();
        if (r < 0.28) {
          ctx.fillStyle = GRAVEL[1 + Math.floor(rand() * 3)];
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    ctx.fillStyle = GRAVEL[3];
    const gap = Math.max(2, Math.round(g.U * 2.4));
    for (let y = g.ground + gap; y < g.H; y += gap) {
      for (let x = 0; x < g.W; x++) {
        if (rand() < 0.75) ctx.fillRect(x, y + Math.round(Math.sin(x / (g.U * 8)) * 0.6), 1, 1);
      }
    }
    ctx.fillStyle = '#4e5e44';
    ctx.fillRect(0, g.ground, g.W, Math.max(1, Math.round(g.U * 0.7)));
    ctx.fillStyle = '#62734f';
    for (let x = 0; x < g.W; x++) {
      if (rand() < 0.4) ctx.fillRect(x, g.ground - 1, 1, 1);
    }
  }

  function paintFrame(ctx, g, rand) {
    const w = Math.max(2, Math.round(g.U * 1.6));
    const posts = [Math.round(g.W * 0.035), Math.round(g.W * 0.965) - w];
    for (const x of posts) {
      ctx.fillStyle = BAMBOO.pole;
      ctx.fillRect(x, g.pole - g.U, w, g.ground + g.U * 2 - g.pole);
      ctx.fillStyle = BAMBOO.lit;
      ctx.fillRect(x, g.pole - g.U, 1, g.ground + g.U * 2 - g.pole);
      ctx.fillStyle = BAMBOO.node;
      for (let y = g.pole + g.U * 6; y < g.ground; y += g.U * 9) ctx.fillRect(x, Math.round(y), w, 1);
    }
    const ph = Math.max(2, Math.round(g.U * 1.5));
    ctx.fillStyle = BAMBOO.pole;
    ctx.fillRect(0, g.pole - ph, g.W, ph);
    ctx.fillStyle = BAMBOO.lit;
    ctx.fillRect(0, g.pole - ph, g.W, 1);
    ctx.fillStyle = BAMBOO.node;
    for (let x = rand() * g.U * 10; x < g.W; x += g.U * (12 + rand() * 4)) ctx.fillRect(Math.round(x), g.pole - ph, 1, ph);
  }

  function paintVats(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const spots = [[0.13, 1.0], [0.24, 0.85], [0.85, 0.95]];
    const vats = [];
    for (const [fx, s] of spots) {
      const x = g.W * fx;
      const rx = g.U * 6.5 * s;
      const top = g.H * 0.86 + (1 - s) * g.U * 3;
      const h = g.U * 8 * s;
      ctx.fillStyle = '#5e4630';
      ctx.fillRect(Math.round(x - rx), Math.round(top), Math.round(rx * 2), Math.round(h));
      blob(ctx, x, top + h, rx, g.U * 1.8 * s);
      ctx.fillStyle = '#7a5d3e';
      ctx.fillRect(Math.round(x - rx * 0.7), Math.round(top), Math.max(1, Math.round(rx * 0.25)), Math.round(h));
      ctx.fillStyle = '#2a2420';
      for (let k = 0.2; k < 1; k += 0.4) ctx.fillRect(Math.round(x - rx), Math.round(top + h * k), Math.round(rx * 2), Math.max(1, Math.round(g.U * 0.8)));
      ctx.fillStyle = '#8c7048';
      blob(ctx, x, top, rx, g.U * 2.2 * s);
      ctx.fillStyle = '#1e3156';
      blob(ctx, x, top, rx * 0.84, g.U * 1.6 * s);
      vats.push({ x, y: top, rx: rx * 0.86, ry: g.U * 1.6 * s, seed: rand() * TAU });
    }
    return { canvas: c, list: vats };
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintWall(ctx, g, rand);
    paintEaves(ctx, g);
    paintGround(ctx, g, rand);
    paintFrame(ctx, g, rand);
    return c;
  }

  // ---- cloths ---------------------------------------------------------------

  function dots(ctx, w, h, U, rand) {
    const step = Math.max(3, U * 3.4);
    for (let y = step * 0.7, row = 0; y < h; y += step, row++) {
      for (let x = (row % 2) * step * 0.5 + step * 0.4; x < w; x += step) {
        ctx.fillStyle = PALE;
        blob(ctx, x, y, U * 0.9, U * 0.9);
        ctx.fillStyle = WHITE;
        blob(ctx, x, y, U * 0.45 + rand() * U * 0.2, U * 0.45);
      }
    }
  }

  function bands(ctx, w, h, U, rand) {
    const step = Math.max(6, U * 11);
    for (let y = step * 0.5; y < h - U * 3; y += step) {
      ctx.fillStyle = PALE;
      ctx.fillRect(0, Math.round(y - U), w, Math.max(1, Math.round(U * 3.2)));
      ctx.fillStyle = WHITE;
      ctx.fillRect(0, Math.round(y), w, Math.max(1, Math.round(U * 1.2)));
      for (let x = U; x < w; x += U * 4) {
        if (rand() < 0.5) ctx.fillRect(Math.round(x), Math.round(y + U * 2.4), Math.max(1, Math.round(U)), Math.max(1, Math.round(U)));
      }
    }
  }

  function storm(ctx, w, h, U, rand) {
    ctx.fillStyle = PALE;
    const step = Math.max(2, U * 1.8);
    for (let k = -h; k < w; k += step) {
      for (let y = 0; y < h; y++) {
        const x = k + y * 0.55 + Math.sin(y / (U * 5)) * U * 0.6;
        if (x >= 0 && x < w && rand() < 0.8) ctx.fillRect(Math.round(x), y, 1, 1);
      }
    }
  }

  function squares(ctx, w, h, U) {
    const s = Math.max(4, Math.round(w / 3));
    for (let y = s * 0.3; y < h - s * 0.5; y += s * 1.15) {
      for (let x = (w - s * 2.4) / 2; x < w - s * 0.5; x += s * 1.4) {
        ctx.fillStyle = PALE;
        ctx.fillRect(Math.round(x), Math.round(y), Math.round(s), Math.round(s));
        ctx.fillStyle = WHITE;
        ctx.fillRect(Math.round(x + U * 0.8), Math.round(y + U * 0.8), Math.round(s - U * 1.6), Math.round(s - U * 1.6));
        ctx.fillStyle = INDIGO[1];
        ctx.fillRect(Math.round(x + s * 0.38), Math.round(y + s * 0.38), Math.round(s * 0.24), Math.round(s * 0.24));
      }
    }
  }

  function waves(ctx, w, h, U) {
    ctx.fillStyle = WHITE;
    const step = Math.max(4, U * 6);
    for (let y = step; y < h; y += step) {
      for (let x = 0; x < w; x++) {
        const yy = y + Math.sin((x / w) * TAU * 1.5) * U * 1.6;
        ctx.fillRect(x, Math.round(yy), 1, Math.max(1, Math.round(U * 0.7)));
      }
    }
  }

  const PATTERNS = [dots, bands, storm, squares, waves, dots, bands];

  function paintCloth(w, h, U, ink, pattern, rand) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, w, h);
    pattern(ctx, w, h, U, rand);
    ctx.fillStyle = INDIGO[0];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (fbm(x / (U * 4), y / (U * 7), 2, 77) > 0.66 && rand() < 0.5) ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, w, Math.max(1, Math.round(U * 0.8)));
    ctx.fillStyle = INDIGO[0];
    ctx.fillRect(0, h - Math.max(1, Math.round(U * 0.8)), w, Math.max(1, Math.round(U * 0.8)));
    return c;
  }

  function paintShadow(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#5c5444';
    ctx.beginPath();
    ctx.moveTo(w * 0.2, 0);
    ctx.lineTo(w * 0.95, 0);
    ctx.lineTo(w * 0.8, h);
    ctx.lineTo(w * 0.05, h);
    ctx.closePath();
    ctx.fill();
    return c;
  }

  function makeCloths(g, rand, count) {
    const left = g.W * 0.08;
    const span = g.W * 0.84;
    const slot = span / count;
    const list = [];
    for (let i = 0; i < count; i++) {
      const w = Math.max(4, Math.round(slot * (0.74 + rand() * 0.12)));
      const h = Math.round(g.H * (0.5 + rand() * 0.1));
      const x = Math.round(left + slot * i + (slot - w) / 2);
      list.push({
        x,
        w,
        h,
        canvas: paintCloth(w, h, g.U, INDIGO[(i * 3 + 1) % INDIGO.length], PATTERNS[i % PATTERNS.length], rand),
        shadow: paintShadow(w * 1.3, g.U * 5),
        phase: rand() * TAU,
        rate: 0.8 + rand() * 0.5,
        folds: 1.4 + rand() * 0.9,
      });
    }
    return list;
  }

  // ---- per frame ------------------------------------------------------------

  function drawShadows(ctx, g, t, wind, cloths) {
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < cloths.length; i++) {
      const c = cloths[i];
      const lean = Math.sin(t * 0.55 * c.rate + c.phase) * wind;
      ctx.drawImage(c.shadow, Math.round(c.x + g.U * 3 + lean * g.U * 2.5), g.ground + g.U * 1.5);
    }
    ctx.globalAlpha = 1;
  }

  function drawCloth(ctx, g, t, wind, c) {
    const gust = 0.5 + 0.5 * Math.sin(t * 0.31 + c.phase * 0.5);
    const lean = (Math.sin(t * 0.55 * c.rate + c.phase) * 0.6 + 0.4) * wind * (0.6 + gust * 0.6);
    const skew = lean * 0.07;
    ctx.setTransform(1, 0, skew, 1, -skew * g.pole, 0);
    const k = (c.folds * TAU) / c.w;
    const drift = t * 2.2 * c.rate * (0.4 + wind * 0.6);
    for (let x = 0; x < c.w; x++) {
      const p = x * k - drift + c.phase;
      const fold = Math.sin(p) * 0.7 + Math.sin(p * 2.1 + t * 0.9) * 0.3;
      const lift = wind * (0.02 + 0.03 * gust) * (1 + fold);
      const h = Math.round(c.h * (1 - lift));
      ctx.drawImage(c.canvas, x, 0, 1, c.h, c.x + x, g.pole, 1, h);
      if (fold < 0) {
        ctx.globalAlpha = Math.min(0.55, -fold * (0.25 + wind * 0.2));
        ctx.fillStyle = '#0c1220';
      } else {
        ctx.globalAlpha = fold * (0.08 + wind * 0.06);
        ctx.fillStyle = WHITE;
      }
      ctx.fillRect(c.x + x, g.pole, 1, h);
      ctx.globalAlpha = 1;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawVats(ctx, t, vats) {
    ctx.drawImage(vats.canvas, 0, 0);
    ctx.fillStyle = '#9a7a4a';
    for (let i = 0; i < vats.list.length; i++) {
      const v = vats.list[i];
      const a = t * 0.25 + v.seed;
      blob(ctx, v.x + Math.cos(a) * v.rx * 0.45, v.y + Math.sin(a) * v.ry * 0.4, v.rx * 0.22, v.ry * 0.35);
    }
  }

  // ---- run ------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.vats = paintVats(g, rand);
    state.sets = {};
    state.seed = api.seed;
  }

  function clothsFor(n) {
    if (!state.sets[n]) state.sets[n] = makeCloths(state.g, K.rng(state.seed + n * 7919), n);
    return state.sets[n];
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { wind } = api.props;
    const n = Math.max(3, Math.min(MAX_CLOTHS, Math.round(api.props.cloths)));
    const cloths = clothsFor(n);
    ctx.drawImage(state.back, 0, 0);
    drawShadows(ctx, g, t, wind, cloths);
    for (let i = 0; i < cloths.length; i++) drawCloth(ctx, g, t, wind, cloths[i]);
    drawVats(ctx, t, state.vats);
  }

  Kasuri.run({
    defaults: { wind: 1, cloths: 6, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
