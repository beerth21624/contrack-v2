// ─── Tax reports → one .xlsx for the accountant (ExcelJS loaded on demand, like src/features/export/xlsx.ts) ───
// Sheets: output VAT, input VAT, ภ.ง.ด.3, ภ.ง.ด.53, WHT received, summary. Headers / labels come from the UI language.
import type { TaxReportDto, TaxReportKind, TaxReportRowDto, TaxReportSummaryDto } from '@/shared/contract';

export type ReportColumn =
    | 'no' | 'date' | 'type' | 'docNumber' | 'reference' | 'counterparty' | 'taxId' | 'branch' | 'incomeType' | 'rate' | 'net' | 'vat' | 'wht' | 'status';

/** Columns of each report, in order (the screen table and the sheet use the same list). */
export const REPORT_COLUMNS: Record<TaxReportKind, readonly ReportColumn[]> = {
    'output-vat': ['no', 'date', 'type', 'docNumber', 'reference', 'counterparty', 'taxId', 'branch', 'net', 'vat', 'status'],
    'input-vat': ['no', 'date', 'docNumber', 'reference', 'counterparty', 'taxId', 'branch', 'net', 'vat', 'status'],
    pnd3: ['no', 'date', 'docNumber', 'counterparty', 'taxId', 'branch', 'incomeType', 'rate', 'net', 'wht', 'reference', 'status'],
    pnd53: ['no', 'date', 'docNumber', 'counterparty', 'taxId', 'branch', 'incomeType', 'rate', 'net', 'wht', 'reference', 'status'],
    'wht-received': ['no', 'date', 'docNumber', 'reference', 'counterparty', 'taxId', 'branch', 'wht', 'status'],
};

export const MONEY_COLUMNS: ReadonlySet<ReportColumn> = new Set(['net', 'vat', 'wht']);

/** Sheet order of the workbook. */
export const SHEET_ORDER: readonly TaxReportKind[] = ['output-vat', 'input-vat', 'pnd3', 'pnd53', 'wht-received'];

export interface TaxXlsxLabels {
    sheet: (kind: TaxReportKind | 'summary') => string;
    header: (kind: TaxReportKind, column: ReportColumn) => string;
    total: string;
    /** Cell text of the text columns (type, branch, income type, status). */
    text: (column: 'type' | 'branch' | 'incomeType' | 'status', row: TaxReportRowDto) => string;
    taxId: (taxId: string) => string;
    summary: {
        report: string; count: string; base: string; vat: string; wht: string; vatPayable: string; whtToRemit: string;
    };
}

const MONEY_FMT = '#,##0.00;[Red]-#,##0.00';
const WIDTHS: Record<ReportColumn, number> = {
    no: 7, date: 12, type: 14, docNumber: 20, reference: 24, counterparty: 36, taxId: 20, branch: 14, incomeType: 22, rate: 8,
    net: 16, vat: 14, wht: 14, status: 14,
};

/** Sheet names: at most 31 characters and none of `[]:*?/\`. */
const sheetName = (s: string): string => s.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31);

function cellValue(column: ReportColumn, row: TaxReportRowDto, index: number, labels: TaxXlsxLabels): string | number | null {
    switch (column) {
        case 'no': return index + 1;
        case 'date': return row.date;
        case 'docNumber': return row.docNumber;
        case 'reference': return row.reference;
        case 'counterparty': return row.counterpartyName;
        case 'taxId': return labels.taxId(row.counterpartyTaxId);
        case 'rate': return row.whtRate;
        case 'net': return row.net;
        case 'vat': return row.vat;
        case 'wht': return row.wht;
        default: return labels.text(column, row);
    }
}

/** Builds the workbook buffer from the five reports of a month and its summary. */
export async function taxXlsxBuffer(
    reports: Readonly<Record<TaxReportKind, TaxReportDto>>, summary: TaxReportSummaryDto, labels: TaxXlsxLabels,
): Promise<ArrayBuffer> {
    const { default: lib } = await import('exceljs');
    const wb = new lib.Workbook();
    wb.creator = 'ConTrack';
    wb.created = new Date();

    for (const kind of SHEET_ORDER) {
        const report = reports[kind];
        const cols = REPORT_COLUMNS[kind];
        const ws = wb.addWorksheet(sheetName(labels.sheet(kind)), { views: [{ state: 'frozen', ySplit: 1 }] });
        ws.columns = cols.map(c => ({
            header: labels.header(kind, c), key: c, width: WIDTHS[c],
            style: MONEY_COLUMNS.has(c) ? { numFmt: MONEY_FMT } : c === 'rate' ? { numFmt: '0.00%' } : undefined,
        }));
        ws.getRow(1).font = { bold: true };
        report.rows.forEach((row, i) => {
            ws.addRow(Object.fromEntries(cols.map(c => [c, cellValue(c, row, i, labels)])));
        });
        const totals: Record<string, string | number> = { [cols[1] ?? 'date']: labels.total };
        if (cols.includes('net')) totals.net = report.totals.net;
        if (cols.includes('vat')) totals.vat = report.totals.vat;
        if (cols.includes('wht')) totals.wht = report.totals.wht;
        ws.addRow(totals).font = { bold: true };
    }

    const s = labels.summary;
    const ws = wb.addWorksheet(sheetName(labels.sheet('summary')));
    ws.columns = [
        { header: s.report, key: 'report', width: 36 },
        { header: s.count, key: 'count', width: 12 },
        { header: s.base, key: 'base', width: 18, style: { numFmt: MONEY_FMT } },
        { header: s.vat, key: 'vat', width: 18, style: { numFmt: MONEY_FMT } },
        { header: s.wht, key: 'wht', width: 18, style: { numFmt: MONEY_FMT } },
    ];
    ws.getRow(1).font = { bold: true };
    const line = (kind: TaxReportKind, t: TaxReportSummaryDto['outputVat'], vat: boolean, wht: boolean) => {
        ws.addRow({
            report: labels.sheet(kind), count: t.count, base: kind === 'wht-received' ? null : t.net, vat: vat ? t.vat : null, wht: wht ? t.wht : null,
        });
    };
    line('output-vat', summary.outputVat, true, false);
    line('input-vat', summary.inputVat, true, false);
    ws.addRow({ report: s.vatPayable, vat: summary.vatPayable }).font = { bold: true };
    line('pnd3', summary.pnd3, false, true);
    line('pnd53', summary.pnd53, false, true);
    ws.addRow({ report: s.whtToRemit, wht: Math.round((summary.pnd3.wht + summary.pnd53.wht) * 100) / 100 }).font = { bold: true };
    line('wht-received', summary.whtReceived, false, true);

    return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/** Downloads `<fileBase>.xlsx` (browser only). */
export async function downloadTaxXlsx(
    reports: Readonly<Record<TaxReportKind, TaxReportDto>>, summary: TaxReportSummaryDto, labels: TaxXlsxLabels, fileBase: string,
): Promise<void> {
    const buffer = await taxXlsxBuffer(reports, summary, labels);
    const { saveAs } = await import('file-saver');
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${fileBase}.xlsx`);
}
