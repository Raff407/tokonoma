/*
 * 銭湯 Sento — a neighbourhood bathhouse with its tall chimney, at the hour the
 * clock says.
 *
 * Sky, hills, street, houses and the bathhouse are baked into two layers and
 * repainted once a minute. Between repaints only steam from the chimney and
 * the roof vents, and the curtain at the door, move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, mixColor, toHex, parseColor, smoothstep } = K;

  const TAU = Math.PI * 2;
  const GROUND = 0.83;
  const HORIZON = 0.7;
  const RETINT_SECONDS = 60;
  const CHIMNEY_PUFFS = 22;
  const VENT_PUFFS = 8;
  const NOREN_PANELS = 3;
  const TILE = { lit: '#4a5468', dark: '#2c3344', line: '#232837', ridge: '#1f2430' };
  const WOOD = { dark: '#4a3424', mid: '#6e4c32', light: '#8f6a48', beam: '#3a2a1e' };
  const PLASTER = '#e4dcc6';
  const GOLD = '#c9a24a';
  const BRICK = '#8c5440';
  const NOREN = '#2f4a78';
  const LAMP = '#e8c26a';
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

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const u = U * Math.min(1, W / (U * 150));
    const cx = W * 0.42;
    return { W, H, U, u, cx, gy: Math.round(H * GROUND), chim: cx + u * 52 };
  }

  // Lit surface: base colour tinted by ambient light and darkened by night.
  function lit(sky, base, night) {
    const c = mixColor(rgb(base), sky.amb, 0.25);
    return mixColor(c, rgb('#1a1e30'), sky.night * (night ?? 0.65) * 0.8);
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(ctx, g, sky, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
      paintMoon(ctx, g, sky);
    }
    paintHills(ctx, g, sky);
  }

  function paintMoon(ctx, g, sky) {
    const x = g.W * 0.18;
    const y = g.H * 0.16;
    const r = g.u * 4;
    const halo = ctx.createRadialGradient(x, y, r, x, y, r * 5);
    halo.addColorStop(0, `rgba(220,214,190,${0.25 * sky.night})`);
    halo.addColorStop(1, 'rgba(220,214,190,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
    ctx.globalAlpha = sky.night;
    ctx.fillStyle = '#ece4c8';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function paintHills(ctx, g, sky) {
    const far = mixColor(sky.haze, sky.low, 0.35);
    const near = mixColor(sky.haze, rgb('#2c3a40'), 0.35 + sky.night * 0.3);
    const rows = [[far, 0.6, 0.012, 3], [near, 0.66, 0.02, 7]];
    for (const [ink, base, amp, seed] of rows) {
      ctx.fillStyle = hex(ink);
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W; x++) {
        const y = g.H * (base - amp * 4 * fbm(x * 0.012, seed, 3, seed));
        ctx.lineTo(x, y);
      }
      ctx.lineTo(g.W, g.H);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ---- neighbours --------------------------------------------------------

  function paintHouse(ctx, g, sky, x0, x1, top, glow, rand) {
    const wall = lit(sky, '#8a8478', 0.8);
    const roof = lit(sky, '#3a4050', 0.7);
    ctx.fillStyle = hex(wall);
    ctx.fillRect(x0, top, x1 - x0, g.gy - top);
    ctx.fillStyle = hex(roof);
    poly(ctx, [x0 - g.u * 2, top + g.u, x1 + g.u * 2, top + g.u, x1 - g.u * 2, top - g.u * 4, x0 + g.u * 2, top - g.u * 4]);
    const win = mixColor(lit(sky, '#5a6470', 0.8), rgb(LAMP), glow);
    for (let wx = x0 + g.u * 3; wx < x1 - g.u * 5; wx += g.u * 9) {
      const on = rand() < 0.7;
      ctx.fillStyle = hex(on ? win : lit(sky, '#4a525e', 0.8));
      ctx.fillRect(wx, top + g.u * 4, g.u * 5, g.u * 4);
    }
  }

  function paintNeighbours(ctx, g, sky, rand) {
    const glow = sky.night * 0.8;
    paintHouse(ctx, g, sky, -g.u * 2, g.cx - g.u * 48, g.H * 0.66, glow, rand);
    paintHouse(ctx, g, sky, g.chim + g.u * 10, g.W + g.u * 2, g.H * 0.64, glow, rand);
    // Power pole and wires on the left.
    const px = g.cx - g.u * 56;
    ctx.fillStyle = hex(lit(sky, '#4a4440', 0.6));
    ctx.fillRect(px, g.H * 0.4, Math.max(1, g.u * 1.2), g.gy - g.H * 0.4);
    ctx.fillRect(px - g.u * 4, g.H * 0.43, g.u * 9, Math.max(1, g.u * 0.6));
    ctx.strokeStyle = hex(mixColor(rgb('#2a2c34'), sky.top, 0.3));
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7;
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      ctx.moveTo(-1, g.H * (0.46 + k * 0.012));
      ctx.quadraticCurveTo(px * 0.5, g.H * (0.5 + k * 0.012), px, g.H * (0.43 + k * 0.004));
      ctx.quadraticCurveTo(g.cx, g.H * (0.48 + k * 0.012), g.cx + g.u * 46, g.H * (0.47 + k * 0.01));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- bathhouse ---------------------------------------------------------

  function tiles(ctx, g, sky, x0, y0, x1, y1, step) {
    ctx.fillStyle = hex(lit(sky, TILE.line, 0.4));
    for (let x = x0; x < x1; x += step) ctx.fillRect(x, y0, 1, y1 - y0);
  }

  function paintMainRoof(ctx, g, sky) {
    const { cx, u } = g;
    const ridge = g.H * 0.4;
    const eave = g.H * 0.55;
    ctx.save();
    ctx.fillStyle = hex(lit(sky, TILE.lit, 0.55));
    ctx.beginPath();
    ctx.moveTo(cx - u * 46, eave);
    ctx.quadraticCurveTo(cx - u * 34, eave - u * 3, cx - u * 24, ridge);
    ctx.lineTo(cx + u * 24, ridge);
    ctx.quadraticCurveTo(cx + u * 34, eave - u * 3, cx + u * 46, eave);
    ctx.closePath();
    ctx.fill();
    ctx.clip();
    tiles(ctx, g, sky, cx - u * 46, ridge, cx + u * 46, eave, Math.max(2, u * 1.6));
    ctx.restore();
    ctx.fillStyle = hex(lit(sky, TILE.ridge, 0.4));
    ctx.fillRect(cx - u * 26, ridge - u * 1.5, u * 52, u * 2);
    poly(ctx, [cx - u * 27, ridge - u * 3.5, cx - u * 24, ridge - u * 1, cx - u * 27, ridge + u * 0.5]);
    poly(ctx, [cx + u * 27, ridge - u * 3.5, cx + u * 24, ridge - u * 1, cx + u * 27, ridge + u * 0.5]);
    ctx.fillStyle = hex(lit(sky, TILE.dark, 0.4));
    ctx.fillRect(cx - u * 46, eave, u * 92, Math.max(1, u * 1.2));
  }

  // Small raised vent roof on the ridge where the steam escapes.
  function paintVent(ctx, g, sky) {
    const { cx, u } = g;
    const base = g.H * 0.4 - u * 1.5;
    ctx.fillStyle = hex(lit(sky, WOOD.dark, 0.5));
    ctx.fillRect(cx - u * 9, base - u * 4, u * 18, u * 4);
    ctx.fillStyle = hex(lit(sky, WOOD.beam, 0.5));
    for (let x = cx - u * 8; x < cx + u * 8; x += u * 2) ctx.fillRect(x, base - u * 3.5, Math.max(1, u * 0.7), u * 3);
    ctx.fillStyle = hex(lit(sky, TILE.lit, 0.55));
    poly(ctx, [cx - u * 12, base - u * 3.5, cx + u * 12, base - u * 3.5, cx + u * 7, base - u * 7, cx - u * 7, base - u * 7]);
    ctx.fillStyle = hex(lit(sky, TILE.ridge, 0.4));
    ctx.fillRect(cx - u * 8, base - u * 8, u * 16, u * 1.4);
  }

  function paintWalls(ctx, g, sky, glow) {
    const { cx, u, gy } = g;
    const top = g.H * 0.55;
    const mid = g.H * 0.68;
    ctx.fillStyle = hex(lit(sky, PLASTER, 0.7));
    ctx.fillRect(cx - u * 40, top, u * 80, mid - top);
    ctx.fillStyle = hex(lit(sky, WOOD.mid, 0.6));
    ctx.fillRect(cx - u * 40, mid, u * 80, gy - mid);
    ctx.fillStyle = hex(lit(sky, WOOD.dark, 0.6));
    for (let x = cx - u * 40; x < cx + u * 40; x += u * 2.4) ctx.fillRect(x, mid, 1, gy - mid);
    ctx.fillStyle = hex(lit(sky, WOOD.beam, 0.5));
    ctx.fillRect(cx - u * 40, mid - u * 0.6, u * 80, Math.max(1, u * 1.2));
    for (const f of [-40, -22, 22, 39]) ctx.fillRect(cx + u * f, top, Math.max(1, u * 1.2), gy - top);
    const win = mixColor(lit(sky, '#9aa2a4', 0.7), rgb(LAMP), glow);
    for (const f of [-36, -30, 26, 32]) paintWindow(ctx, g, sky, cx + u * f, top + u * 3, win);
  }

  function paintWindow(ctx, g, sky, x, y, win) {
    const { u } = g;
    ctx.fillStyle = hex(win);
    ctx.fillRect(x, y, u * 4.5, u * 6);
    ctx.fillStyle = hex(lit(sky, WOOD.beam, 0.5));
    ctx.fillRect(x + u * 1.5, y, 1, u * 6);
    ctx.fillRect(x + u * 3, y, 1, u * 6);
    ctx.fillRect(x, y + u * 3, u * 4.5, 1);
  }

  // The curved gable over the door: flat at the eaves, rising to a rounded crown.
  function karahafuPath(ctx, cx, hw, yb, yp) {
    ctx.moveTo(cx - hw, yb);
    ctx.bezierCurveTo(cx - hw * 0.45, yb, cx - hw * 0.45, yp, cx, yp);
    ctx.bezierCurveTo(cx + hw * 0.45, yp, cx + hw * 0.45, yb, cx + hw, yb);
  }

  function paintGable(ctx, g, sky) {
    const { cx, u } = g;
    const hw = u * 20;
    const yb = g.H * 0.62;
    const yp = g.H * 0.47;
    const face = g.H * 0.68;
    ctx.fillStyle = hex(lit(sky, WOOD.mid, 0.55));
    ctx.fillRect(cx - u * 14, yb - u * 2, u * 28, face - yb + u * 2);
    ctx.save();
    ctx.beginPath();
    karahafuPath(ctx, cx, hw, yb, yp);
    ctx.lineTo(cx + hw, yb + u * 3);
    ctx.lineTo(cx - hw, yb + u * 3);
    ctx.closePath();
    ctx.fillStyle = hex(lit(sky, TILE.lit, 0.55));
    ctx.fill();
    ctx.clip();
    tiles(ctx, g, sky, cx - hw, yp, cx + hw, yb + u * 3, Math.max(2, u * 1.4));
    ctx.restore();
    // Bargeboard: a pale band following the curve, then the shaded gable face under it.
    ctx.lineCap = 'round';
    ctx.strokeStyle = hex(lit(sky, '#d8ccb0', 0.7));
    ctx.lineWidth = Math.max(1.5, u * 2);
    ctx.beginPath();
    karahafuPath(ctx, cx, hw * 0.94, yb + u * 3.4, yp + u * 3.4);
    ctx.stroke();
    ctx.fillStyle = hex(lit(sky, WOOD.light, 0.55));
    ctx.beginPath();
    karahafuPath(ctx, cx, hw * 0.8, yb + u * 4.4, yp + u * 5.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hex(lit(sky, GOLD, 0.4));
    ctx.beginPath();
    ctx.arc(cx, yp + u * 7.4, u * 1.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = hex(lit(sky, WOOD.beam, 0.5));
    ctx.fillRect(cx - u * 15, yb + u * 4, u * 30, Math.max(1, u * 1.2));
  }

  function paintDoor(ctx, g, sky, glow) {
    const { cx, u, gy } = g;
    const top = g.H * 0.66;
    const inside = mixColor(lit(sky, '#7a6a58', 0.7), rgb('#f0d28a'), glow);
    ctx.fillStyle = hex(inside);
    ctx.fillRect(cx - u * 11, top, u * 22, gy - top);
    ctx.fillStyle = hex(lit(sky, WOOD.beam, 0.5));
    for (const f of [-11, -5.5, 0, 5.5, 10]) ctx.fillRect(cx + u * f, top, Math.max(1, u * 0.8), gy - top);
    ctx.fillRect(cx - u * 12, top - u, u * 24, Math.max(1, u * 1.4));
    // Step and two potted shrubs.
    ctx.fillStyle = hex(lit(sky, '#9a958a', 0.6));
    ctx.fillRect(cx - u * 15, gy - u * 1.2, u * 30, u * 1.2);
    ctx.fillStyle = hex(lit(sky, '#3e5a3c', 0.7));
    for (const f of [-17, 17]) {
      ctx.beginPath();
      ctx.arc(cx + u * f, gy - u * 4, u * 3, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = hex(lit(sky, '#6a4a3a', 0.6));
    for (const f of [-17, 17]) ctx.fillRect(cx + u * f - u * 2, gy - u * 2, u * 4, u * 2);
  }

  function paintLantern(ctx, g, sky) {
    const { cx, u } = g;
    const x = cx + u * 18;
    const y = g.H * 0.64;
    ctx.fillStyle = hex(mixColor(lit(sky, '#b4442b', 0.5), rgb('#e0703e'), sky.night * 0.6));
    ctx.beginPath();
    ctx.ellipse(x, y, u * 1.8, u * 2.6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = hex(lit(sky, TILE.ridge, 0.3));
    ctx.fillRect(x - u * 1.2, y - u * 3, u * 2.4, u * 0.8);
    ctx.fillRect(x - u * 1.2, y + u * 2.4, u * 2.4, u * 0.8);
  }

  function paintChimney(ctx, g, sky) {
    const { u, gy, chim } = g;
    const top = g.H * 0.1;
    const base = lit(sky, BRICK, 0.55);
    for (let y = Math.floor(top); y < gy; y++) {
      const f = (y - top) / (gy - top);
      const hw = u * (1.8 + f * 1.6);
      const shade = 0.92 + 0.08 * Math.sin(y * 0.9);
      ctx.fillStyle = hex(base.map((c) => c * shade));
      ctx.fillRect(chim - hw, y, hw * 2, 1);
      ctx.fillStyle = hex(base.map((c) => c * 0.72));
      ctx.fillRect(chim + hw * 0.4, y, hw * 0.6, 1);
    }
    ctx.fillStyle = hex(lit(sky, '#2a2420', 0.4));
    ctx.fillRect(chim - u * 2.4, top - u * 0.4, u * 4.8, u * 1.6);
    for (const f of [0.25, 0.5]) ctx.fillRect(chim - u * (2.1 + f * 1.6), top + (gy - top) * f, u * (4.2 + f * 3.2), Math.max(1, u * 0.8));
    // Boiler shed at its foot.
    ctx.fillStyle = hex(lit(sky, '#6a6460', 0.7));
    ctx.fillRect(chim - u * 10, g.H * 0.7, u * 18, gy - g.H * 0.7);
    ctx.fillStyle = hex(lit(sky, TILE.dark, 0.5));
    poly(ctx, [chim - u * 11, g.H * 0.7, chim + u * 9, g.H * 0.7, chim + u * 9, g.H * 0.68, chim - u * 11, g.H * 0.675]);
    ctx.fillStyle = hex(lit(sky, '#4a3a2e', 0.6));
    for (let k = 0; k < 4; k++) ctx.fillRect(chim - u * 9 + k * u * 1.8, gy - u * 4 - (k % 2) * u, u * 1.6, u * 4 + (k % 2) * u);
  }

  function paintStreet(ctx, g, sky) {
    const { gy } = g;
    const road = lit(sky, '#6a6862', 0.6);
    ctx.fillStyle = hex(road);
    ctx.fillRect(0, gy, g.W, g.H - gy);
    ctx.fillStyle = hex(mixColor(road, rgb('#c8c4b8'), 0.4));
    ctx.fillRect(0, gy, g.W, Math.max(1, g.u * 0.8));
    ctx.fillStyle = hex(mixColor(road, rgb('#d8d2c0'), 0.35));
    for (let x = 0; x < g.W; x += g.u * 14) ctx.fillRect(x, g.H * 0.93, g.u * 7, Math.max(1, g.u * 0.6));
    if (sky.night > 0.05) {
      const spill = ctx.createLinearGradient(0, gy, 0, g.H);
      spill.addColorStop(0, `rgba(236,214,160,${0.3 * sky.night})`);
      spill.addColorStop(1, 'rgba(236,214,160,0)');
      ctx.fillStyle = spill;
      ctx.fillRect(g.cx - g.u * 16, gy, g.u * 32, g.H - gy);
    }
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const glow = smoothstep(0.2, 0.8, sky.night) * 0.85;
    paintNeighbours(ctx, g, sky, rand);
    paintChimney(ctx, g, sky);
    paintVent(ctx, g, sky);
    paintMainRoof(ctx, g, sky);
    paintWalls(ctx, g, sky, glow);
    paintGable(ctx, g, sky);
    paintDoor(ctx, g, sky, glow);
    paintLantern(ctx, g, sky);
    paintStreet(ctx, g, sky);
    return c;
  }

  function paintNoren(g, sky) {
    const w = Math.max(3, Math.round(g.u * 6.6));
    const h = Math.max(6, Math.round(g.u * 9));
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = hex(mixColor(rgb(NOREN), rgb('#141a2c'), sky.night * 0.4));
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = hex(lit(sky, '#e8e0cc', 0.4));
    ctx.fillRect(0, h * 0.55, w, Math.max(1, h * 0.08));
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.3, w * 0.22, 0, TAU);
    ctx.fill();
    return c;
  }

  function paintPuff() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(240,238,230,0.8)');
    grad.addColorStop(0.5, 'rgba(240,238,230,0.45)');
    grad.addColorStop(1, 'rgba(240,238,230,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(17);
    const back = layer(g.W, g.H);
    paintSky(back.getContext('2d'), g, sky, rand);
    state.back = back;
    state.front = paintFront(g, sky, rand);
    state.noren = paintNoren(g, sky);
    state.dim = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  // Steam from the chimney leans away on the wind and spreads as it rises.
  function drawChimneySteam(ctx, g, t, amount, wind) {
    const { u } = g;
    const x0 = g.chim;
    const y0 = g.H * 0.1;
    const fade = amount * (1 - state.dim * 0.2);
    for (let i = 0; i < CHIMNEY_PUFFS; i++) {
      const a = (t * 0.055 + i / CHIMNEY_PUFFS) % 1;
      const size = u * (4 + a * 24);
      const dx = a * a * u * (6 + wind * 34) + Math.sin(t * 0.5 + i * 1.3) * u * 2.5 * a;
      const dy = -a * u * (20 - wind * 5) + Math.cos(t * 0.35 + i) * u * 1.5 * a;
      ctx.globalAlpha = Math.min(1, (1 - a) * Math.min(1, a * 8) * 0.9 * fade);
      ctx.drawImage(state.puff, x0 + dx - size / 2, y0 + dy - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawVentSteam(ctx, g, t, amount, wind) {
    const { u, cx } = g;
    const y0 = g.H * 0.4 - u * 8;
    const fade = amount * (1 - state.dim * 0.2) * 0.85;
    for (let i = 0; i < VENT_PUFFS; i++) {
      const a = (t * 0.09 + i / VENT_PUFFS) % 1;
      const size = u * (5 + a * 14);
      const sx = cx + ((i * 7) % 5 - 2) * u * 3;
      const dx = a * u * wind * 14 + Math.sin(t * 0.7 + i * 2.1) * u * 1.5;
      ctx.globalAlpha = Math.min(1, (1 - a) * Math.min(1, a * 6) * fade);
      ctx.drawImage(state.puff, sx + dx - size / 2, y0 - a * u * 20 - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawNoren(ctx, g, t, wind) {
    const art = state.noren;
    const top = g.H * 0.66 + g.u * 0.4;
    const left = g.cx - g.u * 10;
    for (let p = 0; p < NOREN_PANELS; p++) {
      const bx = left + p * (art.width + 1);
      for (let s = 0; s < art.height; s++) {
        const k = s / art.height;
        const sway = Math.sin(t * 1.4 + p * 1.1 - k * 2) * g.u * (0.3 + wind * 0.7) * k;
        ctx.drawImage(art, 0, s, art.width, 1, bx + sway, top + s, art.width, 1);
      }
    }
  }

  function setup(ctx, api) {
    state.g = geometry(api);
    state.puff = paintPuff();
    repaint(state.g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.back, 0, 0);
    ctx.drawImage(state.front, 0, 0);
    if (props.steam > 0) {
      drawVentSteam(ctx, g, t, props.steam, props.wind);
      drawChimneySteam(ctx, g, t, props.steam, props.wind);
    }
    drawNoren(ctx, g, t, props.wind);
  }

  Kasuri.run({
    defaults: { time: 'auto', steam: 1, wind: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
