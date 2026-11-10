/*
 * モモンガ Momonga — a Japanese dwarf flying squirrel glides between huge cedars
 * under a full moon.
 *
 * Sky, moon, far cedars, mid cedars, the two near trunks, ground and lantern are all
 * baked once. Mist is two thin tiling strips that slide sideways. The squirrel is one
 * cached sprite (seen from below: square membrane, four splayed paws, ears, eye,
 * flat tail) carried on a slow falling arc from trunk to trunk and back again.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep, clamp } = K;
  const TAU = Math.PI * 2;

  const SKY = ['#151a36', '#1e2650', '#2c3866', '#41507c'];
  const MOON = { disc: '#efe7cd', glow: '#9fa8c8', sea: '#d6cfb4' };
  const NEAR = { dark: [16, 16, 22], mid: [58, 52, 50], lit: [168, 152, 124], moss: [62, 84, 52] };
  const MIDT = { dark: [18, 20, 34], mid: [50, 52, 70], lit: [158, 156, 150] };
  const FAR = { dark: [26, 32, 58], mid: [40, 48, 80], lit: [96, 108, 146] };
  const GROUND = ['#14181a', '#212b24', '#34452f'];
  const STONE = { dark: '#4a4d4c', mid: '#74776f', lit: '#a2a28f' };
  const FIRE = '#d6a84a';
  const FUR = { back: '#8a6a4a', edge: '#4a3626', belly: '#cdbd98', rim: '#f2e8cc', eye: '#0f0f14', head: '#9c7a56' };
  const GLIDE_SECONDS = 15;
  const PAUSE_SECONDS = 2.5;
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

  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    return { W, H, U, gy: Math.round(H * 0.85), mx: W * 0.6, my: H * 0.27 };
  }

  // ---- sky and moon --------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.H);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / (g.H * 0.85)) * (inks.length - 1);
      const k = Math.min(inks.length - 2, Math.floor(f));
      for (let x = 0; x < g.W; x++) {
        const ink = inks[k + (rand() < f - k ? 1 : 0)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#c3c8dc';
    for (let i = 0; i < 40; i++) {
      const x = rand() * g.W;
      const y = rand() * g.H * 0.5;
      if (Math.hypot(x - g.mx, y - g.my) < g.U * 24) continue;
      ctx.globalAlpha = 0.35 + rand() * 0.45;
      ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function paintMoon(ctx, g) {
    const r = g.U * 11;
    ctx.fillStyle = MOON.glow;
    for (let i = 5; i >= 1; i--) {
      ctx.globalAlpha = 0.06;
      blob(ctx, g.mx, g.my, r * (1 + i * 0.5), r * (1 + i * 0.5));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = MOON.disc;
    blob(ctx, g.mx, g.my, r, r);
    ctx.fillStyle = MOON.sea;
    blob(ctx, g.mx - r * 0.3, g.my - r * 0.2, r * 0.26, r * 0.2);
    blob(ctx, g.mx + r * 0.25, g.my + r * 0.3, r * 0.3, r * 0.22);
    blob(ctx, g.mx + r * 0.12, g.my - r * 0.45, r * 0.15, r * 0.1);
  }

  // ---- cedar trunks --------------------------------------------------------

  // Bakes one cedar trunk column by column: rounded shading lit from the moon side,
  // deep vertical bark furrows, a few horizontal bark breaks and a moss foot.
  function trunk(ctx, g, rand, x, w, top, bottom, ink, opts) {
    const toMoon = x < g.mx ? 1 : -1;
    const cols = Math.ceil(w);
    const furrows = [];
    for (let i = 0; i < cols; i++) furrows.push(rand());
    for (let i = 0; i < cols; i++) {
      const u = (i + 0.5) / cols * 2 - 1; // -1 .. 1 across trunk
      const round = Math.sqrt(Math.max(0, 1 - u * u));
      const side = clamp(0.5 + 0.5 * u * toMoon, 0, 1);
      let light = round * 0.3 + Math.pow(side, 1.6) * round * 0.85;
      const groove = furrows[i] < 0.3 ? -0.35 : furrows[i] > 0.85 ? 0.18 : 0;
      light = clamp(light + groove * (0.4 + side), 0, 1);
      const base = light < 0.5 ? mix(ink.dark, ink.mid, light * 2) : mix(ink.mid, ink.lit, (light - 0.5) * 2);
      ctx.fillStyle = rgb(base);
      const flare = (1 - round) * g.U * 6 * (opts.flare || 0);
      ctx.fillRect(x - w / 2 + i, top, 1, bottom - top + flare);
    }
    ctx.fillStyle = rgb(ink.dark);
    for (let i = 0; i < (opts.breaks || 0); i++) {
      const by = top + rand() * (bottom - top);
      const bx = x - w / 2 + rand() * w * 0.8;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(bx, by, w * (0.1 + rand() * 0.2), Math.max(1, g.U * 0.4));
    }
    ctx.globalAlpha = 1;
    if (opts.moss) {
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = rgb(mix(ink.moss, ink.lit, rand() * 0.25));
        ctx.globalAlpha = 0.8;
        blob(ctx, x - w / 2 + rand() * w, bottom - rand() * g.U * 10, g.U * (0.8 + rand()), g.U * (0.6 + rand() * 0.8));
      }
      ctx.globalAlpha = 1;
    }
  }

  // A cedar bough: dark branch with layered drooping needle sprays.
  function bough(ctx, g, rand, x, y, len, dir, ink) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, g.U * 0.9);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + dir * len * 0.5, y - g.U * 2, x + dir * len, y + g.U * 1.5);
    ctx.stroke();
    ctx.fillStyle = ink;
    for (let i = 0; i < 9; i++) {
      const f = 0.25 + i * 0.09;
      blob(ctx, x + dir * len * f, y + g.U * (1 + f * 1.2), g.U * (3.4 - f * 2), g.U * (1 + rand() * 0.5), dir * 0.15);
    }
  }

  function paintFar(ctx, g, rand) {
    for (let i = 0; i < 8; i++) {
      const x = g.W * (i + 0.5 + (rand() - 0.5) * 0.6) / 8;
      if (Math.abs(x - g.mx) < g.U * 16) continue;
      ctx.globalAlpha = 0.85;
      trunk(ctx, g, rand, x, g.U * (3.5 + rand() * 2), 0, g.gy, FAR, {});
    }
    ctx.globalAlpha = 1;
  }

  function paintMid(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const xs = [g.W * 0.3, g.W * 0.8];
    xs.forEach((x, i) => {
      trunk(ctx, g, rand, x, g.U * 11, 0, g.gy + g.U, MIDT, { breaks: 14, flare: 0.6 });
      bough(ctx, g, rand, x, g.H * (0.16 + i * 0.08), g.U * 16, i ? -1 : 1, rgb(MIDT.dark));
      bough(ctx, g, rand, x, g.H * (0.5 - i * 0.08), g.U * 11, i ? 1 : -1, rgb(MIDT.dark));
    });
    return c;
  }

  function rope(ctx, g, x, y, w) {
    ctx.strokeStyle = '#c9b88a';
    ctx.lineWidth = Math.max(1, g.U * 1);
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.quadraticCurveTo(x, y + g.U * 3, x + w / 2, y);
    ctx.stroke();
    ctx.fillStyle = '#e4dcc4';
    for (let i = 0; i < 3; i++) {
      const sx = x - w * 0.3 + i * w * 0.3;
      const sy = y + g.U * (1.8 - Math.abs(i - 1) * 0.2);
      ctx.fillRect(sx, sy, Math.max(1, g.U * 0.8), g.U * 3);
    }
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const lx = g.W * 0.06;
    const rx = g.W * 0.95;
    trunk(ctx, g, rand, lx, g.U * 18, 0, g.gy + g.U * 3, NEAR, { breaks: 24, moss: true, flare: 1 });
    trunk(ctx, g, rand, rx, g.U * 20, 0, g.gy + g.U * 3, NEAR, { breaks: 26, moss: true, flare: 1 });
    rope(ctx, g, lx, g.H * 0.6, g.U * 18.5);
    bough(ctx, g, rand, lx + g.U * 6, g.H * 0.09, g.U * 26, 1, rgb(NEAR.dark));
    bough(ctx, g, rand, rx - g.U * 6, g.H * 0.15, g.U * 30, -1, rgb(NEAR.dark));
    return c;
  }

  // ---- ground and lantern --------------------------------------------------

  function paintGround(g, rand) {
    const c = layer(g.W, g.H - g.gy + g.U * 2);
    const ctx = c.getContext('2d');
    const h = c.height;
    ctx.fillStyle = GROUND[0];
    ctx.fillRect(0, 0, g.W, h);
    for (let x = 0; x < g.W; x += g.U * (1 + rand() * 2)) {
      ctx.fillStyle = GROUND[1 + (rand() < 0.4 ? 1 : 0)];
      blob(ctx, x, g.U * (1 + rand() * 3), g.U * (1.5 + rand() * 3), g.U * (0.6 + rand() * 0.8));
    }
    ctx.strokeStyle = GROUND[2];
    ctx.lineWidth = 1;
    for (let i = 0; i < 90; i++) {
      const x = rand() * g.W;
      const y = g.U * (1 + rand() * 11);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * g.U * 1.5, y - g.U * (1 + rand() * 1.8));
      ctx.stroke();
    }
    return c;
  }

  function paintLantern(g) {
    const u = g.U * 1.3;
    const x = g.W * 0.45;
    const y = g.gy + u * 2.5;
    const c = layer(u * 24, u * 26);
    const ctx = c.getContext('2d');
    const cx = c.width / 2;
    const by = c.height - u * 2;
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = FIRE;
    for (let i = 3; i >= 1; i--) blob(ctx, cx, by - u * 8, u * i * 2.6, u * i * 2.4);
    ctx.globalAlpha = 1;
    const part = (ink, px, py, w, h) => {
      ctx.fillStyle = ink;
      ctx.fillRect(cx + px - w / 2, by - py - h, w, h);
    };
    part(STONE.dark, 0, 0, u * 6, u * 1.2);
    part(STONE.mid, 0, u * 1.2, u * 1.9, u * 5);
    part(STONE.lit, -u * 0.6, u * 1.2, u * 0.5, u * 5);
    part(STONE.mid, 0, u * 6.2, u * 4.6, u * 0.9);
    part(STONE.dark, 0, u * 7.1, u * 3.8, u * 3);
    part(FIRE, 0, u * 7.7, u * 1.8, u * 1.8);
    ctx.fillStyle = STONE.mid;
    ctx.beginPath();
    ctx.moveTo(cx - u * 4.4, by - u * 10.1);
    ctx.lineTo(cx + u * 4.4, by - u * 10.1);
    ctx.lineTo(cx + u * 1.5, by - u * 12.6);
    ctx.lineTo(cx - u * 1.5, by - u * 12.6);
    ctx.fill();
    part(STONE.lit, 0, u * 12.6, u * 1.2, u * 1);
    return { c, x: x - cx, y: y - by };
  }

  // ---- mist ----------------------------------------------------------------

  function paintMist(g, seed, thick) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.09);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 14), y / (g.U * 3), 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.42, 0.7, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 176;
        img.data[i + 1] = 188;
        img.data[i + 2] = 212;
        img.data[i + 3] = a * thick;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMist(ctx, g, strip, t, speed, y, alpha) {
    if (alpha <= 0) return;
    const w = strip.width;
    const a = (t * g.U * speed) % w;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(strip, -a, y);
    ctx.drawImage(strip, w - a, y);
    ctx.globalAlpha = 1;
  }

  // ---- squirrel ------------------------------------------------------------

  // Seen from below, head to the right: a square patagium stretched between four
  // splayed paws, pale belly, round head with two ears and a dark eye, flat tail.
  function paintSquirrel(g) {
    const u = g.U * 1.5;
    const w = Math.ceil(u * 26);
    const h = Math.ceil(u * 16);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const cx = w * 0.56;
    const cy = h * 0.5;
    const P = (x, y) => [cx + x * u, cy + y * u];
    const fillPath = (pts, ink) => {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i];
        if (p.length === 4) ctx.quadraticCurveTo(p[0], p[1], p[2], p[3]);
        else ctx.lineTo(p[0], p[1]);
      }
      ctx.closePath();
      ctx.fill();
    };
    const Q = (qx, qy, x, y) => [...P(qx, qy), ...P(x, y)];
    // flat tail behind, slightly wider at the tip
    fillPath([P(-3.5, -0.9), Q(-8, -1.6, -12.5, -1.4), Q(-13.6, 0, -12.5, 1.4), Q(-8, 1.6, -3.5, 0.9)], FUR.edge);
    fillPath([P(-3.5, -0.5), Q(-8, -1.0, -12, -0.8), Q(-12.8, 0, -12, 0.8), Q(-8, 1.0, -3.5, 0.5)], FUR.back);
    // membrane: four paw corners joined by gently sagging edges
    const membrane = (s, ink) => [
      P(4.2 * s, -6 * s), Q(0, -4.2 * s, -4.4 * s, -6.2 * s),
      Q(-3.2 * s, 0, -4.4 * s, 6.2 * s), Q(0, 4.2 * s, 4.2 * s, 6 * s),
      Q(3.0 * s, 0, 4.2 * s, -6 * s),
    ];
    fillPath(membrane(1, FUR.edge), FUR.edge);
    fillPath(membrane(0.86, FUR.back), FUR.back);
    // paws stick out at the corners
    ctx.fillStyle = FUR.edge;
    [[4.6, -6.4], [-4.8, -6.6], [-4.8, 6.6], [4.6, 6.4]].forEach(([x, y]) => blob(ctx, ...P(x, y), u * 0.8, u * 0.7));
    // pale belly
    ctx.fillStyle = FUR.belly;
    blob(ctx, ...P(0.4, 0), u * 2.4, u * 1.5);
    ctx.fillStyle = FUR.rim;
    blob(ctx, ...P(0.8, -0.3), u * 1.1, u * 0.6);
    // head
    ctx.fillStyle = FUR.edge;
    blob(ctx, ...P(5.6, 0), u * 2.6, u * 2.4);
    fillPath([P(4.8, -1.4), P(5.0, -4.2), P(6.8, -1.8)], FUR.edge);
    fillPath([P(4.8, 1.4), P(5.0, 4.2), P(6.8, 1.8)], FUR.edge);
    ctx.fillStyle = FUR.head;
    blob(ctx, ...P(5.6, 0), u * 2.2, u * 2.0);
    ctx.fillStyle = FUR.belly;
    blob(ctx, ...P(6.5, 0), u * 1.0, u * 1.2);
    // big dark eyes with a moonlit catchlight
    ctx.fillStyle = FUR.eye;
    blob(ctx, ...P(6.0, -1.1), u * 0.65, u * 0.6);
    blob(ctx, ...P(6.0, 1.1), u * 0.65, u * 0.6);
    ctx.fillStyle = FUR.rim;
    ctx.fillRect(...P(6.1, -1.4), Math.max(1, u * 0.3), Math.max(1, u * 0.3));
    return { c, ox: cx, oy: cy };
  }

  function drawSquirrel(ctx, g, t) {
    const leg = GLIDE_SECONDS + PAUSE_SECONDS;
    const n = Math.floor(t / leg);
    const k = Math.min(1, (t - n * leg) / GLIDE_SECONDS);
    const dir = n % 2 === 0 ? 1 : -1;
    const x0 = dir > 0 ? g.W * 0.1 : g.W * 0.9;
    const x1 = dir > 0 ? g.W * 0.9 : g.W * 0.1;
    const e = k * k * (3 - 2 * k) * 0.35 + k * 0.65;
    const x = lerp(x0, x1, e);
    const y = g.H * 0.2 + Math.sin(k * Math.PI * 0.85) * g.H * 0.28 + Math.sin(t * 0.7) * g.U * 0.8;
    const tilt = dir * (0.32 - k * 0.42);
    const sp = state.squirrel;
    const breathe = 1 + Math.sin(t * 1.3) * 0.04;
    const cs = Math.cos(tilt);
    const sn = Math.sin(tilt);
    ctx.setTransform(cs * dir, sn * dir, -sn * breathe, cs * breathe, x, y);
    ctx.drawImage(sp.c, -sp.ox, -sp.oy);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    const back = layer(g.W, g.H);
    const bctx = back.getContext('2d');
    paintSky(bctx, g, rand);
    paintMoon(bctx, g);
    paintFar(bctx, g, rand);
    state.g = g;
    state.back = back;
    state.mid = paintMid(g, rand);
    state.front = paintFront(g, rand);
    state.ground = paintGround(g, rand);
    state.lantern = paintLantern(g);
    state.mistA = paintMist(g, 31, 120);
    state.mistB = paintMist(g, 57, 140);
    state.squirrel = paintSquirrel(g);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { mist, lantern } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawMist(ctx, g, state.mistA, t, 0.7, g.H * 0.4, mist * 0.45);
    ctx.drawImage(state.mid, 0, 0);
    drawSquirrel(ctx, g, t);
    ctx.drawImage(state.ground, 0, g.gy);
    if (lantern) {
      const l = state.lantern;
      ctx.drawImage(l.c, l.x, l.y);
    }
    drawMist(ctx, g, state.mistB, t + 40, 1.6, g.H * 0.76, mist * 0.6);
    ctx.drawImage(state.front, 0, 0);
  }

  Kasuri.run({
    defaults: { mist: 1, lantern: true, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
