// ============================================================
// NSM MOD Management System - app.js
// ============================================================

// ============ STATE ============
let currentPage = 'dashboard';
let currentRecord = null;
let activityChart = null;
let summaryChart = null;
let pendingDeleteDate = null;
let historyPage = 1;
const ITEMS_PER_PAGE = 15;

const MONTH_NAMES = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

// ============ SETTINGS ============
async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function getSettings() {
  try { return JSON.parse(localStorage.getItem('nsm_settings') || '{}'); } catch(e) { return {}; }
}
function saveSettings(s) {
  localStorage.setItem('nsm_settings', JSON.stringify(s));
}

// ============ AUTH ============
async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const settings = getSettings();
  const validUser = settings.username || 'admin';
  let valid = false;
  if (settings.passwordHash) {
    const enteredHash = await sha256hex(password);
    valid = username === validUser && enteredHash === settings.passwordHash;
  } else {
    // Default credentials (no hash stored yet)
    valid = username === validUser && password === 'admin';
  }
  if (valid) {
    const rememberMe = document.getElementById('remember-me').checked;
    sessionStorage.setItem('nsm_logged_in', '1');
    sessionStorage.setItem('nsm_user', username);
    if (rememberMe) { localStorage.setItem('nsm_remember', username); }
    else { localStorage.removeItem('nsm_remember'); }
    showApp(username);
  } else {
    showLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    const form = document.getElementById('login-form');
    form.classList.add('shake');
    setTimeout(() => form.classList.remove('shake'), 500);
  }
}

function doLogout() {
  sessionStorage.removeItem('nsm_logged_in');
  sessionStorage.removeItem('nsm_user');
  showLogin();
}

function toggleLoginPass() {
  const inp = document.getElementById('login-pass');
  const btn = document.getElementById('pass-toggle-btn');
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
  else { inp.type = 'password'; btn.textContent = '👁'; }
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function showApp(username) {
  document.getElementById('page-login').style.display = 'none';
  const app = document.getElementById('app');
  app.style.display = 'flex';
  const uname = username || sessionStorage.getItem('nsm_user') || 'admin';
  const el1 = document.getElementById('sidebar-username');
  const el2 = document.getElementById('topbar-username');
  if (el1) el1.textContent = uname;
  if (el2) el2.textContent = uname;
  initDateSelectors();
  loadToday();
  gotoPage('dashboard');
  checkMenuToggleVisibility();
}

function showLogin() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('page-login').style.display = 'flex';
  document.getElementById('login-pass').value = '';
  const errEl = document.getElementById('login-error');
  if (errEl) errEl.style.display = 'none';
}

function checkSession() {
  if (sessionStorage.getItem('nsm_logged_in') === '1') {
    showApp();
  } else {
    const remembered = localStorage.getItem('nsm_remember');
    if (remembered) {
      const el = document.getElementById('login-user');
      if (el) { el.value = remembered; document.getElementById('remember-me').checked = true; }
    }
  }
}

// ============ NAVIGATION ============
function gotoPage(pageName) {
  const pages = ['dashboard','daily-log','history','summary','export'];
  pages.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.style.display = (p === pageName) ? 'block' : 'none';
  });
  // Update nav active
  pages.forEach(p => {
    const nav = document.getElementById('nav-' + p);
    if (nav) nav.classList.toggle('active', p === pageName);
  });
  currentPage = pageName;
  updateBreadcrumb(pageName);
  // Init page-specific content
  if (pageName === 'dashboard') updateDashboard();
  if (pageName === 'history') renderHistory(document.getElementById('history-filter-month')?.value || '');
  if (pageName === 'summary') renderSummary();
  if (pageName === 'export') renderExportPreview();
  // Close sidebar on mobile
  if (window.innerWidth <= 768) closeSidebar();
}

function updateBreadcrumb(page) {
  const names = { dashboard: 'Dashboard', 'daily-log': 'บันทึกประจำวัน', history: 'ประวัติ', summary: 'สรุป', export: 'ส่งออก' };
  const el = document.getElementById('breadcrumb-page');
  if (el) el.textContent = names[page] || page;
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  sb.classList.toggle('open');
  ov.classList.toggle('visible');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('visible');
}
function checkMenuToggleVisibility() {
  const btn = document.getElementById('menu-toggle');
  if (btn) btn.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
}
window.addEventListener('resize', checkMenuToggleVisibility);

// ============ DATE SELECTORS ============
function initDateSelectors() {
  const yearSel = document.getElementById('date-year');
  const monthSel = document.getElementById('date-month');
  if (!yearSel || !monthSel) return;
  const now = new Date();
  const curYear = now.getFullYear();
  yearSel.innerHTML = '';
  for (let y = curYear + 1; y >= curYear - 3; y--) {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y + 543; // Buddhist era
    if (y === curYear) opt.selected = true;
    yearSel.appendChild(opt);
  }
  monthSel.innerHTML = '';
  MONTH_NAMES.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = String(i + 1).padStart(2, '0');
    opt.textContent = m;
    if (i + 1 === now.getMonth() + 1) opt.selected = true;
    monthSel.appendChild(opt);
  });
  onYearMonthChange();
}

function loadToday() {
  const now = new Date();
  const yearSel = document.getElementById('date-year');
  const monthSel = document.getElementById('date-month');
  if (!yearSel || !monthSel) return;
  yearSel.value = now.getFullYear();
  monthSel.value = String(now.getMonth() + 1).padStart(2, '0');
  onYearMonthChange();
  const daySel = document.getElementById('date-day');
  if (daySel) {
    daySel.value = String(now.getDate()).padStart(2, '0');
    onDateChange();
  }
}

function onYearMonthChange() {
  const year = parseInt(document.getElementById('date-year')?.value);
  const month = parseInt(document.getElementById('date-month')?.value);
  if (!year || !month) return;
  const daysInMonth = new Date(year, month, 0).getDate();
  const daySel = document.getElementById('date-day');
  if (!daySel) return;
  const prevDay = parseInt(daySel.value) || 1;
  daySel.innerHTML = '';
  for (let d = 1; d <= daysInMonth; d++) {
    const opt = document.createElement('option');
    opt.value = String(d).padStart(2, '0');
    opt.textContent = String(d).padStart(2, '0');
    daySel.appendChild(opt);
  }
  daySel.value = String(Math.min(prevDay, daysInMonth)).padStart(2, '0');
  onDateChange();
}

function onDateChange() {
  const year = document.getElementById('date-year')?.value;
  const month = document.getElementById('date-month')?.value;
  const day = document.getElementById('date-day')?.value;
  if (!year || !month || !day) return;
  const date = `${year}-${month}-${day}`;
  // Show Thai date
  const d = new Date(year, parseInt(month) - 1, parseInt(day));
  const thaiDays = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  const disp = document.getElementById('date-display');
  if (disp) disp.textContent = `วัน${thaiDays[d.getDay()]}ที่ ${parseInt(day)} ${MONTH_NAMES[parseInt(month)-1]} ${parseInt(year)+543}`;
  loadFromLocal(date);
  updateSummaryPreview();
}

function getCurrentDate() {
  const year = document.getElementById('date-year')?.value;
  const month = document.getElementById('date-month')?.value;
  const day = document.getElementById('date-day')?.value;
  if (!year || !month || !day) return '';
  return `${year}-${month}-${day}`;
}

// ============ BOOKING ROWS ============
let bookingRowCount = 0;
function addBookingRow(data) {
  bookingRowCount++;
  const tbody = document.getElementById('booking-tbody');
  const tr = document.createElement('tr');
  tr.className = 'booking-row';
  tr.dataset.id = bookingRowCount;
  tr.innerHTML = `
    <td style="color:var(--text-muted);font-size:12px;">${bookingRowCount}</td>
    <td><input type="text" class="form-input" style="min-width:140px;" placeholder="ชื่อกลุ่ม / โรงเรียน" value="${data?.group||''}"></td>
    <td><input type="number" class="num-input" min="0" value="${data?.count||''}" placeholder="0" style="width:80px;"></td>
    <td><input type="text" class="form-input" style="width:100px;" placeholder="09:00" value="${data?.time||''}"></td>
    <td><input type="text" class="form-input" style="min-width:100px;" placeholder="ชื่อ" value="${data?.responsible||''}"></td>
    <td><button type="button" class="btn btn-ghost btn-sm" onclick="removeBookingRow(this)" style="padding:4px 8px;color:var(--danger);">✕</button></td>
  `;
  tbody.appendChild(tr);
}


let groupRowCount = 0;

function addGroupRow(data) {
  groupRowCount++;
  const tbody = document.getElementById('group-tbody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.dataset.id = groupRowCount;
  tr.innerHTML = `
    <td style="color:var(--text-muted);font-size:12px;">${groupRowCount}</td>
    <td><input type="text" class="form-input group-name-input" style="min-width:140px;" placeholder="ชื่อกลุ่ม" value="${data?.group||''}"></td>
    <td><input type="number" class="num-input" min="0" value="${data?.thaiChild||0}" style="width:70px;" oninput="calcGroupRows()"></td>
    <td><input type="number" class="num-input" min="0" value="${data?.thaiAdult||0}" style="width:70px;" oninput="calcGroupRows()"></td>
    <td><input type="number" class="num-input" min="0" value="${data?.foreignChild||0}" style="width:70px;" oninput="calcGroupRows()"></td>
    <td><input type="number" class="num-input" min="0" value="${data?.foreignAdult||0}" style="width:70px;" oninput="calcGroupRows()"></td>
    <td class="computed" style="font-weight:600;">
      ${(parseInt(data?.thaiChild||0)+parseInt(data?.thaiAdult||0)+parseInt(data?.foreignChild||0)+parseInt(data?.foreignAdult||0))}
    </td>
    <td><button type="button" class="btn btn-ghost btn-sm" onclick="removeGroupRow(this)" style="padding:4px 8px;color:var(--danger);">✕</button></td>
  `;
  tbody.appendChild(tr);
  calcGroupRows();
}

function removeGroupRow(btn) {
  btn.closest('tr').remove();
  document.querySelectorAll('#group-tbody tr').forEach((tr, i) => {
    const first = tr.querySelector('td');
    if (first) first.textContent = i + 1;
  });
  calcGroupRows();
}

function calcGroupRows() {
  let thaiChild = 0, thaiAdult = 0, forChild = 0, forAdult = 0;
  let groupCount = 0;
  document.querySelectorAll('#group-tbody tr').forEach(tr => {
    const groupNameInput = tr.querySelector('input.group-name-input');
    const inputs = tr.querySelectorAll('input[type="number"]');
    if (inputs.length >= 4) {
      const tc = parseInt(inputs[0].value)||0;
      const ta = parseInt(inputs[1].value)||0;
      const fc = parseInt(inputs[2].value)||0;
      const fa = parseInt(inputs[3].value)||0;
      thaiChild += tc; thaiAdult += ta; forChild += fc; forAdult += fa;
      const rowTotal = tr.querySelector('td.computed');
      if (rowTotal) rowTotal.textContent = tc + ta + fc + fa;
      // Count only rows with a filled group name
      if (groupNameInput && groupNameInput.value.trim() !== '') groupCount++;
    }
  });
  const subTotal = thaiChild + thaiAdult + forChild + forAdult;
  setTxt('vis-b-group-count', groupCount);
  setTxt('vis-b-thai-child-total', thaiChild);
  setTxt('vis-b-thai-adult-total', thaiAdult);
  setTxt('vis-b-for-child-total', forChild);
  setTxt('vis-b-for-adult-total', forAdult);
  // vis-b-total will be updated by calcVis() to include IC/IA; set subtotal here as interim
  setTxt('vis-b-total', subTotal);
  // Sync with existing vis-b inputs if present
  setInputVal('vis-b-thai-child', thaiChild);
  setInputVal('vis-b-thai-adult', thaiAdult);
  setInputVal('vis-b-for-child', forChild);
  setInputVal('vis-b-for-adult', forAdult);
  calcVis();
}
  
function removeBookingRow(btn) {
  btn.closest('tr').remove();
  // Re-number
  document.querySelectorAll('#booking-tbody tr').forEach((tr, i) => {
    const first = tr.querySelector('td');
    if (first) first.textContent = i + 1;
  });
}

// ============ ACTIVITY ROWS ============
let activityRowCount = 0;

function addActivityRow(data) {
  activityRowCount++;
  const tbody = document.getElementById('activity-tbody');
  if (!tbody) return;

  const tr = document.createElement('tr');
  tr.dataset.id = activityRowCount;
  tr.innerHTML = `
    <td>
      <select class="form-input" style="width:100%;" onchange="handleActivitySelect(this)">
        <option value="">เลือกกิจกรรม...</option>
        <option value="inspire" ${data?.type==='inspire'?'selected':''}>Inspire Lab</option>
        <option value="innovation" ${data?.type==='innovation'?'selected':''}>Innovation Space</option>
        <option value="walk" ${data?.type==='walk'?'selected':''}>Walk Rallies</option>
        <option value="mini" ${data?.type==='mini'?'selected':''}>Mini Make & Play</option>
        <option value="other" ${data?.type==='other'?'selected':''}>กิจกรรมอื่น</option>
      </select>
    </td>
    <td><input type="text" class="form-input" placeholder="ชื่อกิจกรรม" value="${data?.name||''}"></td>
    <td><input type="text" class="form-input" placeholder="ชื่อผู้ดำเนินกิจกรรม" value="${data?.operator||''}"></td>
    <td><input type="number" class="num-input" min="0" value="${data?.thaiChild||0}" style="width:80px;"></td>
    <td><input type="number" class="num-input" min="0" value="${data?.thaiAdult||0}" style="width:80px;"></td>
    <td><input type="number" class="num-input" min="0" value="${data?.foreignChild||0}" style="width:80px;"></td>
    <td><input type="number" class="num-input" min="0" value="${data?.foreignAdult||0}" style="width:80px;"></td>
    <td><button type="button" class="btn btn-ghost btn-sm" onclick="removeActivityRow(this)" style="padding:4px 8px;color:var(--danger);">✕</button></td>
  `;
  tbody.appendChild(tr);
}

function removeActivityRow(btn) {
  btn.closest('tr').remove();
}

function handleActivitySelect(selectEl) {
  const value = selectEl.value;
  const row = selectEl.closest('tr');
  const nameInput = row.querySelectorAll('input[type="text"]')[0];

  const activityNames = {
    'inspire': 'Inspire Lab',
    'innovation': 'Innovation Space',
    'walk': 'Walk Rallies',
    'mini': 'Mini Make & Play',
    'other': ''
  };

  if (nameInput && activityNames[value] !== undefined) {
    nameInput.value = activityNames[value];
    if (value === 'other') {
      nameInput.focus();
    }
  }
}

// ============ TABS ============
function switchDayTab(idx, btn) {
  for (let i = 0; i < 2; i++) {
    const tab = document.getElementById('day-tab-' + i);
    const tabBtn = document.getElementById('tab-btn-' + i);
    if (tab) tab.classList.toggle('active', i === idx);
    if (tabBtn) tabBtn.classList.toggle('active', i === idx);
  }
  if (idx === 1) { calcVis(); calcRev(); updateSummaryPreview(); }
}

// ============ COLLAPSIBLE ============
function toggleSec(el) {
  const parent = el.parentElement;
  const body = parent.querySelector('.section-body');
  if (!body) return;
  const isCollapsed = body.classList.contains('collapsed');
  if (isCollapsed) {
    body.classList.remove('collapsed');
    body.style.maxHeight = body.scrollHeight + 'px';
    parent.classList.remove('collapsed-parent');
  } else {
    body.style.maxHeight = body.scrollHeight + 'px';
    requestAnimationFrame(() => { body.classList.add('collapsed'); body.style.maxHeight = '0'; });
    parent.classList.add('collapsed-parent');
  }
}

// ============ HELPERS ============
function getVal(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  return parseInt(el.value) || 0;
}
function getFloatVal(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  return parseFloat(el.value) || 0;
}
function setTxt(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function getInputVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}
function setInputVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val !== undefined && val !== null ? val : '';
}
function setChecked(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = !!val;
}
function isChecked(id) {
  const el = document.getElementById(id);
  return el ? el.checked : false;
}
function fmtNum(n) {
  const num = parseFloat(n);
  return (isNaN(num) ? 0 : num).toLocaleString('th-TH');
}
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
/** Sanitize a date string — only allow exact YYYY-MM-DD format */
function sanitizeDate(str) {
  const s = String(str || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}
/** Sanitize a year-month string — only allow exact YYYY-MM format */
function sanitizeYearMonth(str) {
  const s = String(str || '');
  return /^\d{4}-\d{2}$/.test(s) ? s : '';
}

// ============ VALIDATION ============
/**
 * ตรวจสอบข้อมูลก่อนบันทึก/ส่ง
 * Returns array of Thai error messages; empty array = valid.
 */
function validateDailyForm() {
  const errors = [];
  // วันที่ต้องระบุ
  const date = getCurrentDate();
  if (!date || date.startsWith('-') || date.split('-').length < 3) {
    errors.push('กรุณาเลือกวันที่บันทึก');
  }
  // MOD ประจำวัน (ต้องระบุ)
  const modName = getInputVal('mod-morning').trim();
  if (!modName) {
    errors.push('กรุณากรอกชื่อ MOD ประจำวัน (แท็บ "ช่วงเช้า")');
  }
  // ตรวจสอบค่าตัวเลขไม่ติดลบ
  let hasNegative = false;
  document.querySelectorAll('#page-daily-log input[type="number"]').forEach(inp => {
    if (parseFloat(inp.value) < 0) hasNegative = true;
  });
  if (hasNegative) {
    errors.push('ค่าตัวเลขต้องไม่ติดลบ กรุณาตรวจสอบข้อมูลผู้เข้าชม / รายได้');
  }
  return errors;
}

// ============ CALCULATIONS ============
function calcVis() {
  // Section A - Walk-in
  const aThai = getVal('vis-a-thai-child') + getVal('vis-a-thai-adult');
  setTxt('vis-a-thai-total', aThai);
  const aFor = getVal('vis-a-for-child') + getVal('vis-a-for-adult');
  setTxt('vis-a-for-total', aFor);
  const aMemC = getVal('vis-a-mem-child'), aMemFC = getVal('vis-a-mem-fc');
  const aMemA = getVal('vis-a-mem-adult'), aMemFA = getVal('vis-a-mem-fa');
  const aMem = aMemC + aMemA + aMemFC + aMemFA;
  setTxt('vis-a-mem-total', aMem);
  const aTotal = aThai + aFor + aMem;
  setTxt('vis-a-total', aTotal);

  // Section B - Group (totals are maintained by calcGroupRows via tfoot cells)
  const bThaiChild = parseInt(document.getElementById('vis-b-thai-child-total')?.textContent) || 0;
  const bThaiAdult = parseInt(document.getElementById('vis-b-thai-adult-total')?.textContent) || 0;
  const bForChild  = parseInt(document.getElementById('vis-b-for-child-total')?.textContent) || 0;
  const bForAdult  = parseInt(document.getElementById('vis-b-for-adult-total')?.textContent) || 0;
  const bThai = bThaiChild + bThaiAdult;
  setTxt('vis-b-thai-total', bThai);
  const bFor = bForChild + bForAdult;
  setTxt('vis-b-for-total', bFor);
  const bIC = getVal('vis-b-ic'), bIA = getVal('vis-b-ia');
  const bMem = bIC + bIA;
  setTxt('vis-b-mem-total', bMem);
  const bTotal = bThai + bFor + bMem;
  setTxt('vis-b-total', bTotal);

  // Section C - Senior
  const cSenior = getVal('vis-c-senior');

  // Section D - Education
  const dInsTC = getVal('vis-d-ins-tc'), dInsTA = getVal('vis-d-ins-ta');
  const dInsFC = getVal('vis-d-ins-fc'), dInsFA = getVal('vis-d-ins-fa');
  const dIns = dInsTC + dInsTA + dInsFC + dInsFA;
  setTxt('vis-d-ins-total', dIns);

  const dInvTC = getVal('vis-d-inv-tc'), dInvTA = getVal('vis-d-inv-ta');
  const dInvFC = getVal('vis-d-inv-fc'), dInvFA = getVal('vis-d-inv-fa');
  const dInv = dInvTC + dInvTA + dInvFC + dInvFA;
  setTxt('vis-d-inv-total', dInv);

  const dWrTC = getVal('vis-d-wr-tc'), dWrTA = getVal('vis-d-wr-ta');
  const dWrFC = getVal('vis-d-wr-fc'), dWrFA = getVal('vis-d-wr-fa');
  const dWr = dWrTC + dWrTA + dWrFC + dWrFA;
  setTxt('vis-d-wr-total', dWr);

  const dMmChild = getVal('vis-d-mm-child');
  setTxt('vis-d-mm-total', dMmChild);

  const dSpTC = getVal('vis-d-sp-tc'), dSpTA = getVal('vis-d-sp-ta');
  const dSpFC = getVal('vis-d-sp-fc'), dSpFA = getVal('vis-d-sp-fa');
  const dSp = dSpTC + dSpTA + dSpFC + dSpFA;
  setTxt('vis-d-sp-total', dSp);

  const dOth = getVal('vis-d-oth-count');
  setTxt('vis-d-oth-total', dOth);

  const dTotal = dIns + dInv + dWr + dMmChild + dSp + dOth;
  setTxt('vis-d-total', dTotal);

  // Grand totals by category
  setTxt('grand-walkin', aTotal);
  setTxt('grand-group', bTotal);
  setTxt('grand-education', dTotal);
  const grandTotal = aTotal + bTotal + cSenior + dTotal;
  setTxt('grand-total', grandTotal);

  // Grand total nationality splits
  const walkInThai = aThai;
  const walkInForeign = aFor;
  setTxt('grand-walkin-thai', walkInThai);
  setTxt('grand-walkin-foreign', walkInForeign);

  const groupThai = bThai;
  const groupForeign = bFor;
  setTxt('grand-group-thai', groupThai);
  setTxt('grand-group-foreign', groupForeign);

  const eduThai = (dInsTC + dInsTA) + (dInvTC + dInvTA) + (dWrTC + dWrTA) + dMmChild + (dSpTC + dSpTA);
  const eduForeign = (dInsFC + dInsFA) + (dInvFC + dInvFA) + (dWrFC + dWrFA) + (dSpFC + dSpFA);
  setTxt('grand-edu-thai', eduThai);
  setTxt('grand-edu-foreign', eduForeign);

  // Summary by nationality and age
  // Thai children: Walk-in Thai child + Group Thai child + Mem child + IC + Education Thai child
  const sumThaiChild = getVal('vis-a-thai-child') + bThaiChild + aMemC + bIC
    + dInsTC + dInvTC + dWrTC + dMmChild + dSpTC;
  // Thai adults: Walk-in Thai adult + Group Thai adult + Mem adult + IA + Education Thai adult
  const sumThaiAdult = getVal('vis-a-thai-adult') + bThaiAdult + aMemA + bIA
    + dInsTA + dInvTA + dWrTA + dSpTA;
  // Foreign children: Walk-in For child + Group For child + Mem FC + Education For child
  const sumForChild = getVal('vis-a-for-child') + bForChild + aMemFC
    + dInsFC + dInvFC + dWrFC + dSpFC;
  // Foreign adults: Walk-in For adult + Group For adult + Mem FA + Education For adult
  const sumForAdult = getVal('vis-a-for-adult') + bForAdult + aMemFA
    + dInsFA + dInvFA + dWrFA + dSpFA;
  // All children and adults
  const sumAllChild = sumThaiChild + sumForChild;
  // Note: cSenior (ผู้สูงอายุ) are counted as adults by definition.
  // dOth (other education activities) has no age/nationality breakdown, so counted as adults.
  const sumAllAdult = sumThaiAdult + sumForAdult + cSenior + dOth;

  setTxt('sum-thai-child', sumThaiChild);
  setTxt('sum-thai-adult', sumThaiAdult);
  setTxt('sum-for-child', sumForChild);
  setTxt('sum-for-adult', sumForAdult);
  setTxt('sum-all-child', sumAllChild);
  setTxt('sum-all-adult', sumAllAdult);

  updateSummaryPreview();
}

function calcRev() {
  const cats = ['ex','ins','inv','wr','mm','sp','mem','oth'];
  let revRowTotal = 0, onlineRowTotal = 0;
  cats.forEach(cat => {
    const rev = getFloatVal('rev-' + cat);
    const online = getFloatVal('online-' + cat);
    const colTotal = rev + online;
    setTxt('col-' + cat + '-total', fmtNum(colTotal));
    revRowTotal += rev;
    onlineRowTotal += online;
  });
  setTxt('rev-row-total', fmtNum(revRowTotal));
  setTxt('online-row-total', fmtNum(onlineRowTotal));
  const grand = revRowTotal + onlineRowTotal;
  setTxt('rev-grand-total', fmtNum(grand));
  updateSummaryPreview();
}

function updateSummaryPreview() {
  const date = getCurrentDate();
  setTxt('prev-date', date || '-');
  setTxt('prev-mod', getInputVal('mod-morning') || '-');
  const gt = document.getElementById('grand-total');
  const vis = gt ? parseInt(gt.textContent) || 0 : 0;
  setTxt('prev-visitors', fmtNum(vis) + ' คน');
  // Revenue grand total
  const revEl = document.getElementById('rev-grand-total');
  const revText = revEl ? revEl.textContent.replace(/,/g,'') : '0';
  setTxt('prev-revenue', fmtNum(parseFloat(revText) || 0) + ' บาท');
}
// ============ DATA STORAGE ============
function getFormData() {
  const date = getCurrentDate();
  // Collect booking rows
  const bookings = [];
  document.querySelectorAll('#booking-tbody tr').forEach(tr => {
    const inputs = tr.querySelectorAll('input');
    if (inputs.length >= 4) {
      bookings.push({
        group: inputs[0].value || '',
        count: inputs[1].value || '',
        time: inputs[2].value || '',
        responsible: inputs[3].value || ''
      });
    }
  });
  // รวบรวมข้อมูล activity rows
  const activities = [];
  document.querySelectorAll('#activity-tbody tr').forEach(tr => {
    const selects = tr.querySelectorAll('select');
    const inputs = tr.querySelectorAll('input');
    if (selects.length > 0 && inputs.length >= 6) {
      activities.push({
        type: selects[0].value || '',
        name: inputs[0].value || '',
        operator: inputs[1].value || '',
        thaiChild: parseInt(inputs[2].value) || 0,
        thaiAdult: parseInt(inputs[3].value) || 0,
        foreignChild: parseInt(inputs[4].value) || 0,
        foreignAdult: parseInt(inputs[5].value) || 0
      });
    }
  });
  // Collect group rows (Section B) and compute totals
  const groups = [];
  let bThaiChild = 0, bThaiAdult = 0, bForChild = 0, bForAdult = 0;
  document.querySelectorAll('#group-tbody tr').forEach(tr => {
    const groupNameInput = tr.querySelector('input.group-name-input');
    const numInputs  = tr.querySelectorAll('input[type="number"]');
    if (numInputs.length >= 4) {
      const tc = parseInt(numInputs[0].value)||0;
      const ta = parseInt(numInputs[1].value)||0;
      const fc = parseInt(numInputs[2].value)||0;
      const fa = parseInt(numInputs[3].value)||0;
      bThaiChild += tc; bThaiAdult += ta; bForChild += fc; bForAdult += fa;
      groups.push({
        group: groupNameInput?.value || '',
        thaiChild: tc, thaiAdult: ta, foreignChild: fc, foreignAdult: fa
      });
    }
  });
  // Grand total
  const gt = document.getElementById('grand-total');
  const totalVisitors = gt ? parseInt(gt.textContent) || 0 : 0;
  // Revenue
  const revEl = document.getElementById('rev-grand-total');
  const revText = revEl ? revEl.textContent.replace(/,/g,'') : '0';
  const totalRevenue = parseFloat(revText) || 0;

  return {
    date, year: date.split('-')[0], month: date.split('-')[1], day: date.split('-')[2],
    // Morning
    modMorning: getInputVal('mod-morning'),
    mExhibition: getInputVal('m-exhibition'),
    mEducation: getInputVal('m-education'),
    mVisitor: getInputVal('m-visitor-service'),
    bookings,
    activities,
    groups,
    hoursTueFri: getInputVal('hours-tue-fri'),
    hoursSatSun: getInputVal('hours-sat-sun'),
    hoursClosed: getInputVal('hours-closed'),
    mEducationActivities: getInputVal('m-education-activities'),
    visitorServiceInfo: getInputVal('visitor-service-info'),
    regulation1: getInputVal('regulation-1'),
    regulation2: getInputVal('regulation-2'),
    special1: getInputVal('special1'),
    special2: getInputVal('special2'),
    special3: getInputVal('special3'),
    special4: getInputVal('special4'),
    special5: getInputVal('special5'),
    special6: getInputVal('special6'),
    // Evening - VS
    vsCounter2Name: getInputVal('vs-counter2-name'), vsCounter2Issue: getInputVal('vs-counter2-issue'), vsCounter2Note: getInputVal('vs-counter2-note'),
    vsCounter1Name: getInputVal('vs-counter1-name'), vsCounter1Issue: getInputVal('vs-counter1-issue'), vsCounter1Note: getInputVal('vs-counter1-note'),
    // Evening - Exhibition zones
    exZ1Name: getInputVal('ex-z1-name'), exZ1Issue: getInputVal('ex-z1-issue'), exZ1Note: getInputVal('ex-z1-note'),
    exZ2Name: getInputVal('ex-z2-name'), exZ2Issue: getInputVal('ex-z2-issue'), exZ2Note: getInputVal('ex-z2-note'),
    exZ3Name: getInputVal('ex-z3-name'), exZ3Issue: getInputVal('ex-z3-issue'), exZ3Note: getInputVal('ex-z3-note'),
    exZ4Name: getInputVal('ex-z4-name'), exZ4Issue: getInputVal('ex-z4-issue'), exZ4Note: getInputVal('ex-z4-note'),
    exInnovationName: getInputVal('ex-innovation-name'), exInnovationIssue: getInputVal('ex-innovation-issue'), exInnovationNote: getInputVal('ex-innovation-note'),
    exInspireName: getInputVal('ex-inspire-name'), exInspireIssue: getInputVal('ex-inspire-issue'), exInspireNote: getInputVal('ex-inspire-note'),
    exMakePlay1Name: getInputVal('ex-make-play1-name'), exMakePlay1Issue: getInputVal('ex-make-play1-issue'), exMakePlay1Note: getInputVal('ex-make-play1-note'),
    exMakePlay2Name: getInputVal('ex-make-play2-name'), exMakePlay2Issue: getInputVal('ex-make-play2-issue'), exMakePlay2Note: getInputVal('ex-make-play2-note'),
    // Evening - Education
    edInspireName: getInputVal('ed-inspire-name'), edInspireIssue: getInputVal('ed-inspire-issue'), edInspireNote: getInputVal('ed-inspire-note'),
    edInnovationName: getInputVal('ed-innovation-name'), edInnovationIssue: getInputVal('ed-innovation-issue'), edInnovationNote: getInputVal('ed-innovation-note'),
    edMiniName: getInputVal('ed-mini-name'), edMiniIssue: getInputVal('ed-mini-issue'), edMiniNote: getInputVal('ed-mini-note'),
    modSign: getInputVal('mod-sign'), signDate: getInputVal('sign-date'),
    // Visitors A
    visAThai: { child: getVal('vis-a-thai-child'), adult: getVal('vis-a-thai-adult') },
    visAFor: { child: getVal('vis-a-for-child'), adult: getVal('vis-a-for-adult') },
    visAMem: { child: getVal('vis-a-mem-child'), adult: getVal('vis-a-mem-adult'), fc: getVal('vis-a-mem-fc'), fa: getVal('vis-a-mem-fa') },
    // Visitors B (computed from group rows)
    visBThai: { child: bThaiChild, adult: bThaiAdult },
    visBFor: { child: bForChild, adult: bForAdult },
    visBMem: { ic: getVal('vis-b-ic'), ia: getVal('vis-b-ia') },
    // Visitors C
    visCsenior: getVal('vis-c-senior'),
    // Visitors D
    visDIns: { tc: getVal('vis-d-ins-tc'), ta: getVal('vis-d-ins-ta'), fc: getVal('vis-d-ins-fc'), fa: getVal('vis-d-ins-fa') },
    visDInv: { tc: getVal('vis-d-inv-tc'), ta: getVal('vis-d-inv-ta'), fc: getVal('vis-d-inv-fc'), fa: getVal('vis-d-inv-fa') },
    visDWr: { tc: getVal('vis-d-wr-tc'), ta: getVal('vis-d-wr-ta'), fc: getVal('vis-d-wr-fc'), fa: getVal('vis-d-wr-fa') },
    visDMm: { child: getVal('vis-d-mm-child') },
    visDSp: { tc: getVal('vis-d-sp-tc'), ta: getVal('vis-d-sp-ta'), fc: getVal('vis-d-sp-fc'), fa: getVal('vis-d-sp-fa') },
    visDOth: { name: getInputVal('vis-d-oth-name'), count: getVal('vis-d-oth-count') },
    // Revenue
    rev: {
      ex: getFloatVal('rev-ex'), ins: getFloatVal('rev-ins'), inv: getFloatVal('rev-inv'),
      wr: getFloatVal('rev-wr'), mm: getFloatVal('rev-mm'), sp: getFloatVal('rev-sp'),
      mem: getFloatVal('rev-mem'), oth: getFloatVal('rev-oth')
    },
    online: {
      ex: getFloatVal('online-ex'), ins: getFloatVal('online-ins'), inv: getFloatVal('online-inv'),
      wr: getFloatVal('online-wr'), mm: getFloatVal('online-mm'), sp: getFloatVal('online-sp'),
      mem: getFloatVal('online-mem'), oth: getFloatVal('online-oth')
    },
    notes: getInputVal('daily-notes'),
    totalVisitors,
    totalRevenue
  };
}

function setFormData(data) {
  if (!data) return;
  setInputVal('mod-morning', data.modMorning);
  setInputVal('m-exhibition', data.mExhibition);
  setInputVal('m-education', data.mEducation);
  setInputVal('m-visitor-service', data.mVisitor);
  setChecked('cb-inspire-lab', data.cbInspireLab);
  setChecked('cb-innovation-space', data.cbInnovationSpace);
  setChecked('cb-walk-rally', data.cbWalkRally);
  setInputVal('hours-tue-fri', data.hoursTueFri);
  setInputVal('hours-sat-sun', data.hoursSatSun);
  setInputVal('hours-closed', data.hoursClosed);
  setInputVal('m-education-activities', data.mEducationActivities);
  setInputVal('visitor-service-info', data.visitorServiceInfo);
  setInputVal('regulation-1', data.regulation1);
  setInputVal('regulation-2', data.regulation2);
  setInputVal('special1', data.special1);
  setInputVal('special2', data.special2);
  setInputVal('special3', data.special3);
  setInputVal('special4', data.special4);
  setInputVal('special5', data.special5);
  setInputVal('special6', data.special6);
  // Booking rows
  const tbody = document.getElementById('booking-tbody');
  if (tbody) { tbody.innerHTML = ''; bookingRowCount = 0; }
  if (data.bookings && data.bookings.length) {
    data.bookings.forEach(b => addBookingRow(b));
  }
  // Group rows (Section B)
  const groupTbody = document.getElementById('group-tbody');
  if (groupTbody) { groupTbody.innerHTML = ''; groupRowCount = 0; }
  if (data.groups && data.groups.length) {
    data.groups.forEach(g => addGroupRow(g));
  } else if ((data.visBThai?.child || data.visBThai?.adult || data.visBFor?.child || data.visBFor?.adult)) {
    // Legacy data: reconstruct a single aggregate row for backward compatibility
    addGroupRow({
      group: '',
      thaiChild: data.visBThai?.child || 0,
      thaiAdult: data.visBThai?.adult || 0,
      foreignChild: data.visBFor?.child || 0,
      foreignAdult: data.visBFor?.adult || 0
    });
  }
  // Activity rows
  const activityTbody = document.getElementById('activity-tbody');
  if (activityTbody) { activityTbody.innerHTML = ''; activityRowCount = 0; }
  if (data.activities && data.activities.length) {
    data.activities.forEach(a => addActivityRow(a));
  } else {
    addActivityRow(); // เพิ่มแถวเริ่มต้น
  }
  // Evening
  setInputVal('vs-counter2-name', data.vsCounter2Name); setInputVal('vs-counter2-issue', data.vsCounter2Issue); setInputVal('vs-counter2-note', data.vsCounter2Note);
  setInputVal('vs-counter1-name', data.vsCounter1Name); setInputVal('vs-counter1-issue', data.vsCounter1Issue); setInputVal('vs-counter1-note', data.vsCounter1Note);
  setInputVal('ex-z1-name', data.exZ1Name); setInputVal('ex-z1-issue', data.exZ1Issue); setInputVal('ex-z1-note', data.exZ1Note);
  setInputVal('ex-z2-name', data.exZ2Name); setInputVal('ex-z2-issue', data.exZ2Issue); setInputVal('ex-z2-note', data.exZ2Note);
  setInputVal('ex-z3-name', data.exZ3Name); setInputVal('ex-z3-issue', data.exZ3Issue); setInputVal('ex-z3-note', data.exZ3Note);
  setInputVal('ex-z4-name', data.exZ4Name); setInputVal('ex-z4-issue', data.exZ4Issue); setInputVal('ex-z4-note', data.exZ4Note);
  setInputVal('ex-innovation-name', data.exInnovationName); setInputVal('ex-innovation-issue', data.exInnovationIssue); setInputVal('ex-innovation-note', data.exInnovationNote);
  setInputVal('ex-inspire-name', data.exInspireName); setInputVal('ex-inspire-issue', data.exInspireIssue); setInputVal('ex-inspire-note', data.exInspireNote);
  setInputVal('ex-make-play1-name', data.exMakePlay1Name); setInputVal('ex-make-play1-issue', data.exMakePlay1Issue); setInputVal('ex-make-play1-note', data.exMakePlay1Note);
  setInputVal('ex-make-play2-name', data.exMakePlay2Name); setInputVal('ex-make-play2-issue', data.exMakePlay2Issue); setInputVal('ex-make-play2-note', data.exMakePlay2Note);
  setInputVal('ed-inspire-name', data.edInspireName); setInputVal('ed-inspire-issue', data.edInspireIssue); setInputVal('ed-inspire-note', data.edInspireNote);
  setInputVal('ed-innovation-name', data.edInnovationName); setInputVal('ed-innovation-issue', data.edInnovationIssue); setInputVal('ed-innovation-note', data.edInnovationNote);
  setInputVal('ed-mini-name', data.edMiniName); setInputVal('ed-mini-issue', data.edMiniIssue); setInputVal('ed-mini-note', data.edMiniNote);
  setInputVal('mod-sign', data.modSign); setInputVal('sign-date', data.signDate);
  // Visitors A
  const va = data.visAThai || {}; setInputVal('vis-a-thai-child', va.child||0); setInputVal('vis-a-thai-adult', va.adult||0);
  const vaf = data.visAFor || {}; setInputVal('vis-a-for-child', vaf.child||0); setInputVal('vis-a-for-adult', vaf.adult||0);
  const vam = data.visAMem || {}; setInputVal('vis-a-mem-child', vam.child||0); setInputVal('vis-a-mem-adult', vam.adult||0); setInputVal('vis-a-mem-fc', vam.fc||0); setInputVal('vis-a-mem-fa', vam.fa||0);
  // Visitors B is restored via group rows above (calcGroupRows is called by addGroupRow)
  const vbm = data.visBMem || {}; setInputVal('vis-b-ic', vbm.ic||0); setInputVal('vis-b-ia', vbm.ia||0);
  // Visitors C
  setInputVal('vis-c-senior', data.visCsenior||0);
  // Visitors D
  const vdi = data.visDIns || {}; setInputVal('vis-d-ins-tc', vdi.tc||0); setInputVal('vis-d-ins-ta', vdi.ta||0); setInputVal('vis-d-ins-fc', vdi.fc||0); setInputVal('vis-d-ins-fa', vdi.fa||0);
  const vdn = data.visDInv || {}; setInputVal('vis-d-inv-tc', vdn.tc||0); setInputVal('vis-d-inv-ta', vdn.ta||0); setInputVal('vis-d-inv-fc', vdn.fc||0); setInputVal('vis-d-inv-fa', vdn.fa||0);
  const vdw = data.visDWr || {}; setInputVal('vis-d-wr-tc', vdw.tc||0); setInputVal('vis-d-wr-ta', vdw.ta||0); setInputVal('vis-d-wr-fc', vdw.fc||0); setInputVal('vis-d-wr-fa', vdw.fa||0);
  const vdm = data.visDMm || {}; setInputVal('vis-d-mm-child', vdm.child||0);
  const vds = data.visDSp || {}; setInputVal('vis-d-sp-tc', vds.tc||0); setInputVal('vis-d-sp-ta', vds.ta||0); setInputVal('vis-d-sp-fc', vds.fc||0); setInputVal('vis-d-sp-fa', vds.fa||0);
  const vdo = data.visDOth || {}; setInputVal('vis-d-oth-name', vdo.name||''); setInputVal('vis-d-oth-count', vdo.count||0);
  // Revenue
  const rev = data.rev || {}; const online = data.online || {};
  ['ex','ins','inv','wr','mm','sp','mem','oth'].forEach(c => {
    setInputVal('rev-'+c, rev[c]||0);
    setInputVal('online-'+c, online[c]||0);
  });
  setInputVal('daily-notes', data.notes);
  // Recalculate
  calcGroupRows();
  calcVis();
  calcRev();
}


function clearFormFields() {
  // Reset all inputs in daily log
  document.querySelectorAll('#page-daily-log input[type=text], #page-daily-log input[type=number], #page-daily-log textarea').forEach(el => {
    el.value = el.type === 'number' ? '0' : '';
  });
  document.querySelectorAll('#page-daily-log input[type=checkbox]').forEach(el => el.checked = false);
  const tbody = document.getElementById('booking-tbody');
  if (tbody) { tbody.innerHTML = ''; bookingRowCount = 0; }
  const groupTbody = document.getElementById('group-tbody');
  if (groupTbody) { groupTbody.innerHTML = ''; groupRowCount = 0; }
  // เคลียร์ activity rows
  const activityTbody = document.getElementById('activity-tbody');
  if (activityTbody) { activityTbody.innerHTML = ''; activityRowCount = 0; addActivityRow(); }
  calcGroupRows();
  calcVis();
  calcRev();
}

function clearAllFields() {
  if (confirm('ล้างข้อมูลทั้งหมดในฟอร์มนี้ใช่หรือไม่?')) {
    clearFormFields();
    showToast('ล้างข้อมูลเรียบร้อยแล้ว', 'info');
  }
}

function saveToLocal(showMsg = true) {
  const data = getFormData();
  if (!data.date || data.date === '--') { showToast('กรุณาเลือกวันที่', 'warning'); return; }
  const key = 'nsm_' + data.date;
  localStorage.setItem(key, JSON.stringify(data));
  if (showMsg) showToast('บันทึกสำเร็จ: ' + data.date, 'success');
}

function loadFromLocal(date) {
  if (!date) return;
  const key = 'nsm_' + date;
  const raw = localStorage.getItem(key);
  if (raw) {
    try { setFormData(JSON.parse(raw)); }
    catch(e) { console.error('loadFromLocal error', e); }
  } else {
    clearFormFields();
  }
}

function getAllRecords() {
  const records = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('nsm_2')) {
      try { records.push(JSON.parse(localStorage.getItem(key))); } catch(e) {}
    }
  }
  return records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function deleteRecord(date) {
  localStorage.removeItem('nsm_' + date);
}

// ============ GOOGLE SHEETS ============
function submitAll() {
  // 1. ตรวจสอบข้อมูล
  const errors = validateDailyForm();
  if (errors.length > 0) {
    errors.forEach((msg, i) => setTimeout(() => showToast(msg, 'error'), i * 450));
    return;
  }
  // 2. บันทึกลง localStorage ก่อน
  saveToLocal(false);
  // 3. ส่ง Google Sheets (ถ้าตั้งค่า URL ไว้)
  const settings = getSettings();
  if (!settings.sheetsURL) {
    showToast('บันทึกสำเร็จ! (ยังไม่ได้ตั้งค่า Google Sheets URL)', 'success');
    return;
  }
  const records = getAllRecords();
  if (!records.length) { showToast('ไม่มีข้อมูลที่จะส่ง', 'warning'); return; }
  showProgress('กำลังบันทึกและส่งข้อมูล...', `กำลังส่ง ${records.length} รายการ ไปยัง Google Sheets`);
  const payload = JSON.stringify({
    action: 'bulkInsert',
    sheetName: settings.sheetName || 'Sheet1',
    records: records.map(r => ({ ...r, submittedAt: new Date().toISOString() }))
  });
  fetch(settings.sheetsURL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: payload
  })
  .then(r => r.text())
  .then(() => {
    hideProgress();
    showToast('บันทึกและส่ง Google Sheets สำเร็จ! ' + records.length + ' รายการ', 'success');
  })
  .catch(err => {
    hideProgress();
    showToast('บันทึกสำเร็จ แต่ไม่สามารถส่ง Google Sheets: ' + err.message, 'warning');
  });
}

function showProgress(title, sub) {
  const ov = document.getElementById('progress-overlay');
  if (ov) {
    setTxt('progress-title', title);
    setTxt('progress-sub', sub);
    ov.style.display = 'flex';
  }
}
function hideProgress() {
  const ov = document.getElementById('progress-overlay');
  if (ov) ov.style.display = 'none';
}

// ============ HISTORY ============
let allHistoryRecords = [];
function renderHistory(filterMonth) {
  allHistoryRecords = getAllRecords();
  let records = allHistoryRecords;
  // Populate filter dropdown
  const filterSel = document.getElementById('history-filter-month');
  if (filterSel) {
    const months = [...new Set(records.map(r => (r.date || '').substring(0,7)))].sort().reverse();
    const curFilter = filterSel.value;
    filterSel.innerHTML = '<option value="">ทั้งหมด</option>';
    months.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      const [y, mo] = m.split('-');
      opt.textContent = `${MONTH_NAMES[parseInt(mo)-1]} ${parseInt(y)+543}`;
      filterSel.appendChild(opt);
    });
    filterSel.value = filterMonth || curFilter || '';
  }
  if (filterMonth) {
    records = records.filter(r => (r.date || '').startsWith(filterMonth));
  }
  // Stats
  const totalVis = records.reduce((s, r) => s + (r.totalVisitors || 0), 0);
  const totalRev = records.reduce((s, r) => s + (r.totalRevenue || 0), 0);
  const months = new Set(records.map(r => (r.date || '').substring(0,7)));
  setTxt('history-stat-total', records.length);
  setTxt('history-stat-visitors', fmtNum(totalVis));
  setTxt('history-stat-revenue', fmtNum(totalRev));
  setTxt('history-stat-months', months.size);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(records.length / ITEMS_PER_PAGE));
  historyPage = Math.min(historyPage, totalPages);
  const start = (historyPage - 1) * ITEMS_PER_PAGE;
  const pageRecords = records.slice(start, start + ITEMS_PER_PAGE);

  const tbody = document.getElementById('history-tbody');
  if (!tbody) return;
  if (!pageRecords.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px;">ยังไม่มีข้อมูล</td></tr>';
  } else {
    tbody.innerHTML = pageRecords.map(r => {
      const walkin = calcWalkinFromData(r);
      const group = calcGroupFromData(r);
      const edu = calcEduFromData(r);
      const safeDate = sanitizeDate(r.date);
      return `<tr>
        <td style="white-space:nowrap;">${escHtml(r.date || '-')}</td>
        <td>${escHtml(r.modMorning || '-')}</td>
        <td>${fmtNum(walkin)}</td>
        <td>${fmtNum(group)}</td>
        <td>${fmtNum(edu)}</td>
        <td style="font-weight:600;color:var(--accent);">${fmtNum(r.totalVisitors || 0)}</td>
        <td style="color:var(--warning);">${fmtNum(r.totalRevenue || 0)}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-ghost btn-sm" onclick="viewRecord('${safeDate}')" title="ดูรายละเอียด">👁</button>
          <button class="btn btn-ghost btn-sm" onclick="exportDailyBriefingPDF('${safeDate}')" title="Export Briefing PDF" style="color:var(--danger);">📄</button>
          <button class="btn btn-ghost btn-sm" onclick="editRecord('${safeDate}')" title="แก้ไข" style="color:var(--info);">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="confirmDelete('${safeDate}')" title="ลบ" style="color:var(--danger);">🗑</button>
        </td>
      </tr>`;
    }).join('');
  }
  // Info
  setTxt('history-info', `แสดง ${start+1}-${Math.min(start+ITEMS_PER_PAGE, records.length)} จาก ${records.length} รายการ`);
  // Pagination
  renderPagination(totalPages, records, filterMonth);
}

function renderPagination(totalPages, records, filterMonth) {
  const pg = document.getElementById('history-pagination');
  if (!pg) return;
  if (totalPages <= 1) { pg.innerHTML = ''; return; }
  // Sanitize filterMonth — must be YYYY-MM format only
  const safeFilter = sanitizeYearMonth(filterMonth);
  let html = '';
  html += `<button class="page-btn" onclick="setHistoryPage(${historyPage-1},'${safeFilter}')" ${historyPage===1?'disabled':''}>‹</button>`;
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - historyPage) <= 1) {
      html += `<button class="page-btn ${p===historyPage?'active':''}" onclick="setHistoryPage(${p},'${safeFilter}')">${p}</button>`;
    } else if (Math.abs(p - historyPage) === 2) {
      html += '<span style="color:var(--text-muted);padding:0 4px;">…</span>';
    }
  }
  html += `<button class="page-btn" onclick="setHistoryPage(${historyPage+1},'${safeFilter}')" ${historyPage===totalPages?'disabled':''}>›</button>`;
  pg.innerHTML = html;
}

function setHistoryPage(p, filter) {
  historyPage = p;
  renderHistory(filter);
}

function calcWalkinFromData(r) {
  const va = r.visAThai||{}, vaf = r.visAFor||{}, vam = r.visAMem||{};
  return (va.child||0)+(va.adult||0)+(vaf.child||0)+(vaf.adult||0)+(vam.child||0)+(vam.adult||0)+(vam.fc||0)+(vam.fa||0);
}
function calcGroupFromData(r) {
  const vb = r.visBThai||{}, vbf = r.visBFor||{}, vbm = r.visBMem||{};
  return (vb.child||0)+(vb.adult||0)+(vbf.child||0)+(vbf.adult||0)+(vbm.ic||0)+(vbm.ia||0);
}
function calcEduFromData(r) {
  const di = r.visDIns||{}, dn = r.visDInv||{}, dw = r.visDWr||{}, dm = r.visDMm||{}, ds = r.visDSp||{}, doth = r.visDOth||{};
  return (di.tc||0)+(di.ta||0)+(di.fc||0)+(di.fa||0)+(dn.tc||0)+(dn.ta||0)+(dn.fc||0)+(dn.fa||0)+(dw.tc||0)+(dw.ta||0)+(dw.fc||0)+(dw.fa||0)+(dm.child||0)+(ds.tc||0)+(ds.ta||0)+(ds.fc||0)+(ds.fa||0)+(doth.count||0);
}

function viewRecord(date) {
  const raw = localStorage.getItem('nsm_' + date);
  if (!raw) { showToast('ไม่พบข้อมูล', 'error'); return; }
  const r = JSON.parse(raw);
  const walkin = calcWalkinFromData(r);
  const group = calcGroupFromData(r);
  const edu = calcEduFromData(r);
  const content = document.getElementById('view-modal-content');
  if (content) {
    content.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
        <div class="preview-box">
          <div class="preview-row"><span class="preview-label">วันที่</span><span class="preview-value">${escHtml(r.date||'-')}</span></div>
          <div class="preview-row"><span class="preview-label">MOD</span><span class="preview-value">${escHtml(r.modMorning||'-')}</span></div>
          <div class="preview-row"><span class="preview-label">M-Exhibition</span><span class="preview-value">${escHtml(r.mExhibition||'-')}</span></div>
          <div class="preview-row"><span class="preview-label">M-Education</span><span class="preview-value">${escHtml(r.mEducation||'-')}</span></div>
          <div class="preview-row"><span class="preview-label">M-Visitor Service</span><span class="preview-value">${escHtml(r.mVisitor||'-')}</span></div>
        </div>
        <div class="preview-box">
          <div class="preview-row"><span class="preview-label">Walk-in</span><span class="preview-value">${fmtNum(walkin)}</span></div>
          <div class="preview-row"><span class="preview-label">กลุ่ม</span><span class="preview-value">${fmtNum(group)}</span></div>
          <div class="preview-row"><span class="preview-label">การศึกษา</span><span class="preview-value">${fmtNum(edu)}</span></div>
          <div class="preview-row" style="border-top:2px solid var(--accent);padding-top:10px;"><span class="preview-label">รวมทั้งหมด</span><span class="preview-value" style="color:var(--accent);font-size:18px;">${fmtNum(r.totalVisitors||0)}</span></div>
          <div class="preview-row"><span class="preview-label">รายได้รวม</span><span class="preview-value" style="color:var(--warning);">${fmtNum(r.totalRevenue||0)} บาท</span></div>
        </div>
      </div>
      ${r.notes ? `<div class="info-box"><strong>หมายเหตุ:</strong> ${escHtml(r.notes)}</div>` : ''}
      <div style="margin-top:12px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
        <button class="btn btn-ghost btn-sm" onclick="exportDailyBriefingPDF('${sanitizeDate(date)}')">📄 Export Briefing PDF</button>
        <button class="btn btn-primary btn-sm" onclick="editRecord('${sanitizeDate(date)}');closeModal('view-modal')">✏️ แก้ไขข้อมูล</button>
      </div>
    `;
  }
  openModal('view-modal');
}

function editRecord(date) {
  gotoPage('daily-log');
  // Set date selectors
  const parts = date.split('-');
  if (parts.length === 3) {
    setInputVal('date-year', parts[0]);
    setInputVal('date-month', parts[1]);
    onYearMonthChange();
    setInputVal('date-day', parts[2]);
    onDateChange();
  }
}

function confirmDelete(date) {
  pendingDeleteDate = date;
  setTxt('delete-date-label', date);
  openModal('delete-modal');
}

function doDelete() {
  if (!pendingDeleteDate) return;
  deleteRecord(pendingDeleteDate);
  closeModal('delete-modal');
  showToast('ลบข้อมูลวันที่ ' + pendingDeleteDate + ' เรียบร้อย', 'success');
  pendingDeleteDate = null;
  renderHistory(document.getElementById('history-filter-month')?.value || '');
}

// ============ SUMMARY ============
function renderSummary() {
  const records = getAllRecords();
  const totalVis = records.reduce((s,r) => s+(r.totalVisitors||0),0);
  const totalRev = records.reduce((s,r) => s+(r.totalRevenue||0),0);
  const avg = records.length ? Math.round(totalVis / records.length) : 0;
  setTxt('sum-stat-records', records.length);
  setTxt('sum-stat-visitors', fmtNum(totalVis));
  setTxt('sum-stat-revenue', fmtNum(totalRev));
  setTxt('sum-stat-avg', fmtNum(avg));

  // Monthly breakdown
  const monthly = {};
  records.forEach(r => {
    const ym = (r.date||'').substring(0,7);
    if (!ym) return;
    if (!monthly[ym]) monthly[ym] = { days:0, visitors:0, revenue:0 };
    monthly[ym].days++;
    monthly[ym].visitors += r.totalVisitors||0;
    monthly[ym].revenue += r.totalRevenue||0;
  });

  // MOD performance
  const modPerf = {};
  records.forEach(r => {
    const mod = r.modMorning || '(ไม่ระบุ)';
    if (!modPerf[mod]) modPerf[mod] = { days:0, visitors:0 };
    modPerf[mod].days++;
    modPerf[mod].visitors += r.totalVisitors||0;
  });
  const modList = Object.entries(modPerf).sort((a,b)=>b[1].visitors-a[1].visitors).slice(0,10);
  const modTbody = document.getElementById('sum-mod-tbody');
  if (modTbody) {
    if (!modList.length) {
      modTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">ยังไม่มีข้อมูล</td></tr>';
    } else {
      modTbody.innerHTML = modList.map(([name, d], i) =>
        `<tr><td style="color:var(--text-muted);">${i+1}</td><td>${escHtml(name)}</td><td>${d.days}</td><td style="color:var(--success);">${fmtNum(d.visitors)}</td></tr>`
      ).join('');
    }
  }

  // Monthly table
  const monthTbody = document.getElementById('sum-month-tbody');
  if (monthTbody) {
    const sortedMonths = Object.keys(monthly).sort().reverse();
    if (!sortedMonths.length) {
      monthTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">ยังไม่มีข้อมูล</td></tr>';
    } else {
      monthTbody.innerHTML = sortedMonths.map(ym => {
        const m = monthly[ym];
        const [y, mo] = ym.split('-');
        const label = `${MONTH_NAMES[parseInt(mo)-1]} ${parseInt(y)+543}`;
        const avgM = m.days ? Math.round(m.visitors / m.days) : 0;
        return `<tr>
          <td>${label}</td><td>${m.days}</td>
          <td style="color:var(--success);">${fmtNum(m.visitors)}</td>
          <td style="color:var(--warning);">${fmtNum(m.revenue)}</td>
          <td>${fmtNum(avgM)}</td>
        </tr>`;
      }).join('');
    }
  }

  // Update summary chart
  const sortedMonths = Object.keys(monthly).sort().slice(-12);
  const chartLabels = sortedMonths.map(ym => {
    const [y, mo] = ym.split('-');
    return MONTH_NAMES[parseInt(mo)-1].substring(0,3) + ' ' + (parseInt(y)+543-2500);
  });
  const chartData = sortedMonths.map(ym => monthly[ym].visitors);
  initSummaryChart(chartLabels, chartData);
}

// ============ EXPORT ============
function renderExportPreview() {
  const records = getAllRecords();
  setTxt('export-count', records.length);
  const tbody = document.getElementById('export-preview-tbody');
  if (!tbody) return;
  if (!records.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">ยังไม่มีข้อมูล</td></tr>';
    return;
  }
  tbody.innerHTML = records.slice(0, 10).map(r =>
    `<tr><td>${escHtml(r.date||'-')}</td><td>${escHtml(r.modMorning||'-')}</td><td style="color:var(--success);">${fmtNum(r.totalVisitors||0)}</td><td style="color:var(--warning);">${fmtNum(r.totalRevenue||0)}</td></tr>`
  ).join('');
  if (records.length > 10) {
    tbody.innerHTML += `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);font-size:12px;">... และอีก ${records.length-10} รายการ</td></tr>`;
  }
}

function exportCSV(startDate, endDate) {
  let records = getAllRecords();
  if (startDate) records = records.filter(r => r.date >= startDate);
  if (endDate) records = records.filter(r => r.date <= endDate);
  if (!records.length) { showToast('ไม่มีข้อมูลในช่วงที่เลือก', 'warning'); return; }
  const headers = ['วันที่','MOD','M-Exhibition','M-Education','M-Visitor Service','Walk-in ไทย (เด็ก)','Walk-in ไทย (ผู้ใหญ่)','Walk-in ต่างชาติ (เด็ก)','Walk-in ต่างชาติ (ผู้ใหญ่)','สมาชิก (เด็ก)','สมาชิก (ผู้ใหญ่)','สมาชิก FC','สมาชิก FA','กลุ่ม ไทย (เด็ก)','กลุ่ม ไทย (ผู้ใหญ่)','กลุ่ม ต่างชาติ (เด็ก)','กลุ่ม ต่างชาติ (ผู้ใหญ่)','กลุ่ม IC','กลุ่ม IA','ผู้สูงอายุ','Inspire Lab','Innovation Space','Walk Rally','Mini Make & Play','Special Event','อื่น ๆ','รวมผู้เข้าชม','รายได้ Exhibition','รายได้ Inspire','รายได้ Innovation','รายได้ Walk Rally','รายได้ Mini','รายได้ Special','รายได้ สมาชิก','รายได้ อื่น ๆ','รวมรายได้','หมายเหตุ'];
  const rows = records.map(r => {
    const va=r.visAThai||{}, vaf=r.visAFor||{}, vam=r.visAMem||{};
    const vb=r.visBThai||{}, vbf=r.visBFor||{}, vbm=r.visBMem||{};
    const di=r.visDIns||{}, dn=r.visDInv||{}, dw=r.visDWr||{}, dm=r.visDMm||{}, ds=r.visDSp||{}, doth=r.visDOth||{};
    const rev=r.rev||{}, onl=r.online||{};
    const dIns=(di.tc||0)+(di.ta||0)+(di.fc||0)+(di.fa||0);
    const dInv=(dn.tc||0)+(dn.ta||0)+(dn.fc||0)+(dn.fa||0);
    const dWr=(dw.tc||0)+(dw.ta||0)+(dw.fc||0)+(dw.fa||0);
    const dSp=(ds.tc||0)+(ds.ta||0)+(ds.fc||0)+(ds.fa||0);
    return [
      r.date, r.modMorning, r.mExhibition, r.mEducation, r.mVisitor,
      va.child, va.adult, vaf.child, vaf.adult, vam.child, vam.adult, vam.fc, vam.fa,
      vb.child, vb.adult, vbf.child, vbf.adult, vbm.ic, vbm.ia,
      r.visCsenior||0, dIns, dInv, dWr, dm.child||0, dSp, doth.count||0,
      r.totalVisitors,
      (rev.ex||0)+(onl.ex||0),(rev.ins||0)+(onl.ins||0),(rev.inv||0)+(onl.inv||0),(rev.wr||0)+(onl.wr||0),(rev.mm||0)+(onl.mm||0),(rev.sp||0)+(onl.sp||0),(rev.mem||0)+(onl.mem||0),(rev.oth||0)+(onl.oth||0),
      r.totalRevenue,
      r.notes||''
    ].map(v => `"${String(v||'').replace(/"/g,'""')}"`);
  });
  const csv = '\uFEFF' + [headers.map(h=>`"${h}"`), ...rows].map(r=>r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const suffix = startDate && endDate ? `_${startDate}_to_${endDate}` : '_all';
  link.download = `nsm_mod_data${suffix}.csv`;
  link.click();
  showToast(`Export CSV สำเร็จ: ${records.length} รายการ`, 'success');
}

function exportPDF(startDate, endDate) {
  let records = getAllRecords();
  if (startDate) records = records.filter(r => r.date >= startDate);
  if (endDate) records = records.filter(r => r.date <= endDate);
  if (!records.length) { showToast('ไม่มีข้อมูลในช่วงที่เลือก', 'warning'); return; }
  try {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) { showToast('ไม่พบ jsPDF library', 'error'); return; }
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('NSM MOD Management System - Report', 148, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString('th-TH')} | Records: ${records.length}`, 148, 22, { align: 'center' });
    const headers = [['Date','MOD','Walk-in','Group','Education','Total Vis.','Revenue (THB)','Notes']];
    const rows = records.map(r => [
      r.date||'', r.modMorning||'', fmtNum(calcWalkinFromData(r)), fmtNum(calcGroupFromData(r)), fmtNum(calcEduFromData(r)), fmtNum(r.totalVisitors||0), fmtNum(r.totalRevenue||0), (r.notes||'').substring(0,40)
    ]);
    // Totals row
    const totVis = records.reduce((s,r)=>s+(r.totalVisitors||0),0);
    const totRev = records.reduce((s,r)=>s+(r.totalRevenue||0),0);
    rows.push(['TOTAL','','','','', fmtNum(totVis), fmtNum(totRev),'']);
    doc.autoTable({
      head: headers, body: rows,
      startY: 28, theme: 'grid',
      headStyles: { fillColor: [0, 85, 255], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 245, 250] },
      margin: { left: 10, right: 10 },
      didDrawRow: (data) => {
        if (data.row.index === rows.length - 1) {
          doc.setFillColor(0, 85, 255);
        }
      }
    });
    const suffix = startDate && endDate ? `_${startDate}_to_${endDate}` : '_all';
    doc.save(`nsm_mod_report${suffix}.pdf`);
    showToast(`Export PDF สำเร็จ: ${records.length} รายการ`, 'success');
  } catch(e) {
    console.error('PDF export error:', e);
    showToast('เกิดข้อผิดพลาดในการสร้าง PDF: ' + (e.message || 'unknown error'), 'error');
  }
}

// ============ DAILY BRIEFING PDF EXPORT ============
/**
 * โหลด LOGO.png เป็น data URL สำหรับฝังใน PDF
 */
async function getLogoDataUrl() {
  try {
    const response = await fetch('./LOGO.png');
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) { return null; }
}

/**
 * สร้าง HTML Popup และ Print เป็น PDF รูปแบบ Daily Briefing
 * ใช้ฟอนต์ Sarabun (TH Sarabun) จาก Google Fonts
 * หน้าที่ 1: Briefing ช่วงเช้า + Briefing ช่วงเย็น
 * หน้าที่ 2: ยอดผู้เข้าชม + รายได้ + ลายเซ็น
 */
async function exportDailyBriefingPDF(date) {
  if (!date) { showToast('กรุณาระบุวันที่', 'warning'); return; }
  const raw = localStorage.getItem('nsm_' + date);
  if (!raw) { showToast('ไม่พบข้อมูลวันที่ ' + date, 'warning'); return; }
  let r;
  try { r = JSON.parse(raw); } catch(e) { showToast('ข้อมูลผิดพลาด', 'error'); return; }

  // ---- วันที่ภาษาไทย ----
  const thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
    'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  function toThaiDate(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const d = parseInt(parts[2], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[0], 10) + 543;
    return `${d} ${thaiMonths[m]} ${y}`;
  }
  const today = new Date();
  const genDate = `${today.getDate()}/${today.getMonth()+1}/${today.getFullYear()+543}`;
  const recDate = toThaiDate(date);

  // ---- ข้อมูลผู้เข้าชม ----
  const va = r.visAThai||{}, vaf = r.visAFor||{}, vam = r.visAMem||{};
  const vb = r.visBThai||{}, vbf = r.visBFor||{}, vbm = r.visBMem||{};
  const vdi = r.visDIns||{}, vdn = r.visDInv||{}, vdw = r.visDWr||{};
  const vdm = r.visDMm||{}, vds = r.visDSp||{}, vdo = r.visDOth||{};
  const rev = r.rev||{}, onl = r.online||{};

  const aThaiC = va.child||0, aThaiA = va.adult||0;
  const aForC = vaf.child||0, aForA = vaf.adult||0;
  const aMemC = vam.child||0, aMemA = vam.adult||0, aMemFC = vam.fc||0, aMemFA = vam.fa||0;
  const aTotal = aThaiC+aThaiA+aForC+aForA+aMemC+aMemA+aMemFC+aMemFA;

  const bThaiC = vb.child||0, bThaiA = vb.adult||0;
  const bForC = vbf.child||0, bForA = vbf.adult||0;
  const bIC = vbm.ic||0, bIA = vbm.ia||0;
  const bTotal = bThaiC+bThaiA+bForC+bForA+bIC+bIA;

  const cSenior = r.visCsenior||0;

  const dInsTotal = (vdi.tc||0)+(vdi.ta||0)+(vdi.fc||0)+(vdi.fa||0);
  const dInvTotal = (vdn.tc||0)+(vdn.ta||0)+(vdn.fc||0)+(vdn.fa||0);
  const dWrTotal  = (vdw.tc||0)+(vdw.ta||0)+(vdw.fc||0)+(vdw.fa||0);
  const dMmTotal  = vdm.child||0;
  const dSpTotal  = (vds.tc||0)+(vds.ta||0)+(vds.fc||0)+(vds.fa||0);
  const dOthTotal = vdo.count||0;
  const dTotal = dInsTotal+dInvTotal+dWrTotal+dMmTotal+dSpTotal+dOthTotal;

  const grandTotal = r.totalVisitors || (aTotal+bTotal+cSenior+dTotal);
  const totalRevenue = r.totalRevenue || 0;

  // ---- Nationality splits ----
  const walkInThai = aThaiC + aThaiA;
  const walkInForeign = aForC + aForA;
  const groupThai = bThaiC + bThaiA;
  const groupForeign = bForC + bForA;
  const eduThai = (vdi.tc||0)+(vdi.ta||0) + (vdn.tc||0)+(vdn.ta||0) + (vdw.tc||0)+(vdw.ta||0) + dMmTotal + (vds.tc||0)+(vds.ta||0);
  const eduForeign = (vdi.fc||0)+(vdi.fa||0) + (vdn.fc||0)+(vdn.fa||0) + (vdw.fc||0)+(vdw.fa||0) + (vds.fc||0)+(vds.fa||0);

  // ---- Summary by nationality and age ----
  const sumThaiChild = aThaiC + bThaiC + aMemC + bIC + (vdi.tc||0) + (vdn.tc||0) + (vdw.tc||0) + dMmTotal + (vds.tc||0);
  const sumThaiAdult = aThaiA + bThaiA + aMemA + bIA + (vdi.ta||0) + (vdn.ta||0) + (vdw.ta||0) + (vds.ta||0);
  const sumForChild  = aForC + bForC + aMemFC + (vdi.fc||0) + (vdn.fc||0) + (vdw.fc||0) + (vds.fc||0);
  const sumForAdult  = aForA + bForA + aMemFA + (vdi.fa||0) + (vdn.fa||0) + (vdw.fa||0) + (vds.fa||0);
  const sumAllChild  = sumThaiChild + sumForChild;
  // Note: cSenior (ผู้สูงอายุ) are counted as adults by definition.
  // dOthTotal (other education activities) has no age/nationality breakdown, so counted as adults.
  const sumAllAdult  = sumThaiAdult + sumForAdult + cSenior + dOthTotal;

  // ---- HTML-escape shorthand (all user data must be escaped before inserting into HTML) ----
  const e = s => escHtml(String(s || ''));

  // ---- bookings HTML ----
  const bookingRows = (r.bookings||[]).map((b,i) =>
    `<tr><td>${i+1}</td><td>${e(b.group)}</td><td>${e(b.count)}</td><td>${e(b.time)}</td><td>${e(b.responsible)}</td></tr>`
  ).join('') || '<tr><td colspan="5" style="text-align:center;color:#888;">ไม่มีข้อมูล</td></tr>';

  // ---- activities HTML ----
  const actRows = (r.activities||[]).map(a => {
    const total = (a.thaiChild||0)+(a.thaiAdult||0)+(a.foreignChild||0)+(a.foreignAdult||0);
    return `<tr><td>${e(a.name||a.type)}</td><td>${e(a.operator)}</td><td>${a.thaiChild||0}</td><td>${a.thaiAdult||0}</td><td>${a.foreignChild||0}</td><td>${a.foreignAdult||0}</td><td>${total}</td></tr>`;
  }).join('') || '<tr><td colspan="7" style="text-align:center;color:#888;">ไม่มีข้อมูล</td></tr>';

  // ---- group rows HTML ----
  const groupCount = (r.groups||[]).filter(g => (g.group||'').trim() !== '').length;
  const groupRows = (r.groups||[]).map((g,i) => {
    const total = (g.thaiChild||0)+(g.thaiAdult||0)+(g.foreignChild||0)+(g.foreignAdult||0);
    return `<tr><td>${i+1}</td><td>${e(g.group)}</td><td class="num">${g.thaiChild||0}</td><td class="num">${g.thaiAdult||0}</td><td class="num">${g.foreignChild||0}</td><td class="num">${g.foreignAdult||0}</td><td class="num">${total}</td></tr>`;
  }).join('') || '<tr><td colspan="7" style="text-align:center;color:#888;">ไม่มีข้อมูล</td></tr>';

  // ---- LOGO (embedded as data URL) ----
  const logoDataUrl = await getLogoDataUrl();
  const logoHtml = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="NSM Logo" style="height:56px;width:auto;object-fit:contain;">`
    : `<svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="56" height="56" rx="10" fill="#003087"/>
        <text x="28" y="22" text-anchor="middle" fill="white" font-size="10" font-family="Sarabun,sans-serif" font-weight="700">NSM</text>
        <text x="28" y="35" text-anchor="middle" fill="white" font-size="8" font-family="Sarabun,sans-serif">พิพิธภัณฑ์</text>
        <text x="28" y="47" text-anchor="middle" fill="white" font-size="8" font-family="Sarabun,sans-serif">วิทยาศาสตร์</text>
      </svg>`;

  // ---- specials HTML ----
  const specials = [r.special1,r.special2,r.special3,r.special4,r.special5,r.special6].filter(Boolean);
  const specialsHtml = specials.length ? `
  <div class="sub-header">กิจกรรมพิเศษ</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;margin-bottom:8px;">
    ${specials.map((s,i) => `<div class="info-item"><span class="info-label">กิจกรรม ${i+1}:</span><span class="info-value">${e(s)}</span></div>`).join('')}
  </div>` : '';

  // ---- สร้าง HTML ----
  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MOD Daily Briefing - ${date}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'TH Sarabun PSK', 'TH Sarabun New', 'Sarabun', sans-serif; font-size: 12pt; color: #1a1a1a; background: white; }
  .page { width: 210mm; min-height: 297mm; padding: 12mm 14mm; page-break-after: always; position: relative; }
  .page:last-child { page-break-after: avoid; }
  /* Header */
  .doc-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #003087; }
  .logos { display: flex; align-items: center; gap: 10px; }
  .date-box { text-align: right; font-size: 11pt; }
  .date-box .date-label { font-weight: 700; color: #003087; font-size: 12pt; }
  /* Titles */
  .section-header { background: #003087; color: white; font-weight: 700; font-size: 12pt; padding: 5px 10px; margin: 10px 0 6px; border-radius: 3px; }
  .sub-header { background: #0055FF; color: white; font-weight: 600; font-size: 11pt; padding: 4px 10px; margin: 8px 0 5px; }
  /* Staff info */
  .staff-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; margin-bottom: 8px; }
  .staff-item { display: flex; gap: 8px; }
  .staff-label { color: #444; font-size: 10pt; white-space: nowrap; }
  .staff-value { font-weight: 600; border-bottom: 1px dotted #888; flex: 1; min-width: 60px; }
  /* Tables */
  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 8px; }
  th { background: #003087; color: white; text-align: center; padding: 4px 6px; font-weight: 600; border: 1px solid #002060; }
  td { border: 1px solid #ccc; padding: 3px 6px; vertical-align: middle; }
  tr:nth-child(even) td { background: #f5f8ff; }
  .total-row td { background: #e8eeff; font-weight: 700; }
  .num { text-align: right; }
  .center { text-align: center; }
  /* Grand total box */
  .grand-box { border: 2px solid #003087; border-radius: 6px; padding: 8px 14px; display: inline-flex; align-items: center; gap: 14px; margin: 8px 0; }
  .grand-num { font-size: 22pt; font-weight: 700; color: #0055FF; }
  /* Info row */
  .info-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 6px; }
  .info-item { display: flex; gap: 6px; }
  .info-label { color: #444; font-size: 10pt; }
  .info-value { font-weight: 600; border-bottom: 1px dotted #888; min-width: 80px; }
  /* Signature */
  .sig-box { display: flex; justify-content: flex-end; margin-top: 10px; }
  .sig-inner { border: 1px solid #ccc; border-radius: 6px; padding: 10px 20px; text-align: center; min-width: 200px; }
  .sig-line { border-top: 1px solid #555; width: 160px; margin: 20px auto 4px; }
  .notes-box { border: 1px solid #ccc; border-radius: 4px; padding: 6px 10px; min-height: 30px; font-size: 10pt; color: #333; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { margin: 0; padding: 12mm 14mm; width: 100%; min-height: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>

<!-- ====== PAGE 1: BRIEFING MORNING + EVENING ====== -->
<div class="page">
  <!-- Header -->
  <div class="doc-header">
    <div class="logos">
      ${logoHtml}
      <div style="margin-left:8px;">
        <div style="font-size:14pt;font-weight:700;color:#003087;">NSM MOD System</div>
        <div style="font-size:10pt;color:#555;">Museum of Discovery — Daily Briefing</div>
      </div>
    </div>
    <div class="date-box">
      <div class="date-label">MOD วันที่ ${genDate}</div>
      <div style="font-size:10pt;color:#555;">วันที่บันทึก: ${recDate}</div>
    </div>
  </div>

  <!-- MORNING BRIEFING -->
  <div class="section-header">Briefing ช่วงเช้า — Morning Briefing</div>

  <div class="staff-grid">
    <div class="staff-item"><span class="staff-label">MOD ประจำวัน:</span><span class="staff-value">${e(r.modMorning)}</span></div>
    <div class="staff-item"><span class="staff-label">M-Exhibition:</span><span class="staff-value">${e(r.mExhibition)}</span></div>
    <div class="staff-item"><span class="staff-label">M-Education:</span><span class="staff-value">${e(r.mEducation)}</span></div>
    <div class="staff-item"><span class="staff-label">M-Visitor Service:</span><span class="staff-value">${e(r.mVisitor)}</span></div>
  </div>

  <div class="info-row">
    <div class="info-item"><span class="info-label">อังคาร–ศุกร์:</span><span class="info-value">${e(r.hoursTueFri||'เวลา 8.30 - 16.30 น.')}</span></div>
    <div class="info-item"><span class="info-label">เสาร์–อาทิตย์:</span><span class="info-value">${e(r.hoursSatSun||'เวลา 9.30 - 16.30 น.')}</span></div>
    <div class="info-item"><span class="info-label">วันหยุด:</span><span class="info-value">${e(r.hoursClosed||'หยุดทุกวันจันทร์')}</span></div>
  </div>

  ${(r.bookings||[]).length ? `
  <div class="sub-header">ตารางจองกลุ่ม</div>
  <table>
    <thead><tr><th style="width:30px">#</th><th>กลุ่ม / ชื่อ</th><th style="width:70px">จำนวน</th><th style="width:70px">เวลา</th><th>ผู้รับผิดชอบ</th></tr></thead>
    <tbody>${bookingRows}</tbody>
  </table>` : ''}

  ${r.mEducationActivities ? `
  <div class="sub-header">กิจกรรมพิเศษ M-Education</div>
  <div class="notes-box">${e(r.mEducationActivities)}</div>` : ''}

  ${specialsHtml}

  <!-- EVENING BRIEFING -->
  <div class="section-header" style="margin-top:10px;">Briefing ช่วงเย็น — Evening Briefing</div>

  <div class="sub-header">VS Visitor Service — เคาน์เตอร์</div>
  <table>
    <thead><tr><th>พื้นที่</th><th>ชื่อเจ้าหน้าที่</th><th>ปัญหา / ข้อเสนอ</th><th>หมายเหตุ</th></tr></thead>
    <tbody>
      <tr><td>เคาน์เตอร์ชั้น 1</td><td>${e(r.vsCounter1Name)}</td><td>${e(r.vsCounter1Issue)}</td><td>${e(r.vsCounter1Note)}</td></tr>
    </tbody>
  </table>

  <div class="sub-header">EX Exhibition Zones</div>
  <table>
    <thead><tr><th>พื้นที่</th><th>ชื่อเจ้าหน้าที่</th><th>ปัญหา / ข้อเสนอ</th><th>หมายเหตุ</th></tr></thead>
    <tbody>
      <tr><td>โซน 1 ค้นพบตัวตน</td><td>${e(r.exZ1Name)}</td><td>${e(r.exZ1Issue)}</td><td>${e(r.exZ1Note)}</td></tr>
      <tr><td>โซน 2 เปิดโลกทางการแพทย์</td><td>${e(r.exZ2Name)}</td><td>${e(r.exZ2Issue)}</td><td>${e(r.exZ2Note)}</td></tr>
      <tr><td>โซน 3 ฐานปฏิบัติการภัยพิบัต</td><td>${e(r.exZ3Name)}</td><td>${e(r.exZ3Issue)}</td><td>${e(r.exZ3Note)}</td></tr>
      <tr><td>โซน 4 การบินและอวกาศ</td><td>${e(r.exZ4Name)}</td><td>${e(r.exZ4Issue)}</td><td>${e(r.exZ4Note)}</td></tr>
      <tr><td>ห้อง Innovation Space</td><td>${e(r.exInnovationName)}</td><td>${e(r.exInnovationIssue)}</td><td>${e(r.exInnovationNote)}</td></tr>
      <tr><td>ห้อง Inspire Lab</td><td>${e(r.exInspireName)}</td><td>${e(r.exInspireIssue)}</td><td>${e(r.exInspireNote)}</td></tr>
      <tr><td>ห้อง Make and Play 1</td><td>${e(r.exMakePlay1Name)}</td><td>${e(r.exMakePlay1Issue)}</td><td>${e(r.exMakePlay1Note)}</td></tr>
      <tr><td>ห้อง Make and Play 2</td><td>${e(r.exMakePlay2Name)}</td><td>${e(r.exMakePlay2Issue)}</td><td>${e(r.exMakePlay2Note)}</td></tr>
    </tbody>
  </table>

  ${(r.activities||[]).length ? `
  <div class="sub-header">OP ผู้ดำเนินกิจกรรม</div>
  <table>
    <thead>
      <tr><th rowspan="2">กิจกรรม</th><th rowspan="2">ผู้ดำเนิน</th><th colspan="2">ชาวไทย</th><th colspan="2">ชาวต่างชาติ</th><th rowspan="2">รวม</th></tr>
      <tr><th>เด็ก</th><th>ผู้ใหญ่</th><th>เด็ก</th><th>ผู้ใหญ่</th></tr>
    </thead>
    <tbody>${actRows}</tbody>
  </table>` : ''}

  <div class="sub-header">ED Education Programs</div>
  <table>
    <thead><tr><th>โปรแกรม</th><th>ชื่อเจ้าหน้าที่</th><th>ปัญหา / ข้อเสนอ</th><th>หมายเหตุ</th></tr></thead>
    <tbody>
      <tr><td>Inspire Lab</td><td>${e(r.edInspireName)}</td><td>${e(r.edInspireIssue)}</td><td>${e(r.edInspireNote)}</td></tr>
      <tr><td>Innovation Space</td><td>${e(r.edInnovationName)}</td><td>${e(r.edInnovationIssue)}</td><td>${e(r.edInnovationNote)}</td></tr>
      <tr><td>Mini Make &amp; Play</td><td>${e(r.edMiniName)}</td><td>${e(r.edMiniIssue)}</td><td>${e(r.edMiniNote)}</td></tr>
    </tbody>
  </table>
</div><!-- /page 1 -->

<!-- ====== PAGE 2: VISITOR STATISTICS + REVENUE ====== -->
<div class="page">
  <!-- Header -->
  <div class="doc-header">
    <div class="logos">
      ${logoHtml}
      <div style="margin-left:8px;">
        <div style="font-size:14pt;font-weight:700;color:#003087;">NSM MOD System</div>
        <div style="font-size:10pt;color:#555;">Museum of Discovery — ยอดผู้เข้าชม &amp; รายได้</div>
      </div>
    </div>
    <div class="date-box">
      <div class="date-label">MOD วันที่ ${genDate}</div>
      <div style="font-size:10pt;color:#555;">วันที่บันทึก: ${recDate}</div>
    </div>
  </div>

  <div class="section-header">ยอดผู้เข้าชมประจำวัน</div>

  <!-- Section A: Walk-in -->
  <div class="sub-header">A. ผู้เข้าชมทั่วไป (Walk-in)</div>
  <table>
    <thead><tr><th>ประเภท</th><th class="num">เด็ก</th><th class="num">ผู้ใหญ่</th><th class="num">รวม</th></tr></thead>
    <tbody>
      <tr><td>ผู้เข้าชมไทย</td><td class="num">${aThaiC}</td><td class="num">${aThaiA}</td><td class="num">${aThaiC+aThaiA}</td></tr>
      <tr><td>ผู้เข้าชมต่างชาติ</td><td class="num">${aForC}</td><td class="num">${aForA}</td><td class="num">${aForC+aForA}</td></tr>
      <tr>
        <td>สมาชิก (เด็ก/FC)<br><span style="font-size:9pt;color:#555;">ผู้ใหญ่/FA</span></td>
        <td class="num">${aMemC}${aMemFC > 0 ? ` / FC:${aMemFC}` : ''}</td>
        <td class="num">${aMemA}${aMemFA > 0 ? ` / FA:${aMemFA}` : ''}</td>
        <td class="num">${aMemC+aMemA+aMemFC+aMemFA}</td>
      </tr>
      <tr class="total-row"><td colspan="3"><strong>รวม Walk-in</strong></td><td class="num"><strong>${aTotal}</strong></td></tr>
    </tbody>
  </table>

  <!-- Section B: Group -->
  <div class="sub-header">B. ผู้เข้าชมกลุ่ม (Group) — จำนวนกลุ่ม: ${groupCount} กลุ่ม</div>
  <table>
    <thead>
      <tr><th>#</th><th>ชื่อกลุ่ม</th><th class="num">ไทย เด็ก</th><th class="num">ไทย ผู้ใหญ่</th><th class="num">ต่างชาติ เด็ก</th><th class="num">ต่างชาติ ผู้ใหญ่</th><th class="num">รวม</th></tr>
    </thead>
    <tbody>${groupRows}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="2"><strong>รวม Group</strong></td>
        <td class="num">${bThaiC}</td><td class="num">${bThaiA}</td>
        <td class="num">${bForC}</td><td class="num">${bForA}</td>
        <td class="num"><strong>${bThaiC+bThaiA+bForC+bForA}</strong></td>
      </tr>
      ${(bIC+bIA) > 0 ? `<tr><td colspan="6">สมาชิก IC: ${bIC} / IA: ${bIA}</td><td class="num"><strong>${bIC+bIA}</strong></td></tr>` : ''}
      ${(bIC+bIA) > 0 ? `<tr class="total-row"><td colspan="6"><strong>รวม Group ทั้งหมด (รวมสมาชิก)</strong></td><td class="num"><strong>${bTotal}</strong></td></tr>` : ''}
    </tfoot>
  </table>

  <!-- Section C: Senior -->
  <div style="margin-bottom:6px;">
    <span style="font-weight:600;color:#003087;">C. ผู้สูงอายุ:</span>
    <span style="font-size:13pt;font-weight:700;margin-left:10px;">${cSenior}</span> คน
  </div>

  <!-- Section D: Education -->
  <div class="sub-header">D. กิจกรรมการศึกษา</div>
  <table>
    <thead>
      <tr><th rowspan="2">กิจกรรม</th><th colspan="2">ไทย</th><th colspan="2">ต่างชาติ</th><th rowspan="2" class="num">รวม</th></tr>
      <tr><th class="num">เด็ก</th><th class="num">ผู้ใหญ่</th><th class="num">เด็ก</th><th class="num">ผู้ใหญ่</th></tr>
    </thead>
    <tbody>
      <tr><td>Inspire Lab</td><td class="num">${vdi.tc||0}</td><td class="num">${vdi.ta||0}</td><td class="num">${vdi.fc||0}</td><td class="num">${vdi.fa||0}</td><td class="num">${dInsTotal}</td></tr>
      <tr><td>Innovation Space</td><td class="num">${vdn.tc||0}</td><td class="num">${vdn.ta||0}</td><td class="num">${vdn.fc||0}</td><td class="num">${vdn.fa||0}</td><td class="num">${dInvTotal}</td></tr>
      <tr><td>Walk Rallies</td><td class="num">${vdw.tc||0}</td><td class="num">${vdw.ta||0}</td><td class="num">${vdw.fc||0}</td><td class="num">${vdw.fa||0}</td><td class="num">${dWrTotal}</td></tr>
      <tr><td>Mini Make &amp; Play</td><td class="num">${vdm.child||0}</td><td class="num">-</td><td class="num">-</td><td class="num">-</td><td class="num">${dMmTotal}</td></tr>
      <tr><td>Special Event</td><td class="num">${vds.tc||0}</td><td class="num">${vds.ta||0}</td><td class="num">${vds.fc||0}</td><td class="num">${vds.fa||0}</td><td class="num">${dSpTotal}</td></tr>
      ${dOthTotal ? `<tr><td>กิจกรรมอื่น${vdo.name?' ('+e(vdo.name)+')':''}</td><td class="num" colspan="4">${dOthTotal}</td><td class="num">${dOthTotal}</td></tr>` : ''}
      <tr class="total-row"><td colspan="5"><strong>รวมกิจกรรมการศึกษา</strong></td><td class="num"><strong>${dTotal}</strong></td></tr>
    </tbody>
  </table>

  <!-- Grand Total -->
  <div style="display:flex;align-items:center;gap:20px;margin:8px 0;">
    <div class="grand-box">
      <div>
        <div style="font-size:10pt;color:#555;">รวมผู้เข้าชมทั้งหมด</div>
        <div class="grand-num">${grandTotal.toLocaleString()}</div>
        <div style="font-size:10pt;color:#555;">คน</div>
      </div>
    </div>
    <table style="flex:1;margin:0;">
      <thead><tr><th>ประเภท</th><th class="num">Walk-in</th><th class="num">Group</th><th class="num">ผู้สูงอายุ</th><th class="num">การศึกษา</th><th class="num">รวม</th></tr></thead>
      <tbody><tr><td>จำนวน</td><td class="num">${aTotal}</td><td class="num">${bTotal}</td><td class="num">${cSenior}</td><td class="num">${dTotal}</td><td class="num"><strong>${grandTotal.toLocaleString()}</strong></td></tr></tbody>
    </table>
  </div>

  <!-- Nationality Splits -->
  <div style="font-weight:600;color:#003087;margin:8px 0 4px;font-size:11pt;">แยกตามสัญชาติ</div>
  <table>
    <thead>
      <tr>
        <th>ประเภท</th>
        <th class="num">รวม</th>
        <th class="num">ไทย</th>
        <th class="num">ต่างชาติ</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>รวมนิทรรศการ (Walk-in)</td>
        <td class="num">${aTotal}</td>
        <td class="num">${walkInThai}</td>
        <td class="num">${walkInForeign}</td>
      </tr>
      <tr>
        <td>รวมกลุ่ม (Group)</td>
        <td class="num">${bTotal}</td>
        <td class="num">${groupThai}</td>
        <td class="num">${groupForeign}</td>
      </tr>
      <tr>
        <td>รวมกิจกรรมการศึกษา</td>
        <td class="num">${dTotal}</td>
        <td class="num">${eduThai}</td>
        <td class="num">${eduForeign}</td>
      </tr>
    </tbody>
  </table>

  <!-- Summary by Nationality and Age -->
  <div style="font-weight:600;color:#003087;margin:8px 0 4px;font-size:11pt;">สรุปตามสัญชาติและวัย</div>
  <table>
    <thead>
      <tr>
        <th>หมวด</th>
        <th class="num">เด็กไทย</th>
        <th class="num">ผู้ใหญ่ไทย</th>
        <th class="num">เด็กต่างชาติ</th>
        <th class="num">ผู้ใหญ่ต่างชาติ</th>
        <th class="num">เด็กทั้งหมด</th>
        <th class="num">ผู้ใหญ่ทั้งหมด</th>
        <th class="num">รวม</th>
      </tr>
    </thead>
    <tbody>
      <tr class="total-row">
        <td><strong>รวมทั้งหมด</strong></td>
        <td class="num">${sumThaiChild}</td>
        <td class="num">${sumThaiAdult}</td>
        <td class="num">${sumForChild}</td>
        <td class="num">${sumForAdult}</td>
        <td class="num"><strong>${sumAllChild}</strong></td>
        <td class="num"><strong>${sumAllAdult}</strong></td>
        <td class="num"><strong>${grandTotal.toLocaleString()}</strong></td>
      </tr>
    </tbody>
  </table>

  <!-- Revenue -->
  <div class="section-header" style="margin-top:8px;">รายได้ประจำวัน</div>
  <table>
    <thead>
      <tr><th>ประเภท</th><th class="num">Exhibition</th><th class="num">Inspire Lab</th><th class="num">Innovation</th><th class="num">Walk Rally</th><th class="num">Mini M&amp;P</th><th class="num">Special</th><th class="num">สมาชิก</th><th class="num">อื่นๆ</th><th class="num">รวม</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>รายได้ (บาท)</td>
        <td class="num">${(rev.ex||0).toLocaleString()}</td>
        <td class="num">${(rev.ins||0).toLocaleString()}</td>
        <td class="num">${(rev.inv||0).toLocaleString()}</td>
        <td class="num">${(rev.wr||0).toLocaleString()}</td>
        <td class="num">${(rev.mm||0).toLocaleString()}</td>
        <td class="num">${(rev.sp||0).toLocaleString()}</td>
        <td class="num">${(rev.mem||0).toLocaleString()}</td>
        <td class="num">${(rev.oth||0).toLocaleString()}</td>
        <td class="num">${Object.values(rev).reduce((s,v)=>s+(v||0),0).toLocaleString()}</td>
      </tr>
      <tr>
        <td>ออนไลน์ (บาท)</td>
        <td class="num">${(onl.ex||0).toLocaleString()}</td>
        <td class="num">${(onl.ins||0).toLocaleString()}</td>
        <td class="num">${(onl.inv||0).toLocaleString()}</td>
        <td class="num">${(onl.wr||0).toLocaleString()}</td>
        <td class="num">${(onl.mm||0).toLocaleString()}</td>
        <td class="num">${(onl.sp||0).toLocaleString()}</td>
        <td class="num">${(onl.mem||0).toLocaleString()}</td>
        <td class="num">${(onl.oth||0).toLocaleString()}</td>
        <td class="num">${Object.values(onl).reduce((s,v)=>s+(v||0),0).toLocaleString()}</td>
      </tr>
      <tr class="total-row">
        <td><strong>รวมรายได้ทั้งหมด</strong></td>
        <td class="num">${((rev.ex||0)+(onl.ex||0)).toLocaleString()}</td>
        <td class="num">${((rev.ins||0)+(onl.ins||0)).toLocaleString()}</td>
        <td class="num">${((rev.inv||0)+(onl.inv||0)).toLocaleString()}</td>
        <td class="num">${((rev.wr||0)+(onl.wr||0)).toLocaleString()}</td>
        <td class="num">${((rev.mm||0)+(onl.mm||0)).toLocaleString()}</td>
        <td class="num">${((rev.sp||0)+(onl.sp||0)).toLocaleString()}</td>
        <td class="num">${((rev.mem||0)+(onl.mem||0)).toLocaleString()}</td>
        <td class="num">${((rev.oth||0)+(onl.oth||0)).toLocaleString()}</td>
        <td class="num"><strong>${totalRevenue.toLocaleString()}</strong></td>
      </tr>
    </tbody>
  </table>

  <!-- Notes -->
  ${r.notes ? `
  <div style="margin-top:8px;">
    <div style="font-weight:600;color:#003087;margin-bottom:4px;">หมายเหตุประจำวัน</div>
    <div class="notes-box">${e(r.notes)}</div>
  </div>` : ''}

  <!-- Signature -->
  <div class="sig-box" style="margin-top:16px;">
    <div class="sig-inner">
      <div style="font-size:10pt;color:#555;margin-bottom:4px;">ลายเซ็น MOD ประจำวัน</div>
      <div class="sig-line"></div>
      <div style="font-weight:600;">${e(r.modSign||'...........................')}</div>
      <div style="font-size:10pt;color:#555;margin-top:4px;">วันที่: ${r.signDate ? toThaiDate(r.signDate) : recDate}</div>
    </div>
  </div>
</div><!-- /page 2 -->

<script>
  window.onload = function() {
    setTimeout(function() { window.print(); }, 600);
  };
<\/script>
</body>
</html>`;

  // Use Blob URL to avoid document.write with user-derived HTML
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  const win = window.open(blobUrl, '_blank', 'width=900,height=700,scrollbars=yes');
  if (!win) {
    URL.revokeObjectURL(blobUrl);
    showToast('กรุณาอนุญาต Popup ในเบราว์เซอร์เพื่อ Export PDF', 'warning');
    return;
  }
  // Release the Blob URL after the window has had time to load
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  showToast('กำลังเปิดหน้า Briefing PDF...', 'info');
}

/** Export briefing PDF จากหน้า Export โดยเลือกจาก date picker */
function exportBriefingFromDate() {
  const inp = document.getElementById('briefing-date');
  const date = inp ? inp.value : '';
  if (!date) { showToast('กรุณาเลือกวันที่', 'warning'); return; }
  exportDailyBriefingPDF(date);
}

// ============ DASHBOARD ============
function updateDashboard() {
  const now = new Date();
  const thaiDays = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
  const greetHour = now.getHours();
  let greet = 'สวัสดี';
  if (greetHour < 12) greet = 'สวัสดีตอนเช้า';
  else if (greetHour < 17) greet = 'สวัสดีตอนบ่าย';
  else greet = 'สวัสดีตอนเย็น';
  setTxt('dash-greeting', `${greet}! 👋`);
  const dateStr = `วัน${thaiDays[now.getDay()]}ที่ ${now.getDate()} ${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()+543}`;
  setTxt('dash-date', dateStr);

  const records = getAllRecords();
  const totalVis = records.reduce((s,r)=>s+(r.totalVisitors||0),0);
  const totalRev = records.reduce((s,r)=>s+(r.totalRevenue||0),0);
  setTxt('stat-total-records', records.length);
  setTxt('stat-total-visitors', fmtNum(totalVis));
  setTxt('stat-total-revenue', fmtNum(totalRev));
  setTxt('stat-active-days', records.length);

  // Recent activity (last 7)
  const recent = records.slice(0,7);
  const tbody = document.getElementById('recent-activity-tbody');
  if (tbody) {
    if (!recent.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">ยังไม่มีข้อมูล</td></tr>';
    } else {
      tbody.innerHTML = recent.map(r => `
        <tr>
          <td style="white-space:nowrap;font-size:13px;">${escHtml(r.date||'-')}</td>
          <td style="font-size:13px;">${escHtml(r.modMorning||'-')}</td>
          <td style="color:var(--success);font-size:13px;">${fmtNum(r.totalVisitors||0)}</td>
          <td style="color:var(--warning);font-size:13px;">${fmtNum(r.totalRevenue||0)}</td>
        </tr>`).join('');
    }
  }

  // Month grid
  const curYear = now.getFullYear();
  setTxt('dash-year-label', `พ.ศ. ${curYear+543}`);
  const yearRecords = records.filter(r => (r.date||'').startsWith(String(curYear)));
  const monthsWithData = new Set(yearRecords.map(r => parseInt((r.date||'').split('-')[1])));
  const grid = document.getElementById('month-grid');
  if (grid) {
    grid.innerHTML = MONTH_NAMES.map((m, i) => {
      const hasData = monthsWithData.has(i+1);
      const count = yearRecords.filter(r => parseInt((r.date||'').split('-')[1]) === i+1).length;
      return `<div class="month-cell ${hasData?'has-data':''}" onclick="filterByMonthDash(${curYear},${i+1})">
        <div style="font-weight:${hasData?'600':'400'}">${m.substring(0,3)}</div>
        ${hasData ? `<div class="month-dot"></div><div style="font-size:11px;margin-top:2px;">${count} วัน</div>` : ''}
      </div>`;
    }).join('');
  }

  // 7-day chart data
  const labels = [];
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const dateStr2 = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    labels.push(`${d.getDate()}/${d.getMonth()+1}`);
    const rec = records.find(r => r.date === dateStr2);
    data.push(rec ? (rec.totalVisitors || 0) : 0);
  }
  initDashboardChart(labels, data);
}

function filterByMonthDash(year, month) {
  gotoPage('history');
  const ym = `${year}-${String(month).padStart(2,'0')}`;
  const sel = document.getElementById('history-filter-month');
  if (sel) { sel.value = ym; renderHistory(ym); }
}

// ============ CHARTS ============
function initDashboardChart(labels, data) {
  const canvas = document.getElementById('activity-chart');
  if (!canvas) return;
  if (activityChart) { activityChart.destroy(); activityChart = null; }
  const ctx = canvas.getContext('2d');
  activityChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels || [],
      datasets: [{
        label: 'ผู้เข้าชม',
        data: data || [],
        backgroundColor: 'rgba(0,85,255,0.6)',
        borderColor: 'rgba(0,85,255,1)',
        borderWidth: 1,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888899' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888899' }, beginAtZero: true }
      }
    }
  });
}

function initSummaryChart(labels, data) {
  const canvas = document.getElementById('summary-chart');
  if (!canvas) return;
  if (summaryChart) { summaryChart.destroy(); summaryChart = null; }
  const ctx = canvas.getContext('2d');
  summaryChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels || [],
      datasets: [{
        label: 'ผู้เข้าชม',
        data: data || [],
        backgroundColor: 'rgba(0,184,148,0.6)',
        borderColor: 'rgba(0,184,148,1)',
        borderWidth: 1,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888899', maxRotation: 45 } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888899' }, beginAtZero: true }
      }
    }
  });
}

// ============ MODAL & TOAST ============
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.style.display = 'flex'; if (id==='settings-modal') loadSettings(); }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}
function closeBD(event, id) {
  if (event.target.id === id) closeModal(id);
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const iconSpan = document.createElement('span');
  iconSpan.textContent = icons[type] || 'ℹ️';
  const msgSpan = document.createElement('span');
  msgSpan.style.flex = '1';
  msgSpan.textContent = message;
  toast.appendChild(iconSpan);
  toast.appendChild(msgSpan);
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
  }, 3500);
}

// ============ SETTINGS MODAL ============
function loadSettings() {
  const s = getSettings();
  setInputVal('set-sheets-url', s.sheetsURL || '');
  setInputVal('set-sheet-name', s.sheetName || 'Sheet1');
  setInputVal('set-username', s.username || 'admin');
  setInputVal('set-password', ''); // Never pre-fill password field
}

async function saveSettingsModal() {
  const rawPass = getInputVal('set-password');
  const existing = getSettings();
  // Hash the new password if provided, otherwise keep existing hash
  const passwordHash = rawPass ? await sha256hex(rawPass) : existing.passwordHash;
  const s = {
    sheetsURL: getInputVal('set-sheets-url'),
    sheetName: getInputVal('set-sheet-name') || 'Sheet1',
    username: getInputVal('set-username') || 'admin',
    passwordHash: passwordHash || null
  };
  saveSettings(s);
  closeModal('settings-modal');
  showToast('บันทึกการตั้งค่าเรียบร้อย', 'success');
}

// ============ KEYBOARD SHORTCUTS ============
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    ['settings-modal','forgot-modal','request-modal','view-modal','delete-modal'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.style.display === 'flex') closeModal(id);
    });
  }
});

// ============ INIT ============
document.addEventListener('DOMContentLoaded', function() {
  checkSession();
  // Add some default booking rows
  if (document.getElementById('booking-tbody')) {
    addBookingRow();
    addBookingRow();
  }
  // Add default activity row
  if (document.getElementById('activity-tbody')) {
    addActivityRow();
  }
});
