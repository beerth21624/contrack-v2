// ─── What a crew profile still needs to reach L1 ("โปรไฟล์ครบ"). Pure; the server decides `profileComplete`. ───
import type { VendorProfileDto } from '@/shared/contract';
import { vText, type VT } from './text';

export const L1_MIN_PORTFOLIO = 3;

/** Short Thai items still missing for L1 (empty = complete): team size, ≥ 3 portfolio items, trades, provinces. */
export function profileMissing(p: Pick<VendorProfileDto, 'trades' | 'provinces' | 'crewSkilled' | 'crewLabourers' | 'portfolio'>, t: VT = vText()): string[] {
    const out: string[] = [];
    if (p.trades.length === 0) out.push(t('profile.missing.trades'));
    if (p.provinces.length === 0) out.push(t('profile.missing.provinces'));
    if (p.crewSkilled === null && p.crewLabourers === null) out.push(t('profile.missing.crew'));
    const more = L1_MIN_PORTFOLIO - p.portfolio.length;
    if (more > 0) out.push(t('profile.missing.portfolio', { n: more }));
    return out;
}

export { TOOL_SUGGESTIONS, toolLabel } from '@/domain/subcontracting/vendor-tools';
