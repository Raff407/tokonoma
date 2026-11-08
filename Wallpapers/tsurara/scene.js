/*
 * 氷柱 Tsurara — long icicles under a snow-laden thatched eave, late winter, full sun.
 *
 * The eave crosses the top of the picture on a slight slant, the ice hangs against
 * a deep blue sky, and a bank of roof snow catches the drips below. Everything still
 * is baked once; glints, drops, sparkles and snow slides are a few hundred rects.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, noise2, lerp, smoothstep } = K;

  const ICE = ['#4d7cbc', '#7eabda', '#b3d5ef', '#e2f1fa', '#ffffff'];
  const THATCH = ['#4a3726', '#634a31', '#80613c', '#9f7f4c', '#bf9d60', '#d8bb7e'];
  // Fixed places along the eave: f across the width, len and half width w in U.
  const HEROES = [
    { f: 0.05, len: 20, w: 2.6 }, { f: 0.125, len: 33, w: 3.4 }, { f: 0.215, len: 47, w: 4.8 },
    { f: 0.29, len: 26, w: 3.0 }, { f: 0.37, len: 39, w: 4.0 }, { f: 0.465, len: 16, w: 2.4 },
    { f: 0.545, len: 29, w: 3.2 }, { f: 0.635, len: 43, w: 4.4 }, { f: 0.715, len: 22, w: 2.8 },
    { f: 0.805, len: 35, w: 3.6 }, { f: 0.885, len: 18, w: 2.5 }, { f: 0.955, len: 28, w: 3.0 },
  ];
  const SLIDE_SPOTS = [0.33, 0.76, 0.12, 0.58, 0.9, 0.43, 0.26, 0.68];
  const SLIDE_EVERY = 6.5;
  const PUFF = 40;
  const PUFF_DELAY = 0.6;
  const POWDER_FADE = 2.5;
  const CREEP = 0.9;
  const GRAVITY = 90;
  const SPLASH = 0.8;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // The eave is nearer on the left, so it sits lower and thicker there.
  const fx = (g, x) => x / g.W;
  const near = (g, x) => lerp(1.1, 0.82, fx(g, x));
  const eaveY = (g, x) => g.H * (0.36 - 0.07 * fx(g, x)) + Math.sin(x / (g.U * 13)) * g.U * 0.8;
  const thatchTop = (g, x) => eaveY(g, x) - g.U * (23 - 7 * fx(g, x));
  const dripY = (g, x) => g.H * (0.885 - 0.035 * fx(g, x));

  function fillBetween(ctx, g, top, bottom, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(-2, top(-2));
    for (let x = 0; x <= g.W + 2; x += 1) ctx.lineTo(x, top(x));
    for (let x = g.W + 2; x >= -2; x -= 1) ctx.lineTo(x, bottom(x));
    ctx.fill();
  }

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.72);
    sky.addColorStop(0, '#2a5fb2');
    sky.addColorStop(0.5, '#3977c6');
    sky.addColorStop(0.82, '#6aa2da');
    sky.addColorStop(1, '#a6cbec');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  // Thin streaks of high cloud, baked at half size; each end blends into the other.
  function paintCloud(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x * 0.045, y * 0.32, 4, 41);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = smoothstep(0.52, 0.74, lerp(f(x, y), f(x - w, y), x / w)) * band;
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 244;
        img.data[i + 3] = (Math.round(v * 3) / 3) * 105;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // One snow peak to the right of centre, lit from the left, a long low shoulder.
  function paintMountains(ctx, g) {
    const ridge = (x) => {
      const f = fx(g, x);
      const lift = 0.15 * Math.exp(-Math.pow((f - 0.7) / 0.13, 2)) + 0.05 * Math.exp(-Math.pow((f - 0.25) / 0.2, 2));
      return g.H * (0.67 - lift) - fbm(x * 0.08 / g.U, 2, 3, 8) * g.U * 2.5;
    };
    const base = g.H * 0.8;
    fillBetween(ctx, g, ridge, () => base, '#e6eef7');
    const peak = g.W * 0.7;
    ctx.fillStyle = '#a7c4e5';
    ctx.beginPath();
    ctx.moveTo(peak, ridge(peak));
    for (let x = peak; x <= g.W + 2; x += 1) ctx.lineTo(x, ridge(x));
    ctx.lineTo(g.W + 2, base);
    for (let y = base; y >= ridge(peak); y -= 1) {
      const k = (base - y) / (base - ridge(peak));
      ctx.lineTo(peak - (1 - k) * g.W * 0.03 + Math.sin(y * 0.9 / g.U) * g.U * 0.8, y);
    }
    ctx.fill();
    ctx.strokeStyle = '#c4d8ee';
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    for (let i = 1; i < 4; i++) {
      const x = peak + g.W * 0.035 * i;
      ctx.beginPath();
      ctx.moveTo(x, ridge(x) + g.U);
      ctx.lineTo(x - g.U * 2, base);
      ctx.stroke();
    }
  }

  // A belt of cedars along the far edge of the field, dark so the ice reads in front.
  function paintCedar(ctx, g, x, foot, h) {
    const half = h * 0.24;
    ctx.fillStyle = '#2f4c4b';
    ctx.beginPath();
    ctx.moveTo(x, foot - h);
    ctx.lineTo(x + half, foot);
    ctx.lineTo(x - half, foot);
    ctx.fill();
    ctx.fillStyle = '#d6e5f0';
    for (let k = 1; k < 4; k++) {
      const y = foot - h + (h * k) / 4;
      ctx.fillRect(x - (half * k) / 4, y - g.U * 0.4, (half * k) / 4 + g.U * 0.3, Math.max(1, g.U * 0.5));
    }
  }

  function paintFarGround(ctx, g, rand) {
    paintMountains(ctx, g);
    const foot = g.H * 0.765;
    for (let x = -g.U * 3; x < g.W + g.U * 4; x += g.U * (1.6 + rand() * 2.6)) {
      const swell = smoothstep(0.3, 0.75, fbm(x * 0.03 / g.U, 2, 3, 12));
      paintCedar(ctx, g, x, foot, g.U * (3 + swell * 13 + rand() * 3));
    }
    fillBetween(ctx, g, () => foot - g.U * 0.5, () => g.H + 2, '#e2ecf4');
    fillBetween(ctx, g, () => foot - g.U * 0.5, (x) => foot + g.U * (0.4 + fbm(x * 0.06 / g.U, 4, 2, 2) * 1.6), '#bcd2e8');
  }

  // The bank of slid roof snow: sunlit top, the drip trough, a shaded front.
  function paintBank(ctx, g, rand) {
    const wob = (x) => (fbm(x * 0.06 / g.U, 3, 2, 5) - 0.5) * g.U * 1.4;
    const lip = (x) => dripY(g, x) + wob(x);
    const mound = (x) => smoothstep(0.25, 0.8, fbm(x * 0.035 / g.U, 6, 3, 14));
    const back = (x) => dripY(g, x) - g.U * near(g, x) * (3 + mound(x) * 11);
    const bottom = () => g.H + 2;
    fillBetween(ctx, g, (x) => back(x) - g.U * 0.8, bottom, '#bcd3e9');
    fillBetween(ctx, g, back, bottom, '#ffffff');
    fillBetween(ctx, g, (x) => lerp(back(x), lip(x), 0.45), bottom, '#eef4f8');
    fillBetween(ctx, g, (x) => lerp(back(x), lip(x), 0.75), bottom, '#dce8f2');
    paintTrough(ctx, g, rand, lip);
    fillBetween(ctx, g, (x) => lip(x) + g.U * 1.2, bottom, '#eef4f8');
    const lower = (x) => lip(x) + g.U * (4 + fbm(x * 0.03 / g.U, 8, 2, 9) * 6);
    fillBetween(ctx, g, lower, bottom, '#d5e4f1');
    ctx.fillStyle = '#c0d5ea';
    for (let i = 0; i < g.W / (g.U * 2.5); i++) {
      const x = rand() * g.W;
      ctx.beginPath();
      ctx.ellipse(x, lower(x) + g.U * (2 + rand() * 7), g.U * (2 + rand() * 6), g.U * (0.4 + rand() * 0.6), 0, 0, 6.3);
      ctx.fill();
    }
  }

  // Where the drops land: a soft groove pocked with small holes.
  function paintTrough(ctx, g, rand, lip) {
    fillBetween(ctx, g, (x) => lip(x) - g.U * 1.4, (x) => lip(x) + g.U * 1.2, '#b3cfea');
    fillBetween(ctx, g, (x) => lip(x) - g.U * 0.5, (x) => lip(x) + g.U * 0.5, '#8db2dd');
    ctx.fillStyle = '#6593cb';
    for (let x = rand() * g.U * 2; x < g.W; x += g.U * (1.5 + rand() * 2.5)) {
      ctx.beginPath();
      ctx.ellipse(x, lip(x), g.U * (0.5 + rand() * 0.7), g.U * 0.4, 0, 0, 6.3);
      ctx.fill();
    }
  }

  function paintPit(ctx, g, x, y, s) {
    ctx.fillStyle = '#6d98cc';
    ctx.beginPath();
    ctx.ellipse(x, y, g.U * 2.4 * s, g.U * 0.95 * s, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#4c7cba';
    ctx.beginPath();
    ctx.ellipse(x + g.U * 0.3 * s, y + g.U * 0.1, g.U * 1.2 * s, g.U * 0.45 * s, 0, 0, 6.3);
    ctx.fill();
  }

  function placeIcicles(g, rand) {
    const big = HEROES.map((h) => ({ x: h.f * g.W, len: h.len, w: h.w, big: true }));
    const small = [];
    const xs = [-g.U * 2, ...big.map((h) => h.x), g.W + g.U * 2];
    for (let i = 0; i < xs.length - 1; i++) {
      let x = xs[i] + g.U * (3 + rand() * 1.5);
      while (x < xs[i + 1] - g.U * 2.5) {
        small.push({ x, len: 3 + rand() * 9, w: 0.9 + rand() * 0.9, big: false });
        x += g.U * (2.2 + rand() * 2.6);
      }
    }
    return small.concat(big).map((ic) => shapeIcicle(g, rand, ic));
  }

  // One row per canvas row: where the ice is centred and how wide it is there.
  function shapeIcicle(g, rand, ic) {
    const s = near(g, ic.x);
    const top = Math.floor(eaveY(g, ic.x) - g.U * 1.5);
    const rows = Math.max(3, Math.round(ic.len * 0.84 * g.U * s + g.U * 1.5));
    const cx = new Float32Array(rows);
    const hw = new Float32Array(rows);
    const a = rand() * 6.28;
    const b = rand() * 6.28;
    const lean = (rand() - 0.5) * g.U * 1.6;
    for (let r = 0; r < rows; r++) {
      const f = r / rows;
      const ru = r / g.U;
      const ripple = 1 + 0.12 * Math.sin(ru * 0.55 + a) + 0.05 * Math.sin(ru * 1.4 + b);
      const flare = Math.exp(-ru / 2.2) * ic.w * 0.7;
      hw[r] = Math.max(0.45, g.U * s * (ic.w * Math.pow(1 - f, 0.8) * ripple + flare));
      cx[r] = ic.x + lean * f * f + Math.sin(f * 3 + a) * g.U * 0.35 * f;
    }
    const tipX = cx[rows - 1];
    return {
      top, rows, cx, hw, s, a, b, big: ic.big, long: ic.len >= 26,
      tipX, tipY: top + rows, land: dripY(g, tipX),
      period: 5 + rand() * 6,
      offset: rand(),
      slide: 0.05 + rand() * 0.05,
      slidePhase: rand() * 1.4,
      span: Math.max(3, rows * 0.22),
      glintFrom: Math.min(rows - 2, Math.ceil(eaveY(g, ic.x) - top + g.U * 3)),
      radius: g.U * (ic.long ? 1.0 : 0.75),
    };
  }

  // Sun from the upper left: a bright stripe on the left, a blue core, shade on the right.
  function iceTone(u, r, ic, g, rand) {
    if (ic.hw[r] < 1.2) return u < 0.3 ? 4 : 3;
    const ru = r / g.U;
    let v = 0.56 - u * 0.24;
    v += Math.exp(-Math.pow(u + 0.5, 2) / 0.025) * 0.36;
    v -= Math.exp(-Math.pow(u - 0.18, 2) / 0.03) * 0.26 * (0.6 + 0.4 * Math.sin(ru * 0.4 + ic.a));
    v += 0.07 * Math.sin(ru * 1.1 + ic.b) + (rand() - 0.5) * 0.06;
    if (u > 0.72) v -= 0.28;
    return Math.max(0, Math.min(4, Math.round(v * 4)));
  }

  function paintIcicle(ctx, g, rand, ic) {
    for (let r = 0; r < ic.rows; r++) {
      const left = Math.floor(ic.cx[r] - ic.hw[r]);
      const right = Math.ceil(ic.cx[r] + ic.hw[r]);
      for (let x = left; x < right; x++) {
        const u = (x + 0.5 - ic.cx[r]) / ic.hw[r];
        if (Math.abs(u) > 1.05) continue;
        ctx.fillStyle = ICE[iceTone(Math.max(-1, Math.min(1, u)), r, ic, g, rand)];
        ctx.fillRect(x, ic.top + r, 1, 1);
      }
    }
  }

  // The cut face of the thatch: three stepped courses of reed ends, sun on each lip.
  function thatchTone(g, x, y, rand) {
    const top = thatchTop(g, x);
    const f = (y - top) / (eaveY(g, x) - top);
    const tier = (f * 2 + noise2(x * 0.06 / g.U, 1, 4) * 0.4) % 1;
    const reeds = noise2(x * 0.8, y * 0.12 / g.U, 17) - 0.5;
    let v = 0.62 - f * 0.22 + reeds * 0.34 + (rand() - 0.5) * 0.5;
    if (tier < 0.07) v -= 0.3;
    v -= smoothstep(0.82, 1, f) * 0.3;
    return THATCH[Math.max(0, Math.min(5, Math.round(v * 5)))];
  }

  // Reed ends hang in tufts from the underside, ragged rather than ruled.
  function paintThatch(ctx, g, rand) {
    for (let x = 0; x < g.W; x++) {
      const top = Math.floor(thatchTop(g, x) - g.U * 2);
      const bottom = eaveY(g, x);
      for (let y = top; y < bottom; y++) {
        ctx.fillStyle = thatchTone(g, x, y, rand);
        ctx.fillRect(x, y, 1, 1);
      }
      const tuft = fbm(x * 0.25 / g.U, 9, 2, 33);
      ctx.fillStyle = THATCH[rand() < 0.6 ? 0 : 1];
      ctx.fillRect(x, bottom - 1, 1, g.U * (0.3 + tuft * 2.6 + rand() * 0.8));
    }
  }

  // The snow on the roof bulges over the edge in soft lobes and catches the sun.
  // Close up, the roof fills the top of the frame, so its snow runs off the top edge.
  function paintCornice(ctx, g, rand) {
    const top = () => -g.U * 2;
    const hem = (x) => {
      const lobe = Math.abs(Math.sin(x / (g.U * 8 * near(g, x)) + fbm(x * 0.02 / g.U, 3, 2, 3) * 3));
      return thatchTop(g, x) + g.U * (0.5 + lobe * 2.2 + fbm(x * 0.12 / g.U, 2, 2, 19) * 1.8);
    };
    ctx.fillStyle = '#3a2c20';
    ctx.globalAlpha = 0.5;
    for (let x = 0; x < g.W; x++) ctx.fillRect(x, hem(x) - 1, 1, g.U * 2);
    ctx.globalAlpha = 1;
    fillBetween(ctx, g, top, hem, '#9fbde0');
    fillBetween(ctx, g, top, (x) => hem(x) - g.U * 1.2, '#d3e3f1');
    fillBetween(ctx, g, top, (x) => hem(x) - g.U * 2.8, '#f7fafc');
    fillBetween(ctx, g, top, (x) => top(x) + g.U * 0.9, '#ffffff');
    const drift = (x) => lerp(top(x), hem(x), 0.42) + fbm(x * 0.05 / g.U, 4, 3, 27) * g.U * 2.4;
    fillBetween(ctx, g, drift, (x) => drift(x) + g.U * 0.9, '#e4eef7');
    state.hem = hem;
  }

  function paintWorld(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintFarGround(ctx, g, rand);
    paintBank(ctx, g, rand);
    state.icicles = placeIcicles(g, rand);
    for (const ic of state.icicles) if (ic.big) paintPit(ctx, g, ic.tipX, ic.land, ic.s * (ic.long ? 1 : 0.75));
    for (const ic of state.icicles) paintIcicle(ctx, g, rand, ic);
    paintThatch(ctx, g, rand);
    paintCornice(ctx, g, rand);
    return c;
  }

  function makeSparkles(g, rand) {
    const list = [];
    for (let i = 0; i < Math.round(g.W * 0.9); i++) {
      const x = rand() * g.W;
      const onLine = rand() < 0.55;
      const y = onLine ? dripY(g, x) + (rand() - 0.5) * g.U * 3 : lerp(g.H * 0.76, g.H, rand());
      list.push({
        x: Math.round(x), y: Math.round(y),
        rate: 0.4 + rand() * 0.7, phase: rand() * 6.28,
        big: rand() < 0.2,
        colour: rand() < 0.25 ? '#fff1cc' : '#ffffff',
      });
    }
    return list;
  }

  function makeDust(g, rand) {
    const list = [];
    for (let i = 0; i < 36; i++) {
      list.push({
        x: rand() * g.W, y: rand() * g.H,
        vx: g.U * (0.4 + rand() * 0.6), vy: g.U * (0.6 + rand() * 0.9),
        phase: rand() * 6.28, rate: 0.6 + rand() * 0.8,
      });
    }
    return list;
  }

  function makePuff(rand) {
    const p = { ox: new Float32Array(PUFF), oy: new Float32Array(PUFF), delay: new Float32Array(PUFF), size: new Float32Array(PUFF) };
    for (let i = 0; i < PUFF; i++) {
      p.ox[i] = (rand() - 0.5) * 2;
      p.oy[i] = rand();
      p.delay[i] = rand() * PUFF_DELAY;
      p.size[i] = 0.6 + rand() * 1.1;
    }
    return p;
  }

  function drawSparkles(ctx, g, t, amount) {
    const arm = Math.max(1, Math.round(g.U * 0.8));
    for (const s of state.sparkles) {
      const v = Math.sin(t * s.rate + s.phase);
      if (v < 0.35) continue;
      ctx.globalAlpha = Math.min(1, ((v - 0.35) / 0.4) * amount);
      ctx.fillStyle = s.colour;
      ctx.fillRect(s.x, s.y, 1, 1);
      if (s.big && v > 0.7) {
        ctx.fillRect(s.x - arm, s.y, arm * 2 + 1, 1);
        ctx.fillRect(s.x, s.y - arm, 1, arm * 2 + 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  // A bead of light runs down the sunlit stripe, brightest at its head. It is born
  // below the eave and reed tufts and swells in, so the thatch never flashes.
  function drawGlint(ctx, g, ic, t, amount) {
    const travel = ic.rows - ic.glintFrom;
    const pos = ic.glintFrom + ((t * ic.slide + ic.slidePhase) % 1.4) * travel;
    const from = Math.max(ic.glintFrom, Math.floor(pos - ic.span));
    const to = Math.min(ic.rows - 1, Math.floor(pos));
    if (from > to) return;
    const fadeIn = smoothstep(ic.glintFrom, ic.glintFrom + ic.span, pos) * amount;
    const step = Math.max(1, Math.floor(g.U * 0.6));
    for (let r = from; r <= to; r += step) {
      const k = (r - (pos - ic.span)) / ic.span;
      ctx.globalAlpha = Math.min(1, k * k * fadeIn);
      ctx.fillRect(ic.cx[r] - ic.hw[r] * 0.75, ic.top + r, Math.max(1, ic.hw[r] * 0.8), step);
    }
    if (ic.long && pos < ic.rows) {
      const arm = Math.max(1, Math.round(g.U * 1.3));
      const x = Math.round(ic.cx[to] - ic.hw[to] * 0.45);
      const y = ic.top + to;
      ctx.globalAlpha = Math.min(1, fadeIn);
      ctx.fillRect(x - arm, y, arm * 2 + 1, 1);
      ctx.fillRect(x, y - arm, 1, arm * 2 + 1);
    }
  }

  function drawHanging(ctx, ic, swell) {
    const r = ic.radius * Math.max(0.3, swell);
    const y = ic.tipY + r * (0.3 + swell * 0.6);
    ctx.fillStyle = '#7eabda';
    ctx.beginPath();
    ctx.ellipse(ic.tipX, y, r + 0.4, r * (1 + swell * 0.3) + 0.4, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(ic.tipX - r * 0.4), Math.round(y - r * 0.4), 1, 1);
  }

  function drawFalling(ctx, g, ic, fallen) {
    const y = ic.tipY + ic.radius + 0.5 * GRAVITY * g.U * fallen * fallen;
    const tail = Math.min(g.U * 4, GRAVITY * g.U * fallen * 0.06 + 1);
    ctx.fillStyle = '#e2f1fa';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(Math.round(ic.tipX), y - tail, 1, tail);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(ic.tipX) - 1, y, Math.max(2, ic.radius * 1.4), Math.max(2, ic.radius * 1.4));
  }

  function drawSplash(ctx, g, ic, after) {
    const f = after / SPLASH;
    const reach = g.U * 2.8 * ic.s * f;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 1 - f;
    for (let i = 0; i < 5; i++) {
      const dir = (i - 2) / 2;
      const lift = Math.sin(f * Math.PI) * g.U * (2.2 - Math.abs(dir) * 1.1) * ic.s;
      ctx.fillRect(ic.tipX + dir * reach, ic.land - lift, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawDrop(ctx, g, ic, clockNow) {
    const fallFor = Math.sqrt((2 * Math.max(0, ic.land - ic.tipY - ic.radius)) / (GRAVITY * g.U));
    const hang = ic.period - fallFor - SPLASH;
    const now = ((clockNow / ic.period + ic.offset) % 1) * ic.period;
    if (now < hang) drawHanging(ctx, ic, Math.pow(now / hang, 2));
    else if (now < hang + fallFor) drawFalling(ctx, g, ic, now - hang);
    else drawSplash(ctx, g, ic, now - hang - fallFor);
  }

  function drawDust(ctx, g, t) {
    ctx.fillStyle = '#ffffff';
    for (const m of state.dust) {
      const y = (m.y + t * m.vy) % (g.H * 0.8);
      const x = (m.x + t * m.vx + Math.sin(t * 0.3 + m.phase) * g.U * 2) % g.W;
      const a = 0.25 + 0.55 * Math.sin(t * m.rate + m.phase);
      if (a < 0.1) continue;
      ctx.globalAlpha = a;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // Powder fans out as the clump breaks up, then hangs and settles over the bank.
  // The spread keeps growing from where it was at landing, so nothing snaps inwards.
  function drawPowder(ctx, g, x0, y0, land, fall, since) {
    const { ox, oy, delay, size } = state.puff;
    const spreadLand = 1.5 + 5 * fall;
    ctx.fillStyle = '#f7fbfd';
    for (let i = 0; i < PUFF; i++) {
      const tt = since - delay[i];
      if (tt <= 0) continue;
      const after = tt - fall;
      if (after > POWDER_FADE) continue;
      const drop = Math.min(tt, fall);
      const rise = oy[i] * g.U * 7 * Math.sin(Math.min(1, Math.max(0, after) / 1.2) * 1.57);
      const y = after > 0 ? land - rise : y0 + 0.3 * GRAVITY * g.U * drop * drop;
      const spread = after > 0 ? spreadLand + after * 2.5 : 1.5 + tt * 5;
      const d = Math.max(1, g.U * 0.7 * size[i]);
      ctx.globalAlpha = after > 0 ? 0.85 * (1 - after / POWDER_FADE) : 0.85;
      ctx.fillRect(x0 + ox[i] * g.U * spread, y, d, d);
    }
    ctx.globalAlpha = 1;
  }

  function drawClump(ctx, x, y, r) {
    ctx.fillStyle = '#b4cde6';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.25, r * 1.2, r * 0.5, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#f7fafc';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.4, y - r * 0.05, r * 0.75, r * 0.42, 0.2, 0, 6.3);
    ctx.ellipse(x + r * 0.45, y + r * 0.05, r * 0.65, r * 0.36, -0.2, 0, 6.3);
    ctx.fill();
  }

  // The slide lasts until its last, latest grain of powder has faded out.
  function drawSlide(ctx, g) {
    const c = state.slideClock / SLIDE_EVERY;
    const index = Math.floor(c);
    const since = (c - index) * SLIDE_EVERY;
    const x0 = SLIDE_SPOTS[index % SLIDE_SPOTS.length] * g.W;
    const y0 = state.hem(x0) - g.U * 1.2;
    const start = y0 + g.U * 1.6;
    const land = dripY(g, x0);
    const fall = Math.sqrt((2 * Math.max(0, land - start)) / (GRAVITY * g.U * 0.6));
    if (since > CREEP + fall + PUFF_DELAY + POWDER_FADE) return;
    const r = g.U * 3.2 * near(g, x0);
    if (since < CREEP) {
      drawClump(ctx, x0, y0 + (since / CREEP) * g.U * 1.6, r * (0.5 + 0.5 * since / CREEP));
      return;
    }
    const falling = since - CREEP;
    const y = start + 0.3 * GRAVITY * g.U * falling * falling;
    if (y < land - r) drawClump(ctx, x0, y, r * Math.max(0.3, 1 - falling * 0.5));
    drawPowder(ctx, g, x0, start, land, fall, falling);
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.sky = paintSky(g);
    state.cloud = paintCloud(Math.ceil(g.W * 0.75), Math.ceil(g.H * 0.14));
    state.world = paintWorld(g, rand);
    state.sparkles = makeSparkles(g, rand);
    state.dust = makeDust(g, rand);
    state.puff = makePuff(rand);
    state.dripClock = 0;
    state.slideClock = 4.2;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { drip, glint, slide } = api.props;
    state.dripClock += dt * drip;
    state.slideClock += dt * slide;
    ctx.drawImage(state.sky, 0, 0);
    const w = state.cloud.width * 2;
    const x = -((t * g.U * 0.7) % w);
    const ch = state.cloud.height * 2;
    ctx.drawImage(state.cloud, x, g.H * 0.4, w, ch);
    ctx.drawImage(state.cloud, x + w, g.H * 0.4, w, ch);
    ctx.drawImage(state.world, 0, 0);
    drawSparkles(ctx, g, t, Math.max(0.4, glint));
    if (glint > 0) {
      ctx.fillStyle = '#ffffff';
      for (const ic of state.icicles) if (ic.big) drawGlint(ctx, g, ic, t, glint);
      ctx.globalAlpha = 1;
    }
    if (drip > 0) for (const ic of state.icicles) if (ic.big) drawDrop(ctx, g, ic, state.dripClock);
    drawDust(ctx, g, t);
    if (slide > 0) drawSlide(ctx, g);
  }

  Kasuri.run({
    defaults: { drip: 1, glint: 1, slide: 1, ramp: 'lines', cell: 7, boost: 0.1, gain: 1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
