/*
 * 窯 Kama — a pottery kiln at night.
 *
 * Sky, hills, the clay dome, chimney and the shelved ware are baked once. The mouth is
 * baked twice, dim and bright, and the bright one breathes over the dim one. Heat shimmer
 * is a few thin strips of the baked scene slid sideways. Sparks and chimney smoke are
 * short reused pools.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp } = K;

  const TAU = Math.PI * 2;
  const GROUND = 0.84;
  const SPARKS = 22;
  const MAX_SPARKS = 44;
  const PUFFS = 8;
  const STRIPS = 16;
  const SKY = ['#0f1426', '#18213a', '#26345a', '#3a4066'];
  const CLAY = { lit: '#54463c', mid: '#3a2f2b', deep: '#241c1a', joint: '#2a201c', brick: '#7a5a46' };
  const WARE = '#1a1210';
  const GLOW_RIM = '#d6683c';
  const MOSS = ['#334228', '#4a5a3a'];
  const SMOKE = '#8a90a2';
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

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const u = U * Math.min(1, W / (U * 130));
    const gy = Math.round(H * GROUND);
    const cx = W * 0.5;
    const mouth = { cx, hw: u * 11, yb: gy - u * 1.5, h: u * 30 };
    mouth.top = mouth.yb - mouth.h;
    return { W, H, U, u, gy, cx, mouth, dome: { rx: u * 46, ry: u * 54 } };
  }

  // ---- sky and hills ----------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.gy);
    SKY.forEach((c, i) => grad.addColorStop(i / (SKY.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.gy + 1);
    ctx.fillStyle = '#e8e0cc';
    for (let i = 0; i < 34; i++) {
      ctx.globalAlpha = 0.25 + rand() * 0.5;
      ctx.fillRect(Math.floor(rand() * g.W), Math.floor(rand() * g.H * 0.45), 1, 1);
    }
    ctx.globalAlpha = 1;
    const mx = g.W * 0.16;
    const my = g.H * 0.17;
    const r = g.U * 5.5;
    ctx.fillStyle = '#e8d9ae';
    blob(ctx, mx, my, r, r);
    ctx.fillStyle = '#1b2442';
    blob(ctx, mx + r * 0.55, my - r * 0.2, r * 0.95, r * 0.95);
  }

  function ridge(g, x, base, amp, seed) {
    return base + K.fbm(x / (g.U * 36), seed, 4, seed) * amp;
  }

  function paintHills(ctx, g, rand) {
    const layers = [
      ['#222c4a', g.H * 0.5, g.H * 0.12, 3],
      ['#171e36', g.H * 0.6, g.H * 0.1, 7],
    ];
    for (const [ink, base, amp, seed] of layers) {
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(0, g.gy);
      for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, ridge(g, x, base, amp, seed));
      ctx.lineTo(g.W, g.gy);
      ctx.fill();
      for (let x = 0; x < g.W; x += g.U * (3 + rand() * 4)) {
        const y = ridge(g, x, base, amp, seed);
        blob(ctx, x, y + g.U * 0.2, g.U * (1.4 + rand() * 1.4), g.U * (1.6 + rand() * 1.4));
      }
    }
  }

  function pine(ctx, x, y, h, trunk, tones) {
    ctx.strokeStyle = trunk;
    ctx.lineWidth = Math.max(1, h * 0.05);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - h * 0.08, y - h * 0.5, x + h * 0.05, y - h * 0.93);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const f = 0.42 + i * 0.17;
      const side = i % 2 ? 1 : -1;
      const px = x + side * h * 0.14 * (1 - f * 0.5);
      const py = y - h * f;
      const w = h * (0.3 - f * 0.12);
      ctx.fillStyle = tones[0];
      blob(ctx, px, py, w, w * 0.4);
      blob(ctx, px + side * w * 0.5, py + w * 0.08, w * 0.55, w * 0.32);
      ctx.fillStyle = tones[1];
      blob(ctx, px - w * 0.15, py - w * 0.14, w * 0.7, w * 0.24);
    }
  }

  // ---- ground ----------------------------------------------------------------

  function paintGround(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, g.gy, 0, g.H);
    grad.addColorStop(0, '#2c2420');
    grad.addColorStop(1, '#14100f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.gy, g.W, g.H - g.gy + 1);
    ctx.fillStyle = '#3a2e28';
    for (let i = 0; i < 60; i++) {
      const x = rand() * g.W;
      const y = g.gy + rand() * (g.H - g.gy);
      blob(ctx, x, y, g.U * (0.6 + rand() * 1.2), g.U * 0.25);
    }
    ctx.fillStyle = '#4a5a3a';
    for (let x = 0; x < g.W; x += g.U * (1.5 + rand() * 3)) {
      ctx.fillRect(x, g.gy - g.U * rand() * 1.3, Math.max(1, g.U * 0.35), g.U * 1.4);
    }
  }

  // ---- the kiln --------------------------------------------------------------

  function domePath(ctx, g) {
    ctx.beginPath();
    ctx.moveTo(g.cx - g.dome.rx, g.gy);
    ctx.ellipse(g.cx, g.gy, g.dome.rx, g.dome.ry, 0, Math.PI, TAU);
    ctx.closePath();
  }

  function paintChimney(ctx, g) {
    const u = g.u;
    const x = g.cx + u * 31;
    const w0 = u * 9;
    const w1 = u * 6.5;
    const top = g.H * 0.1;
    const bot = g.gy - u * 18;
    ctx.fillStyle = CLAY.mid;
    poly(ctx, [x - w0 / 2, bot, x - w1 / 2, top, x + w1 / 2, top, x + w0 / 2, bot]);
    ctx.fillStyle = CLAY.deep;
    poly(ctx, [x + w0 * 0.1, bot, x + w1 * 0.1, top, x + w1 / 2, top, x + w0 / 2, bot]);
    ctx.fillStyle = CLAY.lit;
    poly(ctx, [x - w0 / 2, bot, x - w1 / 2, top, x - w1 * 0.3, top, x - w0 * 0.32, bot]);
    ctx.fillStyle = CLAY.joint;
    for (let y = top + u * 2; y < bot; y += u * 2.6) ctx.fillRect(x - lerp(w1, w0, (y - top) / (bot - top)) / 2, y, lerp(w1, w0, (y - top) / (bot - top)), Math.max(1, u * 0.3));
    ctx.fillStyle = '#23232c';
    poly(ctx, [x - u * 7, top, x - u * 3, top - u * 3.2, x + u * 3, top - u * 3.2, x + u * 7, top]);
    ctx.fillStyle = '#34343f';
    poly(ctx, [x - u * 7, top, x - u * 3, top - u * 3.2, x - u * 1.5, top - u * 3.2, x - u * 4.5, top]);
    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(x - u * 7, top, u * 14, Math.max(1, u * 0.7));
    return { x, top };
  }

  function paintDome(ctx, g, rand) {
    const u = g.u;
    const { rx, ry } = g.dome;
    ctx.save();
    domePath(ctx, g);
    ctx.fillStyle = CLAY.lit;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = CLAY.mid;
    blob(ctx, g.cx + rx * 0.14, g.gy - u * 2, rx * 0.97, ry * 1.04);
    ctx.fillStyle = CLAY.deep;
    blob(ctx, g.cx + rx * 0.5, g.gy - u * 2, rx * 0.78, ry * 0.98);
    ctx.strokeStyle = CLAY.joint;
    ctx.lineWidth = Math.max(1, u * 0.4);
    for (let h = u * 3; h < ry * 0.97; h += u * 3.4) {
      const w = rx * Math.sqrt(1 - (h / ry) ** 2);
      ctx.beginPath();
      ctx.moveTo(g.cx - w, g.gy - h);
      ctx.quadraticCurveTo(g.cx, g.gy - h + u * 2.2, g.cx + w, g.gy - h);
      ctx.stroke();
      const off = (Math.round(h / (u * 3.4)) % 2) * u * 2.5;
      for (let x = g.cx - w + off; x < g.cx + w; x += u * 5) {
        ctx.beginPath();
        ctx.moveTo(x, g.gy - h + u * 0.8);
        ctx.lineTo(x, g.gy - h - u * 2.6);
        ctx.stroke();
      }
    }
    for (let i = 0; i < 26; i++) {
      const a = Math.PI + rand() * Math.PI;
      const d = 0.55 + rand() * 0.42;
      ctx.fillStyle = MOSS[rand() < 0.6 ? 0 : 1];
      const px = g.cx + Math.cos(a) * rx * d;
      const py = g.gy + Math.sin(a) * ry * d * 0.6;
      if (py > g.gy - u * 1) continue;
      blob(ctx, px, py, u * (1 + rand() * 2), u * (0.4 + rand() * 0.6));
    }
    ctx.restore();
    ctx.fillStyle = '#16100e';
    blob(ctx, g.cx, g.gy, rx * 1.04, u * 1.6);
  }

  function archPath(ctx, m, grow) {
    const hw = m.hw + grow;
    const yb = m.yb;
    const top = m.top - grow;
    ctx.beginPath();
    ctx.moveTo(m.cx - hw, yb);
    ctx.lineTo(m.cx - hw, top + hw * 1.2);
    ctx.ellipse(m.cx, top + hw * 1.2, hw, hw * 1.2, 0, Math.PI, TAU);
    ctx.lineTo(m.cx + hw, yb);
    ctx.closePath();
  }

  function pot(ctx, kind, x, y, s) {
    if (kind === 0) {
      blob(ctx, x, y - s * 0.7, s * 0.62, s * 0.7);
      ctx.fillRect(x - s * 0.2, y - s * 1.7, s * 0.4, s * 0.8);
      ctx.fillRect(x - s * 0.34, y - s * 1.8, s * 0.68, s * 0.2);
    } else if (kind === 1) {
      ctx.beginPath();
      ctx.ellipse(x, y - s * 0.7, s * 0.9, s * 0.7, 0, 0, Math.PI);
      ctx.fill();
      ctx.fillRect(x - s * 0.9, y - s * 0.78, s * 1.8, s * 0.16);
      ctx.fillRect(x - s * 0.4, y - s * 0.12, s * 0.8, s * 0.16);
    } else if (kind === 2) {
      blob(ctx, x, y - s * 0.75, s * 0.85, s * 0.75);
      ctx.fillRect(x - s * 0.38, y - s * 1.6, s * 0.76, s * 0.3);
    } else {
      poly(ctx, [x - s * 0.5, y, x - s * 0.62, y - s * 0.7, x - s * 0.3, y - s * 1.6, x + s * 0.3, y - s * 1.6, x + s * 0.62, y - s * 0.7, x + s * 0.5, y]);
    }
  }

  function paintWare(ctx, g) {
    const m = g.mouth;
    const u = g.u;
    const shelves = [m.yb - u * 1, m.yb - u * 9.5, m.yb - u * 18, m.yb - u * 26];
    const kinds = [[2, 1, 0, 3, 1, 2], [0, 1, 3, 1, 0], [1, 0, 2, 0], [0, 1, 0]];
    ctx.fillStyle = WARE;
    shelves.forEach((sy, row) => {
      ctx.fillRect(m.cx - m.hw, sy, m.hw * 2, Math.max(1, u * 0.8));
      const n = kinds[row].length;
      const span = m.hw * (row > 2 ? 0.6 : 1.6);
      for (let i = 0; i < n; i++) {
        const x = m.cx - span / 2 + ((i + 0.5) / n) * span;
        pot(ctx, kinds[row][i], x, sy, u * (row === 3 ? 1.5 : 1.9 + (i % 2) * 0.25));
      }
    });
    ctx.fillStyle = WARE;
    ctx.fillRect(m.cx - m.hw, m.yb - m.h * 0.2, u * 0.8, m.h * 0.2);
    ctx.fillRect(m.cx + m.hw - u * 0.8, m.yb - m.h * 0.2, u * 0.8, m.h * 0.2);
  }

  // The mouth: a glowing interior with silhouetted ware. bright=true is the hotter pass.
  function paintMouth(g, bright) {
    const m = g.mouth;
    const pad = Math.ceil(g.u * 3);
    const w = Math.ceil(m.hw * 2 + pad * 2);
    const h = Math.ceil(m.h + pad * 2);
    const ox = Math.floor(m.cx - m.hw - pad);
    const oy = Math.floor(m.top - pad);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.translate(-ox, -oy);
    ctx.save();
    archPath(ctx, m, 0);
    ctx.clip();
    const grad = ctx.createRadialGradient(m.cx, m.yb - m.h * 0.35, 0, m.cx, m.yb - m.h * 0.35, m.h * 0.75);
    if (bright) {
      grad.addColorStop(0, '#f2cb7a');
      grad.addColorStop(0.35, '#e4a650');
      grad.addColorStop(0.7, '#d6683c');
      grad.addColorStop(1, '#a8402a');
    } else {
      grad.addColorStop(0, '#c2602e');
      grad.addColorStop(0.45, '#8a3222');
      grad.addColorStop(1, '#4a1c14');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(ox, oy, w, h);
    paintWare(ctx, g);
    ctx.strokeStyle = bright ? '#efc874' : GLOW_RIM;
    ctx.lineWidth = Math.max(1, g.u * 0.35);
    ctx.globalAlpha = bright ? 0.9 : 0.6;
    const shelves = [m.yb - g.u * 1, m.yb - g.u * 9.5, m.yb - g.u * 18, m.yb - g.u * 26];
    for (const sy of shelves) {
      ctx.beginPath();
      ctx.moveTo(m.cx - m.hw, sy + g.u * 0.9);
      ctx.lineTo(m.cx + m.hw, sy + g.u * 0.9);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    return { c, ox, oy };
  }

  function paintFrame(ctx, g) {
    const m = g.mouth;
    const u = g.u;
    archPath(ctx, m, u * 2.6);
    ctx.fillStyle = CLAY.brick;
    ctx.fill();
    archPath(ctx, m, u * 1.2);
    ctx.fillStyle = '#4a342a';
    ctx.fill();
    archPath(ctx, m, 0);
    ctx.fillStyle = '#16100e';
    ctx.fill();
    ctx.fillStyle = '#16100e';
    ctx.fillRect(m.cx - m.hw - u * 3, m.yb, m.hw * 2 + u * 6, u * 1.6);
    ctx.fillStyle = CLAY.joint;
    const cy = m.top + m.hw * 1.2;
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(m.cx + Math.cos(a) * (m.hw + u * 0.2), cy + Math.sin(a) * (m.hw * 1.2 + u * 0.2));
      ctx.lineTo(m.cx + Math.cos(a) * (m.hw + u * 2.6), cy + Math.sin(a) * (m.hw * 1.2 + u * 2.6));
      ctx.lineWidth = Math.max(1, u * 0.35);
      ctx.strokeStyle = CLAY.joint;
      ctx.stroke();
    }
  }

  function spyHoles(ctx, g) {
    const pts = [[-0.55, 0.78], [-0.3, 0.9], [0.32, 0.88], [0.58, 0.72]];
    for (const [fx, fy] of pts) {
      const x = g.cx + g.dome.rx * fx;
      const y = g.gy - g.dome.ry * fy * 0.9;
      ctx.fillStyle = '#16100e';
      blob(ctx, x, y, g.u * 1.5, g.u * 1.3);
      ctx.fillStyle = '#c2602e';
      blob(ctx, x, y + g.u * 0.1, g.u * 0.9, g.u * 0.75);
      ctx.fillStyle = '#e4a650';
      blob(ctx, x, y + g.u * 0.1, g.u * 0.4, g.u * 0.35);
    }
  }

  // ---- wood pile, drying rack, pine --------------------------------------------

  function woodPile(ctx, g, rand) {
    const u = g.u;
    const x0 = g.W * 0.05;
    const w = u * 24;
    const rows = 6;
    ctx.fillStyle = '#1a1210';
    ctx.fillRect(x0 - u * 1.2, g.gy - u * 15, u * 1.4, u * 16);
    ctx.fillRect(x0 + w - u * 0.2, g.gy - u * 15, u * 1.4, u * 16);
    for (let r = 0; r < rows; r++) {
      const y = g.gy + u * 0.4 - r * u * 2.3;
      const n = Math.floor(w / (u * 2.5));
      for (let i = 0; i < n; i++) {
        const x = x0 + u * 1.3 + i * u * 2.5 + (r % 2) * u * 1.2;
        if (x > x0 + w - u) continue;
        const rr = u * (1 + rand() * 0.25);
        ctx.fillStyle = '#5a4430';
        blob(ctx, x, y, rr * 1.1, rr * 1.1);
        ctx.fillStyle = rand() < 0.5 ? '#a8845a' : '#8a6a44';
        blob(ctx, x, y, rr * 0.85, rr * 0.85);
        ctx.fillStyle = '#5a4430';
        blob(ctx, x, y, rr * 0.28, rr * 0.28);
      }
    }
    ctx.fillStyle = '#23232c';
    poly(ctx, [x0 - u * 3, g.gy - u * 14.4, x0 + w * 0.5, g.gy - u * 19, x0 + w + u * 3, g.gy - u * 14.4]);
    ctx.fillStyle = '#34343f';
    poly(ctx, [x0 - u * 3, g.gy - u * 14.4, x0 + w * 0.5, g.gy - u * 19, x0 + w * 0.5, g.gy - u * 17.4, x0 - u * 1, g.gy - u * 14.4]);
  }

  function rack(ctx, g) {
    const u = g.u;
    const x0 = g.W * 0.8;
    const y = g.gy + u * 5;
    ctx.fillStyle = '#2a1e16';
    ctx.fillRect(x0, y - u * 3.6, u * 22, u * 0.9);
    ctx.fillRect(x0 + u * 1.5, y - u * 3.6, u * 1, u * 5);
    ctx.fillRect(x0 + u * 19.5, y - u * 3.6, u * 1, u * 5);
    ctx.fillStyle = '#6a5848';
    for (let i = 0; i < 4; i++) pot(ctx, i, x0 + u * (3.5 + i * 5), y - u * 3.6, u * 1.9);
    ctx.fillStyle = '#8a7660';
    for (let i = 0; i < 4; i++) {
      blob(ctx, x0 + u * (3.1 + i * 5), y - u * 5.6, u * 0.3, u * 0.9);
    }
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintHills(ctx, g, rand);
    paintGround(ctx, g, rand);
    pine(ctx, g.W * 0.9, g.gy + g.U * 1.5, g.U * 62, '#120e0c', ['#25301f', '#34452c']);
    pine(ctx, g.W * 0.97, g.gy + g.U * 2, g.U * 40, '#120e0c', ['#202a1c', '#2e3d27']);
    paintChimney(ctx, g);
    paintDome(ctx, g, rand);
    spyHoles(ctx, g);
    paintFrame(ctx, g);
    const dim = paintMouth(g, false);
    ctx.drawImage(dim.c, dim.ox, dim.oy);
    woodPile(ctx, g, rand);
    rack(ctx, g);
    return c;
  }

  function paintGlow(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const m = g.mouth;
    const cy = m.yb - m.h * 0.4;
    const r = g.u * 70;
    const grad = ctx.createRadialGradient(m.cx, cy, 0, m.cx, cy, r);
    grad.addColorStop(0, 'rgba(232, 150, 70, 0.5)');
    grad.addColorStop(0.35, 'rgba(204, 100, 52, 0.22)');
    grad.addColorStop(1, 'rgba(204, 100, 52, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    const gg = ctx.createRadialGradient(m.cx, m.yb, 0, m.cx, m.yb, g.u * 44);
    gg.addColorStop(0, 'rgba(228, 140, 64, 0.5)');
    gg.addColorStop(1, 'rgba(228, 140, 64, 0)');
    ctx.save();
    ctx.translate(0, m.yb);
    ctx.scale(1, 0.28);
    ctx.translate(0, -m.yb);
    ctx.fillStyle = gg;
    ctx.fillRect(0, m.yb - g.u * 44, g.W, g.u * 88);
    ctx.restore();
    return c;
  }

  // shide and rope hang over the mouth and do not shimmer
  function paintFront(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const m = g.mouth;
    const u = g.u;
    const y0 = m.top - u * 4;
    const x0 = m.cx - m.hw - u * 6;
    const x1 = m.cx + m.hw + u * 6;
    ctx.strokeStyle = '#c8b27a';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, u * 1.3);
    ctx.beginPath();
    ctx.moveTo(x0, y0 - u * 1.5);
    ctx.quadraticCurveTo(m.cx, y0 + u * 3.5, x1, y0 - u * 1.5);
    ctx.stroke();
    ctx.strokeStyle = '#8a7648';
    ctx.lineWidth = Math.max(1, u * 0.4);
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
      const f = i / 14;
      const x = lerp(x0, x1, f);
      const y = y0 - u * 1.5 + (1 - (2 * f - 1) ** 2) * u * 2.6 + (i % 2 ? -u * 0.5 : u * 0.5);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#e8e0cc';
    for (const f of [0.3, 0.5, 0.7]) {
      const x = lerp(x0, x1, f);
      const y = y0 - u * 1.5 + (1 - (2 * f - 1) ** 2) * u * 2.8 + u * 0.8;
      poly(ctx, [x - u * 1.1, y, x + u * 1.1, y, x + u * 1.1, y + u * 2, x - u * 0.2, y + u * 2, x - u * 0.2, y + u * 3.6, x + u * 1.1, y + u * 3.6, x - u * 1.1, y + u * 6, x - u * 1.1, y + u * 4.2, x + u * 0.2, y + u * 4.2, x + u * 0.2, y + u * 2.6, x - u * 1.1, y + u * 2.6]);
    }
    return c;
  }

  // ---- sparks and smoke ---------------------------------------------------------

  function makeSparks(g) {
    const f = () => new Float32Array(MAX_SPARKS);
    const S = { x: f(), age: f(), life: f(), p: f(), drift: f(), size: f(), src: f() };
    for (let i = 0; i < MAX_SPARKS; i++) resetSpark(g, S, i, true);
    return S;
  }

  function resetSpark(g, S, i, scatter) {
    const r = state.rand;
    const chim = r() < 0.3;
    S.src[i] = chim ? 1 : 0;
    S.x[i] = chim ? g.cx + g.u * 31 + (r() - 0.5) * g.u * 3 : g.cx + (r() - 0.5) * g.mouth.hw * 1.6;
    S.life[i] = 3 + r() * 3;
    S.age[i] = scatter ? r() * S.life[i] : 0;
    S.p[i] = r() * TAU;
    S.drift[i] = g.u * (1 + r() * 3);
    S.size[i] = Math.max(1, g.u * (0.5 + r() * 0.5));
  }

  function drawSparks(ctx, g, t, dt, amount) {
    const S = state.sparks;
    const n = Math.min(MAX_SPARKS, Math.round(SPARKS * amount));
    const m = g.mouth;
    for (let i = 0; i < n; i++) {
      S.age[i] += dt;
      if (S.age[i] > S.life[i]) resetSpark(g, S, i, false);
      const k = S.age[i] / S.life[i];
      const y0 = S.src[i] ? g.H * 0.1 : m.top + m.h * 0.25;
      const rise = S.src[i] ? g.H * 0.3 : g.H * 0.55;
      const x = S.x[i] + S.drift[i] * S.age[i] * 0.8 + Math.sin(S.age[i] * 1.7 + S.p[i]) * g.u * 1.6;
      const y = y0 - k * rise + k * k * g.U * 8;
      ctx.globalAlpha = Math.min(1, (1 - k) * 1.6);
      ctx.fillStyle = k < 0.45 ? '#e4a650' : '#d6683c';
      ctx.fillRect(x, y, S.size[i], S.size[i]);
    }
    ctx.globalAlpha = 1;
  }

  function makePuffs(g) {
    const f = () => new Float32Array(PUFFS);
    const P = { age: f(), life: f(), p: f() };
    for (let i = 0; i < PUFFS; i++) {
      P.life[i] = 8 + state.rand() * 4;
      P.age[i] = state.rand() * P.life[i];
      P.p[i] = state.rand() * TAU;
    }
    return P;
  }

  function drawSmoke(ctx, g, dt, amount) {
    const P = state.puffs;
    const x0 = g.cx + g.u * 31;
    const y0 = g.H * 0.06;
    ctx.fillStyle = SMOKE;
    for (let i = 0; i < PUFFS; i++) {
      P.age[i] += dt;
      if (P.age[i] > P.life[i]) P.age[i] = 0;
      const k = P.age[i] / P.life[i];
      const x = x0 + k * g.u * 16 + Math.sin(P.age[i] * 0.8 + P.p[i]) * g.u * 2 * k;
      const y = y0 - k * g.H * 0.06;
      const r = g.u * (1.6 + k * 5);
      ctx.globalAlpha = Math.min(1, k * 5) * (1 - k) * 0.22 * Math.min(1, amount);
      blob(ctx, x, y, r, r * 0.7);
    }
    ctx.globalAlpha = 1;
  }

  // ---- shimmer ----------------------------------------------------------------

  function drawShimmer(ctx, g, t, amount) {
    if (amount <= 0) return;
    const m = g.mouth;
    const x = Math.floor(m.cx - m.hw * 2.4);
    const w = Math.ceil(m.hw * 4.8);
    const y1 = m.top + g.u * 4;
    const y0 = Math.max(0, m.top - g.u * 32);
    const sh = (y1 - y0) / STRIPS;
    for (let i = 0; i < STRIPS; i++) {
      const f = 1 - i / STRIPS;
      const dx = (Math.sin(t * 2.4 + i * 0.85) + 0.6 * Math.sin(t * 3.7 + i * 1.9)) * g.u * 0.75 * amount * (0.4 + f * 0.6);
      const y = y0 + i * sh;
      ctx.drawImage(state.back, x, y, w, sh + 1, x + dx, y, w, sh + 1);
    }
  }

  // ---- run --------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.bright = paintMouth(g, true);
    state.glow = paintGlow(g);
    state.front = paintFront(g);
    state.sparks = makeSparks(g);
    state.puffs = makePuffs(g);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { fire, shimmer, sparks } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.back, 0, 0);
    drawShimmer(ctx, g, t, shimmer);
    const breath = 0.6 + 0.22 * Math.sin(t * 0.9) + 0.12 * Math.sin(t * 2.3 + 1) + 0.06 * Math.sin(t * 5.1);
    const a = Math.max(0, Math.min(1, breath * Math.min(1.3, fire)));
    ctx.globalAlpha = a;
    ctx.drawImage(state.bright.c, state.bright.ox, state.bright.oy);
    ctx.globalAlpha = Math.max(0, Math.min(1, 0.55 + 0.45 * a)) * Math.min(1, fire);
    ctx.drawImage(state.glow, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.front, 0, 0);
    drawSmoke(ctx, g, step, 1);
    drawSparks(ctx, g, t, step, sparks);
  }

  Kasuri.run({
    defaults: { fire: 1, shimmer: 1, sparks: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
