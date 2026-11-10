/*
 * 春雨 Harusame — soft spring rain on a temple hall roof.
 *
 * Sky, hills, pagoda, tiled roof, hall front and the cherry branch are baked once.
 * Rain curtains are one tiling strip that drifts sideways. Rain streaks, eave drips
 * and falling petals are short reused pools drawn in a few strokes.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;

  const TAU = Math.PI * 2;
  const SKY = ['#8d98a6', '#a3adb6', '#bcc0bf', '#d2cfc3', '#e2dccb'];
  const PAGODA = '#6d7a8e';
  const TILE = { base: '#3b4658', row: '#2b3342', cap: '#5b6a80', wet: '#7d8da3', gloss: '#a3b2c4' };
  const PETAL = ['#ecd9d3', '#e2c3c0', '#f1e6dc', '#d9b0b0'];
  const WOOD = { vermilion: '#b8432c', dark: '#241f22', beam: '#33292a', plaster: '#d8d0bc' };
  const BRANCH = '#3a2e2c';
  const MAX_DROPS = 150;
  const MAX_PETALS = 40;
  const MAX_DRIPS = 18;
  const WIND = -0.22;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), rot || 0, 0, TAU);
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
    const ridgeY = H * 0.47;
    const eaveY = H * 0.8;
    return {
      W, H, U,
      ridgeY, eaveY,
      ridgeL: W * 0.32,
      ridgeR: W * 0.8,
      eaveL: -W * 0.06,
      eaveR: W * 1.06,
      lift: U * 3.2,
    };
  }

  // Height of the lower roof edge at x: flat in the middle, swept up toward the corners.
  function eaveAt(g, x) {
    const half = (g.eaveR - g.eaveL) / 2;
    const mid = (g.eaveR + g.eaveL) / 2;
    const d = Math.max(0, (Math.abs(x - mid) - half * 0.5) / (half * 0.5));
    return g.eaveY - g.lift * d * d;
  }

  // Height of the roof surface at column x and fraction f (0 ridge, 1 eave) of the way down.
  function slopeEdgeLeft(g, f) {
    return lerp(g.ridgeL, g.eaveL, f);
  }
  function slopeEdgeRight(g, f) {
    return lerp(g.ridgeR, g.eaveR, f);
  }

  // ---- sky, hills, pagoda -------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const h = g.H;
    const img = ctx.createImageData(g.W, h);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const f = Math.min(1, y / (g.H * 0.55)) * (inks.length - 1);
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
    ctx.fillStyle = '#c9cbcc';
    for (let i = 0; i < 6; i++) {
      const x = g.W * (0.05 + rand() * 0.9);
      const y = g.H * (0.04 + rand() * 0.16);
      ctx.globalAlpha = 0.5;
      blob(ctx, x, y, g.U * (10 + rand() * 18), g.U * (0.8 + rand() * 0.9));
    }
    ctx.globalAlpha = 1;
  }

  function hillLine(g, x, k) {
    return g.H * (0.3 + 0.07 * k) + fbm(x / (g.U * 38), 2.2 + k, 4, 17 + k) * g.H * 0.1;
  }

  function paintHills(ctx, g, rand) {
    const tones = ['#9ba5b0', '#87958f', '#6f8078'];
    const fogs = [0.35, 0.28, 0.15];
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = tones[k];
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, hillLine(g, x, k));
      ctx.lineTo(g.W, g.H);
      ctx.fill();
      ctx.fillStyle = '#d6d2c4';
      ctx.globalAlpha = fogs[k];
      ctx.fillRect(0, hillLine(g, g.W / 2, k) - g.U * 1.5, g.W, g.U * 7);
      ctx.globalAlpha = 1;
    }
    // far cherry trees on the nearer hill as soft pale clouds
    for (let x = 0; x < g.W; x += g.U * (3 + rand() * 4)) {
      const y = hillLine(g, x, 2) + g.U * (1.5 + rand() * 3);
      const r = g.U * (1.6 + rand() * 1.8);
      ctx.fillStyle = rand() < 0.6 ? '#d9c5c2' : '#c9b6b5';
      ctx.globalAlpha = 0.85;
      blob(ctx, x, y, r, r * 0.7);
      ctx.fillStyle = '#e8dad4';
      blob(ctx, x - r * 0.25, y - r * 0.2, r * 0.55, r * 0.4);
      ctx.fillStyle = '#4f6558';
      blob(ctx, x + r * 0.2, y + r * 0.8, r * 0.9, r * 0.5);
    }
    ctx.globalAlpha = 1;
  }

  // A five-storey pagoda in haze: stacked boxes with wide upswept eaves and a spire.
  function paintPagoda(ctx, g, x, base, h) {
    const u = h / 40;
    ctx.fillStyle = PAGODA;
    ctx.globalAlpha = 0.9;
    let y = base;
    for (let i = 0; i < 5; i++) {
      const w = u * (7.2 - i * 0.95);
      const bodyH = u * 4.1;
      ctx.fillRect(x - w * 0.62, y - bodyH, w * 1.24, bodyH);
      const ew = w * 1.9;
      const ey = y - bodyH;
      ctx.beginPath();
      ctx.moveTo(x - ew, ey + u * 0.9);
      ctx.quadraticCurveTo(x - ew * 0.55, ey + u * 0.5, x - w * 0.7, ey - u * 0.4);
      ctx.lineTo(x + w * 0.7, ey - u * 0.4);
      ctx.quadraticCurveTo(x + ew * 0.55, ey + u * 0.5, x + ew, ey + u * 0.9);
      ctx.quadraticCurveTo(x + ew * 0.5, ey + u * 1.5, x, ey + u * 1.5);
      ctx.quadraticCurveTo(x - ew * 0.5, ey + u * 1.5, x - ew, ey + u * 0.9);
      ctx.fill();
      y = ey - u * 0.4;
    }
    ctx.fillRect(x - u * 0.28, y - u * 7, u * 0.56, u * 7.4);
    for (let i = 0; i < 4; i++) ctx.fillRect(x - u * (0.9 - i * 0.18), y - u * (1.3 + i * 1.3), u * (1.8 - i * 0.36), u * 0.4);
    ctx.globalAlpha = 1;
  }

  // ---- the roof -----------------------------------------------------------------

  function roofShape(ctx, g, topInset) {
    ctx.beginPath();
    ctx.moveTo(g.eaveL, eaveAt(g, g.eaveL));
    ctx.quadraticCurveTo(lerp(g.eaveL, g.ridgeL, 0.72), lerp(g.eaveY, g.ridgeY, 0.5), g.ridgeL, g.ridgeY + topInset);
    ctx.lineTo(g.ridgeR, g.ridgeY + topInset);
    ctx.quadraticCurveTo(lerp(g.eaveR, g.ridgeR, 0.72), lerp(g.eaveY, g.ridgeY, 0.5), g.eaveR, eaveAt(g, g.eaveR));
    const n = 30;
    for (let i = n; i >= 0; i--) {
      const x = lerp(g.eaveL, g.eaveR, i / n);
      ctx.lineTo(x, eaveAt(g, x));
    }
    ctx.closePath();
  }

  function paintTiles(ctx, g, rand) {
    const U = g.U;
    roofShape(ctx, g, 0);
    ctx.fillStyle = TILE.base;
    ctx.fill();
    ctx.save();
    roofShape(ctx, g, 0);
    ctx.clip();
    const rowH = U * 1.5;
    const colW = U * 1.7;
    // courses of flat tile, each row shifted a little in tone
    for (let y = g.ridgeY; y < g.eaveY + g.lift; y += rowH) {
      const f = (y - g.ridgeY) / (g.eaveY - g.ridgeY);
      ctx.fillStyle = TILE.row;
      ctx.fillRect(g.eaveL, y, g.eaveR - g.eaveL, Math.max(1, U * 0.28));
      ctx.fillStyle = TILE.wet;
      ctx.globalAlpha = 0.12 + 0.18 * f;
      ctx.fillRect(g.eaveL, y + U * 0.3, g.eaveR - g.eaveL, Math.max(1, U * 0.2));
      ctx.globalAlpha = 1;
    }
    // raised round tiles running down the slope, fanning a little toward the corners
    const mid = (g.ridgeL + g.ridgeR) / 2;
    for (let x = g.eaveL - colW; x < g.eaveR + colW; x += colW) {
      const lean = (x - mid) / (g.eaveR - g.eaveL);
      ctx.fillStyle = TILE.cap;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(x, g.eaveY + g.lift);
      ctx.lineTo(x + lean * U * 20, g.ridgeY);
      ctx.lineTo(x + lean * U * 20 + Math.max(1, U * 0.5), g.ridgeY);
      ctx.lineTo(x + Math.max(1, U * 0.5), g.eaveY + g.lift);
      ctx.fill();
      ctx.fillStyle = TILE.gloss;
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.moveTo(x, g.eaveY + g.lift);
      ctx.lineTo(x + lean * U * 20, g.ridgeY);
      ctx.lineTo(x + lean * U * 20 + Math.max(1, U * 0.2), g.ridgeY);
      ctx.lineTo(x + Math.max(1, U * 0.2), g.eaveY + g.lift);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // wet sheen across the lower slope
    const sheen = ctx.createLinearGradient(0, g.ridgeY, 0, g.eaveY);
    sheen.addColorStop(0, 'rgba(163,178,196,0)');
    sheen.addColorStop(0.55, 'rgba(163,178,196,0.1)');
    sheen.addColorStop(1, 'rgba(163,178,196,0.22)');
    ctx.fillStyle = sheen;
    ctx.fillRect(g.eaveL, g.ridgeY, g.eaveR - g.eaveL, g.eaveY - g.ridgeY + g.lift);
    ctx.restore();
  }

  function paintRidge(ctx, g) {
    const U = g.U;
    const x0 = g.ridgeL - U * 1.2;
    const x1 = g.ridgeR + U * 1.2;
    ctx.fillStyle = '#222a37';
    ctx.fillRect(x0, g.ridgeY - U * 2.4, x1 - x0, U * 2.8);
    ctx.fillStyle = TILE.cap;
    for (let x = x0; x < x1; x += U * 1.9) blob(ctx, x + U * 0.9, g.ridgeY - U * 1.1, U * 0.95, U * 1.1);
    ctx.fillStyle = TILE.gloss;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(x0, g.ridgeY - U * 2.2, x1 - x0, Math.max(1, U * 0.25));
    ctx.globalAlpha = 1;
    // owl-tail ends curl up at both ends of the ridge
    for (const s of [-1, 1]) {
      const bx = s < 0 ? x0 : x1;
      const by = g.ridgeY - U * 0.8;
      ctx.fillStyle = '#222a37';
      ctx.beginPath();
      ctx.moveTo(bx, by + U * 1.6);
      ctx.lineTo(bx - s * U * 2.4, by + U * 1.6);
      ctx.quadraticCurveTo(bx - s * U * 2.8, by - U * 4, bx + s * U * 0.4, by - U * 6.4);
      ctx.quadraticCurveTo(bx + s * U * 1.4, by - U * 4.4, bx + s * U * 1.2, by - U * 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = TILE.cap;
      blob(ctx, bx - s * U * 0.5, by - U * 3.4, U * 0.45, U * 1.6, s * 0.3);
    }
  }

  // Under the eaves: round-ended rafters, the dark open hall and vermilion pillars.
  function paintHall(ctx, g, rand) {
    const U = g.U;
    const ex = g.eaveL;
    const n = 36;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const x = lerp(g.eaveL, g.eaveR, i / n);
      pts.push(x, eaveAt(g, x));
    }
    for (let i = n; i >= 0; i--) {
      const x = lerp(g.eaveL, g.eaveR, i / n);
      pts.push(x, eaveAt(g, x) + U * 3.2);
    }
    ctx.fillStyle = '#3a2d2c';
    poly(ctx, pts);
    ctx.fillStyle = '#d6cdb7';
    for (let x = ex; x < g.eaveR; x += U * 1.9) {
      const y = eaveAt(g, x) + U * 2.6;
      ctx.fillRect(x, y, Math.max(1, U * 0.9), Math.max(1, U * 0.7));
    }
    // face of the hall
    const top = g.eaveY + U * 3.2;
    ctx.fillStyle = WOOD.dark;
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = WOOD.plaster;
    ctx.fillRect(0, top, g.W, U * 1.4);
    ctx.fillStyle = WOOD.vermilion;
    ctx.fillRect(0, top + U * 1.4, g.W, U * 1.6);
    ctx.fillStyle = WOOD.beam;
    ctx.fillRect(0, top + U * 3, g.W, U * 0.8);
    const gap = U * 17;
    for (let x = g.W * 0.08; x < g.W + gap; x += gap) {
      ctx.fillStyle = WOOD.vermilion;
      ctx.fillRect(x - U * 1.1, top + U * 1.4, U * 2.2, g.H - top);
      ctx.fillStyle = '#e07a58';
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x - U * 0.8, top + U * 3.8, Math.max(1, U * 0.4), g.H - top);
      ctx.globalAlpha = 1;
      // bracket block at the pillar head
      ctx.fillStyle = '#e4dccb';
      ctx.fillRect(x - U * 2, top + U * 3.8, U * 4, U * 0.9);
      ctx.fillStyle = WOOD.dark;
      ctx.fillRect(x - U * 1.4, top + U * 4.7, U * 2.8, U * 0.8);
    }
    // a paper lantern glow far inside the hall
    ctx.fillStyle = '#c9a24c';
    ctx.globalAlpha = 0.8;
    blob(ctx, g.W * 0.5, top + U * 9, U * 1.1, U * 1.5);
    ctx.globalAlpha = 0.18;
    blob(ctx, g.W * 0.5, top + U * 9, U * 4, U * 4.6);
    ctx.globalAlpha = 1;
    // wet step at the very bottom
    ctx.fillStyle = '#4b4a4a';
    ctx.fillRect(0, g.H - U * 2.4, g.W, U * 2.4);
    ctx.fillStyle = '#76787c';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, g.H - U * 2.4, g.W, Math.max(1, U * 0.3));
    ctx.globalAlpha = 1;
  }

  // petals plastered onto the slope, thicker toward the eave where water carries them
  function paintStuckPetals(ctx, g, rand) {
    const count = Math.round(g.W * g.H * 0.012);
    const pts = [];
    for (let i = 0; i < count; i++) {
      const f = Math.pow(rand(), 0.7);
      const y = lerp(g.ridgeY + g.U * 2, g.eaveY, f);
      const lo = slopeEdgeLeft(g, (y - g.ridgeY) / (g.eaveY - g.ridgeY));
      const hi = slopeEdgeRight(g, (y - g.ridgeY) / (g.eaveY - g.ridgeY));
      pts.push(lerp(lo, hi, rand()), y);
    }
    for (let i = 0; i < pts.length; i += 2) {
      const r = g.U * (0.28 + rand() * 0.34);
      ctx.fillStyle = PETAL[Math.floor(rand() * PETAL.length)];
      ctx.globalAlpha = 0.85;
      blob(ctx, pts[i], pts[i + 1], r, r * 0.55, rand() * Math.PI);
    }
    ctx.globalAlpha = 1;
    // a drift gathered along the eave edge
    for (let x = 0; x < g.W; x += g.U * (0.9 + rand() * 1.6)) {
      if (rand() < 0.35) continue;
      const r = g.U * (0.3 + rand() * 0.4);
      ctx.fillStyle = PETAL[Math.floor(rand() * PETAL.length)];
      blob(ctx, x, eaveAt(g, x) - g.U * (0.2 + rand() * 1.1), r, r * 0.55, rand() * Math.PI);
    }
  }

  // ---- cherry branch ------------------------------------------------------------

  function blossom(ctx, x, y, r, rand) {
    const tone = PETAL[Math.floor(rand() * 3)];
    ctx.fillStyle = tone;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + rand() * 0.4;
      blob(ctx, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.55, r * 0.4, a);
    }
    ctx.fillStyle = '#b9806f';
    blob(ctx, x, y, r * 0.22, r * 0.22);
  }

  function twig(ctx, g, rand, x, y, ang, len, w, depth) {
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len + len * 0.08;
    ctx.strokeStyle = BRANCH;
    ctx.lineWidth = Math.max(1, w);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo((x + x2) / 2 + (rand() - 0.5) * len * 0.3, (y + y2) / 2 + (rand() - 0.5) * len * 0.3, x2, y2);
    ctx.stroke();
    if (depth > 0) {
      const k = 2 + (rand() < 0.5 ? 1 : 0);
      for (let i = 0; i < k; i++) {
        twig(ctx, g, rand, x2, y2, ang + (rand() - 0.5) * 1.5, len * (0.55 + rand() * 0.25), w * 0.62, depth - 1);
      }
    }
    if (depth < 2) {
      const n = 3 + Math.floor(rand() * 4);
      for (let i = 0; i < n; i++) {
        const bx = x2 + (rand() - 0.5) * g.U * 4;
        const by = y2 + (rand() - 0.5) * g.U * 3;
        blossom(ctx, bx, by, g.U * (0.9 + rand() * 0.9), rand);
      }
    }
  }

  function paintBranch(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const U = g.U;
    ctx.lineCap = 'round';
    // main limb reaching in from the upper right
    ctx.strokeStyle = BRANCH;
    ctx.lineWidth = Math.max(2, U * 2.2);
    ctx.beginPath();
    ctx.moveTo(g.W + U * 4, U * 7);
    ctx.quadraticCurveTo(g.W * 0.9, U * 20, g.W * 0.74, U * 17);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, U * 1.3);
    ctx.beginPath();
    ctx.moveTo(g.W * 0.9, U * 15);
    ctx.quadraticCurveTo(g.W * 0.84, U * 5, g.W * 0.7, U * 3);
    ctx.stroke();
    twig(ctx, g, rand, g.W * 0.74, U * 17, Math.PI * 0.95, U * 13, U * 1.0, 3);
    twig(ctx, g, rand, g.W * 0.82, U * 17, Math.PI * 1.15, U * 11, U * 0.9, 3);
    twig(ctx, g, rand, g.W * 0.7, U * 3, Math.PI * 0.85, U * 12, U * 0.9, 3);
    twig(ctx, g, rand, g.W * 0.92, U * 14, Math.PI * 0.6, U * 9, U * 0.8, 3);
    return c;
  }

  // ---- rain curtains ------------------------------------------------------------

  function paintCurtains(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const slant = g.H * WIND * -1;
    const bands = 7;
    for (let i = 0; i < bands; i++) {
      const x = (i / bands) * g.W + rand() * g.W * 0.06;
      const w = g.U * (9 + rand() * 12);
      const top = g.H * (rand() * 0.2);
      for (let s = 0; s < 3; s++) {
        const grow = s * g.U * 4;
        ctx.fillStyle = '#dde0df';
        ctx.globalAlpha = 0.06 + rand() * 0.03;
        for (const off of [-g.W, 0, g.W]) {
          poly(ctx, [x - grow + off, top, x + w + grow + off, top, x + w + grow + off - slant, g.H, x - grow + off - slant, g.H]);
        }
      }
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- pools --------------------------------------------------------------------

  function makeDrops(g, rand) {
    const d = { x: new Float32Array(MAX_DROPS), y: new Float32Array(MAX_DROPS), len: new Float32Array(MAX_DROPS), v: new Float32Array(MAX_DROPS) };
    for (let i = 0; i < MAX_DROPS; i++) {
      d.x[i] = rand() * (g.W + g.H * 0.3);
      d.y[i] = rand() * g.H;
      d.len[i] = g.U * (1.8 + rand() * 2.4);
      d.v[i] = g.U * (46 + rand() * 30);
    }
    return d;
  }

  function makePetals(g, rand) {
    const p = { x: new Float32Array(MAX_PETALS), y: new Float32Array(MAX_PETALS), a: new Float32Array(MAX_PETALS), ph: new Float32Array(MAX_PETALS), sz: new Float32Array(MAX_PETALS), tone: new Uint8Array(MAX_PETALS), v: new Float32Array(MAX_PETALS) };
    for (let i = 0; i < MAX_PETALS; i++) resetPetal(g, p, i, rand, true);
    return p;
  }

  function resetPetal(g, p, i, rand, anywhere) {
    p.x[i] = g.W * (0.3 + rand() * 0.8);
    p.y[i] = anywhere ? rand() * g.H * 0.9 : -g.U * 2;
    p.a[i] = rand() * TAU;
    p.ph[i] = rand() * TAU;
    p.sz[i] = g.U * (0.5 + rand() * 0.45);
    p.tone[i] = Math.floor(rand() * PETAL.length);
    p.v[i] = g.U * (3.5 + rand() * 3);
  }

  function makeDrips(g, rand) {
    const d = { x: new Float32Array(MAX_DRIPS), y: new Float32Array(MAX_DRIPS), v: new Float32Array(MAX_DRIPS), wait: new Float32Array(MAX_DRIPS) };
    for (let i = 0; i < MAX_DRIPS; i++) {
      d.x[i] = (i + 0.3 + rand() * 0.4) / MAX_DRIPS * g.W;
      d.y[i] = eaveAt(g, d.x[i]) + g.U * 3.4;
      d.v[i] = 0;
      d.wait[i] = rand() * 3;
    }
    return d;
  }

  function stepDrops(g, d, count, dt) {
    for (let i = 0; i < count; i++) {
      d.y[i] += d.v[i] * dt;
      d.x[i] += d.v[i] * dt * WIND;
      if (d.y[i] > g.H) {
        d.y[i] -= g.H + d.len[i];
        d.x[i] = Math.random() * (g.W + g.H * 0.3);
      }
    }
  }

  function drawDrops(ctx, g, d, count) {
    ctx.strokeStyle = '#d4d8d8';
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(1, g.U * 0.2);
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      ctx.moveTo(d.x[i], d.y[i]);
      ctx.lineTo(d.x[i] - d.len[i] * WIND, d.y[i] - d.len[i]);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function stepDrips(g, d, dt) {
    for (let i = 0; i < MAX_DRIPS; i++) {
      if (d.v[i] === 0) {
        d.wait[i] -= dt;
        if (d.wait[i] <= 0) d.v[i] = g.U * 4;
      } else {
        d.v[i] += g.U * 70 * dt;
        d.y[i] += d.v[i] * dt;
        if (d.y[i] > g.H - g.U * 2.4) {
          d.y[i] = eaveAt(g, d.x[i]) + g.U * 3.4;
          d.v[i] = 0;
          d.wait[i] = 0.6 + Math.random() * 2.6;
        }
      }
    }
  }

  function drawDrips(ctx, g, d, amount) {
    ctx.fillStyle = '#d8dcdc';
    ctx.globalAlpha = 0.75;
    const n = Math.round(MAX_DRIPS * Math.min(1, amount));
    for (let i = 0; i < n; i++) {
      if (d.v[i] === 0) continue;
      ctx.fillRect(d.x[i], d.y[i], Math.max(1, g.U * 0.3), Math.max(1, g.U * 1.1));
    }
    ctx.globalAlpha = 1;
  }

  function stepPetals(g, p, count, t, dt) {
    for (let i = 0; i < count; i++) {
      p.y[i] += p.v[i] * dt;
      p.x[i] += Math.sin(t * 0.9 + p.ph[i]) * g.U * 3 * dt - g.U * 1.6 * dt;
      p.a[i] += dt * 1.1;
      if (p.y[i] > g.eaveY - g.U * 3) resetPetal(g, p, i, state.rand, false);
    }
  }

  function drawPetals(ctx, g, p, count, t) {
    for (let i = 0; i < count; i++) {
      const sq = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.5 + p.ph[i]));
      const c = Math.cos(p.a[i]);
      const s = Math.sin(p.a[i]);
      const sz = p.sz[i];
      ctx.fillStyle = PETAL[p.tone[i]];
      ctx.setTransform(c, s * sq, -s, c * sq, p.x[i], p.y[i]);
      ctx.fillRect(-sz, -sz * 0.55, sz * 2, sz * 1.1);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run ----------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    const back = layer(g.W, g.H);
    const bctx = back.getContext('2d');
    paintSky(bctx, g, rand);
    paintHills(bctx, g, rand);
    paintPagoda(bctx, g, g.W * 0.15, g.H * 0.62, g.H * 0.5);
    paintTiles(bctx, g, rand);
    paintRidge(bctx, g);
    paintStuckPetals(bctx, g, rand);
    paintHall(bctx, g, rand);
    state.back = back;
    state.branch = paintBranch(g, rand);
    state.curtains = paintCurtains(g, rand);
    state.drops = makeDrops(g, rand);
    state.petals = makePetals(g, rand);
    state.drips = makeDrips(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { rain, petals, mist } = api.props;
    const step = Math.min(dt, 0.1);
    const nDrops = Math.min(MAX_DROPS, Math.round(75 * rain));
    const nPetals = Math.min(MAX_PETALS, Math.round(22 * petals));
    stepDrops(g, state.drops, nDrops, step);
    stepDrips(g, state.drips, step);
    stepPetals(g, state.petals, nPetals, t, step);
    ctx.drawImage(state.back, 0, 0);
    const shift = (t * g.U * 2.4) % g.W;
    ctx.globalAlpha = Math.min(1, mist * 0.9 + 0.05);
    ctx.drawImage(state.curtains, shift, 0);
    ctx.drawImage(state.curtains, shift - g.W, 0);
    ctx.globalAlpha = 0.6 * Math.min(1, 0.4 + mist * 0.5);
    ctx.drawImage(state.curtains, g.W * 0.37 - shift * 0.6, 0);
    ctx.drawImage(state.curtains, g.W * 0.37 - shift * 0.6 + g.W, 0);
    ctx.globalAlpha = 1;
    drawDrips(ctx, g, state.drips, rain);
    drawDrops(ctx, g, state.drops, nDrops);
    ctx.drawImage(state.branch, 0, 0);
    drawPetals(ctx, g, state.petals, nPetals, t);
  }

  Kasuri.run({
    defaults: { rain: 1, petals: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
