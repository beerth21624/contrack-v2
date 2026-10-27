'use client';

// The project-pace speedometer that sits beside the S-curve: one glance at how fast the project really
// moves against its plan. Plain SVG, no chart library. Numbers from src/domain/planning/pace.ts; colours
// from the planning charts (plan blue) plus the state colours.
import {
    PACE_STATUS_LABEL, PACE_THRESHOLDS, ageText, paceText, type PaceStatus, type SchedulePace,
} from '@/domain/planning';

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
    const deg = (Math.min(G.max, Math.max(0, value)) / G.max) * 180;   // rotation of a needle drawn pointing left (0×)
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
            aria-label={`มาตรวัดความเร็วโครงการ ${headline} ${caption}`} className="block max-w-[280px] mx-auto">
            {ZONES.map(z => (
                <path key={z.color} d={arcPath(z.from, z.to, G.r)} fill="none" stroke={z.color} strokeWidth={G.stroke}
                    strokeLinecap="butt" opacity={dim ? 0.25 : 0.9} />
            ))}
            {tick(0, '0')}
            {tick(0.5, '0.5×')}
            {tick(1, '1×')}
            {tick(G.max, '1.5×')}
            <g style={{ transform: `rotate(${deg.toFixed(2)}deg)`, transformOrigin: `${G.cx}px ${G.cy}px`, transition: 'transform .6s cubic-bezier(.4,0,.2,1)' }}>
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

// ─── The panel beside the S-curve ─────────────────────────────────────────────

/** Status chip for the card header: "ณ W2 ม.ค.-26 · ช้ากว่าแผน". */
export function PaceStatusChip({ pace }: { pace: SchedulePace }) {
    const started = pace.status !== 'not-started';
    return (
        <span className="flex items-center gap-2 text-[12px] text-gray-500">
            {started && pace.labels.latestReported && <span>ณ {pace.labels.latestReported}</span>}
            <span className={`px-2 py-0.5 rounded-full border text-[12px] font-medium ${STATUS_BG[pace.status]} ${STATUS_TEXT[pace.status]}`}>
                {PACE_STATUS_LABEL[pace.status]}
            </span>
        </span>
    );
}

/** The gauge with two quiet lines under it: cumulative actual vs plan, and the project age in weeks. */
export function PaceGaugePanel({ pace }: { pace: SchedulePace }) {
    const p = pace;
    const started = p.status !== 'not-started';
    // Gauge reading: the pace ratio, or the plan's required pace before the first report.
    const headline = started ? (p.pace === null ? '–' : ratio(p.pace)) : p.planPace === null ? '–' : pct(p.planPace);
    const caption = started ? paceText(p.pace) : 'ต่อสัปดาห์ ที่แผนต้องการ';
    const age = p.ageWeeks === null ? 0 : Math.round(p.ageWeeks);
    const ageColor = age > 0 ? 'text-red-600' : age < 0 ? 'text-green-700' : 'text-gray-700';
    return (
        <div className="flex flex-col justify-center min-w-0">
            <PaceGauge pace={started ? p.pace : null} status={p.status} headline={headline} caption={caption} />
            <div className="text-[12px] text-gray-400 text-center leading-tight mt-1">
                {started
                    ? <>ผลงานสะสม {pct(p.actualPct)} เทียบแผน {pct(p.planPct)}</>
                    : <>เข็มจะขยับเมื่อบันทึกผลงานจริงสัปดาห์แรก</>}
            </div>
            {started && p.ageWeeks !== null && (
                <div className={`text-[13px] font-medium text-center leading-tight mt-1 ${ageColor}`}>{ageText(p.ageWeeks)}</div>
            )}
        </div>
    );
}
