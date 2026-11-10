/*
 * 沙漠 Shamo — a ruined rammed-earth beacon tower above Silk Road dunes.
 *
 * Sky, sun or moon, far dunes, tower and near dunes are baked into two layers and
 * repainted once a minute from the clock. Between repaints only a few sand
 * sheets slide sideways and a short pool of wind streaks drifts low.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.56;
  const TOWER = { x: 0.7, w: 0.1, top: 0.22 };
  const RETINT_SECONDS = 60;
  const STREAKS = 46;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    const warm = mixColor(sky.low, rgb('#d8b078'), 0.25 * (1 - sky.night));
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(warm));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintOrb(ctx, g, sky);
    return c;
  }

  function paintOrb(ctx, g, sky) {
    const night = sky.night > 0.5;
    const t = night ? S.moonT(sky.hour) : S.sunT(sky.hour);
    const ox = g.W * (0.12 + t * 0.5);
    const oy = g.H * (0.34 - Math.sin(t * Math.PI) * 0.22);
    const r = g.U * (night ? 3.2 : 4.2);
    const halo = ctx.createRadialGradient(ox, oy, 0, ox, oy, r * 5);
    const tint = night ? '226,228,214' : '248,226,176';
    halo.addColorStop(0, `rgba(${tint},${night ? 0.3 : 0.45})`);
    halo.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = halo;
    ctx.fillRect(ox - r * 5, oy - r * 5, r * 10, r * 10);
    ctx.fillStyle = night ? '#e4e4d8' : '#f4dca4';
    ctx.beginPath();
    ctx.arc(ox, oy, r, 0, 6.3);
    ctx.fill();
  }

  // ---- dunes -------------------------------------------------------------

  // Sharp crests, rounded troughs: |sin| gives a cusp at the crest.
  function crests(x, scale, phase, amp) {
    return (1 - Math.abs(Math.sin(x / scale + phase))) * amp;
  }

  function farRidge(g, x) {
    const u = g.U;
    return g.H * 0.52 - crests(x, u * 22, 1, u * 3.2) - crests(x, u * 9, 2, u * 0.7);
  }

  function midRidge(g, x) {
    const u = g.U;
    return g.H * 0.62 - crests(x, u * 26, 4, u * 6) - crests(x, u * 8, 1, u * 0.9);
  }

  function nearRidge(g, x) {
    const u = g.U;
    return g.H * 0.86 - crests(x, u * 40, 0.4, u * 13) - crests(x, u * 14, 2, u * 2) + (fbm(x / (u * 22), 9, 2, 3) - 0.5) * u * 2;
  }

  // Windward faces catch the light, lee faces fall into shade; both deepen toward the foot.
  function paintDune(ctx, g, sky, ridge, tone, haze) {
    const lit = mixColor(mixColor(rgb(tone.lit), sky.amb, 0.22), rgb('#2c2a40'), sky.night * 0.7);
    const shade = mixColor(mixColor(rgb(tone.shade), sky.haze, 0.2), rgb('#1a1a30'), sky.night * 0.7);
    const mist = mixColor(sky.low, rgb('#d8b078'), 0.3);
    const mid = mixColor(shade, lit, 0.45);
    const step = Math.max(1, g.U * 0.9);
    for (let x = 0; x < g.W; x++) {
      const top = ridge(g, x);
      const slope = ridge(g, x + 1.5) - ridge(g, x - 1.5);
      const k = smoothstep(-0.7, 0.7, slope);
      for (let y = top; y < g.H; y += step) {
        const d = Math.min(1, (y - top) / (g.U * 14));
        const grip = 1 - d * 0.8;
        const face = mixColor(mid, mixColor(shade, lit, k), grip);
        const c = mixColor(face, mist, haze * (1 - d) * 0.8);
        ctx.fillStyle = hex(c);
        ctx.fillRect(x, y, 1, step + 1);
      }
    }
    return mixColor(shade, lit, 0.3);
  }

  function paintRipples(ctx, g, ridge, ink) {
    ctx.strokeStyle = hex(ink);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    for (let row = 0; row < 9; row++) {
      const dy = g.U * (2 + row * 2.4);
      ctx.beginPath();
      for (let x = 0; x <= g.W; x += 2) {
        const y = ridge(g, x) + dy + Math.sin(x / (g.U * 2.6) + row * 1.7) * g.U * 0.4;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- beacon tower ------------------------------------------------------

  function paintTower(ctx, g, sky) {
    const earth = mixColor(mixColor(rgb('#c09458'), sky.amb, 0.25), rgb('#2c2a42'), sky.night * 0.7);
    const dark = mixColor(mixColor(rgb('#8a6638'), sky.haze, 0.2), rgb('#1c1c32'), sky.night * 0.7);
    const bx = g.W * TOWER.x;
    const baseY = g.H * 0.64;
    const topY = g.H * TOWER.top;
    const wb = g.W * TOWER.w * 0.6;
    const wt = wb * 0.62;
    const u = g.U;
    // Broken crown, left to right: a jagged edge with one tall surviving corner.
    const crown = [[-wt, 1.5], [-wt * 0.6, 0], [-wt * 0.2, 2.6], [wt * 0.05, 1.2], [wt * 0.4, 4.2], [wt, 3]];
    const left = [bx - wb, baseY];
    const right = [bx + wb, baseY];
    const shape = (xs) => {
      ctx.beginPath();
      ctx.moveTo(left[0], left[1]);
      ctx.lineTo(bx + crown[0][0], topY + crown[0][1] * u);
      for (const p of crown) ctx.lineTo(bx + p[0], topY + p[1] * u);
      ctx.lineTo(right[0], right[1]);
      ctx.closePath();
      ctx.fillStyle = xs;
      ctx.fill();
    };
    shape(hex(earth));
    // Shaded right face.
    ctx.save();
    ctx.clip();
    ctx.fillStyle = hex(dark);
    ctx.fillRect(bx + wb * 0.1, topY - u, wb, baseY - topY + u * 2);
    // Rammed earth layers.
    ctx.fillStyle = hex(mixColor(dark, earth, 0.4));
    for (let y = topY + u * 4; y < baseY; y += u * 2.3) ctx.fillRect(bx - wb, y, wb * 2, 1);
    // Eroded pits and a fallen-open doorway.
    ctx.fillStyle = hex(mixColor(dark, rgb('#14121c'), 0.65));
    ctx.fillRect(bx - u * 1.1, baseY - u * 6, u * 2.2, u * 6);
    ctx.fillRect(bx + wt * 0.35, topY + u * 7, u * 1.1, u * 3);
    ctx.fillRect(bx - wt * 0.7, topY + u * 12, u * 0.9, u * 2);
    ctx.restore();
    // Fallen earth heaped at the foot.
    ctx.fillStyle = hex(mixColor(dark, earth, 0.3));
    for (let i = 0; i < 26; i++) {
      const f = i / 25 - 0.5;
      const h = u * (3.2 - Math.abs(f) * 4.5);
      if (h > 0.3) ctx.fillRect(bx + f * wb * 3.2, baseY - h + u * 0.4, u * 0.9, h);
    }
  }

  // A low stub of old wall running off to the left of the tower.
  function paintWall(ctx, g, sky) {
    const earth = mixColor(mixColor(rgb('#a8814e'), sky.haze, 0.3), rgb('#26263c'), sky.night * 0.7);
    ctx.fillStyle = hex(earth);
    const bx = g.W * TOWER.x - g.W * TOWER.w * 0.4;
    const baseY = g.H * 0.64;
    for (let x = bx; x > g.W * 0.38; x -= 1) {
      const d = (bx - x) / (g.W * 0.32);
      const h = g.U * (4.2 - d * 3.2) * (0.6 + fbm(x * 0.2, 1, 2, 5) * 0.8);
      if (h > 0.4) ctx.fillRect(x, baseY - h, 1, h + 1);
    }
  }

  // ---- bake --------------------------------------------------------------

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintDune(ctx, g, sky, farRidge, { lit: '#c8a874', shade: '#a68866' }, 0.55);
    paintWall(ctx, g, sky);
    paintDune(ctx, g, sky, midRidge, { lit: '#d8ac66', shade: '#a67e4a' }, 0.25);
    paintTower(ctx, g, sky);
    const ink = paintDune(ctx, g, sky, nearRidge, { lit: '#e4ba70', shade: '#a67a44' }, 0);
    paintRipples(ctx, g, nearRidge, ink);
    return c;
  }

  // One tiling sheet of drifting haze, brighter near the ground.
  function paintHaze(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.03, y * 0.16, 3, 13), fbm((x - w) * 0.03, y * 0.16, 3, 13), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 236;
        img.data[i + 1] = 214;
        img.data[i + 2] = 170;
        img.data[i + 3] = smoothstep(0.48, 0.7, v) * band * 120;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function makeStreaks(g, rand) {
    const out = [];
    for (let i = 0; i < STREAKS; i++) {
      out.push({
        x: rand(),
        y: g.H * (0.6 + rand() * 0.38),
        len: g.U * (3 + rand() * 6),
        speed: 0.012 + rand() * 0.02,
        lift: rand() * 6.3,
        a: 0.25 + rand() * 0.4,
      });
    }
    return out;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(47);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.hazeAlpha = 0.9 - sky.night * 0.65;
    state.tone = hex(mixColor(rgb('#ecd6a8'), rgb('#6a6c92'), sky.night * 0.8));
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawHaze(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.haze;
    const off = -((t * g.U * 2.4) % c.width);
    ctx.globalAlpha = Math.min(1, state.hazeAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.64);
    ctx.drawImage(c, off + c.width, g.H * 0.64);
    ctx.globalAlpha = 1;
  }

  function drawStreaks(ctx, g, t, amount) {
    if (amount <= 0) return;
    ctx.fillStyle = state.tone;
    const n = Math.round(STREAKS * Math.min(1, amount));
    for (let i = 0; i < n; i++) {
      const s = state.streaks[i];
      const p = (s.x + t * s.speed * amount) % 1;
      const px = p * (g.W + s.len * 2) - s.len;
      const py = s.y + Math.sin(t * 0.8 + s.lift) * g.U * 0.5 - p * g.U * 0.6;
      ctx.globalAlpha = s.a * Math.sin(p * Math.PI);
      ctx.fillRect(px, py, s.len, 1);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.haze = paintHaze(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.3));
    state.streaks = makeStreaks(g, K.rng(5));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.front, 0, 0);
    drawHaze(ctx, g, t, props.wind);
    drawStreaks(ctx, g, t, props.wind);
  }

  Kasuri.run({
    defaults: { time: 'auto', wind: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
