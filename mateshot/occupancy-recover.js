/* MateShot occupancy-aware recovery.
   Runs after the hybrid recognizer. It preserves the neural piece reading where useful,
   but restores strong occupied squares detected by the image itself before solving again. */
(() => {
  'use strict';
  const coreAnalyze=window.analyze;
  if(typeof coreAnalyze!=='function')return;

  function mergeCells(primary,fast){
    const out=[];
    for(let i=0;i<64;i++){
      const a=primary?.[i],b=fast?.[i];
      if((!a||a.empty)&&b&&!b.empty){out.push({...b});continue;}
      if(a&&!a.empty&&b&&!b.empty){
        const map=new Map();
        for(const x of(a.alts||[]))map.set(x.t,{...x});
        for(const x of(b.alts||[]))if(!map.has(x.t)||(map.get(x.t).score||0)<(x.score||0))map.set(x.t,{...x});
        out.push({...a,alts:[...map.values()].sort((x,y)=>(y.score||0)-(x.score||0))});continue;
      }
      out.push(a?{...a}:b?{...b}:{empty:true,r:(i/8)|0,c:i%8});
    }
    return out;
  }

  function applySolved(solved,cells,method){
    S.cells=cells;S.orientation=solved.orientation;S.start=solved.pos;
    S.line=annotate(solved.pos,solved.line);S.mateN=solved.mate;
    S.positions=[{b:solved.pos.b.slice(),side:solved.pos.side}];
    let pos={b:solved.pos.b.slice(),side:solved.pos.side};
    for(const m of S.line){pos=makeMove(pos,m);S.positions.push({b:pos.b.slice(),side:pos.side});}
    S.step=0;S.debug=`Reconocimiento: ${method} | ${cells.filter(c=>!c.empty).length} piezas`;
    document.getElementById('problemText').textContent=(solved.pos.side==='b'?'Negras':'Blancas')+' mueven · mate';
    document.getElementById('mate').textContent='Mate en '+S.mateN;
    document.getElementById('line').textContent=notation(S.line,solved.pos.side);
    renderBoard(S.positions[0].b,S.orientation,null);prog(100,'Listo','');show('result');
  }

  window.analyze=analyze=async function(url){
    await coreAnalyze(url);
    const isError=document.getElementById('error')?.classList.contains('active');
    if(!isError)return;
    let fast=S.integrityFastCells;
    if(!fast&&S.img&&S.rect){try{fast=scanBoard(S.img,S.rect);}catch(_){}}
    if(!fast)return;

    const reliable=fast.filter(c=>!c.empty&&(c.alts?.[0]?.score||0)>=.25).length;
    if(reliable<3||reliable>32)return;
    prog(58,'Afinando la posición','Comprobando las casillas ocupadas...');await wait(12);

    const candidates=[];
    if(S.cells?.length===64)candidates.push({cells:mergeCells(S.cells,fast),name:'visión + ocupación'});
    candidates.push({cells:fast,name:'ocupación directa'});

    const seen=new Set();
    for(const cand of candidates){
      const key=cand.cells.map(c=>c.empty?'1':(c.color+(c.alts?.[0]?.t||'?'))).join('');
      if(seen.has(key))continue;seen.add(key);
      try{
        const hit=await solveCells(cand.cells);
        if(hit){applySolved(hit,cand.cells,cand.name);return;}
      }catch(e){console.warn('MateShot occupancy recovery pass skipped:',e);}
    }
  };
})();
