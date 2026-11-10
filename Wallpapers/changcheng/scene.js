/*
 * 长城 Great Wall — the wall climbing a mountain ridge in autumn.
 *
 * Sky, far ridges, the wall with its watchtowers and the maple woods are
 * baked into layers and repainted once a minute from the clock. Between
 * repaints only two mist banks, the beacon smoke and a few leaves move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const RETINT_SECONDS = 60;
  const MAX_SMOKE = 12;
  const MAX_LEAVES = 30;
  const TOWERS = [0.1, 0.29, 0.5, 0.7, 0.88];
  const BEACON = 3;
  const LEAF_INK = ['#c4482c', '#d0a040', '#a8382a', '#d8b050'];
  // Tree kinds: crown colour, highlight colour, share of the woods.
  const KINDS = [
    { ink: '#3a5636', hi: '#62804e', pine: true, p: 0.26 },
    { ink: '#9c3626', hi: '#c95a38', p: 0.34 },
    { ink: '#a87a2c', hi: '#d2a64a', p: 0.22 },
    { ink: '#7a4a2a', hi: '#a86a3a', p: 0.18 },
  ];
  const state = {};

  const rgb = (h) => parseColor(h);
  const hex = (c) => toHex(c);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Tint a colour by the light of the hour.
  function lit(sky, c, amount) {
    const base = mixColor(rgb(c), sky.amb, amount === undefined ? 0.18 : amount);
    return hex(mixColor(base, rgb('#10131e'), sky.night * 0.62));
  }

  // ---- shapes ------------------------------------------------------------

  // Height of the main ridge crest at x: rising from lower left to upper right.
  function crest(g, x) {
    const u = x / g.W;
    return g.H * (0.72 - 0.4 * u) + Math.sin(u * 9 + 0.6) * g.H * 0.032 + Math.sin(u * 23) * g.H * 0.01
      + (fbm(x * 0.03, 3, 3, 8) - 0.5) * g.U * 1.6;
  }

  function farRidge(g, x, k) {
    const u = x / g.W;
    return g.H * (0.46 - 0.1 * k) + Math.sin(u * (5 + k * 3) + k * 2) * g.H * (0.05 - k * 0.01)
      + (fbm(x * 0.02, k * 7, 4, 17) - 0.5) * g.H * 0.08;
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.75);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.45);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintOrb(ctx, g, sky);
    return c;
  }

  function paintOrb(ctx, g, sky) {
    const night = sky.night > 0.5;
    const t = night ? S.moonT(sky.hour) : S.sunT(sky.hour);
    const px = g.W * (0.12 + 0.5 * t);
    const py = g.H * (0.26 - 0.16 * Math.sin(Math.PI * t));
    const r = g.U * (night ? 3.2 : 3.8);
    const halo = ctx.createRadialGradient(px, py, 0, px, py, r * 5);
    halo.addColorStop(0, night ? 'rgba(220,226,240,0.28)' : 'rgba(250,224,170,0.4)');
    halo.addColorStop(1, 'rgba(250,224,170,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(px - r * 5, py - r * 5, r * 10, r * 10);
    ctx.fillStyle = night ? '#e4e4da' : '#f3dfae';
    ctx.beginPath();
    ctx.arc(px, py, r, 0, 6.3);
    ctx.fill();
  }

  // ---- far ridges --------------------------------------------------------

  // Indigo ranges, darker toward the front, so the pale wall stands off them.
  function paintFar(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    for (let k = 2; k >= 0; k--) {
      const tone = mixColor(mixColor(rgb('#3e4c66'), sky.haze, 0.18 + k * 0.16), sky.low, 0.06 + k * 0.12);
      ctx.fillStyle = hex(mixColor(tone, rgb('#141828'), sky.night * 0.55));
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, farRidge(g, x, k) + k * g.U * 2);
      ctx.lineTo(g.W, g.H);
      ctx.fill();
    }
    return c;
  }

  // ---- main ridge and woods ----------------------------------------------

  function paintSlope(ctx, g, sky, rand) {
    const grad = ctx.createLinearGradient(0, g.H * 0.3, 0, g.H);
    grad.addColorStop(0, lit(sky, '#56623f'));
    grad.addColorStop(1, lit(sky, '#253026'));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, crest(g, x));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    // Soft gullies running down from the crest.
    ctx.fillStyle = lit(sky, '#1c241e');
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 9; i++) {
      const x = (i + 0.3 + rand() * 0.4) * g.W / 9;
      const y = crest(g, x) + g.U * 3;
      ctx.beginPath();
      ctx.moveTo(x - g.U, y);
      ctx.quadraticCurveTo(x + g.U * 3, y + g.H * 0.2, x - g.U * 2, g.H);
      ctx.lineTo(x + g.U * 4, g.H);
      ctx.quadraticCurveTo(x + g.U * 5, y + g.H * 0.2, x + g.U, y);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function pickKind(r) {
    let acc = 0;
    for (const k of KINDS) {
      acc += k.p;
      if (r < acc) return k;
    }
    return KINDS[KINDS.length - 1];
  }

  // One tree: shadow, trunk, a clumped crown and a lit top-left side.
  function paintTree(ctx, sky, rand, t) {
    const { x, y, r, kind } = t;
    ctx.fillStyle = lit(sky, '#161c18', 0.05);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(x + r * 0.3, y + r * 0.45, r * 1.15, r * 0.8, 0, 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (r > 1.6) {
      ctx.fillStyle = lit(sky, '#2a2420', 0.05);
      ctx.fillRect(x - Math.max(0.5, r * 0.08), y, Math.max(1, r * 0.16), r * 1.3);
    }
    const base = lit(sky, kind.ink, 0.12);
    const hi = lit(sky, kind.hi, 0.12);
    if (kind.pine) {
      ctx.fillStyle = base;
      for (let k = 0; k < 3; k++) {
        const ty = y + r * 0.5 - k * r * 0.6;
        const tw = r * (1.1 - k * 0.28);
        ctx.beginPath();
        ctx.moveTo(x - tw, ty);
        ctx.lineTo(x + tw, ty);
        ctx.lineTo(x, ty - r * 0.95);
        ctx.fill();
      }
      ctx.fillStyle = hi;
      ctx.fillRect(x - r * 0.5, y - r * 0.3, Math.max(1, r * 0.35), Math.max(1, r * 0.2));
      return;
    }
    ctx.fillStyle = base;
    for (let k = 0; k < 5; k++) {
      const a = rand() * 6.3;
      const d = r * 0.45 * rand();
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, r * (0.5 + rand() * 0.25), 0, 6.3);
      ctx.fill();
    }
    ctx.fillStyle = hi;
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      ctx.arc(x - r * (0.2 + rand() * 0.25), y - r * (0.25 + rand() * 0.2), r * (0.28 + rand() * 0.12), 0, 6.3);
      ctx.fill();
    }
  }

  // Plan the woods once: smaller, denser near the crest; fewer, larger below,
  // left in clumps (groves) so moss and shadow show between them.
  function planWoods(g) {
    const rand = K.rng(91);
    const trees = [];
    const groves = Math.max(30, Math.round(g.W * 0.36));
    for (let i = 0; i < groves; i++) {
      const gx = rand() * g.W;
      const depth = Math.pow(rand(), 1.4);
      const n = 3 + Math.floor(rand() * 4 + (1 - depth) * 4);
      for (let k = 0; k < n; k++) {
        const x = gx + (rand() - 0.5) * g.U * (5 + depth * 10);
        const c = crest(g, x);
        const y = c + g.U * 3.5 + depth * (g.H - c) * 0.95 + (rand() - 0.5) * g.U * 2;
        trees.push({ x, y, r: g.U * (0.9 + depth * 2.6 + rand() * 0.6), kind: pickKind(rand()) });
      }
    }
    // A fringe of small crowns just under the wall.
    for (let i = 0; i < g.W * 0.5; i++) {
      const x = rand() * g.W;
      if (fbm(x * 0.05, 1, 2, 33) < 0.45) continue;
      trees.push({ x, y: crest(g, x) + g.U * (4 + rand() * 6), r: g.U * (0.7 + rand() * 0.5), kind: pickKind(rand()) });
    }
    // Two big maples close by in the lower corners frame the view.
    const corner = [[0.04, 0.95, 6.5, 1], [0.13, 1.0, 5, 2], [0.95, 0.94, 6, 1], [0.86, 1.0, 5, 3], [0.99, 0.84, 4, 2]];
    for (const [fx, fy, s, kind] of corner) trees.push({ x: g.W * fx, y: g.H * fy, r: g.U * s, kind: KINDS[kind] });
    trees.sort((a, b) => a.y - b.y);
    return trees;
  }

  // ---- wall and towers ----------------------------------------------------

  function paintWall(ctx, g, sky) {
    const U = g.U;
    const face = U * 3.6;
    const above = U * 1.6;
    const stone = lit(sky, '#a9a493', 0.2);
    const shade = lit(sky, '#4c4a46', 0.15);
    const dark = lit(sky, '#262628', 0.08);
    const cap = lit(sky, '#d6d0bc', 0.22);
    const step = 1;
    const period = Math.max(3, Math.round(U * 1.8));
    const merH = Math.max(2, Math.round(U * 1.2));
    for (let x = 0; x < g.W; x += step) {
      const y = crest(g, x) - above;
      // Shadow cast onto the slope, then the shaded lower face, then the lit upper face.
      ctx.fillStyle = dark;
      ctx.fillRect(x, y, step, face + U * 1.4);
      ctx.fillStyle = shade;
      ctx.fillRect(x, y, step, face);
      ctx.fillStyle = stone;
      ctx.fillRect(x, y, step, face * 0.45);
      ctx.fillStyle = cap;
      ctx.fillRect(x, y, step, Math.max(1, U * 0.45));
      // Merlons: solid teeth with clear gaps.
      if (x % period < period * 0.55) {
        ctx.fillStyle = stone;
        ctx.fillRect(x, y - merH, step, merH);
        ctx.fillStyle = cap;
        ctx.fillRect(x, y - merH, step, 1);
      } else {
        ctx.fillStyle = dark;
        ctx.fillRect(x, y - 1, step, 1);
      }
    }
  }

  function paintTower(ctx, g, sky, cx) {
    const U = g.U;
    const w = U * 9;
    const h = U * 9;
    const base = crest(g, cx) + U * 2;
    const x0 = cx - w / 2;
    const stone = lit(sky, '#b0ab9a', 0.2);
    const edge = lit(sky, '#5e5c56', 0.15);
    const dark = lit(sky, '#1a1c22', 0.06);
    ctx.fillStyle = dark;
    ctx.fillRect(x0 - 1, base - h, w + 2, h + U);
    ctx.fillStyle = stone;
    ctx.fillRect(x0, base - h, w, h);
    ctx.fillStyle = edge;
    ctx.fillRect(x0 + w * 0.7, base - h, w * 0.3, h);
    ctx.fillStyle = lit(sky, '#d6d0bc', 0.22);
    ctx.fillRect(x0 - U * 0.5, base - h, w + U, Math.max(1, U * 0.6));
    const merlon = Math.max(1, Math.round(U * 0.9));
    ctx.fillStyle = stone;
    for (let mx = x0 - U * 0.5; mx < x0 + w + U * 0.5; mx += merlon * 2) ctx.fillRect(mx, base - h - merlon, merlon, merlon + 1);
    // Arched windows.
    ctx.fillStyle = dark;
    for (let k = 0; k < 2; k++) {
      const wx = x0 + w * (0.18 + k * 0.42);
      ctx.fillRect(wx, base - h * 0.62, w * 0.2, h * 0.32);
      ctx.beginPath();
      ctx.arc(wx + w * 0.1, base - h * 0.62, w * 0.1, Math.PI, 0);
      ctx.fill();
    }
    // Tiled room with a broad roof and up-turned eaves.
    const rw = w * 0.66;
    const rx = cx - rw / 2;
    const rt = base - h - merlon;
    ctx.fillStyle = lit(sky, '#a8382a', 0.12);
    ctx.fillRect(rx, rt - U * 2.2, rw, U * 2.2);
    ctx.fillStyle = dark;
    ctx.fillRect(rx + rw * 0.4, rt - U * 1.6, rw * 0.2, U * 1.6);
    ctx.fillStyle = lit(sky, '#2c3038', 0.1);
    ctx.beginPath();
    ctx.moveTo(rx - U * 2.4, rt - U * 3.8);
    ctx.quadraticCurveTo(rx - U * 0.4, rt - U * 2.0, rx + U * 0.6, rt - U * 2.2);
    ctx.lineTo(rx + rw - U * 0.6, rt - U * 2.2);
    ctx.quadraticCurveTo(rx + rw + U * 0.4, rt - U * 2.0, rx + rw + U * 2.4, rt - U * 3.8);
    ctx.lineTo(cx + rw * 0.25, rt - U * 5.6);
    ctx.lineTo(cx - rw * 0.25, rt - U * 5.6);
    ctx.fill();
    ctx.fillStyle = lit(sky, '#5a5e66', 0.15);
    ctx.fillRect(cx - rw * 0.32, rt - U * 5.8, rw * 0.64, Math.max(1, U * 0.5));
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSlope(ctx, g, sky, rand);
    const trees = state.trees;
    const crestLine = (t) => t.y < crest(g, t.x) + g.U * 8;
    const treeRand = K.rng(5);
    // Trees close under the crest sit behind the wall's cast shadow; the rest in front.
    for (const t of trees) if (crestLine(t)) paintTree(ctx, sky, treeRand, t);
    paintWall(ctx, g, sky);
    for (const f of TOWERS) paintTower(ctx, g, sky, g.W * f);
    for (const t of trees) if (!crestLine(t)) paintTree(ctx, sky, treeRand, t);
    return c;
  }

  // ---- sprites -----------------------------------------------------------

  function paintMist(w, h, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const dens = (x, y) => fbm(x * 0.012, y * 0.05, 4, seed);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(dens(x, y), dens(x - c.width, y), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = 232;
        img.data[i + 1] = 234;
        img.data[i + 2] = 236;
        img.data[i + 3] = smoothstep(0.42, 0.68, v) * band * 220;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintPuff() {
    const c = layer(24, 24);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
    grad.addColorStop(0, 'rgba(232,228,218,0.85)');
    grad.addColorStop(0.5, 'rgba(232,228,218,0.45)');
    grad.addColorStop(1, 'rgba(232,228,218,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 24, 24);
    return c;
  }

  // A small five-point maple leaf.
  function paintLeaf(ink) {
    const c = layer(9, 9);
    const ctx = c.getContext('2d');
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(4.5, 0);
    ctx.lineTo(6, 3);
    ctx.lineTo(9, 2.5);
    ctx.lineTo(7, 5.5);
    ctx.lineTo(8, 8);
    ctx.lineTo(4.5, 6.5);
    ctx.lineTo(1, 8);
    ctx.lineTo(2, 5.5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(3, 3);
    ctx.fill();
    ctx.fillRect(4, 6, 1, 3);
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(47);
    state.sky = paintSky(g, sky, rand);
    state.far = paintFar(g, sky);
    state.front = paintFront(g, sky, rand);
    state.mistAlpha = 0.75 - sky.night * 0.4;
    state.dim = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawMist(ctx, g, t, amount, which) {
    if (amount <= 0) return;
    const c = state.mist[which];
    const speed = which === 0 ? 3.2 : 5;
    const off = -((t * g.U * speed) % c.width);
    const y = which === 0 ? g.H * 0.42 : g.H * 0.8;
    ctx.globalAlpha = Math.min(1, state.mistAlpha * amount * (which === 0 ? 0.95 : 0.6));
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    ctx.globalAlpha = 1;
  }

  // Beacon smoke rising and leaning from the tower roof.
  function drawSmoke(ctx, g, t) {
    const U = g.U;
    const sx = g.W * TOWERS[BEACON];
    const sy = crest(g, sx) + U * 2 - U * 9 - U * 7;
    for (let i = 0; i < MAX_SMOKE; i++) {
      const a = (t * 0.07 + i / MAX_SMOKE) % 1;
      const size = U * (2 + a * 8);
      ctx.globalAlpha = (1 - a) * Math.min(1, a * 8) * 0.85 * (1 - state.dim * 0.3);
      ctx.drawImage(state.puff, sx + Math.sin(t * 0.5 + i) * U * 0.8 + a * a * U * 14 - size / 2, sy - a * g.H * 0.2 - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawLeaves(ctx, g, t) {
    const size = Math.max(6, g.U * 4.2);
    for (let i = 0; i < MAX_LEAVES; i++) {
      const a = (t * 0.045 + i * 0.381) % 1;
      const lx = ((i * 0.173 + 0.05) % 1) * g.W + a * g.W * 0.14 + Math.sin(t * 0.8 + i * 2) * g.U * 2.5;
      const ly = g.H * (0.12 + a * 0.92);
      const flip = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.6 + i));
      const w = size * flip;
      ctx.globalAlpha = Math.min(1, a * 8) * (1 - state.dim * 0.35);
      ctx.drawImage(state.leaf[i % state.leaf.length], lx - w / 2, ly, w, size);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.mist = [paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.2), 23), paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.16), 61)];
    state.puff = paintPuff();
    state.leaf = LEAF_INK.map(paintLeaf);
    state.trees = planWoods(g);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.far, 0, 0);
    drawMist(ctx, g, t, props.mist, 0);
    ctx.drawImage(state.front, 0, 0);
    drawSmoke(ctx, g, t);
    drawMist(ctx, g, t, props.mist, 1);
    if (props.leaves) drawLeaves(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, leaves: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
