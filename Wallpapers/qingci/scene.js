/*
 * 青瓷 Qingci — a Longquan celadon bowl with lotus-petal carving and crackle glaze.
 *
 * The room, bowl, crackle and petals are baked once. Window light is a soft slanted
 * band that slides over the bowl through a mask, plus a faint ice-crack lattice of
 * light on the wall that sways, and a few gold motes drifting up.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const MOTES = 18;
  const state = {};

  const WALL = ['#14181d', '#1b2229', '#243038'];
  const TABLE = ['#201a15', '#15110e'];
  const GLAZE = { deep: '#5f8573', mid: '#86ab94', lit: '#a9c7ae', rim: '#c9dac0', foot: '#5a4636' };

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
    const rx = Math.min(U * 40, W * 0.36);
    const ry = rx * 0.3;
    const cx = W * 0.5;
    const top = H * 0.4;
    const depth = rx * 0.78;
    const fr = rx * 0.4;
    const fy = top + depth;
    return { W, H, U, rx, ry, cx, top, depth, fr, fy, tableY: fy - U * 2.5 };
  }

  // Outline of the bowl body: left rim, down the curve to the foot, up the right side, along the front rim.
  function bodyPath(ctx, g) {
    const { cx, rx, ry, top, depth, fr, fy } = g;
    ctx.beginPath();
    ctx.moveTo(cx - rx, top);
    ctx.bezierCurveTo(cx - rx * 0.96, top + depth * 0.5, cx - fr * 1.9, fy - depth * 0.12, cx - fr, fy);
    ctx.ellipse(cx, fy, fr, fr * 0.3, 0, Math.PI, 0, true);
    ctx.bezierCurveTo(cx + fr * 1.9, fy - depth * 0.12, cx + rx * 0.96, top + depth * 0.5, cx + rx, top);
    ctx.ellipse(cx, top, rx, ry, 0, 0, Math.PI);
    ctx.closePath();
  }

  function mouth(ctx, g, k) {
    ctx.beginPath();
    ctx.ellipse(g.cx, g.top, g.rx * k, g.ry * k, 0, 0, TAU);
  }

  // Jittered grid joined into an irregular net, like cracked ice.
  function net(ctx, x0, y0, x1, y1, s, rand, keep, diag) {
    const cols = Math.ceil((x1 - x0) / s) + 2;
    const rows = Math.ceil((y1 - y0) / s) + 2;
    const px = new Float32Array(cols * rows);
    const py = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        px[j * cols + i] = x0 + (i + (rand() - 0.5) * 0.9) * s;
        py[j * cols + i] = y0 + (j + (rand() - 0.5) * 0.9) * s;
      }
    }
    ctx.beginPath();
    for (let j = 0; j < rows - 1; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const a = j * cols + i;
        if (rand() < keep) { ctx.moveTo(px[a], py[a]); ctx.lineTo(px[a + 1], py[a + 1]); }
        if (rand() < keep) { ctx.moveTo(px[a], py[a]); ctx.lineTo(px[a + cols], py[a + cols]); }
        if (rand() < diag) { ctx.moveTo(px[a], py[a]); ctx.lineTo(px[a + cols + 1], py[a + cols + 1]); }
      }
    }
    ctx.stroke();
  }

  // ---- room ---------------------------------------------------------------

  function paintRoom(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    let gr = ctx.createLinearGradient(0, 0, 0, g.tableY);
    gr.addColorStop(0, WALL[0]);
    gr.addColorStop(0.6, WALL[1]);
    gr.addColorStop(1, WALL[2]);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, g.W, g.tableY);
    gr = ctx.createLinearGradient(0, g.tableY, 0, g.H);
    gr.addColorStop(0, TABLE[0]);
    gr.addColorStop(1, TABLE[1]);
    ctx.fillStyle = gr;
    ctx.fillRect(0, g.tableY, g.W, g.H - g.tableY);
    ctx.fillStyle = '#3a3027';
    ctx.fillRect(0, g.tableY, g.W, Math.max(1, g.U * 0.35));
    // table wood grain
    const rand = K.rng(5);
    ctx.fillStyle = '#2a221b';
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.5;
      ctx.fillRect(rand() * g.W, g.tableY + g.U * (1 + rand() * 40), g.U * (6 + rand() * 18), 1);
    }
    ctx.globalAlpha = 1;
    // warm pool of light under the bowl, and its shadow
    const pool = ctx.createRadialGradient(g.cx, g.fy + g.U, 0, g.cx, g.fy + g.U, g.rx * 1.9);
    pool.addColorStop(0, 'rgba(176,140,80,0.34)');
    pool.addColorStop(1, 'rgba(176,140,80,0)');
    ctx.fillStyle = pool;
    ctx.save();
    ctx.translate(g.cx, g.fy + g.U);
    ctx.scale(1, 0.28);
    ctx.translate(-g.cx, -(g.fy + g.U));
    ctx.fillRect(0, 0, g.W, g.H * 4);
    ctx.restore();
    ctx.fillStyle = 'rgba(6,8,8,0.8)';
    ctx.beginPath();
    ctx.ellipse(g.cx + g.U, g.fy + g.U * 0.6, g.fr * 1.35, g.fr * 0.34, 0, 0, TAU);
    ctx.fill();
    return c;
  }

  // ---- bowl ---------------------------------------------------------------

  function paintPetals(ctx, g) {
    const n = 9;
    const span = g.rx * 0.92;
    for (let k = 0; k < n; k++) {
      const f = (k / (n - 1)) * 2 - 1;
      const x = g.cx + f * span;
      const edge = Math.sqrt(Math.max(0, 1 - f * f));
      const w = g.rx * 0.2 * (0.35 + 0.65 * edge);
      const baseY = g.top + g.depth * 0.92 - Math.abs(f) * g.depth * 0.16 + g.ry * 0.5 * edge;
      const h = g.depth * 0.5 * (0.55 + 0.45 * edge);
      ctx.beginPath();
      ctx.moveTo(x - w, baseY);
      ctx.quadraticCurveTo(x - w * 1.05, baseY - h * 0.7, x, baseY - h);
      ctx.quadraticCurveTo(x + w * 1.05, baseY - h * 0.7, x + w, baseY);
      ctx.stroke();
    }
  }

  function paintBowl(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    // foot ring, unglazed iron-brown
    ctx.fillStyle = GLAZE.foot;
    ctx.beginPath();
    ctx.ellipse(g.cx, g.fy, g.fr * 1.02, g.fr * 0.32, 0, 0, TAU);
    ctx.fill();
    // outer body
    const gr = ctx.createLinearGradient(g.cx - g.rx, 0, g.cx + g.rx, 0);
    gr.addColorStop(0, GLAZE.deep);
    gr.addColorStop(0.3, GLAZE.mid);
    gr.addColorStop(0.5, GLAZE.lit);
    gr.addColorStop(0.78, GLAZE.mid);
    gr.addColorStop(1, '#46665a');
    ctx.fillStyle = gr;
    bodyPath(ctx, g);
    ctx.fill();
    const shade = ctx.createLinearGradient(0, g.top, 0, g.fy);
    shade.addColorStop(0, 'rgba(20,34,30,0)');
    shade.addColorStop(1, 'rgba(20,34,30,0.5)');
    ctx.fillStyle = shade;
    bodyPath(ctx, g);
    ctx.fill();
    // carving and crackle, clipped to the body
    ctx.save();
    bodyPath(ctx, g);
    ctx.clip();
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.strokeStyle = 'rgba(30,56,46,0.9)';
    paintPetals(ctx, g);
    ctx.translate(0, -g.U * 0.35);
    ctx.strokeStyle = 'rgba(215,232,208,0.6)';
    paintPetals(ctx, g);
    ctx.translate(0, g.U * 0.35);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(48,76,64,0.4)';
    net(ctx, g.cx - g.rx, g.top - g.ry, g.cx + g.rx, g.fy + g.ry, g.U * 4.4, rand, 0.8, 0.15);
    ctx.restore();
    // inside of the bowl
    const inner = ctx.createLinearGradient(0, g.top - g.ry, 0, g.top + g.ry);
    inner.addColorStop(0, GLAZE.lit);
    inner.addColorStop(0.55, GLAZE.mid);
    inner.addColorStop(1, '#4f7566');
    ctx.fillStyle = inner;
    mouth(ctx, g, 0.97);
    ctx.fill();
    ctx.save();
    mouth(ctx, g, 0.97);
    ctx.clip();
    ctx.fillStyle = 'rgba(30,52,44,0.5)';
    ctx.beginPath();
    ctx.ellipse(g.cx, g.top + g.ry * 0.42, g.rx * 0.55, g.ry * 0.5, 0, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(40,68,56,0.38)';
    net(ctx, g.cx - g.rx, g.top - g.ry, g.cx + g.rx, g.top + g.ry, g.U * 3.6, rand, 0.78, 0.15);
    ctx.restore();
    // rim catches the light
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    ctx.strokeStyle = GLAZE.rim;
    ctx.beginPath();
    ctx.ellipse(g.cx, g.top, g.rx, g.ry, 0, Math.PI * 1.02, Math.PI * 1.98);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(130,166,146,0.8)';
    ctx.beginPath();
    ctx.ellipse(g.cx, g.top, g.rx, g.ry, 0, 0.05, Math.PI - 0.05);
    ctx.stroke();
    return c;
  }

  // The bowl's own silhouette, used to keep window light inside it.
  function paintMask(g) {
    const m = layer(g.rx * 2 + 4, g.depth + g.ry * 2 + g.fr * 0.4 + 4);
    const ctx = m.getContext('2d');
    state.ox = Math.floor(g.cx - g.rx - 2);
    state.oy = Math.floor(g.top - g.ry - 2);
    ctx.translate(-state.ox, -state.oy);
    ctx.fillStyle = '#fff';
    bodyPath(ctx, g);
    ctx.fill();
    mouth(ctx, g, 1);
    ctx.fill();
    return m;
  }

  function paintSheen(g, mw, mh) {
    const w = Math.ceil(mw * 0.5);
    const c = layer(w, mh);
    const ctx = c.getContext('2d');
    const gr = ctx.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, 'rgba(255,244,214,0)');
    gr.addColorStop(0.45, 'rgba(255,244,214,0.55)');
    gr.addColorStop(0.55, 'rgba(255,244,214,0.55)');
    gr.addColorStop(1, 'rgba(255,244,214,0)');
    ctx.fillStyle = gr;
    ctx.setTransform(1, 0, -0.35, 1, mh * 0.17, 0);
    ctx.fillRect(-mh, 0, w + mh * 2, mh);
    return c;
  }

  // ---- window light on the wall -------------------------------------------

  function paintLattice(g, rand) {
    const w = Math.ceil(g.W * 1.3);
    const h = Math.ceil(g.tableY);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.lineWidth = Math.max(1, g.U * 0.6);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#d9bd78';
    net(ctx, 0, 0, w, h, g.U * 9, rand, 0.82, 0.3);
    // fade the net toward the edges so it reads as a patch of light
    ctx.globalCompositeOperation = 'destination-in';
    const f = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, w * 0.5);
    f.addColorStop(0, 'rgba(0,0,0,1)');
    f.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = f;
    ctx.fillRect(0, 0, w, h);
    return c;
  }

  function makeMotes(g, rand) {
    const m = { x: new Float32Array(MOTES), y: new Float32Array(MOTES), s: new Float32Array(MOTES), p: new Float32Array(MOTES) };
    for (let i = 0; i < MOTES; i++) {
      m.x[i] = rand() * g.W;
      m.y[i] = rand() * g.tableY;
      m.s[i] = g.U * (0.5 + rand() * 0.9);
      m.p[i] = rand() * TAU;
    }
    return m;
  }

  // ---- run ----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.room = paintRoom(g);
    state.lattice = paintLattice(g, rand);
    state.bowl = paintBowl(g, rand);
    state.mask = paintMask(g);
    state.sheen = paintSheen(g, state.mask.width, state.mask.height);
    state.tmp = layer(state.mask.width, state.mask.height);
    state.motes = makeMotes(g, rand);
  }

  function drawLight(ctx, g, t, light) {
    if (light <= 0) return;
    const { mask, sheen, tmp } = state;
    const t2 = tmp.getContext('2d');
    const travel = mask.width + sheen.width;
    const x = (Math.sin(t * 0.16) * 0.5 + 0.5) * travel - sheen.width;
    t2.globalCompositeOperation = 'source-over';
    t2.clearRect(0, 0, tmp.width, tmp.height);
    t2.drawImage(sheen, x, 0);
    t2.globalCompositeOperation = 'destination-in';
    t2.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, light * 0.7);
    ctx.drawImage(tmp, state.ox, state.oy);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawLattice(ctx, g, t, lattice) {
    if (lattice <= 0) return;
    const l = state.lattice;
    const sway = Math.sin(t * 0.09) * g.W * 0.12;
    ctx.globalAlpha = Math.min(1, lattice * (0.2 + 0.06 * Math.sin(t * 0.21)));
    ctx.drawImage(l, -g.W * 0.15 + sway, 0);
    ctx.globalAlpha = 1;
  }

  function drawMotes(ctx, g, t, count) {
    const m = state.motes;
    ctx.fillStyle = '#e0c78a';
    const sz = Math.max(1, g.U * 0.4);
    for (let i = 0; i < count; i++) {
      const y = g.tableY - ((m.y[i] * 1 + t * m.s[i] * 0.8) % g.tableY);
      const x = m.x[i] + Math.sin(t * 0.3 + m.p[i]) * g.U * 2;
      ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t * 0.5 + m.p[i]);
      ctx.fillRect(x, y, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { light, lattice, motes } = api.props;
    ctx.drawImage(state.room, 0, 0);
    drawLattice(ctx, g, t, lattice);
    ctx.drawImage(state.bowl, 0, 0);
    drawLight(ctx, g, t, light);
    drawMotes(ctx, g, t, Math.min(MOTES, Math.round(MOTES * motes * 0.7)));
  }

  Kasuri.run({
    defaults: { light: 1, lattice: 1, motes: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.2, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
