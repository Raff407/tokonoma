/*
 * 泰山 Taishan — a long stone stairway climbing the sacred peak to a temple
 * roof above a sea of cloud.
 *
 * Sky, far ranges, the mountain with its stairway and pines, and the temple
 * are baked into layers and repainted once a minute from the clock. Between
 * repaints only two banks of cloud, a glint on the roof and a few cranes move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep, clamp } = K;

  const RETINT_SECONDS = 60;
  const PEAK = { x: 0.6, y: 0.31 };
  // Switchbacks from the cloud up to the temple gate, as screen fractions.
  const STAIR = [
    [0.2, 0.95], [0.46, 0.82], [0.33, 0.71], [0.52, 0.61], [0.44, 0.52], [0.57, 0.43], [0.6, 0.355],
  ];
  const PINES = [
    { x: 0.5, s: 1.4 }, { x: 0.55, s: 1.1 }, { x: 0.64, s: 1.2 }, { x: 0.68, s: 1.8 }, { x: 0.74, s: 1.2 }, { x: 0.4, s: 1.5 },
    { x: 0.3, s: 1.7 }, { x: 0.82, s: 1.5 }, { x: 0.22, s: 1.3 }, { x: 0.9, s: 1.1 },
  ];
  const CRANES = [
    { y: 0.2, speed: 0.012, phase: 0, size: 1 },
    { y: 0.25, speed: 0.011, phase: 0.5, size: 0.8 },
    { y: 0.15, speed: 0.013, phase: 0.8, size: 0.7 },
  ];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);
  const dim = (c, n, k) => mixColor(c, rgb('#12162a'), n * k);

  // ---- mountain shape ----------------------------------------------------

  // Top edge of the peak at column x, as a fraction of the screen height.
  function ridgeFrac(g, x) {
    const f = x / g.W;
    const d = Math.max(0, Math.abs(f - PEAK.x) - 0.045);
    const k = f < PEAK.x ? 1.4 : 1.75;
    return PEAK.y + k * Math.pow(d, 1.1) + (fbm(f * 14, 3, 4, 7) - 0.5) * 0.13 * smoothstep(0, 0.12, d)
      + Math.sin(f * 38) * 0.012 * smoothstep(0.05, 0.2, d);
  }

  function ridgeY(g, x) {
    return g.H * ridgeFrac(g, x);
  }

  // ---- sky and far ranges -----------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.72);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.5, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintLuminary(ctx, g, sky);
    paintFarRanges(ctx, g, sky);
    return c;
  }

  function paintLuminary(ctx, g, sky) {
    const night = sky.night > 0.5;
    const t = night ? S.moonT(sky.hour) : S.sunT(sky.hour);
    const cx = g.W * lerp(0.1, 0.9, t);
    const cy = g.H * (0.64 - 0.5 * Math.sin(Math.PI * t));
    const r = g.U * (night ? 3.2 : 4.2);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 6);
    const tint = night ? 'rgba(200,210,235,' : 'rgba(250,200,130,';
    glow.addColorStop(0, tint + (night ? 0.3 : 0.55) + ')');
    glow.addColorStop(1, tint + '0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r * 6, cy - r * 6, r * 12, r * 12);
    ctx.fillStyle = night ? '#e8e8dc' : '#f4d9a0';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.3);
    ctx.fill();
  }

  function paintFarRanges(ctx, g, sky) {
    const ranks = [
      { seed: 3, base: 0.58, amp: 0.1, mix: 0.7 },
      { seed: 8, base: 0.64, amp: 0.12, mix: 0.5 },
    ];
    for (const r of ranks) {
      const col = mixColor(rgb('#52618a'), sky.haze, r.mix);
      ctx.fillStyle = hex(dim(col, sky.night, 0.55));
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W; x += 2) {
        const f = x / g.W;
        const peak = Math.pow(fbm(f * 3.2, r.seed, 4, r.seed), 1.6);
        ctx.lineTo(x, g.H * (r.base - peak * r.amp * 1.6));
      }
      ctx.lineTo(g.W, g.H);
      ctx.fill();
    }
  }

  // ---- cloud sea ---------------------------------------------------------

  // A bank of cloud that tiles sideways: ragged on top, solid below.
  function paintBank(w, h, seed, sky, bright) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const lit = mixColor(rgb('#f2ece0'), sky.amb, 0.45);
    const shade = mixColor(rgb('#b9b6c4'), sky.low, 0.5);
    const base = dim(mixColor(shade, lit, bright), sky.night, 0.75);
    const top = dim(lit, sky.night, 0.8);
    const dens = (x, y) => fbm(x * 0.018, y * 0.075, 4, seed) + (y / h) * 0.95;
    for (let y = 0; y < h; y++) {
      const k = clamp(y / (h * 0.5), 0, 1);
      const col = mixColor(top, base, k);
      for (let x = 0; x < w; x++) {
        const v = lerp(dens(x, y), dens(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = smoothstep(0.62, 0.8, v) * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- pines -------------------------------------------------------------

  // A pine in the painted manner: a bent trunk with flat tiers of needles.
  function paintPine(ctx, g, px, py, s, sky) {
    const u = g.U * s;
    const ink = hex(dim(rgb('#2a2620'), sky.night, 0.5));
    const moss = hex(dim(mixColor(rgb('#4d6446'), sky.haze, 0.15), sky.night, 0.6));
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, u * 0.35);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px + u * 0.9, py - u * 2.2, px - u * 0.2, py - u * 4.4);
    ctx.stroke();
    ctx.fillStyle = moss;
    const tiers = [[0.6, -2.4, 2.4], [-0.9, -3.5, 2], [0.3, -4.7, 1.7]];
    for (const [dx, dy, w] of tiers) {
      ctx.beginPath();
      ctx.ellipse(px + dx * u, py + dy * u, w * u * 0.75, u * 0.55, 0, 0, 6.3);
      ctx.fill();
    }
  }

  // ---- mountain ----------------------------------------------------------

  function paintMountain(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const rock = dim(mixColor(rgb('#3a4560'), sky.haze, 0.25), sky.night, 0.6);
    const foot = dim(mixColor(rgb('#59607e'), sky.low, 0.35), sky.night, 0.5);
    const body = ctx.createLinearGradient(0, g.H * PEAK.y, 0, g.H * 0.95);
    body.addColorStop(0, hex(rock));
    body.addColorStop(1, hex(foot));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 1) ctx.lineTo(x, ridgeY(g, x));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    const side = ctx.createLinearGradient(g.W * 0.2, 0, g.W * 0.95, 0);
    side.addColorStop(0, 'rgba(210,150,110,' + (0.28 * (1 - sky.night)) + ')');
    side.addColorStop(0.5, 'rgba(0,0,0,0)');
    side.addColorStop(1, 'rgba(10,14,30,0.35)');
    ctx.fillStyle = side;
    ctx.fill();
    paintCliffs(ctx, g, sky, rand);
    paintRim(ctx, g, sky);
    paintStair(ctx, g, sky);
    paintGate(ctx, g, sky);
    paintTrees(ctx, g, sky);
    paintTemple(ctx, g, sky);
    return c;
  }

  function paintCliffs(ctx, g, sky, rand) {
    ctx.lineWidth = 1;
    for (let i = 0; i < g.W * 0.8; i++) {
      const x = rand() * g.W;
      const y0 = ridgeY(g, x) + rand() * g.H * 0.05;
      const len = g.H * (0.04 + rand() * 0.14);
      const lit = rand() < 0.35;
      ctx.strokeStyle = lit ? hex(dim(mixColor(rgb('#8a8aa0'), sky.amb, 0.4), sky.night, 0.7))
        : hex(dim(rgb('#1c2238'), sky.night, 0.5));
      ctx.globalAlpha = 0.18 + rand() * 0.25;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x + (rand() - 0.5) * g.U * 1.2, y0 + len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Warm morning light on the edge of the peak facing the sun.
  function paintRim(ctx, g, sky) {
    const warm = hex(mixColor(rgb('#e0a65a'), sky.amb, 0.3));
    ctx.strokeStyle = warm;
    ctx.lineWidth = Math.max(1, g.U * 0.5);
    ctx.globalAlpha = (1 - sky.night) * 0.7;
    ctx.beginPath();
    const stop = g.W * PEAK.x;
    for (let x = 0; x <= stop; x += 1) {
      const y = ridgeY(g, x);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function stairPoints(g) {
    return STAIR.map(([fx, fy]) => {
      const x = g.W * fx;
      return [x, Math.max(g.H * fy, ridgeY(g, x) + g.H * 0.05)];
    });
  }

  function paintStair(ctx, g, sky) {
    const pts = stairPoints(g);
    const stone = hex(dim(mixColor(rgb('#d8d2c2'), sky.amb, 0.35), sky.night, 0.7));
    const edge = hex(dim(rgb('#4a4a58'), sky.night, 0.5));
    const w = g.U * 2;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = edge;
    ctx.lineWidth = w + 2;
    strokeLine(ctx, pts);
    ctx.strokeStyle = stone;
    ctx.lineWidth = w;
    strokeLine(ctx, pts);
    // Step lines across each flight.
    ctx.strokeStyle = hex(dim(rgb('#7c7a86'), sky.night, 0.5));
    ctx.lineWidth = 1;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const nx = -(y1 - y0) / len;
      const ny = (x1 - x0) / len;
      const n = Math.floor(len / (g.U * 1.2));
      for (let s = 1; s < n; s++) {
        const t = s / n;
        const cx = lerp(x0, x1, t);
        const cy = lerp(y0, y1, t);
        ctx.beginPath();
        ctx.moveTo(cx - nx * w * 0.5, cy - ny * w * 0.5);
        ctx.lineTo(cx + nx * w * 0.5, cy + ny * w * 0.5);
        ctx.stroke();
      }
    }
  }

  function strokeLine(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }

  // A stone memorial gate astride the stairs, halfway up.
  function paintGate(ctx, g, sky) {
    const pts = stairPoints(g);
    const [gx, gy] = pts[3];
    const u = g.U;
    const post = hex(dim(rgb('#a8412c'), sky.night, 0.55));
    ctx.fillStyle = post;
    ctx.fillRect(gx - u * 2.4, gy - u * 4.6, u * 0.8, u * 4.6);
    ctx.fillRect(gx + u * 1.6, gy - u * 4.6, u * 0.8, u * 4.6);
    ctx.fillRect(gx - u * 3, gy - u * 4.8, u * 6, u * 0.9);
    ctx.fillStyle = hex(dim(rgb('#2f3548'), sky.night, 0.5));
    ctx.fillRect(gx - u * 3.4, gy - u * 5.6, u * 6.8, u * 0.8);
  }

  function paintTrees(ctx, g, sky) {
    for (const p of PINES) {
      const x = g.W * p.x;
      paintPine(ctx, g, x, ridgeY(g, x) + g.H * 0.012, p.s, sky);
    }
    // Low scrub where the mountain meets the cloud.
    ctx.fillStyle = hex(dim(rgb('#3a4a3c'), sky.night, 0.6));
    for (let x = g.W * 0.05; x < g.W * 0.95; x += g.U * 3) {
      if (ridgeY(g, x) > g.H * 0.85) continue;
      ctx.beginPath();
      ctx.ellipse(x, g.H * 0.9, g.U * 1.6, g.U * 0.9, 0, 0, 6.3);
      ctx.fill();
    }
  }

  // ---- temple ------------------------------------------------------------

  // Hip roof with upturned corners; cx is centre, by the eave line.
  function roof(ctx, cx, by, w, h, tile, ridge) {
    ctx.fillStyle = tile;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.28, by - h);
    ctx.lineTo(cx + w * 0.28, by - h);
    ctx.quadraticCurveTo(cx + w * 0.42, by - h * 0.15, cx + w * 0.55, by - h * 0.32);
    ctx.quadraticCurveTo(cx + w * 0.3, by + h * 0.05, cx, by + h * 0.05);
    ctx.quadraticCurveTo(cx - w * 0.3, by + h * 0.05, cx - w * 0.55, by - h * 0.32);
    ctx.quadraticCurveTo(cx - w * 0.42, by - h * 0.15, cx - w * 0.28, by - h);
    ctx.fill();
    ctx.fillStyle = ridge;
    ctx.fillRect(cx - w * 0.3, by - h - 1, w * 0.6, Math.max(1, h * 0.12));
  }

  function paintTemple(ctx, g, sky) {
    const u = g.U;
    const cx = g.W * PEAK.x;
    const ground = g.H * PEAK.y + u * 0.8;
    const n = sky.night;
    const wall = hex(dim(rgb('#b0402c'), n, 0.5));
    const stone = hex(dim(mixColor(rgb('#cfc8b6'), sky.amb, 0.3), n, 0.7));
    const tile = hex(dim(rgb('#2c3a4e'), n, 0.4));
    const gold = hex(dim(rgb('#c9a24a'), n, 0.4));
    // Terrace, then the hall: platform, red wall, two tiers of roof.
    ctx.fillStyle = stone;
    ctx.fillRect(cx - u * 9, ground - u * 1.4, u * 18, u * 1.6);
    ctx.fillRect(cx - u * 7.5, ground - u * 2.6, u * 15, u * 1.3);
    ctx.fillStyle = wall;
    ctx.fillRect(cx - u * 5.2, ground - u * 6.6, u * 10.4, u * 4);
    ctx.fillStyle = hex(dim(rgb('#2a1f1c'), n, 0.5));
    for (let k = -2; k <= 2; k++) ctx.fillRect(cx + k * u * 2 - u * 0.4, ground - u * 6, u * 0.8, u * 3.4);
    roof(ctx, cx, ground - u * 6.4, u * 17, u * 3, tile, gold);
    ctx.fillStyle = wall;
    ctx.fillRect(cx - u * 3, ground - u * 10.4, u * 6, u * 2.4);
    roof(ctx, cx, ground - u * 10, u * 12, u * 2.6, tile, gold);
    ctx.fillStyle = gold;
    ctx.fillRect(cx - u * 0.3, ground - u * 14.2, u * 0.6, u * 1.6);
    // Small side hall on the left.
    ctx.fillStyle = wall;
    ctx.fillRect(cx - u * 14, ground - u * 3.8, u * 4.4, u * 2.2);
    roof(ctx, cx - u * 11.8, ground - u * 3.6, u * 8, u * 1.7, tile, gold);
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(41);
    const bw = Math.ceil(g.W * 1.3);
    state.sky = paintSky(g, sky, rand);
    state.mountain = paintMountain(g, sky, rand);
    state.back = paintBank(bw, Math.ceil(g.H * 0.34), 17, sky, 0.6);
    state.front = paintBank(bw, Math.ceil(g.H * 0.2), 29, sky, 0.9);
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawBank(ctx, g, t, bank, y, rate, alpha) {
    const off = -((t * g.U * rate) % bank.width);
    ctx.globalAlpha = alpha;
    ctx.drawImage(bank, off, y);
    ctx.drawImage(bank, off + bank.width, y);
    ctx.globalAlpha = 1;
  }

  function drawGlint(ctx, g, t) {
    const u = g.U;
    const a = Math.max(0, Math.sin(t * 0.6)) * 0.6 * (1 - state.night * 0.6);
    ctx.fillStyle = '#f4e2a8';
    ctx.globalAlpha = a;
    ctx.fillRect(g.W * PEAK.x - u * 0.4, g.H * PEAK.y - u * 13.4, u * 0.8, u * 0.8);
    ctx.globalAlpha = 1;
  }

  function drawCranes(ctx, g, t) {
    ctx.strokeStyle = state.night > 0.5 ? '#aab0c8' : '#f4efe2';
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    ctx.lineCap = 'round';
    for (let i = 0; i < CRANES.length; i++) {
      const c = CRANES[i];
      const x = ((t * c.speed + c.phase) % 1.2 - 0.1) * g.W;
      const y = g.H * c.y + Math.sin(t * 0.5 + i * 2) * g.U * 1.2;
      const s = g.U * 2.2 * c.size;
      const flap = Math.sin(t * 2.4 + i * 1.7) * s * 0.55;
      ctx.beginPath();
      ctx.moveTo(x - s, y - flap);
      ctx.quadraticCurveTo(x - s * 0.4, y - flap * 0.3 - s * 0.2, x, y);
      ctx.quadraticCurveTo(x + s * 0.4, y - flap * 0.3 - s * 0.2, x + s, y - flap);
      ctx.moveTo(x, y);
      ctx.lineTo(x + s * 0.9, y + s * 0.15);
      ctx.moveTo(x, y);
      ctx.lineTo(x - s * 0.9, y + s * 0.1);
      ctx.stroke();
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    if (props.cranes) drawCranes(ctx, g, t);
    drawBank(ctx, g, t, state.back, g.H * 0.6, 1.2, clamp(props.clouds, 0, 1));
    ctx.drawImage(state.mountain, 0, 0);
    drawGlint(ctx, g, t);
    drawBank(ctx, g, t, state.back, g.H * 0.84, 2.2, clamp(props.clouds, 0, 1) * 0.9);
    drawBank(ctx, g, t, state.front, g.H * 0.9, 3.4, clamp(props.clouds, 0, 1));
  }

  Kasuri.run({
    defaults: { time: 'auto', clouds: 1, cranes: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1.1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
