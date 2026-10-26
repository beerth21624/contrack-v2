import { type StepResult } from '@/types';
import { r2 } from './helpers';
import { 
    computeStructuralQuantities, 
    StructuralSpecParams 
} from '@/lib/engines/structural-engine';

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
  structural_spec?: StructuralSpecParams; // Core specs 
  // optional
  floor_height_m?: number;             // ความสูงชั้น (ม.)
  formwork_reuse_times?: number;       // @deprecated ignored — Excel prices full contact area
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

  const slabNetVol = sa * st;
  const slopeNetVol = inp.slope_concrete_required ? (sa * 0.05) : 0;
  const totalVolNet = totalBeamVol + slabNetVol + slopeNetVol;
  const totalVolGross = totalVolNet * wf; // for warnings

  const typeSummary = beams.map(b => `${b.label} ${b.count} ตัว`).join(', ');

  // ─── Structural Engine ──────────────
  const specParams: StructuralSpecParams = inp.structural_spec ? { ...inp.structural_spec } : {
    ksc: 240,
    waterproof: false,
    workLevel: '2FL', // คานและพื้นมักเป็นชั้น 2 ขึ้นไป
    formworkType: 'BLDG',
  };
  specParams.concrete_waste_percent = waste_percent;
  specParams.formworkType = 'BLDG';

  // Calculate gross rebar logic inside engine but we need net
  const rebarVol = totalBeamVol + sa * st;
  const totalRebarNet = inp.direct_rebar_kg
    ? r2(inp.direct_rebar_kg)
    : r2(rebarVol * inp.rebar_kg_per_m3);
  
  const totalFormworkNet = totalBeamFw + sa;

  const strRes = computeStructuralQuantities({
    concrete_volume_m3: totalVolNet,
    formwork_area_m2: totalFormworkNet,
    rebar_weight_kg: totalRebarNet,
  }, specParams);

  // We split concrete gross volume back proportionally 
  const beamGrossVol = r2(strRes.conc_gross_m3 * (totalBeamVol / totalVolNet));
  const slabGrossVol = r2(strRes.conc_gross_m3 * (slabNetVol / totalVolNet));
  const slopeGrossVol = r2(strRes.conc_gross_m3 * (slopeNetVol / totalVolNet));

  const quantities: StepResult['quantities'] = {
    beam_concrete: { qty: beamGrossVol || 0, uom: 'm³', label: `คอนกรีตคาน ${specParams.ksc} ksc (${typeSummary})`, sku: strRes.conc_sku },
    slab_concrete: { qty: slabGrossVol || 0, uom: 'm³', label: `คอนกรีตพื้นดาดฟ้า ${specParams.ksc} ksc (${sa} ม² × ${st} ม.)`, sku: strRes.conc_sku },
    pour_labor: { qty: r2(strRes.pour_labor_m3), uom: 'm³', label: `ค่าแรงเทคอนกรีต`, sku: strRes.pour_labor_sku },
  };

  if (slopeGrossVol > 0) {
      quantities.slope_concrete = { qty: slopeGrossVol, uom: 'm³', label: 'คอนกรีตเทปรับสโลปดาดฟ้า (หนาเฉลี่ย 5 ซม.)', sku: strRes.conc_sku };
  }

  if (strRes.conc_admix_wp_m3) {
      quantities.waterproof_admix = { qty: r2(strRes.conc_admix_wp_m3), uom: 'm³', label: `น้ำยากันซึม`, sku: 'CON-ADMIX-WP' };
  }

  // ─── เหล็กเสริม ─────────────────────────────────────────
  quantities.rebar_kg = {
    qty: r2(strRes.rb_gross_kg),
    labQty: r2(strRes.rb_net_kg),
    uom: 'kg',
    label: inp.direct_rebar_kg ? 'เหล็กเสริมคาน+พื้น (จาก Bar Schedule)' : `เหล็กเสริมคาน+พื้น (${inp.rebar_kg_per_m3} kg/m³)`,
    sku: 'BMS-REBAR' // mapping catch-all
  };

  // ─── ลวดผูก ──────────────────────────────────────────────
  quantities.tie_wire = { qty: r2(strRes.rb_wire_kg), uom: 'kg', label: `ลวดผูกเหล็ก`, sku: 'RB-WIRE' };

  // ─── Spacer ──────────────────────────────────────────────
  const spacerPerM2 = inp.spacer_per_m2 ?? 4;
  quantities.spacer = { qty: Math.ceil(totalFormworkNet * spacerPerM2), uom: 'pcs', label: `Spacer คาน+พื้น (~${spacerPerM2}/ม²)`, sku: 'RB-SPACER' };

  // ─── ไม้แบบ ────────────────────────────────────────────
  // Excel: ไม้แบบเต็มพื้นที่สัมผัส (ไม่หารจำนวนครั้งใช้ซ้ำ)
  quantities.formwork_area = { qty: r2(strRes.fw_area_m2), uom: 'm²', label: 'ไม้แบบคาน+พื้น', sku: strRes.fw_sku };

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
  if (inp.concrete_pump_required) {
    quantities.concrete_pump = { qty: Math.max(1, Math.ceil(totalVolGross / 30)), uom: 'วัน', label: 'ปั๊มคอนกรีต (ชั้นดาดฟ้า)', sku: 'BMS-PUMP' };
  }
  if (totalVolNet > 0) {
    quantities.vibrator = { qty: inp.vibrator_days ?? Math.max(1, Math.ceil(totalVolGross / 15)), uom: 'วัน', label: 'เครื่องจี้คอนกรีต', sku: 'BMS-VIBRATOR' };
  }

  const curing = inp.curing_method ?? 'water';
  if (curing === 'plastic' || curing === 'compound') {
    quantities.curing = { qty: r2(sa * 1.1), uom: 'm²', label: curing === 'plastic' ? 'พลาสติกปิดบ่ม' : 'น้ำยาบ่ม', sku: 'BMS-CURING' };
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
  if (totalVolGross > 12 && !inp.concrete_pump_required) warnings.push(`เทคอนกรีตที่ความสูงระดับชั้นดาดฟ้า (วอลลุ่ม ${r2(totalVolGross)} ม³) การใช้รอกยกถังจะช้าและเกิดรอยต่อปูน (Cold Joint) แน่นอน บังคับให้เช่า "ปั๊มคอนกรีตพ่วงท่อ"`);

  if (sa > 0) {
    if (st < 0.12) warnings.push('พื้นดาดฟ้า (Roof Slab) บางกว่า 0.12 ม. (12 ซม.) มีโอกาสเกิดรอยแตกร้าวทะลุจากความร้อนสะสมและน้ำฝนขัง แนะนำให้เทที่ความหนา 12-15 ซม. เป็นมาตรฐาน');
    if (st > 0.20) warnings.push('พื้นหนาเกิน 20 ซม. ถือเป็น Mass Concrete ควรระวังเรื่องน้ำหนักกดทับคานและโครงสร้าง');
    if (inp.waterproofing_required === false && !specParams.waterproof) warnings.push('คุณไม่ได้สั่งทำ "กันซึมทาผิว" และไม่ได้สั่งผสม "น้ำยากันซึม" ในเนื้อคอนกรีตดาดฟ้าเลย ซึ่งผิดมาตรฐานการก่อสร้าง 100% อาคารจะรั่วทันทีเมื่อเจอฝนตกหนแรก แนะนำให้แก้ไขครับ');
    if (inp.slope_concrete_required === false) warnings.push('ไม่ได้สั่งเทคอนกรีตปรับสโลป (Slope) ดาดฟ้าจะเป็นแอ่งน้ำขัง นำไปสู่ตะไคร่และการรั่วซึมในที่สุด');
  }

  // ─── QC Flags ──────────────────────────────────────────────
  const qc_flags: string[] = [];

  return { quantities, warnings, qc_flags, warningFields };
}
