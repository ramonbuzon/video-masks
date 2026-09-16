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
