import { type StepResult } from '@/types';

// ─── Step 30 Contract ────────────────────────────────────────────────────────
/** ติดตั้งสุขภัณฑ์ (Sanitary Fixtures & Fittings) */
export interface Step30Input {
  // ─── ห้องน้ำ ──────────────────────────────────────────
  toilet_count: number;                // ชักโครก (สุขภัณฑ์ชิ้นเดียว/สองชิ้น)
  washbasin_count: number;             // อ่างล้างหน้า + ก๊อก
  shower_set_count: number;            // ชุดฝักบัว + ราวแขวน
  bidet_count: number;                 // สายชำระ
  faucet_count: number;                // ก๊อกน้ำ (เพิ่มเติม: ก๊อกซิงค์ ก๊อกสนาม ฯลฯ)

  // ─── ครัว ──────────────────────────────────────────────
  kitchen_sink_count: number;          // ซิงค์ล้างจาน (1 หรือ 2 หลุม)
  kitchen_faucet_count: number;        // ก๊อกน้ำครัว

  // ─── เครื่องทำน้ำอุ่น ─────────────────────────────────
  water_heater_count: number;          // เครื่องทำน้ำอุ่น
  water_heater_type: 'instant' | 'storage' | 'none';

  // ─── optional ─────────────────────────────────────────
  bathtub_count?: number;              // อ่างอาบน้ำ
  urinal_count?: number;               // โถปัสสาวะชาย
  laundry_sink_count?: number;         // อ่างซักล้าง
}

export function calcStep30(inp: Step30Input): StepResult {
  const quantities: StepResult['quantities'] = {};

  // ─── 1. ชักโครก ──────────────────────────────────────
  if (inp.toilet_count > 0)
    quantities.toilets = { qty: inp.toilet_count, uom: 'ชุด', label: 'ชักโครก + ข้อต่อ + สายน้ำ' };

  // ─── 2. อ่างล้างหน้า ─────────────────────────────────
  if (inp.washbasin_count > 0)
    quantities.basins = { qty: inp.washbasin_count, uom: 'ชุด', label: 'อ่างล้างหน้า + ก๊อก + สะดือ' };

  // ─── 3. ชุดฝักบัว ────────────────────────────────────
  if (inp.shower_set_count > 0)
    quantities.showers = { qty: inp.shower_set_count, uom: 'ชุด', label: 'ชุดฝักบัว + ราว + สาย' };

  // ─── 4. สายชำระ ──────────────────────────────────────
  if (inp.bidet_count > 0)
    quantities.bidet = { qty: inp.bidet_count, uom: 'ชุด', label: 'สายชำระ (Bidet Spray)' };

  // ─── 5. ก๊อกน้ำเพิ่มเติม ─────────────────────────────
  if (inp.faucet_count > 0)
    quantities.faucet = { qty: inp.faucet_count, uom: 'ตัว', label: 'ก๊อกน้ำ (ซิงค์/สนาม/อื่นๆ)' };

  // ─── 6. ซิงค์ครัว ────────────────────────────────────
  if (inp.kitchen_sink_count > 0)
    quantities.kitchen_sink = { qty: inp.kitchen_sink_count, uom: 'ชุด', label: 'ซิงค์ล้างจาน + สะดือ' };

  // ─── 7. ก๊อกครัว ──────────────────────────────────────
  if (inp.kitchen_faucet_count > 0)
    quantities.kitchen_faucet = { qty: inp.kitchen_faucet_count, uom: 'ตัว', label: 'ก๊อกน้ำครัว (คอยาว/คอห่าน)' };

  // ─── 8. เครื่องทำน้ำอุ่น ───────────────────────────────
  if (inp.water_heater_count > 0 && inp.water_heater_type !== 'none')
    quantities.heater = {
      qty: inp.water_heater_count, uom: 'ชุด',
      label: `เครื่องทำน้ำอุ่น ${inp.water_heater_type === 'instant' ? '(แบบทันที)' : '(แบบถัง)'}`
    };

  // ─── 9. อ่างอาบน้ำ ──────────────────────────────────
  if (inp.bathtub_count && inp.bathtub_count > 0)
    quantities.bathtub = { qty: inp.bathtub_count, uom: 'ชุด', label: 'อ่างอาบน้ำ + ก๊อกผสม + สะดือ' };

  // ─── 10. โถปัสสาวะ ──────────────────────────────────
  if (inp.urinal_count && inp.urinal_count > 0)
    quantities.urinal = { qty: inp.urinal_count, uom: 'ชุด', label: 'โถปัสสาวะชาย + Flush Valve' };

  // ─── 11. อ่างซักล้าง ─────────────────────────────────
  if (inp.laundry_sink_count && inp.laundry_sink_count > 0)
    quantities.laundry_sink = { qty: inp.laundry_sink_count, uom: 'ชุด', label: 'อ่างซักล้าง + ก๊อก' };

  // ─── 12. ซิลิโคน (auto — 1 หลอด/ชิ้นสุขภัณฑ์) ────────
  const fixtureCount = inp.toilet_count + inp.washbasin_count + inp.shower_set_count
    + inp.kitchen_sink_count + (inp.bathtub_count ?? 0) + (inp.laundry_sink_count ?? 0);
  if (fixtureCount > 0)
    quantities.silicone = { qty: Math.ceil(fixtureCount * 0.5), uom: 'หลอด', label: 'ซิลิโคนยาแนวสุขภัณฑ์' };

  // ─── 13. เทปพันเกลียว (auto) ──────────────────────────
  const connectionCount = inp.toilet_count + inp.washbasin_count + inp.shower_set_count
    + inp.bidet_count + inp.faucet_count + inp.kitchen_faucet_count
    + inp.water_heater_count + (inp.urinal_count ?? 0);
  if (connectionCount > 0)
    quantities.ptfe_tape = { qty: Math.max(2, Math.ceil(connectionCount / 3)), uom: 'ม้วน', label: 'เทปพันเกลียว (PTFE)' };

  // ─── Warnings ──────────────────────────────────────────
  const warnings: string[] = [];
  if (fixtureCount === 0 && connectionCount === 0) {
    warnings.push('ข้อสังเกต: ยังไม่ได้ระบุรายการสุขภัณฑ์ หรืออุปกรณ์ประกอบ');
  } else {
    // PO Logic Guardrails
    if (inp.toilet_count > inp.bidet_count) {
      warnings.push(`ข้อควรระวัง: จำนวนชักโครก (${inp.toilet_count}) มากกว่าจำนวนสายฉีดชำระ (${inp.bidet_count}) กรุณาตรวจสอบเพื่อป้องกันการประเมินตกหล่น`);
    }
    if (inp.toilet_count > inp.washbasin_count) {
      warnings.push(`ข้อสังเกต: จำนวนอ่างล้างหน้า (${inp.washbasin_count}) น้อยกว่าจำนวนชักโครก (${inp.toilet_count}) ซึ่งแตกต่างจากสัดส่วนมาตรฐานของห้องน้ำทั่วไป`);
    }
    if (inp.kitchen_sink_count > 0 && inp.kitchen_faucet_count === 0) {
      warnings.push('ข้อควรระวัง: มีการระบุซิงค์ล้างจานแต่ไม่มีก๊อกซิงค์ ซึ่งส่วนใหญ่อ่างล้างจานจะไม่มีการแถมก๊อกน้ำและต้องมีการเผื่อค่าแรงเจาะติดตั้งก๊อกเพิ่มเติม');
    }
    if (inp.water_heater_type === 'storage' && inp.water_heater_count > 2) {
      warnings.push('ข้อเสนอแนะเชิงวิศวกรรม: การใช้เครื่องทำน้ำร้อนแบบถังต้ม (Storage) มากกว่า 2 เครื่องอาจส่งผลให้อัตราการใช้ไฟฟ้ารวมสูงผิดปกติ แนะนำพิจารณาระบบปั๊มความร้อน (Heat Pump) สำหรับโครงการระยะยาว');
    }
  }

  return { quantities, warnings, qc_flags: [] };
}
