/* MateShot solver v2: ignores printed board coordinates and searches forced mates up to 8, including quiet attacking moves. */
(() => {
  const MAX_MATE = 8;
  const BORDER_GUARD = 0.08;

  window.scanBoard = scanBoard = function(img,rect){
    const size=800,cv=document.createElement('canvas');cv.width=size;cv.height=size;
    const ctx=cv.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(img,rect.x,rect.y,rect.s,rect.s,0,0,size,size);
    const px=ctx.getImageData(0,0,size,size).data,cell=size/8,cells=[];
    for(let r=0;r<8;r++)for(let c=0;c<8;c++){
      const x0=Math.round(c*cell),y0=Math.round(r*cell),x1=Math.round((c+1)*cell),y1=Math.round((r+1)*cell),w=x1-x0,h=y1-y0;
      const inset=Math.max(3,Math.round(Math.min(w,h)*.07)),samples=[];
      const corners=[[inset,inset],[w-inset-1,inset],[inset,h-inset-1],[w-inset-1,h-inset-1]];
      for(const [cx,cy] of corners)for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
        const xx=Math.max(0,Math.min(w-1,cx+dx))+x0,yy=Math.max(0,Math.min(h-1,cy+dy))+y0,i=(yy*size+xx)*4;
        samples.push([px[i],px[i+1],px[i+2]]);
      }
      const bg=[median(samples.map(s=>s[0])),median(samples.map(s=>s[1])),median(samples.map(s=>s[2]))];
      const mask=new Uint8Array(w*h),bgL=.299*bg[0]+.587*bg[1]+.114*bg[2];
      const guard=Math.max(5,Math.round(Math.min(w,h)*BORDER_GUARD));
      for(let yy=guard;yy<h-guard;yy++)for(let xx=guard;xx<w-guard;xx++){
        const i=((y0+yy)*size+x0+xx)*4,dr=px[i]-bg[0],dg=px[i+1]-bg[1],db=px[i+2]-bg[2];
        const dist=Math.sqrt(dr*dr+dg*dg+db*db)/441.67;
        if(dist>.13)mask[yy*w+xx]=1;
      }
      const comp=largestComponent(mask,w,h);
      if(comp.pts.length<w*h*.035){cells.push({empty:true,r,c});continue;}
      const nm=normalizeMask(comp.mask,w,h);
      const ranked=TYPES.map(t=>({t,score:iou(nm,TEMPLATES[t])})).sort((a,b)=>b.score-a.score);
      if(ranked[0].score<.25){cells.push({empty:true,r,c});continue;}
      let light=0,dark=0;
      for(const z of comp.pts){
        const yy=(z/w)|0,xx=z-yy*w,i=((y0+yy)*size+x0+xx)*4,L=.299*px[i]+.587*px[i+1]+.114*px[i+2];
        if(L>bgL+25)light++;else if(L<bgL-25)dark++;
      }
      const color=light>dark*.4?'w':'b';
      cells.push({empty:false,r,c,color,alts:ranked.slice(0,3)});
    }
    return cells;
  };

  function smartScore(pos,m){
    let score=0;
    if(givesCheck(pos,m))score+=1000;
    if(m.capture)score+=180;
    if(m.promotion)score+=120;
    const t=pt(m.piece);
    if(t==='q'||t==='r')score+=8;
    return score;
  }

  function forcedMateSmart(pos,attacker,rem,deadline,memo){
    if(performance.now()>deadline)throw new Error('TIMEOUT');
    const moves=legalMoves(pos);
    if(!moves.length)return inCheck(pos,pos.side)&&pos.side!==attacker?[]:null;
    if(pos.side===attacker&&rem<=0)return null;
    const key=posKey(pos,rem)+'|smart';
    if(memo.has(key))return memo.get(key);

    if(pos.side===attacker){
      const ordered=moves.map(m=>({m,s:smartScore(pos,m)})).sort((a,b)=>b.s-a.s);
      for(const x of ordered){
        const n=makeMove(pos,x.m),sub=forcedMateSmart(n,attacker,rem-1,deadline,memo);
        if(sub!==null){const ans=[x.m,...sub];memo.set(key,ans);return ans;}
      }
      memo.set(key,null);return null;
    }

    const ordered=moves.map(m=>({m,s:(m.capture?80:0)+(givesCheck(pos,m)?40:0)})).sort((a,b)=>b.s-a.s);
    let worst=[];
    for(const x of ordered){
      const n=makeMove(pos,x.m),sub=forcedMateSmart(n,attacker,rem,deadline,memo);
      if(sub===null){memo.set(key,null);return null;}
      const cand=[x.m,...sub];if(cand.length>worst.length)worst=cand;
    }
    memo.set(key,worst);return worst;
  }

  window.findMate = findMate = function(board,side,maxDepth=MAX_MATE,ms=4500){
    if(!validShape(board))return null;
    const pos={b:board.slice(),side};
    const start=performance.now(),deadline=start+ms;

    for(let d=1;d<=maxDepth;d++){
      try{
        const line=forcedMate(pos,side,d,deadline,true,new Map());
        if(line)return{line,mate:d,pos};
      }catch(e){if(e.message==='TIMEOUT')break;throw e;}
    }

    const quietDeadline=start+ms;
    for(let d=1;d<=maxDepth;d++){
      if(performance.now()>quietDeadline)return null;
      try{
        const line=forcedMateSmart(pos,side,d,quietDeadline,new Map());
        if(line)return{line,mate:d,pos};
      }catch(e){if(e.message==='TIMEOUT')return null;throw e;}
    }
    return null;
  };

  window.solveCells = solveCells = async function(cells){
    const base=cellsBoard(cells),pref=preferredOrientation(cells);
    const makeOrder=b=>pref==='black'?[{b:rotateBoard(b),o:'black'},{b,o:'white'}]:[{b,o:'white'},{b:rotateBoard(b),o:'black'}];
    let tries=0;
    const overall=performance.now()+14000;

    async function attemptBoard(bb,variantPenalty=0){
      for(const item of makeOrder(bb)){
        const sideOrder=item.o==='black'?['b','w']:['w','b'];
        for(const side of sideOrder){
          if(performance.now()>overall)return null;
          tries++;
          prog(62,'Buscando el mate','Probando orientación, turno y mates largos...');
          await wait(0);
          const remaining=Math.max(500,overall-performance.now());
          const budget=Math.min(variantPenalty?3600:5200,remaining);
          const hit=findMate(item.b,side,MAX_MATE,budget);
          if(hit)return{...hit,orientation:item.o,tries};
        }
      }
      return null;
    }

    let hit=await attemptBoard(base,0);if(hit)return hit;

    const uncertain=[];
    for(let i=0;i<cells.length;i++){
      const c=cells[i];if(c.empty||c.alts.length<2)continue;
      const margin=c.alts[0].score-c.alts[1].score;
      if(margin<.16||c.alts[0].score<.78)uncertain.push({i,margin});
    }
    uncertain.sort((a,b)=>a.margin-b.margin);
    const variants=[];
    for(const u of uncertain.slice(0,10)){
      for(let alt=1;alt<Math.min(3,cells[u.i].alts.length);alt++){
        const use={};use[u.i]=alt;
        variants.push({use,pen:cells[u.i].alts[0].score-cells[u.i].alts[alt].score});
      }
    }
    for(let a=0;a<Math.min(7,uncertain.length);a++)for(let b=a+1;b<Math.min(7,uncertain.length);b++){
      const use={};use[uncertain[a].i]=1;use[uncertain[b].i]=1;
      variants.push({use,pen:uncertain[a].margin+uncertain[b].margin});
    }
    variants.sort((a,b)=>a.pen-b.pen);

    for(const v of variants.slice(0,80)){
      if(performance.now()>overall)break;
      const bb=cellsBoard(cells,v.use);if(!validShape(bb))continue;
      if(tries%4===0){prog(71,'Corrigiendo lecturas dudosas','Comprobando piezas y mates de hasta 8...');await wait(0);}
      hit=await attemptBoard(bb,v.pen||.001);if(hit)return hit;
    }
    return null;
  };

  const coreAnalyze=window.analyze;
  if(coreAnalyze){
    window.analyze = analyze = async function(url){
      try{S.debug='';}catch(_){ }
      const out=await coreAnalyze(url);
      const err=document.getElementById('errorText');
      if(document.getElementById('error')?.classList.contains('active')&&err){
        err.textContent=err.textContent.replace(/hasta\s+5\s+jugadas/i,'hasta 8 jugadas');
      }
      return out;
    };
  }
})();
