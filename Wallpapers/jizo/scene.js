/*
 * 地蔵 Jizo — small stone guardians in red knitted caps beside a forest path.
 *
 * The wood, the path and the statues are flat shapes baked once into one layer.
 * Each frame slides two sun-fleck tiles across the ground, spins a few paper
 * pinwheels and tumbles a couple of dozen leaves, all short paths, nothing allocated.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const WOOD = {
    far: '#7d9465', farTrunk: '#6b8159', hazeTrunk: '#919f6d', glowOut: '#a9b078', glowMid: '#cbc28a', glowIn: '#e8daa4',
    mid: '#52714a', leafLit: '#6c8c53', leafDark: '#42603f', canopy: '#38533a',
    hedge: '#38543a', hedgeLit: '#557747',
  };
  const BARK = { base: '#5b4936', lit: '#86704e', dark: '#3f3429' };
  const GROUND = { moss: '#5f7d41', dark: '#4e6b3c', lit: '#7e9b50', shadow: '#435b37' };
  const PATH = { base: '#a99571', lit: '#c8b68b', edge: '#83704f', pebble: '#d6c9a4' };
  const STONE = { lit: '#d4cdb3', mid: '#aca78f', shade: '#86836e', line: '#635e4b', lichen: '#a0a46e' };
  const REDS = [
    { main: '#d0472f', lit: '#e66a4a', dark: '#9b3322' },
    { main: '#c4402e', lit: '#de5f43', dark: '#913022' },
    { main: '#d65236', lit: '#ec7752', dark: '#a33826' },
  ];
  const MOSS = ['#6d8d41', '#8eaa55', '#577a3a'];
  const PAPER = [
    ['#e05a3c', '#f1e4c4'],
    ['#e8bb48', '#c3482f'],
    ['#5b86b8', '#efe2bd'],
    ['#d97a94', '#f3e3c0'],
    ['#6ea488', '#e9d58e'],
    ['#f0e6cc', '#4d73a8'],
  ];
  const LEAF = ['#d9a93f', '#c9792f', '#bb4a2c', '#e6c763', '#a8622c'];
  const MAX_LEAVES = 48;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // A filled band between two edge functions, sampled every couple of cells.
  function band(ctx, x0, x1, top, bottom) {
    ctx.beginPath();
    ctx.moveTo(x0, top(x0));
    for (let x = x0; x <= x1 + 2; x += 2) ctx.lineTo(x, top(x));
    for (let x = x1 + 2; x >= x0 - 2; x -= 2) ctx.lineTo(x, bottom(x));
    ctx.fill();
  }

  // An irregular round shape whose radius wobbles with noise.
  function blob(ctx, cx, cy, rx, ry, seed, rough) {
    ctx.beginPath();
    for (let k = 0; k <= 48; k++) {
      const a = (k / 48) * 6.2832;
      const r = 1 + (fbm(Math.cos(a) * 1.4 + 3, Math.sin(a) * 1.4 + 3, 3, seed) - 0.5) * rough;
      const x = cx + Math.cos(a) * rx * r;
      const y = cy + Math.sin(a) * ry * r;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.fill();
  }

  function scatter(ctx, rand, cx, cy, rx, ry, count, tones, size) {
    for (let i = 0; i < count; i++) {
      const a = rand() * 6.2832;
      const d = Math.sqrt(rand());
      const s = size * (0.5 + rand());
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      ctx.fillRect(cx + Math.cos(a) * d * rx, cy + Math.sin(a) * d * ry, Math.max(1, s * 1.4), Math.max(1, s));
    }
  }

  function backY(g, x) {
    return g.H * 0.58 + (fbm(x * 0.05, 2, 3, 5) - 0.5) * g.U * 4;
  }

  // Centre and half width of the path at a given height; it bends left, then away.
  function pathAt(g, y) {
    const p = Math.min(1, Math.max(0, (g.H - y) / (g.H * 0.43)));
    const cx = g.W * 0.83 - g.U * 10 * Math.sin(p * Math.PI) + g.U * 4 * p;
    return { cx, hw: g.U * lerp(26, 1.2, Math.pow(p, 0.7)) };
  }

  // The bright opening where the path leaves the wood. Foliage drawn over it
  // gives it a ragged edge, so it never shows a shape of its own.
  function paintGlow(ctx, g, rand) {
    const cx = g.W * 0.85;
    const cy = g.H * 0.43;
    const rx = g.W * 0.07 + g.U * 18;
    const ry = g.H * 0.3;
    ctx.fillStyle = WOOD.glowOut;
    blob(ctx, cx, cy, rx, ry, 40, 0.5);
    ctx.fillStyle = WOOD.glowMid;
    blob(ctx, cx + g.U * 2, cy + g.H * 0.05, rx * 0.66, ry * 0.62, 41, 0.6);
    ctx.fillStyle = WOOD.glowIn;
    blob(ctx, cx + g.U * 2, cy + g.H * 0.12, rx * 0.4, ry * 0.26, 42, 0.5);
    for (let i = 0; i < 5; i++) {
      const x = cx + (i / 4 - 0.5) * rx * 1.5 + (rand() - 0.5) * g.U * 4;
      if (Math.abs(x - cx - g.U * 2) < g.U * 4) continue;
      ctx.fillStyle = WOOD.hazeTrunk;
      ctx.fillRect(x, cy - ry, g.U * (0.5 + rand() * 0.8), ry * 1.5);
    }
    state.glow = { x: cx, y: cy, rx, ry };
  }

  function paintWood(ctx, g, rand) {
    ctx.fillStyle = WOOD.far;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = WOOD.farTrunk;
    for (let i = 0; i < g.W / (g.U * 10); i++) {
      ctx.fillRect(rand() * g.W, 0, g.U * (1 + rand() * 1.4), g.H * 0.62);
    }
    paintGlow(ctx, g, rand);
    const glow = state.glow;
    const clumps = Math.round(g.W / (g.U * 4));
    for (let i = 0; i < clumps; i++) {
      const x = (i / clumps) * g.W * 1.04 + (rand() - 0.5) * g.U * 6;
      const y = g.H * (0.1 + rand() * 0.42);
      const dx = (x - glow.x) / glow.rx;
      const dy = (y - glow.y) / glow.ry;
      const inside = Math.sqrt(dx * dx + dy * dy);
      if (inside < 0.55) continue;
      const k = inside < 1.1 ? 0.55 : 1;
      ctx.fillStyle = WOOD.mid;
      blob(ctx, x, y, g.U * (7 + rand() * 6) * k, g.U * (6 + rand() * 5) * k, i, 0.8);
      scatter(ctx, rand, x + g.U * 2, y - g.U * 2, g.U * 7 * k, g.U * 5 * k, 24, [WOOD.leafLit, WOOD.leafDark], g.U * 0.9);
    }
  }

  function paintCanopy(ctx, g, rand) {
    ctx.fillStyle = WOOD.canopy;
    band(ctx, -2, g.W, () => -2, (x) => g.H * (0.12 + 0.1 * fbm(x * 0.03, 7, 3, 9)) + Math.sin(x * 0.4) * g.U);
    for (let i = 0; i < g.W / (g.U * 3); i++) {
      const x = rand() * g.W;
      scatter(ctx, rand, x, g.H * rand() * 0.16, g.U * 5, g.U * 3, 18, [WOOD.leafLit, WOOD.leafDark], g.U * 0.9);
    }
  }

  function paintTrunk(ctx, g, rand, fx, width) {
    const x = g.W * fx;
    const w = g.U * width;
    const foot = backY(g, x) + g.U * 1.5;
    ctx.fillStyle = BARK.base;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.42, 0);
    ctx.lineTo(x + w * 0.42, 0);
    ctx.lineTo(x + w * 0.5, foot - w);
    ctx.quadraticCurveTo(x + w * 0.55, foot, x + w * 1.1, foot);
    ctx.lineTo(x - w * 1.1, foot);
    ctx.quadraticCurveTo(x - w * 0.55, foot, x - w * 0.5, foot - w);
    ctx.fill();
    ctx.fillStyle = BARK.dark;
    ctx.fillRect(x - w * 0.45, 0, w * 0.28, foot - w * 0.5);
    ctx.fillStyle = BARK.lit;
    ctx.fillRect(x + w * 0.16, 0, w * 0.24, foot - w * 0.6);
    for (let i = 0; i < foot / (g.U * 1.4); i++) {
      ctx.fillStyle = rand() < 0.5 ? BARK.dark : BARK.lit;
      ctx.fillRect(x - w * 0.4 + rand() * w * 0.8, rand() * foot, Math.max(1, g.U * 0.45), g.U * (2 + rand() * 6));
    }
  }

  function paintHedge(ctx, g, rand) {
    const end = g.W * 0.74;
    const top = (x) => g.H * (0.4 + 0.12 * smoothstep(end * 0.6, end, x)) - fbm(x * 0.06, 3, 3, 21) * g.U * 7;
    ctx.fillStyle = WOOD.hedge;
    band(ctx, -2, end, top, (x) => backY(g, x) + g.U * 2);
    ctx.beginPath();
    ctx.ellipse(end, g.H * 0.56, g.U * 8, g.U * 6, 0, 0, 6.3);
    ctx.fill();
    for (let x = 0; x < end; x += g.U * 3) {
      scatter(ctx, rand, x, top(x) + g.U * 4, g.U * 3, g.U * 3, 10, [WOOD.hedgeLit, WOOD.leafDark], g.U * 0.9);
    }
  }

  function paintGround(ctx, g, rand) {
    ctx.fillStyle = GROUND.moss;
    band(ctx, -2, g.W, (x) => backY(g, x), () => g.H + 2);
    for (let i = 0; i < 18; i++) {
      const tone = i % 3 === 0 ? GROUND.lit : GROUND.dark;
      ctx.fillStyle = tone;
      const y = lerp(g.H * 0.62, g.H, rand());
      blob(ctx, rand() * g.W, y, g.U * (6 + rand() * 12), g.U * (0.8 + rand() * 1.4), 60 + i, 0.6);
    }
    paintPath(ctx, g, rand);
  }

  function paintPath(ctx, g, rand) {
    const edge = (side, inset) => (y) => {
      const p = pathAt(g, y);
      return p.cx + side * p.hw * inset + (fbm(y * 0.2, side * 4, 2, 31) - 0.5) * g.U * 2;
    };
    const tones = [PATH.edge, PATH.base, PATH.lit];
    const insets = [1.08, 0.94, 0.45];
    for (let i = 0; i < 3; i++) {
      const left = edge(-1, insets[i]);
      const right = edge(1, insets[i]);
      ctx.fillStyle = tones[i];
      ctx.beginPath();
      for (let y = g.H + 2; y >= g.H * 0.57; y -= 1) ctx.lineTo(left(y), y);
      for (let y = g.H * 0.57; y <= g.H + 2; y += 1) ctx.lineTo(right(y), y);
      ctx.fill();
    }
    for (let i = 0; i < 60; i++) {
      const y = lerp(g.H * 0.6, g.H, Math.sqrt(rand()));
      const p = pathAt(g, y);
      const r = g.U * (0.3 + ((y - g.H * 0.6) / g.H) * 2.2);
      ctx.fillStyle = i % 3 ? PATH.edge : PATH.pebble;
      ctx.fillRect(p.cx + (rand() - 0.5) * p.hw * 1.8, y, Math.max(1, r * 1.6), Math.max(1, r));
    }
  }

  function paintFallen(ctx, g, rand) {
    const count = Math.round(g.W * 1.4);
    for (let i = 0; i < count; i++) {
      const x = rand() * g.W;
      const y = lerp(backY(g, x) + g.U, g.H, Math.sqrt(rand()));
      const d = (y - g.H * 0.58) / (g.H * 0.42);
      const s = g.U * (0.4 + d * 1.1);
      ctx.fillStyle = LEAF[Math.floor(rand() * LEAF.length)];
      ctx.fillRect(x, y, Math.max(1, s * 1.5), Math.max(1, s * 0.75));
    }
  }


  // Statues are drawn in their own unit u, from the ground under the pedestal.
  function paintPedestal(ctx, rand, x, y, u) {
    ctx.fillStyle = GROUND.shadow;
    ctx.beginPath();
    ctx.ellipse(x - u * 7, y + u * 0.4, u * 17, u * 2.6, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = STONE.mid;
    ctx.fillRect(x - u * 12, y - u * 6, u * 24, u * 6.4);
    ctx.fillStyle = STONE.shade;
    ctx.fillRect(x - u * 12, y - u * 6, u * 5, u * 6.4);
    ctx.fillStyle = STONE.lit;
    ctx.fillRect(x - u * 12, y - u * 6, u * 24, Math.max(1, u * 1.3));
    ctx.fillRect(x + u * 7, y - u * 6, u * 5, u * 6.4);
    for (let i = 0; i < 4; i++) {
      const mx = x + (rand() - 0.5) * u * 22;
      ctx.fillStyle = MOSS[2];
      ctx.beginPath();
      ctx.ellipse(mx, y - u * 5.6, u * (1.6 + rand() * 1.6), u * 0.9, 0, 0, 6.3);
      ctx.fill();
      scatter(ctx, rand, mx, y - u * 5.4, u * 2.2, u * 1.2, 6, MOSS, u * 0.6);
    }
  }

  function bodyPath(ctx, x, y, u) {
    const by = y - u * 5.6;
    ctx.beginPath();
    ctx.moveTo(x - u * 10, by);
    ctx.bezierCurveTo(x - u * 10.6, by - u * 10, x - u * 10, y - u * 24, x - u * 8, y - u * 27.5);
    ctx.quadraticCurveTo(x - u * 6.5, y - u * 30.5, x - u * 3.6, y - u * 31);
    ctx.lineTo(x + u * 3.6, y - u * 31);
    ctx.quadraticCurveTo(x + u * 6.5, y - u * 30.5, x + u * 8, y - u * 27.5);
    ctx.bezierCurveTo(x + u * 10, y - u * 24, x + u * 10.6, by - u * 10, x + u * 10, by);
    ctx.closePath();
  }

  function paintBody(ctx, rand, x, y, u) {
    ctx.save();
    bodyPath(ctx, x, y, u);
    ctx.fillStyle = STONE.mid;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = STONE.shade;
    ctx.beginPath();
    ctx.ellipse(x - u * 10.5, y - u * 15, u * 5, u * 18, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = STONE.lit;
    ctx.beginPath();
    ctx.ellipse(x + u * 9.5, y - u * 17, u * 6.5, u * 17, 0, 0, 6.3);
    ctx.fill();
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 3 ? STONE.lichen : STONE.shade;
      ctx.fillRect(x + (rand() - 0.5) * u * 18, y - u * (7 + rand() * 22), Math.max(1, u * 0.9), Math.max(1, u * 0.6));
    }
    ctx.restore();
    ctx.strokeStyle = STONE.line;
    ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - u * 7.6, y - u * 25);
    ctx.quadraticCurveTo(x - u * 7.4, y - u * 16, x - u * 2.8, y - u * 13);
    ctx.moveTo(x + u * 7.6, y - u * 25);
    ctx.quadraticCurveTo(x + u * 7.4, y - u * 16, x + u * 2.8, y - u * 13);
    ctx.moveTo(x - u * 8, y - u * 7.4);
    ctx.quadraticCurveTo(x, y - u * 5.6, x + u * 8, y - u * 7.4);
    ctx.stroke();
  }

  function paintHands(ctx, x, y, u) {
    ctx.fillStyle = STONE.lit;
    ctx.beginPath();
    ctx.moveTo(x, y - u * 20);
    ctx.quadraticCurveTo(x + u * 3, y - u * 16, x + u * 2.4, y - u * 12);
    ctx.lineTo(x - u * 2.4, y - u * 12);
    ctx.quadraticCurveTo(x - u * 3, y - u * 16, x, y - u * 20);
    ctx.fill();
    ctx.strokeStyle = STONE.line;
    ctx.lineWidth = Math.max(1, u * 0.4);
    ctx.beginPath();
    ctx.moveTo(x, y - u * 18);
    ctx.lineTo(x, y - u * 12.4);
    ctx.stroke();
  }

  function paintBib(ctx, x, y, u, red) {
    const n = y - u * 31;
    ctx.fillStyle = red.main;
    ctx.beginPath();
    ctx.moveTo(x - u * 7.4, n + u * 0.4);
    ctx.quadraticCurveTo(x - u * 9.2, n + u * 7, x - u * 4, n + u * 11.5);
    ctx.quadraticCurveTo(x, n + u * 14, x + u * 4, n + u * 11.5);
    ctx.quadraticCurveTo(x + u * 9.2, n + u * 7, x + u * 7.4, n + u * 0.4);
    ctx.quadraticCurveTo(x, n + u * 3.4, x - u * 7.4, n + u * 0.4);
    ctx.fill();
    ctx.fillStyle = red.lit;
    ctx.beginPath();
    ctx.moveTo(x + u * 7.4, n + u * 0.4);
    ctx.quadraticCurveTo(x + u * 9.2, n + u * 7, x + u * 4, n + u * 11.5);
    ctx.quadraticCurveTo(x + u * 5, n + u * 6, x + u * 3.4, n + u * 2.4);
    ctx.fill();
    ctx.strokeStyle = red.dark;
    ctx.lineWidth = Math.max(1, u * 0.55);
    ctx.beginPath();
    ctx.moveTo(x - u * 7.2, n + u * 1.4);
    ctx.quadraticCurveTo(x, n + u * 4.6, x + u * 7.2, n + u * 1.4);
    ctx.moveTo(x - u * 4.4, n + u * 4.2);
    ctx.quadraticCurveTo(x - u * 5.2, n + u * 8, x - u * 2.6, n + u * 11.4);
    ctx.moveTo(x - u * 1, n + u * 4.6);
    ctx.quadraticCurveTo(x - u * 1.4, n + u * 9, x - u * 0.2, n + u * 12.6);
    ctx.stroke();
  }

  function paintHead(ctx, x, y, u) {
    const hy = y - u * 37.5;
    ctx.fillStyle = STONE.mid;
    ctx.fillRect(x - u * 3, y - u * 32, u * 6, u * 2);
    for (const side of [-1, 1]) {
      ctx.fillStyle = side < 0 ? STONE.shade : STONE.lit;
      ctx.beginPath();
      ctx.ellipse(x + side * u * 7, hy + u * 1.6, u * 1.5, u * 3.2, side * -0.12, 0, 6.3);
      ctx.fill();
    }
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, hy, u * 7, u * 7.4, 0, 0, 6.3);
    ctx.fillStyle = STONE.mid;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = STONE.lit;
    ctx.beginPath();
    ctx.ellipse(x + u * 2.6, hy - u * 0.4, u * 6.6, u * 7.4, 0, 0, 6.3);
    ctx.fill();
    ctx.restore();
    paintFace(ctx, x, hy, u);
  }

  function paintFace(ctx, x, hy, u) {
    ctx.strokeStyle = STONE.line;
    ctx.lineWidth = Math.max(1, u * 0.6);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(x + side * u * 4.6, hy + u * 1.4);
      ctx.quadraticCurveTo(x + side * u * 3.1, hy + u * 2.8, x + side * u * 1.5, hy + u * 1.4);
    }
    ctx.moveTo(x - u * 1.8, hy + u * 5);
    ctx.quadraticCurveTo(x, hy + u * 6.2, x + u * 1.8, hy + u * 5);
    ctx.stroke();
    ctx.fillStyle = STONE.shade;
    ctx.fillRect(x - u * 0.5, hy + u * 3, Math.max(1, u), Math.max(1, u * 0.9));
  }

  function paintCap(ctx, x, y, u, red, pompom) {
    const hem = y - u * 39;
    const top = hem - u * 9.6;
    ctx.fillStyle = red.main;
    ctx.beginPath();
    ctx.ellipse(x, hem, u * 7.6, u * 9.6, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = red.lit;
    ctx.beginPath();
    ctx.ellipse(x + u * 3.4, hem - u * 4.6, u * 2.8, u * 4.2, 0.35, 0, 6.3);
    ctx.fill();
    ctx.strokeStyle = red.dark;
    ctx.lineWidth = Math.max(1, u * 0.45);
    ctx.beginPath();
    for (let k = -2; k <= 2; k++) {
      ctx.moveTo(x + k * u * 0.6, top + u * 0.6);
      ctx.quadraticCurveTo(x + k * u * 3, hem - u * 6, x + k * u * 3, hem - u * 1.4);
    }
    ctx.stroke();
    ctx.strokeStyle = red.main;
    ctx.lineWidth = u * 2.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - u * 7.4, hem - u * 0.4);
    ctx.quadraticCurveTo(x, hem + u * 1.8, x + u * 7.4, hem - u * 0.4);
    ctx.stroke();
    ctx.strokeStyle = red.dark;
    ctx.lineWidth = Math.max(1, u * 0.45);
    ctx.beginPath();
    for (let k = -3; k <= 3; k++) {
      const bx = x + k * u * 2.1;
      const by = hem + u * (0.75 - Math.abs(k) * 0.22);
      ctx.moveTo(bx, by - u * 1.1);
      ctx.lineTo(bx, by + u * 1.1);
    }
    ctx.stroke();
    if (pompom) paintPompom(ctx, x, top, u, red);
  }

  function paintPompom(ctx, x, top, u, red) {
    ctx.fillStyle = red.main;
    ctx.beginPath();
    ctx.arc(x, top - u * 1.4, u * 2.6, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = red.lit;
    ctx.beginPath();
    ctx.arc(x + u * 0.8, top - u * 2, u * 1.2, 0, 6.3);
    ctx.fill();
  }

  function paintShoulderMoss(ctx, rand, x, y, u) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const f = k / 3;
        const mx = x + side * u * (6.4 + 2.4 * f);
        const my = y - u * (30.4 - 3.6 * f * f);
        const size = u * (1.7 - f * 0.6) * (side < 0 ? 1.1 : 0.85);
        ctx.fillStyle = MOSS[0];
        ctx.beginPath();
        ctx.ellipse(mx, my, size * 1.1, size * 0.75, side * 0.5, 0, 6.3);
        ctx.fill();
        scatter(ctx, rand, mx, my - size * 0.2, size, size * 0.6, 6, MOSS, u * 0.5);
      }
    }
  }

  function paintStatue(ctx, rand, st) {
    paintPedestal(ctx, rand, st.x, st.y, st.u);
    paintBody(ctx, rand, st.x, st.y, st.u);
    paintHands(ctx, st.x, st.y, st.u);
    paintBib(ctx, st.x, st.y, st.u, st.red);
    paintShoulderMoss(ctx, rand, st.x, st.y, st.u);
    paintHead(ctx, st.x, st.y, st.u);
    paintCap(ctx, st.x, st.y, st.u, st.red, st.pompom);
  }

  // The row recedes a little to the right; how many fit depends on the width.
  function makeRow(g) {
    const x0 = g.W * 0.13;
    const x1 = g.W * 0.62;
    const n = Math.max(3, Math.min(7, Math.round((x1 - x0) / (g.U * 29)) + 1));
    const vary = [1, 0.93, 1.02, 0.95, 0.99, 0.92, 1.01];
    const row = [];
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      row.push({
        f,
        x: lerp(x0, x1, f),
        y: g.H * lerp(0.84, 0.77, f),
        u: g.U * lerp(1, 0.84, f) * vary[i],
        red: REDS[i % REDS.length],
        pompom: i % 3 !== 1,
      });
    }
    return row;
  }

  // Pinwheels stand in the gaps between the statues and at both ends of the row.
  function makeWheels(g, row, rand) {
    const list = [];
    for (let i = 0; i <= row.length; i++) {
      const a = row[Math.max(0, i - 1)];
      const b = row[Math.min(row.length - 1, i)];
      const end = i === 0 ? -1 : i === row.length ? 1 : 0;
      const u = (a.u + b.u) / 2;
      const x = (a.x + b.x) / 2 + end * u * 15;
      const foot = (a.y + b.y) / 2 + u * (end ? 1.5 : 4);
      const tall = u * (i % 2 ? 20 : 25);
      list.push({
        x, foot, y: foot - tall,
        r: u * (i % 2 ? 7.4 : 8.2),
        u,
        colours: PAPER[i % PAPER.length],
        angle: rand() * 6.28,
        rate: (0.7 + ((i * 2.618) % 1) * 3) * (i % 3 === 2 ? -1 : 1),
        lag: rand() * 6.28,
      });
    }
    return list;
  }

  function paintSticks(ctx, wheels) {
    for (const w of wheels) {
      ctx.fillStyle = GROUND.shadow;
      ctx.beginPath();
      ctx.ellipse(w.x - w.u * 1.5, w.foot, w.u * 2.4, w.u * 0.7, 0, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = '#cdb985';
      ctx.fillRect(w.x - w.u * 0.35, w.y, Math.max(1, w.u * 0.7), w.foot - w.y);
    }
  }

  function paintWorld(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintWood(ctx, g, rand);
    paintCanopy(ctx, g, rand);
    const trunks = [[0.035, 10], [0.25, 4], [0.45, 6], [0.6, 3.2], [0.71, 4.4], [0.975, 11]];
    for (const [fx, width] of trunks) paintTrunk(ctx, g, rand, fx, width);
    paintHedge(ctx, g, rand);
    paintGround(ctx, g, rand);
    paintFallen(ctx, g, rand);
    const row = makeRow(g);
    for (let i = row.length - 1; i >= 0; i--) paintStatue(ctx, rand, row[i]);
    state.wheels = makeWheels(g, row, rand);
    paintSticks(ctx, state.wheels);
    return c;
  }

  // Sun dapples on the ground: flattened ovals in loose clusters, where the canopy
  // opens. Two sets are baked and cross-fade, so the light seems to shift.
  function paintDapples(g, rand, seed) {
    const top = g.H * 0.44;
    const c = layer(g.W + g.U * 8, g.H - top);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffe3a0';
    const count = Math.round((g.W / g.U) * 2.4);
    for (let i = 0; i < count; i++) {
      const x = rand() * c.width;
      const y = Math.sqrt(rand()) * c.height;
      if (fbm(x * 0.05 / g.U, y * 0.12 / g.U, 2, seed) < 0.5) continue;
      const d = 0.5 + y / c.height;
      const rx = g.U * (0.8 + rand() * 2.2) * d;
      ctx.globalAlpha = 0.26;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, rx * (0.32 + rand() * 0.2), 0, 0, 6.3);
      ctx.fill();
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.ellipse(x, y, rx * 0.55, rx * 0.2, 0, 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return c;
  }

  function fern(ctx, g, x, y, length, lean, tone) {
    const steps = 14;
    ctx.strokeStyle = tone;
    ctx.lineWidth = Math.max(1, g.U * 0.55);
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const px = x + lean * length * f * f;
      const py = y - length * f + length * 0.5 * f * f;
      const reach = length * 0.3 * (1 - f) * Math.min(1, f * 5);
      ctx.moveTo(px - reach, py + reach * 0.2 - g.U);
      ctx.lineTo(px, py);
      ctx.lineTo(px + reach, py + reach * 0.2 - g.U);
      if (i > 0) {
        ctx.moveTo(px, py);
        ctx.lineTo(x + lean * length * ((i - 1) / steps) ** 2, y - length * ((i - 1) / steps) + length * 0.5 * ((i - 1) / steps) ** 2);
      }
    }
    ctx.stroke();
  }

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const tones = ['#3f6036', '#55793f', '#6a8f48'];
    for (let i = 0; i < 8; i++) {
      const lean = (i - 3.5) * 0.24 + (rand() - 0.5) * 0.2;
      fern(ctx, g, g.U * (1 + rand() * 10), g.H + g.U, g.U * (13 + rand() * 7), lean, tones[i % 3]);
    }
    for (let i = 0; i < 7; i++) {
      const lean = (i - 3) * 0.26;
      fern(ctx, g, g.W - g.U * (1 + rand() * 10), g.H + g.U, g.U * (11 + rand() * 7), lean, tones[i % 3]);
    }
    return c;
  }

  function paintBranch(ctx, g, rand, x0, y0, x1, y1) {
    ctx.strokeStyle = BARK.base;
    ctx.lineWidth = Math.max(1, g.U * 1);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2, y1 - g.U * 5, x1, y1);
    ctx.stroke();
    for (let i = 0; i < 14; i++) {
      const f = 0.15 + (i / 14) * 0.9;
      const x = lerp(x0, x1, f);
      const y = lerp(y0, y1, f * f) + (rand() - 0.3) * g.U * 6;
      scatter(ctx, rand, x, y, g.U * 4.4, g.U * 2.8, 30, LEAF, g.U);
    }
  }

  function paintBranches(g, rand) {
    const c = layer(g.W, g.H * 0.3);
    const ctx = c.getContext('2d');
    paintBranch(ctx, g, rand, -g.U * 2, g.U * 1, g.W * 0.22 + g.U * 6, g.U * 10);
    paintBranch(ctx, g, rand, g.W + g.U * 2, g.U * 0.5, g.W - g.U * 26, g.U * 7);
    return c;
  }

  function makeLeaves(g, rand) {
    const list = [];
    for (let i = 0; i < MAX_LEAVES; i++) {
      const low = i % 4 === 0;
      list.push({
        x: rand() * (g.W + g.U * 12),
        y: g.H * (low ? 0.82 + rand() * 0.14 : 0.08 + rand() * 0.6),
        fall: low ? g.U * 2 : g.H * (0.1 + rand() * 0.2),
        rate: g.U * (low ? 3 + rand() * 2 : 5 + rand() * 7),
        size: g.U * (i % 6 === 2 ? 2.6 : 1.3 + rand() * 1),
        bob: g.U * (low ? 0.6 : 1.5 + rand() * 3),
        bobRate: 0.5 + rand() * 0.9,
        spin: (rand() < 0.5 ? -1 : 1) * (0.7 + rand() * 1.8),
        flip: 1 + rand() * 2.2,
        phase: rand() * 6.28,
        colour: LEAF[i % LEAF.length],
      });
    }
    return list;
  }

  function drawLeaf(ctx, g, leaf, t) {
    const span = g.W + g.U * 12;
    const x = ((leaf.x + state.drift * leaf.rate) % span) - g.U * 6;
    const y = leaf.y + (x / g.W) * leaf.fall + Math.sin(t * leaf.bobRate + leaf.phase) * leaf.bob;
    const a = t * leaf.spin + leaf.phase;
    const face = Math.cos(t * leaf.flip + leaf.phase);
    const ax = Math.cos(a) * leaf.size;
    const ay = Math.sin(a) * leaf.size;
    const bx = -ay * 0.7 * face;
    const by = ax * 0.7 * face;
    ctx.fillStyle = leaf.colour;
    ctx.beginPath();
    ctx.moveTo(x + ax, y + ay);
    ctx.quadraticCurveTo(x + bx, y + by, x - ax, y - ay);
    ctx.quadraticCurveTo(x - bx, y - by, x + ax, y + ay);
    ctx.fill();
  }

  // A folded paper vane: a long front face and the other side of the paper in its curl.
  function drawWheel(ctx, w) {
    const step = 6.28318 / 4;
    const r = w.r;
    for (let b = 0; b < 4; b++) {
      const a = w.angle + b * step;
      const tipX = w.x + Math.cos(a) * r * 0.9;
      const tipY = w.y + Math.sin(a) * r;
      ctx.fillStyle = w.colours[0];
      ctx.beginPath();
      ctx.moveTo(w.x, w.y);
      ctx.lineTo(w.x + Math.cos(a - step * 0.5) * r * 0.3 * 0.9, w.y + Math.sin(a - step * 0.5) * r * 0.3);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(w.x + Math.cos(a + step * 0.55) * r * 0.66 * 0.9, w.y + Math.sin(a + step * 0.55) * r * 0.66);
      ctx.fill();
      ctx.fillStyle = w.colours[1];
      ctx.beginPath();
      ctx.moveTo(w.x, w.y);
      ctx.lineTo(tipX, tipY);
      ctx.lineTo(w.x + Math.cos(a + step * 0.3) * r * 0.42 * 0.9, w.y + Math.sin(a + step * 0.3) * r * 0.42);
      ctx.fill();
    }
    ctx.fillStyle = '#6b4a2c';
    ctx.fillRect(w.x - w.u * 0.6, w.y - w.u * 0.6, Math.max(1, w.u * 1.2), Math.max(1, w.u * 1.2));
  }

  function drawLight(ctx, g, t, amount) {
    if (amount <= 0) return;
    const top = g.H * 0.44;
    const mix = Math.sin(t * 0.11);
    ctx.globalAlpha = Math.min(1, amount * (0.55 + 0.45 * mix));
    ctx.drawImage(state.dapplesA, Math.sin(t * 0.05) * g.U * 3 - g.U * 4, top);
    ctx.globalAlpha = Math.min(1, amount * (0.55 - 0.45 * mix));
    ctx.drawImage(state.dapplesB, Math.cos(t * 0.04) * g.U * 3 - g.U * 4, top);
    ctx.globalAlpha = 1;
  }

  function drawFront(ctx, g, t, gust, wind) {
    const lean = Math.sin(t * 0.8) * 0.02 * Math.min(1.5, wind) * gust;
    ctx.setTransform(1, 0, lean, 1, -lean * g.H, 0);
    ctx.drawImage(state.front, 0, 0);
    ctx.setTransform(1, 0, 0, 1, Math.sin(t * 0.47) * g.U * 0.6 * Math.min(1.5, wind), Math.sin(t * 0.31) * g.U * 0.3);
    ctx.drawImage(state.branches, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.world = paintWorld(g, rand);
    state.dapplesA = paintDapples(g, rand, 31);
    state.dapplesB = paintDapples(g, rand, 47);
    state.front = paintFront(g, rand);
    state.branches = paintBranches(g, rand);
    state.leaves = makeLeaves(g, rand);
    state.drift = 0;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const wind = api.props.wind;
    const gust = 0.8 + 0.3 * Math.sin(t * 0.29) + 0.18 * Math.sin(t * 0.71 + 1.3);
    state.drift += dt * wind * gust;
    ctx.drawImage(state.world, 0, 0);
    drawLight(ctx, g, t, api.props.light);
    for (const w of state.wheels) {
      w.angle += dt * w.rate * wind * Math.max(0.2, gust + 0.25 * Math.sin(t * 0.43 + w.lag));
      drawWheel(ctx, w);
    }
    const count = Math.min(MAX_LEAVES, Math.round(26 * api.props.leaves));
    for (let i = 0; i < count; i++) drawLeaf(ctx, g, state.leaves[i], t);
    drawFront(ctx, g, t, gust, wind);
  }

  Kasuri.run({
    defaults: { wind: 1, leaves: 1, light: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.12, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
