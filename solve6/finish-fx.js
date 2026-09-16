/* MateShot finish FX v5: repeatable mate pulse + video coordinates. */
(() => {
  const LANG=(navigator.language||'en').toLowerCase().startsWith('es')?'es':'en';
  const TXT=LANG==='es'?{
    sideB:'Mueven negras',sideW:'Mueven blancas',forced:'Mate forzado en',mate:'Mate en',checkmate:'Jaque mate',
    rendering:'Creando vídeo…',downloaded:'Vídeo descargado',shareFallback:'No se puede abrir Compartir aquí. He descargado el vídeo.',unsupported:'Este navegador todavía no permite exportar el vídeo.',copied:'Solución copiada'
  }:{
    sideB:'Black to move',sideW:'White to move',forced:'Forced mate in',mate:'Mate in',checkmate:'Checkmate',
    rendering:'Building video…',downloaded:'Video downloaded',shareFallback:'Sharing is blocked here, so I downloaded the video instead.',unsupported:'Video export is not supported by this browser yet.',copied:'Solution copied'
  };

  const PIECE_BASE='https://lichess1.org/assets/piece/cburnett/';
  const pieceCode=p=>(p===p.toUpperCase()?'w':'b')+p.toUpperCase();
  const pieceSrc=p=>PIECE_BASE+pieceCode(p)+'.svg';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  function toast(msg){
    const el=document.getElementById('toast');if(!el)return;
    el.textContent=msg;el.classList.add('show');clearTimeout(toast._t);
    toast._t=setTimeout(()=>el.classList.remove('show'),1800);
  }

  function preloadPieces(){
    if(preloadPieces.cache)return preloadPieces.cache;
    const chars=['K','Q','R','B','N','P','k','q','r','b','n','p'];
    preloadPieces.cache=Promise.all(chars.map(p=>new Promise((resolve,reject)=>{
      const im=new Image();im.crossOrigin='anonymous';im.onload=()=>resolve([p,im]);im.onerror=reject;im.src=pieceSrc(p);
    }))).then(x=>Object.fromEntries(x));
    return preloadPieces.cache;
  }

  function roundRectPath(ctx,x,y,w,h,r){
    r=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  function canvasSquare(index,orientation,bx,by,cell){
    let r=(index/8)|0,c=index%8;
    if(orientation==='black'){r=7-r;c=7-c;}
    return{x:bx+c*cell,y:by+r*cell};
  }

  function ease(p){return p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;}

  function currentMoveLabel(index){
    if(!S?.line?.[index])return'';
    const mv=S.line[index],startsBlack=S.start.side==='b';
    if(startsBlack){
      if(index===0)return'1… '+mv.san;
      const n=Math.floor((index+1)/2)+1;
      return index%2===1?n+'. '+mv.san:n+'… '+mv.san;
    }
    const n=Math.floor(index/2)+1;
    return index%2===0?n+'. '+mv.san:n+'… '+mv.san;
  }

  function matedKingIndex(position){
    if(!position?.b)return-1;
    const k=position.side==='w'?'K':'k';
    return position.b.indexOf(k);
  }

  function drawScene(ctx,images,position,orientation,opts={}){
    const W=720,H=720,board=560,bx=80,by=80,cell=board/8,radius=15;
    const motion=opts.motionMove||null,highlight=opts.highlightMove||motion;
    const p=opts.progress??1,label=opts.label||'';
    const mateKing=Number.isInteger(opts.mateKing)?opts.mateKing:-1;
    const mateIntensity=Math.max(0,Math.min(1,opts.mateIntensity||0));
    const labelAlpha=opts.labelAlpha==null?1:opts.labelAlpha;

    ctx.fillStyle='#090b0d';ctx.fillRect(0,0,W,H);

    ctx.save();
    ctx.font='800 26px -apple-system,BlinkMacSystemFont,Arial';
    const logoText='MateShot',tw=ctx.measureText(logoText).width,total=tw+22,startX=(W-total)/2;
    ctx.fillStyle='#d6ff58';ctx.beginPath();ctx.arc(startX+5,39,5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#f5f6f2';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(logoText,startX+18,39);
    ctx.restore();

    ctx.save();
    roundRectPath(ctx,bx,by,board,board,radius);
    ctx.clip();

    for(let vr=0;vr<8;vr++)for(let vc=0;vc<8;vc++){
      ctx.fillStyle=((vr+vc)&1)?'#b98c68':'#f0d9b5';
      ctx.fillRect(bx+vc*cell,by+vr*cell,cell,cell);
    }

    if(highlight){
      const hs=canvasSquare(highlight.from,orientation,bx,by,cell);
      const ht=canvasSquare(highlight.to,orientation,bx,by,cell);
      ctx.fillStyle='rgba(214,255,88,.24)';ctx.fillRect(hs.x,hs.y,cell,cell);
      ctx.fillStyle='rgba(214,255,88,.43)';ctx.fillRect(ht.x,ht.y,cell,cell);
    }

    if(mateKing>=0){
      const k=canvasSquare(mateKing,orientation,bx,by,cell);
      const a=.16+.34*mateIntensity;
      ctx.save();
      ctx.shadowColor=`rgba(255,72,72,${.20+.45*mateIntensity})`;
      ctx.shadowBlur=8+22*mateIntensity;
      ctx.fillStyle=`rgba(255,62,62,${a})`;
      ctx.fillRect(k.x,k.y,cell,cell);
      ctx.strokeStyle=`rgba(255,105,105,${.45+.45*mateIntensity})`;
      ctx.lineWidth=2+2*mateIntensity;
      ctx.strokeRect(k.x+2,k.y+2,cell-4,cell-4);
      ctx.restore();
    }

    const b=position.b;
    const moving=motion?b[motion.from]:null;

    for(let i=0;i<64;i++){
      const pc=b[i];if(!pc)continue;
      if(motion&&(i===motion.from||i===motion.to))continue;
      const q=canvasSquare(i,orientation,bx,by,cell);
      ctx.drawImage(images[pc],q.x+cell*.055,q.y+cell*.055,cell*.89,cell*.89);
    }

    if(motion){
      const captured=b[motion.to];
      if(captured&&p<.82){
        const z=canvasSquare(motion.to,orientation,bx,by,cell);
        ctx.drawImage(images[captured],z.x+cell*.055,z.y+cell*.055,cell*.89,cell*.89);
      }
      const a=canvasSquare(motion.from,orientation,bx,by,cell);
      const z=canvasSquare(motion.to,orientation,bx,by,cell);
      const e=ease(Math.max(0,Math.min(1,p)));
      const x=a.x+(z.x-a.x)*e,y=a.y+(z.y-a.y)*e;
      if(moving)ctx.drawImage(images[moving],x+cell*.055,y+cell*.055,cell*.89,cell*.89);
    }

    const files=orientation==='black'?'hgfedcba':'abcdefgh';
    const ranks=orientation==='black'?'12345678':'87654321';
    ctx.font='760 10px -apple-system,BlinkMacSystemFont,Arial';
    ctx.textBaseline='top';ctx.textAlign='left';
    for(let vr=0;vr<8;vr++){
      const isDark=((vr+0)&1)===1;
      ctx.fillStyle=isDark?'rgba(247,245,238,.76)':'rgba(92,70,52,.66)';
      ctx.fillText(ranks[vr],bx+6,by+vr*cell+5);
    }
    ctx.textBaseline='alphabetic';ctx.textAlign='right';
    for(let vc=0;vc<8;vc++){
      const isDark=((7+vc)&1)===1;
      ctx.fillStyle=isDark?'rgba(247,245,238,.76)':'rgba(92,70,52,.66)';
      ctx.fillText(files[vc],bx+(vc+1)*cell-6,by+board-5);
    }
    ctx.restore();

    ctx.save();
    roundRectPath(ctx,bx,by,board,board,radius);
    ctx.strokeStyle='rgba(255,255,255,.10)';ctx.lineWidth=1.4;ctx.stroke();
    ctx.restore();

    const side=S.start.side==='b'?TXT.sideB:TXT.sideW;
    const context=side+' · '+TXT.mate+' '+S.mateN;
    ctx.font='750 20px -apple-system,BlinkMacSystemFont,Arial';ctx.textBaseline='middle';
    ctx.fillStyle='#f2f4ef';ctx.textAlign='left';ctx.fillText(context,bx,681);
    ctx.save();ctx.globalAlpha=labelAlpha;
    ctx.fillStyle=mateKing>=0?'#ff8585':'#c6ccd3';
    ctx.font=mateKing>=0?'800 20px -apple-system,BlinkMacSystemFont,Arial':'750 20px -apple-system,BlinkMacSystemFont,Arial';
    ctx.textAlign='right';ctx.fillText(label,bx+board,681);
    ctx.restore();ctx.textAlign='left';
  }

  async function buildVideoPro(){
    if(!S?.positions?.length||!S?.line?.length)throw new Error('No solution');
    const key='v6-square|'+S.orientation+'|'+S.start.side+'|'+S.mateN+'|'+notation(S.line,S.start.side);
    if(S.finishVideoBlob&&S.finishVideoKey===key)return{blob:S.finishVideoBlob,mime:S.finishVideoMime};

    const canvas=document.createElement('canvas');canvas.width=720;canvas.height=720;
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!canvas.captureStream||!window.MediaRecorder)throw new Error(TXT.unsupported);
    const images=await preloadPieces();

    const candidates=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
    const mime=candidates.find(x=>MediaRecorder.isTypeSupported?.(x))||'',fps=24;
    const stream=canvas.captureStream(fps),chunks=[],opts={videoBitsPerSecond:1800000};
    if(mime)opts.mimeType=mime;
    const rec=new MediaRecorder(stream,opts);
    rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
    const stopped=new Promise((resolve,reject)=>{rec.onstop=resolve;rec.onerror=e=>reject(e.error||e);});
    rec.start(200);

    drawScene(ctx,images,S.positions[0],S.orientation,{label:''});
    await sleep(280);

    const moveMs=420,holdMs=95;
    for(let i=0;i<S.line.length;i++){
      const frames=Math.max(7,Math.round(moveMs/1000*fps));
      const before=S.positions[i],after=S.positions[i+1],mv=S.line[i],moveLabel=currentMoveLabel(i);
      for(let f=0;f<frames;f++){
        const p=frames===1?1:f/(frames-1);
        drawScene(ctx,images,before,S.orientation,{motionMove:mv,highlightMove:mv,progress:p,label:moveLabel});
        await sleep(1000/fps);
      }
      drawScene(ctx,images,after,S.orientation,{highlightMove:mv,label:moveLabel});
      await sleep(holdMs);
    }

    const finalPos=S.positions[S.positions.length-1];
    const lastMove=S.line[S.line.length-1];
    const king=matedKingIndex(finalPos);

    const pulseMs=220,gapMs=90,pulseFrames=Math.max(5,Math.round(pulseMs/1000*fps));
    for(let pulse=0;pulse<2;pulse++){
      for(let f=0;f<pulseFrames;f++){
        const q=pulseFrames===1?1:f/(pulseFrames-1);
        const intensity=Math.sin(Math.PI*q);
        const alpha=Math.min(1,(pulse*pulseMs+f*(1000/fps))/220);
        drawScene(ctx,images,finalPos,S.orientation,{
          highlightMove:lastMove,mateKing:king,mateIntensity:intensity,label:TXT.checkmate,labelAlpha:alpha
        });
        await sleep(1000/fps);
      }
      if(pulse===0){
        drawScene(ctx,images,finalPos,S.orientation,{highlightMove:lastMove,mateKing:king,mateIntensity:.12,label:TXT.checkmate,labelAlpha:1});
        await sleep(gapMs);
      }
    }

    drawScene(ctx,images,finalPos,S.orientation,{highlightMove:lastMove,mateKing:king,mateIntensity:.22,label:TXT.checkmate,labelAlpha:1});
    await sleep(760);

    rec.stop();await stopped;stream.getTracks().forEach(x=>x.stop());
    const actual=mime||rec.mimeType||'video/webm';
    const blob=new Blob(chunks,{type:actual});
    S.finishVideoKey=key;S.finishVideoBlob=blob;S.finishVideoMime=actual;
    return{blob,mime:actual};
  }

  const ext=mime=>mime.includes('mp4')?'mp4':'webm';
  function solutionText(){
    const rows=[];
    if(S.start.side==='b'){
      rows.push('1… '+S.line[0].san);
      let no=2;for(let i=1;i<S.line.length;i+=2,no++)rows.push(no+'. '+S.line[i].san+(S.line[i+1]?' '+S.line[i+1].san:''));
    }else{
      let no=1;for(let i=0;i<S.line.length;i+=2,no++)rows.push(no+'. '+S.line[i].san+(S.line[i+1]?' '+S.line[i+1].san:''));
    }
    return TXT.mate+' '+S.mateN+'\n'+rows.join('\n');
  }

  function saveVideoBlob(blob,mime){
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='mateshot-mate-'+S.mateN+'.'+ext(mime);document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),4000);
  }

  async function downloadPro(){
    const btn=document.getElementById('download'),label=btn?.querySelector('span'),note=document.getElementById('exportNote');
    if(!btn||!label)return;
    const old=label.textContent;label.textContent=TXT.rendering;btn.disabled=true;if(note)note.textContent='';
    try{const{blob,mime}=await buildVideoPro();saveVideoBlob(blob,mime);toast(TXT.downloaded);}
    catch(e){if(note)note.textContent=e.message||TXT.unsupported;}
    finally{btn.disabled=false;label.textContent=old;}
  }

  async function sharePro(){
    const btn=document.getElementById('share'),label=btn?.querySelector('span'),note=document.getElementById('exportNote');
    if(!btn||!label)return;
    const old=label.textContent;label.textContent=TXT.rendering;btn.disabled=true;if(note)note.textContent='';
    try{
      const{blob,mime}=await buildVideoPro();
      const file=new File([blob],'mateshot-mate-'+S.mateN+'.'+ext(mime),{type:mime});
      if(navigator.share&&navigator.canShare?.({files:[file]})){
        try{await navigator.share({files:[file],title:'MateShot',text:solutionText()});}
        catch(e){
          if(e?.name==='AbortError')return;
          saveVideoBlob(blob,mime);toast(TXT.shareFallback);
        }
      }else{
        saveVideoBlob(blob,mime);toast(TXT.shareFallback);
      }
    }catch(e){if(e?.name!=='AbortError'&&note)note.textContent=e.message||TXT.unsupported;}
    finally{btn.disabled=false;label.textContent=old;}
  }

  const style=document.createElement('style');
  style.textContent=`
    .boardWrap{border-radius:14px!important;}
    .actions{grid-template-columns:1fr!important;}
    #download{display:none!important;}
    .controls button:disabled{opacity:.25!important;cursor:default!important;filter:saturate(.35);}
    #board{position:relative;isolation:isolate;}
    .coord{
      position:absolute!important;z-index:9!important;pointer-events:none;
      font-size:9px!important;font-weight:760!important;line-height:1!important;
      opacity:.72!important;text-shadow:none!important;
      -webkit-font-smoothing:antialiased;transform:translateZ(0);
    }
    .coord.onLight{color:rgba(92,70,52,.68)!important;}
    .coord.onDark{color:rgba(247,245,238,.80)!important;}
    .coord.file{right:8px!important;bottom:5px!important;}
    .coord.rank{left:8px!important;top:5px!important;}
    .sq.mateKing::before{
      content:"";position:absolute;inset:0;z-index:1;pointer-events:none;
      background:rgba(255,64,64,.18);
      box-shadow:inset 0 0 0 2px rgba(255,105,105,.65);
      animation:mateshotMatePulse 1050ms ease-in-out 1;
    }
    @keyframes mateshotMatePulse{
      0%,100%{background:rgba(255,64,64,.13);box-shadow:inset 0 0 0 2px rgba(255,105,105,.45),0 0 0 rgba(255,70,70,0)}
      20%{background:rgba(255,64,64,.46);box-shadow:inset 0 0 0 3px rgba(255,120,120,.92),0 0 24px rgba(255,70,70,.48)}
      43%{background:rgba(255,64,64,.14);box-shadow:inset 0 0 0 2px rgba(255,105,105,.50),0 0 6px rgba(255,70,70,.10)}
      68%{background:rgba(255,64,64,.43);box-shadow:inset 0 0 0 3px rgba(255,120,120,.88),0 0 22px rgba(255,70,70,.42)}
    }
  `;
  document.head.appendChild(style);

  let lastMateKey='';
  function applyWebMatePulse(){
    if(!S?.positions?.length)return;
    const boardEl=document.getElementById('board');
    if(S.step!==S.positions.length-1){
      lastMateKey='';
      boardEl?.querySelectorAll('.mateKing').forEach(el=>el.classList.remove('mateKing'));
      return;
    }
    const finalPos=S.positions[S.positions.length-1],king=matedKingIndex(finalPos);
    if(king<0)return;
    const key=notation(S.line,S.start.side)+'|'+S.step;
    if(key===lastMateKey)return;
    lastMateKey=key;
    const vi=S.orientation==='black'?63-king:king;
    const cell=boardEl?.children?.[vi];
    if(!cell)return;
    cell.classList.remove('mateKing');
    void cell.offsetWidth;
    cell.classList.add('mateKing');
  }

  function syncWebCoordinateContrast(){
    const root=document.getElementById('board');
    if(!root)return;
    const cells=[...root.children];
    cells.forEach((sq,i)=>{
      const vr=Math.floor(i/8),vc=i%8,isDark=((vr+vc)&1)===1;
      sq.querySelectorAll('.coord').forEach(c=>{
        c.classList.toggle('onDark',isDark);
        c.classList.toggle('onLight',!isDark);
      });
    });
    requestAnimationFrame(()=>{
      cells.forEach(sq=>sq.querySelectorAll('.coord').forEach(c=>{
        const r=c.getBoundingClientRect();
        c.style.transform=`translate(${Math.round(r.left)-r.left}px,${Math.round(r.top)-r.top}px)`;
      }));
    });
  }

  const board=document.getElementById('board');
  if(board){
    const observer=new MutationObserver(()=>requestAnimationFrame(()=>{syncWebCoordinateContrast();applyWebMatePulse();}));
    observer.observe(board,{childList:true});
    syncWebCoordinateContrast();
  }

  function updateNavButtons(){
    const prev=document.getElementById('prev'),next=document.getElementById('next');
    const hasPositions=Array.isArray(S?.positions)&&S.positions.length>0;
    if(prev)prev.disabled=!hasPositions||S.step<=0;
    if(next)next.disabled=!hasPositions||S.step>=S.positions.length-1;
  }

  const resultBoard=document.getElementById('board');
  if(resultBoard){
    const navObserver=new MutationObserver(()=>requestAnimationFrame(updateNavButtons));
    navObserver.observe(resultBoard,{childList:true,subtree:false});
  }
  document.getElementById('prev')?.addEventListener('click',()=>setTimeout(updateNavButtons,0));
  document.getElementById('next')?.addEventListener('click',()=>setTimeout(updateNavButtons,0));
  document.getElementById('play')?.addEventListener('click',()=>setTimeout(updateNavButtons,0));
  updateNavButtons();

  const download=document.getElementById('download'),share=document.getElementById('share');
  if(download)download.onclick=downloadPro;
  if(share)share.onclick=sharePro;

  const result=document.getElementById('result');
  if(result){
    const observer=new MutationObserver(()=>{if(result.classList.contains('active'))preloadPieces().catch(()=>{});});
    observer.observe(result,{attributes:true,attributeFilter:['class']});
  }
})();