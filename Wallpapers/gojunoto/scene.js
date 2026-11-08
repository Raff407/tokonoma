/*
 * 五重塔 Gojunoto — a five-storey pagoda on a wooded hill, under your clock.
 *
 * Hill and tower are baked once in daylight and multiplied by the sky's tint
 * once a minute. Each frame only slides three cloud tiles, strokes a few birds
 * and, after dark, stamps a short list of lamp glows along the eaves.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, smoothstep, mixColor, toHex } = K;

  const CENTRE = 0.6;
  const BASE = 0.77;
  const PLATFORM = 3;
  const STOREYS = [
    { wall: 11.5, h: 8, span: 24, roof: 4.4 },
    { wall: 10.4, h: 7, span: 21.6, roof: 4 },
    { wall: 9.3, h: 6.4, span: 19.2, roof: 3.7 },
    { wall: 8.2, h: 5.6, span: 16.8, roof: 3.4 },
    { wall: 7.1, h: 5, span: 14.4, roof: 5.2 },
  ];
  const LAMP_SPOTS = [-0.93, -0.5, 0.5, 0.93];
  const MAX_BIRDS = 14;
  const RETINT_SECONDS = 60;
  const GREENS = ['#8aa868', '#74975e', '#5f8558', '#4f7352', '#7a9652'];
  const AUTUMN = ['#a3604a', '#ac9456'];
  const FAR_BLUE = [116, 140, 150];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function pagodaTiers(g) {
    const u = g.U;
    const list = [];
    let foot = g.H * BASE - u * PLATFORM;
    STOREYS.forEach((s, i) => {
      const eave = foot - s.h * u;
      const next = STOREYS[i + 1];
      list.push({
        foot,
        eave,
        wall: s.wall * u,
        span: s.span * u,
        roof: s.roof * u,
        neck: next ? (next.wall + 0.5) * u : u * 0.9,
        lift: u * (1.9 - i * 0.1),
      });
      foot = eave - s.roof * u;
    });
    return { tiers: list, peak: foot };
  }

  function roofOutline(ctx, cx, t) {
    const top = t.eave - t.roof;
    const reach = t.span - t.neck;
    const sag = t.lift * 0.28;
    ctx.beginPath();
    ctx.moveTo(cx - t.span, t.eave - t.lift);
    ctx.quadraticCurveTo(cx - t.neck - reach * 0.36, t.eave - t.roof * 0.26, cx - t.neck, top);
    ctx.lineTo(cx + t.neck, top);
    ctx.quadraticCurveTo(cx + t.neck + reach * 0.36, t.eave - t.roof * 0.26, cx + t.span, t.eave - t.lift);
    ctx.quadraticCurveTo(cx + t.span * 0.8, t.eave + sag, cx + t.span * 0.56, t.eave + sag);
    ctx.lineTo(cx - t.span * 0.56, t.eave + sag);
    ctx.quadraticCurveTo(cx - t.span * 0.8, t.eave + sag, cx - t.span, t.eave - t.lift);
    ctx.closePath();
  }

  function paintTiles(ctx, u, cx, t) {
    const top = t.eave - t.roof;
    const count = Math.max(4, Math.round(t.span / (u * 2.2)));
    ctx.save();
    roofOutline(ctx, cx, t);
    ctx.clip();
    ctx.strokeStyle = '#4a5468';
    ctx.lineWidth = Math.max(1, u * 0.35);
    ctx.beginPath();
    for (let i = -count; i <= count; i++) {
      ctx.moveTo(cx + (i / count) * t.neck, top);
      ctx.lineTo(cx + (i / count) * t.span * 0.92, t.eave + u);
    }
    ctx.stroke();
    ctx.restore();
  }

  function paintRoof(ctx, u, cx, t) {
    const top = t.eave - t.roof;
    const reach = t.span - t.neck;
    ctx.fillStyle = '#667286';
    roofOutline(ctx, cx, t);
    ctx.fill();
    paintTiles(ctx, u, cx, t);
    ctx.strokeStyle = '#d8d6c8';
    ctx.lineWidth = Math.max(1, u * 0.55);
    ctx.lineCap = 'round';
    const sag = t.lift * 0.28;
    ctx.beginPath();
    ctx.moveTo(cx - t.span, t.eave - t.lift);
    ctx.quadraticCurveTo(cx - t.span * 0.8, t.eave + sag, cx - t.span * 0.56, t.eave + sag);
    ctx.lineTo(cx + t.span * 0.56, t.eave + sag);
    ctx.quadraticCurveTo(cx + t.span * 0.8, t.eave + sag, cx + t.span, t.eave - t.lift);
    ctx.stroke();
    ctx.strokeStyle = '#a4adb8';
    ctx.lineWidth = Math.max(1, u * 0.4);
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(cx + side * t.neck, top);
      ctx.quadraticCurveTo(cx + side * (t.neck + reach * 0.36), t.eave - t.roof * 0.26, cx + side * t.span, t.eave - t.lift);
    }
    ctx.stroke();
  }

  function paintSoffit(ctx, u, cx, t) {
    ctx.fillStyle = '#3a3039';
    ctx.beginPath();
    ctx.moveTo(cx - t.span * 0.84, t.eave);
    ctx.lineTo(cx + t.span * 0.84, t.eave);
    ctx.lineTo(cx + t.wall + u, t.eave + u * 1.6);
    ctx.lineTo(cx - t.wall - u, t.eave + u * 1.6);
    ctx.fill();
    ctx.fillStyle = '#c0523a';
    ctx.fillRect(cx - t.wall - u * 0.5, t.eave + u * 0.5, (t.wall + u * 0.5) * 2, u * 1.2);
    ctx.fillStyle = '#ecd9a4';
    const step = u * 2.4;
    for (let x = -t.wall; x < t.wall; x += step) {
      ctx.fillRect(cx + x, t.eave + u * 0.8, Math.max(1, u * 0.9), Math.max(1, u * 0.5));
    }
  }

  function paintWall(ctx, u, cx, t) {
    const h = t.foot - t.eave;
    ctx.fillStyle = '#efe6cc';
    ctx.fillRect(cx - t.wall, t.eave, t.wall * 2, h);
    const doorW = t.wall * 0.34;
    ctx.fillStyle = '#5a3a30';
    ctx.fillRect(cx - doorW, t.eave + h * 0.34, doorW * 2, h * 0.66);
    ctx.fillStyle = '#6c5a4a';
    for (const side of [-1, 1]) {
      ctx.fillRect(cx + side * t.wall * 0.68 - doorW * 0.55, t.eave + h * 0.42, doorW * 1.1, h * 0.36);
    }
    ctx.fillStyle = '#c0523a';
    const pillar = Math.max(1, u * 0.8);
    for (const f of [-1, -0.42, 0.42, 1]) ctx.fillRect(cx + f * t.wall - pillar / 2, t.eave, pillar, h);
    ctx.fillRect(cx - t.wall - u * 1.1, t.foot - u * 1.3, (t.wall + u * 1.1) * 2, Math.max(1, u * 0.5));
    ctx.fillStyle = '#7e3626';
    ctx.fillRect(cx - t.wall - u * 1.1, t.foot - Math.max(1, u * 0.5), (t.wall + u * 1.1) * 2, Math.max(1, u * 0.5));
    const posts = Math.max(3, Math.round(t.wall / (u * 1.6)));
    for (let i = -posts; i <= posts; i++) ctx.fillRect(cx + (i / posts) * t.wall, t.foot - u * 1.3, 1, u * 1.3);
  }

  function paintSpire(ctx, u, cx, peak) {
    const mast = Math.max(1, u * 0.55);
    const tip = peak - u * 15.5;
    ctx.fillStyle = '#7f7a5c';
    ctx.fillRect(cx - u * 2.2, peak - u * 1.4, u * 4.4, u * 2.2);
    ctx.fillStyle = '#a89a5e';
    ctx.beginPath();
    ctx.ellipse(cx, peak - u * 2.2, u * 1.9, u * 1.1, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#a29c76';
    ctx.fillRect(cx - mast / 2, tip, mast, peak - tip);
    for (let i = 0; i < 9; i++) {
      const half = u * (2.4 - i * 0.13);
      ctx.fillStyle = i % 2 ? '#a89a5e' : '#d0b768';
      ctx.fillRect(cx - half, peak - u * (4 + i * 1.08), half * 2, Math.max(1, u * 0.6));
    }
    ctx.fillStyle = '#d0b768';
    ctx.beginPath();
    ctx.moveTo(cx, tip - u * 0.8);
    ctx.quadraticCurveTo(cx + u * 1.5, tip + u * 1.6, cx, tip + u * 2.8);
    ctx.quadraticCurveTo(cx - u * 1.5, tip + u * 1.6, cx, tip - u * 0.8);
    ctx.fill();
  }

  function eaveHeight(t, f) {
    const a = Math.abs(f);
    return t.eave + t.lift * 0.28 - (t.lift * 1.28 * Math.max(0, a - 0.56)) / 0.44;
  }

  function paintUnlitLamps(ctx, u, cx, tiers) {
    ctx.fillStyle = '#8c6a44';
    for (const t of tiers) {
      for (const f of LAMP_SPOTS) {
        const y = eaveHeight(t, f);
        ctx.fillRect(cx + f * t.span - u * 0.6, y, Math.max(1, u * 1.2), Math.max(1, u * 1.6));
      }
    }
  }

  function paintPagoda(g, cx, layout) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    for (const t of layout.tiers) {
      paintWall(ctx, u, cx, t);
      paintSoffit(ctx, u, cx, t);
      paintRoof(ctx, u, cx, t);
    }
    paintSpire(ctx, u, cx, layout.peak);
    paintUnlitLamps(ctx, u, cx, layout.tiers);
    const shade = ctx.createLinearGradient(cx - u * 12, 0, cx + u * 24, 0);
    shade.addColorStop(0, 'rgba(26,30,52,0)');
    shade.addColorStop(1, 'rgba(26,30,52,0.34)');
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  function paintLit(g, cx, tiers, peak) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    for (const t of tiers) {
      const h = t.foot - t.eave;
      ctx.fillStyle = '#b8743e';
      ctx.beginPath();
      ctx.moveTo(cx - t.span * 0.8, t.eave + u * 0.2);
      ctx.lineTo(cx + t.span * 0.8, t.eave + u * 0.2);
      ctx.lineTo(cx + t.wall + u, t.eave + u * 1.6);
      ctx.lineTo(cx - t.wall - u, t.eave + u * 1.6);
      ctx.fill();
      ctx.fillStyle = '#e0a45c';
      const doorW = t.wall * 0.34;
      ctx.fillRect(cx - doorW, t.eave + h * 0.34, doorW * 2, h * 0.66);
      for (const side of [-1, 1]) {
        ctx.fillRect(cx + side * t.wall * 0.68 - doorW * 0.55, t.eave + h * 0.42, doorW * 1.1, h * 0.36);
      }
      ctx.fillStyle = '#6a3226';
      ctx.fillRect(cx - Math.max(1, u * 0.4), t.eave + h * 0.34, Math.max(1, u * 0.8), h * 0.66);
    }
    paintSpire(ctx, u, cx, peak);
    return c;
  }

  function paintGlow(radius, colour) {
    const size = Math.ceil(radius * 2);
    const c = layer(size, size);
    const ctx = c.getContext('2d');
    const [r, gr, b] = K.parseColor(colour);
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${r},${gr},${b},0.5)`);
    grad.addColorStop(0.35, `rgba(${r},${gr},${b},0.16)`);
    grad.addColorStop(1, `rgba(${r},${gr},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return c;
  }

  function hillTop(g, cx, x) {
    const d = Math.abs(x - cx) / g.U;
    const reach = x < cx ? 120 : 92;
    const fall = smoothstep(30, reach, d);
    const bump = fbm(x * 0.03, 3.5, 3, 11) - 0.5;
    return g.H * BASE + g.U * (2 + fall * 19 + fall * bump * 12);
  }

  function paintSugi(ctx, u, rand, x, foot, height) {
    const tiers = 6;
    const half = height * 0.17;
    for (let i = 0; i < tiers; i++) {
      const f = i / tiers;
      const top = foot - height + f * height * 0.82;
      const w = half * (0.3 + f * 0.8) * (0.9 + rand() * 0.2);
      const low = top + height * 0.27;
      ctx.fillStyle = i % 2 ? '#426350' : '#3a5a4a';
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x + w, low);
      ctx.lineTo(x - w, low);
      ctx.fill();
      ctx.fillStyle = '#5f8460';
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x - w * 0.15, low - u * 0.4);
      ctx.lineTo(x - w, low);
      ctx.fill();
    }
  }

  // Groves of sugi on the hill's shoulders, never close enough to touch the roofs.
  function paintBackTrees(ctx, g, rand, cx) {
    const u = g.U;
    const reach = g.W / u;
    const list = [];
    for (const side of [-1, 1]) {
      for (let d = 26; d < reach; d += 2.4 + rand() * 3) {
        const grove = fbm(d * 0.09, side * 3 + 5, 2, 17);
        if (grove < 0.42) continue;
        const x = cx + side * d * u;
        const tall = 15 + smoothstep(26, 55, d) * 10 + grove * 12 + rand() * 7;
        list.push({ x, foot: hillTop(g, cx, x) + u * 4, height: tall * u });
      }
    }
    list.sort((p, q) => q.height - p.height);
    for (const tree of list) paintSugi(ctx, u, rand, tree.x, tree.foot, tree.height);
  }

  function paintBackCrowns(ctx, g, rand, cx) {
    const u = g.U;
    for (let x = -u * 2; x < g.W + u * 2; x += u * (1.8 + rand() * 1.8)) {
      const d = Math.abs(x - cx) / u;
      if (d < 15) continue;
      const rise = 2 + smoothstep(15, 34, d) * 5 + fbm(x * 0.04, 12, 3, 23) * 8;
      const y = hillTop(g, cx, x) - u * rise * rand();
      paintClump(ctx, u, rand, x, y, u * (1.8 + rand() * 2.4), clumpTone(rand, x, y), 0.3);
    }
  }

  function paintClump(ctx, u, rand, x, y, size, tone, haze) {
    const base = toHex(mixColor(mixColor(K.parseColor(tone), [44, 66, 58], 0.5), FAR_BLUE, haze));
    const light = toHex(mixColor(K.parseColor(tone), FAR_BLUE, haze));
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.ellipse(x, y, size, size * 0.72, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = light;
    const dabs = 3 + Math.floor(rand() * 4);
    for (let i = 0; i < dabs; i++) {
      const a = rand() * 6.283;
      const r = size * 0.62 * Math.sqrt(rand());
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * r - size * 0.18, y + Math.sin(a) * r * 0.6 - size * 0.24, size * (0.2 + rand() * 0.2), size * (0.13 + rand() * 0.13), 0, 0, 6.3);
      ctx.fill();
    }
  }

  function stairSpan(g, cx, y) {
    const f = (y - g.H * BASE) / (g.H - g.H * BASE);
    return { x: cx - f * g.U * 7, half: g.U * (3.4 + f * 7) };
  }

  function clumpTone(rand, x, y) {
    const patch = fbm(x * 0.05, y * 0.08, 2, 21);
    if (patch > 0.64 && rand() < 0.55) return AUTUMN[rand() < 0.65 ? 0 : 1];
    return GREENS[Math.floor(rand() * GREENS.length)];
  }

  function paintCanopy(ctx, g, rand, cx) {
    const u = g.U;
    const rows = 11;
    for (let r = 0; r < rows; r++) {
      const haze = 0.26 * (1 - r / rows);
      for (let x = -u * 3 + rand() * u * 4; x < g.W + u * 3; x += u * (2.4 + rand() * 2.6)) {
        const y = hillTop(g, cx, x) + r * u * 2.5 + (rand() - 0.5) * u * 1.6;
        const span = stairSpan(g, cx, y);
        if (y > g.H + u * 4 || Math.abs(x - span.x) < span.half + u * 2) continue;
        paintClump(ctx, u, rand, x, y, u * (1.5 + rand() * 2.3 + r * 0.12), clumpTone(rand, x, y), haze);
      }
    }
  }

  function paintStairs(ctx, g, cx) {
    const u = g.U;
    const top = g.H * BASE + u * 2.5;
    const bottom = g.H + u;
    let k = 0;
    for (let y = top; y < bottom; y += Math.max(1, u * (0.9 + ((y - top) / u) * 0.03))) {
      const s = stairSpan(g, cx, y);
      ctx.fillStyle = k % 2 ? '#8d8878' : '#c2bca6';
      ctx.fillRect(s.x - s.half, y, s.half * 2, u * 1.4);
      k += 1;
    }
  }

  function paintTerrace(ctx, g, cx) {
    const u = g.U;
    const y = g.H * BASE;
    ctx.fillStyle = '#b4ae9a';
    ctx.fillRect(cx - u * 16, y - u * PLATFORM, u * 32, u * PLATFORM);
    ctx.fillStyle = '#8d8878';
    ctx.fillRect(cx - u * 16, y - u * 1.1, u * 32, u * 1.1);
    ctx.fillStyle = '#9d9786';
    ctx.fillRect(cx - u * 30, y, u * 60, u * 3.4);
    ctx.fillStyle = '#6f6b5e';
    for (let i = -28; i < 28; i += 4) ctx.fillRect(cx + i * u, y + u * ((i & 4) ? 0.4 : 1.8), u * 3, Math.max(1, u * 0.3));
  }

  function paintStoneLantern(ctx, u, x, foot) {
    ctx.fillStyle = '#a9a48f';
    ctx.fillRect(x - u * 1.5, foot - u * 0.8, u * 3, u * 0.8);
    ctx.fillRect(x - u * 0.5, foot - u * 3.6, u, u * 2.8);
    ctx.fillRect(x - u * 1.1, foot - u * 5.2, u * 2.2, u * 1.6);
    ctx.fillStyle = '#6d6a5c';
    ctx.beginPath();
    ctx.moveTo(x - u * 2.2, foot - u * 5.2);
    ctx.lineTo(x, foot - u * 7);
    ctx.lineTo(x + u * 2.2, foot - u * 5.2);
    ctx.fill();
  }

  function paintWorld(g, rand, cx, layout) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    paintBackTrees(ctx, g, rand, cx);
    paintBackCrowns(ctx, g, rand, cx);
    ctx.fillStyle = '#466450';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) ctx.lineTo(x, hillTop(g, cx, x));
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    paintTerrace(ctx, g, cx);
    ctx.drawImage(paintPagoda(g, cx, layout), 0, 0);
    paintCanopy(ctx, g, rand, cx);
    paintStairs(ctx, g, cx);
    for (const side of [-1, 1]) paintStoneLantern(ctx, u, cx + side * u * 8, g.H * BASE + u * 2.5);
    return c;
  }

  // A bough of pine: a lumpy dome of dark lobes, then needle strokes on its lit top.
  function paintPad(ctx, g, rand, x, y, rx, ry) {
    const u = g.U;
    const lobes = Math.max(4, Math.round(rx / (u * 1.3)));
    ctx.fillStyle = '#3c5a46';
    for (let i = 0; i < lobes; i++) {
      const f = (i + 0.5) / lobes;
      const dome = Math.sin(f * Math.PI);
      ctx.beginPath();
      ctx.ellipse(x + (f * 2 - 1) * rx, y - dome * ry * 0.5 + (rand() - 0.5) * u, u * (1.4 + rand() * 1.1), ry * (0.3 + dome * 0.4), 0, 0, 6.3);
      ctx.fill();
    }
    ctx.lineWidth = Math.max(1, u * 0.45);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#7fa46c';
    ctx.beginPath();
    const count = Math.round((rx / u) * 3.5);
    for (let i = 0; i < count; i++) {
      const f = rand();
      const px = x + (f * 2 - 1) * rx * 0.92;
      const py = y - Math.sin(f * Math.PI) * ry * (0.5 + rand() * 0.5);
      ctx.moveTo(px, py);
      ctx.lineTo(px + (rand() - 0.5) * u * 1.5, py - u * (0.5 + rand() * 0.7));
    }
    ctx.stroke();
  }

  function paintPine(ctx, g, rand, x, foot) {
    const u = g.U;
    const pads = [
      [-9, 25, 11, 4], [10, 31, 13, 4.4], [-7, 37, 11, 3.8], [9, 43, 10, 3.6], [-1, 50, 8, 3.2],
    ];
    const spine = (h) => x + Math.sin(h * 0.075) * u * 3.5;
    ctx.strokeStyle = '#594a3e';
    ctx.lineCap = 'round';
    for (let h = 0; h < 50; h += 4) {
      ctx.lineWidth = u * (3 - h * 0.042);
      ctx.beginPath();
      ctx.moveTo(spine(h), foot - h * u);
      ctx.lineTo(spine(h + 4), foot - (h + 4) * u);
      ctx.stroke();
    }
    ctx.lineWidth = Math.max(1, u * 0.9);
    ctx.beginPath();
    for (const p of pads) {
      ctx.moveTo(spine(p[1] - 3), foot - (p[1] - 3) * u);
      ctx.quadraticCurveTo(x + p[0] * u * 0.4, foot - p[1] * u + u, x + p[0] * u, foot - p[1] * u);
    }
    ctx.stroke();
    for (const p of pads) paintPad(ctx, g, rand, x + p[0] * u, foot - p[1] * u, p[2] * u, p[3] * u);
  }

  function paintForeground(g, rand, cx) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    ctx.fillStyle = '#3c5848';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) {
      const edge = smoothstep(0, 0.5, Math.abs(x - cx + u * 7) / g.W);
      ctx.lineTo(x, g.H - u * (1 + edge * 10 + fbm(x * 0.04, 8, 3, 31) * 5));
    }
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    for (let i = 0; i < g.W / u * 1.4; i++) {
      const x = rand() * g.W;
      const edge = smoothstep(0, 0.5, Math.abs(x - cx + u * 7) / g.W);
      const y = g.H - u * (rand() * (edge * 11 + 1));
      paintClump(ctx, u, rand, x, y, u * (1.6 + rand() * 2.6), rand() < 0.5 ? '#648a5c' : '#527650', 0);
    }
    paintPine(ctx, g, rand, Math.max(g.W * 0.11, u * 17), g.H + u * 2);
    return c;
  }

  function paintRidge(g, base, rise, freq, seed, peakAt) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, g.H);
    for (let x = 0; x <= g.W + 2; x += 2) {
      const swell = Math.exp(-Math.pow((x / g.W - peakAt) * 2.6, 2));
      ctx.lineTo(x, g.H * (base - swell * rise - (fbm(x * freq, seed, 4, 3) - 0.5) * 0.09));
    }
    ctx.lineTo(g.W, g.H);
    ctx.fill();
    return c;
  }

  // Long flat bands, the way clouds lie across a painted screen, tiling at w.
  function paintCloudMask(w, h, seed, stretch, lo, hi, peak) {
    const bw = Math.ceil(w / 2);
    const bh = Math.ceil(h / 2);
    const c = layer(bw, bh);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(bw, bh);
    const density = (x, y) => fbm(x * stretch, y * 0.11, 4, seed);
    for (let y = 0; y < bh; y++) {
      const band = Math.sin((y / bh) * Math.PI);
      for (let x = 0; x < bw; x++) {
        const v = lerp(density(x, y), density(x - bw, y), x / bw);
        const i = (y * bw + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = (Math.round(smoothstep(lo, hi, v) * band * 5) / 5) * peak * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Multiply by the light, then add a little moonlight so night shapes keep their edges.
  function tint(source, colour, lift) {
    const c = layer(source.width, source.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(source, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = toHex(colour);
    ctx.fillRect(0, 0, c.width, c.height);
    if (lift) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = toHex(lift);
      ctx.fillRect(0, 0, c.width, c.height);
    }
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(source, 0, 0);
    return c;
  }

  function paintStars(ctx, g, night) {
    const rand = K.rng(5);
    ctx.fillStyle = '#e4e3d8';
    for (let i = 0; i < g.W * 0.7; i++) {
      ctx.globalAlpha = night * (0.2 + rand() * 0.6);
      ctx.fillRect(rand() * g.W, rand() * g.H * 0.6, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function paintDisc(ctx, x, y, radius, halo, colour, amount) {
    const [r, gr, b] = colour;
    const grad = ctx.createRadialGradient(x, y, radius * 0.8, x, y, halo);
    grad.addColorStop(0, `rgba(${r},${gr},${b},${0.32 * amount})`);
    grad.addColorStop(1, `rgba(${r},${gr},${b},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x - halo, y - halo, halo * 2, halo * 2);
    ctx.globalAlpha = amount;
    ctx.fillStyle = toHex(colour);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 6.3);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function lowSun(hour) {
    return Math.max(0, 1 - Math.abs(hour - 6.6) / 1.5, 1 - Math.abs(hour - 17.9) / 1.5);
  }

  function paintBackdrop(g, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const u = g.U;
    const n = sky.night;
    const grad = ctx.createLinearGradient(0, 0, 0, g.H * 0.78);
    grad.addColorStop(0, toHex(mixColor(mixColor(sky.top, [128, 170, 204], 0.28), [42, 56, 108], n * 0.9)));
    grad.addColorStop(1, toHex(mixColor(sky.low, [140, 156, 202], n * 0.9)));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, g.W, g.H);
    if (n > 0.1) paintStars(ctx, g, n);
    const low = lowSun(sky.hour);
    if (low > 0) paintDisc(ctx, g.W * 0.3, g.H * 0.42, u * 5.5, u * 34, [244, 186, 128], low);
    if (n > 0.2) paintDisc(ctx, g.W * CENTRE - u * 25, u * 17, u * 7, u * 30, [240, 234, 208], n);
    ctx.drawImage(tint(state.ridgeFar, mixColor(sky.haze, [98, 112, 160], n * 0.85)), 0, 0);
    ctx.drawImage(tint(state.ridgeMid, mixColor(mixColor(sky.haze, [66, 92, 84], 0.5), [72, 90, 124], n * 0.85)), 0, 0);
    return c;
  }

  function retint(g, choice) {
    const sky = S.at(S.hour(choice));
    const n = sky.night;
    const amb = mixColor(mixColor(sky.amb, [255, 236, 214], lowSun(sky.hour) * 0.3), [170, 182, 220], n * 0.7);
    state.sky = sky;
    state.backdrop = paintBackdrop(g, sky);
    const moon = [9 * n, 12 * n, 20 * n];
    state.worldTint = tint(state.world, amb, moon);
    state.frontTint = tint(state.front, mixColor(amb, [120, 128, 170], n * 0.2), moon);
    const cloud = mixColor(mixColor(sky.amb, sky.haze, 0.25), [136, 146, 182], n * 0.6);
    state.backCloud = tint(state.backMask, cloud);
    state.wispCloud = tint(state.wispMask, mixColor(cloud, [255, 255, 255], 0.2));
    state.mistCloud = tint(state.mistMask, cloud);
    state.birdInk = toHex(mixColor([44, 46, 58], [54, 60, 88], n));
    state.lampAmount = smoothstep(0.12, 0.6, n);
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function makeLamps(g, cx, tiers) {
    const list = [];
    for (const t of tiers) {
      for (const f of LAMP_SPOTS) {
        list.push({ x: cx + f * t.span, y: eaveHeight(t, f) + g.U * 0.8, phase: list.length * 2.399, w: Math.max(1, g.U * 1.2), h: Math.max(1, g.U * 1.6) });
      }
    }
    for (const side of [-1, 1]) {
      list.push({ x: cx + side * g.U * 8, y: g.H * BASE - g.U * 1.9, phase: side * 1.3, w: Math.max(1, g.U), h: Math.max(1, g.U) });
    }
    return list;
  }

  function makeBirds(g, rand, cx, top) {
    const list = [];
    for (let i = 0; i < MAX_BIRDS; i++) {
      list.push({
        cx: cx + (rand() - 0.5) * g.U * 8,
        cy: top + g.U * (10 + rand() * 18),
        rx: g.U * (22 + rand() * 24),
        ry: g.U * (3.5 + rand() * 4),
        rate: (0.1 + rand() * 0.06) * (i % 5 === 4 ? -1 : 1),
        phase: (i * 6.283) / 5 + rand(),
        size: g.U * (1.7 + rand() * 0.8),
      });
    }
    return list;
  }

  function strokeBird(ctx, b, t) {
    const a = t * b.rate + b.phase;
    const x = b.cx + Math.cos(a) * b.rx;
    const y = b.cy + Math.sin(a) * b.ry + Math.sin(t * 0.4 + b.phase) * b.size;
    const near = 0.8 + 0.3 * Math.sin(a);
    const s = b.size * near;
    const beat = Math.sin(t * 3.4 + b.phase * 3) * Math.max(0, Math.sin(t * 0.45 + b.phase));
    const tipY = y - s * (0.6 + beat * 0.7);
    const heading = -Math.sin(a) * Math.sign(b.rate);
    ctx.moveTo(x - s * 1.8, tipY);
    ctx.quadraticCurveTo(x - s * 0.8, y - s * 0.7, x, y);
    ctx.quadraticCurveTo(x + s * 0.8, y - s * 0.7, x + s * 1.8, tipY);
    ctx.moveTo(x - heading * s * 0.6, y + s * 0.1);
    ctx.lineTo(x + heading * s * 0.45, y - s * 0.05);
  }

  // Those on the far half of their circle go behind the tower, the rest in front.
  function drawBirds(ctx, g, t, count, front) {
    ctx.strokeStyle = state.birdInk;
    ctx.lineWidth = Math.max(1, g.U * 0.42);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const birds = state.birds;
    for (let i = 0; i < count; i++) {
      const b = birds[i];
      if (Math.sin(t * b.rate + b.phase) > 0 === front) strokeBird(ctx, b, t);
    }
    ctx.stroke();
  }

  function drawTile(ctx, tile, x, y, w, h) {
    const left = -((x % w) + w) % w;
    ctx.drawImage(tile, left, y, w, h);
    ctx.drawImage(tile, left + w, y, w, h);
  }

  function drawLamps(ctx, g, t) {
    const amount = state.lampAmount;
    if (amount <= 0) return;
    ctx.globalAlpha = amount * (0.72 + 0.08 * Math.sin(t * 0.35));
    ctx.drawImage(state.lit, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    const r = g.U * 6.5;
    for (const l of state.lamps) {
      ctx.globalAlpha = amount * (0.72 + 0.2 * Math.sin(t * 0.6 + l.phase));
      ctx.drawImage(state.glow, l.x - r, l.y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = amount;
    ctx.fillStyle = '#f6d58e';
    for (const l of state.lamps) ctx.fillRect(l.x - l.w / 2, l.y - l.h / 2, l.w, l.h);
    ctx.globalAlpha = 1;
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    const cx = g.W * CENTRE;
    const layout = pagodaTiers(g);
    state.g = g;
    state.world = paintWorld(g, rand, cx, layout);
    state.front = paintForeground(g, rand, cx);
    state.lit = paintLit(g, cx, layout.tiers, layout.peak);
    state.glow = paintGlow(g.U * 6.5, '#d88a3e');
    state.lamps = makeLamps(g, cx, layout.tiers);
    state.birds = makeBirds(g, rand, cx, layout.peak);
    state.ridgeFar = paintRidge(g, 0.66, 0.14, 0.012, 2, 0.24);
    state.ridgeMid = paintRidge(g, 0.78, 0.09, 0.02, 7, 0.86);
    const w = Math.ceil(g.W * 1.5);
    state.tileW = w;
    state.backH = g.H * 0.5;
    state.wispH = g.H * 0.2;
    state.mistH = g.H * 0.16;
    state.backMask = paintCloudMask(w, state.backH, 13, 0.022, 0.44, 0.64, 0.92);
    state.wispMask = paintCloudMask(w, state.wispH, 41, 0.04, 0.5, 0.64, 0.7);
    state.mistMask = paintCloudMask(w, state.mistH, 67, 0.022, 0.46, 0.66, 0.6);
    retint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) retint(g, props.time);
    const flow = t * g.U * props.clouds;
    const show = Math.min(1, props.clouds * 2);
    const count = Math.min(MAX_BIRDS, Math.round(props.birds));
    ctx.drawImage(state.backdrop, 0, 0);
    ctx.globalAlpha = show;
    drawTile(ctx, state.backCloud, flow * 0.7, g.H * 0.08, state.tileW, state.backH);
    ctx.globalAlpha = 1;
    drawBirds(ctx, g, t, count, false);
    ctx.drawImage(state.worldTint, 0, 0);
    drawLamps(ctx, g, t);
    ctx.globalAlpha = show;
    drawTile(ctx, state.wispCloud, flow * 1.2, g.H * 0.38, state.tileW, state.wispH);
    ctx.globalAlpha = 1;
    drawBirds(ctx, g, t, count, true);
    ctx.globalAlpha = show;
    drawTile(ctx, state.mistCloud, flow * 1.7, g.H * 0.74, state.tileW, state.mistH);
    ctx.globalAlpha = 1;
    ctx.drawImage(state.frontTint, 0, 0);
  }

  Kasuri.run({
    defaults: { time: 'auto', clouds: 1, birds: 8, ramp: 'lines', cell: 7, boost: 0.14, gain: 1.08, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
