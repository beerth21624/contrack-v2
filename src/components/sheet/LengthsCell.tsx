'use client';

import { useTranslations } from 'next-intl';
import { TextCell, SHEET_COLORS } from '@/components/sheet/NumberCell';

/**
 * "12.5+11+4.5" → [12.5, 11, 4.5]; a term "5.09*2" becomes two segments of 5.09 when the count is whole;
 * "1-1+1" → [1, -1, 1] (Excel cells are typed like `=1-1+1+1+0.5`).
 */
export function parseLengths(text: string): number[] | null {
    const body = text.replace(/^=/, '').replace(/,/g, '').replace(/\s+/g, '');
    if (body === '') return [];
    const out: number[] = [];
    // "a-b" → "a+-b" (a leading minus or one after "*" stays part of its number).
    const terms = body.replace(/([^*+-])-/g, '$1+-').split('+');
    for (const term of terms) {
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
    return lengths.map(String).join('+').replace(/\+-/g, '-');
}

/** Yellow cell holding a sum of lengths typed like the Excel formula (=12.5+11+4.5…). */
export function LengthsCell({ lengths, onChange, ariaLabel }: {
    lengths: number[]; onChange: (lengths: number[]) => void; ariaLabel?: string;
}) {
    const t = useTranslations('sheet');
    return (
        <div style={{ background: SHEET_COLORS.input, borderRadius: 3 }} title={t('lengths.hint')}>
            <TextCell value={formatLengths(lengths)} ariaLabel={ariaLabel} placeholder={t('lengths.placeholder')}
                onCommit={v => {
                    const parsed = parseLengths(v ?? '');
                    if (parsed) onChange(parsed);
                }} />
        </div>
    );
}
