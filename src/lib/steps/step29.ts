import { type StepResult } from '@/types';

// ─── Step 29 Contract ────────────────────────────────────────────────────────
/** อุปกรณ์เบ็ดเตล็ด (Miscellaneous Fixtures & Accessories) */
export interface Step29Input {
  // ─── ม่าน / มู่ลี่ ────────────────────────────────────
  curtain_rail_m: number;              // ราวม่านแบบรางเลื่อน (ม.)
  blind_window_count: number;          // จำนวนหน้าต่างติดมู่ลี่

  // ─── อุปกรณ์ห้องน้ำ ──────────────────────────────────
  towel_bar_count: number;             // ราวแขวนผ้า
  soap_dish_count: number;             // ที่วางสบู่/ที่กดสบู่
  paper_holder_count: number;          // ที่แขวนกระดาษทิชชู
  mirror_count: number;                // กระจกเงา

  // ─── อุปกรณ์ประตู / ความปลอดภัย ───────────────────────
  door_stopper_count: number;          // กันกระแทก (ทุกบาน)
  door_closer_count: number;           // โช้คอัพประตู
  peephole_count: number;              // ตาแมว
  house_number_set: number;            // เลขที่บ้าน (ชุด)

  // ─── เฟอร์นิเจอร์ Built-in ──────────────────────────
  shelf_set_count: number;             // ชั้นวาง/ชั้นรองเท้า
  cabinet_count: number;               // ตู้ Built-in (ครัว/ห้องนอน)

  // ─── ภายนอก ──────────────────────────────────────────
  mailbox: boolean;                    // ตู้จดหมาย
  clothesline_m: number;              // ราวตากผ้า (ม.)
}

export function calcStep29(inp: Step29Input): StepResult {
  const quantities: StepResult['quantities'] = {};

  // ─── ม่าน ──────────────────────────────────────────────
  if (inp.curtain_rail_m > 0)
    quantities.curtains = { qty: Math.ceil(inp.curtain_rail_m), uom: 'm', label: 'ราวม่านแบบรางเลื่อน' };
  if (inp.blind_window_count > 0)
    quantities.blinds = { qty: inp.blind_window_count, uom: 'ชุด', label: 'มู่ลี่/ม่านม้วน (ต่อหน้าต่าง)' };

  // ─── อุปกรณ์ห้องน้ำ ──────────────────────────────────
  if (inp.towel_bar_count > 0)
    quantities.towel_bar = { qty: inp.towel_bar_count, uom: 'อัน', label: 'ราวแขวนผ้าเช็ดตัว สแตนเลส' };
  if (inp.soap_dish_count > 0)
    quantities.soap_dish = { qty: inp.soap_dish_count, uom: 'อัน', label: 'ที่กดสบู่เหลว/ที่วางสบู่' };
  if (inp.paper_holder_count > 0)
    quantities.paper_holder = { qty: inp.paper_holder_count, uom: 'อัน', label: 'ที่แขวนกระดาษทิชชู' };
  if (inp.mirror_count > 0)
    quantities.mirror = { qty: inp.mirror_count, uom: 'ชุด', label: 'กระจกเงาห้องน้ำ + กรอบ' };

  // ─── อุปกรณ์ประตู ──────────────────────────────────────
  if (inp.door_stopper_count > 0)
    quantities.stopper = { qty: inp.door_stopper_count, uom: 'อัน', label: 'กันกระแทกประตู (สแตนเลส)' };
  if (inp.door_closer_count > 0)
    quantities.closer = { qty: inp.door_closer_count, uom: 'ตัว', label: 'โช้คอัพประตู (Door Closer)' };
  if (inp.peephole_count > 0)
    quantities.peephole = { qty: inp.peephole_count, uom: 'อัน', label: 'ตาแมว (Peephole)' };
  if (inp.house_number_set > 0)
    quantities.house_number = { qty: inp.house_number_set, uom: 'ชุด', label: 'เลขที่บ้าน สแตนเลส' };

  // ─── เฟอร์นิเจอร์ Built-in ──────────────────────────
  if (inp.shelf_set_count > 0)
    quantities.shelves = { qty: inp.shelf_set_count, uom: 'ชุด', label: 'ชั้นวางของ/ชั้นรองเท้า' };
  if (inp.cabinet_count > 0)
    quantities.cabinet = { qty: inp.cabinet_count, uom: 'ตัว', label: 'ตู้ Built-in (ครัว/ห้องนอน)' };

  // ─── ภายนอก ──────────────────────────────────────────
  if (inp.mailbox)
    quantities.mailbox = { qty: 1, uom: 'ชุด', label: 'ตู้จดหมาย สแตนเลส' };
  if (inp.clothesline_m > 0)
    quantities.clothesline = { qty: Math.ceil(inp.clothesline_m), uom: 'm', label: 'ราวตากผ้า สแตนเลส' };

  // ─── Warnings ──────────────────────────────────────────
  const warnings: string[] = [];
  const totalItems = Object.keys(quantities).length;
  if (totalItems === 0) {
    warnings.push('ข้อสังเกต: ยังไม่ได้ระบุรายการเบ็ดเตล็ด (กรณีที่เจ้าของโครงการเป็นผู้จัดหาวัสดุ ควรพิจารณาเผื่อประเมินค่าแรงติดตั้งเพื่อป้องกันการตกหล่น)');
  } else {
    if (inp.door_stopper_count === 0) {
      warnings.push('ข้อควรระวัง: ไม่ได้ระบุกันกระแทกประตู (Door Stopper) แนะนำให้ระบุจำนวนให้สอดคล้องกับกรอบเขตประตูบานเปิดเพื่อป้องกันความเสียหายต่อผนัง');
    }
    if (inp.mirror_count === 0 && inp.towel_bar_count === 0) {
      warnings.push('ข้อสังเกต: ไม่มีการระบุอุปกรณ์กระจกเงาหรือราวแขวนผ้าในห้องน้ำ หากเจ้าของโครงการเป็นผู้ดำเนินการจัดหา ให้ตรวจสอบความชัดเจนเรื่องค่าแรงติดตั้งล่วงหน้า');
    }
  }

  return { quantities, warnings, qc_flags: [] };
}
