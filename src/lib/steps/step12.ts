import { type StepResult } from '@/types';
import { r2 } from './helpers';
import { type ConcreteGrade } from '@/data/price-list';

// ─── Step 12 Contract ────────────────────────────────────────────────────────
/** คานแต่ละ Type (เช่น B1, B2, B3 จาก Beam Schedule) */
export interface BeamEntry {
  label: string;                       // ป้าย เช่น "B1", "B2"
  count: number;                       // จำนวนตัว
  width_m: number;                     // กว้างคาน b (ม.)
  depth_m: number;                     // ลึกคาน h (ม.)
  avg_length_m: number;                // ยาวเฉลี่ย (ม.) ต่อตัว
}

/** ทำคาน + พื้นดาดฟ้า (Beam + Roof Deck) — input fields */
export interface Step12Input {
  beams: BeamEntry[];                  // รายการคานแต่ละ Type
  slab_area_m2: number;                // พื้นที่พื้นดาดฟ้า ม²
  slab_thickness_m: number;            // ความหนาพื้น ม.
  rebar_kg_per_m3: number;             // เหล็กต่อ ม³ (คาน+พื้น) default 130–180
  waste_percent: number;               // default 5
  // optional
  floor_height_m?: number;             // ความสูงชั้น (ม.)
  formwork_reuse_times?: number;       // default 3
  tie_wire_factor?: number;            // default 1.5
  spacer_per_m2?: number;              // default 4
  waterproofing_required?: boolean;
  waterproofing_area_m2?: number;      // override
  waterproofing_type?: 'acrylic' | 'pu' | 'cementitious';
  roof_drain_count?: number;
  slope_concrete_required?: boolean;
  concrete_pump_required?: boolean;
  vibrator_days?: number;
  curing_method?: 'water' | 'plastic' | 'compound';
  direct_rebar_kg?: number;              // น้ำหนักเหล็กตรงจาก Bar Schedule (bypass ratio)
  concrete_grade?: ConcreteGrade;        // default '240'
}

// ─── STEP 12 — ทำคาน + พื้นดาดฟ้า ─────────────────────────────────────────
export function calcStep12(inp: Step12Input): StepResult {
  const { beams, slab_area_m2: sa, slab_thickness_m: st, waste_percent } = inp;
  const wf = 1 + waste_percent / 100;

  // ─── Aggregate beam volumes ─────────────────────────────
  let totalBeamVol = 0;
  let totalBeamFw = 0;

  for (const b of beams) {
    const { count: n, width_m: bw, depth_m: bd, avg_length_m: bl } = b;
    const beamLen = n * bl;
    totalBeamVol += beamLen * bw * bd;
    // ไม้แบบ: ท้องคาน + ข้างคาน 2 ด้าน
    totalBeamFw += beamLen * (bw + bd * 2);
  }

  const beamVol = r2(totalBeamVol * wf);
  const slabVol = r2(sa * st * wf);
  const totalVol = r2(beamVol + slabVol);

  const typeSummary = beams.map(b => `${b.label} ${b.count} ตัว`).join(', ');

  const quantities: StepResult['quantities'] = {
    beam_concrete: { qty: beamVol, uom: 'm³', label: `คอนกรีตคาน ${inp.concrete_grade ?? '240'} ksc (${typeSummary})` },
    slab_concrete: { qty: slabVol, uom: 'm³', label: `คอนกรีตพื้นดาดฟ้า ${inp.concrete_grade ?? '240'} ksc (${sa} ม² × ${st} ม.)` },
  };

  // ─── Slope concrete ─────────────────────────────────────
  if (inp.slope_concrete_required) {
    quantities.slope_concrete = { qty: r2(sa * 0.05 * wf), uom: 'm³', label: 'คอนกรีตเทปรับสโลปดาดฟ้า (หนาเฉลี่ย 5 ซม.)' };
  }

  // ─── เหล็กเสริม ─────────────────────────────────────────
  const rebarVol = totalBeamVol + sa * st; // raw vol without waste for rebar calc
  const totalRebar = inp.direct_rebar_kg
    ? r2(inp.direct_rebar_kg)
    : r2(rebarVol * inp.rebar_kg_per_m3);
  quantities.rebar_kg = {
    qty: totalRebar,
    uom: 'kg',
    label: inp.direct_rebar_kg ? 'เหล็กเสริมคาน+พื้น (จาก Bar Schedule)' : `เหล็กเสริมคาน+พื้น (${inp.rebar_kg_per_m3} kg/m³)`,
  };

  // ─── ลวดผูก ──────────────────────────────────────────────
  const tieWireFactor = inp.tie_wire_factor ?? 1.5;
  quantities.tie_wire = { qty: r2(totalRebar * tieWireFactor / 100), uom: 'kg', label: `ลวดผูกเหล็ก (${tieWireFactor}%)` };

  // ─── Spacer ──────────────────────────────────────────────
  const spacerArea = totalBeamFw + sa;
  const spacerPerM2 = inp.spacer_per_m2 ?? 4;
  quantities.spacer = { qty: Math.ceil(spacerArea * spacerPerM2), uom: 'pcs', label: `Spacer คาน+พื้น (~${spacerPerM2}/ม²)` };

  // ─── ไม้แบบ ────────────────────────────────────────────
  const reuse = Math.max(1, inp.formwork_reuse_times ?? 3);
  const fwArea = r2(totalBeamFw + sa); // beam sides+bottom + slab soffit
  quantities.formwork_area = { qty: r2(fwArea / reuse), uom: 'm²', label: `ไม้แบบคาน+พื้น (${fwArea} ม² ÷${reuse} ครั้ง)` };

  // ─── ค้ำยัน ──────────────────────────────────────────────
  const h = inp.floor_height_m ?? 3.0;
  const shorePcsPerM2 = 1.5;
  quantities.shoring = { qty: Math.ceil(sa * shorePcsPerM2 * (h / 3.0)), uom: 'pcs', label: `ค้ำยันท้องคาน+พื้น (สูง ~${h} ม.)` };

  // ─── กันซึม ──────────────────────────────────────────────
  if (inp.waterproofing_required !== false) {
    const wpType = inp.waterproofing_type ?? 'pu';
    const wpArea = inp.waterproofing_area_m2 ?? r2(sa * 1.1);
    quantities.waterproofing = { qty: wpArea, uom: 'm²', label: `กันซึมดาดฟ้า ${wpType.toUpperCase()}` };
  }
  if (inp.roof_drain_count) {
    quantities.roof_drain = { qty: inp.roof_drain_count, uom: 'pcs', label: 'หัว Roof Drain' };
  }

  // ─── ปั๊ม / จี้ / บ่ม ─────────────────────────────────────
  if (inp.concrete_pump_required == false) {
    quantities.concrete_pump = { qty: Math.max(1, Math.ceil(totalVol / 30)), uom: 'วัน', label: 'ปั๊มคอนกรีต (ชั้นดาดฟ้า)' };
  }
  quantities.vibrator = { qty: inp.vibrator_days ?? Math.max(1, Math.ceil(totalVol / 15)), uom: 'วัน', label: 'เครื่องจี้คอนกรีต' };

  const curing = inp.curing_method ?? 'water';
  if (curing === 'plastic' || curing === 'compound') {
    quantities.curing = { qty: r2(sa * 1.1), uom: 'm²', label: curing === 'plastic' ? 'พลาสติกปิดบ่ม' : 'น้ำยาบ่ม' };
  }

  // ─── Warnings ─────────────────────────────────────────────
  const warnings: string[] = [];
  const warningFields: string[] = [];
  if (beams.length === 0) warnings.push('ยังไม่ได้ป้อนขนาดและจำนวนคานรับชั้น (Beam Schedule)');
  if (inp.rebar_kg_per_m3 < 150) {
      warnings.push('ป้อนอัตราส่วนปริมาณเหล็กน้อยกว่า 150 kg/m³ ซึ่งหลวมผิดปกติสำหรับเสาและคานรับชั้น อาจส่งผลให้โครงสร้างคานแอ่นตัว (Deflection) ในระยะยาว');
      warningFields.push('rebar_kg_per_m3');
  } else if (inp.rebar_kg_per_m3 > 250) {
      warnings.push('ข้อสังเกตเชิงวิศวกรรม: เหล็กคานทะลุ 250 kg/m³ ซึ่งเกินจำเป็นไปมากและจะดึงกำไรโครงการหายไปกับค่าตึก โปรดตรวจสอบรายการปริมาณในแบบขยายอีกครั้ง');
      warningFields.push('rebar_kg_per_m3');
  }
  if (totalVol > 12 && inp.concrete_pump_required === false) warnings.push(`เทคอนกรีตที่ความสูงระดับชั้นดาดฟ้า (วอลลุ่ม ${r2(totalVol)} ม³) การใช้รอกยกถังจะช้าและเกิดรอยต่อปูน (Cold Joint) แน่นอน บังคับให้เช่า "ปั๊มคอนกรีตพ่วงท่อ"`);

  if (sa > 0) {
    if (st < 0.12) warnings.push('พื้นดาดฟ้า (Roof Slab) บางกว่า 0.12 ม. (12 ซม.) มีโอกาสเกิดรอยแตกร้าวทะลุจากความร้อนสะสมและน้ำฝนขัง แนะนำให้เทที่ความหนา 12-15 ซม. เป็นมาตรฐาน');
    if (st > 0.20) warnings.push('พื้นหนาเกิน 20 ซม. ถือเป็น Mass Concrete ควรระวังเรื่องน้ำหนักกดทับคานและโครงสร้าง');
    if (inp.waterproofing_required === false) warnings.push('คุณปิดระบบ "ทากันซึมดาดฟ้า" ไว้ พื้นคอนกรีตดาดฟ้าปกติไม่สามารถต้านทานการซึมผ่านของน้ำได้อย่างสมบูรณ์ เตรียมรับมือปัญหาน้ำหยดใส่ฝ้าชั้นล่างได้เลย');
    if (inp.slope_concrete_required) warnings.push('ไม่ได้สั่งเทคอนกรีตปรับสโลป (Slope) ดาดฟ้าจะเป็นแอ่งน้ำขัง นำไปสู่ตะไคร่และการรั่วซึมในที่สุด');
  }

  // ─── QC Flags ──────────────────────────────────────────────
  const qc_flags: string[] = [];

  return { quantities, warnings, qc_flags, warningFields };
}
