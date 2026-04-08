import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 27 Contract ────────────────────────────────────────────────────────
/** ระบบสุขาภิบาลภายใน (Sanitary — Interior Plumbing) */
export interface Step27Input {
  // ─── จุดใช้น้ำ (นับจากแบบ) ────────────────────────────
  bathroom_count: number;              // จำนวนห้องน้ำ
  kitchen_count: number;               // จำนวนจุดครัว (ซิงค์)
  laundry_point: boolean;              // จุดซักล้าง

  // ─── ท่อ (ถ้ากรอกเอง จะ override auto-calc) ────────────
  supply_pipe_override_m?: number;     // override ท่อน้ำดี
  drain_pipe_override_m?: number;      // override ท่อน้ำทิ้ง

  // ─── ท่อน้ำร้อน ──────────────────────────────────────
  has_hot_water: boolean;              // มีระบบน้ำร้อนหรือไม่
  hot_water_type: 'electric' | 'solar' | 'heat_pump';

  waste_percent: number;               // default 10

  // ─── optional fittings ─────────────────────────────────
  floor_drain_override?: number;
  valve_count_override?: number;
  cleanout_count?: number;
}

// ─── Auto-estimate pipe lengths from point counts ────────────────────────────
// อ้างอิงมาตรฐานวิศวกรรม: ห้องน้ำ ~12 ม. ท่อน้ำดี, ~8 ม. ท่อน้ำทิ้ง, ครัว ~6+4
const SUPPLY_PER_BATH = 12;   // ม./ห้องน้ำ (น้ำเย็น)
const DRAIN_PER_BATH = 8;     // ม./ห้องน้ำ
const SUPPLY_PER_KITCHEN = 6;
const DRAIN_PER_KITCHEN = 4;

export function calcStep27(inp: Step27Input): StepResult {
  const {
    bathroom_count, kitchen_count, laundry_point,
    has_hot_water, hot_water_type, waste_percent,
  } = inp;
  const wf = 1 + waste_percent / 100;

  // ─── auto-calc pipe lengths ──────────────────────────────
  const laundryPts = laundry_point ? 1 : 0;
  const autoSupply = bathroom_count * SUPPLY_PER_BATH + kitchen_count * SUPPLY_PER_KITCHEN + laundryPts * 5;
  const autoDrain = bathroom_count * DRAIN_PER_BATH + kitchen_count * DRAIN_PER_KITCHEN + laundryPts * 4;

  const supplyLen = inp.supply_pipe_override_m ?? autoSupply;
  const drainLen = inp.drain_pipe_override_m ?? autoDrain;

  const quantities: StepResult['quantities'] = {};

  // 1. ท่อน้ำดี
  quantities.supply_pipe = {
    qty: r2(supplyLen * wf), uom: 'm',
    label: `ท่อน้ำดี PVC Ø1/2"-3/4" (${bathroom_count} ห้องน้ำ + ${kitchen_count} ครัว)`
  };

  // 2. ท่อน้ำทิ้ง
  quantities.drain_pipe = {
    qty: r2(drainLen * wf), uom: 'm',
    label: `ท่อน้ำทิ้ง PVC Ø2"-4" (${bathroom_count} ห้องน้ำ + ${kitchen_count} ครัว)`
  };

  // 3. ท่อน้ำร้อน
  if (has_hot_water) {
    const hotLen = bathroom_count * 8 + kitchen_count * 4; // PPR ~8 ม./ห้องน้ำ
    quantities.hot_pipe = {
      qty: r2(hotLen * wf), uom: 'm',
      label: `ท่อน้ำร้อน PPR (${hot_water_type === 'solar' ? 'Solar' : hot_water_type === 'heat_pump' ? 'Heat Pump' : 'ไฟฟ้า'})`
    };
  }

  // 4. ข้อต่อ / วาล์ว
  const totalPoints = bathroom_count + kitchen_count + laundryPts;
  const valveCount = inp.valve_count_override ?? (totalPoints * 2 + 2); // 2 วาล์ว/จุด + main stop
  quantities.valve_fitting = {
    qty: valveCount, uom: 'ตัว',
    label: 'วาล์ว/ข้อต่อ (stop valve + gate valve)'
  };

  // 5. Floor Drain
  const fdCount = inp.floor_drain_override ?? (bathroom_count + (laundry_point ? 1 : 0));
  quantities.fd = {
    qty: fdCount, uom: 'ชุด',
    label: 'Floor Drain + ตะแกรง สแตนเลส'
  };

  // 6. P-Trap
  quantities.ptrap = {
    qty: bathroom_count * 2 + kitchen_count + laundryPts, uom: 'ตัว',
    label: 'P-Trap ดักกลิ่น'
  };

  // 7. Cleanout
  const co = inp.cleanout_count ?? Math.max(1, Math.ceil((supplyLen + drainLen) / 15));
  quantities.cleanout = { qty: co, uom: 'จุด', label: 'Cleanout Box' };

  // ─── Warnings ──────────────────────────────────────────
  const warnings: string[] = [];
  if (bathroom_count === 0 && kitchen_count === 0 && laundry_point) {
    warnings.push('ข้อสังเกต: ยังไม่ได้ระบุจำนวนจุดอุปโภคบริโภค (ห้องน้ำ/ครัว/ซักล้าง) ระบบอาจไม่สามารถประเมินความยาวท่อโดยประมาณได้อย่างแม่นยำ');
  } else {
    if (has_hot_water && hot_water_type === 'electric' && bathroom_count >= 3) {
      warnings.push('มีห้องน้ำ >= 3 ห้อง แนะนำพิจารณาระบบน้ำร้อนแบบ Heat Pump แทนไฟฟ้า แนะนำพิจารณาระบบทำปั๊มความร้อน (Heat Pump) สำหรับโครงการระยะยาวเพื่อประสิทธิภาพการใช้พลังงาน');
    }
    if (waste_percent === 0) {
      warnings.push('ข้อควรระวัง: การเผื่อวัสดุ (Waste) เป็น 0% สำหรับงานท่อ อาจไม่เพียงพอเนื่องจากการทิ้งเศษตัดแต่งเข้าข้อต่อ แนะนำเผื่อปริมาณขั้นต่ำ 10-15%');
    }
    if (co === 0) {
      warnings.push('ข้อควรระวังในการบำรุงรักษา: ไม่มีการระบุช่องเปิดทำความสะอาดท่อ (Cleanout / FCO) ซึ่งอาจทำให้เป็นอุปสรรคต่อการแก้ไขปัญหาท่ออุดตันในอนาคต');
    }

    warnings.push('คำเตือนเชิงโครงสร้าง: (1) งานท่อน้ำทิ้งทางราบต้องกำหนด Slope ให้ชัดเจน ≥ 1:100 ป้องกันน้ำขังตากสโลปตกท้องช้าง');
    warnings.push('คำเตือนเชิงโครงสร้าง: (2) เช็คให้ชัวร์ว่าจุด Floor Drain และใต้อ่างทุกจุดมีท่อดักกลิ่น (P-Trap/U-Trap) ถ้าไม่มี เพื่อป้องกันกลิ่นไม่พึงประสงค์ย้อนกลับ');
  }

  return { quantities, warnings, qc_flags: [] };
}
