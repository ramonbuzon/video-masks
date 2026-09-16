/* MateShot replay v3: smooth in-browser piece motion + matching highlights. */
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
