/*
 * 枯山水 Karesansui — a raked gravel garden seen from the veranda.
 *
 * Sky, trees, the earthen wall, the raked gravel with its moss islands and
 * rocks, and the veranda edge are baked into two layers and repainted once a
 * minute from the clock. Between repaints only a cloud strip, a tiling sheet
 * of cloud shadow and a handful of leaves move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep, clamp } = K;

  const TAU = Math.PI * 2;
  const SKY_END = 0.25;
  const ROOF_TOP = 0.215;
  const WALL = [0.235, 0.335];
  const GRAVEL = [0.335, 0.93];
  const RINGS = 3.2;
  const RETINT_SECONDS = 60;
  const LEAF_COUNT = 7;
  const LEAF_TONES = ['#b8452c', '#c86a34', '#a83a28', '#c99a44'];
  // Moss islands: x across, v down the gravel (0 far, 1 near), r radius as a share of width.
  const ISLANDS = [
    { x: 0.23, v: 0.26, r: 0.085, rocks: [{ dx: -0.015, w: 0.07, h: 0.24 }, { dx: 0.045, w: 0.045, h: 0.1 }] },
    { x: 0.6, v: 0.13, r: 0.055, rocks: [{ dx: 0, w: 0.05, h: 0.13 }] },
    { x: 0.8, v: 0.5, r: 0.09, rocks: [{ dx: -0.022, w: 0.075, h: 0.19 }, { dx: 0.05, w: 0.04, h: 0.08 }] },
    { x: 0.44, v: 0.66, r: 0.05, rocks: [{ dx: 0.005, w: 0.07, h: 0.06 }] },
  ];
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Perspective scale at depth v: things shrink toward the wall.
  const depth = (v) => 0.55 + 0.75 * v;

  function islandShape(g, isl) {
    const s = depth(isl.v);
    const cx = g.W * isl.x;
    const cy = lerp(g.H * GRAVEL[0], g.H * GRAVEL[1], isl.v);
    const rx = g.W * isl.r * s;
    return { cx, cy, rx, ry: rx * 0.42, s };
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H * SKY_END);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, c.height);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, c.width, c.height);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.4; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * c.height * 0.8, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const a = fbm(x * 0.016, y * 0.08, 4, 41);
        const b = fbm((x - w) * 0.016, y * 0.08, 4, 41);
        const v = lerp(a, b, x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 244;
        img.data[i + 3] = smoothstep(0.5, 0.7, v) * band * 220;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Soft dark patches that tile sideways, laid over the garden.
  function paintShadows(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const sy = 0.35 + 0.65 * (y / h);
      for (let x = 0; x < w; x++) {
        const a = fbm(x * 0.012 / sy, y * 0.03, 3, 77);
        const b = fbm((x - w) * 0.012 / sy, y * 0.03, 3, 77);
        const v = lerp(a, b, x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 30;
        img.data[i + 1] = 36;
        img.data[i + 2] = 58;
        img.data[i + 3] = smoothstep(0.46, 0.66, v) * 130;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- trees and wall ----------------------------------------------------

  function paintTrees(ctx, g, sky, rand) {
    const dim = sky.night * 0.75;
    const tones = ['#2e4230', '#3e5638', '#53693f'].map((t) => hex(mixColor(mixColor(rgb(t), sky.haze, 0.15), rgb('#121824'), dim)));
    // A dark band of pines and one autumn maple to the right.
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = tones[k];
      for (let i = 0; i < 70; i++) {
        const x = rand() * g.W;
        const y = g.H * (0.13 + rand() * 0.1) + k * g.U * 0.8;
        ctx.beginPath();
        ctx.ellipse(x, y, g.U * (2 + rand() * 3), g.U * (1.2 + rand() * 1.5), 0, 0, TAU);
        ctx.fill();
      }
    }
    const maple = ['#8a3022', '#b4442b', '#c8603a'].map((t) => hex(mixColor(rgb(t), rgb('#1c1a26'), dim)));
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = maple[k];
      for (let i = 0; i < 26; i++) {
        const a = rand() * TAU;
        const r = rand() * g.W * 0.07;
        ctx.beginPath();
        ctx.arc(g.W * 0.86 + Math.cos(a) * r, g.H * (0.15 + k * 0.012) + Math.sin(a) * r * 0.4, g.U * (1.5 + rand() * 2), 0, TAU);
        ctx.fill();
      }
    }
  }

  function paintWall(ctx, g, sky, rand) {
    const dim = sky.night * 0.7;
    const night = rgb('#1c2034');
    const lit = (t, k = 0.25) => hex(mixColor(mixColor(rgb(t), sky.amb, k), night, dim));
    const top = g.H * WALL[0];
    const bot = g.H * WALL[1];
    ctx.fillStyle = lit('#c9a978');
    ctx.fillRect(0, top, g.W, bot - top);
    // Earthen layers pressed into the wall.
    ctx.fillStyle = lit('#b49264');
    for (let k = 1; k < 5; k++) ctx.fillRect(0, lerp(top, bot, k / 5), g.W, 1);
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < g.W * 0.6; i++) ctx.fillRect(rand() * g.W, lerp(top, bot, rand()), 1 + rand() * 2, 1);
    ctx.globalAlpha = 1;
    // Tiled coping on top.
    ctx.fillStyle = lit('#4a4c54', 0.1);
    ctx.fillRect(0, g.H * ROOF_TOP, g.W, top - g.H * ROOF_TOP);
    ctx.fillStyle = lit('#2c2e36', 0.05);
    for (let x = 0; x < g.W; x += Math.max(2, g.U * 1.4)) ctx.fillRect(x, g.H * ROOF_TOP, 1, top - g.H * ROOF_TOP);
    ctx.fillRect(0, top - 1, g.W, Math.max(1, g.U * 0.5));
    ctx.fillStyle = lit('#6a6c74', 0.2);
    ctx.fillRect(0, g.H * ROOF_TOP, g.W, 1);
    // Stone footing where the wall meets the gravel.
    ctx.fillStyle = lit('#7a766c');
    ctx.fillRect(0, bot - g.U * 1.2, g.W, g.U * 1.2);
  }

  // ---- gravel, moss, rocks -------------------------------------------------

  function gravelTones(sky) {
    const night = rgb('#4a5478');
    const light = mixColor(mixColor(rgb('#e2ddd0'), sky.amb, 0.3), night, sky.night * 0.6);
    const groove = mixColor(mixColor(rgb('#99948a'), sky.amb, 0.2), night, sky.night * 0.75);
    const moss = mixColor(mixColor(rgb('#5a7a3e'), sky.amb, 0.15), rgb('#18241e'), sky.night * 0.7);
    const mossDark = mixColor(rgb('#38542e'), rgb('#101a16'), sky.night * 0.7);
    return { light, groove, moss, mossDark };
  }

  function pixelAt(g, tones, shapes, x, y, rowPhase, period) {
    let phase = rowPhase + Math.sin(x * 0.03) * 0.08;
    for (const sh of shapes) {
      const dx = (x - sh.cx) / sh.rx;
      const dy = (y - sh.cy) / sh.ry;
      const e = Math.sqrt(dx * dx + dy * dy);
      if (e < 1) {
        const n = fbm(x * 0.3, y * 0.5, 3, 13);
        const edge = smoothstep(0.75, 1, e);
        return mixColor(mixColor(tones.moss, tones.mossDark, edge * 0.7 + (n - 0.5) * 0.8), tones.light, n > 0.7 ? 0.15 : 0);
      }
      const dist = (e - 1) * sh.ry;
      if (dist < RINGS * period) {
        phase = dist / period - 0.5;
        break;
      }
    }
    const s = 0.5 + 0.5 * Math.cos(TAU * phase);
    const grain = (fbm(x * 0.9, y * 0.9, 2, 3) - 0.5) * 0.25;
    return mixColor(tones.light, tones.groove, clamp(s * s * 0.85 + grain, 0, 1));
  }

  function paintGravel(ctx, g, sky) {
    const tones = gravelTones(sky);
    const shapes = state.shapes;
    const y0 = Math.floor(g.H * GRAVEL[0]);
    const y1 = Math.ceil(g.H * GRAVEL[1]);
    const img = ctx.createImageData(g.W, y1 - y0);
    let rowPhase = 0;
    for (let y = y0; y < y1; y++) {
      const v = (y - y0) / (y1 - y0);
      const period = 2.4 + 3.2 * v;
      rowPhase += 1 / period;
      for (let x = 0; x < g.W; x++) {
        const c = pixelAt(g, tones, shapes, x, y, rowPhase, period);
        const i = ((y - y0) * g.W + x) * 4;
        img.data[i] = c[0];
        img.data[i + 1] = c[1];
        img.data[i + 2] = c[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, y0);
  }

  function rockPoints(cx, base, w, h, rand) {
    const pts = [];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI;
      const j = 0.82 + rand() * 0.3;
      pts.push(cx + Math.cos(a) * w * 0.5 * j, base + Math.sin(a) * h * j);
    }
    return pts;
  }

  function fillPoly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function paintRock(ctx, g, sky, sh, rock, rand) {
    const dim = sky.night * 0.7;
    const night = rgb('#161a28');
    const tone = (t, k) => hex(mixColor(mixColor(rgb(t), sky.amb, k), night, dim));
    const w = g.W * rock.w * sh.s;
    const h = g.H * rock.h * sh.s;
    const cx = sh.cx + g.W * rock.dx * sh.s;
    const base = sh.cy + sh.ry * 0.15;
    ctx.fillStyle = tone('#2a2a2c', 0);
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(cx + w * 0.25, base, w * 0.6, Math.max(1, h * 0.12), 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    const pts = rockPoints(cx, base, w, h, rand);
    ctx.fillStyle = tone('#4e4b47', 0.1);
    fillPoly(ctx, pts);
    // Lit face to the upper left.
    const lit = pts.map((p, i) => (i % 2 === 0 ? lerp(cx - w * 0.12, p, 0.78) : lerp(base - h * 0.15, p, 0.8)));
    ctx.fillStyle = tone('#8a857a', 0.3);
    fillPoly(ctx, lit.slice(0, 12).concat([cx - w * 0.05, base - h * 0.2]));
    ctx.fillStyle = tone('#2e2c2a', 0);
    for (let k = 0; k < 2; k++) {
      const fx = cx + (rand() - 0.5) * w * 0.4;
      ctx.fillRect(fx, base - h * (0.2 + rand() * 0.5), 1, h * 0.3);
    }
  }

  function paintVeranda(ctx, g, sky) {
    const dim = sky.night * 0.65;
    const night = rgb('#141418');
    const top = g.H * GRAVEL[1];
    ctx.fillStyle = hex(mixColor(rgb('#5a3e2a'), night, dim));
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = hex(mixColor(rgb('#7a5638'), night, dim));
    ctx.fillRect(0, top, g.W, Math.max(1, g.U * 0.8));
    ctx.fillStyle = hex(mixColor(rgb('#3e2a1e'), night, dim));
    for (let x = g.W * 0.11; x < g.W; x += g.W * 0.19) ctx.fillRect(x, top, 1, g.H - top);
    // A stone step-off line of pebbles along the edge.
    ctx.fillStyle = hex(mixColor(rgb('#6e6a62'), night, dim));
    ctx.fillRect(0, top - g.U * 0.9, g.W, g.U * 0.9);
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintTrees(ctx, g, sky, rand);
    paintWall(ctx, g, sky, rand);
    paintGravel(ctx, g, sky);
    const rockRand = K.rng(5);
    for (let i = 0; i < ISLANDS.length; i++) {
      for (const rock of ISLANDS[i].rocks) paintRock(ctx, g, sky, state.shapes[i], rock, rockRand);
    }
    paintVeranda(ctx, g, sky);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(23);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.cloudAlpha = 0.8 - sky.night * 0.55;
    state.shadowAlpha = 1 - sky.night * 0.45;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 1.2) % c.width);
    ctx.globalAlpha = state.cloudAlpha;
    ctx.drawImage(c, off, g.H * 0.01);
    ctx.drawImage(c, off + c.width, g.H * 0.01);
    ctx.globalAlpha = 1;
  }

  function drawShadows(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.shadow;
    const off = -((t * g.U * 2.2) % c.width);
    const y = g.H * ROOF_TOP;
    ctx.globalAlpha = Math.min(1, state.shadowAlpha * amount * 0.8);
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    ctx.globalAlpha = 1;
  }

  // A few maple leaves drift down from the tree at the right.
  function drawLeaves(ctx, g, t) {
    const s = Math.max(1, g.U * 0.7);
    for (let i = 0; i < LEAF_COUNT; i++) {
      const life = 14 + (i % 3) * 3;
      const p = ((t + i * 5.3) % life) / life;
      const x = g.W * (0.78 + (i * 0.037) % 0.16) - p * g.W * 0.32 + Math.sin(t * 1.3 + i) * g.U * 2;
      const y = g.H * (0.13 + p * 0.7);
      ctx.fillStyle = LEAF_TONES[i % LEAF_TONES.length];
      ctx.globalAlpha = smoothstep(0, 0.06, p) * (1 - smoothstep(0.9, 1, p)) * state.shadowAlpha;
      const flip = Math.abs(Math.sin(t * 2 + i * 1.7));
      ctx.fillRect(x, y, s * (0.5 + flip), s);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.shapes = ISLANDS.map((isl) => islandShape(g, isl));
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.16));
    state.shadow = paintShadows(Math.ceil(g.W * 1.5), Math.ceil(g.H * (GRAVEL[1] - ROOF_TOP)));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawShadows(ctx, g, t, props.shadows);
    if (props.leaves) drawLeaves(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', shadows: 1, leaves: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
