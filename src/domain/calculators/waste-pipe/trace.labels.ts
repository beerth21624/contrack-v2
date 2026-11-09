// ─── Dev-mode trace labels of the waste pipe step (docs/dev-mode/README.md §5) ───
// Names follow the waste pipe page. Never mention the spreadsheet here.
import type { CalcTraceLabels } from '../../trace/types';

export const WASTE_PIPE_TRACE_LABELS: CalcTraceLabels = {
    th: {
        terms: {
            label: 'รายการ',
            size: 'ขนาดท่อ/ชนิด',
            horizontal: 'ยาว แนวราบ',
            vertical: 'ยาว แนวดิ่ง',
            length: 'ยาว รวม',
            R84: 'ท่อน้ำทิ้งชักโครก PVC 4" ยาวรวม',
            R85: 'ท่อน้ำทิ้ง ØW ØFD PVC 2" ยาวรวม',
            R86: 'ท่ออากาศถังบำบัด PVC 1" ยาวรวม',
            total: 'ความยาวท่อรวมทั้งหมด',
            unlinked: 'ความยาวที่ไม่เข้ารายการ BOQ',
        },
        units: { horizontal: 'ม.', vertical: 'ม.', length: 'ม.', R84: 'ม.', R85: 'ม.', R86: 'ม.', total: 'ม.', unlinked: 'ม.' },
        steps: {
            length: { label: 'ยาว รวม', formula: '{horizontal} + {vertical}', unit: 'ม.' },
            line_R84: { label: 'ท่อน้ำทิ้งชักโครก PVC 4" ยาวรวม', formula: 'Σ {length} (แถวที่เข้ารายการนี้)', unit: 'ม.' },
            line_R85: { label: 'ท่อน้ำทิ้ง ØW ØFD PVC 2" ยาวรวม', formula: 'Σ {length} (แถวที่เข้ารายการนี้)', unit: 'ม.' },
            line_R86: { label: 'ท่ออากาศถังบำบัด PVC 1" ยาวรวม', formula: 'Σ {length} (แถวที่เข้ารายการนี้)', unit: 'ม.' },
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
            R84: 'Toilet waste pipe PVC 4", total length',
            R85: 'Waste pipe (washbasin / floor drain) PVC 2", total length',
            R86: 'Septic tank vent pipe PVC 1", total length',
            total: 'Total pipe length',
            unlinked: 'Length not reaching a BOQ line',
        },
        units: { horizontal: 'm', vertical: 'm', length: 'm', R84: 'm', R85: 'm', R86: 'm', total: 'm', unlinked: 'm' },
        steps: {
            length: { label: 'Total length', formula: '{horizontal} + {vertical}', unit: 'm' },
            line_R84: { label: 'Toilet waste pipe PVC 4", total length', formula: 'Σ {length} (rows feeding this item)', unit: 'm' },
            line_R85: { label: 'Waste pipe (washbasin / floor drain) PVC 2", total length', formula: 'Σ {length} (rows feeding this item)', unit: 'm' },
            line_R86: { label: 'Septic tank vent pipe PVC 1", total length', formula: 'Σ {length} (rows feeding this item)', unit: 'm' },
            total: { label: 'Total pipe length', formula: 'Σ {length}', unit: 'm' },
            unlinked: { label: 'Length not reaching a BOQ line', formula: 'Σ {length} (rows with no BOQ line)', unit: 'm' },
        },
    },
};
