// QA edge tests for the xlsx sheet models: BOQ (Home) and สรุป rows, formulas and totals must equal the engine.
import { describe, expect, it } from 'vitest';
import type { BoqItemRow, BoqResult, BoqSectionResult } from '@/domain/boq/types';
import { computeProject, createProject, DEFAULT_PROJECT_META, type ProjectMeta } from '@/domain/project';
import { boqFileBaseName, buildBoqSheet, FIRST_BODY_ROW, SHEET_NAME, SHEET_TEXT, type SheetModel, type SheetRow } from '../boq-sheet';
import { buildBoqSummarySheet, SUMMARY_FIRST_ROW, SUMMARY_SHEET_NAME, SUMMARY_TEXT } from '../boq-summary-sheet';
import { bahtText } from '../baht-text';

const meta: ProjectMeta = { ...DEFAULT_PROJECT_META, projectName: '  บ้านทดสอบ  ', revision: '01', siteAddress: 'กทม.', ownerName: 'คุณเอ', preparedBy: 'ช่างบี', documentDate: '2026-10-27' };

const itemRow = (key: string, excelRow: number, o: Partial<BoqItemRow> = {}): BoqItemRow => ({
    type: 'item', key, excelRow, itemNo: '1)', desc: `desc ${key}`, unit: 'หน่วย', qty: 1, qtySource: 'input', waste: 0, grossQty: 1,
    matUnit: 0, matTotal: 0, labUnit: 0, labTotal: 0, total: 0, materialBasis: 'gross', labourBasis: 'net',
    editable: { qty: true }, fromCalc: { qty: false, mat: false, lab: false }, ...o,
});
const section = (no: number, rows: BoqSectionResult['rows'], inConstructionTotal = true): BoqSectionResult => {
    const items = rows.filter((r): r is BoqItemRow => r.type === 'item');
    const mat = items.reduce((a, r) => a + r.matTotal, 0);
    const lab = items.reduce((a, r) => a + r.labTotal, 0);
    return { no, title: ` หมวด ${no} `, calculators: [], inConstructionTotal, rows, matTotal: mat, labTotal: lab, total: mat + lab };
};
const boqOf = (sections: BoqSectionResult[]): BoqResult => ({
    sections,
    constructionTotal: sections.filter(s => s.inConstructionTotal).reduce((a, s) => a + s.total, 0),
    preConstructionTotal: sections.filter(s => !s.inConstructionTotal).reduce((a, s) => a + s.total, 0),
});

const cell = (row: SheetRow | undefined, col: string) => row?.cells.find(c => c.col === col);
const rowAt = (m: SheetModel, r: number) => m.rows.find(x => x.r === r);
const byKind = (m: SheetModel, kind: SheetRow['kind']) => m.rows.filter(r => r.kind === kind);

const small = boqOf([
    section(0, [itemRow('L', 9, { lab: 7500, labTotal: 7500, labUnit: 7500, total: 7500 } as Partial<BoqItemRow>)], false),
    section(1, [
        { type: 'heading', key: 'H', excelRow: 12, itemNo: '', desc: 'หัวข้อ' },
        itemRow('A', 13, { matTotal: 1000.5, labTotal: 250.25, total: 1250.75, matUnit: 100.05, labUnit: 25.025 }),
        itemRow('B', 14, { matTotal: 99.99, labTotal: 0, total: 99.99 }),
    ]),
    section(2, []),
    section(3, [itemRow('C', 20, { qty: 0, qtySource: 'none', grossQty: null, matTotal: 5, total: 5 })]),
]);

describe('BOQ (Home) sheet: structure', () => {
    const m = buildBoqSheet(small, meta);

    it('named "BOQ (Home)", header on row 7, body starts at row 8, freeze above the body', () => {
        expect(m.sheetName).toBe(SHEET_NAME);
        expect(FIRST_BODY_ROW).toBe(8);
        expect(m.freezeRows).toBe(7);
        expect(rowAt(m, 7)?.kind).toBe('columnHeader');
        expect(m.rows.find(r => r.kind === 'section')?.r).toBe(8);
    });

    it('row numbers are strictly increasing, unique, and cells inside a row use unique columns', () => {
        const nums = m.rows.map(r => r.r);
        expect(new Set(nums).size).toBe(nums.length);
        for (let i = 1; i < nums.length; i++) expect(nums[i] ?? 0).toBeGreaterThan(nums[i - 1] ?? Infinity);
        for (const row of m.rows) expect(new Set(row.cells.map(c => c.col)).size).toBe(row.cells.length);
    });

    it('one section header + one sub-total per section; empty sections still get both', () => {
        expect(byKind(m, 'section')).toHaveLength(4);
        expect(byKind(m, 'subtotal')).toHaveLength(4);
        expect(byKind(m, 'item')).toHaveLength(4);
        expect(byKind(m, 'heading')).toHaveLength(1);
    });

    it('meta fields are trimmed and header text matches', () => {
        expect(cell(rowAt(m, 2), 'D')?.value).toBe('บ้านทดสอบ');
        expect(cell(rowAt(m, 2), 'M')?.value).toBe('01');
        expect(cell(rowAt(m, 3), 'D')?.value).toBe('กทม.');
        expect(cell(rowAt(m, 4), 'D')?.value).toBe('คุณเอ');
        expect(cell(rowAt(m, 4), 'M')?.value).toBe('ช่างบี');
        expect(cell(rowAt(m, 1), 'B')?.value).toBe(SHEET_TEXT.title);
    });

    it('grand total sits 2 rows under the last sub-total; the pre-construction line right below it', () => {
        const lastSub = Math.max(...byKind(m, 'subtotal').map(r => r.r));
        expect(m.grandTotalRow).toBe(lastSub + 2);
        expect(rowAt(m, m.grandTotalRow + 1)?.kind).toBe('preConstruction');
        expect(m.print.printArea).toBe(`B1:N${m.grandTotalRow + 1}`);
        expect(m.autoFilter).toBe(`B7:N${lastSub}`);
    });

    it('subtotalRows maps each section number to its sub-total row', () => {
        for (const s of small.sections) {
            const r = rowAt(m, m.subtotalRows[s.no] ?? -1);
            expect(r?.kind).toBe('subtotal');
        }
    });
});

describe('BOQ (Home) sheet: numbers equal the engine', () => {
    const m = buildBoqSheet(small, meta);

    it('item row cells carry qty, waste, gross, unit prices, J, L, M exactly', () => {
        const r = m.rows.filter(x => x.kind === 'item')[1];   // A
        expect(cell(r, 'E')?.value).toBe(1);
        expect(cell(r, 'I')?.value).toBe(100.05);
        expect(cell(r, 'J')?.value).toBe(1000.5);
        expect(cell(r, 'K')?.value).toBe(25.025);
        expect(cell(r, 'L')?.value).toBe(250.25);
        expect(cell(r, 'M')?.value).toBe(1250.75);
    });

    it('a row without net qty (tie wire) leaves E empty and a row without gross leaves H empty', () => {
        const r = m.rows.filter(x => x.kind === 'item')[3];
        expect(cell(r, 'E')?.value).toBeNull();
        expect(cell(r, 'H')?.value).toBeNull();
    });

    it('sub-total J / L / M cached values equal the section and formulas sum exactly the item rows', () => {
        const sec1 = rowAt(m, m.subtotalRows[1] ?? -1);
        expect(cell(sec1, 'J')?.value).toBeCloseTo(1100.49, 9);
        expect(cell(sec1, 'L')?.value).toBe(250.25);
        expect(cell(sec1, 'M')?.value).toBeCloseTo(1350.74, 9);
        // section 1 occupies: header, heading, A, B -> body rows; the SUM spans heading..B
        const first = (rowAt(m, m.subtotalRows[1] ?? -1)?.r ?? 0) - 3;
        expect(cell(sec1, 'M')?.formula).toBe(`SUM(M${first}:M${first + 2})`);
    });

    it('an empty section has a 0 sub-total and no formula (nothing to sum)', () => {
        const sec2 = rowAt(m, m.subtotalRows[2] ?? -1);
        expect(cell(sec2, 'M')?.value).toBe(0);
        expect(cell(sec2, 'M')?.formula).toBeUndefined();
    });

    it('re-adding the item rows reproduces every sub-total (cell values are internally consistent)', () => {
        for (const s of small.sections) {
            const sub = rowAt(m, m.subtotalRows[s.no] ?? -1);
            const subRow = sub?.r ?? 0;
            const items = m.rows.filter(r => r.kind === 'item' && r.r < subRow && r.r > subRow - s.rows.length - 2);
            const mSum = items.reduce((a, r) => a + Number(cell(r, 'M')?.value ?? 0), 0);
            expect(Number(cell(sub, 'M')?.value)).toBeCloseTo(mSum, 9);
        }
    });

    it('construction total M = engine value; its formula adds only construction sub-totals, never section 0', () => {
        const gt = rowAt(m, m.grandTotalRow);
        expect(cell(gt, 'M')?.value).toBeCloseTo(small.constructionTotal, 9);
        const refs = (cell(gt, 'M')?.formula ?? '').split('+');
        expect(refs).toEqual([1, 2, 3].map(no => `M${m.subtotalRows[no]}`));
        expect(refs).not.toContain(`M${m.subtotalRows[0]}`);
    });

    it('pre-construction line = section 0 = 7,500 with its own formula', () => {
        const pre = rowAt(m, m.grandTotalRow + 1);
        expect(cell(pre, 'M')?.value).toBe(7500);
        expect(cell(pre, 'M')?.formula).toBe(`M${m.subtotalRows[0]}`);
    });

    it('non-finite numbers in the BOQ are written as 0, never NaN / Infinity', () => {
        const dirty = boqOf([section(1, [itemRow('A', 13, {
            qty: Number.NaN, waste: Infinity, grossQty: -Infinity, matUnit: Number.NaN, matTotal: Number.NaN, labTotal: Infinity, total: Number.NaN,
        })])]);
        const sheet = buildBoqSheet(dirty, meta);
        for (const row of sheet.rows) for (const c of row.cells) {
            if (typeof c.value === 'number') expect(Number.isFinite(c.value), `${row.r}${c.col}`).toBe(true);
        }
    });

    it('no sections: a valid sheet with a 0 grand total and no formulas', () => {
        const sheet = buildBoqSheet(boqOf([]), meta);
        const gt = rowAt(sheet, sheet.grandTotalRow);
        expect(cell(gt, 'M')?.value).toBe(0);
        expect(cell(gt, 'M')?.formula).toBeUndefined();
        expect(sheet.grandTotalRow).toBe(FIRST_BODY_ROW + 1);
    });

    it('is deterministic and does not mutate the BOQ', () => {
        const copy = structuredClone(small);
        expect(buildBoqSheet(small, meta)).toEqual(buildBoqSheet(small, meta));
        expect(small).toEqual(copy);
    });
});

describe('BOQ (Home) sheet: real sample project', () => {
    const { boq } = computeProject(createProject('sample'));
    const m = buildBoqSheet(boq, createProject('sample').meta);

    it('sample layout matches Excel: grand total on row 310, pre-construction on 311', () => {
        expect(m.grandTotalRow).toBe(310);
        expect(cell(rowAt(m, 310), 'M')?.value).toBeCloseTo(boq.constructionTotal, 6);
        expect(cell(rowAt(m, 311), 'M')?.value).toBe(7500);
    });

    it('every section sub-total equals the engine section total', () => {
        for (const s of boq.sections) {
            const sub = rowAt(m, m.subtotalRows[s.no] ?? -1);
            expect(Number(cell(sub, 'M')?.value), `section ${s.no}`).toBeCloseTo(s.total, 6);
            expect(Number(cell(sub, 'J')?.value)).toBeCloseTo(s.matTotal, 6);
            expect(Number(cell(sub, 'L')?.value)).toBeCloseTo(s.labTotal, 6);
        }
    });

    it('item count equals the engine item count and sums of cell M equal the construction total', () => {
        const engineItems = boq.sections.flatMap(s => s.rows).filter(r => r.type === 'item').length;
        expect(byKind(m, 'item')).toHaveLength(engineItems);
        const inConstruction = byKind(m, 'item').filter(r => r.r > (m.subtotalRows[0] ?? 0));
        expect(inConstruction.reduce((a, r) => a + Number(cell(r, 'M')?.value ?? 0), 0)).toBeCloseTo(boq.constructionTotal, 4);
    });

    it('formula cell results are numbers, never strings', () => {
        for (const row of m.rows) for (const c of row.cells) {
            if (c.formula !== undefined) expect(typeof c.value).toBe('number');
        }
    });
});

describe('boqFileBaseName', () => {
    it.each([
        [{ projectName: 'บ้าน A', revision: '01' }, 'BOQ_บ้าน A_Rev01'],
        [{ projectName: 'บ้าน', revision: '' }, 'BOQ_บ้าน'],
        [{ projectName: '', revision: '02' }, 'BOQ_Rev02'],
        [{ projectName: '', revision: '' }, 'BOQ'],
        [{ projectName: 'a/b\\c:d*e?f"g<h>i|j', revision: '1' }, 'BOQ_a b c d e f g h i j_Rev1'],
        [{ projectName: '  many   spaces  ', revision: ' 3 ' }, 'BOQ_many spaces_Rev3'],
        [{ projectName: 'line\nbreak\ttab', revision: '0' }, 'BOQ_line break tab_Rev0'],
    ])('%j -> %s', (m, name) => {
        expect(boqFileBaseName({ ...DEFAULT_PROJECT_META, ...m })).toBe(name);
    });

    it('never contains characters illegal in a Windows file name', () => {
        const n = boqFileBaseName({ ...DEFAULT_PROJECT_META, projectName: '<>:"/\\|?*', revision: '|' });
        expect(n).not.toMatch(/[\\/:*?"<>|]/);
    });
});

describe('สรุป summary sheet', () => {
    const boq = small;
    const home = buildBoqSheet(boq, meta);
    const m = buildBoqSummarySheet(boq, meta, home);

    it('named "สรุป", header row 7, first section row 8, portrait', () => {
        expect(m.sheetName).toBe(SUMMARY_SHEET_NAME);
        expect(SUMMARY_FIRST_ROW).toBe(8);
        expect(m.print.orientation).toBe('portrait');
        expect(rowAt(m, 7)?.kind).toBe('columnHeader');
    });

    it('lists only the construction sections, with amounts equal to the engine and links to the BOQ sub-totals', () => {
        const rows = byKind(m, 'section');
        expect(rows.map(r => cell(r, 'B')?.value)).toEqual([1, 2, 3]);
        const r1 = rows[0];
        expect(cell(r1, 'F')?.value).toBeCloseTo(1350.74, 9);
        expect(cell(r1, 'F')?.formula).toBe(`'${SHEET_NAME}'!M${home.subtotalRows[1]}`);
        expect(cell(r1, 'D')?.formula).toBe(`'${SHEET_NAME}'!J${home.subtotalRows[1]}`);
        expect(cell(r1, 'C')?.value).toBe('หมวด 1');
    });

    it('total row = SUM over the section rows and equals the construction total; words row matches BAHTTEXT', () => {
        const total = byKind(m, 'grandTotal')[0];
        expect(cell(total, 'F')?.value).toBeCloseTo(boq.constructionTotal, 9);
        expect(cell(total, 'F')?.formula).toBe('SUM(F8:F10)');
        expect(cell(total, 'D')?.value).toBeCloseTo(boq.sections.filter(s => s.inConstructionTotal).reduce((a, s) => a + s.matTotal, 0), 9);
        const words = byKind(m, 'words')[0];
        expect(cell(words, 'B')?.value).toBe(`(${SUMMARY_TEXT.inWords} ${bahtText(boq.constructionTotal)})`);
        expect(cell(words, 'B')?.formula).toContain(`BAHTTEXT(F${total?.r})`);
    });

    it('pre-construction band and line appear only when a section is outside the construction total', () => {
        const pre = byKind(m, 'preConstruction');
        expect(pre).toHaveLength(1);
        expect(cell(pre[0], 'F')?.value).toBe(7500);
        expect(cell(pre[0], 'G')?.value).toBe(SUMMARY_TEXT.preConstructionNote);
        expect(byKind(m, 'band')).toHaveLength(1);

        const noPre = boqOf(boq.sections.filter(s => s.inConstructionTotal));
        const m2 = buildBoqSummarySheet(noPre, meta, buildBoqSheet(noPre, meta));
        expect(byKind(m2, 'band')).toHaveLength(0);
        expect(byKind(m2, 'preConstruction')).toHaveLength(0);
    });

    it('the pre-construction amount is not added to the total', () => {
        const total = byKind(m, 'grandTotal')[0];
        expect(Number(cell(total, 'F')?.value)).toBeCloseTo(boq.constructionTotal, 9);
        expect(Number(cell(total, 'F')?.value)).not.toBeCloseTo(boq.constructionTotal + 7500, 3);
    });

    it('signature block carries the preparer name, blanks for the others', () => {
        const sigs = byKind(m, 'signature');
        expect(sigs).toHaveLength(5);
        expect(cell(sigs[2], 'C')?.value).toBe('( ช่างบี )');
        const blank = buildBoqSummarySheet(boq, { ...meta, preparedBy: '  ' }, home);
        expect(String(cell(byKind(blank, 'signature')[2], 'C')?.value)).toMatch(/^\(\.+\)$/);
    });

    it('no construction section: SUM formulas are omitted and total is 0; "ศูนย์บาทถ้วน" in the words row', () => {
        const empty = boqOf([]);
        const sheet = buildBoqSummarySheet(empty, meta, buildBoqSheet(empty, meta));
        const total = byKind(sheet, 'grandTotal')[0];
        expect(cell(total, 'F')?.value).toBe(0);
        expect(cell(total, 'F')?.formula).toBeUndefined();
        expect(String(cell(byKind(sheet, 'words')[0], 'B')?.value)).toContain('ศูนย์บาทถ้วน');
    });

    it('a section missing from the BOQ sheet links nothing (no broken formula)', () => {
        const sheet = buildBoqSummarySheet(boq, meta, { ...home, subtotalRows: {} });
        for (const r of byKind(sheet, 'section')) expect(cell(r, 'F')?.formula).toBeUndefined();
    });

    it('blank header fields stay as lines to fill in (label only), filled ones show "label  value"', () => {
        const filled = cell(rowAt(m, 2), 'B')?.value;
        expect(filled).toBe(`${SUMMARY_TEXT.projectName}  บ้านทดสอบ`);
        const blank = buildBoqSummarySheet(boq, { ...meta, projectName: '' }, home);
        expect(cell(rowAt(blank, 2), 'B')?.value).toBe(SUMMARY_TEXT.projectName);
    });

    it('sample project: total equals the engine and the words are the baht text of it', () => {
        const { boq: sample } = computeProject(createProject('sample'));
        const sheet = buildBoqSummarySheet(sample, DEFAULT_PROJECT_META, buildBoqSheet(sample, DEFAULT_PROJECT_META));
        const total = byKind(sheet, 'grandTotal')[0];
        expect(cell(total, 'F')?.value).toBeCloseTo(sample.constructionTotal, 6);
        expect(byKind(sheet, 'section')).toHaveLength(sample.sections.filter(s => s.inConstructionTotal).length);
        expect(String(cell(byKind(sheet, 'words')[0], 'B')?.value)).toContain(bahtText(sample.constructionTotal));
    });
});
