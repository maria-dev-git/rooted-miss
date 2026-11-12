(() => {
  const main = document.getElementById('MainContent');
  if (!main) return;
  const desktop = matchMedia('(min-width: 990px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let scenes = [];
  let frame = 0;
  let resizeFrame = 0;
  const clamp = value => Math.max(0, Math.min(1, value));
  function clear() {
    scenes.forEach(({ section, stage, cards }) => {
      section.classList.remove('rm-collection-pin', 'rm-collection-fit');
      section.style.removeProperty('--rm-card-max-height');
      section.style.removeProperty('--rm-pin-height');
      section.style.removeProperty('--rm-pin-top');
      stage.classList.remove('rm-collection-pin__stage');
      cards.forEach(card => {
        card.classList.remove('rm-collection-pin__card');
        card.style.removeProperty('--rm-card-progress');
        card.inert = false;
      });
    });
    scenes = [];
  }
  function update() {
    frame = 0;
    scenes.forEach(({ section, cards, top, travel }) => {
      const progress = clamp((top - section.getBoundingClientRect().top) / travel);
      cards.forEach((card, index) => {
        // Each card occupies its own scroll interval, followed by a short hold.
        const value = clamp(progress * (cards.length + .4) - index);
        card.style.setProperty('--rm-card-progress', value.toFixed(4));
        card.inert = value < .05;
      });
    });
  }
  function schedule() {
    if (!frame && scenes.length) frame = requestAnimationFrame(update);
  }
  function initialize() {
    clear();
    if (!desktop.matches || reduced.matches) return;
    const header = document.querySelector('.section-header');
    const top = Math.max(16, (header?.getBoundingClientRect().height || 0) + 16);
    main.querySelectorAll('.section-collection-list').forEach(section => {
      const stage = section.firstElementChild;
      const cards = Array.from(section.querySelectorAll('.collection-list > li'));
      if (!stage || cards.length !== 3) return;
      // Keep normal scrolling for wrapped layouts; fit a single row to the viewport.
      const rects = cards.map(card => card.getBoundingClientRect());
      if (rects.some(rect => Math.abs(rect.top - rects[0].top) > 2)) return;
      const available = innerHeight - top - 24;
      const naturalHeight = stage.getBoundingClientRect().height;
      const cardHeight = Math.max(...rects.map(rect => rect.height));
      const overhead = naturalHeight - cardHeight;
      const maximumCardHeight = Math.floor(available - overhead);
      if (maximumCardHeight < 120 || naturalHeight < 1) return;
      section.style.setProperty('--rm-card-max-height', maximumCardHeight + 'px');
      section.classList.add('rm-collection-fit');
      const height = stage.getBoundingClientRect().height;
      if (height > available + 2) {
        section.classList.remove('rm-collection-fit');
        section.style.removeProperty('--rm-card-max-height');
        return;
      }
      const travel = Math.round(innerHeight * 1.65);
      const scene = { section, stage, cards, top, travel };
      scenes.push(scene);
      section.style.setProperty('--rm-pin-height', (height + travel) + 'px');
      section.style.setProperty('--rm-pin-top', top + 'px');
      section.classList.add('rm-collection-pin');
      stage.classList.add('rm-collection-pin__stage');
      // Pinning replaces the time-based card reveal on desktop.
      cards.forEach(card => card.classList.add('rm-collection-pin__card'));
    });
    update();
  }
  function resize() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(initialize);
  }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', resize, { passive: true });
  addEventListener('load', initialize, { once: true });
  desktop.addEventListener('change', initialize);
  reduced.addEventListener('change', initialize);
  document.addEventListener('shopify:section:load', initialize);
  document.addEventListener('shopify:section:unload', initialize);
  // Selection must not permanently disable the scroll scene in the editor.
  document.addEventListener('shopify:section:deselect', initialize);
  document.fonts?.ready.then(initialize);
  initialize();
})();
