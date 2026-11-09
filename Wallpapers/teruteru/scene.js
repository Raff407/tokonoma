/*
 * てるてる坊主 Teruteru — a cloth weather doll hung in the window on a wet afternoon.
 *
 * The garden outside, the window frame and the doll are baked once. Rain is two
 * tiling sheets of streaks sliding down behind the glass. A short pool of drops runs
 * down the panes in fits and starts, and the doll turns slowly on its red string.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, smoothstep, lerp } = K;

  const TAU = Math.PI * 2;
  const SKY = ['#56657c', '#66768b', '#7a8898', '#8e9aa4'];
  const WALL = '#2a231e';
  const WOOD = { face: '#4b3826', lit: '#6e5238', dark: '#2f2318', sill: '#5c4630', edge: '#b08a4e' };
  const CLOTH = { base: '#e6dfcb', lit: '#f2ecda', shade: '#bdb5a2', deep: '#9c9686' };
  const STRING = '#c24a30';
  const DROPS = 14;
  const BEADS = 160;
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
    const u = U * Math.min(1, W / (U * 150));
    const top = Math.round(H * 0.07);
    const bottom = Math.round(H * 0.8);
    const left = Math.round(W * 0.1);
    const right = Math.round(W * 0.9);
    const bar = Math.max(2, Math.round(u * 2.6));
    const mid = Math.round((left + right) / 2);
    return { W, H, U, u, top, bottom, left, right, bar, mid, px: Math.round(lerp(mid, right, 0.48)), py: top };
  }

  // ---- outside -------------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.H);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / (g.H * 0.55)) * (inks.length - 1);
      const k = Math.floor(f);
      for (let x = 0; x < g.W; x++) {
        const ink = inks[Math.min(inks.length - 1, k + (rand() < f - k ? 1 : 0))];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function ridge(ctx, g, base, amp, scale, seed, ink) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, base + (fbm(x / scale, 0.7, 3, seed) - 0.5) * amp);
    ctx.lineTo(g.W, g.H);
    ctx.fill();
  }

  function roof(ctx, g, x, y, w, ink, wallInk) {
    const h = w * 0.22;
    ctx.fillStyle = wallInk;
    ctx.fillRect(x + w * 0.12, y, w * 0.76, w * 0.3);
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.06, y + h * 0.15);
    ctx.quadraticCurveTo(x + w * 0.2, y - h * 0.2, x + w * 0.3, y - h);
    ctx.lineTo(x + w * 0.7, y - h);
    ctx.quadraticCurveTo(x + w * 0.8, y - h * 0.2, x + w * 1.06, y + h * 0.15);
    ctx.closePath();
    ctx.fill();
  }

  function shrubs(ctx, g, rand, y0, n, inks) {
    for (let i = 0; i < n; i++) {
      const x = g.W * rand();
      const y = y0 + rand() * g.U * 6;
      const r = g.U * (3 + rand() * 4);
      ctx.fillStyle = inks[0];
      blob(ctx, x, y, r, r * 0.7);
      ctx.fillStyle = inks[1];
      blob(ctx, x - r * 0.25, y - r * 0.2, r * 0.6, r * 0.42);
    }
  }

  function hydrangeas(ctx, g, rand, y0) {
    const tones = ['#5b6a9a', '#6f6c9e', '#7b86b0', '#8a7aa6'];
    for (let i = 0; i < 26; i++) {
      const x = g.W * (0.05 + rand() * 0.9);
      const y = y0 + rand() * g.U * 7;
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      blob(ctx, x, y, g.U * (1.2 + rand() * 1.2), g.U * (1 + rand()));
    }
  }

  function paintOutside(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    ridge(ctx, g, g.H * 0.36, g.H * 0.12, g.U * 50, 5, '#6b7889');
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#9aa4ad';
    ctx.fillRect(0, g.H * 0.36, g.W, g.U * 6);
    ctx.globalAlpha = 1;
    ridge(ctx, g, g.H * 0.46, g.H * 0.08, g.U * 30, 9, '#4f6070');
    for (let i = 0; i < 7; i++) {
      const w = g.U * (14 + rand() * 10);
      const x = g.W * (i / 6) - w * 0.5 + (rand() - 0.5) * g.U * 8;
      roof(ctx, g, x, g.H * (0.5 + rand() * 0.05), w, '#34405a', '#6e7480');
    }
    shrubs(ctx, g, rand, g.H * 0.58, 26, ['#3d5146', '#50664f']);
    ctx.fillStyle = '#4a5a52';
    ctx.fillRect(0, g.H * 0.66, g.W, g.H * 0.34);
    hydrangeas(ctx, g, rand, g.H * 0.62);
    shrubs(ctx, g, rand, g.H * 0.7, 18, ['#334639', '#475e45']);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#a9b1b8';
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- rain behind the glass ----------------------------------------------

  function paintRain(g, rand, count, len, alpha, ink) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const x = rand() * g.W;
      const y = rand() * g.H;
      const l = g.U * len * (0.6 + rand() * 0.8);
      ctx.globalAlpha = alpha * (0.5 + rand() * 0.5);
      for (let k = -1; k <= 0; k++) {
        const yy = y + k * g.H;
        ctx.beginPath();
        ctx.moveTo(x, yy);
        ctx.lineTo(x - l * 0.12, yy + l);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function drawRain(ctx, g, t, rain) {
    if (rain <= 0) return;
    const sheets = state.rain;
    for (let i = 0; i < sheets.length; i++) {
      const s = sheets[i];
      const off = (t * g.H * s.speed) % g.H;
      ctx.globalAlpha = Math.min(1, rain * s.alpha);
      ctx.drawImage(s.c, s.drift * off * 0.12, off - g.H);
      ctx.drawImage(s.c, s.drift * off * 0.12, off);
    }
    ctx.globalAlpha = 1;
  }

  // ---- glass ---------------------------------------------------------------

  function inPane(g, x) {
    return Math.abs(x - g.mid) > g.bar * 1.5 && x > g.left + g.bar * 1.5 && x < g.right - g.bar * 1.5;
  }

  function paintBeads(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (let i = 0; i < BEADS; i++) {
      const x = g.left + rand() * (g.right - g.left);
      const y = g.top + rand() * (g.bottom - g.top);
      if (!inPane(g, x)) continue;
      const r = g.U * (0.25 + rand() * 0.45);
      ctx.fillStyle = '#3e4a5a';
      ctx.globalAlpha = 0.5;
      blob(ctx, x, y + r * 0.3, r, r * 1.1);
      ctx.fillStyle = '#d9dfe2';
      ctx.globalAlpha = 0.7;
      blob(ctx, x - r * 0.25, y - r * 0.2, r * 0.45, r * 0.5);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function makeDrops() {
    const f = () => new Float32Array(DROPS);
    return { x: f(), y: f(), y0: f(), v: f(), wait: f(), r: f() };
  }

  function resetDrop(g, D, i, scatter) {
    const r = state.rand;
    let x = g.left + r() * (g.right - g.left);
    if (!inPane(g, x)) x = lerp(g.left, g.mid, 0.5);
    D.x[i] = x;
    D.y0[i] = g.top + g.bar + r() * (g.bottom - g.top) * 0.45;
    D.y[i] = scatter ? lerp(D.y0[i], g.bottom, r() * 0.8) : D.y0[i];
    D.v[i] = 0;
    D.wait[i] = r() * 4;
    D.r[i] = g.U * (0.6 + r() * 0.5);
  }

  function stepDrop(g, D, i, dt) {
    if (D.wait[i] > 0) {
      D.wait[i] -= dt;
      return;
    }
    D.y[i] += D.v[i] * dt;
    D.v[i] = Math.min(D.v[i] + g.U * 40 * dt, g.U * 22);
    if (state.rand() < dt * 0.7) {
      D.v[i] = 0;
      D.wait[i] = 0.4 + state.rand() * 2.2;
    }
    if (D.y[i] > g.bottom + g.U * 2) resetDrop(g, D, i, false);
  }

  function drawDrops(ctx, g, rain) {
    if (rain <= 0) return;
    const D = state.drops;
    const n = Math.min(DROPS, Math.round(DROPS * 0.5 * rain + 2));
    ctx.strokeStyle = '#aeb8c0';
    ctx.lineWidth = Math.max(1, g.U * 0.45);
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(D.x[i], D.y0[i]);
      ctx.lineTo(D.x[i], D.y[i]);
      ctx.stroke();
    }
    for (let i = 0; i < n; i++) {
      const r = D.r[i];
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = '#2f3a4a';
      blob(ctx, D.x[i], D.y[i] + r * 0.35, r, r * 1.25);
      ctx.fillStyle = '#e3e7e6';
      blob(ctx, D.x[i] - r * 0.3, D.y[i] - r * 0.1, r * 0.4, r * 0.5);
    }
    ctx.globalAlpha = 1;
  }

  // ---- room ----------------------------------------------------------------

  function paintPot(ctx, g, x, y) {
    const u = g.u;
    ctx.fillStyle = '#3a4a68';
    ctx.beginPath();
    ctx.moveTo(x - u * 5, y - u * 7);
    ctx.lineTo(x + u * 5, y - u * 7);
    ctx.lineTo(x + u * 3.8, y);
    ctx.lineTo(x - u * 3.8, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5a6c8c';
    ctx.fillRect(x - u * 5, y - u * 7, u * 2.2, u * 6.5);
    ctx.fillStyle = '#34503a';
    blob(ctx, x - u * 4, y - u * 9, u * 3, u * 2);
    blob(ctx, x + u * 4, y - u * 9.5, u * 3, u * 2);
    const tones = ['#5b5f9a', '#7178ac', '#8c86b6', '#4e568a'];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      ctx.fillStyle = tones[i % tones.length];
      blob(ctx, x + Math.cos(a) * u * 3.4, y - u * 12 + Math.sin(a) * u * 2.6, u * 1.6, u * 1.4);
    }
    ctx.fillStyle = '#9aa0c8';
    blob(ctx, x - u * 1, y - u * 13, u * 1.4, u * 1.2);
  }

  function paintRoom(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = WALL;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#332a23';
    for (let i = 0; i < 40; i++) ctx.fillRect(rand() * g.W, rand() * g.H, g.U * (4 + rand() * 10), Math.max(1, g.U * 0.4));
    const b = g.bar;
    const o = b * 2;
    ctx.fillStyle = WOOD.dark;
    ctx.fillRect(g.left - o - 2, g.top - o - 2, g.right - g.left + o * 2 + 4, g.bottom - g.top + o * 2 + 4);
    ctx.fillStyle = WOOD.face;
    ctx.fillRect(g.left - o, g.top - o, g.right - g.left + o * 2, g.bottom - g.top + o * 2);
    ctx.clearRect(g.left, g.top, g.right - g.left, g.bottom - g.top);
    ctx.fillRect(g.mid - b, g.top, b * 2, g.bottom - g.top);
    const cross = Math.round(lerp(g.top, g.bottom, 0.36));
    ctx.fillRect(g.left, cross - b * 0.5, g.mid - g.left, b);
    ctx.fillRect(g.mid, cross - b * 0.5, g.right - g.mid, b);
    ctx.fillStyle = WOOD.lit;
    ctx.fillRect(g.mid - b, g.top, Math.max(1, b * 0.5), g.bottom - g.top);
    ctx.fillRect(g.left - o, g.top - o, g.right - g.left + o * 2, Math.max(1, b * 0.5));
    ctx.fillStyle = 'rgba(20,16,12,0.55)';
    ctx.fillRect(g.left, g.top, g.right - g.left, Math.max(1, b * 0.6));
    const sy = g.bottom + o;
    ctx.fillStyle = WOOD.sill;
    ctx.fillRect(g.left - o * 2, sy - b, g.right - g.left + o * 4, b * 3);
    ctx.fillStyle = WOOD.edge;
    ctx.fillRect(g.left - o * 2, sy - b, g.right - g.left + o * 4, Math.max(1, b * 0.5));
    ctx.fillStyle = WOOD.dark;
    ctx.fillRect(g.left - o * 2, sy + b * 2, g.right - g.left + o * 4, Math.max(1, b * 0.8));
    paintPot(ctx, g, lerp(g.left, g.mid, 0.25), sy - b);
    ctx.fillStyle = '#d6cdb4';
    blob(ctx, g.px, g.py + g.bar * 0.2, g.u * 0.9, g.u * 0.9);
    return c;
  }

  // ---- doll ----------------------------------------------------------------

  function dollSize(g) {
    const R = g.u * 11.5;
    const L = g.u * 9;
    return { R, L, w: R * 4.2, h: L + R * 4.4 };
  }

  function paintSkirt(ctx, d, cx) {
    const neck = d.L + d.R * 1.85;
    const hem = neck + d.R * 1.9;
    const n = 7;
    ctx.fillStyle = CLOTH.base;
    ctx.beginPath();
    ctx.moveTo(cx - d.R * 0.42, neck);
    ctx.quadraticCurveTo(cx - d.R * 1.1, neck + d.R * 0.6, cx - d.R * 1.55, hem);
    for (let i = 0; i < n; i++) {
      const x0 = cx - d.R * 1.55 + (i / n) * d.R * 3.1;
      const x1 = cx - d.R * 1.55 + ((i + 1) / n) * d.R * 3.1;
      ctx.quadraticCurveTo((x0 + x1) / 2, hem + d.R * (i % 2 ? 0.35 : 0.2), x1, hem);
    }
    ctx.quadraticCurveTo(cx + d.R * 1.1, neck + d.R * 0.6, cx + d.R * 0.42, neck);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = CLOTH.shade;
    for (let i = 1; i < n; i += 1) {
      const x = cx - d.R * 1.55 + (i / n) * d.R * 3.1;
      ctx.beginPath();
      ctx.moveTo(cx + (x - cx) * 0.2, neck);
      ctx.lineTo(x - d.R * 0.12, hem + d.R * 0.4);
      ctx.lineTo(x + d.R * 0.12, hem + d.R * 0.4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = CLOTH.deep;
    ctx.fillRect(cx + d.R * 0.7, neck, d.R, hem);
    ctx.fillStyle = CLOTH.lit;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(cx - d.R * 1.6, neck, d.R * 0.5, hem);
    ctx.globalAlpha = 1;
    ctx.restore();
    return neck;
  }

  function paintHead(ctx, d, cx) {
    const cy = d.L + d.R;
    ctx.fillStyle = CLOTH.deep;
    blob(ctx, cx + d.R * 0.06, cy + d.R * 0.04, d.R, d.R * 0.98);
    ctx.fillStyle = CLOTH.shade;
    blob(ctx, cx - d.R * 0.02, cy, d.R * 0.94, d.R * 0.92);
    ctx.fillStyle = CLOTH.base;
    blob(ctx, cx - d.R * 0.12, cy - d.R * 0.1, d.R * 0.78, d.R * 0.76);
    ctx.fillStyle = CLOTH.lit;
    blob(ctx, cx - d.R * 0.35, cy - d.R * 0.35, d.R * 0.32, d.R * 0.28);
    ctx.fillStyle = '#2a2420';
    blob(ctx, cx - d.R * 0.36, cy - d.R * 0.02, d.R * 0.1, d.R * 0.13);
    blob(ctx, cx + d.R * 0.3, cy - d.R * 0.02, d.R * 0.1, d.R * 0.13);
    ctx.strokeStyle = '#2a2420';
    ctx.lineWidth = Math.max(1, d.R * 0.07);
    ctx.beginPath();
    ctx.arc(cx - d.R * 0.03, cy + d.R * 0.18, d.R * 0.28, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = '#d98a74';
    ctx.globalAlpha = 0.55;
    blob(ctx, cx - d.R * 0.55, cy + d.R * 0.22, d.R * 0.14, d.R * 0.09);
    blob(ctx, cx + d.R * 0.5, cy + d.R * 0.22, d.R * 0.14, d.R * 0.09);
    ctx.globalAlpha = 1;
  }

  function paintTie(ctx, d, cx, neck) {
    const w = d.R * 0.18;
    ctx.fillStyle = STRING;
    ctx.fillRect(cx - d.R * 0.5, neck - w, d.R, w * 1.6);
    ctx.beginPath();
    ctx.moveTo(cx + d.R * 0.1, neck);
    ctx.lineTo(cx + d.R * 0.55, neck - d.R * 0.32);
    ctx.lineTo(cx + d.R * 0.62, neck + d.R * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + d.R * 0.1, neck);
    ctx.lineTo(cx + d.R * 0.32, neck + d.R * 0.62);
    ctx.lineTo(cx + d.R * 0.05, neck + d.R * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8e3424';
    blob(ctx, cx + d.R * 0.1, neck, w, w);
  }

  function paintDoll(g) {
    const d = dollSize(g);
    const c = layer(d.w, d.h);
    const ctx = c.getContext('2d');
    const cx = d.w / 2;
    ctx.strokeStyle = STRING;
    ctx.lineWidth = Math.max(1, g.u * 0.5);
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, d.L + d.R * 0.3);
    ctx.stroke();
    const neck = paintSkirt(ctx, d, cx);
    paintHead(ctx, d, cx);
    paintTie(ctx, d, cx, neck);
    state.doll = c;
    state.dollW = d.w;
  }

  function drawDoll(ctx, g, t, sway) {
    const a = sway * (0.07 * Math.sin(t * 0.8) + 0.025 * Math.sin(t * 2.1 + 1.3));
    const c = Math.cos(a);
    const s = Math.sin(a);
    ctx.setTransform(c, s, -s, c, g.px, g.py);
    ctx.drawImage(state.doll, -state.dollW / 2, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.outside = paintOutside(g, rand);
    state.rain = [
      { c: paintRain(g, rand, 260, 3, 0.45, '#c3ccd6'), speed: 0.9, alpha: 0.7, drift: 1 },
      { c: paintRain(g, rand, 110, 7, 0.6, '#d8dee4'), speed: 1.6, alpha: 0.8, drift: 1 },
    ];
    state.beads = paintBeads(g, rand);
    state.room = paintRoom(g, rand);
    paintDoll(g);
    state.drops = makeDrops();
    for (let i = 0; i < DROPS; i++) resetDrop(g, state.drops, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { rain, sway } = api.props;
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < DROPS; i++) stepDrop(g, state.drops, i, step);
    ctx.drawImage(state.outside, 0, 0);
    drawRain(ctx, g, t, rain);
    ctx.globalAlpha = Math.min(1, 0.4 + rain * 0.4);
    ctx.drawImage(state.beads, 0, 0);
    ctx.globalAlpha = 1;
    drawDrops(ctx, g, rain);
    ctx.drawImage(state.room, 0, 0);
    drawDoll(ctx, g, t, sway);
  }

  Kasuri.run({
    defaults: { rain: 1, sway: 1, ramp: 'lines', cell: 6, boost: 0.2, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
