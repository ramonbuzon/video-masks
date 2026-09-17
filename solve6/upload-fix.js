/* MateShot upload fix: reliable file-picker handoff on desktop and iOS/webview previews. */
(() => {
  const picker=document.getElementById('picker');
  if(!picker)return;
  let busy=false;

  async function startFromPicker(e){
    const file=picker.files&&picker.files[0];
    if(!file||busy)return;

    // Run before the legacy bubbling listener so the same file is never handled twice.
    if(e){
      e.stopImmediatePropagation?.();
      e.preventDefault?.();
    }

    busy=true;
    let url='';
    try{
      url=URL.createObjectURL(file);
      picker.value='';

      // Give immediate visual feedback before any image/solver work starts.
      if(typeof window.show==='function')window.show('processing');
      const thumb=document.getElementById('procImg');
      if(thumb)thumb.src=url;
      const title=document.getElementById('procTitle');
      const text=document.getElementById('procText');
      const bar=document.getElementById('bar');
      if(title)title.textContent=(navigator.language||'en').toLowerCase().startsWith('es')?'Leyendo el puzzle':'Reading puzzle';
      if(text)text.textContent=(navigator.language||'en').toLowerCase().startsWith('es')?'Buscando el tablero...':'Looking for the board...';
      if(bar)bar.style.width='7%';

      // Let the processing screen paint before beginning synchronous board detection.
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

      if(typeof window.analyze!=='function')throw new Error('MateShot analyzer is not ready.');
      await window.analyze(url);
    }catch(err){
      console.error('MateShot upload error',err);
      const errorText=document.getElementById('errorText');
      if(errorText)errorText.textContent=(navigator.language||'en').toLowerCase().startsWith('es')
        ?'No he podido abrir esta imagen. Prueba de nuevo.'
        :'I could not open this image. Please try again.';
      if(typeof window.show==='function')window.show('error');
    }finally{
      busy=false;
      if(url)setTimeout(()=>URL.revokeObjectURL(url),5000);
    }
  }

  picker.addEventListener('change',startFromPicker,true);
  picker.addEventListener('input',startFromPicker,true);
})();
