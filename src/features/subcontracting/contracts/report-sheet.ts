// ─── "ประมาณการเทียบจริง" report: table rows (pure) and the .xlsx download (ExcelJS on demand) ───
import type { ProcurementReportDto } from '@/shared/contract';
import { tradeLabel } from '@/domain/subcontracting/trades';

export interface ReportRow {
    key: string;
    label: string;
    estimate: number;
    contracted: number;
    paid: number;
    /** contracted − estimate. */
    diff: number;
    /** diff / estimate (null without an estimate). */
    diffPct: number | null;
    /** paid / contracted (null without a contract). */
    paidPct: number | null;
}

const ratio = (a: number, b: number): number | null => (b === 0 ? null : a / b);

/** One row per trade in the server's order, then the total row (key 'total'). */
export function reportRows(report: ProcurementReportDto): ReportRow[] {
    const rows: ReportRow[] = report.rows.map(r => ({
        key: r.trade,
        label: tradeLabel(r.trade),
        estimate: r.estimate,
        contracted: r.contracted,
        paid: r.paid,
        diff: r.diff,
        diffPct: ratio(r.diff, r.estimate),
        paidPct: ratio(r.paid, r.contracted),
    }));
    const t = report.totals;
    rows.push({
        key: 'total', label: 'รวมทั้งโครงการ', estimate: t.estimate, contracted: t.contracted, paid: t.paid, diff: t.diff,
        diffPct: ratio(t.diff, t.estimate), paidPct: ratio(t.paid, t.contracted),
    });
    return rows;
}

export const REPORT_HEADERS = ['ประเภทงาน', 'ประมาณการ (BOQ)', 'ราคาสัญญา', 'จ่ายแล้ว', 'ต่าง (สัญญา − ประมาณการ)', 'ต่าง %', 'จ่ายแล้ว %'] as const;

/** Cell values of the sheet body (numbers stay numbers; % as fractions with a % number format). */
export function reportSheetValues(rows: readonly ReportRow[]): (string | number | null)[][] {
    return rows.map(r => [r.label, r.estimate, r.contracted, r.paid, r.diff, r.diffPct, r.paidPct]);
}

/** Safe file name: "รายงานจ้างช่วง_<project>.xlsx". */
export function reportFileName(projectName: string): string {
    const clean = projectName.replace(/[\\/:*?"<>|]+/g, ' ').trim();
    return `รายงานจ้างช่วง_${clean === '' ? 'โครงการ' : clean}.xlsx`;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const FONT = 'TH Sarabun New';

export async function downloadReportXlsx(report: ProcurementReportDto, projectName: string): Promise<void> {
    const { default: lib } = await import('exceljs');
    const wb = new lib.Workbook();
    wb.creator = 'ConTrack';
    wb.created = new Date();
    const ws = wb.addWorksheet('ประมาณการเทียบจริง', {
        views: [{ state: 'frozen', ySplit: 3, showGridLines: false }],
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    ws.columns = [{ width: 34 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 22 }, { width: 10 }, { width: 12 }];
    const title = ws.getCell('A1');
    title.value = `ประมาณการเทียบจริง (จ้างช่วง) — ${projectName}`;
    title.font = { name: FONT, size: 18, bold: true };
    ws.getRow(3).values = [...REPORT_HEADERS];
    const thin = { style: 'thin' as const, color: { argb: 'FF000000' } };
    const border = { top: thin, left: thin, bottom: thin, right: thin };
    ws.getRow(3).eachCell(c => {
        c.font = { name: FONT, size: 15, bold: true };
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } };
        c.border = border;
    });
    const rows = reportRows(report);
    reportSheetValues(rows).forEach((values, i) => {
        const row = ws.getRow(4 + i);
        row.values = values;
        const isTotal = i === rows.length - 1;
        row.eachCell({ includeEmpty: true }, (c, col) => {
            c.font = { name: FONT, size: 15, bold: isTotal };
            c.border = border;
            if (col >= 2 && col <= 5) c.numFmt = '#,##0.00;[Red]-#,##0.00';
            if (col >= 6) c.numFmt = '0.0%';
            if (isTotal) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        });
    });
    const buffer = await wb.xlsx.writeBuffer();
    const { saveAs } = await import('file-saver');
    saveAs(new Blob([buffer], { type: XLSX_MIME }), reportFileName(projectName));
}
