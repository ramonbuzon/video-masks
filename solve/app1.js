const DEMO="";
const MODEL_URL="https://huggingface.co/FlappingChance/kings-vision-models/resolve/main/square_classifier.onnx";
const CLASS_TO_FEN=["","P","R","N","B","Q","K","p","r","n","b","q","k"];

const $=id=>document.getElementById(id);
const screenIds=["home","processing","result","error"];

const S={
  dataUrl:null,img:null,rect:null,ocr:"",statement:"",
  side:"b",mateHint:null,checksOnly:false,
  rawPlacement:"",fen:"",orientation:"black",solution:[],positions:[],mateN:null,
  chess:null,Chess:null,board:null,Chessboard:null,COLOR:null,
  step:0,playing:false,timer:null,
  visualConfidence:0,allPredictions:null
};

function show(id){screenIds.forEach(x=>$(x).classList.toggle("active",x===id))}
function progress(v,title,text){
  $("bar").style.width=Math.max(4,Math.min(100,v))+"%";
  if(title)$("procTitle").textContent=title;
  if(text)$("procText").textContent=text;
}
function wait(ms){return new Promise(r=>setTimeout(r,ms))}
function stopPlay(){
  S.playing=false;clearTimeout(S.timer);S.timer=null;
  if($("play"))$("play").textContent="▶ Play";
}

function fileData(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)
  })
}
function loadImg(url){
  return new Promise((res,rej)=>{
    const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=url
  })
}
function median(a){
  const b=[...a].sort((x,y)=>x-y),n=b.length;
  return n?(n%2?b[(n-1)/2]:(b[n/2-1]+b[n/2])/2):0
}

function detectBoardRect(img){
  const W=Math.min(480,img.naturalWidth||img.width);
  const scale=W/(img.naturalWidth||img.width);
  const H=Math.round((img.naturalHeight||img.height)*scale);
  const c=document.createElement("canvas");c.width=W;c.height=H;
  const ctx=c.getContext("2d",{willReadFrequently:true});
  ctx.drawImage(img,0,0,W,H);
  const d=ctx.getImageData(0,0,W,H).data;
  const lum=new Float32Array(W*H);
  for(let i=0,j=0;i<d.length;i+=4,j++)lum[j]=.299*d[i]+.587*d[i+1]+.114*d[i+2];

  const at=(x,y)=>{
    x=Math.max(0,Math.min(W-1,x|0));y=Math.max(0,Math.min(H-1,y|0));
    return lum[y*W+x]
  };

  function checkerScore(x,y,s){
    const ev=[],od=[],vals=Array.from({length:8},()=>Array(8).fill(0));
    const cell=s/8,pts=[[.28,.28],[.72,.28],[.28,.72],[.72,.72]];
    for(let r=0;r<8;r++)for(let q=0;q<8;q++){
      let z=0;
      for(const [px,py] of pts)z+=at(x+(q+px)*cell,y+(r+py)*cell);
      const v=z/4;vals[r][q]=v;((r+q)%2?od:ev).push(v)
    }
    const me=median(ev),mo=median(od),diff=Math.abs(me-mo);
    let f0=0,f1=0,n=0;
    for(let r=0;r<8;r++)for(let q=0;q<8;q++){
      const v=vals[r][q],even=(r+q)%2===0;
      f0+=Math.abs(v-(even?me:mo));f1+=Math.abs(v-(even?mo:me));n++
    }
    return diff*2.2-Math.min(f0,f1)/n*3
  }

  let coarse={score:-1e9,x:0,y:0,s:0};
  for(let frac=.76;frac<=.99;frac+=.02){
    const s=Math.round(W*frac),cx=Math.round((W-s)/2),xs=Math.max(4,Math.round(W*.012));
    for(let xo=-3;xo<=3;xo++){
      const x=Math.max(0,Math.min(W-s,cx+xo*xs));
      const ys=Math.max(5,Math.round(s/90));
      for(let y=0;y<=H-s;y+=ys){
        const sc=checkerScore(x,y,s);
        if(sc>coarse.score)coarse={score:sc,x,y,s}
      }
    }
  }
  if(coarse.score<5)throw new Error("No encuentro un tablero claro en la captura.");

  function edgeScore(x,y,s){
    const cell=s/8,off=Math.max(2,s*.004);
    let total=0,n=0;
    for(let k=1;k<8;k++){
      const xx=x+k*cell;
      for(let j=0;j<22;j++){
        const t=.08+j*(.84/21),yy=y+t*s;
        total+=Math.abs(at(xx-off,yy)-at(xx+off,yy));n++
      }
    }
    for(let k=1;k<8;k++){
      const yy=y+k*cell;
      for(let j=0;j<22;j++){
        const t=.08+j*(.84/21),xx=x+t*s;
        total+=Math.abs(at(xx,yy-off)-at(xx,yy+off));n++
      }
    }
    return total/n
  }

  let best={score:-1e9,...coarse};
  const sMin=Math.max(Math.round(W*.72),coarse.s-28);
  const sMax=Math.min(W,coarse.s+28);
  for(let s=sMin;s<=sMax;s+=2){
    const x0=Math.max(0,coarse.x-28),x1=Math.min(W-s,coarse.x+28);
    const y0=Math.max(0,coarse.y-24),y1=Math.min(H-s,coarse.y+24);
    for(let x=x0;x<=x1;x+=2){
      for(let y=y0;y<=y1;y+=2){
        const sc=edgeScore(x,y,s);
        if(sc>best.score)best={score:sc,x,y,s}
      }
    }
  }

  const inv=1/scale;
  return {
    x:Math.round(best.x*inv),y:Math.round(best.y*inv),s:Math.round(best.s*inv),
    coarse:coarse.score,edge:best.score
  }
}

function crop(img,r){
  const c=document.createElement("canvas");c.width=r.s;c.height=r.s;
  c.getContext("2d").drawImage(img,r.x,r.y,r.s,r.s,0,0,r.s,r.s);
  return c
}

let ortSessionPromise=null;
async function getOrtSession(){
  if(ortSessionPromise)return ortSessionPromise;
  ort.env.wasm.numThreads=1;
  ort.env.wasm.simd=true;
  ort.env.wasm.wasmPaths="https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";
  ortSessionPromise=ort.InferenceSession.create(MODEL_URL,{executionProviders:["wasm"]});
  return ortSessionPromise
}

function softmax13(arr,offset){
  let max=-Infinity;
  for(let k=0;k<13;k++)if(arr[offset+k]>max)max=arr[offset+k];
  let sum=0;const p=new Float32Array(13);
  for(let k=0;k<13;k++){p[k]=Math.exp(arr[offset+k]-max);sum+=p[k]}
  for(let k=0;k<13;k++)p[k]/=sum;
  return p
}

async function classifyBoard(boardCanvas){
  const session=await getOrtSession();
  const tile=document.createElement("canvas");tile.width=32;tile.height=32;
  const tctx=tile.getContext("2d",{willReadFrequently:true});
  const input=new Float32Array(64*3*32*32);
  const cell=boardCanvas.width/8;

  for(let r=0;r<8;r++)for(let col=0;col<8;col++){
    const idx=r*8+col;
    tctx.clearRect(0,0,32,32);
    tctx.drawImage(boardCanvas,col*cell,r*cell,cell,cell,0,0,32,32);
    const px=tctx.getImageData(0,0,32,32).data;
    const plane=32*32,base=idx*3*plane;
    for(let j=0;j<plane;j++){
      input[base+j]=px[j*4];
      input[base+plane+j]=px[j*4+1];
      input[base+2*plane+j]=px[j*4+2];
    }
  }

  const inName=session.inputNames[0],outName=session.outputNames[0];
  const tensor=new ort.Tensor("float32",input,[64,3,32,32]);
  const outputs=await session.run({[inName]:tensor});
  const logits=outputs[outName].data;

  const preds=[];
  let confSum=0;
  for(let i=0;i<64;i++){
    const p=softmax13(logits,i*13);
    const ranked=Array.from({length:13},(_,k)=>({cls:k,p:p[k]})).sort((a,b)=>b.p-a.p);
    confSum+=ranked[0].p;
    preds.push({
      best:ranked[0].cls,
      p:ranked[0].p,
      margin:ranked[0].p-ranked[1].p,
      top:ranked.slice(0,3)
    })
  }
  return {preds,confidence:confSum/64}
}
