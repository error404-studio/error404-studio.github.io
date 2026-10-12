/* Only the Let's play cue was approved by Matúš on 2026-09-28.
   Lazy audio: loading this script never fetches, resumes, or plays audio. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.Error404StartAudio = factory(root);
})(typeof window === 'object' ? window : globalThis, function (env) {
  'use strict';
  const URL = '/preview-media/sounds-v1/start.wav';
  const VOLUME = 0.45;
  let context, bufferTask, active = null, generation = 0, lastRun = null;

  function stop() {
    generation++;
    const playing = active;
    active = null;
    if (!playing) return;
    try {
      const now = context.currentTime;
      playing.gain.gain.cancelScheduledValues(now);
      playing.gain.gain.setValueAtTime(playing.gain.gain.value, now);
      playing.gain.gain.linearRampToValueAtTime(0, now + 0.015);
      playing.source.stop(now + 0.02);
    } catch (_) {
      try { playing.source.stop(); } catch (_) {}
      try { playing.source.disconnect(); playing.gain.disconnect(); } catch (_) {}
    }
  }

  function loadBuffer() {
    if (!bufferTask) {
      bufferTask = env.fetch(URL).then(response => {
        if (!response.ok) throw new Error('Start cue unavailable');
        return response.arrayBuffer();
      }).then(data => context.decodeAudioData(data)).catch(error => {
        bufferTask = null;
        throw error;
      });
    }
    return bufferTask;
  }

  function playForRun(runId) {
    if (!runId || runId === lastRun || env.document?.hidden) return;
    lastRun = runId;
    stop();
    const run = generation;
    try {
      if (!context) {
        const Audio = env.AudioContext || env.webkitAudioContext;
        if (!Audio) return;
        context = new Audio();
      }
      // Called synchronously from a start gesture so mobile browsers can unlock.
      const resumed = context.resume();
      Promise.all([resumed, loadBuffer()]).then(([, buffer]) => {
        if (run !== generation || env.document?.hidden || context.state !== 'running') return;
        const source = context.createBufferSource();
        const gain = context.createGain();
        gain.gain.value = VOLUME;
        source.buffer = buffer;
        source.connect(gain); gain.connect(context.destination);
        const playing = { source, gain };
        source.onended = () => {
          source.disconnect(); gain.disconnect();
          if (active === playing) active = null;
        };
        active = playing;
        source.start();
      }).catch(() => { /* Sound is optional; gameplay always continues. */ });
    } catch (_) { /* Unsupported or blocked audio must not affect the game. */ }
  }
  return { playForRun, stop };
});
