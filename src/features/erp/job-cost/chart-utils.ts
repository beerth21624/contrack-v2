// ─── Shared helpers of the hand-drawn SVG charts of job cost / cash flow ───
export const CHART_W = 1000;
export const CHART_M = { left: 72, right: 20, top: 16, bottom: 44 };

/** "Nice" tick values covering [lo, hi]. */
export function niceTicks(lo: number, hi: number, count = 5): number[] {
    const span = hi - lo;
    if (!(span > 0)) return [lo];
    const raw = span / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => s >= raw) ?? raw;
    const out: number[] = [];
    for (let v = Math.floor(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.round(v / step) * step);
    return out;
}

const compactTh = new Intl.NumberFormat('th-TH', { notation: 'compact', maximumFractionDigits: 1 });
const compactEn = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
export const compactNumber = (v: number, locale: string): string => (locale === 'th' ? compactTh : compactEn).format(v);

export const COLORS = {
    budget: '#8aa4c8',
    committed: '#e0a526',
    actual: '#eb6834',
    eac: '#1c3d6e',
    plan: '#2a78d6',
    balance: '#0b0b0b',
    min: '#c0392b',
    estimate: '#7d5bbf',
    grid: '#e1e0d9',
    axis: '#c3c2b7',
    muted: '#898781',
    ink2: '#52514e',
} as const;
