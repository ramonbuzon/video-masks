/* MateShot board detector guard.
   Repairs suspiciously-small detections by looking for a real 8x8 periodic grid.
   It leaves already-plausible detections untouched. */
(() => {
  'use strict';
  const baseDetect = window.detectBoard;
  if (typeof baseDetect !== 'function') return;

  function periodicGrid(img){
    const W0=img.naturalWidth||img.width,H0=img.naturalHeight||img.height;
    const maxW=520,scale=Math.min(1,maxW/W0),W=Math.max(80,Math.round(W0*scale)),H=Math.max(80,Math.round(H0*scale));
    const cv=document.createElement('canvas');cv.width=W;cv.height=H;
    const ctx=cv.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,W,H);
    const p=ctx.getImageData(0,0,W,H).data;
    const ex=new Float32Array(Math.max(1,W-1)),ey=new Float32Array(Math.max(1,H-1));
    for(let y=0;y<H;y++)for(let x=0;x<W-1;x++){
      const i=(y*W+x)*4,j=i+4;ex[x]+=(Math.abs(p[j]-p[i])+Math.abs(p[j+1]-p[i+1])+Math.abs(p[j+2]-p[i+2]))/3;
    }
    for(let y=0;y<H-1;y++)for(let x=0;x<W;x++){
      const i=(y*W+x)*4,j=((y+1)*W+x)*4;ey[y]+=(Math.abs(p[j]-p[i])+Math.abs(p[j+1]-p[i+1])+Math.abs(p[j+2]-p[i+2]))/3;
    }
    for(let i=0;i<ex.length;i++)ex[i]/=H;for(let i=0;i<ey.length;i++)ey[i]/=W;
    function smooth(v){const out=new Float32Array(v.length);for(let i=0;i<v.length;i++){let s=0,n=0;for(let k=-1;k<=1;k++){const q=i+k;if(q>=0&&q<v.length){s+=v[q];n++;}}out[i]=s/n;}return out;}
    const sx=smooth(ex),sy=smooth(ey);
    function axis(v,L){
      const out=[],minCell=Math.max(10,Math.floor(L*.055)),maxCell=Math.max(minCell+1,Math.floor(L*.13));
      for(let cell=minCell;cell<=maxCell;cell++){
        const side=cell*8;if(side>L)continue;
        const step=2;
        for(let st=0;st<=L-side;st+=step){
          let score=0;
          for(let k=0;k<=8;k++){const q=Math.min(v.length-1,Math.max(0,st+k*cell));score+=v[q];}
          out.push({score,st,cell});
        }
      }
      out.sort((a,b)=>b.score-a.score);return out.slice(0,28);
    }
    const xs=axis(sx,W),ys=axis(sy,H);let best=null;
    for(const a of xs)for(const b of ys){
      const mismatch=Math.abs(a.cell-b.cell);if(mismatch>Math.max(2,(a.cell+b.cell)*.035))continue;
      const score=a.score+b.score-mismatch*4;
      const side=((a.cell+b.cell)/2)*8;
      if(!best||score>best.score)best={score,x:a.st,y:b.st,s:side};
    }
    if(!best)return null;
    const inv=1/scale;
    return{x:Math.max(0,Math.round(best.x*inv)),y:Math.max(0,Math.round(best.y*inv)),s:Math.round(best.s*inv),score:best.score};
  }

  window.detectBoard = detectBoard = function(img){
    const raw=baseDetect(img),W=img.naturalWidth||img.width,H=img.naturalHeight||img.height,minDim=Math.min(W,H);
    const ratio=raw.s/minDim;
    // The legacy detector is excellent on normal screenshots. Only intervene when it has
    // clearly locked onto a small 4x4-ish patch inside a larger diagram.
    if(ratio>=.60)return raw;
    try{
      const g=periodicGrid(img);
      if(g && g.s>raw.s*1.45 && g.s>=minDim*.60)return{x:g.x,y:g.y,s:g.s};
    }catch(e){console.warn('MateShot periodic grid repair skipped:',e);}
    return raw;
  };
})();
