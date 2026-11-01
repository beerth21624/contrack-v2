// ─── The job-cost table as an .xlsx (ExcelJS loaded on demand, like src/features/export/xlsx.ts) ───
import type { JobCostReportDto } from '@/shared/contract';

export interface CostXlsxLabels {
    sheet: string;
    section: (no: number, title: string | undefined) => string;
    unassigned: string;
    total: string;
    columns: {
        code: string; description: string; unit: string; budget: string; committed: string; actual: string; eac: string;
        variance: string; progress: string; level: string;
    };
    level: (level: string) => string;
}

const MONEY_FMT = '#,##0.00;[Red]-#,##0.00';

/** Builds the workbook buffer: one row per cost code under a subtotal row per BOQ section. */
export async function costXlsxBuffer(report: JobCostReportDto, sectionTitles: ReadonlyMap<number, string>, labels: CostXlsxLabels): Promise<ArrayBuffer> {
    const { default: lib } = await import('exceljs');
    const wb = new lib.Workbook();
    const ws = wb.addWorksheet(labels.sheet.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
    const c = labels.columns;
    ws.columns = [
        { header: c.code, key: 'code', width: 16 },
        { header: c.description, key: 'desc', width: 48 },
        { header: c.unit, key: 'unit', width: 10 },
        { header: c.budget, key: 'budget', width: 16, style: { numFmt: MONEY_FMT } },
        { header: c.committed, key: 'committed', width: 16, style: { numFmt: MONEY_FMT } },
        { header: c.actual, key: 'actual', width: 16, style: { numFmt: MONEY_FMT } },
        { header: c.eac, key: 'eac', width: 16, style: { numFmt: MONEY_FMT } },
        { header: c.variance, key: 'variance', width: 16, style: { numFmt: MONEY_FMT } },
        { header: c.progress, key: 'progress', width: 12, style: { numFmt: '0.0%' } },
        { header: c.level, key: 'level', width: 12 },
    ];
    ws.getRow(1).font = { bold: true };

    const bold = (row: ReturnType<typeof ws.addRow>) => { row.font = { bold: true }; };
    for (const section of report.sections) {
        const title = sectionTitles.get(section.sectionNo);
        bold(ws.addRow({
            code: String(section.sectionNo), desc: labels.section(section.sectionNo, title), budget: section.budget, committed: section.committedOpen,
            actual: section.actual, eac: section.eac, variance: section.variance, progress: section.progress, level: labels.level(section.level),
        }));
        for (const l of report.lines.filter(x => x.sectionNo === section.sectionNo)) {
            ws.addRow({
                code: l.code, desc: l.descTh, unit: l.unit, budget: l.budget, committed: l.committedOpen, actual: l.actual, eac: l.eac,
                variance: l.variance, progress: l.progress, level: labels.level(l.level),
            });
        }
    }
    const u = report.unassigned;
    if (u.actual !== 0 || u.committedOpen !== 0) {
        ws.addRow({ desc: labels.unassigned, committed: u.committedOpen, actual: u.actual, eac: u.committedOpen + u.actual });
    }
    const t = report.totals;
    bold(ws.addRow({
        desc: labels.total, budget: t.budget, committed: t.committedOpen + u.committedOpen, actual: t.actual + u.actual,
        eac: t.eac + u.committedOpen + u.actual, variance: t.budget - t.eac - u.committedOpen - u.actual, level: labels.level(t.level),
    }));
    return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/** Downloads `job-cost_<project>.xlsx` (browser only). */
export async function downloadCostXlsx(report: JobCostReportDto, sectionTitles: ReadonlyMap<number, string>, labels: CostXlsxLabels, fileBase: string): Promise<void> {
    const buffer = await costXlsxBuffer(report, sectionTitles, labels);
    const { saveAs } = await import('file-saver');
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${fileBase}.xlsx`);
}
