/*
 * 青瓷 Qingci — a Longquan celadon bowl with lotus-petal carving and crackle glaze.
 *
 * Room, window-light patch, bowl, carving and crackle are baked once. Each frame
 * the patch of ice-crack lattice light drifts a little on the wall, a soft sheen
 * slides over the bowl through its silhouette mask, and a few gold motes rise.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const MOTES = 16;
  const state = {};

  const WALL = ['#1d232a', '#28313a', '#34403f'];
  const TABLE = ['#4a3a2b', '#2e241b', '#1c1612'];
  const GLAZE = {
    deep: '#5a8070', mid: '#8bb099', lit: '#b3d0b6', rim: '#d3e2c8',
    inFar: '#b0ccb2', inNear: '#62877a', well: '#89ad96', foot: '#6a5038',
  };
  const LIGHT = '#e6cf98';

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
    const rx = Math.min(U * 38, W * 0.34);
    const ry = rx * 0.24;
    const cx = W * 0.5;
    const top = H * 0.42;
    const depth = rx * 0.74;
    const fr = rx * 0.4;
    const fy = top + depth;
    return { W, H, U, rx, ry, cx, top, depth, fr, fy, tableY: fy - U * 3 };
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
        px[j * cols + i] = x0 + (i + (rand() - 0.5) * 0.8) * s;
        py[j * cols + i] = y0 + (j + (rand() - 0.5) * 0.8) * s;
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
    gr.addColorStop(0.65, WALL[1]);
    gr.addColorStop(1, WALL[2]);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, g.W, g.tableY);
    // table: lit front edge, then the top receding into shade
    gr = ctx.createLinearGradient(0, g.tableY, 0, g.H);
    gr.addColorStop(0, TABLE[0]);
    gr.addColorStop(0.4, TABLE[1]);
    gr.addColorStop(1, TABLE[2]);
    ctx.fillStyle = gr;
    ctx.fillRect(0, g.tableY, g.W, g.H - g.tableY);
    ctx.fillStyle = '#6b5640';
    ctx.fillRect(0, g.tableY, g.W, Math.max(1, g.U * 0.6));
    // long wood grain
    const rand = K.rng(5);
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    ctx.strokeStyle = 'rgba(20,14,10,0.45)';
    for (let i = 0; i < 14; i++) {
      const y = g.tableY + g.U * (3 + rand() * (g.H / g.U - g.tableY / g.U - 4));
      const x = rand() * g.W * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + g.W * 0.2, y + g.U * (rand() - 0.5) * 2, x + g.W * (0.3 + rand() * 0.3), y);
      ctx.stroke();
    }
    // warm pool of light under the bowl, and its shadow
    ctx.save();
    ctx.translate(g.cx, g.fy + g.U);
    ctx.scale(1, 0.26);
    const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, g.rx * 2);
    pool.addColorStop(0, 'rgba(200,164,104,0.38)');
    pool.addColorStop(1, 'rgba(200,164,104,0)');
    ctx.fillStyle = pool;
    ctx.fillRect(-g.rx * 2, -g.rx * 2, g.rx * 4, g.rx * 4);
    ctx.restore();
    ctx.save();
    ctx.translate(g.cx + g.U * 3, g.fy + g.U * 0.6);
    ctx.scale(1, 0.24);
    const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, g.fr * 1.7);
    sh.addColorStop(0, 'rgba(8,8,6,0.85)');
    sh.addColorStop(0.6, 'rgba(8,8,6,0.5)');
    sh.addColorStop(1, 'rgba(8,8,6,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(-g.fr * 2, -g.fr * 2, g.fr * 4, g.fr * 4);
    ctx.restore();
    return c;
  }

  // ---- window light on the wall -------------------------------------------

  // A slanted patch of warm light cut by a few thick ice-crack lattice bars, softened by stacking.
  function paintLattice(g, rand) {
    const pw = g.H * 0.5;
    const ph = g.H * 0.36;
    const sharp = layer(pw, ph);
    const s = sharp.getContext('2d');
    s.fillStyle = LIGHT;
    s.fillRect(0, 0, pw, ph);
    s.globalCompositeOperation = 'destination-out';
    s.lineWidth = Math.max(1.5, g.U * 1.9);
    s.lineCap = 'round';
    s.strokeStyle = '#000';
    net(s, 0, 0, pw, ph, g.U * 11, rand, 0.95, 0.4);
    s.lineWidth = Math.max(2, g.U * 2.4);
    s.strokeRect(0, 0, pw, ph);
    // soften with a cheap stacked blur, then fade the edges
    const pad = Math.ceil(g.U * 4);
    const c = layer(pw + pad * 2, ph + pad * 2);
    const ctx = c.getContext('2d');
    const r = Math.max(1, g.U * 0.7);
    ctx.globalAlpha = 1 / 9;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) ctx.drawImage(sharp, pad + i * r, pad + j * r);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'destination-in';
    const f = ctx.createRadialGradient(c.width * 0.5, c.height * 0.5, 0, c.width * 0.5, c.height * 0.5, c.width * 0.62);
    f.addColorStop(0, 'rgba(0,0,0,1)');
    f.addColorStop(0.6, 'rgba(0,0,0,0.75)');
    f.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = f;
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // ---- bowl ---------------------------------------------------------------

  function paintPetals(ctx, g) {
    const n = 9;
    const span = g.rx * 0.9;
    for (let k = 0; k < n; k++) {
      const f = (k / (n - 1)) * 2 - 1;
      const x = g.cx + f * span;
      const edge = Math.sqrt(Math.max(0, 1 - f * f));
      const w = g.rx * 0.13 * (0.35 + 0.65 * edge);
      const baseY = g.top + g.depth * 0.92 - Math.abs(f) * g.depth * 0.18 + g.ry * 0.4 * edge;
      const h = g.depth * 0.52 * (0.55 + 0.45 * edge);
      ctx.beginPath();
      ctx.moveTo(x - w, baseY);
      ctx.quadraticCurveTo(x - w * 1.1, baseY - h * 0.7, x, baseY - h);
      ctx.quadraticCurveTo(x + w * 1.1, baseY - h * 0.7, x + w, baseY);
      ctx.stroke();
    }
  }

  function paintBody(ctx, g, rand) {
    ctx.fillStyle = GLAZE.foot;
    ctx.beginPath();
    ctx.ellipse(g.cx, g.fy, g.fr * 1.02, g.fr * 0.32, 0, 0, TAU);
    ctx.fill();
    const gr = ctx.createLinearGradient(g.cx - g.rx, 0, g.cx + g.rx, 0);
    gr.addColorStop(0, GLAZE.deep);
    gr.addColorStop(0.28, GLAZE.lit);
    gr.addColorStop(0.5, GLAZE.mid);
    gr.addColorStop(1, '#3b5a4e');
    ctx.fillStyle = gr;
    bodyPath(ctx, g);
    ctx.fill();
    const shade = ctx.createLinearGradient(0, g.top, 0, g.fy);
    shade.addColorStop(0, 'rgba(20,34,30,0)');
    shade.addColorStop(0.5, 'rgba(20,34,30,0.1)');
    shade.addColorStop(1, 'rgba(20,34,30,0.5)');
    ctx.fillStyle = shade;
    bodyPath(ctx, g);
    ctx.fill();
    ctx.save();
    bodyPath(ctx, g);
    ctx.clip();
    // carved petals: dark groove with a pale lip above it
    ctx.lineWidth = Math.max(1, g.U * 0.7);
    ctx.strokeStyle = 'rgba(38,66,54,0.75)';
    paintPetals(ctx, g);
    ctx.translate(0, -g.U * 0.5);
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    ctx.strokeStyle = 'rgba(214,232,206,0.45)';
    paintPetals(ctx, g);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // fine crackle, faint
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(46,74,62,0.18)';
    net(ctx, g.cx - g.rx, g.top - g.ry, g.cx + g.rx, g.fy + g.ry, g.U * 5, rand, 0.7, 0.12);
    // glossy highlight down the lit side
    ctx.save();
    ctx.translate(g.cx - g.rx * 0.55, g.top + g.depth * 0.38);
    ctx.rotate(0.35);
    ctx.scale(0.22, 1);
    const hl = ctx.createRadialGradient(0, 0, 0, 0, 0, g.depth * 0.45);
    hl.addColorStop(0, 'rgba(236,240,222,0.5)');
    hl.addColorStop(1, 'rgba(236,240,222,0)');
    ctx.fillStyle = hl;
    ctx.fillRect(-g.depth, -g.depth, g.depth * 2, g.depth * 2);
    ctx.restore();
    ctx.restore();
  }

  // Inside: the far wall catches the window, the near wall sits in the rim's shadow, a well at the bottom.
  function paintInside(ctx, g, rand) {
    const inner = ctx.createLinearGradient(0, g.top - g.ry, 0, g.top + g.ry);
    inner.addColorStop(0, GLAZE.inFar);
    inner.addColorStop(0.55, GLAZE.mid);
    inner.addColorStop(1, GLAZE.inNear);
    ctx.fillStyle = inner;
    mouth(ctx, g, 0.97);
    ctx.fill();
    ctx.save();
    mouth(ctx, g, 0.97);
    ctx.clip();
    const side = ctx.createLinearGradient(g.cx - g.rx, 0, g.cx + g.rx, 0);
    side.addColorStop(0, 'rgba(232,238,214,0.18)');
    side.addColorStop(0.5, 'rgba(232,238,214,0)');
    side.addColorStop(1, 'rgba(24,40,34,0.35)');
    ctx.fillStyle = side;
    ctx.fillRect(g.cx - g.rx, g.top - g.ry, g.rx * 2, g.ry * 2);
    // well, slightly lower than centre, with a pale edge where glaze pools
    const wy = g.top + g.ry * 0.3;
    const well = ctx.createRadialGradient(g.cx, wy, 0, g.cx, wy, g.rx * 0.36);
    well.addColorStop(0, GLAZE.well);
    well.addColorStop(0.7, 'rgba(126,162,140,0.6)');
    well.addColorStop(1, 'rgba(126,162,140,0)');
    ctx.fillStyle = well;
    ctx.beginPath();
    ctx.ellipse(g.cx, wy, g.rx * 0.36, g.ry * 0.42, 0, 0, TAU);
    ctx.fill();
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    ctx.strokeStyle = 'rgba(196,216,190,0.35)';
    ctx.beginPath();
    ctx.ellipse(g.cx, wy, g.rx * 0.3, g.ry * 0.34, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    // shadow under the front lip
    const lip = ctx.createLinearGradient(0, g.top + g.ry * 0.55, 0, g.top + g.ry);
    lip.addColorStop(0, 'rgba(24,40,34,0)');
    lip.addColorStop(1, 'rgba(24,40,34,0.5)');
    ctx.fillStyle = lip;
    ctx.fillRect(g.cx - g.rx, g.top, g.rx * 2, g.ry);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(46,74,62,0.14)';
    net(ctx, g.cx - g.rx, g.top - g.ry, g.cx + g.rx, g.top + g.ry, g.U * 4.4, rand, 0.65, 0.1);
    ctx.restore();
  }

  function paintRim(ctx, g) {
    ctx.lineWidth = Math.max(1, g.U * 0.55);
    ctx.strokeStyle = GLAZE.rim;
    ctx.beginPath();
    ctx.ellipse(g.cx, g.top, g.rx, g.ry, 0, Math.PI * 1.02, Math.PI * 1.98);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(176,204,180,0.85)';
    ctx.beginPath();
    ctx.ellipse(g.cx, g.top, g.rx, g.ry, 0, 0.04, Math.PI - 0.04);
    ctx.stroke();
  }

  function paintBowl(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintBody(ctx, g, rand);
    paintInside(ctx, g, rand);
    paintRim(ctx, g);
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

  // A soft slanted band; the canvas is wide enough that the slant never reaches its edges.
  function paintSheen(mw, mh) {
    const band = mw * 0.32;
    const w = Math.ceil(band * 2 + mh * 0.8);
    const c = layer(w, mh);
    const ctx = c.getContext('2d');
    const mid = w * 0.5;
    const gr = ctx.createLinearGradient(mid - band, 0, mid + band, 0);
    gr.addColorStop(0, 'rgba(246,236,206,0)');
    gr.addColorStop(0.3, 'rgba(246,236,206,0.35)');
    gr.addColorStop(0.5, 'rgba(246,236,206,0.7)');
    gr.addColorStop(0.7, 'rgba(246,236,206,0.35)');
    gr.addColorStop(1, 'rgba(246,236,206,0)');
    ctx.setTransform(1, 0, -0.3, 1, mh * 0.15, 0);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, mh);
    state.sheenBand = band;
    return c;
  }

  function makeMotes(g, rand) {
    const m = { x: new Float32Array(MOTES), y: new Float32Array(MOTES), s: new Float32Array(MOTES), p: new Float32Array(MOTES) };
    for (let i = 0; i < MOTES; i++) {
      m.x[i] = g.W * (0.15 + rand() * 0.7);
      m.y[i] = rand() * g.tableY;
      m.s[i] = g.U * (0.4 + rand() * 0.7);
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
    state.sheen = paintSheen(state.mask.width, state.mask.height);
    state.tmp = layer(state.mask.width, state.mask.height);
    state.motes = makeMotes(g, rand);
  }

  function drawLattice(ctx, g, t, amount) {
    if (amount <= 0) return;
    const l = state.lattice;
    const x = g.W * 0.7 - l.width * 0.5 + Math.sin(t * 0.09) * g.U * 12;
    const y = g.H * 0.04 + Math.sin(t * 0.05 + 1) * g.U * 2;
    ctx.globalAlpha = Math.min(1, amount * (0.38 + 0.08 * Math.sin(t * 0.13)));
    ctx.drawImage(l, x, y);
    ctx.globalAlpha = 1;
  }

  function drawLight(ctx, t, light) {
    if (light <= 0) return;
    const { mask, sheen, tmp } = state;
    const t2 = tmp.getContext('2d');
    const mid = sheen.width * 0.5;
    const span = mask.width * 0.5 + state.sheenBand;
    const x = mask.width * 0.5 - mid + Math.sin(t * 0.2) * span;
    t2.globalCompositeOperation = 'source-over';
    t2.clearRect(0, 0, tmp.width, tmp.height);
    t2.drawImage(sheen, x, 0);
    t2.globalCompositeOperation = 'destination-in';
    t2.drawImage(mask, 0, 0);
    ctx.globalAlpha = Math.min(0.6, light * 0.35);
    ctx.drawImage(tmp, state.ox, state.oy);
    ctx.globalAlpha = 1;
  }

  function drawMotes(ctx, g, t, count) {
    const m = state.motes;
    ctx.fillStyle = '#e0c78a';
    const sz = Math.max(1, g.U * 0.45);
    for (let i = 0; i < count; i++) {
      const y = g.tableY - ((m.y[i] + t * m.s[i] * 0.8) % g.tableY);
      const x = m.x[i] + Math.sin(t * 0.3 + m.p[i]) * g.U * 2;
      ctx.globalAlpha = 0.5 + 0.25 * Math.sin(t * 0.5 + m.p[i]);
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
    drawLight(ctx, t, light);
    drawMotes(ctx, g, t, Math.min(MOTES, Math.round(MOTES * motes * 0.7)));
  }

  Kasuri.run({
    defaults: { light: 1, lattice: 1, motes: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.2, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
