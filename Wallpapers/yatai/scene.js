/*
 * 屋台 Yatai — a noodle cart on a street corner, a winter night, light snow.
 *
 * The street, the cart and its reflection are baked once. Each frame slides the
 * reflection in thin rows, swings the noren and lantern with a few short paths,
 * and moves a fixed list of steam sprites and snowflakes held in typed arrays.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp } = K;

  const GROUND = 78;
  const NOREN_TOP = 25;
  const NOREN_DROP = 8;
  const NOREN_PANELS = 5;
  const NOREN_FOLDS = 4;
  const NOREN_TONES = ['#3c5a8e', '#4b6da3', '#5d82b6'];
  const MIRROR = [[204, 158, 98], [150, 108, 72], [164, 64, 46], [150, 148, 150], [62, 82, 120], [92, 70, 62]];
  const SKY = ['#4a5888', '#566597', '#6473a6', '#7685b4', '#8b98c2'];
  const ROAD_COLD = ['#323a60', '#3d466e', '#4b547c', '#5e688e'];
  const ROAD_WARM = ['#4c4256', '#695054', '#8c6650', '#b08558'];
  const COOK_DROP = 2;
  const COAT = '#4a5a44';
  const JACKET = '#33466e';
  const SKIN = '#d9a97e';
  const PUFFS = 46;
  const WISPS = 6;
  const WISP_POINTS = 10;
  const MAX_FLAKES = 420;
  const COOK_X = 8;
  const CUSTOMER_X = -16;
  const POT_X = 28;
  const POT_RIM = 45;
  const LANTERN_X = -47;
  const LANTERN_TOP = 25;
  const REFLECT_FROM = 24;
  const REFLECT_TO = 57;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Everything on the cart is drawn in U units from the middle of the cart.
  function cartContext(c, g) {
    const ctx = c.getContext('2d');
    ctx.translate(g.cx, 0);
    ctx.scale(g.U, g.U);
    return ctx;
  }

  // A small sprite drawn in U units, with its origin at (dx, dy).
  function spriteContext(c, u, dx, dy) {
    const ctx = c.getContext('2d');
    ctx.scale(u, u);
    ctx.translate(dx, dy);
    return ctx;
  }

  function box(ctx, colour, x, y, w, h) {
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w, h);
  }

  function limb(ctx, colour, width, x0, y0, x1, y1, x2, y2) {
    ctx.strokeStyle = colour;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function poly(ctx, pts, colour) {
    if (colour) ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function oval(ctx, x, y, rx, ry, colour) {
    if (colour) ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, 6.3);
    ctx.fill();
  }

  function paintGlow(radius, colour, peak) {
    const size = Math.ceil(radius * 2);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = colour;
    ctx.globalAlpha = peak / 3;
    for (let i = 3; i >= 1; i--) oval(ctx, size / 2, size / 2, (radius * i) / 3, (radius * i) / 3);
    return c;
  }

  // Bakes a block of pixels from a small list of flat tones.
  function bakeTones(ctx, x0, y0, w, h, pick) {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const rgb = pick(x0 + x, y0 + y);
        const i = (y * w + x) * 4;
        img.data.set(rgb, i);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, x0, y0);
  }

  function paintSky(ctx, g) {
    const tones = SKY.map(K.parseColor);
    const top = g.H * 0.66;
    bakeTones(ctx, 0, 0, g.W, Math.ceil(top), (x, y) => {
      const v = (y / top) * 0.95 + (fbm(x * 0.022, y * 0.06, 3, 11) - 0.5) * 0.55;
      return tones[Math.max(0, Math.min(4, Math.round(v * 4)))];
    });
  }

  function paintFarRow(ctx, g, rand) {
    const u = g.U;
    let x = -u * 4;
    while (x < g.W) {
      const w = u * (12 + rand() * 14);
      const top = u * (38 + rand() * 14);
      box(ctx, rand() < 0.5 ? '#2c3660' : '#283158', x, top, w, g.H * 0.62 - top);
      const peak = top - u * (3 + rand() * 3);
      poly(ctx, [x - u, top + u * 0.6, x + w * 0.5, peak, x + w + u, top + u * 0.6], '#c3cbdb');
      poly(ctx, [x - u, top + u * 1.4, x + w * 0.5, peak + u * 1.4, x + w + u, top + u * 1.4], '#283158');
      ctx.fillStyle = '#d8ab62';
      if (rand() < 0.7) ctx.fillRect(x + w * (0.2 + rand() * 0.5), top + u * (3 + rand() * 6), u * 3, u * 2.4);
      x += w;
    }
  }

  function paintShopfront(ctx, g, x, w, base, rand) {
    const u = g.U;
    box(ctx, '#2f2f46', x, base - u * 20, w, u * 20);
    ctx.fillStyle = '#3f3c52';
    const boards = Math.floor(w / (u * 4));
    for (let i = 0; i < boards; i++) ctx.fillRect(x + (i + 0.2) * (w / boards), base - u * 18, w / boards - u * 0.9, u * 18);
    ctx.fillStyle = '#6e8099';
    for (let i = 0; i < w / u; i += 2) ctx.fillRect(x + i * u, base - u * (1 + rand() * 2.6), u * 2.2, u * 4);
    poly(ctx, [x - u * 3, base - u * 19, x + w + u * 3, base - u * 19, x + w, base - u * 24, x, base - u * 24], '#242a44');
    poly(ctx, [x - u * 3, base - u * 19, x + w + u * 3, base - u * 19, x + w + u, base - u * 21.6, x - u, base - u * 21.6], '#c3cbdb');
  }

  function paintUpper(ctx, g, x, w, base) {
    const u = g.U;
    const top = base - u * 42;
    box(ctx, '#343453', x, top, w, u * 19);
    const wx = x + w * 0.2;
    const ww = w * 0.55;
    box(ctx, '#e2bc78', wx, top + u * 4, ww, u * 11);
    ctx.fillStyle = '#6b5136';
    for (let i = 0; i <= 3; i++) ctx.fillRect(wx + (ww * i) / 3 - u * 0.25, top + u * 4, u * 0.6, u * 11);
    for (let j = 0; j <= 3; j++) ctx.fillRect(wx, top + u * 4 + (u * 11 * j) / 3 - u * 0.2, ww, u * 0.5);
    poly(ctx, [x - u * 5, top + u, x + w + u * 5, top + u, x + w * 0.62, top - u * 11, x + w * 0.2, top - u * 11], '#242a44');
    poly(ctx, [x - u * 2, top - u * 1.5, x + w + u * 2, top - u * 1.5, x + w * 0.62, top - u * 11.6, x + w * 0.2, top - u * 11.6], '#c3cbdb');
  }

  function paintWires(ctx, g, px, ptop) {
    const u = g.U;
    ctx.strokeStyle = '#1e2440';
    ctx.lineWidth = Math.max(1, u * 0.35);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const y = ptop + u * (2 + i * 2.4);
      ctx.moveTo(-u, y - u * (5 - i * 2));
      ctx.quadraticCurveTo(px - g.W * 0.45, y + u * (8 + i), px, y);
      ctx.quadraticCurveTo(px + g.W * 0.1, y + u * 3, g.W + u, y + u);
    }
    ctx.stroke();
  }

  function paintPole(ctx, g, px) {
    const u = g.U;
    const ptop = u * 3;
    paintWires(ctx, g, px, ptop);
    ctx.fillStyle = '#242842';
    ctx.fillRect(px - u * 1.2, ptop, u * 2.4, g.H * 0.68 - ptop);
    ctx.fillRect(px - u * 6, ptop + u * 2, u * 12, u * 0.8);
    ctx.fillRect(px - u * 5, ptop + u * 6.8, u * 10, u * 0.8);
    box(ctx, '#c3cbdb', px - u * 1.2, ptop - u * 0.4, u * 2.4, u * 0.8);
  }

  function paintStreetlamp(ctx, g, x) {
    const u = g.U;
    const top = u * 30;
    box(ctx, '#282c48', x - u * 0.5, top, u, g.H * 0.66 - top);
    ctx.globalCompositeOperation = 'lighter';
    const glow = paintGlow(u * 12, '#d8c090', 0.5);
    ctx.drawImage(glow, x - u * 12, top - u * 12);
    ctx.globalCompositeOperation = 'source-over';
    oval(ctx, x, top, u * 1.8, u * 1.8, '#f2e3b8');
  }

  function paintRoad(ctx, g) {
    const u = g.U;
    const cold = ROAD_COLD.map(K.parseColor);
    const warm = ROAD_WARM.map(K.parseColor);
    const spots = [[g.cx, 56, 1], [g.W * 0.82, 3.4, 0.5], [g.W * 0.09, 6, 0.42]];
    const y0 = Math.floor(u * 61);
    bakeTones(ctx, 0, y0, g.W, g.H - y0, (x, y) => {
      const ny = (y / u - 61) / 39;
      const ripple = fbm(x * 0.024, y * 0.42, 3, 5) - 0.5;
      let heat = 0;
      for (const s of spots) {
        const dx = (x - s[0]) / (u * s[1]);
        heat = Math.max(heat, s[2] * Math.max(0, 1 - dx * dx));
      }
      const fall = Math.max(0, Math.min(1, (y / u - 66) / 8)) * (1 - ny * 0.45);
      const w = heat * fall + ripple * 0.5;
      if (w > 0.34) return warm[Math.min(3, Math.floor((w - 0.34) * 5))];
      const c = lerp(3.1, 0.2, Math.min(1, ny * 2.4)) + ripple * 2.4;
      return cold[Math.max(0, Math.min(3, Math.round(c)))];
    });
    paintKerbs(ctx, g);
  }

  function paintKerbs(ctx, g) {
    const u = g.U;
    ctx.fillStyle = '#c3cbdb';
    const edge = g.W * 0.2;
    ctx.beginPath();
    ctx.moveTo(0, u * 65);
    ctx.lineTo(edge - u * 3, u * 65);
    ctx.quadraticCurveTo(edge + u * 1, u * 65, edge + u * 3, u * 61);
    ctx.lineTo(edge, u * 61);
    ctx.lineTo(0, u * 61);
    ctx.fill();
    ctx.fillRect(g.W * 0.8, u * 64, g.W * 0.2, u * 1.2);
  }

  function heapShape(ctx, g, x0, x1, height, seed, scale, drop) {
    ctx.beginPath();
    ctx.moveTo(x0, g.H);
    for (let x = x0; x <= x1 + 2; x += 2) {
      const f = (x - x0) / (x1 - x0);
      const lump = 0.7 + fbm(x * 0.06, seed, 3, seed) * 0.6;
      ctx.lineTo(x, g.H - Math.sin(f * Math.PI) * height * g.U * lump * scale + drop);
    }
    ctx.lineTo(x1, g.H);
    ctx.fill();
  }

  function paintHeap(ctx, g, x0, x1, height, seed) {
    ctx.fillStyle = '#7f8aa6';
    heapShape(ctx, g, x0, x1, height, seed, 1, 0);
    ctx.fillStyle = '#aeb7cb';
    heapShape(ctx, g, x0, x1, height, seed, 0.82, g.U * 0.4);
  }

  function paintStreet(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g);
    paintFarRow(ctx, g, rand);
    paintRoad(ctx, g);
    paintPole(ctx, g, g.W * 0.9);
    paintStreetlamp(ctx, g, g.W * 0.82);
    paintUpper(ctx, g, 0, g.W * 0.17, g.U * 65);
    paintShopfront(ctx, g, 0, g.W * 0.17, g.U * 65, rand);
    return c;
  }

  function paintBackWall(ctx, rand) {
    box(ctx, '#f4d08c', -42, 24, 84, 18);
    box(ctx, '#e0b06c', -42, 42, 84, 15);
    ctx.fillStyle = '#b98a50';
    for (let x = -36; x < 42; x += 8) ctx.fillRect(x, 24, 0.5, 33);
    ctx.fillStyle = '#6a4526';
    ctx.fillRect(-42, 41, 84, 1.2);
    for (let x = -38; x < 40; x += 5 + rand() * 4) {
      if (Math.abs(x - COOK_X) < 11 || Math.abs(x - CUSTOMER_X) < 10) continue;
      paintShelfThing(ctx, x, rand);
    }
  }

  function paintShelfThing(ctx, x, rand) {
    if (rand() < 0.55) {
      poly(ctx, [x - 2.2, 37.8, x + 2.2, 37.8, x + 1.3, 41, x - 1.3, 41], '#efe6d0');
      box(ctx, '#4a5f82', x - 2.2, 37.6, 4.4, 0.7);
    } else {
      box(ctx, '#5a3a24', x - 1.2, 36, 2.4, 5);
      ctx.fillRect(x - 0.5, 33.8, 1, 2.4);
    }
  }

  function paintRear(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = cartContext(c, g);
    paintBackWall(ctx, rand);
    box(ctx, '#3a2a20', -1.6, 25, 0.4, 9);
    oval(ctx, -1.4, 36.4, 2.7, 2.7, '#fff6d8');
    return c;
  }

  function paintCook(g) {
    const u = g.U;
    const c = layer(u * 30, u * 34);
    const ctx = spriteContext(c, u, 15, -28);
    ctx.fillStyle = JACKET;
    ctx.beginPath();
    ctx.moveTo(-8.4, 62);
    ctx.lineTo(-8.8, 45.5);
    ctx.quadraticCurveTo(-8.6, 41.8, -3, 41);
    ctx.lineTo(3, 41);
    ctx.quadraticCurveTo(8.6, 41.8, 8.8, 45.5);
    ctx.lineTo(8.4, 62);
    ctx.fill();
    poly(ctx, [-4.6, 46, 4.6, 46, 6.2, 62, -6.2, 62], '#e4dcc4');
    poly(ctx, [-3, 41, -1, 41, 4, 46.4, 2.6, 46.4]);
    poly(ctx, [3, 41, 1, 41, -4, 46.4, -2.6, 46.4]);
    paintCookHead(ctx);
    paintCookArm(ctx);
    return c;
  }

  function paintCookHead(ctx) {
    box(ctx, SKIN, -1.6, 39, 3.2, 3);
    oval(ctx, 0, 36.4, 3.7, 4.3);
    poly(ctx, [-3.6, 37, -2.2, 40, 2.2, 40, 3.6, 37, 2.8, 41, -2.8, 41], '#b57f58');
    ctx.fillStyle = '#2b2733';
    ctx.beginPath();
    ctx.ellipse(0, 34.6, 3.9, 3.5, 0, Math.PI, 0);
    ctx.fill();
    box(ctx, '#f2ecdc', -3.9, 33.8, 7.8, 1.3);
    poly(ctx, [3.6, 33.8, 6, 32.6, 6.4, 34, 3.8, 35]);
    ctx.fillStyle = '#6a4a38';
    ctx.fillRect(-2.3, 37, 1.4, 0.5);
    ctx.fillRect(0.9, 37, 1.4, 0.5);
  }

  function paintCookArm(ctx) {
    limb(ctx, JACKET, 3, -7.4, 44, -10.4, 51, -5.5, 54);
    oval(ctx, -4.6, 54.2, 1.5, 1.2, SKIN);
    poly(ctx, [-5.6, 52.8, 0.2, 52.8, -0.8, 56, -4.6, 56], '#efe6d0');
  }

  function paintRoof(ctx) {
    for (let i = 0; i < 8; i++) {
      const a = i * 12 - 48;
      const b = i * 10.25 - 41;
      poly(ctx, [a, 23.5, a + 12, 23.5, b + 10.25, 13, b, 13], i % 2 ? '#7f6a4c' : '#b49c74');
    }
    ctx.fillStyle = '#aab4c9';
    roofSnowShape(ctx, 0.9);
    ctx.fillStyle = '#e4e8f1';
    roofSnowShape(ctx, -0.5);
    box(ctx, '#3f2d21', -49, 23.2, 98, 2.2);
    box(ctx, '#d29a58', -42, 25, 84, 0.5);
  }

  function roofSnowEdge(x) {
    return 16.4 + (fbm(x * 0.11, 3, 3, 8) - 0.5) * 7 + Math.sin(x * 0.42) * 0.8;
  }

  function roofSnowShape(ctx, drop) {
    ctx.beginPath();
    ctx.moveTo(-41.5, 12.6);
    for (let x = -41.5; x <= 41.5; x += 3) ctx.lineTo(x, 12 - Math.abs(Math.sin(x * 0.19)) * 1.1);
    ctx.lineTo(44, 16);
    for (let x = 44; x >= -44; x -= 1) ctx.lineTo(x, roofSnowEdge(x) + drop);
    ctx.closePath();
    ctx.fill();
  }

  function paintPosts(ctx) {
    for (const x of [-43.4, 40.8]) box(ctx, '#4e3829', x, 24, 2.6, 34);
    for (const x of [-41.2, 40.8]) box(ctx, '#7d5b3d', x, 24, 0.5, 34);
  }

  function paintPot(ctx) {
    box(ctx, '#e39a4e', POT_X - 9, 54.6, 18, 1.6);
    const bands = [['#8d8d92', -11, 5], ['#d6d2c6', -6, 7], ['#b4b2ae', 1, 5], ['#85858c', 6, 5]];
    for (const b of bands) box(ctx, b[0], POT_X + b[1], POT_RIM, b[2], 10);
    box(ctx, '#55555c', POT_X - 11, 49, 22, 0.6);
    oval(ctx, POT_X, POT_RIM, 11.2, 2.3, '#f0ece0');
    oval(ctx, POT_X, POT_RIM + 0.1, 9.8, 1.6, '#6d4322');
    oval(ctx, POT_X - 1.4, POT_RIM + 0.2, 6, 0.9, '#b57c3e');
  }

  function paintCounter(ctx) {
    box(ctx, '#efc98a', -47, 56, 94, 1.4);
    box(ctx, '#a97a47', -47, 57.4, 94, 1.8);
    poly(ctx, [-36, 52.6, -29.5, 52.6, -30.6, 56, -34.9, 56], '#efe6d0');
    box(ctx, '#4a5f82', -36, 52.6, 6.5, 0.7);
    box(ctx, '#6a4526', -26, 50.4, 2.8, 5.6);
    ctx.fillStyle = '#d9c9a4';
    for (let i = 0; i < 4; i++) ctx.fillRect(-25.8 + i * 0.6, 47.6, 0.3, 3);
    paintPot(ctx);
  }

  function paintBody(ctx) {
    const planks = ['#5e4634', '#544234', '#5a4436'];
    for (let i = 0; i < 16; i++) box(ctx, planks[i % 3], -43.5 + i * 5.45, 59.2, 5.25, 14.3);
    box(ctx, '#7b5a3f', -43.5, 59.2, 87, 1.2);
    box(ctx, '#3c2a1f', -43.5, 66, 87, 1.2);
    box(ctx, '#3c2a1f', -43.5, 72.6, 87, 1.6);
    box(ctx, '#2a2231', -43.5, 74.2, 87, 3);
    for (const x of [-42, 39.6]) box(ctx, '#3c2a1f', x, 74, 2.4, GROUND - 74);
  }

  function paintBars(ctx) {
    limb(ctx, '#a5845a', 1.5, 43, 62, 54, 66, 66, 70);
    limb(ctx, '#a5845a', 1.5, 43, 70, 54, 72, 64, 74);
    box(ctx, '#5a4230', 60.4, 68.4, 1.4, GROUND - 68.4);
  }

  function ring(ctx, colour, width, x, y, r) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.3);
    ctx.stroke();
  }

  function paintWheel(ctx, x, r) {
    const y = GROUND - r;
    oval(ctx, x, y, r, r, 'rgba(34,26,30,0.65)');
    ctx.strokeStyle = '#a5845a';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 6.283 + 0.13;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.stroke();
    ring(ctx, '#2b2029', 2.4, x, y, r - 0.6);
    ring(ctx, '#c29a64', 1, x, y, r - 1.6);
    oval(ctx, x, y, 2.2, 2.2, '#c29a64');
    oval(ctx, x, y, 0.9, 0.9, '#3c2a1f');
  }

  function paintStool(ctx, x) {
    poly(ctx, [x - 5.4, 67, x - 3.6, 67, x - 5.6, GROUND + 0.4, x - 7.4, GROUND + 0.4], '#a07c52');
    poly(ctx, [x + 3.6, 67, x + 5.4, 67, x + 7.4, GROUND + 0.4, x + 5.6, GROUND + 0.4]);
    box(ctx, '#b08a5c', x - 7.4, 65.6, 14.8, 1.7);
  }

  function paintCustomerLegs(ctx, x) {
    poly(ctx, [x - 4.4, 67, x - 0.6, 67, x - 1, 75.4, x - 4, 75.4], '#2f3550');
    poly(ctx, [x + 0.6, 67, x + 4.4, 67, x + 4, 75.4, x + 1, 75.4]);
    poly(ctx, [x - 4.4, 75.2, x - 0.8, 75.2, x - 0.8, 77.6, x - 4.8, 77.6], '#1f2238');
    poly(ctx, [x + 0.8, 75.2, x + 4.4, 75.2, x + 4.8, 77.6, x + 0.8, 77.6]);
  }

  function paintCustomerBack(ctx, x) {
    ctx.fillStyle = COAT;
    ctx.beginPath();
    ctx.moveTo(x - 9, 66);
    ctx.quadraticCurveTo(x - 11, 58, x - 9.8, 50.5);
    ctx.quadraticCurveTo(x - 9, 46.6, x - 3.4, 45.4);
    ctx.lineTo(x + 3.4, 45.4);
    ctx.quadraticCurveTo(x + 9, 46.6, x + 9.8, 50.5);
    ctx.quadraticCurveTo(x + 11, 58, x + 9, 66);
    ctx.fill();
    box(ctx, '#38463a', x - 0.3, 49, 0.6, 17);
    poly(ctx, [x - 9, 66, x + 9, 66, x + 9.6, 62.5, x - 9.6, 62.5]);
    limb(ctx, '#e0ae62', 0.7, x - 9.6, 50.6, x - 8.4, 47.2, x - 3.4, 45.6);
    limb(ctx, '#e0ae62', 0.7, x + 9.6, 50.6, x + 8.4, 47.2, x + 3.4, 45.6);
    poly(ctx, [x - 4.4, 44, x + 4.4, 44, x + 5, 47.4, x - 5, 47.4], '#bcae8e');
    box(ctx, '#978a6c', x - 4.8, 45.6, 9.6, 0.5);
  }

  function paintFront(g) {
    const c = layer(g.W, g.H);
    const ctx = cartContext(c, g);
    paintPosts(ctx);
    paintBody(ctx);
    paintBars(ctx);
    paintCounter(ctx);
    paintWheel(ctx, 22, 12.5);
    paintRoof(ctx);
    paintStool(ctx, -36);
    paintCustomerLegs(ctx, CUSTOMER_X);
    paintStool(ctx, CUSTOMER_X);
    paintCustomerBack(ctx, CUSTOMER_X);
    limb(ctx, COAT, 3.4, CUSTOMER_X - 8.4, 50, CUSTOMER_X - 11.6, 57.4, CUSTOMER_X - 7, 56);
    return c;
  }

  function paintCustomerHead(g) {
    const u = g.U;
    const c = layer(u * 12, u * 13);
    const ctx = spriteContext(c, u, 6, 6.5);
    oval(ctx, -4.5, 0.6, 0.9, 1.3, SKIN);
    oval(ctx, 4.5, 0.6, 0.9, 1.3);
    oval(ctx, 0, 0, 4.6, 5, '#322d38');
    oval(ctx, -0.8, -2, 2.6, 2, '#4b4552');
    box(ctx, '#d9a97e', -1.8, 4.2, 3.6, 1.6);
    return c;
  }

  function paintLantern(g) {
    const u = g.U;
    const c = layer(u * 22, u * 32);
    const ctx = spriteContext(c, u, 11, 0);
    box(ctx, '#2b2226', -0.2, 0, 0.5, 3);
    const tones = [['#dc4a2c', 9, 11], ['#ec6a3c', 7.8, 9.8], ['#f89050', 5.8, 7.6], ['#fcba74', 3.2, 4.8]];
    for (const t of tones) oval(ctx, 0, 14, t[1], t[2], t[0]);
    ctx.fillStyle = 'rgba(150,40,24,0.34)';
    for (let i = -4; i <= 4; i++) {
      const y = 14 + i * 2.4;
      const half = Math.sqrt(Math.max(0, 1 - Math.pow((y - 14) / 11, 2))) * 9;
      ctx.fillRect(-half, y - 0.15, half * 2, 0.32);
    }
    ctx.fillStyle = '#2b2226';
    ctx.fillRect(-4, 2.6, 8, 1.6);
    ctx.fillRect(-4, 24, 8, 1.6);
    box(ctx, '#c9a54e', -0.7, 25.6, 1.4, 4.4);
    return c;
  }

  function paintPuff(rand, colour) {
    const c = layer(72, 72);
    const ctx = c.getContext('2d');
    const [r, g, b] = K.parseColor(colour);
    for (let i = 0; i < 9; i++) {
      const a = rand() * 6.283;
      const d = rand() * 19;
      const x = 36 + Math.cos(a) * d;
      const y = 36 + Math.sin(a) * d;
      const rad = 11 + rand() * 7;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, `rgba(${r},${g},${b},0.75)`);
      grad.addColorStop(0.6, `rgba(${r},${g},${b},0.42)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      box(ctx, grad, x - rad, y - rad, rad * 2, rad * 2);
    }
    return c;
  }

  function flatCart(g) {
    const u = g.U;
    const flat = layer(g.W, g.H);
    const ctx = flat.getContext('2d');
    ctx.drawImage(state.rear, 0, 0);
    ctx.drawImage(state.cook, g.cx + (COOK_X - 15) * u, (28 + COOK_DROP) * u);
    ctx.drawImage(state.front, 0, 0);
    ctx.drawImage(state.lantern, g.cx + (LANTERN_X - 11) * u, LANTERN_TOP * u);
    return flat;
  }

  function nearestTone(r, g, b) {
    let best = MIRROR[0];
    let score = 1e9;
    for (const t of MIRROR) {
      const d = (t[0] - r) ** 2 + (t[1] - g) ** 2 + (t[2] - b) ** 2;
      if (d < score) [score, best] = [d, t];
    }
    return best;
  }

  // The cart flipped and squashed onto the road, posterized, broken into dashes.
  function paintMirror(g) {
    const u = g.U;
    const ground = GROUND * u;
    const h = Math.ceil(g.H - ground);
    const k = h / ((REFLECT_TO - REFLECT_FROM) * u);
    const c = layer(g.W, h);
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, -k, 0, REFLECT_TO * u * k);
    ctx.drawImage(flatCart(g), 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let y = 0; y < c.height; y++) {
      const f = y / c.height;
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        const lum = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255;
        const dash = (fbm(x * 0.09, y * 0.9, 2, 13) - 0.5) * 0.7 - (y % 3 === 2 ? 0.12 : 0);
        const tone = nearestTone(d[i], d[i + 1], d[i + 2]);
        d.set(tone, i);
        d[i + 3] = d[i + 3] > 40 && lum * (1 - 0.45 * f) + dash > 0.42 ? 255 : 0;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function makeMotion(g, rand) {
    state.puffs = [];
    for (let i = 0; i < PUFFS; i++) state.puffs.push({ start: i / PUFFS + rand() * 0.02, rate: 0.042 + rand() * 0.016, off: rand() * 2 - 1, phase: rand() * 6.28, size: 0.8 + rand() * 0.5, shape: i % 3 });
    state.wisps = [];
    for (let i = 0; i < WISPS; i++) state.wisps.push({ off: (i / (WISPS - 1) - 0.5) * 15, phase: rand() * 6.28, rate: 0.13 + rand() * 0.07, start: rand() });
    makeSnow(g, rand);
  }

  function makeSnow(g, rand) {
    state.fx = new Float32Array(MAX_FLAKES);
    state.fy = new Float32Array(MAX_FLAKES);
    state.fv = new Float32Array(MAX_FLAKES);
    state.fp = new Float32Array(MAX_FLAKES);
    state.fs = new Float32Array(MAX_FLAKES);
    for (let i = 0; i < MAX_FLAKES; i++) {
      const depth = rand();
      const near = depth > 0.88;
      const mid = depth > 0.55;
      state.fx[i] = rand() * g.W;
      state.fy[i] = rand() * g.H;
      state.fv[i] = g.U * (near ? 9 + rand() * 4 : mid ? 5.5 + rand() * 3 : 3 + rand() * 2);
      state.fp[i] = rand() * 6.28;
      state.fs[i] = Math.max(1, g.U * (near ? 0.9 + rand() * 0.5 : mid ? 0.55 + rand() * 0.4 : 0.35));
    }
  }

  function drawMirror(ctx, g, t) {
    const m = state.mirror;
    const ground = Math.round(GROUND * g.U);
    const row = state.mirrorRow;
    const rows = Math.ceil(m.height / row);
    for (let k = 0; k < rows; k++) {
      const f = k / rows;
      const dx = Math.sin(t * 0.8 + k * 1.15) * g.U * (0.3 + f * 2.2) + Math.sin(t * 0.37 - k * 0.5) * g.U * f;
      ctx.drawImage(m, 0, k * row, m.width, row, dx, ground + k * row, m.width, row);
    }
  }

  function drawCook(ctx, g, t) {
    const u = g.U;
    const x = g.cx + (COOK_X + Math.sin(t * 0.33) * 0.5) * u;
    ctx.drawImage(state.cook, x - 15 * u, (28 + COOK_DROP) * u);
    const lift = 0.5 + 0.5 * Math.sin(t * 0.62);
    const handX = x + 14.5 * u;
    const handY = (47.6 - lift * 4.6) * u;
    const tipX = g.cx + (POT_X + 3) * u;
    const tipY = (48.5 - lift * 9) * u;
    limb(ctx, '#5a3f2a', Math.max(1, u * 0.7), handX, handY, tipX, tipY, tipX, tipY);
    oval(ctx, tipX, tipY + u, u * 2.6, u * 1.9, '#3b3440');
    limb(ctx, JACKET, u * 3, x + 7.4 * u, (44 + COOK_DROP) * u, x + 10.5 * u, (51 + COOK_DROP - lift) * u, handX - u, handY);
    oval(ctx, handX, handY, u * 1.4, u * 1.2, SKIN);
  }

  function drawCustomer(ctx, g, t) {
    const u = g.U;
    const x = g.cx + CUSTOMER_X * u;
    const raise = Math.max(0, Math.sin(t * 0.42));
    limb(ctx, COAT, u * 3.4, x + 8.4 * u, 50 * u, x + (11.6 + raise * 1.2) * u, (57.4 - raise * 3.4) * u, x + 7 * u, (56 - raise * 5) * u);
    ctx.drawImage(state.head, x - 6 * u, (35.4 + raise * -0.5 + Math.sin(t * 0.21)) * u);
  }

  function drawNoren(ctx, g, t) {
    const u = g.U;
    const pw = 77 / NOREN_PANELS;
    const top = NOREN_TOP * u;
    for (let p = 0; p < NOREN_PANELS; p++) {
      const swing = Math.sin(t * 0.55 + p * 0.9) * 0.9 + Math.sin(t * 0.23 + p * 2.1) * 0.6;
      const fw = (pw - 0.9) / NOREN_FOLDS;
      for (let f = 0; f < NOREN_FOLDS; f++) {
        const x0 = g.cx + (p * pw + f * fw - 37) * u;
        const x1 = x0 + fw * u + 0.5;
        const bot = (NOREN_TOP + NOREN_DROP + Math.sin(t * 0.8 + p + f * 1.2) * 0.45 + Math.sin(p * 2.4 + f * 1.7) * 0.5) * u;
        const s = swing * u;
        const tone = Math.sin(t * 0.55 + p * 0.9 + f * 1.9) * 1.1 + 1.1;
        ctx.fillStyle = NOREN_TONES[Math.round(tone)];
        ctx.beginPath();
        ctx.moveTo(x0, top);
        ctx.lineTo(x1, top);
        ctx.quadraticCurveTo(x1 + s * 0.2, (top + bot) / 2, x1 + s, bot);
        ctx.lineTo(x0 + s, bot);
        ctx.quadraticCurveTo(x0 + s * 0.2, (top + bot) / 2, x0, top);
        ctx.fill();
      }
    }
  }

  function drawLantern(ctx, g, t) {
    const u = g.U;
    const x = g.cx + LANTERN_X * u;
    const y = LANTERN_TOP * u;
    const r = u * 17;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.72 + 0.1 * Math.sin(t * 0.5);
    ctx.drawImage(state.redGlow, x - r, y + 14 * u - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 0.47) * 0.035 + Math.sin(t * 0.19) * 0.02);
    ctx.drawImage(state.lantern, -11 * u, 0);
    ctx.restore();
  }

  function drawPuffs(ctx, g, t, amount) {
    const u = g.U;
    const x0 = g.cx + POT_X * u;
    const y0 = (POT_RIM - 1) * u;
    const shown = Math.ceil(PUFFS * Math.min(1, amount + 0.2));
    for (let i = 0; i < shown; i++) {
      const p = state.puffs[i];
      const f = (t * p.rate + p.start) % 1;
      const x = x0 + (p.off * (3 + f * 8) + f * f * 34 + Math.sin(f * 5 + p.phase + t * 0.2) * (1 + f * 5)) * u;
      const y = y0 - Math.pow(f, 0.8) * u * 54;
      const r = (3.2 + f * 13) * p.size * u;
      ctx.globalAlpha = Math.min(1, amount * 0.6 * Math.min(1, f * 7) * Math.pow(1 - f, 1.25));
      ctx.drawImage(state.puffSprites[p.shape], x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawWisps(ctx, g, t, amount) {
    const u = g.U;
    const x0 = g.cx + POT_X * u;
    const y0 = (POT_RIM - 0.5) * u;
    ctx.strokeStyle = '#fbf3e0';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, u * 0.8);
    for (const w of state.wisps) {
      const life = (t * w.rate + w.start) % 1;
      ctx.globalAlpha = Math.sin(life * Math.PI) * 0.5 * Math.min(1, amount);
      ctx.beginPath();
      for (let k = 0; k <= WISP_POINTS; k++) {
        const f = k / WISP_POINTS;
        const rise = (life * 0.5 + f * 0.5) * 24 * u;
        const x = x0 + w.off * u + Math.sin(f * 4.4 + t * 0.7 + w.phase) * f * 3.4 * u + f * 3 * u;
        if (k === 0) ctx.moveTo(x, y0 - rise);
        else ctx.lineTo(x, y0 - rise);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawSnow(ctx, g, t, dt, amount) {
    const count = Math.min(MAX_FLAKES, Math.round(Math.min(g.W * 1.1, 210) * amount));
    const { fx, fy, fv, fp, fs } = state;
    ctx.fillStyle = '#f3f5fa';
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < count; i++) {
      fy[i] += fv[i] * dt;
      fx[i] += (Math.sin(t * 0.5 + fp[i]) * 0.7 - 0.35) * fv[i] * dt;
      if (fy[i] > g.H) fy[i] = -fs[i];
      if (fx[i] < -2) fx[i] = g.W + 1;
      else if (fx[i] > g.W + 2) fx[i] = -1;
      ctx.fillRect(fx[i], fy[i], fs[i], fs[i]);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    g.cx = g.W * 0.5;
    const rand = K.rng(api.seed);
    state.g = g;
    state.street = paintStreet(g, rand);
    state.rear = paintRear(g, rand);
    state.cook = paintCook(g);
    state.front = paintFront(g);
    state.head = paintCustomerHead(g);
    state.lantern = paintLantern(g);
    state.mirror = paintMirror(g);
    state.mirrorRow = Math.max(1, Math.round(g.U));
    state.heaps = layer(g.W, g.H);
    const hctx = state.heaps.getContext('2d');
    paintHeap(hctx, g, -g.U * 10, g.W * 0.2, 7.5, 3);
    paintHeap(hctx, g, g.W * 0.84, g.W + g.U * 10, 5, 7);
    state.redGlow = paintGlow(64, '#d8502c', 0.5);
    state.puffSprites = [paintPuff(rand, '#ece6d8'), paintPuff(rand, '#ece6d8'), paintPuff(rand, '#ece6d8')];
    makeMotion(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    ctx.drawImage(state.street, 0, 0);
    drawMirror(ctx, g, t);
    ctx.drawImage(state.rear, 0, 0);
    drawCook(ctx, g, t);
    ctx.drawImage(state.front, 0, 0);
    drawCustomer(ctx, g, t);
    drawNoren(ctx, g, t);
    drawLantern(ctx, g, t);
    drawPuffs(ctx, g, t, api.props.steam);
    drawWisps(ctx, g, t, api.props.steam);
    ctx.drawImage(state.heaps, 0, 0);
    drawSnow(ctx, g, t, dt, api.props.snow);
  }

  Kasuri.run({
    defaults: { steam: 1, snow: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.1, tint: 0.65 },
    maxFps: 24,
    setup,
    draw,
  });
})();
