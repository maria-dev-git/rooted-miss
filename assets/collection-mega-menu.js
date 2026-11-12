/* Desktop hover menu; its parent anchor remains a normal navigable link. */
if (!customElements.get('collection-mega-menu')) {
  customElements.define('collection-mega-menu', class extends HTMLElement {
    connectedCallback() {
      this.toggle = this.querySelector('.collection-mega-menu__toggle');
      this.panel = this.querySelector('.mega-menu__content');
      this.link = this.querySelector('.collection-mega-menu__trigger a');
      if (!this.toggle || !this.panel) return;
      this.events = new AbortController();
      const options = { signal: this.events.signal };
      this.desktop = matchMedia('(min-width: 990px)');
      this.hover = matchMedia('(hover: hover) and (pointer: fine)');
      this.addEventListener('pointerenter', () => {
        clearTimeout(this.closeTimer);
        if (this.hover.matches) this.open();
      }, options);
      this.addEventListener('pointerleave', () => {
        if (this.hover.matches) this.closeTimer = setTimeout(() => {
          if (!this.contains(document.activeElement)) this.close();
        }, 180);
      }, options);
      this.toggle.addEventListener('click', () => {
        this.hasAttribute('data-open') ? this.close() : this.open();
      }, options);
      this.addEventListener('focusin', (event) => {
        clearTimeout(this.closeTimer);
        if (!this.suppressFocus && event.target === this.link) this.open();
      }, options);
      this.addEventListener('focusout', () => {
        this.closeTimer = setTimeout(() => {
          if (!this.contains(document.activeElement)) this.close();
        }, 0);
      }, options);
      this.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          this.close();
          this.suppressFocus = true;
          this.toggle.focus();
          this.suppressFocus = false;
        } else if (event.key === 'ArrowDown' && (event.target === this.link || event.target === this.toggle)) {
          event.preventDefault();
          this.open();
          this.panel.querySelector('a')?.focus();
        }
      }, options);
      document.addEventListener('pointerdown', (event) => {
        if (!this.contains(event.target)) this.close();
      }, options);
      this.desktop.addEventListener('change', () => { if (!this.desktop.matches) this.close(); }, options);
    }

    open() {
      if (!this.desktop.matches) return;
      clearTimeout(this.closeTimer);
      document.querySelectorAll('collection-mega-menu[data-open]').forEach((menu) => {
        if (menu !== this) menu.close();
      });
      this.panel.hidden = false;
      this.setAttribute('data-open', '');
      this.toggle.setAttribute('aria-expanded', 'true');
      this.syncHeader();
    }

    close() {
      clearTimeout(this.closeTimer);
      this.removeAttribute('data-open');
      if (this.panel) this.panel.hidden = true;
      this.toggle?.setAttribute('aria-expanded', 'false');
      this.syncHeader();
    }

    syncHeader() {
      const header = this.closest('.header-wrapper');
      if (!header) return;
      header.preventHide = !!header.querySelector('collection-mega-menu[data-open], header-menu details[open]');
      document.documentElement.style.setProperty('--header-bottom-position-desktop', `${Math.floor(header.getBoundingClientRect().bottom)}px`);
    }

    disconnectedCallback() {
      this.close();
      this.events?.abort();
    }
  });
}
