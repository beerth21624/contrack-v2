import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { computeProject, createProject } from '@/domain/project';
import { buildBoqSheet, NUM_FMT } from '../boq-sheet';
import { buildBoqSummarySheet } from '../boq-summary-sheet';
import { boqXlsxBuffer, writeBoqWorkbook } from '../xlsx';

describe('BOQ .xlsx', () => {
    it('writes a workbook that reads back with numbers, formats, formulas, merges and print setup', async () => {
        const project = createProject('sample');
        const { boq } = computeProject(project);
        const buffer = await boqXlsxBuffer(project);

        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        expect(wb.worksheets.map(w => w.name)).toEqual(['สรุป', 'BOQ (Home)']);
        const ws = wb.getWorksheet('BOQ (Home)');
        expect(ws).toBeDefined();
        if (!ws) return;

        expect(ws.getCell('B1').value).toBe('แบบแสดงรายการ ปริมาณงาน และราคา');
        expect(ws.getCell('D7').value).toBe('รายการ');
        expect(ws.getCell('K9').value).toBe(7500);
        expect(ws.getCell('K9').numFmt).toBe(NUM_FMT.accounting);
        expect(ws.getCell('G13').value).toBe(0.1);
        expect(ws.getCell('G13').numFmt).toBe(NUM_FMT.percent);
        expect(ws.getCell('E13').value).toBe(234);

        const m10 = ws.getCell('M10').value as { formula: string; result: number };
        expect(m10).toMatchObject({ formula: 'SUM(M9:M9)', result: 7500 });
        const m310 = ws.getCell('M310').value as { formula: string; result: number };
        expect(m310.formula.startsWith('M14+M17+')).toBe(true);
        expect(m310.result).toBeCloseTo(boq.constructionTotal, 6);
        expect(ws.getCell('L310').value).toBe('รวมต้นทุนก่อสร้างทั้งหมด');

        expect(ws.model.merges).toEqual(expect.arrayContaining(['B1:N1', 'I6:J6', 'K6:L6']));
        expect(ws.getCell('I9').font.name).toBe('TH Sarabun New');
        expect(ws.getCell('I9').font.size).toBe(16);
        expect(ws.getCell('D2').border.bottom?.style).toBe('dotted');
        expect(ws.getCell('B9').border.left?.style).toBe('thin');
        expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 7 });
        expect(ws.pageSetup).toMatchObject({
            paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
            printArea: 'B1:N311', printTitlesRow: '6:7',
        });
        expect(ws.pageSetup.margins?.left).toBeCloseTo(0.79, 2);
        expect(ws.headerFooter.oddHeader).toContain('แผ่นที่ &P/&N');

        const sum = wb.getWorksheet('สรุป');
        expect(sum).toBeDefined();
        if (!sum) return;
        expect(sum.getCell('B1').value).toBe('แบบสรุปผลการประมาณราคาค่าก่อสร้าง');
        expect(sum.getCell('F8').value).toMatchObject({ formula: "'BOQ (Home)'!M14" });   // section 1
        const f9 = sum.getCell('F9').value as { formula: string; result: number };       // section 2
        expect(f9).toMatchObject({ formula: "'BOQ (Home)'!M17" });
        expect(f9.result).toBeCloseTo(boq.sections.find(s => s.no === 2)?.total ?? NaN, 6);
        expect(sum.pageSetup).toMatchObject({ paperSize: 9, orientation: 'portrait', fitToWidth: 1, printTitlesRow: '7:7' });
        expect(sum.views[0]).toMatchObject({ state: 'frozen', ySplit: 7 });
        expect(sum.headerFooter.oddHeader).toContain('รูปแบบตามแบบ ปร.5');
        expect(sum.getCell('C8').font.name).toBe('TH Sarabun New');
    });

    it('writes any sheet models (blank project)', async () => {
        const blank = createProject('blank');
        const { boq } = computeProject(blank);
        const home = buildBoqSheet(boq, blank.meta);
        const wb = await writeBoqWorkbook(buildBoqSummarySheet(boq, blank.meta, home), home);
        const buf = await wb.xlsx.writeBuffer();
        expect(buf.byteLength).toBeGreaterThan(10_000);
        const single = await writeBoqWorkbook(home);
        expect(single.worksheets).toHaveLength(1);
        // zero cached results are dropped by ExcelJS: Excel recalculates on open
        expect(single.calcProperties.fullCalcOnLoad).toBe(true);
    });
});
