import { describe, expect, it } from 'vitest';
import { computeProject, createProject } from '@/domain/project';
import { bahtText } from '../baht-text';
import { buildBoqSheet, NUM_FMT, type SheetCell, type SheetModel, type SheetRow } from '../boq-sheet';
import { buildBoqSummarySheet, SUMMARY_FIRST_ROW } from '../boq-summary-sheet';

const sample = createProject('sample');
const boq = computeProject(sample).boq;
const metaIn = { ...sample.meta, ownerName: 'คุณสมชาย', preparedBy: 'นายช่าง ก.' };
const home = buildBoqSheet(boq, metaIn);
const model = buildBoqSummarySheet(boq, metaIn, home);
const construction = boq.sections.filter(s => s.inConstructionTotal);

const cell = (m: SheetModel, addr: string): SheetCell => {
    const match = /^([A-N])(\d+)$/.exec(addr);
    if (!match) throw new Error(addr);
    const c = m.rows.find(r => r.r === Number(match[2]))?.cells.find(x => x.col === match[1]);
    if (!c) throw new Error(`no cell ${addr}`);
    return c;
};
const rowsOf = (kind: SheetRow['kind']) => model.rows.filter(r => r.kind === kind);

describe('"สรุป" summary sheet (ปร.5 layout)', () => {
    it('title, header block and column headers', () => {
        expect(model.sheetName).toBe('สรุป');
        expect(cell(model, 'B1').value).toBe('แบบสรุปผลการประมาณราคาค่าก่อสร้าง');
        expect(cell(model, 'B2').value).toBe(`ชื่อโครงการ  ${sample.meta.projectName.trim()}`);
        expect(cell(model, 'E2').value).toBe('ฉบับแก้ไขที่  00');
        expect(cell(model, 'B4').value).toBe('เจ้าของ/หน่วยงาน  คุณสมชาย');
        expect(cell(model, 'E4').value).toBe('แบบเลขที่');   // nothing to print: a dotted line to fill in
        expect(cell(model, 'E4').style?.border).toBe('dotted');
        expect(cell(model, 'B5').value).toBe('ประมาณราคาโดย  นายช่าง ก.');
        expect(model.merges).toEqual(expect.arrayContaining(['B1:G1', 'B2:D2', 'E2:G2', 'B3:G3', 'B4:D4', 'E4:G4']));
        const headers = model.rows.find(r => r.kind === 'columnHeader')?.cells.map(c => c.value);
        expect(headers).toEqual(['ลำดับ', 'รายการ (หมวดงาน)', 'ค่าวัสดุ\n(บาท)', 'ค่าแรงงาน\n(บาท)', 'รวม\n(บาท)', 'หมายเหตุ']);
        expect(model.freezeRows).toBe(7);
    });

    it('one row per construction section, linked to its BOQ (Home) sub-total', () => {
        const sections = rowsOf('section');
        expect(sections.map(r => cell(model, `B${r.r}`).value)).toEqual(construction.map(s => s.no));
        expect(sections[0]?.r).toBe(SUMMARY_FIRST_ROW);
        construction.forEach((s, i) => {
            const r = SUMMARY_FIRST_ROW + i;
            const sub = home.subtotalRows[s.no];
            expect(cell(model, `C${r}`).value).toBe(s.title.trim());
            expect(cell(model, `D${r}`)).toMatchObject({ value: s.matTotal, formula: `'BOQ (Home)'!J${sub}` });
            expect(cell(model, `E${r}`)).toMatchObject({ value: s.labTotal, formula: `'BOQ (Home)'!L${sub}` });
            expect(cell(model, `F${r}`)).toMatchObject({ value: s.total, formula: `'BOQ (Home)'!M${sub}` });
            expect(cell(model, `F${r}`).style?.numFmt).toBe(NUM_FMT.accounting);
            // the linked cell on BOQ (Home) holds the same cached value
            expect(cell(home, `M${sub}`).value).toBe(s.total);
        });
    });

    it('รวมค่างานต้นทุน, the amount in words, a blank Factor F line', () => {
        const total = rowsOf('grandTotal')[0];
        if (!total) throw new Error('no total row');
        const last = SUMMARY_FIRST_ROW + construction.length - 1;
        expect(cell(model, `C${total.r}`).value).toBe('รวมค่างานต้นทุน');
        expect(cell(model, `F${total.r}`).formula).toBe(`SUM(F${SUMMARY_FIRST_ROW}:F${last})`);
        expect(cell(model, `F${total.r}`).value as number).toBeCloseTo(boq.constructionTotal, 6);
        expect((cell(model, `D${total.r}`).value as number) + (cell(model, `E${total.r}`).value as number))
            .toBeCloseTo(boq.constructionTotal, 6);

        const words = cell(model, `B${total.r + 1}`);
        expect(words.value).toBe(`(ตัวอักษร ${bahtText(boq.constructionTotal)})`);
        expect(words.formula).toBe(`"(ตัวอักษร "&BAHTTEXT(F${total.r})&")"`);

        const factor = rowsOf('factorF')[0];
        expect(factor?.r).toBe(total.r + 2);
        expect(String(cell(model, `C${total.r + 2}`).value)).toMatch(/^Factor F \(ถ้ามี\) \.+$/);
        for (const col of ['D', 'E', 'F', 'G']) expect(cell(model, `${col}${total.r + 2}`).value).toBeNull();
    });

    it('pre-construction (section 0) on its own, not in the total (D2)', () => {
        const pre = rowsOf('preConstruction');
        expect(pre).toHaveLength(1);
        const r = pre[0]?.r ?? 0;
        expect(cell(model, `B${r}`).value).toBe(0);
        expect(cell(model, `F${r}`)).toMatchObject({ value: 7500, formula: `'BOQ (Home)'!M${home.subtotalRows[0]}` });
        expect(cell(model, `G${r}`).value).toBe('ไม่รวมในค่างานต้นทุน');
        expect(cell(model, `B${r - 1}`).value).toBe('ค่าใช้จ่ายก่อนการก่อสร้าง (ไม่รวมในค่างานต้นทุน)');
        const total = rowsOf('grandTotal')[0];
        expect(total && r > total.r).toBe(true);
    });

    it('signature blocks: estimator (named), checker, approver', () => {
        const sign = rowsOf('signature');
        expect(sign).toHaveLength(5);
        const [roles, signLine, names, position, date] = sign;
        expect(roles?.cells.filter(c => c.value !== null).map(c => c.value)).toEqual(['ผู้ประมาณราคา', 'ผู้ตรวจสอบ', 'ผู้อนุมัติ']);
        expect(String(signLine?.cells[0]?.value)).toMatch(/^ลงชื่อ \.+$/);
        expect(names?.cells[0]?.value).toBe('( นายช่าง ก. )');
        expect(String(names?.cells.find(c => c.col === 'D')?.value)).toMatch(/^\(\.+\)$/);
        expect(String(position?.cells[0]?.value)).toMatch(/^ตำแหน่ง \.+$/);
        expect(String(date?.cells[0]?.value)).toMatch(/^วันที่ \.+$/);
        expect(model.merges).toEqual(expect.arrayContaining([`D${roles?.r}:E${roles?.r}`, `F${roles?.r}:G${roles?.r}`]));
    });

    it('prints A4 portrait, fit to width, header row repeated, form label and page numbers', () => {
        const lastRow = Math.max(...model.rows.map(r => r.r));
        expect(model.print).toEqual({
            orientation: 'portrait',
            printArea: `B1:G${lastRow}`,
            printTitlesRow: '7:7',
            header: '&R&"TH Sarabun New,Regular"&14รูปแบบตามแบบ ปร.5   แผ่นที่ &P/&N',
        });
    });

    it('a blank project gives a finite sheet', () => {
        const blank = createProject('blank');
        const b = computeProject(blank).boq;
        const m = buildBoqSummarySheet(b, blank.meta, buildBoqSheet(b, blank.meta));
        for (const row of m.rows) {
            for (const c of row.cells) if (typeof c.value === 'number') expect(Number.isFinite(c.value)).toBe(true);
        }
        expect(cell(m, 'B2').value).toBe('ชื่อโครงการ');
    });
});
