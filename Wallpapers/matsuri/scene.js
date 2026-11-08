/*
 * 祭 Matsuri — a summer festival street at night, seen from among the crowd.
 *
 * The street runs to one vanishing point and is baked once. Lanterns and people
 * are short lists of baked sprites scaled by depth, so a frame is a few dozen
 * drawImage calls plus some smoke strokes and one goldfish in a bag.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const STRIPES = [
    ['#bd4630', '#ecdcb8'],
    ['#2f4f86', '#ecdcb8'],
    ['#c58f3e', '#ecdcb8'],
    ['#4f7458', '#ecdcb8'],
  ];
  const GOODS = [
    ['#d9583c', '#ecdcb8', '#c58f3e'],
    ['#7fb0b8', '#d9583c', '#ecdcb8'],
    ['#ecdcb8', '#d9583c', '#5a7fa8'],
    ['#c58f3e', '#7c2f28', '#ecdcb8'],
  ];
  const CLOTH = ['#7c2f28', '#2c4170', '#6e5226', '#35523f'];
  const PEOPLE = [
    { kind: 'woman', robe: '#1f2542', band: '#c58f3e', hair: '#141522', skin: '#6c4c44' },
    { kind: 'man', robe: '#2a2038', band: '#55506a', hair: '#141522', skin: '#6c4c44' },
    { kind: 'woman', robe: '#2a2038', band: '#bd4630', hair: '#141522', skin: '#6c4c44' },
    { kind: 'man', robe: '#1f2542', band: '#c58f3e', hair: '#141522', skin: '#6c4c44' },
    { kind: 'child', robe: '#26315a', band: '#d9583c', hair: '#141522', skin: '#6c4c44' },
  ];
  const SKY = ['#454c7e', '#5a5a88', '#7a6680', '#ad7a64'];
  const ROAD = ['#e2b27a', '#d6a874', '#caa070', '#be966a'];
  const SWING = [-1, 0, 1, 0];
  const RIM = '#f0b470';
  const TRACKS = [0.32, 0.47, 0.62, 0.77];
  const MEMBER_PHASE = [0, 0.5, 0.25, 0.75];
  const PUSH_END = 1.5;
  const BACK = 1.06;
  const STALL_DEPTH = 0.62;
  const STALL_FIRST = 0.62;
  const STALL_LAST = 9;
  const POLE_GAP = 1.24;
  const LIVE_LANTERNS = 4.6;
  const LANTERN_GAP = 0.38;
  const STRINGS = [{ lane: 0.64, h: 1.9 }, { lane: 0.36, h: 2.12 }];
  const LANTERN_SIZE = 0.3;
  const MAX_WALKERS = 32;
  const NEAR = 0.55;
  const FAR = 8.5;
  const HERO_Z = 1.1;
  const GRILLS = [3, 8, 9];
  const WISPS = 9;
  const POINTS = 11;
  const SPARKS = 14;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // lane is signed distance across the street, z is depth, h is height in adult heights.
  function pt(g, lane, z, h) {
    return [g.vx + (lane * g.R) / z, g.hz + ((1 - h) * g.G) / z];
  }

  function quad(ctx, a, b, c, d) {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.fill();
  }

  function softGlow(radius, colour, peak, rings) {
    const size = Math.ceil(radius * 2);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const [r, g, b] = K.parseColor(colour);
    // Flat rings, not a smooth ramp: the weave hides the steps and the palette stays small.
    ctx.fillStyle = `rgba(${r},${g},${b},${peak / rings})`;
    for (let i = 0; i < rings; i++) {
      const f = (i + 1) / rings;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, (size / 2) * Math.sqrt(f), 0, 6.3);
      ctx.fill();
    }
    return c;
  }

  // ---- sky, grove, gate, road -------------------------------------------------

  function paintSky(ctx, g, rand) {
    SKY.forEach((tone, i) => {
      const y = (g.hz * i) / SKY.length;
      ctx.fillStyle = tone;
      ctx.beginPath();
      ctx.moveTo(0, g.hz + g.U);
      ctx.lineTo(0, y);
      for (let x = 0; x <= g.W + 3; x += 3) ctx.lineTo(x, y + (i ? (fbm(x * 0.03, i * 3, 3, 8) - 0.5) * g.U * 7 : 0));
      ctx.lineTo(g.W, g.hz + g.U);
      ctx.fill();
    });
    ctx.fillStyle = '#c9c6c0';
    for (let i = 0; i < g.W * 0.12; i++) {
      ctx.globalAlpha = 0.25 + rand() * 0.5;
      ctx.fillRect(rand() * g.W, rand() * g.hz * 0.55, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function paintGrove(ctx, g, tone, rise, seed) {
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(0, g.hz + g.U);
    for (let x = 0; x <= g.W + 2; x += 2) {
      const off = Math.abs(x - g.vx) / (g.W * 0.5);
      const lift = smoothstep(0.05, 0.9, off) * rise + g.U * 7;
      const top = g.hz - lift - (fbm(x * 0.05, seed, 4, seed) - 0.5) * g.U * 16;
      ctx.lineTo(x, top);
    }
    ctx.lineTo(g.W, g.hz + g.U);
    ctx.fill();
  }

  function paintGate(ctx, g) {
    const u = g.U;
    const x = g.vx;
    const foot = g.hz + u * 2;
    const top = g.hz - u * 33;
    ctx.fillStyle = '#a04434';
    ctx.fillRect(x - u * 12.5, top + u * 2, u * 2.6, foot - top);
    ctx.fillRect(x + u * 9.9, top + u * 2, u * 2.6, foot - top);
    ctx.fillRect(x - u * 15, top + u * 8, u * 30, u * 2);
    ctx.fillStyle = '#2c2436';
    ctx.beginPath();
    ctx.moveTo(x - u * 20, top - u * 1.6);
    ctx.quadraticCurveTo(x, top + u * 1.8, x + u * 20, top - u * 1.6);
    ctx.lineTo(x + u * 18, top + u * 2.8);
    ctx.quadraticCurveTo(x, top + u * 5, x - u * 18, top + u * 2.8);
    ctx.fill();
  }

  function paintRoad(ctx, g, rand) {
    ROAD.forEach((tone, i) => {
      const y = g.hz + (g.G * i * i) / (ROAD.length * ROAD.length);
      ctx.fillStyle = tone;
      ctx.fillRect(0, y, g.W, g.H - y);
    });
    for (let i = 0; i < g.W * 0.6; i++) {
      const z = 0.75 + rand() * rand() * 7;
      const p = pt(g, (rand() - 0.5) * 2, z, 0);
      ctx.fillStyle = rand() < 0.5 ? '#54434a' : '#efcf9a';
      ctx.globalAlpha = 0.28;
      ctx.fillRect(p[0], p[1], Math.max(1, (g.U * (2 + rand() * 3)) / z), Math.max(1, (g.U * 0.5) / z));
    }
    ctx.globalAlpha = 1;
  }

  // ---- stalls -----------------------------------------------------------------

  function paintMarks(ctx, g, rand, side, z0, z1, lane, h, size, colours, n) {
    for (let i = 0; i < n; i++) {
      const z = lerp(z0, z1, (i + 0.5 + (rand() - 0.5) * 0.5) / n);
      const p = pt(g, side * lane, z, h);
      const s = (g.G * size * (0.7 + rand() * 0.6)) / z;
      ctx.fillStyle = colours[Math.floor(rand() * colours.length)];
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], Math.max(0.6, s * 0.8), Math.max(0.6, s), 0, 0, 6.3);
      ctx.fill();
    }
  }

  function paintStallInside(ctx, g, rand, side, z0, z1, i) {
    const goods = GOODS[i % GOODS.length];
    ctx.fillStyle = '#ecc080';
    quad(ctx, pt(g, side * BACK, z0, 1.8), pt(g, side * BACK, z1, 1.8), pt(g, side * BACK, z1, 0), pt(g, side * BACK, z0, 0));
    if (z0 > 5.5) return;
    ctx.fillStyle = '#f2e4c4';
    const a = lerp(z0, z1, 0.25);
    const b = lerp(z0, z1, 0.75);
    const wall = side * (BACK - 0.01);
    quad(ctx, pt(g, wall, a, 1.42), pt(g, wall, b, 1.42), pt(g, wall, b, 1.14), pt(g, wall, a, 1.14));
    ctx.fillStyle = '#6e4a38';
    quad(ctx, pt(g, wall, z0, 0.74), pt(g, wall, z1, 0.74), pt(g, wall, z1, 0.71), pt(g, wall, z0, 0.71));
    const n = z0 > 3 ? 4 : 9;
    paintMarks(ctx, g, rand, side, z0, z1, BACK - 0.02, 0.81, 0.05, goods, n);
    paintMarks(ctx, g, rand, side, z0, z1, BACK - 0.02, 0.97, 0.042, goods, n);
  }

  function paintVendor(ctx, g, side, z0, z1, i) {
    if (z0 > 4.2) return;
    const set = state.sprites[i % 4][0][1];
    const z = lerp(z0, z1, 0.5);
    const k = (g.G / z) / set.a;
    const p = pt(g, side * 0.97, z, 0);
    ctx.drawImage(set.c, p[0] - (set.c.width * k) / 2, p[1] - set.foot * k, set.c.width * k, set.c.height * k);
  }

  function paintCounter(ctx, g, rand, side, z0, z1, i) {
    const goods = GOODS[i % GOODS.length];
    ctx.fillStyle = '#d8b084';
    quad(ctx, pt(g, side * 0.86, z0, 0.46), pt(g, side * 0.86, z1, 0.46), pt(g, side * 0.98, z1, 0.46), pt(g, side * 0.98, z0, 0.46));
    if (z0 < 5.5) paintMarks(ctx, g, rand, side, z0, z1, 0.92, 0.5, 0.036, goods, z0 > 3 ? 4 : 10);
    ctx.fillStyle = CLOTH[i % CLOTH.length];
    quad(ctx, pt(g, side * 0.86, z0, 0.46), pt(g, side * 0.86, z1, 0.46), pt(g, side * 0.86, z1, 0), pt(g, side * 0.86, z0, 0));
    ctx.fillStyle = '#efd9ae';
    ctx.globalAlpha = 0.5;
    quad(ctx, pt(g, side * 0.86, z0, 0.46), pt(g, side * 0.86, z1, 0.46), pt(g, side * 0.86, z1, 0.42), pt(g, side * 0.86, z0, 0.42));
    ctx.globalAlpha = 1;
  }

  function paintGrill(ctx, g, rand, side, z0, z1) {
    const a = lerp(z0, z1, 0.14);
    const b = lerp(z0, z1, 0.86);
    ctx.fillStyle = '#2c2436';
    quad(ctx, pt(g, side * 0.87, a, 0.6), pt(g, side * 0.87, b, 0.6), pt(g, side * 0.87, b, 0.46), pt(g, side * 0.87, a, 0.46));
    quad(ctx, pt(g, side * 0.87, a, 0.6), pt(g, side * 0.87, b, 0.6), pt(g, side * 0.98, b, 0.6), pt(g, side * 0.98, a, 0.6));
    for (let n = 0; n < 14; n++) {
      const z = lerp(a, b, (n + rand()) / 14);
      const p = pt(g, side * lerp(0.88, 0.97, rand()), z, 0.6);
      ctx.fillStyle = n % 3 ? '#e4552c' : '#f2b45a';
      ctx.fillRect(p[0], p[1], Math.max(1, (g.U * 1.2) / z), Math.max(1, (g.U * 0.7) / z));
    }
  }

  function paintAwning(ctx, g, side, z0, z1, i) {
    const pair = STRIPES[i % STRIPES.length];
    const count = z0 > 4 ? 4 : 6;
    for (let k = 0; k < count; k++) {
      const a = lerp(z0, z1, k / count);
      const b = lerp(z0, z1, (k + 1) / count);
      const m = (a + b) / 2;
      ctx.fillStyle = pair[k % 2];
      quad(ctx, pt(g, side * 1.12, a, 1.74), pt(g, side * 1.12, b, 1.74), pt(g, side * 0.78, b, 1.38), pt(g, side * 0.78, a, 1.38));
      ctx.beginPath();
      const p0 = pt(g, side * 0.78, a, 1.38);
      const p1 = pt(g, side * 0.78, b, 1.38);
      const p2 = pt(g, side * 0.78, b, 1.22);
      const p3 = pt(g, side * 0.78, m, 1.16);
      const p4 = pt(g, side * 0.78, a, 1.22);
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.lineTo(p3[0], p3[1]);
      ctx.lineTo(p4[0], p4[1]);
      ctx.fill();
    }
    ctx.fillStyle = '#3a2c3c';
    ctx.globalAlpha = 0.45;
    quad(ctx, pt(g, side * 0.78, z0, 1.39), pt(g, side * 0.78, z1, 1.39), pt(g, side * 0.78, z1, 1.36), pt(g, side * 0.78, z0, 1.36));
    ctx.globalAlpha = 1;
  }

  function paintStallEnd(ctx, g, rand, side, z, i) {
    ctx.fillStyle = '#c4915a';
    quad(ctx, pt(g, side * 0.78, z, 1.38), pt(g, side * BACK, z, 1.74), pt(g, side * BACK, z, 0), pt(g, side * 0.86, z, 0));
    if (z > 3.4) return;
    const goods = GOODS[i % GOODS.length];
    ctx.fillStyle = '#6e4a38';
    quad(ctx, pt(g, side * 0.84, z, 0.78), pt(g, side * BACK, z, 0.78), pt(g, side * BACK, z, 0.75), pt(g, side * 0.84, z, 0.75));
    quad(ctx, pt(g, side * 0.84, z, 1.06), pt(g, side * BACK, z, 1.06), pt(g, side * BACK, z, 1.03), pt(g, side * 0.84, z, 1.03));
    for (let n = 0; n < 12; n++) {
      const row = n % 2 ? 1.12 : 0.84;
      const p = pt(g, side * lerp(0.86, 1.04, (n % 6 + rand()) / 6), z, row);
      const r = (g.G * (0.03 + rand() * 0.024)) / z;
      ctx.fillStyle = goods[n % goods.length];
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], r * 0.85, r, 0, 0, 6.3);
      ctx.fill();
    }
  }

  function paintStall(ctx, g, rand, side, z0, z1, i) {
    paintStallEnd(ctx, g, rand, side, z1, i);
    paintStallInside(ctx, g, rand, side, z0, z1, i);
    paintVendor(ctx, g, side, z0, z1, i);
    paintCounter(ctx, g, rand, side, z0, z1, i);
    if (GRILLS.includes(i)) paintGrill(ctx, g, rand, side, z0, z1);
    ctx.fillStyle = '#3a2d3e';
    for (const z of [z0, z1]) {
      const w = Math.max(0.5, (g.U * 0.9) / z);
      const top = pt(g, side * 0.82, z, 1.4);
      const foot = pt(g, side * 0.82, z, 0);
      ctx.fillRect(top[0] - w / 2, top[1], w, foot[1] - top[1]);
    }
    paintAwning(ctx, g, side, z0, z1, i);
    const bulb = pt(g, side * 0.9, lerp(z0, z1, 0.5), 1.2);
    const r = (g.U * 4.5) / lerp(z0, z1, 0.5);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(state.halo, bulb[0] - r, bulb[1] - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#fff1c8';
    ctx.fillRect(bulb[0] - r * 0.06, bulb[1] - r * 0.06, Math.max(1, r * 0.12), Math.max(1, r * 0.12));
  }

  function paintStalls(ctx, g, rand) {
    const zs = [];
    for (let z = STALL_FIRST; z < STALL_LAST; z += STALL_DEPTH) zs.push(z);
    for (let n = zs.length - 1; n >= 0; n--) {
      const z0 = zs[n];
      const z1 = z0 + STALL_DEPTH * 0.93;
      paintStall(ctx, g, rand, -1, z0, z1, n * 2 + 1);
      paintStall(ctx, g, rand, 1, z0, z1, n * 2 + 2);
    }
  }

  // ---- wires and lanterns -----------------------------------------------------

  function wireHeight(base, z) {
    const f = (z % POLE_GAP) / POLE_GAP;
    return base - Math.sin(f * Math.PI) * 0.1;
  }

  function paintWires(ctx, g) {
    ctx.strokeStyle = '#2a2436';
    ctx.lineWidth = 1;
    for (let z = POLE_GAP * 3; z > 0.6; z -= POLE_GAP) {
      ctx.fillStyle = '#34293c';
      for (const side of [-1, 1]) {
        const top = pt(g, side * 0.82, z, 2.2);
        const foot = pt(g, side * 0.82, z, 1.4);
        ctx.fillRect(top[0] - 0.5, top[1], Math.max(1, (g.U * 0.7) / z), foot[1] - top[1]);
      }
      const a = pt(g, -0.82, z, 2.14);
      const b = pt(g, 0.82, z, 2.14);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.quadraticCurveTo(g.vx, a[1] + (g.U * 2) / z, b[0], b[1]);
      ctx.stroke();
    }
    for (const s of STRINGS) {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(g.vx + (side * s.lane * g.R) / 0.8, g.hz + ((1 - s.h) * g.G) / 0.8);
        for (let z = 0.9; z < 8; z += 0.1) {
          const p = pt(g, side * s.lane, z, wireHeight(s.h, z));
          ctx.lineTo(p[0], p[1]);
        }
        ctx.stroke();
      }
    }
  }

  function paintLantern(size, body, edge, band) {
    const w = Math.ceil(size * 0.9);
    const c = layer(w, size);
    const ctx = c.getContext('2d');
    const cx = w / 2;
    const cy = size / 2;
    const rx = w * 0.46;
    const ry = size * 0.42;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, 6.3);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,240,200,0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.72, ry * 0.76, 0, 0, 6.3);
    ctx.fill();
    if (band) {
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, w, cy - ry * 0.55);
      ctx.fillRect(0, cy + ry * 0.55, w, size);
    }
    ctx.fillStyle = edge;
    ctx.globalAlpha = 0.3;
    for (let k = -3; k <= 3; k++) ctx.fillRect(0, cy + (k * ry) / 3.5, w, Math.max(1, size * 0.02));
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2a2230';
    ctx.fillRect(cx - rx * 0.55, cy - ry - size * 0.06, rx * 1.1, size * 0.08);
    ctx.fillRect(cx - rx * 0.55, cy + ry - size * 0.02, rx * 1.1, size * 0.08);
    return c;
  }

  function makeLanterns(g, world) {
    const size = Math.ceil(g.G * LANTERN_SIZE * 1.25);
    const looks = [
      paintLantern(size, '#f1d49a', '#a86a3c', null),
      paintLantern(size, '#dd5a3c', '#7a2a22', null),
      paintLantern(size, '#f1d49a', '#a86a3c', '#c8442e'),
    ];
    const live = [];
    const all = [];
    for (const lane of [-0.64, 0.64, -0.36, 0.36]) {
      const base = Math.abs(lane) > 0.5 ? STRINGS[0].h : STRINGS[1].h;
      let n = 0;
      for (let z = 6.2; z > 0.86; z -= LANTERN_GAP * (1 + z * 0.3)) {
        const p = pt(g, lane, z, wireHeight(base, z) - LANTERN_SIZE * 0.62);
        const s = (g.G * LANTERN_SIZE) / z;
        const look = looks[(n++ + (lane > 0 ? 1 : 0)) % looks.length];
        all.push({ x: p[0], y: p[1], w: s * 0.9, h: s, z, look, phase: z * 1.6 + lane * 4 });
      }
    }
    all.sort((a, b) => b.z - a.z);
    for (const item of all) {
      if (item.z > LIVE_LANTERNS) paintFarLantern(world, item, state.halo);
      else live.push(item);
    }
    return live;
  }

  function paintFarLantern(ctx, l, glow) {
    const r = l.h * 0.78;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    ctx.drawImage(glow, l.x - r, l.y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(l.look, l.x - l.w / 2, l.y - l.h / 2, l.w, l.h);
  }

  function drawLanterns(ctx, t) {
    const list = state.lanterns;
    const glow = state.halo;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < list.length; i++) {
      const l = list[i];
      const r = l.h * 0.78;
      ctx.drawImage(glow, l.x - r, l.y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < list.length; i++) {
      const l = list[i];
      const sway = Math.sin(t * 0.7 + l.phase) * l.w * 0.09;
      ctx.drawImage(l.look, l.x - l.w / 2 + sway, l.y - l.h / 2, l.w, l.h);
    }
    ctx.imageSmoothingEnabled = true;
  }

  // ---- people: each drawn with an adult as one unit, feet at the origin ------

  function paintSleeve(ctx, s, swing, reach, top, bottom) {
    ctx.beginPath();
    ctx.moveTo(s * reach * 0.58, top);
    ctx.lineTo(s * reach, top + 0.08);
    ctx.lineTo(s * (reach + swing * s + 0.012), bottom);
    ctx.lineTo(s * (reach * 0.66 + swing * s), bottom + 0.03);
    ctx.lineTo(s * reach * 0.52, top + 0.2);
    ctx.fill();
  }

  function paintFeet(ctx, spread, step, lift) {
    ctx.fillRect(-spread + step * 0.012, -0.032 - Math.max(0, step) * lift, spread * 0.8, 0.032);
    ctx.fillRect(spread * 0.2 + step * 0.012, -0.032 - Math.max(0, -step) * lift, spread * 0.8, 0.032);
  }

  function paintHead(ctx, p, x, y, rx, ry, facing, bun) {
    ctx.fillStyle = facing ? p.hair : p.skin;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, 6.3);
    ctx.fill();
    if (!facing) {
      ctx.fillStyle = p.hair;
      ctx.beginPath();
      ctx.ellipse(x, y - ry * 0.34, rx * 1.06, ry * 0.72, 0, 0, 6.3);
      ctx.fill();
    }
    if (bun) {
      ctx.fillStyle = p.hair;
      ctx.beginPath();
      ctx.ellipse(x, y - ry * 1.28, rx * 0.68, ry * 0.5, 0, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = p.band;
      ctx.fillRect(x + rx * 0.4, y - ry * 1.42, rx * 0.8, ry * 0.14);
    }
  }

  function paintWoman(ctx, p, facing, phase) {
    const step = SWING[phase];
    const hem = step * 0.012;
    ctx.fillStyle = p.hair;
    paintFeet(ctx, 0.056, step, 0.012);
    ctx.fillStyle = p.robe;
    ctx.beginPath();
    ctx.moveTo(-0.034, -0.83);
    ctx.quadraticCurveTo(-0.085, -0.815, -0.115, -0.765);
    ctx.lineTo(-0.098, -0.6);
    ctx.lineTo(-0.11, -0.44);
    ctx.lineTo(-0.086 + hem, -0.03);
    ctx.lineTo(0.086 + hem, -0.03);
    ctx.lineTo(0.11, -0.44);
    ctx.lineTo(0.098, -0.6);
    ctx.lineTo(0.115, -0.765);
    ctx.quadraticCurveTo(0.085, -0.815, 0.034, -0.83);
    ctx.fill();
    paintSleeve(ctx, -1, step * 0.012, 0.18, -0.79, -0.5);
    paintSleeve(ctx, 1, -step * 0.012, 0.18, -0.79, -0.5);
    ctx.fillStyle = p.band;
    ctx.fillRect(-0.1, -0.625, 0.2, 0.1);
    if (facing) {
      ctx.beginPath();
      ctx.ellipse(-0.058, -0.585, 0.062, 0.05, -0.25, 0, 6.3);
      ctx.ellipse(0.058, -0.585, 0.062, 0.05, 0.25, 0, 6.3);
      ctx.fill();
    }
    ctx.fillStyle = p.skin;
    ctx.fillRect(-0.022, -0.85, 0.044, 0.04);
    paintHead(ctx, p, 0, -0.895, 0.056, 0.068, facing, true);
  }

  function paintMan(ctx, p, facing, phase) {
    const step = SWING[phase];
    const hem = step * 0.014;
    ctx.fillStyle = p.skin;
    ctx.fillRect(-0.06 + hem, -0.12, 0.05, 0.1);
    ctx.fillRect(0.01 + hem, -0.12, 0.05, 0.1);
    ctx.fillStyle = p.hair;
    paintFeet(ctx, 0.068, step, 0.016);
    ctx.fillStyle = p.robe;
    ctx.beginPath();
    ctx.moveTo(-0.04, -0.885);
    ctx.quadraticCurveTo(-0.1, -0.87, -0.145, -0.81);
    ctx.lineTo(-0.128, -0.6);
    ctx.lineTo(-0.12, -0.42);
    ctx.lineTo(-0.108 + hem, -0.095);
    ctx.lineTo(0.108 + hem, -0.095);
    ctx.lineTo(0.12, -0.42);
    ctx.lineTo(0.128, -0.6);
    ctx.lineTo(0.145, -0.81);
    ctx.quadraticCurveTo(0.1, -0.87, 0.04, -0.885);
    ctx.fill();
    paintSleeve(ctx, -1, step * 0.016, 0.215, -0.845, -0.52);
    paintSleeve(ctx, 1, -step * 0.016, 0.215, -0.845, -0.52);
    ctx.fillStyle = p.band;
    ctx.fillRect(-0.122, -0.56, 0.244, 0.05);
    ctx.fillStyle = p.skin;
    ctx.fillRect(-0.026, -0.91, 0.052, 0.04);
    paintHead(ctx, p, 0, -0.955, 0.058, 0.068, facing, false);
  }

  function paintChild(ctx, p, facing, phase) {
    const step = SWING[phase];
    const hem = step * 0.01;
    ctx.fillStyle = p.hair;
    paintFeet(ctx, 0.05, step, 0.012);
    ctx.fillStyle = p.robe;
    ctx.beginPath();
    ctx.moveTo(-0.03, -0.48);
    ctx.quadraticCurveTo(-0.07, -0.47, -0.092, -0.43);
    ctx.lineTo(-0.094 + hem, -0.04);
    ctx.lineTo(0.094 + hem, -0.04);
    ctx.lineTo(0.092, -0.43);
    ctx.quadraticCurveTo(0.07, -0.47, 0.03, -0.48);
    ctx.fill();
    paintSleeve(ctx, -1, step * 0.01, 0.145, -0.45, -0.25);
    paintSleeve(ctx, 1, -step * 0.01, 0.145, -0.45, -0.25);
    ctx.fillStyle = p.band;
    ctx.fillRect(-0.092, -0.31, 0.184, 0.05);
    if (facing) {
      ctx.beginPath();
      ctx.ellipse(-0.06, -0.285, 0.065, 0.045, -0.3, 0, 6.3);
      ctx.ellipse(0.06, -0.285, 0.065, 0.045, 0.3, 0, 6.3);
      ctx.fill();
    }
    paintHead(ctx, p, 0, -0.545, 0.066, 0.074, facing, false);
  }

  // Lights both edges of a figure: everything not covered by itself nudged each way.
  function addRim(c, r, alpha) {
    const inner = layer(c.width, c.height);
    const ictx = inner.getContext('2d');
    ictx.drawImage(c, r, 0);
    ictx.globalCompositeOperation = 'destination-in';
    ictx.drawImage(c, -r, 0);
    const rim = layer(c.width, c.height);
    const rctx = rim.getContext('2d');
    rctx.drawImage(c, 0, 0);
    rctx.globalCompositeOperation = 'source-in';
    rctx.fillStyle = RIM;
    rctx.fillRect(0, 0, c.width, c.height);
    rctx.globalCompositeOperation = 'destination-out';
    rctx.drawImage(inner, 0, 0);
    const ctx = c.getContext('2d');
    ctx.globalAlpha = alpha;
    ctx.drawImage(rim, 0, 0);
    ctx.globalAlpha = 1;
  }

  function addShadow(c, a, foot) {
    const ctx = c.getContext('2d');
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = 'rgba(40,28,44,0.42)';
    ctx.beginPath();
    ctx.ellipse(c.width / 2, foot, a * 0.16, a * 0.022, 0, 0, 6.3);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  function paintPerson(a, p, facing, phase) {
    const c = layer(a * 0.62, a * 1.1);
    const ctx = c.getContext('2d');
    const foot = a * 1.05;
    ctx.translate(c.width / 2, foot);
    ctx.scale(a, a);
    if (p.kind === 'woman') paintWoman(ctx, p, facing, phase);
    else if (p.kind === 'man') paintMan(ctx, p, facing, phase);
    else paintChild(ctx, p, facing, phase);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    addRim(c, Math.max(1, a * 0.012), 0.85);
    addShadow(c, a, foot);
    return { c, a, foot };
  }

  function makeSprites(g) {
    const a = Math.ceil(g.G * 1.1);
    return PEOPLE.map((p) => [0, 1].map((facing) => SWING.map((_, phase) => paintPerson(a, p, facing, phase))));
  }

  // How far a walker at NEAR must be pushed sideways to stand fully off the picture.
  function pushFor(g, lane) {
    const edge = lane < 0 ? g.vx : g.W - g.vx;
    const need = ((edge * NEAR + g.G * 0.31) / g.R) * 1.08;
    return Math.max(0, need / Math.abs(lane) - 1);
  }

  // Each side of the street has its own tracks, and each track one direction and one
  // pace, so people sharing a line never catch up and people meeting never share an x.
  function makeWalkers(rand, g) {
    const groups = TRACKS.length * 2;
    const pace = [];
    for (let k = 0; k < groups; k++) pace.push(0.17 + rand() * 0.09);
    const list = [];
    for (let i = 0; i < MAX_WALKERS; i++) {
      const group = i % groups;
      const member = Math.floor(i / groups);
      const side = group % 2 ? 1 : -1;
      const track = Math.floor(group / 2);
      const lane = side * (TRACKS[track] + (rand() - 0.5) * 0.04);
      const phase = (MEMBER_PHASE[member % MEMBER_PHASE.length] + group * 0.137) % 1;
      list.push({
        slot: i,
        kind: i % 7 === 6 ? 4 : i % 4,
        dir: track % 2 ? 1 : -1,
        lane,
        push: pushFor(g, lane),
        z: lerp(NEAR, FAR, phase),
        speed: pace[group],
        stride: rand() * 4,
        rate: 1.9 + rand() * 0.5,
      });
    }
    return list;
  }

  function stepWalkers(dt) {
    const list = state.walkers;
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      const near = Math.min(1, w.z / 1.6);
      w.z += w.dir * w.speed * near * dt;
      if (w.z < NEAR) w.z += FAR - NEAR;
      else if (w.z > FAR) w.z -= FAR - NEAR;
      w.stride = (w.stride + w.rate * dt) % 4;
    }
    for (let i = 1; i < list.length; i++) {
      const w = list[i];
      let j = i - 1;
      while (j >= 0 && list[j].z < w.z) {
        list[j + 1] = list[j];
        j--;
      }
      list[j + 1] = w;
    }
  }

  function drawWalker(ctx, g, w) {
    const set = state.sprites[w.kind][w.dir > 0 ? 1 : 0][Math.floor(w.stride)];
    const z = w.z;
    const wide = 1 + w.push * (1 - smoothstep(NEAR, PUSH_END, z));
    const k = (g.G / z) / set.a;
    const x = g.vx + (w.lane * wide * g.R) / z;
    const y = g.hz + g.G / z;
    const dw = set.c.width * k;
    const fade = smoothstep(FAR, FAR - 1.5, z);
    ctx.globalAlpha = fade;
    ctx.drawImage(set.c, x - dw / 2, y - set.foot * k, dw, set.c.height * k);
    ctx.globalAlpha = 1;
  }

  function drawCrowd(ctx, g, t, amount) {
    const count = Math.min(MAX_WALKERS, Math.round(16 * amount));
    const list = state.walkers;
    let heroDone = false;
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (!heroDone && w.z < HERO_Z) {
        drawHero(ctx, g, t);
        heroDone = true;
      }
      if (w.slot < count) drawWalker(ctx, g, w);
    }
    if (!heroDone) drawHero(ctx, g, t);
    ctx.imageSmoothingEnabled = true;
  }

  // ---- the hero: a mother and a child holding up a goldfish -------------------

  function paintHeroChild(a, p) {
    const c = layer(a * 0.72, a * 0.9);
    const ctx = c.getContext('2d');
    const foot = a * 0.86;
    const ox = c.width * 0.4;
    ctx.translate(ox, foot);
    ctx.scale(a, a);
    ctx.fillStyle = p.hair;
    paintFeet(ctx, 0.05, 0, 0);
    ctx.fillStyle = p.robe;
    ctx.beginPath();
    ctx.moveTo(-0.03, -0.5);
    ctx.quadraticCurveTo(-0.075, -0.49, -0.1, -0.44);
    ctx.lineTo(-0.104, -0.04);
    ctx.lineTo(0.104, -0.04);
    ctx.lineTo(0.1, -0.44);
    ctx.quadraticCurveTo(0.075, -0.49, 0.03, -0.5);
    ctx.fill();
    paintSleeve(ctx, -1, 0, 0.15, -0.47, -0.24);
    ctx.beginPath();
    ctx.moveTo(0.06, -0.48);
    ctx.lineTo(0.21, -0.6);
    ctx.lineTo(0.235, -0.56);
    ctx.lineTo(0.21, -0.42);
    ctx.lineTo(0.13, -0.33);
    ctx.lineTo(0.08, -0.36);
    ctx.fill();
    ctx.fillStyle = p.skin;
    ctx.fillRect(0.205, -0.635, 0.035, 0.06);
    paintPattern(ctx, 0, -0.26, 0.09, 0.22, 26);
    ctx.fillStyle = p.band;
    ctx.fillRect(-0.102, -0.33, 0.204, 0.06);
    ctx.beginPath();
    ctx.ellipse(-0.085, -0.3, 0.09, 0.062, -0.3, 0, 6.3);
    ctx.ellipse(0.085, -0.3, 0.09, 0.062, 0.3, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#8f2f22';
    ctx.fillRect(-0.02, -0.33, 0.04, 0.06);
    paintHead(ctx, p, 0, -0.57, 0.076, 0.082, 1, false);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    addRim(c, Math.max(1, a * 0.014), 1);
    addShadow(c, a, foot);
    return { c, foot, ox, hand: { x: 0.222, y: -0.64 } };
  }

  // Small pale crosses, so the robe reads as cloth and not a cut-out.
  function paintPattern(ctx, x, y, rx, ry, n) {
    const r = K.rng(77);
    ctx.fillStyle = '#c9d2dc';
    for (let i = 0; i < n; i++) {
      const px = x + (r() * 2 - 1) * rx;
      const py = y + (r() * 2 - 1) * ry;
      ctx.fillRect(px - 0.009, py - 0.002, 0.018, 0.004);
      ctx.fillRect(px - 0.002, py - 0.009, 0.004, 0.018);
    }
  }

  function paintBag(s) {
    const c = layer(s * 2.2, s * 3);
    const ctx = c.getContext('2d');
    const cx = c.width / 2;
    const cy = s * 1.85;
    ctx.fillStyle = 'rgba(214,232,226,0.8)';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.1, s * 0.5);
    ctx.quadraticCurveTo(cx - s * 0.5, s * 0.8, cx - s * 0.98, cy - s * 0.1);
    ctx.quadraticCurveTo(cx - s, cy + s * 0.95, cx, cy + s * 1.02);
    ctx.quadraticCurveTo(cx + s, cy + s * 0.95, cx + s * 0.98, cy - s * 0.1);
    ctx.quadraticCurveTo(cx + s * 0.5, s * 0.8, cx + s * 0.1, s * 0.5);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#8fc0c6';
    ctx.fillRect(0, cy - s * 0.32, c.width, c.height);
    ctx.fillStyle = '#d6eae4';
    ctx.fillRect(0, cy - s * 0.36, c.width, Math.max(1, s * 0.09));
    ctx.fillStyle = '#eef6ee';
    ctx.fillRect(cx - s * 0.74, cy - s * 0.1, Math.max(1, s * 0.14), s * 0.7);
    ctx.restore();
    ctx.fillStyle = '#e6d7b0';
    ctx.fillRect(cx - s * 0.16, s * 0.4, s * 0.32, s * 0.14);
    return { c, s, cy };
  }

  function makeHero(g) {
    const a = g.G / HERO_Z;
    const mother = paintPerson(Math.ceil(a), { kind: 'woman', robe: '#241f3e', band: '#d0a04a', hair: '#141522', skin: '#7c5a4c' }, 1, 1);
    const child = paintHeroChild(Math.ceil(a), { robe: '#2a3a70', band: '#d9583c', hair: '#151522', skin: '#a07a60' });
    const footY = g.hz + a;
    const bag = paintBag(a * 0.095);
    const cx = g.vx + g.W * 0.085;
    return { a, mother, child, bag, footY, cx };
  }

  function drawGoldfish(ctx, s, i, t) {
    const cy = s * 0.5;
    const drift = t * (0.45 + i * 0.2) + i * 2.1;
    const x = Math.sin(drift) * s * 0.5;
    const y = cy + Math.sin(drift * 0.7 + i) * s * 0.24;
    const dir = Math.cos(drift) >= 0 ? 1 : -1;
    const wag = Math.sin(t * 4 + i) * s * 0.06;
    const len = s * 0.36;
    ctx.fillStyle = i ? '#efe0c8' : '#e4552c';
    ctx.beginPath();
    ctx.ellipse(x, y, len * 0.68, len * 0.36, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#e4552c';
    ctx.beginPath();
    ctx.moveTo(x - dir * len * 0.5, y);
    ctx.lineTo(x - dir * len * 1.15, y - len * 0.42 + wag);
    ctx.lineTo(x - dir * len * 1.15, y + len * 0.42 + wag);
    ctx.fill();
  }

  function drawBag(ctx, g, hero, hx, hy, t) {
    const bag = hero.bag;
    const s = bag.s;
    const swing = Math.sin(t * 0.8) * 0.09 + Math.sin(t * 0.31) * 0.04;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(swing);
    ctx.strokeStyle = '#efe0bc';
    ctx.lineWidth = Math.max(1, g.U * 0.25);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, s * 0.5);
    ctx.stroke();
    ctx.globalAlpha = 0.7;
    ctx.drawImage(state.halo, -s * 1.5, s * 0.35, s * 3, s * 3);
    ctx.globalAlpha = 1;
    ctx.drawImage(bag.c, -bag.c.width / 2, 0);
    ctx.translate(0, bag.cy);
    drawGoldfish(ctx, s, 0, t);
    drawGoldfish(ctx, s, 1, t);
    ctx.restore();
  }

  function drawHero(ctx, g, t) {
    const hero = state.hero;
    const { mother, child, a, footY, cx } = hero;
    const lean = Math.sin(t * 0.42) * g.U * 0.3;
    const mx = cx - a * 0.27;
    ctx.drawImage(mother.c, mx - mother.c.width / 2, footY - mother.foot);
    ctx.strokeStyle = '#241f3e';
    ctx.lineWidth = Math.max(1, a * 0.03);
    ctx.beginPath();
    ctx.moveTo(mx + a * 0.13, footY - a * 0.52);
    ctx.lineTo(cx + lean - a * 0.12, footY - a * 0.3);
    ctx.stroke();
    ctx.drawImage(child.c, cx + lean - child.ox, footY - child.foot);
    drawBag(ctx, g, hero, cx + lean + a * child.hand.x, footY + a * child.hand.y, t);
  }

  // ---- smoke --------------------------------------------------------------------

  function paintHaze(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.05, y * 0.11, 4, 33);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const q = Math.round(smoothstep(0.5, 0.7, v) * 2) / 2;
        const i = (y * w + x) * 4;
        img.data[i] = 236;
        img.data[i + 1] = 214;
        img.data[i + 2] = 180;
        img.data[i + 3] = q * band * 120;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function makeWisps(g, rand) {
    const sources = [pt(g, -0.92, 1.53, 0.6), pt(g, 0.92, 2.77, 0.6), pt(g, -0.92, 3.39, 0.6)];
    const list = [];
    for (let i = 0; i < WISPS; i++) {
      const from = sources[i % sources.length];
      const near = i % 3 === 0 ? 1 : i % 3 === 1 ? 0.55 : 0.42;
      list.push({
        x: from[0] + (rand() - 0.5) * g.U * 5 * near,
        y: from[1],
        lean: (from[0] < g.vx ? 1 : -1) * g.U * (34 + rand() * 18) * near,
        phase: rand() * 6.28,
        rate: 0.05 + rand() * 0.04,
        start: rand(),
        rise: g.U * (46 + rand() * 12) * Math.max(0.7, near),
        wobble: g.U * (3 + rand() * 3) * near,
        width: g.U * (7 + rand() * 4) * near,
      });
    }
    return list;
  }

  function drawWisp(ctx, g, w, t, amount) {
    const life = (t * w.rate + w.start) % 1;
    const fade = Math.sin(life * Math.PI);
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = Math.min(1, fade * amount * (pass ? 0.46 : 0.26));
      ctx.lineWidth = Math.max(1, pass ? w.width * 0.4 : w.width);
      ctx.beginPath();
      for (let k = 0; k <= POINTS; k++) {
        const f = k / POINTS;
        const rise = (life * 0.5 + f * 0.5) * w.rise;
        const x = w.x + Math.sin(f * 3.6 + t * 0.35 + w.phase) * f * w.wobble + f * f * w.lean;
        if (k === 0) ctx.moveTo(x, w.y - rise);
        else ctx.lineTo(x, w.y - rise);
      }
      ctx.stroke();
    }
  }

  function drawSmoke(ctx, g, t, amount) {
    if (amount <= 0) return;
    const haze = state.haze;
    const dw = haze.width * 2;
    const dh = haze.height * 2;
    const x = -((t * g.U * 1.6) % dw);
    ctx.globalAlpha = Math.min(1, 0.36 * amount);
    ctx.drawImage(haze, x, g.H * 0.08, dw, dh);
    ctx.drawImage(haze, x + dw, g.H * 0.08, dw, dh);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#bdb6ae';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < state.wisps.length; i++) drawWisp(ctx, g, state.wisps[i], t, amount);
    ctx.globalAlpha = 1;
  }

  function drawSparks(ctx, g, t, amount) {
    if (amount <= 0) return;
    const list = state.sparks;
    ctx.fillStyle = '#f2b45a';
    const size = Math.max(1, g.U * 0.5);
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const life = (t * s.rate + s.start) % 1;
      ctx.globalAlpha = Math.sin(life * Math.PI) * 0.85;
      ctx.fillRect(s.x + Math.sin(t * 0.8 + s.start * 9) * g.U * 1.6 + life * s.lean, s.y - life * s.rise, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function makeSparks(g, rand) {
    const from = [pt(g, -0.92, 1.53, 0.62), pt(g, 0.92, 2.77, 0.62)];
    const list = [];
    for (let i = 0; i < SPARKS; i++) {
      const s = from[i % 2];
      const scale = i % 2 ? 0.6 : 1;
      list.push({
        x: s[0] + (rand() - 0.5) * g.U * 7 * scale,
        y: s[1],
        lean: (s[0] < g.vx ? 1 : -1) * g.U * 5,
        rise: g.U * (14 + rand() * 18) * scale,
        rate: 0.11 + rand() * 0.1,
        start: rand(),
      });
    }
    return list;
  }

  // ---- setup and frame ------------------------------------------------------------

  function paintWorld(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintGrove(ctx, g, '#3a3c60', g.U * 24, 4);
    paintGate(ctx, g);
    paintGrove(ctx, g, '#343a5c', g.U * 34, 9);
    const r = g.U * 50;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.34;
    ctx.drawImage(state.halo, g.vx - r, g.hz - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    paintRoad(ctx, g, rand);
    paintStalls(ctx, g, rand);
    paintWires(ctx, g);
    return c;
  }

  function setup(ctx, api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const g = { W, H, U, vx: W * 0.47, hz: H * 0.48, R: W * 0.5, G: H * 0.52 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.halo = softGlow(24, '#e8a050', 0.42, 2);
    state.sprites = makeSprites(g);
    state.world = paintWorld(g, rand);
    const wctx = state.world.getContext('2d');
    state.lanterns = makeLanterns(g, wctx);
    state.walkers = makeWalkers(rand, g);
    state.hero = makeHero(g);
    state.haze = paintHaze(Math.ceil(W * 0.75), Math.ceil(H * 0.2));
    state.wisps = makeWisps(g, rand);
    state.sparks = makeSparks(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const p = api.props;
    ctx.drawImage(state.world, 0, 0);
    drawLanterns(ctx, t);
    stepWalkers(dt);
    drawCrowd(ctx, g, t, p.crowd);
    drawSmoke(ctx, g, t, p.smoke);
    drawSparks(ctx, g, t, p.smoke);
  }

  Kasuri.run({
    defaults: { crowd: 1, smoke: 1, ramp: 'lines', cell: 7, boost: 0.22, gain: 1.2, tint: 0.6, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
