/* MateShot solver v3: robust board refinement, coordinate-safe recognition and deeper composed-mate search. */
(() => {
  const MAX_MATE=8;
  const coreDetectBoard=window.detectBoard;
  function med(values){if(!values.length)return 0;values=[...values].sort((a,b)=>a-b);const n=values.length;return n&1?values[n>>1]:(values[(n>>1)-1]+values[n>>1])/2;}
  function dist3(a,b){const x=a[0]-b[0],y=a[1]-b[1],z=a[2]-b[2];return Math.sqrt(x*x+y*y+z*z);}
  function boardColourScore(px,W,H,x0,y0,s){
    if(x0<0||y0<0||x0+s>=W||y0+s>=H)return-1;
    const offsets=[[.22,.22],[.78,.22],[.22,.78],[.78,.78],[.5,.15],[.15,.5],[.85,.5],[.5,.85]],A=[],B=[];
    for(let r=0;r<8;r++)for(let c=0;c<8;c++){
      const rr=[],gg=[],bb=[];
      for(const [ox,oy] of offsets){const x=Math.max(0,Math.min(W-1,Math.round(x0+(c+ox)*s/8))),y=Math.max(0,Math.min(H-1,Math.round(y0+(r+oy)*s/8))),i=(y*W+x)*4;rr.push(px[i]);gg.push(px[i+1]);bb.push(px[i+2]);}
      const col=[med(rr),med(gg),med(bb)];(((r+c)&1)?B:A).push(col);
    }
    const center=arr=>[med(arr.map(v=>v[0])),med(arr.map(v=>v[1])),med(arr.map(v=>v[2]))],ca=center(A),cb=center(B),sep=dist3(ca,cb),wa=med(A.map(v=>dist3(v,ca))),wb=med(B.map(v=>dist3(v,cb)));
    return sep/(wa+wb+1);
  }
  window.detectBoard=detectBoard=function(img){
    const raw=coreDetectBoard(img);
    try{
      const W0=img.naturalWidth||img.width,H0=img.naturalHeight||img.height,maxW=480,scale=Math.min(1,maxW/W0),W=Math.round(W0*scale),H=Math.round(H0*scale);
      const cv=document.createElement('canvas');cv.width=W;cv.height=H;const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,W,H);const px=ctx.getImageData(0,0,W,H).data;
      const rx=raw.x*scale,ry=raw.y*scale,rs=raw.s*scale;let best={score:boardColourScore(px,W,H,rx,ry,rs),x:rx,y:ry,s:rs};
      const shifts=[-1.5,-1.25,-1,-.75,-.5,-.25,0,.25,.5,.75,1,1.25,1.5],scales=[.97,1,1.03];
      for(const sf of scales){const s=rs*sf,cell=s/8;for(const dy of shifts)for(const dx of shifts){const x=rx+dx*cell,y=ry+dy*cell,score=boardColourScore(px,W,H,x,y,s);if(score>best.score)best={score,x,y,s};}}
      if(best.score>10){const inv=1/scale;return{x:Math.max(0,Math.round(best.x*inv)),y:Math.max(0,Math.round(best.y*inv)),s:Math.round(best.s*inv)};}
    }catch(e){console.warn('MateShot board refinement skipped',e);}
    return raw;
  };

  window.scanBoard=scanBoard=function(img,rect){
    const size=800,cv=document.createElement('canvas');cv.width=size;cv.height=size;const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,rect.x,rect.y,rect.s,rect.s,0,0,size,size);const px=ctx.getImageData(0,0,size,size).data,cell=size/8,cells=[];
    for(let r=0;r<8;r++)for(let c=0;c<8;c++){
      const x0=Math.round(c*cell),y0=Math.round(r*cell),x1=Math.round((c+1)*cell),y1=Math.round((r+1)*cell),w=x1-x0,h=y1-y0,inset=Math.max(3,Math.round(Math.min(w,h)*.07)),samples=[];
      const corners=[[inset,inset],[w-inset-1,inset],[inset,h-inset-1],[w-inset-1,h-inset-1]];
      for(const [cx,cy] of corners)for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const xx=Math.max(0,Math.min(w-1,cx+dx))+x0,yy=Math.max(0,Math.min(h-1,cy+dy))+y0,i=(yy*size+xx)*4;samples.push([px[i],px[i+1],px[i+2]]);}
      const bg=[median(samples.map(s=>s[0])),median(samples.map(s=>s[1])),median(samples.map(s=>s[2]))],bgL=.299*bg[0]+.587*bg[1]+.114*bg[2],mask=new Uint8Array(w*h),guard=Math.max(4,Math.round(Math.min(w,h)*.05));
      let xx0=guard,xx1=w-guard,yy0=guard,yy1=h-guard;if(c===7)xx1=Math.min(xx1,Math.round(w*.82));if(r===7)yy1=Math.min(yy1,Math.round(h*.82));
      for(let yy=yy0;yy<yy1;yy++)for(let xx=xx0;xx<xx1;xx++){const i=((y0+yy)*size+x0+xx)*4,dr=px[i]-bg[0],dg=px[i+1]-bg[1],db=px[i+2]-bg[2];if(Math.sqrt(dr*dr+dg*dg+db*db)/441.67>.13)mask[yy*w+xx]=1;}
      const comp=largestComponent(mask,w,h);if(comp.pts.length<w*h*.035){cells.push({empty:true,r,c});continue;}
      const nm=normalizeMask(comp.mask,w,h),ranked=TYPES.map(t=>({t,score:iou(nm,TEMPLATES[t])})).sort((a,b)=>b.score-a.score);if(ranked[0].score<.25){cells.push({empty:true,r,c});continue;}
      let light=0,dark=0;for(const z of comp.pts){const yy=(z/w)|0,xx=z-yy*w,i=((y0+yy)*size+x0+xx)*4,L=.299*px[i]+.587*px[i+1]+.114*px[i+2];if(L>bgL+25)light++;else if(L<bgL-25)dark++;}
      cells.push({empty:false,r,c,color:light>dark*.4?'w':'b',alts:ranked.slice(0,3)});
    }
    return cells;
  };

  function kingRepairUse(cells){
    const use={};
    for(const color of['w','b']){
      const ks=[];for(let i=0;i<cells.length;i++){const c=cells[i];if(c.empty||c.color!==color||c.alts?.[0]?.t!=='k')continue;const next=c.alts.find(a=>a.t!=='k');ks.push({i,confidence:c.alts[0].score-(next?.score||0)});}
      if(ks.length>1){ks.sort((a,b)=>b.confidence-a.confidence);for(const extra of ks.slice(1)){const c=cells[extra.i],alt=c.alts.findIndex(a=>a.t!=='k');if(alt>0)use[extra.i]=alt;}}
    }
    return use;
  }

  function forcedMateQuiet(pos,attacker,rem,quietLeft,deadline,memo,stats){
    if((++stats.nodes&2047)===0&&performance.now()>deadline)throw new Error('TIMEOUT');
    const moves=legalMoves(pos);if(!moves.length)return inCheck(pos,pos.side)&&pos.side!==attacker?[]:null;if(pos.side===attacker&&rem<=0)return null;
    const key=posKey(pos,rem)+'|q'+quietLeft;if(memo.has(key))return memo.get(key);
    if(pos.side===attacker){
      const ordered=moves.map(m=>({m,ch:givesCheck(pos,m),cap:!!m.capture})).sort((a,b)=>(Number(b.ch)-Number(a.ch))*100+(Number(b.cap)-Number(a.cap))*10);
      for(const x of ordered){if(!x.ch&&quietLeft<=0)continue;const sub=forcedMateQuiet(makeMove(pos,x.m),attacker,rem-1,quietLeft-(x.ch?0:1),deadline,memo,stats);if(sub!==null){const ans=[x.m,...sub];memo.set(key,ans);return ans;}}
      memo.set(key,null);return null;
    }
    const ordered=moves.map(m=>({m,s:(m.capture?80:0)+(givesCheck(pos,m)?40:0)})).sort((a,b)=>b.s-a.s);let worst=[];
    for(const x of ordered){const sub=forcedMateQuiet(makeMove(pos,x.m),attacker,rem,quietLeft,deadline,memo,stats);if(sub===null){memo.set(key,null);return null;}const cand=[x.m,...sub];if(cand.length>worst.length)worst=cand;}
    memo.set(key,worst);return worst;
  }

  window.findMate=findMate=function(board,side,maxDepth=MAX_MATE,ms=18000){
    if(!validShape(board))return null;const pos={b:board.slice(),side},deadline=performance.now()+ms;
    for(let d=1;d<=maxDepth;d++){try{const line=forcedMate(pos,side,d,deadline,true,new Map());if(line)return{line,mate:d,pos};}catch(e){if(e.message==='TIMEOUT')break;throw e;}}
    for(let quiet=1;quiet<=3;quiet++)for(let d=1;d<=maxDepth;d++){if(performance.now()>deadline)return null;try{const line=forcedMateQuiet(pos,side,d,quiet,deadline,new Map(),{nodes:0});if(line)return{line,mate:d,pos};}catch(e){if(e.message==='TIMEOUT')return null;throw e;}}
    return null;
  };

  window.solveCells=solveCells=async function(cells){
    const pref=preferredOrientation(cells),baseUse=kingRepairUse(cells),base=cellsBoard(cells,baseUse),orderFor=b=>pref==='black'?[{b:rotateBoard(b),o:'black'},{b,o:'white'}]:[{b,o:'white'},{b:rotateBoard(b),o:'black'}];
    let tries=0;const overall=performance.now()+26000;
    async function attempt(bb,variant=false){for(const item of orderFor(bb)){const sides=item.o==='black'?['b','w']:['w','b'];for(const side of sides){if(performance.now()>overall)return null;tries++;prog(62,'Buscando el mate','Probando orientación, turno y mates largos...');await wait(0);const budget=Math.min(variant?9000:20000,Math.max(800,overall-performance.now())),hit=findMate(item.b,side,MAX_MATE,budget);if(hit)return{...hit,orientation:item.o,tries};}}return null;}
    let hit=await attempt(base,false);if(hit)return hit;
    const uncertain=[];
    for(let i=0;i<cells.length;i++){const c=cells[i];if(c.empty||c.alts.length<2)continue;const current=baseUse[i]||0,baseScore=c.alts[current]?.score||0;for(let alt=0;alt<Math.min(3,c.alts.length);alt++){if(alt===current)continue;const pen=Math.max(0,baseScore-c.alts[alt].score);if(pen<.18||baseScore<.79)uncertain.push({i,alt,pen});}}
    uncertain.sort((a,b)=>a.pen-b.pen);const variants=[];
    for(const u of uncertain.slice(0,14)){variants.push({use:{...baseUse,[u.i]:u.alt},pen:u.pen});}
    for(let a=0;a<Math.min(8,uncertain.length);a++)for(let b=a+1;b<Math.min(8,uncertain.length);b++){if(uncertain[a].i===uncertain[b].i)continue;variants.push({use:{...baseUse,[uncertain[a].i]:uncertain[a].alt,[uncertain[b].i]:uncertain[b].alt},pen:uncertain[a].pen+uncertain[b].pen});}
    variants.sort((a,b)=>a.pen-b.pen);
    for(const v of variants.slice(0,48)){if(performance.now()>overall)break;const bb=cellsBoard(cells,v.use);if(!validShape(bb))continue;if(tries%3===0){prog(72,'Afinando piezas','Comprobando alternativas y mate de hasta 8...');await wait(0);}hit=await attempt(bb,true);if(hit)return hit;}
    return null;
  };

  const coreAnalyze=window.analyze;
  if(coreAnalyze){window.analyze=analyze=async function(url){try{S.debug='';S.rect=null;S.cells=null;}catch(_){}const out=await coreAnalyze(url);const err=document.getElementById('errorText');if(document.getElementById('error')?.classList.contains('active')&&err)err.textContent=err.textContent.replace(/hasta\s+5\s+jugadas/i,'hasta 8 jugadas');return out;};}
})();
