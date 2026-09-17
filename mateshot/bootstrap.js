/* MateShot production bootstrap.
   Loads the proven source modules as text and executes them as ONE classic script.
   This avoids html-preview isolating globals between separate script tags. */
(() => {
  'use strict';

  const picker = document.getElementById('picker');
  const pickButton = document.querySelector('.pick');
  const uploadLabel = document.querySelector('[data-i18n="upload"]');
  const originalUploadText = uploadLabel ? uploadLabel.textContent : 'Upload screenshot';
  if (picker) picker.disabled = true;
  if (pickButton) {
    pickButton.style.opacity = '.62';
    pickButton.style.pointerEvents = 'none';
  }
  if (uploadLabel) uploadLabel.textContent = (navigator.language || 'en').toLowerCase().startsWith('es') ? 'Preparando MateShot…' : 'Preparing MateShot…';

  const CDN = 'https://cdn.jsdelivr.net/gh/ramonbuzon/video-masks';
  const CORE_COMMIT = 'a28d28a36fd3610b13e6ad1f5d6f9da8a09a326b';
  const MODULE_COMMIT = '0c9d38c907f086d11d310047f9c863b47380c534';
  const sources = [
    `${CDN}@${CORE_COMMIT}/solve5/app.js`,
    `${CDN}@${MODULE_COMMIT}/solve6/solver-v3.js`,
    `${CDN}@${MODULE_COMMIT}/solve6/recognition-v3.js`,
    `${CDN}@${MODULE_COMMIT}/solve6/enhance.js`,
    `${CDN}@${MODULE_COMMIT}/solve6/video-fix.js`,
    `${CDN}@${MODULE_COMMIT}/solve6/finish-fx.js`,
    `${CDN}@${MODULE_COMMIT}/solve6/replay-web.js`,
    `${CDN}@${MODULE_COMMIT}/solve6/polish-v10.js`,
    `${CDN}@${MODULE_COMMIT}/solve6/polish-v11.js`,
    `${CDN}@${MODULE_COMMIT}/solve6/polish-v12.js`
  ];

  const bridge = `\n;(() => {\n  const names = [\n    '$','SCREENS','GLYPH','TYPES','TEMPLATE64','TEMPLATES','S',\n    'show','prog','wait','fileData','loadImg','median','detectBoard',\n    'largestComponent','normalizeMask','iou','scanBoard','cellsBoard',\n    'rotateBoard','boardKey','validShape','preferredOrientation','pc','pt',\n    'other','rc','inside','sq','kingIndex','attacked','inCheck','pseudoMoves',\n    'makeMove','legalMoves','givesCheck','posKey','forcedMate','findMate',\n    'solveCells','fenBoard','annotate','notation','renderBoard','stopPlay',\n    'gotoStep','playLoop','togglePlay','analyze'\n  ];\n  for (const name of names) {\n    try { window[name] = eval(name); } catch (_) {}\n  }\n})();\n`;

  async function getSource(url) {
    const res = await fetch(url, {cache:'force-cache', mode:'cors'});
    if (!res.ok) throw new Error(`Could not load MateShot module (${res.status})`);
    return res.text();
  }

  async function boot() {
    try {
      const code = [];
      for (let i = 0; i < sources.length; i++) {
        code.push(await getSource(sources[i]));
        if (i === 0) code.push(bridge);
      }

      // polish-v12 used to inject solver-v3 as another script. It is already
      // part of this bundle, so this marker prevents that legacy loader.
      const marker = document.createElement('script');
      marker.type = 'application/json';
      marker.dataset.mateshotSolverV3 = '1';
      marker.textContent = '{}';
      document.head.appendChild(marker);

      const bundle = document.createElement('script');
      bundle.id = 'mateshot-app';
      bundle.textContent = code.join('\n\n') + '\n//# sourceURL=mateshot-app.js';
      document.body.appendChild(bundle);

      // Explicitly verify the critical path before enabling upload.
      const ready = typeof window.analyze === 'function' && typeof window.fileData === 'function' && window.S;
      if (!ready) throw new Error('MateShot core did not initialize correctly.');

      if (picker) picker.disabled = false;
      if (pickButton) {
        pickButton.style.opacity = '';
        pickButton.style.pointerEvents = '';
      }
      if (uploadLabel) {
        const es = (navigator.language || 'en').toLowerCase().startsWith('es');
        uploadLabel.textContent = es ? 'Subir captura' : originalUploadText;
      }
      document.documentElement.dataset.mateshotReady = '1';
    } catch (err) {
      // Handled boot failure: keep the UI usable and avoid cascading exceptions.
      const es = (navigator.language || 'en').toLowerCase().startsWith('es');
      if (uploadLabel) uploadLabel.textContent = es ? 'Recargar MateShot' : 'Reload MateShot';
      if (pickButton) {
        pickButton.style.opacity = '1';
        pickButton.style.pointerEvents = 'auto';
        pickButton.setAttribute('for','');
        pickButton.addEventListener('click', () => location.reload(), {once:true});
      }
      const micro = document.querySelector('.microcopy');
      if (micro) micro.textContent = es ? 'No se ha podido iniciar la app. Recarga para intentarlo de nuevo.' : 'The app could not start. Reload to try again.';
      console.warn('MateShot boot issue:', err && err.message ? err.message : err);
    }
  }

  boot();
})();
