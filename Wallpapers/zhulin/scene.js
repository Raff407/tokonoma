/*
 * 竹林 Zhulin — a misty bamboo grove with a small pavilion far back.
 *
 * Sky, far canes, pavilion and the ground are baked once. Each mid and near cane is
 * its own baked strip, tilted about its foot by a slow wind wave. Mist is a tiling
 * strip, light shafts are one baked layer that breathes, and a few leaves fall.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep, mixColor, toHex, parseColor } = K;

  const TAU = Math.PI * 2;
  const SKY = ['#c3cdbb', '#d3d8c3', '#e2dfc6', '#e8e2c8'];
  const WASHI = parseColor('#e6e2cb');
  const CANE = {
    far: ['#8fa08c', '#a3b1a0'],
    mid: ['#5f7a58', '#76905f'],
    near: ['#3a5236', '#4f6c45'],
  };
  const LEAF = {
    mid: ['#667f55', '#7b9262', '#58724c'],
    near: ['#3f5a38', '#52703f', '#2f4630'],
  };
  const FALL = ['#6b8452', '#8a9b5a', '#a39a52'];
  const NEAR = 7;
  const MID = 14;
  const FALLING = 9;
  const SHAFTS = 4;
  const MIST_BANDS = 2;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function haze(hex, amount) {
    return toHex(mixColor(parseColor(hex), WASHI, amount));
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    return { W, H, U, ground: Math.round(H * 0.84) };
  }

  function tri(ctx, x0, y0, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.fill();
  }

  // ---- back layer ------------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.H);
    const inks = SKY.map(parseColor);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / g.ground) * (inks.length - 1);
      const k = Math.min(inks.length - 2, Math.floor(f));
      for (let x = 0; x < g.W; x++) {
        const ink = inks[k + (rand() < f - k ? 1 : 0)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function paintHills(ctx, g) {
    const tones = ['#b4c0b0', '#9fae9f'];
    for (let r = 0; r < 2; r++) {
      ctx.fillStyle = tones[r];
      ctx.beginPath();
      ctx.moveTo(0, g.ground);
      for (let x = 0; x <= g.W + 3; x += 3) {
        const y = g.H * (0.46 + r * 0.1) - fbm(x / (g.U * 38), r * 3.1, 3, 17 + r) * g.H * 0.16;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(g.W, g.ground);
      ctx.closePath();
      ctx.fill();
    }
  }

  // A small hip-roofed pavilion with upturned eaves, seen through mist.
  function paintPavilion(ctx, g) {
    const u = g.U;
    const cx = g.W * 0.58;
    const gy = g.ground - u * 5;
    const w = u * 17;
    const roof = '#44545a';
    const wall = '#6e7d78';
    ctx.fillStyle = '#7d8b88';
    ctx.fillRect(cx - w * 0.62, gy - u * 1.2, w * 1.24, u * 1.2);
    ctx.fillStyle = wall;
    ctx.fillRect(cx - w * 0.5, gy - u * 6.2, w, u * 5);
    ctx.fillStyle = '#5c6b6c';
    for (let i = 0; i < 5; i++) ctx.fillRect(cx - w * 0.5 + (w - u * 0.7) * (i / 4), gy - u * 6.2, u * 0.7, u * 5);
    ctx.fillStyle = '#a4aca2';
    ctx.fillRect(cx - w * 0.38, gy - u * 5.2, w * 0.76, u * 3.6);
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.9, gy - u * 7.3);
    ctx.quadraticCurveTo(cx - w * 0.55, gy - u * 6.2, cx - w * 0.52, gy - u * 6.6);
    ctx.lineTo(cx - w * 0.2, gy - u * 12);
    ctx.lineTo(cx + w * 0.2, gy - u * 12);
    ctx.lineTo(cx + w * 0.52, gy - u * 6.6);
    ctx.quadraticCurveTo(cx + w * 0.55, gy - u * 6.2, cx + w * 0.9, gy - u * 7.3);
    ctx.quadraticCurveTo(cx + w * 0.5, gy - u * 5.4, cx, gy - u * 5.4);
    ctx.quadraticCurveTo(cx - w * 0.5, gy - u * 5.4, cx - w * 0.9, gy - u * 7.3);
    ctx.fill();
    ctx.fillStyle = '#566568';
    ctx.fillRect(cx - w * 0.2, gy - u * 12.6, w * 0.4, u * 0.8);
    ctx.fillRect(cx - u * 0.3, gy - u * 14.2, u * 0.6, u * 1.8);
  }

  function paintFarCanes(ctx, g, rand) {
    const n = Math.round(g.W / (g.U * 2.6));
    for (let i = 0; i < n; i++) {
      const x = (i + rand() * 0.9) * (g.W / n);
      const w = g.U * (0.5 + rand() * 0.4);
      const top = g.H * (rand() * 0.2);
      const base = g.ground - g.U * (1 + rand() * 4);
      ctx.fillStyle = CANE.far[rand() < 0.5 ? 0 : 1];
      ctx.globalAlpha = 0.5 + rand() * 0.3;
      ctx.fillRect(x, top, w, base - top);
      ctx.fillStyle = '#7d8e7b';
      const step = g.U * (6 + rand() * 3);
      for (let y = base - step; y > top; y -= step) ctx.fillRect(x - 0.3, y, w + 0.6, Math.max(1, g.U * 0.35));
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#93a58f';
      for (let k = 0; k < 4; k++) {
        const ly = top + g.H * (0.04 + rand() * 0.25);
        const dir = rand() < 0.5 ? -1 : 1;
        tri(ctx, x, ly, x + dir * g.U * 4, ly + g.U * 2.4, x + dir * g.U * 1.5, ly + g.U * 0.4);
      }
    }
    ctx.globalAlpha = 1;
  }

  function paintGround(ctx, g, rand) {
    const grd = ctx.createLinearGradient(0, g.ground - g.U * 4, 0, g.H);
    grd.addColorStop(0, '#7d9273');
    grd.addColorStop(0.35, '#5f7a52');
    grd.addColorStop(1, '#455a3c');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 3; x += 3) ctx.lineTo(x, g.ground + (fbm(x / (g.U * 20), 8.2, 2, 9) - 0.5) * g.U * 3);
    ctx.lineTo(g.W, g.H);
    ctx.fill();
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintHills(ctx, g);
    paintPavilion(ctx, g);
    ctx.fillStyle = haze('#9fae98', 0.2);
    ctx.globalAlpha = 0.3;
    ctx.fillRect(0, g.ground - g.U * 14, g.W, g.U * 14);
    ctx.globalAlpha = 1;
    paintFarCanes(ctx, g, rand);
    paintGround(ctx, g, rand);
    return c;
  }

  // ---- canes -----------------------------------------------------------------

  function leafSpray(ctx, rand, x, y, len, dir, tones) {
    const bx = x + dir * len * 0.45;
    const by = y - len * 0.05;
    ctx.strokeStyle = tones[2];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(bx, by);
    ctx.stroke();
    const count = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 0.5 + (rand() - 0.5) * 0.25;
      const ang = Math.PI / 2 + spread * dir * -1 + dir * 0.35;
      const l = len * (0.55 + rand() * 0.4);
      const tx = bx + Math.cos(ang) * l * 0.9;
      const ty = by + Math.sin(ang) * l * 0.9;
      ctx.fillStyle = tones[Math.floor(rand() * 2)];
      const nx = (ty - by) * 0.16;
      const ny = (tx - bx) * 0.16;
      tri(ctx, bx - nx, by + ny, bx + nx, by - ny, tx, ty);
    }
  }

  function makeCane(g, rand, o) {
    const margin = Math.ceil(o.leaf * 1.4);
    const h = g.H;
    const c = layer(o.w + margin * 2 + 2, h);
    const ctx = c.getContext('2d');
    const ox = margin + 1;
    const seg = o.seg * (0.85 + rand() * 0.3);
    const bend = (rand() - 0.5) * g.U * 3;
    const base = o.tones[0];
    const lit = o.tones[1];
    const nodeCol = o.node;
    const xAt = (y) => ox + bend * Math.pow(1 - y / h, 2);
    for (let y = 0; y < h; y++) {
      const w = o.w * (0.72 + 0.28 * (y / h));
      const x = xAt(y);
      const phase = (h - y) % seg;
      const isNode = phase < Math.max(1, o.w * 0.28);
      ctx.fillStyle = isNode ? nodeCol : base;
      ctx.fillRect(x - w / 2, y, w, 1);
      if (!isNode) {
        ctx.fillStyle = lit;
        ctx.fillRect(x - w / 2, y, Math.max(1, w * 0.3), 1);
      } else {
        ctx.fillStyle = lit;
        ctx.fillRect(x - w / 2 - 0.5, y, w + 1, 1);
      }
    }
    let side = rand() < 0.5 ? -1 : 1;
    for (let y = h - seg; y > 0; y -= seg) {
      if (y > h * o.leafTo) continue;
      const x = xAt(y);
      const w = o.w * (0.72 + 0.28 * (y / h));
      const reps = y < h * 0.25 ? 2 : 1;
      for (let k = 0; k < reps; k++) {
        leafSpray(ctx, rand, x + side * w * 0.4, y, o.leaf * (0.75 + rand() * 0.4), side, o.leaves);
        side = -side;
      }
    }
    return { c, ox, h };
  }

  function makeCanes(g, rand, count, spec) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const slot = g.W / count;
      const x = (i + 0.15 + rand() * 0.7) * slot;
      const cane = makeCane(g, rand, spec);
      cane.x = x;
      cane.phase = rand() * TAU;
      cane.freq = 0.5 + rand() * 0.35;
      cane.amp = spec.amp * (0.7 + rand() * 0.6);
      out.push(cane);
    }
    return out;
  }

  // ---- mist and light --------------------------------------------------------

  function makeMist(g, seed) {
    const h = Math.round(g.U * 26);
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    const rand = K.rng(seed);
    const n = Math.round(g.W / (g.U * 9));
    for (let i = 0; i < n; i++) {
      const x = rand() * g.W;
      const y = h * (0.3 + rand() * 0.4);
      const rx = g.U * (9 + rand() * 14);
      const ry = g.U * (1.8 + rand() * 3);
      for (const dx of [-g.W, 0, g.W]) {
        const grd = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, rx);
        grd.addColorStop(0, 'rgba(232,230,212,0.55)');
        grd.addColorStop(1, 'rgba(232,230,212,0)');
        ctx.save();
        ctx.translate(0, y);
        ctx.scale(1, ry / rx);
        ctx.translate(0, -y);
        ctx.fillStyle = grd;
        ctx.fillRect(x + dx - rx, y - rx, rx * 2, rx * 2);
        ctx.restore();
      }
    }
    return c;
  }

  function makeShafts(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const tmp = layer(g.W, g.H);
    const t = tmp.getContext('2d');
    for (let i = 0; i < SHAFTS; i++) {
      const x0 = g.W * (0.08 + (i + rand() * 0.6) * (0.9 / SHAFTS));
      const sw = g.U * (7 + rand() * 9);
      t.clearRect(0, 0, g.W, g.H);
      const h = t.createLinearGradient(x0, 0, x0 + sw, 0);
      h.addColorStop(0, 'rgba(240,226,160,0)');
      h.addColorStop(0.5, 'rgba(246,230,150,0.8)');
      h.addColorStop(1, 'rgba(240,226,160,0)');
      t.globalCompositeOperation = 'source-over';
      t.fillStyle = h;
      t.fillRect(x0 - sw, 0, sw * 3, g.H);
      t.globalCompositeOperation = 'destination-in';
      const v = t.createLinearGradient(0, 0, 0, g.H * 0.95);
      v.addColorStop(0, 'rgba(0,0,0,0.9)');
      v.addColorStop(0.7, 'rgba(0,0,0,0.5)');
      v.addColorStop(1, 'rgba(0,0,0,0)');
      t.fillStyle = v;
      t.fillRect(0, 0, g.W, g.H);
      ctx.setTransform(1, 0, -0.32, 1, g.H * 0.2 + x0 * 0, 0);
      ctx.globalAlpha = 0.5 + rand() * 0.3;
      ctx.drawImage(tmp, 0, 0);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- foreground ------------------------------------------------------------

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const rx = g.W * 0.2;
    const ry = g.H * 0.93;
    ctx.fillStyle = '#5a5f5c';
    ctx.beginPath();
    ctx.moveTo(rx - g.U * 9, g.H);
    ctx.bezierCurveTo(rx - g.U * 11, ry + g.U * 3, rx - g.U * 6, ry - g.U * 3, rx - g.U * 3, ry - g.U * 0.5);
    ctx.bezierCurveTo(rx - g.U * 1.5, ry - g.U * 5, rx + g.U * 2, ry - g.U * 1.5, rx + g.U * 4, ry - g.U * 4);
    ctx.bezierCurveTo(rx + g.U * 6, ry - g.U * 1, rx + g.U * 11, ry + g.U * 2, rx + g.U * 10, g.H);
    ctx.fill();
    ctx.fillStyle = '#767a75';
    ctx.beginPath();
    ctx.ellipse(rx - g.U * 2.5, ry + g.U * 0.5, g.U * 1.1, g.U * 0.6, 0.3, 0, TAU);
    ctx.ellipse(rx + g.U * 3, ry - g.U * 1.2, g.U * 0.9, g.U * 0.5, -0.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#3d4d37';
    ctx.fillRect(rx - g.U * 9, g.H - g.U * 1.5, g.U * 19, g.U * 1.5);
    const blades = Math.round(g.W / (g.U * 1.2));
    for (let i = 0; i < blades; i++) {
      const x = rand() * g.W;
      const l = g.U * (2 + rand() * 4);
      ctx.fillStyle = rand() < 0.5 ? '#334a31' : '#496240';
      const lean = (rand() - 0.5) * g.U * 2;
      tri(ctx, x - g.U * 0.3, g.H, x + g.U * 0.3, g.H, x + lean, g.H - l);
    }
    return c;
  }

  function makeFalling(g, rand) {
    const f = { x: new Float32Array(FALLING), y: new Float32Array(FALLING), p: new Float32Array(FALLING), v: new Float32Array(FALLING), s: new Float32Array(FALLING), tone: new Uint8Array(FALLING) };
    for (let i = 0; i < FALLING; i++) resetFall(g, f, i, rand, true);
    return f;
  }

  function resetFall(g, f, i, rand, first) {
    f.x[i] = rand() * g.W;
    f.y[i] = first ? rand() * g.H : -g.U * 3 - rand() * g.H * 0.3;
    f.p[i] = rand() * TAU;
    f.v[i] = g.U * (2 + rand() * 2);
    f.s[i] = g.U * (1.6 + rand() * 1.2);
    f.tone[i] = Math.floor(rand() * FALL.length);
  }

  // ---- run -------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.mid = makeCanes(g, rand, MID, {
      w: Math.max(2, g.U * 1.9), seg: g.U * 11, leaf: g.U * 6.5, leafTo: 0.6, amp: 0.016,
      tones: [haze(CANE.mid[0], 0.22), haze(CANE.mid[1], 0.22)], node: haze('#445a40', 0.25),
      leaves: LEAF.mid.map((h) => haze(h, 0.22)),
    });
    state.near = makeCanes(g, rand, NEAR, {
      w: Math.max(3, g.U * 4.2), seg: g.U * 16, leaf: g.U * 10, leafTo: 0.48, amp: 0.024,
      tones: CANE.near, node: '#273a29', leaves: LEAF.near,
    });
    state.mist = [makeMist(g, 5), makeMist(g, 11)];
    state.shafts = makeShafts(g, rand);
    state.front = paintFront(g, rand);
    state.fall = makeFalling(g, rand);
  }

  function drawCanes(ctx, g, t, list, wind) {
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const gust = Math.sin(t * 0.42 - c.x / (g.W * 0.35)) * 0.6 + 0.4;
      const a = (Math.sin(t * c.freq + c.phase) * 0.55 + gust) * c.amp * wind;
      const cs = Math.cos(a);
      const sn = Math.sin(a);
      ctx.setTransform(cs, sn, -sn, cs, c.x, c.h);
      ctx.drawImage(c.c, -c.ox, -c.h);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawMist(ctx, g, t, k, amount, y, speed, alpha) {
    if (amount <= 0.01) return;
    const strip = state.mist[k];
    const off = (t * speed * g.U) % g.W;
    ctx.globalAlpha = Math.min(1, alpha * amount);
    ctx.drawImage(strip, off - g.W, y);
    ctx.drawImage(strip, off, y);
    ctx.globalAlpha = 1;
  }

  function drawFalling(ctx, g, t, dt, wind) {
    const f = state.fall;
    for (let i = 0; i < FALLING; i++) {
      f.y[i] += f.v[i] * dt;
      f.x[i] += (g.U * 1.6 + Math.sin(t * 0.9 + f.p[i]) * g.U * 1.2) * dt * (0.4 + wind * 0.6);
      if (f.y[i] > g.H + g.U * 2 || f.x[i] > g.W + g.U * 3) resetFall(g, f, i, state.rand, false);
      const a = 0.9 + Math.sin(t * 1.6 + f.p[i]) * 0.7;
      const cs = Math.cos(a);
      const sn = Math.sin(a);
      ctx.setTransform(cs, sn, -sn, cs, f.x[i], f.y[i]);
      ctx.fillStyle = FALL[f.tone[i]];
      ctx.fillRect(-f.s[i] / 2, -f.s[i] * 0.09, f.s[i], Math.max(1, f.s[i] * 0.18));
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { sway, mist, light } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawMist(ctx, g, t, 0, mist, g.ground - g.U * 22, 0.9, 0.5);
    drawCanes(ctx, g, t, state.mid, sway);
    drawMist(ctx, g, t, 1, mist, g.ground - g.U * 14, -1.6, 0.4);
    drawCanes(ctx, g, t, state.near, sway);
    if (light > 0.01) {
      ctx.globalAlpha = Math.min(1, light * (0.55 + 0.25 * Math.sin(t * 0.35) + 0.12 * Math.sin(t * 0.83 + 1)));
      ctx.drawImage(state.shafts, 0, 0);
      ctx.globalAlpha = 1;
    }
    drawFalling(ctx, g, t, Math.min(dt, 0.1), sway);
    ctx.drawImage(state.front, 0, 0);
  }

  Kasuri.run({
    defaults: { sway: 1, mist: 1, light: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
