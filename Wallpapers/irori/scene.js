/*
 * 囲炉裏 Irori — a sunken hearth in an old farmhouse at night.
 *
 * Wall, floor, hearth, ash and logs are baked once, and so are the hook and kettle.
 * Each frame lays down a slow breathing glow, a short list of embers and flame
 * tongues, a few sparks and a reused pool of steam puffs.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp } = K;

  const TAU = Math.PI * 2;
  const WALL_END = 0.44;
  const EMBERS = 34;
  const MAX_EMBERS = 68;
  const PUFFS = 26;
  const MAX_PUFFS = 52;
  const SPARKS = 8;
  const TONGUES = 6;
  const EMBER_INKS = ['#4a2418', '#8a3222', '#c2452c', '#d6683c', '#e4a650', '#efc874'];
  const WOOD = { wall: '#241e1a', plank: '#2c2520', seam: '#171310', post: '#1a1512', beam: '#141110' };
  const FLOOR = { base: '#4a3828', seam: '#2c2018', shine: '#5e4836' };
  const FRAME = { top: '#5a3e2a', face: '#1e150e', edge: '#8a6440' };
  const ASH = { base: '#625c52', dark: '#4e4942', light: '#766f62' };
  const IRON = { body: '#1d1c1e', shade: '#121214', rim: '#a85a34', sheen: '#4a5468', knob: '#2a2826' };
  const BAMBOO = { pole: '#7e6a3e', node: '#5e4e2c', dark: '#4a3e24' };
  const STEAM = '#ddd5c2';
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
    const u = U * Math.min(1, W / (U * 130));
    const cx = W * 0.5;
    const hearth = { y0: H * 0.6, y1: H * 0.95, a0: u * 34, a1: u * 50, rim: u * 3.2 };
    const fire = { x: cx, y: lerp(hearth.y0, hearth.y1, 0.42) };
    const kettle = { x: cx, y: lerp(H * 0.6, H * 0.95, 0.42) - u * 15.5, rx: u * 11.5, ry: u * 9.5 };
    return { W, H, U, u, cx, wall: H * WALL_END, hearth, fire, kettle };
  }

  // ---- room ---------------------------------------------------------------

  function paintWall(ctx, g, rand) {
    ctx.fillStyle = WOOD.wall;
    ctx.fillRect(0, 0, g.W, g.wall);
    const plank = g.u * 7;
    for (let x = 0; x < g.W; x += plank) {
      ctx.fillStyle = rand() < 0.5 ? WOOD.plank : WOOD.wall;
      ctx.fillRect(x, 0, plank - 1, g.wall);
      ctx.fillStyle = WOOD.seam;
      ctx.fillRect(x + plank - 1, 0, 1, g.wall);
    }
    paintShoji(ctx, g, g.W * 0.06, g.H * 0.12, g.W * 0.2, g.H * 0.27);
    ctx.fillStyle = WOOD.beam;
    ctx.fillRect(0, g.H * 0.05, g.W, g.U * 4.5);
    ctx.fillRect(0, g.wall - g.U * 2, g.W, g.U * 2);
    ctx.fillStyle = WOOD.post;
    for (const f of [0.03, 0.31, 0.72, 0.95]) ctx.fillRect(g.W * f, 0, g.u * 4, g.wall);
    ctx.fillStyle = '#100d0b';
    for (let x = g.u * 4; x < g.W; x += g.u * 18) ctx.fillRect(x, 0, g.u * 3, g.H * 0.05);
  }

  function paintShoji(ctx, g, x, y, w, h) {
    ctx.fillStyle = '#4f5a70';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#5d6880';
    ctx.fillRect(x + w * 0.1, y + h * 0.08, w * 0.8, h * 0.5);
    ctx.fillStyle = '#1c1714';
    const cols = 4;
    const rows = 5;
    const bar = Math.max(1, g.u * 0.6);
    for (let i = 0; i <= cols; i++) ctx.fillRect(x + (w - bar) * (i / cols), y, bar, h);
    for (let j = 0; j <= rows; j++) ctx.fillRect(x, y + (h - bar) * (j / rows), w, bar);
  }

  function paintFloor(ctx, g) {
    ctx.fillStyle = FLOOR.base;
    ctx.fillRect(0, g.wall, g.W, g.H - g.wall);
    ctx.strokeStyle = FLOOR.seam;
    ctx.lineWidth = Math.max(1, g.u * 0.4);
    const vy = g.wall - g.H * 0.9;
    for (let i = -14; i <= 14; i++) {
      const bx = g.cx + i * g.u * 12;
      const tx = lerp(g.cx, bx, (g.wall - vy) / (g.H - vy));
      ctx.beginPath();
      ctx.moveTo(tx, g.wall);
      ctx.lineTo(bx, g.H);
      ctx.stroke();
    }
    ctx.fillStyle = FLOOR.shine;
    ctx.fillRect(0, g.wall, g.W, Math.max(1, g.U * 0.6));
  }

  function hearthPts(g, inset) {
    const h = g.hearth;
    const y0 = h.y0 + inset * 0.7;
    const y1 = h.y1 + inset * 0.2;
    const a0 = h.a0 + h.rim - inset;
    const a1 = h.a1 + h.rim - inset;
    return [g.cx - a0, y0, g.cx + a0, y0, g.cx + a1, y1, g.cx - a1, y1];
  }

  function paintHearth(ctx, g, rand) {
    const h = g.hearth;
    ctx.fillStyle = FRAME.top;
    poly(ctx, hearthPts(g, 0));
    ctx.fillStyle = FRAME.edge;
    ctx.fillRect(g.cx - h.a0 - h.rim, h.y0, (h.a0 + h.rim) * 2, Math.max(1, g.U * 0.5));
    ctx.fillStyle = FRAME.face;
    poly(ctx, hearthPts(g, h.rim));
    const ash = hearthPts(g, h.rim * 1.6);
    ctx.fillStyle = ASH.base;
    poly(ctx, ash);
    for (let i = 0; i < 140; i++) {
      const fy = rand();
      const y = lerp(ash[1], ash[5], fy);
      const half = lerp(ash[2] - g.cx, ash[4] - g.cx, fy) * 0.95;
      ctx.fillStyle = rand() < 0.5 ? ASH.dark : ASH.light;
      ctx.fillRect(g.cx + (rand() * 2 - 1) * half, y, g.u * (0.6 + rand()), g.U * 0.5);
    }
    paintLogs(ctx, g);
  }

  function log(ctx, g, x0, y0, x1, y1, r) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3a281c';
    ctx.lineWidth = r * 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = '#5a3e2a';
    ctx.lineWidth = r * 0.8;
    ctx.beginPath();
    ctx.moveTo(x0, y0 - r * 0.5);
    ctx.lineTo(x1, y1 - r * 0.5);
    ctx.stroke();
    ctx.fillStyle = '#1e1612';
    blob(ctx, x1, y1, r * 1.1, r * 0.9);
  }

  function paintLogs(ctx, g) {
    const f = g.fire;
    const u = g.u;
    ctx.fillStyle = '#2a201a';
    blob(ctx, f.x, f.y, u * 13, u * 3.4);
    log(ctx, g, f.x - u * 30, f.y + u * 9, f.x - u * 5, f.y + u * 0.5, u * 2.1);
    log(ctx, g, f.x + u * 31, f.y + u * 7, f.x + u * 5, f.y + u * 0.2, u * 2);
    log(ctx, g, f.x - u * 4, f.y + u * 13, f.x - u * 1, f.y + u * 2, u * 1.8);
  }

  function paintGlow(g, alpha, reach) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const f = g.fire;
    const r = g.u * reach;
    const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
    grad.addColorStop(0, `rgba(228, 150, 80, ${alpha})`);
    grad.addColorStop(0.4, `rgba(200, 104, 56, ${alpha * 0.5})`);
    grad.addColorStop(1, 'rgba(200, 104, 56, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    return c;
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintWall(ctx, g, rand);
    paintFloor(ctx, g);
    ctx.drawImage(paintGlow(g, 0.42, 70), 0, 0);
    paintHearth(ctx, g, rand);
    return c;
  }

  // ---- hook and kettle ----------------------------------------------------

  function paintHook(ctx, g) {
    const k = g.kettle;
    const u = g.u;
    const pw = u * 2.2;
    const leverY = g.H * 0.3;
    ctx.fillStyle = BAMBOO.pole;
    ctx.fillRect(k.x - pw / 2, 0, pw, leverY);
    ctx.fillStyle = BAMBOO.dark;
    ctx.fillRect(k.x + pw * 0.15, 0, pw * 0.35, leverY);
    ctx.fillStyle = BAMBOO.node;
    for (let y = g.H * 0.04; y < leverY; y += g.H * 0.075) ctx.fillRect(k.x - pw * 0.65, y, pw * 1.3, u * 0.8);
    ctx.fillStyle = '#5a4630';
    poly(ctx, [k.x - u * 9, leverY - u * 1.4, k.x + u * 6, leverY - u * 2.2, k.x + u * 9, leverY,
      k.x + u * 6, leverY + u * 2.2, k.x - u * 9, leverY + u * 1.4, k.x - u * 12, leverY - u * 2.6, k.x - u * 12, leverY + u * 2.6]);
    ctx.fillStyle = '#7a6040';
    poly(ctx, [k.x - u * 9, leverY - u * 1.4, k.x + u * 6, leverY - u * 2.2, k.x + u * 9, leverY, k.x - u * 9, leverY - u * 0.2]);
    ctx.fillStyle = '#d6c8a4';
    blob(ctx, k.x + u * 5, leverY - u * 0.4, u * 0.7, u * 0.7);
    ctx.fillStyle = '#2a2420';
    const top = leverY + u * 2;
    const hookEnd = k.y - k.ry - u * 5;
    ctx.fillRect(k.x - u * 0.6, top, u * 1.2, hookEnd - top);
  }

  function paintKettle(ctx, g) {
    const k = g.kettle;
    const u = g.u;
    const handleTop = k.y - k.ry - u * 5;
    ctx.strokeStyle = '#2c2a28';
    ctx.lineWidth = Math.max(1, u * 1.1);
    ctx.beginPath();
    ctx.moveTo(k.x - k.rx * 0.7, k.y - k.ry * 0.55);
    ctx.quadraticCurveTo(k.x - k.rx * 0.6, handleTop, k.x, handleTop);
    ctx.quadraticCurveTo(k.x + k.rx * 0.6, handleTop, k.x + k.rx * 0.7, k.y - k.ry * 0.55);
    ctx.stroke();
    ctx.fillStyle = IRON.body;
    poly(ctx, [k.x + k.rx * 0.7, k.y - k.ry * 0.1, k.x + k.rx * 1.45, k.y - k.ry * 0.75,
      k.x + k.rx * 1.55, k.y - k.ry * 0.68, k.x + k.rx * 0.85, k.y + k.ry * 0.25]);
    blob(ctx, k.x, k.y, k.rx, k.ry);
    ctx.fillStyle = IRON.shade;
    blob(ctx, k.x + k.rx * 0.2, k.y + k.ry * 0.15, k.rx * 0.8, k.ry * 0.8);
    ctx.fillStyle = IRON.sheen;
    blob(ctx, k.x - k.rx * 0.4, k.y - k.ry * 0.5, k.rx * 0.35, k.ry * 0.16);
    paintStuds(ctx, g);
    ctx.fillStyle = IRON.rim;
    ctx.beginPath();
    ctx.ellipse(k.x, k.y + k.ry * 0.05, k.rx, k.ry, 0, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.ellipse(k.x, k.y - k.ry * 0.12, k.rx * 0.92, k.ry * 0.86, 0, 0.85 * Math.PI, 0.15 * Math.PI, true);
    ctx.fill();
    ctx.fillStyle = IRON.knob;
    blob(ctx, k.x, k.y - k.ry * 0.9, k.rx * 0.48, k.ry * 0.18);
    ctx.fillStyle = '#3a3634';
    blob(ctx, k.x, k.y - k.ry * 1.02, k.rx * 0.13, k.ry * 0.13);
  }

  function paintStuds(ctx, g) {
    const k = g.kettle;
    ctx.fillStyle = '#2b2a2e';
    for (let row = 0; row < 3; row++) {
      const yy = k.y - k.ry * (0.45 - row * 0.2);
      for (let i = -4; i <= 4; i++) {
        const a = i / 5;
        const xx = k.x + a * k.rx * Math.sqrt(1 - ((yy - k.y) / k.ry) ** 2) * 0.9;
        ctx.fillRect(xx, yy, Math.max(1, g.u * 0.8), Math.max(1, g.u * 0.8));
      }
    }
  }

  function paintFront(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintHook(ctx, g);
    paintKettle(ctx, g);
    return c;
  }

  // ---- fire ---------------------------------------------------------------

  function makeEmbers(g, rand) {
    const f = () => new Float32Array(MAX_EMBERS);
    const E = { x: f(), y: f(), p: f(), rate: f(), size: f() };
    for (let i = 0; i < MAX_EMBERS; i++) {
      const a = rand() * TAU;
      const r = Math.sqrt(rand());
      E.x[i] = g.fire.x + Math.cos(a) * r * g.u * 12;
      E.y[i] = g.fire.y + Math.sin(a) * r * g.u * 3.2;
      E.p[i] = rand() * TAU;
      E.rate[i] = 0.4 + rand() * 0.9;
      E.size[i] = g.u * (0.8 + rand() * 1.2);
    }
    return E;
  }

  function drawEmbers(ctx, t, count) {
    const E = state.embers;
    const last = EMBER_INKS.length - 1;
    for (let i = 0; i < count; i++) {
      const b = 0.5 + 0.5 * Math.sin(t * E.rate[i] + E.p[i]);
      ctx.fillStyle = EMBER_INKS[Math.min(last, Math.floor(b * (last + 0.99)))];
      const s = E.size[i];
      ctx.fillRect(E.x[i] - s / 2, E.y[i] - s * 0.35, s, s * 0.7);
    }
  }

  function drawTongues(ctx, g, t, embers) {
    if (embers <= 0) return;
    const f = g.fire;
    const u = g.u;
    for (let i = 0; i < TONGUES; i++) {
      const off = (i / (TONGUES - 1) - 0.5) * u * 14;
      const ph = i * 1.7;
      const h = u * (3 + 2.4 * (0.5 + 0.5 * Math.sin(t * 2.1 + ph))) * Math.min(1.4, embers);
      const sway = Math.sin(t * 1.6 + ph * 1.3) * u * 1.2;
      const w = u * 1.8;
      const bx = f.x + off;
      const by = f.y + u * 0.4;
      ctx.fillStyle = i % 2 ? '#c2452c' : '#d6683c';
      poly(ctx, [bx - w, by, bx + sway, by - h, bx + w, by]);
      ctx.fillStyle = '#e4a650';
      poly(ctx, [bx - w * 0.45, by, bx + sway * 0.6, by - h * 0.5, bx + w * 0.45, by]);
    }
  }

  function makeSparks(rand) {
    const f = () => new Float32Array(SPARKS);
    const S = { x: f(), age: f(), life: f(), p: f() };
    for (let i = 0; i < SPARKS; i++) {
      S.life[i] = 2.5 + rand() * 2.5;
      S.age[i] = rand() * S.life[i];
      S.x[i] = (rand() - 0.5) * 12;
      S.p[i] = rand() * TAU;
    }
    return S;
  }

  function drawSparks(ctx, g, t, dt, embers) {
    const S = state.sparks;
    const n = Math.round(SPARKS * Math.min(1, embers));
    const u = g.u;
    ctx.fillStyle = '#e4a650';
    for (let i = 0; i < n; i++) {
      S.age[i] += dt;
      if (S.age[i] > S.life[i]) {
        S.age[i] = 0;
        S.x[i] = (state.rand() - 0.5) * 12;
      }
      const k = S.age[i] / S.life[i];
      const x = g.fire.x + S.x[i] * u + Math.sin(t * 2 + S.p[i]) * u * 1.5;
      const y = g.fire.y - k * g.H * 0.16;
      ctx.globalAlpha = 1 - k;
      ctx.fillRect(x, y, Math.max(1, u * 0.6), Math.max(1, u * 0.6));
    }
    ctx.globalAlpha = 1;
  }

  // ---- steam --------------------------------------------------------------

  function makePuffs() {
    const f = () => new Float32Array(MAX_PUFFS);
    return { x: f(), y: f(), vx: f(), age: f(), life: f(), p: f(), src: f() };
  }

  function resetPuff(g, P, i, scatter) {
    const r = state.rand;
    const k = g.kettle;
    const spout = r() < 0.65;
    P.src[i] = spout ? 1 : 0;
    P.x[i] = spout ? k.x + k.rx * 1.5 : k.x + (r() - 0.5) * k.rx * 0.6;
    P.y[i] = spout ? k.y - k.ry * 0.75 : k.y - k.ry * 1.05;
    P.vx[i] = spout ? g.u * (2 + r() * 1.5) : g.u * (r() - 0.3);
    P.life[i] = 4 + r() * 3;
    P.age[i] = scatter ? r() * P.life[i] : 0;
    P.p[i] = r() * TAU;
  }

  function drawSteam(ctx, g, t, dt, steam) {
    const P = state.puffs;
    const count = Math.min(MAX_PUFFS, Math.round(PUFFS * steam));
    const u = g.u;
    ctx.fillStyle = STEAM;
    for (let i = 0; i < count; i++) {
      P.age[i] += dt;
      if (P.age[i] > P.life[i]) resetPuff(g, P, i, false);
      const k = P.age[i] / P.life[i];
      const a = P.age[i];
      const x = P.x[i] + P.vx[i] * a * (1 - k * 0.5) + Math.sin(a * 0.9 + P.p[i]) * u * 2.5 * k;
      const y = P.y[i] - a * g.U * 4.2;
      const r = u * (1.2 + k * 5);
      ctx.globalAlpha = Math.min(1, k * 6) * (1 - k) * 0.42;
      blob(ctx, x, y, r, r * 0.8);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run ----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.back = paintBack(g, rand);
    state.glow = paintGlow(g, 0.3, 46);
    state.front = paintFront(g);
    state.embers = makeEmbers(g, rand);
    state.sparks = makeSparks(rand);
    state.puffs = makePuffs();
    for (let i = 0; i < MAX_PUFFS; i++) resetPuff(g, state.puffs, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { embers, steam } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.back, 0, 0);
    const breath = 0.55 + 0.25 * Math.sin(t * 0.7) + 0.1 * Math.sin(t * 1.9 + 1);
    ctx.globalAlpha = Math.max(0, Math.min(1, breath * Math.min(1.3, embers)));
    ctx.drawImage(state.glow, 0, 0);
    ctx.globalAlpha = 1;
    drawEmbers(ctx, t, Math.min(MAX_EMBERS, Math.round(EMBERS * embers)));
    drawTongues(ctx, g, t, embers);
    ctx.drawImage(state.front, 0, 0);
    drawSparks(ctx, g, t, step, embers);
    drawSteam(ctx, g, t, step, steam);
  }

  Kasuri.run({
    defaults: { embers: 1, steam: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
