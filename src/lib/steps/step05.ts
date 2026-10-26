import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 5 Contract ─────────────────────────────────────────────────────────
/** งานเสาเข็ม — input fields */
export interface Step5Input {
  pile_type: 'driven' | 'bored' | 'mini';
  pile_shape?: 'square' | 'spun';        // สี่เหลี่ยม vs กลม (Spun Pile)
  number_of_piles: number;             // จำนวนเสาเข็ม
  pile_length_m: number;               // ความยาวต่อต้น (ม.)
  waste_percent: number;               // default 5
  // optional — driven (square)
  pile_section_cm?: number;            // ขนาดหน้าตัด เช่น 15, 18, 20, 22, 26, 30, 35, 40, 45, 52.5 ซม.
  // optional — bored
  pile_diameter_m?: number;            // เส้นผ่านศูนย์กลาง (ม.)
  // optional — mini piles
  mini_pile_type?: 'mini15' | 'cpac10x12';  // ชนิดเข็มสั้น
  mini_pile_length_m?: number;           // ความยาวเข็มสั้น (2/3/4/5/6 ม.)
  // ─── cost-related ────────────────────────────────────────
  piles_per_footing?: number;          // จำนวนเข็มต่อฐาน (default 1)
  mobilization_days?: number;          // ค่าเข้า-ออกเครื่องจักร (วัน)
  production_rate_per_day?: number;    // ผลผลิตตอก/เจาะ ต่อวัน
  pile_head_cut_required?: boolean;    // ต้องตัดหัวเข็มไหม
  pile_head_cut_depth_cm?: number;     // ตัดหัวเข็มลึก (ซม.) default 30
  dowel_bar_required?: boolean;        // มีเหล็กหนวดกุ้ง
  load_test_count?: number;            // จำนวนเข็มที่ต้องทำ Load Test
  load_test_type?: 'dynamic' | 'static'; // ประเภท load test
  seismic_test_count?: number;         // จำนวน Seismic Test
  soil_boring_count?: number;          // จำนวนหลุมเจาะสำรวจดิน
  // bored pile only
  rebar_cage_kg_per_m?: number;        // น้ำหนักเหล็ก cage ต่อ ม.
  bentonite_required?: boolean;        // ใช้ bentonite ไหม
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
  const defaultProd = pile_type === 'driven' ? 8 : pile_type === 'mini' ? 15 : 3;
  const prod_rate = inp.production_rate_per_day ?? defaultProd;
  const work_days = Math.ceil(number_of_piles / prod_rate);
  const mob_days  = inp.mobilization_days ?? 1;

  quantities.work_days = { qty: work_days, uom: 'วัน', label: `จำนวนวันทำงาน (${prod_rate} ต้น/วัน)` };
  quantities.machine_days = { qty: work_days + mob_days, uom: 'วัน', label: `ค่าเช่าเครื่องจักร (รวมเคลื่อนย้าย ${mob_days} วัน)` };

  if (pile_type === 'mini') {
    // ─── MINI PILE (เข็มสั้น) ──────────────────────────────────
    const miniLen = inp.mini_pile_length_m ?? pile_length_m;
    const qty = Math.ceil(number_of_piles * w);

    if (inp.mini_pile_type === 'cpac10x12') {
      // CPAC Mini 10×12
      const lenKey = `${Math.round(miniLen)}`;
      const code = `pile_cpac_${lenKey}m`;
      quantities[code] = { qty, uom: 'pcs', label: `เข็ม CPAC 10×12 ซม. ยาว ${miniLen} ม. (${qty} ท่อน)` };
    } else {
      // Mini 15cm
      const lenKey = `${Math.round(miniLen)}`;
      const code = `pile_mini_${lenKey}m`;
      quantities[code] = { qty, uom: 'pcs', label: `เข็มสั้น 15 ซม. ยาว ${miniLen} ม. (${qty} ต้น)` };
    }

    // ค่าขนส่ง
    const piles_per_truck = 40;
    const transport_trips = Math.ceil(number_of_piles / piles_per_truck);
    quantities.transport_trips = { qty: transport_trips, uom: 'เที่ยว', label: `ค่าขนส่งเข็มสั้น (${piles_per_truck} ต้น/คัน)` };

    // ตัดหัวเข็ม + Dowel
    if (inp.pile_head_cut_required !== false) {
      quantities.pile_cut_mini = { qty: number_of_piles, uom: 'ต้น', label: `ตัดหัวเข็มสั้น (Mini Pile)` };
      if (inp.dowel_bar_required !== false) {
        quantities.pile_dowel = { qty: number_of_piles, uom: 'ต้น', label: `เหล็กหนวดกุ้ง (Dowel Bar)` };
      }
    }

  } else if (pile_type === 'driven') {
    // ─── DRIVEN PILE ──────────────────────────────────────────
    const total_length = r2(number_of_piles * pile_length_m * w);
    quantities.total_length = { qty: total_length, uom: 'm', label: 'ความยาวเสาเข็มตอกรวม (incl. waste)' };

    const isSpun = inp.pile_shape === 'spun';

    if (isSpun && inp.pile_section_cm) {
      // ── Spun Pile (ราคาต่อต้น) ──
      const sec = inp.pile_section_cm;
      const pileTotal = number_of_piles;
      quantities.pile_section = { qty: sec, uom: 'cm', label: `เสาเข็ม Spun ศก.${sec} ซม.` };
      const spunKey = `pile_sp${sec}` as string;
      quantities[spunKey] = { qty: pileTotal, uom: 'pcs', label: `เสาเข็ม Spun ศก.${sec} (${pileTotal} ต้น × ยาว ${pile_length_m} ม.)` };

      const piles_per_truck = 10;
      const transport_trips = Math.ceil(pileTotal / piles_per_truck);
      quantities.transport_trips = { qty: transport_trips, uom: 'เที่ยว', label: `ค่าขนส่งเสาเข็ม (${piles_per_truck} ต้น/คัน)` };
    } else if (inp.pile_section_cm) {
      // ── Square Pile (ราคาต่อเมตร) ──
      quantities.pile_section = { qty: inp.pile_section_cm, uom: 'cm', label: `ขนาดเข็ม I-${inp.pile_section_cm}` };
      
      const sec = inp.pile_section_cm;
      if (sec === 15)   quantities.pile_i15 = { qty: total_length, uom: 'm', label: 'เข็มตอก I-15 รวม waste' };
      if (sec === 18)   quantities.pile_i18 = { qty: total_length, uom: 'm', label: 'เข็มตอก I-18 รวม waste' };
      if (sec === 20)   quantities.pile_i20 = { qty: total_length, uom: 'm', label: 'เข็มตอก I-20 รวม waste' };
      if (sec === 22)   quantities.pile_i22 = { qty: total_length, uom: 'm', label: 'เข็มตอก I-22 รวม waste' };
      if (sec === 26)   quantities.pile_i26 = { qty: total_length, uom: 'm', label: 'เข็มตอก I-26 รวม waste' };
      if (sec === 30)   quantities.pile_i30 = { qty: total_length, uom: 'm', label: 'เข็มตอก I-30 รวม waste' };
      if (sec === 35)   quantities.pile_i35 = { qty: total_length, uom: 'm', label: 'เข็มตอก I-35 รวม waste' };
      if (sec === 40)   quantities.pile_i40 = { qty: total_length, uom: 'm', label: 'เข็มตอก I-40 รวม waste' };
      if (sec === 45)   quantities.pile_i45 = { qty: total_length, uom: 'm', label: 'เข็มตอก I-45 รวม waste' };
      if (sec === 52.5) quantities.pile_i525 = { qty: total_length, uom: 'm', label: 'เข็มตอก I-52.5 รวม waste' };

      // ค่าขนส่ง
      const piles_per_truck = pile_length_m > 12 ? 10 : 20;
      const transport_trips = Math.ceil(number_of_piles / piles_per_truck);
      quantities.transport_trips = { qty: transport_trips, uom: 'เที่ยว', label: `ค่าขนส่งเสาเข็ม (${piles_per_truck} ต้น/คัน)` };
    } else {
      warnings.push('ยังไม่ระบุขนาดหน้าตัดเสาเข็ม — ต้องระบุในใบ BOQ จริง');
    }

    // ตัดหัวเข็ม + Dowel
    if (inp.pile_head_cut_required !== false) {
      if (inp.pile_section_cm) {
        const sec = inp.pile_section_cm;
        // D15, D18, D20, D22, D26, D30, D35, D40. If sec=45 or 52.5, cap at 40.
        const cutSize = sec >= 40 ? 40 : sec === 35 ? 35 : sec === 30 ? 30 : sec >= 26 ? 26 : sec >= 22 ? 22 : sec === 20 ? 20 : sec === 18 ? 18 : 15;
        quantities[`pile_cut_d${cutSize}` as string] = { qty: number_of_piles, uom: 'ต้น', label: `ตัดหัวเข็ม ${isSpun ? 'Spun' : 'สี่เหลี่ยม'} (ศก.${sec})` };
        
        if (inp.dowel_bar_required !== false) {
          quantities.pile_dowel = { qty: number_of_piles, uom: 'ต้น', label: `เหล็กหนวดกุ้ง (Dowel Bar)` };
        }
      }
    }

    // Labor Surcharge (โครงการขนาดเล็ก)
    if (number_of_piles < 50) {
      // PDF: <50 piles makes labor jump +22 THB/m on average
      quantities.labor_surcharge = { qty: total_length, uom: 'm', label: `ค่าแรงตอกเพิ่ม (เข็มน้อยกว่า 50 ต้น)` };
    }

    // เชื่อมต่อเข็ม (Welding Joint) — เมื่อเข็มยาว > 12 ม. ต้องต่อท่อน
    if (pile_length_m > 12) {
      const joints_per_pile = Math.ceil(pile_length_m / 12) - 1;
      const total_joints = number_of_piles * joints_per_pile;
      quantities.welding_joint = { qty: total_joints, uom: 'จุด', label: `เชื่อมต่อเสาเข็ม (${joints_per_pile} จุด/ต้น)` };
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
      if (inp.bentonite_required !== false) {
        const bento_vol = r2(number_of_piles * volume_per_pile * 1.5);
        quantities.bentonite = { qty: bento_vol, uom: 'm³', label: 'น้ำ Bentonite (Slurry)' };
      }

      // Casing
      if (inp.casing_length_m && inp.casing_length_m > 0) {
        quantities.casing = { qty: inp.casing_length_m, uom: 'm', label: 'Temporary Casing (ใช้ซ้ำ)' };
      }

      // ตัดหัวเข็ม + Dowel
      if (inp.pile_head_cut_required !== false) {
        const d_cm = pile_diameter_m * 100;
        const cutSize = d_cm >= 60 ? 60 : d_cm >= 50 ? 50 : d_cm >= 40 ? 40 : d_cm >= 35 ? 35 : 30;
        quantities[`pile_cut_b${cutSize}` as string] = { qty: number_of_piles, uom: 'ต้น', label: `สกัดหัวเข็มเจาะ Ø${pile_diameter_m.toFixed(2)}m` };
        
        if (inp.dowel_bar_required !== false) {
          quantities.pile_dowel = { qty: number_of_piles, uom: 'ต้น', label: `ดัด/เตรียมเหล็กหนวดกุ้ง (Dowel)` };
        }
      }
    }
  }

  // ─── Soil Boring Test ─────────────────────────────────────────
  if (inp.soil_boring_count && inp.soil_boring_count > 0) {
    quantities.soil_boring = { qty: inp.soil_boring_count, uom: 'หลุม', label: `เจาะสำรวจดิน (${inp.soil_boring_count} หลุม)` };
  }

  // ─── Load Test (ทั้งสองแบบ) ────────────────────────────────
  if (inp.load_test_count && inp.load_test_count > 0) {
    const test_type = inp.load_test_type === 'static' ? 'Static' : 'Dynamic (PDA)';
    quantities.load_test = { qty: inp.load_test_count, uom: 'ต้น', label: `Load Test — ${test_type}` };
  }

  // ─── Seismic Test ──────────────────────────────────────────
  if (inp.seismic_test_count && inp.seismic_test_count > 0) {
    quantities.seismic_test = { qty: inp.seismic_test_count, uom: 'ต้น', label: `Seismic Integrity Test` };
  }

  // ─── Common warnings ──────────────────────────────────────
  if (number_of_piles > 30 && (!inp.load_test_count || inp.load_test_count === 0)) {
    warnings.push(`จำนวนเสาเข็ม ${number_of_piles} ต้น ถือเป็นโครงการขนาดกลาง-ใหญ่ แนะนำให้ตั้งงบทำ Load Test อย่างน้อย 1 ต้น เพื่อรับรองความปลอดภัย`);
  } else if (number_of_piles < 50 && pile_type === 'driven') {
    warnings.push(`เนื่องจากปริมาณเข็มน้อยกว่า 50 ต้น ระบบได้บวก "ค่าแรงตอกเพิ่มเหมา" ตามเรทโครงการขนาดเล็ก เพื่อป้องกันการประเมินต่ำกว่าความเป็นจริง`);
  }

  if (pile_length_m > 12 && pile_type === 'driven') {
    warnings.push(`เข็มมีความยาว > 12 ม. (ขนส่งเป็นต้นเดียวไม่ได้) — ระบบได้คำนวณค่าเชื่อมต่อเสาเข็ม (Welding Joint) ให้อัตโนมัติแล้ว`);
  }

  if (!inp.mobilization_days || inp.mobilization_days === 0) {
    warnings.push('ยังไม่ได้กำหนด "ค่าเครื่องจักรเข้า-ออก (Mobilization Days)" ควรเผื่อไว้อย่างน้อย 1-2 วัน ไม่เช่นนั้นค่าเครื่องจักรจะหายไปจากต้นทุน');
  }

  if (pile_type === 'bored' && waste_percent < 10) {
    warnings.push('การทำเสาเข็มเจาะ (Bored Pile) มักเกิด Overbreak (ดินพัง) และต้องเทคอนกรีตล้นหัวเข็ม แนะนำให้เผื่อ Waste ของคอนกรีตอย่างน้อย 10-15%');
  }

  if ((!inp.soil_boring_count || inp.soil_boring_count === 0) && pile_type !== 'mini') {
    warnings.push('ยังไม่ได้ระบุงานเจาะสำรวจดิน (Soil Boring Test) — โครงการผู้รับเหมาควรมีผลสำรวจดินเพื่อกำหนดความยาวเข็มที่ถูกต้อง ลดความเสี่ยงเข็มทรุด');
  }

  return { quantities, warnings, qc_flags };
}
