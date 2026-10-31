/*
 * Media — any video, image or gif you import, woven through kasuri.
 *
 * The host writes a tiny index.html next to the file with
 * <body data-media="clip.mp4">. In a browser, ?src=path works too.
 */
(function () {
  'use strict';

  const K = KasuriCore;
  const VIDEO = /\.(mp4|m4v|mov|webm)$/i;

  const src = document.body.dataset.media || new URLSearchParams(location.search).get('src') || '';
  const state = { el: null, poster: null, ready: false, w: 0, h: 0 };
  let markReady;
  const loaded = new Promise((resolve) => { markReady = resolve; });

  // Videos get a poster.jpg beside them (the app writes it on import). It
  // stands in until the first frame decodes, and for hidden thumbnail renders.
  function loadPoster() {
    const poster = new Image();
    poster.onload = () => {
      state.poster = poster;
      markReady();
    };
    poster.src = document.body.dataset.poster || 'poster.jpg';
  }

  function load() {
    if (VIDEO.test(src)) {
      loadPoster();
      const v = document.createElement('video');
      Object.assign(v, { muted: true, loop: true, playsInline: true, autoplay: true, preload: 'auto' });
      v.addEventListener('loadeddata', () => {
        state.ready = true;
        state.w = v.videoWidth;
        state.h = v.videoHeight;
        markReady();
      });
      v.src = src;
      v.play().catch(() => {});
      state.el = v;
    } else {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        state.ready = true;
        state.w = img.naturalWidth;
        state.h = img.naturalHeight;
        markReady();
      };
      img.onerror = () => markReady();
      img.src = src;
      state.el = img;
    }
  }

  function filter(props) {
    return `contrast(${props.contrast}) saturate(${props.saturation}) brightness(${props.brightness})`;
  }

  function draw(ctx, t, dt, api) {
    const props = api.props;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, api.cols, api.rows);
    const el = state.ready ? state.el : state.poster;
    if (!el) return;
    const w = state.ready ? state.w : el.naturalWidth;
    const h = state.ready ? state.h : el.naturalHeight;
    ctx.filter = filter(props);
    if (props.fit === 'contain') {
      const scale = Math.min(api.cols / w, api.rows / h);
      ctx.drawImage(el, (api.cols - w * scale) / 2, (api.rows - h * scale) / 2, w * scale, h * scale);
    } else {
      const r = K.coverRect(w, h, api.cols, api.rows);
      ctx.drawImage(el, r.sx, r.sy, r.sw, r.sh, 0, 0, api.cols, api.rows);
    }
    ctx.filter = 'none';
  }

  load();
  Kasuri.run({
    defaults: {
      fit: 'cover',
      contrast: 1.1,
      saturation: 1.2,
      brightness: 1,
      cell: 8,
      ramp: 'lines',
    },
    draw,
    ready: () => loaded,
    onProps(props) {
      if (state.el && 'playbackRate' in state.el) state.el.playbackRate = K.clamp(props.speed, 0.1, 4);
    },
    onPause(paused) {
      if (!state.el || !('play' in state.el)) return;
      if (paused) state.el.pause();
      else state.el.play().catch(() => {});
    },
  });
})();
