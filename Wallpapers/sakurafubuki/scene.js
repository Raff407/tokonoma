/*
 * 桜吹雪 Sakurafubuki — a stone path under a tunnel of cherry blossom, petals streaming past.
 *
 * Path, trunks and blossom rings are baked once in depth order, far to near. A soft glow
 * sits at the far end. Petals are a fixed pool of typed arrays blown across on a slow wind.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp } = K;
  const TAU = Math.PI * 2;
  const MAX_PETALS = 240;
  const PETALS = 150;
  const TONES = ['#f0d9d4', '#e6bcbc', '#d9a3a8', '#f4ebdc'];
  const FOG = '#efe3d0';
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

  function fogged(hex, f) {
    return K.toHex(K.mixColor(K.parseColor(hex), K.parseColor(FOG), f));
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    return { W, H, U: H / 100, vx: W * 0.5, vy: H * 0.43 };
  }

  // depth z runs from far (large) to near (about 1); scale s = 1 / z
  function groundY(g, s) { return g.vy + s * g.H * 0.6; }

  function paintSky(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H);
    grad.addColorStop(0, '#d8c3bd');
    grad.addColorStop(0.45, '#f1e6d6');
    grad.addColorStop(1, '#9a9488');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
  }

  function stoneBand(ctx, g, rand, z0, z1) {
    const s0 = 1 / z0;
    const s1 = 1 / z1;
    const y0 = groundY(g, s0);
    const y1 = groundY(g, s1);
    const pw0 = s0 * g.W * 0.3;
    const pw1 = s1 * g.W * 0.3;
    const fog = Math.min(0.7, (z0 - 1) / 18);
    ctx.fillStyle = fogged('#8c9272', fog);
    ctx.fillRect(0, y0, g.W, y1 - y0 + 1);
    const n = 3 + Math.floor(rand() * 2);
    let xa = -0.5;
    for (let i = 0; i < n; i++) {
      const xb = i === n - 1 ? 0.5 : xa + (1 / n) * (0.7 + rand() * 0.6);
      const b = Math.min(0.5, xb);
      const tone = ['#7a7c80', '#6a6d75', '#8a8a86', '#5d6068'][Math.floor(rand() * 4)];
      ctx.fillStyle = fogged(tone, fog);
      ctx.beginPath();
      ctx.moveTo(g.vx + xa * 2 * pw0 + 0.6, y0);
      ctx.lineTo(g.vx + b * 2 * pw0 - 0.6, y0);
      ctx.lineTo(g.vx + b * 2 * pw1 - 0.6, y1);
      ctx.lineTo(g.vx + xa * 2 * pw1 + 0.6, y1);
      ctx.fill();
      xa = b;
      if (xa >= 0.5) break;
    }
    ctx.fillStyle = fogged('#2f3a33', fog + 0.1);
    ctx.fillRect(g.vx - pw1 - 1, y1 - 0.5, pw1 * 2 + 2, 1);
    // petals lying on the stones and moss
    for (let i = 0; i < 9; i++) {
      const f = rand();
      const px = g.vx + (rand() * 2 - 1) * g.W * (0.2 + 0.5 * rand()) * s1;
      const py = lerp(y0, y1, f);
      ctx.fillStyle = fogged(TONES[Math.floor(rand() * 3)], fog * 0.6);
      blob(ctx, px, py, g.U * (0.25 + s1 * 0.5), g.U * (0.15 + s1 * 0.25));
    }
  }

  function trunk(ctx, g, z, side, rand) {
    const s = 1 / z;
    const fog = Math.min(0.75, (z - 1) / 14);
    const x = g.vx + side * s * g.W * 0.4;
    const yg = groundY(g, s);
    const yt = g.vy - s * g.H * 0.42;
    const w = s * g.W * 0.028;
    ctx.fillStyle = fogged('#3a3436', fog);
    ctx.beginPath();
    ctx.moveTo(x - w, yg);
    ctx.lineTo(x - w * 0.7, yt);
    ctx.lineTo(x + w * 0.7, yt);
    ctx.lineTo(x + w, yg);
    ctx.fill();
    ctx.fillStyle = fogged('#5a5250', fog);
    ctx.fillRect(x - w * 0.5, yt, w * 0.35, yg - yt);
    for (let i = 0; i < 5; i++) {
      const by = lerp(yt, yg, 0.05 + rand() * 0.3);
      const br = s * g.H * (0.05 + rand() * 0.05);
      ctx.fillStyle = fogged(TONES[1 + Math.floor(rand() * 2)], fog);
      blob(ctx, x + (rand() - 0.5) * w * 5, by, br, br * 0.75);
      ctx.fillStyle = fogged(TONES[0], fog);
      blob(ctx, x + (rand() - 0.5) * w * 5, by - br * 0.3, br * 0.5, br * 0.35);
    }
  }

  function blossomRing(ctx, g, rand, z) {
    const s = 1 / z;
    const fog = Math.min(0.8, (z - 1) / 12);
    const rx = s * g.W * 0.62;
    const ry = s * g.H * 0.5;
    const r = Math.max(g.U * 1.2, s * g.H * 0.14);
    const arc = Math.PI * 1.25 * rx;
    const n = Math.max(8, Math.min(60, Math.round(arc / (r * 0.9))));
    for (let i = 0; i < n; i++) {
      const th = -0.6 + ((Math.PI + 1.2) * (i + rand() * 0.6)) / n;
      const jx = (rand() - 0.5) * r;
      const x = g.vx + Math.cos(th) * rx * (0.9 + rand() * 0.3) + jx;
      const y = g.vy - Math.sin(th) * ry * (0.9 + rand() * 0.3) + (rand() - 0.5) * r;
      const rr = r * (0.7 + rand() * 0.6);
      ctx.fillStyle = fogged('#d4a0a6', fog);
      blob(ctx, x, y + rr * 0.15, rr, rr * 0.8);
      ctx.fillStyle = fogged('#e9c4c4', fog);
      blob(ctx, x - rr * 0.15, y - rr * 0.05, rr * 0.8, rr * 0.62);
      ctx.fillStyle = fogged(TONES[Math.floor(rand() * 4)], fog);
      blob(ctx, x - rr * 0.3, y - rr * 0.25, rr * 0.45, rr * 0.3);
      if (rand() < 0.5) {
        ctx.fillStyle = fogged('#f6efe4', fog);
        blob(ctx, x + (rand() - 0.5) * rr, y - rr * 0.35, rr * 0.2, rr * 0.14);
      }
    }
  }

  function paintWorld(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g);
    let z = 16;
    while (z > 1.0) {
      const nz = z * 0.88;
      stoneBand(ctx, g, rand, z, Math.max(1, nz * 0.995));
      trunk(ctx, g, z, -1, rand);
      trunk(ctx, g, z * 0.96, 1, rand);
      blossomRing(ctx, g, rand, z);
      blossomRing(ctx, g, rand, z * 0.94);
      z = nz;
    }
    // soft light at the far end
    const gl = ctx.createRadialGradient(g.vx, g.vy, 0, g.vx, g.vy, g.H * 0.22);
    gl.addColorStop(0, 'rgba(244,235,220,0.75)');
    gl.addColorStop(1, 'rgba(244,235,220,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  function paintGlow(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const gl = ctx.createRadialGradient(g.vx, g.vy, 0, g.vx, g.vy, g.H * 0.5);
    gl.addColorStop(0, 'rgba(246,238,224,0.5)');
    gl.addColorStop(1, 'rgba(246,238,224,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  // ---- petals --------------------------------------------------------------

  function makePetals(g, rand) {
    const P = {
      x: new Float32Array(MAX_PETALS), y: new Float32Array(MAX_PETALS),
      vx: new Float32Array(MAX_PETALS), vy: new Float32Array(MAX_PETALS),
      a: new Float32Array(MAX_PETALS), spin: new Float32Array(MAX_PETALS),
      p: new Float32Array(MAX_PETALS), size: new Float32Array(MAX_PETALS),
      tone: new Uint8Array(MAX_PETALS),
    };
    for (let i = 0; i < MAX_PETALS; i++) {
      const near = rand() * rand();
      P.size[i] = g.U * (0.8 + near * 3.2);
      P.vx[i] = -g.U * (5 + near * 10) * (0.7 + rand() * 0.6);
      P.vy[i] = g.U * (1.5 + near * 4) * (0.6 + rand() * 0.8);
      P.x[i] = rand() * (g.W + g.H * 0.4);
      P.y[i] = rand() * g.H;
      P.a[i] = rand() * TAU;
      P.spin[i] = (rand() - 0.5) * 3;
      P.p[i] = rand() * TAU;
      P.tone[i] = Math.floor(rand() * TONES.length);
    }
    return P;
  }

  function stepAndDraw(ctx, g, P, t, dt, count, wind) {
    const span = g.W + g.H * 0.4;
    for (let i = 0; i < count; i++) {
      P.x[i] += P.vx[i] * wind * dt;
      P.y[i] += (P.vy[i] + Math.sin(t * 0.9 + P.p[i]) * g.U * 1.6) * dt;
      P.a[i] += P.spin[i] * dt;
      if (P.x[i] < -g.U * 4) { P.x[i] += span; }
      if (P.y[i] > g.H + g.U * 4) { P.y[i] -= g.H + g.U * 8; }
      const sq = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.5 + P.p[i]));
      const c = Math.cos(P.a[i]);
      const s = Math.sin(P.a[i]);
      const sz = P.size[i];
      ctx.fillStyle = TONES[P.tone[i]];
      ctx.setTransform(c * sq, s * sq, -s, c, P.x[i], P.y[i]);
      ctx.fillRect(-sz * 0.5, -sz * 0.32, sz, sz * 0.64);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.world = paintWorld(g, rand);
    state.glow = paintGlow(g);
    state.petals = makePetals(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { storm, wind, glow } = api.props;
    const count = Math.min(MAX_PETALS, Math.round(PETALS * storm));
    ctx.drawImage(state.world, 0, 0);
    ctx.globalAlpha = Math.min(1, glow * (0.6 + 0.2 * Math.sin(t * 0.35)));
    ctx.drawImage(state.glow, 0, 0);
    ctx.globalAlpha = 1;
    stepAndDraw(ctx, g, state.petals, t, Math.min(dt, 0.1), count, 0.6 + wind * 0.5 + 0.25 * Math.sin(t * 0.25));
  }

  Kasuri.run({
    defaults: { storm: 1, wind: 1, glow: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
