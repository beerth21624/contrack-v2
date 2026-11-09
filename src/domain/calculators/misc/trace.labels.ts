// ─── Dev-mode trace labels of the miscellaneous work step (docs/dev-mode/README.md §5) ───
// Names follow the step page. Never mention the spreadsheet here (no sheet names, column letters or row numbers).
import type { CalcTraceLabels } from '../../trace/types';

export const MISC_TRACE_LABELS: CalcTraceLabels = {
    th: {
        terms: {
            // inputs (row fields)
            'items.item': 'รายการ',
            'items.qty': 'จำนวน',
            'items.unit': 'หน่วย',
            'items.mat': 'ค่าวัสดุ / หน่วย',
            'items.lab': 'ค่าแรง / หน่วย',
            // hard-coded values
            catalogueMat: 'ค่าวัสดุ / หน่วย (ราคาฮาร์ดโค้ดของรายการ)',
            catalogueLab: 'ค่าแรง / หน่วย (ราคาฮาร์ดโค้ดของรายการ)',
            // operands and outputs
            qty: 'จำนวน',
            mat: 'ค่าวัสดุ / หน่วย',
            lab: 'ค่าแรง / หน่วย',
            matTotal: 'ค่าวัสดุ',
            labTotal: 'ค่าแรง',
            rowTotal: 'รวม',
            rows: 'จำนวนรายการ',
        },
        units: {
            'items.qty': 'ตามหน่วยของรายการ', 'items.mat': 'บาท', 'items.lab': 'บาท',
            catalogueMat: 'บาท', catalogueLab: 'บาท', mat: 'บาท', lab: 'บาท', matTotal: 'บาท', labTotal: 'บาท', rowTotal: 'บาท',
            rows: 'รายการ',
        },
        steps: {
            matTotal: { label: 'ค่าวัสดุ', formula: '{mat} × {qty}', unit: 'บาท' },
            labTotal: { label: 'ค่าแรง', formula: '{lab} × {qty}', unit: 'บาท' },
            rowTotal: { label: 'รวม', formula: '({mat} + {lab}) × {qty}', unit: 'บาท' },
            rows: { label: 'จำนวนรายการที่ส่งเข้า BOQ', formula: 'นับรายการที่มีชื่อและจำนวนมากกว่า 0', unit: 'รายการ' },
            mat: { label: 'รวมค่าวัสดุ', formula: 'Σ {matTotal}', unit: 'บาท' },
            lab: { label: 'รวมค่าแรง', formula: 'Σ {labTotal}', unit: 'บาท' },
            total: { label: 'รวมทั้งหมด', formula: 'Σ {rowTotal}', unit: 'บาท' },
        },
    },
    en: {
        terms: {
            'items.item': 'Item',
            'items.qty': 'Quantity',
            'items.unit': 'Unit',
            'items.mat': 'Material / unit',
            'items.lab': 'Labour / unit',
            catalogueMat: 'Material / unit (hard-coded price of the item)',
            catalogueLab: 'Labour / unit (hard-coded price of the item)',
            qty: 'Quantity',
            mat: 'Material / unit',
            lab: 'Labour / unit',
            matTotal: 'Material cost',
            labTotal: 'Labour cost',
            rowTotal: 'Total',
            rows: 'Number of items',
        },
        units: {
            'items.qty': 'per item unit', 'items.mat': 'THB', 'items.lab': 'THB',
            catalogueMat: 'THB', catalogueLab: 'THB', mat: 'THB', lab: 'THB', matTotal: 'THB', labTotal: 'THB', rowTotal: 'THB',
            rows: 'items',
        },
        steps: {
            matTotal: { label: 'Material cost', formula: '{mat} × {qty}', unit: 'THB' },
            labTotal: { label: 'Labour cost', formula: '{lab} × {qty}', unit: 'THB' },
            rowTotal: { label: 'Total', formula: '({mat} + {lab}) × {qty}', unit: 'THB' },
            rows: { label: 'Number of items sent to the BOQ', formula: 'count of items with a name and a quantity above 0', unit: 'items' },
            mat: { label: 'Total material cost', formula: 'Σ {matTotal}', unit: 'THB' },
            lab: { label: 'Total labour cost', formula: 'Σ {labTotal}', unit: 'THB' },
            total: { label: 'Grand total', formula: 'Σ {rowTotal}', unit: 'THB' },
        },
    },
};
