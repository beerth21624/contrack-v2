// Oracle-test helpers for the Excel "pick-list" sheets — TEST ONLY. See docs/rebuild/ORACLE_TESTS.md.
// Sheets 07 ระบบสุขาภิบาล_Sanitary System, 10 ตู้ควบคุม_Load Center, 11 อุปกรณ์ไฟฟ้า_Equipment, 20 เบ็ดเตล็ด_Other and
// 21 สุขภัณฑ์_Sanitary: B รายการ / C จำนวน / D หน่วย, no formulas. The Excel BOQ reads the first `boqRows` sheet rows
// by position (D = B<n>, E = C<n>, H = E·(1+G), J = I·H, L = K·E) with unit / prices typed in the BOQ row.
//
// The app (shared core src/domain/calculators/shared/pick-list.ts, design D5 / spec 05 D2):
//  - one BOQ slot row per list row with an item and qty > 0, in list order (empty / qty-0 rows give none);
//  - unlimited rows (Excel's rows past the wired BOQ rows never reach its BOQ);
//  - the price follows the item (Excel keeps the price typed for the sample item at that position);
//  - a row may type its own unit / material / labour price.
//
// How the test drives Excel: the list goes to B/C/D of the sheet; a price typed in a list row goes to the
// Excel input it replaces (BOQ I / K of the row at that position). Excel's price of an item is the price typed in
// the BOQ row the sample places it in (`excelCatalogue`). Wherever the app's price equals the Excel row's price the
// row is compared exactly (E, H, J, L, M); elsewhere the D5 delta is asserted: J_app − J_x = E · (price − I_x).
import { expect } from 'vitest';
import type { BoqItemRow, BoqResult, BoqSectionResult } from '../domain/boq/types';
import type { Catalogue, PickListInput, PickRow } from '../domain/calculators/shared/pick-list';
import { computeProject, createProject, type ProjectResult } from '../domain/project';
import { closeTo, type ExcelOracle, type OracleInput } from './excel-oracle';
import { expectBoqRow, expectClose, seededRandom } from './oracle-helpers';

const BOQ = 'BOQ (Home)';

/** One pick-list sheet and the BOQ (Home) rows wired to it. */
export interface PickListSheet {
    calc: string;
    /** Calculator sheet name (verbatim, trailing spaces included). */
    sheet: string;
    /** First list row (B/C/D) of the sheet. */
    firstRow: number;
    /** List rows of the sheet (Excel's limit; the app has none — D5). */
    capacity: number;
    /** First BOQ (Home) row reading the list (D = B firstRow, E = C firstRow). */
    boqFirstRow: number;
    /** BOQ rows wired to list rows firstRow… (positional link). */
    boqRows: number;
    section: number;
    /** BOQ `รวม >>` row of the section (J/L/M = SUM of the section's rows; another sheet's rows stay at the sample). */
    subtotalRow: number;
    /** B dropdown (verbatim). */
    options: readonly string[];
    /** D dropdown. */
    units: readonly string[];
    /** The app catalogue (only used to generate plausible units; prices are checked against Excel). */
    catalogue: Catalogue;
    sample: PickListInput;
    /** Free-text items for the random / named cases. */
    freeText: readonly string[];
}

/** Item text as the decision matches it against the catalogue (any spacing — spec 05 D10). */
const norm = (s: string) => s.trim().replace(/\s+/g, ' ');
const num = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

const listRef = (s: PickListSheet, col: string, i: number) => `${s.sheet}!${col}${s.firstRow + i}`;
const boqRef = (s: PickListSheet, col: string, i: number) => `${BOQ}!${col}${s.boqFirstRow + i}`;

/** The cells a user would type in Excel for this list (unused rows cleared; typed prices → BOQ I / K). */
export function pickListExcelInputs(s: PickListSheet, input: PickListInput): Record<string, OracleInput> {
    if (input.items.length > s.capacity) throw new Error(`${s.sheet} has ${s.capacity} list rows`);
    const out: Record<string, OracleInput> = {};
    for (let i = 0; i < s.capacity; i++) {
        const row = input.items[i];
        out[listRef(s, 'B', i)] = row && row.item.trim() !== '' ? row.item : null;
        out[listRef(s, 'C', i)] = row ? row.qty : null;
        out[listRef(s, 'D', i)] = row && row.unit.trim() !== '' ? row.unit : null;
        if (i < s.boqRows) {
            // A price typed in the list row is the Excel BOQ I / K input of the row at that position.
            if (row?.mat !== null && row?.mat !== undefined) out[boqRef(s, 'I', i)] = row.mat;
            if (row?.lab !== null && row?.lab !== undefined) out[boqRef(s, 'K', i)] = row.lab;
        }
    }
    return out;
}

export interface ExcelPrice { unit: string; mat: number; lab: number; note?: string }

/** Excel's price of each item: unit F, prices I / K and note N typed in the BOQ row the sample places it in. */
export function excelCatalogue(oracle: ExcelOracle, s: PickListSheet): Map<string, ExcelPrice> {
    const out = new Map<string, ExcelPrice>();
    const text = (ref: string) => { const v = oracle.cached(ref); return typeof v === 'string' ? v.trim() : ''; };
    const number = (ref: string) => { const v = oracle.cached(ref); return typeof v === 'number' ? v : 0; };
    for (let j = 0; j < s.boqRows; j++) {
        const item = norm(text(listRef(s, 'B', j)));
        if (item === '' || out.has(item)) continue;
        const note = text(boqRef(s, 'N', j));
        out.set(item, {
            unit: text(boqRef(s, 'F', j)), mat: number(boqRef(s, 'I', j)), lab: number(boqRef(s, 'K', j)),
            ...(note ? { note } : {}),
        });
    }
    return out;
}

/** The app catalogue holds, for every dropdown option, the unit / prices / note Excel types for it in the BOQ. */
export function expectCatalogueMatchesExcel(oracle: ExcelOracle, s: PickListSheet): void {
    const excel = excelCatalogue(oracle, s);
    expect([...excel.keys()].sort(), 'every option is priced in Excel').toEqual(s.options.map(norm).sort());
    const app = new Map(Object.entries(s.catalogue).map(([k, c]) => [norm(k), { unit: c.unit, mat: c.mat, lab: c.lab, ...(c.note ? { note: c.note } : {}) }]));
    expect(Object.fromEntries(app)).toEqual(Object.fromEntries(excel));
}

/** The price the app must use for a row (design D5): typed, else Excel's price of the item, else 0. */
export function expectedPrice(row: PickRow, catalogue: Map<string, ExcelPrice>): ExcelPrice {
    const c = catalogue.get(norm(row.item));
    return {
        unit: row.unit.trim() || (c?.unit ?? ''),
        mat: row.mat ?? c?.mat ?? 0,
        lab: row.lab ?? c?.lab ?? 0,
        ...(c?.note ? { note: c.note } : {}),
    };
}

/** List rows that reach the app BOQ: an item and qty > 0 (pick-list.ts `boqRows`). */
export const listedRows = (input: PickListInput) =>
    input.items.map((row, index) => ({ row, index })).filter(x => norm(x.row.item) !== '' && num(x.row.qty) > 0);

export function pickListAppResult(s: PickListSheet, input: PickListInput): ProjectResult {
    const p = createProject();
    p.calculators[s.calc] = input;
    return computeProject(p);
}

export const sectionOf = (boq: BoqResult, no: number): BoqSectionResult | undefined => boq.sections.find(x => x.no === no);

/** The app's slot rows of this sheet, in BOQ order. */
export const slotRowsOf = (s: PickListSheet, boq: BoqResult): BoqItemRow[] =>
    (sectionOf(boq, s.section)?.rows ?? []).filter((r): r is BoqItemRow => r.type === 'item' && r.key.startsWith(`${s.calc}:items:`));

/** Every Excel cell the comparison reads (for the liveness check). */
export const pickListComparedRefs = (s: PickListSheet): string[] => [
    ...Array.from({ length: s.boqRows }, (_, i) => ['D', 'E', 'H', 'J', 'L', 'M'].map(c => boqRef(s, c, i))).flat(),
    ...['J', 'L', 'M'].map(c => `${BOQ}!${c}${s.subtotalRow}`),
];

/**
 * Compares one input set: every output of compute(), every slot row, the Excel BOQ rows of the sheet and the
 * section subtotal. Exact where the decisions do not apply; the D5 delta otherwise (see the header).
 */
export function checkPickListCase(oracle: ExcelOracle, s: PickListSheet, input: PickListInput): void {
    oracle.replaceInputs(pickListExcelInputs(s, input));
    const res = pickListAppResult(s, input);
    const out = res.calcOutputs[s.calc] ?? {};
    const catalogue = excelCatalogue(oracle, s);
    const app = slotRowsOf(s, res.boq);
    const listed = listedRows(input);
    const n = (ref: string) => oracle.num(ref);

    // 1. one app row per listed row, in list order, numbered 1), 2), …
    expect(app.map(r => r.desc), 'slot rows = listed rows').toEqual(listed.map(x => x.row.item.trim()));
    let dJ = 0;
    let dL = 0;
    listed.forEach(({ row, index }, k) => {
        const a = app[k];
        if (!a) return;
        const label = `list row ${index} (${row.item.trim()})`;
        const p = expectedPrice(row, catalogue);
        expect(a.itemNo, label).toBe(`${k + 1})`);
        expect(a.unit, `${label} unit`).toBe(p.unit);
        expect(a.note, `${label} note`).toBe(p.note);
        expectClose(a.matUnit, p.mat, `${label} I`);
        expectClose(a.labUnit, p.lab, `${label} K`);
        if (index < s.boqRows) {
            const er = s.boqFirstRow + index;
            const e = n(boqRef(s, 'E', index));
            const i = n(boqRef(s, 'I', index));
            const kk = n(boqRef(s, 'K', index));
            expectClose(a.qty, e, `${label} E${er}`);
            if (closeTo(i, p.mat) && closeTo(kk, p.lab)) {
                expectBoqRow(oracle, res.boq, a.key, er, label);
            } else {
                // D5 (spec 05 D2): the app prices the row by its item; Excel keeps the price typed for the sample
                // item at this position. Same E and H (waste 0), J / L differ by E × (price − Excel price).
                expectClose(a.grossQty ?? NaN, n(boqRef(s, 'H', index)), `${label} H${er}`);
                expectClose(a.matTotal - n(boqRef(s, 'J', index)), e * (p.mat - i), `${label} J${er} − price delta`);
                expectClose(a.labTotal - n(boqRef(s, 'L', index)), e * (p.lab - kk), `${label} L${er} − price delta`);
                dJ += e * (p.mat - i);
                dL += e * (p.lab - kk);
            }
        } else {
            // D5: Excel's BOQ reads only the first boqRows list rows; this row reaches the app's BOQ only.
            expectClose(a.qty, row.qty, `${label} qty`);
            expectClose(a.matTotal, row.qty * p.mat, `${label} J`);
            expectClose(a.labTotal, row.qty * p.lab, `${label} L`);
            dJ += row.qty * p.mat;
            dL += row.qty * p.lab;
        }
    });

    // 2. Excel's wired BOQ rows: D = B, E = C (positional link); rows with no app row
    for (let i = 0; i < s.boqRows; i++) {
        const row = input.items[i];
        const d = oracle.get(boqRef(s, 'D', i));
        expect(d ?? '', `D${s.boqFirstRow + i} = B${s.firstRow + i}`).toBe(row?.item.trim() ?? '');
        expectClose(n(boqRef(s, 'E', i)), num(row?.qty), `E${s.boqFirstRow + i} = C${s.firstRow + i}`);
        if (listed.some(x => x.index === i)) continue;
        if (num(row?.qty) === 0) {
            expect(n(boqRef(s, 'M', i)), `M${s.boqFirstRow + i} (qty 0)`).toBe(0);
        } else {
            // pick-list.ts boqRows: a row needs an item to reach the BOQ; Excel charges the blank row at the price
            // typed for the sample item at this position.
            dJ -= n(boqRef(s, 'J', i));
            dL -= n(boqRef(s, 'L', i));
        }
    }

    // 3. every output of compute() (unmapped keys fail)
    const range = (col: string) => `=SUM('${BOQ}'!${col}${s.boqFirstRow}:${col}${s.boqFirstRow + s.boqRows - 1})`;
    const sum = (col: string) => { const v = oracle.evaluate(range(col)); return typeof v === 'number' ? v : NaN; };
    const expected: Record<string, number> = {
        rows: listed.length, mat: sum('J') + dJ, lab: sum('L') + dL, total: sum('M') + dJ + dL,
    };
    for (const [key, v] of Object.entries(out)) {
        const e = expected[key];
        if (e === undefined) expect.fail(`output ${key} has no Excel mapping`);
        else expectClose(v, e, `output ${key}`);
    }
    expect(Object.keys(out).sort()).toEqual(Object.keys(expected).sort());

    // 4. section subtotal (J/L/M of the `รวม >>` row) = app section, up to the D5 deltas of this sheet's rows
    const sec = sectionOf(res.boq, s.section);
    expectClose((sec?.matTotal ?? NaN) - n(`${BOQ}!J${s.subtotalRow}`), dJ, `section ${s.section} J${s.subtotalRow} − D5 delta`);
    expectClose((sec?.labTotal ?? NaN) - n(`${BOQ}!L${s.subtotalRow}`), dL, `section ${s.section} L${s.subtotalRow} − D5 delta`);
    expectClose((sec?.total ?? NaN) - n(`${BOQ}!M${s.subtotalRow}`), dJ + dL, `section ${s.section} M${s.subtotalRow} − D5 delta`);
}

// ─── Inputs ─────────────────────────────────────────────────────────────────

const row = (item: string, qty: number, unit: string, mat: number | null = null, lab: number | null = null): PickRow =>
    ({ item, qty, unit, mat, lab });

const catalogueUnit = (s: PickListSheet, item: string) =>
    Object.entries(s.catalogue).find(([k]) => norm(k) === norm(item))?.[1].unit ?? '';

/** A random but plausible list: sample-like or picked from the dropdown, with duplicates, free text and typed prices. */
export function randomPickList(s: PickListSheet, seed: number): PickListInput {
    const rng = seededRandom(seed);
    const n = rng.chance(0.12) ? s.capacity : rng.chance(0.06) ? 0 : rng.int(1, s.capacity);
    const base = rng.chance(0.4) ? s.sample.items : [];
    const items: PickRow[] = [];
    for (let i = 0; i < n; i++) {
        const fromSample = base[i];
        let item: string;
        const r = rng.next();
        if (fromSample && rng.chance(0.7)) item = fromSample.item;
        else if (r < 0.7) item = rng.pick(s.options);
        else if (r < 0.82) item = rng.pick(s.freeText);
        else if (r < 0.88) item = '';
        else item = items.length ? rng.pick(items).item : rng.pick(s.options);
        // stray spaces (the dropdown options carry some): the catalogue matches any spacing
        if (item !== '' && rng.chance(0.1)) item = rng.chance(0.5) ? `${item.trim()} ` : item.trim();
        const free = norm(item) !== '' && !s.options.some(o => norm(o) === norm(item));
        const qty = rng.chance(0.08) ? 0 : rng.chance(0.3) ? rng.step(0.5, 60, 0.1) : rng.int(1, 30);
        const u = rng.next();
        const unit = u < 0.55 ? catalogueUnit(s, item) : u < 0.8 ? '' : rng.pick(s.units);
        const mat = rng.chance(free ? 0.5 : 0.12) ? rng.step(10, 6000, 10) : null;
        const lab = rng.chance(free ? 0.4 : 0.12) ? rng.step(0, 2000, 10) : null;
        items.push(row(item, qty, unit, mat, lab));
    }
    return { items };
}

export function randomPickListCases(s: PickListSheet, base: number, count = 50): [string, PickListInput][] {
    return Array.from({ length: count }, (_, k): [string, PickListInput] => [`random #${k} (seed ${base + k})`, randomPickList(s, base + k)]);
}

/** Named edge cases shared by every pick-list sheet. */
export function namedPickListCases(s: PickListSheet): [string, PickListInput][] {
    const sample = s.sample.items;
    const first = sample[0] ?? row(s.options[0] ?? '', 1, '');
    const freeA = s.freeText[0] ?? 'รายการพิเศษ';
    const freeB = s.freeText[1] ?? 'รายการพิเศษ 2';
    const fill = (n: number) => Array.from({ length: n }, (_, i) => {
        const item = s.options[i % s.options.length] ?? '';
        return row(item, i + 1, catalogueUnit(s, item));
    });
    return [
        ['Excel sample', s.sample],
        ['empty list', { items: [] }],
        ['every dropdown option once, in dropdown order (price follows the item)', {
            items: s.options.map((o, i) => row(o, i + 2, catalogueUnit(s, o))),
        }],
        [`full sheet: ${s.capacity} rows (rows past the ${s.boqRows} wired BOQ rows — D5)`, { items: fill(s.capacity) }],
        ['duplicates of the first sample item (keys ~2, ~3)', {
            items: [first, { ...first, qty: 3 }, { ...first, qty: 1.5, unit: '' }, ...sample.slice(1)].slice(0, s.capacity),
        }],
        ['free text with and without typed prices', {
            items: [row(freeA, 4, 'ชุด', 1250, 300), row(freeB, 2.5, '', null, null), ...sample.slice(1)].slice(0, s.capacity),
        }],
        ['qty 0 rows and an empty item with a qty', {
            items: [{ ...first, qty: 0 }, row('', 3, ''), ...sample.slice(1).map((r, i) => (i === 0 ? { ...r, qty: 0 } : r))]
                .slice(0, s.capacity),
        }],
        ['typed prices on the sample rows (Excel BOQ I / K)', {
            items: sample.map((r, i) => ({ ...r, mat: i % 2 === 0 ? 999 : null, lab: i % 3 === 0 ? 111 : null })),
        }],
        ['typed units and stray spaces in the items', {
            items: sample.map((r, i) => ({ ...r, item: i % 2 ? `${r.item.trim()}  ` : r.item.trim(), unit: i % 2 ? '' : (s.units[s.units.length - 1] ?? r.unit) })),
        }],
    ];
}

/** Branches of the comparison a case exercises (for the coverage test). */
export function pickListBranches(s: PickListSheet, input: PickListInput, catalogue: Map<string, ExcelPrice>): Set<string> {
    const out = new Set<string>();
    const listed = listedRows(input);
    const seen = new Set<string>();
    if (input.items.length === 0) out.add('empty list');
    if (input.items.length === s.capacity) out.add('full sheet');
    input.items.forEach((r, i) => {
        const key = norm(r.item);
        const isListed = listed.some(x => x.index === i);
        if (key !== '' && seen.has(key)) out.add('duplicate item');
        seen.add(key);
        if (key === '' && num(r.qty) > 0) out.add('empty item with qty');
        if (key !== '' && num(r.qty) === 0) out.add('qty 0');
        if (key !== '' && !catalogue.has(key)) out.add(r.mat !== null || r.lab !== null ? 'free text, typed price' : 'free text, no price');
        if (r.mat !== null) out.add('typed material price');
        if (r.lab !== null) out.add('typed labour price');
        if (r.unit.trim() === '') out.add('blank unit (catalogue unit)');
        else if (r.unit.trim() !== catalogue.get(key)?.unit) out.add('typed unit differs from the catalogue');
        if (r.item !== r.item.trim()) out.add('stray spaces in the item');
        if (!Number.isInteger(r.qty)) out.add('fractional qty');
        if (!isListed) return;
        if (i >= s.boqRows) { out.add('row past the wired BOQ rows (D5)'); return; }
        const sampleItem = norm(s.sample.items[i]?.item ?? '');
        const p = expectedPrice(r, catalogue);
        const excel = catalogue.get(sampleItem);
        const typedMat = r.mat ?? excel?.mat;
        const typedLab = r.lab ?? excel?.lab;
        out.add(typedMat === p.mat && typedLab === p.lab ? 'exact row (Excel price = item price)' : 'price follows the item (D5 delta)');
    });
    for (const o of s.options) if (input.items.some(r => norm(r.item) === norm(o) && num(r.qty) > 0)) out.add(`option ${norm(o)}`);
    return out;
}

/** Every branch the coverage test requires for a sheet. */
export function requiredPickListBranches(s: PickListSheet): string[] {
    return [
        'empty list', 'full sheet', 'duplicate item', 'empty item with qty', 'qty 0', 'free text, typed price',
        'free text, no price', 'typed material price', 'typed labour price', 'blank unit (catalogue unit)',
        'typed unit differs from the catalogue', 'stray spaces in the item', 'fractional qty',
        'row past the wired BOQ rows (D5)', 'exact row (Excel price = item price)', 'price follows the item (D5 delta)',
        ...s.options.map(o => `option ${norm(o)}`),
    ].sort();
}
