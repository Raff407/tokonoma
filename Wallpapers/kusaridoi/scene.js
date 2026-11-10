/*
 * 鎖樋 Kusaridoi — a copper rain chain hanging from a temple eave in steady rain.
 *
 * Eave, wall, lantern, chain, basin and gravel are baked once. Per frame: rain streaks
 * from a fixed pool, glints and falling threads on the chain, and rings on the basin.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const CUPS = 9;
  const MAX_RAIN = 110;
  const RINGS = 7;
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
    const u = U * Math.min(1, W / (U * 150));
    return {
      W, H, U, u,
      eave: H * 0.17,
      soffit: H * 0.235,
      ground: H * 0.74,
      cx: W * 0.58,
      top: H * 0.235,
      water: H * 0.835,
      basinY: H * 0.855,
    };
  }

  // ---- eave, wall and garden ----------------------------------------------

  function paintRoof(ctx, g, rand) {
    const u = g.u;
    ctx.fillStyle = '#20252d';
    ctx.fillRect(0, 0, g.W, g.eave);
    const step = u * 1.7;
    for (let x = 0; x < g.W + step; x += step) {
      ctx.fillStyle = '#2d343e';
      ctx.fillRect(x, 0, Math.max(1, u * 0.35), g.eave);
      ctx.fillStyle = '#191d24';
      ctx.fillRect(x + step * 0.5, 0, Math.max(1, u * 0.3), g.eave);
    }
    for (let y = u * 2; y < g.eave; y += u * 3) {
      ctx.fillStyle = '#3a424d';
      ctx.fillRect(0, y, g.W, Math.max(1, u * 0.25));
    }
    // round end tiles along the edge, each with a pale boss
    const r = u * 1.5;
    for (let x = r; x < g.W + r; x += r * 2.05) {
      ctx.fillStyle = '#12151a';
      blob(ctx, x, g.eave, r, r);
      ctx.fillStyle = '#4a525c';
      blob(ctx, x, g.eave - r * 0.05, r * 0.72, r * 0.72);
      ctx.fillStyle = '#6d7782';
      blob(ctx, x - r * 0.15, g.eave - r * 0.2, r * 0.3, r * 0.3);
    }
    // shadow and the boxed soffit with its rafter ends
    ctx.fillStyle = '#0f1218';
    ctx.fillRect(0, g.eave + r, g.W, g.soffit - g.eave - r);
    for (let x = u * 2; x < g.W; x += u * 4.2) {
      ctx.fillStyle = '#4a382a';
      ctx.fillRect(x, g.eave + r * 1.1, u * 1.3, g.soffit - g.eave - r * 1.1);
      ctx.fillStyle = '#6a5038';
      ctx.fillRect(x, g.eave + r * 1.1, u * 0.45, g.soffit - g.eave - r * 1.1);
    }
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(0, g.soffit - u * 0.5, g.W, u * 1.0);
  }

  function paintWall(ctx, g, rand) {
    const u = g.u;
    const y0 = g.soffit + u * 0.5;
    const h = g.ground - y0;
    const grad = ctx.createLinearGradient(0, y0, 0, g.ground);
    grad.addColorStop(0, '#2c3340');
    grad.addColorStop(1, '#58606a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, g.W, h);
    // wet plaster mottling
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = rand() < 0.5 ? 'rgba(20,26,36,0.18)' : 'rgba(140,150,160,0.10)';
      blob(ctx, rand() * g.W, y0 + rand() * h, u * (1 + rand() * 4), u * (0.5 + rand() * 1.5));
    }
    // dark posts and a long beam
    for (let x = g.W * 0.04; x < g.W; x += g.W * 0.31) {
      ctx.fillStyle = '#2a2018';
      ctx.fillRect(x, y0, u * 2.2, h);
      ctx.fillStyle = '#4a3828';
      ctx.fillRect(x, y0, u * 0.6, h);
    }
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(0, y0 + u * 3, g.W, u * 1.8);
    ctx.fillStyle = '#4a3828';
    ctx.fillRect(0, y0 + u * 3, g.W, u * 0.5);
    // low stone footing
    ctx.fillStyle = '#4a4e50';
    ctx.fillRect(0, g.ground - u * 2.4, g.W, u * 2.4);
    for (let x = 0; x < g.W; x += u * 4.5) {
      ctx.fillStyle = '#62676a';
      ctx.fillRect(x, g.ground - u * 2.4, Math.max(1, u * 0.3), u * 2.4);
    }
    ctx.fillStyle = '#6c7174';
    ctx.fillRect(0, g.ground - u * 2.4, g.W, Math.max(1, u * 0.35));
  }

  function paintMaple(ctx, g, rand) {
    const u = g.u;
    const x = g.W * 0.9;
    const y = g.ground - u * 14;
    ctx.strokeStyle = '#1f1a15';
    ctx.lineWidth = Math.max(1.5, u * 1.1);
    ctx.beginPath();
    ctx.moveTo(x + u * 6, g.ground);
    ctx.quadraticCurveTo(x + u * 5, y + u * 14, x - u * 2, y);
    ctx.stroke();
    const tones = ['#7a2a1e', '#a23a26', '#8a4a24', '#c0603a'];
    for (let i = 0; i < 46; i++) {
      const a = rand() * TAU;
      const d = Math.sqrt(rand()) * u * 14;
      ctx.fillStyle = tones[(rand() * tones.length) | 0];
      blob(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7 - u * 3, u * (0.9 + rand() * 1.1), u * (0.7 + rand() * 0.7));
    }
  }

  function paintLantern(ctx, g) {
    const u = g.u;
    const x = g.W * 0.2;
    const base = g.ground + u * 3.2;
    const stone = ['#5c6066', '#7a7f84', '#92979b'];
    const moss = '#4a6038';
    // plinth, stem, ring, fire box, hat, finial
    ctx.fillStyle = stone[0];
    ctx.fillRect(x - u * 4.2, base - u * 2.2, u * 8.4, u * 2.2);
    ctx.fillStyle = stone[1];
    ctx.fillRect(x - u * 4.2, base - u * 2.2, u * 8.4, Math.max(1, u * 0.4));
    ctx.fillStyle = stone[0];
    ctx.fillRect(x - u * 1.5, base - u * 12.5, u * 3, u * 10.5);
    ctx.fillStyle = stone[2];
    ctx.fillRect(x - u * 1.5, base - u * 12.5, u * 0.7, u * 10.5);
    ctx.fillStyle = stone[1];
    poly(ctx, [x - u * 4.4, base - u * 12.5, x + u * 4.4, base - u * 12.5, x + u * 3.4, base - u * 14.3, x - u * 3.4, base - u * 14.3]);
    ctx.fillStyle = stone[0];
    ctx.fillRect(x - u * 3, base - u * 21, u * 6, u * 6.7);
    ctx.fillStyle = '#d2a85a';
    ctx.fillRect(x - u * 1.5, base - u * 19.6, u * 3, u * 3.4);
    ctx.fillStyle = stone[2];
    ctx.fillRect(x - u * 3, base - u * 21, u * 0.7, u * 6.7);
    ctx.fillStyle = stone[1];
    poly(ctx, [x - u * 7.5, base - u * 21, x + u * 7.5, base - u * 21, x + u * 3, base - u * 26.5, x - u * 3, base - u * 26.5]);
    ctx.fillStyle = stone[2];
    poly(ctx, [x - u * 7.5, base - u * 21, x - u * 3, base - u * 26.5, x - u * 1.5, base - u * 26.5, x - u * 5.2, base - u * 21]);
    ctx.fillStyle = stone[0];
    blob(ctx, x, base - u * 27.4, u * 1.5, u * 1.6);
    ctx.fillStyle = moss;
    blob(ctx, x - u * 4, base - u * 21.2, u * 2.4, u * 0.6);
    blob(ctx, x + u * 2, base - u * 26.3, u * 2.2, u * 0.5);
    blob(ctx, x, base - u * 2.2, u * 4, u * 0.8);
  }

  function paintGravel(ctx, g, rand) {
    const u = g.u;
    const y0 = g.ground;
    const h = g.H - y0;
    const grad = ctx.createLinearGradient(0, y0, 0, g.H);
    grad.addColorStop(0, '#6a6e70');
    grad.addColorStop(1, '#43484c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, g.W, h + 1);
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = rand() < 0.5 ? 'rgba(210,214,214,0.28)' : 'rgba(20,24,28,0.30)';
      const y = y0 + rand() * h;
      const f = 0.6 + (y - y0) / h;
      ctx.fillRect(rand() * g.W, y, Math.max(1, u * 0.5 * f), Math.max(1, u * 0.3));
    }
    // raked rings around the basin
    ctx.lineWidth = Math.max(1, u * 0.32);
    for (let i = 1; i <= 5; i++) {
      ctx.strokeStyle = i % 2 ? 'rgba(30,34,38,0.38)' : 'rgba(205,210,210,0.28)';
      ctx.beginPath();
      ctx.ellipse(g.cx, g.basinY + u * 2, u * (17 + i * 4.2), u * (4 + i * 1.2), 0, 0, TAU);
      ctx.stroke();
    }
    // a few round stones and fallen leaves
    for (let i = 0; i < 6; i++) {
      const x = g.W * (0.04 + rand() * 0.92);
      const y = y0 + h * (0.35 + rand() * 0.6);
      ctx.fillStyle = '#34383c';
      blob(ctx, x, y + u * 0.3, u * 2.2, u * 1.1);
      ctx.fillStyle = '#7f8588';
      blob(ctx, x - u * 0.2, y, u * 2, u * 0.9);
    }
    const tones = ['#a23a26', '#c0603a', '#8a4a24'];
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = tones[i % 3];
      blob(ctx, g.W * rand(), y0 + h * (0.2 + rand() * 0.75), u * 0.9, u * 0.45);
    }
  }

  function paintBasin(ctx, g, rand) {
    const u = g.u;
    const x = g.cx;
    const y = g.basinY;
    const rx = u * 15;
    const ry = u * 4.6;
    // squat stone body below the rim
    ctx.fillStyle = '#4d5257';
    ctx.beginPath();
    ctx.ellipse(x, y + u * 3.2, rx * 0.88, ry * 0.9, 0, 0, Math.PI);
    ctx.lineTo(x - rx, y);
    ctx.lineTo(x + rx, y);
    ctx.fill();
    ctx.fillStyle = '#3a3e43';
    ctx.beginPath();
    ctx.ellipse(x + rx * 0.3, y + u * 3.4, rx * 0.58, ry * 0.8, 0, 0, Math.PI);
    ctx.fill();
    // rim
    ctx.fillStyle = '#8b9094';
    blob(ctx, x, y, rx, ry);
    ctx.fillStyle = '#a3a8ac';
    blob(ctx, x - rx * 0.1, y - ry * 0.12, rx * 0.95, ry * 0.85);
    // moss on the rim
    ctx.fillStyle = '#4f6a3a';
    blob(ctx, x - rx * 0.78, y + ry * 0.1, rx * 0.22, ry * 0.4);
    blob(ctx, x + rx * 0.8, y + ry * 0.2, rx * 0.16, ry * 0.3);
    ctx.fillStyle = '#6b8648';
    blob(ctx, x - rx * 0.82, y, rx * 0.1, ry * 0.2);
    // water surface
    ctx.fillStyle = '#2b4350';
    blob(ctx, x, y, rx * 0.82, ry * 0.68);
    ctx.fillStyle = '#4f7280';
    blob(ctx, x - rx * 0.1, y - ry * 0.12, rx * 0.6, ry * 0.3);
  }

  function paintBack(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#20252d';
    ctx.fillRect(0, 0, g.W, g.H);
    paintWall(ctx, g, rand);
    paintMaple(ctx, g, rand);
    paintRoof(ctx, g, rand);
    paintGravel(ctx, g, rand);
    paintLantern(ctx, g);
    paintBasin(ctx, g, rand);
    return c;
  }

  // ---- the chain -----------------------------------------------------------

  const COPPER = { dark: '#5e3320', mid: '#a0602f', light: '#d0924f', glow: '#ecc07a', inside: '#2a1a12' };

  function cupGeometry(g, i) {
    const span = g.water - g.u * 1.5 - g.top;
    const s = span / CUPS;
    return { y: g.top + s * i + s * 0.28, s, h: s * 0.62, rim: g.u * 2.7 };
  }

  function paintCup(ctx, g, x, c) {
    const { y, h, rim } = c;
    const foot = rim * 0.42;
    ctx.fillStyle = COPPER.dark;
    poly(ctx, [x - rim, y, x + rim, y, x + foot, y + h, x - foot, y + h]);
    ctx.fillStyle = COPPER.mid;
    poly(ctx, [x - rim * 0.9, y, x + rim * 0.2, y, x + foot * 0.3, y + h, x - foot * 0.9, y + h]);
    ctx.fillStyle = COPPER.light;
    poly(ctx, [x - rim * 0.8, y, x - rim * 0.45, y, x - foot * 0.5, y + h * 0.9, x - foot * 0.8, y + h * 0.9]);
    ctx.fillStyle = COPPER.inside;
    blob(ctx, x, y, rim, rim * 0.28);
    ctx.fillStyle = COPPER.glow;
    ctx.fillRect(x - rim, y - Math.max(0.5, g.u * 0.2), rim * 2, Math.max(1, g.u * 0.4));
    // small base knob
    ctx.fillStyle = COPPER.mid;
    blob(ctx, x, y + h + g.u * 0.2, foot * 0.9, foot * 0.6);
  }

  function paintChain(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const x = g.cx;
    const u = g.u;
    // bracket on the soffit
    ctx.fillStyle = COPPER.dark;
    ctx.fillRect(x - u * 2.6, g.top - u * 1.6, u * 5.2, u * 1.6);
    ctx.fillStyle = COPPER.light;
    ctx.fillRect(x - u * 2.6, g.top - u * 1.6, u * 5.2, Math.max(1, u * 0.35));
    // links first, cups over them
    ctx.lineWidth = Math.max(1, u * 0.55);
    ctx.strokeStyle = COPPER.mid;
    const first = cupGeometry(g, 0);
    ctx.beginPath();
    ctx.moveTo(x, g.top);
    ctx.lineTo(x, first.y);
    ctx.stroke();
    for (let i = 0; i < CUPS; i++) {
      const a = cupGeometry(g, i);
      const bottom = a.y + a.h;
      const next = i + 1 < CUPS ? cupGeometry(g, i + 1).y : bottom + a.s * 0.3;
      ctx.strokeStyle = COPPER.mid;
      ctx.beginPath();
      ctx.moveTo(x, bottom);
      ctx.lineTo(x, next);
      ctx.stroke();
      // a ring link at the middle of each gap
      const my = (bottom + next) / 2;
      ctx.strokeStyle = COPPER.light;
      ctx.lineWidth = Math.max(1, u * 0.4);
      ctx.beginPath();
      ctx.ellipse(x, my, u * 0.75, Math.max(u * 1.1, (next - bottom) * 0.42), 0, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, u * 0.55);
    }
    for (let i = 0; i < CUPS; i++) paintCup(ctx, g, x, cupGeometry(g, i));
    return c;
  }

  // ---- moving things -------------------------------------------------------

  function makeRain(g, rand) {
    const rain = { x: new Float32Array(MAX_RAIN), y: new Float32Array(MAX_RAIN), v: new Float32Array(MAX_RAIN), l: new Float32Array(MAX_RAIN) };
    for (let i = 0; i < MAX_RAIN; i++) {
      rain.x[i] = rand() * (g.W + g.H * 0.2) - g.H * 0.1;
      rain.y[i] = g.eave + rand() * (g.H - g.eave);
      rain.v[i] = g.H * (0.9 + rand() * 0.6);
      rain.l[i] = g.U * (2 + rand() * 3);
    }
    return rain;
  }

  function drawRain(ctx, g, dt, amount) {
    const rain = state.rain;
    const n = Math.min(MAX_RAIN, Math.round(amount * 60));
    const slant = 0.12;
    ctx.lineWidth = Math.max(1, g.u * 0.28);
    ctx.strokeStyle = 'rgba(190,206,214,0.55)';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      let y = rain.y[i] + rain.v[i] * dt;
      let x = rain.x[i] + rain.v[i] * dt * slant;
      if (y > g.H) {
        y = g.eave + (y - g.H) * 0.5;
        x -= (g.H - g.eave) * slant;
      }
      rain.y[i] = y;
      rain.x[i] = x > g.W + g.H * 0.1 ? x - g.W - g.H * 0.2 : x;
      ctx.moveTo(rain.x[i], y);
      ctx.lineTo(rain.x[i] - rain.l[i] * slant, y - rain.l[i]);
    }
    ctx.stroke();
  }

  function drawFlow(ctx, g, t, flow) {
    const x = g.cx;
    const u = g.u;
    const w = Math.max(1, u * 0.5);
    ctx.fillStyle = 'rgba(190,220,232,0.9)';
    for (let i = 0; i < CUPS; i++) {
      const c = cupGeometry(g, i);
      // brimming water in the cup mouth, shimmering
      const sh = 0.55 + 0.45 * Math.sin(t * 3.1 + i * 1.7);
      ctx.globalAlpha = Math.min(1, flow) * (0.55 + sh * 0.4);
      blob(ctx, x, c.y, c.rim * 0.8, c.rim * 0.2);
      // thread of water dropping to the next cup, drawn as moving dashes
      const bottom = c.y + c.h;
      const next = i + 1 < CUPS ? cupGeometry(g, i + 1).y : g.water;
      const gap = next - bottom;
      ctx.globalAlpha = Math.min(1, 0.35 + flow * 0.4);
      for (let k = 0; k < 3; k++) {
        const f = (t * (1.4 + flow * 0.5) + i * 0.37 + k / 3) % 1;
        const dy = bottom + gap * f;
        ctx.fillRect(x - w / 2, dy, w, Math.max(1, gap * 0.16));
      }
    }
    ctx.globalAlpha = 1;
    // a bright sheen sliding down the copper
    const span = g.water - g.top;
    const s = ((t * 0.11) % 1) * span + g.top;
    ctx.fillStyle = 'rgba(240,210,150,0.5)';
    ctx.fillRect(x - u * 0.3, s, Math.max(1, u * 0.6), u * 1.6);
  }

  function drawBasin(ctx, g, t, flow, rain) {
    const x = g.cx;
    const y = g.basinY;
    const rx = g.u * 15 * 0.82;
    const ry = g.u * 4.6 * 0.68;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.clip();
    ctx.lineWidth = Math.max(1, g.u * 0.3);
    for (let i = 0; i < RINGS; i++) {
      const rate = 0.5 + 0.12 * i;
      const f = (t * rate * (0.5 + flow * 0.5) + i / RINGS) % 1;
      const ox = i === 0 ? 0 : Math.sin(i * 12.9898) * rx * 0.55 * Math.min(1, rain);
      const oy = i === 0 ? 0 : Math.cos(i * 7.233) * ry * 0.4;
      const r = f * rx * (i === 0 ? 0.9 : 0.5);
      ctx.strokeStyle = 'rgba(200,226,236,' + (0.75 * (1 - f)).toFixed(2) + ')';
      ctx.beginPath();
      ctx.ellipse(x + ox, y + oy, Math.max(0.5, r), Math.max(0.3, r * 0.34), 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    // small splash droplets at the foot of the chain
    ctx.fillStyle = 'rgba(210,232,240,0.85)';
    for (let k = 0; k < 4; k++) {
      const f = (t * 1.6 + k * 0.25) % 1;
      const dir = k % 2 ? 1 : -1;
      const px = x + dir * g.u * (0.8 + k * 0.7) * f * 2;
      const py = g.water - Math.sin(f * Math.PI) * g.u * (1.2 + k * 0.35);
      ctx.fillRect(px, py, Math.max(1, g.u * 0.35), Math.max(1, g.u * 0.35));
    }
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    state.back = paintBack(g, rand);
    state.chain = paintChain(g);
    state.rain = makeRain(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { rain, flow } = api.props;
    ctx.drawImage(state.back, 0, 0);
    ctx.drawImage(state.chain, 0, 0);
    drawFlow(ctx, g, t, flow);
    drawBasin(ctx, g, t, flow, rain);
    drawRain(ctx, g, Math.min(dt, 0.1), rain);
  }

  Kasuri.run({
    defaults: { rain: 1, flow: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.2, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
