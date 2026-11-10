/*
 * 霧雨 Kirisame — fine mist rain over a moss garden.
 *
 * Cedars, moss, the stone lantern and the maple branch are baked once. Mist and a
 * pale light patch are tiling strips that slide slowly. Rain is a fixed pool of short
 * streaks, drops swell at leaf tips and fall, and a few rings spread in the puddle.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const TAU = Math.PI * 2;
  const SKY = ['#aeb3ad', '#b9bdb3', '#c5c6ba'];
  const CEDAR_FAR = ['#97a19b', '#8c9892'];
  const CEDAR_MID = ['#7d8c85', '#6f7e77'];
  const CEDAR_NEAR = ['#58695f', '#4c5d54'];
  const MOSS = ['#4a5d36', '#5a6f40', '#6f8450', '#879a62'];
  const STONE = { lit: '#a3a49a', mid: '#82847c', dark: '#5f625d', deep: '#43464a' };
  const LEAF = ['#8a3a28', '#a84a30', '#c4683a', '#d89a4c'];
  const WET = '#e4e8e0';
  const RAIN = 150;
  const DRIPS = 8;
  const RINGS = 8;
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
    const u = U * Math.min(1, W / (U * 150));
    return { W, H, U, u, gy: H * 0.74, lx: W * 0.62 };
  }

  // ---- backdrop ------------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.H);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / (g.H * 0.7)) * (inks.length - 1);
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

  // A cedar as stacked tapering tiers, drawn as one tall spire with ragged edges.
  function cedar(ctx, x, base, h, w, inks, rand) {
    ctx.fillStyle = inks[0];
    const pts = [x, base - h];
    const tiers = 7;
    for (let i = 1; i <= tiers; i++) {
      const f = i / tiers;
      const half = w * (0.12 + f * 0.88) * (0.85 + rand() * 0.3);
      pts.push(x + half, base - h * (1 - f) + (i % 2 ? h * 0.03 : 0));
    }
    for (let i = tiers; i >= 1; i--) {
      const f = i / tiers;
      const half = w * (0.12 + f * 0.88) * (0.85 + rand() * 0.3);
      pts.push(x - half, base - h * (1 - f) + (i % 2 ? h * 0.03 : 0));
    }
    poly(ctx, pts);
    ctx.fillStyle = inks[1];
    ctx.fillRect(x - w * 0.05, base - h * 0.2, w * 0.1, h * 0.25);
  }

  function cedarRow(ctx, g, rand, y, hMin, hMax, spacing, inks) {
    for (let x = -g.U * 4; x < g.W + g.U * 4; x += spacing * (0.7 + rand() * 0.6)) {
      const h = g.U * (hMin + rand() * (hMax - hMin));
      cedar(ctx, x, y, h, h * 0.13, inks, rand);
    }
  }

  function paintBackdrop(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    // far ridge, nearly the colour of the sky
    ctx.fillStyle = '#a6aea8';
    ctx.beginPath();
    ctx.moveTo(0, g.gy);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * 0.42 + fbm(x / (g.U * 40), 2.2, 3, 5) * g.H * 0.1);
    ctx.lineTo(g.W, g.gy);
    ctx.fill();
    cedarRow(ctx, g, rand, g.H * 0.5, 18, 30, g.U * 8, CEDAR_FAR);
    ctx.fillStyle = 'rgba(190,196,188,0.45)';
    ctx.fillRect(0, 0, g.W, g.gy);
    cedarRow(ctx, g, rand, g.H * 0.62, 26, 42, g.U * 10, CEDAR_MID);
    ctx.fillStyle = 'rgba(190,196,188,0.3)';
    ctx.fillRect(0, 0, g.W, g.gy);
    cedarRow(ctx, g, rand, g.H * 0.74, 34, 54, g.U * 16, CEDAR_NEAR);
    return c;
  }

  // ---- moss ground ---------------------------------------------------------

  function paintMoss(ctx, g, rand) {
    const top = g.gy - g.U * 3;
    ctx.fillStyle = MOSS[0];
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, top + fbm(x / (g.U * 12), 5.5, 3, 9) * g.U * 5);
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    // hummocks, dark base then lighter caps
    for (let i = 0; i < 90; i++) {
      const x = rand() * g.W;
      const y = lerp(top + g.U * 2, g.H, Math.pow(rand(), 0.8));
      const r = g.U * (1.4 + rand() * 3.2) * (0.6 + (y - top) / g.H * 3);
      ctx.fillStyle = MOSS[1];
      blob(ctx, x, y, r, r * 0.45);
      ctx.fillStyle = MOSS[2];
      blob(ctx, x - r * 0.15, y - r * 0.12, r * 0.7, r * 0.28);
      ctx.fillStyle = MOSS[3];
      blob(ctx, x - r * 0.3, y - r * 0.2, r * 0.32, r * 0.12);
    }
    // wet shine, small light flecks
    ctx.fillStyle = 'rgba(228,232,224,0.55)';
    for (let i = 0; i < 160; i++) {
      const y = lerp(top + g.U, g.H, rand());
      ctx.fillRect(rand() * g.W, y, Math.max(1, g.U * 0.5), 1);
    }
  }

  function steppingStone(ctx, g, x, y, w) {
    ctx.fillStyle = STONE.deep;
    blob(ctx, x, y + w * 0.06, w * 0.52, w * 0.2);
    ctx.fillStyle = STONE.dark;
    blob(ctx, x, y, w * 0.5, w * 0.18);
    ctx.fillStyle = STONE.mid;
    blob(ctx, x - w * 0.02, y - w * 0.03, w * 0.44, w * 0.14);
    ctx.fillStyle = STONE.lit;
    blob(ctx, x - w * 0.1, y - w * 0.06, w * 0.24, w * 0.06);
    ctx.fillStyle = MOSS[2];
    blob(ctx, x + w * 0.3, y - w * 0.02, w * 0.12, w * 0.05);
  }

  function paintPuddle(ctx, g) {
    const x = g.W * 0.27;
    const y = g.H * 0.91;
    ctx.fillStyle = '#3d4a42';
    blob(ctx, x, y, g.U * 15.5, g.U * 3.6);
    ctx.fillStyle = '#9ba39d';
    blob(ctx, x, y, g.U * 14.5, g.U * 3);
    ctx.fillStyle = '#b8beb6';
    blob(ctx, x - g.U * 2, y - g.U * 0.6, g.U * 8, g.U * 1.2);
    ctx.fillStyle = '#5f6a62';
    blob(ctx, x + g.U * 4, y + g.U * 0.9, g.U * 7, g.U * 0.9);
    state.puddle = { x, y, rx: g.U * 13, ry: g.U * 2.5 };
  }

  // ---- stone lantern -------------------------------------------------------

  function shaded(ctx, x, y, w, h, light) {
    ctx.fillStyle = STONE.mid;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = light ? STONE.lit : STONE.mid;
    ctx.fillRect(x, y, w * 0.35, h);
    ctx.fillStyle = STONE.dark;
    ctx.fillRect(x + w * 0.72, y, w * 0.28, h);
  }

  function lantern(ctx, g, rand) {
    const u = g.u * 1.5;
    const x = g.lx;
    const base = g.gy + g.U * 1.5;
    // ground slab
    ctx.fillStyle = STONE.deep;
    blob(ctx, x, base + u * 0.6, u * 9, u * 1.8);
    shaded(ctx, x - u * 7, base - u * 2.2, u * 14, u * 2.4, true);
    // post
    const postTop = base - u * 17;
    shaded(ctx, x - u * 2, postTop, u * 4, u * 14.8, true);
    ctx.fillStyle = STONE.dark;
    ctx.fillRect(x - u * 2.4, base - u * 9.4, u * 4.8, u * 1.4);
    ctx.fillStyle = STONE.lit;
    ctx.fillRect(x - u * 2.4, base - u * 9.4, u * 1.6, u * 0.5);
    // platform under the fire box
    poly(ctx, [x - u * 6.8, postTop - u * 1.8, x + u * 6.8, postTop - u * 1.8, x + u * 5.2, postTop + u * 0.4, x - u * 5.2, postTop + u * 0.4]);
    ctx.fillStyle = STONE.dark;
    poly(ctx, [x + u * 3, postTop - u * 1.8, x + u * 6.8, postTop - u * 1.8, x + u * 5.2, postTop + u * 0.4, x + u * 3, postTop + u * 0.4]);
    ctx.fillStyle = STONE.lit;
    ctx.fillRect(x - u * 6.8, postTop - u * 1.8, u * 13.6, Math.max(1, u * 0.45));
    // fire box with two small windows
    const boxTop = postTop - u * 9.8;
    shaded(ctx, x - u * 4.6, boxTop, u * 9.2, u * 8, true);
    ctx.fillStyle = '#2b2a28';
    ctx.fillRect(x - u * 2.9, boxTop + u * 1.6, u * 2.3, u * 4.4);
    ctx.fillRect(x + u * 0.7, boxTop + u * 1.6, u * 2.3, u * 4.4);
    state.glow = [x - u * 2.9, boxTop + u * 1.6, u * 2.3, u * 4.4, x + u * 0.7];
    // roof with upturned corners
    const rb = boxTop;
    ctx.fillStyle = STONE.dark;
    poly(ctx, [x - u * 11.5, rb - u * 1.6, x - u * 9, rb + u * 0.5, x + u * 9, rb + u * 0.5, x + u * 11.5, rb - u * 1.6, x + u * 5, rb - u * 3.2, x - u * 5, rb - u * 3.2]);
    ctx.fillStyle = STONE.mid;
    poly(ctx, [x - u * 11.5, rb - u * 1.6, x - u * 5, rb - u * 3.2, x + u * 5, rb - u * 3.2, x + u * 11.5, rb - u * 1.6, x + u * 7, rb - u * 1.1, x - u * 7, rb - u * 1.1]);
    poly(ctx, [x - u * 5, rb - u * 3.2, x + u * 5, rb - u * 3.2, x + u * 3, rb - u * 6.4, x - u * 3, rb - u * 6.4]);
    ctx.fillStyle = STONE.lit;
    poly(ctx, [x - u * 5, rb - u * 3.2, x - u * 1.5, rb - u * 3.2, x - u * 1, rb - u * 6.4, x - u * 3, rb - u * 6.4]);
    // jewel on top
    ctx.fillStyle = STONE.mid;
    blob(ctx, x, rb - u * 7.6, u * 1.7, u * 1.4);
    ctx.fillStyle = STONE.lit;
    blob(ctx, x - u * 0.5, rb - u * 7.9, u * 0.7, u * 0.5);
    poly(ctx, [x - u * 0.6, rb - u * 8.7, x + u * 0.6, rb - u * 8.7, x, rb - u * 10.4]);
    // moss on every upper face
    ctx.fillStyle = MOSS[1];
    blob(ctx, x - u * 3, rb - u * 3.4, u * 3.8, u * 0.7);
    blob(ctx, x + u * 6, rb - u * 1.2, u * 3, u * 0.5);
    blob(ctx, x, postTop - u * 1.9, u * 5.2, u * 0.45);
    blob(ctx, x, base - u * 2.2, u * 6.2, u * 0.55);
    ctx.fillStyle = MOSS[2];
    blob(ctx, x - u * 3.6, rb - u * 3.6, u * 2.2, u * 0.4);
    blob(ctx, x - u * 3, base - u * 2.3, u * 3.2, u * 0.35);
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = rand() < 0.5 ? MOSS[1] : MOSS[2];
      ctx.fillRect(x - u * 6 + rand() * u * 12, base - u * 2 + rand() * u * 1.6, Math.max(1, u * 0.5), 1);
    }
    // damp streaks on the post
    ctx.fillStyle = STONE.deep;
    ctx.fillRect(x - u * 0.8, postTop + u * 1, 1, u * 6);
    ctx.fillRect(x + u * 0.9, postTop + u * 4, 1, u * 5);
  }

  // ---- maple branch --------------------------------------------------------

  function mapleLeaf(ctx, x, y, r, a, tone) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = LEAF[tone];
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * TAU - Math.PI / 2;
      ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
      const mid = ang + TAU / 10;
      ctx.lineTo(Math.cos(mid) * r * 0.4, Math.sin(mid) * r * 0.4);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function paintBranch(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const U = g.U;
    const tips = [];
    ctx.strokeStyle = '#2b2622';
    ctx.lineCap = 'round';
    ctx.lineWidth = U * 1.8;
    ctx.beginPath();
    ctx.moveTo(-U * 4, U * 4);
    ctx.quadraticCurveTo(g.W * 0.1, U * 2, g.W * 0.22, U * 10);
    ctx.stroke();
    ctx.lineWidth = U * 0.7;
    const twigs = [[0.04, 3, 11], [0.08, 4, 15], [0.12, 5, 17], [0.16, 6, 21], [0.2, 9, 22]];
    for (const [fx, y0, y1] of twigs) {
      const x0 = g.W * fx;
      ctx.beginPath();
      ctx.moveTo(x0, U * y0);
      ctx.quadraticCurveTo(x0 + U * 2, U * (y0 + y1) * 0.5, x0 + U * 1, U * y1);
      ctx.stroke();
      for (let k = 0; k < 4; k++) {
        const lx = x0 + U * (rand() * 6 - 3);
        const ly = U * (y1 - 6 + k * 2.2 + rand() * 2);
        const r = U * (3.2 + rand() * 1.6);
        const tone = k < 2 ? 1 + Math.floor(rand() * 2) : Math.floor(rand() * 4);
        mapleLeaf(ctx, lx, ly, r, (rand() - 0.5) * 1.2, tone);
        // beads of water on the leaf
        ctx.fillStyle = WET;
        blob(ctx, lx - r * 0.25, ly - r * 0.2, Math.max(1, U * 0.28), Math.max(1, U * 0.28));
        blob(ctx, lx + r * 0.3, ly + r * 0.1, Math.max(1, U * 0.2), Math.max(1, U * 0.2));
        if (k >= 2 && tips.length < DRIPS) tips.push(lx, ly + r * 0.8);
      }
    }
    state.tips = tips;
    return c;
  }

  // ---- mist and light ------------------------------------------------------

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.5);
    const h = Math.ceil(g.H * 0.2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const f = (x, y) => fbm(x / (g.U * 16), y / (g.U * 5), 4, 61);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(f(x, y), f(x - w, y), x / w);
        const a = Math.round(smoothstep(0.34, 0.6, v) * band * 4) / 4;
        const i = (y * w + x) * 4;
        img.data[i] = 214;
        img.data[i + 1] = 219;
        img.data[i + 2] = 212;
        img.data[i + 3] = a * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintLight(g) {
    const w = Math.ceil(g.W * 1.6);
    const c = layer(w, g.H);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = 'rgba(232,234,226,0.1)';
      blob(ctx, w * (0.2 + i * 0.2), g.H * 0.3, g.W * (0.2 - i * 0.015), g.H * 0.28);
    }
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = 'rgba(232,234,226,0.1)';
      blob(ctx, w * (0.25 + i * 0.25), g.H * 0.3, g.W * 0.12, g.H * 0.16);
    }
    return c;
  }

  function drawMist(ctx, g, t, mist) {
    if (mist <= 0) return;
    const m = state.mist;
    const w = m.width;
    const a = (t * g.U * 0.9) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.8);
    ctx.drawImage(m, -a, g.H * 0.3);
    ctx.drawImage(m, w - a, g.H * 0.3);
    const b = (t * g.U * 0.5 + w * 0.45) % w;
    ctx.globalAlpha = Math.min(1, mist * 0.7);
    ctx.drawImage(m, b - w, g.H * 0.62);
    ctx.drawImage(m, b, g.H * 0.62);
    ctx.globalAlpha = 1;
  }

  function drawLight(ctx, g, t) {
    const l = state.light;
    const x = -g.W * 0.3 + (Math.sin(t * 0.06) * 0.5 + 0.5) * g.W * 0.3;
    ctx.drawImage(l, x, 0);
  }

  // ---- rain, drips, rings ---------------------------------------------------

  function makeRain(g, rand) {
    const f = () => new Float32Array(RAIN);
    const r = { x: f(), y: f(), len: f(), v: f(), far: new Uint8Array(RAIN) };
    for (let i = 0; i < RAIN; i++) {
      r.x[i] = rand() * (g.W + g.U * 10);
      r.y[i] = rand() * g.H;
      r.far[i] = rand() < 0.55 ? 1 : 0;
      r.len[i] = g.U * (r.far[i] ? 2.2 : 3.6);
      r.v[i] = g.U * (r.far[i] ? 38 : 56);
    }
    return r;
  }

  function drawRain(ctx, g, dt, amount) {
    const R = state.rain;
    const n = Math.min(RAIN, Math.round(RAIN * amount * 0.7));
    const slant = 0.14;
    for (let i = 0; i < n; i++) {
      R.y[i] += R.v[i] * dt;
      R.x[i] -= R.v[i] * slant * dt;
      if (R.y[i] > g.H) {
        R.y[i] = -R.len[i];
        R.x[i] = state.rand() * (g.W + g.U * 10);
      }
    }
    ctx.lineWidth = 1;
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? 'rgba(236,240,232,0.5)' : 'rgba(236,240,232,0.26)';
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        if (R.far[i] === pass) continue;
        ctx.moveTo(R.x[i], R.y[i]);
        ctx.lineTo(R.x[i] + R.len[i] * slant, R.y[i] - R.len[i]);
      }
      ctx.stroke();
    }
  }

  function makeDrips(g, rand) {
    const f = () => new Float32Array(DRIPS);
    const d = { x: f(), y: f(), y0: f(), size: f(), v: f(), wait: f(), mode: f() };
    const tips = state.tips;
    for (let i = 0; i < DRIPS; i++) {
      const k = (i % (tips.length / 2)) * 2;
      d.x[i] = tips[k];
      d.y0[i] = tips[k + 1];
      d.y[i] = d.y0[i];
      d.wait[i] = rand() * 8;
      d.mode[i] = 0;
    }
    return d;
  }

  function stepDrips(g, dt, amount) {
    const D = state.drips;
    const n = Math.min(DRIPS, Math.round(DRIPS * amount * 0.7));
    for (let i = 0; i < n; i++) {
      if (D.mode[i] === 0) {
        D.wait[i] -= dt;
        if (D.wait[i] <= 0) {
          D.size[i] += dt * 0.4;
          if (D.size[i] >= 1) {
            D.mode[i] = 1;
            D.v[i] = 0;
          }
        }
      } else {
        D.v[i] += g.U * 70 * dt;
        D.y[i] += D.v[i] * dt;
        if (D.y[i] > g.H * 0.97) {
          D.mode[i] = 0;
          D.y[i] = D.y0[i];
          D.size[i] = 0;
          D.wait[i] = 2 + state.rand() * 8;
        }
      }
    }
  }

  function drawDrips(ctx, g, amount) {
    const D = state.drips;
    const n = Math.min(DRIPS, Math.round(DRIPS * amount * 0.7));
    ctx.fillStyle = WET;
    for (let i = 0; i < n; i++) {
      if (D.mode[i] === 0 && D.size[i] <= 0) continue;
      const s = Math.max(1, g.U * 0.4 * (D.mode[i] === 0 ? D.size[i] : 1));
      if (D.mode[i] === 1) {
        ctx.fillRect(D.x[i], D.y[i] - g.U * 1.6, 1, g.U * 1.6);
      }
      blob(ctx, D.x[i], D.y[i], s, s * 1.3);
    }
  }

  function makeRings() {
    const f = () => new Float32Array(RINGS);
    return { x: f(), y: f(), age: f(), next: 0 };
  }

  function drawRings(ctx, g, dt, amount) {
    const R = state.rings;
    const p = state.puddle;
    R.next -= dt * Math.max(0.2, amount);
    if (R.next <= 0 && amount > 0) {
      let slot = 0;
      for (let i = 0; i < RINGS; i++) if (R.age[i] <= 0 || R.age[i] > 1.6) slot = i;
      R.x[slot] = p.x + (state.rand() * 2 - 1) * p.rx * 0.85;
      R.y[slot] = p.y + (state.rand() * 2 - 1) * p.ry * 0.6;
      R.age[slot] = 0.01;
      R.next = 0.25 + state.rand() * 0.45;
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < RINGS; i++) {
      if (R.age[i] <= 0 || R.age[i] > 1.6) continue;
      R.age[i] += dt;
      const a = 1 - R.age[i] / 1.6;
      if (a <= 0) continue;
      ctx.strokeStyle = 'rgba(236,240,232,' + (a * 0.7).toFixed(2) + ')';
      ctx.beginPath();
      ctx.ellipse(R.x[i], R.y[i], g.U * (0.4 + R.age[i] * 3.2), g.U * (0.12 + R.age[i] * 0.8), 0, 0, TAU);
      ctx.stroke();
    }
  }

  function drawGlow(ctx, g, t) {
    const [x, y, w, h, x2] = state.glow;
    const a = 0.5 + Math.sin(t * 0.7) * 0.06 + Math.sin(t * 1.9) * 0.03;
    ctx.fillStyle = 'rgba(214,170,84,' + a.toFixed(3) + ')';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillRect(x2 + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = 'rgba(240,214,140,' + (a * 0.6).toFixed(3) + ')';
    ctx.fillRect(x + 1, y + h * 0.5, w - 2, h * 0.4);
    ctx.fillRect(x2 + 1, y + h * 0.5, w - 2, h * 0.4);
  }

  // ---- run -----------------------------------------------------------------

  function paintGround(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintMoss(ctx, g, rand);
    steppingStone(ctx, g, g.W * 0.46, g.H * 0.96, g.U * 12);
    steppingStone(ctx, g, g.W * 0.56, g.H * 0.9, g.U * 9);
    steppingStone(ctx, g, g.W * 0.8, g.H * 0.93, g.U * 10);
    paintPuddle(ctx, g);
    lantern(ctx, g, rand);
    // a few fallen maple leaves on the moss
    for (let i = 0; i < 6; i++) {
      mapleLeaf(ctx, g.W * (0.08 + rand() * 0.84), g.H * (0.86 + rand() * 0.12), g.U * (1.2 + rand() * 0.8), rand() * TAU, 1 + Math.floor(rand() * 3));
    }
    return c;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBackdrop(g, rand);
    state.ground = paintGround(g, rand);
    state.front = paintBranch(g, rand);
    state.mist = paintMist(g);
    state.light = paintLight(g);
    state.rain = makeRain(g, rand);
    state.drips = makeDrips(g, rand);
    state.rings = makeRings();
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { rain, mist, drips } = api.props;
    const step = Math.min(dt, 0.1);
    stepDrips(g, step, drips);
    ctx.drawImage(state.back, 0, 0);
    drawMist(ctx, g, t, mist);
    ctx.drawImage(state.ground, 0, 0);
    drawGlow(ctx, g, t);
    drawLight(ctx, g, t);
    drawRings(ctx, g, step, rain);
    ctx.drawImage(state.front, 0, 0);
    drawDrips(ctx, g, drips);
    drawRain(ctx, g, step, rain);
  }

  Kasuri.run({
    defaults: { rain: 1, mist: 1, drips: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
