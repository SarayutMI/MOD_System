# MOD System Redesign

ระบบนี้เป็น Single Page Application สำหรับจัดการงานรายวันของ MOD โดยแยกเป็น 4 หน้าใช้งานหลัก ได้แก่

1. **Daily Management (Morning)** — จัดเวรเจ้าหน้าที่และอาสาสมัคร
2. **M-Exhibition Cal** — บันทึกและคำนวณผู้เข้าชม/กิจกรรม
3. **POS Data Management** — แสดงผลรวมสำหรับงาน POS
4. **Summary Day (Evening)** — สรุปทั้งวันและบันทึกปัญหา

## ภาพรวมระบบ

- ใช้ `date_key` รูปแบบ `YYYY-MM-DD` เป็น primary key ของทุกชีต
- Front-end ทำงานแบบ real-time calculation และบันทึกข้อมูลลง Google Sheets
- Google Apps Script (`Code.gs`) เป็น backend สำหรับอ่าน/เขียนข้อมูลแบบหลายชีต
- UI ออกแบบสไตล์ Apple-inspired: glass card, soft shadow, smooth transition, toast, loading overlay

## ไฟล์สำคัญ

- `Code.gs` — Google Apps Script backend
- `index.html` — โครงสร้าง SPA + CSS
- `app.js` — state management, navigation, calculation, save/load logic
- `js/googleSheetsAPI.js` — client API wrapper สำหรับ Apps Script
- `README.md` — เอกสารชุดนี้
- `LOGO.png` — โลโก้ที่ใช้บนหน้า Login และ Sidebar โดยควรวางไว้ที่ project root (`./LOGO.png`) หากไฟล์นี้หาย ระบบยังทำงานได้แต่โลโก้จะไม่แสดงผล; หากเปลี่ยนไฟล์ให้คงชื่อเดิมหรือแก้ path ใน `index.html`

## การตั้งค่า Google Sheets และ Apps Script

### 1) สร้าง Spreadsheet
สร้าง Google Spreadsheet ใหม่ 1 ไฟล์ แล้วคัดลอก **Spreadsheet ID** จาก URL

### 2) สร้าง Google Apps Script
1. เปิด [script.new](https://script.new) เพื่อสร้าง **standalone Apps Script** หรือเปิด **Extensions → Apps Script** จากใน Spreadsheet หากต้องการใช้แบบ bound script
2. วางโค้ดจาก `Code.gs`
3. แก้ค่า `SPREADSHEET_ID` ให้เป็น Spreadsheet ID จริง
4. กด Deploy → **New deployment** → **Web app**
5. ตั้งค่า
   - Execute as: **Me**
   - Who has access: **Anyone**
6. คัดลอก Web App URL

### 3) สร้างชีตทั้งหมด
หลัง deploy แล้ว ให้เปิดหน้า **Settings** ในระบบ และทำตามลำดับนี้

1. ใส่ **Google Apps Script URL**
2. ใส่ **Spreadsheet ID**
3. กด **ทดสอบการเชื่อมต่อ**
4. กด **สร้างชีตทั้งหมด**

ระบบจะสร้างทุกชีตพร้อม header ให้อัตโนมัติ

## โครงสร้างชีต (9 ชีต)

### 1. `Master_Lookups`
| Column | คำอธิบาย |
|---|---|
| type | ประเภทข้อมูล (`officer`, `volunteer`) |
| name | ชื่อที่ใช้ใน dropdown |
| sort_order | ลำดับการแสดงผล |

### 2. `Daily_Assignments`
| Column | คำอธิบาย |
|---|---|
| date_key | วันที่หลัก |
| mo_officer | เจ้าหน้าที่ MO |
| mex_officer | เจ้าหน้าที่ M-Exhibition |
| med_officer | เจ้าหน้าที่ MED |
| mvi_officer | เจ้าหน้าที่ MVI |
| z2f_volunteer | อาสาโซน 2F |
| zmp_volunteer | อาสาโซน MP |
| zinl_volunteer | อาสาโซน INL |
| other_activity_note | หมายเหตุเพิ่มเติม |

### 3. `Daily_WalkIn`
| Column | คำอธิบาย |
|---|---|
| date_key | วันที่หลัก |
| mor_th_kids / mor_th_adults | Walk-in ช่วงเช้าไทย |
| mor_fr_kids / mor_fr_adults | Walk-in ช่วงเช้าต่างชาติ |
| eve_th_kids / eve_th_adults | Walk-in ช่วงเย็นไทย |
| eve_fr_kids / eve_fr_adults | Walk-in ช่วงเย็นต่างชาติ |

### 4. `Daily_Groups`
| Column | คำอธิบาย |
|---|---|
| date_key | วันที่หลัก |
| group_index | ลำดับแถว 1-10 |
| group_name | ชื่อกลุ่ม |
| g_kids | จำนวนเด็ก |
| g_adults | จำนวนผู้ใหญ่ |

### 5. `Daily_Additional_Activities`
| Column | คำอธิบาย |
|---|---|
| date_key | วันที่หลัก |
| ac_walk_r_kids / ac_walk_r_adults | Walk Rally |
| ac_mmap_kids / ac_mmap_adults | Mini Make and Play |
| ac_etcac_kids / ac_etcac_adults | กิจกรรมเพิ่มเติมอื่น ๆ |
| activity_notes | หมายเหตุ |

### 6. `Daily_Lab_Inspire`
| Column | คำอธิบาย |
|---|---|
| date_key | วันที่หลัก |
| row_index | ลำดับแถว 1-6 |
| ac_name | ชื่อกิจกรรม |
| officer_name | เจ้าหน้าที่ประจำกิจกรรม |
| th_kids / th_adults | ผู้เข้าร่วมไทย |
| fr_kids / fr_adults | ผู้เข้าร่วมต่างชาติ |

### 7. `Daily_Lab_Innovation`
โครงสร้างเหมือน `Daily_Lab_Inspire`

### 8. `Daily_POS`
| Column | คำอธิบาย |
|---|---|
| date_key | วันที่หลัก |
| sum_w_th_kids | รวมเด็กไทย Walk-in |
| sum_w_a_th_adult | รวมผู้ใหญ่ไทย Walk-in |
| sum_w_fr_kids | รวมเด็กต่างชาติ Walk-in |
| sum_w_a_fr_adult | รวมผู้ใหญ่ต่างชาติ Walk-in |
| sum_activity | รวมผู้เข้าร่วมกิจกรรม |
| sum_ac_vi_all | รวมผู้เข้าชมทุกประเภท |

### 9. `Daily_Summary`
| Column | คำอธิบาย |
|---|---|
| date_key | วันที่หลัก |
| issue_mo / issue_mex / issue_med / issue_mvi | ปัญหาตามจุดรับผิดชอบ |
| issue_insl / issue_inns | ปัญหาห้องกิจกรรม |
| summary_notes | สรุปภาพรวมประจำวัน |

## การไหลของข้อมูล

1. ผู้ใช้เลือกวันที่จาก date picker กลางหน้าจอ
2. Front-end เรียก `getFullDay(date)` เพื่อดึงข้อมูลทุก section ของวันนั้น
3. `app.js` เติมข้อมูลลงฟอร์มและคำนวณค่ารวมแบบ real-time
4. เมื่อกดบันทึก ระบบส่งข้อมูลตาม section ไปยัง Apps Script
5. Apps Script ทำการ upsert ด้วย `date_key`
6. Sections แบบหลายแถว (`Daily_Groups`, `Daily_Lab_*`) จะลบข้อมูลของวันนั้นก่อน แล้ว insert ชุดใหม่

## แนวคิด Date-based Retrieval

- ทุกหน้าใช้ date picker เดียวกัน
- การเปลี่ยนวันที่จะ reload ข้อมูลทุก section ของวันนั้นทันที
- ข้อมูลในแต่ละชีตอ้างอิง `date_key` เดียวกันเสมอ
- Summary และ POS จึงอัปเดตจากข้อมูลวันเดียวกันโดยตรง

## การตั้งค่าฝั่ง Front-end

หน้า **Settings** รองรับ

- Google Apps Script URL
- Spreadsheet ID
- ชื่อผู้ใช้/รหัสผ่านสำหรับใช้งานในเครื่อง
- ปุ่มทดสอบการเชื่อมต่อ
- ปุ่มรีเฟรช lookup list
- ปุ่มสร้างชีตทั้งหมด

ข้อมูลการตั้งค่าเก็บใน `localStorage`

## หมายเหตุ Local Development

- เปิด `index.html` ตรง ๆ ได้ หรือจะใช้ static server ก็ได้
- หากต้องการทดสอบผ่าน local server สามารถใช้คำสั่งง่าย ๆ เช่น `python3 -m http.server`
- การเรียก Apps Script แบบ POST ใช้ `Content-Type: text/plain` เพื่อลดปัญหา CORS preflight
- หากยังไม่ได้ตั้งค่า Web App URL ระบบจะยังเปิดหน้า UI ได้ แต่การเชื่อมต่อ backend จะไม่สำเร็จจนกว่าจะตั้งค่าใน Settings

## Lookup Data ที่ควรเตรียม

แนะนำให้เพิ่มข้อมูลใน `Master_Lookups` เช่น

| type | name | sort_order |
|---|---|---|
| officer | ชื่อเจ้าหน้าที่ 1 | 1 |
| officer | ชื่อเจ้าหน้าที่ 2 | 2 |
| volunteer | ชื่ออาสา 1 | 1 |
| volunteer | ชื่ออาสา 2 | 2 |

## API ที่รองรับจาก Apps Script

### GET
- `?action=ping`
- `?action=getLookups`
- `?action=getSection&section=assignments&date=YYYY-MM-DD`
- `?action=getSection&section=walkin&date=YYYY-MM-DD`
- `?action=getSection&section=groups&date=YYYY-MM-DD`
- `?action=getSection&section=additional&date=YYYY-MM-DD`
- `?action=getSection&section=inspire&date=YYYY-MM-DD`
- `?action=getSection&section=innovation&date=YYYY-MM-DD`
- `?action=getSection&section=pos&date=YYYY-MM-DD`
- `?action=getSection&section=summary&date=YYYY-MM-DD`
- `?action=getFullDay&date=YYYY-MM-DD`
- `?action=getDashboard&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

### POST
- `saveSection`
- `saveGroups`
- `saveLabRows`
- `initSheets`

## ข้อเสนอแนะการใช้งานจริง

- ให้บันทึกหน้า Morning ก่อน เพื่อให้ Summary ดึงรายชื่อเจ้าหน้าที่ได้ครบ
- หน้า Exhibition เป็นแหล่งข้อมูลหลักของ POS และ Summary
- หากมีการปรับเปลี่ยน lookup ให้กด **รีเฟรช Lookups** ทันที
- ควรใช้วันที่เดียวกันทั้งวันเพื่อให้ POS และ Summary ตรงกับข้อมูลจริง
