/* MateShot polish v7: compact responsive result UI + square social video share. */
(() => {
  const LANG=(navigator.language||'en').toLowerCase().startsWith('es')?'es':'en';
  const TXT=LANG==='es'?{
    solution:'Solución',play:'Ver solución',pause:'Pausa',share:'Compartir',
    black:'Mueven negras',white:'Mueven blancas',mate:'Mate en',checkmate:'Jaque mate',
    building:'Creando vídeo…',downloaded:'Compartir no está disponible aquí. Vídeo descargado.',
    copied:'Solución copiada',unsupported:'No se puede crear el vídeo en este navegador.'
  }:{
    solution:'Solution',play:'Play solution',pause:'Pause',share:'Share',
    black:'Black to move',white:'White to move',mate:'Mate in',checkmate:'Checkmate',
    building:'Building video…',downloaded:'Sharing is not available here. Video downloaded.',
    copied:'Solution copied',unsupported:'Video creation is not supported in this browser.'
  };

  const style=document.createElement('style');
  style.textContent=`
    .brand{gap:9px!important;letter-spacing:-.035em!important;}
    .brandMark{width:9px!important;height:9px!important;min-width:9px!important;border-radius:50%!important;background:var(--accent)!important;color:transparent!important;font-size:0!important;box-shadow:none!important;}
    .contextBar{justify-content:center!important;padding-left:0!important;}
    #goalPill{display:none!important;}
    #sidePill{height:auto!important;padding:0!important;background:transparent!important;border:0!important;color:#aeb5be!important;font-size:14px!important;font-weight:700!important;letter-spacing:-.01em;}
    #sidePill::before{width:7px!important;height:7px!important;box-shadow:0 0 0 4px rgba(214,255,88,.06);}
    .mate{display:none!important;}
    #prev,#next,.speed,#download{display:none!important;}
    .controls{display:block!important;width:100%!important;}
    .controls .play{width:100%!important;}
    .actions{display:block!important;width:100%!important;}
    #share{width:100%!important;}
    .solutionKicker{display:block!important;text-transform:none!important;letter-spacing:-.035em!important;color:#f5f6f3!important;font-weight:850!important;}
    .solutionList{display:flex!important;flex-direction:column!important;gap:7px!important;overflow-y:auto!important;overscroll-behavior:contain;scrollbar-width:none;padding-right:3px;position:relative;}
    .solutionList::-webkit-scrollbar{display:none;}
    .solutionList.fadeBottom{-webkit-mask-image:linear-gradient(to bottom,#000 0%,#000 78%,transparent 100%);mask-image:linear-gradient(to bottom,#000 0%,#000 78%,transparent 100%);}
    .solutionRow{flex:0 0 auto;}

    @media(max-width:760px){
      .resultView{align-items:flex-start!important;overflow:hidden!important;padding:0 16px 12px!important;}
      .resultGrid{gap:12px!important;padding-bottom:0!important;width:100%!important;}
      .contextBar{order:1!important;margin-top:2px;}
      .boardWrap{order:2!important;width:min(88vw,44dvh,540px)!important;}
      .solutionPanel{
        order:3!important;width:min(100%,720px)!important;display:grid!important;
        grid-template-columns:minmax(0,1.12fr) minmax(136px,.88fr)!important;
        grid-template-areas:"title title" "moves controls" "moves actions" "note note"!important;
        column-gap:18px!important;row-gap:10px!important;align-items:center!important;
      }
      .solutionKicker{grid-area:title!important;font-size:22px!important;line-height:1!important;margin-top:2px;}
      .solutionList{grid-area:moves!important;max-height:176px!important;align-self:start!important;}
      .solutionRow{padding:8px 9px!important;font-size:12px!important;border-radius:11px!important;}
      .solutionRow strong{font-size:13.5px!important;}
      .solutionRow .n{width:26px!important;}
      .controls{grid-area:controls!important;align-self:end!important;}
      .controls .play{height:62px!important;border-radius:18px!important;font-size:15px!important;padding:0 12px!important;}
      .actions{grid-area:actions!important;align-self:start!important;}
      .action{height:62px!important;border-radius:18px!important;font-size:15px!important;padding:0 10px!important;}
      .exportNote{grid-area:note!important;min-height:0!important;}
    }

    @media(max-width:380px){
      .solutionPanel{grid-template-columns:minmax(0,1.08fr) minmax(124px,.92fr)!important;column-gap:12px!important;}
      .boardWrap{width:min(86vw,42dvh,520px)!important;}
      .solutionList{max-height:164px!important;}
      .controls .play,.action{height:58px!important;font-size:14px!important;}
    }

    @media(min-width:761px){
      .contextBar{grid-column:1!important;grid-row:1!important;width:100%!important;text-align:center!important;}
      .solutionPanel{display:flex!important;flex-direction:column!important;gap:14px!important;}
      .solutionKicker{font-size:30px!important;line-height:1!important;margin-bottom:2px;}
      .solutionList{width:82%!important;max-height:282px!important;}
      .solutionRow{padding:10px 11px!important;}
      .controls,.actions{width:100%!important;}
      .controls .play,.action{height:54px!important;}
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
    toast._t=setTimeout(()=>el.classList.remove('show'),2100);
  }

  function contextText(){
    if(!window.S?.start)return'';
    const side=S.start.side==='b'?TXT.black:TXT.white;
    return `${side} · ${TXT.mate} ${S.mateN}`;
  }

  function decorateShareButton(){
    const share=document.getElementById('share');if(!share)return;
    share.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M9 9.2l4.3 2.8L9 14.8z" fill="currentColor" stroke="none"/><path d="M15.5 5H21v5.5"/><path d="M21 5l-6.2 6.2"/></svg><span>${TXT.share}</span>`;
  }

  function updateFade(){
    const list=document.getElementById('solutionList');if(!list)return;
    const more=list.scrollTop+list.clientHeight<list.scrollHeight-3;
    list.classList.toggle('fadeBottom',more);
  }

  function polishResult(){
    if(!window.S?.start)return;
    const side=document.getElementById('sidePill');if(side)side.textContent=contextText();
    const kicker=document.querySelector('.solutionKicker');if(kicker)kicker.textContent=TXT.solution;
    const mate=document.getElementById('mate');if(mate)mate.style.display='none';
    const play=document.getElementById('play');
    if(play&&!S.playing)play.innerHTML=`▶ <span>${TXT.play}</span>`;
    decorateShareButton();
    requestAnimationFrame(updateFade);
  }

  const list=document.getElementById('solutionList');
  if(list){
    list.addEventListener('scroll',updateFade,{passive:true});
    new MutationObserver(()=>{polishResult();updateFade();}).observe(list,{childList:true});
  }
  const result=document.getElementById('result');
  if(result)new MutationObserver(()=>{if(result.classList.contains('active'))setTimeout(polishResult,0);}).observe(result,{attributes:true,attributeFilter:['class']});

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
  function canvasSquare(index,orientation,bx,by,cell){
    let r=(index/8)|0,c=index%8;if(orientation==='black'){r=7-r;c=7-c;}return{x:bx+c*cell,y:by+r*cell};
  }
  function ease(p){return p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;}
  function matedKingIndex(position){
    if(!position?.b)return-1;const k=position.side==='w'?'K':'k';return position.b.indexOf(k);
  }
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
    ctx.save();
    ctx.font='800 27px -apple-system,BlinkMacSystemFont,Arial';
    const word='MateShot',tw=ctx.measureText(word).width,gap=10,d=9,total=d+gap+tw,start=(W-total)/2;
    ctx.fillStyle='#d6ff58';ctx.beginPath();ctx.arc(start+d/2,42,d/2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#f5f6f2';ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillText(word,start+d+gap,50);
    ctx.restore();
  }

  function drawSquareFrame(ctx,images,position,orientation,opts={}){
    const W=720,H=720,board=560,bx=80,by=80,cell=board/8,radius=15;
    const motion=opts.motionMove||null,highlight=opts.highlightMove||motion,p=opts.progress??1;
    const label=opts.label||'',mateKing=Number.isInteger(opts.mateKing)?opts.mateKing:-1,mateIntensity=Math.max(0,Math.min(1,opts.mateIntensity||0));

    ctx.fillStyle='#090b0d';ctx.fillRect(0,0,W,H);drawLogo(ctx,W);
    ctx.save();roundRectPath(ctx,bx,by,board,board,radius);ctx.clip();
    for(let vr=0;vr<8;vr++)for(let vc=0;vc<8;vc++){ctx.fillStyle=((vr+vc)&1)?'#b98c68':'#f0d9b5';ctx.fillRect(bx+vc*cell,by+vr*cell,cell,cell);}

    if(highlight){const a=canvasSquare(highlight.from,orientation,bx,by,cell),z=canvasSquare(highlight.to,orientation,bx,by,cell);ctx.fillStyle='rgba(214,255,88,.24)';ctx.fillRect(a.x,a.y,cell,cell);ctx.fillStyle='rgba(214,255,88,.43)';ctx.fillRect(z.x,z.y,cell,cell);}
    if(mateKing>=0){const k=canvasSquare(mateKing,orientation,bx,by,cell);ctx.save();ctx.shadowColor=`rgba(255,72,72,${.20+.46*mateIntensity})`;ctx.shadowBlur=8+22*mateIntensity;ctx.fillStyle=`rgba(255,62,62,${.16+.34*mateIntensity})`;ctx.fillRect(k.x,k.y,cell,cell);ctx.strokeStyle=`rgba(255,105,105,${.45+.45*mateIntensity})`;ctx.lineWidth=2+2*mateIntensity;ctx.strokeRect(k.x+2,k.y+2,cell-4,cell-4);ctx.restore();}

    const b=position.b,moving=motion?b[motion.from]:null;
    for(let i=0;i<64;i++){const pc=b[i];if(!pc)continue;if(motion&&(i===motion.from||i===motion.to))continue;const q=canvasSquare(i,orientation,bx,by,cell);ctx.drawImage(images[pc],q.x+cell*.055,q.y+cell*.055,cell*.89,cell*.89);}
    if(motion){const captured=b[motion.to];if(captured&&p<.82){const q=canvasSquare(motion.to,orientation,bx,by,cell);ctx.drawImage(images[captured],q.x+cell*.055,q.y+cell*.055,cell*.89,cell*.89);}const a=canvasSquare(motion.from,orientation,bx,by,cell),z=canvasSquare(motion.to,orientation,bx,by,cell),e=ease(Math.max(0,Math.min(1,p))),x=a.x+(z.x-a.x)*e,y=a.y+(z.y-a.y)*e;if(moving)ctx.drawImage(images[moving],x+cell*.055,y+cell*.055,cell*.89,cell*.89);}

    const files=orientation==='black'?'hgfedcba':'abcdefgh',ranks=orientation==='black'?'12345678':'87654321';
    ctx.font='760 9.5px -apple-system,BlinkMacSystemFont,Arial';ctx.textBaseline='top';ctx.textAlign='left';
    for(let vr=0;vr<8;vr++){const dark=(vr&1)===1;ctx.fillStyle=dark?'rgba(247,245,238,.76)':'rgba(92,70,52,.66)';ctx.fillText(ranks[vr],bx+7,by+vr*cell+6);}
    ctx.textBaseline='alphabetic';ctx.textAlign='right';
    for(let vc=0;vc<8;vc++){const dark=((7+vc)&1)===1;ctx.fillStyle=dark?'rgba(247,245,238,.76)':'rgba(92,70,52,.66)';ctx.fillText(files[vc],bx+(vc+1)*cell-7,by+board-6);}
    ctx.restore();
    ctx.save();roundRectPath(ctx,bx,by,board,board,radius);ctx.strokeStyle='rgba(255,255,255,.09)';ctx.lineWidth=1.25;ctx.stroke();ctx.restore();

    ctx.font='750 19px -apple-system,BlinkMacSystemFont,Arial';ctx.textBaseline='alphabetic';
    ctx.fillStyle='#c6ccd3';ctx.textAlign='left';ctx.fillText(contextText(),bx,684,360);
    ctx.fillStyle=mateKing>=0?'#ff8585':'#f2f4ef';ctx.textAlign='right';ctx.font=mateKing>=0?'800 20px -apple-system,BlinkMacSystemFont,Arial':'800 19px -apple-system,BlinkMacSystemFont,Arial';ctx.fillText(label,bx+board,684,250);
    ctx.textAlign='left';
  }

  async function buildSquareVideo(){
    if(!S?.positions?.length||!S?.line?.length)throw new Error(TXT.unsupported);
    const key=`square-v7|${S.orientation}|${S.start.side}|${S.mateN}|${S.line.map(x=>x.san).join(',')}`;
    if(S.squareVideoKey===key&&S.squareVideoBlob)return{blob:S.squareVideoBlob,mime:S.squareVideoMime};
    const canvas=document.createElement('canvas');canvas.width=720;canvas.height=720;const ctx=canvas.getContext('2d',{alpha:false});
    if(!canvas.captureStream||!window.MediaRecorder)throw new Error(TXT.unsupported);
    const images=await preloadPieces();
    const candidates=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
    const mime=candidates.find(x=>MediaRecorder.isTypeSupported?.(x))||'',fps=24,stream=canvas.captureStream(fps),chunks=[],opts={videoBitsPerSecond:2100000};if(mime)opts.mimeType=mime;
    const rec=new MediaRecorder(stream,opts);rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};const stopped=new Promise((resolve,reject)=>{rec.onstop=resolve;rec.onerror=e=>reject(e.error||e);});rec.start(200);
    drawSquareFrame(ctx,images,S.positions[0],S.orientation,{label:''});await sleep(240);
    const moveMs=420,holdMs=90;
    for(let i=0;i<S.line.length;i++){
      const frames=Math.max(7,Math.round(moveMs/1000*fps)),before=S.positions[i],after=S.positions[i+1],mv=S.line[i],label=moveLabel(i);
      for(let f=0;f<frames;f++){drawSquareFrame(ctx,images,before,S.orientation,{motionMove:mv,highlightMove:mv,progress:f/(frames-1),label});await sleep(1000/fps);}
      drawSquareFrame(ctx,images,after,S.orientation,{highlightMove:mv,label});await sleep(holdMs);
    }
    const final=S.positions[S.positions.length-1],last=S.line[S.line.length-1],king=matedKingIndex(final),pulseMs=210,gap=75,frames=Math.max(5,Math.round(pulseMs/1000*fps));
    for(let pulse=0;pulse<2;pulse++){
      for(let f=0;f<frames;f++){const q=f/(frames-1),intensity=Math.sin(Math.PI*q);drawSquareFrame(ctx,images,final,S.orientation,{highlightMove:last,mateKing:king,mateIntensity:intensity,label:TXT.checkmate});await sleep(1000/fps);}
      if(pulse===0)await sleep(gap);
    }
    drawSquareFrame(ctx,images,final,S.orientation,{highlightMove:last,mateKing:king,mateIntensity:.2,label:TXT.checkmate});await sleep(650);
    rec.stop();await stopped;stream.getTracks().forEach(t=>t.stop());const actual=mime||rec.mimeType||'video/webm',blob=new Blob(chunks,{type:actual});S.squareVideoKey=key;S.squareVideoBlob=blob;S.squareVideoMime=actual;return{blob,mime:actual};
  }

  function extension(mime){return mime.includes('mp4')?'mp4':'webm';}
  function downloadBlob(blob,mime){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`mateshot-mate-${S.mateN}.${extension(mime)}`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}

  async function shareSquare(){
    const btn=document.getElementById('share'),label=btn?.querySelector('span'),note=document.getElementById('exportNote');if(!btn||!label)return;
    const old=label.textContent;label.textContent=TXT.building;btn.disabled=true;if(note)note.textContent='';
    try{
      const{blob,mime}=await buildSquareVideo(),file=new File([blob],`mateshot-mate-${S.mateN}.${extension(mime)}`,{type:mime});
      if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
        try{await navigator.share({files:[file],title:'MateShot',text:solutionText()});return;}
        catch(e){if(e?.name==='AbortError')return;}
      }
      downloadBlob(blob,mime);
      try{await navigator.clipboard?.writeText(solutionText());}catch(e){}
      toast(TXT.downloaded);
    }catch(e){if(note)note.textContent=e?.message||TXT.unsupported;}
    finally{btn.disabled=false;label.textContent=old;}
  }

  const share=document.getElementById('share');if(share)share.onclick=shareSquare;
  window.addEventListener('resize',()=>requestAnimationFrame(updateFade),{passive:true});
  setTimeout(polishResult,0);
})();
