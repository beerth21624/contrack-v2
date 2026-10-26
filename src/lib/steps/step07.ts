import { type StepResult } from '@/types';
import { r2 } from './helpers';
import { type ConcreteGrade } from '@/data/price-list';
import { 
    computeStructuralQuantities, 
    StructuralSpecParams 
} from '@/lib/engines/structural-engine';

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
  structural_spec?: StructuralSpecParams; // Core specs
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
  formwork_reuse_times?: number;       // @deprecated ignored — Excel prices full contact area
  direct_rebar_kg?: number;            // น้ำหนักเหล็กตรงจาก Bar Schedule (bypass ratio)
  concrete_grade?: ConcreteGrade;      // @deprecated Legacy
}

// ─── STEP 7 — เสาตอม่อ ───────────────────────────────────────────────────────
export function calcStep7(inp: Step7Input): StepResult {
  const { pedestals, waste_percent } = inp;

  let totalN = 0;
  let totalConcreteVol = 0;
  let totalFormwork = 0;
  let totalSurfaceArea = 0;

  for (const p of pedestals) {
    const { count: n, width_m: W, length_m: L, height_m: H } = p;
    totalN += n;
    totalConcreteVol += n * W * L * H;

    if (inp.formwork_factor) {
      totalFormwork += n * inp.formwork_factor;
    } else {
      totalFormwork += n * 2 * (W + L) * H;
    }

    totalSurfaceArea += n * (2 * (W + L) * H + W * L); // ข้าง + หน้า
  }

  // ─── Structural Engine Hook ────────────────────────────────
  const kscMapping: Record<string, number> = { '180': 180, '210': 210, '240': 240, '280': 280, '300': 300, '320': 320, '350': 350 };
  const legacyKsc = inp.concrete_grade ? (kscMapping[inp.concrete_grade] ?? 240) : 240;
  
  const specParams: StructuralSpecParams = inp.structural_spec ? { ...inp.structural_spec } : {
    ksc: legacyKsc,
    waterproof: false,
    workLevel: '1FL',
    formworkType: 'BLDG',
  };

  // Set explicit overrides for Stump
  specParams.workLevel = '1FL'; // ตอม่อถือเป็นงานเทระดับชั้นล่างเริ่มคิดราคาอาคาร
  specParams.formworkType = 'BLDG'; 
  specParams.concrete_waste_percent = waste_percent;

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

  const typeSummary = pedestals.map(p => `${p.label} ${p.count} ต้น`).join(', ');

  const quantities: StepResult['quantities'] = {
    // Core engine mapped
    concrete_volume: { qty: r2(strRes.conc_gross_m3), uom: 'm³', label: `คอนกรีตเสาตอม่อ ${specParams.ksc} ksc (${typeSummary})`, sku: strRes.conc_sku },
    pour_labor:      { qty: r2(strRes.pour_labor_m3), uom: 'm³', label: `ค่าแรงเทคอนกรีต เสาตอม่อ`, sku: strRes.pour_labor_sku },
    formwork_m2:     { qty: r2(strRes.fw_area_m2),    uom: 'm²', label: 'ไม้แบบตอม่อ', sku: strRes.fw_sku },
  };

  if (strRes.conc_admix_wp_m3) {
    quantities.waterproof_admix = { qty: r2(strRes.conc_admix_wp_m3), uom: 'm³', label: `น้ำยากันซึมผสมคอนกรีต`, sku: 'CON-ADMIX-WP' };
  }

  // Dowel bar
  if (inp.main_bar_count) {
    const dowel_len = inp.dowel_bar_length_m ?? 0.60;
    quantities.dowel_bar = { qty: r2(totalN * inp.main_bar_count * dowel_len), uom: 'm', label: `Dowel bar ยื่นรอเสาชั้น 1 (${inp.main_bar_count} เส้น × ${dowel_len} ม.)`, sku: 'PDS-DOWEL' };
  }

  // ─── เหล็กเสริม ─────────────────────────────────────────
  if (totalRebarKg > 0) {
    quantities.rebar_kg = { qty: r2(strRes.rb_gross_kg), labQty: r2(strRes.rb_net_kg), uom: 'kg', label: `เหล็กเสริมเสาตอม่อ ${inp.direct_rebar_kg ? '(ตาม BS)' : `(${inp.rebar_weight_kg_per_m3} kg/m³)`}`, sku: 'PDS-REBAR' };
    
    // Tie Wire
    if (inp.tie_wire_factor !== undefined) {
        const tieWire = r2(strRes.rb_gross_kg * inp.tie_wire_factor / 100);
        quantities.tie_wire = { qty: tieWire, uom: 'kg', label: `ลวดผูกเหล็ก (${inp.tie_wire_factor}%)`, sku: 'RB-WIRE' };
    } else {
        quantities.tie_wire = { qty: r2(strRes.rb_wire_kg), uom: 'kg', label: `ลวดผูกเหล็ก ทั่วไป`, sku: 'RB-WIRE' };
    }
  }

  // ─── Spacer ──────────────────────────────────────────────
  if (inp.spacer_per_pedestal !== undefined) {
      quantities.spacer = { qty: totalN * inp.spacer_per_pedestal, uom: 'pcs', label: `Spacer (${inp.spacer_per_pedestal}/ต้น)`, sku: 'RB-SPACER' };
  } else if (totalSurfaceArea > 0) {
      quantities.spacer = { qty: strRes.rb_spacer_pcs, uom: 'pcs', label: `Spacer ทั่วไป`, sku: 'RB-SPACER' };
  }

  // ─── ปั๊ม / จี้ / บ่ม ─────────────────────────────────────
  if (inp.concrete_pump_required) {
    quantities.concrete_pump = { qty: Math.max(1, Math.ceil(strRes.conc_gross_m3 / 30)), uom: 'วัน', label: 'ปั๊มคอนกรีต', sku: 'PDS-PUMP' };
  }
  if (totalConcreteVol > 0) {
    quantities.vibrator = { qty: inp.vibrator_days ?? Math.max(1, Math.ceil(totalN / 15)), uom: 'วัน', label: 'เครื่องจี้คอนกรีต', sku: 'PDS-VIBRATOR' };
  }

  const curing = inp.curing_method ?? 'water';
  if (curing === 'plastic' || curing === 'compound') {
    quantities.curing = { qty: r2(totalSurfaceArea * 1.1), uom: 'm²', label: curing === 'plastic' ? 'พลาสติกปิดบ่ม' : 'น้ำยาบ่ม', sku: 'PDS-CURING' };
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

  if (!inp.main_bar_count) {
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
