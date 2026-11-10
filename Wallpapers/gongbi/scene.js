/*
 * 工笔 Gongbi — fine-line painted peonies beside a pitted garden rock on aged silk.
 *
 * Silk, rock and ground are baked once. Each peony stem is its own small sprite
 * (stem, leaves, bloom) that swings from its foot. A sheen band slides over the silk
 * and a few petals drift down.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;
  const TAU = Math.PI * 2;
  const INK = '#2b2a2c';
  const SILK = ['#d8c9a3', '#cfbf97', '#c4b389'];
  const BLOOMS = [
    ['#b83a28', '#d6452c', '#e8806a', '#f2c3ae'],
    ['#e9ddc2', '#f2e9d2', '#d9c9a6', '#c2ae86'],
    ['#c4503a', '#dc7058', '#ecab94', '#f4d9c4'],
  ];
  const LEAF = ['#4a5c3a', '#62764a', '#7d8f5c'];
  const PETAL_COUNT = 6;
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
    const s = Math.min(H / 100, W / 150);
    return { W, H, s, line: Math.max(1, s * 0.22) };
  }

  // ---- silk ----------------------------------------------------------------

  function paintSilk(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(g.W, g.H);
    const d = img.data;
    const inks = SILK.map(K.parseColor);
    for (let y = 0; y < g.H; y++) {
      for (let x = 0; x < g.W; x++) {
        const n = fbm(x / (g.s * 30), y / (g.s * 24), 3, 5);
        const edge = Math.max(Math.abs(x / g.W - 0.5), Math.abs(y / g.H - 0.5) * 1.2);
        const v = Math.min(1.99, n * 1.2 + smoothstep(0.3, 0.62, edge) * 0.9 + (rand() - 0.5) * 0.12 + ((x + y * 2) % 3 === 0 ? 0.06 : 0));
        const k = Math.max(0, Math.min(inks.length - 1.01, v * (inks.length - 1) * 0.6));
        const a = inks[Math.floor(k)];
        const b = inks[Math.floor(k) + 1];
        const f = k - Math.floor(k);
        const i = (y * g.W + x) * 4;
        d[i] = lerp(a[0], b[0], f);
        d[i + 1] = lerp(a[1], b[1], f);
        d[i + 2] = lerp(a[2], b[2], f);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintSheen(g) {
    const w = Math.ceil(g.W * 0.5);
    const c = layer(w, g.H);
    const ctx = c.getContext('2d');
    const gr = ctx.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, 'rgba(250,240,210,0)');
    gr.addColorStop(0.5, 'rgba(250,240,210,0.2)');
    gr.addColorStop(1, 'rgba(250,240,210,0)');
    ctx.fillStyle = gr;
    ctx.setTransform(1, 0, -0.35, 1, g.H * 0.17, 0);
    ctx.fillRect(-g.H * 0.2, 0, w + g.H * 0.4, g.H);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return c;
  }

  // ---- rock ----------------------------------------------------------------

  function rockOutline(g, cx, base, w, h) {
    const pts = [];
    const n = 44;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const sx = Math.cos(a);
      const sy = Math.sin(a);
      const top = Math.max(0, -sy);
      const taper = 1 - top * 0.12 + Math.sin(a * 3 + 1) * 0.2 * top + Math.sin(a * 5) * 0.08;
      const rough = 1 + (fbm(i * 0.55, 3.3, 3, 61) - 0.5) * 0.7;
      pts.push([cx + sx * w * 0.5 * taper * rough, base - h * 0.5 + sy * h * 0.5 * (1 + (fbm(i * 0.4, 8, 2, 17) - 0.5) * 0.12)]);
    }
    return pts;
  }

  function tracePts(ctx, pts) {
    ctx.beginPath();
    const n = pts.length;
    ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % n];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.closePath();
  }

  function paintRock(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const s = g.s;
    const cx = g.W * 0.73;
    const base = g.H * 0.9;
    const w = s * 40;
    const h = s * 74;
    // ground wash and shadow
    ctx.fillStyle = 'rgba(70,64,56,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx - s * 2, base + s * 0.5, w * 0.8, s * 3.2, 0, 0, TAU);
    ctx.fill();
    const pts = rockOutline(g, cx, base, w, h);
    tracePts(ctx, pts);
    const gr = ctx.createLinearGradient(cx - w * 0.5, 0, cx + w * 0.5, 0);
    gr.addColorStop(0, '#d2cfc2');
    gr.addColorStop(0.45, '#9ea5a2');
    gr.addColorStop(1, '#5c666c');
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.save();
    tracePts(ctx, pts);
    ctx.clip();
    // pitting and holes
    for (let i = 0; i < 9; i++) {
      const hx = cx + (rand() - 0.5) * w * 0.55;
      const hy = base - h * (0.1 + i * 0.095) + (rand() - 0.5) * s * 4;
      const rx = s * (1.3 + rand() * 2.6);
      const ry = rx * (0.7 + rand() * 1.5);
      ctx.fillStyle = '#d4d3c6';
      ctx.beginPath();
      ctx.ellipse(hx + rx * 0.2, hy + ry * 0.15, rx * 1.12, ry * 1.1, 0.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#2f3438';
      ctx.beginPath();
      ctx.ellipse(hx, hy, rx, ry, rand() - 0.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#4c5458';
      ctx.beginPath();
      ctx.ellipse(hx - rx * 0.2, hy - ry * 0.25, rx * 0.55, ry * 0.5, 0.2, 0, TAU);
      ctx.fill();
    }
    // wrinkle contour lines
    ctx.strokeStyle = 'rgba(38,42,46,0.55)';
    ctx.lineWidth = g.line;
    ctx.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const y0 = base - h * (0.05 + rand() * 0.9);
      const x0 = cx + (rand() - 0.5) * w * 0.7;
      const len = s * (5 + rand() * 9);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.bezierCurveTo(x0 + len * 0.3, y0 - len * 0.4, x0 - len * 0.2, y0 - len * 0.8, x0 + len * 0.1, y0 - len * 1.3);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = g.line * 1.3;
    ctx.lineJoin = 'round';
    tracePts(ctx, pts);
    ctx.stroke();
    // moss at the foot
    ctx.fillStyle = LEAF[0];
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.ellipse(cx + (rand() - 0.5) * w * 1.15, base - rand() * s * 1.6, s * (0.8 + rand() * 1.4), s * (0.4 + rand() * 0.5), 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = LEAF[2];
    for (let i = 0; i < 8; i++) ctx.fillRect(cx + (rand() - 0.5) * w * 1.1, base - rand() * s * 1.2, s * 0.7, s * 0.5);
    return c;
  }

  // ---- peonies -------------------------------------------------------------

  function petalPath(ctx, len, wid) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-wid, -len * 0.35, -wid * 1.15, -len * 0.92, -wid * 0.35, -len);
    ctx.quadraticCurveTo(0, -len * 1.1, wid * 0.35, -len);
    ctx.bezierCurveTo(wid * 1.15, -len * 0.92, wid, -len * 0.35, 0, 0);
    ctx.closePath();
  }

  function drawBloom(ctx, g, x, y, r, tones, rand) {
    const rings = [[7, 1, 0], [6, 0.8, 0.4], [5, 0.58, 0.9], [4, 0.36, 1.5]];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.84);
    ctx.lineJoin = 'round';
    for (let k = 0; k < rings.length; k++) {
      const [n, sz, off] = rings[k];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + off + (rand() - 0.5) * 0.18;
        const len = r * sz * (0.92 + rand() * 0.16);
        ctx.save();
        ctx.rotate(a);
        petalPath(ctx, len, len * 0.5);
        ctx.fillStyle = tones[Math.min(3, k)];
        ctx.fill();
        // lighter edge wash
        ctx.save();
        ctx.translate(0, -len * 0.62);
        ctx.fillStyle = tones[Math.min(3, k + 1)];
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.ellipse(0, -len * 0.18, len * 0.3, len * 0.2, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = INK;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = g.line * (k === 0 ? 1.1 : 0.9);
        petalPath(ctx, len, len * 0.5);
        ctx.stroke();
        // fine veins
        ctx.lineWidth = g.line * 0.6;
        ctx.globalAlpha = 0.35;
        for (let v = -1; v <= 1; v++) {
          ctx.beginPath();
          ctx.moveTo(0, -len * 0.05);
          ctx.quadraticCurveTo(v * len * 0.2, -len * 0.5, v * len * 0.25, -len * 0.88);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    ctx.fillStyle = '#c9a23c';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.12, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e6c259';
    for (let i = 0; i < 9; i++) {
      const a = rand() * TAU;
      ctx.fillRect(Math.cos(a) * r * 0.14 - g.line * 0.5, Math.sin(a) * r * 0.14 - g.line * 0.5, g.line, g.line);
    }
    ctx.restore();
  }

  function drawLeaf(ctx, g, x, y, ang, size, tone) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.lineJoin = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.save();
      ctx.rotate(i * 0.65);
      const len = size * (i === 0 ? 1 : 0.78);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-len * 0.38, -len * 0.25, -len * 0.4, -len * 0.75, 0, -len);
      ctx.bezierCurveTo(len * 0.4, -len * 0.75, len * 0.38, -len * 0.25, 0, 0);
      ctx.fillStyle = LEAF[tone];
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = g.line * 0.9;
      ctx.stroke();
      ctx.strokeStyle = LEAF[2];
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = g.line * 0.6;
      ctx.beginPath();
      ctx.moveTo(0, -len * 0.05);
      ctx.lineTo(0, -len * 0.9);
      for (let v = 1; v <= 3; v++) {
        ctx.moveTo(0, -len * v * 0.22);
        ctx.lineTo(-len * 0.2, -len * (v * 0.22 + 0.12));
        ctx.moveTo(0, -len * v * 0.22);
        ctx.lineTo(len * 0.2, -len * (v * 0.22 + 0.12));
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function makeStem(g, rand, spec) {
    const s = g.s;
    const r = spec.r * s;
    const len = spec.len * s;
    const lean = spec.lean * s;
    const pad = r * 1.5 + Math.abs(lean) + s * 12;
    const w = Math.ceil(pad * 2);
    const h = Math.ceil(len + r * 1.4 + s * 6);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const bx = w / 2;
    const by = h - 1;
    const tx = bx + lean;
    const ty = r * 1.1;
    // stem
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = s * 1.1 + g.line;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.bezierCurveTo(bx - lean * 0.2, by - len * 0.4, tx + lean * 0.3, ty + len * 0.4, tx, ty);
    ctx.stroke();
    ctx.strokeStyle = LEAF[1];
    ctx.lineWidth = s * 1.1;
    ctx.stroke();
    // leaves along the stem
    for (let i = 0; i < spec.leaves; i++) {
      const f = 0.22 + i * (0.5 / Math.max(1, spec.leaves));
      const side = i % 2 === 0 ? -1 : 1;
      const lx = lerp(bx, tx, f);
      const ly = by - (by - ty) * f;
      drawLeaf(ctx, g, lx, ly, side * (0.95 + rand() * 0.3), s * (13 + rand() * 6), i % 2);
    }
    if (spec.tones) drawBloom(ctx, g, tx, ty, r, spec.tones, rand);
    else {
      // bud
      ctx.fillStyle = '#d6452c';
      ctx.beginPath();
      ctx.ellipse(tx, ty + r * 0.2, r * 0.5, r * 0.7, lean * 0.01, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = g.line;
      ctx.stroke();
      ctx.fillStyle = LEAF[0];
      ctx.beginPath();
      ctx.ellipse(tx, ty + r * 0.9, r * 0.5, r * 0.3, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    return { c, px: bx, py: by };
  }

  const STEMS = [
    { x: 0.13, r: 15, len: 38, lean: -6, leaves: 3, tones: 1, ph: 0.3 },
    { x: 0.29, r: 20, len: 54, lean: 4, leaves: 3, tones: 0, ph: 1.6 },
    { x: 0.45, r: 14, len: 30, lean: 8, leaves: 2, tones: 2, ph: 2.9 },
    { x: 0.53, r: 8, len: 66, lean: -4, leaves: 3, tones: -1, ph: 4.1 },
    { x: 0.34, r: 12, len: 20, lean: -8, leaves: 2, tones: 2, ph: 5.2 },
    { x: 0.18, r: 7, len: 26, lean: 7, leaves: 3, tones: -1, ph: 0.9 },
  ];

  function makeStems(g, rand) {
    return STEMS.map((sp) => {
      const spec = { r: sp.r, len: sp.len, lean: sp.lean, leaves: sp.leaves, tones: sp.tones >= 0 ? BLOOMS[sp.tones] : null };
      const st = makeStem(g, rand, spec);
      return { c: st.c, px: st.px, py: st.py, x: g.W * sp.x, y: g.H * 0.93, ph: sp.ph, amp: 0.012 + (sp.len / 60) * 0.02 };
    });
  }

  // ---- petals --------------------------------------------------------------

  function makePetals(g, rand) {
    const L = { x: new Float32Array(PETAL_COUNT), y: new Float32Array(PETAL_COUNT), p: new Float32Array(PETAL_COUNT), v: new Float32Array(PETAL_COUNT), sz: new Float32Array(PETAL_COUNT), tone: new Uint8Array(PETAL_COUNT) };
    for (let i = 0; i < PETAL_COUNT; i++) resetPetal(g, L, i, rand, true);
    return L;
  }

  function resetPetal(g, L, i, rand, scatter) {
    L.x[i] = g.W * (0.05 + rand() * 0.5);
    L.y[i] = scatter ? g.H * (0.1 + rand() * 0.8) : -g.s * 3;
    L.p[i] = rand() * TAU;
    L.v[i] = g.s * (1.6 + rand() * 1.4);
    L.sz[i] = g.s * (1.6 + rand() * 1.2);
    L.tone[i] = Math.floor(rand() * 3);
  }

  const PETAL_TONES = ['#e8806a', '#f2c3ae', '#ecddc0'];

  function drawPetals(ctx, g, t, dt, count) {
    const L = state.petals;
    const rand = state.rand;
    for (let i = 0; i < count; i++) {
      L.y[i] += L.v[i] * dt;
      L.x[i] += Math.sin(t * 0.7 + L.p[i]) * g.s * 2.4 * dt + g.s * 0.5 * dt;
      if (L.y[i] > g.H * 0.95) resetPetal(g, L, i, rand, false);
      const a = t * 0.8 + L.p[i];
      const sq = 0.35 + 0.65 * Math.abs(Math.sin(a));
      ctx.setTransform(Math.cos(a) * sq, Math.sin(a) * sq, -Math.sin(a), Math.cos(a), L.x[i], L.y[i]);
      ctx.fillStyle = PETAL_TONES[L.tone[i]];
      ctx.fillRect(-L.sz[i] * 0.5, -L.sz[i] * 0.35, L.sz[i], L.sz[i] * 0.7);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.silk = paintSilk(g, rand);
    state.sheen = paintSheen(g);
    state.rock = paintRock(g, rand);
    state.stems = makeStems(g, rand);
    state.petals = makePetals(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { sway, petals, sheen } = api.props;
    ctx.drawImage(state.silk, 0, 0);
    if (sheen > 0) {
      const sw = state.sheen.width;
      const x = ((t * g.s * 2.2) % (g.W + sw)) - sw;
      ctx.globalAlpha = Math.min(1, sheen);
      ctx.drawImage(state.sheen, x, 0);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(state.rock, 0, 0);
    const list = state.stems;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const a = (Math.sin(t * 0.55 + s.ph) + Math.sin(t * 0.9 + s.ph * 1.7) * 0.4) * s.amp * sway;
      ctx.setTransform(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), s.x, s.y);
      ctx.drawImage(s.c, -s.px, -s.py);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawPetals(ctx, g, t, Math.min(dt, 0.1), Math.min(PETAL_COUNT, Math.round(PETAL_COUNT * petals * 0.5 + 0.4)));
  }

  Kasuri.run({
    defaults: { sway: 1, petals: 1, sheen: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
