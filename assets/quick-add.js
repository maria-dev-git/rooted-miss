if (!customElements.get('quick-add-modal')) {
  customElements.define(
    'quick-add-modal',
    class QuickAddModal extends ModalDialog {
      constructor() {
        super();
        this.modalContent = this.querySelector('[id^="QuickAddInfo-"]');

        this.addEventListener('product-info:loaded', ({ target }) => {
          target.addPreProcessCallback(this.preprocessHTML.bind(this));
        });
      }

      hide(preventFocus = false) {
        const cartNotification = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
        if (cartNotification) cartNotification.setActiveElement(this.openedBy);
        this.galleryController?.abort();
        this.modalContent.innerHTML = '';

        if (preventFocus) this.openedBy = null;
        super.hide();
      }

      show(opener) {
        opener.setAttribute('aria-disabled', true);
        opener.classList.add('loading');
        opener.querySelector('.loading__spinner').classList.remove('hidden');

        fetch(opener.getAttribute('data-product-url'))
          .then((response) => {
            if (!response.ok) throw new Error('Product request failed');
            return response.text();
          })
          .then((responseText) => {
            const responseHTML = new DOMParser().parseFromString(responseText, 'text/html');
            const productElement = responseHTML.querySelector('product-info');

            if (!productElement) throw new Error('Product quick view is unavailable');
            this.preprocessHTML(productElement);
            HTMLUpdateUtility.setInnerHTML(this.modalContent, productElement.outerHTML);

            if (window.Shopify && Shopify.PaymentButton) {
              Shopify.PaymentButton.init();
            }
            if (window.ProductModel) window.ProductModel.loadShopifyXR();

            this.modalContent.querySelector('product-component')?.dispatchViewEvent?.();

            super.show(opener);
            this.initializeGallery();
          })
          .catch(() => {
            this.modalContent.replaceChildren();
            const link = document.createElement('a');
            link.href = opener.getAttribute('data-product-url');
            link.className = 'link';
            link.textContent = window.accessibilityStrings?.quickViewFallback || 'View product details';
            this.modalContent.appendChild(link);
            super.show(opener);
          })
          .finally(() => {
            opener.removeAttribute('aria-disabled');
            opener.classList.remove('loading');
            opener.querySelector('.loading__spinner').classList.add('hidden');
          });
      }

      preprocessHTML(productElement) {
        const scheme = this.dataset.colorScheme;
        const targets = [this.modalContent, productElement];
        targets.forEach(element => {
          Array.from(element.classList).filter(name => name.startsWith('color-')).forEach(name => element.classList.remove(name));
          if (scheme) element.classList.add('color-' + scheme);
          element.classList.add('gradient');
        });
        this.prepareQuickView(productElement);
        this.prepareGallery(productElement);
        this.preventDuplicatedIDs(productElement);
        this.removeDOMElements(productElement);
        this.removeGalleryListSemantic(productElement);
        this.updateImageSizes(productElement);
        this.preventVariantURLSwitching(productElement);
      }

      prepareQuickView(productElement) {
        const info = productElement.querySelector('.product__info-container');
        if (!info) return;
        const summary = productElement.querySelector('[data-quick-view-summary]')?.content;
        const title = info.querySelector('.product__title');
        const price = info.querySelector('[id^="price-"]');
        const picker = info.querySelector('variant-selects');
        const quantity = info.querySelector('[id^="Quantity-Form-"]');
        const form = info.querySelector('product-form')?.parentElement;
        const details = info.querySelector('.product__view-details');
        const vendor = summary?.querySelector('.quick-view__vendor')?.cloneNode(true);
        const description = summary?.querySelector('.quick-view__description')?.cloneNode(true);
        // Move existing controls, preserving Shopify's variant, quantity and cart behavior.
        const blocks = [vendor, title, price, description, picker, quantity, form, details].filter(Boolean);
        info.replaceChildren(...blocks);
        info.classList.remove('product__column-sticky');
        productElement.querySelectorAll('.shopify-payment-button, .product__tax, .product__pickup-availabilities, .product-form__input--dropdown ~ .product__tax').forEach(el => el.remove());
        productElement.querySelectorAll('[data-quick-view-summary]').forEach(el => el.remove());
      }

      prepareGallery(productElement) {
        const viewer = productElement.querySelector('[id^="GalleryViewer-"]');
        const slider = viewer?.querySelector('[id^="Slider-Gallery-"]');
        if (!slider) return;
        slider.classList.remove('slider--mobile', 'slider--tablet');
        slider.classList.add('slider--everywhere');
        const controls = viewer.querySelector('.slider-buttons');
        if (controls) {
          controls.classList.remove('quick-add-hidden', 'small-hide', 'medium-hide', 'large-up-hide');
          controls.hidden = slider.querySelectorAll('[data-media-id]').length < 2;
        }
      }

      initializeGallery() {
        this.galleryController?.abort();
        this.galleryController = new AbortController();
        const { signal } = this.galleryController;
        const viewer = this.modalContent.querySelector('[id^="GalleryViewer-"]');
        const slider = viewer?.querySelector('[id^="Slider-Gallery-"]');
        if (!slider) return;
        requestAnimationFrame(() => viewer.resetPages?.());
        let drag;
        const end = (event) => {
          if (!drag || event.pointerId !== drag.id) return;
          const target = Math.round(slider.scrollLeft / slider.clientWidth) * slider.clientWidth;
          drag = null;
          slider.classList.remove('rm-gallery-dragging');
          if (slider.hasPointerCapture(event.pointerId)) slider.releasePointerCapture(event.pointerId);
          slider.scrollTo({ left: target });
        };
        slider.addEventListener('pointerdown', event => {
          // Touch uses native horizontal scrolling, keeping vertical page scrolling available.
          if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('button, a, video, deferred-media, product-model')) return;
          drag = { id: event.pointerId, x: event.clientX, scroll: slider.scrollLeft };
          slider.setPointerCapture(event.pointerId);
          slider.classList.add('rm-gallery-dragging');
        }, { signal });
        slider.addEventListener('pointermove', event => {
          if (!drag || event.pointerId !== drag.id) return;
          slider.scrollLeft = drag.scroll - (event.clientX - drag.x);
        }, { signal });
        slider.addEventListener('pointerup', end, { signal });
        slider.addEventListener('pointercancel', end, { signal });
        slider.addEventListener('lostpointercapture', end, { signal });
      }

      preventVariantURLSwitching(productElement) {
        productElement.setAttribute('data-update-url', 'false');
      }

      removeDOMElements(productElement) {
        const pickupAvailability = productElement.querySelector('pickup-availability');
        if (pickupAvailability) pickupAvailability.remove();

        const productModal = productElement.querySelector('product-modal');
        if (productModal) productModal.remove();

        const modalDialog = productElement.querySelectorAll('modal-dialog');
        if (modalDialog) modalDialog.forEach((modal) => modal.remove());
      }

      preventDuplicatedIDs(productElement) {
        const sectionId = productElement.dataset.section;

        const oldId = sectionId;
        const newId = `quickadd-${sectionId}`;
        productElement.innerHTML = productElement.innerHTML.replaceAll(oldId, newId);
        Array.from(productElement.attributes).forEach((attribute) => {
          if (attribute.value.includes(oldId)) {
            productElement.setAttribute(attribute.name, attribute.value.replace(oldId, newId));
          }
        });

        productElement.dataset.originalSection = sectionId;
      }

      removeGalleryListSemantic(productElement) {
        const galleryList = productElement.querySelector('[id^="Slider-Gallery"]');
        if (!galleryList) return;

        galleryList.setAttribute('role', 'presentation');
        galleryList.querySelectorAll('[id^="Slide-"]').forEach((li) => li.setAttribute('role', 'presentation'));
      }

      updateImageSizes(productElement) {
        const product = productElement.querySelector('.product');
        const desktopColumns = product?.classList.contains('product--columns');
        if (!desktopColumns) return;

        const mediaImages = product.querySelectorAll('.product__media img');
        if (!mediaImages.length) return;

        let mediaImageSizes =
          '(min-width: 1000px) 715px, (min-width: 750px) calc((100vw - 11.5rem) / 2), calc(100vw - 4rem)';

        if (product.classList.contains('product--medium')) {
          mediaImageSizes = mediaImageSizes.replace('715px', '605px');
        } else if (product.classList.contains('product--small')) {
          mediaImageSizes = mediaImageSizes.replace('715px', '495px');
        }

        mediaImages.forEach((img) => img.setAttribute('sizes', mediaImageSizes));
      }
    }
  );
}
