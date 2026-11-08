/*
 * 夜景 Yakei — a big city at night from a hillside, past dark pines and a railing.
 *
 * The whole city is painted once, row by row from the horizon forward, and never
 * touched again. Each moment only slides two cloud tiles, fades a short list of
 * beacons and windows, and places a few hundred car lights from a lookup table.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const HORIZON = 0.42;
  const FOOT = 0.97;
  const VANISH = 0.5;
  const ROW_STEP = 0.085;
  const AVENUE_GAP = 30;
  const AVENUE_HALF = 0.09;
  const AVENUE_SHIFT = 0.37;
  const LIGHTS = ['#efd8a0', '#e6bb72', '#f3ecd8', '#cbd4d8', '#d6a066', '#c4704e', '#a58a62', '#8f8a80', '#b0764e'].map((c) => K.parseColor(c));
  const BODIES = ['#333a5a', '#3a3e5a', '#2d3350'].map((c) => K.parseColor(c));
  const HAZE = K.parseColor('#86706c');
  const SODIUM = K.parseColor('#e2a55c');
  const CLOUD_TONES = ['#2f3454', '#4f4d68', '#7a666a', '#94796e'].map((c) => K.parseColor(c));
  const TWINKLE_COLOURS = ['#efd8a0', '#e6bb72', '#f3ecd8'];
  const MAX_TWINKLE = 150;
  const MAX_CARS = 320;
  const ROAD_STEPS = 400;
  const INK = '#0e1119';
  const LANE_COLOURS = ['#f5edd8', '#ecdcb4', '#d4593f', '#b8472f'];
  const LANE_OFFSETS = [0.72, 0.3, -0.3, -0.72];
  const TOWERS = [
    [0.83, 0.16, 3.6, 12, 1], [0.545, 0.2, 5, 17, 0], [0.3, 0.2, 5, 20, 1], [0.665, 0.22, 7.5, 38, 2],
    [0.345, 0.22, 4, 14, 0], [0.605, 0.25, 6, 27, 1], [0.725, 0.26, 6.5, 31, 0], [0.78, 0.27, 5, 19, 2],
    [0.64, 0.31, 6, 18, 0],
  ];
  const LEFT_PINE = [[2, 6, 17, 5.5], [22, 10, 19, 5.5], [40, 17, 13, 4], [6, 20, 15, 5], [24, 26, 15, 4.5], [8, 35, 11, 4]];
  const RIGHT_PINE = [[6, 34, 10, 3.5], [15, 43, 10, 3.2], [4, 52, 13, 4], [19, 58, 11, 3.5], [5, 66, 14, 4.5], [15, 74, 11, 4]];
  const ROAD = [[1.12, 0.86], [0.84, 0.74], [0.62, 0.61], [0.44, 0.47], [0.31, 0.33], [0.245, 0.2], [0.205, 0.11], [0.18, 0.05]];
  const ROAD_HALF = 5.6;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function groundY(g, p) {
    return lerp(g.H * HORIZON, g.H * FOOT, p);
  }

  function gauss(x, centre, width) {
    const d = (x - centre) / width;
    return Math.exp(-d * d);
  }

  function hubAt(g, x, p) {
    const main = gauss(x, g.W * 0.66, g.W * 0.13);
    const second = 0.55 * gauss(x, g.W * 0.31, g.W * 0.07);
    return Math.max(main, second) * gauss(p, 0.32, 0.15) * smoothstep(0.1, 0.2, p);
  }

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    sky.addColorStop(0, '#283258');
    sky.addColorStop(0.45, '#3a3c62');
    sky.addColorStop(0.8, '#60526c');
    sky.addColorStop(1, '#94746a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#413b54';
    ctx.beginPath();
    ctx.moveTo(0, g.H * (HORIZON + 0.02));
    for (let x = 0; x <= g.W + 2; x += 2) {
      ctx.lineTo(x, g.H * HORIZON - fbm(x / (g.U * 22), 3, 3, 8) * g.U * 7);
    }
    ctx.lineTo(g.W, g.H * (HORIZON + 0.02));
    ctx.fill();
    return c;
  }

  function cloudPixel(data, i, n, v) {
    const env = smoothstep(0, 0.4, v) * (1 - smoothstep(0.82, 1, v));
    const a = smoothstep(0.32, 0.6, n - (1 - env) * 0.35);
    const light = Math.max(0, Math.min(1, 0.1 + v * 0.62 + (n - 0.5) * 2.4));
    const tone = CLOUD_TONES[Math.round(light * 3)];
    data[i] = tone[0];
    data[i + 1] = tone[1];
    data[i + 2] = tone[2];
    data[i + 3] = Math.round((Math.round(a * 6) / 6) * 255);
  }

  // Half size noise, scaled up once. The blend across x makes the tile seamless.
  function bakeCloud(g, seed, heightFraction) {
    const fullW = Math.ceil(g.W * 1.5);
    const fullH = Math.ceil(g.H * heightFraction);
    const w = Math.ceil(fullW / 2);
    const h = Math.ceil(fullH / 2);
    const small = layer(w, h);
    const sctx = small.getContext('2d');
    const img = sctx.createImageData(w, h);
    const fx = 2 / (g.U * 30);
    const fy = 2 / (g.U * 10);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = fbm(x * fx, y * fy, 4, seed);
        const b = fbm((x - w) * fx, y * fy, 4, seed);
        cloudPixel(img.data, (y * w + x) * 4, lerp(a, b, x / w), y / (h - 1));
      }
    }
    sctx.putImageData(img, 0, 0);
    const full = layer(fullW, fullH);
    full.getContext('2d').drawImage(small, 0, 0, fullW, fullH);
    return full;
  }

  function paintGlow(radius, rgb, peak) {
    const size = Math.ceil(radius * 2);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${rgb},${peak})`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  function rowTones(p) {
    const haze = 1 - smoothstep(0.04, 0.4, p);
    return {
      lit: LIGHTS.map((c) => K.toHex(K.mixColor(c, HAZE, haze * 0.55))),
      body: BODIES.map((c) => K.toHex(K.mixColor(c, HAZE, haze * 0.5))),
      lamp: K.toHex(K.mixColor(SODIUM, HAZE, haze * 0.5)),
    };
  }

  function lightDensity(g, x, p) {
    const wx = (x - g.W * VANISH) / (p * g.U);
    const n = fbm(wx * 0.025, (1 / p) * 0.5, 3, 11);
    return smoothstep(0.32, 0.62, n);
  }

  function putWindow(ctx, x, y, w, h, colour, p, rand) {
    if (p > 0.1 && state.twinkle.length < MAX_TWINKLE && rand() < 0.02) {
      state.twinkle.push({ x, y, w, h, tone: Math.floor(rand() * 3), phase: rand() * 6.28, rate: 0.06 + rand() * 0.16 });
      return;
    }
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w, h);
  }

  function paintWindows(ctx, g, rand, b, tones) {
    const size = Math.max(1, Math.round(g.U * 0.55 * b.p));
    const pitch = Math.max(2, Math.round(g.U * 1.25 * b.p));
    const pitchY = pitch + (rand() < 0.3 ? 1 : 0);
    const lead = tones.lit[Math.floor(rand() * tones.lit.length)];
    for (let y = b.top + 1; y < b.bottom - 1; y += pitchY) {
      const floorLit = b.lit * (0.6 + rand() * 0.8);
      for (let x = b.left + (b.width > 2 ? 1 : 0); x < b.left + b.width; x += pitch) {
        if (rand() > floorLit) continue;
        const colour = rand() < 0.8 ? lead : tones.lit[Math.floor(rand() * tones.lit.length)];
        putWindow(ctx, x, y, size, size, colour, b.p, rand);
      }
    }
    if (b.width < 4) return;
    ctx.fillStyle = tones.lamp;
    for (let x = b.left; x < b.left + b.width; x += 2) {
      if (rand() < b.lit) ctx.fillRect(x, b.bottom - 1, 1, 1);
    }
  }

  function paintBuilding(ctx, g, rand, x, y, w, p, tones) {
    const r = rand();
    const hub = hubAt(g, x, p);
    const height = Math.max(1.5, g.U * p * (3 + 4 * r + 18 * r ** 6 + 46 * hub * r * r));
    const left = Math.round(x);
    const width = Math.max(1, Math.round(w));
    const top = Math.round(y - height);
    ctx.fillStyle = tones.body[Math.floor(rand() * tones.body.length)];
    ctx.fillRect(left, top, width, y - top);
    const lit = lerp(0.24, 0.8, Math.min(1, lightDensity(g, x, p) + hub * 0.6));
    if (width <= 2 && y - top <= 3) {
      if (rand() < lit * 1.2) putWindow(ctx, left, top, 1, 1, tones.lit[Math.floor(rand() * tones.lit.length)], p, rand);
      return;
    }
    paintWindows(ctx, g, rand, { left, top, bottom: y, width, p, lit }, tones);
  }

  function onAvenue(g, x, p) {
    if (p < 0.12) return false;
    const k = (x - g.W * VANISH) / (p * g.U * AVENUE_GAP) + AVENUE_SHIFT;
    return Math.abs(k - Math.round(k)) < AVENUE_HALF;
  }

  function paintAvenueLamps(ctx, g, y, p, tones) {
    if (p < 0.1) return;
    const gap = p * g.U * AVENUE_GAP;
    const half = gap * AVENUE_HALF;
    const vx = g.W * VANISH;
    ctx.fillStyle = tones.lamp;
    for (let i = -Math.ceil(vx / gap) - 1; i <= Math.ceil(vx / gap) + 1; i++) {
      const at = vx + (i - AVENUE_SHIFT) * gap;
      ctx.fillRect(Math.round(at - half), y, 1, 1);
      ctx.fillRect(Math.round(at + half), y, 1, 1);
    }
  }

  function paintRow(ctx, g, rand, p) {
    const y = Math.round(groundY(g, p));
    const tones = rowTones(p);
    let x = -rand() * g.U * 8 * p;
    while (x < g.W) {
      const w = Math.max(1, g.U * p * (5 + rand() * 8));
      if (!onAvenue(g, x + w / 2, p)) paintBuilding(ctx, g, rand, x, y, w, p, tones);
      x += w + Math.max(rand() < 0.5 ? 1 : 0, g.U * p * rand() * 1.6);
    }
    paintAvenueLamps(ctx, g, y, p, tones);
  }

  function paintCrossStreet(ctx, g, rand, p) {
    const y = Math.round(groundY(g, p));
    ctx.fillStyle = rowTones(p).lamp;
    const gap = Math.max(2, g.U * p * 3.2);
    for (let x = rand() * gap; x < g.W; x += gap) {
      if (rand() < 0.85) ctx.fillRect(Math.round(x), y, 1, 1);
    }
  }

  function towerWindowOn(style, floorOn, finColumn, rand) {
    if (style === 1) return floorOn && rand() < 0.92;
    if (style === 2) return finColumn && rand() < 0.86;
    return rand() < 0.55;
  }

  function paintFacade(ctx, g, rand, x, top, w, h, style) {
    const pitch = Math.max(2, Math.round(g.U * 1.1));
    const size = Math.max(1, Math.round(g.U * 0.55));
    const warm = rand() < 0.5 ? '#f3ecd8' : '#efd8a0';
    for (let y = top + pitch; y < top + h - 1; y += pitch) {
      const floorOn = rand() < 0.72;
      for (let i = pitch - 1; i < w - 1; i += pitch) {
        if (!towerWindowOn(style, floorOn, i % (pitch * 2) === pitch - 1, rand)) continue;
        ctx.fillStyle = rand() < 0.86 ? warm : '#d6a066';
        ctx.fillRect(x + i, y, size, size);
      }
    }
  }

  function addBeacon(x, y, size, rand) {
    state.beacons.push({ x, y, size, phase: rand() * 6.28, rate: 0.55 + rand() * 0.35 });
  }

  function paintTower(ctx, g, rand, tower) {
    const [fx, p, wU, hU, style] = tower;
    const u = g.U;
    const w = Math.round(wU * u);
    const x = Math.round(fx * g.W - w / 2);
    const y = Math.round(groundY(g, p));
    const top = Math.round(y - hU * u);
    ctx.fillStyle = '#2f3654';
    ctx.fillRect(x, top, w, y - top);
    ctx.fillRect(x + w * 0.2, top - u * 1.6, w * 0.6, u * 1.6);
    ctx.fillStyle = '#4a506e';
    ctx.fillRect(x, top, Math.max(1, u * 0.5), y - top);
    paintFacade(ctx, g, rand, x, top, w, y - top, style);
    const mast = u * (hU > 24 ? 6 : 3);
    ctx.fillStyle = '#4a506e';
    ctx.fillRect(x + w / 2, top - u * 1.6 - mast, 1, mast);
    addBeacon(x + w / 2 + 0.5, top - u * 1.6 - mast, hU > 24 ? 1.3 : 0.8, rand);
  }

  function latticeHalf(base, t) {
    return (base / 2) * (1 - t) ** 2.6 + (base / 16) * (1 - t);
  }

  function paintLatticeBody(ctx, g, x, y, h, base) {
    ctx.fillStyle = 'rgba(138,74,58,0.55)';
    ctx.beginPath();
    for (let t = 0; t <= 1; t += 0.05) ctx.lineTo(x - latticeHalf(base, t), y - t * h);
    for (let t = 1; t >= 0; t -= 0.05) ctx.lineTo(x + latticeHalf(base, t), y - t * h);
    ctx.fill();
    ctx.strokeStyle = '#cc6c4c';
    ctx.lineWidth = Math.max(1, g.U * 0.55);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.05) ctx.lineTo(x + side * latticeHalf(base, t), y - t * h);
      ctx.stroke();
    }
    ctx.lineWidth = Math.max(0.7, g.U * 0.3);
    ctx.beginPath();
    for (let t = 0.04, side = -1; t < 0.9; t += 0.07, side = -side) {
      ctx.lineTo(x + side * latticeHalf(base, t), y - t * h);
    }
    ctx.stroke();
  }

  function paintLattice(ctx, g, rand) {
    const u = g.U;
    const x = Math.round(g.W * 0.44);
    const y = Math.round(groundY(g, 0.27));
    const h = u * 40;
    const base = u * 15;
    paintLatticeBody(ctx, g, x, y, h, base);
    ctx.fillStyle = '#efd8a0';
    for (const t of [0.3, 0.58]) {
      const half = latticeHalf(base, t) + u * 1.1;
      ctx.fillRect(x - half, y - t * h, half * 2, Math.max(1, u * (t < 0.5 ? 1.2 : 0.9)));
    }
    ctx.fillStyle = '#e6bb72';
    for (let t = 0.05; t < 0.97; t += 0.075) {
      ctx.fillRect(Math.round(x - latticeHalf(base, t)), Math.round(y - t * h), 1, 1);
      ctx.fillRect(Math.round(x + latticeHalf(base, t)), Math.round(y - t * h), 1, 1);
    }
    ctx.fillStyle = '#cc6c4c';
    ctx.fillRect(x, y - h - u * 6, 1, u * 6);
    addBeacon(x + 0.5, y - h - u * 6, 1.3, rand);
    addBeacon(x - u * 2.5, y - h * 0.58, 0.9, rand);
    addBeacon(x + u * 2.5, y - h * 0.58, 0.9, rand);
  }

  function paintCity(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const ground = ctx.createLinearGradient(0, g.H * HORIZON, 0, g.H * 0.62);
    ground.addColorStop(0, '#6a5a60');
    ground.addColorStop(1, '#2a2e4a');
    ctx.fillStyle = ground;
    ctx.fillRect(0, g.H * HORIZON, g.W, g.H * (1 - HORIZON));
    let nextTower = 0;
    let latticeDone = false;
    for (let p = 0.03, i = 0; p < 1.08; p *= 1 + ROW_STEP, i++) {
      while (nextTower < TOWERS.length && TOWERS[nextTower][1] <= p) paintTower(ctx, g, rand, TOWERS[nextTower++]);
      if (!latticeDone && p >= 0.27) {
        paintLattice(ctx, g, rand);
        latticeDone = true;
      }
      paintRow(ctx, g, rand, p);
      if (i % 4 === 3) {
        paintCrossStreet(ctx, g, rand, p * (1 + ROW_STEP));
        p *= 1 + ROW_STEP * 1.5;
      }
    }
    return c;
  }

  function catmull(a, b, c, d, t) {
    return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  }

  function sampleRoad(g) {
    const points = [];
    for (let i = 0; i < ROAD.length - 1; i++) {
      const a = ROAD[Math.max(0, i - 1)];
      const b = ROAD[i];
      const c = ROAD[i + 1];
      const d = ROAD[Math.min(ROAD.length - 1, i + 2)];
      for (let k = 0; k < 40; k++) {
        const t = k / 40;
        const p = catmull(a[1], b[1], c[1], d[1], t);
        points.push({ x: catmull(a[0], b[0], c[0], d[0], t) * g.W, y: groundY(g, p) - g.U * 6 * p, p });
      }
    }
    return points;
  }

  // Equal steps along the road in world distance, so traffic crowds toward the horizon.
  function buildRoadTable(g) {
    const points = sampleRoad(g);
    const dist = [0];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      dist.push(dist[i - 1] + Math.hypot(b.x - a.x, b.y - a.y) / b.p);
    }
    const total = dist[dist.length - 1];
    const road = { x: new Float32Array(ROAD_STEPS), y: new Float32Array(ROAD_STEPS), p: new Float32Array(ROAD_STEPS), total };
    road.nx = new Float32Array(ROAD_STEPS);
    road.ny = new Float32Array(ROAD_STEPS);
    let j = 0;
    for (let i = 0; i < ROAD_STEPS; i++) {
      const want = (i / (ROAD_STEPS - 1)) * total;
      while (j < dist.length - 2 && dist[j + 1] < want) j++;
      const a = points[j];
      const b = points[j + 1];
      const f = Math.min(1, (want - dist[j]) / Math.max(1e-6, dist[j + 1] - dist[j]));
      road.x[i] = lerp(a.x, b.x, f);
      road.y[i] = lerp(a.y, b.y, f);
      road.p[i] = lerp(a.p, b.p, f);
      const len = Math.max(1e-6, Math.hypot(b.x - a.x, b.y - a.y));
      road.nx[i] = -(b.y - a.y) / len;
      road.ny[i] = (b.x - a.x) / len;
      if (road.ny[i] < 0) {
        road.nx[i] = -road.nx[i];
        road.ny[i] = -road.ny[i];
      }
    }
    return road;
  }

  function strokeRoad(ctx, g, road, offset, widthAt) {
    for (let i = 0; i < ROAD_STEPS - 1; i += 2) {
      const half = g.U * ROAD_HALF * road.p[i] * offset;
      const next = Math.min(ROAD_STEPS - 1, i + 2);
      ctx.lineWidth = widthAt(road.p[i]);
      ctx.beginPath();
      ctx.moveTo(road.x[i] + road.nx[i] * half, road.y[i] + road.ny[i] * half);
      ctx.lineTo(road.x[next] + road.nx[next] * half, road.y[next] + road.ny[next] * half);
      ctx.stroke();
    }
  }

  function paintRoad(ctx, g, road) {
    const u = g.U;
    ctx.fillStyle = '#161a2c';
    for (let i = 0; i < ROAD_STEPS; i += 9) {
      const p = road.p[i];
      ctx.fillRect(road.x[i] - (u * p * 1.1) / 2, road.y[i], Math.max(1, u * p * 1.1), u * p * 8);
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1b1f33';
    strokeRoad(ctx, g, road, 0, (p) => Math.max(0.8, u * ROAD_HALF * 2.2 * p));
    ctx.strokeStyle = '#6c6470';
    strokeRoad(ctx, g, road, -1.08, (p) => Math.max(0.3, u * 0.6 * p));
    strokeRoad(ctx, g, road, 1.08, (p) => Math.max(0.3, u * 0.6 * p));
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#d9b67c';
    strokeRoad(ctx, g, road, 0.5, (p) => Math.max(0.4, u * 3 * p));
    ctx.strokeStyle = '#9c4432';
    strokeRoad(ctx, g, road, -0.5, (p) => Math.max(0.4, u * 3 * p));
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#efd8a0';
    for (let i = 0; i < ROAD_STEPS; i += 7) {
      const half = u * ROAD_HALF * 1.1 * road.p[i];
      ctx.fillRect(Math.round(road.x[i] - road.nx[i] * half), Math.round(road.y[i] - road.ny[i] * half), 1, 1);
    }
  }

  // A window that happens to sit under the deck would shine through it.
  function clearOfRoad(g, road, w) {
    for (let i = 0; i < ROAD_STEPS; i += 2) {
      const reach = g.U * ROAD_HALF * 1.3 * road.p[i] + 1;
      if (Math.abs(road.x[i] - w.x) < reach && Math.abs(road.y[i] - w.y) < reach) return false;
    }
    return true;
  }

  function makeCars(g, rand, road) {
    const cars = { start: new Float32Array(MAX_CARS), rate: new Float32Array(MAX_CARS) };
    const base = (g.U * 8) / road.total;
    for (let i = 0; i < MAX_CARS; i++) {
      const lane = i % 4;
      cars.start[i] = rand();
      cars.rate[i] = (lane < 2 ? -1 : 1) * base * (lane % 2 ? 0.84 : 1);
    }
    return cars;
  }

  function drawCars(ctx, g, t, amount) {
    const road = state.road;
    const cars = state.cars;
    const count = Math.min(MAX_CARS, Math.round(170 * amount));
    const last = ROAD_STEPS - 1;
    for (let lane = 0; lane < 4; lane++) {
      ctx.fillStyle = LANE_COLOURS[lane];
      const offset = LANE_OFFSETS[lane] * g.U * ROAD_HALF;
      for (let i = lane; i < count; i += 4) {
        const u = cars.start[i] + cars.rate[i] * t;
        const at = (u - Math.floor(u)) * last;
        const k = at | 0;
        const n = k < last ? k + 1 : k;
        const f = at - k;
        const p = road.p[k];
        const x = road.x[k] + (road.x[n] - road.x[k]) * f + road.nx[k] * offset * p;
        if (x > g.W + 4) continue;
        const y = road.y[k] + (road.y[n] - road.y[k]) * f + road.ny[k] * offset * p;
        ctx.fillRect(x, y, Math.max(1, g.U * 3 * p), Math.max(0.6, g.U * 1.1 * p));
      }
    }
  }

  function paintClump(ctx, g, rand, cx, cy, rx, ry) {
    const u = g.U;
    ctx.fillStyle = INK;
    for (let i = 0; i < 46; i++) {
      const a = rand() * 6.283;
      const d = Math.sqrt(rand());
      const x = cx + Math.cos(a) * d * rx;
      const y = cy + Math.sin(a) * d * ry * (Math.sin(a) > 0 ? 0.6 : 1);
      ctx.beginPath();
      ctx.ellipse(x, y, u * (1.2 + rand() * 1.8), u * (0.8 + rand() * 0.9), 0, 0, 6.3);
      ctx.fill();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1, u * 0.35);
    for (let i = 0; i < 34; i++) {
      const a = rand() * 6.283;
      const x = cx + Math.cos(a) * rx * 1.06;
      const y = cy + Math.sin(a) * ry * (Math.sin(a) > 0 ? 0.7 : 1.1);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * u * 1.6, y + Math.sin(a) * u * 1.1 - u * 0.4);
      ctx.stroke();
    }
    for (let i = 0; i < rx * 2.4; i++) {
      ctx.fillStyle = rand() < 0.6 ? '#3a4a3e' : '#74604c';
      const x = cx + (rand() * 2 - 1) * rx * 0.86;
      ctx.fillRect(x, cy + ry * (0.3 + rand() * 0.3), Math.max(1, u * 0.7), Math.max(1, u * 0.45));
    }
  }

  function paintPine(ctx, g, rand, clumps, fromRight, rootX, topY) {
    const u = g.U;
    const place = (x) => (fromRight ? g.W - x * u : x * u);
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    for (const [x, y] of clumps) {
      ctx.lineWidth = Math.max(1, u * 0.9);
      ctx.beginPath();
      ctx.moveTo(place(rootX), y * u + u * 12);
      ctx.quadraticCurveTo(place(lerp(rootX, x, 0.5)), y * u + u * 5, place(x), y * u);
      ctx.stroke();
    }
    ctx.lineWidth = u * 2.8;
    ctx.beginPath();
    ctx.moveTo(place(rootX - 4), g.H);
    ctx.bezierCurveTo(place(rootX + 7), g.H * 0.8, place(rootX - 3), g.H * 0.5, place(rootX), topY * u);
    ctx.stroke();
    for (const [x, y, rx, ry] of clumps) paintClump(ctx, g, rand, place(x), y * u, rx * u, ry * u);
  }

  function railY(g, x) {
    return lerp(g.H * 0.885, g.H * 0.86, x / g.W);
  }

  function paintRailing(ctx, g) {
    const u = g.U;
    const foot = g.H * 0.965;
    ctx.fillStyle = '#343850';
    ctx.fillRect(0, foot, g.W, g.H - foot);
    ctx.fillStyle = '#3c3f55';
    ctx.fillRect(0, foot, g.W, Math.max(1, u * 0.9));
    for (let x = u * 7; x < g.W; x += u * 15) {
      ctx.fillStyle = '#3b3e52';
      ctx.fillRect(x, railY(g, x), Math.max(1, u * 1.2), foot - railY(g, x));
      ctx.fillStyle = '#74706f';
      ctx.fillRect(x, railY(g, x), Math.max(1, u * 0.4), foot - railY(g, x));
    }
    for (const [drop, tone, thick] of [[4.5, '#50505f', 0.6], [0, '#34374a', 1.5], [-0.6, '#8f8879', 0.6]]) {
      ctx.strokeStyle = tone;
      ctx.lineWidth = Math.max(1, u * thick);
      ctx.beginPath();
      ctx.moveTo(0, railY(g, 0) + drop * u);
      ctx.lineTo(g.W, railY(g, g.W) + drop * u);
      ctx.stroke();
    }
  }

  function paintBushes(ctx, g, rand) {
    ctx.fillStyle = '#171b29';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 1) {
      ctx.lineTo(x, g.H * 0.905 - fbm(x / (g.U * 7), 2, 3, 21) * g.U * 7);
    }
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    for (let i = 0; i < g.W * 0.8; i++) {
      const x = rand() * g.W;
      const top = g.H * 0.905 - fbm(x / (g.U * 7), 2, 3, 21) * g.U * 7;
      ctx.fillStyle = rand() < 0.65 ? '#2b3638' : '#54493f';
      ctx.fillRect(x, top + rand() * g.U * 3, Math.max(1, g.U * 0.6), Math.max(1, g.U * 0.4));
    }
  }

  function paintForeground(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintPine(ctx, g, rand, RIGHT_PINE, true, 6, 32);
    paintBushes(ctx, g, rand);
    paintPine(ctx, g, rand, LEFT_PINE, false, 7, 4);
    paintRailing(ctx, g);
    return c;
  }

  function drawTile(ctx, tile, t, rate, y, alpha) {
    const x = -((t * rate) % tile.width);
    ctx.globalAlpha = alpha;
    ctx.drawImage(tile, x, y);
    ctx.drawImage(tile, x + tile.width, y);
    ctx.globalAlpha = 1;
  }

  function drawTwinkle(ctx, t) {
    for (const w of state.twinkle) {
      ctx.fillStyle = TWINKLE_COLOURS[w.tone];
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * w.rate + w.phase);
      ctx.fillRect(w.x, w.y, w.w, w.h);
    }
    ctx.globalAlpha = 1;
  }

  function drawBeacons(ctx, g, t) {
    ctx.globalCompositeOperation = 'lighter';
    for (const b of state.beacons) {
      const r = g.U * 3.4 * b.size;
      const s = 0.5 + 0.5 * Math.sin(t * b.rate + b.phase);
      ctx.globalAlpha = s * s;
      ctx.drawImage(state.beaconGlow, b.x - r, b.y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#e4583c';
    for (const b of state.beacons) {
      const s = 0.5 + 0.5 * Math.sin(t * b.rate + b.phase);
      const r = Math.max(1, g.U * 0.8 * b.size);
      ctx.globalAlpha = 0.2 + 0.8 * s;
      ctx.fillRect(b.x - r / 2, b.y - r / 2, r, r);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.twinkle = [];
    state.beacons = [];
    state.sky = paintSky(g);
    state.cloudBack = bakeCloud(g, 31, 0.32);
    state.cloudFront = bakeCloud(g, 57, 0.24);
    state.cityGlow = paintGlow(48, '214,158,112', 0.15);
    state.beaconGlow = paintGlow(24, '214,69,44', 0.55);
    state.city = paintCity(g, rand);
    state.road = buildRoadTable(g);
    paintRoad(state.city.getContext('2d'), g, state.road);
    state.twinkle = state.twinkle.filter((w) => clearOfRoad(g, state.road, w));
    state.cars = makeCars(g, rand, state.road);
    state.foreground = paintForeground(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const clouds = api.props.clouds;
    ctx.drawImage(state.sky, 0, 0);
    drawTile(ctx, state.cloudBack, t, g.U * 0.5, g.H * 0.12, clouds);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(state.cityGlow, g.W * 0.36, g.H * 0.16, g.W * 0.6, g.H * 0.34);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(state.city, 0, 0);
    drawTwinkle(ctx, t);
    drawBeacons(ctx, g, t);
    drawTile(ctx, state.cloudFront, t, g.U * 0.9, g.H * 0.13, clouds * 0.34);
    drawCars(ctx, g, t, api.props.traffic);
    ctx.drawImage(state.foreground, 0, 0);
  }

  Kasuri.run({
    defaults: { traffic: 1, clouds: 0.9, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.2, tint: 0.6, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
