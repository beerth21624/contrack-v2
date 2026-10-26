import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 1 Contract ─────────────────────────────────────────────────────────
export interface FillAreaEntry {
  label: string;
  width_m: number;
  length_m: number;
  average_fill_height_m: number;
  compaction_factor: number;
  soil_type?: 'selected_fill' | 'general' | 'soft' | 'sand' | 'crushed_rock';
  layer_thickness_m?: number;
}

/** ถมดิน + บดอัด — input fields */
export interface Step1Input {
  fill_areas: FillAreaEntry[];
  waste_percent: number;               // default 10 (ร่วง/สูญเสียระหว่างขนส่ง)
  // optional - pre-work clearance
  site_clearance_area_m2?: number;     // พื้นที่แผ้วถางเตรียมหน้างาน
  demolition_trips?: number;           // จำนวนเที่ยวรถบรรทุกขนเศษวัสดุทิ้ง
  // optional - machinery
  roller_productivity_m3_per_hour?: number;  // ผลผลิตเครื่องบดอัด
  // ─── cost-related inputs ────────────────────────────────
  truck_capacity_m3?: number;          // ปริมาตรรถดินต่อเที่ยว (default 12 ม³)
  haul_distance_km?: number;           // ระยะทางขนดิน (กม.) — กระทบราคาต่อเที่ยว
  backhoe_productivity_m3_per_hour?: number; // ผลผลิตรถแบ็คโฮเกลี่ย (default 25 ม³/ชม.)
  soil_test_required?: boolean;        // ทำ Field Density Test (FDT) หรือไม่
  soil_test_point_count?: number;      // จำนวนจุดทดสอบ (default: 1 จุดต่อ 500 ม²)
}

// ─── STEP 1 — ถมดิน + บดอัด ──────────────────────────────────────────────────
export function calcStep1(inp: Step1Input): StepResult {
  const {
    waste_percent,
    roller_productivity_m3_per_hour,
  } = inp;

  let total_area = 0;
  let design_volume = 0;
  let compacted_volume = 0;
  let max_layer_count = 0;
  const vol_by_soil: Record<string, number> = {
    general: 0, selected_fill: 0, soft: 0, sand: 0, crushed_rock: 0
  };

  for (const a of inp.fill_areas) {
    const area = a.width_m * a.length_m;
    const dvol = area * a.average_fill_height_m;
    const cvol = dvol * a.compaction_factor;
    const lthick = a.layer_thickness_m ?? 0.30;
    const lcnt = Math.ceil(a.average_fill_height_m / lthick);

    total_area += area;
    design_volume += dvol;
    compacted_volume += cvol;
    if (lcnt > max_layer_count) max_layer_count = lcnt;
    
    const stype = a.soil_type ?? 'general';
    vol_by_soil[stype] = (vol_by_soil[stype] ?? 0) + cvol;
  }

  total_area = r2(total_area);
  design_volume = r2(design_volume);
  compacted_volume = r2(compacted_volume);

  const applyWaste = (v: number) => r2(v * (1 + waste_percent / 100));
  const total_volume = applyWaste(compacted_volume);

  const truck_cap       = inp.truck_capacity_m3 ?? 12;
  const backhoe_prod    = inp.backhoe_productivity_m3_per_hour ?? 25;
  const truck_trips = Math.ceil(total_volume / truck_cap);
  const backhoe_hours = r2(total_volume / backhoe_prod);

  const quantities: StepResult['quantities'] = {
    area:             { qty: total_area,       uom: 'm²',     label: 'พื้นที่ถมดิน (Area)' },
    design_volume:    { qty: design_volume,    uom: 'm³',     label: 'ปริมาตรตามแบบ (Design Vol.)' },
    compacted_volume: { qty: compacted_volume, uom: 'm³',     label: 'ปริมาตรหลังคูณ CF (Compacted Vol.)' },
    total_volume:     { qty: total_volume,     uom: 'm³',     label: `ปริมาตรดินสั่งสุทธิ (incl. ${waste_percent}% waste)` },
    volume_general:   { qty: applyWaste(vol_by_soil.general ?? 0), uom: 'm³', label: 'ปริมาตรดินทั่วไป (สั่ง)' },
    volume_selected:  { qty: applyWaste(vol_by_soil.selected_fill ?? 0), uom: 'm³', label: 'ปริมาตรดินลูกรัง (สั่ง)' },
    volume_soft:      { qty: applyWaste(vol_by_soil.soft ?? 0), uom: 'm³', label: 'ปริมาตรดินอ่อน (สั่ง)' },
    volume_sand:      { qty: applyWaste(vol_by_soil.sand ?? 0), uom: 'm³', label: 'ปริมาตรทรายถม (สั่ง)' },
    volume_rock:      { qty: applyWaste(vol_by_soil.crushed_rock ?? 0), uom: 'm³', label: 'ปริมาตรหินคลุก (สั่ง)' },
    layer_count:      { qty: max_layer_count,  uom: 'ชั้น',    label: `จำนวนชั้นถม (สูงสุด)` },
    truck_trips:      { qty: truck_trips,      uom: 'เที่ยว',  label: `รถดิน (${truck_cap} ม³/เที่ยว)` },
    backhoe_hours:    { qty: backhoe_hours,    uom: 'ชม.',    label: `รถแบ็คโฮเกลี่ย (${backhoe_prod} ม³/ชม.)` },
  };

  // Roller hours (optional)
  if (roller_productivity_m3_per_hour && roller_productivity_m3_per_hour > 0) {
    quantities.roller_hours = {
      qty: r2(compacted_volume / roller_productivity_m3_per_hour),
      uom: 'ชม.',
      label: 'เครื่องบดอัด (Roller Hours)',
    };
  }

  // Site Clearance
  if (inp.site_clearance_area_m2 && inp.site_clearance_area_m2 > 0) {
    quantities.site_clearance = {
      qty: inp.site_clearance_area_m2,
      uom: 'm²',
      label: 'พื้นที่แผ้วถางเตรียมหน้างาน',
    };
  }
  if (inp.demolition_trips && inp.demolition_trips > 0) {
    quantities.demolition_debris = {
      qty: inp.demolition_trips,
      uom: 'เที่ยว',
      label: 'รื้อถอนและขนเศษวัสดุทิ้ง',
    };
  }

  // Haul distance info
  if (inp.haul_distance_km) {
    quantities.haul_info = {
      qty: inp.haul_distance_km,
      uom: 'กม.',
      label: 'ระยะขนส่งดิน (กระทบค่าขนส่ง)',
    };
  }

  // Soil test points
  if (inp.soil_test_required) {
    const test_points = inp.soil_test_point_count ?? Math.max(1, Math.ceil(total_area / 500));
    quantities.soil_test_points = {
      qty: test_points * max_layer_count,
      uom: 'จุด',
      label: `จุดทดสอบ FDT (${test_points} จุด × ${max_layer_count} ชั้น)`,
    };
  }

  // ─── Warnings ─────────────────────────────────────────────
  const warnings: string[] = [];
  let hasSoftSoil = false;
  let hasHighFill = false;
  let hasCriticalFill = false;
  let hasLowCF = false;

  for (const a of inp.fill_areas) {
    if (a.average_fill_height_m > 1.0) hasHighFill = true;
    if (a.average_fill_height_m > 2.0) hasCriticalFill = true;
    if (a.soil_type === 'soft') hasSoftSoil = true;
    if (a.compaction_factor < 1.20) hasLowCF = true;
  }

  if (hasCriticalFill) {
    warnings.push('ควรถมดินสูงเกิน 2.0 เมตร เสี่ยงเรื่องดินสไลด์และดินทรุดตัวรุนแรง แนะนำให้ปรึกษาวิศวกรโครงสร้างเรื่องกำแพงกันดิน');
  } else if (hasHighFill) {
    warnings.push('มีการถมสูงเกิน 1.0 เมตร — ระบบจะคำนวณการถมเป็นชั้น (ไม่เกิน 0.30 ม./ชั้น) โปรดตรวจสอบราคาเครื่องจักรบดอัดเพิ่มเติม');
  }

  if (hasSoftSoil) {
    warnings.push('คุณเลือกใช้ดินอ่อน (Soft Soil) แม้จะราคาถูก แต่เสี่ยงต่อการทรุดตัว แนะนำให้เปลี่ยนเป็นดินลูกรัง หรือมีแผนปรับปรุงคุณภาพดิน');
  }

  if (hasLowCF) {
    warnings.push('มีการกำหนดค่าการยุบตัว (Compaction Factor) ต่ำกว่า 1.20 ซึ่งโดยปกติดินทั่วไปเมื่อบดอัดจะยุบตัว 25-40% ระวังดินขาดหน้างาน');
  }

  if (waste_percent < 5) {
    warnings.push('ค่าเผื่อสูญเสีย (Waste) < 5% อาจน้อยเกินไป ปกติควรเผื่อดินร่วงหล่นระหว่างขนส่ง 5-15%');
  }

  if (!inp.soil_test_required && total_area > 200) {
    warnings.push('พื้นที่รวม > 200 ม² แต่ไม่ได้ตั้งงบเพื่อทำ Field Density Test ระวังความเสี่ยงพื้นทรุดตัวและงานแก้ที่แพงกว่าค่าทดสอบ');
  }

  if (inp.haul_distance_km && inp.haul_distance_km > 20) {
    warnings.push(`ระยะขนดิน ${inp.haul_distance_km} กม. — ค่าขนส่งจะสูงมาก แนะนำให้สำรวจหาแหล่งดินที่ใกล้กว่าเพื่อลดต้นทุน`);
  }

  // ─── QC Flags ──────────────────────────────────────────────
  const qc_flags: string[] = [];

  return { quantities, warnings, qc_flags };
}
