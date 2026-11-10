/*
 * 孔明灯 Kongming — paper sky lanterns rising over a quiet river village at night.
 *
 * Sky, ridges, houses, pagoda, bridge and river are baked once (and again on resize).
 * Each frame lays down the river rows, then a fixed pool of lanterns that climb and
 * sway, each with its own small glow and a faint copy on the water.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, smoothstep } = K;

  const WATER = 0.7;
  const MAX_LANTERNS = 28;
  const ROW = 2;
  const INK = '#171b2a';
  const INDIGO = '#2a3866';
  const WASHI = '#9a9a96';
  const GOLD = '#d9a73a';
  const VERMILION = '#c8453a';
  const MOSS = '#3a4a34';
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function poly(ctx, pts, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * WATER);
    grad.addColorStop(0, '#10142a');
    grad.addColorStop(0.55, '#283a70');
    grad.addColorStop(1, '#5a6a98');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    const rand = rng(7);
    ctx.fillStyle = '#e8e2d0';
    for (let i = 0; i < g.W * 0.5; i++) {
      ctx.globalAlpha = 0.15 + rand() * 0.45;
      ctx.fillRect(Math.floor(rand() * g.W), Math.floor(rand() * g.H * 0.5), 1, 1);
    }
    ctx.globalAlpha = 1;
    // A pale full moon, low on the left.
    const mx = g.W * 0.2;
    const my = g.H * 0.2;
    const halo = ctx.createRadialGradient(mx, my, 0, mx, my, g.U * 14);
    halo.addColorStop(0, 'rgba(232,226,208,0.35)');
    halo.addColorStop(1, 'rgba(232,226,208,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - g.U * 14, my - g.U * 14, g.U * 28, g.U * 28);
    ctx.fillStyle = '#e8e2d0';
    ctx.beginPath();
    ctx.arc(mx, my, g.U * 3.6, 0, Math.PI * 2);
    ctx.fill();
    return c;
  }

  // ---- land --------------------------------------------------------------

  function ridgeLine(ctx, g, base, amp, seed, color, freq) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, g.H * WATER);
    for (let x = 0; x <= g.W; x += 2) {
      const n = fbm(x * freq, seed, 4, seed);
      ctx.lineTo(x, g.H * base - n * g.H * amp);
    }
    ctx.lineTo(g.W, g.H * WATER);
    ctx.closePath();
    ctx.fill();
  }

  // Whitewashed house with a stepped horse-head gable and a dark tiled roof.
  function house(ctx, g, x, base, w, h, tier) {
    const u = g.U * 1.25;
    const wall = tier > 0 ? '#8a8c92' : '#b4b2a8';
    ctx.fillStyle = wall;
    ctx.fillRect(x, base - h, w, h);
    // Stepped gables at both ends, rising above the roof line.
    const step = u * 0.9;
    for (let s = 0; s < 3; s++) {
      const inset = s * step;
      ctx.fillStyle = wall;
      ctx.fillRect(x - u * 0.2, base - h - (3 - s) * step + step, step * 1.1, (3 - s) * step);
      ctx.fillRect(x + w - step * 0.9 + u * 0.2, base - h - (3 - s) * step + step, step * 1.1, (3 - s) * step);
      void inset;
    }
    // Roof with slightly lifted eaves.
    poly(ctx, [
      [x - u * 1.3, base - h + u * 0.2],
      [x + step, base - h - u * 1.7],
      [x + w - step, base - h - u * 1.7],
      [x + w + u * 1.3, base - h + u * 0.2],
      [x + w + u * 0.2, base - h + u * 0.9],
      [x - u * 0.2, base - h + u * 0.9],
    ], '#1a1e32');
    // Tile rows.
    ctx.fillStyle = '#4a5478';
    for (let r = 0; r < 2; r++) {
      ctx.fillRect(x + step, base - h - u * 1.2 + r * u * 0.7, w - step * 2, 1);
    }
    // Dark windows, a few with a warm light.
    const rand = rng(Math.floor(x * 13 + base));
    const cols = Math.max(1, Math.floor(w / (u * 3.2)));
    for (let i = 0; i < cols; i++) {
      const wx = x + (i + 0.5) * (w / cols) - u * 0.5;
      ctx.fillStyle = rand() < 0.3 ? '#a8803a' : '#1c2030';
      ctx.fillRect(wx, base - h * 0.62, u * 1.0, u * 1.5);
    }
  }

  function paintPagoda(ctx, g, cx, base) {
    const u = g.U;
    ctx.fillStyle = '#12162a';
    let y = base;
    let w = u * 6;
    ctx.fillRect(cx - w * 0.5, y - u * 3, w, u * 3);
    y -= u * 3;
    for (let t = 0; t < 5; t++) {
      const bw = w * (1 - t * 0.14);
      poly(ctx, [
        [cx - bw * 0.75, y],
        [cx - bw * 0.35, y - u * 1.1],
        [cx + bw * 0.35, y - u * 1.1],
        [cx + bw * 0.75, y],
      ], '#12162a');
      ctx.fillRect(cx - bw * 0.3, y - u * 3.1, bw * 0.6, u * 2.2);
      y -= u * 3;
    }
    ctx.fillRect(cx - 0.5, y - u * 3.5, 1.5, u * 3.5);
    ctx.fillStyle = '#a8803a';
    ctx.fillRect(cx - u * 0.2, base - u * 11.4, u * 0.4, u * 0.8);
  }

  function paintBridge(ctx, g, x0, x1, deck) {
    const u = g.U;
    const water = g.H * WATER;
    ctx.fillStyle = '#242a40';
    const mid = (x0 + x1) / 2;
    const half = (x1 - x0) / 2;
    ctx.beginPath();
    ctx.moveTo(x0, water + u);
    ctx.lineTo(x0, deck + u * 1.5);
    ctx.quadraticCurveTo(mid, deck - u * 2.5, x1, deck + u * 1.5);
    ctx.lineTo(x1, water + u);
    ctx.closePath();
    ctx.fill();
    // Arch opening.
    ctx.fillStyle = '#10142a';
    ctx.beginPath();
    ctx.moveTo(mid - half * 0.6, water + u);
    ctx.quadraticCurveTo(mid - half * 0.55, deck + u * 2.2, mid, deck + u * 2.2);
    ctx.quadraticCurveTo(mid + half * 0.55, deck + u * 2.2, mid + half * 0.6, water + u);
    ctx.closePath();
    ctx.fill();
    // Low parapet along the crown.
    ctx.strokeStyle = '#3a4260';
    ctx.lineWidth = Math.max(1, u * 0.35);
    ctx.beginPath();
    ctx.moveTo(x0, deck + u * 0.4);
    ctx.quadraticCurveTo(mid, deck - u * 3.2, x1, deck + u * 0.4);
    ctx.stroke();
  }

  // Bamboo stems and a willow on the near bank.
  function paintBank(ctx, g) {
    const u = g.U;
    const water = g.H * WATER;
    ctx.fillStyle = '#171d30';
    ctx.beginPath();
    ctx.moveTo(0, water);
    ctx.lineTo(0, g.H * 0.93);
    for (let x = 0; x <= g.W * 0.3; x += 4) {
      ctx.lineTo(x, water + u * 4 + fbm(x * 0.03, 3, 3, 3) * u * 6);
    }
    ctx.lineTo(g.W * 0.3, water);
    ctx.closePath();
    ctx.fill();
    ctx.lineCap = 'round';
    const rand = rng(41);
    for (let i = 0; i < 9; i++) {
      const bx = g.W * (0.01 + rand() * 0.22);
      const top = g.H * (0.5 + rand() * 0.1);
      ctx.strokeStyle = MOSS;
      ctx.lineWidth = Math.max(1, u * 0.45);
      ctx.beginPath();
      ctx.moveTo(bx, water + u * 4);
      ctx.quadraticCurveTo(bx + u * 0.8, (top + water) / 2, bx + u * (rand() * 2 - 0.5), top);
      ctx.stroke();
      ctx.fillStyle = '#34452f';
      for (let k = 0; k < 4; k++) {
        const ly = top + k * u * 3.2 + u;
        poly(ctx, [[bx, ly], [bx + u * 3.2, ly + u * 1.2], [bx + u * 0.4, ly + u * 0.6]], '#34452f');
        poly(ctx, [[bx, ly + u], [bx - u * 3, ly + u * 2.2], [bx - u * 0.3, ly + u * 1.5]], '#34452f');
      }
    }
  }

  function paintWorld(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const water = g.H * WATER;
    const u = g.U;
    ridgeLine(ctx, g, 0.62, 0.13, 5, '#3c4a7c', 0.012);
    ridgeLine(ctx, g, 0.665, 0.1, 9, '#2c3862', 0.018);
    // Far pagoda on the second ridge.
    paintPagoda(ctx, g, g.W * 0.78, g.H * 0.62);
    // Village along the far bank in two rows.
    ctx.fillStyle = '#222c4c';
    ctx.fillRect(0, water - u * 2, g.W, u * 2);
    const rand = rng(3);
    const spans = [[0.22, 0.55], [0.64, 0.86]];
    spans.forEach(([a, b], si) => {
      let x = g.W * a;
      while (x < g.W * b) {
        const w = u * (10 + rand() * 7);
        const h = u * (6 + rand() * 3);
        house(ctx, g, x, water - u * 0.6 - (si ? 0 : 0), w, h, rand() < 0.4 ? 1 : 0);
        x += w + u * (0.6 + rand() * 1.2);
      }
    });
    paintBridge(ctx, g, g.W * 0.56, g.W * 0.63, water - u * 4.4);
    // Bright, still river.
    const rg = ctx.createLinearGradient(0, water, 0, g.H);
    rg.addColorStop(0, '#46568a');
    rg.addColorStop(1, '#1a2244');
    ctx.fillStyle = rg;
    ctx.fillRect(0, water + u * 0.6, g.W, g.H - water);
    // Boats drawn as dark slivers with a single warm light.
    ctx.fillStyle = '#0c0f1c';
    const bx = g.W * 0.4;
    const by = water + u * 7;
    poly(ctx, [[bx, by], [bx + u * 9, by], [bx + u * 8, by + u * 1.1], [bx + u * 1, by + u * 1.1]], '#0c0f1c');
    poly(ctx, [[bx + u * 2.5, by], [bx + u * 3.2, by - u * 1.6], [bx + u * 6.2, by - u * 1.6], [bx + u * 6.9, by]], '#161a2c');
    ctx.fillStyle = GOLD;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(bx + u * 4.2, by - u * 1.1, u * 0.9, u * 0.8);
    ctx.globalAlpha = 1;
    paintBank(ctx, g);
    return c;
  }

  // Land above the river flipped and laid back in dim rows.
  function paintMirror(g, world) {
    const water = Math.floor(g.H * WATER);
    const h = g.H - water;
    const c = layer(g.W + 16, h);
    const ctx = c.getContext('2d');
    ctx.translate(8, h);
    ctx.scale(1, -1);
    ctx.drawImage(world, 0, water - h, g.W, h, 0, 0, g.W, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(14,18,38,0.35)';
    ctx.fillRect(0, 0, c.width, h);
    return c;
  }

  // ---- lanterns ----------------------------------------------------------

  // Soft halo, drawn under every lantern.
  function paintHalo() {
    const c = layer(64, 64);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(235,170,70,0.55)');
    grad.addColorStop(0.4, 'rgba(210,130,50,0.2)');
    grad.addColorStop(1, 'rgba(200,110,40,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return c;
  }

  // A square paper lantern, wider at the open mouth below, with a lit flame at its base.
  function paintLantern(tone) {
    const w = 24;
    const h = 36;
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const body = ctx.createLinearGradient(0, 0, 0, h);
    body.addColorStop(0, tone ? '#c46a32' : '#b8742f');
    body.addColorStop(0.55, tone ? '#f0b050' : '#ecc064');
    body.addColorStop(1, tone ? '#d98a3a' : '#d9a73a');
    poly(ctx, [[4, 2], [w - 4, 2], [w - 1, h - 6], [1, h - 6]], body);
    // Folded paper ribs and a darker band at the top.
    ctx.fillStyle = 'rgba(120,50,20,0.35)';
    ctx.fillRect(w / 2 - 0.5, 2, 1, h - 8);
    ctx.fillRect(6, 3, 1, h - 10);
    ctx.fillRect(w - 7, 3, 1, h - 10);
    ctx.fillStyle = 'rgba(110,40,20,0.5)';
    ctx.fillRect(4, 2, w - 8, 3);
    ctx.fillStyle = 'rgba(110,40,20,0.35)';
    ctx.fillRect(2, h - 9, w - 4, 2);
    // Warm light at the mouth.
    const flame = ctx.createRadialGradient(w / 2, h - 5, 0, w / 2, h - 5, 7);
    flame.addColorStop(0, 'rgba(255,230,160,0.95)');
    flame.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = flame;
    ctx.fillRect(0, h - 14, w, 14);
    ctx.fillStyle = '#3a2418';
    ctx.fillRect(2, h - 6, w - 4, 2);
    return c;
  }

  function seedLanterns(g, count) {
    const rand = rng(99);
    const list = [];
    for (let i = 0; i < MAX_LANTERNS; i++) {
      list.push({
        x: g.W * (0.06 + 0.88 * (((i * 11) % MAX_LANTERNS) + rand()) / MAX_LANTERNS),
        phase: ((i * 7) % MAX_LANTERNS) / MAX_LANTERNS + rand() * 0.02,
        rise: 0.012 + rand() * 0.012,
        size: 0.55 + rand() * 0.9,
        sway: rand() * 6.28,
        tone: rand() < 0.35 ? 1 : 0,
        depth: 0,
      });
    }
    list.forEach((l) => { l.depth = l.size; });
    return list.slice(0, count);
  }

  function drawMirror(ctx, g, t, on) {
    const water = Math.floor(g.H * WATER);
    ctx.drawImage(state.world, 0, 0);
    if (!on) return;
    const m = state.mirror;
    const rows = Math.floor(m.height / ROW);
    for (let r = 0; r < rows; r++) {
      const fade = 1 - r / rows;
      const dx = Math.sin(t * 0.9 + r * 0.55) * g.U * 0.35 * (0.4 + (r / rows));
      ctx.globalAlpha = 0.55 * fade + 0.15;
      ctx.drawImage(m, 0, r * ROW, m.width, ROW, -8 + dx, water + r * ROW, m.width, ROW);
    }
    ctx.globalAlpha = 1;
  }

  function drawLanterns(ctx, g, t, api) {
    const count = Math.round(api.props.lanterns);
    const water = g.H * WATER;
    const reflect = api.props.reflections;
    const span = g.H * 1.0;
    const top = -g.U * 8;
    for (let i = 0; i < count; i++) {
      const l = state.lanterns[i % state.lanterns.length];
      const p = (t * l.rise + l.phase) % 1;
      const ys = water - g.U * 2 - p * (water + g.U * 8 - top);
      const sway = Math.sin(t * 0.35 + l.sway) * g.U * 1.6 + Math.sin(t * 0.17 + l.sway * 2) * g.U;
      const x = l.x + sway + p * g.U * 4;
      const sc = (g.U / 2.4) * l.size * (0.75 + 0.25 * (1 - p));
      const w = 24 * sc;
      const h = 36 * sc;
      const edge = Math.min(smoothstep(0, 0.06, p), 1 - smoothstep(0.88, 1, p));
      const pulse = 0.94 + Math.sin(t * 1.3 + l.sway * 3) * 0.06;
      ctx.globalAlpha = edge * pulse;
      const gh = w * 3.4;
      ctx.drawImage(state.halo, x - gh / 2, ys - h * 0.35 - gh / 2, gh, gh);
      ctx.drawImage(state.paper[l.tone], x - w / 2, ys - h / 2, w, h);
      if (reflect && ys < water) {
        const depthBelow = water + (water - ys) * 0.28;
        ctx.globalAlpha = edge * 0.3 * (1 - p * 0.6);
        const rw = w * 0.9 + Math.sin(t * 1.7 + i) * w * 0.12;
        ctx.drawImage(state.halo, x - rw, depthBelow - rw * 0.4, rw * 2, rw * 0.8);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- loop --------------------------------------------------------------

  function rebuild(api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.sky = paintSky(g);
    state.world = paintWorld(g);
    state.mirror = paintMirror(g, state.world);
    state.halo = paintHalo();
    state.paper = [paintLantern(0), paintLantern(1)];
    state.lanterns = seedLanterns(g, MAX_LANTERNS);
    state.key = g.W + 'x' + g.H;
  }

  function setup(ctx, api) {
    rebuild(api);
  }

  function draw(ctx, t, dt, api) {
    if (state.key !== api.cols + 'x' + api.rows) rebuild(api);
    const g = state.g;
    ctx.drawImage(state.sky, 0, 0);
    drawMirror(ctx, g, t, api.props.reflections);
    drawLanterns(ctx, g, t, api);
  }

  Kasuri.run({
    defaults: { lanterns: 16, reflections: true, ramp: 'lines', cell: 7, boost: 0.14, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
