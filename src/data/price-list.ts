import { type PriceItem } from "@/types";

export const INITIAL_PRICE_LIST: PriceItem[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 0 : Land Survey & Benchmark
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'SRV-CREW',     name: 'ค่าแรงสำรวจ (ชุด 2 คน)', nameEn: 'Survey Crew (2 Persons)',            uom: 'คน-วัน', uomEn: 'man-day', costMaterial: 0,    costLabor: 800,  category: 'Land Survey' },
  { code: 'SRV-EQUIP',    name: 'ค่าเช่าอุปกรณ์สำรวจ', nameEn: 'Survey Equipment Rental',              uom: 'วัน', uomEn: 'day',    costMaterial: 1500, costLabor: 0,    category: 'Land Survey' },
  { code: 'SRV-BM',       name: 'หมุด BM คอนกรีต (ฝังเหล็ก)', nameEn: 'Concrete BM (with steel pin)',       uom: 'จุด', uomEn: 'point',    costMaterial: 350,  costLabor: 200,  category: 'Land Survey' },
  { code: 'SRV-MARKER',   name: 'ตรวจ/ปักหมุดเขตที่ดิน', nameEn: 'Land Boundary Check/Marker',            uom: 'จุด', uomEn: 'point',    costMaterial: 50,   costLabor: 100,  category: 'Land Survey' },
  { code: 'SRV-TOPO',     name: 'Topo Survey (สำรวจระดับดิน)', nameEn: 'Topo Survey',       uom: 'm2', uomEn: 'sq.m.',    costMaterial: 0,    costLabor: 3,    category: 'Land Survey' },
  { code: 'SRV-METER',    name: 'ค่าขอมิเตอร์ชั่วคราว (ไฟ+น้ำ)', nameEn: 'Temp Meter Deposit (Power+Water)',    uom: 'ชุด', uomEn: 'set',    costMaterial: 3500, costLabor: 0,    category: 'Land Survey' },
  { code: 'SRV-PERMIT',   name: 'ค่าธรรมเนียมขออนุญาต', nameEn: 'Permit Fees',             uom: 'ชุด', uomEn: 'set',    costMaterial: 2000, costLabor: 0,    category: 'Land Survey' },
  { code: 'SRV-PHOTO',    name: 'ถ่ายภาพสภาพที่ดินก่อนเริ่มงาน', nameEn: 'Pre-construction Photos',     uom: 'ชุด', uomEn: 'set',    costMaterial: 500,  costLabor: 0,    category: 'Land Survey' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 1 : Earthwork & Compaction
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'SITE-CLEAR',     name: 'แผ้วถาง/ปรับระดับพื้นที่เตรียมงาน', nameEn: 'Site Clearing',  uom: 'm2', uomEn: 'sq.m.',  costMaterial: 0,    costLabor: 15,   category: 'Earthwork' },
  { code: 'SITE-DEMO',      name: 'รื้อถอนและขนเศษวัสดุทิ้ง', nameEn: 'Demolition & Debris Removal',        uom: 'เที่ยว', uomEn: 'trip', costMaterial: 0,    costLabor: 1500, category: 'Earthwork' },
  { code: 'FILL-SITE',      name: 'ดินถม + บดอัดบริเวณไซต์ (ทั่วไป)', nameEn: 'General Backfill', uom: 'm3', uomEn: 'cu.m.',  costMaterial: 250,  costLabor: 80,   category: 'Earthwork' },
  { code: 'FILL-SELECTED',  name: 'ดินลูกรัง + บดอัด', nameEn: 'Selected Laterite Fill',              uom: 'm3', uomEn: 'cu.m.',  costMaterial: 300,  costLabor: 80,   category: 'Earthwork' },
  { code: 'FILL-SOFT',      name: 'ดินอ่อน + บดอัด', nameEn: 'Soft Clay Fill',               uom: 'm3', uomEn: 'cu.m.',  costMaterial: 150,  costLabor: 80,   category: 'Earthwork' },
  { code: 'FILL-SAND-FILL', name: 'ทรายถม + บดอัด', nameEn: 'Sand Fill',               uom: 'm3', uomEn: 'cu.m.',  costMaterial: 350,  costLabor: 50,   category: 'Earthwork' },
  { code: 'FILL-ROCK',      name: 'หินคลุก + บดอัด', nameEn: 'Crushed Rock Fill',               uom: 'm3', uomEn: 'cu.m.',  costMaterial: 450,  costLabor: 100,  category: 'Earthwork' },
  { code: 'FILL-TRUCK',   name: 'ค่าขนส่งดิน (รถ 6 ล้อ)', nameEn: 'Soil Transport (6-wheel)',           uom: 'เที่ยว', uomEn: 'trip', costMaterial: 0,    costLabor: 1200, category: 'Earthwork' },
  { code: 'FILL-BACKHOE', name: 'ค่าเช่ารถแบ็คโฮเกลี่ย', nameEn: 'Backhoe Rental',            uom: 'ชม.', uomEn: 'hr',  costMaterial: 0,    costLabor: 1800, category: 'Earthwork' },
  { code: 'FILL-ROLLER',  name: 'ค่าเช่าเครื่องบดอัด (Roller)', nameEn: 'Roller Compactor Rental',      uom: 'ชม.', uomEn: 'hr',  costMaterial: 0,    costLabor: 1500, category: 'Earthwork' },
  { code: 'FILL-FDT',     name: 'ทดสอบ Field Density Test (FDT)', nameEn: 'Field Density Test (FDT)',   uom: 'จุด', uomEn: 'point',  costMaterial: 800,  costLabor: 200,  category: 'Earthwork' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 2 : Temporary Utilities
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'UTIL-CABLE',   name: 'สายเคเบิลไฟฟ้าชั่วคราว', nameEn: 'Temp Power Cable',           uom: 'm', uomEn: 'm',   costMaterial: 45,   costLabor: 15,   category: 'Temp Utilities' },
  { code: 'UTIL-CONDUIT', name: 'ท่อร้อยสายไฟชั่วคราว', nameEn: 'Temp Electrical Conduit',             uom: 'm', uomEn: 'm',   costMaterial: 18,   costLabor: 10,   category: 'Temp Utilities' },
  { code: 'UTIL-PIPE',    name: 'ท่อน้ำชั่วคราว', nameEn: 'Temp Water Pipe',                    uom: 'm', uomEn: 'm',   costMaterial: 35,   costLabor: 15,   category: 'Temp Utilities' },
  { code: 'UTIL-FITTING', name: 'ข้อต่อ/ข้อโค้ง/วาล์วท่อน้ำ', nameEn: 'Pipe Fittings/Valves',       uom: 'ชุด', uomEn: 'set',  costMaterial: 45,   costLabor: 20,   category: 'Temp Utilities' },
  { code: 'UTIL-VALVE',   name: 'ก๊อกน้ำ/วาล์วปิด-เปิด', nameEn: 'Water Faucet/Valve',            uom: 'ตัว', uomEn: 'pcs',  costMaterial: 120,  costLabor: 50,   category: 'Temp Utilities' },
  { code: 'UTIL-DB',      name: 'ตู้ไฟชั่วคราว (Distribution Box)', nameEn: 'Temp Distribution Box',  uom: 'ตู้', uomEn: 'box',  costMaterial: 2500, costLabor: 500,  category: 'Temp Utilities' },
  { code: 'UTIL-GROUND',  name: 'แท่งกราวด์ (Ground Rod)', nameEn: 'Ground Rod',          uom: 'ต้น', uomEn: 'pcs',  costMaterial: 350,  costLabor: 200,  category: 'Temp Utilities' },
  { code: 'UTIL-TANK',    name: 'ถังเก็บน้ำสำรอง', nameEn: 'Water Reserve Tank',                   uom: 'ลิตร', uomEn: 'liter', costMaterial: 3,    costLabor: 0,    category: 'Temp Utilities' },
  { code: 'UTIL-METER',     name: 'ค่าขอมิเตอร์ชั่วคราว (ไฟ+น้ำ ทั่วไป)', nameEn: 'Temp Utilities Meter Request', uom: 'ชุด', uomEn: 'set',  costMaterial: 3500, costLabor: 0,    category: 'Temp Utilities' },
  { code: 'UTIL-METER-E15', name: 'มิเตอร์ไฟชั่วคราว 1 เฟส 15(45)A', nameEn: 'Temp Power Meter 1P 15(45)A',   uom: 'ชุด', uomEn: 'set',  costMaterial: 5000, costLabor: 0,    category: 'Temp Utilities' },
  { code: 'SITE-FENCE-BLK', name: 'รั้วชั่วคราวบล็อกคอนกรีต', nameEn: 'Conc. Block Temp Fence',      uom: 'm2', uomEn: 'sq.m.',  costMaterial: 180,  costLabor: 120, category: 'Site Setup' },
  { code: 'SITE-GATE',      name: 'ประตูทางเข้าชั่วคราว', nameEn: 'Temp Entrance Gate',    uom: 'ช่อง', uomEn: 'set', costMaterial: 3500, costLabor: 500, category: 'Site Setup' },
  { code: 'SITE-ROAD',      name: 'ทางเข้ารถ (ลูกรัง)', nameEn: 'Temp Access Road (Laterite)',        uom: 'm3', uomEn: 'cu.m.',  costMaterial: 250,  costLabor: 100, category: 'Site Setup' },
  { code: 'SITE-SIGN',      name: 'ป้ายโครงการ', nameEn: 'Project Signboard',              uom: 'ป้าย', uomEn: 'pcs', costMaterial: 2500, costLabor: 500, category: 'Site Setup' },
  { code: 'SITE-SAFETY',    name: 'ป้ายเตือนความปลอดภัย', nameEn: 'Safety Warning Sign',       uom: 'ป้าย', uomEn: 'pcs', costMaterial: 300,  costLabor: 50,  category: 'Site Setup' },
  { code: 'SITE-TOILET-R',  name: 'ค่าเช่าห้องน้ำเคลื่อนที่', nameEn: 'Mobile Toilet Rental',     uom: 'เดือน', uomEn: 'month', costMaterial: 2500, costLabor: 0,   category: 'Site Setup' },
  { code: 'SITE-MOBIL',     name: 'ค่าขนย้ายเครื่องจักรเข้าหน้างาน', nameEn: 'Machine Mobilization',uom: 'ครั้ง', uomEn: 'trip', costMaterial: 0, costLabor: 5000, category: 'Site Setup' },
  { code: 'SITE-DEMOB',     name: 'ค่าขนย้ายเครื่องจักรออก', nameEn: 'Machine Demobilization',      uom: 'ครั้ง', uomEn: 'trip', costMaterial: 0, costLabor: 5000, category: 'Site Setup' },
  { code: 'UTIL-METER-E30', name: 'มิเตอร์ไฟชั่วคราว 1 เฟส 30(100)A', nameEn: 'Temp Power Meter 1P 30(100)A',  uom: 'ชุด', uomEn: 'set',  costMaterial: 12000,costLabor: 0,    category: 'Temp Utilities' },
  { code: 'UTIL-METER-E3P', name: 'มิเตอร์ไฟชั่วคราว 3 เฟส 30(100)A', nameEn: 'Temp Power Meter 3P 30(100)A',  uom: 'ชุด', uomEn: 'set',  costMaterial: 25000,costLabor: 0,    category: 'Temp Utilities' },
  { code: 'UTIL-METER-W15', name: 'มิเตอร์น้ำชั่วคราว 1/2 นิ้ว', nameEn: 'Temp Water Meter 1/2"',        uom: 'ชุด', uomEn: 'set',  costMaterial: 1200, costLabor: 0,    category: 'Temp Utilities' },
  { code: 'UTIL-METER-W20', name: 'มิเตอร์น้ำชั่วคราว 3/4 นิ้ว', nameEn: 'Temp Water Meter 3/4"',        uom: 'ชุด', uomEn: 'set',  costMaterial: 2500, costLabor: 0,    category: 'Temp Utilities' },
  { code: 'UTIL-PERMIT',    name: 'ค่าธรรมเนียมขออนุญาตเขต', nameEn: 'District Permit Feeds',         uom: 'ชุด', uomEn: 'set',  costMaterial: 2000, costLabor: 0,    category: 'Temp Utilities' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 3 : Site Preparation
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'SITE-FENCE-ZINC', name: 'รั้วชั่วคราวสังกะสีลูกฟูก', nameEn: 'Zinc Corrugated Fence',         uom: 'm2', uomEn: 'sq.m.',  costMaterial: 120,  costLabor: 40,   category: 'Site Prep' },
  { code: 'SITE-FENCE-MESH', name: 'รั้วชั่วคราวตาข่ายเหล็กถัก', nameEn: 'Wire Mesh Fence',       uom: 'm2', uomEn: 'sq.m.',  costMaterial: 150,  costLabor: 45,   category: 'Site Prep' },
  { code: 'SITE-FENCE-BLK',  name: 'รั้วบล็อกคอนกรีต', nameEn: 'Conc. Block Temp Fence',                uom: 'm2', uomEn: 'sq.m.',  costMaterial: 250,  costLabor: 120,  category: 'Site Prep' },
  { code: 'SITE-GATE',    name: 'ประตูทางเข้าไซต์', nameEn: 'Temp Entrance Gate',                  uom: 'ช่อง', uomEn: 'set', costMaterial: 1500, costLabor: 500,  category: 'Site Prep' },
  { code: 'SITE-CAMP',    name: 'ห้องพักคนงาน / สโตร์', nameEn: 'Worker Camp / Store',             uom: 'm2', uomEn: 'sq.m.',  costMaterial: 800,  costLabor: 200,  category: 'Site Prep' },
  { code: 'SITE-DRAIN',   name: 'รางระบายน้ำชั่วคราว', nameEn: 'Temp Drainage Channel',              uom: 'm', uomEn: 'm',   costMaterial: 80,   costLabor: 30,   category: 'Site Prep' },
  { code: 'SITE-TOILET',  name: 'ห้องน้ำเคลื่อนที่ (ค่าเช่า/เดือน)', nameEn: 'Mobile Toilet Rental',  uom: 'เดือน', uomEn: 'month', costMaterial: 2500, costLabor: 0,    category: 'Site Prep' },
  { code: 'SITE-ROAD',    name: 'ทางเข้ารถลูกรังอัดแน่น', nameEn: 'Temp Access Road (Laterite)',            uom: 'm3', uomEn: 'cu.m.',  costMaterial: 350,  costLabor: 80,   category: 'Site Prep' },
  { code: 'SITE-SIGN',    name: 'ป้ายโครงการ', nameEn: 'Project Signboard',                       uom: 'ป้าย', uomEn: 'pcs', costMaterial: 3000, costLabor: 500,  category: 'Site Prep' },
  { code: 'SITE-SAFETY',  name: 'ป้ายความปลอดภัย', nameEn: 'Safety Warning Sign',                  uom: 'ป้าย', uomEn: 'pcs', costMaterial: 250,  costLabor: 50,   category: 'Site Prep' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 4 : Site Layout
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'LAYOUT-STR',   name: 'เอ็นวางผัง', nameEn: 'Layout Nylon String',                        uom: 'm', uomEn: 'm',   costMaterial: 8,    costLabor: 5,    category: 'Layout' },
  { code: 'LAYOUT-BOARD', name: 'ไม้แบบผัง (Profile Board)', nameEn: 'Profile Board',         uom: 'm', uomEn: 'm',   costMaterial: 25,   costLabor: 15,   category: 'Layout' },
  { code: 'LAYOUT-STK',   name: 'ไม้หมุดปักศูนย์เสา', nameEn: 'Column Center Peg',                uom: 'อัน', uomEn: 'pcs',  costMaterial: 15,   costLabor: 5,    category: 'Layout' },
  { code: 'LAYOUT-NAIL',  name: 'ตะปู (สำหรับไม้ผัง)', nameEn: 'Nails (for layout)',              uom: 'ตัว', uomEn: 'pcs',  costMaterial: 0.5,  costLabor: 0,    category: 'Layout' },
  { code: 'LAYOUT-MARKER',name: 'หมุดปูนตั้งศูนย์เสา', nameEn: 'Concrete Center Marker',               uom: 'จุด', uomEn: 'point',  costMaterial: 80,   costLabor: 50,   category: 'Layout' },
  { code: 'LAYOUT-SPRAY', name: 'สีสเปรย์ทำเครื่องหมาย', nameEn: 'Marking Spray Paint',            uom: 'กระป๋อง', uomEn: 'can', costMaterial: 65,   costLabor: 0,    category: 'Layout' },
  { code: 'LAYOUT-CREW',  name: 'ค่าแรงช่างสำรวจวางผัง', nameEn: 'Layout Survey Crew',            uom: 'คน-วัน', uomEn: 'man-day', costMaterial: 0,    costLabor: 800,  category: 'Layout' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 5 : Piling Works (ราคากลาง 2568 — ครบสมบูรณ์ 100%)
  // ═══════════════════════════════════════════════════════════════════════════
  // ── เสาเข็มตอก สี่เหลี่ยม HTT (ราคาต่อ ม.) ──
  { code: 'PILE-I15',      name: 'เสาเข็มตอก I-15 (0.15×0.15)', nameEn: 'I-15 Driven Pile',   uom: 'm', uomEn: 'm',   costMaterial: 127,  costLabor: 100,  category: 'Piling' },
  { code: 'PILE-I18',      name: 'เสาเข็มตอก I-18 (0.18×0.18)', nameEn: 'I-18 Driven Pile',   uom: 'm', uomEn: 'm',   costMaterial: 183,  costLabor: 100,  category: 'Piling' },
  { code: 'PILE-I20',      name: 'เสาเข็มตอก I-20 (0.20×0.20)', nameEn: 'I-20 Driven Pile',   uom: 'm', uomEn: 'm',   costMaterial: 200,  costLabor: 110,  category: 'Piling' },
  { code: 'PILE-I22',      name: 'เสาเข็มตอก I-22 (0.22×0.22)', nameEn: 'I-22 Driven Pile',   uom: 'm', uomEn: 'm',   costMaterial: 225,  costLabor: 120,  category: 'Piling' },
  { code: 'PILE-I26',      name: 'เสาเข็มตอก I-26 (0.26×0.26)', nameEn: 'I-26 Driven Pile',   uom: 'm', uomEn: 'm',   costMaterial: 277,  costLabor: 120,  category: 'Piling' },
  { code: 'PILE-I30',      name: 'เสาเข็มตอก I-30 (0.30×0.30)', nameEn: 'I-30 Driven Pile',   uom: 'm', uomEn: 'm',   costMaterial: 401,  costLabor: 150,  category: 'Piling' },
  { code: 'PILE-I35',      name: 'เสาเข็มตอก I-35 (0.35×0.35)', nameEn: 'I-35 Driven Pile',   uom: 'm', uomEn: 'm',   costMaterial: 525,  costLabor: 180,  category: 'Piling' },
  { code: 'PILE-I40',      name: 'เสาเข็มตอก I-40 (0.40×0.40)', nameEn: 'I-40 Driven Pile',   uom: 'm', uomEn: 'm',   costMaterial: 654,  costLabor: 200,  category: 'Piling' },
  { code: 'PILE-I45',      name: 'เสาเข็มตอก I-45 (0.45×0.45)', nameEn: 'I-45 Driven Pile',   uom: 'm', uomEn: 'm',   costMaterial: 890,  costLabor: 220,  category: 'Piling' },
  { code: 'PILE-I525',     name: 'เสาเข็มตอก I-52.5 (0.525×0.525)', nameEn: 'I-52.5 Driven Pile', uom: 'm', uomEn: 'm', costMaterial: 1398, costLabor: 250, category: 'Piling' },
  // ── เสาเข็มกลม (Spun Pile) — ราคาต่อต้น @21ม. ──
  { code: 'PILE-SP25',     name: 'เสาเข็ม Spun ศก.25 ซม.', nameEn: 'Spun Pile Ø25cm',       uom: 'ต้น', uomEn: 'pcs', costMaterial: 5889, costLabor: 1500,  category: 'Piling' },
  { code: 'PILE-SP30',     name: 'เสาเข็ม Spun ศก.30 ซม.', nameEn: 'Spun Pile Ø30cm',       uom: 'ต้น', uomEn: 'pcs', costMaterial: 7979, costLabor: 1800,  category: 'Piling' },
  { code: 'PILE-SP35',     name: 'เสาเข็ม Spun ศก.35 ซม.', nameEn: 'Spun Pile Ø35cm',       uom: 'ต้น', uomEn: 'pcs', costMaterial: 9765, costLabor: 2000,  category: 'Piling' },
  { code: 'PILE-SP40',     name: 'เสาเข็ม Spun ศก.40 ซม.', nameEn: 'Spun Pile Ø40cm',       uom: 'ต้น', uomEn: 'pcs', costMaterial: 12840, costLabor: 2500, category: 'Piling' },
  { code: 'PILE-SP45',     name: 'เสาเข็ม Spun ศก.45 ซม.', nameEn: 'Spun Pile Ø45cm',       uom: 'ต้น', uomEn: 'pcs', costMaterial: 12930, costLabor: 2500, category: 'Piling' },
  { code: 'PILE-SP50',     name: 'เสาเข็ม Spun ศก.50 ซม.', nameEn: 'Spun Pile Ø50cm',       uom: 'ต้น', uomEn: 'pcs', costMaterial: 18988, costLabor: 3000, category: 'Piling' },
  { code: 'PILE-SP60',     name: 'เสาเข็ม Spun ศก.60 ซม.', nameEn: 'Spun Pile Ø60cm',       uom: 'ต้น', uomEn: 'pcs', costMaterial: 25612, costLabor: 3500, category: 'Piling' },
  { code: 'PILE-SP80',     name: 'เสาเข็ม Spun ศก.80 ซม.', nameEn: 'Spun Pile Ø80cm',       uom: 'ต้น', uomEn: 'pcs', costMaterial: 41435, costLabor: 5000, category: 'Piling' },
  // ── เสาเข็มสั้น (Mini Pile) 15 ซม. — ราคาต่อต้น ──
  { code: 'PILE-MINI-2M',  name: 'เสาเข็มสั้น 15ซม. ยาว 2ม.', nameEn: 'Mini Pile 15cm × 2m',   uom: 'ต้น', uomEn: 'pcs', costMaterial: 151, costLabor: 80,  category: 'Piling' },
  { code: 'PILE-MINI-3M',  name: 'เสาเข็มสั้น 15ซม. ยาว 3ม.', nameEn: 'Mini Pile 15cm × 3m',   uom: 'ต้น', uomEn: 'pcs', costMaterial: 235, costLabor: 100, category: 'Piling' },
  { code: 'PILE-MINI-4M',  name: 'เสาเข็มสั้น 15ซม. ยาว 4ม.', nameEn: 'Mini Pile 15cm × 4m',   uom: 'ต้น', uomEn: 'pcs', costMaterial: 315, costLabor: 120, category: 'Piling' },
  { code: 'PILE-MINI-5M',  name: 'เสาเข็มสั้น 15ซม. ยาว 5ม.', nameEn: 'Mini Pile 15cm × 5m',   uom: 'ต้น', uomEn: 'pcs', costMaterial: 401, costLabor: 140, category: 'Piling' },
  { code: 'PILE-MINI-6M',  name: 'เสาเข็มสั้น 15ซม. ยาว 6ม.', nameEn: 'Mini Pile 15cm × 6m',   uom: 'ต้น', uomEn: 'pcs', costMaterial: 533, costLabor: 160, category: 'Piling' },
  // ── เสาเข็มสั้น CPAC 10×12 ซม. — ราคาต่อท่อน ──
  { code: 'PILE-CPAC-2M',  name: 'เข็มสั้น CPAC 10×12ซม. ยาว 2ม.', nameEn: 'CPAC Mini 10×12cm × 2m', uom: 'ท่อน', uomEn: 'pcs', costMaterial: 110, costLabor: 60,  category: 'Piling' },
  { code: 'PILE-CPAC-3M',  name: 'เข็มสั้น CPAC 10×12ซม. ยาว 3ม.', nameEn: 'CPAC Mini 10×12cm × 3m', uom: 'ท่อน', uomEn: 'pcs', costMaterial: 166, costLabor: 80,  category: 'Piling' },
  { code: 'PILE-CPAC-4M',  name: 'เข็มสั้น CPAC 10×12ซม. ยาว 4ม.', nameEn: 'CPAC Mini 10×12cm × 4m', uom: 'ท่อน', uomEn: 'pcs', costMaterial: 244, costLabor: 100, category: 'Piling' },
  { code: 'PILE-CPAC-5M',  name: 'เข็มสั้น CPAC 10×12ซม. ยาว 5ม.', nameEn: 'CPAC Mini 10×12cm × 5m', uom: 'ท่อน', uomEn: 'pcs', costMaterial: 322, costLabor: 120, category: 'Piling' },
  // ── เสาเข็มไม้ยูคาลิปตัส — ราคาต่อต้น ──
  { code: 'PILE-WOOD-3x3', name: 'เข็มไม้ยูคาฯ Ø3" ยาว 3ม.', nameEn: 'Eucalyptus Pile Ø3" × 3m',   uom: 'ต้น', uomEn: 'pcs', costMaterial: 31,  costLabor: 30,  category: 'Piling' },
  { code: 'PILE-WOOD-4x4', name: 'เข็มไม้ยูคาฯ Ø4" ยาว 4ม.', nameEn: 'Eucalyptus Pile Ø4" × 4m',   uom: 'ต้น', uomEn: 'pcs', costMaterial: 65,  costLabor: 40,  category: 'Piling' },
  { code: 'PILE-WOOD-5x5', name: 'เข็มไม้ยูคาฯ Ø5" ยาว 5ม.', nameEn: 'Eucalyptus Pile Ø5" × 5m',   uom: 'ต้น', uomEn: 'pcs', costMaterial: 105, costLabor: 50,  category: 'Piling' },
  { code: 'PILE-WOOD-6x6', name: 'เข็มไม้ยูคาฯ Ø6" ยาว 6ม.', nameEn: 'Eucalyptus Pile Ø6" × 6m',   uom: 'ต้น', uomEn: 'pcs', costMaterial: 230, costLabor: 60,  category: 'Piling' },
  { code: 'PILE-WOOD-8x6', name: 'เข็มไม้ยูคาฯ Ø8" ยาว 6ม.', nameEn: 'Eucalyptus Pile Ø8" × 6m',   uom: 'ต้น', uomEn: 'pcs', costMaterial: 320, costLabor: 80,  category: 'Piling' },
  // ── เสาเข็มเจาะ + อุปกรณ์ ──
  { code: 'PILE-BRD-CON',  name: 'คอนกรีตเสาเข็มเจาะ', nameEn: 'Bored Pile Concrete',              uom: 'm3', uomEn: 'cu.m.',  costMaterial: 2458, costLabor: 800,  category: 'Piling' },
  // ── บริการและอุปกรณ์เสริม ──
  { code: 'PILE-MACHINE',  name: 'ค่าเช่าเครื่องตอก/เจาะ', nameEn: 'Piling Rig Rental',           uom: 'วัน', uomEn: 'day',  costMaterial: 0,    costLabor: 12000, category: 'Piling' },
  { code: 'PILE-TRANSPORT', name: 'ค่าขนส่งเสาเข็ม', nameEn: 'Pile Transportation',                 uom: 'เที่ยว', uomEn: 'trip', costMaterial: 0,   costLabor: 3500, category: 'Piling' },
  // ── ค่าสกัดหัวเสาเข็ม และเหล็กหนวดกุ้ง (Dowel Bar) ──
  { code: 'PILE-CUT-D15',  name: 'สกัดหัวเข็มตอก I-15', nameEn: 'Cut Head I-15',                 uom: 'ต้น', uomEn: 'pcs',  costMaterial: 0,    costLabor: 120,  category: 'Piling' },
  { code: 'PILE-CUT-D18',  name: 'สกัดหัวเข็มตอก I-18', nameEn: 'Cut Head I-18',                 uom: 'ต้น', uomEn: 'pcs',  costMaterial: 0,    costLabor: 150,  category: 'Piling' },
  { code: 'PILE-CUT-D20',  name: 'สกัดหัวเข็มตอก I-20', nameEn: 'Cut Head I-20',                 uom: 'ต้น', uomEn: 'pcs',  costMaterial: 0,    costLabor: 165,  category: 'Piling' },
  { code: 'PILE-CUT-D22',  name: 'สกัดหัวเข็มตอก I-22', nameEn: 'Cut Head I-22',                 uom: 'ต้น', uomEn: 'pcs',  costMaterial: 0,    costLabor: 180,  category: 'Piling' },
  { code: 'PILE-CUT-D26',  name: 'สกัดหัวเข็มตอก I-26', nameEn: 'Cut Head I-26',                 uom: 'ต้น', uomEn: 'pcs',  costMaterial: 0,    costLabor: 230,  category: 'Piling' },
  { code: 'PILE-CUT-D30',  name: 'สกัดหัวเข็มตอก I-30', nameEn: 'Cut Head I-30',                 uom: 'ต้น', uomEn: 'pcs',  costMaterial: 0,    costLabor: 250,  category: 'Piling' },
  { code: 'PILE-CUT-D35',  name: 'สกัดหัวเข็มตอก I-35', nameEn: 'Cut Head I-35',                 uom: 'ต้น', uomEn: 'pcs',  costMaterial: 0,    costLabor: 280,  category: 'Piling' },
  { code: 'PILE-CUT-D40',  name: 'สกัดหัวเข็มตอก I-40', nameEn: 'Cut Head I-40',                 uom: 'ต้น', uomEn: 'pcs',  costMaterial: 0,    costLabor: 300,  category: 'Piling' },
  { code: 'PILE-CUT-B30',  name: 'สกัดหัวเข็มเจาะ Ø0.30', nameEn: 'Cut Head Bored Ø0.30',        uom: 'ต้น', uomEn: 'pcs',  costMaterial: 0,    costLabor: 300,  category: 'Piling' },
  { code: 'PILE-CUT-B35',  name: 'สกัดหัวเข็มเจาะ Ø0.35', nameEn: 'Cut Head Bored Ø0.35',        uom: 'ต้น', uomEn: 'pcs',  costMaterial: 0,    costLabor: 350,  category: 'Piling' },
  { code: 'PILE-CUT-B40',  name: 'สกัดหัวเข็มเจาะ Ø0.40', nameEn: 'Cut Head Bored Ø0.40',        uom: 'ต้น', uomEn: 'pcs',  costMaterial: 0,    costLabor: 400,  category: 'Piling' },
  { code: 'PILE-CUT-B50',  name: 'สกัดหัวเข็มเจาะ Ø0.50', nameEn: 'Cut Head Bored Ø0.50',        uom: 'ต้น', uomEn: 'pcs',  costMaterial: 0,    costLabor: 500,  category: 'Piling' },
  { code: 'PILE-CUT-B60',  name: 'สกัดหัวเข็มเจาะ Ø0.60', nameEn: 'Cut Head Bored Ø0.60',        uom: 'ต้น', uomEn: 'pcs',  costMaterial: 0,    costLabor: 600,  category: 'Piling' },
  { code: 'PILE-CUT-MINI', name: 'สกัดหัวเข็มสั้น (Mini Pile)', nameEn: 'Cut Head Mini Pile',          uom: 'ต้น', uomEn: 'pcs',  costMaterial: 0,    costLabor: 100,  category: 'Piling' },
  { code: 'PILE-DOWEL',    name: 'เพิ่มเหล็กหนวดกุ้ง (Dowel Bar)', nameEn: 'Dowel Bar Installation',           uom: 'ต้น', uomEn: 'pcs',  costMaterial: 15,   costLabor: 20,   category: 'Piling' },
  // ── ส่วนเพิ่มค่าแรงโครงการขนาดเล็ก (Low-Volume Surcharge) ──
  { code: 'PILE-LABOR-SURCHARGE', name: 'ค่าแรงตอกเพิ่ม (โครงการขนาดเล็ก < 50 ต้น)', nameEn: 'Low Volume Labor Surcharge', uom: 'm', uomEn: 'm', costMaterial: 0, costLabor: 22, category: 'Piling' },
  { code: 'PILE-WELD',     name: 'เชื่อมต่อเสาเข็ม (Splice)', nameEn: 'Pile Welding Joint',       uom: 'จุด', uomEn: 'joint', costMaterial: 200, costLabor: 350,  category: 'Piling' },
  { code: 'PILE-CAGE',     name: 'เหล็กเสริม Cage (เข็มเจาะ)', nameEn: 'Rebar Cage (Bored Pile)',       uom: 'kg', uomEn: 'kg',  costMaterial: 21,   costLabor: 6,    category: 'Piling' },
  { code: 'PILE-BENTO',    name: 'น้ำ Bentonite (Slurry)', nameEn: 'Bentonite Slurry',           uom: 'm3', uomEn: 'cu.m.',  costMaterial: 800,  costLabor: 0,    category: 'Piling' },
  { code: 'PILE-CASING',   name: 'ค่าเช่าปลอก Casing ชั่วคราว', nameEn: 'Temp. Casing Rental',   uom: 'm', uomEn: 'm',    costMaterial: 0,    costLabor: 150,  category: 'Piling' },
  { code: 'PILE-LOADTEST', name: 'Load Test (Dynamic)', nameEn: 'Dynamic Load Test',             uom: 'ต้น', uomEn: 'pcs',  costMaterial: 0,    costLabor: 28500, category: 'Piling' },
  { code: 'PILE-LOADTEST-STATIC', name: 'Load Test (Static)', nameEn: 'Static Load Test',        uom: 'ต้น', uomEn: 'pcs',  costMaterial: 0,    costLabor: 45000, category: 'Piling' },
  { code: 'PILE-SEISMIC',  name: 'Seismic Integrity Test', nameEn: 'Seismic Integrity Test',           uom: 'ต้น', uomEn: 'pcs',  costMaterial: 0,    costLabor: 200,   category: 'Piling' },
  { code: 'PILE-SOIL',     name: 'ค่าเจาะสำรวจดิน (Soil Boring)', nameEn: 'Soil Boring Test',     uom: 'หลุม', uomEn: 'hole', costMaterial: 0,   costLabor: 15000, category: 'Piling' },

  // ═══════════════════════════════════════════════════════════════════════════
  // STRUCTURAL CORE SYSTEM (อ้างอิงราคากลาง หมวด 2 โครงสร้าง)
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Concrete Materials
  { code: 'CON-LEAN', name: 'คอนกรีตหยาบ 1:3:5', nameEn: 'Lean Concrete',             uom: 'm3', uomEn: 'cu.m.',  costMaterial: 1600, costLabor: 0, category: 'Structural Concrete' },
  { code: 'CON-180',  name: 'คอนกรีตผสมเสร็จ 180 ksc', nameEn: 'Ready Mix Conc. 180 ksc', uom: 'm3', uomEn: 'cu.m.',  costMaterial: 2150, costLabor: 0, category: 'Structural Concrete' },
  { code: 'CON-210',  name: 'คอนกรีตผสมเสร็จ 210 ksc', nameEn: 'Ready Mix Conc. 210 ksc', uom: 'm3', uomEn: 'cu.m.',  costMaterial: 2250, costLabor: 0, category: 'Structural Concrete' },
  { code: 'CON-240',  name: 'คอนกรีตผสมเสร็จ 240 ksc', nameEn: 'Ready Mix Conc. 240 ksc', uom: 'm3', uomEn: 'cu.m.',  costMaterial: 2458, costLabor: 0, category: 'Structural Concrete' },
  { code: 'CON-280',  name: 'คอนกรีตผสมเสร็จ 280 ksc', nameEn: 'Ready Mix Conc. 280 ksc', uom: 'm3', uomEn: 'cu.m.',  costMaterial: 2550, costLabor: 0, category: 'Structural Concrete' },
  { code: 'CON-300',  name: 'คอนกรีตผสมเสร็จ 300 ksc', nameEn: 'Ready Mix Conc. 300 ksc', uom: 'm3', uomEn: 'cu.m.',  costMaterial: 2600, costLabor: 0, category: 'Structural Concrete' },
  { code: 'CON-320',  name: 'คอนกรีตผสมเสร็จ 320 ksc', nameEn: 'Ready Mix Conc. 320 ksc', uom: 'm3', uomEn: 'cu.m.',  costMaterial: 2700, costLabor: 0, category: 'Structural Concrete' },
  { code: 'CON-350',  name: 'คอนกรีตผสมเสร็จ 350 ksc', nameEn: 'Ready Mix Conc. 350 ksc', uom: 'm3', uomEn: 'cu.m.',  costMaterial: 2850, costLabor: 0, category: 'Structural Concrete' },
  // Manual Mix Ingredients (1:2:4)
  { code: 'CON-MIX-CEMENT', name: 'ปูนซีเมนต์ปอร์ตแลนด์ ประเภท 1', nameEn: 'Portland Cement Type 1', uom: 'ถุง', uomEn: 'bag', costMaterial: 150, costLabor: 0, category: 'Structural Concrete' },
  { code: 'CON-MIX-SAND',   name: 'ทรายหยาบผสมคอนกรีต', nameEn: 'Coarse Sand for Concrete', uom: 'm3', uomEn: 'cu.m.', costMaterial: 450, costLabor: 0, category: 'Structural Concrete' },
  { code: 'CON-MIX-STONE',  name: 'หินย่อย/หินผสมคอนกรีต', nameEn: 'Crushed Stone for Concrete', uom: 'm3', uomEn: 'cu.m.', costMaterial: 550, costLabor: 0, category: 'Structural Concrete' },
  // Additives
  { code: 'CON-ADMIX-WP', name: 'น้ำยากันซึมผสมคอนกรีต', nameEn: 'Waterproofing Admixture',   uom: 'm3', uomEn: 'cu.m.',  costMaterial: 50,  costLabor: 0, category: 'Structural Concrete' },
  { code: 'CON-BOND',     name: 'น้ำยาประสานคอนกรีต', nameEn: 'Concrete Bonding Agent',        uom: 'm2', uomEn: 'sq.m.',  costMaterial: 28,  costLabor: 8, category: 'Structural Concrete' },
  
  // 2. Concrete Pouring Labor (ค่าแรงเทคอนกรีต)
  { code: 'LAB-POUR-GRND', name: 'ค่าแรงเทคอนกรีต งานระดับดิน (ถนน/ฐานราก)', nameEn: 'Concrete Pouring (Ground)', uom: 'm3', uomEn: 'cu.m.', costMaterial: 0, costLabor: 398, category: 'Structural Labor' },
  { code: 'LAB-POUR-1FL',  name: 'ค่าแรงเทคอนกรีต โครงสร้างชั้นเดียว', nameEn: 'Concrete Pouring (1-Story)', uom: 'm3', uomEn: 'cu.m.', costMaterial: 0, costLabor: 436, category: 'Structural Labor' },
  { code: 'LAB-POUR-2FL',  name: 'ค่าแรงเทคอนกรีต โครงสร้าง 2 ชั้นขึ้นไป', nameEn: 'Concrete Pouring (Multi-Story)', uom: 'm3', uomEn: 'cu.m.', costMaterial: 0, costLabor: 519, category: 'Structural Labor' },
  { code: 'LAB-MIX-CONC',  name: 'ค่าแรงโม่/ผสมคอนกรีตด้วยเครื่องมือ', nameEn: 'Manual Mix Concrete Labor', uom: 'm3', uomEn: 'cu.m.', costMaterial: 0, costLabor: 450, category: 'Structural Labor' },

  // 3. Formwork (ไม้แบบ)
  { code: 'FW-GRND',    name: 'แบบหล่อคอนกรีต งานถนน/ลาน/บ่อพัก', nameEn: 'Formwork (Ground)', uom: 'm2', uomEn: 'sq.m.', costMaterial: 80,  costLabor: 121, category: 'Structural Formwork' },
  { code: 'FW-BLDG',    name: 'แบบหล่อคอนกรีต อาคารไม่เกิน 5 ชั้น', nameEn: 'Formwork (Bldg < 5F)', uom: 'm2', uomEn: 'sq.m.', costMaterial: 160, costLabor: 121, category: 'Structural Formwork' },
  { code: 'FW-BLDG-H',  name: 'แบบหล่อคอนกรีต อาคารเกิน 5 ชั้น', nameEn: 'Formwork (Bldg > 5F)',  uom: 'm2', uomEn: 'sq.m.', costMaterial: 160, costLabor: 139, category: 'Structural Formwork' },
  { code: 'FW-PRECAST', name: 'แบบหล่อชิ้นส่วนสำเร็จรูป (Precast)', nameEn: 'Formwork (Precast)',    uom: 'm2', uomEn: 'sq.m.', costMaterial: 50,  costLabor: 121, category: 'Structural Formwork' },

  // 4. Rebar Standard Extras
  { code: 'RB-WIRE',    name: 'ลวดผูกเหล็ก', nameEn: 'Tie Wire for Rebar',         uom: 'kg', uomEn: 'kg', costMaterial: 26, costLabor: 0, category: 'Structural Rebar' },
  { code: 'RB-SPACER',  name: 'ลูกปูนรองกั้นเหล็กเทซ멘ต์ (Spacer)', nameEn: 'Concrete Spacer', uom: 'pcs', uomEn: 'pcs', costMaterial: 5, costLabor: 0, category: 'Structural Rebar' },


  // ═══════════════════════════════════════════════════════════════════════════
  // Step 6 : Footing / Foundation
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'FTG-EXC',      name: 'งานขุดดินฐานราก (เครื่องจักร)', nameEn: 'Footing Earth Excavation',    uom: 'm3', uomEn: 'cu.m.',  costMaterial: 0,    costLabor: 125,  category: 'Footing' },
  { code: 'FTG-SAND',     name: 'ทรายหยาบบดอัดแน่นใต้ฐาน', nameEn: 'Compacted Sand Base',         uom: 'm3', uomEn: 'cu.m.',  costMaterial: 450,  costLabor: 50,   category: 'Footing' },
  { code: 'FTG-LEAN',     name: 'คอนกรีตหยาบ 1:3:5 ใต้ฐาน', nameEn: 'Lean Concrete 1:3:5',        uom: 'm3', uomEn: 'cu.m.',  costMaterial: 1600, costLabor: 150,  category: 'Footing' },
  { code: 'FTG-CON',      name: 'คอนกรีตโครงสร้างฐานราก 240 ksc', nameEn: 'Footing Concrete (240 ksc)',  uom: 'm3', uomEn: 'cu.m.',  costMaterial: 2458, costLabor: 300,  category: 'Footing' },
  { code: 'FTG-REBAR',    name: 'เหล็กเสริมฐานราก', nameEn: 'Footing Rebar',                 uom: 'kg', uomEn: 'kg',  costMaterial: 21,   costLabor: 4,    category: 'Footing' },
  { code: 'FTG-WIRE',     name: 'ลวดผูกเหล็ก', nameEn: 'Tie Wire',                     uom: 'kg', uomEn: 'kg',  costMaterial: 26,   costLabor: 0,    category: 'Footing' },
  { code: 'FTG-SPACER',   name: 'ลูกปูน Spacer', nameEn: 'Concrete Spacer',                   uom: 'pcs', uomEn: 'pcs', costMaterial: 5,    costLabor: 0,    category: 'Footing' },
  { code: 'FTG-FORM',     name: 'ไม้แบบฐานราก', nameEn: 'Footing Formwork',                     uom: 'm2', uomEn: 'sq.m.',  costMaterial: 250,  costLabor: 150,  category: 'Footing' },
  { code: 'FTG-FILL',     name: 'ดินถมกลับ (ฐานราก)', nameEn: 'Footing Soil Backfill',               uom: 'm3', uomEn: 'cu.m.',  costMaterial: 80,   costLabor: 100,  category: 'Footing' },
  { code: 'FTG-PUMP',     name: 'ปั๊มคอนกรีต (Concrete Pump)', nameEn: 'Concrete Pump',      uom: 'วัน', uomEn: 'day',  costMaterial: 0,    costLabor: 8000, category: 'Footing' },
  { code: 'FTG-DEWATER',  name: 'ปั๊มสูบน้ำ (Dewatering)', nameEn: 'Dewatering Pump',          uom: 'วัน', uomEn: 'day',  costMaterial: 500,  costLabor: 800,  category: 'Footing' },
  { code: 'FTG-VIBRATOR', name: 'เครื่องจี้คอนกรีต (Vibrator)', nameEn: 'Concrete Vibrator',       uom: 'วัน', uomEn: 'day',  costMaterial: 0,    costLabor: 500,  category: 'Footing' },
  { code: 'FTG-CURING',   name: 'พลาสติก/น้ำยาบ่มคอนกรีต', nameEn: 'Curing Compound/Plastic',          uom: 'm2', uomEn: 'sq.m.',  costMaterial: 15,   costLabor: 5,    category: 'Footing' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 7 : Pedestal / Column Stump
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'PDS-CON',      name: 'คอนกรีตเสาตอม่อ 240 ksc', nameEn: 'Pedestal Concrete (240 ksc)',          uom: 'm3', uomEn: 'cu.m.',  costMaterial: 2458, costLabor: 350,  category: 'Pedestal' },
  { code: 'PDS-REBAR',    name: 'เหล็กเสริมเสาตอม่อ', nameEn: 'Pedestal Rebar',                uom: 'kg', uomEn: 'kg',  costMaterial: 21,   costLabor: 5,    category: 'Pedestal' },
  { code: 'PDS-WIRE',     name: 'ลวดผูกเหล็ก', nameEn: 'Tie Wire',                      uom: 'kg', uomEn: 'kg',  costMaterial: 26,   costLabor: 0,    category: 'Pedestal' },
  { code: 'PDS-SPACER',   name: 'ลูกปูน Spacer', nameEn: 'Concrete Spacer',                    uom: 'pcs', uomEn: 'pcs', costMaterial: 5,    costLabor: 0,    category: 'Pedestal' },
  { code: 'PDS-FORM',     name: 'ไม้แบบเสาตอม่อ', nameEn: 'Pedestal Formwork',                   uom: 'm2', uomEn: 'sq.m.',  costMaterial: 250,  costLabor: 150,  category: 'Pedestal' },
  { code: 'PDS-DOWEL',    name: 'Dowel Bar ยื่นรอเสาชั้น 1', nameEn: 'Dowel Bar',         uom: 'm', uomEn: 'm',   costMaterial: 23,   costLabor: 5,    category: 'Pedestal' },
  { code: 'PDS-PUMP',     name: 'ปั๊มคอนกรีต', nameEn: 'Concrete Pump',                       uom: 'วัน', uomEn: 'day',  costMaterial: 0,    costLabor: 8000, category: 'Pedestal' },
  { code: 'PDS-VIBRATOR', name: 'เครื่องจี้คอนกรีต', nameEn: 'Concrete Vibrator',                  uom: 'วัน', uomEn: 'day',  costMaterial: 0,    costLabor: 500,  category: 'Pedestal' },
  { code: 'PDS-CURING',   name: 'พลาสติก/น้ำยาบ่ม', nameEn: 'Curing Compound/Plastic',                  uom: 'm2', uomEn: 'sq.m.',  costMaterial: 15,   costLabor: 5,    category: 'Pedestal' },


  // ═══════════════════════════════════════════════════════════════════════════
  // Step 8 : Ground Beam / คานคอดิน
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'GBM-EXC',      name: 'ขุดดินคานคอดิน (เครื่องจักร)', nameEn: 'Ground Beam Excavation',     uom: 'm3', uomEn: 'cu.m.',  costMaterial: 0,    costLabor: 125,  category: 'Ground Beam' },
  { code: 'GBM-SAND',     name: 'ทรายรองใต้ลีน', nameEn: 'Compacted Sand Base',                   uom: 'm3', uomEn: 'cu.m.',  costMaterial: 450,  costLabor: 50,   category: 'Ground Beam' },
  { code: 'GBM-LEAN',     name: 'คอนกรีตหยาบ 1:3:5 ใต้คาน', nameEn: 'Lean Concrete 1:3:5',       uom: 'm3', uomEn: 'cu.m.',  costMaterial: 1600, costLabor: 150,  category: 'Ground Beam' },
  { code: 'GBM-CON',      name: 'คอนกรีตคานคอดิน 240 ksc', nameEn: 'Ground Beam Conc. (240 ksc)',         uom: 'm3', uomEn: 'cu.m.',  costMaterial: 2458, costLabor: 300,  category: 'Ground Beam' },
  { code: 'GBM-REBAR',    name: 'เหล็กเสริมคานคอดิน', nameEn: 'Ground Beam Rebar',               uom: 'kg', uomEn: 'kg',  costMaterial: 21,   costLabor: 5,    category: 'Ground Beam' },
  { code: 'GBM-WIRE',     name: 'ลวดผูกเหล็ก', nameEn: 'Tie Wire',                     uom: 'kg', uomEn: 'kg',  costMaterial: 26,   costLabor: 0,    category: 'Ground Beam' },
  { code: 'GBM-SPACER',   name: 'ลูกปูน Spacer', nameEn: 'Concrete Spacer',                   uom: 'pcs', uomEn: 'pcs', costMaterial: 5,    costLabor: 0,    category: 'Ground Beam' },
  { code: 'GBM-FORM',     name: 'ไม้แบบคานคอดิน', nameEn: 'Ground Beam Formwork',                  uom: 'm2', uomEn: 'sq.m.',  costMaterial: 250,  costLabor: 150,  category: 'Ground Beam' },
  { code: 'GBM-FILL',     name: 'ดินถมกลับ (คานคอดิน)', nameEn: 'Soil Backfill',             uom: 'm3', uomEn: 'cu.m.',  costMaterial: 80,   costLabor: 100,  category: 'Ground Beam' },
  { code: 'GBM-PUMP',     name: 'ปั๊มคอนกรีต', nameEn: 'Concrete Pump',                      uom: 'วัน', uomEn: 'day',  costMaterial: 0,    costLabor: 8000, category: 'Ground Beam' },
  { code: 'GBM-VIBRATOR', name: 'เครื่องจี้คอนกรีต', nameEn: 'Concrete Vibrator',                 uom: 'วัน', uomEn: 'day',  costMaterial: 0,    costLabor: 500,  category: 'Ground Beam' },
  { code: 'GBM-CURING',   name: 'พลาสติก/น้ำยาบ่มคอนกรีต', nameEn: 'Curing Compound/Plastic',         uom: 'm2', uomEn: 'sq.m.',  costMaterial: 15,   costLabor: 5,    category: 'Ground Beam' },
  { code: 'GBM-TERMITE',  name: 'ระบบท่ออัดน้ำยาปลวก', nameEn: 'Termite Piping System',               uom: 'm', uomEn: 'm',   costMaterial: 60,   costLabor: 20,   category: 'Ground Beam' },


  // ═══════════════════════════════════════════════════════════════════════════
  // Step 9 : Slab on Grade / พื้นหล่อในที่
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'SOG-SAND',     name: 'ทรายปรับระดับใต้พื้น', nameEn: 'Sand Leveling Course',             uom: 'm3', uomEn: 'cu.m.',  costMaterial: 450,  costLabor: 50,   category: 'Slab on Grade' },
  { code: 'SOG-PLASTIC',  name: 'พลาสติกกันชื้น', nameEn: 'Moisture Barrier Plastic',                   uom: 'm2', uomEn: 'sq.m.',  costMaterial: 8,    costLabor: 5,    category: 'Slab on Grade' },
  { code: 'SOG-MESH',     name: 'ไวร์เมชพื้น', nameEn: 'Wire Mesh',                      uom: 'kg', uomEn: 'kg',  costMaterial: 30,   costLabor: 5,    category: 'Slab on Grade' },
  { code: 'SOG-REBAR',    name: 'เหล็กเส้นเสริมพื้น', nameEn: 'Slab Rebar',                uom: 'kg', uomEn: 'kg',  costMaterial: 21,   costLabor: 4,    category: 'Slab on Grade' },
  { code: 'SOG-CON',      name: 'คอนกรีตพื้น 240 ksc', nameEn: 'Slab Concrete (240 ksc)',              uom: 'm3', uomEn: 'cu.m.',  costMaterial: 2458, costLabor: 300,  category: 'Slab on Grade' },
  { code: 'SOG-FORM-EDG', name: 'ไม้แบบขอบพื้น', nameEn: 'Edge Formwork',                    uom: 'm', uomEn: 'm',   costMaterial: 80,   costLabor: 40,   category: 'Slab on Grade' },
  { code: 'SOG-CJOINT',   name: 'ร่องตัด Control Joint', nameEn: 'Control Joint Cutter',            uom: 'm', uomEn: 'm',   costMaterial: 10,   costLabor: 25,   category: 'Slab on Grade' },
  { code: 'SOG-EJOINT',   name: 'Expansion Joint (วัสดุยาแนว)', nameEn: 'Expansion Joint Sealant',      uom: 'm', uomEn: 'm',   costMaterial: 50,   costLabor: 30,   category: 'Slab on Grade' },
  { code: 'SOG-PUMP',     name: 'ปั๊มคอนกรีต', nameEn: 'Concrete Pump',                      uom: 'วัน', uomEn: 'day',  costMaterial: 0,    costLabor: 8000, category: 'Slab on Grade' },
  { code: 'SOG-VIBRATOR', name: 'เครื่องจี้ + Vibrating Screed', nameEn: 'Vibrating Screed',     uom: 'วัน', uomEn: 'day',  costMaterial: 0,    costLabor: 800,  category: 'Slab on Grade' },
  { code: 'SOG-CURING',   name: 'พลาสติก/น้ำยาบ่มคอนกรีต', nameEn: 'Curing Compound/Plastic',          uom: 'm2', uomEn: 'sq.m.',  costMaterial: 15,   costLabor: 5,    category: 'Slab on Grade' },
  { code: 'SOG-HARDENER', name: 'Floor Hardener', nameEn: 'Floor Hardener',                   uom: 'kg', uomEn: 'kg',  costMaterial: 18,   costLabor: 5,    category: 'Slab on Grade' },
  { code: 'SOG-SLEEVE',   name: 'Sleeve ท่อผ่านพื้น', nameEn: 'Pipe Sleeve',               uom: 'pcs', uomEn: 'pcs', costMaterial: 80,   costLabor: 30,   category: 'Slab on Grade' },


  // ═══════════════════════════════════════════════════════════════════════════
  // Step 10 : Precast Slab / พื้นสำเร็จรูป
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'PCS-PANEL',    name: 'แผ่นพื้นสำเร็จรูป หนา 15 ซม. 4 ลวด', nameEn: 'Precast Slab 15cm 4-wire',  uom: 'm2', uomEn: 'sq.m.',   costMaterial: 431,  costLabor: 50,   category: 'Precast Slab' },
  { code: 'PCS-PANEL-5W', name: 'แผ่นพื้นสำเร็จรูป หนา 15 ซม. 5 ลวด', nameEn: 'Precast Slab 15cm 5-wire',  uom: 'm2', uomEn: 'sq.m.',   costMaterial: 443,  costLabor: 50,   category: 'Precast Slab' },
  { code: 'PCS-PANEL-20', name: 'แผ่นพื้นสำเร็จรูป หนา 20 ซม. 4 ลวด', nameEn: 'Precast Slab 20cm 4-wire',  uom: 'm2', uomEn: 'sq.m.',   costMaterial: 491,  costLabor: 55,   category: 'Precast Slab' },
  { code: 'PCS-PANEL-25', name: 'แผ่นพื้นสำเร็จรูป หนา 25 ซม. 4 ลวด', nameEn: 'Precast Slab 25cm 4-wire',  uom: 'm2', uomEn: 'sq.m.',   costMaterial: 574,  costLabor: 60,   category: 'Precast Slab' },
  { code: 'PCS-MESH',     name: 'ไวร์เมชทับหน้า', nameEn: 'Topping Wire Mesh',                     uom: 'kg', uomEn: 'kg',   costMaterial: 30,   costLabor: 5,    category: 'Precast Slab' },
  { code: 'PCS-TOP-CON',  name: 'คอนกรีตทับหน้า 240 ksc', nameEn: 'Topping Concrete 240 ksc',             uom: 'm3', uomEn: 'cu.m.',   costMaterial: 2100, costLabor: 300,  category: 'Precast Slab' },
  { code: 'PCS-SHORE',    name: 'ค้ำยันท้องพื้น (Shoring)', nameEn: 'Slab Shoring',            uom: 'm', uomEn: 'm',    costMaterial: 50,   costLabor: 30,   category: 'Precast Slab' },
  { code: 'PCS-GROUT',    name: 'เกร้าท์ร่องระหว่างแผ่น', nameEn: 'Joint Grout',              uom: 'kg', uomEn: 'kg',   costMaterial: 15,   costLabor: 8,    category: 'Precast Slab' },
  { code: 'PCS-CRANE',    name: 'เครนยกแผ่นพื้น', nameEn: 'Crane Rental',                     uom: 'วัน', uomEn: 'day',   costMaterial: 0,    costLabor: 12000, category: 'Precast Slab' },
  { code: 'PCS-PUMP',     name: 'ปั๊มคอนกรีตทับหน้า', nameEn: 'Concrete Pump',                  uom: 'วัน', uomEn: 'day',   costMaterial: 0,    costLabor: 8000, category: 'Precast Slab' },
  { code: 'PCS-VIBRATOR', name: 'เครื่องจี้ + ปาดคอนกรีต', nameEn: 'Concrete Vibrator',             uom: 'วัน', uomEn: 'day',   costMaterial: 0,    costLabor: 500,  category: 'Precast Slab' },
  { code: 'PCS-CURING',   name: 'พลาสติก/น้ำยาบ่มทับหน้า', nameEn: 'Curing Compound/Plastic',            uom: 'm2', uomEn: 'sq.m.',   costMaterial: 15,   costLabor: 5,    category: 'Precast Slab' },
  { code: 'PCS-TERMITE',  name: 'ท่อยาปลวก', nameEn: 'Termite Pipe',                         uom: 'm', uomEn: 'm',    costMaterial: 60,   costLabor: 20,   category: 'Precast Slab' },
  { code: 'PCS-DELIVER',  name: 'ขนส่งแผ่นพื้น', nameEn: 'Slab Transportation',                      uom: 'เที่ยว', uomEn: 'trip', costMaterial: 0,    costLabor: 3500, category: 'Precast Slab' },


  // ═══════════════════════════════════════════════════════════════════════════
  // Step 11 : Column Floor 1 / เสาชั้น 1
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'COL-CON',      name: 'คอนกรีตเสาชั้น 1 (240 ksc)', nameEn: 'L1 Column Conc. (240 ksc)',         uom: 'm3', uomEn: 'cu.m.',  costMaterial: 2458, costLabor: 1000, category: 'Column' },
  { code: 'COL-REBAR',    name: 'เหล็กเสริมเสาชั้น 1', nameEn: 'Column Rebar',                uom: 'kg', uomEn: 'kg',  costMaterial: 21,   costLabor: 5,    category: 'Column' },
  { code: 'COL-WIRE',     name: 'ลวดผูกเหล็ก', nameEn: 'Tie Wire',                       uom: 'kg', uomEn: 'kg',  costMaterial: 26,   costLabor: 0,    category: 'Column' },
  { code: 'COL-SPACER',   name: 'ลูกปูน Spacer', nameEn: 'Concrete Spacer',                     uom: 'pcs', uomEn: 'pcs', costMaterial: 5,    costLabor: 0,    category: 'Column' },
  { code: 'COL-FORM',     name: 'ไม้แบบเสาชั้น 1 (รวมไม้คร่าว+ตะปู)', nameEn: 'Column Formwork', uom: 'm2', uomEn: 'sq.m.',  costMaterial: 337,  costLabor: 150,  category: 'Column' },
  { code: 'COL-PUMP',     name: 'ปั๊มคอนกรีต', nameEn: 'Concrete Pump',                       uom: 'วัน', uomEn: 'day',  costMaterial: 0,    costLabor: 8000, category: 'Column' },
  { code: 'COL-VIBRATOR', name: 'เครื่องจี้คอนกรีต', nameEn: 'Concrete Vibrator',                  uom: 'วัน', uomEn: 'day',  costMaterial: 0,    costLabor: 500,  category: 'Column' },
  { code: 'COL-CURING',   name: 'พลาสติก/น้ำยาบ่ม', nameEn: 'Curing Compound/Plastic',                  uom: 'm2', uomEn: 'sq.m.',  costMaterial: 15,   costLabor: 5,    category: 'Column' },


  // ═══════════════════════════════════════════════════════════════════════════
  // Step 12 : Beam + Roof Deck / คาน + พื้นดาดฟ้า
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'BMS-CON',      name: 'คอนกรีตคานดาดฟ้า 240 ksc', nameEn: 'Roof Beam Conc. (240 ksc)',         uom: 'm3', uomEn: 'cu.m.',  costMaterial: 2458, costLabor: 500,  category: 'Beam-Slab' },
  { code: 'BMS-SLAB-CON', name: 'คอนกรีตพื้นดาดฟ้า 240 ksc', nameEn: 'Roof Deck Conc. (240 ksc)',        uom: 'm3', uomEn: 'cu.m.',  costMaterial: 2458, costLabor: 400,  category: 'Beam-Slab' },
  { code: 'BMS-SLOPE',    name: 'คอนกรีตเทปรับสโลปดาดฟ้า', nameEn: 'Slope Adjustment Concrete',          uom: 'm3', uomEn: 'cu.m.',  costMaterial: 2437, costLabor: 300,  category: 'Beam-Slab' },
  { code: 'BMS-REBAR',    name: 'เหล็กเสริมคาน+พื้น', nameEn: 'Beam/Slab Rebar',               uom: 'kg', uomEn: 'kg',  costMaterial: 21,   costLabor: 5,    category: 'Beam-Slab' },
  { code: 'BMS-WIRE',     name: 'ลวดผูกเหล็ก', nameEn: 'Tie Wire',                     uom: 'kg', uomEn: 'kg',  costMaterial: 26,   costLabor: 0,    category: 'Beam-Slab' },
  { code: 'BMS-SPACER',   name: 'ลูกปูน Spacer (คาน+พื้น)', nameEn: 'Concrete Spacer',          uom: 'pcs', uomEn: 'pcs', costMaterial: 5,    costLabor: 0,    category: 'Beam-Slab' },
  { code: 'BMS-FORM',     name: 'ไม้แบบคาน+พื้นดาดฟ้า', nameEn: 'Roof Beam/Deck Formwork',             uom: 'm2', uomEn: 'sq.m.',  costMaterial: 337,  costLabor: 150,  category: 'Beam-Slab' },
  { code: 'BMS-SHORE',    name: 'ไม้ค้ำยันท้องคาน+พื้น', nameEn: 'Beam/Deck Shoring',              uom: 'pcs', uomEn: 'pcs', costMaterial: 150,  costLabor: 50,   category: 'Beam-Slab' },
  { code: 'BMS-WP',       name: 'ระบบกันซึมดาดฟ้า (Waterproofing)', nameEn: 'Roof Waterproofing System',  uom: 'm2', uomEn: 'sq.m.',  costMaterial: 250,  costLabor: 150,  category: 'Beam-Slab' },
  { code: 'BMS-DRAIN',    name: 'หัว Roof Drain', nameEn: 'Roof Drain',                 uom: 'pcs', uomEn: 'pcs', costMaterial: 450,  costLabor: 150,  category: 'Beam-Slab' },
  { code: 'BMS-PUMP',     name: 'ปั๊มคอนกรีต', nameEn: 'Concrete Pump',                      uom: 'วัน', uomEn: 'day',  costMaterial: 0,    costLabor: 8000, category: 'Beam-Slab' },
  { code: 'BMS-VIBRATOR', name: 'เครื่องจี้คอนกรีต', nameEn: 'Concrete Vibrator',                  uom: 'วัน', uomEn: 'day',  costMaterial: 0,    costLabor: 500,  category: 'Beam-Slab' },
  { code: 'BMS-CURING',   name: 'พลาสติก/น้ำยาบ่มดาดฟ้า', nameEn: 'Curing Compound/Plastic',            uom: 'm2', uomEn: 'sq.m.',  costMaterial: 15,   costLabor: 5,    category: 'Beam-Slab' },


  // --- Step 13 : Staircase ---
  // ═══════════════════════════════════════════════════════════════════════════
  // Step 13 : Staircase / โครงสร้างบันได
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'STR-CON',      name: 'คอนกรีตโครงสร้างบันได (240 ksc)', nameEn: 'Stair Concrete (240 ksc)',     uom: 'm3', uomEn: 'cu.m.',  costMaterial: 2458, costLabor: 500,  category: 'Staircase' },
  { code: 'STR-REBAR',    name: 'เหล็กเสริมบันได', nameEn: 'Stair Rebar',                    uom: 'kg', uomEn: 'kg',  costMaterial: 21,   costLabor: 5,    category: 'Staircase' },
  { code: 'STR-WIRE',     name: 'ลวดผูกเหล็ก', nameEn: 'Tie Wire',                       uom: 'kg', uomEn: 'kg',  costMaterial: 26,   costLabor: 0,    category: 'Staircase' },
  { code: 'STR-SPACER',   name: 'ลูกปูน Spacer ท้องบันได', nameEn: 'Concrete Spacer',            uom: 'pcs', uomEn: 'pcs', costMaterial: 5,    costLabor: 0,    category: 'Staircase' },
  { code: 'STR-FORM',     name: 'ไม้แบบบันได (ท้อง+ข้าง+ลูกตั้ง)', nameEn: 'Stair Formwork',      uom: 'm2', uomEn: 'sq.m.',  costMaterial: 337,  costLabor: 150,  category: 'Staircase' },
  { code: 'STR-SHORE',    name: 'ไม้ค้ำยันท้องบันได+ชานพัก', nameEn: 'Stair Shoring',            uom: 'pcs', uomEn: 'pcs', costMaterial: 150,  costLabor: 50,   category: 'Staircase' },
  { code: 'STR-NOSING',   name: 'จมูกบันไดกันลื่น', nameEn: 'Stair Nosing',                    uom: 'm', uomEn: 'm',   costMaterial: 80,   costLabor: 30,   category: 'Staircase' },
  { code: 'STR-PUMP',     name: 'ปั๊มคอนกรีต', nameEn: 'Concrete Pump',                       uom: 'วัน', uomEn: 'day',  costMaterial: 0,    costLabor: 8000, category: 'Staircase' },
  { code: 'STR-VIBRATOR', name: 'เครื่องจี้คอนกรีต', nameEn: 'Concrete Vibrator',                  uom: 'วัน', uomEn: 'day',  costMaterial: 0,    costLabor: 500,  category: 'Staircase' },
  { code: 'STR-CURING',   name: 'พลาสติก/น้ำยาบ่มบันได', nameEn: 'Curing Compound/Plastic',             uom: 'm2', uomEn: 'sq.m.',  costMaterial: 15,   costLabor: 5,    category: 'Staircase' },


  // ═══════════════════════════════════════════════════════════════════════════
  // Step 14 : Column Cap Plate / เพลทหัวเสา
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'CCP-STEEL',    name: 'เพลทเหล็กหัวเสา (ตัดตามขนาด)', nameEn: 'Column Steel Cap Plate',        uom: 'kg', uomEn: 'kg',  costMaterial: 45,   costLabor: 15,   category: 'Column Cap' },
  { code: 'CCP-BOLT',     name: 'J-Bolt / Anchor Bolt', nameEn: 'J-Bolt / Anchor Bolt',            uom: 'ตัว', uomEn: 'pcs',  costMaterial: 120,  costLabor: 50,   category: 'Column Cap' },
  { code: 'CCP-TEMPLATE', name: 'แพทเทิร์นประคอง Bolt (ตีไม้เจาะรู)', nameEn: 'Bolt Guide Template',    uom: 'จุด', uomEn: 'point',  costMaterial: 50,   costLabor: 100,  category: 'Column Cap' },
  { code: 'CCP-GROUT',    name: 'Non-shrink Grout (ถุง 25กก.)', nameEn: 'Non-shrink Grout',      uom: 'ถุง', uomEn: 'bag',  costMaterial: 250,  costLabor: 100,  category: 'Column Cap' },
  { code: 'CCP-WELD',     name: 'ค่าแรงเชื่อมเสากับเพลท', nameEn: 'Cap Plate Welding',              uom: 'm', uomEn: 'm',   costMaterial: 50,   costLabor: 250,  category: 'Column Cap' },
  { code: 'CCP-PAINT',    name: 'ทาสีกันสนิมเพลท+รอยเชื่อม', nameEn: 'Anti-rust Paint',           uom: 'm2', uomEn: 'sq.m.',  costMaterial: 54,   costLabor: 40,   category: 'Column Cap' },


  // --- Step 15 : Roof Structure ---
  // ═══════════════════════════════════════════════════════════════════════════
  // Step 15 : Roof Structure / โครงหลังคา
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'RST-STEEL',    name: 'เหล็กโครงหลังคา (อะเส ดั้ง อกไก่ จันทัน ตะเข้)', nameEn: 'Structural Steel Truss', uom: 'kg', uomEn: 'kg', costMaterial: 30,   costLabor: 15,   category: 'Roof Structure' },
  { code: 'RST-WELD',     name: 'ลวดเชื่อมเหล็กรูปพรรณ', nameEn: 'Welding Rod',              uom: 'kg', uomEn: 'kg', costMaterial: 85,   costLabor: 0,    category: 'Roof Structure' },
  { code: 'RST-PAINT',    name: 'สีทารองพื้นเหล็กกันสนิม', nameEn: 'Anti-rust Primer',              uom: 'm2', uomEn: 'sq.m.', costMaterial: 54,   costLabor: 25,   category: 'Roof Structure' },
  { code: 'RST-PURLIN',   name: 'แปสำเร็จรูป GZ', nameEn: 'Galvanized Purlin',                   uom: 'm', uomEn: 'm',  costMaterial: 65,   costLabor: 15,   category: 'Roof Structure' },
  { code: 'RST-SCREW',    name: 'สกรูปลายสว่านยึดแป', nameEn: 'Purlin Drill Screw',               uom: 'ตัว', uomEn: 'pcs', costMaterial: 1.5,  costLabor: 0,    category: 'Roof Structure' },


  // ═══════════════════════════════════════════════════════════════════════════
  // Step 16 : Roofing / มุงหลังคา
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'ROF-CPAC',     name: 'กระเบื้องคอนกรีตแผ่นลอน', nameEn: 'Concrete Roof Tile',            uom: 'แผ่น', uomEn: 'sheet', costMaterial: 15,   costLabor: 10,  category: 'Roofing' },
  { code: 'ROF-EXCELLA',  name: 'กระเบื้องเซรามิค', nameEn: 'Ceramic Roof Tile',                  uom: 'แผ่น', uomEn: 'sheet', costMaterial: 85,   costLabor: 25,  category: 'Roofing' },
  { code: 'ROF-METAL',    name: 'แผ่นเมทัลชีท', nameEn: 'Metal Sheet',                     uom: 'ตร.ม.', uomEn: 'sq.m.', costMaterial: 180,  costLabor: 60,  category: 'Roofing' },
  { code: 'ROF-CORR',     name: 'กระเบื้องลอนคู่', nameEn: 'Corrugated Roof Tile',                    uom: 'แผ่น', uomEn: 'sheet', costMaterial: 65,   costLabor: 20,  category: 'Roofing' },
  { code: 'ROF-SHINGLE',  name: 'ยางมะตอย (Asphalt Shingle)', nameEn: 'Asphalt Shingle',        uom: 'ตร.ม.', uomEn: 'sq.m.', costMaterial: 350,  costLabor: 150, category: 'Roofing' },
  
  { code: 'ROF-CAP-TILE', name: 'แผ่นครอบสัน/ตะเข้สัน (กระเบื้อง)', nameEn: 'Tile Ridge/Hip Cover',       uom: 'แผ่น', uomEn: 'sheet', costMaterial: 65,   costLabor: 30,  category: 'Roofing' },
  { code: 'ROF-CAP-MET',  name: 'แผ่นครอบสัน/ตะเข้สัน (เมทัลชีท)', nameEn: 'Metal Ridge/Hip Cover',       uom: 'm', uomEn: 'm',   costMaterial: 120,  costLabor: 40,  category: 'Roofing' },
  { code: 'ROF-DRYTECH',  name: 'ชุดอุปกรณ์ยึดครอบระบบแห้ง (Dry Tech)', nameEn: 'Dry Tech System', uom: 'm', uomEn: 'm',   costMaterial: 150,  costLabor: 50,  category: 'Roofing' },
  { code: 'ROF-VALLEY',   name: 'รางน้ำตะเข้', nameEn: 'Valley Gutter',                      uom: 'm', uomEn: 'm',   costMaterial: 350,  costLabor: 100, category: 'Roofing' },
  
  { code: 'ROF-EAVE',     name: 'ไม้เชิงชาย 8" + ไม้ปิดทับ 6"', nameEn: 'Fascia Board 8" + 6"',         uom: 'm', uomEn: 'm',   costMaterial: 180,  costLabor: 80,  category: 'Roofing' },
  { code: 'ROF-INSUL',    name: 'แผ่นสะท้อนความร้อน (Foil) / ฉนวน PE', nameEn: 'Foil Insulation / PE',  uom: 'm2', uomEn: 'sq.m.',  costMaterial: 40,   costLabor: 15,  category: 'Roofing' },
  { code: 'ROF-BIRD',     name: 'แผ่น/หวีปิดกันนก', nameEn: 'Bird Guard/Comb',                  uom: 'm', uomEn: 'm',   costMaterial: 35,   costLabor: 15,  category: 'Roofing' },


  // --- Step 17 : Brickwork (ราคากลาง 2568) ---
  { code: 'BRK-CLAY',     name: 'อิฐมอญ 7×16×3.5 ซม. (144 ก้อน/ม²)', nameEn: 'Clay Brick 7×16×3.5cm',  uom: 'pcs', uomEn: 'pcs', costMaterial: 1.47, costLabor: 0,   category: 'Brickwork' },
  { code: 'BRK-CLAY-4R',  name: 'อิฐมอญ 4 รู 6.5×11×25 ซม.', nameEn: 'Clay Brick 4-hole',      uom: 'pcs', uomEn: 'pcs', costMaterial: 13,   costLabor: 0,   category: 'Brickwork' },
  { code: 'BRK-AAC',      name: 'อิฐมวลเบา AAC 7.5 ซม.', nameEn: 'AAC Block 7.5cm',            uom: 'm2', uomEn: 'sq.m.', costMaterial: 204,  costLabor: 80,  category: 'Brickwork' },
  { code: 'BRK-AAC-10',   name: 'อิฐมวลเบา AAC 10 ซม.', nameEn: 'AAC Block 10cm',              uom: 'm2', uomEn: 'sq.m.', costMaterial: 295,  costLabor: 85,  category: 'Brickwork' },
  { code: 'BRK-AAC-12',   name: 'อิฐมวลเบา AAC 12.5 ซม.', nameEn: 'AAC Block 12.5cm',          uom: 'm2', uomEn: 'sq.m.', costMaterial: 378,  costLabor: 90,  category: 'Brickwork' },
  { code: 'BRK-AAC-15',   name: 'อิฐมวลเบา AAC 15 ซม.', nameEn: 'AAC Block 15cm',              uom: 'm2', uomEn: 'sq.m.', costMaterial: 442,  costLabor: 95,  category: 'Brickwork' },
  { code: 'BRK-AAC-17',   name: 'อิฐมวลเบา AAC 17.5 ซม.', nameEn: 'AAC Block 17.5cm',          uom: 'm2', uomEn: 'sq.m.', costMaterial: 527,  costLabor: 100, category: 'Brickwork' },
  { code: 'BRK-AAC-20',   name: 'อิฐมวลเบา AAC 20 ซม.', nameEn: 'AAC Block 20cm',              uom: 'm2', uomEn: 'sq.m.', costMaterial: 595,  costLabor: 110, category: 'Brickwork' },
  { code: 'BRK-MORTAR',   name: 'ปูนก่อ', nameEn: 'Masonry Mortar',                             uom: 'm2', uomEn: 'sq.m.', costMaterial: 50,   costLabor: 80,  category: 'Brickwork' },
  { code: 'BRK-MORTAR-AAC', name: 'ปูนก่อสำเร็จรูปมวลเบา', nameEn: 'AAC Masonry Mortar',       uom: 'kg', uomEn: 'kg',   costMaterial: 2.43, costLabor: 0,   category: 'Brickwork' },
  { code: 'BRK-LINTEL',   name: 'เสาเอ็น-ทับหลัง (รวมคอนกรีต+เหล็ก)', nameEn: 'Lintel/Edge beam',  uom: 'm', uomEn: 'm',  costMaterial: 250,  costLabor: 150, category: 'Brickwork' },

  // --- Step 18 : Plastering ---
  { code: 'PLS-EXT',      name: 'ฉาบผนังภายนอก', nameEn: 'Exterior Plastering',                      uom: 'm2', uomEn: 'sq.m.', costMaterial: 50,   costLabor: 150, category: 'Plastering' },
  { code: 'PLS-INT',      name: 'ฉาบผนังภายใน', nameEn: 'Interior Plastering',                       uom: 'm2', uomEn: 'sq.m.', costMaterial: 45,   costLabor: 132, category: 'Plastering' },
  { code: 'PLS-SKIM',     name: 'สกิมโค้ท (Skim Coat)', nameEn: 'Skim Coat',               uom: 'm2', uomEn: 'sq.m.', costMaterial: 30,   costLabor: 28.57, category: 'Plastering' },

  // --- Step 19 : Ceiling (ราคากลาง 2568) ---
  // ยิปซั่มบอร์ด
  { code: 'CLG-PANEL',         name: 'แผ่นฝ้ายิปซั่ม 9 มม.', nameEn: 'Gypsum Board 9mm',                       uom: 'm2', uomEn: 'sq.m.', costMaterial: 90,   costLabor: 80,  category: 'Ceiling' },
  { code: 'CLG-PANEL-MOIST',   name: 'แผ่นฝ้ายิปซั่มกันชื้น 9 มม.', nameEn: 'Moisture-Resist Gypsum 9mm',    uom: 'm2', uomEn: 'sq.m.', costMaterial: 120,  costLabor: 80,  category: 'Ceiling' },
  { code: 'CLG-PANEL-FIRE',    name: 'แผ่นฝ้ายิปซั่มกันไฟ 12 มม.', nameEn: 'Fire-Resist Gypsum 12mm',         uom: 'm2', uomEn: 'sq.m.', costMaterial: 165,  costLabor: 90,  category: 'Ceiling' },
  // ไฟเบอร์ซีเมนต์
  { code: 'CLG-FIBER',         name: 'แผ่นฝ้าไฟเบอร์ซีเมนต์ 4 มม.', nameEn: 'Fiber Cement Board 4mm',          uom: 'm2', uomEn: 'sq.m.', costMaterial: 95,   costLabor: 80,  category: 'Ceiling' },
  { code: 'CLG-FIBER-6',       name: 'แผ่นฝ้าไฟเบอร์ซีเมนต์ 6 มม.', nameEn: 'Fiber Cement Board 6mm',          uom: 'm2', uomEn: 'sq.m.', costMaterial: 115,  costLabor: 80,  category: 'Ceiling' },
  { code: 'CLG-CALCIUM',       name: 'แผ่นฝ้าแคลเซียมซิลิเกต 6 มม.', nameEn: 'Calcium Silicate Board 6mm',    uom: 'm2', uomEn: 'sq.m.', costMaterial: 140,  costLabor: 85,  category: 'Ceiling' },
  // โครงคร่าว
  { code: 'CLG-FRAME',    name: 'โครงคร่าว C-line', nameEn: 'Concealed C-line Frame',                   uom: 'm', uomEn: 'm',  costMaterial: 25,   costLabor: 0,   category: 'Ceiling' },
  { code: 'CLG-CORNICE',  name: 'บัวฝ้าเพดาน', nameEn: 'Ceiling Cornice',                        uom: 'm', uomEn: 'm',  costMaterial: 40,   costLabor: 20,  category: 'Ceiling' },

  // --- Step 20 : Floor Tiling ---
  { code: 'FLT-TILE',     name: 'กระเบื้องพื้น (รวมปู)', nameEn: 'Floor Tile',               uom: 'm2', uomEn: 'sq.m.', costMaterial: 300,  costLabor: 200, category: 'Floor Tile' },
  { code: 'FLT-ADHESIVE', name: 'กาวซีเมนต์ (20kg)', nameEn: 'Tile Adhesive (20kg)',                  uom: 'pcs', uomEn: 'bag', costMaterial: 180, costLabor: 0,   category: 'Floor Tile' },
  { code: 'FLT-SKIRTING', name: 'บัวพื้น', nameEn: 'Skirting Board',                            uom: 'm', uomEn: 'm',  costMaterial: 60,   costLabor: 30,  category: 'Floor Tile' },

  // --- Step 21 : Bathroom Tiling ---
  { code: 'BTL-FLOOR',    name: 'กระเบื้องพื้นห้องน้ำ', nameEn: 'Bathroom Floor Tile',               uom: 'm2', uomEn: 'sq.m.', costMaterial: 350,  costLabor: 250, category: 'Bath Tile' },
  { code: 'BTL-WALL',     name: 'กระเบื้องผนังห้องน้ำ', nameEn: 'Bathroom Wall Tile',               uom: 'm2', uomEn: 'sq.m.', costMaterial: 350,  costLabor: 250, category: 'Bath Tile' },
  { code: 'BTL-WP',       name: 'น้ำยากันซึม (2 รอบ)', nameEn: 'Waterproofing Paint',               uom: 'm2', uomEn: 'sq.m.', costMaterial: 75,   costLabor: 30,  category: 'Bath Tile' },

  // --- Step 22 : Exterior Finish ---
  { code: 'EXF-MAT',      name: 'วัสดุตกแต่งผนังภายนอก', nameEn: 'Exterior Wall Finish',             uom: 'm2', uomEn: 'sq.m.', costMaterial: 200,  costLabor: 100, category: 'Exterior Finish' },

  // --- Step 23 : Primer ---
  { code: 'PRM-INT',      name: 'สีรองพื้นภายใน (แกลลอน)', nameEn: 'Interior Primer Paint',            uom: 'pcs', uomEn: 'gal', costMaterial: 650, costLabor: 0,   category: 'Primer' },
  { code: 'PRM-EXT',      name: 'สีรองพื้นภายนอก (แกลลอน)', nameEn: 'Exterior Primer Paint',           uom: 'pcs', uomEn: 'gal', costMaterial: 750, costLabor: 0,   category: 'Primer' },
  { code: 'PRM-SAND',     name: 'กระดาษทราย #120-180', nameEn: 'Sandpaper #120-180',               uom: 'แผ่น', uomEn: 'sheet', costMaterial: 8,   costLabor: 0,   category: 'Primer' },
  { code: 'PRM-CRACK',    name: 'อะคริลิกอุดรอยแตก 300ml', nameEn: 'Acrylic Sealant 300ml',           uom: 'pcs', uomEn: 'pcs', costMaterial: 65,  costLabor: 0,   category: 'Primer' },
  { code: 'PRM-ROLLER',   name: 'ลูกกลิ้ง+ถาดรอง+ด้าม', nameEn: 'Paint Roller Kit',              uom: 'set', uomEn: 'set', costMaterial: 120, costLabor: 0,   category: 'Primer' },
  { code: 'PRM-BRUSH',    name: 'พู่กันตัดเส้นขอบ 2-3"', nameEn: 'Paint Brush 2-3"',              uom: 'pcs', uomEn: 'pcs', costMaterial: 35,  costLabor: 0,   category: 'Primer' },

  // --- Step 24 : Doors & Windows (ราคากลาง 2568) ---
  { code: 'ALU-DOOR',     name: 'ประตูอลูมิเนียม (ชุด)', nameEn: 'Aluminium Door (Set)',              uom: 'set', uomEn: 'set', costMaterial: 5500, costLabor: 800, category: 'Aluminium' },
  { code: 'ALU-DOOR-A',   name: 'พื้นที่ประตูอลูมิเนียม', nameEn: 'Alu Door Area',              uom: 'm2', uomEn: 'sq.m.',  costMaterial: 0,    costLabor: 0,   category: 'Aluminium' },
  { code: 'ALU-SLIDE',    name: 'ประตูบานเลื่อนอลูมิเนียม (ชุด)', nameEn: 'Alu Sliding Door',     uom: 'set', uomEn: 'set', costMaterial: 8500, costLabor: 1200, category: 'Aluminium' },
  { code: 'ALU-WINDOW',   name: 'หน้าต่างอลูมิเนียม (ชุด)', nameEn: 'Aluminium Window (Set)',           uom: 'set', uomEn: 'set', costMaterial: 3500, costLabor: 500, category: 'Aluminium' },
  { code: 'ALU-WIN-A',    name: 'พื้นที่หน้าต่างอลูมิเนียม', nameEn: 'Alu Window Area',           uom: 'm2', uomEn: 'sq.m.',  costMaterial: 0,    costLabor: 0,   category: 'Aluminium' },
  { code: 'ALU-SEAL',     name: 'ซีลยาแนว PU Sealant', nameEn: 'PU Sealant',              uom: 'm', uomEn: 'm',   costMaterial: 35,   costLabor: 15,  category: 'Aluminium' },
  // UPVC (ราคากลาง 2568)
  { code: 'UPVC-WINDOW',  name: 'หน้าต่าง UPVC บานเลื่อน+มุ้ง', nameEn: 'UPVC Sliding Window+Screen', uom: 'set', uomEn: 'set', costMaterial: 1785, costLabor: 500, category: 'Aluminium' },
  { code: 'UPVC-DOOR-INT', name: 'ประตู UPVC ภายใน 70×200 ซม.', nameEn: 'UPVC Interior Door 70×200',  uom: 'set', uomEn: 'set', costMaterial: 1299, costLabor: 500, category: 'Aluminium' },
  { code: 'UPVC-DOOR-EXT', name: 'ประตู UPVC ภายนอก 80×200 ซม.', nameEn: 'UPVC Exterior Door 80×200', uom: 'set', uomEn: 'set', costMaterial: 2622, costLabor: 600, category: 'Aluminium' },

  // --- Step 25 : Paint Coat 1 ---
  { code: 'PNT-INT',      name: 'สีทับหน้าภายใน (แกลลอน)', nameEn: 'Interior Top Coat',           uom: 'pcs', uomEn: 'gal', costMaterial: 1200, costLabor: 105, category: 'Paint' },
  { code: 'PNT-ACCENT',   name: 'สี Accent สีเข้ม (แกลลอน)', nameEn: 'Dark Accent Paint',         uom: 'pcs', uomEn: 'gal', costMaterial: 1350, costLabor: 115, category: 'Paint' },
  { code: 'PNT-EXT',      name: 'สีทับหน้าภายนอก (แกลลอน)', nameEn: 'Exterior Top Coat',          uom: 'pcs', uomEn: 'gal', costMaterial: 1500, costLabor: 118, category: 'Paint' },
  { code: 'PNT-WOOD',     name: 'สีย้อมไม้/แลกเกอร์ (แกลลอน)', nameEn: 'Wood Stain / Lacquer',       uom: 'pcs', uomEn: 'gal', costMaterial: 800,  costLabor: 80,  category: 'Paint' },
  { code: 'PNT-ROLLER',   name: 'ลูกกลิ้งทาสี + ถาดรอง', nameEn: 'Paint Roller Kit',             uom: 'set', uomEn: 'set', costMaterial: 150,  costLabor: 0,   category: 'Paint' },
  { code: 'PNT-MASK',     name: 'เทปกาว Masking Tape', nameEn: 'Masking Tape',              uom: 'pcs', uomEn: 'roll', costMaterial: 25,   costLabor: 0,   category: 'Paint' },
  { code: 'PNT-DROP',     name: 'ผ้าคลุมพื้นกันสีหยด', nameEn: 'Drop Cloth',               uom: 'pcs', uomEn: 'sheet', costMaterial: 45,   costLabor: 0,   category: 'Paint' },

  // --- Step 26 : Electrical ---
  { code: 'ELC-CONDUIT',  name: 'ท่อร้อยสายไฟ PVC', nameEn: 'PVC Conduit Pipe',                  uom: 'm', uomEn: 'm',   costMaterial: 15,    costLabor: 20,    category: 'Electrical' },
  { code: 'ELC-MAIN',     name: 'สายเมน THW', nameEn: 'Main Wire THW',                        uom: 'm', uomEn: 'm',   costMaterial: 45,    costLabor: 12,    category: 'Electrical' },
  { code: 'ELC-BRANCH',   name: 'สายย่อย VAF 2×2.5', nameEn: 'Branch Wire VAF 2x2.5',                 uom: 'm', uomEn: 'm',   costMaterial: 18,    costLabor: 8,     category: 'Electrical' },
  { code: 'ELC-AC',       name: 'สาย VCT แอร์ dedicated', nameEn: 'Dedicated AC Wire VCT',            uom: 'm', uomEn: 'm',   costMaterial: 28,    costLabor: 12,    category: 'Electrical' },
  { code: 'ELC-SOCKET',   name: 'สวิตช์/เต้ารับ', nameEn: 'Switch / Socket',                     uom: 'pcs', uomEn: 'pcs', costMaterial: 120,   costLabor: 80,    category: 'Electrical' },
  { code: 'ELC-LIGHT',    name: 'โคมไฟ', nameEn: 'Lighting Fixture',                              uom: 'pcs', uomEn: 'pcs', costMaterial: 500,   costLabor: 100,   category: 'Electrical' },
  { code: 'ELC-CU',       name: 'ตู้ Consumer Unit + เบรกเกอร์', nameEn: 'Consumer Unit & Breakers',      uom: 'set', uomEn: 'set', costMaterial: 3500,  costLabor: 1500,  category: 'Electrical' },
  { code: 'ELC-GROUND',   name: 'สายดิน Ground Rod', nameEn: 'Ground Rod',                 uom: 'pcs', uomEn: 'pcs', costMaterial: 350,   costLabor: 200,   category: 'Electrical' },
  { code: 'ELC-OUT',      name: 'เต้ารับกันน้ำ IP55', nameEn: 'Waterproof Socket IP55',                 uom: 'pcs', uomEn: 'pcs', costMaterial: 250,   costLabor: 120,   category: 'Electrical' },
  { code: 'ELC-EV',       name: 'EV Charger Wall Box', nameEn: 'EV Charger Wall Box',               uom: 'set', uomEn: 'set', costMaterial: 25000, costLabor: 3000,  category: 'Electrical' },

  // --- Step 27 : Sanitary Interior ---
  { code: 'SIP-SUPPLY',   name: 'ท่อน้ำดี PVC Ø1/2"-3/4"', nameEn: 'PVC Water Supply Pipe',           uom: 'm', uomEn: 'm',   costMaterial: 25,    costLabor: 30,   category: 'Sanitary Int' },
  { code: 'SIP-DRAIN',    name: 'ท่อน้ำทิ้ง PVC Ø2"-4"', nameEn: 'PVC Drainage Pipe',             uom: 'm', uomEn: 'm',   costMaterial: 30,    costLabor: 30,   category: 'Sanitary Int' },
  { code: 'SIP-HOT',      name: 'ท่อน้ำร้อน PPR', nameEn: 'PPR Hot Water Pipe',                    uom: 'm', uomEn: 'm',   costMaterial: 45,    costLabor: 40,   category: 'Sanitary Int' },
  { code: 'SIP-VALVE',    name: 'วาล์ว/ข้อต่อ (Stop + Gate)', nameEn: 'Valve & Fittings',        uom: 'pcs', uomEn: 'pcs', costMaterial: 85,    costLabor: 30,   category: 'Sanitary Int' },
  { code: 'SIP-FD',       name: 'Floor Drain สแตนเลส', nameEn: 'Stainless Floor Drain',               uom: 'set', uomEn: 'set', costMaterial: 150,   costLabor: 80,   category: 'Sanitary Int' },
  { code: 'SIP-PTRAP',    name: 'P-Trap ดักกลิ่น', nameEn: 'P-Trap Odor Guard',                   uom: 'pcs', uomEn: 'pcs', costMaterial: 65,    costLabor: 30,   category: 'Sanitary Int' },
  { code: 'SIP-CO',       name: 'Cleanout Box', nameEn: 'Cleanout Box',                      uom: 'pcs', uomEn: 'pcs', costMaterial: 120,   costLabor: 60,   category: 'Sanitary Int' },

  // --- Step 28 : Sanitary Exterior ---
  { code: 'SEP-SUPPLY',   name: 'ท่อเมนประปา HDPE/PVC', nameEn: 'Main Supply HDPE/PVC',              uom: 'm', uomEn: 'm',   costMaterial: 35,    costLabor: 25,   category: 'Sanitary Ext' },
  { code: 'SEP-DRAIN',    name: 'ท่อระบายน้ำ PVC Ø4"-6"', nameEn: 'Main Drain PVC',            uom: 'm', uomEn: 'm',   costMaterial: 40,    costLabor: 30,   category: 'Sanitary Ext' },
  { code: 'SEP-CHAMBER',  name: 'บ่อพักน้ำทิ้ง (ก่อ+ฝา)', nameEn: 'Manhole Chamber',            uom: 'บ่อ', uomEn: 'pc',  costMaterial: 800,   costLabor: 500,  category: 'Sanitary Ext' },
  { code: 'SEP-SEPTIC',   name: 'ถังบำบัดสำเร็จรูป', nameEn: 'Septic Tank',                  uom: 'set', uomEn: 'set', costMaterial: 4500,  costLabor: 1500, category: 'Sanitary Ext' },
  { code: 'SEP-GREASE',   name: 'ถังดักไขมัน', nameEn: 'Grease Trap',                        uom: 'set', uomEn: 'set', costMaterial: 1500,  costLabor: 500,  category: 'Sanitary Ext' },
  { code: 'SEP-METER',    name: 'มิเตอร์น้ำ + ขอติดตั้ง', nameEn: 'Water Meter Install',             uom: 'set', uomEn: 'set', costMaterial: 1200,  costLabor: 500,  category: 'Sanitary Ext' },
  { code: 'SEP-RAIN',     name: 'รางน้ำฝน PVC + ท่อลง', nameEn: 'PVC Rain Gutter & Pipe',              uom: 'm', uomEn: 'm',   costMaterial: 80,    costLabor: 50,   category: 'Sanitary Ext' },
  { code: 'SEP-PUMP',     name: 'ถังพักน้ำ + ปั๊มอัตโนมัติ', nameEn: 'Water Tank & Auto Pump',          uom: 'set', uomEn: 'set', costMaterial: 8000,  costLabor: 2000, category: 'Sanitary Ext' },

  // --- Step 29 : Miscellaneous ---
  { code: 'MSC-CURTAIN',  name: 'ราวม่านรางเลื่อน', nameEn: 'Curtain Rail',                   uom: 'm', uomEn: 'm',   costMaterial: 120,   costLabor: 40,   category: 'Misc' },
  { code: 'MSC-BLIND',    name: 'มู่ลี่/ม่านม้วน', nameEn: 'Roller Blind',                    uom: 'set', uomEn: 'set', costMaterial: 800,   costLabor: 150,  category: 'Misc' },
  { code: 'MSC-TOWEL',    name: 'ราวแขวนผ้า สแตนเลส', nameEn: 'Towel Rack Stainless',                uom: 'pcs', uomEn: 'pcs', costMaterial: 250,   costLabor: 50,   category: 'Misc' },
  { code: 'MSC-SOAP',     name: 'ที่กดสบู่เหลว', nameEn: 'Liquid Soap Dispenser',                      uom: 'pcs', uomEn: 'pcs', costMaterial: 180,   costLabor: 30,   category: 'Misc' },
  { code: 'MSC-PAPER',    name: 'ที่แขวนกระดาษทิชชู', nameEn: 'Toilet Paper Holder',                 uom: 'pcs', uomEn: 'pcs', costMaterial: 150,   costLabor: 30,   category: 'Misc' },
  { code: 'MSC-MIRROR',   name: 'กระจกเงา + กรอบ', nameEn: 'Framed Mirror',                   uom: 'set', uomEn: 'set', costMaterial: 600,   costLabor: 100,  category: 'Misc' },
  { code: 'MSC-STOPPER',  name: 'กันกระแทกประตู', nameEn: 'Door Stopper',                     uom: 'pcs', uomEn: 'pcs', costMaterial: 45,    costLabor: 15,   category: 'Misc' },
  { code: 'MSC-CLOSER',   name: 'โช้คอัพประตู (Door Closer)', nameEn: 'Door Closer',          uom: 'pcs', uomEn: 'pcs', costMaterial: 850,   costLabor: 200,  category: 'Misc' },
  { code: 'MSC-PEEP',     name: 'ตาแมว (Peephole)', nameEn: 'Door Peephole',                   uom: 'pcs', uomEn: 'pcs', costMaterial: 120,   costLabor: 30,   category: 'Misc' },
  { code: 'MSC-HNUM',     name: 'เลขที่บ้าน สแตนเลส', nameEn: 'Stainless House Number',                uom: 'set', uomEn: 'set', costMaterial: 250,   costLabor: 50,   category: 'Misc' },
  { code: 'MSC-SHELF',    name: 'ชั้นวาง/ชั้นรองเท้า', nameEn: 'Built-in Shelf/Shoe Rack',                uom: 'set', uomEn: 'set', costMaterial: 1200,  costLabor: 300,  category: 'Misc' },
  { code: 'MSC-CABINET',  name: 'ตู้ Built-in', nameEn: 'Built-in Cabinet',                       uom: 'pcs', uomEn: 'pc', costMaterial: 8000,  costLabor: 2000, category: 'Misc' },
  { code: 'MSC-MAIL',     name: 'ตู้จดหมาย สแตนเลส', nameEn: 'Stainless Mailbox',                  uom: 'set', uomEn: 'set', costMaterial: 350,   costLabor: 50,   category: 'Misc' },
  { code: 'MSC-CLOTH',    name: 'ราวตากผ้า สแตนเลส', nameEn: 'Clothes Rack',                  uom: 'm', uomEn: 'm',   costMaterial: 200,   costLabor: 50,   category: 'Misc' },

  // --- Step 30 : Sanitary Fixtures ---
  { code: 'SFX-TOILET',   name: 'ชักโครก + ข้อต่อ + สายน้ำ', nameEn: 'Toilet Bowl Set',          uom: 'set', uomEn: 'set', costMaterial: 3500,  costLabor: 500,  category: 'Sanitary Fix' },
  { code: 'SFX-BASIN',    name: 'อ่างล้างหน้า + ก๊อก + สะดือ', nameEn: 'Washbasin Set',        uom: 'set', uomEn: 'set', costMaterial: 2200,  costLabor: 400,  category: 'Sanitary Fix' },
  { code: 'SFX-SHOWER',   name: 'ชุดฝักบัว + ราว + สาย', nameEn: 'Shower Head Set',             uom: 'set', uomEn: 'set', costMaterial: 1500,  costLabor: 300,  category: 'Sanitary Fix' },
  { code: 'SFX-BIDET',    name: 'สายชำระ (Bidet Spray)', nameEn: 'Bidet Spray',              uom: 'set', uomEn: 'set', costMaterial: 350,   costLabor: 80,   category: 'Sanitary Fix' },
  { code: 'SFX-FAUCET',   name: 'ก๊อกน้ำ (ซิงค์/สนาม)', nameEn: 'Sink/Garden Faucet',               uom: 'pcs', uomEn: 'pcs', costMaterial: 450,   costLabor: 80,   category: 'Sanitary Fix' },
  { code: 'SFX-KSINK',    name: 'ซิงค์ล้างจาน + สะดือ', nameEn: 'Kitchen Sink',               uom: 'set', uomEn: 'set', costMaterial: 2800,  costLabor: 500,  category: 'Sanitary Fix' },
  { code: 'SFX-KFAUCET',  name: 'ก๊อกน้ำครัว (คอยาว)', nameEn: 'Kitchen High Faucet',                uom: 'pcs', uomEn: 'pcs', costMaterial: 650,   costLabor: 80,   category: 'Sanitary Fix' },
  { code: 'SFX-HEATER',   name: 'เครื่องทำน้ำอุ่น + ติดตั้ง', nameEn: 'Water Heater',           uom: 'set', uomEn: 'set', costMaterial: 3500,  costLabor: 800,  category: 'Sanitary Fix' },
  { code: 'SFX-TUB',      name: 'อ่างอาบน้ำ + ก๊อกผสม', nameEn: 'Bathtub Set',              uom: 'set', uomEn: 'set', costMaterial: 8000,  costLabor: 1500, category: 'Sanitary Fix' },
  { code: 'SFX-URINAL',   name: 'โถปัสสาวะชาย + Flush Valve', nameEn: 'Men Urinal Set',        uom: 'set', uomEn: 'set', costMaterial: 2500,  costLabor: 400,  category: 'Sanitary Fix' },
  { code: 'SFX-LSINK',    name: 'อ่างซักล้าง + ก๊อก', nameEn: 'Laundry Sink Set',                 uom: 'set', uomEn: 'set', costMaterial: 1800,  costLabor: 300,  category: 'Sanitary Fix' },
  { code: 'SFX-SILI',     name: 'ซิลิโคนยาแนวสุขภัณฑ์', nameEn: 'Sanitary Silicone',               uom: 'pcs', uomEn: 'pcs', costMaterial: 85,    costLabor: 0,    category: 'Sanitary Fix' },
  { code: 'SFX-PTFE',     name: 'เทปพันเกลียว PTFE', nameEn: 'PTFE Thread Tape',                  uom: 'pcs', uomEn: 'pcs', costMaterial: 15,    costLabor: 0,    category: 'Sanitary Fix' },

  // --- Step 31 : Doors (ราคากลาง 2568) ---
  { code: 'WDR-DOOR',     name: 'บานประตูไม้เนื้อแข็ง + วงกบ', nameEn: 'Hardwood Door & Frame',       uom: 'set', uomEn: 'set', costMaterial: 3800,  costLabor: 600,  category: 'Wood Door' },
  { code: 'WDR-DOOR-TEAK', name: 'บานประตูไม้สัก + วงกบ 80×200', nameEn: 'Teak Door & Frame 80×200', uom: 'set', uomEn: 'set', costMaterial: 13000, costLabor: 800, category: 'Wood Door' },
  { code: 'WDR-DOOR-HDF', name: 'บานประตู HDF ภายใน 80×200', nameEn: 'HDF Interior Door 80×200',   uom: 'set', uomEn: 'set', costMaterial: 522,   costLabor: 400,  category: 'Wood Door' },
  { code: 'WDR-FRAME',    name: 'วงกบประตูไม้แคมปัส 80×200', nameEn: 'Campas Wood Frame 80×200',  uom: 'วง', uomEn: 'set', costMaterial: 813,  costLabor: 200,  category: 'Wood Door' },
  { code: 'WDR-WINDOW',   name: 'หน้าต่างไม้ + วงกบ', nameEn: 'Wood Window & Frame',                uom: 'set', uomEn: 'set', costMaterial: 2800,  costLabor: 400,  category: 'Wood Door' },
  { code: 'WDR-HARDWARE', name: 'ชุดมือจับ Mortise Lock สแตนเลส', nameEn: 'Mortise Lock Set SS', uom: 'set', uomEn: 'set', costMaterial: 1082, costLabor: 50, category: 'Wood Door' },
  { code: 'WDR-HINGE',    name: 'บานพับลูกปืน 4×3"', nameEn: 'Ball Bearing Hinge 4×3"',      uom: 'ชุด', uomEn: 'set', costMaterial: 279,  costLabor: 30,   category: 'Wood Door' },
  { code: 'WDR-SEAL',     name: 'ซิลิโคน/PU ยาแนวรอบวงกบ', nameEn: 'PU/Silicone Frame Sealant',          uom: 'pcs', uomEn: 'pcs', costMaterial: 85,    costLabor: 20,   category: 'Wood Door' },
  { code: 'WDR-FINISH',   name: 'สีย้อมไม้/แลกเกอร์ (แกลลอน)', nameEn: 'Wood Stain Finish',       uom: 'pcs', uomEn: 'gal', costMaterial: 800,   costLabor: 80,   category: 'Wood Door' },

  // --- Step 32 : Final Paint ---
  { code: 'FPT-INT',      name: 'สีทับหน้าภายใน รอบ 2 (แกลลอน)', nameEn: 'Interior Top Coat (Round 2)',     uom: 'pcs', uomEn: 'gal', costMaterial: 1200,  costLabor: 105,  category: 'Final Paint' },
  { code: 'FPT-EXT',      name: 'สีทับหน้าภายนอก รอบ 2 (แกลลอน)', nameEn: 'Exterior Top Coat (Round 2)',    uom: 'pcs', uomEn: 'gal', costMaterial: 1500,  costLabor: 118,  category: 'Final Paint' },
  { code: 'FPT-WOOD',     name: 'สีย้อมไม้ รอบ 2 (แกลลอน)', nameEn: 'Wood Stain (Round 2)',           uom: 'pcs', uomEn: 'gal', costMaterial: 800,   costLabor: 80,   category: 'Final Paint' },
  { code: 'FPT-TOUCH',    name: 'แต้มซ่อมจุดบกพร่อง (m²)', nameEn: 'Touch-up Paint',           uom: 'm2', uomEn: 'sq.m.',  costMaterial: 15,    costLabor: 30,   category: 'Final Paint' },
  { code: 'FPT-ROLLER',   name: 'ลูกกลิ้ง (เปลี่ยนผ้ารอบ 2)', nameEn: 'Roller Cover Change',         uom: 'set', uomEn: 'set', costMaterial: 80,    costLabor: 0,    category: 'Final Paint' },
  { code: 'FPT-BRUSH',    name: 'พู่กันตัดเส้น + แปรงแต้ม', nameEn: 'Touch-up Brush',           uom: 'set', uomEn: 'set', costMaterial: 60,    costLabor: 0,    category: 'Final Paint' },

  // --- Step 33 : Defect Inspection ---
  { code: 'DEF-ITEM',     name: 'งานซ่อม Defect (รายการ)', nameEn: 'Defect Repair Work',            uom: 'pcs', uomEn: 'item', costMaterial: 200,   costLabor: 300,  category: 'Defect' },
  { code: 'DEF-CLEAN',    name: 'Big Cleaning', nameEn: 'Big Cleaning',                       uom: 'm2', uomEn: 'sq.m.',  costMaterial: 5,     costLabor: 10,   category: 'Defect' },
  { code: 'DEF-TOUCH',    name: 'แต้มสี/ทาซ่อม', nameEn: 'Touch-up Repair',                     uom: 'm2', uomEn: 'sq.m.',  costMaterial: 15,    costLabor: 30,   category: 'Defect' },
  { code: 'DEF-CAULK',    name: 'ฉาบอุดรอยร้าว', nameEn: 'Crack Caulking',                     uom: 'm', uomEn: 'm',   costMaterial: 20,    costLabor: 40,   category: 'Defect' },
  { code: 'DEF-SUPPLY',   name: 'วัสดุทำความสะอาด (ชุด)', nameEn: 'Cleaning Supplies',             uom: 'set', uomEn: 'set', costMaterial: 200,   costLabor: 0,    category: 'Defect' },
  { code: 'DEF-STICKER',  name: 'สติ๊กเกอร์ Defect (แดง/เขียว)', nameEn: 'Defect Mark Stickers',     uom: 'set', uomEn: 'set', costMaterial: 50,    costLabor: 0,    category: 'Defect' },

  // --- Step 34 : Handover ---
  { code: 'HDV-DOC',      name: 'เอกสาร As-built / คู่มือบ้าน', nameEn: 'As-built Docs/Manual',      uom: 'set', uomEn: 'set', costMaterial: 500,   costLabor: 0,    category: 'Handover' },
  { code: 'HDV-KEY',      name: 'ชุดกุญแจ (ประตูหน้า/หลัง/ห้อง)', nameEn: 'Key Handoff Set',     uom: 'set', uomEn: 'set', costMaterial: 150,   costLabor: 0,    category: 'Handover' },
  { code: 'HDV-WARR',     name: 'ใบรับประกัน', nameEn: 'Warranty Certificates',                        uom: 'set', uomEn: 'set', costMaterial: 100,   costLabor: 0,    category: 'Handover' },
  { code: 'HDV-DWG',      name: 'แบบ As-built Drawing', nameEn: 'As-built Drawings',               uom: 'set', uomEn: 'set', costMaterial: 300,   costLabor: 0,    category: 'Handover' },
  { code: 'HDV-MANUAL',   name: 'คู่มืออุปกรณ์', nameEn: 'Equipment Manuals',                      uom: 'set', uomEn: 'set', costMaterial: 0,     costLabor: 0,    category: 'Handover' },
  { code: 'HDV-PHOTO',    name: 'ภาพถ่ายบันทึก (USB/Cloud)', nameEn: 'Photo Records',          uom: 'set', uomEn: 'set', costMaterial: 50,    costLabor: 0,    category: 'Handover' },
  { code: 'HDV-TRAIN',    name: 'สอนการใช้งาน 1 วัน', nameEn: 'Usage Training',                uom: 'วัน', uomEn: 'day',  costMaterial: 0,     costLabor: 1500, category: 'Handover' },
];

export const STEEL_WEIGHTS: Record<string, number> = {
    'RB6': Math.pow(6, 2) / 162,
    'RB9': Math.pow(9, 2) / 162,
    'DB12': Math.pow(12, 2) / 162,
    'DB16': Math.pow(16, 2) / 162,
    'DB20': Math.pow(20, 2) / 162,
};

/** Concrete strength grade — used by structural steps (6–13) */
export type ConcreteGrade = '180' | '210' | '240' | '280' | '320';

/**
 * Material cost per m³ for each concrete grade (Ready-mix price).
 * Labor cost stays the same regardless of grade.
 */
export const CONCRETE_GRADE_COST: Record<ConcreteGrade, number> = {
    '180': 2437,   // ราคากลาง CPAC 2568
    '210': 2422,   // ราคากลาง CPAC 2568
    '240': 2458,   // ราคากลาง CPAC 2568
    '280': 2495,   // ราคากลาง CPAC 2568
    '320': 2567,   // ราคากลาง CPAC 2568
};
