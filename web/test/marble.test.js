const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../../Wallpapers/sumi/marble.js');

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test('circle returns n points at the right radius', () => {
  const pts = M.circle(10, 20, 5, 16);
  assert.equal(pts.length, 16);
  for (const p of pts) assert.ok(near(Math.hypot(p.x - 10, p.y - 20), 5));
});

test('drop pushes a point out so the new ink area fits inside', () => {
  const [p] = M.drop([{ x: 3, y: 0 }], 0, 0, 4);
  assert.ok(near(Math.hypot(p.x, p.y), 5));
  assert.ok(near(Math.atan2(p.y, p.x), 0));
});

test('drop leaves the original points untouched', () => {
  const before = [{ x: 1, y: 1 }];
  const after = M.drop(before, 0, 0, 2);
  assert.deepEqual(before, [{ x: 1, y: 1 }]);
  assert.notEqual(after[0], before[0]);
});

test('drop conserves ring area (the marbling invariant)', () => {
  const ring = M.circle(0, 0, 3, 720);
  const pushed = M.drop(ring, 1, 0.5, 2);
  const area = (pts) =>
    Math.abs(pts.reduce((s, p, i) => {
      const q = pts[(i + 1) % pts.length];
      return s + p.x * q.y - q.x * p.y;
    }, 0)) / 2;
  assert.ok(Math.abs(area(pushed) - (area(ring) + Math.PI * 4)) < 0.05);
});

test('drop at the exact centre of a point does not explode', () => {
  const [p] = M.drop([{ x: 0, y: 0 }], 0, 0, 2);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
});

test('comb drags nearby points along the stroke and leaves far ones', () => {
  const [close, far] = M.comb([{ x: 0, y: 0 }, { x: 0, y: 100 }], 0, 0, 2, 0, 3);
  assert.ok(close.x > 1);
  assert.ok(far.x < 0.2);
  assert.equal(close.y, 0);
});

test('refine inserts points into long edges only', () => {
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 1 }];
  const out = M.refine(pts, 2, 100);
  assert.ok(out.length > pts.length);
  for (let i = 0; i < out.length; i++) {
    const a = out[i];
    const b = out[(i + 1) % out.length];
    assert.ok(Math.hypot(b.x - a.x, b.y - a.y) <= 2 + 1e-9);
  }
});

test('refine respects the point budget', () => {
  const pts = M.circle(0, 0, 100, 8);
  assert.ok(M.refine(pts, 0.5, 50).length <= 50);
});

test('contains finds points inside a polygon', () => {
  const square = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }];
  assert.equal(M.contains(square, 2, 2), true);
  assert.equal(M.contains(square, 5, 2), false);
});
