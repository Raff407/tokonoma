/*
 * 丽江 Lijiang — an old Naxi town beside its canal at dusk.
 *
 * Sky, snow mountain, tiled houses, stone bridge and bank are baked once and
 * repainted every minute from the clock. The canal is the mirror of that bake,
 * drawn in wobbling strips. Between repaints only clouds, lanterns, the water
 * wheel, willow fronds, shimmer and a few floating lights move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.5;
  const BANK = 0.62;
  const WATER = 0.68;
  const BRIDGE_X = 0.645;
  const RETINT_SECONDS = 60;
  const PEAKS = [
    { x: 0.06, y: 0.3, s: 0.4 },
    { x: 0.17, y: 0.2, s: 0.42 },
    { x: 0.3, y: 0.12, s: 0.5 },
    { x: 0.43, y: 0.2, s: 0.4 },
    { x: 0.55, y: 0.3, s: 0.4 },
    { x: 0.8, y: 0.38, s: 0.4 },
  ];
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Colour as lit by the sky, sinking toward indigo at night.
  function tone(sky, c, amount) {
    const lit = mixColor(rgb(c), sky.amb, 0.2);
    return hex(mixColor(lit, rgb('#10142a'), sky.night * (amount === undefined ? 0.72 : amount)));
  }

  // ---- layout, fixed once per size ----------------------------------------

  function planHouses(g) {
    const rand = K.rng(17);
    const U = g.U;
    const bridgeL = g.W * BRIDGE_X - U * 22;
    const bridgeR = g.W * BRIDGE_X + U * 22;
    const front = [];
    let cx = -U * 3;
    while (cx < g.W) {
      const w = U * (21 + rand() * 9);
      const two = rand() < 0.5;
      const house = {
        x: cx, w, two,
        wall: U * (10 + rand() * 3), upper: U * (8 + rand() * 2), roof: U * (8 + rand() * 3),
        plaster: rand() < 0.5, pane: Math.floor(rand() * 3), seed: Math.floor(rand() * 1000),
      };
      cx += w + U * (0.5 + rand() * 2.5);
      if (cx > bridgeL && house.x < bridgeR) {
        cx = Math.max(cx, bridgeR + U);
        continue;
      }
      front.push(house);
    }
    const back = [];
    cx = U * 2;
    while (cx < g.W) {
      const w = U * (18 + rand() * 8);
      back.push({ x: cx, w, wall: U * (7 + rand() * 3), roof: U * (6 + rand() * 3), two: rand() < 0.4, upper: U * 7, seed: Math.floor(rand() * 1000), plaster: rand() < 0.5, pane: 0 });
      cx += w * (0.75 + rand() * 0.4);
    }
    return { front, back };
  }

  function planLanterns(g, houses) {
    const rand = K.rng(5);
    const U = g.U;
    const list = [];
    for (const h of houses) {
      if (list.length >= 12) break;
      if (rand() < 0.7) {
        const eave = g.H * BANK - h.wall - (h.two ? h.upper : 0);
        list.push({ x: h.x - U * 1.2, y: eave + U * 1.4, cord: U * (1 + rand()), ph: rand() * 6 });
        if (rand() < 0.4) list.push({ x: h.x + h.w + U * 1.2, y: eave + U * 1.4, cord: U * (1 + rand()), ph: rand() * 6 });
      }
    }
    const bx = g.W * BRIDGE_X;
    list.push({ x: bx - U * 15, y: g.H * BANK - U * 7, cord: U * 0.8, ph: 1.3 });
    list.push({ x: bx + U * 15, y: g.H * BANK - U * 7, cord: U * 0.8, ph: 3.1 });
    return list;
  }

  // ---- sky and mountain ---------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
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
    return c;
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.014, y * 0.08, 4, 23), fbm((x - w) * 0.014, y * 0.08, 4, 23), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 240;
        img.data[i + 3] = smoothstep(0.54, 0.72, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function ridgeY(g, x) {
    let y = g.H * HORIZON;
    for (const p of PEAKS) y = Math.min(y, g.H * p.y + Math.abs(x - g.W * p.x) * p.s);
    return y + (fbm(x * 0.06, 3, 4, 6) - 0.5) * g.U * 7;
  }

  function paintMountain(ctx, g, sky) {
    const snowLine = g.H * 0.27;
    const rock = mixColor(mixColor(rgb('#4d608a'), sky.haze, 0.5), rgb('#232c4a'), sky.night * 0.6);
    const snow = mixColor(mixColor(rgb('#f1f2f0'), sky.amb, 0.4), sky.top, 0.1 + sky.night * 0.3);
    const base = g.H * HORIZON + 1;
    for (let x = 0; x < g.W; x++) {
      const top = ridgeY(g, x);
      if (top >= base) continue;
      const shade = ridgeY(g, x + 1) > top ? 0.84 : 1;
      const vary = 0.88 + 0.2 * fbm(x * 0.16, 1, 3, 3);
      const line = snowLine + (fbm(x * 0.05, 8, 3, 4) - 0.5) * g.U * 9;
      if (top < line) {
        ctx.fillStyle = hex(snow.map((c) => c * shade * (0.92 + (vary - 0.88) * 0.5)));
        ctx.fillRect(x, top, 1, line - top);
      }
      ctx.fillStyle = hex(rock.map((c) => c * shade * vary));
      ctx.fillRect(x, Math.max(top, line), 1, base - Math.max(top, line));
    }
  }

  function paintHills(ctx, g, sky) {
    ctx.fillStyle = hex(mixColor(mixColor(rgb('#4d6a4c'), sky.haze, 0.55), rgb('#1c2438'), sky.night * 0.6));
    for (let x = 0; x < g.W; x++) {
      const top = g.H * 0.45 + (fbm(x * 0.012, 5, 3, 8) - 0.5) * g.H * 0.09 - Math.sin((x / g.W) * 3.4) * g.U * 2;
      ctx.fillRect(x, top, 1, g.H * 0.2);
    }
  }

  function paintMist(ctx, g, sky) {
    const y0 = g.H * 0.4;
    const grad = ctx.createLinearGradient(0, y0, 0, g.H * 0.58);
    const c = mixColor(sky.low, sky.haze, 0.4);
    grad.addColorStop(0, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},0)`);
    grad.addColorStop(1, `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},0.7)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, g.W, g.H * 0.58 - y0);
  }

  // ---- houses -------------------------------------------------------------

  // Hip-and-gable roof with swept-up eave tips and rows of grey tile.
  function paintRoof(ctx, g, sky, x0, w, eaveY, h, haze) {
    const U = g.U;
    const o = U * 2.4;
    const l = x0 - o;
    const r = x0 + w + o;
    const ridge = eaveY - h;
    const body = mixColor(rgb(tone(sky, '#464e5a')), sky.haze, haze);
    const lite = mixColor(rgb(tone(sky, '#7a8490')), sky.haze, haze);
    ctx.beginPath();
    ctx.moveTo(l, eaveY - U * 0.5);
    ctx.quadraticCurveTo(l + (x0 + w * 0.2 - l) * 0.55, eaveY + U * 0.4, x0 + w * 0.2, ridge);
    ctx.lineTo(x0 + w * 0.8, ridge);
    ctx.quadraticCurveTo(r - (r - x0 - w * 0.8) * 0.55, eaveY + U * 0.4, r, eaveY - U * 0.5);
    ctx.quadraticCurveTo((l + r) / 2, eaveY + U * 1.9, l, eaveY - U * 0.5);
    ctx.closePath();
    ctx.fillStyle = hex(body);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = hex(lite);
    ctx.globalAlpha = 0.55;
    for (let y = ridge + U * 0.9; y < eaveY + U * 2; y += U * 1.1) ctx.fillRect(l, y, r - l, Math.max(1, U * 0.3));
    ctx.fillRect(x0 + w * 0.2, ridge, x0 + w * 0.6 - x0 - w * 0.2 + w * 0.2, Math.max(1, U * 0.5));
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.fillStyle = hex(body);
    ctx.fillRect(x0 + w * 0.2 - U * 0.4, ridge - U * 0.9, Math.max(1, U * 0.9), U * 1);
    ctx.fillRect(x0 + w * 0.8 - U * 0.4, ridge - U * 0.9, Math.max(1, U * 0.9), U * 1);
  }

  function paintWindows(ctx, g, sky, h, x0, w, top, wallH, lit, haze) {
    const U = g.U;
    const n = Math.max(1, Math.floor(w / (U * 6.5)));
    const gap = w / n;
    const glow = mixColor(rgb('#e4b055'), rgb('#f3d98a'), sky.night);
    const dim = rgb(tone(sky, '#2a2e40'));
    for (let i = 0; i < n; i++) {
      const wx = x0 + gap * i + gap / 2 - U * 1.4;
      const on = ((h.seed >> i) & 1) || sky.night > 0.6;
      const c = on ? mixColor(dim, glow, lit * (0.75 + 0.25 * ((h.seed >> (i + 3)) & 1))) : dim;
      ctx.fillStyle = hex(mixColor(c, sky.haze, haze));
      ctx.fillRect(wx, top + wallH * 0.25, U * 2.8, wallH * 0.5);
      ctx.fillStyle = tone(sky, '#3a2c28');
      ctx.fillRect(wx, top + wallH * 0.25, U * 2.8, 1);
      ctx.fillRect(wx, top + wallH * 0.75 - 1, U * 2.8, 1);
      ctx.fillRect(wx + U * 1.35, top + wallH * 0.25, Math.max(1, U * 0.3), wallH * 0.5);
      ctx.fillRect(wx, top + wallH * 0.5, U * 2.8, 1);
    }
  }

  function paintHouse(ctx, g, sky, h, base, haze) {
    const U = g.U;
    const lit = 0.25 + 0.75 * sky.night;
    const wood = tone(sky, '#4e3a32');
    const plaster = tone(sky, '#d9d2bf');
    const tint = (c) => hex(mixColor(rgb(c), sky.haze, haze));
    let top = base - h.wall;
    ctx.fillStyle = tint(h.plaster ? plaster : wood);
    ctx.fillRect(h.x, top, h.w, h.wall);
    paintWindows(ctx, g, sky, h, h.x, h.w, top, h.wall, lit, haze);
    ctx.fillStyle = tint(wood);
    for (let px = h.x; px < h.x + h.w; px += U * 2.6) ctx.fillRect(px, top, Math.max(1, U * 0.5), h.wall);
    if (h.two) {
      ctx.fillStyle = tint(tone(sky, '#3c424c'));
      ctx.fillRect(h.x - U * 1.6, top - U * 0.6, h.w + U * 3.2, U * 1.5);
      const upTop = top - h.upper;
      ctx.fillStyle = tint(h.plaster ? wood : plaster);
      ctx.fillRect(h.x + U * 0.8, upTop, h.w - U * 1.6, h.upper - U * 0.6);
      paintWindows(ctx, g, sky, h, h.x + U * 0.8, h.w - U * 1.6, upTop, h.upper - U * 0.6, lit, haze);
      top = upTop;
    }
    paintRoof(ctx, g, sky, h.x, h.w, top, h.roof, haze);
  }

  // ---- bank, bridge, wheel posts -----------------------------------------

  function paintBank(ctx, g, sky, rand) {
    const U = g.U;
    const top = g.H * BANK;
    const bot = g.H * WATER;
    ctx.fillStyle = tone(sky, '#6c7076');
    ctx.fillRect(0, top, g.W, bot - top);
    ctx.fillStyle = tone(sky, '#4a4e56');
    for (let y = top + U * 1.6; y < bot; y += U * 1.6) ctx.fillRect(0, y, g.W, 1);
    for (let row = 0; row < 4; row++) {
      for (let x = rand() * U * 3; x < g.W; x += U * (3 + rand() * 3)) ctx.fillRect(x, top + row * U * 1.6, 1, U * 1.6);
    }
    ctx.fillStyle = tone(sky, '#8b8e8a');
    ctx.fillRect(0, top, g.W, Math.max(1, U * 0.7));
    ctx.fillStyle = tone(sky, '#58704e');
    for (let i = 0; i < 70; i++) ctx.fillRect(rand() * g.W, top + rand() * (bot - top - 1), U * (1 + rand() * 2), Math.max(1, U * 0.5));
  }

  function deckY(g, x) {
    const hw = g.U * 22;
    const crown = g.H * WATER - g.U * 11;
    const d = (x - g.W * BRIDGE_X) / hw;
    return crown + d * d * (g.H * BANK - crown);
  }

  function paintBridge(ctx, g, sky) {
    const U = g.U;
    const cx = g.W * BRIDGE_X;
    const hw = U * 22;
    const water = g.H * WATER;
    ctx.beginPath();
    ctx.moveTo(cx - hw, water);
    for (let x = cx - hw; x <= cx + hw; x += 1) ctx.lineTo(x, deckY(g, x));
    ctx.lineTo(cx + hw, water);
    ctx.closePath();
    ctx.fillStyle = tone(sky, '#8f918c');
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = tone(sky, '#6a6d6e');
    for (let y = water; y > water - U * 20; y -= U * 1.5) ctx.fillRect(cx - hw, y, hw * 2, 1);
    ctx.restore();
    // Arch opening onto the dark canal beneath.
    ctx.fillStyle = hex(mixColor(rgb(tone(sky, '#1e2a48')), sky.low, 0.15));
    ctx.beginPath();
    ctx.ellipse(cx, water, U * 8.5, U * 6.5, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = tone(sky, '#b9b8ae');
    ctx.lineWidth = Math.max(1, U * 0.9);
    ctx.beginPath();
    ctx.ellipse(cx, water, U * 8.9, U * 6.9, 0, Math.PI, 0);
    ctx.stroke();
    // Low parapet with a post every few steps.
    ctx.strokeStyle = tone(sky, '#a2a49e');
    ctx.lineWidth = Math.max(1, U * 0.8);
    ctx.beginPath();
    for (let x = cx - hw; x <= cx + hw; x += 1) {
      if (x === cx - hw) ctx.moveTo(x, deckY(g, x) - U * 1.4);
      else ctx.lineTo(x, deckY(g, x) - U * 1.4);
    }
    ctx.stroke();
    ctx.fillStyle = tone(sky, '#9a9c96');
    for (let k = -4; k <= 4; k++) {
      const px = cx + k * hw * 0.25;
      ctx.fillRect(px - U * 0.5, deckY(g, px) - U * 2.2, Math.max(1, U * 1.1), U * 2.2);
    }
  }

  function paintWheelPosts(ctx, g, sky) {
    const U = g.U;
    const wx = g.W * 0.37;
    ctx.fillStyle = tone(sky, '#46342c');
    ctx.fillRect(wx - U * 9, g.H * BANK - U * 4, Math.max(1, U * 1.2), U * 12);
    ctx.fillRect(wx + U * 8, g.H * BANK - U * 4, Math.max(1, U * 1.2), U * 12);
    ctx.fillRect(wx - U * 9, g.H * BANK - U * 4, U * 18.2, Math.max(1, U * 0.8));
  }

  // ---- bake ---------------------------------------------------------------

  function paintBack(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintMountain(ctx, g, sky);
    paintHills(ctx, g, sky);
    paintMist(ctx, g, sky);
    for (const h of state.plan.back) paintHouse(ctx, g, sky, h, g.H * (BANK - 0.045), 0.55);
    ctx.fillStyle = hex(mixColor(rgb(tone(sky, '#4d6a4c')), sky.haze, 0.35));
    ctx.fillRect(0, g.H * (BANK - 0.03), g.W, g.H * 0.03);
    for (const h of state.plan.front) paintHouse(ctx, g, sky, h, g.H * BANK, 0.12);
    paintBank(ctx, g, sky, rand);
    paintBridge(ctx, g, sky);
    paintWheelPosts(ctx, g, sky);
    return c;
  }

  function paintReflection(g, sky, skyLayer, back) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const water = g.H * WATER;
    ctx.save();
    ctx.translate(0, 2 * water);
    ctx.scale(1, -1);
    ctx.drawImage(skyLayer, 0, 0);
    ctx.drawImage(back, 0, 0);
    ctx.restore();
    const deep = mixColor(rgb('#1f3a58'), sky.low, 0.2);
    const grad = ctx.createLinearGradient(0, water, 0, g.H);
    grad.addColorStop(0, `rgba(${deep[0] | 0},${deep[1] | 0},${deep[2] | 0},0.35)`);
    grad.addColorStop(1, `rgba(16,24,42,${0.7})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, water, g.W, g.H - water);
    state.water = hex(mixColor(deep, rgb('#10182a'), 0.5 + sky.night * 0.3));
    return c;
  }

  function paintBamboo(ctx, g, sky, rand) {
    const U = g.U;
    for (let i = 0; i < 7; i++) {
      const x = g.W * 0.925 + i * U * 2.4 + rand() * U;
      const top = g.H * (0.42 + rand() * 0.14);
      ctx.strokeStyle = tone(sky, i % 2 ? '#587c52' : '#476a48');
      ctx.lineWidth = Math.max(1, U * 0.9);
      ctx.beginPath();
      ctx.moveTo(x, g.H);
      ctx.lineTo(x + (rand() - 0.5) * U * 2, top);
      ctx.stroke();
      ctx.lineWidth = Math.max(1, U * 0.45);
      for (let k = 0; k < 12; k++) {
        const ly = top + k * U * 1.5 + rand() * U;
        const dir = k % 2 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(x, ly);
        ctx.lineTo(x + dir * U * (3 + rand() * 3), ly + U * (1.5 + rand() * 2));
        ctx.stroke();
      }
    }
  }

  function paintFront(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const U = g.U;
    ctx.fillStyle = tone(sky, '#1c2030');
    ctx.fillRect(0, g.H * 0.955, g.W, g.H * 0.05);
    ctx.fillStyle = tone(sky, '#6c7076');
    ctx.fillRect(0, g.H * 0.955, g.W, Math.max(1, U * 0.6));
    paintBamboo(ctx, g, sky, rand);
    // Willow trunk and limbs on the left bank.
    ctx.strokeStyle = tone(sky, '#3c3030');
    ctx.lineCap = 'round';
    ctx.lineWidth = U * 2.6;
    ctx.beginPath();
    ctx.moveTo(g.W * 0.06, g.H);
    ctx.quadraticCurveTo(g.W * 0.07, g.H * 0.6, g.W * 0.09, g.H * 0.4);
    ctx.stroke();
    ctx.lineWidth = U * 1.3;
    ctx.beginPath();
    ctx.moveTo(g.W * 0.09, g.H * 0.4);
    ctx.quadraticCurveTo(g.W * 0.14, g.H * 0.35, g.W * 0.2, g.H * 0.4);
    ctx.moveTo(g.W * 0.09, g.H * 0.4);
    ctx.quadraticCurveTo(g.W * 0.05, g.H * 0.36, g.W * 0.01, g.H * 0.41);
    ctx.stroke();
    ctx.lineCap = 'butt';
    return c;
  }

  function paintSprites(g, sky) {
    const U = g.U;
    const lw = Math.max(3, Math.ceil(U * 2.6));
    const lh = Math.max(4, Math.ceil(U * 3.4));
    const lamp = layer(lw, lh);
    const lc = lamp.getContext('2d');
    lc.fillStyle = '#b38a3c';
    lc.fillRect(lw * 0.25, 0, lw * 0.5, Math.max(1, lh * 0.12));
    lc.fillRect(lw * 0.25, lh * 0.88, lw * 0.5, Math.max(1, lh * 0.12));
    lc.fillStyle = '#b8402a';
    lc.beginPath();
    lc.ellipse(lw / 2, lh / 2, lw / 2, lh * 0.4, 0, 0, 6.3);
    lc.fill();
    lc.fillStyle = `rgba(240,196,110,${0.25 + 0.55 * sky.night})`;
    lc.beginPath();
    lc.ellipse(lw / 2, lh / 2, lw * 0.28, lh * 0.3, 0, 0, 6.3);
    lc.fill();
    state.lamp = lamp;
    const size = Math.ceil(U * 10);
    const halo = layer(size, size);
    const hc = halo.getContext('2d');
    const grad = hc.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(236,170,90,0.55)');
    grad.addColorStop(1, 'rgba(236,170,90,0)');
    hc.fillStyle = grad;
    hc.fillRect(0, 0, size, size);
    state.halo = halo;
  }

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(41);
    state.sky = paintSky(g, sky, rand);
    state.back = paintBack(g, sky, rand);
    state.refl = paintReflection(g, sky, state.sky, state.back);
    state.front = paintFront(g, sky, rand);
    paintSprites(g, sky);
    state.night = sky.night;
    state.cloudAlpha = 0.6 - sky.night * 0.4;
    state.shimmer = hex(mixColor(sky.amb, rgb('#e8e0c8'), 0.4));
    state.frond = [tone(sky, '#5b7a4c'), tone(sky, '#46643e')];
    state.wood = tone(sky, '#4a382e');
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion -------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.clouds;
    const off = -((t * g.U * 1.2) % c.width);
    ctx.globalAlpha = state.cloudAlpha;
    ctx.drawImage(c, off, g.H * 0.03);
    ctx.drawImage(c, off + c.width, g.H * 0.03);
    ctx.globalAlpha = 1;
  }

  function drawWater(ctx, g, t, ripple) {
    const water = Math.floor(g.H * WATER);
    ctx.fillStyle = state.water;
    ctx.fillRect(0, water, g.W, g.H - water);
    const rows = g.H - water;
    const amp = g.U * 0.5 * ripple;
    for (let r = 0; r < rows; r++) {
      const off = Math.sin(t * 0.9 + r * 0.55) * amp * (0.3 + r / rows);
      ctx.drawImage(state.refl, 0, water + r, g.W, 1, off, water + r, g.W, 1);
    }
    ctx.fillStyle = state.shimmer;
    for (let i = 0; i < state.streaks.length; i++) {
      const s = state.streaks[i];
      const x = (s.x * g.W + t * g.U * s.v) % (g.W + g.U * 8) - g.U * 4;
      ctx.globalAlpha = (0.12 + 0.12 * Math.sin(t * 0.7 + s.ph)) * ripple * (0.5 + state.night * 0.5);
      ctx.fillRect(x, water + s.y * rows, g.U * (3 + s.v), Math.max(1, g.U * 0.35));
    }
    ctx.globalAlpha = 1;
  }

  function drawWheel(ctx, g, t) {
    const U = g.U;
    const wx = g.W * 0.37;
    const wy = g.H * BANK + U * 1.5;
    const R = U * 7.5;
    const a = t * 0.45;
    ctx.strokeStyle = state.wood;
    ctx.fillStyle = state.wood;
    ctx.lineWidth = Math.max(1, U * 0.7);
    ctx.beginPath();
    ctx.arc(wx, wy, R, 0, 6.3);
    for (let i = 0; i < 8; i++) {
      const ang = a + (i * Math.PI) / 4;
      const cs = Math.cos(ang);
      const sn = Math.sin(ang);
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + cs * R, wy + sn * R);
      ctx.moveTo(wx + cs * R, wy + sn * R);
      ctx.lineTo(wx + cs * (R + U * 1.4) - sn * U * 0.8, wy + sn * (R + U * 1.4) + cs * U * 0.8);
    }
    ctx.stroke();
    ctx.fillRect(wx - U * 0.8, wy - U * 0.8, U * 1.6, U * 1.6);
  }

  function drawLanterns(ctx, g, t) {
    const lamps = state.lanterns;
    const lamp = state.lamp;
    const halo = state.halo;
    const strength = 0.2 + state.night * 0.5;
    const water = g.H * WATER;
    for (let i = 0; i < lamps.length; i++) {
      const l = lamps[i];
      const a = Math.sin(t * 1.1 + l.ph) * 0.09;
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(a);
      ctx.globalAlpha = strength;
      ctx.drawImage(halo, -halo.width / 2, l.cord + lamp.height / 2 - halo.height / 2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = state.wood;
      ctx.fillRect(0, 0, 1, l.cord);
      ctx.drawImage(lamp, -lamp.width / 2, l.cord);
      ctx.restore();
      // A streak of the lantern on the canal.
      const ry = water + (water - l.y) * 0.9;
      ctx.globalAlpha = 0.28 + state.night * 0.3;
      ctx.fillStyle = '#c4553a';
      ctx.fillRect(l.x - g.U * 0.6 + Math.sin(t * 1.3 + l.ph) * g.U * 0.6, ry, Math.max(1, g.U * 1.2), g.U * 2.4);
    }
    ctx.globalAlpha = 1;
  }

  // Small lotus lights drifting along the canal.
  function drawRiverLights(ctx, g, t) {
    const lights = state.lights;
    const water = g.H * WATER;
    const rows = g.H - water;
    for (let i = 0; i < lights.length; i++) {
      const s = lights[i];
      const x = ((s.x * g.W - t * g.U * 0.9 * s.v) % (g.W + g.U * 10) + g.W + g.U * 10) % (g.W + g.U * 10) - g.U * 5;
      const y = water + s.y * rows + Math.sin(t * 1.2 + s.ph) * g.U * 0.4;
      ctx.globalAlpha = 0.25 + state.night * 0.45;
      ctx.drawImage(state.halo, x - g.U * 2.5, y - g.U * 2.5, g.U * 5, g.U * 5);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e1b457';
      ctx.fillRect(x - g.U * 0.9, y - g.U * 0.3, g.U * 1.8, g.U * 0.9);
      ctx.fillStyle = '#c4553a';
      ctx.fillRect(x - g.U * 0.5, y - g.U * 0.7, g.U * 1, g.U * 0.5);
    }
  }

  function drawWillow(ctx, g, t) {
    const strands = state.strands;
    ctx.lineWidth = Math.max(1, g.U * 0.7);
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = state.frond[pass];
      ctx.beginPath();
      for (let i = pass; i < strands.length; i += 2) {
        const s = strands[i];
        const sway = Math.sin(t * 0.8 + s.ph) * g.U * 1.8;
        const ox = s.x * g.W;
        const oy = s.y * g.H;
        ctx.moveTo(ox, oy);
        ctx.quadraticCurveTo(ox + sway * 0.4 + s.lean, oy + s.len * 0.55, ox + sway + s.lean, oy + s.len);
      }
      ctx.stroke();
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.plan = planHouses(g);
    state.lanterns = planLanterns(g, state.plan.front);
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.22));
    const rand = K.rng(9);
    state.streaks = Array.from({ length: 22 }, () => ({ x: rand(), y: rand(), v: 0.8 + rand() * 2, ph: rand() * 6 }));
    state.lights = Array.from({ length: 5 }, (_, i) => ({ x: (i + rand() * 0.6) / 5, y: 0.2 + rand() * 0.6, v: 0.6 + rand() * 0.5, ph: rand() * 6 }));
    state.strands = Array.from({ length: 30 }, (_, i) => {
      const u = i / 29;
      return { x: 0.01 + u * 0.19, y: 0.4 - Math.sin(u * Math.PI) * 0.04 + (u < 0.5 ? 0.02 : 0), len: g.U * (14 + rand() * 14), ph: rand() * 6, lean: (rand() - 0.5) * g.U * 1.5 };
    });
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.back, 0, 0);
    drawWater(ctx, g, t, props.ripple);
    drawWheel(ctx, g, t);
    if (props.lanterns) {
      drawRiverLights(ctx, g, t);
      drawLanterns(ctx, g, t);
    }
    ctx.drawImage(state.front, 0, 0);
    drawWillow(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', ripple: 1, lanterns: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
