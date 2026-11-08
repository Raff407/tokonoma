/*
 * 自販機 Jihanki — a lone drinks machine glowing on a country road at night.
 *
 * Land, road and machine are baked once. Each frame slides a cloud tile and a
 * water shine, sets the alpha of a few light layers for the tube's slow hum,
 * and draws a short list of moths and grass blades.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, smoothstep, fbm } = K;

  const CAN_COLOURS = ['#c8452f', '#34588e', '#6d8c42', '#deb040', '#d8cfae', '#8f5730', '#44909a', '#d9834e'];
  const CAN_ORDER = [
    [0, 3, 1, 4, 2, 7],
    [1, 6, 6, 3, 7, 4],
    [5, 2, 0, 6, 3, 1],
  ];
  const WATER_TONES = ['#566796', '#7181a6', '#919ebb'];
  const GROWN_TONES = ['#4f683c', '#617c46'];
  const POLE_RATIO = 0.8;
  const POLE_RISE = 4;
  const TWIN_WIRE_U = 22;
  const LONE_WIRE_U = 8;
  const MAX_MOTHS = 28;
  const BLADES = 96;
  const BLADES_PER_TUFT = 8;
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

  // A radial falloff with no kink in it: alpha eases from `peak` to nothing along the stops.
  function softStops(gradient, rgb, peak) {
    const stops = 12;
    for (let i = 0; i <= stops; i++) {
      const s = i / stops;
      const fall = (1 - s * s) * (1 - s * s);
      gradient.addColorStop(s, `rgba(${rgb},${peak * fall})`);
    }
  }

  function makeGeometry(api) {
    const W = api.cols;
    const H = api.rows;
    const g = { W, H, U: H / 100, hy: H * 0.5, vx: W * 0.12, slope: 0.16 * H / (0.88 * W) };
    g.farEdge = (x) => g.hy + H * 0.29 * smoothstep(0.12, 0.52, x / W) + H * 0.02 * (x / W);
    g.nearEdge = (x) => g.hy + H * 0.53 * smoothstep(0.12, 0.46, x / W);
    g.cx = W * 0.62;
    g.foot = g.farEdge(g.cx);
    g.mw = g.U * 40;
    g.mh = g.U * 62;
    g.top = g.foot - g.mh;
    g.pool = { x: g.cx, y: g.foot + g.U * 3, rx: g.U * 84, ry: g.U * 30 };
    return g;
  }

  function paintSky(g, rand) {
    const c = layer(g.W, g.H * 0.6);
    const ctx = c.getContext('2d');
    const fade = ctx.createLinearGradient(0, 0, 0, g.hy);
    fade.addColorStop(0, '#242e56');
    fade.addColorStop(0.5, '#3f4e7e');
    fade.addColorStop(0.8, '#65739a');
    fade.addColorStop(1, '#8c98b6');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, g.W, c.height);
    ctx.fillStyle = '#d9dcd0';
    for (let i = 0; i < g.W * 0.3; i++) {
      const y = rand() * rand() * g.hy * 0.8;
      ctx.globalAlpha = rand() < 0.7 ? 0.3 : 0.6;
      ctx.fillRect(rand() * g.W, y, 1, 1);
    }
    ctx.globalAlpha = 1;
    paintMoon(ctx, g);
    return c;
  }

  function paintMoon(ctx, g) {
    const x = g.W * 0.24;
    const y = g.H * 0.16;
    const r = g.U * 4.2;
    const glow = ctx.createRadialGradient(x, y, r, x, y, r * 3.2);
    softStops(glow, '226,222,196', 0.16);
    ctx.fillStyle = glow;
    ctx.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
    ctx.fillStyle = '#ece6c8';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#c9c4a6';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.3, 0, 6.3);
    ctx.arc(x + r * 0.35, y + r * 0.3, r * 0.22, 0, 6.3);
    ctx.fill();
  }

  // A seamless band of thin cloud, baked at half size and scaled up when drawn.
  function bakeClouds(g, seed) {
    const w = Math.ceil(g.W * 0.75);
    const h = Math.ceil(g.H * 0.26);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const scale = 7 / w;
    const cloudAt = (x, y) => fbm(x * scale * 2, y * scale * 6, 4, seed);
    for (let y = 0; y < h; y++) {
      const fade = smoothstep(0, 0.25, y / h) * (1 - smoothstep(0.75, 1, y / h));
      for (let x = 0; x < w; x++) {
        const v = lerp(cloudAt(x, y), cloudAt(x - w, y), x / w);
        const a = Math.round(smoothstep(0.48, 0.78, v) * fade * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 112;
        img.data[i + 1] = 124;
        img.data[i + 2] = 160;
        img.data[i + 3] = a * 70;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Hills stand at the far left and behind the machine's right; they drop to a low valley
  // behind the pole line so the small poles have open sky to stand against.
  function ridgeEnvelope(fx) {
    return lerp(0.3, 1, Math.max(1 - smoothstep(0.02, 0.18, fx), smoothstep(0.5, 0.8, fx)));
  }

  function paintRidge(ctx, g, base, rise, freq, seed, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, g.hy + 1);
    const steps = Math.ceil(g.W / 2);
    for (let i = 0; i <= steps; i++) {
      const x = (g.W * i) / steps;
      const f = fbm((x / g.U) * freq, seed, 4, seed);
      ctx.lineTo(x, g.hy - g.U * (base + rise * f) * ridgeEnvelope(x / g.W));
    }
    ctx.lineTo(g.W, g.hy + 1);
    ctx.fill();
  }

  // One point perspective: a point out at `side` and `q` below the horizon.
  function fieldX(g, side, q) {
    return g.vx + side * q;
  }

  function paintPaddyGrid(ctx, g, rand) {
    const sides = [-22, -11, -6, -3, -1.2, 0.5, 1.8, 3.4, 5.4, 8.2, 13, 26];
    const depths = [0, 0.018, 0.04, 0.075, 0.13, 0.22, 0.36, 0.55].map((d) => d * g.H);
    for (let i = 0; i < sides.length - 1; i++) {
      for (let j = 0; j < depths.length - 1; j++) {
        const q0 = depths[j];
        const q1 = depths[j + 1];
        const grown = rand() < 0.26;
        const far = 1 - j / depths.length;
        const tone = Math.min(2, Math.floor((far * 0.8 + rand() * 0.2) * 3));
        ctx.fillStyle = grown ? GROWN_TONES[Math.floor(rand() * 2)] : WATER_TONES[tone];
        ctx.beginPath();
        ctx.moveTo(fieldX(g, sides[i], q0), g.hy + q0);
        ctx.lineTo(fieldX(g, sides[i + 1], q0), g.hy + q0);
        ctx.lineTo(fieldX(g, sides[i + 1], q1), g.hy + q1);
        ctx.lineTo(fieldX(g, sides[i], q1), g.hy + q1);
        ctx.fill();
      }
    }
    paintLevees(ctx, g, sides, depths);
  }

  function paintLevees(ctx, g, sides, depths) {
    ctx.fillStyle = '#34463a';
    for (const q of depths) ctx.fillRect(0, g.hy + q, g.W, Math.max(1, q * 0.035));
    for (const s of sides) {
      const near = g.H * 0.55;
      const halfWidth = Math.max(0.05, Math.abs(s) * 0.01 + 0.05);
      ctx.beginPath();
      ctx.moveTo(g.vx, g.hy);
      ctx.lineTo(fieldX(g, s - halfWidth, near), g.hy + near);
      ctx.lineTo(fieldX(g, s + halfWidth, near), g.hy + near);
      ctx.fill();
    }
  }

  function paintSeedlings(ctx, g, rand) {
    ctx.fillStyle = '#26382c';
    const step = 0.42;
    for (let row = -60; row <= 70; row++) {
      const side = row * step + 0.2;
      for (let z = 0.012; z < 1.2; z *= 1.09) {
        const q = g.H * z * 0.55;
        const x = fieldX(g, side, q);
        if (x < -4 || x > g.W + 4 || q < g.U * 1.5) continue;
        const h = Math.max(1, q * 0.07);
        const w = Math.max(1, q * 0.028);
        ctx.globalAlpha = rand() < 0.5 ? 0.5 : 0.85;
        ctx.fillRect(x - w / 2, g.hy + q - h, w, h);
      }
    }
    ctx.globalAlpha = 1;
  }

  function polePlaces(g) {
    const list = [];
    for (let d = 0.82 / POLE_RATIO; d > 0.05; d *= POLE_RATIO) {
      const x = g.vx + d * g.W;
      const base = g.hy + g.slope * d * g.W;
      list.push({ x, base, h: (base - g.hy) * POLE_RISE });
    }
    return list;
  }

  function paintTrack(ctx, g) {
    const far = g.W * 1.4;
    ctx.fillStyle = '#6b6a66';
    ctx.beginPath();
    ctx.moveTo(g.vx, g.hy);
    ctx.lineTo(g.vx + far, g.hy + g.slope * far * 1.0);
    ctx.lineTo(g.vx + far, g.hy + g.slope * far * 1.22);
    ctx.fill();
  }

  function paintPole(ctx, g, p) {
    const w = Math.max(1, p.h * 0.02);
    const top = p.base - p.h;
    ctx.fillRect(p.x - w / 2, top, w, p.h);
    const arm = Math.max(g.U * 1.2, p.h * 0.1);
    const t = Math.max(1, p.h * 0.011);
    ctx.fillRect(p.x - arm, top + p.h * 0.05, arm * 2, t);
    if (p.h >= g.U * 20) ctx.fillRect(p.x - arm * 0.72, top + p.h * 0.12, arm * 1.44, t);
  }

  function paintWire(ctx, a, b, spread) {
    const ax = a.x + a.h * spread;
    const ay = a.base - a.h + a.h * 0.05;
    const bx = b.x + b.h * spread;
    const by = b.base - b.h + b.h * 0.05;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 + a.h * 0.06, bx, by);
    ctx.stroke();
  }

  // Two wires between big poles, one between small ones, none once they would stack up.
  function paintWires(ctx, g, poles) {
    ctx.lineWidth = 1;
    for (let i = 0; i < poles.length - 1; i++) {
      const a = poles[i];
      const b = poles[i + 1];
      if (b.h < g.U * LONE_WIRE_U) break;
      if (b.h >= g.U * TWIN_WIRE_U) {
        paintWire(ctx, a, b, -0.1);
        paintWire(ctx, a, b, 0.1);
      } else {
        paintWire(ctx, a, b, 0);
      }
    }
  }

  function paintFarLights(ctx, g) {
    ctx.fillStyle = '#e0b467';
    const places = [[0.33, 2.6], [0.355, 2.2], [0.86, 3.2]];
    const s = Math.max(1, g.U * 0.6);
    for (const [x, up] of places) ctx.fillRect(g.W * x, g.hy - g.U * up, s, s);
  }

  function paintBack(g, rand, seed) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintRidge(ctx, g, 5, 22, 0.034, seed + 1, '#47547e');
    paintRidge(ctx, g, 1.5, 11, 0.05, seed + 2, '#333f64');
    paintFarLights(ctx, g);
    paintPaddyGrid(ctx, g, rand);
    paintSeedlings(ctx, g, rand);
    paintTrack(ctx, g);
    const poles = polePlaces(g);
    ctx.strokeStyle = '#161c30';
    ctx.fillStyle = '#161c30';
    paintWires(ctx, g, poles);
    for (const p of poles) paintPole(ctx, g, p);
    return c;
  }

  // Short horizontal strokes of shine, wider nearer the viewer; wrapped so the tile repeats.
  function bakeShine(g, rand) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.5);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#aab6d2';
    for (let i = 0; i < g.W * 1.1; i++) {
      const f = rand();
      const y = f * f * h;
      const len = 1 + (y / h) * g.U * (5 + rand() * 12);
      const x = rand() * w;
      ctx.globalAlpha = rand() < 0.6 ? 0.18 : 0.38;
      ctx.fillRect(x, y, len, 1);
      ctx.fillRect(x - w, y, len, 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function traceRoad(ctx, g) {
    const steps = Math.ceil(g.W / 3);
    ctx.beginPath();
    ctx.moveTo(g.vx, g.hy);
    for (let i = 0; i <= steps; i++) {
      const x = lerp(g.vx, g.W, i / steps);
      ctx.lineTo(x, g.farEdge(x));
    }
    ctx.lineTo(g.W, g.H);
    ctx.lineTo(g.W * 0.46, g.H);
    for (let i = steps; i >= 0; i--) {
      const x = lerp(g.vx, g.W * 0.46, i / steps);
      ctx.lineTo(x, g.nearEdge(x));
    }
    ctx.closePath();
  }

  function paintVerge(ctx, g, rand) {
    ctx.fillStyle = '#46593a';
    ctx.beginPath();
    ctx.moveTo(g.vx, g.hy);
    const steps = Math.ceil(g.W / 1.5);
    for (let i = 0; i <= steps; i++) {
      const x = lerp(g.vx, g.W, i / steps);
      const y = g.farEdge(x);
      const up = (y - g.hy) * (0.06 + rand() * 0.07);
      ctx.lineTo(x, y - up);
    }
    ctx.lineTo(g.W, g.farEdge(g.W) + 1);
    ctx.lineTo(g.vx, g.hy);
    ctx.fill();
  }

  function paintRoadSurface(ctx, g, rand) {
    ctx.fillStyle = '#42455c';
    traceRoad(ctx, g);
    ctx.fill();
    ctx.save();
    traceRoad(ctx, g);
    ctx.clip();
    for (let i = 0; i < g.W * g.H * 0.022; i++) {
      ctx.fillStyle = rand() < 0.5 ? '#5f6279' : '#2c2f44';
      ctx.fillRect(rand() * g.W, g.hy + rand() * (g.H - g.hy), 1, 1);
    }
    ctx.restore();
  }

  // A worn white line along an edge, or dashes down the middle of the bend.
  function paintRoadLines(ctx, g) {
    ctx.fillStyle = '#c8c5ae';
    ctx.globalAlpha = 0.55;
    const steps = Math.ceil(g.W * 0.9);
    for (let i = 0; i < steps; i++) {
      const x = lerp(g.vx, g.W, i / steps);
      const y = g.farEdge(x);
      ctx.fillRect(x, y + (y - g.hy) * 0.04, 1.5, Math.max(1, (y - g.hy) * 0.018));
    }
    ctx.globalAlpha = 0.72;
    let x = g.vx + g.W * 0.03;
    while (x < g.W) {
      const y = (g.farEdge(x) + g.nearEdge(Math.min(x, g.W * 0.46))) / 2 + g.U * 0.5;
      const q = y - g.hy;
      const len = q * 0.28;
      ctx.fillRect(x, y, len, Math.max(1, q * 0.022));
      x += len * 2.1;
    }
    ctx.globalAlpha = 1;
  }

  function paintNearVerge(ctx, g, rand) {
    ctx.fillStyle = '#3d5238';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    const steps = Math.ceil(g.W / 2);
    for (let i = 0; i <= steps; i++) {
      const x = lerp(0, g.W * 0.47, i / steps);
      const road = x > g.vx ? g.nearEdge(x) : g.hy;
      const hug = road - (road - g.hy) * 0.05;
      const bank = g.H * 0.83 + Math.sin(x / (g.U * 11)) * g.U * 2.6 + rand() * g.U * 2.2;
      ctx.lineTo(x, Math.max(bank, hug - rand() * g.U * 0.7));
    }
    ctx.lineTo(g.W * 0.47, g.H);
    ctx.fill();
    paintNearEdgeGrass(ctx, g, rand);
  }

  function paintNearEdgeGrass(ctx, g, rand) {
    ctx.fillStyle = '#4e6642';
    const steps = Math.ceil(g.W * 0.7);
    for (let i = 0; i < steps; i++) {
      const x = lerp(g.vx, g.W * 0.47, i / steps);
      const y = g.nearEdge(x);
      if (y > g.H) break;
      const q = y - g.hy;
      ctx.fillRect(x, y - q * (0.03 + rand() * 0.05), 1, q * 0.1);
    }
  }

  function paintBody(ctx, g) {
    const u = g.U;
    const x = g.cx - g.mw / 2;
    const side = u * 3.2;
    ctx.fillStyle = '#8c3626';
    ctx.beginPath();
    ctx.moveTo(x, g.top);
    ctx.lineTo(x - side, g.top + u * 1.8);
    ctx.lineTo(x - side, g.foot - u * 0.4);
    ctx.lineTo(x, g.foot);
    ctx.fill();
    ctx.fillStyle = '#e0654a';
    ctx.fillRect(x, g.top, g.mw, g.mh);
    ctx.fillStyle = '#bd4c35';
    ctx.fillRect(x + g.mw * 0.9, g.top, g.mw * 0.1, g.mh);
    ctx.fillStyle = '#2b2730';
    ctx.fillRect(x - u * 0.6, g.foot - u * 1.6, g.mw + u * 1.2, u * 1.8);
    ctx.fillStyle = '#f0a285';
    ctx.fillRect(x, g.top, g.mw, Math.max(1, u * 0.5));
  }

  function paintCan(ctx, x, y, w, h, colour) {
    const dark = mix(colour, '#1e1a24', 0.42);
    const light = mix(colour, '#fbf6e4', 0.42);
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = dark;
    ctx.fillRect(x + w * 0.74, y, w * 0.26, h);
    ctx.fillStyle = light;
    ctx.fillRect(x + w * 0.16, y, Math.max(1, w * 0.2), h);
    ctx.fillStyle = '#d4d6d4';
    ctx.fillRect(x + w * 0.08, y - h * 0.09, w * 0.84, Math.max(1, h * 0.1));
    ctx.fillStyle = '#7f8388';
    ctx.fillRect(x, y + h - Math.max(1, h * 0.06), w, Math.max(1, h * 0.06));
  }

  function paintWindow(ctx, g) {
    const u = g.U;
    const win = { x: g.cx - g.mw / 2 + u * 2.4, y: g.top + u * 8.5, w: g.mw - u * 4.8, h: u * 32 };
    state.window = win;
    ctx.fillStyle = '#efe9d2';
    ctx.fillRect(win.x, win.y, win.w, win.h);
    const rowH = win.h / 3;
    const cols = CAN_ORDER[0].length;
    const colW = win.w / cols;
    for (let r = 0; r < 3; r++) {
      const shelfY = win.y + rowH * (r + 1);
      ctx.fillStyle = '#8a8678';
      ctx.fillRect(win.x, shelfY - u * 2.4, win.w, u * 2.4);
      for (let i = 0; i < cols; i++) {
        const cw = colW * 0.8;
        const ch = rowH * 0.66;
        const cx = win.x + colW * i + (colW - cw) / 2;
        paintCan(ctx, cx, shelfY - u * 2.8 - ch, cw, ch, CAN_COLOURS[CAN_ORDER[r][i]]);
        ctx.fillStyle = r === 1 && i === 3 ? '#f2d98a' : '#f6f1de';
        ctx.fillRect(cx + cw * 0.28, shelfY - u * 1.7, cw * 0.44, u * 1);
      }
    }
    const f = Math.max(1, u * 0.7);
    ctx.strokeStyle = '#7d2b1f';
    ctx.lineWidth = f;
    ctx.strokeRect(win.x - f / 2, win.y - f / 2, win.w + f, win.h + f);
  }

  function paintLowerPanel(ctx, g) {
    const u = g.U;
    const left = g.cx - g.mw / 2;
    const y = g.top + u * 42.5;
    ctx.fillStyle = '#d8d3bf';
    ctx.fillRect(left + g.mw - u * 11, y, u * 8.6, u * 6);
    ctx.fillStyle = '#26303a';
    ctx.fillRect(left + g.mw - u * 9.8, y + u * 0.9, u * 6.2, u * 1.6);
    ctx.fillStyle = '#6f7274';
    ctx.fillRect(left + g.mw - u * 8, y + u * 3.4, u * 3, u * 1.5);
    ctx.fillStyle = '#1e1c26';
    ctx.fillRect(left + u * 4, g.top + u * 50, g.mw - u * 8, u * 7.5);
    ctx.fillStyle = '#3e3a44';
    ctx.fillRect(left + u * 4.6, g.top + u * 50.6, g.mw - u * 9.2, u * 2.6);
  }

  function paintBin(ctx, g) {
    const u = g.U;
    const x = g.cx + g.mw / 2 + u * 3;
    const w = u * 9;
    const h = u * 15;
    const y = g.foot + u * 0.6;
    ctx.fillStyle = '#58606e';
    ctx.fillRect(x, y - h, w, h);
    ctx.fillStyle = '#9fa8a6';
    ctx.fillRect(x, y - h, w * 0.38, h);
    ctx.fillStyle = '#39404f';
    ctx.fillRect(x - u * 0.3, y - h - u * 1.2, w + u * 0.6, u * 1.6);
    ctx.fillStyle = '#20222e';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y - h * 0.72, w * 0.26, w * 0.26, 0, 0, 6.3);
    ctx.fill();
  }

  // Adds to the current path, wound the same way as the road so the two can clip together.
  function tracePad(ctx, g) {
    const u = g.U;
    const w = g.mw + u * 19;
    const x = g.cx - g.mw / 2 - u * 6;
    ctx.moveTo(x + u * 1.5, g.foot - u * 2.5);
    ctx.lineTo(x + w - u * 1.5, g.foot - u * 2.5);
    ctx.lineTo(x + w, g.foot + u * 2);
    ctx.lineTo(x, g.foot + u * 2);
    ctx.closePath();
  }

  function paintPad(ctx, g) {
    const u = g.U;
    const w = g.mw + u * 19;
    const x = g.cx - g.mw / 2 - u * 6;
    ctx.fillStyle = '#7f7c70';
    ctx.beginPath();
    tracePad(ctx, g);
    ctx.fill();
    ctx.fillStyle = '#4c4b4a';
    ctx.fillRect(x, g.foot + u * 2, w, Math.max(1, u * 0.8));
  }

  // Everything the pool of light falls on.
  function paintGround(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintVerge(ctx, g, rand);
    paintRoadSurface(ctx, g, rand);
    paintRoadLines(ctx, g);
    paintPad(ctx, g);
    return c;
  }

  // Everything that stands above the pool: the foreground bank, the bin and the machine.
  function paintUpper(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintNearVerge(ctx, g, rand);
    paintBin(ctx, g);
    paintBody(ctx, g);
    paintWindow(ctx, g);
    paintLowerPanel(ctx, g);
    paintTube(ctx, g);
    return c;
  }

  function paintTube(ctx, g) {
    const u = g.U;
    const x = g.cx - g.mw / 2 + u * 2.4;
    const w = g.mw - u * 4.8;
    ctx.fillStyle = '#fbf6df';
    ctx.fillRect(x, g.top + u * 2, w, u * 4.4);
    ctx.fillStyle = '#7d2b1f';
    ctx.fillRect(x, g.top + u * 6.4, w, Math.max(1, u * 0.6));
    state.tube = { x, y: g.top + u * 2, w, h: u * 4.4 };
  }

  function paintHalo(g) {
    const r = Math.ceil(g.U * 58);
    const c = layer(r * 2, r * 2);
    const ctx = c.getContext('2d');
    const halo = ctx.createRadialGradient(r, r, g.U * 14, r, r, r);
    softStops(halo, '244,190,112', 0.36);
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, r * 2, r * 2);
    return { canvas: c, r };
  }

  function fillPoolGlow(ctx, g, peak) {
    const p = g.pool;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(1, p.ry / p.rx);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, p.rx);
    softStops(glow, '252,180,88', peak);
    ctx.fillStyle = glow;
    ctx.fillRect(-p.rx, -p.rx, p.rx * 2, p.rx * 2);
    ctx.restore();
  }

  // A faint wash over the grass, and a stronger one held to the hard ground that reflects it.
  function paintPool(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    fillPoolGlow(ctx, g, 0.05);
    ctx.save();
    traceRoad(ctx, g);
    tracePad(ctx, g);
    ctx.clip();
    fillPoolGlow(ctx, g, 0.24);
    ctx.restore();
    return c;
  }

  function makeMoths(g, rand) {
    const list = [];
    for (let i = 0; i < MAX_MOTHS; i++) {
      const inner = i % 3 === 0;
      list.push({
        rx: g.U * (inner ? 8 + rand() * 12 : 20 + rand() * 18),
        ry: g.U * (inner ? 5 + rand() * 12 : 10 + rand() * 18),
        fa: 0.22 + rand() * 0.34,
        fb: 0.37 + rand() * 0.41,
        pa: rand() * 6.28,
        pb: rand() * 6.28,
        size: g.U * (0.9 + rand() * 0.9),
        flap: 5 + rand() * 4,
        jit: g.U * (1 + rand() * 1.6),
      });
    }
    return list;
  }

  function drawMoth(ctx, g, m, t, win) {
    const x = g.cx + Math.cos(t * m.fa + m.pa) * m.rx + Math.sin(t * 2.3 + m.pb) * m.jit;
    const y = g.top + g.U * 9 + Math.sin(t * m.fb + m.pb) * m.ry + Math.cos(t * 2.9 + m.pa) * m.jit * 0.7;
    const open = 0.35 + 0.65 * Math.abs(Math.sin(t * m.flap + m.pa));
    const s = m.size;
    const over = x > win.left && x < win.right && y > g.top && y < g.foot;
    ctx.fillStyle = over ? '#3e3226' : '#f3e8c6';
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.4);
    ctx.lineTo(x - s * 1.5 * open, y - s * 0.7);
    ctx.lineTo(x - s * 1.1 * open, y + s * 0.6);
    ctx.closePath();
    ctx.moveTo(x, y + s * 0.4);
    ctx.lineTo(x + s * 1.5 * open, y - s * 0.7);
    ctx.lineTo(x + s * 1.1 * open, y + s * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c9b48a';
    ctx.fillRect(x - s * 0.18, y - s * 0.45, Math.max(1, s * 0.36), s);
    drawMothShadow(ctx, g, x, y, s);
  }

  // Only a moth close to the machine throws a shadow, and only inside the bright part of the pool.
  function drawMothShadow(ctx, g, x, y, s) {
    const dx = x - g.cx;
    if (Math.abs(dx) > g.mw * 0.7) return;
    const sx = g.cx + dx * 1.25;
    const sy = g.foot + g.U * 4 + (y - g.top) * 0.16;
    const px = (sx - g.pool.x) / g.pool.rx;
    const py = (sy - g.pool.y) / g.pool.ry;
    if (px * px + py * py > 0.3) return;
    ctx.fillStyle = '#2c2a34';
    ctx.globalAlpha = 0.2;
    ctx.fillRect(sx - s * 0.9, sy, s * 1.8, Math.max(1, s * 0.4));
    ctx.globalAlpha = 1;
  }

  function makeBlades(g, rand) {
    const list = [];
    const tufts = Math.floor(BLADES / BLADES_PER_TUFT);
    for (let k = 0; k < tufts; k++) {
      const f = (k + rand() * 0.8) / tufts;
      const x = g.W * 0.43 * f;
      const size = g.U * (16 + rand() * 16) * (1.15 - f * 0.6);
      for (let i = 0; i < BLADES_PER_TUFT; i++) {
        const fan = (i + 0.5) / BLADES_PER_TUFT - 0.5 + (rand() - 0.5) * 0.15;
        list.push({
          x: x + fan * g.U * 5,
          ground: g.H + g.U * 2,
          tall: size * (0.55 + rand() * 0.5) * (1 - Math.abs(fan) * 0.5),
          lean: fan * size * 0.95 + g.U * 1.5,
          phase: k * 1.7 + rand(),
          rate: 0.45 + rand() * 0.3,
          width: Math.max(1, g.U * (0.3 + rand() * 0.5)),
          tone: Math.floor(rand() * 3),
        });
      }
    }
    return list;
  }

  function drawBlades(ctx, g, t) {
    const tones = state.bladeTones;
    for (let i = 0; i < state.blades.length; i++) {
      const b = state.blades[i];
      const sway = Math.sin(t * b.rate + b.phase) * g.U * 0.9;
      ctx.strokeStyle = tones[b.tone];
      ctx.lineWidth = b.width;
      ctx.beginPath();
      ctx.moveTo(b.x, b.ground);
      ctx.quadraticCurveTo(b.x + b.lean * 0.3, b.ground - b.tall * 0.65, b.x + b.lean + sway, b.ground - b.tall);
      ctx.stroke();
    }
  }

  function setup(ctx, api) {
    const g = makeGeometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.sky = paintSky(g, rand);
    state.clouds = bakeClouds(g, api.seed % 1000);
    state.back = paintBack(g, rand, api.seed % 1000);
    state.shine = bakeShine(g, rand);
    state.ground = paintGround(g, rand);
    state.upper = paintUpper(g, rand);
    state.halo = paintHalo(g);
    state.pool = paintPool(g);
    state.moths = makeMoths(g, rand);
    state.blades = makeBlades(g, rand);
    state.bladeTones = ['#2e4230', '#48603c', '#62794a'];
    state.mothBox = { left: g.cx - g.mw / 2 - g.U * 3, right: g.cx + g.mw / 2 };
  }

  function drawClouds(ctx, g, t) {
    const w = g.W * 1.5;
    const h = g.H * 0.52;
    const off = (t * g.U * 0.55) % w;
    ctx.drawImage(state.clouds, off, 0, w, h);
    ctx.drawImage(state.clouds, off - w, 0, w, h);
  }

  function drawShine(ctx, g, t) {
    const tile = state.shine;
    const w = tile.width;
    const a = (t * g.U * 0.9) % w;
    const b = (t * g.U * 0.5) % w;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.34 + 0.12 * Math.sin(t * 0.31);
    ctx.drawImage(tile, a, g.hy);
    ctx.drawImage(tile, a - w, g.hy);
    ctx.globalAlpha = 0.34 - 0.12 * Math.sin(t * 0.31);
    ctx.drawImage(tile, w - b - w, g.hy - 1);
    ctx.drawImage(tile, w - b, g.hy - 1);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // Sums of slow sines: the tube sags a little and recovers, it never blinks.
  function humAt(t) {
    return 0.5 * Math.sin(t * 0.37) + 0.3 * Math.sin(t * 0.91 + 1) + 0.2 * Math.sin(t * 1.63 + 2);
  }

  function drawTubeHum(ctx, g, t, amount) {
    const tube = state.tube;
    const parts = 7;
    const w = tube.w / parts;
    ctx.fillStyle = '#6a5a3a';
    for (let i = 0; i < parts; i++) {
      const a = 0.1 + 0.08 * Math.sin(t * 0.5 + i * 0.9) + 0.05 * Math.sin(t * 1.3 - i * 1.7);
      ctx.globalAlpha = Math.max(0, a * amount);
      ctx.fillRect(tube.x + i * w, tube.y, w + 1, tube.h);
    }
    const hum = humAt(t);
    const win = state.window;
    ctx.fillStyle = '#2c2a34';
    ctx.globalAlpha = Math.max(0, (0.08 - 0.07 * hum) * amount);
    ctx.fillRect(win.x, win.y, win.w, win.h);
    ctx.globalAlpha = 1;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const amount = api.props.hum;
    const glow = 0.82 + 0.12 * humAt(t) * amount;
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.back, 0, 0);
    drawShine(ctx, g, t);
    const halo = state.halo;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = glow;
    ctx.drawImage(halo.canvas, g.cx - halo.r, g.top + g.U * 24 - halo.r);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(state.ground, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = glow;
    ctx.drawImage(state.pool, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(state.upper, 0, 0);
    drawTubeHum(ctx, g, t, amount);
    const count = Math.min(MAX_MOTHS, Math.round(14 * api.props.moths));
    for (let i = 0; i < count; i++) drawMoth(ctx, g, state.moths[i], t, state.mothBox);
    ctx.lineCap = 'round';
    drawBlades(ctx, g, t);
  }

  Kasuri.run({
    defaults: { moths: 1, hum: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.15, dither: 0.6 },
    maxFps: 20,
    setup,
    draw,
  });
})();
