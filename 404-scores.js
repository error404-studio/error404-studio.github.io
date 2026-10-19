/* ERROR 404 – shared Top 5 for the 404 game (Top 10 until 2026-10-19).
   Backend: Google Apps Script web app "ERROR 404 HIGH SCORES" (ibamatus@gmail.com),
   scores kept in its Script properties (SCORES, SKRYTE_MENA for moderation).
   Empty ENDPOINT = the game keeps its browser-only leaderboard. */
(function () {
  'use strict';
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbzROZjA1VtcFagxUTTqYwmVuoyuZd_qsweDl1aGb66Bpo04CEplEK1smkJL0eK-9Bpu/exec';
  const TIMEOUT = 8000;
  const clean = list => Array.isArray(list) ? list
    .filter(e => e && typeof e.id === 'string' && typeof e.name === 'string' && Number.isSafeInteger(e.score) && e.score > 0)
    .map(e => ({ id: e.id, name: e.name.slice(0, 16), score: e.score, createdAt: Number(e.createdAt) || 0 }))
    .slice(0, 5) : null;
  function attempt(options) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => controller && controller.abort(), TIMEOUT);
    return fetch(ENDPOINT, Object.assign({ redirect: 'follow', cache: 'no-store', signal: controller && controller.signal }, options))
      .then(response => { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .finally(() => clearTimeout(timer));
  }
  // Google occasionally answers a cold start with an HTML error page: try once more.
  // A repeated POST is safe, the backend ignores a run id it already stored.
  function request(options) {
    return attempt(options).catch(() => new Promise(resolve => setTimeout(resolve, 700)).then(() => attempt(options)));
  }
  window.Error404Scores = {
    enabled: !!ENDPOINT,
    top() { return request({ method: 'GET' }).then(data => clean(data && data.entries)); },
    submit(run) {
      return request({
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ id: run.id, name: run.name, score: run.score, duration: run.duration })
      }).then(data => ({ ok: !!(data && data.ok), reason: data && data.reason, rank: data && data.rank, entries: clean(data && data.entries) }));
    }
  };
})();
