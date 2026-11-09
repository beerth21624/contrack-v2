// Sheet "ตารางสรุปวัสดุงานโครงสร้าง" (Excel v5 sheet 24): one row per structural element, read from the
// element sheets. In Excel the BOQ reads quantities through this sheet; in the app each element calculator
// links its BOQ rows directly, so this sheet is a read-only overview (no inputs, no BOQ links).
// Spec: docs/excel-spec/02-structure-steps-06-13.md §1.
import { REBAR_SIZES } from '../../boq/slots';
import { defineCalculator, type CalcContext } from '../types';
import { NO_TRACE } from '../../trace/tracer';
import { STRUCTURE_SUMMARY_TRACE_LABELS } from './trace.labels';

/** Columns C–Q of sheet 24 (I–M are the five bar sizes). */
export const SUMMARY_COLUMNS = [
    { key: 'excavation', label: 'ดินขุด', unit: 'ลบ.ม.' },
    { key: 'sand', label: 'ทรายหยาบ', unit: 'ลบ.ม.' },
    { key: 'lean', label: 'คอนกรีตหยาบ', unit: 'ลบ.ม.' },
    { key: 'plastic', label: 'พลาสติก กันชื้น', unit: 'ตร.ม.' },
    { key: 'area', label: 'พื้นสำเร็จรูป', unit: 'ตร.ม.' },
    { key: 'wiremesh', label: 'เหล็กไวร์เมช', unit: 'ตร.ม.' },
    ...REBAR_SIZES.map(size => ({ key: `rebar.${size}`, label: size, unit: 'กก.' })),
    { key: 'props', label: 'ไม้ค้ำยัน', unit: 'ต้น' },
    { key: 'formwork', label: 'ไม้แบบ', unit: 'ตร.ม.' },
    { key: 'concrete', label: 'คอนกรีต โครงสร้าง', unit: 'ลบ.ม.' },
    { key: 'backfill', label: 'ดิน ถมกลับ', unit: 'ลบ.ม.' },
] as const;

/**
 * Rows 6–14 of sheet 24: element label (Excel column B), the calculator it reads, and where each column
 * comes from when it is not the calculator's output of the same name.
 */
export const SUMMARY_ELEMENTS: readonly {
    calc: string; label: string; from?: Partial<Record<string, { calc: string; output: string }>>;
}[] = [
    // Q6 footing backfill = Footing!AI6, which subtracts the pedestals — the pedestal calculator computes it.
    { calc: 'footing', label: 'งานฐานราก_Footing', from: { backfill: { calc: 'pedestal', output: 'backfill' } } },
    { calc: 'pedestal', label: 'งานเสาตอม่อ_Footing Column', from: { backfill: { calc: 'pedestal', output: '' } } },
    { calc: 'ground-beam', label: 'งานคานคอดิน_Beam' },
    { calc: 'slab-on-grade', label: 'งานพื้นหล่อในที่_Slab' },
    { calc: 'precast-slab', label: 'งานพื้นสำเร็จรูป_PS Slab(PS)' },
    { calc: 'column', label: 'งานเสาชั้น1_Column' },
    { calc: 'roof-beam', label: 'งานคานดาดฟ้า_RoofBeam' },
    { calc: 'roof-slab', label: 'งานพื้นดาดฟ้า_RoofSlab' },
    { calc: 'stair', label: 'งานบันได_Stair' },
];

function cell(ctx: CalcContext, el: typeof SUMMARY_ELEMENTS[number], column: string): number {
    const src = el.from?.[column];
    const v = src ? (src.output === '' ? undefined : ctx.outputs(src.calc)?.[src.output]) : ctx.outputs(el.calc)?.[column];
    return v !== undefined && Number.isFinite(v) ? v : 0;
}

export const structureSummary = defineCalculator<Record<string, never>>({
    id: 'structure-summary',
    sheetName: 'ตารางสรุปวัสดุงานโครงสร้าง',
    title: 'ตารางสรุปวัสดุงานโครงสร้าง',
    titleEn: 'Structural Materials Summary',
    sections: [6, 7, 8, 9, 10, 11, 12, 13],
    deps: SUMMARY_ELEMENTS.map(e => e.calc),
    defaults: () => ({}),
    compute: (_input, ctx, tr = NO_TRACE) => {
        const out: Record<string, number> = {};
        for (const col of SUMMARY_COLUMNS) {
            let total = 0;
            for (const el of SUMMARY_ELEMENTS) {
                const v = cell(ctx, el, col.key);
                out[`${el.calc}.${col.key}`] = v;
                total += v;
            }
            // Row 18 รวม. Excel's Q18 = SUM(Q7:Q17) leaves out the footing backfill Q6 — summed here (D1).
            out[`total.${col.key}`] = total;
            if (tr.enabled) {
                tr.step(`colTotal.${col.key}`, total, { cell: SUMMARY_ELEMENTS.map(el => out[`${el.calc}.${col.key}`] ?? 0) });
            }
        }
        // Row 20: total rebar kg.
        out['total.rebar'] = REBAR_SIZES.reduce((s, size) => s + (out[`total.rebar.${size}`] ?? 0), 0);
        if (tr.enabled) {
            const ops: Record<string, number> = {};
            for (const size of REBAR_SIZES) ops[`kg_${size}`] = out[`total.rebar.${size}`] ?? 0;
            tr.step('rebarAll', out['total.rebar'] ?? 0, ops);
        }
        return out;
    },
    traceLabels: STRUCTURE_SUMMARY_TRACE_LABELS,
    boqLinks: [],
});
