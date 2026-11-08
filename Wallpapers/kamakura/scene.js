/*
 * 雪洞 Kamakura — snow huts lit from inside on a blue winter evening.
 *
 * Sky, mountain, the rows of huts and the big near hut are baked once, in a
 * handful of flat tones. Per frame there is a sliding cloud tile, a short list
 * of glow sprites, the children by their brazier, and a few hundred flakes.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const FOOT = 0.53;
  const MAX_FLAKES = 520;
  const SPARKS = 10;
  const TWINKLES = 28;
  const ROWS = [
    { y: 0.565, r: 1.9 },
    { y: 0.6, r: 2.6 },
    { y: 0.655, r: 3.6 },
    { y: 0.735, r: 5.0 },
  ];
  const SKY = ['#26315c', '#2d3a68', '#364475', '#425183', '#536394', '#6878a6'];
  const FIELD = ['#7c8ab3', '#8e9bc2', '#a1add0', '#b5c0dd', '#c9d2e8', '#dce3f1'];
  const DOME = ['#7785b0', '#8592bb', '#a0acd0', '#bac5e1', '#d2daed', '#e7ecf6'];
  const WARM = ['#73361f', '#9a4a29', '#c26a33', '#df8f46', '#efb563', '#f7d18a'];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function ramp(hexes) {
    return hexes.map((h) => K.parseColor(h));
  }

  // Flat bands of a ramp, with a narrow dithered seam between neighbours.
  function pick(tones, v, x, y) {
    const f = Math.min(0.999, Math.max(0, v)) * (tones.length - 1);
    const i = Math.floor(f);
    const up = smoothstep(0.3, 0.7, f - i) > K.bayer4(x, y) ? 1 : 0;
    return tones[Math.min(tones.length - 1, i + up)];
  }

  // Calls fn(x, y) for each pixel; fn returns an [r, g, b] or null to skip.
  function bake(w, h, fn) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const d = img.data;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const rgb = fn(x, y);
        if (!rgb) continue;
        const i = (y * c.width + x) * 4;
        d[i] = rgb[0];
        d[i + 1] = rgb[1];
        d[i + 2] = rgb[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function glowSprite(rgb, alpha) {
    const c = layer(64, 64);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${rgb},${alpha})`);
    grad.addColorStop(0.45, `rgba(${rgb},${alpha * 0.35})`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return c;
  }

  function arch(ctx, cx, base, hw, h) {
    ctx.beginPath();
    ctx.moveTo(cx - hw, base);
    ctx.lineTo(cx - hw, base - h + hw);
    ctx.arc(cx, base - h + hw, hw, Math.PI, 0);
    ctx.lineTo(cx + hw, base);
    ctx.closePath();
  }

  function insideArch(x, y, cx, base, hw, h) {
    if (y > base) return false;
    const top = base - h + hw;
    if (y >= top) return Math.abs(x - cx) <= hw;
    return Math.hypot(x - cx, y - top) <= hw;
  }

  /* ---------- sky ---------- */

  function paintSky(g, rand) {
    const tones = ramp(SKY);
    const foot = g.H * FOOT;
    const c = bake(g.W, foot + 2, (x, y) => pick(tones, Math.pow(y / foot, 1.25), x, y));
    const ctx = c.getContext('2d');
    const stars = [];
    const count = Math.round(g.W * g.H * 0.009);
    for (let i = 0; i < count; i++) {
      const y = Math.pow(rand(), 1.6) * foot * 0.85;
      const x = rand() * g.W;
      const b = rand();
      ctx.fillStyle = b > 0.93 ? '#dde3f2' : b > 0.7 ? '#97a3ca' : '#6a79a7';
      ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
      if (b > 0.9 && stars.length < TWINKLES) stars.push({ x: Math.floor(x), y: Math.floor(y), ph: rand() * 6.28, rate: 0.3 + rand() * 0.5 });
    }
    state.stars = stars;
    return c;
  }

  function paintClouds(g, seed) {
    const tw = Math.ceil((g.W * 1.5) / 2);
    const th = Math.ceil((g.H * 0.48) / 2);
    const f = (x, y) => fbm(x * 0.05, y * 0.12, 4, seed);
    const c = layer(tw, th);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(tw, th);
    const body = K.parseColor('#4b5785');
    for (let y = 0; y < th; y++) {
      const fade = 1 - smoothstep(0.35, 1, y / th);
      for (let x = 0; x < tw; x++) {
        const v = (lerp(f(x, y), f(x - tw, y), x / tw) - 0.5) * 1.6 + 0.5;
        const a = v * fade > 0.56 ? 0.9 : v * fade > 0.49 ? 0.5 : 0;
        const i = (y * tw + x) * 4;
        img.data[i] = body[0];
        img.data[i + 1] = body[1];
        img.data[i + 2] = body[2];
        img.data[i + 3] = Math.round(a * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  /* ---------- mountain and field ---------- */

  function ridgeLine(g, seed) {
    const out = new Float32Array(g.W + 2);
    const px = g.W * 0.33;
    const sub = px + g.H * 0.46;
    for (let x = 0; x < out.length; x++) {
      const dx = (x - px) / g.H;
      const main = 0.12 + (dx < 0 ? -dx * 0.62 : dx * 0.5);
      const side = 0.27 + Math.abs((x - sub) / g.H) * 0.6;
      const jag = (fbm(x * 0.07, 3.3, 4, seed) - 0.5) * 0.07 * Math.min(1, Math.abs(dx) * 5);
      const far = 0.4 + (fbm(x * 0.02, 8.1, 3, seed) - 0.5) * 0.08;
      out[x] = (Math.min(main, side, far) + jag) * g.H;
    }
    return out;
  }

  function mountainColour(g, x, y, ridge, seed, P) {
    const below = y - ridge[x];
    const span = g.H * FOOT - ridge[x];
    const lit = ridge[Math.min(g.W, x + 4)] - ridge[Math.max(0, x - 4)] < 0;
    const alt = Math.max(0, 1 - (ridge[x] - g.H * 0.12) / (g.H * 0.3));
    const edge = fbm(x * 0.09, 4.4, 4, seed + 5) + (fbm(x * 0.4, y * 0.02, 2, seed + 7) - 0.5) * 0.5;
    const cap = g.H * (0.03 + 0.16 * alt) * (0.35 + edge);
    if (below < Math.max(g.U, cap)) return lit ? P.snowLit : P.snowShade;
    if (below > span * 0.72) return P.haze;
    return lit ? P.rockLit : P.rockShade;
  }

  function paintLand(g, seed) {
    const ridge = ridgeLine(g, seed);
    const foot = g.H * FOOT;
    const field = ramp(FIELD);
    const P = {
      snowLit: K.parseColor('#c0cae4'),
      snowShade: K.parseColor('#93a1c8'),
      rockLit: K.parseColor('#414e7e'),
      rockShade: K.parseColor('#35416f'),
      haze: K.parseColor('#5f6da2'),
    };
    return bake(g.W, g.H, (x, y) => {
      if (y < ridge[x]) return null;
      if (y < foot) return mountainColour(g, x, y, ridge, seed, P);
      const d = (y - foot) / (g.H - foot);
      const drift = (fbm(x * 0.03, y * 0.11, 3, seed + 9) - 0.5) * 0.36;
      return pick(field, 0.24 + d * 0.72 + drift, x, y);
    });
  }

  function paintTreeline(ctx, g, rand, seed) {
    const foot = g.H * FOOT;
    let x = -g.U;
    while (x < g.W + g.U) {
      const dense = fbm(x * 0.03, 1.7, 3, seed + 3);
      x += g.U * (0.7 + rand() * 0.9);
      if (dense < 0.42) continue;
      const h = g.U * (1.6 + rand() * 3.2) * (0.6 + dense);
      const w = h * 0.36;
      const base = foot + rand() * g.U * 0.8;
      ctx.fillStyle = '#323e68';
      ctx.beginPath();
      ctx.moveTo(x, base - h);
      ctx.lineTo(x + w, base);
      ctx.lineTo(x - w, base);
      ctx.fill();
      ctx.fillStyle = '#a6b2d2';
      ctx.beginPath();
      ctx.moveTo(x, base - h);
      ctx.lineTo(x - w * 0.45, base - h * 0.5);
      ctx.lineTo(x - w * 0.1, base - h * 0.55);
      ctx.fill();
    }
      }

  /* ---------- small huts ---------- */

  function paintHut(ctx, g, x, y, r) {
    const h = r * 0.95;
    ctx.fillStyle = '#7886b0';
    ctx.beginPath();
    ctx.ellipse(x + r * 0.35, y, r * 1.25, r * 0.3, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#6f7daa';
    ctx.beginPath();
    ctx.ellipse(x + r * 0.06, y, r * 1.08, h * 1.08, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#a3b0d2';
    ctx.beginPath();
    ctx.ellipse(x, y, r, h, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ccd5ea';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.18, y - h * 0.08, r * 0.78, h * 0.86, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#d8ab73';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.12, r * 0.85, r * 0.22, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#e08f45';
    arch(ctx, x, y, Math.max(0.6, r * 0.34), Math.max(1, r * 0.6));
    ctx.fill();
    ctx.fillStyle = '#f6c873';
    arch(ctx, x, y, Math.max(0.5, r * 0.2), Math.max(0.8, r * 0.42));
    ctx.fill();
  }

  function placeHuts(ctx, g, rand, hero) {
    const glows = [];
    for (const row of ROWS) {
      const r = row.r * g.U;
      const y = row.y * g.H;
      const step = r * 4.6;
      for (let x = rand() * step * 0.6; x < g.W + r; x += step * (0.85 + rand() * 0.5)) {
        if (Math.abs(x - hero.x) < hero.rx + r * 1.6) continue;
        if (row.y > 0.7 && x < g.W * 0.2) continue;
        const yy = y + (rand() - 0.5) * r * 0.5;
        paintHut(ctx, g, x, yy, r);
        glows.push({ x, y: yy - r * 0.25, s: r * 2.6, ph: rand() * 6.28 });
      }
    }
    return glows;
  }

  /* ---------- the near hut ---------- */

  function heroGeometry(g) {
    const x = g.W * 0.62;
    const y = g.H * 0.905;
    return { x, y, rx: g.U * 35, ry: g.U * 33, hw: g.U * 14, dh: g.U * 23 };
  }

  function paintDome(g, hero) {
    const tones = ramp(DOME);
    const L = [-0.42, 0.5, 0.76];
    const ox = hero.x - hero.rx;
    const oy = hero.y - hero.ry;
    return bake(hero.rx * 2, hero.ry + 1, (px, py) => {
      const nx = (px + ox - hero.x) / hero.rx;
      const ny = (hero.y - py - oy) / hero.ry;
      const r2 = nx * nx + ny * ny;
      if (r2 > 1 || ny < 0) return null;
      const nz = Math.sqrt(1 - r2);
      const lam = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      const rim = smoothstep(0.7, 1, r2) * 0.1;
      const v = 0.3 + lam * 0.72 - rim - Math.pow(1 - ny, 6) * 0.12 + (K.hash2(px, py, 4) - 0.5) * 0.08;
      return pick(tones, v, px, py);
    });
  }

  function paintInterior(g, hero) {
    const tones = ramp(WARM);
    const ox = hero.x - hero.hw;
    const oy = hero.y - hero.dh;
    const fx = hero.x;
    const fy = hero.y - g.U * 5;
    return bake(hero.hw * 2, hero.dh + 1, (px, py) => {
      const x = px + ox;
      const y = py + oy;
      if (!insideArch(x, y, hero.x, hero.y, hero.hw, hero.dh)) return null;
      const d = Math.hypot((x - fx) * 0.8, y - fy) / (g.U * 16);
      return pick(tones, 1 - d * 0.55, px, py);
    });
  }

  function paintHero(ctx, g, hero) {
    const u = g.U;
    ctx.fillStyle = '#7f8cb4';
    ctx.beginPath();
    ctx.ellipse(hero.x + u * 3, hero.y + u * 0.3, hero.rx * 1.02, u * 2.2, 0, 0, 6.3);
    ctx.fill();
    ctx.drawImage(paintDome(g, hero), hero.x - hero.rx, hero.y - hero.ry);
    ctx.fillStyle = '#d9b48d';
    arch(ctx, hero.x, hero.y, hero.hw + u * 1.6, hero.dh + u * 1.6);
    ctx.fill();
    ctx.fillStyle = '#efcf9f';
    arch(ctx, hero.x - u * 0.6, hero.y, hero.hw + u * 0.7, hero.dh + u * 0.7);
    ctx.fill();
    ctx.drawImage(paintInterior(g, hero), hero.x - hero.hw, hero.y - hero.dh);
    ctx.fillStyle = '#a8703c';
    ctx.fillRect(hero.x - hero.hw, hero.y - u * 1.6, hero.hw * 2, u * 1.6);
    paintSpill(ctx, g, hero);
  }

  function paintSpill(ctx, g, hero) {
    const u = g.U;
    const tones = [['#c4b0a4', 1], ['#d6b894', 0.72], ['#e8c99a', 0.45]];
    for (const [col, k] of tones) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(hero.x, hero.y + u * 0.5, hero.hw * (0.5 + k), u * 5.5 * k, 0, 0, Math.PI);
      ctx.fill();
    }
  }

  /* ---------- children and brazier, their own layer ---------- */

  function childBody(ctx) {
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.quadraticCurveTo(-5.6, -4.2, -3, -7.3);
    ctx.quadraticCurveTo(-1.2, -8.5, 0.7, -7.4);
    ctx.lineTo(3.7, -5.3);
    ctx.quadraticCurveTo(4.8, -4.7, 4.3, -3.8);
    ctx.lineTo(1.4, -4.3);
    ctx.quadraticCurveTo(2.4, -2.5, 3.9, -1.8);
    ctx.quadraticCurveTo(4.8, -0.6, 3.9, 0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-0.5, -9.7, 2.3, 0, 6.3);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(1.7, -9.4, 0.55, 0, 6.3);
    ctx.fill();
  }

  function paintChild(ctx, x, y, u, dir, kind) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir * u, u);
    childBody(ctx);
    ctx.beginPath();
    if (kind === 0) {
      ctx.arc(-0.7, -10.1, 2.55, Math.PI, 0);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-1, -13, 1, 0, 6.3);
    } else {
      ctx.ellipse(-1.3, -9.9, 2.4, 2.5, 0, 0, 6.3);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-2.2, -7.6);
      ctx.quadraticCurveTo(-4.6, -7.4, -5.6, -5.4);
      ctx.lineTo(-4.4, -5.2);
      ctx.quadraticCurveTo(-3.6, -6.4, -2, -6.6);
    }
    ctx.fill();
    ctx.restore();
  }

  function paintBackChild(ctx, x, y, u) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(u, u);
    ctx.beginPath();
    ctx.moveTo(-3.4, 0);
    ctx.quadraticCurveTo(-3.8, -6.4, 0, -6.8);
    ctx.quadraticCurveTo(3.8, -6.4, 3.4, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -8.7, 2.2, 0, 6.3);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -9.4, 2.5, 1.6, 0, Math.PI, 0);
    ctx.fill();
    ctx.restore();
  }

  function paintBrazier(ctx, x, y, u) {
    ctx.fillStyle = '#4e2618';
    ctx.beginPath();
    ctx.moveTo(x - u * 4.2, y - u * 4.4);
    ctx.lineTo(x + u * 4.2, y - u * 4.4);
    ctx.quadraticCurveTo(x + u * 4.6, y, x + u * 2.6, y);
    ctx.lineTo(x - u * 2.6, y);
    ctx.quadraticCurveTo(x - u * 4.6, y, x - u * 4.2, y - u * 4.4);
    ctx.fill();
    ctx.fillStyle = '#7b4128';
    ctx.fillRect(x - u * 4.5, y - u * 5, u * 9, Math.max(1, u * 0.8));
    ctx.fillStyle = '#e88a3c';
    ctx.beginPath();
    ctx.ellipse(x, y - u * 5, u * 3.4, u * 1, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ffd88a';
    ctx.fillRect(x - u * 1.4, y - u * 5.7, u * 1.1, u * 0.7);
    ctx.fillRect(x + u * 0.6, y - u * 5.5, u * 1.2, u * 0.5);
  }

  function paintFamily(g, hero) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const floor = hero.y - u * 0.9;
    ctx.fillStyle = '#4b2a1d';
    paintBackChild(ctx, hero.x + u * 3, floor - u * 4.2, u * 0.72);
    ctx.fillStyle = '#331c15';
    paintChild(ctx, hero.x - u * 8.4, floor, u * 0.98, 1, 0);
    paintChild(ctx, hero.x + u * 8.6, floor, u * 0.92, -1, 1);
    paintBrazier(ctx, hero.x, floor + u * 0.2, u * 0.85);
    return c;
  }

  /* ---------- foreground ---------- */

  function paintFootprints(ctx, g, hero) {
    const u = g.U;
    const sx = g.W * 0.3;
    const sy = g.H + u;
    ctx.fillStyle = '#8290ba';
    for (let i = 0; i < 10; i++) {
      const f = i / 9;
      const x = lerp(sx, hero.x - hero.hw * 0.6, f);
      const y = lerp(sy, hero.y + u * 2.5, Math.pow(f, 0.7));
      const size = lerp(2.8, 1.4, f) * u;
      const side = i % 2 ? 1 : -1;
      ctx.beginPath();
      ctx.ellipse(x + side * size * 0.8, y, size * 0.55, size * 0.3, 0, 0, 6.3);
      ctx.fill();
    }
  }

  function paintCandles(ctx, g, hero) {
    const u = g.U;
    const spots = [[hero.x - hero.hw - u * 6, hero.y + u * 3], [hero.x + hero.hw + u * 7, hero.y + u * 2.4]];
    const list = [];
    for (const [x, y] of spots) {
      ctx.fillStyle = '#dcb488';
      ctx.beginPath();
      ctx.ellipse(x, y + u * 0.3, u * 3.4, u * 1, 0, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = '#ede4cc';
      ctx.fillRect(x - u * 0.45, y - u * 2.6, u * 0.9, u * 2.6);
      list.push({ x, y: y - u * 3.2 });
    }
    return list;
  }

  function paintDrifts(ctx, g, hero) {
    const u = g.U;
    ctx.fillStyle = '#cfd7eb';
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.77);
    ctx.bezierCurveTo(g.W * 0.12, g.H * 0.74, g.W * 0.22, g.H * 0.86, g.W * 0.31, g.H + 1);
    ctx.lineTo(0, g.H + 1);
    ctx.fill();
    ctx.fillStyle = '#eef2f9';
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.77);
    ctx.bezierCurveTo(g.W * 0.12, g.H * 0.74, g.W * 0.22, g.H * 0.86, g.W * 0.31, g.H + 1);
    ctx.lineTo(g.W * 0.26, g.H + 1);
    ctx.bezierCurveTo(g.W * 0.18, g.H * 0.9, g.W * 0.1, g.H * 0.8, 0, g.H * 0.82);
    ctx.fill();
    const rx = hero.x + hero.rx + u * 3;
    ctx.fillStyle = '#dfe5f2';
    ctx.beginPath();
    ctx.moveTo(rx, g.H + 1);
    ctx.quadraticCurveTo(rx + u * 6, g.H * 0.87, g.W, g.H * 0.85);
    ctx.lineTo(g.W, g.H + 1);
    ctx.fill();
  }

  function paintWorld(g, rand, seed) {
    const hero = heroGeometry(g);
    const land = paintLand(g, seed);
    const ctx = land.getContext('2d');
    paintTreeline(ctx, g, rand, seed);
    state.huts = placeHuts(ctx, g, rand, hero);
    paintHero(ctx, g, hero);
    paintFootprints(ctx, g, hero);
    state.candles = paintCandles(ctx, g, hero);
    paintDrifts(ctx, g, hero);
    state.hero = hero;
    return land;
  }

  /* ---------- motion ---------- */

  function resetFlake(g, i, anywhere) {
    const r = state.rand;
    const near = r() < 0.3;
    state.fx[i] = r() * g.W;
    state.fy[i] = anywhere ? r() * g.H : -2;
    state.fv[i] = g.U * (near ? 9 + r() * 5 : 3.5 + r() * 3);
    state.fs[i] = near ? 1 : 0;
    state.fp[i] = r() * 6.28;
  }

  function drawSnow(ctx, g, t, dt, amount) {
    const count = Math.min(MAX_FLAKES, Math.round(g.W * 1.8 * amount));
    const big = Math.max(1, Math.round(g.U * 0.8));
    ctx.fillStyle = '#eef2fa';
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = pass ? 0.95 : 0.6;
      const size = pass ? big : 1;
      for (let i = 0; i < count; i++) {
        if (state.fs[i] !== pass) continue;
        state.fy[i] += state.fv[i] * dt;
        if (state.fy[i] > g.H) resetFlake(g, i, false);
        const x = state.fx[i] + Math.sin(t * 0.5 + state.fp[i]) * g.U * 1.6;
        ctx.fillRect(x, state.fy[i], size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawStars(ctx, t) {
    ctx.fillStyle = '#f1f3fa';
    for (const s of state.stars) {
      ctx.globalAlpha = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * s.rate + s.ph));
      ctx.fillRect(s.x, s.y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawClouds(ctx, g, t) {
    const w = g.W * 1.5;
    const h = g.H * 0.48;
    const off = (t * g.U * 0.5) % w;
    ctx.drawImage(state.cloud, -off, 0, w, h);
    ctx.drawImage(state.cloud, w - off, 0, w, h);
  }

  function drawGlows(ctx, g, t, amount) {
    ctx.globalCompositeOperation = 'lighter';
    for (const h of state.huts) {
      ctx.globalAlpha = Math.min(1, amount * (0.5 + 0.12 * Math.sin(t * 0.9 + h.ph)));
      ctx.drawImage(state.warm, h.x - h.s, h.y - h.s, h.s * 2, h.s * 2);
    }
    const hero = state.hero;
    const s = g.U * 22;
    ctx.globalAlpha = Math.min(1, amount * (0.32 + 0.06 * Math.sin(t * 1.3) + 0.04 * Math.sin(t * 2.1)));
    ctx.drawImage(state.warm, hero.x - s, hero.y - g.U * 8 - s, s * 2, s * 2);
    for (const c of state.candles) {
      const r = g.U * 7;
      ctx.globalAlpha = Math.min(1, amount * (0.55 + 0.1 * Math.sin(t * 1.7 + c.x)));
      ctx.drawImage(state.warm, c.x - r, c.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawHearth(ctx, g, t, amount) {
    const hero = state.hero;
    const u = g.U;
    const cx = hero.x;
    const cy = hero.y - u * 5;
    ctx.globalCompositeOperation = 'lighter';
    const r = u * (5 + 0.4 * Math.sin(t * 1.9));
    ctx.globalAlpha = Math.min(1, amount * 0.6);
    ctx.drawImage(state.ember, cx - r, cy - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffd88a';
    for (let i = 0; i < SPARKS; i++) {
      const life = (t * (0.18 + (i % 4) * 0.04) + i / SPARKS) % 1;
      ctx.globalAlpha = (1 - life) * 0.9 * Math.min(1, amount);
      const x = cx + Math.sin(life * 5 + i * 2.3) * u * 1.6 + (i - SPARKS / 2) * u * 0.3;
      ctx.fillRect(x, cy - life * u * 9, 1, 1);
    }
    ctx.globalAlpha = 1;
    for (const c of state.candles) {
      const sway = Math.sin(t * 1.3 + c.x) * u * 0.25;
      ctx.fillStyle = '#f6c060';
      ctx.beginPath();
      ctx.ellipse(c.x + sway * 0.5, c.y + u * 0.2, u * 0.6, u * 1.1, sway * 0.1, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = '#fff0c4';
      ctx.fillRect(c.x - u * 0.2 + sway * 0.3, c.y, u * 0.4, u * 0.6);
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    const seed = Math.floor(rand() * 1000);
    state.g = g;
    state.rand = rand;
    state.sky = paintSky(g, rand);
    state.cloud = paintClouds(g, seed + 40);
    state.land = paintWorld(g, rand, seed);
    state.family = paintFamily(g, state.hero);
    state.warm = glowSprite('240,168,90', 0.75);
    state.ember = glowSprite('255,150,70', 0.9);
    state.fx = new Float32Array(MAX_FLAKES);
    state.fy = new Float32Array(MAX_FLAKES);
    state.fv = new Float32Array(MAX_FLAKES);
    state.fp = new Float32Array(MAX_FLAKES);
    state.fs = new Uint8Array(MAX_FLAKES);
    for (let i = 0; i < MAX_FLAKES; i++) resetFlake(g, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const p = api.props;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(state.sky, 0, 0);
    drawStars(ctx, t);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.land, 0, 0);
    drawGlows(ctx, g, t, p.candle);
    ctx.drawImage(state.family, 0, 0);
    drawHearth(ctx, g, t, p.candle);
    drawSnow(ctx, g, t, dt, p.snow);
  }

  Kasuri.run({
    defaults: { snow: 1, candle: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.1, tint: 0.6 },
    maxFps: 24,
    setup,
    draw,
  });
})();
