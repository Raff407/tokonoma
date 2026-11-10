/*
 * 西湖 West Lake — misty lake, willow causeway, stone arch bridge, slim pagoda on a hill.
 *
 * Sky, hills, causeway, bridge and pagoda are baked into one layer and repainted once a
 * minute from the clock. The lake is that layer flipped and laid back in thin rows that
 * slide sideways. Between repaints only mist, willow strands, a covered boat and a few
 * glints move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const TAU = Math.PI * 2;
  const WATER = 0.62;
  const PAGODA = { x: 0.74, tiers: 7 };
  const BRIDGE = { x: 0.36, half: 0.075 };
  const CAUSEWAY_END = 0.68;
  const RETINT_SECONDS = 60;
  const ROW = 2;
  const GLINTS = 22;
  const STRANDS = 90;
  const BOAT_SECONDS = 150;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

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
    return { W, H, U, wy: Math.round(H * WATER) };
  }

  // Tint an ink toward the sky haze (distance) and toward night.
  function tone(sky, ink, haze, dark) {
    const base = mixColor(rgb(ink), sky.haze, haze);
    return hex(mixColor(base, rgb('#10142a'), sky.night * dark));
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(ctx, g, sky, rand) {
    const grad = ctx.createLinearGradient(0, 0, 0, g.wy);
    grad.addColorStop(0, hex(mixColor(sky.top, rgb('#d8d4c4'), 0.25)));
    grad.addColorStop(1, hex(mixColor(sky.low, rgb('#e6e0cc'), 0.45)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.wy);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.3; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.4);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ece6cf';
      ctx.globalAlpha = 0.9 * sky.night;
      blob(ctx, g.W * 0.2, g.H * 0.13, g.U * 2.4, g.U * 2.4);
      ctx.globalAlpha = 0.12 * sky.night;
      blob(ctx, g.W * 0.2, g.H * 0.13, g.U * 6, g.U * 6);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = '#f4ecd2';
      ctx.globalAlpha = 0.35 * (1 - sky.night);
      blob(ctx, g.W * 0.45, g.H * 0.2, g.U * 3.2, g.U * 3.2);
      ctx.globalAlpha = 0.12;
      blob(ctx, g.W * 0.45, g.H * 0.2, g.U * 9, g.U * 9);
      ctx.globalAlpha = 1;
    }
  }

  // ---- hills -------------------------------------------------------------

  function ridgeFar(g, x) {
    return g.H * 0.36 + (fbm(x / (g.U * 38), 1.7, 4, 13) - 0.5) * g.H * 0.16
      - Math.exp(-(((x - g.W * 0.12) / (g.W * 0.12)) ** 2)) * g.H * 0.09;
  }

  function ridgePagoda(g, x) {
    const px = g.W * PAGODA.x;
    const hump = Math.exp(-(((x - px) / (g.W * 0.24)) ** 2));
    return g.H * 0.5 - hump * g.H * 0.15 + (fbm(x / (g.U * 20), 3.1, 3, 29) - 0.5) * g.H * 0.04;
  }

  function ridgeNear(g, x) {
    const l = Math.exp(-((x / (g.W * 0.2)) ** 2));
    return g.H * 0.57 - l * g.H * 0.09 + (fbm(x / (g.U * 22), 5.2, 3, 7) - 0.5) * g.H * 0.03;
  }

  function fillRidge(ctx, g, fn, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, g.wy);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, fn(g, x));
    ctx.lineTo(g.W + 2, g.wy);
    ctx.closePath();
    ctx.fill();
  }

  // Soft pale band sitting in the hollows between hill layers.
  function mistBand(ctx, g, sky, y, h, alpha) {
    const grad = ctx.createLinearGradient(0, y - h, 0, y + h);
    const c = hex(mixColor(rgb('#e8e4d6'), sky.low, 0.35));
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, c);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - h, g.W, h * 2);
    ctx.globalAlpha = 1;
  }

  function paintHills(ctx, g, sky, rand) {
    fillRidge(ctx, g, ridgeFar, tone(sky, '#5c6e72', 0.62, 0.5));
    mistBand(ctx, g, sky, g.H * 0.48, g.U * 7, 0.7);
    fillRidge(ctx, g, ridgePagoda, tone(sky, '#3f5a4c', 0.4, 0.6));
    // Small pine crowns along the pagoda hill.
    ctx.fillStyle = tone(sky, '#2c4636', 0.3, 0.6);
    for (let x = g.W * 0.5; x < g.W; x += g.U * (1.2 + rand() * 1.4)) {
      const top = ridgePagoda(g, x);
      if (top > g.H * 0.46) continue;
      blob(ctx, x, top + g.U * rand() * 1.5, g.U * (0.8 + rand() * 0.9), g.U * (0.6 + rand() * 0.5));
    }
    mistBand(ctx, g, sky, g.H * 0.56, g.U * 5, 0.6);
    fillRidge(ctx, g, ridgeNear, tone(sky, '#2f4a3a', 0.22, 0.65));
    ctx.fillStyle = tone(sky, '#263d30', 0.15, 0.65);
    for (let x = 0; x < g.W * 0.42; x += g.U * (0.9 + rand() * 1.2)) {
      blob(ctx, x, ridgeNear(g, x) + g.U * rand() * 2, g.U * (0.9 + rand()), g.U * (0.7 + rand() * 0.6));
    }
  }

  // ---- pagoda ------------------------------------------------------------

  // Slim octagonal pagoda: stacked tiers, dark upturned eaves, a gold finial.
  function paintPagoda(ctx, g, sky) {
    const u = g.U;
    const px = g.W * PAGODA.x;
    const top = ridgePagoda(g, px);
    const base = top + u * 1.2;
    const n = PAGODA.tiers;
    const total = u * 27;
    const tier = total / (n + 1.2);
    const wall = tone(sky, '#a05238', 0.22, 0.55);
    const eave = tone(sky, '#2b2c34', 0.12, 0.35);
    const rim = tone(sky, '#5a4a40', 0.2, 0.4);
    const w0 = u * 4.6;
    // Stone plinth.
    ctx.fillStyle = tone(sky, '#8c887a', 0.3, 0.5);
    ctx.fillRect(px - w0 * 0.75, base - u * 1.2, w0 * 1.5, u * 1.4);
    let y = base - u * 1.2;
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      const w = w0 * (1 - f * 0.46);
      const wallH = tier * 0.62;
      ctx.fillStyle = wall;
      ctx.fillRect(px - w * 0.62, y - wallH, w * 1.24, wallH);
      // Darker door slot on the first tier and window slits above.
      ctx.fillStyle = tone(sky, '#2a1f1c', 0.1, 0.3);
      ctx.fillRect(px - w * 0.1, y - wallH * 0.9, w * 0.2, wallH * (i === 0 ? 0.7 : 0.4));
      y -= wallH;
      // Eave with upturned corners.
      const ew = w * 1.55;
      const eh = tier * 0.34;
      ctx.fillStyle = eave;
      poly(ctx, [px - ew, y - eh * 0.9, px - ew * 0.62, y - eh * 0.1, px + ew * 0.62, y - eh * 0.1, px + ew, y - eh * 0.9,
        px + ew * 0.7, y + eh * 0.25, px - ew * 0.7, y + eh * 0.25]);
      ctx.fillStyle = rim;
      ctx.fillRect(px - ew * 0.7, y + eh * 0.2, ew * 1.4, Math.max(1, u * 0.25));
      y -= eh * 0.3;
    }
    // Roof cap, sphere and a thin gold spire.
    ctx.fillStyle = eave;
    poly(ctx, [px - w0 * 0.5, y, px, y - u * 2.6, px + w0 * 0.5, y]);
    ctx.fillStyle = tone(sky, '#c9a24c', 0.12, 0.3);
    blob(ctx, px, y - u * 3.1, u * 0.65, u * 0.65);
    ctx.fillRect(px - Math.max(0.5, u * 0.14), y - u * 6.2, Math.max(1, u * 0.28), u * 3);
  }

  // ---- causeway, willows and bridge ---------------------------------------

  function paintBridge(ctx, g, sky) {
    const u = g.U;
    const cx = g.W * BRIDGE.x;
    const half = g.W * BRIDGE.half;
    const deckY = g.wy - u * 6.2;
    const stone = tone(sky, '#8e8a7c', 0.18, 0.55);
    const shade = tone(sky, '#6c685e', 0.15, 0.55);
    // Humped deck.
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.moveTo(cx - half * 1.5, g.wy - u * 1.2);
    ctx.quadraticCurveTo(cx - half * 0.6, deckY - u * 0.4, cx, deckY - u * 1.4);
    ctx.quadraticCurveTo(cx + half * 0.6, deckY - u * 0.4, cx + half * 1.5, g.wy - u * 1.2);
    ctx.lineTo(cx + half * 1.5, g.wy);
    ctx.lineTo(cx - half * 1.5, g.wy);
    ctx.closePath();
    ctx.fill();
    // Arch opening, filled with the shadowed water behind it.
    ctx.fillStyle = tone(sky, '#34403e', 0.3, 0.6);
    ctx.beginPath();
    ctx.ellipse(cx, g.wy, half * 0.66, u * 4.6, 0, Math.PI, TAU);
    ctx.fill();
    // Voussoir ring and parapet line.
    ctx.strokeStyle = shade;
    ctx.lineWidth = Math.max(1, u * 0.45);
    ctx.beginPath();
    ctx.ellipse(cx, g.wy, half * 0.74, u * 5.2, 0, Math.PI, TAU);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, u * 0.3);
    ctx.beginPath();
    ctx.moveTo(cx - half * 1.5, g.wy - u * 2.4);
    ctx.quadraticCurveTo(cx - half * 0.6, deckY - u * 1.6, cx, deckY - u * 2.6);
    ctx.quadraticCurveTo(cx + half * 0.6, deckY - u * 1.6, cx + half * 1.5, g.wy - u * 2.4);
    ctx.stroke();
    // Posts at the parapet ends.
    ctx.fillStyle = shade;
    ctx.fillRect(cx - half * 0.03, deckY - u * 3.4, Math.max(1, u * 0.5), u * 1.8);
  }

  function paintCauseway(ctx, g, sky) {
    const u = g.U;
    ctx.fillStyle = tone(sky, '#4e5046', 0.15, 0.55);
    ctx.fillRect(0, g.wy - u * 1.3, g.W * CAUSEWAY_END, u * 1.3);
    ctx.fillStyle = tone(sky, '#8a8678', 0.2, 0.5);
    ctx.fillRect(0, g.wy - u * 1.3, g.W * CAUSEWAY_END, Math.max(1, u * 0.3));
    // Tapering end where the causeway melts into the mist.
    ctx.fillStyle = tone(sky, '#4e5046', 0.5, 0.55);
    poly(ctx, [g.W * CAUSEWAY_END, g.wy - u * 1.3, g.W * (CAUSEWAY_END + 0.06), g.wy - u * 0.4, g.W * CAUSEWAY_END, g.wy]);
  }

  function willowCrown(ctx, g, sky, x, h, rand) {
    const u = g.U;
    ctx.strokeStyle = tone(sky, '#3c3428', 0.2, 0.5);
    ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.beginPath();
    ctx.moveTo(x, g.wy - u * 1.2);
    ctx.quadraticCurveTo(x + u * 0.8, g.wy - h * 0.5, x - u * 0.3, g.wy - h);
    ctx.stroke();
    const tones = [tone(sky, '#61764a', 0.3, 0.55), tone(sky, '#7a8e58', 0.3, 0.5), tone(sky, '#8da064', 0.28, 0.45)];
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = tones[k];
      ctx.globalAlpha = 0.9;
      blob(ctx, x - u * 0.3 + (rand() - 0.5) * u * 2.5, g.wy - h - u * (0.3 + k * 0.5) + rand() * u, u * (4.4 - k * 0.7), u * (2.3 - k * 0.3));
    }
    ctx.globalAlpha = 1;
  }

  function paintWillows(ctx, g, sky, rand) {
    const u = g.U;
    const list = [];
    state.crowns = list;
    for (let x = g.W * 0.03; x < g.W * (CAUSEWAY_END - 0.02); x += u * (9 + rand() * 5)) {
      if (Math.abs(x - g.W * BRIDGE.x) < g.W * BRIDGE.half * 1.7) continue;
      const h = u * (15 + rand() * 8);
      willowCrown(ctx, g, sky, x, h, rand);
      list.push({ x, y: g.wy - h, h });
    }
  }

  function makeStrands(g, rand) {
    const list = [];
    const crowns = state.crowns;
    for (let i = 0; i < STRANDS; i++) {
      const c = crowns[i % crowns.length];
      list.push({
        x: c.x + (rand() - 0.5) * g.U * 5,
        y: c.y + g.U * (0.4 + rand() * 0.8),
        len: g.U * (6 + rand() * 6),
        phase: rand() * TAU,
      });
    }
    return list;
  }

  // ---- bake --------------------------------------------------------------

  function paintWorld(g, sky, rand) {
    const c = layer(g.W, g.wy);
    const ctx = c.getContext('2d');
    paintSky(ctx, g, sky, rand);
    paintHills(ctx, g, sky, rand);
    paintPagoda(ctx, g, sky);
    mistBand(ctx, g, sky, g.wy - g.U * 3, g.U * 4, 0.45);
    paintCauseway(ctx, g, sky);
    paintBridge(ctx, g, sky);
    paintWillows(ctx, g, sky, rand);
    return c;
  }

  // Foreground lotus leaves on the water, drawn once on a transparent layer.
  function paintLotus(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const spots = [[0.06, 0.9], [0.13, 0.95], [0.9, 0.88], [0.95, 0.96], [0.82, 0.97], [0.03, 0.97]];
    for (const s of spots) {
      const r = g.U * (3 + rand() * 2.5);
      ctx.fillStyle = tone(sky, '#35523a', 0.1, 0.55);
      blob(ctx, g.W * s[0], g.H * s[1], r, r * 0.38);
      ctx.fillStyle = tone(sky, '#58774a', 0.1, 0.5);
      blob(ctx, g.W * s[0] - r * 0.15, g.H * s[1] - r * 0.06, r * 0.7, r * 0.24);
    }
    return c;
  }

  function paintMist(g) {
    const w = Math.ceil(g.W * 1.4);
    const h = Math.ceil(g.H * 0.2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.012, y * 0.06, 4, 17), fbm((x - w) * 0.012, y * 0.06, 4, 17), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 238;
        img.data[i + 1] = 234;
        img.data[i + 2] = 222;
        img.data[i + 3] = smoothstep(0.4, 0.68, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(47);
    state.world = paintWorld(g, sky, rand);
    state.strands = makeStrands(g, rand);
    state.lotus = paintLotus(g, sky, rand);
    state.water = hex(mixColor(mixColor(rgb('#4f6a68'), sky.low, 0.3), rgb('#0e1426'), sky.night * 0.7));
    state.ink = hex(mixColor(rgb('#6d8250'), rgb('#26362c'), sky.night * 0.7));
    state.boatInk = hex(mixColor(rgb('#2a2a30'), rgb('#101420'), sky.night * 0.6));
    state.glint = hex(mixColor(rgb('#f2ecd6'), sky.low, 0.3));
    state.mistAlpha = 0.5 - sky.night * 0.3;
    state.night = sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.mist;
    const off = -((t * g.U * 2.2) % c.width);
    ctx.globalAlpha = Math.min(1, state.mistAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.38);
    ctx.drawImage(c, off + c.width, g.H * 0.38);
    ctx.drawImage(c, -off * 0.6 - c.width, g.H * 0.5);
    ctx.drawImage(c, -off * 0.6, g.H * 0.5);
    ctx.globalAlpha = 1;
  }

  function drawStrands(ctx, g, t) {
    ctx.strokeStyle = state.ink;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    for (const s of state.strands) {
      const sway = Math.sin(t * 0.9 + s.phase) * g.U * 1.6;
      ctx.moveTo(s.x, s.y);
      ctx.quadraticCurveTo(s.x + sway * 0.4, s.y + s.len * 0.5, s.x + sway, s.y + s.len);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawLake(ctx, g, t) {
    ctx.fillStyle = state.water;
    ctx.fillRect(0, g.wy, g.W, g.H - g.wy);
    const depth = g.H - g.wy;
    const world = state.world;
    ctx.globalAlpha = 0.8;
    for (let y = g.wy; y < g.H; y += ROW) {
      const d = y - g.wy;
      const sy = Math.max(0, g.wy - d * 1.25 - ROW);
      const amp = g.U * (0.2 + 0.9 * (d / depth));
      const dx = Math.sin(t * 0.9 + y * 0.4) * amp;
      ctx.drawImage(world, 0, sy, g.W, ROW, dx, y, g.W, ROW);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = state.water;
    ctx.globalAlpha = 0.28;
    ctx.fillRect(0, g.wy, g.W, depth);
    ctx.globalAlpha = 1;
    ctx.fillStyle = state.glint;
    for (let i = 0; i < GLINTS; i++) {
      const fy = (i * 0.618) % 1;
      const y = g.wy + g.U * 1.5 + fy * (depth - g.U * 3);
      const x = ((i * 37.7 + t * g.U * (0.5 + fy)) % (g.W + 40)) - 20;
      ctx.globalAlpha = 0.35 * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 2.1));
      ctx.fillRect(x, y, g.U * (1.5 + fy * 3), 1);
    }
    ctx.globalAlpha = 1;
  }

  // A black-awning boat crosses the open water between bridge and pagoda.
  function drawBoat(ctx, g, t) {
    const p = (t % BOAT_SECONDS) / BOAT_SECONDS;
    const u = g.U;
    const x = lerp(g.W * 0.98, g.W * 0.5, p);
    const y = g.wy + u * 4.5 + Math.sin(t * 0.7) * u * 0.15;
    const edge = Math.min(1, p * 8, (1 - p) * 8);
    ctx.globalAlpha = edge;
    ctx.fillStyle = state.boatInk;
    poly(ctx, [x - u * 5, y - u * 0.9, x - u * 4.2, y + u * 0.5, x + u * 4.2, y + u * 0.5, x + u * 5.2, y - u * 1.1]);
    ctx.beginPath();
    ctx.ellipse(x - u * 0.4, y - u * 1.1, u * 2.9, u * 1.7, 0, Math.PI, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.25 * edge;
    ctx.fillRect(x - u * 4.5, y + u * 0.9, u * 9, Math.max(1, u * 0.35));
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.mist = paintMist(g);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.world, 0, 0);
    drawMist(ctx, g, t, props.mist);
    drawStrands(ctx, g, t);
    drawLake(ctx, g, t);
    if (props.boat) drawBoat(ctx, g, t);
    ctx.drawImage(state.lotus, 0, 0);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, boat: true, ramp: 'lines', cell: 7, boost: 0.14, gain: 1.1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
