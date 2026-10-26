import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 14 Contract ────────────────────────────────────────────────────────
/** ทำเพลทหัวเสา (Column Cap Plate) — input fields */
export interface Step14Input {
  plate_count: number;                   // จำนวนจุด (เพลท)
  plate_width_mm: number;                // กว้างเพลท (มม.)
  plate_depth_mm: number;                // ลึกเพลท (มม.)
  plate_thickness_mm: number;            // หนาเพลท (มม.) เช่น 12, 16, 20
  anchor_bolt_per_plate: number;         // จำนวน anchor bolt ต่อเพลท (เช่น 4, 8)
  waste_percent: number;                 // default 5
  // ─── cost-related (ใหม่) ────────────────────────────────
  bolt_type?: 'j-bolt' | 'l-bolt' | 'chemical'; // ชนิดเหล็กยึด
  bolt_diameter_mm?: number;             // ขนาด Bolt (เช่น 16, 20 มม.)
  bolt_length_m?: number;                // ความยาว Bolt ฝังในคอนกรีต (เช่น 0.40 ม.)
  grout_thickness_mm?: number;           // หนา Non-shrink Grout (เช่น 30 มม.)
  welding_required?: boolean;            // มีงานเชื่อมเหล็กรูปพรรณกับเพลท
  welding_length_m_per_plate?: number;   // ความยาวรอยเชื่อมต่อเพลท ม.
  anti_rust_paint_required?: boolean;    // ทาสีกันสนิมเพลท
  bolt_template_required?: boolean;      // ทำไม้แบบเจาะรูประคอง J-Bolt (แพทเทิร์น)
}

// ─── STEP 14 — ทำเพลทหัวเสา ────────────────────────────────────────────────
export function calcStep14(inp: Step14Input): StepResult {
  const { plate_count: n, plate_width_mm: w, plate_depth_mm: d, plate_thickness_mm: t, waste_percent } = inp;
  const wf = 1 + waste_percent / 100;

  // ─── แผ่นเหล็กเพลท ────────────────────────────────────────
  // พื้นที่ผิวเพลท (m²) และ น้ำหนักเพลทโดยประมาณ (ความหนาแน่นเหล็ก ~7850 kg/m³)
  const area_m2 = (w / 1000) * (d / 1000);
  const total_area_m2 = n * area_m2 * wf;
  const total_kg = r2(total_area_m2 * (t / 1000) * 7850);

  const quantities: StepResult['quantities'] = {
    plate_steel: { qty: total_kg, uom: 'kg', label: `เหล็กเพลทหัวเสา หนา ${t} มม. (${w}×${d} มม.)` },
  };

  // ─── J-Bolt / Anchor Bolt ───────────────────────────────
  const boltsCount = Math.ceil(n * inp.anchor_bolt_per_plate * wf);
  const boltDia = inp.bolt_diameter_mm ?? 16;
  const boltType = (inp.bolt_type ?? 'j-bolt').toUpperCase();
  quantities.anchor_bolts = { qty: boltsCount, uom: 'ตัว', label: `${boltType} M${boltDia}` };

  // ─── ไม้แบบเจาะรูประคอง Bolt (Template) ───────────────────
  // ผรม. ต้องทำไม้แบบไม้อัด+ไม้จ๊อยเจาะรูตามระยะ Bolt เพื่อประคองตอนเทคอนกรีตไม่ให้ขยับ
  if (inp.bolt_template_required !== false) {
    quantities.bolt_template = { qty: n, uom: 'จุด', label: 'แพทเทิร์นประคอง J-Bolt (ไม้แบบเจาะรู)' };
  }

  // ─── Non-shrink Grout ────────────────────────────────────
  const groutThick = inp.grout_thickness_mm ?? 30;
  if (groutThick > 0) {
    // ปริมาตรเกร้าท์เผื่อไหลออกขอบเพลทนิดหน่อย (1.1)
    const groutVol = r2(total_area_m2 * (groutThick / 1000) * 1.1);
    quantities.grout_volume = { qty: groutVol, uom: 'm³', label: `Non-shrink Grout หนา ${groutThick} มม.` };
    
    // Grout มักมาเป็นถุง (25 kg) โดย ~1,900 kg / m³
    const groutBags = Math.ceil((groutVol * 1900) / 25);
    quantities.grout_bags = { qty: groutBags, uom: 'ถุง', label: `Non-shrink Grout (ถุงละ 25กก.)` };
  }

  // ─── รอยเชื่อม (Welding) ──────────────────────────────────
  if (inp.welding_required) {
    const weldLen = inp.welding_length_m_per_plate ?? r2(((w + d) / 1000) * 2); // default รอบเสา
    const totalWeld = r2(n * weldLen * wf);
    quantities.welding = { qty: totalWeld, uom: 'm', label: 'งานเชื่อมโครงสร้างเหล็กกับเพลท' };
  }

  // ─── สีกันสนิมเพลท ─────────────────────────────────────────
  if (inp.anti_rust_paint_required !== false) {
    // คิดพื้นที่ผิว 2 ด้าน + ชิ้นส่วนที่โผล่
    const paintArea = r2(n * area_m2 * 2.5 * wf);
    quantities.anti_rust_paint = { qty: paintArea, uom: 'm²', label: 'ทาสีกันสนิม แผ่นเพลท+รอยเชื่อม' };
  }

  // ─── Warnings ─────────────────────────────────────────────
  const warnings: string[] = [];
  if (n > 0) {
    if (t > 0 && t < 12) warnings.push('เพลทหนาน้อยกว่า 12 มม. เสี่ยงต่อการโก่งตัวเวลาขันน็อต หรือรับน้ำหนักเสาโครงสร้างไม่ได้ (แนะนำ ≥12 มม.)');
    if (inp.anchor_bolt_per_plate > 0 && inp.anchor_bolt_per_plate < 4) warnings.push('จุดยึด Anchor bolt มีน้อยกว่า 4 ตัว/เพลท ขัดกับมาตรฐานต้านทานแรงบิดพายุและแผ่นดินไหว');
    if (boltDia > 0 && boltDia < 16) warnings.push('ขนาด J-Bolt เล็กกว่า M16 เสี่ยงรับแรงเฉือน/แรงดึง (Uplift) จากแรงลมไม่อยู่');
    if (groutThick > 0 && groutThick < 25) warnings.push('ตั้งความหนา Grout ต่ำกว่า 25 มม. น้ำปูนเกร้าท์จะหนืดเกินไปและไหลเข้าไม่เต็มใต้เพลท ทำให้เกิดโพรง');
    if (inp.waste_percent < 5) warnings.push('เผื่อ Waste เหล็กเพลทน้อยไป ควรเผื่ออย่างน้อย 5-10% สำหรับหัวตัดขี้เหล็กจากโรงงาน');
  }

  // ─── QC Flags ──────────────────────────────────────────────
  const qc_flags: string[] = [];

  return { quantities, warnings, qc_flags };
}
