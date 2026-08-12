if (!customElements.get('content-tabs')) {
  class ContentTabs extends HTMLElement {
    constructor() {
      super();
      this.buttons = [];
      this.panels = [];
    }

    connectedCallback() {
      this.buttons = Array.from(this.querySelectorAll('[role="tab"]'));
      this.panels = Array.from(this.querySelectorAll('[role="tabpanel"]'));

      this.buttons.forEach((button, index) => {
        button.addEventListener('click', () => this.activate(index));
        button.addEventListener('keydown', (event) => this.onKeydown(event, index));
      });
    }

    activate(index) {
      this.buttons.forEach((button, buttonIndex) => {
        const selected = buttonIndex === index;
        button.classList.toggle('is-active', selected);
        button.setAttribute('aria-selected', selected ? 'true' : 'false');
        button.setAttribute('tabindex', selected ? '0' : '-1');
      });

      this.panels.forEach((panel, panelIndex) => {
        const selected = panelIndex === index;
        panel.classList.toggle('is-active', selected);
        if (selected) {
          panel.removeAttribute('hidden');
        } else {
          panel.setAttribute('hidden', '');
        }
      });

      this.buttons[index]?.focus();
    }

    onKeydown(event, index) {
      const key = event.key;
      let nextIndex = null;

      if (key === 'ArrowRight' || key === 'ArrowDown') {
        nextIndex = (index + 1) % this.buttons.length;
      } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
        nextIndex = (index - 1 + this.buttons.length) % this.buttons.length;
      } else if (key === 'Home') {
        nextIndex = 0;
      } else if (key === 'End') {
        nextIndex = this.buttons.length - 1;
      }

      if (nextIndex === null) return;

      event.preventDefault();
      this.activate(nextIndex);
    }
  }

  customElements.define('content-tabs', ContentTabs);
}
