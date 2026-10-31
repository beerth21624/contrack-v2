'use client';

// ─── /p/[projectId]: project details, the figures active modules supply, commercial terms, history ───
import { useState } from 'react';
import Link from 'next/link';
import { App, Button, Descriptions, Skeleton, Tag } from 'antd';
import { CalculatorOutlined, CopyOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { HubProjectDetailDto, ProjectRollup } from '@/shared/contract';
import { useFormat } from '@/i18n/useFormat';
import { AuditTimeline } from '../shared/AuditTimeline';
import { DateText } from '../shared/DateText';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { CreateQuotationButton } from '../quotations/CreateFromBoqDialog';
import { HubFieldsDrawer } from './HubFieldsDrawer';
import { useOpenProjectBoq } from './ProjectShell';
import { useHubProject } from './hooks';
import { PROJECT_STATUS_TONES } from './status';

type RollupNumberKey = Exclude<keyof ProjectRollup, 'nextMilestone' | 'alerts'>;
const MONEY_KEYS: readonly RollupNumberKey[] = [
    'contractValue', 'budgetTotal', 'billedToDate', 'receivedToDate', 'overdueReceivable', 'committedOpen', 'actualCost',
    'forecastAtCompletion', 'projectedProfit',
];
const COUNT_KEYS: readonly RollupNumberKey[] = ['openVariations', 'openPurchaseOrders'];

function Period({ start, finish }: { start: string | null; finish: string | null }) {
    if (start === null && finish === null) return <>–</>;
    return <span className="tabular-nums"><DateText value={start} /> – <DateText value={finish} /></span>;
}

function Figures({ rollup }: { rollup: ProjectRollup }) {
    const t = useTranslations('hub');
    const fmt = useFormat();
    const tiles: { key: string; label: string; value: React.ReactNode }[] = [];
    for (const k of MONEY_KEYS) {
        const v = rollup[k];
        if (v !== null) tiles.push({ key: k, label: t(`overview.rollup.${k}`), value: <MoneyText value={v} /> });
    }
    if (rollup.progressPct !== null) tiles.push({ key: 'progressPct', label: t('overview.rollup.progressPct'), value: fmt.percent(rollup.progressPct, 0) });
    for (const k of COUNT_KEYS) {
        const v = rollup[k];
        if (v !== null) tiles.push({ key: k, label: t(`overview.rollup.${k}`), value: fmt.number(v) });
    }
    const m = rollup.nextMilestone;
    if (tiles.length === 0 && m === null && rollup.alerts.length === 0) {
        return <div className="text-gray-500">{t('overview.noFigures')}</div>;
    }
    return (
        <div className="flex flex-col gap-3">
            {tiles.length > 0 && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                    {tiles.map(tile => (
                        <div key={tile.key} className="min-w-0 rounded-card border border-gray-100 bg-gray-50 px-3 py-2">
                            <div className="truncate text-[12px] text-gray-500">{tile.label}</div>
                            <div className="truncate text-[16px] font-semibold text-gray-900 tabular-nums">{tile.value}</div>
                        </div>
                    ))}
                </div>
            )}
            {m !== null && (
                <div className="text-[13px] text-gray-700">
                    <span className="text-gray-500">{t('overview.nextMilestone')}: </span>
                    {m.label} · <DateText value={m.dueDate} /> · <MoneyText value={m.amount} />
                </div>
            )}
            {rollup.alerts.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] text-gray-500">{t('overview.alerts')}:</span>
                    {rollup.alerts.map(a => <Tag key={a} color="warning" className="!m-0">{a}</Tag>)}
                </div>
            )}
        </div>
    );
}

function Terms({ d }: { d: HubProjectDetailDto }) {
    const t = useTranslations('hub');
    const tEnums = useTranslations('enums');
    const fmt = useFormat();
    const s = d.effectiveSettings;
    return (
        <Descriptions size="small" column={{ xs: 1, md: 2 }} items={[
            { key: 'priceSource', label: t('overview.termFields.priceSource'), children: tEnums(`priceSource.${s.priceSource}`) },
            { key: 'quotationFormat', label: t('overview.termFields.quotationFormat'), children: tEnums(`quotationFormat.${s.quotationFormat}`) },
            { key: 'billingMode', label: t('overview.termFields.billingMode'), children: tEnums(`billingMode.${s.billingMode}`) },
            { key: 'advancePct', label: t('overview.termFields.advancePct'), children: fmt.percent(s.advancePct) },
            { key: 'retentionPct', label: t('overview.termFields.retentionPct'), children: fmt.percent(s.retentionPct) },
            { key: 'paymentTermDays', label: t('overview.termFields.paymentTermDays'), children: t('overview.termFields.paymentTermDaysValue', { days: s.paymentTermDays }) },
            { key: 'warrantyMonths', label: t('overview.termFields.warrantyMonths'), children: t('overview.termFields.warrantyMonthsValue', { months: s.warrantyMonths }) },
            { key: 'documentLanguage', label: t('overview.termFields.documentLanguage'), children: t(`overview.languages.${s.documentLanguage}`) },
        ]} />
    );
}

export function ProjectOverviewPage({ projectId }: { projectId: string }) {
    const t = useTranslations('hub');
    const tEnums = useTranslations('enums');
    const { message } = App.useApp();
    const detail = useHubProject(projectId);
    const boq = useOpenProjectBoq(projectId);
    const [editing, setEditing] = useState(false);
    const d = detail.data;
    if (d === undefined) return <Skeleton active />;
    const h = d.hub;

    const copyToBoq = () => {
        const meta: { ownerName?: string; siteAddress?: string } = {};
        if (d.customerName !== null && d.customerName !== '') meta.ownerName = d.customerName;
        if (h.siteAddress !== '') meta.siteAddress = h.siteAddress;
        if (Object.keys(meta).length === 0) { void message.info(t('overview.nothingToCopy')); return; }
        void boq.open(meta).then(ok => { if (ok) void message.success(t('overview.copied')); });
    };

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <SectionCard
                title={t('overview.details')}
                extra={d.canEdit ? <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>{t('overview.edit')}</Button> : undefined}
            >
                <Descriptions size="small" column={{ xs: 1, md: 2 }} items={[
                    { key: 'code', label: t('overview.fields.code'), children: h.code ?? t('noCode') },
                    { key: 'status', label: t('overview.fields.status'), children: <StatusTag enumName="projectStatus" value={h.status} tones={PROJECT_STATUS_TONES} /> },
                    { key: 'type', label: t('overview.fields.projectType'), children: tEnums(`projectType.${d.effectiveProjectType}`) },
                    {
                        key: 'customer', label: t('overview.fields.customer'),
                        children: h.customerId !== null
                            ? <Link href={`/customers/${encodeURIComponent(h.customerId)}`}>{d.customerName ?? h.customerId}</Link>
                            : t('noCustomer'),
                    },
                    { key: 'site', label: t('overview.fields.siteAddress'), children: h.siteAddress === '' ? '–' : <span className="whitespace-pre-line break-words">{h.siteAddress}</span> },
                    { key: 'manager', label: t('overview.fields.manager'), children: d.managerName ?? '–' },
                    { key: 'planned', label: t('overview.fields.planned'), children: <Period start={h.plannedStart} finish={h.plannedFinish} /> },
                    { key: 'actual', label: t('overview.fields.actual'), children: <Period start={h.actualStart} finish={h.actualFinish} /> },
                    { key: 'created', label: t('overview.fields.created'), children: <DateText value={d.project.createdAt} /> },
                    ...(h.description !== '' ? [{ key: 'description', label: t('overview.fields.description'), span: 'filled' as const, children: <span className="whitespace-pre-line break-words">{h.description}</span> }] : []),
                ]} />
                <div className="mt-4 flex flex-wrap gap-2">
                    <Button type="primary" icon={<CalculatorOutlined />} loading={boq.opening} onClick={() => { void boq.open(); }}>{t('overview.openBoq')}</Button>
                    {d.canEdit && (
                        <Button icon={<CopyOutlined />} disabled={boq.opening} onClick={copyToBoq}>{t('overview.copyToBoq')}</Button>
                    )}
                    <CreateQuotationButton projectId={projectId} workspaceId={d.project.workspaceId} />
                </div>
            </SectionCard>

            <SectionCard title={t('overview.figures')}>
                <Figures rollup={d.rollup} />
            </SectionCard>

            <SectionCard title={t('overview.terms')} extra={<span className="text-[12px] text-gray-500">{t('overview.termsHint')}</span>}>
                <Terms d={d} />
            </SectionCard>

            <AuditTimeline entityType="project" entityId={projectId} workspaceId={d.project.workspaceId} />

            <HubFieldsDrawer projectId={projectId} open={editing} onClose={() => setEditing(false)} />
        </div>
    );
}
