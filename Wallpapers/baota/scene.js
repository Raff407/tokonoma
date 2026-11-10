/*
 * 宝塔 Baota — a seven-storey brick pagoda on a pine hill.
 *
 * Sky, ridges, hill and tower are baked into layers and repainted once a
 * minute from the clock. Between repaints only cloud banks, the hanging
 * bells and a few swallows move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const RETINT_SECONDS = 60;
  const TIERS = 7;
  const PAGODA_X = 0.64;
  const BASE = 80;
  const SWALLOWS = 4;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Colour tinted by the sky and darkened toward night.
  function shade(sky, base, nightBase, amount) {
    const lit = mixColor(rgb(base), sky.amb, 0.22);
    return hex(mixColor(lit, rgb(nightBase), sky.night * (amount === undefined ? 0.8 : amount)));
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.U * 80);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.45);
        ctx.fillRect(rand() * g.W, rand() * g.U * 55, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintLuminary(ctx, g, sky);
    return c;
  }

  function paintLuminary(ctx, g, sky) {
    const night = sky.night > 0.5;
    const t = night ? S.moonT(sky.hour) : S.sunT(sky.hour);
    const lx = g.W * (0.07 + 0.38 * t);
    const ly = g.U * (44 - 30 * Math.sin(Math.PI * t));
    const r = g.U * (night ? 3.6 : 4.2);
    const core = night ? '#ece6d2' : '#f6dca0';
    const halo = ctx.createRadialGradient(lx, ly, r * 0.5, lx, ly, r * 4);
    halo.addColorStop(0, night ? 'rgba(236,230,210,0.3)' : 'rgba(246,220,160,0.4)');
    halo.addColorStop(1, 'rgba(236,230,210,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(lx - r * 4, ly - r * 4, r * 8, r * 8);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(lx, ly, r, 0, 6.3);
    ctx.fill();
  }

  // ---- ridges ------------------------------------------------------------

  // Steep ink-painting peaks: ridged noise makes sharp summits.
  function paintRidge(g, sky, opts) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const body = mixColor(mixColor(rgb(opts.ink), sky.haze, opts.haze), rgb('#1a2036'), sky.night * 0.45);
    const low = mixColor(body, sky.low, opts.fade);
    const top = g.U * (opts.base - opts.amp);
    const grad = ctx.createLinearGradient(0, top, 0, g.U * opts.base);
    grad.addColorStop(0, hex(body));
    grad.addColorStop(1, hex(low));
    ctx.fillStyle = grad;
    for (let x = 0; x < g.W; x++) {
      const n = fbm(x * opts.freq, opts.seed, 4, opts.seed + 3);
      const ridged = 1 - Math.abs(2 * n - 1);
      const h = Math.pow(ridged, 1.5) * opts.amp + (n - 0.5) * opts.amp * 0.3;
      const y = g.U * opts.base - Math.max(0, h) * g.U;
      ctx.fillRect(x, y, 1, g.H - y);
    }
    return c;
  }

  // ---- hill and trees ----------------------------------------------------

  function hillY(g, x) {
    const px = g.W * PAGODA_X;
    const d = (x - px) / (g.W * 0.26);
    const bump = Math.exp(-d * d);
    return g.U * (BASE + 9 - 9 * bump) + (fbm(x * 0.05, 7, 3, 17) - 0.5) * g.U * 1.6;
  }

  function paintHill(ctx, g, sky) {
    const top = shade(sky, '#4f6444', '#1a2230');
    const bot = shade(sky, '#2f4234', '#10161e');
    const grad = ctx.createLinearGradient(0, g.U * (BASE - 4), 0, g.H);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bot);
    ctx.fillStyle = grad;
    for (let x = 0; x < g.W; x++) {
      const y = hillY(g, x);
      ctx.fillRect(x, y, 1, g.H - y);
    }
    // Pale stone steps climbing to the tower.
    ctx.strokeStyle = shade(sky, '#b9b2a0', '#4a4e62');
    ctx.lineWidth = Math.max(1, g.U * 0.9);
    ctx.beginPath();
    const px = g.W * PAGODA_X;
    ctx.moveTo(px - g.U * 20, g.H);
    ctx.bezierCurveTo(px - g.U * 14, g.U * 94, px + g.U * 12, g.U * 91, px, g.U * (BASE + 1));
    ctx.stroke();
  }

  // A pine of flat layered pads, drawn in the painted-Chinese manner.
  function paintPine(ctx, g, sky, x, y, s) {
    ctx.fillStyle = shade(sky, '#3b3028', '#12141c');
    ctx.fillRect(x - s * 0.12, y - s * 3.2, Math.max(1, s * 0.24), s * 3.2);
    const leaf = shade(sky, '#3d5a3c', '#141c24');
    const light = shade(sky, '#58724a', '#1c2630');
    const pads = [[-0.2, 2.9, 1.5], [0.35, 2.1, 1.7], [-0.4, 1.4, 1.9], [0.1, 0.8, 1.6]];
    for (const p of pads) {
      ctx.fillStyle = leaf;
      ctx.beginPath();
      ctx.ellipse(x + p[0] * s, y - p[1] * s, p[2] * s, s * 0.55, 0, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = light;
      ctx.fillRect(x + p[0] * s - p[2] * s * 0.6, y - p[1] * s - s * 0.45, p[2] * s * 0.9, Math.max(1, s * 0.12));
    }
  }

  function paintTrees(ctx, g, sky, rand) {
    const px = g.W * PAGODA_X;
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1;
      const x = px + side * g.U * (14 + rand() * 40) + (rand() - 0.5) * g.U * 4;
      if (Math.abs(x - px) < g.U * 13) continue;
      paintPine(ctx, g, sky, x, hillY(g, x) + g.U * 1.2, g.U * (1.6 + rand() * 1.3));
    }
    // A large pine at the left edge.
    paintPine(ctx, g, sky, g.W * 0.07, g.H * 1.01, g.U * 7.5);
    paintPine(ctx, g, sky, g.W * 0.16, g.H * 0.99, g.U * 3.8);
  }

  // ---- pagoda ------------------------------------------------------------

  function geometry(g) {
    const px = g.W * PAGODA_X;
    const tiers = [];
    let y = g.U * (BASE - 2);
    for (let i = 0; i < TIERS; i++) {
      const k = i / (TIERS - 1);
      const bodyW = g.U * lerp(18, 10, k);
      const bodyH = g.U * lerp(11, 5.8, Math.pow(k, 0.8));
      const proj = g.U * lerp(5.6, 3.8, k);
      tiers.push({ cx: px, w: bodyW, h: bodyH, proj, bottom: y, top: y - bodyH });
      y -= bodyH;
    }
    return { px, tiers, topY: y };
  }

  function paintBrick(ctx, g, sky, t) {
    const x0 = t.cx - t.w / 2;
    ctx.fillStyle = shade(sky, '#8a5f4c', '#2a2430', 0.78);
    ctx.fillRect(x0, t.top, t.w, t.h);
    // Left face catches the light, right face sits in shadow.
    ctx.fillStyle = shade(sky, '#a8745a', '#322a36', 0.78);
    ctx.fillRect(x0, t.top, t.w * 0.3, t.h);
    ctx.fillStyle = shade(sky, '#5c3e38', '#1c1822', 0.78);
    ctx.fillRect(t.cx + t.w * 0.22, t.top, t.w * 0.28, t.h);
    // Courses of brick.
    ctx.fillStyle = shade(sky, '#4a3430', '#171420', 0.78);
    for (let y = t.top + g.U * 1.3; y < t.bottom; y += g.U * 1.6) ctx.fillRect(x0, y, t.w, 1);
  }

  function paintWindow(ctx, g, sky, t) {
    const ww = Math.max(2, t.w * 0.2);
    const wh = Math.max(3, t.h * 0.5);
    const wx = t.cx - ww / 2;
    const wy = t.top + t.h * 0.28;
    const glow = sky.night > 0.35;
    ctx.fillStyle = glow ? hex(mixColor(rgb('#d9a73a'), rgb('#f0d08a'), sky.night * 0.5)) : shade(sky, '#1c1a20', '#0a0a10', 0.3);
    ctx.fillRect(wx, wy + ww / 2, ww, wh - ww / 2);
    ctx.beginPath();
    ctx.arc(t.cx, wy + ww / 2, ww / 2, Math.PI, 0);
    ctx.fill();
  }

  // Tiled eave with corners that sweep up to a point.
  function paintEave(ctx, g, sky, t) {
    const hw = t.w / 2 + t.proj;
    const lift = g.U * 2.2;
    const yb = t.top + g.U * 0.9;
    const thick = g.U * 2.6;
    ctx.fillStyle = shade(sky, '#454a52', '#12141c', 0.75);
    ctx.beginPath();
    ctx.moveTo(t.cx - hw - g.U * 0.6, yb - lift);
    ctx.quadraticCurveTo(t.cx - hw * 0.75, yb + g.U * 0.7, t.cx, yb + g.U * 0.8);
    ctx.quadraticCurveTo(t.cx + hw * 0.75, yb + g.U * 0.7, t.cx + hw + g.U * 0.6, yb - lift);
    ctx.lineTo(t.cx + t.w * 0.46, yb - thick);
    ctx.lineTo(t.cx - t.w * 0.46, yb - thick);
    ctx.closePath();
    ctx.fill();
    // Ridge line of pale tile along the top, shadow line below.
    ctx.fillStyle = shade(sky, '#6e747a', '#252a38', 0.75);
    ctx.fillRect(t.cx - t.w * 0.46, yb - thick, t.w * 0.92, Math.max(1, g.U * 0.35));
    ctx.fillStyle = shade(sky, '#2a2c34', '#0a0c12', 0.6);
    ctx.fillRect(t.cx - hw * 0.6, yb + g.U * 0.5, hw * 1.2, Math.max(1, g.U * 0.3));
    return { lx: t.cx - hw - g.U * 0.6, rx: t.cx + hw + g.U * 0.6, y: yb - lift };
  }

  function paintSpire(ctx, g, sky, geo) {
    const top = geo.tiers[TIERS - 1];
    const y0 = top.top - g.U * 0.5;
    const gold = shade(sky, '#c9a042', '#4c4030', 0.55);
    // Small octagonal cap then stacked rings and a gold bead.
    ctx.fillStyle = shade(sky, '#454a52', '#12141c', 0.75);
    ctx.beginPath();
    ctx.moveTo(top.cx - top.w * 0.38, y0);
    ctx.lineTo(top.cx - top.w * 0.12, y0 - g.U * 3.2);
    ctx.lineTo(top.cx + top.w * 0.12, y0 - g.U * 3.2);
    ctx.lineTo(top.cx + top.w * 0.38, y0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = gold;
    ctx.fillRect(top.cx - Math.max(0.5, g.U * 0.25), y0 - g.U * 9.5, Math.max(1, g.U * 0.5), g.U * 6.5);
    for (let i = 0; i < 4; i++) {
      const w = g.U * (3 - i * 0.55);
      ctx.fillRect(top.cx - w / 2, y0 - g.U * (4.2 + i * 1.3), w, Math.max(1, g.U * 0.55));
    }
    ctx.beginPath();
    ctx.arc(top.cx, y0 - g.U * 9.8, g.U * 0.8, 0, 6.3);
    ctx.fill();
  }

  function paintPagoda(ctx, g, sky) {
    const geo = geometry(g);
    // Stone plinth in two steps.
    ctx.fillStyle = shade(sky, '#9c968a', '#363a4c');
    const b = geo.tiers[0];
    ctx.fillRect(b.cx - b.w / 2 - g.U * 2.6, b.bottom, b.w + g.U * 5.2, g.U * 1.2);
    ctx.fillStyle = shade(sky, '#b4ae9e', '#40445a');
    ctx.fillRect(b.cx - b.w / 2 - g.U * 1.4, b.bottom - g.U * 0.6, b.w + g.U * 2.8, g.U * 0.9);
    const bells = [];
    for (let i = 0; i < TIERS; i++) {
      const t = geo.tiers[i];
      paintBrick(ctx, g, sky, t);
      paintWindow(ctx, g, sky, t);
      bells.push(paintEave(ctx, g, sky, t));
    }
    paintSpire(ctx, g, sky, geo);
    state.bells = bells;
  }

  // ---- bake --------------------------------------------------------------

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintHill(ctx, g, sky);
    paintPagoda(ctx, g, sky);
    paintTrees(ctx, g, sky, rand);
    return c;
  }

  // Wide banks of cloud that tile sideways.
  function paintBank(w, h, seed, thresh) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(fbm(x * 0.012, y * 0.06, 4, seed), fbm((x - c.width) * 0.012, y * 0.06, 4, seed), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = 240;
        img.data[i + 1] = 236;
        img.data[i + 2] = 224;
        img.data[i + 3] = smoothstep(thresh, thresh + 0.1, v) * Math.pow(band, 0.6) * 240;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(47);
    state.sky = paintSky(g, sky, rand);
    state.far = paintRidge(g, sky, { ink: '#4a5a80', haze: 0.55, fade: 0.55, base: 72, amp: 34, freq: 0.012, seed: 5 });
    state.mid = paintRidge(g, sky, { ink: '#34426a', haze: 0.35, fade: 0.4, base: 82, amp: 20, freq: 0.02, seed: 11 });
    state.front = paintFront(g, sky, rand);
    state.cloudAlpha = 0.9 - sky.night * 0.3;
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawBank(ctx, g, c, t, speed, y, alpha) {
    const off = -((t * g.U * speed) % c.width);
    ctx.globalAlpha = alpha;
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    ctx.globalAlpha = 1;
  }

  function drawBells(ctx, g, t, amount) {
    const bells = state.bells;
    const size = Math.max(2, g.U * 1.1);
    const hang = g.U * 1.5;
    ctx.strokeStyle = '#6a5a38';
    ctx.lineWidth = 1;
    ctx.fillStyle = state.night > 0.5 ? '#e0b858' : '#c9a042';
    for (let i = 0; i < bells.length; i++) {
      const b = bells[i];
      for (let s = 0; s < 2; s++) {
        const bx = s ? b.rx : b.lx;
        const a = Math.sin(t * 1.7 + i * 0.9 + s * 1.9) * 0.45 * amount;
        const x = bx + Math.sin(a) * hang;
        const y = b.y + Math.cos(a) * hang;
        ctx.beginPath();
        ctx.moveTo(bx, b.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillRect(x - size / 2, y, size, size);
      }
    }
  }

  function drawSwallows(ctx, g, t) {
    ctx.strokeStyle = state.night > 0.5 ? '#3a3e52' : '#1e222c';
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    const px = g.W * PAGODA_X;
    const wing = g.U * 1.3;
    for (let i = 0; i < SWALLOWS; i++) {
      const a = t * (0.32 + i * 0.04) + i * 1.7;
      const x = px + Math.cos(a) * g.U * (28 + i * 7);
      const y = g.U * (24 + i * 7) + Math.sin(a * 1.3) * g.U * 5;
      const flap = Math.sin(t * 9 + i * 2) * g.U * 0.7;
      ctx.beginPath();
      ctx.moveTo(x - wing, y - flap);
      ctx.lineTo(x, y + g.U * 0.4);
      ctx.lineTo(x + wing, y - flap);
      ctx.stroke();
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.cloudA = paintBank(g.W * 1.5, g.H * 0.24, 21, 0.4);
    state.cloudB = paintBank(g.W * 1.5, g.H * 0.2, 34, 0.4);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.far, 0, 0);
    if (props.clouds > 0) drawBank(ctx, g, state.cloudA, t, 1.6, g.U * 46, Math.min(1, state.cloudAlpha * props.clouds));
    ctx.drawImage(state.mid, 0, 0);
    if (props.clouds > 0) drawBank(ctx, g, state.cloudB, t, 2.6, g.U * 62, Math.min(1, state.cloudAlpha * props.clouds * 0.9));
    ctx.drawImage(state.front, 0, 0);
    drawBells(ctx, g, t, props.bells);
    if (props.swallows) drawSwallows(ctx, g, t);
    if (props.clouds > 0) drawBank(ctx, g, state.cloudB, t + 40, 3.4, g.U * 78, Math.min(1, state.cloudAlpha * props.clouds * 0.6));
  }

  Kasuri.run({
    defaults: { time: 'auto', clouds: 1, bells: 1, swallows: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
