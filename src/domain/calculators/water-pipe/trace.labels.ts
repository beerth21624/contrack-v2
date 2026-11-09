// ─── Dev-mode trace labels of the water pipe step (docs/dev-mode/README.md §5) ───
// Names follow the water pipe page. Never mention the spreadsheet here.
import type { CalcTraceLabels } from '../../trace/types';

export const WATER_PIPE_TRACE_LABELS: CalcTraceLabels = {
    th: {
        terms: {
            label: 'รายการ',
            size: 'ขนาดท่อ/ชนิด',
            horizontal: 'ยาว แนวราบ',
            vertical: 'ยาว แนวดิ่ง',
            length: 'ยาว รวม',
            R213: 'ท่อเมนภายนอก PVC 3/4" ยาวรวม',
            R214: 'ท่อย่อยภายใน (ห้องน้ำ) PVC 1/2" ยาวรวม',
            total: 'ความยาวท่อรวมทั้งหมด',
            unlinked: 'ความยาวที่ไม่เข้ารายการ BOQ',
        },
        units: { horizontal: 'ม.', vertical: 'ม.', length: 'ม.', R213: 'ม.', R214: 'ม.', total: 'ม.', unlinked: 'ม.' },
        steps: {
            length: { label: 'ยาว รวม', formula: '{horizontal} + {vertical}', unit: 'ม.' },
            line_R213: { label: 'ท่อเมนภายนอก PVC 3/4" ยาวรวม', formula: 'Σ {length} (แถวที่เข้ารายการนี้)', unit: 'ม.' },
            line_R214: { label: 'ท่อย่อยภายใน (ห้องน้ำ) PVC 1/2" ยาวรวม', formula: 'Σ {length} (แถวที่เข้ารายการนี้)', unit: 'ม.' },
            total: { label: 'ความยาวท่อรวมทั้งหมด', formula: 'Σ {length}', unit: 'ม.' },
            unlinked: { label: 'ความยาวที่ไม่เข้ารายการ BOQ', formula: 'Σ {length} (แถวที่ไม่มีรายการ BOQ รองรับ)', unit: 'ม.' },
        },
    },
    en: {
        terms: {
            label: 'Item',
            size: 'Pipe size / type',
            horizontal: 'Length, horizontal',
            vertical: 'Length, vertical',
            length: 'Total length',
            R213: 'Main pipe outside, PVC 3/4", total length',
            R214: 'Branch pipe inside (bathroom), PVC 1/2", total length',
            total: 'Total pipe length',
            unlinked: 'Length not reaching a BOQ line',
        },
        units: { horizontal: 'm', vertical: 'm', length: 'm', R213: 'm', R214: 'm', total: 'm', unlinked: 'm' },
        steps: {
            length: { label: 'Total length', formula: '{horizontal} + {vertical}', unit: 'm' },
            line_R213: { label: 'Main pipe outside, PVC 3/4", total length', formula: 'Σ {length} (rows feeding this item)', unit: 'm' },
            line_R214: { label: 'Branch pipe inside (bathroom), PVC 1/2", total length', formula: 'Σ {length} (rows feeding this item)', unit: 'm' },
            total: { label: 'Total pipe length', formula: 'Σ {length}', unit: 'm' },
            unlinked: { label: 'Length not reaching a BOQ line', formula: 'Σ {length} (rows with no BOQ line)', unit: 'm' },
        },
    },
};
