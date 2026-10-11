(() => {
  'use strict';
  const dialog = document.querySelector('#content-dialog');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let cleanup = () => {};

  function mount() {
    cleanup();
    const box = dialog.querySelector('.contact-pacman');
    if (!box) return;
    const subtitle = dialog.querySelector('.contact-subtitle');
    const intro = dialog.querySelector('.contact-intro');
    const canvas = box.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    let width = 0, height = 0, points = [], food = [], perimeter = 1;
    let entry = [], entryPoints = [], entryFood = [], entryLength = 0;
    let canvasLeft = 0, canvasTop = 0, canvasWidth = 0, canvasHeight = 0;
    let elapsed = 0, travelled = 0, previous = 0, frame = 0, visible = true;
    let hasLayout = false, active = true;
    let margin = 16, pacScale = 1;
    const pitch = 23, speed = 80;
    const random = n => {const r = Math.sin(n * 127.1 + 311.7) * 43758.5453; return r - Math.floor(r);};
    const isStill = () => reduced.matches || document.body.classList.contains('motion-off');

    // Counterclockwise route, including the four corners exactly once.
    function pointAt(distance) {
      const w = width - margin * 2, h = height - margin * 2;
      let d = ((distance % perimeter) + perimeter) % perimeter;
      if (d < h) return {x:margin, y:margin + d, angle:Math.PI / 2};
      d -= h;
      if (d < w) return {x:margin + d, y:height - margin, angle:0};
      d -= w;
      if (d < h) return {x:width - margin, y:height - margin - d, angle:-Math.PI / 2};
      return {x:width - margin - (d - h), y:margin, angle:Math.PI};
    }

    // Latest user correction: travel only on horizontal/vertical game-like legs.
    // The one-time subtitle approach joins the CCW rectangle pointing down.
    function entryAt(distance) {
      let low = 1, high = entry.length - 1;
      const d = Math.max(0, Math.min(entryLength, distance));
      while (low < high) {
        const mid = (low + high) >> 1;
        if (entry[mid].distance <= d) low = mid + 1;
        else high = mid;
      }
      const a = entry[low - 1], b = entry[low];
      const mix = (d - a.distance) / Math.max(0.001, b.distance - a.distance);
      return {x:a.x + (b.x - a.x) * mix, y:a.y + (b.y - a.y) * mix,
        angle:Math.atan2(b.y - a.y, b.x - a.x)};
    }

    function buildEntry(boxRect) {
      entry = []; entryLength = 0;
      if (!subtitle) return;
      // A Range measures the visible text, rather than the paragraph's full width.
      const range = document.createRange();
      range.selectNodeContents(subtitle);
      const lines = [...range.getClientRects()];
      const lastLine = lines[lines.length - 1] || subtitle.getBoundingClientRect();
      const radius = 13 * pacScale;
      const panelRect = box.closest('.panel-body').getBoundingClientRect();
      const start = {
        x:Math.max(panelRect.left - boxRect.left + radius + 8,
          Math.min(panelRect.right - boxRect.left - radius - 8, lastLine.right - boxRect.left)),
        y:lastLine.bottom - boxRect.top + radius + 10
      };
      const end = {x:margin, y:margin};
      // Both 90-degree turns remain in the open space above the email.
      const drop = end.y - start.y;
      if (drop <= 0) return;
      const turnY = start.y + drop / 2;
      for (const p of [start, {x:start.x, y:turnY}, {x:end.x, y:turnY}, end]) {
        const previousPoint = entry[entry.length - 1];
        if (previousPoint) {
          const length = Math.abs(p.x - previousPoint.x) + Math.abs(p.y - previousPoint.y);
          if (!length) continue;
          entryLength += length;
        }
        entry.push({...p, distance:entryLength});
      }
    }

    function makeFood(length, seed) {
      const count = Math.max(3, Math.min(16, Math.floor(length / 130)));
      return Array.from({length:count}, (_, i) => ({
        distance:(i + 0.15 + random(i + seed + 20) * 0.7) / count * length,
        // At most 4 px inward keeps the largest square clear of the email.
        drift:random(i + seed + 51) * 20 - 4,
        appear:50 + random(i + seed + 151) * 90,
        size:4 + Math.floor(random(i + seed + 81) * 3) * 2,
        alpha:0.6 + random(i + seed + 101) * 0.3
      }));
    }

    function resize() {
      if (!active) return;
      const onEntry = hasLayout && entryLength > 0 && travelled < entryLength;
      const progress = onEntry ? travelled / entryLength : (travelled - entryLength) / perimeter;
      const b = box.getBoundingClientRect();
      width = Math.round(b.width); height = Math.round(b.height);
      if (!width || !height) return;
      pacScale = matchMedia('(min-width: 561px)').matches ? 1.5 : 1;
      margin = pacScale > 1 ? 24 : 16;
      perimeter = Math.max(1, 2 * (width + height - margin * 4));
      buildEntry(b);
      travelled = !hasLayout ? 0 : onEntry ? progress * entryLength : entryLength + progress * perimeter;
      hasLayout = true;
      const padding = Math.max(24, 13 * pacScale + 8);
      canvasLeft = Math.floor(Math.min(0, ...entry.map(p => p.x - padding)));
      canvasTop = Math.floor(Math.min(0, ...entry.map(p => p.y - padding)));
      canvasWidth = Math.ceil(Math.max(width, ...entry.map(p => p.x + padding)) - canvasLeft);
      canvasHeight = height - canvasTop;
      // Expand only the drawing surface; the email's layout and equal gaps stay intact.
      Object.assign(canvas.style, {left:`${canvasLeft}px`, top:`${canvasTop}px`, right:'auto', bottom:'auto',
        width:`${canvasWidth}px`, height:`${canvasHeight}px`});
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvasWidth * dpr); canvas.height = Math.round(canvasHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, -canvasLeft * dpr, -canvasTop * dpr);
      const w = width - margin * 2, h = height - margin * 2;
      points = [];
      let offset = 0;
      for (const length of [h, w, h, w]) {
        const count = Math.max(1, Math.round(length / pitch));
        for (let i = 0; i < count; i++) points.push({distance:offset + i * length / count, ...pointAt(offset + i * length / count)});
        offset += length;
      }
      entryPoints = [];
      for (let i = 1; i < entry.length; i++) {
        const start = entry[i - 1].distance, length = entry[i].distance - start;
        const count = Math.max(1, Math.round(length / pitch));
        for (let j = 0; j < count; j++) {
          const distance = start + j * length / count;
          entryPoints.push({distance, ...entryAt(distance)});
        }
      }
      // Occasionally one ambient square lights up ahead, never a pre-drawn route.
      food = makeFood(perimeter, 0);
      entryFood = entryLength ? makeFood(entryLength, 300) : [];
      draw();
    }

    function drawPacman(position, time) {
      // Square cells make both the round silhouette and moving jaw pixel art.
      const mouth = (0.5 - 0.5 * Math.cos(time * Math.PI * 2 / 600)) * 0.85;
      ctx.save(); ctx.translate(Math.round(position.x), Math.round(position.y));
      ctx.rotate(position.angle); ctx.scale(pacScale, pacScale); ctx.fillStyle = '#ff2929';
      for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
        if (x*x + y*y > 39) continue;
        if (x >= 0 && mouth > 0.04 && Math.abs(Math.atan2(y, x || 0.01)) < mouth) continue;
        ctx.fillRect(x * 2 - 1, y * 2 - 1, 2, 2);
      }
      ctx.restore();
      // Keep the eye upright instead of rotating it below the face on the leftward leg.
      ctx.fillStyle = '#000';
      const vertical = Math.abs(Math.sin(position.angle)) > 0.5;
      const eyeX = pacScale > 1 ? (vertical ? -14 : -4) : (vertical ? -9 : -2);
      const eyeY = pacScale > 1 ? (vertical ? -4 : -14) : (vertical ? -3 : -9);
      const eyeSize = Math.round(5 * pacScale);
      ctx.fillRect(Math.round(position.x) + eyeX, Math.round(position.y) + eyeY, eyeSize, eyeSize);
    }

    function draw() {
      if (!width) return;
      const complete = isStill();
      const loopTravel = travelled - entryLength;
      const distance = ((loopTravel % perimeter) + perimeter) % perimeter;
      const cycle = Math.floor(loopTravel / perimeter);
      const trailLength = Math.min(750, perimeter * 0.9);
      ctx.clearRect(canvasLeft, canvasTop, canvasWidth, canvasHeight);
      if (!complete) {
        function drawFood(p, remaining, approach) {
          if (remaining < 8 || remaining > p.appear) return;
          const pull = Math.pow(Math.max(0, 1 - (remaining - 8) / (p.appear - 8)), 1.5);
          // Follow the rectangular corridor while flying inward, avoiding the email at corners.
          const targetDistance = p.distance - (remaining - 11) * pull;
          const target = approach ? entryAt(targetDistance) : pointAt(targetDistance);
          const w = width - margin * 2, h = height - margin * 2;
          const normalized = ((targetDistance % perimeter) + perimeter) % perimeter;
          const cornerDistance = approach
            ? Math.min(...entry.map(corner => Math.abs(corner.distance - targetDistance)))
            : Math.min(...[0, h, h + w, 2 * h + w, perimeter].map(corner => Math.abs(corner - normalized)));
          const drift = p.drift * (1 - pull) * Math.min(1, cornerDistance / 24);
          const x = Math.max(canvasLeft + 5, Math.min(canvasLeft + canvasWidth - 5, target.x - Math.sin(target.angle) * drift));
          const y = Math.max(canvasTop + 5, Math.min(height - 5, target.y + Math.cos(target.angle) * drift));
          const light = Math.min(1, (p.appear - remaining) / 18);
          ctx.fillStyle = `rgba(255,41,41,${p.alpha * light})`;
          ctx.fillRect(Math.round(x - p.size / 2), Math.round(y - p.size / 2), p.size, p.size);
        }
        entryFood.forEach(p => drawFood(p, p.distance - travelled, true));
        food.forEach(p => {
          const remaining = loopTravel < 0 ? p.distance - loopTravel : (p.distance - distance + perimeter) % perimeter;
          drawFood(p, remaining, false);
        });
      }
      function drawTrail(p, index, age) {
        if (!complete && (age < 14 * pacScale || age > trailLength)) return;
        // Newest squares are bright; older trail pixels fade smoothly to black.
        const fade = complete ? 1 : Math.pow(1 - age / trailLength, 1.5);
        ctx.fillStyle = `rgba(255,41,41,${(0.6 + (index % 5) * 0.075) * fade})`;
        const size = [4, 8, 6, 4, 6, 8, 4][index % 7];
        ctx.fillRect(Math.round(p.x - size / 2), Math.round(p.y - size / 2), size, size);
      }
      if (!complete) entryPoints.forEach((p, index) => drawTrail(p, index, travelled - p.distance));
      points.forEach((p, index) => {
        const age = (distance - p.distance + perimeter) % perimeter;
        if (!complete && (loopTravel < 0 || (!cycle && p.distance >= distance))) return;
        drawTrail(p, index, age);
      });
      if (!complete) {
        drawPacman(travelled < entryLength ? entryAt(travelled) : pointAt(distance), elapsed);
      }
    }

    function tick(time) {
      if (!active) return;
      if (previous) {
        const delta = Math.min(50, time - previous);
        elapsed += delta;
        travelled += delta / 1000 * speed;
      }
      previous = time; draw();
      frame = requestAnimationFrame(tick);
    }
    function resume() {
      cancelAnimationFrame(frame); previous = 0;
      if (!active || document.hidden || !visible || !dialog.open) return;
      draw();
      if (!isStill()) frame = requestAnimationFrame(tick);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(box);
    if (intro) observer.observe(intro);
    const intersection = new IntersectionObserver(entries => {visible = entries[0].isIntersecting; resume();});
    intersection.observe(canvas);
    window.addEventListener('resize', resize);
    if (intro) intro.addEventListener('animationend', resize);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('motionchange', resume);
    reduced.addEventListener('change', resume);
    cleanup = () => {
      active = false;
      cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect();
      window.removeEventListener('resize', resize);
      if (intro) intro.removeEventListener('animationend', resize);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('motionchange', resume);
      reduced.removeEventListener('change', resume);
    };
    document.fonts.ready.then(() => {if (active) resize();});
    resize(); resume();
  }
  window.addEventListener('sectionopened', mount);
  window.addEventListener('sectionchange', () => cleanup());
  dialog.addEventListener('close', () => cleanup());
})();
