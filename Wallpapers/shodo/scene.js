/*
 * 書道 Shodo — brushwork on washi. Abstract strokes only: sweeps, hooks, bars, dots
 * and open circles are laid down a few dabs at a time, rest, then soak away.
 *
 * The paper and the seal are baked once. Each stroke owns a pooled canvas; while it is
 * being written only the newest dabs are stamped onto it, after that it is one drawImage.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;

  const PAPER = ['#d9ccb0', '#e3d7bd', '#ebe1ca'];
  const FIBRE = ['#f2eadb', '#d0c2a4'];
  const INKS = ['#1f1c1a', '#2b2724', '#4a4540', '#5f5a52'];
  const SEAL = '#b8442e';
  const SEAL_PAPER = '#ead9c0';
  const POOL = 7;
  const BASE_COUNT = 3;
  const BRISTLES = 7;
  const WRITE_RATE = 0.4;
  const HOLD = 14;
  const FADE = 6;
  const GAP = 1.6;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), rot || 0, 0, TAU);
    ctx.fill();
  }

  // ---- paper and seal ------------------------------------------------------

  function paintPaper(W, H, rand) {
    const c = layer(W, H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(W, H);
    const d = img.data;
    const tones = PAPER.map(K.parseColor);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const n = K.fbm(x / 22, y / 14, 3, 7) + (rand() - 0.5) * 0.08;
        const edge = Math.min(x, W - 1 - x, y * 1.6, (H - 1 - y) * 1.6) / (H * 0.25);
        const v = n - (edge < 1 ? (1 - edge) * 0.22 : 0);
        const ink = tones[v < 0.4 ? 0 : v < 0.56 ? 1 : 2];
        const i = (y * W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.lineCap = 'round';
    const fibres = Math.round(W * H / 160);
    for (let i = 0; i < fibres; i++) {
      const x = rand() * W;
      const y = rand() * H;
      const a = rand() * TAU;
      const l = 1.5 + rand() * 5;
      ctx.strokeStyle = FIBRE[rand() < 0.7 ? 0 : 1];
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5,
        x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
    return c;
  }

  function paintSeal(W, H) {
    const s = Math.max(5, Math.round(H * 0.075));
    const c = layer(s + 2, s + 2);
    const ctx = c.getContext('2d');
    ctx.fillStyle = SEAL;
    ctx.fillRect(1, 1, s, s);
    const m = Math.max(1, Math.round(s * 0.18));
    const w = Math.max(1, Math.round(s * 0.12));
    ctx.fillStyle = SEAL_PAPER;
    ctx.fillRect(1 + m, 1 + m, s - 2 * m, s - 2 * m);
    ctx.fillStyle = SEAL;
    ctx.fillRect(1 + m + w, 1 + m + w, s - 2 * (m + w), s - 2 * (m + w));
    ctx.fillStyle = SEAL_PAPER;
    blob(ctx, 1 + s * 0.5, 1 + s * 0.5, s * 0.1, s * 0.1);
    return { c, x: Math.round(W * 0.9 - s), y: Math.round(H * 0.84 - s) };
  }

  // ---- stroke shapes -------------------------------------------------------

  const P = { x: 0, y: 0 };

  function bezierAt(S, s) {
    const u = 1 - s;
    const a = u * u * u, b = 3 * u * u * s, c = 3 * u * s * s, d = s * s * s;
    P.x = a * S.x0 + b * S.x1 + c * S.x2 + d * S.x3;
    P.y = a * S.y0 + b * S.y1 + c * S.y2 + d * S.y3;
  }

  function pointAt(S, s) {
    if (S.arc) {
      const a = S.a0 + S.sweep * s;
      const r = S.r * (1 + 0.06 * Math.sin(s * 5 + S.seed));
      P.x = S.x0 + Math.cos(a) * r;
      P.y = S.y0 + Math.sin(a) * r * S.squash;
    } else {
      bezierAt(S, s);
    }
  }

  function pressure(S, s) {
    const press = Math.min(1, 0.45 + s * 7);
    const lift = S.arc ? 1 - s * 0.75 : 1 - Math.pow(s, 1.6) * 0.85;
    return S.w * press * lift;
  }

  function shapeSweep(S, rand, cx, cy, L) {
    const dir = rand() < 0.5 ? 1 : -1;
    S.x0 = cx - L * 0.45 * dir; S.y0 = cy - L * 0.3;
    S.x1 = cx - L * 0.1 * dir; S.y1 = cy - L * (0.35 - rand() * 0.2);
    S.x2 = cx + L * 0.15 * dir; S.y2 = cy + L * (0.05 + rand() * 0.2);
    S.x3 = cx + L * 0.5 * dir; S.y3 = cy + L * (0.25 + rand() * 0.15);
  }

  function shapeBar(S, rand, cx, cy, L) {
    const rise = (rand() - 0.6) * L * 0.12;
    S.x0 = cx - L * 0.5; S.y0 = cy + rise;
    S.x1 = cx - L * 0.15; S.y1 = cy - L * 0.06;
    S.x2 = cx + L * 0.25; S.y2 = cy - L * 0.04 - rise;
    S.x3 = cx + L * 0.48; S.y3 = cy + L * (0.06 + rand() * 0.12);
  }

  function shapeDrop(S, rand, cx, cy, L) {
    const lean = (rand() - 0.5) * L * 0.3;
    S.x0 = cx; S.y0 = cy - L * 0.5;
    S.x1 = cx + lean * 0.3; S.y1 = cy - L * 0.1;
    S.x2 = cx - lean * 0.2; S.y2 = cy + L * 0.25;
    S.x3 = cx + lean; S.y3 = cy + L * 0.5;
  }

  function shapeHook(S, rand, cx, cy, L) {
    S.x0 = cx - L * 0.1; S.y0 = cy - L * 0.5;
    S.x1 = cx + L * 0.05; S.y1 = cy + L * 0.25;
    S.x2 = cx + L * 0.05; S.y2 = cy + L * 0.5;
    S.x3 = cx - L * (0.3 + rand() * 0.15); S.y3 = cy + L * 0.3;
  }

  function shapeCircle(S, rand, cx, cy, L) {
    S.arc = true;
    S.x0 = cx; S.y0 = cy;
    S.r = L * 0.42;
    S.squash = 0.9 + rand() * 0.15;
    S.a0 = -Math.PI * (0.35 + rand() * 0.4);
    S.sweep = TAU * (0.78 + rand() * 0.12);
  }

  const SHAPES = [shapeSweep, shapeDrop, shapeHook, shapeCircle, shapeSweep, shapeBar];

  // ---- stroke pool ---------------------------------------------------------

  function makePool(W, H) {
    const pool = [];
    for (let i = 0; i < POOL; i++) {
      pool.push({ c: layer(W, H), live: false, arc: false, age: 0, done: 0, len: 1, seed: 0,
        x0: 0, y0: 0, x1: 0, y1: 0, x2: 0, y2: 0, x3: 0, y3: 0, r: 0, squash: 1, a0: 0, sweep: 0,
        w: 1, fadeAt: Infinity, ink: INKS[0], dry: 0.5, slot: 0, write: 1 });
    }
    return pool;
  }

  function slotFree(pool, slot) {
    for (let i = 0; i < pool.length; i++) {
      const S = pool[i];
      if (S.live && S.slot === slot && S.age < fadeStart(S, state.linger) + FADE * 0.45) return false;
    }
    return true;
  }

  function pickSlot(pool, rand) {
    const start = Math.floor(rand() * state.slots.length);
    for (let k = 0; k < state.slots.length; k++) {
      const s = (start + k) % state.slots.length;
      if (slotFree(pool, s)) return s;
    }
    return -1;
  }

  function measure(S) {
    let len = 0;
    pointAt(S, 0);
    let px = P.x, py = P.y;
    for (let i = 1; i <= 24; i++) {
      pointAt(S, i / 24);
      len += Math.hypot(P.x - px, P.y - py);
      px = P.x; py = P.y;
    }
    return len;
  }

  function circleLive() {
    const pool = state.pool;
    for (let i = 0; i < pool.length; i++) if (pool[i].live && pool[i].arc) return true;
    return false;
  }

  function spawn(S, slot, rand, H) {
    const sl = state.slots[slot];
    const L = H * (0.42 + rand() * 0.2);
    S.arc = false;
    S.slot = slot;
    S.seed = rand() * 100;
    let shape = SHAPES[Math.floor(rand() * SHAPES.length)];
    if (shape === shapeCircle && circleLive()) shape = shapeSweep;
    shape(S, rand, sl.x + (rand() - 0.5) * sl.jx, sl.y + (rand() - 0.5) * sl.jy, L);
    S.len = measure(S);
    S.w = H * (0.022 + rand() * 0.022);
    S.ink = INKS[rand() < 0.65 ? Math.floor(rand() * 2) : 2 + Math.floor(rand() * 2)];
    S.dry = 0.35 + rand() * 0.35;
    S.write = S.len / (H * WRITE_RATE);
    S.age = 0;
    S.done = 0;
    S.fadeAt = Infinity;
    S.live = true;
    S.c.getContext('2d').clearRect(0, 0, S.c.width, S.c.height);
  }

  function dab(ctx, S, s) {
    pointAt(S, s);
    const x = P.x, y = P.y;
    pointAt(S, Math.min(1, s + 0.01));
    let tx = P.x - x, ty = P.y - y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    const w = pressure(S, s);
    const dryness = s < S.dry ? 0 : (s - S.dry) / (1 - S.dry);
    if (dryness <= 0.05) {
      blob(ctx, x, y, w, w * 0.8, Math.atan2(ty, tx));
      return;
    }
    const step = Math.floor(s * S.len / 2.5);
    const bw = Math.max(0.5, w / BRISTLES * 1.4);
    for (let k = 0; k < BRISTLES; k++) {
      const keep = K.hash2(k, step, S.seed) * 0.6 + K.hash2(k, 0, S.seed) * 0.6;
      if (keep < dryness) continue;
      const off = (k / (BRISTLES - 1) - 0.5) * 2 * w * 0.9;
      blob(ctx, x - ty * off, y + tx * off, bw, bw);
    }
  }

  function inkTo(S, target) {
    const ctx = S.c.getContext('2d');
    ctx.fillStyle = S.ink;
    const spacing = Math.max(0.35, S.w * 0.18) / S.len;
    let s = S.done;
    if (s === 0) {
      dab(ctx, S, 0);
      blob(ctx, P.x, P.y, S.w * 1.15, S.w * 1.0, S.seed);
    }
    while (s + spacing <= target) {
      s += spacing;
      dab(ctx, S, s);
    }
    if (target >= 1 && s < 1) {
      s = 1;
      dab(ctx, S, s);
    }
    S.done = s;
  }

  function fadeStart(S, linger) {
    return Math.min(S.fadeAt, S.write + HOLD * linger);
  }

  function alphaOf(S, linger) {
    const end = fadeStart(S, linger);
    if (S.age <= end) return 1;
    const f = (S.age - end) / FADE;
    return f >= 1 ? 0 : 1 - f * f * (3 - 2 * f);
  }

  function makeSlots(W, H) {
    const cols = W / H > 1.4 ? 3 : 2;
    const slots = [];
    for (let i = 0; i < cols; i++) {
      slots.push({ x: W * (0.14 + 0.72 * (i + 0.5) / cols), y: H * (i % 2 ? 0.56 : 0.44), jx: W * 0.25 / cols, jy: H * 0.1 });
    }
        return slots;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const W = api.cols;
    const H = api.rows;
    const rand = K.rng(api.seed);
    state.W = W;
    state.H = H;
    state.rand = rand;
    state.paper = paintPaper(W, H, rand);
    state.seal = paintSeal(W, H);
    state.slots = makeSlots(W, H);
    state.pool = makePool(W, H);
    state.wait = 0;
    const linger = api.props.linger;
    state.linger = linger;
    const first = Math.max(1, Math.round(BASE_COUNT * api.props.strokes));
    for (let i = 0; i < Math.min(first, POOL); i++) {
      const slot = pickSlot(state.pool, rand);
      if (slot < 0) break;
      const S = state.pool[i];
      spawn(S, slot, rand, H);
      S.age = (i / first) * (S.write + HOLD * linger) + rand();
      inkTo(S, Math.min(1, S.age / S.write));
    }
  }

  function age(dt, linger) {
    const pool = state.pool;
    let writing = false;
    for (let i = 0; i < pool.length; i++) {
      const S = pool[i];
      if (!S.live) continue;
      S.age += dt;
      if (S.done < 1) {
        inkTo(S, Math.min(1, S.age / S.write));
        writing = true;
      }
      if (S.age >= fadeStart(S, linger) + FADE) S.live = false;
    }
    return writing;
  }

  function retireOldest(linger, want) {
    const pool = state.pool;
    let standing = 0, oldest = null;
    for (let i = 0; i < pool.length; i++) {
      const S = pool[i];
      if (!S.live || S.age > fadeStart(S, linger)) continue;
      standing++;
      if (!oldest || S.age > oldest.age) oldest = S;
    }
    if (oldest && standing >= want) oldest.fadeAt = oldest.age;
  }

  function step(dt, linger, want) {
    const writing = age(dt, linger);
    state.wait -= dt;
    if (writing || state.wait > 0) return;
    retireOldest(linger, want);
    const pool = state.pool;
    for (let i = 0; i < pool.length; i++) {
      if (pool[i].live) continue;
      const slot = pickSlot(pool, state.rand);
      if (slot < 0) break;
      spawn(pool[i], slot, state.rand, state.H);
      state.wait = GAP * (0.6 + state.rand() * 0.8);
      return;
    }
    state.wait = 0.4;
  }

  function draw(ctx, t, dt, api) {
    const { strokes, linger, seal } = api.props;
    const want = Math.max(1, Math.min(POOL, Math.round(BASE_COUNT * strokes)));
    state.linger = linger;
    step(Math.min(dt, 0.1), linger, want);
    ctx.drawImage(state.paper, 0, 0);
    const pool = state.pool;
    for (let i = 0; i < pool.length; i++) {
      const S = pool[i];
      if (!S.live) continue;
      ctx.globalAlpha = alphaOf(S, linger);
      ctx.drawImage(S.c, 0, 0);
    }
    ctx.globalAlpha = 1;
    if (seal) ctx.drawImage(state.seal.c, state.seal.x, state.seal.y);
  }

  Kasuri.run({
    defaults: { strokes: 1, linger: 1, seal: true, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
