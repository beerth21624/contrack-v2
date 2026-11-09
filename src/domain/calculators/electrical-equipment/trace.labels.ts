// ─── Dev-mode trace labels of the electrical equipment step (docs/dev-mode/README.md §5) ───
// Names follow the pick-list page's column titles. Never mention the spreadsheet here.
import type { CalcTraceLabels } from '../../trace/types';


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
            item: 'รายการ',
            qty: 'จำนวน',
            unit: 'หน่วย',
            // (the price columns and the totals share these two names; the formulas use unitMat / unitLab)
            unitMat: 'ค่าวัสดุ / หน่วย',
            unitLab: 'ค่าแรง / หน่วย',
            // hard-coded prices of the price list
            catalogueMat: 'ค่าวัสดุ / หน่วย ของ {item}',
            catalogueLab: 'ค่าแรง / หน่วย ของ {item}',
            // intermediate values used in formulas
            matTotal: 'ค่าวัสดุ รวม (ต่อรายการ)',
            labTotal: 'ค่าแรง รวม (ต่อรายการ)',
            rowTotal: 'รวม (ต่อรายการ)',
            // outputs
            rows: 'จำนวนรายการที่ส่งเข้า BOQ',
            mat: 'ค่าวัสดุ',
            lab: 'ค่าแรง',
            total: 'รวมทั้งหมด',
        },
        units: { qty: 'ตามหน่วยของรายการ', mat: 'บาท', lab: 'บาท', unitMat: 'บาท', unitLab: 'บาท', catalogueMat: 'บาท', catalogueLab: 'บาท', matTotal: 'บาท', labTotal: 'บาท', rowTotal: 'บาท', rows: 'รายการ', total: 'บาท' },
        steps: {
            matTotal: { label: 'ค่าวัสดุ รวม', formula: '{unitMat} × {qty}', unit: 'บาท' },
            labTotal: { label: 'ค่าแรง รวม', formula: '{unitLab} × {qty}', unit: 'บาท' },
            rowTotal: { label: 'รวม (วัสดุ + แรง)', formula: '({unitMat} + {unitLab}) × {qty}', unit: 'บาท' },
            rows: { label: 'จำนวนรายการที่ส่งเข้า BOQ (รายการที่เลือกแล้วและจำนวนมากกว่า 0)', formula: 'นับรายการ', unit: 'รายการ' },
            totalMat: { label: 'รวมค่าวัสดุ', formula: 'Σ {matTotal}', unit: 'บาท' },
            totalLab: { label: 'รวมค่าแรง', formula: 'Σ {labTotal}', unit: 'บาท' },
            total: { label: 'รวมทั้งหมด', formula: 'Σ {rowTotal}', unit: 'บาท' },
        },
    },
    en: {
        terms: {
            item: 'Item',
            qty: 'Quantity',
            unit: 'Unit',
            unitMat: 'Material / unit',
            unitLab: 'Labour / unit',
            catalogueMat: 'Material / unit of {item}',
            catalogueLab: 'Labour / unit of {item}',
            matTotal: 'Material, total (per item)',
            labTotal: 'Labour, total (per item)',
            rowTotal: 'Total (per item)',
            rows: 'Number of items sent to the BOQ',
            mat: 'Material',
            lab: 'Labour',
            total: 'Grand total',
        },
        units: { qty: 'in the item\'s unit', mat: 'baht', lab: 'baht', unitMat: 'baht', unitLab: 'baht', catalogueMat: 'baht', catalogueLab: 'baht', matTotal: 'baht', labTotal: 'baht', rowTotal: 'baht', rows: 'items', total: 'baht' },
        steps: {
            matTotal: { label: 'Material, total', formula: '{unitMat} × {qty}', unit: 'baht' },
            labTotal: { label: 'Labour, total', formula: '{unitLab} × {qty}', unit: 'baht' },
            rowTotal: { label: 'Total (material + labour)', formula: '({unitMat} + {unitLab}) × {qty}', unit: 'baht' },
            rows: { label: 'Number of items sent to the BOQ (an item chosen with a quantity above 0)', formula: 'count of items', unit: 'items' },
            totalMat: { label: 'Total material', formula: 'Σ {matTotal}', unit: 'baht' },
            totalLab: { label: 'Total labour', formula: 'Σ {labTotal}', unit: 'baht' },
            total: { label: 'Grand total', formula: 'Σ {rowTotal}', unit: 'baht' },
        },
    },
};

export const ELECTRICAL_EQUIPMENT_TRACE_LABELS: CalcTraceLabels = withPrefix(BASE, 'items');
