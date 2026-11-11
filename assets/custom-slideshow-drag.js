/* Pointer dragging with first/last wraparound. Vertical touch scrolling stays native. */
if (!customElements.get('custom-slideshow-drag')) {
  customElements.define('custom-slideshow-drag', class extends HTMLElement {
    connectedCallback() {
      this.component = this.closest('slideshow-component');
      this.slider = this.component?.querySelector('[id^="Slider-"]');
      if (!this.slider || this.slider.querySelectorAll('.slider__slide').length < 2) return;
      this.events = new AbortController();
      const options = { signal: this.events.signal };
      this.component.classList.add('custom-slideshow--draggable');
      this.component.addEventListener('pointerdown', (event) => this.start(event), options);
      this.component.addEventListener('pointermove', (event) => this.move(event), options);
      this.component.addEventListener('pointerup', (event) => this.finish(event), options);
      this.component.addEventListener('pointercancel', (event) => this.finish(event), options);
      this.slider.addEventListener('lostpointercapture', (event) => this.finish(event), options);
      this.slider.addEventListener('dragstart', (event) => event.preventDefault(), options);
      this.component.addEventListener('click', (event) => {
        if (!this.suppressClick) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      }, { ...options, capture: true });
    }

    slideTargets() {
      const position = this.slider.scrollLeft;
      const sliderBounds = this.slider.getBoundingClientRect();
      const rtl = getComputedStyle(this.slider).direction === 'rtl';
      return Array.from(this.slider.querySelectorAll('.slider__slide')).map((slide) => {
        const bounds = slide.getBoundingClientRect();
        return position + (rtl ? bounds.right - sliderBounds.right : bounds.left - sliderBounds.left);
      });
    }

    start(event) {
      if (!event.isPrimary || event.button !== 0 || this.drag ||
          !this.slider.contains(event.target) ||
          event.target.closest('a, button, input, select, textarea, [contenteditable="true"]')) return;
      clearTimeout(this.resumeTimer);
      clearTimeout(this.component.setPositionTimeout);
      this.component.pause?.();
      this.suppressClick = false;
      this.drag = {
        id: event.pointerId, x: event.clientX, y: event.clientY,
        scroll: this.slider.scrollLeft, requested: this.slider.scrollLeft,
        targets: this.slideTargets(), active: false, touch: event.pointerType !== 'mouse',
      };
      this.slider.setPointerCapture(event.pointerId);
    }

    move(event) {
      if (!this.drag || event.pointerId !== this.drag.id) return;
      const distance = event.clientX - this.drag.x;
      if (!this.drag.active) {
        if (Math.abs(distance) < 5) return;
        if (this.drag.touch && Math.abs(event.clientY - this.drag.y) > Math.abs(distance)) return;
      }
      this.drag.active = true;
      this.slider.classList.add('is-dragging');
      this.component.pause?.();
      event.preventDefault();
      // Store the unclamped position: browsers clamp scrollLeft at either edge.
      this.drag.requested = this.drag.scroll - distance;
      this.slider.scrollLeft = this.drag.requested;
    }

    finish(event) {
      if (!this.drag || event.pointerId !== this.drag.id) return;
      const { id, active, touch, requested, targets } = this.drag;
      this.drag = null;
      const position = this.slider.scrollLeft;
      let target = targets.reduce((best, value) => Math.abs(value - position) < Math.abs(best - position) ? value : best);
      const direction = getComputedStyle(this.slider).direction === 'rtl' ? -1 : 1;
      const first = targets[0];
      const last = targets[targets.length - 1];
      const threshold = Math.min(50, this.slider.clientWidth * 0.15);
      let wrap = false;
      // Only a deliberate release wraps; cancellation and tiny gestures snap back.
      if (active && event.type === 'pointerup') {
        if ((requested - first) * direction < -threshold) {
          target = last;
          wrap = true;
        } else if ((requested - last) * direction > threshold) {
          target = first;
          wrap = true;
        }
      }
      this.slider.classList.remove('is-dragging');
      if (this.slider.hasPointerCapture(id)) this.slider.releasePointerCapture(id);
      if (active) {
        this.suppressClick = true;
        clearTimeout(this.clickTimer);
        this.clickTimer = setTimeout(() => { this.suppressClick = false; }, 0);
        // Wrap immediately rather than scrolling backwards through every slide.
        this.slider.scrollTo({ left: target, behavior: wrap || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      }
      this.scheduleResume(touch);
    }

    scheduleResume(touch) {
      this.resumeTimer = setTimeout(() => {
        if (!this.component.isConnected || this.drag ||
            this.slider.dataset.autoplay !== 'true' || !this.component.autoplayButtonIsSetToPlay ||
            this.component.contains(document.activeElement) || (!touch && this.component.matches(':hover'))) return;
        this.component.play?.();
      }, 600);
    }

    disconnectedCallback() {
      this.events?.abort();
      clearTimeout(this.resumeTimer);
      clearTimeout(this.clickTimer);
      if (this.drag && this.slider.hasPointerCapture(this.drag.id)) this.slider.releasePointerCapture(this.drag.id);
      this.drag = null;
      this.slider?.classList.remove('is-dragging');
      this.component?.classList.remove('custom-slideshow--draggable');
      this.component?.pause?.();
    }
  });
}
