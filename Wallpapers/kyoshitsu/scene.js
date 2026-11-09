/*
 * 教室 Kyoshitsu — an empty wooden classroom at sunset.
 *
 * Outside view, room, light shafts and curtains are baked once and repainted
 * once a minute from the clock. Between repaints only the curtains, clouds,
 * dust, paper cranes, a wind bell and the clock hands move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { lerp, mixColor, toHex, parseColor, smoothstep, fbm } = K;

  const VPY = 0.34;
  const FLOOR = 0.56;
  const WIN = { x0: 0.05, x1: 0.55, y0: 0.17, y1: 0.43 };
  const BOARD = { x0: 0.62, x1: 0.93, y0: 0.25, y1: 0.41 };
  const CLOCK = { x: 0.775, y: 0.165 };
  const ROWS = [2.2, 3.2, 4.2, 5.2];
  const COLS = [-1.5, -0.5, 0.5, 1.5];
  const CURTAINS = [{ x: 0.045, w: 0.07 }, { x: 0.48, w: 0.07 }];
  const MOTES = 34;
  const RETINT_SECONDS = 60;
  const state = {};

  const hex = toHex;
  const rgb = parseColor;

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Tint a colour by the light of the hour, then darken it toward night.
  function tone(g, sky, color, warm) {
    const lit = mixColor(rgb(color), rgb('#f0a050'), warm * (1 - sky.night) * 0.18);
    const dim = mixColor(lit, rgb('#10162a'), sky.night * 0.6);
    return hex(dim);
  }

  // ---- outside -----------------------------------------------------------

  function paintOutside(g, sky, rand) {
    const x0 = g.W * WIN.x0;
    const y0 = g.H * WIN.y0;
    const w = g.W * (WIN.x1 - WIN.x0);
    const h = g.H * (WIN.y1 - WIN.y0);
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, y0, 0, y0 + h);
    grad.addColorStop(0, hex(mixColor(sky.top, rgb('#e8a068'), 0.3 * (1 - sky.night))));
    grad.addColorStop(1, hex(mixColor(sky.low, rgb('#f6c27c'), 0.4 * (1 - sky.night))));
    ctx.fillStyle = grad;
    ctx.fillRect(x0, y0, w, h);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < 40; i++) {
        ctx.globalAlpha = sky.night * (0.2 + rand() * 0.5);
        ctx.fillRect(x0 + rand() * w, y0 + rand() * h * 0.5, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    // Low sun, a round gold disc.
    const dusk = (1 - sky.night) * smoothstep(0.3, 0.9, 1 - Math.abs(sky.hour - 18) / 4);
    if (dusk > 0.05) {
      ctx.fillStyle = `rgba(232,170,80,${0.9 * dusk})`;
      ctx.beginPath();
      ctx.arc(x0 + w * 0.36, y0 + h * 0.66, g.U * 3.4, 0, 6.3);
      ctx.fill();
    }
    // Far mountains and tiled roofs.
    const base = y0 + h * 0.86;
    ctx.fillStyle = hex(mixColor(sky.haze, rgb('#2c3550'), 0.25 + sky.night * 0.3));
    ctx.beginPath();
    ctx.moveTo(x0, base);
    for (let i = 0; i <= 24; i++) {
      const fx = i / 24;
      ctx.lineTo(x0 + fx * w, base - h * (0.12 + 0.26 * fbm(fx * 3.1, 1, 3, 7) * Math.sin(fx * 3.14)));
    }
    ctx.lineTo(x0 + w, base);
    ctx.fill();
    ctx.fillStyle = tone(g, sky, '#2c3040', 0);
    ctx.fillRect(x0, base - h * 0.04, w, h * 0.2);
    for (let i = 0; i < 4; i++) {
      const rx = x0 + w * (0.04 + i * 0.22 + rand() * 0.05);
      const rw = w * (0.12 + rand() * 0.05);
      ctx.beginPath();
      ctx.moveTo(rx, base - h * 0.02);
      ctx.lineTo(rx + rw * 0.12, base - h * 0.1);
      ctx.lineTo(rx + rw * 0.88, base - h * 0.1);
      ctx.lineTo(rx + rw, base - h * 0.02);
      ctx.fill();
    }
    paintPine(ctx, g, sky, x0 + w * 0.8, base, h);
    paintPole(ctx, g, sky, x0 + w * 0.14, base, h, w);
    return c;
  }

  // A black pine: bent trunk, flat clouds of needles.
  function paintPine(ctx, g, sky, px, base, h) {
    const ink = tone(g, sky, '#1e2a24', 0);
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, g.U * 0.9);
    ctx.beginPath();
    ctx.moveTo(px, base);
    ctx.quadraticCurveTo(px - g.U * 2, base - h * 0.35, px + g.U * 1.5, base - h * 0.62);
    ctx.stroke();
    ctx.fillStyle = ink;
    const pads = [[0, -0.62, 6], [-5, -0.5, 5], [5, -0.4, 5], [-2, -0.3, 4]];
    for (const p of pads) {
      ctx.beginPath();
      ctx.ellipse(px + g.U * p[0], base + h * p[1], g.U * p[2], g.U * p[2] * 0.4, 0, 0, 6.3);
      ctx.fill();
    }
  }

  function paintPole(ctx, g, sky, px, base, h, w) {
    const ink = tone(g, sky, '#23262e', 0);
    ctx.fillStyle = ink;
    ctx.fillRect(px, base - h * 0.78, Math.max(1, g.U * 0.5), h * 0.8);
    ctx.fillRect(px - g.U * 2, base - h * 0.7, g.U * 4.5, 1);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      ctx.moveTo(px - g.U * 2, base - h * 0.7);
      ctx.quadraticCurveTo(px + w * 0.4, base - h * (0.55 - k * 0.06), px + w, base - h * (0.66 - k * 0.04));
      ctx.stroke();
    }
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(fbm(x * 0.03, y * 0.12, 3, 21), fbm((x - c.width) * 0.03, y * 0.12, 3, 21), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = 250;
        img.data[i + 1] = 214;
        img.data[i + 2] = 184;
        img.data[i + 3] = smoothstep(0.5, 0.72, v) * band * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- room --------------------------------------------------------------

  function px(f, g) { return g.W * f; }
  function py(f, g) { return g.H * f; }

  function paintWall(ctx, g, sky) {
    ctx.fillStyle = tone(g, sky, '#d8cdb0', 1);
    ctx.fillRect(0, 0, g.W, py(FLOOR, g));
    ctx.fillStyle = tone(g, sky, '#c9bd9c', 1);
    ctx.fillRect(0, 0, g.W, py(0.09, g));
    ctx.fillStyle = tone(g, sky, '#6e4e34', 1);
    ctx.fillRect(0, py(0.43, g), g.W, py(FLOOR - 0.43, g));
    ctx.fillStyle = tone(g, sky, '#503822', 1);
    ctx.fillRect(0, py(0.43, g), g.W, Math.max(1, g.U * 0.7));
    for (let f = 0.02; f < 1; f += 0.045) ctx.fillRect(px(f, g), py(0.44, g), 1, py(FLOOR - 0.44, g));
  }

  function paintWindows(ctx, g, sky) {
    const x0 = px(WIN.x0, g);
    const y0 = py(WIN.y0, g);
    const w = px(WIN.x1 - WIN.x0, g);
    const h = py(WIN.y1 - WIN.y0, g);
    ctx.clearRect(x0, y0, w, h);
    ctx.fillStyle = tone(g, sky, '#5c4128', 1);
    const bar = Math.max(1, g.U * 0.7);
    for (let i = 0; i <= 6; i++) ctx.fillRect(x0 + (w - bar) * (i / 6), y0, bar, h);
    for (let j = 0; j <= 3; j++) ctx.fillRect(x0, y0 + (h - bar) * (j / 3), w, bar);
    ctx.fillRect(x0 - bar, y0 - bar, w + bar * 2, bar);
    ctx.fillRect(x0 - bar, y0 + h, w + bar * 2, bar * 1.6);
    ctx.fillStyle = tone(g, sky, '#c8b068', 1);
    for (let i = 1; i < 6; i += 2) ctx.fillRect(x0 + (w - bar) * (i / 6) + bar, y0 + h * 0.5, bar * 1.2, bar * 1.2);
  }

  function paintBoard(ctx, g, sky) {
    const x0 = px(BOARD.x0, g);
    const y0 = py(BOARD.y0, g);
    const w = px(BOARD.x1 - BOARD.x0, g);
    const h = py(BOARD.y1 - BOARD.y0, g);
    const fr = Math.max(1, g.U * 0.9);
    ctx.fillStyle = tone(g, sky, '#6e4e34', 1);
    ctx.fillRect(x0 - fr, y0 - fr, w + fr * 2, h + fr * 2.6);
    ctx.fillStyle = tone(g, sky, '#2f4a40', 0.5);
    ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = tone(g, sky, '#6f8176', 0.5);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x0 + w * 0.1, y0 + h * 0.3, w * 0.5, 1);
    ctx.fillRect(x0 + w * 0.1, y0 + h * 0.5, w * 0.35, 1);
    ctx.fillRect(x0 + w * 0.55, y0 + h * 0.7, w * 0.25, 1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = tone(g, sky, '#e8e2d0', 1);
    ctx.fillRect(x0 + w * 0.3, y0 + h + fr * 0.4, w * 0.06, Math.max(1, fr * 0.5));
    // Blank paper notices on the wall.
    ctx.fillStyle = tone(g, sky, '#ece4cc', 1);
    ctx.fillRect(px(0.58, g), py(0.3, g), px(0.025, g), py(0.05, g));
    ctx.fillRect(px(0.955, g), py(0.28, g), px(0.025, g), py(0.06, g));
    ctx.fillStyle = tone(g, sky, '#b8412c', 1);
    ctx.fillRect(px(0.58, g), py(0.3, g), px(0.025, g), Math.max(1, g.U * 0.5));
  }

  function paintClockFace(ctx, g, sky) {
    const cx = px(CLOCK.x, g);
    const cy = py(CLOCK.y, g);
    const r = g.U * 5;
    ctx.fillStyle = tone(g, sky, '#6e4e34', 1);
    ctx.beginPath();
    ctx.arc(cx, cy, r + g.U * 0.8, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = tone(g, sky, '#efe8d4', 1);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = tone(g, sky, '#2a2c3a', 0);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 6.283;
      ctx.fillRect(cx + Math.sin(a) * r * 0.82 - 0.5, cy - Math.cos(a) * r * 0.82 - 0.5, 1, 1);
    }
  }

  // ---- floor and desks ---------------------------------------------------

  function paintFloor(ctx, g, sky, rand) {
    const top = py(FLOOR, g);
    ctx.fillStyle = tone(g, sky, '#b08450', 1);
    ctx.fillRect(0, top, g.W, g.H - top);
    const vpx = g.W * 0.5;
    const vpy = py(VPY, g);
    for (let i = -14; i <= 14; i++) {
      const xb = vpx + i * g.W * 0.085;
      const xt = vpx + (xb - vpx) * ((top - vpy) / (g.H - vpy));
      ctx.strokeStyle = tone(g, sky, rand() > 0.5 ? '#8a6438' : '#946c40', 1);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xt, top);
      ctx.lineTo(xb, g.H);
      ctx.stroke();
    }
    ctx.fillStyle = tone(g, sky, '#5c3e24', 1);
    for (let d = 2; d < 8; d += 1.3) {
      const yy = vpy + (g.H - vpy) * (2 / d);
      if (yy > top) ctx.fillRect(0, yy, g.W, 1);
    }
    ctx.fillStyle = tone(g, sky, '#4a321c', 1);
    ctx.fillRect(0, top, g.W, Math.max(1, g.U * 0.6));
  }

  function paintDesk(ctx, g, sky, d, col) {
    const k = 2 / d;
    const yf = VPY + (1 - VPY) * k;
    const unit = g.W * 0.247 * k;
    const cx = g.W * 0.5 + col * unit;
    const wd = unit * 0.62;
    const top = py(yf, g) - g.H * 0.31 * k;
    const dep = g.H * 0.05 * k;
    const wood = tone(g, sky, '#c49a60', 1);
    const dark = tone(g, sky, '#6a4a2c', 1);
    ctx.fillStyle = dark;
    const leg = Math.max(1, unit * 0.04);
    ctx.fillRect(cx - wd / 2 + leg, top, leg, py(yf, g) - top);
    ctx.fillRect(cx + wd / 2 - leg * 2, top, leg, py(yf, g) - top);
    ctx.fillRect(cx - wd * 0.5, top + (py(yf, g) - top) * 0.55, wd, Math.max(1, leg * 0.7));
    ctx.fillStyle = tone(g, sky, '#dcb274', 1);
    ctx.beginPath();
    ctx.moveTo(cx - wd * 0.42, top - dep);
    ctx.lineTo(cx + wd * 0.42, top - dep);
    ctx.lineTo(cx + wd / 2, top);
    ctx.lineTo(cx - wd / 2, top);
    ctx.fill();
    ctx.fillStyle = wood;
    ctx.fillRect(cx - wd / 2, top, wd, Math.max(1, g.H * 0.02 * k));
    // Chair back, nearer to us, with a seat below.
    const sh = g.H * 0.17 * k;
    ctx.fillStyle = dark;
    ctx.fillRect(cx - wd * 0.3, top + g.H * 0.04 * k, wd * 0.6, sh * 0.28);
    ctx.fillStyle = wood;
    ctx.fillRect(cx - wd * 0.3, top + g.H * 0.04 * k + sh * 0.28, wd * 0.6, Math.max(1, g.H * 0.012 * k));
    ctx.fillStyle = dark;
    ctx.fillRect(cx - wd * 0.26, top + g.H * 0.04 * k + sh * 0.28, leg, py(yf, g) - top - sh * 0.36);
    ctx.fillRect(cx + wd * 0.26, top + g.H * 0.04 * k + sh * 0.28, leg, py(yf, g) - top - sh * 0.36);
  }

  function paintDesks(ctx, g, sky) {
    for (let i = ROWS.length - 1; i >= 0; i--) {
      for (const col of COLS) paintDesk(ctx, g, sky, ROWS[i], col);
    }
    // One forgotten notebook on a near desk, blank.
    const k = 2 / ROWS[2];
    const yf = VPY + (1 - VPY) * k;
    ctx.fillStyle = tone(g, sky, '#c8c0a8', 1);
    ctx.fillRect(g.W * (0.5 + 0.5 * g.W * 0.247 * k / g.W) - g.U * 1.2, py(yf, g) - g.H * 0.325 * k, g.U * 2, Math.max(1, g.U * 0.6));
  }

  function paintCicada(ctx, g, sky) {
    const x = px(WIN.x0 + 0.18, g);
    const y = py(WIN.y0 + 0.113, g);
    ctx.fillStyle = tone(g, sky, '#2a2420', 0);
    ctx.beginPath();
    ctx.ellipse(x, y, g.U * 0.9, g.U * 0.5, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = 'rgba(210,200,170,0.5)';
    ctx.fillRect(x - g.U * 0.8, y - g.U * 0.4, g.U * 1.8, Math.max(1, g.U * 0.35));
  }

  // ---- light and curtains -----------------------------------------------

  function paintShafts(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const day = 1 - sky.night;
    const colour = sky.night > 0.5 ? '150,170,220' : '255,184,104';
    const strength = sky.night > 0.5 ? 0.1 : 0.34 * day + 0.06;
    for (let i = 0; i < 3; i++) {
      const sx0 = px(WIN.x0 + 0.04 + i * 0.16, g);
      const sw = px(0.1, g);
      const grad = ctx.createLinearGradient(0, py(WIN.y1, g), 0, g.H);
      grad.addColorStop(0, `rgba(${colour},${strength})`);
      grad.addColorStop(1, `rgba(${colour},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(sx0, py(WIN.y0, g));
      ctx.lineTo(sx0 + sw, py(WIN.y0, g));
      ctx.lineTo(sx0 + sw * 2.4 + px(0.12, g), g.H);
      ctx.lineTo(sx0 + px(0.1, g), g.H);
      ctx.fill();
    }
    return c;
  }

  function paintCurtain(g, sky, w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const base = rgb('#e6dcc0');
    for (let x = 0; x < c.width; x++) {
      const fold = 0.5 + 0.5 * Math.sin(x * 1.1);
      const col = mixColor(base, rgb('#a8987a'), (1 - fold) * 0.45);
      ctx.fillStyle = tone(g, sky, hex(col), 1);
      ctx.fillRect(x, 0, 1, c.height);
    }
    ctx.fillStyle = tone(g, sky, '#8a7a5c', 1);
    ctx.fillRect(0, 0, c.width, Math.max(1, g.U * 0.5));
    return c;
  }

  function paintStrand(g, sky, len) {
    const w = Math.max(6, Math.round(g.U * 6));
    const c = layer(w, len);
    const ctx = c.getContext('2d');
    ctx.fillStyle = tone(g, sky, '#8a7a5c', 1);
    ctx.fillRect(w / 2, 0, 1, len);
    const inks = ['#b8412c', '#ece4cc', '#2f4a86', '#c8a040', '#b8412c'];
    for (let i = 0; i < inks.length; i++) {
      const y = len * (0.25 + i * 0.17);
      ctx.fillStyle = tone(g, sky, inks[i], 1);
      ctx.beginPath();
      ctx.moveTo(w / 2, y - g.U * 1.2);
      ctx.lineTo(w / 2 + g.U * 1.5, y);
      ctx.lineTo(w / 2, y + g.U * 1.2);
      ctx.lineTo(w / 2 - g.U * 1.5, y);
      ctx.fill();
    }
    return c;
  }

  function paintBell(g, sky) {
    const w = Math.max(6, Math.round(g.U * 4));
    const h = Math.round(g.U * 9);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = tone(g, sky, '#8a7a5c', 1);
    ctx.fillRect(w / 2, 0, 1, g.U * 2.5);
    ctx.fillStyle = tone(g, sky, '#9fb4b8', 1);
    ctx.beginPath();
    ctx.arc(w / 2, g.U * 4.4, g.U * 1.8, 3.14, 6.28);
    ctx.fill();
    ctx.fillRect(w / 2 - g.U * 1.8, g.U * 4.4, g.U * 3.6, Math.max(1, g.U * 0.4));
    ctx.fillStyle = tone(g, sky, '#b8412c', 1);
    ctx.fillRect(w / 2 - 0.5, g.U * 4.8, 1, g.U * 1.6);
    ctx.fillStyle = tone(g, sky, '#ece4cc', 1);
    ctx.fillRect(w / 2 - g.U * 0.7, g.U * 6.4, g.U * 1.4, g.U * 2.5);
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(17);
    state.outside = paintOutside(g, sky, rand);
    const room = layer(g.W, g.H);
    const ctx = room.getContext('2d');
    paintWall(ctx, g, sky);
    paintBoard(ctx, g, sky);
    paintClockFace(ctx, g, sky);
    paintFloor(ctx, g, sky, rand);
    paintDesks(ctx, g, sky);
    paintWindows(ctx, g, sky);
    paintCicada(ctx, g, sky);
    state.room = room;
    state.shafts = paintShafts(g, sky);
    const ch = py(WIN.y1 + 0.02 - 0.12, g);
    state.curtain = paintCurtain(g, sky, px(0.07, g), py(0.31, g));
    state.strand = paintStrand(g, sky, py(0.17, g));
    state.bell = paintBell(g, sky);
    state.cloudAlpha = 0.8 * (1 - sky.night * 0.7);
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
    state.curtainH = ch;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const x0 = px(WIN.x0, g);
    const y0 = py(WIN.y0, g);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, px(WIN.x1 - WIN.x0, g), py(WIN.y1 - WIN.y0, g) * 0.6);
    ctx.clip();
    const off = -((t * g.U * 0.8) % c.width);
    ctx.globalAlpha = state.cloudAlpha;
    ctx.drawImage(c, x0 + off, y0);
    ctx.drawImage(c, x0 + off + c.width, y0);
    ctx.restore();
  }

  function drawCurtains(ctx, g, t, breeze) {
    const art = state.curtain;
    const top = py(WIN.y0 - 0.012, g);
    for (let n = 0; n < CURTAINS.length; n++) {
      const bx = px(CURTAINS[n].x, g);
      for (let s = 0; s < art.width; s++) {
        const wave = Math.sin(t * 0.9 + s * 0.35 + n * 2.1);
        const swell = (0.5 + 0.5 * Math.sin(t * 0.45 + n)) * breeze;
        const lift = wave * g.U * 0.5 * breeze;
        const bulge = swell * g.U * 2.2 * (n === 0 ? 1 : -1);
        const shift = bulge * (s / art.width);
        ctx.drawImage(art, s, 0, 1, art.height, bx + s + shift * 0.4, top + lift, 1, art.height * (1 - 0.03 * swell));
      }
    }
  }

  function drawStrands(ctx, g, t, breeze) {
    const strand = state.strand;
    const spots = [0.3, 0.5, 0.7];
    for (let i = 0; i < spots.length; i++) {
      const sway = Math.sin(t * 0.8 + i * 1.9) * 0.05 * (0.4 + breeze * 0.6);
      ctx.save();
      ctx.translate(px(spots[i], g), 0);
      ctx.rotate(sway);
      ctx.drawImage(strand, -strand.width / 2, 0);
      ctx.restore();
    }
    const bell = state.bell;
    ctx.save();
    ctx.translate(px(0.4, g), py(WIN.y0 + 0.004, g));
    ctx.rotate(Math.sin(t * 1.3) * 0.12 * (0.3 + breeze * 0.7));
    ctx.drawImage(bell, -bell.width / 2, 0);
    ctx.restore();
  }

  function drawDust(ctx, g, t) {
    const m = state.motes;
    ctx.fillStyle = state.night > 0.5 ? '#bcc6e6' : '#ffe2a8';
    const x0 = px(WIN.x0, g);
    const w = px(0.55, g);
    for (let i = 0; i < MOTES; i++) {
      const a = m[i];
      const x = x0 + ((a.x + Math.sin(t * 0.2 + a.p) * 0.03 + t * 0.002 * a.s) % 1) * w;
      const y = py(0.25, g) + (((a.y + t * 0.01 * a.s) % 1) * py(0.7, g));
      ctx.globalAlpha = (0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 0.7 + a.p))) * (state.night > 0.5 ? 0.5 : 1);
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawHands(ctx, g, t, speed) {
    const cx = px(CLOCK.x, g);
    const cy = py(CLOCK.y, g);
    const r = g.U * 5;
    const hour = S.hour(state.choice) + t * speed / 3600;
    const minute = (hour % 1) * 60;
    const hand = (angle, len, color) => {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin(angle) * len, cy - Math.cos(angle) * len);
      ctx.stroke();
    };
    ctx.lineWidth = 1;
    hand(((hour % 12) / 12) * 6.283, r * 0.5, '#2a2c3a');
    hand((minute / 60) * 6.283, r * 0.78, '#2a2c3a');
    hand(((t * speed) % 60 / 60) * 6.283, r * 0.85, '#b8412c');
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 0.9), Math.ceil(g.H * 0.15));
    const rand = K.rng(5);
    state.motes = [];
    for (let i = 0; i < MOTES; i++) state.motes.push({ x: rand(), y: rand(), p: rand() * 6.3, s: 0.5 + rand() });
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.fillStyle = '#10162a';
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.drawImage(state.outside, 0, 0);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.room, 0, 0);
    drawCurtains(ctx, g, t, props.breeze);
    ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 0.5);
    ctx.drawImage(state.shafts, 0, 0);
    ctx.globalAlpha = 1;
    drawStrands(ctx, g, t, props.breeze);
    drawHands(ctx, g, t, api.speed || 1);
    if (props.dust) drawDust(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'dusk', breeze: 1, dust: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
