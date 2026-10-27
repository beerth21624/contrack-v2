'use client';

// "ความเร็วโครงการ": the project-age gauge next to the S-curve. One honest reading of how fast the project
// really moves against its plan — a half-circle speedometer (pace ratio), the project age in weeks and three
// small tiles (velocity, acceleration, projected finish). Plain SVG, no chart library. Numbers from
// src/domain/planning/pace.ts; colours from the planning charts (plan blue) plus the state colours.
import { Tooltip } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, MinusOutlined } from '@ant-design/icons';
import { SheetCard } from '@/components/sheet/SheetFields';
import {
    PACE_STATUS_LABEL, PACE_THRESHOLDS, TREND_LABEL, ageExplanation, ageText, paceText, requiredPaceText,
    type PaceStatus, type SchedulePace, type WeekBucket,
} from '@/domain/planning';
import { bucketLabel, bucketRange } from '../shared/planning-ui';

/** Calm state colours: red (behind / stalled), amber (slightly behind), green (on track), blue (ahead = plan blue). */
const ZONE = { red: '#d6605a', amber: '#e3a63a', green: '#4a9d6a', blue: '#2a78d6', muted: '#c3c2b7', ink: '#0b0b0b', ink2: '#52514e' } as const;

const STATUS_COLOR: Record<PaceStatus, string> = {
    'ahead': ZONE.blue, 'on-track': ZONE.green, 'slightly-behind': ZONE.amber, 'behind': ZONE.red, 'stalled': ZONE.red, 'not-started': ZONE.muted,
};
const STATUS_TEXT: Record<PaceStatus, string> = {
    'ahead': 'text-blue-700', 'on-track': 'text-green-700', 'slightly-behind': 'text-amber-700', 'behind': 'text-red-600',
    'stalled': 'text-red-600', 'not-started': 'text-gray-500',
};
const STATUS_BG: Record<PaceStatus, string> = {
    'ahead': 'bg-blue-50 border-blue-200', 'on-track': 'bg-green-50 border-green-200', 'slightly-behind': 'bg-amber-50 border-amber-200',
    'behind': 'bg-red-50 border-red-200', 'stalled': 'bg-red-50 border-red-200', 'not-started': 'bg-gray-50 border-gray-200',
};

const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
const ratio = (v: number) => `${v.toFixed(2)}×`;
const signedWeeks = (w: number) => {
    const r = Math.round(w);
    return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r)} สัปดาห์`;
};

/** Colour of a pace ratio by the status thresholds (null = nothing to compare). */
export function paceColor(p: number | null): string {
    if (p === null) return ZONE.muted;
    if (p >= PACE_THRESHOLDS.ahead) return ZONE.blue;
    if (p >= PACE_THRESHOLDS.onTrack) return ZONE.green;
    if (p >= PACE_THRESHOLDS.slightlyBehind) return ZONE.amber;
    return ZONE.red;
}

// ─── Speedometer ──────────────────────────────────────────────────────────────

const G = { w: 240, h: 150, cx: 120, cy: 128, r: 96, stroke: 14, max: 1.5 } as const;

/** Angle (radians, SVG) of a pace ratio: 0 → left end of the arc, G.max → right end. */
const angleOf = (v: number) => Math.PI * (1 - Math.min(G.max, Math.max(0, v)) / G.max);
const polar = (v: number, r: number) => ({ x: G.cx + r * Math.cos(angleOf(v)), y: G.cy - r * Math.sin(angleOf(v)) });

function arcPath(from: number, to: number, r: number): string {
    const a = polar(from, r);
    const b = polar(to, r);
    return `M${a.x.toFixed(2)},${a.y.toFixed(2)} A${r},${r} 0 0 1 ${b.x.toFixed(2)},${b.y.toFixed(2)}`;
}

const ZONES: { from: number; to: number; color: string }[] = [
    { from: 0, to: PACE_THRESHOLDS.slightlyBehind, color: ZONE.red },
    { from: PACE_THRESHOLDS.slightlyBehind, to: PACE_THRESHOLDS.onTrack, color: ZONE.amber },
    { from: PACE_THRESHOLDS.onTrack, to: PACE_THRESHOLDS.ahead, color: ZONE.green },
    { from: PACE_THRESHOLDS.ahead, to: G.max, color: ZONE.blue },
];

/** Half-circle gauge with the needle at the pace ratio (0 … 1.5×) and the reading in the middle. */
export function PaceGauge({ pace, status, headline, caption }: {
    pace: number | null; status: PaceStatus; headline: string; caption: string;
}) {
    const value = pace ?? 0;
    const deg = 180 - (Math.min(G.max, Math.max(0, value)) / G.max) * 180;   // CSS rotation of a needle pointing left
    const color = STATUS_COLOR[status];
    const dim = pace === null;
    const tick = (v: number, label: string) => {
        const end = v === 0 || v === G.max;
        const o = polar(v, G.r + G.stroke / 2 + 4);
        const i = polar(v, G.r - G.stroke / 2 - 4);
        // End labels sit under the arc ends (inside the viewBox); the others sit outside the arc.
        const t = end ? { x: polar(v, G.r).x, y: G.cy + 14 } : polar(v, G.r + G.stroke / 2 + 14);
        return (
            <g key={v}>
                {!end && <line x1={i.x} y1={i.y} x2={o.x} y2={o.y} stroke={ZONE.muted} strokeWidth={1} />}
                <text x={t.x} y={t.y + 3.5} fontSize={10} fill={ZONE.ink2} textAnchor="middle">{label}</text>
            </g>
        );
    };
    return (
        <svg viewBox={`0 0 ${G.w} ${G.h}`} width="100%" role="img"
            aria-label={`มาตรวัดความเร็วโครงการ ${headline} ${caption}`} className="block max-w-[300px] mx-auto">
            {ZONES.map(z => (
                <path key={z.color} d={arcPath(z.from, z.to, G.r)} fill="none" stroke={z.color} strokeWidth={G.stroke}
                    strokeLinecap="butt" opacity={dim ? 0.25 : 0.9} />
            ))}
            {tick(0, '0')}
            {tick(0.5, '0.5×')}
            {tick(1, '1×')}
            {tick(G.max, '1.5×')}
            {/* Needle: drawn pointing left (0×), rotated to the value around the hub. */}
            <g style={{ transform: `rotate(${(180 - deg).toFixed(2)}deg)`, transformOrigin: `${G.cx}px ${G.cy}px`, transition: 'transform .6s cubic-bezier(.4,0,.2,1)' }}>
                <line x1={G.cx} y1={G.cy} x2={G.cx - (G.r - G.stroke / 2 - 6)} y2={G.cy} stroke={dim ? ZONE.muted : ZONE.ink}
                    strokeWidth={2.5} strokeLinecap="round" />
            </g>
            <circle cx={G.cx} cy={G.cy} r={5} fill={dim ? ZONE.muted : ZONE.ink} />
            <circle cx={G.cx} cy={G.cy} r={2} fill="#fff" />
            <text x={G.cx} y={G.cy - 36} fontSize={28} fontWeight={700} textAnchor="middle" fill={dim ? ZONE.ink2 : color}>{headline}</text>
            <text x={G.cx} y={G.cy - 18} fontSize={11} textAnchor="middle" fill={ZONE.ink2}>{caption}</text>
        </svg>
    );
}

// ─── Tiles ────────────────────────────────────────────────────────────────────

function MiniTile({ label, value, unit, hint, tone = 'default' }: {
    label: string; value: React.ReactNode; unit?: string; hint?: React.ReactNode; tone?: 'default' | 'good' | 'bad' | 'warn' | 'ahead';
}) {
    const color = tone === 'good' ? 'text-green-700' : tone === 'bad' ? 'text-red-600' : tone === 'warn' ? 'text-amber-700'
        : tone === 'ahead' ? 'text-blue-700' : 'text-gray-900';
    return (
        <div className="rounded-card border border-gray-200 bg-gray-50/70 px-3 py-2 min-w-0 flex flex-col justify-center">
            <div className="text-[12px] text-gray-500 leading-tight">{label}</div>
            <div className={`text-[16px] sm:text-[18px] font-semibold leading-tight mt-0.5 [overflow-wrap:anywhere] ${color}`}>
                {value}{unit && <span className="ml-0.5 text-[12px] font-normal text-gray-500">{unit}</span>}
            </div>
            {hint && <div className="text-[12px] text-gray-400 mt-0.5 leading-tight [overflow-wrap:anywhere]">{hint}</div>}
        </div>
    );
}

function toneOfDelta(w: number | null): 'default' | 'good' | 'bad' {
    if (w === null) return 'default';
    const r = Math.round(w);
    return r > 0 ? 'bad' : r < 0 ? 'good' : 'default';
}

// ─── The card ─────────────────────────────────────────────────────────────────

export function PaceCard({ pace }: { pace: SchedulePace }) {
    const p = pace;
    const started = p.status !== 'not-started';
    const required = requiredPaceText(p);
    const statusColorText = STATUS_TEXT[p.status];

    // Gauge reading: the pace ratio, or the plan's required pace before the first report.
    const headline = started ? (p.pace === null ? '–' : ratio(p.pace)) : p.planPace === null ? '–' : pct(p.planPace);
    const caption = started ? paceText(p.pace) : 'ต่อสัปดาห์ ที่แผนต้องการ';

    // Age hero.
    const ageTone = toneOfDelta(p.ageWeeks);
    const ageColor = ageTone === 'bad' ? 'text-red-600' : ageTone === 'good' ? 'text-green-700' : 'text-gray-900';

    // Tiles.
    const v = p.velocity;
    const a = p.acceleration;
    const trendIcon = a === null ? null : a.trend === 'up' ? <ArrowUpOutlined /> : a.trend === 'down' ? <ArrowDownOutlined /> : <MinusOutlined />;
    const trendTone = a === null ? 'default' : a.trend === 'up' ? 'good' : a.trend === 'down' ? 'bad' : 'default';
    const farOff = p.finishDeltaWeeks !== null && p.finishDeltaWeeks > 156;   // > 3 years late: the number stops meaning anything
    const finishValue = p.isComplete ? 'เสร็จแล้ว'
        : p.projectedFinishWeek === null ? 'ยังประเมินไม่ได้'
            : farOff ? 'เกิน 3 ปี' : (p.labels.projectedFinish ?? '–');
    const finishHint = p.projectedFinishWeek === null && !p.isComplete
        ? (p.reportedWeeks < 2 ? 'ต้องมีรายงานอย่างน้อย 2 สัปดาห์' : 'ความเร็วเป็น 0')
        : p.finishDeltaWeeks === null ? (p.labels.planFinish ? `แผน ${p.labels.planFinish}` : undefined)
            : <>แผน {p.labels.planFinish} · <span className={toneOfDelta(p.finishDeltaWeeks) === 'bad' ? 'text-red-600' : toneOfDelta(p.finishDeltaWeeks) === 'good' ? 'text-green-700' : ''}>{signedWeeks(p.finishDeltaWeeks)}</span></>;
    const finishTone = p.isComplete ? 'good' : farOff ? 'bad' : toneOfDelta(p.finishDeltaWeeks);

    return (
        <SheetCard title="ความเร็วโครงการ" collapsible
            extra={(
                <span className="flex items-center gap-2 text-[12px] text-gray-500">
                    {started && p.labels.latestReported && <span>ณ {p.labels.latestReported}</span>}
                    <span className={`px-2 py-0.5 rounded-full border text-[12px] font-medium ${STATUS_BG[p.status]} ${statusColorText}`}>
                        {PACE_STATUS_LABEL[p.status]}
                    </span>
                </span>
            )}>
            <div className="grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)_232px] gap-4 items-stretch">
                {/* Speedometer */}
                <div className="flex flex-col justify-center min-w-0">
                    <PaceGauge pace={started ? p.pace : null} status={p.status} headline={headline} caption={caption} />
                    <div className="text-[12px] text-gray-400 text-center leading-tight mt-1">
                        {started
                            ? <>ผลงานสะสม {pct(p.actualPct)} เทียบแผน {pct(p.planPct)}</>
                            : <>เข็มจะขยับเมื่อบันทึกผลงานจริงสัปดาห์แรก</>}
                    </div>
                </div>

                {/* Project age */}
                <div className="flex flex-col justify-center min-w-0 md:px-2">
                    <div className="text-[12px] text-gray-500 leading-tight">อายุโครงการเทียบแผน</div>
                    {started && p.ageWeeks !== null
                        ? (
                            <>
                                <div className={`text-[28px] font-bold leading-[1.25] tabular-nums ${ageColor}`}>{signedWeeks(p.ageWeeks)}</div>
                                <div className={`text-[14px] font-medium leading-snug ${ageColor}`}>{ageText(p.ageWeeks)}</div>
                            </>
                        )
                        : (
                            <>
                                <div className="text-[28px] font-bold leading-[1.25] text-gray-400">–</div>
                                <div className="text-[14px] font-medium leading-snug text-gray-600">ยังไม่มีรายงานผลงาน</div>
                            </>
                        )}
                    <div className="text-[13px] text-gray-600 leading-snug mt-2">
                        {started ? ageExplanation(p) : (required ?? 'กำหนดวันเริ่มงานก่อน จึงคำนวณความเร็วที่แผนต้องการได้')}
                    </div>
                    <div className="text-[12px] text-gray-400 leading-tight mt-1">
                        {started
                            ? (p.status === 'stalled' ? 'ไม่มีผลงานเพิ่มในสัปดาห์หลัง ๆ ทั้งที่แผนเดินต่อ'
                                : required ?? (p.isComplete ? 'งานครบ 100% แล้ว' : 'เลยสัปดาห์เสร็จตามแผนแล้ว'))
                            : (p.labels.planFinish ? `แผนเสร็จ ${p.labels.planFinish}` : '')}
                    </div>
                </div>

                {/* Three small tiles */}
                <div className="grid grid-cols-3 lg:grid-cols-1 gap-2 md:col-span-2 lg:col-span-1">
                    <MiniTile label="ความเร็ว"
                        value={v === null ? '–' : pct(v.actual)} unit={v === null ? undefined : '/สัปดาห์'}
                        hint={v === null ? (p.planPace === null ? undefined : `แผน ${pct(p.planPace)}/สัปดาห์`) : `แผน ${pct(v.plan)} · เฉลี่ย ${v.weeks} สัปดาห์`}
                        tone={v === null ? 'default' : v.actual + 1e-9 >= v.plan ? 'good' : v.actual <= 1e-9 ? 'bad' : 'default'} />
                    <MiniTile label="อัตราเร่ง"
                        value={a === null ? '–' : <span className="inline-flex items-center gap-1">{trendIcon}<span>{TREND_LABEL[a.trend]}</span></span>}
                        hint={a === null ? 'ต้องมีรายงาน ≥ 2 สัปดาห์' : `${a.delta >= 0 ? '+' : '−'}${pct(Math.abs(a.delta))} เทียบช่วงก่อน`}
                        tone={trendTone} />
                    <MiniTile label="คาดว่าเสร็จ" value={finishValue} hint={finishHint} tone={finishTone} />
                </div>
            </div>
        </SheetCard>
    );
}

// ─── Pace strip under the S-curve ─────────────────────────────────────────────

/** One chip per reported week, coloured by that week's cumulative pace, so the trend shows at a glance. */
export function PaceStrip({ pace, buckets }: { pace: SchedulePace; buckets: WeekBucket[] }) {
    if (pace.latestReported === null) return null;
    const upto = Math.min(pace.latestReported, buckets.length - 1);
    const chips = buckets.slice(0, upto + 1);
    return (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[12px] text-gray-500">ความเร็วรายสัปดาห์</span>
            <div className="flex flex-wrap gap-1">
                {chips.map(b => {
                    const w = pace.weekly[b.index] ?? null;
                    const color = paceColor(w);
                    const text = w === null ? 'ยังไม่มีแผนหรือไม่มีรายงาน' : `${ratio(w)} · ${paceText(w)}`;
                    return (
                        <Tooltip key={b.index} title={<><div className="font-semibold">{bucketLabel(b)} <span className="font-normal opacity-80">{bucketRange(b)}</span></div><div>{text}</div></>}>
                            <span className="inline-flex items-center justify-center h-5 min-w-[30px] px-1.5 rounded-[4px] text-[10px] font-medium text-white tabular-nums"
                                style={{ background: color, opacity: w === null ? 0.6 : 1 }} aria-label={`${bucketLabel(b)} ${text}`}>
                                {b.weekLabel}
                            </span>
                        </Tooltip>
                    );
                })}
            </div>
            <span className="text-[12px] text-gray-400">สีตามผลงานสะสม ÷ แผนสะสม ของสัปดาห์นั้น</span>
        </div>
    );
}
