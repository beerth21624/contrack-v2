import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 2 Contract ─────────────────────────────────────────────────────────
/** เดินน้ำ–ไฟชั่วคราว — input fields */
export interface Step2Input {
  distance_to_power_source_m: number;  // ระยะจากมิเตอร์ถึงไซต์ (ม.)
  distance_to_water_source_m: number;  // ระยะจากมิเตอร์น้ำ/แหล่งน้ำ (ม.)
  waste_percent: number;               // default 10
  // optional — electrical
  number_of_sockets?: number;          // จำนวนปลั๊กไฟ
  number_of_lights?: number;           // จำนวนโคมไฟ
  main_breaker_amp?: number;           // ขนาด MCB หลัก (A)
  site_area_m2?: number;               // พื้นที่ไซต์ (ม²)
  // ─── cost-related (ใหม่) ────────────────────────────────
  cable_size_sqmm?: number;            // ขนาดสายไฟ (ม²ม.) — auto จาก breaker ถ้าไม่ระบุ
  pipe_type?: 'pe' | 'pvc';           // ประเภทท่อน้ำ (default PE)
  pipe_diameter_mm?: number;           // ขนาดท่อน้ำ (default 25 มม.)
  ground_rod_count?: number;           // จำนวนสายดิน (default 1)
  water_tank_liters?: number;          // ถังเก็บน้ำชั่วคราว (ลิตร)
  electric_meter_type?: '1P-15A' | '1P-30A' | '3P-30A';
  water_meter_type?: '1/2' | '3/4';
  permit_required?: boolean;           // ต้องขออนุญาตราชการไหม (default true)
}

// ─── Cable size lookup by breaker amp ──────────────────────
const CABLE_SIZE_BY_AMP: Record<number, number> = {
  15: 2.5, 20: 4, 30: 10, 32: 10, 40: 16, 45: 16, 50: 25, 60: 35, 63: 35, 100: 70,
};

// ─── STEP 2 — เดินน้ำ–ไฟชั่วคราว ─────────────────────────────────────────────
export function calcStep2(inp: Step2Input): StepResult {
  const {
    distance_to_power_source_m, distance_to_water_source_m,
    waste_percent, site_area_m2,
  } = inp;

  const w = 1 + waste_percent / 100;

  const pipe_type_label = inp.pipe_type === 'pvc' ? 'PVC' : 'PE';
  const pipe_diam = inp.pipe_diameter_mm ?? 25;

  // ─── Electrical ──────────────────────────────────────────
  const cable_size   = inp.cable_size_sqmm ?? (inp.main_breaker_amp ? CABLE_SIZE_BY_AMP[inp.main_breaker_amp] ?? 10 : 10);
  const cable_length = r2(distance_to_power_source_m * w);
  // ท่อร้อยสาย ยาวกว่าสายเพราะมีข้อโค้ง
  const conduit_length = r2(distance_to_power_source_m * w * 1.15);
  const db_required    = site_area_m2 ? Math.ceil(site_area_m2 / 400) : 1;
  const ground_rods    = inp.ground_rod_count ?? 1;

  // ─── Water ───────────────────────────────────────────────
  const water_pipe_length = r2(distance_to_water_source_m * w);
  // ข้อต่อ: ประมาณ 1 ชุดทุก 6 ม. + 2 (ปลายทาง)
  const fittings_count = Math.ceil(water_pipe_length / 6) + 2;
  // วาล์ว: อย่างน้อย 1 ตัว (ปิด-เปิดที่หน้ามิเตอร์)
  const valve_count = Math.max(1, Math.ceil(water_pipe_length / 50));

  const quantities: StepResult['quantities'] = {
    cable_length:      { qty: cable_length,      uom: 'm',    label: `สายไฟ THW ${cable_size} ม²ม.` },
    conduit_length:    { qty: conduit_length,     uom: 'm',    label: 'ท่อร้อยสาย (Conduit +15% โค้ง)' },
    water_pipe_length: { qty: water_pipe_length,  uom: 'm',    label: `ท่อน้ำ ${pipe_type_label} Ø${pipe_diam} มม.` },
    fittings:          { qty: fittings_count,     uom: 'ชุด',   label: 'ข้อต่อ/ข้อโค้ง/ข้องอ ท่อน้ำ' },
    valves:            { qty: valve_count,        uom: 'ตัว',   label: 'ก๊อกน้ำ / วาล์วปิด-เปิด' },
    db_required:       { qty: db_required,        uom: 'ตู้',   label: 'ตู้ไฟชั่วคราว (DB)' },
    ground_rod:        { qty: ground_rods,        uom: 'ต้น',   label: 'แท่งกราวด์ (Ground Rod)' },
  };

  if (inp.number_of_sockets && inp.number_of_sockets > 0) {
    quantities.outlet_boxes = { qty: inp.number_of_sockets, uom: 'จุด', label: 'จุดปลั๊กไฟ (Outlet)' };
  }
  if (inp.number_of_lights && inp.number_of_lights > 0) {
    quantities.light_points = { qty: inp.number_of_lights, uom: 'จุด', label: 'จุดโคมไฟ (Light Point)' };
  }
  if (inp.water_tank_liters && inp.water_tank_liters > 0) {
    quantities.water_tank = { qty: inp.water_tank_liters, uom: 'ลิตร', label: 'ถังเก็บน้ำชั่วคราว' };
  }
  if (inp.electric_meter_type) {
    if (inp.electric_meter_type === '1P-15A') quantities.meter_e15 = { qty: 1, uom: 'ชุด', label: 'มิเตอร์ไฟ 1P 15(45)A' };
    if (inp.electric_meter_type === '1P-30A') quantities.meter_e30 = { qty: 1, uom: 'ชุด', label: 'มิเตอร์ไฟ 1P 30(100)A' };
    if (inp.electric_meter_type === '3P-30A') quantities.meter_e3p = { qty: 1, uom: 'ชุด', label: 'มิเตอร์ไฟ 3P 30(100)A' };
  }
  if (inp.water_meter_type) {
    if (inp.water_meter_type === '1/2') quantities.meter_w15 = { qty: 1, uom: 'ชุด', label: 'มิเตอร์น้ำ 1/2 นิ้ว' };
    if (inp.water_meter_type === '3/4') quantities.meter_w20 = { qty: 1, uom: 'ชุด', label: 'มิเตอร์น้ำ 3/4 นิ้ว' };
  }
  if (inp.permit_required == false) {
    quantities.permit = { qty: 1, uom: 'ชุด', label: 'ค่าธรรมเนียมขออนุญาต' };
  }

  // ─── Warnings ─────────────────────────────────────────────
  const warnings: string[] = [];

  if (inp.electric_meter_type === '1P-15A') {
    warnings.push('มิเตอร์ไฟ 1P 15(45)A อาจเล็กเกินไปหากมีตู้เชื่อมไฟหน้างานหลายตู้ (เสี่ยงเบรกเกอร์ทริป/ไฟตก) แนะนำพิจารณา 1P 30(100)A');
  }

  if (!inp.main_breaker_amp) {
    warnings.push('ยังไม่ได้ระบุ Main Breaker Amp — ควรประเมินโหลดเครื่องจักรหน้างานก่อนติดตั้งตู้ชั่วคราว');
  } else if (inp.main_breaker_amp >= 60 && cable_size < 35) {
    warnings.push(`โหลดเบรกเกอร์ ${inp.main_breaker_amp}A ควรใช้สายขนาด ≥ 35 ม²ม.`);
  }

  if (distance_to_power_source_m > 50 && cable_size < 16) {
    warnings.push(`ระยะลากสาย ${distance_to_power_source_m} ม. แนะนำให้ใช้สายไฟขนาด 16 sq.mm ขึ้นไป เพื่อป้องกันปัญหาแรงดันไฟตก (Voltage Drop)`);
  }

  if (waste_percent < 10) {
    warnings.push('ค่าเผื่อสายไฟ (Waste) < 10% อาจน้อยเกินไป ปกติการเดินพาดเสา/เข้าตู้จะเสียระยะ แนะนำเผื่อ 10-15%');
  }

  if (inp.pipe_type === 'pvc') {
    warnings.push('เลือกใช้ท่อ PVC สำหรับประปาชั่วคราว หากไม่ฝังดิน ระวังท่อแตกเมื่อถูกเหยียบหรือคนงานเดินเตะ แนะนำพิจารณาท่อ PE');
  }

  if (inp.water_tank_liters && distance_to_water_source_m > 50) {
    warnings.push('ไม่ได้ระบุถังสำรองน้ำ ถ้าระยะแหล่งน้ำ > 50 ม. น้ำอาจไหลอ่อนหรือประปาไม่ขยับ ควรมีถังพักน้ำอย่างน้อย 1,000 ลิตร');
  }

  // ─── QC Flags ──────────────────────────────────────────────
  const qc_flags: string[] = [];

  if (inp.main_breaker_amp) {

  }

  return { quantities, warnings, qc_flags };
}
