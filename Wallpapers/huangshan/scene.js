/*
 * 黄山 Huangshan — twisted pines on granite spires above a sea of cloud.
 *
 * Sky, three ranks of spires and the pines are baked into layers and repainted
 * once a minute from the clock. Between repaints only the billowing cloud sea
 * and the mist ribbons slide sideways.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep, clamp } = K;

  const RETINT_SECONDS = 60;
  const state = {};

  // Spire clusters per rank: centre x, top y of the tallest, spread, count.
  // Each cluster becomes several thin, flat-sided granite columns.
  const FAR = [
    { c: 0.06, t: 0.42, s: 0.05, n: 3 }, { c: 0.27, t: 0.36, s: 0.05, n: 4 },
    { c: 0.5, t: 0.44, s: 0.06, n: 3 }, { c: 0.7, t: 0.33, s: 0.05, n: 4 },
    { c: 0.92, t: 0.4, s: 0.06, n: 3 },
  ];
  const MID = [
    { c: 0.38, t: 0.24, s: 0.06, n: 4 }, { c: 0.6, t: 0.3, s: 0.05, n: 3 },
    { c: 0.08, t: 0.4, s: 0.04, n: 2 }, { c: 0.95, t: 0.36, s: 0.04, n: 3 },
  ];
  const NEAR = [
    { c: 0.14, t: 0.14, s: 0.07, n: 5 }, { c: 0.83, t: 0.2, s: 0.07, n: 5 },
  ];

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  // ---- spires ------------------------------------------------------------

  // Expand clusters into individual columns with deterministic jitter.
  function spires(clusters, seed, wMin, wMax) {
    const rand = K.rng(seed);
    const out = [];
    for (const cl of clusters) {
      for (let i = 0; i < cl.n; i++) {
        const lead = i === 0;
        const off = lead ? 0 : (rand() - 0.5) * 2 * cl.s;
        const drop = lead ? 0 : 0.04 + rand() * 0.14;
        out.push({
          c: cl.c + off,
          t: cl.t + drop,
          w: lerp(wMin, wMax, rand()),
          split: rand() < 0.5 ? 0.3 + rand() * 0.4 : 0,
        });
      }
    }
    return out;
  }

  // Column tops plus, per column, where it sits across its spire (-1 left .. 1 right).
  function makeRidge(g, peaks, seed, jag) {
    const tops = new Float32Array(g.W);
    const across = new Float32Array(g.W);
    const base = g.H * 1.02;
    for (let x = 0; x < g.W; x++) {
      let best = base;
      let u = 0;
      for (const p of peaks) {
        const d = (x / g.W - p.c) / p.w;
        const ad = Math.abs(d);
        if (ad >= 1) continue;
        const pw = p.w * g.W;
        // A blunt rounded cap on near-vertical flanks that widen toward the base.
        const capW = 0.45;
        let top = g.H * p.t;
        if (ad < capW) top += Math.pow(ad / capW, 2) * pw * 0.35;
        else top += pw * 0.35 + ((ad - capW) / (1 - capW)) * g.H * 0.55;
        if (p.split && ad < capW) top += Math.max(0, 1 - Math.abs(d - (p.split - 0.5) * 0.6) * 9) * pw * 0.6;
        if (top < best) { best = top; u = d; }
      }
      const n = (fbm(x * 0.15, 0.5, 3, seed) - 0.5) * g.U * jag;
      tops[x] = best < base - 1 ? best + n : base;
      across[x] = u;
    }
    return { tops, across };
  }

  function paintRock(ctx, g, sky, ridge, o) {
    const img = ctx.getImageData(0, 0, g.W, g.H);
    const d = img.data;
    const rock = mixColor(mixColor(rgb(o.rock), sky.amb, 0.2), rgb('#151a2e'), sky.night * 0.65);
    const haze = mixColor(sky.haze, sky.low, 0.3);
    const period = g.U * o.ledge;
    const { tops, across } = ridge;
    for (let x = 0; x < g.W; x++) {
      const top0 = tops[x];
      if (top0 >= g.H) continue;
      const top = Math.max(0, Math.floor(top0));
      const u = across[x];
      // Lit from the upper left: rounded column shading, dark right flank.
      const side = clamp(1.02 - u * 0.35, 0.6, 1.15);
      const warp = fbm(x * 0.04, 1.3, 2, o.seed) * period * 2;
      const joint = fbm(x * 0.35, 7.1, 2, o.seed + 9);
      for (let y = top; y < g.H; y++) {
        const depth = (y - top0) / (g.H * 0.4);
        // Horizontal ledges: thin dark joint line, a lit lip just above it.
        const yy = (y + warp + fbm(x * 0.05, y * 0.04, 2, o.seed + 7) * period * 2.5) / period;
        const ph = yy % 1;
        const open = fbm(x * 0.12, Math.floor(yy) * 3.7, 2, o.seed + 1) > 0.48;
        const ledge = !open ? 1 : ph < 0.12 ? 0.62 : ph > 0.86 ? 1.06 : 1;
        // Sparse vertical joints broken into blocks.
        const vj = joint > 0.66 && fbm(x * 0.2, y * 0.06, 2, o.seed + 3) > 0.5 ? 0.8 : 1;
        const grain = 0.9 + fbm(x * 0.3, y * 0.3, 2, o.seed + 5) * 0.2;
        const cap = y - top0 < g.U * 0.8 ? 1.06 : 1;
        const k = side * ledge * vj * grain * cap;
        const c = mixColor(rock, haze, clamp(o.fade + smoothstep(0, 1.1, depth) * o.fog, 0, 1));
        const i = (y * g.W + x) * 4;
        d[i] = c[0] * k;
        d[i + 1] = c[1] * k;
        d[i + 2] = c[2] * k;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // ---- pines -------------------------------------------------------------

  // A Huangshan pine: trunk springs from the rock edge, leans out over the drop,
  // and carries flat, layered pads of needles.
  function paintPine(ctx, x, y, s, dir, leaf, leafLit, bark) {
    ctx.strokeStyle = bark;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, s * 0.45);
    const ex = x + dir * s * 4.5;
    const ey = y - s * 3.2;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.6);
    ctx.bezierCurveTo(x + dir * s * 1.8, y + s * 0.2, x + dir * s * 1.2, y - s * 2.6, ex, ey);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, s * 0.25);
    const pads = [
      [0.35, 1.2, 2.6], [0.6, 2.4, 2.2], [0.85, 3.2, 2.6], [1, 3.4, 1.8],
    ];
    for (const [t, lift, len] of pads) {
      const bx = lerp(x, ex, t);
      const by = lerp(y, ey, t) - s * 0.2;
      const px = bx + dir * s * len * 0.6;
      const py = by - s * (lift * 0.15);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.fillStyle = leaf;
      ctx.beginPath();
      ctx.ellipse(px, py, s * len * 0.75, s * 0.42, 0, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = leafLit;
      ctx.beginPath();
      ctx.ellipse(px - s * 0.3, py - s * 0.2, s * len * 0.5, s * 0.18, 0, 0, 6.3);
      ctx.fill();
    }
  }

  // ---- clouds ------------------------------------------------------------

  // A sea of cloud: rows of rounded billows stacked front over back. Each row
  // is lit along its domed top and falls into shadow where the next row
  // overlaps it. Domes wrap around the strip so it tiles sideways.
  function billowRows(w, h, seed) {
    const rand = K.rng(seed);
    const rows = [];
    const ys = [0.34, 0.66, 0.98];
    for (let r = 0; r < ys.length; r++) {
      const edge = new Float32Array(w).fill(h * 2);
      const size = h * (0.24 - r * 0.04);
      let x = rand() * size;
      while (x < w) {
        const rad = size * (0.6 + rand() * 0.8);
        const cy = h * ys[r] + (rand() - 0.5) * h * (r === 0 ? 0.3 : 0.12);
        for (let dx = -rad; dx <= rad; dx++) {
          const xx = ((Math.round(x + dx) % w) + w) % w;
          const top = cy - Math.sqrt(rad * rad - dx * dx) * 0.7;
          if (top < edge[xx]) edge[xx] = top;
        }
        x += rad * (0.7 + rand() * 0.6);
      }
      rows.push({ edge, size });
    }
    return rows;
  }

  function paintSea(w, h, sky, seed, bright) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const n = sky.night;
    const lit = mixColor(mixColor(rgb('#e9e6db'), sky.amb, 0.55), rgb('#4a5272'), clamp(n * 1.3, 0, 0.92));
    const shade = mixColor(mixColor(sky.haze, rgb('#7d8598'), 0.4), rgb('#141a2e'), clamp(n * 1.3, 0, 0.9));
    const rows = billowRows(w, h, seed);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        const i = (y * w + x) * 4;
        let row = -1;
        for (let r = rows.length - 1; r >= 0; r--) {
          if (y >= rows[r].edge[x] - 1) { row = r; break; }
        }
        if (row < 0) { d[i + 3] = 0; continue; }
        const below = y - rows[row].edge[x];
        const a = row === 0 ? smoothstep(-1, 1.5, below) : 1;
        const fall = below / rows[row].size;
        const tex = fbm(x * 0.05, y * 0.09, 2, seed + row) - 0.5;
        const k = clamp(1 - smoothstep(0, 1.8, fall) * 0.65 + tex * 0.3 - row * 0.05, 0, 1) * bright;
        const col = mixColor(shade, lit, k);
        d[i] = col[0];
        d[i + 1] = col[1];
        d[i + 2] = col[2];
        d[i + 3] = a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Thin ribbons of mist, faint and wide.
  function paintMist(w, h, sky, seed) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const col = mixColor(mixColor(rgb('#eceae0'), sky.haze, 0.4), rgb('#2a2e4a'), sky.night * 0.7);
    const dens = (x, y) => fbm(x * 0.012, y * 0.09, 4, seed);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(dens(x, y), dens(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = smoothstep(0.45, 0.72, v) * band * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- sky and bake ------------------------------------------------------

  function paintSky(g, sky, hourNow, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.8);
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
    const day = 1 - sky.night;
    const arc = day > 0.5 ? S.sunT(hourNow) : S.moonT(hourNow);
    const cx = g.W * lerp(0.3, 0.7, arc);
    const cy = g.H * (0.2 - Math.sin(arc * Math.PI) * 0.1);
    const r = g.U * 4;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 4);
    const tone = day > 0.5 ? '255,226,170' : '226,230,240';
    glow.addColorStop(0, `rgba(${tone},0.45)`);
    glow.addColorStop(1, `rgba(${tone},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r * 4, cy - r * 4, r * 8, r * 8);
    ctx.fillStyle = day > 0.5 ? '#f2dca6' : '#e4e6ee';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.3);
    ctx.fill();
    return c;
  }

  function rockLayer(g, sky, ridge, o) {
    const c = layer(g.W, g.H);
    paintRock(c.getContext('2d'), g, sky, ridge, o);
    return c;
  }

  function nearLayer(g, sky) {
    const ridge = state.near;
    const c = rockLayer(g, sky, ridge, { rock: '#6f7076', seed: 21, fade: 0.0, fog: 0.5, ledge: 3.2 });
    const ctx = c.getContext('2d');
    const n = sky.night;
    const leaf = hex(mixColor(mixColor(rgb('#2f4a34'), sky.amb, 0.1), rgb('#0c1218'), n * 0.7));
    const leafLit = hex(mixColor(mixColor(rgb('#5d7a4a'), sky.amb, 0.2), rgb('#1c2a2a'), n * 0.7));
    const bark = hex(mixColor(rgb('#2a2622'), rgb('#0e1018'), n * 0.6));
    for (const p of state.pines) {
      const x = Math.round(p.x * g.W);
      const y = ridge.tops[x] + g.U * p.dy;
      paintPine(ctx, x, y, g.U * p.s, p.dir, leaf, leafLit, bark);
    }
    return c;
  }

  // Pines anchored on the outer rim of the near spire caps, leaning outward.
  function placePines(g, peaks) {
    const pines = [];
    const sorted = peaks.filter((p) => p.t < 0.45).sort((a, b) => a.t - b.t).slice(0, 8);
    sorted.forEach((p, i) => {
      const dir = i % 2 === 0 ? -1 : 1;
      pines.push({ x: clamp(p.c + dir * p.w * 0.4, 0.01, 0.99), s: i < 2 ? 2.1 : 1.5, dir, dy: 0.5 });
    });
    return pines;
  }

  function repaint(g, choice) {
    const hourNow = S.hour(choice);
    const sky = S.at(hourNow);
    const rand = K.rng(17);
    state.skyL = paintSky(g, sky, hourNow, rand);
    state.farL = rockLayer(g, sky, state.far, { rock: '#7e8796', seed: 5, fade: 0.55, fog: 0.3, ledge: 2 });
    state.midL = rockLayer(g, sky, state.mid, { rock: '#5f6777', seed: 11, fade: 0.3, fog: 0.45, ledge: 2.6 });
    state.nearL = nearLayer(g, sky);
    const w = Math.ceil(g.W * 1.5);
    state.seaBack = paintSea(w, Math.ceil(g.H * 0.3), sky, 31, 0.68);
    state.seaFront = paintSea(w, Math.ceil(g.H * 0.26), sky, 47, 0.85);
    state.mistA = paintMist(w, Math.ceil(g.H * 0.18), sky, 59);
    state.mistB = paintMist(w, Math.ceil(g.H * 0.16), sky, 73);
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function slide(ctx, c, speed, t, y, alpha, g) {
    if (alpha <= 0) return;
    const off = -(((t * speed * g.U) % c.width) + c.width) % c.width;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(c, off, y);
    ctx.drawImage(c, off + c.width, y);
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    const unit = g.U / g.W;
    state.far = makeRidge(g, spires(FAR, 3, unit * 2.2, unit * 3.6), 3, 1);
    state.mid = makeRidge(g, spires(MID, 7, unit * 3, unit * 5), 7, 1.5);
    const nearPeaks = spires(NEAR, 13, unit * 4.2, unit * 7);
    state.near = makeRidge(g, nearPeaks, 13, 2);
    state.pines = placePines(g, nearPeaks);
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    const sea = props.sea;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    // The sea rises with the slider: more sea buries more of the spires.
    const lift = (sea - 1) * g.H * 0.08;
    ctx.drawImage(state.skyL, 0, 0);
    ctx.drawImage(state.farL, 0, 0);
    slide(ctx, state.mistA, -1.4, t, g.H * 0.4, 0.75 * props.mist, g);
    ctx.drawImage(state.midL, 0, 0);
    slide(ctx, state.seaBack, 1.6, t, g.H * 0.52 - lift, sea * 1.2, g);
    slide(ctx, state.mistB, 2.6, t, g.H * 0.32, 0.6 * props.mist, g);
    ctx.drawImage(state.nearL, 0, 0);
    slide(ctx, state.seaFront, 3.4, t, g.H * 0.76 - lift, sea * 1.2, g);
  }

  Kasuri.run({
    defaults: { time: 'auto', sea: 1, mist: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
