/* MateShot UI, Cburnett pieces, localization and video export layer. */
(() => {
  const UI_LANG = (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
  const I18N = {
    en:{eyebrow:'Screenshot to solution',hero1:'Drop a chess puzzle.',hero2:'Watch it solve itself.',heroText:'Upload a full screenshot with the puzzle prompt included. MateShot finds the board, solves the position and builds a replay you can share or download.',upload:'Upload screenshot',micro:'No board setup. No notation. Just the screenshot.',solution:'Solution',play:'Play solution',pause:'Pause',share:'Share',download:'Download video',rendering:'Building video…',sideB:'Black to move',sideW:'White to move',forced:'Forced mate in',mate:'Mate in',ready:'Video ready',downloaded:'Video downloaded',shareFallback:'Solution copied',errorTitle:'Couldn’t read this puzzle clearly',retry:'Try another screenshot',videoUnsupported:'Video export is not supported by this browser yet.'},
    es:{eyebrow:'De captura a solución',hero1:'Sube un puzzle de ajedrez.',hero2:'Mira cómo se resuelve.',heroText:'Sube una captura completa con el enunciado incluido. MateShot encuentra el tablero, resuelve la posición y crea una repetición lista para compartir o descargar.',upload:'Subir captura',micro:'Sin montar el tablero. Sin notación. Solo la captura.',solution:'Solución',play:'Ver solución',pause:'Pausa',share:'Compartir',download:'Descargar vídeo',rendering:'Creando vídeo…',sideB:'Mueven negras',sideW:'Mueven blancas',forced:'Mate forzado en',mate:'Mate en',ready:'Vídeo listo',downloaded:'Vídeo descargado',shareFallback:'Solución copiada',errorTitle:'No he podido leer bien este puzzle',retry:'Probar otra captura',videoUnsupported:'Este navegador todavía no permite exportar el vídeo.'}
  };
  const t = k => I18N[UI_LANG][k] || I18N.en[k] || k;
  document.documentElement.lang = UI_LANG;
  document.querySelectorAll('[data-i18n]').forEach(el=>{ const k=el.getAttribute('data-i18n'); if(t(k)) el.textContent=t(k); });

  const PIECE_BASE = 'https://lichess1.org/assets/piece/cburnett/';
  const pieceCode = p => (p === p.toUpperCase() ? 'w' : 'b') + p.toUpperCase();
  const pieceSrc = p => PIECE_BASE + pieceCode(p) + '.svg';

  const boardStyle=document.createElement('style');
  boardStyle.textContent=`
    .boardWrap{position:relative;border-radius:14px!important;}
    #board{position:relative;z-index:1;isolation:isolate;}
    .coordLayer{position:absolute;inset:0;z-index:12;pointer-events:none;border-radius:inherit;overflow:hidden;}
    .coordOverlay{position:absolute;box-sizing:border-box;font-size:8.5px;font-weight:760;line-height:1;opacity:.70;-webkit-font-smoothing:antialiased;text-shadow:none;}
    .coordOverlay.onLight{color:rgba(125,91,67,.68);}
    .coordOverlay.onDark{color:rgba(240,217,181,.78);}
    .coordOverlay.rank{left:0;width:12.5%;height:12.5%;padding:5px 0 0 8px;text-align:left;}
    .coordOverlay.file{bottom:0;width:12.5%;height:12.5%;padding:0 8px 5px 0;display:flex;align-items:flex-end;justify-content:flex-end;}
  `;
  document.head.appendChild(boardStyle);

  function toast(msg){
    const el=document.getElementById('toast'); if(!el)return; el.textContent=msg; el.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove('show'),1800);
  }

  const originalProg = window.prog || prog;
  const statusMap = new Map([
    ['Leyendo el puzzle',['Reading puzzle','Leyendo el puzzle']],['Buscando el tablero...',['Looking for the board...','Buscando el tablero...']],
    ['Tablero encontrado',['Board found','Tablero encontrado']],['Reconociendo las piezas localmente...',['Recognizing pieces locally...','Reconociendo las piezas localmente...']],
    ['Piezas reconstruidas',['Position rebuilt','Posición reconstruida']],['Buscando un mate forzado...',['Searching for a forced mate...','Buscando un mate forzado...']],
    ['Buscando el mate',['Solving puzzle','Resolviendo el puzzle']],['Probando orientación y turno...',['Checking orientation and side to move...','Comprobando orientación y turno...']],
    ['Corrigiendo lecturas dudosas',['Refining the position','Afinando la posición']],['Comprobando alternativas...',['Checking uncertain squares...','Comprobando casillas dudosas...']],
    ['Listo',['Ready','Listo']]
  ]);
  window.prog = prog = function(v,title,text){
    if(UI_LANG==='en'){
      const a=statusMap.get(title); if(a) title=a[0];
      const b=statusMap.get(text); if(b) text=b[0];
    }
    return originalProg(v,title,text);
  };

  function ensureCoordLayer(orientation){
    const wrap=document.querySelector('.boardWrap');
    if(!wrap)return;
    let layer=wrap.querySelector('.coordLayer');
    if(!layer){
      layer=document.createElement('div');
      layer.className='coordLayer';
      wrap.appendChild(layer);
    }
    if(layer.dataset.orientation===orientation && layer.childElementCount===16)return;
    layer.dataset.orientation=orientation;
    layer.innerHTML='';
    const files=orientation==='black'?'hgfedcba':'abcdefgh';
    const ranks=orientation==='black'?'12345678':'87654321';
    for(let vr=0;vr<8;vr++){
      const s=document.createElement('span');
      s.className='coordOverlay rank '+((((vr+0)&1)?'onDark':'onLight'));
      s.textContent=ranks[vr];
      s.style.top=(vr*12.5)+'%';
      layer.appendChild(s);
    }
    for(let vc=0;vc<8;vc++){
      const s=document.createElement('span');
      s.className='coordOverlay file '+((((7+vc)&1)?'onDark':'onLight'));
      s.textContent=files[vc];
      s.style.left=(vc*12.5)+'%';
      layer.appendChild(s);
    }
  }

  window.renderBoard = renderBoard = function(board,orientation,last){
    const root=document.getElementById('board'); root.innerHTML='';
    for(let vr=0;vr<8;vr++) for(let vc=0;vc<8;vc++){
      const br=orientation==='black'?7-vr:vr,bc=orientation==='black'?7-vc:vc;
      const el=document.createElement('div'); el.className='sq '+(((vr+vc)&1)?'dark':'light');
      if(last&&last.from===br*8+bc)el.classList.add('lastFrom'); if(last&&last.to===br*8+bc)el.classList.add('lastTo');
      const p=board[br*8+bc]; if(p){ const im=document.createElement('img'); im.className='pieceImg'; im.alt=''; im.draggable=false; im.src=pieceSrc(p); el.appendChild(im); }
      root.appendChild(el);
    }
    ensureCoordLayer(orientation);
  };

  function solutionRows(){
    const out=[]; if(!S.line || !S.line.length) return out;
    if(S.start.side==='b'){
      out.push({n:'1…',moves:S.line[0].san});
      let no=2; for(let i=1;i<S.line.length;i+=2,no++){out.push({n:no+'.',moves:S.line[i].san+(S.line[i+1]?'  '+S.line[i+1].san:'')});}
    }else{
      let no=1; for(let i=0;i<S.line.length;i+=2,no++){out.push({n:no+'.',moves:S.line[i].san+(S.line[i+1]?'  '+S.line[i+1].san:'')});}
    }
    return out;
  }

  function refreshResultUI(){
    if(!S.start || !S.line?.length) return;
    document.getElementById('sidePill').textContent=S.start.side==='b'?t('sideB'):t('sideW');
    document.getElementById('goalPill').textContent=t('forced')+' '+S.mateN;
    document.getElementById('mate').textContent=t('mate')+' '+S.mateN;
    const list=document.getElementById('solutionList'); list.innerHTML='';
    solutionRows().forEach(r=>{const row=document.createElement('div');row.className='solutionRow';row.innerHTML='<span class="n">'+r.n+'</span><strong>'+r.moves+'</strong>';list.appendChild(row);});
    const play=document.getElementById('play'); if(!S.playing) play.innerHTML='▶ <span>'+t('play')+'</span>';
    document.getElementById('share').querySelector('span').textContent=t('share');
    document.getElementById('download').querySelector('span').textContent=t('download');
    document.getElementById('exportNote').textContent='';
  }

  const coreAnalyze = window.analyze || analyze;
  window.analyze = analyze = async function(url){
    await coreAnalyze(url);
    if(document.getElementById('result').classList.contains('active')){
      refreshResultUI();
      renderBoard(S.positions[0].b,S.orientation,null);
      tryReadPromptText().catch(()=>{});
      S.videoBlob=null; S.videoMime=null;
    }else if(document.getElementById('error').classList.contains('active') && UI_LANG==='en'){
      const e=document.getElementById('errorText');
      if(e.textContent.includes('tablero')) e.textContent='I found the board, but I could not reconstruct a forced mate with enough confidence.';
      else e.textContent='Try another screenshot, or crop a little closer to the board. The puzzle prompt can stay in the image.';
    }
  };

  const coreStop = window.stopPlay || stopPlay;
  window.stopPlay = stopPlay = function(){ coreStop(); const b=document.getElementById('play'); if(b) b.innerHTML='▶ <span>'+t('play')+'</span>'; };
  const coreToggle = window.togglePlay || togglePlay;
  window.togglePlay = togglePlay = function(){ coreToggle(); const b=document.getElementById('play'); if(b) b.innerHTML=S.playing?'❚❚ <span>'+t('pause')+'</span>':'▶ <span>'+t('play')+'</span>'; };
  document.getElementById('play').onclick=togglePlay;

  async function tryReadPromptText(){
    if(!window.Tesseract || !S.img || !S.rect) return;
    try{
      const W=Math.min(920,S.img.naturalWidth||S.img.width),scale=W/(S.img.naturalWidth||S.img.width),H=Math.round((S.img.naturalHeight||S.img.height)*scale);
      const cv=document.createElement('canvas');cv.width=W;cv.height=H;const ctx=cv.getContext('2d');ctx.drawImage(S.img,0,0,W,H);ctx.fillStyle='#fff';ctx.fillRect(S.rect.x*scale,S.rect.y*scale,S.rect.s*scale,S.rect.s*scale);
      const res=await Tesseract.recognize(cv,'eng',{logger:()=>{}}); const text=(res?.data?.text||'').replace(/\s+/g,' ').trim();
      if(!text) return;
      const hit=text.match(/(?:black|white).{0,28}(?:move|mate)|(?:mate|checkmate).{0,25}/i); if(hit){document.getElementById('problemText').textContent=hit[0];}
    }catch(e){}
  }

  function preloadPieces(){
    if(preloadPieces.cache) return preloadPieces.cache;
    const chars=['K','Q','R','B','N','P','k','q','r','b','n','p'];
    preloadPieces.cache=Promise.all(chars.map(p=>new Promise((res,rej)=>{const im=new Image();im.crossOrigin='anonymous';im.onload=()=>res([p,im]);im.onerror=rej;im.src=pieceSrc(p);}))).then(entries=>Object.fromEntries(entries));
    return preloadPieces.cache;
  }

  function canvasSquare(index,orientation,boardX,boardY,cell){
    let r=(index/8)|0,c=index%8; if(orientation==='black'){r=7-r;c=7-c;} return {x:boardX+c*cell,y:boardY+r*cell};
  }

  function drawVideoFrame(ctx,images,position,orientation,move=null,p=1,currentText=''){
    const W=1080,H=1350,board=900,boardX=90,boardY=190,cell=board/8;
    ctx.fillStyle='#090b0d';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#f5f6f2';ctx.font='800 44px -apple-system,BlinkMacSystemFont,Arial';ctx.fillText('MateShot',90,82);
    ctx.fillStyle='#d6ff58';ctx.beginPath();ctx.arc(66,68,8,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#a9b0b8';ctx.font='600 24px -apple-system,BlinkMacSystemFont,Arial';ctx.fillText((S.start.side==='b'?'Black':'White')+' to move  ·  Forced mate in '+S.mateN,90,132);
    for(let vr=0;vr<8;vr++)for(let vc=0;vc<8;vc++){ctx.fillStyle=((vr+vc)&1)?'#b98c68':'#f0d9b5';ctx.fillRect(boardX+vc*cell,boardY+vr*cell,cell,cell);}
    const b=position.b; let moving=null;
    if(move){moving=b[move.from];}
    for(let i=0;i<64;i++){
      const pc=b[i]; if(!pc) continue; if(move && (i===move.from || i===move.to)) continue;
      const q=canvasSquare(i,orientation,boardX,boardY,cell);ctx.drawImage(images[pc],q.x+cell*.06,q.y+cell*.06,cell*.88,cell*.88);
    }
    if(move){
      const a=canvasSquare(move.from,orientation,boardX,boardY,cell),z=canvasSquare(move.to,orientation,boardX,boardY,cell),e=p<.5?2*p:1-(Math.pow(-2*p+2,2)/2),x=a.x+(z.x-a.x)*e,y=a.y+(z.y-a.y)*e;
      if(moving)ctx.drawImage(images[moving],x+cell*.06,y+cell*.06,cell*.88,cell*.88);
    }
    ctx.fillStyle='#f5f6f2';ctx.font='800 42px -apple-system,BlinkMacSystemFont,Arial';ctx.fillText(t('mate')+' '+S.mateN,90,1158);
    ctx.fillStyle='#c6ccd3';ctx.font='600 30px -apple-system,BlinkMacSystemFont,Arial';ctx.fillText(currentText||notation(S.line,S.start.side),90,1210,840);
    ctx.fillStyle='#6f7781';ctx.font='700 24px -apple-system,BlinkMacSystemFont,Arial';ctx.textAlign='right';ctx.fillText('MateShot',990,1297);ctx.textAlign='left';
  }

  async function buildVideo(){
    if(S.videoBlob) return {blob:S.videoBlob,mime:S.videoMime};
    if(!S.positions?.length || !S.line?.length) throw new Error('No solution');
    const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext('2d');
    if(!canvas.captureStream || !window.MediaRecorder) throw new Error(t('videoUnsupported'));
    const images=await preloadPieces();
    const candidates=['video/mp4;codecs=avc1.42E01E','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];
    const mime=candidates.find(x=>MediaRecorder.isTypeSupported?.(x))||'';
    const stream=canvas.captureStream(30),chunks=[];const rec=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
    const stopped=new Promise((res,rej)=>{rec.onstop=res;rec.onerror=e=>rej(e.error||e);}); rec.start(250);
    drawVideoFrame(ctx,images,S.positions[0],S.orientation,null,1,''); await new Promise(r=>setTimeout(r,650));
    const fps=30,moveMs=720,holdMs=260;
    for(let i=0;i<S.line.length;i++){
      const frames=Math.round(moveMs/1000*fps),before=S.positions[i],mv=S.line[i];
      for(let f=0;f<frames;f++){drawVideoFrame(ctx,images,before,S.orientation,mv,f/(frames-1),mv.san);await new Promise(r=>setTimeout(r,1000/fps));}
      drawVideoFrame(ctx,images,S.positions[i+1],S.orientation,null,1,mv.san);await new Promise(r=>setTimeout(r,holdMs));
    }
    drawVideoFrame(ctx,images,S.positions[S.positions.length-1],S.orientation,null,1,'Checkmate');await new Promise(r=>setTimeout(r,800));rec.stop();await stopped;stream.getTracks().forEach(x=>x.stop());
    const actual=mime||rec.mimeType||'video/webm',blob=new Blob(chunks,{type:actual});S.videoBlob=blob;S.videoMime=actual;return{blob,mime:actual};
  }

  function extension(mime){return mime.includes('mp4')?'mp4':'webm';}
  function solutionText(){return t('mate')+' '+S.mateN+'\n'+solutionRows().map(r=>r.n+' '+r.moves).join('\n');}

  async function downloadReplay(){
    const btn=document.getElementById('download'),label=btn.querySelector('span'),note=document.getElementById('exportNote'); const old=label.textContent; label.textContent=t('rendering');btn.disabled=true;note.textContent='';
    try{const {blob,mime}=await buildVideo();const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mateshot-mate-'+S.mateN+'.'+extension(mime);document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);toast(t('downloaded'));}
    catch(e){note.textContent=e.message||t('videoUnsupported');}
    finally{btn.disabled=false;label.textContent=old;}
  }

  async function shareReplay(){
    const btn=document.getElementById('share'),label=btn.querySelector('span'),note=document.getElementById('exportNote'); const old=label.textContent;label.textContent=t('rendering');btn.disabled=true;note.textContent='';
    try{
      const {blob,mime}=await buildVideo();const file=new File([blob],'mateshot-mate-'+S.mateN+'.'+extension(mime),{type:mime});
      if(navigator.share && navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'MateShot',text:solutionText()});}
      else if(navigator.share){await navigator.share({title:'MateShot',text:solutionText()});}
      else{await navigator.clipboard.writeText(solutionText());toast(t('shareFallback'));}
    }catch(e){ if(e?.name!=='AbortError') note.textContent=e.message||t('videoUnsupported'); }
    finally{btn.disabled=false;label.textContent=old;}
  }

  document.getElementById('download').onclick=downloadReplay;
  document.getElementById('share').onclick=shareReplay;

  const speed=document.getElementById('speed'); if(speed) speed.value='950';
})();
