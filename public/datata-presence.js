/* DATATA · presencia en directo (v4.3)
   Avisa al dashboard cuando alguien entra, cambia de estado y sale (al cerrar la pestaña).
   - Pocos mensajes (el canal gratuito tiene un límite diario): entrada, salida, cambios reales
     y una señal de vida cada 2 min (5 min con la pestaña oculta).
   - Canal en vivo (Supabase Realtime): el servidor detecta al instante cuando la pestaña se cierra o se corta.
     Solo lleva app, página, estado y una marca de red (sin IP); la IP y la ciudad van solo al panel.
   - La misma persona conserva su identificador al pasar de una app del ecosistema a otra por un enlace.
   Cambia APP por la clave de la app en DATATA:
   myooz · reu · stem · acopio_v · acopio_c · indep · dijimu · venezuela · nona */
(function () {
  'use strict';
  var APP = 'acopio_v';
  if (/admin|moderador/i.test(location.pathname)) return; // los paneles internos no cuentan como visita
  try { if (window.self !== window.top) return; } catch (e) { return; } // dentro de otra página (p. ej. el mapa dentro de Por Venezuela): avisa la página que lo contiene
  if (window.__datataPresence) return;
  window.__datataPresence = 4;

  var TOPIC = 'https://ntfy.sh/myoozlabs_live_telemetry_v2_e829fa';
  var ECO = ['myoozlabs.vercel.app', 'myoozlabs.com', 'reu-live.vercel.app', 'toolboxlab.vercel.app', 'tinahmbuz-audiostems.hf.space',
    'centro-de-acopio-ven.vercel.app', 'acopio-col.vercel.app', 'indpendent.vercel.app', 'dijimu.vercel.app', 'digimu.vercel.app', 'studio-x-pro.vercel.app', 'porvenezuela.vercel.app', 'interfaz-hazel.vercel.app'];
  var RT_URL = 'wss://hcjjdryltrbagybpygdy.supabase.co/realtime/v1/websocket?apikey=sb_publishable_AFBWrOkX9RqVSfAvIXyeUA_6TCwEJve&vsn=1.0.0', RT_TOPIC = 'realtime:datata';
  var RT_HTTP = 'https://hcjjdryltrbagybpygdy.supabase.co/realtime/v1/api/broadcast', RT_KEY = 'sb_publishable_AFBWrOkX9RqVSfAvIXyeUA_6TCwEJve';
  var HB_VISIBLE = 120000, HB_HIDDEN = 300000, IDLE = 300;
  function get(s, k) { try { return s.getItem(k); } catch (e) { return null; } }
  function put(s, k, v) { try { s.setItem(k, v); } catch (e) {} }
  function rnd(n) { var s = ''; while (s.length < n) s += Math.random().toString(36).slice(2); return s.slice(0, n); }
  var LS = null, SS = null;
  try { LS = window.localStorage; SS = window.sessionStorage; } catch (e) {}
  var mem = {}, store = function (s) { return s || { getItem: function (k) { return mem[k] || null; }, setItem: function (k, v) { mem[k] = v; } }; };
  LS = store(LS); SS = store(SS);

  /* identificador del visitante: viene en el enlace desde otra app del ecosistema, o se crea aquí */
  var vid = '', from = '', ref = '';
  try { if (document.referrer) ref = new URL(document.referrer).hostname.replace(/^www\./, ''); } catch (e) {}
  try {
    var u = new URL(location.href), qv = u.searchParams.get('_dtv');
    if (qv && /^[a-z0-9]{6,24}$/.test(qv)) { vid = qv; from = (u.searchParams.get('_dtf') || '').slice(0, 16); }
    if (u.searchParams.has('_dtv') || u.searchParams.has('_dtf')) {
      u.searchParams.delete('_dtv'); u.searchParams.delete('_dtf');
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    }
  } catch (e) {}
  if (vid) put(LS, 'datata_vid', vid); else vid = get(LS, 'datata_vid') || '';
  if (!vid) { vid = rnd(12); put(LS, 'datata_vid', vid); }

  /* pestaña: se conserva al recargar la misma pestaña */
  var K = 'datata_sid_' + APP, sid = '', since = 0;
  try { var sv = JSON.parse(get(SS, K) || 'null'); if (sv && sv.sid) { sid = sv.sid; since = sv.since; } } catch (e) {}
  function newSid() { sid = rnd(8); since = Date.now(); put(SS, K, JSON.stringify({ sid: sid, since: since })); }
  if (!sid) newSid();

  var geo = {};
  try { var g = JSON.parse(get(LS, 'datata_geo3') || 'null'); if (g && g.ip && Date.now() - g.t < 6 * 3600000) geo = g; } catch (e) {}

  /* actividad real de la persona (distingue "está usando la app" de "dejó la pestaña abierta") */
  var lastAct = Date.now(), actT = 0, sentIdle = false, lastSent = 0, left = false, started = false;
  function idleSecs() { return Math.max(0, Math.round((Date.now() - lastAct) / 1000)); }
  function act() {
    var n = Date.now(); if (n - actT < 1000) return; actT = n; lastAct = n;
    if (sentIdle && started && !left) send('heartbeat'); // vuelve a estar activa: aviso inmediato
  }
  ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'wheel'].forEach(function (t) {
    window.addEventListener(t, act, { passive: true, capture: true });
  });

  function send(ev, beacon) {
    var idle = idleSecs();
    sentIdle = idle >= IDLE; lastSent = Date.now();
    if (ev !== 'leave') rtTrack(false);
    var body = JSON.stringify({
      v: 3, event: ev, app: APP, sid: sid, since: since, vid: vid, from: from,
      ip: geo.ip || '', city: geo.city || '', country: geo.country || '',
      url: location.pathname, userAgent: navigator.userAgent, ref: ref,
      vis: document.visibilityState || 'visible', idle: idle
    });
    try {
      if (beacon && navigator.sendBeacon && navigator.sendBeacon(TOPIC, body)) return;
      fetch(TOPIC, { method: 'POST', body: body, keepalive: true }).catch(function () {});
    } catch (e) {}
  }
  /* canal en vivo: presencia en Supabase Realtime */
  var ws = null, wsRef = 0, wsJoin = '', wsOk = false, wsHb = null, wsRetry = 0, wsT = null, rtSig = '';
  /* marca de red: igual para dispositivos conectados a la misma IP, sin revelar la IP a otros visitantes */
  function netOf(ip) { if (!ip) return ''; var h = 2166136261; for (var i = 0; i < ip.length; i++) { h ^= ip.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36).slice(0, 6); }
  /* IP y ciudad solo para el panel (difusión privada, no la ven los demás visitantes) */
  var geoT = 0;
  function sendGeo(force) {
    if (!geo.ip || left) return; var n = Date.now(); if (!force && n - geoT < 60000) return; if (n - geoT < 4000) return; geoT = n;
    try { fetch(RT_HTTP, { method: 'POST', keepalive: true, headers: { apikey: RT_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: 'datata-geo', event: 'geo', payload: { app: APP, sid: sid, vid: vid, ip: geo.ip, city: geo.city || '', country: geo.country || '' } }] }) }).catch(function () {}); } catch (e) {}
  }
  function rtState() {
    return { v: 4, app: APP, sid: sid, since: since, vid: vid, from: from, url: location.pathname, ref: ref, net: netOf(geo.ip),
      dev: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'Móvil' : 'Escritorio',
      vis: document.visibilityState || 'visible', idle: idleSecs() >= IDLE ? idleSecs() : 0 };
  }
  function rtPush(msg) { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); } catch (e) {} }
  function rtTrack(force) {
    if (!wsOk) return;
    var st = rtState(), sig = st.url + '|' + st.vis + '|' + (st.idle > 0) + '|' + sid + '|' + st.net;
    if (!force && sig === rtSig) return; rtSig = sig;
    rtPush({ topic: RT_TOPIC, event: 'presence', payload: { type: 'presence', event: 'track', payload: st }, ref: String(++wsRef), join_ref: wsJoin });
  }
  function rtConnect() {
    clearTimeout(wsT);
    if (left || !window.WebSocket || (ws && ws.readyState <= 1)) return;
    try { ws = new WebSocket(RT_URL); } catch (e) { return; }
    ws.onopen = function () {
      wsRetry = 0; wsJoin = String(++wsRef);
      rtPush({ topic: RT_TOPIC, event: 'phx_join', payload: { config: { broadcast: { self: false }, presence: { key: APP + ':' + sid, enabled: true }, private: false } }, ref: wsJoin, join_ref: wsJoin });
      clearInterval(wsHb);
      wsHb = setInterval(function () { rtPush({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++wsRef) }); }, 25000);
    };
    ws.onmessage = function (e) {
      try { var m = JSON.parse(e.data);
        if (m.event === 'phx_reply' && m.ref === wsJoin && m.payload && m.payload.status === 'ok') { wsOk = true; rtTrack(true); }
        /* cuando se abre el panel, le enviamos al instante la IP y la ciudad */
        var ks = m.event === 'presence_state' ? Object.keys(m.payload || {}) : m.event === 'presence_diff' ? Object.keys((m.payload && m.payload.joins) || {}) : [];
        for (var i = 0; i < ks.length; i++) if (ks[i].indexOf('panel-') === 0) { sendGeo(true); break; }
      } catch (x) {}
    };
    ws.onclose = function () {
      wsOk = false; clearInterval(wsHb); ws = null;
      if (!left) wsT = setTimeout(rtConnect, Math.min(30000, 1000 * Math.pow(2, wsRetry++)));
    };
  }
  function rtClose() { clearTimeout(wsT); clearInterval(wsHb); wsOk = false; if (ws) { try { ws.close(); } catch (e) {} ws = null; } }

  function start() {
    if (started && !left) return;
    started = true; left = false;
    send('join');
    rtConnect();
    sendGeo(true);
  }
  function stop() {
    if (left || !started) return;
    left = true;
    send('leave', true);
    rtClose();
  }
  /* señal de vida espaciada + aviso cuando pasa a "sin actividad" */
  setInterval(function () {
    if (!started || left) return;
    var hidden = document.visibilityState === 'hidden';
    if ((idleSecs() >= IDLE) !== sentIdle) { send('heartbeat'); return; }
    if (Date.now() - lastSent >= (hidden ? HB_HIDDEN : HB_VISIBLE)) send('heartbeat');
  }, 20000);

  /* ubicación: tres proveedores por si uno falla o lo bloquea un adblock; nunca se espera más de 1,5 s */
  function saveGeo(x) {
    geo = { ip: x.ip, city: x.city || '', country: x.country_name || x.country || '', t: Date.now() };
    put(LS, 'datata_geo3', JSON.stringify(geo));
  }
  if (geo.ip) start();
  else {
    var t = setTimeout(start, 1500);
    /* 1º tu propio servidor (MYOOZ Labs en Vercel, rápido y sin límites); si falla, dos servicios públicos */
    var tryGeo = function (u) { return fetch(u).then(function (r) { return r.json(); }).then(function (x) { if (!x || !x.ip) throw 0; saveGeo(x); }); };
    tryGeo('https://myoozlabs.vercel.app/api/track')
      .catch(function () { return tryGeo('https://ipwho.is/'); })
      .catch(function () { return tryGeo('https://ipapi.co/json/'); })
      .catch(function () {})
      .then(function () { clearTimeout(t); if (!started) start(); else if (!left && geo.ip) { send('heartbeat'); rtTrack(true); sendGeo(true); } });
  }

  /* aviso inmediato al ocultar / volver a mostrar la pestaña */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { lastAct = Date.now(); if (!ws && started && !left) rtConnect(); }
    if (started && !left) send('heartbeat');
  });

  /* apps de una sola página: avisar también cuando cambia de sección */
  var lastPath = location.pathname, navT = null;
  function onNav() {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    clearTimeout(navT);
    navT = setTimeout(function () { if (started && !left) send('heartbeat'); }, 250);
  }
  ['pushState', 'replaceState'].forEach(function (m) {
    var o = history[m];
    history[m] = function () { var r = o.apply(this, arguments); onNav(); return r; };
  });
  window.addEventListener('popstate', onNav);

  /* enlaces hacia otras apps del ecosistema: llevan el identificador para que cuente como la misma persona */
  function tag(href) {
    try {
      var x = new URL(href, location.href);
      if (x.host === location.host || ECO.indexOf(x.host.replace(/^www\./, '')) < 0) return href;
      x.searchParams.set('_dtv', vid); x.searchParams.set('_dtf', APP);
      return x.toString();
    } catch (e) { return href; }
  }
  function onLink(e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var h = tag(a.href); if (h !== a.href) a.href = h;
  }
  ['pointerdown', 'touchstart', 'click', 'auxclick', 'keydown'].forEach(function (t) {
    document.addEventListener(t, onLink, { capture: true, passive: true });
  });
  var wo = window.open;
  if (wo) window.open = function (url) { var a = [].slice.call(arguments); if (typeof url === 'string') a[0] = tag(url); return wo.apply(window, a); };

  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', function (e) { if (e.persisted && left) { newSid(); rtSig = ''; started = false; start(); } });
  window.addEventListener('online', function () { if (started && !left) rtConnect(); });
})();
