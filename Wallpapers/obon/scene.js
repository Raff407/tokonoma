/*
 * お盆 Obon — welcome fires and paper lanterns along a path to an old
 * thatched farmhouse at dusk.
 *
 * Sky, hills, house, path and lantern bodies are baked once. Each frame adds
 * a few glows, flame sprites, smoke puffs and drifting sparks.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;

  const HORIZON = 0.55;
  const MAX_SPARKS = 44;
  const MAX_PUFFS = 9;
  const SPOTS = [0.07, 0.19, 0.31, 0.44, 0.58, 0.72, 0.86];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Centre line and half width of the path at depth s (0 near, 1 far).
  function pathAt(g, s) {
    const e = Math.pow(s, 0.85);
    const wig = Math.sin(s * 5.2 + 0.6) * 0.045 * (1 - s * 0.6);
    return {
      x: g.W * (lerp(0.3, 0.745, e) + wig),
      y: g.H * lerp(1.02, 0.685, e),
      half: g.W * lerp(0.13, 0.022, e),
      sc: lerp(1.8, 0.5, e),
    };
  }

  // ---- sky and land --------------------------------------------------------

  function paintSky(ctx, g, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, '#171d3c');
    grad.addColorStop(0.45, '#2c3562');
    grad.addColorStop(0.8, '#7a4a58');
    grad.addColorStop(1, '#c47a48');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#e8e0c8';
    for (let i = 0; i < g.W * 0.25; i++) {
      ctx.globalAlpha = 0.15 + rand() * 0.4;
      ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
    }
    ctx.globalAlpha = 1;
    // Pale moon, nearly full.
    const mx = g.W * 0.2;
    const my = g.H * 0.17;
    const halo = ctx.createRadialGradient(mx, my, 0, mx, my, g.U * 11);
    halo.addColorStop(0, 'rgba(232,224,190,0.35)');
    halo.addColorStop(1, 'rgba(232,224,190,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(mx - g.U * 12, my - g.U * 12, g.U * 24, g.U * 24);
    ctx.fillStyle = '#ece4c6';
    ctx.beginPath();
    ctx.arc(mx, my, g.U * 3.6, 0, 6.3);
    ctx.fill();
    // Thin bands of cloud near the horizon.
    ctx.fillStyle = '#3a3158';
    for (let i = 0; i < 5; i++) {
      ctx.globalAlpha = 0.35;
      ctx.fillRect(g.W * (0.05 + rand() * 0.8), g.H * (0.33 + i * 0.03), g.W * (0.12 + rand() * 0.15), Math.max(1, g.U * 0.9));
    }
    ctx.globalAlpha = 1;
  }

  function paintHills(ctx, g) {
    const layers = [
      { base: 0.43, amp: 0.13, seed: 5, col: '#5a5278' },
      { base: 0.5, amp: 0.1, seed: 9, col: '#3c4062' },
      { base: 0.545, amp: 0.06, seed: 14, col: '#2c3450' },
    ];
    for (const l of layers) {
      ctx.fillStyle = l.col;
      ctx.beginPath();
      ctx.moveTo(0, g.H * 0.62);
      for (let x = 0; x <= g.W; x += 2) {
        const n = fbm(x * 0.012, l.seed, 4, l.seed);
        ctx.lineTo(x, g.H * (l.base - l.amp * (n - 0.35)));
      }
      ctx.lineTo(g.W, g.H * 0.62);
      ctx.fill();
    }
  }

  function cedar(ctx, x, base, h, col) {
    ctx.fillStyle = col;
    const w = h * 0.2;
    ctx.beginPath();
    ctx.moveTo(x, base - h);
    ctx.lineTo(x + w, base - h * 0.55);
    ctx.lineTo(x + w * 0.5, base - h * 0.55);
    ctx.lineTo(x + w * 1.2, base - h * 0.2);
    ctx.lineTo(x - w * 1.2, base - h * 0.2);
    ctx.lineTo(x - w * 0.5, base - h * 0.55);
    ctx.lineTo(x - w, base - h * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x - w * 0.15, base - h * 0.2, w * 0.3, h * 0.2);
  }

  function paintTrees(ctx, g, rand) {
    const base = g.H * 0.6;
    const spots = [0.02, 0.07, 0.12, 0.17, 0.5, 0.54, 0.95, 0.985];
    for (const f of spots) {
      cedar(ctx, g.W * f, base + rand() * g.U * 2, g.H * (0.22 + rand() * 0.16), '#161c2c');
    }
  }

  function paintGround(ctx, g, rand) {
    const top = g.H * 0.6;
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, '#2c3a2e');
    grad.addColorStop(1, '#1a2220');
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    // Rice paddies on the left, dark and still with a pale edge.
    ctx.fillStyle = '#3a4a46';
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 4; i++) {
      const y = g.H * (0.62 + i * 0.05);
      ctx.fillRect(0, y, g.W * (0.2 + i * 0.07), g.U * (1.4 + i * 0.5));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#566a4e';
    for (let i = 0; i < g.W * 0.4; i++) {
      ctx.globalAlpha = 0.25 + rand() * 0.3;
      ctx.fillRect(rand() * g.W, top + rand() * (g.H - top), 1, Math.max(1, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
  }

  function paintPath(ctx, g) {
    const steps = 40;
    const left = [];
    const right = [];
    for (let i = 0; i <= steps; i++) {
      const p = pathAt(g, i / steps);
      left.push([p.x - p.half, p.y]);
      right.push([p.x + p.half, p.y]);
    }
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (const p of left) ctx.lineTo(p[0], p[1]);
    for (let i = steps; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, g.H * 0.68, 0, g.H);
    grad.addColorStop(0, '#9a7a56');
    grad.addColorStop(1, '#5e4a3a');
    ctx.fillStyle = grad;
    ctx.fill();
    // Stepping stones set in the earth.
    ctx.fillStyle = '#b8a07a';
    for (let i = 1; i < 12; i++) {
      const s = i / 12;
      const p = pathAt(g, s);
      ctx.globalAlpha = 0.5;
      ctx.fillRect(p.x - p.half * 0.35, p.y, p.half * 0.7, Math.max(1, p.sc * g.U * 0.8));
    }
    ctx.globalAlpha = 1;
  }

  // ---- house -----------------------------------------------------------------

  function paintHouse(ctx, g, rand) {
    const wl = g.W * 0.58;
    const wr = g.W * 0.92;
    const wt = g.H * 0.575;
    const wb = g.H * 0.665;
    // Back wall and shoji panels glowing from the hearth inside.
    ctx.fillStyle = '#2a1e1a';
    ctx.fillRect(wl, wt, wr - wl, wb - wt);
    const panels = 6;
    const pw = (wr - wl) / panels;
    for (let i = 0; i < panels; i++) {
      const x = wl + i * pw + pw * 0.08;
      const gx = ctx.createLinearGradient(0, wt, 0, wb);
      gx.addColorStop(0, '#caa05a');
      gx.addColorStop(1, '#e8c07a');
      ctx.fillStyle = gx;
      ctx.fillRect(x, wt + g.U * 0.6, pw * 0.84, wb - wt - g.U * 1.2);
      ctx.fillStyle = '#4a3226';
      ctx.fillRect(x + pw * 0.42, wt + g.U * 0.6, Math.max(1, g.U * 0.3), wb - wt - g.U * 1.2);
      ctx.fillRect(x, wt + (wb - wt) * 0.5, pw * 0.84, Math.max(1, g.U * 0.3));
    }
    // Posts and a long veranda board.
    ctx.fillStyle = '#3c2a20';
    for (let i = 0; i <= panels; i++) ctx.fillRect(wl + i * pw - g.U * 0.25, wt, Math.max(1, g.U * 0.6), wb - wt);
    ctx.fillStyle = '#5a4130';
    ctx.fillRect(wl - g.U, wb, wr - wl + g.U * 2, g.U * 1.3);
    ctx.fillStyle = '#2a1e18';
    ctx.fillRect(wl, wb + g.U * 1.3, wr - wl, g.U * 1.6);
    // Thatched roof: thick hipped shape with a straight ridge.
    const ridgeY = g.H * 0.37;
    const rl = g.W * 0.655;
    const rr = g.W * 0.845;
    const eaveY = g.H * 0.595;
    const eL = g.W * 0.51;
    const eR = g.W * 0.99;
    const grad = ctx.createLinearGradient(0, ridgeY, 0, eaveY);
    grad.addColorStop(0, '#4a4228');
    grad.addColorStop(1, '#2e2a1e');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(rl, ridgeY);
    ctx.lineTo(rr, ridgeY);
    ctx.quadraticCurveTo(g.W * 0.93, eaveY - g.H * 0.09, eR, eaveY);
    ctx.lineTo(eL, eaveY);
    ctx.quadraticCurveTo(g.W * 0.57, eaveY - g.H * 0.09, rl, ridgeY);
    ctx.closePath();
    ctx.fill();
    // Straw streaks.
    for (let i = 0; i < g.W * 0.9; i++) {
      const t = rand();
      const x = lerp(eL, eR, t);
      const top = lerp(ridgeY + g.U * 1.5, eaveY - g.U * 4, Math.abs(t - 0.5) * 2);
      ctx.fillStyle = rand() < 0.5 ? '#5e5434' : '#1e1a14';
      ctx.globalAlpha = 0.28;
      ctx.fillRect(x, top + rand() * (eaveY - top) * 0.6, 1, Math.max(1, (eaveY - top) * (0.2 + rand() * 0.3)));
    }
    ctx.globalAlpha = 1;
    // Eave shadow, ridge cap and the crossed gable ends.
    ctx.fillStyle = '#17120e';
    ctx.fillRect(eL, eaveY - g.U * 0.6, eR - eL, g.U * 1.4);
    ctx.fillStyle = '#242018';
    ctx.fillRect(rl - g.U * 0.5, ridgeY - g.U * 1.2, rr - rl + g.U, g.U * 1.6);
    for (let x = rl; x < rr; x += g.U * 2.4) ctx.fillRect(x, ridgeY - g.U * 2, g.U * 0.9, g.U * 1);
    ctx.strokeStyle = '#17120e';
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    for (const gx of [rl, rr]) {
      ctx.beginPath();
      ctx.moveTo(gx - g.U * 1.2, ridgeY - g.U * 2.4);
      ctx.lineTo(gx + g.U * 1.2, ridgeY + g.U * 0.5);
      ctx.moveTo(gx + g.U * 1.2, ridgeY - g.U * 2.4);
      ctx.lineTo(gx - g.U * 1.2, ridgeY + g.U * 0.5);
      ctx.stroke();
    }
  }

  // ---- lanterns and fires ------------------------------------------------------

  function lanternBody(ctx, x, y, r, tall) {
    ctx.fillStyle = '#2a1e18';
    ctx.fillRect(x - r * 0.45, y - tall * 0.5 - r * 0.3, r * 0.9, r * 0.35);
    ctx.fillRect(x - r * 0.45, y + tall * 0.5 - r * 0.05, r * 0.9, r * 0.35);
    ctx.fillStyle = '#c4452e';
    ctx.beginPath();
    ctx.ellipse(x, y, r, tall * 0.5, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#e8a860';
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.55, tall * 0.36, 0, 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#5a1e14';
    ctx.lineWidth = Math.max(1, r * 0.12);
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.ellipse(x, y, r, Math.abs(k) * tall * 0.2 + 0.01, 0, 0, 6.3);
      ctx.stroke();
    }
  }

  function paintStations(ctx, g, stations) {
    for (const st of stations) {
      const u = g.U * st.sc;
      if (st.kind === 'fire') {
        // A shallow clay dish on stones with a small heap of straw.
        ctx.fillStyle = '#1c1612';
        ctx.fillRect(st.x - u * 2.2, st.y - u * 1.2, u * 4.4, u * 1.4);
        ctx.fillStyle = '#7a5a3a';
        ctx.fillRect(st.x - u * 1.7, st.y - u * 2.1, u * 3.4, u * 1);
        ctx.fillStyle = '#c8a050';
        ctx.fillRect(st.x - u * 1.2, st.y - u * 3, u * 2.4, u * 1);
      } else {
        // Lantern on a thin wooden pole.
        ctx.fillStyle = '#2a1e18';
        ctx.fillRect(st.x - u * 0.3, st.y - u * 11, u * 0.6, u * 11);
        lanternBody(ctx, st.x, st.y - u * 11, u * 2.1, u * 4.6);
      }
    }
    // Lanterns hanging along the eaves.
    for (const h of state.hanging) {
      ctx.fillStyle = '#17120e';
      ctx.fillRect(h.x - 0.5, g.H * 0.595, 1, h.y - g.H * 0.595 - h.r);
      lanternBody(ctx, h.x, h.y, h.r, h.r * 2.1);
    }
  }

  function makeStations(g) {
    const out = [];
    SPOTS.forEach((s, i) => {
      const p = pathAt(g, s);
      const left = i % 2 === 0;
      out.push({
        kind: left ? 'fire' : 'lantern',
        x: p.x + (left ? -1 : 1) * (p.half + p.sc * g.U * 3),
        y: p.y,
        sc: p.sc,
      });
      const other = pathAt(g, s + 0.065);
      out.push({
        kind: left ? 'lantern' : 'fire',
        x: other.x + (left ? 1 : -1) * (other.half + other.sc * g.U * 3),
        y: other.y,
        sc: other.sc,
      });
    });
    out.sort((a, b) => a.y - b.y);
    return out;
  }

  function paintFlame() {
    const c = layer(24, 40);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 40);
    grad.addColorStop(0, 'rgba(232,160,70,0)');
    grad.addColorStop(0.4, 'rgba(224,130,50,0.9)');
    grad.addColorStop(1, 'rgba(244,214,130,1)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.quadraticCurveTo(22, 20, 20, 30);
    ctx.quadraticCurveTo(12, 42, 4, 30);
    ctx.quadraticCurveTo(2, 20, 12, 0);
    ctx.fill();
    return c;
  }

  function paintGlow(rgb) {
    const c = layer(48, 48);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(24, 24, 0, 24, 24, 24);
    grad.addColorStop(0, `rgba(${rgb},0.55)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 48, 48);
    return c;
  }

  function paintPuff() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(150,140,150,0.35)');
    grad.addColorStop(1, 'rgba(150,140,150,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  // ---- foreground --------------------------------------------------------------

  function paintFront(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.strokeStyle = '#0e1210';
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    // Pampas stems curling at both lower corners.
    for (let i = 0; i < 26; i++) {
      const left = i < 13;
      const bx = left ? rand() * g.W * 0.14 : g.W * (0.88 + rand() * 0.12);
      const h = g.H * (0.1 + rand() * 0.14);
      const lean = (left ? 1 : -1) * g.U * (1 + rand() * 4);
      ctx.beginPath();
      ctx.moveTo(bx, g.H);
      ctx.quadraticCurveTo(bx + lean * 0.3, g.H - h * 0.6, bx + lean, g.H - h);
      ctx.stroke();
      ctx.fillStyle = '#2a2a24';
      ctx.fillRect(bx + lean - g.U * 0.5, g.H - h - g.U * 2, g.U, g.U * 2.4);
    }
    return c;
  }

  // ---- motion --------------------------------------------------------------------

  function resetSpark(g, s, i, scatter) {
    const fires = state.fires;
    const f = fires[(Math.random() * fires.length) | 0];
    s.x[i] = f.x + (Math.random() - 0.5) * g.U * f.sc * 2;
    s.y[i] = f.y - g.U * f.sc * 4;
    s.vx[i] = (Math.random() - 0.4) * g.U * 1.2;
    s.vy[i] = -g.U * (2.5 + Math.random() * 4);
    s.life[i] = scatter ? Math.random() : 0;
    s.span[i] = 2.5 + Math.random() * 3.5;
    s.ph[i] = Math.random() * 6.3;
  }

  function drawFires(ctx, g, t, glow) {
    const flame = state.flame;
    for (let i = 0; i < state.fires.length; i++) {
      const f = state.fires[i];
      const u = g.U * f.sc;
      const fl = 0.8 + 0.2 * Math.sin(t * 7.3 + i * 2.1) + 0.1 * Math.sin(t * 13 + i);
      if (glow > 0) {
        const r = u * 13;
        ctx.globalAlpha = Math.min(1, 0.7 * glow * fl);
        ctx.drawImage(state.glowWarm, f.x - r, f.y - u * 4 - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      const h = u * (5 + fl * 3.5);
      const w = u * (2.6 + Math.sin(t * 9 + i) * 0.4);
      ctx.drawImage(flame, f.x - w / 2 + Math.sin(t * 5 + i) * u * 0.3, f.y - u * 3 - h, w, h);
    }
  }

  function drawLanterns(ctx, g, t, glow) {
    if (glow <= 0) return;
    for (let i = 0; i < state.lights.length; i++) {
      const l = state.lights[i];
      const r = g.U * l.sc * 9;
      ctx.globalAlpha = Math.min(1, 0.55 * glow * (0.9 + 0.1 * Math.sin(t * 2 + i * 1.7)));
      ctx.drawImage(state.glowRed, l.x - r, l.y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawSmoke(ctx, g, t, amount) {
    if (amount <= 0) return;
    const n = Math.min(MAX_PUFFS, Math.ceil(MAX_PUFFS * amount));
    const sx = g.W * 0.8;
    const sy = g.H * 0.4;
    for (let i = 0; i < n; i++) {
      const a = (t * 0.06 + i / n) % 1;
      const size = g.U * (3 + a * 12);
      ctx.globalAlpha = (1 - a) * Math.min(1, amount);
      ctx.drawImage(state.puff, sx + a * g.W * 0.12 + Math.sin(t * 0.5 + i) * g.U - size / 2, sy - a * g.H * 0.3 - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawSparks(ctx, g, t, dt, amount) {
    if (amount <= 0) return;
    const s = state.sparks;
    const n = Math.min(MAX_SPARKS, Math.round(MAX_SPARKS * amount));
    const step = Math.min(dt, 0.1);
    ctx.fillStyle = '#f0b868';
    for (let i = 0; i < n; i++) {
      s.life[i] += step / s.span[i];
      if (s.life[i] >= 1) resetSpark(g, s, i, false);
      s.x[i] += (s.vx[i] + Math.sin(t * 1.3 + s.ph[i]) * g.U * 1.1) * step;
      s.y[i] += s.vy[i] * step;
      const a = Math.sin(s.life[i] * Math.PI);
      ctx.globalAlpha = Math.min(1, a * 1.1);
      const sz = Math.max(1, g.U * 0.4);
      ctx.fillRect(s.x[i], s.y[i], sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.hanging = [0.6, 0.72, 0.84].map((f, i) => ({ x: g.W * f, y: g.H * (0.628 + (i % 2) * 0.01), r: g.U * 1.7 }));
    const stations = makeStations(g);
    state.fires = stations.filter((s) => s.kind === 'fire');
    state.lights = stations
      .filter((s) => s.kind === 'lantern')
      .map((s) => ({ x: s.x, y: s.y - g.U * s.sc * 11, sc: s.sc }))
      .concat(state.hanging.map((h) => ({ x: h.x, y: h.y, sc: 0.8 })));
    const back = layer(g.W, g.H);
    const bctx = back.getContext('2d');
    paintSky(bctx, g, rand);
    paintHills(bctx, g);
    paintTrees(bctx, g, rand);
    paintGround(bctx, g, rand);
    paintHouse(bctx, g, rand);
    paintPath(bctx, g);
    paintStations(bctx, g, stations);
    state.back = back;
    state.front = paintFront(g, rand);
    state.flame = paintFlame();
    state.glowWarm = paintGlow('232,150,70');
    state.glowRed = paintGlow('220,90,60');
    state.puff = paintPuff();
    state.sparks = {
      x: new Float32Array(MAX_SPARKS),
      y: new Float32Array(MAX_SPARKS),
      vx: new Float32Array(MAX_SPARKS),
      vy: new Float32Array(MAX_SPARKS),
      life: new Float32Array(MAX_SPARKS),
      span: new Float32Array(MAX_SPARKS),
      ph: new Float32Array(MAX_SPARKS),
    };
    for (let i = 0; i < MAX_SPARKS; i++) resetSpark(g, state.sparks, i, true);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { sparks, glow, smoke } = api.props;
    ctx.drawImage(state.back, 0, 0);
    drawSmoke(ctx, g, t, smoke);
    drawLanterns(ctx, g, t, glow);
    drawFires(ctx, g, t, glow);
    drawSparks(ctx, g, t, dt, sparks);
    ctx.drawImage(state.front, 0, 0);
  }

  Kasuri.run({
    defaults: { sparks: 1, glow: 1, smoke: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
