/*
 * 故宫 Gugong — a corner tower of the Forbidden City in falling snow.
 *
 * Sky, halls, wall, tower and moat bank are baked into layers and repainted
 * once a minute from the clock. The moat is the baked world flipped and laid
 * back in thin sliding rows. Between repaints only snow, lanterns and the
 * water rows move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.8;
  const RETINT_SECONDS = 60;
  const FAR_FLAKES = 130;
  const NEAR_FLAKES = 70;
  const MAX_FLAKES = FAR_FLAKES + NEAR_FLAKES;
  const STRIP = 2;
  const GOLD = { hi: '#d4af55', lo: '#a98336', line: '#876a2a', ridge: '#e6cb74' };
  const RED = '#a03529';
  const RED_DARK = '#74231d';
  const MARBLE = '#d9d6cb';
  const INDIGO = '#2b4170';
  const MOSS = '#3b4e3b';
  const SNOW = '#eceae2';
  const SNOW_EDGE = '#bcc2cb';
  const state = {};

  const hex = (rgb) => toHex(rgb);
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
    const s = Math.min(W, H * 1.78);
    return { W, H, U, s, cx: W * 0.64, wy: Math.round(H * WATER) };
  }

  const X = (g, f) => g.cx + f * g.s;
  const Y = (g, f) => g.H * f;

  // Colour lit by the sky, then pulled toward night blue.
  function tint(sky, h, k) {
    const lit = mixColor(rgb(h), sky.amb, k === undefined ? 0.22 : k);
    return hex(mixColor(lit, rgb('#10162a'), sky.night * 0.62));
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const wash = 0.5 * (1 - sky.night * 0.5);
    const grey = rgb('#8d95a2');
    const grad = ctx.createLinearGradient(0, 0, 0, g.wy);
    grad.addColorStop(0, hex(mixColor(sky.top, grey, wash)));
    grad.addColorStop(1, hex(mixColor(sky.low, rgb('#c9c6bc'), wash + 0.1)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  // Overcast wisps that tile sideways.
  function paintOvercast(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(fbm(x * 0.012, y * 0.06, 4, 33), fbm((x - c.width) * 0.012, y * 0.06, 4, 33), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = 238;
        img.data[i + 1] = 236;
        img.data[i + 2] = 230;
        img.data[i + 3] = smoothstep(0.44, 0.68, v) * band * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- roofs -------------------------------------------------------------

  function roofPath(ctx, cx, yE, hwE, yT, hwT, up) {
    const ex = hwE * 0.09;
    const bend = (hwE - hwT) * 0.3;
    const midY = yE - (yE - yT) * 0.35;
    ctx.beginPath();
    ctx.moveTo(cx - hwE - ex, yE - up);
    ctx.quadraticCurveTo(cx - hwE * 0.78, yE + up * 0.15, cx - hwE * 0.5, yE);
    ctx.lineTo(cx + hwE * 0.5, yE);
    ctx.quadraticCurveTo(cx + hwE * 0.78, yE + up * 0.15, cx + hwE + ex, yE - up);
    ctx.quadraticCurveTo(cx + hwT + bend, midY, cx + hwT, yT);
    ctx.lineTo(cx - hwT, yT);
    ctx.quadraticCurveTo(cx - hwT - bend, midY, cx - hwE - ex, yE - up);
    ctx.closePath();
  }

  function paintTiles(ctx, g, sky, cx, yE, hwE, yT, hwT) {
    const n = Math.max(4, Math.round(hwE / (g.U * 1.5)));
    ctx.strokeStyle = tint(sky, GOLD.line);
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -n; i <= n; i++) {
      ctx.moveTo(cx + (i / n) * hwE, yE);
      ctx.lineTo(cx + (i / n) * hwT, yT);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function paintRoofSnow(ctx, g, cx, yE, hwE, yT, depthK, seed) {
    const ex = hwE * 0.09;
    const span = yE - yT;
    for (let x = Math.floor(cx - hwE - ex); x <= cx + hwE + ex; x++) {
      const d = span * depthK * (0.65 + fbm(x * 0.17, seed, 3, seed + 3) * 0.7);
      ctx.fillStyle = SNOW;
      ctx.fillRect(x, yT - 1, 1, d + 1);
      ctx.fillStyle = SNOW_EDGE;
      ctx.fillRect(x, yT + d, 1, 1);
    }
  }

  function paintFascia(ctx, g, sky, cx, yE, hwE) {
    const h = Math.max(2, g.U * 1.7);
    const x0 = cx - hwE * 0.74;
    const w = hwE * 1.48;
    ctx.fillStyle = tint(sky, INDIGO);
    ctx.fillRect(x0, yE, w, h);
    ctx.fillStyle = tint(sky, '#3d7660');
    ctx.fillRect(x0, yE + h * 0.55, w, Math.max(1, h * 0.25));
    ctx.fillStyle = tint(sky, GOLD.hi);
    for (let x = x0 + 1; x < x0 + w; x += Math.max(2, g.U * 2.3)) ctx.fillRect(x, yE, 1, h * 0.55);
    ctx.fillStyle = tint(sky, RED);
    ctx.fillRect(x0, yE + h, w, Math.max(1, g.U * 0.4));
  }

  function paintRoof(ctx, g, sky, o) {
    const { cx, yE, hwE, yT, hwT, up } = o;
    const grad = ctx.createLinearGradient(0, yT, 0, yE);
    grad.addColorStop(0, tint(sky, GOLD.hi));
    grad.addColorStop(1, tint(sky, GOLD.lo));
    ctx.save();
    ctx.fillStyle = grad;
    roofPath(ctx, cx, yE, hwE, yT, hwT, up);
    ctx.fill();
    ctx.clip();
    paintTiles(ctx, g, sky, cx, yE, hwE, yT, hwT);
    paintRoofSnow(ctx, g, cx, yE, hwE, yT, o.snow, o.seed);
    ctx.restore();
    ctx.fillStyle = tint(sky, GOLD.ridge);
    ctx.fillRect(cx - hwT - 1, yT - Math.max(1, g.U * 0.5), hwT * 2 + 2, Math.max(1, g.U * 0.6));
    paintFascia(ctx, g, sky, cx, yE, hwE);
  }

  // ---- walls and bodies --------------------------------------------------

  function paintBody(ctx, g, sky, x0, y0, x1, y1, lit, cols) {
    ctx.fillStyle = tint(sky, RED);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = tint(sky, RED_DARK);
    const step = (x1 - x0) / cols;
    for (let i = 0; i <= cols; i++) ctx.fillRect(Math.min(x1 - 1, x0 + i * step), y0, Math.max(1, g.U * 0.7), y1 - y0);
    const sh = ctx.createLinearGradient(0, y0, 0, y0 + (y1 - y0) * 0.35);
    sh.addColorStop(0, 'rgba(20,10,16,0.45)');
    sh.addColorStop(1, 'rgba(20,10,16,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (lit) paintWindows(ctx, g, sky, x0, y0, x1, y1, cols);
  }

  function paintWindows(ctx, g, sky, x0, y0, x1, y1, cols) {
    const step = (x1 - x0) / cols;
    const wy0 = y0 + (y1 - y0) * 0.22;
    const wh = (y1 - y0) * 0.56;
    const glow = mixColor(rgb('#2b1a1c'), rgb('#e8a64a'), sky.night * 0.9);
    for (let i = 0; i < cols; i++) {
      const wx = x0 + i * step + step * 0.22;
      const ww = step * 0.56;
      ctx.fillStyle = hex(glow);
      ctx.fillRect(wx, wy0, ww, wh);
      ctx.fillStyle = tint(sky, GOLD.hi);
      ctx.fillRect(wx, wy0, ww, 1);
      ctx.fillRect(wx, wy0 + wh - 1, ww, 1);
      for (let l = 1; l < 4; l++) ctx.fillRect(wx + (ww * l) / 4, wy0, 1, wh);
      ctx.fillRect(wx, wy0 + wh / 2, ww, 1);
    }
  }

  function paintMarble(ctx, g, sky, x0, y0, x1, y1) {
    ctx.fillStyle = tint(sky, MARBLE, 0.3);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = tint(sky, '#b2b0a8', 0.3);
    ctx.fillRect(x0, y1 - Math.max(1, g.U * 0.7), x1 - x0, Math.max(1, g.U * 0.7));
    for (let x = x0; x < x1; x += g.U * 3.2) ctx.fillRect(x, y0 + g.U, 1, y1 - y0 - g.U);
    for (let x = Math.floor(x0); x < x1; x++) {
      const d = g.U * (0.5 + fbm(x * 0.2, 5, 2, 8) * 1.2);
      ctx.fillStyle = SNOW;
      ctx.fillRect(x, y0 - 1, 1, d + 1);
    }
  }

  function paintCapWall(ctx, g, sky, x0, x1, seed) {
    const w = x1 - x0;
    if (w <= 2) return;
    const yE = Y(g, 0.615);
    const yT = Y(g, 0.578);
    const grad = ctx.createLinearGradient(0, yT, 0, yE);
    grad.addColorStop(0, tint(sky, GOLD.hi));
    grad.addColorStop(1, tint(sky, GOLD.lo));
    ctx.save();
    ctx.fillStyle = grad;
    poly(ctx, [x0, yE, x1, yE, x1, yT, x0, yT]);
    ctx.beginPath();
    ctx.rect(x0, yT, w, yE - yT);
    ctx.clip();
    ctx.strokeStyle = tint(sky, GOLD.line);
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    for (let x = x0; x < x1; x += g.U * 1.5) {
      ctx.moveTo(x, yE);
      ctx.lineTo(x + g.U * 0.5, yT);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    paintRoofSnow(ctx, g, (x0 + x1) / 2, yE, w / 2, yT, 0.5, seed);
    ctx.restore();
    ctx.fillStyle = tint(sky, GOLD.ridge);
    ctx.fillRect(x0, yT - 1, w, 1);
    paintFascia(ctx, g, sky, (x0 + x1) / 2, yE, w / 1.48);
    const top = yE + Math.max(2, g.U * 1.7) + 1;
    const bottom = Y(g, 0.775);
    ctx.fillStyle = tint(sky, RED);
    ctx.fillRect(x0, top, w, bottom - top);
    ctx.fillStyle = tint(sky, RED_DARK);
    for (let x = x0; x < x1; x += g.U * 15) ctx.fillRect(x, top, Math.max(1, g.U * 0.6), bottom - top);
    const sh = ctx.createLinearGradient(0, top, 0, top + (bottom - top) * 0.3);
    sh.addColorStop(0, 'rgba(20,10,16,0.4)');
    sh.addColorStop(1, 'rgba(20,10,16,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(x0, top, w, bottom - top);
    paintMarble(ctx, g, sky, x0, bottom, x1, g.wy);
  }

  // ---- background halls and trees ---------------------------------------

  function hallY(f, k) {
    return 0.6 - (0.6 - f) * k;
  }

  function paintHall(ctx, g, sky, fx, k, haze, seed) {
    const cx = X(g, fx);
    const s = g.s * k;
    const y = (f) => Y(g, hallY(f, k));
    const dim = (h) => {
      const c = tint(sky, h);
      return hex(mixColor(rgb(c), sky.haze, haze));
    };
    const body = (x0, y0, x1, y1) => {
      ctx.fillStyle = dim(RED);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.fillStyle = dim(RED_DARK);
      for (let i = 0; i <= 6; i++) ctx.fillRect(x0 + ((x1 - x0) * i) / 6, y0, 1, y1 - y0);
    };
    const roof = (yE, hwE, yT, hwT, up, snow) => {
      const grad = ctx.createLinearGradient(0, yT, 0, yE);
      grad.addColorStop(0, dim(GOLD.hi));
      grad.addColorStop(1, dim(GOLD.lo));
      ctx.save();
      ctx.fillStyle = grad;
      roofPath(ctx, cx, yE, hwE, yT, hwT, up);
      ctx.fill();
      ctx.clip();
      paintRoofSnow(ctx, g, cx, yE, hwE, yT, snow, seed);
      ctx.restore();
      ctx.fillStyle = dim(INDIGO);
      ctx.fillRect(cx - hwE * 0.74, yE, hwE * 1.48, Math.max(1, g.U * 1.1));
    };
    ctx.fillStyle = dim(MARBLE);
    ctx.fillRect(cx - 0.1 * s, y(0.6), 0.2 * s, Y(g, 0.6) - y(0.6) + 2);
    body(cx - 0.07 * s, y(0.545), cx + 0.07 * s, y(0.6));
    roof(y(0.545), 0.105 * s, y(0.5), 0.075 * s, g.U * 2.2 * k, 0.5);
    body(cx - 0.05 * s, y(0.47), cx + 0.05 * s, y(0.5));
    roof(y(0.47), 0.082 * s, y(0.385), 0.018 * s, g.U * 3 * k, 0.45);
  }

  function paintCypress(ctx, g, sky, fx, h, rand) {
    const x = X(g, fx);
    const base = Y(g, 0.6);
    const top = base - Y(g, h);
    ctx.fillStyle = tint(sky, '#3a2f26');
    ctx.fillRect(x - g.U * 0.4, base - g.U * 4, g.U * 0.8, g.U * 4);
    for (let i = 0; i < 9; i++) {
      const f = i / 8;
      const yy = lerp(base - g.U * 4, top, f);
      const rx = g.U * lerp(3.6, 0.8, f);
      ctx.fillStyle = tint(sky, MOSS);
      ctx.beginPath();
      ctx.ellipse(x + (rand() - 0.5) * g.U * 0.6, yy, rx, g.U * 2.2, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = SNOW;
      ctx.beginPath();
      ctx.ellipse(x + (rand() - 0.5) * rx * 0.8, yy - g.U * 1.2, rx * 0.7, g.U * 0.7, 0, 0, TAU);
      ctx.fill();
    }
  }

  function paintMist(ctx, g, sky) {
    const grad = ctx.createLinearGradient(0, Y(g, 0.36), 0, Y(g, 0.64));
    const m = hex(mixColor(rgb('#d8d6cc'), sky.haze, 0.5 + sky.night * 0.3));
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.7, m + '99');
    grad.addColorStop(1, m + 'cc');
    ctx.fillStyle = grad;
    ctx.fillRect(0, Y(g, 0.36), g.W, Y(g, 0.28));
  }

  // ---- corner tower ------------------------------------------------------

  function paintTower(ctx, g, sky) {
    const s = g.s;
    const cx = g.cx;
    paintMarble(ctx, g, sky, X(g, -0.125), Y(g, 0.74), X(g, 0.125), g.wy);
    paintBody(ctx, g, sky, X(g, -0.085), Y(g, 0.585), X(g, 0.085), Y(g, 0.74), true, 4);
    paintRoof(ctx, g, sky, { cx, yE: Y(g, 0.585), hwE: 0.135 * s, yT: Y(g, 0.52), hwT: 0.095 * s, up: g.U * 3, snow: 0.4, seed: 21 });
    paintBody(ctx, g, sky, X(g, -0.062), Y(g, 0.455), X(g, 0.062), Y(g, 0.525), true, 3);
    paintRoof(ctx, g, sky, { cx, yE: Y(g, 0.455), hwE: 0.105 * s, yT: Y(g, 0.4), hwT: 0.05 * s, up: g.U * 2.6, snow: 0.4, seed: 22 });
    paintBody(ctx, g, sky, X(g, -0.045), Y(g, 0.375), X(g, 0.045), Y(g, 0.405), true, 2);
    paintRoof(ctx, g, sky, { cx, yE: Y(g, 0.375), hwE: 0.118 * s, yT: Y(g, 0.275), hwT: 0.03 * s, up: g.U * 3.6, snow: 0.42, seed: 23 });
    paintFinial(ctx, g, sky, cx, Y(g, 0.275));
  }

  function paintFinial(ctx, g, sky, cx, yT) {
    ctx.fillStyle = tint(sky, GOLD.hi);
    ctx.fillRect(cx - 0.5, yT - g.U * 2.4, 1.5, g.U * 2);
    ctx.beginPath();
    ctx.arc(cx, yT - g.U * 2.8, Math.max(1.2, g.U * 1.1), 0, TAU);
    ctx.fill();
    ctx.fillStyle = tint(sky, GOLD.ridge);
    ctx.fillRect(cx - g.U * 1.6, yT - g.U * 0.9, g.U * 3.2, Math.max(1, g.U * 0.8));
  }

  // ---- bake --------------------------------------------------------------

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintMist(ctx, g, sky);
    paintHall(ctx, g, sky, -0.62, 0.7, 0.55, 41);
    paintHall(ctx, g, sky, 0.3, 0.8, 0.5, 42);
    paintHall(ctx, g, sky, -0.34, 1, 0.35, 43);
    paintCypress(ctx, g, sky, -0.5, 0.15, rand);
    paintCypress(ctx, g, sky, -0.19, 0.13, rand);
    paintCypress(ctx, g, sky, 0.2, 0.11, rand);
    paintCapWall(ctx, g, sky, 0, X(g, -0.125), 51);
    paintCapWall(ctx, g, sky, X(g, 0.125), g.W, 52);
    paintTower(ctx, g, sky);
    paintBank(ctx, g, sky);
    return c;
  }

  function paintBank(ctx, g, sky) {
    const top = g.H * 0.955;
    ctx.fillStyle = tint(sky, '#e4e2da', 0.3);
    for (let x = 0; x < g.W; x++) {
      const d = g.U * (1.5 + fbm(x * 0.05, 9, 3, 14) * 3);
      ctx.fillRect(x, g.H - d, 1, d);
    }
    ctx.fillStyle = tint(sky, '#9ca3ae', 0.3);
    for (let x = 0; x < g.W; x++) {
      const d = g.U * (1.5 + fbm(x * 0.05, 9, 3, 14) * 3);
      ctx.fillRect(x, g.H - d, 1, 1);
    }
    return top;
  }

  function paintReflection(g, sky, skyLayer, front) {
    const rh = g.H - g.wy;
    const c = layer(g.W, rh + STRIP);
    const ctx = c.getContext('2d');
    const water = mixColor(rgb('#34495d'), sky.low, 0.2);
    const deep = hex(mixColor(water, rgb('#12182a'), sky.night * 0.7));
    ctx.fillStyle = deep;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.save();
    ctx.globalAlpha = 0.62;
    ctx.setTransform(1, 0, 0, -1, 0, g.wy);
    ctx.drawImage(skyLayer, 0, 0);
    ctx.drawImage(front, 0, 0);
    ctx.restore();
    const fade = ctx.createLinearGradient(0, 0, 0, rh);
    fade.addColorStop(0, deep + '33');
    fade.addColorStop(1, deep + 'cc');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = hex(mixColor(rgb('#dcdad0'), sky.amb, 0.3));
    const rand = K.rng(77);
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < g.W * 0.25; i++) ctx.fillRect(rand() * g.W, rand() * rh, g.U * (1 + rand() * 3), 1);
    ctx.globalAlpha = 1;
    state.waterHex = deep;
    return c;
  }

  function paintLantern(g) {
    const w = Math.max(3, Math.round(g.U * 2.6));
    const h = Math.max(5, Math.round(g.U * 4.2));
    const c = layer(w, h + 3);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#c9a34a';
    ctx.fillRect(w * 0.3, 0, Math.max(1, w * 0.4), 1);
    ctx.fillStyle = '#b3382a';
    ctx.beginPath();
    ctx.ellipse(w / 2, 1 + h * 0.42, w / 2, h * 0.38, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#c9a34a';
    ctx.fillRect(w * 0.25, 1 + h * 0.8, w * 0.5, 1);
    ctx.fillRect(w / 2, 2 + h * 0.8, 1, 2);
    return c;
  }

  function paintGlow() {
    const c = layer(40, 40);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(20, 20, 0, 20, 20, 20);
    grad.addColorStop(0, 'rgba(240,176,88,0.5)');
    grad.addColorStop(1, 'rgba(240,176,88,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 40, 40);
    return c;
  }

  function seedFlakes(g) {
    const rand = K.rng(5);
    const f = { x: new Float32Array(MAX_FLAKES), y: new Float32Array(MAX_FLAKES), v: new Float32Array(MAX_FLAKES), a: new Float32Array(MAX_FLAKES), p: new Float32Array(MAX_FLAKES) };
    for (let i = 0; i < MAX_FLAKES; i++) {
      const near = i >= FAR_FLAKES;
      f.x[i] = rand() * g.W;
      f.y[i] = rand() * g.H;
      f.v[i] = (near ? 5.5 : 2.6) * g.U * (0.8 + rand() * 0.5);
      f.a[i] = (near ? 1.4 : 0.8) * g.U * (0.6 + rand());
      f.p[i] = rand() * TAU;
    }
    return f;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    state.sky = paintSky(g, sky);
    state.front = paintFront(g, sky, K.rng(31));
    state.refl = paintReflection(g, sky, state.sky, state.front);
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
    state.overcastAlpha = 0.55 - sky.night * 0.35;
  }

  // ---- motion ------------------------------------------------------------

  function drawWater(ctx, g, t) {
    const rh = g.H - g.wy;
    ctx.fillStyle = state.waterHex;
    ctx.fillRect(0, g.wy, g.W, rh);
    for (let r = 0; r < rh; r += STRIP) {
      const k = r / rh;
      const dx = Math.sin(t * 0.9 + r * 0.45) * g.U * (0.15 + k * 0.5);
      ctx.drawImage(state.refl, 0, r, g.W, STRIP, dx, g.wy + r, g.W, STRIP);
    }
  }

  function drawOvercast(ctx, g, t) {
    const c = state.overcast;
    const off = -((t * g.U * 0.5) % c.width);
    ctx.globalAlpha = state.overcastAlpha;
    ctx.drawImage(c, off, g.H * 0.02);
    ctx.drawImage(c, off + c.width, g.H * 0.02);
    ctx.globalAlpha = 1;
  }

  function drawLanterns(ctx, g, t) {
    const lan = state.lantern;
    const spots = state.lanternSpots;
    for (let i = 0; i < spots.length; i++) {
      const p = spots[i];
      const sway = Math.sin(t * 1.3 + i * 1.7) * 0.14;
      if (state.night > 0.08) {
        ctx.globalAlpha = state.night * 0.7;
        ctx.drawImage(state.glow, p.x - g.U * 3, p.y - g.U * 0.5, g.U * 6, g.U * 6);
        ctx.globalAlpha = 1;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(sway);
      ctx.drawImage(lan, -lan.width / 2, 0);
      ctx.restore();
    }
  }

  function drawSnow(ctx, g, t, amount) {
    if (amount <= 0) return;
    const f = state.flakes;
    const far = Math.min(FAR_FLAKES, Math.round(FAR_FLAKES * amount));
    const near = Math.min(NEAR_FLAKES, Math.round(NEAR_FLAKES * amount));
    ctx.fillStyle = '#f0eee6';
    for (let n = 0; n < far + near; n++) {
      const i = n < far ? n : FAR_FLAKES + (n - far);
      const y = (f.y[i] + t * f.v[i]) % g.H;
      const x = (f.x[i] + Math.sin(t * 0.7 + f.p[i]) * f.a[i] + t * g.U * 1.2 + g.W * 4) % g.W;
      const big = i >= FAR_FLAKES;
      ctx.globalAlpha = big ? 0.9 : 0.6;
      const sz = big ? Math.max(2, g.U * 0.9) : Math.max(1, g.U * 0.5);
      ctx.fillRect(x, y, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.overcast = paintOvercast(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.4));
    state.lantern = paintLantern(g);
    state.glow = paintGlow();
    state.flakes = seedFlakes(g);
    const s = g.s;
    const tip = (hw, yf, up) => ({ y: Y(g, yf) - up });
    state.lanternSpots = [
      { x: X(g, -0.135 * 1.09), y: Y(g, 0.585) - g.U * 3 + g.U * 0.5 },
      { x: X(g, 0.135 * 1.09), y: Y(g, 0.585) - g.U * 3 + g.U * 0.5 },
      { x: X(g, -0.105 * 1.09), y: Y(g, 0.455) - g.U * 2.6 + g.U * 0.5 },
      { x: X(g, 0.105 * 1.09), y: Y(g, 0.455) - g.U * 2.6 + g.U * 0.5 },
    ];
    void s;
    void tip;
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawOvercast(ctx, g, t);
    drawWater(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    if (props.lanterns) drawLanterns(ctx, g, t);
    drawSnow(ctx, g, t, props.snow);
  }

  Kasuri.run({
    defaults: { time: 'auto', snow: 1, lanterns: true, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
