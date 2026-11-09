// ─── Dev-mode trace labels of the demolition step (docs/dev-mode/README.md §5) ───
// Names follow the demolition page's column titles. Never mention the spreadsheet here.
import type { CalcTraceLabels } from '../../trace/types';

export const DEMOLITION_TRACE_LABELS: CalcTraceLabels = {
    th: {
        terms: {
            label: 'ชื่องาน',
            unit: 'หน่วย',
            qty: 'ปริมาณ',
            rate: 'ค่ารื้อต่อหน่วย',
            check: 'รายละเอียดที่ต้องตรวจสอบ',
            lineTotal: 'รวม (ต่อรายการ)',
            total: 'รวมทั้งหมด',
            boqQty: 'ปริมาณส่ง BOQ (เหมา)',
            'row.*.qty': 'รายการที่ {0} · ปริมาณ',
            'row.*.rate': 'รายการที่ {0} · ค่ารื้อต่อหน่วย',
        },
        units: { rate: 'บาท/หน่วย', lineTotal: 'บาท', total: 'บาท', boqQty: 'เหมา' },
        steps: {
            lineTotal: { label: 'รวม (ต่อรายการ)', formula: '{qty} × {rate}', unit: 'บาท' },
            total: { label: 'รวมทั้งหมด', formula: 'Σ {lineTotal}', unit: 'บาท' },
            boqQty: { label: 'ปริมาณส่ง BOQ (เหมา)', formula: '1 ถ้า {total} > 0 มิฉะนั้น 0', unit: 'เหมา' },
        },
    },
    en: {
        terms: {
            label: 'Work name',
            unit: 'Unit',
            qty: 'Quantity',
            rate: 'Demolition cost per unit',
            check: 'Details to check',
            lineTotal: 'Total (per item)',
            total: 'Grand total',
            boqQty: 'Quantity sent to BOQ (lump sum)',
            'row.*.qty': 'Item {0} · Quantity',
            'row.*.rate': 'Item {0} · Demolition cost per unit',
        },
        units: { rate: 'baht/unit', lineTotal: 'baht', total: 'baht', boqQty: 'lump sum' },
        steps: {
            lineTotal: { label: 'Total (per item)', formula: '{qty} × {rate}', unit: 'baht' },
            total: { label: 'Grand total', formula: 'Σ {lineTotal}', unit: 'baht' },
            boqQty: { label: 'Quantity sent to BOQ (lump sum)', formula: '1 if {total} > 0, otherwise 0', unit: 'lump sum' },
        },
    },
};
