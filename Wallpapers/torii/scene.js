/*
 * 鳥居 Torii — a vermilion gate at the top of mossy stone steps.
 *
 * The sky follows the clock, the trees follow the month, a fox keeps watch.
 * Everything still (sky, hills, steps, gate) is painted into two cached
 * layers that refresh twice a minute; per frame we only move the trees,
 * the mist, the lantern light and whatever is falling.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { clamp, lerp, smoothstep, fbm, noise2, hash2, parseColor: P, mixColor } = K;

  const Sky = KasuriSky;


  // Canopy colours run shadow → mid → highlight.
  const SEASONS = {
    autumn: {
      a: ['#8a5814', '#d4962a', '#f4cb5c'], b: ['#6a1e14', '#b9392a', '#e8693a'],
      ground: ['#2b3520', '#43522b'], litter: ['#b0622a', '#d8a33a', '#8a3a1f'],
      fall: ['#e3a83a', '#c84a2a', '#f2cc62', '#a83a22'], kind: 'leaf',
    },
    spring: {
      a: ['#b07a8a', '#e8b0c0', '#fbe3ea'], b: ['#985a70', '#dc98ad', '#f6ccd8'],
      ground: ['#31472a', '#4c6a35'], litter: ['#f3d5dd', '#e9b9c7', '#fbeef1'],
      fall: ['#f7d3dd', '#f0b8c8', '#fff0f4'], kind: 'petal',
    },
    summer: {
      a: ['#22391a', '#3c662b', '#6e9a45'], b: ['#1c361e', '#305c37', '#5d8e50'],
      ground: ['#23341b', '#3a5326'], litter: ['#2f4a22', '#4a6b2f', '#5b7a35'],
      fall: ['#d9f27a', '#f4ff9a'], kind: 'firefly',
    },
    winter: {
      a: ['#58616c', '#b5bfca', '#f0f4f7'], b: ['#4b545e', '#a7b1bc', '#e6ebef'],
      ground: ['#aeb8c2', '#dde3e8'], litter: ['#eef2f5', '#cfd7de', '#ffffff'],
      fall: ['#ffffff', '#e6edf3'], kind: 'snow',
    },
  };

  // Hex is nice to read; the painters want [r, g, b].
  for (const pal of Object.values(SEASONS)) {
    for (const key of Object.keys(pal)) {
      if (Array.isArray(pal[key])) pal[key] = pal[key].map(P);
    }
  }

  const RED = { lo: P('#8c2717'), mid: P('#cf4127'), hi: P('#ee6b3d') };
  const SUMI = P('#1a1615');
  const STONE = { lo: P('#4a4843'), mid: P('#7f7b72'), hi: P('#a9a497') };

  const FOX = K.parseSprite([
    '..d..d....',
    '..oo.oo...',
    '..ooooo...',
    '.ooeoooo..',
    'kwwoooo...',
    '..wwooo...',
    '..wwoooo..',
    '..wwooooo.',
    '..wwoooooo',
    '..wwoooooo',
    '..dd.ddooo',
  ], { o: '#d7782a', w: '#f1e6d6', d: '#2a1c16', e: '#160f0c', k: '#160f0c' });

  const FOX_TAIL = [
    K.parseSprite(['....', '....', '..oo', '.oow', 'oow.'], { o: '#d7782a', w: '#f1e6d6' }),
    K.parseSprite(['...w', '..oo', '.oo.', 'oo..', 'o...'], { o: '#d7782a', w: '#f1e6d6' }),
  ];

  const CROW = [
    K.parseSprite(['d.....d', '.d...d.', '..ddd..'], { d: '#17161b' }),
    K.parseSprite(['..ddd..', '.d...d.', 'd.....d'], { d: '#17161b' }),
  ];

  let amb = [1, 1, 1];
  const css = (c, k = 1) =>
    `rgb(${(c[0] * amb[0] * k) | 0},${(c[1] * amb[1] * k) | 0},${(c[2] * amb[2] * k) | 0})`;
  const raw = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  function disc(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(r, 0.4), 0, Math.PI * 2);
    ctx.fill();
  }

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // ---- geometry ---------------------------------------------------------

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const U = H / 100;
    const cx = W * 0.5;
    const yh = H * 0.5;
    const yg = H * 0.64;
    const ground = new Float32Array(Math.ceil(W) + 1);
    for (let x = 0; x <= W; x++) {
      const side = smoothstep(16 * U, 70 * U, Math.abs(x - cx));
      ground[x] = yg - side * 12 * U - fbm(x * 0.04, 3.1, 3) * 3 * U;
    }
    return { W, H, U, cx, yh, yg, ground };
  }

  function makeTree(rand, g, side) {
    const inner = side < 0 ? g.cx - 21 * g.U : g.cx + 21 * g.U;
    const outer = side < 0 ? -0.04 * g.W : g.W * 1.04;
    const width = Math.abs(inner - outer);
    const centre = { x: lerp(outer, inner, 0.42), y: g.H * 0.16 };
    const rx = width * 0.62;
    const ry = g.H * 0.3;
    const clusters = [];
    for (let i = 0; i < 110; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand());
      clusters.push({
        x: centre.x + Math.cos(a) * rx * r,
        y: centre.y + Math.sin(a) * ry * r,
        r: (3 + rand() * 5.5) * g.U,
        phase: rand() * Math.PI * 2,
        tone: rand(),
      });
    }
    clusters.sort((p, q) => p.y - q.y);
    const trunkX = lerp(outer, inner, 0.55);
    return { side, clusters, trunk: { x: trunkX, base: g.yg + 6 * g.U, top: centre.y + ry * 0.2 } };
  }

  function lanterns(g) {
    const near = 31 * g.U;
    const far = 18.5 * g.U;
    return [
      { x: g.cx - far, base: g.yg + 1.2 * g.U, s: 0.62 * g.U, seed: 1 },
      { x: g.cx + far, base: g.yg + 1.2 * g.U, s: 0.62 * g.U, seed: 2 },
      { x: g.cx - near, base: g.H - 3 * g.U, s: 1.25 * g.U, seed: 3 },
      { x: g.cx + near, base: g.H - 3 * g.U, s: 1.25 * g.U, seed: 4 },
    ];
  }

  // ---- far layer: sky, sun or moon, mountains ---------------------------

  function paintFar(ctx, g, sky, hour, seed) {
    const sk = ctx.createLinearGradient(0, 0, 0, g.yh);
    sk.addColorStop(0, raw(sky.top));
    sk.addColorStop(1, raw(sky.low));
    ctx.fillStyle = sk;
    ctx.fillRect(0, 0, g.W, g.H);

    const night = Sky.nightness(hour);
    const dayT = clamp((hour - 6) / 13.5, 0, 1);
    if (night < 0.98) {
      const sx = lerp(0.12, 0.88, dayT) * g.W;
      const sy = g.yh - Math.sin(dayT * Math.PI) * g.H * 0.4;
      const warm = mixColor(P('#fff3d6'), P('#ffb06a'), 1 - Math.sin(dayT * Math.PI));
      const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, 16 * g.U);
      halo.addColorStop(0, raw(warm, 0.55 * (1 - night)));
      halo.addColorStop(1, raw(warm, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, g.W, g.H);
      ctx.fillStyle = raw(warm, 1 - night);
      disc(ctx, sx, sy, 4 * g.U);
    }
    if (night > 0.02) {
      const nightT = ((hour - 19 + 24) % 24) / 11;
      const mx = lerp(0.15, 0.85, clamp(nightT, 0, 1)) * g.W;
      const my = g.H * 0.08 + (1 - Math.sin(clamp(nightT, 0, 1) * Math.PI)) * g.H * 0.22;
      const halo = ctx.createRadialGradient(mx, my, 0, mx, my, 16 * g.U);
      halo.addColorStop(0, raw(P('#e9e4cf'), 0.45 * night));
      halo.addColorStop(1, raw(P('#e9e4cf'), 0));
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, g.W, g.H);
      ctx.fillStyle = raw(P('#f4eed8'), night);
      disc(ctx, mx, my, 3.2 * g.U);
      // Maria: a couple of soft grey patches so the moon reads as a moon, not a dot.
      ctx.fillStyle = raw(P('#cfc8b0'), night * 0.8);
      disc(ctx, mx - 0.9 * g.U, my - 0.5 * g.U, 1.1 * g.U);
      disc(ctx, mx + 0.8 * g.U, my + 0.9 * g.U, 0.8 * g.U);
    }

    const ridge = new Float32Array(Math.ceil(g.W) + 1);
    const bands = [
      { base: g.yh + 1 * g.U, rise: 24, mix: 0.35, scale: 0.018, seed: seed % 97 },
      { base: g.yh + 6 * g.U, rise: 14, mix: 0.62, scale: 0.03, seed: (seed % 89) + 40 },
    ];
    const mountain = P('#2b3352');
    bands.forEach((band, i) => {
      ctx.fillStyle = raw(mixColor(sky.haze, mixColor(mountain, P('#000000'), i * 0.25), band.mix));
      ctx.beginPath();
      ctx.moveTo(0, g.H);
      for (let x = 0; x <= g.W; x++) {
        const n = fbm(x * band.scale, band.seed, 4);
        const y = band.base - (n * n * band.rise + 3) * g.U;
        if (i === 0) ridge[x] = y;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(g.W, g.H);
      ctx.closePath();
      ctx.fill();
    });
    return ridge;
  }

  // ---- near layer: hill, steps, gate, lantern bodies, tree trunks -------

  function paintGround(ctx, g, pal, seed) {
    const img = ctx.createImageData(g.W, g.H);
    const lo = pal.ground[0];
    const hi = pal.ground[1];
    for (let y = 0; y < g.H; y++) {
      for (let x = 0; x < g.W; x++) {
        if (y < g.ground[x]) continue;
        const n = fbm(x * 0.09, y * 0.16, 3, seed);
        const depth = (y - g.ground[x]) / g.H;
        let c = mixColor(lo, hi, n * 1.3 - depth * 0.6);
        const speck = hash2(x, y, seed);
        if (speck > 0.9) c = pal.litter[Math.floor(hash2(y, x, seed) * pal.litter.length)];
        const i = (y * g.W + x) * 4;
        img.data[i] = c[0] * amb[0];
        img.data[i + 1] = c[1] * amb[1];
        img.data[i + 2] = c[2] * amb[2];
        img.data[i + 3] = 255;
      }
    }
    const tmp = layer(g.W, g.H);
    tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.drawImage(tmp, 0, 0);
  }

  function paintStairs(ctx, g) {
    const n = 13;
    const top = g.yg;
    const bottom = g.H + 2;
    const half = (y) => lerp(6.5 * g.U, 27 * g.U, (y - top) / (bottom - top));
    ctx.fillStyle = css(STONE.lo, 0.7);
    poly(ctx, [[g.cx - half(top) - g.U, top], [g.cx + half(top) + g.U, top], [g.cx + half(bottom) + 3 * g.U, bottom], [g.cx - half(bottom) - 3 * g.U, bottom]]);
    for (let k = 0; k < n; k++) {
      const a = top + (bottom - top) * Math.pow(k / n, 1.45);
      const b = top + (bottom - top) * Math.pow((k + 1) / n, 1.45);
      const r = lerp(a, b, 0.58);
      const wear = 0.85 + 0.15 * hash2(k, 3, 7);
      ctx.fillStyle = css(mixColor(STONE.mid, STONE.hi, 0.35 + 0.4 * (k / n)), wear);
      poly(ctx, [[g.cx - half(a), a], [g.cx + half(a), a], [g.cx + half(r), r], [g.cx - half(r), r]]);
      ctx.fillStyle = css(STONE.lo, 0.9);
      poly(ctx, [[g.cx - half(r), r], [g.cx + half(r), r], [g.cx + half(b), b], [g.cx - half(b), b]]);
    }
  }

  function paintTorii(ctx, g) {
    const U = g.U;
    const base = g.yg + 1.2 * U;
    const span = 13 * U;
    const height = 37 * U;
    const pw = 2.8 * U;
    const top = base - height;

    for (const side of [-1, 1]) {
      const x = g.cx + side * span;
      const lean = side * -0.6 * U;
      const grad = ctx.createLinearGradient(x - pw, 0, x + pw, 0);
      grad.addColorStop(0, css(RED.hi));
      grad.addColorStop(0.45, css(RED.mid));
      grad.addColorStop(1, css(RED.lo));
      ctx.fillStyle = grad;
      poly(ctx, [[x - pw / 2 + lean, top + 4 * U], [x + pw / 2 + lean, top + 4 * U], [x + pw * 0.62, base], [x - pw * 0.62, base]]);
      ctx.fillStyle = css(SUMI);
      ctx.fillRect(x - pw * 0.72, base - 3 * U, pw * 1.44, 3 * U);
    }

    const nukiY = top + 11 * U;
    ctx.fillStyle = css(RED.mid);
    ctx.fillRect(g.cx - span - 5 * U, nukiY, (span + 5 * U) * 2, 2.2 * U);
    ctx.fillStyle = css(RED.lo);
    ctx.fillRect(g.cx - span - 5 * U, nukiY + 1.5 * U, (span + 5 * U) * 2, 0.7 * U);

    ctx.fillStyle = css(RED.mid);
    ctx.fillRect(g.cx - 1.5 * U, top + 4 * U, 3 * U, nukiY - top - 4 * U);
    ctx.fillStyle = css(SUMI);
    ctx.fillRect(g.cx - 2.4 * U, top + 5 * U, 4.8 * U, 4.6 * U);
    ctx.fillStyle = css(P('#c9a34a'));
    ctx.fillRect(g.cx - 0.5 * U, top + 6 * U, 1 * U, 2.6 * U);

    ctx.fillStyle = css(RED.mid);
    ctx.fillRect(g.cx - span - 7.5 * U, top + 2.2 * U, (span + 7.5 * U) * 2, 2 * U);

    const ks = span + 10.5 * U;
    ctx.fillStyle = css(SUMI);
    ctx.beginPath();
    ctx.moveTo(g.cx - ks, top - 1.8 * U);
    ctx.quadraticCurveTo(g.cx, top + 1.4 * U, g.cx + ks, top - 1.8 * U);
    ctx.lineTo(g.cx + ks - 1.2 * U, top + 0.9 * U);
    ctx.quadraticCurveTo(g.cx, top + 3.4 * U, g.cx - ks + 1.2 * U, top + 0.9 * U);
    ctx.closePath();
    ctx.fill();
  }

  function paintLanternBody(ctx, l) {
    const s = l.s;
    const x = l.x;
    const b = l.base;
    ctx.fillStyle = css(STONE.lo);
    ctx.fillRect(x - 3 * s, b - 1.4 * s, 6 * s, 1.4 * s);
    ctx.fillStyle = css(STONE.mid);
    ctx.fillRect(x - 1 * s, b - 6.5 * s, 2 * s, 5.2 * s);
    ctx.fillRect(x - 2.6 * s, b - 7.6 * s, 5.2 * s, 1.2 * s);
    ctx.fillStyle = css(STONE.lo);
    ctx.fillRect(x - 2.2 * s, b - 10.8 * s, 4.4 * s, 3.2 * s);
    ctx.fillStyle = css(STONE.hi);
    poly(ctx, [[x - 4 * s, b - 10.6 * s], [x + 4 * s, b - 10.6 * s], [x + 1.4 * s, b - 13 * s], [x - 1.4 * s, b - 13 * s]]);
    ctx.fillStyle = css(STONE.mid);
    disc(ctx, x, b - 13.6 * s, 0.9 * s);
  }

  function lanternWindow(l) {
    return { x: l.x - 1.2 * l.s, y: l.base - 10.2 * l.s, w: 2.4 * l.s, h: 2.2 * l.s };
  }

  function paintTrunk(ctx, tree, g) {
    const { x, base, top } = tree.trunk;
    const lean = tree.side * -4 * g.U;
    ctx.fillStyle = css(P('#2e221b'));
    poly(ctx, [[x - 1.8 * g.U, base], [x + 1.8 * g.U, base], [x + 0.8 * g.U + lean, top], [x - 0.8 * g.U + lean, top]]);
    ctx.strokeStyle = css(P('#2e221b'));
    ctx.lineWidth = 0.9 * g.U;
    for (let i = 0; i < 3; i++) {
      const y = lerp(top, base, 0.25 + i * 0.12);
      ctx.beginPath();
      ctx.moveTo(x + lean * 0.5, y);
      ctx.lineTo(x + lean * 0.5 + tree.side * (i % 2 ? 7 : -6) * g.U, y - 6 * g.U);
      ctx.stroke();
    }
  }

  function paintNear(ctx, g, pal, state) {
    ctx.clearRect(0, 0, g.W, g.H);
    paintGround(ctx, g, pal, state.seed);
    for (const tree of state.trees) paintTrunk(ctx, tree, g);
    paintStairs(ctx, g);
    paintTorii(ctx, g);
    for (const l of state.lanterns) paintLanternBody(ctx, l);
  }

  // ---- living things ----------------------------------------------------

  function drawCanopy(ctx, tree, pal, t, wind, g) {
    const colours = tree.side < 0 ? pal.a : pal.b;
    const gust = noise2(t * 0.15, tree.side * 10) - 0.5;
    for (const c of tree.clusters) {
      const height = 1.25 - clamp(c.y / g.yh, 0, 1);
      const sway = Math.sin(t * 0.8 + c.phase) * 0.35 + gust * 1.4;
      const dx = sway * wind * 1.4 * g.U * height;
      const x = c.x + dx;
      const y = c.y + Math.abs(dx) * 0.12;
      ctx.fillStyle = css(colours[0]);
      disc(ctx, x + c.r * 0.12, y + c.r * 0.18, c.r);
      ctx.fillStyle = css(mixColor(colours[0], colours[1], 0.45 + c.tone * 0.55));
      disc(ctx, x - c.r * 0.08, y - c.r * 0.06, c.r * 0.78);
      ctx.fillStyle = css(colours[2]);
      disc(ctx, x - c.r * 0.34, y - c.r * 0.36, c.r * 0.34);
    }
  }

  function spawnParticle(p, g, pal, rand, state, fromTop) {
    const tree = state.trees[Math.floor(rand() * state.trees.length)];
    const c = tree.clusters[Math.floor(rand() * tree.clusters.length)];
    if (pal.kind === 'firefly') {
      p.x = rand() * g.W;
      p.y = lerp(g.yg - 8 * g.U, g.H, rand());
    } else if (pal.kind === 'snow' || fromTop) {
      p.x = rand() * g.W * 1.2 - g.W * 0.1;
      p.y = -rand() * g.H * 0.3;
    } else {
      p.x = c.x;
      p.y = c.y;
    }
    p.vy = pal.kind === 'snow' ? 1.6 + rand() * 2.2 : 2.4 + rand() * 2.6;
    p.phase = rand() * Math.PI * 2;
    p.colour = pal.fall[Math.floor(rand() * pal.fall.length)];
    p.life = 0;
  }

  function drawParticles(ctx, state, g, pal, t, dt, props) {
    const target = Math.round(props.leaves * (pal.kind === 'firefly' ? 0.25 : 1) * g.W * g.H / 140);
    const rand = state.rand;
    while (state.parts.length < target) {
      const p = {};
      spawnParticle(p, g, pal, rand, state, true);
      p.y = rand() * g.H;
      state.parts.push(p);
    }
    state.parts.length = Math.min(state.parts.length, target);
    const night = state.night;

    for (const p of state.parts) {
      p.life += dt;
      if (pal.kind === 'firefly') {
        p.x += Math.sin(t * 0.7 + p.phase) * dt * 1.5;
        p.y += Math.cos(t * 0.9 + p.phase * 1.3) * dt * 1.1;
        const blink = Math.max(0, Math.sin(t * 1.6 + p.phase * 3));
        const a = blink * night;
        if (a > 0.02) {
          ctx.fillStyle = raw(p.colour, a);
          ctx.fillRect(p.x | 0, p.y | 0, 1, 1);
        }
        if (p.life > 30) spawnParticle(p, g, pal, rand, state, false);
        continue;
      }
      const windX = (noise2(p.y * 0.05, t * 0.2) - 0.35) * props.wind * 6;
      p.x += (windX + Math.sin(t * 2.2 + p.phase) * 1.4) * dt;
      p.y += p.vy * dt;
      const flip = Math.sin(t * 5 + p.phase) > 0;
      ctx.fillStyle = css(p.colour, flip || pal.kind === 'snow' ? 1 : 0.7);
      ctx.fillRect(p.x | 0, p.y | 0, 1, 1);
      if (p.y > g.H + 1 || p.x < -4 || p.x > g.W + 4) spawnParticle(p, g, pal, rand, state, false);
    }
  }

  function drawLights(ctx, state, t) {
    const lit = 0.25 + 0.75 * state.night;
    ctx.globalCompositeOperation = 'lighter';
    for (const l of state.lanterns) {
      const flicker = 0.82 + 0.18 * noise2(t * 5, l.seed * 9);
      const w = lanternWindow(l);
      const cx = w.x + w.w / 2;
      const cy = w.y + w.h / 2;
      const reach = 13 * l.s;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
      glow.addColorStop(0, `rgba(255,170,80,${0.6 * lit * flicker})`);
      glow.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - reach, cy - reach, reach * 2, reach * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const l of state.lanterns) {
      const flicker = 0.8 + 0.2 * noise2(t * 5, l.seed * 9);
      const w = lanternWindow(l);
      ctx.fillStyle = raw(mixColor(P('#3a2614'), P('#ffd27a'), lit * flicker));
      ctx.fillRect(w.x, w.y, w.w, w.h);
    }
  }

  function drawFox(ctx, g, t) {
    const x = g.cx + 4.5 * g.U;
    const y = g.yg - FOX.h + 1.2 * g.U;
    const swish = Math.sin(t * 0.9) + Math.sin(t * 0.37) * 0.6 > 0.7 ? 1 : 0;
    Kasuri.drawSprite(ctx, FOX_TAIL[swish], x + FOX.w - 1, y + FOX.h - 5);
    Kasuri.drawSprite(ctx, FOX, x, y);
    if (Math.sin(t * 0.23) > 0.985) {
      ctx.fillStyle = '#d7782a';
      ctx.fillRect(Math.round(x) + 3, Math.round(y) + 3, 1, 1);
    }
  }

  function drawCrows(ctx, state, g, t, dt) {
    if (state.night > 0.6) return;
    state.nextCrow -= dt;
    if (state.nextCrow <= 0 && state.crows.length === 0) {
      const dir = state.rand() < 0.5 ? 1 : -1;
      const y = g.H * (0.08 + state.rand() * 0.2);
      const count = 1 + Math.floor(state.rand() * 3);
      for (let i = 0; i < count; i++) {
        state.crows.push({ x: dir > 0 ? -10 - i * 9 : g.W + 10 + i * 9, y: y + i * 2.5, dir, phase: state.rand() * 3 });
      }
      state.nextCrow = 25 + state.rand() * 40;
    }
    for (const c of state.crows) {
      c.x += c.dir * 9 * dt;
      c.y += Math.sin(t * 1.3 + c.phase) * dt * 0.8;
      const frame = Math.sin(t * 7 + c.phase) > 0 ? 0 : 1;
      Kasuri.drawSprite(ctx, CROW[frame], c.x, c.y, c.dir < 0);
    }
    state.crows = state.crows.filter((c) => c.x > -30 && c.x < g.W + 30);
  }

  function drawStars(ctx, state, t) {
    if (state.night < 0.05) return;
    for (const s of state.stars) {
      if (s.y >= state.ridge[Math.round(s.x)] - 1) continue;
      const a = state.night * s.b * (0.55 + 0.45 * Math.sin(t * s.speed + s.p));
      ctx.fillStyle = `rgba(255,248,230,${a})`;
      ctx.fillRect(s.x, s.y, 1, 1);
    }
  }

  function makeMist(g, seed) {
    const c = layer(g.W * 2, Math.ceil(16 * g.U));
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    for (let y = 0; y < c.height; y++) {
      const band = Math.sin((y / c.height) * Math.PI);
      for (let x = 0; x < c.width; x++) {
        // Tile seamlessly by blending the noise with itself one width over.
        const u = x / c.width;
        const n = lerp(fbm(x * 0.03, y * 0.25, 4, seed), fbm((x - c.width) * 0.03, y * 0.25, 4, seed), u);
        const i = (y * c.width + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = clamp((n - 0.35) * 2.2, 0, 1) * band * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- scene ------------------------------------------------------------

  const state = { key: '', refreshIn: 0, parts: [], crows: [], nextCrow: 8, night: 0 };

  function resolveHour(props) {
    return Sky.hour(props.time);
  }

  function resolveSeason(props) {
    return SEASONS[props.season] ? props.season : K.seasonOf(new Date().getMonth());
  }

  function rebuild(api) {
    const g = state.g;
    const hour = resolveHour(api.props);
    const sky = K.paletteAt(hour, Sky.STOPS);
    const season = resolveSeason(api.props);
    amb = sky.amb.map((c) => c / 255);
    state.night = Sky.nightness(hour);
    state.season = season;
    state.ridge = paintFar(state.far.getContext('2d'), g, sky, hour, state.seed);
    paintNear(state.near.getContext('2d'), g, SEASONS[season], state);
    state.mistTint = sky.haze;
    state.refreshIn = 30;
  }

  function setup(ctx, api) {
    state.seed = api.seed % 100000;
    state.rand = K.rng(api.seed);
    const g = geometry(api);
    state.g = g;
    state.far = layer(g.W, g.H);
    state.near = layer(g.W, g.H);
    state.trees = [makeTree(state.rand, g, -1), makeTree(state.rand, g, 1)];
    state.lanterns = lanterns(g);
    state.mist = makeMist(g, state.seed);
    state.stars = Array.from({ length: Math.round((g.W * g.yh) / 45) }, () => ({
      x: state.rand() * g.W,
      y: state.rand() * g.yh,
      p: state.rand() * 6.28,
      b: 0.4 + state.rand() * 0.6,
      speed: 0.6 + state.rand() * 2,
    }));
    state.parts = [];
    state.crows = [];
    rebuild(api);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const pal = SEASONS[state.season];
    state.refreshIn -= dt / Math.max(api.props.speed, 0.01);
    if (state.refreshIn <= 0) rebuild(api);

    ctx.drawImage(state.far, 0, 0);
    drawStars(ctx, state, t);
    drawCrows(ctx, state, g, t, dt);

    const mistY = g.yh - 2 * g.U;
    const offset = (t * 0.6 * api.props.wind) % g.W;
    ctx.globalAlpha = 0.28 + 0.2 * state.night;
    ctx.drawImage(state.mist, -offset, mistY);
    ctx.globalAlpha = 1;

    ctx.drawImage(state.near, 0, 0);
    for (const tree of state.trees) drawCanopy(ctx, tree, pal, t, api.props.wind, g);
    drawLights(ctx, state, t);
    if (api.props.fox) drawFox(ctx, g, t);
    drawParticles(ctx, state, g, pal, t, dt, api.props);
  }

  Kasuri.run({
    defaults: {
      season: 'auto',
      time: 'auto',
      leaves: 1,
      wind: 1,
      fox: true,
      ramp: 'lines',
      cell: 9,
    },
    setup,
    draw,
    onProps(props, api) {
      rebuild(api);
      state.parts = [];
    },
  });
})();
