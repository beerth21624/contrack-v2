import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 20 Contract ────────────────────────────────────────────────────────
/** ห้องแต่ละห้อง (สำหรับปูกระเบื้องพื้น) */
export interface FloorRoomEntry {
  label: string;                       // ชื่อห้อง เช่น "ห้องนั่งเล่น", "ห้องครัว"
  width_m: number;                     // กว้าง (ม.)
  length_m: number;                    // ยาว (ม.)
  tile_size: '30x30' | '40x40' | '60x60' | '80x80' | '100x100';
}

/** ปูกระเบื้องพื้น (Floor Tiling) — input fields */
export interface Step20Input {
  rooms: FloorRoomEntry[];             // รายการห้อง (ไม่รวมห้องน้ำ → Step 21)
  laying_pattern: 'straight' | 'diagonal';
  waste_percent: number;               // 10% ตรง, 15% เฉียง
  // optional
  skirting_length_m?: number;          // บัวพื้น (auto = เส้นรอบรูปทุกห้อง)
}

// ─── STEP 20 — งานปูกระเบื้องพื้น ────────────────────────────────────────────
export function calcStep20(inp: Step20Input): StepResult {
  const { rooms, laying_pattern, waste_percent } = inp;
  const wf = 1 + waste_percent / 100;

  let totalArea = 0;
  let totalPerimeter = 0;

  for (const r of rooms) {
    totalArea += r.width_m * r.length_m;
    totalPerimeter += 2 * (r.width_m + r.length_m);
  }

  const quantities: StepResult['quantities'] = {};

  // 1. กระเบื้องพื้น
  quantities.tile_area = {
    qty: r2(totalArea * wf), uom: 'm²',
    label: `กระเบื้องพื้น (${rooms.length} ห้อง, ${r2(totalArea)} ม², ปู${laying_pattern === 'diagonal' ? 'เฉียง' : 'ตรง'})`
  };

  // 2. กาวซีเมนต์ — ดูขนาดกระเบื้องที่ใช้มากที่สุด
  const sizeCount: Record<string, number> = {};
  for (const r of rooms) {
    const area = r.width_m * r.length_m;
    sizeCount[r.tile_size] = (sizeCount[r.tile_size] ?? 0) + area;
  }
  const dominantSize = Object.entries(sizeCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '60x60';
  const tileSizeNum = parseInt(dominantSize.split('x')[0] ?? '60');
  const adhesiveRate = tileSizeNum >= 60 ? 6 : 5;
  const adhesiveBags = Math.ceil((totalArea * adhesiveRate * wf) / 20);

  quantities.adhesive_cement = {
    qty: adhesiveBags, uom: 'ถุง',
    label: `กาวซีเมนต์ (20kg) @${adhesiveRate} กก./ม²`
  };

  // 3. บัวพื้น — auto จากเส้นรอบรูป
  const skirtLen = inp.skirting_length_m ?? totalPerimeter;
  if (skirtLen > 0) {
    quantities.skirting = {
      qty: r2(skirtLen * wf), uom: 'm',
      label: 'บัวพื้น (Skirting)'
    };
  }

  // 4. กาวยาแนว
  const groutBags = Math.ceil(totalArea / 8); 
  if (groutBags > 0) {
    quantities.tile_grout = {
      qty: groutBags, uom: 'ถุง(1กก.)',
      label: 'กาวยาแนวพื้น (1 ถุง ปูได้ ~8 ม²)'
    };
  }

  const warnings: string[] = [];
  if (rooms.length === 0) {
    warnings.push('ยังไม่ได้เพิ่มห้อง/พื้นที่ปูกระเบื้อง');
  } else {
    if (totalArea === 0) warnings.push('พื้นที่รวมกระเบื้องเป็น 0');

    for (const r of rooms) {
      if (r.width_m === 0 || r.length_m === 0) warnings.push(`ห้อง ${r.label} มีระยะกว้างหรือยาวเป็น 0 ม.`);
      if (r.label.includes('น้ำ')) {
        warnings.push(`คุณใส่ "${r.label}" ลงในหมวดนี้ งานห้องน้ำจะมีสเปคต้องทากันซึมและปรับสโลปน้ำทิ้ง แนะนำให้ไปใส่ใน "Step 21 (งานกระเบื้องห้องน้ำ)" แยกต่างหากเพื่อป้องกันการประเมินราคาตกหล่นครับ`);
      }
    }

    if (waste_percent === 0) {
      warnings.push('เปอร์เซ็นต์เผื่อแตกหัก (Waste) เป็น 0% ดาบหน้านี้ช่างทำกระเบื้องแตกตอนตัดเข้าฝ้า/ขอบเยอะมาก แนะนำเผื่อ 7-10% เสมอ ป้องกันกระเบื้องขาดแล้วหาลอตสีเดิมไม่ได้');
    } else if (laying_pattern === 'diagonal' && waste_percent < 12) {
      warnings.push('ปูลายทแยง 45° (Diagonal) จะเสียเศษเวลาตัดเข้ามุมกำแพงหนักมาก ควรเผื่อเศษตัด 12-15% ขั้นต่ำครับ');
    }

    if (inp.skirting_length_m === 0 && totalArea > 0) {
      warnings.push('คุณระบุความยาว "บัวเชิงผนัง (Skirting)" เป็น 0 ม. ถ้าเป็นห้องพักอาศัย เวลาแม่บ้านถูพื้นไม้ถูพื้นจะทำให้กำแพงกระดำกระด่าง ควรเผื่องานบัวพื้นด้วยครับ (ถ้าเจตนาทำบัวซ่อนผนังให้ข้ามข้อนี้ได้เลย)');
    }
  }

  return { quantities, warnings, qc_flags: [] };
}
