/*
 * 白神 Shirakami — a primeval beech forest in fresh green.
 *
 * Canopy, pale trunks, undergrowth and a small torii are baked once. The pond is
 * that world flipped and laid back in thin rows that slide sideways. Light shafts
 * breathe slowly, mist is one tiling strip and a few motes drift upward.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.7;
  const GLOW = ['#e6e4c6', '#d3dcae', '#b7cd94', '#8fb070'];
  const LEAF = [['#4f7a3a', '#6b9446', '#93b95a'], ['#3f6a35', '#5a8640', '#7fa850'], ['#6b9446', '#8db356', '#b4cd72']];
  const BARK = { lit: '#e0e0cc', mid: '#b8bea8', shade: '#7f8a74', dark: '#5f6b5a', moss: '#6a8a44', mossDark: '#476a39' };
  const SASA = ['#3f6a35', '#567f3f', '#78a04c'];
  const POND = '#2f4a4a';
  const VEIL = 0.3;
  const TORII = { post: '#b4472f', dark: '#7e2f22', cap: '#2a2d2a' };
  const MOTES = 26;
  const STREAKS = 44;
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
    const wy = Math.round(H * WATER);
    return { W, H, U, wy };
  }

  // ---- sky glow and canopy ---------------------------------------------------

  function paintGlow(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.wy);
    const inks = GLOW.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.wy; y++) {
      const f = Math.min(1, y / (g.wy * 0.9)) * (inks.length - 1);
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

  function leafCluster(ctx, x, y, r, inks) {
    ctx.fillStyle = inks[0];
    blob(ctx, x, y, r, r * 0.7);
    ctx.fillStyle = inks[1];
    blob(ctx, x - r * 0.2, y - r * 0.15, r * 0.7, r * 0.5);
    ctx.fillStyle = inks[2];
    blob(ctx, x - r * 0.35, y - r * 0.28, r * 0.32, r * 0.2);
  }

  // Canopy rows: dense at the top, breaking into gaps lower down where the light comes through.
  function canopy(ctx, g, rand, y0, y1, size, inks, gap) {
    for (let y = y0; y < y1; y += size * 0.8) {
      const f = (y - y0) / (y1 - y0);
      for (let x = -size; x < g.W + size; x += size * (0.9 + rand() * 0.5)) {
        const n = fbm(x / (g.U * 22), y / (g.U * 14), 3, 17);
        if (rand() < f * 0.85 + gap * (n - 0.45)) continue;
        leafCluster(ctx, x + (rand() - 0.5) * size, y + (rand() - 0.5) * size * 0.5, size * (0.7 + rand() * 0.6), inks[Math.floor(rand() * inks.length)]);
      }
    }
  }

  function reversed(pts) {
    const out = [];
    for (let i = pts.length - 2; i >= 0; i -= 2) out.push(pts[i], pts[i + 1]);
    return out;
  }

  // ---- trunks ----------------------------------------------------------------

  // A beech trunk: pale, slightly swelling at the foot, lit on the left and shaded on the right.
  function trunk(ctx, g, rand, x, top, bot, w, tone) {
    const lean = (rand() - 0.5) * w * 1.2;
    const n = 14;
    const left = [];
    const right = [];
    const mid = [];
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const y = lerp(top, bot, f);
      const sw = 1 + Math.pow(f, 6) * 0.9;
      const cx = x + lean * (1 - f) + Math.sin(f * 5 + x) * w * 0.12;
      const hw = (w / 2) * sw;
      left.push(cx - hw, y);
      mid.push(cx + hw * 0.1, y);
      right.push(cx + hw, y);
    }
    const body = left.concat(reversed(right));
    ctx.fillStyle = tone ? BARK.mid : BARK.lit;
    poly(ctx, body);
    ctx.fillStyle = tone ? BARK.shade : BARK.mid;
    const shade = [];
    for (let i = 0; i < mid.length; i += 2) shade.push(mid[i], mid[i + 1]);
    for (let i = right.length - 2; i >= 0; i -= 2) shade.push(right[i], right[i + 1]);
    poly(ctx, shade);
    // grey lichen patches and rings along the bark
    ctx.fillStyle = BARK.dark;
    for (let i = 0; i < 9; i++) {
      const f = 0.1 + rand() * 0.8;
      const idx = Math.round(f * n) * 2;
      const px = lerp(left[idx], right[idx], 0.2 + rand() * 0.6);
      blob(ctx, px, lerp(top, bot, f), w * (0.05 + rand() * 0.1), w * (0.14 + rand() * 0.2));
    }
    ctx.fillStyle = BARK.shade;
    for (let i = 0; i < 6; i++) {
      const f = 0.15 + rand() * 0.75;
      const idx = Math.round(f * n) * 2;
      ctx.fillRect(left[idx], lerp(top, bot, f), right[idx] - left[idx], Math.max(1, g.U * 0.15));
    }
    // moss climbing the foot
    const fx = (left[n * 2] + right[n * 2]) / 2;
    ctx.fillStyle = BARK.mossDark;
    blob(ctx, fx, bot - w * 0.1, w * 0.75, w * 0.45);
    ctx.fillStyle = BARK.moss;
    blob(ctx, fx - w * 0.2, bot - w * 0.3, w * 0.5, w * 0.3);
    return { lean, x };
  }

  function branch(ctx, g, rand, x, y, len, w, dir) {
    ctx.strokeStyle = BARK.mid;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, w);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + dir * len * 0.4, y - len * 0.1, x + dir * len, y - len * 0.5);
    ctx.stroke();
  }

  function trunkRow(ctx, g, rand, count, top, bot, w0, w1, tone, x0, x1) {
    for (let i = 0; i < count; i++) {
      const x = lerp(x0, x1, (i + 0.5 + (rand() - 0.5) * 0.7) / count);
      const w = lerp(w0, w1, rand());
      trunk(ctx, g, rand, x, top, bot, w, tone);
      if (rand() < 0.6) branch(ctx, g, rand, x, top + (bot - top) * (0.18 + rand() * 0.2), g.U * (7 + rand() * 7), w * 0.3, rand() < 0.5 ? -1 : 1);
    }
  }

  // ---- undergrowth -----------------------------------------------------------

  function sasa(ctx, g, rand, x0, x1, y, h) {
    for (let x = x0; x < x1; x += g.U * (0.5 + rand() * 1)) {
      const hh = h * (0.5 + rand() * 0.7);
      ctx.strokeStyle = SASA[Math.floor(rand() * SASA.length)];
      ctx.lineWidth = Math.max(1, g.U * 0.5);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (rand() - 0.5) * hh * 0.8, y - hh * 0.6, x + (rand() - 0.5) * hh * 1.2, y - hh);
      ctx.stroke();
    }
  }

  function fern(ctx, g, rand, x, y, r) {
    ctx.fillStyle = '#4f7a3a';
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      blob(ctx, x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.35, r * 0.5, r * 0.14);
    }
    ctx.fillStyle = '#93b95a';
    blob(ctx, x - r * 0.2, y - r * 0.22, r * 0.3, r * 0.1);
  }

  // ---- torii on the far shore ------------------------------------------------

  function torii(ctx, g, x, y, s) {
    const hw = s * 0.6;
    const pw = Math.max(2, s * 0.09);
    ctx.fillStyle = TORII.post;
    ctx.fillRect(x - hw, y - s * 0.8, pw, s * 0.8);
    ctx.fillRect(x + hw - pw, y - s * 0.8, pw, s * 0.8);
    ctx.fillStyle = TORII.dark;
    ctx.fillRect(x - hw + pw, y - s * 0.8, pw * 0.4, s * 0.8);
    ctx.fillStyle = TORII.post;
    ctx.fillRect(x - hw - pw * 0.5, y - s * 0.6, hw * 2 + pw * 2, Math.max(1, s * 0.05));
    ctx.fillStyle = TORII.cap;
    const kasagi = [x - hw - s * 0.18, y - s * 0.84, x + hw + s * 0.18 + pw, y - s * 0.84, x + hw + s * 0.08 + pw, y - s * 0.93, x - hw - s * 0.08, y - s * 0.93];
    poly(ctx, kasagi);
    ctx.fillStyle = TORII.post;
    ctx.fillRect(x - hw - s * 0.06, y - s * 0.86, hw * 2 + pw + s * 0.12, Math.max(1, s * 0.05));
    ctx.fillStyle = TORII.dark;
    ctx.fillRect(x - hw, y - s * 0.02, pw * 1.3, Math.max(1, s * 0.03));
    ctx.fillRect(x + hw - pw * 1.3, y - s * 0.02, pw * 1.3, Math.max(1, s * 0.03));
  }

  // ---- baked layers ----------------------------------------------------------

  function paintBack(g, rand) {
    const c = layer(g.W, g.wy + 1);
    const ctx = c.getContext('2d');
    const u = g.U;
    paintGlow(ctx, g, rand);
    // far canopy and far trunks, kept pale
    canopy(ctx, g, rand, 0, g.wy * 0.5, u * 5, [LEAF[2], LEAF[1]], 0.9);
    trunkRow(ctx, g, rand, Math.round(g.W / (u * 14)), g.wy * 0.18, g.wy - u * 3, u * 1.6, u * 2.8, 1, 0, g.W);
    ctx.fillStyle = '#dfe5c2';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, 0, g.W, g.wy);
    ctx.globalAlpha = 1;
    // far shore, torii small beside a pale bank
    ctx.fillStyle = '#7d9a5c';
    ctx.fillRect(0, g.wy - u * 3, g.W, u * 3);
    sasa(ctx, g, rand, 0, g.W, g.wy - u * 1.5, u * 5);
    torii(ctx, g, g.W * 0.7, g.wy - u * 1.4, u * 20);
    // mid trunks, larger and clearer
    trunkRow(ctx, g, rand, Math.round(g.W / (u * 24)), g.wy * 0.1, g.wy - u * 1, u * 4, u * 7, 0, 0, g.W);
    canopy(ctx, g, rand, 0, g.wy * 0.34, u * 6.5, [LEAF[0], LEAF[1], LEAF[2]], 0.7);
    return c;
  }

  function paintShore(g, rand) {
    const c = layer(g.W, g.wy + 1);
    const ctx = c.getContext('2d');
    const u = g.U;
    ctx.fillStyle = '#3f6a35';
    ctx.fillRect(0, g.wy - u * 1.3, g.W, u * 1.3 + 1);
    sasa(ctx, g, rand, 0, g.W, g.wy - u * 0.8, u * 4.5);
    for (let x = u * 4; x < g.W; x += u * (14 + rand() * 12)) fern(ctx, g, rand, x, g.wy - u * 0.9, u * (3 + rand() * 2));
    for (let x = 0; x < g.W; x += u * (2 + rand() * 4)) {
      ctx.fillStyle = rand() < 0.5 ? '#7d8a76' : '#a3a998';
      blob(ctx, x, g.wy - u * 0.3, u * (0.6 + rand() * 0.8), u * 0.4);
    }
    return c;
  }

  function paintShafts(g, rand) {
    const c = layer(g.W, g.wy + 1);
    const ctx = c.getContext('2d');
    const slant = g.wy * 0.32;
    const n = Math.max(4, Math.round(g.W / (g.U * 22)));
    for (let i = 0; i < n; i++) {
      const x = g.W * ((i + 0.3 + rand() * 0.5) / n);
      const w = g.U * (3 + rand() * 6);
      const grad = ctx.createLinearGradient(x, 0, x + slant, g.wy);
      grad.addColorStop(0, 'rgba(248,240,190,0.0)');
      grad.addColorStop(0.2, 'rgba(252,244,190,0.8)');
      grad.addColorStop(1, 'rgba(240,235,185,0.0)');
      ctx.fillStyle = grad;
      poly(ctx, [x, 0, x + w, 0, x + w * 2.2 + slant, g.wy, x + slant, g.wy]);
    }
    return c;
  }

  function paintForeground(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const edge = g.W * 0.12;
    trunk(ctx, g, rand, g.W * 0.05, -u * 4, g.wy - u * 0.5, u * 10, 0);
    trunk(ctx, g, rand, g.W * 0.955, -u * 4, g.wy - u * 0.5, u * 8, 0);
    ctx.fillStyle = '#3f6a35';
    for (let i = 0; i < 18; i++) {
      leafCluster(ctx, rand() * g.W, rand() * u * 6, u * (4 + rand() * 4), LEAF[1]);
    }
    leafCluster(ctx, edge, u * 3, u * 6, LEAF[1]);
    return c;
  }

  // ---- water -----------------------------------------------------------------

  function paintReflection(g) {
    const h = g.H - g.wy;
    const world = layer(g.W, g.wy + 1);
    const wctx = world.getContext('2d');
    wctx.drawImage(state.back, 0, 0);
    wctx.drawImage(state.shore, 0, 0);
    wctx.drawImage(state.front, 0, 0, g.W, g.wy + 1, 0, 0, g.W, g.wy + 1);
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, -1, 0, g.wy);
    ctx.drawImage(world, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = POND;
    ctx.globalAlpha = VEIL;
    ctx.fillRect(0, 0, g.W, h);
    ctx.globalAlpha = 1;
    return c;
  }

  function waveAt(g, y, t, ripple) {
    const d = (y - g.wy) / (g.H - g.wy);
    const amp = g.U * (0.05 + 1.1 * d) * ripple;
    const k = y / g.U;
    return amp * (Math.sin(k * 0.7 + t * 0.6) + 0.5 * Math.sin(k * 1.9 - t * 1.0));
  }

  function drawWater(ctx, g, t, ripple) {
    const src = state.reflection;
    const water = g.H - g.wy;
    ctx.drawImage(src, 0, g.wy);
    let y = 0;
    while (y < water) {
      const h = Math.max(1, Math.round(g.U * lerp(0.5, 2, y / water)));
      const dx = Math.round(waveAt(g, g.wy + y, t, ripple));
      ctx.drawImage(src, 0, y, g.W, h, dx, g.wy + y, g.W, h);
      y += h;
    }
  }

  function makeStreaks(g, rand) {
    const s = { x: new Float32Array(STREAKS), y: new Float32Array(STREAKS), l: new Float32Array(STREAKS), p: new Float32Array(STREAKS) };
    for (let i = 0; i < STREAKS; i++) {
      const d = 0.02 + 0.98 * Math.pow(rand(), 1.4);
      s.x[i] = rand() * g.W;
      s.y[i] = g.wy + d * (g.H - g.wy);
      s.l[i] = g.U * (2 + d * 8) * (0.6 + rand() * 0.8);
      s.p[i] = rand() * TAU;
    }
    return s;
  }

  function drawStreaks(ctx, g, t, ripple) {
    const s = state.streaks;
    const thick = Math.max(1, g.U * 0.35);
    const slide = t * g.U * (0.2 + ripple * 0.3);
    const amount = Math.min(1, ripple + 0.2);
    ctx.fillStyle = '#e4e6cc';
    for (let i = 0; i < STREAKS; i++) {
      const a = Math.sin(t * 0.45 + s.p[i]);
      if (a <= 0) continue;
      ctx.globalAlpha = a * amount * 0.38;
      const x = ((s.x[i] + slide) % (g.W + s.l[i] * 2)) - s.l[i];
      ctx.fillRect(x, s.y[i], s.l[i], thick);
    }
    ctx.globalAlpha = 1;
  }

  // ---- mist, light and motes -------------------------------------------------

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 16), y / (g.U * 5), 4, 91);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.36, 0.62, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 232;
        img.data[i + 1] = 236;
        img.data[i + 2] = 216;
        img.data[i + 3] = a * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMist(ctx, g, t, mist) {
    if (mist <= 0) return;
    const m = state.mist;
    const w = m.width;
    const a = (t * g.U * 0.9) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.85);
    ctx.drawImage(m, -a, g.H * 0.5);
    ctx.drawImage(m, w - a, g.H * 0.5);
    const b = (t * g.U * 0.5 + w * 0.4) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.55);
    ctx.drawImage(m, b - w, g.H * 0.28);
    ctx.drawImage(m, b, g.H * 0.28);
    ctx.globalAlpha = 1;
  }

  function drawShafts(ctx, g, t, light) {
    if (light <= 0) return;
    const s = state.shafts;
    const sway = Math.sin(t * 0.15) * g.U * 2;
    ctx.globalAlpha = Math.min(1, light * (0.8 + 0.15 * Math.sin(t * 0.3)));
    ctx.drawImage(s, sway, 0);
    ctx.globalAlpha = Math.min(1, light * (0.5 + 0.15 * Math.sin(t * 0.22 + 2)));
    ctx.drawImage(s, -sway * 1.5 + g.W * 0.07, 0);
    ctx.globalAlpha = 1;
  }

  function makeMotes(g, rand) {
    const f = () => new Float32Array(MOTES);
    const m = { x: f(), y: f(), v: f(), p: f(), s: f() };
    for (let i = 0; i < MOTES; i++) {
      m.x[i] = rand() * g.W;
      m.y[i] = g.H * 0.1 + rand() * g.wy * 0.8;
      m.v[i] = g.U * (0.4 + rand() * 0.8);
      m.p[i] = rand() * TAU;
      m.s[i] = Math.max(1, g.U * (0.3 + rand() * 0.4));
    }
    return m;
  }

  function drawMotes(ctx, g, t, dt, light) {
    const m = state.motes;
    ctx.fillStyle = '#f4efc4';
    for (let i = 0; i < MOTES; i++) {
      m.y[i] -= m.v[i] * dt * 0.5;
      m.x[i] += Math.sin(t * 0.5 + m.p[i]) * g.U * 0.6 * dt;
      if (m.y[i] < g.H * 0.05) {
        m.y[i] = g.wy - g.U * 3;
        m.x[i] = state.rand() * g.W;
      }
      ctx.globalAlpha = Math.min(1, light) * (0.35 + 0.25 * Math.sin(t * 0.8 + m.p[i]));
      ctx.fillRect(m.x[i], m.y[i], m.s[i], m.s[i]);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.shore = paintShore(g, rand);
    state.front = paintForeground(g, rand);
    state.reflection = paintReflection(g);
    state.shafts = paintShafts(g, rand);
    state.mist = paintMist(g);
    state.streaks = makeStreaks(g, rand);
    state.motes = makeMotes(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { light, mist, ripple } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawShafts(ctx, g, t, light);
    drawMist(ctx, g, t, mist);
    ctx.drawImage(state.shore, 0, 0);
    drawWater(ctx, g, t, ripple);
    drawStreaks(ctx, g, t, ripple);
    drawMotes(ctx, g, t, Math.min(dt, 0.1), light);
    ctx.drawImage(state.front, 0, 0);
  }

  Kasuri.run({
    defaults: { light: 1, mist: 1, ripple: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
