'use client';

// ─── /p/<id>/cost: budget vs committed vs actual vs forecast per BOQ section / cost code, profit, alerts, project cash ───
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Alert, App, Button, Segmented, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import { can, type JobCostLineDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useBaseline, useBoqVersion } from '../boq-control/hooks';
import { EmptyState } from '../shared/EmptyState';
import { ErpPage } from '../shared/ErpPage';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { AlertsList } from './AlertsList';
import { CashFlowChart } from './CashFlowChart';
import { CostChart } from './CostChart';
import { CostTable } from './CostTable';
import { downloadCostXlsx } from './ExportCostXlsx';
import { ForecastEditor } from './ForecastEditor';
import { useJobCostReport, useProjectCashFlow } from './hooks';
import { LedgerDrawer, type LedgerTarget } from './LedgerDrawer';
import { ProfitCard } from './ProfitCard';

export function JobCostPage({ projectId }: { projectId: string }) {
    const t = useTranslations('jobCost');
    const te = useTranslations('enums');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const ws = useErpWorkspace();
    const allowed = can(ws.role, 'cost.read');
    const report = useJobCostReport(allowed ? projectId : undefined);
    const baseline = useBaseline(allowed ? projectId : undefined);
    const version = useBoqVersion(baseline.data?.baseline?.versionId);
    const [ledger, setLedger] = useState<LedgerTarget | null>(null);
    const [forecast, setForecast] = useState<JobCostLineDto | null>(null);
    const [horizon, setHorizon] = useState(13);
    const cash = useProjectCashFlow(allowed ? projectId : undefined, horizon, 4);
    const [exporting, setExporting] = useState(false);

    const sectionTitles = useMemo(
        () => new Map((version.data?.sections ?? []).map(s => [s.sectionNo, s.titleTh])),
        [version.data],
    );

    if (ws.loading) return <ErpPage><Skeleton active /></ErpPage>;
    if (!allowed) return <ErpPage title={t('title')}><Alert type="warning" showIcon title={t('noAccess')} /></ErpPage>;

    const data = report.data;
    const openCode = (costCodeId: string) => {
        const l = data?.lines.find(x => x.costCodeId === costCodeId);
        if (l !== undefined) setLedger({ costCodeId, title: `${l.code} ${l.descTh}` });
    };

    const doExport = async () => {
        if (data === undefined) return;
        setExporting(true);
        try {
            await downloadCostXlsx(data, sectionTitles, {
                sheet: t('export.sheet'),
                section: (no, title) => `${t('table.section', { no })}${title !== undefined && title !== '' ? ` · ${title}` : ''}`,
                unassigned: t('table.unassigned'),
                total: t('table.total'),
                columns: {
                    code: t('export.code'), description: t('table.columns.name'), unit: t('table.columns.unit'), budget: t('table.columns.budget'),
                    committed: t('table.columns.committed'), actual: t('table.columns.actual'), eac: t('table.columns.eac'),
                    variance: t('table.columns.variance'), progress: t('table.columns.progress'), level: t('table.columns.level'),
                },
                level: l => te(`costLevel.${l as 'ok' | 'warning' | 'critical'}`),
            }, `job-cost_${projectId.slice(0, 8)}`);
        } catch (err) {
            void message.error(toText(err));
        } finally {
            setExporting(false);
        }
    };

    return (
        <ErpPage
            title={t('title')}
            subtitle={t('subtitle')}
            extra={(
                <>
                    <Link href="/finance/cashflow" className="text-[13px]">{t('openCompanyCash')}</Link>
                    <Button onClick={() => void doExport()} loading={exporting} disabled={data === undefined || data.lines.length === 0}>{t('export.button')}</Button>
                </>
            )}
        >
            {report.isError ? <Alert type="error" showIcon title={toText(report.error)} />
                : data === undefined ? <Skeleton active />
                    : (
                        <>
                            {!data.baselineLocked && <Alert type="info" showIcon title={t('noBaseline')} />}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <ProfitCard profit={data.profit} />
                                <AlertsList alerts={data.alerts} onOpenCode={openCode} />
                            </div>
                            <SectionCard title={t('summary.title')} extra={<span className="text-[12px] text-gray-500">{t(`progressSource.${data.progressSource}`)}</span>}>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                                    <Stat label={t('table.columns.budget')} value={data.totals.budget} />
                                    <Stat label={t('table.columns.committed')} value={data.totals.committedOpen + data.unassigned.committedOpen} />
                                    <Stat label={t('table.columns.actual')} value={data.totals.actual + data.unassigned.actual} />
                                    <Stat label={t('table.columns.eac')} value={data.totals.eac + data.unassigned.committedOpen + data.unassigned.actual} />
                                    <Stat label={t('table.columns.variance')} value={data.totals.budget - data.totals.eac - data.unassigned.committedOpen - data.unassigned.actual} signed />
                                </div>
                                {data.sections.length > 0
                                    ? <CostChart sections={data.sections} sectionTitles={sectionTitles} />
                                    : <EmptyState title={t('noBaseline')} />}
                            </SectionCard>
                            <SectionCard title={t('table.title')}>
                                <CostTable
                                    report={data}
                                    sectionTitles={sectionTitles}
                                    canManage={can(ws.role, 'cost.manage')}
                                    onLedger={(costCodeId, title) => setLedger({ costCodeId, title })}
                                    onForecast={setForecast}
                                />
                            </SectionCard>
                            <SectionCard
                                title={t('cash.projectTitle')}
                                extra={<Segmented<number> value={horizon} onChange={setHorizon} options={[{ value: 13, label: t('cash.weeksN', { n: 13 }) }, { value: 26, label: t('cash.weeksN', { n: 26 }) }, { value: 52, label: t('cash.weeksN', { n: 52 }) }]} />}
                            >
                                {cash.isError ? <Alert type="error" showIcon title={toText(cash.error)} />
                                    : cash.data === undefined ? <Skeleton active />
                                        : <CashFlowChart data={cash.data} />}
                            </SectionCard>
                        </>
                    )}
            <LedgerDrawer projectId={projectId} target={ledger} onClose={() => setLedger(null)} />
            <ForecastEditor projectId={projectId} line={forecast} onClose={() => setForecast(null)} />
        </ErpPage>
    );
}

function Stat({ label, value, signed = false }: { label: string; value: number; signed?: boolean }) {
    return (
        <div className="min-w-0">
            <div className="text-[12px] text-gray-500">{label}</div>
            <div className="text-[18px] font-semibold"><MoneyText value={value} className={signed && value < 0 ? 'text-red-600' : ''} /></div>
        </div>
    );
}
