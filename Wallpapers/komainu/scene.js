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
  const SKY = ['#141a2a', '#1f2a40', '#34405a', '#56607a', '#7d8294'];
  const STONE = { dark: '#4d514f', mid: '#6f726b', light: '#928f82', moss: '#4f6340', mossLight: '#6c7d4c' };
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
      { y: g.hy - g.U * 1, h: g.U * 30, step: g.U * 5.5, ink: ['#46585a', '#506862', '#5c7568'] },
      { y: g.hy + g.U * 1, h: g.U * 42, step: g.U * 8, ink: CEDAR },
    ];
    for (const row of rows) {
      for (let x = -row.step; x < g.W + row.step; x += row.step * (0.8 + rand() * 0.5)) {
        if (Math.abs(x - g.cx) < g.u * 9) continue;
        cedar(ctx, x, row.y, row.h * (0.8 + rand() * 0.45), row.ink);
      }
    }
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
    return g.cx + side * (g.u * 3 + f * g.u * 46);
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
    sheen.addColorStop(0, 'rgba(180,190,205,0.22)');
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
    ctx.fillStyle = STONE.light;
    blob(ctx, x, base - s * 10.3, s * 0.5, s * 0.5);
    ctx.fillStyle = STONE.moss;
    blob(ctx, x - s * 1.2, base - s * 8.3, s * 1.1, s * 0.3);
    blob(ctx, x, base - s * 1, s * 1.6, s * 0.35);
  }

  // ---- the guardians --------------------------------------------------------

  // One komainu seated on its plinth, facing the path. dir=-1 left one, +1 right one.
  // open: mouth open (a) or shut (un).
  function guardian(ctx, x, base, s, dir, open, rand) {
    const px = (v) => x + v * s * dir * -1;
    // plinth
    ctx.fillStyle = STONE.dark;
    ctx.fillRect(x - s * 5.4, base - s * 2.4, s * 10.8, s * 2.4);
    ctx.fillStyle = STONE.mid;
    ctx.fillRect(x - s * 4.6, base - s * 7.4, s * 9.2, s * 5);
    ctx.fillStyle = STONE.light;
    ctx.fillRect(x - s * 4.9, base - s * 7.9, s * 9.8, s * 0.7);
    const top = base - s * 7.9;
    // haunch and body
    ctx.fillStyle = STONE.mid;
    blob(ctx, px(-1.5), top - s * 4.2, s * 4.2, s * 4.6);
    ctx.fillStyle = STONE.light;
    blob(ctx, px(-2.6), top - s * 5.4, s * 2.3, s * 3);
    // chest and forelegs
    ctx.fillStyle = STONE.mid;
    blob(ctx, px(1.6), top - s * 6.4, s * 3.2, s * 4);
    ctx.fillStyle = STONE.dark;
    ctx.fillRect(x + (dir < 0 ? 1 : -1) * s * 1.4 - s * 0.9, top - s * 4.6, s * 1.8, s * 4.6);
    ctx.fillRect(x + (dir < 0 ? 1 : -1) * s * 3.4 - s * 0.9, top - s * 4.6, s * 1.8, s * 4.6);
    ctx.fillStyle = STONE.mid;
    ctx.fillRect(x + (dir < 0 ? 1 : -1) * s * 1.4 - s * 0.55, top - s * 4.6, s * 0.7, s * 4.6);
    ctx.fillRect(x + (dir < 0 ? 1 : -1) * s * 3.4 - s * 0.55, top - s * 4.6, s * 0.7, s * 4.6);
    // head, mane curls, ears
    const hx = px(2.1);
    const hy = top - s * 10.6;
    ctx.fillStyle = STONE.dark;
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * (0.55 + i * 0.19);
      blob(ctx, hx + Math.cos(a) * s * 2.9 * dir * -1 * -1, hy + Math.sin(a) * s * 2.7, s * 1.05, s * 1.05);
    }
    ctx.fillStyle = STONE.mid;
    for (let i = 0; i < 8; i++) {
      const a = Math.PI * (0.62 + i * 0.22);
      blob(ctx, hx + Math.cos(a) * s * 2.6, hy + Math.sin(a) * s * 2.5, s * 0.8, s * 0.8);
    }
    ctx.fillStyle = STONE.light;
    blob(ctx, hx, hy + s * 0.2, s * 2.3, s * 2.1);
    ctx.fillStyle = STONE.mid;
    poly(ctx, [hx - s * 1.9, hy - s * 1.2, hx - s * 1.3, hy - s * 3.4, hx - s * 0.6, hy - s * 1.9]);
    poly(ctx, [hx + s * 1.9, hy - s * 1.2, hx + s * 1.3, hy - s * 3.4, hx + s * 0.6, hy - s * 1.9]);
    // brow, eyes, nose, mouth
    ctx.fillStyle = STONE.dark;
    ctx.fillRect(hx - s * 1.7, hy - s * 0.9, s * 1.3, s * 0.45);
    ctx.fillRect(hx + s * 0.4, hy - s * 0.9, s * 1.3, s * 0.45);
    ctx.fillStyle = '#1b1d1e';
    blob(ctx, hx - s * 0.95, hy - s * 0.2, s * 0.38, s * 0.38);
    blob(ctx, hx + s * 0.95, hy - s * 0.2, s * 0.38, s * 0.38);
    ctx.fillStyle = STONE.dark;
    blob(ctx, hx, hy + s * 0.55, s * 0.75, s * 0.5);
    if (open) {
      ctx.fillStyle = '#16191a';
      blob(ctx, hx, hy + s * 1.35, s * 1.1, s * 0.75);
      ctx.fillStyle = STONE.light;
      ctx.fillRect(hx - s * 0.9, hy + s * 0.85, s * 1.8, s * 0.3);
    } else {
      ctx.fillStyle = '#25282a';
      ctx.fillRect(hx - s * 1.0, hy + s * 1.2, s * 2, s * 0.35);
    }
    // moss gathered on the head, back and plinth top, and a water stain below
    ctx.fillStyle = STONE.moss;
    for (let i = 0; i < 18; i++) {
      const mx = x + (rand() - 0.5) * s * 9;
      const my = top - rand() * s * 12;
      if (rand() < 0.5) blob(ctx, mx, my, s * (0.4 + rand() * 0.7), s * 0.3);
    }
    ctx.fillStyle = STONE.mossLight;
    blob(ctx, px(-2.6), top - s * 8.8, s * 1.5, s * 0.45);
    blob(ctx, hx, hy - s * 2.2, s * 1.2, s * 0.4);
    ctx.fillStyle = STONE.moss;
    blob(ctx, x - s * 3, top, s * 1.8, s * 0.5);
    blob(ctx, x + s * 3.4, base - s * 2.4, s * 1.6, s * 0.4);
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
    const s = g.u * 1.05;
    const lx = g.u * 52;
    const ly = g.hy + g.U * 24;
    lantern(ctx, g.cx - lx, ly, g.u * 1.9, GOLD);
    lantern(ctx, g.cx + lx, ly, g.u * 1.9, GOLD);
    const gx = g.u * 30;
    const gy = g.H - g.U * 5;
    guardian(ctx, g.cx - gx, gy, s * 2.4, -1, true, rand);
    guardian(ctx, g.cx + gx, gy, s * 2.4, 1, false, rand);
    // a bright lantern beside each guardian's far side, with its light on the stones
    return { canvas: c, lanterns: [[g.cx - lx, ly - g.u * 1.9 * 7], [g.cx + lx, ly - g.u * 1.9 * 7]] };
  }

  function paintGlow(g) {
    const r = Math.ceil(g.U * 14);
    const c = layer(r * 2, r * 2);
    const ctx = c.getContext('2d');
    lightPool(ctx, r, r, r, 0.5);
    return c;
  }

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.18);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 16), y / (g.U * 5), 4, 91);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.38, 0.64, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 190;
        img.data[i + 1] = 198;
        img.data[i + 2] = 208;
        img.data[i + 3] = a * 70;
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
    ctx.strokeStyle = 'rgba(205,214,226,0.4)';
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
    ctx.globalAlpha = Math.min(1, mist * 0.8);
    ctx.drawImage(m, -a, g.hy - g.H * 0.1);
    ctx.drawImage(m, w - a, g.hy - g.H * 0.1);
    const b = (t * g.U * 0.5 + w * 0.4) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.4);
    ctx.drawImage(m, b - w, g.hy + g.H * 0.08);
    ctx.drawImage(m, b, g.hy + g.H * 0.08);
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
