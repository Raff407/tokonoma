/*
 * 喫茶店 Kissaten — an old coffee shop counter on a rainy evening.
 *
 * The street, the room and the glassware are baked once; the glass is left see-through
 * so the street shows behind it. Each frame adds a few passing lights, rain threads
 * on the window, bubbles, the flame and some steam, all short lists of small marks.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp } = K;

  const LIGHTS = ['#e8a850', '#e8c078', '#c8583a', '#f0dcae', '#d8944c', '#c88440'];
  const SHOPS = ['#c88c44', '#e0a24c', '#c8583a', '#b07c48', '#ecbc6c', '#a8503c'];
  const CLUSTERS = [0.05, 0.2, 0.4, 0.6, 0.78, 0.96];
  const VIEW_TONES = ['#3a4064', '#4a4a6c', '#5c5470', '#6e5c6c', '#80665e', '#8c5a48', '#966e50', '#a06a48',
    '#b07c48', '#c88c44', '#d89a58', '#e0a24c', '#ecbc6c', '#f2d494', '#c8583a', '#a8503c'];
  const WOOD_TONES = ['#3a2414', '#4e3019', '#62401f', '#785028', '#8e6032', '#a6743e', '#be8a4e', '#d4a264',
    '#6a4a50', '#8a6a5a'];
  const WINDOW_TOP = 5;
  const WINDOW_FOOT = 64;
  const COUNTER_TOP = 70;
  const MAX_THREADS = 110;
  const THREAD_POINTS = 6;
  const WISPS = 8;
  const WISP_POINTS = 12;
  const LOW_BUBBLES = 26;
  const TUBE_BUBBLES = 8;
  const HIGH_BUBBLES = 34;
  const CARS = 3;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function box(ctx, colour, x, y, w, h) {
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w, h);
  }

  function blob(ctx, colour, x, y, rx, ry) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, 6.3);
    ctx.fill();
  }

  // Rewrites solid pixels once, in setup; see-through pixels (the glass) are left alone.
  function eachSolid(c, change) {
    const ctx = c.getContext('2d');
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] >= 250) change(d, i);
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Snap to the nearest tone in a short list, which keeps the palette small.
  function flatten(c, tones) {
    const list = tones.map((t) => K.parseColor(t));
    return eachSolid(c, (d, i) => {
      let best = list[0];
      let bestGap = Infinity;
      for (const t of list) {
        const gap = (d[i] - t[0]) ** 2 + (d[i + 1] - t[1]) ** 2 + (d[i + 2] - t[2]) ** 2;
        if (gap < bestGap) [best, bestGap] = [t, gap];
      }
      d[i] = best[0];
      d[i + 1] = best[1];
      d[i + 2] = best[2];
    });
  }

  function posterize(c, step) {
    return eachSolid(c, (d, i) => {
      for (let k = 0; k < 3; k++) d[i + k] = Math.round(d[i + k] / step) * step;
    });
  }

  // A radial sprite. A high plateau gives the flat disc of an out-of-focus light.
  function paintSprite(colour, core, plateau) {
    const c = layer(64, 64);
    const ctx = c.getContext('2d');
    const [r, g, b] = K.parseColor(colour);
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${r},${g},${b},${core})`);
    grad.addColorStop(plateau, `rgba(${r},${g},${b},${plateau ? core : 0})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return c;
  }

  // Far buildings are painted very small and scaled up, which blurs them for free.
  function paintBuildings(ctx, g, rand) {
    const small = layer(Math.max(8, g.W / 7), Math.max(8, g.H / 7));
    const s = small.getContext('2d');
    const k = small.height / 100;
    let x = -2;
    while (x < small.width + 2) {
      const w = (0.09 + rand() * 0.11) * small.width * 0.6;
      const top = (12 + rand() * 24) * k;
      s.fillStyle = rand() < 0.5 ? '#46466a' : '#584a60';
      s.fillRect(x, top, w + 1, small.height);
      x += w;
    }
    paintShops(s, small, k, rand);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(small, 0, 0, g.W, g.H);
  }

  // Lit shopfronts and blank signs, also small, so the street melts into soft colour.
  function paintShops(s, small, k, rand) {
    const count = Math.round(small.width * 0.8);
    for (let i = 0; i < count; i++) {
      const sign = rand() < 0.35;
      const w = small.width * (sign ? 0.012 + rand() * 0.02 : 0.03 + rand() * 0.05);
      const h = k * (sign ? 8 + rand() * 12 : 4 + rand() * 7);
      const y = k * (sign ? 24 + rand() * 16 : 41 + rand() * 11);
      s.fillStyle = SHOPS[Math.floor(rand() * SHOPS.length)];
      s.globalAlpha = 0.4 + rand() * 0.45;
      s.fillRect(rand() * small.width, y, w, h);
    }
    s.globalAlpha = 1;
  }

  function paintStreetLights(ctx, g, rand) {
    const u = g.U;
    const count = Math.round(g.W * 0.34);
    for (let i = 0; i < count; i++) {
      const low = rand() < 0.75;
      const home = CLUSTERS[Math.floor(rand() * CLUSTERS.length)];
      const x = g.W * (home + (rand() + rand() - 1) * 0.11);
      const y = u * (low ? 38 + rand() * 17 : 16 + rand() * 22);
      const size = rand();
      const big = size * size * size;
      const r = u * (0.8 + big * 5.2) * (low ? 1 : 0.6);
      ctx.globalAlpha = lerp(low ? 0.95 : 0.55, 0.28, Math.sqrt(big));
      ctx.drawImage(state.bokeh[Math.floor(rand() * state.bokeh.length)], x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  // A few lamps stay bright with a halo, so the street has points to look at.
  function paintStreetLamps(ctx, g, rand) {
    const u = g.U;
    for (const home of CLUSTERS) {
      for (let i = 0; i < 2; i++) {
        const x = g.W * (home + (rand() - 0.5) * 0.12);
        const y = u * (27 + rand() * 20);
        const halo = u * (5 + rand() * 4);
        const core = u * (1.4 + rand() * 1.3);
        ctx.globalAlpha = 0.65;
        ctx.drawImage(state.halo, x - halo, y - halo, halo * 2, halo * 2);
        ctx.globalAlpha = 1;
        ctx.drawImage(state.bokeh[3], x - core, y - core, core * 2, core * 2);
      }
    }
  }

  function paintWetRoad(ctx, g, rand) {
    const u = g.U;
    const road = ctx.createLinearGradient(0, u * 52, 0, u * WINDOW_FOOT);
    road.addColorStop(0, 'rgba(150,110,80,0)');
    road.addColorStop(0.45, 'rgba(150,110,80,0.85)');
    road.addColorStop(1, 'rgba(176,124,72,1)');
    ctx.fillStyle = road;
    ctx.fillRect(0, u * 52, g.W, u * 14);
    for (let i = 0; i < g.W * 0.16; i++) {
      const w = u * (1 + rand() * 2.4);
      const h = u * (6 + rand() * 8);
      ctx.globalAlpha = 0.3 + rand() * 0.4;
      ctx.drawImage(state.bokeh[Math.floor(rand() * 4)], rand() * g.W, u * 53, w, h);
    }
    ctx.globalAlpha = 1;
  }

  // Beads and old tracks on the glass, baked, so the moving threads have company.
  function paintWetGlass(ctx, g, rand) {
    const u = g.U;
    ctx.fillStyle = '#e8dcc0';
    for (let i = 0; i < g.W * 0.5; i++) {
      ctx.globalAlpha = 0.05 + rand() * 0.09;
      ctx.fillRect(rand() * g.W, u * WINDOW_TOP + rand() * u * 40, 1, u * (6 + rand() * 18));
    }
    for (let i = 0; i < g.W * 0.7; i++) {
      const x = rand() * g.W;
      const y = u * (WINDOW_TOP + rand() * (WINDOW_FOOT - WINDOW_TOP));
      const s = Math.max(1, u * (0.4 + rand() * rand() * 0.9));
      ctx.fillStyle = '#efe4c8';
      ctx.globalAlpha = 0.3 + rand() * 0.45;
      ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;
    const fog = ctx.createLinearGradient(0, u * 48, 0, u * WINDOW_FOOT);
    fog.addColorStop(0, 'rgba(214,180,136,0)');
    fog.addColorStop(1, 'rgba(214,180,136,0.3)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, u * 48, g.W, u * 18);
  }

  function paintAir(ctx, g, x, y, rx, ry, inner, outer) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    const air = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    air.addColorStop(0, inner);
    air.addColorStop(1, outer);
    ctx.fillStyle = air;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }

  function paintView(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const sky = ctx.createLinearGradient(0, u * WINDOW_TOP, 0, u * 56);
    sky.addColorStop(0, '#3a4064');
    sky.addColorStop(0.55, '#5c5470');
    sky.addColorStop(1, '#80665e');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, u * COUNTER_TOP);
    paintBuildings(ctx, g, rand);
    paintAir(ctx, g, g.W * 0.5, u * 46, g.W * 0.75, u * 22, 'rgba(200,130,70,0.34)', 'rgba(200,130,70,0)');
    paintAir(ctx, g, g.W * 0.7, u * 26, u * 40, u * 40, 'rgba(232,168,88,0.6)', 'rgba(232,168,88,0)');
    paintStreetLights(ctx, g, rand);
    paintStreetLamps(ctx, g, rand);
    paintWetRoad(ctx, g, rand);
    paintWetGlass(ctx, g, rand);
    return c;
  }

  function woodRun(ctx, x, y, w, h, base, lit, dark, rand) {
    ctx.fillStyle = base;
    ctx.fillRect(x, y, w, h);
    const across = w >= h;
    const marks = Math.ceil((w * h) / 90);
    for (let i = 0; i < marks; i++) {
      ctx.fillStyle = rand() < 0.5 ? lit : dark;
      ctx.globalAlpha = 0.14 + rand() * 0.22;
      const px = x + rand() * w;
      const py = y + rand() * h;
      const run = (across ? w : h) * (0.04 + rand() * 0.2);
      if (across) ctx.fillRect(px, py, Math.min(run, x + w - px), 1);
      else ctx.fillRect(px, py, 1, Math.min(run, y + h - py));
    }
    ctx.globalAlpha = 1;
  }

  function paintFrame(ctx, g, rand) {
    const u = g.U;
    const wide = u * 3;
    box(ctx, '#4e3220', 0, u * 21, g.W, Math.max(1, u * 0.9));
    for (const f of [0.135, 0.515, 0.855]) {
      woodRun(ctx, g.W * f - wide / 2, u * WINDOW_TOP, wide, u * 60, '#6e4728', '#966a3e', '#4a2e16', rand);
      box(ctx, '#8a6238', g.W * f - wide / 2, u * WINDOW_TOP, Math.max(1, u * 0.5), u * 60);
    }
    woodRun(ctx, 0, 0, g.W, u * WINDOW_TOP, '#5e3e24', '#845c34', '#3e2814', rand);
    box(ctx, '#2f1f13', 0, u * WINDOW_TOP, g.W, Math.max(1, u * 0.8));
    woodRun(ctx, 0, u * WINDOW_FOOT, g.W, u * (COUNTER_TOP - WINDOW_FOOT), '#7c5230', '#a67a48', '#553620', rand);
    box(ctx, '#c89a60', 0, u * WINDOW_FOOT, g.W, Math.max(1, u * 0.7));
    box(ctx, '#35210f', 0, u * COUNTER_TOP - Math.max(1, u * 0.7), g.W, Math.max(1, u * 0.7));
  }

  function paintCounter(ctx, g, rand) {
    const u = g.U;
    const top = u * COUNTER_TOP;
    const wood = ctx.createLinearGradient(0, top, 0, g.H);
    wood.addColorStop(0, '#94622f');
    wood.addColorStop(1, '#6e4524');
    ctx.fillStyle = wood;
    ctx.fillRect(0, top, g.W, g.H - top);
    for (let i = 0; i < g.W * 1.6; i++) {
      const y = top + rand() * rand() * (g.H - top);
      ctx.fillStyle = rand() < 0.5 ? '#b08450' : '#4a2e16';
      ctx.globalAlpha = 0.16 + rand() * 0.2;
      ctx.fillRect(rand() * g.W, y, u * (2 + rand() * 16), Math.max(1, u * 0.4));
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#44291a';
    for (const f of [0.14, 0.42, 0.78]) ctx.fillRect(0, top + (g.H - top) * f, g.W, Math.max(1, u * 0.4));
  }

  function upperPath(ctx, x, u) {
    ctx.beginPath();
    ctx.moveTo(x - u * 3, u * 37);
    ctx.bezierCurveTo(x - u * 8, u * 35.5, x - u * 13.5, u * 33, x - u * 13.5, u * 27);
    ctx.lineTo(x - u * 12.5, u * 11);
    ctx.lineTo(x + u * 12.5, u * 11);
    ctx.lineTo(x + u * 13.5, u * 27);
    ctx.bezierCurveTo(x + u * 13.5, u * 33, x + u * 8, u * 35.5, x + u * 3, u * 37);
    ctx.closePath();
  }

  function paintStand(ctx, g, x) {
    const u = g.U;
    const foot = u * 88;
    blob(ctx, '#2f1c0e', x, foot + u * 0.8, u * 18, u * 3.6);
    box(ctx, '#6a4224', x - u * 17, foot - u, u * 34, u * 1.6);
    ctx.beginPath();
    ctx.ellipse(x, foot + u * 0.6, u * 17, u * 3.2, 0, 0, 6.3);
    ctx.fill();
    blob(ctx, '#b48650', x, foot - u, u * 17, u * 3.2);
    blob(ctx, '#946a3c', x, foot - u, u * 13.5, u * 2.2);
    const rod = x + u * 16;
    box(ctx, '#9c7c40', rod - u * 0.8, u * 42, u * 1.6, foot - u * 42);
    box(ctx, '#e4c67c', rod - u * 0.8, u * 42, Math.max(1, u * 0.5), foot - u * 42);
    ctx.strokeStyle = '#b08f4c';
    ctx.lineWidth = Math.max(1, u * 1.1);
    ctx.beginPath();
    ctx.moveTo(rod, u * 42);
    ctx.quadraticCurveTo(x + u * 9, u * 37, x + u * 4, u * 39.5);
    ctx.stroke();
  }

  function paintBurner(ctx, g, x) {
    const u = g.U;
    const y = u * 82;
    blob(ctx, '#d8b878', x, y, u * 9, u * 5.4);
    blob(ctx, '#a86c2c', x, y, u * 8.2, u * 4.6);
    blob(ctx, '#d89a48', x, y + u * 1.2, u * 7.6, u * 3.2);
    box(ctx, '#fbf2d8', x - u * 5.4, y - u * 2.8, u * 3.2, Math.max(1, u * 0.8));
    box(ctx, '#c8a860', x - u * 2.6, u * 75, u * 5.2, u * 3);
    box(ctx, '#efdcae', x - u * 2.6, u * 75, u * 5.2, Math.max(1, u * 0.6));
    box(ctx, '#3a2614', x - u * 0.5, u * 73.4, u, u * 1.8);
  }

  function paintLowerGlass(ctx, g, x) {
    const u = g.U;
    const cy = u * 54;
    const r = u * 14;
    ctx.fillStyle = 'rgba(230,208,166,0.16)';
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, 6.3);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, 6.3);
    ctx.clip();
    const brew = ctx.createLinearGradient(0, u * 50, 0, u * 68);
    brew.addColorStop(0, '#8e4c1c');
    brew.addColorStop(1, '#d8923c');
    ctx.fillStyle = brew;
    ctx.fillRect(x - r, u * 50, r * 2, u * 18);
    box(ctx, '#e8bd78', x - r, u * 50, r * 2, Math.max(1, u * 0.7));
    ctx.restore();
    ctx.strokeStyle = '#ecdcb4';
    ctx.lineWidth = Math.max(1, u * 0.6);
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, 6.3);
    ctx.stroke();
    ctx.strokeStyle = '#fbf2d8';
    ctx.lineWidth = Math.max(1, u * 1.5);
    ctx.lineCap = 'round';
    for (const [alpha, reach, from, to] of [[0.9, 0.76, 3.5, 4.4], [0.45, 0.8, 0.5, 1]]) {
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, cy, r * reach, from, to);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function paintTube(ctx, g, x) {
    const u = g.U;
    box(ctx, 'rgba(236,220,180,0.3)', x - u * 1.3, u * 38, u * 2.6, u * 26.5);
    ctx.fillStyle = '#efe0ba';
    ctx.globalAlpha = 0.75;
    ctx.fillRect(x - u * 1.5, u * 38, Math.max(1, u * 0.4), u * 26.5);
    ctx.fillRect(x + u * 1.2, u * 38, Math.max(1, u * 0.4), u * 26.5);
    ctx.globalAlpha = 1;
  }

  function paintUpperGlass(ctx, g, x) {
    const u = g.U;
    upperPath(ctx, x, u);
    ctx.fillStyle = 'rgba(230,208,166,0.2)';
    ctx.fill();
    ctx.save();
    upperPath(ctx, x, u);
    ctx.clip();
    const brew = ctx.createLinearGradient(0, u * 20, 0, u * 37);
    brew.addColorStop(0, '#5f3517');
    brew.addColorStop(1, '#7c4518');
    ctx.fillStyle = brew;
    ctx.fillRect(x - u * 15, u * 20, u * 30, u * 18);
    box(ctx, '#c89c62', x - u * 15, u * 19, u * 30, u * 1.8);
    ctx.restore();
    upperPath(ctx, x, u);
    ctx.strokeStyle = '#ecdcb4';
    ctx.lineWidth = Math.max(1, u * 0.6);
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    ctx.strokeStyle = '#fbf2d8';
    ctx.lineWidth = Math.max(1, u * 1.5);
    ctx.lineCap = 'round';
    for (const [alpha, a, b, top, foot] of [[0.9, -9.5, -10.2, 14, 29], [0.4, 10, 10.5, 14, 24]]) {
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(x + u * a, u * top);
      ctx.lineTo(x + u * b, u * foot);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    box(ctx, '#2f1c10', x - u * 4, u * 36.5, u * 8, u * 3.5);
    box(ctx, '#5a4030', x - u * 4, u * 36.5, u * 8, Math.max(1, u * 0.6));
    box(ctx, '#d8b878', x - u * 13.5, u * 10.2, u * 27, Math.max(1, u * 1.2));
  }

  function paintSiphon(ctx, g) {
    const x = g.W * 0.3;
    paintStand(ctx, g, x);
    paintBurner(ctx, g, x);
    paintLowerGlass(ctx, g, x);
    paintTube(ctx, g, x);
    paintUpperGlass(ctx, g, x);
    state.sx = x;
  }

  function paintCup(ctx, g, x) {
    const u = g.U;
    const y = u * 91;
    blob(ctx, '#301c0e', x, y + u * 1.4, u * 24, u * 4.6);
    blob(ctx, '#c8b284', x, y, u * 23, u * 4.4);
    blob(ctx, '#ecdcb4', x, y - u * 0.6, u * 21, u * 3.6);
    ctx.strokeStyle = '#d8c698';
    ctx.lineWidth = u * 1.8;
    ctx.beginPath();
    ctx.ellipse(x + u * 14.5, y - u * 11, u * 4.6, u * 4.4, 0, -1.8, 1.8);
    ctx.stroke();
    const body = ctx.createLinearGradient(x - u * 14, 0, x + u * 14, 0);
    body.addColorStop(0, '#f2e4c0');
    body.addColorStop(0.6, '#d8c498');
    body.addColorStop(1, '#94784c');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(x - u * 14, y - u * 18);
    ctx.bezierCurveTo(x - u * 14, y - u * 7, x - u * 10, y - u * 1.4, x - u * 6, y - u * 1);
    ctx.lineTo(x + u * 6, y - u * 1);
    ctx.bezierCurveTo(x + u * 10, y - u * 1.4, x + u * 14, y - u * 7, x + u * 14, y - u * 18);
    ctx.fill();
    ctx.fillStyle = '#39507a';
    ctx.globalAlpha = 0.8;
    ctx.fillRect(x - u * 13.8, y - u * 14.6, u * 27.6, Math.max(1, u * 1));
    ctx.globalAlpha = 1;
    blob(ctx, '#f6ecd0', x, y - u * 18, u * 14, u * 3.4);
    blob(ctx, '#4a2812', x, y - u * 17.8, u * 12.4, u * 2.6);
    blob(ctx, '#9c6228', x - u * 3, y - u * 18.4, u * 6, u * 1);
    state.mouth = { x, y: y - u * 19, w: u * 11 };
  }

  function paintMill(ctx, g, x) {
    const u = g.U;
    const y = u * 80;
    box(ctx, '#301c0e', x - u * 11, y - u * 0.2, u * 22, u * 2);
    woodRun(ctx, x - u * 9.5, y - u * 13, u * 19, u * 13, '#a06c38', '#c89c60', '#6a4424', K.rng(11));
    box(ctx, '#5e3c20', x - u * 7, y - u * 6.5, u * 14, u * 4.5);
    box(ctx, '#c8a860', x - u, y - u * 5, u * 2, u * 1.6);
    ctx.fillStyle = '#d0ae64';
    ctx.beginPath();
    ctx.ellipse(x, y - u * 13, u * 7, u * 6, 0, Math.PI, 0);
    ctx.fill();
    box(ctx, '#e0c684', x - u * 4, y - u * 17, u * 2, u * 2);
    ctx.strokeStyle = '#d0ae64';
    ctx.lineWidth = Math.max(1, u * 1);
    ctx.beginPath();
    ctx.moveTo(x, y - u * 19);
    ctx.lineTo(x + u * 8, y - u * 22);
    ctx.lineTo(x + u * 8, y - u * 25);
    ctx.stroke();
    box(ctx, '#7a4c28', x + u * 6.8, y - u * 28, u * 2.4, u * 3.4);
  }

  function paintTin(ctx, g, x) {
    const u = g.U;
    const y = u * 78;
    box(ctx, '#301c0e', x - u * 7.6, y - u * 0.2, u * 15.2, u * 1.8);
    const tin = ctx.createLinearGradient(x - u * 7, 0, x + u * 7, 0);
    tin.addColorStop(0, '#c26a48');
    tin.addColorStop(0.5, '#963f2a');
    tin.addColorStop(1, '#642a1c');
    ctx.fillStyle = tin;
    ctx.fillRect(x - u * 7, y - u * 19, u * 14, u * 19);
    box(ctx, '#d8b878', x - u * 7.4, y - u * 22, u * 14.8, u * 3.4);
    box(ctx, '#efdcae', x - u * 7.4, y - u * 22, u * 14.8, Math.max(1, u * 0.7));
    box(ctx, '#d0ae64', x - u * 7, y - u * 9, u * 14, Math.max(1, u * 1.2));
  }

  function paintLamp(ctx, g, x) {
    const u = g.U;
    box(ctx, '#2e1d10', x - Math.max(0.5, u * 0.25), u * 2, Math.max(1, u * 0.5), u * 6);
    box(ctx, '#b08f4c', x - u * 2.4, u * 7, u * 4.8, u * 2.6);
    const shade = ctx.createLinearGradient(x - u * 22, 0, x + u * 22, 0);
    shade.addColorStop(0, '#8c4f1e');
    shade.addColorStop(0.45, '#e8a850');
    shade.addColorStop(1, '#7c421a');
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(x - u * 3.5, u * 9);
    ctx.bezierCurveTo(x - u * 13, u * 10, x - u * 20, u * 16, x - u * 22, u * 24);
    ctx.lineTo(x + u * 22, u * 24);
    ctx.bezierCurveTo(x + u * 20, u * 16, x + u * 13, u * 10, x + u * 3.5, u * 9);
    ctx.fill();
    blob(ctx, '#fbe8b4', x, u * 24, u * 22, u * 2.6);
    blob(ctx, '#fff6da', x, u * 24.4, u * 9, u * 1.5);
  }

  function paintObjects(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintTin(ctx, g, g.W * 0.065);
    paintMill(ctx, g, g.W * 0.93);
    paintSiphon(ctx, g);
    paintCup(ctx, g, g.W * 0.7);
    paintLamp(ctx, g, g.W * 0.7);
    return posterize(c, 22);
  }

  function paintRoom(g, rand, view) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const top = u * COUNTER_TOP;
    const objects = paintObjects(g);
    paintCounter(ctx, g, rand);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, g.W, g.H - top);
    ctx.clip();
    ctx.globalAlpha = 0.34;
    ctx.save();
    ctx.translate(0, top * 2);
    ctx.scale(1, -1);
    ctx.drawImage(view, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 0.26;
    ctx.save();
    ctx.translate(0, u * 176);
    ctx.scale(1, -1);
    ctx.drawImage(objects, 0, 0);
    ctx.restore();
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    paintAir(ctx, g, g.W * 0.7, u * 88, u * 50, u * 15, 'rgba(196,132,66,0.6)', 'rgba(196,132,66,0)');
    paintAir(ctx, g, state.sx, u * 86, u * 24, u * 7, 'rgba(196,132,66,0.4)', 'rgba(196,132,66,0)');
    ctx.globalCompositeOperation = 'source-over';
    paintFrame(ctx, g, rand);
    flatten(c, WOOD_TONES);
    ctx.drawImage(objects, 0, 0);
    return c;
  }

  function makeThreads(g, rand) {
    const list = [];
    for (let i = 0; i < MAX_THREADS; i++) {
      list.push({
        x: rand() * g.W, drift: g.U * (0.5 + rand() * 1.6), bend: 0.05 + rand() * 0.1, phase: rand() * 6.28,
        rate: g.U * (2.4 + rand() * rand() * 11), start: rand() * 400,
        tail: g.U * (5 + rand() * 18), alpha: 0.35 + rand() * 0.4,
      });
    }
    return list;
  }

  function threadX(th, y, g) {
    return th.x + Math.sin(y * th.bend / g.U * 1.6 + th.phase) * th.drift;
  }

  function drawThreads(ctx, g, t, amount) {
    const u = g.U;
    const span = u * (WINDOW_FOOT - WINDOW_TOP + 26);
    const count = Math.min(MAX_THREADS, Math.round((g.W / 3.2) * amount));
    ctx.strokeStyle = '#efe4c8';
    ctx.fillStyle = '#fff6da';
    ctx.lineWidth = 1;
    for (let i = 0; i < count; i++) {
      const th = state.threads[i];
      const run = t * th.rate + Math.sin(t * 0.4 + th.phase) * u * 1.2 + th.start;
      const head = u * WINDOW_TOP + (run % span);
      ctx.globalAlpha = th.alpha * 0.55;
      ctx.beginPath();
      for (let k = 0; k <= THREAD_POINTS; k++) {
        const y = head - (k / THREAD_POINTS) * th.tail;
        const x = threadX(th, y, g);
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = Math.min(1, th.alpha * 1.6);
      ctx.fillRect(threadX(th, head, g) - 0.5, head - 1, Math.max(1, u * 0.7), Math.max(2, u * 1.1));
    }
    ctx.globalAlpha = 1;
  }

  function makeLights(g, rand) {
    const list = [];
    for (let i = 0; i < Math.round(5 + g.W * 0.02); i++) {
      list.push({
        x: g.W * (0.18 + rand() * 0.66),
        y: g.U * (30 + rand() * 24),
        r: g.U * (1.4 + rand() * 2.6),
        kind: [0, 2, 4, 5][Math.floor(rand() * 4)],
        phase: rand() * 6.28,
        rate: 0.12 + rand() * 0.22,
      });
    }
    return list;
  }

  function drawStreetLife(ctx, g, t) {
    const u = g.U;
    for (const l of state.lights) {
      ctx.globalAlpha = 0.36 + 0.3 * Math.sin(t * l.rate + l.phase);
      ctx.drawImage(state.bokeh[l.kind], l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
    for (let i = 0; i < CARS; i++) {
      const dir = i % 2 ? -1 : 1;
      const pass = ((t * 0.017 * (1 + i * 0.3) + i * 0.37) % 1) * 1.5 - 0.25;
      const x = (dir > 0 ? pass : 1 - pass) * g.W;
      const y = u * (52 + i * 2.2);
      const sprite = state.bokeh[dir > 0 ? 1 : 2];
      const r = u * 2.5;
      ctx.globalAlpha = 0.8;
      ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
      ctx.drawImage(sprite, x + u * 7 - r, y - r, r * 2, r * 2);
      ctx.globalAlpha = 0.3;
      ctx.drawImage(sprite, x - u * 1.2, y + u * 2, u * 2.4, u * 8);
      ctx.drawImage(sprite, x + u * 5.8, y + u * 2, u * 2.4, u * 8);
    }
    ctx.globalAlpha = 1;
  }

  function makeBubbles(rand, n) {
    const a = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      a[i * 4] = rand();
      a[i * 4 + 1] = (rand() - 0.5) * 2;
      a[i * 4 + 2] = 0.22 + rand() * 0.5;
      a[i * 4 + 3] = rand();
    }
    return a;
  }

  // A rising plume: bubbles fan out from a narrow start towards a wider surface.
  function drawPlume(ctx, g, t, a, n, from, to, narrow, wide, colour) {
    const u = g.U;
    ctx.fillStyle = colour;
    for (let i = 0; i < n; i++) {
      const life = (t * a[i * 4 + 2] * 1.3 + a[i * 4]) % 1;
      const x = state.sx + a[i * 4 + 1] * u * (narrow + life * wide) + Math.sin(life * 8 + i) * u * 0.7;
      const s = Math.max(1, u * (0.5 + a[i * 4 + 3] * 1.1));
      ctx.globalAlpha = 0.35 + 0.55 * a[i * 4 + 3];
      ctx.fillRect(x, lerp(u * from, u * to, life), s, s);
    }
    ctx.globalAlpha = 1;
  }

  function drawTubeBubbles(ctx, g, t, n) {
    const u = g.U;
    const size = Math.max(1, u * 1.2);
    ctx.fillStyle = '#fbeac0';
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < n; i++) {
      const life = (t * state.tube[i * 4 + 2] * 1.2 + state.tube[i * 4]) % 1;
      ctx.fillRect(state.sx - u * 0.6, lerp(u * 64, u * 38, life), size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawSurface(ctx, g, t, y, half, colour, amount) {
    const u = g.U;
    ctx.strokeStyle = colour;
    ctx.lineWidth = Math.max(1, u * 0.7);
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    for (let k = 0; k <= 10; k++) {
      const f = k / 10;
      const wave = Math.sin(f * 7 + t * 2.4) * 0.5 + Math.sin(f * 15 - t * 3.3) * 0.3;
      const px = state.sx + (f * 2 - 1) * half;
      if (k === 0) ctx.moveTo(px, y + wave * u * amount);
      else ctx.lineTo(px, y + wave * u * amount);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawFlame(ctx, g, t, amount) {
    const u = g.U;
    const x = state.sx;
    const base = u * 74.4;
    const sway = Math.sin(t * 1.9) * u * 0.8 + Math.sin(t * 4.3) * u * 0.35;
    const high = u * (6.4 + Math.sin(t * 2.7) * 0.8 + Math.sin(t * 5.1) * 0.4) * (0.6 + 0.4 * amount);
    const glow = 0.62 + 0.1 * Math.sin(t * 2.2);
    const r = u * 13;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = glow;
    ctx.drawImage(state.flameGlow, x - r, base - u * 5 - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
    for (const [w, h, colour] of state.flameParts) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(x - u * 2.6 * w, base);
      ctx.quadraticCurveTo(x - u * 2.8 * w, base - high * h * 0.5, x + sway * h, base - high * h);
      ctx.quadraticCurveTo(x + u * 2.8 * w, base - high * h * 0.5, x + u * 2.6 * w, base);
      ctx.fill();
    }
  }

  function makeWisps(g, rand) {
    const list = [];
    for (let i = 0; i < WISPS; i++) {
      list.push({
        offset: (i / (WISPS - 1) - 0.5) * 1.7, phase: rand() * 6.28, rate: 0.08 + rand() * 0.07, start: rand(),
        rise: g.U * (20 + rand() * 16), wobble: g.U * (1.5 + rand() * 2.5),
      });
    }
    return list;
  }

  function drawWisp(ctx, g, w, t, amount) {
    const m = state.mouth;
    const x0 = m.x + w.offset * m.w * 0.6;
    const life = (t * w.rate + w.start) % 1;
    const fade = Math.sin(life * Math.PI);
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = Math.min(1, fade * amount * (pass ? 0.5 : 0.2));
      ctx.lineWidth = Math.max(1, g.U * (pass ? 0.9 : 3.4));
      ctx.beginPath();
      for (let k = 0; k <= WISP_POINTS; k++) {
        const f = k / WISP_POINTS;
        const rise = (life * 0.55 + f * 0.45) * w.rise;
        const x = x0 + Math.sin(f * 4 + t * 0.6 + w.phase) * f * w.wobble;
        if (k === 0) ctx.moveTo(x, m.y - rise);
        else ctx.lineTo(x, m.y - rise);
      }
      ctx.stroke();
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.bokeh = LIGHTS.map((c) => paintSprite(c, 0.75, 0.84));
    state.halo = paintSprite('#e8a050', 0.85, 0.01);
    state.flameGlow = paintSprite('#e89a48', 0.9, 0.01);
    state.flameParts = [[1, 1, '#d8742c'], [0.62, 0.72, '#f0b050'], [0.3, 0.42, '#fff0c0']];
    state.view = flatten(paintView(g, rand), VIEW_TONES);
    state.room = paintRoom(g, rand, state.view);
    state.threads = makeThreads(g, rand);
    state.lights = makeLights(g, rand);
    state.wisps = makeWisps(g, rand);
    state.low = makeBubbles(rand, LOW_BUBBLES);
    state.tube = makeBubbles(rand, TUBE_BUBBLES);
    state.high = makeBubbles(rand, HIGH_BUBBLES);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const u = g.U;
    const p = api.props;
    ctx.drawImage(state.view, 0, 0);
    drawStreetLife(ctx, g, t);
    drawThreads(ctx, g, t, p.rain);
    ctx.drawImage(state.room, 0, 0);
    const simmer = p.simmer;
    if (simmer > 0) {
      const part = Math.min(1, simmer);
      drawPlume(ctx, g, t * (0.5 + simmer * 0.7), state.low, Math.round(LOW_BUBBLES * part), 65.5, 50.6, 1.5, 8, '#fbeac0');
      drawTubeBubbles(ctx, g, t * (0.5 + simmer * 0.7), Math.round(TUBE_BUBBLES * part));
      drawPlume(ctx, g, t * (0.5 + simmer * 0.7), state.high, Math.round(HIGH_BUBBLES * part), 35.5, 20.5, 2, 9.5, '#e8c48c');
      drawSurface(ctx, g, t, u * 20.2, u * 12, '#e8c48c', simmer);
      drawSurface(ctx, g, t, u * 50.4, u * 13, '#f0d090', simmer);
    }
    drawFlame(ctx, g, t, simmer);
    ctx.strokeStyle = '#f6ecd4';
    ctx.lineCap = 'round';
    for (const w of state.wisps) drawWisp(ctx, g, w, t, p.steam);
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { rain: 1, steam: 1, simmer: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.15, tint: 0.8, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
