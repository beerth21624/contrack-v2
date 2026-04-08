import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 31 Contract ────────────────────────────────────────────────────────
/** ประตู/หน้าต่างไม้แต่ละรายการ */
export interface WoodDWEntry {
  label: string;                       // ป้าย เช่น "WD1", "WW1"
  type: 'door' | 'window';
  count: number;                       // จำนวน
  width_m: number;                     // กว้าง (ม.)
  height_m: number;                    // สูง (ม.)
}

/** ติดตั้งประตู–หน้าต่างไม้ (Wooden Doors & Windows) */
export interface Step31Input {
  items: WoodDWEntry[];                // รายการประตู/หน้าต่างไม้
  waste_percent: number;               // default 5
  frame_type: 'teak' | 'hardwood' | 'pine' | 'engineered' | 'wpc';
  hardware_set_count?: number;         // override ชุดอุปกรณ์
  has_door_lock: boolean;              // ติดลูกบิด/กุญแจ ประตูทุกบาน
}

// ─── STEP 31 — ประตู–หน้าต่างไม้ ─────────────────────────────────────────────
export function calcStep31(inp: Step31Input): StepResult {
  const { items, frame_type, has_door_lock } = inp;

  let totalDoorCount = 0;
  let totalWindowCount = 0;
  let totalDoorArea = 0;
  let totalWindowArea = 0;
  let totalFrameLen = 0; // เส้นรอบวงกบ (ม.)

  for (const item of items) {
    const area = r2(item.width_m * item.height_m * item.count);
    const perim = r2((item.width_m + item.height_m) * 2 * item.count);
    if (item.type === 'door') {
      totalDoorCount += item.count;
      totalDoorArea += area;
    } else {
      totalWindowCount += item.count;
      totalWindowArea += area;
    }
    totalFrameLen += perim;
  }

  const FRAME_LABELS: Record<string, string> = {
    teak: 'ไม้สัก', hardwood: 'ไม้เนื้อแข็ง (เต็ง/แดง)', pine: 'ไม้สน', engineered: 'ไม้ประกอบ/HDF', wpc: 'WPC/UPVC'
  };

  const quantities: StepResult['quantities'] = {};

  // 1. บานประตู
  if (totalDoorCount > 0)
    quantities.doors = { qty: totalDoorCount, uom: 'ชุด', label: `บานประตูไม้ + วงกบ (${FRAME_LABELS[frame_type]})` };

  // 2. หน้าต่าง
  if (totalWindowCount > 0)
    quantities.windows = { qty: totalWindowCount, uom: 'ชุด', label: `หน้าต่างไม้ + วงกบ (${FRAME_LABELS[frame_type]})` };

  // 3. Hardware (ลูกบิด/กุญแจ + บานพับ)
  const hwCount = inp.hardware_set_count ?? totalDoorCount;
  if (hwCount > 0)
    quantities.hardware = { qty: hwCount, uom: 'ชุด', label: `อุปกรณ์ ${has_door_lock ? 'ลูกบิดกุญแจ' : 'ลูกบิด'} + บานพับ` };

  // 4. ซิลิโคน/PU Sealant ยาแนวรอบวงกบ
  if (totalFrameLen > 0) {
    const sealantTubes = Math.ceil(totalFrameLen / 6); // 1 หลอด ≈ 6 ม.
    quantities.sealant = { qty: sealantTubes, uom: 'หลอด', label: 'ซิลิโคน/PU ยาแนวรอบวงกบ (@6 ม./หลอด)' };
  }

  // 5. สีทาไม้/แลกเกอร์ (เฉพาะไม้จริงที่ต้องทำสี)
  if (!['engineered', 'wpc'].includes(frame_type)) {
    const paintArea = (totalDoorArea + totalWindowArea) * 2; // ทา 2 หน้า
    const woodFinishGal = Math.ceil(paintArea / 12); // 12 m²/gal
    if (woodFinishGal > 0)
      quantities.wood_finish = { qty: woodFinishGal, uom: 'แกลลอน', label: `สีย้อมไม้/แลกเกอร์ (${r2(paintArea)} m² × 2 หน้า)` };
  }

  const warnings: string[] = [];
  if (items.length === 0) {
    warnings.push('ข้อสังเกต: ยังไม่ได้ระบุรายการประตูและหน้าต่างไม้ (ในกรณีที่โครงการใช้อะลูมิเนียมทั้งหมด สามารถข้ามขั้นตอนนี้ได้)');
  } else {
    if (frame_type === 'pine' && totalWindowCount > 0) {
      warnings.push('ข้อเสนอแนะเชิงวิศวกรรม: ไม้สนมีความต้านทานต่อความชื้นและปลวกต่ำ แนะนำให้ระบุข้อกำหนดในการเคลือบน้ำยากันปลวกและวัสดุกันซึมก่อนการติดตั้ง 100%');
    }
    if (frame_type === 'engineered' && totalWindowCount > 0) {
      warnings.push('ข้อควรระวัง: ไม้ Engineered ไม่เหมาะสำหรับการใช้งานเป็นหน้าต่างภายนอก เนื่องจากความต้านทานต่อความชื้นต่ำและเสี่ยงต่อการบวมหลุดร่อน แนะนำพิจารณาเปลี่ยนเป็นไม้เนื้อแข็ง อะลูมิเนียม หรือ UPVC');
    }
    if (has_door_lock && totalDoorCount > 0) {
      warnings.push('ข้อควรระวัง: ระบุรายการประตูแต่ไม่ได้เลือกชุดอุปกรณ์ลูกบิด/กุญแจ อาจทำให้ตกหล่นค่าวัสดุและค่าแรงติดตั้งอุปกรณ์ฮาร์ดแวร์ใน BOQ');
    }
    if (inp.waste_percent === 0) {
      warnings.push('ข้อควรระวัง: การตั้งค่าหักเผื่อ (Waste) สำหรับงานสีและยาแนวเป็น 0% อาจมีความเสี่ยงด้านปริมาณวัสดุไม่เพียงพอ แนะนำให้เผื่อการสูญเสียหน้างานอย่างน้อย 5%');
    }
  }

  return { quantities, warnings, qc_flags: [] };
}
