'use client';

// ─── One tax report as a table (same columns as the Excel sheet) ───
import Link from 'next/link';
import { Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import type { TaxReportDto, TaxReportKind, TaxReportRowDto } from '@/shared/contract';
import { useFormat } from '@/i18n/useFormat';
import { DateText } from '../shared/DateText';
import { MoneyText } from '../shared/MoneyText';
import { formatTaxId } from '../payables/print-model';
import { whtCertificatePrintHref } from '../payables/status';
import { MONEY_COLUMNS, REPORT_COLUMNS, type ReportColumn, type TaxXlsxLabels } from './xlsx';

/** Message key of a report kind (`output-vat` → `outputVat`). */
export const KIND_KEY = {
    'output-vat': 'outputVat', 'input-vat': 'inputVat', pnd3: 'pnd3', pnd53: 'pnd53', 'wht-received': 'whtReceived',
} as const satisfies Record<TaxReportKind, string>;

const isHeadOffice = (branch: string): boolean => branch.trim() === '' || /^0+$/.test(branch.trim());

/** Headers and cell texts in the UI language (the screen and the Excel file share them). */
export function useTaxLabels(): TaxXlsxLabels {
    const t = useTranslations('taxReports');
    const ti = useTranslations('enums.whtIncomeType');
    const fixed = (kind: TaxReportKind, column: ReportColumn): string => {
        const k = KIND_KEY[kind];
        switch (column) {
            case 'docNumber': return t(`columns.docNumber.${k}`);
            case 'reference': return t(`columns.reference.${k}`);
            case 'counterparty': return t(`columns.counterparty.${k}`);
            case 'net': return kind === 'pnd3' || kind === 'pnd53' ? t('columns.base') : t('columns.net');
            default: return t(`columns.${column}`);
        }
    };
    return {
        sheet: kind => t(`tabs.${kind === 'summary' ? 'summary' : KIND_KEY[kind]}`),
        header: fixed,
        total: t('total'),
        text: (column, row) => {
            switch (column) {
                case 'type': return row.eventType === 'ar.credit_noted' ? t('rowType.creditNote') : t('rowType.taxInvoice');
                case 'branch': return isHeadOffice(row.counterpartyBranch) ? t('headOffice') : row.counterpartyBranch;
                case 'incomeType': return row.incomeType === null ? '' : ti(row.incomeType);
                case 'status': return row.reversesId !== null ? t('reversal') : row.reversed ? t('reversed') : '';
            }
        },
        taxId: formatTaxId,
        summary: {
            report: t('summary.report'), count: t('summary.count'), base: t('summary.base'), vat: t('summary.vat'), wht: t('summary.wht'),
            vatPayable: t('summary.vatPayable'), whtToRemit: t('summary.whtToRemit'),
        },
    };
}

export function ReportTable({ kind, report }: { kind: TaxReportKind; report: TaxReportDto }) {
    const labels = useTaxLabels();
    const fmt = useFormat();
    const cols = REPORT_COLUMNS[kind];
    const rows = report.rows.map((r, i) => ({ ...r, index: i }));
    type Row = TaxReportRowDto & { index: number };

    const render = (c: ReportColumn, r: Row) => {
        const muted = r.reversesId !== null || r.reversed;
        switch (c) {
            case 'no': return r.index + 1;
            case 'date': return <DateText value={r.date} />;
            case 'docNumber':
                return r.sourceType === 'wht_certificate' && r.reversesId === null
                    ? <Link href={whtCertificatePrintHref(r.sourceId)} target="_blank" className="font-medium">{r.docNumber}</Link>
                    : <span className="font-medium">{r.docNumber}</span>;
            case 'reference': return r.reference;
            case 'counterparty': return r.counterpartyName;
            case 'taxId': return <span className="tabular-nums whitespace-nowrap">{formatTaxId(r.counterpartyTaxId)}</span>;
            case 'rate': return r.whtRate === null ? '' : fmt.percent(r.whtRate);
            case 'net': return <MoneyText value={r.net} muted={muted} />;
            case 'vat': return <MoneyText value={r.vat} muted={muted} />;
            case 'wht': return <MoneyText value={r.wht} muted={muted} />;
            case 'status': {
                const text = labels.text('status', r);
                return text === '' ? null : <Tag color={r.reversesId !== null ? 'red' : 'default'}>{text}</Tag>;
            }
            default: return labels.text(c, r);
        }
    };

    const columns: ColumnsType<Row> = cols.map(c => ({
        key: c,
        title: labels.header(kind, c),
        align: MONEY_COLUMNS.has(c) || c === 'no' || c === 'rate' ? 'right' : undefined,
        render: (_: unknown, r: Row) => render(c, r),
    }));

    return (
        <Table<Row>
            size="small" rowKey="eventId" columns={columns} dataSource={rows} scroll={{ x: 'max-content' }}
            pagination={rows.length > 50 ? { pageSize: 50, showSizeChanger: false } : false}
            summary={() => (rows.length === 0 ? null : (
                <Table.Summary.Row className="font-semibold bg-gray-50">
                    {cols.map((c, i) => (
                        <Table.Summary.Cell key={c} index={i} align={MONEY_COLUMNS.has(c) ? 'right' : undefined}>
                            {i === 1 ? labels.total
                                : c === 'net' ? <MoneyText value={report.totals.net} />
                                    : c === 'vat' ? <MoneyText value={report.totals.vat} />
                                        : c === 'wht' ? <MoneyText value={report.totals.wht} /> : null}
                        </Table.Summary.Cell>
                    ))}
                </Table.Summary.Row>
            ))}
        />
    );
}
