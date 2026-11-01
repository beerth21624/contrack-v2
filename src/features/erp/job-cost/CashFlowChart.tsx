'use client';

// ─── Plan vs actual cash per week: bars = net cash (planned light, actual solid), line = balance, dashed = minimum ───
// Project charts add the estimate's cumulative line. Plain SVG (the project has no chart library).
import { useLocale, useTranslations } from 'next-intl';
import type { CashFlowDto } from '@/shared/contract';
import { useFormat } from '@/i18n/useFormat';
import { CHART_M as M, CHART_W as W, COLORS, compactNumber, niceTicks } from './chart-utils';

const H = 320;

export function CashFlowChart({ data }: { data: CashFlowDto }) {
    const t = useTranslations('jobCost.cash');
    const locale = useLocale();
    const fmt = useFormat();
    const weeks = data.weeks;
    if (weeks.length === 0) return null;

    const estimate = new Map((data.estimate ?? []).map(e => [e.weekStart, e.cumulative]));
    const rows = weeks.map(w => ({
        w,
        plannedNet: w.plannedIn - w.plannedOut,
        actualNet: w.actualIn - w.actualOut,
        est: estimate.get(w.weekStart),
    }));

    const values: number[] = [0, data.minBalance];
    for (const r of rows) values.push(r.plannedNet, r.actualNet, r.w.balance);
    for (const r of rows) if (r.est !== undefined) values.push(r.est);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const ticks = niceTicks(lo, hi === lo ? lo + 1 : hi);
    const yMin = Math.min(ticks[0] ?? lo, lo);
    const yMax = Math.max(ticks[ticks.length - 1] ?? hi, hi);
    const plotW = W - M.left - M.right;
    const plotH = H - M.top - M.bottom;
    const y = (v: number) => M.top + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;
    const bw = plotW / rows.length;
    const cx = (i: number) => M.left + i * bw + bw / 2;
    const barW = Math.max(2, Math.min(18, bw * 0.32));
    const zero = y(0);

    const linePath = (pick: (r: (typeof rows)[number]) => number | undefined): string =>
        rows.flatMap((r, i) => { const v = pick(r); return v === undefined ? [] : [`${i === 0 ? 'M' : 'L'}${cx(i).toFixed(1)},${y(v).toFixed(1)}`]; }).join(' ');
    const balancePath = linePath(r => r.w.balance);
    const estimatePath = estimate.size > 0 ? linePath(r => r.est).replace(/^L/, 'M') : '';
    const step = Math.max(1, Math.ceil(rows.length / 14));

    return (
        <div>
            <div className="flex flex-wrap gap-4 text-[12px] text-gray-700 mb-1">
                <LegendItem color={COLORS.plan} opacity={0.35} label={t('legend.plannedNet')} />
                <LegendItem color={COLORS.actual} label={t('legend.actualNet')} />
                <LegendItem color={COLORS.balance} line label={t('legend.balance')} />
                <LegendItem color={COLORS.min} line dashed label={t('legend.min')} />
                {estimatePath !== '' && <LegendItem color={COLORS.estimate} line label={t('legend.estimate')} />}
            </div>
            <svg viewBox={`0 0 ${String(W)} ${String(H)}`} className="w-full h-auto" role="img" aria-label={t('chartLabel')}>
                {ticks.map(v => (
                    <g key={v}>
                        <line x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} stroke={COLORS.grid} />
                        <text x={M.left - 6} y={y(v) + 4} fontSize={11} textAnchor="end" fill={COLORS.muted}>{compactNumber(v, locale)}</text>
                    </g>
                ))}
                <line x1={M.left} x2={W - M.right} y1={zero} y2={zero} stroke={COLORS.axis} />
                {rows.map((r, i) => (
                    <g key={r.w.weekStart}>
                        {r.w.past && <rect x={M.left + i * bw} y={M.top} width={bw} height={plotH} fill="#000" opacity={0.03} />}
                        {!r.w.past && (
                            <rect x={cx(i) - barW - 1} y={Math.min(y(r.plannedNet), zero)} width={barW} height={Math.abs(y(r.plannedNet) - zero)} fill={COLORS.plan} opacity={0.35} />
                        )}
                        <rect x={cx(i) + 1} y={Math.min(y(r.actualNet), zero)} width={barW} height={Math.abs(y(r.actualNet) - zero)} fill={COLORS.actual} />
                        {i % step === 0 && (
                            <text x={cx(i)} y={H - M.bottom + 16} fontSize={10} textAnchor="middle" fill={COLORS.ink2}>{fmt.date(r.w.weekStart).replace(/\s?\d{4}$/, '')}</text>
                        )}
                        <rect x={M.left + i * bw} y={M.top} width={bw} height={plotH} fill="transparent">
                            <title>{[
                                `${fmt.date(r.w.weekStart)} – ${fmt.date(r.w.weekEnd)}`,
                                `${t('legend.plannedNet')}: ${fmt.money(r.plannedNet)} (${fmt.money(r.w.plannedIn)} / ${fmt.money(r.w.plannedOut)})`,
                                `${t('legend.actualNet')}: ${fmt.money(r.actualNet)} (${fmt.money(r.w.actualIn)} / ${fmt.money(r.w.actualOut)})`,
                                `${t('legend.balance')}: ${fmt.money(r.w.balance)}`,
                            ].join('\n')}</title>
                        </rect>
                    </g>
                ))}
                <line x1={M.left} x2={W - M.right} y1={y(data.minBalance)} y2={y(data.minBalance)} stroke={COLORS.min} strokeDasharray="6 4" />
                {estimatePath !== '' && <path d={estimatePath} fill="none" stroke={COLORS.estimate} strokeWidth={2} />}
                <path d={balancePath} fill="none" stroke={COLORS.balance} strokeWidth={2.5} />
                {rows.map((r, i) => (
                    <circle key={r.w.weekStart} cx={cx(i)} cy={y(r.w.balance)} r={3} fill={r.w.balance < data.minBalance && !r.w.past ? COLORS.min : COLORS.balance} />
                ))}
            </svg>
        </div>
    );
}

function LegendItem({ color, label, line = false, dashed = false, opacity = 1 }: { color: string; label: string; line?: boolean; dashed?: boolean; opacity?: number }) {
    return (
        <span className="flex items-center gap-1.5">
            {line
                ? <span style={{ width: 16, height: 0, borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}`, display: 'inline-block' }} />
                : <span style={{ width: 10, height: 10, background: color, opacity, borderRadius: 2, display: 'inline-block' }} />}
            {label}
        </span>
    );
}
