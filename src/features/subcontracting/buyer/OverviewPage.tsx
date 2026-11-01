'use client';

// ─── /subcontracting: what of the open project is sourced, what it costs against the BOQ, what needs doing (plan §4.1) ───
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import Link from 'next/link';
import { Alert, Button, Progress, Table, Tag } from 'antd';
import type { PackageSummaryDto, ProcurementOverviewDto } from '@/shared/contract';
import { spinner } from '@/features/cloud/ui/common';
import { fmtDateTime, money0, pct, sourcingModeLabel, tradeName } from './format';
import { isModuleDisabled } from '../contracts/logic';
import { ModuleOffState, useBuyerRights } from '../contracts/ui';
import { useBuyerContext, useOverview, usePackages } from './hooks';
import { tradeRowsView, tradeStatusMeta, type TradeRowView } from './overview-model';
import { Card, NoProjectState, Num, PackageStatusTag, PageHead, ScPage } from './ui';

/** Other pages of the module (contracts side is D2's); quiet links, the one primary action stays "Create package". */
const SECONDARY_LINKS: { href: string; key: 'linkContracts' | 'linkCrewRegister' | 'linkRetention' | 'linkReport' | 'linkSettings'; prices?: boolean }[] = [
    { href: '/subcontracting/contracts', key: 'linkContracts' },
    { href: '/subcontracting/vendors', key: 'linkCrewRegister' },
    { href: '/subcontracting/retention', key: 'linkRetention' },
    { href: '/subcontracting/report', key: 'linkReport', prices: true },
    { href: '/subcontracting/settings', key: 'linkSettings' },
];

export function OverviewPage() {
    return (
        <ScPage next="/subcontracting">
            <OverviewContent />
        </ScPage>
    );
}

function OverviewContent() {
    const tx = useTranslations('subcontracting');
    const toText = useErrorMessage();
    const { project } = useBuyerContext();
    // Rights of the project's workspace, widened by its module settings (same helper as the contract screens).
    const rights = useBuyerRights(project?.workspaceId);
    const overview = useOverview(project?.id);
    const packages = usePackages(project?.id);
    if (project === null) {
        return (
            <>
                <PageHead title={tx('buyer.overview.subcontracting')} sub={tx('buyer.overview.sourceCrewsFromTheProject')} />
                <NoProjectState />
            </>
        );
    }
    const mayCreate = rights.may('sc.packages.manage');
    const seesPrices = rights.may('sc.readPrices');
    const create = mayCreate
        ? <Link href="/subcontracting/packages/new"><Button type="primary" size="large">{tx('buyer.overview.createPackage')}</Button></Link>
        : undefined;
    const head = (
        <PageHead title={tx('buyer.overview.subcontracting')} extra={create}
            sub={(
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="text-gray-900">{project.name}</span>
                    {SECONDARY_LINKS.filter(l => l.prices !== true || seesPrices).map(l => (
                        <Link key={l.href} href={l.href} className="text-gray-500 hover:text-orange-600">{tx(`buyer.overview.${l.key}`)}</Link>
                    ))}
                </div>
            )} />
    );
    if (overview.isLoading || packages.isLoading) return <>{head}{spinner}</>;
    if (isModuleDisabled(overview.error) || isModuleDisabled(packages.error)) return <>{head}<ModuleOffState /></>;
    if (overview.isError) {
        return <>{head}<Alert type="error" showIcon title={tx('buyer.overview.couldNotLoadTheOverview')} description={toText(overview.error)} /></>;
    }
    const data = overview.data;
    const list = packages.data ?? [];
    const started = list.length > 0 || (data?.trades.some(t => t.status !== 'not_sourced') ?? false);
    if (data === undefined || !started) return <>{head}<EmptyOverview mayCreate={mayCreate} /></>;
    return (
        <>
            {head}
            <CoverageCard data={data} seesPrices={seesPrices} />
            {data.todo.length > 0 && <TodoCard todo={data.todo} />}
            <TradesCard data={data} seesPrices={seesPrices} />
            <PackagesCard list={list} seesPrices={seesPrices} />
        </>
    );
}

function EmptyOverview({ mayCreate }: { mayCreate: boolean }) {
    const tx = useTranslations('subcontracting');
    return (
        <Card>
            <div className="flex flex-col items-start gap-3 max-w-[560px] py-4">
                <div className="text-card-title font-semibold text-gray-900">{tx('buyer.overview.nothingHasBeenSubcontractedIn')}</div>
                <p className="text-gray-600 m-0">
                    {tx('buyer.overview.pickBoqWorkAsA')}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    {mayCreate && <Link href="/subcontracting/packages/new"><Button type="primary" size="large">{tx('buyer.overview.createTheFirstPackageFrom')}</Button></Link>}
                    <Link href="/subcontracting/vendors" className="text-orange-600 hover:text-orange-700">{tx('buyer.overview.addTheCrewsYouAlready')}</Link>
                </div>
            </div>
        </Card>
    );
}

function CoverageCard({ data, seesPrices }: { data: ProcurementOverviewDto; seesPrices: boolean }) {
    const tx = useTranslations('subcontracting');
    const share = Math.max(0, Math.min(1, data.coverage));
    return (
        <Card>
            <div className="flex flex-col md:flex-row md:items-end gap-4">
                <div className="flex-1 min-w-0">
                    <div className="text-secondary text-gray-600">{tx('buyer.overview.contracted')}</div>
                    <div className="text-figure font-bold text-gray-900 tabular-nums">{pct(share)}</div>
                    <Progress percent={Math.round(share * 1000) / 10} showInfo={false} strokeColor="#16a34a" className="!mb-0" />
                </div>
                {seesPrices && (
                    <div className="flex gap-8 shrink-0">
                        <Figure label={tx('buyer.overview.estimatedLabourBoq')} value={data.estimateTotal} />
                        <Figure label={tx('buyer.overview.agreedPrice')} value={data.contractedTotal} />
                    </div>
                )}
            </div>
        </Card>
    );
}

function Figure({ label, value }: { label: string; value: number }) {
    const tx = useTranslations('subcontracting');
    return (
        <div className="text-right">
            <div className="text-secondary text-gray-600">{label}</div>
            <div className="text-card-title font-semibold tabular-nums">{money0(value)} <span className="text-secondary font-normal text-gray-500">{tx('buyer.overview.thb')}</span></div>
        </div>
    );
}

function TodoCard({ todo }: { todo: ProcurementOverviewDto['todo'] }) {
    const tx = useTranslations('subcontracting');
    return (
        <Card title={tx('buyer.overview.toDo')} extra={<span className="text-secondary text-gray-500">{todo.length} {tx('buyer.overview.items')}</span>}>
            <ul className="flex flex-col divide-y divide-gray-100 m-0 p-0 list-none">
                {todo.map((t, i) => (
                    <li key={`${t.kind}-${String(i)}`} className="py-2 first:pt-0 last:pb-0">
                        <Link href={t.href} className="text-gray-900 hover:text-orange-600">{t.label}</Link>
                    </li>
                ))}
            </ul>
        </Card>
    );
}

function TradesCard({ data, seesPrices }: { data: ProcurementOverviewDto; seesPrices: boolean }) {
    const tx = useTranslations('subcontracting');
    const rows = tradeRowsView(data);
    const columns = [
        {
            title: tx('buyer.overview.trade'), key: 'trade',
            render: (_: unknown, r: TradeRowView) => (
                <div className="min-w-0">
                    <div className="font-medium text-gray-900">{tradeName(r.trade)}</div>
                    {(r.packages.length > 0 || r.subcontracts.length > 0) && (
                        <div className="flex flex-wrap gap-x-3 text-caption">
                            {r.packages.map(p => (
                                <Link key={p.id} href={`/subcontracting/packages/${p.id}`} className="text-gray-500 hover:text-orange-600">{p.title}</Link>
                            ))}
                            {r.subcontracts.map(s => (
                                <Link key={s.id} href={`/subcontracting/contracts/${s.id}`} className="text-gray-500 hover:text-orange-600">{tx('buyer.overview.contract')} {s.vendorName}</Link>
                            ))}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: tx('buyer.overview.status'), key: 'status', width: 170,
            render: (_: unknown, r: TradeRowView) => (
                <div>
                    <Tag color={tradeStatusMeta(r.status, tx).color} className="!m-0">{tradeStatusMeta(r.status, tx).label}</Tag>
                    {r.problem !== null && <div className="text-caption text-red-600 mt-0.5">{r.problem}</div>}
                </div>
            ),
        },
        ...(seesPrices ? [
            {
                title: tx('buyer.overview.estimate'), key: 'est', align: 'right' as const, width: 130,
                render: (_: unknown, r: TradeRowView) => (
                    <div>
                        <Num>{money0(r.estimate)}</Num>
                        {r.scopeEstimate && <div className="text-caption text-gray-500">{tx('buyer.overview.hiredWorkOnly')}</div>}
                    </div>
                ),
            },
            {
                title: tx('buyer.overview.agreed'), key: 'con', align: 'right' as const, width: 130,
                render: (_: unknown, r: TradeRowView) => (r.contracted > 0 ? <Num>{money0(r.contracted)}</Num> : <span className="text-gray-400">–</span>),
            },
            {
                title: tx('buyer.overview.difference'), key: 'diff', align: 'right' as const, width: 110, responsive: ['md' as const],
                render: (_: unknown, r: TradeRowView) => (r.diffPct === null
                    ? <span className="text-gray-400">–</span>
                    : <Num className={r.diffPct > 0 ? 'text-red-600' : 'text-green-600'}>{pct(r.diffPct, true)}</Num>),
            },
        ] : []),
    ];
    return (
        <Card title={tx('buyer.overview.byTrade')}>
            <Table<TradeRowView> rowKey="trade" columns={columns} dataSource={rows} pagination={false} size="middle" scroll={{ x: 640 }} />
        </Card>
    );
}

function PackagesCard({ list, seesPrices }: { list: PackageSummaryDto[]; seesPrices: boolean }) {
    const tx = useTranslations('subcontracting');
    if (list.length === 0) return null;
    const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const columns = [
        {
            title: tx('buyer.overview.package'), key: 'title',
            render: (_: unknown, p: PackageSummaryDto) => (
                <div className="min-w-0">
                    <Link href={`/subcontracting/packages/${p.id}`} className="font-medium text-gray-900 hover:text-orange-600">{p.title}</Link>
                    <div className="text-caption text-gray-500">{tradeName(p.trade)} · {sourcingModeLabel(p.sourcingMode)}{p.version > 1 ? tx('buyer.overview.version', { version: p.version }) : ''}</div>
                </div>
            ),
        },
        { title: tx('buyer.overview.status'), key: 'status', width: 150, render: (_: unknown, p: PackageSummaryDto) => <PackageStatusTag status={p.status} /> },
        {
            title: tx('buyer.overview.recipients'), key: 'inv', width: 150, responsive: ['md' as const],
            render: (_: unknown, p: PackageSummaryDto) => (p.invitations.total === 0
                ? <span className="text-gray-400">{tx('buyer.overview.notSentYet')}</span>
                : <span className="text-secondary">{tx('buyer.overview.pricesSubmitted')} {p.invitations.submitted}/{p.invitations.total} {tx('buyer.overview.bidders')}</span>),
        },
        {
            title: tx('buyer.overview.bidsClose'), key: 'deadline', width: 150, responsive: ['lg' as const],
            render: (_: unknown, p: PackageSummaryDto) => <span className="text-secondary">{fmtDateTime(p.bidDeadline)}</span>,
        },
        ...(seesPrices ? [{
            title: tx('buyer.overview.estimateLowest'), key: 'money', align: 'right' as const, width: 170,
            render: (_: unknown, p: PackageSummaryDto) => (
                <div>
                    <Num>{money0(p.estimateTotal)}</Num>
                    <div className="text-caption text-gray-500 tabular-nums">{p.bestBidTotal === null ? '–' : money0(p.bestBidTotal)}</div>
                </div>
            ),
        }] : []),
    ];
    return (
        <Card title={tx('buyer.overview.packages')} extra={<span className="text-secondary text-gray-500">{list.length} {tx('buyer.overview.packages2')}</span>}>
            <Table<PackageSummaryDto> rowKey="id" columns={columns} dataSource={sorted} pagination={false} size="middle" scroll={{ x: 640 }} />
        </Card>
    );
}
