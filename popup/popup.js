(function () {
  'use strict';

  // ── Tab navigation ──────────────────────────────────────────
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // ── Site Management ─────────────────────────────────────────
  let _sites = [];
  let _editingSiteId = null;
  let _categories = [];

  async function loadSites() {
    _sites = await Storage.getSites();
    renderSiteList();
    await populateFillSiteSelect();
    updateFillActions();
  }

  function renderSiteList() {
    const list = document.getElementById('siteList');
    const empty = document.getElementById('siteEmpty');
    const search = document.getElementById('searchInput').value.toLowerCase();

    const filtered = _sites.filter(s =>
      !search ||
      (s.name || '').toLowerCase().includes(search) ||
      (s.url || '').toLowerCase().includes(search)
    );

    list.innerHTML = '';

    if (!filtered.length) {
      empty.style.display = 'flex';
      return;
    }
    empty.style.display = 'none';

    for (const site of filtered) {
      const card = document.createElement('div');
      card.className = 'site-card';
      card.innerHTML = `
        <div class="site-card-body">
          <div class="site-card-name" title="${esc(site.name)}">${esc(site.name || '未命名')}</div>
          <a class="site-card-url" href="${esc(site.url)}" target="_blank" title="${esc(site.url)}">${esc(site.url || '')}</a>
          <div class="site-card-meta">${site.createdAt ? new Date(site.createdAt).toLocaleDateString('zh-CN') : ''}</div>
        </div>
        <div class="site-card-actions">
          <button class="icon-btn" data-action="edit" data-id="${site.id}" title="编辑">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="icon-btn" data-action="delete" data-id="${site.id}" title="删除">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
          </button>
        </div>
      `;
      list.appendChild(card);
    }

    list.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => openEditForm(btn.dataset.id));
    });
    list.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => deleteSite(btn.dataset.id));
    });
  }

  async function populateFillSiteSelect() {
    const sel = document.getElementById('fillSiteSelect');
    const settings = await Storage.getSettings();
    const lastSiteId = settings.lastSelectedSiteId;
    sel.innerHTML = '<option value="">-- 请选择网站 --</option>';
    for (const s of _sites) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name || s.url;
      sel.appendChild(opt);
    }
    if (lastSiteId && _sites.find(s => s.id === lastSiteId)) {
      sel.value = lastSiteId;
    }
  }

  document.getElementById('searchInput').addEventListener('input', renderSiteList);

  document.getElementById('addSiteBtn').addEventListener('click', () => openAddForm());

  function openAddForm() {
    _editingSiteId = null;
    _categories = [];
    document.getElementById('formTitle').textContent = '添加网站';
    clearForm();
    document.getElementById('siteFormOverlay').style.display = 'flex';
  }

  function openEditForm(id) {
    const site = _sites.find(s => s.id === id);
    if (!site) return;
    _editingSiteId = id;
    _categories = Array.isArray(site.categories) ? [...site.categories] : [];
    document.getElementById('formTitle').textContent = '编辑网站';
    fillForm(site);
    document.getElementById('siteFormOverlay').style.display = 'flex';
  }

  function clearForm() {
    ['name','url','email','yourName','yourEmail','blogUrl','icon','screenshot','launchDate','tagline','slogan','useCase','shortDescription','longDescription','lowestPrice'].forEach(f => {
      document.getElementById(`f-${f}`).value = '';
    });
    document.getElementById('f-priceModel').value = '';
    renderTags();
  }

  function fillForm(site) {
    ['name','url','email','yourName','yourEmail','blogUrl','icon','screenshot','launchDate','tagline','slogan','useCase','shortDescription','longDescription','lowestPrice'].forEach(f => {
      document.getElementById(`f-${f}`).value = site[f] || '';
    });
    document.getElementById('f-priceModel').value = site.priceModel || '';
    renderTags();
  }

  function getFormData() {
    return {
      id: _editingSiteId || undefined,
      name: v('f-name'),
      url: v('f-url'),
      email: v('f-email'),
      yourName: v('f-yourName'),
      yourEmail: v('f-yourEmail'),
      blogUrl: v('f-blogUrl'),
      icon: v('f-icon'),
      screenshot: v('f-screenshot'),
      launchDate: v('f-launchDate'),
      tagline: v('f-tagline'),
      slogan: v('f-slogan'),
      useCase: v('f-useCase'),
      shortDescription: v('f-shortDescription'),
      longDescription: v('f-longDescription'),
      categories: [..._categories],
      priceModel: v('f-priceModel'),
      lowestPrice: v('f-lowestPrice')
    };
  }

  document.getElementById('saveSiteBtn').addEventListener('click', async () => {
    const data = getFormData();
    if (!data.name.trim()) { alert('请填写网站名称'); return; }
    if (!data.url.trim()) { alert('请填写网站地址'); return; }
    await Storage.saveSite(data);
    closeForm();
    await loadSites();
  });

  document.getElementById('closeFormBtn').addEventListener('click', closeForm);
  document.getElementById('cancelFormBtn').addEventListener('click', closeForm);

  function closeForm() {
    document.getElementById('siteFormOverlay').style.display = 'none';
  }

  async function deleteSite(id) {
    if (!confirm('确认删除该网站？')) return;
    await Storage.deleteSite(id);
    await loadSites();
  }

  // Tags
  function renderTags() {
    const list = document.getElementById('tagList');
    list.innerHTML = '';
    for (const tag of _categories) {
      const el = document.createElement('span');
      el.className = 'tag';
      el.innerHTML = `${esc(tag)}<button class="tag-remove" data-tag="${esc(tag)}">&times;</button>`;
      list.appendChild(el);
    }
    list.querySelectorAll('.tag-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        _categories = _categories.filter(t => t !== btn.dataset.tag);
        renderTags();
      });
    });
  }

  document.getElementById('tagInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = e.target.value.trim();
      if (val && !_categories.includes(val)) {
        _categories.push(val);
        renderTags();
      }
      e.target.value = '';
    }
  });

  document.getElementById('tagInput').addEventListener('blur', e => {
    const val = e.target.value.trim();
    if (val && !_categories.includes(val)) {
      _categories.push(val);
      renderTags();
      e.target.value = '';
    }
  });

  // ── Smart Fill Tab ───────────────────────────────────────────
  let _scanResults = null;
  let _scanning = false;

  document.getElementById('fillSiteSelect').addEventListener('change', async () => {
    const siteId = document.getElementById('fillSiteSelect').value;
    if (siteId) {
      await Storage.saveSettings({ lastSelectedSiteId: siteId });
    }
    if (_scanResults) renderMatchList(_scanResults);
    updateFillActions();
  });
  document.getElementById('doFillBtn').addEventListener('click', doFill);

  async function doScan() {
    if (_scanning) return;
    _scanning = true;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const settings = await Storage.getSettings();

      const result = await requestScanWithRetry(tab.id, settings.deepseekApiKey);

      if (result) {
        _scanResults = result;
        showPageInfo(tab, result);
        renderMatchList(result);
        updateFillActions();
      } else {
        showFillEmpty('页面无法注入脚本，请刷新后重试');
      }
    } catch (e) {
      console.error('[Popup] scan error:', e);
      showFillEmpty('检测失败，请刷新页面后重试');
    } finally {
      _scanning = false;
    }
  }

  async function requestScanWithRetry(tabId, apiKey) {
    try {
      return await chrome.tabs.sendMessage(tabId, {
        type: 'SCAN_PAGE',
        apiKey
      });
    } catch (e) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['utils/rules.js', 'utils/matcher.js', 'content/content.js', 'content/overlay.js']
        });

        return await chrome.tabs.sendMessage(tabId, {
          type: 'SCAN_PAGE',
          apiKey
        });
      } catch (_) {
        return null;
      }
    }
  }

  function showPageInfo(tab, result) {
    const pageInfo = document.getElementById('pageInfo');
    const domain = document.getElementById('pageDomain');
    const stat = document.getElementById('pageStat');
    try {
      domain.textContent = new URL(tab.url).hostname;
    } catch (_) {
      domain.textContent = tab.url;
    }
    stat.textContent = `检测到 ${result.formCount} 个表单，${result.fieldCount} 个可填字段`;
    pageInfo.style.display = 'flex';
    document.getElementById('fillEmpty').style.display = 'none';
  }

  function renderMatchList(result) {
    const list = document.getElementById('matchList');
    const label = document.getElementById('matchListLabel');
    list.innerHTML = '';

    const matches = result.matches || [];
    if (!matches.length) {
      label.style.display = 'none';
      showFillEmpty('未检测到可匹配的表单字段');
      return;
    }

    label.style.display = 'block';
    document.getElementById('fillEmpty').style.display = 'none';

    const FIELD_LABELS = {
      name: 'Name', url: 'URL', blogUrl: 'Blog URL', email: 'Product Email', yourName: 'Your Name', yourEmail: 'Your Email', icon: 'Icon',
      screenshot: 'Screenshot', launchDate: 'Launch Date',
      shortDescription: 'Short Description', longDescription: 'Long Description',
      tagline: 'Tagline', slogan: 'Slogan', useCase: 'Use Case', categories: 'Categories',
      priceModel: 'Price Model', lowestPrice: 'Lowest Price'
    };

    for (const match of matches) {
      const pct = Math.round((match.confidence || 0) * 100);
      const confClass = pct >= 80 ? 'confidence-high' : pct >= 60 ? 'confidence-mid' : 'confidence-low';
      const srcClass = match.source === 'ai' ? 'source-ai' : 'source-rule';

      const card = document.createElement('div');
      card.className = 'match-card';
      card.innerHTML = `
        <div>
          <div class="match-card-field">${FIELD_LABELS[match.field] || match.field}</div>
          <div class="match-card-page">${esc(match.pageLabel || '')}</div>
        </div>
        <div class="match-card-right">
          <span class="confidence-badge ${confClass}">${pct}%</span>
          <span class="source-badge ${srcClass}">${match.source}</span>
        </div>
      `;
      list.appendChild(card);
    }
  }

  function showFillEmpty(msg) {
    document.getElementById('matchList').innerHTML = '';
    document.getElementById('matchListLabel').style.display = 'none';
    const empty = document.getElementById('fillEmpty');
    empty.style.display = 'flex';
    document.getElementById('fillEmptyMsg').textContent = msg;
    updateFillActions();
  }

  function updateFillActions() {
    const siteId = document.getElementById('fillSiteSelect').value;
    document.getElementById('fillActions').style.display = siteId ? 'block' : 'none';
  }

  async function doFill() {
    const siteId = document.getElementById('fillSiteSelect').value;
    const site = _sites.find(s => s.id === siteId);
    if (!site) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const settings = await Storage.getSettings();
    const btn = document.getElementById('doFillBtn');
    btn.disabled = true;
    btn.textContent = '检测中...';

    try {
      const scanResult = await requestScanWithRetry(tab.id, settings.deepseekApiKey);
      if (!scanResult) {
        showFillEmpty('检测失败，请刷新页面后重试');
        btn.disabled = false;
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> 检测并填充`;
        return;
      }

      _scanResults = scanResult;
      showPageInfo(tab, scanResult);
      renderMatchList(scanResult);
      updateFillActions();

      if (!scanResult.matches || !scanResult.matches.length) {
        showFillEmpty('未检测到可匹配的表单字段');
        btn.disabled = false;
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> 检测并填充`;
        return;
      }

      btn.textContent = '填充中...';
      const result = await chrome.tabs.sendMessage(tab.id, {
        type: 'DO_FILL',
        site,
        matches: scanResult.matches
      });
      const totalMatches = scanResult.matches.length;
      btn.textContent = `完成 (${result?.filled || 0}/${totalMatches} 个字段)`;
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> 检测并填充`;
      }, 2000);
    } catch (e) {
      console.error('[Popup] fill error:', e);
      btn.disabled = false;
      btn.textContent = '填充失败，请重试';
    }
  }

  // ── Settings Tab ─────────────────────────────────────────────
  async function loadSettings() {
    const s = await Storage.getSettings();
    document.getElementById('s-autoDetect').checked = s.autoDetect !== false;
    document.getElementById('s-showOverlay').checked = s.showOverlay !== false;
    document.getElementById('s-apiKey').value = s.deepseekApiKey || '';
  }

  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    await Storage.saveSettings({
      autoDetect: document.getElementById('s-autoDetect').checked,
      showOverlay: document.getElementById('s-showOverlay').checked,
      deepseekApiKey: document.getElementById('s-apiKey').value.trim()
    });
    const btn = document.getElementById('saveSettingsBtn');
    btn.textContent = '已保存';
    setTimeout(() => {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> 保存设置`;
    }, 2000);
  });

  document.getElementById('toggleApiKeyBtn').addEventListener('click', () => {
    const input = document.getElementById('s-apiKey');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // ── Helpers ──────────────────────────────────────────────────
  function v(id) {
    return (document.getElementById(id).value || '').trim();
  }

  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Init ─────────────────────────────────────────────────────
  loadSites();
  loadSettings();
  showFillEmpty('请选择网站后，点击“检测并填充”');
})();
