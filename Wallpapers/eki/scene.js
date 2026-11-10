/*
 * 駅 Eki — a tiny country station at dusk.
 *
 * Sky, hills, paddies, station and track are baked into layers and repainted
 * once a minute from the clock. Between repaints only clouds, fireflies,
 * moths, the lamp glow and a clump of pampas grass move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.6;
  const PLATFORM_BACK = 0.77;
  const LAMP = { x: 0.4, base: 0.9, top: 0.55 };
  const RETINT_SECONDS = 60;
  const FLIES = 24;
  const MOTHS = 3;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // 0 in daylight, 1 once the lamp and fireflies are out.
  function dusk(h) {
    return h >= 12 ? smoothstep(16.5, 19, h) : 1 - smoothstep(5.5, 7.5, h);
  }

  // ---- sky and hills -----------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e2d2';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const rand = K.rng(17);
    const count = 6;
    for (let i = 0; i < count; i++) {
      const cx = (i + rand() * 0.6) * (w / count);
      const cy = h * (0.25 + rand() * 0.55);
      const rw = w * (0.06 + rand() * 0.06);
      const rh = h * (0.06 + rand() * 0.07);
      for (const off of [-w, 0, w]) {
        ctx.save();
        ctx.translate(cx + off, cy);
        ctx.scale(rw, rh);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        grad.addColorStop(0, 'rgba(240,226,214,0.8)');
        grad.addColorStop(1, 'rgba(240,226,214,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, 6.3);
        ctx.fill();
        ctx.restore();
      }
    }
    return c;
  }

  function paintHills(ctx, g, sky) {
    const base = g.H * HORIZON;
    const far = mixColor(mixColor(rgb('#5a6a8a'), sky.haze, 0.6), rgb('#1c2238'), sky.night * 0.6);
    const near = mixColor(mixColor(rgb('#34466a'), sky.haze, 0.35), rgb('#141a2c'), sky.night * 0.7);
    const layers = [
      { col: far, top: 0.43, amp: 0.1, seed: 4, freq: 0.012 },
      { col: near, top: 0.5, amp: 0.07, seed: 8, freq: 0.02 },
    ];
    for (const l of layers) {
      ctx.fillStyle = hex(l.col);
      ctx.beginPath();
      ctx.moveTo(0, base + 1);
      for (let x = 0; x <= g.W + 3; x += 3) {
        const y = g.H * l.top - fbm(x * l.freq, 3, 3, l.seed) * g.H * l.amp + g.H * l.amp * 0.4;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(g.W + 3, base + 1);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ---- paddies and trees -------------------------------------------------

  function paintPaddies(ctx, g, sky) {
    const top = g.H * HORIZON;
    const bottom = g.H * 1.0;
    const moss = mixColor(mixColor(rgb('#4f6a3e'), sky.amb, 0.15), rgb('#121a18'), sky.night * 0.7);
    const water = mixColor(sky.low, rgb('#1a2036'), 0.2 + sky.night * 0.3);
    ctx.fillStyle = hex(moss);
    ctx.fillRect(0, top, g.W, bottom - top);
    const bands = 9;
    for (let i = 0; i < bands; i++) {
      const f0 = Math.pow(i / bands, 1.7);
      const f1 = Math.pow((i + 0.78) / bands, 1.7);
      const y0 = top + (bottom - top) * f0;
      const y1 = top + (bottom - top) * f1;
      ctx.fillStyle = hex(i % 2 ? mixColor(water, moss, 0.25) : mixColor(moss, rgb('#c9b25a'), 0.12));
      ctx.fillRect(0, y0, g.W, Math.max(1, y1 - y0));
      ctx.fillStyle = hex(mixColor(moss, rgb('#10140f'), 0.5));
      ctx.fillRect(0, y1, g.W, Math.max(1, g.U * 0.35 * (0.4 + f1)));
    }
  }

  function paintCedar(ctx, x, base, h, col) {
    ctx.fillStyle = col;
    const tiers = 4;
    for (let k = 0; k < tiers; k++) {
      const ty = base - h + (h * k) / tiers;
      const tw = h * (0.12 + 0.07 * k);
      ctx.beginPath();
      ctx.moveTo(x, ty - h * 0.1);
      ctx.lineTo(x + tw, ty + (h / tiers) * 1.3);
      ctx.lineTo(x - tw, ty + (h / tiers) * 1.3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillRect(x - h * 0.015, base - h * 0.1, Math.max(1, h * 0.03), h * 0.1);
  }

  function paintTrees(ctx, g, sky, rand) {
    const col = hex(mixColor(mixColor(rgb('#2f4a34'), sky.haze, 0.2), rgb('#0e1514'), sky.night * 0.75));
    const spots = [0.58, 0.62, 0.66, 0.93, 0.97, 0.7, 0.88];
    for (const f of spots) {
      paintCedar(ctx, g.W * f, g.H * (HORIZON + 0.045 + rand() * 0.03), g.H * (0.1 + rand() * 0.07), col);
    }
    // A utility pole and its wire across the far field.
    const pole = hex(mixColor(rgb('#3a3028'), rgb('#10121a'), sky.night * 0.7));
    ctx.fillStyle = pole;
    const px = g.W * 0.8;
    ctx.fillRect(px, g.H * 0.5, Math.max(1, g.U * 0.5), g.H * 0.17);
    ctx.fillRect(px - g.U * 1.4, g.H * 0.525, g.U * 3.3, Math.max(1, g.U * 0.35));
    ctx.strokeStyle = pole;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(g.W * 0.55, g.H * 0.56);
    ctx.quadraticCurveTo(g.W * 0.68, g.H * 0.585, px, g.H * 0.527);
    ctx.quadraticCurveTo(g.W * 0.92, g.H * 0.55, g.W, g.H * 0.535);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ---- track and platform ------------------------------------------------

  // Centre of the line at depth s (0 = near the bottom edge, 1 = far away).
  function track(g, s) {
    const y = g.H * lerp(1.05, HORIZON + 0.004, Math.pow(s, 0.65));
    const near = (y - g.H * HORIZON) / (g.H * 0.45);
    return { x: g.W * (0.5 + 0.4 * Math.pow(s, 1.5)), y, w: near * g.W * 0.055 };
  }

  function platformStart(g) {
    let s = 0;
    while (s < 1 && track(g, s).y > g.H * PLATFORM_BACK) s += 0.005;
    return s;
  }

  function paintPlatform(ctx, g, sky) {
    const sA = platformStart(g);
    const top = mixColor(mixColor(rgb('#bdb4a0'), sky.amb, 0.25), rgb('#232637'), sky.night * 0.7);
    const side = mixColor(top, rgb('#1c1a20'), 0.45);
    const edge = (s) => {
      const c = track(g, s);
      return { x: c.x - c.w * 1.7, y: c.y };
    };
    ctx.fillStyle = hex(top);
    ctx.beginPath();
    ctx.moveTo(0, g.H * PLATFORM_BACK);
    const a = edge(sA);
    ctx.lineTo(a.x, g.H * PLATFORM_BACK);
    for (let s = sA; s >= 0; s -= 0.02) ctx.lineTo(edge(s).x, edge(s).y);
    ctx.lineTo(edge(0).x, g.H + 2);
    ctx.lineTo(0, g.H + 2);
    ctx.closePath();
    ctx.fill();
    // Stone face of the platform edge and a pale warning line.
    ctx.strokeStyle = hex(side);
    ctx.lineWidth = Math.max(2, g.U * 1.6);
    ctx.beginPath();
    for (let s = sA; s >= 0; s -= 0.02) {
      const e = edge(s);
      if (s === sA) ctx.moveTo(e.x + g.U * 0.6, e.y); else ctx.lineTo(e.x + g.U * 0.6, e.y);
    }
    ctx.stroke();
    ctx.strokeStyle = hex(mixColor(rgb('#d8c9a0'), rgb('#3a3c52'), sky.night * 0.7));
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.beginPath();
    for (let s = sA; s >= 0; s -= 0.02) {
      const e = edge(s);
      const sx = e.x - g.U * 3 * (e.y / g.H - HORIZON);
      if (s === sA) ctx.moveTo(sx, e.y); else ctx.lineTo(sx, e.y);
    }
    ctx.stroke();
  }

  function paintTrack(ctx, g, sky) {
    const ballast = hex(mixColor(mixColor(rgb('#5e5a56'), sky.amb, 0.15), rgb('#14161e'), sky.night * 0.7));
    const tie = hex(mixColor(rgb('#4a3426'), rgb('#12141c'), sky.night * 0.6));
    const rail = hex(mixColor(rgb('#46464e'), sky.low, 0.55));
    let prev = track(g, 0);
    for (let s = 0.01; s <= 1.0001; s += 0.01) {
      const c = track(g, s);
      ctx.fillStyle = ballast;
      ctx.beginPath();
      ctx.moveTo(prev.x - prev.w * 2.2, prev.y);
      ctx.lineTo(prev.x + prev.w * 2.2, prev.y);
      ctx.lineTo(c.x + c.w * 2.2, c.y);
      ctx.lineTo(c.x - c.w * 2.2, c.y);
      ctx.closePath();
      ctx.fill();
      prev = c;
    }
    ctx.strokeStyle = tie;
    for (let s = 0; s < 1; s += 0.028) {
      const c = track(g, Math.pow(s, 1.0));
      ctx.lineWidth = Math.max(1, c.w * 0.22);
      ctx.beginPath();
      ctx.moveTo(c.x - c.w * 1.7, c.y);
      ctx.lineTo(c.x + c.w * 1.7, c.y);
      ctx.stroke();
    }
    ctx.strokeStyle = rail;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      for (let s = 0; s <= 1.0001; s += 0.01) {
        const c = track(g, s);
        const w = c.w * 0.55 * side;
        ctx.lineWidth = Math.max(1, c.w * 0.12);
        if (s === 0) ctx.moveTo(c.x + w, c.y); else ctx.lineTo(c.x + w, c.y);
      }
      ctx.stroke();
    }
  }

  // ---- station -----------------------------------------------------------

  function paintStation(ctx, g, sky, glow, rand) {
    const x0 = g.W * 0.03;
    const x1 = g.W * 0.34;
    const wallTop = g.H * 0.54;
    const wallBot = g.H * PLATFORM_BACK;
    const night = sky.night;
    const wood = mixColor(mixColor(rgb('#5a4030'), sky.amb, 0.15), rgb('#171318'), night * 0.7);
    ctx.fillStyle = hex(wood);
    ctx.fillRect(x0, wallTop, x1 - x0, wallBot - wallTop);
    // Vertical boards.
    ctx.fillStyle = hex(mixColor(wood, rgb('#181210'), 0.4));
    for (let x = x0; x < x1; x += Math.max(2, g.U * 1.3)) ctx.fillRect(x, wallTop, 1, wallBot - wallTop);
    // Plaster band under the eaves.
    ctx.fillStyle = hex(mixColor(mixColor(rgb('#d9d0b8'), sky.amb, 0.3), rgb('#2c2e44'), night * 0.7));
    ctx.fillRect(x0, wallTop, x1 - x0, g.H * 0.035);
    // Window and sliding door, with lattice.
    const lit = mixColor(rgb('#4c4234'), rgb('#e8b45c'), glow);
    const doors = [
      { x: g.W * 0.07, y: g.H * 0.595, w: g.W * 0.08, h: g.H * 0.09 },
      { x: g.W * 0.2, y: g.H * 0.595, w: g.W * 0.1, h: g.H * 0.17 },
    ];
    for (const d of doors) {
      ctx.fillStyle = hex(lit);
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.fillStyle = hex(mixColor(wood, rgb('#120e0c'), 0.5));
      const cols = 4;
      for (let i = 0; i <= cols; i++) ctx.fillRect(d.x + (d.w * i) / cols - 0.5, d.y, Math.max(1, g.U * 0.35), d.h);
      const rows = d.h > g.H * 0.12 ? 6 : 3;
      for (let i = 0; i <= rows; i++) ctx.fillRect(d.x, d.y + (d.h * i) / rows - 0.5, d.w, Math.max(1, g.U * 0.35));
    }
    // Corner posts.
    ctx.fillStyle = hex(mixColor(wood, rgb('#120e0c'), 0.35));
    ctx.fillRect(x0, wallTop, Math.max(2, g.U * 0.9), wallBot - wallTop);
    ctx.fillRect(x1 - Math.max(2, g.U * 0.9), wallTop, Math.max(2, g.U * 0.9), wallBot - wallTop);
    paintRoof(ctx, g, sky, x0, x1, wallTop);
  }

  function paintRoof(ctx, g, sky, x0, x1, wallTop) {
    const tile = mixColor(mixColor(rgb('#3c4660'), sky.haze, 0.2), rgb('#12162a'), sky.night * 0.6);
    const over = g.W * 0.03;
    const topY = g.H * 0.4;
    const eaveY = wallTop + g.H * 0.012;
    ctx.fillStyle = hex(tile);
    ctx.beginPath();
    ctx.moveTo(x0 - over, eaveY + g.U * 0.8);
    ctx.quadraticCurveTo(x0 - over * 0.2, eaveY, x0 + g.W * 0.06, topY + g.H * 0.04);
    ctx.lineTo(x0 + g.W * 0.07, topY);
    ctx.lineTo(x1 - g.W * 0.07, topY);
    ctx.lineTo(x1 - g.W * 0.06, topY + g.H * 0.04);
    ctx.quadraticCurveTo(x1 + over * 0.2, eaveY, x1 + over, eaveY + g.U * 0.8);
    ctx.lineTo(x1 + over - g.U, eaveY + g.U * 1.6);
    ctx.lineTo(x0 - over + g.U, eaveY + g.U * 1.6);
    ctx.closePath();
    ctx.fill();
    // Tile courses and a darker ridge cap.
    ctx.strokeStyle = hex(mixColor(tile, rgb('#0c0e1a'), 0.4));
    ctx.lineWidth = 1;
    for (let r = 1; r < 6; r++) {
      const yy = lerp(topY, eaveY, r / 6);
      ctx.beginPath();
      ctx.moveTo(x0 - over * (r / 6) + g.W * 0.05, yy);
      ctx.lineTo(x1 + over * (r / 6) - g.W * 0.05, yy);
      ctx.stroke();
    }
    ctx.fillStyle = hex(mixColor(tile, rgb('#0c0e1a'), 0.5));
    ctx.fillRect(x0 + g.W * 0.065, topY - g.U * 0.9, x1 - x0 - g.W * 0.13, g.U * 1.2);
    ctx.fillRect(x0 + g.W * 0.06, topY - g.U * 2, g.U * 1.2, g.U * 2.2);
    ctx.fillRect(x1 - g.W * 0.06 - g.U * 1.2, topY - g.U * 2, g.U * 1.2, g.U * 2.2);
    // Eave shadow on the wall.
    ctx.fillStyle = 'rgba(10,8,12,0.35)';
    ctx.fillRect(x0, eaveY + g.U * 1.6, x1 - x0, g.U * 1.4);
  }

  function paintBench(ctx, g, sky) {
    const wood = hex(mixColor(mixColor(rgb('#8a6a46'), sky.amb, 0.2), rgb('#1a1612'), sky.night * 0.65));
    const dark = hex(mixColor(mixColor(rgb('#4a3426'), sky.amb, 0.1), rgb('#0e0c10'), sky.night * 0.6));
    const bx = g.W * 0.06;
    const bw = g.W * 0.12;
    const by = g.H * 0.84;
    ctx.fillStyle = dark;
    ctx.fillRect(bx + bw * 0.08, by, Math.max(2, g.U * 0.9), g.H * 0.05);
    ctx.fillRect(bx + bw * 0.88, by, Math.max(2, g.U * 0.9), g.H * 0.05);
    ctx.fillStyle = wood;
    ctx.fillRect(bx, by - g.U * 0.4, bw, Math.max(2, g.U * 1.2));
    ctx.fillRect(bx, by - g.H * 0.05, bw, Math.max(2, g.U * 0.9));
    ctx.fillRect(bx + bw * 0.1, by - g.H * 0.05, Math.max(1, g.U * 0.6), g.H * 0.05);
    ctx.fillRect(bx + bw * 0.88, by - g.H * 0.05, Math.max(1, g.U * 0.6), g.H * 0.05);
    ctx.fillStyle = dark;
    ctx.fillRect(bx, by + g.U * 0.8, bw, Math.max(1, g.U * 0.35));
  }

  function paintLamp(ctx, g, sky, glow) {
    const lx = g.W * LAMP.x;
    const iron = hex(mixColor(rgb('#2c2a30'), sky.low, 0.15));
    ctx.fillStyle = iron;
    ctx.fillRect(lx - g.U * 0.35, g.H * LAMP.top, Math.max(2, g.U * 0.7), g.H * (LAMP.base - LAMP.top));
    ctx.fillRect(lx - g.U * 1.2, g.H * LAMP.base - g.U * 0.5, g.U * 2.4, g.U * 0.8);
    // Bulb under a conical enamel shade.
    const bulb = mixColor(rgb('#dcd0b0'), rgb('#f6d27a'), glow);
    ctx.fillStyle = hex(bulb);
    ctx.beginPath();
    ctx.arc(lx, g.H * LAMP.top + g.U * 1.6, g.U * 1.3, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = iron;
    ctx.beginPath();
    ctx.moveTo(lx, g.H * LAMP.top - g.U * 1.6);
    ctx.lineTo(lx + g.U * 2.8, g.H * LAMP.top + g.U * 0.6);
    ctx.lineTo(lx - g.U * 2.8, g.H * LAMP.top + g.U * 0.6);
    ctx.closePath();
    ctx.fill();
    // Warm pool of light on the platform.
    if (glow > 0.02) {
      const pool = ctx.createRadialGradient(lx, g.H * 0.92, 0, lx, g.H * 0.92, g.W * 0.14);
      pool.addColorStop(0, `rgba(240,190,100,${0.4 * glow})`);
      pool.addColorStop(1, 'rgba(240,190,100,0)');
      ctx.save();
      ctx.translate(0, g.H * 0.92);
      ctx.scale(1, 0.28);
      ctx.translate(0, -g.H * 0.92);
      ctx.fillStyle = pool;
      ctx.fillRect(lx - g.W * 0.14, g.H * 0.92 - g.W * 0.14, g.W * 0.28, g.W * 0.28);
      ctx.restore();
    }
  }

  // ---- sprites -----------------------------------------------------------

  function paintGlow(size, r, gc, b) {
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const half = size / 2;
    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, `rgba(${r},${gc},${b},0.9)`);
    grad.addColorStop(0.35, `rgba(${r},${gc},${b},0.3)`);
    grad.addColorStop(1, `rgba(${r},${gc},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  function paintReeds(g, sky) {
    const w = Math.ceil(g.W * 0.16);
    const h = Math.ceil(g.H * 0.17);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const rand = K.rng(55);
    const stem = hex(mixColor(mixColor(rgb('#6a7048'), sky.amb, 0.15), rgb('#141a16'), sky.night * 0.7));
    const plume = hex(mixColor(mixColor(rgb('#c8b890'), sky.amb, 0.25), rgb('#4a4a5a'), sky.night * 0.6));
    for (let i = 0; i < 16; i++) {
      const x = w * (0.1 + rand() * 0.8);
      const top = h * (0.02 + rand() * 0.45);
      const lean = (rand() - 0.5) * w * 0.18;
      ctx.strokeStyle = stem;
      ctx.lineWidth = Math.max(1, g.U * 0.35);
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.quadraticCurveTo(x + lean * 0.3, h * 0.6, x + lean, top);
      ctx.stroke();
      ctx.strokeStyle = plume;
      ctx.lineWidth = Math.max(1.5, g.U * 0.8);
      ctx.beginPath();
      ctx.moveTo(x + lean, top);
      ctx.lineTo(x + lean * 1.2, top + h * 0.18);
      ctx.stroke();
    }
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function paintFront(g, sky, glow) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const rand = K.rng(31);
    paintHills(ctx, g, sky);
    paintPaddies(ctx, g, sky);
    paintTrees(ctx, g, sky, rand);
    paintTrack(ctx, g, sky);
    paintPlatform(ctx, g, sky);
    paintStation(ctx, g, sky, glow, rand);
    paintBench(ctx, g, sky);
    paintLamp(ctx, g, sky, glow);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(7);
    const glow = dusk(sky.hour);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky, glow);
    state.reeds = paintReeds(g, sky);
    state.glow = glow;
    state.cloudAlpha = 0.6 - sky.night * 0.4;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 0.9) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.05);
    ctx.drawImage(c, off + c.width, g.H * 0.05);
    ctx.globalAlpha = 1;
  }

  function drawReeds(ctx, g, t) {
    const c = state.reeds;
    const x0 = g.W * 0.84;
    const y0 = g.H - c.height + g.U * 2;
    for (let s = 0; s < c.height; s++) {
      const k = 1 - s / c.height;
      const sway = Math.sin(t * 1.1 + s * 0.05) * g.U * 1.6 * k * k;
      ctx.drawImage(c, 0, s, c.width, 1, x0 + sway, y0 + s, c.width, 1);
    }
  }

  function drawFireflies(ctx, g, t, amount) {
    const vis = state.glow * amount;
    if (vis <= 0.02) return;
    const size = g.U * 6;
    for (let i = 0; i < FLIES; i++) {
      const px = g.W * (0.45 + 0.55 * ((i * 0.6180339) % 1)) + Math.sin(t * 0.3 + i * 2.3) * g.W * 0.05;
      const py = g.H * (0.63 + 0.3 * ((i * 0.3819) % 1)) + Math.sin(t * 0.33 + i * 1.7) * g.H * 0.025;
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.7 + i * 1.9);
      ctx.globalAlpha = Math.min(1, vis) * (0.4 + 0.6 * pulse);
      ctx.drawImage(state.fly, px - size / 2, py - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawLamp(ctx, g, t) {
    if (state.glow <= 0.02) return;
    const lx = g.W * LAMP.x;
    const ly = g.H * LAMP.top + g.U * 1.6;
    const size = g.U * 42;
    ctx.globalAlpha = state.glow * (0.8 + 0.06 * Math.sin(t * 0.9));
    ctx.drawImage(state.lampGlow, lx - size / 2, ly - size / 2, size, size);
    ctx.globalAlpha = state.glow * 0.85;
    ctx.fillStyle = '#2a2420';
    const r = Math.max(1, g.U * 0.35);
    for (let i = 0; i < MOTHS; i++) {
      const a = t * (0.9 + i * 0.35) + i * 2.1;
      ctx.fillRect(lx + Math.cos(a) * g.U * (3.5 + i), ly + Math.sin(a * 1.3) * g.U * (2.2 + i * 0.6), r, r);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.3));
    state.fly = paintGlow(24, 236, 214, 120);
    state.lampGlow = paintGlow(64, 240, 190, 100);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t, props.clouds);
    ctx.drawImage(state.front, 0, 0);
    drawReeds(ctx, g, t);
    drawLamp(ctx, g, t);
    drawFireflies(ctx, g, t, props.fireflies);
  }

  Kasuri.run({
    defaults: { time: 'dusk', fireflies: 1, clouds: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
