/*
 * 簾 Sudare — a bamboo blind over a veranda, a bright garden beyond.
 *
 * Garden, blind, frame and floor stripes are baked into layers and repainted
 * once a minute from the clock. Between repaints the blind is drawn in thin
 * slices that sway, the light stripes slide, a wind bell turns and a few
 * leaves drift.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const BLIND = [0.07, 0.43];
  const SILL = 0.835;
  const FLOOR = 0.87;
  const POST = 0.03;
  const HORIZON = 0.5;
  const LEAVES = 7;
  const SLICE = 2;
  const RETINT_SECONDS = 60;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);
  const dim = (c, sky, k) => mixColor(mixColor(rgb(c), sky.amb, 0.25), rgb('#2a3156'), sky.night * k * 0.7);

  function ellipse(ctx, cx, cy, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, 6.3);
    ctx.fill();
  }

  // ---- garden ------------------------------------------------------------

  function paintSkyAndHills(ctx, g, sky) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    const day = 1 - sky.night;
    if (day > 0.05) {
      const sun = ctx.createRadialGradient(g.W * 0.72, g.H * 0.16, 0, g.W * 0.72, g.H * 0.16, g.H * 0.35);
      sun.addColorStop(0, `rgba(255,244,214,${0.7 * day})`);
      sun.addColorStop(1, 'rgba(255,244,214,0)');
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, g.W, g.H * HORIZON);
    }
    if (sky.night > 0.3) {
      const mt = S.moonT(sky.hour);
      ctx.fillStyle = `rgba(236,232,214,${sky.night})`;
      ellipse(ctx, lerp(g.W * 0.2, g.W * 0.8, mt), g.H * (0.3 - Math.sin(mt * Math.PI) * 0.17), g.U * 3, g.U * 3);
    }
    for (let k = 0; k < 2; k++) {
      ctx.fillStyle = hex(mixColor(sky.haze, sky.low, 0.2 + k * 0.1));
      ctx.beginPath();
      ctx.moveTo(0, g.H * HORIZON);
      for (let x = 0; x <= g.W; x += 2) {
        const yy = g.H * (0.4 + k * 0.035) - Math.sin(x / g.W * 5 + k * 2) * g.H * 0.035 - Math.sin(x / g.W * 13 + k) * g.H * 0.012;
        ctx.lineTo(x, yy);
      }
      ctx.lineTo(g.W, g.H * HORIZON);
      ctx.fill();
    }
  }

  function paintWall(ctx, g, sky) {
    const x0 = g.W * 0.02;
    const x1 = g.W * 0.64;
    const top = g.H * 0.47;
    const bot = g.H * 0.55;
    ctx.fillStyle = hex(dim('#ece6d4', sky, 0.7));
    ctx.fillRect(x0, top, x1 - x0, bot - top);
    ctx.fillStyle = hex(dim('#6c6a66', sky, 0.7));
    ctx.fillRect(x0 - g.U, top - g.U * 1.6, x1 - x0 + g.U * 2, g.U * 1.6);
    ctx.fillStyle = hex(dim('#3c3c40', sky, 0.7));
    for (let x = x0 - g.U; x < x1 + g.U; x += g.U * 1.6) ctx.fillRect(x, top - g.U * 1.6, 1, g.U * 1.6);
    ctx.fillStyle = hex(dim('#b9ae93', sky, 0.7));
    ctx.fillRect(x0, bot - g.U * 1.4, x1 - x0, g.U * 1.4);
  }

  function paintGround(ctx, g, sky, rand) {
    const top = g.H * 0.545;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, hex(dim('#56733f', sky, 0.75)));
    grad.addColorStop(1, hex(dim('#3e5a30', sky, 0.75)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    for (let i = 0; i < g.W * 0.9; i++) {
      ctx.fillStyle = hex(dim(rand() < 0.5 ? '#7f9a55' : '#33482a', sky, 0.75));
      ctx.globalAlpha = 0.5;
      ctx.fillRect(rand() * g.W, top + rand() * (g.H - top), 1 + rand() * 2, 1);
    }
    ctx.globalAlpha = 1;
  }

  function paintPond(ctx, g, sky, rand) {
    const cx = g.W * 0.6;
    const cy = g.H * 0.735;
    const rx = g.W * 0.17;
    const ry = g.H * 0.055;
    ctx.fillStyle = hex(dim('#6a7f8a', sky, 0.6));
    ellipse(ctx, cx, cy, rx + g.U, ry + g.U * 0.6);
    const water = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
    water.addColorStop(0, hex(mixColor(sky.low, rgb('#2c4a68'), 0.45)));
    water.addColorStop(1, hex(mixColor(sky.top, rgb('#24405c'), 0.5)));
    ctx.fillStyle = water;
    ellipse(ctx, cx, cy, rx, ry);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * 6.28 + rand() * 0.2;
      ctx.fillStyle = hex(dim(rand() < 0.5 ? '#8f8e86' : '#6e6d68', sky, 0.7));
      ellipse(ctx, cx + Math.cos(a) * (rx + g.U * 0.5), cy + Math.sin(a) * (ry + g.U * 0.3), g.U * (1 + rand() * 1.2), g.U * (0.6 + rand() * 0.5));
    }
    ctx.fillStyle = hex(dim('#4d7040', sky, 0.7));
    for (let i = 0; i < 3; i++) ellipse(ctx, cx + (i - 1) * rx * 0.35, cy + ry * (0.1 + i * 0.12), g.U * 1.6, g.U * 0.6);
    ctx.fillStyle = hex(dim('#d6a24a', sky, 0.7));
    ellipse(ctx, cx - rx * 0.15, cy + ry * 0.2, g.U * 0.5, g.U * 0.3);
    // Stepping stones from the front toward the lantern.
    const stones = [[0.4, 0.84], [0.43, 0.79], [0.4, 0.75]];
    for (const s of stones) {
      ctx.fillStyle = hex(dim('#8d8b84', sky, 0.7));
      ellipse(ctx, g.W * s[0], g.H * s[1], g.U * (3 - s[1] * 1.2) * 1.8, g.U * 1.3);
      ctx.fillStyle = hex(dim('#a7a59c', sky, 0.7));
      ellipse(ctx, g.W * s[0], g.H * s[1] - g.U * 0.3, g.U * (3 - s[1] * 1.2) * 1.5, g.U * 0.9);
    }
  }

  function paintLantern(ctx, g, sky) {
    const u = g.U * 1.55;
    const cx = g.W * 0.3;
    const base = g.H * 0.8;
    const stone = dim('#8e8d86', sky, 0.7);
    const shade = mixColor(stone, rgb('#2a2c30'), 0.3);
    const rect = (x, y, w, h, c) => {
      ctx.fillStyle = hex(c);
      ctx.fillRect(cx + x * u, base + y * u, w * u, h * u);
    };
    ctx.fillStyle = 'rgba(20,30,20,0.25)';
    ellipse(ctx, cx, base + u * 0.2, u * 6, u * 1.2);
    rect(-3, -2, 6, 2, shade);
    rect(-1.4, -9, 2.8, 7, stone);
    rect(-4.5, -10.6, 9, 1.8, shade);
    rect(-3.2, -16, 6.4, 5.4, stone);
    const glow = rgb('#e8b85a');
    rect(-1.2, -14.8, 2.4, 3, mixColor(dim('#2c2a28', sky, 0.5), glow, sky.night * 0.95));
    rect(-4.4, -17.4, 8.8, 1.4, shade);
    ctx.fillStyle = hex(stone);
    ctx.beginPath();
    ctx.moveTo(cx - u * 8, base - u * 17.4);
    ctx.lineTo(cx + u * 8, base - u * 17.4);
    ctx.lineTo(cx + u * 2.2, base - u * 21.6);
    ctx.lineTo(cx - u * 2.2, base - u * 21.6);
    ctx.fill();
    ctx.fillStyle = hex(dim('#5a7a42', sky, 0.7));
    ellipse(ctx, cx - u * 2.5, base - u * 21, u * 3, u * 0.9);
    ellipse(ctx, cx, base - u * 22.4, u * 1.2, u * 1.4);
  }

  function paintPine(ctx, g, sky, rand) {
    const u = g.U;
    const x0 = g.W * 0.84;
    const base = g.H * 0.74;
    ctx.strokeStyle = hex(dim('#5a3f30', sky, 0.8));
    ctx.lineWidth = u * 2.2;
    ctx.beginPath();
    ctx.moveTo(x0, base);
    ctx.bezierCurveTo(x0 - u * 6, base - u * 14, x0 + u * 8, base - u * 22, x0 - u * 2, base - u * 38);
    ctx.stroke();
    ctx.lineWidth = u * 1.1;
    ctx.beginPath();
    ctx.moveTo(x0 + u * 1, base - u * 20);
    ctx.quadraticCurveTo(x0 - u * 14, base - u * 22, x0 - u * 22, base - u * 28);
    ctx.moveTo(x0 + u * 2, base - u * 28);
    ctx.quadraticCurveTo(x0 + u * 14, base - u * 28, x0 + u * 24, base - u * 33);
    ctx.stroke();
    const pads = [[-22, -28, 11], [16, -33, 10], [-2, -40, 12], [-10, -16, 8], [12, -20, 8]];
    for (const p of pads) {
      ctx.fillStyle = hex(dim('#2e4a30', sky, 0.8));
      ellipse(ctx, x0 + p[0] * u, base + p[1] * u, p[2] * u, p[2] * u * 0.38);
      ctx.fillStyle = hex(dim('#496c3d', sky, 0.8));
      ellipse(ctx, x0 + p[0] * u, base + (p[1] - 1.4) * u, p[2] * u * 0.85, p[2] * u * 0.26);
      ctx.fillStyle = hex(dim('#6c8c4c', sky, 0.8));
      for (let i = 0; i < 6; i++) ellipse(ctx, x0 + (p[0] + (rand() - 0.5) * p[2]) * u, base + (p[1] - 2.6) * u, u * 0.7, u * 0.3);
    }
  }

  function paintMaple(ctx, g, sky, rand) {
    const u = g.U;
    const x0 = g.W * 0.13;
    const base = g.H * 0.8;
    ctx.fillStyle = 'rgba(20,30,20,0.25)';
    ellipse(ctx, x0, base, u * 12, u * 1.4);
    ctx.strokeStyle = hex(dim('#3e2e26', sky, 0.8));
    ctx.lineCap = 'round';
    ctx.lineWidth = u * 1.8;
    ctx.beginPath();
    ctx.moveTo(x0, base);
    ctx.quadraticCurveTo(x0 + u * 4, base - u * 10, x0 - u * 1, base - u * 18);
    ctx.stroke();
    ctx.lineWidth = u * 0.9;
    ctx.beginPath();
    ctx.moveTo(x0 + u * 1.5, base - u * 10);
    ctx.quadraticCurveTo(x0 + u * 8, base - u * 14, x0 + u * 12, base - u * 17);
    ctx.moveTo(x0, base - u * 15);
    ctx.quadraticCurveTo(x0 - u * 7, base - u * 18, x0 - u * 11, base - u * 21);
    ctx.stroke();
    // Tiered lobes: dark underside, vermilion body, gold catching the light.
    const lobes = [[-11, -22, 8], [12, -18, 8], [0, -26, 10], [-4, -17, 7], [7, -28, 7]];
    const tiers = [['#7a2a22', 0.9, 0.6], ['#c0452c', -0.3, 0.75], ['#d6733a', -1.4, 0.45]];
    for (const tier of tiers) {
      ctx.fillStyle = hex(dim(tier[0], sky, 0.8));
      for (const l of lobes) {
        ellipse(ctx, x0 + l[0] * u, base + (l[1] + tier[1]) * u, l[2] * u * tier[2] * 1.15, l[2] * u * tier[2] * 0.5);
      }
    }
    ctx.fillStyle = hex(dim('#d9a24a', sky, 0.8));
    for (const l of lobes) {
      for (let i = 0; i < 3; i++) ellipse(ctx, x0 + (l[0] + (rand() - 0.5) * l[2]) * u, base + (l[1] - 2.4) * u, u * 0.9, u * 0.4);
    }
  }

  function paintGarden(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSkyAndHills(ctx, g, sky);
    paintWall(ctx, g, sky);
    paintGround(ctx, g, sky, rand);
    paintPine(ctx, g, sky, rand);
    paintPond(ctx, g, sky, rand);
    paintLantern(ctx, g, sky);
    paintMaple(ctx, g, sky, rand);
    return c;
  }

  // ---- blind -------------------------------------------------------------

  function paintBlind(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const top = g.H * BLIND[0];
    const bot = g.H * BLIND[1];
    const h = bot - top;
    const pitch = g.pitch;
    const x0 = g.W * (POST - 0.02);
    const x1 = g.W * (1 - POST + 0.02);
    const tones = ['#c2ad6e', '#b39e5e', '#a8a15c', '#cdb97c', '#9e9558'];
    for (let x = x0; x < x1; x += pitch) {
      ctx.fillStyle = hex(dim(tones[Math.floor(rand() * tones.length)], sky, 0.35));
      ctx.globalAlpha = 0.5;
      ctx.fillRect(Math.round(x), top, Math.max(1, Math.round(pitch * 0.6)), h);
    }
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = hex(dim('#4a3d26', sky, 0.4));
    for (const f of [0.3, 0.62, 0.85]) ctx.fillRect(x0, top + h * f, x1 - x0, 1);
    ctx.globalAlpha = 1;
    // Cloth band at the head and the foot, with a pale stitch line.
    const indigo = hex(dim('#26335e', sky, 0.4));
    const band = g.U * 4.2;
    ctx.fillStyle = indigo;
    ctx.fillRect(x0, top, x1 - x0, band);
    ctx.fillRect(x0, bot - band * 0.8, x1 - x0, band * 0.8);
    ctx.fillStyle = hex(dim('#d8d2bc', sky, 0.5));
    ctx.fillRect(x0, top + band, x1 - x0, 1);
    ctx.fillRect(x0, bot - band * 0.8 - 1, x1 - x0, 1);
    ctx.fillRect(x0, top + band * 0.5, x1 - x0, 1);
    // Two vermilion hanging cords with knots.
    ctx.fillStyle = hex(dim('#c9432c', sky, 0.4));
    // Short tie cords hang from the head band and loop under the foot.
    for (const f of [0.14, 0.86]) {
      ctx.globalAlpha = 0.8;
      ctx.fillRect(g.W * f, top + band, 1, h - band * 1.8);
      ctx.globalAlpha = 1;
      ctx.fillRect(g.W * f - 1, bot - g.U * 0.5, 3, Math.max(2, g.U * 1.6));
    }
    return c;
  }

  // ---- frame and floor ---------------------------------------------------

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const wood = dim('#4a3426', sky, 0.55);
    // Beam above.
    ctx.fillStyle = hex(wood);
    ctx.fillRect(0, 0, g.W, g.H * BLIND[0]);
    ctx.fillStyle = hex(mixColor(wood, rgb('#1a120e'), 0.5));
    ctx.fillRect(0, g.H * BLIND[0] - Math.max(1, g.U * 0.6), g.W, Math.max(1, g.U * 0.6));
    // Posts left and right.
    for (const side of [0, 1]) {
      const px = side ? g.W * (1 - POST) : 0;
      ctx.fillStyle = hex(wood);
      ctx.fillRect(px, 0, g.W * POST, g.H * FLOOR);
      ctx.fillStyle = hex(mixColor(wood, rgb('#8a6a4a'), 0.35));
      ctx.fillRect(px + (side ? 0 : g.W * POST - 1), 0, 1, g.H * FLOOR);
      ctx.fillStyle = hex(mixColor(wood, rgb('#1a120e'), 0.4));
      for (let i = 0; i < 8; i++) ctx.fillRect(px + rand() * g.W * POST, rand() * g.H * FLOOR, 1, g.H * (0.04 + rand() * 0.12));
    }
    // Sill rail.
    ctx.fillStyle = hex(wood);
    ctx.fillRect(0, g.H * SILL, g.W, g.H * (FLOOR - SILL));
    ctx.fillStyle = hex(mixColor(wood, rgb('#9a7a58'), 0.4));
    ctx.fillRect(0, g.H * SILL, g.W, 1);
    // Floor boards run sideways and open out toward the viewer.
    const fy = g.H * FLOOR;
    const board = dim('#a47e55', sky, 0.7);
    ctx.fillStyle = hex(board);
    ctx.fillRect(0, fy, g.W, g.H - fy);
    ctx.fillStyle = hex(mixColor(board, rgb('#2a1c12'), 0.45));
    for (let i = 1; i < 4; i++) ctx.fillRect(0, fy + (g.H - fy) * Math.pow(i / 4, 1.3), g.W, 1);
    ctx.fillStyle = hex(mixColor(board, rgb('#d8b88a'), 0.35));
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 24; i++) ctx.fillRect(rand() * g.W, fy + rand() * (g.H - fy), 6 + rand() * 20, 1);
    ctx.globalAlpha = 1;
    return c;
  }

  // Light through the gaps: slanted bars, wider than the screen so they can slide.
  function paintStripes(g, sky) {
    const h = Math.ceil(g.H - g.H * FLOOR);
    const pitch = Math.round(g.W / 6);
    const c = layer(g.W + pitch * 4, h);
    const ctx = c.getContext('2d');
    const warm = mixColor(rgb('#f6e4b4'), sky.amb, 0.35);
    const colour = mixColor(warm, rgb('#b9c2e0'), sky.night);
    const lean = h * 0.6;
    const wide = pitch * 0.42;
    for (let x = 0; x < c.width + lean; x += pitch) {
      const soft = ctx.createLinearGradient(x - lean * 0.5, 0, x + wide - lean * 0.5, 0);
      const cc = hex(colour);
      soft.addColorStop(0, 'rgba(0,0,0,0)');
      soft.addColorStop(0.3, cc);
      soft.addColorStop(0.7, cc);
      soft.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = soft;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + wide, 0);
      ctx.lineTo(x + wide - lean, h);
      ctx.lineTo(x - lean, h);
      ctx.fill();
    }
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(47);
    state.garden = paintGarden(g, sky, rand);
    state.blind = paintBlind(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.stripes = paintStripes(g, sky);
    state.stripeAlpha = 0.3 * (1 - sky.night) + 0.08;
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawLeaves(ctx, g, t) {
    for (let i = 0; i < LEAVES; i++) {
      const a = (t * 0.03 + state.leafSeed[i]) % 1;
      const lx = g.W * (0.08 + a * 0.5 + Math.sin(t * 0.7 + i * 2) * 0.01);
      const ly = g.H * (0.3 + a * 0.45);
      ctx.fillStyle = state.leafCol[i];
      ctx.globalAlpha = 0.9 * (1 - state.night * 0.5);
      ctx.fillRect(lx, ly, Math.max(1, g.U * 0.8), Math.max(1, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
  }

  function drawBlind(ctx, g, t, breeze) {
    const top = Math.floor(g.H * BLIND[0]);
    const bot = Math.ceil(g.H * BLIND[1]);
    const span = bot - top;
    const gust = 0.65 + 0.35 * Math.sin(t * 0.31) + 0.2 * Math.sin(t * 0.83 + 1);
    const amp = g.U * 2.4 * breeze * gust;
    for (let y = top; y < bot; y += SLICE) {
      const k = (y - top) / span;
      const dx = (Math.sin(t * 1.5 - k * 3.4) * 0.65 + Math.sin(t * 0.6 + k * 1.3) * 0.35) * amp * k;
      ctx.drawImage(state.blind, 0, y, g.W, SLICE, dx, y, g.W, SLICE);
    }
    return amp;
  }

  function drawStripes(ctx, g, t, amp) {
    const s = state.stripes;
    const off = Math.sin(t * 0.25) * g.pitch * 3 + Math.sin(t * 1.5 - 3.4) * amp * 0.4;
    const fy = g.H * FLOOR;
    ctx.globalAlpha = state.stripeAlpha;
    ctx.drawImage(s, -s.width * 0.3 + off, fy);
    ctx.globalAlpha = 1;
  }

  // A glass wind bell on a cord with a paper strip below, swinging in the breeze.
  function drawBell(ctx, g, t, breeze) {
    const u = g.U;
    const ax = g.W * 0.5;
    const ay = g.H * BLIND[0] + u * 4.4;
    const swing = Math.sin(t * 1.7) * 0.2 * (0.3 + breeze * 0.7) * (0.7 + 0.3 * Math.sin(t * 0.4));
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(swing);
    ctx.fillStyle = '#c9432c';
    ctx.fillRect(0, 0, 1, u * 4);
    ctx.fillStyle = '#26335e';
    ctx.beginPath();
    ctx.arc(0, u * 7, u * 3.5, Math.PI, 0);
    ctx.lineTo(u * 3.9, u * 8.6);
    ctx.lineTo(-u * 3.9, u * 8.6);
    ctx.fill();
    ctx.fillStyle = state.night > 0.5 ? '#bccad0' : '#dcebe6';
    ctx.beginPath();
    ctx.arc(0, u * 7, u * 3, Math.PI, 0);
    ctx.lineTo(u * 3.4, u * 8.2);
    ctx.lineTo(-u * 3.4, u * 8.2);
    ctx.fill();
    ctx.fillStyle = '#c9432c';
    ctx.fillRect(-u * 2.6, u * 6, u * 1.2, u * 1.2);
    ctx.fillRect(u * 1.4, u * 6, u * 1.2, u * 1.2);
    ctx.fillStyle = '#5a7a82';
    ctx.fillRect(-u * 3.4, u * 8.2, u * 6.8, 1);
    ctx.fillStyle = '#c9432c';
    ctx.fillRect(0, u * 8.2, 1, u * 2.4);
    ctx.save();
    ctx.translate(0, u * 10.6);
    ctx.rotate(Math.sin(t * 2.3) * 0.18 * breeze);
    ctx.fillStyle = '#ece6d4';
    ctx.fillRect(-u * 0.9, 0, u * 1.8, u * 7);
    ctx.fillStyle = '#26335e';
    ctx.fillRect(-u * 0.9, 0, u * 1.8, u * 0.8);
    ctx.restore();
    ctx.restore();
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    g.pitch = Math.max(3, Math.round(g.U * 2.3));
    state.g = g;
    const rand = K.rng(9);
    const cols = ['#c0452c', '#d6733a', '#d9a24a', '#a8362a'];
    state.leafSeed = [];
    state.leafCol = [];
    for (let i = 0; i < LEAVES; i++) {
      state.leafSeed.push(rand());
      state.leafCol.push(cols[i % cols.length]);
    }
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.garden, 0, 0);
    drawLeaves(ctx, g, t);
    const amp = drawBlind(ctx, g, t, props.breeze);
    ctx.drawImage(state.front, 0, 0);
    drawStripes(ctx, g, t, amp);
    if (props.bell) drawBell(ctx, g, t, props.breeze);
  }

  Kasuri.run({
    defaults: { time: 'auto', breeze: 1, bell: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
