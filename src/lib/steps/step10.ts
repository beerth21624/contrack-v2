import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 10 Contract ────────────────────────────────────────────────────────
/** วางแผ่นพื้นสำเร็จ (Precast Slab) — input fields */
export interface Step10Input {
  precast_area_m2: number;
  topping_thickness_m: number;           // default 0.05
  waste_percent: number;                 // default 5
  shear_key_required: boolean;
  // optional — basic
  precast_type?: 'Hollow-core' | 'Plank' | 'Other';
  precast_panel_count?: number;
  wiremesh_kg_per_m2?: number;           // 2.5–6.0
  shoring_line_length_m?: number;        // ค้ำยัน override
  // ─── cost-related (ใหม่) ────────────────────────────────
  panel_width_m?: number;                // กว้างแผ่น (default 0.35 Plank / 1.20 Hollow-core)
  panel_thickness_m?: number;            // หนาแผ่น (default 0.12)
  span_m?: number;                       // ช่วงพาด (ม.) — auto shoring
  crane_days?: number;                   // วันเครน (auto: 1 วัน/40 แผ่น)
  grout_between_panels?: boolean;        // เกร้าท์ระหว่างแผ่น (default true)
  concrete_pump_required?: boolean;      // ปั๊มคอนกรีตทับหน้า
  vibrator_days?: number;                // เครื่องจี้
  curing_method?: 'water' | 'plastic' | 'compound';
  termite_pipe_length_m?: number;        // ท่อยาปลวก (ม.)
  delivery_trips?: number;              // จำนวนเที่ยวส่ง (auto: 1 เที่ยว/10 แผ่น)
}

// ─── STEP 10 — วางแผ่นพื้นสำเร็จ ───────────────────────────────────────────
export function calcStep10(inp: Step10Input): StepResult {
  const { precast_area_m2: A, topping_thickness_m: tt, waste_percent } = inp;
  const wf = 1 + waste_percent / 100;
  const pType = inp.precast_type ?? 'Hollow-core';
  const panelW = inp.panel_width_m ?? (pType === 'Plank' ? 0.35 : 1.20);
  const panelT = inp.panel_thickness_m ?? 0.12;
  const span = inp.span_m ?? 4.0;

  // ─── จำนวนแผ่น ──────────────────────────────────────────
  const panelCount = inp.precast_panel_count ?? Math.ceil(A / (panelW * span));

  const quantities: StepResult['quantities'] = {
    panel_area:     { qty: r2(A), uom: 'm²', label: `แผ่นพื้น ${pType} (~${panelCount} แผ่น, ${panelW}×${span} ม.)` },
    topping_volume: { qty: r2(A * tt * wf), uom: 'm³', label: `คอนกรีตทับหน้า ${r2(tt * 100)} ซม. (waste ${waste_percent}%)` },
  };

  // ─── ไวร์เมชทับหน้า ─────────────────────────────────────
  if (inp.wiremesh_kg_per_m2) {
    // เผื่อทาบไวร์เมช 15%
    quantities.wiremesh_kg = { qty: r2(A * 1.15 * inp.wiremesh_kg_per_m2), uom: 'kg', label: `ไวร์เมชทับหน้า (${inp.wiremesh_kg_per_m2} kg/m² รวมเผื่อทาบ 15%)` };
  }

  // ─── ค้ำยัน (auto from span) ─────────────────────────────
  if (inp.shoring_line_length_m) {
    quantities.shoring_length = { qty: inp.shoring_line_length_m, uom: 'm', label: 'ค้ำยัน Shoring (ระบุเอง)' };
  } else {
    // ค้ำยันทุก 1.5–2.0 ม. ตาม span → จำนวนเส้น = span / 1.5  × ความยาวแนว
    const shoringLines = Math.max(1, Math.ceil(span / 1.5) - 1); // กี่เส้นต่อช่วง
    const totalWidth = A / span; // ความกว้างรวม
    const shoringLen = r2(shoringLines * totalWidth);
    quantities.shoring_length = { qty: shoringLen, uom: 'm', label: `ค้ำยัน auto (${shoringLines} เส้น × ${r2(totalWidth)} ม.)` };
  }

  // ─── เกร้าท์ระหว่างแผ่น ─────────────────────────────────
  if (inp.grout_between_panels == false) {
    const jointLength = r2(panelCount * span); // ทุกแผ่นมีรอยต่อยาว = span
    const groutVol = r2(jointLength * 0.02 * panelT); // กว้าง ~2 ซม. × หนาแผ่น
    quantities.grout = { qty: Math.max(r2(groutVol * 1000), 1), uom: 'kg', label: `เกร้าท์ระหว่างแผ่น (~${r2(jointLength)} ม.)` };
  }

  // ─── เครน ────────────────────────────────────────────────
  const craneDays = inp.crane_days ?? Math.max(1, Math.ceil(panelCount / 40));
  quantities.crane = { qty: craneDays, uom: 'วัน', label: `เครนยกแผ่น (~${panelCount} แผ่น, ${Math.min(panelCount, 40)} แผ่น/วัน)` };

  // ─── ปั๊มคอนกรีต ────────────────────────────────────────
  const toppingVol = A * tt * wf;
  if (inp.concrete_pump_required) {
    quantities.concrete_pump = { qty: Math.max(1, Math.ceil(toppingVol / 30)), uom: 'วัน', label: 'ปั๊มคอนกรีตทับหน้า' };
  }

  // ─── เครื่องจี้ ──────────────────────────────────────────
  const vibDays = inp.vibrator_days ?? Math.max(1, Math.ceil(A / 120));
  quantities.vibrator = { qty: vibDays, uom: 'วัน', label: 'เครื่องจี้ + ปาดคอนกรีต' };

  // ─── บ่ม ──────────────────────────────────────────────────
  const curing = inp.curing_method ?? 'water';
  if (curing === 'plastic' || curing === 'compound') {
    quantities.curing = { qty: r2(A * 1.1), uom: 'm²', label: curing === 'plastic' ? 'พลาสติกปิดบ่ม (+10%)' : 'น้ำยาบ่ม Curing Compound' };
  }

  // ─── ท่อยาปลวก ──────────────────────────────────────────
  if (inp.termite_pipe_length_m) {
    quantities.termite_pipe = { qty: inp.termite_pipe_length_m, uom: 'm', label: 'ท่อยาปลวก (Termite Pipe)' };
  }

  // ─── ขนส่งแผ่นพื้น ──────────────────────────────────────
  const trips = inp.delivery_trips ?? Math.max(1, Math.ceil(panelCount / 10));
  quantities.delivery = { qty: trips, uom: 'เที่ยว', label: `ขนส่งแผ่นพื้น (~${panelCount} แผ่น, ~10 แผ่น/เที่ยว)` };

  // ─── Warnings ─────────────────────────────────────────────
  const warnings: string[] = [];
  if (tt < 0.05) warnings.push('คอนกรีตทับหน้า (Topping) บางกว่า 0.05 ม. (5 ซม.) เสี่ยงต่อการหลุดร่อนและกะเทาะแตกเมื่อรับน้ำหนัก แนะนำให้เทที่ 0.05 ม. เป็นมาตรฐาน');
  if (tt > 0.07) warnings.push('คอนกรีตทับหน้าหนาเกิน 0.07 ม. พึงระวังเรื่องน้ำหนักบรรทุกจร (Dead Load) ที่จะไปกดทับแผ่นพื้นมากเกินควรพิจารณา');
  if (span > 4.5 && pType === 'Plank') warnings.push('แผ่นพื้นแบบท้องเรียบ (Plank) ที่ช่วงพาดเกิน 4.5 ม. จะมีอาการแอ่นตัว (Deflection) ตอนใช้งานจริง เดินแล้วพื้นจะสะเทือน ควรเปลี่ยนเป็นแบบ Hollow-core หรือเสริมคานซอย');
  if (panelCount > 80) warnings.push('คุณสั่งแผ่นพื้นสำเร็จ > 80 แผ่น โปรดตรวจสอบ "สถานที่กองแผ่นวัสดุหน้าไซต์" ว่ามีเพียงพอให้รถบรรทุกจอดเทียบลงของหรือไม่');
  if (toppingVol > 10 && inp.concrete_pump_required) warnings.push('เนื่องจากคอนกรีต Topping มีความบางมาก หากพื้นที่กว้างและเทด้วยคนหิ้วถัง คอนกรีตจะแห้งไม่ทันและแตกลายงา แนะนำให้เช่าท่อปั๊มคอนกรีต');
  if (waste_percent < 10) warnings.push('คอนกรีตทับหน้ามักจะไหลซึมลงตามร่องแผ่น และเลอะออกนอกขอบ ควรเผื่อ Waste คอนกรีตอย่างน้อย 10%');
  if (inp.wiremesh_kg_per_m2) warnings.push('ไม่ได้สั่งไวร์เมชทับหน้า — พื้นรับน้ำหนักจะเกิดรอยร้าวรุนแรง แนะนำให้ใส่ไวร์เมชอย่างน้อย 4 มม. @20 ซม.');

  // ─── QC Flags ──────────────────────────────────────────────
  const qc_flags: string[] = [];

  return { quantities, warnings, qc_flags };
}
