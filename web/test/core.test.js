const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../../Wallpapers/_lib/kasuri-core.js');

test('gridSize covers the viewport with whole cells', () => {
  assert.deepEqual(K.gridSize(1512, 982, 10), { cols: 152, rows: 99, cell: 10 });
  assert.deepEqual(K.gridSize(100, 100, 25), { cols: 4, rows: 4, cell: 25 });
});

test('gridSize clamps silly cell sizes', () => {
  assert.equal(K.gridSize(100, 100, 0).cell, K.MIN_CELL);
  assert.equal(K.gridSize(100, 100, -4).cell, K.MIN_CELL);
  assert.equal(K.gridSize(100, 100, 999).cell, K.MAX_CELL);
  assert.equal(K.gridSize(100, 100, NaN).cell, K.MIN_CELL);
});

test('rampIndex maps luminance to the ends of the ramp', () => {
  assert.equal(K.rampIndex(0, 10), 0);
  assert.equal(K.rampIndex(1, 10), 9);
  assert.equal(K.rampIndex(0.5, 10), 5);
  assert.equal(K.rampIndex(-3, 10), 0);
  assert.equal(K.rampIndex(7, 10), 9);
});

test('every ramp starts with a blank cell', () => {
  for (const [name, ramp] of Object.entries(K.RAMPS)) {
    assert.equal([...ramp][0], ' ', `${name} should start blank`);
    assert.ok([...ramp].length >= 4, `${name} is too short`);
  }
});

test('ramp lift names real ramps and fits the shader', () => {
  assert.ok(K.RAMP_LIFT.dense > 0, 'dense should lift its wash');
  assert.equal(K.RAMP_LIFT.lines, undefined, 'lines fills the cell and needs no lift');
  for (const [name, lift] of Object.entries(K.RAMP_LIFT)) {
    assert.ok(name in K.RAMPS, `${name} is not a ramp`);
    assert.ok(lift > 0 && lift <= 1, `${name} lift out of range`);
    assert.ok([...K.RAMPS[name]].length <= 96, `${name} has more glyphs than uCov holds`);
  }
});

test('parseColor reads long and short hex', () => {
  assert.deepEqual(K.parseColor('#d1432f'), [209, 67, 47]);
  assert.deepEqual(K.parseColor('#fff'), [255, 255, 255]);
  assert.deepEqual(K.parseColor('0b0b0a'), [11, 11, 10]);
});

test('parseColor falls back to black on junk', () => {
  assert.deepEqual(K.parseColor('tomato'), [0, 0, 0]);
  assert.deepEqual(K.parseColor(undefined), [0, 0, 0]);
});

test('toHex round-trips parseColor', () => {
  assert.equal(K.toHex([209, 67, 47]), '#d1432f');
  assert.equal(K.toHex([300, -2, 15.6]), '#ff0010');
});

test('mixColor blends channel by channel', () => {
  assert.deepEqual(K.mixColor([0, 0, 0], [200, 100, 50], 0.5), [100, 50, 25]);
  assert.deepEqual(K.mixColor([10, 10, 10], [20, 20, 20], 2), [20, 20, 20]);
});

test('luminance weights green highest', () => {
  assert.equal(K.luminance([0, 0, 0]), 0);
  assert.ok(Math.abs(K.luminance([255, 255, 255]) - 1) < 1e-9);
  assert.ok(K.luminance([0, 255, 0]) > K.luminance([255, 0, 0]));
  assert.ok(K.luminance([255, 0, 0]) > K.luminance([0, 0, 255]));
});

test('clamp, lerp and smoothstep behave', () => {
  assert.equal(K.clamp(5, 0, 1), 1);
  assert.equal(K.clamp(-1, 0, 1), 0);
  assert.equal(K.lerp(2, 4, 0.5), 3);
  assert.equal(K.smoothstep(0, 1, -1), 0);
  assert.equal(K.smoothstep(0, 1, 2), 1);
  assert.equal(K.smoothstep(0, 1, 0.5), 0.5);
});

test('rng is deterministic per seed', () => {
  const a = K.rng(42);
  const b = K.rng(42);
  const c = K.rng(7);
  const seqA = [a(), a(), a()];
  assert.deepEqual(seqA, [b(), b(), b()]);
  assert.notDeepEqual(seqA, [c(), c(), c()]);
  for (const v of seqA) assert.ok(v >= 0 && v < 1);
});

test('hash2 is stable and in range', () => {
  assert.equal(K.hash2(3, 4, 1), K.hash2(3, 4, 1));
  assert.notEqual(K.hash2(3, 4, 1), K.hash2(4, 3, 1));
  for (let i = 0; i < 200; i++) {
    const v = K.hash2(i, i * 7, 9);
    assert.ok(v >= 0 && v < 1);
  }
});

test('noise2 is smooth between lattice points', () => {
  const a = K.noise2(1.5, 2.5);
  const b = K.noise2(1.5001, 2.5);
  assert.ok(Math.abs(a - b) < 0.01);
  assert.ok(a >= 0 && a <= 1);
});

test('fbm stays in range', () => {
  for (let i = 0; i < 100; i++) {
    const v = K.fbm(i * 0.37, i * 0.11, 4);
    assert.ok(v >= 0 && v <= 1, `fbm out of range: ${v}`);
  }
});

test('bayer4 holds sixteen distinct thresholds', () => {
  const values = new Set();
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) values.add(K.bayer4(x, y));
  assert.equal(values.size, 16);
  assert.equal(K.bayer4(0, 0), K.bayer4(4, 8));
});

test('frameGate caps the frame rate', () => {
  const gate = K.frameGate(30);
  assert.equal(gate(0), true);
  assert.equal(gate(10), false);
  assert.equal(gate(34), true);
  assert.equal(gate(40), false);
});

test('frameGate with no cap always renders', () => {
  const gate = K.frameGate(0);
  assert.equal(gate(0), true);
  assert.equal(gate(1), true);
});

test('mergeProps keeps known keys and coerces types', () => {
  const defaults = { cell: 10, mode: 'glyph', invert: false, ink: '#000000' };
  const merged = K.mergeProps(defaults, { cell: '14', mode: 'dot', invert: 'true', extra: 1 });
  assert.deepEqual(merged, { cell: 14, mode: 'dot', invert: true, ink: '#000000' });
  assert.equal('extra' in merged, false);
});

test('mergeProps ignores values of the wrong shape', () => {
  const defaults = { cell: 10, ink: '#112233' };
  assert.deepEqual(K.mergeProps(defaults, { cell: 'big', ink: 'blue' }), defaults);
});

test('mergeProps does not mutate its inputs', () => {
  const defaults = Object.freeze({ cell: 10 });
  const incoming = Object.freeze({ cell: 12 });
  const merged = K.mergeProps(defaults, incoming);
  assert.equal(merged.cell, 12);
  assert.equal(defaults.cell, 10);
});

test('propsFromQuery parses a search string', () => {
  assert.deepEqual(K.propsFromQuery('?mode=dot&cell=8'), { mode: 'dot', cell: '8' });
  assert.deepEqual(K.propsFromQuery(''), {});
});

test('coverRect fills the target and keeps aspect', () => {
  const r = K.coverRect(1920, 1080, 100, 100);
  assert.equal(r.sh, 1080);
  assert.equal(r.sw, 1080);
  assert.equal(r.sx, 420);
  assert.equal(r.sy, 0);
  const tall = K.coverRect(1000, 2000, 200, 100);
  assert.equal(tall.sw, 1000);
  assert.equal(tall.sh, 500);
  assert.equal(tall.sy, 750);
});

test('parseSprite reads pixels and skips transparent cells', () => {
  const s = K.parseSprite(['.a', 'b.'], { a: '#ff0000', b: '#00ff00' });
  assert.equal(s.w, 2);
  assert.equal(s.h, 2);
  assert.deepEqual(s.pixels, [
    { x: 1, y: 0, color: '#ff0000' },
    { x: 0, y: 1, color: '#00ff00' },
  ]);
});

test('parseSprite ignores characters missing from the palette', () => {
  const s = K.parseSprite(['ax'], { a: '#000000' });
  assert.equal(s.pixels.length, 1);
});

test('seasonOf follows the northern calendar', () => {
  assert.equal(K.seasonOf(0), 'winter');
  assert.equal(K.seasonOf(3), 'spring');
  assert.equal(K.seasonOf(6), 'summer');
  assert.equal(K.seasonOf(9), 'autumn');
  assert.equal(K.seasonOf(11), 'winter');
});

test('paletteAt interpolates between stops and wraps midnight', () => {
  const stops = [
    { h: 0, sky: '#000000' },
    { h: 12, sky: '#ffffff' },
  ];
  assert.deepEqual(K.paletteAt(0, stops).sky, [0, 0, 0]);
  assert.deepEqual(K.paletteAt(12, stops).sky, [255, 255, 255]);
  assert.deepEqual(K.paletteAt(6, stops).sky, [127.5, 127.5, 127.5]);
  assert.deepEqual(K.paletteAt(18, stops).sky, [127.5, 127.5, 127.5]);
  assert.deepEqual(K.paletteAt(24, stops).sky, [0, 0, 0]);
});

test('paletteAt works with unsorted stops', () => {
  const stops = [
    { h: 12, sky: '#ffffff' },
    { h: 0, sky: '#000000' },
  ];
  assert.deepEqual(K.paletteAt(6, stops).sky, [127.5, 127.5, 127.5]);
});

test('hourOf reads fractional hours from a date', () => {
  assert.equal(K.hourOf(new Date(2026, 0, 1, 6, 30)), 6.5);
});
