// ─── Dev-mode trace labels of the land inspection step (docs/dev-mode/README.md §5) ───
// Names follow the land inspection page. Never mention the spreadsheet here.
import type { CalcTraceLabels } from '../../trace/types';

export const LAND_INSPECTION_TRACE_LABELS: CalcTraceLabels = {
    th: {
        terms: {
            label: 'รายการค่าใช้จ่าย',
            qty: 'จำนวน',
            unit: 'หน่วย',
            unitPrice: 'ราคาต่อหน่วย',
            note: 'หมายเหตุ',
            lineTotal: 'รวม (บาท)',
            total: 'ต้นทุนรวม',
            projectName: 'ชื่อโครงการ',
            province: 'จังหวัด',
            surveyDate: 'วันที่เข้าสำรวจ',
            inspector: 'ผู้ตรวจสอบ',
        },
        units: { unitPrice: 'บาท', lineTotal: 'บาท', total: 'บาท' },
        steps: {
            lineTotal: { label: 'รวม (บาท)', formula: '{qty} × {unitPrice}', unit: 'บาท' },
            total: { label: 'ต้นทุนรวม', formula: 'Σ {lineTotal}', unit: 'บาท' },
        },
    },
    en: {
        terms: {
            label: 'Expense item',
            qty: 'Quantity',
            unit: 'Unit',
            unitPrice: 'Price per unit',
            note: 'Remark',
            lineTotal: 'Total (baht)',
            total: 'Total cost',
            projectName: 'Project name',
            province: 'Province',
            surveyDate: 'Survey date',
            inspector: 'Inspector',
        },
        units: { unitPrice: 'baht', lineTotal: 'baht', total: 'baht' },
        steps: {
            lineTotal: { label: 'Total (baht)', formula: '{qty} × {unitPrice}', unit: 'baht' },
            total: { label: 'Total cost', formula: 'Σ {lineTotal}', unit: 'baht' },
        },
    },
};
