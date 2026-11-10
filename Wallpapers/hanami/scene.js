/*
 * 花見 Hanami — a cherry tree at night, strung with paper lanterns.
 *
 * Sky, hills, pagoda, canopy, bench and stone lantern are baked once. Per frame
 * only the lantern strings sway, their glow breathes a little, and a short
 * pool of petals drifts down.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep, mixColor, toHex, parseColor } = K;

  const TAU = Math.PI * 2;
  const GROUND = 0.745;
  const MOON = { x: 0.8, y: 0.15 };
  const MAX_PETALS = 90;
  const PETALS = 48;
  const STRINGS = [
    { x0: -0.02, y0: 0.27, x1: 1.02, y1: 0.31, sag: 0.1, n: 9, size: 1, hue: 0 },
    { x0: 0.1, y0: 0.19, x1: 1.02, y1: 0.215, sag: 0.075, n: 7, size: 0.74, hue: 1 },
  ];
  const INK = { sky: ['#0b0f22', '#202850', '#363e6c'], hill: '#283060', hill2: '#1d2448', ground: '#26382c', ground2: '#16211f' };
  const BLOSSOM = { shade: '#4c4260', mid: '#b59aa0', light: '#efe1d3' };
  const WOOD = { dark: '#3a2a1e', mid: '#8a6038', lit: '#cfa468' };
  const state = {};

  const rgb = (h) => parseColor(h);
  const hex = (c) => toHex(c);

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
    return { W, H, U, gy: Math.round(H * GROUND) };
  }

  // Rest position of lantern i on string s.
  function lanternAt(g, s, i, out) {
    const st = STRINGS[s];
    const u = (i + 0.5) / st.n;
    out.x = lerp(st.x0, st.x1, u) * g.W;
    out.y = (lerp(st.y0, st.y1, u) + st.sag * 4 * u * (1 - u) * 0.5) * g.H;
    return out;
  }

  function lanternList(g) {
    const list = [];
    for (let s = 0; s < STRINGS.length; s++) {
      for (let i = 0; i < STRINGS[s].n; i++) list.push(lanternAt(g, s, i, {}));
    }
    return list;
  }

  // ---- sky, hills and pagoda ---------------------------------------------------

  function paintSky(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.gy);
    grad.addColorStop(0, INK.sky[0]);
    grad.addColorStop(0.55, INK.sky[1]);
    grad.addColorStop(1, INK.sky[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#e8dfc9';
    for (let i = 0; i < g.W * 0.5; i++) {
      ctx.globalAlpha = 0.15 + rand() * 0.45;
      ctx.fillRect(rand() * g.W, rand() * g.H * 0.5, 1, 1);
    }
    ctx.globalAlpha = 1;
    const mx = g.W * MOON.x;
    const my = g.H * MOON.y;
    const halo = ctx.createRadialGradient(mx, my, 0, mx, my, g.U * 22);
    halo.addColorStop(0, 'rgba(232,223,201,0.35)');
    halo.addColorStop(1, 'rgba(232,223,201,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - g.U * 22, my - g.U * 22, g.U * 44, g.U * 44);
    ctx.fillStyle = '#e8dfc9';
    blob(ctx, mx, my, g.U * 5, g.U * 5);
    ctx.fillStyle = 'rgba(160,150,140,0.25)';
    blob(ctx, mx - g.U * 1.4, my - g.U * 0.8, g.U * 1.3, g.U * 1.1);
    blob(ctx, mx + g.U * 1.5, my + g.U * 1.6, g.U * 1.6, g.U * 1.2);
    return c;
  }

  function paintPagoda(ctx, g, px, base, h) {
    ctx.fillStyle = INK.hill2;
    const tiers = 5;
    const tierH = h / (tiers + 1.2);
    for (let k = 0; k < tiers; k++) {
      const w = tierH * (3.3 - k * 0.42);
      const y1 = base - k * tierH * 1.12;
      const y0 = y1 - tierH * 0.62;
      ctx.fillRect(px - w * 0.3, y0, w * 0.6, y1 - y0);
      const eave = w * 0.9;
      poly(ctx, [px - eave, y0 + tierH * 0.12, px - eave * 0.55, y0 - tierH * 0.1, px + eave * 0.55, y0 - tierH * 0.1, px + eave, y0 + tierH * 0.12, px + eave * 0.5, y0 + tierH * 0.04, px - eave * 0.5, y0 + tierH * 0.04]);
    }
    const top = base - tiers * tierH * 1.12;
    ctx.fillRect(px - 0.5, top - tierH * 1.4, 1, tierH * 1.6);
    ctx.fillStyle = '#d9a948';
    ctx.globalAlpha = 0.55;
    for (let k = 0; k < tiers; k++) {
      ctx.fillRect(px - 0.5, base - k * tierH * 1.12 - tierH * 0.4, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function paintHills(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const far = (x) => g.H * 0.6 + (fbm(x / (g.U * 38), 2.2, 3, 17) - 0.5) * g.H * 0.1;
    const near = (x) => g.H * 0.67 + (fbm(x / (g.U * 28), 5.1, 3, 29) - 0.5) * g.H * 0.07;
    ctx.fillStyle = INK.hill;
    for (let x = 0; x < g.W; x++) ctx.fillRect(x, far(x), 1, g.gy - far(x) + 2);
    paintPagoda(ctx, g, g.W * 0.7, g.H * 0.655, g.H * 0.2);
    ctx.fillStyle = INK.hill2;
    for (let x = 0; x < g.W; x++) ctx.fillRect(x, near(x), 1, g.gy - near(x) + 2);
    // A low tiled roof ridge at the far left.
    const rx = g.W * 0.05;
    const ry = g.H * 0.655;
    ctx.fillStyle = '#10152c';
    poly(ctx, [rx, ry + g.U * 3, rx + g.U * 2, ry, rx + g.U * 14, ry, rx + g.U * 16, ry + g.U * 3]);
    ctx.fillRect(rx + g.U * 1.5, ry + g.U * 3, g.U * 13, g.U * 3);
    return c;
  }

  // ---- ground, bench, stone lantern -----------------------------------------------

  function paintGround(g, rand, lights) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, g.gy, 0, g.H);
    grad.addColorStop(0, INK.ground);
    grad.addColorStop(1, INK.ground2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, g.gy, g.W, g.H - g.gy);
    ctx.fillStyle = '#4a6446';
    for (let i = 0; i < g.W * 1.2; i++) {
      ctx.globalAlpha = 0.25 + rand() * 0.4;
      ctx.fillRect(rand() * g.W, g.gy + rand() * (g.H - g.gy), 1 + (rand() * 2) | 0, 1);
    }
    ctx.globalAlpha = 1;
    // Warm pools of lantern light on the grass.
    for (const l of lights) {
      const r = g.U * 20;
      const pool = ctx.createRadialGradient(l.x, g.gy + g.U * 9, 0, l.x, g.gy + g.U * 9, r);
      pool.addColorStop(0, 'rgba(217,169,72,0.3)');
      pool.addColorStop(1, 'rgba(217,169,72,0)');
      ctx.fillStyle = pool;
      ctx.fillRect(l.x - r, g.gy - g.U * 6, r * 2, r * 1.6);
    }
    // Fallen petals, more of them near the bench.
    for (let i = 0; i < g.W * 0.7; i++) {
      const x = g.W * 0.5 + (rand() - 0.5) * g.W * (rand() < 0.6 ? 0.45 : 1);
      const y = g.gy + g.U * 1.5 + rand() * (g.H - g.gy - g.U * 2);
      ctx.fillStyle = rand() < 0.7 ? '#cdb4b0' : '#e9dccd';
      ctx.globalAlpha = 0.35 + rand() * 0.5;
      ctx.fillRect(x, y, 1 + (rand() * 1.4 | 0), 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintBench(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const U = g.U;
    const cx = g.W * 0.5;
    const seat = g.H * 0.815;
    const half = U * 15;
    const floor = seat + U * 8;
    ctx.fillStyle = 'rgba(8,10,14,0.55)';
    blob(ctx, cx, floor + U * 0.8, half * 1.15, U * 1.6);
    // Legs and back posts.
    ctx.fillStyle = WOOD.dark;
    for (const sx of [-1, 1]) {
      const lx = cx + sx * half * 0.84;
      ctx.fillRect(lx - U * 0.9, seat, U * 1.8, floor - seat);
      ctx.fillRect(lx - U * 0.7, seat - U * 9.5, U * 1.4, U * 9.5);
    }
    ctx.fillRect(cx - half * 0.84, seat + U * 3.6, half * 1.68, Math.max(1, U * 0.9));
    // Backrest slats.
    for (let k = 0; k < 2; k++) {
      const y = seat - U * (8.6 - k * 2.9);
      ctx.fillStyle = WOOD.mid;
      ctx.fillRect(cx - half, y, half * 2, U * 2);
      ctx.fillStyle = WOOD.lit;
      ctx.fillRect(cx - half, y, half * 2, Math.max(1, U * 0.5));
    }
    // Seat slats seen from slightly above.
    for (let k = 0; k < 3; k++) {
      const y = seat - U * 0.4 + k * U * 1.45;
      ctx.fillStyle = k === 0 ? WOOD.lit : WOOD.mid;
      ctx.fillRect(cx - half, y, half * 2, U * 1.2);
      ctx.fillStyle = WOOD.dark;
      ctx.fillRect(cx - half, y + U * 1.2, half * 2, Math.max(1, U * 0.25));
    }
    // Petals gathered on the seat.
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = rand() < 0.7 ? '#e0cfc6' : '#c4a8a6';
      ctx.globalAlpha = 0.6 + rand() * 0.35;
      ctx.fillRect(cx - half + rand() * half * 2, seat - U * 0.3 + rand() * U * 3.6, 1 + (rand() * 1.5 | 0), 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function paintToro(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const U = g.U;
    const cx = g.W * 0.865;
    const base = g.H * 0.9;
    const stone = '#4a4e5e';
    const lit = '#6b6e78';
    ctx.fillStyle = 'rgba(8,10,14,0.5)';
    blob(ctx, cx, base + U * 0.5, U * 6, U * 1.2);
    ctx.fillStyle = stone;
    ctx.fillRect(cx - U * 4.4, base - U * 1.8, U * 8.8, U * 1.8);
    ctx.fillRect(cx - U * 1.1, base - U * 9.5, U * 2.2, U * 7.7);
    ctx.fillStyle = lit;
    ctx.fillRect(cx - U * 3.4, base - U * 11.2, U * 6.8, U * 1.7);
    // Firebox with its warm light.
    ctx.fillStyle = stone;
    ctx.fillRect(cx - U * 3, base - U * 16, U * 6, U * 4.8);
    ctx.fillStyle = '#e0b256';
    ctx.fillRect(cx - U * 1.6, base - U * 15, U * 3.2, U * 2.8);
    ctx.fillStyle = '#8a6a30';
    ctx.fillRect(cx - U * 0.15, base - U * 15, Math.max(1, U * 0.3), U * 2.8);
    // Hip roof and finial.
    ctx.fillStyle = lit;
    poly(ctx, [cx - U * 7, base - U * 16, cx - U * 2.2, base - U * 20, cx + U * 2.2, base - U * 20, cx + U * 7, base - U * 16]);
    ctx.fillStyle = stone;
    poly(ctx, [cx - U * 5.2, base - U * 17, cx - U * 1.8, base - U * 20, cx + U * 1.8, base - U * 20, cx + U * 5.2, base - U * 17]);
    blob(ctx, cx, base - U * 21.2, U * 1.2, U * 1.4);
    const glow = ctx.createRadialGradient(cx, base - U * 13.5, 0, cx, base - U * 13.5, U * 12);
    glow.addColorStop(0, 'rgba(224,178,86,0.34)');
    glow.addColorStop(1, 'rgba(224,178,86,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - U * 12, base - U * 26, U * 24, U * 24);
    return c;
  }

  // ---- tree ------------------------------------------------------------------

  // A tapering limb drawn as short round segments along a curve.
  function limb(ctx, g, p, w0, w1) {
    const steps = 22;
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps;
      const t1 = (s + 1) / steps;
      const at = (t) => {
        const a = (1 - t) * (1 - t);
        const b = 2 * (1 - t) * t;
        const d = t * t;
        return [a * p[0] + b * p[2] + d * p[4], a * p[1] + b * p[3] + d * p[5]];
      };
      const a = at(t0);
      const b = at(t1);
      const w = lerp(w0, w1, t0) * g.U;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#1c1618';
      ctx.lineWidth = Math.max(1, w);
      ctx.beginPath();
      ctx.moveTo(a[0] * g.W, a[1] * g.H);
      ctx.lineTo(b[0] * g.W, b[1] * g.H);
      ctx.stroke();
      if (w > 2.2) {
        ctx.strokeStyle = '#3b2e30';
        ctx.lineWidth = Math.max(1, w * 0.25);
        ctx.beginPath();
        ctx.moveTo(a[0] * g.W + w * 0.22, a[1] * g.H);
        ctx.lineTo(b[0] * g.W + w * 0.22, b[1] * g.H);
        ctx.stroke();
      }
    }
  }

  function paintLimbs(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    limb(ctx, g, [0.1, 0.86, 0.06, 0.5, 0.17, 0.3], 8, 4);
    limb(ctx, g, [0.17, 0.3, 0.3, 0.2, 0.5, 0.17], 3.2, 1.2);
    limb(ctx, g, [0.14, 0.4, 0.3, 0.33, 0.4, 0.28], 2.2, 0.8);
    limb(ctx, g, [0.17, 0.3, 0.12, 0.2, 0.2, 0.08], 2.4, 0.8);
    limb(ctx, g, [0.4, 0.28, 0.5, 0.3, 0.6, 0.27], 0.9, 0.5);
    limb(ctx, g, [0.5, 0.17, 0.62, 0.14, 0.74, 0.19], 1.2, 0.5);
    return c;
  }

  // Lower edge of the blossom mass; lifts toward the moon so the sky shows there.
  function canopyEdge(g, x) {
    const u = x / g.W;
    const base = lerp(0.36, 0.2, smoothstep(0.15, 0.95, u));
    const moonGap = Math.exp(-(((u - MOON.x) / 0.1) ** 2)) * 0.1;
    return (base - moonGap + (fbm(x / (g.U * 12), 3.3, 3, 7) - 0.5) * 0.12) * g.H;
  }

  function paintCanopy(g, rand, lights) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const shade = rgb(BLOSSOM.shade);
    const mid = rgb(BLOSSOM.mid);
    const light = rgb(BLOSSOM.light);
    const reach = g.U * 13;
    const mx = g.W * MOON.x;
    const my = g.H * MOON.y;
    const count = Math.round((g.W * g.H) / (g.U * g.U) * 0.9);
    for (let i = 0; i < count; i++) {
      const x = rand() * g.W;
      const edge = canopyEdge(g, x);
      const y = rand() * edge * 1.02;
      let v = rand() * 0.5 - 0.05 + (1 - y / edge) * 0.12;
      for (const l of lights) {
        const d = Math.hypot(x - l.x, (y - l.y) * 1.2) / reach;
        if (d < 2.5) v += 0.42 * Math.exp(-d * d);
      }
      v += 0.3 * Math.exp(-((Math.hypot(x - mx, y - my) / (g.U * 20)) ** 2));
      v = Math.min(1, v);
      const col = v < 0.5 ? mixColor(shade, mid, v * 2) : mixColor(mid, light, (v - 0.5) * 2);
      ctx.fillStyle = hex(col);
      const r = g.U * (0.6 + rand() * 1.1);
      blob(ctx, x, y, r, r * 0.8);
    }
    // Warm tint where the lanterns light the blossom.
    ctx.globalCompositeOperation = 'source-atop';
    for (const l of lights) {
      const r = g.U * 15;
      const warm = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
      warm.addColorStop(0, 'rgba(217,169,72,0.26)');
      warm.addColorStop(1, 'rgba(217,169,72,0)');
      ctx.fillStyle = warm;
      ctx.fillRect(l.x - r, l.y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  // Sparse blossom clusters hanging in front of the limbs and lantern ropes.
  function paintSprigs(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const cols = ['#cfb2b4', '#e6d3cb', '#a88b95'];
    for (let i = 0; i < 220; i++) {
      const x = rand() * g.W;
      const y = canopyEdge(g, x) + (rand() - 0.5) * g.U * 7;
      ctx.fillStyle = cols[(rand() * cols.length) | 0];
      ctx.globalAlpha = 0.7 + rand() * 0.3;
      const r = g.U * (0.5 + rand() * 0.9);
      blob(ctx, x, y, r, r * 0.8);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- lanterns ----------------------------------------------------------------

  function paintLantern(g, size, tone) {
    const w = Math.max(5, Math.round(g.U * 5.6 * size));
    const h = Math.max(6, Math.round(g.U * 6.8 * size));
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const body = tone ? '#c0492e' : '#e8c46c';
    const heart = tone ? '#e49a52' : '#fbe9b0';
    const cap = Math.max(1, Math.round(h * 0.12));
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.62);
    grad.addColorStop(0, heart);
    grad.addColorStop(1, body);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w / 2, (h - cap * 2) / 2 + cap * 0.6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1a1618';
    ctx.fillRect(w * 0.2, 0, w * 0.6, cap);
    ctx.fillRect(w * 0.2, h - cap, w * 0.6, cap);
    ctx.fillStyle = 'rgba(60,34,20,0.55)';
    for (let k = 1; k < 4; k++) ctx.fillRect(1, (h * k) / 4, w - 2, 1);
    return c;
  }

  function paintGlow(g) {
    const r = Math.round(g.U * 9);
    const c = layer(r * 2, r * 2);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(236,190,96,0.5)');
    grad.addColorStop(0.45, 'rgba(217,169,72,0.3)');
    grad.addColorStop(1, 'rgba(217,169,72,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, r * 2, r * 2);
    return c;
  }

  function makeStrings(g) {
    return STRINGS.map((st, s) => {
      const pts = [];
      for (let i = 0; i < st.n; i++) pts.push(lanternAt(g, s, i, { x: 0, y: 0 }));
      return {
        ax: st.x0 * g.W,
        ay: st.y0 * g.H,
        bx: st.x1 * g.W,
        by: st.y1 * g.H,
        pts,
        px: new Float32Array(st.n),
        py: new Float32Array(st.n),
        sprites: [paintLantern(g, st.size, (s + 1) % 2), paintLantern(g, st.size, s % 2)],
      };
    });
  }

  function drawStrings(ctx, g, t, glow, sway) {
    for (let s = 0; s < state.strings.length; s++) {
      const str = state.strings[s];
      const n = str.pts.length;
      for (let i = 0; i < n; i++) {
        const p = str.pts[i];
        const swing = Math.sin(t * 0.7 + i * 0.9 + s * 1.7) + 0.5 * Math.sin(t * 1.3 + i * 2.1);
        str.px[i] = p.x + swing * g.U * 0.5 * sway;
        str.py[i] = p.y + Math.abs(swing) * g.U * 0.1 * sway;
      }
      ctx.strokeStyle = '#2a2224';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(str.ax, str.ay);
      for (let i = 0; i < n; i++) ctx.lineTo(str.px[i], str.py[i] - g.U * 0.5);
      ctx.lineTo(str.bx, str.by);
      ctx.stroke();
      const art = str.sprites[0];
      const glowSize = state.glow.width * (0.75 + 0.25 * STRINGS[s].size);
      for (let i = 0; i < n; i++) {
        const sprite = str.sprites[i % 2];
        const flick = 0.88 + 0.12 * Math.sin(t * 1.1 + i * 2.3 + s);
        ctx.globalAlpha = Math.min(1, 0.85 * glow * flick);
        ctx.drawImage(state.glow, str.px[i] - glowSize / 2, str.py[i] + art.height * 0.5 - glowSize / 2, glowSize, glowSize);
        ctx.globalAlpha = 1;
        ctx.drawImage(sprite, str.px[i] - sprite.width / 2, str.py[i]);
      }
    }
  }

  // ---- petals ---------------------------------------------------------------------

  function makePetals(g, rand) {
    const list = [];
    for (let i = 0; i < MAX_PETALS; i++) {
      list.push({
        x: rand() * g.W,
        y: rand() * g.H * 0.95,
        speed: g.U * (2.2 + rand() * 2.4),
        drift: g.U * (0.5 + rand() * 1.1),
        phase: rand() * TAU,
        wob: 0.5 + rand() * 1.2,
        big: rand() < 0.35,
        pale: rand() < 0.6,
      });
    }
    return list;
  }

  function drawPetals(ctx, g, t, amount) {
    const count = Math.min(MAX_PETALS, Math.round(PETALS * amount));
    const span = g.H * 1.05;
    for (let i = 0; i < count; i++) {
      const p = state.petals[i];
      const y = (p.y + t * p.speed) % span;
      const x = (p.x + t * p.drift * 0.7 + Math.sin(t * p.wob + p.phase) * g.U * 2.4 + g.W * 2) % g.W;
      const fade = y < g.U * 4 ? y / (g.U * 4) : 1;
      ctx.globalAlpha = 0.85 * fade;
      ctx.fillStyle = p.pale ? '#efe2d6' : '#d4b4b2';
      const flip = Math.sin(t * 2.4 + p.phase) > 0;
      ctx.fillRect(x, y, p.big ? (flip ? 2 : 1) : 1, p.big ? (flip ? 1 : 2) : 1);
    }
    ctx.globalAlpha = 1;
  }

  // ---- scene -------------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    const lights = lanternList(g);
    state.g = g;
    state.sky = paintSky(g, rand);
    state.hills = paintHills(g);
    state.ground = paintGround(g, rand, lights);
    state.toro = paintToro(g);
    state.bench = paintBench(g, rand);
    state.canopy = paintCanopy(g, rand, lights);
    state.limbs = paintLimbs(g);
    state.sprigs = paintSprigs(g, rand);
    state.glow = paintGlow(g);
    state.strings = makeStrings(g);
    state.petals = makePetals(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { petals, glow, sway } = api.props;
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.hills, 0, 0);
    ctx.drawImage(state.ground, 0, 0);
    ctx.drawImage(state.toro, 0, 0);
    ctx.drawImage(state.bench, 0, 0);
    ctx.drawImage(state.canopy, 0, 0);
    ctx.drawImage(state.limbs, 0, 0);
    drawStrings(ctx, g, t, glow, sway);
    ctx.drawImage(state.sprigs, 0, 0);
    drawPetals(ctx, g, t, petals);
  }

  Kasuri.run({
    defaults: { petals: 1, glow: 1, sway: 1, ramp: 'lines', cell: 7, boost: 0.3, gain: 1.3, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
