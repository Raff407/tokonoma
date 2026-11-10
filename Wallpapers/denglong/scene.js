/*
 * 灯笼 — rows of red silk lanterns in a tiled courtyard at dusk.
 *
 * Sky, roof tiles, whitewashed wall, moon gate and the brick floor are baked once.
 * Each lantern size is a small sprite that swings from its string on a slow wave;
 * its warm halo and floor pool ride along with it. Plum petals are a short pool.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const SKY = ['#1f2a4a', '#34406a', '#6a5f7a', '#b07a62', '#d6a46a'];
  const WALL = { lit: '#bfb7a2', shade: '#8f8a7c', cap: '#3a3f46', capLine: '#555b63' };
  const BRICK = ['#6a6f78', '#5f646e', '#767b82'];
  const BRICK_LINE = '#2c3038';
  const BEAM = { wood: '#3a2a22', edge: '#241912', tile: '#2d3238', tileHi: '#4a5058' };
  const RED = { dark: '#7c1f17', mid: '#b4392a', lit: '#d9603a', hot: '#f0a25a' };
  const GOLD = { cap: '#c9a24a', dark: '#8a6a2c' };
  const PETAL = ['#e8d6cf', '#d9b7b0'];
  const MAX_PETALS = 18;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    return { W, H, U: H / 100, floorY: Math.round(H * 0.62), wallY: Math.round(H * 0.34), cx: W * 0.5 };
  }

  // ---- baked backdrop --------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const inks = SKY.map(K.parseColor);
    const h = g.wallY + 2;
    const img = ctx.createImageData(g.W, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const f = Math.min(1, y / h) * (inks.length - 1);
      const k = Math.min(inks.length - 2, Math.floor(f));
      for (let x = 0; x < g.W; x++) {
        const ink = inks[k + (rand() < f - k ? 1 : 0)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0]; d[i + 1] = ink[1]; d[i + 2] = ink[2]; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#c99a78';
    for (let i = 0; i < 4; i++) {
      const x = g.W * (0.1 + rand() * 0.8);
      const y = g.H * (0.16 + rand() * 0.12);
      ctx.beginPath();
      ctx.ellipse(x, y, g.U * (7 + rand() * 9), g.U * 0.6, 0, 0, TAU);
      ctx.fill();
    }
  }

  function paintFarRoof(ctx, g) {
    const U = g.U;
    const y = g.wallY - U * 0.5;
    ctx.fillStyle = '#2a2f3f';
    [[0.14, 17], [0.84, 20]].forEach(([fx, w]) => {
      const x = g.W * fx;
      const hw = U * w;
      ctx.beginPath();
      ctx.moveTo(x - hw * 1.1, y - U * 1.6);
      ctx.quadraticCurveTo(x - hw * 0.7, y, x - hw * 0.45, y - U * 4.5);
      ctx.lineTo(x + hw * 0.45, y - U * 4.5);
      ctx.quadraticCurveTo(x + hw * 0.7, y, x + hw * 1.1, y - U * 1.6);
      ctx.lineTo(x + hw, y + U);
      ctx.lineTo(x - hw, y + U);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x - hw * 0.35, y - U * 5.4, hw * 0.7, U * 1.2);
    });
  }

  function paintWall(ctx, g) {
    const U = g.U;
    const top = g.wallY;
    const h = g.floorY - top;
    ctx.fillStyle = WALL.lit;
    ctx.fillRect(0, top, g.W, h);
    const sh = ctx.createLinearGradient(0, top, 0, g.floorY);
    sh.addColorStop(0, 'rgba(35,40,70,0.55)');
    sh.addColorStop(0.5, 'rgba(60,50,70,0.15)');
    sh.addColorStop(1, 'rgba(80,50,50,0.1)');
    ctx.fillStyle = sh;
    ctx.fillRect(0, top, g.W, h);
    // wavy grey tile cap
    ctx.fillStyle = WALL.cap;
    ctx.fillRect(0, top - U * 1.2, g.W, U * 2.2);
    ctx.fillStyle = WALL.capLine;
    for (let x = 0; x < g.W; x += U * 1.6) ctx.fillRect(x, top + U * 0.2, Math.max(1, U * 0.3), U * 0.8);
    // lower plinth
    ctx.fillStyle = '#5a5e66';
    ctx.fillRect(0, g.floorY - U * 2.4, g.W, U * 2.4);
    // lattice windows either side
    [0.17, 0.83].forEach((fx) => {
      const x = g.W * fx;
      const w = U * 11;
      const y = top + U * 4;
      ctx.fillStyle = '#2b2f3a';
      ctx.fillRect(x - w / 2, y, w, w * 0.95);
      ctx.strokeStyle = '#6a5a48';
      ctx.lineWidth = Math.max(1, U * 0.35);
      ctx.strokeRect(x - w / 2, y, w, w * 0.95);
      for (let k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(x - w / 2 + (w * k) / 4, y);
        ctx.lineTo(x - w / 2 + (w * k) / 4, y + w * 0.95);
        ctx.moveTo(x - w / 2, y + (w * 0.95 * k) / 4);
        ctx.lineTo(x + w / 2, y + (w * 0.95 * k) / 4);
        ctx.stroke();
      }
    });
  }

  function paintMoonGate(ctx, g, rand) {
    const U = g.U;
    const r = U * 13.5;
    const cy = g.floorY - r + U * 2;
    const cx = g.cx;
    ctx.fillStyle = '#6a6354';
    ctx.beginPath();
    ctx.arc(cx, cy, r + U * 1.2, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.clip();
    const gr = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    gr.addColorStop(0, '#46598a');
    gr.addColorStop(1, '#6a8a74');
    ctx.fillStyle = gr;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = '#d8cfae';
    ctx.beginPath();
    ctx.arc(cx + r * 0.35, cy - r * 0.42, r * 0.17, 0, TAU);
    ctx.fill();
    // bamboo beyond
    ctx.strokeStyle = '#2a5a44';
    ctx.lineWidth = Math.max(1, U * 0.7);
    for (let i = 0; i < 5; i++) {
      const x = cx - r * 0.8 + i * r * 0.4 + (rand() - 0.5) * U;
      ctx.beginPath();
      ctx.moveTo(x, cy + r);
      ctx.lineTo(x + (rand() - 0.5) * U * 2, cy - r * (0.2 + rand() * 0.7));
      ctx.stroke();
    }
    ctx.fillStyle = '#356a52';
    for (let i = 0; i < 26; i++) {
      const x = cx + (rand() - 0.5) * r * 1.7;
      const y = cy - r * 0.1 + (rand() - 0.5) * r * 1.2;
      ctx.beginPath();
      ctx.ellipse(x, y, U * 1.5, U * 0.35, (rand() - 0.5) * 1.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function paintFloor(ctx, g, rand) {
    const U = g.U;
    const y0 = g.floorY;
    const hFloor = g.H - y0;
    ctx.fillStyle = BRICK[0];
    ctx.fillRect(0, y0, g.W, hFloor);
    const vpx = g.cx;
    const vpy = y0 - g.H * 0.55;
    // rows: perspective spacing
    const rows = [];
    for (let k = 0; k < 40; k++) {
      const y = y0 + hFloor * Math.pow(k / 18, 1.7);
      if (y > g.H + 2) break;
      rows.push(y);
    }
    for (let r = 0; r < rows.length - 1; r++) {
      const ya = rows[r];
      const yb = rows[r + 1];
      const scale = (yb - vpy) / (y0 - vpy);
      const tw = U * 7 * scale;
      const off = (r % 2) * tw * 0.5;
      for (let x = -tw; x < g.W + tw; x += tw) {
        // each tile is a perspective cell, shade differs slightly
        const px0 = vpx + (x + off - vpx) * 1;
        ctx.fillStyle = BRICK[Math.floor(rand() * 3)];
        ctx.fillRect(px0, ya, tw, yb - ya);
      }
      ctx.fillStyle = BRICK_LINE;
      ctx.fillRect(0, yb, g.W, Math.max(1, (yb - ya) * 0.12));
      ctx.fillStyle = BRICK_LINE;
      for (let x = -tw; x < g.W + tw; x += tw) ctx.fillRect(x + off, ya, Math.max(1, scale * 0.8), yb - ya);
    }
    const sh = ctx.createLinearGradient(0, y0, 0, g.H);
    sh.addColorStop(0, 'rgba(20,18,32,0.15)');
    sh.addColorStop(1, 'rgba(10,8,18,0.3)');
    ctx.fillStyle = sh;
    ctx.fillRect(0, y0, g.W, hFloor);
  }

  function paintEave(ctx, g) {
    const U = g.U;
    ctx.fillStyle = BEAM.tile;
    ctx.fillRect(0, 0, g.W, U * 5);
    ctx.fillStyle = BEAM.tileHi;
    for (let x = 0; x < g.W; x += U * 1.5) ctx.fillRect(x, 0, Math.max(1, U * 0.3), U * 4);
    // round eave-end tiles
    ctx.fillStyle = '#6a6a62';
    for (let x = U * 0.9; x < g.W; x += U * 1.8) {
      ctx.beginPath();
      ctx.arc(x, U * 5, U * 0.75, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = BEAM.wood;
    ctx.fillRect(0, U * 5.6, g.W, U * 2.4);
    ctx.fillStyle = BEAM.edge;
    ctx.fillRect(0, U * 8, g.W, Math.max(1, U * 0.5));
    // painted band on the beam
    ctx.fillStyle = '#2f5a52';
    for (let x = U * 2; x < g.W; x += U * 6) ctx.fillRect(x, U * 6.3, U * 2.6, U * 1);
    ctx.fillStyle = GOLD.dark;
    for (let x = U * 5; x < g.W; x += U * 6) ctx.fillRect(x, U * 6.3, U * 1.2, U * 1);
    // pillars at the edges
    ctx.fillStyle = '#5a2a1f';
    ctx.fillRect(0, U * 8, U * 4.5, g.floorY - U * 8);
    ctx.fillRect(g.W - U * 4.5, U * 8, U * 4.5, g.floorY - U * 8);
    ctx.fillStyle = '#3a1a14';
    ctx.fillRect(U * 3.4, U * 8, U * 1.1, g.floorY - U * 8);
    ctx.fillRect(g.W - U * 4.5, U * 8, U * 1.1, g.floorY - U * 8);
  }

  // ---- sprites ----------------------------------------------------------------

  function lanternSprite(r, stringLen) {
    const rx = Math.max(2.5, r);
    const ry = rx * 0.82;
    const cap = Math.max(1, rx * 0.2);
    const tassel = rx * 1.1;
    const sw = Math.ceil(rx * 2 + 4);
    const sh = Math.ceil(stringLen + cap * 2 + ry * 2 + tassel + 4);
    const c = layer(sw, sh);
    const ctx = c.getContext('2d');
    const mx = sw / 2;
    ctx.strokeStyle = '#2a1a14';
    ctx.lineWidth = Math.max(1, rx * 0.08);
    ctx.beginPath();
    ctx.moveTo(mx, 0);
    ctx.lineTo(mx, stringLen + 1);
    ctx.stroke();
    const top = stringLen;
    ctx.fillStyle = GOLD.cap;
    ctx.fillRect(mx - rx * 0.32, top, rx * 0.64, cap);
    const cy = top + cap + ry;
    const gr = ctx.createRadialGradient(mx - rx * 0.1, cy - ry * 0.1, rx * 0.1, mx, cy, rx * 1.05);
    gr.addColorStop(0, RED.hot);
    gr.addColorStop(0.35, RED.lit);
    gr.addColorStop(0.75, RED.mid);
    gr.addColorStop(1, RED.dark);
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.ellipse(mx, cy, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,18,12,0.55)';
    ctx.lineWidth = Math.max(1, rx * 0.06);
    for (let k = 1; k < 4; k++) {
      ctx.beginPath();
      ctx.ellipse(mx, cy, rx * (k / 4), ry, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = GOLD.cap;
    ctx.fillRect(mx - rx * 0.32, cy + ry - cap * 0.2, rx * 0.64, cap);
    const ty = cy + ry + cap * 0.8;
    ctx.fillStyle = GOLD.dark;
    ctx.fillRect(mx - rx * 0.07, ty, Math.max(1, rx * 0.14), rx * 0.25);
    ctx.strokeStyle = RED.mid;
    ctx.lineWidth = Math.max(1, rx * 0.07);
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(mx + k * rx * 0.03, ty + rx * 0.25);
      ctx.lineTo(mx + k * rx * 0.13, ty + tassel);
      ctx.stroke();
    }
    return { c, w: sw, h: sh, bodyY: cy, ry, rx };
  }

  function haloSprite(rad) {
    const s = Math.ceil(rad * 2);
    const c = layer(s, s);
    const ctx = c.getContext('2d');
    const gr = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,190,110,0.7)');
    gr.addColorStop(0.35, 'rgba(235,130,70,0.32)');
    gr.addColorStop(1, 'rgba(200,90,50,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, s, s);
    return c;
  }

  function poolSprite(rw) {
    const w = Math.ceil(rw * 2);
    const h = Math.ceil(rw * 0.5);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.translate(w / 2, h / 2);
    ctx.scale(1, 0.25);
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
    gr.addColorStop(0, 'rgba(240,150,80,0.55)');
    gr.addColorStop(0.5, 'rgba(200,100,60,0.22)');
    gr.addColorStop(1, 'rgba(160,70,50,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(-w / 2, -w, w, w * 2);
    return c;
  }

  // ---- lanterns --------------------------------------------------------------

  function makeRows(g, rand) {
    const U = g.U;
    const spec = [
      { n: 5, r: U * 8.5, y: U * 8, len: U * 5, pool: true, alpha: 1, amp: 0.07 },
      { n: 7, r: U * 5.2, y: U * 8.2, len: U * 17, pool: true, alpha: 0.95, amp: 0.06, shift: 0.5 },
      { n: 10, r: U * 3.1, y: g.wallY + U * 0.8, len: U * 3.5, pool: false, alpha: 0.9, amp: 0.05, shift: 0.25 },
    ];
    return spec.map((s) => {
      const sprite = lanternSprite(s.r, s.len);
      const halo = haloSprite(s.r * 3.2);
      const pool = s.pool ? poolSprite(s.r * 2.6) : null;
      const items = [];
      const margin = U * 12;
      const span = g.W - margin * 2;
      for (let i = 0; i < s.n; i++) {
        const fx = s.n === 1 ? 0.5 : i / (s.n - 1);
        items.push({
          x: margin + span * fx + (s.shift ? (rand() - 0.5) * U * 3 : 0),
          p: rand() * TAU,
          w: 0.7 + rand() * 0.5,
        });
      }
      return { ...s, sprite, halo, pool, items };
    });
  }

  function drawRow(ctx, g, row, t, sway, glow, k) {
    const sp = row.sprite;
    const wind = 0.6 + 0.4 * Math.sin(t * 0.21 + k);
    const pivotY = row.y;
    for (let i = 0; i < row.items.length; i++) {
      const it = row.items[i];
      const a = Math.sin(t * it.w + it.p) * row.amp * sway * wind;
      const bodyX = it.x + Math.sin(a) * (sp.bodyY);
      const bodyY = pivotY + Math.cos(a) * sp.bodyY;
      if (row.pool && glow > 0) {
        ctx.globalAlpha = Math.min(1, glow) * 1.0;
        const pw = row.pool.width;
        const gy = g.floorY + (g.H - g.floorY) * (k === 0 ? 0.55 : 0.2);
        ctx.drawImage(row.pool, bodyX * 1.0 + a * g.U * 6 - pw / 2, gy);
      }
      if (glow > 0) {
        ctx.globalAlpha = Math.min(1, 0.55 + 0.35 * Math.sin(t * 0.9 + it.p)) * Math.min(1, glow) * row.alpha;
        const hs = row.halo.width;
        ctx.drawImage(row.halo, bodyX - hs / 2, bodyY - hs / 2);
      }
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < row.items.length; i++) {
      const it = row.items[i];
      const a = Math.sin(t * it.w + it.p) * row.amp * sway * wind;
      ctx.setTransform(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), it.x, pivotY);
      ctx.drawImage(sp.c, -sp.w / 2, 0);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- petals ----------------------------------------------------------------

  function makePetals(g, rand) {
    const P = { x: [], y: [], vx: [], vy: [], a: [], p: [], s: [], tone: [] };
    for (let i = 0; i < MAX_PETALS; i++) {
      P.x.push(rand() * g.W);
      P.y.push(rand() * g.H);
      P.vx.push(1 + rand() * 1.5);
      P.vy.push(3 + rand() * 3);
      P.a.push(rand() * TAU);
      P.p.push(rand() * TAU);
      P.s.push(g.U * (0.5 + rand() * 0.45));
      P.tone.push(rand() < 0.5 ? 0 : 1);
    }
    return P;
  }

  function drawPetals(ctx, g, t, dt) {
    const P = state.petals;
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < MAX_PETALS; i++) {
      P.x[i] += (P.vx[i] + Math.sin(t * 0.6 + P.p[i]) * 1.5) * step * g.U * 0.5;
      P.y[i] += P.vy[i] * step * g.U * 0.5;
      P.a[i] += step * 0.8;
      if (P.y[i] > g.H + 3 || P.x[i] > g.W + 3) {
        P.y[i] = -3;
        P.x[i] = state.rand() * g.W * 0.9 - g.W * 0.05;
      }
      const sq = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.4 + P.p[i]));
      const c = Math.cos(P.a[i]);
      const s = Math.sin(P.a[i]);
      ctx.fillStyle = PETAL[P.tone[i]];
      ctx.setTransform(c * sq, s * sq, -s, c, P.x[i], P.y[i]);
      ctx.fillRect(-P.s[i] / 2, -P.s[i] * 0.35, P.s[i], P.s[i] * 0.7);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run -------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    const back = layer(g.W, g.H);
    const b = back.getContext('2d');
    paintSky(b, g, rand);
    paintFarRoof(b, g);
    paintWall(b, g);
    paintMoonGate(b, g, rand);
    paintFloor(b, g, rand);
    paintEave(b, g);
    state.back = back;
    state.rows = makeRows(g, rand);
    state.petals = makePetals(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { sway, glow, petals } = api.props;
    ctx.drawImage(state.back, 0, 0);
    for (let k = state.rows.length - 1; k >= 0; k--) {
      drawRow(ctx, g, state.rows[k], t, sway, glow, k);
    }
    if (petals) drawPetals(ctx, g, t, dt);
  }

  Kasuri.run({
    defaults: { sway: 1, glow: 1, petals: true, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
