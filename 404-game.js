/* ERROR 404 maze game. The white ERROR 404 robot collects dots and flees red
   monsters: one on level 1, two on level 2, three from level 3 (2026-10-12).
   Three lives. Only the explicitly approved Let's play cue runs on a
   user-started new game. Scores go to the shared Top 5 (404-scores.js). */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.Error404Maze = api; api.mount(document); }
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  const COLS = 21, ROWS = 17;
  const DIRECTIONS = Object.freeze({
    up: { x: 0, y: -1, opposite: 'down' },
    left: { x: -1, y: 0, opposite: 'right' },
    down: { x: 0, y: 1, opposite: 'up' },
    right: { x: 1, y: 0, opposite: 'left' }
  });
  const PLAYER_START = Object.freeze({ x: 10, y: 13 });
  const MONSTER_START = Object.freeze({ x: 10, y: 5 });
  // Monsters (2026-10-12): level 1 has one, level 2 two, level 3 and up three.
  // Each starts in its own spot, has its own corner and hunts a little
  // differently, so they spread out instead of moving as one blob:
  // chase = straight at the robot, ambush = a few cells ahead of it,
  // shy = chases from afar but backs off to its corner when close.
  const MONSTER_SETUP = Object.freeze([
    Object.freeze({ start: MONSTER_START, corner: Object.freeze({ x: 19, y: 1 }), style: 'chase', pace: 1 }),
    Object.freeze({ start: Object.freeze({ x: 8, y: 5 }), corner: Object.freeze({ x: 1, y: 1 }), style: 'ambush', pace: 0.96 }),
    Object.freeze({ start: Object.freeze({ x: 12, y: 5 }), corner: Object.freeze({ x: 1, y: 15 }), style: 'shy', pace: 0.92 })
  ]);
  const key = (x, y) => y * COLS + x;
  const close = (a, b) => Math.abs(a - b) < 0.000001;
  const centered = actor => close(actor.x, Math.round(actor.x)) && close(actor.y, Math.round(actor.y));

  // Original layout: connected loops, stepped islands and short side passages.
  const cells = Array.from({ length: ROWS }, () => Array(COLS).fill('#'));
  function horizontal(y, x1, x2) { for (let x = x1; x <= x2; x++) cells[y][x] = '.'; }
  function vertical(x, y1, y2) { for (let y = y1; y <= y2; y++) cells[y][x] = '.'; }
  horizontal(1, 1, 19); horizontal(15, 1, 19);
  vertical(1, 1, 15); vertical(19, 1, 15);
  vertical(5, 1, 13); vertical(15, 3, 15); vertical(10, 3, 13);
  horizontal(3, 5, 15); horizontal(5, 1, 19);
  horizontal(9, 1, 19); horizontal(13, 1, 19);
  horizontal(11, 1, 5); horizontal(11, 15, 19);
  horizontal(7, 3, 8); horizontal(7, 12, 17);
  vertical(3, 5, 9); vertical(8, 7, 9);
  vertical(12, 5, 9); vertical(17, 7, 9);
  for (const [x, y] of [[1, 1], [19, 1], [1, 15], [19, 15]]) cells[y][x] = 'o';
  const MAZE = Object.freeze(cells.map(row => row.join('')));
  const walkable = (x, y) => Number.isInteger(x) && Number.isInteger(y) && y >= 0 && y < ROWS && x >= 0 && x < COLS && MAZE[y][x] !== '#';
  function canMove(actor, direction) {
    const d = DIRECTIONS[direction];
    return !!d && walkable(Math.round(actor.x) + d.x, Math.round(actor.y) + d.y);
  }
  function distancesFrom(target) {
    const distances = new Map();
    if (!walkable(target.x, target.y)) return distances;
    const queue = [{ x: target.x, y: target.y }];
    distances.set(key(target.x, target.y), 0);
    for (let i = 0; i < queue.length; i++) {
      const point = queue[i], distance = distances.get(key(point.x, point.y)) + 1;
      for (const d of Object.values(DIRECTIONS)) {
        const x = point.x + d.x, y = point.y + d.y, id = key(x, y);
        if (walkable(x, y) && !distances.has(id)) { distances.set(id, distance); queue.push({ x, y }); }
      }
    }
    return distances;
  }
  function makeActor(start) { return { x: start.x, y: start.y, direction: null }; }

  class Game {
    constructor(options = {}) {
      this.random = options.random || Math.random;
      this.restart();
    }
    restart() {
      this.score = 0; this.lives = 3; this.elapsed = 0;   // three lives (2026-10-12, evening)
      this.level = 1;
      this.phase = 'ready'; this.powerRemaining = 0; this.combo = 0;
      this.fillPellets();
      this.resetActors();
    }
    fillPellets() {
      this.pellets = new Map();
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if (walkable(x, y)) this.pellets.set(key(x, y), MAZE[y][x] === 'o' ? 50 : 10);
      }
      this.pellets.delete(key(PLAYER_START.x, PLAYER_START.y));
      this.initialPellets = this.pellets.size;
    }
    // Levels (2026-10-12): clearing every dot opens the next, harder level.
    // The score and the lives carry on; a monster joins on levels 2 and 3,
    // monsters get faster, power gets shorter and the monsters stop
    // wandering off to their corners.
    get monsterCount() { return Math.min(MONSTER_SETUP.length, this.level); }
    get monsterSpeed() { return Math.min(5, 4.1 + 0.3 * (this.level - 1)); }
    get frightSpeed() { return Math.min(4, 3 + 0.15 * (this.level - 1)); }
    get powerDuration() { return Math.max(3, 7 - (this.level - 1)); }
    get scatterTime() { return Math.max(0, 5 - (this.level - 1)); }
    get releaseDelay() { return Math.max(0.6, 1.5 - 0.2 * (this.level - 1)); }
    resetActors() {
      this.player = makeActor(PLAYER_START);
      this.monsters = MONSTER_SETUP.slice(0, this.monsterCount).map((setup, index) => Object.assign(makeActor(setup.start), {
        home: setup.start, corner: setup.corner, style: setup.style, pace: setup.pace,
        returning: false, release: this.releaseDelay + 2 * index
      }));
      this.queuedDirection = null; this.powerRemaining = 0; this.combo = 0;
    }
    get monster() { return this.monsters[0]; }
    start() {
      if (this.phase === 'won' || this.phase === 'gameover') this.restart();
      if (this.phase === 'level-clear') { this.level += 1; this.fillPellets(); this.resetActors(); }
      if (this.phase === 'life-lost') this.resetActors();
      if (['ready', 'paused', 'life-lost', 'level-clear'].includes(this.phase)) this.phase = 'playing';
    }
    pause() { if (this.phase === 'playing') this.phase = 'paused'; }
    queueTurn(direction) { if (this.phase === 'playing' && DIRECTIONS[direction]) this.queuedDirection = direction; }
    collect() {
      const id = key(Math.round(this.player.x), Math.round(this.player.y));
      const value = this.pellets.get(id);
      if (!value) return;
      this.pellets.delete(id); this.score += value;
      if (value === 50) {
        this.powerRemaining = this.powerDuration; this.combo = 0;
        for (const monster of this.monsters) if (monster.direction) monster.direction = DIRECTIONS[monster.direction].opposite;
      }
      if (this.pellets.size === 0) this.phase = 'level-clear';
    }
    huntTarget(monster) {
      const player = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
      if (monster.style === 'ambush') {
        const d = DIRECTIONS[this.player.direction];
        let ahead = player;
        for (let i = 0; d && i < 4 && walkable(ahead.x + d.x, ahead.y + d.y); i++) ahead = { x: ahead.x + d.x, y: ahead.y + d.y };
        return ahead;
      }
      if (monster.style === 'shy') {
        const distance = distancesFrom(player).get(key(Math.round(monster.x), Math.round(monster.y))) ?? 999;
        return distance > 6 ? player : monster.corner;
      }
      return player;
    }
    chooseMonsterDirection(monster = this.monster) {
      const all = Object.keys(DIRECTIONS).filter(direction => canMove(monster, direction));
      if (!all.length) return null;
      const forward = all.filter(direction => direction !== DIRECTIONS[monster.direction]?.opposite);
      const available = monster.returning ? all : (forward.length ? forward : all);
      let target;
      if (monster.returning) target = monster.home;
      else if (this.powerRemaining > 0) target = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
      else if (this.elapsed % 25 < this.scatterTime) target = monster.corner;
      else target = this.huntTarget(monster);
      const distances = distancesFrom(target);
      let best = [], bestValue = -Infinity;
      for (const direction of available) {
        const d = DIRECTIONS[direction];
        const distance = distances.get(key(Math.round(monster.x) + d.x, Math.round(monster.y) + d.y)) ?? 999;
        const value = this.powerRemaining > 0 && !monster.returning ? distance : -distance;
        if (value > bestValue) { bestValue = value; best = [direction]; }
        else if (value === bestValue) best.push(direction);
      }
      return best[Math.floor(this.random() * best.length) % best.length];
    }
    move(actor, distance, decide, arrived) {
      let remaining = distance;
      while (remaining > 0.000001 && this.phase === 'playing') {
        if (centered(actor)) {
          actor.x = Math.round(actor.x); actor.y = Math.round(actor.y);
          actor.direction = decide();
          if (!canMove(actor, actor.direction)) { actor.direction = null; break; }
        }
        const direction = DIRECTIONS[actor.direction];
        if (!direction) break;
        const current = direction.x ? actor.x : actor.y;
        const sign = direction.x || direction.y;
        const target = sign > 0 ? Math.floor(current + 0.000001) + 1 : Math.ceil(current - 0.000001) - 1;
        const step = Math.min(remaining, Math.abs(target - current));
        actor.x += direction.x * step; actor.y += direction.y * step; remaining -= step;
        if (close(direction.x ? actor.x : actor.y, target)) {
          actor.x = Math.round(actor.x); actor.y = Math.round(actor.y);
          if (arrived() === false) break;
        }
      }
    }
    checkCollision() {
      if (this.phase !== 'playing') return;
      for (const monster of this.monsters) {
        if (monster.returning || monster.release > 0) continue;
        if (Math.hypot(this.player.x - monster.x, this.player.y - monster.y) >= 0.68) continue;
        if (this.powerRemaining > 0) {
          // The eyes keep moving to the next center, then take the shortest way home.
          monster.returning = true;
          this.score += 200 * Math.pow(2, Math.min(this.combo++, 3));
        } else {
          this.lives -= 1;
          this.phase = this.lives > 0 ? 'life-lost' : 'gameover';
          return;
        }
      }
    }
    update(seconds) {
      if (this.phase !== 'playing' || !Number.isFinite(seconds) || seconds <= 0) return;
      // Bound suspended frames; small steps also prevent actors crossing unseen.
      let remaining = Math.min(seconds, 0.1);
      while (remaining > 0.000001 && this.phase === 'playing') {
        const dt = Math.min(remaining, 1 / 120); remaining -= dt;
        this.elapsed += dt; this.powerRemaining = Math.max(0, this.powerRemaining - dt);
        this.move(this.player, 5.1 * dt, () => {
          if (canMove(this.player, this.queuedDirection)) return this.queuedDirection;
          return this.player.direction;
        }, () => this.collect());
        if (this.phase !== 'playing') break;
        for (const monster of this.monsters) {
          if (monster.release > 0) { monster.release = Math.max(0, monster.release - dt); continue; }
          const speed = monster.returning ? 7 : (this.powerRemaining > 0 ? this.frightSpeed : this.monsterSpeed * monster.pace);
          this.move(monster, speed * dt, () => this.chooseMonsterDirection(monster), () => {
            if (monster.returning && monster.x === monster.home.x && monster.y === monster.home.y) {
              monster.returning = false; monster.release = 1.4; monster.direction = null;
              return false;
            }
          });
        }
        this.checkCollision();
      }
    }
  }

  const HIGH_SCORE_KEY = 'error404.maze.highScore.v1';
  const HIGH_SCORE_NAME_KEY = 'error404.maze.highScoreName.v1';
  function parseHighScore(value) {
    if (typeof value === 'string') {
      value = value.trim();
      if (!/^\d+$/.test(value)) return 0;
      value = Number(value);
    }
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
  }
  function normalizeNickname(value) {
    if (typeof value !== 'string') return '';
    const name = value.normalize('NFC').trim().replace(/\s+/g, ' ');
    return name.length > 0 && Array.from(name).length <= 16 && /^[\p{L}\p{N} ._'\-]+$/u.test(name) ? name : '';
  }
  class HighScoreRecord {
    constructor(storageProvider = () => null) {
      this.storageProvider = storageProvider;
      const saved = this.readEntry();
      this.best = saved.score; this.name = saved.name; this.runName = '';
      this.beginRun();
    }
    readEntry() {
      let score = 0, name = '';
      // The original numeric key remains unchanged. Name metadata is bound to
      // its exact score, so an old name cannot leak onto a newer record.
      try {
        const storage = this.storageProvider();
        score = parseHighScore(storage?.getItem(HIGH_SCORE_KEY));
        const raw = storage?.getItem(HIGH_SCORE_NAME_KEY);
        if (raw) {
          const entry = JSON.parse(raw);
          if (score > 0 && entry && parseHighScore(entry.score) === score) name = normalizeNickname(entry.name);
        }
      } catch (_) { /* Missing, malformed or blocked storage is non-fatal. */ }
      return { score, name };
    }
    read() { return this.readEntry().score; }
    refresh() {
      const saved = this.readEntry();
      if (saved.score > this.best) {
        this.best = saved.score; this.name = saved.name; this.runName = '';
      } else if (saved.score === this.best && saved.name) this.name = saved.name;
      return saved;
    }
    beginRun() {
      this.refresh();
      this.runBaseline = this.best; this.beatenThisRun = false; this.runName = '';
    }
    consider(score) {
      const candidate = parseHighScore(score);
      if (candidate <= this.best) return false;
      this.refresh();
      if (candidate <= this.best) return false;
      this.best = candidate; this.name = this.runName;
      this.beatenThisRun = candidate > this.runBaseline;
      try {
        const storage = this.storageProvider();
        storage?.setItem(HIGH_SCORE_KEY, String(candidate));
        if (this.name) storage?.setItem(HIGH_SCORE_NAME_KEY, JSON.stringify({ score: candidate, name: this.name }));
      } catch (_) { /* Keep scoring and the current name in memory. */ }
      return true;
    }
    saveName(value, expectedScore) {
      const name = normalizeNickname(value);
      if (!name) return { ok: false, reason: 'invalid-name' };
      const expected = parseHighScore(expectedScore);
      this.refresh();
      if (!expected || expected !== this.best) return { ok: false, reason: 'record-changed' };
      if (this.name) return { ok: false, reason: 'already-named' };
      let persisted = false;
      try {
        const storage = this.storageProvider();
        // Re-read immediately before writing: an open form may be stale.
        const latestScore = parseHighScore(storage?.getItem(HIGH_SCORE_KEY));
        let latestName = '';
        try {
          const latest = JSON.parse(storage?.getItem(HIGH_SCORE_NAME_KEY) || 'null');
          if (latest && parseHighScore(latest.score) === expected) latestName = normalizeNickname(latest.name);
        } catch (_) { /* Ignore malformed name metadata, preserve its score. */ }
        if (latestScore > expected) { this.refresh(); return { ok: false, reason: 'record-changed' }; }
        if (latestScore === expected && latestName) { this.refresh(); return { ok: false, reason: 'already-named' }; }
        if (storage) {
          // Only repairs an absent/lower score after a previously blocked write.
          if (latestScore < expected) storage.setItem(HIGH_SCORE_KEY, String(expected));
          storage.setItem(HIGH_SCORE_NAME_KEY, JSON.stringify({ score: expected, name }));
          persisted = true;
        }
      } catch (_) { /* The name remains usable for this page if storage is blocked. */ }
      this.name = name; this.runName = name;
      return { ok: true, persisted, name, score: expected };
    }
  }

  // Browser-local Top 10 only. No network, seeded scores, or online identity.
  const LEADERBOARD_KEY = 'error404.maze.leaderboard.v1';
  class LocalLeaderboard {
    constructor(storageProvider = () => null) {
      this.storageProvider = storageProvider;
      this.entries = [];
      this.seenIds = new Set();
      this.refresh();
    }
    validId(id) {
      return typeof id === 'string' && /^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/.test(id);
    }
    entry(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value) || !this.validId(value.id)) return null;
      const score = parseHighScore(value.score), name = normalizeNickname(value.name);
      if (!score || !Number.isSafeInteger(value.createdAt) || value.createdAt < 0) return null;
      const legacy = value.id.startsWith('legacy:');
      if (legacy && value.id !== `legacy:${score}`) return null;
      if (!name && !(legacy && value.name === '')) return null;
      return { id: value.id, name, score, createdAt: value.createdAt };
    }
    read() {
      try {
        const raw = this.storageProvider()?.getItem(LEADERBOARD_KEY);
        if (!raw) return { entries: [], seenIds: [] };
        const saved = JSON.parse(raw);
        if (!saved || saved.version !== 1 || !Array.isArray(saved.entries)) return { entries: [], seenIds: [] };
        const entries = saved.entries.map(value => this.entry(value)).filter(Boolean);
        const seenIds = Array.isArray(saved.seenIds) ? saved.seenIds.filter(id => this.validId(id)) : [];
        return { entries, seenIds };
      } catch (_) { return { entries: [], seenIds: [] }; }
    }
    merge(fresh) {
      const entries = new Map();
      // Fresh persisted data wins duplicate IDs. A valid named legacy record
      // may fill its matching unnamed copy, but never rename an existing one.
      for (const value of [...fresh.entries, ...this.entries]) {
        const existing = entries.get(value.id);
        if (!existing) entries.set(value.id, value);
        else if (value.id.startsWith('legacy:') && existing.score === value.score && !existing.name && value.name) {
          entries.set(value.id, { ...existing, name: value.name });
        }
      }
      for (const id of fresh.seenIds) this.seenIds.add(id);
      for (const id of entries.keys()) this.seenIds.add(id);
      this.entries = [...entries.values()].sort((a, b) => b.score - a.score || a.createdAt - b.createdAt || a.id.localeCompare(b.id)).slice(0, 5);   // Top 5 (2026-10-19)
    }
    refresh() {
      this.merge(this.read());
      return this.entries;
    }
    save() {
      // Reconcile immediately before writing; another tab may have submitted.
      this.merge(this.read());
      try {
        const storage = this.storageProvider();
        if (!storage) return false;
        storage.setItem(LEADERBOARD_KEY, JSON.stringify({ version: 1, entries: this.entries, seenIds: [...this.seenIds] }));
        return true;
      } catch (_) { return false; }
    }
    result(id, extra = {}) {
      const index = this.entries.findIndex(entry => entry.id === id);
      return { ok: true, ranked: index !== -1, rank: index === -1 ? null : index + 1, ...extra };
    }
    importLegacy(score, name = '') {
      score = parseHighScore(score);
      if (!score) return { ok: false, reason: 'invalid-score' };
      const normalized = normalizeNickname(name);
      if (name !== '' && !normalized) return { ok: false, reason: 'invalid-name' };
      const id = `legacy:${score}`;
      this.refresh();
      if (this.seenIds.has(id)) {
        const existing = this.entries.find(entry => entry.id === id);
        if (existing && !existing.name && normalized) return this.claimLegacy(score, normalized);
        const saved = this.read();
        return this.result(id, { duplicate: true, persisted: saved.seenIds.includes(id) || saved.entries.some(entry => entry.id === id) });
      }
      // A named submitted run already represents this numeric best on reload.
      // Remember the legacy alias too, even if that run later leaves Top 10.
      const represented = this.entries.find(entry => entry.score === score && (!normalized || entry.name === normalized));
      if (represented) {
        this.seenIds.add(id);
        const persisted = this.save();
        return this.result(represented.id, { duplicate: true, persisted });
      }
      this.entries.push({ id, name: normalized, score, createdAt: Date.now() });
      this.seenIds.add(id);
      const persisted = this.save();
      return this.result(id, { duplicate: false, persisted });
    }
    claimLegacy(score, name) {
      score = parseHighScore(score);
      const normalized = normalizeNickname(name);
      if (!score) return { ok: false, reason: 'invalid-score' };
      if (!normalized) return { ok: false, reason: 'invalid-name' };
      const id = `legacy:${score}`;
      this.refresh();
      const existing = this.entries.find(entry => entry.id === id);
      if (!existing) return { ok: false, reason: 'not-found' };
      if (existing.name) return { ok: false, reason: 'already-named' };
      existing.name = normalized;
      const persisted = this.save();
      // save() keeps a concurrently persisted name rather than overwriting it.
      const actual = this.entries.find(entry => entry.id === id);
      if (actual && actual.name !== normalized) return { ok: false, reason: 'already-named' };
      return this.result(id, { duplicate: false, persisted });
    }
    addRun(value) {
      if (!value || !this.validId(value.id) || value.id.startsWith('legacy:')) return { ok: false, reason: 'invalid-id' };
      const score = parseHighScore(value.score), name = normalizeNickname(value.name);
      if (!score) return { ok: false, reason: 'invalid-score' };
      if (!name) return { ok: false, reason: 'invalid-name' };
      this.refresh();
      if (this.seenIds.has(value.id)) {
        const saved = this.read();
        return this.result(value.id, { duplicate: true, persisted: saved.seenIds.includes(value.id) || saved.entries.some(entry => entry.id === value.id) });
      }
      this.entries.push({ id: value.id, name, score, createdAt: Date.now() });
      this.seenIds.add(value.id);
      const persisted = this.save();
      return this.result(value.id, { duplicate: false, persisted });
    }
  }


  function mount(doc) {
    const canvas = doc.getElementById('game-canvas');
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const game = new Game();
    const startAudio = window.Error404StartAudio;
    function stopStartAudio() { try { startAudio?.stop(); } catch (_) {} }
    const record = new HighScoreRecord(() => window.localStorage);
    const leaderboard = new LocalLeaderboard(() => window.localStorage);
    leaderboard.importLegacy(record.best, record.name);
    // Shared Top 10 for all visitors (404-scores.js). Falls back to the local list.
    const shared = window.Error404Scores && window.Error404Scores.enabled ? window.Error404Scores : null;
    let globalEntries = null;
    function applyGlobal(list) {
      if (!Array.isArray(list)) return;
      globalEntries = list; leaderboardSignature = ''; render();
    }
    function loadGlobal() { if (shared) shared.top().then(applyGlobal).catch(() => {}); }
    const makeRunId = () => `run:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    const board = doc.getElementById('board');
    const overlay = doc.getElementById('game-overlay');
    const overlayTitle = doc.getElementById('overlay-title');
    const overlayCopy = doc.getElementById('overlay-copy');
    const startButton = doc.getElementById('start-game');
    const touchPause = doc.getElementById('touch-pause');
    const score = doc.getElementById('score');
    const highScore = doc.getElementById('high-score');
    const highScoreName = doc.getElementById('high-score-name');
    const nameRow = doc.getElementById('high-score-name-row');
    const addNameButton = doc.getElementById('add-score-name');
    const nameForm = doc.getElementById('score-name-form');
    const nameInput = doc.getElementById('score-name-input');
    const nameError = doc.getElementById('score-name-error');
    const nameMessage = doc.getElementById('score-name-message');
    const closeNameButton = doc.getElementById('close-score-name');
    const nameCaption = doc.getElementById('score-name-caption');
    const submitRunButton = doc.getElementById('submit-run-score');
    const leaderboardList = doc.getElementById('leaderboard-list');
    const leaderboardEmpty = doc.getElementById('leaderboard-empty');
    const leaderboardFeedback = doc.getElementById('leaderboard-feedback');
    const lives = doc.getElementById('lives');
    const dots = doc.getElementById('dots');
    const status = doc.getElementById('game-status');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const logo = new Image();
    logo.src = '/assets/logo-red-original.png';
    const TILE = 28;
    let WIDTH = COLS * TILE, HEIGHT = ROWS * TILE, cellWidth = TILE, cellHeight = TILE, spriteScale = 1;
    const palette = { paper: '#000000', ink: '#f4f0e8', red: '#ff2929', muted: '#aaa8a2', wall: '#161616' };
    // Dots change colour every level (2026-10-12): white, yellow, turquoise,
    // green, orange, then the cycle repeats. Never red: red is the monsters.
    const DOT_COLORS = ['#f4f0e8', '#ffd400', '#2ee6d6', '#3ddc5a', '#ff9a1f'];
    const dotColor = () => DOT_COLORS[(game.level - 1) % DOT_COLORS.length];
    let lastTime = 0, frame = 0, lastPhase = '', lastStatus = '';
    let nameEditing = false, nameContext = null;
    let runId = makeRunId(), pendingRun = null, leaderboardSignature = '';
    const submittedRuns = new Set();
    const overlays = {
      ready: ['BEAT THE HIGH SCORE', 'YOU HAVE 3 LIVES. DON\'T GET CAUGHT.', 'START GAME'],
      paused: ['PAUSED', 'Your robot is safe. Ready when you are.', 'RESUME'],
      'life-lost': ['CAUGHT!', '', 'CONTINUE'],
      won: ['LEVEL CLEAR!', 'Every dot collected. Good company, great escape.', 'PLAY AGAIN'],
      gameover: ['GAME OVER', 'Three lives. More monsters every level. One more try?', 'TRY AGAIN']
    };
    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      WIDTH = canvas.clientWidth || COLS * TILE; HEIGHT = canvas.clientHeight || ROWS * TILE;
      cellWidth = WIDTH / COLS; cellHeight = HEIGHT / ROWS;
      spriteScale = Math.min(cellWidth, cellHeight) / TILE;
      canvas.width = Math.round(WIDTH * dpr); canvas.height = Math.round(HEIGHT * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.imageSmoothingEnabled = false;
      draw();
    }
    function drawWalls() {
      context.fillStyle = palette.wall;
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if (!walkable(x, y)) context.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
      }
      context.strokeStyle = palette.ink; context.lineWidth = 2 * spriteScale; context.beginPath();
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        if (walkable(x, y)) continue;
        const left = x * cellWidth, top = y * cellHeight;
        if (walkable(x - 1, y)) { context.moveTo(left, top); context.lineTo(left, top + cellHeight); }
        if (walkable(x + 1, y)) { context.moveTo(left + cellWidth, top); context.lineTo(left + cellWidth, top + cellHeight); }
        if (walkable(x, y - 1)) { context.moveTo(left, top); context.lineTo(left + cellWidth, top); }
        if (walkable(x, y + 1)) { context.moveTo(left, top + cellHeight); context.lineTo(left + cellWidth, top + cellHeight); }
      }
      context.stroke();
    }
    function drawMonster(monster) {
      const x = (monster.x + 0.5) * cellWidth, y = (monster.y + 0.5) * cellHeight;
      context.save(); context.translate(x - 11 * spriteScale, y - 11 * spriteScale); context.scale(spriteScale, spriteScale);
      const frightened = game.powerRemaining > 0 && !monster.returning;
      // 2026-10-12: monster is red, the player is white. A frightened monster
      // turns grey and blinks white in the last two seconds of power.
      const blink = frightened && game.powerRemaining < 2 && Math.floor(game.powerRemaining * 5) % 2 === 0;
      if (!monster.returning) {
        context.fillStyle = frightened ? (blink ? palette.ink : palette.muted) : palette.red;
        context.beginPath(); context.moveTo(5, 0); context.lineTo(17, 0); context.lineTo(17, 3);
        context.lineTo(20, 3); context.lineTo(20, 7); context.lineTo(23, 7); context.lineTo(23, 23);
        context.lineTo(18, 23); context.lineTo(18, 20); context.lineTo(14, 20); context.lineTo(14, 23);
        context.lineTo(9, 23); context.lineTo(9, 20); context.lineTo(5, 20); context.lineTo(5, 23);
        context.lineTo(0, 23); context.lineTo(0, 7); context.lineTo(3, 7); context.lineTo(3, 3);
        context.lineTo(5, 3); context.closePath(); context.fill();
      }
      context.fillStyle = frightened ? palette.paper : palette.ink;
      context.fillRect(5, 7, 5, 6); context.fillRect(14, 7, 5, 6);
      context.fillStyle = frightened ? palette.ink : palette.paper;
      const d = DIRECTIONS[monster.direction] || { x: 0, y: 0 };
      context.fillRect(6 + d.x, 9 + d.y, 2, 3); context.fillRect(15 + d.x, 9 + d.y, 2, 3);
      if (frightened) { context.fillStyle = palette.paper; context.fillRect(6, 16, 3, 2); context.fillRect(9, 14, 3, 2); context.fillRect(12, 16, 3, 2); context.fillRect(15, 14, 3, 2); }
      context.restore();
    }
    // The player: the robot head from the logo, solid white with black eyes and
    // mouth (2026-10-12). Made from the logo crop (1594,602,667,589), 120x106 px.
    const whiteRobot = new Image();
    whiteRobot.src = 'data:image/png;base64,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';
    whiteRobot.addEventListener('load', () => draw());
    function playerSprite() { return whiteRobot.complete && whiteRobot.naturalWidth ? whiteRobot : null; }
    // While power is on, the bottom wall row explains it and counts it down.
    function drawPowerBanner() {
      const top = (ROWS - 1) * cellHeight + 2, height = cellHeight - 2;
      context.fillStyle = palette.paper; context.fillRect(0, top, WIDTH, height);
      context.fillStyle = palette.ink;
      context.font = `${Math.max(9, Math.round(cellHeight * 0.5))}px Silkscreen, monospace`;
      context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillText(game.monsters.length > 1 ? 'POWER! CATCH THE MONSTERS' : 'POWER! CATCH THE MONSTER', WIDTH / 2, top + height / 2 - 1);
      context.fillRect(0, HEIGHT - 3, WIDTH * Math.min(1, game.powerRemaining / game.powerDuration), 3);
    }
    // Otherwise the same row names the current level.
    function drawLevelLabel() {
      const top = (ROWS - 1) * cellHeight + 2, height = cellHeight - 2;
      context.fillStyle = dotColor();
      context.font = `${Math.max(9, Math.round(cellHeight * 0.5))}px Silkscreen, monospace`;
      context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillText(`LEVEL ${game.level}`, WIDTH / 2, top + height / 2 - 1);
    }
    function draw() {
      context.clearRect(0, 0, WIDTH, HEIGHT); context.fillStyle = palette.paper; context.fillRect(0, 0, WIDTH, HEIGHT);
      drawWalls();
      context.fillStyle = dotColor();
      for (const [id, value] of game.pellets) {
        const x = (id % COLS + 0.5) * cellWidth, y = (Math.floor(id / COLS) + 0.5) * cellHeight;
        const size = (value === 50 ? 8 : 3) * spriteScale;
        context.fillRect(x - size / 2, y - size / 2, size, size);
      }
      for (const monster of game.monsters) drawMonster(monster);
      const px = (game.player.x + 0.5) * cellWidth, py = (game.player.y + 0.5) * cellHeight;
      const sprite = playerSprite();
      if (sprite) { context.imageSmoothingEnabled = true; context.drawImage(sprite, px - 12 * spriteScale, py - 10.5967 * spriteScale, 24 * spriteScale, 21.1934 * spriteScale); context.imageSmoothingEnabled = false; }
      else { context.fillStyle = palette.ink; context.fillRect(px - 9 * spriteScale, py - 9 * spriteScale, 18 * spriteScale, 18 * spriteScale); }
      if (game.powerRemaining > 0 && ['playing', 'paused'].includes(game.phase)) drawPowerBanner();
      else drawLevelLabel();
      drawLives();
    }
    // 2026-10-19 (Matúš): three small robots = three lives, bottom-left of the board; lost = red X.
    // Red pixel X over a lost life (stair-stepped, matches the pixel font).
    function drawCross(x, y, w, h) {
      const n = 8, cs = Math.max(1, Math.round(Math.min(w, h) / n)), ox = Math.round(x + (w - cs * n) / 2), oy = Math.round(y + (h - cs * n) / 2);
      context.fillStyle = palette.red;
      for (let k = 0; k < n - 1; k++) { context.fillRect(ox + k * cs, oy + k * cs, 2 * cs, 2 * cs); context.fillRect(ox + (n - 2 - k) * cs, oy + k * cs, 2 * cs, 2 * cs); }
    }
    function drawLives() {
      const top = (ROWS - 1) * cellHeight + 2, height = cellHeight - 2, sprite = playerSprite();
      const h = Math.round(height * 0.62), w = Math.round(h * 24 / 21.19), gap = Math.round(w * 0.45);
      let x = Math.round(cellWidth * 0.6);
      context.font = `${Math.max(9, Math.round(cellHeight * 0.5))}px Silkscreen, monospace`;
      context.textAlign = 'left'; context.textBaseline = 'middle'; context.fillStyle = palette.ink;
      context.fillText('LIVES', x, top + height / 2 - 1);
      x += Math.ceil(context.measureText('LIVES').width) + gap;
      const blinkLost = game.phase === 'life-lost' && Math.floor(performance.now() / 300) % 2 === 0;
      for (let i = 0; i < 3; i++) {
        const alive = i < game.lives;
        const y = top + (height - h) / 2;
        context.globalAlpha = alive ? 1 : 0.35;
        if (sprite) context.drawImage(sprite, x, y, w, h);
        context.globalAlpha = 1;
        if (!alive && !(i === game.lives && blinkLost)) drawCross(x, y, w, h);
        x += w + gap;
      }
    }
    function renderLeaderboard() {
      const entries = globalEntries || leaderboard.entries;
      const signature = JSON.stringify(entries);
      if (signature === leaderboardSignature) return;
      leaderboardSignature = signature;
      leaderboardList.replaceChildren();
      entries.forEach((entry, index) => {
        const row = doc.createElement('li'); row.className = 'leaderboard-row';
        for (const [className, text] of [
          ['leaderboard-rank', String(index + 1).padStart(2, '0')],
          ['leaderboard-name', entry.name || 'UNNAMED'],
          ['leaderboard-score', String(entry.score).padStart(5, '0')]
        ]) {
          const cell = doc.createElement('span'); cell.className = className; cell.textContent = text;
          row.append(cell);
        }
        leaderboardList.append(row);
      });
      leaderboardEmpty.hidden = entries.length > 0;
    }
    function updateUI() {
      if (touchPause) { touchPause.textContent = game.phase === 'paused' ? 'RESUME' : 'PAUSE'; touchPause.disabled = !['playing', 'paused'].includes(game.phase); }
      record.consider(game.score);
      const globalTop = globalEntries && globalEntries[0];
      const showGlobalTop = !!globalTop && globalTop.score >= record.best;
      highScore.textContent = String(showGlobalTop ? globalTop.score : record.best).padStart(5, '0');
      const legacy = leaderboard.entries.find(entry => entry.id === `legacy:${record.best}`);
      const representedBest = legacy || leaderboard.entries.find(entry => entry.score === record.best);
      const bestName = showGlobalTop ? globalTop.name : (record.name || representedBest?.name || '');
      highScoreName.textContent = bestName;
      highScoreName.hidden = !bestName;
      const currentRunOwnsRecord = record.beatenThisRun && game.score === record.best && game.phase !== 'ready';
      addNameButton.hidden = !!shared || record.best <= 0 || !!bestName || currentRunOwnsRecord;
      if (['won', 'gameover'].includes(game.phase) && game.score > 0 && !submittedRuns.has(runId)) {
        pendingRun = { id: runId, score: game.score, duration: Math.round(game.elapsed) };
      }
      submitRunButton.hidden = nameEditing || !pendingRun || submittedRuns.has(pendingRun.id);
      nameRow.hidden = nameEditing;
      nameForm.hidden = !nameEditing;
      renderLeaderboard();
      score.textContent = String(game.score).padStart(5, '0');
      lives.textContent = String(game.lives);
      dots.textContent = String(game.pellets.size);
      const endedWithRecord = record.beatenThisRun && game.score >= record.best && ['won', 'gameover'].includes(game.phase);
      const stateText = endedWithRecord
        ? `New high score: ${record.best} points. ${game.phase === 'won' ? 'Level clear.' : 'Game over.'}`
        : game.phase === 'playing'
        ? game.powerRemaining > 0 ? (game.monsters.length > 1 ? 'POWER ON — CATCH THE MONSTERS' : 'POWER ON — CATCH THE MONSTER') : 'RUN. COLLECT. KEEP GOING.'
        : game.phase === 'ready' ? 'Game ready.'
        : game.phase === 'life-lost' ? `${game.lives} LIVES LEFT`
        : game.phase === 'level-clear' ? `Level ${game.level} clear. ${game.score} points.` : overlays[game.phase]?.[0] || '';
      if (stateText !== lastStatus) { status.textContent = stateText; lastStatus = stateText; }
      if (lastPhase !== game.phase) {
        lastPhase = game.phase;
        if (game.phase !== 'playing') stopStartAudio();
        let data = overlays[game.phase];
        if (game.phase === 'level-clear') {
          const next = game.level + 1;
          const news = next === 2 ? 'a second monster joins' : next === 3 ? 'a third monster joins' : 'faster monsters and shorter power';
          data = [`LEVEL ${game.level} CLEAR!`, `Level ${next}: ${news}. Your score and lives stay.`, 'NEXT LEVEL'];
        }
        if (endedWithRecord) {
          const points = `${game.score.toLocaleString('en-US')} POINTS.`;
          data = ['NEW HIGH SCORE', game.phase === 'won' ? `LEVEL CLEAR. ${points}` : `${points} BEAT IT AGAIN.`, data[2]];
        }
        overlay.hidden = !data;
        board.dataset.phase = game.phase;
        if (data) {
          overlayTitle.textContent = data[0]; overlayTitle.hidden = !data[0];
          overlayCopy.textContent = data[1]; overlayCopy.hidden = !data[1];
          if (game.phase === 'life-lost') { overlayCopy.textContent = game.lives === 1 ? 'LAST LIFE! The dots and your score stay.' : `${game.lives} LIVES LEFT. The dots and your score stay.`; overlayCopy.hidden = false; }
          const row = doc.getElementById('life-row');
          if (row) { row.hidden = !['ready', 'life-lost', 'gameover'].includes(game.phase); const X = '<svg class="x" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">' + [0,1,2,3,4,5,6].map(k => `<rect x="${k}" y="${k}" width="2" height="2"/><rect x="${6 - k}" y="${k}" width="2" height="2"/>`).join('') + '</svg>';
            row.innerHTML = [0, 1, 2].map(i => `<span class="life${i < game.lives ? '' : ' lost'}${i === game.lives && game.phase === 'life-lost' ? ' just-lost' : ''}"><img src="${whiteRobot.src}" alt="">${i < game.lives ? '' : X}</span>`).join(''); }
          startButton.textContent = data[2];
          if (['life-lost', 'level-clear', 'won', 'gameover'].includes(game.phase)) startButton.focus({ preventScroll: true });
        }
        // Offer every completed scoring run a name, including runs below the
        // record. The phase is already recorded, so nested renders cannot
        // reopen the form after saving or dismissing it.
        if (['won', 'gameover'].includes(game.phase)) {
          if (pendingRun && !nameEditing) openNameEntry('run');
          else if (game.score === 0) {
            const finishedRun = runId;
            setTimeout(() => {
              if (runId === finishedRun && game.phase === 'gameover' && !doc.hidden) start();
            }, 1800);
          }
        }
      }
    }
    function render() { updateUI(); draw(); }
    function tick(now) {
      if (game.phase === 'playing') {
        if (lastTime) game.update(Math.min((now - lastTime) / 1000, 0.05));
        render();
      }
      lastTime = now; frame = requestAnimationFrame(tick);
    }
    function focusBoard() { canvas.focus({ preventScroll: true }); }
    function start(explicitStart = false) {
      const finished = ['won', 'gameover'].includes(game.phase);
      const newRun = ['ready', 'won', 'gameover'].includes(game.phase);
      if (nameEditing) closeNameEntry(false);
      if (newRun) {
        record.beginRun(); runId = makeRunId(); pendingRun = null; leaderboardFeedback.hidden = true; loadGlobal();
      }
      game.start(); render(); focusBoard();
      if (explicitStart && newRun) {
        try { startAudio?.playForRun(runId); } catch (_) {}
      }
      if (finished && matchMedia('(max-width: 760px)').matches) board.scrollIntoView({block:'start',behavior:'smooth'});
    }
    function togglePause() {
      if (nameEditing) closeNameEntry(false);
      if (game.phase === 'playing') game.pause(); else if (game.phase === 'paused') game.start();
      render(); if (game.phase === 'playing') focusBoard();
    }
    function closeNameEntry(restoreFocus = true) {
      nameEditing = false; nameContext = null; nameInput.value = ''; nameError.hidden = true;
      nameInput.removeAttribute('aria-invalid'); render();
      if (restoreFocus) {
        if (!submitRunButton.hidden) submitRunButton.focus({ preventScroll: true });
        else if (!addNameButton.hidden) addNameButton.focus({ preventScroll: true });
        else if (!overlay.hidden) startButton.focus({ preventScroll: true });
      }
    }
    function openNameEntry(kind = 'legacy') {
      game.pause(); record.refresh(); leaderboard.refresh(); render();
      if (kind === 'run') {
        if (!pendingRun || submittedRuns.has(pendingRun.id)) return;
        nameContext = { kind, ...pendingRun };
      } else {
        const entry = leaderboard.entries.find(row => row.id === `legacy:${record.best}`)
          || leaderboard.entries.find(row => row.score === record.best);
        if (record.best <= 0 || record.name || entry?.name) return;
        nameContext = { kind, id: `legacy:${record.best}`, score: record.best };
      }
      nameEditing = true; nameInput.value = kind === 'run' ? record.runName : '';
      nameCaption.textContent = `YOUR SCORE ${String(nameContext.score).padStart(5, '0')}`;
      nameError.hidden = true; nameMessage.textContent = '';
      nameInput.removeAttribute('aria-invalid'); render();
      nameInput.focus({ preventScroll: true });
      if (matchMedia('(max-width: 760px)').matches) nameForm.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    addNameButton.addEventListener('click', () => openNameEntry('legacy'));
    submitRunButton.addEventListener('click', () => openNameEntry('run'));
    function skipNameEntry() {
      const replay = nameContext?.kind === 'run' && ['won', 'gameover'].includes(game.phase);
      closeNameEntry();
      if (replay) start();
    }
    closeNameButton.addEventListener('click', skipNameEntry);
    nameForm.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); skipNameEntry(); }
    });
    nameForm.addEventListener('submit', event => {
      event.preventDefault();
      if (!nameEditing || !nameContext) return;
      const context = { ...nameContext };
      const name = normalizeNickname(nameInput.value);
      let result;
      if (context.kind === 'run') {
        result = leaderboard.addRun({ id: context.id, score: context.score, name });
        if (result.ok) {
          submittedRuns.add(context.id);
          record.refresh();
          if (record.best === context.score && !record.name) record.saveName(name, context.score);
        }
      } else {
        const existing = leaderboard.refresh().find(entry => entry.id === context.id);
        result = existing?.name ? { ok: false, reason: 'already-named' } : record.saveName(name, context.score);
        if (result.ok) result = leaderboard.claimLegacy(context.score, name);
      }
      if (!result.ok) {
        nameError.textContent = result.reason === 'invalid-name'
          ? 'Use 1–16 letters, numbers, spaces, or . _ - and apostrophes.'
          : 'This record changed or already has a name. Close and try again.';
        nameError.hidden = false; nameInput.setAttribute('aria-invalid', 'true');
        render(); nameInput.focus({ preventScroll: true }); return;
      }
      leaderboardFeedback.textContent = result.ranked === false ? 'OUTSIDE TOP FIVE. GO AGAIN.'
        : result.persisted ? (result.rank ? `SAVED. RANK #${result.rank}.` : 'SCORE SAVED.') : 'SAVED FOR THIS SESSION.';
      leaderboardFeedback.hidden = false;
      nameMessage.textContent = result.ranked === false ? 'Your score is outside the top five. Try again!'
        : result.persisted ? 'Your score and name are saved.' : 'Saved for this page. Browser storage is unavailable.';
      if (shared && context.kind === 'run') {
        leaderboardFeedback.textContent = 'SAVING…'; leaderboardFeedback.hidden = false;
        shared.submit({ id: context.id, name, score: context.score, duration: context.duration || 0 }).then(response => {
          if (response.entries) applyGlobal(response.entries);
          leaderboardFeedback.textContent = !response.ok ? 'SAVED ON THIS DEVICE ONLY.'
            : response.rank && response.rank <= 5 ? `SAVED. RANK #${response.rank}.` : 'OUTSIDE TOP FIVE. GO AGAIN.';
          nameMessage.textContent = response.ok && response.rank && response.rank <= 5 ? `Your score is number ${response.rank} of all players.` : leaderboardFeedback.textContent;
        }).catch(() => {
          leaderboardFeedback.textContent = 'OFFLINE. SAVED ON THIS DEVICE.';
        });
      }
      closeNameEntry();
      if (context.kind === 'run' && ['won', 'gameover'].includes(game.phase)) start();
    });
    startButton.addEventListener('click', () => start(true));
    for (const direction of ['up', 'left', 'right', 'down']) {
      const button = doc.getElementById(`touch-${direction}`);
      if (!button) continue;
      // Keep focus on the canvas, so a touch direction does not pause the game.
      button.addEventListener('pointerdown', event => event.preventDefault());
      button.addEventListener('click', () => {
        if (nameEditing) return;
        if (['ready', 'paused', 'life-lost', 'level-clear'].includes(game.phase)) start(true);
        game.queueTurn(direction); render(); focusBoard();
      });
    }
    if (touchPause) {
      touchPause.addEventListener('pointerdown', event => event.preventDefault());
      touchPause.addEventListener('click', togglePause);
    }
    canvas.addEventListener('pointerdown', focusBoard);
    canvas.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const control = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', W: 'up', a: 'left', A: 'left', s: 'down', S: 'down', d: 'right', D: 'right' }[event.key];
      if (control) { event.preventDefault(); game.queueTurn(control); }
      else if (['p', 'P', 'Escape'].includes(event.key)) { event.preventDefault(); if (!event.repeat) togglePause(); }
      else if (['Enter', ' '].includes(event.key) && game.phase !== 'playing') { event.preventDefault(); start(true); }
    });
    // Tab remains native. Leaving the active board pauses instead of losing a life.
    canvas.addEventListener('blur', () => { if (game.phase === 'playing') { game.pause(); render(); } });
    doc.addEventListener('visibilitychange', () => { if (doc.hidden) { game.pause(); lastTime = 0; render(); } });
    window.addEventListener('blur', () => { game.pause(); lastTime = 0; render(); });
    window.addEventListener('resize', resize);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(board);
    window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); frame = 0; game.pause(); stopStartAudio(); });
    window.addEventListener('pageshow', () => { lastTime = 0; render(); if (!frame) frame = requestAnimationFrame(tick); });
    logo.addEventListener('load', draw);
    resize(); render(); frame = requestAnimationFrame(tick);
    loadGlobal();
    // Readable local diagnostics for browser QA; the engine is also Node-testable.
    window.error404Game = game;
    window.error404HighScore = record;
    window.error404Leaderboard = leaderboard;
  }
  return { Game, MAZE, COLS, ROWS, DIRECTIONS, PLAYER_START, MONSTER_START, MONSTER_SETUP, walkable, canMove, centered, distancesFrom, HIGH_SCORE_KEY, HIGH_SCORE_NAME_KEY, parseHighScore, normalizeNickname, HighScoreRecord, LEADERBOARD_KEY, LocalLeaderboard, mount };
});
