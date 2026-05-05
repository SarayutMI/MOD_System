// ============================================================
// Google Sheets API Module for NSM MOD System
// ============================================================

const GOOGLE_SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbxi4XFXGrm6T191ajwgR0Awvjusw8o2r_f_vPEXaX9WK0uHUfuTnf9B7HJ0AmPub2iPRQ/exec';

const CACHE_KEY_VOLUNTEERS  = 'nsm_cache_volunteers';
const CACHE_KEY_OFFICERS    = 'nsm_cache_officers';
const CACHE_KEY_TIMESTAMP   = 'nsm_cache_timestamp';
const CACHE_TTL_MS          = 60 * 60 * 1000; // 1 hour

// ============ Cache Helpers ============
function isCacheValid() {
  const ts = localStorage.getItem(CACHE_KEY_TIMESTAMP);
  if (!ts) return false;
  return (Date.now() - parseInt(ts)) < CACHE_TTL_MS;
}

function saveToCache(volunteers, officers) {
  try {
    localStorage.setItem(CACHE_KEY_VOLUNTEERS, JSON.stringify(volunteers));
    localStorage.setItem(CACHE_KEY_OFFICERS, JSON.stringify(officers));
    localStorage.setItem(CACHE_KEY_TIMESTAMP, String(Date.now()));
  } catch (e) {
    console.warn('Cache save failed:', e);
  }
}

function loadFromCache() {
  try {
    const volunteers = JSON.parse(localStorage.getItem(CACHE_KEY_VOLUNTEERS) || '[]');
    const officers   = JSON.parse(localStorage.getItem(CACHE_KEY_OFFICERS)   || '[]');
    return { volunteers, officers };
  } catch (e) {
    return { volunteers: [], officers: [] };
  }
}

function clearDropdownCache() {
  localStorage.removeItem(CACHE_KEY_VOLUNTEERS);
  localStorage.removeItem(CACHE_KEY_OFFICERS);
  localStorage.removeItem(CACHE_KEY_TIMESTAMP);
}

// ============ API Calls ============

/**
 * Fetch volunteers from Google Sheets (Volunteer_Name sheet)
 * @returns {Promise<string[]>} Array of volunteer names
 */
async function fetchVolunteers() {
  const url = getAPIURL();
  const res = await fetch(`${url}?action=getVolunteers`, { mode: 'cors' });
  const json = await res.json();
  if (json.status === 'success') {
    return (json.data || []).filter(v => v && v.name).map(v => v.name);
  }
  throw new Error(json.message || 'fetchVolunteers failed');
}

/**
 * Fetch officers from Google Sheets (officer sheet)
 * @returns {Promise<string[]>} Array of officer names
 */
async function fetchOfficers() {
  const url = getAPIURL();
  const res = await fetch(`${url}?action=getOfficers`, { mode: 'cors' });
  const json = await res.json();
  if (json.status === 'success') {
    return (json.data || []).filter(o => o && o.name).map(o => o.name);
  }
  throw new Error(json.message || 'fetchOfficers failed');
}

/**
 * Fetch all dropdown data (volunteers + officers) in one request
 * Uses cache if still valid; otherwise fetches from API and updates cache.
 * @param {boolean} forceRefresh - Skip cache and fetch fresh data
 * @returns {Promise<{volunteers: string[], officers: string[]}>}
 */
async function fetchAllDropdownData(forceRefresh = false) {
  if (!forceRefresh && isCacheValid()) {
    return loadFromCache();
  }
  const url = getAPIURL();
  const res = await fetch(`${url}?action=getAll`, { mode: 'cors' });
  const json = await res.json();
  if (json.status === 'success') {
    const volunteers = (json.data?.volunteers || []).filter(Boolean);
    const officers   = (json.data?.officers   || []).filter(Boolean);
    saveToCache(volunteers, officers);
    return { volunteers, officers };
  }
  throw new Error(json.message || 'fetchAllDropdownData failed');
}

/**
 * Save a daily record to Google Sheets (MOD_Data sheet)
 * @param {Object} data - The form data object from getFormData()
 * @returns {Promise<Object>} API response
 */
async function saveDailyRecord(data) {
  const url = getAPIURL();
  const payload = buildMODPayload('saveMODData', data);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message || 'saveDailyRecord failed');
  return json;
}

/**
 * Update an existing daily record in Google Sheets
 * @param {Object} data - The form data object from getFormData()
 * @returns {Promise<Object>} API response
 */
async function updateDailyRecord(data) {
  const url = getAPIURL();
  const payload = buildMODPayload('updateMODData', data);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message || 'updateDailyRecord failed');
  return json;
}

/**
 * Fetch data for a specific date from Google Sheets
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Object|null>} Record object or null if not found
 */
async function fetchDailyData(date) {
  const url = getAPIURL();
  const res = await fetch(`${url}?action=getDailyData&date=${encodeURIComponent(date)}`, { mode: 'cors' });
  const json = await res.json();
  if (json.status === 'success') return json.data || null;
  throw new Error(json.message || 'fetchDailyData failed');
}

/**
 * Fetch monthly summary data from Google Sheets
 * @param {number|string} year  - e.g. 2026
 * @param {number|string} month - 1-12
 * @returns {Promise<Object[]>} Array of daily records for the month
 */
async function fetchMonthlyData(year, month) {
  const url = getAPIURL();
  const mm = String(month).padStart(2, '0');
  const res = await fetch(`${url}?action=getMonthlyData&year=${year}&month=${mm}`, { mode: 'cors' });
  const json = await res.json();
  if (json.status === 'success') return json.data || [];
  throw new Error(json.message || 'fetchMonthlyData failed');
}

/**
 * Fetch officer activity statistics for a given month
 * @param {number|string} year
 * @param {number|string} month - 1-12
 * @returns {Promise<Object[]>} Array of {name, count, roles} objects
 */
async function fetchOfficerStats(year, month) {
  const url = getAPIURL();
  const mm = String(month).padStart(2, '0');
  const res = await fetch(`${url}?action=getOfficerStats&year=${year}&month=${mm}`, { mode: 'cors' });
  const json = await res.json();
  if (json.status === 'success') return json.data || [];
  throw new Error(json.message || 'fetchOfficerStats failed');
}

// ============ Internal Helpers ============

/** Get API URL from settings or fall back to default */
function getAPIURL() {
  try {
    const settings = JSON.parse(localStorage.getItem('nsm_settings') || '{}');
    return settings.sheetsURL || GOOGLE_SHEETS_API_URL;
  } catch (e) {
    return GOOGLE_SHEETS_API_URL;
  }
}

/**
 * Build the MOD_Data payload object for saving/updating.
 * Maps the internal form data structure to the Google Sheets column names.
 */
function buildMODPayload(action, data) {
  const va  = data.visAThai  || {};
  const vaf = data.visAFor   || {};
  const vam = data.visAMem   || {};
  const vb  = data.visBThai  || {};
  const vbf = data.visBFor   || {};
  const vbm = data.visBMem   || {};
  const vdi = data.visDIns   || {};
  const vdn = data.visDInv   || {};
  const vdw = data.visDWr    || {};
  const vdm = data.visDMm    || {};
  const vds = data.visDSp    || {};
  const vdo = data.visDOth   || {};
  const rev = data.rev       || {};
  const onl = data.online    || {};

  return {
    action,
    date: data.date || '',
    mod:  data.modMorning || '',
    mExhibition:    data.mExhibition  || '',
    mEducation:     data.mEducation   || '',
    mVisitorService: data.mVisitor    || '',
    // Walk-in
    walkInThaiChild:    (va.child  || 0),
    walkInThaiAdult:    (va.adult  || 0),
    walkInForeignChild: (vaf.child || 0),
    walkInForeignAdult: (vaf.adult || 0),
    // Members
    memberChild: (vam.child || 0),
    memberAdult: (vam.adult || 0),
    memberFC:    (vam.fc    || 0),
    memberFA:    (vam.fa    || 0),
    // Groups
    groupThaiChild:    (vb.child  || 0),
    groupThaiAdult:    (vb.adult  || 0),
    groupForeignChild: (vbf.child || 0),
    groupForeignAdult: (vbf.adult || 0),
    groupIC: (vbm.ic || 0),
    groupIA: (vbm.ia || 0),
    // Elderly
    senior: (data.visCsenior || 0),
    // Educational Activities
    inspireLab:    (vdi.tc||0)+(vdi.ta||0)+(vdi.fc||0)+(vdi.fa||0),
    innovationSpace: (vdn.tc||0)+(vdn.ta||0)+(vdn.fc||0)+(vdn.fa||0),
    walkRally:     (vdw.tc||0)+(vdw.ta||0)+(vdw.fc||0)+(vdw.fa||0),
    miniMakePlay:  (vdm.child1 || vdm.child || 0) + (vdm.child2 || 0),
    specialEvent:  (vds.tc||0)+(vds.ta||0)+(vds.fc||0)+(vds.fa||0),
    other:         (vdo.count || 0),
    // Totals
    totalVisitors: (data.totalVisitors || 0),
    // Revenue
    revenueExhibition: (rev.ex  || 0) + (onl.ex  || 0),
    revenueInspire:    (rev.ins || 0) + (onl.ins || 0),
    revenueInnovation: (rev.inv || 0) + (onl.inv || 0),
    revenueWalkRally:  (rev.wr  || 0) + (onl.wr  || 0),
    revenueMini:       (rev.mm  || 0) + (onl.mm  || 0),
    revenueSpecial:    (rev.sp  || 0) + (onl.sp  || 0),
    revenueMember:     (rev.mem || 0) + (onl.mem || 0),
    revenueOther:      (rev.oth || 0) + (onl.oth || 0),
    totalRevenue: (data.totalRevenue || 0),
    notes: data.notes || '',
    submittedAt: new Date().toISOString()
  };
}

// ============ Dropdown Population ============

/**
 * Populate all staff/volunteer dropdowns from cache or API.
 * Falls back to allowing manual text entry if API is unavailable.
 */
async function populateDropdowns() {
  let volunteers = [];
  let officers   = [];

  // Try cache first
  if (isCacheValid()) {
    const cached = loadFromCache();
    volunteers = cached.volunteers;
    officers   = cached.officers;
  }

  if (!volunteers.length && !officers.length) {
    try {
      const result = await fetchAllDropdownData(true);
      volunteers = result.volunteers;
      officers   = result.officers;
    } catch (e) {
      console.warn('Could not fetch dropdown data from API:', e.message);
      // Try to load from custom lists in settings
      try {
        const settings = JSON.parse(localStorage.getItem('nsm_settings') || '{}');
        volunteers = settings.customVolunteers || [];
        officers   = settings.customOfficers   || [];
      } catch (se) { /* ignore */ }
    }
  }

  // Store last sync timestamp for display
  if (volunteers.length || officers.length) {
    localStorage.setItem('nsm_last_sync', new Date().toISOString());
  }

  applyDropdownOptions(volunteers, officers);
  return { volunteers, officers };
}

/**
 * Apply dropdown options to all select elements in the form.
 */
function applyDropdownOptions(volunteers, officers) {
  // Officer dropdowns (MOD, M-Exhibition, M-Education, M-Visitor Service)
  const officerDropdowns = [
    'mod-morning-select',
    'm-exhibition-select',
    'm-education-select',
    'm-visitor-service-select'
  ];
  officerDropdowns.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const currentVal = sel.value;
    // Keep the first placeholder option
    sel.innerHTML = '<option value="">-- เลือกเจ้าหน้าที่ --</option>';
    officers.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
    // Restore value if still valid
    if (currentVal) sel.value = currentVal;
  });

  // Volunteer dropdowns (zone staff)
  const volunteerDropdowns = [
    'ex-z1-name', 'ex-z2-name', 'ex-z3-name', 'ex-z4-name',
    'ex-innovation-name', 'ex-inspire-name', 'ex-make-play1-name', 'ex-make-play2-name'
  ];
  volunteerDropdowns.forEach(baseId => {
    const sel = document.getElementById(baseId + '-select');
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">-- เลือกอาสาสมัคร --</option>';
    volunteers.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
    if (currentVal) sel.value = currentVal;
  });
}

/**
 * Force refresh dropdown data from API (ignores cache).
 */
async function refreshDropdownData() {
  clearDropdownCache();
  return await populateDropdowns();
}

// ============ Connection Status ============
async function checkConnection() {
  try {
    const url = getAPIURL();
    const res = await fetch(`${url}?action=ping`, { mode: 'cors', signal: AbortSignal.timeout(5000) });
    const json = await res.json();
    return json.status === 'success' || json.status === 'ok';
  } catch (e) {
    return false;
  }
}

// Expose to global scope
window.GoogleSheetsAPI = {
  fetchVolunteers,
  fetchOfficers,
  fetchAllDropdownData,
  saveDailyRecord,
  updateDailyRecord,
  fetchDailyData,
  fetchMonthlyData,
  fetchOfficerStats,
  populateDropdowns,
  refreshDropdownData,
  checkConnection,
  clearDropdownCache,
  isCacheValid,
  getLastSyncTime: () => localStorage.getItem('nsm_last_sync')
};
