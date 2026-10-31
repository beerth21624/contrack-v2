'use client';

// ─── Cash outlook: weekly inflow / outflow bars and the running balance line (plain SVG; shown once a cash plan exists) ───
import { useTranslations } from 'next-intl';
import type { CashOutlookWeek } from '@/shared/contract';
import { useFormat } from '@/i18n/useFormat';
import { SectionCard } from '../shared/SectionCard';

const W = 800;
const H = 240;
const M = { left: 56, right: 12, top: 12, bottom: 28 };
const IN = '#16a34a';
const OUT = '#dc2626';
const BAL = '#1f2937';

export function CashOutlookChart({ weeks }: { weeks: readonly CashOutlookWeek[] }) {
    const t = useTranslations('portal');
    const fmt = useFormat();
    const compact = (v: number) => fmt.number(Math.round(v));
    const n = weeks.length;
    const plotW = W - M.left - M.right;
    const plotH = H - M.top - M.bottom;
    const hi = Math.max(0, ...weeks.flatMap(w => [w.inflow, w.balance]));
    const lo = Math.min(0, ...weeks.flatMap(w => [-w.outflow, w.balance]));
    const span = hi - lo === 0 ? 1 : hi - lo;
    const y = (v: number) => M.top + plotH * (1 - (v - lo) / span);
    const slot = n > 0 ? plotW / n : plotW;
    const bw = Math.max(2, Math.min(18, slot / 3));
    const cx = (i: number) => M.left + slot * (i + 0.5);
    const line = weeks.map((w, i) => `${i === 0 ? 'M' : 'L'}${cx(i)},${y(w.balance)}`).join(' ');
    const ticks = [lo, lo + span / 2, hi];
    return (
        <SectionCard title={t('cash.title')} extra={(
            <div className="flex flex-wrap gap-3 text-[12px] text-gray-600">
                <span><span style={{ color: IN }}>■</span> {t('cash.inflow')}</span>
                <span><span style={{ color: OUT }}>■</span> {t('cash.outflow')}</span>
                <span><span style={{ color: BAL }}>━</span> {t('cash.balance')}</span>
            </div>
        )}>
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('cash.title')}>
                {ticks.map((v, i) => (
                    <g key={i}>
                        <line x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} stroke="#e5e7eb" />
                        <text x={M.left - 6} y={y(v) + 4} fontSize={11} textAnchor="end" fill="#6b7280">{compact(v)}</text>
                    </g>
                ))}
                <line x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} stroke="#9ca3af" />
                {weeks.map((w, i) => (
                    <g key={w.weekStart}>
                        <rect x={cx(i) - bw} y={y(w.inflow)} width={bw} height={Math.max(0, y(0) - y(w.inflow))} fill={IN} />
                        <rect x={cx(i)} y={y(0)} width={bw} height={Math.max(0, y(-w.outflow) - y(0))} fill={OUT} />
                        {(n <= 12 || i % Math.ceil(n / 12) === 0) && (
                            <text x={cx(i)} y={H - 8} fontSize={10} textAnchor="middle" fill="#6b7280">{fmt.date(w.weekStart)}</text>
                        )}
                    </g>
                ))}
                {n > 0 && <path d={line} fill="none" stroke={BAL} strokeWidth={2} />}
            </svg>
        </SectionCard>
    );
}
