/* MateShot polish v12: slightly larger mobile prompt, tighter move type, clearer active borders. */
(() => {
  const css=document.createElement('style');
  css.textContent=`
    .solutionRow.active{
      border-color:rgba(214,255,88,.46)!important;
      box-shadow:inset 0 0 0 1px rgba(214,255,88,.10)!important;
    }
    @media(max-width:760px){
      .solutionKicker{
        font-size:19px!important;
        line-height:1.14!important;
        color:#929aa3!important;
        font-weight:770!important;
      }
      .solutionRow{
        padding:9px 10px!important;
        font-size:13.5px!important;
        background:rgba(255,255,255,.060)!important;
        border-color:rgba(255,255,255,.105)!important;
      }
      .solutionRow strong{
        font-size:15.5px!important;
        line-height:1.15!important;
      }
      .solutionRow .n{
        font-size:13px!important;
        width:29px!important;
      }
      .solutionRow.active{
        background:rgba(214,255,88,.105)!important;
        border-color:rgba(214,255,88,.54)!important;
        box-shadow:inset 0 0 0 1px rgba(214,255,88,.13)!important;
      }
    }
    @media(max-width:390px){
      .solutionKicker{font-size:18px!important;}
      .solutionRow{padding:8px 9px!important;}
      .solutionRow strong{font-size:14.5px!important;}
      .solutionRow .n{font-size:12.5px!important;width:27px!important;}
    }
  `;
  document.head.appendChild(css);
})();

/* v13 mobile lower-area balance: use the free space between board and copyright. */
(() => {
  const css=document.createElement('style');
  css.textContent=`
    @media(max-width:760px){
      .solutionPanel{
        height:var(--ms-v13-lower-h,auto)!important;
        min-height:0!important;
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
        grid-template-areas:"title title" "moves buttons" "note note"!important;
        column-gap:18px!important;
        row-gap:16px!important;
        align-items:stretch!important;
        align-content:center!important;
      }
      .solutionKicker{
        grid-area:title!important;
        font-size:21px!important;
        line-height:1.14!important;
        text-align:center!important;
        color:#969da6!important;
        font-weight:775!important;
        margin:0!important;
      }
      .solutionList{
        grid-area:moves!important;
        align-self:center!important;
        max-height:var(--ms-v13-list-max,272px)!important;
      }
      .buttonStack{
        grid-area:buttons!important;
        align-self:stretch!important;
        justify-content:center!important;
        gap:8px!important;
      }
      .exportNote{grid-area:note!important;}
    }
    @media(max-width:390px){
      .solutionPanel{column-gap:16px!important;row-gap:14px!important;}
      .solutionKicker{font-size:19.5px!important;}
    }
  `;
  document.head.appendChild(css);

  function layoutLower(){
    const panel=document.querySelector('.solutionPanel');
    if(!panel)return;
    if(window.innerWidth>760){
      panel.style.removeProperty('--ms-v13-lower-h');
      panel.style.removeProperty('--ms-v13-list-max');
      return;
    }
    const legal=document.querySelector('.legal');
    const vv=window.visualViewport;
    const viewportBottom=vv ? vv.offsetTop+vv.height : window.innerHeight;
    const panelTop=panel.getBoundingClientRect().top;
    const legalTop=legal?.getBoundingClientRect().top || (viewportBottom-28);
    const lowerH=Math.max(250,Math.floor(legalTop-panelTop-12));
    panel.style.setProperty('--ms-v13-lower-h',lowerH+'px');
    const title=document.querySelector('.solutionKicker');
    const titleH=title?.getBoundingClientRect().height || 24;
    const bodyMax=Math.max(150,Math.min(300,lowerH-titleH-44));
    panel.style.setProperty('--ms-v13-list-max',bodyMax+'px');
  }
  function apply(){requestAnimationFrame(()=>requestAnimationFrame(layoutLower));}
  const result=document.getElementById('result');
  if(result)new MutationObserver(()=>{if(result.classList.contains('active'))setTimeout(apply,0);}).observe(result,{attributes:true,attributeFilter:['class']});
  const list=document.getElementById('solutionList');
  if(list)new MutationObserver(()=>setTimeout(apply,0)).observe(list,{childList:true});
  window.addEventListener('resize',apply,{passive:true});
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',apply,{passive:true});
    window.visualViewport.addEventListener('scroll',apply,{passive:true});
  }
  setTimeout(apply,0);
})();

/* Load the broader screenshot recognizer + longer mate solver. */
(() => {
  if(document.querySelector('script[data-mateshot-solver-v3]'))return;
  const s=document.createElement('script');
  s.src='solver-v3.js?v=2';
  s.dataset.mateshotSolverV3='1';
  document.head.appendChild(s);
})();
