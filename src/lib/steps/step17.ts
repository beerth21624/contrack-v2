import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 17 Contract ────────────────────────────────────────────────────────
export interface Step17Input {
  total_wall_area_m2: number;          // พื้นที่ผนังรวมทั้งหมด
  doors_windows_area_m2: number;       // พื้นที่เจาะช่องเปิด (ประตู/หน้าต่าง)
  brick_type: 'clay' | 'aac';          // ชนิดอิฐ: มอญ (Clay) หรือ มวลเบา (AAC)
  waste_percent: number;               // เผื่อเสียหาย (ปกติอิฐมอญ 10-15%, มวลเบา 5-10%)
  // optional
  lintel_length_m?: number;            // ความยาวเสาเอ็น-ทับหลัง (ถ้ามี)
}

// ─── STEP 17 — งานก่ออิฐ (Brickwork) ──────────────────────────────────────────
export function calcStep17(inp: Step17Input): StepResult {
  const { total_wall_area_m2, doors_windows_area_m2, brick_type, waste_percent } = inp;
  const wf = 1 + waste_percent / 100;

  // พื้นที่สุทธิ = พื้นที่วอลรวม - พื้นที่ช่องเปิด
  const net_area = Math.max(0, total_wall_area_m2 - doors_windows_area_m2);

  const quantities: StepResult['quantities'] = {};

  // 1. บริมาณอิฐ (Bricks Required)
  // อิฐมอญ (Clay) ประมาณ 144 ก้อน/ตร.ม.
  // อิฐมวลเบา (AAC) ประมาณ 8.78 ก้อน/ตร.ม.
  let factor = 144;
  let label = 'อิฐมอญ';
  if (brick_type === 'aac') {
    factor = 8.78;
    label = 'อิฐมวลเบา AAC';
  }

  const rawQty = net_area * factor;
  const qtyWithWaste = Math.ceil(rawQty * wf);

  quantities.bricks_required = { 
    qty: qtyWithWaste, 
    uom: 'pcs', 
    label: `${label} (พื้นที่ ${r2(net_area)} ม²)` 
  };

  // 2. ปูนก่อ (Mortar)
  // คำนวณเป็นตร.ม. เพื่อไปใช้ราคากลางต่อตร.ม.
  quantities.net_wall_area = {
    qty: r2(net_area * wf),
    uom: 'm²',
    label: `ปูนก่อทั่วไป สำหรับ${label}`
  };

  // 3. เสาเอ็น-ทับหลัง (Lintel & Stiffener)
  if (inp.lintel_length_m && inp.lintel_length_m > 0) {
    quantities.lintel_length = {
      qty: r2(inp.lintel_length_m * wf),
      uom: 'm',
      label: 'คอนกรีตเสาเอ็น-ทับหลัง (รวมเหล็ก)'
    };
  }

  const warnings: string[] = [];
  if (total_wall_area_m2 > 0) {
    if (doors_windows_area_m2 === 0) {
      warnings.push('คุณไม่ได้หัก "พื้นที่ช่องเปิด" (ประตู/หน้าต่าง) เลย (ผนังทึบ 100%) ปกติจะมีเฉพาะกำแพงรั้วหรือห้องเก็บของ โปรดระวังการสั่งอิฐเหลือทิ้งมากเกินความจำเป็น');
    }
    if (doors_windows_area_m2 >= total_wall_area_m2) {
      warnings.push('ข้อสังเกต: พื้นที่ช่องเปิด (ประตู/หน้าต่าง) ที่ระบุมีขนาดมากกว่าหรือเท่ากับพื้นที่ผนังรวม กรุณาตรวจสอบความถูกต้อง กรุณาตรวจสอบตัวเลขอีกครั้ง');
    }
    if (doors_windows_area_m2 > 0 && (inp.lintel_length_m || inp.lintel_length_m === 0)) {
      warnings.push('ข้อควรระวังเชิงโครงสร้าง: มีช่องเปิดผนังแต่ไม่มีการระบุเสาเอ็น-ทับหลัง การละเว้นโครงสร้างส่วนนี้อาจส่งผลให้เกิดรอยแตกร้าวเฉียงบริเวณมุมช่องเปิดในอนาคต');
    }
    if (doors_windows_area_m2 === 0 && total_wall_area_m2 > 12 && (inp.lintel_length_m || inp.lintel_length_m === 0)) {
      warnings.push('แม้จะไม่มีช่องประตู/หน้าต่าง แต่ผนังก่อที่ผืนใหญ่กว่า 9-12 ตร.ม. จำเป็นต้องหล่อ "เสาเอ็น/ทับหลัง" คาดกลางเพื่อกันกำแพงล้มหรือผนังร้าวครับ');
    }
    if (waste_percent === 0) {
      warnings.push('เปอร์เซ็นต์เผื่อแตกหัก (Waste) เป็น 0% ถือว่าข้อควรระวังอย่างยิ่ง: ดินเผา/มวลเบามีการตัดเศษตามซอกมุมและเสียจากการขนย้ายหน้างาน แนะนำเผื่อ 5-10%');
    }
  }

  return { quantities, warnings, qc_flags: [] };
}
