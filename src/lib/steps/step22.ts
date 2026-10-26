import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 22 Contract ────────────────────────────────────────────────────────
/** ตกแต่งผนังภายนอก (Exterior Wall Finish) — input fields */
export interface Step22Input {
  facade_area_m2: number;              // พื้นที่ผนังภายนอกที่ต้องตกแต่ง ม² (หักช่องเปิดแล้ว)
  finish_type: 'paint_only' | 'texture_paint' | 'tile' | 'stone_cladding' | 'wood_cladding';
  waste_percent: number;               // เผื่อเสียหาย (สีทา 5%, กระเบื้อง/หิน 10-15%)
  // optional
  sealant_length_m?: number;           // ซีลยาแนวกันน้ำตามรอยต่อ (ม.)
}

// ─── STEP 22 — งานตกแต่งผนังภายนอก (Exterior Wall Finish) ─────────────────────
export function calcStep22(inp: Step22Input): StepResult {
  const { facade_area_m2, finish_type, waste_percent } = inp;
  const wf = 1 + waste_percent / 100;

  const quantities: StepResult['quantities'] = {};

  // ─── 1. วัสดุตกแต่งผนังภายนอก ───────────────────────────
  const labelMap: Record<string, string> = {
    paint_only: 'สีทาภายนอก (จัดการอยู่ Step 25)',
    texture_paint: 'สีเทกซ์เจอร์ภายนอก (Texture Paint)',
    tile: 'กระเบื้องบุผนังภายนอก',
    stone_cladding: 'หินเทียม / หินตกแต่งผนัง',
    wood_cladding: 'ไม้ฝาตกแต่งภายนอก (เช่น Shera, SCG)',
  };

  // ถ้าเลือก paint_only ไม่ต้องคำนวณวัสดุเพิ่มเพราะจะถูกจัดการใน Step 25 (ทาสี)
  if (finish_type !== 'paint_only') {
    quantities.facade_material = {
      qty: r2(facade_area_m2 * wf),
      uom: 'm²',
      label: labelMap[finish_type] ?? 'วัสดุตกแต่งผนังภายนอก'
    };
  }

  // ─── 2. ซีลยาแนวกันน้ำ (Sealant) ──────────────────────
  if (inp.sealant_length_m && inp.sealant_length_m > 0) {
    quantities.sealant = {
      qty: r2(inp.sealant_length_m * wf),
      uom: 'm',
      label: 'ซีลยาแนวกันน้ำ (PU Sealant) ตามรอยต่อวัสดุ'
    };
  }

  // ─── Extras based on Finish Type ──────────────────────
  if (finish_type === 'stone_cladding' && facade_area_m2 > 0) {
    quantities.water_repellent = {
      qty: Math.ceil((facade_area_m2 * wf) / 20), // 1 แกลลอน (3.78L) ทา 2 รอบ ได้ประมาน 15-20 ม²
      uom: 'แกลลอน(GL)',
      label: 'น้ำยาเคลือบเงาใส/กันตะไคร่น้ำ (ทา 2 รอบ)'
    };
  }
  if (finish_type === 'wood_cladding' && facade_area_m2 > 0) {
    quantities.cladding_frame = {
      qty: r2(facade_area_m2 * wf),
      uom: 'm²',
      label: 'โครงเหล็กกัลวาไนซ์ หรือ C-Line สำหรับยึดไม้ฝา'
    };
  }

  const warnings: string[] = [];
  if (facade_area_m2 === 0 && finish_type !== 'paint_only') {
    warnings.push('พื้นที่ตกแต่งผนังภายนอกเป็น 0 ม. กรุณาระบุพื้นที่ครับ');
  } else if (facade_area_m2 > 0) {
    if (finish_type === 'paint_only') {
      warnings.push('เลือก "สีทาอย่างเดียว" — ระบบจะไม่คำนวณราคาวัสดุที่นี่ เพราะต้องไปคิดรวมกับพื้นที่ทาสีทั้งหมดใน "Step 25 (ทาสี)" ครับ');
    }

    if ((finish_type === 'tile' || finish_type === 'stone_cladding') && !inp.sealant_length_m) {
      warnings.push('คุณกรุวัสดุแผ่นแข็งภายนอก แต่ไม่มี "ซีลยาแนว (PU Sealant)" บริเวณขอบที่ชนกับหน้าต่างหรือปูนฉาบ น้ำฝนจะซึมเข้าหลังแผ่นจนกำแพงข้างในอาจส่งผลให้เกิดความเสียหายจากความชื้นหรือน้ำรั่วซึมได้');
    }

    if ((finish_type === 'tile' || finish_type === 'stone_cladding') && facade_area_m2 > 15) {
      warnings.push('กรุหิน/กระเบื้องผนังภายนอกที่สูงหรือพื้นที่เยอะ จำเป็นต้องพิจารณาใช้ระบบประกอบยึดเชิงกล (Mechanical Anchor) หรือการตอกลวดกรงไก่เพื่อความปลอดภัย');
    }

    if (finish_type !== 'paint_only' && waste_percent === 0) {
      warnings.push('เปอร์เซ็นต์เผื่อเสีย (Waste) เป็น 0% งานกรุผนังช่างต้องตัดมุมเข้าขอบหน้าต่าง/ซอกเสาเยอะมาก แนะนำเผื่อหิน/กระเบื้องที่ 10-15% และไม้ฝาที่ 7% ขั้นต่ำครับ');
    }
  }

  return { quantities, warnings, qc_flags: [] };
}
