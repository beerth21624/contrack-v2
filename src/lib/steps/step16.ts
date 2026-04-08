import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 16 Contract ────────────────────────────────────────────────────────
/** มุงหลังคา (Roofing) — input fields */
export interface Step16Input {
  roof_area_m2: number;                // พื้นที่หลังคาตามความชัน ม²
  roofing_type: 'cpac' | 'excella' | 'metal_sheet' | 'corrugated' | 'shingle'; 
  waste_percent: number;               // default 5-10
  // optional
  ridge_length_m?: number;             // ความยาวสันหลังคา (Ridge) ม.
  hip_length_m?: number;               // ความยาวตะเข้สัน (Hip) ม.
  valley_length_m?: number;            // ความยาวตะเข้ราง (Valley) ม.
  eave_length_m?: number;              // ความยาวเชิงชายรอบอาคาร ม.
  insulation_required?: boolean;       // ติดตั้งฉนวนกันความร้อน (PU/PE/Foil)
  bird_block_required?: boolean;       // ติดตั้งแผ่น/หวีปิดกันนก
}

// ─── STEP 16 — มุงหลังคา ───────────────────────────────────────────────────
export function calcStep16(inp: Step16Input): StepResult {
  const { roof_area_m2: A, roofing_type, waste_percent } = inp;
  const wf = 1 + waste_percent / 100;

  const quantities: StepResult['quantities'] = {};

  // ─── แผ่นหลังคา (Roofing Tiles/Sheets) ───────────────────
  // อัตราการใช้ (ต่อ 1 ตร.ม.) *อิงค่าโดยประมาณ
  const coverageMap = { 
    cpac: { factor: 11, uom: 'แผ่น', label: 'กระเบื้องคอนกรีต (แผ่นลอน)' },
    excella: { factor: 10.5, uom: 'แผ่น', label: 'กระเบื้องเซรามิค (Excella)' },
    metal_sheet: { factor: 1, uom: 'ตร.ม.', label: 'แผ่นเมทัลชีท (รวมซ้อนทับแล้ว)' },
    corrugated: { factor: 2.2, uom: 'แผ่น', label: 'กระเบื้องลอนคู่ (1.20ม.)' },
    shingle: { factor: 1, uom: 'ตร.ม.', label: 'ยางมะตอย (Asphalt Shingle)' },
  } as const;

  const roofSpec = coverageMap[roofing_type];
  const roofing_qty = r2(A * wf * roofSpec.factor);
  
  quantities.roofing_main = { 
    qty: roofing_qty, 
    uom: roofSpec.uom, 
    label: roofSpec.label 
  };

  // ─── ครอบสันหลังคาและตะเข้สัน (Ridge & Hip Caps) ───────────
  // ครอบ 1 แผ่น โคเวอร์ประมาณ 0.33 ม. (ใช้ 3 แผ่น / ม.)
  const ridgeLen = inp.ridge_length_m ?? 0;
  const hipLen = inp.hip_length_m ?? 0;
  const totalCapLen = ridgeLen + hipLen;

  if (totalCapLen > 0) {
    if (roofing_type === 'metal_sheet') {
      // เมทัลชีทสั่งพับเป็นเมตร
      quantities.ridge_cap = { qty: r2(totalCapLen * wf), uom: 'm', label: 'ครอบสันตะเข้ (Flashing)' };
    } else {
      // กระเบื้องใช้แผ่นครอบ
      const capQty = Math.ceil((totalCapLen * 3.3) * wf);
      quantities.ridge_cap = { qty: capQty, uom: 'แผ่น', label: 'ครอบสันหลังคา/ตะเข้สัน' };
      // ปูนทราย/ระบบแห้ง (Dry Tech System) สำหรับยึดครอบสัน
      quantities.dry_tech = { qty: r2(totalCapLen * wf), uom: 'm', label: 'ชุดอุปกรณ์ยึดครอบระบบแห้ง (Dry Tech)' };
    }
  }

  // ─── ตะเข้ราง (Valley Gutter) ───────────────────────────
  if (inp.valley_length_m) {
    quantities.valley_gutter = { 
      qty: r2(inp.valley_length_m * wf), 
      uom: 'm', 
      label: 'รางน้ำตะเข้ (สแตนเลส/สังกะสี)' 
    };
  }

  // ─── ไม้เชิงชาย + ปิดพาสเซีย (Eave Board & Fascia) ────────
  if (inp.eave_length_m) {
    // ใช้ไม้เชิงชาย 1 ชั้น และไม้ปิดทับ 1 ชั้น
    quantities.eave_board = { qty: r2(inp.eave_length_m * wf), uom: 'm', label: 'ไม้เชิงชาย (หน้า 8") + ไม้ปิดทับ (หน้า 6")' };
  }

  // ─── ฉนวนกันความร้อน (Insulation) ─────────────────────────
  if (inp.insulation_required) {
    quantities.insulation = { qty: r2(A * wf), uom: 'm²', label: 'แผ่นสะท้อนความร้อน (Foil) / ฉนวน PE' };
  }

  // ─── แผ่นปิดกันนก (Bird Block / Eave Filler) ──────────────
  if (inp.bird_block_required && inp.eave_length_m) {
    if (roofing_type === 'metal_sheet') {
      quantities.bird_block = { qty: r2(inp.eave_length_m * wf), uom: 'm', label: 'โฟมกันนก (Eave Filler)' };
    } else {
      quantities.bird_block = { qty: r2(inp.eave_length_m * wf), uom: 'm', label: 'หวีกันนก PVC' };
    }
  }

  const warnings: string[] = [];
  if (A > 0) {
    if (roofing_type === 'shingle' && inp.insulation_required) {
      warnings.push('หลังคายางมะตอย (Asphalt Shingle) จำเป็นต้องมีไม้อัด OSB รองรับด้านล่าง และแผ่นรองกันน้ำ (Underlayment) ไม่งั้นปูไม่ได้และเกิดการรั่วซึมอย่างรุนแรง');
    }
    if ((inp.eave_length_m ?? 0) === 0) {
      warnings.push('คุณไม่ได้กรอกความยาวขอบ "เชิงชาย (Eave)" ชานไม้รอบหลังคาจะเปลือย ไม่มีไม้ปิดพาสเซีย และติดรางน้ำฝนไม่ได้');
    }
    if ((ridgeLen + hipLen) === 0) {
      warnings.push('หากบ้านเป็นทรงจั่วหรือปั้นหยา อย่าลืมกรอก "ความยาวสันตรง/ตะเข้สัน" มิฉะนั้น BOQ จะตกหล่นรายการ "ครอบสันและDry Tech" อาจเกิดการรั่วซึมบริเวณจุดยอดแนวสันหลังคา');
    }
    if (waste_percent < 5) {
      warnings.push('ข้อควรระวัง: การเผื่อวัสดุเสีย (Waste) ของงานหลังคาต่ำกว่า 5% อาจไม่เพียงพอ ขอแนะนำให้ตั้งค่าระหว่าง 5-10% เพื่อชดเชยการตัดแต่งกระเบื้องลอน');
    }
    if (inp.valley_length_m && (inp.valley_length_m > 0) && (hipLen === 0)) {
      warnings.push('มีตะเข้ราง (รางระบายน้ำหุบเขา) แต่ไม่มี "ตะเข้สัน" (Hip) โปรดเช็คแบบหลังคาอีกครั้ง มักจะมาคู่กันสำหรับหลังคาทรงซับซ้อน');
    }
  }

  return {
    quantities, warnings,
    qc_flags: [], // Removed step-level QC per user request
  };
}
