/*
 * 狛犬 Komainu — a pair of mossy stone guardians flanking a shrine path in soft rain.
 *
 * Sky, cedars, path, lanterns and the two guardians are baked once. Per frame: a drifting
 * mist strip, a short pool of rain streaks, a few puddle rings and a slow lantern glow.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;
  const TAU = Math.PI * 2;
  const HORIZON = 0.5;
  const SKY = ['#121726', '#1a2236', '#253048', '#323d56', '#3e4860'];
  const STONE = { ink: '#181a1b', dark: '#3a3e3b', mane: '#4a4e46', mid: '#62655d', body: '#7a7b72', edge: '#949082', moss: '#4a5e3c', mossLight: '#647648' };
  const CEDAR = ['#2a4034', '#34503c', '#44644a'];
  const GOLD = '#e0b95a';
  const DROPS = 80;
  const RINGS = 14;
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
    const U = H / 100;
    const u = U * Math.min(1, W / (U * 150));
    return { W, H, U, u, hy: Math.round(H * HORIZON), cx: W * 0.5 };
  }

  // ---- sky and cedars -------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.hy + 2);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.hy + 2; y++) {
      const f = Math.min(1, y / g.hy) * (inks.length - 1);
      const k = Math.min(inks.length - 2, Math.floor(f));
      for (let x = 0; x < g.W; x++) {
        const ink = inks[k + (rand() < f - k ? 1 : 0)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // A cedar as a narrow stack of drooping tiers on a straight trunk.
  function cedar(ctx, x, base, h, ink) {
    const w = h * 0.2;
    ctx.fillStyle = ink[0];
    ctx.fillRect(x - w * 0.07, base - h * 0.2, w * 0.14, h * 0.2);
    for (let i = 0; i < 6; i++) {
      const f = i / 6;
      const y = base - h * (0.12 + f * 0.82);
      const half = w * (1 - f * 0.8);
      ctx.fillStyle = ink[i % 3 === 0 ? 1 : 0];
      poly(ctx, [x - half, y, x, y - h * 0.2, x + half, y]);
    }
    ctx.fillStyle = ink[2];
    poly(ctx, [x - w * 0.12, base - h * 0.88, x, base - h, x + w * 0.12, base - h * 0.88]);
  }

  function paintCedars(ctx, g, rand) {
    const rows = [
      { y: g.hy - g.U * 1, h: g.U * 30, step: g.U * 5.5, ink: ['#2c3a3e', '#334440', '#3b4e48'], gap: 0 },
      { y: g.hy + g.U * 1, h: g.U * 42, step: g.U * 8, ink: CEDAR, gap: g.u * 12 },
    ];
    ctx.fillStyle = '#1f2b2a';
    ctx.fillRect(0, g.hy - g.U * 8, g.W, g.U * 9);
    for (const row of rows) {
      for (let x = -row.step; x < g.W + row.step; x += row.step * (0.8 + rand() * 0.5)) {
        if (Math.abs(x - g.cx) < row.gap) continue;
        cedar(ctx, x, row.y, row.h * (0.8 + rand() * 0.45), row.ink);
      }
    }
    // the far grove closes behind the torii, darker than the sky
    cedar(ctx, g.cx - g.u * 3, g.hy, g.U * 36, rows[0].ink);
    cedar(ctx, g.cx + g.u * 4, g.hy, g.U * 32, rows[0].ink);
  }

  // ---- far torii, path and lanterns -----------------------------------------

  function paintTorii(ctx, g) {
    const s = g.U * 0.9;
    const x = g.cx;
    const y = g.hy + g.U * 1.5;
    ctx.fillStyle = '#9c3a2a';
    ctx.fillRect(x - s * 5, y - s * 11, s * 1.1, s * 11);
    ctx.fillRect(x + s * 3.9, y - s * 11, s * 1.1, s * 11);
    ctx.fillRect(x - s * 5.8, y - s * 11.6, s * 11.6, s * 0.9);
    ctx.fillRect(x - s * 4, y - s * 8.6, s * 8, s * 0.7);
    ctx.fillStyle = '#2a2220';
    ctx.fillRect(x - s * 6.2, y - s * 12.5, s * 12.4, s * 0.9);
  }

  function pathEdge(g, y, side) {
    const f = (y - g.hy) / (g.H - g.hy);
    return g.cx + side * (g.u * 7 + f * g.u * 24);
  }

  function paintPath(ctx, g, rand) {
    const grass = ctx.createLinearGradient(0, g.hy, 0, g.H);
    grass.addColorStop(0, '#2a3a2e');
    grass.addColorStop(1, '#1d2a22');
    ctx.fillStyle = grass;
    ctx.fillRect(0, g.hy, g.W, g.H - g.hy);
    ctx.fillStyle = '#4a5a40';
    for (let i = 0; i < g.W * 0.5; i++) {
      const y = g.hy + rand() * (g.H - g.hy);
      blob(ctx, rand() * g.W, y, g.U * (0.4 + rand() * 0.8), g.U * 0.3);
    }
    ctx.fillStyle = '#5d605b';
    poly(ctx, [pathEdge(g, g.hy, -1), g.hy, pathEdge(g, g.hy, 1), g.hy, pathEdge(g, g.H, 1), g.H, pathEdge(g, g.H, -1), g.H]);
    // paving slabs in rows that grow towards the viewer
    for (let y = g.hy + 1, k = 0; y < g.H; k++) {
      const f = (y - g.hy) / (g.H - g.hy);
      const hgt = Math.max(1, g.u * (0.5 + f * 5));
      const l = pathEdge(g, y, -1);
      const r = pathEdge(g, y, 1);
      ctx.fillStyle = k % 2 ? '#6b6d66' : '#777870';
      ctx.fillRect(l, y, r - l, hgt * 0.85);
      ctx.fillStyle = '#3f433f';
      ctx.fillRect(l, y + hgt * 0.85, r - l, Math.max(0.5, hgt * 0.15));
      const cuts = 3 + Math.floor(f * 3);
      for (let c = 1; c < cuts; c++) {
        ctx.fillRect(lerp(l, r, (c + (k % 2) * 0.5) / cuts), y, Math.max(0.5, hgt * 0.1), hgt * 0.85);
      }
      y += hgt;
    }
    // a wet sheen on the stones
    const sheen = ctx.createLinearGradient(0, g.hy, 0, g.H);
    sheen.addColorStop(0, 'rgba(150,160,178,0.12)');
    sheen.addColorStop(1, 'rgba(120,135,160,0.05)');
    ctx.fillStyle = sheen;
    poly(ctx, [pathEdge(g, g.hy, -1), g.hy, pathEdge(g, g.hy, 1), g.hy, pathEdge(g, g.H, 1), g.H, pathEdge(g, g.H, -1), g.H]);
  }

  // Stone lantern: base, post, firebox with a lit window, roof with a jewel on top.
  function lantern(ctx, x, base, s, lit) {
    ctx.fillStyle = STONE.dark;
    ctx.fillRect(x - s * 1.6, base - s * 1, s * 3.2, s * 1);
    ctx.fillStyle = STONE.mid;
    ctx.fillRect(x - s * 0.55, base - s * 5, s * 1.1, s * 4);
    ctx.fillRect(x - s * 1.5, base - s * 5.6, s * 3, s * 0.7);
    ctx.fillStyle = STONE.dark;
    ctx.fillRect(x - s * 1.3, base - s * 8.2, s * 2.6, s * 2.6);
    ctx.fillStyle = lit;
    ctx.fillRect(x - s * 0.7, base - s * 7.6, s * 1.4, s * 1.5);
    ctx.fillStyle = STONE.mid;
    poly(ctx, [x - s * 2.6, base - s * 8.2, x - s * 0.8, base - s * 9.9, x + s * 0.8, base - s * 9.9, x + s * 2.6, base - s * 8.2]);
    ctx.fillStyle = STONE.edge;
    blob(ctx, x, base - s * 10.3, s * 0.5, s * 0.5);
    ctx.fillStyle = STONE.moss;
    blob(ctx, x - s * 1.2, base - s * 8.3, s * 1.1, s * 0.3);
    blob(ctx, x, base - s * 1, s * 1.6, s * 0.35);
  }

  // ---- the guardians --------------------------------------------------------

  // A local frame where +x points forward (towards the path) and y=0 is the plinth top.
  function local(ctx, x, top, s, dir) {
    ctx.save();
    ctx.translate(x, top);
    ctx.scale(s * dir, s);
  }

  function curls(ctx, pts) {
    for (let i = 0; i < pts.length; i += 3) blob(ctx, pts[i], pts[i + 1], pts[i + 2], pts[i + 2]);
  }

  // One komainu seated side-on on its plinth, facing the path. dir=+1 faces right.
  // open: mouth open (a) or shut (un).
  function guardian(ctx, x, base, s, dir, open, rand) {
    // plinth in two steps
    ctx.fillStyle = STONE.dark;
    ctx.fillRect(x - s * 6, base - s * 1.6, s * 12, s * 1.6);
    ctx.fillStyle = STONE.mid;
    ctx.fillRect(x - s * 5.2, base - s * 5.2, s * 10.4, s * 3.6);
    ctx.fillStyle = STONE.edge;
    ctx.fillRect(x - s * 5.5, base - s * 5.6, s * 11, s * 0.5);
    const top = base - s * 5.6;
    local(ctx, x, top, s, dir);
    // tail: a rising flame of curls behind the haunch
    ctx.fillStyle = STONE.mane;
    curls(ctx, [-4.6, -5.2, 1.2, -5.4, -6.9, 1.3, -5.6, -8.7, 1.2, -4.9, -10.2, 1.0, -3.9, -11, 0.75]);
    // haunch, back and chest as one crouched mass
    ctx.fillStyle = STONE.body;
    poly(ctx, [-5.4, 0, -5.6, -3, -4.6, -5.4, -2.6, -6.6, 0, -7.6, 1.8, -9.6, 3.6, -9.4, 3.8, -6.4, 3.3, -3.2, 3.2, 0]);
    blob(ctx, -3, -2.8, 2.9, 2.9);
    // far foreleg in shadow, near foreleg straight down to the paw
    ctx.fillStyle = STONE.dark;
    ctx.fillRect(0.6, -5.4, 1.3, 5.4);
    ctx.fillStyle = STONE.body;
    ctx.fillRect(1.9, -6, 1.5, 6);
    ctx.fillStyle = STONE.edge;
    ctx.fillRect(3.0, -6, 0.4, 6);
    blob(ctx, 3.0, -0.45, 1.3, 0.5);
    blob(ctx, -1.6, -0.5, 1.8, 0.55);
    // haunch line and rib shading
    ctx.fillStyle = STONE.dark;
    ctx.fillRect(-3.4, -5.3, 2.6, 0.35);
    blob(ctx, -0.6, -1.6, 0.5, 1.6);
    // curly mane falling behind the head and down the chest
    ctx.fillStyle = STONE.mane;
    curls(ctx, [0.2, -9.6, 1.4, -0.4, -11.3, 1.3, 0.3, -12.9, 1.2, 1.5, -13.8, 1.0, 1.2, -8.2, 1.1,
      2.6, -8.0, 0.9, 3.6, -7.6, 0.75, 3.7, -6.6, 0.6, -1.0, -8.6, 1.0]);
    ctx.fillStyle = STONE.dark;
    curls(ctx, [0.0, -10.3, 0.55, 0.6, -12.2, 0.5, 1.6, -8.6, 0.45, 3.0, -7.4, 0.4, -0.5, -8.4, 0.45]);
    // head: skull, brow, square muzzle and a curled ear
    ctx.fillStyle = STONE.body;
    blob(ctx, 2.8, -11.5, 2.0, 1.9);
    ctx.fillRect(3.4, -12.4, 2.6, 2.0);
    ctx.fillStyle = STONE.edge;
    ctx.fillRect(2.2, -13.3, 3.0, 0.45);
    ctx.fillRect(5.6, -12.4, 0.4, 1.0);
    ctx.fillStyle = STONE.mane;
    blob(ctx, 1.6, -13.0, 0.7, 0.55);
    ctx.fillStyle = STONE.ink;
    blob(ctx, 3.6, -12.3, 0.42, 0.36);
    blob(ctx, 6.0, -12.1, 0.42, 0.38);
    if (open) {
      poly(ctx, [3.8, -10.4, 6.1, -10.6, 6.1, -9.2, 4.4, -9.6]);
      ctx.fillStyle = STONE.edge;
      ctx.fillRect(5.2, -10.6, 0.5, 0.35);
      ctx.fillStyle = STONE.body;
      ctx.fillRect(3.9, -9.4, 2.2, 0.6);
    } else {
      ctx.fillRect(4.0, -10.5, 2.0, 0.28);
    }
    ctx.fillStyle = STONE.dark;
    ctx.fillRect(3.2, -9.9, 2.6, 0.3);
    // moss on the back, head and plinth step
    ctx.fillStyle = STONE.moss;
    blob(ctx, -2.6, -6.2, 1.8, 0.4);
    blob(ctx, -4.4, -4.8, 0.8, 0.5);
    blob(ctx, 2.6, -13.4, 1.0, 0.3);
    ctx.fillStyle = STONE.mossLight;
    blob(ctx, -2.0, -6.5, 1.0, 0.25);
    ctx.restore();
    ctx.fillStyle = STONE.moss;
    for (let i = 0; i < 6; i++) {
      blob(ctx, x + (rand() - 0.5) * s * 9, base - s * (1.8 + rand() * 3.2), s * (0.3 + rand() * 0.5), s * 0.22);
    }
    blob(ctx, x - s * 3, top, s * 1.8, s * 0.4);
    blob(ctx, x + s * 3.6, base - s * 1.6, s * 1.6, s * 0.35);
  }

  function lightPool(ctx, x, y, r, a) {
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(224,185,90,' + a + ')');
    grd.addColorStop(1, 'rgba(224,185,90,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function paintWorld(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintCedars(ctx, g, rand);
    paintTorii(ctx, g);
    paintPath(ctx, g, rand);
    const s = g.u * 2.7;
    const ls = g.u * 1.3;
    const lx = g.u * 17;
    const ly = g.hy + g.U * 9;
    lantern(ctx, g.cx - lx, ly, ls, GOLD);
    lantern(ctx, g.cx + lx, ly, ls, GOLD);
    const gx = g.u * 42;
    const gy = g.H - g.U * 4;
    guardian(ctx, g.cx - gx, gy, s, 1, true, rand);
    guardian(ctx, g.cx + gx, gy, s, -1, false, rand);
    return { canvas: c, lanterns: [[g.cx - lx, ly - ls * 7], [g.cx + lx, ly - ls * 7]] };
  }

  function paintGlow(g) {
    const r = Math.ceil(g.U * 10);
    const c = layer(r * 2, r * 2);
    const ctx = c.getContext('2d');
    lightPool(ctx, r, r, r, 0.5);
    return c;
  }

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.1);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 16), y / (g.U * 5), 4, 91);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = smoothstep(0.35, 0.75, v) * band * band;
        const i = (y * w + x) * 4;
        img.data[i] = 120;
        img.data[i + 1] = 132;
        img.data[i + 2] = 148;
        img.data[i + 3] = a * 60;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- rain and rings -------------------------------------------------------

  function makeRain(g, rand) {
    const f = () => new Float32Array(DROPS);
    const R = { x: f(), y: f(), v: f(), len: f() };
    for (let i = 0; i < DROPS; i++) {
      R.x[i] = rand() * (g.W + g.H * 0.2);
      R.y[i] = rand() * g.H;
      R.v[i] = g.U * (38 + rand() * 24);
      R.len[i] = g.U * (1.6 + rand() * 2.4);
    }
    const ring = () => new Float32Array(RINGS);
    const S = { x: ring(), y: ring(), age: ring(), life: ring() };
    for (let i = 0; i < RINGS; i++) resetRing(g, S, i, rand, true);
    return { R, S };
  }

  function resetRing(g, S, i, rand, scatter) {
    const f = 0.15 + rand() * 0.85;
    S.y[i] = g.hy + g.U * 6 + f * (g.H - g.hy - g.U * 8);
    S.x[i] = g.cx + (rand() - 0.5) * g.u * (8 + f * 70);
    S.life[i] = 1.4 + rand() * 1.2;
    S.age[i] = scatter ? rand() * S.life[i] : 0;
  }

  function drawRain(ctx, g, t, dt, count) {
    const { R } = state.rain;
    const slant = 0.18;
    ctx.strokeStyle = 'rgba(205,214,226,0.5)';
    ctx.lineWidth = Math.max(1, g.U * 0.18);
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      R.y[i] += R.v[i] * dt;
      R.x[i] -= R.v[i] * slant * dt;
      if (R.y[i] > g.H) {
        R.y[i] -= g.H + R.len[i];
        R.x[i] = state.rand() * (g.W + g.H * 0.2);
      }
      if (R.x[i] < -g.U) R.x[i] += g.W + g.H * 0.2;
      ctx.moveTo(R.x[i], R.y[i]);
      ctx.lineTo(R.x[i] - R.len[i] * slant, R.y[i] - R.len[i]);
    }
    ctx.stroke();
  }

  function drawRings(ctx, g, dt, amount) {
    const S = state.rain.S;
    ctx.lineWidth = Math.max(1, g.U * 0.22);
    for (let i = 0; i < RINGS; i++) {
      S.age[i] += dt;
      if (S.age[i] >= S.life[i]) resetRing(g, S, i, state.rand, false);
      if (amount <= 0) continue;
      const f = S.age[i] / S.life[i];
      const r = g.U * (0.5 + f * 4.5) * (0.5 + (S.y[i] - g.hy) / (g.H - g.hy));
      ctx.strokeStyle = 'rgba(200,210,224,' + (0.5 * (1 - f) * Math.min(1, amount)).toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(S.x[i], S.y[i], r, r * 0.3, 0, 0, TAU);
      ctx.stroke();
    }
  }

  function drawMist(ctx, g, t, mist) {
    if (mist <= 0) return;
    const m = state.mist;
    const w = m.width;
    const a = (t * g.U * 0.9) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.5);
    ctx.drawImage(m, -a, g.hy - g.H * 0.16);
    ctx.drawImage(m, w - a, g.hy - g.H * 0.16);
    const b = (t * g.U * 0.5 + w * 0.4) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.35);
    ctx.drawImage(m, b - w, g.hy + g.H * 0.03);
    ctx.drawImage(m, b, g.hy + g.H * 0.03);
    ctx.globalAlpha = 1;
  }

  function drawGlow(ctx, g, t, glow) {
    if (glow <= 0) return;
    const gl = state.glow;
    const r = gl.width / 2;
    const L = state.world.lanterns;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < L.length; i++) {
      const wave = 0.85 + 0.1 * Math.sin(t * 1.3 + i * 2.1) + 0.05 * Math.sin(t * 3.1 + i);
      ctx.globalAlpha = Math.min(1, glow * 0.8 * wave);
      ctx.drawImage(gl, L[i][0] - r, L[i][1] - r);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---- run ------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.world = paintWorld(g, rand);
    state.glow = paintGlow(g);
    state.mist = paintMist(g);
    state.rain = makeRain(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { rain, mist, glow } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.world.canvas, 0, 0);
    drawMist(ctx, g, t, mist);
    drawGlow(ctx, g, t, glow);
    drawRings(ctx, g, step, rain);
    drawRain(ctx, g, t, step, Math.min(DROPS, Math.round(DROPS * 0.5 * rain)));
  }

  Kasuri.run({
    defaults: { rain: 1, mist: 1, glow: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
