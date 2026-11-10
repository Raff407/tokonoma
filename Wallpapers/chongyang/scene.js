/*
 * 重阳 Chongyang — a hilltop pavilion on the Double Ninth, in autumn.
 *
 * Sky, layered hills, the maple slope, the pavilion and the chrysanthemum
 * bank are baked into two layers and repainted once a minute from the clock.
 * Between repaints only mist, blown leaves, a line of geese and the
 * pavilion lantern move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const TAU = Math.PI * 2;
  const RETINT_SECONDS = 60;
  const HILL_X = 0.64;
  const TOP_Y = 0.5;
  const LEAVES = 44;
  const GEESE = 7;
  const LEAF_TONES = ['#b8412c', '#c8562c', '#d6683c', '#d9a73a', '#8e3a2a'];
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // A colour lit by the sky, pushed toward haze with distance and toward ink at night.
  function tone(sky, h, far) {
    const lit = mixColor(rgb(h), sky.amb, 0.12);
    const hazy = mixColor(lit, sky.haze, far || 0);
    return hex(mixColor(hazy, rgb('#10162a'), sky.night * 0.72));
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.6);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(mixColor(sky.low, rgb('#e8dcc0'), 0.2 * (1 - sky.night))));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.45);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintLuminary(ctx, g, sky);
    return c;
  }

  function paintLuminary(ctx, g, sky) {
    const day = sky.night < 0.5;
    const t = day ? S.sunT(sky.hour) : S.moonT(sky.hour);
    const cx = g.W * (0.12 + 0.5 * t);
    const cy = g.H * (0.3 - Math.sin(t * Math.PI) * 0.17);
    const r = g.U * (day ? 4.2 : 3.4);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3);
    glow.addColorStop(0, day ? 'rgba(244,222,170,0.5)' : 'rgba(220,226,240,0.35)');
    glow.addColorStop(1, 'rgba(244,222,170,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 6);
    ctx.fillStyle = day ? '#f0dcae' : '#e4e6ea';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fill();
  }

  // ---- hills -------------------------------------------------------------

  function hillY(g, k, x) {
    const base = [0.4, 0.46, 0.53][k] * g.H;
    const amp = [0.1, 0.085, 0.07][k] * g.H;
    const f = [0.011, 0.014, 0.017][k];
    return base - fbm(x * f + k * 7, k * 3.1, 3, 40 + k) * amp;
  }

  function paintFarHills(ctx, g, sky) {
    const inks = ['#56688a', '#4a6278', '#3e5a62'];
    const fars = [0.4, 0.28, 0.14];
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = tone(sky, inks[k], fars[k]);
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let px = 0; px <= g.W; px += 2) ctx.lineTo(px, hillY(g, k, px));
      ctx.lineTo(g.W, g.H);
      ctx.fill();
      // A band of mist between the ridges, washi on a fade.
      const top = g.H * [0.42, 0.5, 0.58][k];
      const band = ctx.createLinearGradient(0, top - g.U * 7, 0, top + g.U * 5);
      const m = hex(mixColor(rgb('#ece4d0'), sky.haze, 0.35 + sky.night * 0.2));
      band.addColorStop(0, 'rgba(0,0,0,0)');
      band.addColorStop(0.55, m + (sky.night > 0.5 ? '22' : '40'));
      band.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = band;
      ctx.fillRect(0, top - g.U * 7, g.W, g.U * 12);
    }
  }

  // The pavilion hill: a rounded mound that sweeps down to both sides.
  function moundY(g, x) {
    const u = (x / g.W - HILL_X) / (x / g.W < HILL_X ? 0.5 : 0.42);
    const bump = Math.exp(-u * u * 2.2);
    return lerp(g.H * 0.82, g.H * TOP_Y, bump) + (fbm(x * 0.05, 8, 3, 17) - 0.5) * g.U * 1.6;
  }

  function paintMound(ctx, g, sky) {
    ctx.fillStyle = tone(sky, '#5d5a3a', 0.1);
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let px = 0; px <= g.W; px += 2) ctx.lineTo(px, moundY(g, px));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
  }

  // ---- trees -------------------------------------------------------------

  function canopy(ctx, g, sky, rand, cx, cy, r, hues) {
    for (let i = 0; i < 7; i++) {
      const a = rand() * TAU;
      const d = rand() * r * 0.7;
      const rr = r * (0.4 + rand() * 0.4);
      ctx.fillStyle = tone(sky, hues[Math.floor(rand() * hues.length)], 0.04);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, rr, 0, TAU);
      ctx.fill();
    }
  }

  function paintMaples(ctx, g, sky, rand) {
    const reds = ['#b8412c', '#c8562c', '#a23a28', '#d6683c', '#d9a73a'];
    for (let i = 0; i < 40; i++) {
      const px = rand() * g.W * 0.97;
      if (Math.abs(px / g.W - HILL_X) < 0.12) continue;
      const base = moundY(g, px);
      if (base > g.H * 0.8) continue;
      const cy = base + g.U * (1 + rand() * 7);
      ctx.strokeStyle = tone(sky, '#3a2e26', 0);
      ctx.lineWidth = Math.max(1, g.U * 0.35);
      ctx.beginPath();
      ctx.moveTo(px, cy + g.U * 3);
      ctx.lineTo(px, cy);
      ctx.stroke();
      canopy(ctx, g, sky, rand, px, cy - g.U * 0.5, g.U * (2.2 + rand() * 2), reds);
    }
  }

  function paintPine(ctx, g, sky, rand, px, base, s) {
    ctx.strokeStyle = tone(sky, '#3a2c22', 0);
    ctx.lineWidth = Math.max(1, s * 0.22);
    ctx.beginPath();
    ctx.moveTo(px, base);
    ctx.quadraticCurveTo(px + s * 0.8, base - s * 2.2, px + s * 0.1, base - s * 4.4);
    ctx.stroke();
    const pads = [[0.1, -4.4, 1.5], [-1.1, -3.4, 1.2], [1.2, -2.7, 1.3], [-0.7, -1.7, 1.0]];
    for (const [dx, dy, w] of pads) {
      ctx.fillStyle = tone(sky, rand() < 0.5 ? '#2f4a32' : '#3d5a38', 0);
      ctx.beginPath();
      ctx.ellipse(px + dx * s, base + dy * s, w * s, w * s * 0.42, 0, 0, TAU);
      ctx.fill();
    }
  }

  // ---- pavilion ----------------------------------------------------------

  // One upswept eave: curved lower edge, concave sweep up to a short ridge.
  function eave(ctx, sky, cx, y, hw, rw, rise, lift, drop) {
    ctx.fillStyle = tone(sky, '#4a4f55', 0);
    ctx.beginPath();
    ctx.moveTo(cx - hw, y - lift);
    ctx.bezierCurveTo(cx - hw * 0.5, y + drop, cx + hw * 0.5, y + drop, cx + hw, y - lift);
    ctx.quadraticCurveTo(cx + hw * 0.7, y - rise * 0.25, cx + rw, y - rise);
    ctx.lineTo(cx - rw, y - rise);
    ctx.quadraticCurveTo(cx - hw * 0.7, y - rise * 0.25, cx - hw, y - lift);
    ctx.fill();
    // Tile rows as thin light strokes, then the dark rim under the edge.
    ctx.strokeStyle = tone(sky, '#7a8088', 0);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    for (let f = -0.85; f <= 0.86; f += 0.17) {
      ctx.beginPath();
      ctx.moveTo(cx + rw * f * 0.9, y - rise);
      ctx.lineTo(cx + hw * f, y + drop * 0.55 * (1 - f * f) - lift * Math.abs(f) * 0.9);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = tone(sky, '#22262c', 0);
    ctx.lineWidth = Math.max(1, hw * 0.035);
    ctx.beginPath();
    ctx.moveTo(cx - hw, y - lift);
    ctx.bezierCurveTo(cx - hw * 0.5, y + drop, cx + hw * 0.5, y + drop, cx + hw, y - lift);
    ctx.stroke();
    // Ridge beast tips and a tiny finial at each corner.
    ctx.fillStyle = tone(sky, '#22262c', 0);
    ctx.fillRect(cx - hw - 1, y - lift - 1, 2, 2);
    ctx.fillRect(cx + hw - 1, y - lift - 1, 2, 2);
  }

  function paintPavilion(ctx, g, sky) {
    const cx = g.W * HILL_X;
    const top = g.H * TOP_Y;
    const u = g.U;
    const red = tone(sky, '#a8321f', 0);
    const dark = tone(sky, '#2a2420', 0);
    // Stone platform with a step down toward the path.
    ctx.fillStyle = tone(sky, '#aaa597', 0.05);
    ctx.fillRect(cx - u * 15, top, u * 30, u * 1.8);
    ctx.fillStyle = tone(sky, '#8a8678', 0.05);
    ctx.fillRect(cx - u * 16.5, top + u * 1.8, u * 33, u * 1.4);
    // Back wall dark inside, then four red pillars.
    ctx.fillStyle = tone(sky, '#3a2a24', 0);
    ctx.fillRect(cx - u * 11, top - u * 10.5, u * 22, u * 10.5);
    if (sky.night > 0.2) {
      ctx.fillStyle = `rgba(232,176,88,${0.55 * sky.night})`;
      ctx.fillRect(cx - u * 9, top - u * 9.5, u * 18, u * 8.5);
    }
    ctx.fillStyle = red;
    for (const f of [-11, -3.7, 3.7, 11]) ctx.fillRect(cx + u * f - u * 0.7, top - u * 10.8, u * 1.4, u * 10.8);
    // Balustrade between the pillars.
    ctx.fillStyle = red;
    ctx.fillRect(cx - u * 11, top - u * 3.4, u * 22, Math.max(1, u * 0.45));
    ctx.fillRect(cx - u * 11, top - u * 1.3, u * 22, Math.max(1, u * 0.45));
    ctx.fillStyle = dark;
    for (let f = -10.2; f < 11; f += 1.6) ctx.fillRect(cx + u * f, top - u * 3, 1, u * 1.7);
    // Painted beam: indigo with gold studs, under the lower eave.
    ctx.fillStyle = tone(sky, '#2c4a6e', 0);
    ctx.fillRect(cx - u * 12, top - u * 12.4, u * 24, u * 1.7);
    ctx.fillStyle = tone(sky, '#3c7a5a', 0);
    ctx.fillRect(cx - u * 12, top - u * 12.4, u * 24, Math.max(1, u * 0.35));
    ctx.fillStyle = tone(sky, '#d9a73a', 0);
    for (let f = -11; f < 12; f += 2.2) ctx.fillRect(cx + u * f, top - u * 11.7, Math.max(1, u * 0.35), Math.max(1, u * 0.35));
    eave(ctx, sky, cx, top - u * 12.4, u * 19, u * 7, u * 8.5, u * 4.6, u * 2.2);
    // Upper storey: a small red lantern room and its crown.
    const uy = top - u * 20.4;
    ctx.fillStyle = red;
    ctx.fillRect(cx - u * 5.5, uy - u * 5, u * 11, u * 5.6);
    ctx.fillStyle = tone(sky, '#3a2a24', 0);
    ctx.fillRect(cx - u * 3.6, uy - u * 4.2, u * 7.2, u * 4);
    if (sky.night > 0.2) {
      ctx.fillStyle = `rgba(232,176,88,${0.6 * sky.night})`;
      ctx.fillRect(cx - u * 3.2, uy - u * 3.8, u * 6.4, u * 3.3);
    }
    ctx.fillStyle = tone(sky, '#d9a73a', 0);
    ctx.fillRect(cx - u * 5.5, uy - u * 5.4, u * 11, Math.max(1, u * 0.4));
    eave(ctx, sky, cx, uy - u * 5.4, u * 12.5, u * 2.4, u * 7, u * 3.8, u * 1.6);
    // Ridge finial.
    ctx.fillStyle = tone(sky, '#d9a73a', 0);
    ctx.fillRect(cx - u * 0.35, uy - u * 15.4, Math.max(1, u * 0.7), u * 2.4);
    ctx.beginPath();
    ctx.arc(cx, uy - u * 15.6, u * 0.8, 0, TAU);
    ctx.fill();
  }

  // ---- path and bank -----------------------------------------------------

  function paintPath(ctx, g, sky) {
    const top = g.H * (TOP_Y + 0.045);
    const ink = tone(sky, '#bdb59e', 0.1);
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(g.W * (HILL_X - 0.02), top);
    ctx.bezierCurveTo(g.W * (HILL_X - 0.04), g.H * 0.68, g.W * (HILL_X + 0.16), g.H * 0.72, g.W * (HILL_X + 0.1), g.H);
    ctx.lineTo(g.W * (HILL_X + 0.02), g.H);
    ctx.bezierCurveTo(g.W * (HILL_X + 0.1), g.H * 0.74, g.W * (HILL_X - 0.01), g.H * 0.68, g.W * (HILL_X + 0.02), top);
    ctx.fill();
    ctx.strokeStyle = tone(sky, '#8a8474', 0.1);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 9; i++) {
      const f = 0.1 + i * 0.1;
      const py = lerp(top + g.U * 3, g.H, f);
      const px = g.W * (HILL_X + 0.03 + 0.07 * Math.sin(f * 3.1) * f);
      ctx.beginPath();
      ctx.moveTo(px - g.U * 2 * (0.6 + f), py);
      ctx.lineTo(px + g.U * 2 * (0.6 + f), py);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function paintBloom(ctx, g, sky, rand, px, py, r, gold) {
    const petal = tone(sky, gold ? '#d9a73a' : '#ece4d0', 0);
    const edge = tone(sky, gold ? '#c4862c' : '#c9c2ae', 0);
    ctx.fillStyle = edge;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = petal;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + rand();
      ctx.fillRect(px + Math.cos(a) * r * 0.55 - 0.5, py + Math.sin(a) * r * 0.55 - 0.5, 1.4, 1.4);
    }
    ctx.beginPath();
    ctx.arc(px, py, r * 0.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = tone(sky, gold ? '#8e5a1c' : '#d9a73a', 0);
    ctx.fillRect(px - 0.5, py - 0.5, 1.2, 1.2);
  }

  function paintBank(ctx, g, sky, rand) {
    const top = g.H * 0.8;
    ctx.fillStyle = tone(sky, '#3f4a2c', 0);
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let px = 0; px <= g.W; px += 2) {
      ctx.lineTo(px, top + g.U * 2.2 * Math.sin(px * 0.045 + 1) + (fbm(px * 0.04, 3, 2, 51) - 0.5) * g.U * 3);
    }
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    const clumps = Math.round(g.W * 0.2);
    for (let i = 0; i < clumps; i++) {
      const px = rand() * g.W;
      const f = rand();
      const py = lerp(g.H * 0.83, g.H * 0.99, f);
      const s = g.U * (0.7 + f * 1.4);
      // Dark serrated leaves under the blooms.
      ctx.strokeStyle = tone(sky, rand() < 0.5 ? '#2f4a2c' : '#3f5c34', 0);
      ctx.lineWidth = Math.max(1, s * 0.3);
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(px, py + s);
        ctx.lineTo(px + (k - 1.5) * s * 0.8, py - s * 0.2);
        ctx.stroke();
      }
      const gold = rand() < 0.7;
      paintBloom(ctx, g, sky, rand, px + (rand() - 0.5) * s, py - s * 0.2, s * (0.7 + rand() * 0.4), gold);
      if (rand() < 0.6) paintBloom(ctx, g, sky, rand, px + s * 1.1, py + s * 0.3, s * 0.65, !gold);
    }
  }

  // ---- bake --------------------------------------------------------------

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintFarHills(ctx, g, sky);
    paintMound(ctx, g, sky);
    paintMaples(ctx, g, sky, rand);
    paintPine(ctx, g, sky, rand, g.W * 0.07, g.H * 0.78, g.U * 2.6);
    paintPine(ctx, g, sky, rand, g.W * 0.9, g.H * 0.74, g.U * 2.2);
    paintPath(ctx, g, sky);
    paintPavilion(ctx, g, sky);
    paintBank(ctx, g, sky, rand);
    return c;
  }

  function paintMist(g, sky) {
    const w = Math.ceil(g.W * 1.4);
    const h = Math.ceil(g.H * 0.16);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const tint = mixColor(rgb('#ece4d0'), sky.haze, 0.3 + sky.night * 0.3);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.02, y * 0.09, 3, 61), fbm((x - w) * 0.02, y * 0.09, 3, 61), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = tint[0];
        img.data[i + 1] = tint[1];
        img.data[i + 2] = tint[2];
        img.data[i + 3] = smoothstep(0.45, 0.7, v) * band * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintLeaf(tint) {
    const c = layer(5, 5);
    const ctx = c.getContext('2d');
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.moveTo(0.5, 2.5);
    ctx.lineTo(2.5, 0.5);
    ctx.lineTo(4.5, 2);
    ctx.lineTo(2.5, 4.5);
    ctx.fill();
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(97);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.mist = paintMist(g, sky);
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawMist(ctx, g, t) {
    const m = state.mist;
    const o1 = -((t * g.U * 2.2) % m.width);
    const o2 = -((t * g.U * 3.4 + m.width * 0.5) % m.width);
    ctx.globalAlpha = 0.85 - state.night * 0.4;
    ctx.drawImage(m, o1, g.H * 0.4);
    ctx.drawImage(m, o1 + m.width, g.H * 0.4);
    ctx.globalAlpha = 0.6 - state.night * 0.3;
    ctx.drawImage(m, o2, g.H * 0.6);
    ctx.drawImage(m, o2 + m.width, g.H * 0.6);
    ctx.globalAlpha = 1;
  }

  // Wild geese in a slanting line crossing the upper sky.
  function drawGeese(ctx, g, t) {
    if (state.night > 0.6) return;
    const p = (t * 0.02) % 1;
    const x0 = lerp(-g.W * 0.15, g.W * 1.05, p);
    ctx.fillStyle = '#3a3e4a';
    for (let i = 0; i < GEESE; i++) {
      const side = i % 2 ? 1 : -1;
      const rank = Math.ceil(i / 2);
      const bx = x0 - rank * g.U * 2.6;
      const by = g.H * 0.14 + side * rank * g.U * 1.1 + Math.sin(t * 0.5) * g.U * 0.6;
      const flap = Math.sin(t * 5 + i * 1.3) > 0 ? -1 : 0.6;
      ctx.fillRect(bx, by, 2, 1);
      ctx.fillRect(bx - 1.5, by + flap, 1.5, 1);
      ctx.fillRect(bx + 2, by + flap, 1.5, 1);
    }
  }

  // Leaves tumbling across from the upper right, down to the lower left.
  function drawLeaves(ctx, g, t, amount) {
    const n = Math.min(LEAVES, Math.round(LEAVES * amount * 0.8));
    for (let i = 0; i < n; i++) {
      const seed = i * 0.6180339;
      const life = 8 + (i % 5) * 2.2;
      const a = ((t / life + seed) % 1);
      const x0 = g.W * (0.2 + ((i * 37) % 100) / 100 * 1.0);
      const px = x0 - a * g.W * 0.8 + Math.sin(t * 1.3 + i) * g.U * 1.5;
      const py = g.H * (0.1 + ((i * 53) % 60) / 100) + a * g.H * 0.3 + Math.sin(t * 2 + i * 2) * g.U * 1.4;
      const sprite = state.leafArt[i % state.leafArt.length];
      ctx.globalAlpha = Math.min(1, a * 8, (1 - a) * 8) * (0.95 - state.night * 0.4);
      ctx.drawImage(sprite, px, py, g.U * 2.4, g.U * 2.4);
    }
    ctx.globalAlpha = 1;
  }

  // The hanging lantern at the pavilion's lower eave.
  function drawLantern(ctx, g, t) {
    const cx = g.W * HILL_X;
    const top = g.H * TOP_Y;
    const u = g.U;
    const sway = Math.sin(t * 1.6) * u * 1.1;
    const ax = cx - u * 17;
    const ay = top - u * 9;
    ctx.fillStyle = '#2a2420';
    ctx.fillRect(ax, ay, 1, u * 1.4);
    ctx.fillStyle = '#b8412c';
    ctx.fillRect(ax - u * 0.8 + sway, ay + u * 1.4, u * 1.6, u * 2.2);
    ctx.fillStyle = '#d9a73a';
    ctx.fillRect(ax - u * 0.8 + sway, ay + u * 1.4, u * 1.6, 1);
    ctx.fillRect(ax - u * 0.8 + sway, ay + u * 3.6, u * 1.6, 1);
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.leafArt = LEAF_TONES.map(paintLeaf);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawGeese(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    if (props.mist) drawMist(ctx, g, t);
    drawLantern(ctx, g, t);
    drawLeaves(ctx, g, t, props.leaves);
  }

  Kasuri.run({
    defaults: { time: 'auto', leaves: 1, mist: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
