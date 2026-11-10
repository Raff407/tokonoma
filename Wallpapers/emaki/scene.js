/*
 * 絵巻 Emaki — a handscroll slowly unrolling across washi.
 *
 * The painting is baked once as a strip twice the screen wide that wraps without a seam.
 * Clouds and gold mist are two more wrapping strips. Each frame only slides them
 * sideways at slightly different rates, then the mounting and the two rolls are laid on top.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const state = {};

  const WASHI = '#e8dfc4';
  const WASHI_DARK = '#d9cca8';
  const INDIGO = '#2c3656';
  const INK = '#2a2622';
  const GOLD = '#d3ab55';
  const VERMILION = '#c8452c';
  const MOSS = '#5d6b4a';
  const MOSS_DARK = '#3f4f3a';

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

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  // Run a painter at x, and again one strip away if it spills over an edge.
  function wrapped(g, x, margin, fn) {
    fn(x);
    if (x < margin) fn(x + g.SW);
    if (x > g.SW - margin) fn(x - g.SW);
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const top = Math.round(H * 0.12);
    const bot = Math.round(H * 0.88);
    return { W, H, U, SW: Math.ceil(W * 2), top, bot, ph: bot - top, ground: top + (bot - top) * 0.74 };
  }

  // ---- painting strip --------------------------------------------------------

  function ridge(g, x, seed, amp) {
    let v = 0;
    for (let k = 2; k <= 7; k++) {
      v += Math.sin((TAU * k * x) / g.SW + seed * k * 1.7) * (amp / k);
    }
    return v;
  }

  function paintPaper(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, g.top, 0, g.bot);
    grad.addColorStop(0, '#e0d5b4');
    grad.addColorStop(0.5, WASHI);
    grad.addColorStop(1, '#ddd1ae');
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.top, g.SW, g.ph);
    ctx.strokeStyle = WASHI_DARK;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    for (let i = 0; i < 500; i++) {
      const x = rand() * g.SW;
      const y = g.top + rand() * g.ph;
      const l = g.U * (0.6 + rand() * 1.6);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + l, y + (rand() - 0.5) * g.U * 0.6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function paintMountains(ctx, g) {
    const U = g.U;
    const rows = [
      { base: g.top + g.ph * 0.40, amp: U * 7, seed: 1.1, color: '#a9b0b3', alpha: 0.7 },
      { base: g.top + g.ph * 0.52, amp: U * 7, seed: 2.9, color: '#7f8b94', alpha: 0.75 },
      { base: g.top + g.ph * 0.62, amp: U * 5, seed: 4.6, color: '#5f6e70', alpha: 0.8 },
    ];
    for (const r of rows) {
      ctx.fillStyle = r.color;
      ctx.globalAlpha = r.alpha;
      ctx.beginPath();
      ctx.moveTo(0, g.ground);
      for (let x = 0; x <= g.SW; x += 3) ctx.lineTo(x, r.base + ridge(g, x, r.seed, r.amp));
      ctx.lineTo(g.SW, g.ground);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function paintMeadow(ctx, g, rand) {
    ctx.fillStyle = MOSS;
    ctx.beginPath();
    ctx.moveTo(0, g.bot);
    for (let x = 0; x <= g.SW; x += 3) ctx.lineTo(x, g.ground + ridge(g, x, 6.3, g.U * 3) + g.U * 1.5);
    ctx.lineTo(g.SW, g.bot);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7b8660';
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 30; i++) {
      blob(ctx, rand() * g.SW, g.ground + g.U * (3 + rand() * 12), g.U * (6 + rand() * 8), g.U * 0.9);
    }
    ctx.globalAlpha = 1;
  }

  function paintStream(ctx, g, rand) {
    const U = g.U;
    const y0 = g.ground + U * 9;
    ctx.fillStyle = '#5d7082';
    ctx.beginPath();
    ctx.moveTo(0, y0);
    for (let x = 0; x <= g.SW; x += 3) ctx.lineTo(x, y0 + ridge(g, x, 8.1, U * 1.6));
    for (let x = g.SW; x >= 0; x -= 3) ctx.lineTo(x, y0 + U * 3.6 + ridge(g, x, 8.1, U * 1.6));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#d9dcd0';
    ctx.lineWidth = Math.max(1, U * 0.25);
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 60; i++) {
      const x = rand() * g.SW;
      const y = y0 + U * (0.6 + rand() * 2.4) + ridge(g, x, 8.1, U * 1.6);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + U * (2 + rand() * 4), y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function pine(ctx, x, y, h, seed) {
    const r = K.rng(seed);
    const lean = h * (r() - 0.5) * 0.35;
    ctx.strokeStyle = '#3a2d22';
    ctx.lineWidth = Math.max(1, h * 0.06);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - lean, y - h * 0.5, x + lean, y - h * 0.92);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const f = 0.42 + i * 0.17;
      const side = i % 2 ? 1 : -1;
      const px = x + lean * (2 * f - 1) * f + side * h * 0.13 * (1 - f * 0.6);
      const py = y - h * f;
      const w = h * (0.3 - f * 0.11);
      ctx.fillStyle = MOSS_DARK;
      blob(ctx, px, py, w, w * 0.4);
      blob(ctx, px + side * w * 0.5, py + w * 0.08, w * 0.55, w * 0.32);
      ctx.fillStyle = '#6c7d52';
      blob(ctx, px - w * 0.1, py - w * 0.12, w * 0.7, w * 0.26);
    }
  }

  function house(ctx, x, y, s, thatch) {
    ctx.fillStyle = '#eee6d0';
    ctx.fillRect(x - 3.2 * s, y - 3 * s, 6.4 * s, 3 * s);
    ctx.fillStyle = '#5a4636';
    ctx.fillRect(x - 3.2 * s, y - 3 * s, 0.35 * s, 3 * s);
    ctx.fillRect(x + 2.85 * s, y - 3 * s, 0.35 * s, 3 * s);
    ctx.fillRect(x - 0.2 * s, y - 3 * s, 0.35 * s, 3 * s);
    ctx.fillStyle = '#6e5a42';
    ctx.fillRect(x - 2.4 * s, y - 1.8 * s, 1.6 * s, 1.8 * s);
    ctx.fillStyle = thatch ? '#8a7048' : '#4a4038';
    poly(ctx, [x - 4.6 * s, y - 2.6 * s, x - 2 * s, y - 5.8 * s, x + 2 * s, y - 5.8 * s, x + 4.6 * s, y - 2.6 * s]);
    ctx.fillStyle = thatch ? '#6e5836' : '#2f2823';
    ctx.fillRect(x - 2.2 * s, y - 6.1 * s, 4.4 * s, 0.5 * s);
  }

  function pagoda(ctx, x, y, s) {
    ctx.fillStyle = '#d8cdb0';
    ctx.fillRect(x - 1.8 * s, y - 2.4 * s, 3.6 * s, 2.4 * s);
    let ty = y - 2.4 * s;
    for (let i = 0; i < 3; i++) {
      const w = (3.8 - i * 0.7) * s;
      ctx.fillStyle = VERMILION;
      ctx.fillRect(x - w * 0.36, ty - 1.5 * s, w * 0.72, 1.5 * s);
      ctx.fillStyle = '#3c3430';
      poly(ctx, [x - w * 1.2, ty - 1.2 * s, x - w * 0.6, ty - 2.1 * s, x + w * 0.6, ty - 2.1 * s, x + w * 1.2, ty - 1.2 * s]);
      ty -= 1.9 * s;
    }
    ctx.fillStyle = GOLD;
    ctx.fillRect(x - 0.12 * s, ty - 2 * s, 0.24 * s, 2.2 * s);
  }

  function torii(ctx, x, y, s) {
    ctx.fillStyle = VERMILION;
    ctx.fillRect(x - 1.6 * s, y - 3.6 * s, 0.4 * s, 3.6 * s);
    ctx.fillRect(x + 1.2 * s, y - 3.6 * s, 0.4 * s, 3.6 * s);
    ctx.fillRect(x - 2.1 * s, y - 4 * s, 4.2 * s, 0.5 * s);
    ctx.fillRect(x - 1.7 * s, y - 3 * s, 3.4 * s, 0.3 * s);
  }

  function paintVillage(ctx, g, rand) {
    const s = g.U * 1.5;
    const y = g.ground + g.U * 7;
    wrapped(g, g.SW * 0.3, s * 6, (x) => pagoda(ctx, x, y - s * 0.5, s * 1.3));
    wrapped(g, g.SW * 0.32, s * 6, (x) => torii(ctx, x + s * 7, y + s, s * 0.9));
    const clusters = [0.08, 0.2, 0.55, 0.7, 0.86];
    for (const c of clusters) {
      const n = 2 + Math.floor(rand() * 2);
      for (let i = 0; i < n; i++) {
        const x = g.SW * c + i * s * 9 + (rand() - 0.5) * s * 2;
        const yy = y + (rand() - 0.5) * g.U * 1.6;
        wrapped(g, x, s * 7, (xx) => house(ctx, xx, yy, s * (0.8 + rand() * 0.3), rand() < 0.5));
      }
    }
  }

  function paintPines(ctx, g, rand) {
    const spots = [0.04, 0.14, 0.26, 0.4, 0.47, 0.62, 0.77, 0.9, 0.95];
    let seed = 7;
    for (const c of spots) {
      const n = 1 + Math.floor(rand() * 2);
      for (let i = 0; i < n; i++) {
        const x = g.SW * c + i * g.U * 5 + (rand() - 0.5) * g.U * 3;
        const y = g.ground + g.U * (3 + rand() * 4);
        const h = g.U * (14 + rand() * 12);
        seed += 3;
        const sd = seed;
        wrapped(g, x, h, (xx) => pine(ctx, xx, y, h, sd));
      }
    }
  }

  function paintStrip(g, rand) {
    const c = layer(g.SW, g.H);
    const ctx = c.getContext('2d');
    paintPaper(ctx, g, rand);
    paintMountains(ctx, g);
    paintMeadow(ctx, g, rand);
    paintStream(ctx, g, rand);
    paintVillage(ctx, g, rand);
    paintPines(ctx, g, rand);
    return c;
  }

  // ---- clouds and gold mist --------------------------------------------------

  function suyari(ctx, x, y, w, h) {
    ctx.fillStyle = '#e4cf93';
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y + h / 2);
    ctx.lineTo(x - w / 2, y - h / 2 + h * 0.2);
    ctx.quadraticCurveTo(x - w / 2, y - h / 2, x - w / 2 + h * 0.6, y - h / 2);
    ctx.lineTo(x + w / 2 - h * 0.6, y - h / 2);
    ctx.quadraticCurveTo(x + w / 2, y - h / 2, x + w / 2, y - h / 2 + h * 0.2);
    ctx.lineTo(x + w / 2, y + h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(1, h * 0.12);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function paintClouds(g, rand) {
    const c = layer(g.SW, g.H);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 6; i++) {
      const x = g.SW * ((i + 0.3 + rand() * 0.4) / 6);
      const y = g.top + g.ph * (0.12 + rand() * 0.2);
      const w = g.U * (22 + rand() * 18);
      const h = g.U * (2.4 + rand() * 1.4);
      wrapped(g, x, w, (xx) => suyari(ctx, xx, y, w, h));
      wrapped(g, x + w * 0.2, w, (xx) => suyari(ctx, xx + w * 0.3, y + h * 1.7, w * 0.6, h * 0.8));
    }
    return c;
  }

  function paintMist(g, rand) {
    const c = layer(g.SW, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = GOLD;
    const bands = [0.42, 0.56, 0.7, 0.84];
    for (let b = 0; b < bands.length; b++) {
      const y = g.top + g.ph * bands[b];
      for (let i = 0; i < 5; i++) {
        const x = rand() * g.SW;
        const w = g.U * (24 + rand() * 24);
        wrapped(g, x, w, (xx) => {
          for (let k = 0; k < 3; k++) {
            ctx.globalAlpha = 0.16;
            blob(ctx, xx, y, w * (1 - k * 0.22), g.U * (1.8 - k * 0.45));
          }
        });
      }
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- mounting and rolls ----------------------------------------------------

  function paintBand(ctx, g, y0, y1) {
    ctx.fillStyle = INDIGO;
    ctx.fillRect(0, y0, g.W, y1 - y0);
    ctx.fillStyle = '#4a5578';
    ctx.globalAlpha = 0.5;
    const step = Math.max(4, g.U * 2.2);
    for (let x = step / 2; x < g.W; x += step) {
      for (let y = y0 + step / 2; y < y1; y += step) {
        poly(ctx, [x, y - step * 0.16, x + step * 0.16, y, x, y + step * 0.16, x - step * 0.16, y]);
      }
    }
    ctx.globalAlpha = 1;
  }

  function paintFrame(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    paintBand(ctx, g, 0, g.top);
    paintBand(ctx, g, g.bot, g.H);
    ctx.fillStyle = GOLD;
    ctx.fillRect(0, g.top - u * 0.5, g.W, u * 0.5);
    ctx.fillRect(0, g.bot, g.W, u * 0.5);
    ctx.fillStyle = VERMILION;
    ctx.fillRect(0, g.top - u * 1.2, g.W, u * 0.4);
    ctx.fillRect(0, g.bot + u * 0.8, g.W, u * 0.4);
    rollEdge(ctx, g, 0, 1);
    rollEdge(ctx, g, g.W, -1);
    return c;
  }

  function rollEdge(ctx, g, x, dir) {
    const u = g.U;
    const rw = u * 6;
    const x0 = dir > 0 ? x : x - rw;
    const shade = ctx.createLinearGradient(x0, 0, x0 + rw, 0);
    shade.addColorStop(0, '#6e5a42');
    shade.addColorStop(0.25, '#c9b98e');
    shade.addColorStop(0.55, '#ece3c8');
    shade.addColorStop(1, '#a8966e');
    ctx.fillStyle = shade;
    ctx.fillRect(x0, 0, rw, g.H);
    ctx.fillStyle = '#8a7650';
    ctx.globalAlpha = 0.5;
    for (let yy = u * 3; yy < g.H; yy += u * 4) ctx.fillRect(x0, yy, rw, 1);
    ctx.globalAlpha = 1;
    const sx = dir > 0 ? x0 + rw : x0 - u * 8;
    const cast = ctx.createLinearGradient(sx, 0, sx + u * 8, 0);
    const a = dir > 0 ? 0.42 : 0;
    const b = dir > 0 ? 0 : 0.42;
    cast.addColorStop(0, 'rgba(42,34,28,' + a + ')');
    cast.addColorStop(1, 'rgba(42,34,28,' + b + ')');
    ctx.fillStyle = cast;
    ctx.fillRect(sx, g.top, u * 8, g.ph);
    ctx.fillStyle = '#3a2a1e';
    ctx.fillRect(x0 - (dir > 0 ? 0 : u), 0, rw + u, u * 1.4);
    ctx.fillRect(x0 - (dir > 0 ? 0 : u), g.H - u * 1.4, rw + u, u * 1.4);
    ctx.fillStyle = GOLD;
    ctx.fillRect(x0, u * 1.4, rw, u * 0.4);
    ctx.fillRect(x0, g.H - u * 1.8, rw, u * 0.4);
  }

  // ---- run -------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.strip = paintStrip(g, rand);
    state.clouds = paintClouds(g, rand);
    state.mist = paintMist(g, rand);
    state.frame = paintFrame(g);
  }

  function slide(ctx, img, g, off, alpha) {
    const x = -(((off % g.SW) + g.SW) % g.SW);
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x, 0);
    ctx.drawImage(img, x + g.SW, 0);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { mist, clouds } = api.props;
    const off = t * g.U * 1.8;
    ctx.globalAlpha = 1;
    ctx.fillStyle = WASHI;
    ctx.fillRect(0, 0, g.W, g.H);
    slide(ctx, state.strip, g, off, 1);
    slide(ctx, state.clouds, g, off * 1.12 + g.U * Math.sin(t * 0.2) * 2, Math.min(1, clouds));
    slide(ctx, state.mist, g, off * 0.82 + g.U * Math.sin(t * 0.13) * 3, Math.min(1, mist));
    ctx.globalAlpha = 1;
    ctx.drawImage(state.frame, 0, 0);
  }

  Kasuri.run({
    defaults: { mist: 1, clouds: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
