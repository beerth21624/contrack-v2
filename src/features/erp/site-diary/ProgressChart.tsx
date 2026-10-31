'use client';

// ─── S-curve: cumulative progress per report day (actual) against the plan (planned), plain SVG ───
import { useTranslations } from 'next-intl';
import type { SiteProgressDto } from '@/shared/contract';
import { useFormat } from '@/i18n/useFormat';

const W = 800;
const H = 260;
const M = { left: 44, right: 14, top: 12, bottom: 28 };
const ACTUAL = '#16a34a';
const PLANNED = '#6b7280';

const day = (s: string): number => Date.parse(`${s}T00:00:00Z`) / 86_400_000;

export function ProgressChart({ data }: { data: SiteProgressDto }) {
    const t = useTranslations('siteDiary.progress');
    const fmt = useFormat();
    const actual = data.actual.map(p => ({ x: day(p.date), y: p.pct, date: p.date }));
    const planned = (data.planned ?? []).map(p => ({ x: day(p.weekStart), y: p.pct, date: p.weekStart }));
    const xs = [...actual, ...planned].map(p => p.x);
    if (xs.length === 0) return <div className="text-[13px] text-gray-500">{t('empty')}</div>;
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    const span = hi - lo === 0 ? 1 : hi - lo;
    const plotW = W - M.left - M.right;
    const plotH = H - M.top - M.bottom;
    const px = (x: number) => M.left + plotW * ((x - lo) / span);
    const py = (y: number) => M.top + plotH * (1 - Math.min(1, Math.max(0, y)));
    const path = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.x)},${py(p.y)}`).join(' ');
    const dates = [...new Set([...actual, ...planned].map(p => p.date))].sort();
    const labelEvery = Math.max(1, Math.ceil(dates.length / 6));
    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-3 text-[12px] text-gray-600">
                <span><span style={{ color: ACTUAL }}>━</span> {t('actual')}</span>
                {planned.length > 0 && <span><span style={{ color: PLANNED }}>╌</span> {t('planned')}</span>}
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('title')}>
                {[0, 0.25, 0.5, 0.75, 1].map(v => (
                    <g key={v}>
                        <line x1={M.left} x2={W - M.right} y1={py(v)} y2={py(v)} stroke="#e5e7eb" />
                        <text x={M.left - 6} y={py(v) + 4} fontSize={11} textAnchor="end" fill="#6b7280">{fmt.percent(v, 0)}</text>
                    </g>
                ))}
                {dates.map((d, i) => (i % labelEvery === 0 ? (
                    <text key={d} x={px(day(d))} y={H - 8} fontSize={10} textAnchor="middle" fill="#6b7280">{fmt.date(d)}</text>
                ) : null))}
                {planned.length > 0 && <path d={path(planned)} fill="none" stroke={PLANNED} strokeWidth={2} strokeDasharray="6 4" />}
                {actual.length > 1 && <path d={path(actual)} fill="none" stroke={ACTUAL} strokeWidth={2.5} />}
                {actual.map(p => <circle key={p.date} cx={px(p.x)} cy={py(p.y)} r={3.5} fill={ACTUAL}><title>{`${fmt.date(p.date)} ${fmt.percent(p.y, 1)}`}</title></circle>)}
            </svg>
        </div>
    );
}
