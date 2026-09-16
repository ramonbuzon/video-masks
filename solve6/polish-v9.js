/* MateShot polish v9: compact prompt, more readable square video, share/download fallback. */
(() => {
  const LANG=(navigator.language||'en').toLowerCase().startsWith('es')?'es':'en';
  const TXT=LANG==='es'?{
    black:'Mueven negras',white:'Mueven blancas',mate:'Mate en',checkmate:'Jaque mate',share:'Compartir',
    generating:'Generating…',downloaded:'El navegador no permite compartir directamente. Vídeo descargado.',error:'No se ha podido preparar el vídeo.'
  }:{
    black:'Black to move',white:'White to move',mate:'Mate in',checkmate:'Checkmate',share:'Share',
    generating:'Generating…',downloaded:'Direct sharing is unavailable. Video downloaded instead.',error:'Could not prepare the video.'
  };

  const css=document.createElement('style');
  css.textContent=`
    .contextBar{display:none!important;}
    .solutionKicker{
      display:block!important;color:#9aa1aa!important;font-weight:720!important;
      letter-spacing:-.025em!important;text-transform:none!important;line-height:1.14!important;
    }
    .solutionKicker::before{display:none!important;content:none!important;}
    @media(max-width:760px){
      .solutionKicker{font-size:20px!important;margin:2px 0 2px!important;}
    }
    @media(max-width:390px){
      .solutionKicker{font-size:18.5px!important;}
    }
    @media(min-width:761px){
      .solutionKicker{font-size:22px!important;margin:0 0 2px!important;}
    }
  `;
  document.head.appendChild(css);

  const PIECE_BASE='https://lichess1.org/assets/piece/cburnett/';
  const pieceCode=p=>(p===p.toUpperCase()?'w':'b')+p.toUpperCase();
  const pieceSrc=p=>PIECE_BASE+pieceCode(p)+'.svg';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  function contextText(){
    if(!window.S?.start)return'';
    const side=S.start.side==='b'?TXT.black:TXT.white;
    return `${side} · ${TXT.mate} ${S.mateN}`;
  }

  function syncPromptTitle(){
    if(!window.S?.start)return;
    const k=document.querySelector('.solutionKicker');
    const t=contextText();
    if(k&&t&&k.textContent!==t)k.textContent=t;
  }

  const kicker=document.querySelector('.solutionKicker');
  if(kicker)new MutationObserver(()=>queueMicrotask(syncPromptTitle)).observe(kicker,{childList:true,subtree:true,characterData:true});
  const result=document.getElementById('result');
  if(result)new MutationObserver(()=>{if(result.classList.contains('active'))setTimeout(()=>{syncPromptTitle();suppressOldWarm();scheduleWarm();},30);}).observe(result,{attributes:true,attributeFilter:['class']});
  const list=document.getElementById('solutionList');
  if(list)new MutationObserver(()=>setTimeout(()=>{syncPromptTitle();suppressOldWarm();scheduleWarm();},0)).observe(list,{childList:true});

  function oldKey(){
    return window.S?.line?`v8|${S.orientation}|${S.start.side}|${S.mateN}|${S.line.map(x=>x.san).join('|')}`:'';
  }
  function suppressOldWarm(){
    const k=oldKey();if(!k)return;
    S.v8VideoKey=k;S.v8VideoBlob=new Blob([''],{type:'video/mp4'});S.v8VideoMime='video/mp4';
  }

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
    ctx.save();ctx.font='850 32px -apple-system,BlinkMacSystemFont,Arial';
    const word='MateShot',tw=ctx.measureText(word).width,gap=12,d=10,total=d+gap+tw,start=(W-total)/2;
    ctx.fillStyle='#d6ff58';ctx.beginPath();ctx.arc(start+d/2,38,d/2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#f5f6f2';ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillText(word,start+d+gap,48);ctx.restore();
  }

  function drawFrame(ctx,images,position,orientation,opts={}){
    const W=720,H=720,board=548,bx=86,by=82,cell=board/8,radius=14;
    const motion=opts.motionMove||null,highlight=opts.highlightMove||motion,p=opts.progress??1;
    const label=opts.label||'',mateKing=Number.isInteger(opts.mateKing)?opts.mateKing:-1,mateIntensity=Math.max(0,Math.min(1,opts.mateIntensity||0));

    ctx.fillStyle='#090b0d';ctx.fillRect(0,0,W,H);drawLogo(ctx,W);
    ctx.save();roundRectPath(ctx,bx,by,board,board,radius);ctx.clip();
    for(let vr=0;vr<8;vr++)for(let vc=0;vc<8;vc++){
      ctx.fillStyle=((vr+vc)&1)?'#b98c68':'#f0d9b5';ctx.fillRect(bx+vc*cell,by+vr*cell,cell,cell);
    }
    if(highlight){
      const a=canvasSquare(highlight.from,orientation,bx,by,cell),z=canvasSquare(highlight.to,orientation,bx,by,cell);
      ctx.fillStyle='rgba(214,255,88,.24)';ctx.fillRect(a.x,a.y,cell,cell);
      ctx.fillStyle='rgba(214,255,88,.43)';ctx.fillRect(z.x,z.y,cell,cell);
    }
    if(mateKing>=0){
      const k=canvasSquare(mateKing,orientation,bx,by,cell);ctx.save();
      ctx.shadowColor=`rgba(255,72,72,${.20+.46*mateIntensity})`;ctx.shadowBlur=8+22*mateIntensity;
      ctx.fillStyle=`rgba(255,62,62,${.16+.34*mateIntensity})`;ctx.fillRect(k.x,k.y,cell,cell);
      ctx.strokeStyle=`rgba(255,105,105,${.45+.45*mateIntensity})`;ctx.lineWidth=2+2*mateIntensity;ctx.strokeRect(k.x+2,k.y+2,cell-4,cell-4);ctx.restore();
    }

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

    const baseline=681;
    ctx.textBaseline='alphabetic';ctx.textAlign='left';ctx.font='760 26px -apple-system,BlinkMacSystemFont,Arial';ctx.fillStyle='#d6dae0';
    ctx.fillText(contextText(),bx,baseline,410);
    ctx.textAlign='right';ctx.fillStyle=mateKing>=0?'#ff8585':'#f2f4ef';ctx.font=mateKing>=0?'820 25px -apple-system,BlinkMacSystemFont,Arial':'800 25px -apple-system,BlinkMacSystemFont,Arial';
    ctx.fillText(mateKing>=0?TXT.checkmate:label,bx+board,baseline,180);ctx.textAlign='left';
  }

  let buildPromise=null;
  function videoKey(){return window.S?.line?`v9|${S.orientation}|${S.start.side}|${S.mateN}|${S.line.map(x=>x.san).join('|')}`:'';}
  async function buildVideo(){
    if(!S?.positions?.length||!S?.line?.length)throw new Error(TXT.error);
    const key=videoKey();
    if(S.v9VideoBlob&&S.v9VideoKey===key)return{blob:S.v9VideoBlob,mime:S.v9VideoMime};
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
      S.v9VideoKey=key;S.v9VideoBlob=blob;S.v9VideoMime=actual;return{blob,mime:actual};
    })().finally(()=>{buildPromise=null;});
    return buildPromise;
  }

  function toast(msg){
    const el=document.getElementById('toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('show'),2500);
  }
  function shareIcon(){
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.8" y="6.4" width="12.8" height="11.2" rx="2.4"/><path d="M8.2 9.4l4 2.6-4 2.6z" fill="currentColor" stroke="none"/><path d="M15.3 4.8H21v5.7"/><path d="M21 4.8l-6.5 6.5"/></svg>`;
  }
  function setBusy(on){
    const b=document.getElementById('share');if(!b)return;b.disabled=on;b.classList.toggle('shareBusy',on);
    b.innerHTML=on?`<span class="shareSpinner"></span><span>${TXT.generating}</span>`:`${shareIcon()}<span>${TXT.share}</span>`;
  }
  function downloadBlob(blob,mime){
    const ext=(mime||blob.type||'').includes('mp4')?'mp4':'webm',url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`mateshot-mate-${S.mateN}.${ext}`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
  }

  async function shareNow(){
    const b=document.getElementById('share');if(!b)return;
    try{
      let ready=S.v9VideoBlob&&S.v9VideoKey===videoKey();
      if(!ready){setBusy(true);await buildVideo();setBusy(false);}
      const blob=S.v9VideoBlob,mime=S.v9VideoMime||blob.type||'video/mp4',ext=mime.includes('mp4')?'mp4':'webm';
      const file=new File([blob],`mateshot-mate-${S.mateN}.${ext}`,{type:mime});
      const canNative=!!navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}));
      if(canNative){
        try{await navigator.share({files:[file],title:'MateShot',text:solutionText()});return;}
        catch(e){if(e?.name==='AbortError')return;}
      }
      downloadBlob(blob,mime);toast(TXT.downloaded);
    }catch(e){toast(TXT.error);}finally{setBusy(false);}
  }

  let warmTimer=null;
  function scheduleWarm(){
    clearTimeout(warmTimer);warmTimer=setTimeout(()=>{
      if(document.getElementById('result')?.classList.contains('active')&&S?.positions?.length&&S?.line?.length)buildVideo().catch(()=>{});
    },260);
  }

  const share=document.getElementById('share');if(share)share.onclick=shareNow;
  suppressOldWarm();syncPromptTitle();scheduleWarm();
})();
