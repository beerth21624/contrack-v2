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

## ราคากลางภาครัฐ

image `contrack-api` มี `goverment_price.json` ติดมาด้วย ตอนเริ่ม container จะ import เข้าฐานข้อมูล **ครั้งแรกครั้งเดียว** (4,559 รายการ)
รีสตาร์ทครั้งต่อไปจะข้ามขั้นนี้ ถ้า import ล้มเหลว API ยังเปิดได้ตามปกติ และจะพิมพ์ WARNING ลง log

## เปิดโมดูล ERP (เดโม ERP · branch `epic/erp` · tag `:erp-demo`)

ค่าเริ่มต้นของ image คือ release 1 (BOQ + `subcontracting,workforce`) ถ้าจะให้ลูกค้าดูโมดูล ERP ให้ใส่ env ของ `contrack-api` เพิ่ม:

| ตัวแปร | ค่า | หมายเหตุ |
|---|---|---|
| `MODULES_ENABLED` | `subcontracting,workforce,project-hub,portal,boq-control,quotations,contracts,billing,variations,procurement,site-diary,labour,job-cost,payables,handover` | โมดูลที่เซิร์ฟเวอร์เปิดให้ใช้ |
| `ENTITLEMENTS` | `open` | ทุกบริษัทเปิดใช้เองได้ทันที · ถ้าไม่ใส่ `NODE_ENV=production` จะเป็น `enforce` (ต้องกด "ทดลองใช้" หรือให้แอดมินให้สิทธิ์) |
| `PLATFORM_ADMIN_EMAILS` | อีเมลแอดมิน (คั่นด้วย `,`) | ใช้หน้า `/admin/entitlements` |

**tag `:erp-*` เปิดโมดูล ERP + `ENTITLEMENTS=open` ไว้แล้วเป็นค่าเริ่มต้น** (build ด้วย `--build-arg MODULES_ENABLED=<รายการข้างบน> --build-arg ENTITLEMENTS=open`)
จึงไม่ต้องใส่ env เพิ่ม · tag `:dev` / release build ไม่ส่ง build-arg จึงยังเป็น release 1

ถ้าฐานข้อมูล **มีข้อมูลเดิมอยู่แล้ว** seed จะไม่รันซ้ำ บริษัทเดิมต้องเปิดโมดูลเองที่เมนู **โมดูลเสริม** (`/workspace/modules`) โดยเปิด "Project Hub" ก่อน
ส่วนโครงการ ERP ตัวอย่างจะมีเฉพาะตอนเริ่มจากฐานข้อมูลว่าง

ตั้ง `SEED_DEMO=true` บนฐานข้อมูลว่างแล้ว จะได้โครงการ "บ้านพักอาศัย ERP ตัวอย่าง – คุณมานะ ตั้งใจ" ที่มีข้อมูลตั้งแต่ใบเสนอราคาจนถึงรอบจ่ายเงิน
(รายละเอียดใน `backend/SEED.md`)

## build image จาก Mac (Apple Silicon / ARM)

เซิร์ฟเวอร์ปลายทางเป็น **x86-64** ไม่ว่าจะเป็น cloud Linux หรือเครื่อง Windows ที่รัน Docker Desktop
และทั้งสองแบบรัน **Linux container** (Windows ใช้ WSL2) image จึงต้องเป็น `linux/amd64` เสมอ ไม่ใช่ Windows image

- เครื่อง Windows หรือ Intel: `docker build` ธรรมดาก็ได้ `linux/amd64` อยู่แล้ว
- Mac M1/M2/M3: `docker build` ธรรมดาจะได้ `linux/arm64` ซึ่งรันบนเซิร์ฟเวอร์ไม่ได้ (`exec format error`)
  ต้องสั่งระบุ platform เอง:

```bash
# Docker Desktop → Settings → Features in development (หรือ General) → "Use Rosetta for x86/amd64 emulation" ต้องเปิดไว้
# ถ้าไม่เปิด จะใช้ QEMU แทน ซึ่งทำให้ next build ค้างตอนจบ (Node ล่ม uv__io_poll EEXIST)
docker buildx build --platform linux/amd64 --load -f Dockerfile.api -t beerth21624/contrack-api:<tag> .
docker buildx build --platform linux/amd64 --load -f Dockerfile.web -t beerth21624/contrack-web:<tag> .
docker image inspect beerth21624/contrack-web:<tag> --format '{{.Os}}/{{.Architecture}}'   # ต้องได้ linux/amd64
docker push beerth21624/contrack-api:<tag> && docker push beerth21624/contrack-web:<tag>
```

- build ทีละ image (RAM 16 GB) · บน M1 Pro: api ~7 นาที (QEMU) · web ~1–2 นาทีกับ Rosetta เมื่อ `npm ci` อยู่ใน cache แล้ว (ถ้าใช้ QEMU ขั้น next build อย่างเดียวใช้ ~6 นาทีแล้วค้าง)
- `.dockerignore` กัน `.env*` ไว้ ห้ามเอาออก เพราะ `.env.local` ที่มี `NEXT_PUBLIC_*` จะถูกฝังลง image เว็บตอน build
- เสร็จแล้วล้าง cache ด้วย `docker builder prune`

## ยังไม่รวมในรอบนี้ (เพิ่มภายหลัง)
- SMS จริงสำหรับ OTP (ตอนนี้ `console`) · LINE OA
- สำรองฐานข้อมูลอัตโนมัติ
- build/push image อัตโนมัติจาก CI (ตอนนี้ build จากเครื่องนักพัฒนา)
- image เป็น linux/amd64 เท่านั้น (ถ้าต้องการรันบน Mac ARM แบบ native ให้ build เพิ่มด้วย `--platform linux/amd64,linux/arm64`)
