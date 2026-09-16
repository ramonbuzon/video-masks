/* MateShot replay v4: smooth in-browser piece motion + matching highlights. */
(() => {
  const lang=(navigator.language||'en').toLowerCase().startsWith('es')?'es':'en';
  const LABELS=lang==='es'?{play:'Ver solución',pause:'Pausa'}:{play:'Play solution',pause:'Pause'};
  const PIECE_BASE='https://lichess1.org/assets/piece/cburnett/';
  const pieceCode=p=>(p===p.toUpperCase()?'w':'b')+p.toUpperCase();
  const pieceSrc=p=>PIECE_BASE+pieceCode(p)+'.svg';

  const style=document.createElement('style');
  style.textContent=`
    #board{position:relative;}
    .webMoveOverlay{position:absolute;z-index:8;pointer-events:none;will-change:transform;object-fit:contain;filter:drop-shadow(0 1px 1px rgba(0,0,0,.16));}
    .solutionRow.active{background:rgba(214,255,88,.11);border-color:rgba(214,255,88,.28);}
    .solutionRow.active .n{color:#d6ff58;}
  `;
  document.head.appendChild(style);

  let animToken=0;
  let animState=null;

  function ease(p){return p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;}
  function visualIndex(index){return S.orientation==='black'?63-index:index;}
  function cellFor(index){return document.getElementById('board')?.children?.[visualIndex(index)]||null;}

  function activeRowForMove(i){
    if(i<0)return -1;
    return S.start?.side==='b' ? (i===0?0:Math.floor((i+1)/2)) : Math.floor(i/2);
  }
  function markActiveMove(i){
    const rows=[...document.querySelectorAll('#solutionList .solutionRow')];
    const row=activeRowForMove(i);
    rows.forEach((el,n)=>el.classList.toggle('active',n===row));
  }

  function playLabel(){const b=document.getElementById('play');if(b)b.innerHTML='▶ <span>'+LABELS.play+'</span>';}
  function pauseLabel(){const b=document.getElementById('play');if(b)b.innerHTML='❚❚ <span>'+LABELS.pause+'</span>';}

  function settleAnimation(){
    if(!animState)return;
    const a=animState;
    S.step=a.progress>=.5?a.toStep:a.fromStep;
    const last=S.step?S.line[S.step-1]:null;
    renderBoard(S.positions[S.step].b,S.orientation,last);
    markActiveMove(S.step-1);
    animState=null;
  }

  window.stopPlay = stopPlay = function(){
    S.playing=false;
    clearTimeout(S.timer);S.timer=null;
    animToken++;
    settleAnimation();
    playLabel();
  };

  window.gotoStep = gotoStep = function(n){
    animToken++;
    animState=null;
    S.step=Math.max(0,Math.min(S.positions.length-1,n));
    const last=S.step?S.line[S.step-1]:null;
    renderBoard(S.positions[S.step].b,S.orientation,last);
    markActiveMove(S.step-1);
  };

  async function animateForward(fromStep){
    if(fromStep>=S.positions.length-1)return false;
    const token=++animToken;
    const mv=S.line[fromStep],before=S.positions[fromStep],after=S.positions[fromStep+1];

    renderBoard(before.b,S.orientation,mv);
    markActiveMove(fromStep);
    await new Promise(requestAnimationFrame);

    const root=document.getElementById('board'),src=cellFor(mv.from),dst=cellFor(mv.to);
    if(!root||!src||!dst){S.step=fromStep+1;renderBoard(after.b,S.orientation,mv);return true;}
    const srcImg=src.querySelector('.pieceImg'),dstImg=dst.querySelector('.pieceImg');
    const moving=before.b[mv.from];
    if(!moving){S.step=fromStep+1;renderBoard(after.b,S.orientation,mv);return true;}

    const rr=root.getBoundingClientRect(),sr=src.getBoundingClientRect(),dr=dst.getBoundingClientRect();
    if(srcImg)srcImg.style.visibility='hidden';
    const overlay=document.createElement('img');
    overlay.className='webMoveOverlay';overlay.src=pieceSrc(moving);overlay.draggable=false;
    const pad=sr.width*.06;
    overlay.style.left=(sr.left-rr.left+pad)+'px';overlay.style.top=(sr.top-rr.top+pad)+'px';
    overlay.style.width=(sr.width-pad*2)+'px';overlay.style.height=(sr.height-pad*2)+'px';
    root.appendChild(overlay);

    const dx=dr.left-sr.left,dy=dr.top-sr.top,duration=430,start=performance.now();
    animState={fromStep,toStep:fromStep+1,progress:0};

    await new Promise(resolve=>{
      function frame(now){
        if(token!==animToken){overlay.remove();resolve();return;}
        const p=Math.max(0,Math.min(1,(now-start)/duration));
        animState.progress=p;
        const e=ease(p);
        overlay.style.transform=`translate3d(${dx*e}px,${dy*e}px,0)`;
        if(dstImg)dstImg.style.visibility=p<.82?'visible':'hidden';
        if(p<1)requestAnimationFrame(frame);else{overlay.remove();resolve();}
      }
      requestAnimationFrame(frame);
    });

    if(token!==animToken)return false;
    animState=null;
    S.step=fromStep+1;
    renderBoard(after.b,S.orientation,mv);
    markActiveMove(fromStep);
    return true;
  }

  window.playLoop = playLoop = async function(){
    if(!S.playing)return;
    if(S.step>=S.positions.length-1){stopPlay();return;}
    const ok=await animateForward(S.step);
    if(!ok||!S.playing)return;
    S.timer=setTimeout(playLoop,120);
  };

  window.togglePlay = togglePlay = function(){
    if(S.playing){stopPlay();return;}
    if(S.step>=S.positions.length-1)gotoStep(0);
    S.playing=true;pauseLabel();
    S.timer=setTimeout(playLoop,100);
  };

  const play=document.getElementById('play');if(play)play.onclick=togglePlay;
  const prev=document.getElementById('prev'),next=document.getElementById('next');
  if(prev)prev.onclick=()=>{stopPlay();gotoStep(S.step-1);};
  if(next)next.onclick=async()=>{stopPlay();if(S.step<S.positions.length-1)await animateForward(S.step);};

  markActiveMove((S?.step||0)-1);
})();

/* MateShot v9 bridge: expose state to the polish layer, show the puzzle statement over the moves, and download when native sharing is blocked. */
(() => {
  try{ if(typeof S!=='undefined') window.S=S; }catch(_){ }

  const isEs=(navigator.language||'en').toLowerCase().startsWith('es');
  const sideText=()=>{
    try{
      const st=(typeof S!=='undefined'&&S)?S:window.S;
      if(!st?.start)return '';
      const side=st.start.side==='b'?(isEs?'Mueven negras':'Black to move'):(isEs?'Mueven blancas':'White to move');
      return `${side} · ${isEs?'Mate en':'Mate in'} ${st.mateN}`;
    }catch(_){ return ''; }
  };

  function applyStatement(){
    try{ if(typeof S!=='undefined') window.S=S; }catch(_){ }
    const context=document.querySelector('.contextBar');
    if(context) context.style.setProperty('display','none','important');
    const k=document.querySelector('.solutionKicker');
    const txt=sideText();
    if(k&&txt){
      k.textContent=txt;
      k.style.setProperty('display','flex','important');
      k.style.setProperty('align-items','center','important');
      k.style.setProperty('gap','10px','important');
    }
  }

  const style=document.createElement('style');
  style.textContent=`
    .solutionKicker::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 5px rgba(214,255,88,.05);flex:0 0 auto;}
    @media(max-width:760px){.solutionKicker{font-size:22px!important;line-height:1.12!important;white-space:nowrap!important;}}
    @media(min-width:761px){.solutionKicker{font-size:27px!important;line-height:1.12!important;white-space:nowrap!important;}}
  `;
  document.head.appendChild(style);

  let lastDownloadedBlob=null;
  function downloadPreparedVideo(){
    try{
      const st=(typeof S!=='undefined'&&S)?S:window.S;
      const blob=st?.v8VideoBlob;
      if(!blob||blob===lastDownloadedBlob)return false;
      lastDownloadedBlob=blob;
      const mime=st.v8VideoMime||blob.type||'video/mp4';
      const ext=mime.includes('mp4')?'mp4':'webm';
      const url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=`mateshot-mate-${st.mateN||'puzzle'}.${ext}`;
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),5000);
      return true;
    }catch(_){ return false; }
  }

  setTimeout(()=>{
    applyStatement();
    const result=document.getElementById('result');
    if(result)new MutationObserver(()=>{if(result.classList.contains('active'))setTimeout(applyStatement,0);}).observe(result,{attributes:true,attributeFilter:['class']});
    const list=document.getElementById('solutionList');
    if(list)new MutationObserver(()=>setTimeout(applyStatement,0)).observe(list,{childList:true});

    const toast=document.getElementById('toast');
    if(toast)new MutationObserver(()=>{
      const t=(toast.textContent||'').toLowerCase();
      const blocked=t.includes('no permite compartir')||t.includes('cannot share the video directly')||t.includes('sharing is unavailable');
      if(blocked)setTimeout(()=>downloadPreparedVideo(),80);
    }).observe(toast,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['class']});
  },0);
})();