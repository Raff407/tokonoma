/*
 * 鴨 Kamo — ducks paddling across a still pond under willows.
 *
 * Ducks are one baked sprite each way, with a dim flipped copy beneath and a
 * V of two lines for the wake. Willow strands hang in front on long sine
 * curves. Water is a streak texture over a baked reflection of the far bank.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, lerp, smoothstep } = K;

  const BANK = 0.34;
  const MAX_DUCKS = 9;
  const STRANDS = 46;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintPond(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const line = g.H * BANK;
    const sky = ctx.createLinearGradient(0, 0, 0, line);
    sky.addColorStop(0, '#8ea8b0');
    sky.addColorStop(1, '#c9d2c4');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, g.W, line);
    const tree = (i) => g.H * (0.26 - fbm(i * 0.018, 3, 4, 7) * 0.26);
    ctx.fillStyle = '#4c6b4c';
    ctx.beginPath();
    ctx.moveTo(0, line);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, tree(x) + g.H * 0.06);
    ctx.lineTo(g.W, line);
    ctx.fill();
    const water = ctx.createLinearGradient(0, line, 0, g.H);
    water.addColorStop(0, '#8fae9f');
    water.addColorStop(0.45, '#5f8f8a');
    water.addColorStop(1, '#2f5f6a');
    ctx.fillStyle = water;
    ctx.fillRect(0, line, g.W, g.H - line);
    ctx.fillStyle = '#35523f';
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.moveTo(0, line);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, line + (line - (tree(x) + g.H * 0.06)) * 0.75);
    ctx.lineTo(g.W, line);
    ctx.fill();
    ctx.globalAlpha = 1;
        for (let i = 0; i < g.W * 0.3; i++) {
      ctx.fillStyle = rand() < 0.5 ? '#6d7f50' : '#3f5536';
      ctx.fillRect(rand() * g.W, line - g.U * rand() * 2.4, 1, g.U * 2);
    }
    return c;
  }

  function paintRipples(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.03, y * 0.42, 3, 19);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 206;
        img.data[i + 1] = 222;
        img.data[i + 2] = 212;
        img.data[i + 3] = smoothstep(0.55, 0.7, v) * 70;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintDuck(u, drake, mirror) {
    const w = Math.ceil(u * 18);
    const h = Math.ceil(u * 11);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.translate(w / 2, h - u);
    if (mirror) ctx.scale(-1, 1);
    ctx.fillStyle = drake ? '#a0927f' : '#826a4f';
    ctx.beginPath();
    ctx.moveTo(-u * 8, -u * 3.6);
    ctx.quadraticCurveTo(-u * 3, -u * 5.2, u * 3, -u * 3.8);
    ctx.quadraticCurveTo(u * 5, -u * 1, u * 2, 0);
    ctx.lineTo(-u * 5, 0);
    ctx.fill();
    ctx.fillStyle = drake ? '#5a4737' : '#5f4a35';
    ctx.beginPath();
    ctx.ellipse(-u * 1.2, -u * 2.8, u * 4, u * 1.5, -0.1, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = drake ? '#2d5a44' : '#7e684d';
    ctx.beginPath();
    ctx.arc(u * 4.4, -u * 5.8, u * 2, 0, 6.3);
    ctx.fill();
    ctx.fillRect(u * 3, -u * 5.4, u * 2, u * 2.4);
    ctx.fillStyle = '#d0a13b';
    ctx.fillRect(u * 6, -u * 6, u * 2, u * 0.9);
    if (drake) {
      ctx.fillStyle = '#ece8da';
      ctx.fillRect(u * 3, -u * 3.9, u * 2.1, Math.max(1, u * 0.5));
    }
    ctx.fillStyle = '#0f0e0e';
    ctx.fillRect(u * 4.8, -u * 6.5, Math.max(1, u * 0.5), Math.max(1, u * 0.5));
    return c;
  }

  function makeDucks(g, rand) {
    const list = [];
    for (let i = 0; i < MAX_DUCKS; i++) {
      list.push({
        depth: (((i * 4) % MAX_DUCKS) + rand() * 0.7) / MAX_DUCKS,
        x: ((i + rand() * 0.5) / MAX_DUCKS) * g.W,
        dir: rand() < 0.5 ? 1 : -1,
        speed: g.U * (1.3 + rand() * 1.4),
        drake: i % 2 === 0,
        phase: rand() * 6.28,
      });
    }
    return list.sort((a, b) => a.depth - b.depth);
  }

  function drawDuck(ctx, g, d, t, dt) {
    d.x += d.dir * d.speed * dt;
    const margin = g.U * 14;
    if (d.x > g.W + margin) d.x = -margin;
    if (d.x < -margin) d.x = g.W + margin;
    const y = g.H * lerp(BANK + 0.09, 0.9, d.depth) + Math.sin(t * 0.9 + d.phase) * g.U * 0.25;
    const s = lerp(0.55, 1.5, d.depth);
    const set = d.dir > 0 ? state.sprites.right : state.sprites.left;
    const sprite = d.drake ? set[0] : set[1];
    const w = sprite.width * s;
    const h = sprite.height * s;
    ctx.strokeStyle = '#d7e4da';
    ctx.lineWidth = Math.max(1, g.U * 0.3);
    ctx.globalAlpha = 0.55;
    const tail = -d.dir * g.U * 20 * s;
    ctx.beginPath();
    ctx.moveTo(d.x + d.dir * g.U * 4 * s, y);
    ctx.lineTo(d.x + tail, y - g.U * 2.2 * s);
    ctx.moveTo(d.x + d.dir * g.U * 4 * s, y);
    ctx.lineTo(d.x + tail, y + g.U * 3 * s);
    ctx.stroke();
    ctx.globalAlpha = 0.3;
    ctx.save();
    ctx.translate(d.x, y);
    ctx.scale(1, -0.6);
    ctx.drawImage(sprite, -w / 2, -h, w, h);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.drawImage(sprite, d.x - w / 2, y - h, w, h);
  }

  function makeStrands(g, rand) {
    const list = [];
    for (let i = 0; i < STRANDS; i++) {
      const left = i < STRANDS * 0.6;
      const x = left ? rand() * g.W * 0.34 : g.W - rand() * g.W * 0.22;
      list.push({ x, len: g.H * (0.34 + rand() * 0.42), phase: rand() * 6.28, colour: rand() < 0.5 ? '#7e9a55' : '#5c7c47' });
    }
    return list;
  }

  function drawWillow(ctx, g, t, wind) {
    ctx.lineWidth = Math.max(1, g.U * 0.4);
    for (const s of state.strands) {
      ctx.strokeStyle = s.colour;
      ctx.beginPath();
      ctx.moveTo(s.x, -1);
      for (let k = 1; k <= 7; k++) {
        const f = k / 7;
        const swing = Math.sin(t * 0.5 + s.phase + f * 1.8) * f * f * g.U * 3.6 * wind;
        ctx.lineTo(s.x + swing, f * s.len);
      }
      ctx.stroke();
      // Leaves in short pairs along the lower part of each strand.
      ctx.fillStyle = s.colour;
      for (let k = 2; k <= 7; k++) {
        const f = k / 7;
        const swing = Math.sin(t * 0.5 + s.phase + f * 1.8) * f * f * g.U * 3.6 * wind;
        const leaf = Math.max(1, g.U * 1.2);
        ctx.fillRect(s.x + swing - leaf, f * s.len, leaf * 2, Math.max(1, g.U * 0.5));
      }
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.pond = paintPond(g, rand);
    state.ripples = paintRipples(Math.ceil(g.W * 1.3), Math.ceil(g.H * (1 - BANK)));
    const u = g.U * 2;
    state.sprites = {
      right: [paintDuck(u, true, false), paintDuck(u, false, false)],
      left: [paintDuck(u, true, true), paintDuck(u, false, true)],
    };
    state.ducks = makeDucks(g, rand);
    state.strands = makeStrands(g, rand);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    const count = Math.min(MAX_DUCKS, Math.round(5 * props.ducks));
    ctx.drawImage(state.pond, 0, 0);
    const w = state.ripples.width;
    const x = -((t * g.U * 1) % w);
    ctx.drawImage(state.ripples, x, g.H * BANK);
    ctx.drawImage(state.ripples, x + w, g.H * BANK);
    for (let i = 0; i < state.ducks.length; i++) {
      if (i < count) drawDuck(ctx, g, state.ducks[i], t, dt);
    }
    drawWillow(ctx, g, t, props.wind);
  }

  Kasuri.run({
    defaults: { ducks: 1, wind: 1, ramp: 'lines', cell: 7, boost: 0.1, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
