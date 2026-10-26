import { type StepResult } from '@/types';
import { r2 } from './helpers';
import { 
    computeStructuralQuantities, 
    StructuralSpecParams 
} from '@/lib/engines/structural-engine';

// ─── Step 13 Contract ────────────────────────────────────────────────────────
/** โครงสร้างบันได (Staircase Structure) — input fields */
export interface Step13Input {
  stair_flight_count: number;            // จำนวนช่วงบันได (flight)
  stair_width_m: number;                 // กว้างบันได ม.
  stair_rise_m: number;                  // ความสูงลูกตั้ง (rise) ม. เช่น 0.175
  stair_going_m: number;                 // ความลึกลูกนอน (going) ม. เช่น 0.25
  steps_per_flight: number;              // จำนวนขั้นบันไดต่อช่วง
  rebar_kg_per_m3: number;               // เหล็กต่อ ม³ default 100–150
  waste_percent: number;                 // default 5
  structural_spec?: StructuralSpecParams; // Core specs 
  // optional — basic
  landing_area_m2?: number;              // พื้นที่ชานพัก (landing) รวม ม²
  // ─── cost-related (ใหม่) ────────────────────────────────
  waist_slab_thickness_m?: number;       // ความหนาพื้นท้องบันได (waist) ม. (default 0.15)
  landing_thickness_m?: number;          // ความหนาชานพัก (default 0.15)
  floor_height_m?: number;               // ความสูงชั้น ม. (สำหรับค้ำยัน) default 3.0
  tie_wire_factor?: number;              // ลวดผูก (% ต่อเหล็ก) default 1.5
  spacer_per_m2?: number;                // spacer ต่อ ม² (default 4)
  nosing_required?: boolean;             // จมูกบันไดกันลื่น (non-slip nosing) ติดตั้งพร้อมโครงสร้าง
  nosing_material?: 'pvc' | 'brass' | 'aluminum'; 
  concrete_pump_required?: boolean;      // ปั๊มคอนกรีต
  vibrator_days?: number;                // เครื่องจี้
  curing_method?: 'water' | 'plastic' | 'compound';
  direct_rebar_kg?: number;              // น้ำหนักเหล็กตรงจาก Bar Schedule (bypass ratio)
}

// ─── STEP 13 — โครงสร้างบันได ───────────────────────────────────────────────
export function calcStep13(inp: Step13Input): StepResult {
  const { stair_flight_count: n, stair_width_m: w, stair_rise_m: r, stair_going_m: g,
    steps_per_flight: s, waste_percent } = inp;
  const wf = 1 + waste_percent / 100;

  // ค่าที่เกี่ยวข้องกับความหนา
  const waist = inp.waist_slab_thickness_m ?? 0.15;
  const L = Math.sqrt(r * r + g * g); // ความยาวทะแยงต่อขั้น
  const flightLen = L * s; // ความยาวทะแยงต่อช่วง
  const flatFlightLen = g * s; // ความยาวแนวราบ

  // ปริมาตรบันได: พื้นท้องบันได (waist) + ลูกขั้น (สามเหลี่ยม)
  const waistVol = flightLen * w * waist;
  const stepsVol = (0.5 * g * r * w) * s;
  const flightVol = waistVol + stepsVol;

  // ชานพัก
  const landingArea = inp.landing_area_m2 ?? 0;
  const landingThick = inp.landing_thickness_m ?? 0.15;
  const landingVol = landingArea * landingThick;

  const totalConcVolNet = n * flightVol + landingVol;

  // ─── ไม้แบบ ──────────────────────────────────────────────
  // ไม้แบบ = ท้องบันได + ท้องชานพัก + ลูกตั้ง + ข้างบันได
  const fwBottomNet = (n * flightLen * w) + landingArea; // ท้องบันได + ชานพัก
  const fwRiserNet = n * (s * r * w); // ไม้แบบลูกตั้ง
  const fwSidesNet = n * 2 * ((flightLen * waist) + (0.5 * g * r * s)); // ข้างบันได (2 ด้าน)
  const fwTotalNet = fwBottomNet + fwRiserNet + fwSidesNet;

  // ─── เหล็กเสริม ─────────────────────────────────────────
  const rebarKgPer = inp.rebar_kg_per_m3;
  const rebarTotalNet = inp.direct_rebar_kg
    ? r2(inp.direct_rebar_kg)
    : r2(totalConcVolNet * rebarKgPer);

  // ─── Structural Engine ──────────────
  const specParams: StructuralSpecParams = inp.structural_spec ? { ...inp.structural_spec } : {
    ksc: 240,
    waterproof: false,
    workLevel: '1FL',
    formworkType: 'BLDG',
  };
  specParams.concrete_waste_percent = waste_percent;
  specParams.formworkType = 'BLDG';

  const strRes = computeStructuralQuantities({
    concrete_volume_m3: totalConcVolNet,
    formwork_area_m2: fwTotalNet,
    rebar_weight_kg: rebarTotalNet,
  }, specParams);

  const quantities: StepResult['quantities'] = {
    concrete_volume: { qty: r2(strRes.conc_gross_m3), uom: 'm³', label: `คอนกรีตบันได ${specParams.ksc} ksc (รวมชานพัก)`, sku: strRes.conc_sku },
    pour_labor: { qty: r2(strRes.pour_labor_m3), uom: 'm³', label: `ค่าแรงเทคอนกรีตบันได`, sku: strRes.pour_labor_sku },
    formwork_area: { qty: r2(strRes.fw_area_m2), uom: 'm²', label: 'ไม้แบบบันได (ท้อง + ลูกตั้ง + ข้าง)', sku: strRes.fw_sku },
    rebar_kg: {
      qty: r2(strRes.rb_gross_kg),
      labQty: r2(strRes.rb_net_kg),
      uom: 'kg',
      label: inp.direct_rebar_kg ? 'เหล็กเสริมบันได (จาก Bar Schedule)' : `เหล็กเสริมบันได (${rebarKgPer} kg/m³)`
    },
    tie_wire: { qty: r2(strRes.rb_wire_kg), uom: 'kg', label: `ลวดผูกเหล็ก`, sku: 'RB-WIRE' },
  };

  if (strRes.conc_admix_wp_m3) {
      quantities.waterproof_admix = { qty: r2(strRes.conc_admix_wp_m3), uom: 'm³', label: `น้ำยากันซึม`, sku: 'CON-ADMIX-WP' };
  }

  // ─── นั่งร้านค้ำยัน ────────────────────────────────────────
  // ค้ำยันใช้ใต้ท้องบันไดและชานพัก
  const h = inp.floor_height_m ?? 3.0;
  const shoreArea = (n * flatFlightLen * w) + landingArea; // พื้นที่ฉายราบ
  quantities.shoring = { qty: Math.ceil(shoreArea * 1.5 * (h / 3.0)), uom: 'pcs', label: `ไม้ค้ำยันท้องบันได (สูงเฉลี่ย ${r2(h / 2)} ม.)` };

  // ─── Spacer ──────────────────────────────────────────────
  const spacerPerM2 = inp.spacer_per_m2 ?? 4;
  quantities.spacer = { qty: Math.ceil(fwBottomNet * spacerPerM2), uom: 'pcs', label: `Spacer ท้องบันได (~${spacerPerM2}/ม²)`, sku: 'RB-SPACER' };

  // ─── จมูกบันไดกันลื่น (Nosing) ──────────────────────────
  // สอดคล้องกับ UI: Switch แสดง ON เมื่อ nosing_required !== false
  if (inp.nosing_required !== false) {
    const nosingLen = r2(n * s * w); // จำนวนขั้น × ความกว้าง
    const material = inp.nosing_material ?? 'pvc';
    quantities.nosing = { qty: nosingLen, uom: 'm', label: `จมูกบันไดกันลื่น (${material.toUpperCase()})` };
  }

  // ─── ปั๊มคอนกรีต ────────────────────────────────────────
  if (inp.concrete_pump_required) {
    quantities.concrete_pump = { qty: Math.max(1, Math.ceil(strRes.conc_gross_m3 / 30)), uom: 'วัน', label: 'ปั๊มคอนกรีต', sku: 'COL-PUMP' };
  }

  // ─── เครื่องจี้ ──────────────────────────────────────────
  if (totalConcVolNet > 0) {
    const vibDays = inp.vibrator_days ?? 1;
    quantities.vibrator = { qty: vibDays, uom: 'วัน', label: 'เครื่องจี้คอนกรีต', sku: 'COL-VIBRATOR' };
  }

  // ─── บ่ม ──────────────────────────────────────────────────
  const curing = inp.curing_method ?? 'water';
  if (curing === 'plastic' || curing === 'compound') {
    quantities.curing = { qty: r2(fwBottomNet * 1.1), uom: 'm²', label: 'บ่มคอนกรีตบันได', sku: 'COL-CURING' };
  }

  // ─── Warnings ─────────────────────────────────────────────
  const warnings: string[] = [];
  if (s > 0 && n > 0) {
    if (r > 0.20) warnings.push(`ลูกตั้งสูงเกินไป (${r * 100} ซม.) ไม่สอดคล้องกับพระราชบัญญัติควบคุมอาคาร (ห้ามเกิน 20 ซม.) และทำให้ส่งผลต่อสรีรวิทยาการเดินและอาจก่อให้เกิดอุบัติเหตุ แนะนำให้ลดความสูงลง`);
    if (g < 0.22) warnings.push(`ลูกนอนแคบเกินไป (${g * 100} ซม.) ไม่สอดคล้องกับพระราชบัญญัติควบคุมอาคาร (ห้ามต่ำกว่า 22 ซม.) เวลาเดินลงส้นเท้าจะเลยขอบบันได เพิ่มความเสี่ยงต่อการเกิดอุบัติเหตุพลัดตก`);
    
    const treadPitch = (2 * r) + g;
    if (Math.abs(treadPitch - 0.63) > 0.05) warnings.push(`สัดส่วนก้าวเดินสูตร 2R+G = ${r2(treadPitch)} ถือว่าไม่อยู่ในระยะมาตรฐาน 60-65 ซม. ส่งผลให้ระยะก้าวเดินไม่สอดคล้องกับสรีระ`);
    
    if (!inp.landing_area_m2) warnings.push('ไม่ระบุพื้นที่ชานพัก — บันไดที่มีลูกตั้งเกิน 15 ขั้น กฎหมายบังคับให้ต้องมีชานพักพักเหนื่อย');

    if (inp.rebar_kg_per_m3 < 120) warnings.push('ปริมาณเหล็กเสริมน้อยกว่า 120 kg/m³ บันไดถือเป็นโครงสร้างที่รับแรงกระทำแบบไดนามิก (แรงกระแทกจากการเดินลงน้ำหนัก) ถ้าระบุเหล็กน้อยเกินไป บันไดจะสูญเสียเสถียรภาพและเกิดการแอ่นตัว');

    if (totalConcVolNet * wf > 5 && !inp.concrete_pump_required) warnings.push('ปริมาณคอนกรีตเกิน 5 ม³ การให้คนงานหิ้วถังเทบันไดจะสูญเสียวัสดุ และคอนกรีตอาจถอดรอยต่อเย็น (Cold Joint) ควรพิจารณาใช้ปั๊มเทจากบนลงล่าง');

    if (waste_percent < 10) warnings.push('งานเทบันได คอนกรีตมักจะหกล้นออกทางลูกตั้งและร่วงลงพื้นล่าง แนะนำให้เผื่อ Waste อย่างน้อย 10%');
  }

  // ─── QC Flags ──────────────────────────────────────────────
  const qc_flags: string[] = [];

  return { quantities, warnings, qc_flags };
}
