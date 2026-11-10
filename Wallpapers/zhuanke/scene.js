/*
 * 篆刻 Zhuanke — a vermilion seal impression on washi, with the carved stone and an ink paste box.
 *
 * Table, paper, impression, stone and paste box are baked once. A slanted band of window
 * light slides slowly over everything through a mask, and a few dust motes drift up.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const MOTES = 16;
  const state = {};

  const TABLE = ['#2a211a', '#171210'];
  const WASHI = { base: '#e3d8bd', fibre: '#cfc2a2', edge: '#b8a984', shadow: 'rgba(8,6,5,0.55)' };
  const RED = { deep: '#9c2a1c', mid: '#c0392a', lit: '#d6452c', cut: '#e6d9bf' };
  const STONE = { dark: '#2f3a36', mid: '#46564e', lit: '#6b7d6c', veins: '#8d9a7c' };
  const BOX = { rim: '#d8cfb4', glaze: '#3e5a66', glazeLit: '#5b7b86', lacquer: '#1d1613' };

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const s = Math.min(H * 0.44, W * 0.27);
    const px = W * 0.4;
    const py = H * 0.5;
    return { W, H, U, s, px, py, sx: px - s / 2, sy: py - s / 2 };
  }

  function paintTable(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const gr = ctx.createLinearGradient(0, 0, 0, g.H);
    gr.addColorStop(0, TABLE[0]);
    gr.addColorStop(1, TABLE[1]);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#3a2d23';
    for (let i = 0; i < 50; i++) {
      ctx.globalAlpha = 0.35;
      ctx.fillRect(rand() * g.W, rand() * g.H, g.U * (8 + rand() * 24), 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintPaper(ctx, g, rand) {
    const x = g.W * 0.08;
    const y = g.H * 0.1;
    const w = g.W * 0.62;
    const h = g.H * 0.8;
    ctx.fillStyle = WASHI.shadow;
    ctx.fillRect(x + g.U * 1.2, y + g.U * 1.6, w, h);
    ctx.fillStyle = WASHI.base;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = WASHI.fibre;
    for (let i = 0; i < 160; i++) {
      ctx.globalAlpha = 0.3 + rand() * 0.3;
      const fx = x + rand() * w;
      const fy = y + rand() * h;
      ctx.fillRect(fx, fy, g.U * (0.6 + rand() * 1.8), 1);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = WASHI.edge;
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  // Abstract carved strokes in a 2x2 grid of cells: straight bars, hooks and dots, no real characters.
  function carveStrokes(ctx, g, rand) {
    const { s, sx, sy } = g;
    const pad = s * 0.1;
    const cell = (s - pad * 2) / 2;
    ctx.strokeStyle = RED.cut;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i < 2; i++) {
        const x0 = sx + pad + i * cell + cell * 0.14;
        const y0 = sy + pad + j * cell + cell * 0.12;
        const w = cell * 0.72;
        const h = cell * 0.76;
        const n = 3 + Math.floor(rand() * 3);
        for (let k = 0; k < n; k++) {
          ctx.lineWidth = Math.max(1.2, s * (0.028 + rand() * 0.02));
          const yy = y0 + h * ((k + 0.5) / n);
          const xa = x0 + w * rand() * 0.25;
          const xb = x0 + w * (0.6 + rand() * 0.4);
          ctx.beginPath();
          const slant = (rand() - 0.5) * h * 0.22;
          ctx.moveTo(xa, yy + slant * 0.3);
          ctx.lineTo(xb, yy + slant);
          if (rand() < 0.5) ctx.lineTo(xb - w * rand() * 0.3, yy + slant + h * (0.1 + rand() * 0.14));
          else if (rand() < 0.5) ctx.rect(xa + w * rand() * 0.5, yy + h * 0.05, ctx.lineWidth * 0.6, ctx.lineWidth * 0.6);
          ctx.stroke();
        }
        ctx.lineWidth = Math.max(1.2, s * 0.03);
        ctx.beginPath();
        const vx = x0 + w * (0.3 + rand() * 0.4);
        ctx.moveTo(vx, y0 - cell * 0.02);
        ctx.lineTo(vx + (rand() - 0.5) * w * 0.5, y0 + h * (0.5 + rand() * 0.5));
        ctx.stroke();
      }
    }
    // center cross carved lightly between the cells
    ctx.lineWidth = Math.max(1, s * 0.016);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(sx + s / 2, sy + pad);
    ctx.lineTo(sx + s / 2, sy + s - pad);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function paintImpression(ctx, g, rand) {
    const { s, sx, sy } = g;
    ctx.fillStyle = RED.mid;
    ctx.fillRect(sx, sy, s, s);
    // uneven ink: lighter and deeper patches
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = rand() < 0.5 ? RED.deep : RED.lit;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(sx + rand() * s, sy + rand() * s, s * (0.04 + rand() * 0.12), s * (0.03 + rand() * 0.08));
    }
    ctx.globalAlpha = 1;
    // inner border carved as a thin frame line
    ctx.strokeStyle = RED.cut;
    ctx.lineWidth = Math.max(1.2, s * 0.025);
    const b = s * 0.055;
    ctx.strokeRect(sx + b, sy + b, s - b * 2, s - b * 2);
    carveStrokes(ctx, g, rand);
    // chipped edges and pits
    ctx.fillStyle = WASHI.base;
    for (let i = 0; i < 26; i++) {
      const edge = Math.floor(rand() * 4);
      const t = rand() * s;
      const d = rand() * s * 0.025;
      const sz = Math.max(1, s * (0.01 + rand() * 0.02));
      const x = edge === 0 ? sx + t : edge === 1 ? sx + t : edge === 2 ? sx + d : sx + s - d - sz;
      const y = edge === 0 ? sy + d : edge === 1 ? sy + s - d - sz : sy + t;
      ctx.fillRect(x, y, sz, sz);
    }
    for (let i = 0; i < 30; i++) {
      ctx.fillRect(sx + rand() * s, sy + rand() * s, 1, 1);
    }
  }

  function paintStone(ctx, g, rand) {
    const w = g.U * 15;
    const h = g.U * 24;
    const x = g.W * 0.76;
    const y = g.H * 0.22;
    ctx.fillStyle = WASHI.shadow;
    ctx.fillRect(x + g.U * 1.4, y + h - g.U * 0.4, w, g.U * 2);
    const gr = ctx.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, STONE.mid);
    gr.addColorStop(0.45, STONE.lit);
    gr.addColorStop(1, STONE.dark);
    ctx.fillStyle = gr;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = STONE.dark;
    ctx.fillRect(x + w * 0.62, y, w * 0.38, h);
    ctx.strokeStyle = STONE.veins;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 7; i++) {
      const vy = y + h * rand();
      ctx.beginPath();
      ctx.moveTo(x, vy);
      ctx.lineTo(x + w * (0.3 + rand() * 0.6), vy + (rand() - 0.5) * g.U * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // knob: a rounded cap with a small pierced hole
    ctx.fillStyle = STONE.mid;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y - g.U * 2, w * 0.36, g.U * 3.2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = STONE.lit;
    ctx.beginPath();
    ctx.ellipse(x + w * 0.42, y - g.U * 3, w * 0.18, g.U * 1.6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = TABLE[1];
    ctx.fillRect(x + w * 0.46, y - g.U * 2.3, Math.max(1, w * 0.1), g.U * 1.2);
    // red-stained foot where the seal was inked
    ctx.fillStyle = RED.mid;
    ctx.fillRect(x, y + h - g.U * 1.2, w, g.U * 1.2);
  }

  function paintBox(ctx, g, rand) {
    const cx = g.W * 0.84;
    const cy = g.H * 0.68;
    const r = g.U * 12;
    ctx.fillStyle = WASHI.shadow;
    ctx.beginPath();
    ctx.ellipse(cx + g.U * 1.6, cy + g.U * 2.4, r * 1.04, r * 0.5, 0, 0, TAU);
    ctx.fill();
    // porcelain body
    ctx.fillStyle = BOX.glaze;
    ctx.beginPath();
    ctx.ellipse(cx, cy + g.U * 2.4, r, r * 0.48, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(cx - r, cy, r * 2, g.U * 2.4);
    ctx.fillStyle = BOX.glazeLit;
    ctx.fillRect(cx - r * 0.7, cy + g.U * 0.6, r * 0.25, g.U * 1.8);
    ctx.fillStyle = BOX.glaze;
    ctx.beginPath();
    ctx.ellipse(cx, cy + g.U * 2.4, r, r * 0.48, 0, 0, Math.PI);
    ctx.fill();
    // rim and paste
    ctx.fillStyle = BOX.rim;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.48, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = RED.deep;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.82, r * 0.38, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = RED.mid;
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.06, cy - r * 0.04, r * 0.66, r * 0.28, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = RED.lit;
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.24, cy - r * 0.1, r * 0.26, r * 0.1, 0, 0, TAU);
    ctx.fill();
    // lid leaning behind, lacquer black with a gold rim line
    ctx.fillStyle = BOX.lacquer;
    ctx.beginPath();
    ctx.ellipse(cx + r * 1.15, cy - r * 0.55, r * 0.34, r * 0.9, 0.35, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#a8863f';
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    ctx.beginPath();
    ctx.ellipse(cx + r * 1.15, cy - r * 0.55, r * 0.28, r * 0.82, 0.35, 0, TAU);
    ctx.stroke();
  }

  function makeBands(g) {
    const sheen = layer(g.W * 0.4, g.H);
    const s = sheen.getContext('2d');
    const gr = s.createLinearGradient(0, 0, sheen.width, 0);
    gr.addColorStop(0, 'rgba(255,226,170,0)');
    gr.addColorStop(0.5, 'rgba(255,226,170,0.26)');
    gr.addColorStop(1, 'rgba(255,226,170,0)');
    s.fillStyle = gr;
    s.fillRect(0, 0, sheen.width, g.H);
    return sheen;
  }

  function makeMotes(g, rand) {
    const n = MOTES;
    const m = { x: new Float32Array(n), y: new Float32Array(n), s: new Float32Array(n), p: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      m.x[i] = rand() * g.W;
      m.y[i] = rand() * g.H;
      m.s[i] = g.U * (0.4 + rand() * 0.8);
      m.p[i] = rand() * TAU;
    }
    return m;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    const base = paintTable(g, rand);
    const bctx = base.getContext('2d');
    paintPaper(bctx, g, rand);
    paintImpression(bctx, g, rand);
    paintStone(bctx, g, rand);
    paintBox(bctx, g, rand);
    state.base = base;
    state.sheen = makeBands(g);
    state.motes = makeMotes(g, rand);
  }

  function drawLight(ctx, g, t, light) {
    if (light <= 0) return;
    const sheen = state.sheen;
    const travel = g.W + sheen.width;
    const x = (Math.sin(t * 0.12) * 0.5 + 0.5) * travel - sheen.width;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, light * 0.8);
    ctx.drawImage(sheen, x, 0);
    ctx.drawImage(sheen, x + sheen.width * 0.9, 0, sheen.width * 0.3, g.H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawMotes(ctx, g, t, count) {
    const m = state.motes;
    ctx.fillStyle = '#e6cf94';
    const sz = Math.max(1, g.U * 0.4);
    for (let i = 0; i < count; i++) {
      const y = g.H - ((m.y[i] + t * m.s[i]) % g.H);
      const x = m.x[i] + Math.sin(t * 0.3 + m.p[i]) * g.U * 2;
      ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t * 0.5 + m.p[i]);
      ctx.fillRect(x, y, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { light, motes } = api.props;
    ctx.drawImage(state.base, 0, 0);
    drawLight(ctx, g, t, light);
    drawMotes(ctx, g, t, Math.min(MOTES, Math.round(MOTES * motes * 0.7)));
  }

  Kasuri.run({
    defaults: { light: 1, motes: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.2, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
