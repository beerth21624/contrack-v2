// Sheet "อุปกรณ์ไฟฟ้า_Equipment " (Excel v5 sheet 11; the sheet name has a trailing space) — pick-list of
// lights, sockets and switches → BOQ section 26 งานติดตั้งอุปกรณ์ไฟฟ้า, group "อุปกรณ์ไฟฟ้า" (slot `items`,
// Excel rows 265–270). Same model as the load-center sheet (shared core ../shared/pick-list).
// Spec: docs/excel-spec/05-mep-sanitary-misc.md §7.
import { defineCalculator } from '../types';
import {
    boqRows, computePickList, matchKey, pickListSlotRows, pickRow, pickRowCalc, type Catalogue, type PickListInput,
} from '../shared/pick-list';
import { NO_TRACE, type Tracer } from '../../trace/tracer';
import { ELECTRICAL_EQUIPMENT_TRACE_LABELS } from './trace.labels';

export type ElectricalEquipmentInput = PickListInput;

/** B5:B18 dropdown, verbatim and in Excel's list order. */
export const EQUIPMENT_ITEMS = [
    'โคมไฟซาลาเปา',
    'โคมไฟดาวน์ไลท์',
    'โคมไฟฟลูออเรสเซนต์ ชนิดกันน้ำ',
    'เต้ารับไฟฟ้าคู่ชนิดมีกราวน์ ชนิดกันน้ำ (พร้อมหน้ากาก)',
    'เต้ารับไฟฟ้าคู่ชนิดมีกราวน์ (พร้อมหน้ากาก)',
    'สวิตซ์ทางเดียว (พร้อมหน้ากาก)',
] as const;

/** D5:D18 dropdown. */
export const EQUIPMENT_UNITS = ['ชุด', 'ตัว'] as const;

const [CEILING_LAMP, DOWNLIGHT, FLUORESCENT_WP, SOCKET_WP, SOCKET, SWITCH] = EQUIPMENT_ITEMS;

/** Unit (BOQ F) and prices (BOQ I / K) typed in Excel BOQ rows 265–270. Every dropdown option is priced. */
export const EQUIPMENT_CATALOGUE: Catalogue = {
    [DOWNLIGHT]: { unit: 'ชุด', mat: 150, lab: 120 },        // R265
    [CEILING_LAMP]: { unit: 'ชุด', mat: 300, lab: 200 },     // R266
    [FLUORESCENT_WP]: { unit: 'ชุด', mat: 250, lab: 200 },   // R267
    [SWITCH]: { unit: 'ตัว', mat: 80, lab: 80 },             // R268
    [SOCKET]: { unit: 'ตัว', mat: 140, lab: 100 },           // R269
    [SOCKET_WP]: { unit: 'ตัว', mat: 300, lab: 150 },        // R270
};

export const electricalEquipment = defineCalculator<ElectricalEquipmentInput>({
    id: 'electrical-equipment',
    sheetName: 'อุปกรณ์ไฟฟ้า_Equipment ',
    title: 'โปรแกรมถอดแบบ – งานอุปกรณ์ไฟฟ้า Electrical Equipment',
    titleEn: 'Electrical Equipment',
    sections: [26],
    deps: [],
    // A real project starts with an empty list: every item is counted off the plan.
    blank: () => ({ items: [] }),
    // Excel rows 5–10 (rows 11–18 are blank; rows can be added, D5).
    defaults: () => ({
        items: [
            pickRow(DOWNLIGHT, 25, 'ชุด'),
            pickRow(CEILING_LAMP, 5, 'ชุด'),
            pickRow(FLUORESCENT_WP, 1, 'ชุด'),
            pickRow(SWITCH, 18, 'ตัว'),
            pickRow(SOCKET, 17, 'ตัว'),
            pickRow(SOCKET_WP, 2, 'ตัว'),
        ],
    }),
    compute: (input, _ctx, tr = NO_TRACE) => {
        const out = computePickList(input.items, EQUIPMENT_CATALOGUE);
        if (tr.enabled) tracePickList(input, tr, out);
        return out;
    },
    traceLabels: ELECTRICAL_EQUIPMENT_TRACE_LABELS,
    boqLinks: [],
    boqSlots: input => ({ items: pickListSlotRows(input.items, EQUIPMENT_CATALOGUE) }),
});

/** Dev mode: records the steps of the compute above (observes values already computed; changes nothing). */
function tracePickList(input: PickListInput, tr: Tracer, out: Record<string, number>): void {
    const mats: number[] = [], labs: number[] = [], totals: number[] = [];
    for (const { row, index } of boqRows(input.items)) {
        const c = pickRowCalc(row, EQUIPMENT_CATALOGUE);
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
