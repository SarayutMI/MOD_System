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
function removeBookingRow(btn) {
  btn.closest('tr').remove();
  // Re-number
  document.querySelectorAll('#booking-tbody tr').forEach((tr, i) => {
    const first = tr.querySelector('td');
    if (first) first.textContent = i + 1;
  });
}

// ============ TABS ============
function switchDayTab(idx, btn) {
  for (let i = 0; i < 4; i++) {
    const tab = document.getElementById('day-tab-' + i);
    const tabBtn = document.getElementById('tab-btn-' + i);
    if (tab) tab.classList.toggle('active', i === idx);
    if (tabBtn) tabBtn.classList.toggle('active', i === idx);
  }
  if (idx === 3) { calcVis(); calcRev(); updateSummaryPreview(); }
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
function fmtNum(n) { return Number(n || 0).toLocaleString('th-TH'); }
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// ============ CALCULATIONS ============
function calcVis() {
  // Section A - Walk-in
  const aThai = getVal('vis-a-thai-child') + getVal('vis-a-thai-adult');
  setTxt('vis-a-thai-total', aThai);
  const aFor = getVal('vis-a-for-child') + getVal('vis-a-for-adult');
  setTxt('vis-a-for-total', aFor);
  const aMem = getVal('vis-a-mem-child') + getVal('vis-a-mem-adult') + getVal('vis-a-mem-fc') + getVal('vis-a-mem-fa');
  setTxt('vis-a-mem-total', aMem);
  const aTotal = aThai + aFor + aMem;
  setTxt('vis-a-total', aTotal);

  // Section B - Group
  const bThai = getVal('vis-b-thai-child') + getVal('vis-b-thai-adult');
  setTxt('vis-b-thai-total', bThai);
  const bFor = getVal('vis-b-for-child') + getVal('vis-b-for-adult');
  setTxt('vis-b-for-total', bFor);
  const bMem = getVal('vis-b-ic') + getVal('vis-b-ia');
  setTxt('vis-b-mem-total', bMem);
  const bTotal = bThai + bFor + bMem;
  setTxt('vis-b-total', bTotal);

  // Section C - Senior
  const cSenior = getVal('vis-c-senior');

  // Section D - Education
  const dIns = getVal('vis-d-ins-tc') + getVal('vis-d-ins-ta') + getVal('vis-d-ins-fc') + getVal('vis-d-ins-fa');
  setTxt('vis-d-ins-total', dIns);
  const dInv = getVal('vis-d-inv-tc') + getVal('vis-d-inv-ta') + getVal('vis-d-inv-fc') + getVal('vis-d-inv-fa');
  setTxt('vis-d-inv-total', dInv);
  const dWr = getVal('vis-d-wr-tc') + getVal('vis-d-wr-ta') + getVal('vis-d-wr-fc') + getVal('vis-d-wr-fa');
  setTxt('vis-d-wr-total', dWr);
  const dMm = getVal('vis-d-mm-child');
  setTxt('vis-d-mm-total', dMm);
  const dSp = getVal('vis-d-sp-tc') + getVal('vis-d-sp-ta') + getVal('vis-d-sp-fc') + getVal('vis-d-sp-fa');
  setTxt('vis-d-sp-total', dSp);
  const dOth = getVal('vis-d-oth-count');
  setTxt('vis-d-oth-total', dOth);
  const dTotal = dIns + dInv + dWr + dMm + dSp + dOth;
  setTxt('vis-d-total', dTotal);

  // Grand
  setTxt('grand-walkin', aTotal);
  setTxt('grand-group', bTotal);
  setTxt('grand-education', dTotal);
  const grandTotal = aTotal + bTotal + cSenior + dTotal;
  setTxt('grand-total', grandTotal);
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
    mVisitor: getInputVal('m-visitor'),
    bookings,
    cbInspireLab: isChecked('cb-inspire-lab'),
    cbInnovationSpace: isChecked('cb-innovation-space'),
    cbWalkRally: isChecked('cb-walk-rally'),
    special1: getInputVal('special1'),
    special2: getInputVal('special2'),
    // Evening - VS
    vsCounter2Name: getInputVal('vs-counter2-name'), vsCounter2Issue: getInputVal('vs-counter2-issue'), vsCounter2Note: getInputVal('vs-counter2-note'),
    vsCounter1Name: getInputVal('vs-counter1-name'), vsCounter1Issue: getInputVal('vs-counter1-issue'), vsCounter1Note: getInputVal('vs-counter1-note'),
    // Evening - Exhibition zones
    exZ1Name: getInputVal('ex-z1-name'), exZ1Issue: getInputVal('ex-z1-issue'), exZ1Note: getInputVal('ex-z1-note'),
    exZ2Name: getInputVal('ex-z2-name'), exZ2Issue: getInputVal('ex-z2-issue'), exZ2Note: getInputVal('ex-z2-note'),
    exZ3Name: getInputVal('ex-z3-name'), exZ3Issue: getInputVal('ex-z3-issue'), exZ3Note: getInputVal('ex-z3-note'),
    exZ4Name: getInputVal('ex-z4-name'), exZ4Issue: getInputVal('ex-z4-issue'), exZ4Note: getInputVal('ex-z4-note'),
    exTempName: getInputVal('ex-temp-name'), exTempIssue: getInputVal('ex-temp-issue'), exTempNote: getInputVal('ex-temp-note'),
    // Evening - Education
    edInspireName: getInputVal('ed-inspire-name'), edInspireIssue: getInputVal('ed-inspire-issue'), edInspireNote: getInputVal('ed-inspire-note'),
    edInnovationName: getInputVal('ed-innovation-name'), edInnovationIssue: getInputVal('ed-innovation-issue'), edInnovationNote: getInputVal('ed-innovation-note'),
    edMiniName: getInputVal('ed-mini-name'), edMiniIssue: getInputVal('ed-mini-issue'), edMiniNote: getInputVal('ed-mini-note'),
    modSign: getInputVal('mod-sign'), signDate: getInputVal('sign-date'),
    // Visitors A
    visAThai: { child: getVal('vis-a-thai-child'), adult: getVal('vis-a-thai-adult') },
    visAFor: { child: getVal('vis-a-for-child'), adult: getVal('vis-a-for-adult') },
    visAMem: { child: getVal('vis-a-mem-child'), adult: getVal('vis-a-mem-adult'), fc: getVal('vis-a-mem-fc'), fa: getVal('vis-a-mem-fa') },
    // Visitors B
    visBThai: { child: getVal('vis-b-thai-child'), adult: getVal('vis-b-thai-adult') },
    visBFor: { child: getVal('vis-b-for-child'), adult: getVal('vis-b-for-adult') },
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
  setInputVal('m-visitor', data.mVisitor);
  setChecked('cb-inspire-lab', data.cbInspireLab);
  setChecked('cb-innovation-space', data.cbInnovationSpace);
  setChecked('cb-walk-rally', data.cbWalkRally);
  setInputVal('special1', data.special1);
  setInputVal('special2', data.special2);
  // Booking rows
  const tbody = document.getElementById('booking-tbody');
  if (tbody) { tbody.innerHTML = ''; bookingRowCount = 0; }
  if (data.bookings && data.bookings.length) {
    data.bookings.forEach(b => addBookingRow(b));
  }
  // Evening
  setInputVal('vs-counter2-name', data.vsCounter2Name); setInputVal('vs-counter2-issue', data.vsCounter2Issue); setInputVal('vs-counter2-note', data.vsCounter2Note);
  setInputVal('vs-counter1-name', data.vsCounter1Name); setInputVal('vs-counter1-issue', data.vsCounter1Issue); setInputVal('vs-counter1-note', data.vsCounter1Note);
  setInputVal('ex-z1-name', data.exZ1Name); setInputVal('ex-z1-issue', data.exZ1Issue); setInputVal('ex-z1-note', data.exZ1Note);
  setInputVal('ex-z2-name', data.exZ2Name); setInputVal('ex-z2-issue', data.exZ2Issue); setInputVal('ex-z2-note', data.exZ2Note);
  setInputVal('ex-z3-name', data.exZ3Name); setInputVal('ex-z3-issue', data.exZ3Issue); setInputVal('ex-z3-note', data.exZ3Note);
  setInputVal('ex-z4-name', data.exZ4Name); setInputVal('ex-z4-issue', data.exZ4Issue); setInputVal('ex-z4-note', data.exZ4Note);
  setInputVal('ex-temp-name', data.exTempName); setInputVal('ex-temp-issue', data.exTempIssue); setInputVal('ex-temp-note', data.exTempNote);
  setInputVal('ed-inspire-name', data.edInspireName); setInputVal('ed-inspire-issue', data.edInspireIssue); setInputVal('ed-inspire-note', data.edInspireNote);
  setInputVal('ed-innovation-name', data.edInnovationName); setInputVal('ed-innovation-issue', data.edInnovationIssue); setInputVal('ed-innovation-note', data.edInnovationNote);
  setInputVal('ed-mini-name', data.edMiniName); setInputVal('ed-mini-issue', data.edMiniIssue); setInputVal('ed-mini-note', data.edMiniNote);
  setInputVal('mod-sign', data.modSign); setInputVal('sign-date', data.signDate);
  // Visitors A
  const va = data.visAThai || {}; setInputVal('vis-a-thai-child', va.child||0); setInputVal('vis-a-thai-adult', va.adult||0);
  const vaf = data.visAFor || {}; setInputVal('vis-a-for-child', vaf.child||0); setInputVal('vis-a-for-adult', vaf.adult||0);
  const vam = data.visAMem || {}; setInputVal('vis-a-mem-child', vam.child||0); setInputVal('vis-a-mem-adult', vam.adult||0); setInputVal('vis-a-mem-fc', vam.fc||0); setInputVal('vis-a-mem-fa', vam.fa||0);
  // Visitors B
  const vb = data.visBThai || {}; setInputVal('vis-b-thai-child', vb.child||0); setInputVal('vis-b-thai-adult', vb.adult||0);
  const vbf = data.visBFor || {}; setInputVal('vis-b-for-child', vbf.child||0); setInputVal('vis-b-for-adult', vbf.adult||0);
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
  const settings = getSettings();
  if (!settings.sheetsURL) {
    openModal('settings-modal');
    showToast('กรุณาตั้งค่า Google Sheets URL ก่อน', 'warning');
    return;
  }
  // Save current form first
  saveToLocal(false);
  const records = getAllRecords();
  if (!records.length) { showToast('ไม่มีข้อมูลที่จะส่ง', 'warning'); return; }
  showProgress('กำลังส่งข้อมูล...', `ส่ง ${records.length} รายการ`);
  const payload = JSON.stringify({ action: 'bulkInsert', sheetName: settings.sheetName || 'Sheet1', records });
  fetch(settings.sheetsURL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: payload
  })
  .then(r => r.text())
  .then(text => {
    hideProgress();
    showToast('ส่งข้อมูลสำเร็จ! ' + records.length + ' รายการ', 'success');
  })
  .catch(err => {
    hideProgress();
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
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
      return `<tr>
        <td style="white-space:nowrap;">${r.date || '-'}</td>
        <td>${r.modMorning || '-'}</td>
        <td>${fmtNum(walkin)}</td>
        <td>${fmtNum(group)}</td>
        <td>${fmtNum(edu)}</td>
        <td style="font-weight:600;color:var(--accent);">${fmtNum(r.totalVisitors || 0)}</td>
        <td style="color:var(--warning);">${fmtNum(r.totalRevenue || 0)}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-ghost btn-sm" onclick="viewRecord('${r.date}')" title="ดูรายละเอียด">👁</button>
          <button class="btn btn-ghost btn-sm" onclick="editRecord('${r.date}')" title="แก้ไข" style="color:var(--info);">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="confirmDelete('${r.date}')" title="ลบ" style="color:var(--danger);">🗑</button>
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
  const safeFilter = (filterMonth || '').replace(/[^0-9-]/g, '').substring(0, 7);
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
      <div style="margin-top:12px;text-align:right;">
        <button class="btn btn-primary btn-sm" onclick="editRecord('${escHtml(date)}');closeModal('view-modal')">✏️ แก้ไขข้อมูล</button>
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
        `<tr><td style="color:var(--text-muted);">${i+1}</td><td>${name}</td><td>${d.days}</td><td style="color:var(--success);">${fmtNum(d.visitors)}</td></tr>`
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
    `<tr><td>${r.date||'-'}</td><td>${r.modMorning||'-'}</td><td style="color:var(--success);">${fmtNum(r.totalVisitors||0)}</td><td style="color:var(--warning);">${fmtNum(r.totalRevenue||0)}</td></tr>`
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
    showToast('เกิดข้อผิดพลาดในการสร้าง PDF: ' + escHtml(e.message), 'error');
  }
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
          <td style="white-space:nowrap;font-size:13px;">${r.date||'-'}</td>
          <td style="font-size:13px;">${r.modMorning||'-'}</td>
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
  toast.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span style="flex:1">${message}</span>`;
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
});
