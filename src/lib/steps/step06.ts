import { type StepResult } from '@/types';
import { r2, EXCAVATION_MARGIN, SAND_WASTE_FACTOR } from './helpers';
import { type ConcreteGrade } from '@/data/price-list';

// ─── Step 6 Contract ─────────────────────────────────────────────────────────
/** ฐานรากแต่ละ Type (เช่น F1, F2, F3 จาก Footing Schedule) */
export interface FootingEntry {
  label: string;                       // ป้าย เช่น "F1", "F2"
  count: number;                       // จำนวนฐานรากชนิดนี้
  length_m: number;                    // ความยาว L (ม.)
  width_m: number;                     // ความกว้าง W (ม.)
  thickness_m: number;                 // ความหนา T (ม.)
}

/** ทำฐานราก (Footing) — input fields */
export interface Step6Input {
  footings: FootingEntry[];            // รายการฐานรากแต่ละ Type
  lean_concrete_thickness_m: number;   // default 0.05
  sand_bedding_thickness_m: number;    // default 0.05
  waste_percent: number;               // default 5
  concrete_grade?: ConcreteGrade;      // default '240'
  // optional — basic
  excavation_extra_margin_m?: number;  // default 0.40
  excavation_depth_m?: number;
  rebar_weight_kg_per_m3?: number;     // 80–140
  formwork_factor?: number;            // m² of formwork per footing (override)
  pedestal_volume_m3?: number;
  // ─── cost-related ────────────────────────────────
  concrete_pump_required?: boolean;
  dewatering_required?: boolean;
  dewatering_days?: number;
  curing_method?: 'water' | 'plastic' | 'compound';
  vibrator_days?: number;
  tie_wire_factor?: number;            // ลวดผูก (กก. ต่อ 100 กก. เหล็ก) default 1.5
  spacer_per_footing?: number;         // ลูกปูน/spacer ต่อฐาน (default 4)
  direct_rebar_kg?: number;            // น้ำหนักเหล็กตรงจาก Bar Schedule (bypass ratio)
}

// ─── STEP 6 — ทำฐานราก ───────────────────────────────────────────────────────
export function calcStep6(inp: Step6Input): StepResult {
  const { footings, lean_concrete_thickness_m: Tlean,
    sand_bedding_thickness_m: Tsand, waste_percent } = inp;
  const wf = 1 + waste_percent / 100;
  const mg = inp.excavation_extra_margin_m ?? EXCAVATION_MARGIN;

  // ─── Aggregate across all footing types ─────────────────
  let totalN = 0;
  let totalArea = 0;
  let totalConcreteVol = 0;
  let totalLeanVol = 0;
  let totalSandVol = 0;
  let totalFormwork = 0;
  let totalExcVol = 0;

  for (const f of footings) {
    const { count: n, length_m: L, width_m: W, thickness_m: T } = f;
    totalN += n;
    totalArea += n * L * W;
    totalConcreteVol += n * L * W * T;

    const Lexc = L + 2 * mg;
    const Wexc = W + 2 * mg;
    totalLeanVol += n * Lexc * Wexc * Tlean;
    totalSandVol += n * Lexc * Wexc * Tsand * SAND_WASTE_FACTOR;

    if (inp.formwork_factor) {
      totalFormwork += n * inp.formwork_factor;
    } else {
      totalFormwork += n * 2 * (L + W) * T;
    }

    if (inp.excavation_depth_m) {
      totalExcVol += n * Lexc * Wexc * inp.excavation_depth_m;
    }
  }

  const concrete_volume = r2(totalConcreteVol * wf);
  const lean_volume = r2(totalLeanVol);
  const sand_volume = r2(totalSandVol);

  // ─── Build label summary ────────────────────────────────
  const typeSummary = footings.map(f => `${f.label} ${f.count} ตัว`).join(', ');

  const grade = inp.concrete_grade ?? '240';

  const quantities: StepResult['quantities'] = {
    footing_area:    { qty: r2(totalArea),   uom: 'm²', label: `พื้นที่ฐานรากรวม (${typeSummary})` },
    concrete_volume: { qty: concrete_volume, uom: 'm³', label: `คอนกรีต ${grade} ksc (waste ${waste_percent}%)` },
    lean_volume:     { qty: lean_volume,     uom: 'm³', label: `ลีน 1:3:5 ใต้ฐาน (หนา ${r2(Tlean * 100)} ซม.)` },
    sand_volume:     { qty: sand_volume,     uom: 'm³', label: `ทรายรองใต้ฐาน (×${SAND_WASTE_FACTOR})` },
  };

  // ─── ขุดดิน + ดินถมกลับ ─────────────────────────────────
  if (inp.excavation_depth_m) {
    const excVol = r2(totalExcVol);
    quantities.excavation_volume = { qty: excVol, uom: 'm³', label: `ขุดดินฐานราก (ลึก ${inp.excavation_depth_m} ม.)` };
    const pedestal = inp.pedestal_volume_m3 ?? 0;
    const backfill = r2(Math.max(0, excVol - sand_volume - lean_volume - concrete_volume - pedestal));
    quantities.backfill_volume = { qty: backfill, uom: 'm³', label: 'ดินถมกลับ' };
  }

  // ─── ไม้แบบ ──────────────────────────────────────────────
  quantities.formwork_m2 = { qty: r2(totalFormwork), uom: 'm²', label: 'ไม้แบบฐานราก' };

  // ─── เหล็กเสริม ─────────────────────────────────────────
  let totalRebarKg = 0;
  if (inp.direct_rebar_kg) {
    totalRebarKg = inp.direct_rebar_kg;
    quantities.rebar_kg = { qty: r2(totalRebarKg), uom: 'kg', label: 'เหล็กเสริม (จาก Bar Schedule)' };
  } else if (inp.rebar_weight_kg_per_m3) {
    totalRebarKg = totalConcreteVol * inp.rebar_weight_kg_per_m3;
    quantities.rebar_kg = { qty: r2(totalRebarKg), uom: 'kg', label: `เหล็กเสริม (${inp.rebar_weight_kg_per_m3} kg/m³)` };
  }

  // ─── ลวดผูกเหล็ก ────────────────────────────────────────
  if (totalRebarKg > 0) {
    const tieWireFactor = inp.tie_wire_factor ?? 1.5;
    const tieWire = r2(totalRebarKg * tieWireFactor / 100);
    quantities.tie_wire = { qty: tieWire, uom: 'kg', label: `ลวดผูกเหล็ก (${tieWireFactor}% ของเหล็ก)` };
  }

  // ─── ลูกปูน Spacer ──────────────────────────────────────
  const spacerCount = inp.spacer_per_footing ?? 4;
  quantities.spacer = { qty: totalN * spacerCount, uom: 'pcs', label: `ลูกปูน Spacer (${spacerCount} ตัว/ฐาน)` };

  // ─── ปั๊มคอนกรีต ────────────────────────────────────────
  if (inp.concrete_pump_required) {
    const pumpDays = Math.max(1, Math.ceil(concrete_volume / 30));
    quantities.concrete_pump = { qty: pumpDays, uom: 'วัน', label: `ปั๊มคอนกรีต (${concrete_volume} ม³)` };
  }

  // ─── สูบน้ำ Dewatering ──────────────────────────────────
  if (inp.dewatering_required) {
    const dewDays = inp.dewatering_days ?? Math.max(1, Math.ceil(totalN / 5));
    quantities.dewatering = { qty: dewDays, uom: 'วัน', label: 'ค่าเช่าปั๊มสูบน้ำ + น้ำมัน' };
  }

  // ─── เครื่องจี้คอนกรีต ──────────────────────────────────
  const vibDays = inp.vibrator_days ?? Math.max(1, Math.ceil(totalN / 10));
  quantities.vibrator = { qty: vibDays, uom: 'วัน', label: `เครื่องจี้คอนกรีต (Vibrator)` };

  // ─── บ่มคอนกรีต ─────────────────────────────────────────
  const curing = inp.curing_method ?? 'water';
  const curingLabels = {
    water: 'รดน้ำบ่ม 7 วัน', plastic: 'พลาสติกปิดบ่ม', compound: 'น้ำยาบ่มคอนกรีต (Curing Compound)',
  } as const;
  if (curing === 'plastic') {
    const label = curingLabels[curing];
    quantities.curing = { qty: r2(totalArea * 1.2), uom: 'm²', label: `${label} (+20% overlap)` };
  } else if (curing === 'compound') {
    const label = curingLabels[curing];
    quantities.curing = { qty: r2(totalArea), uom: 'm²', label };
  }

  // ─── Warnings ─────────────────────────────────────────────
  const warnings: string[] = [];
  const warningFields: string[] = [];
  if (footings.length === 0) warnings.push('ยังไม่ได้เพิ่มประเภทฐานราก (F1, F2...) กรุณากดปุ่ม "+ เพิ่มประเภทฐานราก" เพื่อเริ่มคำนวณ');
  
  if (Tlean < 0.05) warnings.push('คอนกรีตหยาบ (ลีน) หนา < 0.05 ม. — บางเกินไปในการปรับระดับใต้ฐาน แนะนำ 0.05–0.10 ม.');
  
  if (waste_percent < 5) warnings.push('การเทฐานรากใต้ดินมักจะเกิดเรื่องดินถล่มปนปูน หรือคอนกรีตชิ้นบากล้นแบบ (Overbreak) แนะนำเผื่อ Waste คอนกรีตอย่างน้อย 5-10%');

  for (const f of footings) {
    if (f.thickness_m > 0.50) warnings.push(`ฐานราก ${f.label} หนา > 0.50 ม. (Mass Concrete) — อาจมีความร้อนสะสมสูง ควรปรึกษาวิธีผสมและการบ่ม`);
  }

  if (concrete_volume > 20 && inp.concrete_pump_required) {
    warnings.push(`ปริมาณคอนกรีต ${concrete_volume} ม³ ถือว่าเยอะมาก หากเทด้วยคนงานผสมหรือตัก อาจเสี่ยงเกิด รอยต่อคอนกรีต (Cold Joint) แนะนำให้เช่าปั๊มคอนกรีต`);
  }

  if (inp.excavation_depth_m && inp.excavation_depth_m >= 1.0 && inp.dewatering_required) {
    warnings.push(`ขุดหลุมลึก ≥ 1.0 ม. ดินชั้นล่างมักมีน้ำซึมออก หรือเสี่ยงน้ำขังช่วงฝนตก ควรเผื่องบ "เครื่องสูบน้ำ (Dewatering)" ไว้เสมอ`);
  }

  if (inp.rebar_weight_kg_per_m3) {
    if (inp.rebar_weight_kg_per_m3 < 70) {
        warnings.push('ระบุอัตราส่วนปริมาณเหล็กต่อคิว ต่ำกว่า 70 kg/m³ ซึ่งน้อยมากสำหรับงานฐานราก อาจคำนวณน้ำหนักเหล็กเส้นผิด โปรดเช็คแบบอีกครั้ง');
        warningFields.push('rebar_weight_kg_per_m3');
    } else if (inp.rebar_weight_kg_per_m3 > 150) {
        warnings.push('ข้อสังเกตเชิงวิศวกรรม: อัตราส่วนเหล็กสูงเกิน 150 kg/m³ ซึ่งหนาแน่นระดับตึกสูง อาคารพักอาศัยปกติจะอยู่แค่ 70-100 kg/m³ เสนอให้ตรวจสอบเพื่อไม่ให้ราคาประมูลแพงเกินจริง');
        warningFields.push('rebar_weight_kg_per_m3');
    }
  }

  if (inp.excavation_depth_m && inp.excavation_depth_m > 1.5) {
    warnings.push('ขุดหลุมลึก > 1.5 ม. — อันตรายดินถล่มทับช่าง ต้องพิจารณาตั้งงบทำระบบป้องกันดินพัง (Shoring/Sheet Pile)');
  }

  // ─── QC Flags ──────────────────────────────────────────────
  const qc_flags: string[] = [];

  return { quantities, warnings, qc_flags, warningFields };
}
