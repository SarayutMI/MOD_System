// MOD System - Google Sheets API Module v2.0

(function attachModAPI() {
  // Replace YOUR_APPS_SCRIPT_DEPLOYMENT_ID_HERE with your deployed Apps Script Web App URL,
  // or simply configure the URL from the in-app Settings page after deployment.
  const DEFAULT_API_URL = 'https://script.google.com/macros/s/YOUR_APPS_SCRIPT_DEPLOYMENT_ID_HERE/exec';
  const SETTINGS_KEY = 'mod_settings_v2';
  const CACHE_KEY = 'mod_lookup_cache_v2';
  const CACHE_TTL_MS = 60 * 60 * 1000;

  function getSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function getAPIURL() {
    const settings = getSettings();
    return settings.apiUrl || DEFAULT_API_URL;
  }

  function ensureConfiguredURL(url) {
    if (!url || url.includes('YOUR_APPS_SCRIPT_DEPLOYMENT_ID_HERE')) {
      throw new Error('Please configure the Google Apps Script Web App URL in Settings before using the API.');
    }
    return url;
  }

  function getCachedLookups() {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!cache || !cache.timestamp) return null;
      if (Date.now() - cache.timestamp > CACHE_TTL_MS) return null;
      return cache.data;
    } catch (error) {
      return null;
    }
  }

  function setCachedLookups(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
    } catch (error) {
      console.warn('Lookup cache unavailable', error);
    }
  }

  async function parseResponse(response) {
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new Error(text || 'Invalid API response');
    }
    if (!response.ok || payload.status !== 'success') {
      throw new Error(payload.message || `Request failed (${response.status})`);
    }
    return payload.data !== undefined ? payload.data : payload;
  }

  async function getRequest(params) {
    const url = new URL(ensureConfiguredURL(getAPIURL()));
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    });
    const response = await fetch(url.toString(), { method: 'GET', mode: 'cors' });
    return parseResponse(response);
  }

  async function postRequest(payload) {
    const response = await fetch(ensureConfiguredURL(getAPIURL()), {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    return parseResponse(response);
  }

  window.ModAPI = {
    async getLookups(forceRefresh = false) {
      if (!forceRefresh) {
        const cached = getCachedLookups();
        if (cached) return cached;
      }
      const data = await getRequest({ action: 'getLookups' });
      setCachedLookups(data);
      return data;
    },

    async getSection(section, date) {
      return getRequest({ action: 'getSection', section, date });
    },

    async getFullDay(date) {
      return getRequest({ action: 'getFullDay', date });
    },

    async getDashboard(startDate, endDate) {
      return getRequest({ action: 'getDashboard', startDate, endDate });
    },

    async saveSection(section, date, data) {
      return postRequest({ action: 'saveSection', section, date_key: date, data });
    },

    async saveGroups(date, groupsArray) {
      return postRequest({ action: 'saveGroups', date_key: date, groups: groupsArray });
    },

    async saveLabRows(roomType, date, rowsArray) {
      return postRequest({ action: 'saveLabRows', roomType, date_key: date, rows: rowsArray });
    },

    async initSheets() {
      const settings = getSettings();
      return postRequest({ action: 'initSheets', spreadsheetId: settings.spreadsheetId || '' });
    },

    async checkConnection() {
      return getRequest({ action: 'ping' });
    },

    getAPIURL
  };
})();
