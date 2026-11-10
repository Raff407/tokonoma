/*
 * 颐和园 Summer Palace — a palace lake under a terraced hill.
 *
 * Sky, hills, the tiered tower, the long painted corridor, the marble arch bridge and
 * the island hall are baked into one layer and repainted once a minute from the clock.
 * The lake is that layer flipped and laid back in thin rows that slide sideways.
 * Between repaints only mist, willow strands, a pleasure boat and a few glints move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.68;
  const TOWER = { x: 0.3, base: 0.44 };
  const CORRIDOR = [0.02, 0.5];
  const HALLS = [0.14, 0.31, 0.47];
  const BRIDGE = { from: 0.53, to: 0.97, arches: 17 };
  const ISLE = 0.86;
  const RETINT_SECONDS = 60;
  const ROW = 2;
  const GLINTS = 22;
  const STRANDS = 60;
  const BOAT_SECONDS = 160;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, TAU);
    ctx.fill();
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    return { W, H, U, wy: Math.round(H * WATER) };
  }

  // Tint an ink toward the sky haze (distance) and toward night.
  function tone(sky, ink, haze, dark) {
    const base = mixColor(rgb(ink), sky.haze, haze);
    return hex(mixColor(base, rgb('#10142a'), sky.night * dark));
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(ctx, g, sky, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.wy);
    grad.addColorStop(0, hex(mixColor(sky.top, rgb('#d8d4c4'), 0.25)));
    grad.addColorStop(1, hex(mixColor(sky.low, rgb('#e6e0cc'), 0.45)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.wy);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.3; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.4);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ece6cf';
      ctx.globalAlpha = 0.9 * sky.night;
      blob(ctx, g.W * 0.72, g.H * 0.12, g.U * 2.4, g.U * 2.4);
      ctx.globalAlpha = 0.12 * sky.night;
      blob(ctx, g.W * 0.72, g.H * 0.12, g.U * 6, g.U * 6);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#f4ecd2';
      ctx.globalAlpha = 0.35 * (1 - sky.night);
      blob(ctx, g.W * 0.7, g.H * 0.2, g.U * 3.2, g.U * 3.2);
      ctx.globalAlpha = 0.12;
      blob(ctx, g.W * 0.7, g.H * 0.2, g.U * 9, g.U * 9);
      ctx.globalAlpha = 1;
    }
  }

  // ---- hills -------------------------------------------------------------

  function ridgeFar(g, x) {
    return g.H * 0.42 + (fbm(x / (g.U * 34), 1.7, 4, 13) - 0.5) * g.H * 0.14
      - Math.exp(-(((x - g.W * 0.78) / (g.W * 0.16)) ** 2)) * g.H * 0.08;
  }

  function ridgeHill(g, x) {
    const hump = Math.exp(-(((x - g.W * 0.3) / (g.W * 0.24)) ** 2));
    const shoulder = Math.exp(-(((x - g.W * 0.05) / (g.W * 0.14)) ** 2));
    return g.H * 0.6 - hump * g.H * 0.36 - shoulder * g.H * 0.05
      + (fbm(x / (g.U * 16), 3.1, 3, 29) - 0.5) * g.H * 0.025;
  }

  function ridgeIsle(g, x) {
    const hump = Math.exp(-(((x - g.W * ISLE) / (g.W * 0.12)) ** 2));
    return g.H * 0.64 - hump * g.H * 0.15 + (fbm(x / (g.U * 12), 5.2, 3, 7) - 0.5) * g.H * 0.02;
  }

  function fillRidge(ctx, g, fn, color, x0, x1) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x0, g.wy);
    for (let x = x0; x <= x1; x += 2) ctx.lineTo(x, fn(g, x));
    ctx.lineTo(x1, g.wy);
    ctx.closePath();
    ctx.fill();
  }

  function mistBand(ctx, g, sky, y, h, alpha) {
    const grad = ctx.createLinearGradient(0, y - h, 0, y + h);
    const c = hex(mixColor(rgb('#e8e4d6'), sky.low, 0.35));
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, c);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - h, g.W, h * 2);
    ctx.globalAlpha = 1;
  }

  // Dark pine and cypress crowns scattered over a ridge.
  function crowns(ctx, g, fn, x0, x1, step, color, rand, spread) {
    ctx.fillStyle = color;
    for (let x = x0; x < x1; x += g.U * (step * (0.6 + rand() * 0.8))) {
      const top = fn(g, x);
      const r = g.U * (0.9 + rand() * 1.1);
      blob(ctx, x, top + g.U * rand() * spread, r, r * 0.8);
    }
  }

  // A tall pale pagoda on a far hill, a nod to the western hills.
  function paintFarPagoda(ctx, g, sky) {
    const x = g.W * 0.8;
    const by = ridgeFar(g, x) + g.U * 1.5;
    const u = g.U;
    ctx.fillStyle = tone(sky, '#6b7a78', 0.6, 0.5);
    for (let i = 0; i < 5; i++) {
      const w = u * (2.6 - i * 0.28);
      const y = by - i * u * 1.9;
      poly(ctx, [x - w, y, x + w, y, x + w * 0.7, y - u * 1.2, x - w * 0.7, y - u * 1.2]);
    }
    ctx.fillRect(x - 0.5, by - u * 11.5, 1, u * 2);
  }

  function paintHills(ctx, g, sky, rand) {
    fillRidge(ctx, g, ridgeFar, tone(sky, '#5c6e72', 0.62, 0.5), 0, g.W + 2);
    paintFarPagoda(ctx, g, sky);
    mistBand(ctx, g, sky, g.H * 0.55, g.U * 6, 0.6);
    fillRidge(ctx, g, ridgeIsle, tone(sky, '#3f5a4c', 0.35, 0.6), g.W * 0.62, g.W + 2);
    crowns(ctx, g, ridgeIsle, g.W * 0.66, g.W, 1.5, tone(sky, '#2c4636', 0.3, 0.6), rand, 1.4);
    fillRidge(ctx, g, ridgeHill, tone(sky, '#34523f', 0.22, 0.65), 0, g.W * 0.72);
    crowns(ctx, g, ridgeHill, 0, g.W * 0.7, 1.3, tone(sky, '#27402f', 0.18, 0.65), rand, 2.2);
    ctx.fillStyle = tone(sky, '#4a6a48', 0.25, 0.6);
    for (let i = 0; i < 90; i++) {
      const x = rand() * g.W * 0.68;
      const top = ridgeHill(g, x);
      blob(ctx, x, top + g.U * (3 + rand() * 18), g.U * (1 + rand() * 2), g.U * (0.7 + rand() * 1.2));
    }
  }

  // ---- roofs and halls ---------------------------------------------------

  function roofColors(sky) {
    return {
      tile: tone(sky, '#b18f3a', 0.12, 0.55),
      edge: tone(sky, '#5d7a52', 0.1, 0.55),
      under: tone(sky, '#2c3c6a', 0.05, 0.6),
      wall: tone(sky, '#a8402c', 0.06, 0.55),
      post: tone(sky, '#8c3426', 0.06, 0.55),
      marble: tone(sky, '#e6e2d4', 0.1, 0.5),
      dark: tone(sky, '#1e2430', 0.05, 0.5),
      gold: tone(sky, '#c7a24a', 0.05, 0.4),
    };
  }

  // A hip roof with upturned corners: wide at the eave, narrower at the ridge.
  function eaveRoof(ctx, cx, y, w, rise, lift, col, edge) {
    const rw = w * 0.2;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, y - lift);
    ctx.quadraticCurveTo(cx - w * 0.4, y + rise * 0.1, cx - w * 0.28, y);
    ctx.lineTo(cx + w * 0.28, y);
    ctx.quadraticCurveTo(cx + w * 0.4, y + rise * 0.1, cx + w / 2, y - lift);
    ctx.quadraticCurveTo(cx + w * 0.3, y - rise * 0.2, cx + rw, y - rise);
    ctx.lineTo(cx - rw, y - rise);
    ctx.quadraticCurveTo(cx - w * 0.3, y - rise * 0.2, cx - w / 2, y - lift);
    ctx.fill();
    ctx.fillStyle = edge;
    ctx.fillRect(cx - w * 0.28, y, w * 0.56, Math.max(1, rise * 0.14));
    ctx.fillRect(cx - rw, y - rise - 0.5, rw * 2, 1);
  }

  // One storey of the tower: red wall with dark window slits, then its eave.
  function towerTier(ctx, g, c, cx, y, bodyW, bodyH, eaveW, windows) {
    const u = g.U;
    ctx.fillStyle = c.wall;
    ctx.fillRect(cx - bodyW / 2, y - bodyH, bodyW, bodyH);
    ctx.fillStyle = c.post;
    const n = 4;
    for (let i = 0; i <= n; i++) ctx.fillRect(cx - bodyW / 2 + (bodyW - 1) * (i / n), y - bodyH, 1, bodyH);
    ctx.fillStyle = windows;
    for (let i = 0; i < n; i++) {
      const wx = cx - bodyW / 2 + bodyW * ((i + 0.5) / n) - 0.5;
      ctx.fillRect(wx, y - bodyH * 0.8, Math.max(1, u * 0.5), bodyH * 0.55);
    }
    ctx.fillStyle = c.under;
    ctx.fillRect(cx - bodyW / 2 - 1, y - bodyH - u * 0.5, bodyW + 2, u * 0.8);
    eaveRoof(ctx, cx, y - bodyH - u * 0.5, eaveW, u * 3.2, u * 1.4, c.tile, c.edge);
  }

  function paintTower(ctx, g, sky) {
    const u = g.U;
    const c = roofColors(sky);
    const cx = g.W * TOWER.x;
    const glow = hex(mixColor(rgb('#2a1a18'), rgb('#e8b04c'), sky.night * 0.9));
    let y = g.H * TOWER.base;
    // Stepped terrace of red walls and white balustrade under the tower.
    for (let i = 0; i < 3; i++) {
      const w = u * (34 - i * 6);
      ctx.fillStyle = c.wall;
      ctx.fillRect(cx - w / 2, y - u * 2.6, w, u * 2.6);
      ctx.fillStyle = c.marble;
      ctx.fillRect(cx - w / 2 - u * 0.6, y - u * 2.9, w + u * 1.2, Math.max(1, u * 0.5));
      ctx.fillStyle = c.post;
      for (let k = 0; k * u * 2.2 < w; k++) ctx.fillRect(cx - w / 2 + k * u * 2.2, y - u * 2.4, 1, u * 2);
      y -= u * 2.9;
    }
    // Octagonal tower: three tiers narrowing upward.
    const tiers = [[16, 5.2, 24], [13, 5, 20], [10, 4.6, 16]];
    for (const t of tiers) {
      towerTier(ctx, g, c, cx, y, u * t[0], u * t[1], u * t[2], glow);
      y -= u * (t[1] + 3.2);
    }
    // Top roof with a gold finial.
    eaveRoof(ctx, cx, y + u * 1.6, u * 12, u * 4.6, u * 1.6, c.tile, c.edge);
    ctx.fillStyle = c.gold;
    ctx.fillRect(cx - 0.5, y - u * 4.5, Math.max(1, u * 0.4), u * 2.4);
    blob(ctx, cx, y - u * 4.8, u * 0.7, u * 0.8);
  }

  // Smaller halls climbing the slope on each side of the tower.
  function paintSlopeHalls(ctx, g, sky) {
    const u = g.U;
    const c = roofColors(sky);
    const spots = [[0.2, 0.52, 7], [0.4, 0.5, 7], [0.1, 0.56, 6], [0.5, 0.55, 6]];
    for (const s of spots) {
      const cx = g.W * s[0];
      const by = g.H * s[1];
      const w = u * s[2];
      ctx.fillStyle = c.wall;
      ctx.fillRect(cx - w * 0.38, by - u * 2.4, w * 0.76, u * 2.4);
      ctx.fillStyle = c.under;
      ctx.fillRect(cx - w * 0.42, by - u * 2.8, w * 0.84, u * 0.6);
      eaveRoof(ctx, cx, by - u * 2.8, w * 1.1, u * 2.2, u * 0.9, c.tile, c.edge);
    }
  }

  // ---- corridor ----------------------------------------------------------

  function painted(ctx, x0, x1, y, h, c, g) {
    ctx.fillStyle = c.under;
    ctx.fillRect(x0, y, x1 - x0, h);
    const step = Math.max(3, g.U * 1.6);
    for (let x = x0 + 1; x < x1 - 2; x += step) {
      ctx.fillStyle = c.wall;
      ctx.fillRect(x, y + h * 0.3, Math.max(1, step * 0.4), Math.max(1, h * 0.4));
      ctx.fillStyle = c.gold;
      ctx.fillRect(x + step * 0.55, y + h * 0.4, 1, Math.max(1, h * 0.2));
    }
  }

  function paintCorridor(ctx, g, sky) {
    const u = g.U;
    const c = roofColors(sky);
    const x0 = g.W * CORRIDOR[0];
    const x1 = g.W * CORRIDOR[1];
    const floor = g.wy - u * 0.5;
    const post = u * 5.2;
    // Dark interior behind the columns.
    ctx.fillStyle = c.dark;
    ctx.fillRect(x0, floor - post, x1 - x0, post);
    // Columns and a low red rail between them.
    ctx.fillStyle = c.post;
    for (let x = x0; x < x1; x += u * 2.4) ctx.fillRect(x, floor - post, Math.max(1, u * 0.55), post);
    ctx.fillStyle = c.wall;
    ctx.fillRect(x0, floor - u * 1.4, x1 - x0, u * 0.7);
    // Painted beam band and the long tiled roof.
    painted(ctx, x0, x1, floor - post - u * 1.8, u * 1.8, c, g);
    ctx.fillStyle = c.edge;
    ctx.fillRect(x0 - u, floor - post - u * 2.6, x1 - x0 + u * 2, u * 0.9);
    ctx.fillStyle = c.tile;
    poly(ctx, [x0 - u, floor - post - u * 2.6, x0 + u * 0.8, floor - post - u * 4.6, x1 - u * 0.8, floor - post - u * 4.6, x1 + u, floor - post - u * 2.6]);
    ctx.fillStyle = c.edge;
    ctx.fillRect(x0 + u * 0.8, floor - post - u * 4.7, x1 - x0 - u * 1.6, 1);
    // Four halls break the line with taller double roofs.
    for (const f of HALLS) {
      const cx = g.W * f;
      const w = u * 9;
      ctx.fillStyle = c.wall;
      ctx.fillRect(cx - w * 0.36, floor - u * 7.4, w * 0.72, u * 7.4);
      ctx.fillStyle = c.dark;
      ctx.fillRect(cx - w * 0.22, floor - u * 6.2, w * 0.44, u * 5.7);
      ctx.fillStyle = c.under;
      ctx.fillRect(cx - w * 0.42, floor - u * 8.2, w * 0.84, u * 0.8);
      eaveRoof(ctx, cx, floor - u * 8.2, w * 1.2, u * 3, u * 1.3, c.tile, c.edge);
      eaveRoof(ctx, cx, floor - u * 11.6, w * 0.8, u * 2.6, u * 1.1, c.tile, c.edge);
    }
    // Stone shore with a white balustrade.
    ctx.fillStyle = tone(sky, '#9a9688', 0.15, 0.5);
    ctx.fillRect(x0 - u, floor, x1 - x0 + u * 2, g.wy - floor + u * 0.6);
    ctx.fillStyle = c.marble;
    ctx.fillRect(x0 - u, floor + u * 0.1, x1 - x0 + u * 2, Math.max(1, u * 0.4));
  }

  // ---- bridge and island hall -------------------------------------------

  function paintIsleHall(ctx, g, sky) {
    const u = g.U;
    const c = roofColors(sky);
    const cx = g.W * ISLE;
    const by = ridgeIsle(g, cx) + u * 1.2;
    ctx.fillStyle = c.marble;
    ctx.fillRect(cx - u * 8, by - u * 1.2, u * 16, u * 1.2);
    ctx.fillStyle = c.wall;
    ctx.fillRect(cx - u * 4.8, by - u * 4.6, u * 9.6, u * 3.4);
    ctx.fillStyle = c.dark;
    ctx.fillRect(cx - u * 3, by - u * 4, u * 6, u * 2.8);
    ctx.fillStyle = c.post;
    for (let i = 0; i <= 4; i++) ctx.fillRect(cx - u * 4.8 + i * u * 2.4, by - u * 4.6, Math.max(1, u * 0.5), u * 3.4);
    ctx.fillStyle = c.under;
    ctx.fillRect(cx - u * 5.4, by - u * 5.2, u * 10.8, u * 0.7);
    eaveRoof(ctx, cx, by - u * 5.2, u * 14, u * 3.6, u * 1.5, c.tile, c.edge);
    eaveRoof(ctx, cx, by - u * 8.6, u * 8.6, u * 3.2, u * 1.3, c.tile, c.edge);
    ctx.fillStyle = c.gold;
    ctx.fillRect(cx - 0.5, by - u * 13.6, 1, u * 2.2);
  }

  function paintBridge(ctx, g, sky) {
    const u = g.U;
    const c = roofColors(sky);
    const x0 = g.W * BRIDGE.from;
    const x1 = g.W * BRIDGE.to;
    const span = x1 - x0;
    const deckAt = (x) => {
      const f = (x - x0) / span;
      return g.wy - u * 4.2 - Math.sin(Math.PI * Math.min(1, Math.max(0, f))) * u * 3;
    };
    // Solid body of the bridge, deck line following a gentle hump.
    ctx.fillStyle = c.marble;
    ctx.beginPath();
    ctx.moveTo(x0, g.wy);
    for (let x = x0; x <= x1; x += 2) ctx.lineTo(x, deckAt(x));
    ctx.lineTo(x1, g.wy);
    ctx.closePath();
    ctx.fill();
    // Seventeen arches, taller at the middle.
    const aw = span / BRIDGE.arches;
    ctx.fillStyle = tone(sky, '#34403e', 0.1, 0.5);
    for (let i = 0; i < BRIDGE.arches; i++) {
      const mx = x0 + aw * (i + 0.5);
      const f = (mx - x0) / span;
      const hh = u * (1.4 + Math.sin(Math.PI * f) * 2.1);
      ctx.beginPath();
      ctx.ellipse(mx, g.wy, Math.max(1, aw * 0.38), hh, 0, Math.PI, TAU);
      ctx.fill();
    }
    // Balustrade posts along the deck and a darker shadow under it.
    ctx.fillStyle = tone(sky, '#c8c4b4', 0.1, 0.5);
    for (let x = x0; x < x1; x += Math.max(2, u * 0.9)) ctx.fillRect(x, deckAt(x) - u * 1.2, 1, u * 1.2);
    ctx.fillStyle = c.marble;
    for (let x = x0; x < x1; x += 2) ctx.fillRect(x, deckAt(x) - u * 1.3, 2, Math.max(1, u * 0.3));
    ctx.fillStyle = tone(sky, '#8d8a7c', 0.1, 0.5);
    for (let x = x0; x < x1; x += 2) ctx.fillRect(x, deckAt(x) + u * 0.3, 2, Math.max(1, u * 0.4));
    // Small lions' heads sit as dots at each end.
    ctx.fillStyle = c.marble;
    blob(ctx, x0, deckAt(x0) - u * 1.7, u * 0.7, u * 0.8);
    blob(ctx, x1, deckAt(x1) - u * 1.7, u * 0.7, u * 0.8);
  }

  function paintLanterns(ctx, g, sky) {
    if (sky.night < 0.3) return;
    ctx.fillStyle = '#e8b04c';
    ctx.globalAlpha = 0.8 * sky.night;
    const x0 = g.W * CORRIDOR[0];
    const x1 = g.W * CORRIDOR[1];
    for (let x = x0 + g.U * 2; x < x1; x += g.U * 4.8) blob(ctx, x, g.wy - g.U * 4.2, g.U * 0.5, g.U * 0.7);
    ctx.globalAlpha = 1;
  }

  // ---- willows -----------------------------------------------------------

  function paintWillowTrunk(ctx, g, sky) {
    const u = g.U;
    ctx.strokeStyle = tone(sky, '#3a3028', 0.1, 0.6);
    ctx.lineWidth = Math.max(1.5, u * 0.9);
    ctx.beginPath();
    ctx.moveTo(g.W * 0.015, g.wy + u);
    ctx.quadraticCurveTo(g.W * 0.03, g.H * 0.5, g.W * 0.08, g.H * 0.44);
    ctx.stroke();
    ctx.fillStyle = tone(sky, '#6d8250', 0.2, 0.6);
    for (let i = 0; i < 14; i++) {
      blob(ctx, g.W * (0.05 + i * 0.006), g.H * (0.45 + (i % 4) * 0.012), u * 1.4, u * 0.8);
    }
  }

  function makeStrands(g, rand) {
    const out = [];
    for (let i = 0; i < STRANDS; i++) {
      const f = i / STRANDS;
      const x = g.W * (0.04 + f * 0.1);
      out.push({ x, y: g.H * (0.44 + Math.sin(f * 3) * 0.015), len: g.U * (6 + rand() * 9), phase: rand() * TAU });
    }
    return out;
  }

  // ---- bake --------------------------------------------------------------

  function paintWorld(g, sky, rand) {
    const c = layer(g.W, g.wy);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, sky, rand);
    paintHills(ctx, g, sky, rand);
    paintIsleHall(ctx, g, sky);
    paintSlopeHalls(ctx, g, sky);
    paintTower(ctx, g, sky);
    mistBand(ctx, g, sky, g.H * 0.6, g.U * 3, 0.4);
    paintCorridor(ctx, g, sky);
    paintLanterns(ctx, g, sky);
    paintBridge(ctx, g, sky);
    paintWillowTrunk(ctx, g, sky);
    return c;
  }

  function paintLotus(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const spots = [[0.07, 0.9], [0.14, 0.95], [0.9, 0.9], [0.95, 0.97], [0.82, 0.97], [0.03, 0.97]];
    for (const s of spots) {
      const r = g.U * (3 + rand() * 2.5);
      ctx.fillStyle = tone(sky, '#35523a', 0.1, 0.55);
      blob(ctx, g.W * s[0], g.H * s[1], r, r * 0.38);
      ctx.fillStyle = tone(sky, '#58774a', 0.1, 0.5);
      blob(ctx, g.W * s[0] - r * 0.15, g.H * s[1] - r * 0.06, r * 0.7, r * 0.24);
    }
    return c;
  }

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.4);
    const h = Math.ceil(g.H * 0.2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.012, y * 0.06, 4, 17), fbm((x - w) * 0.012, y * 0.06, 4, 17), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 238;
        img.data[i + 1] = 234;
        img.data[i + 2] = 222;
        img.data[i + 3] = smoothstep(0.42, 0.7, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(53);
    state.world = paintWorld(g, sky, rand);
    state.strands = makeStrands(g, rand);
    state.lotus = paintLotus(g, sky, rand);
    state.water = hex(mixColor(mixColor(rgb('#4a6a66'), sky.low, 0.3), rgb('#0e1426'), sky.night * 0.7));
    state.ink = hex(mixColor(rgb('#6d8250'), rgb('#26362c'), sky.night * 0.7));
    state.boatInk = hex(mixColor(rgb('#2a2a30'), rgb('#101420'), sky.night * 0.6));
    state.boatRoof = hex(mixColor(rgb('#b18f3a'), rgb('#2a2a3a'), sky.night * 0.6));
    state.boatWall = hex(mixColor(rgb('#a8402c'), rgb('#2a1a20'), sky.night * 0.6));
    state.glint = hex(mixColor(rgb('#f2ecd6'), sky.low, 0.3));
    state.mistAlpha = 0.5 - sky.night * 0.3;
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.mist;
    const off = -((t * g.U * 2.2) % c.width);
    ctx.globalAlpha = Math.min(1, state.mistAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.3);
    ctx.drawImage(c, off + c.width, g.H * 0.3);
    ctx.drawImage(c, -off * 0.6 - c.width, g.H * 0.52);
    ctx.drawImage(c, -off * 0.6, g.H * 0.52);
    ctx.globalAlpha = 1;
  }

  function drawStrands(ctx, g, t) {
    ctx.strokeStyle = state.ink;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    for (const s of state.strands) {
      const sway = Math.sin(t * 0.9 + s.phase) * g.U * 1.6;
      ctx.moveTo(s.x, s.y);
      ctx.quadraticCurveTo(s.x + sway * 0.4, s.y + s.len * 0.5, s.x + sway, s.y + s.len);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawLake(ctx, g, t) {
    ctx.fillStyle = state.water;
    ctx.fillRect(0, g.wy, g.W, g.H - g.wy);
    const depth = g.H - g.wy;
    const world = state.world;
    ctx.globalAlpha = 0.8;
    for (let y = g.wy; y < g.H; y += ROW) {
      const d = y - g.wy;
      const sy = Math.max(0, g.wy - d * 1.3 - ROW);
      const amp = g.U * (0.2 + 0.9 * (d / depth));
      const dx = Math.sin(t * 0.9 + y * 0.4) * amp;
      ctx.drawImage(world, 0, sy, g.W, ROW, dx, y, g.W, ROW);
    }
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = state.water;
    ctx.fillRect(0, g.wy, g.W, depth);
    ctx.fillStyle = state.glint;
    for (let i = 0; i < GLINTS; i++) {
      const fy = (i * 0.618) % 1;
      const y = g.wy + g.U * 1.5 + fy * (depth - g.U * 3);
      const x = ((i * 37.7 + t * g.U * (0.5 + fy)) % (g.W + 40)) - 20;
      ctx.globalAlpha = 0.35 * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 2.1));
      ctx.fillRect(x, y, g.U * (1.5 + fy * 3), 1);
    }
    ctx.globalAlpha = 1;
  }

  // A two-storey pleasure boat with a yellow tiled roof crosses the open water.
  function drawBoat(ctx, g, t) {
    const p = (t % BOAT_SECONDS) / BOAT_SECONDS;
    const u = g.U;
    const x = lerp(g.W * 1.0, g.W * 0.22, p);
    const y = g.wy + u * 6.5 + Math.sin(t * 0.7) * u * 0.15;
    const edge = Math.min(1, p * 8, (1 - p) * 8);
    ctx.globalAlpha = edge;
    ctx.fillStyle = state.boatInk;
    poly(ctx, [x - u * 7, y - u * 0.8, x - u * 6, y + u * 0.7, x + u * 6, y + u * 0.7, x + u * 7.2, y - u * 1.1]);
    ctx.fillStyle = state.boatWall;
    ctx.fillRect(x - u * 4.6, y - u * 3.6, u * 9.2, u * 2.8);
    ctx.fillStyle = state.boatInk;
    for (let i = 0; i < 4; i++) ctx.fillRect(x - u * 3.6 + i * u * 2.4, y - u * 3, Math.max(1, u * 0.8), u * 1.6);
    ctx.fillStyle = state.boatRoof;
    poly(ctx, [x - u * 6, y - u * 3.4, x - u * 3.6, y - u * 6, x + u * 3.6, y - u * 6, x + u * 6, y - u * 3.4]);
    ctx.globalAlpha = 0.25 * edge;
    ctx.fillStyle = state.boatInk;
    ctx.fillRect(x - u * 6, y + u * 1.1, u * 12, Math.max(1, u * 0.35));
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.mist = paintMist(g);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.world, 0, 0);
    drawMist(ctx, g, t, props.mist);
    drawStrands(ctx, g, t);
    drawLake(ctx, g, t);
    if (props.boat) drawBoat(ctx, g, t);
    ctx.drawImage(state.lotus, 0, 0);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, boat: true, ramp: 'lines', cell: 7, boost: 0.14, gain: 1.1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
