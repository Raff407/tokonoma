/*
 * 石林 Shilin — the Stone Forest of Yunnan.
 *
 * Sky, far and middle ranks of limestone blades, a small pavilion and the near
 * blades with their grass are baked once. Only haze strips, a breathing set of
 * light shafts, a few drifting motes and two birds move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, noise2, hash2, lerp, mixColor, toHex, parseColor } = K;

  const TAU = Math.PI * 2;
  const MOTES = 26;
  const SKY = ['#c9d0c8', '#dcddd0', '#eadfc6'];
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
    return { W, H, U, ground: Math.round(H * 0.86) };
  }

  function mix(a, b, t) {
    return toHex(mixColor(parseColor(a), parseColor(b), t));
  }

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.H);
    const d = img.data;
    const inks = SKY.map(parseColor);
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / (g.H * 0.75)) * (inks.length - 1);
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
    ctx.fillStyle = '#f0e6cc';
    ctx.beginPath();
    ctx.ellipse(g.W * 0.7, g.H * 0.17, g.U * 6, g.U * 6, 0, 0, TAU);
    ctx.fill();
  }

  // One limestone blade, drawn a row at a time: lit left face, shaded right face,
  // strata ledges, vertical fissures and a little moss on the ledges.
  function blade(ctx, g, o) {
    const { cx, base, top, w, seed, tones, lean, moss } = o;
    const span = base - top;
    const fis = [0.28 + hash2(seed, 1) * 0.12, 0.62 + hash2(seed, 2) * 0.15];
    for (let y = Math.max(0, Math.floor(top)); y <= base; y++) {
      const t = (y - top) / span;
      const cap = 0.12 + 0.88 * Math.pow(Math.min(1, (y - top) / (g.U * 12)), 0.7);
      const body = 0.55 + 0.45 * t;
      const hw = w * body * cap;
      const sway = lean * (1 - t) * g.U * 3 + (noise2(y / (g.U * 3), seed, seed) - 0.5) * g.U * 0.9;
      const xl = cx + sway - hw + (noise2(y / (g.U * 1.4), seed + 7, 3) - 0.5) * g.U * 0.8;
      const xr = cx + sway + hw + (noise2(y / (g.U * 1.6), seed + 9, 5) - 0.5) * g.U * 0.8;
      const wd = xr - xl;
      if (wd < 0.5) continue;
      const ledge = noise2(y / (g.U * 0.9), seed, 11) > 0.72;
      const litEdge = xl + wd * 0.42;
      const darkEdge = xl + wd * 0.74;
      ctx.fillStyle = ledge ? tones[3] : tones[1];
      ctx.fillRect(xl, y, wd, 1);
      ctx.fillStyle = ledge ? tones[1] : tones[0];
      ctx.fillRect(xl, y, litEdge - xl, 1);
      ctx.fillStyle = ledge ? tones[3] : tones[2];
      ctx.fillRect(darkEdge, y, xr - darkEdge, 1);
      for (let k = 0; k < 2; k++) {
        const fx = xl + wd * fis[k];
        if (noise2(y / (g.U * 5), seed + k * 5, 17) > 0.34) {
          ctx.fillStyle = tones[3];
          ctx.fillRect(fx, y, Math.max(1, g.U * 0.18), 1);
        }
      }
      if (moss && ledge && t > 0.2) {
        ctx.fillStyle = moss;
        ctx.fillRect(xl + wd * 0.1, y, wd * 0.5, 1);
      }
    }
  }

  function tonesFor(base, shade) {
    return [mix(base, '#e6dfcc', 0.2 - shade * 0.1), base, mix(base, '#2c3438', 0.4), mix(base, '#2c3438', 0.25 + shade * 0.1)];
  }

  function ranks(ctx, g, rand, spec) {
    for (let i = 0; i < spec.n; i++) {
      const x = (i + 0.15 + rand() * 0.7) * (g.W / spec.n);
      const h = g.H * (spec.h0 + rand() * spec.h1);
      blade(ctx, g, {
        cx: x,
        base: spec.base,
        top: spec.base - h,
        w: g.U * (spec.w0 + rand() * spec.w1),
        seed: Math.floor(rand() * 900) + 3,
        tones: spec.tones,
        lean: (rand() - 0.5) * 1.2,
        moss: spec.moss,
      });
    }
  }

  function paintFar(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    ranks(ctx, g, rand, { n: 11, base: g.H * 0.62, h0: 0.22, h1: 0.2, w0: 1.8, w1: 1.8, tones: tonesFor('#aab3b2', 0), moss: null });
    ctx.fillStyle = 'rgba(224,222,206,0.5)';
    ctx.fillRect(0, g.H * 0.5, g.W, g.H * 0.2);
    return c;
  }

  function pavilion(ctx, g, x, y) {
    const u = g.U;
    ctx.fillStyle = '#4a3d36';
    ctx.fillRect(x - u * 3.2, y - u * 0.6, u * 6.4, u * 0.6);
    ctx.fillStyle = '#b8472f';
    for (let i = -1; i <= 1; i += 2) ctx.fillRect(x + i * u * 2.2 - u * 0.25, y - u * 3, u * 0.5, u * 2.4);
    ctx.fillStyle = '#6a3a2c';
    ctx.fillRect(x - u * 2.4, y - u * 3.2, u * 4.8, u * 0.4);
    ctx.fillStyle = '#34302e';
    ctx.beginPath();
    ctx.moveTo(x - u * 4.2, y - u * 4.6);
    ctx.quadraticCurveTo(x - u * 2.2, y - u * 3.2, x, y - u * 3.2);
    ctx.quadraticCurveTo(x + u * 2.2, y - u * 3.2, x + u * 4.2, y - u * 4.6);
    ctx.quadraticCurveTo(x + u * 2.2, y - u * 4.4, x, y - u * 5.6);
    ctx.quadraticCurveTo(x - u * 2.2, y - u * 4.4, x - u * 4.2, y - u * 4.6);
    ctx.fill();
  }

  function paintMid(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const base = g.H * 0.78;
    ranks(ctx, g, rand, { n: 7, base, h0: 0.34, h1: 0.2, w0: 2.4, w1: 2, tones: tonesFor('#848d8c', 0.1), moss: '#7a8560' });
    // flat-topped rock carrying the pavilion
    const px = g.W * 0.27;
    blade(ctx, g, { cx: px, base, top: g.H * 0.4, w: g.U * 4, seed: 91, tones: tonesFor('#848d8c', 0.1), lean: 0, moss: '#7a8560' });
    ctx.fillStyle = '#8a9288';
    ctx.fillRect(px - g.U * 4.4, g.H * 0.4, g.U * 8.8, g.U * 0.7);
    pavilion(ctx, g, px, g.H * 0.4);
    return c;
  }

  function grassRow(ctx, g, rand, y, tall, tones) {
    for (let x = 0; x < g.W; x += 1) {
      if (rand() < 0.5) continue;
      const h = 1 + rand() * tall;
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      ctx.fillRect(x, y - h, 1, h + 1);
    }
  }

  function paintMidGround(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const y0 = g.H * 0.76;
    ctx.fillStyle = '#7c8860';
    ctx.fillRect(0, y0, g.W, g.H - y0);
    for (let i = 0; i < 3; i++) grassRow(ctx, g, rand, y0 + i * g.U * 0.8, g.U * 1.6, ['#8c9868', '#6f7c54', '#98a470']);
    return c;
  }

  function paintNear(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const base = g.H * 0.93;
    const big = [[0.04, 0.15, 0.72, 5.5], [0.2, -0.3, 0.42, 3.6], [0.82, 0.2, 0.76, 6], [0.96, -0.1, 0.5, 4]];
    for (let i = 0; i < big.length; i++) {
      blade(ctx, g, {
        cx: g.W * big[i][0],
        base,
        top: g.H * (1 - big[i][2]) - g.H * 0.06,
        w: g.U * big[i][3],
        seed: 130 + i * 17,
        tones: tonesFor('#7a8382', 0.2),
        lean: big[i][1],
        moss: '#5a6a43',
      });
    }
    blade(ctx, g, { cx: g.W * 0.58, base, top: g.H * 0.58, w: g.U * 2.6, seed: 211, tones: tonesFor('#838c8a', 0.15), lean: 0.3, moss: '#5a6a43' });
    ctx.fillStyle = '#586a40';
    ctx.fillRect(0, g.H * 0.9, g.W, g.H * 0.1);
    for (let i = 0; i < 4; i++) grassRow(ctx, g, rand, g.H * 0.9 + i * g.U * 1.2, g.U * 2.4 + i, ['#6c7e4a', '#4a5c36', '#869a5a', '#3f4f30']);
    return c;
  }

  // Pale shafts slanting down to the right; one layer, drawn with a breathing alpha.
  function paintShafts(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 6; i++) {
      const x = g.W * (0.1 + i * 0.15 + rand() * 0.06);
      const w = g.U * (3 + rand() * 6);
      const slant = g.H * 0.35;
      const grad = ctx.createLinearGradient(x, 0, x + slant, g.H * 0.9);
      grad.addColorStop(0, 'rgba(240,222,150,0.8)');
      grad.addColorStop(1, 'rgba(238,220,160,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + w, 0);
      ctx.lineTo(x + w + slant, g.H * 0.9);
      ctx.lineTo(x + slant - w * 0.4, g.H * 0.9);
      ctx.closePath();
      ctx.fill();
    }
    return c;
  }

  function paintHaze(g, rand, seed) {
    const h = Math.round(g.H * 0.26);
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(232,230,214,0.5)';
    for (let i = 0; i < 16; i++) {
      const x = rand() * g.W;
      const y = h * (0.25 + rand() * 0.5);
      const rx = g.U * (10 + rand() * 18);
      const ry = g.U * (1.4 + rand() * 2.2);
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.ellipse(x + k * g.W, y, rx, ry, 0, 0, TAU);
        ctx.fill();
      }
    }
    return c;
  }

  function makeMotes(g, rand) {
    const m = { x: new Float32Array(MOTES), y: new Float32Array(MOTES), v: new Float32Array(MOTES), p: new Float32Array(MOTES) };
    for (let i = 0; i < MOTES; i++) {
      m.x[i] = rand() * g.W;
      m.y[i] = g.H * (0.2 + rand() * 0.6);
      m.v[i] = g.U * (0.25 + rand() * 0.4);
      m.p[i] = rand() * TAU;
    }
    return m;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.far = paintFar(g, rand);
    state.mid = paintMid(g, rand);
    state.midGround = paintMidGround(g, rand);
    state.near = paintNear(g, rand);
    state.shafts = paintShafts(g, rand);
    state.hazeA = paintHaze(g, rand, 1);
    state.hazeB = paintHaze(g, rand, 2);
    state.motes = makeMotes(g, rand);
  }

  function strip(ctx, g, img, off, y, alpha) {
    const o = ((off % g.W) + g.W) % g.W;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, o, y);
    ctx.drawImage(img, o - g.W, y);
    ctx.globalAlpha = 1;
  }

  function drawMotes(ctx, g, t, dt, amount) {
    const m = state.motes;
    ctx.fillStyle = '#f2e6bc';
    ctx.globalAlpha = 0.55 * Math.min(1, amount);
    const s = Math.max(1, g.U * 0.28);
    for (let i = 0; i < MOTES; i++) {
      m.x[i] += m.v[i] * dt;
      if (m.x[i] > g.W + 2) m.x[i] = -2;
      const y = m.y[i] + Math.sin(t * 0.5 + m.p[i]) * g.U * 1.2;
      ctx.fillRect(m.x[i], y, s, s);
    }
    ctx.globalAlpha = 1;
  }

  function drawBirds(ctx, g, t) {
    ctx.fillStyle = '#4b4a46';
    for (let i = 0; i < 2; i++) {
      const x = ((t * g.U * (1.6 + i * 0.4) + i * g.W * 0.45) % (g.W + 20)) - 10;
      const y = g.H * (0.2 + i * 0.07) + Math.sin(t * 0.4 + i) * g.U * 1.5;
      const flap = Math.sin(t * 3 + i * 2) * g.U * 0.5;
      ctx.fillRect(x - g.U * 0.9, y + flap, g.U * 0.9, 1);
      ctx.fillRect(x, y - flap, g.U * 0.9, 1);
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { haze, light, birds } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.far, 0, 0);
    strip(ctx, g, state.hazeA, t * g.U * 2.2, g.H * 0.4, 0.6 * haze);
    ctx.drawImage(state.mid, 0, 0);
    ctx.drawImage(state.midGround, 0, 0);
    strip(ctx, g, state.hazeB, -t * g.U * 3, g.H * 0.6, 0.55 * haze);
    ctx.globalAlpha = Math.min(1, light * (0.7 + 0.3 * Math.sin(t * 0.35)));
    ctx.drawImage(state.shafts, Math.sin(t * 0.12) * g.U * 2, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.near, 0, 0);
    drawMotes(ctx, g, t, step, light);
    if (birds) drawBirds(ctx, g, t);
  }

  Kasuri.run({
    defaults: { haze: 1, light: 1, birds: true, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
