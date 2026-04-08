import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 28 Contract ────────────────────────────────────────────────────────
/** ระบบสุขาภิบาลภายนอก (Sanitary — Exterior) */
export interface Step28Input {
  // ─── ข้อมูลจากแบบ ─────────────────────────────────────
  building_perimeter_m: number;        // เส้นรอบอาคาร (ราง/บ่อพักรอบตัว)
  meter_to_building_m: number;         // ระยะมิเตอร์น้ำ → อาคาร (ม.)
  resident_count: number;              // จำนวนผู้อยู่อาศัย (ขนาดถังบำบัด)

  waste_percent: number;               // default 10

  // ─── optional overrides ────────────────────────────────
  septic_size_override_m3?: number;    // override ขนาดถังบำบัด
  grease_trap_count?: number;          // ถังดักไขมัน (default 1)
  inspection_chamber_override?: number;
  rainwater_drain_m?: number;          // รางน้ำฝน (ม.)
  has_pump_tank?: boolean;             // ถังปั๊มน้ำ+ปั๊มอัตโนมัติ
}

// ─── Septic sizing by resident count ─────────────────────────────────────────
// กรมอนามัย: 0.5 m³/คน, ขั้นต่ำ 1.0 m³
function septicSize(residents: number): number {
  return Math.max(1.0, r2(residents * 0.5));
}

export function calcStep28(inp: Step28Input): StepResult {
  const {
    building_perimeter_m, meter_to_building_m, resident_count, waste_percent,
  } = inp;
  const wf = 1 + waste_percent / 100;

  const quantities: StepResult['quantities'] = {};

  // 1. ท่อเมนประปาภายนอก (มิเตอร์ → อาคาร)
  quantities.ext_supply = {
    qty: r2(meter_to_building_m * wf), uom: 'm',
    label: `ท่อเมนประปา HDPE/PVC Ø3/4" (มิเตอร์ → อาคาร ${meter_to_building_m} ม.)`
  };

  // 2. ท่อระบายน้ำทิ้งรอบอาคาร ≈ 60% ของเส้นรอบอาคาร
  const drainLen = r2(building_perimeter_m * 0.6);
  quantities.ext_drain = {
    qty: r2(drainLen * wf), uom: 'm',
    label: `ท่อน้ำทิ้ง PVC Ø4"-6" (รอบอาคาร ≈ ${drainLen} ม.)`
  };

  // 3. บ่อพัก — 1 บ่อ / 6 ม. ท่อระบาย (ขั้นต่ำ 2 บ่อ)
  const chamberCount = inp.inspection_chamber_override ?? Math.max(2, Math.ceil(drainLen / 6));
  quantities.chamber = {
    qty: chamberCount, uom: 'บ่อ',
    label: `บ่อพักน้ำทิ้ง (1 บ่อ/6 ม.)`
  };

  // 4. ถังบำบัด
  const septic = inp.septic_size_override_m3 ?? septicSize(resident_count);
  quantities.septic = {
    qty: 1, uom: 'ใบ',
    label: `ถังบำบัดสำเร็จรูป ${septic} m³ (${resident_count} คน)`
  };

  // 5. ถังดักไขมัน
  const greaseCount = inp.grease_trap_count ?? 1;
  quantities.grease = {
    qty: greaseCount, uom: 'ชุด',
    label: 'ถังดักไขมัน (ครัว)'
  };

  // 6. มิเตอร์น้ำ
  quantities.meter = { qty: 1, uom: 'ตัว', label: 'มิเตอร์น้ำ + ขอติดตั้ง' };

  // 7. รางน้ำฝน
  if (inp.rainwater_drain_m && inp.rainwater_drain_m > 0) {
    quantities.rainwater = {
      qty: r2(inp.rainwater_drain_m * wf), uom: 'm',
      label: 'รางน้ำฝน PVC + ท่อลง'
    };
  }

  // 8. ถังปั๊ม + ปั๊มอัตโนมัติ
  if (inp.has_pump_tank) {
    quantities.pump_tank = {
      qty: 1, uom: 'ชุด',
      label: 'ถังพักน้ำ + ปั๊มอัตโนมัติ'
    };
  }

  // ─── Warnings ──────────────────────────────────────────
  const warnings: string[] = [];
  if (resident_count === 0) {
    warnings.push('ยังไม่ได้ระบุจำนวนผู้อยู่อาศัย ถังบำบัดน้ำเสีย (Septic Tank) จะประเมินได้ไม่ตรงความจริง เสี่ยงปัญหาส้วมเต็มเร็วถ้าถังเล็กเกินไปครับ');
  } else if (septic < 1.0) {
    warnings.push('ถังบำบัดที่คำนวณได้เล็กกว่า 1.0 m³ ซึ่งไม่แนะนำสำหรับบ้านพักอาศัยมาตรฐานครับ');
  }

  if (building_perimeter_m === 0) {
    warnings.push('เส้นรอบอาคารเป็น 0 ม. จะประเมินท่อรอบบ้านและกะจำนวนบ่อพักไม่ได้ กรุณากรอกเส้นรอบอาคารด้วยครับ');
  } else {
    if (chamberCount < 2) {
      warnings.push('ควรตั้งบ่อพัก (Manhole) อย่างน้อย 2 จุด (จุดบรรจบท่อหน้าบ้านและหลังบ้าน)');
    } else if (drainLen / chamberCount > 8) {
      warnings.push(`ระยะห่างระหว่างบ่อพักเฉลี่ยกระโดดไปถึง ${(drainLen / chamberCount).toFixed(1)} เมตร ปกติควรมีทุกๆ 6 เมตร เพื่อกันท่อตกท้องช้างและให้ล้วงท่อเวลามีขยะอุดตันได้ง่ายครับ`);
    }
  }

  if (greaseCount === 0) {
    warnings.push('คุณระบุ "ถังดักไขมัน" เป็น 0 กฎหมายเทศบาลและการขออนุญาตปลูกสร้างบังคับให้มีทุกบ้าน เพื่อกันไขมันจากครัวอุดตันท่อระบายน้ำ แนะนำให้แก้ไขครับ');
  }

  if (waste_percent === 0) {
    warnings.push('เผื่อเศษท่อ (Waste) เป็น 0% งานเดินท่อนอกอาคารต้องหลบมุม มีข้อต่อเยอะมาก ตัดท่อทีเศษเหลือเพียบ เผื่อ 10-15% เสมอครับ');
  }

  return { quantities, warnings, qc_flags: [] };
}
