import { type StepResult } from '@/types';
import { r2 } from './helpers';
import { type ConcreteGrade } from '@/data/price-list';

// ─── Step 11 Contract ────────────────────────────────────────────────────────
/** เสาแต่ละ Type (เช่น C1, C2 จาก Column Schedule) */
export interface ColumnEntry {
  label: string;                       // ป้าย เช่น "C1", "C2"
  count: number;                       // จำนวนต้น
  width_m: number;                     // กว้าง (ม.)
  depth_m: number;                     // ลึก (ม.) ถ้าเท่ากัน = เสาจตุรัส
  height_m: number;                    // ความสูง (ม.) floor-to-beam
}

/** ทำเสาชั้น 1 (Column Floor 1) — input fields */
export interface Step11Input {
  columns: ColumnEntry[];              // รายการเสาแต่ละ Type
  rebar_kg_per_m3: number;             // เหล็กต่อ ม³ (default 120–200)
  waste_percent: number;               // default 5
  // optional
  formwork_reuse_times?: number;       // default 3
  spacer_per_column?: number;          // default 4
  tie_wire_factor?: number;            // default 1.5
  concrete_pump_required?: boolean;
  vibrator_days?: number;
  curing_method?: 'water' | 'plastic' | 'compound';
  direct_rebar_kg?: number;            // น้ำหนักเหล็กตรงจาก Bar Schedule (bypass ratio)
  concrete_grade?: ConcreteGrade;      // default '240'
}

// ─── STEP 11 — ทำเสาชั้น 1 ──────────────────────────────────────────────────
export function calcStep11(inp: Step11Input): StepResult {
  const { columns, rebar_kg_per_m3, waste_percent } = inp;
  const wf = 1 + waste_percent / 100;
  const reuse = Math.max(1, inp.formwork_reuse_times ?? 3);

  let totalN = 0;
  let totalVol = 0;
  let totalFormwork = 0;
  let totalSurface = 0;

  for (const c of columns) {
    const { count: n, width_m: w, depth_m: d, height_m: h } = c;
    totalN += n;
    const vol = w * d * h;
    totalVol += n * vol;
    const perimeter = 2 * (w + d);
    totalFormwork += n * perimeter * h / reuse;
    totalSurface += n * perimeter * h;
  }

  const concreteVol = r2(totalVol * wf);
  const typeSummary = columns.map(c => `${c.label} ${c.count} ต้น`).join(', ');

  const quantities: StepResult['quantities'] = {
    concrete_volume: { qty: concreteVol, uom: 'm³', label: `คอนกรีตเสา ${inp.concrete_grade ?? '240'} ksc (${typeSummary})` },
    formwork_area: { qty: r2(totalFormwork), uom: 'm²', label: `แบบหล่อเสา (ใช้ซ้ำ ${reuse} ครั้ง)` },
  };

  // ─── เหล็กเสริม ─────────────────────────────────────────
  const totalRebarKg = inp.direct_rebar_kg
    ? r2(inp.direct_rebar_kg)
    : r2(totalVol * rebar_kg_per_m3);
  quantities.rebar_kg = {
    qty: totalRebarKg,
    uom: 'kg',
    label: inp.direct_rebar_kg ? 'เหล็กเสริมเสา (จาก Bar Schedule)' : `เหล็กเสริมเสา (${rebar_kg_per_m3} kg/m³)`,
  };

  // ─── ลวดผูก ──────────────────────────────────────────────
  const tieWireFactor = inp.tie_wire_factor ?? 1.5;
  quantities.tie_wire = { qty: r2(totalRebarKg * tieWireFactor / 100), uom: 'kg', label: `ลวดผูกเหล็ก (${tieWireFactor}%)` };

  // ─── Spacer ──────────────────────────────────────────────
  const spacerPer = inp.spacer_per_column ?? 4;
  quantities.spacer = { qty: totalN * spacerPer, uom: 'pcs', label: `Spacer (${spacerPer}/ต้น)` };

  // ─── ปั๊ม / จี้ / บ่ม ─────────────────────────────────────
  if (inp.concrete_pump_required) {
    quantities.concrete_pump = { qty: Math.max(1, Math.ceil(concreteVol / 20)), uom: 'วัน', label: 'ปั๊มคอนกรีต' };
  }
  quantities.vibrator = { qty: inp.vibrator_days ?? Math.max(1, Math.ceil(totalN / 10)), uom: 'วัน', label: 'เครื่องจี้คอนกรีต' };

  const curing = inp.curing_method ?? 'water';
  if (curing === 'plastic' || curing === 'compound') {
    quantities.curing = { qty: r2(totalSurface * 1.1), uom: 'm²', label: curing === 'plastic' ? 'พลาสติกปิดบ่ม' : 'น้ำยาบ่ม' };
  }

  // ─── Warnings ─────────────────────────────────────────────
  const warnings: string[] = [];
  const warningFields: string[] = [];
  if (columns.length === 0) warnings.push('ยังไม่ได้เพิ่มประเภทเสาโครงสร้าง (C1, C2...)');
  
  if (waste_percent < 5) warnings.push('เวลาเทเสามักจะมีเศษปูนร่วงจากปากแบบและติดก้นถัง แนะนำเผื่อ Waste คอนกรีตอย่างน้อย 5-10%');

  for (const c of columns) {
    if (c.height_m > 3.0) warnings.push(`เสา ${c.label} สูง > 3.0 ม. ห้ามปล่อยคอนกรีตตกอิสระ (Free Fall) จากขอบบน เพราะหินจะแยกตัวไปกองก้นเสา ทำให้โคนเป็นโพรงรังผึ้ง (Honeycomb) ต้องแทงท่อ Tremie หรือบากข้างแบบเพื่อเท`);
    if (c.width_m < 0.15 || c.depth_m < 0.15) warnings.push(`เสา ${c.label} หน้าตัดเล็กกว่า 15 ซม. หากเป็นเสาโครงสร้างหลักให้ระมัดระวังช่องเหล็กแคบจนคอนกรีตและหัวจี้ (Vibrator) ลงไม่ได้`);
  }

  if (concreteVol > 10 && inp.concrete_pump_required) {
    warnings.push(`ปริมาณคอนกรีตเสาเทรวมกันรอบเดียวสูงถึง ${r2(concreteVol)} ม³ หากใช้คนงานหิ้วถัง จะเหนื่อยล้าล่าช้า และทำให้เกิดรอยต่อปูน (Cold Joint) แนะนำให้ใช้ปั๊มคอนกรีตช่วยเท`);
  }

  if (rebar_kg_per_m3 < 150) {
    warnings.push('ระบุเหล็กเสริมเสาน้อยกว่า 150 kg/m³ ซึ่งหลวมผิดปกติสำหรับเสาหลักรับน้ำหนักบ้าน (อาจคำนวณพลาด หรือเป็นเพียงเสาเอ็น) โปรดเช็คแบบวิศวกรรมอีกครั้ง');
    warningFields.push('rebar_kg_per_m3');
  } else if (rebar_kg_per_m3 > 300) {
    warnings.push('ข้อสังเกตเชิงวิศวกรรม: เหล็กเสากรอกสัดส่วนทะลุ 300 kg/m³ ถือว่าเกิดภาวะ Over-design ชัดเจน ตีราคาตามนี้อาจจะทำให้ราคาโดดกว่ารายอื่นมาก โปรดปรึกษา Engineer ครับ');
    warningFields.push('rebar_kg_per_m3');
  }

  // ─── QC Flags ──────────────────────────────────────────────
  const qc_flags: string[] = [];

  return { quantities, warnings, qc_flags, warningFields };
}
