/*
 * 茶室 Chashitsu — a thatched tea hut in a mossy cedar forest.
 *
 * Forest, hut, lantern, basin and path are baked into two layers and repainted
 * once a minute from the clock. Between repaints only steam, light shafts,
 * drifting mist, dust motes, a few maple leaves and the basin drip move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { lerp, mixColor, toHex, parseColor, smoothstep, fbm } = K;

  const GROUND = 0.78;
  const HUT = { x: 0.58, hw: 0.2, peak: 0.27, eave: 0.55 };
  const DOOR = { x: 0.5, w: 0.05, h: 0.075 };
  const RETINT_SECONDS = 60;
  const MAX_PUFFS = 14;
  const MOTES = 26;
  const LEAVES = 7;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  // Mix a base colour toward the sky tint, then toward ink at night.
  function shade(sky, base, amount) {
    const lit = mixColor(rgb(base), sky.amb, amount === undefined ? 0.18 : amount);
    return hex(mixColor(mixColor(lit, rgb('#6f7fa6'), sky.night * 0.22), rgb('#141a2c'), sky.night * 0.36));
  }

  // ---- forest ------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.7);
    grad.addColorStop(0, hex(mixColor(sky.top, sky.haze, 0.35)));
    grad.addColorStop(1, hex(mixColor(sky.low, sky.haze, 0.5)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.4; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    return c;
  }

  // One cedar trunk: straight, slightly tapered, with vertical bark streaks.
  function trunk(ctx, g, sky, rand, cx, w, top, colour, haze) {
    const base = shade(sky, colour);
    ctx.fillStyle = hex(mixColor(rgb(base), sky.haze, haze));
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.42, top);
    ctx.lineTo(cx + w * 0.42, top);
    ctx.lineTo(cx + w * 0.5, g.H);
    ctx.lineTo(cx - w * 0.5, g.H);
    ctx.fill();
    ctx.fillStyle = hex(mixColor(rgb(base), rgb('#0b0f16'), 0.35));
    ctx.globalAlpha = 0.5 * (1 - haze);
    for (let k = 0; k < w / 1.4; k++) ctx.fillRect(cx - w * 0.45 + rand() * w * 0.9, top, 1, g.H - top);
    ctx.globalAlpha = 1;
  }

  function paintForest(ctx, g, sky, rand) {
    const far = [0.05, 0.15, 0.27, 0.42, 0.66, 0.77, 0.9, 0.97];
    for (const f of far) trunk(ctx, g, sky, rand, g.W * f, g.W * 0.018, 0, '#3a4a46', 0.55);
    // A veil of green haze between the far and near trunks.
    const veil = ctx.createLinearGradient(0, 0, 0, g.H * GROUND);
    veil.addColorStop(0, 'rgba(0,0,0,0)');
    veil.addColorStop(1, hex(mixColor(sky.haze, rgb('#7e9a86'), 0.4)).replace('#', '#') + '55');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, g.W, g.H * GROUND);
    const near = [0.02, 0.2, 0.37, 0.8, 0.94];
    const girth = [0.05, 0.034, 0.026, 0.04, 0.055];
    near.forEach((f, i) => trunk(ctx, g, sky, rand, g.W * f, g.W * girth[i], 0, '#2b2a28', 0.0));
    // Canopy: dark cedar crowns along the top with a few gaps for the sky.
    ctx.fillStyle = shade(sky, '#1d3328', 0.1);
    for (let i = 0; i < 70; i++) {
      const cx = rand() * g.W;
      const edge = 0.04 + 0.08 * fbm(cx * 0.03, 3, 3, 7);
      ctx.beginPath();
      ctx.arc(cx, g.H * edge * rand(), g.U * (3 + rand() * 5), 0, 6.3);
      ctx.fill();
    }
    ctx.fillStyle = shade(sky, '#2c4a36', 0.1);
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(rand() * g.W, g.H * 0.06 * rand(), g.U * (1.5 + rand() * 2.5), 0, 6.3);
      ctx.fill();
    }
  }

  function paintMoss(ctx, g, sky) {
    const top = Math.floor(g.H * GROUND - g.U * 2);
    const h = g.H - top;
    const img = ctx.getImageData(0, top, g.W, h);
    const dark = rgb(shade(sky, '#25382a', 0.12));
    const mid = rgb(shade(sky, '#4a6a3c', 0.2));
    const bright = rgb(shade(sky, '#7f9a4c', 0.25));
    for (let yy = 0; yy < h; yy++) {
      const edge = smoothstep(0, g.U * 2, yy);
      for (let xx = 0; xx < g.W; xx++) {
        const v = fbm(xx * 0.13, (yy + top) * 0.2, 3, 41);
        const c = v < 0.5 ? mixColor(dark, mid, v * 2) : mixColor(mid, bright, (v - 0.5) * 2);
        const i = (yy * g.W + xx) * 4;
        const keep = 1 - edge;
        img.data[i] = img.data[i] * keep + c[0] * edge;
        img.data[i + 1] = img.data[i + 1] * keep + c[1] * edge;
        img.data[i + 2] = img.data[i + 2] * keep + c[2] * edge;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, top);
  }

  // ---- hut ---------------------------------------------------------------

  function roofPath(ctx, g) {
    const hx = g.W * HUT.x;
    const hw = g.W * HUT.hw;
    const peak = g.H * HUT.peak;
    const eave = g.H * HUT.eave;
    ctx.beginPath();
    ctx.moveTo(hx - hw * 1.12, eave);
    ctx.quadraticCurveTo(hx - hw * 0.85, eave - (eave - peak) * 0.35, hx - hw * 0.3, peak);
    ctx.lineTo(hx + hw * 0.3, peak);
    ctx.quadraticCurveTo(hx + hw * 0.85, eave - (eave - peak) * 0.35, hx + hw * 1.12, eave);
    ctx.quadraticCurveTo(hx, eave + g.U * 1.2, hx - hw * 1.12, eave);
    ctx.closePath();
  }

  function paintRoof(ctx, g, sky, rand) {
    const hx = g.W * HUT.x;
    const hw = g.W * HUT.hw;
    const peak = g.H * HUT.peak;
    const eave = g.H * HUT.eave;
    ctx.save();
    roofPath(ctx, g);
    ctx.fillStyle = shade(sky, '#7b6a3e', 0.2);
    ctx.fill();
    ctx.clip();
    // Thatch: rows of straw strokes, lighter near the eave, mossy toward the top.
    const strawLight = rgb(shade(sky, '#b39a5c', 0.22));
    const strawDark = rgb(shade(sky, '#5c4a2c', 0.2));
    const moss = rgb(shade(sky, '#55683a', 0.2));
    const count = Math.floor(g.W * g.H * 0.05);
    for (let i = 0; i < count; i++) {
      const sx = hx - hw * 1.15 + rand() * hw * 2.3;
      const sy = peak + rand() * (eave - peak + g.U);
      const f = (sy - peak) / (eave - peak);
      let c = mixColor(strawDark, strawLight, rand() * 0.6 + f * 0.4);
      const patch = fbm(sx * 0.07, sy * 0.09, 3, 17);
      if (patch > 0.6 && f < 0.7) c = mixColor(c, moss, (patch - 0.6) * 2.2);
      ctx.fillStyle = hex(c);
      ctx.fillRect(sx, sy, 1, 1 + rand() * g.U * 1.2);
    }
    // Soft courses where each bundle of straw overlaps the next.
    ctx.fillStyle = hex(mixColor(strawDark, rgb('#0b0f16'), 0.35));
    ctx.globalAlpha = 0.35;
    for (let k = 1; k < 9; k++) {
      const yy = lerp(peak, eave, k / 9);
      ctx.fillRect(hx - hw * 1.2, yy, hw * 2.4, 1);
    }
    ctx.globalAlpha = 1;
    // Deep shadow under the eave edge.
    ctx.fillStyle = hex(mixColor(strawDark, rgb('#0b0f16'), 0.5));
    ctx.fillRect(hx - hw * 1.2, eave - g.U * 0.4, hw * 2.4, g.U * 1.8);
    ctx.restore();
    // Ridge cap with crossed ends, and the small smoke vent roof on top.
    ctx.fillStyle = shade(sky, '#4a3c24', 0.15);
    ctx.fillRect(hx - hw * 0.34, peak - g.U * 0.7, hw * 0.68, g.U * 1.4);
    ctx.fillStyle = shade(sky, '#2c2418', 0.1);
    for (let k = 0; k < 7; k++) ctx.fillRect(hx - hw * 0.32 + k * hw * 0.1, peak - g.U * 0.7, 1, g.U * 1.4);
    const vx = hx + hw * 0.05;
    const vw = hw * 0.34;
    ctx.fillStyle = shade(sky, '#3a2f22', 0.15);
    ctx.fillRect(vx - vw * 0.28, peak - g.U * 3.2, vw * 0.56, g.U * 2.6);
    ctx.fillStyle = shade(sky, '#6a5a38', 0.2);
    ctx.beginPath();
    ctx.moveTo(vx - vw * 0.5, peak - g.U * 2.8);
    ctx.lineTo(vx, peak - g.U * 5);
    ctx.lineTo(vx + vw * 0.5, peak - g.U * 2.8);
    ctx.closePath();
    ctx.fill();
    state.vent = { x: vx, y: peak - g.U * 4.6 };
  }

  function paintWalls(ctx, g, sky, rand) {
    const hx = g.W * HUT.x;
    const hw = g.W * HUT.hw;
    const top = g.H * HUT.eave + g.U * 0.8;
    const bottom = g.H * GROUND;
    const left = hx - hw * 0.92;
    const width = hw * 1.84;
    // Plaster wall with the soft grain of earthen walls.
    ctx.fillStyle = shade(sky, '#b09a6c', 0.2);
    ctx.fillRect(left, top, width, bottom - top);
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < g.W * 1.2; i++) {
      ctx.fillStyle = rand() > 0.5 ? shade(sky, '#6a5a3c', 0.2) : shade(sky, '#d6c79c', 0.2);
      ctx.fillRect(left + rand() * width, top + rand() * (bottom - top), 1 + rand() * 2, 1);
    }
    ctx.globalAlpha = 1;
    // Dark timber sill and posts.
    ctx.fillStyle = shade(sky, '#3a2c20', 0.15);
    ctx.fillRect(left, bottom - g.U * 1.1, width, g.U * 1.1);
    const posts = [0, 0.3, 0.62, 1];
    for (const p of posts) ctx.fillRect(left + width * p - g.U * 0.4, top, g.U * 0.8, bottom - top);
    // Stone footing line.
    ctx.fillStyle = shade(sky, '#5a5a54', 0.2);
    ctx.fillRect(left - g.U * 0.5, bottom - g.U * 0.5, width + g.U, g.U * 0.9);
  }

  function paintDoor(ctx, g, sky) {
    const dx = g.W * DOOR.x;
    const dw = g.W * DOOR.w;
    const dh = g.H * DOOR.h;
    const base = g.H * GROUND - g.U * 0.5;
    ctx.fillStyle = shade(sky, '#3a2c20', 0.15);
    ctx.fillRect(dx - dw * 0.58, base - dh - g.U * 0.9, dw * 1.16, dh + g.U * 0.9);
    ctx.fillStyle = shade(sky, '#8a7048', 0.18);
    ctx.fillRect(dx - dw / 2, base - dh, dw, dh);
    ctx.fillStyle = shade(sky, '#4a3a28', 0.15);
    for (let k = 1; k < 4; k++) ctx.fillRect(dx - dw / 2, base - dh + (dh * k) / 4, dw, 1);
    ctx.fillRect(dx, base - dh, 1, dh);
    // The large flat stone at the sill.
    ctx.fillStyle = shade(sky, '#7a7a74', 0.2);
    ctx.beginPath();
    ctx.ellipse(dx, g.H * GROUND + g.U * 0.8, dw * 0.85, g.U * 1.2, 0, 0, 6.3);
    ctx.fill();
  }

  // Latticed window with bare bamboo and reed showing through the plaster.
  function paintLattice(ctx, g, sky) {
    const hx = g.W * HUT.x;
    const hw = g.W * HUT.hw;
    const wx = hx - hw * 0.35;
    const ww = hw * 0.4;
    const wy = g.H * 0.605;
    const wh = g.H * 0.095;
    ctx.fillStyle = shade(sky, '#6a5a3a', 0.15);
    ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = shade(sky, '#3a2c20', 0.1);
    ctx.fillRect(wx, wy, ww, 1);
    ctx.fillRect(wx, wy + wh - 1, ww, 1);
    ctx.fillStyle = shade(sky, '#c9b98a', 0.2);
    for (let k = 1; k < 5; k++) ctx.fillRect(wx + (ww * k) / 5, wy, 1, wh);
    for (let k = 1; k < 4; k++) ctx.fillRect(wx, wy + (wh * k) / 4, ww, 1);
  }

  // Paper window that glows warm from inside, brighter after dark.
  function paintShoji(ctx, g, sky) {
    const hx = g.W * HUT.x;
    const hw = g.W * HUT.hw;
    const wx = hx + hw * 0.18;
    const ww = hw * 0.62;
    const wy = g.H * 0.595;
    const wh = g.H * 0.115;
    const paper = mixColor(rgb('#e9e0c4'), rgb('#f2c36b'), sky.night);
    ctx.fillStyle = hex(mixColor(paper, sky.amb, 0.1 * (1 - sky.night)));
    ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = shade(sky, '#3a2c20', 0.1);
    ctx.fillRect(wx - 1, wy - 1, ww + 2, 1);
    ctx.fillRect(wx - 1, wy + wh, ww + 2, 1);
    ctx.fillRect(wx - 1, wy, 1, wh);
    ctx.fillRect(wx + ww, wy, 1, wh);
    for (let k = 1; k < 4; k++) ctx.fillRect(wx + (ww * k) / 4, wy, Math.max(1, g.U * 0.2), wh);
    for (let k = 1; k < 3; k++) ctx.fillRect(wx, wy + (wh * k) / 3, ww, 1);
    if (sky.night > 0.1) {
      const glow = ctx.createRadialGradient(wx + ww / 2, wy + wh / 2, 0, wx + ww / 2, wy + wh / 2, ww * 1.2);
      glow.addColorStop(0, `rgba(242,195,107,${0.4 * sky.night})`);
      glow.addColorStop(1, 'rgba(242,195,107,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(wx - ww, wy - wh, ww * 3, wh * 3);
    }
  }

  // ---- garden ------------------------------------------------------------

  function paintPath(ctx, g, sky, rand) {
    const sx = g.W * 0.14;
    const sy = g.H * 0.99;
    const ex = g.W * DOOR.x;
    const ey = g.H * (GROUND + 0.035);
    const n = 9;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const px = lerp(sx, ex, t) + Math.sin(t * 3.1) * g.W * 0.09 * (1 - t);
      const py = lerp(sy, ey, Math.pow(t, 0.85));
      const s = lerp(1, 0.38, t);
      const rw = g.W * 0.05 * s * (0.9 + rand() * 0.25);
      const rh = g.H * 0.028 * s * (0.9 + rand() * 0.25);
      ctx.fillStyle = shade(sky, '#2c3a28', 0.1);
      ctx.beginPath();
      ctx.ellipse(px, py + rh * 0.2, rw * 1.18, rh * 1.25, 0, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = shade(sky, '#8c8a82', 0.22);
      ctx.beginPath();
      ctx.ellipse(px, py, rw, rh, 0, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = shade(sky, '#b2afa2', 0.25);
      ctx.beginPath();
      ctx.ellipse(px - rw * 0.15, py - rh * 0.2, rw * 0.7, rh * 0.5, 0, 0, 6.3);
      ctx.fill();
    }
  }

  function paintLantern(ctx, g, sky) {
    const lx = g.W * 0.3;
    const base = g.H * (GROUND + 0.05);
    const u = g.U;
    const stone = shade(sky, '#8a8880', 0.22);
    const dark = shade(sky, '#5c5a54', 0.2);
    ctx.fillStyle = dark;
    ctx.fillRect(lx - u * 2.2, base - u * 1.2, u * 4.4, u * 1.2);
    ctx.fillStyle = stone;
    ctx.fillRect(lx - u * 0.8, base - u * 6.5, u * 1.6, u * 5.4);
    ctx.fillRect(lx - u * 1.9, base - u * 7.6, u * 3.8, u * 1.1);
    ctx.fillStyle = dark;
    ctx.fillRect(lx - u * 1.6, base - u * 11.4, u * 3.2, u * 3.8);
    const lamp = mixColor(rgb('#26241f'), rgb('#f2c36b'), sky.night);
    ctx.fillStyle = hex(lamp);
    ctx.fillRect(lx - u * 0.9, base - u * 10.6, u * 1.8, u * 2.2);
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.moveTo(lx - u * 3.4, base - u * 11.4);
    ctx.lineTo(lx - u * 0.9, base - u * 14.2);
    ctx.lineTo(lx + u * 0.9, base - u * 14.2);
    ctx.lineTo(lx + u * 3.4, base - u * 11.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(lx - u * 0.5, base - u * 15.2, u, u * 1.1);
    if (sky.night > 0.1) {
      const glow = ctx.createRadialGradient(lx, base - u * 9.5, 0, lx, base - u * 9.5, u * 9);
      glow.addColorStop(0, `rgba(242,195,107,${0.5 * sky.night})`);
      glow.addColorStop(1, 'rgba(242,195,107,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(lx - u * 9, base - u * 19, u * 18, u * 18);
    }
  }

  // Stone basin with a bamboo spout; the drip is drawn per frame.
  function paintBasin(ctx, g, sky) {
    const bx = g.W * 0.84;
    const base = g.H * (GROUND + 0.085);
    const u = g.U;
    ctx.fillStyle = shade(sky, '#6a6a64', 0.2);
    ctx.beginPath();
    ctx.ellipse(bx, base, u * 5.2, u * 1.4, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = shade(sky, '#8a8880', 0.22);
    ctx.fillRect(bx - u * 3.4, base - u * 3.4, u * 6.8, u * 3);
    ctx.fillStyle = hex(mixColor(rgb('#3c5a66'), sky.low, 0.25));
    ctx.beginPath();
    ctx.ellipse(bx, base - u * 3.4, u * 3.4, u * 0.9, 0, 0, 6.3);
    ctx.fill();
    // Bamboo spout on a post, leaning over the basin.
    ctx.fillStyle = shade(sky, '#6f8a4a', 0.2);
    ctx.fillRect(bx - u * 4.6, base - u * 8, u * 0.9, u * 7);
    ctx.save();
    ctx.translate(bx - u * 4.2, base - u * 7.6);
    ctx.rotate(0.12);
    ctx.fillRect(0, 0, u * 4.6, u * 0.9);
    ctx.restore();
    ctx.fillStyle = shade(sky, '#3a4a28', 0.15);
    ctx.fillRect(bx - u * 4.6, base - u * 5, u * 0.9, 1);
    state.drip = { x: bx - u * 0.1, y: base - u * 6.7, to: base - u * 3.4 };
  }

  // Ferns and a maple branch in the foreground corners.
  function paintFoliage(ctx, g, sky, rand) {
    const u = g.U;
    ctx.strokeStyle = shade(sky, '#3c5a34', 0.15);
    ctx.lineWidth = Math.max(1, u * 0.3);
    for (let i = 0; i < 14; i++) {
      const bx = rand() < 0.5 ? rand() * g.W * 0.14 : g.W * (0.88 + rand() * 0.12);
      const by = g.H * (0.95 + rand() * 0.05);
      const len = u * (4 + rand() * 5);
      const dir = bx < g.W * 0.5 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + dir * len * 0.5, by - len, bx + dir * len, by - len * 0.5);
      ctx.stroke();
    }
    const reds = ['#b8412c', '#c25a2c', '#d6452c'];
    for (let i = 0; i < 22; i++) {
      const mx = g.W * (0.04 + rand() * 0.26);
      const my = g.H * (0.04 + rand() * 0.16);
      ctx.fillStyle = shade(sky, reds[Math.floor(rand() * 3)], 0.12);
      ctx.fillRect(mx, my, 1 + rand() * u * 0.8, 1 + rand() * u * 0.6);
    }
  }

  // ---- bake --------------------------------------------------------------

  function paintBack(g, sky, rand) {
    const c = paintSky(g, sky, rand);
    const ctx = c.getContext('2d');
    paintForest(ctx, g, sky, rand);
    paintMoss(ctx, g, sky);
    return c;
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintWalls(ctx, g, sky, rand);
    paintLattice(ctx, g, sky);
    paintShoji(ctx, g, sky);
    paintDoor(ctx, g, sky);
    paintRoof(ctx, g, sky, rand);
    paintPath(ctx, g, sky, rand);
    paintLantern(ctx, g, sky);
    paintBasin(ctx, g, sky);
    paintFoliage(ctx, g, sky, rand);
    return c;
  }

  // Slanted shafts of light from the upper left, one gradient strip each.
  function paintShafts(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const warm = mixColor(rgb('#f3e7c0'), sky.amb, 0.3);
    const shafts = [
      { x: 0.1, w: 0.05 },
      { x: 0.24, w: 0.035 },
      { x: 0.4, w: 0.06 },
      { x: 0.72, w: 0.04 },
      { x: 0.9, w: 0.05 },
    ];
    for (const s of shafts) {
      const x0 = g.W * s.x;
      const w = g.W * s.w;
      const grad = ctx.createLinearGradient(0, 0, 0, g.H * GROUND);
      const col = hex(warm);
      grad.addColorStop(0, col + 'd0');
      grad.addColorStop(1, col + '00');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0 + w, 0);
      ctx.lineTo(x0 + w + g.W * 0.12, g.H * GROUND);
      ctx.lineTo(x0 + g.W * 0.12 - w * 0.2, g.H * GROUND);
      ctx.closePath();
      ctx.fill();
    }
    return c;
  }

  function paintMist(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.02, y * 0.09, 4, 33);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 226;
        img.data[i + 1] = 232;
        img.data[i + 2] = 226;
        img.data[i + 3] = smoothstep(0.42, 0.72, v) * band * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintPuff() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(238,240,236,0.5)');
    grad.addColorStop(1, 'rgba(238,240,236,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(57);
    state.back = paintBack(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.shafts = paintShafts(g, sky);
    state.dim = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawMist(ctx, g, t) {
    const c = state.mist;
    const off = -((t * g.U * 0.9) % c.width);
    const y = g.H * (GROUND - 0.1);
    ctx.globalAlpha = 0.5 - state.dim * 0.3;
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    ctx.globalAlpha = 1;
  }

  function drawShafts(ctx, g, t, amount) {
    if (amount <= 0) return;
    const swell = 0.8 + 0.2 * Math.sin(t * 0.35);
    ctx.globalAlpha = Math.min(1, 0.36 * amount * swell * (1 - state.dim * 0.85));
    ctx.drawImage(state.shafts, Math.sin(t * 0.12) * g.U * 1.5, 0);
    ctx.globalAlpha = 1;
  }

  function drawSteam(ctx, g, t, amount) {
    if (amount <= 0) return;
    const v = state.vent;
    for (let i = 0; i < MAX_PUFFS; i++) {
      const a = (t * 0.06 + i / MAX_PUFFS) % 1;
      const size = g.U * (3 + a * 13);
      const dx = Math.sin(a * 5 + i) * g.U * 1.4 + a * g.U * 9;
      const dy = -a * g.U * 24;
      ctx.globalAlpha = Math.min(1, (1 - a) * smoothstep(0, 0.08, a) * 1.4 * amount);
      ctx.drawImage(state.puff, v.x + dx - size / 2, v.y + dy - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawMotes(ctx, g, t) {
    ctx.fillStyle = '#f3e7c0';
    const m = state.motes;
    for (let i = 0; i < MOTES; i++) {
      const px = m[i * 3] * g.W + Math.sin(t * 0.3 + i) * g.U * 2;
      const py = ((m[i * 3 + 1] + t * 0.012 * (0.5 + m[i * 3 + 2])) % 1) * g.H * GROUND;
      ctx.globalAlpha = (0.25 + 0.5 * Math.abs(Math.sin(t * 0.8 + i * 2))) * (1 - state.dim * 0.8);
      ctx.fillRect(px, py, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawLeaves(ctx, g, t) {
    const l = state.leaves;
    for (let i = 0; i < LEAVES; i++) {
      const a = (t * 0.03 * (0.7 + l[i * 3 + 2]) + l[i * 3 + 1]) % 1;
      const px = l[i * 3] * g.W * 0.5 + a * g.W * 0.18 + Math.sin(t * 1.1 + i * 3) * g.U * 2.5;
      const py = a * g.H * (GROUND + 0.1);
      ctx.fillStyle = i % 2 ? '#b8412c' : '#d9a73a';
      const flip = Math.sin(t * 2 + i) > 0 ? 2 : 1;
      ctx.fillRect(px, py, flip + 1, 3 - flip + 1);
    }
  }

  function drawDrip(ctx, g, t) {
    const d = state.drip;
    const a = (t * 1.1) % 1;
    ctx.fillStyle = '#cfe0e4';
    ctx.globalAlpha = 0.85;
    ctx.fillRect(d.x, lerp(d.y, d.to, a * a), 1, Math.max(1, g.U * 0.5));
    if (a < 0.3) {
      ctx.globalAlpha = 0.6 * (1 - a / 0.3);
      ctx.fillRect(d.x - a * g.U * 4, d.to, a * g.U * 8 + 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.mist = paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.2));
    state.puff = paintPuff();
    const rand = K.rng(91);
    state.motes = new Float32Array(MOTES * 3);
    for (let i = 0; i < state.motes.length; i++) state.motes[i] = rand();
    state.leaves = new Float32Array(LEAVES * 3);
    for (let i = 0; i < state.leaves.length; i++) state.leaves[i] = rand();
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.back, 0, 0);
    drawMist(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawSteam(ctx, g, t, props.smoke);
    drawShafts(ctx, g, t, props.light);
    drawMotes(ctx, g, t);
    drawDrip(ctx, g, t);
    if (props.leaves) drawLeaves(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', smoke: 1, light: 1, leaves: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
