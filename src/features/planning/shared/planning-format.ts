// Pure formatting and colour helpers of the planning pages (no React, no antd), so print documents and their
// tests can use them too. planning-ui.tsx and charts.tsx re-export them.
import type { WeekBucket } from '@/domain/planning/calendar';

/**
 * Buckets worth drawing in a summary view: whole months up to the last bucket where any series is non-zero
 * (the Excel axis is 12 months long even when the plan ends in May).
 */
export function usedBucketCount(buckets: WeekBucket[], ...series: number[][]): number {
    let last = -1;
    for (const s of series) s.forEach((v, i) => { if (Math.abs(v) > 1e-12 && i > last) last = i; });
    if (last < 0) return Math.min(buckets.length, 20);
    const month = buckets[last]?.monthIndex ?? 0;
    return Math.min(buckets.length, (month + 1) * 4);
}

/** 'YYYY-MM-DD' → 'dd/mm/yyyy' (empty for null). */
export function formatDate(iso: string | null | undefined): string {
    if (!iso) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** 'YYYY-MM-DD' → 'dd/mm'. */
export function formatDayMonth(iso: string | null | undefined): string {
    return formatDate(iso).slice(0, 5);
}

/** S-Curve installment header colours (Excel rows 13, 28, 39, 46, 51, 56, 67, 72) and a readable text colour. */
const INSTALLMENT_FILLS = ['#118AB2', '#06D6A0', '#FF9B54', '#EF476F', '#0B5394', '#76A5AF', '#0B5394', '#6D9EEB'];
const DARK_TEXT = new Set(['#06D6A0', '#FF9B54', '#76A5AF', '#6D9EEB']);
export function installmentColors(no: number): { background: string; color: string } {
    const bg = INSTALLMENT_FILLS[(no - 1 + INSTALLMENT_FILLS.length) % INSTALLMENT_FILLS.length] ?? '#118AB2';
    return { background: bg, color: DARK_TEXT.has(bg) ? '#1f2937' : '#ffffff' };
}

/** Chart colours: reference categorical slots 1 (blue) and 2 (orange); ink/grid from the reference chrome. */
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
