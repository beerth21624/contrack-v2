// Shared core of the Excel "pick-list" sheets (07 ระบบสุขาภิบาล_Sanitary System, 20 เบ็ดเตล็ด_Other,
// 21 สุขภัณฑ์_Sanitary; the same shape as 10 ตู้ควบคุม_Load Center / 11 อุปกรณ์ไฟฟ้า_Equipment):
// a list of B รายการ (dropdown) / C จำนวน / D หน่วย with no formulas. Excel's BOQ reads the rows by position
// (D = B<n>, E = C<n>) and has the unit and prices typed in the BOQ row. Here (spec 05 D2, design D5):
//  - the list has no row limit,
//  - every row with an item and qty > 0 becomes one BOQ row, in list order, numbered 1), 2), …,
//  - unit and prices follow the chosen item through a price catalogue built from Excel's BOQ rows,
//  - a row may type its own unit / material / labour price (free-text items have only those).
// Spec: docs/excel-spec/05-mep-sanitary-misc.md §0.3, §3, §8, §9, §10.
import type { SlotRow } from '../types';

/** Price of one dropdown item: Excel BOQ F (unit), I (material/unit), K (labour/unit), N (note). */
export interface CatalogueItem {
    unit: string;
    mat: number;
    lab: number;
    note?: string;
}

/** Catalogue keyed by the item text (any spacing; looked up with `matchKey`). */
export type Catalogue = Record<string, CatalogueItem>;

/** One row of a pick-list sheet. */
export interface PickRow {
    item: string;          // B รายการ (a dropdown option, or free text where the sheet allows it)
    qty: number;           // C จำนวน / ปริมาณ → BOQ E
    unit: string;          // D หน่วย → BOQ F ('' = the catalogue unit)
    /** Material price per unit (BOQ I). null = the catalogue price (0 for an item not in the catalogue). */
    mat: number | null;
    /** Labour price per unit (BOQ K). null = the catalogue price (0 for an item not in the catalogue). */
    lab: number | null;
}

export interface PickListInput {
    items: PickRow[];
}

/**
 * Text used to match an item against the catalogue: trimmed, inner runs of spaces collapsed.
 * Excel's options carry stray trailing spaces (`อ่างล้างหน้า `, `ถังบำบัดน้ำเสียสาเร็จรูป ขนาด 600 ลิตร `).
 */
export const matchKey = (item: string): string => item.trim().replace(/\s+/g, ' ');

const num = (v: number) => (Number.isFinite(v) ? v : 0);

export function catalogueItem(catalogue: Catalogue, item: string): CatalogueItem | undefined {
    const key = matchKey(item);
    if (key === '') return undefined;
    // Own keys only (an item named like an Object.prototype member must not match).
    return Object.entries(catalogue).find(([k]) => matchKey(k) === key)?.[1];
}

export interface PickRowCalc {
    unit: string;        // BOQ F
    mat: number;         // BOQ I
    lab: number;         // BOQ K
    note?: string;       // BOQ N
    /** The item is in the catalogue (otherwise its prices are 0 unless typed). */
    known: boolean;
    matTotal: number;    // BOQ J = I × H (waste 0 → H = E)
    labTotal: number;    // BOQ L = K × E
    total: number;       // BOQ M
}

export function pickRowCalc(row: PickRow, catalogue: Catalogue): PickRowCalc {
    const c = catalogueItem(catalogue, row.item);
    const qty = num(row.qty);
    const mat = num(row.mat ?? c?.mat ?? 0);
    const lab = num(row.lab ?? c?.lab ?? 0);
    return {
        unit: row.unit.trim() || (c?.unit ?? ''),
        mat, lab,
        ...(c?.note ? { note: c.note } : {}),
        known: c !== undefined,
        matTotal: mat * qty,
        labTotal: lab * qty,
        total: (mat + lab) * qty,
    };
}

export interface KeyedRow {
    row: PickRow;
    index: number;   // position in the list
    key: string;     // BOQ slot row key
}

/**
 * Stable BOQ keys: the item text (matchKey). A second row with the same item gets `<item>~2`, a third `~3`, …
 * (rows are not merged: each may carry its own unit/prices, and the sheet lists them separately too).
 * Keys are counted over every row that has an item, whatever its qty, so setting a qty to 0 does not
 * move the edits stored on the BOQ page to another row. Rows without an item have no key.
 */
export function keyedRows(rows: PickRow[]): KeyedRow[] {
    const used = new Set<string>();
    const out: KeyedRow[] = [];
    rows.forEach((row, index) => {
        const base = matchKey(row.item);
        if (base === '') return;
        let key = base;
        for (let n = 2; used.has(key); n++) key = `${base}~${n}`;
        used.add(key);
        out.push({ row, index, key });
    });
    return out;
}

/** Rows that reach the BOQ: an item and qty > 0 (an empty Excel row shows nothing in the BOQ). */
export const boqRows = (rows: PickRow[]): KeyedRow[] => keyedRows(rows).filter(k => num(k.row.qty) > 0);

/** BOQ slot rows: one per listed item with qty > 0, numbered 1), 2), … (Excel rows C = `1)` …). */
export function pickListSlotRows(rows: PickRow[], catalogue: Catalogue): SlotRow[] {
    return boqRows(rows).map(({ row, key }, i): SlotRow => {
        const c = pickRowCalc(row, catalogue);
        return {
            type: 'item', key, itemNo: `${i + 1})`, desc: row.item.trim(), unit: c.unit,
            qty: { kind: 'input', value: num(row.qty) },
            waste: 0, gross: 'std', mat: c.mat, lab: c.lab,
            // Excel: J = I*H, L = K*E (masters J273/L273, L279, L282; waste 0 so H = E).
            materialBasis: 'gross', labourBasis: 'net',
            ...(c.note ? { note: c.note } : {}),
        };
    });
}

/** Sheet totals (the sheets have none; they equal the BOQ section's J / L / M). */
export function computePickList(rows: PickRow[], catalogue: Catalogue): Record<string, number> {
    let mat = 0, lab = 0, total = 0;
    const listed = boqRows(rows);
    for (const { row } of listed) {
        const c = pickRowCalc(row, catalogue);
        mat += c.matTotal;
        lab += c.labTotal;
        total += c.total;
    }
    return { rows: listed.length, mat, lab, total };
}

/**
 * Choosing an item in รายการ. A catalogue item brings its unit and drops typed prices (so the BOQ gets the
 * new item's price, not the old one's — the Excel BOQ keeps the old price, spec 05 §0.3). Free text
 * (renaming a custom item) keeps the row's own unit and prices; renaming a catalogue item into free text
 * (e.g. adding "ชั้น 2" to the railing) keeps the price it showed, typed into the row, instead of dropping to 0.
 */
export function selectItem(row: PickRow, item: string, catalogue: Catalogue): PickRow {
    const c = catalogueItem(catalogue, item);
    if (c) return { ...row, item, unit: c.unit, mat: null, lab: null };
    const prev = catalogueItem(catalogue, row.item);
    if (!prev || matchKey(item) === '') return { ...row, item };
    return { ...row, item, unit: row.unit.trim() || prev.unit, mat: row.mat ?? prev.mat, lab: row.lab ?? prev.lab };
}

/** A list row priced from the catalogue. */
export const pickRow = (item: string, qty: number, unit: string): PickRow => ({ item, qty, unit, mat: null, lab: null });

/** An empty row for the "+ เพิ่มรายการ" button. */
export const emptyPickRow = (): PickRow => pickRow('', 0, '');

/** Units of things counted one by one (the sheets' หน่วย options that are not lengths). */
export const COUNT_UNITS: readonly string[] = [
    'ชุด', 'ตัว', 'ท่อน', 'อัน', 'เครื่อง', 'ใบ', 'ถัง', 'บ่อ', 'จุด', 'ชิ้น', 'ดวง', 'คู่', 'แผ่น', 'บาน', 'หลัง', 'ลูก', 'ต้น', 'ม้วน',
];

export const isCountUnit = (unit: string): boolean => COUNT_UNITS.includes(unit.trim());

/** Decimals to show a quantity with: whole counts as integers ("1", not "1.00"), everything else 2. */
export const qtyDigits = (qty: number, unit: string): number => (isCountUnit(unit) && Number.isInteger(qty) ? 0 : 2);

/** Position of an option in the dropdown list (-1 = free text or empty). */
export const optionIndex = (options: readonly string[], item: string): number => {
    const key = matchKey(item);
    return key === '' ? -1 : options.findIndex(o => matchKey(o) === key);
};

/** The first row of each dropdown option (by option index), and every other row (duplicates, free text, empty). */
export function splitByOption(rows: readonly PickRow[], options: readonly string[]): { first: Map<number, number>; others: number[] } {
    const first = new Map<number, number>();
    const others: number[] = [];
    rows.forEach((row, i) => {
        const o = optionIndex(options, row.item);
        if (o >= 0 && !first.has(o)) first.set(o, i);
        else others.push(i);
    });
    return { first, others };
}

/**
 * Sets the quantity of a dropdown option (the guided journey's count sheet): its first row gets the qty; an option
 * with no row yet gets a new catalogue-priced row, placed in dropdown order before later options and free text.
 * Rows are never removed here (qty 0 keeps the row, so BOQ edits stored under its key stay with it).
 */
export function setOptionQty(
    rows: readonly PickRow[], options: readonly string[], option: number, qty: number, catalogue: Catalogue,
): PickRow[] {
    const item = options[option];
    if (item === undefined) return [...rows];
    const at = splitByOption(rows, options).first.get(option);
    if (at !== undefined) return rows.map((r, i) => (i === at ? { ...r, qty } : r));
    if (num(qty) === 0) return [...rows];
    const pos = rows.findIndex(r => { const o = optionIndex(options, r.item); return o === -1 || o > option; });
    const row = pickRow(item, qty, catalogueItem(catalogue, item)?.unit ?? '');
    return pos === -1 ? [...rows, row] : [...rows.slice(0, pos), row, ...rows.slice(pos)];
}

/** A row the BOQ would price at 0: it has an item but no catalogue price and none typed (e.g. new free text). */
export const needsPrice = (row: PickRow, catalogue: Catalogue): boolean => {
    const c = pickRowCalc(row, catalogue);
    return matchKey(row.item) !== '' && c.mat === 0 && c.lab === 0;
};
