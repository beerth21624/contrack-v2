// QA edge tests for the written .xlsx: read the real bytes back and compare with the engine.
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { computeProject, createProject, type Project } from '@/domain/project';
import { boqXlsxBuffer, writeBoqWorkbook, XLSX_MIME } from '../xlsx';
import { buildBoqSheet } from '../boq-sheet';

async function load(project: Project) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await boqXlsxBuffer(project));
    const home = wb.getWorksheet('BOQ (Home)');
    const sum = wb.getWorksheet('สรุป');
    if (!home || !sum) throw new Error('worksheets missing');
    return { wb, home, sum };
}
/** Cached result of a cell (formula result or plain number). */
function num(v: ExcelJS.CellValue): number {
    if (typeof v === 'number') return v;
    if (v !== null && typeof v === 'object' && 'result' in v && typeof v.result === 'number') return v.result;
    return 0;   // ExcelJS drops cached zero results
}

describe('xlsx: sample project round trip', () => {
    const project = createProject('sample');
    const { boq } = computeProject(project);

    it('workbook has the two sheets in order and the xlsx mime type is the OOXML one', async () => {
        const { wb } = await load(project);
        expect(wb.worksheets.map(w => w.name)).toEqual(['สรุป', 'BOQ (Home)']);
        expect(XLSX_MIME).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });

    it('every BOQ sub-total row (J, L, M) in the file equals the engine section', async () => {
        const { home } = await load(project);
        const model = buildBoqSheet(boq, project.meta);
        for (const s of boq.sections) {
            const r = model.subtotalRows[s.no];
            expect(r, `section ${s.no}`).toBeDefined();
            expect(num(home.getCell(`J${r}`).value)).toBeCloseTo(s.matTotal, 4);
            expect(num(home.getCell(`L${r}`).value)).toBeCloseTo(s.labTotal, 4);
            expect(num(home.getCell(`M${r}`).value)).toBeCloseTo(s.total, 4);
        }
    });

    it('grand total, pre-construction and the summary total equal the engine', async () => {
        const { home, sum } = await load(project);
        expect(num(home.getCell('M310').value)).toBeCloseTo(boq.constructionTotal, 6);
        expect(num(home.getCell('M311').value)).toBeCloseTo(7500, 6);
        const totalRow = sum.getRow(SUMMARY_TOTAL_ROW);
        expect(num(totalRow.getCell('F').value)).toBeCloseTo(boq.constructionTotal, 6);
    });

    it('summary rows: one per construction section, each equal to the engine and linking to the BOQ sheet', async () => {
        const { sum } = await load(project);
        const construction = boq.sections.filter(s => s.inConstructionTotal);
        construction.forEach((s, i) => {
            const c = sum.getCell(`F${8 + i}`).value as { formula: string; result: number } | number;
            expect(num(c)).toBeCloseTo(s.total, 4);
            if (typeof c === 'object') expect(c.formula).toMatch(/^'BOQ \(Home\)'!M\d+$/);
        });
        expect(sum.getCell(`B${8 + construction.length}`).value).toBeNull();
    });

    it('the BAHTTEXT words row is a formula with a cached Thai text', async () => {
        const { sum } = await load(project);
        const wordsRow = 8 + boq.sections.filter(s => s.inConstructionTotal).length + 1;
        const v = sum.getCell(`B${wordsRow}`).value as { formula: string; result: string };
        expect(v.formula).toContain('BAHTTEXT(F');
        expect(v.result).toContain('หนึ่งล้านแปดแสนห้าหมื่นห้าพันหนึ่งร้อยหกสิบสองบาทยี่สิบห้าสตางค์');
    });

    it('workbook is flagged to recalculate on open and the creator is ConTrack', async () => {
        const wb = await writeBoqWorkbook(buildBoqSheet(boq, project.meta));
        expect(wb.calcProperties.fullCalcOnLoad).toBe(true);
        expect(wb.creator).toBe('ConTrack');
    });
});
const SUMMARY_TOTAL_ROW = 8 + 31;   // 31 construction sections (1..31) start at row 8

describe('xlsx: other projects', () => {
    it('blank project: builds, totals 18,200 and 7,500, no corrupt cells', async () => {
        const project = createProject('blank');
        const { home } = await load(project);
        // a blank project has fewer slot rows (rebar lines), so the grand total row moves up
        const gt = buildBoqSheet(computeProject(project).boq, project.meta).grandTotalRow;
        expect(gt).toBeLessThan(310);
        expect(num(home.getCell(`M${gt}`).value)).toBeCloseTo(18200, 6);
        expect(num(home.getCell(`M${gt + 1}`).value)).toBeCloseTo(7500, 6);
    });

    it('an edited project exports the edited numbers (R9 qty 3 -> 22,500 before construction)', async () => {
        const base = createProject('sample');
        const project: Project = { ...base, boqOverrides: { R9: { qty: 3 } } };
        const { home } = await load(project);
        expect(num(home.getCell('M311').value)).toBeCloseTo(22500, 6);
        expect(num(home.getCell('M310').value)).toBeCloseTo(computeProject(base).boq.constructionTotal, 6);
    });

    it('Thai text, quotes and ampersands in the header survive the round trip', async () => {
        const base = createProject('sample');
        const project: Project = {
            ...base,
            meta: { ...base.meta, projectName: 'บ้าน "A" & <B>', siteAddress: '1/2 ซ.3 =SUM(1,2)', ownerName: "O'Neil", revision: '9', preparedBy: 'ผู้ประมาณ' },
        };
        const { home } = await load(project);
        expect(home.getCell('D2').value).toBe('บ้าน "A" & <B>');
        expect(home.getCell('D4').value).toBe("O'Neil");
        // a leading "=" typed by the user is text, not a formula (this one starts with a digit anyway)
        expect(home.getCell('D3').value).toBe('1/2 ซ.3 =SUM(1,2)');
    });

    it('a project name that starts with "=" is stored as text, not executed as a formula', async () => {
        const base = createProject('sample');
        const project: Project = { ...base, meta: { ...base.meta, projectName: '=1+1' } };
        const { home } = await load(project);
        const v = home.getCell('D2').value;
        expect(typeof v === 'object' && v !== null && 'formula' in v).toBe(false);
        expect(v).toBe('=1+1');
    });

    it('a huge quantity override still writes a valid file with a finite total', async () => {
        const base = createProject('sample');
        const project: Project = { ...base, boqOverrides: { R9: { qty: 1e12 } } };
        const { home } = await load(project);
        expect(Number.isFinite(num(home.getCell('M311').value))).toBe(true);
        expect(num(home.getCell('M311').value)).toBeCloseTo(7.5e15, -3);
    });

    it('buffer is a non-empty zip (PK header)', async () => {
        const buf = new Uint8Array(await boqXlsxBuffer(createProject('blank')));
        expect(buf.length).toBeGreaterThan(1000);
        expect(buf[0]).toBe(0x50);
        expect(buf[1]).toBe(0x4b);
    });
});
