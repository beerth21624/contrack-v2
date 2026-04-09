import { type StepResult } from '@/types';
import { r2 } from './helpers';
import { type ConcreteGrade } from '@/data/price-list';

// ─── Step 8 Contract ─────────────────────────────────────────────────────────
/** คานคอดิน (Ground Beam) — input fields */
export interface Step8Input {
  total_beam_length_m: number;           // ผลรวมความยาวคานคอดินทุกสาย (ม.)
  beam_width_m: number;                  // กว้างคาน b (ม.)
  beam_height_m: number;                 // สูงคาน h (ม.)
  lean_concrete_thickness_m: number;     // ลีนใต้คาน (default 0.05)
  waste_percent: number;                 // default 5
  // optional — basic
  beam_count?: number;                   // จำนวนสาย
  rebar_weight_kg_per_m3?: number;       // 120–220
  // ─── cost-related (ใหม่) ────────────────────────────────
  sand_bedding_thickness_m?: number;     // ทรายรองใต้ลีน (default 0.05)
  excavation_extra_margin_m?: number;    // เผื่อขุดกว้าง/ด้าน (default 0.20)
  formwork_factor?: number;              // m²/ม.ยาว (override)
  formwork_reuse_times?: number;         // ใช้แบบซ้ำ (default 3)
  tie_wire_factor?: number;              // ลวดผูก (% ต่อเหล็ก) default 1.5
  spacer_per_m?: number;                 // spacer ต่อ ม. ยาว (default 2)
  concrete_pump_required?: boolean;      // ปั๊มคอนกรีต
  vibrator_days?: number;                // เครื่องจี้
  curing_method?: 'water' | 'plastic' | 'compound';
  dowel_count?: number;                  // จำนวน dowel bar (เส้น)
  dowel_length_m?: number;               // ความยาว dowel bar (ม.)
  shoring_required?: boolean;            // ค้ำยันคาน (ถ้าคานสูง)
  termite_protection_required?: boolean; // ระบบกันปลวก

  direct_rebar_kg?: number;              // น้ำหนักเหล็กตรงจาก Bar Schedule (bypass ratio)
  concrete_grade?: ConcreteGrade;        // default '240'
}

// ─── STEP 8 — คานคอดิน ───────────────────────────────────────────────────────
export function calcStep8(inp: Step8Input): StepResult {
  const { total_beam_length_m: Lb, beam_width_m: bw, beam_height_m: bh,
    lean_concrete_thickness_m: Tlean, waste_percent } = inp;
  const wf = 1 + waste_percent / 100;

  // ─── ลีน / ทราย ─────────────────────────────────────────
  const lean_width = bw + 0.10; // กว้างกว่าคาน 5 ซม. ต่อด้าน
  const sandT = inp.sand_bedding_thickness_m ?? 0.05;
  const sand_volume = r2(Lb * lean_width * sandT * wf);

  const quantities: StepResult['quantities'] = {
    beam_cross_area: { qty: r2(bw * bh), uom: 'm²', label: `หน้าตัดคาน (${bw}×${bh})` },
    sand_volume:     { qty: sand_volume,  uom: 'm³', label: `ทรายรองใต้ลีน (${sandT} ม.)` },
    lean_volume:     { qty: r2(Lb * lean_width * Tlean * wf), uom: 'm³', label: `ลีน 1:3:5 ใต้คาน (waste ${waste_percent}%)` },
    concrete_volume: { qty: r2(Lb * bw * bh * wf), uom: 'm³', label: `คอนกรีต ${inp.concrete_grade ?? '240'} ksc (waste ${waste_percent}%)` },
  };

  // ─── ขุดดิน ──────────────────────────────────────────────
  const exc_margin = inp.excavation_extra_margin_m ?? 0.20;
  const exc_depth = r2(bh + Tlean + sandT + 0.05); // ลึก = คาน + ลีน + ทราย + เผื่อ
  const exc_width = r2(bw + exc_margin * 2);
  quantities.excavation_volume = {
    qty: r2(Lb * exc_width * exc_depth * wf),
    uom: 'm³',
    label: `ขุดดิน (${exc_width}×${exc_depth} ม., waste ${waste_percent}%)`,
  };

  // ─── เหล็กเสริม ─────────────────────────────────────────
  let totalRebarKg = 0;
  if (inp.direct_rebar_kg) {
    totalRebarKg = inp.direct_rebar_kg;
    quantities.rebar_kg = { qty: r2(totalRebarKg), uom: 'kg', label: 'เหล็กเสริม (จาก Bar Schedule)' };
  } else if (inp.rebar_weight_kg_per_m3) {
    totalRebarKg = Lb * bw * bh * inp.rebar_weight_kg_per_m3;
    quantities.rebar_kg = { qty: r2(totalRebarKg), uom: 'kg', label: `เหล็กเสริม (${inp.rebar_weight_kg_per_m3} kg/m³)` };
  }

  // ─── ลวดผูกเหล็ก ────────────────────────────────────────
  if (totalRebarKg > 0) {
    const tieWireFactor = inp.tie_wire_factor ?? 1.5;
    quantities.tie_wire = { qty: r2(totalRebarKg * tieWireFactor / 100), uom: 'kg', label: `ลวดผูกเหล็ก (${tieWireFactor}%)` };
  }

  // ─── Spacer ──────────────────────────────────────────────
  const spacerPerM = inp.spacer_per_m ?? 2;
  quantities.spacer = { qty: Math.ceil(Lb * spacerPerM), uom: 'pcs', label: `Spacer (${spacerPerM}/ม.)` };

  // ─── ไม้แบบ (auto or factor) ─────────────────────────────
  const reuse = Math.max(1, inp.formwork_reuse_times ?? 3);
  if (inp.formwork_factor) {
    quantities.formwork_m2 = { qty: r2(Lb * inp.formwork_factor / reuse), uom: 'm²', label: `ไม้แบบ (factor ${inp.formwork_factor}, ÷${reuse} ครั้ง)` };
  } else {
    const fw_per_m = 2 * bh; // ทั้ง 2 ด้าน × ความสูง
    quantities.formwork_m2 = { qty: r2(Lb * fw_per_m / reuse), uom: 'm²', label: `ไม้แบบ (2×${bh}=${r2(fw_per_m)} ม²/ม. ÷${reuse} ครั้ง)` };
  }

  // ─── ดินถมกลับ (auto) ────────────────────────────────────
  const beam_vol = Lb * bw * bh;
  const lean_vol = Lb * lean_width * Tlean;
  const exc_vol = Lb * exc_width * exc_depth;
  const backfill = r2((exc_vol - beam_vol - lean_vol) * 1.2); // ดินขยายตัว ~20%
  if (backfill > 0) {
    quantities.backfill_volume = { qty: backfill, uom: 'm³', label: 'ดินถมกลับ (auto = ขุด – คาน – ลีน × 1.2)' };
  }

  // ─── Dowel bar ───────────────────────────────────────────
  if (inp.dowel_count && inp.dowel_length_m) {
    quantities.dowel_length = { qty: r2(inp.dowel_count * inp.dowel_length_m), uom: 'm', label: `Dowel Bar (${inp.dowel_count} เส้น × ${inp.dowel_length_m} ม.)` };
  }

  // ─── ปั๊มคอนกรีต ────────────────────────────────────────
  const concreteVol = Lb * bw * bh * wf;
  if (inp.concrete_pump_required) {
    const pumpDays = Math.max(1, Math.ceil(concreteVol / 30));
    quantities.concrete_pump = { qty: pumpDays, uom: 'วัน', label: 'ปั๊มคอนกรีต' };
  }

  // ─── เครื่องจี้ ──────────────────────────────────────────
  const vibDays = inp.vibrator_days ?? Math.max(1, Math.ceil(concreteVol / 10));
  quantities.vibrator = { qty: vibDays, uom: 'วัน', label: 'เครื่องจี้คอนกรีต' };

  // ─── บ่ม ──────────────────────────────────────────────────
  const curing = inp.curing_method ?? 'water';
  if (curing === 'plastic' || curing === 'compound') {
    const surface = Lb * (2 * bh + bw) * 1.1; // ข้าง 2 ด้าน + หน้าบน × overlap 10%
    quantities.curing = { qty: r2(surface), uom: 'm²', label: curing === 'plastic' ? 'พลาสติกปิดบ่ม (+10% overlap)' : 'น้ำยาบ่ม Curing Compound' };
  }

  // ─── ปลวก ──────────────────────────────────────────────────
  if (inp.termite_protection_required) {
    quantities.termite_pipe = { qty: Lb, uom: 'm', label: `ท่ออัดน้ำยาปลวกใต้แนวคาน` };
  }

  // ─── Warnings ─────────────────────────────────────────────
  const warnings: string[] = [];
  const warningFields: string[] = [];
  if (Tlean < 0.05) warnings.push('คอนกรีตหยาบ (ลีน) ต่ำกว่า 0.05 ม. จะบางเกินไปจนไม่สามารถป้องความชื้นดินสัมผัสเหล็กคานได้');
  if (bh > 0.60 && inp.shoring_required) warnings.push('คานมีความลึกสูง > 0.60 ม. เสี่ยงต่อแรงดันคอนกรีตทำไม้แบบระเบิด/ปลิ้นตอนเทปูน ขอแนะนำให้ตั้งงบ "ไม้ค้ำยัน (Shoring)" เพื่อหนุนข้างคาน');
  if (concreteVol > 20 && inp.concrete_pump_required) warnings.push(`ปริมาตรคอนกรีตคานคอดินสูงถึง ${r2(concreteVol)} ม³ หากทอดสายเทตรงหรือใช้คนหิ้ว คอนกรีตจะแห้งไม่ทันและเกิด Cold Joint ควรเช่าปั๊มคอนกรีตเพื่อเทแบบต่อเนื่อง`);
  if (waste_percent < 10) warnings.push('การเทคานคอดิน (Ground Beam) มักมีการขุดร่องพิงดิน โอกาสดินพังทับหรือเทคอนกรีตล้นแนวก่อมีสูงมาก แนะนำให้ตั้งเปอร์เซ็นต์ Waste อย่างน้อย 10%');
  if (bw < 0.20) warnings.push('คานมีความกว้างน้อยกว่า 0.20 ม. ให้ระวังช่องว่างระหว่างเหล็กเสริม จะทำให้หัวจี้คอนกรีต (Vibrator) แหย่ไม่ลง');
  if (inp.rebar_weight_kg_per_m3) {
      if (inp.rebar_weight_kg_per_m3 < 120) {
          warnings.push('อัตราส่วนปริมาณเหล็กต่อคอนกรีตต่ำกว่า 120 kg/m³ ถือว่าน้อยผิดปกติสำหรับคานคอดิน (ปกติ 120-220 kg/m³) โปรดตรวจสอบเหล็กพิเศษจากการเสริมคานอีกครั้ง');
          warningFields.push('rebar_weight_kg_per_m3');
      } else if (inp.rebar_weight_kg_per_m3 > 250) {
          warnings.push('ข้อสังเกตเชิงวิศวกรรม: อัตราส่วนเหล็กคานคอดิน > 250 kg/m³ หนาแน่นผิดปกติสำหรับงานประเภทนี้ โปรดตรวจสอบป้องกันการตีราคาที่ทำให้สูญเสียโอกาสรับงาน');
          warningFields.push('rebar_weight_kg_per_m3');
      }
  }

  // ─── QC Flags ──────────────────────────────────────────────
  const qc_flags: string[] = [];

  return { quantities, warnings, qc_flags, warningFields };
}
