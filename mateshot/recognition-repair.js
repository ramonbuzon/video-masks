/* MateShot recognition repair layer.
   Runs only when the normal fast + ML recognizers fail.
   Uses the MIT Elucidation classifier for occupancy/color, generic Cburnett silhouettes
   for piece-type alternatives, chess legality and the mate solver to repair uncertain reads. */
(() => {
  'use strict';

  const TF_URL='https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@0.12.5/dist/tf.min.js';
  const MODEL_COMMIT='c75063981c4f781f63ac90c0c026402e23ebbef6';
  const MODEL_ROOT=`https://cdn.jsdelivr.net/gh/Elucidation/ChessboardFenTensorflowJs@${MODEL_COMMIT}/frozen_model`;
  const LABELS='1KQRBNPkqrbnp';
  const PIECE_BASE='https://lichess1.org/assets/piece/cburnett/';
  const TYPES2=['k','q','r','b','n','p'];
  let tfP=null,predictorP=null,templatesP=null;
  const coreAnalyze=window.analyze;
  const coreSolve=window.solveCells;

  const med=a=>{if(!a.length)return 0;a=[...a].sort((x,y)=>x-y);const n=a.length;return n&1?a[n>>1]:(a[n/2-1]+a[n/2])/2;};
  const lum=(r,g,b)=>.299*r+.587*g+.114*b;

  function loadTf(){
    if(window.tf&&typeof window.tf.loadFrozenModel==='function')return Promise.resolve(window.tf);
    if(tfP)return tfP;
    tfP=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=TF_URL;s.async=true;s.crossOrigin='anonymous';s.onload=()=>window.tf?resolve(window.tf):reject(new Error('TensorFlow unavailable'));s.onerror=reject;document.head.appendChild(s);});
    return tfP;
  }
  async function predictor(){
    if(predictorP)return predictorP;
    predictorP=(async()=>{const tf=await loadTf();return tf.loadFrozenModel(`${MODEL_ROOT}/tensorflowjs_model.pb`,`${MODEL_ROOT}/weights_manifest.json`);})();
    return predictorP;
  }
  function tiles(tf,t){const files=[];for(let i=0;i<8;i++)files.push(t.slice([0,32*i,0],[256,32,1]).reshape([8,1024]));return tf.concat(files);}
  function drawBoard(img,rect,contrast=1){
    const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,rect.x,rect.y,rect.s,rect.s,0,0,256,256);const im=x.getImageData(0,0,256,256),p=im.data;let mean=0;for(let i=0;i<p.length;i+=4)mean+=lum(p[i],p[i+1],p[i+2]);mean/=65536;for(let i=0;i<p.length;i+=4){let y=lum(p[i],p[i+1],p[i+2]);y=Math.max(0,Math.min(255,(y-mean)*contrast+mean));p[i]=p[i+1]=p[i+2]=y;p[i+3]=255;}x.putImageData(im,0,0);return c;
  }
  function predCells(pred){const out=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++){const n=Math.max(0,Math.min(12,Math.round(pred[r+c*8]))),ch=LABELS[n]||'1';if(ch==='1')out.push({empty:true,r,c});else out.push({empty:false,r,c,color:ch===ch.toUpperCase()?'w':'b',alts:[{t:ch.toLowerCase(),score:.72}],mlType:ch.toLowerCase()});}return out;}
  async function classify(img,rect,contrast=1){
    const tf=await loadTf(),m=await predictor(),cv=drawBoard(img,rect,contrast),raw=tf.fromPixels(cv).asType('float32'),gray=raw.slice([0,0,0],[256,256,1]),tt=tiles(tf,gray),keep=tf.scalar(1),o=m.execute({Input:tt,KeepProb:keep}),p=Array.from(o.dataSync());try{tf.dispose([raw,gray,tt,keep,o]);}catch(_){}return predCells(p);
  }

  async function genericTemplates(){
    if(templatesP)return templatesP;
    templatesP=Promise.all(TYPES2.map(t=>new Promise((resolve,reject)=>{
      const im=new Image();im.crossOrigin='anonymous';im.onload=()=>{
        try{const c=document.createElement('canvas');c.width=c.height=96;const x=c.getContext('2d',{willReadFrequently:true});x.clearRect(0,0,96,96);x.drawImage(im,4,4,88,88);const p=x.getImageData(0,0,96,96).data,m=new Uint8Array(96*96);for(let i=0;i<m.length;i++)if(p[i*4+3]>28)m[i]=1;const comp=largestComponent(m,96,96);resolve([t,normalizeMask(comp.mask,96,96)]);}catch(e){reject(e);}
      };im.onerror=reject;im.src=PIECE_BASE+'b'+t.toUpperCase()+'.svg';
    }))).then(a=>Object.fromEntries(a)).catch(()=>TEMPLATES);
    return templatesP;
  }

  function boardCanvas(img,rect){const size=800,c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,rect.x,rect.y,rect.s,rect.s,0,0,size,size);return{x,p:x.getImageData(0,0,size,size).data,size,cell:size/8};}
  function squareFeatures(cache,r,c){
    const {p,size,cell}=cache,x0=Math.round(c*cell),y0=Math.round(r*cell),w=Math.round(cell),h=Math.round(cell),g=Math.max(5,Math.round(cell*.07));
    const samples=[];for(const [xx,yy] of[[g,g],[w-g-1,g],[g,h-g-1],[w-g-1,h-g-1]])for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const X=x0+Math.max(0,Math.min(w-1,xx+dx)),Y=y0+Math.max(0,Math.min(h-1,yy+dy)),i=(Y*size+X)*4;samples.push([p[i],p[i+1],p[i+2]]);}
    const bg=[med(samples.map(v=>v[0])),med(samples.map(v=>v[1])),med(samples.map(v=>v[2]))],bgL=lum(...bg),mask=new Uint8Array(w*h);let diffSum=0;
    for(let y=g;y<h-g;y++)for(let x=g;x<w-g;x++){const i=((y0+y)*size+x0+x)*4,dr=p[i]-bg[0],dg=p[i+1]-bg[1],db=p[i+2]-bg[2],d=Math.sqrt(dr*dr+dg*dg+db*db)/441.67;diffSum+=d;if(d>.105)mask[y*w+x]=1;}
    const comp=largestComponent(mask,w,h),nm=normalizeMask(comp.mask,w,h);let fgL=0;for(const z of comp.pts){const y=(z/w)|0,x=z-y*w,i=((y0+y)*size+x0+x)*4;fgL+=lum(p[i],p[i+1],p[i+2]);}fgL/=Math.max(1,comp.pts.length);
    const area=comp.pts.length/(w*h),colorDelta=fgL-bgL,likeness=area*Math.min(1.5,diffSum/(w*h*.08));
    return{nm,area,colorDelta,likeness};
  }

  async function augment(cells,img,rect){
    const gt=await genericTemplates(),bc=boardCanvas(img,rect),features=[];
    for(let i=0;i<64;i++)features[i]=squareFeatures(bc,(i/8)|0,i%8);
    const out=cells.map((c,i)=>{
      if(c.empty)return{...c,_feat:features[i]};
      const f=features[i],scores=TYPES2.map(t=>({t,score:Math.max(iou(f.nm,gt[t]||TEMPLATES[t]),iou(f.nm,TEMPLATES[t]))})).sort((a,b)=>b.score-a.score);
      const map=new Map();map.set(c.alts?.[0]?.t||c.mlType,{t:c.alts?.[0]?.t||c.mlType,score:.72});
      for(const s of scores.slice(0,4)){const sc=.53+.28*s.score;if(!map.has(s.t)||map.get(s.t).score<sc)map.set(s.t,{t:s.t,score:sc});}
      let color=c.color;if(f.colorDelta>26)color='w';else if(f.colorDelta<-26)color='b';
      return{...c,color,alts:[...map.values()].sort((a,b)=>b.score-a.score),_feat:f};
    });
    return out;
  }

  function setSolved(solved,cells,method){
    S.cells=cells;S.orientation=solved.orientation;S.start=solved.pos;S.line=annotate(solved.pos,solved.line);S.mateN=solved.mate;S.positions=[{b:solved.pos.b.slice(),side:solved.pos.side}];let pos={b:solved.pos.b.slice(),side:solved.pos.side};for(const m of S.line){pos=makeMove(pos,m);S.positions.push({b:pos.b.slice(),side:pos.side});}S.step=0;S.debug=`Reconocimiento: ${method} | ${cells.filter(c=>!c.empty).length} piezas`;
    document.getElementById('problemText').textContent=(solved.pos.side==='b'?'Negras':'Blancas')+' mueven · mate';document.getElementById('mate').textContent='Mate en '+S.mateN;document.getElementById('line').textContent=notation(S.line,solved.pos.side);renderBoard(S.positions[0].b,S.orientation,null);prog(100,'Listo','');show('result');
  }

  async function quickSolve(cells,maxDepth=4){
    const base=cellsBoard(cells),pref=preferredOrientation(cells),order=pref==='black'?[{b:rotateBoard(base),o:'black'},{b:base,o:'white'}]:[{b:base,o:'white'},{b:rotateBoard(base),o:'black'}];let tries=0;
    for(const item of order)for(const side of(item.o==='black'?['b','w']:['w','b'])){tries++;const hit=findMate(item.b,side,maxDepth,1100);if(hit)return{...hit,orientation:item.o,tries};}
    return null;
  }

  async function recover(){
    if(!S.img||!S.rect)return false;
    prog(48,'Afinando la lectura','Combinando visión y reglas de ajedrez...');await wait(16);
    const passes=[];for(const k of[1,1.2,.86]){try{passes.push(await classify(S.img,S.rect,k));}catch(_){}}
    for(const base of passes){
      const cells=await augment(base,S.img,S.rect);
      let hit=await coreSolve(cells);if(hit){setSolved(hit,cells,'híbrido');return true;}
      // A classifier can occasionally mark one real piece as empty. Try only the most
      // piece-like empty squares, and only with the strongest generic type candidates.
      const empties=cells.map((c,i)=>({c,i,f:c._feat})).filter(x=>x.c.empty&&x.f&&x.f.area>.035).sort((a,b)=>b.f.likeness-a.f.likeness).slice(0,4);
      const gt=await genericTemplates();
      for(const e of empties){
        const ranked=TYPES2.map(t=>({t,score:Math.max(iou(e.f.nm,gt[t]||TEMPLATES[t]),iou(e.f.nm,TEMPLATES[t]))})).sort((a,b)=>b.score-a.score).slice(0,2);
        const colors=Math.abs(e.f.colorDelta)>18?[e.f.colorDelta>0?'w':'b']:['w','b'];
        for(const col of colors)for(const rr of ranked){
          const v=cells.map((c,i)=>i===e.i?{empty:false,r:c.r,c:c.c,color:col,alts:[{t:rr.t,score:.74}],_feat:e.f}:c);
          hit=await quickSolve(v,4);if(hit){setSolved(hit,v,'híbrido + reparación');return true;}
        }
      }
    }
    return false;
  }

  window.analyze=analyze=async function(url){
    await coreAnalyze(url);
    if(document.getElementById('result')?.classList.contains('active'))return;
    try{if(await recover())return;}catch(e){console.warn('MateShot recovery skipped:',e);}
  };
})();
