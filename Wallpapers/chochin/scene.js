/*
 * 提灯 Chochin — a row of red paper lanterns under an old eave on a damp night.
 *
 * Roof, wall, shoji and wet paving are baked once. Each frame lays that down, then for
 * every lantern a soft glow on the wall, a pool and a wavering reflection on the stones,
 * and the lantern itself swung from its hook. A light drizzle is one short stroked path.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;

  const EAVE = 13;
  const GROUND = 61;
  const ROOF = { tile: '#363b45', lip: '#4c535e', shade: '#22252c', fascia: '#2a221c', edge: '#4a3a2c', hook: '#8a7444' };
  const WALL = { board: ['#35271f', '#3b2c22', '#30241c', '#40302a'], seam: '#21181290', rail: '#4a3828' };
  const SHOJI = { paper: '#8f7a58', frame: '#3a2a1e', warm: '#a88a5c' };
  const STONE = { gap: '#15181d', tones: ['#2a3038', '#323840', '#2d333b', '#383e46', '#272c33'], sheen: '#6a7684' };
  const PAPER = { core: '#efb066', mid: '#d0502f', rim: '#7a261d', rib: '#8c2d21' };
  const CAP = { ink: '#1d1916', rim: '#9a7a40' };
  const GLOW = '#e08a4a';
  const RAIN = '#b9c0c8';
  const DROPS = 70;
  const SLICES = 7;
  const SQUASH = 0.6;
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
    const U = H / 100;
    const n = Math.max(3, Math.min(9, Math.round(W / (U * 26))));
    return { W, H, U, n, eave: H * EAVE / 100, ground: H * GROUND / 100 };
  }

  // ---- still layers --------------------------------------------------------

  function paintRoof(ctx, g) {
    const U = g.U;
    ctx.fillStyle = ROOF.shade;
    ctx.fillRect(0, 0, g.W, g.eave);
    ctx.fillStyle = ROOF.tile;
    ctx.fillRect(0, 0, g.W, U * 6.5);
    const step = U * 4;
    for (let x = 0; x < g.W + step; x += step) {
      ctx.fillStyle = ROOF.lip;
      ctx.fillRect(x - U * 0.5, 0, U * 1, U * 6.5);
      ctx.fillStyle = ROOF.tile;
      blob(ctx, x, U * 7, U * 1.8, U * 1.5);
      ctx.fillStyle = ROOF.lip;
      blob(ctx, x - U * 0.4, U * 6.6, U * 0.8, U * 0.6);
    }
    ctx.fillStyle = ROOF.fascia;
    ctx.fillRect(0, U * 8.6, g.W, g.eave - U * 8.6);
    ctx.fillStyle = ROOF.edge;
    ctx.fillRect(0, g.eave - U * 1, g.W, U * 1);
  }

  function paintWall(ctx, g, rand) {
    const U = g.U;
    const top = g.eave;
    const h = g.ground - top;
    for (let x = 0; x < g.W; ) {
      const w = U * (3 + rand() * 2.5);
      ctx.fillStyle = WALL.board[Math.floor(rand() * WALL.board.length)];
      ctx.fillRect(x, top, w + 1, h);
      ctx.fillStyle = WALL.seam;
      ctx.fillRect(x, top, Math.max(1, U * 0.35), h);
      x += w;
    }
    ctx.fillStyle = WALL.rail;
    ctx.fillRect(0, top + h * 0.78, g.W, U * 1.2);
    ctx.fillRect(0, g.ground - U * 2.2, g.W, U * 2.2);
  }

  function paintShoji(ctx, g) {
    const U = g.U;
    const x0 = g.W * 0.3;
    const x1 = g.W * 0.7;
    const y0 = g.eave + U * 12;
    const y1 = g.eave + (g.ground - g.eave) * 0.78;
    ctx.fillStyle = SHOJI.frame;
    ctx.fillRect(x0 - U, y0 - U, x1 - x0 + U * 2, y1 - y0 + U * 2);
    ctx.fillStyle = SHOJI.paper;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = SHOJI.warm;
    ctx.fillRect(x0 + (x1 - x0) * 0.25, y0, (x1 - x0) * 0.5, y1 - y0);
    ctx.fillStyle = SHOJI.frame;
    const cols = Math.max(4, Math.round((x1 - x0) / (U * 4)));
    for (let i = 1; i < cols; i++) ctx.fillRect(x0 + (x1 - x0) * i / cols - U * 0.25, y0, U * 0.5, y1 - y0);
    const rows = Math.max(3, Math.round((y1 - y0) / (U * 5)));
    for (let j = 1; j < rows; j++) ctx.fillRect(x0, y0 + (y1 - y0) * j / rows - U * 0.25, x1 - x0, U * 0.5);
    ctx.fillRect(x0 + (x1 - x0) / 2 - U * 0.6, y0, U * 1.2, y1 - y0);
  }

  function paintStones(ctx, g, rand) {
    const U = g.U;
    ctx.fillStyle = STONE.gap;
    ctx.fillRect(0, g.ground, g.W, g.H - g.ground);
    let y = g.ground + U * 0.4;
    let row = 0;
    while (y < g.H) {
      const f = (y - g.ground) / (g.H - g.ground);
      const rh = U * (3 + f * 7);
      const gap = Math.max(1, U * (0.35 + f * 0.4));
      let x = -rand() * U * 8;
      while (x < g.W) {
        const w = rh * (1.6 + rand() * 1.6);
        ctx.fillStyle = STONE.tones[Math.floor(rand() * STONE.tones.length)];
        ctx.fillRect(x + gap / 2, y, w - gap, rh - gap);
        ctx.globalAlpha = 0.18 + rand() * 0.14;
        ctx.fillStyle = STONE.sheen;
        ctx.fillRect(x + gap / 2 + w * rand() * 0.4, y + (rh - gap) * (0.2 + rand() * 0.5), w * (0.2 + rand() * 0.35), Math.max(1, U * 0.4));
        ctx.globalAlpha = 1;
        x += w;
      }
      y += rh;
      row++;
    }
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintWall(ctx, g, rand);
    paintShoji(ctx, g);
    paintRoof(ctx, g);
    paintStones(ctx, g, rand);
    return c;
  }

  // One lantern with its cord, pivot at the top centre of the canvas.
  function paintLantern(g) {
    const U = g.U;
    const bw = U * 11;
    const bh = U * 17;
    const cord = U * 5;
    const cap = U * 1.7;
    const pad = 2;
    const c = layer(bw + pad * 2, cord + bh + cap * 2 + U * 3);
    const ctx = c.getContext('2d');
    const cx = c.width / 2;
    const top = cord + cap;
    const cy = top + bh / 2;
    ctx.fillStyle = CAP.ink;
    ctx.fillRect(cx - Math.max(0.5, U * 0.25), 0, Math.max(1, U * 0.5), cord + 1);
    const grad = ctx.createRadialGradient(cx - bw * 0.08, cy - bh * 0.05, bh * 0.05, cx, cy, bw * 0.62);
    grad.addColorStop(0, PAPER.core);
    grad.addColorStop(0.45, PAPER.mid);
    grad.addColorStop(1, PAPER.rim);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, bw / 2, bh * 0.58, 0, 0, TAU);
    ctx.clip();
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, c.width, bh);
    ctx.strokeStyle = PAPER.rib;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(0.6, U * 0.35);
    for (let i = 1; i < 7; i++) {
      const y = top + bh * i / 7;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(cx, y + bh * 0.04, c.width, y);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    const cw = bw * 0.62;
    ctx.fillStyle = CAP.ink;
    ctx.fillRect(cx - cw / 2, cord, cw, cap);
    ctx.fillRect(cx - cw / 2, top + bh, cw, cap);
    ctx.fillStyle = CAP.rim;
    ctx.fillRect(cx - cw / 2, cord + cap - Math.max(0.5, U * 0.3), cw, Math.max(0.5, U * 0.3));
    ctx.fillRect(cx - cw / 2, top + bh, cw, Math.max(0.5, U * 0.3));
    ctx.fillStyle = CAP.ink;
    ctx.fillRect(cx - U * 0.6, top + bh + cap, U * 1.2, U * 2.6);
    return { canvas: c, ox: cx, mid: cy, bw, bh };
  }

  function paintGlow(g) {
    const R = g.U * 30;
    const c = layer(R * 2, R * 2);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(R, R, 0, R, R, R);
    const ink = K.parseColor(GLOW);
    const rgba = (a) => `rgba(${ink[0]},${ink[1]},${ink[2]},${a})`;
    grad.addColorStop(0, rgba(0.55));
    grad.addColorStop(0.35, rgba(0.22));
    grad.addColorStop(1, rgba(0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, R * 2, R * 2);
    return { canvas: c, R };
  }

  function makeLanterns(g, rand) {
    const n = g.n;
    const L = { x: new Float32Array(n), drop: new Float32Array(n), ph: new Float32Array(n), a: new Float32Array(n) };
    const step = g.W / n;
    for (let i = 0; i < n; i++) {
      L.x[i] = step * (i + 0.5);
      L.drop[i] = g.U * (i % 2 ? 1.5 : 0) + rand() * g.U;
      L.ph[i] = i * 0.55 + rand() * 0.6;
    }
    return L;
  }

  function makeRain(g, rand) {
    const R = { x: new Float32Array(DROPS), y: new Float32Array(DROPS), v: new Float32Array(DROPS) };
    for (let i = 0; i < DROPS; i++) {
      R.x[i] = rand() * g.W;
      R.y[i] = rand() * g.H;
      R.v[i] = g.H * (0.7 + rand() * 0.5);
    }
    return R;
  }

  // ---- per frame -----------------------------------------------------------

  function swing(L, t, sway) {
    const gust = 0.65 + 0.35 * Math.sin(t * 0.21);
    for (let i = 0; i < L.a.length; i++) {
      const p = L.ph[i];
      L.a[i] = sway * gust * (0.075 * Math.sin(t * 1.15 + p) + 0.035 * Math.sin(t * 0.47 + p * 1.7));
    }
  }

  function drawGlows(ctx, g, t, glow) {
    const L = state.lanterns;
    const S = state.sprite;
    const G = state.glow;
    const d = S.mid;
    for (let i = 0; i < L.a.length; i++) {
      const px = L.x[i];
      const py = g.eave + L.drop[i];
      const s = Math.sin(L.a[i]);
      const c = Math.cos(L.a[i]);
      const cx = px - s * d;
      const cy = py + c * d;
      const breathe = 0.92 + 0.05 * Math.sin(t * 0.8 + L.ph[i] * 3);
      ctx.globalAlpha = Math.min(1, 0.75 * glow * breathe);
      ctx.drawImage(G.canvas, cx - G.R, cy - G.R);
      const ry = g.ground + (g.ground - cy) * SQUASH;
      ctx.globalAlpha = Math.min(1, 0.6 * glow * breathe);
      ctx.drawImage(G.canvas, cx - G.R * 1.3, ry - G.R * 0.4, G.R * 2.6, G.R * 0.8);
    }
    ctx.globalAlpha = 1;
  }

  function drawReflections(ctx, g, t, glow) {
    const L = state.lanterns;
    const S = state.sprite;
    const sw = S.canvas.width;
    const sh = S.canvas.height;
    const slice = sh / SLICES;
    ctx.globalAlpha = Math.min(0.7, 0.42 * Math.max(0.4, glow));
    for (let i = 0; i < L.a.length; i++) {
      const s = Math.sin(L.a[i]);
      const py = g.eave + L.drop[i];
      const mirror = g.ground + (g.ground - py) * SQUASH;
      for (let k = 0; k < SLICES; k++) {
        const sy = k * slice;
        const wob = Math.sin(t * 2.1 + k * 1.3 + L.ph[i] * 2) * g.U * 0.9;
        const dx = L.x[i] - S.ox - s * (sy + slice / 2) + wob;
        const dy = mirror - (sy + slice) * SQUASH;
        ctx.drawImage(S.canvas, 0, sy, sw, slice, dx, dy, sw, slice * SQUASH + 0.5);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawLanterns(ctx, g) {
    const L = state.lanterns;
    const S = state.sprite;
    ctx.fillStyle = ROOF.hook;
    for (let i = 0; i < L.a.length; i++) {
      const px = L.x[i];
      const py = g.eave + L.drop[i];
      ctx.fillRect(px - g.U * 0.5, g.eave - g.U * 0.6, g.U, L.drop[i] + g.U * 0.6);
      const c = Math.cos(L.a[i]);
      const s = Math.sin(L.a[i]);
      ctx.setTransform(c, s, -s, c, px, py);
      ctx.drawImage(S.canvas, -S.ox, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
  }

  function drawRain(ctx, g, dt) {
    const R = state.rain;
    const lx = g.U * 0.5;
    const ly = g.U * 3;
    ctx.strokeStyle = RAIN;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = Math.max(0.5, g.U * 0.3);
    ctx.beginPath();
    for (let i = 0; i < DROPS; i++) {
      R.y[i] += R.v[i] * dt;
      R.x[i] -= R.v[i] * dt * 0.15;
      if (R.y[i] > g.H) {
        R.y[i] -= g.H + ly;
        R.x[i] = state.rand() * (g.W + g.U * 10);
      }
      ctx.moveTo(R.x[i], R.y[i]);
      ctx.lineTo(R.x[i] - lx, R.y[i] + ly);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.sprite = paintLantern(g);
    state.glow = paintGlow(g);
    state.lanterns = makeLanterns(g, rand);
    state.rain = makeRain(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { sway, glow, rain } = api.props;
    swing(state.lanterns, t, sway);
    ctx.drawImage(state.back, 0, 0);
    drawGlows(ctx, g, t, glow);
    drawReflections(ctx, g, t, glow);
    drawLanterns(ctx, g);
    if (rain) drawRain(ctx, g, Math.min(dt, 0.1));
  }

  Kasuri.run({
    defaults: { sway: 1, glow: 1, rain: true, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
