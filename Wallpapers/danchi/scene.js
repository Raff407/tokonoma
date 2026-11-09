/*
 * 団地 Danchi — rows of concrete apartment blocks as the evening comes on.
 *
 * Sky and blocks are baked into layers and repainted once a minute from the
 * clock. Lit windows live on their own layer that is touched one window at a
 * time, so the estate fills with light slowly. Per frame only clouds, a few
 * pieces of washing and that one window change.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const TAU = Math.PI * 2;
  const HORIZON = 0.64;
  const RETINT_SECONDS = 60;
  const STEP_SECONDS = 0.45;
  const CONCRETE = '#cfc8b6';
  const CONCRETE_SIDE = '#a9a294';
  const PARAPET = '#ddd6c4';
  const LAMPS = ['#ecc77c', '#f1e0b0', '#dda55c', '#e8bb6a'];
  const CLOTH = ['#ece6d6', '#b8412c', '#3a5a8c', '#e4d9b8', '#d9a73a', '#6e8a5a', '#f0ece0'];
  const FUTON = ['#ece4cc', '#c8553a', '#5a7aa0', '#e2d2a8'];
  // x0, x1, top, bottom (fractions), floors, units, depth (0 near .. 1 far)
  const BLOCKS = [
    [0.3, 0.76, 0.24, 0.62, 8, 30, 1],
    [-0.05, 0.26, 0.31, 0.62, 6, 20, 1],
    [0.82, 1.06, 0.27, 0.62, 7, 16, 1],
    [0.5, 1.04, 0.39, 0.8, 7, 20, 0.5],
    [-0.06, 0.45, 0.2, 0.9, 10, 16, 0],
  ];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const rgb = (h) => parseColor(h);
  const hex = (c) => toHex(c);

  // Colour lit by the sky: multiplied by its ambient tint, then hazed with distance.
  function lit(sky, color, depth) {
    const c = rgb(color);
    const a = sky.amb;
    const m = [c[0] * a[0] / 255, c[1] * a[1] / 255, c[2] * a[2] / 255];
    return hex(mixColor(m, mixColor(sky.haze, sky.top, 0.45), depth * 0.62));
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.35, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    // Far hills.
    ctx.fillStyle = hex(mixColor(sky.haze, sky.low, 0.25));
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 2) {
      const y = g.H * (0.5 + (fbm(x * 0.012, 3, 3, 9) - 0.5) * 0.16);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.016, y * 0.08, 4, 33);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 240;
        img.data[i + 3] = smoothstep(0.5, 0.7, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- blocks ------------------------------------------------------------

  function blockGeom(g, b) {
    const x0 = Math.round(g.W * b[0]);
    const x1 = Math.round(g.W * b[1]);
    const top = Math.round(g.H * b[2]);
    const bottom = Math.round(g.H * b[3]);
    return { x0, x1, top, bottom, floors: b[4], units: b[5], depth: b[6] };
  }

  function paintRoof(ctx, g, k, sky, wall, side) {
    const fh = (k.bottom - k.top) / k.floors;
    ctx.fillStyle = lit(sky, '#7c766c', k.depth);
    ctx.fillRect(k.x0, k.top - Math.max(1, fh * 0.18), k.x1 - k.x0, Math.max(1, fh * 0.18));
    // Water tank on legs and a stair house.
    const tx = lerp(k.x0, k.x1, 0.62);
    const tw = Math.max(3, fh * 1.6);
    const th = Math.max(2, fh * 0.9);
    ctx.fillStyle = side;
    ctx.fillRect(tx, k.top - fh * 1.6, Math.max(1, fh * 0.12), fh * 1.6);
    ctx.fillRect(tx + tw - 1, k.top - fh * 1.6, Math.max(1, fh * 0.12), fh * 1.6);
    ctx.fillStyle = wall;
    ctx.fillRect(tx, k.top - fh * 1.6 - th, tw, th);
    ctx.fillStyle = side;
    ctx.fillRect(tx, k.top - fh * 1.6 - th, tw, Math.max(1, th * 0.2));
    const sx = lerp(k.x0, k.x1, 0.22);
    ctx.fillStyle = wall;
    ctx.fillRect(sx, k.top - fh * 0.9, fh * 1.4, fh * 0.9);
  }

  function addWindow(k, x, y, w, h, rand) {
    state.windows.push({
      x, y, w, h,
      color: LAMPS[Math.floor(rand() * LAMPS.length)],
      rank: rand(),
      on: false,
    });
  }

  function paintBlock(ctx, g, k, sky, rand, washing) {
    const wall = lit(sky, CONCRETE, k.depth);
    const side = lit(sky, CONCRETE_SIDE, k.depth);
    const para = lit(sky, PARAPET, k.depth);
    const glass = hex(mixColor(mixColor(sky.low, [40, 44, 58], 0.55 + sky.night * 0.35), sky.haze, k.depth * 0.4));
    const shadow = lit(sky, '#7a756c', k.depth);
    const fh = (k.bottom - k.top) / k.floors;
    const uw = (k.x1 - k.x0) / k.units;
    ctx.fillStyle = wall;
    ctx.fillRect(k.x0, k.top, k.x1 - k.x0, k.bottom - k.top);
    // End wall on the right gives the slab some depth.
    const ew = Math.max(2, uw * 1.4);
    ctx.fillStyle = side;
    ctx.fillRect(k.x1, k.top + 1, ew, k.bottom - k.top - 1);
    paintRoof(ctx, g, k, sky, wall, side);
    for (let f = 0; f < k.floors; f++) {
      const y0 = k.top + f * fh;
      const winTop = Math.round(y0 + fh * 0.18);
      const railTop = Math.round(y0 + fh * 0.6);
      // Balcony ceiling shadow and parapet.
      ctx.fillStyle = shadow;
      ctx.fillRect(k.x0, Math.round(y0), k.x1 - k.x0, Math.max(1, winTop - Math.round(y0)));
      for (let u = 0; u < k.units; u++) {
        const ux = k.x0 + u * uw;
        const wx = Math.round(ux + uw * 0.18);
        const ww = Math.max(1, Math.round(uw * 0.64));
        const wh = Math.max(1, railTop - winTop + (k.depth > 0.8 ? 0 : 1));
        ctx.fillStyle = glass;
        ctx.fillRect(wx, winTop, ww, wh);
        if (wx + ww > 0 && wx < g.W) addWindow(k, wx, winTop, ww, wh, rand);
        if (k.depth < 0.8 && rand() < 0.35) washing.push({ x: wx, y: winTop, w: ww, h: railTop - winTop, depth: k.depth });
      }
      ctx.fillStyle = para;
      ctx.fillRect(k.x0, railTop, k.x1 - k.x0, Math.max(1, Math.round(y0 + fh) - railTop));
      ctx.fillStyle = shadow;
      for (let u = 0; u <= k.units; u++) {
        ctx.fillRect(Math.round(k.x0 + u * uw), Math.round(y0), 1, railTop - Math.round(y0));
      }
      // A futon airing over the odd parapet.
      if (k.depth < 0.8) {
        for (let u = 0; u < k.units; u++) {
          if (rand() > 0.1) continue;
          ctx.fillStyle = lit(sky, FUTON[Math.floor(rand() * FUTON.length)], k.depth);
          ctx.fillRect(Math.round(k.x0 + u * uw + uw * 0.15), railTop, Math.round(uw * 0.7), Math.max(1, (fh * 0.4) | 0));
        }
      }
    }
    // Stair window column on the end wall.
    ctx.fillStyle = glass;
    for (let f = 0; f < k.floors; f++) {
      ctx.fillRect(Math.round(k.x1 + ew * 0.35), Math.round(k.top + (f + 0.3) * fh), Math.max(1, Math.round(ew * 0.3)), Math.max(1, Math.round(fh * 0.35)));
    }
  }

  function paintGround(ctx, g, sky, rand) {
    const top = Math.round(g.H * 0.86);
    ctx.fillStyle = lit(sky, '#6e8058', 0);
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = lit(sky, '#9a9488', 0);
    ctx.fillRect(0, Math.round(g.H * 0.92), g.W, Math.max(2, g.H * 0.035));
    // Trees in front of the near block.
    const tones = ['#3e5636', '#4d6a40', '#5f7c4c'];
    for (let i = 0; i < 9; i++) {
      const tx = (i + 0.3 + rand() * 0.4) * g.W / 9;
      const tr = g.U * (4 + rand() * 4);
      const ty = top - tr * 0.4;
      ctx.fillStyle = lit(sky, '#4a382a', 0);
      ctx.fillRect(tx - 1, ty, Math.max(1, g.U * 0.6), top - ty + g.U);
      for (let j = 0; j < 3; j++) {
        ctx.fillStyle = lit(sky, tones[j], 0);
        ctx.beginPath();
        ctx.ellipse(tx + (j - 1) * tr * 0.25, ty - j * tr * 0.2, tr * (1 - j * 0.2), tr * (0.8 - j * 0.15), 0, 0, TAU);
        ctx.fill();
      }
    }
    // Street lamps along the path.
    for (let i = 0; i < 4; i++) {
      const lx = (i + 0.5) * g.W / 4;
      ctx.fillStyle = lit(sky, '#4a4a4c', 0);
      ctx.fillRect(lx, g.H * 0.8, Math.max(1, g.U * 0.4), g.H * 0.12);
      ctx.fillStyle = sky.night > 0.4 ? '#ecd9a0' : lit(sky, '#d8d2c4', 0);
      ctx.fillRect(lx - g.U * 0.5, g.H * 0.795, g.U * 1.4, g.U * 0.9);
    }
  }

  // A nearer block hides whatever windows and washing sit behind it.
  function hideBehind(k, washing) {
    const fh = (k.bottom - k.top) / k.floors;
    const x1 = k.x1 + Math.max(2, ((k.x1 - k.x0) / k.units) * 1.4);
    const inside = (w) => w.x + w.w > k.x0 && w.x < x1 && w.y + w.h > k.top - fh * 2.6 && w.y < k.bottom;
    state.windows = state.windows.filter((w) => !inside(w));
    const keep = washing.filter((w) => !inside(w));
    washing.length = 0;
    washing.push(...keep);
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    state.windows = [];
    state.washing = [];
    const washing = [];
    for (const b of BLOCKS) {
      const k = blockGeom(g, b);
      hideBehind(k, washing);
      paintBlock(ctx, g, k, sky, rand, washing);
    }
    state.fore = layer(g.W, g.H);
    paintGround(state.fore.getContext('2d'), g, sky, rand);
    state.washing = washing.slice(0, 40).map((w, i) => ({
      ...w,
      color: lit(sky, CLOTH[i % CLOTH.length], w.depth),
      phase: rand() * TAU,
      pieces: 1 + Math.floor(rand() * 3),
    }));
    return c;
  }

  // ---- lit windows -------------------------------------------------------

  function target(props) {
    const amount = Math.max(0, props.windows);
    return Math.min(0.9, (0.04 + 0.56 * state.evening) * amount);
  }

  function lightLayer(g) {
    const c = state.lights;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    for (const w of state.windows) if (w.on) paintWindow(ctx, w);
  }

  function paintWindow(ctx, w) {
    ctx.globalAlpha = 0.8 + state.evening * 0.2;
    ctx.fillStyle = w.color;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.globalAlpha = 1;
  }

  // Seed the estate part-lit so there is always something left to switch on.
  function seedLights(props) {
    const goal = target(props) * 0.55;
    for (const w of state.windows) w.on = w.rank < goal;
    state.litCount = state.windows.filter((w) => w.on).length;
  }

  function stepLights(props, rand) {
    const list = state.windows;
    const goal = Math.round(target(props) * list.length);
    const ctx = state.lights.getContext('2d');
    const w = list[Math.floor(rand() * list.length)];
    if (state.litCount < goal && !w.on) {
      w.on = true;
      state.litCount++;
      paintWindow(ctx, w);
    } else if (state.litCount > goal * 0.92 && w.on && rand() < 0.5) {
      w.on = false;
      state.litCount--;
      ctx.clearRect(w.x, w.y, w.w, w.h);
    }
  }

  // How far people are home for the night: rises from late afternoon, falls after dawn.
  function eveningOf(h, night) {
    const rise = h >= 12 ? smoothstep(16.3, 19.5, h) : 1 - smoothstep(5, 7.5, h);
    return Math.max(night, rise);
  }

  function repaint(g, props) {
    const sky = S.at(S.hour(props.time));
    const rand = K.rng(47);
    const was = state.windows;
    state.dim = sky.night;
    state.evening = eveningOf(sky.hour, sky.night);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    if (was && was.length === state.windows.length) {
      for (let i = 0; i < was.length; i++) state.windows[i].on = was[i].on;
      state.litCount = state.windows.filter((w) => w.on).length;
    } else {
      seedLights(props);
    }
    lightLayer(g);
    state.cloudAlpha = 0.7 - sky.night * 0.45;
    state.choice = props.time;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 1.2) % c.width);
    ctx.globalAlpha = state.cloudAlpha;
    ctx.drawImage(c, off, g.H * 0.03);
    ctx.drawImage(c, off + c.width, g.H * 0.03);
    ctx.globalAlpha = 1;
  }

  function drawWashing(ctx, t) {
    for (const w of state.washing) {
      ctx.fillStyle = w.color;
      const pw = Math.max(1, Math.floor(w.w / w.pieces) - 1);
      for (let p = 0; p < w.pieces; p++) {
        const sway = Math.sin(t * 1.6 + w.phase + p * 1.3);
        const len = Math.max(1, Math.round(w.h * (0.55 + 0.15 * sway)));
        const dx = Math.round(sway * 0.8);
        ctx.fillRect(w.x + p * (pw + 1) + dx, w.y, pw, len);
      }
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.windows = null;
    state.lights = layer(g.W, g.H);
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.28));
    state.rand = K.rng(91);
    state.stepIn = 0;
    repaint(g, api.props);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props);
    state.stepIn -= dt;
    if (state.stepIn <= 0) {
      stepLights(props, state.rand);
      state.stepIn = STEP_SECONDS;
    }
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    ctx.drawImage(state.lights, 0, 0);
    if (props.laundry) drawWashing(ctx, t);
    ctx.drawImage(state.fore, 0, 0);
  }

  Kasuri.run({
    defaults: { time: 'auto', windows: 1, laundry: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
