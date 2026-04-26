const SOCIAL_MEDIA_BLACKLIST = [
  'facebook', 'twitter', 'linkedin', 'instagram', 'youtube', 'github',
  'tiktok', 'pinterest', 'reddit', 'discord', 'telegram', 'whatsapp',
  'wechat', 'weibo', 'douyin', 'bilibili', 'xiaohongshu'
];

const MEDIA_FIELD_BLACKLIST = [
  'demo video',
  'explainer video',
  'product video',
  'promo video',
  'video url'
];

function extractSignals(el) {
  const signals = [];

  const attrs = ['name', 'id', 'placeholder', 'aria-label', 'data-field', 'data-name', 'class'];
  for (const attr of attrs) {
    const val = el.getAttribute(attr);
    const normalized = normalizeSignalText(val);
    if (normalized && normalized.length < 120) signals.push(normalized);
  }

  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`);
    if (label) {
      const normalized = normalizeSignalText(label.textContent);
      if (normalized) signals.push(normalized);
    }
  }

  signals.push(...getAriaReferenceTexts(el, 'aria-labelledby'));
  signals.push(...getAriaReferenceTexts(el, 'aria-describedby'));

  const group = el.closest('.input-group, .form-group, [role="group"]');
  if (group) {
    const groupLabel = group.querySelector('label');
    if (groupLabel) {
      const normalized = normalizeSignalText(groupLabel.textContent);
      if (normalized) signals.push(normalized);
    }
  }

  const parent = el.closest('div, li, td, p');
  if (parent) {
    const labels = parent.querySelectorAll(':scope > label, :scope > span, :scope > p, :scope > legend, :scope > h2, :scope > h3, :scope > h4');
    for (const lbl of labels) {
      const txt = normalizeSignalText(lbl.textContent);
      if (txt && txt.length < 60) signals.push(txt);
    }
  }

  return Array.from(new Set(signals.filter(Boolean)));
}

function normalizeSignalText(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\b\d+\s*\/\s*\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAriaReferenceTexts(el, attrName) {
  const value = el.getAttribute(attrName);
  if (!value) return [];

  const ids = value.split(/\s+/).map(s => s.trim()).filter(Boolean);
  const texts = [];
  for (const id of ids) {
    const node = document.getElementById(id);
    if (!node) continue;
    const txt = normalizeSignalText(node.textContent);
    if (txt && txt.length < 120) texts.push(txt);
  }
  return texts;
}

function matchByContextPriority(signals, el) {
  const text = signals.join(' ').toLowerCase();
  const inputType = (el.getAttribute('type') || '').toLowerCase();
  const tagName = el.tagName.toLowerCase();

  if (tagName === 'textarea') {
    const hasDescriptionContext =
      text.includes('full startup description') ||
      text.includes('long description') ||
      text.includes('detailed description') ||
      text.includes('description') ||
      text.includes('about') ||
      text.includes('详情') ||
      text.includes('详细描述') ||
      text.includes('描述');

    if (hasDescriptionContext) {
      const isShortDescription =
        text.includes('short description') ||
        text.includes('brief') ||
        text.includes('summary') ||
        text.includes('excerpt') ||
        text.includes('简介') ||
        text.includes('简短描述') ||
        text.includes('摘要');

      if (isShortDescription) {
        return { field: 'shortDescription', confidence: 0.98, source: 'rule' };
      }

      const rows = parseInt(el.getAttribute('rows') || '', 10);
      const maxLength = parseInt(el.getAttribute('maxlength') || '', 10);
      const hasLongHint =
        text.includes('full') ||
        text.includes('long') ||
        text.includes('detailed') ||
        text.includes('characters max') ||
        text.includes('2500');

      if (hasLongHint || (Number.isFinite(rows) && rows >= 4) || (Number.isFinite(maxLength) && maxLength >= 300)) {
        return { field: 'longDescription', confidence: 0.99, source: 'rule' };
      }

      return { field: 'longDescription', confidence: 0.95, source: 'rule' };
    }
  }

  const isUrlLikeContext =
    text.includes('site link') ||
    text.includes('website link') ||
    text.includes('url question') ||
    text.includes('website') ||
    text.includes('homepage') ||
    text.includes('official site');

  const isSpecialAssetUrl =
    text.includes('icon') ||
    text.includes('logo') ||
    text.includes('screenshot') ||
    text.includes('image') ||
    text.includes('cover') ||
    text.includes('banner') ||
    text.includes('thumbnail') ||
    text.includes('avatar') ||
    text.includes('video');

  if (inputType === 'url' && isUrlLikeContext && !isSpecialAssetUrl) {
    return { field: 'url', confidence: 0.99, source: 'rule' };
  }

  if (text.includes('site link') || text.includes('website link') || text.includes('url question')) {
    return { field: 'url', confidence: 0.98, source: 'rule' };
  }

  if (text.includes('your name') || text.includes('submitter name') || text.includes('contact name')) {
    return { field: 'yourName', confidence: 0.98, source: 'rule' };
  }

  if (text.includes('your email') || text.includes('submitter email') || text.includes('contact email')) {
    return { field: 'yourEmail', confidence: 0.98, source: 'rule' };
  }

  if (inputType === 'email' && text.includes('your')) {
    return { field: 'yourEmail', confidence: 0.95, source: 'rule' };
  }

  return null;
}

function isSocialMediaField(signals) {
  const text = signals.join(' ').toLowerCase();
  return SOCIAL_MEDIA_BLACKLIST.some(keyword => text.includes(keyword));
}

function isIgnoredMediaField(signals) {
  const text = signals.join(' ').toLowerCase();
  return MEDIA_FIELD_BLACKLIST.some(keyword => text.includes(keyword));
}

function isVisible(el) {
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
}

function scanFormElements() {
  const elements = [];
  const selectors = 'input:not([type="file"]):not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]), textarea, select';
  const found = document.querySelectorAll(selectors);
  for (const el of found) {
    if (isVisible(el)) elements.push(el);
  }
  return elements;
}

async function matchElements(elements) {
  const results = [];

  for (const el of elements) {
    const signals = extractSignals(el);
    if (!signals.length) continue;

    if (isSocialMediaField(signals)) continue;
    if (isIgnoredMediaField(signals)) continue;

    const contextResult = matchByContextPriority(signals, el);
    const ruleResult = contextResult || matchByRules(signals);

    if (ruleResult.confidence >= CONFIDENCE_THRESHOLD) {
      results.push({ el, ...ruleResult, signals });
    } else {
      results.push({ el, field: null, confidence: ruleResult.confidence, source: 'unmatched', signals });
    }
  }

  return deduplicateFields(results);
}

function deduplicateFields(results) {
  const fieldMap = new Map();
  const emailCandidates = [];
  
  for (const result of results) {
    if (!result.field) continue;

    if (result.field === 'email') {
      emailCandidates.push(result);
      continue;
    }
    
    const existing = fieldMap.get(result.field);
    if (!existing || isBetterCandidate(result, existing)) {
      fieldMap.set(result.field, result);
    }
  }

  const selectedEmail = selectEmailCandidates(emailCandidates);
  
  const deduplicated = [...Array.from(fieldMap.values()), ...selectedEmail];
  const unmatched = results.filter(r => !r.field);
  
  return [...deduplicated, ...unmatched];
}

function selectEmailCandidates(candidates) {
  if (!candidates.length) return [];

  const productEmailCandidates = candidates.filter(isProductEmailCandidate);
  if (productEmailCandidates.length) {
    return productEmailCandidates;
  }

  let best = candidates[0];
  for (const candidate of candidates.slice(1)) {
    if (isBetterCandidate(candidate, best)) {
      best = candidate;
    }
  }
  return [best];
}

function isProductEmailCandidate(result) {
  const text = (result.signals || []).join(' ').toLowerCase();
  return text.includes('product email') || text.includes('business email') || text.includes('work email');
}

function isBetterCandidate(candidate, existing) {
  if (candidate.confidence !== existing.confidence) {
    return candidate.confidence > existing.confidence;
  }

  if (candidate.field === 'email') {
    return getEmailPriority(candidate) > getEmailPriority(existing);
  }

  return false;
}

function getEmailPriority(result) {
  const text = (result.signals || []).join(' ').toLowerCase();
  let score = 0;

  if (text.includes('product email') || text.includes('business email') || text.includes('work email')) {
    score += 3;
  }
  if (text.includes('product') || text.includes('business') || text.includes('company')) {
    score += 2;
  }
  if (text.includes('contact email')) {
    score += 1;
  }

  return score;
}

async function matchElementsWithAI(elements, apiKey) {
  const results = await matchElements(elements);
  const unmatched = results.filter(r => r.field === null);

  if (!unmatched.length || !apiKey) return results;

  const payload = unmatched.map((r, i) => ({
    index: i,
    signals: r.signals,
    tagName: r.el.tagName.toLowerCase(),
    type: r.el.getAttribute('type') || ''
  }));

  try {
    const aiMatches = await chrome.runtime.sendMessage({
      type: 'AI_MATCH',
      payload,
      fieldKeys: Object.keys(FIELD_RULES)
    });

    if (aiMatches && Array.isArray(aiMatches)) {
      for (const match of aiMatches) {
        const target = unmatched[match.index];
        if (target && match.field) {
          target.field = match.field;
          target.confidence = match.confidence;
          target.source = 'ai';
        }
      }
    }
  } catch (e) {
    console.warn('[Matcher] AI match failed:', e);
  }

  return results;
}
