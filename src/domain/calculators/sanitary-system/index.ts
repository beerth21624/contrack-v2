// Sheet "ระบบสุขาภิบาล_Sanitary System" (Excel v5 sheet 07) → BOQ (Home) section 27 งานระบบสุขาภิบาล,
// slot `items` (Excel rows 273–276). Decision D6: this one section replaces the app's old
// สุขาภิบาลภายใน / สุขาภิบาลภายนอก steps. Shared core: ../shared/pick-list.
// Spec: docs/excel-spec/05-mep-sanitary-misc.md §3.
import { defineCalculator } from '../types';
import {
    computePickList, pickListSlotRows, pickRow, type Catalogue, type PickListInput,
} from '../shared/pick-list';

export type SanitarySystemInput = PickListInput;

/** B5:B19 dropdown, verbatim, Excel list order (typos สาเร็จรูป / ระบายน้า, trailing spaces and the curly ” kept). */
export const SANITARY_SYSTEM_ITEMS = [
    'ถังดักไขมัน ขนาด 20 ลิตร',
    'ถังบำบัดน้ำเสียสาเร็จรูป ขนาด 600 ลิตร ',
    'ท่อระบายน้า AC Dia.8”',
    'บ่อพักน้ำทิ้งสำเร็จรูป ขนาด 40 x 40 ซม. ',
] as const;

/** D5:D19 dropdown. */
export const SANITARY_SYSTEM_UNITS = ['ชุด', 'ม.'] as const;

const [GREASE_TRAP, SEPTIC_TANK, AC_PIPE, CHAMBER] = SANITARY_SYSTEM_ITEMS;

/** BOQ N274:N276 (row 273, the grease trap, has no note). */
const SMALL_EXCAVATOR = 'รถแมคโครเล็ก';

/** Excel BOQ rows 273–276: F unit, I material, K labour, N note. Every dropdown option is priced. */
export const SANITARY_SYSTEM_CATALOGUE: Catalogue = {
    [GREASE_TRAP]: { unit: 'ชุด', mat: 1500, lab: 300 },                         // R273
    [SEPTIC_TANK]: { unit: 'ชุด', mat: 7000, lab: 3000, note: SMALL_EXCAVATOR },  // R274
    [CHAMBER]: { unit: 'ชุด', mat: 300, lab: 200, note: SMALL_EXCAVATOR },        // R275
    [AC_PIPE]: { unit: 'ม.', mat: 200, lab: 150, note: SMALL_EXCAVATOR },         // R276
};

export const sanitarySystem = defineCalculator<SanitarySystemInput>({
    id: 'sanitary-system',
    sheetName: 'ระบบสุขาภิบาล_Sanitary System',
    title: 'โปรแกรมถอดแบบ – อุปกรณ์ระบบระบายน้ำทิ้ง Waste System',
    titleEn: 'Waste System',
    sections: [27],
    deps: [],
    // Excel rows 5–8, verbatim (rows 9–19 blank; rows can be added, D5).
    defaults: () => ({
        items: [
            pickRow(GREASE_TRAP, 1, 'ชุด'),
            pickRow(SEPTIC_TANK, 2, 'ชุด'),
            pickRow(CHAMBER, 6, 'ชุด'),
            pickRow(AC_PIPE, 36, 'ม.'),
        ],
    }),
    // A new project lists nothing yet (items come from the plan); prices stay in the catalogue.
    blank: () => ({ items: [] }),
    compute: input => computePickList(input.items, SANITARY_SYSTEM_CATALOGUE),
    boqLinks: [],
    boqSlots: input => ({ items: pickListSlotRows(input.items, SANITARY_SYSTEM_CATALOGUE) }),
});
