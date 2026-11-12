(() => {
  const main = document.getElementById('MainContent');
  if (!main || !('IntersectionObserver' in window)) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 749px)');
  let observer;
  let frame = 0;
  let banners = [];
  const headings = '.custom-slideshow__content .banner__heading, .rich-text__heading, .collection-list-wrapper h2, .collection__title h2, .multicolumn h2, .image-with-text__heading, .image-banner-width-wrapper .banner__heading';
  const content = '.custom-slideshow__content .banner__text, .custom-slideshow__content .banner__buttons, .rich-text__text, .image-with-text__media-item, .image-with-text__text, .image-with-text__content > .button, .image-banner-width-wrapper .banner__text, .image-banner-width-wrapper .banner__buttons';
  function updateParallax() {
    frame = 0;
    if (reduced.matches) return;
    banners.forEach(media => {
      const rect = media.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > innerHeight) return;
      const progress = Math.max(-1, Math.min(1, (innerHeight / 2 - rect.top - rect.height / 2) / ((innerHeight + rect.height) / 2)));
      const distance = rect.height * (mobile.matches ? .08 : .12);
      media.style.setProperty('--rm-parallax-y', (progress * distance).toFixed(2) + 'px');
    });
  }
  function schedule() {
    if (!frame && !reduced.matches) frame = requestAnimationFrame(updateParallax);
  }
  function initialize() {
    observer?.disconnect();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    main.querySelectorAll('.rm-reveal').forEach(el => {
      el.classList.remove('rm-reveal', 'rm-heading', 'rm-visible');
      el.style.removeProperty('--rm-delay');
    });
    banners.forEach(el => { el.classList.remove('rm-parallax'); el.style.removeProperty('--rm-parallax-y'); });
    banners = [];
    if (reduced.matches) return;
    // Keep all blocks visible while editing or selecting a section.
    const editing = window.Shopify?.designMode;
    if (!editing) {
      // Replace native reveals here to prevent two animations on the same content.
      main.querySelectorAll('.scroll-trigger').forEach(el => el.classList.remove('scroll-trigger', 'scroll-trigger--offscreen', 'animate--slide-in', 'animate--fade-in')); 
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('rm-visible');
          observer.unobserve(entry.target);
        });
      }, { threshold: 0, rootMargin: '0px 0px -20px 0px' });
      function observe(el, heading = false, delay = 0) {
        el.classList.add('rm-reveal');
        if (heading) el.classList.add('rm-heading');
        el.style.setProperty('--rm-delay', delay + 'ms');
        observer.observe(el);
      }
      main.querySelectorAll(headings).forEach(el => observe(el, true));
      main.querySelectorAll(content).forEach(el => observe(el));
      main.querySelectorAll('.collection-list, .product-grid, .multicolumn-list').forEach(list => {
        Array.from(list.children).filter(el => el.tagName === 'LI').forEach((el, i) => observe(el, false, (i % (mobile.matches ? 2 : 4)) * (mobile.matches ? 60 : 90)));
      });
    }
    // Parallax also previews inside the theme editor.
    banners = Array.from(main.querySelectorAll('[data-homepage-parallax] .banner__media')).filter(el => el.querySelector('img'));
    banners.forEach(el => el.classList.add('rm-parallax'));
    schedule();
  }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  reduced.addEventListener('change', initialize);
  document.addEventListener('shopify:section:load', initialize);
  initialize();
})();
