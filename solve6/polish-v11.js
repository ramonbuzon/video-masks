/* MateShot polish v11 overlay: balanced mobile columns + safer video captions. */
(() => {
  const css=document.createElement('style');
  css.textContent=`
    .solutionKicker{color:#929aa3!important;font-weight:760!important;letter-spacing:-.022em!important;white-space:nowrap!important;}
    .solutionKicker::before{display:none!important;content:none!important;}
    .buttonStack{display:flex;flex-direction:column;justify-content:center;gap:8px;width:100%;height:100%;}
    @media(max-width:760px){
      .boardWrap{width:min(96vw,50dvh,590px)!important;}
      .solutionPanel{width:min(96vw,50dvh,590px)!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-template-areas:"title title" "moves buttons" "note note"!important;column-gap:12px!important;row-gap:11px!important;align-items:start!important;padding:0!important;}
      .solutionKicker{grid-area:title!important;font-size:17px!important;line-height:1.15!important;text-align:center!important;margin:0!important;}
      .solutionList{grid-area:moves!important;max-height:var(--ms-list-max,260px)!important;align-self:center!important;gap:8px!important;}
      .solutionRow{background:rgba(255,255,255,.055)!important;border-color:rgba(255,255,255,.085)!important;}
      .buttonStack{grid-area:buttons!important;align-self:stretch!important;justify-content:center!important;gap:8px!important;}
      .controls,.actions{width:100%!important;}
      .exportNote{grid-area:note!important;}
    }
    @media(max-width:390px){
      .boardWrap,.solutionPanel{width:min(95vw,47dvh,570px)!important;}
      .solutionKicker{font-size:16px!important;}
      .solutionList{max-height:var(--ms-list-max,224px)!important;}
    }
    @media(min-width:761px){
      .solutionKicker{font-size:18px!important;line-height:1.15!important;margin-bottom:0!important;}
      .buttonStack{width:100%!important;height:auto!important;gap:10px!important;}
    }
  `;
  document.head.appendChild(css);

  function ensureStack(){
    const panel=document.querySelector('.solutionPanel'),controls=document.querySelector('.controls'),actions=document.querySelector('.actions');
    if(!panel||!controls||!actions)return;
    let stack=panel.querySelector('.buttonStack');
    if(!stack){stack=document.createElement('div');stack.className='buttonStack';panel.insertBefore(stack,document.getElementById('exportNote'));}
    if(controls.parentNode!==stack)stack.appendChild(controls);
    if(actions.parentNode!==stack)stack.appendChild(actions);
  }
  function sizeColumns(){
    const panel=document.querySelector('.solutionPanel');if(!panel)return;
    if(window.innerWidth>760){panel.style.removeProperty('--ms-list-max');return;}
    const vv=window.visualViewport, bottom=vv?vv.height+vv.offsetTop:window.innerHeight;
    const top=panel.getBoundingClientRect().top,title=document.querySelector('.solutionKicker');
    const available=Math.floor(bottom-top-(title?.getBoundingClientRect().height||20)-42);
    panel.style.setProperty('--ms-list-max',Math.max(150,Math.min(278,available))+'px');
  }
  function apply(){ensureStack();requestAnimationFrame(sizeColumns);}
  const result=document.getElementById('result');
  if(result)new MutationObserver(()=>{if(result.classList.contains('active'))setTimeout(apply,0);}).observe(result,{attributes:true,attributeFilter:['class']});
  const list=document.getElementById('solutionList');
  if(list)new MutationObserver(()=>setTimeout(apply,0)).observe(list,{childList:true});
  window.addEventListener('resize',()=>requestAnimationFrame(sizeColumns),{passive:true});
  if(window.visualViewport)window.visualViewport.addEventListener('resize',()=>requestAnimationFrame(sizeColumns),{passive:true});
  setTimeout(apply,0);

  // v10 draws the social-video prompt/move on y=676. Fit those two captions so long text never collides.
  const proto=window.CanvasRenderingContext2D&&CanvasRenderingContext2D.prototype;
  if(proto&&!proto.__mateShotV11){
    proto.__mateShotV11=true;
    const nativeFillText=proto.fillText;
    proto.fillText=function(text,x,y,maxWidth){
      if(this.canvas?.width===720&&this.canvas?.height===720&&y>=672&&y<=680){
        const oldFont=this.font;
        const right=this.textAlign==='right'||x>360;
        const base=right?23:24,min=right?17:19,limit=right?155:345;
        let size=base;
        while(size>min){this.font=oldFont.replace(/\d+(?:\.\d+)?px/,size+'px');if(this.measureText(String(text)).width<=limit)break;size--;}
        const r=nativeFillText.call(this,text,x,y,Math.min(maxWidth||Infinity,limit));
        this.font=oldFont;
        return r;
      }
      return nativeFillText.call(this,text,x,y,maxWidth);
    };
  }
})();
