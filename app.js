const AppState = {
  currentPage: 'assignments',
  currentDate: todayISO(),
  isLoading: false,
  isExistingData: false,
  data: {
    assignments: null,
    walkin: null,
    groups: [],
    additional: null,
    inspire: [],
    innovation: [],
    pos: null,
    summary: null
  },
  lookups: { officers: [], volunteers: [], lab_ac_names: [], inno_ac_names: [] }
};

const SETTINGS_KEY = 'mod_settings_v2';
const AUTH_KEY = 'mod_auth_session_v2';
const PAGE_META = {
  assignments: { title: 'Daily Management (Morning)', subtitle: 'กำหนดเจ้าหน้าที่และอาสาสมัครประจำวันตามวันที่เลือก' },
  exhibition: { title: 'M-Exhibition Cal', subtitle: 'คำนวณผู้เข้าชมและกิจกรรมแบบเรียลไทม์' },
  pos: { title: 'POS Data Management', subtitle: 'แสดงค่า POS Summary ที่คำนวณจากข้อมูลรายวัน' },
  summary: { title: 'Summary Day (Evening)', subtitle: 'สรุปผลทั้งวัน ปัญหา และตัวเลขสำคัญ' },
  settings: { title: 'Settings', subtitle: 'จัดการการเชื่อมต่อ Google Apps Script และข้อมูลผู้ใช้' }
};
const DEFAULT_SETTINGS = { apiUrl: '', spreadsheetId: '', username: 'admin', passwordHash: '' };

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function init() {
  fillSettingsForm(loadSettings());
  setupEventListeners();
  updateConnectionBadge();
  byId('global-date').value = AppState.currentDate;
  updateDateLabels();
  updateAuthUI();
  if (isLoggedIn()) bootstrapApp();
}

async function bootstrapApp() {
  byId('login-screen').classList.add('hidden');
  byId('app-shell').classList.remove('hidden');
  byId('sidebar-username').textContent = loadSettings().username || 'ผู้ดูแลระบบ';
  gotoPage(AppState.currentPage);
  try { await loadLookups(); } catch (_) { /* warnings already shown inside loadLookups */ }
  await loadAllSections(AppState.currentDate);
}

async function setDate(dateStr) {
  if (!dateStr) return;
  AppState.currentDate = dateStr;
  byId('global-date').value = dateStr;
  updateDateLabels();
  await loadAllSections(dateStr);
}

async function loadAllSections(date) {
  const sections = ['assignments', 'walkin', 'groups', 'additional', 'inspire', 'innovation', 'pos', 'summary'];
  showProgress('กำลังโหลดข้อมูลประจำวัน...');
  setLoading(true);
  updateDataModeIndicator(null);
  try {
    let payload;
    try {
      payload = await window.ModAPI.getFullDay(date);
    } catch (error) {
      const results = await Promise.all(sections.map(async (section) => ({ section, data: await loadSection(section, date, false) })));
      payload = results.reduce((acc, item) => ((acc[item.section] = item.data), acc), {});
    }
    const hasExistingData = payload && sections.filter((s) => s !== 'pos').some((key) => {
      const val = payload[key];
      if (Array.isArray(val)) return val.length > 0;
      return val !== null && val !== undefined;
    });
    AppState.isExistingData = Boolean(hasExistingData);
    AppState.data = normalizeFullDay(payload || {});
    populateAllForms();
    recalculateAll();
    const dateLabel = formatDate(date);
    updateDataModeIndicator(AppState.isExistingData);
    showToast(hasExistingData ? `พบข้อมูลวันที่ ${dateLabel} — โหมดแก้ไข` : `ไม่พบข้อมูลวันที่ ${dateLabel} — บันทึกข้อมูลใหม่`, hasExistingData ? 'warning' : 'success');
  } catch (error) {
    console.error(error);
    AppState.isExistingData = false;
    AppState.data = normalizeFullDay({});
    populateAllForms();
    recalculateAll();
    updateDataModeIndicator(false);
    showToast(error.message || 'ไม่สามารถโหลดข้อมูลได้', 'error');
  } finally {
    setLoading(false);
    hideProgress();
  }
}

async function loadSection(section, date, shouldPopulate = true) {
  const data = await window.ModAPI.getSection(section, date);
  AppState.data[section] = data;
  if (shouldPopulate) {
    populateForm(section, data);
    recalculateAll();
  }
  return data;
}

async function saveSection(section) {
  const activeSection = section === 'current' ? mapPageToSaveTarget(AppState.currentPage) : section;
  showProgress('กำลังบันทึกข้อมูล...');
  setAutosaveIndicator('saving', 'กำลังบันทึก');
  try {
    if (activeSection === 'assignments') {
      const data = getFormData('assignments');
      await window.ModAPI.saveSection('assignments', AppState.currentDate, data);
      AppState.data.assignments = data;
    } else if (activeSection === 'exhibition') {
      const walkin = getFormData('walkin');
      const groups = getFormData('groups');
      const additional = getFormData('additional');
      const inspire = getFormData('inspire');
      const innovation = getFormData('innovation');
      const pos = getFormData('pos');
      await Promise.all([
        window.ModAPI.saveSection('walkin', AppState.currentDate, walkin),
        window.ModAPI.saveGroups(AppState.currentDate, groups),
        window.ModAPI.saveSection('additional', AppState.currentDate, additional),
        window.ModAPI.saveLabRows('inspire', AppState.currentDate, inspire),
        window.ModAPI.saveLabRows('innovation', AppState.currentDate, innovation),
        window.ModAPI.saveSection('pos', AppState.currentDate, pos)
      ]);
      Object.assign(AppState.data, { walkin, groups, additional, inspire, innovation, pos });
    } else if (activeSection === 'pos') {
      const pos = getFormData('pos');
      await window.ModAPI.saveSection('pos', AppState.currentDate, pos);
      AppState.data.pos = pos;
    } else if (activeSection === 'summary') {
      const summary = getFormData('summary');
      await window.ModAPI.saveSection('summary', AppState.currentDate, summary);
      AppState.data.summary = summary;
    }
    setAutosaveIndicator('saved', 'บันทึกแล้ว');
    const saveLabel = AppState.isExistingData ? 'อัปเดตข้อมูลสำเร็จ' : 'บันทึกข้อมูลใหม่สำเร็จ';
    AppState.isExistingData = true;
    updateDataModeIndicator(true);
    showToast(saveLabel, 'success');
  } catch (error) {
    console.error(error);
    setAutosaveIndicator('error', 'บันทึกล้มเหลว');
    showToast(error.message || 'บันทึกข้อมูลไม่สำเร็จ', 'error');
  } finally {
    hideProgress();
  }
}

function populateAllForms() {
  populateForm('assignments', AppState.data.assignments);
  populateForm('walkin', AppState.data.walkin);
  populateForm('groups', AppState.data.groups);
  populateForm('additional', AppState.data.additional);
  populateForm('inspire', AppState.data.inspire);
  populateForm('innovation', AppState.data.innovation);
  populateForm('summary', AppState.data.summary);
  renderAssignmentsSummary();
}

function populateForm(section, data) {
  switch (section) {
    case 'assignments': {
      const source = data || defaultAssignments();
      setValue('mo-officer', source.mo_officer || '');
      setValue('mex-officer', source.mex_officer || '');
      setValue('med-officer', source.med_officer || '');
      setValue('mvi-officer', source.mvi_officer || '');
      setValue('z1f-volunteer', source.z1f_volunteer || '');
      setValue('zino-volunteer', source.zino_volunteer || '');
      setValue('z2f-volunteer', source.z2f_volunteer || '');
      setValue('zmp-volunteer', source.zmp_volunteer || '');
      setValue('zinl-volunteer', source.zinl_volunteer || '');
      setValue('other-activity-note', source.other_activity_note || '');
      break;
    }
    case 'walkin': {
      const source = data || defaultWalkin();
      ['mor-th-kids', 'mor-th-adults', 'mor-fr-kids', 'mor-fr-adults', 'eve-th-kids', 'eve-th-adults', 'eve-fr-kids', 'eve-fr-adults'].forEach((id) => setValue(id, source[id.replace(/-/g, '_')] ?? 0));
      break;
    }
    case 'groups': {
      buildIndexedRows(data, 10, 'group_index').forEach((row, index) => {
        const i = index + 1;
        setValue(`group-name-${i}`, row.group_name || '');
        setValue(`g-kids-${i}`, row.g_kids ?? 0);
        setValue(`g-adults-${i}`, row.g_adults ?? 0);
      });
      break;
    }
    case 'additional': {
      const source = data || defaultAdditional();
      setValue('ac-walk-r-kids', source.ac_walk_r_kids ?? 0);
      setValue('ac-walk-r-adults', source.ac_walk_r_adults ?? 0);
      setValue('ac-mmap-kids', source.ac_mmap_kids ?? 0);
      setValue('ac-mmap-adults', source.ac_mmap_adults ?? 0);
      setValue('ac-etcac-kids', source.ac_etcac_kids ?? 0);
      setValue('ac-etcac-adults', source.ac_etcac_adults ?? 0);
      setValue('activity-notes', source.activity_notes || '');
      break;
    }
    case 'inspire': populateLabRows('insl', data); break;
    case 'innovation': populateLabRows('inns', data); break;
    case 'summary': {
      const source = data || defaultSummary();
      setValue('issue-mo', source.issue_mo || '');
      setValue('issue-mex', source.issue_mex || '');
      setValue('issue-med', source.issue_med || '');
      setValue('issue-mvi', source.issue_mvi || '');
      setValue('issue-insl', source.issue_insl || '');
      setValue('issue-inns', source.issue_inns || '');
      setValue('summary-notes', source.summary_notes || '');
      break;
    }
  }
}

function getFormData(section) {
  switch (section) {
    case 'assignments': return { mo_officer: valueOf('mo-officer'), mex_officer: valueOf('mex-officer'), med_officer: valueOf('med-officer'), mvi_officer: valueOf('mvi-officer'), z1f_volunteer: valueOf('z1f-volunteer'), zino_volunteer: valueOf('zino-volunteer'), z2f_volunteer: valueOf('z2f-volunteer'), zmp_volunteer: valueOf('zmp-volunteer'), zinl_volunteer: valueOf('zinl-volunteer'), other_activity_note: valueOf('other-activity-note') };
    case 'walkin': return { mor_th_kids: numVal('mor-th-kids'), mor_th_adults: numVal('mor-th-adults'), mor_fr_kids: numVal('mor-fr-kids'), mor_fr_adults: numVal('mor-fr-adults'), eve_th_kids: numVal('eve-th-kids'), eve_th_adults: numVal('eve-th-adults'), eve_fr_kids: numVal('eve-fr-kids'), eve_fr_adults: numVal('eve-fr-adults') };
    case 'groups': return Array.from({ length: 10 }, (_, index) => ({ group_index: index + 1, group_name: valueOf(`group-name-${index + 1}`), g_kids: numVal(`g-kids-${index + 1}`), g_adults: numVal(`g-adults-${index + 1}`) }));
    case 'additional': return { ac_walk_r_kids: numVal('ac-walk-r-kids'), ac_walk_r_adults: numVal('ac-walk-r-adults'), ac_mmap_kids: numVal('ac-mmap-kids'), ac_mmap_adults: numVal('ac-mmap-adults'), ac_etcac_kids: numVal('ac-etcac-kids'), ac_etcac_adults: numVal('ac-etcac-adults'), activity_notes: valueOf('activity-notes') };
    case 'inspire': return collectLabRows('insl');
    case 'innovation': return collectLabRows('inns');
    case 'pos': return calcPOSSummary();
    case 'summary': return { issue_mo: valueOf('issue-mo'), issue_mex: valueOf('issue-mex'), issue_med: valueOf('issue-med'), issue_mvi: valueOf('issue-mvi'), issue_insl: valueOf('issue-insl'), issue_inns: valueOf('issue-inns'), summary_notes: valueOf('summary-notes') };
    default: return {};
  }
}

function calcWalkInTotals() {
  const sumThKids = numVal('mor-th-kids') + numVal('eve-th-kids');
  const sumThAdults = numVal('mor-th-adults') + numVal('eve-th-adults');
  const sumFrKids = numVal('mor-fr-kids') + numVal('eve-fr-kids');
  const sumFrAdults = numVal('mor-fr-adults') + numVal('eve-fr-adults');
  const sumWalkKids = sumThKids + sumFrKids;
  const sumWalkAdults = sumThAdults + sumFrAdults;
  setText('sum-th-kids', sumThKids); setText('sum-th-adults', sumThAdults); setText('sum-fr-kids', sumFrKids); setText('sum-fr-adults', sumFrAdults); setText('sum-walk-kids', sumWalkKids); setText('sum-walk-adults', sumWalkAdults);
  setText('summary-walk-th-kids', sumThKids); setText('summary-walk-th-adults', sumThAdults); setText('summary-walk-fr-kids', sumFrKids); setText('summary-walk-fr-adults', sumFrAdults);
  AppState.data.walkin = getFormData('walkin');
  return { sumThKids, sumThAdults, sumFrKids, sumFrAdults, sumWalkKids, sumWalkAdults };
}

function calcGroupTotals() {
  let count = 0, kids = 0, adults = 0;
  for (let i = 1; i <= 10; i += 1) {
    if (valueOf(`group-name-${i}`)) count += 1;
    kids += numVal(`g-kids-${i}`);
    adults += numVal(`g-adults-${i}`);
  }
  setText('number-of-groups', count); setText('sum-group-kids', kids); setText('sum-group-adults', adults);
  setText('summary-number-of-groups', count); setText('summary-group-kids', kids); setText('summary-group-adults', adults);
  AppState.data.groups = getFormData('groups');
  return { count, kids, adults };
}

function calcAdditionalTotals() {
  const total = numVal('ac-walk-r-kids') + numVal('ac-walk-r-adults') + numVal('ac-mmap-kids') + numVal('ac-mmap-adults') + numVal('ac-etcac-kids') + numVal('ac-etcac-adults');
  setText('additional-total-visitors', total);
  setText('summary-additional-total', total);
  setText('additional-notes-status', valueOf('activity-notes') ? 'มีบันทึก' : 'พร้อมบันทึก');
  setText('summary-additional-notes', valueOf('activity-notes') || '-');
  AppState.data.additional = getFormData('additional');
  return total;
}

function calcLabTotals(roomType) {
  const prefix = roomType === 'inspire' ? 'insl' : 'inns';
  const rows = collectLabRows(prefix);
  let kids = 0, adults = 0, total = 0;
  rows.forEach((row) => {
    kids += row.th_kids + row.fr_kids;
    adults += row.th_adults + row.fr_adults;
    total += row.th_kids + row.th_adults + row.fr_kids + row.fr_adults;
  });
  setText(`${prefix}-sum-kids`, kids); setText(`${prefix}-sum-adults`, adults); setText(`${prefix}-sum-total`, total);
  AppState.data[roomType] = rows;
  renderLabSummaryTable(prefix, rows);
  return { rows, kids, adults, total };
}

function calcCombinedRoomTotals() {
  const thTotal = sumLabLanguage('insl', 'th') + sumLabLanguage('inns', 'th');
  const frTotal = sumLabLanguage('insl', 'fr') + sumLabLanguage('inns', 'fr');
  setText('combined-th-sum', thTotal); setText('combined-fr-sum', frTotal);
  return { thTotal, frTotal };
}

function calcPOSSummary() {
  const walk = calcWalkInTotals();
  const groups = calcGroupTotals();
  const additionalTotal = calcAdditionalTotals();
  const insl = calcLabTotals('inspire');
  const inns = calcLabTotals('innovation');
  const combined = calcCombinedRoomTotals();
  const sumActivity = additionalTotal + insl.total + inns.total;
  const sumAcViAll = walk.sumWalkKids + walk.sumWalkAdults + groups.kids + groups.adults + sumActivity;
  const pos = { sum_w_th_kids: walk.sumThKids, sum_w_a_th_adult: walk.sumThAdults, sum_w_fr_kids: walk.sumFrKids, sum_w_a_fr_adult: walk.sumFrAdults, sum_activity: sumActivity, sum_ac_vi_all: sumAcViAll, combined_th_sum: combined.thTotal, combined_fr_sum: combined.frTotal };
  AppState.data.pos = pos;
  renderPOSPage(pos);
  setText('summary-sum-activity', pos.sum_activity);
  setText('summary-sum-ac-vi-all', pos.sum_ac_vi_all);
  renderAssignmentsSummary();
  return pos;
}

function gotoPage(pageId) {
  AppState.currentPage = pageId;
  qsa('.page').forEach((page) => page.classList.toggle('active', page.id === `page-${pageId}`));
  qsa('.nav-button').forEach((btn) => btn.classList.toggle('active', btn.dataset.page === pageId));
  const meta = PAGE_META[pageId] || PAGE_META.assignments;
  setText('page-title', meta.title);
  setText('page-subtitle', meta.subtitle);
  byId('sidebar').classList.remove('open');
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'success'}`;
  toast.textContent = message;
  byId('toast-container').appendChild(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

function showProgress(message = 'กำลังดำเนินการ...') { setText('progress-text', message); byId('progress-overlay').classList.add('visible'); }
function hideProgress() { byId('progress-overlay').classList.remove('visible'); }

async function login(username, password) {
  const settings = loadSettings();
  const expectedUsername = settings.username || 'admin';
  const expectedHash = settings.passwordHash;
  let isValid = false;

  if (expectedHash) {
    isValid = username === expectedUsername && (await sha256Hex(password)) === expectedHash;
  } else {
    isValid = username === expectedUsername && password === 'admin';
  }

  if (isValid) {
    sessionStorage.setItem(AUTH_KEY, 'true');
    updateAuthUI();
    bootstrapApp();
    showToast('เข้าสู่ระบบสำเร็จ', 'success');
  } else {
    showToast('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'error');
  }
}

function logout() {
  sessionStorage.removeItem(AUTH_KEY);
  updateAuthUI();
  byId('app-shell').classList.add('hidden');
  byId('login-screen').classList.remove('hidden');
  showToast('ออกจากระบบแล้ว', 'warning');
}

function updateAuthUI() {
  const loggedIn = isLoggedIn();
  byId('login-screen').classList.toggle('hidden', loggedIn);
  byId('app-shell').classList.toggle('hidden', !loggedIn);
}

async function saveSettingsFromForm() {
  const existingSettings = loadSettings();
  const rawPassword = byId('settings-password').value;
  const passwordToStore = rawPassword || (existingSettings.passwordHash ? null : 'admin');
  const settings = {
    apiUrl: valueOf('settings-api-url').trim(),
    spreadsheetId: valueOf('settings-spreadsheet-id').trim(),
    username: valueOf('settings-username').trim() || 'admin',
    passwordHash: existingSettings.passwordHash || ''
  };

  if (rawPassword) {
    settings.passwordHash = await sha256Hex(rawPassword);
  } else if (!settings.passwordHash && passwordToStore) {
    settings.passwordHash = await sha256Hex(passwordToStore);
  }

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  byId('sidebar-username').textContent = settings.username;
  byId('settings-password').value = '';
  updateConnectionBadge();
  showToast('บันทึกการตั้งค่าเรียบร้อยแล้ว', 'success');
}

function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')) }; }
  catch (error) { return { ...DEFAULT_SETTINGS }; }
}

function fillSettingsForm(settings) {
  setValue('settings-api-url', settings.apiUrl || '');
  setValue('settings-spreadsheet-id', settings.spreadsheetId || '');
  setValue('settings-username', settings.username || 'admin');
  setValue('settings-password', '');
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'full' }).format(new Date(`${dateStr}T00:00:00`));
}

function todayISO() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function setupEventListeners() {
  byId('login-form').addEventListener('submit', async (event) => { event.preventDefault(); await login(valueOf('login-username').trim(), valueOf('login-password')); });
  byId('logout-btn').addEventListener('click', logout);
  byId('global-date').addEventListener('change', (event) => setDate(event.target.value));
  byId('reload-date-btn').addEventListener('click', () => loadAllSections(AppState.currentDate));
  byId('top-save-btn').addEventListener('click', () => saveSection('current'));
  byId('sidebar-toggle').addEventListener('click', () => byId('sidebar').classList.toggle('open'));
  qsa('[data-page]').forEach((button) => button.addEventListener('click', () => gotoPage(button.dataset.page)));
  qsa('[data-save]').forEach((button) => button.addEventListener('click', () => saveSection(button.dataset.save)));
  byId('settings-form').addEventListener('submit', async (event) => { event.preventDefault(); await saveSettingsFromForm(); });
  byId('test-connection-btn').addEventListener('click', async () => { showProgress('กำลังทดสอบการเชื่อมต่อ...'); try { await window.ModAPI.checkConnection(); showToast('เชื่อมต่อ Google Apps Script สำเร็จ', 'success'); } catch (error) { showToast(error.message || 'ไม่สามารถเชื่อมต่อได้', 'error'); } finally { hideProgress(); } });
  byId('refresh-lookups-btn').addEventListener('click', async () => { showProgress('กำลังรีเฟรชรายการเจ้าหน้าที่และอาสาสมัคร...'); try { await loadLookups(true); showToast('รีเฟรช Lookups สำเร็จ', 'success'); } catch (error) { showToast(error.message || 'รีเฟรช Lookups ไม่สำเร็จ', 'error'); } finally { hideProgress(); } });
  byId('init-sheets-btn').addEventListener('click', async () => { showProgress('กำลังสร้างชีตที่จำเป็น...'); try { await window.ModAPI.initSheets(); showToast('สร้างชีตทั้งหมดเรียบร้อยแล้ว', 'success'); } catch (error) { showToast(error.message || 'สร้างชีตไม่สำเร็จ', 'error'); } finally { hideProgress(); } });
  const debouncedCalc = debounce(() => { recalculateAll(); setAutosaveIndicator('dirty', 'มีการเปลี่ยนแปลง'); }, 60);
  document.addEventListener('input', (event) => { if (event.target.matches('input, textarea, select')) debouncedCalc(); });
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-step-target]');
    if (!trigger) return;
    const input = byId(trigger.dataset.stepTarget);
    if (!input) return;
    input.value = Math.max(0, safeNum(input.value) + safeNum(trigger.dataset.step));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  window.addEventListener('online', updateConnectionBadge);
  window.addEventListener('offline', updateConnectionBadge);
}

async function loadLookups(force = false) {
  try {
    const lookups = await window.ModAPI.getLookups(force);
    AppState.lookups = {
      officers: Array.isArray(lookups.officers) ? lookups.officers : [],
      volunteers: Array.isArray(lookups.volunteers) ? lookups.volunteers : [],
      lab_ac_names: Array.isArray(lookups.lab_ac_names) ? lookups.lab_ac_names : [],
      inno_ac_names: Array.isArray(lookups.inno_ac_names) ? lookups.inno_ac_names : []
    };
    populateLookupFields();
  } catch (error) {
    AppState.lookups = { officers: [], volunteers: [], lab_ac_names: [], inno_ac_names: [] };
    populateLookupFields();
    showToast('ไม่สามารถโหลดรายการ Lookups ได้', 'warning');
    throw error;
  }
}

function populateLookupFields() {
  qsa('.officer-select').forEach((select) => refreshSelectOptions(select, AppState.lookups.officers));
  qsa('.volunteer-select').forEach((select) => refreshSelectOptions(select, AppState.lookups.volunteers));
  qsa('.lab-ac-select').forEach((select) => refreshSelectOptions(select, AppState.lookups.lab_ac_names));
  qsa('.inno-ac-select').forEach((select) => refreshSelectOptions(select, AppState.lookups.inno_ac_names));
  byId('officer-list').innerHTML = buildOptionsHtml(AppState.lookups.officers);
  byId('volunteer-list').innerHTML = buildOptionsHtml(AppState.lookups.volunteers);
}

function recalculateAll() { calcPOSSummary(); }

function renderAssignmentsSummary() {
  const assignments = getFormData('assignments');
  const mapping = { 'summary-mo-officer': assignments.mo_officer, 'summary-mex-officer': assignments.mex_officer, 'summary-med-officer': assignments.med_officer, 'summary-mvi-officer': assignments.mvi_officer, 'summary-z1f-volunteer': assignments.z1f_volunteer, 'summary-zino-volunteer': assignments.zino_volunteer, 'summary-z2f-volunteer': assignments.z2f_volunteer, 'summary-zmp-volunteer': assignments.zmp_volunteer, 'summary-zinl-volunteer': assignments.zinl_volunteer, 'summary-other-activity': assignments.other_activity_note };
  Object.entries(mapping).forEach(([id, value]) => setText(id, value || '-'));
  AppState.data.assignments = assignments;
}

function renderLabSummaryTable(prefix, rows) {
  const target = byId(prefix === 'insl' ? 'summary-insl-body' : 'summary-inns-body');
  const filtered = rows.filter((row) => row.ac_name || row.officer_name || row.th_kids || row.th_adults || row.fr_kids || row.fr_adults);
  const list = filtered.length ? filtered : [{ ac_name: '-', officer_name: '-', th_kids: 0, th_adults: 0, fr_kids: 0, fr_adults: 0 }];
  target.innerHTML = list.map((row) => `<tr><td>${escapeHtml(row.ac_name || '-')}</td><td>${escapeHtml(row.officer_name || '-')}</td><td>${row.th_kids + row.th_adults + row.fr_kids + row.fr_adults}</td></tr>`).join('');
}

function renderPOSPage(pos) {
  setText('pos-sum-w-th-kids', pos.sum_w_th_kids ?? 0);
  setText('pos-sum-w-a-th-adult', pos.sum_w_a_th_adult ?? 0);
  setText('pos-sum-w-fr-kids', pos.sum_w_fr_kids ?? 0);
  setText('pos-sum-w-a-fr-adult', pos.sum_w_a_fr_adult ?? 0);
  setText('pos-sum-activity', pos.sum_activity ?? 0);
  setText('pos-sum-ac-vi-all', pos.sum_ac_vi_all ?? 0);
  setText('pos-date-indicator', `ข้อมูลวันที่ ${formatDate(AppState.currentDate)}`);
}

function updateDateLabels() { const text = formatDate(AppState.currentDate); setText('assignment-date-label', text); setText('summary-date-label', `วันที่ ${text}`); }
function updateConnectionBadge() { const indicator = byId('offline-indicator'); if (!navigator.onLine) { indicator.className = 'chip danger'; indicator.textContent = '● ออฟไลน์'; } else { indicator.className = 'chip success'; indicator.textContent = '● ออนไลน์'; } }
function setAutosaveIndicator(state, label) { const indicator = byId('autosave-indicator'); indicator.className = `chip ${state === 'saved' ? 'success' : state === 'error' ? 'danger' : state === 'saving' ? 'warning' : ''}`.trim(); indicator.textContent = label; }
function setLoading(loading) { AppState.isLoading = loading; document.body.classList.toggle('loading', loading); }
function updateDataModeIndicator(hasData) { const indicator = byId('data-mode-indicator'); if (!indicator) return; if (hasData === null) { indicator.className = 'chip'; indicator.textContent = 'กำลังโหลด...'; } else if (hasData) { indicator.className = 'chip warning'; indicator.textContent = '✏️ แก้ไขข้อมูลเดิม'; } else { indicator.className = 'chip success'; indicator.textContent = '✨ บันทึกข้อมูลใหม่'; } }

function populateLabRows(prefix, rows) {
  buildIndexedRows(rows, 6, 'row_index').forEach((row, index) => {
    const i = index + 1;
    setValue(`${prefix}-name-${i}`, row.ac_name || '');
    setValue(`${prefix}-officer-${i}`, row.officer_name || '');
    setValue(`${prefix}-th-kids-${i}`, row.th_kids ?? 0);
    setValue(`${prefix}-th-adults-${i}`, row.th_adults ?? 0);
    setValue(`${prefix}-fr-kids-${i}`, row.fr_kids ?? 0);
    setValue(`${prefix}-fr-adults-${i}`, row.fr_adults ?? 0);
  });
}

function collectLabRows(prefix) {
  return Array.from({ length: 6 }, (_, index) => ({ row_index: index + 1, ac_name: valueOf(`${prefix}-name-${index + 1}`), officer_name: valueOf(`${prefix}-officer-${index + 1}`), th_kids: numVal(`${prefix}-th-kids-${index + 1}`), th_adults: numVal(`${prefix}-th-adults-${index + 1}`), fr_kids: numVal(`${prefix}-fr-kids-${index + 1}`), fr_adults: numVal(`${prefix}-fr-adults-${index + 1}`) }));
}

function buildIndexedRows(rows, expectedCount, indexKey) { const map = new Map((Array.isArray(rows) ? rows : []).map((row) => [Number(row[indexKey]), row])); return Array.from({ length: expectedCount }, (_, index) => map.get(index + 1) || { [indexKey]: index + 1 }); }
function buildOptionsHtml(values) { return values.map((value) => `<option value="${escapeHtml(value)}"></option>`).join(''); }
function refreshSelectOptions(select, values) { const currentValue = select.value; select.innerHTML = ['<option value="">เลือก...</option>'].concat(values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)).join(''); select.value = values.includes(currentValue) ? currentValue : currentValue || ''; }
function normalizeFullDay(payload) { return { assignments: payload.assignments || defaultAssignments(), walkin: payload.walkin || defaultWalkin(), groups: Array.isArray(payload.groups) ? payload.groups : [], additional: payload.additional || defaultAdditional(), inspire: Array.isArray(payload.inspire) ? payload.inspire : [], innovation: Array.isArray(payload.innovation) ? payload.innovation : [], pos: payload.pos || payload.computed_pos || defaultPOS(), summary: payload.summary || defaultSummary() }; }
function mapPageToSaveTarget(pageId) { return pageId === 'exhibition' ? 'exhibition' : pageId === 'pos' ? 'pos' : pageId === 'summary' ? 'summary' : 'assignments'; }
function isLoggedIn() { return sessionStorage.getItem(AUTH_KEY) === 'true'; }
function qs(selector, parent = document) { return parent.querySelector(selector); }
function qsa(selector, parent = document) { return [...parent.querySelectorAll(selector)]; }
function byId(id) { return document.getElementById(id); }
function valueOf(id) { return byId(id)?.value.trim() || ''; }
function setValue(id, value) { const element = byId(id); if (element) element.value = value ?? ''; }
function setText(id, value) { const element = byId(id); if (element) element.textContent = value ?? ''; }
function numVal(id) { return safeNum(byId(id)?.value); }
function safeNum(value) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
function debounce(fn, delay) { let timer; return (...args) => { clearTimeout(timer); timer = window.setTimeout(() => fn(...args), delay); }; }
function sumLabLanguage(prefix, lang) { let total = 0; for (let i = 1; i <= 6; i += 1) total += numVal(`${prefix}-${lang}-kids-${i}`) + numVal(`${prefix}-${lang}-adults-${i}`); return total; }
function defaultAssignments() { return { mo_officer: '', mex_officer: '', med_officer: '', mvi_officer: '', z1f_volunteer: '', zino_volunteer: '', z2f_volunteer: '', zmp_volunteer: '', zinl_volunteer: '', other_activity_note: '' }; }
function defaultWalkin() { return { mor_th_kids: 0, mor_th_adults: 0, mor_fr_kids: 0, mor_fr_adults: 0, eve_th_kids: 0, eve_th_adults: 0, eve_fr_kids: 0, eve_fr_adults: 0 }; }
function defaultAdditional() { return { ac_walk_r_kids: 0, ac_walk_r_adults: 0, ac_mmap_kids: 0, ac_mmap_adults: 0, ac_etcac_kids: 0, ac_etcac_adults: 0, activity_notes: '' }; }
function defaultPOS() { return { sum_w_th_kids: 0, sum_w_a_th_adult: 0, sum_w_fr_kids: 0, sum_w_a_fr_adult: 0, sum_activity: 0, sum_ac_vi_all: 0 }; }
function defaultSummary() { return { issue_mo: '', issue_mex: '', issue_med: '', issue_mvi: '', issue_insl: '', issue_inns: '', summary_notes: '' }; }
function escapeHtml(value) { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

document.addEventListener('DOMContentLoaded', init);
