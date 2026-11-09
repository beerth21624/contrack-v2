// ─── Dev-mode trace labels of the plaster step (docs/dev-mode/README.md §5) ───
// Names follow the plaster page's field names. Formulas use {term} placeholders: each is a term below (an input
// field or another step of the same row) and is shown once by name and once with its number.
// Never mention the spreadsheet here (no sheet names, column letters or row numbers).
import type { CalcTraceLabels } from '../../trace/types';

export const PLASTER_TRACE_LABELS: CalcTraceLabels = {
    th: {
        terms: {
            // inputs (row fields)
            wallPart: 'ส่วนผนัง',
            kind: 'รายการ (ฉาบด้านนอก / ฉาบด้านใน)',
            sides: 'ฉาบกี่ด้าน',
            manualArea: 'พื้นที่ผนังโครงสร้าง ต่อด้าน',
            // intermediate values used in formulas
            brickNet: 'พื้นที่ผนังก่ออิฐ สุทธิ (หักประตู-หน้าต่างแล้ว) จากขั้นตอนก่ออิฐ',
            perSide: 'พื้นที่ผนัง ต่อด้าน',
            area: 'พื้นที่ฉาบ รวม (ต่อรายการ)',
            // outputs (and the same names inside formulas)
            exterior: 'ฉาบผนังด้านนอก',
            interior: 'ฉาบผนังด้านใน',
            total: 'พื้นที่ฉาบรวม',
            R189: 'งานฉาบปูนผนัง (ภายนอก) ที่ส่งเข้า BOQ',
            R190: 'งานฉาบปูนผนัง (ภายใน) ที่ส่งเข้า BOQ',
        },
        units: {
            sides: 'ด้าน', manualArea: 'ตร.ม.', brickNet: 'ตร.ม.', perSide: 'ตร.ม.', area: 'ตร.ม.',
            exterior: 'ตร.ม.', interior: 'ตร.ม.', total: 'ตร.ม.', R189: 'ตร.ม.', R190: 'ตร.ม.',
        },
        steps: {
            perSideBrick: { label: 'พื้นที่ผนัง ต่อด้าน ({part}) จากขั้นตอนก่ออิฐ', formula: '{brickNet}', unit: 'ตร.ม.' },
            perSideManual: { label: 'พื้นที่ผนังโครงสร้าง ต่อด้าน (กรอกเอง)', formula: '{manualArea}', unit: 'ตร.ม.' },
            area: { label: 'พื้นที่ฉาบ รวม', formula: '{perSide} × {sides}', unit: 'ตร.ม.' },
            exterior: { label: 'ฉาบผนังด้านนอก รวม', formula: 'Σ {area} (รายการฉาบด้านนอก)', unit: 'ตร.ม.' },
            interior: { label: 'ฉาบผนังด้านใน รวม', formula: 'Σ {area} (รายการฉาบด้านใน)', unit: 'ตร.ม.' },
            total: { label: 'พื้นที่ฉาบรวม', formula: '{exterior} + {interior}', unit: 'ตร.ม.' },
        },
    },
    en: {
        terms: {
            wallPart: 'Wall part',
            kind: 'Item (exterior / interior plaster)',
            sides: 'Number of plastered sides',
            manualArea: 'Structural wall area per side',
            brickNet: 'Net masonry wall area (doors and windows deducted) from the brick step',
            perSide: 'Wall area per side',
            area: 'Plaster area, total (per item)',
            exterior: 'Exterior wall plaster',
            interior: 'Interior wall plaster',
            total: 'Total plaster area',
            R189: 'Wall plaster (exterior) sent to the BOQ',
            R190: 'Wall plaster (interior) sent to the BOQ',
        },
        units: {
            sides: 'sides', manualArea: 'm²', brickNet: 'm²', perSide: 'm²', area: 'm²',
            exterior: 'm²', interior: 'm²', total: 'm²', R189: 'm²', R190: 'm²',
        },
        steps: {
            perSideBrick: { label: 'Wall area per side ({part}) from the brick step', formula: '{brickNet}', unit: 'm²' },
            perSideManual: { label: 'Structural wall area per side (typed)', formula: '{manualArea}', unit: 'm²' },
            area: { label: 'Plaster area, total', formula: '{perSide} × {sides}', unit: 'm²' },
            exterior: { label: 'Exterior wall plaster, total', formula: 'Σ {area} (exterior plaster items)', unit: 'm²' },
            interior: { label: 'Interior wall plaster, total', formula: 'Σ {area} (interior plaster items)', unit: 'm²' },
            total: { label: 'Total plaster area', formula: '{exterior} + {interior}', unit: 'm²' },
        },
    },
};
