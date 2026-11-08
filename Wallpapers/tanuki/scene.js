/*
 * 狸 Tanuki — a round tanuki and two cubs foraging where a bamboo wood meets a
 * moonlit clearing.
 *
 * The wood, ground and moon are baked once. Each animal is four baked sprites
 * (body, head, two tail pieces) moved with plain transforms, plus four short
 * leg strokes. The rest is sliding layers and a few falling leaf strokes.
 * The family share the ground by reach: nobody turns toward or walks into
 * ground another one's head or rump already covers.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const MAX_LEAVES = 48;
  const LEAF_TONES = ['#d8c078', '#b98a4a', '#a9583a'];
  const SNIFF = 0;
  const WALK = 1;
  const LOOK = 2;
  const MOON_X = 0.73;
  const MOON_Y = 0.21;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // A closed smooth curve through a flat list of x, y pairs.
  function blob(ctx, pts) {
    const n = pts.length;
    ctx.beginPath();
    ctx.moveTo((pts[n - 2] + pts[0]) / 2, (pts[n - 1] + pts[1]) / 2);
    for (let i = 0; i < n; i += 2) {
      const j = (i + 2) % n;
      ctx.quadraticCurveTo(pts[i], pts[i + 1], (pts[i] + pts[j]) / 2, (pts[i + 1] + pts[j + 1]) / 2);
    }
    ctx.closePath();
  }

  function pick(rand, list) {
    return list[Math.floor(rand() * list.length)];
  }

  function ellipse(ctx, x, y, rx, ry, a, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, a, 0, 6.3);
    ctx.fill();
  }

  /* ---------- Sky, moon, cloud ---------- */

  // Flat steps, the way a woodblock print grades a sky, not a smooth ramp.
  function paintBands(ctx, g, top, bottom, from, to, steps) {
    const a = K.parseColor(from);
    const b = K.parseColor(to);
    const h = (bottom - top) / steps;
    for (let i = 0; i < steps; i++) {
      ctx.fillStyle = K.toHex(K.mixColor(a, b, i / (steps - 1)));
      ctx.fillRect(0, top + i * h, g.W, h + 1);
    }
  }

  // The halo rings live on their own layer, so the moonlight slider can turn them up.
  function paintHalo(g) {
    const c = layer(g.W, g.H * 0.75);
    const ctx = c.getContext('2d');
    const mx = g.W * MOON_X;
    const my = g.H * MOON_Y;
    ctx.fillStyle = 'rgba(190,204,214,0.13)';
    for (const r of [48, 33, 21, 15]) {
      ctx.beginPath();
      ctx.arc(mx, my, g.U * r, 0, 6.3);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'destination-out';
    ellipse(ctx, mx, my, g.U * 9.5, g.U * 9.5, 0, '#000');
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  function paintMoon(ctx, g, mx, my) {
    ellipse(ctx, mx, my, g.U * 9.5, g.U * 9.5, 0, '#f0e8cc');
    ellipse(ctx, mx - g.U * 2.8, my - g.U * 2, g.U * 2.6, g.U * 2, 0.4, '#d8d2b8');
    ellipse(ctx, mx + g.U * 2.8, my + g.U * 2.4, g.U * 3.2, g.U * 2.2, -0.3, '#dcd6bc');
    ellipse(ctx, mx + g.U * 3.4, my - g.U * 3.6, g.U * 1.4, g.U * 1.2, 0, '#ded8be');
  }

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintBands(ctx, g, 0, g.H * 0.66, '#34476f', '#7f96b6', 8);
    paintMoon(ctx, g, g.W * MOON_X, g.H * MOON_Y);
    return c;
  }

  // A thin cloud band that tiles: blended with itself one period along.
  function paintCloud(g) {
    const w = Math.ceil(g.W * 0.75);
    const h = Math.ceil(g.H * 0.2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = 5 / w;
    for (let y = 0; y < h; y++) {
      const edge = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const a = fbm(x * f, y * f * 3, 3, 11);
        const b = fbm((x - w) * f, y * f * 3, 3, 11);
        const v = smoothstep(0.42, 0.6, lerp(a, b, x / w)) * edge;
        const i = (y * w + x) * 4;
        img.data[i] = 128;
        img.data[i + 1] = 146;
        img.data[i + 2] = 176;
        img.data[i + 3] = Math.round(v * 3) * 44;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  /* ---------- Bamboo ---------- */

  function paintStalk(ctx, g, rand, o) {
    const dx = o.lean * (o.base - o.top);
    ctx.fillStyle = o.body;
    ctx.beginPath();
    ctx.moveTo(o.x - o.w / 2, o.base);
    ctx.lineTo(o.x - o.w / 2 + dx, o.top);
    ctx.lineTo(o.x + o.w / 2 + dx, o.top);
    ctx.lineTo(o.x + o.w / 2, o.base);
    ctx.fill();
    if (o.lit) {
      ctx.fillStyle = o.lit;
      ctx.beginPath();
      ctx.moveTo(o.x + o.w * 0.1, o.base);
      ctx.lineTo(o.x + o.w * 0.1 + dx, o.top);
      ctx.lineTo(o.x + o.w * 0.48 + dx, o.top);
      ctx.lineTo(o.x + o.w * 0.48, o.base);
      ctx.fill();
    }
    const step = Math.max(g.U * 9, o.w * 3.4);
    ctx.fillStyle = o.node;
    for (let y = o.base - step * (0.4 + rand() * 0.6); y > o.top; y -= step * (0.92 + rand() * 0.16)) {
      const nx = o.x + o.lean * (o.base - y);
      ctx.fillRect(nx - o.w * 0.6, y, o.w * 1.2, Math.max(1, g.U * 0.55));
    }
  }

  function paintLeafBlade(ctx, x, y, len, a, wide) {
    const tx = x + Math.cos(a) * len;
    const ty = y + Math.sin(a) * len;
    const mx = (x + tx) / 2;
    const my = (y + ty) / 2;
    const nx = -Math.sin(a) * wide;
    const ny = Math.cos(a) * wide;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(mx + nx, my + ny, tx, ty);
    ctx.quadraticCurveTo(mx - nx, my - ny, x, y);
    ctx.fill();
  }

  // A drooping spray: a thin bent twig with blades hanging off it in bunches.
  function paintSpray(ctx, g, rand, x, y, size, tones) {
    const dir = rand() < 0.5 ? -1 : 1;
    const reach = size * (0.8 + rand() * 0.6);
    const blades = Math.round(18 + (size / g.U) * 2.4);
    ctx.strokeStyle = tones[0];
    ctx.lineWidth = Math.max(0.6, g.U * 0.3);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + dir * reach * 0.6, y - size * 0.2, x + dir * reach, y + size * 0.3);
    ctx.stroke();
    for (let i = 0; i < blades; i++) {
      const f = rand();
      const bx = x + dir * reach * f;
      const by = y + size * (f * f * 0.3 - 0.1 * Math.sin(f * 3.1)) + (rand() - 0.5) * size * 0.22;
      const a = 1.57 + dir * (rand() * 1.1 - 0.25);
      ctx.fillStyle = pick(rand, tones);
      paintLeafBlade(ctx, bx, by, g.U * (2.8 + rand() * 3.4), a, g.U * (0.6 + rand() * 0.45));
    }
  }

  // Bamboo stands thick on the left and thins out toward the open moonlit side.
  function standFade(x, g) {
    return 1 - smoothstep(g.W * 0.3, g.W * 0.62, x);
  }

  function paintFarWood(ctx, g, rand) {
    let x = -g.U * 2;
    while (x < g.W) {
      const dense = standFade(x, g);
      if (rand() < dense) {
        const tone = rand() < 0.5 ? '#7c9cba' : '#6d8eae';
        paintStalk(ctx, g, rand, {
          x, base: g.H * 0.62, top: -2, w: g.U * (1.1 + rand() * 1), lean: (rand() - 0.5) * 0.03,
          body: tone, node: '#4f6c8e', lit: null,
        });
      }
      x += g.U * (3.2 + rand() * 4.5 + (1 - dense) * 9);
    }
    const tones = ['#5f8098', '#6c90a4', '#54748e'];
    for (let i = 0; i < g.W * 0.42; i++) {
      const px = rand() * g.W;
      if (rand() < standFade(px, g)) {
        paintSpray(ctx, g, rand, px, rand() * g.H * 0.3, g.U * (4 + rand() * 7), tones);
      }
    }
  }

  function ridge(ctx, g, base, rise, seed, tone) {
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(g.W * 0.25, g.H * 0.68);
    for (let x = g.W * 0.25; x <= g.W + 2; x += 2) {
      const lift = smoothstep(g.W * 0.28, g.W * 0.72, x);
      ctx.lineTo(x, g.H * (base - lift * rise * (0.45 + fbm(x * 0.011, seed, 3, seed))));
    }
    ctx.lineTo(g.W, g.H * 0.68);
    ctx.fill();
  }

  function paintHills(ctx, g) {
    ridge(ctx, g, 0.6, 0.2, 3, '#435b7e');
    ridge(ctx, g, 0.61, 0.1, 8, '#384e6c');
  }

  // Low scrub where the clearing meets the far side, so the ground has no hard edge.
  function paintScrub(ctx, g, rand) {
    const tones = ['#44604f', '#527058', '#385246', '#688a68'];
    for (let i = 0; i < g.W * 0.5; i++) {
      const x = g.W * (0.3 + rand() * 0.72);
      const y = groundLine(x, g) + g.U * (rand() * 2.4 - 1);
      const clump = fbm(x * 0.045, 2, 2, 31);
      if (clump < 0.42) continue;
      ctx.fillStyle = pick(rand, tones);
      paintLeafBlade(ctx, x, y, g.U * (2 + clump * 5 * rand()), -1.57 + (rand() - 0.5) * 1.5, g.U * 0.6);
    }
  }

  function groundLine(x, g) {
    const rise = (1 - x / g.W) * 0.035;
    return g.H * (0.595 - rise + (fbm(x * 0.02, 7, 2, 9) - 0.5) * 0.03);
  }

  function paintGround(ctx, g, rand) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, groundLine(x, g));
    ctx.lineTo(g.W, g.H);
    ctx.clip();
    paintBands(ctx, g, g.H * 0.54, g.H, '#6e816c', '#506052', 3);
    ctx.restore();
    for (let x = 0; x < g.W; x += Math.max(0.8, g.U * 0.7)) {
      const y = groundLine(x, g);
      ctx.fillStyle = rand() < 0.5 ? '#5a7060' : '#7d927a';
      ctx.fillRect(x, y - rand() * g.U * 1.6, Math.max(1, g.U * 0.4), g.U * 2.2);
    }
  }

  function paintMidStalks(ctx, g, rand) {
    const xs = [];
    let x = g.U * 14;
    while (x < g.W * 0.46) {
      xs.push(x);
      x += g.U * (10 + rand() * 11);
    }
    xs.push(g.W * 0.87);
    for (const sx of xs) {
      const base = groundLine(sx, g) + g.U * (1 + rand() * 4);
      paintStalk(ctx, g, rand, {
        x: sx, base, top: -2, w: g.U * (2.6 + rand() * 1.3), lean: (rand() - 0.5) * 0.04,
        body: '#4a7464', node: '#2a4a40', lit: '#83ae90',
      });
      ellipse(ctx, sx, base, g.U * 2.6, g.U * 0.8, 0, '#3a4c42');
      state.bases.push(sx, base);
    }
  }

  // Thick stalks at the frame, rooted in the ground so the cubs can pass before them.
  function paintNearStalks(ctx, g, rand) {
    const stalks = [[0.02, 6.2, 0.86], [0.112, 4.4, 0.79], [0.985, 5.4, 0.84]];
    for (const [fx, w, foot] of stalks) {
      const sx = g.W * fx;
      const base = g.H * foot;
      paintStalk(ctx, g, rand, {
        x: sx, base, top: -2, w: g.U * w, lean: (rand() - 0.5) * 0.015,
        body: '#2f4e42', node: '#1b2e28', lit: '#6c9a7c',
      });
      ellipse(ctx, sx, base, g.U * w * 0.75, g.U * 1.2, 0, '#2c3a32');
      state.bases.push(sx, base);
    }
  }

  function paintWood(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    state.bases = [];
    paintHills(ctx, g);
    paintFarWood(ctx, g, rand);
    paintGround(ctx, g, rand);
    paintScrub(ctx, g, rand);
    paintMidStalks(ctx, g, rand);
    paintNearStalks(ctx, g, rand);
    return c;
  }

  function paintFoliage(g, rand, count, sizeBase, tones, topFrac, corner) {
    const c = layer(g.W + g.U * 4, g.H * 0.55);
    const ctx = c.getContext('2d');
    for (let i = 0; i < count; i++) {
      const x = rand() * g.W;
      if (rand() < standFade(x, g)) {
        paintSpray(ctx, g, rand, x + g.U * 2, rand() * g.H * topFrac, sizeBase * (0.7 + rand() * 0.8), tones);
      }
    }
    for (let i = 0; i < corner; i++) {
      paintSpray(ctx, g, rand, g.W * (0.93 + rand() * 0.08), rand() * g.H * 0.13, sizeBase * (0.6 + rand() * 0.5), tones);
    }
    return c;
  }

  /* ---------- Ground light and litter ---------- */

  // Moonlight on the clearing: stacked pale ellipses, so a few flat steps of light.
  function paintPool(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const r = Math.max(g.W * 0.5, g.U * 70);
    ctx.fillStyle = 'rgba(222,226,196,0.15)';
    for (const f of [1, 0.76, 0.52]) {
      ctx.beginPath();
      ctx.ellipse(g.W * 0.54, g.H * 0.77, r * f, r * f * 0.3, 0, 0, 6.3);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 3) ctx.lineTo(x, groundLine(x, g));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  // Long stalk shadows raked away from the moon. Baked dark and drawn at a strength
  // that follows the moonlight, so a bright moon cuts sharper bars across the pool.
  function paintRake(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const moonX = g.W * MOON_X;
    ctx.fillStyle = 'rgb(34,46,46)';
    for (let i = 0; i < state.bases.length; i += 2) {
      const sx = state.bases[i];
      const base = state.bases[i + 1];
      const run = (sx - moonX) * 0.9 - g.U * 6;
      const half = g.U * 1.5;
      ctx.beginPath();
      ctx.moveTo(sx - half * 0.7, base);
      ctx.lineTo(sx + half * 0.7, base);
      ctx.lineTo(sx + run + half * 2.2, g.H);
      ctx.lineTo(sx + run - half * 2.2, g.H);
      ctx.fill();
    }
    return c;
  }

  function paintLitterLayer(g, rand) {
    const c = layer(g.W, g.H);
    paintLitter(c.getContext('2d'), g, rand);
    return c;
  }

  function paintLitter(ctx, g, rand) {
    const tones = ['#c4a262', '#ad7c48', '#b4664a', '#d4c698', '#7c8460'];
    const count = Math.round(g.W * g.H * 0.06);
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const x = rand() * g.W;
      const f = rand();
      const y = lerp(groundLine(x, g) + g.U, g.H, f * f * 0.6 + f * 0.4);
      if (fbm(x * 0.045, y * 0.1, 2, 21) < 0.45) continue;
      const near = (y - g.H * 0.58) / (g.H * 0.42);
      const len = g.U * (0.7 + near * 1.9) * (0.6 + rand() * 0.8);
      const a = (rand() - 0.5) * 1.5 + (rand() < 0.5 ? 0 : 3.14);
      ctx.strokeStyle = pick(rand, tones);
      ctx.lineWidth = Math.max(0.8, g.U * (0.4 + near * 0.55));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len * 0.45);
      ctx.stroke();
    }
  }

  // Leaf shade on the ground. Drawn with a small slow shift, so the moonlight moves.
  function paintDapple(g, rand) {
    const pad = g.U * 8;
    const c = layer(g.W + pad * 2, g.H * 0.45);
    const ctx = c.getContext('2d');
    for (let i = 0; i < g.W * 0.16; i++) {
      const cx = rand() * c.width;
      const cy = rand() * c.height;
      const fade = 0.45 + standFade(cx - pad, g) * 0.55;
      if (rand() > fade) continue;
      const n = 3 + Math.floor(rand() * 5);
      for (let j = 0; j < n; j++) {
        const rx = g.U * (1.2 + rand() * 3.4);
        ctx.fillStyle = rand() < 0.5 ? 'rgba(38,52,50,0.2)' : 'rgba(38,52,50,0.13)';
        ctx.beginPath();
        ctx.ellipse(cx + (rand() - 0.5) * g.U * 9, cy + (rand() - 0.5) * g.U * 2.4, rx, rx * 0.3, 0, 0, 6.3);
        ctx.fill();
      }
    }
    state.dapplePad = pad;
    return c;
  }

  function paintForeground(g, rand) {
    const c = layer(g.W, g.H);
    paintTufts(c.getContext('2d'), g, rand);
    return c;
  }

  function paintTufts(ctx, g, rand) {
    const tones = ['#35503f', '#46664c', '#2c4438', '#648660'];
    const blades = Math.round(g.W * 0.55);
    for (let i = 0; i < blades; i++) {
      const x = rand() * g.W;
      const edge = Math.abs(x / g.W - 0.5) * 2;
      if (rand() > edge * edge * 1.1 + 0.05) continue;
      const h = g.U * (2.5 + rand() * 7) * (0.5 + edge * 0.7);
      const lean = (rand() - 0.5) * h * 0.8;
      ctx.strokeStyle = pick(rand, tones);
      ctx.lineWidth = Math.max(0.8, g.U * 0.55);
      ctx.beginPath();
      ctx.moveTo(x, g.H + 1);
      ctx.quadraticCurveTo(x + lean * 0.2, g.H - h * 0.6, x + lean, g.H - h);
      ctx.stroke();
    }
  }

  /* ---------- The animals, in sprite units where one unit is s cells ---------- */

  function sprite(s, x0, y0, x1, y1, paint) {
    const w = x1 - x0;
    const h = y1 - y0;
    const c = layer(w * s, h * s);
    const ctx = c.getContext('2d');
    ctx.scale(c.width / w, c.height / h);
    ctx.translate(-x0, -y0);
    ctx.lineCap = 'round';
    paint(ctx);
    return { c, x: x0, y: y0, w, h };
  }

  function furMarks(ctx, rand, n, box, tones, angle, len, wide) {
    ctx.lineWidth = wide;
    for (let i = 0; i < n; i++) {
      const x = box[0] + rand() * (box[2] - box[0]);
      const y = box[1] + rand() * (box[3] - box[1]);
      const a = angle + (rand() - 0.5) * 0.9;
      const l = len * (0.6 + rand() * 0.8);
      ctx.strokeStyle = pick(rand, tones);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
  }

  // Short tufts breaking the outline, so the coat reads as fur and not as a balloon.
  function fluffEdge(ctx, rand, pts, tones, len, wide) {
    let cx = 0;
    let cy = 0;
    const n = pts.length / 2;
    for (let i = 0; i < n; i++) {
      cx += pts[i * 2] / n;
      cy += pts[i * 2 + 1] / n;
    }
    ctx.lineWidth = wide;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      for (let f = 0; f < 1; f += 0.2) {
        const x = lerp(pts[i * 2], pts[j * 2], f);
        const y = lerp(pts[i * 2 + 1], pts[j * 2 + 1], f);
        const a = Math.atan2(y - cy, x - cx) + (rand() - 0.5) * 0.9;
        const px = lerp(x, cx, 0.1);
        const py = lerp(y, cy, 0.1);
        ctx.strokeStyle = pick(rand, tones);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
        ctx.stroke();
      }
    }
  }

  const BODY = [-18, -14, -18, -31, -6, -40, 8, -40, 17, -31, 19, -17, 12, -9, -3, -8, -15, -9];

  // The dark saddle and belly are laid on thin, then broken up with long hairs both
  // ways across their edges, so the coat grades instead of reading as a shell.
  function paintCoatMarkings(ctx, rand, look, fine) {
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = look.saddle;
    blob(ctx, [-16, -35, -5, -46, 9, -46, 19, -35, 12, -31, 2, -33, -7, -32, -15, -31]);
    ctx.fill();
    ctx.fillStyle = look.under;
    blob(ctx, [-24, -9, -10, -13, 9, -12, 24, -15, 24, -3, -24, -3]);
    ctx.fill();
    ctx.globalAlpha = 1;
    furMarks(ctx, rand, 80, [-16, -43, 18, -32], look.dark, 2.85, 3.6, fine);
    furMarks(ctx, rand, 46, [-17, -35, 15, -27], look.dark, 2.2, 4.2, fine);
    furMarks(ctx, rand, 30, [-17, -33, 15, -26], look.fur, 2.2, 4, fine);
    furMarks(ctx, rand, 64, [6, -32, 16, -10], look.dark, 1.9, 4.2, fine);
    furMarks(ctx, rand, 50, [-20, -17, 20, -9], look.dark, 1.9, 4, fine);
    furMarks(ctx, rand, 26, [-20, -15, 20, -8], look.fur, 1.9, 3.4, fine);
    furMarks(ctx, rand, 16, [-14, -41, 13, -36], look.rim, 2.9, 2.6, fine);
  }

  function paintBody(ctx, rand, look, s) {
    const fine = Math.max(0.55, 0.8 / s);
    fluffEdge(ctx, rand, BODY, look.edge, 2.4, fine * 1.4);
    blob(ctx, BODY);
    ctx.fillStyle = look.coat;
    ctx.fill();
    ctx.save();
    blob(ctx, BODY);
    ctx.clip();
    ellipse(ctx, -9, -20, 8.5, 10.5, 0, look.haunch);
    furMarks(ctx, rand, 170, [-20, -42, 20, -7], look.fur, 2.85, 3.6, fine);
    paintCoatMarkings(ctx, rand, look, fine);
    ctx.restore();
  }

  function paintEars(ctx, look) {
    for (const x of [-8.6, 8.6]) {
      ellipse(ctx, x, -10, 4.6, 4.8, 0, look.ear);
      ellipse(ctx, x, -9.4, 2.3, 2.6, 0, look.earIn);
    }
  }

  const HEAD = [-9, -9, 0, -11, 9, -9, 12.5, -2, 15, 5, 8, 9, 0, 11.5, -8, 9, -15, 5, -12.5, -2];

  // A wide bandit mask running down into the cheeks, pale only over the eyes and
  // along the snout: this is what keeps it a tanuki rather than a panda.
  function paintMask(ctx, look, side) {
    const x = side * 6;
    ellipse(ctx, x - side * 0.5, -6.2, 4.2, 2.3, side * 0.25, look.pale);
    ctx.fillStyle = look.mask;
    blob(ctx, [side * 1.6, -3.4, side * 7, -4.2, side * 11.6, 0.4, side * 13.6, 6, side * 8.6, 6.6, side * 3.2, 2.6]);
    ctx.fill();
    ellipse(ctx, side * 5.6, -0.8, 1.05, 1.05, 0, look.eye);
  }

  function paintFace(ctx, look) {
    ctx.fillStyle = look.brow;
    blob(ctx, [-2, -11, 2, -11, 2.2, -2, 1.5, 2, -1.5, 2, -2.2, -2]);
    ctx.fill();
    paintMask(ctx, look, -1);
    paintMask(ctx, look, 1);
    ctx.fillStyle = look.muzzle;
    blob(ctx, [-2.4, 0.6, 2.4, 0.6, 5.2, 5, 3.2, 9.6, -3.2, 9.6, -5.2, 5]);
    ctx.fill();
    ctx.fillStyle = look.mask;
    blob(ctx, [-2.3, 3.2, 2.3, 3.2, 1.2, 5.8, -1.2, 5.8]);
    ctx.fill();
    ctx.strokeStyle = look.mask;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, 5.6);
    ctx.lineTo(0, 7.6);
    ctx.stroke();
  }

  function paintHead(ctx, rand, look, s) {
    const fine = Math.max(0.55, 0.8 / s);
    paintEars(ctx, look);
    fluffEdge(ctx, rand, HEAD, look.edge, 2.2, fine * 1.3);
    blob(ctx, HEAD);
    ctx.fillStyle = look.face;
    ctx.fill();
    ctx.save();
    blob(ctx, HEAD);
    ctx.clip();
    furMarks(ctx, rand, 46, [-15, -2, -7, 10], look.fur, 2.2, 3, fine);
    furMarks(ctx, rand, 46, [7, -2, 15, 10], look.fur, 0.9, 3, fine);
    furMarks(ctx, rand, 30, [-9, -11, 9, -8], look.fur, -1.57, 2.4, fine);
    ctx.restore();
    paintFace(ctx, look);
  }

  // Tail pieces lie along minus x from the pivot at 0, 0.
  function paintTailBase(ctx, rand, look, s) {
    const fine = Math.max(0.55, 0.8 / s);
    const pts = [3, -6, -3, -8.6, -10, -8.6, -14, 0, -10, 8.6, -3, 8.6, 3, 6];
    fluffEdge(ctx, rand, pts, look.edge, 2, fine * 1.4);
    blob(ctx, pts);
    ctx.fillStyle = look.tail;
    ctx.fill();
    furMarks(ctx, rand, 50, [-13, -7, 1, 7], look.fur, 3.14, 3.2, fine);
    furMarks(ctx, rand, 26, [-13, -9, 1, -4], look.dark, 3.14, 3, fine);
    ellipse(ctx, 2, 0, 3.4, 6.6, 0, look.under);
  }

  function paintTailTip(ctx, rand, look, s) {
    const fine = Math.max(0.55, 0.8 / s);
    const pts = [3, -8, -4, -8, -10, -5.6, -15, 0, -10, 5.6, -4, 8, 3, 8];
    fluffEdge(ctx, rand, pts, look.edge, 1.8, fine * 1.4);
    blob(ctx, pts);
    ctx.fillStyle = look.tail;
    ctx.fill();
    ctx.save();
    blob(ctx, pts);
    ctx.clip();
    furMarks(ctx, rand, 30, [-7, -7, 2, 7], look.fur, 3.14, 3, fine);
    ctx.fillStyle = look.mask;
    ctx.fillRect(-18, -8, 10.5, 16);
    furMarks(ctx, rand, 16, [-10, -7, -5, 7], [look.mask], 3.14, 3, fine);
    ctx.restore();
  }

  function furLook(cub) {
    return {
      coat: cub ? '#d2b684' : '#c6a874',
      under: cub ? '#8a7254' : '#6c5740',
      saddle: cub ? '#7c664a' : '#5e4b36',
      haunch: cub ? '#c6aa7a' : '#b89a6a',
      face: cub ? '#c6ac7e' : '#b89c6e',
      pale: '#dccca0',
      tail: cub ? '#b89c70' : '#a88c60',
      ear: '#3c3029',
      dark: cub ? ['#6c5a44', '#54442f', '#94795a'] : ['#4e3f2d', '#3e3226', '#7a6244'],
      muzzle: '#ece0bc',
      brow: cub ? '#8c7454' : '#74603f',
      mask: '#1f1a1c',
      earIn: '#d0bc90',
      eye: '#efd896',
      fur: cub ? ['#e2cfa0', '#b4966a', '#94795a', '#d2b684'] : ['#d8c08c', '#a0845c', '#7a6244', '#c6a874'],
      rim: ['#e2d6ae', '#cfc098'],
      edge: cub ? ['#d2b684', '#b4966a', '#e2cfa0'] : ['#b89a6a', '#8a7050', '#d0b884'],
      leg: cub ? '#4a3c32' : '#40332b',
      legFar: '#30282a',
    };
  }

  function bakeAnimal(rand, s, cub) {
    const look = furLook(cub);
    return {
      look,
      body: sprite(s, -26, -46, 26, -4, (c) => paintBody(c, rand, look, s)),
      head: sprite(s, -19, -16, 19, 15, (c) => paintHead(c, rand, look, s)),
      tailA: sprite(s, -18, -11, 6, 11, (c) => paintTailBase(c, rand, look, s)),
      tailB: sprite(s, -18, -10, 6, 10, (c) => paintTailTip(c, rand, look, s)),
    };
  }

  function paintShadow() {
    const c = layer(64, 20);
    const ctx = c.getContext('2d');
    ctx.translate(32, 10);
    ctx.scale(1, 0.31);
    const grad = ctx.createRadialGradient(0, 0, 6, 0, 0, 32);
    grad.addColorStop(0, 'rgba(30,40,38,0.6)');
    grad.addColorStop(0.65, 'rgba(30,40,38,0.34)');
    grad.addColorStop(1, 'rgba(22,30,34,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-32, -32, 64, 64);
    return c;
  }

  // Reach is how far the animal spreads either side of its feet. Head side: the
  // snout at full sniff (23 plus nudge) and most of the head's half width.
  // Rump side: the body with its fluff, leaving the raised tail out.
  function makeAnimal(g, rand, o) {
    const s = o.size * g.fit;
    const headK = o.cub ? 1.14 : 1;
    const rear = s * 20.5;
    const min = Math.max(o.at - g.fit * o.range, rear + g.pad);
    const max = Math.max(min, Math.min(o.at + g.fit * o.range, g.W - rear - g.pad));
    return {
      art: bakeAnimal(rand, s, o.cub),
      cub: o.cub,
      s,
      headK,
      front: s * (24.8 + 14 * headK),
      rear,
      x: Math.min(max, Math.max(min, o.at)),
      y: g.H * o.foot,
      min,
      max,
      dir: o.dir,
      flip: o.dir,
      act: SNIFF,
      timer: 2 + rand() * 5,
      sniff: 1,
      walk: 0,
      stride: rand() * 6,
      pace: g.fit * (o.cub ? 3.6 : 2.8),
      seed: rand() * 20,
      rand,
    };
  }

  /* ---------- Behaviour ---------- */

  // How far a reaches toward side right now. Its head side is the full front; while
  // it turns, the side it is leaving shrinks with the flip down to the rump.
  function reach(a, side) {
    if (a.dir === side) return a.front;
    const leaving = Math.sign(a.flip) === side ? Math.abs(a.flip) : 0;
    return Math.max(a.rear, a.front * leaving);
  }

  // Free ground ahead if a faces side: its own range, the frame edge for its head,
  // and every animal that way, kept a margin clear of both their reaches.
  function room(a, side) {
    const g = state.g;
    const edge = side > 0 ? g.W - a.x : a.x;
    const range = side > 0 ? a.max - a.x : a.x - a.min;
    let free = Math.min(range, edge - a.front);
    for (const b of state.family) {
      const d = (b.x - a.x) * side;
      if (b !== a && d > 0) free = Math.min(free, d - a.front - reach(b, -side) - g.pad);
    }
    return free;
  }

  // Head for the open end of the range, or wander back; never turn to face
  // ground that is already taken.
  function chooseWalk(a) {
    const span = a.max - a.min;
    let side = a.dir;
    if (a.x <= a.min + span * 0.25) side = 1;
    else if (a.x >= a.max - span * 0.25) side = -1;
    else if (a.rand() < 0.35) side = -side;
    const need = a.pace * 1.2;
    if (room(a, side) > need) a.dir = side;
    else if (room(a, -side) > need) a.dir = -side;
    else return false;
    return true;
  }

  function nextAct(a) {
    const r = a.rand();
    if (a.act === WALK) a.act = r < 0.72 ? SNIFF : LOOK;
    else if (r < 0.6 && chooseWalk(a)) a.act = WALK;
    else a.act = a.act === SNIFF ? LOOK : SNIFF;
    const long = a.cub ? 0.7 : 1;
    if (a.act === WALK) a.timer = (5 + a.rand() * 6) * long;
    else if (a.act === SNIFF) a.timer = (5 + a.rand() * 7) * long;
    else a.timer = (3 + a.rand() * 3) * long;
  }

  // Animals only ever move by walking forward: the step is cut to the free ground
  // ahead and never pushed backwards, and a walk that runs out of room winds down
  // early enough to finish inside it.
  function stepAnimal(a, dt) {
    a.timer -= dt;
    if (a.timer <= 0) nextAct(a);
    const ease = 1 - Math.exp(-dt * 1.5);
    a.flip += (a.dir - a.flip) * (1 - Math.exp(-dt * 3.2));
    const facing = Math.abs(a.flip) > 0.92 && a.flip * a.dir > 0;
    a.walk += ((a.act === WALK && facing ? 1 : 0) - a.walk) * ease;
    a.sniff += ((a.act === LOOK ? 0 : a.act === SNIFF ? 1 : 0.32) - a.sniff) * ease;
    if (!facing) return;
    const free = room(a, a.dir);
    const move = Math.max(0, Math.min(a.pace * a.walk * dt, free));
    a.x += a.dir * move;
    a.stride += (move / (a.s * 9)) * 3.2;
    if (a.act === WALK && free < a.pace) {
      a.act = SNIFF;
      a.timer = 3 + a.rand() * 3;
    }
  }

  // Start every animal facing ground it is allowed to face.
  function settleFamily() {
    for (let pass = 0; pass < 3; pass++) {
      for (const a of state.family) {
        if (room(a, a.dir) < 0 && room(a, -a.dir) >= 0) {
          a.dir = -a.dir;
          a.flip = a.dir;
        }
      }
    }
  }

  /* ---------- Drawing the animals ---------- */

  function put(ctx, sp) {
    ctx.drawImage(sp.c, sp.x, sp.y, sp.w, sp.h);
  }

  function drawLeg(ctx, a, hip, height, offset, colour) {
    const swing = a.stride + offset;
    const fx = hip + Math.sin(swing) * 4.6 * a.walk;
    const lift = Math.max(0, Math.cos(swing)) * 2.2 * a.walk;
    ctx.strokeStyle = colour;
    ctx.beginPath();
    ctx.moveTo(hip, height);
    ctx.lineTo(fx, -2.4 - lift);
    ctx.lineTo(fx + 1.8, -1.9 - lift);
    ctx.stroke();
  }

  function drawTail(ctx, a, t) {
    const swish = Math.sin(t * (a.cub ? 1.5 : 1.05) + a.seed);
    const late = Math.sin(t * (a.cub ? 1.5 : 1.05) + a.seed - 0.9);
    ctx.save();
    ctx.translate(-14, -21);
    ctx.rotate(-0.46 + swish * 0.3 + a.walk * 0.1);
    put(ctx, a.art.tailA);
    ctx.translate(-10, 0);
    ctx.rotate(late * 0.32 - 0.05);
    put(ctx, a.art.tailB);
    ctx.restore();
  }

  function drawHead(ctx, a, t) {
    const sn = a.sniff;
    const nose = Math.sin(t * 5.5 + a.seed) * 0.55 * sn;
    const nudge = Math.sin(t * 0.8 + a.seed) * 1.8 * sn;
    const scan = Math.sin(t * 0.55 + a.seed) * 0.09 * (1 - sn);
    ctx.save();
    ctx.translate(lerp(18, 23, sn) + nudge, lerp(-40, -12.5, sn) + nose);
    ctx.rotate(lerp(-0.05, 0.3, sn) + scan);
    ctx.scale(a.headK, a.headK);
    put(ctx, a.art.head);
    ctx.restore();
  }

  function drawAnimal(ctx, a, t) {
    const face = a.flip < 0 ? Math.min(-0.22, a.flip) : Math.max(0.22, a.flip);
    const bob = Math.abs(Math.sin(a.stride)) * 0.7 * a.walk;
    const breath = 1 + Math.sin(t * 1.3 + a.seed) * 0.012;
    const look = a.art.look;
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.scale(a.s, a.s);
    ctx.drawImage(state.shadow, -30, -4.5, 60, 9);
    ctx.scale(face, 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5.6;
    drawLeg(ctx, a, 5, -14, 3.14, look.legFar);
    drawLeg(ctx, a, -13, -14, 0, look.legFar);
    drawLeg(ctx, a, 10, -14, 0, look.leg);
    drawLeg(ctx, a, -8, -14, 3.14, look.leg);
    ctx.translate(0, -bob);
    ctx.rotate(a.sniff * 0.05);
    drawTail(ctx, a, t);
    ctx.save();
    ctx.scale(1, breath);
    put(ctx, a.art.body);
    ctx.restore();
    ctx.rotate(-a.sniff * 0.05);
    drawHead(ctx, a, t);
    ctx.restore();
  }

  /* ---------- Falling leaves ---------- */

  function makeLeaves(g, rand) {
    const n = MAX_LEAVES;
    const f = new Float32Array(n * 7);
    for (let i = 0; i < n; i++) {
      f[i * 7] = g.W * (0.04 + rand() * 0.92);
      f[i * 7 + 1] = rand();
      f[i * 7 + 2] = 0.022 + rand() * 0.02;
      f[i * 7 + 3] = g.U * (2 + rand() * 5);
      f[i * 7 + 4] = rand() * 6.28;
      f[i * 7 + 5] = g.U * (1.3 + rand() * 1.1);
      f[i * 7 + 6] = g.H * (0.68 + rand() * 0.3);
    }
    state.leaves = f;
    state.leafCount = n;
  }

  function drawLeaves(ctx, g, t, amount) {
    const f = state.leaves;
    const shown = Math.min(state.leafCount, Math.round(amount * 12));
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, g.U * 0.7);
    for (let i = 0; i < shown; i++) {
      const j = i * 7;
      const life = (t * f[j + 2] + f[j + 1]) % 1;
      const y = -g.U * 4 + life * (f[j + 6] + g.U * 4);
      const w = t * 0.55 + f[j + 4];
      const x = f[j] + Math.sin(w) * f[j + 3] + life * g.U * 9;
      const a = Math.sin(w) * 1 + 0.7;
      const len = f[j + 5];
      ctx.globalAlpha = Math.min(1, (1 - life) * 9) * 0.95;
      ctx.strokeStyle = LEAF_TONES[i % 3];
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a) * len, y - Math.sin(a) * len);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- Setup and frame ---------- */

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    g.fit = g.U * Math.min(1, api.cols / (api.rows * 1.5));
    g.pad = g.fit * 2;
    const rand = K.rng(api.seed);
    state.g = g;
    state.sky = paintSky(g);
    state.halo = paintHalo(g);
    state.cloud = paintCloud(g);
    state.wood = paintWood(g, rand);
    state.pool = paintPool(g);
    state.rake = paintRake(g);
    state.litter = paintLitterLayer(g, rand);
    state.dapple = paintDapple(g, rand);
    state.midLeaves = paintFoliage(g, rand, g.W * 0.3, g.U * 11, ['#3b6658', '#4e8068', '#325650', '#78a884'], 0.34, 0);
    state.nearLeaves = paintFoliage(g, rand, g.W * 0.07, g.U * 17, ['#2c4c40', '#38604e', '#254238', '#5a8a6c'], 0.2, 7);
    state.front = paintForeground(g, rand);
    state.shadow = paintShadow();
    // The big one holds the middle; the cubs keep to either side, nearer the viewer.
    const mid = g.W * 0.5;
    state.family = [
      makeAnimal(g, rand, { size: 0.8, cub: false, at: mid, foot: 0.76, range: 24, dir: 1 }),
      makeAnimal(g, rand, { size: 0.5, cub: true, at: mid - Math.max(g.fit * 52, g.W * 0.25), foot: 0.91, range: 20, dir: 1 }),
      makeAnimal(g, rand, { size: 0.5, cub: true, at: mid + Math.max(g.fit * 52, g.W * 0.25), foot: 0.89, range: 20, dir: 1 }),
    ];
    settleFamily();
    makeLeaves(g, rand);
  }

  function drawSky(ctx, g, t, moon) {
    ctx.drawImage(state.sky, 0, 0);
    ctx.globalAlpha = Math.min(1, 0.2 + moon * 0.4);
    ctx.drawImage(state.halo, 0, 0);
    ctx.globalAlpha = 1;
    const span = state.cloud.width * 2;
    const slide = (t * g.U * 0.5) % span;
    ctx.drawImage(state.cloud, -slide, g.H * 0.08, span, state.cloud.height * 2);
    ctx.drawImage(state.cloud, span - slide, g.H * 0.08, span, state.cloud.height * 2);
  }

  // Moonlight 0 to 1 fades the pool in; 1 to 2 lays it on a second time, while the
  // stalk shadows and the halo deepen across the whole range.
  function drawGround(ctx, g, t, moon) {
    ctx.drawImage(state.wood, 0, 0);
    const breathe = 0.88 + 0.12 * Math.sin(t * 0.13);
    ctx.globalAlpha = Math.min(1, moon) * breathe;
    ctx.drawImage(state.pool, 0, 0);
    if (moon > 1) {
      ctx.globalAlpha = Math.min(1, moon - 1) * breathe;
      ctx.drawImage(state.pool, 0, 0);
    }
    ctx.globalAlpha = Math.min(1, moon * 0.2);
    ctx.drawImage(state.rake, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.litter, 0, 0);
    const dx = Math.sin(t * 0.21) * g.U * 2.4 + Math.sin(t * 0.47) * g.U * 0.9;
    ctx.drawImage(state.dapple, dx - state.dapplePad, g.H * 0.58);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const step = Math.min(dt, 0.1);
    const moon = Math.max(0, api.props.moonlight);
    drawSky(ctx, g, t, moon);
    drawGround(ctx, g, t, moon);
    ctx.drawImage(state.midLeaves, Math.sin(t * 0.34) * g.U * 0.9 - g.U * 2, 0);
    for (const a of state.family) stepAnimal(a, step);
    for (const a of state.family) drawAnimal(ctx, a, t);
    ctx.drawImage(state.front, 0, 0);
    ctx.drawImage(state.nearLeaves, Math.sin(t * 0.27 + 1) * g.U * 1.5 - g.U * 2, 0);
    drawLeaves(ctx, g, t, api.props.leaves);
  }

  Kasuri.run({
    defaults: { moonlight: 1, leaves: 1, ramp: 'lines', cell: 7, boost: 0.14, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
