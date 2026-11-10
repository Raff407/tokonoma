/*
 * Qixi, the milky way over a summer night with a bridge of magpies.
 *
 * Sky, river of stars, hills, pavilion, bamboo and pond are baked once into one layer.
 * Magpie sprites are baked in three wing poses; the glow under the bridge and the two
 * lovers' stars are baked too. Each frame lays the sky down, slides a haze strip along
 * the river, breathes the bridge glow, draws ~30 magpie sprites in their flap poses,
 * pulses the two stars, twinkles a short star list and shimmers the pond.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm } = K;
  const TAU = Math.PI * 2;
  const SKY = ['#0d1226', '#141b3a', '#1f2a52', '#2c3a64'];
  const TWINKLERS = 70;
  const POSES = 3;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), rot || 0, 0, TAU);
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
    return {
      W, H, U,
      hill: H * 0.78,
      bx0: W * 0.2, bx1: W * 0.8, by: H * 0.6, bh: H * 0.3,
    };
  }

  // River of stars: an arch from the lower left over the top to the lower right.
  function riverY(g, x) {
    const s = x / g.W * 2 - 1;
    return g.H * 0.48 - (1 - s * s) * g.H * 0.4 + s * g.H * 0.06;
  }

  function bridgeY(g, x) {
    const s = (x - g.bx0) / (g.bx1 - g.bx0) * 2 - 1;
    return g.by - (1 - s * s) * g.bh;
  }

  // 0 at the ends of the bridge, 1 in the middle.
  function bridgeTaper(g, x) {
    const s = (x - g.bx0) / (g.bx1 - g.bx0) * 2 - 1;
    return Math.max(0, 1 - s * s);
  }

  function paintSky(ctx, g, rand) {
    const inks = SKY.map(K.parseColor);
    const img = ctx.createImageData(g.W, g.H);
    const d = img.data;
    for (let y = 0; y < g.H; y++) {
      const f = Math.min(1, y / g.hill) * (inks.length - 1);
      const k = Math.min(inks.length - 2, Math.floor(f));
      for (let x = 0; x < g.W; x++) {
        const ink = inks[k + (rand() < f - k ? 1 : 0)];
        const i = (y * g.W + x) * 4;
        d[i] = ink[0];
        d[i + 1] = ink[1];
        d[i + 2] = ink[2];
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function paintRiver(ctx, g, rand) {
    const wide = g.H * 0.075;
    const n = Math.round(g.H * 0.22);
    for (let x = 0; x < g.W; x += 1) {
      const cy = riverY(g, x);
      const w = wide * (0.8 + fbm(x / (g.U * 22), 2.7, 3, 7) * 0.7);
      for (let i = 0; i < n; i++) {
        const o = (rand() + rand() + rand() - 1.5) * w * 1.4;
        const fall = 1 - Math.min(1, Math.abs(o) / (w * 1.5));
        const dust = fbm(x / (g.U * 9), o / (g.U * 9) + 4, 3, 19);
        if (rand() > fall * (0.5 + dust)) continue;
        ctx.globalAlpha = 0.14 + fall * 0.4;
        ctx.fillStyle = dust > 0.55 ? '#e9e3cf' : '#a9b4d2';
        ctx.fillRect(x, cy + o, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#10152c';
    for (let i = 0; i < 14; i++) {
      const x = g.W * (0.18 + rand() * 0.64);
      blob(ctx, x, riverY(g, x) + (rand() - 0.5) * g.U * 2, g.U * (2 + rand() * 4), g.U * 0.5);
    }
  }

  function paintStars(ctx, g, rand) {
    const tw = [];
    for (let i = 0; i < 220; i++) {
      const x = rand() * g.W;
      const y = rand() * g.hill * 0.9;
      const near = Math.abs(y - riverY(g, x)) < g.H * 0.09;
      ctx.globalAlpha = 0.25 + rand() * 0.5;
      ctx.fillStyle = rand() < 0.2 ? '#e3c778' : '#dfe3ef';
      ctx.fillRect(x, y, 1, 1);
      if (!near && rand() < 0.45 && tw.length < TWINKLERS) tw.push({ x, y, p: rand() * TAU, s: 0.4 + rand() * 0.6 });
    }
    ctx.globalAlpha = 1;
    return tw;
  }

  // ---- lovers' stars: Altair (Niulang, cool) and Vega (Zhinu, warm) ----

  function starSprite(r, halo, core) {
    const size = Math.ceil(r * 14);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const m = size / 2;
    const grad = ctx.createRadialGradient(m, m, 0, m, m, r * 6);
    grad.addColorStop(0, halo);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = halo;
    blob(ctx, m, m, r * 2, r * 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = core;
    blob(ctx, m, m, r, r);
    // four tapered rays
    const L = r * 6.5;
    const w = Math.max(0.7, r * 0.35);
    poly(ctx, [m - L, m, m, m - w, m + L, m, m, m + w]);
    poly(ctx, [m, m - L, m - w, m, m, m + L, m + w, m]);
    return c;
  }

  // ---- magpies: three wing poses, pale belly and wing bars, dark indigo cap and tail ----

  function magpieSprite(u, pose) {
    const c = layer(u * 12, u * 9);
    const ctx = c.getContext('2d');
    ctx.translate(u * 6, u * 4.8);
    const lift = [-1, 0, 0.9][pose];
    // far wing (behind body), darker
    ctx.fillStyle = '#5d6b98';
    poly(ctx, [-u * 0.2, -u * 0.3, u * 0.6 + lift * u * 0.3, -u * 0.4 + lift * u * 3.6,
      u * 1.4, -u * 0.2 + lift * u * 2.8, u * 0.9, 0]);
    // long tail
    ctx.fillStyle = '#6f7eaa';
    poly(ctx, [-u * 1.2, -u * 0.3, -u * 5.4, u * 0.1, -u * 5.6, u * 0.5, -u * 1.2, u * 0.45]);
    // body
    ctx.fillStyle = '#eae4cf';
    blob(ctx, 0, 0, u * 1.7, u * 0.75);
    // head and beak
    ctx.fillStyle = '#7f8db6';
    blob(ctx, u * 1.75, -u * 0.35, u * 0.7, u * 0.6);
    poly(ctx, [u * 2.3, -u * 0.55, u * 3.1, -u * 0.35, u * 2.3, -u * 0.15]);
    // near wing, pale with dark tips
    const tipY = -u * 0.2 + lift * u * 4.2;
    const tipX = -u * 1.2 + lift * u * 0.2;
    ctx.fillStyle = '#f2ecd8';
    poly(ctx, [-u * 0.9, -u * 0.1, tipX, tipY, u * 0.3, tipY * 0.85, u * 0.8, -u * 0.1]);
    ctx.fillStyle = '#5d6b98';
    poly(ctx, [tipX, tipY, tipX + u * 0.9, tipY * 0.95, lerp(tipX, -u * 0.9, 0.35), lerp(tipY, 0, 0.35)]);
    return c;
  }

  function bridgeBirds(g, rand) {
    const birds = [];
    const rows = [{ off: 0, dy: 0 }, { off: 0.5, dy: 1.6 }];
    for (const row of rows) {
      const n = 11;
      for (let i = 0; i < n; i++) {
        const f = (i + row.off + 0.5) / (n + 0.5);
        const x = lerp(g.bx0, g.bx1, f) + (rand() - 0.5) * g.U;
        const taper = bridgeTaper(g, x);
        const scale = 0.55 + 0.45 * Math.sqrt(taper);
        const y = bridgeY(g, x) + row.dy * g.U * 2.4 * scale + (rand() - 0.5) * g.U * 0.6;
        const slope = (bridgeY(g, x + 1) - bridgeY(g, x - 1)) / 2;
        const flip = x < g.W / 2 ? 1 : -1;
        birds.push({ x, y, scale, flip, tilt: Math.atan(slope) * flip * 0.7, p: rand() * TAU, s: 0.8 + rand() * 0.4 });
      }
    }
    birds.sort((a, b) => a.y - b.y);
    return birds;
  }

  function paintGlow(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.lineCap = 'round';
    const passes = [[7, 0.06], [4.5, 0.09], [2.4, 0.12]];
    for (const [wide, a] of passes) {
      ctx.strokeStyle = '#c9cfe6';
      for (let x = g.bx0; x < g.bx1; x += 2) {
        const t = bridgeTaper(g, x + 1);
        ctx.globalAlpha = a * (0.3 + 0.7 * t);
        ctx.lineWidth = Math.max(1, g.U * wide * (0.35 + 0.65 * t));
        ctx.beginPath();
        ctx.moveTo(x, bridgeY(g, x) + g.U);
        ctx.lineTo(x + 2, bridgeY(g, x + 2) + g.U);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- land ----

  function ridge(ctx, g, base, amp, scale, seed, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * base - fbm(x / (g.U * scale), seed, 3, seed * 3) * g.H * amp);
    ctx.lineTo(g.W, g.H);
    ctx.fill();
  }

  function roofEave(ctx, cx, y, w, h) {
    poly(ctx, [cx - w, y - h * 0.25, cx - w * 0.7, y - h * 0.05, cx - w * 0.4, y - h * 0.35, cx, y - h * 0.6,
      cx + w * 0.4, y - h * 0.35, cx + w * 0.7, y - h * 0.05, cx + w, y - h * 0.25, cx + w * 0.8, y + h * 0.12,
      cx - w * 0.8, y + h * 0.12]);
  }

  function paintPavilion(ctx, g) {
    const u = g.U * 1.9;
    const px = g.W * 0.17;
    const py = g.H * 0.9;
    const dark = '#0a1020';
    // platform and steps
    ctx.fillStyle = '#1a2440';
    ctx.fillRect(px - u * 6, py - u * 0.8, u * 12, u * 1.2);
    ctx.fillStyle = dark;
    // lower storey: lit room between vermilion pillars
    ctx.fillStyle = '#c9a24a';
    ctx.globalAlpha = 0.85;
    ctx.fillRect(px - u * 3.6, py - u * 5.4, u * 7.2, u * 4.6);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#3a2a1c';
    for (let i = -1; i <= 1; i += 2) ctx.fillRect(px + i * u * 1.2 - u * 0.15, py - u * 5.4, u * 0.3, u * 4.6);
    ctx.fillRect(px - u * 3.6, py - u * 3.2, u * 7.2, u * 0.25);
    ctx.fillStyle = '#b5432c';
    for (let i = -1; i <= 1; i += 2) ctx.fillRect(px + i * u * 4 - u * 0.4, py - u * 5.6, u * 0.8, u * 5);
    // railing
    ctx.fillStyle = dark;
    ctx.fillRect(px - u * 4.6, py - u * 1.6, u * 9.2, u * 0.4);
    for (let i = -4; i <= 4; i += 1) ctx.fillRect(px + i * u - u * 0.1, py - u * 1.6, u * 0.2, u * 0.9);
    // lower roof
    ctx.fillStyle = dark;
    roofEave(ctx, px, py - u * 5.8, u * 7.5, u * 3.6);
    // upper storey
    ctx.fillStyle = '#c9a24a';
    ctx.globalAlpha = 0.75;
    ctx.fillRect(px - u * 2.2, py - u * 9.6, u * 4.4, u * 2.6);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#b5432c';
    for (let i = -1; i <= 1; i += 2) ctx.fillRect(px + i * u * 2.4 - u * 0.3, py - u * 9.8, u * 0.6, u * 3);
    ctx.fillStyle = dark;
    ctx.fillRect(px - u * 0.1, py - u * 9.6, u * 0.2, u * 2.6);
    roofEave(ctx, px, py - u * 10, u * 5.4, u * 3.4);
    // finial
    ctx.fillRect(px - u * 0.15, py - u * 13, u * 0.3, u * 1.6);
    blob(ctx, px, py - u * 13, u * 0.45, u * 0.45);
    return { lanterns: [{ x: px - u * 6.2, y: py - u * 6.6 }, { x: px + u * 6.2, y: py - u * 6.6 }], u };
  }

  function leaf(ctx, x, y, len, wide, ang) {
    const cx = Math.cos(ang);
    const sy = Math.sin(ang);
    const tx = x + cx * len;
    const ty = y + sy * len;
    const nx = -sy * wide;
    const ny = cx * wide;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + cx * len * 0.35 + nx, y + sy * len * 0.35 + ny, tx, ty);
    ctx.quadraticCurveTo(x + cx * len * 0.35 - nx, y + sy * len * 0.35 - ny, x, y);
    ctx.fill();
  }

  function paintBamboo(ctx, g, rand) {
    const u = g.U;
    const stalks = [
      { x: 0.84, top: 0.6, lean: -3, w: 1.2 },
      { x: 0.89, top: 0.56, lean: 2, w: 1.4 },
      { x: 0.95, top: 0.64, lean: -1.5, w: 1.1 },
    ];
    const ground = g.H * 0.9;
    for (const s of stalks) {
      const x0 = g.W * s.x;
      const top = g.H * s.top;
      const pt = (f) => ({ x: x0 + s.lean * u * f * f * 3, y: lerp(ground, top, f) });
      ctx.fillStyle = '#1c2a2a';
      const segs = 24;
      for (let i = 0; i < segs; i++) {
        const a = pt(i / segs);
        const b = pt((i + 1) / segs);
        const w = u * s.w * (1 - i / segs * 0.5);
        ctx.fillRect(Math.min(a.x, b.x) - w / 2, b.y, w + Math.abs(a.x - b.x), a.y - b.y + 0.5);
      }
      // nodes
      ctx.fillStyle = '#4c6040';
      for (let f = 0.12; f < 1; f += 0.14 + rand() * 0.04) {
        const p = pt(f);
        ctx.fillRect(p.x - u * s.w * 0.7, p.y, u * s.w * 1.4, Math.max(0.6, u * 0.3));
      }
      // leaf clusters fanning down from the upper nodes
      for (let f = 0.4; f <= 1.0; f += 0.12 + rand() * 0.04) {
        const p = pt(Math.min(1, f));
        const side = rand() < 0.5 ? -1 : 1;
        const n = 3 + Math.floor(rand() * 3);
        for (let k = 0; k < n; k++) {
          const ang = (side > 0 ? 0.35 : Math.PI - 0.35) + side * (k * 0.32 + rand() * 0.15);
          ctx.fillStyle = ['#3e5236', '#2c3b2a', '#56693f'][Math.floor(rand() * 3)];
          leaf(ctx, p.x, p.y, u * (6 + rand() * 3), u * (0.9 + rand() * 0.4), ang);
        }
      }
    }
  }

  function paintPond(ctx, g, rand) {
    const cx = g.W * 0.52;
    const cy = g.H * 0.935;
    const rx = g.W * 0.2;
    const ry = g.H * 0.045;
    ctx.fillStyle = '#2a3a70';
    blob(ctx, cx, cy, rx, ry);
    ctx.fillStyle = '#3a4c86';
    blob(ctx, cx, cy - ry * 0.15, rx * 0.85, ry * 0.6);
    // reeds at the edge
    ctx.fillStyle = '#2c3b2a';
    for (let i = 0; i < 18; i++) {
      const x = cx + (rand() < 0.5 ? -1 : 1) * rx * (0.75 + rand() * 0.3);
      const h = g.U * (2 + rand() * 4);
      ctx.fillRect(x, cy - h, Math.max(0.6, g.U * 0.35), h);
    }
    const glints = [];
    for (let i = 0; i < 14; i++) {
      glints.push({
        x: cx + (rand() * 2 - 1) * rx * 0.75,
        y: cy + (rand() * 2 - 1) * ry * 0.6,
        w: g.U * (1.5 + rand() * 3.5),
        p: rand() * TAU,
        s: 0.5 + rand() * 0.6,
        warm: rand() < 0.35,
      });
    }
    return glints;
  }

  function paintLand(ctx, g, rand) {
    ridge(ctx, g, 0.8, 0.12, 30, 1.7, '#2e3e6c');
    // a band of mist along the far ridge
    ctx.fillStyle = '#9aa6c8';
    for (let i = 0; i < 18; i++) {
      ctx.globalAlpha = 0.05 + rand() * 0.05;
      blob(ctx, rand() * g.W, g.H * (0.76 + rand() * 0.06), g.U * (8 + rand() * 14), g.U * (0.8 + rand()));
    }
    ctx.globalAlpha = 1;
    ridge(ctx, g, 0.88, 0.06, 22, 6.3, '#1c2840');
    // moss on the near slope
    ctx.fillStyle = '#2c3b2a';
    for (let i = 0; i < 70; i++) {
      ctx.globalAlpha = 0.25 + rand() * 0.35;
      blob(ctx, rand() * g.W, g.H * (0.9 + rand() * 0.1), g.U * (1 + rand() * 3), g.U * (0.3 + rand() * 0.4));
    }
    ctx.globalAlpha = 1;
    const glints = paintPond(ctx, g, rand);
    const pav = paintPavilion(ctx, g);
    paintBamboo(ctx, g, rand);
    return { glints, pav };
  }

  function paintHaze(g, rand) {
    const c = layer(g.W, g.H * 0.4);
    const ctx = c.getContext('2d');
    for (let i = 0; i < 16; i++) {
      ctx.globalAlpha = 0.08 + rand() * 0.07;
      ctx.fillStyle = '#c3cbe0';
      const y = c.height * (0.2 + rand() * 0.6);
      const x = rand() * g.W;
      const rx = g.U * (6 + rand() * 12);
      const ry = g.U * (0.8 + rand());
      for (const dx of [-g.W, 0, g.W]) blob(ctx, x + dx, y, rx, ry);
    }
    return c;
  }

  function fireflies(g, rand) {
    const out = [];
    for (let i = 0; i < 10; i++) {
      out.push({ x: g.W * (0.28 + rand() * 0.5), y: g.H * (0.8 + rand() * 0.1), p: rand() * TAU, s: 0.3 + rand() * 0.4 });
    }
    return out;
  }

  function setup(ctx, api) {
    const g = geometry(api);
    const rand = K.rng(api.seed);
    state.g = g;
    const back = layer(g.W, g.H);
    const b = back.getContext('2d');
    paintSky(b, g, rand);
    paintRiver(b, g, rand);
    state.stars = paintStars(b, g, rand);
    const land = paintLand(b, g, rand);
    state.glints = land.glints;
    state.pav = land.pav;
    state.back = back;
    state.haze = paintHaze(g, rand);
    state.glow = paintGlow(g);
    const u = Math.max(1.8, g.U * 1.6);
    state.birdU = u;
    state.poses = [];
    for (let p = 0; p < POSES; p++) state.poses.push(magpieSprite(u, p));
    state.birds = bridgeBirds(g, rand);
    const r = Math.max(1.4, g.U * 1.3);
    state.altair = { img: starSprite(r, '#8fa4dc', '#eef2ff'), x: g.bx0 - g.W * 0.07, y: g.by - g.H * 0.1 };
    state.vega = { img: starSprite(r * 1.15, '#d9a441', '#fbf1d2'), x: g.bx1 + g.W * 0.07, y: g.by - g.H * 0.1 };
    // Altair's two companions, the children Niulang carries in his baskets
    state.kids = [
      { x: state.altair.x - g.U * 3.2, y: state.altair.y + g.U * 4.2 },
      { x: state.altair.x + g.U * 3.2, y: state.altair.y - g.U * 4.2 },
    ];
    state.flies = fireflies(g, rand);
  }

  function drawStar(ctx, s, a, t) {
    ctx.globalAlpha = a;
    ctx.drawImage(s.img, s.x - s.img.width / 2, s.y - s.img.height / 2);
  }

  function drawBirds(ctx, t, glow) {
    const u = state.birdU;
    const poses = state.poses;
    const pw = poses[0].width;
    const ph = poses[0].height;
    const birds = state.birds;
    ctx.globalAlpha = Math.min(1, 0.85 + 0.15 * glow);
    for (let i = 0; i < birds.length; i++) {
      const b = birds[i];
      const ph2 = Math.sin(t * b.s * 1.3 + b.p);
      const pose = ph2 > 0.45 ? 0 : ph2 < -0.45 ? 2 : 1;
      const bob = Math.sin(t * 0.9 + b.p) * u * 0.25;
      ctx.setTransform(b.flip * b.scale, 0, 0, b.scale, b.x, b.y + bob);
      ctx.rotate(b.tilt);
      ctx.drawImage(poses[pose], -pw / 2, -ph * 0.53);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { twinkle, glow } = api.props;
    ctx.globalAlpha = 1;
    ctx.drawImage(state.back, 0, 0);
    // haze strip slides along the river
    const off = (t * g.U * 0.9) % g.W;
    const hy = riverY(g, g.W / 2) - state.haze.height / 2;
    ctx.globalAlpha = 0.8;
    ctx.drawImage(state.haze, off, hy);
    ctx.drawImage(state.haze, off - g.W, hy);
    // stars
    ctx.fillStyle = '#f4efdc';
    const stars = state.stars;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      ctx.globalAlpha = Math.max(0, 0.2 + 0.8 * Math.sin(t * s.s * 1.4 + s.p) * twinkle);
      ctx.fillRect(s.x - 0.5, s.y - 0.5, 2, 2);
    }
    // the lovers' stars, slowly breathing out of step
    drawStar(ctx, state.altair, 0.8 + 0.2 * Math.sin(t * 0.6), t);
    drawStar(ctx, state.vega, 0.8 + 0.2 * Math.sin(t * 0.6 + 2), t);
    ctx.fillStyle = '#c7d2ee';
    ctx.globalAlpha = 0.85;
    for (const k of state.kids) ctx.fillRect(k.x - 0.5, k.y - 0.5, 1.6, 1.6);
    // bridge: soft glow, then the magpies
    ctx.globalAlpha = Math.max(0, Math.min(1, (0.6 + 0.3 * Math.sin(t * 0.7)) * glow));
    ctx.drawImage(state.glow, 0, 0);
    drawBirds(ctx, t, glow);
    // pond shimmer
    for (let i = 0; i < state.glints.length; i++) {
      const s = state.glints[i];
      ctx.globalAlpha = 0.45 + 0.35 * Math.sin(t * s.s + s.p);
      ctx.fillStyle = s.warm ? '#d9b866' : '#aab6d8';
      ctx.fillRect(s.x + Math.sin(t * 0.5 + s.p) * g.U, s.y, s.w, Math.max(0.7, g.U * 0.35));
    }
    // two lanterns sway at the pavilion eaves
    const pav = state.pav;
    for (let i = 0; i < pav.lanterns.length; i++) {
      const l = pav.lanterns[i];
      const sway = Math.sin(t * 0.8 + i * 1.7) * pav.u * 0.35;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#d6452c';
      blob(ctx, l.x + sway, l.y + pav.u * 1.2, pav.u * 1.3, pav.u * 1.5);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#0a1020';
      ctx.fillRect(l.x + sway * 0.5 - 0.3, l.y - pav.u * 0.2, 0.6, pav.u * 0.6);
      ctx.fillStyle = '#d6452c';
      blob(ctx, l.x + sway, l.y + pav.u * 1.2, pav.u * 0.6, pav.u * 0.8);
    }
    // fireflies drift above the grass
    ctx.fillStyle = '#e3c778';
    for (let i = 0; i < state.flies.length; i++) {
      const f = state.flies[i];
      ctx.globalAlpha = Math.max(0, 0.15 + 0.55 * Math.sin(t * f.s + f.p));
      ctx.fillRect(f.x + Math.sin(t * 0.21 + f.p) * g.U * 4, f.y + Math.sin(t * 0.33 + f.p * 2) * g.U * 2, 1.4, 1.4);
    }
    ctx.globalAlpha = 1;
  }

  Kasuri.run({
    defaults: { twinkle: 1, glow: 1, ramp: 'lines', cell: 7, boost: 0.25, gain: 1.2, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
