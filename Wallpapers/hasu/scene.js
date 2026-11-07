/*
 * 蓮 Hasu — a lotus pond with real ripples.
 *
 * The water is a small wave equation on two typed arrays, at half the grid
 * when the grid is large. Light comes from the slope of the surface through a
 * colour table. Rain lands now and then, the cursor leaves a wake, a click
 * drops a stone. Pads and flowers are sprites that nod on the ripples.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { parseColor: P, mixColor, fbm, lerp } = K;

  const DAMPING = 0.985;
  const STEPS = 256;
  const STOPS = ['#071a1f', '#0e3035', '#1b4e4f', '#5e8f88', '#cfdccb'];

  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function makeTable() {
    const table = new Uint32Array(STEPS);
    const cols = STOPS.map(P);
    for (let i = 0; i < STEPS; i++) {
      const f = (i / (STEPS - 1)) * (cols.length - 1);
      const k = Math.min(cols.length - 2, Math.floor(f));
      const c = mixColor(cols[k], cols[k + 1], f - k);
      table[i] = (255 << 24) | (Math.round(c[2]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[0]);
    }
    return table;
  }

  function padSprite(g, rand, r) {
    const size = Math.ceil(r * 2.3);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const mid = size / 2;
    const notch = rand() * 6.28;
    ctx.fillStyle = rand() < 0.5 ? '#3e6b40' : '#2f5a3a';
    ctx.beginPath();
    ctx.moveTo(mid, mid);
    ctx.arc(mid, mid, r, notch + 0.26, notch + 6.02);
    ctx.fill();
    ctx.strokeStyle = '#66905a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = notch + 0.5 + (i / 7) * 5.4;
      ctx.moveTo(mid, mid);
      ctx.lineTo(mid + Math.cos(a) * r * 0.92, mid + Math.sin(a) * r * 0.92);
    }
    ctx.stroke();
    return c;
  }

  function flowerSprite(r) {
    const size = Math.ceil(r * 2.6);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const mid = size / 2;
    const rings = [[r, '#c77d90', 9], [r * 0.72, '#e0a9b4', 8], [r * 0.45, '#f1d9d3', 6]];
    for (const [radius, colour, n] of rings) {
      ctx.fillStyle = colour;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283 + radius;
        ctx.beginPath();
        ctx.ellipse(mid + Math.cos(a) * radius * 0.55, mid + Math.sin(a) * radius * 0.55, radius * 0.5, radius * 0.24, a, 0, 6.3);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#d8b35a';
    ctx.beginPath();
    ctx.arc(mid, mid, Math.max(1, r * 0.17), 0, 6.3);
    ctx.fill();
    return c;
  }

  function placeSprites(g, rand) {
    const sprites = [];
    const pads = Math.round(g.W / (g.U * 8));
    for (let i = 0; i < pads; i++) {
      const r = g.U * (4 + rand() * 6);
      sprites.push({ img: padSprite(g, rand, r), x: rand() * g.W, y: rand() * g.H, phase: rand() * 6.28 });
    }
    for (let i = 0; i < 5; i++) {
      const pick = sprites[Math.floor(rand() * sprites.length)];
      const size = g.U * (3.4 + rand() * 1.8);
      sprites.push({ img: flowerSprite(size), x: pick.x + g.U * 1.5, y: pick.y - g.U * 1.5, phase: rand() * 6.28 });
    }
    return sprites;
  }

  function splash(x, y, radius, strength) {
    const f = state.field;
    const cx = Math.floor(x / f.scale);
    const cy = Math.floor(y / f.scale);
    const r = Math.max(1, Math.round(radius / f.scale));
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const px = cx + dx;
        const py = cy + dy;
        if (px < 1 || py < 1 || px >= f.w - 1 || py >= f.h - 1) continue;
        const d = (dx * dx + dy * dy) / (r * r);
        if (d <= 1) f.now[py * f.w + px] -= strength * (1 - d);
      }
    }
  }

  function stepWater() {
    const f = state.field;
    const { w, h, now, old } = f;
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      for (let x = 1; x < w - 1; x++) {
        const i = row + x;
        old[i] = ((now[i - 1] + now[i + 1] + now[i - w] + now[i + w]) * 0.5 - old[i]) * DAMPING;
      }
    }
    f.now = old;
    f.old = now;
  }

  function paintWater(ctx, g) {
    const f = state.field;
    const { w, h, now, pixels } = f;
    const table = state.table;
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      for (let x = 1; x < w - 1; x++) {
        const i = row + x;
        const slope = now[i - 1] - now[i + 1] + now[i - w] - now[i + w];
        const v = 70 + f.shade[i] + slope * 340;
        pixels[i] = table[v < 0 ? 0 : v > 255 ? 255 : v | 0];
      }
    }
    f.ctx.putImageData(f.image, 0, 0);
    ctx.drawImage(f.canvas, 0, 0, w, h, 0, 0, g.W, g.H);
  }

  function makeField(g, rand) {
    const scale = g.W > 160 ? 2 : 1;
    const w = Math.ceil(g.W / scale);
    const h = Math.ceil(g.H / scale);
    const canvas = layer(w, h);
    const fctx = canvas.getContext('2d');
    const image = fctx.createImageData(w, h);
    const shade = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) shade[y * w + x] = (fbm(x * scale * 0.02, y * scale * 0.02, 3, 2) - 0.5) * 70;
    }
    const pixels = new Uint32Array(image.data.buffer);
    pixels.fill(0xff1f1a07);
    return { scale, w, h, canvas, ctx: fctx, image, pixels, shade, now: new Float32Array(w * h), old: new Float32Array(w * h) };
  }

  function followPointer(g, pointer) {
    if (!pointer.active) {
      state.last = null;
      return;
    }
    const last = state.last;
    if (last && Math.hypot(pointer.x - last.x, pointer.y - last.y) > 0.6) {
      splash(pointer.x, pointer.y, g.U * 1.2, 0.05);
    }
    state.last = state.lastSlot;
    state.last.x = pointer.x;
    state.last.y = pointer.y;
  }

  function onClick(x, y) {
    splash(x, y, state.g.U * 2.6, 0.5);
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.rand = rand;
    state.table = makeTable();
    state.field = makeField(g, rand);
    state.sprites = placeSprites(g, rand);
    state.lastSlot = { x: 0, y: 0 };
    state.last = null;
    state.wait = 0;
    for (let i = 0; i < 6; i++) splash(rand() * g.W, rand() * g.H, g.U * 1.6, 0.3);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.wait -= dt;
    if (state.wait <= 0) {
      splash(state.rand() * g.W, state.rand() * g.H, g.U * 1.1, 0.24);
      state.wait = (0.3 + state.rand() * 0.9) / Math.max(props.rain, 0.05);
    }
    followPointer(g, api.pointer);
    if (dt > 0) stepWater();
    paintWater(ctx, g);
    const bob = g.U * 0.25;
    for (const s of state.sprites) {
      ctx.drawImage(s.img, s.x - s.img.width / 2 + Math.sin(t * 0.5 + s.phase) * bob, s.y - s.img.height / 2 + Math.cos(t * 0.4 + s.phase) * bob);
    }
  }

  Kasuri.run({
    defaults: { rain: 1, ramp: 'lines', cell: 8, boost: 0.15, gain: 1.1, dither: 0.35 },
    maxFps: 24,
    setup,
    draw,
    onClick,
  });
})();
