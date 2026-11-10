/*
 * 大仏 Daibutsu — a great bronze Buddha seated in the open air at first light.
 *
 * Sky, hills, pagoda, trees, the figure and the gravel court are baked once into
 * layers. Each frame lays two tiling mist strips, a breathing glow and a short
 * pool of falling petals over them.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm } = K;

  const TAU = Math.PI * 2;
  const GROUND = 0.84;
  const MAX_PETALS = 150;
  const PETALS = 75;
  const PETAL_TONES = ['#f1dcd6', '#e6c3bd', '#f6ece0'];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.4, rx), Math.max(0.4, ry), 0, 0, TAU);
    ctx.fill();
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const u = U * Math.min(1, W / (U * 120));
    return { W, H, U, u, gy: Math.round(H * GROUND), cx: W * 0.5 };
  }

  // ---- sky, hills, pagoda ----------------------------------------------------

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.7);
    grad.addColorStop(0, '#a9b3b6');
    grad.addColorStop(0.5, '#d8d3c0');
    grad.addColorStop(1, '#efdcc0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#e9d3b4';
    for (let i = 0; i < 5; i++) {
      blob(ctx, g.W * (0.1 + rand() * 0.8), g.H * (0.08 + rand() * 0.14), g.U * (10 + rand() * 12), g.U * 0.8);
    }
    ctx.fillStyle = '#f2e2c4';
    blob(ctx, g.cx + g.u * 14, g.H * 0.3, g.u * 6, g.u * 6);
    const ridges = [
      { base: 0.45, amp: 0.1, seed: 5, ink: '#a6aeb0', k: 36 },
      { base: 0.55, amp: 0.09, seed: 9, ink: '#8a9899', k: 28 },
      { base: 0.64, amp: 0.07, seed: 17, ink: '#6f8080', k: 22 },
    ];
    for (const r of ridges) {
      ctx.fillStyle = r.ink;
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W; x += 2) {
        ctx.lineTo(x, g.H * r.base + (fbm(x / (g.U * r.k), r.seed, 3, r.seed) - 0.5) * g.H * r.amp * 2);
      }
      ctx.lineTo(g.W, g.H);
      ctx.fill();
    }
    paintPagoda(ctx, g, g.W * 0.84, g.H * 0.6);
    return c;
  }

  function paintPagoda(ctx, g, x, y) {
    const u = g.u;
    ctx.fillStyle = '#566a6c';
    ctx.fillRect(x - u * 0.4, y - u * 19, u * 0.8, u * 5);
    for (let i = 0; i < 5; i++) {
      const w = u * (5.2 - i * 0.6);
      const ty = y - i * u * 3.1;
      poly(ctx, [x - w, ty, x + w, ty, x + w * 0.62, ty - u * 1.3, x - w * 0.62, ty - u * 1.3]);
      ctx.fillRect(x - w * 0.5, ty - u * 3, w, u * 1.7);
    }
    ctx.fillStyle = '#566a6c';
    ctx.fillRect(x - u * 7, y, u * 14, g.H);
  }

  // ---- trees -----------------------------------------------------------------

  function pine(ctx, g, x, base, h, lean, rand) {
    const u = g.u;
    ctx.strokeStyle = '#3b302c';
    ctx.lineWidth = Math.max(1, u * 1.3);
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.bezierCurveTo(x + lean * 0.2, base - h * 0.35, x - lean * 0.5, base - h * 0.6, x + lean, base - h);
    ctx.stroke();
    const tones = ['#2f4634', '#3b5640', '#4e6a4a'];
    for (let i = 0; i < 6; i++) {
      const f = 0.3 + i * 0.13;
      const px = x + lean * f * 1.1 + (rand() - 0.5) * u * 5;
      const py = base - h * f;
      const w = u * (6.5 - i * 0.5) * (0.8 + rand() * 0.5);
      ctx.fillStyle = tones[0];
      blob(ctx, px, py, w, u * 1.9);
      ctx.fillStyle = tones[1];
      blob(ctx, px - u * 0.6, py - u * 0.6, w * 0.8, u * 1.2);
      ctx.fillStyle = tones[2];
      blob(ctx, px - w * 0.3, py - u * 1.0, w * 0.4, u * 0.6);
    }
  }

  function cherry(ctx, g, x, base, h, spread, rand, dark) {
    const u = g.u;
    ctx.strokeStyle = dark ? '#3c3636' : '#2c2827';
    ctx.lineWidth = Math.max(1, u * (dark ? 1.4 : 2));
    const lean = (rand() - 0.5) * u * 8;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.bezierCurveTo(x - lean, base - h * 0.3, x + lean, base - h * 0.55, x + lean * 0.4, base - h * 0.8);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, u * 0.7);
    for (let i = 0; i < 4; i++) {
      const side = i % 2 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(x + lean * 0.2, base - h * (0.5 + i * 0.1));
      ctx.lineTo(x + side * spread * (0.5 + rand() * 0.4), base - h * (0.7 + rand() * 0.25));
      ctx.stroke();
    }
    const tones = dark ? ['#c3a9a6', '#d4bcb6', '#e2d0c7'] : ['#d8b2ae', '#e8ccc5', '#f4e6dc'];
    for (let i = 0; i < 46; i++) {
      const a = rand() * TAU;
      const d = Math.sqrt(rand());
      const bx = x + lean * 0.4 + Math.cos(a) * spread * d;
      const by = base - h * 0.85 + Math.sin(a) * spread * 0.55 * d;
      const r = u * (2 + rand() * 3);
      ctx.fillStyle = tones[0];
      blob(ctx, bx, by, r, r * 0.8);
      ctx.fillStyle = tones[1];
      blob(ctx, bx - r * 0.2, by - r * 0.25, r * 0.7, r * 0.55);
      if (rand() < 0.5) {
        ctx.fillStyle = tones[2];
        blob(ctx, bx - r * 0.35, by - r * 0.4, r * 0.3, r * 0.25);
      }
    }
  }

  // ---- the Buddha ------------------------------------------------------------

  function mirrored(cx, by, u, half) {
    const pts = [];
    for (let i = 0; i < half.length; i += 2) pts.push(cx + half[i] * u, by - half[i + 1] * u);
    for (let i = half.length - 2; i >= 0; i -= 2) pts.push(cx - half[i] * u, by - half[i + 1] * u);
    return pts;
  }

  function paintFigure(ctx, g) {
    const u = g.u;
    const cx = g.cx;
    const by = g.gy - u * 5;
    // plinth and lotus seat
    ctx.fillStyle = '#6c6a60';
    ctx.fillRect(cx - u * 26, g.gy - u * 5, u * 52, u * 5);
    ctx.fillStyle = '#8b887a';
    ctx.fillRect(cx - u * 26, g.gy - u * 5, u * 52, u * 1);
    ctx.fillStyle = '#434d43';
    for (let i = -5; i <= 5; i++) blob(ctx, cx + i * u * 4.2, by - u * 0.6, u * 2.6, u * 2.3);
    ctx.fillStyle = '#5a6858';
    for (let i = -5; i <= 5; i++) blob(ctx, cx + i * u * 4.2 - u * 0.5, by - u * 1.1, u * 1.6, u * 1.2);
    // robed body, knees wide
    ctx.fillStyle = '#34423a';
    poly(ctx, mirrored(cx, by, u, [
      23, 1.5, 24, 5, 22, 9, 17, 13, 12.5, 17, 11.5, 23, 12.5, 29, 12.2, 33,
      9.5, 35.8, 5, 37.2, 4.2, 38.5,
    ]));
    // lit left flank
    ctx.fillStyle = '#566757';
    poly(ctx, [cx - u * 23, by - u * 1.5, cx - u * 24, by - u * 5, cx - u * 22, by - u * 9,
      cx - u * 17, by - u * 13, cx - u * 11.5, by - u * 17, cx - u * 10, by - u * 24,
      cx - u * 12, by - u * 31, cx - u * 9.5, by - u * 35.8, cx - u * 6, by - u * 30,
      cx - u * 8, by - u * 22, cx - u * 14, by - u * 12, cx - u * 19, by - u * 5]);
    // shadowed lower robe and fold lines
    ctx.strokeStyle = '#222d27';
    ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.beginPath();
    ctx.moveTo(cx - u * 4, by - u * 37); ctx.lineTo(cx - u * 1, by - u * 29); ctx.lineTo(cx + u * 6, by - u * 24);
    ctx.moveTo(cx + u * 4, by - u * 37); ctx.lineTo(cx + u * 2, by - u * 30);
    ctx.moveTo(cx - u * 11, by - u * 27); ctx.quadraticCurveTo(cx - u * 15, by - u * 17, cx - u * 21, by - u * 8);
    ctx.moveTo(cx + u * 11, by - u * 27); ctx.quadraticCurveTo(cx + u * 15, by - u * 17, cx + u * 21, by - u * 8);
    ctx.moveTo(cx - u * 17, by - u * 6); ctx.lineTo(cx - u * 5, by - u * 9);
    ctx.moveTo(cx + u * 17, by - u * 6); ctx.lineTo(cx + u * 5, by - u * 9);
    ctx.stroke();
    // hands folded in the lap
    ctx.fillStyle = '#4a5a4c';
    blob(ctx, cx, by - u * 14.5, u * 6.5, u * 2.6);
    ctx.fillStyle = '#6a7b66';
    blob(ctx, cx - u * 1.5, by - u * 15.3, u * 4, u * 1.2);
    ctx.fillStyle = '#222d27';
    blob(ctx, cx, by - u * 12.3, u * 4.6, u * 0.6);
    // head, ears, hair knob
    ctx.fillStyle = '#34423a';
    blob(ctx, cx - u * 6.5, by - u * 41.5, u * 1.2, u * 3.6);
    blob(ctx, cx + u * 6.5, by - u * 41.5, u * 1.2, u * 3.6);
    blob(ctx, cx, by - u * 43, u * 6.2, u * 6.8);
    blob(ctx, cx, by - u * 49.5, u * 3.4, u * 2.8);
    ctx.fillStyle = '#4b5d4e';
    blob(ctx, cx - u * 1, by - u * 41.5, u * 4.6, u * 5.2);
    ctx.fillStyle = '#6b7e68';
    blob(ctx, cx - u * 2.2, by - u * 42, u * 2.2, u * 4);
    // curled hair dots
    ctx.fillStyle = '#1f2a24';
    for (let r = 0; r < 4; r++) {
      for (let i = -3; i <= 3; i++) {
        const hx = cx + i * u * 1.6 + (r % 2) * u * 0.8;
        const hy = by - u * (46.5 - r * 1.15);
        if (Math.abs(hx - cx) < u * (5.6 - r * 0.2)) blob(ctx, hx, hy, u * 0.55, u * 0.5);
      }
    }
    // closed eyes, nose, mouth, urna
    ctx.strokeStyle = '#1f2a24';
    ctx.lineWidth = Math.max(1, u * 0.45);
    ctx.beginPath();
    ctx.arc(cx - u * 2.2, by - u * 42.2, u * 1.3, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.arc(cx + u * 2.2, by - u * 42.2, u * 1.3, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.moveTo(cx - u * 1.2, by - u * 38.8); ctx.lineTo(cx + u * 1.2, by - u * 38.8);
    ctx.moveTo(cx, by - u * 42); ctx.lineTo(cx - u * 0.3, by - u * 40);
    ctx.stroke();
    ctx.fillStyle = '#c9a45a';
    blob(ctx, cx, by - u * 44.2, u * 0.6, u * 0.6);
    // gold rim of morning light down the left side
    ctx.strokeStyle = '#d2b06a';
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = Math.max(1, u * 0.6);
    ctx.beginPath();
    ctx.moveTo(cx - u * 5.5, by - u * 46);
    ctx.quadraticCurveTo(cx - u * 7, by - u * 42, cx - u * 4.6, by - u * 38);
    ctx.lineTo(cx - u * 9.5, by - u * 35.8);
    ctx.quadraticCurveTo(cx - u * 12.5, by - u * 28, cx - u * 11.5, by - u * 23);
    ctx.quadraticCurveTo(cx - u * 12, by - u * 17, cx - u * 17, by - u * 13);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function lantern(ctx, g, x, base) {
    const u = g.u;
    ctx.fillStyle = '#5f6159';
    ctx.fillRect(x - u * 1, base - u * 6, u * 2, u * 6);
    ctx.fillRect(x - u * 2, base - u * 1, u * 4, u * 1);
    ctx.fillRect(x - u * 2.2, base - u * 7.4, u * 4.4, u * 1.4);
    ctx.fillRect(x - u * 2, base - u * 11, u * 4, u * 3.6);
    ctx.fillStyle = '#2a2d29';
    ctx.fillRect(x - u * 0.8, base - u * 10.2, u * 1.6, u * 1.8);
    poly(ctx, [x - u * 4, base - u * 11, x + u * 4, base - u * 11, x + u * 1.4, base - u * 13.4, x - u * 1.4, base - u * 13.4]);
    blob(ctx, x, base - u * 14, u * 0.9, u * 0.9);
  }

  function paintMid(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.u;
    // far trees behind the figure
    pine(ctx, g, g.cx - u * 34, g.gy - u * 2, g.H * 0.42, u * 4, rand);
    cherry(ctx, g, g.cx + u * 36, g.gy - u * 3, g.H * 0.4, u * 14, rand, true);
    cherry(ctx, g, g.cx - u * 54, g.gy - u * 3, g.H * 0.36, u * 12, rand, true);
    pine(ctx, g, g.cx + u * 56, g.gy - u * 2, g.H * 0.34, -u * 3, rand);
    // lawn and gravel court
    const lawn = ctx.createLinearGradient(0, g.gy - u * 3, 0, g.H);
    lawn.addColorStop(0, '#5f7556');
    lawn.addColorStop(1, '#3f5a3f');
    ctx.fillStyle = lawn;
    ctx.fillRect(0, g.gy - u * 2, g.W, g.H);
    ctx.fillStyle = '#7d8e68';
    for (let i = 0; i < g.W * 0.4; i++) ctx.fillRect(rand() * g.W, g.gy + rand() * (g.H - g.gy), 1, 1);
    ctx.fillStyle = '#cfc6ad';
    poly(ctx, [g.cx - u * 12, g.gy, g.cx + u * 12, g.gy, g.cx + u * 30, g.H, g.cx - u * 30, g.H]);
    ctx.strokeStyle = '#b3aa92';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -3; i <= 3; i++) {
      ctx.moveTo(g.cx + i * u * 3, g.gy + 1);
      ctx.lineTo(g.cx + i * u * 8.5, g.H);
    }
    ctx.stroke();
    ctx.fillStyle = '#8b887a';
    for (let i = 0; i < 6; i++) {
      const sy = g.gy + u * (2 + i * i * 0.9);
      blob(ctx, g.cx + (i % 2 ? 1 : -1) * u * (14 + i * 4.6), sy, u * (1.4 + i * 0.5), u * (0.6 + i * 0.2));
    }
    paintFigure(ctx, g);
    lantern(ctx, g, g.cx + u * 38, g.gy + u * 4);
    return c;
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.u;
    cherry(ctx, g, g.W * 0.08, g.H + u * 4, g.H * 0.78, u * 17, rand, false);
    pine(ctx, g, g.W * 0.94, g.H + u * 2, g.H * 0.62, -u * 6, rand);
    // blossom branches reaching in from the top
    ctx.strokeStyle = '#2c2827';
    ctx.lineWidth = Math.max(1, u * 0.9);
    ctx.beginPath();
    ctx.moveTo(g.W * 0.64, -u * 2);
    ctx.bezierCurveTo(g.W * 0.72, g.H * 0.05, g.W * 0.82, g.H * 0.04, g.W * 0.95, g.H * 0.12);
    ctx.stroke();
    const tones = ['#d8b2ae', '#e8ccc5', '#f4e6dc'];
    for (let i = 0; i < 26; i++) {
      const f = rand();
      const bx = g.W * (0.66 + f * 0.3);
      const by = g.H * (0.01 + f * 0.1) + (rand() - 0.3) * u * 5;
      const r = u * (1.6 + rand() * 2.4);
      ctx.fillStyle = tones[0];
      blob(ctx, bx, by, r, r * 0.8);
      ctx.fillStyle = tones[1 + (rand() < 0.5 ? 1 : 0)];
      blob(ctx, bx - r * 0.3, by - r * 0.3, r * 0.6, r * 0.45);
    }
    return c;
  }

  // ---- mist and glow -----------------------------------------------------------

  function paintMist(g, rand, rows, alpha) {
    const h = Math.ceil(g.H * rows);
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f0e6d2';
    for (let i = 0; i < 14; i++) {
      const x = rand() * g.W;
      const y = h * (0.3 + rand() * 0.4);
      const rx = g.U * (10 + rand() * 18);
      ctx.globalAlpha = alpha * (0.5 + rand() * 0.5);
      for (const o of [-g.W, 0, g.W]) blob(ctx, x + o, y, rx, g.U * (1.2 + rand() * 1.6));
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintGlow(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const gx = g.cx + g.u * 14;
    const gr = ctx.createRadialGradient(gx, g.H * 0.3, 0, gx, g.H * 0.3, g.H * 0.55);
    gr.addColorStop(0, 'rgba(250,226,180,0.55)');
    gr.addColorStop(1, 'rgba(250,226,180,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  function makePetals(g, rand) {
    const P = {
      x: new Float32Array(MAX_PETALS), y: new Float32Array(MAX_PETALS),
      v: new Float32Array(MAX_PETALS), d: new Float32Array(MAX_PETALS),
      a: new Float32Array(MAX_PETALS), f: new Float32Array(MAX_PETALS),
      p: new Float32Array(MAX_PETALS), s: new Uint8Array(MAX_PETALS), tone: new Uint8Array(MAX_PETALS),
    };
    for (let i = 0; i < MAX_PETALS; i++) {
      P.x[i] = rand() * g.W;
      P.y[i] = rand() * g.H;
      P.v[i] = g.U * (1.6 + rand() * 1.6);
      P.d[i] = g.U * (0.5 + rand() * 1.2);
      P.a[i] = g.U * (0.8 + rand() * 1.6);
      P.f[i] = 0.6 + rand() * 1.1;
      P.p[i] = rand() * TAU;
      P.s[i] = rand() < 0.3 ? 2 : 1;
      P.tone[i] = Math.floor(rand() * PETAL_TONES.length);
    }
    return P;
  }

  function drawMist(ctx, g, t, strip, speed, y, k) {
    const off = (t * speed * g.U) % g.W;
    ctx.globalAlpha = k;
    ctx.drawImage(strip, off - g.W, y);
    ctx.drawImage(strip, off, y);
    ctx.globalAlpha = 1;
  }

  function drawPetals(ctx, g, t, count) {
    const P = state.petals;
    const span = g.H + 6;
    for (let i = 0; i < count; i++) {
      const y = (P.y[i] + t * P.v[i]) % span - 3;
      let x = (P.x[i] + t * P.d[i] + Math.sin(t * P.f[i] + P.p[i]) * P.a[i]) % g.W;
      if (x < 0) x += g.W;
      ctx.fillStyle = PETAL_TONES[P.tone[i]];
      ctx.fillRect(Math.round(x), Math.round(y), P.s[i], P.s[i]);
    }
  }

  // ---- run ---------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.mid = paintMid(g, rand);
    state.front = paintFront(g, rand);
    state.mistHigh = paintMist(g, rand, 0.3, 0.7);
    state.mistLow = paintMist(g, rand, 0.2, 0.8);
    state.glow = paintGlow(g);
    state.petals = makePetals(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { petals, mist, light } = api.props;
    const count = Math.min(MAX_PETALS, Math.round(PETALS * petals));
    ctx.drawImage(state.back, 0, 0);
    ctx.globalAlpha = Math.min(1, light * (0.6 + 0.4 * Math.sin(t * 0.25)));
    ctx.drawImage(state.glow, 0, 0);
    ctx.globalAlpha = 1;
    drawMist(ctx, g, t, state.mistHigh, 0.9, g.H * 0.4, 0.55 * Math.min(1.4, mist));
    ctx.drawImage(state.mid, 0, 0);
    drawMist(ctx, g, t, state.mistLow, -1.4, g.gy - g.H * 0.2, 0.6 * Math.min(1.4, mist));
    ctx.drawImage(state.front, 0, 0);
    drawPetals(ctx, g, t, count);
  }

  Kasuri.run({
    defaults: { petals: 1, mist: 1, light: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
