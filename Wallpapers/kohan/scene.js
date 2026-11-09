/*
 * 湖畔 Kohan — a lakeshore at first light. Fuji and pine hills in the haze,
 * a red torii standing in the water, a wooden rowboat moored on a rope and
 * susuki reeds in front. Sky, hills, lake and shore are baked once a minute
 * from the clock; mist, ripples, the boat and the reeds move between.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.55;
  const TORII = { x: 0.7, w: 0.07 };
  const BOAT = { x: 0.36, y: 0.74 };
  const RETINT_SECONDS = 60;
  const REED_STRIPS = 8;
  const state = {};

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function tone(base, sky, night, k) {
    return mixColor(mixColor(rgb(base), sky.amb, k), rgb('#10142a'), night * 0.7);
  }

  // ---- sky and far hills -------------------------------------------------

  function paintSky(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * HORIZON);
    grad.addColorStop(0, hex(sky.top));
    grad.addColorStop(1, hex(sky.low));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H * HORIZON + 1);
    if (sky.night > 0.1) {
      ctx.fillStyle = '#e6e4da';
      for (let i = 0; i < g.W * 0.5; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.4, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    const sunUp = sky.hour > 5.5 && sky.hour < 19.5;
    const t = sunUp ? S.sunT(sky.hour) : S.moonT(sky.hour);
    const cx = g.W * (0.12 + t * 0.5);
    const cy = g.H * (HORIZON - 0.04 - Math.sin(t * Math.PI) * 0.3);
    const r = g.U * (sunUp ? 4.5 : 3.2);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 6);
    glow.addColorStop(0, sunUp ? 'rgba(250,224,170,0.22)' : 'rgba(210,216,236,0.3)');
    glow.addColorStop(1, 'rgba(250,224,170,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r * 6, cy - r * 6, r * 12, r * 12);
    ctx.fillStyle = sunUp ? '#f6e2b4' : '#e8e8dc';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 6.3);
    ctx.fill();
    state.sunX = cx;
    return c;
  }

  function fujiRidge(g, x) {
    const px = g.W * 0.8;
    const d = Math.abs(x - px) / (g.W * 0.36);
    const base = g.H * HORIZON;
    return base - g.H * 0.3 * Math.pow(Math.max(0, 1 - d), 1.8);
  }

  function paintFuji(ctx, g, sky) {
    const snow = tone('#eef0f2', sky, sky.night, 0.3);
    const rock = mixColor(mixColor(rgb('#5a6c8c'), sky.haze, 0.6), rgb('#232a48'), sky.night * 0.6);
    const top = g.H * (HORIZON - 0.3);
    for (let x = Math.floor(g.W * 0.4); x < g.W; x++) {
      const y0 = fujiRidge(g, x);
      if (y0 >= g.H * HORIZON) continue;
      const line = top + g.H * 0.075 + (fbm(x * 0.05, 3, 3, 11) - 0.5) * g.H * 0.04;
      ctx.fillStyle = hex(mixColor(snow, sky.haze, 0.25));
      ctx.fillRect(x, y0, 1, Math.max(0, line - y0));
      ctx.fillStyle = hex(rock);
      ctx.fillRect(x, Math.max(y0, line), 1, g.H * HORIZON - Math.max(y0, line));
    }
  }

  function paintHills(ctx, g, sky, seed, base, amp, color, mix) {
    ctx.fillStyle = hex(mixColor(rgb(color), sky.haze, mix));
    ctx.beginPath();
    ctx.moveTo(0, g.H * HORIZON + 1);
    for (let x = 0; x <= g.W; x += 2) {
      ctx.lineTo(x, g.H * (base - amp * fbm(x * 0.012, seed, 4, seed)));
    }
    ctx.lineTo(g.W, g.H * HORIZON + 1);
    ctx.fill();
  }

  // Dark conifers on the near hill: small triangles along the ridge.
  function paintPines(ctx, g, sky, rand) {
    ctx.fillStyle = hex(tone('#2e4838', sky, sky.night, 0.1));
    for (let i = 0; i < g.W * 0.35; i++) {
      const x = rand() * g.W;
      const ridgeY = g.H * (0.545 - 0.075 * fbm(x * 0.012, 7, 4, 7));
      const h = g.U * (2 + rand() * 3);
      const y = ridgeY + rand() * g.U * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y - h);
      ctx.lineTo(x - h * 0.28, y);
      ctx.lineTo(x + h * 0.28, y);
      ctx.fill();
    }
  }

  // ---- lake --------------------------------------------------------------

  function paintLake(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const y0 = g.H * HORIZON;
    const grad = ctx.createLinearGradient(0, y0, 0, g.H);
    grad.addColorStop(0, hex(mixColor(sky.low, sky.haze, 0.3)));
    grad.addColorStop(0.5, hex(mixColor(sky.top, sky.low, 0.7)));
    grad.addColorStop(1, hex(mixColor(sky.top, sky.low, 0.75)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, g.W, g.H - y0);
    // The sky's light lies as a soft column on the water.
    const gx = state.sunX;
    const col = ctx.createLinearGradient(gx - g.U * 8, 0, gx + g.U * 8, 0);
    col.addColorStop(0, 'rgba(250,226,180,0)');
    col.addColorStop(0.5, `rgba(250,226,180,${0.3 * (1 - sky.night * 0.6)})`);
    col.addColorStop(1, 'rgba(250,226,180,0)');
    ctx.fillStyle = col;
    ctx.fillRect(gx - g.U * 8, y0, g.U * 16, g.H - y0);
    return c;
  }

  // Still hills mirrored under the horizon, then softened.
  function paintMirror(g, sky, src) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const y0 = g.H * HORIZON;
    const hh = g.H * 0.25;
    ctx.save();
    ctx.translate(0, y0);
    ctx.scale(1, -1);
    ctx.drawImage(src, 0, y0 - hh, g.W, hh, 0, 0, g.W, hh);
    ctx.restore();
    ctx.globalCompositeOperation = 'destination-in';
    const fade = ctx.createLinearGradient(0, y0, 0, y0 + hh);
    fade.addColorStop(0, 'rgba(0,0,0,0.5)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, y0, g.W, hh);
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  // Thin pale strokes that tile sideways and slide slowly.
  function paintRipples(g, sky, rand) {
    const w = Math.ceil(g.W * 1.2);
    const c = layer(w, g.H * 0.45);
    const ctx = c.getContext('2d');
    ctx.fillStyle = hex(mixColor(rgb('#f0ece0'), sky.amb, 0.4));
    for (let i = 0; i < g.W * 0.9; i++) {
      const row = Math.pow(rand(), 1.6);
      const x = rand() * w;
      const len = g.U * (1 + row * 5 + rand() * 2);
      ctx.globalAlpha = (0.08 + rand() * 0.14) * (1 - sky.night * 0.5);
      ctx.fillRect(x, row * c.height, len, Math.max(1, row * g.U * 0.35));
      if (x + len > w) ctx.fillRect(x - w, row * c.height, len, Math.max(1, row * g.U * 0.35));
    }
    ctx.globalAlpha = 1;
    return c;
  }

  // ---- torii -------------------------------------------------------------

  function paintTorii(ctx, g, sky) {
    const red = mixColor(rgb('#b8452e'), sky.haze, 0.2 + sky.night * 0.1);
    const dark = tone('#2a2630', sky, sky.night, 0.1);
    const cx = g.W * TORII.x;
    const w = g.W * TORII.w;
    const base = g.H * (HORIZON + 0.045);
    const top = base - g.H * 0.17;
    const post = Math.max(2, g.U * 1.1);
    ctx.fillStyle = hex(mixColor(red, rgb('#10142a'), sky.night * 0.65));
    for (const sx of [-0.36, 0.36]) {
      ctx.fillRect(cx + w * sx - post / 2, top, post, base - top);
    }
    ctx.fillRect(cx - w * 0.5, top + g.H * 0.045, w, Math.max(2, g.U * 0.8));
    // Top beam curves up at both ends.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.62, top - g.U * 1);
    ctx.quadraticCurveTo(cx, top + g.U * 1.2, cx + w * 0.62, top - g.U * 1);
    ctx.lineTo(cx + w * 0.62, top + g.U * 0.5);
    ctx.quadraticCurveTo(cx, top + g.U * 2.4, cx - w * 0.62, top + g.U * 0.5);
    ctx.fill();
    ctx.fillStyle = hex(dark);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.64, top - g.U * 1.3);
    ctx.quadraticCurveTo(cx, top + g.U * 0.8, cx + w * 0.64, top - g.U * 1.3);
    ctx.lineTo(cx + w * 0.64, top - g.U * 0.9);
    ctx.quadraticCurveTo(cx, top + g.U * 1.2, cx - w * 0.64, top - g.U * 0.9);
    ctx.fill();
    state.toriiBase = base;
  }

  function paintToriiReflection(g, sky, front) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const base = state.toriiBase;
    const h = g.H * 0.2;
    ctx.save();
    ctx.translate(0, base);
    ctx.scale(1, -1);
    ctx.drawImage(front, 0, base - h, g.W, h, 0, 0, g.W, h);
    ctx.restore();
    ctx.globalCompositeOperation = 'destination-in';
    const fade = ctx.createLinearGradient(0, base, 0, base + h);
    fade.addColorStop(0, 'rgba(0,0,0,0.45)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, base, g.W, h);
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  // ---- boat, post, reeds -------------------------------------------------

  function paintBoat(g, sky) {
    const w = Math.round(g.W * 0.27);
    const h = Math.round(g.U * 12);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const wood = tone('#8a6440', sky, sky.night, 0.18);
    const deep = tone('#4a3424', sky, sky.night, 0.1);
    const hullY = h * 0.55;
    ctx.fillStyle = hex(wood);
    ctx.beginPath();
    ctx.moveTo(w * 0.04, hullY - h * 0.2);
    ctx.quadraticCurveTo(w * 0.1, hullY + h * 0.38, w * 0.3, hullY + h * 0.4);
    ctx.lineTo(w * 0.72, hullY + h * 0.4);
    ctx.quadraticCurveTo(w * 0.92, hullY + h * 0.3, w * 0.97, hullY - h * 0.28);
    ctx.quadraticCurveTo(w * 0.5, hullY - h * 0.05, w * 0.04, hullY - h * 0.2);
    ctx.fill();
    ctx.fillStyle = hex(deep);
    ctx.fillRect(w * 0.1, hullY + h * 0.05, w * 0.82, Math.max(1, h * 0.05));
    ctx.fillRect(w * 0.3, hullY - h * 0.12, w * 0.04, h * 0.12);
    ctx.fillRect(w * 0.62, hullY - h * 0.14, w * 0.04, h * 0.14);
    // One long oar leaning across and a coil of rope on the bow.
    ctx.strokeStyle = hex(wood);
    ctx.lineWidth = Math.max(1, g.U * 0.35);
    ctx.beginPath();
    ctx.moveTo(w * 0.3, hullY - h * 0.1);
    ctx.lineTo(w * 0.78, h * 0.02);
    ctx.stroke();
    ctx.fillStyle = hex(tone('#d8c9a0', sky, sky.night, 0.2));
    ctx.fillRect(w * 0.05, hullY - h * 0.28, Math.max(2, g.U * 0.8), Math.max(1, g.U * 0.6));
    return c;
  }

  function paintPost(ctx, g, sky) {
    const x = g.W * (BOAT.x - 0.015);
    const top = g.H * (BOAT.y - 0.075);
    const base = g.H * (BOAT.y + 0.015);
    ctx.fillStyle = hex(tone('#5a4630', sky, sky.night, 0.12));
    ctx.fillRect(x, top, Math.max(2, g.U * 1), base - top);
    ctx.fillStyle = hex(tone('#7a6244', sky, sky.night, 0.12));
    ctx.fillRect(x, top, Math.max(2, g.U * 1), Math.max(1, g.U * 0.4));
  }

  function paintReeds(g, sky, rand) {
    const w = Math.ceil(g.W * 0.2);
    const h = Math.ceil(g.H * 0.3);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const stem = tone('#7a7a48', sky, sky.night, 0.12);
    const plume = tone('#d8c8a0', sky, sky.night, 0.25);
    ctx.lineWidth = Math.max(1, g.U * 0.28);
    for (let i = 0; i < 50; i++) {
      const x = rand() * w;
      const len = h * (0.35 + rand() * 0.6);
      const lean = (rand() - 0.5) * g.U * 3;
      ctx.strokeStyle = hex(rand() < 0.2 ? tone('#506040', sky, sky.night, 0.1) : stem);
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.quadraticCurveTo(x + lean * 0.3, h - len * 0.6, x + lean, h - len);
      ctx.stroke();
      if (rand() < 0.55) {
        ctx.fillStyle = hex(plume);
        ctx.beginPath();
        ctx.ellipse(x + lean, h - len - g.U * 0.8, g.U * 0.3, g.U * 1.2, lean * 0.05, 0, 6.3);
        ctx.fill();
      }
    }
    return c;
  }

  function paintShore(ctx, g, sky, rand) {
    const y0 = g.H * 0.93;
    ctx.fillStyle = hex(tone('#3e4a34', sky, sky.night, 0.1));
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, y0 + (fbm(x * 0.02, 5, 3, 13) - 0.5) * g.U * 5);
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    ctx.fillStyle = hex(tone('#6a6a56', sky, sky.night, 0.1));
    for (let i = 0; i < 40; i++) ctx.fillRect(rand() * g.W, y0 + rand() * g.U * 6, g.U * (0.6 + rand()), 1);
  }

  // ---- mist --------------------------------------------------------------

  function paintMist(g, sky) {
    const w = Math.ceil(g.W * 1.4);
    const h = Math.ceil(g.H * 0.2);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const tint = mixColor(rgb('#f2eee6'), sky.low, 0.35);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.012, y * 0.06, 4, 41), fbm((x - w) * 0.012, y * 0.06, 4, 41), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = tint[0];
        img.data[i + 1] = tint[1];
        img.data[i + 2] = tint[2];
        img.data[i + 3] = smoothstep(0.38, 0.7, v) * band * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(17);
    state.sky = paintSky(g, sky, rand);
    const far = layer(g.W, g.H);
    const fctx = far.getContext('2d');
    fctx.drawImage(state.sky, 0, 0);
    paintFuji(fctx, g, sky);
    paintHills(fctx, g, sky, 3, 0.56, 0.1, '#6a7f8c', 0.5);
    paintHills(fctx, g, sky, 7, 0.565, 0.1, '#3c5848', 0.3);
    paintPines(fctx, g, sky, rand);
    state.back = far;
    state.lake = paintLake(g, sky);
    state.mirror = paintMirror(g, sky, far);
    state.ripples = paintRipples(g, sky, rand);
    const front = layer(g.W, g.H);
    const ctx = front.getContext('2d');
    paintTorii(ctx, g, sky);
    state.toriiMirror = paintToriiReflection(g, sky, front);
    paintPost(ctx, g, sky);
    paintShore(ctx, g, sky, rand);
    state.front = front;
    state.boat = paintBoat(g, sky);
    state.reeds = paintReeds(g, sky, rand);
    state.mist = paintMist(g, sky);
    state.mistAlpha = 0.7 - sky.night * 0.35;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawMist(ctx, g, t, amount) {
    if (amount <= 0) return;
    const c = state.mist;
    const a = Math.min(1, state.mistAlpha * amount);
    const lift = Math.sin(t * 0.12) * g.U * 0.8;
    ctx.globalAlpha = a;
    const off = -((t * g.U * 0.9) % c.width);
    ctx.drawImage(c, off, g.H * 0.46 + lift);
    ctx.drawImage(c, off + c.width, g.H * 0.46 + lift);
    ctx.globalAlpha = a * 0.7;
    const off2 = -((c.width - ((t * g.U * 0.5) % c.width)) % c.width);
    ctx.drawImage(c, off2, g.H * 0.64 - lift);
    ctx.drawImage(c, off2 + c.width, g.H * 0.64 - lift);
    ctx.globalAlpha = 1;
  }

  function drawRipples(ctx, g, t) {
    const c = state.ripples;
    const off = -((t * g.U * 0.6) % c.width);
    ctx.drawImage(c, off, g.H * HORIZON);
    ctx.drawImage(c, off + c.width, g.H * HORIZON);
  }

  function drawBoat(ctx, g, t) {
    const b = state.boat;
    const bob = Math.sin(t * 0.9) * g.U * 0.35;
    const x = g.W * BOAT.x + Math.sin(t * 0.37) * g.U * 0.5;
    const y = g.H * BOAT.y - b.height * 0.55 + bob;
    ctx.save();
    ctx.translate(x + b.width / 2, y + b.height / 2);
    ctx.rotate(Math.sin(t * 0.7) * 0.012);
    ctx.drawImage(b, -b.width / 2, -b.height / 2);
    ctx.restore();
    ctx.globalAlpha = 0.25;
    ctx.drawImage(b, 0, b.height * 0.55, b.width, b.height * 0.45, x + 0, g.H * BOAT.y + g.U * 1.2 + bob, b.width, b.height * 0.3);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#c8b890';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(g.W * (BOAT.x - 0.012), g.H * (BOAT.y - 0.05));
    ctx.lineTo(x + g.U * 0.5, g.H * BOAT.y - g.U * 2.4 + bob);
    ctx.stroke();
  }

  function drawReeds(ctx, g, t, side) {
    const c = state.reeds;
    const sw = c.width / REED_STRIPS;
    const flip = side < 0;
    const x0 = flip ? g.W : 0;
    const y0 = g.H - c.height + g.U * 2;
    for (let s = 0; s < REED_STRIPS; s++) {
      const sway = Math.sin(t * 0.8 + s * 0.7 + (flip ? 2 : 0)) * g.U * 0.5;
      const dx = flip ? x0 - (s + 1) * sw : s * sw;
      ctx.drawImage(c, s * sw, 0, sw + 1, c.height, dx + sway, y0, sw + 1, c.height);
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.back, 0, 0);
    ctx.drawImage(state.lake, 0, 0);
    ctx.drawImage(state.mirror, 0, 0);
    drawRipples(ctx, g, t);
    ctx.drawImage(state.toriiMirror, 0, 0);
    drawMist(ctx, g, t, props.mist);
    ctx.drawImage(state.front, 0, 0);
    if (props.boat) drawBoat(ctx, g, t);
    drawReeds(ctx, g, t, 1);
    drawReeds(ctx, g, t, -1);
  }

  Kasuri.run({
    defaults: { time: 'dawn', mist: 1, boat: true, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
