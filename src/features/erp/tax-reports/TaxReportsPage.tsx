'use client';

// ─── /tax-reports: monthly output / input VAT, ภ.ง.ด.3 / 53, WHT received + one Excel file for the accountant ───
import { useState } from 'react';
import { Alert, App, Button, DatePicker, Skeleton, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import {
    TAX_REPORT_KINDS, can, type TaxReportDto, type TaxReportKind, type TaxReportSummaryDto, type TaxReportTotalsDto,
} from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { EmptyState } from '../shared/EmptyState';
import { ErpPage } from '../shared/ErpPage';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { taxReportsApi } from './api';
import { useTaxReport, useTaxSummary } from './hooks';
import { KIND_KEY, ReportTable, useTaxLabels } from './ReportTable';
import { downloadTaxXlsx } from './xlsx';

type Tab = TaxReportKind | 'summary';

/** The previous month in Bangkok (what is filed this month). */
const defaultMonth = (): string => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    return dayjs(`${today.slice(0, 7)}-01`).subtract(1, 'month').format('YYYY-MM');
};

function ReportTab({ workspaceId, kind, month }: { workspaceId: string | undefined; kind: TaxReportKind; month: string }) {
    const t = useTranslations('taxReports');
    const toText = useErrorMessage();
    const q = useTaxReport(workspaceId, kind, month);
    return (
        <SectionCard>
            <p className="text-[13px] text-gray-500 mb-3">{t(`hints.${KIND_KEY[kind]}`)}</p>
            {q.isError ? (
                <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(q.error)}`} action={<Button size="small" onClick={() => { void q.refetch(); }}>{t('retry')}</Button>} />
            ) : q.isLoading || q.data === undefined ? <Skeleton active /> : q.data.rows.length === 0 ? (
                <EmptyState title={t('empty.title')} hint={t('empty.hint')} />
            ) : <ReportTable kind={kind} report={q.data} />}
        </SectionCard>
    );
}

interface SummaryRow { key: string; label: string; totals: TaxReportTotalsDto | null; vat?: number; wht?: number; tab?: TaxReportKind; strong?: boolean }

function SummaryTab({ workspaceId, month, onOpen }: { workspaceId: string | undefined; month: string; onOpen: (tab: TaxReportKind) => void }) {
    const t = useTranslations('taxReports');
    const toText = useErrorMessage();
    const q = useTaxSummary(workspaceId, month);
    if (q.isError) {
        return <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(q.error)}`} action={<Button size="small" onClick={() => { void q.refetch(); }}>{t('retry')}</Button>} />;
    }
    if (q.isLoading || q.data === undefined) return <SectionCard><Skeleton active /></SectionCard>;
    const s = q.data;
    const report = (kind: TaxReportKind, totals: TaxReportTotalsDto): SummaryRow => ({ key: kind, label: t(`tabs.${KIND_KEY[kind]}`), totals, tab: kind });
    const rows: SummaryRow[] = [
        report('output-vat', s.outputVat),
        report('input-vat', s.inputVat),
        { key: 'vat-payable', label: s.vatPayable < 0 ? t('summary.vatCredit') : t('summary.vatPayable'), totals: null, vat: s.vatPayable, strong: true },
        report('pnd3', s.pnd3),
        report('pnd53', s.pnd53),
        { key: 'wht-remit', label: t('summary.whtToRemit'), totals: null, wht: Math.round((s.pnd3.wht + s.pnd53.wht) * 100) / 100, strong: true },
        report('wht-received', s.whtReceived),
    ];
    const isVat = (r: SummaryRow) => r.tab === 'output-vat' || r.tab === 'input-vat';
    const columns: ColumnsType<SummaryRow> = [
        { key: 'report', title: t('summary.report'), render: (_, r) => <span className={r.strong === true ? 'font-semibold' : ''}>{r.label}</span> },
        { key: 'count', title: t('summary.count'), align: 'right', render: (_, r) => r.totals?.count ?? '' },
        { key: 'base', title: t('summary.base'), align: 'right', render: (_, r) => (r.totals === null || r.tab === 'wht-received' ? null : <MoneyText value={r.totals.net} />) },
        {
            key: 'vat', title: t('summary.vat'), align: 'right',
            render: (_, r) => (r.vat !== undefined ? <MoneyText value={r.vat} className="font-semibold" /> : r.totals !== null && isVat(r) ? <MoneyText value={r.totals.vat} /> : null),
        },
        {
            key: 'wht', title: t('summary.wht'), align: 'right',
            render: (_, r) => (r.wht !== undefined ? <MoneyText value={r.wht} className="font-semibold" /> : r.totals !== null && !isVat(r) ? <MoneyText value={r.totals.wht} /> : null),
        },
        {
            key: 'open', title: '', render: (_, r) => (r.tab === undefined ? null : (
                <Button type="link" size="small" onClick={() => { if (r.tab !== undefined) onOpen(r.tab); }}>{t('summary.open')}</Button>
            )),
        },
    ];
    return (
        <SectionCard>
            <Table<SummaryRow> size="small" rowKey="key" columns={columns} dataSource={rows} pagination={false} scroll={{ x: 'max-content' }} />
        </SectionCard>
    );
}

export function TaxReportsPage() {
    const t = useTranslations('taxReports');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const ws = useErpWorkspace();
    const labels = useTaxLabels();
    const allowed = can(ws.role, 'tax.reports');
    const [month, setMonth] = useState(defaultMonth);
    const [tab, setTab] = useState<Tab>('summary');
    const [exporting, setExporting] = useState(false);
    const workspaceId = allowed ? ws.workspaceId : undefined;

    const exportXlsx = async () => {
        if (workspaceId === undefined) return;
        setExporting(true);
        try {
            const reports = {} as Record<TaxReportKind, TaxReportDto>;
            for (const kind of TAX_REPORT_KINDS) reports[kind] = await taxReportsApi.report(workspaceId, kind, month);
            const summary: TaxReportSummaryDto = await taxReportsApi.summary(workspaceId, month);
            await downloadTaxXlsx(reports, summary, labels, t('fileName', { month }));
        } catch (e) {
            void message.error(toText(e));
        } finally {
            setExporting(false);
        }
    };

    const extra = (
        <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-gray-600">{t('month')}</span>
            <DatePicker picker="month" allowClear={false} format="MM/YYYY" value={dayjs(`${month}-01`)}
                onChange={d => { if (d !== null) setMonth(d.format('YYYY-MM')); }} />
            <Button type="primary" icon={<DownloadOutlined />} loading={exporting} disabled={workspaceId === undefined} onClick={() => { void exportXlsx(); }}>
                {t('export')}
            </Button>
        </div>
    );

    return (
        <ErpPage title={t('title')} subtitle={t('subtitle')} extra={allowed ? extra : undefined}>
            {ws.loading ? <Skeleton active /> : !allowed ? (
                <Alert type="warning" showIcon title={t('noPermission')} />
            ) : (
                <Tabs
                    activeKey={tab}
                    onChange={k => setTab(k as Tab)}
                    destroyOnHidden
                    items={[
                        { key: 'summary', label: t('tabs.summary'), children: <SummaryTab workspaceId={workspaceId} month={month} onOpen={setTab} /> },
                        ...TAX_REPORT_KINDS.map(kind => ({
                            key: kind, label: t(`tabs.${KIND_KEY[kind]}`), children: <ReportTab workspaceId={workspaceId} kind={kind} month={month} />,
                        })),
                    ]}
                />
            )}
        </ErpPage>
    );
}
