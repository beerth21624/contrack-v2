'use client';

import { TextCell, SHEET_COLORS } from '@/components/sheet/NumberCell';

/** "12.5+11+4.5" → [12.5, 11, 4.5]; a term "5.09*2" becomes two segments of 5.09 when the count is whole. */
export function parseLengths(text: string): number[] | null {
    const body = text.replace(/^=/, '').replace(/,/g, '').replace(/\s+/g, '');
    if (body === '') return [];
    const out: number[] = [];
    for (const term of body.split('+')) {
        const factors = term.split('*').map(Number);
        if (factors.length === 0 || factors.length > 2 || factors.some(f => !Number.isFinite(f))) return null;
        const [a = 0, n] = factors;
        if (n !== undefined && Number.isInteger(n) && n > 0 && n <= 50) for (let i = 0; i < n; i++) out.push(a);
        else out.push(n === undefined ? a : a * n);
    }
    return out;
}

/** [5.09, 5.09] → "5.09*2"; otherwise "a+b+c" (how the Excel cell was typed). */
export function formatLengths(lengths: number[]): string {
    if (lengths.length > 1 && lengths.every(x => x === lengths[0])) return `${lengths[0]}*${lengths.length}`;
    return lengths.map(String).join('+');
}

/** Yellow cell holding a sum of lengths typed like the Excel formula (=12.5+11+4.5…). */
export function LengthsCell({ lengths, onChange, ariaLabel }: {
    lengths: number[]; onChange: (lengths: number[]) => void; ariaLabel?: string;
}) {
    return (
        <div style={{ background: SHEET_COLORS.input, borderRadius: 3 }} title="พิมพ์ความยาวแต่ละช่วงคั่นด้วย + เช่น 12.5+11+4.5">
            <TextCell value={formatLengths(lengths)} ariaLabel={ariaLabel} placeholder="เช่น 12.5+11+4.5"
                onCommit={v => {
                    const parsed = parseLengths(v ?? '');
                    if (parsed) onChange(parsed);
                }} />
        </div>
    );
}
