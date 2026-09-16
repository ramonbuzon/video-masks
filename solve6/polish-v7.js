/* MateShot polish v8: responsive result UI, square social video and reliable native sharing. */
(() => {
  const LANG=(navigator.language||'en').toLowerCase().startsWith('es')?'es':'en';
  const TXT=LANG==='es'?{
    solution:'Solución',video:'Vídeo',pause:'Pausa',share:'Compartir',
    black:'Mueven negras',white:'Mueven blancas',mate:'Mate en',checkmate:'Jaque mate',
    generating:'Generating…',ready:'Vídeo listo. Toca Compartir.',
    unavailable:'Tu navegador no permite compartir este vídeo directamente.',error:'No se ha podido preparar el vídeo.'
  }:{
    solution:'Solution',video:'Video',pause:'Pause',share:'Share',
    black:'Black to move',white:'White to move',mate:'Mate in',checkmate:'Checkmate',
    generating:'Generating…',ready:'Video ready. Tap Share.',
    unavailable:'This browser cannot share the video directly.',error:'Could not prepare the video.'
  };

  const style=document.createElement('style');
  style.textContent=`
    button:disabled{cursor:default!important;}
    .brand{gap:10px!important;letter-spacing:-.04em!important;font-size:25px!important;font-weight:850!important;}
    .brandMark{width:11px!important;height:11px!important;min-width:11px!important;border-radius:50%!important;background:var(--accent)!important;color:transparent!important;font-size:0!important;box-shadow:0 0 0 5px rgba(214,255,88,.045)!important;}
    .top{height:64px!important;}

    #sidePill,#goalPill{display:none!important;}
    .contextBar{justify-content:center!important;padding-left:0!important;width:100%!important;}
    .contextCombined{display:flex;align-items:center;justify-content:center;gap:9px;color:#aeb5be;font-size:15px;font-weight:720;letter-spacing:-.015em;white-space:nowrap;}
    .contextCombined::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 5px rgba(214,255,88,.055);flex:0 0 auto;}

    .mate{display:none!important;}
    #prev,#next,.speed,#download{display:none!important;}
    .solutionKicker{display:block!important;text-transform:none!important;letter-spacing:-.04em!important;color:#f5f6f3!important;font-weight:870!important;}
    .solutionList{display:flex!important;flex-direction:column!important;gap:8px!important;overflow-y:auto!important;overscroll-behavior:contain;scrollbar-width:none;padding-right:3px;position:relative;}
    .solutionList::-webkit-scrollbar{display:none;}
    .solutionList.fadeBottom{-webkit-mask-image:linear-gradient(to bottom,#000 0%,#000 76%,transparent 100%);mask-image:linear-gradient(to bottom,#000 0%,#000 76%,transparent 100%);}
    .solutionRow{flex:0 0 auto;}

    .controls{display:block!important;width:100%!important;}
    .controls .play{width:100%!important;}
    .actions{display:block!important;width:100%!important;}
    #share{width:100%!important;position:relative;}
    #share.shareBusy{opacity:.84!important;}
    #share .shareSpinner{width:18px;height:18px;border-radius:50%;border:2px solid rgba(17,17,17,.22);border-top-color:#111;animation:msSpin .75s linear infinite;display:inline-block;}
    @keyframes msSpin{to{transform:rotate(360deg)}}
    .exportNote{min-height:0!important;}

    @media(max-width:760px){
      .top{height:60px!important;}
      .brand{font-size:24px!important;}
      .brandMark{width:10px!important;height:10px!important;min-width:10px!important;}
      .resultView{align-items:flex-start!important;overflow:hidden!important;padding:0 8px 10px!important;}
      .resultGrid{gap:12px!important;padding-bottom:0!important;width:100%!important;}
      .contextBar{order:1!important;margin-top:0!important;}
      .contextCombined{font-size:15.5px!important;}
      .boardWrap{order:2!important;width:min(96vw,50dvh,590px)!important;}
      .solutionPanel{
        order:3!important;width:min(100%,760px)!important;display:grid!important;
        grid-template-columns:minmax(0,1.22fr) minmax(148px,.78fr)!important;
        grid-template-areas:"title title" "moves controls" "moves actions" "note note"!important;
        column-gap:18px!important;row-gap:12px!important;align-items:center!important;
        padding:0 7px!important;
      }
      .solutionKicker{grid-area:title!important;font-size:27px!important;line-height:1!important;margin-top:2px;}
      .solutionList{grid-area:moves!important;max-height:214px!important;align-self:start!important;gap:8px!important;}
      .solutionRow{padding:11px 11px!important;font-size:14.5px!important;border-radius:12px!important;gap:10px!important;}
      .solutionRow strong{font-size:17px!important;line-height:1.15!important;}
      .solutionRow .n{width:31px!important;font-size:14px!important;}
      .controls{grid-area:controls!important;align-self:end!important;}
      .controls .play{height:64px!important;border-radius:19px!important;font-size:17px!important;padding:0 12px!important;}
      .actions{grid-area:actions!important;align-self:start!important;}
      .action{height:64px!important;border-radius:19px!important;font-size:17px!important;padding:0 10px!important;}
      .action svg{width:22px!important;height:22px!important;}
      .exportNote{grid-area:note!important;}
    }

    @media(max-width:390px){
      .boardWrap{width:min(95vw,47dvh,570px)!important;}
      .solutionPanel{grid-template-columns:minmax(0,1.16fr) minmax(140px,.84fr)!important;column-gap:13px!important;}
      .solutionList{max-height:202px!important;}
      .solutionRow{padding:9px 9px!important;}
      .solutionRow strong{font-size:15.5px!important;}
      .controls .play,.action{height:60px!important;font-size:15.5px!important;}
    }

    @media(min-width:761px){
      .brand{font-size:26px!important;}
      .contextBar{grid-column:1!important;grid-row:1!important;width:100%!important;text-align:center!important;}
      .contextCombined{font-size:16px!important;}
      .solutionPanel{display:flex!important;flex-direction:column!important;gap:15px!important;}
      .solutionKicker{font-size:34px!important;line-height:1!important;margin-bottom:3px;}
      .solutionList{width:78%!important;max-height:292px!important;}
      .solutionRow{padding:11px 12px!important;}
      .solutionRow strong{font-size:16.5px!important;}
      .controls,.actions{width:100%!important;}
      .controls .play,.action{height:56px!important;font-size:16px!important;}
    }
  `;
  document.head.appendChild(style);

  const PIECE_BASE='https://lichess1.org/assets/piece/cburnett/';
  const pieceCode=p=>(p===p.toUpperCase()?'w':'b')+p.toUpperCase();
  const pieceSrc=p=>PIECE_BASE+pieceCode(p)+'.svg';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  function toast(msg){
    const el=document.getElementById('toast');if(!el)return;
    el.textContent=msg;el.classList.add('show');clearTimeout(toast._t);
    toast._t=setTimeout(()=>el.classList.remove('show'),2200);
  }

  function contextText(){
    if(!window.S?.start)return'';
    const side=S.start.side==='b'?TXT.black:TXT.white;
    return `${side} · ${TXT.mate} ${S.mateN}`;
  }

  function ensureContext(){
    const bar=document.querySelector('.contextBar');if(!bar)return;
    let el=document.getElementById('contextCombined');
    if(!el){el=document.createElement('div');el.id='contextCombined';el.className='contextCombined';bar.appendChild(el);}
    const txt=contextText();if(txt&&el.textContent!==txt)el.textContent=txt;
  }

  function shareIcon(){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.8" y="6.4" width="12.8" height="11.2" rx="2.4"/><path d="M8.2 9.4l4 2.6-4 2.6z" fill="currentColor" stroke="none"/><path d="M15.3 4.8H21v5.7"/><path d="M21 4.8l-6.5 6.5"/></svg>`;
  }
  function decorateShareButton(){
    const b=document.getElementById('share');if(!b||b.classList.contains('shareBusy'))return;
    b.innerHTML=`${shareIcon()}<span>${TXT.share}</span>`;
  }
  function setShareBusy(on){
    const b=document.getElementById('share');if(!b)return;
    b.classList.toggle('shareBusy',on);b.disabled=on;
    b.innerHTML=on?`<span class="shareSpinner"></span><span>${TXT.generating}</span>`:`${shareIcon()}<span>${TXT.share}</span>`;
  }

  function setVideoLabel(){
    const b=document.getElementById('play');if(!b)return;
    b.innerHTML=S?.playing?`❚❚ <span>${TXT.pause}</span>`:`▶ <span>${TXT.video}</span>`;
  }

  function updateFade(){
    const list=document.getElementById('solutionList');if(!list)return;
    const more=list.scrollTop+list.clientHeight<list.scrollHeight-3;
    list.classList.toggle('fadeBottom',more);
  }

  function polishResult(){
    if(!window.S?.start)return;
    ensureContext();
    const k=document.querySelector('.solutionKicker');if(k)k.textContent=TXT.solution;
    const m=document.getElementById('mate');if(m)m.style.display='none';
    setVideoLabel();decorateShareButton();requestAnimationFrame(updateFade);
  }

  const list=document.getElementById('solutionList');
  if(list){
    list.addEventListener('scroll',updateFade,{passive:true});
    new MutationObserver(()=>{polishResult();updateFade();scheduleWarmVideo();}).observe(list,{childList:true});
  }
  const result=document.getElementById('result');
  if(result)new MutationObserver(()=>{if(result.classList.contains('active')){setTimeout(()=>{polishResult();scheduleWarmVideo();},0);}}).observe(result,{attributes:true,attributeFilter:['class']});

  if(window.togglePlay){
    const baseToggle=window.togglePlay;
    window.togglePlay=function(){const r=baseToggle.apply(this,arguments);requestAnimationFrame(setVideoLabel);return r;};
  }
  if(window.stopPlay){
    const baseStop=window.stopPlay;
    window.stopPlay=function(){const r=baseStop.apply(this,arguments);requestAnimationFrame(setVideoLabel);return r;};
  }
  const playBtn=document.getElementById('play');if(playBtn)playBtn.onclick=()=>window.togglePlay();

  function preloadPieces(){
    if(preloadPieces.cache)return preloadPieces.cache;
    const chars=['K','Q','R','B','N','P','k','q','r','b','n','p'];
    preloadPieces.cache=Promise.all(chars.map(p=>new Promise((resolve,reject)=>{
      const im=new Image();im.crossOrigin='anonymous';im.onload=()=>resolve([p,im]);im.onerror=reject;im.src=pieceSrc(p);
    }))).then(entries=>Object.fromEntries(entries));
    return preloadPieces.cache;
  }
  function roundRectPath(ctx,x,y,w,h,r){
    r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
  }
  function canvasSquare(index,orientation,bx,by,cell){let r=(index/8)|0,c=index%8;if(orientation==='black'){r=7-r;c=7-c;}return{x:bx+c*cell,y:by+r*cell};}
  function ease(p){return p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;}
  function matedKingIndex(position){if(!position?.b)return-1;const k=position.side==='w'?'K':'k';return position.b.indexOf(k);}
  function moveLabel(index){
    if(!S?.line?.[index])return'';const mv=S.line[index],black=S.start.side==='b';
    if(black){if(index===0)return'1… '+mv.san;const n=Math.floor((index+1)/2)+1;return index%2===1?n+'. '+mv.san:n+'… '+mv.san;}
    const n=Math.floor(index/2)+1;return index%2===0?n+'. '+mv.san:n+'… '+mv.san;
  }
  function solutionText(){
    const rows=[];
    if(S.start.side==='b'){
      rows.push('1… '+S.line[0].san);let n=2;for(let i=1;i<S.line.length;i+=2,n++)rows.push(n+'. '+S.line[i].san+(S.line[i+1]?' '+S.line[i+1].san:''));
    }else{let n=1;for(let i=0;i<S.line.length;i+=2,n++)rows.push(n+'. '+S.line[i].san+(S.line[i+1]?' '+S.line[i+1].san:''));}
    return `${contextText()}\n${rows.join('\n')}`;
  }

  function drawLogo(ctx,W){
    ctx.save();ctx.font='850 31px -apple-system,BlinkMacSystemFont,Arial';
    const word='MateShot',tw=ctx.measureText(word).width,gap=11,d=10,total=d+gap+tw,start=(W-total)/2;
    ctx.fillStyle='#d6ff58';ctx.beginPath();ctx.arc(start+d/2,32,d/2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#f5f6f2';ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillText(word,start+d+gap,42);ctx.restore();
  }

  function drawFrame(ctx,images,position,orientation,opts={}){
    const W=720,H=720,board=580,bx=70,by=58,cell=board/8,radius=15;
    const motion=opts.motionMove||null,highlight=opts.highlightMove||motion,p=opts.progress??1;
    const label=opts.label||'',mateKing=Number.isInteger(opts.mateKing)?opts.mateKing:-1,mateIntensity=Math.max(0,Math.min(1,opts.mateIntensity||0));

    ctx.fillStyle='#090b0d';ctx.fillRect(0,0,W,H);drawLogo(ctx,W);
    ctx.save();roundRectPath(ctx,bx,by,board,board,radius);ctx.clip();
    for(let vr=0;vr<8;vr++)for(let vc=0;vc<8;vc++){ctx.fillStyle=((vr+vc)&1)?'#b98c68':'#f0d9b5';ctx.fillRect(bx+vc*cell,by+vr*cell,cell,cell);}
    if(highlight){const a=canvasSquare(highlight.from,orientation,bx,by,cell),z=canvasSquare(highlight.to,orientation,bx,by,cell);ctx.fillStyle='rgba(214,255,88,.24)';ctx.fillRect(a.x,a.y,cell,cell);ctx.fillStyle='rgba(214,255,88,.43)';ctx.fillRect(z.x,z.y,cell,cell);}
    if(mateKing>=0){const k=canvasSquare(mateKing,orientation,bx,by,cell);ctx.save();ctx.shadowColor=`rgba(255,72,72,${.20+.46*mateIntensity})`;ctx.shadowBlur=8+22*mateIntensity;ctx.fillStyle=`rgba(255,62,62,${.16+.34*mateIntensity})`;ctx.fillRect(k.x,k.y,cell,cell);ctx.strokeStyle=`rgba(255,105,105,${.45+.45*mateIntensity})`;ctx.lineWidth=2+2*mateIntensity;ctx.strokeRect(k.x+2,k.y+2,cell-4,cell-4);ctx.restore();}

    const b=position.b,moving=motion?b[motion.from]:null;
    for(let i=0;i<64;i++){
      const pc=b[i];if(!pc)continue;if(motion&&(i===motion.from||i===motion.to))continue;
      const q=canvasSquare(i,orientation,bx,by,cell);ctx.drawImage(images[pc],q.x+cell*.055,q.y+cell*.055,cell*.89,cell*.89);
    }
    if(motion){
      const captured=b[motion.to];if(captured&&p<.82){const q=canvasSquare(motion.to,orientation,bx,by,cell);ctx.drawImage(images[captured],q.x+cell*.055,q.y+cell*.055,cell*.89,cell*.89);}
      const a=canvasSquare(motion.from,orientation,bx,by,cell),z=canvasSquare(motion.to,orientation,bx,by,cell),e=ease(Math.max(0,Math.min(1,p))),x=a.x+(z.x-a.x)*e,y=a.y+(z.y-a.y)*e;
      if(moving)ctx.drawImage(images[moving],x+cell*.055,y+cell*.055,cell*.89,cell*.89);
    }

    const files=orientation==='black'?'hgfedcba':'abcdefgh',ranks=orientation==='black'?'12345678':'87654321';
    ctx.font='760 9.5px -apple-system,BlinkMacSystemFont,Arial';ctx.textBaseline='top';ctx.textAlign='left';
    for(let vr=0;vr<8;vr++){const dark=(vr&1)===1;ctx.fillStyle=dark?'rgba(247,245,238,.76)':'rgba(92,70,52,.66)';ctx.fillText(ranks[vr],bx+7,by+vr*cell+6);}
    ctx.textBaseline='alphabetic';ctx.textAlign='right';
    for(let vc=0;vc<8;vc++){const dark=((7+vc)&1)===1;ctx.fillStyle=dark?'rgba(247,245,238,.76)':'rgba(92,70,52,.66)';ctx.fillText(files[vc],bx+(vc+1)*cell-7,by+board-6);}
    ctx.restore();
    ctx.save();roundRectPath(ctx,bx,by,board,board,radius);ctx.strokeStyle='rgba(255,255,255,.09)';ctx.lineWidth=1.25;ctx.stroke();ctx.restore();

    ctx.font='760 20px -apple-system,BlinkMacSystemFont,Arial';ctx.textBaseline='alphabetic';
    ctx.fillStyle='#c6ccd3';ctx.textAlign='left';ctx.fillText(contextText(),bx,689,395);
    ctx.textAlign='right';ctx.fillStyle=mateKing>=0?'#ff8585':'#f1f3ee';ctx.font=mateKing>=0?'820 20px -apple-system,BlinkMacSystemFont,Arial':'800 20px -apple-system,BlinkMacSystemFont,Arial';ctx.fillText(mateKing>=0?TXT.checkmate:label,bx+board,689,185);
    ctx.textAlign='left';
  }

  let buildPromise=null;
  function videoKey(){return window.S?.line?`v8|${S.orientation}|${S.start.side}|${S.mateN}|${S.line.map(x=>x.san).join('|')}`:'';}
  async function buildVideo(){
    if(!S?.positions?.length||!S?.line?.length)throw new Error(TXT.error);
    const key=videoKey();
    if(S.v8VideoBlob&&S.v8VideoKey===key)return{blob:S.v8VideoBlob,mime:S.v8VideoMime};
    if(buildPromise)return buildPromise;
    buildPromise=(async()=>{
      const canvas=document.createElement('canvas');canvas.width=720;canvas.height=720;const ctx=canvas.getContext('2d',{alpha:false});
      if(!canvas.captureStream||!window.MediaRecorder)throw new Error(TXT.error);
      const images=await preloadPieces();
      const candidates=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
      const mime=candidates.find(x=>MediaRecorder.isTypeSupported?.(x))||'',fps=24;
      const stream=canvas.captureStream(fps),chunks=[],opts={videoBitsPerSecond:2100000};if(mime)opts.mimeType=mime;
      const rec=new MediaRecorder(stream,opts);rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
      const stopped=new Promise((resolve,reject)=>{rec.onstop=resolve;rec.onerror=e=>reject(e.error||e);});rec.start(200);

      drawFrame(ctx,images,S.positions[0],S.orientation,{label:''});await sleep(250);
      const moveMs=400,holdMs=85;
      for(let i=0;i<S.line.length;i++){
        const frames=Math.max(7,Math.round(moveMs/1000*fps)),before=S.positions[i],after=S.positions[i+1],mv=S.line[i],label=moveLabel(i);
        for(let f=0;f<frames;f++){const p=frames===1?1:f/(frames-1);drawFrame(ctx,images,before,S.orientation,{motionMove:mv,highlightMove:mv,progress:p,label});await sleep(1000/fps);}
        drawFrame(ctx,images,after,S.orientation,{highlightMove:mv,label});await sleep(holdMs);
      }

      const finalPos=S.positions[S.positions.length-1],lastMove=S.line[S.line.length-1],king=matedKingIndex(finalPos);
      const pulseMs=210,gapMs=80,pulseFrames=Math.max(5,Math.round(pulseMs/1000*fps));
      for(let pulse=0;pulse<2;pulse++){
        for(let f=0;f<pulseFrames;f++){const q=pulseFrames===1?1:f/(pulseFrames-1),intensity=Math.sin(Math.PI*q);drawFrame(ctx,images,finalPos,S.orientation,{highlightMove:lastMove,mateKing:king,mateIntensity:intensity,label:TXT.checkmate});await sleep(1000/fps);}
        if(pulse===0)await sleep(gapMs);
      }
      drawFrame(ctx,images,finalPos,S.orientation,{highlightMove:lastMove,mateKing:king,mateIntensity:.2,label:TXT.checkmate});await sleep(650);
      rec.stop();await stopped;stream.getTracks().forEach(x=>x.stop());
      const actual=mime||rec.mimeType||'video/webm',blob=new Blob(chunks,{type:actual});
      S.v8VideoKey=key;S.v8VideoBlob=blob;S.v8VideoMime=actual;return{blob,mime:actual};
    })().finally(()=>{buildPromise=null;});
    return buildPromise;
  }

  let warmTimer=null;
  function scheduleWarmVideo(){
    clearTimeout(warmTimer);warmTimer=setTimeout(()=>{
      if(document.getElementById('result')?.classList.contains('active')&&S?.positions?.length&&S?.line?.length){buildVideo().catch(()=>{});}
    },180);
  }

  async function shareNow(){
    const share=document.getElementById('share');if(!share)return;
    try{
      let ready=S.v8VideoBlob&&S.v8VideoKey===videoKey();
      if(!ready){
        setShareBusy(true);
        await buildVideo();
        setShareBusy(false);
        if(navigator.userActivation&&!navigator.userActivation.isActive){toast(TXT.ready);return;}
      }
      const blob=S.v8VideoBlob,mime=S.v8VideoMime||blob.type||'video/mp4';
      const ext=mime.includes('mp4')?'mp4':'webm';
      const file=new File([blob],`mateshot-mate-${S.mateN}.${ext}`,{type:mime});
      if(!navigator.share){toast(TXT.unavailable);return;}
      if(navigator.canShare&&!navigator.canShare({files:[file]})){toast(TXT.unavailable);return;}
      await navigator.share({files:[file],title:'MateShot',text:solutionText()});
    }catch(e){
      setShareBusy(false);
      if(e?.name==='AbortError')return;
      toast(TXT.unavailable);
    }finally{setShareBusy(false);}
  }

  const share=document.getElementById('share');if(share)share.onclick=shareNow;

  const contextBar=document.querySelector('.contextBar');
  if(contextBar)new MutationObserver(()=>ensureContext()).observe(contextBar,{childList:true,subtree:true,characterData:true});
  if(playBtn)new MutationObserver(()=>{requestAnimationFrame(setVideoLabel);}).observe(playBtn,{childList:true,subtree:true,characterData:true});

  setTimeout(()=>{polishResult();scheduleWarmVideo();},0);
})();