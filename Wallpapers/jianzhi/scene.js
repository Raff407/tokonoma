/*
 * 剪纸 Jianzhi — red paper-cut flowers pasted on a lattice window.
 *
 * Paper, cut flowers and lattice are baked once, in a cool and a warm tint. Each frame
 * cross-fades the two by a slow breath, so the light behind seems to warm and cool.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const WALL = '#1f1a17';
  const PAPER = { cool: '#b9b8ac', warm: '#f0dcae' };
  const RED = { cool: '#b03624', warm: '#ee5d3a' };
  const WOOD = { dark: '#2b1d14', mid: '#5a3b24', edge: '#9a7840' };
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
    const oh = H * 0.9;
    const ow = Math.min(W * 0.92, oh * 1.7);
    const rows = 3;
    const cols = Math.max(3, Math.round((ow / oh) * rows));
    return { W, H, u: H / 100, ox: (W - ow) / 2, oy: (H - oh) / 2, ow, oh, cols, rows, cw: ow / cols, ch: oh / rows };
  }

  // ---- paper-cut shapes (drawn red, holes punched out) ---------------------

  function petal(ctx, x, y, ang, len, wid) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(len * 0.1, -wid * 1.3, len * 0.9, -wid * 1.3, len, 0);
    ctx.bezierCurveTo(len * 0.9, wid * 1.3, len * 0.1, wid * 1.3, 0, 0);
    ctx.fill();
    ctx.restore();
  }

  function slit(ctx, x, y, ang, from, to, wid) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.ellipse((from + to) / 2, 0, (to - from) / 2, wid, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function dot(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.3, r), 0, TAU);
    ctx.fill();
  }

  function ring(ctx, x, y, r, n, size, off) {
    for (let k = 0; k < n; k++) {
      const a = off + (k / n) * TAU;
      dot(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, size);
    }
  }

  function peony(ctx, x, y, r, rot) {
    const rings = [[8, 1, 0.5], [7, 0.74, 0.5], [6, 0.5, 0.52], [5, 0.3, 0.55]];
    for (const [n, f, w] of rings) {
      for (let k = 0; k < n; k++) petal(ctx, x, y, rot + (k / n) * TAU + f, r * f, r * f * 0.36);
    }
    ctx.globalCompositeOperation = 'destination-out';
    for (const [n, f] of rings.slice(0, 3)) {
      for (let k = 0; k < n; k++) slit(ctx, x, y, rot + (k / n) * TAU + f, r * f * 0.35, r * f * 0.78, Math.max(0.35, r * f * 0.045));
    }
    ring(ctx, x, y, r * 0.2, 6, Math.max(0.4, r * 0.035), rot);
    ctx.globalCompositeOperation = 'source-over';
  }

  function plum(ctx, x, y, r, rot) {
    for (let k = 0; k < 5; k++) {
      const a = rot + (k / 5) * TAU;
      dot(ctx, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.46);
    }
    ctx.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 5; k++) {
      const a = rot + (k / 5) * TAU;
      dot(ctx, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.12);
    }
    ring(ctx, x, y, r * 0.2, 5, Math.max(0.4, r * 0.05), rot + 0.3);
    ctx.globalCompositeOperation = 'source-over';
  }

  function chrysanthemum(ctx, x, y, r, rot) {
    for (let k = 0; k < 18; k++) petal(ctx, x, y, rot + (k / 18) * TAU, r, r * 0.13);
    for (let k = 0; k < 14; k++) petal(ctx, x, y, rot + 0.2 + (k / 14) * TAU, r * 0.7, r * 0.15);
    dot(ctx, x, y, r * 0.3);
    ctx.globalCompositeOperation = 'destination-out';
    ring(ctx, x, y, r * 0.18, 8, Math.max(0.4, r * 0.04), rot);
    dot(ctx, x, y, Math.max(0.4, r * 0.05));
    ctx.globalCompositeOperation = 'source-over';
  }

  function lotus(ctx, x, y, r, rot) {
    for (let k = 0; k < 7; k++) petal(ctx, x, y + r * 0.2, rot - Math.PI / 2 - 1.2 + (k / 6) * 2.4, r, r * 0.26);
    for (let k = 0; k < 5; k++) petal(ctx, x, y + r * 0.25, rot - Math.PI / 2 - 0.8 + (k / 4) * 1.6, r * 0.7, r * 0.22);
    ctx.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 7; k++) slit(ctx, x, y + r * 0.2, rot - Math.PI / 2 - 1.2 + (k / 6) * 2.4, r * 0.3, r * 0.8, Math.max(0.35, r * 0.04));
    ctx.globalCompositeOperation = 'source-over';
  }

  function leaf(ctx, x, y, ang, len) {
    petal(ctx, x, y, ang, len, len * 0.2);
    ctx.globalCompositeOperation = 'destination-out';
    slit(ctx, x, y, ang, len * 0.2, len * 0.85, Math.max(0.3, len * 0.025));
    ctx.globalCompositeOperation = 'source-over';
  }

  function sprig(ctx, x, y, ang, len, lw, side) {
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const ex = x + Math.cos(ang) * len;
    const ey = y + Math.sin(ang) * len;
    ctx.quadraticCurveTo(x + Math.cos(ang + side * 0.6) * len * 0.55, y + Math.sin(ang + side * 0.6) * len * 0.55, ex, ey);
    ctx.stroke();
    leaf(ctx, x + (ex - x) * 0.45, y + (ey - y) * 0.45, ang - side * 0.9, len * 0.5);
    leaf(ctx, ex, ey, ang + side * 0.2, len * 0.45);
  }

  function cornerFlower(ctx, x, y, a0, r) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, a0, a0 + Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    const mid = a0 + Math.PI / 4;
    ring(ctx, x, y, r * 0.55, 1, r * 0.1, mid);
    dot(ctx, x + Math.cos(mid) * r * 0.55, y + Math.sin(mid) * r * 0.55, r * 0.14);
    for (const d of [-0.45, 0.45]) dot(ctx, x + Math.cos(mid + d) * r * 0.7, y + Math.sin(mid + d) * r * 0.7, r * 0.07);
    ctx.globalCompositeOperation = 'source-over';
  }

  const MOTIFS = [peony, plum, chrysanthemum, lotus];

  function cutLayer(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
    ctx.lineCap = 'round';
    const r = Math.min(g.cw, g.ch) * 0.34;
    const lw = Math.max(0.7, r * 0.05);
    for (let j = 0; j < g.rows; j++) {
      for (let i = 0; i < g.cols; i++) {
        const cx = g.ox + (i + 0.5) * g.cw;
        const cy = g.oy + (j + 0.5) * g.ch;
        const h = hash(i, j, 3);
        const centre = j === 1 && i === (g.cols >> 1);
        const motif = centre || (i + j) % 2 === 0 ? peony : MOTIFS[1 + Math.floor(hash(i, j, 5) * 3)];
        const size = centre ? r * 1.2 : r * (0.85 + h * 0.2);
        const rot = h * TAU;
        const side = h < 0.5 ? 1 : -1;
        for (let k = 0; k < 4; k++) sprig(ctx, cx, cy, rot + 0.8 + k * (TAU / 4), size * 1.25, lw, side);
        motif(ctx, cx, cy, size, rot);
        const cr = Math.min(g.cw, g.ch) * 0.13;
        const x0 = g.ox + i * g.cw;
        const y0 = g.oy + j * g.ch;
        cornerFlower(ctx, x0, y0, 0, cr);
        cornerFlower(ctx, x0 + g.cw, y0, Math.PI / 2, cr);
        cornerFlower(ctx, x0 + g.cw, y0 + g.ch, Math.PI, cr);
        cornerFlower(ctx, x0, y0 + g.ch, -Math.PI / 2, cr);
      }
    }
    return c;
  }

  function tinted(shape, color) {
    const c = layer(shape.width, shape.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(shape, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // ---- paper and lattice ---------------------------------------------------

  function paperLayer(g, color, seed) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, g.W, g.H);
    const rand = K.rng(seed);
    ctx.fillStyle = '#000';
    for (let i = 0; i < g.W * g.H * 0.02; i++) {
      ctx.globalAlpha = 0.03 + rand() * 0.05;
      ctx.fillRect(Math.floor(rand() * g.W), Math.floor(rand() * g.H), 1 + (rand() < 0.3 ? 1 : 0), 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function latticeLayer(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = WALL;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.clearRect(g.ox, g.oy, g.ow, g.oh);
    const bar = Math.max(1.4, g.u * 1.1);
    const fr = Math.max(2.4, g.u * 2.6);
    const frame = (x, y, w, h) => {
      ctx.fillStyle = WOOD.dark;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = WOOD.mid;
      ctx.fillRect(x + 0.5, y + 0.5, Math.max(0.5, w - 1.5), Math.max(0.5, h - 1.5));
    };
    for (let i = 1; i < g.cols; i++) frame(g.ox + i * g.cw - bar / 2, g.oy, bar, g.oh);
    for (let j = 1; j < g.rows; j++) frame(g.ox, g.oy + j * g.ch - bar / 2, g.ow, bar);
    frame(g.ox - fr, g.oy - fr, g.ow + fr * 2, fr);
    frame(g.ox - fr, g.oy + g.oh, g.ow + fr * 2, fr);
    frame(g.ox - fr, g.oy - fr, fr, g.oh + fr * 2);
    frame(g.ox + g.ow, g.oy - fr, fr, g.oh + fr * 2);
    ctx.fillStyle = WOOD.edge;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(g.ox - fr, g.oy - fr, g.ow + fr * 2, 0.8);
    ctx.fillRect(g.ox, g.oy, g.ow, 0.8);
    ctx.globalAlpha = 1;
    return c;
  }

  function glowSprite(size) {
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,214,140,0.5)');
    grad.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const shape = cutLayer(g);
    state.g = g;
    state.coolPaper = paperLayer(g, PAPER.cool, 5);
    state.warmPaper = paperLayer(g, PAPER.warm, 5);
    state.coolCut = tinted(shape, RED.cool);
    state.warmCut = tinted(shape, RED.warm);
    state.bars = latticeLayer(g);
    state.glow = glowSprite(Math.ceil(g.oh * 0.9));
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const depth = Math.min(1, 0.5 * api.props.breath);
    const b = 0.5 + depth * Math.sin(t * 0.42);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.coolPaper, 0, 0);
    ctx.globalAlpha = b;
    ctx.drawImage(state.warmPaper, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.coolCut, 0, 0);
    ctx.globalAlpha = b;
    ctx.drawImage(state.warmCut, 0, 0);
    const s = state.glow.width;
    ctx.globalAlpha = 0.25 + 0.5 * b;
    ctx.drawImage(state.glow, g.W * (0.5 + 0.22 * Math.sin(t * 0.09)) - s / 2, g.H * (0.5 + 0.1 * Math.sin(t * 0.13 + 1)) - s / 2);
    ctx.globalAlpha = 1;
    if (api.props.lattice) ctx.drawImage(state.bars, 0, 0);
    else {
      ctx.fillStyle = WALL;
      ctx.fillRect(0, 0, g.W, g.oy);
      ctx.fillRect(0, g.oy + g.oh, g.W, g.H);
      ctx.fillRect(0, 0, g.ox, g.H);
      ctx.fillRect(g.ox + g.ow, 0, g.W, g.H);
    }
  }

  Kasuri.run({
    defaults: { breath: 1, lattice: true, ramp: 'lines', cell: 6, boost: 0.3, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
