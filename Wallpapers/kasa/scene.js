/*
 * 傘 Kasa — a city crossing in the rain, seen from high above.
 *
 * Road, stripes, pavements and wet patches are baked once, slightly turned so
 * it reads as a view from a tall building. Umbrellas and cars are a short list
 * of baked sprites moved along lanes, each keeping its distance from the one
 * ahead, so queues and clusters form on their own without any per-cell work.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;

  const TILT = -0.2;
  const COS = Math.cos(TILT);
  const SIN = Math.sin(TILT);
  const TAU = Math.PI * 2;

  const CYCLE = 86;
  const WALK_END = 44;
  const CARS_ON = 67;
  const CARS_OFF = 81;
  const START = 8;

  const TONES = ['#434c68', '#4c5673', '#566180', '#616c8c'];
  const PAINT = '#cdc8b4';
  const PAINT_WORN = '#a8a596';
  const WASHI = '#e6dfca';
  const INK = '#171a26';

  // weight is how common the colour is in the crowd.
  const UMBRELLAS = [
    { base: '#6a6f82', weight: 6, rib: '#2c2e3a' },
    { base: '#4f62a2', weight: 5, rib: '#232c54' },
    { base: '#8a92a4', weight: 3, rib: '#454b5c' },
    { base: '#b4c0c8', weight: 4, rib: '#eef0ee', clear: true },
    { base: '#c9c0a4', weight: 2, rib: '#857e68' },
    { base: '#74894f', weight: 2, rib: '#39472c' },
    { base: '#96596a', weight: 2, rib: '#4f2c38' },
    { base: '#c9a146', weight: 1, rib: '#775c24' },
    { base: '#4f62a2', weight: 2, rib: '#232c54', ring: WASHI },
    { base: '#6a6f82', weight: 1, rib: '#2c2e3a', ring: '#c9a146' },
  ];
  const HERO = { base: '#d94f35', rib: '#7c2416' };
  const SIZES = [3.2, 3.8, 4.6];
  const HERO_R = 6.8;
  const CAR_COLOURS = ['#3f4558', '#8b8e92', '#7a342a', '#b3ad98', '#2f4268', '#5a5e68'];

  const LANE_V = [-21.5, -13, -4.3, 4.3, 13, 21.5];
  const LANE_DIR = [1, -1, 1, -1, 1, -1];

  const RAIN_MAX = 300;
  const RIPPLES = 70;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function mix(a, b, t) {
    return K.toHex(K.mixColor(K.parseColor(a), K.parseColor(b), t));
  }

  function rgba(hex, alpha) {
    const [r, g, b] = K.parseColor(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function measures(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    return {
      W, H, U,
      cx: W * 0.5,
      cy: H * 0.5,
      road: W * 0.35,
      band: U * 27,
      stop: U * 33,
      far: W * 0.6 + U * 14,
    };
  }

  function worldX(g, u, v) {
    return g.cx + u * COS - v * SIN;
  }

  function worldY(g, u, v) {
    return g.cy + u * SIN + v * COS;
  }

  // Everything painted inside fn uses road coordinates: u across, v along.
  function inWorld(ctx, g, fn) {
    ctx.save();
    ctx.translate(g.cx, g.cy);
    ctx.rotate(TILT);
    fn();
    ctx.restore();
  }

  function paintAsphalt(ctx, g, rand, seed) {
    const step = Math.max(1, Math.round(g.U * 0.7));
    for (let y = 0; y < g.H; y += step) {
      for (let x = 0; x < g.W; x += step) {
        const v = fbm(x / (g.U * 16), y / (g.U * 16), 3, seed);
        const i = Math.max(0, Math.min(TONES.length - 1, Math.round((v - 0.32) * 10)));
        ctx.fillStyle = TONES[i];
        ctx.fillRect(x, y, step, step);
      }
    }
    ctx.fillStyle = '#1e2334';
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < g.W * g.H * 0.02; i++) ctx.fillRect(rand() * g.W, rand() * g.H, 1, 1);
    ctx.globalAlpha = 1;
  }

  function paintPavement(ctx, g, rand, side) {
    const u = g.U;
    const x0 = side > 0 ? g.road : -g.far * 1.5;
    const width = g.far * 1.5 - g.road;
    const tile = Math.max(2, u * 3.4);
    ctx.fillStyle = '#62635f';
    ctx.fillRect(x0, -g.H, width, g.H * 2);
    const tones = ['#6e6e68', '#575954', '#74736a', '#4f5255'];
    for (let y = -g.H; y < g.H; y += tile) {
      for (let x = x0; x < x0 + width; x += tile * 2) {
        if (rand() < 0.45) continue;
        ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
        ctx.fillRect(x + ((y / tile) % 2 ? tile : 0), y, tile * 2 - 1, tile - 1);
      }
    }
    ctx.fillStyle = '#9b9a90';
    ctx.fillRect(side > 0 ? g.road : -g.road - u * 1.3, -g.H, u * 1.3, g.H * 2);
    ctx.fillStyle = '#1b2030';
    ctx.fillRect(side > 0 ? g.road - u * 1.2 : -g.road + u * 0.1, -g.H, u * 1.1, g.H * 2);
    ctx.fillStyle = '#b4923f';
    const tx = side > 0 ? g.road + u * 3 : -g.road - u * 6;
    ctx.fillRect(tx, -g.band, u * 3, g.band * 2);
    ctx.fillStyle = '#8e7230';
    for (let y = -g.band; y < g.band; y += u * 2) ctx.fillRect(tx + u * 0.6, y, u * 1.8, Math.max(1, u * 0.6));
  }

  function paintStripes(ctx, g, rand) {
    const u = g.U;
    const pitch = u * 10.5;
    const wide = u * 5.6;
    const span = g.road * 2 - u * 6;
    const count = Math.floor(span / pitch);
    const first = -((count - 1) * pitch + wide) / 2;
    for (let i = 0; i < count; i++) {
      const x = first + i * pitch;
      ctx.fillStyle = PAINT;
      ctx.fillRect(x, -g.band, wide, g.band * 2);
      ctx.fillStyle = PAINT_WORN;
      for (let k = 0; k < g.band * 0.14; k++) {
        ctx.fillRect(x + rand() * wide, -g.band + rand() * g.band * 2, u * (0.4 + rand() * 1.1), u * (0.4 + rand() * 1.8));
      }
      ctx.fillStyle = 'rgba(88,100,130,0.3)';
      for (let k = 0; k < 5; k++) {
        ctx.fillRect(x, -g.band + rand() * g.band * 2, wide, u * (0.5 + rand() * 1.5));
      }
    }
  }

  function paintArrow(ctx, u, x, y, dir) {
    ctx.fillRect(x - u * 0.7, y - u * 2 * dir, u * 1.4, u * 8 * dir);
    ctx.beginPath();
    ctx.moveTo(x - u * 2.2, y - u * 2 * dir);
    ctx.lineTo(x, y - u * 6.5 * dir);
    ctx.lineTo(x + u * 2.2, y - u * 2 * dir);
    ctx.fill();
  }

  function paintMarks(ctx, g) {
    const u = g.U;
    const lanes = [-0.75, -0.25, 0.25, 0.75];
    ctx.fillStyle = PAINT_WORN;
    ctx.fillRect(-g.road + u, g.stop - u, g.road - u, u * 2);
    ctx.fillRect(0, -g.stop - u, g.road - u, u * 2);
    ctx.fillRect(-u * 0.7, g.stop, u * 1.4, g.H);
    ctx.fillRect(-u * 0.7, -g.stop - g.H, u * 1.4, g.H);
    for (const side of [-1, 1]) {
      for (let d = u * 8; d < g.H; d += u * 15) {
        ctx.fillRect(side * g.road * 0.5 - u * 0.5, g.stop + d, u, u * 7);
        ctx.fillRect(side * g.road * 0.5 - u * 0.5, -g.stop - d - u * 7, u, u * 7);
      }
    }
    for (const f of lanes) {
      const dir = f < 0 ? 1 : -1;
      paintArrow(ctx, u, f * g.road, dir * (g.stop + u * 12), dir);
    }
  }

  function paintManhole(ctx, g, u0, v0) {
    const u = g.U;
    ctx.fillStyle = '#1d2130';
    ctx.beginPath();
    ctx.arc(u0, v0, u * 3, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#555b6c';
    ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.beginPath();
    ctx.arc(u0, v0, u * 2.3, 0, TAU);
    ctx.stroke();
  }

  // Wet patches go over the paint too, so the stripes look rained on.
  function paintWet(ctx, g, seed) {
    const step = Math.max(1, Math.round(g.U * 0.7));
    for (let y = 0; y < g.H; y += step) {
      for (let x = 0; x < g.W; x += step) {
        const v = fbm(x / (g.U * 11) + 9, y / (g.U * 24) + 4, 3, seed + 31);
        if (v > 0.57) {
          ctx.fillStyle = v > 0.63 ? 'rgba(146,162,196,0.34)' : 'rgba(126,142,178,0.22)';
          ctx.fillRect(x, y, step, step);
        } else if (v < 0.4) {
          ctx.fillStyle = 'rgba(24,28,44,0.2)';
          ctx.fillRect(x, y, step, step);
        }
      }
    }
  }

  // Warm light from the shops falls on the pavements and streaks over the road.
  function paintLights(ctx, g, rand) {
    const u = g.U;
    for (const side of [-1, 1]) {
      const grad = ctx.createLinearGradient(side * (g.road + u * 26), 0, side * g.road, 0);
      grad.addColorStop(0, 'rgba(214,170,92,0.34)');
      grad.addColorStop(1, 'rgba(214,170,92,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(side > 0 ? g.road : -g.far * 1.5, -g.H, g.far * 1.5 - g.road, g.H * 2);
      for (const v of [-58, -40, 40, 58]) {
        const reach = u * (16 + rand() * 18);
        const streak = ctx.createLinearGradient(side * g.road, 0, side * (g.road - reach), 0);
        streak.addColorStop(0, 'rgba(214,170,92,0.36)');
        streak.addColorStop(1, 'rgba(214,170,92,0)');
        ctx.fillStyle = streak;
        ctx.fillRect(side > 0 ? g.road - reach : -g.road, v * u, reach, u * (1.6 + rand() * 2));
      }
    }
  }

  function paintGround(g, rand, seed) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintAsphalt(ctx, g, rand, seed);
    inWorld(ctx, g, () => {
      paintPavement(ctx, g, rand, 1);
      paintPavement(ctx, g, rand, -1);
      paintMarks(ctx, g);
      paintManhole(ctx, g, g.road * 0.5, g.stop + g.U * 20);
      paintManhole(ctx, g, -g.road * 0.3, -g.stop - g.U * 16);
    });
    paintWet(ctx, g, seed);
    inWorld(ctx, g, () => paintLights(ctx, g, rand));
    return c;
  }

  function paintPaint(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    inWorld(ctx, g, () => paintStripes(ctx, g, rand));
    return c;
  }

  function paintTree(ctx, rand, x, y, r) {
    ctx.fillStyle = 'rgba(16,20,28,0.42)';
    ctx.beginPath();
    ctx.arc(x + r * 0.14, y + r * 0.2, r, 0, TAU);
    ctx.fill();
    const tones = ['#3f5a3c', '#50723f', '#688c4c', '#83a55c'];
    for (let i = 0; i < 70; i++) {
      const a = rand() * TAU;
      const d = Math.sqrt(rand()) * r * 0.86;
      const px = x + Math.cos(a) * d;
      const py = y + Math.sin(a) * d;
      const lit = 0.5 - ((px - x) + (py - y)) / (r * 3);
      const tone = Math.max(0, Math.min(3, Math.round(lit * 3 + i / 70 + (rand() - 0.5))));
      ctx.fillStyle = tones[tone];
      ctx.beginPath();
      ctx.arc(px, py, r * (0.14 + rand() * 0.2), 0, TAU);
      ctx.fill();
    }
  }

  function paintTrees(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const r = g.U * 10.5;
    for (const side of [-1, 1]) {
      for (const v of [40, 76, -40, -76]) {
        const u = side * (g.road + g.U * 13);
        paintTree(ctx, rand, worldX(g, u, v * g.U), worldY(g, u, v * g.U), r * (0.9 + rand() * 0.25));
      }
    }
    return c;
  }

  function paintSheen(g, seed) {
    const w = Math.ceil(g.W * 0.75);
    const h = Math.ceil(g.H * 0.5);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const scale = 2 / (g.U * 14);
    const f = (x, y) => fbm(x * scale, y * scale * 1.8, 3, seed + 50);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        if (v < 0.54) continue;
        const i = (y * w + x) * 4;
        img.data[i] = 150;
        img.data[i + 1] = 166;
        img.data[i + 2] = 198;
        img.data[i + 3] = v > 0.6 ? 44 : 22;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // One umbrella, twice oversize so slight turning stays crisp.
  function umbrellaPath(ctx, r, ribs, offset) {
    ctx.beginPath();
    for (let i = 0; i <= ribs; i++) {
      const a = offset + (i / ribs) * TAU;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const m = a - (0.5 / ribs) * TAU;
        ctx.quadraticCurveTo(Math.cos(m) * r * 0.9, Math.sin(m) * r * 0.9, x, y);
      }
    }
    ctx.closePath();
  }

  function paintPanels(ctx, style, r, ribs, offset) {
    const light = style.clear ? style.base : mix(style.base, WASHI, 0.34);
    const dark = mix(style.base, INK, 0.3);
    for (let i = 0; i < ribs; i++) {
      const a0 = offset + (i / ribs) * TAU;
      const a1 = offset + ((i + 1) / ribs) * TAU;
      const m = (a0 + a1) / 2;
      const lit = 0.5 + 0.5 * Math.cos(m + 2.4);
      const stripe = i % 2 ? 0.22 : -0.1;
      ctx.fillStyle = mix(dark, light, Math.max(0, Math.min(1, lit * 0.8 + stripe)));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
      ctx.quadraticCurveTo(Math.cos(m) * r * 0.9, Math.sin(m) * r * 0.9, Math.cos(a1) * r, Math.sin(a1) * r);
      ctx.fill();
    }
  }

  function paintUmbrella(style, r, ribs, offset) {
    const px = r * 2;
    const c = layer(px * 2 + 4, px * 2 + 4);
    const ctx = c.getContext('2d');
    ctx.translate(c.width / 2, c.height / 2);
    ctx.globalAlpha = style.clear ? 0.72 : 1;
    paintPanels(ctx, style, px, ribs, offset);
    ctx.globalAlpha = 1;
    if (style.ring) {
      ctx.strokeStyle = style.ring;
      ctx.lineWidth = px * 0.2;
      ctx.beginPath();
      ctx.arc(0, 0, px * 0.62, 0, TAU);
      ctx.stroke();
    }
    ctx.strokeStyle = style.rib;
    ctx.lineWidth = Math.max(1, px * 0.075);
    ctx.beginPath();
    for (let i = 0; i < ribs; i++) {
      const a = offset + (i / ribs) * TAU;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * px, Math.sin(a) * px);
    }
    ctx.stroke();
    ctx.strokeStyle = style.clear ? '#eef0ee' : mix(style.base, WASHI, 0.4);
    ctx.lineWidth = Math.max(1, px * 0.07);
    umbrellaPath(ctx, px, ribs, offset);
    ctx.stroke();
    ctx.fillStyle = style.clear ? '#5c6470' : INK;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1, px * 0.1), 0, TAU);
    ctx.fill();
    return c;
  }

  // Shadow plus a broken smear of the umbrella's colour on the wet road.
  function paintUnder(style) {
    const r = 24;
    const c = layer(r * 2.8, r * 5.4);
    const ctx = c.getContext('2d');
    const cx = c.width / 2;
    const grad = ctx.createLinearGradient(0, r, 0, c.height);
    grad.addColorStop(0, rgba(style.base, 0.34));
    grad.addColorStop(1, rgba(style.base, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, r * 2.9, r * 0.6, r * 2.4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(14,17,28,0.42)';
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.1, r * 1.55, r * 1.1, r * 1.08, 0, 0, TAU);
    ctx.fill();
    return c;
  }

  function paintCar(colour, g) {
    const s = g.U * 2;
    const w = 8.4 * s;
    const l = 17 * s;
    const beam = 9 * s;
    const c = layer(w + 4, l + beam + 4);
    const ctx = c.getContext('2d');
    ctx.translate(c.width / 2, beam + 2);
    const grad = ctx.createLinearGradient(0, 0, 0, -beam);
    grad.addColorStop(0, 'rgba(226,192,120,0.5)');
    grad.addColorStop(1, 'rgba(226,192,120,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-w * 0.42, -beam, w * 0.28, beam);
    ctx.fillRect(w * 0.14, -beam, w * 0.28, beam);
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.roundRect(-w / 2, 0, w, l, s * 1.6);
    ctx.fill();
    ctx.fillStyle = '#20263a';
    ctx.beginPath();
    ctx.moveTo(-w * 0.38, l * 0.36);
    ctx.lineTo(-w * 0.3, l * 0.27);
    ctx.lineTo(w * 0.3, l * 0.27);
    ctx.lineTo(w * 0.38, l * 0.36);
    ctx.lineTo(w * 0.38, l * 0.76);
    ctx.lineTo(w * 0.32, l * 0.84);
    ctx.lineTo(-w * 0.32, l * 0.84);
    ctx.lineTo(-w * 0.38, l * 0.76);
    ctx.fill();
    ctx.fillStyle = mix(colour, WASHI, 0.16);
    ctx.fillRect(-w * 0.34, l * 0.4, w * 0.68, l * 0.33);
    ctx.fillStyle = mix(colour, WASHI, 0.45);
    ctx.fillRect(-w * 0.26, l * 0.43, w * 0.14, l * 0.27);
    ctx.fillStyle = '#e2c078';
    ctx.fillRect(-w * 0.42, 0, w * 0.22, s * 0.7);
    ctx.fillRect(w * 0.2, 0, w * 0.22, s * 0.7);
    ctx.fillStyle = '#c8452f';
    ctx.fillRect(-w * 0.44, l - s * 0.7, w * 0.24, s * 0.7);
    ctx.fillRect(w * 0.2, l - s * 0.7, w * 0.24, s * 0.7);
    return { canvas: c, w: c.width / 2, h: c.height / 2, ox: c.width / 4, oy: (beam + 2 + l / 2) / 2 };
  }

  function makeAtlas(g, rand) {
    const umbrellas = [];
    const unders = [];
    const picks = [];
    UMBRELLAS.forEach((style, idx) => {
      unders.push(paintUnder(style));
      SIZES.forEach((size, s) => {
        const ribs = 8;
        umbrellas.push({ canvas: paintUmbrella(style, size * g.U, ribs, rand() * 0.8), r: size * g.U, under: idx });
        for (let k = 0; k < style.weight; k++) picks.push(umbrellas.length - 1);
        if (s === 1) for (let k = 0; k < style.weight; k++) picks.push(umbrellas.length - 1);
      });
    });
    unders.push(paintUnder(HERO));
    umbrellas.push({ canvas: paintUmbrella(HERO, HERO_R * g.U, 8, 0.3), r: HERO_R * g.U, under: unders.length - 1 });
    return { umbrellas, unders, picks, hero: umbrellas.length - 1 };
  }

  function agents(n) {
    return {
      n,
      pos: new Float32Array(n),
      vel: new Float32Array(n),
      want: new Float32Array(n),
      len: new Float32Array(n),
      gap: new Float32Array(n),
      ahead: new Uint16Array(n),
    };
  }

  // Lays one lane's people round the ring, in loose clusters.
  function laneSpots(g, rand, ring) {
    const spots = [];
    let at = 0;
    while (at < ring - g.U * 12) {
      spots.push(at);
      const cluster = rand() < 0.72;
      at += g.U * (cluster ? 12 + rand() * 5 : 24 + rand() * 16);
    }
    return spots;
  }

  // Vermilion goes in the two middle lanes, spaced so one is always in view.
  function isHero(lane, k, count) {
    if (lane === 2) return k === Math.floor(count * 0.2) || k === Math.floor(count * 0.7);
    if (lane === 3) return k === Math.floor(count * 0.42) || k === Math.floor(count * 0.92);
    return false;
  }

  function makeWalkers(g, rand, atlas) {
    const ring = g.far * 2;
    const lanes = LANE_V.map(() => laneSpots(g, rand, ring));
    const total = lanes.reduce((sum, l) => sum + l.length, 0);
    const a = agents(total);
    const lane = new Float32Array(total);
    const dir = new Int8Array(total);
    const sprite = new Uint16Array(total);
    const phase = new Float32Array(total);
    const rank = new Float32Array(total);
    let i = 0;
    lanes.forEach((spots, l) => {
      const pace = g.U * (5 + rand() * 1.2);
      const first = i;
      spots.forEach((spot, k) => {
        const hero = isHero(l, k, spots.length);
        sprite[i] = hero ? atlas.hero : atlas.picks[Math.floor(rand() * atlas.picks.length)];
        a.pos[i] = spot - g.far;
        a.want[i] = pace * (0.94 + rand() * 0.12);
        a.vel[i] = a.want[i];
        a.len[i] = atlas.umbrellas[sprite[i]].r;
        a.gap[i] = g.U * (0.2 + rand() * 1.2);
        a.ahead[i] = first + ((k + 1) % spots.length);
        lane[i] = LANE_V[l] * g.U + (rand() - 0.5) * g.U * 1.8;
        dir[i] = LANE_DIR[l];
        phase[i] = rand() * TAU;
        rank[i] = hero ? 0 : 0.3 + rand() * 0.7;
        i++;
      });
    });
    const order = Array.from({ length: total }, (_, k) => k).sort((p, q) => a.len[p] - a.len[q]);
    return { ...a, ring, lane, dir, sprite, phase, rank, order: Uint16Array.from(order) };
  }

  function makeCars(g, rand) {
    const perLane = 3;
    const lanes = [-0.75, -0.25, 0.25, 0.75];
    const a = agents(lanes.length * perLane);
    const ring = (g.H * 0.8 + g.stop) * 2;
    const lane = new Float32Array(a.n);
    const dir = new Int8Array(a.n);
    const sprite = new Uint16Array(a.n);
    const sprites = CAR_COLOURS.map((c) => paintCar(c, g));
    lanes.forEach((f, l) => {
      for (let k = 0; k < perLane; k++) {
        const i = l * perLane + k;
        a.pos[i] = -g.stop - g.U * (10 + rand() * 3) - (perLane - 1 - k) * g.U * (21 + rand() * 4);
        a.want[i] = g.U * (15 + l * 1.3);
        a.len[i] = g.U * 9;
        a.gap[i] = g.U * 3;
        a.ahead[i] = l * perLane + ((k + 1) % perLane);
        lane[i] = f * g.road;
        dir[i] = f < 0 ? -1 : 1;
        sprite[i] = Math.floor(rand() * sprites.length);
      }
    });
    return { ...a, ring, lane, dir, sprite, sprites };
  }

  // Each one closes up on the one ahead and holds at the line while held.
  function stepAgents(a, dt, held, line, rush) {
    for (let i = 0; i < a.n; i++) {
      let room = a.pos[a.ahead[i]] - a.pos[i];
      if (room <= 0) room += a.ring;
      room -= a.len[i] + a.len[a.ahead[i]] + a.gap[i];
      const front = a.pos[i] + a.len[i];
      if (held && front <= line) room = Math.min(room, line - front);
      const target = Math.min(a.want[i] * rush, Math.max(0, room * 1.4));
      a.vel[i] = target < a.vel[i] ? target : a.vel[i] + (target - a.vel[i]) * Math.min(1, dt * 2.4);
      a.pos[i] += a.vel[i] * dt;
      if (a.pos[i] > a.ring / 2) a.pos[i] -= a.ring;
    }
  }

  function makeRain(g, rand) {
    const n = RAIN_MAX;
    const r = { x: new Float32Array(n), y: new Float32Array(n), len: new Float32Array(n), v: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      r.x[i] = rand() * g.W;
      r.y[i] = rand() * g.H;
      r.len[i] = g.U * (3 + rand() * 5);
      r.v[i] = g.U * (56 + rand() * 30);
    }
    return r;
  }

  function makeRipples(g, rand) {
    const r = { x: new Float32Array(RIPPLES), y: new Float32Array(RIPPLES), life: new Float32Array(RIPPLES), rate: new Float32Array(RIPPLES) };
    for (let i = 0; i < RIPPLES; i++) {
      r.x[i] = rand() * g.W;
      r.y[i] = rand() * g.H;
      r.life[i] = rand();
      r.rate[i] = 0.9 + rand() * 0.8;
    }
    r.rand = rand;
    return r;
  }

  function setup(ctx, api) {
    const g = measures(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.ground = paintGround(g, rand, api.seed);
    state.paint = paintPaint(g, rand);
    state.clock = START;
    state.trees = paintTrees(g, rand);
    state.sheen = paintSheen(g, api.seed);
    state.atlas = makeAtlas(g, rand);
    state.walkers = makeWalkers(g, rand, state.atlas);
    state.cars = makeCars(g, rand);
    state.rain = makeRain(g, rand);
    state.ripples = makeRipples(g, rand);
  }

  function drawSheen(ctx, g, t) {
    const w = state.sheen.width * 2;
    const h = state.sheen.height * 2;
    const off = (t * g.U * 0.9) % w;
    ctx.drawImage(state.sheen, -off, 0, w, h);
    ctx.drawImage(state.sheen, w - off, 0, w, h);
  }

  function drawRipples(ctx, g, dt, amount) {
    const r = state.ripples;
    const n = Math.floor(RIPPLES * Math.min(1, amount));
    ctx.strokeStyle = '#c4cfe2';
    ctx.lineWidth = Math.max(0.6, g.U * 0.35);
    for (let pass = 0; pass < 3; pass++) {
      ctx.globalAlpha = (0.7 - pass * 0.2) * Math.min(1, amount + 0.2);
      ctx.beginPath();
      for (let i = pass; i < n; i += 3) {
        const size = g.U * (0.4 + r.life[i] * 1.9);
        const band = Math.floor(r.life[i] * 3);
        if (band === pass) {
          ctx.moveTo(r.x[i] + size, r.y[i]);
          ctx.arc(r.x[i], r.y[i], size, 0, TAU);
        }
      }
      ctx.stroke();
    }
    for (let i = 0; i < RIPPLES; i++) {
      r.life[i] += dt * r.rate[i];
      if (r.life[i] >= 1) {
        r.life[i] = 0;
        r.x[i] = r.rand() * g.W;
        r.y[i] = r.rand() * g.H;
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawCars(ctx, g) {
    const a = state.cars;
    for (let i = 0; i < a.n; i++) {
      const v = a.dir[i] * a.pos[i];
      const x = worldX(g, a.lane[i], v);
      const y = worldY(g, a.lane[i], v);
      if (x < -g.U * 20 || x > g.W + g.U * 20 || y < -g.U * 20 || y > g.H + g.U * 20) continue;
      const s = a.sprites[a.sprite[i]];
      const turn = TILT + (a.dir[i] > 0 ? Math.PI : 0);
      const cs = Math.cos(turn);
      const sn = Math.sin(turn);
      ctx.setTransform(cs, sn, -sn, cs, x, y);
      ctx.drawImage(s.canvas, -s.ox, -s.oy, s.w, s.h);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function walkerX(g, a, i, t) {
    const u = a.dir[i] * a.pos[i];
    const v = a.lane[i] + Math.sin(t * 0.23 + a.phase[i]) * g.U * 0.9;
    return worldX(g, u, v);
  }

  function walkerY(g, a, i, t) {
    const u = a.dir[i] * a.pos[i];
    const v = a.lane[i] + Math.sin(t * 0.23 + a.phase[i]) * g.U * 0.9;
    return worldY(g, u, v);
  }

  function drawUnders(ctx, g, t, crowd) {
    const a = state.walkers;
    const atlas = state.atlas;
    for (let k = 0; k < a.n; k++) {
      const i = a.order[k];
      if (a.rank[i] > crowd) continue;
      const u = atlas.umbrellas[a.sprite[i]];
      const x = walkerX(g, a, i, t);
      const y = walkerY(g, a, i, t);
      if (x < -u.r * 2 || x > g.W + u.r * 2 || y < -u.r * 6 || y > g.H + u.r * 2) continue;
      const s = u.r / 24;
      const under = atlas.unders[u.under];
      ctx.drawImage(under, x - under.width * s * 0.5, y - s * 37, under.width * s, under.height * s);
    }
  }

  function drawUmbrellas(ctx, g, t, crowd) {
    const a = state.walkers;
    const atlas = state.atlas;
    for (let k = 0; k < a.n; k++) {
      const i = a.order[k];
      if (a.rank[i] > crowd) continue;
      const u = atlas.umbrellas[a.sprite[i]];
      const x = walkerX(g, a, i, t);
      const y = walkerY(g, a, i, t);
      if (x < -u.r * 2 || x > g.W + u.r * 2 || y < -u.r * 2 || y > g.H + u.r * 2) continue;
      const moving = a.vel[i] / a.want[i];
      const turn = Math.sin(t * 0.6 + a.phase[i]) * 0.1 + Math.sin(t * 2.6 + a.phase[i]) * 0.05 * moving;
      const cs = Math.cos(turn);
      const sn = Math.sin(turn);
      const half = u.canvas.width / 4;
      ctx.setTransform(cs, sn, -sn, cs, x, y);
      ctx.drawImage(u.canvas, -half, -half, half * 2, half * 2);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawRain(ctx, g, dt, amount) {
    const r = state.rain;
    const n = Math.floor(RAIN_MAX * 0.5 * amount);
    ctx.strokeStyle = '#e8edf6';
    ctx.lineWidth = Math.max(0.8, g.U * 0.4);
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = pass ? 0.5 : 0.28;
      ctx.beginPath();
      for (let i = pass; i < n; i += 2) {
        const lean = 0.2 + ((r.x[i] - g.cx) / g.W) * 0.22;
        ctx.moveTo(r.x[i], r.y[i]);
        ctx.lineTo(r.x[i] + lean * r.len[i], r.y[i] + r.len[i]);
        r.x[i] += lean * r.v[i] * dt;
        r.y[i] += r.v[i] * dt;
        if (r.y[i] > g.H) {
          r.y[i] = -r.len[i];
          r.x[i] = (r.x[i] * 7.31 + i * 13.7) % g.W;
        }
        if (r.x[i] > g.W) r.x[i] -= g.W;
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // The crowd keeps its own clock, so a long pause never strands anyone mid-road.
  function stepCrowd(g, dt) {
    state.clock += dt;
    const tc = state.clock % CYCLE;
    const walk = tc < WALK_END;
    const cars = tc >= CARS_ON && tc < CARS_OFF;
    stepAgents(state.walkers, dt, !walk, -g.road, walk ? 1 : 1.4);
    stepAgents(state.cars, dt, !cars, -g.stop, 1);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const step = Math.min(dt, 0.1);
    const crowd = api.props.crowd;
    stepCrowd(g, step);
    ctx.drawImage(state.ground, 0, 0);
    drawSheen(ctx, g, t);
    ctx.drawImage(state.paint, 0, 0);
    drawRipples(ctx, g, step, api.props.rain);
    drawUnders(ctx, g, t, crowd);
    drawCars(ctx, g);
    drawUmbrellas(ctx, g, t, crowd);
    ctx.drawImage(state.trees, Math.sin(t * 0.4) * g.U * 0.25, Math.sin(t * 0.31) * g.U * 0.2);
    drawRain(ctx, g, step, api.props.rain);
  }

  Kasuri.run({
    defaults: { rain: 1, crowd: 1, ramp: 'lines', cell: 6, boost: 0.14, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
