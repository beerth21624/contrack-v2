import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 21 Contract ────────────────────────────────────────────────────────
/** ห้องน้ำแต่ละห้อง */
export interface BathroomEntry {
  label: string;                       // ชื่อห้อง เช่น "ห้องน้ำชั้น 1", "ห้องน้ำ Master"
  width_m: number;                     // กว้าง (ม.)
  length_m: number;                    // ยาว (ม.)
  wall_tile_height_m: number;          // ความสูงที่ปูกระเบื้องผนัง (ม.) default 2.40
  door_width_m: number;               // กว้างประตู (ม.) default 0.70
  door_height_m: number;              // สูงประตู (ม.) default 2.00
}

/** ปูกระเบื้องห้องน้ำ (Bathroom Tiling) — input fields */
export interface Step21Input {
  bathrooms: BathroomEntry[];          // รายการห้องน้ำ (Dynamic List)
  waste_percent: number;               // เผื่อเสียหาย (ปกติ 10-15%)
  waterproof_height_m: number;         // ความสูงทากันซึม (default 1.80 ม.)
}

// ─── STEP 21 — งานปูกระเบื้องห้องน้ำ (Bathroom Tiling) ────────────────────────
export function calcStep21(inp: Step21Input): StepResult {
  const { bathrooms, waste_percent, waterproof_height_m } = inp;
  const wf = 1 + waste_percent / 100;

  let totalFloorArea = 0;
  let totalWallArea = 0;

  for (const b of bathrooms) {
    const floorArea = b.width_m * b.length_m;
    const perimeter = 2 * (b.width_m + b.length_m);
    const doorArea = b.door_width_m * b.door_height_m;
    const wallArea = Math.max(0, (perimeter * b.wall_tile_height_m) - doorArea);

    totalFloorArea += floorArea;
    totalWallArea += wallArea;
  }

  const quantities: StepResult['quantities'] = {};
  const numBath = bathrooms.length;

  // ─── 1. กระเบื้องพื้นห้องน้ำ (Floor Tiles) ──────────────
  quantities.floor_tiles = {
    qty: r2(totalFloorArea * wf),
    uom: 'm²',
    label: `กระเบื้องพื้นห้องน้ำ (${numBath} ห้อง, พื้นที่รวม ${r2(totalFloorArea)} ม²)`
  };

  // ─── 2. กระเบื้องผนังห้องน้ำ (Wall Tiles) ───────────────
  quantities.wall_tiles = {
    qty: r2(totalWallArea * wf),
    uom: 'm²',
    label: `กระเบื้องผนังห้องน้ำ (${numBath} ห้อง, พื้นที่รวม ${r2(totalWallArea)} ม²)`
  };

  // ─── 3. น้ำยากันซึม (Waterproofing) ─────────────────────
  // กันซึมพื้นทั้งหมด + ผนังตามความสูงที่ระบุ
  const avgTileHeight = bathrooms.length > 0 
    ? bathrooms.reduce((s, b) => s + b.wall_tile_height_m, 0) / bathrooms.length 
    : 2.40;
  const wallWpRatio = Math.min(waterproof_height_m / avgTileHeight, 1.0);
  const wpArea = totalFloorArea + (totalWallArea * wallWpRatio);

  quantities.waterproof = {
    qty: r2(wpArea * wf),
    uom: 'm²',
    label: `น้ำยากันซึม 2 รอบ (พื้น + ผนังสูง ${waterproof_height_m} ม.)`
  };

  // ─── 4. กาวซีเมนต์และยาแนว (Adhesive & Grout) ──────────────
  const totalTileArea = (totalFloorArea + totalWallArea) * wf;
  const adhesiveBags = Math.ceil(totalTileArea / 4); // 1 ถุง (20kg) ปูได้ 4 ม²
  const groutBags = Math.ceil(totalTileArea / 5);    // 1 ถุง (1kg) ยาแนวได้ 5 ม²

  if (adhesiveBags > 0) {
    quantities.adhesive_cement = {
      qty: adhesiveBags, uom: 'ถุง(20kg)',
      label: 'กาวซีเมนต์สำหรับกระเบื้องห้องน้ำ'
    };
    quantities.tile_grout = {
      qty: groutBags, uom: 'ถุง(1kg)',
      label: 'กาวยาแนวป้องกันเชื้อรา'
    };
  }

  const warnings: string[] = [];
  if (bathrooms.length === 0) {
    warnings.push('ยังไม่ได้เพิ่มห้องน้ำ กดปุ่ม "+ เพิ่มห้องน้ำ" เพื่อเริ่มกรอกข้อมูล');
  } else {
    if (totalFloorArea === 0) {
      warnings.push('พื้นที่ห้องน้ำรวมเป็น 0 กรุณาตรวจสอบขนาดกว้างยาวที่กรอกมาครับ');
    }

    let zeroWallHeight = false;
    for (const b of bathrooms) {
      if (b.wall_tile_height_m === 0) zeroWallHeight = true;
    }

    if (zeroWallHeight) {
      warnings.push('มีห้องน้ำที่ความสูงปูกระเบื้องผนังเป็น 0 ม. จะเป็นการทาสีเปลือยซึ่งห้องน้ำมักเกิดเชื้อราและทำความสะอาดคราบไคลยากมาก ใช้งานได้แค่ส้วมแห้งเท่านั้น');
    }

    if (waterproof_height_m === 0) {
      warnings.push('ข้อควรระวัง: ไม่ได้ระบุพื้นที่ทากันซึมบริเวณห้องน้ำ (Waterproofing) หากเป็นห้องน้ำชั้นบน อาจพิจารณาระบบกันซึมก่อนปูกระเบื้องเพื่อป้องกันปัญหาระยะยาว');
    } else if (waterproof_height_m < 0.30) {
      warnings.push('ความสูงกันซึมต่ำกว่า 30 ซม. อาจทำให้น้ำกระเด็นบริเวณฝักบัวซึมผ่านทะลุขอบพื้น-ผนังได้');
    }

    if (waste_percent < 10) {
      warnings.push(`เผื่อ % ซากกระเบื้องแค่ ${waste_percent}% ใช่มั้ยครับ? ห้องน้ำพื้นที่เล็ก ช่างต้องตัดกระเบื้องแหวกท่อน้ำรอบชักโครกและท่อเดรน เสียทิ้งเยอะ แนะนำเผื่อ 10-15%`);
    }
  }

  return { quantities, warnings, qc_flags: [] };
}
