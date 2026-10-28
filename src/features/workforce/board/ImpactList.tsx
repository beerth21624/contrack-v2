'use client';

// ─── Before → after lines of a what-if (W3): a suggestion card and the bar panel's live preview ───
// The lines come from suggest-view.ts (impactLines); this only lays them out. Stacked when `compact` (the drawer) or
// on a phone; label | numbers side by side from `sm` otherwise.
import type { ImpactLine, ImpactTone } from './suggest-view';

const TONE: Record<ImpactTone, string> = {
    good: 'text-green-700',
    bad: 'text-amber-700',
    neutral: 'text-gray-500',
};

export function ImpactList({ lines, compact = false }: { lines: readonly ImpactLine[]; compact?: boolean }) {
    if (lines.length === 0) return <div className="text-[13px] text-gray-500">ตัวเลขในช่วงที่แสดงไม่เปลี่ยน</div>;
    return (
        <dl className="flex flex-col gap-1.5 m-0 min-w-0">
            {lines.map(l => (
                <div key={l.key} className={`flex flex-col min-w-0 text-[13px] leading-5 ${compact ? '' : 'sm:flex-row sm:items-baseline sm:gap-3'}`}>
                    <dt className={`text-gray-600 min-w-0 break-words ${compact ? '' : 'sm:w-[220px] sm:shrink-0'}`}>{l.label}</dt>
                    <dd className="m-0 flex flex-wrap items-baseline gap-x-1.5 min-w-0 tabular-nums">
                        <span className="text-gray-500">{l.before}</span>
                        <span aria-label="เป็น" className="text-gray-400">→</span>
                        <span className="text-gray-900 font-medium">{l.after}</span>
                        {l.change !== '' && <span className={`ml-1 ${TONE[l.tone]}`}>{l.change}</span>}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
