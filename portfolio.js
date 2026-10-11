(() => {
  'use strict';
  const panel=document.querySelector('#panel-body'), dialog=document.querySelector('#content-dialog');
  let generation=0, hlsPromise=null, current=null;

  // Film type: explicit 'type' wins, otherwise inferred from the file (.m3u8 = HLS stream, anything else = MP4).
  const kind=film=>film.type||(/\.m3u8(\?|$)/i.test(film.src||'')?'hls':'mp4');
  function releasePlayer(){
    if(!current)return;
    const {video,hls,poster,frame}=current;
    current=null;
    hls?.destroy();
    if(video){video.pause();video.removeAttribute('src');video.load();video.remove();}
    frame?.remove();
    poster.hidden=false;
  }
  function catalog(){
    return fetch('portfolio.json?v=cms2-20261011',{cache:'no-store'}).then(response=>{
      if(!response.ok)throw new Error('Portfolio unavailable');
      return response.json();
    }).then(data=>Array.isArray(data)?data:(data&&Array.isArray(data.films)?data.films:[]));
  }
  function hlsLibrary(){
    if(window.Hls)return Promise.resolve(window.Hls);
    if(!hlsPromise)hlsPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='assets/vendor/hls.light.min.js';
      script.onload=()=>resolve(window.Hls);
      script.onerror=()=>{script.remove();hlsPromise=null;reject(new Error('Player unavailable'));};
      document.head.append(script);
    });
    return hlsPromise;
  }
  function tryPlay(video){
    // If the browser requires a second gesture, its native Play control stays available.
    video.play()?.catch(()=>{});
  }
  async function playFilm(film,media,poster,status){
    releasePlayer();status.hidden=true;
    if(kind(film)==='hls'&&film.src.startsWith('https://error404-studio-films.zts2v8c4cw.chatgpt.site/preview-media/')){
      const filmUrl=new URL(film.src),key=filmUrl.pathname.split('/')[2];
      const frame=document.createElement('iframe');
      frame.src=filmUrl.origin+'/player.html?film='+encodeURIComponent(key);
      frame.title=film.title+' film player';frame.allow='autoplay; fullscreen';frame.allowFullscreen=true;
      frame.style.cssText='position:absolute;inset:0;display:block;width:100%;height:100%;border:0;background:#000';
      current={frame,poster};poster.hidden=true;media.append(frame);frame.focus();return;
    }
    const video=document.createElement('video');
    video.controls=true;video.playsInline=true;video.preload='none';video.poster=film.poster;
    video.setAttribute('aria-label',film.title+' film');video.tabIndex=0;
    const state={video,poster,hls:null};current=state;
    poster.hidden=true;media.append(video);video.focus();
    const failed=()=>{
      if(current!==state)return;
      releasePlayer();
      status.textContent='This video could not be loaded. Select the preview to try again.';
      status.hidden=false;
      poster.focus();
    };
    video.addEventListener('error',failed);
    if(kind(film)!=='hls'||video.canPlayType('application/vnd.apple.mpegurl')){
      video.src=film.src;tryPlay(video);return;
    }
    try{
      const Hls=await hlsLibrary();
      if(current!==state)return;
      if(!Hls?.isSupported())throw new Error('Streaming unsupported');
      const hls=new Hls({maxBufferLength:12,maxMaxBufferLength:24,backBufferLength:6,maxBufferSize:24*1024*1024});
      state.hls=hls;
      hls.on(Hls.Events.ERROR,(_,data)=>{if(data.fatal)failed();});
      hls.on(Hls.Events.MANIFEST_PARSED,()=>{if(current===state)tryPlay(video);});
      hls.loadSource(film.src);hls.attachMedia(video);
    }catch(error){failed();}
  }
  function card(film){
    const article=document.createElement('article');article.className='project-feature';
    const media=document.createElement('div');media.className='project-media';
    // Full-frame previews use the film's native format for poster and playback.
    if(film.posterFit==='contain'&&film.width>0&&film.height>0)media.style.aspectRatio=film.width+' / '+film.height;
    const poster=document.createElement('button');poster.type='button';poster.className='project-play';
    poster.dataset.noTextPixels='';poster.setAttribute('aria-label','Play '+film.title);
    const image=document.createElement('img');image.src=film.poster;image.alt='';
    image.width=film.width||1920;image.height=film.height||1080;image.loading='lazy';image.decoding='async';
    if(film.posterFit==='contain')image.style.objectFit='contain';
    if(film.posterScale){image.style.transform='scale('+film.posterScale+')';image.style.transformOrigin=film.posterOrigin||'center';}
    const icon=document.createElement('span');icon.className='project-play-icon';icon.setAttribute('aria-hidden','true');
    const caption=document.createElement('span');caption.className='project-preview-caption';caption.setAttribute('aria-hidden','true');
    const name=document.createElement('span');name.className='project-short-name';
    for(const [i,part] of (film.shortTitle||film.title).split('&').entries()){if(i){const amp=document.createElement('span');amp.className='project-title-amp';amp.textContent='&';name.append(amp);}name.append(document.createTextNode(part));}
    const prompt=document.createElement('span');prompt.className='project-play-prompt';prompt.textContent='PRESS PLAY';caption.append(name,prompt);
    poster.append(image,icon,caption);media.append(poster);
    const status=document.createElement('p');status.className='project-status';status.hidden=true;status.setAttribute('role','status');
    poster.addEventListener('click',()=>playFilm(film,media,poster,status));
    const ns='http://www.w3.org/2000/svg',outline=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');
    outline.setAttribute('class','project-hover-frame');outline.setAttribute('viewBox','0 0 1000 562.5');outline.setAttribute('preserveAspectRatio','none');outline.setAttribute('aria-hidden','true');
    path.setAttribute('d','M18 2H982V8H990V16H998V546.5H990V554.5H982V560.5H18V554.5H10V546.5H2V16H10V8H18Z');path.setAttribute('pathLength','1');outline.append(path);media.append(outline);
    article.append(media,status);return article;
  }
  async function mount(){
    const gallery=panel.querySelector('.work-gallery');if(!gallery)return;
    const ownGeneration=++generation;
    try{
      const films=await catalog();
      if(ownGeneration!==generation||!dialog.open||!gallery.isConnected)return;
      const shown=films.filter(film=>film&&film.src&&!film.hide);
      const work=shown.filter(film=>film.section!=='studio');
      const studio=shown.filter(film=>film.section==='studio');
      gallery.replaceChildren(...work.map(card));
      if(studio.length){
        const section=document.createElement('section');section.className='studio-showcase';section.setAttribute('aria-labelledby','studio-title');
        const title=document.createElement('h2');title.id='studio-title';title.textContent='MEET ERROR404';
        const grid=document.createElement('div');grid.className='studio-films';grid.append(...studio.map(card));
        section.append(title,grid);gallery.append(section);
      }
      gallery.removeAttribute('aria-busy');
      window.dispatchEvent(new Event('textcontrolsupdated'));
      window.dispatchEvent(new Event('resize'));
    }catch(error){
      if(ownGeneration!==generation||!gallery.isConnected)return;
      const message=document.createElement('p');message.textContent='The films could not be loaded.';
      const retry=document.createElement('button');retry.type='button';retry.className='portfolio-retry';retry.textContent='Try again';
      retry.addEventListener('click',mount);gallery.replaceChildren(message,retry);gallery.removeAttribute('aria-busy');
      window.dispatchEvent(new Event('textcontrolsupdated'));
    }
  }
  window.addEventListener('sectionchange',()=>{generation++;releasePlayer();});
  window.addEventListener('sectionopened',mount);
  window.addEventListener('focus',()=>{if(dialog.open&&!current)mount();});
  dialog.addEventListener('close',()=>{generation++;releasePlayer();});
})();
