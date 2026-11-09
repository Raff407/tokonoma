/*
 * 琴 Koto — a koto lying across a tatami room, an open shoji onto a cherry garden.
 *
 * Garden, blossoms, room, light and the koto body are baked once. Per frame: the
 * blossom layer sways a hair, thirteen strings tremble, and a short pool of petals
 * drifts in from the opening toward the viewer.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp } = K;
  const TAU = Math.PI * 2;
  const STRINGS = 13;
  const MAX_PETALS = 44;
  const PETALS = 26;
  const PETAL_TONES = ['#e8c3c0', '#f0d8d2', '#dca9a8'];
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
    const U = Math.max(0.6, H / 100);
    const fl = Math.round(H * 0.6);
    const ox0 = W * 0.5;
    const ox1 = W * 0.95;
    const oy0 = H * 0.09;
    const oy1 = fl - H * 0.03;
    const koto = {
      xl: W * 0.06, xr: W * 0.88,
      ylb: H * 0.72, ylf: H * 0.875,
      yrb: H * 0.64, yrf: H * 0.745,
      side: H * 0.04,
    };
    return { W, H, U, fl, ox0, ox1, oy0, oy1, koto };
  }

  // ---- garden seen through the opening ------------------------------------

  function paintGarden(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const { ox0, ox1, oy0, oy1, U } = g;
    const sky = ctx.createLinearGradient(0, oy0, 0, oy1);
    sky.addColorStop(0, '#b9c6c8');
    sky.addColorStop(0.6, '#dcdac8');
    sky.addColorStop(1, '#e6dcc0');
    ctx.fillStyle = sky;
    ctx.fillRect(ox0, oy0, ox1 - ox0, oy1 - oy0);
    ctx.fillStyle = '#9fadb0';
    const base = oy1 - U * 8;
    ctx.beginPath();
    ctx.moveTo(ox0, base);
    for (let x = ox0; x <= ox1; x += U) {
      ctx.lineTo(x, base - U * (7 + 5 * Math.sin(x / (U * 9)) + 3 * Math.sin(x / (U * 3.7))));
    }
    ctx.lineTo(ox1, base);
    ctx.fill();
    ctx.fillStyle = '#7f9078';
    ctx.fillRect(ox0, oy1 - U * 8, ox1 - ox0, U * 8);
    ctx.fillStyle = '#6d7d5f';
    for (let i = 0; i < 9; i++) blob(ctx, ox0 + rand() * (ox1 - ox0), oy1 - U * (1 + rand() * 3), U * (5 + rand() * 6), U * 1.6);
    ctx.fillStyle = '#d6cdb2';
    blob(ctx, lerp(ox0, ox1, 0.35), oy1 - U * 1.5, U * 14, U * 1.1);
    trunk(ctx, g);
    return c;
  }

  function branchPoints(g) {
    const { ox0, ox1, oy0, oy1 } = g;
    const w = ox1 - ox0;
    const h = oy1 - oy0;
    const p = (a, b) => [ox0 + w * a, oy0 + h * b];
    return [
      [p(0.8, 1.02), p(0.78, 0.7), p(0.66, 0.48), 1],
      [p(0.7, 0.6), p(0.58, 0.55), p(0.4, 0.4), 0.55],
      [p(0.66, 0.5), p(0.74, 0.34), p(0.84, 0.18), 0.55],
      [p(0.72, 0.4), p(0.62, 0.26), p(0.5, 0.16), 0.45],
      [p(0.8, 0.8), p(0.9, 0.62), p(0.98, 0.5), 0.5],
    ];
  }

  function trunk(ctx, g) {
    ctx.strokeStyle = '#33281f';
    ctx.lineCap = 'round';
    for (const [a, b, c, k] of branchPoints(g)) {
      ctx.lineWidth = Math.max(1, g.U * 2.6 * k);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.quadraticCurveTo(b[0], b[1], c[0], c[1]);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  function paintBlossoms(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.ox0 - g.U * 2, g.oy0 - g.U * 2, g.ox1 - g.ox0 + g.U * 4, g.oy1 - g.oy0 + g.U * 2);
    ctx.clip();
    const tones = ['#c98f92', '#dba9a8', '#e8c6c0', '#f0dad2'];
    for (const [a, b, e] of branchPoints(g)) {
      for (let i = 0; i < 18; i++) {
        const t = 0.35 + (i / 18) * 0.65;
        const x = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * b[0] + t * t * e[0];
        const y = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * b[1] + t * t * e[1];
        for (let j = 0; j < 3; j++) {
          ctx.fillStyle = tones[Math.floor(rand() * 3 + (j === 2 ? 1 : 0))];
          const r = g.U * (2.2 + rand() * 3.2);
          blob(ctx, x + (rand() - 0.5) * g.U * 7, y + (rand() - 0.5) * g.U * 6, r, r * 0.8);
        }
      }
    }
    ctx.restore();
    return c;
  }

  // ---- room ----------------------------------------------------------------

  function paintRoom(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const { W, H, U, fl } = g;
    const wall = ctx.createLinearGradient(0, 0, 0, fl);
    wall.addColorStop(0, '#8d7e66');
    wall.addColorStop(1, '#b6a888');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, fl);
    alcove(ctx, g);
    ctx.clearRect(g.ox0, g.oy0, g.ox1 - g.ox0, g.oy1 - g.oy0);
    frame(ctx, g);
    shojiPanel(ctx, g);
    ctx.fillStyle = '#34281f';
    ctx.fillRect(0, 0, W, g.oy0 * 0.7);
    ctx.fillStyle = '#4a3a2c';
    ctx.fillRect(0, g.oy0 * 0.7, W, U * 0.8);
    floor(ctx, g, rand);
    return c;
  }

  function alcove(ctx, g) {
    const { W, H, U, fl } = g;
    const x0 = W * 0.07;
    const x1 = W * 0.33;
    const y0 = H * 0.12;
    const y1 = fl - H * 0.06;
    ctx.fillStyle = '#7a6d56';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = '#5a4d3c';
    ctx.fillRect(x0, y0, x1 - x0, U * 1.2);
    ctx.fillStyle = '#3f2f22';
    ctx.fillRect(x0 - U * 1.2, y0 - U, U * 1.6, y1 - y0 + U * 3);
    ctx.fillRect(x0, y1, x1 - x0 + U, U * 2.4);
    ctx.fillStyle = '#2b2118';
    ctx.fillRect(x0, y1 + U * 2.4, x1 - x0 + U, U * 0.7);
    scroll(ctx, g, lerp(x0, x1, 0.32), y0 + U * 2);
    vase(ctx, g, lerp(x0, x1, 0.78), y1);
  }

  function scroll(ctx, g, cx, top) {
    const { U } = g;
    const w = U * 8;
    const h = U * 30;
    ctx.fillStyle = '#2f3d52';
    ctx.fillRect(cx - w / 2 - U * 0.8, top, w + U * 1.6, h);
    ctx.fillStyle = '#d5cbae';
    ctx.fillRect(cx - w / 2, top + U * 2, w, h - U * 4);
    ctx.fillStyle = '#6a6b62';
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, top + h * 0.62);
    ctx.lineTo(cx - w * 0.2, top + h * 0.38);
    ctx.lineTo(cx + w * 0.05, top + h * 0.55);
    ctx.lineTo(cx + w * 0.28, top + h * 0.3);
    ctx.lineTo(cx + w / 2, top + h * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d5cbae';
    ctx.fillRect(cx - w / 2, top + h * 0.56, w, U * 1.6);
    ctx.fillStyle = '#9b4a3a';
    ctx.fillRect(cx + w * 0.2, top + h - U * 8, U * 1.4, U * 1.4);
    ctx.fillStyle = '#2b2118';
    ctx.fillRect(cx - w / 2 - U * 1.2, top + h, w + U * 2.4, U * 0.8);
  }

  function vase(ctx, g, cx, y) {
    const { U } = g;
    ctx.fillStyle = '#2f3d52';
    blob(ctx, cx, y - U * 3, U * 2.6, U * 3);
    ctx.fillRect(cx - U * 0.8, y - U * 8, U * 1.6, U * 3);
    ctx.strokeStyle = '#3a2d22';
    ctx.lineWidth = Math.max(1, U * 0.5);
    ctx.beginPath();
    ctx.moveTo(cx, y - U * 8);
    ctx.quadraticCurveTo(cx + U * 3, y - U * 13, cx + U * 6, y - U * 15);
    ctx.stroke();
    ctx.fillStyle = '#dca9a8';
    for (const [dx, dy] of [[3, 12], [5, 14.5], [6.5, 15.5], [1.6, 10.4]]) blob(ctx, cx + U * dx, y - U * dy, U * 0.9, U * 0.8);
  }

  function frame(ctx, g) {
    const { U, ox0, ox1, oy0, oy1 } = g;
    ctx.fillStyle = '#3a2c20';
    ctx.fillRect(ox0 - U * 1.6, oy0 - U * 1.6, ox1 - ox0 + U * 3.2, U * 2.4);
    ctx.fillRect(ox0 - U * 1.6, oy0, U * 1.6, oy1 - oy0 + U * 2);
    ctx.fillRect(ox1, oy0, U * 1.6, oy1 - oy0 + U * 2);
    ctx.fillStyle = '#5a4430';
    ctx.fillRect(ox0 - U * 1.6, oy1, ox1 - ox0 + U * 3.2, U * 2);
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(ox0 - U * 1.6, oy1 + U * 2, ox1 - ox0 + U * 3.2, U * 0.7);
  }

  function shojiPanel(ctx, g) {
    const { U, ox0, ox1, oy0, oy1 } = g;
    const x0 = ox0;
    const x1 = ox0 + (ox1 - ox0) * 0.25;
    ctx.fillStyle = '#d9d2bb';
    ctx.fillRect(x0, oy0, x1 - x0, oy1 - oy0);
    ctx.fillStyle = '#7a6048';
    const t = Math.max(1, U * 0.45);
    for (let i = 0; i <= 4; i++) ctx.fillRect(lerp(x0, x1, i / 4) - t / 2, oy0, t, oy1 - oy0);
    for (let j = 0; j <= 9; j++) ctx.fillRect(x0, lerp(oy0, oy1, j / 9) - t / 2, x1 - x0, t);
    ctx.fillStyle = '#4a3828';
    ctx.fillRect(x1 - U * 0.8, oy0, U * 1.4, oy1 - oy0);
    ctx.fillRect(x0, oy0, x1 - x0, U * 0.9);
    ctx.fillRect(x0, oy1 - U * 0.9, x1 - x0, U * 0.9);
    ctx.fillStyle = '#9fa08a';
    ctx.fillRect(x1 - U * 2.4, lerp(oy0, oy1, 0.55), U * 1.1, U * 3.2);
  }

  function floor(ctx, g, rand) {
    const { W, H, U, fl } = g;
    const vx = W * 0.5;
    const vy = fl - H * 0.45;
    const rows = 5;
    const ys = [];
    for (let k = 0; k <= rows; k++) ys.push(fl + (H - fl) * Math.pow(k / rows, 1.7));
    const cols = 9;
    const spread = (xb) => vx + (xb - vx) * ((fl - vy) / (H - vy));
    ctx.fillStyle = '#9c9468';
    ctx.fillRect(0, fl, W, H - fl);
    for (let k = 0; k < rows; k++) {
      for (let j = 0; j < cols; j++) {
        const shift = (k % 2) * 0.5 + (j % 3 === 0 ? 0.0 : 0);
        const ta = (k * 0.9 + j * 0.55 + shift) % 1;
        ctx.fillStyle = ta < 0.5 ? '#a39b6f' : '#979068';
        const xa = -W * 0.6 + ((j - 0) / cols) * W * 2.2;
        const xb = -W * 0.6 + ((j + 1) / cols) * W * 2.2;
        const fa = (ys[k] - vy) / (H - vy);
        const fb = (ys[k + 1] - vy) / (H - vy);
        poly(ctx, [vx + (xa - vx) * fa, ys[k], vx + (xb - vx) * fa, ys[k], vx + (xb - vx) * fb, ys[k + 1], vx + (xa - vx) * fb, ys[k + 1]]);
      }
    }
    ctx.strokeStyle = '#2d3a3c';
    ctx.lineWidth = Math.max(1, U * 0.5);
    for (let k = 0; k <= rows; k++) {
      ctx.beginPath();
      ctx.moveTo(0, ys[k]);
      ctx.lineTo(W, ys[k]);
      ctx.stroke();
    }
    for (let j = 0; j <= cols; j++) {
      const xb = -W * 0.6 + (j / cols) * W * 2.2;
      ctx.beginPath();
      ctx.moveTo(spread(xb), fl);
      ctx.lineTo(xb, H);
      ctx.stroke();
    }
    ctx.fillStyle = '#33281f';
    ctx.fillRect(0, fl - U * 0.9, W, U * 1.3);
    const dark = ctx.createLinearGradient(0, 0, W, 0);
    dark.addColorStop(0, 'rgba(30,24,20,0.45)');
    dark.addColorStop(0.55, 'rgba(30,24,20,0)');
    ctx.fillStyle = dark;
    ctx.fillRect(0, fl, W, H - fl);
  }

  // ---- light on the mats ---------------------------------------------------

  function paintLight(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const { W, H, U, fl, ox0, ox1 } = g;
    const lean = W * 0.24;
    const quad = [ox0, fl, ox1, fl, ox1 - lean, H, ox0 - lean, H];
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < quad.length; i += 2) (i ? ctx.lineTo : ctx.moveTo).call(ctx, quad[i], quad[i + 1]);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = 'rgba(238,208,134,0.3)';
    ctx.fillRect(0, fl, W, H - fl);
    ctx.strokeStyle = 'rgba(70,50,30,0.22)';
    ctx.lineWidth = Math.max(1, U * 0.7);
    for (let i = 0; i < 8; i++) {
      const f = i / 7;
      ctx.beginPath();
      ctx.moveTo(lerp(ox0, ox1, f), fl);
      ctx.lineTo(lerp(ox0 - lean, ox1 - lean, f), H);
      ctx.stroke();
    }
    for (let j = 1; j < 8; j++) {
      const y = fl + (H - fl) * Math.pow(j / 8, 1.4);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();
    return c;
  }

  // ---- koto ----------------------------------------------------------------

  function edgeY(k, f, back) {
    return lerp(back ? k.ylb : k.ylf, back ? k.yrb : k.yrf, f);
  }

  function paintKoto(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const k = g.koto;
    const U = g.U;
    ctx.fillStyle = 'rgba(25,20,16,0.4)';
    poly(ctx, [k.xl - U, k.ylf + k.side, k.xr + U * 2, k.yrf + k.side * 0.7, k.xr + U * 6, k.yrf + k.side + U * 2, k.xl + U * 3, k.ylf + k.side + U * 3]);
    ctx.fillStyle = '#2f2118';
    poly(ctx, [k.xl, k.ylf, k.xr, k.yrf, k.xr, k.yrf + k.side * 0.75, k.xl, k.ylf + k.side]);
    ctx.fillStyle = '#5a3d29';
    poly(ctx, [k.xl, k.ylb, k.xr, k.yrb, k.xr, k.yrf, k.xl, k.ylf]);
    ctx.strokeStyle = '#8a6745';
    ctx.lineWidth = Math.max(1, U * 0.3);
    for (let i = 0; i < 9; i++) {
      const t = (i + rand()) / 9;
      ctx.beginPath();
      ctx.moveTo(k.xl, lerp(k.ylb, k.ylf, t));
      ctx.lineTo(k.xr, lerp(k.yrb, k.yrf, t));
      ctx.stroke();
    }
    ctx.fillStyle = '#35261b';
    poly(ctx, [k.xl, k.ylb, k.xl + U * 4, k.ylb, k.xl + U * 4, k.ylf, k.xl, k.ylf]);
    poly(ctx, [k.xr - U * 3, k.yrb, k.xr, k.yrb, k.xr, k.yrf, k.xr - U * 3, k.yrf]);
    ctx.fillStyle = '#c0442c';
    poly(ctx, [k.xr - U * 2.6, k.yrb, k.xr - U * 1.6, k.yrb, k.xr - U * 1.6, k.yrf, k.xr - U * 2.6, k.yrf]);
    ctx.fillStyle = '#2b2018';
    ctx.fillRect(k.xl + U * 3, k.ylf + k.side, U * 2, U * 2.5);
    ctx.fillRect(k.xr - U * 5, k.yrf + k.side * 0.75, U * 2, U * 2);
    bridges(ctx, g);
    return c;
  }

  function stringSpan(g) {
    const k = g.koto;
    return { x0: k.xl + g.U * 4, x1: k.xr - g.U * 3 };
  }

  function stringAt(g, i, f) {
    const k = g.koto;
    const t = (i + 0.5) / STRINGS;
    return lerp(lerp(k.ylb, k.ylf, t), lerp(k.yrb, k.yrf, t), f);
  }

  function bridges(ctx, g) {
    const { x0, x1 } = stringSpan(g);
    const U = g.U;
    for (let i = 0; i < STRINGS; i++) {
      const bf = 0.3 + 0.03 * Math.abs(i - 6) + i * 0.012;
      const x = lerp(x0, x1, bf);
      const y = stringAt(g, i, bf);
      ctx.fillStyle = '#e4dcc0';
      poly(ctx, [x - U * 0.8, y + U * 0.5, x, y - U * 1.5, x + U * 0.8, y + U * 0.5]);
      ctx.fillStyle = '#a89a78';
      ctx.fillRect(x - U * 0.8, y + U * 0.5, U * 1.6, U * 0.5);
    }
  }

  function bakeStrings(g) {
    const { x0, x1 } = stringSpan(g);
    const s = { x0, x1, y0: new Float32Array(STRINGS), y1: new Float32Array(STRINGS), ph: new Float32Array(STRINGS), fr: new Float32Array(STRINGS) };
    for (let i = 0; i < STRINGS; i++) {
      s.y0[i] = stringAt(g, i, (x0 - g.koto.xl) / (g.koto.xr - g.koto.xl));
      s.y1[i] = stringAt(g, i, (x1 - g.koto.xl) / (g.koto.xr - g.koto.xl));
      s.ph[i] = i * 1.9;
      s.fr[i] = 7 + (i % 5) * 1.3;
    }
    return s;
  }

  function drawStrings(ctx, g, t, amount) {
    const s = state.strings;
    const amp = Math.max(0.7, g.U * 0.55) * amount;
    const xm = (s.x0 + s.x1) / 2;
    ctx.strokeStyle = 'rgba(236,228,204,0.62)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let i = 0; i < STRINGS; i++) {
      const env = Math.max(0, Math.sin(t * 0.37 + s.ph[i]));
      const off = Math.sin(t * s.fr[i] + s.ph[i]) * amp * (0.25 + env * env);
      ctx.moveTo(s.x0, s.y0[i]);
      ctx.quadraticCurveTo(xm, (s.y0[i] + s.y1[i]) / 2 + off, s.x1, s.y1[i]);
    }
    ctx.stroke();
  }

  // ---- petals --------------------------------------------------------------

  function makePetals() {
    const f = () => new Float32Array(MAX_PETALS);
    return { x: f(), y: f(), vx: f(), vy: f(), a: f(), spin: f(), p: f(), size: f(), tone: new Uint8Array(MAX_PETALS) };
  }

  function resetPetal(g, P, i, scatter) {
    const r = state.rand;
    const w = g.ox1 - g.ox0;
    const h = g.oy1 - g.oy0;
    P.x[i] = g.ox0 + w * (0.3 + r() * 0.7);
    P.y[i] = g.oy0 + h * (0.02 + r() * 0.5);
    P.vx[i] = -g.U * (3 + r() * 5);
    P.vy[i] = g.U * (2.2 + r() * 2.6);
    P.a[i] = r() * TAU;
    P.spin[i] = (r() - 0.5) * 3;
    P.p[i] = r() * TAU;
    P.size[i] = g.U * (0.9 + r() * 0.8);
    P.tone[i] = Math.floor(r() * 3);
    if (scatter) {
      const tau = r() * 14;
      P.x[i] += P.vx[i] * tau;
      P.y[i] += P.vy[i] * tau;
    }
  }

  function stepPetal(g, P, i, t, dt) {
    P.y[i] += P.vy[i] * dt;
    P.x[i] += (P.vx[i] + Math.sin(t * 1.1 + P.p[i]) * g.U * 2.4) * dt;
    P.a[i] += P.spin[i] * dt;
    if (P.y[i] > g.H + g.U * 2 || P.x[i] < -g.U * 3) resetPetal(g, P, i, false);
  }

  function drawPetals(ctx, g, t, count) {
    const P = state.petals;
    for (let i = 0; i < count; i++) {
      const c = Math.cos(P.a[i]);
      const s = Math.sin(P.a[i]);
      const sq = 0.45 + 0.55 * Math.abs(Math.sin(t * 1.6 + P.p[i]));
      const sz = P.size[i] * (1 + Math.max(0, P.y[i] - g.oy0) / g.H * 1.2);
      ctx.fillStyle = PETAL_TONES[P.tone[i]];
      ctx.setTransform(c * sq, s * sq, -s, c, P.x[i], P.y[i]);
      ctx.fillRect(-sz / 2, -sz * 0.35, sz, sz * 0.7);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.garden = paintGarden(g, rand);
    state.blossoms = paintBlossoms(g, rand);
    state.room = paintRoom(g, rand);
    state.light = paintLight(g);
    state.koto = paintKoto(g, rand);
    state.strings = bakeStrings(g);
    state.petals = makePetals();
    for (let i = 0; i < MAX_PETALS; i++) resetPetal(g, state.petals, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { petals, tremble } = api.props;
    const count = Math.min(MAX_PETALS, Math.round(PETALS * petals));
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) stepPetal(g, state.petals, i, t, step);
    ctx.drawImage(state.garden, 0, 0);
    ctx.drawImage(state.blossoms, Math.sin(t * 0.5) * g.U * 0.45, Math.sin(t * 0.33 + 1) * g.U * 0.2);
    ctx.drawImage(state.room, 0, 0);
    ctx.drawImage(state.light, 0, 0);
    ctx.drawImage(state.koto, 0, 0);
    drawStrings(ctx, g, t, tremble);
    drawPetals(ctx, g, t, count);
  }

  Kasuri.run({
    defaults: { petals: 1, tremble: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
