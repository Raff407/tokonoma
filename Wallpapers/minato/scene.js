/*
 * 港 Minato — a small fishing harbour under your clock, boats rocking at their moorings.
 *
 * Every boat, the village and the jetty are baked once, cropped to what they cover, and
 * tinted by the sky (lamps included) once a minute. Per frame a boat is one rotated sprite
 * already cut at its waterline plus a few wavering strips of itself for the reflection,
 * and one pre-tinted ripple layer slides across the water, faster near the viewer.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, smoothstep, mixColor, toHex, parseColor } = K;

  const SHORE = 0.5;
  const RETINT_SECONDS = 60;
  const BACK_STRIPS = 9;
  const BOAT_STRIPS = 7;
  const MIRROR_MIN_LEN = 35;
  const CUT_BELOW = 1.5;
  const RIPPLE_SPLIT = 0.36;
  // Sprite box per kind in boat units: width, and height down to the waterline.
  const SPRITE = { trawler: [124, 72], sampan: [124, 40], post: [26, 40] };
  const SKY_BANDS = 4;
  const SKY_FOOT = 0.37;
  const WATER_BANDS = 2;
  const MIRROR_WASH = 0.54;
  const MAX_GULLS = 12;
  const GOLD = '#f0c070';
  const LAMP = '#fbe2a8';
  const DEPTH = 7;
  const JETTY_TIP = 0.6;

  const LOOKS = {
    cedar: { plank: ['#c79e68', '#b58b58'], inside: '#6a5644', rail: '#efe6ca', boot: '#b84a32', cabin: '#e0d8c0', roof: '#3b4a68', sail: '#dcd2b4' },
    indigo: { plank: ['#54779f', '#486a92'], inside: '#4e4e58', rail: '#ece2c6', boot: '#9c4632', cabin: '#d4ccb4', roof: '#6a4a36', sail: '#b7bda8' },
    ash: { plank: ['#8c8a76', '#7c7b68'], inside: '#45433d', rail: '#cfc7ac', boot: '#3d5a56', cabin: '#cfc8b2', roof: '#823c2e', sail: '#d2c8aa' },
    moss: { plank: ['#6f8460', '#627656'], inside: '#3e4238', rail: '#d3cbb0', boot: '#8a4a30', cabin: '#d6ceb6', roof: '#39465e', sail: '#cfc4a4' },
  };

  // Back to front. x and wl are fractions of the canvas; len is in grid units.
  const FLEET = [
    { kind: 'trawler', x: 0.47, wl: 0.585, len: 30, dir: -1, rock: 0.03, w: 1.3, look: 'moss', bob: 0.3 },
    { kind: 'trawler', x: 0.075, wl: 0.64, len: 40, dir: -1, rock: 0.034, w: 0.95, look: 'ash', bob: 0.4, wide: true },
    { kind: 'trawler', x: 0.865, wl: 0.715, len: 58, dir: 1, rock: 0.036, w: 1.08, look: 'indigo', bob: 0.6 },
    { kind: 'trawler', x: 0.39, wl: 0.81, len: 98, dir: 1, rock: 0.032, w: 0.78, look: 'cedar', bob: 0.8, hero: true },
    { kind: 'post', x: 0.722, wl: 0.93, len: 92, dir: 1, rock: 0, w: 1, look: 'cedar', bob: 0 },
    { kind: 'sampan', x: 0.865, wl: 0.975, len: 52, dir: -1, rock: 0.05, w: 1.55, look: 'cedar', bob: 0.6 },
  ];

  const state = {};

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Small paint helpers, used only while baking.
  function box(c, colour, x, y, w, h) {
    c.fillStyle = colour;
    c.fillRect(x, y, w, h);
  }

  function poly(c, colour, ...pts) {
    c.fillStyle = colour;
    c.beginPath();
    for (let i = 0; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.fill();
  }

  // A filled chain of quadratic curves: start point, then control and end pairs.
  function curves(c, colour, x0, y0, ...q) {
    c.fillStyle = colour;
    c.beginPath();
    c.moveTo(x0, y0);
    for (let i = 0; i < q.length; i += 4) c.quadraticCurveTo(q[i], q[i + 1], q[i + 2], q[i + 3]);
    c.fill();
  }

  // Separate straight strokes, four numbers each.
  function segs(c, colour, width, ...s) {
    c.strokeStyle = colour;
    c.lineWidth = width;
    c.beginPath();
    for (let i = 0; i < s.length; i += 4) {
      c.moveTo(s[i], s[i + 1]);
      c.lineTo(s[i + 2], s[i + 3]);
    }
    c.stroke();
  }

  function dot(c, colour, x, y, rx, ry = rx) {
    c.fillStyle = colour;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, 6.3);
    c.fill();
  }

  function softGlow(c, x, y, r, colour, strength) {
    const [cr, cg, cb] = parseColor(colour);
    const grad = c.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${cr},${cg},${cb},${strength})`);
    grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    box(c, grad, x - r, y - r, r * 2, r * 2);
  }

  /* ---------- hull and boats, drawn in boat units: 92 long, water at y = 0 ---------- */

  function hullX(f) {
    return lerp(-45, 46, f);
  }

  function sheer(p, f) {
    if (f < 0.35) {
      const a = 1 - f / 0.35;
      return p.mid + (p.stern - p.mid) * a * a;
    }
    return p.mid + (p.bow - p.mid) * Math.pow((f - 0.35) / 0.65, 2.4);
  }

  // Walks the hull stern to stem or back; level runs from the rail (0) to the keel (1).
  function traceBand(c, p, level, reverse) {
    for (let i = 0; i <= 20; i++) {
      const f = (reverse ? 20 - i : i) / 20;
      c.lineTo(hullX(f), lerp(-sheer(p, f), DEPTH, level));
    }
  }

  function paintDeck(c, p, tone) {
    c.fillStyle = tone;
    c.beginPath();
    for (let f = 0; f <= 1.001; f += 0.05) c.lineTo(hullX(f), -sheer(p, f) - p.lift * Math.sin(Math.PI * Math.min(1, f + 0.08)));
    traceBand(c, p, 0, true);
    c.fill();
  }

  function paintStrakes(c, p, look, k, rand) {
    const n = 6;
    c.strokeStyle = '#3c2f26';
    c.lineWidth = Math.max(0.8 / k, 0.28);
    for (let s = 0; s < n; s++) {
      c.fillStyle = look.plank[s % look.plank.length];
      c.beginPath();
      traceBand(c, p, s / n, false);
      traceBand(c, p, (s + 1) / n, true);
      c.fill();
    }
    for (let s = 1; s < n; s++) {
      c.beginPath();
      traceBand(c, p, s / n, false);
      c.stroke();
    }
    c.globalAlpha = 0.2;
    for (let i = 0; i < 16; i++) {
      const f = rand();
      box(c, rand() < 0.6 ? '#3d2f25' : '#d9cca8', hullX(f), -sheer(p, f) + 2 + rand() * 6, 0.5 + rand() * 0.7, 2 + rand() * 7);
    }
    c.globalAlpha = 1;
  }

  function paintHull(c, p, look, k, rand) {
    c.save();
    c.beginPath();
    c.moveTo(-43, DEPTH);
    c.lineTo(-45.5, -sheer(p, 0));
    traceBand(c, p, 0, false);
    c.quadraticCurveTo(41, -10, 35, DEPTH);
    c.closePath();
    c.clip();
    paintStrakes(c, p, look, k, rand);
    poly(c, look.boot, -60, -2.6, 0, -2.1, 60, -4, 60, 12, -60, 12);
    c.restore();
    c.lineCap = 'round';
    c.strokeStyle = look.rail;
    c.lineWidth = 1.5;
    c.beginPath();
    traceBand(c, p, 0, false);
    c.stroke();
  }

  function paintCabin(c, lit, look) {
    const [x0, x1, floor, top] = [-31, -9, -11, -29];
    box(c, look.cabin, x0, top, x1 - x0, floor - top);
    box(c, '#8f8a78', x0, top + 11, x1 - x0, 1);
    for (let i = 0; i < 3; i++) {
      box(c, '#2b3246', x0 + 2.2 + i * 6.5, top + 3, 4.8, 5.5);
      box(lit, GOLD, x0 + 2.2 + i * 6.5, top + 3, 4.8, 5.5);
    }
    softGlow(lit, (x0 + x1) / 2, top + 6, 10, GOLD, 0.2);
    poly(c, look.roof, x0 - 3, top + 1.8, x0 - 3, top + 0.6, (x0 + x1) / 2, top - 1.4, x1 + 3, top + 0.6, x1 + 3, top + 1.8);
    box(c, '#3a3434', x0 + 4, top - 8, 2.2, 7);
    box(c, '#7a3a2c', x0 + 3.6, top - 9, 3, 1.4);
  }

  function paintRig(c, lit, p, look, k) {
    const line = Math.max(0.9 / k, 0.4);
    segs(c, '#6a5c50', line, 45, -p.bow, -4, -60, -4, -60, -40, -44, -40, -44, -44, -p.stern);
    poly(c, '#86694c', -5.4, -10, -4.5, -61, -3.5, -61, -2.6, -10);
    box(c, '#86694c', -11, -50, 14, 1);
    box(c, '#86694c', -41, -46, 1.4, 34);
    poly(c, look.sail, -40, -45, -53, -19, -40, -19);
    segs(c, '#857c68', line, -40, -25.5, -49.75, -25.5, -40, -32, -46.5, -32, -40, -38.5, -43.25, -38.5);
    for (let i = 1; i < 8; i++) {
      const x = lerp(-4, 45, i / 8);
      const y = lerp(-60, -p.bow, i / 8) + 2.2;
      dot(c, '#e8e4d2', x, y, 1.1);
      softGlow(lit, x, y, 3.2, GOLD, 0.9);
    }
  }

  function paintNets(c, rand, k) {
    curves(c, '#6e6246', 1, -9, 4, -21, 15, -20, 27, -21, 31, -11);
    const lines = [];
    for (let i = 0; i < 10; i++) lines.push(3 + i * 2.8, -9, 2 + i * 2.8 + rand() * 3, -20);
    segs(c, '#4b4332', Math.max(0.8 / k, 0.3), ...lines);
    for (let i = 0; i < 6; i++) dot(c, i % 2 ? '#c9493a' : '#dcb45a', 4 + i * 4.6, -15 - Math.sin(i * 1.1 + 0.5) * 4, 1.5);
  }

  function paintFenders(c, p) {
    for (const f of [0.28, 0.48, 0.66]) dot(c, '#d7cda8', hullX(f), -sheer(p, f) + 4.4, 1.7, 3);
    box(c, '#efe7cc', hullX(0.82), -sheer(p, 0.82) + 2.4, 7, 3);
    dot(c, '#2a2628', hullX(0.93), -sheer(p, 0.93) + 4, 0.9);
  }

  // A standing gull, feet at x,y: back, wing, head and bill, not an ellipse with sticks.
  function paintPerched(c, x, y, s) {
    const at = (...d) => d.map((v, i) => (i % 2 ? y - v * s : x + v * s));
    box(c, '#d29a4c', x - 0.16 * s, y - 0.5 * s, 0.1 * s, 0.5 * s);
    box(c, '#d29a4c', x + 0.1 * s, y - 0.5 * s, 0.1 * s, 0.5 * s);
    curves(c, '#f2eee0', ...at(-1.25, 0.72, -0.2, 0.18, 0.46, 0.62, 0.64, 1, 0.5, 1.35, 0.25, 1.6, 0.1, 1.3, -0.5, 1.3, -1.25, 0.72));
    dot(c, '#f2eee0', x + 0.34 * s, y - 1.42 * s, 0.27 * s);
    poly(c, '#d29a4c', ...at(0.56, 1.48, 0.96, 1.34, 0.56, 1.3));
    curves(c, '#7f8590', ...at(0.14, 1.12, -0.5, 1.14, -1, 0.8, -0.4, 0.62, 0.14, 1.12));
    poly(c, '#26262c', ...at(-0.8, 0.86, -1.5, 0.62, -0.72, 0.7));
  }

  function paintTrawler(c, lit, spec, k, rand) {
    const look = LOOKS[spec.look];
    const p = { stern: 16, mid: 12, bow: 32, lift: 2.4 };
    paintDeck(c, p, look.inside);
    paintRig(c, lit, p, look, k);
    paintCabin(c, lit, look);
    paintNets(c, rand, k);
    paintHull(c, p, look, k, rand);
    paintFenders(c, p);
    if (spec.hero) paintPerched(c, -18, -30.5, 3.4);
    return { bow: { x: 45, y: -p.bow + 1 }, stern: { x: -44, y: -p.stern + 1 } };
  }

  function paintSampan(c, lit, spec, k, rand) {
    const p = { stern: 13, mid: 11, bow: 22, lift: 7 };
    paintDeck(c, p, '#5a4938');
    for (const f of [0.3, 0.52, 0.72]) box(c, '#b09468', hullX(f), -sheer(p, f) - 5.6, 3.2, 6);
    dot(c, '#d2c7a4', hullX(0.14), -sheer(p, 0.14) - 2.6, 7, 3);
    dot(c, '#a89a76', hullX(0.14), -sheer(p, 0.14) - 2.6, 4, 1.6);
    segs(c, '#6a5138', 1.2, -24, -sheer(p, 0.2) - 1, -58, -2);
    paintHull(c, p, LOOKS[spec.look], k, rand);
    return { bow: { x: 45, y: -p.bow + 1 }, stern: { x: -44, y: -p.stern + 1 } };
  }

  function paintPost(c) {
    const [h, w] = [21, 2.6];
    box(c, '#8c7354', -w, -h, w * 2, h + DEPTH);
    box(c, '#ad9470', -w, -h, w * 0.9, h + DEPTH);
    box(c, '#c9b48c', -w, -h, w * 2, 1);
    box(c, '#5a6a54', -w, -4, w * 2, 4 + DEPTH);
    box(c, '#e0d6b2', -w - 0.5, -h + 6, w * 2 + 1, 1.8);
    box(c, '#e0d6b2', -w - 0.5, -h + 9, w * 2 + 1, 1);
    paintPerched(c, -0.4, -h, 7);
    return { bow: { x: 0, y: -h + 8 }, stern: { x: 0, y: -h + 8 } };
  }

  // The sprite stops just under the waterline, so it needs no clip when drawn.
  function buildBoat(g, spec, rand) {
    const k = (spec.len / 92) * g.U;
    const [boxW, boxH] = SPRITE[spec.kind];
    const w = Math.ceil(boxW * k);
    const ax = w / 2;
    const ay = Math.ceil(boxH * k);
    const h = spec.rock ? Math.ceil(ay + CUT_BELOW * k) : ay;
    const base = layer(w, h);
    const glow = layer(w, h);
    const c = base.getContext('2d');
    const lit = glow.getContext('2d');
    c.setTransform(spec.dir * k, 0, 0, k, ax, ay);
    lit.setTransform(spec.dir * k, 0, 0, k, ax, ay);
    const paint = spec.kind === 'post' ? paintPost : spec.kind === 'sampan' ? paintSampan : paintTrawler;
    const ends = paint(c, lit, spec, k, rand);
    return {
      spec, k, base, glow, ax, ay, w, h, ends,
      tinted: layer(w, h), mirrorTint: spec.len >= MIRROR_MIN_LEN ? layer(w, ay) : null,
      cx: spec.x * g.W, wl: spec.wl * g.H,
      phase: rand() * 6.28, phase2: rand() * 6.28,
      angle: 0, lift: 0,
      hasGlow: spec.kind === 'trawler',
      mirrored: spec.len >= MIRROR_MIN_LEN,
      stripH: Math.max(2, Math.round(k * 4.2)),
    };
  }

  /* ---------- the shore: woods, terraces of houses, sea wall, net sheds ---------- */

  function ridgeY(g, x) {
    const f = x / g.W;
    return g.H * lerp(0.41, 0.17, smoothstep(0.05, 0.85, f)) - (fbm((x / g.U) * 0.03, 3, 3, 7) - 0.5) * g.U * 14;
  }

  function paintWoods(c, g) {
    const tones = ['#46684c', '#587a55', '#6f8e5e'];
    for (let x = 0; x < g.W; x++) {
      for (let y = Math.floor(ridgeY(g, x)); y < g.H * SHORE; y++) {
        const v = fbm((x / g.U) * 0.16, (y / g.U) * 0.22, 3, 11);
        box(c, tones[Math.max(0, Math.min(2, Math.round((v - 0.36) * 8)))], x, y, 1, 1);
      }
    }
  }

  function paintHouse(c, lit, g, rand, x, y, w) {
    const u = g.U;
    const wallH = u * (2.8 + rand() * 1.6);
    const roofY = y - wallH - u * (2.2 + rand() * 1.2);
    box(c, '#8c8878', x - u, y, w + u * 2, Math.max(1, u * 0.8));
    box(c, ['#ded4ba', '#b4945f', '#8b7050'][Math.floor(rand() * 3)], x, y - wallH, w, wallH);
    poly(c, ['#465064', '#6a4638', '#3c5a74'][Math.floor(rand() * 3)], x - u * 0.9, y - wallH, x + w * 0.2, roofY, x + w * 0.8, roofY, x + w + u * 0.9, y - wallH);
    box(c, '#a4a6a4', x + w * 0.2, roofY, w * 0.6, Math.max(1, u * 0.4));
    const panes = 1 + Math.floor(rand() * 2);
    for (let i = 0; i < panes; i++) {
      const px = x + (w * (i + 0.5)) / panes - u * 0.7;
      box(c, '#343a4a', px, y - wallH * 0.8, u * 1.4, wallH * 0.55);
      if (rand() < 0.65) box(lit, GOLD, px, y - wallH * 0.8, u * 1.4, wallH * 0.55);
    }
  }

  function paintTerraces(c, lit, g, rand) {
    const u = g.U;
    for (let r = 5; r >= 0; r--) {
      const y = g.H * SHORE - u * (15.5 + r * 6.8);
      let x = -u * 4 + rand() * u * 6;
      while (x < g.W) {
        const w = u * (6.5 + rand() * 5);
        const dense = fbm((x / u) * 0.05, r * 1.4, 2, 19) + (x / g.W) * 0.16;
        if (y > ridgeY(g, x + w / 2) + u * 4 && dense > 0.4 + r * 0.012) paintHouse(c, lit, g, rand, x, y + rand() * u, w);
        x += w + u * (1.2 + rand() * 3);
      }
    }
  }

  function paintShrine(c, g) {
    const u = g.U;
    const x = g.W * 0.8;
    const top = ridgeY(g, x) + u * 9;
    for (let y = top + u * 2; y < g.H * SHORE - u * 12; y += u * 1.5) box(c, '#c2bca6', x - u * 1.1, y, u * 2.2, Math.max(1, u * 0.7));
    box(c, '#b8452e', x - u * 2.4, top - u * 3.6, u * 0.8, u * 5.6);
    box(c, '#b8452e', x + u * 1.6, top - u * 3.6, u * 0.8, u * 5.6);
    box(c, '#b8452e', x - u * 3.4, top - u * 2.6, u * 6.8, Math.max(1, u * 0.6));
    box(c, '#b8452e', x - u * 3.9, top - u * 4.3, u * 7.8, Math.max(1, u * 0.9));
  }

  function paintSeaWall(c, g, rand) {
    const u = g.U;
    const shore = g.H * SHORE;
    box(c, '#a09a86', 0, shore - u * 3, g.W, u * 3);
    for (let row = 0; row < 3; row++) {
      for (let x = -rand() * u * 4, w = 0; x < g.W; x += w) {
        w = u * (2.4 + rand() * 2.6);
        box(c, rand() < 0.5 ? '#8a8574' : '#b2ac96', x, shore - u * 3 + row * u, w - 1, Math.max(1, u * 0.8));
      }
    }
    box(c, '#4a5a4c', 0, shore - u * 0.8, g.W, u * 0.8);
  }

  function paintShed(c, lit, g, rand, x, base, w) {
    const u = g.U;
    const wall = u * (6.5 + rand() * 2);
    const peak = base - wall - u * (3.6 + rand() * 1.6);
    const eave = base - wall + u * 0.3;
    box(c, rand() < 0.5 ? '#7a6248' : '#6a5844', x, base - wall, w, wall);
    for (let px = x + u; px < x + w; px += u * 1.7) box(c, '#54452f', px, base - wall, Math.max(1, u * 0.3), wall);
    box(c, '#2f2c30', x + w * 0.26, base - wall * 0.76, w * 0.48, wall * 0.76);
    box(c, '#6f6a4e', x + w * 0.3, base - wall * 0.7, w * 0.16, wall * 0.5);
    poly(c, '#626a78', x - u * 1.2, eave, x + w / 2, peak, x + w + u * 1.2, eave);
    poly(c, '#aeb0a8', x - u * 1.2, eave, x + w / 2, peak, x + w / 2, peak + u * 0.9, x - u * 0.2, eave);
    const lampX = x + w / 2;
    const lampY = base - wall * 0.86;
    softGlow(lit, lampX, lampY, u * 3.4, GOLD, 0.5);
    box(lit, LAMP, lampX - u * 0.6, lampY - u * 0.6, u * 1.2, u * 1.2);
    return { x: lampX, w: u * 1.5 };
  }

  function paintNetRack(c, g, x, base, w) {
    const u = g.U;
    const h = u * 8;
    box(c, '#5a4634', x, base - h, Math.max(1, u * 0.5), h);
    box(c, '#5a4634', x + w, base - h, Math.max(1, u * 0.5), h);
    box(c, '#5a4634', x, base - h, w, Math.max(1, u * 0.4));
    poly(c, '#b2a57e', x, base - h, x + w, base - h, x + w * 0.92, base - u * 2, x + w / 2, base - u * 1.4, x + w * 0.08, base - u * 2);
    for (let px = x + u; px < x + w; px += u * 1.5) box(c, '#726a50', px, base - h, 1, h - u * 1.6);
  }

  function paintSheds(c, lit, g, rand) {
    const u = g.U;
    const base = g.H * SHORE - u * 3;
    const lamps = [];
    let x = -u * 3;
    while (x < g.W * 0.82) {
      const w = u * (14 + rand() * 9);
      lamps.push(paintShed(c, lit, g, rand, x, base, w));
      x += w + u * 2;
      if (rand() < 0.55) {
        const gap = u * (8 + rand() * 5);
        paintNetRack(c, g, x - u, base, gap);
        x += gap;
      }
    }
    return lamps;
  }

  function buildVillage(g, rand) {
    const shore = Math.ceil(g.H * SHORE);
    state.village = layer(g.W, shore);
    state.villageTint = layer(g.W, shore);
    state.villageGlow = layer(g.W, shore);
    const c = state.village.getContext('2d');
    const lit = state.villageGlow.getContext('2d');
    paintWoods(c, g);
    paintTerraces(c, lit, g, rand);
    paintShrine(c, g);
    paintSeaWall(c, g, rand);
    return paintSheds(c, lit, g, rand);
  }

  /* ---------- the stone jetty, running from the far right shore toward the viewer ---------- */

  function jettyAt(g, x) {
    const tip = g.W * JETTY_TIP;
    const s = Math.max(0, Math.min(1, (x - tip) / (g.W * 1.04 - tip)));
    return { water: lerp(0.64, 0.515, s) * g.H, face: lerp(7.5, 3, s) * g.U, depth: lerp(7, 2.4, s) * g.U };
  }

  function paintJettyFace(c, g, rand) {
    const tip = g.W * JETTY_TIP;
    const rows = 4;
    for (let x = tip, w = 0; x < g.W + g.U * 4; x += w) {
      const a = jettyAt(g, x);
      w = g.U * lerp(5, 2.4, (x - tip) / (g.W - tip));
      const b = jettyAt(g, x + w);
      for (let r = 0; r < rows; r++) {
        const off = r % 2 ? w * 0.5 : 0;
        poly(c, rand() < 0.5 ? '#a09a86' : '#8a8574',
          x + off, a.water - (a.face * r) / rows, x + w + off, b.water - (b.face * r) / rows,
          x + w + off, b.water - (b.face * (r + 1)) / rows + 0.6, x + off, a.water - (a.face * (r + 1)) / rows + 0.6);
      }
    }
  }

  function paintJettyTop(c, g) {
    const u = g.U;
    const tx = g.W * JETTY_TIP;
    const fx = g.W * 1.04;
    const a = jettyAt(g, tx);
    const far = jettyAt(g, fx);
    const ty = a.water - a.face;
    const back = tx - a.depth * 1.2;
    poly(c, '#c8c2aa', tx, ty, fx, far.water - far.face, fx, far.water - far.face - far.depth, back, ty - a.depth);
    poly(c, '#7e7a6a', tx, ty, tx, a.water, back, a.water - a.depth, back, ty - a.depth);
    poly(c, '#4a5a4c', back, a.water - a.depth, tx, a.water, fx, far.water, fx, far.water - u * 0.6, tx, a.water - u * 1.1, back, a.water - a.depth - u);
  }

  function paintBoxes(c, g) {
    const u = g.U;
    const j = jettyAt(g, g.W * 0.72);
    const y = j.water - j.face - j.depth * 0.45;
    const tones = ['#3f6088', '#a5835a', '#3f6088', '#b8452e', '#a5835a'];
    [[0, 0], [4, 0], [8, 0], [2, 3], [6, 3]].forEach(([dx, dy], i) => {
      box(c, tones[i], g.W * 0.72 + dx * u, y - (dy + 3) * u, u * 3.8, u * 2.8);
      box(c, '#2f2c30', g.W * 0.72 + dx * u, y - (dy + 3) * u, u * 3.8, Math.max(1, u * 0.3));
    });
  }

  function paintToro(c, lit, g) {
    const u = g.U;
    const a = jettyAt(g, g.W * JETTY_TIP);
    const x = g.W * JETTY_TIP - a.depth * 0.5;
    const y = a.water - a.face - a.depth * 0.45;
    box(c, '#b4ae98', x - u * 3, y - u * 1.6, u * 6, u * 1.6);
    box(c, '#9a9582', x - u * 1.1, y - u * 8, u * 2.2, u * 6.6);
    box(c, '#c4bea8', x - u * 2.8, y - u * 9, u * 5.6, u * 1.2);
    box(c, '#c4bea8', x - u * 2.2, y - u * 12.6, u * 4.4, u * 3.6);
    box(c, '#343a4a', x - u * 1.2, y - u * 12, u * 2.4, u * 2.4);
    curves(c, '#8c887a', x - u * 4.4, y - u * 12.2, x - u * 1.4, y - u * 13.4, x, y - u * 15.6, x + u * 1.4, y - u * 13.4, x + u * 4.4, y - u * 12.2);
    dot(c, '#8c887a', x, y - u * 16, u * 0.8);
    softGlow(lit, x, y - u * 10.8, u * 5, GOLD, 0.55);
    box(lit, LAMP, x - u * 1.2, y - u * 12, u * 2.4, u * 2.4);
    return { x, w: u * 2.6 };
  }

  function paintJettyMirror(g, jetty) {
    const m = layer(g.W, g.H);
    const c = m.getContext('2d');
    for (let x = Math.floor(g.W * JETTY_TIP - g.U * 10); x < g.W; x++) {
      const w = jettyAt(g, x).water;
      c.setTransform(1, 0, 0, -1.2, 0, w * 2.2);
      c.drawImage(jetty, x, 0, 1, w, x, 0, 1, w);
    }
    return m;
  }

  // First and last painted row or column of an alpha buffer, read once while baking.
  function scanRows(d, w, h) {
    let y0 = h;
    let y1 = -1;
    let x0 = w;
    let x1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!d[(y * w + x) * 4 + 3]) continue;
        y0 = Math.min(y0, y);
        y1 = y;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
    }
    return { x0, y0, x1, y1 };
  }

  // The rectangle that holds everything painted on these same-sized layers.
  function contentBounds(layers) {
    const w = layers[0].width;
    const h = layers[0].height;
    const r = { x0: w, y0: h, x1: -1, y1: -1 };
    for (const l of layers) {
      const s = scanRows(l.getContext('2d').getImageData(0, 0, w, h).data, w, h);
      r.x0 = Math.min(r.x0, s.x0);
      r.y0 = Math.min(r.y0, s.y0);
      r.x1 = Math.max(r.x1, s.x1);
      r.y1 = Math.max(r.y1, s.y1);
    }
    if (r.x1 < 0) return { x: 0, y: 0, w: 1, h: 1 };
    return { x: r.x0, y: r.y0, w: r.x1 - r.x0 + 1, h: r.y1 - r.y0 + 1 };
  }

  function crop(src, b) {
    const c = layer(b.w, b.h);
    c.getContext('2d').drawImage(src, -b.x, -b.y);
    return c;
  }

  // A baked piece kept only as big as what it covers, drawn back at its offset.
  function piece(sources, b) {
    return { x: b.x, y: b.y, base: crop(sources[0], b), glow: sources[1] ? crop(sources[1], b) : null, tint: layer(b.w, b.h) };
  }

  function buildJetty(g, rand) {
    const full = layer(g.W, g.H);
    const glow = layer(g.W, g.H);
    const c = full.getContext('2d');
    paintJettyTop(c, g);
    paintJettyFace(c, g, rand);
    paintBoxes(c, g);
    const lamp = paintToro(c, glow.getContext('2d'), g);
    const mirror = paintJettyMirror(g, full);
    state.jetty = piece([full, glow], contentBounds([full, glow]));
    state.jettyMirror = piece([mirror], contentBounds([mirror]));
    return lamp;
  }

  /* ---------- sky and water textures ---------- */

  // grey(x, y) gives 0 for clear, or the brightness of a flat opaque pixel.
  function paintMask(w, h, grey) {
    const m = layer(w, h);
    const c = m.getContext('2d');
    const img = c.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = grey(x, y);
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = v ? 255 : 0;
      }
    }
    c.putImageData(img, 0, 0);
    return m;
  }

  function paintCloudMask(g, w, h) {
    const density = (x, y) => fbm((x / g.U) * 0.028, (y / g.U) * 0.11, 4, 31);
    return paintMask(w, h, (x, y) => {
      const v = lerp(density(x, y), density(x - w, y), x / w);
      const d = smoothstep(0.5, 0.68, v) * Math.sin((y / h) * Math.PI);
      return d > 0.5 ? 255 : d > 0.22 ? 212 : 0;
    });
  }

  // Thin streaks, short by the shore and long up close.
  function paintRippleMask(g, w, h, seed, hit) {
    const rows = (h / g.U) * 1.25;
    return paintMask(w, h, (x, y) => {
      const v = y / h;
      const fx = 1 / (lerp(5, 24, v) * g.U);
      const row = Math.log(1 + 2.2 * v) * rows;
      return hit(lerp(fbm(x * fx, row, 2, seed), fbm((x - w) * fx, row, 2, seed), x / w)) ? 255 : 0;
    });
  }

  function buildWater(g) {
    const h = g.H - Math.ceil(g.H * SHORE) + 1;
    const w = Math.ceil(g.W * 1.2);
    state.lightMask = paintRippleMask(g, w, h, 41, (v) => v > 0.64);
    state.darkMask = paintRippleMask(g, w, h, 57, (v) => v < 0.365);
    state.lightTint = layer(w, h);
    state.darkTint = layer(w, h);
    state.ripples = layer(w, h);
    state.water = layer(g.W, h);
  }

  function buildGulls(g, rand) {
    const anchors = [[0.17, 0.2], [0.52, 0.14], [0.3, 0.3], [0.68, 0.24], [0.84, 0.1], [0.44, 0.09],
      [0.08, 0.34], [0.6, 0.36], [0.92, 0.3], [0.24, 0.1], [0.75, 0.16], [0.38, 0.2]];
    state.gulls = anchors.map(([fx, fy], i) => ({
      cx: fx * g.W,
      cy: fy * g.H,
      rx: g.U * (9 + rand() * 12),
      ry: g.U * (2.5 + rand() * 3.5),
      span: g.U * (i < 3 ? 11 - i * 1.2 : 5.4 + rand() * 2.4),
      w: (i % 2 ? 1 : -1) * (0.13 + rand() * 0.1),
      phase: rand() * 6.28,
      flap: 1.8 + rand() * 1.2,
    }));
  }

  /* ---------- once a minute: re-tint everything by the sky ---------- */

  // Multiply by the sky; lift, if given, is added on top so dark planks still read at night.
  function tintInto(target, source, colour, lift) {
    const c = target.getContext('2d');
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, target.width, target.height);
    c.drawImage(source, 0, 0);
    c.globalCompositeOperation = 'multiply';
    box(c, toHex(colour), 0, 0, target.width, target.height);
    if (lift) {
      c.globalCompositeOperation = 'lighter';
      box(c, toHex(lift), 0, 0, target.width, target.height);
    }
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(source, 0, 0);
    c.globalCompositeOperation = 'source-over';
  }

  // Lamps are baked in at the current darkness, so they cost nothing per frame.
  function addGlow(target, glow, night) {
    if (!glow || night <= 0.05) return;
    const c = target.getContext('2d');
    c.globalAlpha = night;
    c.drawImage(glow, 0, 0);
    c.globalAlpha = 1;
  }

  function wash(target, colour, amount) {
    const c = target.getContext('2d');
    c.globalCompositeOperation = 'source-atop';
    c.globalAlpha = amount;
    box(c, toHex(colour), 0, 0, target.width, target.height);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  // The sun sets over the open left of the bay; the moon crosses the other way.
  function discInfo(g, sky) {
    const isSun = sky.night < 0.6;
    const t = isSun ? S.sunT(sky.hour) : S.moonT(sky.hour);
    const x = (isSun ? lerp(0.86, 0.14, t) : lerp(0.14, 0.86, t)) * g.W;
    return { x, y: g.H * (0.31 - Math.sin(t * Math.PI) * 0.22), isSun };
  }

  function paintStars(c, g, night) {
    const rand = K.rng(3);
    for (let i = 0; i < g.W * 0.5; i++) {
      c.globalAlpha = night * (0.2 + rand() * 0.5);
      box(c, '#e4e3d8', rand() * g.W, rand() * g.H * 0.36, 1, 1);
    }
    c.globalAlpha = 1;
  }

  function paintBackdrop(g, sky, disc) {
    const c = state.backdrop.getContext('2d');
    const top = mixColor(mixColor(sky.top, sky.low, 0.34), [64, 74, 122], sky.night * 0.85);
    const low = mixColor(sky.low, [122, 128, 172], sky.night * 0.75);
    const foot = g.H * SKY_FOOT;
    box(c, toHex(low), 0, 0, g.W, g.H);
    for (let i = 0; i < SKY_BANDS - 1; i++) box(c, toHex(mixColor(top, low, i / (SKY_BANDS - 1))), 0, (foot * i) / SKY_BANDS, g.W, foot / SKY_BANDS + 1);
    if (sky.night > 0.1) paintStars(c, g, sky.night);
    state.discFace = toHex(disc.isSun ? mixColor([255, 226, 170], sky.low, 0.15) : [232, 228, 208]);
    c.globalAlpha = 0.2;
    dot(c, state.discFace, disc.x, disc.y, g.U * 7.5);
    c.globalAlpha = 1;
    c.fillStyle = toHex(mixColor(mixColor(sky.haze, [58, 70, 100], 0.4), [76, 86, 124], sky.night * 0.8));
    c.beginPath();
    c.moveTo(0, g.H * SHORE);
    for (let x = 0; x <= g.W + 2; x += 2) c.lineTo(x, state.farRidge[x]);
    c.lineTo(g.W, g.H * SHORE);
    c.fill();
  }

  function paintWaterBase(g, sky) {
    const c = state.water.getContext('2d');
    const deep = [48, 78, 108];
    const near = mixColor(mixColor(sky.top, deep, 0.6), [44, 60, 98], sky.night * 0.85);
    const far = mixColor(mixColor(sky.low, deep, 0.45), [62, 74, 114], sky.night * 0.85);
    const h = state.water.height;
    for (let i = 0; i < WATER_BANDS; i++) box(c, toHex(mixColor(far, near, i / (WATER_BANDS - 1))), 0, (h * i) / WATER_BANDS, g.W, h / WATER_BANDS + 1);
    const glint = mixColor(mixColor(sky.low, sky.amb, 0.5), [250, 244, 220], 0.25);
    state.tints = { ripple: mixColor(far, glint, 0.34), dark: mixColor(near, [20, 28, 48], 0.26), mid: mixColor(far, near, 0.5) };
  }

  // What the water reflects: backdrop, one still pass of cloud, the village and its lit windows.
  function paintMirrorSource(g) {
    const c = state.mirror.getContext('2d');
    c.drawImage(state.backdrop, 0, 0);
    c.drawImage(state.cloudTint, 0, g.H * 0.02);
    c.drawImage(state.villageTint, 0, 0);
    wash(state.mirror, state.tints.mid, MIRROR_WASH);
  }

  // Boats get a paler moonlight and a small additive lift, so hull, strakes and rail
  // stay apart from the dark water instead of sinking into one brown mass.
  function retintBoats(sky, amb) {
    const boatAmb = mixColor(amb, [208, 214, 240], sky.night * 0.6);
    const lift = sky.night > 0.05 ? mixColor([0, 0, 0], [30, 30, 36], sky.night) : null;
    for (const boat of state.boats) {
      tintInto(boat.tinted, boat.base, boatAmb, lift);
      addGlow(boat.tinted, boat.hasGlow ? boat.glow : null, sky.night);
      if (!boat.mirrored) continue;
      tintInto(boat.mirrorTint, boat.base, amb);
      wash(boat.mirrorTint, state.tints.mid, MIRROR_WASH);
      addGlow(boat.mirrorTint, boat.hasGlow ? boat.glow : null, sky.night);
    }
  }

  function retintShore(sky, amb) {
    tintInto(state.villageTint, state.village, amb);
    addGlow(state.villageTint, state.villageGlow, sky.night);
    tintInto(state.jetty.tint, state.jetty.base, amb);
    addGlow(state.jetty.tint, state.jetty.glow, sky.night);
    tintInto(state.jettyMirror.tint, state.jettyMirror.base, amb);
    wash(state.jettyMirror.tint, state.tints.mid, MIRROR_WASH);
  }

  function retintRipples() {
    tintInto(state.lightTint, state.lightMask, state.tints.ripple);
    tintInto(state.darkTint, state.darkMask, state.tints.dark);
    const c = state.ripples.getContext('2d');
    c.clearRect(0, 0, state.ripples.width, state.ripples.height);
    c.drawImage(state.darkTint, 0, 0);
    c.drawImage(state.lightTint, 0, 0);
  }

  function retint(g, choice) {
    const sky = S.at(S.hour(choice));
    const amb = mixColor(mixColor(sky.amb, [255, 255, 255], 0.2), [196, 206, 240], sky.night * 0.85);
    state.sky = sky;
    state.disc = discInfo(g, sky);
    paintBackdrop(g, sky, state.disc);
    paintWaterBase(g, sky);
    retintShore(sky, amb);
    retintBoats(sky, amb);
    tintInto(state.cloudTint, state.cloudMask, mixColor(mixColor(sky.amb, sky.low, 0.42), [136, 142, 180], sky.night * 0.8));
    paintMirrorSource(g);
    retintRipples();
    state.rope = toHex(mixColor([46, 40, 36], amb, 0.25));
    state.foam = toHex(mixColor(mixColor([236, 232, 214], amb, 0.3), state.tints.mid, 0.35));
    state.gullLight = toHex(mixColor([246, 243, 232], amb, 0.28));
    state.gullWing = toHex(mixColor([196, 200, 206], amb, 0.3));
    state.gullTip = toHex(mixColor([40, 40, 48], amb, 0.3));
    state.flag = toHex(mixColor([194, 66, 44], amb, 0.3));
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  /* ---------- per frame ---------- */

  function drawUpper(ctx, g, t) {
    const shore = g.H * SHORE;
    ctx.drawImage(state.backdrop, 0, 0, g.W, shore, 0, 0, g.W, shore);
    const w = state.cloudTint.width;
    const x = -Math.round((t * g.U * 1.1) % w);
    const y = Math.round(g.H * 0.02);
    ctx.drawImage(state.cloudTint, x, y);
    if (x + w < g.W) ctx.drawImage(state.cloudTint, x + w, y);
    ctx.fillStyle = state.discFace;
    ctx.beginPath();
    ctx.arc(state.disc.x, state.disc.y, g.U * 4.4, 0, 6.3);
    ctx.fill();
    ctx.drawImage(state.villageTint, 0, 0);
  }

  // Nearest-pixel strips: the reflection fades by thinning, not by mixing colours.
  function drawBackMirror(ctx, g, t) {
    const shore = Math.floor(g.H * SHORE);
    const dst = Math.max(2, Math.round((g.H * 0.27) / BACK_STRIPS));
    const src = dst * 0.7;
    for (let i = 0; i < BACK_STRIPS; i++) {
      const f = i / BACK_STRIPS;
      const wob = Math.round(Math.sin(t * 0.7 + i * 1.3) * g.U * (0.2 + f * 1.8));
      const h = Math.max(1, Math.round(dst * (1 - f * 0.72)));
      ctx.drawImage(state.mirror, 0, shore - (i + 1) * src, g.W, src, wob, shore + i * dst, g.W, h);
    }
  }

  function moveBoat(boat, t, swell) {
    const s = boat.spec;
    boat.angle = s.rock * swell * (Math.sin(t * s.w + boat.phase) + 0.35 * Math.sin(t * s.w * 2.3 + boat.phase2));
    boat.lift = s.bob * state.g.U * swell * Math.sin(t * s.w * 0.8 + boat.phase2);
  }

  // Strips straight from the unrotated sprite: the rock shows as a lean that grows with
  // height above the water, the bob by sampling a little higher or lower.
  function drawBoatMirror(ctx, g, boat, t) {
    const dst = boat.stripH;
    const src = dst * 0.78;
    const left = boat.cx - boat.ax;
    const top = Math.round(boat.wl);
    const foot = boat.ay - boat.lift;
    for (let i = 0; i < BOAT_STRIPS; i++) {
      const y = top + i * dst;
      const sy = foot - (i + 1) * src;
      if (y >= g.H || sy < 0) break;
      const f = i / BOAT_STRIPS;
      const wob = Math.sin(t * 1.05 + i * 1.7 + boat.phase) * boat.k * (0.25 + f * 2.4);
      const lean = boat.angle * (i + 0.5) * src;
      const thin = 1 - f * (0.45 + 0.35 * Math.sin(t * 0.9 + i * 2.4));
      ctx.drawImage(boat.mirrorTint, 0, sy, boat.w, src, Math.round(left + wob + lean), y, boat.w, Math.max(1, Math.round(dst * thin)));
    }
  }

  // One tiling band of the ripple layer, cut so each pixel is filled once.
  function drawRippleBand(ctx, g, y0, h, offset) {
    const src = state.ripples;
    const w = src.width;
    const o = ((offset % w) + w) % w;
    const first = Math.min(w - o, g.W);
    const top = Math.floor(g.H * SHORE);
    ctx.drawImage(src, o, y0, first, h, 0, top + y0, first, h);
    if (first < g.W) ctx.drawImage(src, 0, y0, g.W - first, h, first, top + y0, g.W - first, h);
  }

  // The far water drifts slowly and the near water faster, which reads as depth.
  function drawRipples(ctx, g, t) {
    const h = state.ripples.height;
    const split = Math.round(h * RIPPLE_SPLIT);
    drawRippleBand(ctx, g, 0, split, Math.round(t * g.U * 0.4));
    drawRippleBand(ctx, g, split, h - split, Math.round(t * g.U * 0.85));
  }

  // After dark, each lamp lays a broken column of gold down the water.
  function drawColumns(ctx, g, t, night) {
    ctx.fillStyle = GOLD;
    for (let i = 0; i < state.columns.length; i++) {
      const c = state.columns[i];
      for (let k = 0; k < 11; k++) {
        const f = k / 11;
        const wob = Math.sin(t * 1.1 + k * 1.5 + c.x) * g.U * (0.2 + f * 1.2);
        const w = c.w * (1.1 + 0.6 * Math.sin(t * 0.9 + k * 2.1 + c.x));
        ctx.globalAlpha = night * 0.62 * (1 - f);
        ctx.fillRect(c.x + wob - w / 2, c.y + f * c.reach, w, Math.max(1, g.U * 0.7));
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawPennant(ctx, g, boat, t) {
    const x = boat.spec.dir * -4 * boat.k;
    const y = -61 * boat.k;
    const u = g.U * (boat.spec.hero ? 1 : 0.7);
    ctx.fillStyle = state.flag;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 1; i <= 4; i++) ctx.lineTo(x - i * u * 1.7, y + Math.sin(t * 2.1 - i * 0.9) * u * 0.16 * i + i * u * 0.3);
    for (let i = 3; i >= 0; i--) ctx.lineTo(x - i * u * 1.7, y + Math.sin(t * 2.1 - i * 0.9) * u * 0.16 * i + u * (2.1 - i * 0.26));
    ctx.fill();
  }

  // No clip: the sprite is already cut at its waterline. A still post is not rotated at all.
  function drawSprite(ctx, g, boat, t) {
    if (!boat.spec.rock) {
      ctx.drawImage(boat.tinted, Math.round(boat.cx - boat.ax), Math.round(boat.wl - boat.ay));
      return;
    }
    const c = Math.cos(boat.angle);
    const s = Math.sin(boat.angle);
    ctx.setTransform(c, s, -s, c, boat.cx, boat.wl + boat.lift);
    ctx.drawImage(boat.tinted, -boat.ax, -boat.ay);
    if (boat.hasGlow && boat.spec.len > 40) drawPennant(ctx, g, boat, t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawBoat(ctx, g, boat, t) {
    drawSprite(ctx, g, boat, t);
    const half = boat.spec.kind === 'post' ? boat.k * 6 : boat.k * 38;
    const h = Math.max(1, g.U * 0.4);
    ctx.fillStyle = state.foam;
    for (let i = 0; i < 3; i++) {
      const c = boat.cx + half * (i - 1) * 0.72 + Math.sin(t * 0.5 + boat.phase + i * 2) * g.U * 2;
      const w = half * (0.2 + 0.12 * Math.sin(t * 0.7 + boat.phase2 + i * 3));
      ctx.fillRect(c - w, boat.wl, w * 2, h);
    }
  }

  function traceRope(ctx, g, boat, end, tx, ty) {
    const lx = end.x * boat.spec.dir * boat.k;
    const ly = end.y * boat.k;
    const c = Math.cos(boat.angle);
    const s = Math.sin(boat.angle);
    const px = boat.cx + lx * c - ly * s;
    const py = boat.wl + boat.lift + lx * s + ly * c;
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo((px + tx) / 2, Math.max(py, ty) + g.U * 3.5, tx, ty);
  }

  function drawRopes(ctx, g) {
    const m = state.moor;
    const px = m.post.cx;
    const py = m.post.wl - 13 * m.post.k;
    ctx.strokeStyle = state.rope;
    ctx.lineWidth = Math.max(1, g.U * 0.32);
    ctx.beginPath();
    traceRope(ctx, g, m.hero, m.hero.ends.bow, px, py);
    traceRope(ctx, g, m.second, m.second.ends.stern, px, py);
    traceRope(ctx, g, m.second, m.second.ends.bow, g.W + g.U * 2, m.jettyY);
    traceRope(ctx, g, m.sampan, m.sampan.ends.bow, px, py);
    ctx.stroke();
  }

  function drawWing(ctx, x, y, s, side, pinch, beat, lift) {
    const wx = x + side * s * 0.5 * pinch;
    const wy = y - s * (0.2 + beat * 0.2 + lift);
    const tx = x + side * s * pinch;
    const ty = y - s * (0.02 + beat * 0.55 + lift * 2);
    ctx.fillStyle = state.gullWing;
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.04);
    ctx.quadraticCurveTo(x + side * s * 0.26 * pinch, y - s * (0.2 + beat * 0.12), wx, wy);
    ctx.lineTo(tx, ty);
    ctx.quadraticCurveTo(lerp(x, wx, 0.8), wy + s * 0.3, x, y + s * 0.12);
    ctx.fill();
    ctx.fillStyle = state.gullTip;
    ctx.beginPath();
    ctx.moveTo(lerp(wx, tx, 0.56), lerp(wy, ty, 0.56));
    ctx.lineTo(tx, ty);
    ctx.lineTo(lerp(wx, tx, 0.56), lerp(wy, ty, 0.56) + s * 0.08);
    ctx.fill();
  }

  function drawGull(ctx, gull, t) {
    const a = t * gull.w + gull.phase;
    const x = gull.cx + Math.cos(a) * gull.rx;
    const y = gull.cy + Math.sin(a) * gull.ry;
    const facing = -Math.sin(a) * gull.w > 0 ? 1 : -1;
    const s = gull.span;
    const pinch = 1 - Math.abs(Math.sin(a)) * 0.34;
    const tilt = Math.cos(a) * 0.1;
    const beat = Math.sin(t * gull.flap + gull.phase) * (0.5 + 0.5 * Math.sin(t * 0.21 + gull.phase));
    drawWing(ctx, x, y, s, -1, pinch, beat, -facing * tilt);
    drawWing(ctx, x, y, s, 1, pinch, beat, facing * tilt);
    ctx.fillStyle = state.gullLight;
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.03, s * 0.32, s * 0.1, 0, 0, 6.3);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + facing * s * 0.32, y - s * 0.015, s * 0.09, 0, 6.3);
    ctx.fill();
  }

  /* ---------- run ---------- */

  function buildMoorings(g, lamps, toro) {
    const find = (test) => state.boats.find(test);
    state.columns = lamps.slice(0, 9).map((l) => ({ x: l.x, w: l.w, y: g.H * SHORE, reach: g.U * 26 }));
    state.columns.push({ x: toro.x, w: toro.w, y: jettyAt(g, toro.x).water, reach: g.U * 22 });
    state.moor = {
      hero: find((b) => b.spec.hero),
      second: find((b) => b.spec.look === 'indigo'),
      post: find((b) => b.spec.kind === 'post'),
      sampan: find((b) => b.spec.kind === 'sampan'),
      jettyY: jettyAt(g, g.W).water - g.U * 2,
    };
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const rand = K.rng(api.seed);
    state.g = g;
    state.farRidge = new Float32Array(Math.ceil(g.W) + 4);
    for (let x = 0; x < state.farRidge.length; x++) state.farRidge[x] = g.H * (0.5 - fbm((x / g.U) * 0.022, 2, 3, 23) * 0.42);
    state.backdrop = layer(g.W, g.H);
    state.mirror = layer(g.W, g.H);
    state.cloudMask = paintCloudMask(g, Math.ceil(g.W * 1.5), Math.ceil(g.H * 0.3));
    state.cloudTint = layer(state.cloudMask.width, state.cloudMask.height);
    const lamps = buildVillage(g, rand);
    const toro = buildJetty(g, rand);
    buildWater(g);
    const wide = g.W / g.U > 190;
    state.boats = FLEET.filter((spec) => wide || !spec.wide).map((spec) => buildBoat(g, spec, rand));
    state.jettyIndex = state.boats.findIndex((b) => b.spec.wl > 0.6);
    buildGulls(g, rand);
    buildMoorings(g, lamps, toro);
    retint(g, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) retint(g, props.time);
    const night = state.sky.night;
    const boats = state.boats;
    drawUpper(ctx, g, t);
    ctx.drawImage(state.water, 0, Math.floor(g.H * SHORE));
    ctx.imageSmoothingEnabled = false;
    drawBackMirror(ctx, g, t);
    ctx.drawImage(state.jettyMirror.tint, state.jettyMirror.x, state.jettyMirror.y);
    for (let i = 0; i < boats.length; i++) {
      moveBoat(boats[i], t, props.swell);
      if (boats[i].mirrored) drawBoatMirror(ctx, g, boats[i], t);
    }
    drawRipples(ctx, g, t);
    if (night > 0.05) drawColumns(ctx, g, t, night);
    for (let i = 0; i < boats.length; i++) {
      if (i === state.jettyIndex) ctx.drawImage(state.jetty.tint, state.jetty.x, state.jetty.y);
      drawBoat(ctx, g, boats[i], t);
    }
    ctx.imageSmoothingEnabled = true;
    drawRopes(ctx, g);
    const n = Math.min(MAX_GULLS, Math.round(props.gulls * 6));
    for (let i = n - 1; i >= 0; i--) drawGull(ctx, state.gulls[i], t);
  }

  Kasuri.run({
    defaults: { time: 'auto', swell: 1, gulls: 1, ramp: 'lines', cell: 7, boost: 0.28, gain: 1.14, dither: 0.3 },
    maxFps: 24,
    setup,
    draw,
  });
})();
