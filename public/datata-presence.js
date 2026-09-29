/* DATATA · presencia en directo
   Avisa al dashboard cuando alguien entra, sigue conectado y sale (al cerrar la pestaña).
   Cambia APP por la clave de la app en DATATA:
   myooz · reu · stem · acopio_v · acopio_c · indep · dijimu */
(function () {
  'use strict';
  var APP = 'acopio_v';
  if (/admin|moderador/i.test(location.pathname)) return; // los paneles internos no cuentan como visita
  if (window.__datataPresence) return;
  window.__datataPresence = true;

  var TOPIC = 'https://ntfy.sh/myoozlabs_live_telemetry_v2_e829fa';
  var K = 'datata_sid_' + APP, sid = '', since = 0, geo = {}, left = false, timer = null, started = false;

  try {
    var saved = JSON.parse(sessionStorage.getItem(K) || 'null');
    if (saved && saved.sid) { sid = saved.sid; since = saved.since; }
  } catch (e) {}
  if (!sid) {
    sid = Math.random().toString(36).slice(2, 10); since = Date.now();
    try { sessionStorage.setItem(K, JSON.stringify({ sid: sid, since: since })); } catch (e) {}
  }
  try { var g = JSON.parse(sessionStorage.getItem('datata_geo') || 'null'); if (g) geo = g; } catch (e) {}

  function send(ev, beacon) {
    var body = JSON.stringify({
      event: ev, app: APP, sid: sid, since: since,
      ip: geo.ip || '', city: geo.city || '', country: geo.country || '',
      url: location.pathname, userAgent: navigator.userAgent
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

  if (geo.ip) start();
  else {
    var t = setTimeout(start, 1500); // no se espera más de 1,5 s por la ubicación
    fetch('https://ipapi.co/json/')
      .then(function (r) { return r.json(); })
      .then(function (x) {
        geo = { ip: x.ip, city: x.city, country: x.country_name };
        try { sessionStorage.setItem('datata_geo', JSON.stringify(geo)); } catch (e) {}
      })
      .catch(function () {})
      .then(function () { clearTimeout(t); start(); });
  }

  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', function (e) { if (e.persisted) { started = false; start(); } });
})();
