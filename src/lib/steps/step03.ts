import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 3 Contract ─────────────────────────────────────────────────────────
/** เตรียมพื้นที่หน้างาน — input fields */
export interface Step3Input {
  site_width_m: number;                // กว้างไซต์
  site_length_m: number;               // ยาวไซต์
  number_of_workers: number;           // จำนวนคนงานสูงสุด (peak)
  waste_percent: number;               // default 10
  // optional — layout ratios
  area_per_worker_m2?: number;         // พื้นที่ห้องพักต่อคน (default 2.0 ม²)
  storage_ratio?: number;              // สัดส่วนกองวัสดุ (default 0.15)
  drain_ratio?: number;                // สัดส่วนรางระบายน้ำ (default 0.35)
  // ─── cost-related (ใหม่) ────────────────────────────────
  fence_type?: 'zinc' | 'mesh' | 'concrete_block';  // ประเภทรั้ว (default zinc)
  fence_height_m?: number;             // ความสูงรั้ว (default 2.0 ม.)
  gate_count?: number;                 // จำนวนประตูทางเข้า (default 1 เมื่อมีรั้ว)
  gate_width_m?: number;               // ความกว้างประตู (default 4 ม.)
  toilet_count?: number;               // ห้องน้ำเคลื่อนที่ (default: 1 ต่อ 15 คน)
  access_road_length_m?: number;       // ทางเข้ารถ (ม.)
  access_road_width_m?: number;        // ความกว้างทางเข้า (default 4 ม.)
  rebar_work_area_m2?: number;         // พื้นที่ดัดเหล็ก/ผูกเหล็ก (ม²)
  site_sign?: boolean;                 // ป้ายโครงการ (default true)
  safety_signs_count?: number;         // จำนวนป้ายความปลอดภัย (default 0 — คิดเฉพาะเมื่อระบุ)
  construction_duration_months?: number; // ระยะเวลาก่อสร้าง (เดือน) — ใช้คำนวณค่าเช่า
  mobilization_trips?: number;         // ค่าขนย้ายเครื่องจักรเข้า (ครั้ง)
  demobilization_trips?: number;       // ค่าขนย้ายเครื่องจักรออก (ครั้ง)
}

// ─── STEP 3 — เตรียมพื้นที่หน้างาน ───────────────────────────────────────────
export function calcStep3(inp: Step3Input): StepResult {
  const {
    site_width_m, site_length_m, number_of_workers, waste_percent,
  } = inp;

  const apw    = inp.area_per_worker_m2 ?? 2.0;
  const stoRat = inp.storage_ratio      ?? 0.15;
  const draRat = inp.drain_ratio        ?? 0.35;
  const w      = 1 + waste_percent / 100;

  const fence_h = inp.fence_height_m ?? 2.0;
  // 0 = ไม่ได้ระบุ → ใช้ค่า default 4 ม.
  const gate_w  = inp.gate_width_m && inp.gate_width_m > 0 ? inp.gate_width_m : 4.0;

  // ─── Core calculations ───────────────────────────────────
  const site_area              = r2(site_width_m * site_length_m);
  const perimeter              = r2(2 * (site_width_m + site_length_m));
  // ประตู default 1 ช่องเฉพาะเมื่อมีรั้ว (มีขนาดไซต์) — ถ้าไม่มีรั้วคิดเฉพาะเมื่อผู้ใช้ระบุเอง
  const gates   = inp.gate_count ?? (perimeter > 0 ? 1 : 0);
  const fence_length           = r2(Math.max(0, perimeter - (gates * gate_w)) * w);
  const fence_area             = r2(fence_length * fence_h);
  const camp_area              = r2(number_of_workers * apw);
  const storage_area           = r2(site_area * stoRat);
  const temporary_drain_length = r2(perimeter * draRat);
  const toilet_count           = inp.toilet_count ?? Math.max(1, Math.ceil(number_of_workers / 15));

  const ft = inp.fence_type ?? 'zinc';

  const quantities: StepResult['quantities'] = {
    site_area:              { qty: site_area,              uom: 'm²',   label: 'พื้นที่ไซต์ (Site Area)' },
    perimeter:              { qty: perimeter,              uom: 'm',    label: 'เส้นรอบรั้ว (Perimeter)' },
    fence_length:           { qty: fence_length,           uom: 'm',    label: `ความยาวรั้วไซต์รวมประตู (${fence_length} ม.)` },
    fence_zinc:             { qty: ft === 'zinc' ? fence_area : 0, uom: 'm²', label: `พื้นที่รั้วสังกะสี (สูง ${fence_h} ม.)` },
    fence_mesh:             { qty: ft === 'mesh' ? fence_area : 0, uom: 'm²', label: `พื้นที่รั้วตาข่ายเหล็ก (สูง ${fence_h} ม.)` },
    fence_block:            { qty: ft === 'concrete_block' ? fence_area : 0, uom: 'm²', label: `พื้นที่รั้วบล็อกคอนกรีต (สูง ${fence_h} ม.)` },
    gate:                   { qty: gates,                  uom: 'ช่อง',  label: `ประตูทางเข้า (กว้าง ${gate_w} ม.)` },
    camp_area:              { qty: camp_area,              uom: 'm²',   label: `พื้นที่ห้องพัก (${number_of_workers} คน × ${apw} ม²)` },
    storage_area:           { qty: storage_area,           uom: 'm²',   label: 'พื้นที่กองวัสดุ (Storage)' },
    temporary_drain_length: { qty: temporary_drain_length, uom: 'm',    label: 'รางระบายน้ำชั่วคราว' },
    toilet:                 { qty: toilet_count,           uom: 'ห้อง',  label: 'ห้องน้ำเคลื่อนที่ (1:15 คน)' },
  };

  // ทางเข้ารถ
  if (inp.access_road_length_m && inp.access_road_length_m > 0) {
    const road_w = inp.access_road_width_m ?? 4;
    const road_area = r2(inp.access_road_length_m * road_w);
    quantities.access_road = {
      qty: road_area,
      uom: 'm²',
      label: `ทางเข้ารถลูกรังอัดแน่น (${inp.access_road_length_m}×${road_w} ม.)`,
    };
    // ลูกรังประมาณ 0.15 ม. หนา
    quantities.access_gravel = {
      qty: r2(road_area * 0.15 * 1.2),
      uom: 'm³',
      label: 'ลูกรังรองทาง (หนา 15 ซม. + CF 1.2)',
    };
  }

  // พื้นที่ดัดเหล็ก
  if (inp.rebar_work_area_m2 && inp.rebar_work_area_m2 > 0) {
    quantities.rebar_work_area = {
      qty: inp.rebar_work_area_m2,
      uom: 'm²',
      label: 'พื้นที่ดัดเหล็ก/ผูกเหล็ก',
    };
  }

  // ป้ายโครงการ + ป้ายความปลอดภัย
  if (inp.site_sign === true) {
    quantities.site_sign = { qty: 1, uom: 'ป้าย', label: 'ป้ายโครงการ (ชื่อ+ผู้รับเหมา+ใบอนุญาต)' };
  }
  const safety_signs = inp.safety_signs_count ?? 0;
  if (safety_signs > 0) {
    quantities.safety_signs = { qty: safety_signs, uom: 'ป้าย', label: 'ป้ายความปลอดภัย (สวมหมวก/รองเท้า/ระวังอันตราย)' };
  }

  // ค่าเช่า (ถ้ามีระยะเวลา)
  if (inp.construction_duration_months && inp.construction_duration_months > 0) {
    quantities.toilet_rental = {
      qty: r2(toilet_count * inp.construction_duration_months),
      uom: 'เดือน',
      label: `ค่าเช่าห้องน้ำ (${toilet_count} ห้อง × ${inp.construction_duration_months} เดือน)`,
    };
  }

  // ขนย้ายเครื่องจักร
  if (inp.mobilization_trips && inp.mobilization_trips > 0) {
    quantities.mobilization = {
      qty: inp.mobilization_trips,
      uom: 'ครั้ง',
      label: `ขนย้ายเครื่องจักร/แคมป์เข้าหน้างาน`,
    };
  }
  if (inp.demobilization_trips && inp.demobilization_trips > 0) {
    quantities.demobilization = {
      qty: inp.demobilization_trips,
      uom: 'ครั้ง',
      label: `รื้อถอนแคมป์/ขนย้ายเครื่องจักรออก`,
    };
  }

  // ─── Warnings ─────────────────────────────────────────────
  const warnings: string[] = [];

  if (gates > 0 && inp.gate_width_m && inp.gate_width_m > 0 && gate_w < 5.0) {
    warnings.push(`ความกว้างประตูเข้าไซต์ ${gate_w} ม. แคบเกินไป ยานพาหนะหนักเพื่อการก่อสร้างอาจประสบปัญหาในการเข้า-ออกพื้นที่ แนะนำอย่างน้อย 5.0-6.0 ม.`);
  }

  if (ft === 'mesh') {
    warnings.push('การใช้รั้วตาข่ายเหล็กไม่สามารถควบคุมการฟุ้งกระจายของฝุ่นละอองและเศษวัสดุก่อสร้างได้ หากไซต์ติดเพื่อนบ้านควรพิจารณาใช้สังกะสีทึบ');
  }

  if (!inp.construction_duration_months || inp.construction_duration_months <= 0) {
    warnings.push('ยังไม่ได้ระบุระยะเวลาก่อสร้าง (เดือน) ระบบจะไม่สามารถประเมินงบประมาณค่าเช่าสิ่งอำนวยความสะดวกรายเดือนได้');
  } else if (ft === 'zinc' && inp.construction_duration_months > 12) {
    warnings.push('สังกะสีอายุใช้งาน ~12 เดือน — โครงการยาวกว่า ควรพิจารณาเปลี่ยนเนื้อวัสดุหรือตั้งงบซ่อม');
  }

  if ((camp_area + storage_area) > (site_area * 0.50)) {
    warnings.push('ข้อสังเกต: พื้นที่พักพิงและจุดกองวัสดุมีสัดส่วนค่อนข้างสูงเมื่อเทียบกับพื้นที่โครงการ ควรพิจารณาการจัดสรรพื้นที่เพื่ออำนวยความสะดวกในการสัญจร');
  } else {
    if (storage_area > site_area * 0.30) {
      warnings.push('พื้นที่กองวัสดุ > 30% ของพื้นที่ไซต์ — อาจขวางพื้นที่ทำงาน');
    }
    if (camp_area > site_area * 0.20) {
      warnings.push('พื้นที่พักคนงาน > 20% ของไซต์ — พิจารณาลดจำนวนหรือจัดที่พักนอกไซต์');
    }
  }

  if (number_of_workers > 20 && toilet_count < 2) {
    warnings.push(`คนงาน ${number_of_workers} คน ควรมีห้องน้ำ ≥ 2 ห้อง (ปกติ 1 ห้อง / 15 คน)`);
  }

  if (!inp.access_road_length_m && site_area > 200) {
    warnings.push('ไม่ได้ระบุทางเข้ารถ — ถ้าไซต์ใหญ่ ควรเตรียมทางรถบรรทุกเข้าถึงเพื่อป้องกันรถติดหล่ม');
  }

  // ─── QC Flags ──────────────────────────────────────────────
  const qc_flags: string[] = [];

  return { quantities, warnings, qc_flags };
}
