/*
 * 鮎 Ayu — sweetfish in a clear gravel stream, seen from above.
 *
 * The gravel bed, the net of sunlight, the dappled shade, the stepping stones and
 * the banks are baked once. Light and shade slide over the bed in two tiles, a few
 * fish hold against the current and now and then dart, and leaves ride the surface.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;

  const TAU = Math.PI * 2;
  const GRAVEL = ['#8b8573', '#a49c85', '#b9ae90', '#c9bf9f', '#9a947f'];
  const DEEP = '#2f4f55';
  const MOSS = ['#2f4430', '#3f5636', '#566b3f', '#6f8650'];
  const LEAF_TONES = ['#b4432a', '#d6683c', '#c9a24a'];
  const MAX_FISH = 12;
  const FISH = 7;
  const MAX_LEAVES = 36;
  const LEAVES = 16;
  const STREAKS = 60;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.3), Math.max(ry, 0.3), 0, 0, TAU);
    ctx.fill();
  }

  function ell(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
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
    return { W, H, U, lo: H * 0.2, hi: H * 0.8 };
  }

  function bankTop(g, x) {
    return g.H * 0.11 + fbm(x / (g.U * 22), 3.3, 3, 5) * g.H * 0.07;
  }

  function bankBot(g, x) {
    return g.H * 0.92 - fbm(x / (g.U * 22), 8.1, 3, 9) * g.H * 0.07;
  }

  // ---- the bed -------------------------------------------------------------

  function paintBed(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const d = img.data;
    const lo = K.parseColor('#8c8b7a');
    const hi = K.parseColor('#ada78e');
    for (let y = 0; y < g.H; y++) {
      for (let x = 0; x < g.W; x++) {
        const n = fbm(x / (g.U * 16), y / (g.U * 16), 3, 7) * 0.8 + rand() * 0.2;
        const i = (y * g.W + x) * 4;
        d[i] = lerp(lo[0], hi[0], n);
        d[i + 1] = lerp(lo[1], hi[1], n);
        d[i + 2] = lerp(lo[2], hi[2], n);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const count = Math.floor((g.W * g.H) / (g.U * g.U * 14));
    for (let i = 0; i < count; i++) {
      const x = rand() * g.W;
      const y = rand() * g.H;
      const r = g.U * (0.6 + rand() * 1.1);
      ctx.fillStyle = 'rgba(40,58,60,0.14)';
      blob(ctx, x + r * 0.3, y + r * 0.35, r, r * 0.8);
      ctx.fillStyle = rand() < 0.5 ? 'rgba(178,170,140,0.35)' : 'rgba(120,118,100,0.3)';
      blob(ctx, x, y, r, r * 0.8);
    }
    const grad = ctx.createLinearGradient(0, 0, 0, g.H);
    grad.addColorStop(0, 'rgba(46,92,98,0.3)');
    grad.addColorStop(0.5, 'rgba(40,86,96,0.46)');
    grad.addColorStop(1, 'rgba(46,92,98,0.3)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  // A net of bright lines that tiles in both directions.
  function paintNet(g, seed) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const d = img.data;
    const a = Math.max(2, Math.round(g.W / (g.U * 11)));
    const b = Math.max(2, Math.round(g.H / (g.U * 11)));
    const ph = seed * 1.7;
    for (let y = 0; y < g.H; y++) {
      const fy = (y / g.H) * TAU;
      for (let x = 0; x < g.W; x++) {
        const fx = (x / g.W) * TAU;
        const w1 = Math.sin(fx * a + 1.2 * Math.sin(fy * b + ph));
        const w2 = Math.sin(fy * b + fx * 1 + 1.1 * Math.sin(fx * a * 0.5 - ph));
        const w3 = Math.sin(fx * (a - 1) - fy * (b - 1) + 0.9 * Math.sin(fy * 2));
        const v = (w1 + w2 + w3) / 3;
        const line = Math.max(0, 1 - Math.abs(v - 0.1) * 5);
        const level = Math.round(line * line * 3) / 3;
        const i = (y * g.W + x) * 4;
        d[i] = 244;
        d[i + 1] = 230;
        d[i + 2] = 176;
        d[i + 3] = level * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Dappled shade from maple leaves overhead, tiling sideways.
  function paintShade(g, rand) {
    const w = Math.ceil(g.W * 1.2);
    const c = layer(w, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(22,38,44,0.5)';
    for (let i = 0; i < 46; i++) {
      const x = rand() * w;
      const y = rand() * g.H;
      const r = g.U * (2 + rand() * 4);
      const rot = rand() * TAU;
      for (let k = 0; k < 5; k++) {
        const a = rot + (k / 5) * TAU;
        blob(ctx, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.3);
      }
      blob(ctx, x, y, r * 0.5, r * 0.5);
      if (x < r * 3) {
        blob(ctx, x + w, y, r * 0.9, r * 0.9);
      }
    }
    return c;
  }

  // ---- banks and stepping stones -------------------------------------------

  function mossEdge(ctx, g, rand, edge, dir) {
    ctx.fillStyle = MOSS[0];
    ctx.beginPath();
    ctx.moveTo(0, dir > 0 ? 0 : g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, edge(g, x));
    ctx.lineTo(g.W, dir > 0 ? 0 : g.H);
    ctx.fill();
    for (let x = -g.U; x < g.W + g.U; x += g.U * (1.4 + rand() * 1.6)) {
      const r = g.U * (1.4 + rand() * 1.8);
      const y = edge(g, x) - dir * r * 0.15;
      ctx.fillStyle = 'rgba(20,36,40,0.28)';
      blob(ctx, x + r * 0.2, y + dir * r * 0.9, r * 1.1, r * 0.5);
      ctx.fillStyle = MOSS[1 + Math.floor(rand() * 2)];
      blob(ctx, x, y, r, r * 0.65);
      ctx.fillStyle = MOSS[3];
      blob(ctx, x - r * 0.3, y - r * 0.2, r * 0.4, r * 0.2);
    }
    for (let x = 0; x < g.W; x += g.U * (4 + rand() * 6)) {
      const r = g.U * (1 + rand() * 1.4);
      const y = edge(g, x) + dir * r * 0.1;
      ctx.fillStyle = 'rgba(20,36,40,0.35)';
      blob(ctx, x + r * 0.3, y + dir * r * 0.4, r * 1.1, r * 0.8);
      ctx.fillStyle = rand() < 0.5 ? '#6d695d' : '#8a8474';
      blob(ctx, x, y, r, r * 0.8);
      ctx.fillStyle = 'rgba(224,214,180,0.35)';
      blob(ctx, x - r * 0.3, y - r * 0.3, r * 0.4, r * 0.28);
    }
  }

  function bambooLeaf(ctx, x, y, len, ang, ink) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = ink;
    poly(ctx, [-len / 2, 0, -len * 0.1, -len * 0.14, len / 2, 0, -len * 0.1, len * 0.14]);
    ctx.restore();
  }

  function stone(ctx, g, rand, x, y, rx, ry) {
    const u = g.U;
    // wake downstream (current runs to the right)
    ctx.fillStyle = 'rgba(232,226,204,0.4)';
    for (let i = 0; i < 3; i++) {
      const off = (i - 1) * ry * 0.7;
      poly(ctx, [x + rx * 0.7, y + off - u * 0.4, x + rx * 1.9 + u * rand() * 4, y + off * 1.3, x + rx * 0.7, y + off + u * 0.4]);
    }
    ctx.fillStyle = 'rgba(14,26,30,0.5)';
    blob(ctx, x + u * 1.6, y + u * 2.2, rx * 1.02, ry);
    const pts = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      const k = 0.88 + rand() * 0.16;
      pts.push(x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k);
    }
    ctx.fillStyle = '#3b3a35';
    poly(ctx, pts);
    ctx.fillStyle = '#5c584c';
    blob(ctx, x - rx * 0.06, y - ry * 0.1, rx * 0.84, ry * 0.8);
    ctx.fillStyle = '#7b7562';
    blob(ctx, x - rx * 0.22, y - ry * 0.26, rx * 0.5, ry * 0.42);
    // moss cap on the upper side
    ctx.fillStyle = MOSS[1];
    blob(ctx, x - rx * 0.1, y - ry * 0.3, rx * 0.62, ry * 0.42);
    ctx.fillStyle = MOSS[2];
    blob(ctx, x - rx * 0.2, y - ry * 0.38, rx * 0.4, ry * 0.26);
    ctx.fillStyle = MOSS[3];
    blob(ctx, x - rx * 0.3, y - ry * 0.45, rx * 0.18, ry * 0.12);
  }

  function paintMaple(ctx, g, rand) {
    const cx = g.W * 0.92;
    const cy = g.H * 0.03;
    ctx.strokeStyle = '#2a201b';
    ctx.lineCap = 'round';
    ctx.lineWidth = g.U * 1.3;
    ctx.beginPath();
    ctx.moveTo(g.W + g.U * 2, g.H * 0.0);
    ctx.quadraticCurveTo(g.W * 0.97, g.H * 0.05, g.W * 0.84, g.H * 0.075);
    ctx.stroke();
    for (let i = 0; i < 20; i++) {
      const a = rand() * TAU;
      const dd = Math.sqrt(rand()) * g.U * 11;
      const x = cx + Math.cos(a) * dd - g.U * 3;
      const y = cy + Math.sin(a) * dd * 0.45 + g.U * 3;
      const r = g.U * (1.4 + rand() * 1.2);
      ctx.fillStyle = '#7a2a1d';
      blob(ctx, x + r * 0.2, y + r * 0.25, r, r * 0.85);
      ctx.fillStyle = LEAF_TONES[rand() < 0.65 ? 0 : 1];
      blob(ctx, x, y, r * 0.85, r * 0.7);
      ctx.fillStyle = rand() < 0.5 ? '#e8a24e' : LEAF_TONES[1];
      blob(ctx, x - r * 0.25, y - r * 0.2, r * 0.4, r * 0.3);
    }
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const spots = [[0.66, 0.78], [0.715, 0.6], [0.77, 0.42], [0.825, 0.25]];
    for (let i = 0; i < spots.length; i++) {
      const [fx, fy] = spots[i];
      stone(ctx, g, rand, g.W * fx, g.H * fy, g.U * (7.5 + rand() * 1.5), g.U * (6 + rand() * 1));
    }
    mossEdge(ctx, g, rand, bankTop, 1);
    mossEdge(ctx, g, rand, bankBot, -1);
    for (let i = 0; i < 40; i++) {
      const top = rand() < 0.5;
      const x = rand() * g.W;
      const y = top ? bankTop(g, x) - g.U * (0.5 + rand() * 6) : bankBot(g, x) + g.U * (0.5 + rand() * 6);
      bambooLeaf(ctx, x, y, g.U * (3 + rand() * 2.5), rand() * Math.PI, rand() < 0.5 ? '#6f8650' : '#566b3f');
    }
    for (let i = 0; i < 7; i++) {
      const top = rand() < 0.5;
      const x = rand() * g.W;
      const y = top ? bankTop(g, x) - g.U * (1 + rand() * 4) : bankBot(g, x) + g.U * (1 + rand() * 4);
      ctx.fillStyle = LEAF_TONES[Math.floor(rand() * 3)];
      blob(ctx, x, y, g.U * 1.3, g.U * 1);
    }
    paintMaple(ctx, g, rand);
    return c;
  }

  // ---- leaf sprites --------------------------------------------------------

  function mapleSprite(size, ink, shadow) {
    const c = layer(size * 2, size * 2);
    const ctx = c.getContext('2d');
    const m = size;
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU - Math.PI / 2;
      const r = size * (i % 2 ? 0.45 : 1);
      pts.push(m + Math.cos(a) * r, m + Math.sin(a) * r);
    }
    ctx.fillStyle = shadow ? '#142830' : ink;
    poly(ctx, pts);
    if (!shadow) {
      ctx.fillStyle = 'rgba(240,200,120,0.35)';
      blob(ctx, m - size * 0.15, m - size * 0.2, size * 0.3, size * 0.25);
      ctx.strokeStyle = '#7a2a1d';
      ctx.lineWidth = Math.max(1, size * 0.14);
      ctx.beginPath();
      ctx.moveTo(m, m);
      ctx.lineTo(m + size * 0.2, m + size * 0.95);
      ctx.stroke();
    }
    return c;
  }

  function bambooSprite(size, shadow) {
    const c = layer(size * 2, size * 2);
    const ctx = c.getContext('2d');
    ctx.fillStyle = shadow ? '#142830' : '#6f8650';
    poly(ctx, [size * 0.1, size, size * 0.9, size * 0.7, size * 1.9, size, size * 0.9, size * 1.3]);
    return c;
  }

  function makeSprites(g) {
    const s = Math.max(3, Math.round(g.U * 3.6));
    const sp = { maple: [], mapleShadow: mapleSprite(s, '', true), bamboo: bambooSprite(s * 1.2, false), bambooShadow: bambooSprite(s * 1.2, true) };
    for (const ink of LEAF_TONES) sp.maple.push(mapleSprite(s, ink, false));
    return sp;
  }

  // ---- fish ----------------------------------------------------------------

  const SEG = 9;
  const XMIN = 0.06;
  const XMAX = 0.54;

  function makeFish(g, rand) {
    const f = () => new Float32Array(MAX_FISH);
    const F = { x: f(), y: f(), sx: f(), sy: f(), tx: f(), ty: f(), ang: f(), ph: f(), mode: f(), timer: f(), dur: f(), size: f() };
    for (let i = 0; i < MAX_FISH; i++) {
      const lane = (i * 0.618) % 1;
      F.x[i] = g.W * lerp(XMIN + 0.04, XMAX - 0.04, rand());
      F.y[i] = lerp(g.lo + g.U * 4, g.hi - g.U * 4, lane);
      F.ang[i] = Math.PI + (rand() - 0.5) * 0.3;
      F.ph[i] = rand() * TAU;
      F.timer[i] = 0.5 + rand() * 4;
      F.size[i] = g.U * (21 + rand() * 5);
    }
    return F;
  }

  function wrapAngle(a) {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  }

  function startDart(g, F, i) {
    const r = state.rand;
    F.sx[i] = F.x[i];
    F.sy[i] = F.y[i];
    const back = F.x[i] > g.W * (XMAX - 0.06);
    const dx = back ? -g.W * (0.12 + r() * 0.12) : (r() - 0.6) * g.W * 0.22;
    F.tx[i] = Math.min(g.W * XMAX, Math.max(g.W * XMIN, F.x[i] + dx));
    F.ty[i] = Math.min(g.hi - g.U * 3, Math.max(g.lo + g.U * 3, F.y[i] + (r() - 0.5) * g.H * 0.22));
    F.mode[i] = 1;
    F.dur[i] = 0.45 + r() * 0.35;
    F.timer[i] = 0;
  }

  function stepFish(g, F, i, dt) {
    let want = Math.PI + Math.sin(F.ph[i] * 0.05) * 0.12;
    if (F.mode[i] === 0) {
      F.x[i] += g.U * 0.6 * dt;
      F.y[i] += Math.sin(F.ph[i] * 0.07) * g.U * 0.3 * dt;
      F.ph[i] += dt * 6;
      F.timer[i] -= dt;
      if (F.timer[i] <= 0 || F.x[i] > g.W * XMAX) startDart(g, F, i);
    } else {
      F.timer[i] += dt;
      const p = Math.min(1, F.timer[i] / F.dur[i]);
      const e = 1 - (1 - p) * (1 - p) * (1 - p);
      F.x[i] = lerp(F.sx[i], F.tx[i], e);
      F.y[i] = lerp(F.sy[i], F.ty[i], e);
      F.ph[i] += dt * 18;
      if (p < 0.7) want = Math.atan2(F.ty[i] - F.sy[i], F.tx[i] - F.sx[i]);
      if (p >= 1) {
        F.mode[i] = 0;
        F.timer[i] = 2 + state.rand() * 5;
      }
    }
    F.ang[i] += wrapAngle(want - F.ang[i]) * Math.min(1, dt * 5);
  }

  // Half width of the body along its length, t = 0 at the snout, 1 at the tail root.
  function halfWidth(t) {
    const nose = Math.sqrt(Math.min(1, t / 0.16));
    const taper = 1 - 0.8 * Math.pow(Math.max(0, (t - 0.18) / 0.82), 1.25);
    return 0.12 * nose * taper;
  }

  function bend(t, ph, amp) {
    return Math.sin(ph - t * 3.4) * 0.075 * amp * t * t;
  }

  // Body outline seen from above; k scales the width (rim, body, back stripe).
  function bodyPath(ctx, L, ph, amp, k) {
    ctx.beginPath();
    for (let j = 0; j <= SEG; j++) {
      const t = j / SEG;
      const x = (0.5 - t * 0.8) * L;
      const y = (bend(t, ph, amp) - halfWidth(t) * k) * L;
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let j = SEG; j >= 0; j--) {
      const t = j / SEG;
      ctx.lineTo((0.5 - t * 0.8) * L, (bend(t, ph, amp) + halfWidth(t) * k) * L);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawFish(ctx, g, F, i) {
    const L = F.size[i];
    const c = Math.cos(F.ang[i]);
    const s = Math.sin(F.ang[i]);
    const amp = F.mode[i] === 1 ? 1.7 : 0.8;
    const ph = F.ph[i];
    // soft shadow on the gravel
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#10222a';
    ctx.setTransform(c, s, -s, c, F.x[i] + g.U * 2.4, F.y[i] + g.U * 3);
    ell(ctx, 0.08 * L, 0, 0.44 * L, 0.085 * L);
    ctx.globalAlpha = 1;
    ctx.setTransform(c, s, -s, c, F.x[i], F.y[i]);
    // forked tail
    const tb = bend(1, ph, amp) + Math.sin(ph - 4) * 0.05 * amp;
    ctx.fillStyle = '#4a5236';
    poly(ctx, [-0.27 * L, bend(0.96, ph, amp) * L, -0.47 * L, (tb - 0.11) * L, -0.41 * L, tb * L, -0.47 * L, (tb + 0.11) * L]);
    // pectoral fins
    ctx.fillStyle = '#9c9a72';
    poly(ctx, [0.26 * L, -0.07 * L, 0.12 * L, -0.15 * L, 0.17 * L, -0.06 * L]);
    poly(ctx, [0.26 * L, 0.07 * L, 0.12 * L, 0.15 * L, 0.17 * L, 0.06 * L]);
    // sunlit flank, olive body, dark back
    ctx.fillStyle = '#cfc8a0';
    bodyPath(ctx, L, ph, amp, 1.1);
    ctx.fillStyle = '#7a7c50';
    bodyPath(ctx, L, ph, amp, 0.84);
    ctx.fillStyle = '#334028';
    bodyPath(ctx, L, ph, amp, 0.42);
    // gold gill spots and eyes
    ctx.fillStyle = '#e0b04a';
    ell(ctx, 0.25 * L, -0.07 * L, 0.028 * L, 0.02 * L);
    ell(ctx, 0.25 * L, 0.07 * L, 0.028 * L, 0.02 * L);
    ctx.fillStyle = '#15201c';
    ell(ctx, 0.41 * L, -0.045 * L, 0.022 * L, 0.022 * L);
    ell(ctx, 0.41 * L, 0.045 * L, 0.022 * L, 0.022 * L);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- leaves --------------------------------------------------------------

  function makeLeaves() {
    const f = () => new Float32Array(MAX_LEAVES);
    return { x: f(), y: f(), a: f(), spin: f(), p: f(), v: f(), kind: f() };
  }

  function placeLeaf(g, L, i, anywhere) {
    const r = state.rand;
    L.x[i] = anywhere ? r() * g.W : -g.U * 5;
    L.y[i] = lerp(g.lo - g.U * 4, g.hi + g.U * 4, r());
    L.a[i] = r() * TAU;
    L.spin[i] = (r() - 0.5) * 0.8;
    L.p[i] = r() * TAU;
    L.v[i] = g.U * (2.2 + r() * 2.2);
    L.kind[i] = i % 4 === 3 ? 3 : i % 3;
  }

  function stepLeaf(g, L, i, t, dt) {
    L.x[i] += L.v[i] * dt;
    L.y[i] += Math.sin(t * 0.6 + L.p[i]) * g.U * 0.9 * dt;
    L.a[i] += L.spin[i] * dt;
    if (L.x[i] > g.W + g.U * 5) placeLeaf(g, L, i, false);
  }

  function drawLeaves(ctx, g, count, shadow) {
    const L = state.leaves;
    const sp = state.sprites;
    ctx.globalAlpha = shadow ? 0.3 : 1;
    for (let i = 0; i < count; i++) {
      const c = Math.cos(L.a[i]);
      const s = Math.sin(L.a[i]);
      const k = L.kind[i];
      const img = k === 3 ? (shadow ? sp.bambooShadow : sp.bamboo) : shadow ? sp.mapleShadow : sp.maple[k];
      const off = shadow ? g.U * 1.4 : 0;
      ctx.setTransform(c, s, -s, c, L.x[i] + off, L.y[i] + off * 1.3);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  // ---- flow lines ----------------------------------------------------------

  function makeStreaks(g, rand) {
    const s = { x: new Float32Array(STREAKS), y: new Float32Array(STREAKS), l: new Float32Array(STREAKS), p: new Float32Array(STREAKS), v: new Float32Array(STREAKS) };
    for (let i = 0; i < STREAKS; i++) {
      s.x[i] = rand() * g.W;
      s.y[i] = lerp(g.lo - g.U * 4, g.hi + g.U * 4, rand());
      s.l[i] = g.U * (3 + rand() * 7);
      s.p[i] = rand() * TAU;
      s.v[i] = g.U * (1.5 + rand() * 2);
    }
    return s;
  }

  function drawStreaks(ctx, g, t) {
    const s = state.streaks;
    const th = Math.max(1, g.U * 0.35);
    ctx.fillStyle = '#ddd6bd';
    for (let i = 0; i < STREAKS; i++) {
      const a = Math.sin(t * 0.6 + s.p[i]);
      if (a <= 0) continue;
      ctx.globalAlpha = a * 0.32;
      ctx.fillRect(((s.x[i] + t * s.v[i]) % (g.W + s.l[i])) - s.l[i], s.y[i], s.l[i], th);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function tileDraw(ctx, tile, ox, oy, w, h) {
    const x = ((ox % w) + w) % w;
    const y = ((oy % h) + h) % h;
    ctx.drawImage(tile, x - w, y - h);
    ctx.drawImage(tile, x, y - h);
    ctx.drawImage(tile, x - w, y);
    ctx.drawImage(tile, x, y);
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.bed = paintBed(g, rand);
    state.netA = paintNet(g, 1);
    state.netB = paintNet(g, 3);
    state.shade = paintShade(g, rand);
    state.front = paintFront(g, rand);
    state.sprites = makeSprites(g);
    state.fish = makeFish(g, rand);
    state.leaves = makeLeaves();
    for (let i = 0; i < MAX_LEAVES; i++) placeLeaf(g, state.leaves, i, true);
    state.streaks = makeStreaks(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { fish, leaves, light } = api.props;
    const nf = Math.min(MAX_FISH, Math.round(FISH * fish));
    const nl = Math.min(MAX_LEAVES, Math.round(LEAVES * leaves));
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < nf; i++) stepFish(g, state.fish, i, step);
    for (let i = 0; i < nl; i++) stepLeaf(g, state.leaves, i, t, step);
    ctx.drawImage(state.bed, 0, 0);
    const amount = Math.min(0.8, 0.1 + light * 0.4);
    if (light > 0) {
      ctx.globalAlpha = amount * 0.9;
      tileDraw(ctx, state.netA, t * g.U * 1.6, Math.sin(t * 0.25) * g.U * 2, g.W, g.H);
      ctx.globalAlpha = amount * 0.75;
      tileDraw(ctx, state.netB, -t * g.U * 1.1, Math.cos(t * 0.2) * g.U * 2.5, g.W, g.H);
      ctx.globalAlpha = 1;
    }
    const sw = state.shade.width;
    const sx = (t * g.U * 0.9) % sw;
    ctx.globalAlpha = 0.32 * Math.min(1, light);
    ctx.drawImage(state.shade, sx, Math.sin(t * 0.15) * g.U * 2);
    ctx.drawImage(state.shade, sx - sw, Math.sin(t * 0.15) * g.U * 2);
    ctx.globalAlpha = 1;
    for (let i = 0; i < nf; i++) drawFish(ctx, g, state.fish, i);
    drawStreaks(ctx, g, t);
    drawLeaves(ctx, g, nl, true);
    drawLeaves(ctx, g, nl, false);
    ctx.drawImage(state.front, 0, 0);
  }

  Kasuri.run({
    defaults: { fish: 1, leaves: 1, light: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
