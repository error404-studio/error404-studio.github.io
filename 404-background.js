/* Local desktop preview: quiet travelling pixels outside both game panels. */
(() => {
  const canvas = document.getElementById('game-background');
  const context = canvas?.getContext('2d');
  if (!context) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const panels = [...document.querySelectorAll('.board,.leaderboard')];
  let width = 0, height = 0, pixels = [], last = 0, frame = 0;
  function draw() {
    context.clearRect(0, 0, width, height);
    context.save();
    context.beginPath(); context.rect(0, 0, width, height);
    for (const panel of panels) {
      const box = panel.getBoundingClientRect();
      context.rect(box.left - 3, box.top - 3, box.width + 6, box.height + 6);
    }
    context.clip('evenodd');
    for (const p of pixels) {
      context.fillStyle = `rgba(255,41,41,${p.alpha})`;
      context.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    context.restore();
  }
  function resize() {
    const oldWidth = width || innerWidth, oldHeight = height || innerHeight;
    width = innerWidth; height = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (pixels.length) pixels.forEach(p => { p.x *= width / oldWidth; p.y *= height / oldHeight; });
    else pixels = Array.from({length:Math.max(60,Math.min(150,Math.round(width * height / 10000)))}, () => ({
      x:Math.random()*width, y:Math.random()*height, size:2+Math.floor(Math.random()*5),
      vx:(Math.random()<.5?-1:1)*(5+Math.random()*7), vy:(Math.random()<.5?-1:1)*(3+Math.random()*6),
      alpha:.12+Math.random()*.27
    }));
    draw();
  }
  function tick(now) {
    const dt = last ? Math.min((now-last)/1000,.05) : 0; last=now;
    for (const p of pixels) {
      p.x += p.vx*dt; p.y += p.vy*dt;
      if(p.x>width+8)p.x=-8; else if(p.x< -8)p.x=width+8;
      if(p.y>height+8)p.y=-8; else if(p.y< -8)p.y=height+8;
    }
    draw(); frame=requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame); frame=0;last=0;draw();
    if(!document.hidden&&!reduced.matches)frame=requestAnimationFrame(tick);
  }
  window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',sync);
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0;});
  window.addEventListener('pageshow',sync);
  resize(); sync();
})();
