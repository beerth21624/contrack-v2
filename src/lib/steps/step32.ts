import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 32 Contract ────────────────────────────────────────────────────────
/** ทาสีรอบสุดท้าย (Final Paint Coat 2) — ใช้ spec เดียวกับ Step 25 */
export interface Step32Input {
  interior_wall_area_m2: number;
  exterior_wall_area_m2: number;
  ceiling_area_m2: number;
  paint_ceiling: boolean;

  paint_grade_interior: 'economy' | 'premium' | 'washable';
  paint_grade_exterior: 'economy' | 'premium' | 'elastomeric';

  waste_percent: number;               // default 8 (รอบ 2 เสียน้อยกว่ารอบ 1)

  // optional
  woodwork_area_m2?: number;
  touch_up_percent?: number;           // % พื้นที่ต้องแต้มซ่อม (default 5)
}

// ─── Coverage rates (เหมือน Step 25) ─────────────────────────────────────────
const COV_INT: Record<string, number> = { economy: 40, premium: 35, washable: 32 };
const COV_EXT: Record<string, number> = { economy: 35, premium: 32, elastomeric: 25 };

export function calcStep32(inp: Step32Input): StepResult {
  const {
    interior_wall_area_m2, exterior_wall_area_m2, ceiling_area_m2,
    paint_ceiling, paint_grade_interior, paint_grade_exterior,
    waste_percent,
  } = inp;
  const wf = 1 + waste_percent / 100;

  const covInt = COV_INT[paint_grade_interior] ?? 35;
  const covExt = COV_EXT[paint_grade_exterior] ?? 35;
  const ceilingArea = paint_ceiling ? ceiling_area_m2 : 0;

  const quantities: StepResult['quantities'] = {};

  // 1. สีภายใน รอบ 2
  const intGal = Math.ceil((interior_wall_area_m2 + ceilingArea) * wf / covInt);
  if (intGal > 0)
    quantities.interior_paint = { qty: intGal, uom: 'แกลลอน', label: `สีทับหน้าภายใน รอบ 2 (@${covInt} m²/gal)` };

  // 2. สีภายนอก รอบ 2
  const extGal = Math.ceil(exterior_wall_area_m2 * wf / covExt);
  if (extGal > 0)
    quantities.exterior_paint = { qty: extGal, uom: 'แกลลอน', label: `สีทับหน้าภายนอก รอบ 2 (@${covExt} m²/gal)` };

  // 3. สีย้อมไม้ รอบ 2
  if (inp.woodwork_area_m2 && inp.woodwork_area_m2 > 0)
    quantities.wood_stain = { qty: Math.ceil(inp.woodwork_area_m2 * wf / 12), uom: 'แกลลอน', label: 'สีย้อมไม้/แลกเกอร์ รอบ 2' };

  // 4. Touch-up / แต้มซ่อม
  const touchPct = inp.touch_up_percent ?? 5;
  const totalArea = interior_wall_area_m2 + ceilingArea + exterior_wall_area_m2;
  const touchUpArea = r2(totalArea * touchPct / 100);
  if (touchUpArea > 0)
    quantities.touch_up = { qty: touchUpArea, uom: 'm2', label: `แต้มซ่อมจุดบกพร่อง (${touchPct}% ≈ ${touchUpArea} m²)` };

  // 5. อุปกรณ์ (รอบ 2 ใช้น้อยกว่ารอบ 1)
  if (totalArea > 0) {
    quantities.roller_set = { qty: Math.max(1, Math.ceil(totalArea / 200)), uom: 'ชุด', label: 'ลูกกลิ้ง (เปลี่ยนผ้ารอบ 2)' };
    quantities.brush = { qty: Math.max(1, Math.ceil(totalArea / 150)), uom: 'ชุด', label: 'พู่กันตัดเส้น + แปรงแต้ม' };
  }

  const warnings: string[] = [];
  if (interior_wall_area_m2 === 0 && exterior_wall_area_m2 === 0) {
    warnings.push('ข้อสังเกต: ยังไม่ได้ระบุพื้นที่ทาสี หากมีการทำงานสีรองพื้นในขั้นตอนก่อนหน้า ควรระบุพื้นที่สีทับหน้าให้สอดคล้องกันเพื่อป้องกันงบประมาณตกหล่น');
  } else {
    if (paint_grade_exterior === 'economy') {
      warnings.push('ข้อเสนอแนะเชิงวิศวกรรม: สีภายนอกเกรด Economy อาจมีข้อจำกัดด้านความทนทานต่อรังสียูวีและการเกิดชอล์ก (Chalking) หากเป็นโครงการพักอาศัยระยะยาว แนะนำพิจารณาอัปเกรดเป็นเกรด Premium เพื่อลดค่าใช้จ่ายในการตั้งนั่งร้านทาสีใหม่ในอนาคต');
    }
    if (paint_ceiling && ceiling_area_m2 === 0) {
      warnings.push('ข้อควรระวัง: เลือกตัวเลือก "ทาฝ้าเพดาน" แต่พื้นที่ฝ้าเพดานระบุเป็น 0 ตร.ม. กรุณาระบุพื้นที่เพื่อให้ระบบคำนวณปริมาณสีฝ้าได้อย่างถูกต้อง');
    }
    if (waste_percent === 0) {
      warnings.push('ข้อควรระวัง: การเผื่อ Waste สำหรับทาสีรอบสุดท้ายเป็น 0% อาจทำให้ปริมาณสีไม่เพียงพอเนื่องจากการสูญเสียระหว่างการทา (ติดลูกกลิ้ง, หกเลอะ, เก็บงาน) แนะนำเผื่อปริมาณขั้นต่ำ 5%');
    }
  }

  return { quantities, warnings, qc_flags: [] };
}
