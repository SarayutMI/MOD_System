# NSM MOD Management System

ระบบบริหารจัดการ MOD (Museum Operations Director) สำหรับพิพิธภัณฑ์วิทยาศาสตร์แห่งชาติ (NSM)

## 🚀 Features

- **Dashboard** — ภาพรวมสถิติ, กราฟ 7 วัน, ตารางกิจกรรมล่าสุด, Month Grid
- **บันทึกประจำวัน** — 4 แท็บ: ช่วงเช้า / ช่วงเย็น / ผู้เข้าชม / รายได้ & สรุป
- **ประวัติ** — ดู/แก้ไข/ลบบันทึก, กรองตามเดือน, Pagination
- **สรุป** — กราฟรายเดือน, Top MOD Performance, Monthly Breakdown
- **ส่งออก** — Export CSV, Export PDF, ส่งไป Google Sheets

## �� Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| Tailwind CSS | CDN | Utility classes |
| Chart.js | 4.4.0 | Bar charts |
| jsPDF | 2.5.1 | PDF export |
| jsPDF-AutoTable | 3.8.2 | PDF tables |
| IBM Plex Sans | Google Fonts | Typography |

## 📦 Setup

เปิดไฟล์ `index.html` ในเบราว์เซอร์โดยตรง — ไม่ต้องติดตั้ง server

## 🔑 Default Credentials

| ชื่อผู้ใช้ | รหัสผ่าน |
|-----------|---------|
| `admin` | `admin` |

เปลี่ยนได้ใน **ตั้งค่า → Login Credentials**

## 📁 Project Structure

```
MOD_System/
├── index.html   # Complete SPA structure + CSS
├── app.js       # All JavaScript functionality
└── README.md    # Documentation
```

## 📊 Data Structure

ข้อมูลทั้งหมดบันทึกใน **localStorage** ของเบราว์เซอร์  
Key format: `nsm_YYYY-MM-DD`

### Visitor Sections
- **Section A** — Walk-in (ไทย, ต่างชาติ, สมาชิก)
- **Section B** — Group (ไทย, ต่างชาติ, สมาชิก IC/IA)
- **Section C** — ผู้สูงอายุ
- **Section D** — กิจกรรมการศึกษา (Inspire Lab, Innovation Space, Walk Rally, Mini Make & Play, Special Event)

### Revenue Categories
Exhibition | Inspire Lab | Innovation Space | Walk Rallies | Mini Make & Play | Special Event | สมาชิก/วารสาร | อื่น ๆ

## 🔗 Google Sheets Integration

1. สร้าง Google Apps Script ที่รับ POST request (JSON)
2. Deploy เป็น Web App (Execute as: Me, Access: Anyone)
3. ใส่ Script URL ใน **ตั้งค่า → Google Apps Script URL**
4. กด **ส่งข้อมูล Google Sheets** เพื่อ sync ข้อมูลทั้งหมด

## 📱 Responsive Design

รองรับทั้ง Desktop และ Mobile — Sidebar พับได้บน Mobile
