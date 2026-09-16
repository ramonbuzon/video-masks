/* MateShot video export v2: faster render, monotonic motion and full localization. */
(() => {
  const LANG = (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
  const TXT = LANG === 'es' ? {
    sideB:'Mueven negras', sideW:'Mueven blancas', forced:'Mate forzado en', mate:'Mate en', checkmate:'Jaque mate',
    rendering:'Creando vídeo…', downloaded:'Vídeo descargado', unsupported:'Este navegador todavía no permite exportar el vídeo.', copied:'Solución copiada'
  } : {
    sideB:'Black to move', sideW:'White to move', forced:'Forced mate in', mate:'Mate in', checkmate:'Checkmate',
    rendering:'Building video…', downloaded:'Video downloaded', unsupported:'Video export is not supported by this browser yet.', copied:'Solution copied'
  };

  const PIECE_BASE='https://lichess1.org/assets/piece/cburnett/';
  const pieceCode=p=>(p===p.toUpperCase()?'w':'b')+p.toUpperCase();
  const pieceSrc=p=>PIECE_BASE+pieceCode(p)+'.svg';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  function toast2(msg){
    const el=document.getElementById('toast');
    if(!el) return;
    el.textContent=msg;el.classList.add('show');clearTimeout(toast2._t);toast2._t=setTimeout(()=>el.classList.remove('show'),1800);
  }

  function preloadPiecesFast(){
    if(preloadPiecesFast.cache) return preloadPiecesFast.cache;
    const chars=['K','Q','R','B','N','P','k','q','r','b','n','p'];
    preloadPiecesFast.cache=Promise.all(chars.map(p=>new Promise((resolve,reject)=>{
      const im=new Image();im.crossOrigin='anonymous';im.onload=()=>resolve([p,im]);im.onerror=reject;im.src=pieceSrc(p);
    }))).then(x=>Object.fromEntries(x));
    return preloadPiecesFast.cache;
  }

  function canvasSquare(index,orientation,bx,by,cell){
    let r=(index/8)|0,c=index%8;
    if(orientation==='black'){r=7-r;c=7-c;}
    return {x:bx+c*cell,y:by+r*cell};
  }

  // Correct monotonic easing. The previous curve jumped backwards at 50%, which produced the visible "bounce".
  function easeInOutQuad(p){
    return p<0.5 ? 2*p*p : 1-Math.pow(-2*p+2,2)/2;
  }

  function currentMoveLabel(index){
    if(!S?.line?.[index]) return '';
    const mv=S.line[index];
    const startsBlack=S.start.side==='b';
    if(startsBlack){
      if(index===0) return '1… '+mv.san;
      const n=Math.floor((index+1)/2)+1;
      return index%2===1 ? n+'. '+mv.san : n+'… '+mv.san;
    }
    const n=Math.floor(index/2)+1;
    return index%2===0 ? n+'. '+mv.san : n+'… '+mv.san;
  }

  function drawFrame(ctx,images,position,orientation,move=null,p=1,label=''){
    const W=720,H=900,board=600,bx=60,by=112,cell=board/8;
    ctx.fillStyle='#090b0d';ctx.fillRect(0,0,W,H);

    ctx.fillStyle='#d6ff58';ctx.beginPath();ctx.arc(44,43,5.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#f5f6f2';ctx.font='800 30px -apple-system,BlinkMacSystemFont,Arial';ctx.fillText('MateShot',60,52);
    ctx.fillStyle='#a9b0b8';ctx.font='600 16px -apple-system,BlinkMacSystemFont,Arial';
    const side=S.start.side==='b'?TXT.sideB:TXT.sideW;
    ctx.fillText(side+'  ·  '+TXT.forced+' '+S.mateN,60,82);

    for(let vr=0;vr<8;vr++) for(let vc=0;vc<8;vc++){
      ctx.fillStyle=((vr+vc)&1)?'#b98c68':'#f0d9b5';ctx.fillRect(bx+vc*cell,by+vr*cell,cell,cell);
    }

    // Same source/destination highlight used by the web replay.
    if(move){
      const hs=canvasSquare(move.from,orientation,bx,by,cell),ht=canvasSquare(move.to,orientation,bx,by,cell);
      ctx.fillStyle='rgba(214,255,88,.24)';ctx.fillRect(hs.x,hs.y,cell,cell);
      ctx.fillStyle='rgba(214,255,88,.43)';ctx.fillRect(ht.x,ht.y,cell,cell);
    }

    const b=position.b;
    const moving=move?b[move.from]:null;
    for(let i=0;i<64;i++){
      const pc=b[i];if(!pc) continue;
      if(move && (i===move.from || i===move.to)) continue;
      const q=canvasSquare(i,orientation,bx,by,cell);
      ctx.drawImage(images[pc],q.x+cell*.055,q.y+cell*.055,cell*.89,cell*.89);
    }

    if(move){
      // Keep a captured piece visible for most of the travel, then remove it just before arrival.
      const captured=b[move.to];
      if(captured && p<0.82){
        const z=canvasSquare(move.to,orientation,bx,by,cell);
        ctx.drawImage(images[captured],z.x+cell*.055,z.y+cell*.055,cell*.89,cell*.89);
      }
      const a=canvasSquare(move.from,orientation,bx,by,cell),z=canvasSquare(move.to,orientation,bx,by,cell);
      const e=easeInOutQuad(Math.max(0,Math.min(1,p)));
      const x=a.x+(z.x-a.x)*e,y=a.y+(z.y-a.y)*e;
      if(moving) ctx.drawImage(images[moving],x+cell*.055,y+cell*.055,cell*.89,cell*.89);
    }

    ctx.fillStyle='#f5f6f2';ctx.font='800 29px -apple-system,BlinkMacSystemFont,Arial';ctx.fillText(TXT.mate+' '+S.mateN,60,765);
    ctx.fillStyle='#c6ccd3';ctx.font='650 20px -apple-system,BlinkMacSystemFont,Arial';ctx.fillText(label||'',60,803,570);
    ctx.fillStyle='#6f7781';ctx.font='700 16px -apple-system,BlinkMacSystemFont,Arial';ctx.textAlign='right';ctx.fillText('MateShot',660,862);ctx.textAlign='left';
  }

  async function buildVideoFast(){
    if(!S?.positions?.length || !S?.line?.length) throw new Error('No solution');
    const key=S.orientation+'|'+S.start.side+'|'+S.mateN+'|'+notation(S.line,S.start.side);
    if(S.fastVideoBlob && S.fastVideoKey===key) return {blob:S.fastVideoBlob,mime:S.fastVideoMime};

    const canvas=document.createElement('canvas');canvas.width=720;canvas.height=900;
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!canvas.captureStream || !window.MediaRecorder) throw new Error(TXT.unsupported);
    const images=await preloadPiecesFast();

    const candidates=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
    const mime=candidates.find(x=>MediaRecorder.isTypeSupported?.(x))||'';
    const fps=24;
    const stream=canvas.captureStream(fps),chunks=[];
    const opts={videoBitsPerSecond:2200000};if(mime) opts.mimeType=mime;
    const rec=new MediaRecorder(stream,opts);
    rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
    const stopped=new Promise((resolve,reject)=>{rec.onstop=resolve;rec.onerror=e=>reject(e.error||e);});
    rec.start(200);

    drawFrame(ctx,images,S.positions[0],S.orientation,null,1,'');
    await sleep(300);

    // Shorter 4:5 social export. MediaRecorder records in real time, so shortening the replay also shortens generation time.
    const moveMs=420,holdMs=90;
    for(let i=0;i<S.line.length;i++){
      const frames=Math.max(7,Math.round(moveMs/1000*fps));
      const before=S.positions[i],mv=S.line[i],moveLabel=currentMoveLabel(i);
      for(let f=0;f<frames;f++){
        const p=frames===1?1:f/(frames-1);
        drawFrame(ctx,images,before,S.orientation,mv,p,moveLabel);
        await sleep(1000/fps);
      }
      // Keep the last-move highlight visible during the short hold.
      drawFrame(ctx,images,S.positions[i],S.orientation,mv,1,moveLabel);
      await sleep(holdMs);
    }

    // Keep the mating move highlighted on the final frame as well.
    drawFrame(ctx,images,S.positions[S.positions.length-2],S.orientation,S.line[S.line.length-1],1,TXT.checkmate);
    await sleep(450);
    rec.stop();await stopped;stream.getTracks().forEach(x=>x.stop());

    const actual=mime||rec.mimeType||'video/webm';
    const blob=new Blob(chunks,{type:actual});
    S.fastVideoKey=key;S.fastVideoBlob=blob;S.fastVideoMime=actual;
    return {blob,mime:actual};
  }

  const ext=mime=>mime.includes('mp4')?'mp4':'webm';
  function solutionText(){
    const rows=[];
    if(S.start.side==='b'){
      rows.push('1… '+S.line[0].san);
      let no=2;for(let i=1;i<S.line.length;i+=2,no++) rows.push(no+'. '+S.line[i].san+(S.line[i+1]?' '+S.line[i+1].san:''));
    }else{
      let no=1;for(let i=0;i<S.line.length;i+=2,no++) rows.push(no+'. '+S.line[i].san+(S.line[i+1]?' '+S.line[i+1].san:''));
    }
    return TXT.mate+' '+S.mateN+'\n'+rows.join('\n');
  }

  async function downloadFast(){
    const btn=document.getElementById('download'),label=btn?.querySelector('span'),note=document.getElementById('exportNote');
    if(!btn||!label)return;const old=label.textContent;label.textContent=TXT.rendering;btn.disabled=true;if(note)note.textContent='';
    try{
      const {blob,mime}=await buildVideoFast();const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='mateshot-mate-'+S.mateN+'.'+ext(mime);document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);toast2(TXT.downloaded);
    }catch(e){if(note)note.textContent=e.message||TXT.unsupported;}
    finally{btn.disabled=false;label.textContent=old;}
  }

  async function shareFast(){
    const btn=document.getElementById('share'),label=btn?.querySelector('span'),note=document.getElementById('exportNote');
    if(!btn||!label)return;const old=label.textContent;label.textContent=TXT.rendering;btn.disabled=true;if(note)note.textContent='';
    try{
      const {blob,mime}=await buildVideoFast();const file=new File([blob],'mateshot-mate-'+S.mateN+'.'+ext(mime),{type:mime});
      if(navigator.share && navigator.canShare?.({files:[file]})) await navigator.share({files:[file],title:'MateShot',text:solutionText()});
      else if(navigator.share) await navigator.share({title:'MateShot',text:solutionText()});
      else {await navigator.clipboard.writeText(solutionText());toast2(TXT.copied);}
    }catch(e){if(e?.name!=='AbortError'&&note)note.textContent=e.message||TXT.unsupported;}
    finally{btn.disabled=false;label.textContent=old;}
  }

  const download=document.getElementById('download'),share=document.getElementById('share');
  if(download) download.onclick=downloadFast;
  if(share) share.onclick=shareFast;

  // Warm the SVG cache only after the first solution appears, so clicking Download feels immediate.
  const result=document.getElementById('result');
  if(result){
    const observer=new MutationObserver(()=>{if(result.classList.contains('active'))preloadPiecesFast().catch(()=>{});});
    observer.observe(result,{attributes:true,attributeFilter:['class']});
  }
})();
