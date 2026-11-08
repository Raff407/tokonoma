/*
 * 砂丘 Sakyu — great dunes on the Japan Sea coast, a clear windy afternoon.
 *
 * The sky, the sea and three dunes are baked once from a few spline curves in
 * flat tones. Per draw: a sliding cloud layer, a few dozen sand veils off the
 * crests, skimming grains, sea glints and the walkers on the far ridge.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep, parseColor } = K;

  const SEA_TOP = 0.355;
  const VANISH = 0.41;
  const VEIL_POINTS = 8;
  const WALK_FROM = 0.05;
  const WALK_SPAN = 0.25;
  const WALKER_SLOTS = [0, 0.08, 0.17, 0.23, 0.36, 0.44, 0.55];
  const SAND = '#f6e8c8';
  const INK = '#2e2b36';

  // Curves are [u, v] pairs as fractions of the canvas; crests are [y, x].
  const FAR_A = {
    top: [[-0.02, 0.4], [0.08, 0.368], [0.18, 0.342], [0.28, 0.33], [0.36, 0.338], [0.44, 0.372], [0.52, 0.43], [0.6, 0.49], [0.7, 0.53]],
    crest: [[0.33, 0.288], [0.37, 0.31], [0.42, 0.335], [0.48, 0.352], [0.56, 0.36]],
    lit: ['#c9ad85', '#d6bd96', '#e2cda8', '#ecdcbc', '#f3e8d0'],
    shade: ['#8c7a84', '#9a8689', '#a8938f'],
    base: 0.62, ripple: 0.12, foot: 0.6, rim: 0.32,
  };
  const FAR_B = {
    top: [[-0.02, 0.72], [0.3, 0.62], [0.4, 0.5], [0.5, 0.462], [0.62, 0.452], [0.74, 0.444], [0.86, 0.45], [1.02, 0.442]],
    lit: ['#c2a073', '#cfb083', '#dbc095', '#e6d0aa', '#efdfbf'],
    shade: ['#8c7a84'],
    base: 0.6, ripple: 0.14, foot: 0.5, rim: 0.36,
  };
  const HERO = {
    top: [[-0.02, 0.625], [0.14, 0.588], [0.3, 0.548], [0.42, 0.514], [0.5, 0.5], [0.58, 0.508], [0.72, 0.53], [0.88, 0.548], [1.02, 0.556]],
    crest: [[0.5, 0.5], [0.56, 0.528], [0.64, 0.562], [0.74, 0.558], [0.84, 0.522], [0.94, 0.53], [1.04, 0.6]],
    lit: ['#ad7f48', '#bf9157', '#cea468', '#dbb77c', '#e6c891', '#efd8aa', '#f6e8c8'],
    shade: ['#665060', '#755c67', '#86686c', '#987572', '#aa8579', '#bb9682'],
  };

  const state = {};
  let px = 0;
  let py = 0;

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  // Smooth curve through sorted [u, v] points, Catmull-Rom style slopes.
  function spline(pts, u) {
    let i = 0;
    while (i < pts.length - 2 && u > pts[i + 1][0]) i++;
    const a = pts[i];
    const b = pts[i + 1];
    const before = pts[Math.max(0, i - 1)];
    const after = pts[Math.min(pts.length - 1, i + 2)];
    const span = b[0] - a[0];
    const m0 = ((b[1] - before[1]) / (b[0] - before[0])) * span;
    const m1 = ((after[1] - a[1]) / (after[0] - a[0])) * span;
    const f = clamp01((u - a[0]) / span);
    const f2 = f * f;
    const f3 = f2 * f;
    return (2 * f3 - 3 * f2 + 1) * a[1] + (f3 - 2 * f2 + f) * m0 + (-2 * f3 + 3 * f2) * b[1] + (f3 - f2) * m1;
  }

  function table(n, scale, fn) {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = fn((i + 0.5) / n) * scale;
    return out;
  }

  function crestTable(g, pts) {
    const lo = pts[0][0];
    const hi = pts[pts.length - 1][0];
    return table(g.H, 1, (v) => (v < lo ? g.W * 4 : spline(pts, Math.min(v, hi)) * g.W));
  }

  function curveTables(g) {
    return {
      farA: table(g.W, g.H, (u) => spline(FAR_A.top, u)),
      farACrest: crestTable(g, FAR_A.crest),
      farB: table(g.W, g.H, (u) => spline(FAR_B.top, u)),
      hero: table(g.W, g.H, (u) => spline(HERO.top, u)),
      heroCrest: crestTable(g, HERO.crest),
      none: new Float32Array(g.H).fill(g.W * 4),
    };
  }

  function bakeNoise(g) {
    const warp = new Float32Array(g.W * g.H);
    const mass = new Float32Array(g.W * g.H);
    const slip = new Float32Array(g.W * g.H);
    const u = g.U;
    for (let y = 0; y < g.H; y++) {
      for (let x = 0; x < g.W; x++) {
        const i = y * g.W + x;
        warp[i] = fbm(x / (u * 26), y / (u * 9), 3, 5);
        mass[i] = fbm(x / (u * 30), y / (u * 14), 2, 13) - 0.5;
        slip[i] = fbm((y * 0.86 - x * 0.5) / (u * 2.4), (x * 0.86 + y * 0.5) / (u * 26), 2, 17) - 0.5;
      }
    }
    return { warp, mass, slip };
  }

  // Lit face of the hero: perspective ripples, brightest along the crest.
  function heroLit(g, n, i, y, d, dr) {
    const u = g.U;
    const dy = Math.max(1, y - g.H * VANISH);
    const a = u * 860;
    const spacing = (dy * dy) / a;
    const phi = a / dy + n.warp[i] * 3.2 + Math.sin(dr / (u * 22)) * 0.6;
    const r = phi - Math.floor(phi);
    const amp = 0.3 * smoothstep(1.4, 3, spacing);
    const ripple = r < 0.22 ? -amp : r < 0.42 ? amp * 0.6 : 0;
    const glow = 0.18 * (1 - clamp01(dr / (u * 14))) + 0.22 * (1 - clamp01(dr / (u * 80)));
    const rim = dr < u * 0.9 || d < u * 0.7 ? 0.32 : 0;
    const haze = 0.1 * clamp01(1 - (y - g.H * VANISH) / (g.H * 0.35));
    return clamp01(0.46 + ripple + glow + rim + haze + n.mass[i] * 0.14);
  }

  // Slip face: darkest under the crest, lifted by bounce light further out.
  function heroShade(g, n, i, d, dr) {
    const u = g.U;
    if (dr < u * 0.7) return 0;
    const lift = clamp01(dr / (u * 50)) * 0.7 + clamp01(1 - d / (u * 10)) * 0.14;
    return clamp01(0.12 + lift + n.slip[i] * 0.55 + n.mass[i] * 0.22);
  }

  function farLit(spec, g, n, i, y, d) {
    const u = g.U;
    const phi = y / (u * 1.4) + n.warp[i] * 2;
    const r = phi - Math.floor(phi);
    const ripple = r < 0.35 ? -spec.ripple : 0;
    const rim = d < u * 0.8 ? spec.rim : 0;
    const foot = spec.foot * clamp01(d / (u * 10));
    return clamp01(spec.base + ripple + rim - foot + n.mass[i] * 0.3);
  }

  function farShade(g, n, i, d, dr) {
    return clamp01(0.1 + clamp01(dr / (g.U * 30)) * 0.5 + n.slip[i] * 0.4 - clamp01(d / (g.U * 14)) * 0.2);
  }

  // Fixed per-pixel jitter in -0.5..0.5, so tone steps break up like sand grain.
  function grain(i) {
    const v = Math.sin(i * 12.9898) * 43758.5453;
    return v - Math.floor(v) - 0.5;
  }

  function setPixel(data, p, rgb, alpha) {
    data[p] = rgb[0];
    data[p + 1] = rgb[1];
    data[p + 2] = rgb[2];
    data[p + 3] = alpha;
  }

  function paintDune(ctx, g, spec, top, crest, n, hero) {
    const img = ctx.createImageData(g.W, g.H);
    const lit = spec.lit.map(parseColor);
    const shade = spec.shade.map(parseColor);
    for (let x = 0; x < g.W; x++) {
      for (let y = Math.max(0, Math.floor(top[x])); y < g.H; y++) {
        const i = y * g.W + x;
        const d = y + 0.5 - top[x];
        if (d <= 0) continue;
        const dr = x + 0.5 - crest[y];
        let v;
        if (dr > 0) v = hero ? heroShade(g, n, i, d, dr) : farShade(g, n, i, d, dr);
        else v = hero ? heroLit(g, n, i, y, d, -dr) : farLit(spec, g, n, i, y, d);
        const ramp = dr > 0 ? shade : lit;
        const tone = clamp01(v + grain(i) * 0.1) * (ramp.length - 1);
        setPixel(img.data, i * 4, ramp[Math.round(tone)], d < 1 ? 255 * d : 255);
      }
    }
    const c = layer(g.W, g.H);
    c.getContext('2d').putImageData(img, 0, 0);
    ctx.drawImage(c, 0, 0);
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const y0 = g.H * SEA_TOP;
    const sky = ctx.createLinearGradient(0, 0, 0, y0);
    sky.addColorStop(0, '#3a7cc0');
    sky.addColorStop(0.45, '#4f8fcb');
    sky.addColorStop(0.8, '#8fbfdc');
    sky.addColorStop(1, '#d6e8e8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, y0 + 1);
    paintCape(ctx, g, y0);
    const sea = ctx.createLinearGradient(0, y0, 0, g.H * 0.5);
    sea.addColorStop(0, '#1d3b62');
    sea.addColorStop(1, '#2b5c7e');
    ctx.fillStyle = sea;
    ctx.fillRect(0, y0, g.W, g.H - y0);
    ctx.fillStyle = '#9dbfd0';
    ctx.globalAlpha = 0.55;
    ctx.fillRect(0, y0, g.W, Math.max(1, g.U * 0.4));
    ctx.fillStyle = '#467f9c';
    for (let i = 0; i < g.W * 0.45; i++) {
      ctx.globalAlpha = 0.3 + rand() * 0.35;
      ctx.fillRect(rand() * g.W, y0 + g.U * (1 + rand() * rand() * 12), g.U * (1 + rand() * 4), 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintCape(ctx, g, y0) {
    ctx.fillStyle = '#7f9fb8';
    ctx.beginPath();
    ctx.moveTo(g.W * 0.72, y0 + 1);
    for (let x = g.W * 0.72; x <= g.W + 2; x += 2) {
      const f = (x / g.W - 0.72) / 0.28;
      ctx.lineTo(x, y0 - g.U * (smoothstep(0, 0.6, f) * 2.4 + fbm(x / (g.U * 5), 3, 3, 31) * 1.6 * f));
    }
    ctx.lineTo(g.W + 2, y0 + 1);
    ctx.fill();
  }

  // High thin cloud in three flat tones, baked at half size and tiled.
  function paintClouds(g) {
    const w = Math.ceil(g.W * 0.75);
    const h = Math.ceil(g.H * SEA_TOP * 0.5);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const u = g.U * 0.5;
    const density = (x, y) => fbm(x / (u * 40), y / (u * 5), 3, 41);
    for (let y = 0; y < h; y++) {
      const band = smoothstep(0.95, 0.6, y / h) * smoothstep(0.02, 0.2, y / h);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const a = Math.round(smoothstep(0.5, 0.7, v) * band * 3) / 3;
        setPixel(img.data, (y * w + x) * 4, [246, 248, 244], a * 230);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function trailPoint(g, f) {
    const a = [g.W * 0.27, g.H * 1.03];
    const b = [g.W * 0.37, g.H * 0.7];
    const c = [g.W * 0.475, g.H * 0.575];
    const k = 1 - f;
    return [k * k * a[0] + 2 * k * f * b[0] + f * f * c[0], k * k * a[1] + 2 * k * f * b[1] + f * f * c[1]];
  }

  // A line of footprints climbing the lit face to the crest.
  function paintTrail(ctx, g) {
    const near = g.H * (1 - VANISH);
    ctx.fillStyle = '#8a5f38';
    let f = 0;
    let side = 1;
    while (f < 1) {
      const [x, y] = trailPoint(g, f);
      const s = Math.max(0.12, (y - g.H * VANISH) / near);
      ctx.globalAlpha = 0.3 + s * 0.4;
      ctx.beginPath();
      ctx.ellipse(x + side * g.U * 0.9 * s, y, Math.max(0.6, g.U * 1.5 * s), Math.max(0.5, g.U * 0.7 * s), 0, 0, 6.3);
      ctx.fill();
      side = -side;
      f += (g.U * 3.6 * s) / (g.H * 0.6);
    }
    ctx.globalAlpha = 1;
  }

  function paintWorld(g, rand, n, t) {
    state.back = paintBack(g, rand);
    state.clouds = paintClouds(g);
    const far = layer(g.W, g.H);
    paintDune(far.getContext('2d'), g, FAR_A, t.farA, t.farACrest, n, false);
    state.far = far;
    const near = layer(g.W, g.H);
    const ctx = near.getContext('2d');
    paintDune(ctx, g, FAR_B, t.farB, t.none, n, false);
    paintDune(ctx, g, HERO, t.hero, t.heroCrest, n, true);
    paintTrail(ctx, g);
    state.near = near;
  }

  function veil(rand, x, y, arc, s, shape) {
    return {
      x, y, arc,
      len: shape.len * s * (0.6 + rand() * 0.8),
      lift: shape.lift * s * (0.5 + rand()),
      drop: shape.drop * s * (0.6 + rand() * 0.8),
      amp: shape.amp * s * (0.5 + rand()),
      wide: Math.max(0.8, shape.wide * s),
      alpha: shape.alpha * (0.6 + rand() * 0.5),
      freq: 3 + rand() * 4,
      phase: rand() * 6.28,
      rate: 0.1 + rand() * 0.1,
      start: rand(),
    };
  }

  function makeVeils(g, rand, t) {
    const u = g.U;
    const list = [];
    const near = g.H * (1 - VANISH);
    const heroShape = { len: u * 34, lift: u * 2.4, drop: u * 9, amp: u * 1.4, wide: u * 2.6, alpha: 0.85 };
    const farShape = { len: u * 16, lift: u * 1.4, drop: u * 4, amp: u * 0.6, wide: u * 1.6, alpha: 0.7 };
    for (let i = 0; i < 44; i++) {
      const f = Math.pow(i / 43, 1.25);
      const row = Math.min(g.H - 1, Math.floor(lerp(0.505, 0.98, f) * g.H));
      const s = 0.3 + 0.7 * ((row - g.H * VANISH) / near);
      list.push(veil(rand, t.heroCrest[row], row, f, s, heroShape));
    }
    for (let i = 0; i < 12; i++) {
      const f = i / 11;
      const row = Math.floor(lerp(0.335, 0.47, f) * g.H);
      list.push(veil(rand, t.farACrest[row], row, f * 0.5, 0.7, farShape));
    }
    for (let i = 0; i < 8; i++) {
      const col = Math.floor(lerp(0.12, 0.27, i / 7) * g.W);
      list.push(veil(rand, col, t.farA[col] + 0.5, 0.6 + i * 0.05, 0.5, farShape));
    }
    return list;
  }

  // Grains hopping across the lit face toward the crest.
  function makeSkims(g, rand) {
    const u = g.U;
    const near = g.H * (1 - VANISH);
    const list = [];
    for (let i = 0; i < 130; i++) {
      const y = g.H * lerp(0.56, 1, Math.sqrt(rand()));
      const s = (y - g.H * VANISH) / near;
      list.push({
        y,
        len: Math.max(1, u * (1 + rand() * 3) * s),
        rate: u * (2.5 + rand() * 3) * s,
        start: rand() * g.W,
        alpha: 0.25 + rand() * 0.4,
      });
    }
    return list;
  }

  function makeWalkers(g, rand) {
    const coats = [INK, INK, '#b8452c', INK, '#34507a', INK, INK];
    return WALKER_SLOTS.map((slot, i) => ({
      slot: slot + (rand() - 0.5) * 0.01,
      tall: g.U * (5.2 + rand() * 0.8),
      phase: rand() * 6.28,
      coat: coats[i],
      pack: i % 3 === 1,
    }));
  }

  function makeGlints(g, rand) {
    const list = [];
    for (let i = 0; i < 60; i++) {
      list.push({
        x: rand() * g.W,
        y: g.H * SEA_TOP + g.U * (1 + rand() * 9),
        w: Math.max(1, g.U * (0.8 + rand() * 2.4)),
        rate: 0.25 + rand() * 0.35,
        phase: rand() * 6.28,
      });
    }
    return list;
  }

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const w = g.W * 1.5;
    const off = (t * g.U * 0.4) % w;
    ctx.globalAlpha = amount;
    ctx.drawImage(state.clouds, off, 0, w, g.H * SEA_TOP);
    ctx.drawImage(state.clouds, off - w, 0, w, g.H * SEA_TOP);
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, g, t) {
    ctx.fillStyle = '#b9d6da';
    for (const s of state.glints) {
      const a = Math.sin(t * s.rate + s.phase);
      if (a <= 0.3) continue;
      ctx.globalAlpha = (a - 0.3) * 0.6;
      ctx.fillRect(s.x + Math.sin(t * 0.07 + s.phase) * g.U, s.y, s.w, 1);
    }
    ctx.globalAlpha = 1;
  }

  // A small figure on the skyline, kept to whole pixels so it stays crisp:
  // head, a gap for the neck, coat, and two legs that scissor as it walks.
  function drawWalker(ctx, g, w, t) {
    const span = g.W * WALK_SPAN;
    const f = ((t * g.U * 0.22) / span + w.slot) % 1;
    const fade = smoothstep(0, 0.07, f) * smoothstep(1, 0.88, f);
    if (fade <= 0) return;
    const x = Math.round(g.W * WALK_FROM + f * span);
    const y = Math.round(state.tables.farA[Math.min(g.W - 1, x)] + g.U * 0.5);
    const p = Math.max(1, Math.round(w.tall / 8));
    const leg = p * 3;
    const swing = Math.round(Math.sin(t * 2 + w.phase) * p * 1.2);
    ctx.globalAlpha = fade;
    ctx.fillStyle = INK;
    ctx.fillRect(x + swing, y - leg, p, leg);
    ctx.fillRect(x - swing, y - leg, p, leg);
    ctx.fillStyle = w.coat;
    ctx.fillRect(x - p * 0.5, y - leg - p * 3, p * 2, p * 3);
    ctx.fillStyle = INK;
    ctx.fillRect(x, y - leg - p * 5.4, p * 1.4, p * 1.8);
    if (w.pack) ctx.fillRect(x - p * 1.4, y - leg - p * 2.8, p, p * 1.8);
  }

  function veilPoint(s, f, t) {
    px = s.x + f * s.len;
    py = s.y - Math.sin(Math.min(1, f * 1.8) * 2.2) * s.lift + f * f * s.drop + Math.sin(f * s.freq - t * 0.8 + s.phase) * s.amp * f;
  }

  function traceVeil(ctx, s, t, tail, head) {
    ctx.beginPath();
    for (let k = 0; k <= VEIL_POINTS; k++) {
      veilPoint(s, lerp(tail, head, k / VEIL_POINTS), t);
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function gust(arc, t) {
    return 0.35 + 0.65 * smoothstep(0.2, 0.8, 0.5 + 0.5 * Math.sin(arc * 6 - t * 0.33) * Math.sin(t * 0.11 + arc * 2.1));
  }

  function drawVeils(ctx, g, t, amount) {
    if (amount <= 0) return;
    ctx.strokeStyle = SAND;
    ctx.lineCap = 'round';
    for (const s of state.veils) {
      const life = (t * s.rate + s.start) % 1;
      const fade = Math.sin(life * Math.PI) * gust(s.arc, t) * amount * s.alpha;
      const head = Math.min(1, life * 1.5);
      const tail = Math.max(0, life * 1.5 - 0.6);
      ctx.globalAlpha = Math.min(1, fade * 0.35);
      ctx.lineWidth = s.wide;
      traceVeil(ctx, s, t, tail, head);
      ctx.globalAlpha = Math.min(1, fade);
      ctx.lineWidth = Math.max(0.8, s.wide * 0.32);
      traceVeil(ctx, s, t, tail, head);
    }
    ctx.globalAlpha = 1;
  }

  function drawSkims(ctx, g, t, amount) {
    if (amount <= 0) return;
    const crest = state.tables.heroCrest;
    ctx.fillStyle = SAND;
    for (const s of state.skims) {
      const row = Math.min(g.H - 1, Math.floor(s.y));
      const span = crest[row];
      const f = ((t * s.rate + s.start) % span) / span;
      ctx.globalAlpha = Math.min(1, s.alpha * amount * Math.sin(f * Math.PI));
      ctx.fillRect(f * span - s.len, s.y, s.len, 1);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.tables = curveTables(g);
    paintWorld(g, rand, bakeNoise(g), state.tables);
    state.veils = makeVeils(g, rand, state.tables);
    state.skims = makeSkims(g, rand);
    state.walkers = makeWalkers(g, rand);
    state.glints = makeGlints(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    ctx.drawImage(state.back, 0, 0);
    drawClouds(ctx, g, t, api.props.clouds);
    drawGlints(ctx, g, t);
    ctx.drawImage(state.far, 0, 0);
    for (const w of state.walkers) drawWalker(ctx, g, w, t);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.near, 0, 0);
    drawSkims(ctx, g, t, api.props.wind);
    drawVeils(ctx, g, t, api.props.wind);
  }

  Kasuri.run({
    defaults: { wind: 1, clouds: 1, ramp: 'lines', cell: 7, boost: 0.1, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
