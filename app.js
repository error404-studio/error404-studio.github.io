(() => {
  'use strict';
  const $=s=>document.querySelector(s), site=$('#site'), art=$('#art'), logo=$('#hero-logo'), canvas=$('#pixels'), ctx=canvas.getContext('2d');
  const dialog=$('#content-dialog'), panelCanvas=$('#panel-pixels'), pctx=panelCanvas.getContext('2d'), panel=$('#panel-body');
  const slogan=$('#slogan'),sloganCopy=slogan.querySelector('.slogan-copy');
  let sloganStart=performance.now(),sloganTargets=[],fontsReady=false;
  // Created once: ambient actors keep their identity through letter assembly and return.
  const ambientActors=Array.from({length:320},(_,id)=>({id,size:6+(id%2)*2,target:null,from:null,cycle:-1}));
  // Independent background pixels remain present while the slogan assembles.
  const backdropActors=Array.from({length:36},(_,i)=>({id:9000+i}));
  const mq=matchMedia('(prefers-reduced-motion: reduce)');
  let reduced=mq.matches, userPaused=false, paused=reduced, start=performance.now(), frame=0, last=0, w=0,h=0,dpr=1,loaded=false;
  // Ambient travel uses elapsed drawing time; pause and background tabs freeze it.
  let ambientClock=0,ambientLastDraw=null;
  let canvasOrigin={x:0,y:0}, mouse={x:-500,y:-500}, seeds=[], bursts=[], logoBox=null, protectedBoxes=[], navBoxes=[], motifBox=null, panelStart=0, activeSection='', opener=null;
  const rng=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v)};
  const ease=v=>1-Math.pow(1-v,4), clamp=v=>Math.min(1,Math.max(0,v));
  const iconPatterns={
    about:['00111000011100','01111100111110','01010100101010','01111100111110','00111000011100','00000000000000','01111100111110','11000111100011','11000011000011','00000000000000','00001111110000','00000111100000','00000011000000'],
    contact:['111111111111111','110000000000011','101000000000101','100100000001001','100010000010001','100001000100001','100010111010001','100100000001001','101000000000101','110000000000011','111111111111111'],
    portfolio:["000100000001000","000010000010000","000001000100000","000000111000000","001111111111100","010000000000010","010011000110010","010011000110010","010000000000010","010000100000010","010000110000010","010000100000010","001111111111100","000010000010000","000110000011000"]
  };
  const content={
    "about": "<div class=\"panel-motif\" aria-hidden=\"true\"></div><div class=\"panel-copy\"><h1 id=\"panel-title\">Two minds<br>One AI studio</h1><p>Error404 is a collective of two long lost creative brothers from another mother, whose passion for cooking up visual worlds brought them together to spice up this galaxy. In error404 we trust.</p></div><div class=\"profile-grid\"><article class=\"profile\"><p class=\"player-label\">PLAYER 01</p><h2>Matus Toth</h2><p>Matus Toth cooks up visual worlds with a camera in one hand and the future in the other. Based in Prague and working everywhere, he mixes digital photography, analogue techniques and AI into his own slightly unpredictable recipe. Fashion, advertising and lifestyle are all on the menu. At ERROR404, he brings the photographic eye and a healthy appetite for making reality a little less well behaved.</p><div class=\"profile-links\"><a href=\"https://www.matustoth.com\" target=\"_blank\" rel=\"noopener noreferrer\">Website ↗</a><a href=\"https://www.instagram.com/matustoth_photographer/\" target=\"_blank\" rel=\"noopener noreferrer\">Photography ↗</a><a href=\"https://www.instagram.com/_tinbrain_/\" target=\"_blank\" rel=\"noopener noreferrer\">Personal AI art ↗</a></div></article><article class=\"profile\"><p class=\"player-label\">PLAYER 02</p><h2>Max Turek</h2><p>Born in Prague and seasoned by New York and London, Max took the scenic route back home. Along the way: film school at the University of Westminster, a second prize at the Young Director Awards in Cannes for a Ray-Ban test commercial, and a spot in Forbes’ 2019 “30 Talents Under 30 Years” selection. At ERROR404, he brings a director’s eye, a restless imagination and a healthy suspicion of ordinary.</p><div class=\"profile-links\"><a href=\"https://www.instagram.com/maxmilianturek/\" target=\"_blank\" rel=\"noopener noreferrer\">Instagram ↗</a><a href=\"https://vimeo.com/maxmilianturek\" target=\"_blank\" rel=\"noopener noreferrer\">Vimeo ↗</a></div></article></div>",
    "contact": "<div class=\"panel-motif\" aria-hidden=\"true\"></div><div class=\"panel-copy contact-intro\"><h1 id=\"panel-title\">Let’s make<br>something move</h1><p class=\"contact-subtitle\">Drop us an email</p></div><div class=\"contact-emails contact-cta\"><div class=\"contact-pacman\"><canvas aria-hidden=\"true\"></canvas><a class=\"contact-email\" href=\"mailto:hello@error404creative.com\">hello@error404creative.com</a></div></div>",
    "portfolio": "<div class=\"portfolio-heading\"><div class=\"panel-copy\"><h1 id=\"panel-title\">LESS TALK<br>MORE PLAY</h1><p class=\"work-intro\">Made with AI – Shaped by us</p></div><div class=\"panel-motif portfolio-motif\" aria-hidden=\"true\"></div></div><div class=\"work-gallery\" aria-busy=\"true\"><p>Loading films…</p></div>"
};
  function rect(el){if(!el)return null;const b=el.getBoundingClientRect();return {x:b.left-canvasOrigin.x,y:b.top-canvasOrigin.y,w:b.width,h:b.height};}
  function cacheLayout(){const surface=(dialog.open?panelCanvas:canvas).getBoundingClientRect();canvasOrigin={x:surface.left,y:surface.top};logoBox=rect($('.logo-window'));const targets=dialog.open?'.panel-top,.work-grid,.panel-foot,.profile-grid,.contact-links,.contact-emails,.project-feature':'nav a .nav-label,.hero-type,.slogan-hint,.logo-game-touch-hint,.orbit-label,.home-footer';protectedBoxes=[...document.querySelectorAll(targets)].map(rect);navBoxes=dialog.open?[]:[...document.querySelectorAll("nav a .nav-label")].map(rect);if(dialog.open){for(const copy of document.querySelectorAll('.panel-copy')){const walker=document.createTreeWalker(copy,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode())){if(!node.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(node);for(const b of range.getClientRects())protectedBoxes.push({x:b.left-canvasOrigin.x,y:b.top-canvasOrigin.y,w:b.width,h:b.height});}}}motifBox=dialog.open?rect($('.panel-motif')):null;
    if(motifBox&&activeSection==='contact'&&window.innerWidth>850){
      const heading=rect($('.contact-intro h1'));
      const pitch=Math.max(2,Math.floor(motifBox.w/iconPatterns.contact[0].length));
      const envelopeHeight=iconPatterns.contact.length*pitch-1;
      if(heading)motifBox.y=heading.y+(heading.h-envelopeHeight)/2;
    }
  }
  function resize(){dpr=Math.min(devicePixelRatio||1,2);for(const c of [canvas,panelCanvas]){const b=c.getBoundingClientRect();c.width=Math.round(b.width*dpr);c.height=Math.round(b.height*dpr);c.getContext('2d').setTransform(dpr,0,0,dpr,0,0)}const surface=(dialog.open?panelCanvas:canvas).getBoundingClientRect();w=surface.width;h=surface.height;cacheLayout();if(!dialog.open)buildSloganTargets();draw(performance.now());kick();}
  function buildSeeds(){const off=document.createElement('canvas');off.width=80;off.height=63;const c=off.getContext('2d',{willReadFrequently:true});c.drawImage(logo,1343,602,1171,919,0,0,80,63);const data=c.getImageData(0,0,80,63).data;seeds=[];for(let y=0;y<63;y++)for(let x=0;x<80;x++){const i=(y*80+x)*4;if(data[i+3]>70)seeds.push({u:x/80,v:y/63,a:data[i+3]/255,r:data[i],g:data[i+1],b:data[i+2],id:y*80+x})}loaded=true;replay();}
  function clearOfText(x,y,width=0,height=width){return !protectedBoxes.some(b=>x+width>b.x-16&&x<b.x+b.w+16&&y+height>b.y-14&&y<b.y+b.h+14);}
  // Native Silkscreen cells (125 font units in a 1000-unit em), from the preserved font.
  const sloganGlyphs={E:['01110','01000','01110','01000','01110'],V:['0100010','0100010','0010100','0010100','0001000'],R:['011100','010010','011100','010100','010010'],Y:['0100010','0010100','0001000','0001000','0001000'],B:['011100','010010','011110','010010','011100'],I:['010','010','010','010','010'],T:['01110','00100','00100','00100','00100'],C:['001100','010010','010000','010010','001100'],O:['001100','010010','010010','010010','001100'],U:['010010','010010','010010','010010','001100'],N:['0100010','0110010','0101010','0100110','0100010'],S:['001110','010000','001100','000010','011100'],'.':['010']};
  function buildSloganTargets(){
    if(!fontsReady||dialog.open)return;
    const sr=canvas.getBoundingClientRect(),cells=[];
    const walker=document.createTreeWalker(sloganCopy,NodeFilter.SHOW_TEXT);let node;
    while((node=walker.nextNode())){const fontSize=parseFloat(getComputedStyle(node.parentElement).fontSize),cell=fontSize/8;
      for(let i=0;i<node.textContent.length;i++){const ch=node.textContent[i],glyph=sloganGlyphs[ch];if(!glyph)continue;
        const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+1);const r=range.getBoundingClientRect();if(!r.width)continue;
        const left=r.left-sr.left,top=r.top-sr.top+fontSize*(ch==='.'?.905:.405);
        glyph.forEach((row,y)=>[...row].forEach((value,x)=>{if(value==='1')cells.push({x:left+x*cell,y:top+y*cell,size:cell});}));
      }
    }
    sloganTargets=cells;
    ambientActors.forEach((a,i)=>{a.target=sloganTargets[i]||null;});
  }
  function ambientHome(a,t,returning=false){
    const vx=(rng(a.id+910)<.5?-1:1)*(7+rng(a.id+911)*7),vy=(rng(a.id+930)<.5?-1:1)*(4+rng(a.id+931)*6);
    const padding=60,wrap=(value,extent)=>((value+padding)%(extent+2*padding)+(extent+2*padding))%(extent+2*padding)-padding;
    // Seeded starting points remain spread across the screen from the first draw.
    // Both ends of each wrap are outside the visible canvas, including mouse push.
    let x=wrap(rng(a.id+71)*w+vx*ambientClock,w),y=wrap(rng(a.id+800)*h+vy*ambientClock,h);
    // A returning letter follows one continuous branch until its blend ends;
    // wrapping its destination mid-blend would teleport the visible letter pixel.
    if(returning){if(!a.returnHome)a.returnHome={x,y,clock:ambientClock};x=a.returnHome.x+vx*(ambientClock-a.returnHome.clock);y=a.returnHome.y+vy*(ambientClock-a.returnHome.clock);}else a.returnHome=null;
    if(!paused){const dx=x-mouse.x,dy=y-mouse.y,d=Math.hypot(dx,dy);a.avoidX=d<135?dx/(d||1)*(135-d)*.25:0;a.avoidY=d<135?dy/(d||1)*(135-d)*.25:0;}
    // Keep the existing mouse displacement while paused, including manual draws.
    return {x:x+(a.avoidX||0),y:y+(a.avoidY||0)};
  }
  function ambient(c,t){
    c.fillStyle='rgba(235,230,215,.065)';for(let x=28;x<w;x+=36)for(let y=26;y<h;y+=36)c.fillRect(x,y,1,1);
    if(!dialog.open)for(const a of backdropActors){const home=ambientHome(a,t),size=6+Math.floor(rng(a.id+410)*3)*4;if(!clearOfText(home.x,home.y,size))continue;c.fillStyle=`rgba(255,41,41,${.13+rng(a.id+33)*.16})`;c.fillRect(Math.round(home.x),Math.round(home.y),size,size);}
    const age=Math.max(0,t-sloganStart),cycle=Math.floor(age/17000),phase=age%17000,assembling=phase<8000,holding=phase>=8000&&phase<14000,canForm=!dialog.open&&!paused&&sloganTargets.length>0;
    slogan.dataset.animationPhase=String(Math.floor(phase));slogan.style.setProperty('--slogan-copy-opacity',paused?'1':'0');slogan.dataset.playing=String(canForm&&!holding);
    const settledGlyphs=new Path2D();let hasSettledGlyphs=false;
    for(const a of ambientActors){if(dialog.open&&a.id>=44)break;const home=ambientHome(a,t,canForm&&a.target&&!assembling&&!holding),originalSize=a.id<44?Math.max(6,3+Math.floor(rng(a.id+410)*3)*4):a.size,baseAlpha=a.id<44?.13+rng(a.id+33)*.16:.025+rng(a.id+33)*.035;
      let x=home.x,y=home.y,size=originalSize,mix=0,alpha=baseAlpha,settled=false,assigned=canForm&&a.target;
      if(assigned){
        if(a.cycle!==cycle){a.cycle=cycle;a.from=null;}
        const delay=1000+rng(a.id+210)*1000,duration=4800+rng(a.id+270)*1000;
        let travel;if(assembling)travel=clamp((phase-delay)/duration);else if(holding)travel=1;else travel=1-clamp((phase-14000-rng(a.id+310)*600)/2400);
        if(assembling&&travel>0&&!a.from)a.from={x:home.x,y:home.y};
        const origin=assembling?(a.from||home):home;
        const smooth=travel*travel*(3-2*travel),turn=(age/1000)*(.5+rng(a.id+350)*.5)+rng(a.id+390)*Math.PI*2,arc=Math.sin(Math.PI*travel)*(20+rng(a.id+450)*42);
        x=origin.x+(a.target.x-origin.x)*smooth+Math.sin(turn)*arc;y=origin.y+(a.target.y-origin.y)*smooth+Math.cos(turn*.83)*arc*.65;
        size=originalSize+(a.target.size-originalSize)*smooth;mix=smooth*smooth;alpha=baseAlpha+(1-baseAlpha)*smooth;if(travel===0)alpha=baseAlpha;
        settled=travel===1;if(settled){x=a.target.x;y=a.target.y;size=a.target.size;}
        a.x=x;a.y=y;
        if(!settled&&navBoxes.some(b=>x+size>b.x-16&&x<b.x+b.w+16&&y+size>b.y-14&&y<b.y+b.h+14))continue;
        if(!travel&&!clearOfText(x,y,size))continue;
      }else{a.x=x;a.y=y;if(!clearOfText(x,y,size))continue;}
      if(settled){settledGlyphs.rect(x,y,size,size);hasSettledGlyphs=true;continue;}
      const red=Math.round(255+(244-255)*mix),green=Math.round(41+(240-41)*mix),blue=Math.round(41+(232-41)*mix);c.fillStyle=`rgba(${red},${green},${blue},${alpha})`;c.fillRect(x,y,size,size);
    }
    // Fill settled adjacent cells as one path, avoiding independent edge antialiasing.
    if(hasSettledGlyphs){c.fillStyle='#f4f0e8';c.fill(settledGlyphs);}
  }
  function drawLogo(c,t){if(!loaded||!logoBox)return;const elapsed=paused?8:(t-start)/1000;
    if(elapsed<3.6){const fade=clamp((3.6-elapsed)/.4),b=logoBox;for(const p of seeds){const progress=clamp((elapsed-rng(p.id+30)*.55)/(2.5+rng(p.id+91)*.35)),v=ease(progress);const sx=rng(p.id+1)*w,sy=rng(p.id+77)*h,phase=rng(p.id+121)*Math.PI*2,turn=progress*(1.2+rng(p.id+140)*1.5)*Math.PI*2,drift=Math.min(w,h)*(.045+rng(p.id+180)*.13)*Math.pow(1-progress,1.25);const curveX=(Math.sin(phase+turn)-Math.sin(phase))*.8+Math.sin(progress*Math.PI)*(rng(p.id+210)-.5),curveY=(Math.cos(phase+turn*.83)-Math.cos(phase))*.8+Math.sin(progress*Math.PI)*(rng(p.id+250)-.5);const x=sx+(b.x+p.u*b.w-sx)*v+curveX*drift,y=sy+(b.y+p.v*b.h-sy)*v+curveY*drift;const size=b.w/80+.15;if(!clearOfText(x,y,size))continue;c.fillStyle=`rgba(${p.r},${p.g},${p.b},${p.a*fade})`;c.fillRect(Math.round(x),Math.round(y),size,size)}if(elapsed>3.1)art.classList.add('ready');}else art.classList.add('ready');}
  function drawMotif(c,t){if(!motifBox)return;const pat=iconPatterns[activeSection];if(!pat)return;const b=motifBox,isTV=activeSection==='portfolio';
    // Envelope occupies 15 columns; TV occupies columns 1–13 of its 15-column grid.
    // Use the same responsive reference width, then match the occupied width exactly.
    const referencePitch=Math.max(2,Math.floor(b.w/iconPatterns.contact[0].length));
    const gridSpan=referencePitch*15,size=isTV?gridSpan/13:Math.max(2,Math.floor(b.w/pat[0].length)),elapsed=paused?2:(t-panelStart)/1000;
    pat.forEach((row,y)=>[...row].forEach((v,x)=>{if(v!=='1')return;const n=y*20+x,p=ease(clamp((elapsed-rng(n)*.14)/.55));const tx=b.x+(isTV?(x-1)*gridSpan/13:x*size),ty=b.y+(isTV?y*gridSpan/13:y*size),sx=b.x+(rng(n+7)-.5)*b.w*3,sy=b.y+(rng(n+80)-.5)*b.h*2;const px=sx+(tx-sx)*p,py=sy+(ty-sy)*p;
      const pixelWidth=isTV?Math.max(1,Math.round(b.x+x*gridSpan/13)-Math.round(tx)-1):size-1,pixelHeight=isTV?Math.max(1,Math.round(b.y+(y+1)*gridSpan/13)-Math.round(ty)-1):size-1;
      if(!clearOfText(px,py,pixelWidth,pixelHeight))return;c.fillStyle=`rgba(255,41,41,${.25+.75*p})`;c.fillRect(Math.round(px),Math.round(py),pixelWidth,pixelHeight)}));}
  function menuBurst(el,scope=dialog.open?'panel':'home',count=24){if(document.body.dataset.menuStyle!=='pixels'||(document.body.dataset.variant==='menu-live'&&el?.matches('nav a,.pixel-text-control')))return;const b=rect(el),edge=rect(scope==='panel'?$('.panel-top'):$('header'));if(b&&edge)emit(b.x+b.w/2,Math.max(b.y+b.h+18,edge.y+edge.h+18),scope,count);}
  function emit(x,y,scope=dialog.open?'panel':'home',count=34){if(paused||document.hidden)return;const now=performance.now();for(let i=0;i<count;i++){const n=now+i,a=rng(n)*Math.PI*2,speed=30+rng(n+13)*110;bursts.push({x,y,dx:Math.cos(a)*speed,dy:Math.sin(a)*speed,born:now,life:380+rng(n+70)*380,size:2+Math.floor(rng(n+20)*3)*3,scope})}bursts=bursts.slice(-320);kick();}
  function drawBursts(c,t,scope){bursts=bursts.filter(p=>t-p.born<p.life);for(const p of bursts){if(p.scope!==scope)continue;const v=clamp((t-p.born)/p.life),x=p.x+p.dx*ease(v),y=p.y+p.dy*ease(v);const size=p.size*(1-v*.6);if(!clearOfText(x,y,size))continue;c.fillStyle=`rgba(255,41,41,${(1-v)*.8})`;c.fillRect(Math.round(x),Math.round(y),size,size);}}
  function draw(t){if(ambientLastDraw!==null&&!paused&&!document.hidden)ambientClock+=Math.min(100,Math.max(0,t-ambientLastDraw))/1000;ambientLastDraw=paused||document.hidden?null:t;const c=dialog.open?pctx:ctx;c.clearRect(0,0,w,h);ambient(c,t);if(dialog.open)drawMotif(c,t);else drawLogo(c,t);drawBursts(c,t,dialog.open?'panel':'home');}
  function tick(t){if(t-last>=30){draw(t);last=t}if(!paused&&!document.hidden)frame=requestAnimationFrame(tick);}
  function kick(){cancelAnimationFrame(frame);if(document.hidden)return;if(!paused)frame=requestAnimationFrame(tick);else draw(performance.now());}
  function beginSlogan(hold=false){sloganStart=performance.now()-(hold?8000:0);for(const a of ambientActors){a.cycle=0;a.from=!hold&&Number.isFinite(a.x)?{x:a.x,y:a.y}:null;}}
  function replay(){beginSlogan();window.dispatchEvent(new Event('introreplay'));start=performance.now();cacheLayout();if(!paused)art.classList.remove('ready');else art.classList.add('ready');kick();}
  function updateMotion(){paused=reduced||userPaused;slogan.disabled=paused;beginSlogan(true);document.body.classList.toggle('motion-off',paused);for(const b of [$('#motion'),$('#panel-motion')]){b.setAttribute('aria-pressed',String(paused));b.setAttribute('aria-label',reduced?'Animation disabled by reduced motion preference':paused?'Play animation':'Pause animation');b.disabled=reduced;}$('#motion .motion-label').textContent=reduced?'STILL':paused?'PLAY':'PAUSE';$('#motion .motion-icon').textContent=paused?'▷':'Ⅱ';$('#panel-motion').textContent=reduced?'STILL':paused?'PLAY':'PAUSE';if(paused){bursts=[];art.classList.add('ready')}cacheLayout();kick();window.dispatchEvent(new Event('motionchange'));}
  for(const b of [$('#motion'),$('#panel-motion')])b.addEventListener('click',()=>{userPaused=!userPaused;updateMotion();});mq.addEventListener('change',e=>{reduced=e.matches;updateMotion()});
  slogan.addEventListener('click',()=>{if(!paused){beginSlogan();kick();}});
  const gameHint=art.querySelector('.logo-game-hint');
  const cursorHintMode=matchMedia('(min-width:761px) and (hover:hover) and (pointer:fine)');
  function hideGameHint(){art.classList.remove('is-pointer-over');}
  function moveGameHint(event){
    if(!cursorHintMode.matches||event.pointerType==='touch'){hideGameHint();return;}
    const box=art.getBoundingClientRect(),gap=16,margin=8;
    const hintWidth=gameHint.offsetWidth,hintHeight=gameHint.offsetHeight;
    let x=event.clientX+gap,y=event.clientY+gap;
    if(x+hintWidth>innerWidth-margin)x=event.clientX-gap-hintWidth;
    if(y+hintHeight>innerHeight-margin)y=event.clientY-gap-hintHeight;
    x=Math.max(margin,Math.min(x,innerWidth-margin-hintWidth));
    y=Math.max(margin,Math.min(y,innerHeight-margin-hintHeight));
    gameHint.style.left=(x-box.left)+'px';gameHint.style.top=(y-box.top)+'px';
    art.classList.add('is-pointer-over');
  }
  art.addEventListener('pointerenter',moveGameHint,{passive:true});
  art.addEventListener('pointermove',moveGameHint,{passive:true});
  art.addEventListener('pointerleave',hideGameHint);
  art.addEventListener('pointercancel',hideGameHint);
  art.addEventListener('click',hideGameHint);
  cursorHintMode.addEventListener('change',hideGameHint);
  for(const event of ['blur','resize','scroll','sectionchange'])window.addEventListener(event,hideGameHint,{passive:true});
  document.addEventListener('visibilitychange',hideGameHint);
  $('#replay').addEventListener('click',replay);art.addEventListener('click',()=>location.assign('404.html?play=1'));art.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();if(!reduced){userPaused=!userPaused;updateMotion();}}});
  function openSection(a, keyboard = false) {
    const section = a.hash.slice(1);
    if (!Object.prototype.hasOwnProperty.call(content, section)) return;
    if (dialog.open && activeSection === section) return;
    window.dispatchEvent(new Event('sectionchange'));
    panel.querySelectorAll('video').forEach(video => video.pause());
    opener = a; activeSection = section; panel.innerHTML = content[section];
    panel.classList.remove('entering');
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0; panelStart = performance.now(); panel.classList.add('entering');
    window.dispatchEvent(new Event('sectionopened')); resize();
    const focusTarget = keyboard ? $('#close-panel') : $('#panel-title');
    if (focusTarget.id === 'panel-title') focusTarget.tabIndex = -1;
    focusTarget.focus({ preventScroll: true }); menuBurst(a, 'panel', 28);
  }
  document.querySelectorAll('nav a').forEach(a => a.addEventListener('click', e => {
    e.preventDefault(); openSection(a, e.detail === 0);
  }));
  function openLinkedSection() {
    const link = [...document.querySelectorAll('nav a')].find(a => a.hash === location.hash);
    if (link) openSection(link);
  }
  // Run after the portfolio and contact scripts register their section listeners.
  document.addEventListener('DOMContentLoaded', openLinkedSection, { once: true });
  window.addEventListener('hashchange', openLinkedSection);
  function closePanel(){if(location.hash==='#'+activeSection)history.replaceState(history.state,'',location.pathname+location.search);beginSlogan(true);panel.querySelectorAll('video').forEach(video=>video.pause());dialog.close();activeSection='';panel.classList.remove('entering');opener?.focus();resize();menuBurst(opener,'home',28);kick();}
  $('#close-panel').addEventListener('click',closePanel);$('#back-panel').addEventListener('click',closePanel);dialog.addEventListener('cancel',e=>{e.preventDefault();closePanel()});
  dialog.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const controls=[...dialog.querySelectorAll('a[href],button,input,select,textarea,video[controls],[tabindex]')].filter(el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length);if(!controls.length)return;const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}});dialog.addEventListener('scroll',()=>{cacheLayout();if(paused)draw(performance.now())},{passive:true});
  document.addEventListener('pointermove',e=>{mouse={x:e.clientX-canvasOrigin.x,y:e.clientY-canvasOrigin.y}},{passive:true});document.addEventListener('pointerleave',()=>{mouse={x:-500,y:-500}});
  document.querySelectorAll('nav a,#close-panel').forEach(a=>{a.addEventListener('pointerenter',()=>menuBurst(a));a.addEventListener('focus',()=>menuBurst(a,dialog.open?'panel':'home',18));});
  document.querySelectorAll('.wordmark,#replay').forEach(a=>{for(const event of ['pointerenter','focus'])a.addEventListener(event,()=>{const b=rect(a);emit(b.x+b.w/2,b.y+b.h,'home',10)});});
  dialog.addEventListener('pointerover',e=>{const tile=e.target.closest('.work-placeholder');if(tile&&!tile.contains(e.relatedTarget)){const b=rect(tile);emit(b.x+b.w/2,b.y+5,'panel',24)}});
  window.addEventListener('scroll',()=>{cacheLayout();if(paused)draw(performance.now())},{passive:true});
  document.addEventListener('visibilitychange',()=>{ambientLastDraw=null;if(!document.hidden)beginSlogan(true);kick();});new ResizeObserver(resize).observe(site);document.fonts.ready.then(()=>{fontsReady=true;cacheLayout();buildSloganTargets();sloganStart=performance.now();kick()});
  logo.addEventListener('load',buildSeeds);logo.addEventListener('error',()=>{art.classList.add('ready');console.warn('Logo asset did not load')});if(logo.complete&&logo.naturalWidth)buildSeeds();updateMotion();resize();
})();
