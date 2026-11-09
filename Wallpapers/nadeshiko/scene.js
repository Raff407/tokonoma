/*
 * 撫子 Nadeshiko — fringed pink pinks in a summer meadow at dusk.
 *
 * Sky, Fuji, ridges, the stone lantern and the grass are baked once. Each flower
 * stem is its own small sprite, turned about its foot by a slow breeze. A few
 * butterflies and fireflies drift over the top.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;
  const TAU = Math.PI * 2;

  const HORIZON = 0.5;
  const MAX_STEMS = 60;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- backdrop ----------------------------------------------------------

  function paintSky(ctx, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, '#2c3560');
    grad.addColorStop(0.5, '#6a5f86');
    grad.addColorStop(0.8, '#d49a7c');
    grad.addColorStop(1, '#e6c08a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    const sun = ctx.createRadialGradient(g.W * 0.24, g.H * HORIZON, 0, g.W * 0.24, g.H * HORIZON, g.W * 0.28);
    sun.addColorStop(0, 'rgba(240,206,140,0.7)');
    sun.addColorStop(1, 'rgba(240,206,140,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, g.W, g.H * HORIZON);
    // a few thin bands of cloud, lit from below
    ctx.fillStyle = 'rgba(226,150,120,0.35)';
    for (let i = 0; i < 5; i++) {
      const y = g.H * (0.16 + i * 0.05);
      const x = g.W * ((i * 0.37) % 0.8);
      ctx.fillRect(x, y, g.W * (0.18 + (i % 3) * 0.06), Math.max(1, g.U * 0.5));
    }
  }

  function ridgeY(g, x, base, amp, seed) {
    return base - amp * (fbm(x * 0.012, seed, 3, seed + 3) - 0.3);
  }

  function paintFuji(ctx, g) {
    const px = g.W * 0.7;
    const top = g.H * 0.3;
    const base = g.H * (HORIZON + 0.01);
    ctx.fillStyle = '#6a6a92';
    ctx.beginPath();
    ctx.moveTo(px - g.W * 0.36, base);
    for (let x = px - g.W * 0.36; x <= px + g.W * 0.36; x += 2) {
      const d = Math.max(0, Math.abs(x - px) - g.W * 0.012) / (g.W * 0.36);
      ctx.lineTo(x, base - (base - top) * Math.pow(Math.max(0, 1 - d), 1.9));
    }
    ctx.lineTo(px + g.W * 0.36, base);
    ctx.fill();
    // snow cap
    ctx.fillStyle = '#d9d4dc';
    ctx.beginPath();
    for (let x = px - g.W * 0.12; x <= px + g.W * 0.12; x += 2) {
      const d = Math.max(0, Math.abs(x - px) - g.W * 0.012) / (g.W * 0.36);
      const y = base - (base - top) * Math.pow(Math.max(0, 1 - d), 1.9);
      if (x === px - g.W * 0.12) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let x = px + g.W * 0.12; x >= px - g.W * 0.12; x -= 3) {
      const wob = (fbm(x * 0.2, 1, 2, 5) - 0.5) * g.U * 1.2;
      ctx.lineTo(x, g.H * 0.3 + (base - top) * 0.2 + wob + Math.abs(x - px) * 0.35);
    }
    ctx.fill();
  }

  function paintRidges(ctx, g) {
    const rows = [
      { base: 0.5, amp: 22, col: '#58557f', seed: 3 },
      { base: 0.545, amp: 16, col: '#3f4a6c', seed: 8 },
    ];
    for (const r of rows) {
      ctx.fillStyle = r.col;
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, ridgeY(g, x, g.H * r.base, g.U * r.amp * 0.5, r.seed));
      ctx.lineTo(g.W, g.H);
      ctx.fill();
    }
  }

  function paintMeadow(ctx, g, rand) {
    const top = g.H * 0.56;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, '#5d6a4a');
    grad.addColorStop(0.4, '#41543a');
    grad.addColorStop(1, '#222f27');
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    // warm light along the far edge
    ctx.fillStyle = 'rgba(226,176,110,0.18)';
    ctx.fillRect(0, top, g.W, g.U * 2);
    // grass blades
    const n = Math.floor(g.W * 3);
    for (let i = 0; i < n; i++) {
      const y = top + rand() * (g.H - top);
      const f = (y - top) / (g.H - top);
      const len = g.U * (0.8 + f * 3.5) * (0.6 + rand() * 0.8);
      const x = rand() * g.W;
      ctx.strokeStyle = rand() < 0.5 ? '#2d4030' : (rand() < 0.5 ? '#6b7c52' : '#4b6040');
      ctx.lineWidth = Math.max(1, g.U * (0.2 + f * 0.3));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * len * 0.5, y - len);
      ctx.stroke();
    }
  }

  // Stone lantern, small and far off in the grass.
  function paintLantern(ctx, g) {
    const u = g.U * 1.5;
    const cx = g.W * 0.3;
    const b = g.H * 0.7;
    ctx.fillStyle = '#9a9aa8';
    ctx.fillRect(cx - u * 2.2, b - u * 1.2, u * 4.4, u * 1.2);      // base
    ctx.fillRect(cx - u * 0.7, b - u * 7, u * 1.4, u * 5.8);        // post
    ctx.fillRect(cx - u * 2, b - u * 8.6, u * 4, u * 1.6);          // platform
    ctx.fillStyle = '#b4b2bc';
    ctx.fillRect(cx - u * 1.3, b - u * 11.2, u * 2.6, u * 2.6);     // fire box
    ctx.fillStyle = '#e2b266';
    ctx.fillRect(cx - u * 0.6, b - u * 10.5, u * 1.2, u * 1.4);     // window glow
    ctx.fillStyle = '#9a9aa8';
    ctx.beginPath();                                                 // roof
    ctx.moveTo(cx - u * 3.4, b - u * 11.2);
    ctx.lineTo(cx, b - u * 14.2);
    ctx.lineTo(cx + u * 3.4, b - u * 11.2);
    ctx.fill();
    ctx.fillRect(cx - u * 0.4, b - u * 15.4, u * 0.8, u * 1.4);     // finial
    const halo = ctx.createRadialGradient(cx, b - u * 9.8, 0, cx, b - u * 9.8, u * 6);
    halo.addColorStop(0, 'rgba(232,184,110,0.35)');
    halo.addColorStop(1, 'rgba(232,184,110,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(cx - u * 7, b - u * 16, u * 14, u * 12);
  }

  // ---- flowers -----------------------------------------------------------

  function petal(ctx, r, a0, a1, teeth) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a0) * r * 0.55, Math.sin(a0) * r * 0.55);
    for (let i = 0; i <= teeth; i++) {
      const a = lerp(a0, a1, i / teeth);
      const rr = i % 2 ? r * 0.8 : r;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.lineTo(Math.cos(a1) * r * 0.55, Math.sin(a1) * r * 0.55);
    ctx.closePath();
    ctx.fill();
  }

  function paintBloom(ctx, x, y, r, rand) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rand() * TAU);
    const tint = rand();
    for (let i = 0; i < 5; i++) {
      const a0 = (i / 5) * TAU - 0.05;
      const a1 = ((i + 1) / 5) * TAU + 0.05;
      ctx.fillStyle = tint < 0.5 ? '#d98a9a' : '#cf7488';
      petal(ctx, r, a0, a1, 5);
      ctx.fillStyle = tint < 0.5 ? '#eeb3ba' : '#e49aa8';
      petal(ctx, r * 0.72, a0 + 0.1, a1 - 0.1, 3);
    }
    ctx.fillStyle = '#8a3e56';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.22, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // One plant, drawn standing with its foot at the bottom centre of the canvas.
  function paintStem(h, r, seed) {
    const rand = K.rng(seed);
    const pad = r * 2.2;
    const w = Math.ceil(pad * 2 + r * 4);
    const c = layer(w, h + pad);
    const ctx = c.getContext('2d');
    const cx = w / 2;
    const foot = h + pad;
    const bend = (rand() - 0.5) * r * 0.8;
    ctx.strokeStyle = '#6e8456';
    ctx.lineWidth = Math.max(1, r * 0.22);
    ctx.beginPath();
    ctx.moveTo(cx, foot);
    ctx.quadraticCurveTo(cx + bend, foot - h * 0.5, cx + bend * 0.4, foot - h);
    ctx.stroke();
    // narrow paired leaves
    ctx.strokeStyle = '#5c7448';
    ctx.lineWidth = Math.max(1, r * 0.3);
    for (let i = 1; i <= 3; i++) {
      const y = foot - h * (i * 0.2);
      const len = r * (1.8 - i * 0.2);
      ctx.beginPath();
      ctx.moveTo(cx + bend * i * 0.1, y);
      ctx.lineTo(cx - len, y - len * 0.5);
      ctx.moveTo(cx + bend * i * 0.1, y);
      ctx.lineTo(cx + len, y - len * 0.5);
      ctx.stroke();
    }
    const tx = cx + bend * 0.4;
    const ty = foot - h;
    // a side bloom and a bud, then the main flower
    paintBloom(ctx, tx - r * 1.3, ty + r * 1.1, r * 0.7, rand);
    ctx.fillStyle = '#7a8c5e';
    ctx.beginPath();
    ctx.arc(tx + r * 1.2, ty + r * 1.4, r * 0.35, 0, TAU);
    ctx.fill();
    paintBloom(ctx, tx, ty, r, rand);
    return { img: c, ox: cx, oy: foot };
  }

  function buildStems(g) {
    const rand = K.rng(77);
    const rows = [
      { y: 0.68, h: 12, r: 1.5, n: 14 },
      { y: 0.82, h: 20, r: 2.3, n: 10 },
      { y: 1.0, h: 34, r: 3.4, n: 6 },
    ];
    const list = [];
    for (const row of rows) {
      for (let i = 0; i < row.n; i++) {
        const k = rand();
        const h = g.U * row.h * (0.8 + rand() * 0.45);
        const sp = paintStem(h, g.U * row.r * (0.9 + rand() * 0.2), 1000 + list.length);
        list.push({
          sp,
          x: ((i + k * 0.8) / row.n) * g.W,
          y: g.H * (row.y + (rand() - 0.5) * 0.03),
          phase: rand() * TAU,
          depth: row.r,
        });
      }
    }
    return list.slice(0, MAX_STEMS).sort((a, b) => a.y - b.y);
  }

  // ---- movers ------------------------------------------------------------

  function buildMovers(g) {
    const rand = K.rng(404);
    const bf = [];
    for (let i = 0; i < 4; i++) {
      bf.push({
        cx: g.W * (0.2 + 0.2 * i + rand() * 0.1),
        cy: g.H * (0.6 + rand() * 0.2),
        ax: g.W * (0.05 + rand() * 0.06),
        ay: g.H * (0.03 + rand() * 0.03),
        f: 0.15 + rand() * 0.12,
        ph: rand() * TAU,
        size: g.U * (0.9 + rand() * 0.4),
        gold: i % 2 === 0,
      });
    }
    const ff = [];
    for (let i = 0; i < 10; i++) {
      ff.push({
        x: rand() * g.W,
        y: g.H * (0.58 + rand() * 0.35),
        a: g.U * (1 + rand() * 2),
        f: 0.1 + rand() * 0.1,
        ph: rand() * TAU,
        p: 0.15 + rand() * 0.15,
      });
    }
    return { bf, ff };
  }

  function drawButterfly(ctx, b, t, g) {
    const x = b.cx + Math.sin(t * b.f + b.ph) * b.ax;
    const y = b.cy + Math.sin(t * b.f * 2.3 + b.ph) * b.ay;
    const flap = Math.abs(Math.sin(t * 6 + b.ph));
    const s = b.size;
    ctx.fillStyle = b.gold ? '#e0b45e' : '#e8e0cc';
    ctx.fillRect(x - s * (0.4 + 1.4 * flap), y - s * 0.9, s * (0.4 + 1.4 * flap), s * 1.1);
    ctx.fillRect(x, y - s * 0.9, s * (0.4 + 1.4 * flap), s * 1.1);
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(x - s * 0.15, y - s * 0.8, s * 0.3, s * 1.1);
  }

  function drawFirefly(ctx, f, t, g) {
    const x = f.x + Math.sin(t * f.f + f.ph) * f.a * 3;
    const y = f.y + Math.cos(t * f.f * 1.3 + f.ph) * f.a;
    const glow = 0.5 + 0.5 * Math.sin(t * f.p * TAU * 0.4 + f.ph);
    ctx.globalAlpha = 0.25 + 0.6 * glow;
    ctx.fillStyle = '#e8d890';
    const r = Math.max(1, g.U * 0.5);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 0.15 * glow;
    ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
    ctx.globalAlpha = 1;
  }

  // ---- run ---------------------------------------------------------------

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    const rand = K.rng(12);
    const bg = layer(g.W, g.H);
    const b = bg.getContext('2d');
    paintSky(b, g);
    paintFuji(b, g);
    paintRidges(b, g);
    paintMeadow(b, g, rand);
    paintLantern(b, g);
    state.bg = bg;
    state.stems = buildStems(g);
    state.movers = buildMovers(g);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const p = api.props;
    ctx.drawImage(state.bg, 0, 0);
    const gust = 0.75 + 0.25 * Math.sin(t * 0.23);
    for (let i = 0; i < state.stems.length; i++) {
      const s = state.stems[i];
      const wave = Math.sin(t * 0.9 + s.x * 0.03 + s.phase * 0.3) + 0.4 * Math.sin(t * 1.7 + s.phase);
      const ang = wave * 0.05 * p.sway * gust * (0.7 + s.depth * 0.2);
      ctx.setTransform(Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), s.x, s.y);
      ctx.drawImage(s.sp.img, -s.sp.ox, -s.sp.oy);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const nb = Math.min(state.movers.bf.length, Math.round(p.butterflies * 2));
    for (let i = 0; i < nb; i++) drawButterfly(ctx, state.movers.bf[i], t, g);
    if (p.fireflies) for (let i = 0; i < state.movers.ff.length; i++) drawFirefly(ctx, state.movers.ff[i], t, g);
  }

  Kasuri.run({
    defaults: { sway: 1, butterflies: 1, fireflies: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
