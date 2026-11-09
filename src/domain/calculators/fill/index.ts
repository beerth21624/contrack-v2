// Sheet "ถมดิน" (Excel v5 sheet 34) → BOQ (Home) section 1, row 13.
// Spec: docs/excel-spec/01-boq-home-and-steps-00-05.md, Section 1 (b-2).
import { defineCalculator } from '../types';
import { NO_TRACE } from '../../trace/tracer';
import { FILL_TRACE_LABELS } from './trace.labels';

export interface FillInput {
    width: number;          // D4 ขนาดที่ดิน กว้าง (เมตร)
    length: number;         // D5 ขนาดที่ดิน ยาว (เมตร)
    height: number;         // D6 ถมดินสูง (เมตร)
    settlementPct: number;  // D7 เผื่อดินยุบตัว (%, whole number: 30 = 30 %)
    /** วัสดุถม / หมายเหตุ → BOQ N13 (deck p7: "วัสดุถม (ถ้ามี) ระบุที่ หมายเหตุ"). */
    material: string;
}

const num = (v: number) => (Number.isFinite(v) ? v : 0);

export const fill = defineCalculator<FillInput>({
    id: 'fill',
    sheetName: 'ถมดิน',
    title: 'โปรแกรมคำนวณปริมาณดินถม (คิว)',
    titleEn: 'Soil Fill Volume',
    sections: [1],
    deps: [],
    defaults: () => ({
        width: 20,
        length: 20,
        height: 0.45,
        settlementPct: 30,
        material: 'ลูกค้าจัดหาเอง',
    }),
    // Plan values (area and fill height) empty; the settlement allowance and the material choice keep Excel v5.
    blank: () => ({
        width: 0,
        length: 0,
        height: 0,
        settlementPct: 30,
        material: 'ลูกค้าจัดหาเอง',
    }),
    compute: (input, _ctx, tr = NO_TRACE) => {
        // D9 ปริมาณดินที่ต้องสั่ง = D4*D5*D6*(1+D7/100)
        const volume = num(input.width) * num(input.length) * num(input.height) * (1 + num(input.settlementPct) / 100);
        if (tr.enabled) {
            const width = num(input.width), length = num(input.length), height = num(input.height);
            const factor = 1 + num(input.settlementPct) / 100;
            tr.step('area', width * length, { width, length });
            tr.step('factor', factor, { settlementPct: num(input.settlementPct) });
            tr.step('volume', volume, { width, length, height, factor });
        }
        return { volume };
    },
    traceLabels: FILL_TRACE_LABELS,
    // BOQ E13 = 'ถมดิน'!D9. The BOQ's own 10 % waste (G13) stays on top (decision D10).
    boqLinks: [{ line: 'R13', field: 'qty', output: 'volume' }],
    boqText: (input) => ({ R13: { note: input.material } }),
});
