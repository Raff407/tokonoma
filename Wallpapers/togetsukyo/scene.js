/*
 * 渡月橋 Togetsukyo — a long low wooden bridge over a wide river below maple hills.
 *
 * Sky and hills, the river (with its soft reflection) and the bridge are baked
 * into separate layers and repainted once a minute from the clock. Each frame
 * the water layer is drawn row by row with a small sine shift so the
 * reflection ripples; mist, a few glints, a boat and falling leaves move on top.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const SHORE = 0.5;        // where the hills meet the water
  const PIER_BASE = 0.6;    // where the bridge piers stand in the water
  const DECK = 0.515;       // deck height at the bridge ends
  const ARCH = 0.014;       // how much the deck rises mid-span
  const BRIDGE_END = 0.86;  // the bridge lands on the far shore here
  const RETINT_SECONDS = 60;
  const GLINTS = 40;
  const LEAVES = 26;
  const BOAT_SECONDS = 110;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // A colour as seen through haze and dusk.
  function tone(sky, h, fog, shade) {
    let c = mixColor(rgb(h), sky.amb, 0.1);
    c = mixColor(c, sky.haze, fog);
    c = mixColor(c, rgb('#0c1020'), Math.min(1, sky.night * 0.66 + (shade || 0)));
    return hex(c);
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(ctx, g, sky, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * SHORE);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H * SHORE + 1);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.4; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.22, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    const night = sky.night > 0.5;
    const t = night ? S.moonT(sky.hour) : S.sunT(sky.hour);
    const cx = g.W * (0.12 + 0.76 * t);
    const cy = g.H * (0.26 - 0.18 * Math.sin(Math.PI * t));
    ctx.fillStyle = night ? '#e6e4da' : hex(mixColor(rgb('#f4e3b8'), sky.low, 0.3));
    ctx.globalAlpha = night ? 0.9 : 0.85;
    ctx.beginPath();
    ctx.arc(cx, cy, g.U * 2.6, 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---- hills -------------------------------------------------------------

  // Back: Arashiyama's hazy peak. Middle and front: maple and pine slopes.
  const RIDGES = [
    { top: 0.15, amp: 0.05, fog: 0.6, base: '#34456a', seed: 3, peak: 0.07, crown: 0, rows: 0 },
    { top: 0.25, amp: 0.05, fog: 0.36, base: '#33503e', seed: 5, peak: 0, crown: 2.3, rows: 4 },
    { top: 0.34, amp: 0.045, fog: 0.1, base: '#22382c', seed: 8, peak: 0, crown: 3.4, rows: 4 },
  ];

  function ridgeY(g, r, i, x) {
    const u = x / g.W;
    const bump = r.peak * Math.exp(-Math.pow((u - 0.32) / 0.16, 2));
    return g.H * (r.top - bump + (fbm(u * 3.2 + i * 9, i * 3, 4, r.seed) - 0.5) * r.amp * 2);
  }

  // Maples come in groves: low-frequency noise picks the colour per crown.
  function crownColor(n, jitter) {
    const v = n + jitter;
    if (v < 0.4) return '#24402e';   // pine
    if (v < 0.5) return '#46663e';   // moss
    if (v < 0.58) return '#c8962e';  // gold
    if (v < 0.68) return '#c4452a';  // vermilion
    return '#9a3420';                // deep maple
  }

  function paintCrown(ctx, sky, x, y, r, base, fog) {
    ctx.fillStyle = tone(sky, base, fog, 0.38);
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.25, r * 1.05, r * 0.85, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = tone(sky, base, fog, 0);
    ctx.beginPath();
    ctx.ellipse(x - r * 0.1, y, r * 0.9, r * 0.7, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = tone(sky, hex(mixColor(rgb(base), rgb('#efe4c8'), 0.3)), fog, 0);
    ctx.beginPath();
    ctx.ellipse(x - r * 0.3, y - r * 0.25, r * 0.45, r * 0.32, 0, 0, 6.3);
    ctx.fill();
  }

  function paintRidge(ctx, g, sky, r, i, rand) {
    const bottom = g.H * SHORE + 1;
    ctx.fillStyle = tone(sky, r.base, r.fog, 0);
    ctx.beginPath();
    ctx.moveTo(0, bottom);
    for (let x = 0; x <= g.W; x += 1) ctx.lineTo(x, ridgeY(g, r, i, x));
    ctx.lineTo(g.W, bottom);
    ctx.fill();
    if (r.crown > 0) {
      const size = g.U * r.crown;
      for (let row = 0; row < r.rows; row++) {
        for (let x = -size + rand() * size; x < g.W + size; x += size * (1.25 + rand() * 0.5)) {
          const y = ridgeY(g, r, i, x) + size * (0.4 + row * 1.15) + (rand() - 0.5) * size * 0.4;
          if (y > bottom + size * 0.3) continue;
          const n = fbm(x * 0.02 + i * 7, row * 0.35 + i, 3, 40 + i);
          const fog = r.fog * (1 - row * 0.06);
          paintCrown(ctx, sky, x, y, size * (0.85 + rand() * 0.35), crownColor(n, (rand() - 0.5) * 0.16), fog);
        }
      }
    }
    // Haze pooling at the foot of each ridge separates it from the next.
    const fade = ctx.createLinearGradient(0, bottom - g.H * 0.12, 0, bottom);
    const hz = hex(sky.haze);
    fade.addColorStop(0, hz + '00');
    fade.addColorStop(1, hz + (i === 2 ? '55' : '88'));
    ctx.fillStyle = fade;
    ctx.fillRect(0, bottom - g.H * 0.12, g.W, g.H * 0.12);
  }

  // ---- water -------------------------------------------------------------

  // Blurred, dimmed mirror of the hills, under a calm river gradient.
  function paintWater(g, sky, top, bridge) {
    const pad = Math.ceil(g.U * 3);
    const y0 = Math.floor(g.H * SHORE);
    const h = g.H - y0;
    const out = layer(g.W + pad * 2, h);
    const ctx = out.getContext('2d');
    const deep = mixColor(sky.top, rgb('#141c30'), 0.55);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, hex(mixColor(sky.low, sky.haze, 0.3)));
    grad.addColorStop(1, hex(deep));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, out.width, h);

    // Soft copy: shrink then enlarge to blur.
    const small = layer(g.W / 4, y0 / 4);
    const sc = small.getContext('2d');
    sc.imageSmoothingEnabled = true;
    sc.drawImage(top, 0, 0, g.W, y0, 0, 0, small.width, small.height);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.55;
    ctx.translate(pad, y0);
    ctx.scale(1, -1);
    ctx.drawImage(small, -pad, 0, g.W + pad * 2, y0);
    ctx.restore();

    // Bridge reflection mirrored about the pier feet, a little darker.
    const axis = g.H * PIER_BASE - y0;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.translate(pad, axis * 2);
    ctx.scale(1, -1);
    ctx.drawImage(bridge, 0, -y0);
    ctx.restore();

    // Fade the reflection out toward the near bank.
    const veil = ctx.createLinearGradient(0, 0, 0, h);
    const d = hex(deep);
    veil.addColorStop(0, d + '30');
    veil.addColorStop(0.5, d + '80');
    veil.addColorStop(1, d + 'e0');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, out.width, h);

    // A few long, faint still-water lines.
    const rand = K.rng(77);
    ctx.fillStyle = hex(mixColor(sky.low, rgb('#f4efe0'), 0.4));
    for (let i = 0; i < 26; i++) {
      ctx.globalAlpha = 0.1 + rand() * 0.12;
      const y = h * (0.06 + rand() * 0.9);
      ctx.fillRect(rand() * out.width, y, g.W * (0.08 + rand() * 0.18), 1);
    }
    ctx.globalAlpha = 1;
    state.pad = pad;
    state.waterY = y0;
    return out;
  }

  // ---- bridge ------------------------------------------------------------

  function deckY(g, x) {
    const u = Math.min(1, Math.max(0, x / (g.W * BRIDGE_END)));
    return g.H * (DECK - ARCH * Math.sin(Math.PI * u));
  }

  function paintBridge(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const wood = tone(sky, '#3e2c1e', 0.04, 0);
    const mid = tone(sky, '#6a4e34', 0.04, 0);
    const pale = tone(sky, '#c49a64', 0.04, 0);
    const end = g.W * BRIDGE_END;
    const base = g.H * PIER_BASE;
    const line = Math.max(1, u * 0.5);

    // Far-shore landing where the bridge meets the bank.
    ctx.fillStyle = tone(sky, '#22382c', 0.1, 0.1);
    ctx.beginPath();
    ctx.moveTo(end - u * 4, deckY(g, end) + u * 1.2);
    ctx.lineTo(end + u * 10, deckY(g, end) + u * 1.6);
    ctx.lineTo(end + u * 16, g.H * SHORE + u * 3);
    ctx.lineTo(end - u * 6, base - u * 2);
    ctx.fill();

    // Pier groups: three posts with a cross beam and a diagonal brace.
    const span = g.W * 0.068;
    for (let px = span * 0.5; px < end - span * 0.3; px += span) {
      const top = deckY(g, px) + u * 1.2;
      ctx.fillStyle = wood;
      for (let k = -1; k <= 1; k++) ctx.fillRect(px + k * u * 1.1 - line / 2, top, line, base - top);
      ctx.fillRect(px - u * 1.8, top + (base - top) * 0.35, u * 3.6, line);
      ctx.strokeStyle = wood;
      ctx.lineWidth = line * 0.8;
      ctx.beginPath();
      ctx.moveTo(px - u * 1.1, top + (base - top) * 0.35);
      ctx.lineTo(px + u * 1.1, base - u * 0.6);
      ctx.stroke();
      // Pale wave-breaker at the foot.
      ctx.fillStyle = mid;
      ctx.fillRect(px - u * 1.5, base - u * 0.9, u * 3, u * 0.9);
    }

    // Deck: dark beam with a pale edge, following a gentle arch.
    for (let x = 0; x < end; x += 1) {
      const y = deckY(g, x);
      ctx.fillStyle = wood;
      ctx.fillRect(x, y, 1.2, u * 1.3);
      ctx.fillStyle = pale;
      ctx.fillRect(x, y - line * 0.6, 1.2, line);
      ctx.fillStyle = mid;
      ctx.fillRect(x, y - u * 2.2, 1.2, line);
    }
    // Railing posts.
    ctx.fillStyle = mid;
    for (let x = u; x < end; x += u * 3.2) {
      const y = deckY(g, x);
      ctx.fillRect(x, y - u * 2.3, line, u * 2.3);
    }
    if (sky.night > 0.3) {
      ctx.fillStyle = '#e8b64a';
      ctx.globalAlpha = Math.min(1, sky.night * 1.2);
      for (let x = span; x < end; x += span * 2) {
        const y = deckY(g, x);
        ctx.fillRect(x - u * 0.4, y - u * 3.4, u * 0.8, u * 1.1);
      }
      ctx.globalAlpha = 1;
    }
    return c;
  }

  // ---- foreground --------------------------------------------------------

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const top = g.H * 0.88;
    ctx.fillStyle = tone(sky, '#1c2c24', 0, 0.05);
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W * 0.38; x += 1) {
      const u = x / g.W;
      ctx.lineTo(x, top + (fbm(u * 8, 1, 3, 4) - 0.5) * g.U * 3 + smoothstep(0.05, 0.38, u) * g.H * 0.12);
    }
    ctx.lineTo(g.W * 0.38, g.H);
    ctx.fill();
    for (let k = 0; k < g.W * 0.35; k++) {
      const x = rand() * g.W * 0.34;
      const y = top + g.U * 1.5 + rand() * (g.H - top) + smoothstep(0.05, 0.38, x / g.W) * g.H * 0.1;
      const len = g.U * (1 + rand() * 2.2);
      ctx.fillStyle = tone(sky, rand() < 0.35 ? '#b8902e' : '#3c5a3c', 0, 0.05);
      ctx.fillRect(x, y - len, 1, len);
    }
    paintBranch(ctx, g, sky, rand);
    return c;
  }

  // A maple branch hanging in from the top right.
  function paintBranch(ctx, g, sky, rand) {
    ctx.strokeStyle = tone(sky, '#2a2018', 0, 0);
    ctx.lineWidth = Math.max(1, g.U * 0.8);
    ctx.beginPath();
    ctx.moveTo(g.W * 1.02, g.H * 0.03);
    ctx.quadraticCurveTo(g.W * 0.88, g.H * 0.06, g.W * 0.76, g.H * 0.17);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, g.U * 0.45);
    ctx.beginPath();
    ctx.moveTo(g.W * 0.9, g.H * 0.06);
    ctx.quadraticCurveTo(g.W * 0.87, g.H * 0.13, g.W * 0.85, g.H * 0.21);
    ctx.stroke();
    const spots = [[0.76, 0.17, 4], [0.8, 0.13, 4.5], [0.85, 0.21, 4], [0.88, 0.08, 5], [0.95, 0.05, 5]];
    for (const s of spots) {
      const r = g.U * s[2];
      for (let k = 0; k < 34; k++) {
        const a = rand() * 6.3;
        const d = Math.sqrt(rand()) * r;
        const px = g.W * s[0] + Math.cos(a) * d;
        const py = g.H * s[1] + Math.sin(a) * d * 0.7;
        const below = Math.sin(a) > 0.2;
        ctx.fillStyle = tone(sky, rand() < 0.7 ? '#c4452a' : '#d9a73a', 0, below ? 0.25 : 0);
        ctx.fillRect(px, py, Math.max(1, g.U * 0.9), Math.max(1, g.U * 0.8));
      }
    }
  }

  // ---- mist and boat sprites ---------------------------------------------

  function paintMist(w, h, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    for (let y = 0; y < c.height; y++) {
      const band = Math.pow(Math.sin((y / c.height) * Math.PI), 1.3);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(fbm(x * 0.012, y * 0.08, 4, seed), fbm((x - c.width) * 0.012, y * 0.08, 4, seed), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = smoothstep(0.36, 0.66, v) * band * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // A small roofed river boat with a lantern.
  function paintBoat(g) {
    const u = g.U;
    const w = Math.ceil(u * 17);
    const h = Math.ceil(u * 7);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#241a12';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.62);
    ctx.lineTo(w, h * 0.55);
    ctx.lineTo(w * 0.9, h);
    ctx.lineTo(w * 0.08, h);
    ctx.fill();
    ctx.fillStyle = '#5a4430';
    ctx.fillRect(w * 0.22, h * 0.26, w * 0.46, h * 0.36);
    ctx.fillStyle = '#e0b860';
    ctx.fillRect(w * 0.27, h * 0.33, w * 0.1, h * 0.18);
    ctx.fillRect(w * 0.42, h * 0.33, w * 0.1, h * 0.18);
    ctx.fillStyle = '#241a12';
    ctx.beginPath();
    ctx.moveTo(w * 0.16, h * 0.3);
    ctx.lineTo(w * 0.74, h * 0.3);
    ctx.lineTo(w * 0.64, h * 0.14);
    ctx.lineTo(w * 0.26, h * 0.14);
    ctx.fill();
    ctx.fillRect(w * 0.86, 0, Math.max(1, u * 0.35), h * 0.6);
    ctx.fillStyle = '#c4452a';
    ctx.fillRect(w * 0.84, h * 0.1, Math.max(1, u * 0.8), Math.max(1, u * 1.1));
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(31);
    const top = layer(g.W, g.H * SHORE + 1);
    const tc = top.getContext('2d');
    paintSky(tc, g, sky, rand);
    RIDGES.forEach((r, i) => paintRidge(tc, g, sky, r, i, rand));
    state.top = top;
    state.bridge = paintBridge(g, sky);
    state.water = paintWater(g, sky, top, state.bridge);
    state.front = paintFront(g, sky, rand);
    state.dark = sky.night;
    state.mistA = 0.75 - sky.night * 0.3;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  // The river, row by row, each row nudged sideways: a slow ripple.
  function drawWater(ctx, g, t) {
    const w = state.water;
    const y0 = state.waterY;
    const pad = state.pad;
    for (let y = 0; y < w.height; y++) {
      const depth = y / w.height;
      const amp = g.U * (0.3 + depth * 1.6);
      const off = Math.sin(y * 0.55 - t * 1.3) * amp + Math.sin(y * 0.17 + t * 0.6) * amp * 0.6;
      ctx.drawImage(w, 0, y, w.width, 1, off - pad, y0 + y, w.width, 1);
    }
  }

  function drawGlints(ctx, g, t) {
    ctx.fillStyle = '#f4efe0';
    const span = g.H * (1 - PIER_BASE - 0.04);
    for (let i = 0; i < GLINTS; i++) {
      const a = 0.5 + 0.5 * Math.sin(t * (0.4 + state.gv[i] * 0.6) + state.gp[i]);
      const x = ((state.gx[i] + t * 0.004 * (0.5 + state.gv[i])) % 1) * g.W;
      ctx.globalAlpha = a * a * 0.6 * (1 - state.dark * 0.5);
      ctx.fillRect(x, g.H * (PIER_BASE + 0.03) + state.gy[i] * span, g.U * (2 + state.gv[i] * 4), Math.max(1, g.U * 0.4));
    }
    ctx.globalAlpha = 1;
  }

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const bands = [
      { c: state.mist1, y: g.H * 0.27, v: 1.0, a: 0.5 },
      { c: state.mist2, y: g.H * 0.41, v: -1.5, a: 0.6 },
    ];
    for (const b of bands) {
      const off = -(((t * g.U * b.v) % b.c.width) + b.c.width) % b.c.width;
      ctx.globalAlpha = Math.min(1, b.a * state.mistA * amount);
      ctx.drawImage(b.c, off, b.y);
      ctx.drawImage(b.c, off + b.c.width, b.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawBoat(ctx, g, t) {
    const p = ((t + BOAT_SECONDS * 0.3) % BOAT_SECONDS) / BOAT_SECONDS;
    const b = state.boat;
    const x = lerp(g.W, -b.width, p);
    const y = g.H * 0.72 + Math.sin(t * 0.8) * g.U * 0.35;
    ctx.globalAlpha = 0.25;
    ctx.drawImage(b, x, y + b.height * 2 - 1, b.width, -b.height);
    ctx.globalAlpha = 1 - state.dark * 0.2;
    ctx.drawImage(b, x, y);
    ctx.globalAlpha = 1;
  }

  function drawLeaves(ctx, g, t, amount) {
    const n = Math.min(LEAVES, Math.round(LEAVES * amount));
    const s = Math.max(2, g.U * 1.2);
    for (let i = 0; i < n; i++) {
      const life = ((t * state.lv[i] * 0.045 + state.lp[i]) % 1 + 1) % 1;
      const x = g.W * (0.45 + state.lx[i] * 0.55) - life * g.W * 0.35 + Math.sin(t * 0.9 + i * 1.7) * g.U * 2;
      const y = g.H * 0.08 + life * g.H * 0.85;
      const flip = Math.abs(Math.sin(t * 1.6 + i));
      ctx.fillStyle = i % 3 === 0 ? '#d9a73a' : '#c4452a';
      ctx.globalAlpha = (0.9 - state.dark * 0.4) * smoothstep(0, 0.05, life) * (1 - smoothstep(0.9, 1, life));
      ctx.fillRect(x, y, s, Math.max(1, s * (0.3 + flip * 0.6)));
    }
    ctx.globalAlpha = 1;
  }

  function fill(n, f) {
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = f();
    return a;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    const rand = K.rng(5);
    state.mist1 = paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.12), 21);
    state.mist2 = paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.11), 33);
    state.boat = paintBoat(g);
    state.gx = fill(GLINTS, rand);
    state.gy = fill(GLINTS, rand);
    state.gv = fill(GLINTS, rand);
    state.gp = fill(GLINTS, () => rand() * 6.3);
    state.lx = fill(LEAVES, rand);
    state.lp = fill(LEAVES, rand);
    state.lv = fill(LEAVES, () => 0.6 + rand() * 0.8);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.top, 0, 0);
    drawWater(ctx, g, t);
    drawGlints(ctx, g, t);
    drawMist(ctx, g, t, props.mist);
    ctx.drawImage(state.bridge, 0, 0);
    if (props.boat) drawBoat(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawLeaves(ctx, g, t, props.leaves);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, leaves: 1, boat: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
