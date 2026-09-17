/* MateShot result integrity guard.
   A visually plausible occupied square must not silently disappear just because a neural
   classifier called it empty. If that happens, reject the candidate before the recovery
   layer accepts a false chess solution. */
(() => {
  'use strict';
  const coreAnalyze=window.analyze;
  if(typeof coreAnalyze!=='function')return;

  function rawBoardFromSolved(){
    if(!S?.start?.b)return null;
    return S.orientation==='black'?rotateBoard(S.start.b):S.start.b.slice();
  }
  function reliableFastCells(){
    if(!S?.img||!S?.rect)return null;
    try{return scanBoard(S.img,S.rect);}catch(_){return null;}
  }
  function mismatch(fast){
    const raw=rawBoardFromSolved();if(!raw||!fast)return null;
    const missing=[];
    for(let i=0;i<64;i++){
      const c=fast[i];
      if(!c||c.empty)continue;
      const score=c.alts?.[0]?.score||0;
      // Ignore weak text/watermark-like detections. Real pieces in the legacy recognizer
      // normally clear this by a comfortable margin.
      if(score<.31)continue;
      if(!raw[i])missing.push(i);
    }
    return missing;
  }

  window.analyze=analyze=async function(url){
    await coreAnalyze(url);
    if(!document.getElementById('result')?.classList.contains('active'))return;
    const fast=reliableFastCells();
    if(!fast)return;
    const count=fast.filter(c=>!c.empty&&(c.alts?.[0]?.score||0)>=.31).length;
    const miss=mismatch(fast)||[];
    if(count>=3&&count<=32&&miss.length>0&&miss.length<=3){
      S.integrityFastCells=fast;
      S.integrityMissing=miss;
      stopPlay();
      const err=document.getElementById('errorText');
      if(err)err.textContent='Afinando la reconstrucción del tablero…';
      show('error');
    }else{
      S.integrityFastCells=fast;
      S.integrityMissing=[];
    }
  };
})();
