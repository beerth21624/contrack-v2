import { describe, expect, it } from 'vitest';
import { computeProject, createProject, type ProjectMeta } from '@/domain/project';
import { boqFileBaseName, buildBoqSheet, NUM_FMT, pageHeader, SHEET_FILL, type SheetCell, type SheetRow } from '../boq-sheet';

const sample = createProject('sample');
const sampleBoq = computeProject(sample).boq;
const model = buildBoqSheet(sampleBoq, { ...sample.meta, siteAddress: 'ต.บางพลี', ownerName: 'คุณสมชาย' });

const rowAt = (r: number): SheetRow => {
    const row = model.rows.find(x => x.r === r);
    if (!row) throw new Error(`no row ${r}`);
    return row;
};
const cellAt = (row: SheetRow, col: SheetCell['col']): SheetCell => {
    const c = row.cells.find(x => x.col === col);
    if (!c) throw new Error(`no cell ${col}${row.r}`);
    return c;
};
const v = (addr: string) => {
    const m = /^([A-N])(\d+)$/.exec(addr);
    if (!m) throw new Error(addr);
    return cellAt(rowAt(Number(m[2])), m[1] as SheetCell['col']);
};

/** Excel v5 'BOQ (Home)'!M310. */
const EXCEL_M310 = 'M14+M17+M30+M33+M36+M59+M66+M81+M95+M105+M112+M135+M146+M150+M160+M177+M187+M197+M203+M208+M216+M221+M232+M243+M253+M271+M277+M280+M292+M298+M308';

describe('BOQ (Home) sheet model', () => {
    it('has the estimate-form header block (v5 cells kept) and the Excel column headers', () => {
        expect(v('B1').value).toBe('แบบแสดงรายการ ปริมาณงาน และราคา');
        expect(v('B2').value).toBe('ชื่อโครงการ');
        expect(v('D2').value).toBe(sample.meta.projectName.trim());
        expect(v('B3').value).toBe('สถานที่ก่อสร้าง');
        expect(v('D3').value).toBe('ต.บางพลี');
        expect(v('B4').value).toBe('เจ้าของ/หน่วยงาน');
        expect(v('D4').value).toBe('คุณสมชาย');
        expect(v('K2').value).toBe('ฉบับแก้ไขที่');
        expect(v('M2').value).toBe('00');
        expect(v('K3').value).toBe('เมื่อวันที่');
        expect(v('K4').value).toBe('ประมาณราคาโดย');
        expect(v('B5').value).toBe('แบบเลขที่');
        expect(v('D5')).toMatchObject({ value: '', style: { border: 'dotted' } });
        expect(v('D2').style?.border).toBe('dotted');
        expect(v('I6').value).toBe('ค่าวัสดุ');
        expect(v('K6').value).toBe('ค่าแรงงาน');
        expect(model.merges).toEqual(['B1:N1', 'I6:J6', 'K6:L6']);
        const headers = rowAt(7).cells.map(c => `${c.col}:${String(c.value)}`);
        expect(headers).toEqual([
            'B:No.', 'C:ขั้นตอน', 'D:รายการ', 'E:ปริมาณ', 'F:หน่วย', 'G:%เผื่อ', 'H:ปริมาณ\nเผื่อแล้ว',
            'I:ต่อหน่วย', 'J:รวม', 'K:ต่อหน่วย', 'L:รวม', 'M:รวมทั้งหมด', 'N:หมายเหตุ',
        ]);
        expect(model.freezeRows).toBe(7);
    });

    it('prints A4 landscape without column A, header rows repeated, page numbers in the page header', () => {
        expect(model.print).toEqual({
            orientation: 'landscape',
            printArea: 'B1:N311',
            printTitlesRow: '6:7',
            header: '&R&"TH Sarabun New,Regular"&14แผ่นที่ &P/&N',
        });
        expect(pageHeader('A & B')).toContain('A && B   แผ่นที่ &P/&N');
    });

    it('lays section 0 out on Excel rows 8–10', () => {
        expect(rowAt(8).kind).toBe('section');
        expect(v('B8').value).toBe(0);
        expect(v('C8').value).toBe('งานตรวจสอบที่ดิน');
        expect(v('C9').value).toBe('1)');
        expect(v('D9').value).toBe('ค่าตรวจสอบที่ดิน');
        expect(v('E9').value).toBe(1);
        expect(v('F9').value).toBe('เหมา');
        expect(v('K9').value).toBe(7500);
        expect(v('M9').value).toBe(7500);
        expect(rowAt(10).kind).toBe('subtotal');
        expect(v('D10').value).toBe('รวม >> ');
        expect(v('M10')).toMatchObject({ value: 7500, formula: 'SUM(M9:M9)' });
        expect(v('J10').formula).toBe('SUM(J9:J9)');
        expect(v('L10').formula).toBe('SUM(L9:L9)');
        expect(model.subtotalRows[0]).toBe(10);
        expect(model.subtotalRows[1]).toBe(14);
        expect(Object.keys(model.subtotalRows)).toHaveLength(sampleBoq.sections.length);
    });

    it('puts the grand total on row 310 with the Excel M310 formula (section 0 left out, D2)', () => {
        expect(model.grandTotalRow).toBe(310);
        expect(v('L310').value).toBe('รวมต้นทุนก่อสร้างทั้งหมด');
        expect(v('M310').formula).toBe(EXCEL_M310);
        expect(v('M310').value).toBeCloseTo(sampleBoq.constructionTotal, 6);
        expect(v('M310').style?.numFmt).toBe(NUM_FMT.grandTotal);
        expect(v('N310').value).toBe('บาท');
        // pre-construction shown on its own line
        expect(v('M311')).toMatchObject({ value: 7500, formula: 'M10' });
        expect(model.autoFilter).toBe('B7:N308');
    });

    it('writes numbers as numbers with the Excel formats', () => {
        const items = model.rows.filter(r => r.kind === 'item');
        expect(items.length).toBeGreaterThan(200);
        for (const row of items) {
            for (const col of ['I', 'J', 'K', 'L', 'M'] as const) {
                const c = cellAt(row, col);
                expect(typeof c.value).toBe('number');
                expect(Number.isFinite(c.value)).toBe(true);
                expect(c.style?.numFmt).toBe(NUM_FMT.accounting);
            }
            expect(cellAt(row, 'G').style?.numFmt).toBe(NUM_FMT.percent);
            expect(cellAt(row, 'G').style?.fill).toBe(SHEET_FILL.input);
            const j = cellAt(row, 'J').value as number;
            const l = cellAt(row, 'L').value as number;
            expect(cellAt(row, 'M').value as number).toBeCloseTo(j + l, 9);
        }
    });

    it('sub-totals add up to the construction total', () => {
        const subtotals = model.rows.filter(r => r.kind === 'subtotal');
        expect(subtotals).toHaveLength(sampleBoq.sections.length);
        const refs = new Set((v('M310').formula ?? '').split('+'));
        const sum = subtotals
            .filter(r => refs.has(`M${r.r}`))
            .reduce((a, r) => a + (cellAt(r, 'M').value as number), 0);
        expect(sum).toBeCloseTo(sampleBoq.constructionTotal, 6);
        // each sub-total = its section total, and the SUM range covers exactly the section rows
        sampleBoq.sections.forEach((s, i) => {
            const sub = subtotals[i];
            if (!sub) throw new Error(`no sub-total for section ${s.no}`);
            expect(cellAt(sub, 'M').value as number).toBeCloseTo(s.total, 9);
            if (s.rows.length > 0) expect(cellAt(sub, 'M').formula).toBe(`SUM(M${sub.r - s.rows.length}:M${sub.r - 1})`);
        });
    });

    it('a blank project gives a finite sheet', () => {
        const blank = createProject('blank');
        const m = buildBoqSheet(computeProject(blank).boq, blank.meta);
        for (const row of m.rows) {
            for (const c of row.cells) if (typeof c.value === 'number') expect(Number.isFinite(c.value)).toBe(true);
        }
        expect(m.rows[0]?.cells[0]?.value).toBe('แบบแสดงรายการ ปริมาณงาน และราคา');
    });
});

describe('boqFileBaseName', () => {
    const meta = (p: Partial<ProjectMeta>): ProjectMeta => ({
        projectName: '', siteAddress: '', ownerName: '', revision: '', documentDate: '', preparedBy: '', ...p,
    });
    it('builds BOQ_<project>_Rev<rev> without characters a file name cannot hold', () => {
        expect(boqFileBaseName(meta({ projectName: 'บ้านคุณเอ/บางนา', revision: '01' }))).toBe('BOQ_บ้านคุณเอ บางนา_Rev01');
        expect(boqFileBaseName(meta({}))).toBe('BOQ');
        expect(boqFileBaseName(meta({ projectName: '  บ้าน  ', revision: '' }))).toBe('BOQ_บ้าน');
    });
});
