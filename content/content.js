(function () {
  'use strict';

  const FIELD_LABELS = {
    name: 'Name',
    url: 'URL',
    blogUrl: 'Blog URL',
    email: 'Product Email',
    yourName: 'Your Name',
    yourEmail: 'Your Email',
    icon: 'Icon',
    screenshot: 'Screenshot',
    launchDate: 'Launch Date',
    shortDescription: 'Short Description',
    longDescription: 'Long Description',
    tagline: 'Tagline',
    slogan: 'Slogan',
    useCase: 'Use Case',
    categories: 'Categories',
    priceModel: 'Price Model',
    lowestPrice: 'Lowest Price'
  };

  let _matchResults = [];
  let _currentSite = null;
  let _fillIdSeed = 1;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCAN_PAGE') {
      handleScan(message.apiKey).then(sendResponse);
      return true;
    }
    if (message.type === 'DO_FILL') {
      handleFill(message.site, message.matches).then(sendResponse);
      return true;
    }
    if (message.type === 'GET_SCAN_RESULTS') {
      sendResponse(_matchResults);
    }
  });

  async function handleScan(apiKey) {
    const elements = scanFormElements();
    const results = await matchElementsWithAI(elements, apiKey);
    _matchResults = results.filter(r => r.field !== null).map(r => {
      const el = r.el;
      return {
        field: r.field,
        confidence: r.confidence,
        source: r.source,
        elIndex: elements.indexOf(el),
        fillId: assignFillId(el),
        pageLabel: getElementLabel(el)
      };
    });
    return {
      formCount: document.querySelectorAll('form').length,
      fieldCount: _matchResults.length,
      matches: _matchResults.map(m => ({
        field: m.field,
        confidence: m.confidence,
        source: m.source,
        pageLabel: m.pageLabel
      }))
    };
  }

  function assignFillId(el) {
    let fillId = el.getAttribute('data-lsa-fill-id');
    if (!fillId) {
      fillId = `lsa-${Date.now()}-${_fillIdSeed++}`;
      el.setAttribute('data-lsa-fill-id', fillId);
    }
    return fillId;
  }

  function getElementLabel(el) {
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label) return label.textContent.trim();
    }
    const parent = el.closest('div, li, td');
    if (parent) {
      const label = parent.querySelector('label');
      if (label) return label.textContent.trim();
    }
    return el.getAttribute('placeholder') || el.getAttribute('name') || '';
  }

  function findElementByFillId(fillId) {
    if (!fillId) return null;
    try {
      return document.querySelector(`[data-lsa-fill-id="${fillId}"]`);
    } catch (e) {
      console.warn('[Content] Invalid fillId selector:', fillId);
      return null;
    }
  }

  async function handleFill(site, matches) {
    let filled = 0;

    if (!_matchResults || _matchResults.length === 0) {
      console.warn('[Content] No match results available, please scan first');
      return { filled: 0 };
    }

    const elements = scanFormElements();

    for (const match of _matchResults) {
      const el = findElementByFillId(match.fillId) || elements[match.elIndex];
      if (!el) {
        console.warn(`[Content] Element not found for ${match.field}`);
        continue;
      }

      const value = getSiteValue(site, match.field);
      if (value === null || value === undefined || value === '') {
        console.warn(`[Content] Skip ${match.field}: no value in site config`);
        continue;
      }

      console.log(`[Content] Attempting to fill ${match.field} with:`, value);
      const success = await fillElement(el, value, site);
      if (success) {
        filled++;
        console.log(`[Content] ✓ Filled ${match.field}`);
      } else {
        console.warn(`[Content] ✗ Failed to fill ${match.field}`);
      }
    }

    return { filled };
  }

  function getSiteValue(site, field) {
    const map = {
      name: site.name,
      url: site.url,
      blogUrl: site.blogUrl,
      email: site.email || site.yourEmail,
      yourName: site.yourName,
      yourEmail: site.yourEmail || site.email,
      icon: site.icon,
      screenshot: site.screenshot,
      launchDate: site.launchDate,
      shortDescription: site.shortDescription,
      longDescription: site.longDescription,
      tagline: site.tagline,
      slogan: site.slogan,
      useCase: site.useCase,
      categories: Array.isArray(site.categories) ? site.categories.join(', ') : site.categories,
      priceModel: site.priceModel,
      lowestPrice: site.lowestPrice
    };
    return map[field] !== undefined ? map[field] : null;
  }

  async function fillElement(el, value, site) {
    const tag = el.tagName.toLowerCase();

    if (tag === 'select') {
      return fillSelect(el, value);
    }

    if (tag === 'input' || tag === 'textarea') {
      return fillInput(el, value);
    }

    return false;
  }

  function fillInput(el, value) {
    try {
      if (el.readOnly || el.disabled) {
        console.warn('[Content] Skip readonly/disabled field:', el);
        return false;
      }

      el.focus();
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        'value'
      ).set;
      nativeInputValueSetter.call(el, value);
      
      el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      
      el.blur();
      return true;
    } catch (e) {
      console.warn('[Content] fillInput error:', e);
      return false;
    }
  }

  function fillSelect(el, value) {
    try {
      const normalizedValue = value.toLowerCase().trim();
      let bestOption = null;
      let bestScore = 0;

      for (const opt of el.options) {
        const optText = opt.textContent.trim().toLowerCase();
        const optVal = opt.value.toLowerCase();

        let score = 0;
        if (optText === normalizedValue || optVal === normalizedValue) {
          score = 1.0;
        } else if (optText.includes(normalizedValue) || normalizedValue.includes(optText)) {
          score = 0.7;
        } else if (optVal.includes(normalizedValue) || normalizedValue.includes(optVal)) {
          score = 0.6;
        }

        if (score > bestScore) {
          bestScore = score;
          bestOption = opt;
        }
      }

      const targetOption = bestOption || el.options[0];
      if (targetOption) {
        el.value = targetOption.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[Content] fillSelect error:', e);
      return false;
    }
  }

  async function fillCustomCheckboxDropdown(container, value) {
    try {
      const trigger = container.querySelector('[role="combobox"], [aria-haspopup], .dropdown-toggle, button');
      if (trigger) {
        trigger.click();
        await sleep(300);
      }

      const normalizedValue = value.toLowerCase().trim();
      const valueList = normalizedValue.split(',').map(v => v.trim());

      const options = container.querySelectorAll('[role="option"], [role="menuitem"], li');
      let clicked = 0;

      for (const opt of options) {
        const text = opt.textContent.trim().toLowerCase();
        const checkbox = opt.querySelector('input[type="checkbox"]');

        for (const val of valueList) {
          if (text.includes(val) || val.includes(text)) {
            if (checkbox && !checkbox.checked) {
              checkbox.click();
              clicked++;
              await sleep(100);
            } else if (!checkbox) {
              opt.click();
              clicked++;
              await sleep(100);
            }
            break;
          }
        }
      }

      return clicked > 0;
    } catch (e) {
      console.warn('[Content] fillCustomCheckboxDropdown error:', e);
      return false;
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  window.__linkSubmitterFillCustomDropdown = fillCustomCheckboxDropdown;
  window.__linkSubmitterFieldLabels = FIELD_LABELS;
  window.__linkSubmitterScanAndFill = async ({ site, apiKey } = {}) => {
    if (!site) return { error: 'NO_SITE' };
    _currentSite = site;
    const scanResult = await handleScan(apiKey);
    if (!scanResult || !scanResult.matches || scanResult.matches.length === 0) {
      return { scanResult, fillResult: { filled: 0 } };
    }
    const fillResult = await handleFill(site, scanResult.matches);
    return { scanResult, fillResult };
  };
})();
