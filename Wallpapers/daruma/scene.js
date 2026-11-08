/*
 * 達磨 Daruma — red daruma dolls in rows on a temple stall, late in the afternoon.
 *
 * Each doll is baked once into its own small sprite, then rolled a degree or so
 * on its round base with one transform per frame. The stall and temple are one
 * still layer; the smoke is a few short strokes and a noise sheet that slides.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const { lerp, fbm, smoothstep } = K;

  const INK = '#1c1a20';
  const GOLD = '#d8ae55';
  const BASE = { back: 46, mid: 70, front: 93 };
  const BACK_SIZES = [22, 17, 24, 19, 21, 16, 23, 18];
  const MID_SIZES = [27, 22, 30, 24, 28, 31, 23, 26];
  const RIGHT_SIZES = [35, 27, 39, 30, 25, 37, 29, 33];
  const LEFT_SIZES = [31, 38, 26, 34, 29, 36, 24, 32];
  const HERO_SIZE = 56;
  const PLUME_SEGMENTS = 16;
  const MOTES = 36;
  const TONE = { lit: '#f8875c', mid: '#de5234', shade: '#a93422', foot: '#7a241c' };
  const SKY = ['#cfa26c', '#e0b67c', '#eecb90', '#f7deaa'];
  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // All doll drawing happens in a box 100 tall, with x = 0 on the centre line.
  function bodyPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(26, 0, 44, 22, 44, 56);
    ctx.bezierCurveTo(44, 78, 34, 97, 16, 99);
    ctx.lineTo(-16, 99);
    ctx.bezierCurveTo(-34, 97, -44, 78, -44, 56);
    ctx.bezierCurveTo(-44, 22, -26, 0, 0, 0);
    ctx.closePath();
  }

  function facePath(ctx) {
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.bezierCurveTo(17, 12, 29, 18, 29, 34);
    ctx.bezierCurveTo(29, 51, 16, 63, 0, 63);
    ctx.bezierCurveTo(-16, 63, -29, 51, -29, 34);
    ctx.bezierCurveTo(-29, 18, -17, 12, 0, 12);
    ctx.closePath();
  }

  // Flat tones with curved edges, lit from the left: holds up well when woven.
  function shadeBody(ctx, tone) {
    ctx.save();
    bodyPath(ctx);
    ctx.clip();
    ctx.fillStyle = tone.shade;
    ctx.fillRect(-50, 0, 100, 100);
    ctx.fillStyle = tone.mid;
    ctx.save();
    ctx.translate(-11, -4);
    bodyPath(ctx);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = tone.foot;
    ctx.fillRect(-50, 94, 100, 6);
    ctx.fillStyle = tone.lit;
    ctx.beginPath();
    ctx.ellipse(-33, 44, 7, 30, 0.2, 0, 6.3);
    ctx.fill();
    ctx.restore();
  }

  function paintEye(ctx, x, painted, line) {
    ctx.fillStyle = '#fff9ea';
    ctx.strokeStyle = INK;
    ctx.lineWidth = line(1.9);
    ctx.beginPath();
    ctx.arc(x, 33, 9.4, 0, 6.3);
    ctx.fill();
    ctx.stroke();
    if (!painted) return;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x, 33, 7, 0, 6.3);
    ctx.fill();
  }

  // Tapered and rising outward: a stern brow, not a raised one.
  function paintBrow(ctx, side, line) {
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    ctx.lineWidth = line(0.4);
    ctx.beginPath();
    ctx.moveTo(side * 4, 23);
    ctx.quadraticCurveTo(side * 13, 11, side * 28, 16);
    ctx.quadraticCurveTo(side * 15, 17, side * 4, 23);
    ctx.fill();
    ctx.stroke();
  }

  // Two heavy sweeps falling away from the nose and a small tuft on the chin.
  function paintWhiskers(ctx, line, large) {
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = line(0.4);
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(side * 1.2, 46.5);
      ctx.quadraticCurveTo(side * 13, 43.5, side * 25, 54);
      ctx.quadraticCurveTo(side * 12, 53.5, side * 1.2, 51);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4.5, 55.5);
    ctx.quadraticCurveTo(0, 57.5, 4.5, 55.5);
    ctx.lineTo(0, 61.5);
    ctx.closePath();
    ctx.fill();
    if (!large) return;
    ctx.lineWidth = line(1.3);
    ctx.beginPath();
    ctx.moveTo(-2, 42.5);
    ctx.quadraticCurveTo(0, 44.5, 2, 42.5);
    ctx.stroke();
  }

  function paintFace(ctx, eye, line, large) {
    ctx.save();
    facePath(ctx);
    ctx.clip();
    ctx.fillStyle = '#d9c296';
    ctx.fillRect(-30, 10, 60, 55);
    ctx.fillStyle = '#f6eacb';
    ctx.translate(-5, -2);
    facePath(ctx);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = line(1.5);
    facePath(ctx);
    ctx.stroke();
    paintEye(ctx, -14, eye === -1, line);
    paintEye(ctx, 14, eye === 1, line);
    paintBrow(ctx, -1, line);
    paintBrow(ctx, 1, line);
    paintWhiskers(ctx, line, large);
  }

  function paintTrim(ctx, line, large) {
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = line(1.8);
    ctx.beginPath();
    ctx.moveTo(-31, 62);
    ctx.quadraticCurveTo(0, 79, 31, 62);
    ctx.stroke();
    if (!large) return;
    ctx.lineWidth = line(1.4);
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(side * 13, 87);
      ctx.quadraticCurveTo(side * 25, 90, side * 31, 77);
    }
    ctx.stroke();
  }

  // The sprite carries a little padding so the dark edge can fall outside the body.
  function paintDoll(height, tone, eye) {
    const pad = 3;
    const c = layer(height * 0.94 + pad * 2, height + pad * 2);
    const ctx = c.getContext('2d');
    const scale = height / 100;
    const line = (width) => Math.max(width, 0.9 / scale);
    const large = height > 34;
    ctx.lineCap = 'round';
    ctx.translate(c.width / 2, pad);
    ctx.scale(scale, scale);
    shadeBody(ctx, tone);
    ctx.strokeStyle = tone.foot;
    ctx.lineWidth = line(1);
    bodyPath(ctx);
    ctx.stroke();
    paintTrim(ctx, line, large);
    paintFace(ctx, eye, line, large);
    return c;
  }

  function makeDoll(g, rand, x, base, size, tone, eye) {
    const height = size * g.U;
    const sprite = paintDoll(height, tone, eye);
    const roll = height * 0.5;
    return {
      sprite,
      x,
      base,
      roll,
      ox: -sprite.width / 2,
      oy: roll - (3 + height * 0.99),
      width: height * 0.88,
      amp: lerp(0.024, 0.036, rand()),
      rate: lerp(0.55, 1.05, rand()),
      phase: rand() * 6.28,
      drift: rand() * 6.28,
    };
  }

  const pickEye = (rand) => (rand() < 0.36 ? (rand() < 0.75 ? 1 : -1) : 0);

  function placeRow(g, rand, spec) {
    const list = [];
    let x = -spec.sizes[0] * g.U * spec.start;
    for (let i = 0; x < g.W + g.U * 12; i++) {
      const size = spec.sizes[i % spec.sizes.length];
      const w = size * g.U * 0.88;
      const cx = x + w / 2;
      const hidden = Math.abs(cx - state.hero.x) < state.hero.width * spec.clear;
      if (!hidden) list.push(makeDoll(g, rand, cx, spec.base * g.U, size, spec.tone, pickEye(rand)));
      x += w * (1 + spec.gap);
    }
    return list;
  }

  function placeFront(g, rand, tone) {
    const u = g.U;
    const base = BASE.front * u;
    const list = [];
    let x = state.hero.x - state.hero.width / 2 - u * 2;
    for (let i = 0; x > -u * 14; i++) {
      const size = LEFT_SIZES[i % LEFT_SIZES.length];
      const w = size * u * 0.88;
      list.push(makeDoll(g, rand, x - w / 2, base, size, tone, pickEye(rand)));
      x -= w + u * 2.5;
    }
    x = state.hero.x + state.hero.width / 2 + u * 2.5;
    const left = state.koro.x - u * 16;
    const right = state.koro.x + u * 16;
    for (let i = 0; x < g.W + u * 12; i++) {
      let size = RIGHT_SIZES[i % RIGHT_SIZES.length];
      if (x < left) size = Math.min(size, (left - x) / (u * 0.88));
      if (x < right && (x >= left || size < 20)) {
        x = right;
        continue;
      }
      const w = size * u * 0.88;
      list.push(makeDoll(g, rand, x + w / 2, base, size, tone, pickEye(rand)));
      x += w + u * 2.5;
    }
    return list;
  }

  function placeDolls(g, rand) {
    state.hero = makeDoll(g, rand, g.W * 0.36, BASE.front * g.U, HERO_SIZE, TONE, 1);
    state.hero.amp = 0.024;
    state.hero.rate = 0.62;
    const back = placeRow(g, rand, {
      sizes: BACK_SIZES, base: BASE.back, start: 0.3, gap: 0.1, clear: 0, tone: TONE,
    });
    const mid = placeRow(g, rand, {
      sizes: MID_SIZES, base: BASE.mid, start: 0.55, gap: 0.08, clear: 0.56, tone: TONE,
    });
    state.dolls = [...back, ...mid];
    state.front = [...placeFront(g, rand, TONE), state.hero];
  }

  // The sky is flat rings around the sun, like the steps in a woodblock print.
  function paintSky(ctx, g) {
    const sx = g.W * 0.24;
    const sy = g.U * 21;
    ctx.fillStyle = SKY[0];
    ctx.fillRect(0, 0, g.W, g.H);
    const reach = Math.max(g.W * 0.8, g.U * 90);
    for (let i = 1; i < SKY.length; i++) {
      ctx.fillStyle = SKY[i];
      ctx.beginPath();
      ctx.ellipse(sx, sy, reach * (1 - i / SKY.length), g.U * (70 - i * 16), 0, 0, 6.3);
      ctx.fill();
    }
    ctx.fillStyle = '#fdf3d6';
    ctx.beginPath();
    ctx.arc(sx, sy, g.U * 7, 0, 6.3);
    ctx.fill();
  }

  function paintRoof(ctx, g, cx, hw) {
    const u = g.U;
    const ridge = u * 13;
    const eave = u * 29;
    ctx.fillStyle = '#937463';
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.5, ridge);
    ctx.lineTo(cx + hw * 0.5, ridge);
    ctx.quadraticCurveTo(cx + hw * 0.62, eave - u * 3, cx + hw, eave - u * 3);
    ctx.lineTo(cx + hw * 0.92, eave);
    ctx.lineTo(cx - hw * 0.92, eave);
    ctx.lineTo(cx - hw, eave - u * 3);
    ctx.quadraticCurveTo(cx - hw * 0.62, eave - u * 3, cx - hw * 0.5, ridge);
    ctx.fill();
    ctx.fillStyle = '#7a5e50';
    ctx.fillRect(cx - hw * 0.52, ridge - u * 1.4, hw * 1.04, u * 2);
    ctx.fillRect(cx - hw * 0.54, ridge - u * 3, u * 2, u * 3.4);
    ctx.fillRect(cx + hw * 0.54 - u * 2, ridge - u * 3, u * 2, u * 3.4);
    ctx.globalAlpha = 0.3;
    for (let x = -hw * 0.86; x < hw * 0.86; x += u * 3) {
      ctx.fillRect(cx + x * 0.72, ridge + u, Math.max(1, u * 0.5), eave - ridge - u * 2);
    }
    ctx.globalAlpha = 1;
  }

  function paintTemple(ctx, g) {
    const u = g.U;
    const cx = g.W * 0.66;
    const hw = Math.max(g.W * 0.36, u * 60);
    ctx.fillStyle = '#c8a97d';
    ctx.fillRect(cx - hw * 0.8, u * 27, hw * 1.6, u * 20);
    ctx.fillStyle = '#7a5e50';
    ctx.fillRect(cx - hw * 0.8, u * 28.6, hw * 1.6, u * 2.2);
    ctx.fillStyle = '#7a5e50';
    for (let x = -0.8; x <= 0.81; x += 0.2) ctx.fillRect(cx + hw * x - u * 0.9, u * 29, u * 1.8, u * 18);
    paintRoof(ctx, g, cx, hw);
  }

  function paintPine(ctx, g, rand) {
    const u = g.U;
    const x = g.W * 0.07;
    ctx.fillStyle = '#7a5e50';
    ctx.beginPath();
    ctx.moveTo(x - u * 2, u * 47);
    ctx.quadraticCurveTo(x + u * 1, u * 30, x + u * 8, u * 13);
    ctx.lineTo(x + u * 10, u * 14);
    ctx.quadraticCurveTo(x + u * 6, u * 32, x + u * 2.4, u * 47);
    ctx.fill();
    for (const [dx, y, rx, ry] of [[6, 15, 17, 4.5], [-6, 24, 11, 3.6], [19, 25, 11, 3.4]]) paintBough(ctx, g, rand, x + dx * u, y * u, rx * u, ry * u);
  }

  // A cloud-pruned bough: a dark mass under a scatter of short lighter needles.
  function paintBough(ctx, g, rand, x, y, rx, ry) {
    const size = Math.max(1, g.U * 0.9);
    ctx.fillStyle = '#6a6b4a';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, 6.3);
    ctx.fill();
    for (let i = 0; i < rx * rx * 0.5; i++) {
      const a = rand() * 6.283;
      const d = Math.sqrt(rand()) * 1.12;
      const py = y + Math.sin(a) * d * ry;
      ctx.fillStyle = py < y ? '#8e8c5e' : '#6a6b4a';
      ctx.fillRect(x + Math.cos(a) * d * rx, py, size * 1.6, size);
    }
  }

  // Low sun slipping between the dolls: slanted flat patches across a riser.
  function paintSlants(ctx, g, y0, y1) {
    const drop = (y1 - y0) * 1.1;
    ctx.fillStyle = '#8e6232';
    for (let f = 0.03; f < 1; f += 0.17) {
      const x = g.W * f;
      const w = g.W * (0.05 + 0.03 * Math.sin(f * 40));
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x + w, y0);
      ctx.lineTo(x + w + drop, y1);
      ctx.lineTo(x + drop, y1);
      ctx.fill();
    }
  }

  // One step of the stall: the plank top, its lit front edge, the dark riser below.
  function paintStep(ctx, g, rand, plank) {
    const u = g.U;
    const top = (plank.y - plank.depth * 0.6) * u;
    const edge = (plank.y + plank.depth * 0.4) * u;
    ctx.fillStyle = '#6c4f39';
    ctx.fillRect(0, edge, g.W, (plank.to - plank.y) * u);
    paintSlants(ctx, g, edge, plank.to * u);
    ctx.fillStyle = '#c9954f';
    ctx.fillRect(0, top, g.W, edge - top);
    ctx.fillStyle = '#8e6232';
    ctx.fillRect(0, edge, g.W, u * 2);
    ctx.fillStyle = '#e4bd78';
    ctx.fillRect(0, top, g.W, Math.max(1, u * 0.5));
    ctx.fillStyle = '#a97c40';
    for (let i = 0; i < g.W / 5; i++) {
      ctx.fillRect(rand() * g.W, top + rand() * (edge - top), u * (2 + rand() * 12), 1);
    }
  }

  function castShadow(ctx, g, d) {
    const h = d.sprite.height;
    ctx.fillStyle = 'rgba(40,20,16,0.55)';
    ctx.beginPath();
    ctx.ellipse(d.x + h * 0.26, d.base, h * 0.52, Math.max(1, g.U * 1.3), 0, 0, 6.3);
    ctx.fill();
  }

  function paintBackdrop(g, rand) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintSky(ctx, g);
    paintTemple(ctx, g);
    paintPine(ctx, g, rand);
    paintStep(ctx, g, rand, { y: BASE.back, depth: 5, to: BASE.mid });
    paintStep(ctx, g, rand, { y: BASE.mid, depth: 6, to: BASE.front });
    paintStep(ctx, g, rand, { y: BASE.front, depth: 7, to: 101 });
    for (const d of state.dolls) castShadow(ctx, g, d);
    for (const d of state.front) castShadow(ctx, g, d);
    return c;
  }

  function paintKoro(g) {
    const u = g.U;
    const c = layer(u * 34, u * 42);
    const ctx = c.getContext('2d');
    const x = c.width / 2;
    const y = u * 40;
    ctx.fillStyle = '#5a6650';
    for (const dx of [-9, 0, 9]) ctx.fillRect(x + dx * u - u * 1.2, y - u * 4, u * 2.4, u * 4);
    ctx.fillStyle = '#7d8e70';
    ctx.beginPath();
    ctx.moveTo(x - u * 14, y - u * 19);
    ctx.quadraticCurveTo(x - u * 14, y - u * 3, x, y - u * 3);
    ctx.quadraticCurveTo(x + u * 14, y - u * 3, x + u * 14, y - u * 19);
    ctx.fill();
    ctx.strokeStyle = '#b3bd92';
    ctx.lineWidth = u * 1.8;
    ctx.beginPath();
    ctx.moveTo(x - u * 11, y - u * 17);
    ctx.quadraticCurveTo(x - u * 11, y - u * 7, x - u * 4, y - u * 5.4);
    ctx.stroke();
    ctx.fillStyle = '#5a6650';
    ctx.fillRect(x - u * 15.5, y - u * 20.5, u * 31, u * 2.4);
    ctx.fillStyle = '#e6dcc4';
    ctx.fillRect(x - u * 13, y - u * 21.4, u * 26, u * 1);
    ctx.fillStyle = '#e0bd84';
    state.tips = [-4.5, 0.5, 5].map((dx, i) => {
      const top = y - u * [37, 39, 35][i];
      ctx.fillRect(x + dx * u, top, Math.max(1, u * 0.9), y - u * 21 - top);
      return { x: state.koro.x + dx * u, y: state.koro.base - (y - top) };
    });
    state.koro.ox = state.koro.x - x;
    state.koro.oy = state.koro.base - y;
    return c;
  }

  function makePlumes(g, rand) {
    return state.tips.map((tip, i) => ({
      x: tip.x + g.U * 0.25,
      y: tip.y,
      rise: g.U * [72, 66, 84][i],
      drift: -g.U * [84, 42, 62][i],
      amp: g.U * (7 + rand() * 5),
      wave: 5 + rand() * 3,
      rate: 0.55 + rand() * 0.3,
      phase: rand() * 6.28,
    }));
  }

  function plumeX(p, f, t) {
    const a = Math.sin(f * p.wave - t * p.rate + p.phase) * p.amp * Math.pow(f, 1.2);
    const b = Math.sin(f * p.wave * 2.3 - t * p.rate * 1.4 + p.phase) * p.amp * 0.4 * f * f;
    return p.x + p.drift * f * f + a + b;
  }

  function drawPlume(ctx, g, p, t, amount) {
    let px = plumeX(p, 0, t);
    let py = p.y;
    for (let k = 1; k <= PLUME_SEGMENTS; k++) {
      const f = k / PLUME_SEGMENTS;
      const x = plumeX(p, f, t);
      const y = p.y - f * p.rise;
      ctx.globalAlpha = Math.min(1, amount * Math.pow(1 - f, 0.8) * 0.72);
      ctx.lineWidth = Math.max(1, g.U * lerp(0.7, 4.5, f));
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
      px = x;
      py = y;
    }
  }

  function paintHaze(w, h) {
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const density = (x, y) => fbm(x * 0.04, y * 0.11, 4, 31);
    for (let y = 0; y < h; y++) {
      const band = Math.sin((y / h) * Math.PI);
      for (let x = 0; x < w; x++) {
        const v = lerp(density(x, y), density(x - w, y), x / w);
        const i = (y * w + x) * 4;
        img.data[i] = 238;
        img.data[i + 1] = 224;
        img.data[i + 2] = 198;
        img.data[i + 3] = (Math.round(smoothstep(0.5, 0.66, v) * band * 3) / 3) * 170;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function paintRope(ctx, g, y0, sag) {
    ctx.strokeStyle = '#8e6232';
    ctx.lineWidth = g.U * 2.2;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.quadraticCurveTo(g.W / 2, y0 + sag, g.W, y0);
    ctx.stroke();
    ctx.setLineDash([g.U * 1.3, g.U * 1.1]);
    ctx.strokeStyle = '#e4bd78';
    ctx.lineWidth = g.U * 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function paintFrame(g) {
    const u = g.U;
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintRope(ctx, g, u * 6.5, u * 2.5);
    ctx.fillStyle = '#6c4f39';
    ctx.fillRect(0, 0, g.W, u * 4.6);
    ctx.fillStyle = '#8e6232';
    ctx.fillRect(0, u * 3.8, g.W, u * 0.9);
    ctx.fillStyle = '#6c4f39';
    ctx.fillRect(0, 0, u * 3, g.H);
    ctx.fillRect(g.W - u * 3, 0, u * 3, g.H);
    ctx.fillStyle = '#8e6232';
    ctx.fillRect(u * 2.2, 0, Math.max(1, u * 0.8), g.H);
    return c;
  }

  function makeMotes(g, rand) {
    state.moteX = new Float32Array(MOTES);
    state.moteY = new Float32Array(MOTES);
    state.motePhase = new Float32Array(MOTES);
    for (let i = 0; i < MOTES; i++) {
      state.moteX[i] = rand() * g.W;
      state.moteY[i] = rand() * g.H * 0.8;
      state.motePhase[i] = rand() * 6.28;
    }
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.koro = { x: g.W * 0.86, base: BASE.front * g.U };
    placeDolls(g, rand);
    state.backdrop = paintBackdrop(g, rand);
    state.koroSprite = paintKoro(g);
    state.plumes = makePlumes(g, rand);
    state.haze = paintHaze(Math.ceil((g.W * 1.5) / 3), Math.ceil((g.H * 0.55) / 3));
    state.frame = paintFrame(g);
    makeMotes(g, rand);
  }

  function drawDoll(ctx, d, t, rock) {
    const swell = 0.6 + 0.4 * Math.sin(t * 0.11 + d.drift);
    const a = d.amp * rock * swell * Math.sin(t * d.rate + d.phase);
    const c = Math.cos(a);
    const s = Math.sin(a);
    ctx.setTransform(c, s, -s, c, d.x + d.roll * a, d.base - d.roll);
    ctx.drawImage(d.sprite, d.ox, d.oy);
  }

  function drawHaze(ctx, g, t, amount) {
    if (amount <= 0) return;
    const w = g.W * 1.5;
    const h = g.H * 0.55;
    const x = -((t * g.U * 1.7) % w);
    ctx.globalAlpha = Math.min(1, amount * 0.8);
    ctx.drawImage(state.haze, x, 0, w, h);
    ctx.drawImage(state.haze, x + w, 0, w, h);
    ctx.globalAlpha = 1;
  }

  function drawMotes(ctx, g, t) {
    ctx.fillStyle = '#fbe6b4';
    const size = Math.max(1, g.U * 0.7);
    for (let i = 0; i < MOTES; i++) {
      const p = state.motePhase[i];
      const x = (state.moteX[i] + t * g.U * 0.9 + Math.sin(t * 0.2 + p) * g.U * 2) % g.W;
      const y = state.moteY[i] + Math.sin(t * 0.13 + p) * g.U * 3;
      ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t * 0.4 + p);
      ctx.fillRect(x, y, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function drawIncense(ctx, g, t, amount) {
    ctx.fillStyle = '#e8743c';
    for (const tip of state.tips) {
      ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 0.7 + tip.x);
      ctx.fillRect(tip.x, tip.y, Math.max(1, g.U * 0.6), Math.max(1, g.U * 0.8));
    }
    ctx.strokeStyle = '#eadfca';
    ctx.lineCap = 'butt';
    for (const p of state.plumes) drawPlume(ctx, g, p, t, amount);
    ctx.globalAlpha = 1;
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const rock = api.props.rock;
    const smoke = api.props.smoke;
    ctx.drawImage(state.backdrop, 0, 0);
    ctx.imageSmoothingEnabled = false;
    for (const d of state.dolls) drawDoll(ctx, d, t, rock);
    ctx.imageSmoothingEnabled = true;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawHaze(ctx, g, t, smoke * 0.85);
    for (const d of state.front) drawDoll(ctx, d, t, rock);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(state.koroSprite, state.koro.ox, state.koro.oy);
    drawIncense(ctx, g, t, smoke);
    drawMotes(ctx, g, t);
    ctx.drawImage(state.frame, 0, 0);
  }

  Kasuri.run({
    defaults: { rock: 1, smoke: 1, ramp: 'lines', cell: 7, boost: 0.15, gain: 1.15, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
