/* MateShot polish v13: vertically balance the lower mobile UI in the free space under the board. */
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

    // Use the real free vertical space between the panel start and the copyright.
    const lowerH=Math.max(250,Math.floor(legalTop-panelTop-12));
    panel.style.setProperty('--ms-v13-lower-h',lowerH+'px');

    // If a puzzle has many rows, only the move list scrolls. The app itself stays fixed.
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
