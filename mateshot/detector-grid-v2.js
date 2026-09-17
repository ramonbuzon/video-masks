/* MateShot board detector v2.
   Keeps the fast detector, but repairs under-cropped diagrams by comparing it with
   an 8x8 periodic-grid candidate. This is especially useful for printed/wooden boards
   with frames, coordinates or decorative headers. */
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
        for(let st=0;st<=L-side;st+=2){
          let score=0;for(let k=0;k<=8;k++){const q=Math.min(v.length-1,Math.max(0,st+k*cell));score+=v[q];}
          out.push({score,st,cell});
        }
      }
      out.sort((a,b)=>b.score-a.score);return out.slice(0,36);
    }
    const xs=axis(sx,W),ys=axis(sy,H);let best=null;
    for(const a of xs)for(const b of ys){
      const mismatch=Math.abs(a.cell-b.cell);if(mismatch>Math.max(2,(a.cell+b.cell)*.04))continue;
      const side=((a.cell+b.cell)/2)*8;
      // Prefer candidates that are genuinely board-sized, not a 4x4-ish patch.
      if(side<Math.min(W,H)*.47)continue;
      const score=a.score+b.score-mismatch*4;
      if(!best||score>best.score)best={score,x:a.st,y:b.st,s:side};
    }
    if(!best)return null;
    const inv=1/scale;
    return{x:Math.max(0,Math.round(best.x*inv)),y:Math.max(0,Math.round(best.y*inv)),s:Math.round(best.s*inv),score:best.score};
  }

  window.detectBoard = detectBoard = function(img){
    const raw=baseDetect(img),W=img.naturalWidth||img.width,H=img.naturalHeight||img.height,minDim=Math.min(W,H);
    try{
      const g=periodicGrid(img);
      if(!g)return raw;
      const rawRatio=raw.s/minDim,gRatio=g.s/minDim;
      // Repair obvious small locks and also the subtler 8-15% under-crops seen on
      // diagrams whose outer board edge is weaker than interior grid lines.
      const substantiallyLarger=g.s>raw.s*1.065;
      const plausible=gRatio>=.58&&gRatio<=1.02;
      if(plausible && ((rawRatio<.60&&g.s>raw.s*1.35) || substantiallyLarger)){
        return{x:g.x,y:g.y,s:g.s};
      }
    }catch(e){console.warn('MateShot periodic grid v2 repair skipped:',e);}
    return raw;
  };
})();
