import { type StepResult } from '@/types';

// ─── Step 25 Contract ────────────────────────────────────────────────────────
/** ทาสีทับหน้า รอบ 1 (Paint Coat 1) */
export interface Step25Input {
  interior_wall_area_m2: number;       // ผนังภายใน ม²
  exterior_wall_area_m2: number;       // ผนังภายนอก ม²
  ceiling_area_m2: number;             // เพดาน ม² (ทาสีหรือไม่)
  paint_ceiling: boolean;              // ทาเพดานด้วยหรือไม่

  paint_grade_interior: 'economy' | 'premium' | 'washable';
  paint_grade_exterior: 'economy' | 'premium' | 'elastomeric';
  sheen_interior: 'flat' | 'eggshell' | 'semi_gloss';

  waste_percent: number;               // default 10
  // optional
  woodwork_area_m2?: number;           // งานไม้ ม²
  accent_wall_area_m2?: number;        // ผนัง Accent (สีเข้ม) ม²
  color_count?: number;                // จำนวนสีที่ใช้ (ยิ่งเยอะยิ่งเสียเศษ)
}

// ─── Coverage rates (m² / gallon) ────────────────────────────────────────────
// ข้อมูลจากผู้ผลิตจริง (TOA, Beger, Jotun, Nippon)
const COVERAGE_INT: Record<string, number> = {
  economy: 40,       // สีราคาถูก ทาง่าย ฟิล์มบาง
  premium: 35,       // สีพรีเมียม ทึบดี
  washable: 32,      // สีล้างได้ เนื้อหนากว่า
};

const COVERAGE_EXT: Record<string, number> = {
  economy: 35,       // สีนอกทั่วไป
  premium: 32,       // สีนอกเกรดสูง กันสี fade
  elastomeric: 25,   // สียืดหยุ่นกันรอยร้าว (ฟิล์มหนามาก)
};

const GRADE_LABELS: Record<string, string> = {
  economy: 'เกรดประหยัด',
  premium: 'เกรดพรีเมียม (กันเชื้อรา/UV)',
  washable: 'ล้างได้ (Easy Care)',
  elastomeric: 'Elastomeric กันรอยร้าว',
};

const SHEEN_LABELS: Record<string, string> = {
  flat: 'ด้าน (Flat/Matte)',
  eggshell: 'กึ่งเงา (Eggshell)',
  semi_gloss: 'เงา (Semi-Gloss)',
};

export function calcStep25(inp: Step25Input): StepResult {
  const {
    interior_wall_area_m2, exterior_wall_area_m2, ceiling_area_m2,
    paint_ceiling, paint_grade_interior, paint_grade_exterior,
    sheen_interior, waste_percent,
  } = inp;
  const wf = 1 + waste_percent / 100;

  const covInt = COVERAGE_INT[paint_grade_interior] ?? 35;
  const covExt = COVERAGE_EXT[paint_grade_exterior] ?? 35;

  // สี Accent (สีเข้ม) กินมากกว่าปกติ ~30% เพราะต้องทาหนา
  const accentArea = inp.accent_wall_area_m2 ?? 0;
  const normalIntArea = Math.max(0, interior_wall_area_m2 - accentArea);
  const ceilingArea = paint_ceiling ? ceiling_area_m2 : 0;

  // จำนวนสีหลายเฉดส่งผลต่อเศษสี → waste เพิ่ม
  const colorWaste = (inp.color_count ?? 1) > 2 ? 1.05 : 1.0;

  const quantities: StepResult['quantities'] = {};

  // ─── 1. สีภายใน (ผนัง) ──────────────────────────────────
  const intGal = Math.ceil((normalIntArea * wf * colorWaste) / covInt);
  if (intGal > 0) {
    quantities.interior_paint = {
      qty: intGal, uom: 'แกลลอน',
      label: `สีทับหน้าภายใน ${GRADE_LABELS[paint_grade_interior]} ${SHEEN_LABELS[sheen_interior]} (@${covInt} m²/gal)`
    };
  }

  // ─── 1.5 สีทาฝ้าเพดาน (แยกต่างหาก) ────────────────────────
  if (ceilingArea > 0) {
    const ceilGal = Math.ceil((ceilingArea * wf) / 40); // สีฝ้า 40ตรม/แกลลอน
    quantities.ceiling_paint = {
      qty: ceilGal, uom: 'แกลลอน',
      label: `สีทาฝ้าเพดานโดยเฉพาะ (ชนิดด้านพิเศษ ลดแสงสะท้อนรอยต่อยิปซั่ม)`
    };
  }

  // ─── 2. สี Accent (สีเข้ม ใช้เกรดเดียวกัน แต่คิดแยก) ───
  if (accentArea > 0) {
    const accentGal = Math.ceil((accentArea * 1.3 * wf) / covInt); // +30% เพราะเข้มต้องทาหนา
    quantities.accent_paint = {
      qty: accentGal, uom: 'แกลลอน',
      label: `สี Accent ภายใน (สีเข้ม +30%)`
    };
  }

  // ─── 3. สีภายนอก ───────────────────────────────────────
  const extGal = Math.ceil((exterior_wall_area_m2 * wf) / covExt);
  if (extGal > 0) {
    quantities.exterior_paint = {
      qty: extGal, uom: 'แกลลอน',
      label: `สีทับหน้าภายนอก ${GRADE_LABELS[paint_grade_exterior]} (@${covExt} m²/gal)`
    };
  }

  // ─── 4. สีย้อมไม้ ──────────────────────────────────────
  if (inp.woodwork_area_m2 && inp.woodwork_area_m2 > 0) {
    quantities.wood_stain = {
      qty: Math.ceil(inp.woodwork_area_m2 * wf / 12), uom: 'แกลลอน',
      label: 'สีย้อมไม้/แลกเกอร์ (@12 m²/gal)'
    };
  }

  // ─── 5. อุปกรณ์ ────────────────────────────────────────
  const totalArea = normalIntArea + ceilingArea + accentArea + exterior_wall_area_m2;
  if (totalArea > 0) {
    quantities.roller_set = {
      qty: Math.max(2, Math.ceil(totalArea / 150)), uom: 'ชุด',
      label: 'ลูกกลิ้ง (ขน 3/8" ผนัง + ขน 1/4" ฝ้า)'
    };
    quantities.masking_tape = {
      qty: Math.ceil(totalArea / 50), uom: 'ม้วน',
      label: 'เทปกาวกันเลอะ (Masking Tape)'
    };
    quantities.drop_cloth = {
      qty: Math.max(2, Math.ceil(totalArea / 100)), uom: 'ผืน',
      label: 'ผ้าคลุมพื้นกันสีหยด'
    };
  }

  // ─── Warnings ──────────────────────────────────────────
  const warnings: string[] = [];
  if (interior_wall_area_m2 === 0 && exterior_wall_area_m2 === 0 && ceiling_area_m2 === 0) {
    warnings.push('ยังไม่ได้กรอกพื้นที่ทาสีเลย กรุณาดึงพื้นที่มาจาก Step 18 และ 19 ครับ');
  } else {
    if (paint_grade_exterior === 'economy' && exterior_wall_area_m2 > 0) {
      warnings.push('สีภายนอกเกรด "ประหยัด" (Economy) โดนแดดเมืองไทย 1-2 ปีสีก็จะซีดและหลุดล่อน คุ้มค่าแรงตั้งนั่งร้านจ้างช่างไหม? แนะนำพรีเมียมขึ้นไปเพื่อยืนระยะ 5-10 ปีครับ');
    }
    if (sheen_interior === 'flat' && paint_grade_interior === 'washable') {
      warnings.push('ข้อเสนอแนะเชิงคุณสมบัติวัสดุ: เลือกฟิล์มสีแบบขัดล้างได้แต่ตั้งค่าความเงาเป็นชนิดด้าน (Flat) ซึ่งปกติประเภทขัดล้างได้มักจะสัมพันธ์กับฟิล์มสีกึ่งเงา/เนียน');
    }
    if (accentArea > interior_wall_area_m2 * 0.5) {
       warnings.push('ข้อสังเกต: พื้นที่ Accent Wall (สีเข้ม) มีสัดส่วนมากกว่า 50% ของพื้นที่รวม ซึ่งสูงกว่าปกติทั่วไป');
    }
    if (waste_percent === 0) {
       warnings.push('ข้อควรระวัง: การเผื่อสี (Waste) เป็น 0% อาจไม่เพียงพอ แนะนำให้เผื่อ 10-15% เพื่อชดเชยการสูญเสียในถังและลูกกลิ้ง');
    }
    if (paint_ceiling && ceiling_area_m2 === 0) {
       warnings.push('เปิดสวิตช์ "ทาฝ้าเพดาน" แต่พื้นที่ฝ้าเพดานเป็น 0 ตร.ม. กรุณาระบุพื้นที่ฝ้าเพื่อคำนวณปริมาณสีฝ้าครับ');
    }
  }

  return { quantities, warnings, qc_flags: [] };
}
