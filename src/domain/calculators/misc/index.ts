// Sheet "เบ็ดเตล็ด_Other" (Excel v5 sheet 20) → BOQ (Home) section 28 งานเบ็ดเตล็ด, slot `items` (Excel row 279).
// Excel's dropdown has a single option; the sheet is the "anything else" list, so rows may also hold
// free-text items with their own unit and prices (spec 05 D13; review deck p117–119). Shared core: ../shared/pick-list.
// Spec: docs/excel-spec/05-mep-sanitary-misc.md §8.
import { defineCalculator } from '../types';
import {
    computePickList, pickListSlotRows, pickRow, type Catalogue, type PickListInput,
} from '../shared/pick-list';

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
    compute: input => computePickList(input.items, MISC_CATALOGUE),
    boqLinks: [],
    boqSlots: input => ({ items: pickListSlotRows(input.items, MISC_CATALOGUE) }),
});
