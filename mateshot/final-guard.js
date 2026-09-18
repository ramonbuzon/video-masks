/* MateShot final consistency guard.
   Keeps analysis atomic (no provisional error/result flashes), reads the puzzle prompt when
   it is present in the screenshot, and refuses solutions that contradict side-to-move or mate-in-N.
   If the visual pipeline found the right occupancy but the wrong line, it performs one final
   prompt-guided repair pass before showing a terminal screen. */
(() => {
  'use strict';

  const baseAnalyze = window.analyze;
  const baseShow = window.show;
  if (typeof baseAnalyze !== 'function' || typeof baseShow !== 'function') return;

  const LANG_ES = (navigator.language || 'en').toLowerCase().startsWith('es');
  let runToken = 0;
  let locked = false;
  let lastTerminal = null;
  let tessPromise = null;

  const EXPECTED = /(?:No he podido reconstruir una posición legal|no he podido confirmar una solución|Afinando la reconstrucción|He encontrado el tablero)/i;
  const realConsoleError = console.error.bind(console);
  function quietExpectedError(...args){
    const msg = args.map(x => x && x.message ? x.message : String(x ?? '')).join(' ');
    if (EXPECTED.test(msg)) { try { console.debug('[MateShot recovery]', msg); } catch(_){} return; }
    realConsoleError(...args);
  }

  window.show = show = function(id){
    if (locked && (id === 'result' || id === 'error')) {
      lastTerminal = id;
      return;
    }
    return baseShow(id);
  };

  function norm(s){
    return (s || '').toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9ñ\s]/gi,' ')
      .replace(/\s+/g,' ').trim();
  }
  function wordNumber(s){
    const m={un:1,uno:1,una:1,one:1,dos:2,two:2,tres:3,three:3,cuatro:4,four:4,cinco:5,five:5,seis:6,six:6,siete:7,seven:7,ocho:8,eight:8};
    const q=norm(String(s||''));
    return /^\d+$/.test(q) ? Number(q) : (m[q] || null);
  }
  function parseHint(raw){
    const text=norm(raw);
    const out={raw:raw||'',text,side:null,mate:null};
    if(/\b(blancas?|white)\b/.test(text)) out.side='w';
    if(/\b(negras?|black)\b/.test(text)) out.side=out.side||'b';
    const mm=text.match(/(?:mate\s+en|mate\s+in|checkmate\s+in)\s+(\d+|un|uno|una|one|dos|two|tres|three|cuatro|four|cinco|five|seis|six|siete|seven|ocho|eight)\b/);
    if(mm) out.mate=wordNumber(mm[1]);
    return out;
  }

  function loadTesseract(){
    if(window.Tesseract?.recognize) return Promise.resolve(window.Tesseract);
    if(tessPromise) return tessPromise;
    tessPromise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.async=true;s.crossOrigin='anonymous';
      s.onload=()=>window.Tesseract?.recognize?resolve(window.Tesseract):reject(new Error('OCR unavailable'));
      s.onerror=()=>reject(new Error('OCR unavailable'));
      document.head.appendChild(s);
    });
    return tessPromise;
  }

  function promptCanvas(img,rect){
    const W0=img.naturalWidth||img.width,H0=img.naturalHeight||img.height;
    const W=Math.min(1280,W0),scale=W/W0,H=Math.max(1,Math.round(H0*scale));
    const c=document.createElement('canvas');c.width=W;c.height=H;
    const x=c.getContext('2d',{willReadFrequently:true});
    x.fillStyle='#fff';x.fillRect(0,0,W,H);x.drawImage(img,0,0,W,H);
    if(rect){
      const pad=Math.max(8,Math.round(rect.s*scale*.035));
      x.fillStyle='#fff';
      x.fillRect(Math.max(0,rect.x*scale-pad),Math.max(0,rect.y*scale-pad),
        Math.min(W,rect.s*scale+2*pad),Math.min(H,rect.s*scale+2*pad));
    }
    return c;
  }

  async function readPrompt(){
    if(!S?.img) return {raw:'',text:'',side:null,mate:null};
    const W=S.img.naturalWidth||S.img.width,H=S.img.naturalHeight||S.img.height;
    const boardRatio=S?.rect ? (S.rect.s*S.rect.s)/(W*H) : 1;
    if(boardRatio>.82) return {raw:'',text:'',side:null,mate:null};
    try{
      prog(88, LANG_ES?'Verificando el enunciado':'Checking the prompt', LANG_ES?'Leyendo lado y mate…':'Reading side and mate…');
      const T=await loadTesseract();
      const res=await T.recognize(promptCanvas(S.img,S.rect),'eng',{logger:()=>{}});
      const raw=(res?.data?.text||'').replace(/\s+/g,' ').trim();
      S.promptOcr=raw;
      return parseHint(raw);
    }catch(e){
      console.debug('[MateShot OCR] skipped', e?.message||e);
      return {raw:'',text:'',side:null,mate:null};
    }
  }

  function stableSolution(){
    return !!(S?.start?.b && Array.isArray(S.line) && S.line.length && Array.isArray(S.positions) && S.positions.length>1);
  }
  function matches(h){
    if(!stableSolution()) return false;
    if(h.side && S.start.side!==h.side) return false;
    if(h.mate && Number(S.mateN)!==Number(h.mate)) return false;
    return true;
  }

  function rawBoardFromCells(cells){
    try{return cellsBoard(cells);}catch(_){return null;}
  }
  function mergeCells(a,b){
    if(!a?.length && !b?.length) return null;
    const out=[];
    for(let i=0;i<64;i++){
      const x=a?.[i],y=b?.[i];
      if((!x||x.empty)&&y&&!y.empty){out.push({...y});continue;}
      if(x&&!x.empty&&y&&!y.empty){
        const map=new Map();
        for(const z of(x.alts||[]))map.set(z.t,{...z});
        for(const z of(y.alts||[]))if(!map.has(z.t)||(map.get(z.t).score||0)<(z.score||0))map.set(z.t,{...z});
        out.push({...x,alts:[...map.values()].sort((u,v)=>(v.score||0)-(u.score||0))});
        continue;
      }
      out.push(x?{...x}:y?{...y}:{empty:true,r:(i/8)|0,c:i%8});
    }
    return out;
  }

  async function promptGuidedRepair(h){
    if(!h.side && !h.mate) return false;
    const candidates=[];
    if(S?.cells?.length===64)candidates.push(S.cells);
    let fast=null;
    if(S?.img&&S?.rect){try{fast=scanBoard(S.img,S.rect);}catch(_){}}
    if(fast?.length===64)candidates.push(fast);
    const merged=mergeCells(S?.cells,fast);
    if(merged)candidates.unshift(merged);

    const seen=new Set();
    const originalFindMate=window.findMate;
    if(typeof originalFindMate!=='function'||typeof solveCells!=='function')return false;

    const restricted=function(board,side,maxDepth,ms){
      if(h.side && side!==h.side)return null;
      const limit=h.mate||Math.min(Number(maxDepth)||8,8);
      const hit=originalFindMate(board,side,limit,ms);
      if(!hit)return null;
      if(h.mate && Number(hit.mate)!==Number(h.mate))return null;
      return hit;
    };

    window.findMate=findMate=restricted;
    try{
      prog(92,LANG_ES?'Afinando la solución':'Refining solution',LANG_ES?'Usando el enunciado para validar la posición…':'Using the prompt to validate the position…');
      for(const cells of candidates){
        if(!cells?.length)continue;
        const key=cells.map(c=>c.empty?'1':((c.color||'?')+(c.alts?.[0]?.t||'?'))).join('');
        if(seen.has(key))continue;seen.add(key);
        try{
          const hit=await solveCells(cells);
          if(hit && (!h.side||hit.pos.side===h.side) && (!h.mate||Number(hit.mate)===Number(h.mate))){
            S.cells=cells;S.orientation=hit.orientation;S.start=hit.pos;
            S.line=annotate(hit.pos,hit.line);S.mateN=hit.mate;
            S.positions=[{b:hit.pos.b.slice(),side:hit.pos.side}];
            let p={b:hit.pos.b.slice(),side:hit.pos.side};
            for(const mv of S.line){p=makeMove(p,mv);S.positions.push({b:p.b.slice(),side:p.side});}
            S.step=0;
            document.getElementById('problemText').textContent=(hit.pos.side==='b'?'Negras':'Blancas')+' mueven · mate';
            document.getElementById('mate').textContent='Mate en '+S.mateN;
            document.getElementById('line').textContent=notation(S.line,hit.pos.side);
            renderBoard(S.positions[0].b,S.orientation,null);
            S.debug=(S.debug?S.debug+' | ':'')+'validado con enunciado';
            return true;
          }
        }catch(e){console.debug('[MateShot guided repair] candidate skipped',e?.message||e);}
      }
    }finally{
      window.findMate=findMate=originalFindMate;
    }
    return false;
  }

  function setFinalError(h){
    const e=document.getElementById('errorText');
    if(e){
      if(h.mate && stableSolution() && Number(S.mateN)!==Number(h.mate)){
        e.textContent=LANG_ES
          ? 'He leído mate en '+h.mate+', pero la posición reconstruida produce mate en '+S.mateN+'. No voy a mostrar una solución dudosa.'
          : 'I read mate in '+h.mate+', but the reconstructed position produces mate in '+S.mateN+'. I will not show an uncertain solution.';
      }else if(h.side && stableSolution() && S.start.side!==h.side){
        e.textContent=LANG_ES
          ? 'El lado que mueve no coincide con el enunciado. No voy a mostrar una solución dudosa.'
          : 'The side to move does not match the prompt. I will not show an uncertain solution.';
      }else{
        e.textContent=LANG_ES
          ? 'He detectado el tablero, pero no he podido reconstruir una posición legal que encaje con el enunciado.'
          : 'I found the board, but I could not reconstruct a legal position that matches the prompt.';
      }
    }
    const d=document.getElementById('details');
    if(d){
      const bits=[];
      if(h.raw)bits.push((LANG_ES?'Enunciado':'Prompt')+': '+h.raw);
      if(S?.rect)bits.push((LANG_ES?'Tablero':'Board')+': '+S.rect.s+' px');
      if(S?.cells?.length)bits.push((LANG_ES?'Piezas detectadas':'Detected pieces')+': '+S.cells.filter(c=>!c.empty).length);
      d.textContent=bits.join(' · ');
    }
  }

  window.analyze=analyze=async function(url){
    const my=++runToken;
    locked=true;lastTerminal=null;

    // Avoid stale state from a previous puzzle influencing the final decision.
    try{
      S.start=null;S.line=[];S.positions=[];S.mateN=0;S.step=0;
      S.promptOcr='';S.integrityMissing=[];S.integrityFastCells=null;
    }catch(_){}

    const oldConsoleError=console.error;
    console.error=quietExpectedError;
    try{
      await baseAnalyze(url);
    }catch(e){
      realConsoleError(e);
      lastTerminal='error';
    }finally{
      console.error=oldConsoleError;
    }
    if(my!==runToken)return;

    let hint=await readPrompt();
    if(my!==runToken)return;

    // If OCR found no useful constraint, a stable solution remains acceptable.
    if((hint.side||hint.mate) && !matches(hint)){
      await promptGuidedRepair(hint);
    }

    locked=false;
    if(stableSolution() && matches(hint)){
      prog(100,LANG_ES?'Listo':'Ready','');
      baseShow('result');
    }else{
      setFinalError(hint);
      baseShow('error');
    }
  };
})();
