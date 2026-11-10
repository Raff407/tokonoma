/*
 * 浜辺 Hamabe — a pine-backed shore at evening.
 *
 * Sky, sea, dune, pines, floats and net frame are baked into layers and
 * repainted once a minute from the clock. Between repaints only clouds,
 * sun glitter, surf lines and the swaying net move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep } = K;

  const HORIZON = 0.4;
  const SHORE = 0.64;
  const RETINT_SECONDS = 60;
  const WAVES = 5;
  const NET = { x0: 0.12, x1: 0.4, top: 0.6, bottom: 0.8 };
  const FLOATS = ['#c8453a', '#2f4c8a', '#3c6a4a', '#d9a73a', '#c8453a', '#2f4c8a'];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  const hex = (c) => toHex(c);
  const rgb = (h) => parseColor(h);
  const px = (g, f) => g.W * f;
  const py = (g, f) => g.H * f;

  // ---- sky and sea -------------------------------------------------------

  function sunPos(g, sky) {
    const h = sky.hour;
    const day = h >= 6 && h <= 19.5;
    const t = day ? S.sunT(h) : S.moonT(h);
    return { x: g.W * (0.36 - 0.28 * t), y: g.H * (HORIZON - 0.04 - Math.sin(t * Math.PI) * 0.26), day };
  }

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
      for (let i = 0; i < g.W * 0.6; i++) {
        ctx.globalAlpha = sky.night * (0.15 + rand() * 0.5);
        ctx.fillRect(rand() * g.W, rand() * g.H * 0.3, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    const s = sunPos(g, sky);
    const r = g.U * (s.day ? 5 : 3.5);
    const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 4);
    const tint = s.day ? '255,214,160' : '226,230,240';
    glow.addColorStop(0, `rgba(${tint},0.55)`);
    glow.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(s.x - r * 4, s.y - r * 4, r * 8, r * 8);
    ctx.fillStyle = s.day ? '#f6e2bc' : '#e8e8dc';
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, 6.3);
    ctx.fill();
    return c;
  }

  function paintSea(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const top = py(g, HORIZON);
    const bottom = py(g, SHORE);
    const deep = mixColor(rgb('#2c4a68'), sky.top, 0.35 + sky.night * 0.3);
    const near = mixColor(rgb('#4d7a82'), sky.low, 0.35);
    const grad = ctx.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0, hex(mixColor(deep, sky.low, 0.5)));
    grad.addColorStop(1, hex(mixColor(near, rgb('#14202e'), sky.night * 0.6)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, bottom - top + 1);
    const sp = sunPos(g, sky);
    const col = ctx.createLinearGradient(0, top, 0, bottom);
    col.addColorStop(0, sp.day ? 'rgba(255,200,140,0.5)' : 'rgba(210,220,240,0.35)');
    col.addColorStop(1, 'rgba(255,200,140,0)');
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(sp.x - g.U * 3, top);
    ctx.lineTo(sp.x + g.U * 3, top);
    ctx.lineTo(sp.x + g.U * 16, bottom);
    ctx.lineTo(sp.x - g.U * 16, bottom);
    ctx.fill();
    // faint swell bands
    ctx.fillStyle = hex(mixColor(sky.low, rgb('#ffffff'), 0.3));
    for (let y = top + 2; y < bottom; y += 3 + (y - top) * 0.12) {
      ctx.globalAlpha = 0.1 + 0.08 * fbm(y * 0.2, 1, 2, 3);
      ctx.fillRect(0, y, g.W, 1);
    }
    ctx.globalAlpha = 1;
    // a far headland with a small island
    ctx.fillStyle = hex(mixColor(sky.haze, rgb('#1d2a3a'), 0.35 + sky.night * 0.3));
    ctx.beginPath();
    ctx.moveTo(g.W * 0.62, top);
    for (let x = g.W * 0.62; x <= g.W; x += 2) {
      const f = (x - g.W * 0.62) / (g.W * 0.38);
      ctx.lineTo(x, top - Math.sin(f * 1.6) * g.U * 3.2 * (1 - f * 0.4) - fbm(x * 0.1, 2, 2, 4) * g.U * 0.8);
    }
    ctx.lineTo(g.W, top);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(g.W * 0.4, top, g.U * 4, g.U * 1.1, 0, Math.PI, 0);
    ctx.fill();
    return c;
  }

  function paintCloud(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(fbm(x * 0.014, y * 0.08, 4, 41), fbm((x - w) * 0.014, y * 0.08, 4, 41), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 248;
        img.data[i + 1] = 236;
        img.data[i + 2] = 226;
        img.data[i + 3] = smoothstep(0.55, 0.72, v) * band * 190;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // ---- beach and pines ---------------------------------------------------

  function paintBeach(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const top = py(g, SHORE);
    const sand = mixColor(mixColor(rgb('#cdb98f'), sky.amb, 0.35), rgb('#232634'), sky.night * 0.7);
    const wet = mixColor(sand, rgb('#6e6a64'), 0.45);
    const grad = ctx.createLinearGradient(0, top, 0, g.H);
    grad.addColorStop(0, hex(wet));
    grad.addColorStop(0.14, hex(sand));
    grad.addColorStop(1, hex(mixColor(sand, rgb('#8a7a58'), 0.4)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, g.W, g.H - top);
    // ripples in the sand
    ctx.fillStyle = hex(mixColor(sand, rgb('#6e5e44'), 0.4));
    for (let y = top + g.U * 5; y < g.H; y += g.U * 2.3) {
      for (let x = 0; x < g.W; x += 6) {
        const w = 3 + fbm(x * 0.1, y * 0.2, 2, 7) * 9;
        if (fbm(x * 0.06, y * 0.1, 2, 9) > 0.5) ctx.fillRect(x, y, w, 1);
      }
    }
    return c;
  }

  function pineCrown(ctx, x, y, w, h, col, hi, rand) {
    // flat cloud pads, stacked and offset like a pine in a woodblock print
    const pads = 4 + Math.floor(rand() * 2);
    for (let i = 0; i < pads; i++) {
      const f = i / pads;
      const cx = x + (rand() - 0.5) * w * 0.6;
      const cy = y - h * (0.15 + f * 0.8);
      const pw = w * (0.55 + rand() * 0.45);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(cx, cy, pw / 2, h * 0.11, 0, 0, 6.3);
      ctx.fill();
      ctx.fillStyle = hi;
      ctx.beginPath();
      ctx.ellipse(cx - pw * 0.05, cy - h * 0.03, pw * 0.38, h * 0.045, 0, 0, 6.3);
      ctx.fill();
    }
  }

  function pine(ctx, g, x, base, h, lean, col, hi, bark, rand) {
    ctx.strokeStyle = bark;
    ctx.lineWidth = Math.max(1.5, h * 0.045);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.bezierCurveTo(x + lean * 0.6, base - h * 0.3, x - lean * 0.5, base - h * 0.6, x + lean, base - h * 0.95);
    ctx.stroke();
    pineCrown(ctx, x + lean, base - h * 0.2, h * 0.62, h, col, hi, rand);
    // a side branch with its own pad
    ctx.lineWidth = Math.max(1, h * 0.02);
    ctx.beginPath();
    ctx.moveTo(x + lean * 0.5, base - h * 0.55);
    ctx.lineTo(x + lean * 0.5 - h * 0.28, base - h * 0.66);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x + lean * 0.5 - h * 0.3, base - h * 0.69, h * 0.17, h * 0.05, 0, 0, 6.3);
    ctx.fill();
  }

  function paintPines(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const col = hex(mixColor(mixColor(rgb('#2f4a38'), sky.amb, 0.1), rgb('#22344a'), sky.night * 0.6));
    const hi = hex(mixColor(mixColor(rgb('#4c6a44'), sky.amb, 0.3), rgb('#34486a'), sky.night * 0.6));
    const bark = hex(mixColor(rgb('#2a2220'), rgb('#0c0e16'), sky.night * 0.7));
    // low dune behind the beach, carrying the grove
    const dune = mixColor(mixColor(rgb('#6b7a4a'), sky.amb, 0.15), rgb('#18202a'), sky.night * 0.7);
    ctx.fillStyle = hex(dune);
    ctx.beginPath();
    ctx.moveTo(g.W * 0.58, py(g, SHORE));
    for (let x = g.W * 0.58; x <= g.W; x += 3) {
      const f = (x - g.W * 0.58) / (g.W * 0.42);
      ctx.lineTo(x, py(g, SHORE) - smoothstep(0, 0.35, f) * g.U * 7 - fbm(x * 0.05, 1, 2, 6) * g.U);
    }
    ctx.lineTo(g.W, py(g, SHORE) + 1);
    ctx.fill();
    const base = py(g, SHORE) - g.U * 4;
    pine(ctx, g, px(g, 0.68), base + g.U * 2, g.U * 26, -g.U * 2, col, hi, bark, rand);
    pine(ctx, g, px(g, 0.78), base, g.U * 38, g.U * 3, col, hi, bark, rand);
    pine(ctx, g, px(g, 0.88), base + g.U, g.U * 30, -g.U * 3, col, hi, bark, rand);
    pine(ctx, g, px(g, 0.97), base, g.U * 42, g.U * 2, col, hi, bark, rand);
    pine(ctx, g, px(g, 0.045), py(g, SHORE) - g.U * 1, g.U * 24, g.U * 3, col, hi, bark, rand);
    // beach grass on the dune
    ctx.strokeStyle = hex(mixColor(rgb('#7c8a52'), rgb('#1a2230'), sky.night * 0.7));
    ctx.lineWidth = 1;
    for (let i = 0; i < 30; i++) {
      const gx = px(g, 0.58) + rand() * g.W * 0.42;
      const gy = py(g, SHORE) + g.U * (1 + rand() * 3);
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + (rand() - 0.5) * g.U, gy - g.U * (1 + rand() * 1.5));
      ctx.stroke();
    }
    return c;
  }

  // ---- floats and net frame ----------------------------------------------

  function glassFloat(ctx, x, y, r, col, sky) {
    ctx.fillStyle = hex(mixColor(rgb(col), rgb('#10141e'), sky.night * 0.6));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.35, Math.max(0.6, r * 0.28), 0, 6.3);
    ctx.fill();
    // woven rope cage
    ctx.strokeStyle = hex(mixColor(rgb('#b79c68'), rgb('#2a2824'), sky.night * 0.6));
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r);
    ctx.lineTo(x, y + r);
    ctx.stroke();
  }

  function paintProps(g, sky, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const wood = hex(mixColor(mixColor(rgb('#6b5238'), sky.amb, 0.15), rgb('#14161e'), sky.night * 0.7));
    // two driftwood poles and a cross rail
    ctx.strokeStyle = wood;
    ctx.lineWidth = Math.max(1.5, g.U * 0.9);
    ctx.lineCap = 'round';
    const pole = (f, lean) => {
      ctx.beginPath();
      ctx.moveTo(px(g, f), py(g, NET.bottom + 0.04));
      ctx.lineTo(px(g, f) + lean, py(g, NET.top - 0.03));
      ctx.stroke();
    };
    pole(NET.x0 - 0.01, g.U * 0.5);
    pole(NET.x1 + 0.01, -g.U * 0.4);
    ctx.beginPath();
    ctx.moveTo(px(g, NET.x0 - 0.012), py(g, NET.top - 0.015));
    ctx.lineTo(px(g, NET.x1 + 0.012), py(g, NET.top - 0.015));
    ctx.stroke();
    // wooden boat hauled up on the right of the net
    const bx = px(g, 0.48);
    const by = py(g, 0.8);
    const bw = g.W * 0.26;
    const hull = hex(mixColor(mixColor(rgb('#6a5a44'), sky.amb, 0.15), rgb('#12141c'), sky.night * 0.6));
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(bx - g.U * 2, by - g.U * 9);
    ctx.quadraticCurveTo(bx + bw * 0.12, by + g.U * 1, bx + bw * 0.5, by + g.U * 1.5);
    ctx.quadraticCurveTo(bx + bw * 0.88, by + g.U * 1, bx + bw + g.U * 2, by - g.U * 9);
    ctx.lineTo(bx + bw, by - g.U * 8);
    ctx.lineTo(bx, by - g.U * 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b8412c';
    ctx.globalAlpha = 0.9 - sky.night * 0.4;
    ctx.fillRect(bx, by - g.U * 6.2, bw, g.U * 1.1);
    ctx.fillStyle = hex(mixColor(rgb('#e8e2d0'), rgb('#20242e'), sky.night * 0.6));
    ctx.fillRect(bx + bw * 0.3, by - g.U * 8.6, bw * 0.4, g.U * 0.6);
    ctx.globalAlpha = 1;
    // pile of glass floats in the foreground
    const fx = px(g, 0.7);
    const fy = py(g, 0.9);
    const r = g.U * 2.8;
    const spots = [[0, 0], [2.1, 0.2], [4.3, 0], [1, -1.6], [3.2, -1.7], [2.1, -3.2], [-2, 0.5]];
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(fx + r * 2, fy + r * 0.9, r * 4.4, r * 0.7, 0, 0, 6.3);
    ctx.fill();
    for (let i = 0; i < spots.length; i++) {
      glassFloat(ctx, fx + spots[i][0] * r, fy + spots[i][1] * r, r, FLOATS[i % FLOATS.length], sky);
    }
    // a few small shells
    ctx.fillStyle = '#e8e2d0';
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 10; i++) ctx.fillRect(rand() * g.W, py(g, 0.7) + rand() * g.H * 0.28, 2, 1);
    ctx.globalAlpha = 1;
    return c;
  }

  // Net hung from the rail, one canvas, drawn in thin slices that sway.
  function paintNet(g, sky) {
    const w = Math.max(8, Math.round(g.W * (NET.x1 - NET.x0)));
    const h = Math.max(8, Math.round(g.H * (NET.bottom - NET.top)));
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const cord = hex(mixColor(mixColor(rgb('#d6c9a4'), sky.amb, 0.25), rgb('#262a36'), sky.night * 0.65));
    ctx.strokeStyle = cord;
    ctx.lineWidth = 1;
    const step = Math.max(3, g.U * 1.5);
    ctx.beginPath();
    for (let x = 0; x <= w; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h * (0.88 - 0.12 * Math.abs(Math.sin(x * 0.07))));
    }
    for (let y = step; y < h; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
    // lead sinkers along the hem and a few floats along the head
    ctx.fillStyle = hex(mixColor(rgb('#4a4a50'), rgb('#101218'), sky.night * 0.5));
    for (let x = step; x < w; x += step * 2) ctx.fillRect(x - 1, h * 0.84, 2, 2);
    const flo = Math.max(1.4, g.U * 0.9);
    for (let x = step * 2; x < w; x += step * 5) glassFloat(ctx, x, 3, flo, FLOATS[Math.floor(x / step) % FLOATS.length], sky);
    return c;
  }

  // ---- bake --------------------------------------------------------------

  function repaint(g, choice) {
    const sky = S.at(S.hour(choice));
    const rand = K.rng(53);
    state.sky = paintSky(g, sky, rand);
    state.sea = paintSea(g, sky);
    state.beach = paintBeach(g, sky);
    state.pines = paintPines(g, sky, rand);
    state.props = paintProps(g, sky, rand);
    state.net = paintNet(g, sky);
    state.sun = sunPos(g, sky);
    state.cloudAlpha = 0.7 - sky.night * 0.5;
    state.night = sky.night;
    state.foam = hex(mixColor(rgb('#f2efe4'), sky.amb, 0.25));
    state.glint = sky.night > 0.5 ? '#e6e8f0' : '#f8dca8';
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  // ---- motion ------------------------------------------------------------

  function drawClouds(ctx, g, t) {
    const c = state.cloud;
    const off = -((t * g.U * 0.9) % c.width);
    ctx.globalAlpha = state.cloudAlpha;
    ctx.drawImage(c, off, g.H * 0.05);
    ctx.drawImage(c, off + c.width, g.H * 0.05);
    ctx.globalAlpha = 1;
  }

  // Short bright dashes on the sea under the sun or moon.
  function drawGlints(ctx, g, t) {
    const top = py(g, HORIZON);
    const span = py(g, SHORE) - top;
    ctx.fillStyle = state.glint;
    for (let i = 0; i < 18; i++) {
      const f = (i + 0.5) / 18;
      const y = top + span * f * 0.95;
      const spread = g.U * (2 + f * 9);
      const wob = Math.sin(t * (0.8 + (i % 5) * 0.2) + i * 2.1);
      ctx.globalAlpha = Math.max(0, 0.15 + 0.5 * wob * wob) * (1 - state.night * 0.3);
      ctx.fillRect(state.sun.x + wob * spread - spread * 0.5, y, g.U * (1.5 + f * 3), 1);
    }
    ctx.globalAlpha = 1;
  }

  // Surf lines slide up the beach, thin out and vanish into the sand.
  function drawSurf(ctx, g, t, amount) {
    if (amount <= 0) return;
    const top = py(g, SHORE) - g.U * 12;
    const bottom = py(g, SHORE) + g.U * 5;
    const step = Math.max(4, g.W / 28);
    ctx.strokeStyle = state.foam;
    ctx.lineCap = 'round';
    for (let k = 0; k < WAVES; k++) {
      const a = (t * 0.06 + k / WAVES) % 1;
      const y = lerp(top, bottom, a);
      ctx.globalAlpha = Math.min(1, a * 4) * (1 - smoothstep(0.75, 1, a)) * 0.75 * Math.min(1, amount);
      ctx.lineWidth = Math.max(1, g.U * (0.35 + a * 0.5));
      ctx.beginPath();
      for (let x = -step; x <= g.W + step; x += step) {
        const yy = y + Math.sin(x * 0.05 + k * 2.3 + t * 0.4) * g.U * (0.6 + a);
        if (x < 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawNet(ctx, g, t, breeze) {
    const art = state.net;
    const x0 = px(g, NET.x0);
    const top = py(g, NET.top);
    const slice = 2;
    for (let s = 0; s < art.width; s += slice) {
      const k = s / art.width;
      const sway = Math.sin(t * 1.3 + k * 5) * g.U * 0.5 * breeze;
      for (let d = 0; d < 1; d++) {
        ctx.drawImage(art, s, 0, slice, art.height, x0 + s + sway * Math.sin(k * 3.1), top, slice, art.height);
      }
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.cloud = paintCloud(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.22));
    repaint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, props.time);
    ctx.drawImage(state.sky, 0, 0);
    drawClouds(ctx, g, t);
    ctx.drawImage(state.sea, 0, 0);
    drawGlints(ctx, g, t);
    ctx.drawImage(state.beach, 0, 0);
    drawSurf(ctx, g, t, props.surf);
    ctx.drawImage(state.pines, 0, 0);
    ctx.drawImage(state.props, 0, 0);
    drawNet(ctx, g, t, props.breeze);
  }

  Kasuri.run({
    defaults: { time: 'auto', surf: 1, breeze: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
