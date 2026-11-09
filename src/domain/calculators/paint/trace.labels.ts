// ─── Dev-mode trace labels of the painting step (docs/dev-mode/README.md §5) ───
// Names follow the painting page. Never mention the spreadsheet here (no sheet names, column letters or row numbers).
// The 27 BOQ quantity keys (one per painted area in each of the three paint sections) are generated below.
import type { CalcTraceLabels, TraceStepLabel } from '../../trace/types';

interface Line { key: string; th: string; en: string; boq: readonly string[] }

// Area lines in BOQ order; boq = [priming section, first coat section, final coat section (none for the skim coat)].
const LINES: readonly Line[] = [
    { key: 'wallExterior', th: 'ทาสีผนัง - ภายนอก', en: 'Wall painting - exterior', boq: ['R223', 'R245', 'R300'] },
    { key: 'wallInterior', th: 'ทาสีผนัง - ภายใน', en: 'Wall painting - interior', boq: ['R224', 'R246', 'R301'] },
    { key: 'ceilingExterior', th: 'ทาสีฝ้า - ภายนอก', en: 'Ceiling painting - exterior', boq: ['R225', 'R247', 'R302'] },
    { key: 'ceilingInterior', th: 'ทาสีฝ้า - ภายใน', en: 'Ceiling painting - interior', boq: ['R226', 'R248', 'R303'] },
    { key: 'ceilingSlat', th: 'ทาสีฝ้า - ไม้ระแนง', en: 'Ceiling painting - slats', boq: ['R227', 'R249', 'R304'] },
    { key: 'wallSlat', th: 'ทาสีผนัง - ไม้ระแนง', en: 'Wall painting - slats', boq: ['R228', 'R250', 'R305'] },
    { key: 'moulding', th: 'ทาสีผนัง - บัว', en: 'Wall painting - mouldings', boq: ['R229', 'R251', 'R306'] },
    { key: 'fascia', th: 'ทาสีผนัง - เชิงชาย', en: 'Wall painting - fascia', boq: ['R230', 'R252', 'R307'] },
    { key: 'skim', th: 'งานฉาบบาง (สกิมโค๊ท) - รวม', en: 'Skim coat - total', boq: ['R231'] },
];
const SECTION_TH = ['งานทาสีรองพื้น', 'งานทาสีจริง รอบที่ 1', 'งานทาสีรอบสุดท้าย'] as const;
const SECTION_EN = ['Primer coat', 'First finishing coat', 'Final coat'] as const;

function boqTerms(lang: 'th' | 'en') {
    const terms: Record<string, string> = {};
    const units: Record<string, string> = {};
    const steps: Record<string, TraceStepLabel> = {};
    for (const l of LINES) {
        l.boq.forEach((row, i) => {
            const name = lang === 'th'
                ? `${l.th} · ปริมาณ (${SECTION_TH[i]})`
                : `${l.en} · quantity (${SECTION_EN[i]})`;
            terms[row] = name;
            units[row] = lang === 'th' ? 'ตร.ม.' : 'sq.m';
            steps[row] = { label: name, formula: `{${l.key}}`, unit: lang === 'th' ? 'ตร.ม.' : 'sq.m' };
        });
    }
    return { terms, units, steps };
}

const bt = boqTerms('th');
const be = boqTerms('en');

export const PAINT_TRACE_LABELS: CalcTraceLabels = {
    th: {
        terms: {
            // inputs
            slatWallArea: 'พื้นที่ผนังไม้ระแนง',
            'mouldings.size': 'ขนาดบัว (ม.)',
            'mouldings.girth': 'ความกว้างรอบรูป (ม.)',
            'mouldings.length': 'ความยาว (ม.)',
            fasciaLength: 'ความยาวเชิงชาย',
            fasciaHeight: 'ความสูงเชิงชาย',
            // values read from other steps (shown in the inputs list)
            exterior: 'พื้นที่ผนังฉาบภายนอก (จากขั้นตอนงานฉาบ)',
            interior: 'พื้นที่ผนังฉาบภายใน (จากขั้นตอนงานฉาบ)',
            'paint.ภายนอก': 'พื้นที่ทาสีฝ้าภายนอก (จากขั้นตอนฝ้า)',
            'paint.ภายใน': 'พื้นที่ทาสีฝ้าภายใน (จากขั้นตอนฝ้า)',
            'paint.ไม้ระแนง': 'พื้นที่ทาสีฝ้าไม้ระแนง (จากขั้นตอนฝ้า)',
            // hard-coded values used when the other step is not in the project
            wallExteriorFallback: 'พื้นที่ผนังภายนอก (ฮาร์ดโค้ด ใช้เมื่อไม่มีขั้นตอนงานฉาบ)',
            wallInteriorFallback: 'พื้นที่ผนังภายใน (ฮาร์ดโค้ด ใช้เมื่อไม่มีขั้นตอนงานฉาบ)',
            ceilingExteriorFallback: 'พื้นที่ฝ้าภายนอก (ฮาร์ดโค้ด ใช้เมื่อไม่มีขั้นตอนฝ้า)',
            ceilingInteriorFallback: 'พื้นที่ฝ้าภายใน (ฮาร์ดโค้ด ใช้เมื่อไม่มีขั้นตอนฝ้า)',
            ceilingSlatFallback: 'พื้นที่ฝ้าไม้ระแนง (ฮาร์ดโค้ด ใช้เมื่อไม่มีขั้นตอนฝ้า)',
            // operands that stand for the dependency values
            wallExteriorFrom: 'พื้นที่ผนังฉาบภายนอก (จากขั้นตอนงานฉาบ)',
            wallInteriorFrom: 'พื้นที่ผนังฉาบภายใน (จากขั้นตอนงานฉาบ)',
            ceilingExteriorFrom: 'พื้นที่ทาสีฝ้าภายนอก (จากขั้นตอนฝ้า)',
            ceilingInteriorFrom: 'พื้นที่ทาสีฝ้าภายใน (จากขั้นตอนฝ้า)',
            ceilingSlatFrom: 'พื้นที่ทาสีฝ้าไม้ระแนง (จากขั้นตอนฝ้า)',
            // intermediate values and outputs
            girth: 'ความกว้างรอบรูป (ม.)',
            length: 'ความยาว (ม.)',
            mouldingArea: 'พื้นที่ทาสีบัว',
            wallExterior: 'ทาสีผนัง - ภายนอก',
            wallInterior: 'ทาสีผนัง - ภายใน',
            ceilingExterior: 'ทาสีฝ้า - ภายนอก',
            ceilingInterior: 'ทาสีฝ้า - ภายใน',
            ceilingSlat: 'ทาสีฝ้า - ไม้ระแนง',
            wallSlat: 'ทาสีผนัง - ไม้ระแนง',
            moulding: 'ทาสีผนัง - บัว',
            fascia: 'ทาสีผนัง - เชิงชาย',
            skim: 'งานฉาบบาง (สกิมโค๊ท) - รวม',
            ...bt.terms,
        },
        units: {
            slatWallArea: 'ตร.ม.', 'mouldings.girth': 'ม.', 'mouldings.length': 'ม.', fasciaLength: 'ม.', fasciaHeight: 'ม.',
            exterior: 'ตร.ม.', interior: 'ตร.ม.', 'paint.*': 'ตร.ม.',
            wallExteriorFallback: 'ตร.ม.', wallInteriorFallback: 'ตร.ม.', ceilingExteriorFallback: 'ตร.ม.',
            ceilingInteriorFallback: 'ตร.ม.', ceilingSlatFallback: 'ตร.ม.',
            girth: 'ม.', length: 'ม.', mouldingArea: 'ตร.ม.',
            wallExterior: 'ตร.ม.', wallInterior: 'ตร.ม.', ceilingExterior: 'ตร.ม.', ceilingInterior: 'ตร.ม.',
            ceilingSlat: 'ตร.ม.', wallSlat: 'ตร.ม.', moulding: 'ตร.ม.', fascia: 'ตร.ม.', skim: 'ตร.ม.',
            ...bt.units,
        },
        steps: {
            wallExterior: { label: 'ทาสีผนัง - ภายนอก', formula: '{wallExteriorFrom}', unit: 'ตร.ม.' },
            wallInterior: { label: 'ทาสีผนัง - ภายใน', formula: '{wallInteriorFrom}', unit: 'ตร.ม.' },
            ceilingExterior: { label: 'ทาสีฝ้า - ภายนอก', formula: '{ceilingExteriorFrom}', unit: 'ตร.ม.' },
            ceilingInterior: { label: 'ทาสีฝ้า - ภายใน', formula: '{ceilingInteriorFrom}', unit: 'ตร.ม.' },
            ceilingSlat: { label: 'ทาสีฝ้า - ไม้ระแนง', formula: '{ceilingSlatFrom}', unit: 'ตร.ม.' },
            wallExteriorDefault: { label: 'ทาสีผนัง - ภายนอก (ค่าฮาร์ดโค้ด)', formula: '{wallExteriorFallback}', unit: 'ตร.ม.' },
            wallInteriorDefault: { label: 'ทาสีผนัง - ภายใน (ค่าฮาร์ดโค้ด)', formula: '{wallInteriorFallback}', unit: 'ตร.ม.' },
            ceilingExteriorDefault: { label: 'ทาสีฝ้า - ภายนอก (ค่าฮาร์ดโค้ด)', formula: '{ceilingExteriorFallback}', unit: 'ตร.ม.' },
            ceilingInteriorDefault: { label: 'ทาสีฝ้า - ภายใน (ค่าฮาร์ดโค้ด)', formula: '{ceilingInteriorFallback}', unit: 'ตร.ม.' },
            ceilingSlatDefault: { label: 'ทาสีฝ้า - ไม้ระแนง (ค่าฮาร์ดโค้ด)', formula: '{ceilingSlatFallback}', unit: 'ตร.ม.' },
            wallSlat: { label: 'ทาสีผนัง - ไม้ระแนง', formula: '{slatWallArea}', unit: 'ตร.ม.' },
            mouldingArea: { label: 'พื้นที่ทาสีบัว', formula: '{girth} × {length}', unit: 'ตร.ม.' },
            moulding: { label: 'ทาสีผนัง - บัว', formula: 'Σ {mouldingArea}', unit: 'ตร.ม.' },
            fascia: { label: 'ทาสีผนัง - เชิงชาย', formula: '{fasciaLength} × {fasciaHeight}', unit: 'ตร.ม.' },
            skim: { label: 'งานฉาบบาง (สกิมโค๊ท) - รวม', formula: '{wallInterior} + {wallExterior}', unit: 'ตร.ม.' },
            ...bt.steps,
        },
    },
    en: {
        terms: {
            slatWallArea: 'Slat wall area',
            'mouldings.size': 'Moulding size (m)',
            'mouldings.girth': 'Girth width (m)',
            'mouldings.length': 'Length (m)',
            fasciaLength: 'Fascia length',
            fasciaHeight: 'Fascia height',
            exterior: 'Exterior plastered wall area (from the plastering step)',
            interior: 'Interior plastered wall area (from the plastering step)',
            'paint.ภายนอก': 'Exterior ceiling painting area (from the ceiling step)',
            'paint.ภายใน': 'Interior ceiling painting area (from the ceiling step)',
            'paint.ไม้ระแนง': 'Slat ceiling painting area (from the ceiling step)',
            wallExteriorFallback: 'Exterior wall area (hard-coded, used when there is no plastering step)',
            wallInteriorFallback: 'Interior wall area (hard-coded, used when there is no plastering step)',
            ceilingExteriorFallback: 'Exterior ceiling area (hard-coded, used when there is no ceiling step)',
            ceilingInteriorFallback: 'Interior ceiling area (hard-coded, used when there is no ceiling step)',
            ceilingSlatFallback: 'Slat ceiling area (hard-coded, used when there is no ceiling step)',
            wallExteriorFrom: 'Exterior plastered wall area (from the plastering step)',
            wallInteriorFrom: 'Interior plastered wall area (from the plastering step)',
            ceilingExteriorFrom: 'Exterior ceiling painting area (from the ceiling step)',
            ceilingInteriorFrom: 'Interior ceiling painting area (from the ceiling step)',
            ceilingSlatFrom: 'Slat ceiling painting area (from the ceiling step)',
            girth: 'Girth width (m)',
            length: 'Length (m)',
            mouldingArea: 'Moulding painting area',
            wallExterior: 'Wall painting - exterior',
            wallInterior: 'Wall painting - interior',
            ceilingExterior: 'Ceiling painting - exterior',
            ceilingInterior: 'Ceiling painting - interior',
            ceilingSlat: 'Ceiling painting - slats',
            wallSlat: 'Wall painting - slats',
            moulding: 'Wall painting - mouldings',
            fascia: 'Wall painting - fascia',
            skim: 'Skim coat - total',
            ...be.terms,
        },
        units: {
            slatWallArea: 'sq.m', 'mouldings.girth': 'm', 'mouldings.length': 'm', fasciaLength: 'm', fasciaHeight: 'm',
            exterior: 'sq.m', interior: 'sq.m', 'paint.*': 'sq.m',
            wallExteriorFallback: 'sq.m', wallInteriorFallback: 'sq.m', ceilingExteriorFallback: 'sq.m',
            ceilingInteriorFallback: 'sq.m', ceilingSlatFallback: 'sq.m',
            girth: 'm', length: 'm', mouldingArea: 'sq.m',
            wallExterior: 'sq.m', wallInterior: 'sq.m', ceilingExterior: 'sq.m', ceilingInterior: 'sq.m',
            ceilingSlat: 'sq.m', wallSlat: 'sq.m', moulding: 'sq.m', fascia: 'sq.m', skim: 'sq.m',
            ...be.units,
        },
        steps: {
            wallExterior: { label: 'Wall painting - exterior', formula: '{wallExteriorFrom}', unit: 'sq.m' },
            wallInterior: { label: 'Wall painting - interior', formula: '{wallInteriorFrom}', unit: 'sq.m' },
            ceilingExterior: { label: 'Ceiling painting - exterior', formula: '{ceilingExteriorFrom}', unit: 'sq.m' },
            ceilingInterior: { label: 'Ceiling painting - interior', formula: '{ceilingInteriorFrom}', unit: 'sq.m' },
            ceilingSlat: { label: 'Ceiling painting - slats', formula: '{ceilingSlatFrom}', unit: 'sq.m' },
            wallExteriorDefault: { label: 'Wall painting - exterior (hard-coded value)', formula: '{wallExteriorFallback}', unit: 'sq.m' },
            wallInteriorDefault: { label: 'Wall painting - interior (hard-coded value)', formula: '{wallInteriorFallback}', unit: 'sq.m' },
            ceilingExteriorDefault: { label: 'Ceiling painting - exterior (hard-coded value)', formula: '{ceilingExteriorFallback}', unit: 'sq.m' },
            ceilingInteriorDefault: { label: 'Ceiling painting - interior (hard-coded value)', formula: '{ceilingInteriorFallback}', unit: 'sq.m' },
            ceilingSlatDefault: { label: 'Ceiling painting - slats (hard-coded value)', formula: '{ceilingSlatFallback}', unit: 'sq.m' },
            wallSlat: { label: 'Wall painting - slats', formula: '{slatWallArea}', unit: 'sq.m' },
            mouldingArea: { label: 'Moulding painting area', formula: '{girth} × {length}', unit: 'sq.m' },
            moulding: { label: 'Wall painting - mouldings', formula: 'Σ {mouldingArea}', unit: 'sq.m' },
            fascia: { label: 'Wall painting - fascia', formula: '{fasciaLength} × {fasciaHeight}', unit: 'sq.m' },
            skim: { label: 'Skim coat - total', formula: '{wallInterior} + {wallExterior}', unit: 'sq.m' },
            ...be.steps,
        },
    },
};
