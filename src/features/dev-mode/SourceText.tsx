'use client';

// ─── A value's source as shown on the dev-mode screens: hard-coded values in red, everything else as plain text ───
// Inline style (not a Tailwind class) so the printed trace report keeps the colour.
import type { BoqLineExplanation, BoqNetSource, BoqPriceExplanation } from '@/domain/trace';

export const HARD_CODE_STYLE = { color: '#dc2626', fontWeight: 600 } as const;

export const isHardCodedNet = (s: BoqNetSource): boolean => s.kind === 'template';
export const isHardCodedPrice = (p: BoqPriceExplanation): boolean => p.source.kind === 'template';
export const isHardCodedWaste = (l: BoqLineExplanation): boolean => l.waste.source === 'template';

export function SourceText({ text, hard }: { text: string; hard: boolean }) {
    return hard ? <span style={HARD_CODE_STYLE}>{text}</span> : <>{text}</>;
}
