/*
 * 北斎 Hokusai — one great wave curling over, in the manner of a woodblock print.
 *
 * Sky, sun, mountain, the wave body and its claws of foam are each baked once. Each
 * frame the far sea slides past in a dozen thin bands, the wave and its claws rock
 * slowly on a swell, a strip of cloud drifts and a few drops of spray float off the claws.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;

  const SKY = ['#b79a60', '#c2a86f', '#cdb883', '#d9c897', '#e4d6a8'];
  const SEA = ['#6f94b8', '#5a82ab', '#46709a', '#345b86', '#274a74', '#1f3d62'];
  const INDIGO = { deep: '#1b3153', body: '#223f6a', mid: '#365f8e', light: '#5886b0', ink: '#10203a' };
  const FOAM = '#f3eedf';
  const CLOUD = '#ebe0c0';
  const SUN = '#c4472d';
  const SNOW = '#efe9d8';
  const MOUNT = '#4a6fa0';

  const HORIZON = 0.63;
  const BANDS = 12;
  const FORE_BANDS = 3;
  const MAX_SPRAY = 36;
  const SPRAY = 24;
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
    const U = H / 100;
    const s = Math.min(1.2 * U, W * 0.0072);
    return { W, H, U, s, x0: W * 0.03, baseY: H * 0.975, yh: Math.round(H * HORIZON) };
  }

  // ---- sky, sun, cloud strip, mountain -------------------------------------

  function paintBack(g, rand) {
    const c = layer(g.W, g.yh + 2);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.yh + 2);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.yh + 2; y++) {
      const f = Math.min(1, y / g.yh) * (inks.length - 1);
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
    ctx.fillStyle = SUN;
    ctx.beginPath();
    ctx.arc(g.W * 0.85, g.H * 0.2, g.U * 5.2, 0, TAU);
    ctx.fill();
    return c;
  }

  function cloudBand(ctx, x, y, w, h, P) {
    for (const dx of [-P, 0, P]) {
      const cx = x + dx;
      ctx.beginPath();
      ctx.moveTo(cx, y + h);
      ctx.quadraticCurveTo(cx + w * 0.02, y, cx + w * 0.12, y);
      ctx.lineTo(cx + w * 0.88, y);
      ctx.quadraticCurveTo(cx + w * 0.98, y, cx + w, y + h);
      ctx.closePath();
      ctx.fill();
    }
  }

  function paintClouds(g, rand) {
    const P = g.W;
    const h = Math.ceil(g.H * 0.2);
    const c = layer(P, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = CLOUD;
    const rows = [0.1, 0.34, 0.56, 0.8];
    for (let r = 0; r < rows.length; r++) {
      const n = 2;
      for (let i = 0; i < n; i++) {
        const w = g.W * (0.14 + rand() * 0.16);
        cloudBand(ctx, ((i + rand() * 0.6) / n) * P, rows[r] * h, w, g.U * (0.9 + rand() * 0.7), P);
      }
    }
    return c;
  }

  function paintMount(g, wave) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const fx = g.x0 + 76 * g.s;
    const fw = 17 * g.s;
    const fh = 13 * g.s;
    const y = g.yh;
    ctx.fillStyle = MOUNT;
    ctx.beginPath();
    ctx.moveTo(fx - fw, y + 1);
    ctx.bezierCurveTo(fx - fw * 0.55, y - fh * 0.12, fx - fw * 0.28, y - fh * 0.7, fx - fw * 0.09, y - fh);
    ctx.lineTo(fx + fw * 0.09, y - fh);
    ctx.bezierCurveTo(fx + fw * 0.28, y - fh * 0.7, fx + fw * 0.55, y - fh * 0.12, fx + fw, y + 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = SNOW;
    const cap = fh * 0.38;
    ctx.beginPath();
    ctx.moveTo(fx - fw * 0.09, y - fh);
    ctx.lineTo(fx + fw * 0.09, y - fh);
    ctx.lineTo(fx + fw * 0.2, y - fh + cap * 0.7);
    ctx.lineTo(fx + fw * 0.13, y - fh + cap * 0.55);
    ctx.lineTo(fx + fw * 0.08, y - fh + cap);
    ctx.lineTo(fx + fw * 0.02, y - fh + cap * 0.6);
    ctx.lineTo(fx - fw * 0.06, y - fh + cap * 1.05);
    ctx.lineTo(fx - fw * 0.1, y - fh + cap * 0.6);
    ctx.lineTo(fx - fw * 0.2, y - fh + cap * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = CLOUD;
    ctx.fillRect(fx - fw * 1.3, y - g.U * 0.9, fw * 2.6, g.U * 0.9);
    return c;
  }

  // ---- the great wave -------------------------------------------------------

  function silhouette(ctx) {
    ctx.moveTo(-12, 80);
    ctx.lineTo(-12, 58);
    ctx.bezierCurveTo(-2, 50, 8, 34, 20, 23);
    ctx.bezierCurveTo(31, 13, 43, 4, 56, 4);
    ctx.bezierCurveTo(69, 4, 79, 12, 84, 25);
    ctx.bezierCurveTo(79, 20, 72, 20, 66, 25);
    ctx.bezierCurveTo(58, 32, 54, 42, 57, 52);
    ctx.bezierCurveTo(60, 62, 68, 68, 80, 71);
    ctx.lineTo(80, 80);
    ctx.closePath();
  }

  function backEdge(ctx) {
    ctx.moveTo(-12, 58);
    ctx.bezierCurveTo(-2, 50, 8, 34, 20, 23);
    ctx.bezierCurveTo(31, 13, 43, 4, 56, 4);
    ctx.bezierCurveTo(69, 4, 79, 12, 84, 25);
  }

  function faceEdge(ctx) {
    ctx.moveTo(84, 25);
    ctx.bezierCurveTo(79, 20, 72, 20, 66, 25);
    ctx.bezierCurveTo(58, 32, 54, 42, 57, 52);
    ctx.bezierCurveTo(60, 62, 68, 68, 80, 71);
  }

  function bez(a, b, c, d, t) {
    const m = 1 - t;
    return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d;
  }

  function paintWave(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.save();
    ctx.translate(g.x0, g.baseY - 70 * g.s);
    ctx.scale(g.s, g.s);
    ctx.fillStyle = INDIGO.deep;
    ctx.beginPath();
    silhouette(ctx);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // lighter water along the hollow face, widest first
    const rims = [[15, INDIGO.body], [9, INDIGO.mid], [4, INDIGO.light]];
    for (const [w, col] of rims) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      faceEdge(ctx);
      ctx.stroke();
    }
    // fine bands running down the back, like cut wood grain
    ctx.strokeStyle = INDIGO.mid;
    ctx.lineWidth = 0.9;
    for (let k = 1; k <= 5; k++) {
      ctx.save();
      ctx.translate(k * 2.6, k * 5.2);
      ctx.beginPath();
      backEdge(ctx);
      ctx.stroke();
      ctx.restore();
    }
    // foam cap along the crest
    ctx.strokeStyle = FOAM;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(20, 23);
    ctx.bezierCurveTo(31, 13, 43, 4, 56, 4);
    ctx.bezierCurveTo(69, 4, 79, 12, 84, 25);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    backEdge(ctx);
    ctx.stroke();
    // a few short flecks of foam on the back
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 5; i++) {
      const t = 0.3 + i * 0.13 + rand() * 0.05;
      const x = bez(-12, -2, 8, 20, t) + 3 + rand() * 3;
      const y = bez(58, 50, 34, 23, t) + 4 + rand() * 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 1.5, y + 1.2, x + 2.5 + rand() * 2, y + 3.5);
      ctx.stroke();
    }
    ctx.restore();
    // ink outline around the edge
    ctx.strokeStyle = INDIGO.ink;
    ctx.lineWidth = 0.9;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    backEdge(ctx);
    ctx.stroke();
    ctx.beginPath();
    faceEdge(ctx);
    ctx.stroke();
    ctx.restore();
    return c;
  }

  function finger(ctx, x, y, len, lean, w) {
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w * 0.5, y + len * 0.5, x + lean, y + len);
    ctx.quadraticCurveTo(x + w * 0.9 + lean * 0.2, y + len * 0.5, x + w, y);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  }

  function paintClaws(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.save();
    ctx.translate(g.x0, g.baseY - 70 * g.s);
    ctx.scale(g.s, g.s);
    ctx.fillStyle = FOAM;
    ctx.strokeStyle = INDIGO.ink;
    ctx.lineWidth = 0.6;
    ctx.lineJoin = 'round';
    const xs = [68, 71, 74.5, 77, 79.5, 82, 84.5];
    const lens = [5, 8, 5.5, 9.5, 6, 8, 5];
    for (let i = 0; i < xs.length; i++) {
      const base = 21.5 + (i > 4 ? (i - 4) * 1.4 : 0);
      finger(ctx, xs[i], base, lens[i], 0.8 + i * 0.35, 1.0 + (i % 2) * 0.35);
    }
    finger(ctx, 62, 27.5, 4.5, -0.8, 1.0);
    // blobs of foam where the claws start
    ctx.lineWidth = 0;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.arc(64 + i * 2.9, 22.2 + (i > 5 ? (i - 5) * 1.5 : 0), 1.5 + (i % 3) * 0.3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    return c;
  }

  // ---- the sea --------------------------------------------------------------

  function crest(ctx, x, y, sz, P, col, under) {
    for (const dx of [-P, 0, P]) {
      const cx = x + dx;
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass === 0 ? under : col;
        ctx.lineWidth = Math.max(1, sz * 0.24);
        const oy = pass === 0 ? Math.max(1, sz * 0.24) : 0;
        ctx.beginPath();
        ctx.moveTo(cx - sz, y + oy);
        ctx.quadraticCurveTo(cx - sz * 0.2, y - sz * 0.9 + oy, cx + sz * 0.5, y - sz * 0.5 + oy);
        ctx.quadraticCurveTo(cx + sz * 0.95, y - sz * 0.3 + oy, cx + sz * 0.7, y + sz * 0.15 + oy);
        ctx.stroke();
      }
    }
  }

  function paintSea(g, rand) {
    const P = g.W;
    const h = g.H - g.yh + 2;
    const c = layer(P, h);
    const ctx = c.getContext('2d');
    const step = h / SEA.length;
    for (let i = 0; i < SEA.length; i++) {
      ctx.fillStyle = SEA[i];
      ctx.fillRect(0, Math.floor(i * step), P, Math.ceil(step) + 1);
    }
    ctx.lineCap = 'round';
    const rows = 9;
    for (let r = 0; r < rows; r++) {
      const d = (r + 0.5) / rows;
      const y = Math.pow(d, 1.5) * h * 0.92 + g.U * 1.2;
      const sz = g.U * (0.9 + 3.4 * d);
      const n = Math.max(2, Math.round(P / (sz * (5.5 + rand() * 1.5))));
      const gap = P / n;
      const colIdx = Math.min(SEA.length - 1, Math.floor(d * SEA.length + 0.5));
      for (let i = 0; i < n; i++) {
        crest(ctx, (i + 0.2 + rand() * 0.6) * gap, y + (rand() - 0.5) * sz * 0.4, sz, P, FOAM, SEA[Math.min(SEA.length - 1, colIdx + 1)]);
      }
    }
    return c;
  }

  function paintFore(g, rand) {
    const P = g.W;
    const top = g.H * 0.915;
    const h = Math.ceil(g.H - top + 2);
    const c = layer(P, h);
    const ctx = c.getContext('2d');
    const edge = (x) => g.U * (1.2 + 1.1 * Math.sin((x / P) * TAU * 3 + 0.8) + 0.7 * Math.sin((x / P) * TAU * 7 + 2));
    ctx.fillStyle = '#18305a';
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= P; x += 2) ctx.lineTo(x, edge(x));
    ctx.lineTo(P, h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = INDIGO.deep;
    ctx.fillRect(0, h * 0.55, P, h);
    ctx.lineCap = 'round';
    const n = Math.max(3, Math.round(P / (g.U * 22)));
    for (let i = 0; i < n; i++) {
      const x = (i + 0.2 + rand() * 0.6) * (P / n);
      crest(ctx, x, edge(x) + g.U * 2.4 + rand() * g.U * 1.2, g.U * (2.6 + rand() * 1.4), P, FOAM, INDIGO.deep);
    }
    return c;
  }

  // ---- spray ----------------------------------------------------------------

  function makeSpray() {
    return {
      x: new Float32Array(MAX_SPRAY),
      y: new Float32Array(MAX_SPRAY),
      vx: new Float32Array(MAX_SPRAY),
      vy: new Float32Array(MAX_SPRAY),
      age: new Float32Array(MAX_SPRAY),
      life: new Float32Array(MAX_SPRAY),
    };
  }

  function resetDrop(g, S, i, scatter) {
    const r = state.rand;
    S.x[i] = g.x0 + (60 + r() * 34) * g.s;
    S.y[i] = g.baseY - (70 - (14 + r() * 28)) * g.s;
    S.vx[i] = g.U * (0.6 + r() * 1.4);
    S.vy[i] = g.U * (-0.9 + r() * 1.0);
    S.life[i] = 4 + r() * 4;
    S.age[i] = scatter ? r() * S.life[i] : 0;
  }

  function drawSpray(ctx, g, t, dt, count, bx, by) {
    const S = state.spray;
    const step = Math.min(dt, 0.1);
    ctx.fillStyle = FOAM;
    for (let i = 0; i < count; i++) {
      S.age[i] += step;
      if (S.age[i] >= S.life[i]) resetDrop(g, S, i, false);
      S.x[i] += S.vx[i] * step;
      S.y[i] += (S.vy[i] + Math.sin(t * 0.8 + i) * g.U * 0.4) * step;
      ctx.globalAlpha = 0.9 * Math.sin((Math.PI * S.age[i]) / S.life[i]);
      ctx.fillRect(Math.round(S.x[i] + bx), Math.round(S.y[i] + by), i % 3 === 0 ? 2 : 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run ------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.clouds = paintClouds(g, rand);
    state.mount = paintMount(g, null);
    state.sea = paintSea(g, rand);
    state.fore = paintFore(g, rand);
    state.wave = paintWave(g, rand);
    state.claws = paintClaws(g, rand);
    state.spray = makeSpray();
    for (let i = 0; i < MAX_SPRAY; i++) resetDrop(g, state.spray, i, true);
    const rows = state.sea.height;
    state.bandY = new Float32Array(BANDS + 1);
    for (let i = 0; i <= BANDS; i++) state.bandY[i] = Math.round(Math.pow(i / BANDS, 1.35) * rows);
  }

  function drawClouds(ctx, g, t, amount) {
    const P = g.W;
    const off = (((t * g.U * 0.9 * amount) % P) + P) % P;
    ctx.drawImage(state.clouds, off, g.H * 0.05);
    ctx.drawImage(state.clouds, off - P, g.H * 0.05);
  }

  function drawSea(ctx, g, t, swell) {
    const P = g.W;
    const rows = state.sea.height;
    for (let i = 0; i < BANDS; i++) {
      const sy = state.bandY[i];
      const sh = state.bandY[i + 1] - sy;
      if (sh <= 0) continue;
      const d = (i + 0.5) / BANDS;
      const dir = i % 2 ? -1 : 1;
      const off = (((t * g.U * (0.5 + d * 2.6) * dir) % P) + P) % P;
      const dy = Math.sin(t * 0.7 + i * 0.9) * g.U * 0.35 * swell * (0.4 + d);
      ctx.drawImage(state.sea, 0, sy, P, sh, off, g.yh + sy + dy, P, sh);
      ctx.drawImage(state.sea, 0, sy, P, sh, off - P, g.yh + sy + dy, P, sh);
    }
    if (rows < 0) return;
  }

  function drawFore(ctx, g, t, swell) {
    const P = g.W;
    const f = state.fore;
    const top = g.H - f.height + 2;
    const bandH = Math.ceil(f.height / FORE_BANDS);
    for (let i = 0; i < FORE_BANDS; i++) {
      const sy = i * bandH;
      const sh = Math.min(bandH, f.height - sy);
      const off = (((t * g.U * (1.6 + i * 0.7)) % P) + P) % P;
      const dy = Math.sin(t * 0.9 + i * 1.7) * g.U * 0.3 * swell;
      ctx.drawImage(f, 0, sy, P, sh, off, top + sy + dy, P, sh);
      ctx.drawImage(f, 0, sy, P, sh, off - P, top + sy + dy, P, sh);
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { swell, spray, clouds } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawClouds(ctx, g, t, clouds);
    ctx.drawImage(state.mount, 0, 0);
    drawSea(ctx, g, t, swell);
    const bx = Math.sin(t * 0.37 + 1) * g.U * 0.55 * swell;
    const by = Math.sin(t * 0.55) * g.U * 0.8 * swell;
    ctx.drawImage(state.wave, bx, by);
    const cx = bx + Math.sin(t * 0.9) * g.U * 0.4 * swell;
    const cy = by + Math.sin(t * 1.1 + 0.7) * g.U * 0.5 * swell;
    ctx.drawImage(state.claws, cx, cy);
    drawSpray(ctx, g, t, dt, Math.min(MAX_SPRAY, Math.round(SPRAY * spray)), bx, by);
    drawFore(ctx, g, t, swell);
  }

  Kasuri.run({
    defaults: { swell: 1, spray: 1, clouds: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
