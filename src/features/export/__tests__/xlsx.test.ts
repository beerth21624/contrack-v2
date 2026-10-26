import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { computeProject, createProject } from '@/domain/project';
import { buildBoqSheet, NUM_FMT } from '../boq-sheet';
import { boqXlsxBuffer, writeBoqWorkbook } from '../xlsx';

describe('BOQ .xlsx', () => {
    it('writes a workbook that reads back with numbers, formats, formulas and merges', async () => {
        const project = createProject('sample');
        const { boq } = computeProject(project);
        const buffer = await boqXlsxBuffer(project);

        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        const ws = wb.getWorksheet('BOQ (Home)');
        expect(ws).toBeDefined();
        if (!ws) return;

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

        expect(ws.model.merges).toEqual(expect.arrayContaining(['I6:J6', 'K6:L6']));
        expect(ws.getCell('I9').font.name).toBe('Cordia New');
        expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 7 });
    });

    it('writes any sheet model (blank project)', async () => {
        const blank = createProject('blank');
        const wb = await writeBoqWorkbook(buildBoqSheet(computeProject(blank).boq, blank.meta));
        const buf = await wb.xlsx.writeBuffer();
        expect(buf.byteLength).toBeGreaterThan(10_000);
    });
});
