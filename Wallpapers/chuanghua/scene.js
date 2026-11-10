/*
 * 窗花 Chuanghua — a carved wooden lattice window with a sunlit garden beyond.
 *
 * The garden (sky, hills, pavilion, rock, plum) and the wall with its lattice are baked
 * once. Bamboo stems are small sprites that swing from their feet, a soft warm glow slides
 * across the garden, and a few blossom petals fall behind the bars.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;
  const TAU = Math.PI * 2;
  const SKY = ['#e8dfc6', '#e2dbc2', '#d6d8c2', '#c6d0bd'];
  const HILL = ['#8f9fa0', '#7b8e92', '#5f7480'];
  const WALL = ['#2b2a2c', '#34302d', '#3b3531'];
  const WOOD = { dark: '#3d1f17', mid: '#5c3022', lit: '#8a4b33', gold: '#b8923e' };
  const BAMBOO = ['#5c7348', '#6f8656', '#879a64'];
  const LEAF = ['#4a5c3a', '#62764a', '#7d8f5c'];
  const BLOSSOM = ['#f1e7d0', '#ecd1bd', '#e0a58f', '#d6452c'];
  const STEMS = 5;
  const PETALS = 16;
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
    const s = H / 100;
    const wh = H * 0.88;
    const ww = Math.min(W * 0.8, wh * 1.12);
    const x0 = Math.round((W - ww) / 2);
    const y0 = Math.round(H * 0.06);
    return { W, H, s, x0, y0, ww: Math.round(ww), wh: Math.round(wh), bar: Math.max(1.4, s * 1.25), frame: Math.max(3, s * 4.2) };
  }

  // ---- garden --------------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.H);
    const d = img.data;
    const inks = SKY.map(K.parseColor);
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / (g.H * 0.7)) * (inks.length - 1.01);
      const k = Math.floor(f);
      for (let x = 0; x < g.W; x++) {
        const ink = inks[k + (rand() < f - k ? 1 : 0)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0]; d[i + 1] = ink[1]; d[i + 2] = ink[2]; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function paintHills(ctx, g) {
    const base = g.y0 + g.wh * 0.6;
    for (let l = 0; l < 3; l++) {
      ctx.fillStyle = HILL[l];
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W; x += 2) {
        const n = fbm(x / (g.s * 38) + l * 7, l * 3.1, 3, 11 + l);
        ctx.lineTo(x, base - g.s * (6 + l * 3) - n * g.s * (22 - l * 5) + l * g.s * 5);
      }
      ctx.lineTo(g.W, g.H);
      ctx.fill();
    }
  }

  function paintPavilion(ctx, g) {
    const s = g.s;
    const cx = g.x0 + g.ww * 0.72;
    const gy = g.y0 + g.wh * 0.74;
    const w = s * 22;
    ctx.fillStyle = '#e6dcc2';
    ctx.fillRect(cx - w * 0.42, gy - s * 9, w * 0.84, s * 9);
    ctx.fillStyle = '#b0402c';
    for (let i = 0; i < 4; i++) ctx.fillRect(cx - w * 0.42 + (w * 0.84 * i) / 3 - s * 0.5, gy - s * 9, s * 1.1, s * 9);
    ctx.fillStyle = '#3a2a24';
    ctx.fillRect(cx - w * 0.42, gy - s * 9, w * 0.84, s * 1.1);
    ctx.fillStyle = '#44494f';
    poly(ctx, [cx - w * 0.7, gy - s * 10.5, cx - w * 0.5, gy - s * 9.4, cx + w * 0.5, gy - s * 9.4, cx + w * 0.7, gy - s * 10.5,
      cx + w * 0.46, gy - s * 15, cx - w * 0.46, gy - s * 15]);
    ctx.fillStyle = '#2f3338';
    poly(ctx, [cx - w * 0.46, gy - s * 15, cx + w * 0.46, gy - s * 15, cx + w * 0.3, gy - s * 19, cx - w * 0.3, gy - s * 19]);
    ctx.fillStyle = '#7c8186';
    for (let r = 0; r < 3; r++) ctx.fillRect(cx - w * 0.6 + r * w * 0.04, gy - s * (10.3 + r * 1.6), w * (1.2 - r * 0.08), Math.max(1, s * 0.25));
    ctx.fillStyle = '#e6dcc2';
    ctx.fillRect(cx - w * 0.6, gy, w * 1.2, s * 1.6);
  }

  function paintGround(ctx, g, rand) {
    const top = g.y0 + g.wh * 0.74;
    const inks = ['#7d8f5c', '#62764a', '#4a5c3a'].map(K.parseColor);
    const img = ctx.getImageData(0, Math.floor(top), g.W, Math.ceil(g.H - top));
    const d = img.data;
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < g.W; x++) {
        const n = fbm(x / (g.s * 12), y / (g.s * 5), 3, 21) + (rand() - 0.5) * 0.2 + y / img.height * 0.4;
        const k = Math.max(0, Math.min(2, Math.floor(n * 3)));
        const i = (y * g.W + x) * 4;
        d[i] = inks[k][0]; d[i + 1] = inks[k][1]; d[i + 2] = inks[k][2];
      }
    }
    ctx.putImageData(img, 0, Math.floor(top));
    ctx.fillStyle = '#cfc4a8';
    for (let i = 0; i < 6; i++) blob(ctx, g.x0 + g.ww * (0.38 + i * 0.07), top + g.s * (5 + i * 2.2), g.s * (3.5 + i * 0.6), g.s * (1 + i * 0.25));
  }

  function paintRock(ctx, g) {
    const s = g.s;
    const cx = g.x0 + g.ww * 0.42;
    const by = g.y0 + g.wh * 0.97;
    const pts = [-9, 0, -11, -9, -7, -17, -9, -27, -4, -37, 1, -30, 5, -41, 9, -29, 7, -19, 12, -11, 10, 0];
    ctx.fillStyle = '#7e8182';
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) ctx.lineTo(cx + pts[i] * s, by + pts[i + 1] * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9b9c96';
    poly(ctx, [cx - 4 * s, by - 36 * s, cx + 1 * s, by - 30 * s, cx + 5 * s, by - 40 * s, cx + 1 * s, by - 33 * s]);
    ctx.fillStyle = '#9b9c96';
    poly(ctx, [cx - 9 * s, by - 26 * s, cx - 6 * s, by - 17 * s, cx - 4 * s, by - 22 * s]);
    ctx.fillStyle = '#4a4d50';
    blob(ctx, cx - 1 * s, by - 22 * s, 2.2 * s, 3 * s, 0.3);
    blob(ctx, cx + 4 * s, by - 12 * s, 1.8 * s, 2.4 * s, -0.4);
    blob(ctx, cx - 5 * s, by - 8 * s, 1.5 * s, 2 * s, 0.2);
    ctx.fillStyle = '#62764a';
    blob(ctx, cx - 6 * s, by - 1 * s, 4 * s, 1.1 * s);
    blob(ctx, cx + 7 * s, by - 1 * s, 3 * s, 1 * s);
  }

  function paintPlum(ctx, g, rand) {
    const s = g.s;
    const x1 = g.x0 + g.ww;
    const y1 = g.y0 + g.wh * 0.12;
    ctx.strokeStyle = '#2f2a28';
    ctx.lineCap = 'round';
    ctx.lineWidth = s * 1.8;
    ctx.beginPath();
    ctx.moveTo(x1 + s * 4, y1 + s * 22);
    ctx.bezierCurveTo(x1 - s * 10, y1 + s * 12, x1 - s * 22, y1 + s * 20, x1 - s * 32, y1 + s * 6);
    ctx.stroke();
    ctx.lineWidth = s * 0.9;
    ctx.beginPath();
    ctx.moveTo(x1 - s * 14, y1 + s * 17);
    ctx.quadraticCurveTo(x1 - s * 16, y1 + s * 6, x1 - s * 12, y1 - s * 4);
    ctx.moveTo(x1 - s * 24, y1 + s * 15);
    ctx.quadraticCurveTo(x1 - s * 28, y1 + s * 24, x1 - s * 33, y1 + s * 26);
    ctx.stroke();
    for (let i = 0; i < 46; i++) {
      const t = rand();
      const bx = x1 - s * (4 + t * 32) + (rand() - 0.5) * s * 6;
      const by = y1 + s * (20 - t * 15) + (rand() - 0.5) * s * 14;
      const k = Math.floor(rand() * rand() * 4);
      ctx.fillStyle = BLOSSOM[k];
      blob(ctx, bx, by, s * (0.8 + rand() * 0.6), s * (0.8 + rand() * 0.5), rand() * 3);
    }
    ctx.fillStyle = '#d6452c';
    for (let i = 0; i < 9; i++) blob(ctx, x1 - s * (6 + rand() * 28), y1 + s * (4 + rand() * 18), s * 0.35, s * 0.35);
  }

  function paintGarden(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, rand);
    paintHills(ctx, g);
    paintPavilion(ctx, g);
    paintGround(ctx, g, rand);
    paintRock(ctx, g);
    paintPlum(ctx, g, rand);
    return c;
  }

  // ---- bamboo sprites --------------------------------------------------------

  function makeStem(g, rand, i) {
    const s = g.s;
    const h = Math.round(g.wh * (0.62 + rand() * 0.25));
    const w = Math.ceil(s * 22);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const x = w / 2;
    const th = s * (1.5 + rand() * 0.7);
    ctx.fillStyle = BAMBOO[1];
    ctx.fillRect(x - th / 2, 0, th, h);
    ctx.fillStyle = BAMBOO[2];
    ctx.fillRect(x - th / 2, 0, Math.max(1, th * 0.3), h);
    ctx.fillStyle = BAMBOO[0];
    ctx.fillRect(x + th * 0.2, 0, th * 0.3, h);
    const seg = s * (7 + rand() * 3);
    for (let y = h - seg * 0.6; y > h * 0.25; y -= seg) ctx.fillRect(x - th * 0.75, y, th * 1.5, Math.max(1, s * 0.4));
    for (let y = h * 0.7, n = 0; y > h * 0.05; y -= seg * 1.5, n++) {
      const dir = n % 2 ? 1 : -1;
      for (let l = 0; l < 4; l++) {
        ctx.fillStyle = LEAF[(l + n) % 3];
        const a = dir * (0.5 + l * 0.22) + (rand() - 0.5) * 0.2;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 2 + a);
        blob(ctx, s * 3.8, 0, s * 4.2, s * 0.85);
        ctx.restore();
      }
    }
    return { c, w, h, x: g.x0 + g.ww * (0.07 + i * 0.065) + (rand() - 0.5) * g.s * 3, base: g.y0 + g.wh * (0.84 + (i % 2) * 0.05), ph: rand() * TAU };
  }

  // ---- wall and lattice ---------------------------------------------------------

  function bar(ctx, g, pts) {
    ctx.lineCap = 'butt';
    ctx.strokeStyle = WOOD.dark;
    ctx.lineWidth = g.bar;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke();
    ctx.strokeStyle = WOOD.lit;
    ctx.lineWidth = Math.max(0.8, g.bar * 0.3);
    ctx.save();
    ctx.translate(-g.bar * 0.2, -g.bar * 0.2);
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke();
    ctx.restore();
  }

  function paintWall(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const d = img.data;
    const inks = WALL.map(K.parseColor);
    for (let y = 0; y < g.H; y++) {
      for (let x = 0; x < g.W; x++) {
        const n = fbm(x / (g.s * 10), y / (g.s * 10), 3, 31) * 1.6 + (rand() - 0.5) * 0.3;
        const k = inks[Math.max(0, Math.min(2, Math.floor(n * 2.2)))];
        const i = (y * g.W + x) * 4;
        d[i] = k[0]; d[i + 1] = k[1]; d[i + 2] = k[2]; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(g.x0, g.y0, g.ww, g.wh);
    ctx.globalCompositeOperation = 'source-over';
    paintLattice(ctx, g);
    return c;
  }

  function paintLattice(ctx, g) {
    const { x0, y0, ww, wh, frame, s } = g;
    const ix = x0 + frame;
    const iy = y0 + frame;
    const iw = ww - frame * 2;
    const ih = wh - frame * 2;
    const step = ih / 7;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, iw, ih);
    ctx.clip();
    const cx = x0 + ww / 2;
    const cy = y0 + wh / 2;
    for (let k = -14; k <= 14; k++) {
      const off = k * step;
      bar(ctx, g, [cx + off - ih, cy - ih, cx + off + ih, cy + ih]);
      bar(ctx, g, [cx + off + ih, cy - ih, cx + off - ih, cy + ih]);
    }
    const R = ih * 0.27;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    ctx.lineWidth = g.bar * 1.7;
    ctx.strokeStyle = WOOD.dark;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, g.bar * 0.5);
    ctx.strokeStyle = WOOD.gold;
    ctx.beginPath();
    ctx.arc(cx, cy, R - g.bar * 0.4, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = WOOD.dark;
    ctx.lineWidth = g.bar * 1.3;
    for (let q = 0; q < 4; q++) {
      const a = Math.PI / 4 + q * Math.PI / 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * R * 0.98, cy + Math.sin(a) * R * 0.98, R * 0.22, a + Math.PI * 0.5, a + Math.PI * 1.5);
      ctx.stroke();
    }
    paintFret(ctx, g, ix, iy, iw, ih);
    ctx.fillStyle = WOOD.mid;
    ctx.fillRect(x0, y0, ww, frame);
    ctx.fillRect(x0, y0 + wh - frame, ww, frame);
    ctx.fillRect(x0, y0, frame, wh);
    ctx.fillRect(x0 + ww - frame, y0, frame, wh);
    ctx.fillStyle = WOOD.lit;
    ctx.fillRect(x0, y0, ww, Math.max(1, s * 0.5));
    ctx.fillRect(x0, y0, Math.max(1, s * 0.5), wh);
    ctx.fillStyle = WOOD.dark;
    ctx.fillRect(x0, y0 + wh - Math.max(1, s * 0.5), ww, Math.max(1, s * 0.5));
    ctx.fillRect(x0 + ww - Math.max(1, s * 0.5), y0, Math.max(1, s * 0.5), wh);
    ctx.fillStyle = WOOD.gold;
    const gl = Math.max(1, s * 0.4);
    ctx.fillRect(ix - gl, iy - gl, iw + gl * 2, gl);
    ctx.fillRect(ix - gl, iy + ih, iw + gl * 2, gl);
    ctx.fillRect(ix - gl, iy, gl, ih);
    ctx.fillRect(ix + iw, iy, gl, ih);
    const sill = Math.round(s * 4);
    ctx.fillStyle = WOOD.mid;
    ctx.fillRect(x0 - s * 3, y0 + wh, ww + s * 6, sill);
    ctx.fillStyle = WOOD.lit;
    ctx.fillRect(x0 - s * 3, y0 + wh, ww + s * 6, Math.max(1, s * 0.6));
  }

  function paintFret(ctx, g, ix, iy, iw, ih) {
    const u = g.bar * 2.2;
    const n = Math.floor(iw / (u * 2));
    const m = Math.floor(ih / (u * 2));
    ctx.fillStyle = WOOD.dark;
    ctx.fillRect(ix, iy, iw, u * 1.9);
    ctx.fillRect(ix, iy + ih - u * 1.9, iw, u * 1.9);
    ctx.fillRect(ix, iy, u * 1.9, ih);
    ctx.fillRect(ix + iw - u * 1.9, iy, u * 1.9, ih);
    ctx.fillStyle = WOOD.lit;
    const t = Math.max(1, g.bar * 0.5);
    for (let i = 0; i < n; i++) {
      const x = ix + u * 1.9 + i * ((iw - u * 3.8) / n);
      const w = (iw - u * 3.8) / n;
      ctx.fillRect(x + w * 0.1, iy + u * 0.4, w * 0.8, t);
      ctx.fillRect(x + w * 0.1, iy + u * 0.4, t, u * 1.0);
      ctx.fillRect(x + w * 0.1, iy + ih - u * 0.4 - t, w * 0.8, t);
      ctx.fillRect(x + w * 0.9 - t, iy + ih - u * 1.4, t, u * 1.0);
    }
    for (let j = 0; j < m; j++) {
      const y = iy + u * 1.9 + j * ((ih - u * 3.8) / m);
      const h = (ih - u * 3.8) / m;
      ctx.fillRect(ix + u * 0.4, y + h * 0.1, t, h * 0.8);
      ctx.fillRect(ix + iw - u * 0.4 - t, y + h * 0.1, t, h * 0.8);
    }
  }

  // ---- light and petals ----------------------------------------------------------

  function makeGlow(g) {
    const r = Math.round(g.wh * 0.55);
    const c = layer(r * 2, r * 2);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(240,200,110,0.55)');
    grad.addColorStop(0.5, 'rgba(230,190,110,0.22)');
    grad.addColorStop(1, 'rgba(230,190,110,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, r * 2, r * 2);
    return { c, r };
  }

  function makePetals(g, rand) {
    const P = { x: new Float32Array(PETALS), y: new Float32Array(PETALS), v: new Float32Array(PETALS), p: new Float32Array(PETALS), k: new Uint8Array(PETALS) };
    for (let i = 0; i < PETALS; i++) {
      P.x[i] = g.x0 + g.ww * (0.45 + rand() * 0.55);
      P.y[i] = g.y0 + rand() * g.wh;
      P.v[i] = g.s * (1.6 + rand() * 1.4);
      P.p[i] = rand() * TAU;
      P.k[i] = Math.floor(rand() * 3);
    }
    return P;
  }

  function stepPetals(g, t, dt, count) {
    const P = state.petals;
    for (let i = 0; i < count; i++) {
      P.y[i] += P.v[i] * dt;
      P.x[i] += Math.sin(t * 0.7 + P.p[i]) * g.s * 0.8 * dt - g.s * 0.5 * dt;
      if (P.y[i] > g.y0 + g.wh * 0.95) {
        P.y[i] = g.y0 + g.wh * 0.05;
        P.x[i] = g.x0 + g.ww * (0.5 + 0.5 * ((P.p[i] * 7) % 1));
      }
    }
  }

  function drawPetals(ctx, g, t, count) {
    const P = state.petals;
    const sz = Math.max(1.4, g.s * 0.9);
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = BLOSSOM[P.k[i]];
      const sq = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + P.p[i]));
      ctx.fillRect(P.x[i], P.y[i], sz * sq + 0.6, sz);
    }
  }

  // ---- run -------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.garden = paintGarden(g, rand);
    state.stems = [];
    for (let i = 0; i < STEMS; i++) state.stems.push(makeStem(g, rand, i));
    state.wall = paintWall(g, rand);
    state.glow = makeGlow(g);
    state.petals = makePetals(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { light, sway, petals } = api.props;
    const count = Math.min(PETALS, Math.round(PETALS * 0.5 * petals));
    stepPetals(g, t, Math.min(dt, 0.1), count);
    ctx.drawImage(state.garden, 0, 0);
    for (let i = 0; i < STEMS; i++) {
      const b = state.stems[i];
      const a = Math.sin(t * 0.5 + b.ph) * 0.035 * sway + Math.sin(t * 0.23 + b.ph * 2) * 0.02 * sway;
      ctx.setTransform(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), b.x, b.base);
      ctx.drawImage(b.c, -b.w / 2, -b.h);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawPetals(ctx, g, t, count);
    const G = state.glow;
    const f = 0.5 + 0.5 * Math.sin(t * 0.06);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, 0.55 * light) * (0.75 + 0.25 * Math.sin(t * 0.11 + 1));
    ctx.drawImage(G.c, lerp(g.x0 - G.r * 0.4, g.x0 + g.ww - G.r * 1.6, f), g.y0 + g.wh * 0.1 - G.r * 0.3 + Math.sin(t * 0.04) * g.s * 5);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(state.wall, 0, 0);
  }

  Kasuri.run({
    defaults: { light: 1, sway: 1, petals: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
