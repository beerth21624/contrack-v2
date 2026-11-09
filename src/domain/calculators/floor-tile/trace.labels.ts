// ─── Dev-mode trace labels of the floor tile step (docs/dev-mode/README.md §5) ───
// Names follow the floor tile page's column titles. Never mention the spreadsheet here.
import type { CalcTraceLabels } from '../../trace/types';

/**
 * An input's term is its path without array indexes (`rows.width`), the formulas use the bare field name
 * (`width`): every name is also known with the `rows.` prefix so both resolve.
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
            code: 'ชนิดพื้น',
            width: 'กว้าง',
            length: 'ยาว',
            location: 'ตำแหน่ง',
            // intermediate values used in formulas
            area: 'พื้นที่ (กว้าง × ยาว)',
            // outputs
            F1: 'แกรนิตโต้ (F1) พื้นที่รวม',
            F3: 'แกรนิตโต้ กันลื่น (F3) พื้นที่รวม',
            F4: 'ปรับระดับ ทำกันซึม (F4) พื้นที่รวม',
            total: 'พื้นที่ปูพื้นรวม',
            R205: 'ปูกระเบื้องแกรนิตโต้ (F1) ส่งเข้า BOQ',
            R206: 'ปูกระเบื้องแกรนิตโต้ กันลื่น (F3) ส่งเข้า BOQ',
            R207: 'ปรับระดับ ทำกันซึม (F4) ส่งเข้า BOQ',
        },
        units: { width: 'ม.', length: 'ม.', area: 'ตร.ม.', F1: 'ตร.ม.', F3: 'ตร.ม.', F4: 'ตร.ม.', total: 'ตร.ม.', R205: 'ตร.ม.', R206: 'ตร.ม.', R207: 'ตร.ม.' },
        steps: {
            area: { label: 'พื้นที่', formula: '{width} × {length}', unit: 'ตร.ม.' },
            F1: { label: 'แกรนิตโต้ (F1) พื้นที่รวม', formula: 'Σ {area} (ห้องที่ชนิดพื้น F1)', unit: 'ตร.ม.' },
            F3: { label: 'แกรนิตโต้ กันลื่น (F3) พื้นที่รวม', formula: 'Σ {area} (ห้องที่ชนิดพื้น F3)', unit: 'ตร.ม.' },
            F4: { label: 'ปรับระดับ ทำกันซึม (F4) พื้นที่รวม', formula: 'Σ {area} (ห้องที่ชนิดพื้น F4)', unit: 'ตร.ม.' },
            total: { label: 'พื้นที่ปูพื้นรวม (ทุกห้อง)', formula: 'Σ {area}', unit: 'ตร.ม.' },
            R205: { label: 'ส่งเข้า BOQ: ปูกระเบื้องแกรนิตโต้ (F1)', formula: '{F1}', unit: 'ตร.ม.' },
            R206: { label: 'ส่งเข้า BOQ: ปูกระเบื้องแกรนิตโต้ กันลื่น (F3)', formula: '{F3}', unit: 'ตร.ม.' },
            R207: { label: 'ส่งเข้า BOQ: ปรับระดับ ทำกันซึม (F4)', formula: '{F4}', unit: 'ตร.ม.' },
        },
    },
    en: {
        terms: {
            code: 'Floor type',
            width: 'Width',
            length: 'Length',
            location: 'Location',
            area: 'Area (width × length)',
            F1: 'Granito tiles (F1), total area',
            F3: 'Anti-slip granito tiles (F3), total area',
            F4: 'Levelling and waterproofing (F4), total area',
            total: 'Total tiled floor area',
            R205: 'Granito tiles (F1) sent to the BOQ',
            R206: 'Anti-slip granito tiles (F3) sent to the BOQ',
            R207: 'Levelling and waterproofing (F4) sent to the BOQ',
        },
        units: { width: 'm', length: 'm', area: 'sq.m', F1: 'sq.m', F3: 'sq.m', F4: 'sq.m', total: 'sq.m', R205: 'sq.m', R206: 'sq.m', R207: 'sq.m' },
        steps: {
            area: { label: 'Area', formula: '{width} × {length}', unit: 'sq.m' },
            F1: { label: 'Granito tiles (F1), total area', formula: 'Σ {area} (rooms with floor type F1)', unit: 'sq.m' },
            F3: { label: 'Anti-slip granito tiles (F3), total area', formula: 'Σ {area} (rooms with floor type F3)', unit: 'sq.m' },
            F4: { label: 'Levelling and waterproofing (F4), total area', formula: 'Σ {area} (rooms with floor type F4)', unit: 'sq.m' },
            total: { label: 'Total tiled floor area (all rooms)', formula: 'Σ {area}', unit: 'sq.m' },
            R205: { label: 'Sent to the BOQ: granito tiles (F1)', formula: '{F1}', unit: 'sq.m' },
            R206: { label: 'Sent to the BOQ: anti-slip granito tiles (F3)', formula: '{F3}', unit: 'sq.m' },
            R207: { label: 'Sent to the BOQ: levelling and waterproofing (F4)', formula: '{F4}', unit: 'sq.m' },
        },
    },
};

export const FLOOR_TILE_TRACE_LABELS: CalcTraceLabels = withPrefix(BASE, 'rows');
