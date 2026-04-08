import { type StepResult } from '@/types';
import { r2 } from './helpers';
import { type ConcreteGrade } from '@/data/price-list';

// ─── Step 7 Contract ─────────────────────────────────────────────────────────
/** เสาตอม่อแต่ละ Type (เช่น P1, P2 จากแบบขยาย) */
export interface PedestalEntry {
  label: string;                       // ป้าย เช่น "P1", "P2"
  count: number;                       // จำนวนต้น
  width_m: number;                     // กว้าง (ม.)
  length_m: number;                    // ยาว (ม.) ถ้าเท่ากัน = เสาจตุรัส
  height_m: number;                    // สูง (ม.) เหนือฐานราก
}

/** เสาตอม่อ (Pedestal / Column Stump) — input fields */
export interface Step7Input {
  pedestals: PedestalEntry[];          // รายการตอม่อแต่ละ Type
  waste_percent: number;               // default 5
  // optional
  rebar_weight_kg_per_m3?: number;     // 100–180
  formwork_factor?: number;            // m²/ต้น (override)
  main_bar_count?: number;             // เหล็กยืน/ต้น (เช่น 4, 6, 8) ใช้ร่วมกันทุกtype
  dowel_bar_length_m?: number;         // ความยาว dowel bar (default 0.60)
  tie_wire_factor?: number;            // ลวดผูก (% ต่อเหล็ก) default 1.5
  spacer_per_pedestal?: number;        // default 4
  concrete_pump_required?: boolean;
  vibrator_days?: number;
  curing_method?: 'water' | 'plastic' | 'compound';
  formwork_reuse_times?: number;       // default 3
  direct_rebar_kg?: number;            // น้ำหนักเหล็กตรงจาก Bar Schedule (bypass ratio)
  concrete_grade?: ConcreteGrade;      // default '240'
}

// ─── STEP 7 — เสาตอม่อ ───────────────────────────────────────────────────────
export function calcStep7(inp: Step7Input): StepResult {
  const { pedestals, waste_percent } = inp;
  const wf = 1 + waste_percent / 100;
  const reuse = Math.max(1, inp.formwork_reuse_times ?? 3);

  let totalN = 0;
  let totalConcreteVol = 0;
  let totalFormwork = 0;
  let totalSurfaceArea = 0;

  for (const p of pedestals) {
    const { count: n, width_m: W, length_m: L, height_m: H } = p;
    totalN += n;
    totalConcreteVol += n * W * L * H;

    if (inp.formwork_factor) {
      totalFormwork += n * inp.formwork_factor / reuse;
    } else {
      totalFormwork += n * 2 * (W + L) * H / reuse;
    }

    totalSurfaceArea += n * (2 * (W + L) * H + W * L); // ข้าง + หน้า
  }

  const concrete_volume = r2(totalConcreteVol * wf);

  const typeSummary = pedestals.map(p => `${p.label} ${p.count} ต้น`).join(', ');

  const quantities: StepResult['quantities'] = {
    concrete_volume: { qty: concrete_volume, uom: 'm³', label: `คอนกรีต ${inp.concrete_grade ?? '240'} ksc (${typeSummary})` },
    formwork_m2: { qty: r2(totalFormwork), uom: 'm²', label: `ไม้แบบ (ใช้ซ้ำ ${reuse} ครั้ง)` },
  };

  // ─── เหล็กเสริม ─────────────────────────────────────────
  let totalRebarKg = 0;
  if (inp.direct_rebar_kg) {
    totalRebarKg = inp.direct_rebar_kg;
    quantities.rebar_kg = { qty: r2(totalRebarKg), uom: 'kg', label: 'เหล็กเสริมรวม (จาก Bar Schedule)' };
  } else if (inp.rebar_weight_kg_per_m3) {
    totalRebarKg = totalConcreteVol * inp.rebar_weight_kg_per_m3;
    quantities.rebar_kg = { qty: r2(totalRebarKg), uom: 'kg', label: `เหล็กเสริมรวม (${inp.rebar_weight_kg_per_m3} kg/m³)` };
  }

  // Dowel bar
  if (inp.main_bar_count) {
    const dowel_len = inp.dowel_bar_length_m ?? 0.60;
    quantities.dowel_bar = { qty: r2(totalN * inp.main_bar_count * dowel_len), uom: 'm', label: `Dowel bar ยื่นรอเสาชั้น 1 (${inp.main_bar_count} เส้น × ${dowel_len} ม.)` };
  }

  // ─── ลวดผูก ──────────────────────────────────────────────
  if (totalRebarKg > 0) {
    const tieWireFactor = inp.tie_wire_factor ?? 1.5;
    quantities.tie_wire = { qty: r2(totalRebarKg * tieWireFactor / 100), uom: 'kg', label: `ลวดผูกเหล็ก (${tieWireFactor}%)` };
  }

  // ─── Spacer ──────────────────────────────────────────────
  const spacerCount = inp.spacer_per_pedestal ?? 4;
  quantities.spacer = { qty: totalN * spacerCount, uom: 'pcs', label: `Spacer (${spacerCount}/ต้น)` };

  // ─── ปั๊ม / จี้ / บ่ม ─────────────────────────────────────
  if (inp.concrete_pump_required) {
    quantities.concrete_pump = { qty: Math.max(1, Math.ceil(concrete_volume / 30)), uom: 'วัน', label: 'ปั๊มคอนกรีต' };
  }
  quantities.vibrator = { qty: inp.vibrator_days ?? Math.max(1, Math.ceil(totalN / 15)), uom: 'วัน', label: 'เครื่องจี้คอนกรีต' };

  const curing = inp.curing_method ?? 'water';
  if (curing === 'plastic' || curing === 'compound') {
    quantities.curing = { qty: r2(totalSurfaceArea * 1.1), uom: 'm²', label: curing === 'plastic' ? 'พลาสติกปิดบ่ม' : 'น้ำยาบ่ม' };
  }

  // ─── Warnings ─────────────────────────────────────────────
  const warnings: string[] = [];
  const warningFields: string[] = [];
  if (pedestals.length === 0) warnings.push('ยังไม่ได้เพิ่มประเภทเสาตอม่อ กรุณากด "+ เพิ่มประเภทตอม่อ"');
  
  if (waste_percent < 5) warnings.push('ตอม่อใช้ไม้แบบขนาดเล็ก มีเศษปูนเทหกและสูญเสียตามซอกค่อนข้างเยอะ แนะนำตั้ง Waste คอนกรีตอย่างน้อย 5-10%');

  for (const p of pedestals) {
    if (p.height_m > 1.5) {
      warnings.push(`ตอม่อ ${p.label} สูง > 1.5 ม. — ห้ามปล่อยคอนกรีตตกอิสระ (Free Fall) จากปากแบบพลาสติก เพราะจะเกิดการแยกตัว (Segregation) หินไปกองอยู่ฐานหลุม ต้องเตรียม "ท่อหรุบ (Tremie)" แทงลงไปเพื่อเทหล่อเสา`);
    } else if (p.height_m > 1.0) {
      warnings.push(`ตอม่อ ${p.label} สูง > 1.0 ม. — ระวังแรงขยายตัวของคอนกรีตดันแบบแตก (Formwork Blowout) ต้องรัดไม้แบบ/ใช้เหล็กรูปพรรณค้ำยันให้แน่นหนา`);
    }
  }

  if (inp.main_bar_count) {
    warnings.push('ยังไม่ได้ระบุจำนวนเหล็กยืนเสาตอม่อ ระบบจะไม่สามารถคำนวณเหล็กหนวดกุ้ง (Dowel Bar) ที่ต้องเสียบรอเสาชั้น 1 ได้ โปรดเช็คแบบวิศวกรรม');
  }

  if (inp.main_bar_count && (inp.dowel_bar_length_m !== undefined && inp.dowel_bar_length_m < 0.50)) {
    warnings.push(`ระยะเสียบเหล็กหนวดกุ้ง (Dowel) สั้นกว่า 0.50 ม. — ตามมาตรฐานต้องทาบเหล็กอย่างน้อย 40D (เช่น เหล็ก 16 มม. ต้องทาบ 64 ซม.) แนะนำปรับเป็น 0.60–0.80 ม.`);
  }

  if (inp.rebar_weight_kg_per_m3) {
    if (inp.rebar_weight_kg_per_m3 < 100) {
      warnings.push('โครงสร้างเสาตอม่อมีอัตราส่วนเหล็ก < 100 kg/m³ ซึ่งน้อยเกินไป แนะนำให้ตั้งต้นที่ 150 kg/m³ ขึ้นไป');
      warningFields.push('rebar_weight_kg_per_m3');
    } else if (inp.rebar_weight_kg_per_m3 > 300) {
      warnings.push('ข้อสังเกตเชิงวิศวกรรม: เหล็กเสาตอม่อ > 300 kg/m³ เสี่ยงเกิดปัญหาเหล็กกระจุกตัวจนคอนกรีตลงไม่ได้ (Honeycomb) ขัดต่อหลักก่อสร้างปกติ โปรดเช็คแบบเพื่อกันการตีราคา Overprice');
      warningFields.push('rebar_weight_kg_per_m3');
    }
  } else {
    warnings.push('ยังไม่ได้ระบุน้ำหนักเหล็กเสร็จ (kg/m³) ระบบจะไม่คิดราคาเหล็ก ลวดผูก และลูกปูนลงใน BOQ');
  }

  // ─── QC Flags ──────────────────────────────────────────────
  const qc_flags: string[] = [];

  return { quantities, warnings, qc_flags, warningFields };
}
