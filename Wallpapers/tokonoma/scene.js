/*
 * 床の間 Tokonoma — the alcove of a tatami room.
 *
 * A hanging scroll of misty mountains, camellias in a bronze vase and a small
 * incense burner sit in front of plaster and a natural-wood post. Window light
 * falls through a shoji screen onto the tatami and crosses it with the clock.
 * Room, scroll and light are baked and retinted once a minute; between those
 * only the scroll sway, bamboo shadow, smoke, dust and one petal move.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const S = KasuriSky;
  const { fbm, lerp, mixColor, toHex, parseColor, smoothstep, clamp } = K;

  const RETINT_SECONDS = 60;
  const MAX_PUFFS = 10;
  const MOTES = 14;
  const state = {};

  const hex = (rgb) => toHex(rgb);
  const rgb = (h) => parseColor(h);

  function layer(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // All positions come from the screen size once, so every painter agrees.
  function layout(g) {
    const W = g.W;
    const H = g.H;
    const aw = Math.min(0.54 * W, 0.95 * H);
    const ax = W / 2 - aw / 2;
    const sw = Math.round(0.3 * H);
    const sh = Math.round(0.57 * H);
    return {
      ax,
      ar: ax + aw,
      aw,
      top: 0.16 * H,
      floorY: 0.735 * H,
      tatamiY: 0.795 * H,
      scrollX: ax + aw * 0.33,
      scrollY: Math.round(0.165 * H),
      sw,
      sh,
      vaseX: ax + aw * 0.74,
      burnerX: ax + aw * 0.56,
      win: { x: 0.03 * W, y: 0.2 * H, w: 0.13 * W, h: 0.42 * H },
      winBottom: 0.735 * H,
    };
  }

  // ---- room ----------------------------------------------------------------

  function paintWalls(ctx, g, L, rand) {
    const W = g.W;
    const H = g.H;
    const wall = ctx.createLinearGradient(0, 0, 0, H * 0.8);
    wall.addColorStop(0, '#c6ba98');
    wall.addColorStop(1, '#d9cfb1');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#8f8466';
    for (let i = 0; i < W * H * 0.004; i++) {
      ctx.globalAlpha = 0.08 + rand() * 0.12;
      ctx.fillRect(rand() * W, rand() * H * 0.78, 1, 1);
    }
    ctx.globalAlpha = 1;
    // Ceiling boards and the long beam over the room.
    ctx.fillStyle = '#2b2320';
    ctx.fillRect(0, 0, W, H * 0.075);
    ctx.fillStyle = '#43342a';
    ctx.fillRect(0, H * 0.075, W, H * 0.035);
    ctx.fillStyle = '#6a5240';
    ctx.fillRect(0, H * 0.075, W, 1);
    ctx.fillStyle = '#1f1814';
    ctx.fillRect(0, H * 0.11, W, 1);
  }

  function paintAlcove(ctx, g, L, rand) {
    const H = g.H;
    const U = g.U;
    ctx.fillStyle = '#82705a';
    ctx.fillRect(L.ax, L.top, L.aw, L.floorY - L.top);
    ctx.fillStyle = '#6a5a46';
    for (let i = 0; i < L.aw * H * 0.004; i++) {
      ctx.globalAlpha = 0.1 + rand() * 0.15;
      ctx.fillRect(L.ax + rand() * L.aw, L.top + rand() * (L.floorY - L.top), 1, 1);
    }
    ctx.globalAlpha = 1;
    const shade = ctx.createLinearGradient(0, L.top, 0, L.floorY);
    shade.addColorStop(0, 'rgba(20,12,6,0.3)');
    shade.addColorStop(0.5, 'rgba(20,12,6,0.08)');
    shade.addColorStop(1, 'rgba(20,12,6,0.18)');
    ctx.fillStyle = shade;
    ctx.fillRect(L.ax, L.top, L.aw, L.floorY - L.top);
    // The beam above the alcove and its shadow.
    ctx.fillStyle = '#58442f';
    ctx.fillRect(L.ax - U * 2, H * 0.11, L.aw + U * 4, H * 0.05);
    ctx.fillStyle = '#7c6247';
    ctx.fillRect(L.ax - U * 2, H * 0.11, L.aw + U * 4, 1);
    ctx.fillStyle = '#2a1f16';
    ctx.fillRect(L.ax - U * 2, H * 0.16, L.aw + U * 4, 1);
    // Polished floorboard and the black lacquer edge in front of it.
    ctx.fillStyle = '#3b2b22';
    ctx.fillRect(L.ax, L.floorY, L.aw, H * 0.03);
    ctx.fillStyle = '#6a4e3a';
    ctx.fillRect(L.ax, L.floorY + 1, L.aw, 1);
    ctx.fillStyle = '#17151a';
    ctx.fillRect(L.ax - U * 2, L.floorY + H * 0.03, L.aw + U * 4, L.tatamiY - L.floorY - H * 0.03);
    // Natural log post on the left, plain post on the right.
    const pw = Math.max(3, H * 0.045);
    for (let y = Math.floor(H * 0.11); y < L.tatamiY; y++) {
      const off = (fbm(y * 0.05, 3, 2, 7) - 0.5) * U * 1.2;
      const bark = fbm(y * 0.2, 9, 3, 13);
      ctx.fillStyle = hex(mixColor(rgb('#76593c'), rgb('#44301f'), bark));
      ctx.fillRect(L.ax - pw + off, y, pw, 1);
    }
    ctx.fillStyle = '#5a4632';
    ctx.fillRect(L.ar, H * 0.11, Math.max(2, H * 0.025), L.tatamiY - H * 0.11);
  }

  function paintTatami(ctx, g, L) {
    const W = g.W;
    const H = g.H;
    const U = g.U;
    const y0 = L.tatamiY;
    const mid = H * 0.9;
    ctx.fillStyle = '#9a9462';
    ctx.fillRect(0, y0, W, H - y0);
    ctx.fillStyle = '#6e6a42';
    for (let y = Math.ceil(y0); y < H; y += 2) {
      ctx.globalAlpha = 0.16;
      ctx.fillRect(0, y, W, 1);
    }
    ctx.globalAlpha = 1;
    const mat = H * 0.95;
    ctx.fillStyle = '#1e2036';
    ctx.fillRect(0, mid, W, Math.max(1, U * 0.7));
    ctx.fillRect(0, y0, W, Math.max(1, U * 0.5));
    for (let x = W / 2 - mat * 0.5; x < W + mat; x += mat) ctx.fillRect(x, y0, Math.max(1, U * 0.6), mid - y0);
    for (let x = W / 2 - mat * 0.5; x > -mat; x -= mat) ctx.fillRect(x, y0, Math.max(1, U * 0.6), mid - y0);
    for (let x = W / 2; x < W + mat; x += mat) ctx.fillRect(x, mid, Math.max(1, U * 0.6), H - mid);
    for (let x = W / 2; x > -mat; x -= mat) ctx.fillRect(x, mid, Math.max(1, U * 0.6), H - mid);
  }

  // Sliding fusuma panel on the right: lacquer frame, wave scales, gold dust, a handle.
  function paintFusuma(ctx, g, L, rand) {
    const W = g.W;
    const H = g.H;
    const U = g.U;
    const x0 = L.ar + 0.035 * W;
    const x1 = 0.965 * W;
    const y0 = 0.13 * H;
    const y1 = L.tatamiY - H * 0.02;
    ctx.fillStyle = '#1b1a1e';
    ctx.fillRect(x0 - U, y0 - U, x1 - x0 + 2 * U, y1 - y0 + 2 * U);
    ctx.fillStyle = '#e1d6b8';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    const R = Math.max(4, H * 0.04);
    ctx.lineWidth = 1;
    for (let r = 0; r < 9; r++) {
      const cy = H * 0.5 + r * R * 0.5;
      for (let c = -1; c < Math.ceil((x1 - x0) / (2 * R)) + 1; c++) {
        const cx = x0 + c * 2 * R + (r % 2) * R;
        ctx.beginPath();
        ctx.arc(cx, cy, R, Math.PI, 0);
        ctx.lineTo(cx + R, cy + R);
        ctx.lineTo(cx - R, cy + R);
        ctx.closePath();
        ctx.fillStyle = '#e1d6b8';
        ctx.fill();
        ctx.strokeStyle = '#5f7488';
        ctx.globalAlpha = 0.5;
        for (let k = 1; k <= 3; k++) {
          ctx.beginPath();
          ctx.arc(cx, cy, (R * k) / 3, Math.PI, 0);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = '#c9a85a';
    for (let i = 0; i < 70; i++) {
      ctx.globalAlpha = 0.25 + rand() * 0.35;
      ctx.fillRect(x0 + rand() * (x1 - x0), y0 + rand() * H * 0.34, 1 + rand() * 2, 1);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.fillStyle = '#1b1a1e';
    ctx.beginPath();
    ctx.arc(x0 + U * 3, H * 0.5, U * 1.3, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#b89a52';
    ctx.beginPath();
    ctx.arc(x0 + U * 3, H * 0.5, U * 0.8, 0, 6.3);
    ctx.fill();
  }

  // ---- vase and flowers ------------------------------------------------------

  function paintBloom(ctx, x, y, r) {
    ctx.fillStyle = '#a63a2b';
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * 6.283 + 0.4;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.62, 0, 6.3);
      ctx.fill();
    }
    ctx.fillStyle = '#c4503a';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.7, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#d9a73a';
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.7, r * 0.28), 0, 6.3);
    ctx.fill();
  }

  function paintLeaf(ctx, x, y, len, ang) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = '#2f4a34';
    ctx.beginPath();
    ctx.ellipse(len * 0.5, 0, len * 0.5, len * 0.26, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#4c6c48';
    ctx.fillRect(len * 0.1, -0.5, len * 0.7, 1);
    ctx.restore();
  }

  function paintVase(ctx, g, L) {
    const H = g.H;
    const U = g.U;
    const x = L.vaseX;
    const base = L.floorY + 1;
    const vh = H * 0.21;
    const top = base - vh;
    const bw = H * 0.036;
    const sw2 = H * 0.07;
    const nw = H * 0.026;
    // Branches first so the vase hides their stems.
    ctx.strokeStyle = '#3a2a1e';
    ctx.lineWidth = Math.max(1, U * 0.6);
    const stems = [
      [x - U, top, x - H * 0.06, top - H * 0.11, x - H * 0.1, top - H * 0.24],
      [x, top, x + H * 0.02, top - H * 0.14, x + H * 0.02, top - H * 0.27],
      [x + U, top, x + H * 0.07, top - H * 0.1, x + H * 0.11, top - H * 0.2],
      [x, top, x - H * 0.02, top - H * 0.17, x - H * 0.04, top - H * 0.33],
    ];
    for (const s of stems) {
      ctx.beginPath();
      ctx.moveTo(s[0], s[1]);
      ctx.quadraticCurveTo(s[2], s[3], s[4], s[5]);
      ctx.stroke();
    }
    const tips = [stems[0], stems[1], stems[2]];
    for (const s of tips) {
      paintLeaf(ctx, s[4], s[5], H * 0.07, -2.4);
      paintLeaf(ctx, s[4], s[5], H * 0.065, -0.6);
      paintLeaf(ctx, s[2], s[3], H * 0.06, s === stems[0] ? 3.3 : -0.2);
    }
    paintLeaf(ctx, stems[3][4], stems[3][5], H * 0.05, -1.3);
    paintBloom(ctx, stems[0][4], stems[0][5], H * 0.03);
    paintBloom(ctx, stems[1][4], stems[1][5] + H * 0.005, H * 0.034);
    paintBloom(ctx, stems[2][4], stems[2][5], H * 0.028);
    // Bare twig with buds against the leaves.
    ctx.fillStyle = '#d9a73a';
    ctx.fillRect(stems[3][4], stems[3][5] - 1, 2, 2);
    // Bronze body: narrow neck, round shoulder, flat foot.
    const body = ctx.createLinearGradient(x - sw2, 0, x + sw2, 0);
    body.addColorStop(0, '#5a4c34');
    body.addColorStop(0.35, '#a89658');
    body.addColorStop(0.6, '#7a6c44');
    body.addColorStop(1, '#2e281c');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(x - nw, top);
    ctx.lineTo(x - nw * 0.8, top + vh * 0.22);
    ctx.bezierCurveTo(x - sw2 * 1.1, top + vh * 0.3, x - sw2 * 1.05, top + vh * 0.75, x - bw, base);
    ctx.lineTo(x + bw, base);
    ctx.bezierCurveTo(x + sw2 * 1.05, top + vh * 0.75, x + sw2 * 1.1, top + vh * 0.3, x + nw * 0.8, top + vh * 0.22);
    ctx.lineTo(x + nw, top);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4e6e56';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x - sw2 * 0.8, top + vh * 0.55, sw2 * 0.5, 1);
    ctx.fillRect(x + sw2 * 0.1, top + vh * 0.7, sw2 * 0.5, 1);
    ctx.fillRect(x - sw2 * 0.4, top + vh * 0.42, 2, 1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#a89868';
    ctx.fillRect(x - nw, top, nw * 2, 1);
    ctx.strokeStyle = '#8a7a50';
    ctx.lineWidth = 1;
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + sd * sw2 * 1.08, top + vh * 0.38, U * 1.3, 0, 6.3);
      ctx.stroke();
    }
    state.flower = { x: stems[1][4], y: stems[1][5] + H * 0.02 };
  }

  function paintBurner(ctx, g, L) {
    const H = g.H;
    const x = L.burnerX;
    const base = L.floorY;
    const bw = H * 0.026;
    ctx.fillStyle = '#3e3626';
    ctx.fillRect(x - bw * 0.7, base - H * 0.008, bw * 0.4, H * 0.01);
    ctx.fillRect(x + bw * 0.3, base - H * 0.008, bw * 0.4, H * 0.01);
    ctx.fillStyle = '#6d5f3e';
    ctx.beginPath();
    ctx.ellipse(x, base - H * 0.018, bw, H * 0.016, 0, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = '#8a7a50';
    ctx.fillRect(x - bw, base - H * 0.026, bw * 2, 1);
    ctx.fillStyle = '#2c261a';
    ctx.fillRect(x - bw * 0.6, base - H * 0.03, bw * 1.2, 2);
    state.burnerTop = base - H * 0.032;
  }

  // ---- scroll ----------------------------------------------------------------

  function mountainTop(x, w, layerIndex, ph) {
    const u = x / w;
    const baseline = [0.64, 0.8, 0.96][layerIndex] * ph;
    const amp = [0.55, 0.45, 0.22][layerIndex] * ph;
    const peakAt = [0.36, 0.74, 0.3][layerIndex];
    const spread = [0.32, 0.3, 0.55][layerIndex];
    const big = Math.pow(Math.max(0, 1 - Math.abs(u - peakAt) / spread), 1.2);
    const rough = fbm(u * 5, layerIndex * 7, 3, 21 + layerIndex);
    return baseline - amp * (0.75 * big + 0.35 * rough);
  }

  function paintPainting(g, pw, ph) {
    const c = layer(pw, ph);
    const ctx = c.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, ph);
    sky.addColorStop(0, '#d6cbac');
    sky.addColorStop(1, '#ebe2c8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, pw, ph);
    ctx.fillStyle = '#b8412c';
    ctx.beginPath();
    ctx.arc(pw * 0.78, ph * 0.2, Math.max(2, pw * 0.1), 0, 6.3);
    ctx.fill();
    const inks = ['#7a8288', '#4a5158', '#1a1d20'];
    for (let li = 0; li < 3; li++) {
      ctx.fillStyle = inks[li];
      for (let x = 0; x < pw; x++) {
        const top = mountainTop(x, pw, li, ph);
        ctx.fillRect(x, top, 1, ph - top);
      }
      if (li < 2) {
        const base = [0.64, 0.8][li] * ph;
        const mist = ctx.createLinearGradient(0, base - ph * 0.14, 0, base + ph * 0.1);
        mist.addColorStop(0, 'rgba(232,224,200,0)');
        mist.addColorStop(0.55, 'rgba(232,224,200,0.6)');
        mist.addColorStop(1, 'rgba(232,224,200,0)');
        ctx.fillStyle = mist;
        ctx.fillRect(0, base - ph * 0.14, pw, ph * 0.24);
      }
    }
    // Pines on the near ridge.
    ctx.fillStyle = '#0f1214';
    for (let k = 0; k < 4; k++) {
      const px = pw * (0.08 + k * 0.1 + (k % 2) * 0.03);
      const top = mountainTop(px, pw, 2, ph);
      ctx.fillRect(px, top - 3, 1, 3);
      ctx.fillRect(px - 1, top - 3, 3, 1);
      ctx.fillRect(px - 1, top - 2, 3, 1);
    }
    // A single seal in the corner; no lettering.
    const seal = Math.max(2, Math.round(pw * 0.1));
    ctx.fillStyle = '#c0391f';
    ctx.fillRect(pw - seal - 1, ph - seal - 1, seal, seal);
    return c;
  }

  function paintScrollArt(g, L) {
    const sw = L.sw;
    const sh = L.sh;
    const c = layer(sw, sh);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#27345c';
    ctx.fillRect(0, 0, sw, sh);
    ctx.fillStyle = '#c4a65c';
    for (let y = 2; y < sh - 2; y += 3) {
      for (let x = 1 + ((y / 3) % 2); x < sw - 1; x += 3) {
        ctx.globalAlpha = 0.28;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    const px = Math.round(sw * 0.13);
    const pw = sw - px * 2;
    const py = Math.round(sh * 0.22);
    const ph = Math.round(sh * 0.54);
    // Moss green mount, thin gold line, then the painting.
    ctx.fillStyle = '#5a6b44';
    ctx.fillRect(px - 2, py - 2, pw + 4, ph + 4);
    ctx.fillStyle = '#c4a65c';
    ctx.fillRect(px - 1, py - 1, pw + 2, ph + 2);
    ctx.drawImage(paintPainting(g, pw, ph), px, py);
    // Two hanging strips and the rods.
    const strip = Math.max(1, Math.round(sw * 0.04));
    ctx.fillStyle = '#b09a60';
    ctx.fillRect(Math.round(sw * 0.2), 0, strip, Math.round(sh * 0.17));
    ctx.fillRect(Math.round(sw * 0.8), 0, strip, Math.round(sh * 0.17));
    ctx.fillStyle = '#2a1c14';
    ctx.fillRect(0, 0, sw, 2);
    ctx.fillStyle = '#4a3322';
    ctx.fillRect(0, sh - 3, sw, 2);
    ctx.fillStyle = '#d0b070';
    ctx.fillRect(-1, sh - 4, 2, 4);
    ctx.fillRect(sw - 1, sh - 4, 2, 4);
    return c;
  }

  // ---- window ----------------------------------------------------------------

  function paintLatticeArt(g, L) {
    const W = g.W;
    const H = g.H;
    const U = g.U;
    const c = layer(W, H);
    const ctx = c.getContext('2d');
    const w = L.win;
    const bar = Math.max(1, Math.round(U * 0.35));
    const frame = Math.max(2, Math.round(U * 0.9));
    ctx.fillStyle = '#2d2118';
    ctx.fillRect(w.x - frame, w.y - frame, w.w + frame * 2, frame);
    ctx.fillRect(w.x - frame, w.y + w.h, w.w + frame * 2, frame);
    ctx.fillRect(w.x - frame, w.y - frame, frame, w.h + frame * 2);
    ctx.fillRect(w.x + w.w, w.y - frame, frame, w.h + frame * 2);
    for (let k = 1; k < 4; k++) ctx.fillRect(w.x + (w.w * k) / 4 - bar / 2, w.y, bar, w.h);
    for (let k = 1; k < 8; k++) ctx.fillRect(w.x, w.y + (w.h * k) / 8 - bar / 2, w.w, bar);
    // Solid wooden panel below the paper.
    ctx.fillStyle = '#4a3a2c';
    ctx.fillRect(w.x - frame, w.y + w.h + frame, w.w + frame * 2, L.winBottom - w.y - w.h - frame);
    ctx.fillStyle = '#6a5240';
    ctx.fillRect(w.x - frame, w.y + w.h + frame, w.w + frame * 2, 1);
    return c;
  }

  // Shadow of bamboo outside the window, painted onto a sprite the size of the paper.
  function paintBambooArt(L, rand) {
    const w = Math.round(L.win.w);
    const h = Math.round(L.win.h);
    const c = layer(w, h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2c3a33';
    const stalks = [0.28, 0.72];
    for (const sx of stalks) {
      ctx.fillRect(Math.round(sw0(w, sx)), 0, 2, h);
      for (let y = 6; y < h; y += Math.max(8, h * 0.2)) ctx.fillRect(Math.round(sw0(w, sx)) - 1, y, 4, 1);
      for (let k = 0; k < 9; k++) {
        const ly = h * (0.05 + rand() * 0.8);
        const dir = rand() < 0.5 ? -1 : 1;
        for (let n = 0; n < 7; n++) {
          ctx.fillRect(sw0(w, sx) + dir * (2 + n) * 1.2, ly + n * 0.5 * (dir > 0 ? 1 : 1), 2, 1);
        }
      }
    }
    return c;
  }

  function sw0(w, f) {
    return w * f;
  }

  // ---- bake --------------------------------------------------------------------

  function paintRoom(g, L) {
    const rand = K.rng(41);
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    paintWalls(ctx, g, L, rand);
    paintFusuma(ctx, g, L, rand);
    paintAlcove(ctx, g, L, rand);
    paintTatami(ctx, g, L);
    paintBurner(ctx, g, L);
    paintVase(ctx, g, L);
    return c;
  }

  function tintOf(sky) {
    const base = mixColor(rgb('#ffffff'), sky.amb, 0.55);
    return base.map((v) => v * (1 - 0.04 * sky.night));
  }

  // Multiply a sprite by the room tint without touching its transparent parts.
  function tinted(art, tint) {
    const c = layer(art.width, art.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(art, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = hex(tint);
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(art, 0, 0);
    return c;
  }

  function paintFront(g, L, sky, tint) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    ctx.drawImage(state.room, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = hex(tint);
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.globalCompositeOperation = 'source-over';
    // Shoji paper lit from outside.
    const w = L.win;
    const day = mixColor(rgb('#f7f0d9'), sky.amb, 0.25);
    const paper = mixColor(day, rgb('#6c789c'), sky.night * 0.85);
    ctx.fillStyle = hex(paper);
    ctx.fillRect(w.x, w.y, w.w, w.h);
    return c;
  }

  // Hidden lamp light behind the alcove; it breathes a little at night.
  function paintGlow(g, L, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const glow = ctx.createRadialGradient(g.W / 2, g.H * 0.45, 0, g.W / 2, g.H * 0.45, g.H * 0.55);
    glow.addColorStop(0, `rgba(255,190,110,${0.55 * sky.night + 0.1})`);
    glow.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(L.ax - g.H * 0.1, L.top, L.aw + g.H * 0.2, L.tatamiY - L.top);
    return c;
  }

  // Sun patch by day, moon patch by night, crossing the floor with the hour.
  function paintLight(g, L, sky) {
    const c = layer(g.W, g.H);
    const ctx = c.getContext('2d');
    const W = g.W;
    const H = g.H;
    const h = sky.hour;
    const sunA = 0.5 * (1 - sky.night);
    const moonA = 0.3 * sky.night;
    const low = 1 - Math.sin(Math.PI * S.sunT(h));
    const sunC = mixColor(rgb('#fff1cc'), rgb('#ffa860'), low);
    const pw = W * 0.17;
    const lean = W * 0.08;
    const y0 = L.tatamiY + H * 0.02;
    state.patch = { x: 0, w: pw, a: sunA, y: y0 };
    const draw = (t, color, alpha) => {
      if (alpha < 0.01) return;
      const xp = W * (0.06 + 0.34 * t);
      const rgbStr = `${Math.round(color[0])},${Math.round(color[1])},${Math.round(color[2])}`;
      const beam = ctx.createLinearGradient(L.win.x + L.win.w, 0, xp, 0);
      beam.addColorStop(0, `rgba(${rgbStr},${alpha * 0.22})`);
      beam.addColorStop(1, `rgba(${rgbStr},${alpha * 0.05})`);
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(L.win.x + L.win.w, L.win.y + L.win.h * 0.1);
      ctx.lineTo(L.win.x + L.win.w, L.win.y + L.win.h);
      ctx.lineTo(xp + pw * 0.2, y0);
      ctx.lineTo(xp + pw, y0);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(xp, y0);
      ctx.lineTo(xp + pw, y0);
      ctx.lineTo(xp + pw + lean, H);
      ctx.lineTo(xp + lean * 0.9, H);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = `rgba(${rgbStr},${alpha})`;
      ctx.fillRect(xp, y0, pw + lean + 2, H - y0);
      ctx.fillStyle = 'rgba(46,30,16,0.38)';
      for (let k = 1; k < 4; k++) {
        const fx = xp + (pw * k) / 4;
        ctx.beginPath();
        ctx.moveTo(fx, y0);
        ctx.lineTo(fx + lean, H);
        ctx.lineTo(fx + lean + 1, H);
        ctx.lineTo(fx + 1, y0);
        ctx.fill();
      }
      for (let k = 1; k < 4; k++) ctx.fillRect(xp, y0 + ((H - y0) * k) / 4, pw + lean, 1);
      ctx.restore();
      return xp;
    };
    const xs = draw(S.sunT(h), sunC, sunA);
    draw(S.moonT(h), rgb('#a9b8dc'), moonA);
    state.patch.x = xs === undefined ? W * 0.2 : xs;
    state.moteColor = hex(mixColor(sunC, rgb('#ffffff'), 0.4));
    return c;
  }

  function repaint(g, L, choice) {
    const sky = S.at(S.hour(choice));
    const tint = tintOf(sky);
    state.front = paintFront(g, L, sky, tint);
    state.scroll = tinted(state.scrollArt, tint);
    state.lattice = tinted(state.latticeArt, tint);
    state.light = paintLight(g, L, sky);
    state.glow = paintGlow(g, L, sky);
    state.day = 1 - sky.night;
    state.bambooA = 0.34 * (1 - sky.night) + 0.2 * sky.night;
    state.choice = choice;
    state.retintIn = RETINT_SECONDS;
  }

  function paintPuff() {
    const c = layer(32, 32);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(238,234,220,0.6)');
    grad.addColorStop(1, 'rgba(238,234,220,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    return c;
  }

  // ---- motion --------------------------------------------------------------------

  function drawBamboo(ctx, g, L, t) {
    const w = L.win;
    const art = state.bamboo;
    ctx.save();
    ctx.beginPath();
    ctx.rect(w.x, w.y, w.w, w.h);
    ctx.clip();
    ctx.globalAlpha = state.bambooA;
    for (let s = 0; s < art.height; s++) {
      const k = s / art.height;
      const wave = Math.sin(t * 1.3 + k * 3) * g.U * 1.4 * (0.3 + k);
      ctx.drawImage(art, 0, s, art.width, 1, w.x + wave, w.y + s, art.width, 1);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawScroll(ctx, g, L, t) {
    const art = state.scroll;
    const x0 = L.scrollX - art.width / 2;
    for (let s = 0; s < art.height; s++) {
      const k = s / art.height;
      const sway = Math.sin(t * 0.8 + 0.4) * g.U * 1.8 * k * k;
      ctx.drawImage(art, 0, s, art.width, 1, x0 + sway, L.scrollY + s, art.width, 1);
    }
  }

  function drawLight(ctx, g, L, t, amount) {
    if (amount <= 0) return;
    ctx.globalAlpha = Math.min(1, amount * (0.82 + 0.18 * Math.sin(t * 0.35) + 0.06 * Math.sin(t * 0.11)));
    ctx.drawImage(state.light, 0, 0);
    ctx.globalAlpha = 1;
    if (state.patch.a < 0.1) return;
    const p = state.patch;
    const sx = L.win.x + L.win.w;
    ctx.fillStyle = state.moteColor;
    for (let i = 0; i < MOTES; i++) {
      const m = state.motes[i];
      const u = (t * 0.012 + m.u) % 1;
      const x = lerp(sx, p.x + p.w * m.v, u) + Math.sin(t * 0.5 + m.ph) * g.U * 0.8;
      const y = lerp(L.win.y + L.win.h * m.v, p.y, u) + Math.cos(t * 0.4 + m.ph) * g.U * 0.6;
      ctx.globalAlpha = Math.sin(u * Math.PI) * 0.7 * Math.min(1, amount);
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawSmoke(ctx, g, t, amount) {
    if (amount <= 0) return;
    const bx = state.L.burnerX;
    const by = state.burnerTop;
    for (let i = 0; i < MAX_PUFFS; i++) {
      const a = (t * 0.07 + i / MAX_PUFFS) % 1;
      const size = g.U * (2 + a * 8);
      const x = bx + Math.sin(t * 0.7 + a * 5 + i) * g.U * (0.6 + a * 4);
      const y = by - a * g.H * 0.3;
      ctx.globalAlpha = Math.min(1, Math.sin(a * Math.PI) * 0.8 * amount);
      ctx.drawImage(state.puff, x - size / 2, y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  // A camellia petal lets go, drifts down and rests on the board.
  function drawPetal(ctx, g, L, t) {
    const p = (t % 26) / 15;
    const f = state.flower;
    const restY = L.floorY - 1;
    if (p >= 1) {
      const y = restY;
      ctx.fillStyle = '#b8412c';
      ctx.fillRect(f.x + g.U * 2.5, y, 2, 1);
      return;
    }
    const x = f.x + Math.sin(p * 9) * g.U * 1.2 + p * g.U * 2.5;
    const y = lerp(f.y, restY, p);
    ctx.fillStyle = '#b8412c';
    ctx.fillRect(x, y, 2, 1);
  }

  function setup(ctx, api) {
    const g = { W: api.cols, H: api.rows, U: api.rows / 100 };
    const L = layout(g);
    state.g = g;
    state.L = L;
    state.room = paintRoom(g, L);
    state.scrollArt = paintScrollArt(g, L);
    state.latticeArt = paintLatticeArt(g, L);
    state.bamboo = paintBambooArt(L, K.rng(77));
    state.puff = paintPuff();
    const rand = K.rng(5);
    state.motes = [];
    for (let i = 0; i < MOTES; i++) state.motes.push({ u: i / MOTES, v: rand(), ph: rand() * 6.3 });
    state.patch = { x: 0, w: 0, y: 0, a: 0 };
    repaint(g, L, api.props.time);
  }

  function draw(ctx, t, dt, api) {
    const g = state.g;
    const L = state.L;
    const props = api.props;
    state.retintIn -= dt;
    if (state.retintIn <= 0 || state.choice !== props.time) repaint(g, L, props.time);
    ctx.drawImage(state.front, 0, 0);
    ctx.globalAlpha = 0.82 + 0.18 * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1);
    ctx.drawImage(state.glow, 0, 0);
    ctx.globalAlpha = 1;
    drawBamboo(ctx, g, L, t);
    ctx.drawImage(state.lattice, 0, 0);
    drawScroll(ctx, g, L, t);
    drawLight(ctx, g, L, t, props.light);
    drawSmoke(ctx, g, t, props.smoke);
    drawPetal(ctx, g, L, t);
  }

  Kasuri.run({
    defaults: { time: 'auto', light: 1, smoke: 1, ramp: 'lines', cell: 7, boost: 0.12, gain: 1, dither: 0.3 },
    maxFps: 20,
    setup,
    draw,
  });
})();
