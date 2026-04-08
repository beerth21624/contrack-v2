import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 15 Contract ────────────────────────────────────────────────────────
/** โครงหลังคา (Roof Structure) — input fields */
export interface Step15Input {
  roof_area_m2: number;                  // พื้นที่หลังคาเมื่อมองจากด้านบน (Plan Area) ม²
  roof_shape: 'gable' | 'hip' | 'lean_to' | 'flat'; // ทรงหลังคา: จั่ว, ปั้นหยา, เพิงหมาแหงน, แบน
  roof_pitch_deg: number;                // องศาลาดชันหลังคา (Roof Pitch)
  roof_type: 'steel' | 'wood';           // ประเภทวัสดุโครงสร้างหลัก
  waste_percent: number;                 // default 5
  // optional
  purlin_spacing_m?: number;             // ระยะห่างแป (Purlin spacing) ม. (เช่น 0.32, 1.00)
  rafter_spacing_m?: number;             // ระยะห่างจันทัน (Rafter spacing) ม. (เช่น 1.00)
  ridge_length_m?: number;               // ความยาวสันหลังคา (Ridge) ม.
  // ─── cost-related (ใหม่) ────────────────────────────────
  heavy_roof_tile?: boolean;             // กระเบื้องแผ่นเรียบ/คอนกรีต (ต้องใช้โครงสร้างหนักขึ้น)
  anti_rust_coats?: number;              // จำนวนรอบทาสีกันสนิม (default 2)
  welding_rod_factor?: number;           // ลวดเชื่อม (% ของน้ำหนักเหล็ก) default 2.5
  purlin_screw_required?: boolean;       // สกรูยึดแป (แทนการเชื่อม)
}

// ─── STEP 15 — โครงหลังคา ───────────────────────────────────────────────────
export function calcStep15(inp: Step15Input): StepResult {
  const { roof_area_m2: planArea, roof_shape, roof_pitch_deg: deg, roof_type, waste_percent } = inp;
  const wf = 1 + waste_percent / 100;
  
  // ─── พื้นที่ตามความชัน (Slope Area) ────────────────────────
  // ถ้ามุม 0 (แบน) cos(0) = 1, กลายเป็นเท่าเดิม
  const rad = (deg * Math.PI) / 180;
  const slopeArea = r2(planArea / Math.cos(rad));

  const quantities: StepResult['quantities'] = {
    slope_area: { qty: slopeArea, uom: 'm²', label: `พื้นที่หลังคาลาดชัน (${deg} องศา)` },
  };

  // ระยะต่างๆ
  const purlin_sp = inp.purlin_spacing_m ?? 1.00; // ปกติเมทัลชีท 1.00m, ซีแพค 0.32m
  const rafter_sp = inp.rafter_spacing_m ?? 1.00; // ระยะจันทัน

  // ─── โครงสร้างเหล็ก (ดั้ง อะเส จันทัน ตะเข้) ─────────────────────
  if (roof_type === 'steel') {
    // ประเมินน้ำหนักเหล็ก (kg/m²) ตามรูปทรงหลังคาและชนิดกระเบื้อง
    let kg_per_m2 = 12; // base (หมาแหงน เมทัลชีท)
    
    if (roof_shape === 'lean_to') kg_per_m2 = 12;
    else if (roof_shape === 'gable') kg_per_m2 = 16;
    else if (roof_shape === 'hip') kg_per_m2 = 22; // ปั้นหยามีตะเข้สัน/ตะเข้ราง เปลืองเหล็กสุด
    
    // ถ้ากระเบื้องหนัก (ซีแพคโมเนีย / แผ่นเรียบ) ต้องเพิ่มน้ำหนักเหล็กอีก ~5 kg/m2
    if (inp.heavy_roof_tile) {
      kg_per_m2 += 5;
    }

    const steelWeight = r2(planArea * kg_per_m2 * wf);
    // แปลงรูปทรงเป็นภาษาไทยสำหรับการแสดงผล
    const shapeLabel = { gable: 'จั่ว', hip: 'ปั้นหยา', lean_to: 'เพิงหมาแหงน', flat: 'แบน' }[roof_shape];
    
    quantities.steel_weight = { qty: steelWeight, uom: 'kg', label: `เหล็กโครงหลังคาทรง${shapeLabel} (~${kg_per_m2} kg/m²)` };

    // ─── สีกันสนิม ───────────────────────────────────────────
    // พื้นที่ทาสีเหล็กรูปพรรณ: โดยเฉลี่ยเหล็ก 1 kg จะมีพื้นที่ผิว ~0.04 - 0.05 m²
    const coats = inp.anti_rust_coats ?? 2;
    const paintArea = r2((steelWeight * 0.045) * coats);
    quantities.anti_rust_paint = { qty: paintArea, uom: 'm²', label: `สีกันสนิมเหล็กโครงหลังคา (ทา ${coats} รอบ)` };

    // ─── ลวดเชื่อม ──────────────────────────────────────────
    const weldFactor = inp.welding_rod_factor ?? 2.5;
    const weldRods = r2(steelWeight * (weldFactor / 100));
    quantities.welding_rods = { qty: weldRods, uom: 'kg', label: `ลวดเชื่อมโครงหลังคา (${weldFactor}%)` };
  }

  // ─── แป (Purlin) ────────────────────────────────────────
  // ความยาวแป = พื้นที่ความชัน / ระยะแป
  const purlinLength = r2((slopeArea / purlin_sp) * wf);
  const purlinLabel = purlin_sp < 0.5 ? 'แป (ระยะถี่ สำหรับกระเบื้องซีเมนต์)' : 'แป (ระยะห่าง สำหรับเมทัลชีท)';
  quantities.purlin_length = { qty: purlinLength, uom: 'm', label: purlinLabel };

  // ─── สกรูยึดแป ───────────────────────────────────────────
  if (inp.purlin_screw_required) {
    // จุดตัดระหว่างแปและจันทัน (Purlin crosses Rafter)
    const intersections = Math.ceil((slopeArea / (purlin_sp * rafter_sp)) * 1.2 * wf); // 1.2 เผื่อจุดต่อ
    // ปกติยึดจุดละ 2 ตัว
    quantities.purlin_screws = { qty: intersections * 2, uom: 'ตัว', label: `สกรูยึดแป (จุดละ 2 ตัว)` };
  }

  // ─── ความยาวสันหลังคา ────────────────────────────────────
  if (inp.ridge_length_m) {
    quantities.ridge_length = { qty: inp.ridge_length_m, uom: 'm', label: 'ความยาวสันหลังคา (Ridge)' };
  }

  // ─── Warnings ─────────────────────────────────────────────
  const warnings: string[] = [];
  if (planArea > 0) {
    if (deg > 0 && deg < 5) warnings.push('องศาความชันหลังคาต่ำกว่า 5° ระวังปัญหาน้ำขังทะลักและหลังคารั่ว (แม้จะใช้เมทัลชีทก็ตาม)');
    if (deg > 0 && deg < 15 && inp.heavy_roof_tile) warnings.push('ใช้วัสดุกระเบื้องแผ่นแต่องศาความชันต่ำกว่า 15° น้ำจะไหลย้อนกลับเข้าแผ่นแน่นอน (เสี่ยงเกิดการรั่วซึมอย่างรุนแรง)');
    if (purlin_sp > 1.2) warnings.push('ระยะตงหรือแป (Purlin) กว้างเกิน 1.2 เมตร ระวังหลังคาตกท้องช้างเมื่อช่างขึ้นไปเหยียบ');
    if (roof_shape === 'flat') warnings.push('ถ้าแปลนเป็นหลังคาแบน (Flat Roof) แนะนำให้ใช้โครงสร้างพื้นคสล.(ดาดฟ้า) แทนโครงหลังคาเหล็ก');
  }

  // ─── QC Flags ──────────────────────────────────────────────
  // ผู้ใช้แจ้งว่า "QC flag ยังไม่ต้อง" สำหรับ Step นี้
  const qc_flags: string[] = [];

  return { quantities, warnings, qc_flags };
}
