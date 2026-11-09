/*
 * 蛸壺 Takotsubo — a clay octopus pot on the sandy seabed.
 *
 * Water, seigaiha surface, far torii, lantern, sand and pot are baked once.
 * Each frame adds a few sunbeams, wakame strands, the octopus, a red sea bream,
 * a small silver school and a short pool of specks.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, smoothstep } = K;
  const TAU = Math.PI * 2;
  const WATER = ['#1f3c52', '#274a62', '#2f5a6e', '#3b6b78', '#4f8083'];
  const SAND = ['#b79d74', '#a58b64', '#8f7753'];
  const MAX_SPECKS = 70;
  const SPECKS = 40;
  const SCHOOL = 9;
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
    const u = U * Math.min(1, W / (U * 120));
    return { W, H, U, u, floor: H * 0.78, px: W * 0.5 };
  }

  // ---- water, surface waves, torii ----------------------------------------

  function paintWater(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.floor);
    WATER.forEach((col, i) => grad.addColorStop(i / (WATER.length - 1), WATER[WATER.length - 1 - i]));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    paintSeigaiha(ctx, g);
    paintTorii(ctx, g);
    ctx.fillStyle = '#d8e4dc';
    for (let i = 0; i < g.W * 0.3; i++) {
      ctx.globalAlpha = 0.05 + rand() * 0.1;
      ctx.fillRect(rand() * g.W, rand() * g.floor, 1, 1);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // Overlapping arcs along the surface, the classic wave pattern seen from below.
  function paintSeigaiha(ctx, g) {
    const r = g.U * 4.2;
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    for (let row = 0; row < 3; row++) {
      const y = g.U * (2 + row * 2.1);
      for (let x = -r + (row % 2) * r; x < g.W + r; x += r * 2) {
        for (let k = 3; k >= 1; k--) {
          ctx.strokeStyle = k % 2 ? '#a9c7bd' : '#7fa9a6';
          ctx.globalAlpha = 0.5 - row * 0.12;
          ctx.beginPath();
          ctx.arc(x, y, r * k / 3, 0, Math.PI);
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // A faint vermilion torii standing in the haze on the seabed.
  function paintTorii(ctx, g) {
    const x = g.W * 0.84;
    const base = g.floor - g.U * 3;
    const w = g.u * 11;
    const h = g.U * 22;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#9a4a3c';
    ctx.fillRect(x - w * 0.42, base - h, g.u * 1.6, h);
    ctx.fillRect(x + w * 0.42 - g.u * 1.6, base - h, g.u * 1.6, h);
    ctx.fillRect(x - w * 0.5, base - h * 0.74, w, g.U * 1.2);
    ctx.fillStyle = '#2a2a2e';
    poly(ctx, [x - w * 0.68, base - h - g.U * 0.2, x + w * 0.68, base - h - g.U * 0.2,
      x + w * 0.56, base - h - g.U * 2.4, x - w * 0.56, base - h - g.U * 2.4]);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2f5a6e';
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x - w, base - h - g.U * 3, w * 2, h + g.U * 3);
    ctx.globalAlpha = 1;
  }

  // ---- seabed: sand, lantern, pot ------------------------------------------

  function paintFloor(ctx, g, rand) {
    ctx.fillStyle = SAND[0];
    ctx.beginPath();
    ctx.moveTo(0, g.floor + g.U * 1.5);
    for (let x = 0; x <= g.W + 4; x += 4) {
      ctx.lineTo(x, g.floor + Math.sin(x / (g.U * 9)) * g.U * 1.2 + Math.sin(x / (g.U * 3.1)) * g.U * 0.4);
    }
    ctx.lineTo(g.W, g.H);
    ctx.lineTo(0, g.H);
    ctx.fill();
    // ripples in the sand
    ctx.strokeStyle = SAND[1];
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    for (let row = 0; row < 7; row++) {
      const y = g.floor + g.U * (3 + row * 3.2);
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      for (let x = 0; x <= g.W + 4; x += 3) {
        const yy = y + Math.sin(x / (g.U * (4 + row * 0.5)) + row * 2) * g.U * (0.5 + row * 0.12);
        if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = SAND[2];
    for (let i = 0; i < g.W * 0.4; i++) {
      ctx.globalAlpha = 0.4;
      ctx.fillRect(rand() * g.W, g.floor + g.U * 2 + rand() * (g.H - g.floor), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // Stone lantern, mossy, half sunk in sand.
  function paintLantern(ctx, g) {
    const x = g.W * 0.19;
    const b = g.floor + g.U * 5;
    const s = g.u;
    ctx.fillStyle = '#5c6a68';
    poly(ctx, [x - s * 4, b, x + s * 4, b, x + s * 3, b - s * 3, x - s * 3, b - s * 3]);
    ctx.fillStyle = '#6b7a76';
    ctx.fillRect(x - s * 1.4, b - s * 12, s * 2.8, s * 9);
    ctx.fillStyle = '#5c6a68';
    ctx.fillRect(x - s * 3.6, b - s * 13.5, s * 7.2, s * 1.6);
    ctx.fillStyle = '#7a8984';
    ctx.fillRect(x - s * 2.6, b - s * 19, s * 5.2, s * 5.5);
    ctx.fillStyle = '#d6b45a';
    ctx.globalAlpha = 0.65;
    ctx.fillRect(x - s * 1.2, b - s * 17.8, s * 2.4, s * 3);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#4c5a58';
    poly(ctx, [x - s * 5.4, b - s * 19, x + s * 5.4, b - s * 19, x + s * 2.4, b - s * 23, x - s * 2.4, b - s * 23]);
    ctx.fillStyle = '#4f6d3f';
    ctx.globalAlpha = 0.8;
    blob(ctx, x - s * 2, b - s * 22.6, s * 2.6, s * 0.8);
    blob(ctx, x + s * 1, b - s * 13.6, s * 3, s * 0.7);
    blob(ctx, x - s * 3, b - s * 3, s * 1.6, s * 1.2);
    ctx.globalAlpha = 1;
  }

  // The pot: unglazed clay, rounded shoulder, narrow neck, hemp rope loop.
  function paintPot(ctx, g) {
    const x = g.px;
    const b = g.floor + g.U * 9;
    const s = g.u;
    const top = b - s * 34;
    ctx.fillStyle = 'rgba(20,34,40,0.35)';
    blob(ctx, x + s * 2, b + s * 0.5, s * 15, s * 2.6);
    const body = ctx.createLinearGradient(x - s * 13, 0, x + s * 13, 0);
    body.addColorStop(0, '#6c3f2c');
    body.addColorStop(0.45, '#a8663f');
    body.addColorStop(1, '#7a4630');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(x - s * 6, top);
    ctx.bezierCurveTo(x - s * 7, top + s * 6, x - s * 14, top + s * 10, x - s * 13, b - s * 12);
    ctx.bezierCurveTo(x - s * 12.5, b - s * 3, x - s * 8, b, x, b);
    ctx.bezierCurveTo(x + s * 8, b, x + s * 12.5, b - s * 3, x + s * 13, b - s * 12);
    ctx.bezierCurveTo(x + s * 14, top + s * 10, x + s * 7, top + s * 6, x + s * 6, top);
    ctx.closePath();
    ctx.fill();
    // rim and dark mouth
    ctx.fillStyle = '#8a5236';
    blob(ctx, x, top, s * 7.4, s * 2.3);
    ctx.fillStyle = '#1c1612';
    blob(ctx, x, top + s * 0.1, s * 5.6, s * 1.6);
    // glaze flecks and a soft band
    ctx.strokeStyle = '#5c3624';
    ctx.lineWidth = Math.max(1, s * 0.4);
    ctx.globalAlpha = 0.6;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.ellipse(x, b - s * (6 + k * 7), s * (12 - k * 0.8), s * 2.2, 0, 0.1, Math.PI - 0.1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // hemp rope round the neck, with a knot and a trailing line
    ctx.strokeStyle = '#d9c79c';
    ctx.lineWidth = Math.max(1.2, s * 0.7);
    ctx.beginPath();
    ctx.ellipse(x, top + s * 3.4, s * 6.6, s * 1.6, 0, 0.05, Math.PI - 0.05);
    ctx.stroke();
    ctx.fillStyle = '#d9c79c';
    blob(ctx, x + s * 2.4, top + s * 4.8, s * 1.1, s * 1);
    ctx.beginPath();
    ctx.moveTo(x + s * 2.4, top + s * 5.4);
    ctx.bezierCurveTo(x + s * 7, top + s * 12, x + s * 4, b - s * 4, x + s * 14, b - s * 1.6);
    ctx.stroke();
    // lit shoulder
    ctx.fillStyle = '#d29a68';
    ctx.globalAlpha = 0.35;
    blob(ctx, x - s * 5.5, top + s * 12, s * 2.2, s * 6);
    ctx.globalAlpha = 1;
    // small shell on the sand
    ctx.fillStyle = '#e4dcc4';
    blob(ctx, x + s * 19, b + s * 0.6, s * 1.6, s * 1);
    blob(ctx, x - s * 22, b + s * 2.4, s * 1.1, s * 0.7);
  }

  // ---- per frame -------------------------------------------------------------

  function drawBeams(ctx, g, t, amount) {
    if (amount <= 0) return;
    const n = 5;
    for (let i = 0; i < n; i++) {
      const sway = Math.sin(t * 0.22 + i * 1.7) * g.U * 2.5;
      const x0 = g.W * (0.08 + i * 0.2) + sway;
      const wTop = g.U * (3 + (i % 3) * 1.5);
      const lean = g.U * 20;
      const a = (0.08 + 0.05 * Math.sin(t * 0.3 + i * 2.3)) * Math.min(1.5, amount);
      const grad = ctx.createLinearGradient(0, 0, 0, g.floor + g.U * 6);
      grad.addColorStop(0, 'rgba(236,228,190,' + (a * 1.6).toFixed(3) + ')');
      grad.addColorStop(1, 'rgba(236,228,190,0)');
      ctx.fillStyle = grad;
      poly(ctx, [x0, 0, x0 + wTop, 0, x0 + wTop * 2.4 + lean, g.floor + g.U * 6, x0 + lean * 0.9, g.floor + g.U * 6]);
    }
  }

  // Wakame fronds: ribbons rooted in the sand that lean and sway.
  function drawKelp(ctx, g, t) {
    const roots = state.kelp;
    ctx.lineCap = 'round';
    for (let i = 0; i < roots.length; i++) {
      const k = roots[i];
      const len = g.U * k.len;
      ctx.strokeStyle = k.tone;
      ctx.lineWidth = Math.max(1.2, g.U * k.w);
      ctx.beginPath();
      let x = k.x;
      let y = k.y;
      ctx.moveTo(x, y);
      for (let s = 1; s <= 5; s++) {
        const f = s / 5;
        x = k.x + Math.sin(t * 0.7 + k.p + f * 2.2) * g.U * 2.2 * f + k.lean * f * f * g.U;
        y = k.y - len * f;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  function drawOctopus(ctx, g, t) {
    const s = g.u;
    const x = g.px;
    const top = g.floor + g.U * 9 - s * 34;
    const bob = Math.sin(t * 0.8) * s * 0.5;
    const head = top - s * 3.2 + bob;
    // mantle rising from the mouth
    ctx.fillStyle = '#b8453a';
    ctx.beginPath();
    ctx.moveTo(x - s * 5, top + s * 0.4);
    ctx.bezierCurveTo(x - s * 6, head - s * 2, x - s * 2, head - s * 6, x + s * 1, head - s * 5.4);
    ctx.bezierCurveTo(x + s * 5, head - s * 4, x + s * 6, head - s * 1, x + s * 5, top + s * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d4705a';
    ctx.globalAlpha = 0.6;
    blob(ctx, x - s * 1.6, head - s * 3, s * 2.4, s * 1.4);
    ctx.globalAlpha = 1;
    // spots
    ctx.fillStyle = '#8f3028';
    blob(ctx, x + s * 2.4, head - s * 2.6, s * 0.7, s * 0.6);
    blob(ctx, x + s * 0.6, head - s * 4.4, s * 0.5, s * 0.45);
    // eyes, with a slow blink
    const blink = Math.sin(t * 0.9) > 0.985 ? 0.15 : 1;
    ctx.fillStyle = '#e8dfc6';
    blob(ctx, x - s * 2.4, head + s * 0.4, s * 1.5, s * 1.2 * blink);
    blob(ctx, x + s * 2.6, head + s * 0.4, s * 1.5, s * 1.2 * blink);
    ctx.fillStyle = '#17120f';
    blob(ctx, x - s * 2.3, head + s * 0.5, s * 0.8, s * 0.55 * blink);
    blob(ctx, x + s * 2.7, head + s * 0.5, s * 0.8, s * 0.55 * blink);
    // two tentacle tips curling over the rim
    ctx.strokeStyle = '#b8453a';
    ctx.lineWidth = Math.max(1.4, s * 1.5);
    ctx.lineCap = 'round';
    for (let k = 0; k < 2; k++) {
      const d = k ? 1 : -1;
      const sw = Math.sin(t * 0.9 + k * 2) * s * 1.2;
      ctx.beginPath();
      ctx.moveTo(x + d * s * 4.2, top + s * 0.8);
      ctx.bezierCurveTo(x + d * s * 8.5, top + s * 0.5, x + d * s * 10 + sw, top + s * 6, x + d * s * (8 + k * 2) + sw * 1.4, top + s * 9);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    // front lip of the rim hides the base of the mantle
    ctx.fillStyle = '#8a5236';
    ctx.beginPath();
    ctx.ellipse(x, top, s * 7.4, s * 2.3, 0, 0.12, Math.PI - 0.12);
    ctx.ellipse(x, top + s * 0.7, s * 6.2, s * 1.5, 0, Math.PI - 0.12, 0.12, true);
    ctx.fill();
  }

  function fishBody(ctx, x, y, len, ht, dir, tone, fin) {
    ctx.fillStyle = tone;
    blob(ctx, x, y, len, ht);
    poly(ctx, [x - dir * len * 0.8, y, x - dir * len * 1.55, y - ht * 0.9, x - dir * len * 1.55, y + ht * 0.9]);
    ctx.fillStyle = fin;
    poly(ctx, [x - len * 0.3, y - ht * 0.8, x + len * 0.3, y - ht * 0.8, x - dir * len * 0.4, y - ht * 1.5]);
  }

  // Red sea bream crossing slowly, back and forth.
  function drawBream(ctx, g, t) {
    const span = g.W + g.U * 30;
    const cyc = (t * 0.018) % 2;
    const dir = cyc < 1 ? 1 : -1;
    const f = cyc < 1 ? cyc : cyc - 1;
    const x = dir > 0 ? -g.U * 15 + f * span : g.W + g.U * 15 - f * span;
    const y = g.H * 0.4 + Math.sin(t * 0.35) * g.U * 3;
    const len = g.U * 6.5;
    const ht = g.U * 3.2;
    const wag = Math.sin(t * 2.4) * g.U * 0.6;
    fishBody(ctx, x, y, len, ht, dir, '#c25c4c', '#a8443a');
    ctx.fillStyle = '#e0a090';
    blob(ctx, x + dir * len * 0.2, y + ht * 0.4, len * 0.7, ht * 0.35);
    ctx.fillStyle = '#17120f';
    blob(ctx, x + dir * len * 0.62, y - ht * 0.2, g.U * 0.5, g.U * 0.5);
    ctx.fillStyle = '#a8443a';
    poly(ctx, [x - dir * len * 1.5, y + wag, x - dir * len * 1.9, y - ht * 1.1 + wag, x - dir * len * 1.9, y + ht * 1.1 + wag]);
  }

  function drawSchool(ctx, g, t) {
    const S = state.school;
    const dir = 1;
    ctx.fillStyle = '#9fb4b6';
    for (let i = 0; i < SCHOOL; i++) {
      const sp = S.speed;
      const x = ((t * sp * g.U + S.dx[i] * g.U) % (g.W + g.U * 40)) - g.U * 20;
      const y = g.H * 0.22 + S.dy[i] * g.U + Math.sin(t * 0.8 + S.p[i]) * g.U * 0.8;
      blob(ctx, x, y, g.U * 1.5, g.U * 0.55);
      poly(ctx, [x - g.U * 1.2, y, x - g.U * 2.2 * dir, y - g.U * 0.7, x - g.U * 2.2 * dir, y + g.U * 0.7]);
    }
  }

  function drawSpecks(ctx, g, t, count) {
    const P = state.specks;
    ctx.fillStyle = '#d6e2d4';
    for (let i = 0; i < count; i++) {
      const x = (P.x[i] * g.W + Math.sin(t * 0.3 + P.p[i]) * g.U * 2 + t * g.U * 0.35 * P.v[i]) % g.W;
      const y = g.floor + g.U * 4 - ((P.y[i] * (g.floor + g.U * 4) + t * g.U * 0.9 * P.v[i]) % (g.floor + g.U * 4));
      ctx.globalAlpha = 0.25 + 0.3 * P.v[i];
      ctx.fillRect(x, y, P.s[i], P.s[i]);
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -------------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintWater(g, rand);
    const fl = layer(g.W, g.H);
    const fc = fl.getContext('2d');
    paintLantern(fc, g);
    paintFloor(fc, g, rand);
    paintPot(fc, g);
    state.floor = fl;
    const tones = ['#4a6a3a', '#5a7c44', '#3f5c36'];
    state.kelp = [];
    [[0.06, 3], [0.09, 2], [0.32, 2], [0.68, 3], [0.73, 2], [0.93, 3], [0.96, 2]].forEach((p, i) => {
      for (let k = 0; k < p[1]; k++) {
        state.kelp.push({
          x: g.W * p[0] + k * g.U * 1.6,
          y: g.floor + g.U * (4 + rand() * 5),
          len: 14 + rand() * 12,
          w: 1.1 + rand() * 0.6,
          p: rand() * TAU,
          lean: (rand() - 0.5) * 6,
          tone: tones[(i + k) % 3],
        });
      }
    });
    state.school = { speed: 1.1, dx: [], dy: [], p: [] };
    for (let i = 0; i < SCHOOL; i++) {
      state.school.dx.push(i * 3.2 + rand() * 3);
      state.school.dy.push((rand() - 0.5) * 9);
      state.school.p.push(rand() * TAU);
    }
    state.specks = { x: [], y: [], v: [], p: [], s: [] };
    for (let i = 0; i < MAX_SPECKS; i++) {
      state.specks.x.push(rand());
      state.specks.y.push(rand());
      state.specks.v.push(0.4 + rand() * 0.8);
      state.specks.p.push(rand() * TAU);
      state.specks.s.push(rand() < 0.2 ? 2 : 1);
    }
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { beams, fish, drift } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawBeams(ctx, g, t, beams);
    if (fish) {
      drawSchool(ctx, g, t);
      drawBream(ctx, g, t);
    }
    ctx.drawImage(state.floor, 0, 0);
    drawKelp(ctx, g, t);
    drawOctopus(ctx, g, t);
    drawSpecks(ctx, g, t, Math.min(MAX_SPECKS, Math.round(SPECKS * drift)));
  }

  Kasuri.run({
    defaults: { beams: 1, fish: true, drift: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
