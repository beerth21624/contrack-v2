import { type StepResult } from '@/types';
import { r2, EXCAVATION_MARGIN, SAND_WASTE_FACTOR, LEAN_WASTE, SAND_BOQ_WASTE } from './helpers';
import { type ConcreteGrade } from '@/data/price-list';
import { 
    computeStructuralQuantities, 
    StructuralSpecParams 
} from '@/lib/engines/structural-engine';

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
  concrete_grade?: ConcreteGrade;      // @deprecated Legacy
  structural_spec?: StructuralSpecParams; // Core specs
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
  // net volumes; BOQ adds Excel waste on material only (lean 10%, sand 30%)
  const lean_volume = r2(totalLeanVol);
  const sand_volume = r2(totalSandVol);

  // ─── Build label summary ────────────────────────────────
  const typeSummary = footings.map(f => `${f.label} ${f.count} ตัว`).join(', ');

  // ─── Structural Engine Hook ────────────────────────────────
  // Fallback map legacy "240" to numeric 240
  const kscMapping: Record<string, number> = { '180': 180, '210': 210, '240': 240, '280': 280, '300': 300, '320': 320, '350': 350 };
  const legacyKsc = inp.concrete_grade ? (kscMapping[inp.concrete_grade] ?? 240) : 240;
  
  const specParams: StructuralSpecParams = inp.structural_spec ?? {
    ksc: legacyKsc,
    waterproof: false,
    workLevel: 'GRND',
    formworkType: 'GRND',
  };
  
  // Set explicit overrides for Footing
  specParams.workLevel = 'GRND';
  specParams.formworkType = 'GRND';
  specParams.concrete_waste_percent = waste_percent;
  // Use user-defined tie wire/spacer overrides in the step if provided, else let engine calculate defaults
  
  // Rebar computation
  let totalRebarKg = 0;
  if (inp.direct_rebar_kg) {
    totalRebarKg = inp.direct_rebar_kg;
  } else if (inp.rebar_weight_kg_per_m3) {
    totalRebarKg = totalConcreteVol * inp.rebar_weight_kg_per_m3;
  }

  const strRes = computeStructuralQuantities({
    concrete_volume_m3: totalConcreteVol,
    formwork_area_m2: totalFormwork,
    rebar_weight_kg: totalRebarKg,
  }, specParams);

  // Re-apply Step specific UI quantity outputs 
  const quantities: StepResult['quantities'] = {
    footing_area:    { qty: r2(totalArea),   uom: 'm²', label: `พื้นที่ฐานรากรวม (${typeSummary})` },
    lean_volume:     { qty: r2(lean_volume * (1 + LEAN_WASTE)), labQty: lean_volume, uom: 'm³', label: `ลีน 1:3:5 ใต้ฐาน (หนา ${r2(Tlean * 100)} ซม., เผื่อ ${LEAN_WASTE * 100}%)`, sku: 'CON-LEAN' },
    sand_volume:     { qty: r2(sand_volume * (1 + SAND_BOQ_WASTE)), labQty: sand_volume, uom: 'm³', label: `ทรายรองใต้ฐาน (×${SAND_WASTE_FACTOR}, เผื่อ ${SAND_BOQ_WASTE * 100}%)`, sku: 'FTG-SAND' },
    
    // Core engine mapped
    concrete_volume: { qty: r2(strRes.conc_gross_m3), uom: 'm³', label: `คอนกรีตฐานราก ${specParams.ksc} ksc (waste ${waste_percent}%)`, sku: strRes.conc_sku },
    pour_labor:      { qty: r2(strRes.pour_labor_m3), uom: 'm³', label: `ค่าแรงเทคอนกรีต ฐานราก (ระดับดิน)`, sku: strRes.pour_labor_sku },
    formwork_m2:     { qty: r2(strRes.fw_area_m2),    uom: 'm²', label: 'ไม้แบบฐานราก', sku: strRes.fw_sku },
  };

  if (strRes.conc_admix_wp_m3) {
    quantities.waterproof_admix = { qty: r2(strRes.conc_admix_wp_m3), uom: 'm³', label: `น้ำยากันซึมผสมคอนกรีต`, sku: 'CON-ADMIX-WP' };
  }

  // ─── ขุดดิน + ดินถมกลับ ─────────────────────────────────
  if (inp.excavation_depth_m) {
    const excVol = r2(totalExcVol);
    quantities.excavation_volume = { qty: excVol, uom: 'm³', label: `ขุดดินฐานราก (ลึก ${inp.excavation_depth_m} ม.)`, sku: 'FTG-EXC' };
    const pedestal = inp.pedestal_volume_m3 ?? 0;
    // Excel: backfill = excavation − sand − lean − net footing concrete − pedestal
    const concrete_core_vol = r2(strRes.conc_net_m3);
    const backfill = r2(Math.max(0, excVol - sand_volume - lean_volume - concrete_core_vol - pedestal));
    quantities.backfill_volume = { qty: backfill, uom: 'm³', label: 'ดินถมกลับ', sku: 'FTG-FILL' };
  }

  // ─── เหล็กเสริม ─────────────────────────────────────────
  if (totalRebarKg > 0) {
    quantities.rebar_kg = { qty: r2(strRes.rb_gross_kg), labQty: r2(strRes.rb_net_kg), uom: 'kg', label: `เหล็กเสริมฐานราก ${inp.direct_rebar_kg ? '(ตาม BS)' : `(${inp.rebar_weight_kg_per_m3} kg/m³)`} (รวม Waste)`, sku: 'FTG-REBAR' };
    
    // Tie Wire
    if (inp.tie_wire_factor !== undefined) {
        // User override
        const tieWire = r2(strRes.rb_gross_kg * inp.tie_wire_factor / 100);
        quantities.tie_wire = { qty: tieWire, uom: 'kg', label: `ลวดผูกเหล็ก (${inp.tie_wire_factor}% ของเหล็ก)`, sku: 'RB-WIRE' };
    } else {
        quantities.tie_wire = { qty: r2(strRes.rb_wire_kg), uom: 'kg', label: `ลวดผูกเหล็ก ทั่วไป`, sku: 'RB-WIRE' };
    }
  }

  // ─── ลูกปูน Spacer ──────────────────────────────────────
  if (inp.spacer_per_footing !== undefined) {
      quantities.spacer = { qty: totalN * inp.spacer_per_footing, uom: 'pcs', label: `ลูกปูน Spacer (${inp.spacer_per_footing} ตัว/ฐาน)`, sku: 'RB-SPACER' };
  } else if (totalArea > 0) {
      // 4 pcs per floor contact area + sides
      quantities.spacer = { qty: strRes.rb_spacer_pcs, uom: 'pcs', label: `ลูกปูน Spacer ทั่วไป`, sku: 'RB-SPACER' };
  }

  // ─── ปั๊มคอนกรีต ────────────────────────────────────────
  if (inp.concrete_pump_required) {
    const pumpDays = Math.max(1, Math.ceil(strRes.conc_gross_m3 / 30));
    quantities.concrete_pump = { qty: pumpDays, uom: 'วัน', label: `ปั๊มคอนกรีต (${r2(strRes.conc_gross_m3)} ม³)`, sku: 'FTG-PUMP' };
  }

  // ─── สูบน้ำ Dewatering ──────────────────────────────────
  if (inp.dewatering_required) {
    const dewDays = inp.dewatering_days ?? Math.max(1, Math.ceil(totalN / 5));
    quantities.dewatering = { qty: dewDays, uom: 'วัน', label: 'ค่าเช่าปั๊มสูบน้ำ + น้ำมัน', sku: 'FTG-DEWATER' };
  }

  // ─── เครื่องจี้คอนกรีต ──────────────────────────────────
  if (totalConcreteVol > 0) {
    const vibDays = inp.vibrator_days ?? Math.max(1, Math.ceil(totalN / 10));
    quantities.vibrator = { qty: vibDays, uom: 'วัน', label: `เครื่องจี้คอนกรีต (Vibrator)`, sku: 'FTG-VIBRATOR' };
  }

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
