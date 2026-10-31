const test = require('node:test');
const assert = require('node:assert/strict');

globalThis.KasuriCore = require('../../Wallpapers/_lib/kasuri-core.js');
require('../../Wallpapers/_lib/sky.js');
const Sky = globalThis.KasuriSky;

test('night is full at midnight and gone at noon', () => {
  assert.equal(Sky.nightness(0), 1);
  assert.equal(Sky.nightness(12), 0);
  assert.equal(Sky.nightness(23), 1);
});

test('dusk and dawn sit in between', () => {
  const dusk = Sky.nightness(19);
  const dawn = Sky.nightness(6);
  assert.ok(dusk > 0 && dusk < 1);
  assert.ok(dawn > 0 && dawn < 1);
});

test('named times pin the clock, auto follows it', () => {
  assert.equal(Sky.hour('dusk'), Sky.TIMES.dusk);
  const now = Sky.hour('auto');
  assert.ok(now >= 0 && now < 24);
});

test('sun and moon arcs stay within 0..1', () => {
  for (let h = 0; h < 24; h += 0.5) {
    for (const v of [Sky.sunT(h), Sky.moonT(h)]) assert.ok(v >= 0 && v <= 1);
  }
});

test('at() returns rgb arrays plus night and hour', () => {
  const s = Sky.at(18);
  assert.equal(s.hour, 18);
  assert.equal(s.top.length, 3);
  assert.ok(s.night > 0);
});
