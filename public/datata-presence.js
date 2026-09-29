/* DATATA · presencia en directo
   Avisa al dashboard cuando alguien entra, sigue conectado y sale (al cerrar la pestaña).
   Cambia APP por la clave de la app en DATATA:
   myooz · reu · stem · acopio_v · acopio_c · indep · dijimu · venezuela */
(function () {
  'use strict';
  var APP = 'acopio_v';
  if (/admin|moderador/i.test(location.pathname)) return; // los paneles internos no cuentan como visita
  if (window.__datataPresence) return;
  window.__datataPresence = true;

  var TOPIC = 'https://ntfy.sh/myoozlabs_live_telemetry_v2_e829fa';
  var K = 'datata_sid_' + APP, sid = '', since = 0, geo = {}, left = false, timer = null, started = false;
  var lastAct = Date.now(), ref = '';

  try { if (document.referrer) ref = new URL(document.referrer).hostname.replace(/^www\./, ''); } catch (e) {}
  try {
    var saved = JSON.parse(sessionStorage.getItem(K) || 'null');
    if (saved && saved.sid) { sid = saved.sid; since = saved.since; }
  } catch (e) {}
  if (!sid) {
    sid = Math.random().toString(36).slice(2, 10); since = Date.now();
    try { sessionStorage.setItem(K, JSON.stringify({ sid: sid, since: since })); } catch (e) {}
  }
  try { var g = JSON.parse(sessionStorage.getItem('datata_geo') || 'null'); if (g) geo = g; } catch (e) {}

  /* actividad real de la persona (distingue "está usando la app" de "dejó la pestaña abierta") */
  var actT = 0;
  function act() { var n = Date.now(); if (n - actT > 1000) { actT = n; lastAct = n; } }
  ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'wheel'].forEach(function (t) {
    window.addEventListener(t, act, { passive: true, capture: true });
  });

  function send(ev, beacon) {
    var body = JSON.stringify({
      event: ev, app: APP, sid: sid, since: since,
      ip: geo.ip || '', city: geo.city || '', country: geo.country || '',
      url: location.pathname, userAgent: navigator.userAgent, ref: ref,
      vis: document.visibilityState || 'visible',
      idle: Math.max(0, Math.round((Date.now() - lastAct) / 1000))
    });
    try {
      if (beacon && navigator.sendBeacon && navigator.sendBeacon(TOPIC, body)) return;
      fetch(TOPIC, { method: 'POST', body: body, keepalive: true }).catch(function () {});
    } catch (e) {}
  }
  function start() {
    if (started && !left) return;
    started = true; left = false;
    send('join');
    clearInterval(timer);
    timer = setInterval(function () { send('heartbeat'); }, 15000);
  }
  function stop() {
    if (left) return;
    left = true; clearInterval(timer);
    send('leave', true);
  }

  /* ubicación: dos proveedores por si uno falla o lo bloquea un adblock; nunca se espera más de 1,5 s */
  function saveGeo(x) {
    geo = { ip: x.ip, city: x.city, country: x.country_name || x.country };
    try { sessionStorage.setItem('datata_geo', JSON.stringify(geo)); } catch (e) {}
  }
  if (geo.ip) start();
  else {
    var t = setTimeout(start, 1500);
    fetch('https://ipapi.co/json/')
      .then(function (r) { return r.json(); })
      .then(function (x) { if (!x || !x.ip) throw 0; saveGeo(x); })
      .catch(function () {
        return fetch('https://ipwho.is/').then(function (r) { return r.json(); }).then(function (x) { if (x && x.ip) saveGeo(x); }).catch(function () {});
      })
      .then(function () { clearTimeout(t); start(); });
  }

  /* aviso inmediato al ocultar / volver a mostrar la pestaña */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') act();
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

  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', function (e) { if (e.persisted) { started = false; start(); } });
})();
