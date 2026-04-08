import { type StepResult } from '@/types';

// ─── Step 23 Contract ────────────────────────────────────────────────────────
/** ทาสีรองพื้น (Primer Coat) */
export interface Step23Input {
  interior_area_m2: number;            // พื้นที่ทาภายใน (ผนัง+ฝ้า) ม²
  exterior_area_m2: number;            // พื้นที่ทาภายนอก ม²
  primer_type_interior: 'acrylic' | 'alkali_seal' | 'water_based';
  primer_type_exterior: 'acrylic' | 'alkali_seal' | 'elastomeric';
  coats: number;                       // จำนวนรอบ (1 หรือ 2)
  waste_percent: number;               // default 10
  // optional — surface prep
  surface_prep_required: boolean;      // ต้องลบรอยปูนเกาะ/ราเก่าก่อนทาหรือไม่
  use_sealer_crack: boolean;           // อุดรอยแตกก่อนทา
}

// ─── Coverage rates per primer type ──────────────────────────────────────────
// อัตรากินพื้นที่ (m²/gallon) — จากข้อมูลผู้ผลิตจริง (TOA, Beger, Nippon)
const COVERAGE: Record<string, number> = {
  acrylic:     35,   // ทั่วไป 35 m²/gal
  alkali_seal: 30,   // ซีลด่างจากปูนใหม่ กินมากกว่าเพราะซึมลึก
  water_based: 40,   // รองพื้นทั่วไป กรอบอ่อน
  elastomeric: 25,   // ยืดหยุ่น ใช้ผนังนอกป้องกันแตกร้าว — ฟิล์มหนา กินเยอะ
};

// ─── Cost hint labels ────────────────────────────────────────────────────────
const PRIMER_LABELS: Record<string, string> = {
  acrylic:     'อะคริลิกรองพื้น (TOA/Beger)',
  alkali_seal: 'Alkali Seal กันด่างปูนใหม่',
  water_based: 'รองพื้นน้ำทั่วไป',
  elastomeric: 'Elastomeric กันรอยร้าว (นอก)',
};

export function calcStep23(inp: Step23Input): StepResult {
  const {
    interior_area_m2, exterior_area_m2,
    primer_type_interior, primer_type_exterior,
    coats, waste_percent,
    surface_prep_required, use_sealer_crack,
  } = inp;
  const wf = 1 + waste_percent / 100;

  const covInt = COVERAGE[primer_type_interior] ?? 35;
  const covExt = COVERAGE[primer_type_exterior] ?? 35;

  const quantities: StepResult['quantities'] = {};

  // ─── 1. สีรองพื้นภายใน ──────────────────────────────────
  if (interior_area_m2 > 0) {
    const gal = Math.ceil((interior_area_m2 * coats * wf) / covInt);
    quantities.primer_interior = {
      qty: gal, uom: 'แกลลอน',
      label: `สีรองพื้นภายใน — ${PRIMER_LABELS[primer_type_interior]} (@${covInt} m²/gal × ${coats} รอบ)`
    };
  }

  // ─── 2. สีรองพื้นภายนอก ──────────────────────────────────
  if (exterior_area_m2 > 0) {
    const gal = Math.ceil((exterior_area_m2 * coats * wf) / covExt);
    quantities.primer_exterior = {
      qty: gal, uom: 'แกลลอน',
      label: `สีรองพื้นภายนอก — ${PRIMER_LABELS[primer_type_exterior]} (@${covExt} m²/gal × ${coats} รอบ)`
    };
  }

  // ─── 3. วัสดุเตรียมผิว ──────────────────────────────────
  if (surface_prep_required) {
    const totalArea = interior_area_m2 + exterior_area_m2;
    // กระดาษทรายขัดผนัง ~20 m²/แผ่น
    quantities.sandpaper = {
      qty: Math.ceil(totalArea / 20), uom: 'แผ่น',
      label: 'กระดาษทรายขัดผิวปูน (#120-180)'
    };
  }

  if (use_sealer_crack) {
    // อะคริลิกอุดรอย — 1 หลอด/10 เมตร, ประเมิน 1 หลอด/30 ม² ผนัง
    const totalArea = interior_area_m2 + exterior_area_m2;
    quantities.crack_sealer = {
      qty: Math.ceil(totalArea / 30), uom: 'หลอด',
      label: 'อะคริลิกอุดรอยแตก (300ml)'
    };
  }

  // ─── 4. ลูกกลิ้ง + ถาดรอง ──────────────────────────────
  const totalArea = interior_area_m2 + exterior_area_m2;
  if (totalArea > 0) {
    const rollerSets = Math.max(1, Math.ceil(totalArea / 200)); // 1 ชุด/200 m²
    quantities.roller_set = {
      qty: rollerSets, uom: 'ชุด',
      label: 'ลูกกลิ้ง + ถาดรอง + ด้าม'
    };
    // พู่กัน — trim งานขอบ มุม กรอบ
    quantities.brush = {
      qty: Math.max(2, Math.ceil(totalArea / 100)), uom: 'อัน',
      label: 'พู่กันตัดเส้นขอบ 2"-3"'
    };
  }

  // ─── Warnings ──────────────────────────────────────────
  const warnings: string[] = [];
  if (interior_area_m2 === 0 && exterior_area_m2 === 0) {
    warnings.push('ยังไม่ได้ระบุพื้นที่ทาสีรองพื้น กรุณาเช็คพื้นที่จาก Step 18 ครับ');
  } else {
    if (primer_type_interior === 'acrylic') {
      warnings.push('ภายใน: ผนังปูนฉาบใหม่ต้องใช้ "สีรองพื้นปูนใหม่กันด่าง (Alkali Seal)" เท่านั้น ถ้าใช้อะคริลิกธรรมดา ความเค็มของปูนจะดันฟิล์มสีซึ่งอาจเกิดปฏิกิริยาความเป็นด่างและส่งผลให้สีทับหน้าบวมหรือด่าง');
    }
    if (primer_type_exterior === 'acrylic') {
      warnings.push('ภายนอก: ผนังปูนฉาบใหม่ต้องใช้ "สีรองพื้นปูนใหม่กันด่าง" เช่นกันครับ หากใช้อะคริลิกทั่วไปอาจส่งผลให้ความคงทนของฟิล์มสีภายนอกลดลงก่อนกำหนด');
    }
    if (exterior_area_m2 > 0 && primer_type_exterior == 'elastomeric' && use_sealer_crack) {
      warnings.push('งานภายนอกมักเจอแดดและปูนแตกลายงา (Hairline crack) แนะนำให้ใช้สีรองพื้นตระกูล เปลือกส้ม/Elastomeric หรือต้องอุดรอยร้าวเสมอครับ');
    }
    if (surface_prep_required) {
      warnings.push('คุณติ๊กปิด "ขัดผิว/ลบรอยปูน" งานทาสี 80% อาจส่งผลกระทบต่อคุณภาพของงานสี พื้นผิวจะขาดความสม่ำเสมอและเกิดการลอกล่อน ไม่แนะนำให้ประหยัดค่าแรงส่วนนี้เด็ดขาด');
    }
    if (waste_percent === 0) {
      warnings.push('ข้อควรระวัง: การเผื่อสีเป็น 0% อาจไม่เพียงพอต่อการสูญเสียระหว่างการทาและตกแต่งขอบ แนะนำเผื่อ 10-15%');
    }
  }

  return { quantities, warnings, qc_flags: [] };
}
