// Sheet "เบ็ดเตล็ด_Other" (Excel v5 sheet 20) → BOQ (Home) section 28 งานเบ็ดเตล็ด, slot `items` (Excel row 279).
// Excel's dropdown has a single option; the sheet is the "anything else" list, so rows may also hold
// free-text items with their own unit and prices (spec 05 D13; review deck p117–119). Shared core: ../shared/pick-list.
// Spec: docs/excel-spec/05-mep-sanitary-misc.md §8.
import { NO_TRACE, type Tracer } from '../../trace/tracer';
import { defineCalculator } from '../types';
import {
    boqRows, computePickList, pickListSlotRows, pickRow, pickRowCalc, type Catalogue, type PickRow, type PickListInput,
} from '../shared/pick-list';
import { MISC_TRACE_LABELS } from './trace.labels';

export type MiscInput = PickListInput;

/** B5:B18 dropdown (the only option). Free text is allowed as well. */
export const MISC_ITEMS = ['ราวกันตกกระจก เฉลียง 1 และ 2'] as const;

/** D5:D18 dropdown (the only option). Free-text items may type any unit. */
export const MISC_UNITS = ['ม.'] as const;

const [GLASS_RAILING] = MISC_ITEMS;

/** Excel BOQ row 279: F ม., I 4,000, K 0 (no note). */
export const MISC_CATALOGUE: Catalogue = {
    [GLASS_RAILING]: { unit: 'ม.', mat: 4000, lab: 0 },   // R279
};

const finite = (v: number) => (Number.isFinite(v) ? v : 0);

/** Records the per-row and total sums of computePickList (observes only; the sums themselves are not recomputed here). */
function traceMisc(items: PickRow[], tr: Tracer, out: Record<string, number>): void {
    const listed = boqRows(items);
    const per = listed.map(({ row, index }) => {
        const c = pickRowCalc(row, MISC_CATALOGUE);
        const qty = finite(row.qty);
        tr.row(index, row.item.trim() || `#${index + 1}`, () => {
            // A price left empty on the row comes from the hard-coded price list (0 for a free-text item).
            if (row.mat === null) tr.constant('catalogueMat', c.mat);
            if (row.lab === null) tr.constant('catalogueLab', c.lab);
            tr.step('matTotal', c.matTotal, { mat: c.mat, qty });
            tr.step('labTotal', c.labTotal, { lab: c.lab, qty });
            tr.step('rowTotal', c.total, { mat: c.mat, lab: c.lab, qty });
        });
        return c;
    });
    tr.step('rows', out.rows ?? 0, {});
    tr.step('mat', out.mat ?? 0, { matTotal: per.map(c => c.matTotal) });
    tr.step('lab', out.lab ?? 0, { labTotal: per.map(c => c.labTotal) });
    tr.step('total', out.total ?? 0, { rowTotal: per.map(c => c.total) });
}

export const misc = defineCalculator<MiscInput>({
    id: 'misc',
    sheetName: 'เบ็ดเตล็ด_Other',
    title: 'โปรแกรมถอดแบบ – งานเบ็ดเตล็ด Other',
    titleEn: 'Other',
    sections: [28],
    deps: [],
    // A real project starts with an empty list: every item is counted off the plan.
    blank: () => ({ items: [] }),
    // Excel row 5 (rows 6–18 blank; rows can be added, D5).
    defaults: () => ({
        items: [pickRow(GLASS_RAILING, 7.1, 'ม.')],
    }),
    compute: (input, _ctx, tr = NO_TRACE) => {
        const out = computePickList(input.items, MISC_CATALOGUE);
        if (tr.enabled) traceMisc(input.items, tr, out);
        return out;
    },
    traceLabels: MISC_TRACE_LABELS,
    boqLinks: [],
    boqSlots: input => ({ items: pickListSlotRows(input.items, MISC_CATALOGUE) }),
});
