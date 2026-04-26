(function () {
  'use strict';

  const ICON_SVG = `<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M2 4h12v1.5H2zm0 3h12v1.5H2zm0 3h7v1.5H2z"/></svg>`;

  let _enabled = false;
  let _defaultSite = null;
  let _activeMenu = null;
  let _activeBtn = null;
  let _focusedEl = null;
  let _floatingWidget = null;
  let _floatingClosed = false;
  let _invalidContextNotified = false;

  const FIELD_LABELS = {
    name: 'Name',
    url: 'URL',
    blogUrl: 'Blog URL',
    email: 'Product Email',
    icon: 'Icon',
    screenshot: 'Screenshot',
    launchDate: 'Launch Date',
    shortDescription: 'Short Description',
    longDescription: 'Long Description',
    tagline: 'Tagline',
    slogan: 'Slogan',
    categories: 'Categories',
    priceModel: 'Price Model',
    lowestPrice: 'Lowest Price'
  };

  async function init() {
    const result = await chrome.storage.local.get('settings');
    const settings = result.settings || {};
    _enabled = settings.showOverlay !== false;

    if (!_enabled) return;

    const [sitesResult, settingsResult] = await Promise.all([
      chrome.storage.local.get('sites'),
      chrome.storage.local.get('settings')
    ]);
    const sites = sitesResult.sites || [];
    const lastSiteId = settingsResult.settings?.lastSelectedSiteId;
    _defaultSite = sites.find(s => s.id === lastSiteId) || sites[0] || null;

    attachListeners();
    observeDOM();
    ensureFloatingWidget();
  }

  function hasLiveExtensionContext() {
    return !!(window.chrome && chrome.runtime && chrome.runtime.id);
  }

  function isInvalidExtensionContextError(error) {
    const msg = error && error.message ? String(error.message) : String(error || '');
    return msg.toLowerCase().includes('extension context invalidated');
  }

  function notifyInvalidContext(actionBtn) {
    actionBtn.title = '扩展已更新，请刷新页面后重试';
    if (_invalidContextNotified) return;
    _invalidContextNotified = true;
    console.warn('[Overlay] Extension context invalidated. Please refresh the page and retry.');
  }

  function attachListeners() {
    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    document.addEventListener('pointerdown', onDocumentPointerDown, true);
    document.addEventListener('keydown', onDocumentKeyDown, true);
    document.addEventListener('scroll', repositionBtn, true);
    window.addEventListener('resize', repositionBtn);
  }

  function ensureFloatingWidget() {
    if (_floatingClosed || _floatingWidget || !_enabled) return;

    const widget = document.createElement('div');
    widget.className = 'lsa-floating';

    const actionBtn = document.createElement('button');
    actionBtn.className = 'lsa-floating-btn';
    actionBtn.innerHTML = ICON_SVG;
    actionBtn.title = '外链提交助手 - 检测并填充';
    actionBtn.setAttribute('aria-label', '检测并填充');

    const closeBtn = document.createElement('button');
    closeBtn.className = 'lsa-floating-close';
    closeBtn.textContent = '×';
    closeBtn.title = '关闭悬浮按钮';

    widget.appendChild(actionBtn);
    widget.appendChild(closeBtn);
    document.body.appendChild(widget);
    _floatingWidget = widget;

    actionBtn.addEventListener('click', async () => {
      if (!_defaultSite) return;
      if (!hasLiveExtensionContext()) {
        notifyInvalidContext(actionBtn);
        return;
      }
      actionBtn.disabled = true;
      actionBtn.classList.add('loading');
      actionBtn.title = '填充中...';

      try {
        const settings = await chrome.storage.local.get('settings');
        const apiKey = settings.settings?.deepseekApiKey || '';
        if (window.__linkSubmitterScanAndFill) {
          await window.__linkSubmitterScanAndFill({ site: _defaultSite, apiKey });
        }
      } catch (e) {
        if (isInvalidExtensionContextError(e)) {
          notifyInvalidContext(actionBtn);
        } else {
          console.warn('[Overlay] floating fill error:', e);
        }
      } finally {
        actionBtn.disabled = false;
        actionBtn.classList.remove('loading');
        if (actionBtn.title === '填充中...') {
          actionBtn.title = '外链提交助手 - 检测并填充';
        }
      }
    });

    closeBtn.addEventListener('click', () => {
      _floatingClosed = true;
      widget.remove();
      _floatingWidget = null;
    });
  }

  function onFocusIn(e) {
    const el = e.target;
    if (!isEligibleInput(el)) return;
    _focusedEl = el;
    showBtn(el);
  }

  function onFocusOut(e) {
    setTimeout(() => {
      if (_activeMenu) return;
      if (_activeBtn && _activeBtn.matches(':hover')) return;
      removeBtn();
      _focusedEl = null;
    }, 200);
  }

  function onDocumentPointerDown(e) {
    if (!_activeMenu) return;
    const target = e.target;
    if (_activeMenu.contains(target)) return;
    if (_activeBtn && (_activeBtn === target || _activeBtn.contains(target))) return;
    closeMenu();
  }

  function onDocumentKeyDown(e) {
    if (e.key === 'Escape' && _activeMenu) {
      closeMenu();
    }
  }

  function isEligibleInput(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'textarea') return true;
    if (tag === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      return !['file', 'hidden', 'submit', 'button', 'reset', 'checkbox', 'radio', 'image'].includes(type);
    }
    return false;
  }

  function showBtn(el) {
    removeBtn();
    if (!_defaultSite) return;

    const btn = document.createElement('button');
    btn.className = 'lsa-btn';
    btn.type = 'button';
    btn.innerHTML = ICON_SVG;
    btn.title = '外链提交助手 - 选择填充内容';
    document.body.appendChild(btn);
    _activeBtn = btn;

    positionBtn(el, btn);
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu(el, btn);
    });
    btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
  }

  function positionBtn(el, btn) {
    const rect = el.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
    btn.style.top = (rect.top + scrollTop + (rect.height - 22) / 2) + 'px';
    btn.style.left = (rect.right + scrollLeft + 4) + 'px';
  }

  function repositionBtn() {
    if (_activeBtn && _focusedEl) {
      positionBtn(_focusedEl, _activeBtn);
    }
  }

  function removeBtn() {
    if (_activeBtn) {
      _activeBtn.remove();
      _activeBtn = null;
    }
    closeMenu();
  }

  function toggleMenu(el, btn) {
    if (_activeMenu) {
      closeMenu();
      return;
    }
    openMenu(el, btn);
  }

  function openMenu(el, btn) {
    if (!_defaultSite) return;

    const menu = document.createElement('div');
    menu.className = 'lsa-menu';

    const header = document.createElement('div');
    header.className = 'lsa-menu-header';
    header.textContent = '选择填充内容';
    menu.appendChild(header);

    const siteName = document.createElement('div');
    siteName.className = 'lsa-menu-site';
    siteName.textContent = _defaultSite.name || _defaultSite.url || '未命名网站';
    menu.appendChild(siteName);

    const list = document.createElement('div');
    list.className = 'lsa-menu-list';

    const entries = Object.entries(FIELD_LABELS);
    let hasItems = false;

    for (const [key, label] of entries) {
      let value = _defaultSite[key];
      if (Array.isArray(value)) value = value.join(', ');
      if (!value) continue;

      hasItems = true;
      const item = document.createElement('div');
      item.className = 'lsa-menu-item';

      const labelEl = document.createElement('span');
      labelEl.className = 'lsa-menu-item-label';
      labelEl.textContent = label;

      const valueEl = document.createElement('span');
      valueEl.className = 'lsa-menu-item-value';
      valueEl.textContent = String(value);

      item.appendChild(labelEl);
      item.appendChild(valueEl);

      item.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fillTargetElement(el, String(value));
        closeMenu();
        removeBtn();
      });
      item.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });

      list.appendChild(item);
    }

    if (!hasItems) {
      const empty = document.createElement('div');
      empty.className = 'lsa-menu-empty';
      empty.textContent = '该网站暂无可填充内容';
      list.appendChild(empty);
    }

    menu.appendChild(list);
    document.body.appendChild(menu);
    _activeMenu = menu;

    const btnRect = btn.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
    let top = btnRect.bottom + scrollTop + 4;
    let left = btnRect.left + scrollLeft;

    menu.style.top = top + 'px';
    menu.style.left = left + 'px';

    const menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth - 8) {
      menu.style.left = (window.innerWidth - menuRect.width - 8 + scrollLeft) + 'px';
    }
  }

  function closeMenu() {
    if (_activeMenu) {
      _activeMenu.remove();
      _activeMenu = null;
    }
  }

  function fillTargetElement(el, value) {
    try {
      el.focus();
      const tag = el.tagName.toLowerCase();
      const proto = tag === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {
      console.warn('[Overlay] fill error:', e);
    }
  }

  function observeDOM() {
    const observer = new MutationObserver(() => {
      if (_activeBtn && _focusedEl) {
        positionBtn(_focusedEl, _activeBtn);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
      const settings = changes.settings.newValue || {};
      _enabled = settings.showOverlay !== false;
      if (!_enabled) {
        removeBtn();
        if (_floatingWidget) {
          _floatingWidget.remove();
          _floatingWidget = null;
        }
      } else {
        ensureFloatingWidget();
      }
    }
    if (changes.sites) {
      const sites = changes.sites.newValue || [];
      _defaultSite = sites.find(s => s.id === _defaultSite?.id) || sites[0] || null;
    }
  });

  init();
})();
