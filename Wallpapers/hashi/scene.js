/*
 * 橋 Hashi — a vermilion drum bridge over a garden pond in early autumn.
 *
 * The whole garden is baked once, then flipped into a second layer for the water,
 * so moving the reflection costs a few dozen strip copies a frame. Willow strands,
 * grass and leaves are short paths and sprites from arrays filled in setup.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const WATER_LINE = 0.57;
  const REFLECTION_INKS = 20;
  const STREAKS = 130;
  const STRAND_POINTS = 7;
  const STRAND_TONES = ['#a3b45a', '#bcbc66', '#86a354'];
  const FLOATERS = 20;
  const FALLERS = 5;
  const LEAF_TONES = ['#d6452c', '#e0863a', '#d9a944', '#b93c26'];
  const MAPLE = ['#c8452c', '#dc5432', '#e87a3e', '#eda548', '#dcb955', '#a3ad56'];
  const WOOD = ['#7fa070', '#8fad74', '#a3b77a', '#b5bd7c'];
  const TURNING = ['#a3a86e', '#bdb26c', '#cfa95e', '#d3965a'];
  const SKY = ['#adc6c2', '#bdd0c4', '#cfd9c0', '#e0dfbf', '#efe6c4'];
  const TAU = Math.PI * 2;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Height of the deck above the water at x: flatter than the arch, so it clears it.
  function deckHeight(b, x) {
    const s = Math.min(1, Math.abs(x - b.cx) / b.D);
    return b.hb + (b.top - b.hb) * Math.cos((s * Math.PI) / 2);
  }

  function band(ctx, g, b, from, to, colour) {
    const step = Math.max(0.5, g.U * 0.5);
    ctx.fillStyle = colour;
    ctx.beginPath();
    for (let x = b.cx - b.D; x <= b.cx + b.D; x += step) ctx.lineTo(x, b.wy - deckHeight(b, x) + from);
    ctx.lineTo(b.cx + b.D, b.wy - b.hb + from);
    ctx.lineTo(b.cx + b.D, b.wy - b.hb + to);
    for (let x = b.cx + b.D; x >= b.cx - b.D; x -= step) ctx.lineTo(x, b.wy - deckHeight(b, x) + to);
    ctx.lineTo(b.cx - b.D, b.wy - b.hb + to);
    ctx.fill();
  }

  // Flat washes with wandering edges, so the sky stays a handful of tones.
  function paintSky(ctx, g, b, rand) {
    ctx.fillStyle = SKY[0];
    ctx.fillRect(0, 0, g.W, b.wy + 1);
    for (let i = 0; i < SKY.length; i++) {
      const top = (b.wy * i * 0.92) / SKY.length;
      ctx.fillStyle = SKY[i];
      ctx.beginPath();
      ctx.moveTo(0, b.wy);
      for (let x = 0; x <= g.W + 3; x += 3) ctx.lineTo(x, top + g.U * 4 * (fbm(x * 0.03, i * 5, 3, 13) - 0.5));
      ctx.lineTo(g.W, b.wy);
      ctx.fill();
    }
    ctx.fillStyle = '#f5eed8';
    for (let i = 0; i < 7; i++) {
      const w = g.U * (22 + rand() * 40);
      const x = rand() * g.W - w / 2;
      const y = g.U * (3 + rand() * 24);
      ctx.fillRect(x, y, w, Math.max(1, g.U * (0.7 + rand() * 1.2)));
    }
  }

  function ridge(ctx, g, b, base, rise, scale, seed, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, b.wy);
    for (let x = 0; x <= g.W + 2; x += 2) {
      const edge = smoothstep(0.08, 0.5, Math.abs(x - b.cx) / g.W);
      ctx.lineTo(x, b.wy - g.U * (base + rise * edge) - g.U * rise * 0.5 * fbm((x / g.U) * scale, seed, 3, 7));
    }
    ctx.lineTo(g.W, b.wy);
    ctx.fill();
  }

  // A tree is a few overlapping lobes: a solid middle, then varied dabs that break its edge.
  function lobe(ctx, g, rand, x, y, rx, ry, tones, shade, count) {
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(x, y + ry * 0.12, rx * 0.84, ry * 0.8, 0, 0, TAU);
    ctx.fill();
    for (let i = 0; i < count; i++) {
      const a = rand() * TAU;
      const d = Math.sqrt(rand());
      const dx = Math.cos(a) * d * rx * 1.14;
      const dy = Math.sin(a) * d * ry * 1.14;
      const lit = 0.56 - dy / ry / 2 + (rand() - 0.5) * 0.9;
      ctx.fillStyle = tones[Math.max(0, Math.min(tones.length - 1, Math.floor(lit * tones.length)))];
      const w = Math.max(1, Math.round(g.U * (0.7 + rand() * 1.3)));
      ctx.fillRect(Math.round(x + dx - w / 2), Math.round(y + dy - w * 0.35), w, Math.max(1, Math.round(w * 0.62)));
    }
  }

  // Far trees stay plain masses in close tones, so nothing behind the bridge competes.
  function grove(ctx, g, rand, x, foot, spread, height, tones, shade) {
    const u = g.U;
    for (let i = 0; i < 5; i++) {
      const f = i / 4;
      const lx = x + (f * 2 - 1) * u * spread * 0.55 + (rand() - 0.5) * u * 3;
      const ly = foot - u * height * (0.42 + 0.34 * Math.sin(f * Math.PI)) + (rand() - 0.5) * u * 3;
      lobe(ctx, g, rand, lx, ly, u * spread * (0.42 + rand() * 0.14), u * height * (0.3 + rand() * 0.1), tones, shade, 90);
    }
  }

  // A maple grows in flat tiers: branches you can follow, sky between the layers.
  function maple(ctx, g, rand, x, foot, scale, tones, shade) {
    const u = g.U * scale;
    const tiers = [
      { y: 42, n: 2, spread: 10, rx: 11, ry: 4.6 },
      { y: 32, n: 3, spread: 20, rx: 12, ry: 4.8 },
      { y: 22, n: 3, spread: 28, rx: 12, ry: 4.6 },
      { y: 13, n: 2, spread: 30, rx: 10, ry: 3.6 },
    ];
    ctx.strokeStyle = '#4c3b30';
    ctx.lineCap = 'round';
    ctx.lineWidth = u * 2.6;
    ctx.beginPath();
    ctx.moveTo(x + u * 2, foot);
    ctx.bezierCurveTo(x - u * 3, foot - u * 12, x + u * 4, foot - u * 24, x, foot - u * 38);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, u * 0.9);
    for (const tier of tiers) {
      for (let i = 0; i < tier.n; i++) {
        const f = tier.n === 1 ? 0 : (i / (tier.n - 1)) * 2 - 1;
        const lx = x + f * u * tier.spread + (rand() - 0.5) * u * 4;
        const ly = foot - u * (tier.y + (rand() - 0.5) * 3);
        ctx.strokeStyle = '#4c3b30';
        ctx.beginPath();
        ctx.moveTo(x, ly + u * 6);
        ctx.quadraticCurveTo(lerp(x, lx, 0.5), ly + u * 2, lx, ly);
        ctx.stroke();
        lobe(ctx, g, rand, lx, ly, u * tier.rx * (0.85 + rand() * 0.3), u * tier.ry, tones, shade, Math.round(190 * scale));
      }
    }
  }

  function paintBackdrop(ctx, g, b, rand) {
    ridge(ctx, g, b, 12, 22, 0.035, 3, '#b4c8bc');
    ridge(ctx, g, b, 8, 15, 0.06, 11, '#a0bba2');
    const far = [-0.02, 0.11, 0.23, 0.76, 1.02];
    for (let i = 0; i < far.length; i++) {
      const side = Math.abs(far[i] - 0.5);
      const warm = i % 3 === 1;
      grove(ctx, g, rand, far[i] * g.W, b.wy - g.U * 2, 14 + side * 22, 20 + side * 44, warm ? TURNING : WOOD, warm ? '#a39a60' : '#779a6c');
    }
    paintFarBank(ctx, g, b, rand);
  }

  // A clipped hedge and a low grass line on the far shore, seen through the arch.
  function paintFarBank(ctx, g, b, rand) {
    const u = g.U;
    ctx.fillStyle = '#c4d6c8';
    ctx.fillRect(0, b.wy - u * 2.2, g.W, u * 2.4);
    ctx.fillStyle = '#7f9f5c';
    ctx.beginPath();
    ctx.moveTo(0, b.wy - u * 2);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, b.wy - u * (3 + fbm(x * 0.04, 3, 3, 9) * 1.4));
    ctx.lineTo(g.W, b.wy - u * 2);
    ctx.fill();
    maple(ctx, g, rand, b.cx + b.r * 0.36, b.wy - u * 3, 0.42, MAPLE, '#a73a26');
    for (let x = -u * 4; x < g.W + u * 8; x += u * (5 + rand() * 9)) {
      const inArch = Math.abs(x - b.cx) < b.r;
      const r = u * (inArch ? 1.2 + rand() * 1.5 : 1.8 + rand() * rand() * 4);
      lobe(ctx, g, rand, x, b.wy - u * 2.8 - r * 0.6, r * (1.6 + rand()), r, ['#5a8a5a', '#6f9c60', '#94b26c'], '#4f7c52', 46);
    }
  }

  function paintStruts(ctx, g, b) {
    const u = g.U;
    ctx.fillStyle = '#d04a30';
    for (let x = b.cx - b.D + u * 2; x < b.cx + b.D; x += u * 4.4) {
      const dx = Math.abs(x - b.cx);
      const outer = b.r + b.t;
      const foot = dx < outer ? b.wy - Math.sqrt(outer * outer - dx * dx) : b.wy;
      const top = b.wy - deckHeight(b, x);
      if (foot > top) ctx.fillRect(x - u * 0.65, top, Math.max(1, u * 1.3), foot - top);
    }
  }

  function arcLine(ctx, b, radius, colour, width) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = Math.max(1, width);
    ctx.beginPath();
    ctx.arc(b.cx, b.wy, radius, Math.PI, 0);
    ctx.stroke();
  }

  function paintRing(ctx, g, b) {
    const u = g.U;
    ctx.fillStyle = '#f2603f';
    ctx.beginPath();
    ctx.arc(b.cx, b.wy, b.r + b.t, Math.PI, 0);
    ctx.arc(b.cx, b.wy, b.r, 0, Math.PI, true);
    ctx.fill();
    arcLine(ctx, b, b.r + b.t - u * 0.4, '#f9a07c', u * 0.9);
    arcLine(ctx, b, b.r + u * 0.4, '#b8402a', u * 1.1);
  }

  function paintRailing(ctx, g, b) {
    const u = g.U;
    ctx.fillStyle = '#dc5236';
    for (let x = b.cx - b.D + u * 1.6; x < b.cx + b.D; x += u * 3.2) {
      ctx.fillRect(x - u * 0.3, b.wy - deckHeight(b, x) - u * 6, Math.max(1, u * 0.6), u * 6);
    }
    band(ctx, g, b, -u * 3.6, -u * 2.8, '#ea5c40');
    band(ctx, g, b, -u * 7.6, -u * 5.8, '#f67a58');
    for (let i = -4; i <= 4; i++) {
      const x = b.cx + (i / 4) * b.D * 0.985;
      const y = b.wy - deckHeight(b, x);
      ctx.fillStyle = '#e4563a';
      ctx.fillRect(x - u * 1, y - u * 8.6, Math.max(1, u * 2), u * 9);
      ctx.fillStyle = '#dcb95a';
      ctx.beginPath();
      ctx.ellipse(x, y - u * 9.2, u * 1.15, u * 0.95, 0, 0, TAU);
      ctx.fill();
      ctx.fillRect(x - u * 0.4, y - u * 11.2, u * 0.8, u * 1.6);
    }
  }

  function paintBridge(ctx, g, b, rand) {
    const u = g.U;
    paintStruts(ctx, g, b);
    paintRing(ctx, g, b);
    paintBank(ctx, g, b, rand, -1);
    paintBank(ctx, g, b, rand, 1);
    band(ctx, g, b, -u * 0.8, u * 0.4, '#f0c79a');
    band(ctx, g, b, u * 0.4, u * 3.6, '#f2603f');
    band(ctx, g, b, u * 3, u * 4, '#b8402a');
    paintRailing(ctx, g, b);
  }

  // A bank runs out from each end of the bridge, faced with stones at the water.
  function paintBank(ctx, g, b, rand, side) {
    const u = g.U;
    const toe = b.cx + side * (b.r + b.t + u * 1.2);
    const end = side < 0 ? -2 : g.W + 2;
    const shoulder = b.cx + side * b.D * 1.02;
    ctx.fillStyle = '#86a35c';
    ctx.beginPath();
    ctx.moveTo(toe, b.wy + 1);
    ctx.quadraticCurveTo(lerp(toe, shoulder, 0.5), b.wy - b.hb * 0.9, shoulder, b.wy - b.hb - u * 0.5);
    for (let i = 1; i <= 12; i++) {
      const x = lerp(shoulder, end, i / 12);
      ctx.lineTo(x, b.wy - b.hb - u * (0.5 + fbm(x * 0.05, side + 5, 3, 3) * 3));
    }
    ctx.lineTo(end, b.wy + 1);
    ctx.fill();
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = i % 3 === 0 ? '#a3b868' : i % 3 === 1 ? '#6d9150' : '#bcbc6c';
      const x = lerp(toe, end, rand());
      ctx.fillRect(Math.round(x), Math.round(b.wy - rand() * b.hb * 1.1 - u), Math.max(1, Math.round(u * (0.5 + rand()))), Math.max(1, Math.round(u * 0.5)));
    }
    paintBankStones(ctx, g, b, rand, toe, end);
  }

  function rockFace(ctx, x, y, w, h, corners, turn, from, spread, rand) {
    ctx.beginPath();
    for (let i = 0; i < corners; i++) {
      const a = (i / corners) * TAU + turn;
      const k = from + rand() * spread;
      ctx.lineTo(x + Math.cos(a) * w * k, y + Math.sin(a) * h * k);
    }
    ctx.fill();
  }

  function rock(ctx, x, y, w, h, top, side, rand) {
    const corners = 6 + Math.floor(rand() * 3);
    const turn = rand() * TAU;
    ctx.fillStyle = side;
    rockFace(ctx, x, y, w, h, corners, turn, 0.78, 0.36, rand);
    ctx.fillStyle = top;
    rockFace(ctx, x, y - h * 0.26, w, h * 0.72, corners, turn, 0.62, 0.26, rand);
  }

  function paintBankStones(ctx, g, b, rand, from, to) {
    const u = g.U;
    const dir = Math.sign(to - from);
    for (let x = from; (to - x) * dir > 0; x += dir * u * (5 + rand() * rand() * 22)) {
      const w = u * (1.2 + rand() * rand() * 4);
      rock(ctx, x, b.wy - u * 0.4, w, w * 0.56, rand() < 0.5 ? '#c0bba4' : '#aeac98', '#6c6e64', rand);
    }
  }

  function paintWillowCrown(ctx, g, b, rand) {
    const u = g.U;
    const x = state.willowX;
    ctx.strokeStyle = '#4c3f33';
    ctx.lineCap = 'round';
    ctx.lineWidth = u * 3.8;
    ctx.beginPath();
    ctx.moveTo(x - u * 3, b.wy - b.hb + u);
    ctx.bezierCurveTo(x + u * 2, b.wy - u * 22, x - u * 5, u * 26, x + u * 3, u * 9);
    ctx.stroke();
    for (let i = 0; i < 9; i++) {
      const lx = x + lerp(-0.45, 1, i / 8) * state.willowSpread;
      lobe(ctx, g, rand, lx, u * (1 + rand() * 5 + (i / 8) * 2), u * 11, u * 5.4, ['#7f9f52', '#9fb25a', '#bdbd66'], '#6d8f4c', 90);
    }
  }

  function paintWorld(g, b, rand) {
    const c = layer(g.W, b.wy + 1);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, b, rand);
    paintBackdrop(ctx, g, b, rand);
    maple(ctx, g, rand, g.W * 0.895, b.wy - b.hb, 1, MAPLE, '#a73a26');
    paintBridge(ctx, g, b, rand);
    paintWillowCrown(ctx, g, b, rand);
    return c;
  }

  // The garden flipped about the water line, cooled, and darker in steps toward the viewer.
  function paintReflection(g, b, world) {
    const h = g.H - b.wy;
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = SKY[0];
    ctx.fillRect(0, 0, g.W, h);
    ctx.setTransform(1, 0, 0, -1, 0, b.wy);
    ctx.drawImage(world, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#35707e';
    ctx.globalAlpha = 0.2;
    ctx.fillRect(0, 0, g.W, h);
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.07;
      ctx.fillRect(0, (h * i) / 4, g.W, h);
    }
    ctx.globalAlpha = 1;
    snapColours(c, REFLECTION_INKS);
    return c;
  }

  // The most used colours in a pixel buffer, found on a coarse grid.
  function commonColours(d, count) {
    const hits = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const key = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
      hits.set(key, (hits.get(key) || 0) + 1);
    }
    const top = [...hits.entries()].sort((p, q) => q[1] - p[1]).slice(0, count);
    return top.map(([key]) => [((key >> 10) << 3) | 4, (((key >> 5) & 31) << 3) | 4, ((key & 31) << 3) | 4]);
  }

  // Snap a baked layer to its own few main colours, keeping hue, so blends can't scatter them.
  function snapColours(c, count) {
    const ctx = c.getContext('2d');
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    const inks = commonColours(d, count);
    const gap = (i, ink) => (d[i] - ink[0]) ** 2 + (d[i + 1] - ink[1]) ** 2 + (d[i + 2] - ink[2]) ** 2;
    for (let i = 0; i < d.length; i += 4) {
      let best = inks[0];
      for (const ink of inks) if (gap(i, ink) < gap(i, best)) best = ink;
      [d[i], d[i + 1], d[i + 2]] = best;
    }
    ctx.putImageData(img, 0, 0);
  }

  function paintPad(ctx, x, y, w, rand) {
    const h = w * 0.36;
    const notch = rand() * TAU;
    ctx.fillStyle = '#2f4f3f';
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.25, w, h, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rand() < 0.5 ? '#6f9a4e' : '#88a851';
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, notch, notch + TAU * 0.93);
    ctx.lineTo(x, y);
    ctx.fill();
  }

  function paintBloom(ctx, u, x, y, s) {
    ctx.fillStyle = '#c9848a';
    ctx.beginPath();
    ctx.ellipse(x, y - s * 0.1, s * 1.5, s * 0.4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f4e7dc';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * s * 0.62, y);
      ctx.quadraticCurveTo(x + i * s * 0.76, y - s * 0.8, x + i * s * 0.34, y - s * 1.2);
      ctx.quadraticCurveTo(x + i * s * 0.06, y - s * 0.7, x + i * s * 0.14, y);
      ctx.fill();
    }
    ctx.fillStyle = '#e2b94e';
    ctx.fillRect(x - s * 0.22, y - s * 0.42, s * 0.44, Math.max(0.8, s * 0.3));
  }

  function makeClump(g, rand, size, blooms) {
    const u = g.U * size;
    const W = Math.ceil(u * 34);
    const H = Math.ceil(u * 14);
    const c = layer(W, H);
    const ctx = c.getContext('2d');
    const list = [];
    for (let i = 0; i < 9; i++) {
      const a = rand() * TAU;
      const d = Math.sqrt(rand());
      list.push({ x: W / 2 + Math.cos(a) * d * u * 12, y: H * 0.58 + Math.sin(a) * d * u * 3.6, w: u * (2 + rand() * 2.6) });
    }
    list.sort((p, q) => p.y - q.y);
    for (const p of list) paintPad(ctx, p.x, p.y, p.w, rand);
    for (let i = 0; i < blooms; i++) {
      const p = list[Math.floor(rand() * list.length)];
      paintBloom(ctx, u, p.x, p.y - u * 0.3, u * (1.5 + rand() * 0.5));
    }
    return c;
  }

  function makeClumps(g, b, rand) {
    const water = g.H - b.wy;
    const spots = [[0.33, 0.86, 1.3, 3], [0.6, 0.93, 1.5, 3], [0.76, 0.42, 0.8, 2], [0.23, 0.34, 0.7, 1], [0.49, 0.56, 0.75, 1]];
    return spots.map(([fx, fy, size, blooms], i) => {
      const sprite = makeClump(g, rand, size, blooms);
      return { sprite, x: g.W * fx - sprite.width / 2, y: b.wy + water * fy - sprite.height / 2, phase: i * 1.9 };
    });
  }

  function paintStones(ctx, g, b, rand) {
    const u = g.U;
    const water = g.H - b.wy;
    const path = [
      [0.04, 0.92, 12], [0.125, 0.7, 9.4], [0.08, 0.5, 7], [0.155, 0.34, 5.6], [0.12, 0.2, 4.2], [0.175, 0.09, 3.2],
    ];
    for (const [fx, fy, size] of path) {
      const x = fx * g.W + u * 2;
      const y = b.wy + water * fy;
      const w = u * size;
      ctx.fillStyle = '#3f6a70';
      ctx.beginPath();
      ctx.ellipse(x, y + w * 0.3, w * 1.02, w * 0.3, 0, 0, TAU);
      ctx.fill();
      rock(ctx, x, y, w, w * 0.46, '#c8c3aa', '#7a7a6e', rand);
      ctx.fillStyle = '#7f9a50';
      for (let i = 0; i < 12; i++) ctx.fillRect(x + (rand() - 0.5) * w * 1.2, y - w * 0.1 - rand() * w * 0.24, Math.max(1, u * 0.8 * rand()), Math.max(1, u * 0.34));
    }
  }

  function paintFront(g, b, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintStones(ctx, g, b, rand);
    paintNearBank(ctx, g, rand);
    paintLantern(ctx, g, g.W * 0.895, g.H - g.U * 8);
    rock(ctx, g.W * 0.83, g.H - g.U * 2.6, g.U * 7.5, g.U * 3.6, '#c8c3ac', '#6c6c62', rand);
    rock(ctx, g.W * 0.955, g.H - g.U * 5, g.U * 6, g.U * 3, '#c0bba4', '#74746a', rand);
    return c;
  }

  function paintNearBank(ctx, g, rand) {
    const u = g.U;
    ctx.beginPath();
    ctx.moveTo(g.W + 2, g.H + 2);
    ctx.lineTo(g.W * 0.71, g.H + 2);
    ctx.quadraticCurveTo(g.W * 0.78, g.H - u * 9, g.W * 0.87, g.H - u * 13);
    ctx.quadraticCurveTo(g.W * 0.94, g.H - u * 19, g.W + 2, g.H - u * 18);
    ctx.strokeStyle = '#44624a';
    ctx.lineWidth = Math.max(1, u * 1.6);
    ctx.stroke();
    ctx.fillStyle = '#8aa75e';
    ctx.fill();
    for (let i = 0; i < 380; i++) {
      const x = lerp(g.W * 0.74, g.W, rand());
      const y = g.H - rand() * u * 17;
      if ((x - g.W * 0.72) / (g.W * 0.28) < (g.H - y) / (u * 18)) continue;
      ctx.fillStyle = i % 3 === 0 ? '#a9bd6a' : i % 3 === 1 ? '#6f9150' : '#c2c272';
      ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(u * (0.5 + rand()))), Math.max(1, Math.round(u * 0.5)));
    }
  }

  // An unlit stone lantern on the near bank, built from plain cut shapes.
  function paintLantern(ctx, g, x, foot) {
    const u = g.U * 1.05;
    const stone = '#c8c3ac';
    const shade = '#8d8b7a';
    const slab = (w, y, h, tone) => {
      ctx.fillStyle = tone;
      ctx.fillRect(x - u * w, foot - u * y, u * w * 2, u * h);
    };
    slab(5, 2, 2, shade);
    slab(3.6, 3.2, 1.4, stone);
    slab(1.5, 12.5, 9.4, stone);
    slab(4.2, 14, 1.8, stone);
    slab(3.2, 19.6, 5.8, shade);
    slab(2, 18.8, 4.2, '#5a584e');
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.moveTo(x - u * 6.4, foot - u * 19.4);
    ctx.quadraticCurveTo(x - u * 2.5, foot - u * 20.4, x - u * 1, foot - u * 23.4);
    ctx.lineTo(x + u * 1, foot - u * 23.4);
    ctx.quadraticCurveTo(x + u * 2.5, foot - u * 20.4, x + u * 6.4, foot - u * 19.4);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, foot - u * 24.4, u * 1.2, 0, TAU);
    ctx.fill();
  }

  // Short bright and dark dashes that slide along the water and come and go.
  function makeStreaks(g, b, rand) {
    const water = g.H - b.wy;
    const s = { x: new Float32Array(STREAKS), y: new Float32Array(STREAKS), l: new Float32Array(STREAKS), p: new Float32Array(STREAKS) };
    for (let i = 0; i < STREAKS; i++) {
      const d = Math.pow(rand(), 1.4);
      s.x[i] = rand() * g.W;
      s.y[i] = b.wy + 1 + d * (water - 1);
      s.l[i] = g.U * (1.4 + d * 7 + rand() * 3);
      s.p[i] = rand() * TAU;
    }
    return s;
  }

  // Strands hang in loose bundles, so the curtain has gaps to see the garden through.
  function makeStrands(g, b, rand) {
    const u = g.U;
    const bundles = 11;
    const each = 5;
    const n = bundles * each;
    const s = { n, x: new Float32Array(n), y: new Float32Array(n), l: new Float32Array(n), p: new Float32Array(n) };
    for (let i = 0; i < bundles; i++) {
      const f = (i + 0.2 + rand() * 0.6) / bundles;
      const cx = state.willowX + lerp(-state.willowSpread * 0.5, state.willowSpread * 1.04, f);
      const reach = (b.wy - u * 8) * lerp(0.55, 1, Math.sin(f * Math.PI)) * (0.72 + rand() * 0.34);
      const phase = rand() * TAU;
      for (let j = 0; j < each; j++) {
        const k = i * each + j;
        s.x[k] = cx + (j - 2) * u * (0.8 + rand() * 0.9);
        s.y[k] = u * (3 + rand() * 5);
        s.l[k] = reach * (0.76 + rand() * 0.24);
        s.p[k] = phase + j * 0.5;
      }
    }
    return s;
  }

  function makeLeafSprite(g, colour) {
    const size = Math.max(4, Math.ceil(g.U * 3.4));
    const c = layer(size * 2, size * 2);
    const ctx = c.getContext('2d');
    ctx.fillStyle = colour;
    ctx.beginPath();
    for (let i = 0; i <= 30; i++) {
      const a = (i / 30) * TAU;
      const r = size * (0.42 + 0.58 * Math.pow(Math.abs(Math.cos(a * 2.5)), 1.6));
      ctx.lineTo(size + Math.cos(a) * r, size + Math.sin(a) * r);
    }
    ctx.fill();
    return c;
  }

  function makeFloaters(g, b, rand) {
    const list = [];
    for (let i = 0; i < FLOATERS; i++) {
      const d = 0.08 + ((i * 0.618 + rand() * 0.2) % 1) * 0.86;
      const rate = g.U * lerp(0.9, 2.3, d) * (0.8 + rand() * 0.4);
      list.push({ x: rand() * g.W * 1.2, y: lerp(b.wy, g.H, d), scale: lerp(0.42, 1.05, d), rate, tone: i % LEAF_TONES.length, spin: rand() * TAU, phase: rand() * TAU });
    }
    return list;
  }

  function makeFallers(g, b, rand) {
    const list = [];
    for (let i = 0; i < FALLERS; i++) {
      const fall = b.wy + g.U * (2 + rand() * 16);
      list.push({ x: g.W * (0.72 + rand() * 0.24), y: g.U * (6 + rand() * 18), fall, rate: 0.028 + rand() * 0.02, start: rand(), tone: i % LEAF_TONES.length, phase: rand() * TAU });
    }
    return list;
  }

  function makeGrass(g, rand) {
    const u = g.U;
    const list = [];
    for (let i = 0; i < 9; i++) {
      const left = i < 6;
      const x = g.W * (left ? 0.77 + i * 0.016 : 0.96 + (i - 6) * 0.018) + (rand() - 0.5) * u * 5;
      const y = g.H - u * (left ? 3 + i * 1.3 : 13);
      list.push({ x, y, h: u * (8 + rand() * 15), lean: -u * (1.5 + rand() * 3), phase: i * 0.7 + rand() });
    }
    return list;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    const wy = Math.round(g.H * WATER_LINE);
    const r = Math.min(g.U * 28, g.W * 0.2);
    const t = g.U * 4.2;
    const b = { cx: g.W * 0.53, wy, r, t, D: r * 1.62, hb: g.U * 5, top: r + t + g.U * 1.2 };
    state.g = g;
    state.b = b;
    state.willowX = g.W * 0.075;
    state.willowSpread = Math.min(g.U * 34, g.W * 0.22);
    state.world = paintWorld(g, b, rand);
    state.reflection = paintReflection(g, b, state.world);
    state.front = paintFront(g, b, rand);
    state.clumps = makeClumps(g, b, rand);
    state.streaks = makeStreaks(g, b, rand);
    state.strands = makeStrands(g, b, rand);
    state.sprites = LEAF_TONES.map((tone) => makeLeafSprite(g, tone));
    state.floaters = makeFloaters(g, b, rand);
    state.fallers = makeFallers(g, b, rand);
    state.grass = makeGrass(g, rand);
  }

  function waveAt(g, b, y, t, wind) {
    const d = (y - b.wy) / (g.H - b.wy);
    const amp = g.U * (0.12 + 2.6 * d) * (0.35 + wind * 0.65);
    const k = y / g.U;
    return amp * (Math.sin(k * 0.62 + t * 0.85) + 0.6 * Math.sin(k * 1.55 - t * 1.25));
  }

  function drawWater(ctx, g, b, t, wind) {
    const src = state.reflection;
    const water = g.H - b.wy;
    ctx.drawImage(src, 0, b.wy);
    let y = 0;
    while (y < water) {
      const d = y / water;
      const h = Math.max(1, Math.round(g.U * lerp(0.55, 2.1, d)));
      const dx = Math.round(waveAt(g, b, b.wy + y, t, wind));
      ctx.drawImage(src, 0, y, g.W, h, dx, b.wy + y, g.W, h);
      y += h;
    }
  }

  function drawStreaks(ctx, g, t, wind) {
    const s = state.streaks;
    const thick = Math.max(1, g.U * 0.42);
    const slide = t * g.U * (0.4 + wind * 0.5);
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass ? '#28505c' : '#efe9cf';
      for (let i = pass; i < STREAKS; i += 2) {
        const a = Math.sin(t * 0.55 + s.p[i]);
        if (a <= 0) continue;
        ctx.globalAlpha = a * (pass ? 0.36 : 0.46);
        const x = ((s.x[i] + slide) % (g.W + s.l[i] * 2)) - s.l[i];
        ctx.fillRect(x, s.y[i], s.l[i], thick);
      }
    }
    ctx.globalAlpha = 1;
  }

  function strandX(g, s, i, f, t, wind) {
    const sway = g.U * (2.2 + wind * 5.5);
    return s.x[i] + sway * f * f * Math.sin(t * 0.5 + s.p[i] * 0.35 + f * 1.3) + g.U * Math.sin(s.p[i] + f * 3) * f;
  }

  function strandPath(ctx, g, b, s, i, t, wind, mirror) {
    for (let k = 0; k <= STRAND_POINTS; k++) {
      const f = k / STRAND_POINTS;
      let x = strandX(g, s, i, f, t, wind);
      let y = s.y[i] + s.l[i] * f;
      if (mirror) {
        y = 2 * b.wy - y;
        if (y < g.H) x += waveAt(g, b, y, t, wind);
      }
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }

  function drawWillowReflection(ctx, g, b, t, wind) {
    const s = state.strands;
    ctx.strokeStyle = '#3d6a55';
    ctx.lineWidth = Math.max(1, g.U * 0.6);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    for (let i = 0; i < s.n; i += 2) strandPath(ctx, g, b, s, i, t, wind, true);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawWillow(ctx, g, b, t, wind) {
    const s = state.strands;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, g.U * 0.62);
    for (let tone = 0; tone < STRAND_TONES.length; tone++) {
      ctx.strokeStyle = STRAND_TONES[tone];
      ctx.beginPath();
      for (let i = tone; i < s.n; i += STRAND_TONES.length) strandPath(ctx, g, b, s, i, t, wind, false);
      ctx.stroke();
    }
    drawWillowLeaves(ctx, g, s, t, wind);
  }

  function drawWillowLeaves(ctx, g, s, t, wind) {
    const w = Math.max(1, g.U * 0.9);
    const h = Math.max(1, g.U * 1.7);
    ctx.fillStyle = '#b5b562';
    for (let i = 0; i < s.n; i += 2) {
      for (let k = 2; k <= STRAND_POINTS; k += 2) {
        const f = k / STRAND_POINTS;
        const x = strandX(g, s, i, f, t, wind);
        ctx.fillRect(x - w / 2 + (k % 4 ? g.U * 0.5 : -g.U * 0.5), s.y[i] + s.l[i] * f, w, h);
      }
    }
  }

  function drawClumps(ctx, g, t) {
    for (const c of state.clumps) {
      const dx = Math.sin(t * 0.28 + c.phase) * g.U * 0.6;
      const dy = Math.sin(t * 0.42 + c.phase) * g.U * 0.25;
      ctx.drawImage(c.sprite, c.x + dx, c.y + dy);
    }
  }

  function drawFloaters(ctx, g, t, amount) {
    const shown = Math.min(FLOATERS, Math.round(amount * 9));
    for (let i = 0; i < shown; i++) {
      const f = state.floaters[i];
      const x = ((f.x + t * f.rate) % (g.W * 1.2)) - g.W * 0.1;
      const y = f.y + Math.sin(t * 0.4 + f.phase) * g.U * 0.5;
      const sprite = state.sprites[f.tone];
      const a = f.spin + Math.sin(t * 0.18 + f.phase) * 0.9;
      const cs = Math.cos(a) * f.scale;
      const sn = Math.sin(a) * f.scale;
      ctx.setTransform(cs, sn * 0.45, -sn, cs * 0.45, x, y);
      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawFallers(ctx, g, t, amount) {
    const scale = 0.6;
    for (let i = 0; i < Math.min(FALLERS, Math.ceil(amount * 3)); i++) {
      const f = state.fallers[i];
      const life = (t * f.rate + f.start) % 1;
      const sprite = state.sprites[f.tone];
      const x = f.x - life * g.U * 34 + Math.sin(life * 18 + f.phase) * g.U * 3;
      const y = lerp(f.y, f.fall, life);
      const turn = (0.35 + 0.65 * Math.abs(Math.cos(life * 26 + f.phase))) * scale;
      ctx.globalAlpha = smoothstep(0, 0.05, life) * smoothstep(1, 0.94, life);
      ctx.setTransform(turn, 0, 0, scale, x, y);
      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  function drawGrass(ctx, g, t, wind) {
    const sway = g.U * (0.8 + wind * 2.2);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, g.U * 0.42);
    ctx.strokeStyle = '#a9a766';
    ctx.beginPath();
    for (const s of state.grass) {
      const tipX = s.x + s.lean + Math.sin(t * 0.7 + s.phase) * sway;
      ctx.moveTo(s.x, s.y);
      ctx.quadraticCurveTo(s.x, s.y - s.h * 0.6, tipX, s.y - s.h);
    }
    ctx.stroke();
    ctx.strokeStyle = '#cfc698';
    ctx.lineWidth = Math.max(1, g.U * 0.7);
    ctx.beginPath();
    for (const s of state.grass) {
      const tipX = s.x + s.lean + Math.sin(t * 0.7 + s.phase) * sway;
      const tipY = s.y - s.h;
      for (let i = -1; i <= 1; i++) {
        ctx.moveTo(tipX, tipY + g.U * 3.2);
        ctx.lineTo(tipX + s.lean * 0.5 + i * g.U * 0.9, tipY - g.U * (1 - Math.abs(i) * 0.4));
      }
    }
    ctx.stroke();
  }

  function draw(ctx, t, dt, api) {
    const { g, b } = state;
    const { wind, leaves } = api.props;
    ctx.drawImage(state.world, 0, 0);
    drawWater(ctx, g, b, t, wind);
    drawWillowReflection(ctx, g, b, t, wind);
    drawStreaks(ctx, g, t, wind);
    drawClumps(ctx, g, t);
    drawFloaters(ctx, g, t, leaves);
    ctx.drawImage(state.front, 0, 0);
    drawGrass(ctx, g, t, wind);
    drawWillow(ctx, g, b, t, wind);
    drawFallers(ctx, g, t, leaves);
  }

  Kasuri.run({
    defaults: { wind: 1, leaves: 1, ramp: 'lines', cell: 7, boost: 0.26, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
