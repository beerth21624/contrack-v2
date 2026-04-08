import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 0 Contract ─────────────────────────────────────────────────────────
/** ตรวจสอบที่ดิน / หมุดหลัก — input fields */
export interface Step0Input {
  land_area_m2: number;                // พื้นที่ที่ดิน (ม²)
  boundary_length_m: number;           // ความยาวเขตที่ดินรวม (ม.)
  benchmark_count: number;             // จำนวนหมุด BM ที่ต้องตั้ง (default 2)
  survey_crew_count: number;           // จำนวนชุดสำรวจ (default 1)
  waste_percent: number;               // default 0 (ไม่ค่อยมี waste สำหรับงาน survey)
  // optional
  topo_required?: boolean;             // ต้องทำ Topo Survey ไหม
  existing_boundary_markers?: number;  // มีหมุดเขตเดิมกี่จุด
  equipment_type?: 'total_station' | 'gps_rtk' | 'level_only' | 'none';
  photo_documentation?: boolean;       // ถ่ายรูปสภาพที่ดินก่อนเริ่มงาน
}

// ─── STEP 0 — ตรวจสอบที่ดิน / หมุดหลัก ──────────────────────────────────────
export function calcStep0(inp: Step0Input): StepResult {
  const {
    land_area_m2, boundary_length_m, benchmark_count,
    survey_crew_count,
  } = inp;

  // Survey days estimation: ~2,000 m² / day for topo, boundary walk ~500 m/day
  // ปรับให้รวมปริมาณงานก่อนค่อยปัดเศษ เพื่อไม่ให้โครงการเล็กโดนปัดวันเบิ้ล (เช่น 0.2 + 0.1 = 0.3 -> 1 วัน)
  const boundary_raw_days = boundary_length_m / 500;
  const topo_raw_days = inp.topo_required ? (land_area_m2 / 2000) : 0;
  const total_survey_days = Math.max(1, Math.ceil(boundary_raw_days + topo_raw_days));

  // Man-days = crew × days
  const survey_man_days = total_survey_days * survey_crew_count * 2; // 2 คนต่อชุด (surveyor + rod man)

  // Boundary markers to check/install
  // ปกติ หมุดเขตทุก ~20-30 ม. ตามมุมที่ดิน + หมุดกลาง
  // กรณีระบุ 0 แสดงว่าไม่มีหมุดเลย (ต้องให้กรมที่ดินมารังวัดชี้จุดใหม่หมด) 
  // แต่หน้างานเรายังต้องเตรียมหมุด/หลักไม้มาตอกมาร์คพอยิงจุด
  const is_new_survey_needed = inp.existing_boundary_markers === 0;
  const expected_markers = (inp.existing_boundary_markers !== undefined && inp.existing_boundary_markers > 0)
    ? inp.existing_boundary_markers 
    : Math.ceil(boundary_length_m / 25) + 4; // +4 มุม
  
  // คำนวณ Waste สำหรับหมุด BM เผื่อแตกหัก/สูญหายหน้างาน
  const waste_multiplier = 1 + (inp.waste_percent / 100);
  const total_benchmarks = Math.ceil(benchmark_count * waste_multiplier);
  const total_expected_markers = Math.ceil(expected_markers * waste_multiplier);

  const quantities: StepResult['quantities'] = {
    total_survey_days: {
      qty: total_survey_days,
      uom: 'วัน',
      label: 'จำนวนวันสำรวจรวม',
    },
    survey_man_days: {
      qty: survey_man_days,
      uom: 'คน-วัน',
      label: `ค่าแรงสำรวจ (${survey_crew_count} ชุด × 2 คน/ชุด)`,
    },
    benchmark_points: {
      qty: total_benchmarks,
      uom: 'จุด',
      label: `หมุด BM คอนกรีต (เผื่อ ${inp.waste_percent}%)`,
    },
    boundary_markers: {
      qty: total_expected_markers,
      uom: 'จุด',
      label: `หมุด/หลักไม้ ตีไลน์เขตที่ดิน (เผื่อ ${inp.waste_percent}%)`,
    },
  };

  if (is_new_survey_needed) {
    quantities.land_dept_survey_fee = {
      qty: 1,
      uom: 'แปลง',
      label: 'ค่าธรรมเนียมรังวัดสอบเขต (กรมที่ดิน)',
    };
  }

  if (inp.topo_required) {
    quantities.topo_area = {
      qty: r2(land_area_m2),
      uom: 'm²',
      label: 'พื้นที่ Topo Survey',
    };
    quantities.topo_days = {
      // โชว์วันที่คำนวณแยกเฉพาะ Topo เป็นข้อมูลประกอบ
      qty: Math.max(0.5, Math.ceil(topo_raw_days * 2) / 2),
      uom: 'วัน',
      label: 'จำนวนวัน Topo Survey (ประมาณการ)',
    };
  }

  if (inp.equipment_type && inp.equipment_type == 'none') {
    const eqLabel: Record<string, string> = {
      total_station: 'กล้อง Total Station',
      gps_rtk: 'GPS RTK',
      level_only: 'กล้องระดับ (Auto Level)',
    };
    quantities.equipment_rental = {
      qty: total_survey_days,
      uom: 'วัน',
      label: `ค่าเช่าอุปกรณ์ — ${eqLabel[inp.equipment_type]}`,
    };
  }

  if (inp.photo_documentation) {
    quantities.photo_doc = {
      qty: 1,
      uom: 'ชุด',
      label: 'ถ่ายภาพสภาพที่ดินก่อนเริ่มงาน',
    };
  }

  const warnings: string[] = [];
  if (inp.topo_required && land_area_m2 > 400) {
    warnings.push('ที่ดิน > 400 ม² ควรทำ Topo Survey เพื่อคำนวณดินถม Step 1 ได้แม่นยำ');
  }
  if (benchmark_count < 2) {
    warnings.push('ควรตั้ง BM อย่างน้อย 2 จุด เพื่อ cross-check ระดับ');
  }
  if ((inp.existing_boundary_markers ?? 0) === 0) {
    warnings.push('ไม่มีหมุดเขตเดิม — ต้องประสานเจ้าหน้าที่กรมที่ดินรังวัดใหม่');
  }
  if (inp.topo_required && inp.equipment_type === 'none') {
    warnings.push('ตั้งค่าทำ Topo Survey แต่ระบุอุปกรณ์เป็น "ไม่มี" (ระบบถือว่าผู้รับเหมามีกล้องของตัวเองแล้ว)');
  }
  if (inp.topo_required && inp.equipment_type === 'level_only') {
    warnings.push('กล้องระดับ (Auto Level) ไม่สามารถทำ Topo Survey ได้ ควรใช้ Total Station หรือ GPS RTK แทน');
  }

  const qc_flags: string[] = [];

  return { quantities, warnings, qc_flags };
}
