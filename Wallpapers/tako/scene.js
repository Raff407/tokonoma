/*
 * 凧 Tako — New Year kites over a village on a bright cold day.
 *
 * Each kite hangs at the end of a long sagging string and leans on its own
 * slow noise. Its face is a plain geometric crest baked once and rotated as an
 * image, and the two tails are short chains that wave.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep, noise2 } = K;

  const INKS = ['#b8412c', '#23406b', '#c49a35', '#2a2a2e', '#3b5a45'];
  const TAIL_POINTS = 9;
  const MAX_KITES = 7;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintWorld(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, g.H * 0.82);
    sky.addColorStop(0, '#3a6c9c');
    sky.addColorStop(1, '#cbdbe0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#7a93a2';
    ctx.beginPath();
    ctx.moveTo(0, g.H * 0.9);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, g.H * (0.82 - fbm(x * 0.009, 2, 4, 3) * 0.16));
    ctx.lineTo(g.W, g.H * 0.9);
    ctx.fill();
    ctx.fillStyle = '#c7b98e';
    ctx.fillRect(0, g.H * 0.88, g.W, g.H * 0.12);
    for (let i = 0; i < 9; i++) {
      const x = g.W * (0.04 + i * 0.11 + rand() * 0.05);
      const y = g.H * (0.9 + rand() * 0.04);
      const s = g.U * (3 + rand() * 2);
      ctx.fillStyle = '#50483d';
      ctx.fillRect(x - s, y - s, s * 2, s);
      ctx.fillStyle = '#3a3c42';
      ctx.beginPath();
      ctx.moveTo(x - s * 1.5, y - s);
      ctx.lineTo(x, y - s * 2.1);
      ctx.lineTo(x + s * 1.5, y - s);
      ctx.fill();
    }
    return c;
  }

  // A rectangular kite with a simple crest: disc, band or lozenge. No lettering.
  function paintKite(size, inks, kind) {
    const w = Math.ceil(size * 2);
    const h = Math.ceil(size * 2.5);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ece6d2';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = inks[0];
    if (kind === 0) {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, size * 0.66, 0, 6.3);
      ctx.fill();
    } else if (kind === 1) {
      ctx.fillRect(0, h * 0.3, w, h * 0.4);
      ctx.fillStyle = inks[1];
      ctx.fillRect(0, h * 0.42, w, h * 0.16);
    } else {
      ctx.beginPath();
      ctx.moveTo(w / 2, h * 0.1);
      ctx.lineTo(w * 0.9, h / 2);
      ctx.lineTo(w / 2, h * 0.9);
      ctx.lineTo(w * 0.1, h / 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#2b2219';
    ctx.lineWidth = Math.max(1, size * 0.08);
    ctx.strokeRect(0, 0, w, h);
    return c;
  }

  function makeKites(g, rand) {
    const list = [];
    for (let i = 0; i < MAX_KITES; i++) {
      const size = g.U * (3.4 + rand() * 4.6);
      const a = INKS[i % INKS.length];
      const b = INKS[(i + 2) % INKS.length];
      list.push({
        anchor: g.W * (0.05 + (i + rand() * 0.4) * 0.13) - g.U * 12,
        x: g.W * (0.08 + (i + rand() * 0.4) * 0.13),
        y: g.H * (0.16 + ((i * 3) % 7) * 0.058),
        size,
        seed: rand() * 100,
        tail: a,
        art: paintKite(size, [a, b], i % 3),
      });
    }
    return list;
  }

  function drawString(ctx, g, k, x, y) {
    ctx.beginPath();
    ctx.moveTo(x, y + k.size);
    ctx.quadraticCurveTo(lerp(x, k.anchor, 0.55), lerp(y, g.H * 0.92, 0.75), k.anchor, g.H * 0.92);
    ctx.stroke();
  }

  function drawTails(ctx, g, k, x, y, lean, t) {
    ctx.strokeStyle = k.tail;
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    const step = k.size * 0.6;
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(x + side * k.size * 0.7, y + k.size * 1.15);
      for (let i = 1; i <= TAIL_POINTS; i++) {
        const wave = Math.sin(t * 2.2 - i * 0.8 + k.seed + side) * i * g.U * 0.32;
        ctx.lineTo(x + side * k.size * 0.7 + wave - lean * i * k.size * 0.5, y + k.size * 1.15 + i * step);
      }
    }
    ctx.stroke();
  }

  function drawKite(ctx, g, k, t, wind) {
    const lean = (noise2(t * 0.1, k.seed, 2) - 0.5) * 1.1 * wind;
    const x = k.x + (noise2(t * 0.06, k.seed, 5) - 0.5) * g.U * 26 * wind;
    const y = k.y + (noise2(k.seed, t * 0.07, 7) - 0.5) * g.U * 15 * wind;
    ctx.strokeStyle = '#d9dcdb';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    drawString(ctx, g, k, x, y);
    ctx.globalAlpha = 1;
    drawTails(ctx, g, k, x, y, lean, t);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lean * 0.55);
    ctx.drawImage(k.art, -k.art.width / 2, -k.art.height / 2);
    ctx.restore();
  }

  function paintClouds(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.018, y * 0.05, 4, 8);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 244;
        img.data[i + 3] = smoothstep(0.5, 0.66, v) * band * 225;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.world = paintWorld(g, rand);
    state.clouds = paintClouds(Math.ceil(g.W * 1.5), Math.ceil(g.H * 0.6));
    state.kites = makeKites(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    ctx.drawImage(state.world, 0, 0);
    const w = state.clouds.width;
    const x = -((t * g.U * 1.6 * props.wind) % w);
    ctx.drawImage(state.clouds, x, g.H * 0.03);
    ctx.drawImage(state.clouds, x + w, g.H * 0.03);
    const count = Math.min(MAX_KITES, Math.round(props.kites));
    for (let i = 0; i < count; i++) drawKite(ctx, g, state.kites[i], t, props.wind);
  }

  Kasuri.run({
    defaults: { kites: 5, wind: 1, ramp: 'lines', cell: 7, boost: 0.1, gain: 0.95, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
