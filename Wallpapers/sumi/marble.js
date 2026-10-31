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

  const api = Object.freeze({ circle, drop, comb, refine, contains });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Marble = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
