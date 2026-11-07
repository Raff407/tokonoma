/*
 * 雲海 Unkai — a sea of cloud with peaks standing out of it.
 *
 * Sky colours come from the shared clock, so dawn here is dawn in Torii. Cloud
 * shapes are painted once as masks; tinting them to the hour is a cheap canvas
 * operation done once a minute. Three banks slide between three ridges, so the
 * mountains wade in and out of the weather.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, smoothstep, mixColor, toHex } = K;

  const RETINT_SECONDS = 60;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintMask(w, h, seed, scale) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * scale, y * scale * 1.9, 4, seed);
    for (let y = 0; y < h; y++) {
      const rise = smoothstep(0, h * 0.5, y);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        // The billowy top: cover grows quickly as you go down the band.
        const a = smoothstep(0.62 - rise * 0.5, 0.74 - rise * 0.44, v) * smoothstep(0, h * 0.16, y);
        const shade = 150 + (1 - y / h) * 105 + (v - 0.5) * 60;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = K.clamp(shade, 0, 255);
        img.data[i + 3] = a * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function tintCloud(mask, colour) {
    const c = layer(mask.width, mask.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = toHex(colour);
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0);
    return c;
  }

  function ridgePath(ctx, g, base, rise, scale, seed) {
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) {
      const n = 1 - Math.abs(fbm(x * scale, seed, 5, seed) * 2 - 1);
      ctx.lineTo(x, g.H * (base - Math.pow(n, 2.4) * rise));
    }
    ctx.lineTo(g.W, g.H);
  }

  function paintBody(g, sky, h) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.72);
    grad.addColorStop(0, toHex(sky.top));
    grad.addColorStop(1, toHex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#e9e6dc';
    if (sky.night > 0.05) {
      const rand = K.rng(41);
      for (let i = 0; i < g.W * 0.7; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.55);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.55, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintDisc(ctx, g, sky, h);
    return c;
  }

  function paintDisc(ctx, g, sky, h) {
    const isMoon = sky.night > 0.5;
    const along = isMoon ? S.moonT(h) : S.sunT(h);
    const x = g.W * lerp(0.08, 0.92, along);
    const y = g.H * (0.5 - Math.sin(along * Math.PI) * 0.42);
    const r = g.U * (isMoon ? 3.6 : 5);
    ctx.fillStyle = isMoon ? '#e8e3d0' : '#f1d7a4';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.3);
    ctx.fill();
  }

  function paintRidge(g, base, rise, scale, seed, colour) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = toHex(colour);
    ridgePath(ctx, g, base, rise, scale, seed);
    ctx.fill();
    return c;
  }

  function retint(g, choice) {
    const h = S.hour(choice);
    const sky = S.at(h);
    const dark = [20, 26, 34];
    state.body = paintBody(g, sky, h);
    state.ridges = [
      paintRidge(g, 0.72, 0.56, 0.0065, 3, mixColor(sky.haze, dark, 0.15)),
      paintRidge(g, 0.82, 0.5, 0.009, 7, mixColor(sky.haze, dark, 0.5)),
      paintRidge(g, 0.98, 0.42, 0.013, 12, mixColor(sky.haze, dark, 0.82)),
    ];
    const lit = mixColor(sky.amb, [255, 252, 244], 0.25 * (1 - sky.night));
    state.clouds = state.masks.map((m, i) => tintCloud(m, mixColor(lit, sky.haze, 0.1 + i * 0.05)));
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function drawBank(ctx, tile, y, offset) {
    const w = tile.width;
    const x = -(((offset % w) + w) % w);
    ctx.drawImage(tile, x, y);
    ctx.drawImage(tile, x + w, y);
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    const w = Math.ceil(g.W * 1.5);
    state.masks = [
      paintMask(w, Math.ceil(g.H * 0.55), 5, 0.016),
      paintMask(w, Math.ceil(g.H * 0.5), 18, 0.021),
      paintMask(w, Math.ceil(g.H * 0.42), 31, 0.028),
    ];
    retint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) retint(g, props.time);
    const drift = t * g.U * props.drift;
    ctx.drawImage(state.body, 0, 0);
    ctx.drawImage(state.ridges[0], 0, 0);
    drawBank(ctx, state.clouds[0], g.H * 0.46, drift * 1.1);
    ctx.drawImage(state.ridges[1], 0, 0);
    drawBank(ctx, state.clouds[1], g.H * 0.56, drift * 1.9);
    ctx.drawImage(state.ridges[2], 0, 0);
    drawBank(ctx, state.clouds[2], g.H * 0.7, drift * 3);
  }

  Kasuri.run({
    defaults: { time: 'auto', drift: 1, ramp: 'lines', cell: 8, boost: 0.15, gain: 1.05, dither: 0.4 },
    maxFps: 20,
    setup,
    draw,
  });
})();
