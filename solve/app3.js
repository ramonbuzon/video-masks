async function ensureLibs(){
  if(S.Chess&&S.Chessboard)return;
  const [{Chess},{Chessboard,COLOR}]=await Promise.all([
    import("https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm"),
    import("https://cdn.jsdelivr.net/npm/cm-chessboard@8/src/Chessboard.js")
  ]);
  S.Chess=Chess;S.Chessboard=Chessboard;S.COLOR=COLOR
}

async function renderResult(){
  $("problemText").textContent=S.statement||((S.side==="b"?"Negras":"Blancas")+" juegan");
  $("mate").textContent="Mate en "+S.mateN;
  $("line").textContent=lineText(S.solution,S.side);
  $("ocrDebug").textContent=S.ocr.trim()||"No se leyó texto con claridad.";
  $("fenDebug").textContent=S.fen;
  $("confidenceDebug").textContent=Math.round(S.visualConfidence*100)+"% de confianza media en las 64 casillas";

  if(S.board){try{S.board.destroy()}catch(e){}}
  $("board").innerHTML="";
  S.board=new S.Chessboard($("board"),{
    position:S.positions[0],
    orientation:S.orientation==="black"?S.COLOR.black:S.COLOR.white,
    responsive:true,
    assetsUrl:"https://cdn.jsdelivr.net/npm/cm-chessboard@8/assets/",
    style:{
      cssClass:"default",
      showCoordinates:true,
      animationDuration:270,
      pieces:{file:"https://cdn.jsdelivr.net/npm/cm-chessboard@8/assets/pieces/standard.svg",tileSize:40}
    }
  });
  S.step=0
}

async function analyze(url){
  stopPlay();S.dataUrl=url;show("processing");$("procImg").src=url;
  progress(5,"Leyendo el puzzle","Preparando la captura...");
  try{
    await ensureLibs();
    const img=await loadImg(url);S.img=img;

    progress(10,"Encontrando el tablero","Alineando las 64 casillas...");
    const rect=detectBoardRect(img);S.rect=rect;
    const boardCanvas=crop(img,rect);

    const ocrPromise=ocr(img,rect).catch(()=> "");

    progress(24,"Reconstruyendo las piezas","Cargando el reconocimiento visual...");
    const vision=await classifyBoard(boardCanvas);
    S.visualConfidence=vision.confidence;S.allPredictions=vision.preds;
    S.rawPlacement=labelsToPlacement(vision.preds.map(x=>x.best));

    progress(48,"Interpretando el problema","Terminando de leer el enunciado...");
    S.ocr=await ocrPromise;S.statement=statement(S.ocr);
    const hint=infer(S.ocr);

    progress(58,"Buscando la solución","Comprobando la posición y corrigiendo posibles lecturas...");
    const solved=await findSolution(vision.preds,hint);
    if(!solved){
      S.fen=fen(S.rawPlacement,hint.side||"b");
      throw new Error("He leído el tablero, pero alguna pieza parece haberse interpretado mal y no aparece el mate del enunciado.")
    }

    S.side=solved.side;S.mateN=solved.mate;S.solution=solved.line;S.orientation=solved.orientation;
    S.fen=fen(solved.p,solved.side);S.positions=buildPositions(S.fen,S.solution);

    progress(92,"Solución encontrada","Preparando la animación...");
    await renderResult();progress(100,"Listo","");
    await wait(160);show("result")
  }catch(e){
    console.error(e);
    $("ocrDebug").textContent=S.ocr.trim()||"No se leyó texto con claridad.";
    $("fenDebug").textContent=S.fen||S.rawPlacement||"Sin posición.";
    $("confidenceDebug").textContent=S.visualConfidence?Math.round(S.visualConfidence*100)+"% de confianza media":"Sin dato";
    $("errorText").textContent=e.message||"No he podido resolver esta captura.";
    show("error")
  }
}

async function gotoStep(i,anim=true){
  S.step=Math.max(0,Math.min(S.positions.length-1,i));
  if(S.board)await S.board.setPosition(S.positions[S.step],anim)
}
async function loop(){
  if(!S.playing)return;
  if(S.step>=S.positions.length-1){stopPlay();return}
  await gotoStep(S.step+1,true);
  S.timer=setTimeout(loop,Number($("speed").value))
}
function togglePlay(){
  if(S.playing){stopPlay();return}
  if(S.step>=S.positions.length-1)gotoStep(0,false);
  S.playing=true;$("play").textContent="❚❚ Pausa";S.timer=setTimeout(loop,100)
}

function openSheet(){$("sheet").classList.add("open");$("backdrop").classList.add("open")}
function closeSheet(){$("sheet").classList.remove("open");$("backdrop").classList.remove("open")}

$("picker").addEventListener("change",async e=>{
  const f=e.target.files&&e.target.files[0];if(!f)return;
  const u=await fileData(f);e.target.value="";analyze(u)
});

$("cancel").onclick=()=>show("home");
$("back").onclick=()=>{stopPlay();show("home")};
$("errorBack").onclick=()=>show("home");
$("play").onclick=togglePlay;
$("prev").onclick=()=>{stopPlay();gotoStep(S.step-1,true)};
$("next").onclick=()=>{stopPlay();gotoStep(S.step+1,true)};
$("more").onclick=openSheet;
$("debugBtn").onclick=openSheet;
$("backdrop").onclick=closeSheet;
$("again").onclick=()=>{closeSheet();if(S.dataUrl)analyze(S.dataUrl)};
$("flip").onclick=async()=>{
  if(!S.board)return;
  S.orientation=S.orientation==="black"?"white":"black";
  await S.board.setOrientation(S.orientation==="black"?S.COLOR.black:S.COLOR.white,true);
  closeSheet()
};
$("copy").onclick=async()=>{
  const txt=lineText(S.solution,S.side);
  try{await navigator.clipboard.writeText(txt);$("copy").textContent="Copiado ✓";setTimeout(()=>$("copy").textContent="Copiar solución",1100)}catch(e){}
};
$("share").onclick=async()=>{
  const txt="Mate en "+S.mateN+"\n"+lineText(S.solution,S.side);
  if(navigator.share){try{await navigator.share({title:"Chess puzzle solution",text:txt});return}catch(e){}}
  try{await navigator.clipboard.writeText(txt)}catch(e){}
  $("share").textContent="Copiado ✓";setTimeout(()=>$("share").textContent="Compartir",1100)
};
