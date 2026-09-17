/* MateShot recognition v3: fallback for printed/classic boards with embedded coordinates. */
(() => {
  const baseScan = window.scanBoard || scanBoard;

  const BANK64 = {
    r:[
      'AAAAAAAAAAAD5+PgB+fj4Af//+AH///gB///4AP//+AD///AAc/7gAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAf//gAP//8AD///AA///wB////Af///4H///+B////gP///wAAAAAAAAAAA=',
      'AAAAAAAAAAAHx8fAB8fHwAf//8AH///AB///wAP//oAD//+AA//9AAH//gAB//4AAf/+AAH//gAB//4AAf/+AAH//gAB//4AAf/+AAH//gABf/wAAUA9AAP//4AD//+AA///gB9//uAf///wH///8B////AP///gAAAAAAAAAAA=',
      'AAAAAAAAAAAHx8PABsxmwAX//8AF///gB///wAf//8AH///AAf//gAH//wAB//8AAf//AAH//wAB//8AAf//AAH//wAB//8AAf//AAH//wAB//8AAX/9gAPj34AD///AB///wA7//+Af///wH///8BrwADAP///wAAAAAAAAAAA=',
      'AAAAAAAAAAADx8PAB8fnwAf/5kAH/73AB///wAf//8AH/gXAAYADgAG//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAP//AAD//wAA//8AAf/9gAP//4AD///AA///wAd//uAP///wC///0A////AP///wAAAAAAAAAAA='
    ],
    k:[
      'AAAAAAAAAAAABwAAAA+AAAAPgAAABwAAAAcAAAAHgAAAD4AAAB/AAD/f/8Aw//hgLz/vsD////g/93/oP///6D/9/+g//f/YH/3/8D/9/+ATBk5AGf/xgA///wAOf/YADf/4AA///gAOf/YAAf/8AAP//AAA//AAAAAAAAAAAAA=',
      'AAAAAAAAAAAAH4AAAA+AAAAGAAAABwAAAA+AAAAegAAOH88AP9/fwDD/+uAf///wP/v/+D////g////oP/v/+D////g////wP98/4Df//+Aff+/AD9+/AA3//wAPf+8AD/+fAA3/+wAPf+8AD//+AAP9/AAA//AAAAAAAAAAAAA='
    ],
    n:[
      'AAAAAAAAAAAA4wAAAPeAAAD/4AAA//gAAP/6AAH//AADv//AA///QAf//+AH///gD///8A////Af//+4H///6D///9g//v/8P/n//D/x//Q/4//0H8f//AeP//wAD//8AB///AAf//wAP//8AD///AB///wAf//kAAAAAAAAAAA=',
      'AAAAAAAAAAAAxwAAAe8AAAH/gAAA+fAAAcb8AAH/nAAD//cAA//7gAb//YAP//7AHf7/YB/+v+Ab/b/wN/u/8D/3v/A////wPfn/0CHzf9g253/4P47/+A+N//gAG//4ADf/+AA///gAf//4AG//+AB///gAf//4AAAAAAAAAAA='
    ],
    q:[
      'AAAAAAAAAAAA8+/AEfPvwDzz79w88cecPHHHHDxxxxw8cc8cHnvvPA97/3wPf/94D3//+A////gP///4D///+Af///AH/n/wB8Ph8AP//+AB///AAQAEwAH//8ABf/9AA4/54AP//8ADP/4AAcfhwAD+f4AAD/gAAAAAAAAAAAA='
    ],
    p:[
      'AAAAAAAAAAAAAcAAAA/gAAAP8AAAD/AAAA/wAAAP8AAAD/gAAB/8AAA//AAAP/wAAD/8AAA//AAAP/wAAD/8AAAf/AAAP/wAAH/+AAD//wAA//+AAf//gAH//8AD///AA///wAf//8AH///gB///4Af//+AD///AAAAAAAAAAAA=',
      'AAAAAAAAAAAAB8AAAA/gAAAf4AAAH/AAAB/wAAAf8AAAH/AAAD/4AAB//AAAf/wAAH/8AAB//AAAf/wAAH/8AAA/+AAAP/gAAP/8AAD//gAB//8AA///gAP//4AH//+AB///wAf//8AH///AB///wAf//8AH///AAAAAAAAAAAA=',
      'AAAAAAAAAAAAB+AAAA5gAAAP8AAAD/AAAB/wAAAP0AAAG9gAADfsAAA//AAAL/wAAC/8AAAv/AAAP/wAAD/8AAAf/AAAO/wAAG/2AAD//wAA//+AAf//gAP//8AD//9AAv//wAf//8AH///gB///4Af//8ABQApAAAAAAAAAAAA=',
      'AAAAAAAAAAAAB4AAAAzgAAAf4AAAH+AAAB/wAAAf4AAAP7AAAD/YAABf+AAAf+gAAH/8AAB/7AAAX+gAAH/4AAA/2AAAf9wAAN/sAAH/9gABf/8AA///AAP//4AH//+AB//+wAX//8AF///AB///wAf//8AH///AAAAAAAAAAAA='
    ],
    b:[
      'AAAAAAAAAAAAB4AAAAeAAAAPwAAAD8AAAAeAAAAf4AAAP/AAAD/wAAD/+AAA//gAAf/+AAH//gAB//4AAf/+AAH//gAA//gAAD/wAAD/+AAA//gAAP/4AAD/+AAA//gAAP/4AAP//wA////gP///8D////gQAAAgAAAAAAAAAAA='
    ]
  };

  function unpack(s){
    const raw=atob(s),out=new Uint8Array(1024);
    for(let i=0;i<1024;i++)out[i]=(raw.charCodeAt(i>>3)>>(7-(i&7)))&1;
    return out;
  }
  const BANK={};
  for(const [t,list] of Object.entries(BANK64))BANK[t]=list.map(unpack);

  function medianFast(a){
    const b=a.slice().sort((x,y)=>x-y),n=b.length;
    return n?(n&1?b[n>>1]:(b[(n>>1)-1]+b[n>>1])/2):0;
  }

  function printedScan(img,rect){
    const size=800,cv=document.createElement('canvas');cv.width=size;cv.height=size;
    const ctx=cv.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(img,rect.x,rect.y,rect.s,rect.s,0,0,size,size);
    const px=ctx.getImageData(0,0,size,size).data,cell=size/8,cells=[];

    for(let r=0;r<8;r++)for(let c=0;c<8;c++){
      const x0=Math.round(c*cell),y0=Math.round(r*cell),x1=Math.round((c+1)*cell),y1=Math.round((r+1)*cell);
      const w=x1-x0,h=y1-y0,rs=[],gs=[],bs=[];

      for(let yy=2;yy<h;yy+=4)for(let xx=2;xx<w;xx+=4){
        const i=((y0+yy)*size+x0+xx)*4;rs.push(px[i]);gs.push(px[i+1]);bs.push(px[i+2]);
      }
      const bg=[medianFast(rs),medianFast(gs),medianFast(bs)];
      const mask=new Uint8Array(w*h),guard=Math.max(7,Math.round(Math.min(w,h)*.09));
      for(let yy=guard;yy<h-guard;yy++)for(let xx=guard;xx<w-guard;xx++){
        const i=((y0+yy)*size+x0+xx)*4,dr=px[i]-bg[0],dg=px[i+1]-bg[1],db=px[i+2]-bg[2];
        const dist=Math.sqrt(dr*dr+dg*dg+db*db)/441.67;
        if(dist>.115)mask[yy*w+xx]=1;
      }

      const comp=largestComponent(mask,w,h);
      if(comp.pts.length<w*h*.018){cells.push({empty:true,r,c});continue;}
      const nm=normalizeMask(comp.mask,w,h);
      const ranked=Object.keys(BANK).map(t=>({
        t,score:Math.max(...BANK[t].map(m=>iou(nm,m)))
      })).sort((a,b)=>b.score-a.score);
      if(ranked[0].score<.34){cells.push({empty:true,r,c});continue;}

      let bright=0;
      for(const z of comp.pts){
        const yy=(z/w)|0,xx=z-yy*w,i=((y0+yy)*size+x0+xx)*4;
        const L=.299*px[i]+.587*px[i+1]+.114*px[i+2];
        if(L>230)bright++;
      }
      const color=bright/Math.max(1,comp.pts.length)>.07?'w':'b';
      cells.push({empty:false,r,c,color,alts:ranked.slice(0,3)});
    }
    return cells;
  }

  function quality(cells){
    const pieces=cells.filter(c=>!c.empty).length;
    if(pieces<4)return -100+pieces;
    try{
      const b=cellsBoard(cells);
      let q=pieces;
      if(validShape(b)||validShape(rotateBoard(b)))q+=50;
      return q;
    }catch(_){return pieces;}
  }

  window.scanBoard = scanBoard = function(img,rect){
    let a;
    try{a=baseScan(img,rect);}catch(_){a=[];}
    let b;
    try{b=printedScan(img,rect);}catch(_){b=[];}
    return quality(b)>quality(a)?b:a;
  };

  // iOS/Safari can occasionally return from the photo picker without the old bubble listener firing reliably
  // inside the html-preview wrapper. Capture the change at the input itself and hand it directly to MateShot.
  const picker=document.getElementById('picker');
  if(picker){
    picker.addEventListener('change',async e=>{
      const f=e.target.files&&e.target.files[0];
      if(!f)return;
      e.stopImmediatePropagation();
      try{
        const u=await fileData(f);
        e.target.value='';
        await analyze(u);
      }catch(err){
        console.error(err);
        try{
          document.getElementById('errorText').textContent='No he podido abrir esta imagen. Prueba otra captura.';
          show('error');
        }catch(_){ }
      }
    },true);
  }
})();
