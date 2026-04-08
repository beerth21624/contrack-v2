import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 24 Contract ────────────────────────────────────────────────────────
/** ประตู/หน้าต่างแต่ละรายการ (จาก Door & Window Schedule) */
export interface DoorWindowEntry {
  label: string;                       // ป้าย เช่น "D1", "W1", "W2", "SD1"
  type: 'door' | 'window' | 'sliding_door' | 'fixed';
  count: number;                       // จำนวน
  width_m: number;                     // กว้าง (ม.)
  height_m: number;                    // สูง (ม.)
}

/** ติดตั้งประตู-หน้าต่างอลูมิเนียม (Aluminium Doors & Windows) */
export interface Step24Input {
  items: DoorWindowEntry[];            // รายการประตู/หน้าต่าง
  waste_percent: number;               // default 5
  sealant_length_m?: number;           // ซีลยาแนวกรอบ ม.
  glass_thickness_mm?: number;
}

// ─── STEP 24 — ประตู-หน้าต่าง อลูมิเนียม ────────────────────────────────────
export function calcStep24(inp: Step24Input): StepResult {
  const { items, waste_percent } = inp;
  const wf = 1 + waste_percent / 100;

  let totalDoorArea = 0;
  let totalDoorCount = 0;
  let totalWindowArea = 0;
  let totalWindowCount = 0;
  let totalSlidingCount = 0;
  let totalPerimeter = 0;

  for (const item of items) {
    const area = item.count * item.width_m * item.height_m;
    const perimeter = item.count * 2 * (item.width_m + item.height_m);
    totalPerimeter += perimeter;

    if (item.type === 'door') {
      totalDoorArea += area;
      totalDoorCount += item.count;
    } else if (item.type === 'sliding_door') {
      totalDoorArea += area;
      totalSlidingCount += item.count;
    } else {
      totalWindowArea += area;
      totalWindowCount += item.count;
    }
  }

  const quantities: StepResult['quantities'] = {};

  if (totalDoorCount > 0) {
    quantities.door_set = { qty: totalDoorCount, uom: 'ชุด', label: `ชุดประตูอลูมิเนียม (บานเปิด)` };
    quantities.door_area = { qty: r2(totalDoorArea), uom: 'm²', label: `พื้นที่ประตูอลูรวม` };
  }
  if (totalSlidingCount > 0) {
    quantities.sliding = { qty: totalSlidingCount, uom: 'ชุด', label: `ประตูบานเลื่อน` };
  }
  if (totalWindowCount > 0) {
    quantities.window_set = { qty: totalWindowCount, uom: 'ชุด', label: `ชุดหน้าต่างอลูมิเนียม` };
    quantities.window_area = { qty: r2(totalWindowArea), uom: 'm²', label: `พื้นที่หน้าต่างอลูรวม` };
  }

  // ─── ซีลยาแนวกันน้ำ ─────────────────────────────────────
  const sealant = inp.sealant_length_m ?? r2(totalPerimeter); // auto = รอบกรอบทั้งหมด
  if (sealant > 0) {
    quantities.sealant = { qty: r2(sealant * wf), uom: 'm', label: `ซีลยาแนวกรอบ (PU/Silicone Sealant) ป้องกันน้ำซึมตามรอยต่อหน้าต่าง` };
  }

  // ─── มุ้งลวด (ประมาณการ) ────────────────────────────────
  if (totalWindowArea > 0 || totalSlidingCount > 0) {
    quantities.mosquito_net = {
      qty: r2((totalWindowArea + (totalSlidingCount * 2.0)) * 0.5), // คิดว่า 50% ของหน้าต่างเป็นบานเปิด/สไลด์ที่ต้องมีมุ้ง
      uom: 'm²', label: 'มุ้งลวดหน้าต่างและประตูลูกกลิ้ง (คำนวณเผื่อ 50%)'
    };
  }


  const warnings: string[] = [];
  if (items.length === 0) {
    warnings.push('ยังไม่ได้เพิ่มรายการประตูหน้าต่าง เข้าไปดูแปลน (Door & Window Schedule) เพื่อมากดเพิ่มได้เลยครับ');
  } else {
    for (const item of items) {
      if (item.width_m || item.height_m || item.count) {
         warnings.push(`มีหน้าต่าง/ประตูรหัส ${item.label} ที่ไม่ได้ระบุขนาดความกว้าง, สูง หรือจำนวน ระวังคิดราคาตกหล่น อาจส่งผลให้การประมาณการงบประมาณผิดพลาดได้`);
         break;
      }
    }

    if (inp.glass_thickness_mm === undefined) {
      warnings.push('ยังไม่ได้ระบุ "ความหนากระจก" ส่งผลต่อราคามากๆ ครับ (กระจก 5 มม. กับ 8 มม. ราคาต่างกันมากกว่า 30%)');
    } else if (inp.glass_thickness_mm < 6) {
      warnings.push(`สเปคกระจกภายนอก ${inp.glass_thickness_mm} มม.ค่อนข้างบางต้านแรงปะทะลม (Wind load) และเสียงรบกวนได้น้อย แนะนำ 6 มม. ขึ้นไปสำหรับงานมาตรฐาน`);
    }

    if (waste_percent === 0) {
      warnings.push('คุณไม่ได้เผื่อเศษอลูมิเนียมเลย (Waste 0%) อลูมิเนียมมาเป็นเส้น 6 เมตร ตอนตัดทำกรอบมักจะเหลือเศษเส้นสั้นๆ ที่เอาไปประกอบต่อไม่ได้เสมอ แนะนำเผื่อสัก 5-10% ครับ');
    }

    if (inp.sealant_length_m) {
      warnings.push('ระบบกำลังประเมินระยะทาง ซีลยาแนวกรอบ (Silicone/PU) อัตโนมัติจากเส้นรอบรูปทั้งหมดที่กรอกมา.. กรุณารีเช็คอีกครั้ง เพราะงานอลูมิเนียมถ้ายิงซิลิโคนไม่ดี น้ำรั่วเข้าบ้านแก้ปัญหายากมาก');
    }
  }

  return { quantities, warnings, qc_flags: [] };
}
