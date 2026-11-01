'use client';

// ─── Closeout tab of the handover page: estimate vs actual per BOQ section, chart, profit, billing, lessons, finalize ───
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Alert, App, Button, Input, Modal, Skeleton, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckCircleOutlined, PrinterOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import { can, type CloseoutDto, type CloseoutSectionDto, type Role } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useFormat } from '@/i18n/useFormat';
import { useBaseline, useBoqVersion } from '../boq-control/hooks';
import { CHART_M as M, CHART_W as W, COLORS, compactNumber, niceTicks } from '../job-cost/chart-utils';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { useCloseout, useFinalizeCloseout, usePatchCloseout } from './hooks';

export const closeoutPrintHref = (projectId: string): string => `/print/closeout/${encodeURIComponent(projectId)}`;

/** Section titles of the project's baseline (the BOQ template's Thai titles). */
export function useSectionTitles(projectId: string | undefined): ReadonlyMap<number, string> {
    const baseline = useBaseline(projectId);
    const version = useBoqVersion(baseline.data?.baseline?.versionId);
    return useMemo(() => new Map((version.data?.sections ?? []).map(s => [s.sectionNo, s.titleTh])), [version.data]);
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="min-w-0">
            <div className="text-[12px] text-gray-500">{label}</div>
            <div className="text-[18px] font-semibold text-gray-900 break-words">{children}</div>
        </div>
    );
}

const H = 280;

function CloseoutChart({ sections }: { sections: readonly CloseoutSectionDto[] }) {
    const t = useTranslations('handover.closeout');
    const locale = useLocale();
    const fmt = useFormat();
    if (sections.length === 0) return null;
    const series = [
        { key: 'estimate', color: COLORS.estimate, label: t('chart.estimate'), pick: (s: CloseoutSectionDto) => s.estimate },
        { key: 'budget', color: COLORS.budget, label: t('chart.budget'), pick: (s: CloseoutSectionDto) => s.budget },
        { key: 'actual', color: COLORS.actual, label: t('chart.actual'), pick: (s: CloseoutSectionDto) => s.actual.total },
    ] as const;
    const max = Math.max(1, ...sections.flatMap(s => series.map(x => x.pick(s))));
    const ticks = niceTicks(0, max);
    const top = Math.max(ticks[ticks.length - 1] ?? max, max);
    const plotW = W - M.left - M.right;
    const plotH = H - M.top - M.bottom;
    const y = (v: number) => M.top + (1 - Math.max(0, v) / top) * plotH;
    const gw = plotW / sections.length;
    const bw = Math.max(3, Math.min(24, (gw * 0.8) / series.length));
    const base = y(0);
    return (
        <div>
            <div className="flex flex-wrap gap-4 text-[12px] text-gray-700 mb-1">
                {series.map(s => (
                    <span key={s.key} className="flex items-center gap-1.5">
                        <span style={{ width: 10, height: 10, background: s.color, borderRadius: 2, display: 'inline-block' }} />{s.label}
                    </span>
                ))}
            </div>
            <svg viewBox={`0 0 ${String(W)} ${String(H)}`} className="w-full h-auto" role="img" aria-label={t('chart.label')}>
                {ticks.map(v => (
                    <g key={v}>
                        <line x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} stroke={COLORS.grid} />
                        <text x={M.left - 6} y={y(v) + 4} fontSize={11} textAnchor="end" fill={COLORS.muted}>{compactNumber(v, locale)}</text>
                    </g>
                ))}
                {sections.map((s, i) => {
                    const x0 = M.left + i * gw + (gw - bw * series.length) / 2;
                    const label = s.sectionNo === null ? '–' : String(s.sectionNo);
                    return (
                        <g key={label}>
                            {series.map((x, k) => (
                                <rect key={x.key} x={x0 + k * bw} y={y(x.pick(s))} width={bw - 1} height={Math.max(0, base - y(x.pick(s)))} fill={x.color} />
                            ))}
                            <text x={M.left + i * gw + gw / 2} y={H - M.bottom + 16} fontSize={11} textAnchor="middle" fill={COLORS.ink2}>{label}</text>
                            <rect x={M.left + i * gw} y={M.top} width={gw} height={plotH} fill="transparent">
                                <title>{[
                                    s.sectionNo === null ? t('table.unassigned') : t('table.sectionNo', { no: s.sectionNo }),
                                    ...series.map(x => `${x.label}: ${fmt.money(x.pick(s))}`),
                                ].join('\n')}</title>
                            </rect>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

type Row = CloseoutSectionDto & { key: string; isTotal?: boolean };

function SectionsTable({ dto, titles }: { dto: CloseoutDto; titles: ReadonlyMap<number, string> }) {
    const t = useTranslations('handover.closeout.table');
    const { summary } = dto;
    const rows: Row[] = summary.sections.map(s => ({ ...s, key: s.sectionNo === null ? 'unassigned' : `s${String(s.sectionNo)}` }));
    const total: Row = { key: 'total', isTotal: true, sectionNo: null, lineCount: 0, ...summary.totals };
    const money = (v: number, r: Row) => <MoneyText value={v} className={r.isTotal === true ? 'font-semibold' : ''} />;
    const columns: ColumnsType<Row> = [
        {
            key: 'section', title: t('section'), fixed: 'left', width: 220,
            render: (_, r) => {
                if (r.isTotal === true) return <span className="font-semibold">{t('total')}</span>;
                if (r.sectionNo === null) return <span className="text-gray-600">{t('unassigned')}</span>;
                const title = titles.get(r.sectionNo);
                return `${t('sectionNo', { no: r.sectionNo })}${title !== undefined && title !== '' ? ` · ${title}` : ''}`;
            },
        },
        { key: 'estimate', title: t('estimate'), align: 'right', render: (_, r) => money(r.estimate, r) },
        { key: 'budget', title: t('budget'), align: 'right', render: (_, r) => money(r.budget, r) },
        { key: 'material', title: t('material'), align: 'right', render: (_, r) => money(r.actual.material, r) },
        { key: 'labour', title: t('labour'), align: 'right', render: (_, r) => money(r.actual.labour, r) },
        { key: 'subcontract', title: t('subcontract'), align: 'right', render: (_, r) => money(r.actual.subcontract, r) },
        { key: 'equipment', title: t('equipment'), align: 'right', render: (_, r) => money(r.actual.equipment, r) },
        { key: 'other', title: t('other'), align: 'right', render: (_, r) => money(r.actual.other, r) },
        { key: 'actual', title: t('actual'), align: 'right', render: (_, r) => <MoneyText value={r.actual.total} className="font-semibold" /> },
        {
            key: 'variance', title: t('variance'), align: 'right',
            render: (_, r) => <MoneyText value={r.variance} className={r.variance < 0 ? 'text-red-600 font-semibold' : 'font-semibold'} />,
        },
    ];
    return (
        <Table<Row> size="small" rowKey="key" columns={columns} dataSource={rows.length === 0 ? [] : [...rows, total]} pagination={false}
            scroll={{ x: 1200 }} locale={{ emptyText: t('empty') }} />
    );
}

function FinalizeDialog({ projectId, lessons, onClose }: { projectId: string; lessons: string; onClose: () => void }) {
    const t = useTranslations('handover.closeout');
    const { message } = App.useApp();
    const toText = useErrorMessage();
    const finalize = useFinalizeCloseout(projectId);
    return (
        <Modal open title={t('confirm.title')} okText={t('confirm.ok')} confirmLoading={finalize.isPending} onCancel={onClose} destroyOnHidden
            onOk={() => {
                finalize.mutateAsync({ lessons: lessons.trim() })
                    .then(() => { void message.success(t('confirm.done')); onClose(); })
                    .catch((e: unknown) => { void message.error(toText(e)); });
            }}>
            <Alert type="warning" showIcon title={t('confirm.body')} />
        </Modal>
    );
}

function CloseoutBody({ projectId, dto }: { projectId: string; dto: CloseoutDto }) {
    const t = useTranslations('handover.closeout');
    const fmt = useFormat();
    const { message } = App.useApp();
    const toText = useErrorMessage();
    const titles = useSectionTitles(projectId);
    const patch = usePatchCloseout(projectId);
    const [lessons, setLessons] = useState(dto.lessons);
    const [confirming, setConfirming] = useState(false);
    const s = dto.summary;
    const final = dto.status === 'final';
    const loss = s.profit !== null && s.profit < 0;
    const dirty = lessons.trim() !== dto.lessons;

    const actions = (
        <>
            <Link href={closeoutPrintHref(projectId)} target="_blank"><Button icon={<PrinterOutlined />}>{t('actions.print')}</Button></Link>
            {dto.canEdit && (
                <Button type="primary" icon={<CheckCircleOutlined />} disabled={!dto.canFinalize} onClick={() => setConfirming(true)}>
                    {t('actions.finalize')}
                </Button>
            )}
        </>
    );

    return (
        <div className="flex min-w-0 flex-col gap-4">
            {final && dto.finalizedAt !== null && (
                <Alert type="success" showIcon
                    title={t('finalizedBy', { name: dto.finalizedByName !== '' ? dto.finalizedByName : '–', date: fmt.date(dto.finalizedAt) })}
                    description={t('unitRatesFinal', { count: s.unitRateCount })} />
            )}
            {!final && dto.handoverStatus !== 'accepted' && <Alert type="info" showIcon title={t('needsHandover')} />}
            <SectionCard
                title={(
                    <span className="flex flex-wrap items-center gap-2">
                        {t('title')}
                        <Tag color={final ? 'green' : 'default'}>{final ? t('statusFinal') : t('statusDraft')}</Tag>
                        <span className="text-[12px] font-normal text-gray-500">{t('asOf', { date: fmt.date(dto.asOf) })}</span>
                    </span>
                )}
                extra={actions}
            >
                {s.revenue === null && <Alert type="info" showIcon title={t('kpi.noContract')} className="!mb-3" />}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Stat label={t('kpi.revenue')}><MoneyText value={s.revenue} /></Stat>
                    <Stat label={t('kpi.actual')}><MoneyText value={s.totals.actual.total} /></Stat>
                    <Stat label={t('kpi.profit')}><MoneyText value={s.profit} className={loss ? 'text-red-600' : ''} /></Stat>
                    <Stat label={t('kpi.margin')}>
                        <span className={loss ? 'text-red-600' : ''}>{s.marginPct === null ? '–' : fmt.percent(s.marginPct, 1)}</span>
                    </Stat>
                    {s.quotedMarginPct !== null && <Stat label={t('kpi.quotedMargin')}>{fmt.percent(s.quotedMarginPct, 1)}</Stat>}
                    {s.quotedProfit !== null && <Stat label={t('kpi.quotedProfit')}><MoneyText value={s.quotedProfit} /></Stat>}
                    <Stat label={t('kpi.variance')}>
                        <MoneyText value={s.totals.variance} className={s.totals.variance < 0 ? 'text-red-600' : ''} />
                    </Stat>
                </div>
                {!final && s.unitRateCount > 0 && <div className="mt-3 text-[13px] text-gray-600">{t('unitRates', { count: s.unitRateCount })}</div>}
            </SectionCard>
            <SectionCard title={t('billing.title')}>
                {s.billing === null ? <div className="text-[13px] text-gray-500">{t('billing.off')}</div> : (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <Stat label={t('billing.billed')}><MoneyText value={s.billing.billed} /></Stat>
                        <Stat label={t('billing.received')}><MoneyText value={s.billing.received} /></Stat>
                        <Stat label={t('billing.outstanding')}><MoneyText value={s.billing.outstanding} /></Stat>
                        <Stat label={t('billing.retentionHeld')}><MoneyText value={s.billing.retentionHeld} /></Stat>
                        <Stat label={t('billing.advanceOutstanding')}><MoneyText value={s.billing.advanceOutstanding} /></Stat>
                    </div>
                )}
            </SectionCard>
            <SectionCard title={t('chart.title')}>
                <CloseoutChart sections={s.sections} />
            </SectionCard>
            <SectionCard title={t('table.title')}>
                <SectionsTable dto={dto} titles={titles} />
            </SectionCard>
            <SectionCard
                title={t('lessons.title')}
                extra={dto.canEdit && dirty && (
                    <Button loading={patch.isPending}
                        onClick={() => {
                            patch.mutateAsync({ lessons: lessons.trim() })
                                .then(() => { void message.success(t('lessons.saved')); })
                                .catch((e: unknown) => { void message.error(toText(e)); });
                        }}>
                        {t('lessons.save')}
                    </Button>
                )}
            >
                {dto.canEdit
                    ? <Input.TextArea rows={5} maxLength={20000} value={lessons} placeholder={t('lessons.placeholder')} onChange={e => setLessons(e.target.value)} />
                    : <div className="whitespace-pre-wrap text-[14px]">{dto.lessons !== '' ? dto.lessons : <span className="text-gray-500">{t('lessons.empty')}</span>}</div>}
            </SectionCard>
            {confirming && <FinalizeDialog projectId={projectId} lessons={lessons} onClose={() => setConfirming(false)} />}
        </div>
    );
}

export function CloseoutPanel({ projectId, role }: { projectId: string; role: Role | undefined }) {
    const t = useTranslations('handover');
    const toText = useErrorMessage();
    const allowed = can(role, 'cost.read');
    const q = useCloseout(allowed ? projectId : undefined);
    if (role === undefined) return <Skeleton active />;
    if (!allowed) return <Alert type="warning" showIcon title={t('closeout.noAccess')} />;
    if (q.isLoading) return <Skeleton active />;
    if (q.isError || q.data === undefined) {
        return (
            <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(q.error)}`}
                action={<Button size="small" onClick={() => { void q.refetch(); }}>{t('retry')}</Button>} />
        );
    }
    // Keyed so the lessons draft starts again from the saved text after every save.
    return <CloseoutBody key={q.data.updatedAt ?? 'new'} projectId={projectId} dto={q.data} />;
}
