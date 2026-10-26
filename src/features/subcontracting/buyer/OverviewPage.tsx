'use client';

// ─── /subcontracting: what of the open project is sourced, what it costs against the BOQ, what needs doing (plan §4.1) ───
import Link from 'next/link';
import { Alert, Button, Progress, Table, Tag } from 'antd';
import type { PackageSummaryDto, ProcurementOverviewDto } from '@/shared/contract';
import { tradeLabel } from '@/domain/subcontracting/trades';
import { thaiErrorMessage } from '@/features/cloud/api/errors';
import { spinner } from '@/features/cloud/ui/common';
import { fmtDateTime, money0, pct, SOURCING_MODE_LABEL } from './format';
import { isModuleDisabled } from '../contracts/logic';
import { ModuleOffState, useBuyerRights } from '../contracts/ui';
import { useBuyerContext, useOverview, usePackages } from './hooks';
import { tradeRowsView, TRADE_STATUS_META, type TradeRowView } from './overview-model';
import { Card, NoProjectState, Num, PackageStatusTag, PageHead, ScPage } from './ui';

/** Other pages of the module (contracts side is D2's); quiet links, the one primary action stays "สร้างแพ็กเกจ". */
const SECONDARY_LINKS: { href: string; label: string; prices?: boolean }[] = [
    { href: '/subcontracting/contracts', label: 'สัญญา' },
    { href: '/subcontracting/vendors', label: 'ทะเบียนทีมช่าง' },
    { href: '/subcontracting/retention', label: 'เงินประกันผลงาน' },
    { href: '/subcontracting/report', label: 'รายงาน', prices: true },
    { href: '/subcontracting/settings', label: 'ตั้งค่า' },
];

export function OverviewPage() {
    return (
        <ScPage next="/subcontracting">
            <OverviewContent />
        </ScPage>
    );
}

function OverviewContent() {
    const { project } = useBuyerContext();
    // Rights of the project's workspace, widened by its module settings (same helper as the contract screens).
    const rights = useBuyerRights(project?.workspaceId);
    const overview = useOverview(project?.id);
    const packages = usePackages(project?.id);
    if (project === null) {
        return (
            <>
                <PageHead title="จ้างช่วง" sub="จัดหาทีมช่างจาก BOQ ของโครงการ เทียบราคากับค่าแรงที่ประเมินไว้" />
                <NoProjectState />
            </>
        );
    }
    const mayCreate = rights.may('sc.packages.manage');
    const seesPrices = rights.may('sc.readPrices');
    const create = mayCreate
        ? <Link href="/subcontracting/packages/new"><Button type="primary" size="large">สร้างแพ็กเกจ</Button></Link>
        : undefined;
    const head = (
        <PageHead title="จ้างช่วง" extra={create}
            sub={(
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="text-gray-900">{project.name}</span>
                    {SECONDARY_LINKS.filter(l => l.prices !== true || seesPrices).map(l => (
                        <Link key={l.href} href={l.href} className="text-gray-500 hover:text-orange-600">{l.label}</Link>
                    ))}
                </div>
            )} />
    );
    if (overview.isLoading || packages.isLoading) return <>{head}{spinner}</>;
    if (isModuleDisabled(overview.error) || isModuleDisabled(packages.error)) return <>{head}<ModuleOffState /></>;
    if (overview.isError) {
        return <>{head}<Alert type="error" showIcon title="โหลดภาพรวมไม่สำเร็จ" description={thaiErrorMessage(overview.error)} /></>;
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
    return (
        <Card>
            <div className="flex flex-col items-start gap-3 max-w-[560px] py-4">
                <div className="text-card-title font-semibold text-gray-900">ยังไม่ได้จ้างช่วงงานในโครงการนี้</div>
                <p className="text-gray-600 m-0">
                    เลือกงานจาก BOQ เป็นแพ็กเกจ ส่งลิงก์ให้ทีมช่างเสนอราคา แล้วเทียบกับค่าแรงที่ประเมินไว้แถวต่อแถว
                    ทีมช่างไม่ต้องมีบัญชีก่อน ตอบผ่านลิงก์ได้เลย
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    {mayCreate && <Link href="/subcontracting/packages/new"><Button type="primary" size="large">สร้างแพ็กเกจแรกจาก BOQ</Button></Link>}
                    <Link href="/subcontracting/vendors" className="text-orange-600 hover:text-orange-700">เพิ่มทีมช่างที่รู้จักก่อน</Link>
                </div>
            </div>
        </Card>
    );
}

function CoverageCard({ data, seesPrices }: { data: ProcurementOverviewDto; seesPrices: boolean }) {
    const share = Math.max(0, Math.min(1, data.coverage));
    return (
        <Card>
            <div className="flex flex-col md:flex-row md:items-end gap-4">
                <div className="flex-1 min-w-0">
                    <div className="text-secondary text-gray-600">ทำสัญญาแล้ว</div>
                    <div className="text-figure font-bold text-gray-900 tabular-nums">{pct(share)}</div>
                    <Progress percent={Math.round(share * 1000) / 10} showInfo={false} strokeColor="#16a34a" className="!mb-0" />
                </div>
                {seesPrices && (
                    <div className="flex gap-8 shrink-0">
                        <Figure label="ค่าแรงประเมิน (BOQ)" value={data.estimateTotal} />
                        <Figure label="ราคาที่ตกลงแล้ว" value={data.contractedTotal} />
                    </div>
                )}
            </div>
        </Card>
    );
}

function Figure({ label, value }: { label: string; value: number }) {
    return (
        <div className="text-right">
            <div className="text-secondary text-gray-600">{label}</div>
            <div className="text-card-title font-semibold tabular-nums">{money0(value)} <span className="text-secondary font-normal text-gray-500">บาท</span></div>
        </div>
    );
}

function TodoCard({ todo }: { todo: ProcurementOverviewDto['todo'] }) {
    return (
        <Card title="ต้องทำ" extra={<span className="text-secondary text-gray-500">{todo.length} รายการ</span>}>
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
    const rows = tradeRowsView(data);
    const columns = [
        {
            title: 'ประเภทงาน', key: 'trade',
            render: (_: unknown, r: TradeRowView) => (
                <div className="min-w-0">
                    <div className="font-medium text-gray-900">{tradeLabel(r.trade)}</div>
                    {(r.packages.length > 0 || r.subcontracts.length > 0) && (
                        <div className="flex flex-wrap gap-x-3 text-caption">
                            {r.packages.map(p => (
                                <Link key={p.id} href={`/subcontracting/packages/${p.id}`} className="text-gray-500 hover:text-orange-600">{p.title}</Link>
                            ))}
                            {r.subcontracts.map(s => (
                                <Link key={s.id} href={`/subcontracting/contracts/${s.id}`} className="text-gray-500 hover:text-orange-600">สัญญา {s.vendorName}</Link>
                            ))}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: 'สถานะ', key: 'status', width: 170,
            render: (_: unknown, r: TradeRowView) => (
                <div>
                    <Tag color={TRADE_STATUS_META[r.status].color} className="!m-0">{TRADE_STATUS_META[r.status].label}</Tag>
                    {r.problem !== null && <div className="text-caption text-red-600 mt-0.5">{r.problem}</div>}
                </div>
            ),
        },
        ...(seesPrices ? [
            {
                title: 'ประเมิน', key: 'est', align: 'right' as const, width: 130,
                render: (_: unknown, r: TradeRowView) => (
                    <div>
                        <Num>{money0(r.estimate)}</Num>
                        {r.scopeEstimate && <div className="text-caption text-gray-500">เฉพาะงานที่จ้างแล้ว</div>}
                    </div>
                ),
            },
            {
                title: 'ตกลงแล้ว', key: 'con', align: 'right' as const, width: 130,
                render: (_: unknown, r: TradeRowView) => (r.contracted > 0 ? <Num>{money0(r.contracted)}</Num> : <span className="text-gray-400">–</span>),
            },
            {
                title: 'ต่าง', key: 'diff', align: 'right' as const, width: 110, responsive: ['md' as const],
                render: (_: unknown, r: TradeRowView) => (r.diffPct === null
                    ? <span className="text-gray-400">–</span>
                    : <Num className={r.diffPct > 0 ? 'text-red-600' : 'text-green-600'}>{pct(r.diffPct, true)}</Num>),
            },
        ] : []),
    ];
    return (
        <Card title="ตามประเภทงาน">
            <Table<TradeRowView> rowKey="trade" columns={columns} dataSource={rows} pagination={false} size="middle" scroll={{ x: 640 }} />
        </Card>
    );
}

function PackagesCard({ list, seesPrices }: { list: PackageSummaryDto[]; seesPrices: boolean }) {
    if (list.length === 0) return null;
    const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const columns = [
        {
            title: 'แพ็กเกจ', key: 'title',
            render: (_: unknown, p: PackageSummaryDto) => (
                <div className="min-w-0">
                    <Link href={`/subcontracting/packages/${p.id}`} className="font-medium text-gray-900 hover:text-orange-600">{p.title}</Link>
                    <div className="text-caption text-gray-500">{tradeLabel(p.trade)} · {SOURCING_MODE_LABEL[p.sourcingMode]}{p.version > 1 ? ` · ฉบับที่ ${String(p.version)}` : ''}</div>
                </div>
            ),
        },
        { title: 'สถานะ', key: 'status', width: 150, render: (_: unknown, p: PackageSummaryDto) => <PackageStatusTag status={p.status} /> },
        {
            title: 'ผู้รับ', key: 'inv', width: 150, responsive: ['md' as const],
            render: (_: unknown, p: PackageSummaryDto) => (p.invitations.total === 0
                ? <span className="text-gray-400">ยังไม่ส่ง</span>
                : <span className="text-secondary">ส่งราคา {p.invitations.submitted}/{p.invitations.total} ราย</span>),
        },
        {
            title: 'ปิดรับ', key: 'deadline', width: 150, responsive: ['lg' as const],
            render: (_: unknown, p: PackageSummaryDto) => <span className="text-secondary">{fmtDateTime(p.bidDeadline)}</span>,
        },
        ...(seesPrices ? [{
            title: 'ประเมิน / ต่ำสุด', key: 'money', align: 'right' as const, width: 170,
            render: (_: unknown, p: PackageSummaryDto) => (
                <div>
                    <Num>{money0(p.estimateTotal)}</Num>
                    <div className="text-caption text-gray-500 tabular-nums">{p.bestBidTotal === null ? '–' : money0(p.bestBidTotal)}</div>
                </div>
            ),
        }] : []),
    ];
    return (
        <Card title="แพ็กเกจ" extra={<span className="text-secondary text-gray-500">{list.length} แพ็กเกจ</span>}>
            <Table<PackageSummaryDto> rowKey="id" columns={columns} dataSource={sorted} pagination={false} size="middle" scroll={{ x: 640 }} />
        </Card>
    );
}
