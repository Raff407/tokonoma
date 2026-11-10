/*
 * 武夷 Wuyi — red sandstone cliffs above the nine-bend river, bamboo rafts
 * drifting through the mist.
 *
 * Sky, cliffs, water, reflections and banks are baked into layers and
 * repainted once a minute from the clock. Between repaints only mist,
 * ripples, two rafts and a pair of egrets move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep, clamp } = K;

  const WATERLINE = 0.625;
  const RAFT_PERIOD = [70, 110];
  const MAX_RIPPLES = 16;
  const RETINT_SECONDS = 60;

  // x0/x1 and top as screen fractions; d is nearness, 0 far to 1 near.
  const MASSIFS = [
    { x0: 0.3, x1: 0.46, top: 0.36, d: 0.0, base: 0.6, seed: 3 },
    { x0: 0.4, x1: 0.6, top: 0.3, d: 0.0, base: 0.6, seed: 4 },
    { x0: 0.58, x1: 0.74, top: 0.35, d: 0.0, base: 0.6, seed: 6 },
    { x0: -0.02, x1: 0.16, top: 0.33, d: 0.05, base: 0.605, seed: 5 },
    { x0: 0.84, x1: 1.0, top: 0.33, d: 0.05, base: 0.605, seed: 8 },
    { x0: 0.12, x1: 0.27, top: 0.22, d: 0.45, base: 0.615, seed: 11 },
    { x0: 0.26, x1: 0.38, top: 0.3, d: 0.5, base: 0.615, seed: 12 },
    { x0: 0.6, x1: 0.77, top: 0.2, d: 0.5, base: 0.615, seed: 14 },
    { x0: 0.75, x1: 0.89, top: 0.29, d: 0.55, base: 0.615, seed: 15 },
    { x0: -0.03, x1: 0.13, top: 0.25, d: 1.0, base: 0.63, seed: 17 },
    { x0: 0.87, x1: 1.04, top: 0.08, d: 1.0, base: 0.635, seed: 21 },
  ];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  // Lit by the sky by day, sunk toward indigo ink at night.
  function lit(sky, c, k) {
    const day = mixColor(c, sky.amb, k * (1 - sky.night));
    return mixColor(day, rgb('#10142a'), sky.night * 0.72);
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * WATERLINE);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(mixColor(sky.low, rgb('#e8e0cc'), 0.45 * (1 - sky.night))));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e8e0cc';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.12 + rand() * 0.4);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintLuminary(ctx, g, sky);
    return c;
  }

  function disc(ctx, cx, cy, r, color, halo) {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * halo);
    grad.addColorStop(0, color);
    grad.addColorStop(0.2, color);
    grad.addColorStop(1, 'rgba(232,224,204,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r * halo, cy - r * halo, r * halo * 2, r * halo * 2);
  }

  function paintLuminary(ctx, g, sky) {
    if (sky.night < 0.6) {
      const st = S.sunT(sky.hour);
      const sx = g.W * lerp(0.12, 0.88, st);
      const sy = g.H * (0.34 - 0.2 * Math.sin(st * Math.PI));
      ctx.globalAlpha = 0.85 * (1 - sky.night);
      disc(ctx, sx, sy, g.U * 3.4, '#f0d9a0', 3.2);
    } else {
      const mt = S.moonT(sky.hour);
      const mx = g.W * lerp(0.15, 0.85, mt);
      const my = g.H * (0.34 - 0.2 * Math.sin(mt * Math.PI));
      ctx.globalAlpha = 0.9 * sky.night;
      disc(ctx, mx, my, g.U * 2.4, '#e8e0cc', 2.6);
    }
    ctx.globalAlpha = 1;
  }

  // ---- cliffs ------------------------------------------------------------

  function cliffTop(g, m, gx, u) {
    const e = Math.min(u, 1 - u);
    const sh = smoothstep(0, 0.24, e);
    const round = (1 - sh) * (1 - sh) * g.H * 0.1;
    const step = Math.floor(fbm(gx * 0.03, m.seed, 2, m.seed) * 3.2) * g.U * 0.7;
    return m.top * g.H + round + step + (u - 0.5) * g.U * 1.6;
  }

  function rockPixel(g, sky, m, gx, y, u, v, top) {
    const stria = fbm(gx * 0.9, y * 0.02, 2, m.seed + 3);
    const grain = fbm(gx * 0.5, y * 0.035, 2, m.seed + 1);
    let col = mixColor(rgb('#86503a'), rgb('#c46c48'), stria * 0.7 + grain * 0.3);
    const band = Math.sin((y / g.U) * 1.9 + fbm(gx * 0.05, 0, 2, m.seed) * 6) * 0.5 + 0.5;
    col = mixColor(col, rgb('#b98f5c'), 0.16 * band);
    const moss = fbm(gx * 1.1, y * 0.01, 2, m.seed + 7);
    if (moss > 0.6 && v > 0.2) col = mixColor(col, rgb('#4f5f38'), clamp((moss - 0.6) * 3, 0, 0.6));
    const edge = Math.min(u, 1 - u);
    const face = 1.3 - 0.34 * u - 0.12 * v - (edge < 0.025 ? 0.14 : 0);
    col = col.map((c) => c * face);
    const cap = g.U * (1 + fbm(gx * 0.4, 5, 2, m.seed) * 1.6);
    if (y < top + cap) col = mixColor(rgb('#46602f'), rgb('#2c3b27'), fbm(gx * 0.6, y * 0.4, 2, m.seed));
    col = lit(sky, col, 0.2);
    const haze = (1 - m.d) * 0.5 + smoothstep(0.75, 1, v) * 0.25;
    return mixColor(col, sky.haze, clamp(haze, 0, 0.9));
  }

  function paintPine(ctx, g, sky, px, py, s) {
    ctx.strokeStyle = hex(lit(sky, rgb('#3a2c24'), 0.2));
    ctx.lineWidth = Math.max(1, s * 0.22);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + s * 0.4, py - s * 1.6, px, py - s * 3);
    ctx.stroke();
    ctx.fillStyle = hex(lit(sky, rgb('#2c4028'), 0.2));
    const tiers = [[0.7, -1.4, 2.1], [-0.5, -2.3, 1.7], [0.1, -3.1, 1.2]];
    for (const t of tiers) {
      ctx.beginPath();
      ctx.ellipse(px + t[0] * s, py + t[1] * s, t[2] * s, s * 0.5, 0, 0, 6.3);
      ctx.fill();
    }
  }

  function paintMassif(g, sky, m) {
    const x0 = Math.floor(m.x0 * g.W);
    const bw = Math.ceil((m.x1 - m.x0) * g.W);
    const yTop = Math.max(0, Math.floor(m.top * g.H - g.H * 0.02));
    const base = Math.ceil(m.base * g.H);
    const h = base - yTop;
    const c = layer(bw, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(bw, h);
    const tops = new Float32Array(bw);
    for (let i = 0; i < bw; i++) {
      const gx = x0 + i;
      const u = i / bw;
      const top = cliffTop(g, m, gx, u);
      tops[i] = top;
      for (let y = Math.max(0, Math.floor(top)); y < base; y++) {
        const v = (y - top) / Math.max(1, base - top);
        const px = rockPixel(g, sky, m, gx, y, u, v, top);
        const k = ((y - yTop) * bw + i) * 4;
        img.data[k] = px[0];
        img.data[k + 1] = px[1];
        img.data[k + 2] = px[2];
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    if (m.d >= 0.5) paintCrown(ctx, g, sky, m, tops, yTop);
    return { c, x: x0, y: yTop };
  }

  // Pines and tea bushes along the flat top.
  function paintCrown(ctx, g, sky, m, tops, yTop) {
    const rand = K.rng(m.seed * 13);
    const s = g.U * (0.8 + m.d * 0.5);
    for (let i = Math.floor(g.U * 3); i < tops.length - g.U * 3; i += Math.floor(g.U * (3 + rand() * 5))) {
      if (rand() < 0.45) paintPine(ctx, g, sky, i, tops[i] - yTop + s * 0.4, s);
    }
    ctx.fillStyle = hex(lit(sky, rgb('#587040'), 0.2));
    for (let i = 0; i < tops.length; i += 2) {
      ctx.fillRect(i, tops[i] - yTop - 1, 2, 1.4);
    }
  }

  function paintCliffs(ctx, g, sky) {
    for (const m of MASSIFS) {
      const p = paintMassif(g, sky, m);
      ctx.drawImage(p.c, p.x, p.y);
    }
  }

  // ---- water -------------------------------------------------------------

  function paintWater(ctx, g, sky, plate) {
    const base = Math.round(g.H * WATERLINE);
    const grad = ctx.createLinearGradient(0, base, 0, g.H);
    grad.addColorStop(0, hex(lit(sky, mixColor(sky.low, rgb('#4a7088'), 0.4), 0.3)));
    grad.addColorStop(1, hex(lit(sky, rgb('#2c4858'), 0.2)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, base, g.W, g.H - base);
    const span = g.H - base;
    for (let y = base; y < g.H; y++) {
      const sy = base - (y - base) * 1.5;
      if (sy < 0) break;
      ctx.globalAlpha = 0.5 * (1 - ((y - base) / span) * 0.75);
      const wob = Math.sin(y * 0.9) * g.U * 0.4;
      ctx.drawImage(plate, 0, sy, g.W, 1, wob, y, g.W, 1);
    }
    ctx.globalAlpha = 1;
    paintShoal(ctx, g, sky);
  }

  // A pale gravel spit in the middle of the river.
  function paintShoal(ctx, g, sky) {
    const cx = g.W * 0.58;
    const cy = g.H * 0.715;
    ctx.fillStyle = hex(lit(sky, rgb('#b3a384'), 0.3));
    ctx.beginPath();
    ctx.ellipse(cx, cy, g.U * 11, g.U * 0.9, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = hex(lit(sky, rgb('#7f8a5a'), 0.3));
    ctx.beginPath();
    ctx.ellipse(cx - g.U * 3, cy - g.U * 0.5, g.U * 4, g.U * 0.7, 0, 0, 6.3);
    ctx.fill();
  }

  // ---- foreground banks --------------------------------------------------

  function bankLeft(ctx, g) {
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.7);
    ctx.bezierCurveTo(g.W * 0.1, g.H * 0.72, g.W * 0.2, g.H * 0.8, g.W * 0.3, g.H * 0.86);
    ctx.bezierCurveTo(g.W * 0.36, g.H * 0.9, g.W * 0.38, g.H * 0.96, g.W * 0.44, g.H);
    ctx.lineTo(0, g.H);
    ctx.closePath();
  }

  function bankRight(ctx, g) {
    ctx.beginPath();
    ctx.moveTo(g.W, g.H * 0.7);
    ctx.bezierCurveTo(g.W * 0.92, g.H * 0.74, g.W * 0.84, g.H * 0.82, g.W * 0.74, g.H * 0.9);
    ctx.bezierCurveTo(g.W * 0.68, g.H * 0.94, g.W * 0.66, g.H * 0.98, g.W * 0.62, g.H);
    ctx.lineTo(g.W, g.H);
    ctx.closePath();
  }

  function fillBank(ctx, g, sky, path, y0) {
    const grad = ctx.createLinearGradient(0, y0, 0, g.H);
    grad.addColorStop(0, hex(lit(sky, rgb('#506a3c'), 0.25)));
    grad.addColorStop(1, hex(lit(sky, rgb('#2c3c2a'), 0.15)));
    path(ctx, g);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Rows of rounded tea bushes stepping down the right slope.
  function paintTea(ctx, g, sky) {
    ctx.save();
    bankRight(ctx, g);
    ctx.clip();
    const dark = hex(lit(sky, rgb('#2b4026'), 0.2));
    const light = hex(lit(sky, rgb('#6f8a45'), 0.25));
    const step = g.U * 2.1;
    for (let y = g.H * 0.74; y < g.H; y += g.U * 2.6) {
      const edge = g.W * (1 - smoothstep(g.H * 0.7, g.H, y) * 0.4) - g.U * 2;
      for (let x = edge; x < g.W + step; x += step) {
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.ellipse(x, y, step * 0.62, g.U * 1.1, 0, 0, 6.3);
        ctx.fill();
        ctx.fillStyle = light;
        ctx.beginPath();
        ctx.ellipse(x, y - g.U * 0.35, step * 0.5, g.U * 0.6, 0, 0, 6.3);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // A small tiled hut with upturned eaves, set among the bamboo.
  function paintHut(ctx, g, sky, px, py) {
    const u = g.U;
    ctx.fillStyle = hex(lit(sky, rgb('#e8e0cc'), 0.3));
    ctx.fillRect(px - u * 5, py - u * 4.5, u * 10, u * 4.5);
    ctx.fillStyle = hex(lit(sky, rgb('#5a3a2c'), 0.2));
    for (const f of [-5, -1.5, 1.5, 5]) ctx.fillRect(px + u * f - 0.5, py - u * 4.5, Math.max(1, u * 0.5), u * 4.5);
    ctx.fillStyle = hex(lit(sky, rgb('#23262b'), 0.2));
    ctx.fillRect(px - u * 1, py - u * 3.4, u * 2, u * 3.4);
    ctx.beginPath();
    ctx.moveTo(px - u * 9.5, py - u * 5.8);
    ctx.quadraticCurveTo(px - u * 6, py - u * 4.6, px - u * 5.4, py - u * 4.4);
    ctx.lineTo(px + u * 5.4, py - u * 4.4);
    ctx.quadraticCurveTo(px + u * 6, py - u * 4.6, px + u * 9.5, py - u * 5.8);
    ctx.quadraticCurveTo(px + u * 4, py - u * 8.2, px, py - u * 9.2);
    ctx.quadraticCurveTo(px - u * 4, py - u * 8.2, px - u * 9.5, py - u * 5.8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = hex(lit(sky, rgb('#4a4e56'), 0.2));
    ctx.lineWidth = 1;
    for (let k = 1; k < 6; k++) {
      ctx.beginPath();
      ctx.moveTo(px - u * (9 - k * 1.2), py - u * (5.8 + k * 0.4));
      ctx.lineTo(px + u * (9 - k * 1.2), py - u * (5.8 + k * 0.4));
      ctx.stroke();
    }
  }

  function paintBamboo(ctx, g, sky, rand, x0, x1, yBase) {
    const stalk = hex(lit(sky, rgb('#7f9a52'), 0.25));
    const node = hex(lit(sky, rgb('#4d6234'), 0.2));
    const leaf = [hex(lit(sky, rgb('#3f5a30'), 0.2)), hex(lit(sky, rgb('#5f7c3e'), 0.25))];
    const count = Math.round((x1 - x0) / (g.U * 1.7));
    for (let i = 0; i < count; i++) {
      const bx = x0 + rand() * (x1 - x0);
      const top = g.H * (0.2 + rand() * 0.28);
      const lean = (rand() - 0.5) * g.U * 7;
      const by = yBase(bx) + g.U * 1.5;
      ctx.strokeStyle = stalk;
      ctx.lineWidth = Math.max(1, g.U * (0.45 + rand() * 0.25));
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + lean * 0.2, (by + top) / 2, bx + lean, top);
      ctx.stroke();
      ctx.fillStyle = node;
      for (let n = 1; n < 6; n++) {
        const f = n / 6;
        ctx.fillRect(bx + lean * f * f - 1, lerp(by, top, f), Math.max(2, g.U * 0.9), 1);
      }
      for (let n = 0; n < 5; n++) {
        const f = 0.6 + rand() * 0.4;
        const lx = bx + lean * f * f;
        const ly = lerp(by, top, f);
        ctx.fillStyle = leaf[n % 2];
        ctx.beginPath();
        ctx.ellipse(lx + (rand() - 0.5) * g.U * 4, ly + (rand() - 0.5) * g.U * 2, g.U * 2.2, g.U * 0.45, (rand() - 0.5) * 1.4, 0, 6.3);
        ctx.fill();
      }
    }
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    fillBank(ctx, g, sky, bankLeft, g.H * 0.7);
    fillBank(ctx, g, sky, bankRight, g.H * 0.7);
    paintTea(ctx, g, sky);
    ctx.strokeStyle = hex(lit(sky, rgb('#7e9254'), 0.3));
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7;
    bankLeft(ctx, g);
    ctx.stroke();
    ctx.globalAlpha = 1;
    paintHut(ctx, g, sky, g.W * 0.09, g.H * 0.735);
    paintBamboo(ctx, g, sky, rand, g.W * 0.0, g.W * 0.2, (bx) => g.H * (0.72 + 0.07 * smoothstep(0.1 * g.W, 0.3 * g.W, bx)));
    return c;
  }

  // ---- mist --------------------------------------------------------------

  // Wisps that tile sideways. rgb array in, one band of fog out.
  function paintMist(w, h, col, seed, scaleY) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.012, y * scaleY, 4, seed), fbm((x - w) * 0.012, y * scaleY, 4, seed), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = smoothstep(0.34, 0.6, v) * band * 240;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function mistColour(sky) {
    return mixColor(mixColor(rgb('#e8e0cc'), sky.haze, 0.35), rgb('#2a3050'), sky.night * 0.7);
  }

  // ---- rafts -------------------------------------------------------------

  // A bamboo raft seen from the side: three poles, upturned bow, a woven
  // seat and a long punting pole. Nobody aboard.
  function paintRaft(g) {
    const u = g.U;
    const len = Math.round(u * 15);
    const w = len + Math.round(u * 6);
    const h = Math.round(u * 14);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const deck = h - u * 2.4;
    const pole = ['#c4b068', '#a89850', '#8c8040'];
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = pole[k];
      ctx.fillRect(u * 1.5, deck + k * u * 0.7, len, Math.max(1, u * 0.7));
    }
    ctx.strokeStyle = '#c4b068';
    ctx.lineWidth = Math.max(1, u * 0.9);
    ctx.beginPath();
    ctx.moveTo(u * 1.5 + len, deck + u * 0.4);
    ctx.quadraticCurveTo(u * 1.5 + len + u * 2.5, deck + u * 0.4, u * 1.5 + len + u * 3, deck - u * 2.2);
    ctx.stroke();
    ctx.fillStyle = '#6a5a34';
    for (let x = u * 3; x < len; x += u * 3) ctx.fillRect(x, deck, 1, u * 2);
    ctx.fillStyle = '#8c7a46';
    ctx.fillRect(u * 5, deck - u * 1.8, u * 3.2, u * 1.8);
    ctx.fillRect(u * 5, deck - u * 3.6, u * 0.8, u * 1.8);
    ctx.strokeStyle = '#4a5030';
    ctx.lineWidth = Math.max(1, u * 0.4);
    ctx.beginPath();
    ctx.moveTo(u * 11, deck);
    ctx.lineTo(u * 8, deck - u * 11);
    ctx.stroke();
    return c;
  }

  function drawRaft(ctx, g, t, i, scale) {
    const art = state.raft;
    const p = (t / RAFT_PERIOD[i] + i * 0.47) % 1;
    const w = art.width * scale;
    const h = art.height * scale;
    const px = lerp(-w * 1.2, g.W + w * 0.2, p);
    const sway = Math.sin(p * 6.3 * 1.4 + i);
    const cy = g.H * (0.775 - i * 0.075) + sway * g.H * 0.022 + Math.sin(t * 0.9 + i) * g.U * 0.15;
    const top = cy - h + g.U * 2.4 * scale;
    ctx.globalAlpha = 0.28 * (1 - state.dim * 0.4);
    ctx.save();
    ctx.translate(0, cy + g.U * 1.2 * scale);
    ctx.scale(1, -0.55);
    ctx.drawImage(art, px, -cy + g.U * 1.2 * scale - h + g.U * 2.4 * scale, w, h);
    ctx.restore();
    ctx.globalAlpha = 1 - state.dim * 0.35;
    ctx.drawImage(art, px, top, w, h);
    ctx.globalAlpha = 1;
  }

  // ---- birds and ripples -------------------------------------------------

  function drawEgret(ctx, g, t, i) {
    const p = (t / (70 + i * 25) + i * 0.4) % 1;
    const x = lerp(g.W * 1.05, -g.W * 0.05, p);
    const y = g.H * (0.2 + i * 0.07) + Math.sin(p * 9) * g.U * 1.2;
    const flap = Math.sin(t * 3.2 + i * 2) * g.U * 0.9;
    ctx.strokeStyle = state.egret;
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    ctx.beginPath();
    ctx.moveTo(x - g.U * 2, y + flap);
    ctx.lineTo(x, y);
    ctx.lineTo(x + g.U * 2, y + flap);
    ctx.stroke();
  }

  function paintRipple(g) {
    const w = Math.max(4, Math.round(g.U * 5));
    const c = layer(w, 2);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e8e0cc';
    ctx.fillRect(w * 0.15, 0, w * 0.7, 1);
    return c;
  }

  function drawRipples(ctx, g, t) {
    const water = g.H * WATERLINE;
    const span = g.H * 0.3;
    for (let i = 0; i < MAX_RIPPLES; i++) {
      const rx = state.rippleX[i];
      const ry = state.rippleY[i];
      const a = Math.sin(t * 0.5 + state.ripplePhase[i]);
      if (a <= 0) continue;
      ctx.globalAlpha = a * 0.5 * (1 - state.dim * 0.6);
      const sz = 0.5 + ry;
      ctx.drawImage(state.ripple, ((rx + t * 0.004) % 1) * g.W, water + g.H * 0.02 + ry * span, state.ripple.width * sz, 2);
    }
    ctx.globalAlpha = 1;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(41);
    const plate = layer(g.W, g.H);
    const pc = plate.getContext('2d');
    pc.drawImage(paintSky(g, sky, rand), 0, 0);
    paintCliffs(pc, g, sky);
    const full = layer(g.W, g.H);
    const fc = full.getContext('2d');
    fc.drawImage(plate, 0, 0);
    paintWater(fc, g, sky, plate);
    state.back = full;
    state.front = paintFront(g, sky, rand);
    const col = mistColour(sky);
    state.mistHigh = paintMist(Math.ceil(g.W * 1.5), Math.ceil(g.H * 0.26), col, 33, 0.05);
    state.mistLow = paintMist(Math.ceil(g.W * 1.5), Math.ceil(g.H * 0.14), col, 57, 0.08);
    state.mistAlpha = 0.9 - sky.night * 0.3;
    state.egret = hex(lit(sky, rgb('#e8e0cc'), 0.3));
    state.dim = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function drawMist(ctx, g, t, art, speed, y, amount) {
    if (amount <= 0) return;
    const off = -((t * g.U * speed) % art.width);
    ctx.globalAlpha = Math.min(1, state.mistAlpha * amount);
    ctx.drawImage(art, off, y);
    ctx.drawImage(art, off + art.width, y);
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.raft = paintRaft(g);
    state.ripple = paintRipple(g);
    const rand = K.rng(77);
    state.rippleX = new Float32Array(MAX_RIPPLES);
    state.rippleY = new Float32Array(MAX_RIPPLES);
    state.ripplePhase = new Float32Array(MAX_RIPPLES);
    for (let i = 0; i < MAX_RIPPLES; i++) {
      state.rippleX[i] = rand();
      state.rippleY[i] = rand();
      state.ripplePhase[i] = rand() * 6.3;
    }
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.back, 0, 0);
    drawMist(ctx, g, t, state.mistHigh, 1.1, g.H * 0.36, props.mist);
    drawRipples(ctx, g, t);
    if (props.raft) {
      drawRaft(ctx, g, t, 1, 1.2);
      drawMist(ctx, g, t, state.mistLow, 1.6, g.H * 0.6, props.mist * 0.8);
      drawRaft(ctx, g, t, 0, 2.2);
    } else {
      drawMist(ctx, g, t, state.mistLow, 1.6, g.H * 0.6, props.mist * 0.8);
    }
    ctx.drawImage(state.front, 0, 0);
    drawMist(ctx, g, t, state.mistLow, 2.1, g.H * 0.78, props.mist * 0.55);
    drawEgret(ctx, g, t, 0);
    drawEgret(ctx, g, t, 1);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, raft: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
