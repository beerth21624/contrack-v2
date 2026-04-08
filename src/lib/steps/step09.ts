import { type StepResult } from '@/types';
import { r2 } from './helpers';
import { type ConcreteGrade } from '@/data/price-list';

// ─── Step 9 Contract ─────────────────────────────────────────────────────────
/** เทพื้นหล่อในที่ (Slab on Grade) — input fields */
export interface Step9Input {
  slab_area_m2: number;
  slab_thickness_m: number;              // default 0.10
  sand_fill_thickness_m: number;         // default 0.075
  plastic_sheet_area_factor: number;     // default 1.10
  waste_percent: number;                 // default 5
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
  concrete_grade?: ConcreteGrade;        // default '240'
}

// ─── STEP 9 — เทพื้นหล่อในที่ ───────────────────────────────────────────────
export function calcStep9(inp: Step9Input): StepResult {
  const { slab_area_m2: A, slab_thickness_m: ts, sand_fill_thickness_m: Ts,
    plastic_sheet_area_factor: pf, waste_percent } = inp;
  const wf = 1 + waste_percent / 100;
  const concreteVol = r2(A * ts * wf);

  const quantities: StepResult['quantities'] = {
    sand_volume:     { qty: r2(A * Ts * wf), uom: 'm³', label: `ทรายปรับระดับ (${Ts} ม., waste ${waste_percent}%)` },
    plastic_area:    { qty: r2(A * pf),      uom: 'm²', label: `พลาสติกกันชื้น (overlap ×${pf})` },
    concrete_volume: { qty: concreteVol,     uom: 'm³', label: `คอนกรีตพื้น ${inp.concrete_grade ?? '240'} ksc (${ts} ม., waste ${waste_percent}%)` },
  };

  // ─── เหล็กเสริม ─────────────────────────────────────────
  if (inp.direct_rebar_kg) {
    quantities.rebar_kg = { qty: r2(inp.direct_rebar_kg), uom: 'kg', label: 'เหล็กเสริม (จาก Bar Schedule)' };
  } else {
    const rebarType = inp.rebar_type ?? 'wiremesh';
    if (rebarType === 'wiremesh' && inp.wiremesh_kg_per_m2) {
      // Wiremesh ต้องเผื่อระยะทาบ (Lap Joint) ปกติ ~15%
      quantities.wiremesh_kg = { qty: r2(A * 1.15 * inp.wiremesh_kg_per_m2), uom: 'kg', label: `ไวร์เมช (${inp.wiremesh_kg_per_m2} kg/m² รวมเผื่อทาบ 15%)` };
    } else if (rebarType === 'rebar' && inp.rebar_weight_kg_per_m3) {
      const rebarKg = r2(A * ts * inp.rebar_weight_kg_per_m3);
      quantities.rebar_kg = { qty: rebarKg, uom: 'kg', label: `เหล็กเสริม (${inp.rebar_weight_kg_per_m3} kg/m³)` };
    }
  }

  // ─── ไม้แบบขอบ ──────────────────────────────────────────
  if (inp.edge_formwork_length_m) {
    quantities.edge_formwork_m = { qty: inp.edge_formwork_length_m, uom: 'm', label: 'ไม้แบบขอบพื้น (ระบุเอง)' };
  } else if (inp.slab_perimeter_m) {
    quantities.edge_formwork_m = { qty: r2(inp.slab_perimeter_m), uom: 'm', label: 'ไม้แบบขอบพื้น (จากเส้นรอบรูป)' };
  }

  // ─── Control Joint (ร่องตัดคอนกรีต) ─────────────────────
  if (inp.control_joint_spacing_m) {
    const sp = inp.control_joint_spacing_m;
    // คำนวณจากพื้นที่ + spacing: ประมาณ joint length = A / sp (simplified)
    
    const side = Math.sqrt(A);
    const joints_per_dir = Math.floor(side / sp);
    const total_joint_m = r2(joints_per_dir * 2 * side); // ทั้ง 2 ทิศ
    quantities.control_joint = { qty: total_joint_m, uom: 'm', label: `ร่องตัด Control Joint @${sp} ม.` };
  }

  // ─── Expansion Joint ────────────────────────────────────
  if (inp.expansion_joint_length_m) {
    quantities.expansion_joint = { qty: inp.expansion_joint_length_m, uom: 'm', label: 'Expansion Joint (วัสดุยาแนว)' };
  }

  // ─── ปั๊มคอนกรีต ────────────────────────────────────────
  if (inp.concrete_pump_required) {
    const pumpDays = Math.max(1, Math.ceil(concreteVol / 40)); // พื้น pump ได้เร็วกว่า
    quantities.concrete_pump = { qty: pumpDays, uom: 'วัน', label: 'ปั๊มคอนกรีต' };
  }

  // ─── เครื่องจี้ / เกรียงปาด ──────────────────────────────
  const vibDays = inp.vibrator_days ?? Math.max(1, Math.ceil(A / 100)); // 100 ม² / วัน
  quantities.vibrator = { qty: vibDays, uom: 'วัน', label: 'เครื่องจี้ + ปาดผิว (Vibrating screed)' };

  // ─── บ่ม ──────────────────────────────────────────────────
  const curing = inp.curing_method ?? 'water';
  if (curing === 'plastic' || curing === 'compound') {
    quantities.curing = { qty: r2(A * 1.1), uom: 'm²', label: curing === 'plastic' ? 'พลาสติกปิดบ่ม (+10% overlap)' : 'น้ำยาบ่ม Curing Compound' };
  }

  // ─── Floor Hardener ──────────────────────────────────────
  if (inp.hardener_required) {
    quantities.hardener = { qty: r2(A * 5), uom: 'kg', label: 'Floor Hardener (~5 kg/m²)' };
  }

  // ─── Sleeve ──────────────────────────────────────────────
  if (inp.sleeve_count) {
    quantities.sleeve = { qty: inp.sleeve_count, uom: 'pcs', label: 'Sleeve ท่อผ่านพื้น' };
  }

  // ─── Warnings ─────────────────────────────────────────────
  const warnings: string[] = [];
  if (ts < 0.10) warnings.push('ความหนาพื้น < 0.10 ม. บางเกินไปสำหรับ Slab on Grade จะรับน้ำหนักไม่ได้และนำไปสู่การแตกร้าวของโครงสร้าง แนะนำพื้นบ้านปกติที่ 0.10–0.15 ม.');
  if (Ts < 0.05) warnings.push('ทรายรองบาง < 0.05 ม. ไม่เพียงพอต่อการปรับระดับและลดแรงเสียดทานระหว่างดินกับคอนกรีต');
  
  if (A > 16 && inp.control_joint_spacing_m) {
    warnings.push('พื้นที่พื้นใหญ่กว่า 16 ม² แต่ไม่ได้ระบุ "ระยะตัด Control Joint" คอนกรีตจะหดตัวและร้าว (Crack) แบบสะเปะสะปะ แนะนำให้ตัด Joint ทุกๆ ระยะ 3–4 ม.');
  }

  if (concreteVol > 20 && inp.concrete_pump_required) {
    warnings.push(`คอนกรีตพื้นปริมาณ ${r2(concreteVol)} ม³ หากใช้คนงานหิ้วถังเท จะปาดหน้าและปั่นหน้าไม่ทัน จนเกิดรอยต่อและรอยร้าว แนะนำให้จ้าง "ปั๊มคอนกรีตพ่วงท่อ"`);
  }

  if (A > 100 && (inp.slope_percent || inp.slope_percent === 0)) {
    warnings.push('พื้นกว้าง > 100 ม² แต่ไม่มีความลาดเอียง (Slope) เวลาฝนตกหรือล้างพื้น น้ำจะขังเป็นแอ่ง แนะนำเผื่อ Slope 0.5–1.0%');
  }

  if ((inp.rebar_type ?? 'wiremesh') === 'wiremesh' && !inp.direct_rebar_kg) {
    warnings.push('ข้อควรระวัง: ปริมาณ Wiremesh ใน BOQ นี้ ดันบวกรวมระยะทาบ (Lap Joint) 15% ไว้ให้เรียบร้อยแล้ว ไม่ต้องสั่งเผื่อเพิ่มหนักเกินไป');
  }

  // ─── QC Flags ──────────────────────────────────────────────
  const qc_flags: string[] = [];

  return { quantities, warnings, qc_flags };
}
