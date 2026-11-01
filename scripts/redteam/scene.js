// Red-team probe: tries every escape it can and reports through tokonoma.inspect().
(function () {
  const results = {};
  const F = (0).constructor.constructor; // static-check bypass: Function without the word
  const note = (k, v) => { results[k] = v; };
  const tryFetch = (k, url) => fetch(url).then((r) => r.text()).then((t) => note(k, 'READ ' + t.length + 'b'), (e) => note(k, 'blocked: ' + e.message));
  const attacks = [
    tryFetch('https', 'https://example.com/'),
    tryFetch('http', 'http://example.com/'),
    tryFetch('fileEtc', 'file:///etc/hosts'),
    tryFetch('fileHome', 'file:///Users/Shared'),
    tryFetch('otherWallpaper', '../torii/wallpaper.json'),
    tryFetch('ownFile', 'wallpaper.json'),
    tryFetch('customScheme', 'gopher://example.com/'),
    new Promise((res) => {
      try {
        const ws = new WebSocket('wss://echo.websocket.org');
        ws.onopen = () => { note('websocket', 'OPEN'); res(); };
        ws.onerror = () => { note('websocket', 'blocked'); res(); };
      } catch (e) { note('websocket', 'threw ' + e.message); res(); }
    }),
    new Promise((res) => {
      const img = new Image();
      img.onload = () => { note('img', 'LOADED'); res(); };
      img.onerror = () => { note('img', 'blocked'); res(); };
      img.src = 'https://www.google.com/favicon.ico';
    }),
    new Promise((res) => {
      try {
        const Peer = window.RTCPeerConnection || window.webkitRTCPeerConnection;
        if (!Peer) { note('webrtc', 'no RTCPeerConnection'); return res(); }
        const pc = new Peer({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        const cands = [];
        pc.createDataChannel('x');
        pc.onicecandidate = (e) => { if (e.candidate) cands.push(e.candidate.candidate.split(' ')[7]); };
        pc.createOffer().then((o) => pc.setLocalDescription(o));
        setTimeout(() => { note('webrtc', 'candidates: ' + (cands.join(',') || 'none')); res(); }, 4000);
      } catch (e) { note('webrtc', 'threw ' + e.message); res(); }
    }),
    new Promise((res) => {
      const f = document.createElement('iframe');
      f.onload = () => { try { note('iframe', 'loaded ' + f.contentWindow.location.href); } catch (e) { note('iframe', 'loaded (opaque)'); } res(); };
      f.src = 'file:///etc/hosts';
      document.documentElement.appendChild(f);
      setTimeout(() => { if (!results.iframe) note('iframe', 'no load'); res(); }, 2000);
    }),
  ];
  attacks.push(new Promise((res) => {
    const f = document.createElement('iframe');
    document.documentElement.appendChild(f);
    const P = f.contentWindow && f.contentWindow.RTCPeerConnection;
    if (!P) { note('webrtcViaIframe', 'no RTCPeerConnection'); return res(); }
    try {
      const pc = new P({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      const c = []; pc.createDataChannel('x');
      pc.onicecandidate = (e) => { if (e.candidate) c.push(e.candidate.candidate.split(' ')[7]); };
      pc.createOffer().then((o) => pc.setLocalDescription(o));
      setTimeout(() => { note('webrtcViaIframe', 'candidates: ' + (c.join(',') || 'none')); res(); }, 4000);
    } catch (e) { note('webrtcViaIframe', 'threw ' + e.message); res(); }
  }));
  try { note('functionCtor', String(F('return 1+1')())); } catch (e) { note('functionCtor', 'blocked ' + e.message); }
  note('bridge', typeof (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.tokonoma));
  try { window.webkit.messageHandlers.tokonoma.postMessage({ type: 'error', message: 'Your Mac is infected. Call 555-0100 now.' }); note('bridgeSpoof', 'sent'); } catch (e) { note('bridgeSpoof', 'threw'); }
  note('open', String(window.open('https://example.com')));

  Kasuri.run({
    defaults: { mode: 'glyph' },
    draw(ctx, t, dt, api) { ctx.fillStyle = '#204030'; ctx.fillRect(0, 0, api.cols, api.rows); },
  });
  // Reported through --probe; the scene can no longer touch window.tokonoma.
  window.__redteam = Promise.all(attacks).then(() => {
    try { window.tokonoma.inspect = () => ({ faked: true }); results.replaceInspect = 'REPLACED'; } catch (e) { results.replaceInspect = 'blocked'; }
    results.replaceInspect = window.tokonoma.inspect.toString().includes('faked') ? 'REPLACED' : 'blocked';
    return results;
  });
})();
