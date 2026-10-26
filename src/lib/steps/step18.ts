import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 18 Contract ────────────────────────────────────────────────────────
/** ห้องแต่ละห้อง (สำหรับฉาบปูน) */
export interface PlasterRoomEntry {
  label: string;                       // ชื่อห้อง เช่น "ห้องนั่งเล่น"
  width_m: number;                     // กว้าง (ม.)
  length_m: number;                    // ยาว (ม.)
  wall_height_m: number;              // ความสูงผนัง (ม.) default 2.70
  opening_area_m2: number;             // หักพื้นที่ช่องเปิด (ประตู/หน้าต่าง) ม²
  location: 'interior' | 'exterior';   // ภายใน/ภายนอก
}

/** งานฉาบปูน (Plastering) — input fields */
export interface Step18Input {
  rooms: PlasterRoomEntry[];           // รายการห้อง/ผนัง
  skim_coat_interior: boolean;         // Skim Coat ภายใน
  skim_coat_exterior: boolean;         // Skim Coat ภายนอก
  waste_percent: number;               // 5-10%
}

// ─── STEP 18 — งานฉาบปูน ─────────────────────────────────────────────────────
export function calcStep18(inp: Step18Input): StepResult {
  const { rooms, skim_coat_interior, skim_coat_exterior, waste_percent } = inp;
  const wf = 1 + waste_percent / 100;

  let totalExterior = 0;
  let totalInterior = 0;

  for (const r of rooms) {
    const perimeter = 2 * (r.width_m + r.length_m);
    const wallArea = Math.max(0, perimeter * r.wall_height_m - r.opening_area_m2);
    if (r.location === 'exterior') totalExterior += wallArea;
    else totalInterior += wallArea;
  }

  const quantities: StepResult['quantities'] = {};

  if (totalExterior > 0) {
    quantities.plaster_exterior = {
      qty: r2(totalExterior * wf), uom: 'm²',
      label: `ปูนฉาบผนังภายนอก (${r2(totalExterior)} ม²)`
    };
  }
  if (totalInterior > 0) {
    quantities.plaster_interior = {
      qty: r2(totalInterior * wf), uom: 'm²',
      label: `ปูนฉาบผนังภายใน (${r2(totalInterior)} ม²)`
    };
  }

  let skimArea = 0;
  if (skim_coat_exterior) skimArea += totalExterior;
  if (skim_coat_interior) skimArea += totalInterior;

  if (skimArea > 0) {
    quantities.skim_coat = {
      qty: r2(skimArea * wf), uom: 'm²',
      label: 'สกิมโค้ท (Skim Coat) ตกแต่งผิวเรียบ'
    };
  }

  const warnings: string[] = [];
  if (rooms.length === 0) {
    warnings.push('ยังไม่ได้เพิ่มห้อง/พื้นที่ผนังสำหรับฉาบ');
  } else {
    if (totalExterior === 0 && totalInterior === 0) {
      warnings.push('พื้นที่ฉาบรวมเป็น 0 กรุณาตรวจสอบขนาดกว้างยาวของห้อง');
    }

    let hasExteriorOpening = false;
    for (const r of rooms) {
      if (r.location === 'exterior' && r.opening_area_m2 > 0) hasExteriorOpening = true;
      if (r.width_m === 0 || r.length_m === 0) warnings.push(`ห้อง ${r.label} มีด้านใดด้านหนึ่งยาว 0 ม. ส่งผลให้ผืนผนังหายไปด้านหนึ่ง`);
    }

    if (totalExterior > 0 && !hasExteriorOpening) {
      warnings.push('ข้อสังเกต: มีการระบุผนังภายนอกแต่ไม่มีการหักพื้นที่ช่องเปิด อาจทำให้ประมาณการวัสดุปูนฉาบไว้สูงกว่าความเป็นจริง');
    }

    if (waste_percent === 0) {
      warnings.push('ข้อควรระวัง: การเผื่อวัสดุเสีย (Waste) สำหรับปูนฉาบเป็น 0% อาจไม่เพียงพอ เนื่องจากการร่วงหล่นระหว่างการฉาบ แนะนำให้เผื่อ 10-15%');
    }

    warnings.push('ข้อควรระวัง: อย่าลืมคำนวณ "เซี้ยม PVC/เซี้ยมปูน" และ "ตาข่ายกรงไก่ (กันร้าวตามขอบวงกบ/ท่อมุม)" เพิ่มในรายการเบ็ดเตล็ดด้วยครับ');
  }

  return { quantities, warnings, qc_flags: [] };
}
