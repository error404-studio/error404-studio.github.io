(() => {
  'use strict';
  const site=document.querySelector('#site'),canvas=document.querySelector('#intro-pixels'),ctx=canvas.getContext('2d'),dialog=document.querySelector('#content-dialog'),logo=document.querySelector('#hero-logo');
  const selectors='.wordmark,nav a,.orbit-label,.creative-label,.home-footer p,.home-footer button';
  const random=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
  let targets=[],particles=[],frame=0,started=0,last=0,active=false,ready=false;
  const allowed=()=>!document.body.classList.contains('motion-off')&&!dialog.open&&!document.hidden;
  function stop(){cancelAnimationFrame(frame);frame=0;active=false;site.classList.remove('intro-composing');site.dataset.textIntro='settled';for(const target of targets)target.classList.remove('intro-text-target');ctx.clearRect(0,0,canvas.width,canvas.height);particles=[];}
  function build(){
    const rect=site.getBoundingClientRect(),width=Math.ceil(rect.width),height=Math.ceil(rect.height),dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    const mask=document.createElement('canvas');mask.width=width;mask.height=height;const m=mask.getContext('2d',{willReadFrequently:true});m.textBaseline='alphabetic';
    targets=[...site.querySelectorAll(selectors)].filter(el=>!el.hidden&&getComputedStyle(el).display!=='none'&&el.getClientRects().length&&el.getBoundingClientRect().width>0);
    for(const target of targets){
      const walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT,{acceptNode(node){const p=node.parentElement;return p&&p.tagName!=='CANVAS'&&getComputedStyle(p).display!=='none'?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;}});let node;
      while((node=walker.nextNode())){
        const style=getComputedStyle(node.parentElement);m.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;m.fillStyle=style.color;
        for(let i=0;i<node.textContent.length;i++){const letter=node.textContent[i];if(!letter.trim())continue;const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+1);const b=range.getBoundingClientRect();if(!b.width||!b.height)continue;const metrics=m.measureText(letter),ascent=metrics.actualBoundingBoxAscent||parseFloat(style.fontSize)*.8,descent=metrics.actualBoundingBoxDescent||0;m.fillText(letter,b.left-rect.left,b.top-rect.top+(b.height-ascent-descent)/2+ascent);}
      }
    }
    const data=m.getImageData(0,0,width,height).data,step=width<700?2:3,cells=[];
    for(let y=0;y<height;y+=step)for(let x=0;x<width;x+=step){const i=(y*width+x)*4;if(data[i+3]>70)cells.push({x,y,id:i,r:data[i],g:data[i+1],b:data[i+2]});}
    const stride=Math.max(1,Math.ceil(cells.length/6200));particles=cells.filter((_,i)=>i%stride===0).map(p=>({...p,sx:random(p.id+7)*width,sy:random(p.id+81)*height,delay:random(p.id+50)*.5,duration:2.5+random(p.id+97)*.35,phase:random(p.id+123)*Math.PI*2,turns:1.2+random(p.id+150)*1.5,amplitude:Math.min(width,height)*(.045+random(p.id+180)*.13),size:step}));
    site.dataset.introParticleCount=String(particles.length);site.dataset.introTargetCount=String(targets.length);
  }
  function play(){stop();if(!ready||!allowed())return;build();if(!particles.length)return;for(const target of targets)target.classList.add('intro-text-target');site.classList.add('intro-composing');site.dataset.textIntro='assembling';active=true;started=performance.now();last=0;
    function tick(t){if(!allowed()){stop();return;}const elapsed=(t-started)/1000;if(t-last>=30){ctx.clearRect(0,0,canvas.width,canvas.height);const fade=Math.min(1,elapsed*4)*Math.min(1,Math.max(0,(3.55-elapsed)/.18));for(const p of particles){const progress=Math.min(1,Math.max(0,(elapsed-p.delay)/p.duration)),ease=1-Math.pow(1-progress,4),turn=progress*p.turns*Math.PI*2,drift=p.amplitude*Math.pow(1-progress,1.25),curveX=(Math.sin(p.phase+turn)-Math.sin(p.phase))*.8+Math.sin(progress*Math.PI)*(random(p.id+210)-.5),curveY=(Math.cos(p.phase+turn*.83)-Math.cos(p.phase))*.8+Math.sin(progress*Math.PI)*(random(p.id+250)-.5);ctx.fillStyle=`rgba(${p.r},${p.g},${p.b},${fade})`;ctx.fillRect(Math.round(p.sx+(p.x-p.sx)*ease+curveX*drift),Math.round(p.sy+(p.y-p.sy)*ease+curveY*drift),p.size,p.size);}last=t;}if(elapsed<3.55)frame=requestAnimationFrame(tick);else{stop();window.dispatchEvent(new Event('introcomplete'));}}
    frame=requestAnimationFrame(tick);
  }
  window.addEventListener('introreplay',play);
  for(const event of ['motionchange','sectionchange','resize'])window.addEventListener(event,stop);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  Promise.all([document.fonts.ready,logo.complete?Promise.resolve():new Promise(resolve=>{logo.addEventListener('load',resolve,{once:true});logo.addEventListener('error',resolve,{once:true});})]).then(()=>{ready=true;play();});
})();
