/* MateShot advanced recognition fallback.
   Keeps the fast local silhouette recognizer for familiar boards, then falls back to
   a neural 64-square classifier when the visual style is unfamiliar.

   Neural model: Elucidation/ChessboardFenTensorflowJs (MIT License, copyright 2018 Elucidation)
   https://github.com/Elucidation/ChessboardFenTensorflowJs
   Model commit pinned below. TensorFlow.js 0.12.5 is loaded only when fallback is needed.
*/
(() => {
  'use strict';

  const TF_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@0.12.5/dist/tf.min.js';
  const MODEL_COMMIT = 'c75063981c4f781f63ac90c0c026402e23ebbef6';
  const MODEL_ROOT = `https://cdn.jsdelivr.net/gh/Elucidation/ChessboardFenTensorflowJs@${MODEL_COMMIT}/frozen_model`;
  const LABELS = '1KQRBNPkqrbnp';

  let tfPromise = null;
  let predictorPromise = null;
  const baseDetectBoard = window.detectBoard || detectBoard;

  function med(a){
    if(!a.length) return 0;
    a=[...a].sort((x,y)=>x-y);
    const n=a.length;
    return n&1 ? a[n>>1] : (a[(n>>1)-1]+a[n>>1])/2;
  }
  function d3(a,b){
    const x=a[0]-b[0],y=a[1]-b[1],z=a[2]-b[2];
    return Math.sqrt(x*x+y*y+z*z);
  }

  function checkerScore(px,W,H,x0,y0,s){
    if(s<80 || x0<0 || y0<0 || x0+s>W || y0+s>H) return -1;
    const A=[],B=[];
    const taps=[[.25,.25],[.5,.25],[.75,.25],[.25,.5],[.5,.5],[.75,.5],[.25,.75],[.5,.75],[.75,.75]];
    for(let r=0;r<8;r++) for(let c=0;c<8;c++){
      const rr=[],gg=[],bb=[];
      for(const [ox,oy] of taps){
        const x=Math.max(0,Math.min(W-1,Math.round(x0+(c+ox)*s/8)));
        const y=Math.max(0,Math.min(H-1,Math.round(y0+(r+oy)*s/8)));
        const i=(y*W+x)*4;
        rr.push(px[i]);gg.push(px[i+1]);bb.push(px[i+2]);
      }
      const col=[med(rr),med(gg),med(bb)];
      (((r+c)&1)?B:A).push(col);
    }
    const center=arr=>[med(arr.map(v=>v[0])),med(arr.map(v=>v[1])),med(arr.map(v=>v[2]))];
    const ca=center(A),cb=center(B);
    const sep=d3(ca,cb);
    const wa=med(A.map(v=>d3(v,ca))),wb=med(B.map(v=>d3(v,cb)));
    return sep/(wa+wb+3);
  }

  // Thick frames are common in scanned/printed puzzles. Search substantially inside the
  // first detected square, instead of assuming the outer border is the 8x8 playing area.
  function deepRefineBoard(img, raw){
    try{
      const W0=img.naturalWidth||img.width,H0=img.naturalHeight||img.height;
      const maxW=520,scale=Math.min(1,maxW/W0),W=Math.round(W0*scale),H=Math.round(H0*scale);
      const cv=document.createElement('canvas');cv.width=W;cv.height=H;
      const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,W,H);
      const px=ctx.getImageData(0,0,W,H).data;
      const rx=raw.x*scale,ry=raw.y*scale,rs=raw.s*scale;
      let best={score:checkerScore(px,W,H,rx,ry,rs),x:rx,y:ry,s:rs};
      const scales=[.82,.84,.86,.88,.90,.92,.94,.96,.98,1,1.02];
      const shifts=[-.65,-.45,-.25,-.1,0,.1,.25,.45,.65];
      for(const sf of scales){
        const s=rs*sf,cell=rs/8;
        for(const dy of shifts) for(const dx of shifts){
          const x=rx+(rs-s)/2+dx*cell;
          const y=ry+(rs-s)/2+dy*cell;
          const score=checkerScore(px,W,H,x,y,s);
          if(score>best.score) best={score,x,y,s};
        }
      }
      const rawScore=checkerScore(px,W,H,rx,ry,rs);
      if(best.score>Math.max(4.2,rawScore*1.14)){
        const inv=1/scale;
        return {x:Math.round(best.x*inv),y:Math.round(best.y*inv),s:Math.round(best.s*inv)};
      }
    }catch(e){ console.warn('MateShot deep board refinement skipped:',e); }
    return raw;
  }

  window.detectBoard = detectBoard = function(img){
    return deepRefineBoard(img, baseDetectBoard(img));
  };

  function boardFromCells(cells){
    try{return cellsBoard(cells);}catch(_){return Array(64).fill(null);}
  }
  function boardStats(b){
    const count=x=>b.filter(p=>p===x).length;
    const pieces=b.filter(Boolean).length;
    const wk=count('K'),bk=count('k'),wp=count('P'),bp=count('p');
    const backPawn=b.slice(0,8).concat(b.slice(56)).some(p=>p&&p.toLowerCase()==='p');
    let adjacent=false;
    const a=b.indexOf('K'),z=b.indexOf('k');
    if(a>=0&&z>=0){const ar=(a/8)|0,ac=a%8,zr=(z/8)|0,zc=z%8;adjacent=Math.max(Math.abs(ar-zr),Math.abs(ac-zc))<=1;}
    let bothCheck=false;
    try{if(a>=0&&z>=0)bothCheck=attacked(b,a,'b')&&attacked(b,z,'w');}catch(_){}
    return {pieces,wk,bk,wp,bp,backPawn,adjacent,bothCheck};
  }
  function legalishBoard(b){
    const s=boardStats(b);
    return s.pieces>=3&&s.pieces<=32&&s.wk===1&&s.bk===1&&s.wp<=8&&s.bp<=8&&!s.backPawn&&!s.adjacent&&!s.bothCheck;
  }
  function recognitionConfidence(cells){
    const vals=cells.filter(c=>!c.empty&&c.alts?.length).map(c=>c.alts[0].score||0);
    return vals.length?med(vals):0;
  }

  function loadLegacyTf(){
    if(window.tf && typeof window.tf.loadFrozenModel==='function') return Promise.resolve(window.tf);
    if(tfPromise) return tfPromise;
    tfPromise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=TF_URL;s.async=true;s.crossOrigin='anonymous';
      s.onload=()=>window.tf&&typeof window.tf.loadFrozenModel==='function'?resolve(window.tf):reject(new Error('TensorFlow did not initialize.'));
      s.onerror=()=>reject(new Error('Could not load the advanced recognition engine.'));
      document.head.appendChild(s);
    });
    return tfPromise;
  }

  async function loadPredictor(){
    if(predictorPromise) return predictorPromise;
    predictorPromise=(async()=>{
      const tf=await loadLegacyTf();
      return tf.loadFrozenModel(`${MODEL_ROOT}/tensorflowjs_model.pb`,`${MODEL_ROOT}/weights_manifest.json`);
    })();
    return predictorPromise;
  }

  function drawMlBoard(img,rect,contrast=1){
    const cv=document.createElement('canvas');cv.width=256;cv.height=256;
    const ctx=cv.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(img,rect.x,rect.y,rect.s,rect.s,0,0,256,256);
    const im=ctx.getImageData(0,0,256,256),p=im.data;
    let mean=0;
    for(let i=0;i<p.length;i+=4) mean+=(p[i]*.299+p[i+1]*.587+p[i+2]*.114);
    mean/=65536;
    for(let i=0;i<p.length;i+=4){
      let y=p[i]*.299+p[i+1]*.587+p[i+2]*.114;
      y=Math.max(0,Math.min(255,(y-mean)*contrast+mean));
      p[i]=p[i+1]=p[i+2]=y;p[i+3]=255;
    }
    ctx.putImageData(im,0,0);
    return cv;
  }

  function getTiles(tf,imgTensor){
    const files=[];
    for(let i=0;i<8;i++) files[i]=imgTensor.slice([0,32*i,0],[256,32,1]).reshape([8,1024]);
    return tf.concat(files);
  }

  function predictionsToCells(pred){
    const cells=[];
    for(let r=0;r<8;r++) for(let c=0;c<8;c++){
      const idx=Math.max(0,Math.min(12,Math.round(pred[r+c*8])));
      const ch=LABELS[idx]||'1';
      if(ch==='1') cells.push({empty:true,r,c});
      else cells.push({empty:false,r,c,color:ch===ch.toUpperCase()?'w':'b',alts:[{t:ch.toLowerCase(),score:1}]});
    }
    return cells;
  }

  async function classifyMl(img,rect,contrast=1){
    const tf=await loadLegacyTf(),predictor=await loadPredictor(),cv=drawMlBoard(img,rect,contrast);
    const imgData=tf.fromPixels(cv).asType('float32');
    const gray=imgData.slice([0,0,0],[256,256,1]);
    const tiles=getTiles(tf,gray);
    const keep=tf.scalar(1.0);
    const out=predictor.execute({Input:tiles,KeepProb:keep});
    const pred=Array.from(out.dataSync());
    try{tf.dispose([imgData,gray,tiles,keep,out]);}catch(_){}
    return predictionsToCells(pred);
  }

  function candidateScore(cells){
    const b=boardFromCells(cells),s=boardStats(b);
    let q=0;
    q+=s.wk===1?45:-35*Math.abs(s.wk-1);
    q+=s.bk===1?45:-35*Math.abs(s.bk-1);
    q+=s.pieces>=3&&s.pieces<=32?18:-30;
    q+=s.wp<=8?6:-15;q+=s.bp<=8?6:-15;
    q+=s.backPawn?-10:4;q+=s.adjacent?-30:3;q+=s.bothCheck?-30:3;
    return q;
  }

  async function mlCells(img,rect){
    const attempts=[];
    for(const contrast of[1,1.22,.84]){
      try{attempts.push(await classifyMl(img,rect,contrast));}catch(e){console.warn('MateShot ML pass failed:',e);}
    }
    if(!attempts.length) throw new Error('Advanced recognition could not start.');
    attempts.sort((a,b)=>candidateScore(b)-candidateScore(a));
    return attempts[0];
  }

  function finalizeSolved(solved,cells,method){
    const pieces=cells.filter(c=>!c.empty).length;
    S.cells=cells;S.orientation=solved.orientation;S.start=solved.pos;
    S.line=annotate(solved.pos,solved.line);S.mateN=solved.mate;
    S.positions=[{b:solved.pos.b.slice(),side:solved.pos.side}];
    let pos={b:solved.pos.b.slice(),side:solved.pos.side};
    for(const m of S.line){pos=makeMove(pos,m);S.positions.push({b:pos.b.slice(),side:pos.side});}
    S.step=0;
    S.debug=`Reconocimiento: ${method} | Tablero: ${fenBoard(solved.pos.b)} ${solved.pos.side} | ${pieces} piezas | ${solved.tries||1} intentos`;
    const side=solved.pos.side==='b'?'Negras':'Blancas';
    document.getElementById('problemText').textContent=`${side} mueven · mate forzado`;
    document.getElementById('mate').textContent='Mate en '+S.mateN;
    document.getElementById('line').textContent=notation(S.line,solved.pos.side);
    renderBoard(S.positions[0].b,S.orientation,null);
  }

  // Replace the old one-pass analyzer. Familiar boards still take the fast path. If the
  // template confidence or chess legality is weak, MateShot uses the neural fallback.
  window.analyze = analyze = async function(url){
    stopPlay();S.dataUrl=url;S.debug='';S.rect=null;S.cells=null;
    show('processing');
    const procImg=document.getElementById('procImg');if(procImg)procImg.src=url;
    prog(7,'Leyendo el puzzle','Buscando el tablero...');
    try{
      const img=await loadImg(url);S.img=img;await wait(20);
      const rect=detectBoard(img);S.rect=rect;
      prog(28,'Tablero encontrado','Reconociendo las piezas...');await wait(16);

      const fastCells=scanBoard(img,rect);
      const fastBoard=boardFromCells(fastCells);
      const fastPieces=fastCells.filter(c=>!c.empty).length;
      const fastConf=recognitionConfidence(fastCells);
      let solved=null,usedCells=null,method='rápido';

      // Only spend the expensive chess search on the fast result when the visual reading
      // itself looks credible. This avoids 20+ seconds of searching a hallucinated board.
      if(fastPieces<=32 && legalishBoard(fastBoard) && fastConf>=.46){
        prog(50,'Piezas reconstruidas','Buscando la solución...');await wait(16);
        solved=await solveCells(fastCells);
        if(solved) usedCells=fastCells;
      }

      if(!solved){
        prog(43,'Afinando la lectura','Probando reconocimiento visual avanzado...');await wait(16);
        const advanced=await mlCells(img,rect);
        const advancedBoard=boardFromCells(advanced);
        if(!legalishBoard(advancedBoard)){
          const st=boardStats(advancedBoard);
          throw new Error(`No he podido reconstruir una posición legal con suficiente confianza (${st.pieces} piezas detectadas).`);
        }
        prog(63,'Posición reconstruida','Comprobando la solución de ajedrez...');await wait(16);
        solved=await solveCells(advanced);
        if(solved){usedCells=advanced;method='ML';}
      }

      if(!solved||!usedCells) throw new Error('He encontrado el tablero, pero no he podido confirmar una solución de mate de hasta 8 jugadas.');

      finalizeSolved(solved,usedCells,method);
      prog(100,'Listo','');await wait(120);show('result');
    }catch(e){
      console.error(e);
      const err=document.getElementById('errorText');
      if(err)err.textContent=e?.message||'No he podido resolver esta imagen.';
      const details=document.getElementById('details');
      if(details)details.textContent='El análisis se ha realizado en el navegador. '+(S.rect?`Tablero detectado en x ${S.rect.x}, y ${S.rect.y}, ${S.rect.s} px. `:'')+(S.debug||'');
      show('error');
    }
  };
})();
