/*
 * しまなみ Shimanami — a long suspension bridge hopping between green islands
 * over the calm Seto Inland Sea.
 *
 * Sky, islands, bridge, sea and the near shore are baked into layers and
 * repainted once a minute from the clock. Between repaints only clouds,
 * sea glints and a few boats move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.56;
  const DECK = 0.455;
  const TOWER_TOP = 0.16;
  const TOWERS = [0.3, 0.7];
  const ANCHORS = [0.02, 0.98];
  const RETINT_SECONDS = 60;
  const GLINTS = 36;
  const BOATS = [
    { y: 0.62, speed: 0.011, dir: 1, kind: 'ferry', phase: 0.15 },
    { y: 0.73, speed: 0.018, dir: -1, kind: 'fishing', phase: 0.6 },
    { y: 0.86, speed: 0.025, dir: 1, kind: 'fishing', phase: 0.85 },
  ];
  const state = {};

  const hex = (rgb) => toHex(rgb);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---- sky ---------------------------------------------------------------

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
    paintBody(ctx, g, sky);
    return c;
  }

  // Sun by day, moon by night, on a shallow arc.
  function paintBody(ctx, g, sky) {
    const night = sky.night > 0.5;
    const t = night ? S.moonT(sky.hour) : S.sunT(sky.hour);
    const bx = g.W * (0.12 + t * 0.76);
    const by = g.H * (0.34 - Math.sin(t * Math.PI) * 0.17);
    const r = g.U * (night ? 3.2 : 4);
    const glow = ctx.createRadialGradient(bx, by, 0, bx, by, r * 5);
    const tint = night ? '226,226,214' : '250,236,200';
    glow.addColorStop(0, `rgba(${tint},${night ? 0.28 : 0.4})`);
    glow.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(bx - r * 5, by - r * 5, r * 10, r * 10);
    ctx.fillStyle = night ? '#ece8d6' : '#f6ecd0';
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, 6.3);
    ctx.fill();
    state.bodyX = bx;
    state.night = night;
  }

  // Wisps that tile sideways, kept to the upper sky.
  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    const density = (x, y) => fbm(x * 0.012, y * 0.08, 4, 23);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        const v = lerp(density(x, y), density(x - c.width, y), x / c.width);
        const i = (y * c.width + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 246;
        img.data[i + 3] = smoothstep(0.5, 0.7, v) * band * 200;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- islands -----------------------------------------------------------

  // Hill silhouette: height of the ridge at fraction fx, 0..1 across the canvas.
  function hill(g, fx, center, width, peak, seed) {
    const d = Math.abs(fx - center) / width;
    const body = Math.pow(Math.max(0, 1 - d * d), 1.3);
    const bumps = (fbm(fx * 9, seed, 3, seed) - 0.5) * 0.03;
    return body > 0 ? HORIZON - peak * body + bumps * body : HORIZON + 1;
  }

  function paintFarIslands(ctx, g, sky) {
    const col = mixColor(mixColor(rgb('#4f6a78'), sky.haze, 0.45), sky.low, 0.2);
    const far = mixColor(col, sky.low, 0.5);
    const sets = [
      { c: far, list: [[0.5, 0.22, 0.1, 3], [0.74, 0.1, 0.07, 7], [0.28, 0.1, 0.075, 5]] },
      { c: col, list: [[0.4, 0.13, 0.11, 11], [0.58, 0.14, 0.09, 13], [0.76, 0.12, 0.12, 17]] },
    ];
    for (const set of sets) {
      ctx.fillStyle = hex(set.c);
      for (let px = 0; px < g.W; px++) {
        const fx = px / g.W;
        let top = HORIZON;
        for (const [cx, wd, pk, sd] of set.list) top = Math.min(top, hill(g, fx, cx, wd, pk, sd));
        if (top < HORIZON) ctx.fillRect(px, g.H * top, 1, g.H * (HORIZON + 0.004 - top));
      }
    }
  }

  const MOSS = '#4d6b45';
  const MOSS_DARK = '#2f4a38';

  // The two bridge-end islands, green and wooded, with a few lit orange groves.
  function paintBridgeIslands(ctx, g, sky, rand) {
    const night = sky.night;
    const lit = mixColor(mixColor(rgb(MOSS), sky.amb, 0.22), rgb('#141c26'), night * 0.7);
    const dark = mixColor(mixColor(rgb(MOSS_DARK), sky.haze, 0.18), rgb('#0e141c'), night * 0.7);
    const isles = [
      { c: 0.13, w: 0.24, pk: 0.21, sd: 2 },
      { c: 0.89, w: 0.24, pk: 0.18, sd: 4 },
    ];
    for (const isle of isles) {
      for (let px = 0; px < g.W; px++) {
        const fx = px / g.W;
        const top = hill(g, fx, isle.c, isle.w, isle.pk, isle.sd);
        if (top >= HORIZON) continue;
        const y0 = g.H * top;
        const hgt = g.H * (HORIZON + 0.012) - y0;
        const grad = ctx.createLinearGradient(0, y0, 0, y0 + hgt);
        grad.addColorStop(0, hex(lit));
        grad.addColorStop(1, hex(dark));
        ctx.fillStyle = grad;
        ctx.fillRect(px, y0, 1, hgt);
      }
      // Tree crowns along each slope.
      for (let i = 0; i < 70; i++) {
        const fx = isle.c + (rand() - 0.5) * isle.w * 1.7;
        const top = hill(g, fx, isle.c, isle.w, isle.pk, isle.sd);
        if (top >= HORIZON - 0.004) continue;
        const y = g.H * (top + rand() * (HORIZON - top) * 0.7);
        ctx.fillStyle = hex(mixColor(rand() < 0.5 ? lit : dark, rgb('#1d3226'), rand() * 0.4));
        ctx.beginPath();
        ctx.arc(fx * g.W, y, g.U * (0.5 + rand() * 0.8), 0, 6.3);
        ctx.fill();
      }
      // Tidy rows of citrus on the sunny slope.
      ctx.fillStyle = hex(mixColor(rgb('#d6892c'), rgb('#6c5a3a'), night * 0.7));
      for (let k = 0; k < 14; k++) {
        const fx = isle.c + (rand() - 0.5) * isle.w * 0.9;
        const top = hill(g, fx, isle.c, isle.w, isle.pk, isle.sd);
        if (top >= HORIZON - 0.01) continue;
        const y = g.H * (top + (HORIZON - top) * (0.35 + rand() * 0.3));
        ctx.fillRect(fx * g.W, y, Math.max(1, g.U * 0.4), Math.max(1, g.U * 0.4));
      }
    }
  }

  // ---- bridge ------------------------------------------------------------

  function towerTopY(g) {
    return g.H * TOWER_TOP;
  }

  function cablePoint(g, a, b, sag, u) {
    const x = lerp(a[0], b[0], u);
    const y = lerp(a[1], b[1], u) + sag * 4 * u * (1 - u);
    return [x, y];
  }

  function paintTower(ctx, g, fx, steel, shade) {
    const cx = g.W * fx;
    const top = towerTopY(g);
    const base = g.H * (DECK + 0.1);
    const legGap = g.U * 2.1;
    const leg = Math.max(2, g.U * 0.9);
    ctx.fillStyle = hex(steel);
    ctx.fillRect(cx - legGap - leg / 2, top, leg, base - top);
    ctx.fillRect(cx + legGap - leg / 2, top, leg, base - top);
    ctx.fillStyle = hex(shade);
    ctx.fillRect(cx - legGap + leg / 2 - 1, top, 1, base - top);
    ctx.fillRect(cx + legGap + leg / 2 - 1, top, 1, base - top);
    ctx.fillStyle = hex(steel);
    for (const f of [0.0, 0.22, 0.55]) {
      ctx.fillRect(cx - legGap, top + (base - top) * f + g.U * 0.5, legGap * 2, Math.max(1, g.U * 0.55));
    }
    // Slim cross brace between the first two beams.
    ctx.strokeStyle = hex(steel);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - legGap, top + g.U * 0.5);
    ctx.lineTo(cx + legGap, top + (base - top) * 0.22 + g.U * 0.5);
    ctx.moveTo(cx + legGap, top + g.U * 0.5);
    ctx.lineTo(cx - legGap, top + (base - top) * 0.22 + g.U * 0.5);
    ctx.stroke();
    // Cap on each leg.
    ctx.fillStyle = hex(shade);
    ctx.fillRect(cx - legGap - leg, top - 1, leg * 2, Math.max(1, g.U * 0.5));
    ctx.fillRect(cx + legGap - leg, top - 1, leg * 2, Math.max(1, g.U * 0.5));
  }

  function paintCableRun(ctx, g, a, b, sag, hangerTo, cable, hanger, lights) {
    ctx.strokeStyle = hex(cable);
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const p = cablePoint(g, a, b, sag, i / 48);
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
    ctx.fillStyle = hex(hanger);
    const n = Math.max(8, Math.round(Math.abs(b[0] - a[0]) / (g.U * 2.4)));
    for (let i = 1; i < n; i++) {
      const p = cablePoint(g, a, b, sag, i / n);
      const dy = hangerTo - p[1];
      if (dy > 0) ctx.fillRect(Math.round(p[0]), p[1], 1, dy);
      if (lights && i % 2 === 0) {
        ctx.fillStyle = '#e8c06a';
        ctx.fillRect(Math.round(p[0]) - 1, p[1], 2, 2);
        ctx.fillStyle = hex(hanger);
      }
    }
  }

  function paintBridge(ctx, g, sky) {
    const night = sky.night;
    const steel = mixColor(mixColor(rgb('#e9e4d6'), sky.amb, 0.3), rgb('#3a4058'), night * 0.75);
    const shade = mixColor(steel, rgb('#46506a'), 0.45);
    const cable = mixColor(steel, rgb('#5a6076'), 0.2);
    const hanger = mixColor(steel, rgb('#6a7088'), 0.4);
    const deckY = g.H * DECK;
    const topY = towerTopY(g);
    const t0 = g.W * TOWERS[0];
    const t1 = g.W * TOWERS[1];
    const lights = night > 0.35;
    // Cables between the towers, then the two side spans down to the islands.
    paintCableRun(ctx, g, [t0, topY], [t1, topY], g.H * 0.19, deckY, cable, hanger, lights);
    paintCableRun(ctx, g, [g.W * ANCHORS[0], deckY - g.H * 0.012], [t0, topY], g.H * 0.02, deckY, cable, hanger, lights);
    paintCableRun(ctx, g, [t1, topY], [g.W * ANCHORS[1], deckY - g.H * 0.012], g.H * 0.02, deckY, cable, hanger, lights);
    // Deck: a stiffening girder with a pale top edge.
    const girder = Math.max(2, g.U * 1.1);
    ctx.fillStyle = hex(mixColor(steel, rgb('#7a8096'), 0.35));
    ctx.fillRect(0, deckY, g.W, girder);
    ctx.fillStyle = hex(steel);
    ctx.fillRect(0, deckY - 1, g.W, 1);
    ctx.fillStyle = hex(shade);
    ctx.fillRect(0, deckY + girder, g.W, 1);
    for (const fx of TOWERS) paintTower(ctx, g, fx, steel, shade);
    // Red aircraft lamps at each tower top, steady.
    ctx.fillStyle = '#b8402c';
    for (const fx of TOWERS) {
      ctx.fillRect(g.W * fx - 1, topY - g.U * 0.9, 2, 2);
    }
    // Piers rising from the water under the towers.
    ctx.fillStyle = hex(mixColor(steel, rgb('#8a8678'), 0.5));
    for (const fx of TOWERS) {
      ctx.fillRect(g.W * fx - g.U * 2.8, deckY + girder, g.U * 5.6, g.H * HORIZON - deckY - girder + g.U * 0.8);
    }
  }

  // ---- sea ---------------------------------------------------------------

  function paintSea(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const y0 = g.H * HORIZON;
    const grad = ctx.createLinearGradient(0, y0, 0, g.H);
    const near = mixColor(mixColor(rgb('#4a7e90'), sky.amb, 0.1), rgb('#10182c'), sky.night * 0.75);
    const far = mixColor(sky.low, rgb('#7898a8'), 0.4);
    grad.addColorStop(0, hex(mixColor(far, sky.low, 0.4)));
    grad.addColorStop(1, hex(near));
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, g.W, g.H - y0);
    // Gentle ripple lines, longer and denser toward the viewer.
    for (let i = 0; i < g.H * 2.4; i++) {
      const k = Math.pow(rand(), 1.6);
      const y = y0 + k * (g.H - y0);
      const len = g.U * (1 + k * 6) * (0.4 + rand());
      ctx.globalAlpha = 0.1 + rand() * 0.14;
      ctx.fillStyle = rand() < 0.5 ? hex(mixColor(sky.low, rgb('#ffffff'), 0.4)) : hex(mixColor(near, rgb('#10182c'), 0.35));
      ctx.fillRect(rand() * g.W, y, len, 1);
    }
    ctx.globalAlpha = 1;
    // Soft bridge reflection below each tower.
    for (const fx of TOWERS) {
      const rg = ctx.createLinearGradient(0, y0, 0, y0 + g.H * 0.2);
      rg.addColorStop(0, 'rgba(236,230,214,0.28)');
      rg.addColorStop(1, 'rgba(236,230,214,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(g.W * fx - g.U * 2.4, y0, g.U * 4.8, g.H * 0.2);
    }
    return c;
  }

  // ---- near shore --------------------------------------------------------

  function paintPine(ctx, g, px, base, s, dark, lit) {
    ctx.fillStyle = hex(mixColor(dark, rgb('#3a2a20'), 0.5));
    ctx.fillRect(px - s * 0.12, base - s * 2.4, Math.max(1, s * 0.24), s * 2.4);
    // Layered flat canopies, the cloud-pruned look.
    const tiers = [[0.2, 1.1, 0.5], [1.0, 0.9, 0.45], [1.8, 0.7, 0.4]];
    for (const [dy, rw, rh] of tiers) {
      ctx.fillStyle = hex(dark);
      ctx.beginPath();
      ctx.ellipse(px, base - s * (1.6 + dy), s * rw, s * rh, 0, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = hex(lit);
      ctx.beginPath();
      ctx.ellipse(px - s * 0.12, base - s * (1.72 + dy), s * rw * 0.8, s * rh * 0.55, 0, 0, 6.3);
      ctx.fill();
    }
  }

  function paintTorii(ctx, g, px, base, s, night) {
    const red = mixColor(rgb('#c4452c'), rgb('#4a2a30'), night * 0.6);
    const ink = mixColor(rgb('#2a2a30'), rgb('#101218'), night * 0.5);
    const post = Math.max(2, s * 0.32);
    ctx.fillStyle = hex(red);
    ctx.fillRect(px - s * 1.5, base - s * 5.6, post, s * 5.6);
    ctx.fillRect(px + s * 1.5 - post, base - s * 5.6, post, s * 5.6);
    ctx.fillRect(px - s * 1.3, base - s * 4.3, s * 2.6, Math.max(1, s * 0.28));
    ctx.fillStyle = hex(ink);
    ctx.fillRect(px - s * 2.2, base - s * 6.1, s * 4.4, Math.max(2, s * 0.42));
    ctx.fillStyle = hex(red);
    ctx.fillRect(px - s * 1.9, base - s * 5.85, s * 3.8, Math.max(1, s * 0.3));
  }

  function paintShore(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const night = sky.night;
    const grass = mixColor(mixColor(rgb(MOSS), sky.amb, 0.2), rgb('#141c26'), night * 0.75);
    const grassDark = mixColor(mixColor(rgb(MOSS_DARK), sky.haze, 0.15), rgb('#0c1218'), night * 0.75);
    const rock = mixColor(mixColor(rgb('#6a6a64'), sky.amb, 0.25), rgb('#1a1e2a'), night * 0.75);
    // A bank rising from the lower-left, with rocks at its foot.
    for (let px = 0; px < g.W * 0.4; px++) {
      const fx = px / g.W;
      const edge = Math.max(0, 1 - fx / 0.4);
      const top = 0.74 + (1 - Math.pow(edge, 0.7)) * 0.26 - edge * 0.06 + (fbm(fx * 12, 6, 3, 8) - 0.5) * 0.02;
      const y0 = g.H * top;
      const grad = ctx.createLinearGradient(0, y0, 0, g.H);
      grad.addColorStop(0, hex(grass));
      grad.addColorStop(0.5, hex(grassDark));
      grad.addColorStop(1, hex(grassDark));
      ctx.fillStyle = grad;
      ctx.fillRect(px, y0, 1, g.H - y0);
    }
    ctx.fillStyle = hex(rock);
    for (let i = 0; i < 26; i++) {
      const px = rand() * g.W * 0.36;
      const edge = Math.max(0, 1 - px / g.W / 0.4);
      const top = 0.74 + (1 - Math.pow(edge, 0.7)) * 0.26 - edge * 0.06;
      ctx.beginPath();
      ctx.ellipse(px, g.H * top + g.U * 0.5, g.U * (0.9 + rand() * 1.4), g.U * (0.5 + rand() * 0.6), 0, 0, 6.3);
      ctx.fill();
    }
    // Torii standing in the shallows, then pines on the bank.
    paintTorii(ctx, g, g.W * 0.26, g.H * 0.8, g.U * 2.7, night);
    const trees = [[0.04, 0.86, 5.2], [0.11, 0.835, 4], [0.17, 0.805, 3.2], [0.22, 0.785, 2.4]];
    for (const [fx, fy, sz] of trees) {
      paintPine(ctx, g, g.W * fx, g.H * fy + g.U * 2, g.U * sz, grassDark, grass);
    }
    // Stone lantern beside the pines.
    ctx.fillStyle = hex(rock);
    const lx = g.W * 0.19;
    const ly = g.H * 0.85;
    ctx.fillRect(lx - g.U * 0.25, ly - g.U * 2, g.U * 0.5, g.U * 2);
    ctx.fillRect(lx - g.U * 0.8, ly - g.U * 2.9, g.U * 1.6, g.U * 0.9);
    ctx.fillRect(lx - g.U * 1.1, ly - g.U * 3.3, g.U * 2.2, g.U * 0.5);
    if (night > 0.3) {
      ctx.fillStyle = '#e8c06a';
      ctx.fillRect(lx - g.U * 0.3, ly - g.U * 2.6, g.U * 0.6, g.U * 0.5);
    }
    return c;
  }

  // ---- boats -------------------------------------------------------------

  function paintBoat(g, kind, night) {
    const big = kind === 'ferry';
    const w = Math.max(8, Math.round(g.U * (big ? 9 : 5)));
    const h = Math.max(5, Math.round(g.U * (big ? 3.4 : 2.4)));
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const hull = mixColor(rgb('#2a3040'), rgb('#101420'), night * 0.5);
    ctx.fillStyle = hex(hull);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.55);
    ctx.lineTo(w, h * 0.55);
    ctx.lineTo(w * 0.9, h);
    ctx.lineTo(w * 0.1, h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b8412c';
    ctx.fillRect(w * 0.08, h * 0.6, w * 0.84, Math.max(1, h * 0.12));
    ctx.fillStyle = hex(mixColor(rgb('#ece6d6'), rgb('#9aa0b4'), night * 0.5));
    if (big) {
      ctx.fillRect(w * 0.2, h * 0.2, w * 0.5, h * 0.35);
      ctx.fillRect(w * 0.35, 0, w * 0.22, h * 0.25);
    } else {
      ctx.fillRect(w * 0.55, h * 0.15, w * 0.22, h * 0.42);
    }
    if (night > 0.3) {
      ctx.fillStyle = '#e8c06a';
      ctx.fillRect(w * 0.3, h * 0.28, Math.max(1, w * 0.3), Math.max(1, h * 0.12));
    }
    return c;
  }

  function drawBoats(ctx, g, t) {
    for (let i = 0; i < BOATS.length; i++) {
      const b = BOATS[i];
      const art = state.boats[i];
      const span = g.W + art.width * 2;
      const run = (b.phase + t * b.speed * (1 + b.y)) % 1;
      const px = (b.dir > 0 ? run : 1 - run) * span - art.width;
      const bob = Math.sin(t * 1.3 + i * 2) * g.U * 0.12;
      const y = g.H * b.y + bob;
      // Faint dark water under the hull, then a short white wake behind it.
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#10182c';
      ctx.fillRect(px, y + art.height * 0.95, art.width, 1);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#f0ede2';
      const wl = art.width * (0.9 + 0.2 * Math.sin(t * 2 + i));
      const wx = b.dir > 0 ? px - wl : px + art.width;
      ctx.fillRect(wx, y + art.height * 0.9, wl, 1);
      ctx.fillRect(wx + (b.dir > 0 ? wl * 0.2 : 0), y + art.height * 1.15, wl * 0.8, 1);
      ctx.globalAlpha = 1;
      ctx.drawImage(art, px, y);
    }
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(41);
    state.sky = paintSky(g, sky, rand);
    const mid = layer(g.W, g.H);
    const ctx = mid.getContext('2d');
    paintFarIslands(ctx, g, sky);
    paintBridgeIslands(ctx, g, sky, rand);
    state.mid = mid;
    state.sea = paintSea(g, sky, rand);
    const bridge = layer(g.W, g.H);
    paintBridge(bridge.getContext('2d'), g, sky);
    state.bridge = bridge;
    state.shore = paintShore(g, sky, rand);
    state.boats = BOATS.map((b) => paintBoat(g, b.kind, sky.night));
    state.cloudAlpha = 0.7 - sky.night * 0.45;
    state.glintTint = state.night ? '#dfe0ea' : '#fff6dc';
    state.glintGain = 0.55 - sky.night * 0.2;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.clouds;
    const off = -((t * g.U * 1.4) % c.width);
    ctx.globalAlpha = Math.min(1, state.cloudAlpha * amount);
    ctx.drawImage(c, off, g.H * 0.05);
    ctx.drawImage(c, off + c.width, g.H * 0.05);
    ctx.globalAlpha = 1;
  }

  // Slow glints on the water, brightest near the sun or moon.
  function drawGlints(ctx, g, t) {
    const gl = state.glints;
    ctx.fillStyle = state.glintTint;
    for (let i = 0; i < GLINTS; i++) {
      const wave = Math.sin(t * gl.rate[i] + gl.phase[i]);
      if (wave < 0.2) continue;
      const k = gl.depth[i];
      const near = 1 - Math.min(1, Math.abs(gl.x[i] - state.bodyX / g.W) * 3);
      ctx.globalAlpha = (wave - 0.2) * state.glintGain * (0.25 + near * 0.75);
      ctx.fillRect(gl.x[i] * g.W, g.H * (HORIZON + 0.01 + k * (1 - HORIZON - 0.02)), 1 + k * g.U * 2.5, 1);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.clouds = paintClouds(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.3));
    const rand = K.rng(77);
    state.glints = {
      x: new Float32Array(GLINTS),
      depth: new Float32Array(GLINTS),
      phase: new Float32Array(GLINTS),
      rate: new Float32Array(GLINTS),
    };
    for (let i = 0; i < GLINTS; i++) {
      state.glints.x[i] = rand();
      state.glints.depth[i] = Math.pow(rand(), 1.4);
      state.glints.phase[i] = rand() * 6.3;
      state.glints.rate[i] = 0.5 + rand() * 1.1;
    }
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t, props.clouds);
    ctx.drawImage(state.mid, 0, 0);
    ctx.drawImage(state.sea, 0, 0);
    drawGlints(ctx, g, t);
    ctx.drawImage(state.bridge, 0, 0);
    if (props.boats) drawBoats(ctx, g, t);
    ctx.drawImage(state.shore, 0, 0);
  }

  Kasuri.run({
    defaults: { time: 'auto', clouds: 1, boats: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
