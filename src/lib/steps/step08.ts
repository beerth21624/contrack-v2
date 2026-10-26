import { type StepResult } from '@/types';
import { r2 } from './helpers';
import { type ConcreteGrade } from '@/data/price-list';
import { 
    computeStructuralQuantities, 
    StructuralSpecParams 
} from '@/lib/engines/structural-engine';

// ─── Step 8 Contract ─────────────────────────────────────────────────────────
/** คานคอดิน (Ground Beam) — input fields */
export interface Step8Input {
  total_beam_length_m: number;           // ผลรวมความยาวคานคอดินทุกสาย (ม.)
  beam_width_m: number;                  // กว้างคาน b (ม.)
  beam_height_m: number;                 // สูงคาน h (ม.)
  lean_concrete_thickness_m: number;     // ลีนใต้คาน (default 0.05)
  waste_percent: number;                 // default 5
  structural_spec?: StructuralSpecParams; // Core specs
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
  concrete_grade?: ConcreteGrade;        // @deprecated Legacy
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

  // ─── Structural Engine Hook ────────────────────────────────
  const kscMapping: Record<string, number> = { '180': 180, '210': 210, '240': 240, '280': 280, '300': 300, '320': 320, '350': 350 };
  const legacyKsc = inp.concrete_grade ? (kscMapping[inp.concrete_grade] ?? 240) : 240;
  
  const specParams: StructuralSpecParams = inp.structural_spec ?? {
    ksc: legacyKsc,
    waterproof: false,
    workLevel: '1FL',
    formworkType: 'BLDG',
  };

  specParams.workLevel = '1FL';
  specParams.formworkType = 'BLDG'; 
  specParams.concrete_waste_percent = waste_percent;

  const concreteNetVol = Lb * bw * bh;
  const reuse = Math.max(1, inp.formwork_reuse_times ?? 3);
  let fwNetArea = 0;
  if (inp.formwork_factor) {
    fwNetArea = (Lb * inp.formwork_factor) / reuse;
  } else {
    fwNetArea = (Lb * 2 * bh) / reuse;
  }

  let totalRebarKg = 0;
  if (inp.direct_rebar_kg) {
    totalRebarKg = inp.direct_rebar_kg;
  } else if (inp.rebar_weight_kg_per_m3) {
    totalRebarKg = concreteNetVol * inp.rebar_weight_kg_per_m3;
  }

  const strRes = computeStructuralQuantities({
    concrete_volume_m3: concreteNetVol,
    formwork_area_m2: fwNetArea,
    rebar_weight_kg: totalRebarKg,
  }, specParams);

  const quantities: StepResult['quantities'] = {
    beam_cross_area: { qty: r2(bw * bh), uom: 'm²', label: `หน้าตัดคาน (${bw}×${bh})` },
    sand_volume:     { qty: sand_volume,  uom: 'm³', label: `ทรายรองใต้ลีน (${sandT} ม.)`, sku: 'GBM-SAND' },
    lean_volume:     { qty: r2(Lb * lean_width * Tlean * wf), uom: 'm³', label: `ลีน 1:3:5 ใต้คาน`, sku: 'GBM-LEAN' },
    concrete_volume: { qty: r2(strRes.conc_gross_m3), uom: 'm³', label: `คอนกรีต ${specParams.ksc} ksc (waste ${waste_percent}%)`, sku: strRes.conc_sku },
    pour_labor:      { qty: r2(strRes.pour_labor_m3), uom: 'm³', label: `ค่าแรงเทคอนกรีต คานคอดิน`, sku: strRes.pour_labor_sku },
    formwork_m2:     { qty: r2(strRes.fw_area_m2),    uom: 'm²', label: `ไม้แบบ (ใช้ซ้ำ ${reuse} ครั้ง)`, sku: strRes.fw_sku }
  };

  if (strRes.conc_admix_wp_m3) {
    quantities.waterproof_admix = { qty: r2(strRes.conc_admix_wp_m3), uom: 'm³', label: `น้ำยากันซึมผสมคอนกรีต`, sku: 'CON-ADMIX-WP' };
  }

  // ─── ขุดดิน ──────────────────────────────────────────────
  const exc_margin = inp.excavation_extra_margin_m ?? 0.20;
  const exc_depth = r2(bh + Tlean + sandT + 0.05); // ลึก = คาน + ลีน + ทราย + เผื่อ
  const exc_width = r2(bw + exc_margin * 2);
  const exc_vol = Lb * exc_width * exc_depth;
  quantities.excavation_volume = {
    qty: r2(exc_vol * wf),
    uom: 'm³',
    label: `ขุดดินคานคอดิน (${exc_width}×${exc_depth} ม., waste ${waste_percent}%)`,
    sku: 'GBM-EXC'
  };

  // ─── ดินถมกลับ (auto) ────────────────────────────────────
  const backfill = r2((exc_vol - concreteNetVol - (Lb * lean_width * Tlean)) * 1.2); 
  if (backfill > 0) {
    quantities.backfill_volume = { qty: backfill, uom: 'm³', label: 'ดินถมกลับ (auto)', sku: 'GBM-FILL' };
  }

  // ─── เหล็กเสริม ─────────────────────────────────────────
  if (totalRebarKg > 0) {
    quantities.rebar_kg = { qty: r2(strRes.rb_gross_kg), uom: 'kg', label: `เหล็กเสริมคานคอดิน ${inp.direct_rebar_kg ? '' : `(${inp.rebar_weight_kg_per_m3} kg/m³)`}`, sku: 'GBM-REBAR' };
    
    // Tie Wire
    if (inp.tie_wire_factor !== undefined) {
        const tieWire = r2(strRes.rb_gross_kg * inp.tie_wire_factor / 100);
        quantities.tie_wire = { qty: tieWire, uom: 'kg', label: `ลวดผูกเหล็ก (${inp.tie_wire_factor}%)`, sku: 'RB-WIRE' };
    } else {
        quantities.tie_wire = { qty: r2(strRes.rb_wire_kg), uom: 'kg', label: `ลวดผูกเหล็ก ทั่วไป`, sku: 'RB-WIRE' };
    }
  }

  // ─── Spacer ──────────────────────────────────────────────
  const spacerPerM = inp.spacer_per_m ?? 2;
  quantities.spacer = { qty: Math.ceil(Lb * spacerPerM), uom: 'pcs', label: `Spacer (${spacerPerM}/ม.)`, sku: 'RB-SPACER' };

  // ─── Dowel bar ───────────────────────────────────────────
  if (inp.dowel_count && inp.dowel_length_m) {
    quantities.dowel_length = { qty: r2(inp.dowel_count * inp.dowel_length_m), uom: 'm', label: `Dowel Bar คาน (${inp.dowel_count} เส้น × ${inp.dowel_length_m} ม.)`, sku: 'GBM-DOWEL' };
  }

  // ─── ปั๊มคอนกรีต ────────────────────────────────────────
  if (inp.concrete_pump_required) {
    const pumpDays = Math.max(1, Math.ceil(strRes.conc_gross_m3 / 30));
    quantities.concrete_pump = { qty: pumpDays, uom: 'วัน', label: 'ปั๊มคอนกรีต', sku: 'GBM-PUMP' };
  }

  // ─── เครื่องจี้ ──────────────────────────────────────────
  const vibDays = inp.vibrator_days ?? Math.max(1, Math.ceil(strRes.conc_gross_m3 / 10));
  quantities.vibrator = { qty: vibDays, uom: 'วัน', label: 'เครื่องจี้คอนกรีต', sku: 'GBM-VIBRATOR' };

  // ─── บ่ม ──────────────────────────────────────────────────
  const curing = inp.curing_method ?? 'water';
  if (curing === 'plastic' || curing === 'compound') {
    const surface = Lb * (2 * bh + bw) * 1.1; // ข้าง 2 ด้าน + หน้าบน × overlap 10%
    quantities.curing = { qty: r2(surface), uom: 'm²', label: curing === 'plastic' ? 'พลาสติกปิดบ่ม' : 'น้ำยาบ่ม Curing Compound', sku: 'GBM-CURING' };
  }

  if (inp.termite_protection_required) {
    quantities.termite_pipe = { qty: Lb, uom: 'm', label: `ท่ออัดน้ำยาปลวกใต้แนวคาน`, sku: 'GBM-TERMITE' };
  }

  // ─── Warnings ─────────────────────────────────────────────
  const warnings: string[] = [];
  const warningFields: string[] = [];
  if (Tlean < 0.05) warnings.push('คอนกรีตหยาบ (ลีน) ต่ำกว่า 0.05 ม. จะบางเกินไปจนไม่สามารถป้องความชื้นดินสัมผัสเหล็กคานได้');
  if (bh > 0.60 && inp.shoring_required) warnings.push('คานมีความลึกสูง > 0.60 ม. เสี่ยงต่อแรงดันคอนกรีตทำไม้แบบระเบิด/ปลิ้นตอนเทปูน ขอแนะนำให้ตั้งงบ "ไม้ค้ำยัน (Shoring)" เพื่อหนุนข้างคาน');
  if (strRes.conc_gross_m3 > 20 && inp.concrete_pump_required) warnings.push(`ปริมาตรคอนกรีตคานคอดินสูงถึง ${r2(strRes.conc_gross_m3)} ม³ หากทอดสายเทตรงหรือใช้คนหิ้ว คอนกรีตจะแห้งไม่ทันและเกิด Cold Joint ควรเช่าปั๊มคอนกรีตเพื่อเทแบบต่อเนื่อง`);
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
