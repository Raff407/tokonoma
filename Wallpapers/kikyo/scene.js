/*
 * 桔梗 Kikyo — bellflowers in a mountain meadow, with a stone lantern.
 *
 * Sky, ranges, meadow and flowers are baked into layers and repainted once a
 * minute from the clock. Between repaints only mist, the swaying flower strip
 * and a few fireflies move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.56;
  const MEADOW_TOP = 0.58;
  const FRONT_TOP = 0.7;
  const MOON = { x: 0.2, y: 0.17 };
  const LANTERN_X = 0.8;
  const FLY = 26;
  const RETINT_SECONDS = 60;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

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
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    paintMoon(ctx, g, sky);
    return c;
  }

  // A thin crescent, cut with a disc of the sky colour.
  function paintMoon(ctx, g, sky) {
    const a = 0.25 + sky.night * 0.65;
    const r = g.U * 3.4;
    const mx = g.W * MOON.x;
    const my = g.H * MOON.y;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#e8e2cc';
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = hex(mixColor(sky.top, sky.low, 0.2));
    ctx.beginPath();
    ctx.arc(mx + r * 0.55, my - r * 0.2, r * 0.92, 0, 6.3);
    ctx.fill();
  }

  // One mountain range as a silhouette with a hazy fade at its foot.
  function paintRange(ctx, g, sky, o) {
    const base = g.H * o.base;
    const col = mixColor(mixColor(rgb(o.ink), sky.haze, o.haze), rgb('#12162a'), sky.night * 0.5);
    const foot = mixColor(col, sky.low, 0.55);
    const grad = ctx.createLinearGradient(0, base - g.H * o.amp, 0, base);
    grad.addColorStop(0, hex(col));
    grad.addColorStop(1, hex(foot));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let px = 0; px <= g.W; px += 2) {
      const n = fbm(px * o.freq, o.seed, 4, o.seed + 3);
      const peaks = Math.pow(Math.abs(Math.sin(px * o.freq * 2.2 + o.seed)), 0.8);
      ctx.lineTo(px, base - g.H * o.amp * (0.25 + 0.75 * (n * 0.6 + peaks * 0.4)));
    }
    ctx.lineTo(g.W, g.H);
    ctx.fill();
  }

  function paintRanges(ctx, g, sky) {
    paintRange(ctx, g, sky, { base: 0.52, amp: 0.42, freq: 0.012, seed: 3, ink: '#3a4870', haze: 0.4 });
    paintRange(ctx, g, sky, { base: 0.57, amp: 0.26, freq: 0.02, seed: 8, ink: '#27325a', haze: 0.25 });
    paintSnow(ctx, g, sky);
  }

  // Pale caps on the far range peaks.
  function paintSnow(ctx, g, sky) {
    ctx.fillStyle = hex(mixColor(mixColor(rgb('#e8ecf0'), sky.amb, 0.4), sky.top, 0.25 + sky.night * 0.3));
    ctx.globalAlpha = 0.55;
    for (let px = 0; px < g.W; px += 3) {
      const n = fbm(px * 0.012, 3, 4, 6);
      const peaks = Math.pow(Math.abs(Math.sin(px * 0.012 * 2.2 + 3)), 0.8);
      const k = 0.25 + 0.75 * (n * 0.6 + peaks * 0.4);
      if (k < 0.72) continue;
      const top = g.H * (0.52 - 0.42 * k);
      ctx.fillRect(px, top, 3, (k - 0.7) * g.H * 0.12);
    }
    ctx.globalAlpha = 1;
  }

  // Distant cedars on the middle slope.
  function paintCedars(ctx, g, sky, rand) {
    ctx.fillStyle = hex(mixColor(mixColor(rgb('#2c4036'), sky.haze, 0.3), rgb('#0e1420'), sky.night * 0.6));
    for (let i = 0; i < 70; i++) {
      const px = rand() * g.W;
      const base = g.H * (0.56 + rand() * 0.03);
      const h = g.U * (3 + rand() * 4);
      ctx.beginPath();
      ctx.moveTo(px - h * 0.18, base);
      ctx.lineTo(px, base - h);
      ctx.lineTo(px + h * 0.18, base);
      ctx.fill();
    }
  }

  // A small shrine gate far up the slope, seen from the front.
  function paintTorii(ctx, g, sky) {
    const col = mixColor(mixColor(rgb('#b0452c'), sky.haze, 0.45), rgb('#2a1c28'), sky.night * 0.5);
    ctx.fillStyle = hex(col);
    const px = g.W * 0.64;
    const base = g.H * 0.565;
    const u = g.U;
    ctx.fillRect(px - u * 1.7, base - u * 5.2, Math.max(1, u * 0.5), u * 5.2);
    ctx.fillRect(px + u * 1.2, base - u * 5.2, Math.max(1, u * 0.5), u * 5.2);
    ctx.fillRect(px - u * 2.4, base - u * 5.6, u * 4.8, Math.max(1, u * 0.6));
    ctx.fillRect(px - u * 1.9, base - u * 4.2, u * 3.8, Math.max(1, u * 0.35));
  }

  function paintMeadow(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintRanges(ctx, g, sky);
    paintCedars(ctx, g, sky, rand);
    paintTorii(ctx, g, sky);
    const top = g.H * MEADOW_TOP;
    const near = mixColor(mixColor(rgb('#4d6a44'), sky.amb, 0.2), rgb('#101a1c'), sky.night * 0.8);
    const far = mixColor(mixColor(rgb('#58704e'), sky.haze, 0.45), rgb('#16202a'), sky.night * 0.7);
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, hex(far));
    grad.addColorStop(1, hex(near));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, top + g.U * 2);
    for (let px = 0; px <= g.W; px += 3) {
      ctx.lineTo(px, top + g.H * 0.02 * (1 + Math.sin(px * 0.012 + 1) + 0.5 * Math.sin(px * 0.03)));
    }
    ctx.lineTo(g.W, g.H);
    ctx.lineTo(0, g.H);
    ctx.fill();
    paintTufts(ctx, g, sky, rand, top, FRONT_TOP * g.H);
    paintFarFlowers(ctx, g, sky, rand, top + g.U, g.H * FRONT_TOP);
    return c;
  }

  function paintTufts(ctx, g, sky, rand, y0, y1) {
    const blade = mixColor(mixColor(rgb('#6a8456'), sky.amb, 0.25), rgb('#16241c'), sky.night * 0.75);
    ctx.fillStyle = hex(blade);
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < g.W * 1.2; i++) {
      const px = rand() * g.W;
      const py = lerp(y0, y1, rand());
      ctx.fillRect(px, py, 1, Math.max(1, g.U * (0.5 + rand())));
    }
    ctx.globalAlpha = 1;
  }

  // ---- flowers -----------------------------------------------------------

  function petalColor(sky, rand) {
    const base = mixColor(rgb('#7a64c4'), rgb('#a27ad2'), rand());
    return hex(mixColor(mixColor(base, sky.amb, 0.15), rgb('#1c1a40'), sky.night * 0.5));
  }

  // Five-pointed open bell, seen from the front.
  function star(ctx, px, py, r, rot) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = rot + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.42;
      ctx.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  function paintFarFlowers(ctx, g, sky, rand, y0, y1) {
    for (let i = 0; i < 120; i++) {
      const k = rand();
      const py = lerp(y0, y1, k);
      const px = rand() * g.W;
      ctx.fillStyle = petalColor(sky, rand);
      star(ctx, px, py, g.U * (0.35 + k * 0.9), -Math.PI / 2);
    }
  }

  // A flower with its stem, drawn onto the sway strip.
  function paintFlower(ctx, g, sky, rand, px, py, r) {
    ctx.strokeStyle = hex(mixColor(mixColor(rgb('#2c4a30'), sky.amb, 0.1), rgb('#0c1412'), sky.night * 0.8));
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.beginPath();
    ctx.moveTo(px, py + r * 3.2);
    ctx.quadraticCurveTo(px + r * (rand() - 0.5), py + r * 1.6, px, py);
    ctx.stroke();
    // A pair of narrow leaves.
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(px, py + r * 2.2);
    ctx.lineTo(px - r * 1.6, py + r * 1.8);
    ctx.lineTo(px, py + r * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px, py + r * 2.7);
    ctx.lineTo(px + r * 1.6, py + r * 2.1);
    ctx.lineTo(px, py + r * 2.4);
    ctx.fill();
    ctx.fillStyle = petalColor(sky, rand);
    star(ctx, px, py, r, -Math.PI / 2 + (rand() - 0.5) * 0.4);
    ctx.fillStyle = hex(mixColor(rgb('#e8e2cc'), rgb('#9a8cc0'), 0.4));
    ctx.fillRect(px - r * 0.12, py - r * 0.12, Math.max(1, r * 0.25), Math.max(1, r * 0.25));
    // A closed bud beside it.
    if (rand() > 0.5) {
      ctx.fillStyle = petalColor(sky, rand);
      ctx.beginPath();
      ctx.ellipse(px + r * 1.5, py + r * 0.9, r * 0.34, r * 0.55, 0.4, 0, 6.3);
      ctx.fill();
    }
  }

  // Susuki plume, drawn upright.
  function paintSusuki(ctx, g, sky, px, base, h) {
    ctx.strokeStyle = hex(mixColor(mixColor(rgb('#8a8460'), sky.amb, 0.25), rgb('#222a28'), sky.night * 0.7));
    ctx.lineWidth = Math.max(1, g.U * 0.18);
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(px, base);
      ctx.quadraticCurveTo(px + k * h * 0.1, base - h * 0.6, px + k * h * 0.28, base - h);
      ctx.stroke();
    }
  }

  function paintLantern(ctx, g, sky) {
    const u = g.U;
    const px = g.W * LANTERN_X;
    const base = g.H * 0.93;
    const stone = mixColor(mixColor(rgb('#9a9a94'), sky.amb, 0.3), rgb('#222638'), sky.night * 0.65);
    const dark = mixColor(stone, rgb('#12141e'), 0.35);
    ctx.fillStyle = hex(dark);
    ctx.fillRect(px - u * 2.6, base - u * 1.2, u * 5.2, u * 1.2);
    ctx.fillStyle = hex(stone);
    ctx.fillRect(px - u * 0.9, base - u * 9, u * 1.8, u * 7.8);
    ctx.fillRect(px - u * 2.4, base - u * 10.4, u * 4.8, u * 1.4);
    ctx.fillRect(px - u * 2.2, base - u * 14.4, u * 4.4, u * 4);
    // The lit window.
    const lit = sky.night * 0.85 + 0.1;
    ctx.fillStyle = hex(mixColor(rgb('#2a2630'), rgb('#e8b45a'), lit));
    ctx.fillRect(px - u * 1.1, base - u * 13.4, u * 2.2, u * 2.2);
    // Roof with upturned eaves, then the jewel on top.
    ctx.fillStyle = hex(dark);
    ctx.beginPath();
    ctx.moveTo(px - u * 4.2, base - u * 14);
    ctx.lineTo(px - u * 3.2, base - u * 15);
    ctx.lineTo(px, base - u * 17.6);
    ctx.lineTo(px + u * 3.2, base - u * 15);
    ctx.lineTo(px + u * 4.2, base - u * 14);
    ctx.lineTo(px + u * 2.4, base - u * 14.4);
    ctx.lineTo(px - u * 2.4, base - u * 14.4);
    ctx.fill();
    ctx.fillStyle = hex(stone);
    ctx.beginPath();
    ctx.arc(px, base - u * 18.2, u * 0.7, 0, 6.3);
    ctx.fill();
    if (lit > 0.3) {
      const halo = ctx.createRadialGradient(px, base - u * 12.3, 0, px, base - u * 12.3, u * 7);
      halo.addColorStop(0, `rgba(232,180,90,${0.35 * lit})`);
      halo.addColorStop(1, 'rgba(232,180,90,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(px - u * 8, base - u * 20, u * 16, u * 16);
    }
  }

  // The sway strip: foreground flowers, lantern and grass.
  function paintFront(g, sky, rand) {
    const top = Math.floor(g.H * FRONT_TOP);
    const c = layer(g.W, g.H - top);
    const ctx = c.getContext('2d');
    ctx.translate(0, -top);
    const lx = g.W * LANTERN_X;
    for (let i = 0; i < 9; i++) {
      paintSusuki(ctx, g, sky, rand() * g.W, g.H * (0.8 + rand() * 0.2), g.U * (7 + rand() * 6));
    }
    paintLantern(ctx, g, sky);
    const rows = 7;
    for (let row = 0; row < rows; row++) {
      const k = row / (rows - 1);
      const r = g.U * lerp(1.8, 5, k);
      const count = Math.round(lerp(16, 6, k) * (g.W / 400));
      const baseY = lerp(g.H * 0.76, g.H * 0.9, k);
      for (let n = 0; n < count; n++) {
        const px = ((n + rand() * 0.8) / count) * g.W;
        if (Math.abs(px - lx) < g.U * (2.5 + k * 2)) continue;
        paintFlower(ctx, g, sky, rand, px, baseY - rand() * g.U * 2, r * (0.85 + rand() * 0.3));
      }
    }
    return c;
  }

  function paintMist(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.012, y * 0.05, 4, 41), fbm((x - w) * 0.012, y * 0.05, 4, 41), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 236;
        img.data[i + 1] = 234;
        img.data[i + 2] = 240;
        img.data[i + 3] = smoothstep(0.38, 0.7, v) * band * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintGlow() {
    const c = layer(16, 16);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    grad.addColorStop(0, 'rgba(226,230,150,0.95)');
    grad.addColorStop(0.35, 'rgba(206,214,120,0.35)');
    grad.addColorStop(1, 'rgba(200,210,110,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 16, 16);
    return c;
  }

  function repaint(g, choice) {
    const hr = S.hour(choice);
    const sky = S.at(hr);
    const rand = K.rng(57);
    state.sky = paintSky(g, sky, rand);
    state.meadow = paintMeadow(g, sky, rand);
    state.front = paintFront(g, sky, rand);
    state.mistAlpha = 0.24 - sky.night * 0.15;
    const dusk = hr >= 12 ? smoothstep(16.5, 18.5, hr) : 0;
    state.glow = Math.max(sky.night, dusk);
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.mist;
    const a = Math.min(1, state.mistAlpha * amount);
    const y0 = g.H * 0.55;
    const off1 = -((t * g.U * 0.9) % c.width);
    const off2 = -((t * g.U * 0.5 + c.width * 0.5) % c.width);
    ctx.globalAlpha = a;
    ctx.drawImage(c, off1, y0);
    ctx.drawImage(c, off1 + c.width, y0);
    ctx.globalAlpha = a * 0.8;
    ctx.drawImage(c, off2, y0 + g.H * 0.17, c.width, c.height * 0.8);
    ctx.drawImage(c, off2 + c.width, y0 + g.H * 0.17, c.width, c.height * 0.8);
    ctx.globalAlpha = 1;
  }

  // Flowers lean in the breeze, more toward the tips than at the ground.
  function drawFront(ctx, g, t) {
    const src = state.front;
    const top = Math.floor(g.H * FRONT_TOP);
    const h = src.height;
    for (let s = 0; s < h; s += 2) {
      const k = 1 - s / h;
      const wave = Math.sin(t * 1.3 + s * 0.05) * g.U * 0.6 * k * k;
      ctx.drawImage(src, 0, s, src.width, 2, wave, top + s, src.width, 2);
    }
  }

  function drawFireflies(ctx, g, t) {
    const gl = state.glow;
    if (gl <= 0.05) return;
    const n = Math.round(FLY * gl);
    const s = g.U * 4.2;
    for (let i = 0; i < n; i++) {
      const ph = i * 7.13;
      const px = g.W * ((i * 0.6180339) % 1) + Math.sin(t * 0.3 + ph) * g.U * 5;
      const py = g.H * (0.6 + 0.33 * ((i * 0.3819) % 1)) + Math.sin(t * 0.45 + ph * 1.7) * g.U * 3;
      ctx.globalAlpha = gl * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.7 + ph)));
      ctx.drawImage(state.dot, px - s / 2, py - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.mist = paintMist(Math.ceil(g.W * 1.3), Math.ceil(g.H * 0.22));
    state.dot = paintGlow();
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    ctx.drawImage(state.meadow, 0, 0);
    drawMist(ctx, g, t, props.mist);
    drawFront(ctx, g, t);
    if (props.fireflies) drawFireflies(ctx, g, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', mist: 1, fireflies: true, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
