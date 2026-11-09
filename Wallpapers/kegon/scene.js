/*
 * 華厳 Kegon — one tall waterfall dropping into an autumn gorge.
 *
 * Sky, ridges, rock wall, cliffs, trees and the pool are baked once. The fall is one tall
 * strip of streaks that slides down. Spray is a small ring of puffs, mist is one tiling
 * strip, ripples are a few rings and leaves are a short reused pool.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;

  const TAU = Math.PI * 2;
  const SKY = ['#9aa7b0', '#b7bdb6', '#d3cfb8', '#e4dcc0'];
  const ROCK = ['#2e3b46', '#3f4e58', '#566873', '#72848a'];
  const TREES = {
    pine: [['#2e4230', '#3e5638', '#5a7246'], ['#3a5236', '#4d6842', '#6d8656']],
    red: [['#8a3022', '#b4442b', '#d6683c'], ['#9a4030', '#c0553a', '#dc7a4a']],
    orange: [['#a55a28', '#cc8038', '#e4a650'], ['#b06a32', '#d6903f', '#eab45e']],
    gold: [['#9a7a30', '#c19c40', '#dcba5c'], ['#a88436', '#cfaa48', '#e6c670']],
  };
  const LEAF_TONES = ['#d4512f', '#e4843e', '#c4422b', '#e2ad50'];
  const POOL = ['#25414a', '#2f5058', '#3d6168'];
  const FOAM = ['#f0ecdc', '#dfe3d8', '#b5c6c6', '#8fa9ae'];
  const MAX_LEAVES = 36;
  const LEAVES = 18;
  const PUFFS = 16;
  const RINGS = 5;
  const state = { off: 0 };

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

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const u = U * Math.min(1, W / (U * 120));
    return {
      W, H, U, u,
      lip: Math.round(H * 0.17),
      wy: Math.round(H * 0.8),
      fx: W * 0.52,
      fw: Math.max(4, u * 9),
    };
  }

  // ---- sky, ridges and rock wall ------------------------------------------

  function ridge(g, x, k) {
    return g.H * (0.1 + k * 0.03) + fbm(x / (g.U * 38), k * 3.1, 4, 7 + k) * g.H * 0.08;
  }

  function paintSkyAndRidges(ctx, g, rand) {
    const img = ctx.createImageData(g.W, g.lip + 2);
    const inks = SKY.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < g.lip + 2; y++) {
      const f = Math.min(1, y / (g.H * 0.17)) * (inks.length - 1);
      const k = Math.min(inks.length - 2, Math.floor(f));
      for (let x = 0; x < g.W; x++) {
        const ink = inks[k + (rand() < f - k ? 1 : 0)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0]; d[i + 1] = ink[1]; d[i + 2] = ink[2]; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = '#e8dcbc';
    for (let i = 0; i < 4; i++) {
      const x = g.W * (0.08 + rand() * 0.84);
      const y = g.H * (0.025 + rand() * 0.05);
      blob(ctx, x, y, g.U * (7 + rand() * 9), g.U * (0.5 + rand() * 0.4));
    }
    const hills = ['#8798a0', '#6b7f84'];
    for (let k = 0; k < 2; k++) {
      ctx.fillStyle = hills[k];
      ctx.beginPath();
      ctx.moveTo(0, g.lip + 2);
      for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, ridge(g, x, k) + g.H * 0.02);
      ctx.lineTo(g.W, g.lip + 2);
      ctx.fill();
    }
  }

  function paintWall(ctx, g, rand) {
    const h = g.wy - g.lip;
    const img = ctx.createImageData(g.W, h);
    const inks = ROCK.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      const depth = y / h;
      for (let x = 0; x < g.W; x++) {
        const n = fbm(x / (g.U * 5), y / (g.U * 30), 3, 31) * 0.7 + fbm(x / (g.U * 14), y / (g.U * 12), 2, 57) * 0.5;
        const v = Math.max(0, Math.min(2.99, n * 3.2 - 0.4 - depth * 0.5 + (rand() - 0.5) * 0.5));
        const ink = inks[Math.floor(v)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0]; d[i + 1] = ink[1]; d[i + 2] = ink[2]; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, g.lip);
    ctx.fillStyle = '#5a6a6a';
    for (let i = 0; i < 40; i++) {
      const x = rand() * g.W;
      const y = g.lip + rand() * h * 0.9;
      ctx.fillRect(x, y, Math.max(1, g.U * 0.35), g.U * (2 + rand() * 5));
    }
  }

  // ---- trees ---------------------------------------------------------------

  function crown(ctx, x, y, r, inks, flat) {
    ctx.fillStyle = inks[0];
    blob(ctx, x, y, r, r * flat);
    ctx.fillStyle = inks[1];
    blob(ctx, x - r * 0.2, y - r * 0.18, r * 0.72, r * 0.72 * flat);
    ctx.fillStyle = inks[2];
    blob(ctx, x - r * 0.38, y - r * 0.34, r * 0.36, r * 0.36 * flat);
  }

  function pickKind(rand, bias) {
    const r = rand() + bias;
    if (r < 0.25) return 'pine';
    if (r < 0.62) return 'red';
    if (r < 0.85) return 'orange';
    return 'gold';
  }

  function grove(ctx, g, rand, x0, x1, ytop, ybot, size, bias, shade) {
    for (let y = ytop; y < ybot; y += size * 0.8) {
      for (let x = x0; x < x1; ) {
        const r = size * (0.75 + rand() * 0.5);
        const kind = pickKind(rand, bias);
        crown(ctx, x + (rand() - 0.5) * r, y + (rand() - 0.5) * r * 0.4, r, TREES[kind][shade], kind === 'pine' ? 0.6 : 0.85);
        x += r * (1.0 + rand() * 0.5);
      }
    }
  }

  function pine(ctx, x, y, h, lean) {
    ctx.strokeStyle = '#2a2420';
    ctx.lineWidth = Math.max(1, h * 0.05);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * 0.4, y - h * 0.5, x + lean, y - h * 0.9);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const f = 0.4 + i * 0.17;
      const side = i % 2 ? 1 : -1;
      const px = x + lean * f + side * h * 0.12;
      const py = y - h * f;
      const w = h * (0.28 - f * 0.1);
      ctx.fillStyle = '#233524';
      blob(ctx, px, py, w, w * 0.4);
      ctx.fillStyle = '#34502f';
      blob(ctx, px - w * 0.1, py - w * 0.12, w * 0.75, w * 0.26);
      ctx.fillStyle = '#58733e';
      blob(ctx, px - w * 0.3, py - w * 0.2, w * 0.4, w * 0.13);
    }
  }

  // ---- cliffs --------------------------------------------------------------

  function edgeL(g, y) {
    const f = (g.wy - y) / (g.wy - g.lip);
    return g.fx - g.fw * 0.5 - g.W * (0.14 - f * 0.02) + fbm(y / (g.U * 14), 2.2, 3, 19) * g.W * 0.07;
  }

  function edgeR(g, y) {
    const f = (g.wy - y) / (g.wy - g.lip);
    return g.fx + g.fw * 0.5 + g.W * (0.16 - f * 0.03) - fbm(y / (g.U * 14), 5.2, 3, 29) * g.W * 0.07;
  }

  function cliffBody(ctx, g, rand, side) {
    const top = g.lip - g.U * 5;
    ctx.fillStyle = '#2a3640';
    ctx.beginPath();
    const x0 = side < 0 ? 0 : g.W;
    ctx.moveTo(x0, top);
    for (let y = top; y <= g.wy; y += 2) ctx.lineTo(side < 0 ? edgeL(g, y) : edgeR(g, y), y);
    ctx.lineTo(x0, g.wy);
    ctx.fill();
    ctx.fillStyle = '#2e3b44';
    for (let i = 0; i < 70; i++) {
      const y = top + rand() * (g.wy - top);
      const e = side < 0 ? edgeL(g, y) : edgeR(g, y);
      const w = g.U * (1 + rand() * 4);
      const x = side < 0 ? e - rand() * g.W * 0.2 : e + rand() * g.W * 0.2;
      ctx.fillRect(x, y, w, Math.max(1, g.U * 0.5));
    }
    ctx.fillStyle = '#425058';
    for (let y = top; y < g.wy; y += g.U * (3 + rand() * 4)) {
      const e = side < 0 ? edgeL(g, y) : edgeR(g, y);
      ctx.fillRect(side < 0 ? e - g.U * 1.2 : e, y, g.U * 1.2, g.U * (1.5 + rand() * 2));
    }
  }

  function paintCliffs(ctx, g, rand) {
    cliffBody(ctx, g, rand, -1);
    cliffBody(ctx, g, rand, 1);
    const top = g.lip - g.U * 5;
    grove(ctx, g, rand, 0, edgeL(g, top + g.U * 8) + g.U * 2, top - g.U * 2, top + g.U * 14, g.U * 4.4, 0, 1);
    grove(ctx, g, rand, edgeR(g, top + g.U * 8) - g.U * 2, g.W + g.U * 3, top - g.U * 2, top + g.U * 14, g.U * 4.4, 0.05, 1);
    for (let y = g.H * 0.3; y < g.wy - g.U * 6; y += g.U * 5) {
      const el = edgeL(g, y);
      const er = edgeR(g, y);
      grove(ctx, g, rand, el - g.W * 0.13, el + g.U * 1.5, y, y + g.U * 2, g.U * 3.4, -0.1, 0);
      grove(ctx, g, rand, er - g.U * 1.5, er + g.W * 0.13, y, y + g.U * 2, g.U * 3.4, 0, 0);
    }
    pine(ctx, edgeL(g, g.H * 0.3) - g.U * 5, g.H * 0.31, g.U * 14, g.U * 3);
    pine(ctx, edgeR(g, g.H * 0.36) + g.U * 6, g.H * 0.37, g.U * 12, -g.U * 3);
  }

  // ---- pool and bank -------------------------------------------------------

  function paintPool(ctx, g, rand) {
    const h = g.H - g.wy;
    const img = ctx.createImageData(g.W, h);
    const inks = POOL.map(K.parseColor);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < g.W; x++) {
        const n = fbm(x / (g.U * 10), y / (g.U * 2), 2, 71);
        const near = Math.exp(-(((x - g.fx) / (g.fw * 1.8)) ** 2));
        const v = Math.max(0, Math.min(2.99, n * 2.4 + near * 1.4 - 0.5 + (rand() - 0.5) * 0.5));
        const ink = inks[Math.floor(v)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0]; d[i + 1] = ink[1]; d[i + 2] = ink[2]; d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, g.wy);
  }

  function rock(ctx, x, y, rx, ry) {
    ctx.fillStyle = '#1c242a';
    blob(ctx, x, y, rx, ry);
    ctx.fillStyle = '#34414a';
    blob(ctx, x - rx * 0.15, y - ry * 0.25, rx * 0.8, ry * 0.6);
    ctx.fillStyle = '#566670';
    blob(ctx, x - rx * 0.35, y - ry * 0.45, rx * 0.35, ry * 0.25);
  }

  function torii(ctx, x, y, s) {
    const lw = Math.max(1, s * 0.16);
    ctx.fillStyle = '#b5402a';
    ctx.fillRect(x - s * 0.75, y - s * 1.9, lw, s * 1.9);
    ctx.fillRect(x + s * 0.75 - lw, y - s * 1.9, lw, s * 1.9);
    ctx.fillRect(x - s * 0.95, y - s * 1.55, s * 1.9, lw * 0.9);
    ctx.fillStyle = '#8a2f22';
    ctx.fillRect(x - s * 1.15, y - s * 2.05, s * 2.3, lw * 1.1);
    ctx.fillRect(x - s * 0.95, y - s * 1.75, s * 1.9, lw * 0.7);
  }

  function lantern(ctx, x, y, s) {
    ctx.fillStyle = '#7d7f78';
    ctx.fillRect(x - s * 0.15, y - s * 1.0, s * 0.3, s * 1.0);
    ctx.fillRect(x - s * 0.4, y - s * 0.2, s * 0.8, s * 0.2);
    ctx.fillRect(x - s * 0.35, y - s * 1.45, s * 0.7, s * 0.45);
    ctx.fillStyle = '#e0c06a';
    ctx.fillRect(x - s * 0.15, y - s * 1.35, s * 0.3, s * 0.25);
    ctx.fillStyle = '#5c5e58';
    ctx.fillRect(x - s * 0.6, y - s * 1.65, s * 1.2, s * 0.22);
    ctx.fillRect(x - s * 0.25, y - s * 1.85, s * 0.5, s * 0.2);
  }

  function paintBank(ctx, g, rand) {
    const u = g.U;
    ctx.fillStyle = '#1a2227';
    ctx.beginPath();
    ctx.moveTo(0, g.wy - u * 3);
    for (let x = 0; x <= g.W * 0.26; x += 2) ctx.lineTo(x, g.wy - u * 2 + (x / (g.W * 0.26)) * u * 5 + fbm(x / (u * 6), 1.1, 2, 5) * u * 3);
    ctx.lineTo(g.W * 0.26, g.H);
    ctx.lineTo(0, g.H);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(g.W, g.wy - u * 4);
    for (let x = g.W; x >= g.W * 0.7; x -= 2) ctx.lineTo(x, g.wy - u * 3 + ((g.W - x) / (g.W * 0.3)) * u * 5 + fbm(x / (u * 6), 3.1, 2, 9) * u * 3);
    ctx.lineTo(g.W * 0.7, g.H);
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    for (let i = 0; i < 9; i++) {
      const left = i < 4;
      const x = left ? rand() * g.W * 0.3 : g.W * (0.68 + rand() * 0.32);
      rock(ctx, x, g.wy + u * (1 + rand() * 12), u * (3 + rand() * 4), u * (1.5 + rand() * 1.8));
    }
    const tx = g.W * 0.83;
    const ty = g.wy + u * 3;
    rock(ctx, tx, ty + u * 0.6, u * 7, u * 2.4);
    torii(ctx, tx, ty, u * 3.4);
    lantern(ctx, tx - u * 9, ty + u * 0.5, u * 3.2);
    pine(ctx, g.W * 0.07, g.wy + u * 6, u * 22, u * 3);
    ctx.fillStyle = '#243126';
    for (let x = 0; x < g.W; x += u * (1.5 + rand() * 2)) {
      if (x > g.W * 0.3 && x < g.W * 0.68) continue;
      blob(ctx, x, g.H - u * 0.5, u * (1 + rand() * 1.4), u * 0.7);
    }
  }

  function paintBranch(ctx, g, rand) {
    ctx.strokeStyle = '#2a2018';
    ctx.lineWidth = Math.max(1, g.U * 0.8);
    ctx.beginPath();
    ctx.moveTo(g.W * 0.99, -2);
    ctx.quadraticCurveTo(g.W * 0.88, g.H * 0.05, g.W * 0.72, g.H * 0.1);
    ctx.stroke();
    for (let i = 0; i < 14; i++) {
      const f = rand();
      const x = lerp(g.W * 0.74, g.W * 0.98, f);
      const y = lerp(g.H * 0.1, 0, f) + (rand() - 0.2) * g.U * 4;
      const kind = rand() < 0.3 ? TREES.orange[1] : TREES.red[1];
      crown(ctx, x, y, g.U * (2.2 + rand() * 1.8), kind, 0.8);
    }
  }

  function paintStatic(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSkyAndRidges(ctx, g, rand);
    paintWall(ctx, g, rand);
    paintCliffs(ctx, g, rand);
    paintPool(ctx, g, rand);
    paintBank(ctx, g, rand);
    paintBranch(ctx, g, rand);
    return c;
  }

  // ---- the fall ------------------------------------------------------------

  function makeFall(g, rand) {
    const w = Math.ceil(g.fw);
    const per = Math.max(24, Math.round(g.U * 26));
    const c = layer(w, per);
    const ctx = c.getContext('2d');
    ctx.fillStyle = FOAM[2];
    ctx.fillRect(0, 0, w, per);
    for (let i = 0; i < w * 2; i++) {
      const x = rand() * w;
      const len = per * (0.15 + rand() * 0.5);
      const y = rand() * per;
      ctx.fillStyle = FOAM[Math.floor(rand() * 4)];
      const sw = Math.max(1, Math.round(0.5 + rand() * 1.6));
      ctx.fillRect(x, y, sw, len);
      if (y + len > per) ctx.fillRect(x, y - per, sw, len);
    }
    state.fallPer = per;
    return c;
  }

  function drawFall(ctx, g, flow) {
    const per = state.fallPer;
    const x = Math.round(g.fx - g.fw / 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, g.lip, state.fall.width, g.wy - g.lip);
    ctx.clip();
    const o = state.off % per;
    for (let y = g.lip - per + o; y < g.wy; y += per) ctx.drawImage(state.fall, x, Math.round(y));
    ctx.restore();
    ctx.globalAlpha = 0.25 + 0.1 * flow;
    ctx.fillStyle = '#16202a';
    ctx.fillRect(x, g.lip, 1, g.wy - g.lip);
    ctx.fillRect(x + state.fall.width - 1, g.lip, 1, g.wy - g.lip);
    ctx.globalAlpha = 1;
    ctx.fillStyle = FOAM[0];
    ctx.fillRect(x - 1, g.lip - 1, state.fall.width + 2, Math.max(1, g.U * 0.8));
  }

  // ---- spray, mist, ripples ------------------------------------------------

  function makeMist(g, rand) {
    const w = Math.ceil(g.W);
    const h = Math.ceil(g.U * 10);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e4e2d2';
    for (let i = 0; i < 9; i++) {
      const x = (i / 9) * w + rand() * g.U * 4;
      const y = h * (0.35 + rand() * 0.3);
      for (const dx of [-w, 0, w]) blob(ctx, x + dx, y, g.U * (9 + rand() * 12), g.U * (1.2 + rand() * 1.8));
    }
    return c;
  }

  function drawMist(ctx, g, t) {
    const m = state.mist;
    const b = (t * g.U * 0.9) % m.width;
    ctx.globalAlpha = 0.22;
    ctx.drawImage(m, b - m.width, g.H * 0.58);
    ctx.drawImage(m, b, g.H * 0.58);
    ctx.globalAlpha = 0.14;
    ctx.drawImage(m, -b * 0.6, g.H * 0.3);
    ctx.drawImage(m, m.width - b * 0.6, g.H * 0.3);
    ctx.globalAlpha = 1;
  }

  function makePuffs(g, rand) {
    const f = () => new Float32Array(PUFFS);
    const P = { ph: f(), dx: f(), sz: f(), rate: f() };
    for (let i = 0; i < PUFFS; i++) {
      P.ph[i] = rand();
      P.dx[i] = (rand() - 0.5) * 2;
      P.sz[i] = 0.7 + rand() * 0.7;
      P.rate[i] = 0.12 + rand() * 0.1;
    }
    return P;
  }

  function drawSpray(ctx, g, t, amount) {
    const P = state.puffs;
    const n = Math.min(PUFFS, Math.round(PUFFS * Math.min(1, amount * 0.7 + 0.2)));
    ctx.fillStyle = '#eeebdc';
    for (let i = 0; i < n; i++) {
      const p = (P.ph[i] + t * P.rate[i]) % 1;
      const r = g.U * (2 + p * 5) * P.sz[i];
      ctx.globalAlpha = (1 - p) * (0.5 + 0.2 * Math.min(1.5, amount));
      blob(ctx, g.fx + P.dx[i] * g.fw * (0.7 + p * 1.5), g.wy - p * g.U * 11, r, r * 0.6);
    }
    ctx.globalAlpha = 1;
  }

  function drawRipples(ctx, g, t, flow) {
    ctx.strokeStyle = '#cfdad4';
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    for (let i = 0; i < RINGS; i++) {
      const p = (t * 0.1 * (0.5 + flow * 0.5) + i / RINGS) % 1;
      const rx = g.fw * 0.6 + p * g.W * 0.3;
      ctx.globalAlpha = (1 - p) * 0.45;
      ctx.beginPath();
      ctx.ellipse(g.fx, g.wy + g.U * 2 + p * g.U * 4, rx, rx * 0.11, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- leaves --------------------------------------------------------------

  function makeLeaves() {
    const f = () => new Float32Array(MAX_LEAVES);
    return { x: f(), y: f(), vx: f(), vy: f(), a: f(), spin: f(), p: f(), size: f(), tone: f(), land: f(), mode: f(), timer: f() };
  }

  function resetLeaf(g, L, i, scatter) {
    const r = state.rand;
    const fromBranch = r() < 0.6;
    L.x[i] = fromBranch ? g.W * (0.7 + r() * 0.3) : r() * g.W;
    L.y[i] = fromBranch ? g.H * r() * 0.1 : -g.U * 3;
    L.vy[i] = g.U * (3 + r() * 2);
    L.vx[i] = -g.U * (0.5 + r() * 1.2);
    L.size[i] = g.U * (1.4 + r() * 0.9);
    L.tone[i] = Math.floor(r() * LEAF_TONES.length);
    L.spin[i] = (r() - 0.5) * 3;
    L.a[i] = r() * TAU;
    L.p[i] = r() * TAU;
    L.land[i] = g.wy + g.U * (2 + r() * (g.H - g.wy) / g.U * 0.7);
    L.mode[i] = 0;
    L.timer[i] = 0;
    if (scatter) {
      L.y[i] = lerp(L.y[i], L.land[i], r());
      if (r() < 0.3) {
        L.mode[i] = 1;
        L.y[i] = L.land[i];
        L.timer[i] = r() * 14;
      }
    }
  }

  function stepLeaf(g, L, i, t, dt) {
    if (L.mode[i] === 0) {
      L.y[i] += L.vy[i] * dt;
      L.x[i] += (L.vx[i] + Math.sin(t * 1.1 + L.p[i]) * g.U * 2.2) * dt;
      L.a[i] += L.spin[i] * dt;
      if (L.y[i] >= L.land[i]) { L.mode[i] = 1; L.y[i] = L.land[i]; L.timer[i] = 0; }
    } else {
      L.timer[i] += dt;
      L.x[i] += g.U * 0.3 * dt;
      L.a[i] += L.spin[i] * 0.05 * dt;
      if (L.timer[i] > 16) resetLeaf(g, L, i, false);
    }
  }

  function drawLeaves(ctx, g, t, count) {
    const L = state.leaves;
    for (let i = 0; i < count; i++) {
      const c = Math.cos(L.a[i]);
      const s = Math.sin(L.a[i]);
      const sz = L.size[i];
      let sq;
      if (L.mode[i] === 0) {
        sq = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.8 + L.p[i]));
        ctx.globalAlpha = 1;
      } else {
        sq = 0.4;
        ctx.globalAlpha = Math.min(1, (16 - L.timer[i]) / 3);
      }
      ctx.fillStyle = LEAF_TONES[L.tone[i]];
      ctx.setTransform(c * sq, s * sq, -s, c, L.x[i], L.y[i]);
      ctx.fillRect(-sz / 2, -sz * 0.35, sz, sz * 0.7);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintStatic(g, rand);
    state.fall = makeFall(g, rand);
    state.mist = makeMist(g, rand);
    state.puffs = makePuffs(g, rand);
    state.leaves = makeLeaves();
    for (let i = 0; i < MAX_LEAVES; i++) resetLeaf(g, state.leaves, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { flow, spray, leaves } = api.props;
    const step = Math.min(dt, 0.1);
    const count = Math.min(MAX_LEAVES, Math.round(LEAVES * leaves));
    state.off += step * g.U * 38 * (0.3 + flow * 0.7);
    for (let i = 0; i < count; i++) stepLeaf(g, state.leaves, i, t, step);
    ctx.drawImage(state.back, 0, 0);
    drawRipples(ctx, g, t, flow);
    drawFall(ctx, g, flow);
    drawMist(ctx, g, t);
    drawSpray(ctx, g, t, spray);
    drawLeaves(ctx, g, t, count);
  }

  Kasuri.run({
    defaults: { flow: 1, spray: 1, leaves: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
