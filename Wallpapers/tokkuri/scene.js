/*
 * 徳利 Tokkuri — a sake flask and cup on a lacquer tray at an izakaya counter, a red
 * paper lantern and wooden menu tags on the wall, snow falling past a lattice window.
 * Everything still is baked once; steam puffs and snowflakes are two short reused pools.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const TAU = Math.PI * 2;
  const FLAKES = 60;
  const PUFFS = 10;
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function blob(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(rx, 0.4), Math.max(ry, 0.4), 0, 0, TAU);
    ctx.fill();
  }

  function glow(ctx, x, y, r, rgb, a) {
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function geometry(api) {
    const W = api.cols;
    const H = api.rows;
    const u = Math.min(H / 100, W / 150);
    const top = Math.round(H * 0.56);
    return {
      W, H, u,
      top,                       // back edge of the counter surface
      edge: Math.round(H * 0.86), // front edge of the counter
      win: { x0: W * 0.58, x1: W * 0.95, y0: H * 0.08, y1: H * 0.47 },
      lantern: { x: W * 0.15, y: H * 0.3 },
      flask: { x: W * 0.46, y: H * 0.79 },
      cup: { x: W * 0.62, y: H * 0.8 },
    };
  }

  // ---- baked room ----------------------------------------------------------

  function paintWall(ctx, g) {
    const gr = ctx.createLinearGradient(0, 0, 0, g.top);
    gr.addColorStop(0, '#2a221d');
    gr.addColorStop(1, '#3a2e25');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, g.W, g.top);
    // plaster panels between dark posts
    const posts = [0.02, 0.255, 0.55, 0.98];
    ctx.fillStyle = '#1c1714';
    for (const p of posts) ctx.fillRect(g.W * p - g.u * 1.2, 0, g.u * 2.4, g.top);
    ctx.fillRect(0, g.H * 0.04, g.W, g.u * 1.6);
    // a low wainscot rail just above the counter
    ctx.fillStyle = '#4a3627';
    ctx.fillRect(0, g.top - g.u * 6, g.W, g.u * 6);
    ctx.fillStyle = '#5b4330';
    ctx.fillRect(0, g.top - g.u * 6, g.W, g.u * 0.8);
  }

  function paintMenuTags(ctx, g) {
    const u = g.u;
    const n = 5;
    const x0 = g.W * 0.275;
    const span = g.W * 0.15;
    const y0 = g.H * 0.04 + u * 1.6;
    // rail
    ctx.fillStyle = '#5b4330';
    ctx.fillRect(x0 - u * 2, y0, span + u * 4, u * 1.4);
    const rand = K.rng(31);
    for (let i = 0; i < n; i++) {
      const x = x0 + (span * (i + 0.5)) / n;
      const w = u * 5;
      const h = u * (20 + (i % 2) * 4);
      ctx.fillStyle = '#d8ccae';
      ctx.fillRect(x - w / 2, y0 + u * 1.4, w, h);
      ctx.fillStyle = '#b9ab8a';
      ctx.fillRect(x + w / 2 - u * 0.8, y0 + u * 1.4, u * 0.8, h);
      // brushed characters: short ink strokes down the tag
      ctx.fillStyle = '#231b17';
      let y = y0 + u * 4;
      const strokes = 3 + Math.floor(rand() * 2);
      for (let s = 0; s < strokes; s++) {
        const sw = u * (2 + rand() * 1.8);
        ctx.fillRect(x - sw / 2, y, sw, Math.max(1, u * 0.9));
        if (rand() > 0.4) ctx.fillRect(x - u * 0.4, y - u * 0.8, Math.max(1, u * 0.8), u * 2.6);
        y += u * 4.6;
      }
      // price in vermilion at the foot of two tags
      if (i % 2 === 0) {
        ctx.fillStyle = '#b4442b';
        ctx.fillRect(x - u * 1.2, y0 + h - u * 1.6, u * 2.4, u * 1.4);
      }
    }
  }

  function paintWindowView(ctx, g) {
    const w = g.win;
    const wid = w.x1 - w.x0;
    const hei = w.y1 - w.y0;
    const gr = ctx.createLinearGradient(0, w.y0, 0, w.y1);
    gr.addColorStop(0, '#26314f');
    gr.addColorStop(1, '#48577a');
    ctx.fillStyle = gr;
    ctx.fillRect(w.x0, w.y0, wid, hei);
    // far hills under snow
    ctx.fillStyle = '#7a86a0';
    ctx.beginPath();
    ctx.moveTo(w.x0, w.y1);
    for (let i = 0; i <= 20; i++) {
      const x = w.x0 + (wid * i) / 20;
      ctx.lineTo(x, w.y1 - hei * (0.3 + 0.08 * Math.sin(i * 0.6) + 0.04 * Math.sin(i * 1.9)));
    }
    ctx.lineTo(w.x1, w.y1);
    ctx.fill();
    // snowy pine: stacked tiers, dark needles with white on each tier
    const px = w.x0 + wid * 0.24;
    const base = w.y1;
    const th = hei * 0.78;
    ctx.fillStyle = '#2a2017';
    ctx.fillRect(px - g.u * 0.8, base - hei * 0.12, g.u * 1.6, hei * 0.12);
    for (let i = 0; i < 4; i++) {
      const ty = base - hei * 0.1 - (th * i) / 4.4;
      const half = wid * (0.17 - i * 0.035);
      const tierH = th * 0.3;
      ctx.fillStyle = '#20352c';
      ctx.beginPath();
      ctx.moveTo(px - half, ty);
      ctx.lineTo(px, ty - tierH);
      ctx.lineTo(px + half, ty);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#dde2e8';
      ctx.beginPath();
      ctx.moveTo(px - half * 0.78, ty - tierH * 0.22);
      ctx.lineTo(px, ty - tierH);
      ctx.lineTo(px + half * 0.78, ty - tierH * 0.22);
      ctx.lineTo(px + half * 0.4, ty - tierH * 0.34);
      ctx.lineTo(px, ty - tierH * 0.28);
      ctx.lineTo(px - half * 0.4, ty - tierH * 0.34);
      ctx.closePath();
      ctx.fill();
    }
    // neighbour roof under snow on the right
    ctx.fillStyle = '#2b2f3f';
    ctx.beginPath();
    ctx.moveTo(w.x0 + wid * 0.52, w.y1);
    ctx.lineTo(w.x0 + wid * 0.7, w.y1 - hei * 0.3);
    ctx.lineTo(w.x1, w.y1 - hei * 0.3);
    ctx.lineTo(w.x1, w.y1);
    ctx.fill();
    ctx.fillStyle = '#e2e6ea';
    ctx.beginPath();
    ctx.moveTo(w.x0 + wid * 0.52, w.y1 - hei * 0.02);
    ctx.lineTo(w.x0 + wid * 0.7, w.y1 - hei * 0.33);
    ctx.lineTo(w.x1, w.y1 - hei * 0.33);
    ctx.lineTo(w.x1, w.y1 - hei * 0.25);
    ctx.lineTo(w.x0 + wid * 0.71, w.y1 - hei * 0.25);
    ctx.lineTo(w.x0 + wid * 0.57, w.y1 - hei * 0.02);
    ctx.fill();
    // a warm window in that house
    ctx.fillStyle = '#c99a4e';
    ctx.fillRect(w.x0 + wid * 0.8, w.y1 - hei * 0.18, wid * 0.08, hei * 0.1);
  }

  function paintLattice(ctx, g) {
    const w = g.win;
    const bar = Math.max(1, g.u * 0.8);
    const frame = Math.max(2, g.u * 2.2);
    ctx.fillStyle = '#4a3425';
    ctx.fillRect(w.x0 - frame, w.y0 - frame, w.x1 - w.x0 + frame * 2, frame);
    ctx.fillRect(w.x0 - frame, w.y1, w.x1 - w.x0 + frame * 2, frame * 1.3);
    ctx.fillRect(w.x0 - frame, w.y0, frame, w.y1 - w.y0);
    ctx.fillRect(w.x1, w.y0, frame, w.y1 - w.y0);
    for (let i = 1; i < 4; i++) ctx.fillRect(w.x0 + ((w.x1 - w.x0) * i) / 4 - bar / 2, w.y0, bar, w.y1 - w.y0);
    for (let j = 1; j < 3; j++) ctx.fillRect(w.x0, w.y0 + ((w.y1 - w.y0) * j) / 3 - bar / 2, w.x1 - w.x0, bar);
  }

  function snowSill(ctx, g) {
    const w = g.win;
    const frame = Math.max(2, g.u * 2.2);
    ctx.fillStyle = '#d9dee5';
    ctx.fillRect(w.x0, w.y1 - g.u * 1.2, w.x1 - w.x0, g.u * 1.2);
    void frame;
  }

  function paintLantern(ctx, g) {
    const l = g.lantern;
    const u = g.u;
    const rx = u * 12;
    const ry = u * 16;
    ctx.strokeStyle = '#120e0c';
    ctx.lineWidth = Math.max(1, u * 0.6);
    ctx.beginPath();
    ctx.moveTo(l.x, 0);
    ctx.lineTo(l.x, l.y - ry - u * 2.5);
    ctx.stroke();
    ctx.fillStyle = '#120e0c';
    ctx.fillRect(l.x - rx * 0.6, l.y - ry - u * 2.6, rx * 1.2, u * 2.8);
    const gr = ctx.createRadialGradient(l.x - rx * 0.2, l.y - ry * 0.1, u, l.x, l.y, rx * 1.15);
    gr.addColorStop(0, '#f08a5e');
    gr.addColorStop(0.5, '#d6452c');
    gr.addColorStop(1, '#8e2618');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.ellipse(l.x, l.y, rx, ry, 0, 0, TAU);
    ctx.fill();
    // bamboo ribs
    ctx.strokeStyle = 'rgba(50,14,10,0.7)';
    ctx.lineWidth = Math.max(1, u * 0.45);
    for (let i = -4; i <= 4; i++) {
      const y = l.y + (ry * i) / 4.7;
      const k = Math.sqrt(Math.max(0, 1 - ((y - l.y) / ry) ** 2));
      ctx.beginPath();
      ctx.moveTo(l.x - rx * k, y);
      ctx.quadraticCurveTo(l.x, y + u * 1.1, l.x + rx * k, y);
      ctx.stroke();
    }
    // a big ink character brushed on the paper (abstracted: 酒-like strokes)
    ctx.fillStyle = '#1e0e0b';
    const cw = rx * 0.9;
    ctx.fillRect(l.x - cw * 0.5, l.y - ry * 0.42, cw * 0.18, ry * 0.12);
    ctx.fillRect(l.x - cw * 0.55, l.y - ry * 0.1, cw * 0.18, ry * 0.12);
    ctx.fillRect(l.x - cw * 0.5, l.y + ry * 0.24, cw * 0.18, ry * 0.12);
    ctx.fillRect(l.x - cw * 0.15, l.y - ry * 0.48, cw * 0.7, ry * 0.07);
    ctx.fillRect(l.x - cw * 0.1, l.y - ry * 0.3, cw * 0.1, ry * 0.75);
    ctx.fillRect(l.x + cw * 0.38, l.y - ry * 0.3, cw * 0.1, ry * 0.75);
    ctx.fillRect(l.x - cw * 0.1, l.y + ry * 0.05, cw * 0.58, ry * 0.07);
    ctx.fillRect(l.x - cw * 0.1, l.y + ry * 0.4, cw * 0.58, ry * 0.07);
    ctx.fillStyle = '#120e0c';
    ctx.fillRect(l.x - rx * 0.55, l.y + ry - u * 0.6, rx * 1.1, u * 2.6);
    // gold tassel
    ctx.strokeStyle = '#c9a255';
    ctx.lineWidth = Math.max(1, u * 0.5);
    ctx.beginPath();
    ctx.moveTo(l.x, l.y + ry + u * 2);
    ctx.lineTo(l.x, l.y + ry + u * 6);
    ctx.stroke();
    ctx.fillStyle = '#c9a255';
    ctx.fillRect(l.x - u * 1.1, l.y + ry + u * 6, u * 2.2, u * 4);
  }

  function paintCounter(ctx, g) {
    const u = g.u;
    // top surface, seen from above: lighter near the front
    const gr = ctx.createLinearGradient(0, g.top, 0, g.edge);
    gr.addColorStop(0, '#5a3c26');
    gr.addColorStop(1, '#8a6240');
    ctx.fillStyle = gr;
    ctx.fillRect(0, g.top, g.W, g.edge - g.top);
    // long grain lines running across
    const rand = K.rng(7);
    ctx.fillStyle = 'rgba(52,32,18,0.45)';
    for (let i = 0; i < 26; i++) {
      const y = g.top + rand() * (g.edge - g.top);
      ctx.fillRect(rand() * g.W - u * 10, y, u * (20 + rand() * 40), Math.max(1, u * 0.35));
    }
    // plank joins
    ctx.fillStyle = 'rgba(34,22,14,0.6)';
    ctx.fillRect(0, g.top + (g.edge - g.top) * 0.36, g.W, Math.max(1, u * 0.4));
    ctx.fillRect(0, g.top + (g.edge - g.top) * 0.7, g.W, Math.max(1, u * 0.4));
    // lantern light pooled on the wood
    glow(ctx, g.lantern.x + g.W * 0.06, g.top + (g.edge - g.top) * 0.45, u * 40, '214,110,60', 0.3);
    // front edge and fascia
    ctx.fillStyle = '#a77a50';
    ctx.fillRect(0, g.edge, g.W, u * 1.1);
    ctx.fillStyle = '#3f2b1d';
    ctx.fillRect(0, g.edge + u * 1.1, g.W, g.H - g.edge);
    ctx.fillStyle = '#2e2016';
    for (let x = u * 6; x < g.W; x += u * 16) ctx.fillRect(x, g.edge + u * 1.1, Math.max(1, u * 0.5), g.H - g.edge);
  }

  function paintTray(ctx, g) {
    const u = g.u;
    const cx = (g.flask.x + g.cup.x) / 2;
    const y = g.flask.y;
    const hw = u * 30;
    // shadow
    ctx.fillStyle = 'rgba(20,12,8,0.5)';
    blob(ctx, cx + u * 2, y + u * 2.5, hw * 1.05, u * 4);
    // black lacquer tray in slight perspective, vermilion rim
    ctx.fillStyle = '#7e2116';
    ctx.beginPath();
    ctx.moveTo(cx - hw, y + u * 2);
    ctx.lineTo(cx + hw, y + u * 2);
    ctx.lineTo(cx + hw * 0.88, y - u * 5);
    ctx.lineTo(cx - hw * 0.88, y - u * 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#16100d';
    ctx.beginPath();
    ctx.moveTo(cx - hw + u * 1.4, y + u * 0.8);
    ctx.lineTo(cx + hw - u * 1.4, y + u * 0.8);
    ctx.lineTo(cx + hw * 0.88 - u * 1.2, y - u * 4.2);
    ctx.lineTo(cx - hw * 0.88 + u * 1.2, y - u * 4.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b4442b';
    ctx.fillRect(cx - hw, y + u * 2, hw * 2, u * 1.2);
  }

  function flaskPath(ctx, f, u) {
    const top = f.y - u * 40;
    ctx.beginPath();
    ctx.moveTo(f.x - u * 5, top);
    ctx.lineTo(f.x + u * 5, top);
    ctx.lineTo(f.x + u * 3, top + u * 2.5);
    ctx.lineTo(f.x + u * 3, top + u * 11);
    ctx.bezierCurveTo(f.x + u * 5, top + u * 16, f.x + u * 14, top + u * 21, f.x + u * 14, top + u * 30);
    ctx.bezierCurveTo(f.x + u * 14, f.y - u * 2, f.x + u * 9, f.y - u * 0.5, f.x, f.y - u * 0.5);
    ctx.bezierCurveTo(f.x - u * 9, f.y - u * 0.5, f.x - u * 14, f.y - u * 2, f.x - u * 14, top + u * 30);
    ctx.bezierCurveTo(f.x - u * 14, top + u * 21, f.x - u * 5, top + u * 16, f.x - u * 3, top + u * 11);
    ctx.lineTo(f.x - u * 3, top + u * 2.5);
    ctx.closePath();
    return top;
  }

  function paintFlask(ctx, g) {
    const f = g.flask;
    const u = g.u;
    const top = flaskPath(ctx, f, u);
    const gr = ctx.createLinearGradient(f.x - u * 14, 0, f.x + u * 14, 0);
    gr.addColorStop(0, '#5e6c8e');
    gr.addColorStop(0.3, '#34446d');
    gr.addColorStop(0.75, '#1d2745');
    gr.addColorStop(1, '#121831');
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.save();
    flaskPath(ctx, f, u);
    ctx.clip();
    // pale washi-glaze band and a hand-painted pine sprig
    ctx.fillStyle = '#ddd3b8';
    ctx.fillRect(f.x - u * 15, top + u * 27, u * 30, u * 4.5);
    ctx.fillStyle = '#2a3a32';
    for (let i = -2; i <= 2; i++) blob(ctx, f.x + i * u * 3.4, top + u * 29.2, u * 1.3, u * 1);
    // indigo drip line under the band
    ctx.fillStyle = '#c9a255';
    ctx.fillRect(f.x - u * 15, top + u * 31.5, u * 30, Math.max(1, u * 0.6));
    // highlight
    ctx.fillStyle = 'rgba(230,226,214,0.55)';
    ctx.fillRect(f.x - u * 9.5, top + u * 19, u * 1.6, u * 7);
    ctx.fillRect(f.x - u * 2.2, top + u * 3, u * 0.9, u * 7);
    ctx.restore();
    // lip and gold stripe at the neck
    ctx.fillStyle = '#ddd3b8';
    ctx.fillRect(f.x - u * 5, top, u * 10, Math.max(1, u * 0.9));
    ctx.fillStyle = '#c9a255';
    ctx.fillRect(f.x - u * 3, top + u * 8, u * 6, Math.max(1, u * 0.9));
    // warm rim from the lantern on the left
    ctx.strokeStyle = 'rgba(214,110,60,0.8)';
    ctx.lineWidth = Math.max(1, u * 0.8);
    ctx.beginPath();
    ctx.moveTo(f.x - u * 9, top + u * 20);
    ctx.bezierCurveTo(f.x - u * 14, top + u * 25, f.x - u * 14, f.y - u * 3, f.x - u * 8, f.y - u * 1);
    ctx.stroke();
  }

  function paintCup(ctx, g) {
    const c = g.cup;
    const u = g.u;
    const top = c.y - u * 10;
    ctx.beginPath();
    ctx.moveTo(c.x - u * 7.5, top);
    ctx.lineTo(c.x + u * 7.5, top);
    ctx.bezierCurveTo(c.x + u * 7.2, top + u * 6, c.x + u * 4, top + u * 8, c.x + u * 2.6, top + u * 8.4);
    ctx.lineTo(c.x + u * 2.6, c.y - u * 0.4);
    ctx.lineTo(c.x - u * 2.6, c.y - u * 0.4);
    ctx.lineTo(c.x - u * 2.6, top + u * 8.4);
    ctx.bezierCurveTo(c.x - u * 4, top + u * 8, c.x - u * 7.2, top + u * 6, c.x - u * 7.5, top);
    ctx.closePath();
    const gr = ctx.createLinearGradient(c.x - u * 7, 0, c.x + u * 7, 0);
    gr.addColorStop(0, '#efe8d4');
    gr.addColorStop(1, '#b9ad90');
    ctx.fillStyle = gr;
    ctx.fill();
    // indigo janome ring band
    ctx.fillStyle = '#34446d';
    ctx.fillRect(c.x - u * 7, top + u * 2.2, u * 14, Math.max(1, u * 1.1));
    // sake surface, lit gold
    ctx.fillStyle = '#c99a4e';
    blob(ctx, c.x, top, u * 7.2, u * 1.5);
    ctx.fillStyle = '#e9cf8e';
    blob(ctx, c.x - u * 2, top - u * 0.2, u * 2.6, u * 0.6);
  }

  function bake(g) {
    const base = layer(g.W, g.H);
    const bc = base.getContext('2d');
    paintWall(bc, g);
    paintMenuTags(bc, g);
    paintWindowView(bc, g);
    glow(bc, g.lantern.x, g.lantern.y, g.u * 60, '200,80,48', 0.32);
    paintLantern(bc, g);
    paintCounter(bc, g);
    paintTray(bc, g);
    paintFlask(bc, g);
    paintCup(bc, g);
    const over = layer(g.W, g.H);
    const oc = over.getContext('2d');
    paintLattice(oc, g);
    snowSill(oc, g);
    return { base, over };
  }

  function bakeGlow(g) {
    const c = layer(g.W, g.H);
    glow(c.getContext('2d'), g.lantern.x, g.lantern.y, g.u * 34, '236,110,70', 0.32);
    return c;
  }

  // ---- moving things -------------------------------------------------------

  function makePools(g, rand) {
    const f = new Float32Array(FLAKES * 4);
    for (let i = 0; i < FLAKES; i++) {
      f[i * 4] = g.win.x0 + rand() * (g.win.x1 - g.win.x0);
      f[i * 4 + 1] = g.win.y0 + rand() * (g.win.y1 - g.win.y0);
      f[i * 4 + 2] = 0.6 + rand();
      f[i * 4 + 3] = rand() * TAU;
    }
    const s = new Float32Array(PUFFS * 2);
    for (let i = 0; i < PUFFS; i++) {
      s[i * 2] = i / PUFFS;
      s[i * 2 + 1] = rand();
    }
    return { flakes: f, puffs: s };
  }

  function drawSnow(ctx, g, t, dt, amount) {
    const f = state.pools.flakes;
    const w = g.win;
    const n = Math.min(FLAKES, Math.round(FLAKES * amount * 0.6));
    ctx.fillStyle = '#eef0f3';
    const sz = Math.max(1, g.u * 0.9);
    for (let i = 0; i < n; i++) {
      const k = i * 4;
      f[k + 1] += dt * g.u * 4 * f[k + 2];
      f[k] += Math.sin(t * 0.8 + f[k + 3]) * dt * g.u * 1.2 - dt * g.u * 0.6;
      if (f[k + 1] > w.y1) { f[k + 1] = w.y0; f[k] = w.x0 + (f[k + 3] / TAU) * (w.x1 - w.x0); }
      if (f[k] < w.x0) f[k] = w.x1 - 1;
      ctx.fillRect(f[k], f[k + 1], sz, sz);
    }
  }

  function steamAt(ctx, g, t, sx, sy, height, phase, amount) {
    const s = state.pools.puffs;
    const n = Math.min(PUFFS, Math.round(PUFFS * Math.min(1, amount)));
    const strength = Math.min(1, amount);
    for (let i = 0; i < n; i++) {
      const life = (t * 0.1 + s[i * 2] + phase) % 1;
      const y = sy - life * height;
      const x = sx + Math.sin(life * 6 + s[i * 2 + 1] * TAU + t * 0.3) * g.u * (1 + life * 4);
      const a = Math.sin(life * Math.PI) * 0.36 * strength;
      ctx.globalAlpha = a;
      blob(ctx, x, y, g.u * (1.6 + life * 3.5), g.u * (1.8 + life * 4));
    }
    ctx.globalAlpha = 1;
  }

  // ---- run -----------------------------------------------------------------

  function setup(ctx, api) {
    const g = geometry(api);
    state.g = g;
    state.layers = bake(g);
    state.glow = bakeGlow(g);
    state.pools = makePools(g, K.rng(api.seed));
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const { snow, steam } = api.props;
    const step = Math.min(dt, 0.1);
    ctx.drawImage(state.layers.base, 0, 0);
    drawSnow(ctx, g, t, step, snow);
    ctx.drawImage(state.layers.over, 0, 0);
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 0.6);
    ctx.drawImage(state.glow, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ece8de';
    steamAt(ctx, g, t, g.flask.x, g.flask.y - g.u * 41, g.u * 26, 0, steam);
    steamAt(ctx, g, t, g.cup.x, g.cup.y - g.u * 11, g.u * 18, 0.43, steam * 0.8);
  }

  Kasuri.run({
    defaults: { snow: 1, steam: 1, ramp: 'lines', cell: 7, boost: 0.2, gain: 1.15, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
