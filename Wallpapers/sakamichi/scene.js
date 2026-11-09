/*
 * 坂道 Sakamichi — a steep street of a seaside town running down to the sea.
 *
 * Sky, sea, street and houses are baked into two layers from the clock and
 * repainted once a minute. Between repaints only clouds, a few soft glints on
 * the water and the small train at the bottom of the hill move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.28;
  const EYE = 0.8;
  const SLOPE = 0.3;
  const DEPTH = 1.0;
  const SPREAD = 1.2;
  const ROAD = 0.13;
  const WALK = 0.035;
  const TRACK_Z = 4.5;
  const ROW_END = 3.9;
  const TRAIN_LEN = 3.4;
  const TRAIN_TALL = 0.62;
  const TRAIN_CYCLE = 24;
  const TRAIN_RUN = 14;
  const RETINT_SECONDS = 60;
  const GLINTS = 40;
  const WALLS = ['#e4dccb', '#d8cfbc', '#cfc6b2', '#b9b4a6', '#d9c9a8'];
  const ROOFS = ['#4a5468', '#3c4558', '#5a5650', '#6a4a3e', '#2f4f6a'];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  // Base ink lit by the sky: multiplied by its ambient tint.
  function lit(sky, h, k = 1) {
    const c = rgb(h);
    const a = sky.amb;
    return hex([c[0] * a[0] / 255 * k, c[1] * a[1] / 255 * k, c[2] * a[2] / 255 * k].map((v) => Math.min(255, v)));
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  // World to screen: X sideways, Y true height (the street falls away), z distance.
  function px(g, X, z) {
    return g.W * 0.5 + (X * g.H * SPREAD) / z;
  }

  function wy(g, Y, z) {
    return g.H * HORIZON + ((EYE - Y) * g.H * DEPTH) / z;
  }

  function street(z) {
    return -SLOPE * (z - 1);
  }

  // Height above the street at that distance.
  function py(g, Y, z) {
    return wy(g, street(z) + Y, z);
  }

  // ---- sky and sea -------------------------------------------------------

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.012, y * 0.08, 4, 37);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 244;
        img.data[i + 3] = smoothstep(0.5, 0.7, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function sunPlace(g, sky) {
    const night = sky.night > 0.5;
    const t = night ? S.moonT(sky.hour) : S.sunT(sky.hour);
    return {
      x: g.W * lerp(0.12, 0.88, t),
      y: g.H * HORIZON - Math.sin(Math.PI * t) * g.H * 0.26 + g.U * 2,
      night,
    };
  }

  function paintBack(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const hz = g.H * HORIZON;
    const grad = ctx.createLinearGradient(0, 0, 0, hz);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, hz + 1);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * hz * 0.85, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    const sun = sunPlace(g, sky);
    ctx.fillStyle = sun.night ? '#e8e2cc' : hex(mixColor(rgb('#f2e2b0'), sky.low, 0.25));
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, g.U * (sun.night ? 2.2 : 3), 0, 6.3);
    ctx.fill();
    paintSea(ctx, g, sky, rand, hz);
    paintIsland(ctx, g, sky, hz);
    paintCoast(ctx, g, sky);
    return c;
  }

  function paintSea(ctx, g, sky, rand, hz) {
    const bottom = py(g, 0, TRACK_Z);
    const deep = mixColor(rgb('#2f4c74'), sky.top, 0.35);
    const far = mixColor(rgb('#5d7896'), sky.haze, 0.5);
    const grad = ctx.createLinearGradient(0, hz, 0, bottom);
    grad.addColorStop(0, hex(far));
    grad.addColorStop(1, hex(mixColor(deep, rgb('#1c2a40'), sky.night * 0.3)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, hz, g.W, bottom - hz);
    const sheen = mixColor(sky.low, rgb('#e8e4d8'), 0.3);
    ctx.fillStyle = hex(sheen);
    for (let i = 0; i < g.W * 0.5; i++) {
      const f = rand();
      const y = hz + f * f * (bottom - hz);
      ctx.globalAlpha = 0.12 + rand() * 0.18;
      ctx.fillRect(rand() * g.W, y, g.U * (1 + rand() * 4) * (0.4 + f), 1);
    }
    ctx.globalAlpha = 1;
  }

  // A small wooded island on the horizon.
  function paintIsland(ctx, g, sky, hz) {
    const cx = g.W * 0.8;
    const half = g.H * 0.16;
    ctx.fillStyle = hex(mixColor(rgb('#3f5a4c'), sky.haze, 0.55));
    ctx.beginPath();
    ctx.moveTo(cx - half, hz + 1);
    for (let i = 0; i <= 40; i++) {
      const f = i / 40;
      const x = cx - half + f * half * 2;
      const hill = Math.pow(Math.sin(f * Math.PI), 0.7) * g.H * 0.045;
      ctx.lineTo(x, hz - hill - (fbm(x * 0.15, 3, 2, 9) - 0.5) * g.U);
    }
    ctx.lineTo(cx + half, hz + 1);
    ctx.fill();
  }

  // The sea wall and the rails along the coast.
  function paintCoast(ctx, g, sky) {
    const ty = py(g, 0, TRACK_Z);
    ctx.fillStyle = lit(sky, '#a8a49a');
    ctx.fillRect(0, py(g, 0.12, TRACK_Z + 0.6), g.W, ty - py(g, 0.12, TRACK_Z + 0.6));
    ctx.fillStyle = lit(sky, '#6a645c');
    ctx.fillRect(0, ty - g.U * 1.2, g.W, g.U * 1.2);
    ctx.fillStyle = lit(sky, '#3a3632');
    ctx.fillRect(0, ty - g.U * 0.5, g.W, Math.max(1, g.U * 0.3));
    ctx.fillRect(0, ty - g.U * 1.1, g.W, Math.max(1, g.U * 0.3));
  }

  // ---- street and houses -------------------------------------------------

  function paintGround(ctx, g, sky, rand) {
    const ty = py(g, 0, TRACK_Z);
    ctx.fillStyle = lit(sky, '#3e5a3c');
    ctx.fillRect(0, ty, g.W, g.H - ty);
    paintTown(ctx, g, sky, rand);
    for (let i = 0; i < 40; i++) {
      const z = lerp(1.1, TRACK_Z, rand());
      const side = rand() < 0.5 ? -1 : 1;
      const X = side * (ROAD + WALK + 0.1 + rand() * 1.6);
      const r = (g.H * 0.12) / z;
      ctx.fillStyle = lit(sky, rand() < 0.5 ? '#4f6e44' : '#33502f');
      ctx.beginPath();
      ctx.ellipse(px(g, X, z), py(g, 0.15, z), r, r * 0.7, 0, 0, 6.3);
      ctx.fill();
    }
    const n = TRACK_Z - 0.02;
    ctx.fillStyle = lit(sky, '#8e8a80');
    poly(ctx, [px(g, -ROAD - WALK, 1), g.H, px(g, ROAD + WALK, 1), g.H, px(g, ROAD + WALK, n), py(g, 0, n), px(g, -ROAD - WALK, n), py(g, 0, n)]);
    ctx.fillStyle = lit(sky, '#4e5058');
    poly(ctx, [px(g, -ROAD, 1), g.H, px(g, ROAD, 1), g.H, px(g, ROAD, n), py(g, 0, n), px(g, -ROAD, n), py(g, 0, n)]);
    ctx.fillStyle = lit(sky, '#6a6c74');
    for (let z = 1; z < n - 0.1; z += 0.07 * z) {
      const y = py(g, 0, z);
      ctx.fillRect(px(g, -ROAD, z), y, px(g, ROAD, z) - px(g, -ROAD, z), Math.max(1, (g.H * 0.012) / z));
    }
    paintNearWalls(ctx, g, sky, rand);
    paintPostbox(ctx, g, sky);
    ctx.fillStyle = lit(sky, '#d8d2c2');
    for (const s of [-1, 1]) {
      const e = s * (ROAD - 0.015);
      poly(ctx, [px(g, e, 1), g.H, px(g, e + s * 0.012, 1), g.H, px(g, e + s * 0.012, n), py(g, 0, n), px(g, e, n), py(g, 0, n)]);
    }
  }

  // Rooftops of the town behind the street, stepping down toward the coast.
  function paintTown(ctx, g, sky, rand) {
    for (let z = TRACK_Z - 0.2; z > 1.2; z -= 0.12 + rand() * 0.1) {
      for (const s of [-1, 1]) {
        let X = ROAD + WALK + 0.3 + rand() * 0.2;
        while (px(g, s * X, z) > -g.W * 0.05 && px(g, s * X, z) < g.W * 1.05) {
          const wide = 0.25 + rand() * 0.3;
          const F = street(z) + (X - 0.4) * 0.06;
          const T = F + 0.14 + rand() * 0.12;
          const a = px(g, s * X, z);
          const b = px(g, s * (X + wide), z);
          const l = Math.min(a, b);
          const w = Math.abs(b - a);
          ctx.fillStyle = lit(sky, WALLS[Math.floor(rand() * WALLS.length)], 0.8);
          ctx.fillRect(l, wy(g, T, z), w, wy(g, F, z) - wy(g, T, z) + 1);
          ctx.fillStyle = lit(sky, ROOFS[Math.floor(rand() * ROOFS.length)], 0.9);
          const top = wy(g, T + 0.07, z);
          const eave = wy(g, T, z);
          poly(ctx, [l - w * 0.06, eave, l + w * 1.06, eave, l + w * 0.85, top, l + w * 0.15, top]);
          if (rand() < 0.3) {
            ctx.fillStyle = lit(sky, rand() < 0.5 ? '#4f6e44' : '#33502f');
            const r = (g.H * 0.08) / z;
            ctx.beginPath();
            ctx.ellipse(l + w + r * 0.5, wy(g, F + 0.06, z), r, r * 0.8, 0, 0, 6.3);
            ctx.fill();
          }
          X += wide + 0.04 + rand() * 0.1;
        }
      }
    }
  }

  // A small vermilion postbox on the left pavement.
  function paintPostbox(ctx, g, sky) {
    const z = 1.22;
    const X = -(ROAD + WALK * 0.5);
    const w = (g.H * 0.05) / z;
    const top = py(g, 0.2, z);
    ctx.fillStyle = lit(sky, '#b8412c');
    ctx.fillRect(px(g, X, z) - w / 2, top, w, py(g, 0.04, z) - top);
    ctx.fillStyle = lit(sky, '#2a2a30');
    ctx.fillRect(px(g, X, z) - w * 0.15, py(g, 0.04, z), w * 0.3, py(g, 0, z) - py(g, 0.04, z));
  }

  // Low stone walls and garden shrubs on the near stretch, before the houses begin.
  function paintNearWalls(ctx, g, sky, rand) {
    const z0 = 0.5;
    const z1 = 1.3;
    for (const s of [-1, 1]) {
      const e = s * (ROAD + WALK + 0.01);
      const o = e + s * 1.2;
      for (let k = 0; k < 26; k++) {
        const z = lerp(0.55, z1, rand());
        const r = (g.H * (0.07 + rand() * 0.05)) / z;
        ctx.fillStyle = lit(sky, rand() < 0.5 ? '#4f6e44' : '#3a5a36');
        ctx.beginPath();
        ctx.ellipse(px(g, e + s * (0.1 + rand() * 0.9), z), py(g, 0.14, z), r, r * 0.75, 0, 0, 6.3);
        ctx.fill();
      }
      const top = 0.1;
      ctx.fillStyle = lit(sky, '#a29c8e');
      poly(ctx, [px(g, e, z0), py(g, 0, z0), px(g, e, z1), py(g, 0, z1), px(g, e, z1), py(g, top, z1), px(g, e, z0), py(g, top, z0)]);
      ctx.fillStyle = lit(sky, '#7a756a');
      poly(ctx, [px(g, e, z1), py(g, 0, z1), px(g, o, z1), py(g, 0, z1), px(g, o, z1), py(g, top, z1), px(g, e, z1), py(g, top, z1)]);
    }
  }

  function makeHouses(rand) {
    const list = [];
    for (const side of [-1, 1]) {
      let z = 1.3;
      while (z < ROW_END) {
        const len = 0.3 + rand() * 0.35;
        list.push({
          side,
          zn: z,
          zf: Math.min(ROW_END, z + len),
          wide: 0.4 + rand() * 0.35,
          tall: Math.max(0.08, 0.3 - 0.08 * (z - 1.3)) * (0.75 + rand() * 0.3),
          roof: 0.05 + rand() * 0.04,
          wall: WALLS[Math.floor(rand() * WALLS.length)],
          tile: ROOFS[Math.floor(rand() * ROOFS.length)],
          lights: rand(),
        });
        z += len + (rand() < 0.25 ? 0.12 : 0.02);
      }
    }
    return list.sort((a, b) => b.zn - a.zn);
  }

  // Each house sits level, so its downhill end stands on a stone footing.
  function paintHouse(ctx, g, sky, h) {
    const s = h.side;
    const e = s * (ROAD + WALK + 0.01);
    const o = e + s * h.wide;
    const m = e + s * h.wide * 0.5;
    const { zn, zf, roof: R } = h;
    const F = street(zn);
    const T = F + h.tall;
    const q = (X, Y, z) => [px(g, X, z), wy(g, Y, z)];
    const quad = (pts) => poly(ctx, [].concat(...pts));
    ctx.fillStyle = lit(sky, '#8c877c');
    quad([q(e, F, zn), q(e, street(zf), zf), q(o, street(zf), zf), q(o, F, zf), q(e, F, zf)]);
    ctx.fillStyle = lit(sky, h.wall, 0.78);
    quad([q(e, F, zn), q(o, F, zn), q(o, T, zn), q(m, T + R, zn), q(e, T, zn)]);
    ctx.fillStyle = lit(sky, h.wall, 0.95);
    quad([q(e, F, zn), q(e, F, zf), q(e, T, zf), q(e, T, zn)]);
    const eave = e - s * 0.03;
    const zn2 = zn - 0.015;
    ctx.fillStyle = lit(sky, h.tile);
    quad([q(eave, T - 0.02, zn2), q(eave, T - 0.02, zf), q(m, T + R, zf), q(m, T + R, zn2)]);
    ctx.fillStyle = lit(sky, h.tile, 0.7);
    quad([q(m, T + R, zn2), q(m, T + R, zf), q(o + s * 0.03, T - 0.02, zf), q(o + s * 0.03, T - 0.02, zn2)]);
    ctx.fillStyle = lit(sky, '#2a2c34');
    quad([q(eave, T - 0.02, zn2), q(m, T + R, zn2), q(o + s * 0.03, T - 0.02, zn2), q(o + s * 0.03, T - 0.045, zn2), q(m, T + R - 0.025, zn2), q(eave, T - 0.045, zn2)]);
    paintWindows(ctx, g, sky, h, e, F);
    paintEndWall(ctx, g, sky, h, e, F);
  }

  // Windows, a door and a timber band on the wall that faces up the hill.
  function paintEndWall(ctx, g, sky, h, e, F) {
    const s = h.side;
    const z = h.zn;
    const at = (f, Y) => [px(g, e + s * h.wide * f, z), wy(g, F + Y * h.tall, z)];
    const box = (f0, f1, y0, y1) => {
      const a = at(f0, y0);
      const b = at(f1, y1);
      ctx.fillRect(Math.min(a[0], b[0]), b[1], Math.abs(b[0] - a[0]), a[1] - b[1]);
    };
    ctx.fillStyle = lit(sky, '#6a5240', 0.8);
    box(0, 1, 0.47, 0.52);
    const glow = sky.night > 0.4 && h.lights > 0.2;
    ctx.fillStyle = glow ? '#e0b860' : lit(sky, '#3a4250');
    box(0.18, 0.38, 0.62, 0.86);
    box(0.6, 0.82, 0.62, 0.86);
    box(0.55, 0.85, 0.14, 0.36);
    ctx.fillStyle = lit(sky, '#4a3a2e');
    box(0.12, 0.3, 0, 0.4);
  }

  function paintWindows(ctx, g, sky, h, e, F) {
    const glow = sky.night > 0.4 && h.lights > 0.35;
    ctx.fillStyle = glow ? hex(mixColor(rgb('#d9a73a'), rgb('#f0d68a'), h.lights)) : lit(sky, '#3a4250');
    const span = h.zf - h.zn;
    const count = Math.max(1, Math.round(span / 0.18));
    for (let k = 0; k < count; k++) {
      const z0 = h.zn + span * (k + 0.28) / count;
      const z1 = h.zn + span * (k + 0.72) / count;
      for (const [y0, y1] of [[0.14, 0.34], [0.58, 0.76]]) {
        if (h.tall < 0.45 && y0 > 0.5) continue;
        const bot = F + y0 * h.tall;
        const top = F + y1 * h.tall;
        poly(ctx, [px(g, e, z0), wy(g, bot, z0), px(g, e, z1), wy(g, bot, z1), px(g, e, z1), wy(g, top, z1), px(g, e, z0), wy(g, top, z0)]);
      }
    }
  }

  // Poles down both sides and their sagging wires.
  function paintPoles(ctx, g, sky) {
    const ink = lit(sky, '#2a2a30');
    ctx.fillStyle = ink;
    const tops = { '-1': [], '1': [] };
    for (const s of [-1, 1]) {
      for (let z = 1.1; z < TRACK_Z - 0.3; z += 0.6) {
        const X = s * (ROAD + WALK * 0.5);
        const w = Math.max(1, (g.H * 0.012) / z);
        const top = py(g, 0.72, z);
        ctx.fillRect(px(g, X, z) - w / 2, top, w, py(g, 0, z) - top);
        ctx.fillRect(px(g, X, z) - w * 3, top + w * 2, w * 6, Math.max(1, w * 0.6));
        tops[s].push([px(g, X, z), top + w * 2]);
      }
    }
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    for (const s of [-1, 1]) {
      const p = tops[s];
      for (let i = 0; i + 1 < p.length; i++) {
        ctx.beginPath();
        ctx.moveTo(p[i][0], p[i][1]);
        ctx.quadraticCurveTo((p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2 + g.U * 0.6, p[i + 1][0], p[i + 1][1]);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Crossing posts with striped arms raised, lamps dark.
  function paintCrossing(ctx, g, sky) {
    const z = TRACK_Z - 0.08;
    for (const s of [-1, 1]) {
      const x = px(g, s * (ROAD + WALK * 0.6), z);
      const w = Math.max(1, g.U * 0.35);
      const top = py(g, 0.32, z);
      ctx.fillStyle = lit(sky, '#2a2a30');
      ctx.fillRect(x - w / 2, top, w, py(g, 0, z) - top);
      ctx.fillStyle = lit(sky, '#8a3a2c');
      ctx.fillRect(x - w * 1.6, top + w * 1.5, w, w);
      ctx.fillRect(x + w * 0.6, top + w * 1.5, w, w);
      for (let k = 0; k < 5; k++) {
        ctx.fillStyle = lit(sky, k % 2 ? '#2a2a30' : '#d9b850');
        ctx.fillRect(x + s * w * 1.2, top - k * w * 1.4 + w * 3, w * 0.8, w * 1.4);
      }
    }
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintGround(ctx, g, sky, rand);
    paintCrossing(ctx, g, sky);
    for (const h of state.houses) paintHouse(ctx, g, sky, h);
    paintPoles(ctx, g, sky);
    return c;
  }

  // ---- train ------------------------------------------------------------

  function paintTrain(g, sky) {
    const z = TRACK_Z + 0.05;
    const w = (TRAIN_LEN * g.H * SPREAD) / z;
    const h = (TRAIN_TALL * g.H * DEPTH) / z;
    const c = layer(w, h + 2);
    const ctx = c.getContext('2d');
    const cars = 2;
    const cw = w / cars;
    const glow = sky.night > 0.4;
    for (let k = 0; k < cars; k++) {
      const x0 = k * cw + 1;
      ctx.fillStyle = lit(sky, '#e8e0c8');
      ctx.fillRect(x0, 0, cw - 2, h * 0.55);
      ctx.fillStyle = lit(sky, '#3c6a4a');
      ctx.fillRect(x0, h * 0.55, cw - 2, h * 0.45);
      ctx.fillStyle = lit(sky, '#5a5a5c');
      ctx.fillRect(x0, 0, cw - 2, Math.max(1, h * 0.08));
      ctx.fillStyle = glow ? '#e6c66a' : lit(sky, '#2c3444');
      for (let wx = x0 + cw * 0.06; wx < x0 + cw - cw * 0.1; wx += cw * 0.13) {
        ctx.fillRect(wx, h * 0.18, cw * 0.08, h * 0.28);
      }
      ctx.fillStyle = lit(sky, '#22242a');
      ctx.fillRect(x0 + cw * 0.1, h * 0.95, cw * 0.15, h * 0.05 + 2);
      ctx.fillRect(x0 + cw * 0.75, h * 0.95, cw * 0.15, h * 0.05 + 2);
    }
    return c;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 2.4) % c.width);
    ctx.globalAlpha = state.cloudAlpha;
    ctx.drawImage(c, off, g.H * 0.03);
    ctx.drawImage(c, off + c.width, g.H * 0.03);
    ctx.globalAlpha = 1;
  }

  function drawGlints(ctx, g, t, amount) {
    if (amount <= 0) return;
    ctx.fillStyle = state.glintInk;
    const gl = state.glints;
    for (let i = 0; i < GLINTS; i++) {
      const p = gl[i];
      const a = Math.sin(t * p.rate + p.phase);
      if (a <= 0.2) continue;
      ctx.globalAlpha = Math.min(1, (a - 0.2) * 0.7 * amount);
      ctx.fillRect(p.x + Math.sin(t * 0.3 + i) * g.U, p.y, p.w, Math.max(1, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
  }

  // Every half minute or so the train runs along the coast, one way then back.
  function drawTrain(ctx, g, t) {
    const u = t;
    const n = Math.floor(u / TRAIN_CYCLE);
    const p = (u % TRAIN_CYCLE) / TRAIN_RUN;
    if (p >= 1) return;
    const tr = state.train;
    const f = n % 2 ? 1 - p : p;
    const x = lerp(-tr.width - g.U * 4, g.W + g.U * 4, f);
    ctx.drawImage(tr, x, py(g, 0, TRACK_Z + 0.05) - tr.height + 1);
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(53);
    state.back = paintBack(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.train = paintTrain(g, sky);
    state.cloudAlpha = 0.7 - sky.night * 0.45;
    state.glintInk = hex(mixColor(rgb('#f2ead2'), sky.low, 0.3));
    placeGlints(g, sky);
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // Glints gather under the sun or moon, thinning toward the shore.
  function placeGlints(g, sky) {
    const rand = K.rng(71);
    const sun = sunPlace(g, sky);
    const hz = g.H * HORIZON;
    const bottom = py(g, 0.5, TRACK_Z);
    state.glints = [];
    for (let i = 0; i < GLINTS; i++) {
      const f = rand();
      const spread = g.W * (0.04 + f * 0.18);
      state.glints.push({
        x: sun.x + (rand() + rand() - 1) * spread,
        y: lerp(hz + 1, bottom, f),
        w: g.U * (1 + rand() * 2.5) * (0.5 + f),
        rate: 0.5 + rand() * 0.6,
        phase: rand() * 6.3,
      });
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.houses = makeHouses(K.rng(19));
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.22));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.back, 0, 0);
    drawClouds(ctx, g, t);
    drawGlints(ctx, g, t, props.glitter);
    if (props.train) drawTrain(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
  }

  Kasuri.run({
    defaults: { time: 'auto', train: true, glitter: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
