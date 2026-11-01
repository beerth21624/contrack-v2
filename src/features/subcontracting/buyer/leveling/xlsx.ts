// ─── Comparison table → .xlsx (ExcelJS loaded on demand, like the BOQ export) ───
import type { Borders, Cell, Workbook } from 'exceljs';
import type { LevelingDto } from '@/shared/contract';
import { XLSX_MIME } from '@/features/export/xlsx';
import { fmtDay } from '../format';
import { scLocale, scText } from '../text';
import { bidderDiffPct, bidderOrder, installmentsText, isBlankCell, levelingFileName, toneArgb, type BidderOrder } from './model';

const FONT = 'TH Sarabun New';
const THIN = { style: 'thin' as const, color: { argb: 'FFBFBFBF' } };
const BORDER: Partial<Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const MONEY_FMT = '#,##0.00';
const QTY_FMT = '#,##0.##';
const PCT_FMT = '+0.0%;-0.0%;0.0%';

type Value = string | number | null;

interface CellSpec {
    value: Value;
    fmt?: string;
    bold?: boolean;
    italic?: boolean;
    fill?: string;
    align?: 'left' | 'center' | 'right';
}

function put(target: Cell, spec: CellSpec) {
    target.value = spec.value;
    target.font = { name: FONT, size: 14, bold: spec.bold === true, italic: spec.italic === true };
    target.alignment = { vertical: 'middle', wrapText: true, ...(spec.align !== undefined ? { horizontal: spec.align } : {}) };
    target.border = BORDER;
    if (spec.fmt !== undefined) target.numFmt = spec.fmt;
    if (spec.fill !== undefined) target.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: spec.fill } };
}

/** The workbook of one comparison: lines × (estimate + each bidder), then the footer rows. */
export async function levelingWorkbook(leveling: LevelingDto, title: string, order: BidderOrder): Promise<Workbook> {
    const t = scText();
    const { default: lib } = await import('exceljs');
    const wb = new lib.Workbook();
    wb.creator = 'ConTrack';
    wb.created = new Date();
    const ws = wb.addWorksheet(t('buyer.xlsx.sheetName'), {
        views: [{ state: 'frozen', xSplit: 5, ySplit: 4, showGridLines: false }],
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const ks = bidderOrder(leveling.bidders, order);
    const fixed = 5;
    const colOf = (pos: number, sub: number) => fixed + pos * 3 + sub + 1;
    ws.columns = [
        { width: 46 }, { width: 8 }, { width: 10 }, { width: 13 }, { width: 15 },
        ...ks.flatMap(() => [{ width: 13 }, { width: 15 }, { width: 9 }]),
    ];

    const titleCell = ws.getCell(1, 1);
    titleCell.value = t('buyer.xlsx.title', { title });
    titleCell.font = { name: FONT, size: 18, bold: true };
    const sub = ws.getCell(2, 1);
    sub.value = t('buyer.xlsx.subtitle', { version: leveling.version, date: new Date().toLocaleString(scLocale() === 'th' ? 'th-TH' : 'en-GB') });
    sub.font = { name: FONT, size: 14 };

    // Two header rows.
    const h1 = ws.getRow(3);
    const h2 = ws.getRow(4);
    [t('buyer.xlsx.item'), t('buyer.xlsx.unit'), t('buyer.xlsx.quantity')].forEach((head, c) => {
        put(h1.getCell(c + 1), { value: head, bold: true, align: 'center' });
        put(h2.getCell(c + 1), { value: null });
        ws.mergeCells(3, c + 1, 4, c + 1);
    });
    put(h1.getCell(4), { value: t('buyer.xlsx.estimateBoq'), bold: true, align: 'center' });
    put(h1.getCell(5), { value: null });
    ws.mergeCells(3, 4, 3, 5);
    put(h2.getCell(4), { value: t('buyer.xlsx.perUnit'), bold: true, align: 'center' });
    put(h2.getCell(5), { value: t('buyer.xlsx.total'), bold: true, align: 'center' });
    ks.forEach((k, pos) => {
        const b = leveling.bidders[k];
        const c = colOf(pos, 0);
        put(h1.getCell(c), { value: b?.displayName ?? '', bold: true, align: 'center' });
        put(h1.getCell(c + 1), { value: null });
        put(h1.getCell(c + 2), { value: null });
        ws.mergeCells(3, c, 3, c + 2);
        put(h2.getCell(c), { value: b?.mode === 'lump' ? t('buyer.xlsx.lumpSum') : t('buyer.xlsx.perUnit'), bold: true, align: 'center' });
        put(h2.getCell(c + 1), { value: t('buyer.xlsx.total'), bold: true, align: 'center' });
        put(h2.getCell(c + 2), { value: t('buyer.xlsx.diff'), bold: true, align: 'center' });
    });

    let r = 5;
    for (const line of leveling.lines) {
        const row = ws.getRow(r++);
        put(row.getCell(1), { value: line.desc });
        put(row.getCell(2), { value: line.unit, align: 'center' });
        put(row.getCell(3), { value: line.qtyPriced, fmt: QTY_FMT });
        put(row.getCell(4), { value: line.estUnit, fmt: MONEY_FMT });
        put(row.getCell(5), { value: line.estTotal, fmt: MONEY_FMT });
        ks.forEach((k, pos) => {
            const cell = line.cells[k];
            const c = colOf(pos, 0);
            const b = leveling.bidders[k];
            if (cell === undefined || b === undefined) return;
            if (isBlankCell(b, cell)) {
                // Outdated bid on a line the addendum changed: no price.
                put(row.getCell(c), { value: '—', align: 'center' });
                put(row.getCell(c + 1), { value: '—', align: 'center' });
                put(row.getCell(c + 2), { value: null });
                return;
            }
            const fill = toneArgb(cell.flag);
            put(row.getCell(c), cell.excluded
                ? { value: t('buyer.xlsx.excluded'), italic: true, align: 'center' }
                : { value: cell.unitPrice, fmt: MONEY_FMT, italic: cell.filled, fill });
            put(row.getCell(c + 1), { value: cell.total, fmt: MONEY_FMT, italic: cell.filled, fill });
            put(row.getCell(c + 2), { value: b.outdated ? null : cell.diffPct, fmt: PCT_FMT, italic: cell.filled, fill });
        });
    }

    const footer = (label: string, est: Value, values: (k: number) => CellSpec, merge = true) => {
        const row = ws.getRow(r);
        put(row.getCell(1), { value: label, bold: true });
        for (const c of [2, 3, 4]) put(row.getCell(c), { value: null });
        put(row.getCell(5), { value: est, fmt: MONEY_FMT, bold: true });
        ks.forEach((k, pos) => {
            const c = colOf(pos, 0);
            put(row.getCell(c), values(k));
            put(row.getCell(c + 1), { value: null });
            put(row.getCell(c + 2), { value: null });
            if (merge) ws.mergeCells(r, c, r, c + 2);
        });
        r += 1;
    };
    const bidder = (k: number) => leveling.bidders[k];
    footer(t('buyer.xlsx.total'), leveling.estimateTotal, k => ({ value: bidder(k)?.total ?? null, fmt: MONEY_FMT, bold: true, align: 'right' }));
    footer(t('buyer.xlsx.normalizedTotal'), leveling.estimateTotal, k => ({
        value: bidder(k)?.normalizedTotal ?? null, fmt: MONEY_FMT, bold: true, align: 'right', fill: toneArgb(bidder(k)?.flag ?? null),
    }));
    footer(t('buyer.xlsx.diffFromEstimate'), null, k => {
        const b = bidder(k);
        return { value: b === undefined ? null : bidderDiffPct(b), fmt: PCT_FMT, align: 'right' };
    });
    footer(t('buyer.xlsx.days'), null, k => ({ value: bidder(k)?.days ?? null, align: 'right' }));
    footer(t('buyer.xlsx.canStart'), null, k => ({ value: fmtDay(bidder(k)?.earliestStart), align: 'right' }));
    footer(t('buyer.xlsx.crew'), null, k => ({ value: crewText(bidder(k)), align: 'right' }));
    footer(t('buyer.xlsx.validUntil'), null, k => ({
        value: `${fmtDay(bidder(k)?.validUntil)}${bidder(k)?.expired === true ? t('buyer.xlsx.expired') : ''}`, align: 'right',
    }));
    footer(t('buyer.xlsx.paymentStages'), null, k => {
        const p = bidder(k)?.installmentsProposal ?? null;
        return { value: p === null ? t('buyer.xlsx.asWeSet') : t('buyer.xlsx.proposed', { stages: installmentsText(p) }), align: 'right' };
    });
    footer(t('buyer.xlsx.tier'), null, k => ({ value: bidder(k)?.tier ?? t('buyer.xlsx.noAccount'), align: 'right' }));
    footer(t('buyer.xlsx.rating'), null, k => {
        const rating = bidder(k)?.ratingFromUs ?? null;
        return { value: rating === null ? '–' : `${rating.toFixed(1)} / 5`, align: 'right' };
    });
    leveling.questions.forEach((q, qi) => {
        footer(q, null, k => ({ value: bidder(k)?.answers[qi] ?? '', align: 'left' }));
    });
    return wb;
}

function crewText(b: LevelingDto['bidders'][number] | undefined): string {
    if (b === undefined || (b.crewSkilled === null && b.crewLabourers === null)) return '–';
    return `${String(b.crewSkilled ?? 0)} / ${String(b.crewLabourers ?? 0)}`;
}

/** Downloads the comparison (browser only). */
export async function downloadLevelingXlsx(leveling: LevelingDto, title: string, order: BidderOrder): Promise<void> {
    const wb = await levelingWorkbook(leveling, title, order);
    const buffer = await wb.xlsx.writeBuffer();
    const { saveAs } = await import('file-saver');
    saveAs(new Blob([buffer], { type: XLSX_MIME }), levelingFileName(title));
}
