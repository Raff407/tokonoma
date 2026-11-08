/*
 * 夫婦岩 Meoto — two sea rocks tied with a straw rope, the sun coming up between them.
 *
 * Sky, sea and rocks are baked once in a rose and a gold version and crossfaded,
 * so the dawn costs two drawImage calls. What moves on top is a short list:
 * wave lines, gold dashes on the water, foam arcs, paper strips and a few gulls.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep, parseColor } = K;

  const HORIZON = 50;
  const WATERLINE = 66;
  const GAP = 23;
  // One dawn loop: the sun climbs for 40% of it, holds in full gold for 40%,
  // then settles back to rose over the last 20%.
  const DAWN_SECONDS = 300;
  const DAWN_RISE = 0.4;
  const DAWN_HOLD = 0.8;
  const MAX_WAVES = 2;
  const MAX_GULLS = 9;
  const ROCK_TONES = ['#45415c', '#5a4f68', '#71596a', '#8c6564', '#a87860', '#cc9866', '#f2c880'];
  const GOLDS = ['#fbe6a8', '#f6cf7c', '#ee9f5c'];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // A vertical wash in flat bands, like woodblock bokashi; keeps the colour count low.
  function paintBands(ctx, g, y0, y1, stops, count) {
    const rgb = stops.map(parseColor);
    const last = rgb.length - 1;
    for (let i = 0; i < count; i++) {
      const pos = (i / (count - 1)) * last;
      const at = Math.min(last - 1, Math.floor(pos));
      ctx.fillStyle = K.toHex(K.mixColor(rgb[at], rgb[at + 1], pos - at));
      const top = lerp(y0, y1, i / count);
      ctx.fillRect(0, Math.floor(top), g.W, Math.ceil((y1 - y0) / count) + 1);
    }
  }

  function paintSky(g, stops) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintBands(ctx, g, 0, g.hz + 1, stops, 16);
    return c;
  }

  // Long flat cloud bars, lit from below, baked small and tiled sideways.
  function paintClouds(g, seed, density) {
    const w = Math.ceil(g.W * 0.75);
    const h = Math.ceil(g.hz * 0.5);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const shade = parseColor('#a8799a');
    const lit = parseColor('#ffd9b0');
    const sx = 7 / w;
    const sy = 24 / h;
    const f = (x, y) => fbm(x * sx, y * sy, 3, seed);
    for (let y = 0; y < h; y++) {
      const band = smoothstep(0, h * 0.35, y) * (1 - 0.35 * smoothstep(h * 0.7, h, y));
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const below = lerp(f(x, y + 3), f(x - w, y + 3), x / w);
        const mass = Math.round(smoothstep(density, density + 0.17, v) * band * 4) / 4;
        if (mass <= 0) continue;
        const tone = below < v - 0.012 ? lit : shade;
        const i = (y * w + x) * 4;
        img.data[i] = tone[0];
        img.data[i + 1] = tone[1];
        img.data[i + 2] = tone[2];
        img.data[i + 3] = 215 * mass;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintGlow(radius, colour, strength) {
    const size = Math.ceil(radius * 2);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const [r, gr, b] = parseColor(colour);
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${r},${gr},${b},${strength})`);
    grad.addColorStop(0.35, `rgba(${r},${gr},${b},${strength * 0.4})`);
    grad.addColorStop(1, `rgba(${r},${gr},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  function paintSun(radius, inner, outer) {
    const size = Math.ceil(radius * 2 + 2);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, radius * 0.3, size / 2, size / 2, radius);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, outer);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, radius, 0, 6.3);
    ctx.fill();
    return c;
  }

  function paintCoast(ctx, g, x0, x1, tall, seed, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(x0, g.hz + 1);
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const edge = Math.sin(f * Math.PI);
      const y = g.hz - tall * edge * (0.45 + 0.9 * fbm(f * 5 + seed, seed, 3, 7));
      ctx.lineTo(lerp(x0, x1, f), y);
    }
    ctx.lineTo(x1, g.hz + 1);
    ctx.fill();
  }

  function paintSea(g, rand, stops, streaks) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintBands(ctx, g, g.hz, g.H, stops, 14);
    paintCoast(ctx, g, -g.U * 10, g.W * 0.3, g.U * 6, 3.1, stops[1]);
    paintCoast(ctx, g, g.W * 0.68, g.W + g.U * 10, g.U * 8, 8.4, stops[1]);
    const count = Math.round((g.W * (g.H - g.hz)) / 90);
    for (let i = 0; i < count; i++) {
      const z = Math.pow(rand(), 1.5);
      const y = g.hz + z * (g.H - g.hz);
      const w = g.U * (2 + z * 16) * (0.5 + rand());
      ctx.fillStyle = streaks[Math.floor(rand() * streaks.length)];
      ctx.globalAlpha = 0.14 + rand() * 0.2;
      ctx.fillRect(rand() * g.W - w / 2, y, w, Math.max(1, g.U * (0.2 + z * 0.5)));
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // Half-width of each rock by height, in U, from the waterline (f=0) to the top (f=1).
  function rockOutline(rock, seed) {
    const pts = [];
    const n = 34;
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      const width = rock.w * rock.shape(f);
      const j = (fbm(f * 6, seed, 3, 11) - 0.5) * rock.w * 0.5;
      pts.push({ x: rock.x - rock.bias * width + j, y: rock.base - f * rock.h });
    }
    for (let i = n; i >= 0; i--) {
      const f = i / n;
      const width = rock.w * rock.shape(f);
      const j = (fbm(f * 7, seed + 5, 3, 13) - 0.5) * rock.w * 0.45;
      pts.push({ x: rock.x + (2 - rock.bias) * width + j, y: rock.base - f * rock.h });
    }
    return pts;
  }

  function tracePath(ctx, pts) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  }

  // Slope-lit noise, quantised to a few flat tones, with the sun side warmer.
  function paintRockSkin(g, box, sunX, seed) {
    const w = Math.ceil(box.w);
    const h = Math.ceil(box.h);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const tones = ROCK_TONES.map(parseColor);
    const fx = 0.075 / g.U;
    const fy = 0.2 / g.U;
    const reach = g.U * 34;
    const strataRate = 1.5 / g.U;
    for (let y = 0; y < h; y++) {
      const wy = box.y + y;
      for (let x = 0; x < w; x++) {
        const wx = box.x + x;
        const a = fbm(wx * fx, wy * fy, 4, seed);
        const b = fbm((wx + g.U) * fx, wy * fy, 3, seed);
        const toSun = Math.sign(sunX - wx) || 1;
        const strata = Math.sin((wy + wx * 0.3) * strataRate + a * 16);
        const body = 0.3 + (b - a) * toSun * 6 + (a - 0.5) * 0.9 + strata * 0.11;
        const lit = Math.min(0.62, body);
        const warm = 0.6 * Math.pow(Math.max(0, 1 - Math.abs(sunX - wx) / reach), 1.6);
        const wet = 0.22 * smoothstep(g.water - g.U * 7, g.water - g.U, wy);
        const v = Math.max(0, Math.min(0.999, lit + warm - wet));
        const tone = tones[Math.floor(v * tones.length)];
        const i = (y * w + x) * 4;
        img.data[i] = tone[0];
        img.data[i + 1] = tone[1];
        img.data[i + 2] = tone[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintRock(ctx, g, rock, sunX, seed) {
    const pts = rockOutline(rock, seed);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const box = { x: Math.floor(Math.min(...xs)), y: Math.floor(Math.min(...ys)) };
    box.w = Math.max(...xs) - box.x + 2;
    box.h = Math.max(...ys) - box.y + 2;
    const skin = paintRockSkin(g, box, sunX, seed);
    const mask = skin.getContext('2d');
    mask.globalCompositeOperation = 'destination-in';
    mask.translate(-box.x, -box.y);
    tracePath(mask, pts);
    mask.fill();
    ctx.drawImage(skin, box.x, box.y);
    rock.pts = pts;
    paintRim(ctx, g, rock, sunX);
  }

  // A thin line of sunrise down the edge that faces the sun.
  function paintRim(ctx, g, rock, sunX) {
    const half = (rock.pts.length / 2) | 0;
    const edge = rock.x < sunX ? rock.pts.slice(half) : rock.pts.slice(0, half);
    ctx.save();
    tracePath(ctx, rock.pts);
    ctx.clip();
    ctx.strokeStyle = '#ffd690';
    ctx.lineWidth = g.U * 1.5;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    edge.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.restore();
  }

  function strandPath(ctx, a, b, sag) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + sag * 2, b.x, b.y);
  }

  function ropePoint(a, b, sag, f) {
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2 + sag * 2;
    const m = 1 - f;
    return { x: m * m * a.x + 2 * m * f * cx + f * f * b.x, y: m * m * a.y + 2 * m * f * cy + f * f * b.y };
  }

  // One thick twisted rope: dark under, straw on top, diagonal twist marks.
  function paintRope(ctx, g, a, b, sag, thick) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#4d3f33';
    ctx.lineWidth = thick * 1.3;
    strandPath(ctx, { x: a.x, y: a.y + thick * 0.14 }, { x: b.x, y: b.y + thick * 0.14 }, sag);
    ctx.stroke();
    ctx.strokeStyle = '#c9b27c';
    ctx.lineWidth = thick;
    strandPath(ctx, a, b, sag);
    ctx.stroke();
    const length = Math.hypot(b.x - a.x, b.y - a.y) + Math.abs(sag);
    const twists = Math.max(4, Math.round(length / (thick * 0.75)));
    ctx.strokeStyle = '#6c5840';
    ctx.lineWidth = Math.max(1, thick * 0.22);
    for (let i = 0; i <= twists; i++) {
      const p = ropePoint(a, b, sag, i / twists);
      ctx.beginPath();
      ctx.moveTo(p.x - thick * 0.32, p.y - thick * 0.48);
      ctx.lineTo(p.x + thick * 0.32, p.y + thick * 0.48);
      ctx.stroke();
    }
  }

  function paintWrap(ctx, g, rock, y, thick) {
    ctx.save();
    tracePath(ctx, rock.pts);
    ctx.clip();
    const left = rock.x - rock.w * 2;
    const right = rock.x + rock.w * 2;
    paintRope(ctx, g, { x: left, y: y - g.U * 3 }, { x: right, y: y - g.U * 3 }, g.U * 3.4, thick);
    ctx.restore();
  }

  function paintTassels(ctx, g, a, b, sag, rand) {
    const n = Math.round(Math.abs(b.x - a.x) / (g.U * 1.3));
    ctx.strokeStyle = '#d9c48c';
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    for (let i = 1; i < n; i++) {
      if (i % 5 > 2) continue;
      const p = ropePoint(a, b, sag, i / n);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + g.U);
      ctx.lineTo(p.x + (rand() - 0.5) * g.U * 0.4, p.y + g.U * (2.6 + rand() * 1.4));
      ctx.stroke();
    }
  }

  function paintTorii(ctx, g, x, y) {
    const u = g.U;
    ctx.fillStyle = '#b8402a';
    ctx.fillRect(x - u * 2.6, y - u * 5.4, u * 0.9, u * 5.6);
    ctx.fillRect(x + u * 1.7, y - u * 5.4, u * 0.9, u * 5.6);
    ctx.fillRect(x - u * 3.1, y - u * 4.3, u * 6.2, u * 0.7);
    ctx.fillStyle = '#d6452c';
    ctx.beginPath();
    ctx.moveTo(x - u * 4.2, y - u * 6.6);
    ctx.quadraticCurveTo(x, y - u * 5.8, x + u * 4.2, y - u * 6.6);
    ctx.lineTo(x + u * 3.7, y - u * 5.3);
    ctx.lineTo(x - u * 3.7, y - u * 5.3);
    ctx.fill();
  }

  function paintBaseFoam(ctx, g, rock, rand) {
    ctx.fillStyle = '#eee6d4';
    for (let i = 0; i < 46; i++) {
      const x = rock.x + rock.w * 0.2 + (rand() * 2 - 1) * rock.w * 1.45;
      ctx.globalAlpha = 0.4 + rand() * 0.55;
      ctx.beginPath();
      ctx.ellipse(x, rock.base + g.U * (rand() * 1.4 - 0.7), g.U * (0.8 + rand() * 2.6), g.U * (0.3 + rand() * 0.5), 0, 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function makeRocks(g) {
    const big = {
      x: g.sunX - g.U * (GAP + 16), base: g.water, w: g.U * 15, h: g.U * 56, bias: 1,
      shape: (f) => 0.28 + 0.92 * Math.pow(1 - f, 0.62) * (1 + 0.1 * Math.sin(f * 9)),
    };
    const small = {
      x: g.sunX + g.U * (GAP + 11), base: g.water - g.U, w: g.U * 11.5, h: g.U * 39, bias: 1,
      shape: (f) => 0.3 + 0.95 * Math.pow(1 - f, 0.55),
    };
    return { big, small };
  }

  function paintRocks(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const { big, small } = makeRocks(g);
    paintRock(ctx, g, big, g.sunX, 21);
    paintRock(ctx, g, small, g.sunX, 47);
    paintTorii(ctx, g, big.x + g.U, g.water - big.h + g.U * 0.8);
    const thick = g.U * 3;
    const a = { x: big.x + g.U * 9, y: g.U * 20 };
    const b = { x: small.x - g.U * 4, y: g.U * 30 };
    const sag = g.U * 2.2;
    paintWrap(ctx, g, big, g.U * 20, thick);
    paintWrap(ctx, g, big, g.U * 26, thick * 0.75);
    paintWrap(ctx, g, small, g.U * 30, thick);
    paintTassels(ctx, g, a, b, sag, rand);
    paintRope(ctx, g, a, b, sag, thick);
    paintBaseFoam(ctx, g, big, rand);
    paintBaseFoam(ctx, g, small, rand);
    return { canvas: c, big, small, a, b, sag };
  }

  // Wavering dark columns under each rock, drawn into both sea layers.
  function paintReflection(ctx, g, rock, rand) {
    const rows = g.U * 26;
    ctx.fillStyle = '#39345a';
    for (let y = 0; y < rows; y += Math.max(1, g.U * 0.55)) {
      const f = y / rows;
      const half = rock.w * rock.shape(Math.min(0.95, f * 1.1)) * 1.15;
      const jitter = (rand() - 0.5) * g.U * (0.8 + f * 5);
      ctx.globalAlpha = 0.6 * (1 - f) * (0.55 + rand() * 0.45);
      ctx.fillRect(rock.x + rock.w * 0.2 - half + jitter, rock.base + y, half * 2, Math.max(1, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
  }

  function paintShore(ctx, g, x0, x1, peak, seed, rand) {
    const pts = [{ x: x0, y: g.H + 1 }];
    for (let i = 0; i <= 30; i++) {
      const f = i / 30;
      const rise = Math.pow(Math.sin(f * Math.PI), 0.7) * (0.7 + 0.6 * fbm(f * 6, seed, 3, 5));
      pts.push({ x: lerp(x0, x1, f), y: g.H - rise * peak });
    }
    pts.push({ x: x1, y: g.H + 1 });
    const box = { x: Math.floor(x0), y: Math.floor(g.H - peak * 1.4), w: x1 - x0 + 2, h: peak * 1.4 + 2 };
    const skin = paintRockSkin(g, box, g.sunX, seed + 60);
    const mask = skin.getContext('2d');
    mask.globalCompositeOperation = 'destination-in';
    mask.translate(-box.x, -box.y);
    tracePath(mask, pts);
    mask.fill();
    ctx.drawImage(skin, box.x, box.y);
    ctx.fillStyle = '#efe8d8';
    for (let i = 1; i < pts.length - 1; i += 1) {
      if (rand() < 0.5) continue;
      ctx.globalAlpha = 0.25 + rand() * 0.5;
      ctx.fillRect(pts[i].x, pts[i].y + g.U * (2 + rand() * 7), g.U * (1 + rand() * 3), Math.max(1, g.U * 0.4));
    }
    ctx.globalAlpha = 1;
  }

  function paintForeground(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintShore(ctx, g, -g.U * 12, g.W * 0.2, g.U * 15, 2, rand);
    paintShore(ctx, g, g.W * 0.83, g.W + g.U * 10, g.U * 10, 9, rand);
    return c;
  }

  function makeDashes(g, rand) {
    const n = 320;
    const data = { n, x: new Float32Array(n), y: new Float32Array(n), w: new Float32Array(n) };
    data.h = new Float32Array(n);
    data.rate = new Float32Array(n);
    data.phase = new Float32Array(n);
    data.tone = new Uint8Array(n);
    const span = g.H - g.hz;
    for (let i = 0; i < n; i++) {
      const z = Math.pow(rand(), 1.35);
      const reach = g.U * (6 + z * 30);
      const off = (rand() + rand() - 1) * reach;
      data.x[i] = g.sunX + off;
      data.y[i] = g.hz + z * span;
      data.w[i] = g.U * (1.2 + z * 9) * (0.5 + rand() * 0.7);
      data.h[i] = Math.max(1, g.U * (0.3 + z * 0.75));
      data.rate[i] = 0.25 + rand() * 0.6;
      data.phase[i] = rand() * 6.28;
      data.tone[i] = Math.min(2, Math.floor((Math.abs(off) / reach) * 3.4));
    }
    return data;
  }

  // The pool holds enough crests for waves = 2; waves = 1 draws the first half.
  function makeCrests(g, rand) {
    const n = Math.round((g.W / g.U) * 0.48 * MAX_WAVES);
    const list = [];
    for (let i = 0; i < n; i++) {
      list.push({
        x: rand(),
        start: rand(),
        rate: 0.018 + rand() * 0.016,
        phase: rand() * 6.28,
        len: 0.7 + rand() * 0.7,
        life: 0,
        z: 0,
        y: 0,
      });
    }
    return list;
  }

  // Above 1 the waves slider widens and thickens every line (1 at waves = 1).
  function waveScale(amount) {
    return 0.6 + 0.4 * Math.max(1, amount);
  }

  function drawCrest(ctx, g, w, t, amount) {
    const scale = waveScale(amount);
    const half = g.U * (2 + w.z * 30) * w.len * scale;
    const cx = w.x * g.W + Math.sin(t * 0.07 + w.phase) * g.U * 2;
    const fade = Math.min(1, w.life * 4) * Math.min(1, (1 - w.life) * 9);
    ctx.globalAlpha = Math.min(1, amount) * fade * (0.5 + w.z * 0.5);
    ctx.lineWidth = Math.max(1, g.U * (0.3 + w.z * 0.9) * scale);
    ctx.beginPath();
    for (let k = 0; k <= 8; k++) {
      const f = k / 8;
      const x = cx + (f * 2 - 1) * half;
      const lift = Math.sin(f * Math.PI) * g.U * (0.2 + w.z * 1.4);
      const wob = Math.sin(f * 9 + w.phase + t * 0.5) * g.U * (0.1 + w.z * 0.5);
      if (k === 0) ctx.moveTo(x, w.y - lift + wob);
      else ctx.lineTo(x, w.y - lift + wob);
    }
    ctx.stroke();
  }

  // Positions are written into fields on each crest, so nothing is allocated per frame.
  function drawCrests(ctx, g, t, amount, front) {
    const list = state.crests;
    const count = Math.min(list.length, Math.round((list.length * amount) / MAX_WAVES));
    const depth = g.H - g.hz;
    ctx.strokeStyle = '#f2ece0';
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const w = list[i];
      w.life = (t * w.rate + w.start) % 1;
      w.z = w.life * w.life;
      w.y = g.hz + g.U * 2 + w.z * depth;
      if (w.y >= g.water === front) drawCrest(ctx, g, w, t, amount);
    }
    ctx.globalAlpha = 1;
  }

  function drawDashes(ctx, t) {
    const d = state.dashes;
    for (let tone = 0; tone < 3; tone++) {
      ctx.fillStyle = GOLDS[tone];
      for (let i = 0; i < d.n; i++) {
        if (d.tone[i] !== tone) continue;
        const s = Math.sin(t * d.rate[i] + d.phase[i]);
        ctx.globalAlpha = 0.55 + 0.45 * s * s;
        const w = d.w[i] * (0.65 + 0.35 * s);
        ctx.fillRect(d.x[i] - w / 2 + Math.cos(t * 0.2 + d.phase[i]) * d.w[i] * 0.15, d.y[i], w, d.h[i]);
      }
    }
    ctx.globalAlpha = 1;
  }

  function makeFoam(rock, rand) {
    const rings = [];
    for (let r = 0; r < 3; r++) {
      const arcs = [];
      for (let k = 0; k < 7; k++) {
        const start = 0.1 + (k / 7) * 2.9 + rand() * 0.15;
        arcs.push({ start, end: start + 0.2 + rand() * 0.22 });
      }
      rings.push({ phase: r / 3, arcs });
    }
    return { x: rock.x + rock.w * 0.2, y: rock.base, rx: rock.w * 1.55, rings };
  }

  // Waves above 1 thicken the arcs and lengthen them around the ring.
  function drawFoam(ctx, g, foam, t, amount) {
    if (amount <= 0) return;
    const scale = waveScale(amount);
    ctx.strokeStyle = '#f5efe2';
    ctx.lineWidth = Math.max(1, g.U * 0.45 * scale);
    for (const ring of foam.rings) {
      const life = (t * 0.055 + ring.phase) % 1;
      const rx = foam.rx + life * g.U * 15;
      ctx.globalAlpha = Math.min(1, amount) * Math.sin(life * Math.PI) * 0.75;
      for (const a of ring.arcs) {
        const mid = (a.start + a.end) / 2;
        const reach = ((a.end - a.start) / 2) * scale;
        ctx.beginPath();
        ctx.ellipse(foam.x, foam.y, rx, rx * 0.17, 0, mid - reach, mid + reach);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function makeStrips(g, rope, rand) {
    const n = 6;
    const list = [];
    for (let i = 0; i < n; i++) {
      const f = 0.14 + (0.72 * (i + 0.5)) / n + (rand() - 0.5) * 0.02;
      const p = ropePoint(rope.a, rope.b, rope.sag, f);
      list.push({ x: p.x, y: p.y + g.U, phase: rand() * 6.28, rate: 0.55 + rand() * 0.4, len: g.U * (6 + rand() * 1.5) });
    }
    return list;
  }

  // Zigzag paper, four folds, swinging from the top.
  function drawStrips(ctx, g, t) {
    ctx.strokeStyle = '#f8f3e4';
    ctx.lineWidth = Math.max(1, g.U * 1.5);
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    for (const s of state.strips) {
      const sway = Math.sin(t * s.rate + s.phase) * g.U * 0.9 + Math.sin(t * 0.17 + s.phase) * g.U * 0.5;
      const step = s.len / 4;
      const zig = g.U * 1.05;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + zig + sway * 0.2, s.y + step);
      ctx.lineTo(s.x - zig + sway * 0.45, s.y + step * 1.6);
      ctx.lineTo(s.x + zig + sway * 0.7, s.y + step * 2.7);
      ctx.lineTo(s.x - zig * 0.4 + sway, s.y + step * 4);
      ctx.stroke();
    }
    ctx.lineJoin = 'round';
  }

  function makeGulls(g, rand) {
    const list = [];
    for (let i = 0; i < MAX_GULLS; i++) {
      const near = rand();
      list.push({
        start: (i * 0.618) % 1,
        y: g.U * (7 + rand() * 26),
        span: g.U * (3.4 + near * 4.2),
        speed: g.U * (2.4 + near * 2.6),
        dir: i % 3 === 0 ? -1 : 1,
        flap: 2.2 + rand() * 1.1,
        phase: rand() * 6.28,
      });
    }
    return list;
  }

  function drawGull(ctx, g, b, t) {
    const loop = g.W + b.span * 8;
    const run = (b.start * loop + t * b.speed) % loop;
    const x = (b.dir > 0 ? run : loop - run) - b.span * 4;
    const y = b.y + Math.sin(t * 0.25 + b.phase) * g.U * 1.6;
    const glide = 0.5 + 0.5 * Math.sin(t * 0.3 + b.phase);
    const beat = Math.sin(t * b.flap + b.phase) * (0.25 + 0.75 * glide);
    const s = b.span;
    const tipY = y - s * (0.1 + beat * 0.45);
    const elbowY = y - s * (0.32 + beat * 0.14);
    ctx.beginPath();
    ctx.moveTo(x - s, tipY);
    ctx.quadraticCurveTo(x - s * 0.5, elbowY, x - s * 0.06, y - s * 0.03);
    ctx.quadraticCurveTo(x + s * 0.5, elbowY, x + s, tipY);
    ctx.quadraticCurveTo(x + s * 0.5, elbowY + s * 0.26, x + s * 0.08, y + s * 0.13);
    ctx.lineTo(x + b.dir * s * 0.42, y + s * 0.03);
    ctx.lineTo(x - s * 0.08, y + s * 0.13);
    ctx.quadraticCurveTo(x - s * 0.5, elbowY + s * 0.26, x - s, tipY);
    ctx.fill();
  }

  function bakeLayers(g, rand) {
    state.skyRose = paintSky(g, ['#8a6aa0', '#d07f9e', '#f6a096', '#ffcaa4']);
    state.skyGold = paintSky(g, ['#9a84a4', '#e6a884', '#fcd088', '#ffeab8']);
    state.cloudA = paintClouds(g, 31, 0.5);
    state.cloudB = paintClouds(g, 58, 0.54);
    state.glow = paintGlow(g.U * 42, '#f6b878', 0.45);
    state.sunLow = paintSun(g.U * 8.5, '#ffd88e', '#f8a45e');
    state.sunHigh = paintSun(g.U * 8.5, '#ffeeb8', '#ffc86e');
    const rocks = paintRocks(g, rand);
    state.rocks = rocks.canvas;
    const seaRose = ['#f4b8a4', '#d48e96', '#9a7a9c', '#5f6698', '#465088'];
    const seaGold = ['#ffe29a', '#e6ae84', '#a68c8c', '#646c98', '#465490'];
    const streaks = ['#3c4478', '#ffd8b0', '#8a80a8'];
    state.seaRose = paintSea(g, K.rng(77), seaRose, streaks);
    state.seaGold = paintSea(g, K.rng(77), seaGold, streaks);
    for (const sea of [state.seaRose, state.seaGold]) {
      const r = K.rng(101);
      const ctx = sea.getContext('2d');
      paintReflection(ctx, g, rocks.big, r);
      paintReflection(ctx, g, rocks.small, r);
    }
    state.foreground = paintForeground(g, rand);
    state.foam = [makeFoam(rocks.big, rand), makeFoam(rocks.small, rand)];
    state.strips = makeStrips(g, rocks, rand);
  }

  function setup(ctx, api) {
    const U = api.rows / 100;
    const g = { W: api.cols, H: api.rows, U, hz: U * HORIZON, water: U * WATERLINE, sunX: api.cols * 0.5 };
    const rand = K.rng(api.seed);
    state.g = g;
    bakeLayers(g, rand);
    state.dashes = makeDashes(g, rand);
    state.crests = makeCrests(g, rand);
    state.gulls = makeGulls(g, rand);
  }

  function drawCloud(ctx, g, cloud, t, speed, alpha) {
    const w = g.W * 1.5;
    const x = -((t * speed * g.U) % w);
    ctx.globalAlpha = alpha;
    ctx.drawImage(cloud, x, 0, w, g.hz);
    ctx.drawImage(cloud, x + w, 0, w, g.hz);
    ctx.globalAlpha = 1;
  }

  function drawSky(ctx, g, t, dawn) {
    ctx.drawImage(state.skyRose, 0, 0);
    ctx.globalAlpha = dawn;
    ctx.drawImage(state.skyGold, 0, 0);
    ctx.globalAlpha = 1;
    drawCloud(ctx, g, state.cloudA, t, 0.28, 0.85);
    drawCloud(ctx, g, state.cloudB, t, 0.5, 0.6);
    const sunY = g.hz - g.U * lerp(1, 8, dawn);
    const glow = state.glow;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (0.72 + 0.16 * Math.sin(t * 0.13)) * (1 - dawn * 0.55);
    ctx.drawImage(glow, g.sunX - glow.width / 2, sunY - glow.height / 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(state.sunLow, g.sunX - state.sunLow.width / 2, sunY - state.sunLow.height / 2);
    ctx.globalAlpha = smoothstep(0.5, 1, dawn);
    ctx.drawImage(state.sunHigh, g.sunX - state.sunHigh.width / 2, sunY - state.sunHigh.height / 2);
    ctx.globalAlpha = 1;
  }

  // 0 is rose with the sun on the horizon, 1 is full gold; eased at both ends.
  function dawnAt(t) {
    const p = (((t + 60) / DAWN_SECONDS) % 1 + 1) % 1;
    if (p < DAWN_RISE) return smoothstep(0, DAWN_RISE, p);
    if (p < DAWN_HOLD) return 1;
    return 1 - smoothstep(DAWN_HOLD, 1, p);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    const dawn = dawnAt(t);
    drawSky(ctx, g, t, dawn);
    ctx.drawImage(state.seaRose, 0, 0);
    ctx.globalAlpha = dawn;
    ctx.drawImage(state.seaGold, 0, 0);
    ctx.globalAlpha = 1;
    drawCrests(ctx, g, t, props.waves, false);
    ctx.drawImage(state.rocks, 0, 0);
    drawStrips(ctx, g, t);
    for (const foam of state.foam) drawFoam(ctx, g, foam, t, props.waves);
    drawCrests(ctx, g, t, props.waves, true);
    drawDashes(ctx, t);
    ctx.drawImage(state.foreground, 0, 0);
    ctx.fillStyle = '#463a4e';
    const count = Math.min(MAX_GULLS, Math.round(props.gulls));
    for (let i = 0; i < count; i++) drawGull(ctx, g, state.gulls[i], t);
  }

  Kasuri.run({
    defaults: { waves: 1, gulls: 5, ramp: 'lines', cell: 7, boost: 0.14, gain: 1.05, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
