import { type StepResult } from '@/types';
import { r2 } from './helpers';
import { type ConcreteGrade } from '@/data/price-list';
import { 
    computeStructuralQuantities, 
    StructuralSpecParams 
} from '@/lib/engines/structural-engine';

// ─── Step 9 Contract ─────────────────────────────────────────────────────────
/** เทพื้นหล่อในที่ (Slab on Grade) — input fields */
export interface Step9Input {
  slab_area_m2: number;
  slab_thickness_m: number;              // default 0.10
  sand_fill_thickness_m: number;         // default 0.075
  plastic_sheet_area_factor: number;     // default 1.10
  waste_percent: number;                 // default 5
  structural_spec?: StructuralSpecParams; // Core specs
  // optional — basic
  wiremesh_kg_per_m2?: number;           // 2.5–6.0
  edge_formwork_length_m?: number;       // ไม้แบบขอบ (ม.) — override
  // ─── cost-related (ใหม่) ────────────────────────────────
  slab_perimeter_m?: number;             // เส้นรอบรูปพื้น (auto edge formwork)
  concrete_pump_required?: boolean;      // ปั๊มคอนกรีต
  vibrator_days?: number;                // เครื่องจี้
  curing_method?: 'water' | 'plastic' | 'compound';
  control_joint_spacing_m?: number;      // ระยะ control joint (ปกติ 3–4 ม.)
  expansion_joint_length_m?: number;     // ความยาว expansion joint (ม.)
  rebar_type?: 'wiremesh' | 'rebar';    // ชนิดเหล็กเสริม
  rebar_weight_kg_per_m3?: number;       // ถ้าเลือก rebar (120–180 kg/m³)
  slope_percent?: number;                // ความลาดเอียง (%) — สำหรับ drainage
  sleeve_count?: number;                 // จำนวน Sleeve สำหรับท่อ
  hardener_required?: boolean;           // Floor hardener (สำหรับพื้นโรงงาน)
  direct_rebar_kg?: number;              // น้ำหนักเหล็กตรงจาก Bar Schedule (bypass ratio)
  concrete_grade?: ConcreteGrade;        // @deprecated Legacy
}

// ─── STEP 9 — เทพื้นหล่อในที่ ───────────────────────────────────────────────
export function calcStep9(inp: Step9Input): StepResult {
  const { slab_area_m2: A, slab_thickness_m: ts, sand_fill_thickness_m: Ts,
    plastic_sheet_area_factor: pf, waste_percent } = inp;
  const wf = 1 + waste_percent / 100;
  const concreteVol = A * ts;
  
  // ─── Structural Engine Hook ────────────────────────────────
  const kscMapping: Record<string, number> = { '180': 180, '210': 210, '240': 240, '280': 280, '300': 300, '320': 320, '350': 350 };
  const legacyKsc = inp.concrete_grade ? (kscMapping[inp.concrete_grade] ?? 240) : 240;
  
  const specParams: StructuralSpecParams = inp.structural_spec ? { ...inp.structural_spec } : {
    ksc: legacyKsc,
    waterproof: false,
    workLevel: 'GRND',
    formworkType: 'GRND',
  };

  specParams.workLevel = 'GRND';
  specParams.formworkType = 'GRND'; 
  specParams.concrete_waste_percent = waste_percent;

  const rebarType = inp.rebar_type ?? 'wiremesh';
  let totalRebarKg = 0;
  if (rebarType === 'rebar') {
      if (inp.direct_rebar_kg) totalRebarKg = inp.direct_rebar_kg;
      else if (inp.rebar_weight_kg_per_m3) totalRebarKg = concreteVol * inp.rebar_weight_kg_per_m3;
  }

  const strRes = computeStructuralQuantities({
    concrete_volume_m3: concreteVol,
    formwork_area_m2: 0, // formwork on SOG is length based, handled separately
    rebar_weight_kg: totalRebarKg,
  }, specParams);

  const quantities: StepResult['quantities'] = {
    sand_volume:     { qty: r2(A * Ts * wf), uom: 'm³', label: `ทรายปรับระดับ (${Ts} ม., waste ${waste_percent}%)`, sku: 'SOG-SAND' },
    plastic_area:    { qty: r2(A * pf),      uom: 'm²', label: `พลาสติกกันชื้น (overlap ×${pf})`, sku: 'SOG-PLASTIC' },
    concrete_volume: { qty: r2(strRes.conc_gross_m3), uom: 'm³', label: `คอนกรีตพื้น ${specParams.ksc} ksc (${ts} ม., waste ${waste_percent}%)`, sku: strRes.conc_sku },
    pour_labor:      { qty: r2(strRes.pour_labor_m3), uom: 'm³', label: `ค่าแรงเทคอนกรีต พื้นบนดิน`, sku: strRes.pour_labor_sku },
  };

  if (strRes.conc_admix_wp_m3) {
    quantities.waterproof_admix = { qty: r2(strRes.conc_admix_wp_m3), uom: 'm³', label: `น้ำยากันซึมผสมคอนกรีต`, sku: 'CON-ADMIX-WP' };
  }

  // ─── เหล็กเสริม ─────────────────────────────────────────
  if (rebarType === 'wiremesh' && inp.wiremesh_kg_per_m2) {
      quantities.wiremesh_kg = { qty: r2(A * 1.15 * inp.wiremesh_kg_per_m2), uom: 'kg', label: `ไวร์เมช (${inp.wiremesh_kg_per_m2} kg/m² รวมเผื่อทาบ 15%)`, sku: 'SOG-MESH' };
  } else if (totalRebarKg > 0) {
      quantities.rebar_kg = { qty: r2(strRes.rb_gross_kg), uom: 'kg', label: `เหล็กเสริมพื้น (${inp.rebar_weight_kg_per_m3} kg/m³)`, sku: 'SOG-REBAR' };
      quantities.tie_wire = { qty: r2(strRes.rb_wire_kg), uom: 'kg', label: `ลวดผูกเหล็ก`, sku: 'RB-WIRE' };
  }

  // ─── ไม้แบบขอบ ──────────────────────────────────────────
  if (inp.edge_formwork_length_m) {
    quantities.edge_formwork_m = { qty: inp.edge_formwork_length_m, uom: 'm', label: 'ไม้แบบขอบพื้น (ระบุเอง)', sku: 'SOG-FORM-EDG' };
  } else if (inp.slab_perimeter_m) {
    quantities.edge_formwork_m = { qty: r2(inp.slab_perimeter_m), uom: 'm', label: 'ไม้แบบขอบพื้น (จากเส้นรอบรูป)', sku: 'SOG-FORM-EDG' };
  }

  // ─── Control Joint (ร่องตัดคอนกรีต) ─────────────────────
  if (inp.control_joint_spacing_m) {
    const sp = inp.control_joint_spacing_m;
    const side = Math.sqrt(A);
    const joints_per_dir = Math.floor(side / sp);
    const total_joint_m = r2(joints_per_dir * 2 * side); // ทั้ง 2 ทิศ
    quantities.control_joint = { qty: total_joint_m, uom: 'm', label: `ร่องตัด Control Joint @${sp} ม.`, sku: 'SOG-CJOINT' };
  }

  // ─── Expansion Joint ────────────────────────────────────
  if (inp.expansion_joint_length_m) {
    quantities.expansion_joint = { qty: inp.expansion_joint_length_m, uom: 'm', label: 'Expansion Joint (วัสดุยาแนว)', sku: 'SOG-EJOINT' };
  }

  // ─── ปั๊มคอนกรีต ────────────────────────────────────────
  if (inp.concrete_pump_required) {
    const pumpDays = Math.max(1, Math.ceil(strRes.conc_gross_m3 / 40)); // พื้น pump ได้เร็วกว่า
    quantities.concrete_pump = { qty: pumpDays, uom: 'วัน', label: 'ปั๊มคอนกรีต', sku: 'SOG-PUMP' };
  }

  // ─── เครื่องจี้ / เกรียงปาด ──────────────────────────────
  if (concreteVol > 0) {
    const vibDays = inp.vibrator_days ?? Math.max(1, Math.ceil(A / 100)); // 100 ม² / วัน
    quantities.vibrator = { qty: vibDays, uom: 'วัน', label: 'เครื่องจี้ + ปาดผิว (Vibrating screed)', sku: 'SOG-VIBRATOR' };
  }

  // ─── บ่ม ──────────────────────────────────────────────────
  const curing = inp.curing_method ?? 'water';
  if (curing === 'plastic' || curing === 'compound') {
    quantities.curing = { qty: r2(A * 1.1), uom: 'm²', label: curing === 'plastic' ? 'พลาสติกปิดบ่ม (+10% overlap)' : 'น้ำยาบ่ม Curing Compound', sku: 'SOG-CURING' };
  }

  // ─── Floor Hardener ──────────────────────────────────────
  if (inp.hardener_required) {
    quantities.hardener = { qty: r2(A * 5), uom: 'kg', label: 'Floor Hardener (~5 kg/m²)', sku: 'SOG-HARDENER' };
  }

  // ─── Sleeve ──────────────────────────────────────────────
  if (inp.sleeve_count) {
    quantities.sleeve = { qty: inp.sleeve_count, uom: 'pcs', label: 'Sleeve ท่อผ่านพื้น' };
  }

  // ─── Warnings ─────────────────────────────────────────────
  const warnings: string[] = [];
  if (ts < 0.10) warnings.push('ความหนาพื้น < 0.10 ม. บางเกินไปสำหรับ Slab on Grade จะรับน้ำหนักไม่ได้และนำไปสู่การแตกร้าวของโครงสร้าง แนะนำพื้นบ้านปกติที่ 0.10–0.15 ม.');
  if (Ts < 0.05) warnings.push('ทรายรองบาง < 0.05 ม. ไม่เพียงพอต่อการปรับระดับและลดแรงเสียดทานระหว่างดินกับคอนกรีต');
  
  if (A > 16 && !inp.control_joint_spacing_m) {
    warnings.push('พื้นที่พื้นใหญ่กว่า 16 ม² แต่ไม่ได้ระบุ "ระยะตัด Control Joint" คอนกรีตจะหดตัวและร้าว (Crack) แบบสะเปะสะปะ แนะนำให้ตัด Joint ทุกๆ ระยะ 3–4 ม.');
  }

  if (concreteVol > 20 && !inp.concrete_pump_required) {
    warnings.push(`คอนกรีตพื้นปริมาณ ${r2(concreteVol)} ม³ หากใช้คนงานหิ้วถังเท จะปาดหน้าและปั่นหน้าไม่ทัน จนเกิดรอยต่อและรอยร้าว แนะนำให้จ้าง "ปั๊มคอนกรีตพ่วงท่อ"`);
  }

  if (A > 100 && !inp.slope_percent) {
    warnings.push('พื้นกว้าง > 100 ม² แต่ไม่มีความลาดเอียง (Slope) เวลาฝนตกหรือล้างพื้น น้ำจะขังเป็นแอ่ง แนะนำเผื่อ Slope 0.5–1.0%');
  }

  if ((inp.rebar_type ?? 'wiremesh') === 'wiremesh' && !inp.direct_rebar_kg) {
    warnings.push('ข้อควรระวัง: ปริมาณ Wiremesh ใน BOQ นี้ ดันบวกรวมระยะทาบ (Lap Joint) 15% ไว้ให้เรียบร้อยแล้ว ไม่ต้องสั่งเผื่อเพิ่มหนักเกินไป');
  }

  // ─── QC Flags ──────────────────────────────────────────────
  const qc_flags: string[] = [];

  return { quantities, warnings, qc_flags };
}
