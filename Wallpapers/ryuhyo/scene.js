/*
 * 流氷 Ryuhyo — drift ice packing a northern sea under a low winter sun.
 *
 * Each floe is a small baked sprite (white top, blue-green side, pale ice under
 * the water) drawn with one squashed, rotated transform, so the pack drifts and
 * turns for a couple of hundred drawImage calls. Sky, mountains, the far ice and
 * the near floe are baked once; seals, eagles, glints and haze are a few paths.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const HORIZON = 0.37;
  const SHAPES = 10;
  const SPRITE = 64;
  const SPRITE_R = SPRITE * 0.4;
  const MAX_FLOES = 180;
  const GLINTS = 70;
  const ICE = { top: '#e3e8e8', snow: '#f5f3ea', shade: '#b8cad2', rim: '#a3c0c8', side: '#4f9195', halo: '#3f7f89' };
  const SEAL = { body: '#a2a39c', back: '#7f837f', belly: '#cbc6b5', dark: '#4e5455', eye: '#1f2326' };
  const EAGLE = {
    body: '#8a6446', wing: '#6b4b33', head: '#957457', white: '#f3efe4', tailShade: '#a9b8bf',
    beak: '#d9a043', eye: '#2a2320', shadow: 'rgba(96,128,146,0.45)',
  };
  const EAGLE_V = 0.22;
  const EAGLE_LANE = 0.035;
  const TAIL = [-2, -3.6, -6.6, -0.6, -6, 0.4, -4.6, 0.5, -0.8, -2];
  const SEALS = [
    { x: -0.5, y: 0.05, s: 1, dir: 1, rate: 0.42, ph: 0 },
    { x: 0.04, y: 0.42, s: 1.1, dir: -1, rate: 0.31, ph: 2.1 },
    { x: 0.5, y: -0.28, s: 0.86, dir: 1, rate: 0.55, ph: 4.2 },
  ];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function floeRadius(g, v) {
    return g.U * (1.3 + 25 * Math.pow(v, 1.15));
  }

  function squash(v) {
    return 0.17 + 0.4 * v;
  }

  // ---- baked backdrop: sky, sun, mountains, open water --------------------

  function paintSky(ctx, g) {
    const sky = ctx.createLinearGradient(0, 0, 0, g.hz);
    sky.addColorStop(0, '#7787a0');
    sky.addColorStop(0.6, '#a9b0b9');
    sky.addColorStop(1, '#d8d2c0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.hz + 1);
    const r = g.U * 26;
    const halo = ctx.createRadialGradient(g.sunX, g.sunY, 0, g.sunX, g.sunY, r);
    halo.addColorStop(0, 'rgba(248,238,208,0.9)');
    halo.addColorStop(0.22, 'rgba(240,226,192,0.45)');
    halo.addColorStop(1, 'rgba(240,226,192,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(g.sunX - r, g.sunY - r, r * 2, r * 2);
    ctx.fillStyle = '#f7f0da';
    ctx.beginPath();
    ctx.arc(g.sunX, g.sunY, g.U * 3.4, 0, 6.3);
    ctx.fill();
  }

  // A flank sags from the summit to the shore, with a little rock in its line.
  function flank(g, rand, px, ph, w, pts) {
    const steps = 9;
    for (let i = 1; i <= steps; i++) {
      const s = i / steps;
      const jag = i < steps ? (rand() - 0.5) * g.U * 0.9 : 0;
      pts.push(px + w * s, g.hz - ph * Math.pow(1 - s, 1.6) + jag);
    }
  }

  function path(ctx, pts) {
    for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  }

  function pathBack(ctx, pts) {
    for (let i = pts.length - 2; i >= 0; i -= 2) ctx.lineTo(pts[i], pts[i + 1]);
  }

  // One snowy peak: all of it in blue shade, then the face toward the sun lit.
  function paintPeak(ctx, g, rand, px, ph, w, o) {
    const left = [];
    const right = [];
    const divide = [];
    flank(g, rand, px, ph, -w * (0.8 + rand() * 0.5), left);
    flank(g, rand, px, ph, w * (0.8 + rand() * 0.5), right);
    for (let i = 1; i <= 6; i++) {
      const s = i / 6;
      divide.push(px + w * (0.12 * s + (rand() - 0.5) * 0.08), g.hz - ph * (1 - s));
    }
    ctx.fillStyle = o.shade;
    ctx.beginPath();
    ctx.moveTo(px, g.hz - ph);
    path(ctx, left);
    pathBack(ctx, right);
    ctx.fill();
    ctx.fillStyle = o.lit;
    ctx.beginPath();
    ctx.moveTo(px, g.hz - ph);
    path(ctx, right);
    pathBack(ctx, divide);
    ctx.fill();
  }

  function paintRange(ctx, g, rand, o) {
    const count = Math.max(3, Math.round(g.W / (g.U * o.spacing)));
    const peaks = [];
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5 + (rand() - 0.5) * 0.7) / count) * g.W * o.reach;
      const env = lerp(1, o.fade, x / g.W);
      const ph = g.U * (o.low + rand() * (o.high - o.low)) * env;
      peaks.push({ x, ph, w: ph * (3 + rand() * 2.2) });
    }
    peaks.sort((a, b) => b.ph - a.ph);
    for (const p of peaks) paintPeak(ctx, g, rand, p.x, p.ph, p.w, o);
    ctx.fillStyle = o.foot;
    ctx.beginPath();
    ctx.moveTo(0, g.hz + 1);
    for (let x = 0; x <= g.W; x += 1) {
      const n = fbm((x / g.U) * 0.5, 3.5, 2, o.low * 7);
      ctx.lineTo(x, g.hz - g.U * o.footH * n * lerp(1, o.fade, x / g.W));
    }
    ctx.lineTo(g.W, g.hz + 1);
    ctx.fill();
  }

  function paintWater(ctx, g, rand) {
    const sea = ctx.createLinearGradient(0, g.hz, 0, g.H);
    sea.addColorStop(0, '#62778a');
    sea.addColorStop(0.35, '#3b5569');
    sea.addColorStop(1, '#2b4558');
    ctx.fillStyle = sea;
    ctx.fillRect(0, g.hz, g.W, g.H - g.hz);
    ctx.fillStyle = '#4c667a';
    for (let i = 0; i < g.W * 1.2; i++) {
      const v = rand();
      const y = g.hz + v * (g.H - g.hz);
      ctx.globalAlpha = 0.5;
      ctx.fillRect(rand() * g.W, y, g.U * (1 + v * 6) * (0.5 + rand()), Math.max(1, v * g.U * 0.5));
    }
    ctx.globalAlpha = 1;
  }

  function paintBase(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g);
    paintRange(ctx, g, rand, { spacing: 24, reach: 1.05, low: 5, high: 12, fade: 0.45, footH: 2, foot: '#7f8ca1', lit: '#d6dbe0', shade: '#a3aec0' });
    paintRange(ctx, g, rand, { spacing: 30, reach: 0.6, low: 2.5, high: 5.5, fade: 0.2, footH: 2.6, foot: '#5f6b80', lit: '#c3cbd4', shade: '#8794a8' });
    paintWater(ctx, g, rand);
    return c;
  }

  // ---- seamless noise strips for cloud and sea haze ------------------------

  function paintStreaks(w, h, o) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const d = img.data;
    const f = (x, y) => fbm(x * o.fx, y * o.fy, 4, o.seed);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin(((y + 0.5) / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(f(x, y), f(x - c.width, y), x / c.width);
        const a = Math.round(smoothstep(o.lo, o.hi, v) * band * 6) / 6;
        const i = (y * c.width + x) * 4;
        d[i] = o.rgb[0];
        d[i + 1] = o.rgb[1];
        d[i + 2] = o.rgb[2];
        d[i + 3] = a * o.alpha;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- floe sprites ---------------------------------------------------------

  // Few corners and uneven radii: broken plates, not round pads.
  function outline(rand, n, low) {
    const radii = [];
    for (let i = 0; i < n; i++) radii.push(low + rand() * (1 - low));
    return radii;
  }

  function tracePoly(ctx, cx, cy, rx, ry, radii) {
    const n = radii.length;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = cx + Math.cos(a) * rx * radii[i];
      const y = cy + Math.sin(a) * ry * radii[i];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function paintIceTop(ctx, rand, cx, cy, rx, ry, radii, marks) {
    tracePoly(ctx, cx, cy, rx, ry, radii);
    ctx.fillStyle = ICE.top;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = ICE.shade;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.1, cy + ry * 1.05, rx * 1.2, ry * 0.5, 0, 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = 1;
    for (let i = 0; i < marks; i++) {
      const x = cx + (rand() - 0.5) * rx * 1.4;
      const y = cy + (rand() - 0.6) * ry * 1.2;
      const w = rx * (0.15 + rand() * 0.3);
      const k = (ry / rx) * 0.3;
      ctx.fillStyle = ICE.shade;
      ctx.beginPath();
      ctx.ellipse(x - w * 0.1, y + w * k * 0.6, w, w * k, 0, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = ICE.snow;
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.95, w * k * 0.9, 0, 0, 6.3);
      ctx.fill();
    }
    ctx.restore();
  }

  function floeSprite(rand) {
    const radii = outline(rand, 7 + Math.floor(rand() * 4), 0.62);
    const rx = SPRITE_R;
    const ry = SPRITE_R * (0.6 + rand() * 0.4);
    const m = SPRITE / 2;
    const top = layer(SPRITE, SPRITE);
    paintIceTop(top.getContext('2d'), rand, m, m, rx, ry, radii, 3);
    const side = layer(SPRITE, SPRITE);
    const sctx = side.getContext('2d');
    sctx.fillStyle = ICE.side;
    tracePoly(sctx, m, m, rx, ry, radii);
    sctx.fill();
    const halo = layer(SPRITE, SPRITE);
    const hctx = halo.getContext('2d');
    hctx.fillStyle = ICE.halo;
    tracePoly(hctx, m, m, rx * 1.16, ry * 1.16, radii);
    hctx.fill();
    return { top, side, halo };
  }

  // One floe: rotate in its own plane, then flatten for the low view.
  function placeFloe(ctx, x, y, r, sq, rot) {
    const k = r / SPRITE_R;
    const c = Math.cos(rot) * k;
    const s = Math.sin(rot) * k;
    ctx.setTransform(c, s * sq, -s, c * sq, x, y);
  }

  function stampFloe(ctx, set, f, x, y, rot) {
    const m = -SPRITE / 2;
    placeFloe(ctx, x, y + f.thick, f.r, f.sq, rot);
    ctx.drawImage(set.side, m, m);
    placeFloe(ctx, x, y, f.r, f.sq, rot);
    ctx.drawImage(set.top, m, m);
  }

  // ---- far pack: compact ice at the horizon, a slow sliding strip -----------

  function paintFarIce(g, rand) {
    const w = Math.ceil(g.W * 1.5);
    const deep = g.sea * 0.2;
    const c = layer(w, deep + g.U * 3);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#c4ced6';
    ctx.fillRect(0, 0, w, g.sea * 0.03);
    const list = [];
    for (let i = 0; i < w * 0.75; i++) {
      const v = 0.015 + 0.17 * Math.pow(rand(), 1.3);
      list.push({ x: rand() * w, v, shape: Math.floor(rand() * SHAPES), rot: rand() * 6.3, k: 0.6 + rand() * 0.7 });
    }
    list.sort((a, b) => a.v - b.v);
    for (const p of list) {
      const f = { r: floeRadius(g, p.v) * p.k, sq: squash(p.v) * 0.8, thick: 0 };
      f.thick = Math.max(0.8, f.r * 0.14);
      const y = p.v * g.sea;
      for (const dx of [-w, 0, w]) stampFloe(ctx, state.sets[p.shape], f, p.x + dx, y, p.rot);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#5a6f82';
    for (let i = 0; i < w * 0.5; i++) {
      const y = Math.pow(rand(), 2) * g.sea * 0.03;
      ctx.fillRect(rand() * w, y, g.U * (1 + rand() * 6), 1);
    }
    return c;
  }

  // ---- the moving pack ------------------------------------------------------

  // Rows stop short of the near floe, so every pack floe lies behind it and
  // nothing nearer is ever painted under it.
  function placeFloes(g, rand) {
    const list = [];
    const h = state.hero;
    const vMax = (h.y - h.ry * 0.3 - g.hz) / g.sea;
    let v = 0.16;
    while (v < vMax && list.length < MAX_FLOES) {
      const base = floeRadius(g, v);
      const dv = Math.max(0.04, (base * squash(v) * 1.5) / g.sea);
      const row = g.W + base * 3.2;
      let x = rand() * base;
      while (x < row && list.length < MAX_FLOES) {
        const r = base * (0.4 + Math.pow(rand(), 1.5) * 1.1);
        const fv = Math.min(vMax, v + (rand() - 0.5) * dv * 0.9);
        list.push(makeFloe(g, rand, fv, r, x));
        x += r * (1.25 + rand() * 0.9);
      }
      v += dv;
    }
    list.sort((a, b) => a.y - b.y);
    const host = makeHost(g, list);
    // A thin lane of open water just in front of the eagles, so the floes
    // that pass nearer them never cover the birds standing up.
    return list.filter((f) => f === host || f.v <= host.v || f.v > host.v + EAGLE_LANE);
  }

  // The eagles' floe: broad, slow, always kept by the pack slider.
  function makeHost(g, list) {
    const host = list.reduce((best, f) => (Math.abs(f.v - EAGLE_V) < Math.abs(best.v - EAGLE_V) ? f : best), list[0]);
    host.eagles = true;
    host.keep = 0;
    sizeFloe(host, floeRadius(g, host.v) * 1.9);
    host.x0 = g.W * 0.78 + host.margin;
    host.speed *= 0.35;
    host.spin *= 0.3;
    state.host = host;
    return host;
  }

  // Halo reaches 1.16 r, so a 1.25 r margin keeps the whole floe off screen
  // on both sides when it wraps.
  function sizeFloe(f, r) {
    f.r = r;
    f.thick = Math.max(1, r * 0.16);
    f.margin = r * 1.25;
    f.span = state.g.W + f.margin * 2;
  }

  function makeFloe(g, rand, v, r, x) {
    const f = {
      v, x0: x,
      y: g.hz + v * g.sea,
      sq: squash(v),
      rot: rand() * 6.3,
      spin: (rand() - 0.5) * 0.035,
      speed: g.U * (0.1 + 0.7 * v) * (0.75 + rand() * 0.5),
      shape: Math.floor(rand() * SHAPES),
      ph: rand() * 6.3,
      keep: rand(),
    };
    sizeFloe(f, r);
    return f;
  }

  function floePose(f, t, drift, g) {
    const s = f.span;
    const p = state.pose;
    p.x = ((((f.x0 + t * f.speed * drift) % s) + s) % s) - f.margin;
    p.y = f.y + Math.sin(t * 0.45 + f.ph) * g.U * 0.18 * f.v;
    p.rot = f.rot + t * f.spin * drift + Math.sin(t * 0.27 + f.ph) * 0.05;
    return p;
  }

  function drawPack(ctx, g, t, drift, pack) {
    const m = -SPRITE / 2;
    ctx.globalAlpha = 0.42;
    for (const f of state.floes) {
      if (f.keep > pack) continue;
      const p = floePose(f, t, drift, g);
      placeFloe(ctx, p.x, p.y + f.thick * 0.6, f.r, f.sq, p.rot);
      ctx.drawImage(state.sets[f.shape].halo, m, m);
    }
    ctx.globalAlpha = 1;
    for (const f of state.floes) {
      if (f.keep > pack) continue;
      const p = floePose(f, t, drift, g);
      stampFloe(ctx, state.sets[f.shape], f, p.x, p.y, p.rot);
      if (f === state.host) drawEagles(ctx, g, t, f, p);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // Painted right after their own floe, so nearer ice passes in front of them.
  // Sized by depth like everything else on the water: small, far off.
  function drawEagles(ctx, g, t, f, p) {
    const s = g.U * 0.95 * (0.35 + 0.65 * f.v);
    const lean = f.r * f.sq;
    const x = p.x;
    const y = p.y;
    drawPerched(ctx, x - f.r * 0.38, y - lean * 0.1, s * 0.92, 1, Math.sin(t * 0.23) * 0.2);
    drawPerched(ctx, x + f.r * 0.22, y + lean * 0.2, s, -1, Math.sin(t * 0.17 + 2) * 0.2);
  }

  // ---- the near floe --------------------------------------------------------

  function paintHero(g, rand) {
    const h = state.hero;
    const radii = outline(rand, 11, 0.74);
    const base = layer(g.W, g.H);
    const ctx = base.getContext('2d');
    ctx.fillStyle = ICE.side;
    tracePoly(ctx, h.x, h.y + h.thick, h.rx, h.ry, radii);
    ctx.fill();
    ctx.fillStyle = '#3e7a80';
    ctx.globalAlpha = 0.6;
    tracePoly(ctx, h.x, h.y + h.thick * 1.7, h.rx * 0.985, h.ry, radii);
    ctx.fill();
    ctx.globalAlpha = 1;
    paintIceTop(ctx, rand, h.x, h.y, h.rx, h.ry, radii, 0);
    paintHeroDetail(ctx, g, rand, radii);
    const halo = layer(g.W, g.H);
    const hctx = halo.getContext('2d');
    hctx.fillStyle = ICE.halo;
    hctx.globalAlpha = 0.35;
    tracePoly(hctx, h.x, h.y + h.thick * 2, h.rx * 1.04, h.ry * 1.12, radii);
    hctx.fill();
    state.heroLayer = base;
    state.heroHalo = halo;
  }

  function paintHeroDetail(ctx, g, rand, radii) {
    const h = state.hero;
    const u = g.U;
    ctx.save();
    tracePoly(ctx, h.x, h.y, h.rx, h.ry, radii);
    ctx.clip();
    for (let i = 0; i < 18; i++) {
      const a = rand() * 6.3;
      const d = Math.sqrt(rand()) * 0.8;
      const x = h.x + Math.cos(a) * h.rx * d;
      const y = h.y + Math.sin(a) * h.ry * d;
      const w = u * (3 + rand() * 7);
      ctx.fillStyle = ICE.shade;
      ctx.beginPath();
      ctx.ellipse(x - w * 0.1, y + u * 0.45, w, u * 0.8, 0, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = ICE.snow;
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.95, u * 0.7, 0, 0, 6.3);
      ctx.fill();
    }
    ctx.restore();
    paintRubble(ctx, g, rand);
  }

  // Pressure ridge: a few broken slabs tipped up along the back left of the floe.
  function paintRubble(ctx, g, rand) {
    const h = state.hero;
    const u = g.U;
    for (let i = 0; i < 9; i++) {
      const f = -0.85 + i * 0.075 + rand() * 0.04;
      const x = h.x + f * h.rx;
      const y = h.y - h.ry * (0.55 - f * 0.2) + rand() * u;
      const w = u * (2.5 + rand() * 3);
      const tall = u * (2 + rand() * 2.5);
      const lean = (rand() - 0.3) * u * 2;
      ctx.fillStyle = '#9dbbc4';
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y);
      ctx.lineTo(x - w / 2 + lean, y - tall);
      ctx.lineTo(x + w / 2 + lean, y - tall * 0.8);
      ctx.lineTo(x + w / 2, y);
      ctx.fill();
      ctx.fillStyle = ICE.snow;
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + lean, y - tall);
      ctx.lineTo(x + w / 2 + lean, y - tall * 0.8);
      ctx.lineTo(x + w * 0.2 + lean * 0.5, y - tall * 0.35);
      ctx.fill();
    }
  }

  // ---- animals --------------------------------------------------------------

  function makeSpots(rand) {
    const spots = [];
    for (let i = 0; i < 16; i++) {
      const x = -7 + rand() * 13.5;
      const top = 5.2 * (1 - Math.pow(x / 9.4, 2));
      spots.push(x, -0.9 - rand() * Math.max(0.5, top - 1.4));
    }
    return spots;
  }

  function sealBody(ctx, spots) {
    ctx.fillStyle = SEAL.dark;
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.lineTo(-12.8, -3.6);
    ctx.quadraticCurveTo(-11.6, -1.7, -12.7, 0.1);
    ctx.lineTo(-8, -0.3);
    ctx.fill();
    ctx.fillStyle = SEAL.body;
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.bezierCurveTo(-9.6, -3.2, -5, -5.8, 0, -5.8);
    ctx.bezierCurveTo(4.6, -5.8, 7.6, -4.6, 8.6, -2.2);
    ctx.lineTo(8.6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = SEAL.back;
    ctx.beginPath();
    ctx.moveTo(-8.6, -2.4);
    ctx.bezierCurveTo(-7, -4.6, -4, -5.8, 0, -5.8);
    ctx.bezierCurveTo(4.6, -5.8, 7.6, -4.6, 8.6, -2.2);
    ctx.bezierCurveTo(5, -4, 0, -4.4, -8.6, -2.4);
    ctx.fill();
    ctx.fillStyle = SEAL.belly;
    ctx.beginPath();
    ctx.moveTo(-8.8, 0);
    ctx.quadraticCurveTo(0, -2.2, 8.6, -0.8);
    ctx.lineTo(8.6, 0);
    ctx.fill();
    ctx.fillStyle = SEAL.dark;
    for (let i = 0; i < spots.length; i += 2) ctx.fillRect(spots[i], spots[i + 1], 0.9, 0.7);
    ctx.beginPath();
    ctx.ellipse(3.2, -1.2, 2, 0.8, 0.45, 0, 6.3);
    ctx.fill();
  }

  function sealHead(ctx, lift) {
    ctx.translate(6.6, -3.4);
    ctx.rotate(0.18 - lift * 0.8);
    ctx.fillStyle = SEAL.body;
    ctx.beginPath();
    ctx.ellipse(1.6, 0, 3.4, 3, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = SEAL.back;
    ctx.beginPath();
    ctx.ellipse(3.8, -0.7, 3.1, 2.7, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = SEAL.body;
    ctx.beginPath();
    ctx.ellipse(6.3, 0, 1.9, 1.4, 0.1, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = SEAL.eye;
    ctx.beginPath();
    ctx.arc(4.7, -1.5, 0.62, 0, 6.3);
    ctx.arc(7.9, -0.3, 0.5, 0, 6.3);
    ctx.fill();
  }

  function drawSeal(ctx, x, y, s, seal, lift) {
    ctx.setTransform(seal.dir * s, 0, 0, s, x, y);
    ctx.fillStyle = 'rgba(70,104,124,0.45)';
    ctx.beginPath();
    ctx.ellipse(-1, 0.3, 12, 1.5, 0, 0, 6.3);
    ctx.fill();
    sealBody(ctx, seal.spots);
    sealHead(ctx, lift);
  }

  // Steller's sea eagle at rest, side on and leaning forward like a raptor:
  // brown body, folded wings crossing past a white wedge tail, a white shoulder
  // flash and a small hooked yellow bill. No pale front, so it never reads as a
  // penguin.
  function drawPerched(ctx, x, y, s, dir, look) {
    ctx.setTransform(dir * s, 0, 0, s, x, y);
    ctx.fillStyle = EAGLE.shadow;
    ctx.beginPath();
    ctx.ellipse(-1.6, 0.2, 5.4, 0.9, 0, 0, 6.3);
    ctx.fill();
    perchedTail(ctx);
    perchedBody(ctx);
    perchedWing(ctx);
    ctx.translate(2.5, -8.9);
    ctx.rotate(look);
    perchedHead(ctx);
  }

  function perchedTail(ctx) {
    const tail = TAIL;
    ctx.fillStyle = EAGLE.tailShade;
    ctx.beginPath();
    ctx.moveTo(tail[0] + 0.4, tail[1] + 0.5);
    for (let i = 2; i < tail.length; i += 2) ctx.lineTo(tail[i] + 0.4, tail[i + 1] + 0.5);
    ctx.fill();
    ctx.fillStyle = EAGLE.white;
    ctx.beginPath();
    ctx.moveTo(tail[0], tail[1]);
    for (let i = 2; i < tail.length; i += 2) ctx.lineTo(tail[i], tail[i + 1]);
    ctx.fill();
  }

  // Body tipped forward, breast and belly the same brown as the back.
  function perchedBody(ctx) {
    ctx.fillStyle = EAGLE.body;
    ctx.beginPath();
    ctx.moveTo(2.6, -8.8);
    ctx.bezierCurveTo(3.8, -6.8, 3.4, -3.6, 1.6, -1.9);
    ctx.lineTo(-1.2, -2.1);
    ctx.bezierCurveTo(-2.8, -3.4, -2, -7.4, 0.4, -9.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = EAGLE.beak;
    ctx.fillRect(0.1, -2, 1.5, 2);
  }

  // Folded wing laid over the back, its tip reaching past the tail.
  function perchedWing(ctx) {
    ctx.fillStyle = EAGLE.wing;
    ctx.beginPath();
    ctx.moveTo(2.2, -7.6);
    ctx.bezierCurveTo(0.6, -9.6, -2.6, -8.2, -3.6, -5.4);
    ctx.lineTo(-7.4, -2.4);
    ctx.lineTo(-4.4, -3.4);
    ctx.bezierCurveTo(-1.8, -3.8, 0.8, -4.6, 2.2, -7.6);
    ctx.fill();
    ctx.fillStyle = EAGLE.white;
    ctx.beginPath();
    ctx.ellipse(0.9, -7.3, 1.5, 0.75, -0.6, 0, 6.3);
    ctx.fill();
  }

  // Head and bill around the neck, so the bird can look about.
  function perchedHead(ctx) {
    ctx.fillStyle = EAGLE.head;
    ctx.beginPath();
    ctx.arc(0, -0.5, 1.9, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = EAGLE.beak;
    ctx.beginPath();
    ctx.moveTo(1.1, -1.7);
    ctx.bezierCurveTo(2.4, -2, 3.4, -1.3, 3.4, 0.1);
    ctx.lineTo(2.8, -0.3);
    ctx.lineTo(1.3, 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = EAGLE.eye;
    ctx.fillRect(0.3, -1.4, 0.5, 0.5);
  }

  // ---- per-frame pieces -----------------------------------------------------

  function slide(ctx, tile, offset, y, scale) {
    const w = tile.width * scale;
    const x = -(((offset % w) + w) % w);
    ctx.drawImage(tile, x, y, w, tile.height * scale);
    ctx.drawImage(tile, x + w, y, w, tile.height * scale);
  }

  function makeGlints(g, rand) {
    const list = [];
    for (let i = 0; i < GLINTS; i++) {
      const v = 0.03 + 0.95 * Math.pow(rand(), 0.8);
      const spread = g.U * (1.5 + 14 * v);
      list.push({
        x: g.sunX + (rand() - 0.5) * 2 * spread * rand(),
        y: g.hz + v * g.sea,
        w: g.U * (0.6 + 3 * v) * (0.5 + rand()),
        h: Math.max(1, g.U * 0.35 * v + 0.5),
        ph: rand() * 6.3,
        rate: 0.4 + rand() * 0.5,
      });
    }
    return list;
  }

  function drawGlints(ctx, t) {
    ctx.fillStyle = '#eadcae';
    for (const p of state.glints) {
      const a = Math.sin(t * p.rate + p.ph);
      if (a <= 0) continue;
      ctx.globalAlpha = a * 0.55;
      ctx.fillRect(p.x + Math.sin(t * 0.3 + p.ph) * p.w * 0.4 - p.w / 2, p.y, p.w, p.h);
    }
    ctx.globalAlpha = 1;
  }

  function drawHero(ctx, g, t) {
    const h = state.hero;
    const ox = Math.sin(t * 0.11) * g.U * 0.6;
    const oy = Math.sin(t * 0.37) * g.U * 0.3;
    ctx.drawImage(state.heroLayer, ox, oy);
    for (const seal of SEALS) {
      const lift = smoothstep(0.2, 0.8, 0.5 + 0.5 * Math.sin(t * seal.rate + seal.ph));
      const x = h.x + seal.x * h.rx + ox;
      const y = h.y + seal.y * h.ry + oy;
      drawSeal(ctx, x, y, g.U * seal.s, seal, lift);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    g.hz = Math.round(g.H * HORIZON);
    g.sea = g.H - g.hz;
    g.sunX = g.W * 0.7;
    g.sunY = g.hz - g.U * 16;
    const rand = K.rng(api.seed);
    state.g = g;
    state.pose = { x: 0, y: 0, rot: 0 };
    state.sets = [];
    for (let i = 0; i < SHAPES; i++) state.sets.push(floeSprite(rand));
    state.base = paintBase(g, rand);
    state.far = paintFarIce(g, rand);
    const half = (w, h) => [Math.ceil(w / 2), Math.ceil(h / 2)];
    const [cw, ch] = half(g.W * 1.5, g.H * 0.2);
    state.clouds = paintStreaks(cw, ch, { fx: 0.05 / g.U, fy: 0.4 / g.U, seed: 5, lo: 0.52, hi: 0.72, rgb: [236, 230, 214], alpha: 115 });
    const [mw, mh] = half(g.W * 1.5, g.sea * 0.14);
    state.haze = paintStreaks(mw, mh, { fx: 0.06 / g.U, fy: 0.5 / g.U, seed: 9, lo: 0.42, hi: 0.68, rgb: [222, 226, 228], alpha: 120 });
    state.hero = { x: g.W * 0.47, y: g.H * 0.815, rx: Math.min(g.W * 0.35, g.U * 56), ry: g.U * 11.5, thick: g.U * 3.2 };
    paintHero(g, rand);
    state.floes = placeFloes(g, rand);
    state.glints = makeGlints(g, rand);
    for (const seal of SEALS) seal.spots = makeSpots(rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const drift = api.props.drift;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(state.base, 0, 0);
    slide(ctx, state.clouds, t * g.U * 0.5, g.H * 0.07, 2);
    drawGlints(ctx, t);
    slide(ctx, state.far, t * g.U * 0.08 * drift, g.hz, 1);
    slide(ctx, state.haze, -t * g.U * 0.3, g.hz - g.sea * 0.04, 2);
    drawPack(ctx, g, t, drift, api.props.pack);
    ctx.drawImage(state.heroHalo, 0, 0);
    drawHero(ctx, g, t);
  }

  Kasuri.run({
    defaults: { drift: 1, pack: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
