/*
 * 鈴虫 Suzumushi — bell crickets in autumn grass on a moonlit night.
 *
 * Sky, moon, hills, pagoda and the dark foreground are baked once. Susuki stems
 * with pale plumes sway in front, a thin cloud strip slides over the moon, and a
 * few small glints wake and fade slowly in the grass.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { fbm, smoothstep } = K;

  const MOON = { x: 0.7, y: 0.25, r: 0.1 };
  const STEMS = 64;
  const GLINTS = 16;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function paintSky(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.7);
    grad.addColorStop(0, '#141c38');
    grad.addColorStop(1, '#34457a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    const rand = K.rng(17);
    ctx.fillStyle = '#e6e4da';
    for (let i = 0; i < g.W * 0.35; i++) {
      ctx.globalAlpha = 0.15 + rand() * 0.4;
      ctx.fillRect(rand() * g.W, rand() * g.H * 0.5, 1, 1);
    }
    ctx.globalAlpha = 1;
    const mx = g.W * MOON.x;
    const my = g.H * MOON.y;
    const mr = g.H * MOON.r;
    const halo = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 4);
    halo.addColorStop(0, 'rgba(236,222,170,0.45)');
    halo.addColorStop(1, 'rgba(236,222,170,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.fillStyle = '#f2ead0';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = 'rgba(190,176,130,0.35)';
    for (const [dx, dy, r] of [[-0.3, -0.2, 0.28], [0.25, 0.25, 0.2], [0.1, -0.45, 0.14]]) {
      ctx.beginPath();
      ctx.arc(mx + dx * mr, my + dy * mr, r * mr, 0, 6.3);
      ctx.fill();
    }
    return c;
  }

  function ridgeY(g, x, base, amp, seed) {
    return g.H * base - (fbm(x * 0.012, seed, 3, seed) - 0.5) * g.H * amp;
  }

  function fillRidge(ctx, g, base, amp, seed, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W; x += 2) ctx.lineTo(x, ridgeY(g, x, base, amp, seed));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
  }

  // Five-storey pagoda, drawn as a stack of shrinking tiered roofs.
  function paintPagoda(ctx, g, cx, baseY, u) {
    ctx.fillStyle = '#222c58';
    let y = baseY;
    for (let i = 0; i < 5; i++) {
      const w = u * (4.2 - i * 0.55);
      const h = u * 1.7;
      ctx.fillRect(cx - w * 0.3, y - h, w * 0.6, h);
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.95, y - h);
      ctx.lineTo(cx - w * 0.5, y - h - u * 0.5);
      ctx.lineTo(cx + w * 0.5, y - h - u * 0.5);
      ctx.lineTo(cx + w * 0.95, y - h);
      ctx.lineTo(cx + w * 0.4, y - h - u * 0.15);
      ctx.lineTo(cx - w * 0.4, y - h - u * 0.15);
      ctx.fill();
      y -= h + u * 0.3;
    }
    ctx.fillRect(cx - u * 0.1, y - u * 2.6, u * 0.2, u * 2.8);
  }

  function paintBlade(ctx, x, y, h, lean, w) {
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x, y - h * 0.6, x + lean, y - h);
    ctx.quadraticCurveTo(x + w * 0.4, y - h * 0.6, x + w, y);
    ctx.fill();
  }

  function paintHagi(ctx, g, rand) {
    const stems = 5;
    for (let s = 0; s < stems; s++) {
      let x = g.W * (0.04 + s * 0.035);
      let y = g.H * 0.93;
      let dir = 1;
      ctx.strokeStyle = '#2a3a2c';
      ctx.lineWidth = Math.max(1, g.U * 0.4);
      ctx.beginPath();
      ctx.moveTo(x, y);
      const tipx = x + g.W * (0.05 + rand() * 0.07);
      const tipy = g.H * (0.62 + rand() * 0.1);
      ctx.quadraticCurveTo(x + g.W * 0.01, tipy, tipx, tipy + g.H * 0.06);
      ctx.stroke();
      for (let i = 0; i < 22; i++) {
        const t = i / 21;
        const px = x + (tipx - x) * (0.1 + t * 0.9) + (rand() - 0.5) * g.U * 3;
        const py = y + (tipy + g.H * 0.04 - y) * (0.2 + t * 0.8) + (rand() - 0.5) * g.U * 3;
        ctx.fillStyle = rand() < 0.5 ? '#3d5a3c' : '#a8607a';
        ctx.globalAlpha = 0.9;
        ctx.fillRect(px, py, Math.max(1, g.U * 0.7), Math.max(1, g.U * 0.7));
      }
      dir = -dir;
    }
    ctx.globalAlpha = 1;
  }

  function paintFront(g) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const rand = K.rng(5);
    fillRidge(ctx, g, 0.6, 0.12, 3, '#3a4a7c');
    paintPagoda(ctx, g, g.W * 0.26, g.H * 0.585, g.U * 2.3);
    fillRidge(ctx, g, 0.7, 0.1, 7, '#252f58');
    fillRidge(ctx, g, 0.82, 0.05, 11, '#141b36');
    ctx.fillStyle = '#0f1630';
    ctx.fillRect(0, g.H * 0.93, g.W, g.H * 0.07);
    paintHagi(ctx, g, rand);
    ctx.fillStyle = '#0c1228';
    for (let i = 0; i < g.W * 0.7; i++) {
      const x = rand() * g.W;
      paintBlade(ctx, x, g.H, g.H * (0.05 + rand() * 0.1), (rand() - 0.5) * g.U * 3, g.U * 0.35);
    }
    return c;
  }

  function makeCloud(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = K.lerp(fbm(x * 0.012, y * 0.09, 4, 21), fbm((x - w) * 0.012, y * 0.09, 4, 21), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 150;
        img.data[i + 1] = 160;
        img.data[i + 2] = 190;
        img.data[i + 3] = smoothstep(0.5, 0.7, v) * band * 150;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function makeStems(g) {
    const rand = K.rng(41);
    const stems = [];
    for (let i = 0; i < STEMS; i++) {
      const clump = i % 2 === 0;
      stems.push({
        x: g.W * (0.3 + rand() * 0.72) + (clump ? 0 : g.W * 0.02),
        h: g.H * (0.3 + rand() * 0.24),
        ph: rand() * 6.3,
        lean: (rand() - 0.3) * g.U * 3,
        z: rand(),
      });
    }
    stems.sort((a, b) => a.z - b.z);
    return stems;
  }

  function makeGlints(g) {
    const rand = K.rng(77);
    const out = [];
    for (let i = 0; i < GLINTS; i++) {
      out.push({ x: g.W * (0.05 + rand() * 0.9), y: g.H * (0.68 + rand() * 0.28), ph: rand() * 6.3, sp: 0.25 + rand() * 0.3 });
    }
    return out;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    state.g = g;
    state.sky = paintSky(g);
    state.front = paintFront(g);
    state.cloud = makeCloud(Math.ceil(g.W * 1.4), Math.ceil(g.H * 0.22));
    state.stems = makeStems(g);
    state.glints = makeGlints(g);
  }

  function drawStems(ctx, g, t, sway) {
    const baseY = g.H * 1.0;
    for (const s of state.stems) {
      const k = 0.5 + s.z * 0.5;
      const swing = (Math.sin(t * 0.9 + s.ph + s.x * 0.02) * 0.7 + Math.sin(t * 0.37 + s.ph) * 0.3) * g.U * 3 * sway;
      const tx = s.x + s.lean + swing;
      const ty = baseY - s.h * k;
      ctx.strokeStyle = s.z > 0.5 ? '#3a4a3a' : '#2a3a32';
      ctx.lineWidth = Math.max(1, g.U * 0.3);
      ctx.beginPath();
      ctx.moveTo(s.x, baseY);
      ctx.quadraticCurveTo(s.x + swing * 0.2, baseY - s.h * k * 0.6, tx, ty);
      ctx.stroke();
      ctx.fillStyle = s.z > 0.5 ? '#cdbf94' : '#a49c78';
      ctx.beginPath();
      ctx.ellipse(tx + g.U * 0.9, ty - g.U * 1.4, g.U * 1.1, g.U * 3.4, 0.5 + swing * 0.03, 0, 6.3);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(tx + g.U * 0.2, ty - g.U * 1.2, g.U * 0.7, g.U * 3, 0.15 + swing * 0.03, 0, 6.3);
      ctx.fill();
    }
  }

  function drawGlints(ctx, g, t) {
    ctx.fillStyle = '#e8dcae';
    for (const p of state.glints) {
      const a = Math.sin(t * p.sp + p.ph);
      if (a <= 0.2) continue;
      ctx.globalAlpha = (a - 0.2) * 0.9;
      ctx.fillRect(p.x, p.y, Math.max(1, g.U * 0.5), Math.max(1, g.U * 0.5));
    }
    ctx.globalAlpha = 1;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    ctx.drawImage(state.sky, 0, 0);
    if (props.clouds > 0) {
      const c = state.cloud;
      const off = -((t * g.U * 1.2) % c.width);
      ctx.globalAlpha = Math.min(1, props.clouds * 0.9);
      ctx.drawImage(c, off, g.H * 0.12);
      ctx.drawImage(c, off + c.width, g.H * 0.12);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(state.front, 0, 0);
    drawStems(ctx, g, t, props.sway);
    if (props.glints) drawGlints(ctx, g, t);
  }

  Kasuri.run({
    defaults: { sway: 1, clouds: 1, glints: true, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.1, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
