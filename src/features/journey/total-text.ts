import { formatNumber } from '@/components/sheet/NumberCell';

/** Shown instead of a money total that is not a finite number (a plan value so large the sum overflows). */
export const NO_TOTAL_TEXT = '—';

/** A money total in whole baht ("1,855,162"), or a dash when it is not a finite number (never a blank). */
export function totalText(value: number): string {
    return Number.isFinite(value) ? formatNumber(value, 0) : NO_TOTAL_TEXT;
}
