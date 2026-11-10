/*
 * 天坛 Temple of Heaven — the round Hall of Prayer with its three blue
 * roofs, standing on three white marble terraces among old cypresses.
 *
 * Sky, hall and ground are baked into two layers and repainted once a
 * minute from the clock. Between repaints only clouds, a few twinkling
 * stars and low mist move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const RETINT_SECONDS = 60;
  const GROUND = 88;
  const TWINKLERS = 36;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Colour tinted by the sky and darkened toward night.
  function shade(sky, base, nightBase, amount) {
    const lit = mixColor(rgb(base), sky.amb, 0.2);
    return hex(mixColor(lit, rgb(nightBase), sky.night * (amount === undefined ? 0.8 : amount)));
  }

  // ---- sky ---------------------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.U * GROUND);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.45);
        ctx.fillRect(rand() * g.W, rand() * g.U * 70, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintLuminary(ctx, g, sky);
    return c;
  }

  function paintLuminary(ctx, g, sky) {
    const night = sky.night > 0.5;
    const t = night ? S.moonT(sky.hour) : S.sunT(sky.hour);
    const px = g.W * (0.12 + 0.76 * (1 - t));
    const py = g.U * (30 - 18 * Math.sin(t * Math.PI));
    const r = g.U * (night ? 4.2 : 3.4);
    const halo = ctx.createRadialGradient(px, py, 0, px, py, r * 5);
    halo.addColorStop(0, night ? 'rgba(232,228,208,0.28)' : 'rgba(250,236,200,0.35)');
    halo.addColorStop(1, 'rgba(232,228,208,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(px - r * 5, py - r * 5, r * 10, r * 10);
    ctx.fillStyle = night ? '#e8e4d0' : '#f4e6c0';
    ctx.beginPath();
    ctx.arc(px, py, r, 0, 6.3);
    ctx.fill();
    if (night) {
      ctx.fillStyle = 'rgba(150,152,160,0.35)';
      ctx.beginPath();
      ctx.arc(px - r * 0.3, py - r * 0.1, r * 0.3, 0, 6.3);
      ctx.arc(px + r * 0.35, py + r * 0.3, r * 0.22, 0, 6.3);
      ctx.fill();
    }
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.012, y * 0.08, 4, 33);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 232;
        img.data[i + 3] = smoothstep(0.5, 0.7, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintMist(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.02, y * 0.12, 3, 51), fbm((x - w) * 0.02, y * 0.12, 3, 51), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 226;
        img.data[i + 1] = 228;
        img.data[i + 2] = 230;
        img.data[i + 3] = smoothstep(0.38, 0.7, v) * band * 120;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- cypresses -----------------------------------------------------------

  function paintCypress(ctx, g, sky, cx, base, s) {
    const trunk = shade(sky, '#4a3a2c', '#2a2830', 0.7);
    const leaf = shade(sky, '#3c5a3c', '#243a38', 0.8);
    const leaf2 = shade(sky, '#4a6a48', '#2e4846', 0.8);
    ctx.fillStyle = trunk;
    ctx.fillRect(cx - s * 0.6, base - s * 6, s * 1.2, s * 6);
    const rand = K.rng(Math.floor(cx) + 7);
    // A tall cloud-pruned crown built from stacked lobes.
    for (let k = 0; k < 7; k++) {
      const ly = base - s * (7 + k * 2.6);
      const lw = s * (4.6 - k * 0.5 + rand() * 0.8);
      ctx.fillStyle = k % 2 ? leaf2 : leaf;
      ctx.beginPath();
      ctx.ellipse(cx + (rand() - 0.5) * s, ly, Math.max(1, lw), s * 1.9, 0, 0, 6.3);
      ctx.fill();
    }
  }

  // ---- hall ----------------------------------------------------------------

  function polygon(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function paintTerraces(ctx, g, sky) {
    const U = g.U;
    const cx = g.W / 2;
    const marble = shade(sky, '#e6e4dc', '#4a4e68', 0.6);
    const edge = shade(sky, '#b6b4ac', '#2c3048', 0.6);
    const tiers = [
      { y0: 80.5, y1: GROUND, half: 44 },
      { y0: 76, y1: 80.5, half: 35 },
      { y0: 71.5, y1: 76, half: 27 },
    ];
    for (const t of tiers) {
      ctx.fillStyle = marble;
      ctx.fillRect(cx - U * t.half, U * t.y0, U * t.half * 2, U * (t.y1 - t.y0));
      ctx.fillStyle = edge;
      ctx.fillRect(cx - U * t.half, U * t.y1 - Math.max(1, U * 0.4), U * t.half * 2, Math.max(1, U * 0.4));
      // Balustrade posts along the lip of each tier.
      ctx.fillStyle = marble;
      const step = U * 1.6;
      for (let x = cx - U * t.half + U * 0.4; x < cx + U * t.half; x += step) {
        ctx.fillRect(x, U * t.y0 - U * 1.6, Math.max(1, U * 0.5), U * 1.6);
      }
      ctx.fillRect(cx - U * t.half, U * t.y0 - U * 1.6, U * t.half * 2, Math.max(1, U * 0.4));
      ctx.fillRect(cx - U * t.half, U * t.y0 - U * 0.5, U * t.half * 2, Math.max(1, U * 0.3));
    }
    // Central stair with the carved ramp in the middle.
    ctx.fillStyle = marble;
    ctx.fillRect(cx - U * 5, U * 71.5, U * 10, U * (GROUND - 71.5));
    ctx.fillStyle = edge;
    for (let y = 72; y < GROUND; y += 1.4) ctx.fillRect(cx - U * 5, U * y, U * 10, Math.max(1, U * 0.2));
    ctx.fillStyle = shade(sky, '#c8c4b8', '#383c58', 0.6);
    ctx.fillRect(cx - U * 1.2, U * 71.5, U * 2.4, U * (GROUND - 71.5));
  }

  function paintBase(ctx, g, sky) {
    const U = g.U;
    const cx = g.W / 2;
    const glow = sky.night;
    // Red wall with a ring of columns and lit lattice doors.
    ctx.fillStyle = shade(sky, '#9c3424', '#3a1a22', 0.55);
    ctx.fillRect(cx - U * 13, U * 60.5, U * 26, U * 11.2);
    ctx.fillStyle = hex(mixColor(rgb('#b8803a'), rgb('#e8b650'), glow));
    ctx.fillRect(cx - U * 13.4, U * 60, U * 26.8, U * 1.2);
    ctx.fillRect(cx - U * 13.4, U * 70.4, U * 26.8, U * 1.1);
    const door = hex(mixColor(rgb('#6a2a1c'), rgb('#d89a46'), glow * 0.85));
    for (let k = -2; k <= 2; k++) {
      const dx = cx + k * U * 4.8;
      ctx.fillStyle = door;
      ctx.fillRect(dx - U * 1.7, U * 62.8, U * 3.4, U * 7.4);
      ctx.fillStyle = shade(sky, '#5a1c14', '#20101a', 0.5);
      ctx.fillRect(dx - U * 0.1, U * 62.8, Math.max(1, U * 0.3), U * 7.4);
      for (let y = 64; y < 70; y += 1.6) ctx.fillRect(dx - U * 1.7, U * y, U * 3.4, Math.max(1, U * 0.2));
    }
    ctx.fillStyle = shade(sky, '#7a2418', '#2a141c', 0.55);
    for (let k = -3; k <= 3; k++) ctx.fillRect(cx + (k + 0.5) * U * 3.9 - U * 0.5, U * 61, U * 1, U * 10.2);
    ctx.fillStyle = shade(sky, '#7a2418', '#2a141c', 0.55);
    for (const s of [-1, 1]) ctx.fillRect(cx + s * U * 12.6 - U * 0.5, U * 61, U * 1, U * 10.2);
  }

  // One conical roof tier: curved sides, upturned eaves, tile lines.
  function paintRoof(ctx, g, sky, yb, yt, hb, ht) {
    const U = g.U;
    const cx = g.W / 2;
    const blue = shade(sky, '#2c5496', '#2a4a8c', 0.5);
    const rim = hex(mixColor(rgb(blue), rgb('#8fb0dc'), 0.22 + sky.night * 0.12));
    ctx.fillStyle = blue;
    ctx.beginPath();
    ctx.moveTo(cx - U * (hb + 1.8), U * (yb - 1.2));
    ctx.quadraticCurveTo(cx - U * hb * 0.95, U * (yb + 0.4), cx - U * hb, U * yb);
    ctx.lineTo(cx + U * hb, U * yb);
    ctx.quadraticCurveTo(cx + U * hb * 0.95, U * (yb + 0.4), cx + U * (hb + 1.8), U * (yb - 1.2));
    ctx.quadraticCurveTo(cx + U * (hb * 0.7 + ht * 0.3), U * (yb - (yb - yt) * 0.35), cx + U * ht, U * yt);
    ctx.lineTo(cx - U * ht, U * yt);
    ctx.quadraticCurveTo(cx - U * (hb * 0.7 + ht * 0.3), U * (yb - (yb - yt) * 0.35), cx - U * (hb + 1.8), U * (yb - 1.2));
    ctx.fill();
    // Tile ridges fan from the top toward the eaves.
    ctx.strokeStyle = rim;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    for (let k = -5; k <= 5; k++) {
      ctx.beginPath();
      ctx.moveTo(cx + U * ht * (k / 5), U * yt);
      ctx.lineTo(cx + U * hb * (k / 5), U * yb);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = hex(mixColor(rgb('#b8803a'), rgb('#e8b650'), sky.night));
    ctx.fillRect(cx - U * (hb + 1), U * (yb - 0.5), U * (hb + 1) * 2, Math.max(1, U * 0.5));
  }

  function paintBands(ctx, g, sky) {
    const U = g.U;
    const cx = g.W / 2;
    const wall = shade(sky, '#9c3424', '#3a1a22', 0.55);
    const gold = hex(mixColor(rgb('#b8803a'), rgb('#e8b650'), sky.night));
    for (const b of [{ y: 54, h: 2.4, w: 15 }, { y: 46.4, h: 2.2, w: 11 }]) {
      ctx.fillStyle = wall;
      ctx.fillRect(cx - U * b.w, U * b.y, U * b.w * 2, U * b.h);
      ctx.fillStyle = gold;
      for (let x = -b.w + 1; x < b.w; x += 2) ctx.fillRect(cx + U * x, U * (b.y + b.h * 0.4), Math.max(1, U * 0.7), Math.max(1, U * 0.7));
    }
  }

  function paintFinial(ctx, g, sky) {
    const U = g.U;
    const cx = g.W / 2;
    ctx.fillStyle = hex(mixColor(rgb('#b8803a'), rgb('#f0c860'), sky.night));
    ctx.beginPath();
    ctx.arc(cx, U * 34.4, U * 2, 0, 6.3);
    ctx.fill();
    ctx.fillRect(cx - U * 0.3, U * 28, Math.max(1, U * 0.6), U * 6);
    ctx.beginPath();
    ctx.arc(cx, U * 31.6, U * 0.9, 0, 6.3);
    ctx.fill();
  }

  function paintHall(ctx, g, sky) {
    paintBase(ctx, g, sky);
    paintRoof(ctx, g, sky, 60.2, 54.2, 22, 15);
    paintBands(ctx, g, sky);
    paintRoof(ctx, g, sky, 54.2, 46.6, 18, 11);
    paintRoof(ctx, g, sky, 46.6, 36, 13.5, 2.2);
    paintFinial(ctx, g, sky);
  }

  // ---- ground ----------------------------------------------------------------

  function paintGround(ctx, g, sky) {
    const U = g.U;
    const top = U * GROUND;
    const floor = shade(sky, '#8a8478', '#1c1e2c', 0.7);
    ctx.fillStyle = floor;
    ctx.fillRect(0, top, g.W, g.H - top);
    ctx.fillStyle = shade(sky, '#6a6a60', '#12141e', 0.7);
    for (let y = GROUND + 2; y < 100; y += 3) ctx.fillRect(0, U * y, g.W, 1);
    // Soft lamp spill on the pavement in front of the stair.
    if (sky.night > 0.05) {
      const spill = ctx.createRadialGradient(g.W / 2, top, 0, g.W / 2, top, U * 26);
      spill.addColorStop(0, `rgba(226,196,130,${0.22 * sky.night})`);
      spill.addColorStop(1, 'rgba(226,196,130,0)');
      ctx.fillStyle = spill;
      ctx.fillRect(g.W / 2 - U * 26, top - U * 8, U * 52, U * 40);
    }
  }

  function paintFront(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const U = g.U;
    const cx = g.W / 2;
    // Distant trees behind the hall.
    ctx.fillStyle = shade(sky, '#4a6a58', '#1c2a32', 0.8);
    for (let x = 0; x < g.W; x += U * 2.2) {
      const h = U * (6 + fbm(x * 0.04, 3, 2, 17) * 7);
      ctx.beginPath();
      ctx.ellipse(x, U * 71 - h * 0.3, U * 2.6, h, 0, 0, 6.3);
      ctx.fill();
    }
    paintGround(ctx, g, sky);
    for (const s of [-1, 1]) {
      paintCypress(ctx, g, sky, cx + s * U * 58, U * 90, U * 1.35);
      paintCypress(ctx, g, sky, cx + s * U * 74, U * 92, U * 1.6);
      paintCypress(ctx, g, sky, cx + s * U * 90, U * 90, U * 1.4);
    }
    paintTerraces(ctx, g, sky);
    paintHall(ctx, g, sky);
    return c;
  }

  // ---- bake ------------------------------------------------------------------

  function makeTwinklers(g, rand) {
    const list = [];
    for (let i = 0; i < TWINKLERS; i++) {
      list.push({ x: Math.floor(rand() * g.W), y: Math.floor(rand() * g.U * 62), p: rand() * 6.3, f: 0.5 + rand() * 1.2, big: rand() < 0.3 });
    }
    return list;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(47);
    state.sky = paintSky(g, sky, rand);
    state.front = paintFront(g, sky);
    state.dim = sky.night;
    state.cloudAlpha = 0.45 - sky.night * 0.2;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------------

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 1.6) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.U * 6);
    ctx.drawImage(c, off + c.width, g.U * 6);
    ctx.globalAlpha = 1;
  }

  function drawStars(ctx, t, amount) {
    if (amount <= 0 || state.dim < 0.2) return;
    ctx.fillStyle = '#f2efe0';
    for (let i = 0; i < state.stars.length; i++) {
      const s = state.stars[i];
      const a = 0.5 + 0.5 * Math.sin(t * s.f * 1.6 + s.p);
      ctx.globalAlpha = Math.min(1, state.dim * a * amount * 0.9);
      ctx.fillRect(s.x, s.y, s.big ? 2 : 1, s.big ? 2 : 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const m = state.mist;
    const off = -((t * g.U * 1.1) % m.width);
    const y = g.U * 83;
    ctx.globalAlpha = Math.min(1, (0.8 - state.dim * 0.3) * amount);
    ctx.drawImage(m, off, y);
    ctx.drawImage(m, off + m.width, y);
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.28));
    state.mist = paintMist(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.14));
    state.stars = makeTwinklers(g, K.rng(5));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawStars(ctx, t, props.stars);
    drawClouds(ctx, g, t, props.clouds);
    ctx.drawImage(state.front, 0, 0);
    drawMist(ctx, g, t, props.mist);
  }

  Kasuri.run({
    defaults: { time: 'night', clouds: 1, stars: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
