// Required plan values of one element card → its fill state (see FillStatus) and one "ยังขาด: …" line.
// Pure, so every card page states its required values the same way.
import { fillState, type FillState } from './FillStatus';

/** One required plan value of an element. */
export interface PlanCheck {
    /** Field label as shown on the card (used in "ยังขาด: …"). */
    label: string;
    ok: boolean;
}

/** A plan number counts as filled once it is a positive number. */
export const isPositive = (v: number): boolean => Number.isFinite(v) && v > 0;

export interface CheckResult {
    state: FillState;
    /** "ยังขาด: ความกว้าง, ความยาว" while the element is half filled. */
    missingText: string | undefined;
    /** The element holds plan values (ask before deleting it). */
    hasData: boolean;
}

/**
 * `started` tells an untouched element (grey) from a half-filled one (red) when some checks pass by default
 * (a standard bar size, a value copied from the previous element). Default: any check passes.
 */
export function planChecks(checks: readonly PlanCheck[], started: boolean = checks.some(c => c.ok)): CheckResult {
    const state = fillState(checks.map(c => c.ok), started);
    const missing = checks.filter(c => !c.ok).map(c => c.label);
    const shown = missing.length <= 4 ? missing.join(', ') : `${missing.slice(0, 4).join(', ')} และอีก ${String(missing.length - 4)} ช่อง`;
    return { state, missingText: state === 'missing' ? `ยังขาด: ${shown}` : undefined, hasData: started };
}
