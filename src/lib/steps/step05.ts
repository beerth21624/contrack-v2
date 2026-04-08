import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 5 Contract ─────────────────────────────────────────────────────────
/** งานเสาเข็ม — input fields */
export interface Step5Input {
  pile_type: 'driven' | 'bored';
  number_of_piles: number;             // จำนวนเสาเข็ม
  pile_length_m: number;               // ความยาวต่อต้น (ม.)
  waste_percent: number;               // default 5
  // optional — driven
  pile_section_cm?: number;            // ขนาดหน้าตัด เช่น 22, 26, 30 ซม.
  // optional — bored
  pile_diameter_m?: number;            // เส้นผ่านศูนย์กลาง (ม.)
  // ─── cost-related (ใหม่) ────────────────────────────────
  piles_per_footing?: number;          // จำนวนเข็มต่อฐาน (default 1)
  mobilization_days?: number;          // ค่าเคลื่อนย้ายเครื่องจักร (วัน)
  production_rate_per_day?: number;    // ผลผลิตตอก/เจาะ ต่อวัน (default: 8 ต้น/วัน ตอก, 3 ต้น/วัน เจาะ)
  pile_head_cut_required?: boolean;    // ต้องตัดหัวเข็มไหม (default true สำหรับเข็มตอก)
  pile_head_cut_depth_cm?: number;     // ตัดหัวเข็มลึก (ซม.) default 30
  load_test_count?: number;            // จำนวนเข็มที่ต้องทำ Load Test (default 0)
  load_test_type?: 'dynamic' | 'static'; // ประเภท load test
  // bored pile only
  rebar_cage_kg_per_m?: number;        // น้ำหนักเหล็ก cage ต่อ ม. (default 25 กก./ม.)
  bentonite_required?: boolean;        // ใช้ bentonite ไหม (default true สำหรับเข็มเจาะ)
  casing_length_m?: number;            // ความยาว temporary casing (ม.)
}

// ─── STEP 5 — งานเสาเข็ม ─────────────────────────────────────────────────────
export function calcStep5(inp: Step5Input): StepResult {
  const { pile_type, number_of_piles, pile_length_m, waste_percent, pile_diameter_m } = inp;
  const w = 1 + waste_percent / 100;

  const quantities: StepResult['quantities'] = {};
  const warnings: string[] = [];
  const qc_flags: string[] = [];

  // จำนวนเข็ม (ทุก type)
  quantities.number_of_piles = { qty: number_of_piles, uom: 'pcs', label: 'จำนวนเสาเข็ม' };

  // ─── Production & mobilization ────────────────────────────
  const prod_rate = inp.production_rate_per_day ?? (pile_type === 'driven' ? 8 : 3);
  const work_days = Math.ceil(number_of_piles / prod_rate);
  const mob_days  = inp.mobilization_days ?? 1;

  quantities.work_days = { qty: work_days, uom: 'วัน', label: `จำนวนวันทำงาน (${prod_rate} ต้น/วัน)` };
  quantities.machine_days = { qty: work_days + mob_days, uom: 'วัน', label: `ค่าเช่าเครื่องจักร (รวมเคลื่อนย้าย ${mob_days} วัน)` };

  if (pile_type === 'driven') {
    // ─── DRIVEN PILE ──────────────────────────────────────────
    const total_length = r2(number_of_piles * pile_length_m * w);
    quantities.total_length = { qty: total_length, uom: 'm', label: 'ความยาวเสาเข็มตอกรวม (incl. waste)' };

    if (inp.pile_section_cm) {
      quantities.pile_section = { qty: inp.pile_section_cm, uom: 'cm', label: `ขนาดเข็ม I-${inp.pile_section_cm}` };
      
      const sec = inp.pile_section_cm;
      if (sec === 15) quantities.pile_i15 = { qty: total_length, uom: 'm', label: 'ความยาวเสาเข็มตอก I-15 รวม waste' };
      if (sec === 18) quantities.pile_i18 = { qty: total_length, uom: 'm', label: 'ความยาวเสาเข็มตอก I-18 รวม waste' };
      if (sec === 22) quantities.pile_i22 = { qty: total_length, uom: 'm', label: 'ความยาวเสาเข็มตอก I-22 รวม waste' };
      if (sec === 26) quantities.pile_i26 = { qty: total_length, uom: 'm', label: 'ความยาวเสาเข็มตอก I-26 รวม waste' };
      if (sec === 30) quantities.pile_i30 = { qty: total_length, uom: 'm', label: 'ความยาวเสาเข็มตอก I-30 รวม waste' };
      if (sec === 35) quantities.pile_i35 = { qty: total_length, uom: 'm', label: 'ความยาวเสาเข็มตอก I-35 รวม waste' };
      if (sec === 40) quantities.pile_i40 = { qty: total_length, uom: 'm', label: 'ความยาวเสาเข็มตอก I-40 รวม waste' };

      // ค่าขนส่ง: ประมาณ 1 คันรถ = 20 ต้น (เข็มสั้น) หรือ 10 ต้น (เข็มยาว >12ม.)
      const piles_per_truck = pile_length_m > 12 ? 10 : 20;
      const transport_trips = Math.ceil(number_of_piles / piles_per_truck);
      quantities.transport_trips = { qty: transport_trips, uom: 'เที่ยว', label: `ค่าขนส่งเสาเข็ม (${piles_per_truck} ต้น/คัน)` };
    } else {
      warnings.push('ยังไม่ระบุขนาดหน้าตัดเสาเข็ม — ต้องระบุในใบ BOQ จริง');
    }

    // ตัดหัวเข็ม
    if (inp.pile_head_cut_required == false) {
      const cut_depth = inp.pile_head_cut_depth_cm ?? 30;
      quantities.pile_head_cut = { qty: number_of_piles, uom: 'ต้น', label: `ตัดหัวเข็ม (ลึก ${cut_depth} ซม.)` };
    }





  } else {
    // ─── BORED PILE ───────────────────────────────────────────
    if (!pile_diameter_m) {
      warnings.push('ยังไม่ได้ระบุเส้นผ่านศูนย์กลางเสาเข็มเจาะ');
    } else {
      const area_pile = Math.PI * Math.pow(pile_diameter_m, 2) / 4;
      const volume_per_pile = r2(area_pile * pile_length_m);
      const total_volume    = r2(number_of_piles * volume_per_pile * w);

      quantities.volume_per_pile = { qty: volume_per_pile, uom: 'm³', label: 'คอนกรีตต่อต้น' };
      quantities.total_volume    = { qty: total_volume,    uom: 'm³', label: 'คอนกรีตรวม (incl. waste)' };

      // เหล็ก Cage
      const cage_rate = inp.rebar_cage_kg_per_m ?? 25;
      const cage_total = r2(number_of_piles * pile_length_m * cage_rate);
      quantities.rebar_cage = { qty: cage_total, uom: 'kg', label: `เหล็ก Cage (${cage_rate} กก./ม.)` };

      // Bentonite
      if (inp.bentonite_required == false) {
        // ประมาณ 1.5 เท่าของปริมาตรหลุม
        const bento_vol = r2(number_of_piles * volume_per_pile * 1.5);
        quantities.bentonite = { qty: bento_vol, uom: 'm³', label: 'น้ำ Bentonite (Slurry)' };
      }

      // Casing
      if (inp.casing_length_m && inp.casing_length_m > 0) {
        quantities.casing = { qty: inp.casing_length_m, uom: 'm', label: 'Temporary Casing (ใช้ซ้ำ)' };
      }
    }





  }

  // ─── Load Test (ทั้งสองแบบ) ────────────────────────────────
  if (inp.load_test_count && inp.load_test_count > 0) {
    const test_type = inp.load_test_type === 'static' ? 'Static' : 'Dynamic (PDA)';
    quantities.load_test = { qty: inp.load_test_count, uom: 'ต้น', label: `Load Test — ${test_type}` };
  }

  // ─── Common warnings ──────────────────────────────────────
  if (number_of_piles > 30 && (inp.load_test_count || inp.load_test_count === 0)) {
    warnings.push(`จำนวนเสาเข็ม ${number_of_piles} ต้น ถือเป็นโครงการขนาดกลาง-ใหญ่ แนะนำให้ตั้งงบทำ Load Test อย่างน้อย 1 ต้น (Dynamic Load Test) เพื่อรับรองความปลอดภัยตามกฎหมาย`);
  } else if (number_of_piles > 50) {
    warnings.push(`เข็ม > 50 ต้น — ควรขอราคาเข็มล่วงหน้า (Lead time สั่งผลิต 2-4 สัปดาห์)`);
  }

  if (pile_length_m > 12) {
    warnings.push(`เข็มมีความยาว > 12 ม. (ขนส่งเป็นต้นเดียวไม่ได้) — จำเป็นต้องมีการต่อรอยเชื่อม (Splicing) อย่าลืมประเมินค่าแรงช่างเชื่อมเสาเข็มรวมลงไปใน BOQ ด้วย`);
  }

  if (inp.mobilization_days || inp.mobilization_days === 0) {
    warnings.push('ยังไม่ได้กำหนด "ค่าเครื่องจักรเข้า-ออก (Mobilization Days)" ควรเผื่อไว้อย่างน้อย 1-2 วัน ไม่เช่นนั้นค่าเครื่องจักรจะหายไปจากต้นทุน');
  }

  if (pile_type === 'bored' && waste_percent < 10) {
    warnings.push('การทำเสาเข็มเจาะ (Bored Pile) มักเกิด Overbreak (ดินพัง) และต้องเทคอนกรีตล้นหัวเข็ม แนะนำให้เผื่อ Waste ของคอนกรีตอย่างน้อย 10-15%');
  }

  // ─── Common QC ─────────────────────────────────────────────




  return { quantities, warnings, qc_flags };
}
