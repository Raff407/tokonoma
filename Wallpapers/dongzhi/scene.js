/*
 * 冬至 Winter Solstice — a snowy courtyard with a tiled hall, a lit doorway
 * and a pot steaming on a brick stove.
 *
 * Sky and courtyard are baked into two layers and repainted once a minute
 * from the clock. Between repaints only snow, steam and two lanterns move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor } = K;

  const RETINT_SECONDS = 60;
  const MAX_FLAKES = 110;
  const MAX_PUFFS = 14;
  const POT_X = 0.605;
  const LANTERNS = [{ x: 0.215, ph: 0 }, { x: 0.785, ph: 2.1 }];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (rgb) => toHex(rgb);
  const rgb = (h) => parseColor(h);
  const fx = (g, f) => g.W * f;
  const fy = (g, f) => g.H * f;

  // Colour for a lit surface: night pulls it toward deep indigo.
  function dim(sky, h, amount) {
    const base = mixColor(rgb(h), sky.amb, 0.1 * (1 - sky.night));
    return hex(mixColor(base, rgb('#141a2c'), sky.night * (amount === undefined ? 0.6 : amount)));
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.62);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(mixColor(sky.low, rgb('#c8ccd0'), 0.35)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.25; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.4);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    return c;
  }

  // ---- roof --------------------------------------------------------------

  function roofPath(ctx, g) {
    ctx.beginPath();
    ctx.moveTo(fx(g, 0.135), fy(g, 0.385));
    ctx.quadraticCurveTo(fx(g, 0.19), fy(g, 0.375), fx(g, 0.265), fy(g, 0.272));
    ctx.lineTo(fx(g, 0.735), fy(g, 0.272));
    ctx.quadraticCurveTo(fx(g, 0.81), fy(g, 0.375), fx(g, 0.865), fy(g, 0.385));
    ctx.quadraticCurveTo(fx(g, 0.5), fy(g, 0.44), fx(g, 0.135), fy(g, 0.385));
    ctx.closePath();
  }

  function paintRoof(ctx, g, sky) {
    const top = fy(g, 0.272);
    const eave = fy(g, 0.41);
    ctx.save();
    roofPath(ctx, g);
    ctx.fillStyle = dim(sky, '#454b54');
    ctx.fill();
    ctx.clip();
    // Tile rows run from ridge to eave.
    ctx.strokeStyle = dim(sky, '#2a2f38');
    ctx.lineWidth = 1;
    const rows = Math.round(g.W * 0.7 / (g.U * 1.5));
    for (let i = 0; i <= rows; i++) {
      const f = i / rows;
      ctx.beginPath();
      ctx.moveTo(lerp(fx(g, 0.265), fx(g, 0.735), f), top);
      ctx.lineTo(lerp(fx(g, 0.1), fx(g, 0.9), f), eave);
      ctx.stroke();
    }
    // Snow lying on the upper slope with a ragged lower edge.
    ctx.fillStyle = dim(sky, '#ecebe3', 0.45);
    for (let px = 0; px < g.W; px++) {
      const edge = top + (eave - top) * (0.5 + 0.3 * fbm(px * 0.09, 3, 3, 71));
      ctx.fillRect(px, top - 2, 1, edge - top + 2);
    }
    ctx.restore();
    // Ridge with upturned ends, snow along its top.
    ctx.fillStyle = dim(sky, '#23272e');
    ctx.fillRect(fx(g, 0.255), fy(g, 0.262), fx(g, 0.49), fy(g, 0.012));
    ctx.fillRect(fx(g, 0.25), fy(g, 0.245), g.U * 1.6, fy(g, 0.03));
    ctx.fillRect(fx(g, 0.75) - g.U * 1.6, fy(g, 0.245), g.U * 1.6, fy(g, 0.03));
    ctx.fillStyle = dim(sky, '#ecebe3', 0.45);
    ctx.fillRect(fx(g, 0.27), fy(g, 0.255), fx(g, 0.46), fy(g, 0.009));
  }

  function paintEave(ctx, g, sky, rand) {
    ctx.fillStyle = dim(sky, '#1f2a44');
    ctx.fillRect(fx(g, 0.175), fy(g, 0.405), fx(g, 0.65), fy(g, 0.03));
    const band = [dim(sky, '#a8392a'), dim(sky, '#3f6a52'), dim(sky, '#c9a24a'), dim(sky, '#2c4a6e')];
    const step = g.U * 1.7;
    let k = 0;
    for (let px = fx(g, 0.18); px < fx(g, 0.82); px += step) {
      ctx.fillStyle = band[k++ % band.length];
      ctx.fillRect(px, fy(g, 0.412), step * 0.6, fy(g, 0.014));
    }
    ctx.fillStyle = dim(sky, '#5a3a2a');
    ctx.fillRect(fx(g, 0.175), fy(g, 0.432), fx(g, 0.65), Math.max(1, g.U * 0.6));
    rand();
  }

  // ---- hall body ---------------------------------------------------------

  function glowFill(ctx, sky, x0, y0, w, h) {
    const lit = 0.5 + 0.5 * sky.night;
    const grad = ctx.createLinearGradient(0, y0, 0, y0 + h);
    grad.addColorStop(0, hex(mixColor(rgb('#d9a85a'), rgb('#6f6a60'), 1 - lit)));
    grad.addColorStop(1, hex(mixColor(rgb('#f0c274'), rgb('#7c7466'), 1 - lit)));
    ctx.fillStyle = grad;
    ctx.fillRect(x0, y0, w, h);
  }

  function paintWindow(ctx, g, sky, x0, x1) {
    const top = fy(g, 0.47);
    const bottom = fy(g, 0.64);
    const w = fx(g, x1 - x0);
    ctx.fillStyle = dim(sky, '#6b2a22');
    ctx.fillRect(fx(g, x0), top - g.U * 0.8, w, bottom - top + g.U * 1.6);
    glowFill(ctx, sky, fx(g, x0) + g.U * 0.7, top, w - g.U * 1.4, bottom - top);
    ctx.fillStyle = dim(sky, '#6b2a22');
    const cell = g.U * 2.6;
    for (let px = fx(g, x0) + g.U * 0.7 + cell; px < fx(g, x1) - g.U * 0.7; px += cell) ctx.fillRect(px, top, 1, bottom - top);
    for (let py = top + cell; py < bottom; py += cell) ctx.fillRect(fx(g, x0) + g.U * 0.7, py, w - g.U * 1.4, 1);
    ctx.fillRect(fx(g, x0) - g.U * 0.5, bottom, w + g.U, g.U * 0.9);
  }

  function paintDoor(ctx, g, sky) {
    const x0 = fx(g, 0.465);
    const x1 = fx(g, 0.535);
    const top = fy(g, 0.46);
    const bottom = fy(g, 0.735);
    ctx.fillStyle = dim(sky, '#4a2218');
    ctx.fillRect(x0 - g.U * 0.8, top - g.U, x1 - x0 + g.U * 1.6, bottom - top + g.U);
    glowFill(ctx, sky, x0, top, x1 - x0, bottom - top);
    // A dark screen and a low table inside.
    ctx.fillStyle = dim(sky, '#5a3a2a', 0.2);
    ctx.fillRect(x0 + g.U * 0.8, fy(g, 0.56), x1 - x0 - g.U * 1.6, fy(g, 0.17));
    ctx.fillStyle = dim(sky, '#8a3a2c', 0.2);
    ctx.fillRect(x0 + g.U * 0.8, fy(g, 0.56), x1 - x0 - g.U * 1.6, g.U * 0.8);
    // Open door leaves, thrown back against the jambs.
    ctx.fillStyle = dim(sky, '#a8392a');
    ctx.fillRect(x0 - g.U * 0.2, top, g.U * 1.3, bottom - top);
    ctx.fillRect(x1 - g.U * 1.1, top, g.U * 1.3, bottom - top);
    ctx.fillStyle = dim(sky, '#c9a24a');
    for (let py = top + g.U * 2; py < bottom - g.U; py += g.U * 2.4) {
      ctx.fillRect(x0 + g.U * 0.1, py, 1, 1);
      ctx.fillRect(x1 - g.U * 0.5, py, 1, 1);
    }
  }

  function paintBody(ctx, g, sky) {
    ctx.fillStyle = dim(sky, '#43251e');
    ctx.fillRect(fx(g, 0.2), fy(g, 0.435), fx(g, 0.6), fy(g, 0.3));
    paintWindow(ctx, g, sky, 0.215, 0.345);
    paintWindow(ctx, g, sky, 0.365, 0.45);
    paintWindow(ctx, g, sky, 0.55, 0.635);
    paintWindow(ctx, g, sky, 0.655, 0.785);
    paintDoor(ctx, g, sky);
    // Red columns on stone bases.
    for (const f of [0.2, 0.355, 0.46, 0.54, 0.645, 0.8]) {
      ctx.fillStyle = dim(sky, '#a8392a');
      ctx.fillRect(fx(g, f) - g.U * 0.7, fy(g, 0.435), g.U * 1.4, fy(g, 0.3));
      ctx.fillStyle = dim(sky, '#8c8f92');
      ctx.fillRect(fx(g, f) - g.U * 1.1, fy(g, 0.72), g.U * 2.2, fy(g, 0.016));
    }
  }

  function paintPlatform(ctx, g, sky) {
    ctx.fillStyle = dim(sky, '#8c8f92');
    ctx.fillRect(fx(g, 0.17), fy(g, 0.735), fx(g, 0.66), fy(g, 0.028));
    ctx.fillStyle = dim(sky, '#ecebe3', 0.45);
    ctx.fillRect(fx(g, 0.17), fy(g, 0.731), fx(g, 0.66), Math.max(1, g.U * 0.7));
    ctx.fillStyle = dim(sky, '#7a7d80');
    ctx.fillRect(fx(g, 0.44), fy(g, 0.762), fx(g, 0.12), fy(g, 0.014));
    ctx.fillRect(fx(g, 0.42), fy(g, 0.776), fx(g, 0.16), fy(g, 0.014));
  }

  // ---- courtyard ---------------------------------------------------------

  function paintGround(ctx, g, sky, rand) {
    const top = fy(g, 0.762);
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, dim(sky, '#dcdcd4', 0.5));
    grad.addColorStop(1, dim(sky, '#eceae0', 0.45));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    // Brick path running from the steps toward the viewer.
    ctx.beginPath();
    ctx.moveTo(fx(g, 0.43), top);
    ctx.lineTo(fx(g, 0.57), top);
    ctx.lineTo(fx(g, 0.69), g.H);
    ctx.lineTo(fx(g, 0.31), g.H);
    ctx.closePath();
    ctx.fillStyle = dim(sky, '#6a6e74', 0.55);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = dim(sky, '#4a4e54', 0.55);
    ctx.lineWidth = 1;
    for (let r = 0; r < 14; r++) {
      const py = top + (g.H - top) * Math.pow(r / 14, 1.5);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(g.W, py);
      ctx.stroke();
    }
    // Snow settled on the bricks.
    ctx.fillStyle = dim(sky, '#ecebe3', 0.45);
    for (let i = 0; i < 60; i++) {
      const w = g.U * (1.5 + rand() * 4);
      ctx.globalAlpha = 0.7;
      ctx.fillRect(fx(g, 0.3 + rand() * 0.4), top + rand() * (g.H - top), w, Math.max(1, g.U * 0.7));
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // Drifts.
    ctx.fillStyle = dim(sky, '#f4f2ea', 0.4);
    for (let i = 0; i < 14; i++) {
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.ellipse(rand() * g.W, top + g.U * 3 + rand() * (g.H - top - g.U * 4), g.U * (4 + rand() * 8), g.U * (0.8 + rand()), 0, 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Warm light spilling out of the doorway.
    const lit = 0.3 + 0.35 * sky.night;
    const spill = ctx.createRadialGradient(fx(g, 0.5), fy(g, 0.78), 0, fx(g, 0.5), fy(g, 0.78), g.H * 0.3);
    spill.addColorStop(0, `rgba(240,190,110,${lit})`);
    spill.addColorStop(1, 'rgba(240,190,110,0)');
    ctx.fillStyle = spill;
    ctx.fillRect(0, top, g.W, g.H - top);
  }

  function paintMoonGate(ctx, g, sky) {
    const x0 = fx(g, 0.87);
    const top = fy(g, 0.5);
    const wallH = fy(g, 0.762) - top;
    ctx.fillStyle = dim(sky, '#6a6e74', 0.55);
    ctx.fillRect(x0, top, g.W - x0, wallH);
    ctx.strokeStyle = dim(sky, '#575b61', 0.55);
    ctx.lineWidth = 1;
    for (let py = top + g.U * 1.6; py < top + wallH; py += g.U * 1.6) {
      ctx.beginPath();
      ctx.moveTo(x0, py);
      ctx.lineTo(g.W, py);
      ctx.stroke();
    }
    // Tile cap with snow.
    ctx.fillStyle = dim(sky, '#2a2f38');
    ctx.fillRect(x0 - g.U, top - g.U * 1.6, g.W - x0 + g.U, g.U * 1.8);
    ctx.fillStyle = dim(sky, '#ecebe3', 0.45);
    ctx.fillRect(x0 - g.U, top - g.U * 2.4, g.W - x0 + g.U, g.U * 1.1);
    // The round gate and the quiet garden seen through it.
    const cx = fx(g, 0.955);
    const cy = fy(g, 0.665);
    const r = g.H * 0.075;
    ctx.fillStyle = dim(sky, '#aebcc2', 0.4);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.3);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.3);
    ctx.clip();
    ctx.fillStyle = dim(sky, '#ecebe3', 0.45);
    ctx.fillRect(cx - r, cy + r * 0.35, r * 2, r);
    ctx.strokeStyle = dim(sky, '#3f6a52', 0.5);
    ctx.lineWidth = Math.max(1, g.U * 0.6);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.1 + i * r * 0.4, cy + r * 0.4);
      ctx.lineTo(cx - r * 0.3 + i * r * 0.45, cy - r * 0.8);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = dim(sky, '#8c8f92');
    ctx.lineWidth = Math.max(1, g.U * 1.1);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.3);
    ctx.stroke();
  }

  function paintLeftWall(ctx, g, sky) {
    const top = fy(g, 0.57);
    ctx.fillStyle = dim(sky, '#6a6e74', 0.55);
    ctx.fillRect(0, top, fx(g, 0.17), fy(g, 0.762) - top);
    ctx.strokeStyle = dim(sky, '#575b61', 0.55);
    ctx.lineWidth = 1;
    for (let py = top + g.U * 1.6; py < fy(g, 0.762); py += g.U * 1.6) {
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(fx(g, 0.17), py);
      ctx.stroke();
    }
    ctx.fillStyle = dim(sky, '#2a2f38');
    ctx.fillRect(0, top - g.U * 1.6, fx(g, 0.17), g.U * 1.8);
    ctx.fillStyle = dim(sky, '#ecebe3', 0.45);
    ctx.fillRect(0, top - g.U * 2.4, fx(g, 0.17), g.U * 1.1);
  }

  // A plum tree in winter: bare limbs, snow on top, a few red blossoms.
  function limb(ctx, g, sky, rand, x0, y0, ang, len, wid, depth, blossoms) {
    const x1 = x0 + Math.cos(ang) * len;
    const y1 = y0 + Math.sin(ang) * len;
    ctx.strokeStyle = dim(sky, '#2a2420');
    ctx.lineWidth = Math.max(1, wid);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = dim(sky, '#ecebe3', 0.45);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0 - Math.max(1, wid * 0.5));
    ctx.lineTo(x1, y1 - Math.max(1, wid * 0.5));
    ctx.stroke();
    if (depth <= 0) {
      blossoms.push(x1, y1);
      return;
    }
    const kids = depth > 2 ? 2 : 2 + Math.floor(rand() * 2);
    for (let i = 0; i < kids; i++) {
      const bend = (rand() - 0.5) * 1.3 - (i === 0 ? 0.35 : -0.35) * 0.6;
      limb(ctx, g, sky, rand, x1, y1, ang + bend, len * (0.68 + rand() * 0.12), wid * 0.66, depth - 1, blossoms);
    }
  }

  function paintPlum(ctx, g, sky, rand) {
    const blossoms = [];
    const bx = fx(g, 0.085);
    const by = fy(g, 0.93);
    const trunk = g.U * 3.4;
    limb(ctx, g, sky, rand, bx, by, -1.5, g.H * 0.22, trunk, 5, blossoms);
    limb(ctx, g, sky, rand, bx + g.U, by - g.H * 0.12, -0.5, g.H * 0.17, trunk * 0.5, 4, blossoms);
    for (let i = 0; i < blossoms.length; i += 2) {
      ctx.fillStyle = rand() < 0.7 ? dim(sky, '#b8433a', 0.5) : dim(sky, '#e8d9c8', 0.45);
      ctx.fillRect(blossoms[i] - 1, blossoms[i + 1] - 1, 2, 2);
    }
    ctx.fillStyle = dim(sky, '#f4f2ea', 0.4);
    ctx.beginPath();
    ctx.ellipse(bx, by + g.U * 0.5, g.U * 6, g.U * 1.3, 0, 0, 6.3);
    ctx.fill();
  }

  // ---- pot and stove -----------------------------------------------------

  function paintStove(ctx, g, sky) {
    const cx = fx(g, POT_X);
    const base = fy(g, 0.735);
    const w = g.U * 12;
    const h = g.U * 7;
    ctx.fillStyle = dim(sky, '#6a6e74', 0.4);
    ctx.fillRect(cx - w / 2, base - h, w, h);
    ctx.strokeStyle = dim(sky, '#43474d', 0.4);
    ctx.lineWidth = 1;
    for (let py = base - h + g.U * 1.8; py < base; py += g.U * 1.8) {
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, py);
      ctx.lineTo(cx + w / 2, py);
      ctx.stroke();
    }
    // Fire mouth.
    ctx.fillStyle = '#1f1a18';
    ctx.fillRect(cx - g.U * 2, base - g.U * 3.6, g.U * 4, g.U * 3.6);
    ctx.fillStyle = '#c9892f';
    ctx.fillRect(cx - g.U * 1.3, base - g.U * 1.8, g.U * 2.6, g.U * 1.8);
    // The pot: dark iron body, rim, lid set a little askew.
    const py = base - h - g.U * 2.8;
    ctx.fillStyle = dim(sky, '#23272d', 0.3);
    ctx.beginPath();
    ctx.ellipse(cx, py, g.U * 7.2, g.U * 4.6, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = dim(sky, '#3b4048', 0.3);
    ctx.fillRect(cx - g.U * 7.4, py - g.U * 3.2, g.U * 14.8, g.U * 1.2);
    ctx.fillStyle = dim(sky, '#161a20', 0.2);
    ctx.beginPath();
    ctx.ellipse(cx - g.U * 0.5, py - g.U * 3.8, g.U * 5.5, g.U * 1.3, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = dim(sky, '#c9a24a', 0.4);
    ctx.fillRect(cx - g.U * 8.8, py - g.U * 2.4, g.U * 1.4, g.U * 0.9);
    ctx.fillRect(cx + g.U * 7.4, py - g.U * 2.4, g.U * 1.4, g.U * 0.9);
    // Firewood stacked beside the stove.
    ctx.fillStyle = dim(sky, '#5a3a2a');
    for (let i = 0; i < 4; i++) ctx.fillRect(cx + g.U * 7.6, base - g.U * (1 + i * 1.5), g.U * 6, g.U * 1.2);
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintGround(ctx, g, sky, rand);
    paintLeftWall(ctx, g, sky);
    paintMoonGate(ctx, g, sky);
    paintBody(ctx, g, sky);
    paintEave(ctx, g, sky, rand);
    paintRoof(ctx, g, sky);
    paintPlatform(ctx, g, sky);
    paintStove(ctx, g, sky);
    paintPlum(ctx, g, sky, rand);
    return c;
  }

  // ---- sprites -----------------------------------------------------------

  function paintPuff() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(244,242,234,0.6)');
    grad.addColorStop(1, 'rgba(244,242,234,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  function paintGlow() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(240,176,92,0.7)');
    grad.addColorStop(1, 'rgba(240,176,92,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  function paintLantern(g) {
    const w = Math.max(5, Math.round(g.U * 5));
    const h = Math.max(8, Math.round(g.U * 8));
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(w * 0.25, 0, w * 0.5, h * 0.12);
    ctx.fillStyle = '#a8392a';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.5, w / 2, h * 0.36, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#d95a3c';
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.46, w * 0.28, h * 0.24, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#c9a24a';
    ctx.fillRect(w * 0.3, h * 0.84, w * 0.4, h * 0.06);
    ctx.fillRect(w * 0.47, h * 0.9, Math.max(1, w * 0.08), h * 0.1);
    return c;
  }

  function seedFlakes(g) {
    const rand = K.rng(17);
    const f = { x: new Float32Array(MAX_FLAKES), y: new Float32Array(MAX_FLAKES), v: new Float32Array(MAX_FLAKES), p: new Float32Array(MAX_FLAKES), s: new Uint8Array(MAX_FLAKES) };
    for (let i = 0; i < MAX_FLAKES; i++) {
      f.x[i] = rand();
      f.y[i] = rand();
      f.v[i] = 0.03 + rand() * 0.035;
      f.p[i] = rand() * 6.3;
      f.s[i] = rand() < 0.3 ? 2 : 1;
    }
    return f;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(41);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawSteam(ctx, g, t, amount) {
    if (amount <= 0) return;
    const ox = fx(g, POT_X);
    const oy = fy(g, 0.735) - g.U * 15;
    const n = Math.min(MAX_PUFFS, Math.ceil(MAX_PUFFS * Math.min(1, amount * 0.7 + 0.3)));
    for (let i = 0; i < n; i++) {
      const a = (t * 0.11 + i / n) % 1;
      const size = g.U * (3 + a * 11);
      const dx = Math.sin(t * 0.5 + i * 1.7) * g.U * 2 * a + a * g.U * 3;
      const dy = -a * g.U * 24;
      ctx.globalAlpha = Math.min(1, (1 - a) * 0.9 * Math.min(1, amount));
      ctx.drawImage(state.puff, ox + dx - size / 2, oy + dy - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawFire(ctx, g, t) {
    const size = g.U * 14;
    ctx.globalAlpha = 0.5 + 0.12 * Math.sin(t * 2.3) + 0.06 * Math.sin(t * 5.1);
    ctx.drawImage(state.glow, fx(g, POT_X) - size / 2, fy(g, 0.735) - g.U * 3 - size / 2, size, size);
    ctx.globalAlpha = 1;
  }

  function drawLanterns(ctx, g, t) {
    const lit = 0.3 + 0.5 * state.night;
    const size = g.U * 14;
    for (let i = 0; i < LANTERNS.length; i++) {
      const L = LANTERNS[i];
      const sway = Math.sin(t * 0.9 + L.ph) * g.U * 0.5;
      const lx = fx(g, L.x) + sway;
      const ly = fy(g, 0.438);
      ctx.globalAlpha = lit;
      ctx.drawImage(state.glow, lx - size / 2, ly + g.U * 4 - size / 2, size, size);
      ctx.globalAlpha = 1;
      ctx.drawImage(state.lantern, lx - state.lantern.width / 2, ly);
    }
  }

  function drawSnow(ctx, g, t, amount) {
    const f = state.flakes;
    const n = Math.min(MAX_FLAKES, Math.round(MAX_FLAKES * amount * 0.7));
    ctx.fillStyle = '#f4f2ea';
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < n; i++) {
      const py = ((f.y[i] + t * f.v[i]) % 1) * g.H;
      const px = (((f.x[i] + t * 0.004) % 1) * g.W) + Math.sin(t * 0.6 + f.p[i]) * g.U * 1.4;
      ctx.fillRect(px, py, f.s[i], f.s[i]);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.puff = paintPuff();
    state.glow = paintGlow();
    state.lantern = paintLantern(g);
    state.flakes = seedFlakes(g);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.front, 0, 0);
    drawFire(ctx, g, t);
    drawLanterns(ctx, g, t);
    drawSteam(ctx, g, t, props.steam);
    drawSnow(ctx, g, t, props.snow);
  }

  Kasuri.run({
    defaults: { time: 'auto', snow: 1, steam: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
