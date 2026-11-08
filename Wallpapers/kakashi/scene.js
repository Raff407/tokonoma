/*
 * 案山子 Kakashi — a ragged scarecrow in a ripe rice field at sunset.
 *
 * Sky, hills, field, the drying rack and the scarecrow's body are baked once.
 * The rolling rice is a handful of light bands travelling toward you in
 * perspective; sleeves, tatters, hat, crows, dragonflies and the near stalks
 * are a few hundred short paths a frame, refilled in arrays made in setup.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const HORIZON = 0.56;
  const AZE = 0.655;
  const CRESTS = 9;
  const CREST_PTS = 28;
  const Z_NEAR = 1;
  const Z_FAR = 13;
  const SLEEVE_PTS = 12;
  const MAX_CROWS = 5;
  const FLIES = 7;
  const SUN = { x: 0.6, y: 0.49 };
  const FLY_WINGS = [[0.9, -1.1, 1.5, 0.35], [0.3, -1.05, 1.4, -0.3], [0.9, 1.1, 1.5, -0.35], [0.3, 1.05, 1.4, 0.3]];
  const INK = {
    coat: '#5270aa', coatShade: '#44609a', coatDeep: '#34497a', rim: '#e2b06e',
    straw: '#dcb664', strawDark: '#a47e3c', cloth: '#dccca4', clothShade: '#b29e7a',
    rope: '#9c7a46', shu: '#c4503a', pole: '#6e4c32', poleLit: '#a87850',
    crow: '#272b3b', crowRim: '#8a6660', fly: '#cc4a2e', wing: '#efe3c8',
    crest: '#f8dc90', trough: '#8e6024', wood: '#6a4e34',
  };
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function ellipse(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  // Strokes separate segments given as x0, y0, x1, y1 groups (setup only).
  function segs(ctx, colour, width, pts) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 4) {
      ctx.moveTo(pts[i], pts[i + 1]);
      ctx.lineTo(pts[i + 2], pts[i + 3]);
    }
    ctx.stroke();
  }

  // Strokes quadratic curves given as x0, y0, cx, cy, x1, y1 groups (setup only).
  function curves(ctx, colour, width, pts) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 6) {
      ctx.moveTo(pts[i], pts[i + 1]);
      ctx.quadraticCurveTo(pts[i + 2], pts[i + 3], pts[i + 4], pts[i + 5]);
    }
    ctx.stroke();
  }

  // Fills a closed shape from (x, y) through quadratic cx, cy, x1, y1 groups.
  function fillCurves(ctx, colour, x, y, pts) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 0; i < pts.length; i += 4) ctx.quadraticCurveTo(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
    ctx.fill();
  }

  function vertical(ctx, y0, y1, stops) {
    const grad = ctx.createLinearGradient(0, y0, 0, y1);
    for (let i = 0; i < stops.length; i += 2) grad.addColorStop(stops[i], stops[i + 1]);
    return grad;
  }

  // Ground depth z (1 at the bottom edge) to a row of the picture.
  function rowAt(g, z) {
    const yH = g.H * HORIZON;
    return yH + ((g.H - yH) * Z_NEAR) / z;
  }

  function paintSky(ctx, g) {
    const yH = g.H * HORIZON;
    ctx.fillStyle = vertical(ctx, 0, yH, [0, '#686fa4', 0.36, '#94749c', 0.66, '#c47462', 0.88, '#eaa862', 1, '#f4ca80']);
    ctx.fillRect(0, 0, g.W, yH + 1);
    const sx = g.W * SUN.x;
    const sy = g.H * SUN.y;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, g.U * 34);
    glow.addColorStop(0, 'rgba(255,224,150,0.6)');
    glow.addColorStop(1, 'rgba(255,224,150,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, g.W, yH + 1);
    ctx.fillStyle = '#fbe8b4';
    ellipse(ctx, sx, sy, g.U * 5.5, g.U * 5.5);
  }

  function ridge(ctx, g, base, amp, freq, seed, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, g.H * HORIZON + 1);
    for (let x = 0; x <= g.W + 2; x += 1) {
      ctx.lineTo(x, g.H * base - fbm((x / g.U) * freq, seed, 4, seed) * amp * g.H);
    }
    ctx.lineTo(g.W, g.H * HORIZON + 1);
    ctx.fill();
  }

  function paintRice(ctx, g, rand) {
    const yH = g.H * HORIZON;
    ctx.fillStyle = vertical(ctx, yH, g.H, [0, '#e8bc72', 0.3, '#daa650', 1, '#bc8a32']);
    ctx.fillRect(0, yH, g.W, g.H - yH);
    paintPatches(ctx, g);
    const n = Math.round(g.W * (g.H - yH) * 0.45);
    for (let i = 0; i < n; i++) {
      const p = rand();
      const len = g.U * (0.4 + 2.6 * p);
      ctx.fillStyle = rand() < 0.55 ? '#8c6020' : '#f2ce80';
      ctx.globalAlpha = 0.14 + 0.18 * p;
      ctx.fillRect(rand() * g.W, yH + p * (g.H - yH) - len, Math.max(1, g.U * 0.4 * p), len);
    }
    ctx.globalAlpha = 1;
    const hazeTone = 'rgba(246,208,146,';
    ctx.fillStyle = vertical(ctx, yH - g.U * 4, yH + g.U * 8, [0, hazeTone + '0)', 0.4, hazeTone + '0.6)', 1, hazeTone + '0)']);
    ctx.fillRect(0, yH - g.U * 4, g.W, g.U * 12);
  }

  // Large soft patches of lighter and heavier rice, laid on the ground plane.
  function paintPatches(ctx, g) {
    const yH = g.H * HORIZON;
    for (let y = Math.floor(yH) + 1; y < g.H; y += 2) {
      const z = ((g.H - yH) * Z_NEAR) / (y - yH);
      for (let x = 0; x < g.W; x += 2) {
        const v = fbm(((x - g.W / 2) / g.U) * z * 0.02, z * 0.45, 3, 5);
        if (v > 0.58) ctx.fillStyle = 'rgba(240,200,120,0.3)';
        else if (v < 0.42) ctx.fillStyle = 'rgba(150,100,36,0.22)';
        else continue;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  // Sheaves split over the bar, ears hanging, so the curtain ends in a ragged fringe.
  function hangBundles(ctx, g, rand, x0, x1, y, len) {
    const u = g.U;
    const lines = [];
    for (let x = x0; x < x1; x += u * 1.7) {
      const l = len * (0.88 + rand() * 0.2);
      ctx.fillStyle = rand() < 0.5 ? '#dcae5a' : '#c8984a';
      poly(ctx, [x - u * 0.6, y, x + u * 0.6, y, x + u * 1.1, y + l * 0.8, x + u * 0.5, y + l, x, y + l * 0.86, x - u * 0.6, y + l, x - u * 1.1, y + l * 0.8]);
      lines.push(x + u * 0.85, y + u, x + u * 1.05, y + len * 0.75);
    }
    segs(ctx, '#a07834', Math.max(0.5, u * 0.3), lines);
    ctx.fillStyle = '#f0cc80';
    ctx.fillRect(x0 - u * 1.2, y - u * 1.2, x1 - x0 + u * 1.6, u * 1.6);
  }

  function paintRack(ctx, g, rand) {
    const u = g.U;
    const base = g.H * AZE;
    const x0 = g.W * 0.7;
    const x1 = g.W * 0.95;
    const top = base - u * 17;
    ctx.fillStyle = 'rgba(120,80,40,0.35)';
    ctx.fillRect(x0 - u, base - u * 0.6, x1 - x0 + u * 4, u * 1.2);
    hangBundles(ctx, g, rand, x0, x1, top, u * 14);
    const posts = [];
    for (let x = x0 - u * 0.6; x <= x1 + u; x += (x1 - x0) / 4) {
      posts.push(x - u * 1.4, base, x + u * 0.8, top - u * 3, x + u * 1.4, base, x - u * 0.8, top - u * 3);
    }
    segs(ctx, INK.wood, Math.max(1, u * 0.6), posts);
    ctx.fillStyle = INK.wood;
    ctx.fillRect(x0 - u * 2.5, top - u * 1.7, x1 - x0 + u * 5, Math.max(1, u * 0.6));
    state.rackTop = top - u * 1.7;
  }

  // A low earth ridge between paddies; the rack stands on it.
  function paintAze(ctx, g, rand) {
    const u = g.U;
    const y = g.H * AZE;
    ctx.fillStyle = '#9c7444';
    ctx.fillRect(0, y - u * 0.4, g.W, u * 1.6);
    ctx.fillStyle = '#9a9650';
    ctx.fillRect(0, y - u * 0.9, g.W, u * 0.7);
    for (let x = 0; x < g.W; x += u * (0.4 + rand() * 0.8)) {
      const grass = rand() < 0.45;
      const h = grass ? u : u * (0.6 + rand() * 1.4);
      ctx.fillStyle = grass ? '#c2b66a' : '#e2b668';
      ctx.fillRect(x, grass ? y - u * (1 + rand() * 1.2) : y + u * 1.2 - h, Math.max(1, u * 0.38), h);
    }
  }

  function paintWorld(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g);
    ridge(ctx, g, 0.55, 0.11, 0.03, 3, '#a0727e');
    ridge(ctx, g, 0.575, 0.05, 0.08, 8, '#7c5e7c');
    paintRice(ctx, g, rand);
    return c;
  }

  function paintMiddle(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintAze(ctx, g, rand);
    paintRack(ctx, g, rand);
    return c;
  }

  function paintClouds(g) {
    const w = Math.ceil(g.W * 0.75);
    const h = Math.ceil(g.H * 0.2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const k = 2 / g.U;
    const density = (x, y) => fbm(x * 0.022 * k, y * 0.12 * k, 4, 11);
    const tones = [[164, 116, 146, 150], [214, 138, 126, 210], [248, 192, 142, 240]];
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w) * (0.72 + 0.4 * band);
        const level = v > 0.6 ? 2 : v > 0.535 ? 1 : v > 0.47 ? 0 : -1;
        if (level < 0) continue;
        img.data.set(tones[level], (y * w + x) * 4);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // One band edge: depth z bent by a slow sideways wave, into a reused array.
  function crestEdge(g, z, k, t, out, back) {
    for (let i = 0; i <= CREST_PTS; i++) {
      const x = (i / CREST_PTS) * (g.W + 2) - 1;
      const wx = ((x - g.W / 2) / g.U) * z * 0.012;
      const bend = 0.22 * Math.sin(wx * 2.1 + k * 1.7 - t * 0.5);
      const swell = Math.max(0, Math.sin(wx * 1.3 + k * 2.3 - state.waveU));
      out[i] = rowAt(g, z + bend + (back ? 0.5 * (0.25 + swell) : 0));
    }
  }

  function fillBand(ctx, g, top, bottom) {
    ctx.beginPath();
    for (let i = 0; i <= CREST_PTS; i++) ctx.lineTo((i / CREST_PTS) * (g.W + 2) - 1, top[i]);
    for (let i = CREST_PTS; i >= 0; i--) ctx.lineTo((i / CREST_PTS) * (g.W + 2) - 1, bottom[i]);
    ctx.fill();
  }

  function drawWaves(ctx, g, t) {
    const { ya, yb, yc } = state;
    for (let k = 0; k < CRESTS; k++) {
      const u = (k / CRESTS + state.waveV) % 1;
      const z = lerp(Z_FAR, Z_NEAR * 0.75, u);
      const fade = smoothstep(0, 0.18, u) * smoothstep(1, 0.9, u);
      crestEdge(g, z, k, t, ya, false);
      crestEdge(g, z, k, t, yb, true);
      crestEdge(g, z + 0.75, k, t, yc, true);
      ctx.globalAlpha = 0.4 * fade;
      ctx.fillStyle = INK.trough;
      fillBand(ctx, g, yc, yb);
      ctx.globalAlpha = 0.7 * fade;
      ctx.fillStyle = INK.crest;
      fillBand(ctx, g, yb, ya);
    }
    ctx.globalAlpha = 1;
  }

  // The scarecrow is drawn in its own frame: one unit is g.U, x runs from its pole.
  function paintCoat(ctx) {
    ctx.fillStyle = INK.coat;
    ctx.beginPath();
    ctx.moveTo(-9.5, 35);
    ctx.lineTo(9.5, 35);
    ctx.quadraticCurveTo(10.3, 48, 11.2, 61);
    const hem = [9, 62.8, 7.2, 61.2, 5, 63.2, 2.6, 61.4, 0.4, 63, -2.2, 61.2, -4.6, 63.4, -6.8, 61.4, -9, 62.6, -10.8, 61];
    for (let i = 0; i < hem.length; i += 2) ctx.lineTo(hem[i], hem[i + 1]);
    ctx.quadraticCurveTo(-10.4, 48, -9.5, 35);
    ctx.fill();
    ctx.fillStyle = INK.coatShade;
    poly(ctx, [-9.5, 35, -3.5, 35, -4.6, 62, -6.8, 61.4, -9, 62.6, -10.8, 61, -10.2, 48]);
    segs(ctx, INK.coatDeep, 0.5, [-3, 50, -4.2, 61.5, 4.4, 51, 5.8, 62]);
    curves(ctx, INK.rim, 0.7, [8, 35.2, 8.8, 35.3, 9.6, 35.4, 9.6, 35.4, 10.4, 48, 11.2, 60.8]);
  }

  function paintCollar(ctx) {
    ctx.fillStyle = INK.strawDark;
    poly(ctx, [-2.4, 34.8, 2.4, 34.8, 0, 45.5]);
    segs(ctx, INK.straw, 0.3, [-1.6, 35, -0.6, 41, 0, 35, 0, 41, 1.6, 35, 0.6, 41]);
    segs(ctx, INK.cloth, 1.5, [-2.4, 34.6, 1.6, 44.8]);
    segs(ctx, INK.cloth, 1.5, [2.4, 34.6, -4.4, 49.4]);
  }

  function paintBelt(ctx) {
    ctx.fillStyle = INK.rope;
    poly(ctx, [-10.3, 49, 10.4, 48.6, 10.5, 50.6, -10.4, 51]);
    ctx.fillStyle = '#c49a5c';
    poly(ctx, [-10.3, 49, 10.4, 48.6, 10.4, 49.2, -10.3, 49.6]);
    ctx.fillStyle = INK.rope;
    ellipse(ctx, 3.4, 50, 1.4, 1.1);
    segs(ctx, INK.rope, 0.6, [3, 50.6, 2.4, 55.6, 3.8, 50.6, 4.8, 55]);
  }

  function patch(ctx, x, y, w, h, rot, colour) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = INK.cloth;
    for (let i = 0.4; i < w; i += 0.9) {
      ctx.fillRect(i, -0.1, 0.35, 0.3);
      ctx.fillRect(i, h - 0.2, 0.35, 0.3);
    }
    ctx.restore();
  }

  function paintHead(ctx) {
    ctx.fillStyle = INK.pole;
    ctx.fillRect(-0.9, 29, 1.8, 7);
    ctx.fillStyle = INK.clothShade;
    ellipse(ctx, 0, 25, 5.9, 6.3);
    ctx.fillStyle = INK.cloth;
    ellipse(ctx, 0.8, 24.6, 5.0, 5.8);
    ctx.strokeStyle = '#f4d898';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.ellipse(0, 25, 5.9, 6.3, 0, -1.3, 1.0);
    ctx.stroke();
    ctx.fillStyle = '#c4b088';
    poly(ctx, [-3.4, 29.8, 3.6, 29.8, 1.8, 33, -1.4, 33]);
    segs(ctx, '#8a6a3a', 0.7, [-2.6, 31.2, 2.8, 31.2]);
    // Closed, sleepy eyes and a small mouth.
    curves(ctx, '#4a3a44', 0.55, [-3, 24.2, -1.9, 25.4, -0.8, 24.2, 1.3, 24.2, 2.4, 25.4, 3.5, 24.2, -0.6, 27.8, 0.5, 28.5, 1.8, 27.8]);
  }

  function paintBody(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.setTransform(g.U, 0, 0, g.U, state.sx, 0);
    paintCoat(ctx);
    paintCollar(ctx);
    paintBelt(ctx);
    patch(ctx, -8.2, 52.6, 4, 4.4, -0.08, '#b44a38');
    patch(ctx, 4.2, 38.6, 3.4, 3.2, 0.1, '#b89a58');
    patch(ctx, -7.6, 39.6, 3, 3.6, 0.05, '#6680b0');
    paintHead(ctx);
    return c;
  }

  function paintHat(g) {
    const u = g.U;
    const c = layer(u * 36, u * 16);
    const ctx = c.getContext('2d');
    state.hatPX = u * 18;
    state.hatPY = u * 12;
    ctx.setTransform(u, 0, 0, u, state.hatPX, state.hatPY);
    ctx.fillStyle = '#6e5434';
    ellipse(ctx, 0, 0.9, 15.8, 1.9);
    fillCurves(ctx, '#b8924a', -16.5, 0.6, [-7, -3.6, 0, -10.5, 7, -3.6, 16.5, 0.6, 0, 2.6, -16.5, 0.6]);
    fillCurves(ctx, '#e2c27a', 0.3, -10.3, [7, -3.6, 16.5, 0.6, 8, 2, 3.6, 1.8]);
    paintHatStraw(ctx);
    ctx.globalCompositeOperation = 'destination-out';
    poly(ctx, [-12.4, 0.4, -9.8, 1.9, -13.6, 2.4]);
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  function paintHatStraw(ctx) {
    const rim = (x) => 0.8 + (1 - (x / 16) * (x / 16)) * 1.6;
    const spokes = [];
    for (let i = 0; i <= 16; i++) spokes.push(0, -10.3, -16 + i * 2, rim(-16 + i * 2));
    segs(ctx, '#8e6c34', 0.28, spokes);
    const ends = [];
    for (let i = 0; i < 18; i++) {
      const x = -16 + i * 1.9;
      ends.push(x, rim(x), x + Math.sin(i * 2.3) * 0.9, rim(x) + 1 + (i % 3) * 0.5);
    }
    segs(ctx, '#e8c878', 0.3, ends);
    ctx.fillStyle = '#8e6c34';
    ellipse(ctx, 0, -10.2, 0.8, 0.6);
  }

  // Fills the hanging sleeve's lower edge into the reused arrays.
  function shapeSleeve(side, t, gust) {
    const inner = 8 * side;
    const outer = 25.5 * side;
    const push = gust * (2.2 + 0.9 * Math.sin(t * 1.3 + side));
    for (let i = 0; i <= SLEEVE_PTS; i++) {
      const f = i / SLEEVE_PTS;
      const corner = f < 0.2 ? (0.2 - f) * 14 : 0;
      const hang = lerp(15.5, 9, f * f) - corner + state.rag[i];
      const ripple = Math.sin(t * 3.3 - f * 5 + side) * 0.9 * (0.3 + gust);
      state.bx[i] = lerp(outer, inner, f) + push * (1 - f * 0.7) + Math.sin(t * 2.1 - f * 3) * 0.5 * gust;
      state.by[i] = 34.8 + hang - Math.abs(push) * 0.45 * (1 - f) + ripple;
    }
    state.sleeve.inner = inner;
    state.sleeve.outer = outer;
    state.sleeve.push = push;
    return state.sleeve;
  }

  function sleeveLines(ctx, s, side) {
    const { bx, by } = state;
    ctx.strokeStyle = INK.coatDeep;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 2; i <= SLEEVE_PTS; i++) ctx.lineTo(bx[i], by[i] - 0.6);
    ctx.stroke();
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    for (let k = 4; k <= 8; k += 4) {
      ctx.moveTo(lerp(s.outer, s.inner, k / SLEEVE_PTS), 36);
      ctx.lineTo(bx[k], by[k] - 1.5);
    }
    ctx.stroke();
    ctx.strokeStyle = INK.rim;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(s.inner, 34.7);
    ctx.lineTo(s.outer, 34.7);
    if (side > 0) ctx.lineTo(s.outer + s.push * 0.2, 37.5);
    ctx.stroke();
  }

  function drawSleeve(ctx, side, t, gust) {
    const s = shapeSleeve(side, t, gust);
    const { bx, by } = state;
    ctx.fillStyle = side < 0 ? INK.coatShade : INK.coat;
    ctx.beginPath();
    ctx.moveTo(s.inner, 34.6);
    ctx.lineTo(s.outer, 34.6);
    ctx.lineTo(s.outer + s.push * 0.2, 37.5);
    for (let i = 0; i <= SLEEVE_PTS; i++) ctx.lineTo(bx[i], by[i]);
    ctx.lineTo(s.inner, 44);
    ctx.fill();
    sleeveLines(ctx, s, side);
    if (side > 0) patch(ctx, 14, 36.4, 3.4, 3, 0.04, '#6680b0');
    for (const strip of state.sleeveStrips) {
      if (strip.side === side) drawStrip(ctx, bx[strip.at], by[strip.at] - 0.4, strip, t, gust);
    }
  }

  function drawStrip(ctx, x, y, s, t, gust) {
    const seg = s.len / 4;
    ctx.strokeStyle = s.colour;
    ctx.lineWidth = s.w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 1; k <= 4; k++) {
      const flutter = Math.sin(t * 4.1 + s.ph - k * 0.9) * 0.16 * k * (0.3 + gust);
      const a = Math.min(1.75, s.bias + gust * s.give * (0.5 + 0.25 * k) + flutter);
      x += Math.sin(a) * seg;
      y += Math.cos(a) * seg;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawHands(ctx, t, gust) {
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? INK.straw : INK.strawDark;
      ctx.lineWidth = pass ? 0.5 : 0.7;
      ctx.beginPath();
      for (const s of state.straws) {
        if (s.tone !== pass) continue;
        const x0 = s.side * 25 + (s.side > 0 ? gust * 0.6 : gust * 0.9);
        const y0 = 35.4 + s.y;
        const a = s.a + Math.sin(t * 5 + s.ph) * 0.08 * (0.4 + gust);
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + s.side * Math.cos(a) * s.len + gust * 0.9, y0 + Math.sin(a) * s.len);
      }
      ctx.stroke();
    }
  }

  function drawHat(ctx, g, t, gust) {
    const a = -0.05 + gust * (0.06 + 0.05 * Math.sin(t * 1.1)) + 0.025 * Math.sin(t * 2.6) * gust;
    const lift = Math.max(0, Math.sin(t * 1.1 + 0.6)) * gust * g.U * 0.5;
    ctx.setTransform(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), state.sx + g.U * 0.4, g.U * 21 - lift);
    ctx.drawImage(state.hat, -state.hatPX, -state.hatPY);
  }

  function drawScarecrow(ctx, g, t, gust) {
    ctx.setTransform(g.U, 0, 0, g.U, state.sx, 0);
    ctx.fillStyle = INK.pole;
    ctx.fillRect(-0.8, 30, 1.6, 58);
    ctx.fillRect(-31, 35, 62, 1.3);
    ctx.fillStyle = INK.poleLit;
    ctx.fillRect(0.3, 30, 0.5, 58);
    ctx.fillRect(-31, 35, 62, 0.4);
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    drawSleeve(ctx, -1, t, gust);
    drawSleeve(ctx, 1, t, gust);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(state.body, 0, 0);
    ctx.setTransform(g.U, 0, 0, g.U, state.sx, 0);
    for (const s of state.hemStrips) drawStrip(ctx, s.x, s.y, s, t, gust);
    drawHands(ctx, t, gust);
    drawHat(ctx, g, t, gust);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function makeCloth(rand) {
    const tones = [INK.coat, INK.coatDeep, INK.coatShade, '#b44a38', INK.cloth];
    const strip = (x, y, len, w, colour, bias, give) => ({ x, y, len, w, colour, bias, give, ph: rand() * 6.28 });
    state.hemStrips = [8.4, 1.4, -5.6].map((x, i) => strip(x, 61.8, 3.5 + rand() * 2.5, 1 + rand() * 0.5, tones[i + 1], 0.25, 0.8));
    state.hemStrips.push(strip(2, 31.4, 10, 1.4, INK.shu, 0.35, 0.8));
    state.hemStrips.push(strip(2.4, 31.6, 6.5, 1.1, INK.shu, 0.15, 0.7));
    state.sleeveStrips = [];
    for (const side of [-1, 1]) {
      for (const at of [3, 7]) {
        const s = strip(0, 0, 3 + rand() * 3, 0.9 + rand() * 0.5, tones[Math.floor(rand() * 3)], 0.1, 0.7);
        state.sleeveStrips.push(Object.assign(s, { side, at }));
      }
    }
    state.rag = new Float32Array(SLEEVE_PTS + 1);
    for (let i = 0; i <= SLEEVE_PTS; i++) state.rag[i] = (i % 2 ? 0.9 : -0.3) * (0.5 + rand());
    state.straws = [];
    for (let i = 0; i < 18; i++) {
      state.straws.push({ side: i < 9 ? -1 : 1, y: rand() * 3.4, a: -0.5 + rand() * 1.2, len: 3.5 + rand() * 3.5, tone: i % 2, ph: rand() * 6.28 });
    }
    state.sleeve = { inner: 0, outer: 0, push: 0 };
  }

  function makeSpots(g) {
    const u = g.U;
    return [
      { x: state.sx - u * 19, y: u * 34.6, s: 1.45, dir: -1, ground: false },
      { x: state.sx + u * 19.5, y: u * 34.6, s: 1.45, dir: 1, ground: false },
      { x: g.W * 0.77, y: state.rackTop, s: 0.6, dir: -1, ground: false },
      { x: g.W * 0.89, y: state.rackTop, s: 0.6, dir: 1, ground: false },
      { x: g.W * 0.84, y: g.H * AZE - u * 0.6, s: 0.75, dir: -1, ground: true },
    ].map((s) => Object.assign(s, { busy: false }));
  }

  function setFlight(c, x0, y0, x1, y1, x2, y2, s0, s1, dur) {
    Object.assign(c, { mode: 'fly', k: 0, x0, y0, x1, y1, x2, y2, s0, s1, dur });
    c.dir = x2 > x0 ? 1 : -1;
  }

  function launchIn(c, g, rand) {
    const free = state.spots.filter((s) => !s.busy);
    c.timer = 2;
    if (!free.length) return;
    const spot = free[Math.floor(rand() * free.length)];
    spot.busy = true;
    c.spot = spot;
    c.leaving = false;
    const x0 = rand() < 0.5 ? -g.U * 12 : g.W + g.U * 12;
    const y0 = g.H * (0.06 + rand() * 0.2);
    const y1 = Math.min(y0, spot.y) - g.U * 4;
    setFlight(c, x0, y0, lerp(x0, spot.x, 0.6), y1, spot.x, spot.y, Math.max(1.2, spot.s * 1.15), spot.s, 4.5 + rand() * 2);
  }

  function launchOut(c, g, rand) {
    const s = c.spot;
    const x2 = rand() < 0.5 ? -g.U * 14 : g.W + g.U * 14;
    c.leaving = true;
    setFlight(c, s.x, s.y, lerp(s.x, x2, 0.3), s.y - g.U * 16, x2, g.H * (0.04 + rand() * 0.18), s.s, Math.max(1.2, s.s * 1.15), 4 + rand() * 2);
  }

  function updateCrow(c, g, dt, active, rand) {
    c.timer -= dt;
    c.flap += dt * 12;
    if (c.mode === 'away' && c.timer <= 0) {
      if (active) launchIn(c, g, rand);
      else c.timer = 2;
    } else if (c.mode === 'fly') {
      c.k = Math.min(1, c.k + dt / c.dur);
      if (c.k >= 1 && c.leaving) {
        c.spot.busy = false;
        c.mode = 'away';
        c.timer = 3 + rand() * 9;
      } else if (c.k >= 1) {
        c.mode = 'sit';
        c.timer = 8 + rand() * 12;
        c.dir = c.spot.ground || rand() < 0.5 ? c.spot.dir : -c.spot.dir;
      }
    } else if ((c.timer <= 0 || !active) && c.mode === 'sit') {
      launchOut(c, g, rand);
    }
  }

  function sitCrow(ctx, peck) {
    ctx.rotate(peck * 0.55);
    poly(ctx, [-1.6, -2.3, -5.3, -1.1, -5.1, -0.3, -1.4, -1.3]);
    ellipse(ctx, 0, -2.6, 2.8, 1.75, -0.22);
    ellipse(ctx, 2.4, -4.3, 1.3, 1.25);
    poly(ctx, [3.3, -4.75, 5.1, -4.05, 3.4, -3.65]);
    ctx.fillRect(-0.1, -1.4, 0.35, 1.4);
    ctx.fillRect(-0.9, -1.4, 0.35, 1.4);
    ctx.fillStyle = INK.crowRim;
    ctx.globalAlpha = 0.7;
    ellipse(ctx, 0.6, -4.05, 2, 0.32, -0.25);
    ctx.globalAlpha = 1;
  }

  function crowWing(ctx, lift) {
    poly(ctx, [1.2, -2.5, -1, -2.5, -1.8, -2.4 - 5.6 * lift, -3.4, -2.4 - 5.2 * lift, 0.6, -2.4 - 3.4 * lift]);
  }

  function flyCrow(ctx, f) {
    ctx.globalAlpha = 0.85;
    crowWing(ctx, f * 0.8 + 0.1);
    ctx.globalAlpha = 1;
    poly(ctx, [-2.2, -2.9, -4.8, -3.5, -5, -1.7, -2.2, -2.1]);
    ellipse(ctx, 0, -2.4, 2.7, 0.95);
    ellipse(ctx, 2.8, -2.75, 0.95, 0.9);
    poly(ctx, [3.6, -3, 5, -2.55, 3.6, -2.2]);
    crowWing(ctx, f);
  }

  function drawCrow(ctx, g, c, t) {
    let { x, y, s } = c.spot;
    if (c.mode === 'fly') {
      const k = c.leaving ? c.k * c.k : 1 - (1 - c.k) * (1 - c.k);
      const m = 1 - k;
      x = m * m * c.x0 + 2 * m * k * c.x1 + k * k * c.x2;
      y = m * m * c.y0 + 2 * m * k * c.y1 + k * k * c.y2;
      s = lerp(c.s0, c.s1, k);
    }
    const u = g.U * s * 0.9;
    ctx.setTransform(u * c.dir, 0, 0, u, x, y);
    ctx.fillStyle = INK.crow;
    if (c.mode === 'sit') {
      sitCrow(ctx, c.spot.ground ? smoothstep(0.75, 0.95, Math.sin(t * 1.4 + c.ph)) : 0);
    } else {
      const landing = !c.leaving && c.k > 0.82;
      const glide = !c.leaving && c.k > 0.4 && c.k < 0.65;
      flyCrow(ctx, landing ? 0.95 : glide ? 0.4 : 0.3 + 0.7 * Math.sin(c.flap));
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawCrows(ctx, g, t, near) {
    for (const c of state.crows) {
      if (c.mode === 'away') continue;
      const isNear = c.mode === 'fly' || c.spot.s >= 1.4;
      if (isNear === near) drawCrow(ctx, g, c, t);
    }
  }

  function drawFlies(ctx, g, t) {
    for (const d of state.flies) {
      const phase = t * d.w + 0.9 * Math.sin(t * d.w * 2.3 + d.p);
      const bx = ((d.bx + state.drift * d.s) % (g.W + g.U * 40)) - g.U * 20;
      const x = bx + d.ax * Math.sin(phase);
      const y = d.by + d.ay * Math.sin(phase * 1.7 + d.p);
      const u = g.U * d.s;
      ctx.setTransform(Math.cos(phase) >= 0 ? u : -u, 0, 0, u, x, y);
      ctx.fillStyle = INK.wing;
      ctx.globalAlpha = 0.6;
      for (const w of FLY_WINGS) ellipse(ctx, w[0], w[1], 0.4, w[2], w[3]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = INK.fly;
      ctx.fillRect(-2.8, -0.25, 3.4, 0.5);
      ellipse(ctx, 0.9, 0, 0.75, 0.55);
      ellipse(ctx, 1.9, 0, 0.5, 0.5);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function stalkPaths(ctx, g, t, gust, row, part) {
    ctx.beginPath();
    for (const s of state.stalks) {
      if (s.row !== row) continue;
      const sway = g.U * (0.4 + gust * (1.3 + Math.sin(t * 1.4 - s.x / (g.U * 9) + s.ph * 0.3)));
      const { x: bx } = s;
      const tx = bx + sway + s.lean;
      const ty = g.H - s.h;
      if (part === 0) {
        ctx.moveTo(bx, g.H + g.U);
        ctx.quadraticCurveTo(bx + sway * 0.2, g.H - s.h * 0.55, tx, ty);
      } else if (part === 1) {
        ctx.moveTo(bx + sway * 0.08, g.H - s.h * 0.25);
        ctx.quadraticCurveTo(bx + s.side * g.U * 4 + sway * 0.4, g.H - s.h * 0.62, bx + s.side * g.U * 7 + sway * 0.9, g.H - s.h * 0.45);
      } else {
        ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(tx + g.U * 2.6 + sway * 0.4, ty - g.U * 0.9, tx + g.U * 3.4 + sway * 0.6, ty + g.U * 5.2);
      }
    }
    ctx.stroke();
  }

  // Per row: stem, leaf, ear, ear highlight as [colour, width in U, part].
  const STALK_INKS = [
    [['#987634', 0.55, 0], ['#8c863e', 0.75, 1], ['#c4963e', 1.8, 2], ['#e0b864', 0.6, 2]],
    [['#b08c40', 0.55, 0], ['#a8a04a', 0.75, 1], ['#deb052', 1.8, 2], ['#f6d88a', 0.6, 2]],
  ];

  function drawStalks(ctx, g, t, gust) {
    ctx.lineCap = 'round';
    for (let row = 0; row < 2; row++) {
      for (const [colour, width, part] of STALK_INKS[row]) {
        ctx.strokeStyle = colour;
        ctx.lineWidth = g.U * width;
        stalkPaths(ctx, g, t, gust, row, part);
      }
    }
    ctx.lineCap = 'butt';
  }

  function makeStalks(g, rand) {
    const list = [];
    for (let row = 0; row < 2; row++) {
      for (let x = -g.U * 3 + rand() * g.U * 2; x < g.W; x += g.U * (1.4 + rand() * 3.2)) {
        const clump = fbm(x / (g.U * 14), row * 3, 2, 21);
        const h = g.U * (row ? 6 + clump * 16 : 9 + clump * 22) * (0.8 + rand() * 0.4);
        list.push({ row, x, h, lean: (rand() - 0.5) * g.U * 3, side: rand() < 0.5 ? -1 : 1, ph: rand() * 6.28 });
      }
    }
    return list;
  }

  function makeFlies(g, rand) {
    const list = [];
    for (let i = 0; i < FLIES; i++) {
      const by = g.H * (0.4 + rand() * 0.34);
      const bx = (i / FLIES) * (g.W + g.U * 40) + rand() * g.U * 10;
      list.push({ bx, by, ax: g.U * (6 + rand() * 12), ay: g.U * (2 + rand() * 4), w: 0.12 + rand() * 0.12, p: rand() * 6.28, s: 1.1 + rand() * 0.5 });
    }
    return list;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    Object.assign(state, { g, rand, sx: g.W * 0.33, waveU: 0, waveV: 0, cloudX: 0, drift: 0 });
    state.world = paintWorld(g, rand);
    state.middle = paintMiddle(g, rand);
    state.clouds = paintClouds(g);
    state.body = paintBody(g);
    state.hat = paintHat(g);
    for (const key of ['bx', 'by']) state[key] = new Float32Array(SLEEVE_PTS + 1);
    for (const key of ['ya', 'yb', 'yc']) state[key] = new Float32Array(CREST_PTS + 1);
    makeCloth(rand);
    state.spots = makeSpots(g);
    const crow = (i) => ({ mode: 'away', timer: 0.5 + i * 2.5 + rand() * 2, flap: rand() * 6, ph: rand() * 6.28, k: 0, dir: 1, spot: null });
    state.crows = Array.from({ length: MAX_CROWS }, (_, i) => crow(i));
    state.flies = makeFlies(g, rand);
    state.stalks = makeStalks(g, rand);
  }

  function advance(g, dt, wind, crows) {
    state.waveU += dt * (0.2 + wind * 0.5);
    state.waveV += dt * (0.008 + wind * 0.03);
    state.cloudX += dt * g.U * (0.25 + wind * 0.5);
    state.drift += dt * g.U * (0.3 + wind * 0.9);
    for (let i = 0; i < state.crows.length; i++) updateCrow(state.crows[i], g, dt, i < crows, state.rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const wind = api.props.wind;
    const gust = wind * (0.75 + 0.25 * Math.sin(t * 0.37) + 0.12 * Math.sin(t * 1.13));
    advance(g, Math.min(dt, 0.25), wind, Math.round(api.props.crows));
    ctx.drawImage(state.world, 0, 0);
    const cw = state.clouds.width * 2;
    const cx = (state.cloudX % cw) - cw;
    ctx.drawImage(state.clouds, cx, g.H * 0.1, cw, state.clouds.height * 2);
    ctx.drawImage(state.clouds, cx + cw, g.H * 0.1, cw, state.clouds.height * 2);
    drawWaves(ctx, g, t);
    ctx.drawImage(state.middle, 0, 0);
    drawCrows(ctx, g, t, false);
    drawScarecrow(ctx, g, t, gust);
    drawCrows(ctx, g, t, true);
    drawFlies(ctx, g, t);
    drawStalks(ctx, g, t, gust);
  }

  Kasuri.run({
    defaults: { wind: 1, crows: 3, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.05, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
