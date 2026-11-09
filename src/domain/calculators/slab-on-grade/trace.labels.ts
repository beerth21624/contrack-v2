// ─── Dev-mode trace labels of the slab-on-grade step (docs/dev-mode/README.md §5) ───
// Names follow the slab page's column titles. Never mention the spreadsheet here.
import type { CalcTraceLabels } from '../../trace/types';

/**
 * An input's term is its path without array indexes (`slabs.width`), the formulas use the bare field name
 * (`width`): every name is also known with the `slabs.` prefix so both resolve.
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
            name: 'ชื่อพื้น',
            width: 'กว้าง',
            length: 'ยาว',
            thickness: 'หนา',
            fillDepth: 'ดินถมกลับ · ถมลึก',
            sandThickness: 'ทรายหยาบ · หนา',
            barSize: 'เหล็กเสริม · ขนาด',
            layers: 'เหล็กเสริม · วางเหล็ก (ชั้น)',
            spacing: 'เหล็กเสริม · ระยะห่าง',
            // hard-coded constants
            sandFactor: 'ตัวคูณเผื่อทรายหยาบ (100% + 25%)',
            directions: 'จำนวนทิศทางที่วางเหล็ก (ตามยาว + ตามขวาง)',
            kgPerM: 'น้ำหนักเหล็ก {size} ต่อเมตร',
            // intermediate values used in formulas
            area: 'พื้นที่พื้น (กว้าง × ยาว)',
            perLayer: 'ความยาวเหล็กต่อ 1 ชั้น',
            barLength: 'เหล็กเสริม · ความยาว รวม',
            weight: 'เหล็กเสริม · น้ำหนัก',
            // outputs (and the same names inside formulas)
            backfill: 'ดินถมกลับ',
            sand: 'ทรายหยาบ',
            plastic: 'พลาสติกกันชื้น',
            concrete: 'คอนกรีต โครงสร้าง',
            'rebar.*': 'เหล็กเสริม {0} รวม',
        },
        units: {
            width: 'ม.', length: 'ม.', thickness: 'ม.', fillDepth: 'ม.', sandThickness: 'ม.', spacing: 'ม.', layers: 'ชั้น',
            directions: 'ทิศทาง', kgPerM: 'กก./ม.',
            area: 'ตร.ม.', perLayer: 'ม.', barLength: 'ม.', weight: 'กก.',
            backfill: 'ลบ.ม.', sand: 'ลบ.ม.', plastic: 'ตร.ม.', concrete: 'ลบ.ม.', 'rebar.*': 'กก.',
        },
        steps: {
            area: { label: 'พื้นที่พื้น', formula: '{width} × {length}', unit: 'ตร.ม.' },
            backfill: { label: 'ดินถมกลับ', formula: '{area} × {fillDepth}', unit: 'ลบ.ม.' },
            sand: { label: 'ทรายหยาบ', formula: '{area} × {sandThickness} × {sandFactor}', unit: 'ลบ.ม.' },
            plastic: { label: 'พลาสติกกันชื้น', formula: '{area}', unit: 'ตร.ม.' },
            perLayer: { label: 'เหล็กเสริม ความยาวต่อ 1 ชั้น', formula: '({area} ÷ {spacing}) × {directions}', unit: 'ม.' },
            barLength: { label: 'เหล็กเสริม ความยาว รวม', formula: '{perLayer} × {layers}', unit: 'ม.' },
            barLengthNone: { label: 'เหล็กเสริม ความยาว รวม (ระยะห่างเป็น 0 จึงไม่คิดเหล็ก)', formula: 'ระยะห่าง {spacing} เป็น 0 → 0', unit: 'ม.' },
            weight: { label: 'เหล็กเสริม {size} น้ำหนัก', formula: '{barLength} × {kgPerM}', unit: 'กก.' },
            concrete: { label: 'คอนกรีต โครงสร้าง', formula: '{area} × {thickness}', unit: 'ลบ.ม.' },
            totalBackfill: { label: 'ดินถมกลับ รวมทุกผืน', formula: 'Σ {backfill}', unit: 'ลบ.ม.' },
            totalSand: { label: 'ทรายหยาบ รวมทุกผืน', formula: 'Σ {sand}', unit: 'ลบ.ม.' },
            totalPlastic: { label: 'พลาสติกกันชื้น รวมทุกผืน', formula: 'Σ {plastic}', unit: 'ตร.ม.' },
            totalConcrete: { label: 'คอนกรีต โครงสร้าง รวมทุกผืน', formula: 'Σ {concrete}', unit: 'ลบ.ม.' },
            totalRebar: { label: 'เหล็กเสริม {size} รวม', formula: 'Σ {weight} (ผืนที่ใช้ {size})', unit: 'กก.' },
        },
    },
    en: {
        terms: {
            name: 'Slab name',
            width: 'Width',
            length: 'Length',
            thickness: 'Thickness',
            fillDepth: 'Backfill · fill depth',
            sandThickness: 'Coarse sand · thickness',
            barSize: 'Reinforcement · size',
            layers: 'Reinforcement · layers',
            spacing: 'Reinforcement · spacing',
            sandFactor: 'Coarse sand allowance factor (100% + 25%)',
            directions: 'Number of bar directions (lengthwise + crosswise)',
            kgPerM: 'Weight of {size} bar per metre',
            area: 'Slab area (width × length)',
            perLayer: 'Bar length per layer',
            barLength: 'Reinforcement · total length',
            weight: 'Reinforcement · weight',
            backfill: 'Backfill',
            sand: 'Coarse sand',
            plastic: 'Moisture barrier',
            concrete: 'Structural concrete',
            'rebar.*': 'Reinforcement {0}, total',
        },
        units: {
            width: 'm', length: 'm', thickness: 'm', fillDepth: 'm', sandThickness: 'm', spacing: 'm', layers: 'layers',
            directions: 'directions', kgPerM: 'kg/m',
            area: 'sq.m', perLayer: 'm', barLength: 'm', weight: 'kg',
            backfill: 'cu.m', sand: 'cu.m', plastic: 'sq.m', concrete: 'cu.m', 'rebar.*': 'kg',
        },
        steps: {
            area: { label: 'Slab area', formula: '{width} × {length}', unit: 'sq.m' },
            backfill: { label: 'Backfill', formula: '{area} × {fillDepth}', unit: 'cu.m' },
            sand: { label: 'Coarse sand', formula: '{area} × {sandThickness} × {sandFactor}', unit: 'cu.m' },
            plastic: { label: 'Moisture barrier', formula: '{area}', unit: 'sq.m' },
            perLayer: { label: 'Reinforcement, length per layer', formula: '({area} ÷ {spacing}) × {directions}', unit: 'm' },
            barLength: { label: 'Reinforcement, total length', formula: '{perLayer} × {layers}', unit: 'm' },
            barLengthNone: { label: 'Reinforcement, total length (spacing is 0, so no bars counted)', formula: 'spacing {spacing} is 0 → 0', unit: 'm' },
            weight: { label: 'Reinforcement {size}, weight', formula: '{barLength} × {kgPerM}', unit: 'kg' },
            concrete: { label: 'Structural concrete', formula: '{area} × {thickness}', unit: 'cu.m' },
            totalBackfill: { label: 'Backfill, all slabs', formula: 'Σ {backfill}', unit: 'cu.m' },
            totalSand: { label: 'Coarse sand, all slabs', formula: 'Σ {sand}', unit: 'cu.m' },
            totalPlastic: { label: 'Moisture barrier, all slabs', formula: 'Σ {plastic}', unit: 'sq.m' },
            totalConcrete: { label: 'Structural concrete, all slabs', formula: 'Σ {concrete}', unit: 'cu.m' },
            totalRebar: { label: 'Reinforcement {size}, total', formula: 'Σ {weight} (slabs using {size})', unit: 'kg' },
        },
    },
};

export const SLAB_ON_GRADE_TRACE_LABELS: CalcTraceLabels = withPrefix(BASE, 'slabs');
