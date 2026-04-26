const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

function ensureSidePanelBehavior() {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(err => {
      console.warn('[Background] Failed to set side panel behavior:', err);
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  ensureSidePanelBehavior();
});

ensureSidePanelBehavior();

chrome.action.onClicked.addListener(async (tab) => {
  if (!chrome.sidePanel || !chrome.sidePanel.open || !tab?.windowId) return;
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (err) {
    console.warn('[Background] Failed to open side panel on action click:', err);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AI_MATCH') {
    handleAiMatch(message).then(sendResponse).catch(err => {
      console.error('[Background] AI match error:', err);
      sendResponse(null);
    });
    return true;
  }
});

async function handleAiMatch({ payload, fieldKeys }) {
  const result = await chrome.storage.local.get('settings');
  const settings = result.settings || {};
  const apiKey = settings.deepseekApiKey;

  if (!apiKey) return null;

  const prompt = buildPrompt(payload, fieldKeys);

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a form field classifier for web forms. Given form field signals (name, id, placeholder, label text), map each field to the most appropriate key from the provided list. Respond with JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '';

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn('[Background] Failed to parse AI response:', text);
  }

  return null;
}

function buildPrompt(payload, fieldKeys) {
  const fieldsDesc = fieldKeys.join(', ');
  const items = payload.map(item =>
    `Index ${item.index}: tag="${item.tagName}", type="${item.type}", signals=${JSON.stringify(item.signals)}`
  ).join('\n');

  return `Map each form field to one of these keys: ${fieldsDesc}

Fields to classify:
${items}

Respond ONLY with a JSON array like:
[{"index": 0, "field": "name", "confidence": 0.85}, ...]

If a field doesn't match any key, omit it from the array. Confidence should be 0.0-1.0.`;
}
