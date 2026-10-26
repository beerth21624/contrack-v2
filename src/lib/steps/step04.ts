import { type StepResult } from '@/types';
import { r2 } from './helpers';

// ─── Step 4 Contract ─────────────────────────────────────────────────────────
/** วางผัง / ปักหมุด — input fields */
export interface Step4Input {
  building_width_m: number;            // กว้างอาคาร
  building_length_m: number;           // ยาวอาคาร
  number_of_columns: number;           // จำนวนเสา (ตามแบบ)
  waste_percent: number;               // default 10
  // optional — basic
  string_multiplier?: number;          // ตัวคูณเอ็น (default 2.5)
  corner_count?: number;               // จำนวนมุม (default 4)
  measured_diagonal_m?: number;        // ทแยงมุมวัดจริง (QC check)
  // ─── cost-related (ใหม่) ────────────────────────────────
  profile_board_height_m?: number;     // ความสูงไม้แบบผัง (default 1.0 ม.)
  profile_board_spacing_m?: number;    // ระยะเว้นไม้ตั้ง (default 1.5 ม.)
  nail_per_joint?: number;             // ตะปูต่อข้อต่อ (default 4)
  concrete_marker_count?: number;      // จำนวนหมุดปูนถาวร (default = เสา)
  spray_paint_can_count?: number;      // สีสเปรย์ทำเครื่องหมาย (default 2)
  survey_crew_days?: number;           // จำนวนวันช่างสำรวจ (auto จากเสา)
  offset_distance_m?: number;          // ระยะออฟเซตไม้ผังจากตัวอาคาร (default 1.5 ม.)
  grid_line_count?: number;            // จำนวนเส้น grid (ถ้ารู้จากแบบ)
}

// ─── STEP 4 — วางผัง / ปักหมุด ───────────────────────────────────────────────
export function calcStep4(inp: Step4Input): StepResult {
  const {
    building_width_m, building_length_m, number_of_columns, waste_percent,
    measured_diagonal_m,
  } = inp;

  const strMul    = inp.string_multiplier ?? 2.5;
  const w         = 1 + waste_percent / 100;
  const offset    = inp.offset_distance_m ?? 1.5;
  
  // Guard against 0 or negative inputs for spacing and height
  const boardH    = Math.max(0, inp.profile_board_height_m ?? 1.0);
  const boardSpac = Math.max(0, inp.profile_board_spacing_m ?? 1.5);
  const nailPerJ  = Math.max(0, inp.nail_per_joint ?? 4);

  // ─── Core calculations ───────────────────────────────────
  const perimeter         = r2(2 * (building_width_m + building_length_m));
  const string_length     = r2(perimeter * strMul * w);
  const stake_required    = number_of_columns * 2; // 2 ไม้หมุดต่อเสา
  const expected_diagonal = r2(
    Math.sqrt(Math.pow(building_width_m, 2) + Math.pow(building_length_m, 2))
  );

  // ─── Profile board (ไม้แบบผัง) ───────────────────────────
  // ไม้ผังตีรอบอาคาร + offset
  const profile_perimeter = r2(2 * (building_width_m + 2 * offset + building_length_m + 2 * offset));
  // ไม้นอน (2 ตัว: บน + ล่าง) ตามเส้นรอบ
  const horizontal_board_m = r2(profile_perimeter * 2);
  // ไม้ตั้ง (ทุกๆ boardSpac ม.) ป้องกันการหารด้วยศูนย์
  const vertical_posts     = boardSpac > 0 ? Math.ceil(profile_perimeter / boardSpac) : 0;
  const vertical_board_m   = r2(vertical_posts * boardH);
  const total_board_m      = r2((horizontal_board_m + vertical_board_m) * w);

  // ตะปู
  const nail_count = vertical_posts * nailPerJ;

  // หมุดปูน
  const concrete_markers = inp.concrete_marker_count ?? number_of_columns;

  // ไม่มีเสา / ไม่มีขนาดอาคาร → ไม่มีงานวางผัง ไม่คิดขั้นต่ำ
  const has_layout = number_of_columns > 0 && building_width_m > 0 && building_length_m > 0;

  // สีสเปรย์
  const spray_cans = inp.spray_paint_can_count ?? (has_layout ? Math.max(2, Math.ceil(number_of_columns / 10)) : 0);

  // ค่าแรงสำรวจ (1 ชุด ทำได้ ~15-20 เสา/วัน)
  const survey_days = inp.survey_crew_days ?? (has_layout ? Math.max(1, Math.ceil(number_of_columns / 15)) : 0);

  const quantities: StepResult['quantities'] = {
    perimeter:           { qty: perimeter,           uom: 'm',    label: 'เส้นรอบอาคาร (Perimeter)' },
    string_length:       { qty: string_length,       uom: 'm',    label: 'เอ็นวางผัง (String)' },
    total_board:         { qty: total_board_m,        uom: 'm',    label: `ไม้แบบผัง (Profile Board) รวม waste ${waste_percent}%` },
    vertical_posts:      { qty: vertical_posts,      uom: 'ต้น',   label: `ไม้ตั้ง (ทุก ${boardSpac} ม. สูง ${boardH} ม.)` },
    stake_required:      { qty: stake_required,      uom: 'อัน',   label: 'ไม้หมุด/ไม้ปักศูนย์เสา' },
    nail_count:          { qty: nail_count,           uom: 'ตัว',   label: `ตะปู (${nailPerJ} ตัว/จุด)` },
    concrete_markers:    { qty: concrete_markers,    uom: 'จุด',   label: 'หมุดปูนตั้งศูนย์เสา' },
    spray_paint:         { qty: spray_cans,          uom: 'กระป๋อง', label: 'สีสเปรย์ทำเครื่องหมาย' },
    survey_man_days:     { qty: r2(survey_days * 2),  uom: 'คน-วัน', label: `ค่าแรงสำรวจ (${survey_days} วัน × 2 คน)` },
    expected_diagonal:   { qty: expected_diagonal,   uom: 'm',    label: 'ทแยงมุมที่ถูกต้อง (Expected)' },
  };

  // ─── Diagonal QC check ────────────────────────────────────
  const warnings: string[] = [];
  const qc_flags: string[] = [];

  if (measured_diagonal_m !== undefined) {
    const error = r2(Math.abs(measured_diagonal_m - expected_diagonal));
    quantities.diagonal_error = { qty: error, uom: 'm', label: 'ค่าคลาดเคลื่อนทแยงมุม' };
    if (error > 0.01) {
      warnings.push(`⚠ ทแยงมุมคลาดเคลื่อน ${(error * 1000).toFixed(0)} มม. — ค่าแนวทแยงคลาดเคลื่อนเกินเกณฑ์ ตรวจสอบการวางผังอีกครั้ง`);
    } else {
      warnings.push(`✓ ทแยงมุมคลาดเคลื่อน ${(error * 1000).toFixed(0)} มม. — อยู่ในเกณฑ์`);
    }
  }

  // ─── Warnings ─────────────────────────────────────────────
  if (offset < 1.0) {
    warnings.push(`ระยะร่นไม้แบบ (Offset) ${offset} ม. น้อยเกินไป เมื่อแบคโฮเข้าขุดหลุมฟุตติ้งหรือดินพังพอน จะทำให้ไม้ผังและเอ็นล้มระเนระนาด แนะนำที่ 1.0–1.5 ม.`);
  }

  if (boardH < 0.6) {
    warnings.push(`ความสูงไม้แบบ ${boardH} ม. อาจเตี้ยเกินไปเมื่อต้องขึงเอ็นเพื่อตีผัง (อาจติดเนินดิน) แนะนำความสูง 0.8–1.0 ม.`);
  }

  if (number_of_columns > 30) {
    warnings.push('โครงการมีเสา > 30 ต้น — ควรใช้กล้อง Total Station ยิงไลน์ประกบ เพื่อลดความคลาดเคลื่อนสะสมจากการดึงตลับเมตร');
  }

  if (building_width_m > 0 && building_length_m > 0) {
    const aspect = Math.max(building_width_m, building_length_m) / Math.min(building_width_m, building_length_m);
    if (aspect > 3) {
      warnings.push(`อาคารมีสัดส่วนหน้าแคบและลึกมาก (อัตราส่วน ${r2(aspect)}:1) — โอกาสเพี้ยนฉากสูงมาก ตรวจ grid line ช่วงกลางอาคารให้แม่นยำเป็นพิเศษ`);
    }
  }

  if (measured_diagonal_m === undefined) {
    warnings.push('ยังไม่ได้กรอก "ทแยงมุมจริง (QC)" — แนะนำให้ช่างเซอร์เวย์วัดระยะทแยงมุมจริงมากรอกเทียบ เพื่อการันตีว่าบ้านไม่เบี้ยว/ไม่เสียฉาก');
  }

  // ─── QC Flags ──────────────────────────────────────────────








  return { quantities, warnings, qc_flags };
}
