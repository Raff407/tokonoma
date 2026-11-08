/*
 * 山寺 Yamadera — long stone steps through cedars to a small temple gate in fog.
 *
 * The stair, trees and lanterns are baked into three depth layers and never
 * repainted. Only fog textures slide between them, with a monk of a few paths,
 * lantern glow sprites and a short list of falling needles on top.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, smoothstep, fbm, noise2, parseColor, mixColor, toHex } = K;

  const FOG = parseColor('#b4bfbc');
  const FOG_MAX = 0.66;
  const GATE_S = 0.16;
  const ROAD = 38;
  const TREE_ROWS = [1.22, 0.9, 0.66, 0.48, 0.35, 0.26, 0.19, 0.14, 0.1];
  const LANTERN_ROWS = [0.96, 0.7, 0.51, 0.37, 0.27, 0.2];
  const MAX_NEEDLES = 340;
  const NEEDLE_TONES = ['#b98c56', '#d9d0ae', '#7c6443'];
  const WARM = '#e9b45f';
  const MONK_PERIOD = 320;
  const MONK_FROM = 1.05;
  const MONK_TO = 0.2;
  const MONK_START = 0.32;
  const MONK_LEVELS = 8;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const yAt = (g, s) => g.vy + s * (g.y0 - g.vy);
  const sAt = (g, y) => (y - g.vy) / (g.y0 - g.vy);
  const cxAt = (g, s) => g.W * 0.5 + g.U * 5 * (0.3 - s);
  const halfAt = (g, s) => g.U * ROAD * s;
  const fogAt = (s) => FOG_MAX * (1 - smoothstep(0.1, 0.8, s));
  const toneAt = (hex, s) => toHex(mixColor(parseColor(hex), FOG, fogAt(s)));

  function paintSky(ctx, g) {
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.6);
    sky.addColorStop(0, '#7f8d90');
    sky.addColorStop(1, '#b4bfbc');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    const x = cxAt(g, GATE_S);
    const y = yAt(g, GATE_S) - g.U * 8;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, g.U * 48);
    glow.addColorStop(0, 'rgba(236,232,208,0.95)');
    glow.addColorStop(1, 'rgba(236,232,208,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W, g.H);
  }

  function paintGround(ctx, g, rand) {
    const top = Math.floor(yAt(g, 0.1));
    for (let y = top; y < g.H; y++) {
      const s = sAt(g, y);
      ctx.fillStyle = toneAt('#3f5436', Math.min(1, s * 1.7 + 0.05));
      ctx.fillRect(0, y, g.W, 1);
    }
    const marks = Math.floor(g.W * g.H * 0.05);
    const tones = ['#587442', '#324332', '#74734a', '#2a3a33'];
    for (let i = 0; i < marks; i++) {
      const s = lerp(0.12, 1.1, rand() * rand());
      ctx.fillStyle = toneAt(tones[Math.floor(rand() * tones.length)], Math.min(1, s * 1.7 + 0.05));
      ctx.fillRect(rand() * g.W, yAt(g, s), Math.max(1, g.U * s * (1 + rand() * 3)), Math.max(1, g.U * s));
    }
  }

  function buildSteps(g) {
    const list = [];
    const stop = yAt(g, GATE_S);
    let y = g.y0 + g.U * 2;
    for (let k = 0; y > stop; k++) {
      const s = sAt(g, y);
      const landing = k % 11 === 10;
      const rise = Math.max(2, Math.round(s * g.U * 4.6));
      const h = landing ? Math.round(rise * 2.6) : rise;
      list.push({ top: Math.round(y - h), bot: Math.round(y), s, k, landing });
      y -= h;
    }
    return list;
  }

  function stepTones(depth) {
    const s = Math.min(1, depth * 1.4 + 0.04);
    return {
      tread: ['#6d6f68', '#7d7e74', '#8e8d80', '#a09d8c', '#b3ae9a'].map((c) => toneAt(c, s)),
      riser: ['#2f3536', '#3a3f3e', '#464a47'].map((c) => toneAt(c, s)),
      edge: toneAt('#c9c3ac', s),
      moss: toneAt('#5b7442', s),
      joint: toneAt('#34393a', s),
    };
  }

  function paintStep(ctx, g, st) {
    const s = Math.max(0.05, sAt(g, (st.top + st.bot) / 2));
    const half = halfAt(g, s);
    const cx = cxAt(g, s);
    const h = st.bot - st.top;
    const tones = stepTones(s);
    const front = st.top + h * (st.landing ? 0.82 : 0.58);
    const slab = g.U * s * (18 + (st.k % 3) * 5);
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      const u = (x - cx) / half;
      const wear = 1 - u * u;
      const n = noise2(x * 0.3 / (s * g.U + 0.2), st.k * 2.7, 41);
      const f = Math.round(front + (wear * 0.22 + (n - 0.5) * 0.3) * h);
      const shift = K.hash2(st.k, 3, 19) * slab;
      const joint = Math.abs(((x - cx + shift) % slab + slab) % slab) < Math.max(0.6, g.U * s * 0.6);
      const level = Math.min(4, Math.max(0, Math.floor(n * 2.4 + wear * 2.6)));
      const mossy = Math.abs(u) > 0.74 + n * 0.22;
      ctx.fillStyle = mossy ? tones.moss : joint ? tones.joint : tones.tread[level];
      ctx.fillRect(x, st.top, 1, Math.max(1, f - st.top));
      if (!mossy && !joint && wear > 0.25 && h > 3) {
        ctx.fillStyle = tones.edge;
        ctx.fillRect(x, f - 1, 1, 1);
      }
      ctx.fillStyle = joint ? tones.joint : tones.riser[Math.floor(n * 2.99)];
      ctx.fillRect(x, f, 1, Math.max(0, st.bot - f));
    }
  }

  function paintKerbs(ctx, g) {
    for (const side of [-1, 1]) {
      for (let y = Math.floor(yAt(g, GATE_S)); y < g.H; y++) {
        const s = sAt(g, y);
        const edge = cxAt(g, s) + side * halfAt(g, s);
        const w = Math.max(1, g.U * s * 3.4);
        const n = noise2(y * 0.5 / (g.U * s + 0.3), side * 5, 7);
        ctx.fillStyle = toneAt(n > 0.56 ? '#566d40' : '#6a6c62', s);
        ctx.fillRect(edge - (side < 0 ? w : 0), y, w, 1);
      }
    }
  }

  function paintFallen(ctx, g, rand) {
    const count = Math.floor(g.W * 1.4);
    for (let i = 0; i < count; i++) {
      const s = lerp(0.18, 1, Math.sqrt(rand()));
      const u = (rand() < 0.5 ? -1 : 1) * Math.pow(rand(), 0.4);
      ctx.fillStyle = toneAt(rand() < 0.7 ? '#8a6238' : '#a98a58', s);
      ctx.fillRect(cxAt(g, s) + u * halfAt(g, s), yAt(g, s), Math.max(1, g.U * s * 1.6), 1);
    }
  }

  function roofPath(ctx, x, y, half, rise, curl) {
    ctx.beginPath();
    ctx.moveTo(x - half, y - curl);
    ctx.quadraticCurveTo(x - half * 0.55, y - rise * 0.32, x - half * 0.32, y - rise);
    ctx.lineTo(x + half * 0.32, y - rise);
    ctx.quadraticCurveTo(x + half * 0.55, y - rise * 0.32, x + half, y - curl);
    ctx.quadraticCurveTo(x, y + curl * 0.7, x - half, y - curl);
    ctx.fill();
  }

  function paintGateWalls(ctx, g, x, y) {
    const u = g.U * 0.85;
    for (const side of [-1, 1]) {
      const near = x + side * u * 9;
      const far = x + side * u * 38;
      ctx.fillStyle = '#c9c6b2';
      ctx.fillRect(Math.min(near, far), y - u * 7, u * 29, u * 7);
      ctx.fillStyle = '#6f756f';
      ctx.fillRect(Math.min(near, far), y - u * 2, u * 29, u * 2);
      ctx.fillStyle = '#4d5459';
      ctx.fillRect(Math.min(near, far), y - u * 8.6, u * 29, u * 2);
    }
  }

  function paintGateCanopy(ctx, g, rand) {
    const x = cxAt(g, GATE_S);
    for (let i = 0; i < 9; i++) {
      const dir = i % 2 ? 1 : -1;
      const y = g.U * (i * 0.9 - 9);
      paintBough(ctx, g, x - dir * g.U * 34, y, g.U * (32 + rand() * 9), dir, 0.2, rand);
    }
  }

  function paintGate(ctx, g) {
    const x = cxAt(g, GATE_S);
    const y = yAt(g, GATE_S);
    const u = g.U * 0.85;
    paintGateWalls(ctx, g, x, y);
    ctx.fillStyle = '#f0ecd6';
    ctx.fillRect(x - u * 7.5, y - u * 15, u * 15, u * 15);
    ctx.fillStyle = '#7a3a2c';
    for (const px of [-9, 7.2, -4.8, 3.6]) {
      const wide = Math.abs(px) > 5 ? 1.8 : 1.2;
      ctx.fillRect(x + px * u, y - u * 15.5, u * wide, u * 15.5);
    }
    ctx.fillRect(x - u * 10.5, y - u * 15.5, u * 21, u * 1.5);
    ctx.fillStyle = '#5a2e26';
    ctx.fillRect(x - u * 9.5, y - u * 11.5, u * 19, u * 0.9);
    ctx.fillStyle = '#2f3540';
    roofPath(ctx, x, y - u * 15, u * 17, u * 9, u * 1.6);
    ctx.fillStyle = '#4c535c';
    for (let i = -6; i <= 6; i++) {
      ctx.fillRect(x + i * u * 2 - 0.5, y - u * (19.4 - Math.abs(i) * 0.45), Math.max(1, u * 0.45), u * (4.2 - Math.abs(i) * 0.1));
    }
    ctx.fillStyle = '#20252f';
    ctx.fillRect(x - u * 6.5, y - u * 24.6, u * 13, u * 1.3);
  }

  function paintTrunkBark(ctx, g, t, rand) {
    const streaks = Math.max(3, Math.floor(t.w / Math.max(1.6, g.U * 1.1)));
    ctx.lineWidth = Math.max(1, g.U * t.s * 0.7);
    for (let i = 0; i < streaks; i++) {
      const f = (i + 0.5) / streaks - 0.5;
      ctx.strokeStyle = rand() < 0.55 ? t.dark : t.mid;
      ctx.beginPath();
      ctx.moveTo(t.x + f * t.w, t.y + rand() * g.U * 3);
      for (let k = 1; k <= 5; k++) {
        const q = k / 5;
        const wig = (rand() - 0.5) * g.U * t.s * 1.4;
        ctx.lineTo(lerp(t.x + f * t.w, t.xt + f * t.wt, q) + wig, lerp(t.y, -2, q));
      }
      ctx.stroke();
    }
  }

  function paintTrunk(ctx, g, x, s, rand) {
    const y = yAt(g, s) + g.U * 2 * s;
    const w = g.U * 14 * s;
    const t = { x, y, w, s, xt: x + (g.W * 0.5 - x) * 0.12, wt: w * 0.62, dark: toneAt('#332c2f', s), mid: toneAt('#5e4a40', s) };
    const lit = x < g.W * 0.5 ? 1 : -1;
    ctx.fillStyle = toneAt('#463936', s);
    ctx.beginPath();
    ctx.moveTo(t.x - w * 0.95, y);
    ctx.quadraticCurveTo(t.x - w * 0.5, y - w * 0.4, t.x - w * 0.48, y - w * 1.6);
    ctx.lineTo(t.xt - t.wt / 2, -2);
    ctx.lineTo(t.xt + t.wt / 2, -2);
    ctx.lineTo(t.x + w * 0.48, y - w * 1.6);
    ctx.quadraticCurveTo(t.x + w * 0.5, y - w * 0.4, t.x + w * 0.95, y);
    ctx.fill();
    paintTrunkBark(ctx, g, t, rand);
    ctx.fillStyle = toneAt('#8c7763', s);
    ctx.beginPath();
    ctx.moveTo(t.x + lit * w * 0.5, y - w * 0.8);
    ctx.lineTo(t.xt + lit * t.wt * 0.5, -2);
    ctx.lineTo(t.xt + lit * t.wt * 0.3, -2);
    ctx.lineTo(t.x + lit * w * 0.28, y - w * 0.8);
    ctx.fill();
  }

  function paintBough(ctx, g, x, y, len, dir, s, rand) {
    const droop = len * 0.26;
    const teeth = Math.max(4, Math.floor(len / Math.max(2, g.U * 1.6)));
    ctx.fillStyle = toneAt('#2e4137', s);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + dir * len * 0.5, y - len * 0.04, x + dir * len, y + droop);
    for (let i = teeth; i >= 0; i--) {
      const f = i / teeth;
      const belly = Math.sin(f * Math.PI) * len * 0.22 + len * 0.04;
      const down = i % 2 ? belly * (1 + rand() * 0.6) : belly * 0.55;
      ctx.lineTo(x + dir * len * f, y + droop * f * f + down);
    }
    ctx.fill();
    ctx.fillStyle = toneAt('#506a58', s);
    for (let i = 0; i < teeth * 2; i++) {
      const f = rand();
      ctx.fillRect(x + dir * len * f, y + droop * f * f + rand() * len * 0.1, Math.max(1, g.U * s * 2), Math.max(1, g.U * s * 0.6));
    }
  }

  function paintBoughs(ctx, g, x, s, rand) {
    const reach = g.U * 36 * s;
    const clear = g.U * 24 + halfAt(g, s) * 0.4;
    const top = Math.min(yAt(g, s) - g.U * 28 * s, g.H * 0.3);
    for (let y = -g.U * 2; y < top; y += g.U * (3 + 7 * s) * (0.8 + rand() * 0.5)) {
      for (const dir of [-1, 1]) {
        const tx = x + (g.W * 0.5 - x) * 0.12 * (1 - y / g.H);
        const room = dir * (g.W * 0.5 - tx) > 0 ? Math.abs(g.W * 0.5 - tx) - clear : reach;
        const len = Math.min(reach, room) * (0.6 + rand() * 0.5);
        if (len > g.U * 3 * s) paintBough(ctx, g, tx, y, len, dir, s, rand);
      }
    }
  }

  function paintFern(ctx, g, x, y, r, s, rand) {
    ctx.strokeStyle = toneAt(rand() < 0.5 ? '#5f7d44' : '#3f5a39', s);
    ctx.lineWidth = Math.max(1, g.U * s * 0.5);
    const fronds = 5 + Math.floor(rand() * 4);
    for (let i = 0; i < fronds; i++) {
      const a = lerp(-1, 1, (i + rand() * 0.6) / fronds);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + a * r * 0.6, y - r * 0.8, x + a * r * 1.3, y - r * 0.25);
      ctx.stroke();
    }
  }

  function paintFerns(ctx, g, rand, from, to) {
    const count = Math.floor((g.W / g.U) * 0.7);
    for (let i = 0; i < count; i++) {
      const s = lerp(from, to, rand());
      const side = rand() < 0.5 ? -1 : 1;
      const x = cxAt(g, s) + side * (halfAt(g, s) + g.U * s * 3 + rand() * g.W * 0.55);
      paintFern(ctx, g, x, yAt(g, s), g.U * s * (4 + rand() * 5), s, rand);
    }
  }

  function paintLantern(ctx, g, l) {
    const m = l.h / 34;
    const { x, y, s } = l;
    const lit = toneAt('#a8a595', s);
    const stone = toneAt('#7c7b70', s);
    const shade = toneAt('#4e514d', s);
    const box = (cx, top, bottom, half) => ctx.fillRect(cx - half * m, y + top * m, half * 2 * m, (bottom - top) * m);
    ctx.fillStyle = shade;
    box(x, -3, 0, 6.6);
    ctx.fillStyle = stone;
    box(x, -5, -3, 5);
    box(x, -17, -5, 2.3);
    ctx.fillStyle = lit;
    box(x - l.side * m * 0.8, -17, -5, 1);
    box(x, -6, -5, 2.8);
    box(x, -12, -11, 2.8);
    ctx.fillStyle = stone;
    box(x, -20, -17, 5.4);
    ctx.fillStyle = shade;
    box(x, -27, -20, 4.4);
    ctx.fillStyle = lit;
    roofPath(ctx, x, y - m * 26.5, m * 8.6, m * 4.8, m * 1.2);
    ctx.fillStyle = stone;
    box(x, -32, -31, 1.8);
    ctx.fillStyle = lit;
    ctx.beginPath();
    ctx.arc(x, y - m * 33, m * 1.7, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = toneAt('#5b7442', s);
    for (let i = 0; i < 7; i++) box(x + ((i * 37) % 13 - 6) * m, -27.5 + (i % 3), -26.8 + (i % 3), 0.9);
  }

  function paintPool(ctx, g, l, sprite) {
    const r = g.U * 22 * l.s;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.2;
    ctx.drawImage(sprite, l.x - r * 1.3, l.y - r * 0.5, r * 2.6, r);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function placeLanterns(g, rand) {
    const list = [];
    for (const s of LANTERN_ROWS) {
      for (const side of [-1, 1]) {
        const x = cxAt(g, s) + side * (halfAt(g, s) + g.U * s * 8);
        list.push({ x, y: yAt(g, s), s, side, h: g.U * 34 * s, phase: rand() * 6.28 });
      }
    }
    return list;
  }

  function paintGlow(radius, colour) {
    const size = Math.ceil(radius * 2);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const [r, g, b] = parseColor(colour);
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${r},${g},${b},0.8)`);
    grad.addColorStop(0.4, `rgba(${r},${g},${b},0.26)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  function paintRows(ctx, g, rand, from, to) {
    const center = g.W * 0.5;
    for (const s of TREE_ROWS.slice().reverse()) {
      if (s < from || s >= to) continue;
      const gap = g.U * 40 * s;
      const start = halfAt(g, s) + g.U * s * 24;
      const shift = TREE_ROWS.indexOf(s) % 2 ? gap * 0.5 : 0;
      for (const side of [-1, 1]) {
        for (let i = 0; start + shift + i * gap < g.W * 0.75 + gap; i++) {
          const x = center + side * (start + shift + i * gap + (rand() - 0.5) * gap * 0.2);
          paintTrunk(ctx, g, x, s, rand);
          paintBoughs(ctx, g, x, s, rand);
        }
      }
    }
  }

  function paintLayerLanterns(ctx, g, from, to) {
    for (const l of state.lanterns.slice().reverse()) {
      if (l.s < from || l.s >= to) continue;
      paintPool(ctx, g, l, state.glow);
      paintLantern(ctx, g, l);
    }
  }

  function paintBase(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g);
    paintRows(ctx, g, rand, 0, 0.17);
    paintGround(ctx, g, rand);
    paintRows(ctx, g, rand, 0.17, 0.3);
    paintGateCanopy(ctx, g, rand);
    paintGate(ctx, g);
    for (const st of state.steps.slice().reverse()) paintStep(ctx, g, st);
    paintKerbs(ctx, g);
    paintFallen(ctx, g, rand);
    paintFerns(ctx, g, rand, 0.16, 0.3);
    paintLayerLanterns(ctx, g, 0, 0.3);
    return c;
  }

  function paintDepth(g, rand, from, to) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintRows(ctx, g, rand, from, to);
    paintFerns(ctx, g, rand, from, to);
    paintLayerLanterns(ctx, g, from, to);
    return c;
  }

  function bakeFog(g, height, freq, seed) {
    const w = Math.ceil((g.W * 1.5) / 2);
    const h = Math.max(4, Math.ceil(height / 2));
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const scale = 2 / g.U;
    const noiseAt = (x, y) => fbm(x * scale * freq, y * scale * freq * 3.4, 3, seed);
    for (let y = 0; y < h; y++) {
      const env = Math.sin((y / (h - 1)) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(noiseAt(x, y), noiseAt(x - w, y), x / w);
        const a = Math.round(smoothstep(0.34, 0.68, v) * 5) / 5;
        const o = (y * w + x) * 4;
        img.data[o] = FOG[0] + 24;
        img.data[o + 1] = FOG[1] + 22;
        img.data[o + 2] = FOG[2] + 18;
        img.data[o + 3] = a * env * env * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { canvas: c, w: w * 2, h: h * 2 };
  }

  function makeFogs(g) {
    return [
      { tex: bakeFog(g, g.H * 0.5, 0.016, 3), y: g.H * 0.08, v: g.U * 0.9, a: 0.62, bob: 0.03 },
      { tex: bakeFog(g, g.H * 0.56, 0.012, 11), y: g.H * 0.3, v: -g.U * 1.5, a: 0.56, bob: 0.04 },
      { tex: bakeFog(g, g.H * 0.46, 0.01, 23), y: g.H * 0.62, v: g.U * 2.3, a: 0.5, bob: 0.05 },
      { tex: bakeFog(g, g.H * 0.46, 0.014, 37), y: g.H * 0.16, v: g.U * 1.2, a: 0.48, bob: 0.02 },
    ];
  }

  function drawFog(ctx, g, f, t, amount) {
    const a = f.a * amount;
    if (a <= 0.01) return;
    const off = (((t * f.v) % f.tex.w) + f.tex.w) % f.tex.w;
    const y = f.y + Math.sin(t * f.bob) * g.U * 2.5;
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(f.tex.canvas, off - f.tex.w, y, f.tex.w, f.tex.h);
    ctx.drawImage(f.tex.canvas, off, y, f.tex.w, f.tex.h);
    ctx.globalAlpha = 1;
  }

  function makeMonkTones() {
    const list = [];
    for (let i = 0; i < MONK_LEVELS; i++) {
      const k = (i / (MONK_LEVELS - 1)) * 0.5;
      const mix = (hex) => toHex(mixColor(parseColor(hex), FOG, k));
      list.push({
        robe: mix('#262c40'), fold: mix('#3b4358'), deep: mix('#1b2031'), kesa: mix('#a8803f'),
        hat: mix('#c2a569'), rib: mix('#7f6a40'), rim: mix('#e0c88e'), leg: mix('#343a4e'),
        sandal: mix('#d6cfb6'), staff: mix('#4a3a28'), ring: mix('#c7b888'), skin: mix('#b58d6c'),
      });
    }
    return list;
  }

  function monkLegs(ctx, c, phi) {
    const lift = Math.sin(phi);
    for (const side of [-1, 1]) {
      const up = Math.max(0, side * lift) * 3.4;
      const x = side * 3.9;
      ctx.fillStyle = c.leg;
      ctx.fillRect(x - 2, -14 - up, 4, 12.6);
      ctx.fillStyle = c.sandal;
      ctx.fillRect(x - 2.5, -1.6 - up, 5, 2);
    }
  }

  function monkRobe(ctx, c, phi) {
    const sway = Math.sin(phi) * 0.8;
    ctx.fillStyle = c.robe;
    ctx.beginPath();
    ctx.moveTo(-6, -31);
    ctx.quadraticCurveTo(-8.6, -21, -9.6 + sway, -11);
    ctx.quadraticCurveTo(0, -9, 9.6 + sway, -11);
    ctx.quadraticCurveTo(8.6, -20, 6, -31);
    ctx.fill();
    ctx.fillStyle = c.deep;
    ctx.beginPath();
    ctx.moveTo(-6.4, -30);
    ctx.quadraticCurveTo(-11.5, -22, -13 - sway * 0.5, -13);
    ctx.lineTo(-7.6, -12);
    ctx.quadraticCurveTo(-7, -21, -4, -28);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6.4, -30);
    ctx.quadraticCurveTo(11, -25, 12.6, -20);
    ctx.lineTo(13, -14);
    ctx.lineTo(8.6, -15);
    ctx.quadraticCurveTo(7, -22, 4, -28);
    ctx.fill();
    ctx.strokeStyle = c.fold;
    ctx.lineWidth = 0.8;
    for (const x of [-4, 0.5, 4.5]) {
      ctx.beginPath();
      ctx.moveTo(x * 0.7, -24);
      ctx.lineTo(x * 1.5 + sway, -11);
      ctx.stroke();
    }
    ctx.strokeStyle = c.kesa;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-5, -30);
    ctx.lineTo(6.6, -17);
    ctx.stroke();
  }

  function monkHat(ctx, c) {
    ctx.fillStyle = c.deep;
    ctx.fillRect(-2.6, -32, 5.2, 3);
    ctx.fillStyle = c.hat;
    ctx.beginPath();
    ctx.moveTo(-14, -30);
    ctx.quadraticCurveTo(-6, -41.5, 0, -41.5);
    ctx.quadraticCurveTo(6, -41.5, 14, -30);
    ctx.quadraticCurveTo(0, -26.5, -14, -30);
    ctx.fill();
    ctx.strokeStyle = c.rib;
    ctx.lineWidth = 0.7;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 0.5, -41);
      ctx.lineTo(i * 5.2, -29.4 + Math.abs(i) * 0.5);
      ctx.stroke();
    }
    ctx.strokeStyle = c.rim;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-14, -30);
    ctx.quadraticCurveTo(0, -26.5, 14, -30);
    ctx.stroke();
  }

  function monkStaff(ctx, c, phi) {
    const lean = Math.sin(phi * 0.5) * 1.2;
    ctx.strokeStyle = c.staff;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(14 + lean * 0.4, -1 - Math.max(0, Math.sin(phi)) * 2);
    ctx.lineTo(15.4 + lean, -50);
    ctx.stroke();
    ctx.strokeStyle = c.ring;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(15.5 + lean, -52.6, 2, 2.8, 0, 0, 6.3);
    ctx.stroke();
    ctx.fillStyle = c.skin;
    ctx.fillRect(13.4 + lean * 0.6, -22.5, 2.4, 2.4);
  }

  function drawMonk(ctx, g, t) {
    const p = (t / MONK_PERIOD + MONK_START) % 1;
    const s = MONK_FROM * Math.pow(MONK_TO / MONK_FROM, p);
    const fade = smoothstep(0, 0.07, p) * (1 - smoothstep(0.88, 1, p));
    const level = Math.round((fogAt(s) / FOG_MAX) * (MONK_LEVELS - 1));
    const c = state.monkTones[level];
    const phi = t * 1.5;
    const m = (g.U * 44 * s) / 42;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(cxAt(g, s) + halfAt(g, s) * 0.2 , yAt(g, s));
    ctx.scale(m, m);
    ctx.fillStyle = '#20252c';
    ctx.globalAlpha = fade * 0.24;
    ctx.beginPath();
    ctx.ellipse(1, 0, 13, 2.4, 0, 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = fade;
    ctx.translate(Math.sin(phi) * 0.6, -Math.abs(Math.sin(phi)) * 0.9);
    monkStaff(ctx, c, phi);
    monkLegs(ctx, c, phi);
    monkRobe(ctx, c, phi);
    monkHat(ctx, c);
    ctx.restore();
  }

  function resetNeedle(g, i, anywhere) {
    const r = state.rand;
    const d = 0.3 + r() * 0.7;
    state.nx[i] = r() * g.W;
    state.ny[i] = anywhere ? r() * g.H : -g.U * 2;
    state.nv[i] = g.U * (2.5 + d * 6);
    state.nd[i] = d;
    state.np[i] = r() * 6.28;
    state.nc[i] = Math.floor(r() * NEEDLE_TONES.length);
  }

  function drawNeedles(ctx, g, t, dt, amount) {
    const count = Math.min(MAX_NEEDLES, Math.round(g.W * 1.1 * amount));
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1;
    for (let tone = 0; tone < NEEDLE_TONES.length; tone++) {
      ctx.strokeStyle = NEEDLE_TONES[tone];
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        if (state.nc[i] !== tone) continue;
        state.ny[i] += state.nv[i] * dt;
        if (state.ny[i] > g.H) resetNeedle(g, i, false);
        const d = state.nd[i];
        const a = Math.sin(t * 0.9 + state.np[i]);
        const x = state.nx[i] + a * g.U * 2.2 * d;
        const len = Math.max(1, g.U * d * 1.2);
        ctx.moveTo(x, state.ny[i]);
        ctx.lineTo(x + a * len, state.ny[i] + len * 0.7);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawLights(ctx, g, t, amount) {
    ctx.globalCompositeOperation = 'lighter';
    for (const l of state.lanterns) {
      const m = l.h / 34;
      const r = g.U * 15 * Math.max(l.s, 0.2);
      ctx.globalAlpha = Math.min(1, amount * 0.5 * (0.82 + 0.18 * Math.sin(t * 0.7 + l.phase)));
      ctx.drawImage(state.glow, l.x - r, l.y - m * 23.5 - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = state.flame;
    for (const l of state.lanterns) {
      const m = l.h / 34;
      ctx.globalAlpha = 0.86 + 0.14 * Math.sin(t * 1.1 + l.phase);
      ctx.fillRect(l.x - m * 2.9, l.y - m * 26, Math.max(1, m * 5.8), Math.max(1, m * 5));
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100, vy: api.rows * 0.12, y0: api.rows * 1.02 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.flame = '#f6dc98';
    state.glow = paintGlow(40, WARM);
    state.steps = buildSteps(g);
    state.lanterns = placeLanterns(g, rand);
    state.base = paintBase(g, rand);
    state.mid = paintDepth(g, rand, 0.3, 0.6);
    state.near = paintDepth(g, rand, 0.6, 2);
    state.fogs = makeFogs(g);
    state.monkTones = makeMonkTones();
    state.nx = new Float32Array(MAX_NEEDLES);
    state.ny = new Float32Array(MAX_NEEDLES);
    state.nv = new Float32Array(MAX_NEEDLES);
    state.nd = new Float32Array(MAX_NEEDLES);
    state.np = new Float32Array(MAX_NEEDLES);
    state.nc = new Uint8Array(MAX_NEEDLES);
    for (let i = 0; i < MAX_NEEDLES; i++) resetNeedle(g, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const p = api.props;
    ctx.drawImage(state.base, 0, 0);
    drawFog(ctx, g, state.fogs[0], t, p.fog);
    ctx.drawImage(state.mid, 0, 0);
    drawFog(ctx, g, state.fogs[1], t, p.fog);
    drawMonk(ctx, g, t);
    ctx.drawImage(state.near, 0, 0);
    drawFog(ctx, g, state.fogs[3], t, p.fog);
    drawLights(ctx, g, t, p.glow);
    drawFog(ctx, g, state.fogs[2], t, p.fog);
    drawNeedles(ctx, g, t, dt, p.needles);
  }

  Kasuri.run({
    defaults: { fog: 1, needles: 1, glow: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.05, tint: 0.6, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
