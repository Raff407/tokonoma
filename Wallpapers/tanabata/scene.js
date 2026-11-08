/*
 * 七夕 Tanabata — a tall bamboo hung with paper on a warm night under the Milky Way.
 *
 * Sky, garden and veranda are baked once, and each leafy branch is one sprite
 * that only rotates. Paper strips, chains and streamers are short paths read
 * from a looping gust table, so the flutter runs along the branches in turn.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const PAPERS = [
    { face: '#dc5a3e', shade: '#b8452f', back: '#ec9676' },
    { face: '#e6b84e', shade: '#c4943a', back: '#f1d68e' },
    { face: '#eee5ce', shade: '#cfc5a8', back: '#f8f1de' },
    { face: '#6e92cc', shade: '#5274ac', back: '#9ab4dc' },
    { face: '#98c06e', shade: '#7aa055', back: '#bcd694' },
    { face: '#cc7ca0', shade: '#a96080', back: '#e0a6be' },
  ];
  const LEAVES = ['#3a7050', '#55945f', '#7cb568', '#a8cf7a'];
  const SPINE = 6;
  const GUST_SIZE = 512;
  const CULM_SEGMENTS = 15;
  const BRANCH_COUNT = 11;
  const TWINKLES = 34;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function poly(ctx, u, x, y, points) {
    ctx.beginPath();
    for (let i = 0; i < points.length; i += 2) {
      if (i === 0) ctx.moveTo(x + points[i] * u, y + points[i + 1] * u);
      else ctx.lineTo(x + points[i] * u, y + points[i + 1] * u);
    }
    ctx.fill();
  }

  function softGlow(radius, rgb, peak) {
    const size = Math.ceil(radius * 2);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${rgb},${peak})`);
    grad.addColorStop(0.45, `rgba(${rgb},${peak * 0.3})`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  // Setup only: hard edges and only the given inks, so small sprites add no blends.
  function snapSprite(c, inks) {
    const ctx = c.getContext('2d');
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    const rgb = inks.map((s) => K.parseColor(s));
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 100) {
        d[i + 3] = 0;
        continue;
      }
      let best = rgb[0];
      let gap = Infinity;
      for (const p of rgb) {
        const e = Math.abs(p[0] - d[i]) + Math.abs(p[1] - d[i + 1]) + Math.abs(p[2] - d[i + 2]);
        if (e < gap) {
          gap = e;
          best = p;
        }
      }
      d[i] = best[0];
      d[i + 1] = best[1];
      d[i + 2] = best[2];
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Rings of flat light, so a glow adds only a few colours to the picture.
  function steppedGlow(rx, ry, rgb, peak, steps) {
    const c = layer(rx * 2, ry * 2);
    const ctx = c.getContext('2d');
    ctx.fillStyle = `rgb(${rgb})`;
    for (let i = 0; i < steps; i++) {
      const f = 1 - i / steps;
      ctx.globalAlpha = peak / steps;
      ctx.beginPath();
      ctx.ellipse(rx, ry, rx * f, ry * f, 0, 0, 6.3);
      ctx.fill();
    }
    return c;
  }

  // ---- the sky ------------------------------------------------------------

  function bandEnds(g) {
    return { ax: g.W * 0.99, ay: -g.H * 0.08, bx: g.W * 0.56, by: g.H * 0.86 };
  }

  // Noise runs in band coordinates, so the light streaks along the river of stars.
  function bandTone(d, run) {
    const cloud = fbm(run * 0.04, d * 0.11, 4, 31);
    const reach = 0.75 + 0.6 * fbm(run * 0.05, d * 0.04, 3, 17);
    const laneAt = 1.5 + 9 * (fbm(run * 0.03, 3, 3, 9) - 0.5);
    const lane = Math.exp(-Math.pow((d - laneAt) / 2.6, 2)) * smoothstep(0.3, 0.55, fbm(run * 0.07, d * 0.05, 3, 8));
    const core = Math.exp(-Math.pow(d / (10.5 * reach), 2)) * (0.3 + cloud * 0.95);
    const wide = Math.exp(-Math.pow(d / (22 * reach), 2)) * (0.1 + cloud * 0.25);
    return Math.max(0, Math.min(0.72, core + wide - lane * 0.3));
  }

  function paintMilkyWay(g) {
    const w = Math.ceil(g.W / 2);
    const h = Math.ceil((g.H * 0.8) / 2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const e = bandEnds(g);
    const dx = e.bx - e.ax;
    const dy = e.by - e.ay;
    const len = Math.hypot(dx, dy);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = x * 2 - e.ax;
        const py = y * 2 - e.ay;
        const d = (px * dy - py * dx) / len / g.U;
        const run = (px * dx + py * dy) / len / g.U;
        const v = Math.round(bandTone(d, run) * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = lerp(170, 240, v);
        img.data[i + 1] = lerp(184, 228, v);
        img.data[i + 2] = lerp(226, 208, v);
        img.data[i + 3] = v * 235;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintDust(ctx, g, rand) {
    const e = bandEnds(g);
    const tones = ['#c9d2ec', '#f2ead6', '#9fb0dc', '#e8d2a8'];
    const count = Math.round((g.W * g.H) / 34);
    for (let i = 0; i < count; i++) {
      const inBand = rand() < 0.58;
      const a = rand();
      const spread = (rand() + rand() + rand() - 1.5) * g.U * 13;
      const x = inBand ? lerp(e.ax, e.bx, a) + spread * 0.9 : rand() * g.W;
      const y = inBand ? lerp(e.ay, e.by, a) + spread * 0.42 : rand() * g.H * 0.8;
      const big = rand() < 0.07;
      ctx.globalAlpha = big ? 0.95 : rand() < 0.5 ? 0.4 : 0.7;
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      const s = big ? Math.max(1.4, g.U * 0.9) : Math.max(1, g.U * 0.45);
      ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;
  }

  function paintBrightStar(ctx, g, x, y, rgb) {
    const halo = softGlow(g.U * 6, rgb, 0.6);
    ctx.drawImage(halo, x - halo.width / 2, y - halo.height / 2);
    ctx.fillStyle = '#fbf6e6';
    const s = Math.max(1, g.U * 0.7);
    ctx.fillRect(x - s * 2, y - s / 2, s * 4, s);
    ctx.fillRect(x - s / 2, y - s * 2, s, s * 4);
    ctx.fillRect(x - s, y - s, s * 2, s * 2);
  }

  function ridge(ctx, g, base, rise, scale, seed, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (base - fbm((x / g.U) * scale, seed, 4, seed) * rise));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
  }

  function paintShrubs(ctx, g, rand) {
    const tones = ['#2b4c44', '#3a6350', '#4f7c5a'];
    const clumps = Math.ceil(g.W / (g.U * 9));
    for (let i = 0; i <= clumps; i++) {
      const cx = (i / clumps) * g.W + (rand() - 0.5) * g.U * 5;
      const r = g.U * (5 + rand() * 4);
      const top = g.H * 0.76;
      for (let j = 0; j < 46; j++) {
        const a = rand() * 6.283;
        const d = Math.sqrt(rand());
        ctx.fillStyle = tones[Math.min(2, Math.floor((1 - Math.sin(a) * d) * 1.5))];
        const size = g.U * (0.5 + rand() * 1.1);
        ctx.fillRect(cx + Math.cos(a) * d * r * 1.25, top + Math.sin(a) * d * r * 0.7, size * 1.5, size);
      }
    }
  }

  function paintFence(ctx, g) {
    const u = g.U;
    const top = g.H * 0.735;
    const foot = g.H * 0.86;
    const stride = u * 5.2;
    for (let x = stride * 0.4; x < g.W; x += stride) {
      ctx.fillStyle = '#8b8a5e';
      ctx.fillRect(x, top, Math.max(1, u * 0.65), foot - top);
    }
    for (let j = 0; j < 3; j++) {
      const y = top + u * (1.4 + j * 3.4);
      ctx.fillStyle = '#b3ad78';
      ctx.fillRect(0, y, g.W, Math.max(1, u * 0.7));
    }
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.76);
    sky.addColorStop(0, '#222b58');
    sky.addColorStop(0.45, '#303a70');
    sky.addColorStop(0.8, '#5a6498');
    sky.addColorStop(1, '#8c7c98');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(paintMilkyWay(g), 0, 0, g.W, g.H * 0.8);
    ctx.imageSmoothingEnabled = true;
    paintDust(ctx, g, rand);
    paintBrightStar(ctx, g, g.W * 0.76, g.H * 0.14, '220,230,255');
    paintBrightStar(ctx, g, g.W * 0.92, g.H * 0.5, '255,240,214');
    ridge(ctx, g, 0.72, 0.14, 0.035, 12, '#3c4780');
    ridge(ctx, g, 0.76, 0.1, 0.06, 5, '#2c4560');
    ctx.fillStyle = '#2e4c42';
    ctx.fillRect(0, g.H * 0.76, g.W, g.H * 0.24);
    paintShrubs(ctx, g, rand);
    paintFence(ctx, g);
    return c;
  }

  function makeTwinkles(g, rand) {
    const e = bandEnds(g);
    const list = [];
    for (let i = 0; i < TWINKLES; i++) {
      const a = rand();
      const spread = (rand() - 0.5) * g.U * 34;
      list.push({
        x: i < 22 ? lerp(e.ax, e.bx, a) + spread : rand() * g.W,
        y: i < 22 ? lerp(e.ay, e.by, a * 0.8) + spread * 0.4 : rand() * g.H * 0.6,
        size: Math.max(1, g.U * (0.6 + rand() * 0.4)),
        rate: 0.5 + rand() * 0.9,
        phase: rand() * 6.283,
      });
    }
    return list;
  }

  // ---- the veranda --------------------------------------------------------

  function paintDeck(ctx, g, rand) {
    const u = g.U;
    const heights = [2, 2.4, 2.8, 3.3, 4];
    const tones = ['#7a5c40', '#6a4f38', '#7a5c40', '#6a4f38', '#7a5c40'];
    let y = g.H * 0.85;
    ctx.fillStyle = '#a07d55';
    ctx.fillRect(0, y - u * 0.8, g.W, u * 0.9);
    heights.forEach((h, i) => {
      ctx.fillStyle = tones[i];
      ctx.fillRect(0, y, g.W, u * h + 2);
      ctx.fillStyle = '#4c3828';
      for (let k = 0; k < g.W / (u * 3); k++) ctx.fillRect(rand() * g.W, y + rand() * u * h, u * (2 + rand() * 7), 1);
      y += u * h;
      ctx.fillStyle = '#2e2119';
      ctx.fillRect(0, y, g.W, Math.max(1, u * 0.35));
    });
    ctx.fillStyle = tones[0];
    ctx.fillRect(0, y, g.W, g.H - y);
  }

  function paintLanternBody(ctx, g, x, y) {
    const u = g.U;
    const w = u * 4.6;
    const h = u * 10;
    ctx.fillStyle = 'rgba(30,20,14,0.5)';
    ctx.beginPath();
    ctx.ellipse(x, y + u * 0.4, w * 1.5, u * 1.2, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#f4d48c';
    ctx.fillRect(x - w, y - h - u * 2, w * 2, h);
    ctx.fillStyle = '#ffeab8';
    ctx.fillRect(x - w * 0.55, y - h - u * 1.4, w * 1.1, h - u * 1.2);
    ctx.fillStyle = '#3a2619';
    const bar = Math.max(1, u * 0.6);
    ctx.fillRect(x - w - bar, y - h - u * 2.6, bar * 2 + w * 2, bar * 1.4);
    ctx.fillRect(x - w - bar, y - u * 2, bar * 2 + w * 2, bar * 1.4);
    ctx.fillRect(x - w - bar / 2, y - h - u * 2.6, bar, h + u * 2.6);
    ctx.fillRect(x + w - bar / 2, y - h - u * 2.6, bar, h + u * 2.6);
    ctx.fillRect(x - bar / 4, y - h - u * 2, Math.max(1, bar / 2), h);
    ctx.fillRect(x - w, y - h * 0.55 - u * 2, w * 2, Math.max(1, bar / 2));
    poly(ctx, u, x, y, [-5.6, -12.4, 5.6, -12.4, 3, -14.4, -3, -14.4]);
  }

  // A post and the underside of the eave, so we are sitting on the veranda.
  function paintFrame(ctx, g) {
    const u = g.U;
    ctx.fillStyle = '#3f3236';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(u * 58, 0);
    ctx.lineTo(0, u * 15);
    ctx.fill();
    ctx.strokeStyle = '#6a5444';
    ctx.lineWidth = Math.max(1, u * 0.6);
    ctx.beginPath();
    for (let i = 1; i < 6; i++) {
      ctx.moveTo(u * 9 * i, 0);
      ctx.lineTo(u * 7 * i, u * (15 - 1.8 * i) - u * 2);
    }
    ctx.stroke();
    ctx.fillStyle = '#5e4734';
    ctx.fillRect(u * 1.5, 0, u * 5, g.H * 0.86);
    ctx.fillStyle = '#8a6c4c';
    ctx.fillRect(u * 5.2, 0, Math.max(1, u * 1.3), g.H * 0.86);
    ctx.fillStyle = '#3c2c22';
    ctx.fillRect(u * 1, g.H * 0.84, u * 6.5, u * 1.4);
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintDeck(ctx, g, rand);
    const lamp = { x: g.W * 0.74, y: g.H * 0.945 };
    const pool = steppedGlow(g.U * 40, g.U * 16, '255,190,110', 0.5, 4);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, g.H * 0.85, g.W, g.H * 0.15);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(pool, lamp.x - pool.width / 2, lamp.y - pool.height / 2 - g.U * 1.5);
    ctx.restore();
    paintFrame(ctx, g);
    paintLanternBody(ctx, g, lamp.x, lamp.y);
    state.lamp = lamp;
    return c;
  }

  // ---- bamboo -------------------------------------------------------------

  function culmX(g, s, bend) {
    return state.baseX + g.U * (7 * s + 16 * s * s * s) + bend * s * s;
  }

  function culmY(g, s) {
    return g.H * 0.88 - g.U * 84 * s;
  }

  function stemY(len, f) {
    return -len * 0.34 * f + len * 0.24 * f * f;
  }

  function leaf(ctx, x, y, a, l, w) {
    const cx = x + Math.cos(a) * l * 0.42;
    const cy = y + Math.sin(a) * l * 0.42;
    const nx = -Math.sin(a) * w;
    const ny = Math.cos(a) * w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(cx + nx, cy + ny, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.quadraticCurveTo(cx - nx, cy - ny, x, y);
    ctx.fill();
  }

  // Twigs along the stem, each ending in a loose fan of narrow drooping leaves.
  function growTwigs(g, rand, side, len) {
    const u = g.U;
    const marks = [];
    const twigs = [];
    const stride = u * 2.3;
    for (let d = u * 3, i = 0; d <= len; d += stride, i++) {
      const f = d / len;
      const x = side * d;
      const y = stemY(len, f);
      const up = i % 2 ? -1 : 1;
      const tl = u * (2 + rand() * 3.4) * (f > 0.9 ? 0.6 : 1);
      const ta = up * (0.35 + rand() * 0.55);
      const ex = x + side * Math.cos(ta) * tl;
      const ey = y + Math.sin(ta) * tl;
      twigs.push(x, y, ex, ey);
      const n = 4 + Math.floor(rand() * 4);
      for (let k = 0; k < n; k++) {
        const down = -0.5 + rand() * 1.75;
        const a = side > 0 ? down : Math.PI - down;
        marks.push({ x: ex, y: ey, a, l: u * (3.6 + rand() * 3), w: u * (0.55 + rand() * 0.25), tone: Math.floor(rand() * rand() * 4 + rand() * 1.4) });
      }
    }
    return { marks, twigs };
  }

  function bakeBranch(g, rand, s, side, len) {
    const size = Math.ceil((len + g.U * 11) * 2);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    ctx.translate(size / 2, size / 2);
    const { marks, twigs } = growTwigs(g, rand, side, len);
    ctx.strokeStyle = '#7f9a58';
    ctx.lineWidth = Math.max(1, g.U * 0.55);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let f = 0.1; f <= 1.001; f += 0.1) ctx.lineTo(side * len * f, stemY(len, f));
    for (let i = 0; i < twigs.length; i += 4) {
      ctx.moveTo(twigs[i], twigs[i + 1]);
      ctx.lineTo(twigs[i + 2], twigs[i + 3]);
    }
    ctx.stroke();
    for (let tone = 0; tone < LEAVES.length; tone++) {
      ctx.fillStyle = LEAVES[tone];
      for (const m of marks) {
        if (Math.min(m.tone, 3) === tone) leaf(ctx, m.x, m.y, m.a, m.l, m.w);
      }
    }
    snapSprite(c, LEAVES.concat('#7f9a58'));
    return { sprite: c, half: size / 2, s, side, len, marks, sway: rand() * 6.283, ax: 0, ay: 0, cos: 1, sin: 0 };
  }

  function makeBranches(g, rand) {
    const list = [];
    const fit = Math.max(0.7, Math.min(1, g.W / (g.U * 150)));
    for (let i = 0; i < BRANCH_COUNT; i++) {
      const s = 0.29 + i * 0.064;
      const side = i % 2 ? 1 : -1;
      const len = g.U * fit * (10 + 44 * Math.pow(1 - s, 0.9));
      list.push(bakeBranch(g, rand, s, side, len));
    }
    list.push(bakeBranch(g, rand, 0.985, 1, g.U * 9));
    list.push(bakeBranch(g, rand, 0.965, -1, g.U * 7));
    return list;
  }

  function makeLoose(g, rand, branches) {
    const list = [];
    const per = 7;
    for (const b of branches) {
      const light = b.marks.filter((m) => m.tone >= 2);
      for (let i = 0; i < per && light.length; i++) {
        const m = light[Math.floor(rand() * light.length)];
        list.push({ b, x: m.x, y: m.y + g.U * (rand() - 0.5), a: m.a, l: m.l * 0.95, w: m.w * 1.2, tone: i % 2, phase: rand() * 6.283, rate: 1.1 + rand() });
      }
      b.marks = null;
    }
    return list;
  }

  // ---- wind ---------------------------------------------------------------

  function makeGusts() {
    const lut = new Float32Array(GUST_SIZE);
    const pulses = [0.08, 0.37, 0.62, 0.84];
    for (let i = 0; i < GUST_SIZE; i++) {
      let v = 0;
      pulses.forEach((p, n) => {
        let d = Math.abs(i / GUST_SIZE - p);
        d = Math.min(d, 1 - d);
        const amp = n % 2 ? 0.62 : 1;
        v = Math.max(v, amp * (1 - smoothstep(0, n % 2 ? 0.09 : 0.13, d)));
      });
      lut[i] = v;
    }
    return lut;
  }

  function gustAt(g, x, t) {
    const p = (x / g.W) * 0.62 - t * 0.088;
    const f = p - Math.floor(p);
    return state.gusts[Math.floor(f * GUST_SIZE) % GUST_SIZE];
  }

  function placeBranches(g, t, breeze) {
    const bend = g.U * ((Math.sin(t * 0.43) * 1.6 + Math.sin(t * 0.71 + 1) * 0.8) * (0.25 + breeze * 0.75) + gustAt(g, state.baseX, t) * 3 * breeze);
    state.bend = bend;
    for (const b of state.branches) {
      const r = 0.018 * Math.sin(t * 0.8 + b.sway) * (0.3 + breeze) + gustAt(g, culmX(g, b.s, 0), t) * 0.045 * breeze;
      b.ax = culmX(g, b.s, bend);
      b.ay = culmY(g, b.s);
      b.cos = Math.cos(r);
      b.sin = Math.sin(r);
    }
  }

  function worldX(b, x, y) {
    return b.ax + b.cos * x - b.sin * y;
  }

  function worldY(b, x, y) {
    return b.ay + b.sin * x + b.cos * y;
  }

  function drawBranches(ctx) {
    ctx.imageSmoothingEnabled = false;
    for (const b of state.branches) {
      ctx.save();
      ctx.transform(b.cos, b.sin, -b.sin, b.cos, b.ax, b.ay);
      ctx.drawImage(b.sprite, -b.half, -b.half);
      ctx.restore();
    }
  }

  function drawCulm(ctx, g) {
    const bend = state.bend;
    ctx.lineCap = 'butt';
    for (let i = 0; i < CULM_SEGMENTS; i++) {
      const s0 = i / CULM_SEGMENTS;
      const s1 = (i + 1) / CULM_SEGMENTS;
      const w = g.U * lerp(3, 0.6, s0);
      const x0 = culmX(g, s0, bend);
      const x1 = culmX(g, s1, bend);
      const y0 = culmY(g, s0);
      const y1 = culmY(g, s1);
      ctx.strokeStyle = '#6fa05c';
      ctx.lineWidth = Math.max(1, w);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.strokeStyle = '#b4d484';
      ctx.lineWidth = Math.max(1, w * 0.3);
      ctx.beginPath();
      ctx.moveTo(x0 - w * 0.22, y0);
      ctx.lineTo(x1 - w * 0.22, y1);
      ctx.stroke();
      ctx.fillStyle = '#3c6a48';
      ctx.fillRect(x1 - w * 0.62, y1, w * 1.24, Math.max(1, g.U * 0.5));
    }
  }

  function drawLoose(ctx, g, t, breeze) {
    for (let tone = 0; tone < 2; tone++) {
      ctx.fillStyle = LEAVES[tone + 2];
      ctx.beginPath();
      for (const m of state.loose) {
        if (m.tone !== tone) continue;
        const gust = gustAt(g, m.b.ax + m.x, t) * breeze;
        const a = m.a + Math.sin(t * m.rate + m.phase) * (0.1 + gust * 0.32) + gust * 0.16;
        const x = worldX(m.b, m.x, m.y);
        const y = worldY(m.b, m.x, m.y);
        ctx.moveTo(x - Math.sin(a) * m.w, y + Math.cos(a) * m.w);
        ctx.lineTo(x + Math.cos(a) * m.l, y + Math.sin(a) * m.l);
        ctx.lineTo(x + Math.sin(a) * m.w, y - Math.cos(a) * m.w);
      }
      ctx.fill();
    }
  }

  // ---- paper --------------------------------------------------------------

  // Fills the shared spine arrays for one hanging ribbon, wave running to the tip.
  function shapeSpine(x0, y0, len, wind, t, rate, phase, loose) {
    const { xs, ys } = state;
    const step = len / SPINE;
    let x = x0;
    let y = y0;
    for (let k = 0; k <= SPINE; k++) {
      xs[k] = x;
      ys[k] = y;
      const f = (k + 0.5) / SPINE;
      const a = 0.04 + wind * 0.78 * (0.5 + f * 0.5) + Math.sin(t * rate - f * 3.2 + phase) * (0.07 + wind * 0.32) * (0.35 + f) * loose;
      x += Math.sin(a) * step;
      y += Math.cos(a) * step;
    }
  }

  function fillRibbon(ctx, hw, from, to) {
    const { xs, ys } = state;
    ctx.beginPath();
    ctx.moveTo(xs[from] - hw, ys[from]);
    for (let k = from + 1; k <= to; k++) ctx.lineTo(xs[k] - hw, ys[k]);
    for (let k = to; k >= from; k--) ctx.lineTo(xs[k] + hw, ys[k]);
    ctx.fill();
  }

  function drawStrip(ctx, g, h, t, breeze) {
    const b = h.b;
    const x = worldX(b, h.x, h.y);
    const y = worldY(b, h.x, h.y);
    const wind = gustAt(g, x, t) * breeze;
    const turn = Math.cos(0.4 * Math.sin(t * 0.47 + h.phase) + wind * 2.5 * Math.sin(t * 1.5 + h.phase));
    const tie = g.U * 2;
    ctx.fillRect(x, y, 1, tie);
    shapeSpine(x, y + tie, h.len, wind, t, h.rate, h.phase, 1);
    const hw = h.hw * (0.22 + 0.78 * Math.abs(turn));
    ctx.fillStyle = turn >= 0 ? h.paper.face : h.paper.back;
    fillRibbon(ctx, hw, 0, SPINE);
    ctx.fillStyle = h.paper.shade;
    fillRibbon(ctx, hw, SPINE - 1, SPINE);
  }

  function drawChain(ctx, g, h, t, breeze) {
    const b = h.b;
    const x = worldX(b, h.x, h.y);
    const y = worldY(b, h.x, h.y);
    const wind = gustAt(g, x, t) * breeze;
    const u = g.U;
    const swing = 0.03 * Math.sin(t * 0.9 + h.phase) + wind * 0.3;
    ctx.lineWidth = Math.max(1, u * 0.55);
    for (let i = 0; i < h.links; i++) {
      const f = i / h.links;
      const d = i * u * 2.05;
      const px = x + Math.sin(swing * (0.5 + f)) * d + Math.sin(t * 1.3 - f * 4 + h.phase) * f * u * (0.5 + wind);
      const py = y + d;
      const colour = h.colours[i % h.colours.length];
      if (i % 2) {
        ctx.fillStyle = colour;
        ctx.fillRect(px - u * 0.4, py - u * 1.1, Math.max(1, u * 0.8), u * 2.2);
      } else {
        ctx.strokeStyle = colour;
        ctx.beginPath();
        ctx.ellipse(px, py, u * 1.25, u * 1.2, 0, 0, 6.3);
        ctx.stroke();
      }
    }
  }

  function drawSwag(ctx, g, h, t, breeze) {
    const b = h.b;
    const ax = worldX(b, h.x, h.y);
    const ay = worldY(b, h.x, h.y);
    const bx = worldX(b, h.x2, h.y2);
    const by = worldY(b, h.x2, h.y2);
    const u = g.U;
    const wind = gustAt(g, ax, t) * breeze;
    ctx.lineWidth = Math.max(1, u * 0.5);
    for (let i = 0; i <= h.links; i++) {
      const f = i / h.links;
      const sag = 4 * f * (1 - f);
      const px = lerp(ax, bx, f) + sag * wind * u * 2;
      const py = lerp(ay, by, f) + sag * (h.sag + Math.sin(t * 0.8 + h.phase) * u * 0.5 - wind * u * 1.2);
      const colour = h.colours[i % h.colours.length];
      if (i % 2) {
        ctx.fillStyle = colour;
        ctx.fillRect(px - u * 0.9, py - u * 0.35, u * 1.8, Math.max(1, u * 0.7));
      } else {
        ctx.strokeStyle = colour;
        ctx.beginPath();
        ctx.ellipse(px, py, u * 1.05, u * 1.15, 0, 0, 6.3);
        ctx.stroke();
      }
    }
  }

  function drawBall(ctx, g, h, t, breeze) {
    const b = h.b;
    const x = worldX(b, h.x, h.y);
    const y = worldY(b, h.x, h.y) + g.U * 3;
    const wind = gustAt(g, x, t) * breeze;
    ctx.fillRect(x, y - g.U * 3, 1, g.U * 3);
    const ballY = y + h.r;
    const footY = ballY + h.r * 0.85;
    ctx.lineJoin = 'round';
    for (let i = 0; i < h.ribbons.length; i++) {
      const r = h.ribbons[i];
      shapeSpine(x + r.dx, footY, r.len, wind, t, r.rate, r.phase, 1.25);
      ctx.fillStyle = r.colour;
      fillRibbon(ctx, g.U * 0.5, 0, SPINE);
    }
    ctx.drawImage(h.sprite, x - h.half, ballY - h.half);
  }

  function drawHanging(ctx, g, h, t, breeze) {
    const b = h.b;
    const x = worldX(b, h.x, h.y);
    const y = worldY(b, h.x, h.y);
    const wind = gustAt(g, x, t) * breeze;
    const swing = 0.05 * Math.sin(t * 0.8 + h.phase) + wind * 0.32;
    for (let i = 0; i < h.count; i++) {
      const d = h.tie + i * h.gap;
      const px = x + Math.sin(swing) * d;
      const py = y + Math.cos(swing) * d;
      const spin = h.spins ? Math.cos(t * 0.5 + h.phase + i * 1.3 + wind * 1.4) : 1;
      const sx = h.spins ? (spin >= 0 ? 1 : -1) * (0.3 + 0.7 * Math.abs(spin)) : 1;
      ctx.save();
      ctx.transform(sx * Math.cos(swing), -Math.sin(swing) * sx, Math.sin(swing), Math.cos(swing), px, py);
      ctx.drawImage(h.sprite, -h.sprite.width / 2, 0);
      ctx.restore();
    }
    ctx.fillRect(x, y, 1, h.tie + (h.count - 1) * h.gap);
  }

  // ---- paper sprites ------------------------------------------------------

  function paintCrane(g, paper) {
    const u = g.U;
    const c = layer(u * 14, u * 9);
    const ctx = c.getContext('2d');
    const x = c.width / 2;
    const y = u * 5.4;
    ctx.fillStyle = paper.shade;
    poly(ctx, u, x, y, [-1.5, 0.6, -2.2, -5, 1.2, 0.2]);
    poly(ctx, u, x, y, [-1.4, 0.6, -6.4, -2.6, -1.8, 2]);
    ctx.fillStyle = paper.face;
    poly(ctx, u, x, y, [1.2, 0.6, 5.2, -2.6, 6.4, -2.2, 5.5, -1.8, 1.8, 2]);
    poly(ctx, u, x, y, [-2, 0.4, 2, 0.4, 0, 3]);
    ctx.fillStyle = paper.back;
    poly(ctx, u, x, y, [-1.2, 0.6, 2.6, -4.6, 1.8, 0.6]);
    return snapSprite(c, [paper.face, paper.shade, paper.back]);
  }

  function paintKimono(g, paper, under) {
    const u = g.U;
    const c = layer(u * 11, u * 12);
    const ctx = c.getContext('2d');
    const x = c.width / 2;
    ctx.fillStyle = paper.face;
    ctx.fillRect(x - u * 5, u * 0.5, u * 10, u * 4.2);
    ctx.fillRect(x - u * 2.6, u * 0.5, u * 5.2, u * 10.5);
    ctx.fillStyle = paper.shade;
    ctx.fillRect(x - u * 5, u * 3.4, u * 2.4, u * 1.3);
    ctx.fillRect(x + u * 2.6, u * 3.4, u * 2.4, u * 1.3);
    ctx.fillStyle = under;
    poly(ctx, u, x, 0, [-1.6, 0.5, 1.6, 0.5, 0, 3.8]);
    ctx.fillRect(x - u * 2.6, u * 5.4, u * 5.2, u * 1.5);
    return snapSprite(c, [paper.face, paper.shade, under]);
  }

  function paintNet(g, paper) {
    const u = g.U;
    const c = layer(u * 11, u * 15);
    const ctx = c.getContext('2d');
    const x = c.width / 2;
    ctx.strokeStyle = paper.face;
    ctx.lineWidth = Math.max(1, u * 0.42);
    const rows = 5;
    for (let j = 0; j < rows; j++) {
      const half = u * (2 + j * 0.8);
      const y = u * (1.6 + j * 2.5);
      const steps = 3 + j;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const px = x - half + (i / steps) * half * 2;
        const py = y + (i % 2 ? u * 1.25 : 0) + (j % 2 ? 0 : u * 0.1);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const px = x - half + (i / steps) * half * 2;
        const py = y + (i % 2 ? 0 : u * 1.25);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.fillStyle = paper.back;
    ctx.fillRect(x - u * 2.4, u * 0.2, u * 4.8, u * 1.3);
    return snapSprite(c, [paper.face, paper.back]);
  }

  function paintBall(r, base, seam, cap) {
    const size = Math.ceil(r * 2.4);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const m = size / 2;
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.arc(m, m, r, 0, 6.3);
    ctx.fill();
    ctx.strokeStyle = seam;
    ctx.lineWidth = Math.max(1, r * 0.14);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(m, m, Math.abs(i) * r * 0.42 + 0.3, r, 0, 0, 6.3);
      ctx.stroke();
    }
    ctx.fillStyle = cap;
    ctx.fillRect(m - r * 0.75, m + r * 0.62, r * 1.5, r * 0.34);
    ctx.fillRect(m - r * 0.4, m - r * 1.06, r * 0.8, r * 0.26);
    return snapSprite(c, [base, seam, cap]);
  }

  // ---- hanging things -----------------------------------------------------

  function stemPoint(b, f) {
    return { x: b.side * b.len * f, y: stemY(b.len, f) };
  }

  function makeBallHanger(g, rand, b, f, tones) {
    const u = g.U;
    const r = u * 3.8;
    const sprite = paintBall(r, tones[0].face, tones[0].shade, tones[1].face);
    const ribbons = [];
    for (let i = 0; i < 7; i++) {
      ribbons.push({
        dx: lerp(-r * 0.95, r * 0.95, i / 6),
        len: u * (10 + rand() * 2.5 + (3 - Math.abs(i - 3)) * 0.9),
        colour: tones[i % tones.length].face,
        rate: 1.3 + rand() * 0.9,
        phase: rand() * 6.283,
      });
    }
    return { kind: 'ball', b, ...stemPoint(b, f), r, sprite, half: sprite.width / 2, ribbons, boxHalf: u * 6, drop: u * 26 };
  }

  function chainColours(ids) {
    return ids.map((i) => PAPERS[i].face);
  }

  // A few chosen places for the special pieces; plain strips fill in around them.
  function makeSpecials(g, rand, branches) {
    const u = g.U;
    const P = PAPERS;
    const B = branches;
    const hanging = (b, f, sprite, count, gap, spins) => ({
      kind: 'hang', b, ...stemPoint(b, f), sprite, count, gap, tie: u * 2, spins, phase: rand() * 6.283,
      boxHalf: sprite.width / 2 + u, drop: u * 2 + (count - 1) * gap + sprite.height,
    });
    const chain = (b, f, links, ids) => ({
      kind: 'chain', b, ...stemPoint(b, f), links, colours: chainColours(ids), phase: rand() * 6.283,
      boxHalf: u * 2.5, drop: links * u * 2.05,
    });
    const swag = (b, ids) => {
      const from = stemPoint(b, 0.12);
      const to = stemPoint(b, 0.98);
      return {
        kind: 'swag', b, x: from.x, y: from.y, x2: to.x, y2: to.y, links: Math.round(b.len / (u * 1.9)), sag: u * 6,
        colours: chainColours(ids), phase: rand() * 6.283, box: (from.x + to.x) / 2, boxHalf: Math.abs(to.x - from.x) / 2 + u, drop: u * 8,
      };
    };
    return [
      makeBallHanger(g, rand, B[0], 0.46, [P[0], P[1], P[2]]),
      makeBallHanger(g, rand, B[1], 0.6, [P[3], P[2], P[5]]),
      chain(B[0], 1, 10, [0, 1, 2, 4]),
      chain(B[1], 1, 9, [1, 5, 2, 3]),
      hanging(B[2], 0.9, paintCrane(g, P[2]), 2, u * 8, true),
      hanging(B[3], 1, paintNet(g, P[1]), 1, 0, false),
      hanging(B[3], 0.42, paintKimono(g, P[5], P[2].face), 1, 0, false),
      hanging(B[4], 0.5, paintNet(g, P[4]), 1, 0, false),
      swag(B[5], [0, 2, 1, 3]),
      swag(B[6], [1, 4, 2, 5]),
      hanging(B[7], 0.8, paintCrane(g, P[0]), 1, 0, true),
      hanging(B[8], 0.8, paintKimono(g, P[3], P[2].face), 1, 0, false),
    ];
  }

  function restBox(g, h) {
    return { x: culmX(g, h.b.s, 0) + (h.box === undefined ? h.x : h.box), y: culmY(g, h.b.s) + h.y };
  }

  function stripClears(g, b, x, y, specials) {
    const u = g.U;
    const sx = culmX(g, b.s, 0) + x;
    const sy = culmY(g, b.s) + y;
    return specials.every((h) => {
      const box = restBox(g, h);
      const apart = Math.abs(box.x - sx) > h.boxHalf + u * 0.8;
      const above = sy + u * 11 < box.y - u;
      const below = sy > box.y + h.drop;
      return apart || above || below;
    });
  }

  function makeStrips(g, rand, branches, specials) {
    const u = g.U;
    const list = [];
    let hue = 0;
    for (const b of branches) {
      for (let d = u * 4; d <= b.len + u; d += u * 4.2) {
        const x = b.side * Math.min(d, b.len);
        const f = Math.min(1, d / b.len);
        const y = stemY(b.len, f);
        if (!stripClears(g, b, x, y, specials)) continue;
        hue = (hue + 1 + Math.floor(rand() * 2)) % PAPERS.length;
        list.push({
          b, x, y, paper: PAPERS[hue],
          len: u * (7 + rand() * 2.4), hw: u * 1.35,
          rate: 1.3 + rand() * 0.9, phase: rand() * 6.283,
        });
      }
    }
    return list;
  }

  // ---- small lights -------------------------------------------------------

  function drawStars(ctx, t) {
    ctx.fillStyle = '#f6f0dc';
    for (const s of state.twinkles) {
      ctx.globalAlpha = 0.45 + 0.45 * Math.sin(t * s.rate + s.phase);
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawLanternGlow(ctx, g, t, amount) {
    const breath = 0.8 + 0.12 * Math.sin(t * 0.9) + 0.08 * Math.sin(t * 2.3 + 1);
    const lamp = state.lamp;
    const halo = state.halo;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, breath * amount * 0.75);
    ctx.drawImage(halo, lamp.x - halo.width / 2, lamp.y - g.U * 7.5 - halo.height / 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // ---- run ----------------------------------------------------------------

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.baseX = g.W * 0.36;
    state.bend = 0;
    state.xs = new Float32Array(SPINE + 1);
    state.ys = new Float32Array(SPINE + 1);
    state.gusts = makeGusts();
    state.back = paintBack(g, rand);
    state.front = paintFront(g, rand);
    state.halo = steppedGlow(g.U * 15, g.U * 13, '255,196,120', 0.36, 3);
    state.twinkles = makeTwinkles(g, rand);
    state.branches = makeBranches(g, rand);
    state.loose = makeLoose(g, rand, state.branches);
    const specials = makeSpecials(g, rand, state.branches);
    state.balls = specials.filter((h) => h.kind === 'ball');
    state.chains = specials.filter((h) => h.kind === 'chain');
    state.hanging = specials.filter((h) => h.kind === 'hang');
    state.swags = specials.filter((h) => h.kind === 'swag');
    state.strips = makeStrips(g, rand, state.branches, specials);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const breeze = api.props.breeze;
    ctx.drawImage(state.back, 0, 0);
    drawStars(ctx, t);
    placeBranches(g, t, breeze);
    drawBranches(ctx);
    drawCulm(ctx, g);
    drawLoose(ctx, g, t, breeze);
    for (const h of state.swags) drawSwag(ctx, g, h, t, breeze);
    ctx.fillStyle = '#d8d0b4';
    for (const h of state.chains) drawChain(ctx, g, h, t, breeze);
    ctx.fillStyle = '#d8d0b4';
    for (const h of state.balls) drawBall(ctx, g, h, t, breeze);
    ctx.fillStyle = '#d8d0b4';
    for (const h of state.hanging) drawHanging(ctx, g, h, t, breeze);
    for (const h of state.strips) {
      ctx.fillStyle = '#d8d0b4';
      drawStrip(ctx, g, h, t, breeze);
    }
    ctx.drawImage(state.front, 0, 0);
    drawLanternGlow(ctx, g, t, api.props.glow);
  }

  Kasuri.run({
    defaults: { breeze: 1, glow: 1, ramp: 'lines', cell: 7, boost: 0.13, gain: 1.04, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
