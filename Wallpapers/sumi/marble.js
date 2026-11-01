/*
 * marble — the geometry of floating ink.
 *
 * A drop of ink of radius r landing at c pushes every existing point p out
 * along its ray so the area between them is conserved:
 *   p' = c + (p - c) · sqrt(1 + r² / |p - c|²)
 * (after Aubrey Jaffer's mathematical marbling). Every function returns new
 * points and leaves its input alone.
 */
(function (root) {
  'use strict';

  function circle(cx, cy, r, n) {
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    });
  }

  function drop(points, cx, cy, r) {
    const r2 = r * r;
    return points.map((p) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < 1e-12) return { x: cx + r, y: cy };
      const k = Math.sqrt(1 + r2 / d2);
      return { x: cx + dx * k, y: cy + dy * k };
    });
  }

  // A stroke from (x, y) moving by (dx, dy) drags points with it; the pull
  // falls off with distance, `reach` sets how wide the tine is.
  function comb(points, x, y, dx, dy, reach) {
    return points.map((p) => {
      const d = Math.hypot(p.x - x, p.y - y);
      const pull = Math.exp(-(d * d) / (2 * reach * reach));
      return { x: p.x + dx * pull, y: p.y + dy * pull };
    });
  }

  // Splits edges longer than `maxEdge` until they fit or the budget runs out.
  function refine(points, maxEdge, budget) {
    const out = [];
    const n = points.length;
    let spare = Math.max(0, budget - n);
    for (let i = 0; i < n; i++) {
      const a = points[i];
      const b = points[(i + 1) % n];
      out.push(a);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const cuts = Math.min(spare, Math.ceil(len / maxEdge) - 1);
      for (let k = 1; k <= cuts; k++) {
        const t = k / (cuts + 1);
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
      spare -= Math.max(0, cuts);
    }
    return out;
  }

  function contains(points, x, y) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i];
      const b = points[j];
      if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  // ---- in-place twins ----------------------------------------------------
  // The live scene keeps ring points in Float32Arrays and edits them where
  // they lie: thousands of points, 20+ times a second, would otherwise churn
  // the garbage collector and stutter. Each mirrors a pure function above,
  // and the tests hold them to the same answers.

  function dropInPlace(xs, ys, n, cx, cy, r) {
    const r2 = r * r;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - cx;
      const dy = ys[i] - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < 1e-12) {
        xs[i] = cx + r;
        ys[i] = cy;
        continue;
      }
      const k = Math.sqrt(1 + r2 / d2);
      xs[i] = cx + dx * k;
      ys[i] = cy + dy * k;
    }
  }

  function combInPlace(xs, ys, n, x, y, dx, dy, reach) {
    const inv = 1 / (2 * reach * reach);
    for (let i = 0; i < n; i++) {
      const ox = xs[i] - x;
      const oy = ys[i] - y;
      const pull = Math.exp(-(ox * ox + oy * oy) * inv);
      xs[i] += dx * pull;
      ys[i] += dy * pull;
    }
  }

  function refineTyped(xs, ys, n, maxEdge, budget) {
    let total = n;
    let spare = Math.max(0, budget - n);
    const cuts = new Int32Array(n);
    for (let i = 0; i < n && spare > 0; i++) {
      const j = (i + 1) % n;
      const len = Math.hypot(xs[j] - xs[i], ys[j] - ys[i]);
      const c = Math.min(spare, Math.max(0, Math.ceil(len / maxEdge) - 1));
      cuts[i] = c;
      spare -= c;
      total += c;
    }
    if (total === n) return { xs, ys, n };
    const ox = new Float32Array(total);
    const oy = new Float32Array(total);
    let k = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      ox[k] = xs[i];
      oy[k++] = ys[i];
      for (let c = 1; c <= cuts[i]; c++) {
        const t = c / (cuts[i] + 1);
        ox[k] = xs[i] + (xs[j] - xs[i]) * t;
        oy[k++] = ys[i] + (ys[j] - ys[i]) * t;
      }
    }
    return { xs: ox, ys: oy, n: total };
  }

  function containsTyped(xs, ys, n, x, y) {
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      if (ys[i] > y !== ys[j] > y && x < ((xs[j] - xs[i]) * (y - ys[i])) / (ys[j] - ys[i]) + xs[i]) inside = !inside;
    }
    return inside;
  }

  const api = Object.freeze({
    circle, drop, comb, refine, contains,
    dropInPlace, combInPlace, refineTyped, containsTyped,
  });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Marble = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
