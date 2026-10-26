import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 26 Contract ────────────────────────────────────────────────────────
/** ติดตั้งระบบไฟฟ้า (Electrical Systems) */
export interface Step26Input {
  // ─── จุดใช้งาน (นับจากแบบไฟฟ้า) ──────────────────────
  lighting_count: number;              // จุดโคมไฟ
  single_socket_count: number;         // เต้ารับเดี่ยว
  double_socket_count: number;         // เต้ารับคู่
  switch_count: number;                // สวิตช์ (1-way, 2-way ฯลฯ)
  ac_circuit_count: number;            // วงจรแอร์ (เดินสาย dedicated)
  water_heater_circuit: boolean;       // วงจรเครื่องทำน้ำร้อน

  // ─── ตู้ไฟ (Consumer Unit / DB) ───────────────────────
  main_breaker_amp: number;            // เมนเบรกเกอร์ (Amp) — ปกติ 50A บ้าน 2 ชั้น
  phase: '1phase' | '3phase';         // ไฟ 1 เฟส / 3 เฟส

  waste_percent: number;               // default 10

  // ─── optional ─────────────────────────────────────────
  outdoor_socket_count?: number;       // เต้ารับภายนอก (กันน้ำ)
  ground_rod_count?: number;           // สายดิน
  avg_cable_run_m?: number;            // ระยะวิ่งสายเฉลี่ยจาก DB ถึงจุดใช้งาน (default 8 ม.)
  ev_charger?: boolean;                // ติดตั้ง EV Charger

  // ─── HVAC (ระบบปรับอากาศ) ────────────────────────────────
  hvac_install_count?: number;         // จำนวนแอร์ติดตั้ง (เครื่อง)
  hvac_copper_pipe_m?: number;         // ระยะเดินท่อน้ำยาแอร์รวม (ม.)
}

// ─── STEP 26 — ระบบไฟฟ้า ─────────────────────────────────────────────────────
export function calcStep26(inp: Step26Input): StepResult {
  const {
    lighting_count, single_socket_count, double_socket_count, switch_count,
    ac_circuit_count, water_heater_circuit, main_breaker_amp, phase,
    waste_percent,
  } = inp;
  const wf = 1 + waste_percent / 100;
  const avgRun = inp.avg_cable_run_m ?? 0;

  // ─── คำนวณจำนวนจุด & วงจร ─────────────────────────────
  const totalPoints = lighting_count + single_socket_count + double_socket_count + switch_count + (inp.outdoor_socket_count ?? 0);
  const socketCount = single_socket_count + double_socket_count + (inp.outdoor_socket_count ?? 0);

  // วงจรย่อย: ไฟ = ceil(จุดไฟ/8), ปลั๊ก = ceil(จุดปลั๊ก/6), แอร์ = 1 วงจร/เครื่อง
  const lightCircuit = Math.ceil(lighting_count / 8);
  const socketCircuit = Math.ceil(socketCount / 6);
  const acCircuits = ac_circuit_count;
  const heaterCircuit = water_heater_circuit ? 1 : 0;
  const evCircuit = inp.ev_charger ? 1 : 0;
  const totalCircuit = lightCircuit + socketCircuit + acCircuits + heaterCircuit + evCircuit;

  // ─── สาย & ท่อ (auto-calculate) ────────────────────────
  // สายเมน: จาก มิเตอร์ → ตู้ DB ≈ 15 ม. × จำนวนเส้น (1 เฟส = 2 + สายดิน = 3 เส้น)
  const mainWireCount = phase === '3phase' ? 5 : 3;
  const mainCableLen = r2(15 * mainWireCount * wf);

  // สายย่อย: ทุกจุดใช้งาน × ระยะวิ่งเฉลี่ย × 2 เส้น (L+N) — + วงจรแอร์ใช้สาย 2.5mm²
  const branchCableLen = r2(totalPoints * avgRun * 2 * wf);
  // สายแอร์แยก: ใช้ VCT 2.5mm² ≈ 12 ม./เครื่อง
  const acCableLen = r2(ac_circuit_count * 12 * wf);

  // ท่อร้อยสาย: ≈ 80% ของระยะสายย่อย (เพราะบางส่วนไปในผนัง)
  const conduitLen = r2((totalPoints * avgRun * 0.8 + ac_circuit_count * 12) * wf);

  const quantities: StepResult['quantities'] = {};

  // 1. ท่อร้อยสาย
  quantities.conduit = { qty: conduitLen, uom: 'm', label: `ท่อร้อยสาย PVC (${totalPoints} จุด × avg ${avgRun} ม.)` };

  // 2. สายเมน
  quantities.main_cable = { qty: mainCableLen, uom: 'm', label: `สายเมน THW ${main_breaker_amp}A (${phase === '3phase' ? '3 เฟส 5 เส้น' : '1 เฟส 3 เส้น'})` };

  // 3. สายย่อย
  quantities.branch_cable = { qty: branchCableLen, uom: 'm', label: `สายย่อย VAF 2×2.5 (${totalPoints} จุด)` };

  // 4. สาย AC dedicated
  if (acCableLen > 0) {
    quantities.ac_cable = { qty: acCableLen, uom: 'm', label: `สาย VCT แอร์ (${ac_circuit_count} วงจร)` };
  }

  // 5. สวิตช์/เต้ารับ
  quantities.switches_sockets = { qty: single_socket_count + double_socket_count + switch_count + (inp.outdoor_socket_count ?? 0), uom: 'จุด', label: 'สวิตช์ + เต้ารับ' };

  // 6. โคมไฟ
  quantities.lighting_fixtures = { qty: lighting_count, uom: 'จุด', label: 'จุดโคมไฟ' };

  // 7. ลูกย่อยเบรกเกอร์
  quantities.circuits = { qty: totalCircuit, uom: 'วงจร', label: `ลูกย่อยเบรกเกอร์ (ไฟ ${lightCircuit} + ปลั๊ก ${socketCircuit} + แอร์ ${acCircuits}${heaterCircuit ? ' + เครื่องทำน้ำร้อน' : ''}${evCircuit ? ' + EV' : ''})` };

  // 8. ตู้ Consumer Unit
  const dbSlots = Math.max(12, Math.ceil(totalCircuit * 1.3 / 2) * 2); // เผื่อ 30%, ปัดเป็นเลขคู่
  quantities.consumer_unit = { qty: 1, uom: 'ตู้', label: `ตู้ Consumer Unit ${dbSlots} ช่อง (Main ${main_breaker_amp}A)` };

  // 9. สายดิน
  const groundRod = inp.ground_rod_count ?? 1;
  quantities.ground_rod = { qty: groundRod, uom: 'ต้น', label: 'สายดิน Ground Rod' };

  // 10. เต้ารับกันน้ำ
  if (inp.outdoor_socket_count && inp.outdoor_socket_count > 0) {
    quantities.outdoor_socket = { qty: inp.outdoor_socket_count, uom: 'จุด', label: 'เต้ารับภายนอก (กันน้ำ IP55)' };
  }

  // 11. EV Charger
  if (inp.ev_charger) {
    quantities.ev_charger = { qty: 1, uom: 'ชุด', label: 'EV Charger Wall Box + สายเดิน' };
  }

  // 12. HVAC
  const hvacCount = inp.hvac_install_count ?? 0;
  if (hvacCount > 0) {
    quantities.hvac_install = { qty: hvacCount, uom: 'ชุด', label: `ติดตั้งแอร์ Wall Type (${hvacCount} เครื่อง)` };
    const copper = inp.hvac_copper_pipe_m ?? (hvacCount * 10);
    if (copper > 0) {
        quantities.hvac_copper = { qty: r2(copper * wf), uom: 'm', label: 'ท่อทองแดงน้ำยาแอร์+ฉนวน (เผื่อ waste)' };
    }
  }

  // ─── Warnings ──────────────────────────────────────────
  const warnings: string[] = [];
  if (totalPoints === 0) {
    warnings.push('ยังไม่ได้กรอกจุดใช้งานไฟฟ้าเลย ปลั๊ก สวิตช์ส่องสว่าง มีผลต่อความยาวสายทั้งหมดครับ');
  } else {
    if (avgRun === 0) {
      warnings.push('ข้อสังเกต: การระบุระยะวิ่งสายเฉลี่ยเป็น 0 ม. จะส่งผลให้ระบบไม่สามารถประหยัดปริมาณสายไฟและท่อร้อยสายเบื้องต้นได้');
    }
    if (waste_percent < 10) {
      warnings.push(`ข้อสังเกต: การเผื่อปริมาณเศษความยาวสายไฟต่ำ อาจไม่คลุมถึงการดัดโค้งเลี้ยวและเข้ากล่องพักสาย`);
    }
    if (main_breaker_amp < 30 && totalCircuit > 4) {
      warnings.push(`มี ${totalCircuit} วงจร แต่เมนเบรกเกอร์แค่ ${main_breaker_amp}A ระวังโหลดสะสมเกินจนเมนทริปดับทั้งตึกครับ`);
    }
    if (ac_circuit_count > 0 && main_breaker_amp < 50) {
      warnings.push('มีแอร์อย่างน้อย 1 เครื่อง แนะนำใช้เมนเบรกเกอร์ 50A เผื่ออุปกรณ์ครัวและโหลดอนาคตครับ');
    }
    if (inp.ev_charger && phase === '1phase') {
      warnings.push('ติดตั้ง EV Charger แบบ Wall Box ควรพิจารณาอัพเกรดเป็นไฟ 3 เฟส มิฉะนั้นเวลาชาร์จรถตอนกลางคืนอาจเปิดแอร์หรือน้ำอุ่นพร้อมกันไม่ได้ครับ');
    }
    if (!inp.ground_rod_count) {
      warnings.push('ข้อกำหนดทางไฟฟ้า: ไม่มีการระบุระบบกราวด์ร็อด (Ground Rod) ซึ่งเป็นข้อบังคับมาตรฐานความปลอดภัยทางไฟฟ้าขั้นพื้นฐาน');
    }
  }

  return { quantities, warnings, qc_flags: [] };
}
