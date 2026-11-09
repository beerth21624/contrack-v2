// Sheet "ตู้ควบคุม_Load Center" (Excel v5 sheet 10) — pick-list of consumer unit, breakers, main cable and
// grounding → BOQ section 26 งานติดตั้งอุปกรณ์ไฟฟ้า, group "งานตู้ควบคุมระบบไฟฟ้า" (slot `items`, Excel rows 256–263).
// Excel links BOQ rows to fixed sheet rows (B5:C12) and types unit/prices in the BOQ; here every list row with
// qty > 0 becomes a BOQ row priced from the item catalogue below (spec 05 D2, shared core ../shared/pick-list).
// Spec: docs/excel-spec/05-mep-sanitary-misc.md §6.
import { NO_TRACE, type Tracer } from '../../trace/tracer';
import { defineCalculator } from '../types';
import { LOAD_CENTER_TRACE_LABELS } from './trace.labels';
import {
    boqRows, computePickList, matchKey, pickListSlotRows, pickRow, pickRowCalc, type Catalogue, type PickListInput,
} from '../shared/pick-list';

export type LoadCenterInput = PickListInput;

/** B5:B19 dropdown, verbatim and in Excel's list order (stray spaces and the "ชนาด" typo included). */
export const LOAD_CENTER_ITEMS = [
    'เซอร์กิตเบรกเกอร์เมน  ขนาด100 A    ',
    'เซอร์กิตเบรกเกอร์ย่อยชนิดกันดูด (ELCB) 20 A ',
    'เซอร์กิตเบรกเกอร์ย่อย (CB) ขนาด 16 A ',
    'เซอร์กิตเบรกเกอร์ย่อย (CB) ขนาด 20 A ',
    'ตู้ Consumer Unit ชนาด 18 ช่อง',
    'แท่งกราวด์ทองแดง 5/8" ยาว 2.40 ม. ',
    'สายไฟกราวด์ THW 10 ตร.มม.',
    'สายเมนไฟฟ้า THW ขนาด 25 ตร.มม.',
] as const;

/** D5:D19 dropdown. */
export const LOAD_CENTER_UNITS = ['ชุด', 'ตัว', 'ท่อน', 'ม.'] as const;

const [MAIN_CB, ELCB20, CB16, CB20, CONSUMER_UNIT, GROUND_ROD, GROUND_CABLE, MAIN_CABLE] = LOAD_CENTER_ITEMS;

/** Unit (BOQ F) and prices (BOQ I / K) typed in Excel BOQ rows 256–263. Every dropdown option is priced. */
export const LOAD_CENTER_CATALOGUE: Catalogue = {
    [CONSUMER_UNIT]: { unit: 'ชุด', mat: 3000, lab: 3000 },   // R256
    [MAIN_CB]: { unit: 'ตัว', mat: 1500, lab: 0 },             // R257
    [CB16]: { unit: 'ตัว', mat: 120, lab: 0 },                 // R258
    [CB20]: { unit: 'ตัว', mat: 140, lab: 0 },                 // R259
    [ELCB20]: { unit: 'ตัว', mat: 1200, lab: 0 },              // R260
    [MAIN_CABLE]: { unit: 'ม.', mat: 200, lab: 100 },          // R261
    [GROUND_ROD]: { unit: 'ท่อน', mat: 500, lab: 300 },        // R262
    [GROUND_CABLE]: { unit: 'ม.', mat: 70, lab: 30 },          // R263
};

export const loadCenter = defineCalculator<LoadCenterInput>({
    id: 'load-center',
    sheetName: 'ตู้ควบคุม_Load Center',
    title: 'โปรแกรมถอดแบบ – งานตู้ควบคุมระบบไฟฟ้า Load Center',
    titleEn: 'Load Center',
    sections: [26],
    deps: [],
    // A real project starts with an empty list: every item is counted off the plan.
    blank: () => ({ items: [] }),
    // Excel rows 5–12, verbatim (rows 13–19 are blank; rows can be added, D5).
    defaults: () => ({
        items: [
            pickRow(CONSUMER_UNIT, 1, 'ชุด'),
            pickRow(MAIN_CB, 1, 'ตัว'),
            pickRow(CB16, 2, 'ตัว'),
            pickRow(CB20, 8, 'ตัว'),
            pickRow(ELCB20, 4, 'ตัว'),
            pickRow(MAIN_CABLE, 50, 'ม.'),
            pickRow(GROUND_ROD, 1, 'ท่อน'),
            pickRow(GROUND_CABLE, 5, 'ม.'),
        ],
    }),
    compute: (input, _ctx, tr = NO_TRACE) => {
        const out = computePickList(input.items, LOAD_CENTER_CATALOGUE);
        if (tr.enabled) tracePickList(input, tr, out);
        return out;
    },
    traceLabels: LOAD_CENTER_TRACE_LABELS,
    boqLinks: [],
    boqSlots: input => ({ items: pickListSlotRows(input.items, LOAD_CENTER_CATALOGUE) }),
});

/** Dev mode: records the steps of the compute above (observes values already computed; changes nothing). */
function tracePickList(input: PickListInput, tr: Tracer, out: Record<string, number>): void {
    const mats: number[] = [], labs: number[] = [], totals: number[] = [];
    for (const { row, index } of boqRows(input.items)) {
        const c = pickRowCalc(row, LOAD_CENTER_CATALOGUE);
        const qty = Number.isFinite(row.qty) ? row.qty : 0;
        tr.row(index, matchKey(row.item), () => {
            // A price that is not typed on the row comes from the hard-coded price list.
            if (row.mat === null && c.known) tr.constant('catalogueMat', c.mat, { params: { item: matchKey(row.item) } });
            if (row.lab === null && c.known) tr.constant('catalogueLab', c.lab, { params: { item: matchKey(row.item) } });
            tr.step('matTotal', c.matTotal, { unitMat: c.mat, qty });
            tr.step('labTotal', c.labTotal, { unitLab: c.lab, qty });
            tr.step('rowTotal', c.total, { unitMat: c.mat, unitLab: c.lab, qty });
        });
        mats.push(c.matTotal); labs.push(c.labTotal); totals.push(c.total);
    }
    tr.step('rows', out.rows ?? 0, {});
    tr.step('totalMat', out.mat ?? 0, { matTotal: mats });
    tr.step('totalLab', out.lab ?? 0, { labTotal: labs });
    tr.step('total', out.total ?? 0, { rowTotal: totals });
}
