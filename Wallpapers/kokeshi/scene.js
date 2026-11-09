/*
 * こけし Kokeshi — small wooden dolls on a shelf beside a rainy window.
 *
 * Room, street, dolls and lamp glow are baked once. Each frame only rain,
 * a few beads on the glass, the wind bell and the curtain move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp } = K;

  const MAX_DROPS = 160;
  const MAX_BEADS = 8;
  const WIN = { x0: 0.07, x1: 0.47, y0: 0.1, y1: 0.74 };
  const SHELF = { x0: 0.53, x1: 0.95, up: 0.5, low: 0.8 };
  const DOLLS = [
    { f: 0.06, h: 27, pal: 0, shelf: 'up' },
    { f: 0.19, h: 20, pal: 1, shelf: 'up' },
    { f: 0.32, h: 25, pal: 2, shelf: 'up' },
    { f: 0.45, h: 18, pal: 3, shelf: 'up' },
    { f: 0.6, h: 22, pal: 0, shelf: 'up' },
    { f: 0.07, h: 13, pal: 3, shelf: 'low' },
    { f: 0.19, h: 10, pal: 2, shelf: 'low' },
    { f: 0.31, h: 12, pal: 1, shelf: 'low' },
    { f: 0.44, h: 9, pal: 0, shelf: 'low' },
    { f: 0.57, h: 11, pal: 3, shelf: 'low' },
    { f: 0.7, h: 13, pal: 2, shelf: 'low' },
    { f: 0.83, h: 10, pal: 1, shelf: 'low' },
  ];
  const PALS = [
    { body: '#b8442c', obi: '#d0a84a', dot: '#e4d8b8', hem: '#2c3f6a' },
    { body: '#2c3f6a', obi: '#b8442c', dot: '#d8ceb4', hem: '#d0a84a' },
    { body: '#4f6a44', obi: '#e4d8b8', dot: '#d0a84a', hem: '#b8442c' },
    { body: '#d8ceb4', obi: '#2c3f6a', dot: '#b8442c', hem: '#4f6a44' },
  ];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const u = H / 100;
    const wx0 = Math.round(W * WIN.x0);
    const wx1 = Math.round(W * WIN.x1);
    const wy0 = Math.round(H * WIN.y0);
    const wy1 = Math.round(H * WIN.y1);
    return { W, H, u, wx0, wx1, wy0, wy1, ww: wx1 - wx0, wh: wy1 - wy0 };
  }

  // ---- street seen through the glass ----------------------------------------

  function paintStreet(g, rand) {
    const c = layer(g.ww, g.wh);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.wh);
    sky.addColorStop(0, '#1a2136');
    sky.addColorStop(1, '#34415c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.ww, g.wh);
    // Tiled roofs: a row of gabled houses with tall ridge ends.
    let x = -g.u * 2;
    while (x < g.ww) {
      const w = g.u * (14 + rand() * 12);
      const top = g.wh * (0.5 + rand() * 0.14);
      ctx.fillStyle = '#10141e';
      ctx.beginPath();
      ctx.moveTo(x, g.wh);
      ctx.lineTo(x, top + g.u * 3);
      ctx.lineTo(x + g.u * 0.8, top + g.u * 2.2);
      ctx.lineTo(x + w * 0.5, top);
      ctx.lineTo(x + w - g.u * 0.8, top + g.u * 2.2);
      ctx.lineTo(x + w, top + g.u * 3);
      ctx.lineTo(x + w, g.wh);
      ctx.fill();
      ctx.fillStyle = '#242c40';
      for (let k = 1; k < 4; k++) ctx.fillRect(x + w * 0.1, top + g.u * (1.2 + k * 1.3), w * 0.8, 1);
      if (rand() < 0.65) {
        ctx.fillStyle = rand() < 0.5 ? '#c9a24a' : '#9a7a40';
        ctx.fillRect(x + w * (0.25 + rand() * 0.3), top + g.u * 5.5, g.u * 2.2, g.u * 3);
      }
      x += w;
    }
    // A pole with wires, and a red paper lantern glowing under an eave.
    ctx.fillStyle = '#0c1018';
    ctx.fillRect(g.ww * 0.78, g.wh * 0.18, Math.max(1, g.u * 0.7), g.wh);
    ctx.fillRect(g.ww * 0.7, g.wh * 0.24, g.u * 14, 1);
    ctx.strokeStyle = '#0c1018';
    ctx.beginPath();
    ctx.moveTo(0, g.wh * 0.3);
    ctx.quadraticCurveTo(g.ww * 0.4, g.wh * 0.38, g.ww * 0.78, g.wh * 0.24);
    ctx.stroke();
    const lx = g.ww * 0.3;
    const ly = g.wh * 0.78;
    const halo = ctx.createRadialGradient(lx, ly, 0, lx, ly, g.u * 11);
    halo.addColorStop(0, 'rgba(200,80,50,0.5)');
    halo.addColorStop(1, 'rgba(200,80,50,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(lx - g.u * 11, ly - g.u * 11, g.u * 22, g.u * 22);
    ctx.fillStyle = '#b8442c';
    ctx.fillRect(lx - g.u * 1.2, ly - g.u * 1.8, g.u * 2.4, g.u * 3.6);
    ctx.fillStyle = '#10141e';
    ctx.fillRect(lx - g.u * 1.2, ly - g.u * 1.8, g.u * 2.4, 1);
    ctx.fillRect(lx - g.u * 1.2, ly + g.u * 1.8, g.u * 2.4, 1);
    return c;
  }

  // ---- room ------------------------------------------------------------------

  function paintWall(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const wall = ctx.createLinearGradient(0, 0, 0, g.H);
    wall.addColorStop(0, '#2a241f');
    wall.addColorStop(1, '#3a2f26');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, g.W, g.H);
    // Tatami floor with dark borders.
    const fy = Math.round(g.H * 0.88);
    ctx.fillStyle = '#4a5636';
    ctx.fillRect(0, fy, g.W, g.H - fy);
    ctx.fillStyle = '#16140f';
    ctx.fillRect(0, fy, g.W, Math.max(1, g.u * 1.2));
    for (let x = g.W * 0.12; x < g.W; x += g.W * 0.36) ctx.fillRect(x, fy, Math.max(1, g.u * 0.5), g.H - fy);
    ctx.fillStyle = '#5c6842';
    for (let y = fy + g.u * 2.5; y < g.H; y += g.u * 1.6) ctx.fillRect(0, y, g.W, 1);
    return c;
  }

  function paintFrame(ctx, g) {
    const t = Math.max(2, Math.round(g.u * 1.5));
    ctx.fillStyle = '#4a3322';
    ctx.fillRect(g.wx0 - t, g.wy0 - t, g.ww + t * 2, t);
    ctx.fillRect(g.wx0 - t, g.wy0, t, g.wh);
    ctx.fillRect(g.wx1, g.wy0, t, g.wh);
    // Lattice bars in the glass.
    ctx.fillStyle = '#35241a';
    const bar = Math.max(1, Math.round(g.u * 0.7));
    for (let i = 1; i < 3; i++) ctx.fillRect(g.wx0 + (g.ww * i) / 3 - bar / 2, g.wy0, bar, g.wh);
    ctx.fillRect(g.wx0, g.wy0 + g.wh * 0.5 - bar / 2, g.ww, bar);
    // Sill.
    ctx.fillStyle = '#5c4129';
    ctx.fillRect(g.wx0 - t * 2, g.wy1, g.ww + t * 4, Math.max(2, g.u * 2));
    ctx.fillStyle = '#7a5a3c';
    ctx.fillRect(g.wx0 - t * 2, g.wy1, g.ww + t * 4, 1);
  }

  function shelfY(g, which) {
    return Math.round(g.H * SHELF[which]);
  }

  function paintShelf(ctx, g) {
    const x0 = g.W * SHELF.x0 - g.u * 2;
    const w = g.W * (SHELF.x1 - SHELF.x0) + g.u * 4;
    for (const which of ['up', 'low']) {
      const y = shelfY(g, which);
      ctx.fillStyle = '#5c4129';
      ctx.fillRect(x0, y, w, Math.max(2, g.u * 2));
      ctx.fillStyle = '#7a5a3c';
      ctx.fillRect(x0, y, w, 1);
      ctx.fillStyle = '#2a1e16';
      ctx.fillRect(x0 + g.u * 2, y + g.u * 2, w - g.u * 4, Math.max(1, g.u * 0.8));
    }
    // Side boards of the shelf unit.
    ctx.fillStyle = '#4a3322';
    ctx.fillRect(x0, g.H * 0.12, Math.max(2, g.u * 1.3), shelfY(g, 'low') - g.H * 0.12 + g.u * 2);
    ctx.fillRect(x0 + w - Math.max(2, g.u * 1.3), g.H * 0.12, Math.max(2, g.u * 1.3), shelfY(g, 'low') - g.H * 0.12 + g.u * 2);
    ctx.fillRect(x0, g.H * 0.12, w, Math.max(2, g.u * 1.3));
  }

  // One doll: tapered wooden body, round head, black bob, red headband.
  function paintDoll(ctx, g, cx, base, h, pal, seed) {
    const bw = h * 0.3;
    const r = h * 0.19;
    const head = base - h + r;
    const neck = head + r * 0.8;
    ctx.fillStyle = pal.body;
    ctx.beginPath();
    ctx.moveTo(cx - bw * 0.36, neck);
    ctx.lineTo(cx + bw * 0.36, neck);
    ctx.lineTo(cx + bw * 0.5, base);
    ctx.lineTo(cx - bw * 0.5, base);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(cx + bw * 0.14, neck, bw * 0.32, base - neck);
    ctx.fillStyle = pal.hem;
    ctx.fillRect(cx - bw * 0.5, base - Math.max(1, h * 0.06), bw, Math.max(1, h * 0.06));
    ctx.fillStyle = pal.obi;
    ctx.fillRect(cx - bw * 0.43, neck + (base - neck) * 0.28, bw * 0.86, Math.max(1, h * 0.1));
    // Flowers on the kimono.
    ctx.fillStyle = pal.dot;
    const rows = h > 14 ? 2 : 1;
    for (let k = 0; k < rows; k++) {
      const py = neck + (base - neck) * (0.58 + k * 0.2);
      ctx.fillRect(cx - bw * 0.25, py, Math.max(1, h * 0.05), Math.max(1, h * 0.05));
      ctx.fillRect(cx + bw * 0.12, py + h * 0.03, Math.max(1, h * 0.05), Math.max(1, h * 0.05));
    }
    ctx.fillRect(cx - bw * 0.05, neck + (base - neck) * 0.1, Math.max(1, h * 0.05), Math.max(1, h * 0.05));
    // Head, hair, band, face.
    ctx.fillStyle = '#e6d2ae';
    ctx.beginPath();
    ctx.arc(cx, head, r, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#14110f';
    ctx.beginPath();
    ctx.arc(cx, head, r + 0.5, 3.14, 6.28);
    ctx.fill();
    ctx.fillRect(cx - r - 0.5, head, Math.max(1, r * 0.3), r * 0.5);
    ctx.fillRect(cx + r - Math.max(1, r * 0.3) + 0.5, head, Math.max(1, r * 0.3), r * 0.5);
    ctx.fillStyle = '#b8442c';
    ctx.fillRect(cx - r * 0.9, head - r * 0.28, r * 1.8, Math.max(1, r * 0.22));
    ctx.fillStyle = '#14110f';
    const eye = Math.max(1, h * 0.04);
    ctx.fillRect(cx - r * 0.45, head + r * 0.15, eye, eye);
    ctx.fillRect(cx + r * 0.45 - eye, head + r * 0.15, eye, eye);
    ctx.fillStyle = '#b8442c';
    ctx.fillRect(cx - eye / 2, head + r * 0.55, eye, 1);
    if (seed % 2 === 0) {
      ctx.fillStyle = '#d0a84a';
      ctx.fillRect(cx + r * 0.5, head - r * 1.0, Math.max(1, r * 0.35), Math.max(1, r * 0.35));
    }
  }

  function paintDolls(ctx, g) {
    const x0 = g.W * SHELF.x0;
    const span = g.W * (SHELF.x1 - SHELF.x0);
    DOLLS.forEach((d, i) => {
      const base = shelfY(g, d.shelf);
      paintDoll(ctx, g, x0 + span * d.f, base, d.h * g.u, PALS[d.pal], i);
    });
  }

  // Paper floor lamp on the upper shelf.
  function lampBox(g) {
    const w = g.u * 11;
    const h = g.u * 21;
    const cx = g.W * SHELF.x0 + g.W * (SHELF.x1 - SHELF.x0) * 0.85;
    return { cx, w, h, base: shelfY(g, 'up'), cy: shelfY(g, 'up') - h / 2 };
  }

  function paintLamp(ctx, g) {
    const b = lampBox(g);
    const x = b.cx - b.w / 2;
    const y = b.base - b.h;
    ctx.fillStyle = '#f0d49a';
    ctx.fillRect(x, y, b.w, b.h);
    ctx.fillStyle = '#d9b274';
    ctx.fillRect(x + b.w * 0.1, y, b.w * 0.2, b.h);
    ctx.fillStyle = '#3a2a1e';
    const bar = Math.max(1, g.u * 0.7);
    ctx.fillRect(x - bar, y - bar, b.w + bar * 2, bar);
    ctx.fillRect(x - bar, y + b.h - bar, b.w + bar * 2, bar * 2);
    ctx.fillRect(x - bar, y, bar, b.h);
    ctx.fillRect(x + b.w, y, bar, b.h);
    for (let i = 1; i < 3; i++) ctx.fillRect(x + (b.w * i) / 3, y, 1, b.h);
    ctx.fillRect(x, y + b.h * 0.5, b.w, 1);
  }

  function paintGlow(g) {
    const b = lampBox(g);
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const r = g.u * 52;
    const grad = ctx.createRadialGradient(b.cx, b.cy, 0, b.cx, b.cy, r);
    grad.addColorStop(0, 'rgba(255,196,110,0.7)');
    grad.addColorStop(0.35, 'rgba(240,160,80,0.34)');
    grad.addColorStop(1, 'rgba(240,160,80,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.drawImage(state.wall, 0, 0);
    ctx.drawImage(state.street, g.wx0, g.wy0);
    paintFrame(ctx, g);
    paintShelf(ctx, g);
    paintDolls(ctx, g);
    paintLamp(ctx, g);
    return c;
  }

  // ---- curtain ---------------------------------------------------------------

  function curtainBox(g) {
    const w = Math.round(g.ww * 0.17);
    const top = g.wy0 - Math.round(g.u * 2.5);
    return { x: g.wx1 - w + Math.round(g.u * 3), top, w, h: g.wy1 + Math.round(g.u * 6) - top };
  }

  function paintCurtain(g) {
    const b = curtainBox(g);
    const c = layer(b.w, b.h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#b8ab8c';
    ctx.fillRect(0, 0, b.w, b.h);
    for (let x = 0; x < b.w; x++) {
      const fold = Math.sin((x / b.w) * 6.28 * 3.5);
      ctx.fillStyle = fold > 0 ? 'rgba(255,240,210,0.18)' : 'rgba(40,30,20,0.22)';
      ctx.globalAlpha = Math.abs(fold);
      ctx.fillRect(x, 0, 1, b.h);
    }
    ctx.globalAlpha = 1;
    // A narrow indigo band near the hem.
    ctx.fillStyle = '#2c3f6a';
    ctx.fillRect(0, b.h * 0.82, b.w, Math.max(1, g.u * 1.2));
    ctx.fillStyle = '#3a2a1e';
    ctx.fillRect(0, 0, b.w, Math.max(1, g.u * 0.9));
    return c;
  }

  function drawCurtain(ctx, g, t, breeze) {
    const b = curtainBox(g);
    const art = state.curtain;
    ctx.globalAlpha = 0.9;
    for (let s = 0; s < art.height; s += 2) {
      const k = s / art.height;
      const gust = Math.sin(t * 0.7) * 0.6 + Math.sin(t * 1.9 + k * 3) * 0.4;
      const wave = (0.5 + gust * 0.5) * g.u * 3.2 * k * breeze;
      ctx.drawImage(art, 0, s, art.width, 2, b.x - wave, b.top + s, art.width, 2);
    }
    ctx.globalAlpha = 1;
  }

  // ---- wind bell ------------------------------------------------------------

  function drawBell(ctx, g, t, breeze) {
    const bx = g.wx0 + g.ww * 0.2;
    const by = g.wy0;
    const len = g.u * 5;
    const swing = Math.sin(t * 1.3 + Math.sin(t * 0.4) * 2) * 0.28 * Math.min(1.5, breeze + 0.15);
    const ex = bx + Math.sin(swing) * len;
    const ey = by + Math.cos(swing) * len;
    ctx.strokeStyle = '#d9cfb4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.fillStyle = '#8fa3c0';
    ctx.beginPath();
    ctx.arc(ex, ey + g.u * 2.6, g.u * 2.4, 3.14, 6.28);
    ctx.fill();
    ctx.fillRect(ex - g.u * 2.4, ey + g.u * 2.6, g.u * 4.8, Math.max(1, g.u * 0.6));
    ctx.save();
    ctx.translate(ex, ey + g.u * 3.2);
    ctx.rotate(swing * 1.6 + Math.sin(t * 2.1) * 0.12 * breeze);
    ctx.fillStyle = '#b8442c';
    ctx.fillRect(-g.u * 0.5, g.u * 0.4, Math.max(1, g.u * 1), g.u * 5);
    ctx.restore();
  }

  // ---- rain -----------------------------------------------------------------

  function makeRain(g, rand) {
    const n = MAX_DROPS;
    const r = {
      x: new Float32Array(n), y: new Float32Array(n), v: new Float32Array(n), len: new Float32Array(n),
      bx: new Float32Array(MAX_BEADS), by: new Float32Array(MAX_BEADS), bv: new Float32Array(MAX_BEADS),
    };
    for (let i = 0; i < n; i++) {
      r.x[i] = rand() * (g.ww + g.wh * 0.3);
      r.y[i] = rand() * g.wh;
      r.v[i] = g.u * (45 + rand() * 30);
      r.len[i] = g.u * (2 + rand() * 3);
    }
    for (let i = 0; i < MAX_BEADS; i++) {
      r.bx[i] = rand() * g.ww;
      r.by[i] = rand() * g.wh;
      r.bv[i] = g.u * (1.5 + rand() * 3);
    }
    return r;
  }

  function drawRain(ctx, g, t, dt, amount) {
    if (amount <= 0) return;
    const r = state.rain;
    const count = Math.min(MAX_DROPS, Math.round(95 * amount));
    const slant = 0.18;
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.wx0, g.wy0, g.ww, g.wh);
    ctx.clip();
    ctx.strokeStyle = 'rgba(170,184,208,0.42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      r.y[i] += r.v[i] * dt;
      if (r.y[i] > g.wh + r.len[i]) {
        r.y[i] = -r.len[i];
        r.x[i] = (r.x[i] * 7.31 + i * 13.7) % (g.ww + g.wh * 0.3);
      }
      const px = g.wx0 + r.x[i] - r.y[i] * slant;
      const py = g.wy0 + r.y[i];
      ctx.moveTo(px, py);
      ctx.lineTo(px - r.len[i] * slant, py - r.len[i]);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,212,230,0.4)';
    for (let i = 0; i < MAX_BEADS; i++) {
      r.by[i] += r.bv[i] * dt;
      if (r.by[i] > g.wh) {
        r.by[i] = 0;
        r.bx[i] = (r.bx[i] * 5.17 + i * 17.3) % g.ww;
      }
      ctx.fillRect(g.wx0 + r.bx[i], g.wy0 + r.by[i], 1, Math.max(1, g.u * 0.8));
    }
    ctx.restore();
  }

  // ---- run --------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed || 11);
    state.g = g;
    state.street = paintStreet(g, rand);
    state.wall = paintWall(g);
    state.front = paintFront(g, rand);
    state.glow = paintGlow(g);
    state.curtain = paintCurtain(g);
    state.rain = makeRain(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { rain, breeze } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.front, 0, 0);
    drawRain(ctx, g, t, step, rain);
    drawBell(ctx, g, t, breeze);
    drawCurtain(ctx, g, t, breeze);
    ctx.globalAlpha = 0.9 + Math.sin(t * 0.8) * 0.05 + Math.sin(t * 2.3) * 0.03;
    ctx.drawImage(state.glow, 0, 0);
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { rain: 1, breeze: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
