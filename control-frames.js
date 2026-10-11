/* Local preview, 2026-09-28: the user's current control-frame direction.
 * Replace nav-text.js with this script; keep the existing text and controls.
 */
(() => {
  'use strict';
  const site = document.querySelector('#site');
  const dialog = document.querySelector('#content-dialog');
  if (!site) return;

  const ns = 'http://www.w3.org/2000/svg';
  const selector = 'nav a[href],#close-panel,#back-panel,#replay,#motion,#panel-motion,.profile-links a[href],.contact-links a[href],.portfolio-retry,.project-title,.home';
  const excluded = '#art,#slogan,.project-play,.contact-email,[data-no-text-pixels]';
  const states = new Map();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const padding = 7, step = 3, halfStroke = .75;
  let pending = 0;

  function hide(state) {
    state.control.classList.remove('control-frame-active');
  }

  function visible(control) {
    return control.isConnected && !control.disabled && !document.hidden &&
      control.getClientRects().length > 0 &&
      (!dialog || (dialog.open ? dialog.contains(control) : !dialog.contains(control))); 
  }

  function measure(state) {
    const { control, svg, path } = state;
    if (!visible(control)) return false;
    const box = control.getBoundingClientRect();
    const style = getComputedStyle(control);
    const walker = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
    let node, left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim() || svg.contains(node)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (!rect.width || !rect.height) continue;
        left = Math.min(left, rect.left); top = Math.min(top, rect.top);
        right = Math.max(right, rect.right); bottom = Math.max(bottom, rect.bottom);
      }
    }
    if (!Number.isFinite(left)) return false;
    const width = right - left + 2 * padding;
    const height = bottom - top + 2 * padding;
    const f = value => Number(value.toFixed(3));
    const x = halfStroke, y = halfStroke;
    const r = f(width - halfStroke), b = f(height - halfStroke);
    // Clockwise, two 3px square steps per corner, measured in actual CSS pixels.
    const d = `M${x + 2 * step} ${y}H${f(r - 2 * step)}V${y + step}H${f(r - step)}V${y + 2 * step}H${r}V${f(b - 2 * step)}H${f(r - step)}V${f(b - step)}H${f(r - 2 * step)}V${b}H${x + 2 * step}V${f(b - step)}H${x + step}V${f(b - 2 * step)}H${x}V${y + 2 * step}H${x + step}V${y + step}H${x + 2 * step}Z`;
    svg.setAttribute('viewBox', `0 0 ${f(width)} ${f(height)}`);
    svg.style.width = `${f(width)}px`;
    svg.style.height = `${f(height)}px`;
    svg.style.left = `${f(left - box.left - padding - parseFloat(style.borderLeftWidth))}px`;
    svg.style.top = `${f(top - box.top - padding - parseFloat(style.borderTopWidth))}px`;
    path.setAttribute('d', d);
    return true;
  }

  function sync(state) {
    const active = visible(state.control) &&
      (state.hovered || state.control.matches(':focus-visible'));
    if (!active || !measure(state)) { hide(state); return; }
    state.control.classList.add('control-frame-active');
  }

  const sizeObserver = new ResizeObserver(() => schedule());

  function register() {
    for (const [control, state] of states) {
      if (control.isConnected) continue;
      hide(state); sizeObserver.unobserve(control); states.delete(control);
    }
    for (const control of site.querySelectorAll(selector)) {
      if (control.matches(excluded)) continue;
      const registered = states.get(control);
      if (registered) {
        // The app updates PAUSE/PLAY with textContent, which replaces child nodes.
        if (!control.contains(registered.svg)) control.append(registered.svg);
        continue;
      }
      const svg = document.createElementNS(ns, 'svg');
      const path = document.createElementNS(ns, 'path');
      svg.setAttribute('class', 'control-hover-frame');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      path.setAttribute('pathLength', '1');
      svg.append(path);
      // Preserve the pre-existing border's space while removing its underline.
      control.style.setProperty('--control-frame-bottom-width', getComputedStyle(control).borderBottomWidth);
      control.classList.add('control-frame-host', 'pixel-text-control');
      control.append(svg);
      const state = { control, svg, path, hovered: false };
      states.set(control, state);
      sizeObserver.observe(control);

      // #replay alone has legacy direct-emit listeners in app.js. Capture only
      // those two target events; clicks, keyboard actions and other controls stay intact.
      const legacyReplay = control.id === 'replay';
      control.addEventListener('pointerenter', event => {
        state.hovered = event.pointerType !== 'touch';
        sync(state);
        if (legacyReplay) event.stopImmediatePropagation();
      }, legacyReplay);
      control.addEventListener('pointerleave', () => { state.hovered = false; sync(state); });
      control.addEventListener('pointercancel', () => { state.hovered = false; sync(state); });
      control.addEventListener('focus', event => {
        sync(state);
        if (legacyReplay) event.stopImmediatePropagation();
      }, legacyReplay);
      control.addEventListener('blur', () => sync(state));
    }
  }

  function refresh() {
    pending = 0;
    register();
    states.forEach(sync);
  }

  function schedule() {
    if (!pending) pending = requestAnimationFrame(refresh);
  }

  function clear() {
    states.forEach(state => { state.hovered = false; hide(state); });
  }

  // No document-wide hover/pointer handler; dynamic controls get local listeners.
  new MutationObserver(schedule).observe(site, { childList: true, subtree: true, characterData: true });
  if (dialog) new MutationObserver(schedule).observe(dialog, { attributes: true, attributeFilter: ['open'] });
  for (const event of ['sectionopened', 'textcontrolsupdated']) {
    window.addEventListener(event, () => { register(); schedule(); });
  }
  for (const event of ['resize', 'motionchange', 'introcomplete']) window.addEventListener(event, schedule);
  for (const event of ['sectionchange', 'introreplay']) window.addEventListener(event, clear);
  dialog?.addEventListener('close', () => { clear(); schedule(); });
  reduced.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); else schedule(); });
  document.fonts.ready.then(schedule);
  document.fonts.addEventListener('loadingdone', schedule);
  refresh();
})();
