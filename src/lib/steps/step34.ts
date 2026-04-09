import { type StepResult } from '@/types';

// ─── Step 34 Contract ────────────────────────────────────────────────────────
/** เก็บรายละเอียดงาน & ส่งมอบ (Project Handover) */
export interface Step34Input {
  document_set_count: number;          // จำนวนชุดเอกสาร As-built
  warranty_years: number;              // ระยะเวลารับประกัน (ปี)
  key_set_count: number;               // จำนวนชุดกุญแจ

  // ─── Handover documents ────────────────────────────────
  has_asbuilt_drawing: boolean;        // แบบ As-built
  has_equipment_manual: boolean;       // คู่มืออุปกรณ์
  has_warranty_cert: boolean;          // ใบรับประกัน
  has_photo_record: boolean;           // ภาพถ่ายบันทึกก่อสร้าง

  // ─── optional ─────────────────────────────────────────
  punch_list_remaining?: number;       // Punch list ค้าง
  handover_training: boolean;          // สอนการใช้งานอุปกรณ์

  // ─── Cleaning ───────────────────────────────────────────
  big_cleaning_required?: boolean;
  building_area_m2?: number;
}

export function calcStep34(inp: Step34Input): StepResult {
  const quantities: StepResult['quantities'] = {};

  // 1. เอกสาร As-built
  quantities.as_built_docs = {
    qty: inp.document_set_count, uom: 'ชุด',
    label: 'เอกสาร As-built / คู่มือบ้าน'
  };

  // 2. กุญแจ
  quantities.key_sets = {
    qty: inp.key_set_count, uom: 'ชุด',
    label: 'ชุดกุญแจ (ประตูหน้า/หลัง/ห้อง)'
  };

  // 3. ใบรับประกัน
  if (inp.has_warranty_cert)
    quantities.warranty = { qty: inp.warranty_years, uom: 'ชุด', label: `ใบรับประกัน ${inp.warranty_years} ปี` };

  // 4. ภาพถ่าย
  if (inp.has_photo_record)
    quantities.photos = { qty: 1, uom: 'ชุด', label: 'ภาพถ่ายบันทึกก่อสร้าง (USB/Cloud)' };

  // 5. แบบ As-built Drawing
  if (inp.has_asbuilt_drawing)
    quantities.drawing = { qty: inp.document_set_count, uom: 'ชุด', label: 'แบบ As-built Drawing' };

  // 6. คู่มืออุปกรณ์
  if (inp.has_equipment_manual)
    quantities.manual = { qty: 1, uom: 'ชุด', label: 'คู่มืออุปกรณ์ (แอร์/น้ำอุ่น/ฯลฯ)' };

  // 7. Handover training
  if (inp.handover_training)
    quantities.training = { qty: 1, uom: 'วัน', label: 'สอนการใช้งาน (ไฟฟ้า/ประปา/แอร์)' };

  // 8. Big Cleaning
  if (inp.big_cleaning_required && inp.building_area_m2) {
    quantities.big_cleaning = { qty: inp.building_area_m2, uom: 'm²', label: 'ทำความสะอาดก่อนส่งมอบ (Big Cleaning)' };
  }

  const warnings: string[] = [];
  if (inp.document_set_count === 0) {
      warnings.push('ข้อสังเกต: จำนวนชุดเอกสารพิมพ์เขียว/คู่มือบ้านเป็น 0 แนะนำให้จัดเตรียมอย่างน้อย 2 ชุด (สำหรับอ้างอิงและสำหรับลูกค้า) เพื่อความสมบูรณ์ในการส่งมอบ');
  }
  if (inp.key_set_count === 0) {
      warnings.push('ข้อสังเกต: จำนวนชุดกุญแจที่ต้องส่งมอบเป็น 0 กรุณาตรวจสอบให้ครบถ้วนเพื่อป้องกันปัญหาความปลอดภัย');
  }
  if (inp.warranty_years === 0) {
      warnings.push('ข้อควรระวัง: ยังไม่ได้ระบุระยะเวลารับประกันผลงาน การปิดบังหรือละเว้นข้อมูลส่วนนี้อาจก่อให้เกิดข้อพิพาททางสัญญากับลูกค้า');
  }
  if ((inp.punch_list_remaining ?? 0) > 0) {
      warnings.push(`ข้อควรระวัง: โครงการยังมีรายการข้อบกพร่องคงค้าง (Punch List) จำนวน ${inp.punch_list_remaining} รายการ กรุณาดำเนินการแก้ไขให้แล้วเสร็จก่อนดำเนินการเซ็นเอกสารส่งมอบงาน`);
  }
  if (!inp.has_warranty_cert && inp.warranty_years > 0) {
      warnings.push('ข้อสังเกต: มีการระบุระยะเวลารับประกัน แต่ไม่มีสถานะส่งมอบใบรับประกัน กรุณาจัดเตรียมเอกสารก่อนวันส่งมอบ');
  }
  if (!inp.has_asbuilt_drawing) {
      warnings.push('ข้อเสนอแนะเชิงวิศวกรรม: ควรมีเอกสาร As-built Drawing ในรายการส่งมอบ เพื่อประโยชน์อ้างอิงในการใช้งานและการซ่อมบำรุงอาคารในอนาคต');
  }

  // สร้าง QC checklist สำหรับวันส่งมอบ
  const qcFlags: string[] = [
    '☐ เซ็นรับมอบบ้าน (ลูกค้า + ผู้รับเหมา)',
    `☐ มอบกุญแจ ${inp.key_set_count} ชุด`,
    inp.has_warranty_cert ? `☐ ส่งใบรับประกัน ${inp.warranty_years} ปี` : '',
    inp.has_asbuilt_drawing ? '☐ ส่งแบบ As-built Drawing' : '',
    inp.has_equipment_manual ? '☐ ส่งคู่มืออุปกรณ์' : '',
    inp.has_photo_record ? '☐ ส่งภาพถ่าย As-built' : '',
    inp.handover_training ? '☐ สอนการใช้งานอุปกรณ์' : '',
    '☐ โอนมิเตอร์ไฟฟ้า/น้ำ (ถ้ามี)',
  ].filter(Boolean);

  return { quantities, warnings, qc_flags: qcFlags };
}
