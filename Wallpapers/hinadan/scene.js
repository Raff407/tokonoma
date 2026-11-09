/*
 * 雛壇 Hinadan — the Hina festival doll stand in lamplight.
 *
 * Wall, gold screen, red carpeted tiers, dolls and peach branches are baked once.
 * Each frame lays down a warm lantern glow that breathes slowly, the two small
 * flames, a soft light drifting over the screen, and a short pool of petals.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const PETALS = 28;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
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
    const v = U * Math.min(1, W / (U * 150));
    return { W, H, U, v, cx: W / 2 };
  }

  // ---- room ---------------------------------------------------------------

  function paintWall(ctx, g) {
    ctx.fillStyle = '#26304a';
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#2d3858';
    for (let x = 0; x < g.W; x += g.v * 14) ctx.fillRect(x, 0, Math.max(1, g.v * 0.5), g.H * 0.9);
    ctx.fillStyle = '#1c2438';
    ctx.fillRect(0, 0, g.W, g.v * 3);
    // tatami floor with moss edging
    const fy = g.H * 0.91;
    ctx.fillStyle = '#7b8656';
    ctx.fillRect(0, fy, g.W, g.H - fy);
    ctx.fillStyle = '#5d6a40';
    for (let x = 0; x < g.W; x += g.v * 5) ctx.fillRect(x, fy, 1, g.H - fy);
    ctx.fillStyle = '#26301f';
    ctx.fillRect(0, fy, g.W, Math.max(1, g.v * 0.7));
  }

  function paintScreen(ctx, g) {
    const w = g.v * 92;
    const x0 = g.cx - w / 2;
    const top = g.v * 6;
    const bot = g.H * 0.56;
    ctx.fillStyle = '#17120e';
    ctx.fillRect(x0 - g.v * 1.4, top - g.v * 1.4, w + g.v * 2.8, bot - top + g.v * 1.4);
    const pw = w / 3;
    for (let i = 0; i < 3; i++) {
      const px = x0 + i * pw;
      ctx.fillStyle = i % 2 ? '#c9a24a' : '#d6b25a';
      ctx.fillRect(px, top, pw - 1, bot - top);
      ctx.fillStyle = '#e6cf86';
      ctx.fillRect(px, top, pw - 1, Math.max(1, g.v * 0.6));
      ctx.fillStyle = '#17120e';
      ctx.fillRect(px + pw - 1, top, 1, bot - top);
    }
    // painted pine and low cloud bands on the gold
    ctx.fillStyle = '#b08c38';
    for (let i = 0; i < 4; i++) {
      blob(ctx, x0 + w * (0.15 + i * 0.23), top + (bot - top) * (0.28 + (i % 2) * 0.3), g.v * 9, g.v * 1.4);
    }
  }

  // ---- stand --------------------------------------------------------------

  const TIERS = [
    { y: 56, w: 62 },
    { y: 66, w: 82 },
    { y: 76, w: 102 },
    { y: 85, w: 122 },
  ];

  function paintTier(ctx, g, t, h) {
    const w = g.v * t.w;
    const y = g.H * (t.y / 100);
    const hh = g.H * h / 100;
    ctx.fillStyle = '#b3402b';
    ctx.fillRect(g.cx - w / 2, y, w, hh);
    ctx.fillStyle = '#c85a3c';
    ctx.fillRect(g.cx - w / 2, y, w, Math.max(1, g.v * 0.7));
    ctx.fillStyle = '#17120e';
    ctx.fillRect(g.cx - w / 2, y + hh - Math.max(1, g.v * 0.9), w, Math.max(1, g.v * 0.9));
    // gold diamond border along the carpet face
    ctx.fillStyle = '#d6b25a';
    const step = g.v * 3.4;
    for (let x = g.cx - w / 2 + step / 2; x < g.cx + w / 2; x += step) {
      const my = y + hh * 0.5;
      const r = Math.max(1, g.v * 0.9);
      poly(ctx, [x, my - r, x + r, my, x, my + r, x - r, my]);
    }
  }

  function paintStand(ctx, g) {
    for (let i = 0; i < TIERS.length; i++) {
      const next = i + 1 < TIERS.length ? TIERS[i + 1].y : 92;
      paintTier(ctx, g, TIERS[i], next - TIERS[i].y);
    }
  }

  // ---- dolls --------------------------------------------------------------

  function doll(ctx, g, x, y, s, robe, trim, hat, wide) {
    const w = s * (wide ? 1.9 : 1.2);
    ctx.fillStyle = robe;
    poly(ctx, [x - w * 0.3, y - s * 2.6, x + w * 0.3, y - s * 2.6, x + w, y, x - w, y]);
    ctx.fillStyle = trim;
    poly(ctx, [x - w * 0.12, y - s * 2.6, x + w * 0.12, y - s * 2.6, x + w * 0.2, y, x - w * 0.2, y]);
    ctx.fillRect(x - w * 0.9, y - s * 0.35, w * 1.8, Math.max(1, s * 0.3));
    ctx.fillStyle = '#ece4cf';
    blob(ctx, x, y - s * 3.2, s * 0.62, s * 0.66);
    ctx.fillStyle = '#17120e';
    if (hat === 'eboshi') {
      poly(ctx, [x - s * 0.5, y - s * 3.5, x + s * 0.5, y - s * 3.5, x + s * 0.3, y - s * 4.6, x - s * 0.2, y - s * 4.6]);
    } else if (hat === 'hair') {
      blob(ctx, x, y - s * 3.45, s * 0.75, s * 0.5);
      ctx.fillRect(x - s * 0.75, y - s * 3.4, s * 0.25, s * 2);
      ctx.fillRect(x + s * 0.5, y - s * 3.4, s * 0.25, s * 2);
      ctx.fillStyle = '#d6b25a';
      ctx.fillRect(x - s * 0.5, y - s * 4, s, Math.max(1, s * 0.22));
    } else {
      blob(ctx, x, y - s * 3.5, s * 0.58, s * 0.34);
    }
  }

  function paintDolls(ctx, g) {
    const v = g.v;
    const ty = (i) => g.H * (TIERS[i].y / 100) + 0.5;
    // emperor and empress
    doll(ctx, g, g.cx - v * 7, ty(0), v * 3.4, '#1c2438', '#8c2f2a', 'eboshi', true);
    doll(ctx, g, g.cx + v * 7, ty(0), v * 3.4, '#a63a2c', '#d6b25a', 'hair', true);
    // gilt folding stands for each
    ctx.fillStyle = '#17120e';
    ctx.fillRect(g.cx - v * 1, ty(0) - v * 5, Math.max(1, v * 0.4), v * 5);
    // three court ladies
    const lady = ['#e7dcc0', '#a63a2c', '#e7dcc0'];
    for (let k = 0; k < 3; k++) {
      doll(ctx, g, g.cx + (k - 1) * v * 14, ty(1), v * 2.5, lady[k], '#d6b25a', 'hair', false);
    }
    // five musicians
    const robe = ['#4c5a3a', '#26304a', '#a63a2c', '#26304a', '#4c5a3a'];
    for (let k = 0; k < 5; k++) {
      doll(ctx, g, g.cx + (k - 2) * v * 12, ty(2), v * 2.1, robe[k], '#d6b25a', 'eboshi', false);
    }
    // two ministers and rice cake diamonds
    doll(ctx, g, g.cx - v * 34, ty(3), v * 2.4, '#8c2f2a', '#d6b25a', 'eboshi', false);
    doll(ctx, g, g.cx + v * 34, ty(3), v * 2.4, '#26304a', '#d6b25a', 'eboshi', false);
    const cols = ['#c8a8a0', '#ece4cf', '#7b8656'];
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = cols[k];
      const y = ty(3) - v * (1.2 + k * 1.5);
      const r = v * (2.8 - k * 0.3);
      poly(ctx, [g.cx, y - v * 1.2, g.cx + r, y, g.cx, y + v * 0.4, g.cx - r, y]);
    }
    ctx.fillStyle = '#17120e';
    ctx.fillRect(g.cx - v * 3.4, ty(3) - v * 0.3, v * 6.8, v * 0.7);
  }

  // ---- lanterns and blossom -------------------------------------------------

  function lanternPos(g) {
    const v = g.v;
    return [
      { x: g.cx - v * 24, y: g.H * 0.56 - v * 15 },
      { x: g.cx + v * 24, y: g.H * 0.56 - v * 15 },
    ];
  }

  function paintLanterns(ctx, g) {
    const v = g.v;
    for (const p of lanternPos(g)) {
      const ty = g.H * 0.56;
      ctx.fillStyle = '#17120e';
      ctx.fillRect(p.x - v * 0.3, p.y + v * 3.5, v * 0.6, ty - p.y - v * 3.5);
      ctx.fillRect(p.x - v * 2.4, ty - v * 0.8, v * 4.8, v * 0.8);
      ctx.fillStyle = '#17120e';
      ctx.fillRect(p.x - v * 3.2, p.y - v * 4, v * 6.4, v * 0.8);
      ctx.fillRect(p.x - v * 3.2, p.y + v * 3.2, v * 6.4, v * 0.8);
      ctx.fillStyle = '#e9d7a4';
      ctx.fillRect(p.x - v * 2.8, p.y - v * 3.2, v * 5.6, v * 6.4);
      ctx.fillStyle = '#c9a24a';
      ctx.fillRect(p.x - v * 0.2, p.y - v * 3.2, Math.max(1, v * 0.4), v * 6.4);
      ctx.fillRect(p.x - v * 2.8, p.y - v * 0.2, v * 5.6, Math.max(1, v * 0.4));
    }
  }

  function branch(ctx, g, x, y, dir, rand) {
    const v = g.v;
    ctx.strokeStyle = '#3a2a22';
    ctx.lineWidth = Math.max(1, v * 0.7);
    const tips = [];
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + dir * v * 4, y - v * 12, x + dir * v * 9, y - v * 22);
    ctx.stroke();
    tips.push([x + dir * v * 9, y - v * 22]);
    for (let k = 0; k < 3; k++) {
      const sx = x + dir * v * (2 + k * 2.4);
      const sy = y - v * (6 + k * 5);
      const ex = sx - dir * v * (4 + rand() * 4);
      const ey = sy - v * (5 + rand() * 3);
      ctx.lineWidth = Math.max(1, v * 0.4);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      tips.push([ex, ey]);
    }
    for (const t of tips) {
      for (let n = 0; n < 7; n++) {
        const bx = t[0] + (rand() - 0.5) * v * 7;
        const by = t[1] + (rand() - 0.2) * v * 6;
        ctx.fillStyle = rand() < 0.3 ? '#e8d4d0' : '#cf8f94';
        blob(ctx, bx, by, v * 1.1, v * 1.1);
        ctx.fillStyle = '#d6b25a';
        blob(ctx, bx, by, v * 0.3, v * 0.3);
      }
    }
  }

  function paintBlossom(ctx, g, rand) {
    const v = g.v;
    const sides = [-1, 1];
    for (const s of sides) {
      const x = g.cx + s * v * 34;
      const y = g.H * 0.66;
      ctx.fillStyle = '#26304a';
      ctx.fillRect(x - v * 1.8, y - v * 5, v * 3.6, v * 5);
      ctx.fillStyle = '#d6b25a';
      ctx.fillRect(x - v * 1.8, y - v * 3.2, v * 3.6, Math.max(1, v * 0.4));
      branch(ctx, g, x, y - v * 5, s, rand);
    }
  }

  function paintGlow() {
    const c = layer(64, 64);
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,205,120,0.9)');
    gr.addColorStop(0.35, 'rgba(240,160,70,0.35)');
    gr.addColorStop(1, 'rgba(220,120,40,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 64, 64);
    return c;
  }

  // ---- motion ---------------------------------------------------------------

  function flick(t, i) {
    return 0.8 + 0.12 * Math.sin(t * 2.3 + i * 1.7) + 0.08 * Math.sin(t * 5.9 + i * 4.1) + 0.05 * Math.sin(t * 9.7 + i);
  }

  function drawGlow(ctx, g, t, amount) {
    const gp = lanternPos(g);
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < gp.length; i++) {
      const f = flick(t, i) * amount;
      const r = g.v * (30 + 4 * f);
      ctx.globalAlpha = Math.min(1, 0.4 * f);
      ctx.drawImage(state.glow, gp[i].x - r, gp[i].y - r, r * 2, r * 2);
      ctx.globalAlpha = Math.min(1, 0.7 * f);
      const s = g.v * 7;
      ctx.drawImage(state.glow, gp[i].x - s, gp[i].y - s, s * 2, s * 2);
    }
    // soft light drifting across the screen
    const sx = g.cx + Math.sin(t * 0.25) * g.v * 30;
    const r = g.v * 22;
    ctx.globalAlpha = 0.16 * amount;
    ctx.drawImage(state.glow, sx - r, g.H * 0.3 - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = prev;
  }

  function drawFlames(ctx, g, t, amount) {
    const gp = lanternPos(g);
    ctx.fillStyle = '#f4d98c';
    for (let i = 0; i < gp.length; i++) {
      const f = flick(t, i);
      const h = g.v * (1.4 + 0.9 * f * amount);
      ctx.globalAlpha = 0.9;
      poly(ctx, [gp[i].x - g.v * 0.6, gp[i].y + g.v * 2, gp[i].x + g.v * 0.6, gp[i].y + g.v * 2, gp[i].x + Math.sin(t * 7 + i) * g.v * 0.4, gp[i].y + g.v * 2 - h]);
    }
    ctx.globalAlpha = 1;
  }

  function makePetals(g, rand) {
    const p = { x: new Float32Array(PETALS), y: new Float32Array(PETALS), ph: new Float32Array(PETALS), sp: new Float32Array(PETALS) };
    for (let i = 0; i < PETALS; i++) {
      p.x[i] = rand() * g.W;
      p.y[i] = rand() * g.H * 0.95;
      p.ph[i] = rand() * TAU;
      p.sp[i] = 0.6 + rand() * 0.8;
    }
    return p;
  }

  function drawPetals(ctx, g, t, dt, count) {
    const p = state.petals;
    const step = Math.min(dt, 0.1);
    for (let i = 0; i < count; i++) {
      p.y[i] += step * g.v * 2.2 * p.sp[i];
      p.x[i] += step * g.v * Math.sin(t * 0.8 + p.ph[i]) * 1.6;
      if (p.y[i] > g.H * 0.95) {
        p.y[i] = -2;
        p.x[i] = g.cx + (Math.sin(p.ph[i] * 9 + t) * 0.5) * g.W;
      }
      const sq = 0.5 + 0.5 * Math.abs(Math.sin(t * 1.4 + p.ph[i]));
      ctx.fillStyle = i % 3 ? '#e2b2b2' : '#cf8f94';
      ctx.fillRect(p.x[i], p.y[i], Math.max(1, g.v * 0.9 * sq), Math.max(1, g.v * 0.7));
    }
  }

  // ---- run ------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    const c = layer(g.W, g.H);
    const x = c.getContext('2d');
    paintWall(x, g);
    paintScreen(x, g);
    paintStand(x, g);
    paintLanterns(x, g);
    paintBlossom(x, g, rand);
    paintDolls(x, g);
    state.back = c;
    state.glow = paintGlow();
    state.petals = makePetals(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { glow, petals } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawGlow(ctx, g, t, glow);
    drawFlames(ctx, g, t, glow);
    drawPetals(ctx, g, t, dt, Math.min(PETALS, Math.round(14 * petals)));
  }

  Kasuri.run({
    defaults: { glow: 1, petals: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
