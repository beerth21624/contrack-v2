import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 19 Contract ────────────────────────────────────────────────────────
/** ห้องแต่ละห้อง (สำหรับฝ้าเพดาน) */
export interface CeilingRoomEntry {
  label: string;                       // ชื่อห้อง เช่น "ห้องนั่งเล่น", "ห้องนอน 1"
  width_m: number;                     // กว้าง (ม.)
  length_m: number;                    // ยาว (ม.)
  has_drop_ceiling: boolean;           // มีฝ้าหลุม/ฝ้า Drop หรือไม่
  drop_area_m2: number;               // พื้นที่ฝ้า Drop (ม²) — ถ้ามี
}

/** ปิดฝ้าเพดาน (Ceiling Works) — input fields */
export interface Step19Input {
  rooms: CeilingRoomEntry[];           // รายการห้อง
  ceiling_type: 'gypsum' | 'gypsum_moisture' | 'gypsum_fire' | 'fiber_cement' | 'fiber_cement_6' | 'calcium_silicate';
  waste_percent: number;               // 10-15%
  // optional
  cornice_length_m?: number;           // บัวฝ้าเพดาน (auto = เส้นรอบรูปทุกห้อง)
  grid_frame_spacing_m?: number;       // ระยะห่างโครง C-line (default 0.60)
}

// ─── STEP 19 — งานปิดฝ้าเพดาน ───────────────────────────────────────────────
export function calcStep19(inp: Step19Input): StepResult {
  const { rooms, ceiling_type, waste_percent } = inp;
  const wf = 1 + waste_percent / 100;
  const frame_sp = inp.grid_frame_spacing_m ?? 0.60;

  let totalCeilingArea = 0;
  let totalDropArea = 0;
  let totalPerimeter = 0;

  for (const r of rooms) {
    const area = r.width_m * r.length_m;
    totalCeilingArea += area;
    totalPerimeter += 2 * (r.width_m + r.length_m);
    if (r.has_drop_ceiling) totalDropArea += r.drop_area_m2;
  }

  const totalPanelArea = totalCeilingArea + totalDropArea;
  const typeLabel: Record<string, string> = {
    gypsum: 'ยิปซั่มบอร์ด 9 มม.',
    gypsum_moisture: 'ยิปซั่มกันชื้น 9 มม.',
    gypsum_fire: 'ยิปซั่มกันไฟ 12 มม.',
    fiber_cement: 'ไฟเบอร์ซีเมนต์ 4 มม.',
    fiber_cement_6: 'ไฟเบอร์ซีเมนต์ 6 มม.',
    calcium_silicate: 'แคลเซียมซิลิเกต 6 มม.',
  };

  const quantities: StepResult['quantities'] = {};

  // Type-specific quantity key for price-list mapping
  const qtyKey: Record<string, string> = {
    gypsum: 'ceiling_area',                // → CLG-PANEL
    gypsum_moisture: 'ceiling_area_moist',  // → CLG-PANEL-MOIST
    gypsum_fire: 'ceiling_area_fire',       // → CLG-PANEL-FIRE
    fiber_cement: 'ceiling_area_fiber',      // → CLG-FIBER
    fiber_cement_6: 'ceiling_area_fiber6',   // → CLG-FIBER-6
    calcium_silicate: 'ceiling_area_calcium', // → CLG-CALCIUM
  };

  quantities[qtyKey[ceiling_type] ?? 'ceiling_area'] = {
    qty: r2(totalPanelArea * wf), uom: 'm²',
    label: `แผ่นฝ้า${typeLabel[ceiling_type] ?? ceiling_type} (${rooms.length} ห้อง, ${r2(totalCeilingArea)} ม²)`
  };

  // โครงคร่าว C-line
  const totalFrameArea = totalCeilingArea + totalDropArea * 1.5;
  quantities.c_line_frame = {
    qty: r2(totalFrameArea / frame_sp * 2 * wf), uom: 'm',
    label: `โครงคร่าว C-line (@${frame_sp} ม.)`
  };

  // บัวฝ้าเพดาน — auto จากเส้นรอบรูป ถ้าไม่ระบุ
  const corniceLen = inp.cornice_length_m ?? totalPerimeter;
  if (corniceLen > 0) {
    quantities.cornice = { qty: r2(corniceLen * wf), uom: 'm', label: 'บัวเชิงผนัง-ฝ้า (Cornice)' };
  }

  const warnings: string[] = [];
  if (rooms.length === 0) {
    warnings.push('ยังไม่ได้เพิ่มห้อง/พื้นที่ฝ้าเพดาน');
  } else {
    if (totalCeilingArea === 0) {
      warnings.push('พื้นที่ฝ้ารวมเป็น 0 กรุณาตรวจสอบขนาดกว้างยาวของห้อง');
    }

    let hasBathroomWithGypsum = false;
    let hasExteriorWithGypsum = false;
    let missingDropArea = false;

    for (const r of rooms) {
      if (r.width_m === 0 || r.length_m === 0) warnings.push(`ห้อง ${r.label} มีระยะกว้างหรือยาวเป็น 0 ม.`);
      if (r.has_drop_ceiling && r.drop_area_m2 === 0) missingDropArea = true;

      const label = r.label.toLowerCase();
      const isWetRoom = label.includes('น้ำ') || label.includes('ซักล้าง');
      const isExterior = label.includes('นอก') || label.includes('ระเบียง') || label.includes('ชายคา');

      if (isWetRoom && ceiling_type === 'gypsum') hasBathroomWithGypsum = true;
      if (isExterior && ceiling_type === 'gypsum') hasExteriorWithGypsum = true;
    }

    if (missingDropArea) {
      warnings.push('มีห้องที่เลือก "ฝ้าหลุม (Drop Ceiling)" แต่พื้นที่ส่วนนั้นเป็น 0 จะทำให้โครง C-line ประเมินต่ำกว่าจริง');
    }
    if (hasBathroomWithGypsum) {
      warnings.push('ข้อเสนอแนะเชิงวิศวกรรม: บริเวณพื้นที่เปียกชื้นควรระบุเป็นแผ่นยิปซั่มทนความชื้น เพื่อป้องกันการสะสมความชื้นและการเกิดเชื้อราในระยะยาว');
    }
    if (hasExteriorWithGypsum) {
      warnings.push('ระวัง บริเวณชายคานอกบ้านหรือระเบียง ทนลมฝนและความชื้นสูง ไม่ควรใช้ยิปซั่ม แนะนำ "ไฟเบอร์ซีเมนต์ (สมาร์ทบอร์ด) ชนิดมีรูระบายอากาศ"');
    }
    if (waste_percent === 0) {
      warnings.push('คุณไม่ได้เผื่อ % แผ่นฝ้าแตกหักเลย แผ่นฝ้าแตกง่ายตอนขนย้ายและตัดเข้ามุม แนะนำเผื่อ 10-15% เสมอ ป้องกันวัสดุขาดแคลนระหว่างการติดตั้ง');
    }
    if (ceiling_type === 'gypsum' && corniceLen === 0) {
      warnings.push('งานฝ้ายิปซั่มฉาบเรียบ มักต้องการ "บัวฝ้า/มอบฝ้า" ปิดรอยต่อชนผนัง (เว้นแต่จะทำ Shadow Gap) อย่าลืมประเมินราคาส่วนนี้รวมเข้าไปด้วย');
    }
  }

  return { quantities, warnings, qc_flags: [] };
}
