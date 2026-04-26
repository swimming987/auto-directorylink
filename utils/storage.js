const SITES_KEY = 'sites';
const SETTINGS_KEY = 'settings';

const DEFAULT_SETTINGS = {
  autoDetect: true,
  showOverlay: true,
  deepseekApiKey: ''
};

const Storage = {
  async getSites() {
    const result = await chrome.storage.local.get(SITES_KEY);
    return result[SITES_KEY] || [];
  },

  async saveSite(site) {
    const sites = await this.getSites();
    if (site.id) {
      const idx = sites.findIndex(s => s.id === site.id);
      if (idx !== -1) {
        sites[idx] = site;
      } else {
        sites.push(site);
      }
    } else {
      site.id = Date.now().toString();
      site.createdAt = new Date().toISOString();
      sites.push(site);
    }
    await chrome.storage.local.set({ [SITES_KEY]: sites });
    return site;
  },

  async deleteSite(id) {
    const sites = await this.getSites();
    const filtered = sites.filter(s => s.id !== id);
    await chrome.storage.local.set({ [SITES_KEY]: filtered });
  },

  async getSettings() {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    return Object.assign({}, DEFAULT_SETTINGS, result[SETTINGS_KEY] || {});
  },

  async saveSettings(settings) {
    const current = await this.getSettings();
    const merged = Object.assign({}, current, settings);
    await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
    return merged;
  }
};
