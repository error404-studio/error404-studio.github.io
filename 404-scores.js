/* ERROR 404 – shared Top 10 for the 404 game.
   Backend: Google Apps Script web app bound to the sheet
   "ERROR 404 – HIGH SCORES (hra na webe)" (Drive of ibamatus@gmail.com).
   Empty ENDPOINT = the game keeps its browser-only leaderboard. */
(function () {
  'use strict';
  const ENDPOINT = '';
  const TIMEOUT = 8000;
  const clean = list => Array.isArray(list) ? list
    .filter(e => e && typeof e.id === 'string' && typeof e.name === 'string' && Number.isSafeInteger(e.score) && e.score > 0)
    .map(e => ({ id: e.id, name: e.name.slice(0, 16), score: e.score, createdAt: Number(e.createdAt) || 0 }))
    .slice(0, 10) : null;
  function request(options) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => controller && controller.abort(), TIMEOUT);
    return fetch(ENDPOINT, Object.assign({ redirect: 'follow', cache: 'no-store', signal: controller && controller.signal }, options))
      .then(response => { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); })
      .finally(() => clearTimeout(timer));
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
