/*
 * 金刀比羅 Kotohira — a long stone stairway climbing through cedars to a
 * vermilion gate, with stone lanterns on both sides.
 *
 * The scene is baked in depth: a back layer (sky, hills, far trunks, the
 * stairs, far lanterns, the gate) and a front layer (near trunks, near
 * lanterns, canopy). Mist drifts between them. Layers repaint once a minute
 * from the clock so the lanterns glow at dusk.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep, clamp } = K;

  const VY = 0.4;          // vanishing height as a fraction of the screen
  const NEAR_Z = 0.8;      // depth that lands on the bottom edge
  const SPLIT_Z = 5.5;       // lanterns and trunks nearer than this are in front of the mist
  const GATE_Z = 10;
  const STEP_MAX = 34;
  const LANTERN_Z = [1.7, 3.2, 5.2, 7.8, 11.5, 17];
  const MAX_LEAVES = 9;
  const RETINT_SECONDS = 60;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- projection ---------------------------------------------------------

  function geo(g) {
    const vy = g.H * VY;
    return { vx: g.W * 0.5, vy, F: NEAR_Z * (g.H - vy), S: g.W * 0.25 };
  }

  const yAt = (p, z) => p.vy + p.F / z;
  const xAt = (p, lat, z) => p.vx + (lat * p.S) / z;

  // ---- sky and hills ------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.46);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.4; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function paintHills(ctx, g, sky, p) {
    const far = mixColor(rgb('#6f86a0'), sky.haze, 0.6);
    const near = mixColor(rgb('#3f5a5a'), sky.haze, 0.35);
    const shades = [mixColor(far, rgb('#0c1020'), sky.night * 0.5), mixColor(near, rgb('#0c1020'), sky.night * 0.6)];
    for (let k = 0; k < 2; k++) {
      ctx.fillStyle = hex(shades[k]);
      ctx.beginPath();
      ctx.moveTo(0, p.vy + g.U * 6);
      for (let x = 0; x <= g.W; x += 2) {
        const y = p.vy - g.H * (0.07 - k * 0.035) - (fbm(x * 0.012, k * 7, 4, 17 + k) - 0.4) * g.H * 0.16;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(g.W, p.vy + g.U * 6);
      ctx.fill();
    }
  }

  // ---- stairs -------------------------------------------------------------

  function band(ctx, p, lat, z0, z1, color) {
    const ya = yAt(p, z0);
    const yb = yAt(p, z1);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(xAt(p, -lat, z0), ya);
    ctx.lineTo(xAt(p, lat, z0), ya);
    ctx.lineTo(xAt(p, lat, z1), yb);
    ctx.lineTo(xAt(p, -lat, z1), yb);
    ctx.fill();
  }

  function paintStairs(ctx, g, sky, p, lit) {
    const night = sky.night;
    const stone = mixColor(mixColor(rgb('#8d95a0'), sky.amb, 0.25), rgb('#222a40'), night * 0.7);
    const tread = hex(mixColor(stone, sky.haze, 0.1));
    const riser = hex(mixColor(stone, rgb('#10141f'), 0.5));
    const moss = hex(mixColor(mixColor(rgb('#4e6a40'), sky.haze, 0.2), rgb('#101a18'), night * 0.7));
    const edge = hex(mixColor(stone, rgb('#10141f'), 0.25));
    for (let n = STEP_MAX; n >= 1; n--) {
      band(ctx, p, 1.18, n + 1, n + 0.45, moss);
      band(ctx, p, 1.02, n + 1, n + 0.45, tread);
      band(ctx, p, 1.18, n + 0.45, n, moss);
      band(ctx, p, 1.02, n + 0.45, n, riser);
      band(ctx, p, 1.02, n + 1.0, n + 0.94, edge);
    }
    // warm pools where the lanterns stand
    ctx.globalCompositeOperation = 'lighter';
    for (const z of LANTERN_Z) {
      const gx = p.vx;
      const gy = yAt(p, z) + g.U * 0.5;
      const r = (p.S * 2.1) / z;
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
      grad.addColorStop(0, `rgba(240,170,80,${0.2 * lit})`);
      grad.addColorStop(1, 'rgba(240,170,80,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(gx - r, gy - r * 0.5, r * 2, r);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---- cedars -------------------------------------------------------------

  function makeTrunks(rand) {
    const out = [];
    for (let i = 0; i < 44; i++) {
      out.push({
        lat: (i % 2 ? 1 : -1) * (2.6 + Math.pow(rand(), 1.4) * 8),
        z: 1.3 + Math.pow(rand(), 1.6) * 26,
        w: 0.3 + rand() * 0.35,
        tone: rand(),
      });
    }
    return out.sort((a, b) => b.z - a.z);
  }

  function paintForestBack(ctx, g, sky, p) {
    const deep = mixColor(mixColor(rgb('#2b4636'), sky.haze, 0.25), rgb('#0c1418'), sky.night * 0.7);
    ctx.fillStyle = hex(deep);
    ctx.fillRect(0, p.vy - g.H * 0.05, g.W, g.H);
  }

  function paintTrunks(ctx, g, sky, p, trunks, nearSide) {
    const bark = mixColor(mixColor(rgb('#4a3c30'), sky.amb, 0.15), rgb('#0e1016'), sky.night * 0.75);
    for (const t of trunks) {
      if ((t.z < SPLIT_Z) !== nearSide) continue;
      const fade = clamp(t.z / 28, 0, 1);
      const col = mixColor(mixColor(bark, rgb('#2a3a30'), t.tone * 0.4), sky.haze, fade * 0.55);
      const cx = xAt(p, t.lat, t.z);
      const w = (t.w * p.S) / t.z;
      ctx.fillStyle = hex(col);
      ctx.fillRect(cx - w / 2, 0, Math.max(1, w), yAt(p, t.z));
      ctx.fillStyle = hex(mixColor(col, rgb('#0a0c10'), 0.35));
      ctx.fillRect(cx + w * 0.2, 0, Math.max(1, w * 0.3), yAt(p, t.z));
    }
  }

  function paintCanopy(ctx, g, sky, rand) {
    const leaf = mixColor(mixColor(rgb('#2f4d37'), sky.haze, 0.2), rgb('#0a1214'), sky.night * 0.8);
    const dark = mixColor(leaf, rgb('#0a1010'), 0.45);
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = hex(pass ? dark : leaf);
      for (let i = 0; i < 70; i++) {
        const side = rand() < 0.5 ? -1 : 1;
        const edge = Math.pow(rand(), 1.6);
        const x = g.W * (side < 0 ? 0.5 * edge : 1 - 0.5 * edge) * (side < 0 ? 0.92 : 1.08);
        const reach = 0.1 + (1 - edge) * 0.22 + (pass ? 0.04 : 0);
        const y = g.H * reach * rand();
        ctx.beginPath();
        ctx.ellipse(x, y, g.U * (3 + rand() * 6), g.U * (2 + rand() * 4), 0, 0, 6.3);
        ctx.fill();
      }
    }
  }

  // ---- lanterns and gate ---------------------------------------------------

  function paintLantern(ctx, g, sky, p, lat, z, lit) {
    const u = p.S / z;
    const cx = xAt(p, lat, z);
    const gy = yAt(p, z);
    const stone = mixColor(mixColor(rgb('#9aa0a6'), sky.amb, 0.2), rgb('#1c2236'), sky.night * 0.7);
    const shade = mixColor(stone, rgb('#10141c'), 0.4);
    const box = (w, h, y, col) => {
      ctx.fillStyle = hex(col);
      ctx.fillRect(cx - (w * u) / 2, gy - (y + h) * u, w * u, h * u);
    };
    box(0.58, 0.14, 0, shade);
    box(0.4, 0.1, 0.14, stone);
    box(0.2, 0.62, 0.24, stone);
    box(0.5, 0.08, 0.86, shade);
    // fire box with a warm opening
    box(0.46, 0.4, 0.94, stone);
    const glow = mixColor(rgb('#f0b050'), rgb('#ffd890'), lit);
    box(0.24, 0.24, 1.02, mixColor(mixColor(stone, rgb('#222'), 0.3), glow, lit));
    // roof: wide lower slab, narrower cap, jewel
    box(0.96, 0.1, 1.34, stone);
    box(0.7, 0.1, 1.44, shade);
    box(0.4, 0.1, 1.54, stone);
    box(0.14, 0.14, 1.64, shade);
  }

  function paintLanterns(ctx, g, sky, p, lit, nearSide) {
    for (const z of LANTERN_Z) {
      if ((z < SPLIT_Z) !== nearSide) continue;
      paintLantern(ctx, g, sky, p, -1.5, z, lit);
      paintLantern(ctx, g, sky, p, 1.5, z, lit);
    }
  }

  function paintGate(ctx, g, sky, p) {
    const vermilion = mixColor(mixColor(rgb('#b8412c'), sky.amb, 0.15), rgb('#2a1822'), sky.night * 0.55);
    const black = mixColor(rgb('#1c1c22'), sky.haze, 0.2);
    const u = p.S / GATE_Z;
    const cx = p.vx;
    const gy = yAt(p, GATE_Z);
    const h = 3.4 * u;
    const reach = 1.5 * u;
    ctx.fillStyle = hex(vermilion);
    ctx.fillRect(cx - reach - 0.25 * u, gy - h, 0.5 * u, h);
    ctx.fillRect(cx + reach - 0.25 * u, gy - h, 0.5 * u, h);
    ctx.fillRect(cx - reach - 0.9 * u, gy - h * 0.78, reach * 2 + 1.8 * u, 0.28 * u);
    ctx.fillStyle = hex(black);
    ctx.fillRect(cx - reach - 1.2 * u, gy - h * 1.04, reach * 2 + 2.4 * u, 0.4 * u);
    ctx.fillRect(cx - reach - 0.95 * u, gy - h * 1.0 + 0.4 * u, reach * 2 + 1.9 * u, 0.12 * u);
  }

  // ---- bake ---------------------------------------------------------------

  function litAmount(sky) {
    return clamp(0.3 + sky.night * 0.9, 0, 1);
  }

  function paintBack(g, sky, lit) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const p = geo(g);
    ctx.drawImage(state.sky, 0, 0);
    paintHills(ctx, g, sky, p);
    paintForestBack(ctx, g, sky, p);
    paintTrunks(ctx, g, sky, p, state.trunks, false);
    paintStairs(ctx, g, sky, p, lit);
    paintGate(ctx, g, sky, p);
    paintLanterns(ctx, g, sky, p, lit, false);
    return c;
  }

  function paintFront(g, sky, lit, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const p = geo(g);
    paintTrunks(ctx, g, sky, p, state.trunks, true);
    paintLanterns(ctx, g, sky, p, lit, true);
    paintCanopy(ctx, g, sky, rand);
    return c;
  }

  function paintMistTexture(w, h, tint, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const density = (x, y) => fbm(x * 0.012, y * 0.045, 4, seed);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(density(x, y), density(x - c.width, y), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = tint[0];
        img.data[i + 1] = tint[1];
        img.data[i + 2] = tint[2];
        img.data[i + 3] = smoothstep(0.42, 0.72, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintGlow() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,200,120,0.75)');
    grad.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(41);
    const lit = litAmount(sky);
    state.sky = paintSky(g, sky, rand);
    state.back = paintBack(g, sky, lit);
    state.front = paintFront(g, sky, lit, rand);
    const tint = mixColor(rgb('#dfe3e8'), sky.haze, 0.45 + sky.night * 0.3).map((v) => Math.round(v));
    state.mistA = paintMistTexture(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.3), tint, 23);
    state.mistB = paintMistTexture(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.22), tint, 61);
    state.mistAlpha = 0.5 - sky.night * 0.18;
    state.lit = lit;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion -------------------------------------------------------------

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const p = state.p;
    const a = state.mistA;
    const offA = -((t * g.U * 1.1) % a.width);
    ctx.globalAlpha = Math.min(1, state.mistAlpha * amount * 0.9);
    const yA = p.vy - g.H * 0.04;
    ctx.drawImage(a, offA, yA);
    ctx.drawImage(a, offA + a.width, yA);
    ctx.globalAlpha = 1;
  }

  function drawLowMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const b = state.mistB;
    const off = -((t * g.U * 1.9) % b.width);
    const y = state.p.vy + g.H * 0.2;
    ctx.globalAlpha = Math.min(1, state.mistAlpha * amount * 0.7);
    ctx.drawImage(b, off, y);
    ctx.drawImage(b, off + b.width, y);
    ctx.globalAlpha = 1;
  }

  // Lantern flames breathe a little; never flash.
  function drawGlows(ctx, g, t) {
    const p = state.p;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < LANTERN_Z.length; i++) {
      const z = LANTERN_Z[i];
      const u = p.S / z;
      const size = u * 3.2;
      const gy = yAt(p, z) - u * 1.14;
      for (let s = -1; s <= 1; s += 2) {
        const breathe = 0.82 + 0.18 * Math.sin(t * 2.1 + i * 1.9 + s * 0.8);
        ctx.globalAlpha = state.lit * 0.7 * breathe;
        ctx.drawImage(state.glow, xAt(p, s * 1.5, z) - size / 2, gy - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawLeaves(ctx, g, t) {
    const colors = ['#b8412c', '#c9772e', '#d9a73a', '#a8341f'];
    const size = Math.max(1.5, g.U * 0.9);
    for (let i = 0; i < MAX_LEAVES; i++) {
      const ph = (t * (0.035 + (i % 3) * 0.008) + i / MAX_LEAVES) % 1;
      const x = ((i * 0.37 + 0.1) % 1) * g.W + Math.sin(t * 0.8 + i * 2.3) * g.U * 4 + ph * g.W * 0.08;
      const y = ph * g.H * 1.05 - g.H * 0.02;
      ctx.fillStyle = colors[i % colors.length];
      const flip = Math.sin(t * 2.4 + i) > 0 ? 1 : 0.5;
      ctx.fillRect(x, y, size * 1.6 * flip + 0.6, size);
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.p = geo(g);
    state.trunks = makeTrunks(K.rng(77));
    state.glow = paintGlow();
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.back, 0, 0);
    drawMist(ctx, g, t, props.mist);
    ctx.drawImage(state.front, 0, 0);
    drawGlows(ctx, g, t);
    drawLowMist(ctx, g, t, props.mist);
    if (props.leaves) drawLeaves(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, leaves: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
