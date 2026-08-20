/**
 * TRS parts search — models (metaobjects), part numbers, cross-refs.
 * Uses /search?sections=trs-parts-search-api for Liquid lookups.
 */
class TrsPartsSearch extends HTMLElement {
  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;

    this.form = this.querySelector('form');
    this.input = this.querySelector('[data-trs-search-input]');
    this.results = this.querySelector('[data-trs-search-results]');
    this.status = this.querySelector('[data-trs-search-status]');
    this.minChars = Number(this.dataset.minChars || 2);
    this.debounceMs = Number(this.dataset.debounce || 280);
    this.sectionId = this.dataset.sectionId || 'trs-parts-search-api';
    this.abortController = null;
    this.activeIndex = -1;
    this.timer = null;

    this.onInput = this.onInput.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this.onDocClick = this.onDocClick.bind(this);

    this.input?.addEventListener('input', this.onInput);
    this.input?.addEventListener('keydown', this.onKeyDown);
    this.form?.addEventListener('submit', this.onSubmit);
    document.addEventListener('click', this.onDocClick);
  }

  disconnectedCallback() {
    this.input?.removeEventListener('input', this.onInput);
    this.input?.removeEventListener('keydown', this.onKeyDown);
    this.form?.removeEventListener('submit', this.onSubmit);
    document.removeEventListener('click', this.onDocClick);
    this.abortController?.abort();
    clearTimeout(this.timer);
  }

  onDocClick(event) {
    if (!this.contains(event.target)) this.closeResults();
  }

  onInput() {
    clearTimeout(this.timer);
    const q = (this.input?.value || '').trim();
    if (q.length < this.minChars) {
      this.closeResults();
      return;
    }
    this.timer = setTimeout(() => this.search(q), this.debounceMs);
  }

  onKeyDown(event) {
    if (!this.results?.classList.contains('is-open')) return;
    const items = [...this.results.querySelectorAll('[data-trs-result]')];
    if (!items.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex = Math.min(this.activeIndex + 1, items.length - 1);
      this.paintActive(items);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex = Math.max(this.activeIndex - 1, 0);
      this.paintActive(items);
    } else if (event.key === 'Enter' && this.activeIndex >= 0) {
      event.preventDefault();
      items[this.activeIndex]?.click();
    } else if (event.key === 'Escape') {
      this.closeResults();
    }
  }

  paintActive(items) {
    items.forEach((el, i) => el.classList.toggle('is-active', i === this.activeIndex));
    items[this.activeIndex]?.scrollIntoView({ block: 'nearest' });
  }

  onSubmit(event) {
    const q = (this.input?.value || '').trim();
    if (!q) {
      event.preventDefault();
      return;
    }
    // Allow native navigation to /search — API also enriches results page later if desired.
  }

  async search(query) {
    this.abortController?.abort();
    this.abortController = new AbortController();
    this.setStatus('Searching…');
    this.openResults();

    try {
      const url = new URL(`${window.Shopify?.routes?.root || '/'}search`, window.location.origin);
      url.searchParams.set('q', query);
      url.searchParams.set('type', 'product');
      url.searchParams.set('sections', this.sectionId);

      const response = await fetch(url.toString(), {
        signal: this.abortController.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`Search failed (${response.status})`);

      const payload = await response.json();
      const html = payload[this.sectionId];
      if (!html) throw new Error('Search section missing from response');

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const dataNode = doc.querySelector('[data-trs-parts-search-json]');
      const data = dataNode ? JSON.parse(dataNode.textContent || '{}') : { results: [] };
      this.renderResults(data, query);
    } catch (error) {
      if (error.name === 'AbortError') return;
      this.setStatus('Search unavailable. Press Enter to open full results.');
      this.results.innerHTML = '';
      this.results.appendChild(this.status);
    }
  }

  renderResults(data, query) {
    this.activeIndex = -1;
    const results = Array.isArray(data.results) ? data.results : [];
    this.results.innerHTML = '';

    if (!results.length) {
      const empty = document.createElement('div');
      empty.className = 'trs-parts-search__empty';
      empty.textContent = `No matches for “${query}”`;
      this.results.appendChild(empty);
      this.openResults();
      return;
    }

    let currentGroup = null;
    for (const item of results) {
      if (item.group && item.group !== currentGroup) {
        currentGroup = item.group;
        const label = document.createElement('div');
        label.className = 'trs-parts-search__group-label';
        label.textContent = currentGroup;
        this.results.appendChild(label);
      }

      const link = document.createElement('a');
      link.className = 'trs-parts-search__item';
      link.href = item.url;
      link.setAttribute('data-trs-result', '');

      if (item.image) {
        const media = document.createElement('div');
        media.className = 'trs-parts-search__item-media';
        const img = document.createElement('img');
        img.src = item.image;
        img.alt = item.title || '';
        img.loading = 'lazy';
        img.width = 88;
        img.height = 88;
        media.appendChild(img);
        link.appendChild(media);
      }

      const body = document.createElement('div');
      body.className = 'trs-parts-search__item-body';
      const title = document.createElement('p');
      title.className = 'trs-parts-search__item-title';
      title.textContent = item.title || 'Product';
      body.appendChild(title);
      if (item.meta) {
        const meta = document.createElement('span');
        meta.className = 'trs-parts-search__item-meta';
        meta.textContent = item.meta;
        body.appendChild(meta);
      }
      link.appendChild(body);
      this.results.appendChild(link);
    }

    this.openResults();
    this.setStatus('');
  }

  setStatus(text) {
    if (!this.results) return;
    let status = this.results.querySelector('[data-trs-search-status]');
    if (!status) {
      status = document.createElement('div');
      status.className = 'trs-parts-search__status';
      status.setAttribute('data-trs-search-status', '');
      this.results.appendChild(status);
    }
    this.status = status;
    if (!text) {
      status.hidden = true;
      status.textContent = '';
      return;
    }
    status.hidden = false;
    status.textContent = text;
  }

  openResults() {
    this.results?.classList.add('is-open');
  }

  closeResults() {
    this.results?.classList.remove('is-open');
    this.activeIndex = -1;
  }
}

if (!customElements.get('trs-parts-search')) {
  customElements.define('trs-parts-search', TrsPartsSearch);
}
