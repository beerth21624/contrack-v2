'use client';

// ─── Budget vs committed vs actual vs forecast at completion (EAC), one group of bars per BOQ section ───
import { useLocale, useTranslations } from 'next-intl';
import type { JobCostSectionDto } from '@/shared/contract';
import { useFormat } from '@/i18n/useFormat';
import { CHART_M as M, CHART_W as W, COLORS, compactNumber, niceTicks } from './chart-utils';

const H = 300;

export function CostChart({ sections, sectionTitles }: { sections: readonly JobCostSectionDto[]; sectionTitles: ReadonlyMap<number, string> }) {
    const t = useTranslations('jobCost.chart');
    const locale = useLocale();
    const fmt = useFormat();
    if (sections.length === 0) return null;
    const series = [
        { key: 'budget', color: COLORS.budget, label: t('budget'), pick: (s: JobCostSectionDto) => s.budget },
        { key: 'committed', color: COLORS.committed, label: t('committed'), pick: (s: JobCostSectionDto) => s.committedOpen },
        { key: 'actual', color: COLORS.actual, label: t('actual'), pick: (s: JobCostSectionDto) => s.actual },
        { key: 'eac', color: COLORS.eac, label: t('eac'), pick: (s: JobCostSectionDto) => s.eac },
    ] as const;
    const max = Math.max(1, ...sections.flatMap(s => series.map(x => x.pick(s))));
    const ticks = niceTicks(0, max);
    const top = Math.max(ticks[ticks.length - 1] ?? max, max);
    const plotW = W - M.left - M.right;
    const plotH = H - M.top - M.bottom;
    const y = (v: number) => M.top + (1 - v / top) * plotH;
    const gw = plotW / sections.length;
    const bw = Math.max(3, Math.min(22, (gw * 0.8) / series.length));
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
            <svg viewBox={`0 0 ${String(W)} ${String(H)}`} className="w-full h-auto" role="img" aria-label={t('label')}>
                {ticks.map(v => (
                    <g key={v}>
                        <line x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} stroke={COLORS.grid} />
                        <text x={M.left - 6} y={y(v) + 4} fontSize={11} textAnchor="end" fill={COLORS.muted}>{compactNumber(v, locale)}</text>
                    </g>
                ))}
                {sections.map((s, i) => {
                    const x0 = M.left + i * gw + (gw - bw * series.length) / 2;
                    const title = sectionTitles.get(s.sectionNo);
                    return (
                        <g key={s.sectionNo}>
                            {series.map((x, k) => (
                                <rect key={x.key} x={x0 + k * bw} y={y(Math.max(0, x.pick(s)))} width={bw - 1} height={Math.max(0, base - y(Math.max(0, x.pick(s))))} fill={x.color} />
                            ))}
                            <text x={M.left + i * gw + gw / 2} y={H - M.bottom + 16} fontSize={11} textAnchor="middle" fill={COLORS.ink2}>{s.sectionNo}</text>
                            <rect x={M.left + i * gw} y={M.top} width={gw} height={plotH} fill="transparent">
                                <title>{[
                                    `${t('section', { no: s.sectionNo })}${title !== undefined && title !== '' ? ` · ${title}` : ''}`,
                                    ...series.map(x => `${x.label}: ${fmt.money(x.pick(s))}`),
                                ].join('\n')}</title>
                            </rect>
                        </g>
                    );
                })}
                <line x1={M.left} x2={W - M.right} y1={base} y2={base} stroke={COLORS.axis} />
                <text x={M.left + plotW / 2} y={H - 6} fontSize={11} textAnchor="middle" fill={COLORS.muted}>{t('axisSection')}</text>
            </svg>
        </div>
    );
}
