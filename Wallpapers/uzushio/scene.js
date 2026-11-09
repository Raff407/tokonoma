/*
 * 渦潮 Uzushio — whirlpools churning in a strait under a long suspension bridge at dusk.
 *
 * Sky, headlands, sea and bridge are baked once. Each whirlpool is two baked discs, an
 * inner eye and an outer ring, turned at different rates and squashed for the view so
 * the foam arms shear like a real eddy. The tide is one tiling foam strip sliding past.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep, mixColor, parseColor } = K;

  const TAU = Math.PI * 2;
  const HORIZON = 0.43;
  const DECK = 0.355;
  const TOWER_TOP = 0.1;
  const TOWERS = [0.27, 0.73];
  const SAG = 0.315;
  const SS = 2;
  const SKY = ['#33405f', '#4c5672', '#7c7584', '#b58f7c', '#d8ad7c', '#e3c08a'];
  const SEA_FAR = '#7d8a88';
  const SEA_MID = '#3f5f66';
  const SEA_NEAR = '#1e3540';
  const EYE = '#101b22';
  const SWIRL = '#2c4c54';
  const FOAM = [228, 222, 204];
  const BRIDGE = { steel: '#252a33', lit: '#7a6c58', deck: '#2c313b', rail: '#5c5a58', hanger: '#3a3e47' };
  const LAND = { far: '#6b6f7c', near: '#2e3d36', top: '#41523f', pine: '#24332c' };
  const WHIRLS = [
    { x: 0.47, y: 0.7, r: 25, dir: 1, seed: 11 },
    { x: 0.15, y: 0.87, r: 21, dir: -1, seed: 23 },
    { x: 0.82, y: 0.59, r: 13, dir: 1, seed: 37 },
  ];
  const GULLS = 4;
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
    return { W, H, U, hz: Math.round(H * HORIZON), deck: H * DECK };
  }

  // ---- back: sky, far hills, sea ------------------------------------------

  function paintSky(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.hz);
    SKY.forEach((c, i) => grad.addColorStop(i / (SKY.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.hz + 1);
    ctx.fillStyle = '#efd49c';
    blob(ctx, g.W * 0.6, g.hz - g.U * 5, g.U * 3.4, g.U * 3.4);
    ctx.fillStyle = '#e6c890';
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) {
      const y = g.H * (0.16 + i * 0.045);
      const x = rand() * g.W;
      blob(ctx, x, y, g.U * (10 + rand() * 14), g.U * 0.5);
    }
    ctx.globalAlpha = 1;
  }

  function ridge(ctx, g, x0, x1, base, peak, seed, ink) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(x0, base);
    for (let x = x0; x <= x1; x++) {
      const f = (x - x0) / (x1 - x0);
      const hump = Math.sin(f * Math.PI);
      const y = base - (base - peak) * Math.pow(hump, 0.7) * (0.8 + fbm(x * 0.08, seed, 3, seed) * 0.4);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(x1, base);
    ctx.closePath();
    ctx.fill();
  }

  function paintSea(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, g.hz, 0, g.H);
    grad.addColorStop(0, SEA_FAR);
    grad.addColorStop(0.25, SEA_MID);
    grad.addColorStop(1, SEA_NEAR);
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.hz, g.W, g.H - g.hz);
    // Sun path on the water.
    ctx.fillStyle = '#d9b67e';
    for (let i = 0; i < 26; i++) {
      const f = rand();
      const y = g.hz + 1 + f * f * (g.H - g.hz) * 0.5;
      const w = g.U * (1 + f * 5) * (0.5 + rand());
      ctx.globalAlpha = 0.55 * (1 - f);
      ctx.fillRect(g.W * 0.6 + (rand() - 0.5) * g.U * (2 + f * 8) - w / 2, y, w, Math.max(1, g.U * 0.4));
    }
    // Dark troughs beneath each eddy.
    for (const w of WHIRLS) {
      const sq = squash(g, w.y * g.H);
      const R = w.r * g.U * 1.3;
      ctx.setTransform(1, 0, 0, sq, w.x * g.W, w.y * g.H);
      const trough = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      trough.addColorStop(0, 'rgba(18, 34, 48, 0.5)');
      trough.addColorStop(1, 'rgba(18, 34, 48, 0)');
      ctx.fillStyle = trough;
      blob(ctx, 0, 0, R, R);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  function headland(ctx, g, rand, x0, x1, top, seed) {
    ridge(ctx, g, x0, x1, g.hz + g.U * 2, top, seed, LAND.near);
    ctx.fillStyle = LAND.pine;
    for (let i = 0; i < 30; i++) {
      const x = lerp(x0, x1, 0.1 + rand() * 0.8);
      const y = lerp(top + g.U * 3, g.hz, rand());
      blob(ctx, x, y, g.U * (1 + rand() * 1.6), g.U * (0.8 + rand()));
    }
    ctx.fillStyle = LAND.top;
    for (let i = 0; i < 14; i++) {
      const x = lerp(x0, x1, 0.2 + rand() * 0.6);
      const y = lerp(top + g.U * 2, g.hz - g.U * 4, rand());
      blob(ctx, x, y, g.U * (0.8 + rand()), g.U * 0.5);
    }
    ctx.fillStyle = '#16211d';
    ctx.fillRect(x0, g.hz + g.U * 1.2, x1 - x0, Math.max(1, g.U * 0.9));
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    ridge(ctx, g, g.W * 0.12, g.W * 0.55, g.hz + 1, g.hz - g.U * 7, 5, LAND.far);
    ridge(ctx, g, g.W * 0.62, g.W * 1.02, g.hz + 1, g.hz - g.U * 5, 9, '#5f6472');
    paintSea(ctx, g, rand);
    headland(ctx, g, rand, -g.W * 0.12, g.W * 0.17, g.H * 0.27, 3);
    headland(ctx, g, rand, g.W * 0.85, g.W * 1.12, g.H * 0.25, 7);
    return c;
  }

  // ---- bridge --------------------------------------------------------------

  function cableY(g, x) {
    const a = TOWERS[0] * g.W;
    const b = TOWERS[1] * g.W;
    const top = g.H * TOWER_TOP;
    if (x >= a && x <= b) {
      const f = (x - (a + b) / 2) / ((b - a) / 2);
      return lerp(g.H * SAG, top, f * f);
    }
    const end = x < a ? 0 : g.W;
    const tower = x < a ? a : b;
    const f = (x - end) / (tower - end);
    return lerp(g.deck - g.U * 1.5, top, f) + Math.sin(f * Math.PI) * g.U * 2.5;
  }

  function paintTower(ctx, g, xf) {
    const x = xf * g.W;
    const w = g.U * 1.3;
    const top = g.H * TOWER_TOP - g.U;
    const base = g.hz + g.U * 3.5;
    for (const side of [-1, 1]) {
      const lx = x + side * g.U * 1.6 - w / 2;
      ctx.fillStyle = BRIDGE.steel;
      ctx.fillRect(lx, top, w, base - top);
      ctx.fillStyle = BRIDGE.lit;
      ctx.fillRect(lx + w - Math.max(1, w * 0.35), top, Math.max(1, w * 0.35), g.deck - top);
    }
    ctx.fillStyle = BRIDGE.steel;
    for (const f of [0, 0.45, 0.8]) {
      const y = lerp(top, g.deck, f);
      ctx.fillRect(x - g.U * 2.3, y, g.U * 4.6, Math.max(1, g.U * 0.8));
    }
    ctx.fillStyle = '#1b2028';
    ctx.fillRect(x - g.U * 3, g.hz + g.U * 1.5, g.U * 6, g.U * 2.5);
  }

  function paintBridge(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = BRIDGE.hanger;
    const step = Math.max(2, Math.round(g.U * 2.2));
    for (let x = 1; x < g.W; x += step) {
      const y = cableY(g, x);
      if (y < g.deck - 1) ctx.fillRect(x, y, 1, g.deck - y);
    }
    for (const xf of TOWERS) paintTower(ctx, g, xf);
    ctx.strokeStyle = BRIDGE.steel;
    ctx.lineWidth = Math.max(1, g.U * 0.6);
    ctx.beginPath();
    for (let x = 0; x <= g.W; x++) {
      if (x === 0) ctx.moveTo(x, cableY(g, x));
      else ctx.lineTo(x, cableY(g, x));
    }
    ctx.stroke();
    const dh = g.U * 2.4;
    ctx.fillStyle = BRIDGE.deck;
    ctx.fillRect(0, g.deck, g.W, dh);
    ctx.fillStyle = BRIDGE.rail;
    ctx.fillRect(0, g.deck - Math.max(1, g.U * 0.4), g.W, Math.max(1, g.U * 0.4));
    ctx.fillStyle = '#1a1e26';
    for (let x = 0; x < g.W; x += step * 2) ctx.fillRect(x, g.deck + dh * 0.45, step, dh * 0.4);
    return c;
  }

  // ---- whirlpools ----------------------------------------------------------

  function squash(g, y) {
    return 0.34 + 0.24 * smoothstep(g.hz, g.H, y);
  }

  // One disc of an eddy: dark funnel water and three foam arms on a log spiral.
  function paintWhirl(R, dir, seed, inner) {
    const S = Math.ceil(R * 2 * SS);
    const c = layer(S, S);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    const eye = parseColor(EYE);
    const swirl = parseColor(SWIRL);
    const half = S / 2;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = (x + 0.5 - half) / half;
        const dy = (y + 0.5 - half) / half;
        const r = Math.hypot(dx, dy);
        if (r >= 1) continue;
        const a = Math.atan2(dy, dx);
        const n = fbm(x * 0.12 / SS, y * 0.12 / SS, 3, seed) - 0.5;
        const s = Math.sin(5 * a * dir - 5.2 * Math.log(r + 0.03) + n * 2.6) * 0.5 + 0.5;
        const env = smoothstep(0.12, 0.34, r) * (1 - smoothstep(0.72, 0.98, r));
        const rim = Math.exp(-Math.pow((r - 0.8) / 0.07, 2)) * smoothstep(0.5, 0.7, n + 0.45 + s * 0.3);
        const foam = Math.max(smoothstep(0.66, 0.94, s + n * 0.5) * env, rim * 0.65);
        const water = 1 - smoothstep(0.6, 1, r);
        const keep = inner ? 1 - smoothstep(0.45, 0.6, r) : smoothstep(0.4, 0.55, r);
        const base = mixColor(eye, swirl, smoothstep(0, 0.7, r));
        const col = mixColor(base, FOAM, foam);
        const i = (y * S + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = Math.max(water * 0.92, foam) * keep * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function makeWhirls(g) {
    return WHIRLS.map((w) => {
      const R = w.r * g.U;
      return {
        x: w.x * g.W,
        y: w.y * g.H,
        R,
        dir: w.dir,
        sq: squash(g, w.y * g.H),
        outer: paintWhirl(R, w.dir, w.seed, false),
        inner: paintWhirl(R, w.dir, w.seed + 1, true),
        phase: w.seed,
      };
    });
  }

  function drawDisc(ctx, w, sprite, angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    ctx.setTransform(c, s * w.sq, -s, c * w.sq, w.x, w.y);
    ctx.drawImage(sprite, -w.R, -w.R, w.R * 2, w.R * 2);
  }

  function drawWhirls(ctx, t, whirl) {
    if (whirl <= 0) return;
    const rate = 0.35 + 0.4 * whirl;
    ctx.globalAlpha = Math.min(1, whirl);
    for (const w of state.whirls) {
      const spin = -w.dir * rate * t * (14 / Math.max(8, w.R / state.g.U));
      drawDisc(ctx, w, w.outer, spin * 0.5 + w.phase);
      drawDisc(ctx, w, w.inner, spin * 1.1 + w.phase);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  // ---- tide ----------------------------------------------------------------

  function paintTide(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = g.H - g.hz;
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const v = y / h;
      const sy = y / (g.U * (0.5 + v * 2.2));
      const sx = g.U * (10 + v * 16);
      for (let x = 0; x < w; x++) {
        const f = (px) => fbm(px / sx, sy, 3, 51);
        const d = lerp(f(x), f(x - w), x / w);
        const a = smoothstep(0.58, 0.74, d) * smoothstep(0, 0.06, v);
        const i = (y * w + x) * 4;
        img.data[i] = FOAM[0];
        img.data[i + 1] = FOAM[1];
        img.data[i + 2] = FOAM[2];
        img.data[i + 3] = a * 120;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawTide(ctx, g, t, current) {
    if (current <= 0) return;
    const m = state.tide;
    const w = m.width;
    const off = (t * g.U * 2.2 * (0.4 + current * 0.6)) % w;
    ctx.globalAlpha = Math.min(1, current * 0.8);
    ctx.drawImage(m, off - w, g.hz);
    ctx.drawImage(m, off, g.hz);
    ctx.globalAlpha = 1;
  }

  // ---- gulls ---------------------------------------------------------------

  function makeGulls(g, rand) {
    const out = [];
    for (let i = 0; i < GULLS; i++) {
      out.push({ x: rand() * g.W, y: g.H * (0.42 + rand() * 0.2), v: g.U * (2.2 + rand() * 1.6), p: rand() * TAU });
    }
    return out;
  }

  function drawGulls(ctx, g, t) {
    const span = g.W + g.U * 10;
    const wing = Math.max(1, g.U * 1.1);
    ctx.fillStyle = '#e4ddc8';
    for (const b of state.gulls) {
      const x = ((b.x + t * b.v) % span) - g.U * 5;
      const y = b.y + Math.sin(t * 0.4 + b.p) * g.U * 1.5;
      const lift = Math.sin(t * 3.2 + b.p) * g.U * 0.6;
      ctx.fillRect(x - wing, y - lift, wing, 1);
      ctx.fillRect(x, y, 1, 1);
      ctx.fillRect(x + 1, y - lift, wing, 1);
    }
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.bridge = paintBridge(g);
    state.tide = paintTide(g);
    state.whirls = makeWhirls(g);
    state.gulls = makeGulls(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { whirl, current, gulls } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawTide(ctx, g, t, current);
    drawWhirls(ctx, t, whirl);
    if (gulls) drawGulls(ctx, g, t);
    ctx.drawImage(state.bridge, 0, 0);
  }

  Kasuri.run({
    defaults: { whirl: 1, current: 1, gulls: true, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
