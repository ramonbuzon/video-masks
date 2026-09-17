/* MateShot prompt-aware solver constraints.
   When the screenshot states side-to-move and/or Mate in N, those become hard rules
   for every solver/recovery pass. This prevents visually-plausible but wrong positions
   from being accepted just because they contain some other forced mate. */
(() => {
  'use strict';
  const baseFindMate = window.findMate;
  if (typeof baseFindMate !== 'function') return;

  window.findMate = findMate = function(board, side, maxDepth=8, ms=18000){
    const hint = window.MateShotPrompt || null;
    if (hint?.side && side !== hint.side) return null;
    const depth = hint?.mate ? Math.min(maxDepth, hint.mate) : maxDepth;
    const hit = baseFindMate(board, side, depth, ms);
    if (!hit) return null;
    if (hint?.mate && hit.mate !== hint.mate) return null;
    return hit;
  };
})();
