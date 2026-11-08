/*
 * 虹 Niji — a faint rainbow over a wet green valley, just after the rain.
 *
 * Sky, storm, bow and land are baked once in a few flat tones. The land is
 * baked twice, dull and sunlit, and moving patches cut the sunlit copy through
 * a stencil. Rain, mist wisps and grass are short strokes from arrays filled in setup.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const SKY = ['#80a0b9', '#8fadc0', '#a1b9c4', '#b5c7c7', '#cad3c6'];
  const STORM = ['#7d8ca2', '#6a768f', '#58627d'];
  const BOW = ['#c27560', '#cc9d66', '#d5c482', '#90ae7e', '#7398ae', '#887ea3'];
  const DULL = {
    far: '#8299a6', mid: '#6a8a74', hillL: '#5b7e5e', hillR: '#6a915a',
    wood: ['#46664b', '#5a8055', '#72975e'], fields: ['#86a85c', '#94b062', '#79995a', '#a8b86c'],
    water: '#a6bcb8', ridge: '#5b7649', wall: '#d6cfba', roof: '#434b5e', thatch: '#8f7c52',
  };
  const SUNNY = {
    far: '#8ba2ab', mid: '#738f72', hillL: '#648c5c', hillR: '#79a45c',
    wood: ['#4a6c49', '#68914f', '#8ab05e'], fields: ['#9cbf62', '#abc56a', '#8db45c', '#c5c878'],
    water: '#d2ded8', ridge: '#71904f', wall: '#f2ead2', roof: '#4d566a', thatch: '#b59d62',
  };
  const LEAN = 0.2;
  const MAX_DROPS = 320;
  const PATCHES = [0.53, 0.6, 0.67, 0.74, 0.81, 0.88];
  const WOODS = [0.06, 0.17, 0.29, 0.4, 0.66, 0.78, 0.9];
  const WISP_POINTS = 8;
  const STEMS = 18;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Where the rain front stands at height y: billowing cloud above, a leaning curtain below.
  function stormEdge(g, y) {
    const v = y / g.H;
    const base = g.W * 0.52 - (v - 0.2) * g.H * 0.3;
    const puff = Math.abs(Math.sin(y / (g.U * 5))) * g.U * 7 * (1 - smoothstep(0.1, 0.4, v));
    return base + puff + (fbm(y / g.U * 0.06, 3.1, 3, 5) - 0.5) * g.U * 8;
  }

  function stormPath(ctx, g, grow) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let y = 0; y <= g.H; y += 1) ctx.lineTo(stormEdge(g, y) + grow, y);
    ctx.lineTo(0, g.H);
    ctx.closePath();
  }

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = SKY[0];
    ctx.fillRect(0, 0, g.W, g.H);
    const radii = [1.75, 1.4, 1.08, 0.78];
    for (let i = 0; i < radii.length; i++) {
      ctx.fillStyle = SKY[i + 1];
      ctx.beginPath();
      ctx.arc(g.W * 1.08, -g.H * 0.3, g.H * radii[i], 0, 6.3);
      ctx.fill();
    }
    return c;
  }

  function paintStorm(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintRim(ctx, g);
    const grows = [g.U * 6, g.U * 3, 0];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = STORM[i];
      stormPath(ctx, g, grows[i]);
      ctx.fill();
    }
    ctx.save();
    stormPath(ctx, g, 0);
    ctx.clip();
    paintShafts(ctx, g, rand);
    paintCloudBase(ctx, g, rand);
    ctx.restore();
    return c;
  }

  // The sun catches the tops of the storm on its right flank.
  function paintRim(ctx, g) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(g.W, 0);
    ctx.lineTo(g.W, g.H * 0.04);
    ctx.lineTo(0, g.H * 0.5);
    ctx.clip();
    ctx.fillStyle = '#cfccbd';
    stormPath(ctx, g, g.U * 12);
    ctx.fill();
    ctx.fillStyle = '#a9b0b6';
    stormPath(ctx, g, g.U * 9);
    ctx.fill();
    ctx.restore();
  }

  // Rain shafts under the cloud base: long leaning strokes in two close tones.
  function paintShafts(ctx, g, rand) {
    const top = g.H * 0.28;
    const count = Math.ceil(g.W / (g.U * 3));
    for (let i = 0; i < count; i++) {
      const x = rand() * (g.W * 0.8);
      ctx.strokeStyle = rand() < 0.5 ? '#4b546d' : '#67718b';
      ctx.lineWidth = g.U * (0.8 + rand() * 2.4);
      ctx.beginPath();
      ctx.moveTo(x, top + rand() * g.U * 6);
      ctx.lineTo(x - g.H * LEAN, g.H);
      ctx.stroke();
    }
  }

  function paintCloudBase(ctx, g, rand) {
    const tones = ['#4a5269', '#5d667f', '#666f88'];
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = tones[k];
      const n = Math.ceil(g.W / (g.U * 5));
      for (let i = 0; i < n; i++) {
        const x = (i / n) * g.W * 0.7 + rand() * g.U * 3;
        const y = g.H * (0.2 + k * 0.035) + (rand() - 0.5) * g.U * 4 - x * 0.04;
        const r = g.U * (3 + rand() * 4) * (1 - k * 0.2);
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.6, r * 0.7, 0, 0, 6.3);
        ctx.fill();
      }
    }
  }

  function bowGeometry(g) {
    const R = Math.min(g.W * 0.44, g.H * 0.6);
    return { cx: g.W * 0.5, cy: g.H * 0.76, R, band: R * 0.11 };
  }

  function arcs(ctx, b, radius, colours, width, alpha) {
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width + 0.6;
    for (let i = 0; i < colours.length; i++) {
      ctx.strokeStyle = colours[i];
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, radius - (i + 0.5) * width, Math.PI, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Strong where rain stands behind it, a ghost against the clear sky.
  function paintBow(g) {
    const b = state.bow;
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const w = b.band / BOW.length;
    arcs(ctx, b, b.R, BOW, w, 0.42);
    const steps = [[g.U * 6, 0.16], [g.U * 3, 0.2], [0, 0.24]];
    for (const [grow, alpha] of steps) {
      ctx.save();
      stormPath(ctx, g, grow);
      ctx.clip();
      arcs(ctx, b, b.R, BOW, w, alpha);
      arcs(ctx, b, b.R * 1.3, BOW.slice().reverse(), w * 0.9, alpha * 0.3);
      ctx.globalAlpha = alpha * 0.45;
      ctx.fillStyle = '#9aa4b8';
      ctx.beginPath();
      ctx.arc(b.cx, b.cy, b.R - b.band, 0, 6.3);
      ctx.fill();
      ctx.restore();
    }
    return c;
  }

  // Cumulus on the clear side, two flat tones, half size, tiling sideways.
  function paintClouds(g) {
    const w = Math.ceil(g.W * 0.75);
    const h = Math.ceil(g.H * 0.18);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const k = 2 / g.U;
    const n = (x, y) => fbm(x * k * 0.03, y * k * 0.07, 4, 71);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI) * (0.7 + 0.3 * (y / h));
      for (let x = 0; x < w; x++) {
        const v = lerp(n(x, y), n(x - w, y), x / w) * band;
        const i = (y * w + x) * 4;
        const lit = v > 0.47;
        img.data[i] = lit ? 242 : 214;
        img.data[i + 1] = lit ? 236 : 218;
        img.data[i + 2] = lit ? 218 : 208;
        img.data[i + 3] = v > 0.4 ? 255 : 0;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function hillL(g, x) {
    const n = fbm(x / g.U * 0.04, 1.7, 3, 23) - 0.5;
    return g.H * (0.53 + 0.15 * smoothstep(0, g.W * 0.5, x)) + n * g.U * 8;
  }

  function hillR(g, x) {
    const n = fbm(x / g.U * 0.04, 4.2, 3, 29) - 0.5;
    return g.H * (0.68 - 0.15 * smoothstep(g.W * 0.55, g.W, x)) + n * g.U * 8;
  }

  function valleyTop(g, x) {
    const f = x / g.W;
    const left = Math.pow(1 - smoothstep(0, 0.48, f), 1.4) * 0.17;
    return g.H * (0.665 + left + smoothstep(0.66, 1, f) * 0.11);
  }

  function fillProfile(ctx, g, x0, x1, top, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x0, g.H);
    for (let x = x0; x <= x1 + 1; x += 1) ctx.lineTo(x, top(g, x));
    ctx.lineTo(x1, g.H);
    ctx.fill();
  }

  function paintRidges(ctx, g, tones) {
    const far = (gg, x) => g.H * 0.58 - fbm(x / g.U * 0.025, 0.5, 4, 3) * g.U * 14;
    const mid = (gg, x) => g.H * 0.64 - fbm(x / g.U * 0.04, 2.5, 4, 8) * g.U * 9;
    fillProfile(ctx, g, 0, g.W, far, tones.far);
    fillProfile(ctx, g, 0, g.W, mid, tones.mid);
    fillProfile(ctx, g, 0, g.W * 0.56, hillL, tones.hillL);
    fillProfile(ctx, g, g.W * 0.5, g.W, hillR, tones.hillR);
  }

  function tree(ctx, g, x, y, r, tones, light) {
    ctx.fillStyle = tones[0];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = tones[light ? 2 : 1];
    ctx.beginPath();
    ctx.arc(x + r * 0.3, y - r * 0.35, r * 0.58, 0, 6.3);
    ctx.fill();
  }

  // Each wood is a clustered mass of crowns with a few cedar spires on top.
  function paintWood(ctx, g, rand, fx, tones) {
    const x0 = g.W * fx;
    const top = fx < 0.5 ? hillL : hillR;
    const span = g.U * (12 + rand() * 8);
    const count = Math.ceil(span * 2.2);
    for (let i = 0; i < count; i++) {
      const x = x0 + (rand() - 0.5) * span * (0.6 + rand() * 0.6);
      const y = top(g, x) + g.U * (1.5 + rand() * 9);
      tree(ctx, g, x, y, g.U * (0.9 + rand() * 1.6), tones.wood, x > g.W * 0.45);
    }
    ctx.fillStyle = tones.wood[0];
    for (let i = 0; i < 5; i++) {
      const x = x0 + (rand() - 0.5) * span;
      const y = top(g, x) + g.U * 2;
      const tall = g.U * (4 + rand() * 4);
      ctx.beginPath();
      ctx.moveTo(x - g.U * 1.1, y);
      ctx.lineTo(x, y - tall);
      ctx.lineTo(x + g.U * 1.1, y);
      ctx.fill();
    }
  }

  function fieldPoint(g, u, v) {
    const y = g.H * lerp(0.655, 0.97, Math.pow(v, 1.5));
    return [g.W * 0.58 + u * g.W * (0.1 + v * 0.75), y];
  }

  function paintPatch(ctx, g, rand, tones, u0, u1, v0, v1) {
    const pts = [fieldPoint(g, u0, v0), fieldPoint(g, u1, v0), fieldPoint(g, u1, v1), fieldPoint(g, u0, v1)];
    const pick = rand();
    ctx.fillStyle = pick < 0.08 ? tones.water : tones.fields[Math.floor(rand() * tones.fields.length)];
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function paintFields(ctx, g, rand, tones) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 1; x += 1) ctx.lineTo(x, valleyTop(g, x));
    ctx.lineTo(g.W, g.H);
    ctx.clip();
    ctx.strokeStyle = tones.ridge;
    ctx.lineWidth = Math.max(0.6, g.U * 0.35);
    const rows = 14;
    for (let r = 0; r < rows; r++) {
      let u = -2 - rand() * 0.1;
      while (u < 2) {
        const next = u + 0.06 + rand() * 0.12;
        paintPatch(ctx, g, rand, tones, u, next, r / rows, (r + 1) / rows);
        u = next;
      }
    }
    ctx.restore();
  }

  // A pale stream from the village out to the near left, widening as it comes.
  function paintStream(ctx, g, tones) {
    ctx.strokeStyle = tones.water;
    ctx.lineCap = 'round';
    const n = 30;
    let px = g.W * 0.55;
    let py = g.H * 0.69;
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      const x = g.W * (0.55 - Math.pow(f, 1.1) * 0.4) + Math.sin(f * 7) * g.U * lerp(1, 8, f);
      const y = g.H * (0.69 + Math.pow(f, 1.3) * 0.24);
      ctx.lineWidth = Math.max(1, g.U * lerp(0.6, 3.2, f));
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
      px = x;
      py = y;
    }
  }

  function house(ctx, g, h, tones) {
    const w = h.w;
    ctx.fillStyle = tones.wall;
    ctx.fillRect(h.x - w * 0.42, h.y - w * 0.44, w * 0.84, w * 0.44);
    ctx.fillStyle = '#4a3e33';
    ctx.fillRect(h.x - w * 0.12, h.y - w * 0.28, w * 0.24, w * 0.28);
    ctx.fillStyle = h.thatch ? tones.thatch : tones.roof;
    ctx.beginPath();
    ctx.moveTo(h.x - w * 0.58, h.y - w * 0.4);
    ctx.lineTo(h.x - w * (h.thatch ? 0.08 : 0.28), h.y - w * (h.thatch ? 0.98 : 0.78));
    ctx.lineTo(h.x + w * (h.thatch ? 0.08 : 0.28), h.y - w * (h.thatch ? 0.98 : 0.78));
    ctx.lineTo(h.x + w * 0.58, h.y - w * 0.4);
    ctx.fill();
  }

  function torii(ctx, g, x, y) {
    const u = g.U;
    ctx.fillStyle = '#b5483a';
    ctx.fillRect(x - u * 2.6, y - u * 6, u * 0.8, u * 6);
    ctx.fillRect(x + u * 1.8, y - u * 6, u * 0.8, u * 6);
    ctx.fillRect(x - u * 3.6, y - u * 6.8, u * 7.2, u * 1);
    ctx.fillRect(x - u * 2.8, y - u * 5.2, u * 5.6, u * 0.6);
  }

  function paintVillage(ctx, g, rand, tones) {
    const cx = g.W * 0.585;
    const grove = tones.wood;
    for (let i = 0; i < 22; i++) {
      const x = cx + (rand() - 0.5) * g.U * 44;
      tree(ctx, g, x, g.H * 0.664 + rand() * g.U * 2, g.U * (1 + rand() * 1.4), grove, true);
    }
    const homes = [];
    for (let i = 0; i < 16; i++) {
      const d = rand();
      homes.push({
        x: cx + (rand() - 0.5) * g.U * (22 + d * 18),
        y: g.H * 0.672 + d * g.U * 5.5,
        w: g.U * (4.6 + rand() * 1.8 + d * 1.6),
        thatch: rand() < 0.3,
      });
    }
    homes.sort((a, b) => a.y - b.y);
    for (const h of homes) house(ctx, g, h, tones);
    torii(ctx, g, cx - g.U * 21, g.H * 0.712);
    for (let i = 0; i < 6; i++) {
      const x = cx + (rand() - 0.5) * g.U * 36;
      tree(ctx, g, x, g.H * 0.725 + rand() * g.U * 1.5, g.U * (0.9 + rand()), grove, true);
    }
  }

  // The rain side of the land sits in the storm's shadow.
  function dimRainSide(ctx, g) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(60,70,96,0.16)';
    stormPath(ctx, g, g.U * 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(60,70,96,0.18)';
    stormPath(ctx, g, -g.U * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  function paintLand(g, seed, tones) {
    const rand = K.rng(seed);
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintRidges(ctx, g, tones);
    for (const fx of WOODS) paintWood(ctx, g, rand, fx, tones);
    paintFields(ctx, g, rand, tones);
    paintStream(ctx, g, tones);
    paintVillage(ctx, g, rand, tones);
    dimRainSide(ctx, g);
    return c;
  }

  function nearTop(g, x) {
    const f = x / g.W;
    const rise = (1 - smoothstep(0, 0.4, f)) * 0.07 + smoothstep(0.72, 1, f) * 0.06;
    return g.H * (0.93 - rise) - (fbm(x / g.U * 0.05, 11, 3, 53) - 0.5) * g.U * 4;
  }

  function paintNear(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    fillProfile(ctx, g, 0, g.W, nearTop, '#4b6b48');
    ctx.globalCompositeOperation = 'source-atop';
    const tones = ['#6b9152', '#3c5a40', '#82a75c'];
    const marks = Math.floor(g.W * g.H * 0.05);
    for (let i = 0; i < marks; i++) {
      ctx.fillStyle = tones[Math.floor(rand() * tones.length)];
      ctx.fillRect(rand() * g.W, g.H * (0.84 + rand() * 0.16), Math.max(1, g.U * 0.4), g.U * (0.8 + rand() * 1.8));
    }
    ctx.fillStyle = 'rgba(60,70,96,0.25)';
    stormPath(ctx, g, -g.U * 6);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  // Bright patch with a stepped edge, used as a stencil for the sunlit land.
  function paintPatchSprite() {
    const c = layer(64, 20);
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(32, 10, 31, 9.5, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(32, 10, 24, 6.5, 0, 0, 6.3);
    ctx.fill();
    return c;
  }

  // Mist lying along the feet of the hills: half size, two alpha steps, tiling.
  function paintMist(g) {
    const w = Math.ceil(g.W * 0.75);
    const h = Math.ceil(g.H * 0.07);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const k = 2 / g.U;
    const n = (x, y) => fbm(x * k * 0.05, y * k * 0.2, 4, 43);
    for (let y = 0; y < h; y++) {
      const band = Math.sin(((y + 0.5) / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(n(x, y), n(x - w, y), x / w) * band;
        const i = (y * w + x) * 4;
        img.data[i] = 228;
        img.data[i + 1] = 231;
        img.data[i + 2] = 222;
        img.data[i + 3] = v > 0.56 ? 110 : v > 0.47 ? 50 : 0;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function makePatches(g, rand) {
    return PATCHES.map((fy) => {
      const w = g.U * lerp(26, 64, (fy - 0.5) / 0.4);
      return { y: g.H * fy, w, h: w * 0.24, x: rand() * (g.W + w * 2) - w, rate: g.U * (1.2 + rand() * 0.8) };
    });
  }

  function makeRain(g, rand) {
    const n = Math.min(MAX_DROPS, Math.floor(g.W * g.H * 0.009));
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);
    const rate = new Float32Array(n);
    const reach = g.W * 0.62 + g.H * LEAN;
    for (let i = 0; i < n; i++) {
      xs[i] = rand() * reach;
      ys[i] = rand();
      rate[i] = 0.45 + rand() * 0.3;
    }
    const edge = new Float32Array(Math.ceil(g.H) + 2);
    for (let y = 0; y < edge.length; y++) edge[y] = stormEdge(g, y);
    return { n, xs, ys, rate, edge, top: g.H * 0.26, span: g.H * 0.52, len: g.U * 2.8 };
  }

  function makeWisps(g, rand) {
    const list = [];
    for (const fx of WOODS) {
      for (let i = 0; i < 2; i++) {
        const x = g.W * fx + (rand() - 0.5) * g.U * 14;
        const top = fx < 0.5 ? hillL(g, x) : hillR(g, x);
        list.push({
          x, y: top + g.U * (4 + rand() * 5),
          rise: g.U * (10 + rand() * 10), wobble: g.U * (1.5 + rand() * 2.5),
          phase: rand() * 6.28, rate: 0.03 + rand() * 0.03, start: rand(),
        });
      }
    }
    return list;
  }

  function makeStems(g, rand) {
    const list = [];
    for (let i = 0; i < STEMS; i++) {
      const x = (i < STEMS / 2 ? rand() * 0.22 : 0.8 + rand() * 0.2) * g.W;
      list.push({
        x, y: g.H + g.U * 2, h: (g.H - nearTop(g, x)) + g.U * (4 + rand() * 8),
        lean: g.U * (rand() * 5 - 2.5), phase: rand() * 6.28, rate: 0.45 + rand() * 0.35,
      });
    }
    return list;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.bow = bowGeometry(g);
    state.sky = paintSky(g);
    state.clouds = paintClouds(g);
    state.storm = paintStorm(g, rand);
    state.rainbow = paintBow(g);
    state.dull = paintLand(g, 7, DULL);
    state.sunny = paintLand(g, 7, SUNNY);
    state.near = paintNear(g, rand);
    state.mist = paintMist(g);
    state.sprite = paintPatchSprite();
    state.patches = makePatches(g, rand);
    state.drops = makeRain(g, rand);
    state.wisps = makeWisps(g, rand);
    state.stems = makeStems(g, rand);
    state.scratch = layer(g.W, g.H);
    state.sctx = state.scratch.getContext('2d');
  }

  function slide(ctx, tile, offset, y, scale) {
    const w = tile.width * scale;
    const x = -(((offset % w) + w) % w);
    ctx.drawImage(tile, x, y, w, tile.height * scale);
    ctx.drawImage(tile, x + w - 1, y, w, tile.height * scale);
    if (x + w * 2 < state.g.W) ctx.drawImage(tile, x + w * 2 - 2, y, w, tile.height * scale);
  }

  function drawSunPatches(ctx, g, t) {
    const s = state.sctx;
    s.globalCompositeOperation = 'source-over';
    s.clearRect(0, 0, g.W, g.H);
    for (const p of state.patches) {
      const span = g.W + p.w * 2;
      const x = g.W + p.w - ((p.x + t * p.rate) % span);
      s.drawImage(state.sprite, x - p.w / 2, p.y - p.h / 2, p.w, p.h);
    }
    s.globalCompositeOperation = 'source-in';
    s.drawImage(state.sunny, 0, 0);
    ctx.drawImage(state.scratch, 0, 0);
  }

  function drawRain(ctx, g, t, amount) {
    if (amount <= 0) return;
    const d = state.drops;
    const count = Math.floor(Math.min(1, amount * 0.6) * d.n);
    ctx.strokeStyle = '#bcc6d4';
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    ctx.globalAlpha = Math.min(0.85, 0.35 + amount * 0.15);
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const f = (d.ys[i] + t * d.rate[i]) % 1;
      const y = d.top + f * d.span;
      const x = d.xs[i] - f * d.span * LEAN;
      if (x > d.edge[y | 0]) continue;
      ctx.moveTo(x, y);
      ctx.lineTo(x - d.len * LEAN, y + d.len);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawWisp(ctx, g, w, t, amount) {
    const life = (t * w.rate + w.start) % 1;
    const fade = Math.sin(life * Math.PI);
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = Math.min(1, fade * amount * (pass ? 0.28 : 0.15));
      ctx.lineWidth = Math.max(1, g.U * (pass ? 1.2 : 3.2));
      ctx.beginPath();
      for (let k = 0; k <= WISP_POINTS; k++) {
        const f = k / WISP_POINTS;
        const rise = (life * 0.5 + f * 0.5) * w.rise;
        const x = w.x + Math.sin(f * 3.4 + t * 0.25 + w.phase) * f * w.wobble + rise * 0.2;
        if (k === 0) ctx.moveTo(x, w.y - rise);
        else ctx.lineTo(x, w.y - rise);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawStems(ctx, g, t) {
    ctx.strokeStyle = '#7d9c58';
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    ctx.beginPath();
    for (const s of state.stems) {
      const sway = Math.sin(t * s.rate + s.phase) * g.U * 1.4;
      ctx.moveTo(s.x, s.y);
      ctx.quadraticCurveTo(s.x + s.lean * 0.2, s.y - s.h * 0.6, s.x + s.lean + sway, s.y - s.h);
    }
    ctx.stroke();
    ctx.strokeStyle = '#cdbd88';
    ctx.lineWidth = Math.max(1, g.U * 0.9);
    ctx.beginPath();
    for (const s of state.stems) {
      const sway = Math.sin(t * s.rate + s.phase) * g.U * 1.4;
      const tx = s.x + s.lean + sway;
      const ty = s.y - s.h;
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + g.U * 1.4 + sway * 0.4, ty + g.U * 3);
    }
    ctx.stroke();
  }

  function drawBow(ctx, amount) {
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.min(1, amount);
    ctx.drawImage(state.rainbow, 0, 0);
    if (amount > 1) {
      ctx.globalAlpha = Math.min(1, amount - 1);
      ctx.drawImage(state.rainbow, 0, 0);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const p = api.props;
    ctx.drawImage(state.sky, 0, 0);
    slide(ctx, state.clouds, t * g.U * 0.6, g.H * 0.03, 2);
    ctx.drawImage(state.storm, 0, 0);
    drawBow(ctx, p.bow);
    ctx.drawImage(state.dull, 0, 0);
    drawSunPatches(ctx, g, t);
    drawRain(ctx, g, t, p.rain);
    ctx.globalAlpha = Math.min(1, p.mist * 0.85);
    slide(ctx, state.mist, t * g.U * 0.5, g.H * 0.57, 2);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#e6e8de';
    ctx.lineCap = 'round';
    for (const w of state.wisps) drawWisp(ctx, g, w, t, p.mist);
    ctx.drawImage(state.near, 0, 0);
    drawStems(ctx, g, t);
  }

  Kasuri.run({
    defaults: { bow: 1, rain: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1.05, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
