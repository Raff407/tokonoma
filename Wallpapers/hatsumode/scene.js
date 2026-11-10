/*
 * 初詣 Hatsumode — a long stone stair up to a lantern-lit shrine on a cold new-year night.
 *
 * Sky, cedars, shrine, stair, stone lanterns, torii and kadomatsu are baked once into one
 * layer. Per frame only a few things move: a soft glow over each lantern, mist drifting
 * over the steps, low puffs of ground mist and a short pool of snowflakes.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const VANISH = 0.358;
  const TOP = 0.46;
  const STEPS = 30;
  const FLAKES = 44;
  const MAX_PUFFS = 9;
  const STONE = { tread: '#7a859f', riser: '#414a63', fog: '#1d2543', wall: '#566079', cap: '#6f7a93' };
  const VERMILION = { lit: '#a8402b', mid: '#8f3423', dark: '#6a2519' };
  const INK = '#151824';
  const WASHI = '#d9d3c0';
  const GOLD = '#e0b04e';
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, TAU);
    ctx.fill();
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function mix(a, b, t) {
    return K.toHex(K.mixColor(K.parseColor(a), K.parseColor(b), t));
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const s = U * Math.min(1, W / (U * 150));
    const g = { W, H, U, s, cx: W / 2, yv: H * VANISH, top: H * TOP, kw: (0.623 * s) / U };
    return g;
  }

  // Half the width of the stair at screen row y; it narrows toward the vanishing row.
  function halfW(g, y) {
    return Math.max(0, y - g.yv) * g.kw;
  }

  // Row of step edge i: 0 is the top landing, STEPS is the last row of the grid.
  function stepY(g, i) {
    const dmin = (g.top - g.yv) / (g.H - g.yv);
    const d = 1 - (i / STEPS) * (1 - dmin);
    return g.yv + (g.top - g.yv) / d;
  }

  // ---- sky and ground --------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.top);
    grad.addColorStop(0, '#080c1f');
    grad.addColorStop(0.4, '#1a2347');
    grad.addColorStop(1, '#4a5688');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#e4dfcc';
    for (let i = 0; i < g.W * 0.35; i++) {
      ctx.globalAlpha = 0.2 + rand() * 0.55;
      ctx.fillRect(Math.floor(rand() * g.W), Math.floor(rand() * g.top * 0.8), 1, 1);
    }
    ctx.globalAlpha = 1;
    const mx = g.W * 0.2;
    const my = g.H * 0.15;
    const halo = ctx.createRadialGradient(mx, my, 0, mx, my, g.s * 16);
    halo.addColorStop(0, 'rgba(226,222,200,0.35)');
    halo.addColorStop(1, 'rgba(226,222,200,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - g.s * 16, my - g.s * 16, g.s * 32, g.s * 32);
    ctx.fillStyle = '#e9e3cb';
    blob(ctx, mx, my, g.s * 4.2, g.s * 4.2);
    ctx.fillStyle = '#c9c4b0';
    blob(ctx, mx + g.s * 1.2, my + g.s * 0.6, g.s * 1.1, g.s * 0.9);
  }

  function paintHills(ctx, g) {
    const base = g.top + g.U * 2;
    const layers = [['#34406e', 0.3, 7, 5], ['#27305a', 0.37, 5, 9]];
    for (const [ink, lift, amp, seed] of layers) {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(0, base);
      for (let x = 0; x <= g.W + 2; x += 2) {
        ctx.lineTo(x, g.H * lift + fbm(x / (g.U * 30), seed, 3, seed) * g.U * amp);
      }
      ctx.lineTo(g.W, base);
      ctx.fill();
    }
  }

  function paintGround(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, g.top - g.U * 2, 0, g.H);
    grad.addColorStop(0, '#1a2140');
    grad.addColorStop(1, '#2a3355');
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.top - g.U * 2, g.W, g.H - g.top + g.U * 2);
    for (let i = 0; i < 70; i++) {
      const y = g.top + (g.H - g.top) * Math.pow(rand(), 0.8);
      const f = (y - g.top) / (g.H - g.top);
      const r = g.s * (2 + f * 8) * (0.6 + rand() * 0.8);
      ctx.fillStyle = rand() < 0.5 ? '#38426a' : '#2f3960';
      blob(ctx, rand() * g.W, y, r, r * 0.22);
      ctx.fillStyle = '#5b6685';
      blob(ctx, rand() * g.W, y, r * 0.5, r * 0.07);
    }
  }

  // ---- cedars ----------------------------------------------------------------

  function cedar(ctx, x, yb, h, w, ink, rand) {
    const tiers = 10;
    const top = yb - h;
    ctx.fillStyle = '#0f131f';
    ctx.fillRect(x - w * 0.05, yb - h * 0.14, w * 0.1, h * 0.14);
    for (let i = 0; i < tiers; i++) {
      const f = (i + 1) / tiers;
      const ya = top + h * 0.86 * (i / tiers);
      const yz = top + h * 0.86 * f + h * 0.06;
      const hw = w * (0.16 + 0.84 * f);
      const drop = (yz - ya) * 0.22;
      ctx.fillStyle = ink[0];
      poly(ctx, [x, ya, x + hw, yz, x + hw * 0.5, yz - drop, x, yz - drop * 1.5, x - hw * 0.5, yz - drop, x - hw, yz]);
      ctx.fillStyle = ink[1];
      poly(ctx, [x, ya, x - hw, yz, x - hw * 0.5, yz - drop, x, yz - drop * 1.5]);
      if (rand() < 0.7) {
        ctx.fillStyle = '#aab2c4';
        blob(ctx, x - hw * 0.92, yz - 0.5, Math.max(1, hw * 0.16), Math.max(0.5, w * 0.02));
        blob(ctx, x + hw * 0.9, yz - 0.5, Math.max(1, hw * 0.14), Math.max(0.5, w * 0.02));
      }
    }
  }

  function paintFarCedars(ctx, g, rand) {
    const near = ['#1c2650', '#2a3563'];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const x = g.cx + side * g.s * (17 + i * 9 + rand() * 4);
        const h = g.s * (30 + rand() * 18);
        cedar(ctx, x, g.top + g.U * 0.5, h, g.s * (4 + rand() * 1.4), near, rand);
      }
    }
  }

  function paintNearCedars(ctx, g, rand) {
    const inks = [['#0f1a1c', '#17262a'], ['#101c1d', '#1a2c2c']];
    const spec = [[-58, 0.84, 92, 15], [58, 0.8, 88, 14], [-84, 1.02, 120, 21], [86, 1.02, 118, 20], [-76, 0.66, 70, 11], [76, 0.64, 66, 11]];
    for (const [dx, by, h, w] of spec) {
      cedar(ctx, g.cx + dx * g.s, g.H * by, h * g.s, w * g.s, inks[dx < 0 ? 0 : 1], rand);
    }
  }

  // ---- shrine ----------------------------------------------------------------

  function roofShape(g, ey, hwEave, hwRidge, rise, lift) {
    const s = g.s;
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const f = i / 12;
      const x = lerp(-hwEave, hwEave, f);
      pts.push(g.cx + x, ey - lift * s * Math.pow(Math.abs(f - 0.5) * 2, 3));
    }
    pts.push(g.cx + hwRidge, ey - rise, g.cx - hwRidge, ey - rise);
    return pts;
  }

  function chigi(ctx, g, x, y) {
    ctx.strokeStyle = '#b3aa8c';
    ctx.lineWidth = Math.max(1, g.s * 0.55);
    ctx.beginPath();
    ctx.moveTo(x - g.s * 1.3, y + g.s * 0.8);
    ctx.lineTo(x + g.s * 1.3, y - g.s * 4);
    ctx.moveTo(x + g.s * 1.3, y + g.s * 0.8);
    ctx.lineTo(x - g.s * 1.3, y - g.s * 4);
    ctx.stroke();
  }

  function paintShrine(ctx, g, lamps) {
    const s = g.s;
    const cx = g.cx;
    const y0 = g.top;
    ctx.fillStyle = STONE.riser;
    ctx.fillRect(cx - 15 * s, y0 - 2.4 * s, 30 * s, 2.4 * s);
    ctx.fillStyle = STONE.cap;
    ctx.fillRect(cx - 15 * s, y0 - 2.4 * s, 30 * s, 0.7 * s);
    const by = y0 - 2.4 * s;
    const bh = 8 * s;
    const bw = 11.5 * s;
    ctx.fillStyle = '#8b8577';
    ctx.fillRect(cx - bw, by - bh, bw * 2, bh);
    ctx.fillStyle = GOLD;
    ctx.fillRect(cx - 5.6 * s, by - bh + 1.4 * s, 11.2 * s, bh - 1.4 * s);
    ctx.fillStyle = '#7a5a24';
    for (let x = -5.6; x <= 5.7; x += 1.4) ctx.fillRect(cx + x * s - 0.12 * s, by - bh + 1.4 * s, Math.max(1, 0.25 * s), bh - 1.4 * s);
    ctx.fillRect(cx - 5.6 * s, by - bh + 3.6 * s, 11.2 * s, Math.max(1, 0.3 * s));
    ctx.fillStyle = VERMILION.mid;
    for (const x of [-11.5, -5.8, 0, 5.8, 11.5]) ctx.fillRect(cx + x * s - 0.5 * s, by - bh, Math.max(1.5, s), bh);
    ctx.fillStyle = VERMILION.lit;
    ctx.fillRect(cx - bw - 0.5 * s, by - bh - 0.2 * s, bw * 2 + s, 1.1 * s);
    const ey = by - bh - 0.4 * s;
    ctx.fillStyle = INK;
    poly(ctx, roofShape(g, ey + 1.6 * s, 17.5 * s, 10.5 * s, 11 * s, 1.6));
    ctx.fillStyle = '#343c58';
    poly(ctx, roofShape(g, ey, 17.5 * s, 10.5 * s, 11 * s, 1.6));
    ctx.fillStyle = '#c6cbd6';
    poly(ctx, [cx - 10.5 * s, ey - 11 * s, cx + 10.5 * s, ey - 11 * s, cx + 12.4 * s, ey - 7.2 * s, cx - 12.4 * s, ey - 7.2 * s]);
    ctx.fillStyle = '#9ba3b6';
    ctx.fillRect(cx - 17 * s, ey - 0.5 * s, 34 * s, Math.max(1, 0.45 * s));
    ctx.fillStyle = '#a69d82';
    for (let i = 0; i < 6; i++) ctx.fillRect(cx - 9 * s + i * 3.4 * s, ey - 12 * s, 1.5 * s, 1.1 * s);
    chigi(ctx, g, cx - 10.2 * s, ey - 10.6 * s);
    chigi(ctx, g, cx + 10.2 * s, ey - 10.6 * s);
    ctx.strokeStyle = '#cdbf92';
    ctx.lineWidth = Math.max(1, 0.5 * s);
    ctx.beginPath();
    ctx.moveTo(cx - bw, by - bh + 1.7 * s);
    ctx.quadraticCurveTo(cx, by - bh + 3.7 * s, cx + bw, by - bh + 1.7 * s);
    ctx.stroke();
    ctx.fillStyle = '#e8e3d2';
    for (let i = 0; i < 5; i++) {
      const x = cx - 8.6 * s + i * 4.3 * s;
      const y = by - bh + 2.5 * s - Math.sin((i / 4) * Math.PI) * 0.3 * s + 0.4 * s;
      ctx.fillRect(x, y, Math.max(1, 0.7 * s), 1.5 * s);
      ctx.fillRect(x + 0.5 * s, y + 1.2 * s, Math.max(1, 0.7 * s), 1.2 * s);
    }
    for (const side of [-1, 1]) {
      const x = cx + side * 7.6 * s;
      ctx.fillStyle = '#6d6350';
      ctx.fillRect(x - 0.15 * s, by - bh + 0.5 * s, Math.max(1, 0.3 * s), 1.2 * s);
      ctx.fillStyle = '#b3402b';
      blob(ctx, x, by - bh + 2.9 * s, 1.1 * s, 1.5 * s);
      ctx.fillStyle = '#e1a74a';
      blob(ctx, x, by - bh + 2.9 * s, 0.5 * s, 0.9 * s);
      lamps.push({ x, y: by - bh + 2.9 * s, r: 5 * s, ph: side + 2 });
    }
    ctx.fillStyle = '#2a2420';
    ctx.fillRect(cx - 3.2 * s, y0 - 0.2 * s - 1.2 * s, 6.4 * s, 1.2 * s);
    ctx.fillStyle = '#5a4a38';
    for (let x = -3; x <= 3; x += 1) ctx.fillRect(cx + x * s - 0.1 * s, y0 - 1.4 * s, Math.max(1, 0.2 * s), 1.2 * s);
    lamps.push({ x: cx, y: by - bh * 0.45, r: 17 * s, ph: 0.5, big: true });
  }

  // ---- stair -----------------------------------------------------------------

  function paintStair(ctx, g, rand) {
    const treadShare = 0.62;
    for (let i = 0; i < STEPS; i++) {
      const ya = stepY(g, i);
      const yb = stepY(g, i + 1);
      const f = i / STEPS;
      const ym = yb - (yb - ya) * (1 - treadShare);
      const wa = halfW(g, ya);
      const wm = halfW(g, ym);
      const wb = halfW(g, yb);
      const tint = 0.35 + 0.65 * f;
      const jitter = 0.94 + rand() * 0.12;
      ctx.fillStyle = mix(STONE.fog, STONE.tread, Math.min(1, tint * jitter));
      poly(ctx, [g.cx - wa, ya, g.cx + wa, ya, g.cx + wm, ym, g.cx - wm, ym]);
      ctx.fillStyle = mix(STONE.fog, STONE.riser, Math.min(1, tint * jitter));
      poly(ctx, [g.cx - wm, ym, g.cx + wm, ym, g.cx + wb, yb, g.cx - wb, yb]);
      ctx.fillStyle = '#b6bdcd';
      ctx.globalAlpha = 0.28 + 0.3 * f;
      poly(ctx, [g.cx - wa, ya, g.cx + wa, ya, g.cx + wa * 0.99, ya + Math.max(1, (ym - ya) * 0.3), g.cx - wa * 0.99, ya + Math.max(1, (ym - ya) * 0.3)]);
      ctx.globalAlpha = 1;
      if (f > 0.25 && rand() < 0.7) {
        ctx.fillStyle = '#c6ccd9';
        ctx.globalAlpha = 0.45;
        const x = g.cx + (rand() * 2 - 1) * wm * 0.9;
        blob(ctx, x, (ya + ym) / 2, wm * (0.05 + rand() * 0.14), Math.max(0.5, (ym - ya) * 0.28));
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = 'rgba(8,10,22,0.35)';
    for (const side of [-1, 1]) {
      poly(ctx, [g.cx + side * halfW(g, g.top), g.top, g.cx + side * halfW(g, g.top) * 1.15, g.top, g.cx + side * halfW(g, g.H) * 1.15, g.H, g.cx + side * halfW(g, g.H), g.H]);
    }
    for (const side of [-1, 1]) {
      const a = halfW(g, g.top);
      const b = halfW(g, g.H);
      ctx.fillStyle = STONE.wall;
      poly(ctx, [g.cx + side * a * 1.02, g.top, g.cx + side * a * 1.18, g.top, g.cx + side * b * 1.18, g.H, g.cx + side * b * 1.02, g.H]);
      ctx.fillStyle = STONE.cap;
      poly(ctx, [g.cx + side * a * 1.1, g.top, g.cx + side * a * 1.18, g.top, g.cx + side * b * 1.18, g.H, g.cx + side * b * 1.1, g.H]);
    }
  }

  // ---- lanterns --------------------------------------------------------------

  function stoneLantern(ctx, g, x, yb, h, lamps) {
    const w = h * 0.52;
    ctx.fillStyle = '#313a52';
    ctx.fillRect(x - w * 0.5, yb - h * 0.1, w, h * 0.1);
    ctx.fillStyle = '#4e5873';
    ctx.fillRect(x - w * 0.4, yb - h * 0.16, w * 0.8, h * 0.07);
    ctx.fillStyle = '#3b4560';
    ctx.fillRect(x - w * 0.1, yb - h * 0.5, w * 0.2, h * 0.36);
    ctx.fillStyle = '#4e5873';
    ctx.fillRect(x - w * 0.34, yb - h * 0.56, w * 0.68, h * 0.07);
    ctx.fillStyle = '#2c3349';
    ctx.fillRect(x - w * 0.27, yb - h * 0.76, w * 0.54, h * 0.2);
    ctx.fillStyle = GOLD;
    ctx.fillRect(x - w * 0.17, yb - h * 0.72, w * 0.34, h * 0.13);
    ctx.fillStyle = '#3d4763';
    poly(ctx, [x - w * 0.62, yb - h * 0.76, x + w * 0.62, yb - h * 0.76, x + w * 0.32, yb - h * 0.9, x - w * 0.32, yb - h * 0.9]);
    ctx.fillStyle = '#cfd4de';
    poly(ctx, [x - w * 0.5, yb - h * 0.8, x + w * 0.5, yb - h * 0.8, x + w * 0.3, yb - h * 0.93, x - w * 0.3, yb - h * 0.93]);
    ctx.fillStyle = '#4e5873';
    blob(ctx, x, yb - h * 0.95, w * 0.12, h * 0.05);
    lamps.push({ x, y: yb - h * 0.66, r: h * 1.2, ph: x * 0.37 });
  }

  function paintLanterns(ctx, g, lamps) {
    const rows = [0.5, 0.57, 0.65, 0.9];
    for (const f of rows) {
      const y = g.H * f;
      const hw = halfW(g, y);
      for (const side of [-1, 1]) {
        const x = g.cx + side * hw * 1.42;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1, 0.4);
        const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, hw * 0.9);
        pool.addColorStop(0, 'rgba(230,180,90,0.28)');
        pool.addColorStop(1, 'rgba(230,180,90,0)');
        ctx.fillStyle = pool;
        ctx.fillRect(-hw, -hw, hw * 2, hw * 2);
        ctx.restore();
        stoneLantern(ctx, g, x, y, hw * 1.05, lamps);
      }
    }
  }

  // ---- torii and kadomatsu ---------------------------------------------------

  function paintTorii(ctx, g) {
    const y = g.H * 0.74;
    const hw = halfW(g, y);
    const px = hw * 1.2;
    const ht = hw * 1.95;
    const w = hw * 0.15;
    const top = y - ht;
    for (const side of [-1, 1]) {
      const x = g.cx + side * px;
      ctx.fillStyle = VERMILION.mid;
      poly(ctx, [x - w / 2, y, x + w / 2, y, x + w * 0.4, top + ht * 0.1, x - w * 0.4, top + ht * 0.1]);
      ctx.fillStyle = VERMILION.lit;
      poly(ctx, [x - w / 2, y, x - w * 0.1, y, x - w * 0.1, top + ht * 0.1, x - w * 0.4, top + ht * 0.1]);
      ctx.fillStyle = INK;
      ctx.fillRect(x - w * 0.6, y - ht * 0.09, w * 1.2, ht * 0.09);
    }
    const ny = top + ht * 0.3;
    ctx.fillStyle = VERMILION.mid;
    ctx.fillRect(g.cx - px - w * 0.8, ny, (px + w * 0.8) * 2, ht * 0.06);
    ctx.fillStyle = VERMILION.lit;
    ctx.fillRect(g.cx - px - w * 0.8, ny, (px + w * 0.8) * 2, Math.max(1, ht * 0.015));
    ctx.fillStyle = VERMILION.dark;
    ctx.fillRect(g.cx - w * 0.22, top + ht * 0.14, w * 0.44, ny - top - ht * 0.14);
    ctx.fillStyle = INK;
    ctx.fillRect(g.cx - px - w * 0.9, top + ht * 0.1, (px + w * 0.9) * 2, ht * 0.05);
    const kl = px * 1.3;
    const kt = top - ht * 0.02;
    const kh = ht * 0.085;
    const lift = ht * 0.07;
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const f = i / 14;
      pts.push(g.cx - kl + 2 * kl * f, kt - lift * Math.pow(Math.abs(f - 0.5) * 2, 2.6));
    }
    for (let i = 14; i >= 0; i--) {
      const f = i / 14;
      pts.push(g.cx - kl + 2 * kl * f, kt + kh - lift * 0.55 * Math.pow(Math.abs(f - 0.5) * 2, 2.6));
    }
    ctx.fillStyle = INK;
    poly(ctx, pts);
    ctx.fillStyle = '#dcdfe6';
    ctx.fillRect(g.cx - kl * 0.78, kt - lift * 0.35 - 1, kl * 1.56, Math.max(1, kh * 0.28));
  }

  function kadomatsu(ctx, g, x, yb, h) {
    const w = h * 0.5;
    ctx.fillStyle = '#9b8b62';
    ctx.fillRect(x - w * 0.5, yb - h * 0.12, w, h * 0.12);
    ctx.fillStyle = '#b5a374';
    ctx.fillRect(x - w * 0.5, yb - h * 0.12, w, Math.max(1, h * 0.03));
    const stalks = [[-0.28, 0.82], [0, 1], [0.28, 0.7]];
    for (const [dx, hf] of stalks) {
      const sx = x + dx * w;
      const sh = h * hf;
      ctx.fillStyle = '#4f6e3d';
      ctx.fillRect(sx - w * 0.12, yb - sh, w * 0.24, sh - h * 0.1);
      ctx.fillStyle = '#7a9a58';
      ctx.fillRect(sx - w * 0.12, yb - sh, w * 0.07, sh - h * 0.1);
      ctx.fillStyle = '#d8d0a4';
      poly(ctx, [sx - w * 0.12, yb - sh + h * 0.07, sx + w * 0.12, yb - sh, sx + w * 0.12, yb - sh + h * 0.05, sx - w * 0.12, yb - sh + h * 0.14]);
    }
    ctx.fillStyle = '#1f3524';
    for (const [dx, dy] of [[-0.45, 0.26], [0.45, 0.22], [0, 0.34]]) {
      blob(ctx, x + dx * w, yb - h * dy, w * 0.34, h * 0.07);
    }
    ctx.fillStyle = '#3a6a3a';
    blob(ctx, x - w * 0.5, yb - h * 0.3, w * 0.16, h * 0.04);
    ctx.fillStyle = '#c9b88a';
    ctx.fillRect(x - w * 0.46, yb - h * 0.2, w * 0.92, Math.max(1, h * 0.06));
    ctx.fillStyle = VERMILION.lit;
    blob(ctx, x + w * 0.4, yb - h * 0.3, w * 0.07, h * 0.04);
  }

  function paintWorld(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const lamps = [];
    paintSky(ctx, g, rand);
    paintHills(ctx, g);
    paintFarCedars(ctx, g, rand);
    paintGround(ctx, g, rand);
    paintShrine(ctx, g, lamps);
    paintStair(ctx, g, rand);
    paintLanterns(ctx, g, lamps);
    paintTorii(ctx, g);
    paintNearCedars(ctx, g, rand);
    const ky = g.H * 0.99;
    const kx = halfW(g, ky) * 0.72;
    kadomatsu(ctx, g, g.cx - kx, ky, g.s * 15);
    kadomatsu(ctx, g, g.cx + kx, ky, g.s * 15);
    state.lamps = lamps;
    return c;
  }

  // ---- glow, mist, snow ------------------------------------------------------

  function paintGlow() {
    const c = layer(64, 64);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(236,190,96,0.55)');
    grad.addColorStop(0.4, 'rgba(226,168,80,0.2)');
    grad.addColorStop(1, 'rgba(226,168,80,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return c;
  }

  function paintPuff() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(208,216,232,0.5)');
    grad.addColorStop(1, 'rgba(208,216,232,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 16), y / (g.U * 4.5), 4, 61);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.38, 0.64, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 196;
        img.data[i + 1] = 204;
        img.data[i + 2] = 224;
        img.data[i + 3] = a * 120;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function drawMist(ctx, g, t, mist) {
    if (mist <= 0) return;
    const m = state.mist;
    const w = m.width;
    const a = (t * g.U * 1.2) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.8);
    ctx.drawImage(m, -a, g.H * 0.74);
    ctx.drawImage(m, w - a, g.H * 0.74);
    const b = (t * g.U * 0.7 + w * 0.5) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.45);
    ctx.drawImage(m, b - w, g.H * 0.5);
    ctx.drawImage(m, b, g.H * 0.5);
    ctx.globalAlpha = 1;
  }

  function makePuffs() {
    const f = () => new Float32Array(MAX_PUFFS);
    return { x: f(), y: f(), age: f(), life: f(), size: f(), drift: f() };
  }

  function resetPuff(g, P, i, scatter) {
    const r = state.rand;
    const y = g.H * (0.62 + r() * 0.34);
    P.x[i] = g.cx + (r() * 2 - 1) * halfW(g, y) * 0.9;
    P.y[i] = y;
    P.life[i] = 10 + r() * 8;
    P.age[i] = scatter ? r() * P.life[i] : 0;
    P.size[i] = g.s * (7 + r() * 8);
    P.drift[i] = (r() - 0.3) * g.s * 0.9;
  }

  function drawPuffs(ctx, g, dt, mist) {
    const P = state.puffs;
    const count = Math.min(MAX_PUFFS, Math.round(MAX_PUFFS * Math.min(1, mist)));
    for (let i = 0; i < count; i++) {
      P.age[i] += dt;
      if (P.age[i] >= P.life[i]) resetPuff(g, P, i, false);
      const f = P.age[i] / P.life[i];
      const r = P.size[i] * (0.7 + f * 0.8);
      ctx.globalAlpha = Math.sin(f * Math.PI) * 0.6 * Math.min(1, mist);
      ctx.drawImage(state.puff, P.x[i] + P.drift[i] * P.age[i] - r, P.y[i] - f * g.s * 5 - r * 0.5, r * 2, r);
    }
    ctx.globalAlpha = 1;
  }

  function drawGlow(ctx, g, t, glow) {
    if (glow <= 0) return;
    const lamps = state.lamps;
    for (let i = 0; i < lamps.length; i++) {
      const l = lamps[i];
      const pulse = 0.78 + 0.22 * Math.sin(t * 0.9 + l.ph * 2.1) * Math.sin(t * 0.37 + l.ph);
      ctx.globalAlpha = Math.min(1, glow * pulse * (l.big ? 0.45 : 0.9));
      ctx.drawImage(state.glow, l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    ctx.globalAlpha = 1;
  }

  function makeFlakes() {
    const f = () => new Float32Array(FLAKES);
    return { x: f(), y: f(), vy: f(), p: f(), z: f() };
  }

  function resetFlake(g, F, i, scatter) {
    const r = state.rand;
    F.z[i] = r();
    F.x[i] = r() * g.W;
    F.y[i] = scatter ? r() * g.H : -2 - r() * g.U * 4;
    F.vy[i] = g.U * (2.6 + F.z[i] * 3.4);
    F.p[i] = r() * TAU;
  }

  function drawSnow(ctx, g, t, dt, snow) {
    if (snow <= 0) return;
    const F = state.flakes;
    const count = Math.min(FLAKES, Math.round(FLAKES * Math.min(1, snow * 0.8 + 0.2)));
    ctx.fillStyle = '#ebe8dc';
    for (let i = 0; i < count; i++) {
      F.y[i] += F.vy[i] * dt;
      F.x[i] += (g.U * 0.7 + Math.sin(t * 0.8 + F.p[i]) * g.U * 1.5) * dt;
      if (F.y[i] > g.H) resetFlake(g, F, i, false);
      if (F.x[i] > g.W) F.x[i] -= g.W;
      const size = F.z[i] > 0.6 ? 2 : 1;
      ctx.globalAlpha = 0.45 + F.z[i] * 0.5;
      ctx.fillRect(Math.round(F.x[i]), Math.round(F.y[i]), size, size);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.world = paintWorld(g, rand);
    state.glow = paintGlow();
    state.puff = paintPuff();
    state.mist = paintMist(g);
    state.puffs = makePuffs();
    state.flakes = makeFlakes();
    for (let i = 0; i < MAX_PUFFS; i++) resetPuff(g, state.puffs, i, true);
    for (let i = 0; i < FLAKES; i++) resetFlake(g, state.flakes, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { snow, mist, glow } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.world, 0, 0);
    drawGlow(ctx, g, t, glow);
    drawMist(ctx, g, t, mist);
    drawPuffs(ctx, g, step, mist);
    drawSnow(ctx, g, t, step, snow);
  }

  Kasuri.run({
    defaults: { snow: 1, mist: 1, glow: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
