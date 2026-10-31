/*
 * sky — one clock-driven sky shared by every outdoor scene, so torii and
 * fuji agree on what 6pm looks like.
 */
(function (root) {
  'use strict';

  const K = root.KasuriCore;

  // top/low: the sky gradient. amb: tint for everything lit by it. haze: distant hills and mist.
  const STOPS = [
    { h: 0, top: '#070a16', low: '#1d2340', amb: '#6a7398', haze: '#262c4c' },
    { h: 5, top: '#0e1230', low: '#3e3658', amb: '#76708f', haze: '#3a3555' },
    { h: 6.5, top: '#2f4777', low: '#e9966a', amb: '#d0a594', haze: '#b98a86' },
    { h: 9, top: '#3f6fa8', low: '#b9d0dc', amb: '#f2f0ea', haze: '#a7b9c6' },
    { h: 15, top: '#3a6aa4', low: '#c4d6de', amb: '#ffffff', haze: '#b0c2cc' },
    { h: 17.5, top: '#34457a', low: '#f0954f', amb: '#f5c69c', haze: '#c98a6a' },
    { h: 19, top: '#191d40', low: '#9c4d63', amb: '#9e8193', haze: '#5c3f5e' },
    { h: 21, top: '#090c1c', low: '#272846', amb: '#717a9e', haze: '#2a2d4c' },
  ];

  const TIMES = { dawn: 6.6, day: 12.5, dusk: 17.9, night: 23 };

  function nightness(h) {
    if (h < 5 || h >= 20.5) return 1;
    if (h < 7) return 1 - K.smoothstep(5, 7, h);
    if (h < 17.5) return 0;
    return K.smoothstep(17.5, 20.5, h);
  }

  // "auto" follows the real clock; anything in TIMES pins it.
  function hour(choice) {
    return TIMES[choice] ?? K.hourOf(new Date());
  }

  function at(h) {
    return Object.assign(K.paletteAt(h, STOPS), { night: nightness(h), hour: h });
  }

  // Sun crosses the sky 6:00–19:30, moon 19:00–6:00. t is 0..1 along each arc.
  function sunT(h) {
    return K.clamp((h - 6) / 13.5, 0, 1);
  }

  function moonT(h) {
    return K.clamp(((h - 19 + 24) % 24) / 11, 0, 1);
  }

  root.KasuriSky = Object.freeze({ STOPS, TIMES, nightness, hour, at, sunT, moonT });
})(globalThis);
