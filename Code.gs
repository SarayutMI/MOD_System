// ============================================================
// MOD System - Google Apps Script Backend
// ============================================================

/**
 * Replace with your real Spreadsheet ID from
 * https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
 * See README > การตั้งค่า Google Sheets และ Apps Script for setup steps.
 */
const SPREADSHEET_ID = 'PUT_SPREADSHEET_ID_HERE';

const SHEET_NAMES = {
  MASTER_LOOKUPS: 'Master_Lookups',
  ACTIVITY: 'Activity',
  DAILY_ASSIGNMENTS: 'Daily_Assignments',
  DAILY_WALKIN: 'Daily_WalkIn',
  DAILY_GROUPS: 'Daily_Groups',
  DAILY_ADDITIONAL: 'Daily_Additional_Activities',
  DAILY_LAB_INSPIRE: 'Daily_Lab_Inspire',
  DAILY_LAB_INNOVATION: 'Daily_Lab_Innovation',
  DAILY_POS: 'Daily_POS',
  DAILY_SUMMARY: 'Daily_Summary'
};

const COLUMN_HEADERS = {
  Master_Lookups: ['type', 'name', 'sort_order'],
  Activity: ['type', 'name', 'sort_order'],
  Daily_Assignments: ['date_key', 'mo_officer', 'mex_officer', 'med_officer', 'mvi_officer', 'z1f_volunteer', 'zino_volunteer', 'z2f_volunteer', 'zmp_volunteer', 'zinl_volunteer', 'other_activity_note'],
  Daily_WalkIn: ['date_key', 'mor_th_kids', 'mor_th_adults', 'mor_fr_kids', 'mor_fr_adults', 'eve_th_kids', 'eve_th_adults', 'eve_fr_kids', 'eve_fr_adults'],
  Daily_Groups: ['date_key', 'group_index', 'group_name', 'g_kids', 'g_adults'],
  Daily_Additional_Activities: ['date_key', 'ac_walk_r_kids', 'ac_walk_r_adults', 'ac_mmap_kids', 'ac_mmap_adults', 'ac_etcac_kids', 'ac_etcac_adults', 'activity_notes'],
  Daily_Lab_Inspire: ['date_key', 'row_index', 'ac_name', 'officer_name', 'th_kids', 'th_adults', 'fr_kids', 'fr_adults'],
  Daily_Lab_Innovation: ['date_key', 'row_index', 'ac_name', 'officer_name', 'th_kids', 'th_adults', 'fr_kids', 'fr_adults'],
  Daily_POS: ['date_key', 'sum_w_th_kids', 'sum_w_a_th_adult', 'sum_w_fr_kids', 'sum_w_a_fr_adult', 'sum_activity', 'sum_ac_vi_all'],
  Daily_Summary: ['date_key', 'issue_mo', 'issue_mex', 'issue_med', 'issue_mvi', 'issue_insl', 'issue_inns', 'summary_notes']
};

const SECTION_TO_SHEET = {
  assignments: SHEET_NAMES.DAILY_ASSIGNMENTS,
  walkin: SHEET_NAMES.DAILY_WALKIN,
  groups: SHEET_NAMES.DAILY_GROUPS,
  additional: SHEET_NAMES.DAILY_ADDITIONAL,
  inspire: SHEET_NAMES.DAILY_LAB_INSPIRE,
  innovation: SHEET_NAMES.DAILY_LAB_INNOVATION,
  pos: SHEET_NAMES.DAILY_POS,
  summary: SHEET_NAMES.DAILY_SUMMARY
};

const NUMERIC_FIELDS = {
  Daily_WalkIn: ['mor_th_kids', 'mor_th_adults', 'mor_fr_kids', 'mor_fr_adults', 'eve_th_kids', 'eve_th_adults', 'eve_fr_kids', 'eve_fr_adults'],
  Daily_Groups: ['group_index', 'g_kids', 'g_adults'],
  Daily_Additional_Activities: ['ac_walk_r_kids', 'ac_walk_r_adults', 'ac_mmap_kids', 'ac_mmap_adults', 'ac_etcac_kids', 'ac_etcac_adults'],
  Daily_Lab_Inspire: ['row_index', 'th_kids', 'th_adults', 'fr_kids', 'fr_adults'],
  Daily_Lab_Innovation: ['row_index', 'th_kids', 'th_adults', 'fr_kids', 'fr_adults'],
  Daily_POS: ['sum_w_th_kids', 'sum_w_a_th_adult', 'sum_w_fr_kids', 'sum_w_a_fr_adult', 'sum_activity', 'sum_ac_vi_all'],
  Master_Lookups: ['sort_order'],
  Activity: ['sort_order']
};

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = safeStr(params.action) || 'ping';

    switch (action) {
      case 'ping':
        return jsonResponse_({ status: 'success', message: 'MOD System backend is ready', timestamp: new Date().toISOString() });
      case 'getLookups':
        return jsonResponse_({ status: 'success', data: getLookups_() });
      case 'getSection': {
        const section = safeStr(params.section);
        const dateKey = normalizeDateKey_(params.date);
        validateSection_(section);
        return jsonResponse_({ status: 'success', data: getSectionData_(section, dateKey) });
      }
      case 'getFullDay': {
        const dateKey = normalizeDateKey_(params.date);
        return jsonResponse_({ status: 'success', data: getFullDayData_(dateKey) });
      }
      case 'getDashboard': {
        const startDate = normalizeDateKey_(params.startDate || params.start_date);
        const endDate = normalizeDateKey_(params.endDate || params.end_date);
        return jsonResponse_({ status: 'success', data: getDashboardData_(startDate, endDate) });
      }
      default:
        throw new Error('Unsupported action: ' + action);
    }
  } catch (error) {
    return handleError_(error);
  }
}

function doPost(e) {
  try {
    const payload = parsePayload_(e);
    const action = safeStr(payload.action);

    switch (action) {
      case 'saveSection': {
        const section = safeStr(payload.section);
        const dateKey = normalizeDateKey_(payload.date_key || payload.date);
        validateSection_(section);
        if (['groups', 'inspire', 'innovation'].indexOf(section) > -1) throw new Error('Use saveGroups or saveLabRows for multi-row sections.');
        const data = payload.data || {};
        return jsonResponse_({ status: 'success', message: 'Section saved successfully', data: saveSingleSection_(section, dateKey, data, payload.spreadsheetId) });
      }
      case 'saveGroups': {
        const dateKey = normalizeDateKey_(payload.date_key || payload.date);
        const rows = Array.isArray(payload.groups) ? payload.groups : Array.isArray(payload.rows) ? payload.rows : [];
        return jsonResponse_({ status: 'success', message: 'Groups saved successfully', data: saveGroups_(dateKey, rows, payload.spreadsheetId) });
      }
      case 'saveLabRows': {
        const roomType = safeStr(payload.roomType || payload.section);
        const dateKey = normalizeDateKey_(payload.date_key || payload.date);
        const rows = Array.isArray(payload.rows) ? payload.rows : [];
        return jsonResponse_({ status: 'success', message: 'Lab rows saved successfully', data: saveLabRows_(roomType, dateKey, rows, payload.spreadsheetId) });
      }
      case 'initSheets':
        return jsonResponse_({ status: 'success', message: 'Sheets initialized successfully', data: initSheets_(payload.spreadsheetId) });
      default:
        throw new Error('Unsupported action: ' + action);
    }
  } catch (error) {
    return handleError_(error);
  }
}

function getFullDayData_(dateKey) {
  const data = {
    assignments: getSectionData_('assignments', dateKey),
    walkin: getSectionData_('walkin', dateKey),
    groups: getSectionData_('groups', dateKey),
    additional: getSectionData_('additional', dateKey),
    inspire: getSectionData_('inspire', dateKey),
    innovation: getSectionData_('innovation', dateKey),
    pos: getSectionData_('pos', dateKey),
    summary: getSectionData_('summary', dateKey)
  };

  data.computed_pos = buildComputedPos_(data);
  return data;
}

function getDashboardData_(startDate, endDate) {
  if (startDate > endDate) throw new Error('วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด');

  const ss = getSpreadsheet_();
  const walkinRows = getRowsByDateRange_(getOrCreateSheet(SHEET_NAMES.DAILY_WALKIN, COLUMN_HEADERS.Daily_WalkIn, ss), startDate, endDate);
  const groupRows = getRowsByDateRange_(getOrCreateSheet(SHEET_NAMES.DAILY_GROUPS, COLUMN_HEADERS.Daily_Groups, ss), startDate, endDate);
  const additionalRows = getRowsByDateRange_(getOrCreateSheet(SHEET_NAMES.DAILY_ADDITIONAL, COLUMN_HEADERS.Daily_Additional_Activities, ss), startDate, endDate);
  const inspireRows = getRowsByDateRange_(getOrCreateSheet(SHEET_NAMES.DAILY_LAB_INSPIRE, COLUMN_HEADERS.Daily_Lab_Inspire, ss), startDate, endDate);
  const innovationRows = getRowsByDateRange_(getOrCreateSheet(SHEET_NAMES.DAILY_LAB_INNOVATION, COLUMN_HEADERS.Daily_Lab_Innovation, ss), startDate, endDate);

  const walkinByDate = {};
  walkinRows.forEach(function(row) {
    const dateKey = normalizeDateKeyForLookup_(row.date_key);
    if (!dateKey) return;
    const kids = safeNum(row.mor_th_kids) + safeNum(row.mor_fr_kids) + safeNum(row.eve_th_kids) + safeNum(row.eve_fr_kids);
    const adults = safeNum(row.mor_th_adults) + safeNum(row.mor_fr_adults) + safeNum(row.eve_th_adults) + safeNum(row.eve_fr_adults);
    walkinByDate[dateKey] = { kids: kids, adults: adults };
  });

  const groupByDate = aggregateByDate_(groupRows, function(row) {
    return { kids: safeNum(row.g_kids), adults: safeNum(row.g_adults), total: safeNum(row.g_kids) + safeNum(row.g_adults) };
  });
  const additionalByDate = aggregateByDate_(additionalRows, function(row) {
    const total = safeNum(row.ac_walk_r_kids) + safeNum(row.ac_walk_r_adults) + safeNum(row.ac_mmap_kids) + safeNum(row.ac_mmap_adults) + safeNum(row.ac_etcac_kids) + safeNum(row.ac_etcac_adults);
    return { total: total };
  });
  const inspireByDate = aggregateByDate_(inspireRows, function(row) {
    const kids = safeNum(row.th_kids) + safeNum(row.fr_kids);
    const adults = safeNum(row.th_adults) + safeNum(row.fr_adults);
    return { kids: kids, adults: adults, total: kids + adults };
  });
  const innovationByDate = aggregateByDate_(innovationRows, function(row) {
    const kids = safeNum(row.th_kids) + safeNum(row.fr_kids);
    const adults = safeNum(row.th_adults) + safeNum(row.fr_adults);
    return { kids: kids, adults: adults, total: kids + adults };
  });

  const allDates = {};
  [walkinByDate, groupByDate, additionalByDate, inspireByDate, innovationByDate].forEach(function(mapObj) {
    Object.keys(mapObj).forEach(function(dateKey) { allDates[dateKey] = true; });
  });

  const byDate = Object.keys(allDates).sort().map(function(dateKey) {
    const walk = walkinByDate[dateKey] || { kids: 0, adults: 0 };
    const group = groupByDate[dateKey] || { kids: 0, adults: 0, total: 0 };
    const additional = additionalByDate[dateKey] || { total: 0 };
    const inspire = inspireByDate[dateKey] || { kids: 0, adults: 0, total: 0 };
    const innovation = innovationByDate[dateKey] || { kids: 0, adults: 0, total: 0 };
    const walkinTotal = walk.kids + walk.adults;
    const roomTotal = inspire.total + innovation.total;
    const sumActivity = additional.total + roomTotal;
    const sumAcViAll = walkinTotal + group.total + sumActivity;
    return {
      date_key: dateKey,
      walkin_kids: walk.kids,
      walkin_adults: walk.adults,
      walkin_total: walkinTotal,
      group_kids: group.kids,
      group_adults: group.adults,
      group_total: group.total,
      additional_total: additional.total,
      inspire_kids: inspire.kids,
      inspire_adults: inspire.adults,
      innovation_kids: innovation.kids,
      innovation_adults: innovation.adults,
      room_total: roomTotal,
      sum_activity: sumActivity,
      sum_ac_vi_all: sumAcViAll
    };
  });

  const totals = byDate.reduce(function(acc, row) {
    acc.walkin_kids += row.walkin_kids;
    acc.walkin_adults += row.walkin_adults;
    acc.walkin_total += row.walkin_total;
    acc.group_kids += row.group_kids;
    acc.group_adults += row.group_adults;
    acc.group_total += row.group_total;
    acc.additional_total += row.additional_total;
    acc.inspire_kids += row.inspire_kids;
    acc.inspire_adults += row.inspire_adults;
    acc.innovation_kids += row.innovation_kids;
    acc.innovation_adults += row.innovation_adults;
    acc.room_total += row.room_total;
    acc.sum_activity += row.sum_activity;
    acc.sum_ac_vi_all += row.sum_ac_vi_all;
    return acc;
  }, {
    walkin_kids: 0,
    walkin_adults: 0,
    walkin_total: 0,
    group_kids: 0,
    group_adults: 0,
    group_total: 0,
    additional_total: 0,
    inspire_kids: 0,
    inspire_adults: 0,
    innovation_kids: 0,
    innovation_adults: 0,
    room_total: 0,
    sum_activity: 0,
    sum_ac_vi_all: 0
  });

  return {
    range: {
      start_date: startDate,
      end_date: endDate,
      total_days_with_data: byDate.length
    },
    totals: totals,
    by_date: byDate
  };
}

function getSectionData_(section, dateKey) {
  const sheetName = SECTION_TO_SHEET[section];
  const ss = getSpreadsheet_();
  const sheet = getOrCreateSheet(sheetName, COLUMN_HEADERS[sheetName], ss);

  if (section === 'groups' || section === 'inspire' || section === 'innovation') {
    const sortField = section === 'groups' ? 'group_index' : 'row_index';
    return getRowsByDate_(sheet, dateKey).sort(function(a, b) {
      return safeNum(a[sortField]) - safeNum(b[sortField]);
    });
  }
  return findRowByDate_(sheet, dateKey);
}

function saveSingleSection_(section, dateKey, data, spreadsheetId) {
  const sheetName = SECTION_TO_SHEET[section];
  const headers = COLUMN_HEADERS[sheetName];
  const ss = getSpreadsheet_(spreadsheetId);
  const sheet = getOrCreateSheet(sheetName, headers, ss);
  const record = normalizeRecordForSheet_(sheetName, Object.assign({ date_key: dateKey }, data));

  if (section === 'pos') {
    const computed = buildComputedPosFromPayload_(record, data);
    if (computed) {
      record.sum_w_th_kids = computed.sum_w_th_kids;
      record.sum_w_a_th_adult = computed.sum_w_a_th_adult;
      record.sum_w_fr_kids = computed.sum_w_fr_kids;
      record.sum_w_a_fr_adult = computed.sum_w_a_fr_adult;
      record.sum_activity = computed.sum_activity;
      record.sum_ac_vi_all = computed.sum_ac_vi_all;
    }
  }

  upsertSingleRow_(sheet, record, headers);
  return record;
}

function saveGroups_(dateKey, rows, spreadsheetId) {
  const sheetName = SHEET_NAMES.DAILY_GROUPS;
  const headers = COLUMN_HEADERS[sheetName];
  const sheet = getOrCreateSheet(sheetName, headers, getSpreadsheet_(spreadsheetId));
  const normalizedRows = rows.map(function(row, index) {
    return normalizeRecordForSheet_(sheetName, {
      date_key: dateKey,
      group_index: row.group_index || index + 1,
      group_name: row.group_name,
      g_kids: row.g_kids,
      g_adults: row.g_adults
    });
  });
  replaceRowsByDate_(sheet, dateKey, normalizedRows, headers);
  return normalizedRows;
}

function saveLabRows_(roomType, dateKey, rows, spreadsheetId) {
  const normalizedRoomType = roomType === 'inspire' ? 'inspire' : roomType === 'innovation' ? 'innovation' : '';
  if (!normalizedRoomType) throw new Error('roomType must be either inspire or innovation.');

  const sheetName = normalizedRoomType === 'inspire' ? SHEET_NAMES.DAILY_LAB_INSPIRE : SHEET_NAMES.DAILY_LAB_INNOVATION;
  const headers = COLUMN_HEADERS[sheetName];
  const sheet = getOrCreateSheet(sheetName, headers, getSpreadsheet_(spreadsheetId));
  const normalizedRows = rows.map(function(row, index) {
    return normalizeRecordForSheet_(sheetName, {
      date_key: dateKey,
      row_index: row.row_index || index + 1,
      ac_name: row.ac_name,
      officer_name: row.officer_name,
      th_kids: row.th_kids,
      th_adults: row.th_adults,
      fr_kids: row.fr_kids,
      fr_adults: row.fr_adults
    });
  });
  replaceRowsByDate_(sheet, dateKey, normalizedRows, headers);
  return normalizedRows;
}

function initSheets_(spreadsheetId) {
  const ss = getSpreadsheet_(spreadsheetId);
  return Object.keys(COLUMN_HEADERS).map(function(sheetName) {
    const sheet = getOrCreateSheet(sheetName, COLUMN_HEADERS[sheetName], ss);
    return { sheet: sheetName, rows: Math.max(sheet.getLastRow() - 1, 0) };
  });
}

function buildComputedPos_(fullDayData) {
  const walkin = fullDayData.walkin || {};
  const groups = fullDayData.groups || [];
  const additional = fullDayData.additional || {};
  const inspire = fullDayData.inspire || [];
  const innovation = fullDayData.innovation || [];

  const sumWThKids = safeNum(walkin.mor_th_kids) + safeNum(walkin.eve_th_kids);
  const sumWThAdults = safeNum(walkin.mor_th_adults) + safeNum(walkin.eve_th_adults);
  const sumWFrKids = safeNum(walkin.mor_fr_kids) + safeNum(walkin.eve_fr_kids);
  const sumWFrAdults = safeNum(walkin.mor_fr_adults) + safeNum(walkin.eve_fr_adults);
  const groupTotal = groups.reduce(function(total, row) { return total + safeNum(row.g_kids) + safeNum(row.g_adults); }, 0);
  const additionalTotal = [additional.ac_walk_r_kids, additional.ac_walk_r_adults, additional.ac_mmap_kids, additional.ac_mmap_adults, additional.ac_etcac_kids, additional.ac_etcac_adults].reduce(function(total, value) { return total + safeNum(value); }, 0);
  const labTotal = inspire.concat(innovation).reduce(function(total, row) { return total + safeNum(row.th_kids) + safeNum(row.th_adults) + safeNum(row.fr_kids) + safeNum(row.fr_adults); }, 0);
  const sumActivity = additionalTotal + labTotal;
  const sumAcViAll = sumWThKids + sumWThAdults + sumWFrKids + sumWFrAdults + groupTotal + sumActivity;

  return {
    date_key: safeStr(walkin.date_key || additional.date_key || (groups[0] && groups[0].date_key) || ''),
    sum_w_th_kids: sumWThKids,
    sum_w_a_th_adult: sumWThAdults,
    sum_w_fr_kids: sumWFrKids,
    sum_w_a_fr_adult: sumWFrAdults,
    sum_activity: sumActivity,
    sum_ac_vi_all: sumAcViAll
  };
}

function buildComputedPosFromPayload_(record, payloadData) {
  if (record.sum_w_th_kids !== undefined || record.sum_activity !== undefined || record.sum_ac_vi_all !== undefined) {
    return normalizeRecordForSheet_(SHEET_NAMES.DAILY_POS, record);
  }
  if (!payloadData || !payloadData.sourceData) return null;
  const computed = buildComputedPos_(payloadData.sourceData);
  computed.date_key = record.date_key;
  return computed;
}

function getLookups_() {
  const ss = getSpreadsheet_();
  const masterSheet = getOrCreateSheet(SHEET_NAMES.MASTER_LOOKUPS, COLUMN_HEADERS.Master_Lookups, ss);
  const masterRows = getAllDataObjects_(masterSheet);
  const officers = [];
  const volunteers = [];

  masterRows.forEach(function(row) {
    const item = { name: safeStr(row.name), sort_order: safeNum(row.sort_order) };
    const type = safeStr(row.type).toLowerCase();
    if (!item.name) return;
    if (type === 'officer') officers.push(item);
    if (type === 'volunteer') volunteers.push(item);
  });

  const activitySheet = getOrCreateSheet(SHEET_NAMES.ACTIVITY, COLUMN_HEADERS.Activity, ss);
  const activityRows = getAllDataObjects_(activitySheet);
  const labAcNames = [];
  const innoAcNames = [];

  activityRows.forEach(function(row) {
    const item = { name: safeStr(row.name), sort_order: safeNum(row.sort_order) };
    const type = safeStr(row.type).toLowerCase();
    if (!item.name) return;
    if (type === 'lab_ac_name') labAcNames.push(item);
    if (type === 'inno_ac_name') innoAcNames.push(item);
  });

  const sorter = function(a, b) {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name);
  };

  officers.sort(sorter);
  volunteers.sort(sorter);
  labAcNames.sort(sorter);
  innoAcNames.sort(sorter);

  return {
    officers: officers.map(function(item) { return item.name; }),
    volunteers: volunteers.map(function(item) { return item.name; }),
    lab_ac_names: labAcNames.map(function(item) { return item.name; }),
    inno_ac_names: innoAcNames.map(function(item) { return item.name; })
  };
}

function parsePayload_(e) {
  const params = (e && e.parameter) || {};
  if (!e || !e.postData || !e.postData.contents) return params;

  let payload = {};
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (error) {
    payload = params;
  }

  ['data', 'groups', 'rows'].forEach(function(key) {
    if (typeof payload[key] === 'string') {
      try { payload[key] = JSON.parse(payload[key]); } catch (ignore) {}
    }
  });
  return payload;
}

function jsonResponse_(result) {
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function handleError_(error) {
  return jsonResponse_({ status: 'error', message: error && error.message ? error.message : 'Unexpected error', stack: error && error.stack ? error.stack : '' });
}

function getSpreadsheet_(overrideId) {
  const sheetId = safeStr(overrideId) || SPREADSHEET_ID;
  if (sheetId && sheetId !== SPREADSHEET_ID_PLACEHOLDER_()) return SpreadsheetApp.openById(sheetId);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('Spreadsheet ID is not configured. Update SPREADSHEET_ID in Code.gs.');
}

function getOrCreateSheet(name, headers, spreadsheet) {
  const ss = spreadsheet || getSpreadsheet_();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const existingHeaders = headerRange.getValues()[0];
  const isHeaderMissing = existingHeaders.every(function(value) { return value === ''; });
  if (isHeaderMissing) {
    headerRange.setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getAllDataObjects_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return [];

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  return values.map(function(row) {
    return headers.reduce(function(record, header, index) {
      record[header] = row[index];
      return record;
    }, {});
  });
}

function findRowByDate_(sheet, dateKey) {
  const rows = getRowsByDate_(sheet, dateKey);
  return rows.length ? rows[0] : null;
}

function getRowsByDate_(sheet, dateKey) {
  const targetDateKey = normalizeDateKeyForLookup_(dateKey);
  return getAllDataObjects_(sheet).filter(function(row) {
    return normalizeDateKeyForLookup_(row.date_key) === targetDateKey;
  });
}

function getRowsByDateRange_(sheet, startDate, endDate) {
  return getAllDataObjects_(sheet).filter(function(row) {
    const dateKey = normalizeDateKeyForLookup_(row.date_key);
    return dateKey && dateKey >= startDate && dateKey <= endDate;
  });
}

function aggregateByDate_(rows, mapper) {
  return rows.reduce(function(acc, row) {
    const dateKey = normalizeDateKeyForLookup_(row.date_key);
    if (!dateKey) return acc;
    const values = mapper(row) || {};
    if (!acc[dateKey]) acc[dateKey] = {};
    Object.keys(values).forEach(function(key) {
      acc[dateKey][key] = safeNum(acc[dateKey][key]) + safeNum(values[key]);
    });
    return acc;
  }, {});
}

function upsertSingleRow_(sheet, record, headers) {
  const existingRowNumber = findSheetRowByDate_(sheet, record.date_key);
  const rowValues = headers.map(function(header) { return record[header] !== undefined ? record[header] : ''; });
  if (existingRowNumber) sheet.getRange(existingRowNumber, 1, 1, headers.length).setValues([rowValues]);
  else sheet.appendRow(rowValues);
}

function replaceRowsByDate_(sheet, dateKey, rows, headers) {
  deleteRowsByDate_(sheet, dateKey);
  if (!rows.length) return;
  const values = rows.map(function(record) {
    return headers.map(function(header) { return record[header] !== undefined ? record[header] : ''; });
  });
  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, values.length, headers.length).setValues(values);
}

function deleteRowsByDate_(sheet, dateKey) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const targetDateKey = normalizeDateKeyForLookup_(dateKey);
  const dateValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const matchingRows = [];
  for (let i = 0; i < dateValues.length; i += 1) {
    if (normalizeDateKeyForLookup_(dateValues[i][0]) === targetDateKey) matchingRows.push(i + 2);
  }
  if (!matchingRows.length) return;

  const ranges = [];
  let start = matchingRows[0];
  let count = 1;

  for (let i = 1; i < matchingRows.length; i += 1) {
    if (matchingRows[i] === matchingRows[i - 1] + 1) {
      count += 1;
    } else {
      ranges.push({ start: start, count: count });
      start = matchingRows[i];
      count = 1;
    }
  }
  ranges.push({ start: start, count: count });

  for (let i = ranges.length - 1; i >= 0; i -= 1) {
    sheet.deleteRows(ranges[i].start, ranges[i].count);
  }
}

function findSheetRowByDate_(sheet, dateKey) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const targetDateKey = normalizeDateKeyForLookup_(dateKey);
  const dateValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < dateValues.length; i += 1) {
    if (normalizeDateKeyForLookup_(dateValues[i][0]) === targetDateKey) return i + 2;
  }
  return 0;
}

function normalizeRecordForSheet_(sheetName, record) {
  const headers = COLUMN_HEADERS[sheetName];
  const numericFields = NUMERIC_FIELDS[sheetName] || [];
  const normalized = {};

  headers.forEach(function(header) {
    if (header === 'date_key') {
      normalized[header] = normalizeDateKey_(record[header]);
    } else if (numericFields.indexOf(header) > -1) {
      normalized[header] = safeNum(record[header]);
    } else {
      normalized[header] = safeStr(record[header]);
    }
  });

  return normalized;
}

function validateSection_(section) {
  if (!SECTION_TO_SHEET[section]) throw new Error('Invalid section: ' + section);
}

function normalizeDateKey_(value) {
  const dateKey = safeStr(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error('date_key must be in YYYY-MM-DD format.');
  return dateKey;
}

/**
 * Normalizes common sheet date cell formats into YYYY-MM-DD for safe comparisons.
 * Accepts Date objects and date strings such as YYYY-MM-DD, YYYY/MM/DD,
 * YYYY-M-D, YYYY/M/D, or those formats followed by a time component.
 * Output is always normalized to zero-padded YYYY-MM-DD.
 */
function normalizeDateKeyForLookup_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  const raw = safeStr(value);
  if (!raw) return '';

  const match = raw.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:[T\s].*)?$/);
  if (!match) return '';

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return '';

  const parsed = new Date(year, month - 1, day);
  if (
    isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return '';
  }

  return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function safeNum(value) {
  if (value === null || value === undefined || value === '') return 0;
  const number = Number(String(value).replace(/,/g, '').trim());
  return isNaN(number) ? 0 : number;
}

function safeStr(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function SPREADSHEET_ID_PLACEHOLDER_() {
  return 'PUT_SPREADSHEET_ID_HERE';
}
