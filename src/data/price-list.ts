import { type PriceItem } from "@/types";

export const INITIAL_PRICE_LIST: PriceItem[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 0 : Land Survey & Benchmark
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'SRV-CREW',     name: 'ค่าแรงสำรวจ (ชุด 2 คน)',            uom: 'คน-วัน', costMaterial: 0,    costLabor: 800,  category: 'Land Survey' },
  { code: 'SRV-EQUIP',    name: 'ค่าเช่าอุปกรณ์สำรวจ',              uom: 'วัน',    costMaterial: 1500, costLabor: 0,    category: 'Land Survey' },
  { code: 'SRV-BM',       name: 'หมุด BM คอนกรีต (ฝังเหล็ก)',       uom: 'จุด',    costMaterial: 350,  costLabor: 200,  category: 'Land Survey' },
  { code: 'SRV-MARKER',   name: 'ตรวจ/ปักหมุดเขตที่ดิน',            uom: 'จุด',    costMaterial: 50,   costLabor: 100,  category: 'Land Survey' },
  { code: 'SRV-TOPO',     name: 'Topo Survey (สำรวจระดับดิน)',       uom: 'm2',    costMaterial: 0,    costLabor: 3,    category: 'Land Survey' },
  { code: 'SRV-METER',    name: 'ค่าขอมิเตอร์ชั่วคราว (ไฟ+น้ำ)',    uom: 'ชุด',    costMaterial: 3500, costLabor: 0,    category: 'Land Survey' },
  { code: 'SRV-PERMIT',   name: 'ค่าธรรมเนียมขออนุญาต',             uom: 'ชุด',    costMaterial: 2000, costLabor: 0,    category: 'Land Survey' },
  { code: 'SRV-PHOTO',    name: 'ถ่ายภาพสภาพที่ดินก่อนเริ่มงาน',     uom: 'ชุด',    costMaterial: 500,  costLabor: 0,    category: 'Land Survey' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 1 : Earthwork & Compaction
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'SITE-CLEAR',     name: 'แผ้วถาง/ปรับระดับพื้นที่เตรียมงาน',  uom: 'm2',  costMaterial: 0,    costLabor: 15,   category: 'Earthwork' },
  { code: 'SITE-DEMO',      name: 'รื้อถอนและขนเศษวัสดุทิ้ง',        uom: 'เที่ยว', costMaterial: 0,    costLabor: 1500, category: 'Earthwork' },
  { code: 'FILL-SITE',      name: 'ดินถม + บดอัดบริเวณไซต์ (ทั่วไป)', uom: 'm3',  costMaterial: 250,  costLabor: 80,   category: 'Earthwork' },
  { code: 'FILL-SELECTED',  name: 'ดินลูกรัง + บดอัด',              uom: 'm3',  costMaterial: 300,  costLabor: 80,   category: 'Earthwork' },
  { code: 'FILL-SOFT',      name: 'ดินอ่อน + บดอัด',               uom: 'm3',  costMaterial: 150,  costLabor: 80,   category: 'Earthwork' },
  { code: 'FILL-SAND-FILL', name: 'ทรายถม + บดอัด',               uom: 'm3',  costMaterial: 350,  costLabor: 50,   category: 'Earthwork' },
  { code: 'FILL-ROCK',      name: 'หินคลุก + บดอัด',               uom: 'm3',  costMaterial: 450,  costLabor: 100,  category: 'Earthwork' },
  { code: 'FILL-TRUCK',   name: 'ค่าขนส่งดิน (รถ 6 ล้อ)',           uom: 'เที่ยว', costMaterial: 0,    costLabor: 1200, category: 'Earthwork' },
  { code: 'FILL-BACKHOE', name: 'ค่าเช่ารถแบ็คโฮเกลี่ย',            uom: 'ชม.',  costMaterial: 0,    costLabor: 1800, category: 'Earthwork' },
  { code: 'FILL-ROLLER',  name: 'ค่าเช่าเครื่องบดอัด (Roller)',      uom: 'ชม.',  costMaterial: 0,    costLabor: 1500, category: 'Earthwork' },
  { code: 'FILL-FDT',     name: 'ทดสอบ Field Density Test (FDT)',   uom: 'จุด',  costMaterial: 800,  costLabor: 200,  category: 'Earthwork' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 2 : Temporary Utilities
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'UTIL-CABLE',   name: 'สายเคเบิลไฟฟ้าชั่วคราว',           uom: 'm',   costMaterial: 45,   costLabor: 15,   category: 'Temp Utilities' },
  { code: 'UTIL-CONDUIT', name: 'ท่อร้อยสายไฟชั่วคราว',             uom: 'm',   costMaterial: 18,   costLabor: 10,   category: 'Temp Utilities' },
  { code: 'UTIL-PIPE',    name: 'ท่อน้ำชั่วคราว',                    uom: 'm',   costMaterial: 35,   costLabor: 15,   category: 'Temp Utilities' },
  { code: 'UTIL-FITTING', name: 'ข้อต่อ/ข้อโค้ง/วาล์วท่อน้ำ',       uom: 'ชุด',  costMaterial: 45,   costLabor: 20,   category: 'Temp Utilities' },
  { code: 'UTIL-VALVE',   name: 'ก๊อกน้ำ/วาล์วปิด-เปิด',            uom: 'ตัว',  costMaterial: 120,  costLabor: 50,   category: 'Temp Utilities' },
  { code: 'UTIL-DB',      name: 'ตู้ไฟชั่วคราว (Distribution Box)',  uom: 'ตู้',  costMaterial: 2500, costLabor: 500,  category: 'Temp Utilities' },
  { code: 'UTIL-GROUND',  name: 'แท่งกราวด์ (Ground Rod)',          uom: 'ต้น',  costMaterial: 350,  costLabor: 200,  category: 'Temp Utilities' },
  { code: 'UTIL-TANK',    name: 'ถังเก็บน้ำสำรอง',                   uom: 'ลิตร', costMaterial: 3,    costLabor: 0,    category: 'Temp Utilities' },
  { code: 'UTIL-METER',     name: 'ค่าขอมิเตอร์ชั่วคราว (ไฟ+น้ำ ทั่วไป)', uom: 'ชุด',  costMaterial: 3500, costLabor: 0,    category: 'Temp Utilities' },
  { code: 'UTIL-METER-E15', name: 'มิเตอร์ไฟชั่วคราว 1 เฟส 15(45)A',   uom: 'ชุด',  costMaterial: 5000, costLabor: 0,    category: 'Temp Utilities' },
  { code: 'SITE-FENCE-BLK', name: 'รั้วชั่วคราวบล็อกคอนกรีต',      uom: 'm2',  costMaterial: 180,  costLabor: 120, category: 'Site Setup' },
  { code: 'SITE-GATE',      name: 'ประตูทางเข้าชั่วคราว',    uom: 'ช่อง', costMaterial: 3500, costLabor: 500, category: 'Site Setup' },
  { code: 'SITE-ROAD',      name: 'ทางเข้ารถ (ลูกรัง)',        uom: 'm3',  costMaterial: 250,  costLabor: 100, category: 'Site Setup' },
  { code: 'SITE-SIGN',      name: 'ป้ายโครงการ',              uom: 'ป้าย', costMaterial: 2500, costLabor: 500, category: 'Site Setup' },
  { code: 'SITE-SAFETY',    name: 'ป้ายเตือนความปลอดภัย',       uom: 'ป้าย', costMaterial: 300,  costLabor: 50,  category: 'Site Setup' },
  { code: 'SITE-TOILET-R',  name: 'ค่าเช่าห้องน้ำเคลื่อนที่',     uom: 'เดือน', costMaterial: 2500, costLabor: 0,   category: 'Site Setup' },
  { code: 'SITE-MOBIL',     name: 'ค่าขนย้ายเครื่องจักรเข้าหน้างาน',uom: 'ครั้ง', costMaterial: 0, costLabor: 5000, category: 'Site Setup' },
  { code: 'SITE-DEMOB',     name: 'ค่าขนย้ายเครื่องจักรออก',      uom: 'ครั้ง', costMaterial: 0, costLabor: 5000, category: 'Site Setup' },
  { code: 'UTIL-METER-E30', name: 'มิเตอร์ไฟชั่วคราว 1 เฟส 30(100)A',  uom: 'ชุด',  costMaterial: 12000,costLabor: 0,    category: 'Temp Utilities' },
  { code: 'UTIL-METER-E3P', name: 'มิเตอร์ไฟชั่วคราว 3 เฟส 30(100)A',  uom: 'ชุด',  costMaterial: 25000,costLabor: 0,    category: 'Temp Utilities' },
  { code: 'UTIL-METER-W15', name: 'มิเตอร์น้ำชั่วคราว 1/2 นิ้ว',        uom: 'ชุด',  costMaterial: 1200, costLabor: 0,    category: 'Temp Utilities' },
  { code: 'UTIL-METER-W20', name: 'มิเตอร์น้ำชั่วคราว 3/4 นิ้ว',        uom: 'ชุด',  costMaterial: 2500, costLabor: 0,    category: 'Temp Utilities' },
  { code: 'UTIL-PERMIT',    name: 'ค่าธรรมเนียมขออนุญาตเขต',         uom: 'ชุด',  costMaterial: 2000, costLabor: 0,    category: 'Temp Utilities' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 3 : Site Preparation
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'SITE-FENCE-ZINC', name: 'รั้วชั่วคราวสังกะสีลูกฟูก',         uom: 'm2',  costMaterial: 120,  costLabor: 40,   category: 'Site Prep' },
  { code: 'SITE-FENCE-MESH', name: 'รั้วชั่วคราวตาข่ายเหล็กถัก',       uom: 'm2',  costMaterial: 150,  costLabor: 45,   category: 'Site Prep' },
  { code: 'SITE-FENCE-BLK',  name: 'รั้วบล็อกคอนกรีต',                uom: 'm2',  costMaterial: 250,  costLabor: 120,  category: 'Site Prep' },
  { code: 'SITE-GATE',    name: 'ประตูทางเข้าไซต์',                  uom: 'ช่อง', costMaterial: 1500, costLabor: 500,  category: 'Site Prep' },
  { code: 'SITE-CAMP',    name: 'ห้องพักคนงาน / สโตร์',             uom: 'm2',  costMaterial: 800,  costLabor: 200,  category: 'Site Prep' },
  { code: 'SITE-DRAIN',   name: 'รางระบายน้ำชั่วคราว',              uom: 'm',   costMaterial: 80,   costLabor: 30,   category: 'Site Prep' },
  { code: 'SITE-TOILET',  name: 'ห้องน้ำเคลื่อนที่ (ค่าเช่า/เดือน)',  uom: 'เดือน', costMaterial: 2500, costLabor: 0,    category: 'Site Prep' },
  { code: 'SITE-ROAD',    name: 'ทางเข้ารถลูกรังอัดแน่น',            uom: 'm3',  costMaterial: 350,  costLabor: 80,   category: 'Site Prep' },
  { code: 'SITE-SIGN',    name: 'ป้ายโครงการ',                       uom: 'ป้าย', costMaterial: 3000, costLabor: 500,  category: 'Site Prep' },
  { code: 'SITE-SAFETY',  name: 'ป้ายความปลอดภัย',                  uom: 'ป้าย', costMaterial: 250,  costLabor: 50,   category: 'Site Prep' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 4 : Site Layout
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'LAYOUT-STR',   name: 'เอ็นวางผัง',                        uom: 'm',   costMaterial: 8,    costLabor: 5,    category: 'Layout' },
  { code: 'LAYOUT-BOARD', name: 'ไม้แบบผัง (Profile Board)',         uom: 'm',   costMaterial: 25,   costLabor: 15,   category: 'Layout' },
  { code: 'LAYOUT-STK',   name: 'ไม้หมุดปักศูนย์เสา',                uom: 'อัน',  costMaterial: 15,   costLabor: 5,    category: 'Layout' },
  { code: 'LAYOUT-NAIL',  name: 'ตะปู (สำหรับไม้ผัง)',              uom: 'ตัว',  costMaterial: 0.5,  costLabor: 0,    category: 'Layout' },
  { code: 'LAYOUT-MARKER',name: 'หมุดปูนตั้งศูนย์เสา',               uom: 'จุด',  costMaterial: 80,   costLabor: 50,   category: 'Layout' },
  { code: 'LAYOUT-SPRAY', name: 'สีสเปรย์ทำเครื่องหมาย',            uom: 'กระป๋อง', costMaterial: 65,   costLabor: 0,    category: 'Layout' },
  { code: 'LAYOUT-CREW',  name: 'ค่าแรงช่างสำรวจวางผัง',            uom: 'คน-วัน', costMaterial: 0,    costLabor: 800,  category: 'Layout' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 5 : Piling Works
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'PILE-I15',      name: 'เสาเข็มตอก I-15',               uom: 'm',   costMaterial: 150,  costLabor: 100,  category: 'Piling' },
  { code: 'PILE-I18',      name: 'เสาเข็มตอก I-18',               uom: 'm',   costMaterial: 180,  costLabor: 100,  category: 'Piling' },
  { code: 'PILE-I22',      name: 'เสาเข็มตอก I-22',               uom: 'm',   costMaterial: 220,  costLabor: 120,  category: 'Piling' },
  { code: 'PILE-I26',      name: 'เสาเข็มตอก I-26',               uom: 'm',   costMaterial: 280,  costLabor: 120,  category: 'Piling' },
  { code: 'PILE-I30',      name: 'เสาเข็มตอก I-30',               uom: 'm',   costMaterial: 350,  costLabor: 150,  category: 'Piling' },
  { code: 'PILE-I35',      name: 'เสาเข็มตอก I-35',               uom: 'm',   costMaterial: 450,  costLabor: 180,  category: 'Piling' },
  { code: 'PILE-I40',      name: 'เสาเข็มตอก I-40',               uom: 'm',   costMaterial: 550,  costLabor: 200,  category: 'Piling' },
  { code: 'PILE-BRD-CON',  name: 'คอนกรีตเสาเข็มเจาะ',              uom: 'm3',  costMaterial: 2200, costLabor: 800,  category: 'Piling' },
  { code: 'PILE-MACHINE',  name: 'ค่าเช่าเครื่องตอก/เจาะ',           uom: 'วัน',  costMaterial: 0,    costLabor: 12000, category: 'Piling' },
  { code: 'PILE-TRANSPORT', name: 'ค่าขนส่งเสาเข็ม',                 uom: 'เที่ยว', costMaterial: 0,   costLabor: 3500, category: 'Piling' },
  { code: 'PILE-CUT',      name: 'ตัดหัวเข็ม',                       uom: 'ต้น',  costMaterial: 0,    costLabor: 250,  category: 'Piling' },
  { code: 'PILE-CAGE',     name: 'เหล็กเสริม Cage (เข็มเจาะ)',       uom: 'kg',  costMaterial: 23,   costLabor: 6,    category: 'Piling' },
  { code: 'PILE-BENTO',    name: 'น้ำ Bentonite (Slurry)',           uom: 'm3',  costMaterial: 800,  costLabor: 0,    category: 'Piling' },
  { code: 'PILE-LOADTEST', name: 'Load Test (Dynamic/Static)',       uom: 'ต้น',  costMaterial: 0,    costLabor: 35000, category: 'Piling' },
  { code: 'PILE-SEISMIC',  name: 'Seismic Integrity Test',           uom: 'ต้น',  costMaterial: 0,    costLabor: 1500,  category: 'Piling' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 6 : Footing / Foundation
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'FTG-EXC',      name: 'งานขุดดินฐานราก (เครื่องจักร)',    uom: 'm3',  costMaterial: 0,    costLabor: 125,  category: 'Footing' },
  { code: 'FTG-SAND',     name: 'ทรายหยาบบดอัดแน่นใต้ฐาน',         uom: 'm3',  costMaterial: 450,  costLabor: 50,   category: 'Footing' },
  { code: 'FTG-LEAN',     name: 'คอนกรีตหยาบ 1:3:5 ใต้ฐาน',        uom: 'm3',  costMaterial: 1600, costLabor: 150,  category: 'Footing' },
  { code: 'FTG-CON',      name: 'คอนกรีตโครงสร้างฐานราก 240 ksc',  uom: 'm3',  costMaterial: 2100, costLabor: 300,  category: 'Footing' },
  { code: 'FTG-REBAR',    name: 'เหล็กเสริมฐานราก',                 uom: 'kg',  costMaterial: 23,   costLabor: 4,    category: 'Footing' },
  { code: 'FTG-WIRE',     name: 'ลวดผูกเหล็ก',                     uom: 'kg',  costMaterial: 35,   costLabor: 0,    category: 'Footing' },
  { code: 'FTG-SPACER',   name: 'ลูกปูน Spacer',                   uom: 'pcs', costMaterial: 5,    costLabor: 0,    category: 'Footing' },
  { code: 'FTG-FORM',     name: 'ไม้แบบฐานราก',                     uom: 'm2',  costMaterial: 250,  costLabor: 150,  category: 'Footing' },
  { code: 'FTG-FILL',     name: 'ดินถมกลับ (ฐานราก)',               uom: 'm3',  costMaterial: 80,   costLabor: 100,  category: 'Footing' },
  { code: 'FTG-PUMP',     name: 'ปั๊มคอนกรีต (Concrete Pump)',      uom: 'วัน',  costMaterial: 0,    costLabor: 8000, category: 'Footing' },
  { code: 'FTG-DEWATER',  name: 'ปั๊มสูบน้ำ (Dewatering)',          uom: 'วัน',  costMaterial: 500,  costLabor: 800,  category: 'Footing' },
  { code: 'FTG-VIBRATOR', name: 'เครื่องจี้คอนกรีต (Vibrator)',       uom: 'วัน',  costMaterial: 0,    costLabor: 500,  category: 'Footing' },
  { code: 'FTG-CURING',   name: 'พลาสติก/น้ำยาบ่มคอนกรีต',          uom: 'm2',  costMaterial: 15,   costLabor: 5,    category: 'Footing' },

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 7 : Pedestal / Column Stump
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'PDS-CON',      name: 'คอนกรีตเสาตอม่อ 240 ksc',          uom: 'm3',  costMaterial: 2100, costLabor: 350,  category: 'Pedestal' },
  { code: 'PDS-REBAR',    name: 'เหล็กเสริมเสาตอม่อ',                uom: 'kg',  costMaterial: 23,   costLabor: 5,    category: 'Pedestal' },
  { code: 'PDS-WIRE',     name: 'ลวดผูกเหล็ก',                      uom: 'kg',  costMaterial: 35,   costLabor: 0,    category: 'Pedestal' },
  { code: 'PDS-SPACER',   name: 'ลูกปูน Spacer',                    uom: 'pcs', costMaterial: 5,    costLabor: 0,    category: 'Pedestal' },
  { code: 'PDS-FORM',     name: 'ไม้แบบเสาตอม่อ',                   uom: 'm2',  costMaterial: 250,  costLabor: 150,  category: 'Pedestal' },
  { code: 'PDS-DOWEL',    name: 'Dowel Bar ยื่นรอเสาชั้น 1',         uom: 'm',   costMaterial: 23,   costLabor: 5,    category: 'Pedestal' },
  { code: 'PDS-PUMP',     name: 'ปั๊มคอนกรีต',                       uom: 'วัน',  costMaterial: 0,    costLabor: 8000, category: 'Pedestal' },
  { code: 'PDS-VIBRATOR', name: 'เครื่องจี้คอนกรีต',                  uom: 'วัน',  costMaterial: 0,    costLabor: 500,  category: 'Pedestal' },
  { code: 'PDS-CURING',   name: 'พลาสติก/น้ำยาบ่ม',                  uom: 'm2',  costMaterial: 15,   costLabor: 5,    category: 'Pedestal' },


  // ═══════════════════════════════════════════════════════════════════════════
  // Step 8 : Ground Beam / คานคอดิน
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'GBM-EXC',      name: 'ขุดดินคานคอดิน (เครื่องจักร)',     uom: 'm3',  costMaterial: 0,    costLabor: 125,  category: 'Ground Beam' },
  { code: 'GBM-SAND',     name: 'ทรายรองใต้ลีน',                   uom: 'm3',  costMaterial: 450,  costLabor: 50,   category: 'Ground Beam' },
  { code: 'GBM-LEAN',     name: 'คอนกรีตหยาบ 1:3:5 ใต้คาน',       uom: 'm3',  costMaterial: 1600, costLabor: 150,  category: 'Ground Beam' },
  { code: 'GBM-CON',      name: 'คอนกรีตคานคอดิน 240 ksc',         uom: 'm3',  costMaterial: 2100, costLabor: 300,  category: 'Ground Beam' },
  { code: 'GBM-REBAR',    name: 'เหล็กเสริมคานคอดิน',               uom: 'kg',  costMaterial: 23,   costLabor: 5,    category: 'Ground Beam' },
  { code: 'GBM-WIRE',     name: 'ลวดผูกเหล็ก',                     uom: 'kg',  costMaterial: 35,   costLabor: 0,    category: 'Ground Beam' },
  { code: 'GBM-SPACER',   name: 'ลูกปูน Spacer',                   uom: 'pcs', costMaterial: 5,    costLabor: 0,    category: 'Ground Beam' },
  { code: 'GBM-FORM',     name: 'ไม้แบบคานคอดิน',                  uom: 'm2',  costMaterial: 250,  costLabor: 150,  category: 'Ground Beam' },
  { code: 'GBM-FILL',     name: 'ดินถมกลับ (คานคอดิน)',             uom: 'm3',  costMaterial: 80,   costLabor: 100,  category: 'Ground Beam' },
  { code: 'GBM-PUMP',     name: 'ปั๊มคอนกรีต',                      uom: 'วัน',  costMaterial: 0,    costLabor: 8000, category: 'Ground Beam' },
  { code: 'GBM-VIBRATOR', name: 'เครื่องจี้คอนกรีต',                 uom: 'วัน',  costMaterial: 0,    costLabor: 500,  category: 'Ground Beam' },
  { code: 'GBM-CURING',   name: 'พลาสติก/น้ำยาบ่มคอนกรีต',         uom: 'm2',  costMaterial: 15,   costLabor: 5,    category: 'Ground Beam' },
  { code: 'GBM-TERMITE',  name: 'ระบบท่ออัดน้ำยาปลวก',               uom: 'm',   costMaterial: 60,   costLabor: 20,   category: 'Ground Beam' },


  // ═══════════════════════════════════════════════════════════════════════════
  // Step 9 : Slab on Grade / พื้นหล่อในที่
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'SOG-SAND',     name: 'ทรายปรับระดับใต้พื้น',             uom: 'm3',  costMaterial: 450,  costLabor: 50,   category: 'Slab on Grade' },
  { code: 'SOG-PLASTIC',  name: 'พลาสติกกันชื้น',                   uom: 'm2',  costMaterial: 8,    costLabor: 5,    category: 'Slab on Grade' },
  { code: 'SOG-MESH',     name: 'ไวร์เมชพื้น',                      uom: 'kg',  costMaterial: 30,   costLabor: 5,    category: 'Slab on Grade' },
  { code: 'SOG-REBAR',    name: 'เหล็กเส้นเสริมพื้น',                uom: 'kg',  costMaterial: 23,   costLabor: 4,    category: 'Slab on Grade' },
  { code: 'SOG-CON',      name: 'คอนกรีตพื้น 240 ksc',              uom: 'm3',  costMaterial: 2100, costLabor: 300,  category: 'Slab on Grade' },
  { code: 'SOG-FORM-EDG', name: 'ไม้แบบขอบพื้น',                    uom: 'm',   costMaterial: 80,   costLabor: 40,   category: 'Slab on Grade' },
  { code: 'SOG-CJOINT',   name: 'ร่องตัด Control Joint',            uom: 'm',   costMaterial: 10,   costLabor: 25,   category: 'Slab on Grade' },
  { code: 'SOG-EJOINT',   name: 'Expansion Joint (วัสดุยาแนว)',      uom: 'm',   costMaterial: 50,   costLabor: 30,   category: 'Slab on Grade' },
  { code: 'SOG-PUMP',     name: 'ปั๊มคอนกรีต',                      uom: 'วัน',  costMaterial: 0,    costLabor: 8000, category: 'Slab on Grade' },
  { code: 'SOG-VIBRATOR', name: 'เครื่องจี้ + Vibrating Screed',     uom: 'วัน',  costMaterial: 0,    costLabor: 800,  category: 'Slab on Grade' },
  { code: 'SOG-CURING',   name: 'พลาสติก/น้ำยาบ่มคอนกรีต',          uom: 'm2',  costMaterial: 15,   costLabor: 5,    category: 'Slab on Grade' },
  { code: 'SOG-HARDENER', name: 'Floor Hardener',                   uom: 'kg',  costMaterial: 18,   costLabor: 5,    category: 'Slab on Grade' },
  { code: 'SOG-SLEEVE',   name: 'Sleeve ท่อผ่านพื้น',               uom: 'pcs', costMaterial: 80,   costLabor: 30,   category: 'Slab on Grade' },


  // ═══════════════════════════════════════════════════════════════════════════
  // Step 10 : Precast Slab / พื้นสำเร็จรูป
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'PCS-PANEL',    name: 'แผ่นพื้นสำเร็จรูป (LL 250 กก./ม²)',  uom: 'm2',   costMaterial: 280,  costLabor: 50,   category: 'Precast Slab' },
  { code: 'PCS-MESH',     name: 'ไวร์เมชทับหน้า',                     uom: 'kg',   costMaterial: 30,   costLabor: 5,    category: 'Precast Slab' },
  { code: 'PCS-TOP-CON',  name: 'คอนกรีตทับหน้า 240 ksc',             uom: 'm3',   costMaterial: 2100, costLabor: 300,  category: 'Precast Slab' },
  { code: 'PCS-SHORE',    name: 'ค้ำยันท้องพื้น (Shoring)',            uom: 'm',    costMaterial: 50,   costLabor: 30,   category: 'Precast Slab' },
  { code: 'PCS-GROUT',    name: 'เกร้าท์ร่องระหว่างแผ่น',              uom: 'kg',   costMaterial: 15,   costLabor: 8,    category: 'Precast Slab' },
  { code: 'PCS-CRANE',    name: 'เครนยกแผ่นพื้น',                     uom: 'วัน',   costMaterial: 0,    costLabor: 12000, category: 'Precast Slab' },
  { code: 'PCS-PUMP',     name: 'ปั๊มคอนกรีตทับหน้า',                  uom: 'วัน',   costMaterial: 0,    costLabor: 8000, category: 'Precast Slab' },
  { code: 'PCS-VIBRATOR', name: 'เครื่องจี้ + ปาดคอนกรีต',             uom: 'วัน',   costMaterial: 0,    costLabor: 500,  category: 'Precast Slab' },
  { code: 'PCS-CURING',   name: 'พลาสติก/น้ำยาบ่มทับหน้า',            uom: 'm2',   costMaterial: 15,   costLabor: 5,    category: 'Precast Slab' },
  { code: 'PCS-TERMITE',  name: 'ท่อยาปลวก',                         uom: 'm',    costMaterial: 60,   costLabor: 20,   category: 'Precast Slab' },
  { code: 'PCS-DELIVER',  name: 'ขนส่งแผ่นพื้น',                      uom: 'เที่ยว', costMaterial: 0,    costLabor: 3500, category: 'Precast Slab' },


  // ═══════════════════════════════════════════════════════════════════════════
  // Step 11 : Column Floor 1 / เสาชั้น 1
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'COL-CON',      name: 'คอนกรีตเสาชั้น 1 (240 ksc)',         uom: 'm3',  costMaterial: 2000, costLabor: 1000, category: 'Column' },
  { code: 'COL-REBAR',    name: 'เหล็กเสริมเสาชั้น 1',                uom: 'kg',  costMaterial: 23,   costLabor: 5,    category: 'Column' },
  { code: 'COL-WIRE',     name: 'ลวดผูกเหล็ก',                       uom: 'kg',  costMaterial: 35,   costLabor: 0,    category: 'Column' },
  { code: 'COL-SPACER',   name: 'ลูกปูน Spacer',                     uom: 'pcs', costMaterial: 5,    costLabor: 0,    category: 'Column' },
  { code: 'COL-FORM',     name: 'ไม้แบบเสาชั้น 1 (รวมไม้คร่าว+ตะปู)', uom: 'm2',  costMaterial: 337,  costLabor: 150,  category: 'Column' },
  { code: 'COL-PUMP',     name: 'ปั๊มคอนกรีต',                       uom: 'วัน',  costMaterial: 0,    costLabor: 8000, category: 'Column' },
  { code: 'COL-VIBRATOR', name: 'เครื่องจี้คอนกรีต',                  uom: 'วัน',  costMaterial: 0,    costLabor: 500,  category: 'Column' },
  { code: 'COL-CURING',   name: 'พลาสติก/น้ำยาบ่ม',                  uom: 'm2',  costMaterial: 15,   costLabor: 5,    category: 'Column' },


  // ═══════════════════════════════════════════════════════════════════════════
  // Step 12 : Beam + Roof Deck / คาน + พื้นดาดฟ้า
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'BMS-CON',      name: 'คอนกรีตคานดาดฟ้า 240 ksc',         uom: 'm3',  costMaterial: 2100, costLabor: 500,  category: 'Beam-Slab' },
  { code: 'BMS-SLAB-CON', name: 'คอนกรีตพื้นดาดฟ้า 240 ksc',        uom: 'm3',  costMaterial: 2100, costLabor: 400,  category: 'Beam-Slab' },
  { code: 'BMS-SLOPE',    name: 'คอนกรีตเทปรับสโลปดาดฟ้า',          uom: 'm3',  costMaterial: 1800, costLabor: 300,  category: 'Beam-Slab' },
  { code: 'BMS-REBAR',    name: 'เหล็กเสริมคาน+พื้น',               uom: 'kg',  costMaterial: 23,   costLabor: 5,    category: 'Beam-Slab' },
  { code: 'BMS-WIRE',     name: 'ลวดผูกเหล็ก',                     uom: 'kg',  costMaterial: 35,   costLabor: 0,    category: 'Beam-Slab' },
  { code: 'BMS-SPACER',   name: 'ลูกปูน Spacer (คาน+พื้น)',          uom: 'pcs', costMaterial: 5,    costLabor: 0,    category: 'Beam-Slab' },
  { code: 'BMS-FORM',     name: 'ไม้แบบคาน+พื้นดาดฟ้า',             uom: 'm2',  costMaterial: 337,  costLabor: 150,  category: 'Beam-Slab' },
  { code: 'BMS-SHORE',    name: 'ไม้ค้ำยันท้องคาน+พื้น',              uom: 'pcs', costMaterial: 150,  costLabor: 50,   category: 'Beam-Slab' },
  { code: 'BMS-WP',       name: 'ระบบกันซึมดาดฟ้า (Waterproofing)',  uom: 'm2',  costMaterial: 250,  costLabor: 150,  category: 'Beam-Slab' },
  { code: 'BMS-DRAIN',    name: 'หัว Roof Drain',                 uom: 'pcs', costMaterial: 450,  costLabor: 150,  category: 'Beam-Slab' },
  { code: 'BMS-PUMP',     name: 'ปั๊มคอนกรีต',                      uom: 'วัน',  costMaterial: 0,    costLabor: 8000, category: 'Beam-Slab' },
  { code: 'BMS-VIBRATOR', name: 'เครื่องจี้คอนกรีต',                  uom: 'วัน',  costMaterial: 0,    costLabor: 500,  category: 'Beam-Slab' },
  { code: 'BMS-CURING',   name: 'พลาสติก/น้ำยาบ่มดาดฟ้า',            uom: 'm2',  costMaterial: 15,   costLabor: 5,    category: 'Beam-Slab' },


  // --- Step 13 : Staircase ---
  // ═══════════════════════════════════════════════════════════════════════════
  // Step 13 : Staircase / โครงสร้างบันได
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'STR-CON',      name: 'คอนกรีตโครงสร้างบันได (240 ksc)',     uom: 'm3',  costMaterial: 2000, costLabor: 500,  category: 'Staircase' },
  { code: 'STR-REBAR',    name: 'เหล็กเสริมบันได',                    uom: 'kg',  costMaterial: 23,   costLabor: 5,    category: 'Staircase' },
  { code: 'STR-WIRE',     name: 'ลวดผูกเหล็ก',                       uom: 'kg',  costMaterial: 35,   costLabor: 0,    category: 'Staircase' },
  { code: 'STR-SPACER',   name: 'ลูกปูน Spacer ท้องบันได',            uom: 'pcs', costMaterial: 5,    costLabor: 0,    category: 'Staircase' },
  { code: 'STR-FORM',     name: 'ไม้แบบบันได (ท้อง+ข้าง+ลูกตั้ง)',      uom: 'm2',  costMaterial: 337,  costLabor: 150,  category: 'Staircase' },
  { code: 'STR-SHORE',    name: 'ไม้ค้ำยันท้องบันได+ชานพัก',            uom: 'pcs', costMaterial: 150,  costLabor: 50,   category: 'Staircase' },
  { code: 'STR-NOSING',   name: 'จมูกบันไดกันลื่น',                    uom: 'm',   costMaterial: 80,   costLabor: 30,   category: 'Staircase' },
  { code: 'STR-PUMP',     name: 'ปั๊มคอนกรีต',                       uom: 'วัน',  costMaterial: 0,    costLabor: 8000, category: 'Staircase' },
  { code: 'STR-VIBRATOR', name: 'เครื่องจี้คอนกรีต',                  uom: 'วัน',  costMaterial: 0,    costLabor: 500,  category: 'Staircase' },
  { code: 'STR-CURING',   name: 'พลาสติก/น้ำยาบ่มบันได',             uom: 'm2',  costMaterial: 15,   costLabor: 5,    category: 'Staircase' },


  // ═══════════════════════════════════════════════════════════════════════════
  // Step 14 : Column Cap Plate / เพลทหัวเสา
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'CCP-STEEL',    name: 'เพลทเหล็กหัวเสา (ตัดตามขนาด)',        uom: 'kg',  costMaterial: 45,   costLabor: 15,   category: 'Column Cap' },
  { code: 'CCP-BOLT',     name: 'J-Bolt / Anchor Bolt',            uom: 'ตัว',  costMaterial: 120,  costLabor: 50,   category: 'Column Cap' },
  { code: 'CCP-TEMPLATE', name: 'แพทเทิร์นประคอง Bolt (ตีไม้เจาะรู)',    uom: 'จุด',  costMaterial: 50,   costLabor: 100,  category: 'Column Cap' },
  { code: 'CCP-GROUT',    name: 'Non-shrink Grout (ถุง 25กก.)',      uom: 'ถุง',  costMaterial: 250,  costLabor: 100,  category: 'Column Cap' },
  { code: 'CCP-WELD',     name: 'ค่าแรงเชื่อมเสากับเพลท',              uom: 'm',   costMaterial: 50,   costLabor: 250,  category: 'Column Cap' },
  { code: 'CCP-PAINT',    name: 'ทาสีกันสนิมเพลท+รอยเชื่อม',           uom: 'm2',  costMaterial: 54,   costLabor: 40,   category: 'Column Cap' },


  // --- Step 15 : Roof Structure ---
  // ═══════════════════════════════════════════════════════════════════════════
  // Step 15 : Roof Structure / โครงหลังคา
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'RST-STEEL',    name: 'เหล็กโครงหลังคา (อะเส ดั้ง อกไก่ จันทัน ตะเข้)', uom: 'kg', costMaterial: 30,   costLabor: 15,   category: 'Roof Structure' },
  { code: 'RST-WELD',     name: 'ลวดเชื่อมเหล็กรูปพรรณ',              uom: 'kg', costMaterial: 85,   costLabor: 0,    category: 'Roof Structure' },
  { code: 'RST-PAINT',    name: 'สีทารองพื้นเหล็กกันสนิม',              uom: 'm2', costMaterial: 54,   costLabor: 25,   category: 'Roof Structure' },
  { code: 'RST-PURLIN',   name: 'แปสำเร็จรูป GZ',                   uom: 'm',  costMaterial: 65,   costLabor: 15,   category: 'Roof Structure' },
  { code: 'RST-SCREW',    name: 'สกรูปลายสว่านยึดแป',               uom: 'ตัว', costMaterial: 1.5,  costLabor: 0,    category: 'Roof Structure' },


  // ═══════════════════════════════════════════════════════════════════════════
  // Step 16 : Roofing / มุงหลังคา
  // ═══════════════════════════════════════════════════════════════════════════
  { code: 'ROF-CPAC',     name: 'กระเบื้องคอนกรีตแผ่นลอน',            uom: 'แผ่น', costMaterial: 15,   costLabor: 10,  category: 'Roofing' },
  { code: 'ROF-EXCELLA',  name: 'กระเบื้องเซรามิค',                  uom: 'แผ่น', costMaterial: 85,   costLabor: 25,  category: 'Roofing' },
  { code: 'ROF-METAL',    name: 'แผ่นเมทัลชีท',                     uom: 'ตร.ม.', costMaterial: 180,  costLabor: 60,  category: 'Roofing' },
  { code: 'ROF-CORR',     name: 'กระเบื้องลอนคู่',                    uom: 'แผ่น', costMaterial: 65,   costLabor: 20,  category: 'Roofing' },
  { code: 'ROF-SHINGLE',  name: 'ยางมะตอย (Asphalt Shingle)',        uom: 'ตร.ม.', costMaterial: 350,  costLabor: 150, category: 'Roofing' },
  
  { code: 'ROF-CAP-TILE', name: 'แผ่นครอบสัน/ตะเข้สัน (กระเบื้อง)',       uom: 'แผ่น', costMaterial: 65,   costLabor: 30,  category: 'Roofing' },
  { code: 'ROF-CAP-MET',  name: 'แผ่นครอบสัน/ตะเข้สัน (เมทัลชีท)',       uom: 'm',   costMaterial: 120,  costLabor: 40,  category: 'Roofing' },
  { code: 'ROF-DRYTECH',  name: 'ชุดอุปกรณ์ยึดครอบระบบแห้ง (Dry Tech)', uom: 'm',   costMaterial: 150,  costLabor: 50,  category: 'Roofing' },
  { code: 'ROF-VALLEY',   name: 'รางน้ำตะเข้',                      uom: 'm',   costMaterial: 350,  costLabor: 100, category: 'Roofing' },
  
  { code: 'ROF-EAVE',     name: 'ไม้เชิงชาย 8" + ไม้ปิดทับ 6"',         uom: 'm',   costMaterial: 180,  costLabor: 80,  category: 'Roofing' },
  { code: 'ROF-INSUL',    name: 'แผ่นสะท้อนความร้อน (Foil) / ฉนวน PE',  uom: 'm2',  costMaterial: 40,   costLabor: 15,  category: 'Roofing' },
  { code: 'ROF-BIRD',     name: 'แผ่น/หวีปิดกันนก',                  uom: 'm',   costMaterial: 35,   costLabor: 15,  category: 'Roofing' },


  // --- Step 17 : Brickwork ---
  { code: 'BRK-CLAY',     name: 'อิฐมอญ (144 ก้อน/ม²)',                uom: 'pcs', costMaterial: 1.20, costLabor: 0,   category: 'Brickwork' },
  { code: 'BRK-AAC',      name: 'อิฐมวลเบา AAC (8.78 ก้อน/ม²)',       uom: 'pcs', costMaterial: 25,   costLabor: 0,   category: 'Brickwork' },
  { code: 'BRK-MORTAR',   name: 'ปูนก่อ',                             uom: 'm2', costMaterial: 50,   costLabor: 80,  category: 'Brickwork' },
  { code: 'BRK-LINTEL',   name: 'เสาเอ็น-ทับหลัง (รวมคอนกรีต+เหล็ก)',  uom: 'm',  costMaterial: 250,  costLabor: 150, category: 'Brickwork' },

  // --- Step 18 : Plastering ---
  { code: 'PLS-EXT',      name: 'ฉาบผนังภายนอก',                      uom: 'm2', costMaterial: 50,   costLabor: 150, category: 'Plastering' },
  { code: 'PLS-INT',      name: 'ฉาบผนังภายใน',                       uom: 'm2', costMaterial: 45,   costLabor: 132, category: 'Plastering' },
  { code: 'PLS-SKIM',     name: 'สกิมโค้ท (Skim Coat)',               uom: 'm2', costMaterial: 30,   costLabor: 28.57, category: 'Plastering' },

  // --- Step 19 : Ceiling ---
  { code: 'CLG-PANEL',    name: 'แผ่นฝ้าเพดาน',                       uom: 'm2', costMaterial: 90,   costLabor: 80,  category: 'Ceiling' },
  { code: 'CLG-FRAME',    name: 'โครงคร่าว C-line',                   uom: 'm',  costMaterial: 25,   costLabor: 0,   category: 'Ceiling' },
  { code: 'CLG-CORNICE',  name: 'บัวฝ้าเพดาน',                        uom: 'm',  costMaterial: 40,   costLabor: 20,  category: 'Ceiling' },

  // --- Step 20 : Floor Tiling ---
  { code: 'FLT-TILE',     name: 'กระเบื้องพื้น (รวมปู)',               uom: 'm2', costMaterial: 300,  costLabor: 200, category: 'Floor Tile' },
  { code: 'FLT-ADHESIVE', name: 'กาวซีเมนต์ (20kg)',                  uom: 'pcs', costMaterial: 180, costLabor: 0,   category: 'Floor Tile' },
  { code: 'FLT-SKIRTING', name: 'บัวพื้น',                            uom: 'm',  costMaterial: 60,   costLabor: 30,  category: 'Floor Tile' },

  // --- Step 21 : Bathroom Tiling ---
  { code: 'BTL-FLOOR',    name: 'กระเบื้องพื้นห้องน้ำ',               uom: 'm2', costMaterial: 350,  costLabor: 250, category: 'Bath Tile' },
  { code: 'BTL-WALL',     name: 'กระเบื้องผนังห้องน้ำ',               uom: 'm2', costMaterial: 350,  costLabor: 250, category: 'Bath Tile' },
  { code: 'BTL-WP',       name: 'น้ำยากันซึม (2 รอบ)',               uom: 'm2', costMaterial: 75,   costLabor: 30,  category: 'Bath Tile' },

  // --- Step 22 : Exterior Finish ---
  { code: 'EXF-MAT',      name: 'วัสดุตกแต่งผนังภายนอก',             uom: 'm2', costMaterial: 200,  costLabor: 100, category: 'Exterior Finish' },

  // --- Step 23 : Primer ---
  { code: 'PRM-INT',      name: 'สีรองพื้นภายใน (แกลลอน)',            uom: 'pcs', costMaterial: 650, costLabor: 0,   category: 'Primer' },
  { code: 'PRM-EXT',      name: 'สีรองพื้นภายนอก (แกลลอน)',           uom: 'pcs', costMaterial: 750, costLabor: 0,   category: 'Primer' },
  { code: 'PRM-SAND',     name: 'กระดาษทราย #120-180',               uom: 'แผ่น', costMaterial: 8,   costLabor: 0,   category: 'Primer' },
  { code: 'PRM-CRACK',    name: 'อะคริลิกอุดรอยแตก 300ml',           uom: 'pcs', costMaterial: 65,  costLabor: 0,   category: 'Primer' },
  { code: 'PRM-ROLLER',   name: 'ลูกกลิ้ง+ถาดรอง+ด้าม',              uom: 'set', costMaterial: 120, costLabor: 0,   category: 'Primer' },
  { code: 'PRM-BRUSH',    name: 'พู่กันตัดเส้นขอบ 2-3"',              uom: 'pcs', costMaterial: 35,  costLabor: 0,   category: 'Primer' },

  // --- Step 24 : Aluminium Doors & Windows ---
  { code: 'ALU-DOOR',     name: 'ประตูอลูมิเนียม (ชุด)',              uom: 'set', costMaterial: 5500, costLabor: 800, category: 'Aluminium' },
  { code: 'ALU-DOOR-A',   name: 'พื้นที่ประตูอลูมิเนียม',              uom: 'm2',  costMaterial: 0,    costLabor: 0,   category: 'Aluminium' },
  { code: 'ALU-SLIDE',    name: 'ประตูบานเลื่อนอลูมิเนียม (ชุด)',     uom: 'set', costMaterial: 8500, costLabor: 1200, category: 'Aluminium' },
  { code: 'ALU-WINDOW',   name: 'หน้าต่างอลูมิเนียม (ชุด)',           uom: 'set', costMaterial: 3500, costLabor: 500, category: 'Aluminium' },
  { code: 'ALU-WIN-A',    name: 'พื้นที่หน้าต่างอลูมิเนียม',           uom: 'm2',  costMaterial: 0,    costLabor: 0,   category: 'Aluminium' },
  { code: 'ALU-SEAL',     name: 'ซีลยาแนว PU Sealant',              uom: 'm',   costMaterial: 35,   costLabor: 15,  category: 'Aluminium' },

  // --- Step 25 : Paint Coat 1 ---
  { code: 'PNT-INT',      name: 'สีทับหน้าภายใน (แกลลอน)',           uom: 'pcs', costMaterial: 1200, costLabor: 105, category: 'Paint' },
  { code: 'PNT-ACCENT',   name: 'สี Accent สีเข้ม (แกลลอน)',         uom: 'pcs', costMaterial: 1350, costLabor: 115, category: 'Paint' },
  { code: 'PNT-EXT',      name: 'สีทับหน้าภายนอก (แกลลอน)',          uom: 'pcs', costMaterial: 1500, costLabor: 118, category: 'Paint' },
  { code: 'PNT-WOOD',     name: 'สีย้อมไม้/แลกเกอร์ (แกลลอน)',       uom: 'pcs', costMaterial: 800,  costLabor: 80,  category: 'Paint' },
  { code: 'PNT-ROLLER',   name: 'ลูกกลิ้งทาสี + ถาดรอง',             uom: 'set', costMaterial: 150,  costLabor: 0,   category: 'Paint' },
  { code: 'PNT-MASK',     name: 'เทปกาว Masking Tape',              uom: 'pcs', costMaterial: 25,   costLabor: 0,   category: 'Paint' },
  { code: 'PNT-DROP',     name: 'ผ้าคลุมพื้นกันสีหยด',               uom: 'pcs', costMaterial: 45,   costLabor: 0,   category: 'Paint' },

  // --- Step 26 : Electrical ---
  { code: 'ELC-CONDUIT',  name: 'ท่อร้อยสายไฟ PVC',                  uom: 'm',   costMaterial: 15,    costLabor: 20,    category: 'Electrical' },
  { code: 'ELC-MAIN',     name: 'สายเมน THW',                        uom: 'm',   costMaterial: 45,    costLabor: 12,    category: 'Electrical' },
  { code: 'ELC-BRANCH',   name: 'สายย่อย VAF 2×2.5',                 uom: 'm',   costMaterial: 18,    costLabor: 8,     category: 'Electrical' },
  { code: 'ELC-AC',       name: 'สาย VCT แอร์ dedicated',            uom: 'm',   costMaterial: 28,    costLabor: 12,    category: 'Electrical' },
  { code: 'ELC-SOCKET',   name: 'สวิตช์/เต้ารับ',                     uom: 'pcs', costMaterial: 120,   costLabor: 80,    category: 'Electrical' },
  { code: 'ELC-LIGHT',    name: 'โคมไฟ',                              uom: 'pcs', costMaterial: 500,   costLabor: 100,   category: 'Electrical' },
  { code: 'ELC-CU',       name: 'ตู้ Consumer Unit + เบรกเกอร์',      uom: 'set', costMaterial: 3500,  costLabor: 1500,  category: 'Electrical' },
  { code: 'ELC-GROUND',   name: 'สายดิน Ground Rod',                 uom: 'pcs', costMaterial: 350,   costLabor: 200,   category: 'Electrical' },
  { code: 'ELC-OUT',      name: 'เต้ารับกันน้ำ IP55',                 uom: 'pcs', costMaterial: 250,   costLabor: 120,   category: 'Electrical' },
  { code: 'ELC-EV',       name: 'EV Charger Wall Box',               uom: 'set', costMaterial: 25000, costLabor: 3000,  category: 'Electrical' },

  // --- Step 27 : Sanitary Interior ---
  { code: 'SIP-SUPPLY',   name: 'ท่อน้ำดี PVC Ø1/2"-3/4"',           uom: 'm',   costMaterial: 25,    costLabor: 30,   category: 'Sanitary Int' },
  { code: 'SIP-DRAIN',    name: 'ท่อน้ำทิ้ง PVC Ø2"-4"',             uom: 'm',   costMaterial: 30,    costLabor: 30,   category: 'Sanitary Int' },
  { code: 'SIP-HOT',      name: 'ท่อน้ำร้อน PPR',                    uom: 'm',   costMaterial: 45,    costLabor: 40,   category: 'Sanitary Int' },
  { code: 'SIP-VALVE',    name: 'วาล์ว/ข้อต่อ (Stop + Gate)',        uom: 'pcs', costMaterial: 85,    costLabor: 30,   category: 'Sanitary Int' },
  { code: 'SIP-FD',       name: 'Floor Drain สแตนเลส',               uom: 'set', costMaterial: 150,   costLabor: 80,   category: 'Sanitary Int' },
  { code: 'SIP-PTRAP',    name: 'P-Trap ดักกลิ่น',                   uom: 'pcs', costMaterial: 65,    costLabor: 30,   category: 'Sanitary Int' },
  { code: 'SIP-CO',       name: 'Cleanout Box',                      uom: 'pcs', costMaterial: 120,   costLabor: 60,   category: 'Sanitary Int' },

  // --- Step 28 : Sanitary Exterior ---
  { code: 'SEP-SUPPLY',   name: 'ท่อเมนประปา HDPE/PVC',              uom: 'm',   costMaterial: 35,    costLabor: 25,   category: 'Sanitary Ext' },
  { code: 'SEP-DRAIN',    name: 'ท่อระบายน้ำ PVC Ø4"-6"',            uom: 'm',   costMaterial: 40,    costLabor: 30,   category: 'Sanitary Ext' },
  { code: 'SEP-CHAMBER',  name: 'บ่อพักน้ำทิ้ง (ก่อ+ฝา)',            uom: 'บ่อ',  costMaterial: 800,   costLabor: 500,  category: 'Sanitary Ext' },
  { code: 'SEP-SEPTIC',   name: 'ถังบำบัดสำเร็จรูป',                  uom: 'set', costMaterial: 4500,  costLabor: 1500, category: 'Sanitary Ext' },
  { code: 'SEP-GREASE',   name: 'ถังดักไขมัน',                        uom: 'set', costMaterial: 1500,  costLabor: 500,  category: 'Sanitary Ext' },
  { code: 'SEP-METER',    name: 'มิเตอร์น้ำ + ขอติดตั้ง',             uom: 'set', costMaterial: 1200,  costLabor: 500,  category: 'Sanitary Ext' },
  { code: 'SEP-RAIN',     name: 'รางน้ำฝน PVC + ท่อลง',              uom: 'm',   costMaterial: 80,    costLabor: 50,   category: 'Sanitary Ext' },
  { code: 'SEP-PUMP',     name: 'ถังพักน้ำ + ปั๊มอัตโนมัติ',          uom: 'set', costMaterial: 8000,  costLabor: 2000, category: 'Sanitary Ext' },

  // --- Step 29 : Miscellaneous ---
  { code: 'MSC-CURTAIN',  name: 'ราวม่านรางเลื่อน',                   uom: 'm',   costMaterial: 120,   costLabor: 40,   category: 'Misc' },
  { code: 'MSC-BLIND',    name: 'มู่ลี่/ม่านม้วน',                    uom: 'set', costMaterial: 800,   costLabor: 150,  category: 'Misc' },
  { code: 'MSC-TOWEL',    name: 'ราวแขวนผ้า สแตนเลส',                uom: 'pcs', costMaterial: 250,   costLabor: 50,   category: 'Misc' },
  { code: 'MSC-SOAP',     name: 'ที่กดสบู่เหลว',                      uom: 'pcs', costMaterial: 180,   costLabor: 30,   category: 'Misc' },
  { code: 'MSC-PAPER',    name: 'ที่แขวนกระดาษทิชชู',                 uom: 'pcs', costMaterial: 150,   costLabor: 30,   category: 'Misc' },
  { code: 'MSC-MIRROR',   name: 'กระจกเงา + กรอบ',                   uom: 'set', costMaterial: 600,   costLabor: 100,  category: 'Misc' },
  { code: 'MSC-STOPPER',  name: 'กันกระแทกประตู',                     uom: 'pcs', costMaterial: 45,    costLabor: 15,   category: 'Misc' },
  { code: 'MSC-CLOSER',   name: 'โช้คอัพประตู (Door Closer)',          uom: 'pcs', costMaterial: 850,   costLabor: 200,  category: 'Misc' },
  { code: 'MSC-PEEP',     name: 'ตาแมว (Peephole)',                   uom: 'pcs', costMaterial: 120,   costLabor: 30,   category: 'Misc' },
  { code: 'MSC-HNUM',     name: 'เลขที่บ้าน สแตนเลส',                uom: 'set', costMaterial: 250,   costLabor: 50,   category: 'Misc' },
  { code: 'MSC-SHELF',    name: 'ชั้นวาง/ชั้นรองเท้า',                uom: 'set', costMaterial: 1200,  costLabor: 300,  category: 'Misc' },
  { code: 'MSC-CABINET',  name: 'ตู้ Built-in',                       uom: 'pcs', costMaterial: 8000,  costLabor: 2000, category: 'Misc' },
  { code: 'MSC-MAIL',     name: 'ตู้จดหมาย สแตนเลส',                  uom: 'set', costMaterial: 350,   costLabor: 50,   category: 'Misc' },
  { code: 'MSC-CLOTH',    name: 'ราวตากผ้า สแตนเลส',                  uom: 'm',   costMaterial: 200,   costLabor: 50,   category: 'Misc' },

  // --- Step 30 : Sanitary Fixtures ---
  { code: 'SFX-TOILET',   name: 'ชักโครก + ข้อต่อ + สายน้ำ',          uom: 'set', costMaterial: 3500,  costLabor: 500,  category: 'Sanitary Fix' },
  { code: 'SFX-BASIN',    name: 'อ่างล้างหน้า + ก๊อก + สะดือ',        uom: 'set', costMaterial: 2200,  costLabor: 400,  category: 'Sanitary Fix' },
  { code: 'SFX-SHOWER',   name: 'ชุดฝักบัว + ราว + สาย',             uom: 'set', costMaterial: 1500,  costLabor: 300,  category: 'Sanitary Fix' },
  { code: 'SFX-BIDET',    name: 'สายชำระ (Bidet Spray)',              uom: 'set', costMaterial: 350,   costLabor: 80,   category: 'Sanitary Fix' },
  { code: 'SFX-FAUCET',   name: 'ก๊อกน้ำ (ซิงค์/สนาม)',               uom: 'pcs', costMaterial: 450,   costLabor: 80,   category: 'Sanitary Fix' },
  { code: 'SFX-KSINK',    name: 'ซิงค์ล้างจาน + สะดือ',               uom: 'set', costMaterial: 2800,  costLabor: 500,  category: 'Sanitary Fix' },
  { code: 'SFX-KFAUCET',  name: 'ก๊อกน้ำครัว (คอยาว)',                uom: 'pcs', costMaterial: 650,   costLabor: 80,   category: 'Sanitary Fix' },
  { code: 'SFX-HEATER',   name: 'เครื่องทำน้ำอุ่น + ติดตั้ง',           uom: 'set', costMaterial: 3500,  costLabor: 800,  category: 'Sanitary Fix' },
  { code: 'SFX-TUB',      name: 'อ่างอาบน้ำ + ก๊อกผสม',              uom: 'set', costMaterial: 8000,  costLabor: 1500, category: 'Sanitary Fix' },
  { code: 'SFX-URINAL',   name: 'โถปัสสาวะชาย + Flush Valve',        uom: 'set', costMaterial: 2500,  costLabor: 400,  category: 'Sanitary Fix' },
  { code: 'SFX-LSINK',    name: 'อ่างซักล้าง + ก๊อก',                 uom: 'set', costMaterial: 1800,  costLabor: 300,  category: 'Sanitary Fix' },
  { code: 'SFX-SILI',     name: 'ซิลิโคนยาแนวสุขภัณฑ์',               uom: 'pcs', costMaterial: 85,    costLabor: 0,    category: 'Sanitary Fix' },
  { code: 'SFX-PTFE',     name: 'เทปพันเกลียว PTFE',                  uom: 'pcs', costMaterial: 15,    costLabor: 0,    category: 'Sanitary Fix' },

  // --- Step 31 : Wooden Doors ---
  { code: 'WDR-DOOR',     name: 'บานประตูไม้ + วงกบ',                uom: 'set', costMaterial: 3800,  costLabor: 600,  category: 'Wood Door' },
  { code: 'WDR-WINDOW',   name: 'หน้าต่างไม้ + วงกบ',                uom: 'set', costMaterial: 2800,  costLabor: 400,  category: 'Wood Door' },
  { code: 'WDR-HARDWARE', name: 'อุปกรณ์ลูกบิด/บานพับ',              uom: 'set', costMaterial: 350,   costLabor: 50,   category: 'Wood Door' },
  { code: 'WDR-SEAL',     name: 'ซิลิโคน/PU ยาแนวรอบวงกบ',          uom: 'pcs', costMaterial: 85,    costLabor: 20,   category: 'Wood Door' },
  { code: 'WDR-FINISH',   name: 'สีย้อมไม้/แลกเกอร์ (แกลลอน)',       uom: 'pcs', costMaterial: 800,   costLabor: 80,   category: 'Wood Door' },

  // --- Step 32 : Final Paint ---
  { code: 'FPT-INT',      name: 'สีทับหน้าภายใน รอบ 2 (แกลลอน)',     uom: 'pcs', costMaterial: 1200,  costLabor: 105,  category: 'Final Paint' },
  { code: 'FPT-EXT',      name: 'สีทับหน้าภายนอก รอบ 2 (แกลลอน)',    uom: 'pcs', costMaterial: 1500,  costLabor: 118,  category: 'Final Paint' },
  { code: 'FPT-WOOD',     name: 'สีย้อมไม้ รอบ 2 (แกลลอน)',           uom: 'pcs', costMaterial: 800,   costLabor: 80,   category: 'Final Paint' },
  { code: 'FPT-TOUCH',    name: 'แต้มซ่อมจุดบกพร่อง (m²)',           uom: 'm2',  costMaterial: 15,    costLabor: 30,   category: 'Final Paint' },
  { code: 'FPT-ROLLER',   name: 'ลูกกลิ้ง (เปลี่ยนผ้ารอบ 2)',         uom: 'set', costMaterial: 80,    costLabor: 0,    category: 'Final Paint' },
  { code: 'FPT-BRUSH',    name: 'พู่กันตัดเส้น + แปรงแต้ม',           uom: 'set', costMaterial: 60,    costLabor: 0,    category: 'Final Paint' },

  // --- Step 33 : Defect Inspection ---
  { code: 'DEF-ITEM',     name: 'งานซ่อม Defect (รายการ)',            uom: 'pcs', costMaterial: 200,   costLabor: 300,  category: 'Defect' },
  { code: 'DEF-CLEAN',    name: 'Big Cleaning',                       uom: 'm2',  costMaterial: 5,     costLabor: 10,   category: 'Defect' },
  { code: 'DEF-TOUCH',    name: 'แต้มสี/ทาซ่อม',                     uom: 'm2',  costMaterial: 15,    costLabor: 30,   category: 'Defect' },
  { code: 'DEF-CAULK',    name: 'ฉาบอุดรอยร้าว',                     uom: 'm',   costMaterial: 20,    costLabor: 40,   category: 'Defect' },
  { code: 'DEF-SUPPLY',   name: 'วัสดุทำความสะอาด (ชุด)',             uom: 'set', costMaterial: 200,   costLabor: 0,    category: 'Defect' },
  { code: 'DEF-STICKER',  name: 'สติ๊กเกอร์ Defect (แดง/เขียว)',     uom: 'set', costMaterial: 50,    costLabor: 0,    category: 'Defect' },

  // --- Step 34 : Handover ---
  { code: 'HDV-DOC',      name: 'เอกสาร As-built / คู่มือบ้าน',      uom: 'set', costMaterial: 500,   costLabor: 0,    category: 'Handover' },
  { code: 'HDV-KEY',      name: 'ชุดกุญแจ (ประตูหน้า/หลัง/ห้อง)',     uom: 'set', costMaterial: 150,   costLabor: 0,    category: 'Handover' },
  { code: 'HDV-WARR',     name: 'ใบรับประกัน',                        uom: 'set', costMaterial: 100,   costLabor: 0,    category: 'Handover' },
  { code: 'HDV-DWG',      name: 'แบบ As-built Drawing',               uom: 'set', costMaterial: 300,   costLabor: 0,    category: 'Handover' },
  { code: 'HDV-MANUAL',   name: 'คู่มืออุปกรณ์',                      uom: 'set', costMaterial: 0,     costLabor: 0,    category: 'Handover' },
  { code: 'HDV-PHOTO',    name: 'ภาพถ่ายบันทึก (USB/Cloud)',          uom: 'set', costMaterial: 50,    costLabor: 0,    category: 'Handover' },
  { code: 'HDV-TRAIN',    name: 'สอนการใช้งาน 1 วัน',                uom: 'วัน',  costMaterial: 0,     costLabor: 1500, category: 'Handover' },
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
    '180': 1800,
    '210': 1950,
    '240': 2100,
    '280': 2350,
    '320': 2600,
};
