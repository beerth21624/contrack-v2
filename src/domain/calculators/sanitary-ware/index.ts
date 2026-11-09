// Sheet "สุขภัณฑ์_Sanitary" (Excel v5 sheet 21) → BOQ (Home) section 29 งานสุขภัณฑ์, slot `items` (Excel rows 282–291).
// Shared core: ../shared/pick-list. Spec: docs/excel-spec/05-mep-sanitary-misc.md §9.
import { NO_TRACE, type Tracer } from '../../trace/tracer';
import { defineCalculator } from '../types';
import { SANITARY_WARE_TRACE_LABELS } from './trace.labels';
import {
    boqRows, computePickList, matchKey, pickListSlotRows, pickRow, pickRowCalc, type Catalogue, type PickListInput, type PickRow,
} from '../shared/pick-list';

export type SanitaryWareInput = PickListInput;

/** B5:B19 dropdown, verbatim, Excel list order (trailing spaces of ตะแกรงกันกลิ่น / ที่ใส่กระดาษชำระ / ราวแขวนผ้า / อ่างล้างหน้า kept). */
export const SANITARY_WARE_ITEMS = [
    'กระจกเงา',
    'ก๊อกเดี่ยวอ่างล้างหน้า',
    'ชักโครกนั่งราบ',
    'ตะแกรงกันกลิ่น ',
    'ที่ใส่กระดาษชำระ ',
    'ที่ใส่สบู่',
    'ฝักบัวอาบน้ำ',
    'ราวแขวนผ้า ',
    'สายชำระ',
    'อ่างล้างหน้า ',
] as const;

/** D5:D19 dropdown (the only option). */
export const SANITARY_WARE_UNITS = ['ชุด'] as const;

const [MIRROR, BASIN_TAP, TOILET, FLOOR_DRAIN, PAPER_HOLDER, SOAP_DISH, SHOWER, TOWEL_RAIL, BIDET_SPRAY, BASIN] =
    SANITARY_WARE_ITEMS;
const SET = 'ชุด';

/** Excel BOQ rows 282–291 (F ชุด, I, K; no notes). Every dropdown option is priced. */
export const SANITARY_WARE_CATALOGUE: Catalogue = {
    [TOILET]: { unit: SET, mat: 5000, lab: 800 },        // R282
    [BIDET_SPRAY]: { unit: SET, mat: 500, lab: 100 },    // R283
    [BASIN]: { unit: SET, mat: 3500, lab: 500 },         // R284
    [BASIN_TAP]: { unit: SET, mat: 800, lab: 70 },       // R285
    [MIRROR]: { unit: SET, mat: 1000, lab: 100 },        // R286
    [PAPER_HOLDER]: { unit: SET, mat: 350, lab: 70 },    // R287
    [TOWEL_RAIL]: { unit: SET, mat: 800, lab: 70 },      // R288
    [FLOOR_DRAIN]: { unit: SET, mat: 300, lab: 100 },    // R289
    [SOAP_DISH]: { unit: SET, mat: 500, lab: 100 },      // R290
    [SHOWER]: { unit: SET, mat: 1000, lab: 100 },        // R291
};

/**
 * Fittings of one bathroom, in BOQ order (the Excel sample is 2 bathrooms: 2 of each, 3 floor drains).
 * Guided journey helper: the user counts bathrooms on the plan, then corrects single items.
 */
export const BATHROOM_SET = [
    TOILET, BIDET_SPRAY, BASIN, BASIN_TAP, MIRROR, PAPER_HOLDER, TOWEL_RAIL, FLOOR_DRAIN, SOAP_DISH, SHOWER,
] as const;

/** Adds one bathroom: +1 on the first row of each set item (any spacing), or a new catalogue-priced row. */
export function addBathroomSet(items: PickRow[]): PickRow[] {
    let next = items;
    for (const item of BATHROOM_SET) {
        const i = next.findIndex(r => matchKey(r.item) === matchKey(item));
        next = i >= 0
            ? next.map((r, j) => (j === i ? { ...r, qty: (Number.isFinite(r.qty) ? r.qty : 0) + 1 } : r))
            : [...next, pickRow(item, 1, SET)];
    }
    return next;
}

export const sanitaryWare = defineCalculator<SanitaryWareInput>({
    id: 'sanitary-ware',
    sheetName: 'สุขภัณฑ์_Sanitary',
    title: 'โปรแกรมถอดแบบ – งานสุขภัณฑ์ Sanitary',
    titleEn: 'Sanitary',
    sections: [29],
    deps: [],
    // Excel rows 5–14, verbatim (rows 15–19 blank; rows can be added, D5).
    defaults: () => ({
        items: [
            pickRow(TOILET, 2, SET),
            pickRow(BIDET_SPRAY, 2, SET),
            pickRow(BASIN, 2, SET),
            pickRow(BASIN_TAP, 2, SET),
            pickRow(MIRROR, 2, SET),
            pickRow(PAPER_HOLDER, 2, SET),
            pickRow(TOWEL_RAIL, 2, SET),
            pickRow(FLOOR_DRAIN, 3, SET),
            pickRow(SOAP_DISH, 2, SET),
            pickRow(SHOWER, 2, SET),
        ],
    }),
    // A new project lists nothing yet (items are counted from the plan); prices stay in the catalogue.
    blank: () => ({ items: [] }),
    compute: (input, _ctx, tr = NO_TRACE) => {
        const out = computePickList(input.items, SANITARY_WARE_CATALOGUE);
        if (tr.enabled) tracePickList(input, tr, out);
        return out;
    },
    traceLabels: SANITARY_WARE_TRACE_LABELS,
    boqLinks: [],
    boqSlots: input => ({ items: pickListSlotRows(input.items, SANITARY_WARE_CATALOGUE) }),
});

/** Dev mode: records the steps of the compute above (observes values already computed; changes nothing). */
function tracePickList(input: PickListInput, tr: Tracer, out: Record<string, number>): void {
    const mats: number[] = [], labs: number[] = [], totals: number[] = [];
    for (const { row, index } of boqRows(input.items)) {
        const c = pickRowCalc(row, SANITARY_WARE_CATALOGUE);
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
