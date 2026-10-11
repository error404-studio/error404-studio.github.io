(() => {
  'use strict';
  const art = document.querySelector('#art');
  const logoWindow = art?.querySelector('.logo-window');
  const logo = document.querySelector('#hero-logo');
  const site = document.querySelector('#site');
  const dialog = document.querySelector('#content-dialog');
  if (!art || !logoWindow || !logo || !site || logoWindow.querySelector('.robot-tongue')) return;

  // Measured against the unchanged 3843 x 2163 PNG. The site shows its
  // (1343, 602, 1171, 919) crop. Tongue origin: source (1868, 1068).
  const ns = 'http://www.w3.org/2000/svg';
  const tongue = document.createElementNS(ns, 'svg');
  tongue.classList.add('robot-tongue');
  tongue.setAttribute('viewBox', '0 0 120 144');
  tongue.setAttribute('aria-hidden', 'true');
  tongue.setAttribute('focusable', 'false');
  tongue.setAttribute('shape-rendering', 'crispEdges');
  for (const [fill, d] of [
    ['#ff0404', 'M0 0H120V120H104V144H16V120H0Z']
  ]) {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('fill', fill);
    path.setAttribute('d', d);
    tongue.append(path);
  }
  logoWindow.append(tongue);

  // Copy the existing square eye exactly, preserving its edge pixels and color.
  // Source crop (1758, 863, 90, 90), translated 225 source pixels to the right.
  // The X is clipped from the displayed image only while this copy is visible.
  const squareEye = document.createElementNS(ns, 'svg');
  squareEye.classList.add('robot-square-eye');
  squareEye.setAttribute('viewBox', '0 0 90 90');
  squareEye.setAttribute('aria-hidden', 'true');
  squareEye.setAttribute('focusable', 'false');
  const eyeImage = document.createElementNS(ns, 'image');
  eyeImage.setAttribute('href', logo.getAttribute('src'));
  eyeImage.setAttribute('x', '-1758');
  eyeImage.setAttribute('y', '-863');
  eyeImage.setAttribute('width', '3843');
  eyeImage.setAttribute('height', '2163');
  squareEye.append(eyeImage);
  logoWindow.append(squareEye);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let pending = null, settleTimer = 0, hideTimer = 0;
  let quietUntil = performance.now() + (art.classList.contains('ready') ? 500 : 3700);
  const still = () => reduced.matches || document.body.classList.contains('motion-off');
  const ready = () => art.isConnected && art.classList.contains('ready') &&
    !site.classList.contains('intro-composing') && !dialog?.open &&
    !document.hidden && logo.complete && logo.naturalWidth > 0 &&
    (still() || performance.now() >= quietUntil);

  function hide(dropPending = true) {
    clearTimeout(settleTimer);
    clearTimeout(hideTimer);
    settleTimer = hideTimer = 0;
    tongue.classList.remove('robot-tongue-playing', 'robot-tongue-still');
    logoWindow.classList.remove('robot-eye-square');
    if (dropPending) pending = null;
    art.dataset.tongueState = pending ? 'pending' : 'idle';
  }

  function show() {
    hide();
    const staticFeedback = still();
    tongue.classList.add(staticFeedback ? 'robot-tongue-still' : 'robot-tongue-playing');
    logoWindow.classList.add('robot-eye-square');
    art.dataset.tongueState = staticFeedback ? 'still' : 'playing';
    // The timer is also a fallback if animationend is suppressed by the browser.
    hideTimer = setTimeout(() => hide(), staticFeedback ? 550 : 800);
  }

  function flush() {
    if (!pending || settleTimer) return;
    if (!art.isConnected || dialog?.open || document.hidden) { hide(); return; }
    // Only a pending gesture checks readiness. No observer or idle polling:
    // app.js writes art's ready class on every frame after the intro.
    settleTimer = setTimeout(() => {
      settleTimer = 0;
      if (pending && ready()) show(); else flush();
    }, 100);
  }

  function request(kind) {
    if (dialog?.open || document.hidden) return;
    if (kind !== 'click' && tongue.classList.contains('robot-tongue-playing')) return;
    pending = kind;
    art.dataset.tongueState = 'pending';
    flush();
  }

  art.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'touch') request('hover');
  });
  art.addEventListener('pointerleave', () => { if (pending === 'hover') hide(); });
  art.addEventListener('focus', () => request('focus'));
  art.addEventListener('blur', () => { if (pending === 'focus') hide(); });
  // app.js's existing click listener still performs replay. This listener is
  // installed later; it queues the tongue without preventing or replacing replay.
  art.addEventListener('click', () => request('click'));

  tongue.addEventListener('animationend', event => {
    if (event.animationName === 'robot-tongue-out') hide();
  });
  window.addEventListener('introreplay', () => {
    hide(false);
    // Logo particles finish at 3.6 s; ready is already set around 3.1 s.
    quietUntil = performance.now() + 3700;
    flush();
  });
  window.addEventListener('introcomplete', flush);
  window.addEventListener('sectionchange', () => hide());
  window.addEventListener('motionchange', () => hide());
  window.addEventListener('pagehide', () => hide());
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
  reduced.addEventListener('change', () => hide());

  logo.addEventListener('load', flush);
  logo.addEventListener('error', () => hide());
  art.dataset.tongueState = 'idle';
})();
