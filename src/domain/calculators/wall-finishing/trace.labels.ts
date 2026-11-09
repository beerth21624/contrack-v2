// ─── Dev-mode trace labels of the wall finishing step (docs/dev-mode/README.md §5) ───
// Names follow the wall finishing page. Never mention the spreadsheet here.
import type { CalcTraceLabels } from '../../trace/types';
// The item texts are repeated here (importing them from ./index would be a circular import).
const MOULDING_0_3 = 'บัวตกแต่งผนัง ขนาด 0.3 หนา 0.1 ม.';
const MOULDING_0_1 = 'บัวตกแต่งผนัง ขนาด 0.1 หนา 0.1 ม.';

/** Output keys exist twice: by moulding size (`moulding.0.3`) and by the item text. */
const both = (size: string, item: string, text: string): Record<string, string> =>
    ({ [`moulding.${size}`]: text, [`moulding.${item}`]: text });


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
            // inputs (row fields)
            code: 'สัญลักษณ์',
            item: 'รายการ',
            width: 'กว้าง',
            length: 'ยาว',
            location: 'ตำแหน่ง',
            // hard-coded constants
            mouldingFace: 'หน้ากว้างบัว ขนาด {size}',
            mouldingThickness: 'ความหนาบัว ขนาด {size}',
            // intermediate values used in formulas
            mouldingRowLength: 'ความยาวบัว',
            slatRowArea: 'พื้นที่ผนังไม้ระแนง',
            mouldingTotal: 'ความยาวบัว ขนาด {size} รวม',
            mouldingPaint: 'พื้นที่ทาสีบัว (แต่ละขนาด)',
            // outputs
            slatWallArea: 'พื้นที่ผนังไม้ระแนง รวม',
            mouldingPaintArea: 'พื้นที่ทาสีบัว รวม',
            ...both('0.3', MOULDING_0_3, 'ความยาวบัว ขนาด 0.3 รวม'),
            ...both('0.1', MOULDING_0_1, 'ความยาวบัว ขนาด 0.1 รวม'),
            R218: 'บัวตกแต่งผนัง ขนาด 0.3 (ปริมาณ BOQ)',
            R219: 'บัวตกแต่งผนัง ขนาด 0.1 (ปริมาณ BOQ)',
            R220: 'กรุไม้ระแนง (ปริมาณ BOQ)',
        },
        units: {
            width: 'ม.', length: 'ม.', mouldingFace: 'ม.', mouldingThickness: 'ม.',
            mouldingRowLength: 'ม.', slatRowArea: 'ตร.ม.', mouldingTotal: 'ม.', mouldingPaint: 'ตร.ม.',
            slatWallArea: 'ตร.ม.', mouldingPaintArea: 'ตร.ม.',
            'moulding.0.3': 'ม.', 'moulding.0.1': 'ม.', R218: 'ม.', R219: 'ม.', R220: 'ตร.ม.',
        },
        steps: {
            mouldingRowLength: { label: 'ความยาวบัว', formula: '{width} + {length}', unit: 'ม.' },
            slatRowArea: { label: 'พื้นที่ผนังไม้ระแนง', formula: '{width} × {length}', unit: 'ตร.ม.' },
            mouldingTotal: { label: 'ความยาวบัว ขนาด {size} รวม', formula: 'Σ {mouldingRowLength}', unit: 'ม.' },
            mouldingPaint: { label: 'พื้นที่ทาสีบัว ขนาด {size} (ความยาว × รอบรูปบัว)', formula: '{mouldingTotal} × ({mouldingFace} + 2 × {mouldingThickness})', unit: 'ตร.ม.' },
            mouldingPaintArea: { label: 'พื้นที่ทาสีบัว รวม (ใช้ต่อในขั้นตอนทาสี)', formula: 'Σ {mouldingPaint}', unit: 'ตร.ม.' },
            slatWallArea: { label: 'พื้นที่ผนังไม้ระแนง รวม', formula: 'Σ {slatRowArea}', unit: 'ตร.ม.' },
        },
    },
    en: {
        terms: {
            code: 'Symbol',
            item: 'Item',
            width: 'Width',
            length: 'Length',
            location: 'Location',
            mouldingFace: 'Moulding face width, size {size}',
            mouldingThickness: 'Moulding thickness, size {size}',
            mouldingRowLength: 'Moulding length',
            slatRowArea: 'Slatted wall area',
            mouldingTotal: 'Moulding length, size {size}, total',
            mouldingPaint: 'Moulding paint area (each size)',
            slatWallArea: 'Slatted wall area, total',
            mouldingPaintArea: 'Moulding paint area, total',
            ...both('0.3', MOULDING_0_3, 'Moulding length, size 0.3, total'),
            ...both('0.1', MOULDING_0_1, 'Moulding length, size 0.1, total'),
            R218: 'Wall moulding size 0.3 (BOQ quantity)',
            R219: 'Wall moulding size 0.1 (BOQ quantity)',
            R220: 'Slatted wall cladding (BOQ quantity)',
        },
        units: {
            width: 'm', length: 'm', mouldingFace: 'm', mouldingThickness: 'm',
            mouldingRowLength: 'm', slatRowArea: 'sq.m.', mouldingTotal: 'm', mouldingPaint: 'sq.m.',
            slatWallArea: 'sq.m.', mouldingPaintArea: 'sq.m.',
            'moulding.0.3': 'm', 'moulding.0.1': 'm', R218: 'm', R219: 'm', R220: 'sq.m.',
        },
        steps: {
            mouldingRowLength: { label: 'Moulding length', formula: '{width} + {length}', unit: 'm' },
            slatRowArea: { label: 'Slatted wall area', formula: '{width} × {length}', unit: 'sq.m.' },
            mouldingTotal: { label: 'Moulding length, size {size}, total', formula: 'Σ {mouldingRowLength}', unit: 'm' },
            mouldingPaint: { label: 'Moulding paint area, size {size} (length × moulding girth)', formula: '{mouldingTotal} × ({mouldingFace} + 2 × {mouldingThickness})', unit: 'sq.m.' },
            mouldingPaintArea: { label: 'Moulding paint area, total (used by the paint step)', formula: 'Σ {mouldingPaint}', unit: 'sq.m.' },
            slatWallArea: { label: 'Slatted wall area, total', formula: 'Σ {slatRowArea}', unit: 'sq.m.' },
        },
    },
};

export const WALL_FINISHING_TRACE_LABELS: CalcTraceLabels = withPrefix(BASE, 'rows');
