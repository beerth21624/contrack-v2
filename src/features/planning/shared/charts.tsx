'use client';

// Plain-SVG charts of the planning pages (the project has no chart library).
// Colours: reference categorical slots 1 (blue) and 2 (orange); ink/grid from the reference chrome.
import { useState, type ReactNode } from 'react';
import type { WeekBucket } from '@/domain/planning';
import { formatNumber } from '@/components/sheet/NumberCell';
import { bucketLabel, bucketRange } from './planning-ui';

export const CHART_COLORS = {
    plan: '#2a78d6',
    actual: '#eb6834',
    income: '#2a78d6',
    outflow: '#eb6834',
    line: '#0b0b0b',
    ink2: '#52514e',
    muted: '#898781',
    grid: '#e1e0d9',
    axis: '#c3c2b7',
    surface: '#fcfcfb',
} as const;

const W = 1000;
const M = { left: 64, right: 20, top: 18, bottom: 40 };

const compact = new Intl.NumberFormat('th-TH', { notation: 'compact', maximumFractionDigits: 1 });
const pct = (v: number | undefined, digits = 1) => (v === undefined ? '' : `${(v * 100).toFixed(digits)}%`);

/** "Nice" tick values covering [lo, hi]. */
function niceTicks(lo: number, hi: number, count = 5): number[] {
    const span = hi - lo;
    if (span <= 0) return [lo];
    const raw = span / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = ([1, 2, 2.5, 5, 10].map(f => f * mag).find(s => s >= raw)) ?? raw;
    const out: number[] = [];
    for (let v = Math.floor(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.round(v / step) * step);
    return out;
}

interface Frame { n: number; h: number; plotW: number; bw: number; x: (i: number) => number }

function frame(n: number, h: number): Frame {
    const plotW = W - M.left - M.right;
    const bw = n > 0 ? plotW / n : plotW;
    return { n, h, plotW, bw, x: i => M.left + i * bw };
}

/** Month bands, W labels and month separators under the plot. */
function MonthAxis({ f, buckets }: { f: Frame; buckets: WeekBucket[] }) {
    const base = f.h - M.bottom;
    return (
        <g>
            {buckets.map(b => (
                <g key={b.index}>
                    {b.week === 1 && <line x1={f.x(b.index)} x2={f.x(b.index)} y1={M.top} y2={base + 34} stroke={CHART_COLORS.grid} />}
                    {f.bw >= 16 && (
                        <text x={f.x(b.index) + f.bw / 2} y={base + 14} fontSize={10} textAnchor="middle" fill={CHART_COLORS.muted}>{b.weekLabel}</text>
                    )}
                    {b.week === 1 && (
                        <text x={f.x(b.index) + 2 * f.bw} y={base + 31} fontSize={12} textAnchor="middle"
                            fill={CHART_COLORS.ink2}>{b.monthLabel}</text>
                    )}
                </g>
            ))}
            <line x1={M.left} x2={W - M.right} y1={base} y2={base} stroke={CHART_COLORS.axis} />
        </g>
    );
}

function Legend({ items }: { items: { label: string; color: string; kind: 'line' | 'bar' }[] }) {
    return (
        <div className="flex flex-wrap gap-4 text-[12px] text-gray-700 mb-1">
            {items.map(it => (
                <span key={it.label} className="flex items-center gap-1.5">
                    {it.kind === 'line'
                        ? <span style={{ width: 16, height: 2, background: it.color, display: 'inline-block' }} />
                        : <span style={{ width: 10, height: 10, background: it.color, borderRadius: 2, display: 'inline-block' }} />}
                    {it.label}
                </span>
            ))}
        </div>
    );
}

/** Hover layer: one hit target per bucket + an HTML tooltip. */
function useHover() {
    const [hover, setHover] = useState<number | null>(null);
    return { hover, setHover };
}

function Tooltip({ f, index, children }: { f: Frame; index: number; children: ReactNode }) {
    const cx = f.x(index) + f.bw / 2;
    const leftPct = (cx / W) * 100;
    const shift = index > f.n * 0.66 ? '-100%' : index < f.n * 0.2 ? '0%' : '-50%';
    return (
        <div className="absolute top-0 pointer-events-none z-10 rounded-md border border-gray-200 bg-white/95 shadow px-2.5 py-1.5 text-[12px] text-gray-800 whitespace-nowrap"
            style={{ left: `${leftPct}%`, transform: `translateX(${shift})` }}>
            {children}
        </div>
    );
}

function HitTargets({ f, onHover }: { f: Frame; onHover: (i: number | null) => void }) {
    return (
        <g onMouseLeave={() => onHover(null)}>
            {Array.from({ length: f.n }, (_, i) => (
                <rect key={i} x={f.x(i)} y={M.top} width={f.bw} height={f.h - M.top - M.bottom} fill="transparent"
                    onMouseEnter={() => onHover(i)} onClick={() => onHover(i)} />
            ))}
        </g>
    );
}

/** S-curve: cumulative plan % (row 87) and cumulative actual % (row 91) per week bucket. */
export function SCurveChart({ buckets, plan, actual, actualUntil, planWeekly }: {
    buckets: WeekBucket[];
    plan: number[];
    /** Cumulative actual; drawn up to `actualUntil` (bucket of the last update) only. */
    actual: number[];
    actualUntil: number;
    planWeekly: number[];
}) {
    const h = 300;
    const f = frame(buckets.length, h);
    const { hover, setHover } = useHover();
    const base = h - M.bottom;
    const top = Math.max(1, ...plan, ...actual.slice(0, actualUntil + 1));
    const y = (v: number) => base - (v / top) * (base - M.top);
    const ticks = niceTicks(0, top, 4);
    const path = (vals: number[]) => [`M${M.left},${y(0)}`, ...vals.map((v, i) => `L${f.x(i + 1)},${y(v)}`)].join(' ');
    const actualVals = actualUntil >= 0 ? actual.slice(0, actualUntil + 1) : [];
    const lastPlan = plan.length - 1;
    const hb = hover === null ? undefined : buckets[hover];

    return (
        <div>
            <Legend items={[
                { label: 'แผนงาน (สะสม)', color: CHART_COLORS.plan, kind: 'line' },
                { label: 'ผลงานจริง (สะสม)', color: CHART_COLORS.actual, kind: 'line' },
            ]} />
            <div className="overflow-x-auto">
                <div className="relative min-w-[600px]">
                    <svg viewBox={`0 0 ${W} ${h}`} width="100%" role="img" aria-label="กราฟ S-Curve แผนงานเทียบผลงานสะสม">
                        <rect x={0} y={0} width={W} height={h} fill={CHART_COLORS.surface} />
                        {ticks.map(t => (
                            <g key={t}>
                                <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke={CHART_COLORS.grid} strokeWidth={1} />
                                <text x={M.left - 8} y={y(t) + 4} fontSize={11} textAnchor="end" fill={CHART_COLORS.muted}>{pct(t, 0)}</text>
                            </g>
                        ))}
                        <MonthAxis f={f} buckets={buckets} />
                        {hover !== null && <rect x={f.x(hover)} y={M.top} width={f.bw} height={base - M.top} fill="#000" opacity={0.04} />}
                        <path d={path(plan)} fill="none" stroke={CHART_COLORS.plan} strokeWidth={2} strokeLinejoin="round" />
                        {actualVals.length > 0 && (
                            <path d={path(actualVals)} fill="none" stroke={CHART_COLORS.actual} strokeWidth={2} strokeLinejoin="round" />
                        )}
                        {actualVals.length > 0 && (
                            <circle cx={f.x(actualVals.length)} cy={y(actualVals.at(-1) ?? 0)} r={4.5} fill={CHART_COLORS.actual}
                                stroke={CHART_COLORS.surface} strokeWidth={2} />
                        )}
                        {lastPlan >= 0 && (
                            <text x={f.x(lastPlan + 1) - 4} y={y(plan[lastPlan] ?? 0) - 8} fontSize={12} textAnchor="end" fill={CHART_COLORS.ink2}>
                                แผน {pct(plan[lastPlan], 0)}
                            </text>
                        )}
                        {hover !== null && (
                            <circle cx={f.x(hover + 1)} cy={y(plan[hover] ?? 0)} r={4.5} fill={CHART_COLORS.plan} stroke={CHART_COLORS.surface} strokeWidth={2} />
                        )}
                        <HitTargets f={f} onHover={setHover} />
                    </svg>
                    {hover !== null && hb && (
                        <Tooltip f={f} index={hover}>
                            <div className="font-semibold">{bucketLabel(hb)} <span className="font-normal text-gray-500">{bucketRange(hb)}</span></div>
                            <div>แผนงานสะสม <b>{pct(plan[hover], 2)}</b> <span className="text-gray-500">(สัปดาห์นี้ {pct(planWeekly[hover], 2)})</span></div>
                            {hover <= actualUntil && <div>ผลงานสะสม <b>{pct(actual[hover], 2)}</b></div>}
                        </Tooltip>
                    )}
                </div>
            </div>
        </div>
    );
}

/** Weekly cash-in (up) / cash-out (down) bars and the cumulative cash position line (row 18). */
export function CashFlowChart({ buckets, income, outflow, cumulative, min }: {
    buckets: WeekBucket[];
    income: number[];
    outflow: number[];
    cumulative: number[];
    min: { value: number; bucket: number } | null;
}) {
    const h = 320;
    const f = frame(buckets.length, h);
    const { hover, setHover } = useHover();
    const base = h - M.bottom;
    const hi = Math.max(0, ...income, ...cumulative);
    const lo = Math.min(0, ...outflow.map(v => -v), ...cumulative);
    const ticks = niceTicks(lo, hi, 5);
    const yMin = Math.min(lo, ticks[0] ?? lo);
    const yMax = Math.max(hi, ticks.at(-1) ?? hi);
    const y = (v: number) => (yMax === yMin ? base : base - ((v - yMin) / (yMax - yMin)) * (base - M.top));
    const bar = Math.max(2, Math.min(18, f.bw * 0.55));
    const cx = (i: number) => f.x(i) + f.bw / 2;
    const line = cumulative.map((v, i) => `${i === 0 ? 'M' : 'L'}${cx(i)},${y(v)}`).join(' ');
    const hb = hover === null ? undefined : buckets[hover];

    return (
        <div>
            <Legend items={[
                { label: 'รับเงินงวด', color: CHART_COLORS.income, kind: 'bar' },
                { label: 'จ่ายค่าก่อสร้าง + ค่าดำเนินงาน', color: CHART_COLORS.outflow, kind: 'bar' },
                { label: 'เงินสดสะสม (Cash FLOW)', color: CHART_COLORS.line, kind: 'line' },
            ]} />
            <div className="overflow-x-auto">
                <div className="relative min-w-[600px]">
                    <svg viewBox={`0 0 ${W} ${h}`} width="100%" role="img" aria-label="กราฟกระแสเงินสดรายสัปดาห์">
                        <rect x={0} y={0} width={W} height={h} fill={CHART_COLORS.surface} />
                        {ticks.map(t => (
                            <g key={t}>
                                <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)}
                                    stroke={t === 0 ? CHART_COLORS.axis : CHART_COLORS.grid} strokeWidth={t === 0 ? 1.5 : 1} />
                                <text x={M.left - 8} y={y(t) + 4} fontSize={11} textAnchor="end" fill={CHART_COLORS.muted}>{compact.format(t)}</text>
                            </g>
                        ))}
                        <MonthAxis f={f} buckets={buckets} />
                        {hover !== null && <rect x={f.x(hover)} y={M.top} width={f.bw} height={base - M.top} fill="#000" opacity={0.04} />}
                        {income.map((v, i) => v > 0 && (
                            <rect key={`in${i}`} x={cx(i) - bar / 2} y={y(v)} width={bar} height={Math.max(0, y(0) - y(v))} rx={2}
                                fill={CHART_COLORS.income} />
                        ))}
                        {outflow.map((v, i) => v > 0 && (
                            <rect key={`out${i}`} x={cx(i) - bar / 2} y={y(0)} width={bar} height={Math.max(0, y(-v) - y(0))} rx={2}
                                fill={CHART_COLORS.outflow} />
                        ))}
                        <path d={line} fill="none" stroke={CHART_COLORS.line} strokeWidth={2} strokeLinejoin="round" />
                        {min && min.value < 0 && (
                            <g>
                                <circle cx={cx(min.bucket)} cy={y(min.value)} r={5} fill={CHART_COLORS.line} stroke={CHART_COLORS.surface} strokeWidth={2} />
                                <text x={cx(min.bucket)} y={y(min.value) + 20} fontSize={12} textAnchor="middle" fill={CHART_COLORS.line} fontWeight={600}>
                                    ติดลบสูงสุด {formatNumber(min.value, 0)}
                                </text>
                            </g>
                        )}
                        {hover !== null && (
                            <circle cx={cx(hover)} cy={y(cumulative[hover] ?? 0)} r={4.5} fill={CHART_COLORS.line} stroke={CHART_COLORS.surface} strokeWidth={2} />
                        )}
                        <HitTargets f={f} onHover={setHover} />
                    </svg>
                    {hover !== null && hb && (
                        <Tooltip f={f} index={hover}>
                            <div className="font-semibold">{bucketLabel(hb)} <span className="font-normal text-gray-500">{bucketRange(hb)}</span></div>
                            <div>รับ <b>{formatNumber(income[hover], 0)}</b> · จ่าย <b>{formatNumber(outflow[hover], 0)}</b> บาท</div>
                            <div>เงินสดสะสม <b className={(cumulative[hover] ?? 0) < 0 ? 'text-red-600' : ''}>{formatNumber(cumulative[hover], 0)}</b> บาท</div>
                        </Tooltip>
                    )}
                </div>
            </div>
        </div>
    );
}
