/* MateShot production bootstrap.
   Loads the proven source modules as text and executes them as one classic script.
   Keeps the home screen hidden until localization and runtime are ready,
   preventing flashes of legacy copy or legacy logo styles. */
(() => {
  'use strict';

  const picker = document.getElementById('picker');
  const pickButton = document.querySelector('.pick');
  const uploadLabel = document.querySelector('[data-i18n="upload"]');
  const originalUploadText = uploadLabel ? uploadLabel.textContent : 'Upload Screenshot';
  const es = (navigator.language || 'en').toLowerCase().startsWith('es');

  if (picker) picker.disabled = true;
  if (pickButton) {
    pickButton.style.opacity = '.62';
    pickButton.style.pointerEvents = 'none';
  }
  if (uploadLabel) uploadLabel.textContent = es ? 'Preparando MateShot…' : 'Preparing MateShot…';

  const CDN = 'https://cdn.jsdelivr.net/gh/ramonbuzon/video-masks';
  const CORE_COMMIT = 'a28d28a36fd3610b13e6ad1f5d6f9da8a09a326b';
  const MODULE_COMMIT = '0c9d38c907f086d11d310047f9c863b47380c534';
  const ML_COMMIT = '567873bb50874c0ca03b4c64b04f5a107ae900b1';
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
    `${CDN}@${MODULE_COMMIT}/solve6/polish-v12.js`,
    `${CDN}@${ML_COMMIT}/mateshot/recognition-ml.js`
  ];

  const bridge = `\n;(() => {\n  const names = [\n    '$','SCREENS','GLYPH','TYPES','TEMPLATE64','TEMPLATES','S',\n    'show','prog','wait','fileData','loadImg','median','detectBoard',\n    'largestComponent','normalizeMask','iou','scanBoard','cellsBoard',\n    'rotateBoard','boardKey','validShape','preferredOrientation','pc','pt',\n    'other','rc','inside','sq','kingIndex','attacked','inCheck','pseudoMoves',\n    'makeMove','legalMoves','givesCheck','posKey','forcedMate','findMate',\n    'solveCells','fenBoard','annotate','notation','renderBoard','stopPlay',\n    'gotoStep','playLoop','togglePlay','analyze'\n  ];\n  for (const name of names) {\n    try { window[name] = eval(name); } catch (_) {}\n  }\n})();\n`;

  async function getSource(url) {
    const res = await fetch(url, {cache:'force-cache', mode:'cors'});
    if (!res.ok) throw new Error(`Could not load MateShot module (${res.status})`);
    return res.text();
  }

  function applyFinalHomeCopy() {
    const eyebrow = document.querySelector('[data-i18n="eyebrow"]');
    const hero1 = document.querySelector('[data-i18n="hero1"]');
    const hero2 = document.querySelector('[data-i18n="hero2"]');
    const heroText = document.querySelector('[data-i18n="heroText"]');
    const homeCore = document.querySelector('.homeCore');
    const microcopy = document.querySelector('.microcopy');

    if (homeCore) homeCore.style.width = 'min(100%, 600px)';
    if (microcopy) microcopy.remove();

    if (eyebrow) eyebrow.textContent = es ? 'De screenshot a solución' : 'From screenshot to solution';
    if (hero1) hero1.textContent = es ? 'Sube un problema de ajedrez.' : 'Upload a chess problem.';
    if (hero2) hero2.textContent = es ? 'Mira su solución.' : 'See its solution.';
    if (heroText) {
      heroText.textContent = es
        ? 'MateShot analiza cualquier imagen que contenga un problema de mate de ajedrez de hasta 8 jugadas, y muestra su solución animada.'
        : 'MateShot analyzes any image containing a chess mate problem of up to 8 moves and shows its animated solution.';
    }
    if (uploadLabel) uploadLabel.textContent = es ? 'Subir Screenshot' : 'Upload Screenshot';
  }

  async function boot() {
    try {
      const code = [];
      for (let i = 0; i < sources.length; i++) {
        code.push(await getSource(sources[i]));
        if (i === 0) code.push(bridge);
      }

      const marker = document.createElement('script');
      marker.type = 'application/json';
      marker.dataset.mateshotSolverV3 = '1';
      marker.textContent = '{}';
      document.head.appendChild(marker);

      const bundle = document.createElement('script');
      bundle.id = 'mateshot-app';
      bundle.textContent = code.join('\n\n') + '\n//# sourceURL=mateshot-app.js';
      document.body.appendChild(bundle);

      const ready = typeof window.analyze === 'function' && typeof window.fileData === 'function' && window.S;
      if (!ready) throw new Error('MateShot core did not initialize correctly.');

      applyFinalHomeCopy();

      if (picker) picker.disabled = false;
      if (pickButton) {
        pickButton.style.opacity = '';
        pickButton.style.pointerEvents = '';
      }

      requestAnimationFrame(() => {
        document.documentElement.dataset.mateshotReady = '1';
      });
    } catch (err) {
      if (uploadLabel) uploadLabel.textContent = es ? 'Recargar MateShot' : 'Reload MateShot';
      if (pickButton) {
        pickButton.style.opacity = '1';
        pickButton.style.pointerEvents = 'auto';
        pickButton.setAttribute('for','');
        pickButton.addEventListener('click', () => location.reload(), {once:true});
      }
      document.documentElement.dataset.mateshotReady = 'error';
      console.warn('MateShot boot issue:', err && err.message ? err.message : err);
    }
  }

  boot();
})();
