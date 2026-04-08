import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 33 Contract ────────────────────────────────────────────────────────
/** ป้องกันความเสียหาย, ทำความสะอาด และทดสอบระบบ (Protection, Cleaning & Testing) */
export interface Step33Input {
  // ─── Cleaning & Protection ──────────────────────────────
  total_floor_area_m2: number;         // พื้นที่ทำความสะอาดและปูไม้อัด/ลูกฟูกกันรอย (ม²)
  protection_required: boolean;        // ต้องการปูวัสดุกันรอยพื้นที่สร้างเสร็จแล้วหรือไม่
  
  // ─── Testing & Commissioning ──────────────────────────
  pressure_test_systems: number;       // จำนวนระบบท่อที่ต้องทำ Pressure Test (เช่น ประปา, สุขาภิบาล)
  megger_test_required: boolean;       // ต้องการตรวจสอบฉนวนไฟฟ้า (Megger Test) หรือไม่
  
  // ─── Defect Contingency (Lump Sum) ────────────────────
  defect_contingency_lump_sum?: boolean; // เผื่องบประมาณเก็บงาน/แต้มสี (Touch-up & Rework) หรือไม่
}

export function calcStep33(inp: Step33Input): StepResult {
  const {
    total_floor_area_m2, protection_required,
    pressure_test_systems, megger_test_required,
    defect_contingency_lump_sum
  } = inp;

  const quantities: StepResult['quantities'] = {};

  // 1. Big Cleaning
  if (total_floor_area_m2 > 0) {
    quantities.cleaning = { qty: r2(total_floor_area_m2), uom: 'm2', label: 'Big Cleaning (ทำความสะอาดใหญ่ก่อนส่งมอบ)' };
    // วัสดุทำความสะอาด
    quantities.cleaning_supply = {
      qty: Math.max(1, Math.ceil(total_floor_area_m2 / 100)), uom: 'ชุด',
      label: 'วัสดุทำความสะอาดและน้ำยาเคมี'
    };
  }

  // 2. Surface Protection
  if (protection_required && total_floor_area_m2 > 0) {
    quantities.surface_protection = {
      qty: r2(total_floor_area_m2), uom: 'm2',
      label: 'งานป้องกันความเสียหาย (แผ่นพลาสติกลูกฟูก/ไม้อัดปูพื้น และเทปกาว)'
    };
  }

  // 3. System Testing
  if (pressure_test_systems > 0) {
    quantities.pressure_test = {
      qty: pressure_test_systems, uom: 'ระบบ',
      label: 'ทดสอบแรงดันน้ำ (Pressure Test & Leak Test)'
    };
  }

  if (megger_test_required) {
    quantities.megger_test = {
      qty: 1, uom: 'เหมา',
      label: 'ทดสอบความต้านทานฉนวนไฟฟ้าและกราวด์ (Megger / Ground Test)'
    };
  }

  // 4. Defect Touch-up Contingency
  if (defect_contingency_lump_sum) {
    quantities.touch_up_contingency = {
      qty: 1, uom: 'เหมา',
      label: 'งบประมาณเผื่อเก็บงานสีและเก็บความเรียบร้อย (Touch-up & Rework Contingency)'
    };
  }

  const warnings: string[] = [];

  if (total_floor_area_m2 === 0) {
    warnings.push('ข้อสังเกต: ไม่มีการระบุพื้นที่ทำความสะอาด (Big Cleaning) อาจทำให้ลืมตั้งงบประมาณส่วนนี้ ส่งผลให้หน้างานไม่พร้อมสำหรับการส่งมอบ');
  }

  if (!protection_required && total_floor_area_m2 > 0) {
    warnings.push('ข้อควรระวัง: ไม่ได้เผื่องบประมาณ "งานป้องกันความเสียหาย (Surface Protection)" หากมีการขนย้ายเฟอร์นิเจอร์ หรือช่างสี/แอร์เข้าทำงานหลังปูกระเบื้องเสร็จ อาจเกิดรอยขีดข่วนทำให้ต้องเสียค่าใช้จ่ายรื้อทำใหม่สูงมาก');
  }

  if (pressure_test_systems === 0) {
    warnings.push('ข้อเสนอแนะคุณภาพงาน: การไม่ตั้งงบประมาณทดสอบแรงดันน้ำ (Pressure Test) อาจทำให้เกิดความเสี่ยงท่อประปารั่วซึมฝังในผนังหลังส่งมอบ ซึ่งมีค่าใช้จ่ายสกัดซ่อมแซมแพงกว่าค่าทดสอบหลายเท่า');
  }

  if (!megger_test_required) {
    warnings.push('ข้อเสนอแนะคุณภาพงาน: ควรตั้งงบตรวจสอบความปลอดภัยระบบไฟฟ้า (Megger & Grounding Test) เพื่อลดความเสี่ยงกระแสไฟฟ้ารั่วและป้องกันปัญหาเบรกเกอร์ทริปหลังส่งมอบ');
  }

  if (!defect_contingency_lump_sum) {
     warnings.push('ข้อสังเกต: ในการประมาณราคาโครงการ (BOQ) ตามมาตรฐานสากล ควรเผื่องบประมาณเก็บงาน (Rework Contingency) ไว้เป็นส่วนหนึ่งของต้นทุนแฝง ป้องกันปัญหากำไรหดหายช่วงส่งมอบงาน');
  }

  return { quantities, warnings, qc_flags: [] };
}
