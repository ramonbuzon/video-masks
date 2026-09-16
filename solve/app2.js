function labelsToPlacement(labels){
  const rows=[];
  for(let r=0;r<8;r++){
    let row="",empty=0;
    for(let c=0;c<8;c++){
      const p=CLASS_TO_FEN[labels[r*8+c]];
      if(!p)empty++;
      else{if(empty){row+=empty;empty=0}row+=p}
    }
    if(empty)row+=empty;rows.push(row)
  }
  return rows.join("/")
}
function rotatePlacement(p){
  const rows=p.split("/").map(row=>{
    const a=[];
    for(const ch of row){
      if(/[1-8]/.test(ch))for(let i=0;i<Number(ch);i++)a.push("");
      else a.push(ch)
    }
    return a
  });
  rows.reverse();rows.forEach(r=>r.reverse());
  return rows.map(r=>{
    let s="",n=0;
    for(const x of r){if(!x)n++;else{if(n){s+=n;n=0}s+=x}}
    if(n)s+=n;return s
  }).join("/")
}
function kingsOK(p){
  const t=p.replace(/[1-8/]/g,"");
  return (t.match(/K/g)||[]).length===1&&(t.match(/k/g)||[]).length===1
}
function fen(p,side){return p+" "+side+" - - 0 1"}

function statement(text){
  const lines=text.split(/\n+/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean);
  const re=/check|checkmate|mate|black|white|move|jaque|negras|blancas|muev|jueg/i;
  return (lines.filter(x=>re.test(x)).slice(0,3).join(" · ")||lines.slice(0,2).join(" · ")||"Puzzle detectado").slice(0,210)
}
function infer(text){
  const t=text.toLowerCase();
  let side=null,mate=null,checksOnly=false;
  if(/black\s+to\s+move|black\s+moves|negras?\s+(juegan|mueven)|mueven\s+negras/.test(t))side="b";
  if(/white\s+to\s+move|white\s+moves|blancas?\s+(juegan|mueven)|mueven\s+blancas/.test(t))side="w";
  const m=t.match(/mate\s+(?:in|en)\s*(\d+)/);if(m)mate=parseInt(m[1]);
  const checks=(t.match(/\bcheck\b/g)||[]).length;
  const checkmates=(t.match(/\bcheckmate\b/g)||[]).length;
  const jaques=(t.match(/\bjaque\b/g)||[]).length;
  if(!mate&&checkmates&&checks)mate=checks+checkmates;
  if(!mate&&jaques>=2)mate=jaques+1;
  if(checks>=2||jaques>=2)checksOnly=true;
  return {side,mate,checksOnly}
}

async function ocr(img,rect){
  const W=Math.min(1100,img.naturalWidth||img.width),scale=W/(img.naturalWidth||img.width);
  const H=Math.round((img.naturalHeight||img.height)*scale);
  const c=document.createElement("canvas");c.width=W;c.height=H;
  const ctx=c.getContext("2d");ctx.drawImage(img,0,0,W,H);
  ctx.fillStyle="#fff";ctx.fillRect(rect.x*scale,rect.y*scale,rect.s*scale,rect.s*scale);
  const out=await Tesseract.recognize(c,"eng+spa",{logger:m=>{
    if(m.status==="recognizing text")progress(21+Math.round((m.progress||0)*19),"Leyendo el enunciado",Math.round((m.progress||0)*100)+"%")
  }});
  return out.data.text||""
}

function applyMove(ch,m){return ch.move({from:m.from,to:m.to,promotion:m.promotion||"q"})}
function mateSearch(ch,attacker,remaining,deadline,checksOnly,memo){
  if(performance.now()>deadline)throw new Error("TIMEOUT");
  if(ch.isCheckmate())return ch.turn()!==attacker?[]:null;
  if(ch.isDraw&&ch.isDraw())return null;
  if(ch.turn()===attacker&&remaining<=0)return null;

  const key=ch.fen().split(" ").slice(0,4).join(" ")+"|"+attacker+"|"+remaining+"|"+(checksOnly?1:0);
  if(memo.has(key))return memo.get(key);

  let moves=ch.moves({verbose:true});
  if(ch.turn()===attacker){
    moves.sort((a,b)=>((b.san.includes("+")||b.san.includes("#"))?1:0)-((a.san.includes("+")||a.san.includes("#"))?1:0));
    if(checksOnly){
      const cm=moves.filter(x=>x.san.includes("+")||x.san.includes("#"));
      if(cm.length)moves=cm
    }
    for(const mv of moves){
      applyMove(ch,mv);
      const sub=mateSearch(ch,attacker,remaining-1,deadline,checksOnly,memo);
      ch.undo();
      if(sub!==null){
        const ans=[{from:mv.from,to:mv.to,san:mv.san,promotion:mv.promotion||null},...sub];
        memo.set(key,ans);return ans
      }
    }
    memo.set(key,null);return null
  }else{
    if(!moves.length){memo.set(key,null);return null}
    let worst=[];
    for(const mv of moves){
      applyMove(ch,mv);
      const sub=mateSearch(ch,attacker,remaining,deadline,checksOnly,memo);
      ch.undo();
      if(sub===null){memo.set(key,null);return null}
      const cand=[{from:mv.from,to:mv.to,san:mv.san,promotion:mv.promotion||null},...sub];
      if(cand.length>worst.length)worst=cand
    }
    memo.set(key,worst);return worst
  }
}

async function solvePlacement(p,side,mateHint,checksOnly,ms=2500){
  if(!kingsOK(p))return null;
  let ch;
  try{ch=new S.Chess(fen(p,side))}catch(e){return null}
  const ds=mateHint?[mateHint]:[1,2,3,4,5];
  for(const d of ds){
    await wait(0);
    try{
      const line=mateSearch(ch,side,d,performance.now()+ms,checksOnly,new Map());
      if(line!==null)return {p,side,mate:d,line}
    }catch(e){if(e.message==="TIMEOUT")return null;throw e}
  }
  return null
}

function candidateLabels(preds){
  const base=preds.map(x=>x.best);
  const out=[base];
  const uncertain=preds.map((x,i)=>({i,margin:x.margin,p:x.p,top:x.top}))
    .sort((a,b)=>a.margin-b.margin).slice(0,10);

  for(const u of uncertain){
    for(let a=1;a<Math.min(3,u.top.length);a++){
      if(u.top[a].p<.035)continue;
      const v=base.slice();v[u.i]=u.top[a].cls;out.push(v)
    }
  }
  const pair=uncertain.slice(0,6);
  for(let a=0;a<pair.length;a++)for(let b=a+1;b<pair.length;b++){
    if(pair[a].top[1].p<.04||pair[b].top[1].p<.04)continue;
    const v=base.slice();v[pair[a].i]=pair[a].top[1].cls;v[pair[b].i]=pair[b].top[1].cls;out.push(v)
  }

  const seen=new Set(),uniq=[];
  for(const labels of out){
    const p=labelsToPlacement(labels);
    if(!seen.has(p)){seen.add(p);uniq.push(p)}
  }
  return uniq
}

async function findSolution(preds,hint){
  const rawCandidates=candidateLabels(preds);
  const sides=hint.side?[hint.side]:["b","w"];
  let tries=0;

  for(const raw of rawCandidates){
    for(const item of [{p:raw,o:"white"},{p:rotatePlacement(raw),o:"black"}]){
      if(!kingsOK(item.p))continue;
      for(const side of sides){
        tries++;
        const ans=await solvePlacement(item.p,side,hint.mate,hint.checksOnly,tries<=4?2500:550);
        if(ans)return {...ans,orientation:item.o,tries}
      }
    }
  }
  if(hint.side){
    const other=hint.side==="b"?"w":"b";
    for(const raw of rawCandidates.slice(0,8)){
      for(const item of [{p:raw,o:"white"},{p:rotatePlacement(raw),o:"black"}]){
        if(!kingsOK(item.p))continue;
        tries++;
        const ans=await solvePlacement(item.p,other,hint.mate,hint.checksOnly,500);
        if(ans)return {...ans,orientation:item.o,tries}
      }
    }
  }
  return null
}

function lineText(line,side){
  let no=1,s=side,out=[];
  for(const m of line){
    if(s==="w"){out.push(no+". "+m.san);s="b"}
    else{
      if(out.length&&/^\d+\.\s/.test(out[out.length-1])&&!out[out.length-1].includes("..."))out[out.length-1]+=" "+m.san;
      else out.push(no+"... "+m.san);
      no++;s="w"
    }
  }
  return out.join(" ")
}
function buildPositions(start,line){
  const ch=new S.Chess(start),arr=[ch.fen()];
  for(const m of line){applyMove(ch,m);arr.push(ch.fen())}
  return arr
}
