// ─── Dev-mode trace labels of the roofing step (docs/dev-mode/README.md §5) ───
// Names follow the roofing page. Never mention the spreadsheet here (no sheet names, column letters or row numbers).
import type { CalcTraceLabels } from '../../trace/types';

/** BOQ quantity outputs of material rows 1…13 (output keys `R162`…`R174`, same order as the table). */
const boqRows = (label: (n: number) => string): Record<string, string> =>
    Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`R${162 + i}`, label(i + 1)]));
const boqUnits = (u: string): Record<string, string> =>
    Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`R${162 + i}`, u]));


/**
 * An input's term is its path without array indexes (`{field}.width`), the formulas use the bare field name
 * (`width`): every name is also known with the `{field}.` prefix so both resolve.
 */
const withPrefix = (labels: CalcTraceLabels, prefix: string): CalcTraceLabels => {
    const alias = (t: Record<string, string>): Record<string, string> => ({
        ...Object.fromEntries(Object.entries(t).filter(([k]) => !k.includes('*')).map(([k, v]) => [`${prefix}.${k}`, v])),
        ...t,
    });
    const set = (l: CalcTraceLabels['th']): CalcTraceLabels['th'] => ({
        ...l, terms: alias(l.terms), ...(l.units ? { units: alias(l.units) } : {}),
    });
    return { th: set(labels.th), en: set(labels.en) };
};

const BASE: CalcTraceLabels = {
    th: {
        terms: {
            // inputs
            planArea: 'พื้นที่ตามแนวราบ',
            slopeDeg: 'ความลาดเอียงหลังคา',
            item: 'รายการวัสดุมุงและครอบ',
            factor: 'ปริมาณ ต่อหน่วย',
            factorUnit: 'หน่วย (ปริมาณ ต่อหน่วย)',
            takeoffUnit: 'หน่วย (ปริมาณถอดแบบ)',
            unit: 'หน่วยซื้อ',
            key: 'รหัสแถว',
            'takeoff.kind': 'ที่มาของปริมาณถอดแบบ',
            'takeoff.lengths': 'ปริมาณถอดแบบ · ความยาว/จำนวน',
            'takeoff.deg': 'ความชันครอบข้างจั่ว',
            'takeoff.ref': 'ใช้ค่าเดียวกับแถว',
            // intermediate values used in formulas
            slopeArea: 'พื้นที่ตามแนวลาดเอียง',
            lengths: 'ความยาวรวม (ตามที่กรอก)',
            deg: 'ความชันครอบข้างจั่ว',
            rakeFactor: '1 ÷ cos(ความชัน)',
            refTakeoff: 'ปริมาณถอดแบบของแถวที่อ้างถึง',
            takeoff: 'ปริมาณถอดแบบ',
            fasciaTakeoff: 'ปริมาณถอดแบบ ไม้เชิงชาย',
            // outputs
            fasciaLength: 'ความยาวเชิงชาย',
            'takeoff.*': 'ปริมาณถอดแบบ แถว {0}',
            'qty.*': 'ปริมาณ BOQ แถว {0}',
            ...boqRows(n => `ปริมาณ BOQ แถว ${n}`),
            R175: 'ค่าแรงมุงหลังคา (พื้นที่ตามแนวลาดเอียง)',
            R176: 'ค่าแรงติดตั้งไม้เชิงชาย (ความยาวเชิงชาย)',
        },
        units: {
            planArea: 'ตร.ม.', slopeDeg: 'องศา', 'takeoff.deg': 'องศา', deg: 'องศา',
            slopeArea: 'ตร.ม.', lengths: 'ม.', fasciaLength: 'ม.', fasciaTakeoff: 'ม.',
            R175: 'ตร.ม.', R176: 'ม.', ...boqUnits('หน่วยซื้อ'),
        },
        steps: {
            slopeArea: { label: 'พื้นที่ตามแนวลาดเอียง', formula: '{planArea} ÷ cos({slopeDeg})', unit: 'ตร.ม.' },
            takeoffSlope: { label: 'ปริมาณถอดแบบ (พื้นที่ตามแนวลาดเอียง)', formula: '{slopeArea}', unit: '' },
            takeoffLengths: { label: 'ปริมาณถอดแบบ (รวมที่กรอก)', formula: 'Σ {lengths}', unit: '' },
            rakeFactor: { label: 'ตัวคูณตามความชันครอบข้างจั่ว (0 ถ้าความชันตั้งแต่ 90° ขึ้นไป)', formula: '1 ÷ cos({deg})', unit: '' },
            takeoffRake: { label: 'ปริมาณถอดแบบ (ความยาวตามแนวราบ คิดตามความชัน)', formula: 'Σ {lengths} × {rakeFactor}', unit: 'ม.' },
            takeoffRow: { label: 'ปริมาณถอดแบบ (ใช้ค่าเดียวกับแถว {ref})', formula: '{refTakeoff}', unit: '' },
            takeoffRowMissing: { label: 'ปริมาณถอดแบบ (ไม่พบแถวที่อ้างถึง นับเป็น 0)', formula: '0', unit: '' },
            qtyMul: { label: 'ปริมาณ BOQ (ปัดขึ้นเป็นจำนวนเต็ม)', formula: 'ปัดขึ้น({takeoff} × {factor})', unit: '' },
            qtyDiv: { label: 'ปริมาณ BOQ (ปัดขึ้นเป็นจำนวนเต็ม; หารด้วย 0 ได้ 0)', formula: 'ปัดขึ้น({takeoff} ÷ {factor})', unit: '' },
            laborSlopeArea: { label: 'ค่าแรงมุงหลังคา (พื้นที่ตามแนวลาดเอียง)', formula: '{slopeArea}', unit: 'ตร.ม.' },
            fasciaLength: { label: 'ความยาวเชิงชาย (ค่าแรงติดตั้งไม้เชิงชาย)', formula: '{fasciaTakeoff}', unit: 'ม.' },
        },
    },
    en: {
        terms: {
            planArea: 'Horizontal roof area',
            slopeDeg: 'Roof pitch',
            item: 'Roofing and capping material',
            factor: 'Quantity per unit',
            factorUnit: 'Unit (quantity per unit)',
            takeoffUnit: 'Unit (take-off quantity)',
            unit: 'Purchase unit',
            key: 'Row id',
            'takeoff.kind': 'Source of the take-off quantity',
            'takeoff.lengths': 'Take-off quantity · lengths / counts',
            'takeoff.deg': 'Gable verge pitch',
            'takeoff.ref': 'Same value as row',
            slopeArea: 'Sloped roof area',
            lengths: 'Total length (as entered)',
            deg: 'Gable verge pitch',
            rakeFactor: '1 ÷ cos(pitch)',
            refTakeoff: 'Take-off quantity of the referenced row',
            takeoff: 'Take-off quantity',
            fasciaTakeoff: 'Take-off quantity of the fascia board',
            fasciaLength: 'Fascia length',
            'takeoff.*': 'Take-off quantity, row {0}',
            'qty.*': 'BOQ quantity, row {0}',
            ...boqRows(n => `BOQ quantity, row ${n}`),
            R175: 'Roofing labour (sloped roof area)',
            R176: 'Fascia board installation labour (fascia length)',
        },
        units: {
            planArea: 'sq.m.', slopeDeg: 'degrees', 'takeoff.deg': 'degrees', deg: 'degrees',
            slopeArea: 'sq.m.', lengths: 'm', fasciaLength: 'm', fasciaTakeoff: 'm',
            R175: 'sq.m.', R176: 'm', ...boqUnits('purchase unit'),
        },
        steps: {
            slopeArea: { label: 'Sloped roof area', formula: '{planArea} ÷ cos({slopeDeg})', unit: 'sq.m.' },
            takeoffSlope: { label: 'Take-off quantity (sloped roof area)', formula: '{slopeArea}', unit: '' },
            takeoffLengths: { label: 'Take-off quantity (sum of what is entered)', formula: 'Σ {lengths}', unit: '' },
            rakeFactor: { label: 'Factor for the gable verge pitch (0 if the pitch is 90° or more)', formula: '1 ÷ cos({deg})', unit: '' },
            takeoffRake: { label: 'Take-off quantity (horizontal length, converted by the pitch)', formula: 'Σ {lengths} × {rakeFactor}', unit: 'm' },
            takeoffRow: { label: 'Take-off quantity (same as row {ref})', formula: '{refTakeoff}', unit: '' },
            takeoffRowMissing: { label: 'Take-off quantity (referenced row not found, counted as 0)', formula: '0', unit: '' },
            qtyMul: { label: 'BOQ quantity (rounded up to a whole number)', formula: 'round up({takeoff} × {factor})', unit: '' },
            qtyDiv: { label: 'BOQ quantity (rounded up to a whole number; divide by 0 gives 0)', formula: 'round up({takeoff} ÷ {factor})', unit: '' },
            laborSlopeArea: { label: 'Roofing labour (sloped roof area)', formula: '{slopeArea}', unit: 'sq.m.' },
            fasciaLength: { label: 'Fascia length (fascia board installation labour)', formula: '{fasciaTakeoff}', unit: 'm' },
        },
    },
};

export const ROOFING_TRACE_LABELS: CalcTraceLabels = withPrefix(BASE, 'rows');
