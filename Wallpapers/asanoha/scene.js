/*
 * 麻の葉 Asanoha — sliding doors of hemp-leaf kumiko, lit from behind by paper light,
 * while someone carries a lamp slowly along the far side and maple leaves cast shadows.
 *
 * The lattice, door stiles and floor are one baked layer with holes where the paper shows.
 * Each tick draws the paper, a glow sprite for the lamp, a few leaf sprites, then the
 * lattice on top, so the light slides behind the wood and never touches a single cell.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp } = K;

  const PAPER = { top: '#ad8656', mid: '#c19a64', low: '#9d784a' };
  const WOOD = { frame: '#7b5536', dark: '#573b27', light: '#9c714a', strip: '#4b3323' };
  const LAMP = '#fae9bb';
  const SHADOW = '#57402c';
  const SQRT3 = Math.sqrt(3);
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintGlow(colour, inner) {
    const size = 96;
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const [r, g, b] = K.parseColor(colour);
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(inner, `rgba(${r},${g},${b},0.55)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  function layout(g) {
    const u = g.U;
    const top = g.H * 0.06;
    const bottom = g.H * 0.875;
    const count = Math.max(3, Math.round(g.W / (g.H * 0.4)));
    const doors = [];
    const stile = u * 2.4;
    const koshi = bottom - (bottom - top) * 0.16;
    for (let i = 0; i < count; i++) {
      const x0 = (g.W * i) / count;
      const x1 = (g.W * (i + 1)) / count;
      const inner = { x: x0 + stile, w: x1 - x0 - stile * 2 };
      const y0 = top + stile;
      const y1 = koshi - u * 2;
      const mid = lerp(y0, y1, 0.42);
      doors.push({ x0, x1, inner, panels: [
        { x: inner.x, y: y0, w: inner.w, h: mid - u - y0 },
        { x: inner.x, y: mid + u, w: inner.w, h: y1 - mid - u },
      ], koshi });
    }
    return { top, bottom, doors, stile };
  }

  function paintPaper(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H);
    grad.addColorStop(0, PAPER.top);
    grad.addColorStop(0.5, PAPER.mid);
    grad.addColorStop(1, PAPER.low);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    for (let i = 0; i < g.W * g.H * 0.02; i++) {
      ctx.fillStyle = rand() < 0.5 ? '#d4b27c' : '#93704a';
      ctx.globalAlpha = 0.18;
      ctx.fillRect(rand() * g.W, rand() * g.H, g.U * (0.8 + rand() * 2.5), Math.max(0.6, g.U * 0.3));
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // Vertices of the triangle grid sit on rows h apart, every other row shifted by s/2.
  function vertexX(cx, s, r, j) {
    return cx + (j + (((r % 2) + 2) % 2) * 0.5) * s;
  }

  function traceTriangle(grid, leaves, a, b, c) {
    const mx = (a[0] + b[0] + c[0]) / 3;
    const my = (a[1] + b[1] + c[1]) / 3;
    grid.moveTo(a[0], a[1]);
    grid.lineTo(b[0], b[1]);
    grid.lineTo(c[0], c[1]);
    grid.closePath();
    for (const p of [a, b, c]) {
      leaves.moveTo(p[0], p[1]);
      leaves.lineTo(mx, my);
    }
  }

  function paintKumiko(ctx, g, rect) {
    const s = g.U * 12;
    const h = (s * SQRT3) / 2;
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const grid = new Path2D();
    const leaves = new Path2D();
    const rows = Math.ceil(rect.h / h / 2) + 1;
    const cols = Math.ceil(rect.w / s / 2) + 2;
    for (let r = -rows; r < rows; r++) {
      const y0 = Math.round(cy + r * h) + 0.5;
      const y1 = Math.round(cy + (r + 1) * h) + 0.5;
      for (let j = -cols; j < cols; j++) {
        const bl = vertexX(cx, s, r + 1, j);
        traceTriangle(grid, leaves, [bl, y1], [bl + s, y1], [bl + s / 2, y0]);
        const tl = vertexX(cx, s, r, j);
        traceTriangle(grid, leaves, [tl, y0], [tl + s, y0], [tl + s / 2, y1]);
      }
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    ctx.strokeStyle = WOOD.strip;
    ctx.lineJoin = 'miter';
    ctx.lineWidth = Math.max(0.8, g.U * 0.36);
    ctx.stroke(leaves);
    ctx.lineWidth = Math.max(1, g.U * 0.62);
    ctx.stroke(grid);
    ctx.restore();
  }

  function woodBar(ctx, g, rand, x, y, w, h, vertical) {
    ctx.fillStyle = WOOD.frame;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 0.5;
    const n = Math.ceil((vertical ? h : w) / (g.U * 3));
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = rand() < 0.5 ? WOOD.light : WOOD.dark;
      const a = rand();
      const len = g.U * (4 + rand() * 12);
      if (vertical) ctx.fillRect(x + a * w, y + rand() * h, Math.max(0.5, g.U * 0.3), len);
      else ctx.fillRect(x + rand() * w, y + a * h, len, Math.max(0.5, g.U * 0.3));
    }
    ctx.globalAlpha = 1;
  }

  function paintDoor(ctx, g, rand, d, L) {
    const u = g.U;
    const st = L.stile;
    for (const p of d.panels) paintKumiko(ctx, g, p);
    woodBar(ctx, g, rand, d.x0, L.top, st, L.bottom - L.top, true);
    woodBar(ctx, g, rand, d.x1 - st, L.top, st, L.bottom - L.top, true);
    woodBar(ctx, g, rand, d.x0, L.top, d.x1 - d.x0, st, false);
    woodBar(ctx, g, rand, d.x0, d.panels[0].y + d.panels[0].h, d.x1 - d.x0, u * 2, false);
    woodBar(ctx, g, rand, d.x0, d.koshi - u * 2, d.x1 - d.x0, u * 2, false);
    ctx.fillStyle = '#8a6240';
    ctx.fillRect(d.inner.x, d.koshi, d.inner.w, L.bottom - d.koshi);
    ctx.fillStyle = WOOD.dark;
    ctx.globalAlpha = 0.45;
    for (let x = d.inner.x + u * 3; x < d.inner.x + d.inner.w - u; x += u * 3.2) {
      ctx.fillRect(x, d.koshi, Math.max(0.6, u * 0.35), L.bottom - d.koshi);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#35251a';
    ctx.fillRect(d.x1 - u * 0.4, L.top, u * 0.8, L.bottom - L.top);
  }

  function paintRoomEdges(ctx, g, rand, L) {
    const u = g.U;
    woodBar(ctx, g, rand, 0, 0, g.W, L.top, false);
    ctx.fillStyle = '#3a2a1e';
    ctx.fillRect(0, L.top - u * 0.6, g.W, u * 0.6);
    woodBar(ctx, g, rand, 0, L.bottom, g.W, u * 2.4, false);
    const floor = L.bottom + u * 2.4;
    const grad = ctx.createLinearGradient(0, floor, 0, g.H);
    grad.addColorStop(0, '#8e8556');
    grad.addColorStop(1, '#6b6440');
    ctx.fillStyle = grad;
    ctx.fillRect(0, floor, g.W, g.H - floor);
    ctx.fillStyle = '#5a5436';
    ctx.globalAlpha = 0.45;
    for (let y = floor + u; y < g.H; y += Math.max(1.5, u * 1.1)) ctx.fillRect(0, y, g.W, Math.max(0.5, u * 0.3));
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#3c4a5c';
    ctx.fillRect(0, g.H - u * 2.2, g.W, u * 1.2);
  }

  function paintLattice(g, rand, L) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (const d of L.doors) paintDoor(ctx, g, rand, d, L);
    paintRoomEdges(ctx, g, rand, L);
    return c;
  }

  function mapleLeaf(ctx, x, y, r, a) {
    const tips = [0.6, 0.88, 1, 0.88, 0.6];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, r * 0.15);
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI * 0.5 + (i - 2) * 0.66;
      const len = r * tips[i];
      ctx.lineTo(Math.cos(ang - 0.17) * len * 0.62, Math.sin(ang - 0.17) * len * 0.62);
      ctx.lineTo(Math.cos(ang) * len, Math.sin(ang) * len);
      ctx.lineTo(Math.cos(ang + 0.17) * len * 0.62, Math.sin(ang + 0.17) * len * 0.62);
      if (i < 4) ctx.lineTo(Math.cos(ang + 0.33) * r * 0.42, Math.sin(ang + 0.33) * r * 0.42);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // One maple twig as a flat silhouette; it is drawn twice, offset, for a soft edge.
  function paintBranch(g, rand, leaves, reach) {
    const u = g.U;
    const w = u * reach;
    const c = layer(w + u * 10, u * 52);
    const ctx = c.getContext('2d');
    ctx.fillStyle = SHADOW;
    ctx.strokeStyle = SHADOW;
    ctx.lineCap = 'round';
    ctx.lineWidth = u * 1.1;
    ctx.beginPath();
    ctx.moveTo(0, u * 3);
    ctx.quadraticCurveTo(w * 0.5, u * 5, w * 0.92, u * 24);
    ctx.stroke();
    ctx.lineWidth = Math.max(0.8, u * 0.5);
    for (let i = 0; i < leaves; i++) {
      const k = 0.18 + (i / leaves) * 0.78;
      const bx = lerp(0, w * 0.92, k);
      const by = u * (3 + k * k * 21);
      const lx = bx + (rand() - 0.5) * u * 9;
      const ly = by + u * (9 + rand() * 9);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(lx, ly - u * 4);
      ctx.stroke();
      mapleLeaf(ctx, lx, ly, u * (6.5 + rand() * 2.5), (rand() - 0.5) * 1.2 + Math.PI);
    }
    return c;
  }

  function makeShadows(g, rand) {
    const list = [];
    const spots = [
      { at: 0.02, y: 0.12, reach: 64, leaves: 8, flip: false },
      { at: 0.98, y: 0.26, reach: 56, leaves: 7, flip: true },
      { at: 0.46, y: 0.06, reach: 44, leaves: 5, flip: false },
    ];
    for (const s of spots) {
      const sprite = paintBranch(g, rand, s.leaves, s.reach);
      list.push({ sprite, x: g.W * s.at, y: g.H * s.y, w: sprite.width, h: sprite.height, flip: s.flip, phase: rand() * 6.3 });
    }
    return list;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    const L = layout(g);
    state.g = g;
    state.L = L;
    state.paper = paintPaper(g, rand);
    state.lattice = paintLattice(g, rand, L);
    state.band = paintGlow(LAMP, 0.35);
    state.core = paintGlow('#fff2cc', 0.2);
    state.pool = paintGlow('#e9c983', 0.3);
    state.shadows = makeShadows(g, rand);
  }

  function drawShadow(ctx, g, s, lampX, t, amount) {
    const dx = s.x - lampX;
    const lit = Math.max(0, 1 - Math.abs(dx) / g.H);
    if (amount <= 0) return;
    const sx = s.x + dx * 0.4;
    const a = Math.min(1, (0.3 + lit * 0.65) * amount);
    ctx.save();
    ctx.translate(sx, s.y);
    ctx.rotate(Math.sin(t * 0.35 + s.phase) * 0.035);
    ctx.scale(s.flip ? -1 : 1, 1);
    ctx.globalAlpha = a * 0.35;
    ctx.drawImage(s.sprite, -g.U * 0.8, g.U * 0.5, s.w + g.U * 1.6, s.h + g.U);
    ctx.globalAlpha = a;
    ctx.drawImage(s.sprite, 0, 0, s.w, s.h);
    ctx.restore();
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const L = state.L;
    const glow = api.props.lamp;
    const lampX = g.W * (0.5 + 0.47 * Math.sin(t * 0.045));
    const lampY = g.H * 0.52 + Math.sin(t * 0.6) * g.U * 1.2;
    const breath = glow * (0.93 + 0.07 * Math.sin(t * 0.27));
    ctx.drawImage(state.paper, 0, 0);
    ctx.globalAlpha = Math.min(1, 0.9 * breath);
    ctx.drawImage(state.band, lampX - g.H * 0.55, lampY - g.H * 0.85, g.H * 1.1, g.H * 1.7);
    ctx.globalAlpha = Math.min(1, 0.7 * breath);
    ctx.drawImage(state.core, lampX - g.H * 0.2, lampY - g.H * 0.24, g.H * 0.4, g.H * 0.48);
    for (const s of state.shadows) drawShadow(ctx, g, s, lampX, t, api.props.leaves * Math.min(1, glow));
    ctx.globalAlpha = 1;
    ctx.drawImage(state.lattice, 0, 0);
    ctx.globalAlpha = Math.min(1, 0.75 * breath);
    const floor = L.bottom + g.U * 2.4;
    ctx.drawImage(state.pool, lampX - g.H * 0.5, floor - g.H * 0.05, g.H, g.H * 0.16);
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { lamp: 1, leaves: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.15, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
