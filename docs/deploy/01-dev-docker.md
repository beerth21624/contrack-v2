# ขึ้นระบบ environment dev ด้วย Docker (รอบแรก)

สถานะ: ใช้ได้ (27 ต.ค. 2026) · image บน Docker Hub ของ `beerth21624`

| image | คืออะไร | port |
|---|---|---|
| `beerth21624/contrack-web:dev` | หน้าเว็บ (Next.js) — ส่ง `/api/*` ต่อไปหลังบ้าน | 3000 |
| `beerth21624/contrack-api:dev` | หลังบ้าน (NestJS) + Socket.IO | 4000 |

แต่ละรอบ build มี tag เป็นรหัส commit ด้วย (รอบนี้ `:543d4a0`) ใช้ล็อกเวอร์ชันได้ · ฐานข้อมูล PostgreSQL 16 ไม่อยู่ใน image (ใช้ของเซิร์ฟเวอร์ หรือ container `postgres:16-alpine` ตาม `docker-compose.dev.yml`)

## ใส่ env แล้วรันได้เลย — ไม่ต้องรันสคริปต์เอง

ตอน `contrack-api` เริ่มทำงาน (`backend/docker/entrypoint.sh`):
1. สร้าง/อัปเดตตารางในฐานข้อมูล (migration) ทุกครั้ง — ทำซ้ำได้ ไม่ลบข้อมูล
2. `SEED_DEMO=true` (ค่าเริ่มต้นของ image): ถ้าฐานข้อมูล **ยังไม่มีบัญชีเดโม** ใส่ข้อมูลเดโมให้ — บัญชี 5 คน บริษัทตัวอย่าง
   โครงการตัวอย่าง และบ้านโชว์ "บ้านพักอาศัย 1 ชั้น คุณวิชัย…" (ทีมช่าง แผนงาน revision) · ถ้ามีแล้วข้าม (รีสตาร์ทไม่ทับสิ่งที่คนเล่นไว้)
3. เปิด API

ครั้งแรกใช้เวลาประมาณ 1 นาที (healthcheck รอได้ 2 นาที)

**บัญชีเดโม** (รหัสผ่านทุกบัญชี `ContrackDemo#2026` — เป็นข้อมูลทดสอบ รหัสนี้เปิดเผยใน `backend/SEED.md`):
`owner@contrack.test` เจ้าของ · `admin@contrack.test` · `estimator@contrack.test` · `viewer@contrack.test` · `solo@contrack.test`
→ ใช้กับ dev / เดโมเท่านั้น ระบบจริงตั้ง `SEED_DEMO=false`

## env ของ contrack-api

| ตัวแปร | ต้องใส่ | ตัวอย่าง / ค่าเริ่มต้น | หมายเหตุ |
|---|---|---|---|
| `DATABASE_URL` | ✔ | `postgres://user:pass@db:5432/contrack` | ฐานข้อมูลบนเซิร์ฟเวอร์: เปิด SSL (`?sslmode=require`) |
| `JWT_ACCESS_SECRET` | ✔ | สุ่ม ≥ 32 ตัวอักษร | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `CORS_ORIGINS` | ✔ | `https://dev.contrack.example` | ที่อยู่หน้าเว็บ (คั่นด้วย `,` ได้หลายอัน) |
| `PUBLIC_APP_URL` | ควรใส่ | `https://dev.contrack.example` | ลิงก์ในข้อความเชิญ / SMS |
| `NODE_ENV` | | `production` | ไม่มี HTTPS → ใส่ `development` |
| `COOKIE_SECURE` | | `true` | ไม่มี HTTPS → `false` (ไม่งั้นเข้าสู่ระบบไม่ติด) · `production` บังคับให้เป็น `true` |
| `MODULES_ENABLED` | | `subcontracting,workforce` | เพิ่ม `ai-assist` ได้ (ต้องใส่ `JEV_API_KEY`) · แต่ละบริษัทเปิด/ปิดเองที่เมนู "โมดูลเสริม" |
| `SEED_DEMO` | | `true` | `false` = ไม่ใส่ข้อมูลเดโม |
| `TRUST_PROXY` | | `uniquelocal` | เชื่อ X-Forwarded-For จากเครือข่ายภายใน (container หน้าเว็บ / reverse proxy) |
| `REALTIME_BUS` | | `memory` | รัน API มากกว่า 1 ตัว → `postgres` |
| `FILE_STORAGE_DIR` | | `/data/files` | ไฟล์ที่อัปโหลด — **mount volume** ไม่งั้นหายเมื่อสร้าง container ใหม่ |
| `SMS_PROVIDER` | | `console` | OTP พิมพ์ลง log · ใช้จริง `thaibulksms` + `SMS_API_KEY` / `SMS_API_SECRET` |
| `JEV_API_KEY` | ถ้าเปิด ai-assist | | ผู้ช่วย AI (ส่ง BOQ ไปโมเดลภายนอกเมื่อผู้ใช้กดยืนยันเท่านั้น) |

## env ของ contrack-web

| ตัวแปร | ต้องใส่ | ตัวอย่าง | หมายเหตุ |
|---|---|---|---|
| `API_URL` | ✔ | `http://api:4000` | ที่อยู่หลังบ้านที่ **container หน้าเว็บ** มองเห็น (เครือข่ายภายใน) |
| `REALTIME_URL` | ✔ | `https://api.dev.contrack.example` | ที่อยู่หลังบ้านที่ **เบราว์เซอร์** มองเห็น (Socket.IO ต่อตรง) |

ทั้งสองค่าอ่านตอนรัน ไม่ได้ฝังใน image — image เดียวใช้ได้ทุก environment

## รูปแบบที่แนะนำบนเซิร์ฟเวอร์

```
อินเทอร์เน็ต ─ HTTPS ─ reverse proxy (Caddy / Nginx / Traefik)
                        ├─ dev.contrack.example      → web:3000
                        └─ api.dev.contrack.example  → api:4000   (Socket.IO ต้องเปิด WebSocket upgrade)
web ──(เครือข่าย docker ภายใน)── api:4000 ── db:5432
```
- ใช้ `docker-compose.dev.yml` เป็นตัวตั้งต้น: เปลี่ยนรหัสผ่านฐานข้อมูล, `JWT_ACCESS_SECRET`, ที่อยู่ทั้งหมด และเอา `ports` ของ db ออก
- ฐานข้อมูลไม่ควรเปิดออกอินเทอร์เน็ต

## อัปเดตเวอร์ชัน

`docker compose pull && docker compose up -d` — API ทำ migration เองตอนเริ่ม · ข้อมูลเดโมไม่ถูกใส่ซ้ำ

## ยังไม่รวมในรอบนี้ (เพิ่มภายหลัง)
- SMS จริงสำหรับ OTP (ตอนนี้ `console`) · LINE OA
- สำรองฐานข้อมูลอัตโนมัติ
- build/push image อัตโนมัติจาก CI (ตอนนี้ build จากเครื่องนักพัฒนา)
- image เป็น linux/amd64 เท่านั้น
